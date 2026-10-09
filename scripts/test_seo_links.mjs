/* Vérification des liens HTML internes et des fichiers CSS,
   hors ligne, sans bibliothèque ni service payant.
   Lancer : node scripts/test_seo_links.mjs après génération. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const errors=[];
let pages=["index.html"];
function gather(folder){
 if(!fs.existsSync(path.join(root,folder)))return;
 for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){
  const rel=folder+"/"+entry.name;
  if(entry.isDirectory())gather(rel);
  else if(entry.isFile()&&entry.name.endsWith(".html"))pages.push(rel);
 }
}
gather("guides");gather("evenements");
let checked=0;
for(const name of pages){
 const body=fs.readFileSync(path.join(root,name),"utf8");
 const webBase=new URL("https://local.test/"+name.replace(/index\.html$/,""));
 const checks=[...body.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi),...body.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/gi)];
 for(const match of checks){
  const href=match[1];
  if(/^(https?:|mailto:|tel:|data:|javascript:)/i.test(href))continue;
  if(href.startsWith("#")){
   if(href.length>1&&!body.includes('id="'+href.slice(1)+'"'))errors.push(name+": ancre manquante "+href);
   continue;
  }
  if(!href||href.startsWith("/")){errors.push(name+": lien non relatif "+href);continue}
  const u=new URL(href,webBase);
  const rel=decodeURIComponent(u.pathname).replace(/^\/+/,"");
  const target=u.pathname.endsWith("/")?path.join(root,rel,"index.html"):path.join(root,rel);
  if(!fs.existsSync(target))errors.push(name+": lien cassé "+href+" → "+rel);
  checked++;
 }
}
if(errors.length){
 console.error("LIENS SEO KO : "+errors.length+"\n"+errors.slice(0,30).join("\n"));
 process.exitCode=1;
}else console.log("LIENS SEO OK : "+checked+" liens/fichiers CSS sur "+pages.length+" pages HTML.");
