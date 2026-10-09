import assert from "node:assert/strict";
import fs from "node:fs";
import {isFalseBooking,cleanCatalog,cleanPublicHtml} from "./activikids_booking_guard.mjs";
const bad=[
 ["EVT-0010","https://www.auderghem.be/node/20451"],
 ["EVT-0114","https://www.overijse.be/nieuwsbrieven/inschrijven"],
 ["EVT-0121","https://www.grensland.org/zomerkamp/inschrijven/"],
 ["EVT-0217","https://reseau-idee.be/fr/inscription-newsletters"],
 ["EVT-0285","https://tickets.bozar.be/api/1/redirect/cart?lang=fr&orderId=_orderId_"],
 ["EVT-0432","https://www.overijse.be/nieuwsbrieven/inschrijven"],
 ["EVT-0764","https://www.quefaire.be/unsubscribe.php"],
 ["EVT-0954","https://www.quefaire.be/unsubscribe.php"]
];
for(const [id,url] of bad)assert(isFalseBooking(url,id),"mauvaise réservation non bloquée "+id);
const uncertain=[
 ["EVT-0678","https://www.zemst.be/inschrijven"],
 ["EVT-0254","https://www.pierredelune.be/reservation.php?spec= 934"],
 ["EVT-0255","https://www.pierredelune.be/reservation.php?spec= 941"],
 ["EVT-0257","https://www.pierredelune.be/reservation.php?spec= 964"],
 ["EVT-0432","https://www.overijse.be/activiteiten/detail/5453/sinterklaasfeest-2026-het-cadeautjesmysterie-3"]
];
for(const [id,url] of uncertain)assert.equal(isFalseBooking(url,id),false,"lien incertain ou officiel supprimé "+id);
let catalog={events:[
 {id:"EVT-0010",n:"Halloween",url:"https://www.auderghem.be/",booking:bad[0][1],
  ed:[{s:"2026-10-31",src:"https://www.auderghem.be/agenda",prix:"À confirmer",booking:bad[0][1]}]},
 {id:"EVT-0678",n:"Zemst",ed:[{s:"2027-02-08",src:"https://www.zemst.be/",booking:uncertain[0][1]}]},
 {id:"EVT-0285",n:"Filemon",ed:[{s:"2026-10-25",src:"https://www.bozar.be/",booking:bad[4][1]}]}
 ]};
const before=JSON.parse(JSON.stringify(catalog));
let data=JSON.parse(JSON.stringify(catalog)),res=cleanCatalog(data);
assert.equal(res.removed,3);
assert.deepEqual(data.events.map(x=>x.id),before.events.map(x=>x.id));
assert.equal(data.events[0].url,before.events[0].url);
assert.equal(data.events[0].ed[0].src,before.events[0].ed[0].src);
assert.equal(data.events[0].ed[0].prix,before.events[0].ed[0].prix);
assert.equal(data.events[1].ed[0].booking,uncertain[0][1]);
assert.equal(cleanCatalog(data).removed,0,"pas idempotent");
let page='<html><script type="application/json" id="ak-data">'+JSON.stringify(catalog)+'</script></html>';
let first=cleanPublicHtml(page),second=cleanPublicHtml(first.html);
assert.equal(first.stats.removed,3);
assert.equal(second.html,first.html);
assert.equal(first.stats.edition_count,3);
// Production data: inspect only, never write or re-generate.
if(fs.existsSync("activikids/data/catalog.json")&&fs.existsSync("activikids/index.html")){
 const raw=fs.readFileSync("activikids/data/catalog.json","utf8");
 const site=fs.readFileSync("activikids/index.html","utf8");
 const p=JSON.parse(raw),html=cleanPublicHtml(site);
 assert(p.events.length>=1000,"couverture des événements réduite");
 assert(html.stats.event_count>=1000,"couverture HTML réduite");
 const snapshot=p.events.map(e=>({id:e.id,url:e.url,ed:(e.ed||[]).map(y=>({src:y.src,s:y.s}))}));
 cleanCatalog(p);
 assert.deepEqual(p.events.map(e=>({id:e.id,url:e.url,ed:(e.ed||[]).map(y=>({src:y.src,s:y.s}))})),snapshot,"provenance altérée");
}
console.log("GARDE ACTIVIKIDS OK : liens manifestement faux, incertains préservés, dates/IDs/sources stables.");
