import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const homepage=read('index.html');
for(const key of ['Écotank','Activikids','Cogito','Belveillance','Comment tout a commencé','guides/','sorties-permanentes/'])assert(homepage.includes(key),'Accueil: '+key);
const catalog=JSON.parse(read('sorties-permanentes/catalogue.json'));
assert.equal(catalog.items.length,63,'63 activités permanentes attendues');
assert.equal(new Set(catalog.items.map(x=>x.id)).size,63,'ID permanent doublonné');
for(const item of catalog.items){assert(item.url_officielle||item.source_pratique,'source manquante '+item.id);assert(!/Partenariat commercial en pause/.test(item.notes||''),'note interne '+item.id)}
assert(exists('sorties-permanentes/index.html'),'page permanente absente');
assert(!exists('activikids/permanents/catalogue.json'),'ne pas créer des permanents dans le répertoire remplacé par le robot');
const map=read('sitemap.xml');const urls=[...map.matchAll(/<loc>([^<]+)<[/]loc>/g)].map(m=>m[1]);assert.equal(urls.length,new Set(urls).size,'sitemap doublons');
for(const slug of ['activites-gratuites-bruxelles','sorties-ce-week-end','conferences-bruxelles','rencontres-litteraires','demarches-administratives','sorties-famille-petit-budget','conferences-gratuites-belgique','premiere-demande-cpas']){
 assert(exists('guides/'+slug+'/index.html'),'guide absent '+slug);
 assert(urls.some(u=>u.endsWith('/guides/'+slug+'/')),'sitemap guide absent '+slug);
}
for(const id of ['activikids-evt-0280-2026-11-20','activikids-evt-0319-2026-10-19','activikids-evt-0432-2026-12-05','cogito-cog-evt-5471e6dd6b8726'])assert(!urls.some(u=>u.includes(id)),'événement en revue indexé '+id);
assert(!urls.some(u=>u.includes('/sorties-permanentes/')),'préversion permanente non validée indexée');
console.log('PUBLIC RELEASE OK : accueil intact, 8 guides, 63 permanents, sitemap unique, événements litigieux écartés.');
