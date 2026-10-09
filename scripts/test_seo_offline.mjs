/* Tests SEO sans internet, sans dépendance npm, sans GitHub Actions.
   Exécuter dans une copie locale du dépôt : node scripts/test_seo_offline.mjs */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"bjt-seo-"));
let checks=0;
const ok=(v,msg)=>{assert.ok(v,msg);checks++};
const put=(name,data)=>{const file=path.join(temp,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data,"utf8")};
const read=(name)=>fs.readFileSync(path.join(temp,name),"utf8");
const urls=xml=>[...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m=>m[1]);
const slugs=["activites-gratuites-bruxelles","sorties-ce-week-end","conferences-bruxelles","rencontres-litteraires","demarches-administratives","sorties-famille-petit-budget","conferences-gratuites-belgique","premiere-demande-cpas"];
function run(date){
 const p=spawnSync(process.execPath,[path.join(root,"scripts/build_seo_guides.mjs"),"--repo",temp,"--as-of",date],{encoding:"utf8",timeout:30000});
 ok(p.status===0,"Générateur "+date+" : "+(p.stderr||p.stdout));
 return urls(read("sitemap.xml"));
}
try{
 for(const f of ["activikids/data/catalog.json","cogito/index.html","ecotank/admin-profile.json","sitemap.xml"])
   put(f,fs.readFileSync(path.join(root,f),"utf8"));
 let previousActive=Infinity;
 for(const day of ["2026-10-09","2026-11-01","2026-12-01","2027-04-01"]){
  const links=run(day);
  ok(links.length===new Set(links).size,"URLs dupliquées");
  const activeLinks=links.filter(u=>/\/evenements\/[^/]+\/$/.test(u));
  ok(activeLinks.length<=previousActive,"Une date plus tardive a augmenté les prochains événements");
  previousActive=activeLinks.length;
  const eventFolder=path.join(temp,"evenements");
  const names=fs.readdirSync(eventFolder,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name);
  for(const name of names){
   const html=read("evenements/"+name+"/index.html");
   const canonical="https://cloelia50.github.io/belgique-je-taime-site/evenements/"+name+"/";
   const listed=links.includes(canonical),indexed=html.includes('content="index,follow"');
   ok(listed===indexed,"Sitemap/robots en désaccord : "+name);
   const json=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
   if(indexed){
    ok(Boolean(json),"Event JSON-LD manquant : "+name);
    const e=JSON.parse(json[1]).find(x=>x["@type"]==="Event");
    ok(e?.startDate&&e?.name&&e?.location?.address?.postalCode,"Event incomplet : "+name);
   }else ok(!json,"Une archive contient du balisage Event : "+name);
  }
  for(const slug of slugs){
   const html=read("guides/"+slug+"/index.html");
   ok((html.match(/<h1\b/g)||[]).length===1,"H1 "+slug);
   ok(html.includes('rel="canonical"'),"Canonical "+slug);
   ok(links.some(u=>u.endsWith("/guides/"+slug+"/")),"Guide non référencé dans sitemap : "+slug);
  }
  const admin=read("guides/demarches-administratives/index.html");
  ok(admin.includes("https://pcswonline.socialsecurity.be/unsecured/fr/helpRequestForm.html"),"Lien officiel CPAS sans connexion absent");
 }
 const idem=read("sitemap.xml");
 run("2027-04-01");
 ok(read("sitemap.xml")===idem,"Sitemap non idempotent");
 const autumn=read("evenements/activikids-evt-0010-2026-10-31/index.html");
 ok(autumn.includes('content="noindex,follow"'),"Archive de l’événement d’octobre");
 console.log("SEO OFFLINE OK : "+checks+" assertions / quatre dates / test d’idempotence.");
}finally{fs.rmSync(temp,{recursive:true,force:true})}
