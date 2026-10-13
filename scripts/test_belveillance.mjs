/* Belveillance publication boundary + four top-level participation modes.
 * No network calls, no paid service and no private preproduction data required.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "belveillance/index.html"), "utf8");
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const source = JSON.parse(fs.readFileSync(path.join(root, "belveillance/catalogue.json"), "utf8"));
const modes = {
  solo_calme: "En solo, au calme",
  solo_sociable: "En solo, mais envie de sociabiliser",
  couple: "En couple",
  amis: "Entre amis",
};
for (const [id,label] of Object.entries(modes)) {
  assert(page.includes('data-mode="'+id+'"'),"Belveillance mode ID missing: "+id);
  assert(page.includes(label),"Belveillance mode title missing: "+label);
  assert(page.includes('aria-pressed="false"'),"Modes must have accessible controlled state");
}
assert.equal((page.match(/class="bv-mode"/g)||[]).length,4,"Exactly four first-step modes");
const posModes=page.indexOf('class="bv-choices"');
const posFilters=page.indexOf('class="bv-filters"');
assert(posModes>0 && posFilters>posModes,"Participation selection must precede all search filters");
assert(page.includes('id="explorer"') && page.includes('id="results"') && page.includes('id="ideas-list"'));
assert(page.includes('role="status"') && page.includes('aria-live="polite"'));
assert(page.includes('getApproved(d.items)') && page.includes('x.publication_status==="Autorisé"') && page.includes('x.verified===true'));
assert(page.includes('validUrl(x.url)') && page.includes('textContent=text'),"Reject unsafe URLs and HTML injection");
assert(page.includes('href="../confidentialite.html"'));
assert(home.includes('href="belveillance/"'),"Home must link to Belveillance");
assert(!home.includes('aria-label="Belveillance sera bientôt disponible"'),"Obsolete coming-soon label");
assert(sitemap.includes("https://cloelia50.github.io/belgique-je-taime-site/belveillance/"));
assert.equal(source.schema_version,1);
assert.equal(source.engine,"BELVEILLANCE");
assert(Array.isArray(source.items),"Catalogue schema should always contain items");
for(const x of source.items){
 assert(x.publication_status==="Autorisé" && x.verified===true,"Unreviewed record exposed");
 assert(x.title && Array.isArray(x.modes) && x.modes.length>0,"Missing verified participation");
 assert(x.modes.every(x=>Object.hasOwn(modes,x)),"Unknown participation mode");
 assert(/^https:\/\/[^@\s]+$/i.test(x.url),"Non-HTTPS external source");
 assert(!("email" in x) && !("phone" in x) && !("private_notes" in x),"No private fields");
}
console.log("BELVEILLANCE OK — four primary modes, accessible portal, verified-only publication, homepage and sitemap links.");
