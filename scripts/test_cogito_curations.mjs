import assert from "node:assert/strict";
import fs from "node:fs";
import { curateHtml } from "./cogito_curated_corrections.mjs";
const html=fs.readFileSync("cogito/index.html","utf8");
const parsed=s=>JSON.parse(s.match(/<script type="application\/json" id="cogito-data">([\s\S]*?)<\/script>/)[1]);
const old=parsed(html),res=curateHtml(html),out=parsed(res.html),again=curateHtml(res.html);
assert.equal(out.events.length,old.events.length,"événements perdus");
assert.deepEqual(out.events.map(e=>e.id),old.events.map(e=>e.id),"identités modifiées");
assert.equal(again.html,res.html,"corrections non idempotentes");
for(const id of ["COG-EVT-39F3F09CA789A5","COG-EVT-CE0F204DAE1A20","COG-EVT-1FA1CBB71F0E01","COG-EVT-E58E080D656D79","COG-EVT-653C0ABD38FB1B"]){
 const e=out.events.find(x=>x.id===id);
 if(e)assert.notEqual(e.ticketing_kind,"direct","faux lien direct "+id);
}
assert(out.events.find(x=>x.id==="COG-EVT-CE0F204DAE1A20")?.official_url?.includes("/2026-ecmi-annual-conference/"),"page CEPS exacte manquante");
assert(out.events.find(x=>x.id==="COG-EVT-39F3F09CA789A5")?.official_url?.includes("/the-uneven-implementation-of-the-ccd2-"),"page CCD2 exacte manquante");
console.log("COGITO TEST OK :",out.events.length,"événements, cinq fiches garanties, idempotence.");
