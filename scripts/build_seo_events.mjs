import fs from "node:fs";
import path from "node:path";
// Sélection éditoriale délibérément limitée. Aucune auto-indexation de la base entière.
const IDA=["EVT-0010","EVT-0025","EVT-0092","EVT-0248","EVT-0280","EVT-0285","EVT-0319","EVT-0474","EVT-0432"];
const IDC=["COG-EVT-5471E6DD6B8726","COG-EVT-A2DC8E13E06C4D","COG-EVT-FF279621E13CCD","COG-EVT-34043D46350102","COG-EVT-6B501951621EF3","COG-EVT-B79DAEE18FA62F","COG-EVT-5006D538381EFD"];
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function url(v){return /^https?:\/\/[^\s<>"']+\.[^\s<>"']+/i.test(String(v||""))?String(v):""}
function text(v){return String(v||"").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim().replace(/(?:Lien officiel|Programme officiel)\s*:\s*https?:\/\/.+$/i,"")}
function clipped(v,n){let x=text(v);return x.length>n?x.slice(0,n).replace(/\s+\S*$/,"")+"…":x}
function dayOK(v){return /^\d{4}-\d{2}-\d{2}$/.test(v||"")&&!Number.isNaN(Date.parse(v+"T12:00:00Z"))}
function fmt(v){return new Intl.DateTimeFormat("fr-BE",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(v+"T12:00:00Z"))}
function belgianOffset(date){
 const part=new Intl.DateTimeFormat("en",{timeZone:"Europe/Brussels",timeZoneName:"shortOffset"}).formatToParts(new Date(date+"T12:00:00Z")).find(p=>p.type==="timeZoneName");
 const m=String(part?.value||"").match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
 return m?m[1]+m[2].padStart(2,"0")+":"+(m[3]||"00"):"";
}
function localDateTime(date,time){return /^\d\d:\d\d$/.test(time||"")?date+"T"+time+":00"+belgianOffset(date):date}
function post(v){let m=String(v||"").match(/,\s*(\d{4})\s+([^,]+)\s*$/);if(!m)return null;let street=String(v).slice(0,m.index).split(",").pop().trim();if(street.length<7)return null;return {"@type":"PostalAddress",streetAddress:street,postalCode:m[1],addressLocality:m[2].trim(),addressCountry:"BE"}}
function ld(x){return JSON.stringify(x).replace(/</g,"\\u003c")}
function entries(catalog,cogito,asof){
 let out=[];
 for(let id of IDA){
  let e=(catalog.events||[]).find(x=>x.id===id);if(!e)continue;
  let ed=(e.ed||[]).filter(x=>dayOK(x.s)&&x.s>="2026-10-01"&&x.s<"2027-04-01"&&["annoncee","conf"].includes(x.st)).sort((a,b)=>a.s.localeCompare(b.s))[0];
  if(!ed)continue;
  let source=url(ed.src||e.url),addr=ed.adr||e.adr,p=post(addr),summary=text(ed.prog),place=ed.lieu||e.lieu;
  if(!source||!p||!place||summary.length<38||!e.n)continue;
  let ending=dayOK(ed.e)&&ed.e>=ed.s?ed.e:ed.s;
  out.push({slug:"activikids-"+id.toLowerCase()+"-"+ed.s,name:e.n,group:"Activikids",city:e.co||p.addressLocality,place,address:addr,postal:p,source,summary,organizer:e.org||"",price:ed.prix||e.prix||"",age:e.age||"",start:ed.s,end:ending,startDate:localDateTime(ed.s,ed.hs),endDate:ed.he&&ending===ed.s?localDateTime(ed.s,ed.he):ending>ed.s?ending:"",archived:ending<asof});
 }
 for(let id of IDC){
  let e=(cogito.events||[]).find(x=>x.id===id);if(!e)continue;
  let date=String(e.start||e.date||"").slice(0,10),loc=e.location||"",p=post(loc),source=url(e.official_url),summary=text(e.description);
  if(!dayOK(date)||!p||!source||summary.length<55||!e.title||!e.time||/en ligne/i.test(e.mode||""))continue;
  let ending=String(e.end||"").slice(0,10);if(!dayOK(ending)||ending<date)ending=date;
  out.push({slug:"cogito-"+id.toLowerCase(),name:e.title,group:"Cogito",city:e.city||p.addressLocality,place:loc.split(",")[0],address:loc,postal:p,source,summary:clipped(summary,450),organizer:e.organizer||"",price:e.price_label||"",age:"",start:date,end:ending,startDate:String(e.start).includes("T")?e.start:localDateTime(date,e.time),endDate:String(e.end).includes("T")?e.end:ending>date?ending:"",archived:ending<asof});
 }
 return out.sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name));
}
function layout(title,description,canonical,robots,body,css,structured){
 let up=css.startsWith("../guides")?"../":"../../";
 return '<!doctype html><html lang="fr-BE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><meta name="robots" content="'+robots+'"><link rel="canonical" href="'+esc(canonical)+'">'+
 '<meta property="og:type" content="website"><meta property="og:site_name" content="Belgique, je t’aime"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+esc(canonical)+'">'+
 '<link rel="stylesheet" href="'+css+'">'+(structured?'<script type="application/ld+json">'+ld(structured)+'</script>':"")+
 '</head><body><a class="g-skip" href="#main">Aller au contenu</a><div class="g-shell"><header class="g-top"><a class="g-brand" href="'+up+'">♥ Belgique, je t’aime</a><nav class="g-nav" aria-label="Navigation principale"><a href="'+up+'">Accueil</a> <a href="'+up+'activikids/">Activikids</a> <a href="'+up+'cogito/">Cogito</a> <a href="'+up+'guides/">Guides</a></nav></header><main id="main">'+body+'</main>'+
 '<footer class="g-footer"><p><strong>Belgique, je t’aime</strong> — projet gratuit et indépendant. Vérifiez les informations auprès des organisateurs.</p><p><a href="'+up+'methodologie.html">Méthode &amp; sources</a> · <a href="'+up+'signaler.html">Signaler une erreur</a></p></footer></div></body></html>\n';
}
function detail(e,base){
 let canonical=base+"evenements/"+e.slug+"/",title=e.name+" | "+e.group+" — Belgique, je t’aime",desc=clipped(e.summary,135)+" À "+e.city+", le "+fmt(e.start)+".";
 let crumb='<nav class="g-breadcrumb" aria-label="Fil d’Ariane"><a href="../../">Accueil</a> › <a href="../">Événements</a> › '+esc(e.name)+'</nav>';
 if(e.archived)return layout(title,desc,canonical,"noindex,follow",crumb+'<section class="g-hero"><p class="g-kicker">ÉVÉNEMENT PASSÉ</p><h1>'+esc(e.name)+'</h1><p class="g-intro">Cette date est passée. Cette fiche est conservée comme archive et ne figure plus parmi les événements à venir.</p></section><section class="g-topic"><h2>Retrouver la prochaine édition</h2><p>Date connue : '+esc(fmt(e.start))+' · '+esc(e.city)+'. Pour de nouvelles dates, consultez la page de l’organisateur.</p><p><a href="'+esc(e.source)+'" rel="noopener noreferrer" target="_blank">Source officielle ↗</a> · <a href="../">Événements à venir</a></p></section>',"../../guides/guides.css",null);
 let event={"@context":"https://schema.org","@type":"Event",name:e.name,startDate:e.startDate,eventStatus:"https://schema.org/EventScheduled",eventAttendanceMode:"https://schema.org/OfflineEventAttendanceMode",location:{"@type":"Place",name:e.place,address:e.postal},description:clipped(e.summary,450),url:canonical};
 if(e.endDate)event.endDate=e.endDate;
 if(e.organizer)event.organizer={"@type":"Organization",name:e.organizer};
 let breadcrumbs={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Accueil",item:base},{"@type":"ListItem",position:2,name:"Événements",item:base+"evenements/"},{"@type":"ListItem",position:3,name:e.name,item:canonical}]};
 let body=crumb+'<section class="g-hero"><p class="g-kicker">ÉVÉNEMENT · '+esc(e.group)+' · '+esc(e.city)+'</p><h1>'+esc(e.name)+'</h1><p class="g-intro">'+esc(clipped(e.summary,270))+'</p></section>'+
 '<section class="g-topic"><h2>Au programme</h2><p>'+esc(e.summary)+'</p></section>'+
 '<section class="g-topic"><h2>Informations pratiques</h2>'+
 '<p><strong>Quand ?</strong> <time datetime="'+esc(e.start)+'">'+esc(fmt(e.start))+'</time>'+(e.end!==e.start?" au "+esc(fmt(e.end)):"")+(e.startDate.includes("T")?" · "+esc(e.startDate.split("T")[1].slice(0,5)):"")+'</p>'+
 '<p><strong>Où ?</strong> '+esc(e.place)+' — '+esc(e.address)+'</p>'+
 '<p><strong>Tarif :</strong> '+esc(e.price||"à confirmer")+'</p>'+
 (e.age?'<p><strong>Public :</strong> '+esc(e.age)+'</p>':"")+
 (e.organizer?'<p><strong>Organisateur :</strong> '+esc(e.organizer)+'</p>':"")+
 '<p><a class="g-source" href="'+esc(e.source)+'" rel="noopener noreferrer" target="_blank">Consulter la page officielle de l’événement ↗</a></p></section>'+
 '<aside class="g-disclaimer"><strong>Avant de vous déplacer ou de réserver :</strong> vérifiez les horaires, le prix et une éventuelle annulation auprès de l’organisateur. Cette fiche reprend des informations annoncées dans nos catalogues, sans constituer une confirmation indépendante.</aside>'+
 '<section class="g-related"><h2>À découvrir aussi</h2><p><a href="../">Autres événements à venir</a> · <a href="../../guides/">Guides pratiques</a> · <a href="'+(e.group==="Cogito"?"../../cogito/":"../../activikids/")+'">L’agenda '+esc(e.group)+'</a></p></section>';
 return layout(title,desc,canonical,"index,follow",body,"../../guides/guides.css",[event,breadcrumbs]);
}
function archiveUnknown(slug,base){
 return layout("Événement archivé — Belgique, je t’aime","Une ancienne fiche événement. Retrouvez les informations et événements à jour.",base+"evenements/"+slug+"/","noindex,follow",'<section class="g-hero"><p class="g-kicker">ARCHIVE</p><h1>Cette fiche n’est plus dans notre sélection.</h1><p>Les informations ne sont plus suffisamment récentes ou précises. <a href="../">Retrouvez les événements sélectionnés actuellement.</a></p></section>',"../../guides/guides.css",null);
}
export function buildEventPages(catalog,cogito,asof,base){
 if(!dayOK(asof))throw new Error("Date invalide");
 base=String(base).replace(/\/?$/,"/");
 let all=entries(catalog,cogito,asof),active=all.filter(x=>!x.archived),files={},urls=[];
 for(let e of all){files["evenements/"+e.slug+"/index.html"]=detail(e,base);if(!e.archived)urls.push(base+"evenements/"+e.slug+"/")}
 let cards=active.map(e=>'<li class="g-item"><h2><a href="'+esc(e.slug)+'/">'+esc(e.name)+'</a></h2><p class="g-detail">'+esc(fmt(e.start))+' · '+esc(e.city)+' · '+esc(e.group)+'</p><p>'+esc(clipped(e.summary,160))+'</p></li>').join("\n");
 let body='<nav class="g-breadcrumb" aria-label="Fil d’Ariane"><a href="../">Accueil</a> › Événements</nav><section class="g-hero"><p class="g-kicker">SORTIES ET CULTURE</p><h1>Événements sélectionnés en Belgique</h1><p class="g-intro">Des événements datés et sourcés, sélectionnés dans Activikids et Cogito. Chaque fiche renvoie à la page de l’organisateur.</p></section>'+
 '<section class="g-topic"><h2>Les prochains rendez-vous</h2><p class="g-asof">Sélection établie au '+esc(fmt(asof))+'. Vérifiez toujours les informations pratiques.</p>'+(cards?'<ul class="g-list g-event-list">'+cards+'</ul>':'<p>Aucun événement dans la sélection pour cette date. Consultez les agendas complets.</p>')+'</section><section class="g-related"><h2>Autres idées</h2><p><a href="../guides/sorties-ce-week-end/">Sorties du week-end</a> · <a href="../guides/conferences-bruxelles/">Conférences à Bruxelles</a></p></section>';
 files["evenements/index.html"]=layout("Événements en Belgique : sorties et conférences | Belgique, je t’aime","Sorties en famille, conférences et ateliers en Belgique avec des dates, des lieux et des liens officiels.",base+"evenements/",active.length?"index,follow":"noindex,follow",body,"../guides/guides.css",active.length?{"@context":"https://schema.org","@type":"CollectionPage",name:"Événements sélectionnés en Belgique",url:base+"evenements/"}:null);
 return {files,urls:active.length?[base+"evenements/"].concat(urls):[],metrics:{active:active.length,archived:all.length-active.length,activikids:active.filter(x=>x.group==="Activikids").length,cogito:active.filter(x=>x.group==="Cogito").length}};
}
export function rebuildEventPages(root,catalog,cogito,asof,base){
 let output=buildEventPages(catalog,cogito,asof,base),dir=path.join(root,"evenements");
 fs.mkdirSync(dir,{recursive:true});
 for(let entry of fs.readdirSync(dir,{withFileTypes:true})){if(!entry.isDirectory())continue;let k="evenements/"+entry.name+"/index.html";if(!(k in output.files))output.files[k]=archiveUnknown(entry.name,String(base).replace(/\/?$/,"/"))}
 for(let [name,content] of Object.entries(output.files)){let loc=path.join(root,name);fs.mkdirSync(path.dirname(loc),{recursive:true});fs.writeFileSync(loc,content,"utf8")}
 let p=path.join(root,"sitemap.xml"),xml=fs.readFileSync(p,"utf8");
 xml=xml.replace(/<!-- AUTO_EVENT_PAGES_START -->[\s\S]*?<!-- AUTO_EVENT_PAGES_END -->\s*/g,"").replace(/<url>\s*<loc>https?:\/\/[^<]*\/evenements\/[^<]*<\/loc>\s*<\/url>\s*/g,"");
 if(!xml.includes("</urlset>"))throw Error("Sitemap cassé");
 let urls=output.urls.map(u=>"  <url><loc>"+esc(u)+"</loc></url>").join("\n");
 xml=xml.replace("</urlset>","<!-- AUTO_EVENT_PAGES_START -->\n"+urls+"\n<!-- AUTO_EVENT_PAGES_END -->\n</urlset>");
 fs.writeFileSync(p,xml,"utf8");
 return output.metrics;
}
