// Test local et déterministe du sas rapide EcoTank.
// Aucun robot, aucune requête réseau : les données sont lues dans le dépôt public.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../ecotank/entry-router.js", import.meta.url), "utf8");
const profile = JSON.parse(readFileSync(new URL("../ecotank/admin-profile.json", import.meta.url), "utf8"));
assert.ok(profile.entry_router?.questions?.length);

function session() {
  const elements = new Map(), listeners = {};
  const classList = () => ({ add() {}, remove() {}, toggle() {} });
  const element = (id = "") => ({ id, innerHTML: "", className: "", classList: classList() });
  const shell = {
    insertBefore(node) {
      elements.set(node.id, node);
      for (const match of node.innerHTML.matchAll(/\bid="([^"]+)"/g)) {
        elements.set(match[1], element(match[1]));
      }
    }
  };
  const document = {
    body: { classList: classList() },
    querySelector: query => query === "#simpleApp .simple-shell" ? shell : null,
    getElementById: id => elements.get(id) ?? null,
    createElement: () => element(),
    querySelectorAll: () => [...elements.values()].filter(item => item.className === "simple-screen"),
    addEventListener: (type, handler) => { listeners[type] = handler; }
  };
  elements.set("simpleHome", element("simpleHome"));
  const window = { scrollTo() {} };
  const fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(profile) });
  runInNewContext(source, { document, window, fetch });
  return {
    window, elements,
    click(selector, dataset = {}) {
      listeners.click({ target: { closest: current => current === selector ? { dataset } : null } });
    },
    choose(question, option) {
      this.click("[data-entry-option]", { entryQuestion: question, entryOption: option });
    },
    html(id) {
      return elements.get(id)?.innerHTML ?? "";
    }
  };
}
async function ready(session) {
  assert.equal(session.window.EcoTankEntryRouter.start(), true);
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function hasHelp(html) {
  return html.includes("Aucune autre réponse obligatoire");
}

const quick = session();
await ready(quick);
assert.match(quick.html("entryRouterHost"), /data-entry-fast-help/);
assert.ok(
  quick.html("entryRouterHost").indexOf('data-entry-fast-help') <
    quick.html("entryRouterHost").indexOf('data-entry-option'),
  "L'aide urgente doit être visible AVANT la liste de situations, même sur petit écran"
);
quick.click("[data-entry-fast-help]");
assert.ok(hasHelp(quick.html("entryDifficultHost")), "Premières pistes accessibles sans formulaire");
assert.match(quick.html("entryDifficultHost"), /Commencer par une aide humaine/);
assert.match(quick.html("entryDifficultHost"), /https:\/\//);
quick.click("[data-help-topic]", { helpTopic: "housing" });
assert.match(quick.html("entryDifficultHost"), /logement/i);
await ready(quick);
quick.click("[data-entry-fast-help]");
assert.match(quick.html("entryDifficultHost"), /Commencer par une aide humaine/, "Le sujet ne doit pas fuir vers le parcours suivant");

const journeys = [
  ["sans droits ni documents", [["q_entry_situation", "start_from_zero"]], true],
  ["situation inconnue", [["q_entry_situation", "other_unknown"]], true],
  ["séjour à clarifier", [["q_entry_situation", "new_arrival_or_residence"]], true],
  ["statut international", [["q_entry_situation", "international_special"]], true],
  ["salarié avec bases administratives perdues", [["q_entry_situation", "employee"], ["q_foundations_ok", "no_or_unknown"]], true],
  ["étudiant avec difficultés administratives", [["q_entry_situation", "student"], ["q_foundations_ok", "some_problems"]], true],
  ["salarié sans difficultés déclarées", [["q_entry_situation", "employee"], ["q_foundations_ok", "yes"]], false],
  ["allocation existante sans difficultés déclarées", [["q_entry_situation", "replacement_income"], ["q_replacement_income_type", "unemployment"]], false]
];
for (const [name, answers, expectHelp] of journeys) {
  const s = session();
  await ready(s);
  for (const [question, option] of answers) s.choose(question, option);
  const destination = s.html("entryDestinationHost");
  assert.ok(destination, name + " : aucune orientation");
  const available = destination.includes("data-entry-admin");
  assert.equal(available, expectHelp, name + " : parcours ordinaire modifié ou aide inaccessible");
  if (available) {
    s.click("[data-entry-admin]");
    assert.ok(hasHelp(s.html("entryDifficultHost")), name + " : pas de conseils");
  }
}

// Chaque identifiant de source des premières pistes existe dans le catalogue officiel.
const linkedKeys = [...source.matchAll(/\[\["([a-z][a-z0-9_]+)","[^"]+"\]/g)].map(match => match[1]);
for (const key of new Set(linkedKeys)) {
  assert.ok(profile.official_sources?.[key]?.url?.startsWith("https://"), "Source officielle manquante : " + key);
}
console.log("EcoTank : accès immédiat, retour à zéro, 8 parcours et sources officielles — OK (aucun robot exécuté).");
