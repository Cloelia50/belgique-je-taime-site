import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Garde-fou de publication Activikids.
 * Ignore les URLs incertaines ; retire SEULEMENT les réservations
 * manifestement étrangères à l'événement.
 * Ne modifie ni les sources officielles, ni les événements,
 * ni les dates, ni les prix, ni le Google Sheet maître.
 */
const DEFINITIVELY_WRONG=new Map([
  ["EVT-0010",["www.auderghem.be/node/20451"]],
  ["EVT-0114",["www.overijse.be/nieuwsbrieven/inschrijven"]],
  ["EVT-0121",["www.grensland.org/zomerkamp/inschrijven"]],
  ["EVT-0217",["reseau-idee.be/fr/inscription-newsletters"]],
  ["EVT-0285",["tickets.bozar.be/api/1/redirect/cart"]],
  ["EVT-0432",["www.overijse.be/nieuwsbrieven/inschrijven"]],
  ["EVT-0433",["www.overijse.be/nieuwsbrieven/inschrijven"]]
]);
const AK_DATA=/(<script\s+type="application\/json"\s+id="ak-data">)([\s\S]*?)(<\/script>)/i;

export function isFalseBooking(raw,eventId=""){
 if(typeof raw!=="string"||!raw.trim())return false;
 let u;
 try{u=new URL(raw.trim());}catch{return false;} // uncertain malformed links go to review
 if(!["http:","https:"].includes(u.protocol))return false;
 const host=u.hostname.toLowerCase().replace(/^www\./,"");
 const pathname=decodeURIComponent(u.pathname).toLowerCase().replace(/\/+$/,"");
 const full=(host+pathname);
 // Confirmed functional mismatch: unsubscribe/newsletter ≠ event booking.
 if(/(?:^|\/)(?:unsubscribe(?:\.php)?|inscription-newsletters|nieuwsbrieven)(?:\/|$)/i.test(pathname))return true;
 if(/(?:^|\/)(?:newsletters?|unsubscribe|désinscription|desinscription)(?:\/|$)/i.test(pathname))return true;
 // Bozar has a checkout variable that is not an actual order number.
 if(host==="tickets.bozar.be"&&/\/api\/1\/redirect\/cart/.test(pathname)&&u.searchParams.get("orderId")==="_orderId_")return true;
 if((DEFINITIVELY_WRONG.get(eventId)||[]).some(s=>full===s.replace(/^www\./,"")))return true;
 return false;
}
export function cleanCatalog(catalog){
 if(!catalog||!Array.isArray(catalog.events))throw Error("Catalogue Activikids invalide");
 const events=catalog.events;
 const ids=events.map(e=>e.id);
 if(ids.some(id=>typeof id!=="string")||new Set(ids).size!==ids.length)throw Error("IDs Activikids invalides ou dupliqués");
 const origEd=events.reduce((n,e)=>n+(Array.isArray(e.ed)?e.ed.length:0),0);
 let removed=0, examples=[];
 for(const e of events){
   if(isFalseBooking(e.booking,e.id)){
      if(examples.length<30)examples.push({id:e.id,where:"event",url:e.booking});
      delete e.booking;removed++;
   }
   for(const ed of Array.isArray(e.ed)?e.ed:[]){
     if(isFalseBooking(ed.booking,e.id)){
       if(examples.length<30)examples.push({id:e.id,where:"edition",date:ed.s,url:ed.booking});
       delete ed.booking;removed++;
     }
   }
 }
 if(events.length!==ids.length||ids.some((id,i)=>events[i].id!==id)||
    events.reduce((n,e)=>n+(Array.isArray(e.ed)?e.ed.length:0),0)!==origEd)throw Error("Érosion Activikids détectée");
 return {event_count:events.length,edition_count:origEd,removed,examples};
}
export function cleanPublicHtml(html){
 const match=html.match(AK_DATA);
 if(!match)throw Error("HTML Activikids sans catalogue ak-data");
 const catalog=JSON.parse(match[2]);
 const stats=cleanCatalog(catalog);
 if(stats.removed===0)return {html,stats};
 const embedded=JSON.stringify(catalog).replace(/<\//g,"<\\/");
 return {html:html.replace(AK_DATA,(_all,open,_old,close)=>open+embedded+close),stats};
}
export function applyToSite(root){
 const catalogPath=path.join(root,"activikids/data/catalog.json");
 const htmlPath=path.join(root,"activikids/index.html");
 if(!fs.existsSync(catalogPath)||!fs.existsSync(htmlPath))throw Error("Deux fichiers publics Activikids requis");
 const oldCatalog=fs.readFileSync(catalogPath,"utf8");
 const oldHtml=fs.readFileSync(htmlPath,"utf8");
 const catalog=JSON.parse(oldCatalog);
 if(catalog.events?.length<1000)throw Error("Catalogue Activikids trop petit — publication bloquée");
 const first=cleanCatalog(catalog);
 const second=cleanPublicHtml(oldHtml);
 if(second.stats.event_count<1000||second.stats.edition_count<1000)throw Error("Catalogue HTML tronqué — publication bloquée");
 if(first.event_count!==second.stats.event_count)throw Error("HTML et JSON n'ont pas le même nombre d'événements");
 const nextCatalog=first.removed?JSON.stringify(catalog):oldCatalog;
 // No partial writes until both source representations are parsed & verified.
 if(first.removed)fs.writeFileSync(catalogPath,nextCatalog+"\n","utf8");
 if(second.stats.removed)fs.writeFileSync(htmlPath,second.html,"utf8");
 return {json:first,html:second.stats};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),i=args.indexOf("--repo");
 const root=path.resolve(i<0?".":(args[i+1]||"."));
 console.log("Activikids — garde-fou :",JSON.stringify(applyToSite(root)));
}