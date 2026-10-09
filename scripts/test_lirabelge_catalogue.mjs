import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../lirabelge/index.html", import.meta.url), "utf8");
const open = '<script type="application/json" id="bookData">';
const first = page.indexOf(open);
assert.ok(first >= 0, "Lirabelge: script bookData introuvable");
const end = page.indexOf("</script>", first + open.length);
assert.ok(end > first, "Lirabelge: script bookData non fermé");
const data = JSON.parse(page.slice(first + open.length, end));
assert.ok(Array.isArray(data.books) && data.books.length >= 1536, "Le catalogue a régressé sous 1 536 livres");
assert.ok(Array.isArray(data.authors) && data.authors.length >= 192, "Les nouvelles autrices ont disparu");
const ids = data.books.map(book => book.id);
assert.equal(new Set(ids).size, ids.length, "Livre ID dupliqué");
const authors = data.authors.map(a => a.id);
assert.equal(new Set(authors).size, authors.length, "Auteur ID dupliqué");

const expected = new Map([
  ["LB-GRAND-ABS-20261009-08", "La visite de Petite Mort"],
  ["LB-GRAND-ABS-20261009-09", "Moi et Rien"],
  ["LB-GRAND-ABS-20261009-10", "Je ne suis pas là"],
  ["LB-50-AUTRICES-001", "Les Miroirs du désordre"],
  ["LB-50-AUTRICES-002", "D'abord le souffle"],
  ["LB-50-AUTRICES-003", "Sources de sel"],
  ["LB-50-AUTRICES-004", "Poésies"]
]);
for (const [id, title] of expected) {
  const book = data.books.find(b => b.id === id);
  assert.ok(book, "Ouvrage disparu : " + id);
  assert.equal(book.title, title);
  assert.equal(book.nationality, "belge");
  assert.ok(/^\d{13}$/.test(String(book.isbn)), "ISBN douteux : " + id);
  assert.ok(book.publisher && book.author && book.source.startsWith("https://"), "Données essentielles absentes : " + id);
}
for (const name of ["Anne-Marielle Wilwerth", "Madeleine Ley"]) {
  assert.ok(data.authors.some(a => a.name === name), "Fiche autrice absente : " + name);
}
assert.ok(page.includes("fonts/newsreader.woff2"), "Design local disparu");
console.log("Lirabelge: " + data.books.length + " livres, " + data.authors.length + " auteurs, 7 nouveaux ouvrages conservés — OK");
