import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Corrections vérifiées pour cinq fiches; n'altère jamais les autres événements.
   Aucun accès réseau, aucune API, aucune suppression de source. */
const CEPS_DUPLICATE="https://ceps.my.salesforce-sites.com/eventregistration?eventid=a1GQA00000MkpcL2AR";
const RBDH_OLD="https://forms.gle/7f6oFDaHw8pHBsm87";
const RBDH_HUB="https://rbdh-bbrow.be/formations/";
const CEPS_HUB="https://www.ceps.eu/ceps-events/";
const DATA_RX=/<script type="application\/json" id="cogito-data">([\s\S]*?)<\/script>/;
export function curate(payload) {
  if(!payload||!Array.isArray(payload.events))throw Error("COGITO payload absent");
  const ids=payload.events.map(x=>x.id);
  if(ids.length!==new Set(ids).size)throw Error("IDs Cogito dupliqués");
  const changed=[];
  const target=(id,date,title,apply)=>{
    const e=payload.events.find(x=>x.id===id);
    if(!e)return;
    if(e.date!==date||e.title!==title)throw Error("Identité Cogito différente: "+id);
    const before=JSON.stringify(e);
    apply(e);
    if(JSON.stringify(e)!==before)changed.push(id);
  };
  target("COG-EVT-39F3F09CA789A5","2026-10-19",
    "The uneven implementation of the CCD2: between innovation, inclusion and consumer protection",e=>{
    if(e.official_url===CEPS_HUB)e.official_url="https://www.ceps.eu/ceps-events/the-uneven-implementation-of-the-ccd2-between-innovation-inclusion-and-consumer-protection/";
    if(e.ticketing_url===CEPS_DUPLICATE){e.ticketing_url="";e.ticketing_kind="";}
    if(e.price_label==="Gratuit")e.price_label="Gratuit, inscription obligatoire";
  });
  target("COG-EVT-CE0F204DAE1A20","2026-11-10","2026 ECMI Annual Conference",e=>{
    if(e.official_url===CEPS_HUB)e.official_url="https://www.ceps.eu/ceps-events/2026-ecmi-annual-conference/";
    if(e.ticketing_url===CEPS_DUPLICATE){e.ticketing_url="";e.ticketing_kind="";}
    if(e.price_label==="Payant pour certains publics")e.price_label="Gratuit selon statut ; autres participants : 300 €";
  });
  for(const [id,date,title] of [
    ["COG-EVT-1FA1CBB71F0E01","2026-11-12","RBDH — Lutter contre les discriminations dans le logement"],
    ["COG-EVT-E58E080D656D79","2026-11-26","RBDH — Introduction à la crise du logement"]
  ]){
    target(id,date,title,e=>{
      if(e.ticketing_url===RBDH_OLD){e.ticketing_url=RBDH_HUB;e.ticketing_kind="hub";}
      if(e.price_label==="30 €")e.price_label="30 € ; gratuit pour associations membres";
      if(e.is_free===false)e.is_free=null;
    });
  }
  target("COG-EVT-653C0ABD38FB1B","2026-11-23",
    "FARI Brussels Conference 2026 — Brussels, Capital of AI? (Jour 1)",e=>{
    if(e.ticketing_kind==="direct"&&/^https:\/\/www\.eventbrite\.be\/cc\/fari-brussels-conference-2026-/.test(e.ticketing_url||""))e.ticketing_kind="hub";
  });
  if(payload.events.length!==ids.length||ids.some((id,i)=>payload.events[i].id!==id))throw Error("Érosion ou réorganisation Cogito");
  if(payload.export_meta?.event_count!==undefined&&payload.export_meta.event_count!==ids.length)throw Error("Compteur incompatible");
  return changed;
}
export function curateHtml(html){
  const match=html.match(DATA_RX);
  if(!match)throw Error("Données COGITO publiques introuvables");
  const parsed=JSON.parse(match[1]);
  const count=parsed.events.length;
  const before=parsed.events.map(e=>e.id);
  const changed=curate(parsed);
  if(parsed.events.length!==count||before.some((id,i)=>parsed.events[i].id!==id))throw Error("Catalogue modifié hors champs autorisés");
  if(!changed.length)return {html,changed};
  const safe=JSON.stringify(parsed).replace(/</g,"\\u003c");
  const next=html.replace(DATA_RX,'<script type="application/json" id="cogito-data">'+safe+'</script>');
  if(next.length<html.length/2)throw Error("Fichier Cogito tronqué");
  return {html:next,changed};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  const ix=args.indexOf("--repo");
  const root=path.resolve(ix<0?".":(args[ix+1]||"."));
  const p=path.join(root,"cogito/index.html");
  const original=fs.readFileSync(p,"utf8");
  const out=curateHtml(original);
  if(out.changed.length)fs.writeFileSync(p,out.html,"utf8");
  console.log("COGITO conservé ; corrections:",out.changed.join(",")||"aucune");
}