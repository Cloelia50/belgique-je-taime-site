/* Belveillance current layout: four checked participation filters + approved-only feed.
 * Offline test, no network, no private registries.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root=process.cwd();
const page=fs.readFileSync(path.join(root,"belveillance/index.html"),"utf8");
const home=fs.readFileSync(path.join(root,"index.html"),"utf8");
const sitemap=fs.readFileSync(path.join(root,"sitemap.xml"),"utf8");
const source=JSON.parse(fs.readFileSync(path.join(root,"belveillance/catalogue.json"),"utf8"));
const modes={
  solo_calme:"En solo, au calme",
  solo_sociable:"En solo, mais envie de sociabiliser",
  couple:"En couple",
  amis:"Entre amis",
};

const first=page.indexOf('<fieldset class="bv-group" id="modes">');
const next=page.indexOf("</fieldset>",first);
assert(first>0&&next>first,"Primary mode filters missing");
const modeMarkup=page.slice(first,next);
const found=[...modeMarkup.matchAll(/<label class="bv-check"><input type="checkbox" value="([^"]+)">([^<]+)<\/label>/g)];
assert.equal(found.length,4,"Exactly four initial mode checkboxes expected");
assert.deepEqual(Object.fromEntries(found.map(m=>[m[1],m[2].trim()])),modes,
  "Unexpected participation mode identifier or text");
const otherFilters=["id=\"dates\"","id=\"regions\"","id=\"categories\""];
for(const id of otherFilters){let pos=page.indexOf(id);if(pos>=0)assert(pos>next,"Participation modes must precede "+id)}
assert(page.includes("getChecked('modes')"),"Mode choices are not wired into search");
assert(page.includes("if(modes.length&&(!Array.isArray(e.modes)||!modes.some(m=>e.modes.includes(m))))return false;"),
  "When a mode is selected, unknown or unmatched activities must be excluded");
assert(page.includes('id="results"')&&page.includes('role="status"')&&page.includes('aria-live="polite"'),
  "Accessible results status required");
assert(page.includes("x.verified===true")&&page.includes("x.publication_status==='Autorisé'"),
  "Only individually approved public records may be loaded");
assert(page.includes("function safeLink(")&&page.includes("safeLink(e.link)"),
  "No unchecked links are permitted");
assert(page.includes("textContent=value"),"User data should be rendered as text");
assert(page.includes('href="../confidentialite.html"'),"Privacy link required");
assert(home.includes('href="belveillance/"'),"Home should link to Belveillance");
assert(sitemap.includes("https://cloelia50.github.io/belgique-je-taime-site/belveillance/"));
assert.equal(source.schema_version,1);
assert.equal(source.engine,"BELVEILLANCE");
assert(Array.isArray(source.items));
for(const x of source.items){
  assert(x.publication_status==="Autorisé"&&x.verified===true,"Unreviewed record exposed");
  assert(x.title&&Array.isArray(x.modes)&&x.modes.length,"Unknown participation");
  assert(x.modes.every(m=>Object.hasOwn(modes,m)),"Unknown participation label");
  assert(/^https:\/\/[^@\s]+$/i.test(x.url),"Non-HTTPS external URL");
  assert(!("email" in x)&&!("phone" in x)&&!("private_notes" in x),"Private fields exposed");
}
console.log("BELVEILLANCE OK — four checked participation filters, approved-only feed, privacy and safe links.");
