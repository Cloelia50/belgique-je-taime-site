// Mobile browser audit against the ACTUAL published EcoTank HTML/CSS/JS.
// Synthetic personas only; never submit personal information or applications.
import { chromium } from 'playwright-core';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const url = process.env.ECOTANK_TEST_URL || 'https://cloelia50.github.io/belgique-je-taime-site/ecotank/';
const outputDir = path.resolve('artifacts/ecotank-mobile');
await mkdir(outputDir, { recursive: true });
const failures = [], warnings = [], results = [], pageErrors = [];
const screenshots = new Set(['initial', 'urgent_food', 'urgent_shelter', 'urgent_care', 'refusals', 'urgent_asylum', 'eid_works_no_phone', 'access-guide', 'small-screen']);
const timestamp = new Date().toISOString();
function record(condition, message, critical = true) {
  if (!condition) (critical ? failures : warnings).push(message);
  return !!condition;
}
const executables = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
].filter(Boolean);
let executablePath = null;
for (const p of executables) { try { await access(p); executablePath = p; break; } catch {} }
if (!executablePath) throw Error('Aucun navigateur Chromium/Chrome systeme disponible');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    locale: 'fr-BE', timezoneId: 'Europe/Brussels',
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(16000);
  page.on('pageerror', err => { if (pageErrors.length < 30) pageErrors.push(err.message.slice(0, 220)); });
  page.on('console', msg => { if (msg.type()==='error' && !/favicon|analytics/.test(msg.text())) {
    if (pageErrors.length<30) pageErrors.push('console: '+msg.text().slice(0,150));
  }});
  try {
    const response = await page.goto(url, { waitUntil:'domcontentloaded', timeout:75000 });
    record(response?.status() === 200, 'La page EcoTank ne repond pas 200: '+response?.status());
    await page.locator('#simpleAdminStart').waitFor({ state:'visible', timeout:20000 });
    record((await page.title()).toLowerCase().includes('ecotank'), 'Titre de page inattendu');
    const homeCtas = await page.locator('#simpleHome.active .simple-home-buttons button').allTextContents();
    record(homeCtas.some(x=>x.includes('Ma situation administrative est compliquée')), 'Entree pour situations difficiles introuvable');
    await page.screenshot({path:path.join(outputDir,'00-accueil-general.png'),fullPage:false,animations:'disabled'});
    await page.locator('#simpleAdminStart').click();
    await page.locator('#simpleDifficultHelp.active .urgent-needs-grid [data-help-topic="urgent_food"]').waitFor({ state:'visible', timeout:25000 });
    await page.screenshot({ path: path.join(outputDir,'00-accueil-besoins.png'), fullPage:false, animations:'disabled' });
    const initial = await page.locator('#simpleDifficultHelp.active').evaluate(el => {
      const grid=el.querySelector('.urgent-needs-grid');const r=grid.getBoundingClientRect();
      return {buttons:grid.querySelectorAll('[data-help-topic]').length, gridTop:Math.round(r.top),
        gridBottom:Math.round(r.bottom), width:document.documentElement.scrollWidth,
        viewportWidth:innerWidth, firstCardTop:Math.round(el.querySelector('.business-grid')?.getBoundingClientRect().top||0)}
    });
    record(initial.buttons===6,'Attendu: six besoins essentiels directement disponibles, recu '+initial.buttons);
    record(initial.gridBottom<=844,'Les six choix prioritaires ne tiennent pas sur le premier ecran de 390px (bas='+initial.gridBottom+')',false);
    record(initial.width <= initial.viewportWidth+5,'Debordement horizontal sur mobile 390px : '+initial.width+' vs '+initial.viewportWidth);
    if (initial.gridBottom > 844) warnings.push('Les six besoins ne tiennent pas tous sur un seul ecran mobile (bottom='+initial.gridBottom+'px).');
    results.push({ id:'initial', outcome:'page chargee', ...initial });

    const cases = [
      ['urgent_food','Manger sans revenu', /fdss\.be/, true],
      ['urgent_shelter','Sans abri ce soir et sans GSM', /samusocial\.be|0800\.samusocial/, true],
      ['urgent_care','Sans mutuelle et besoin de soins', /medecinsdumonde\.be/, true],
      ['urgent_income','Sans CPAS ni chomage, recherche travail', /actiris\.brussels/, true],
      ['urgent_refusal','Refus administratif et delai proche', /rechtbanken-tribunaux\.be|justice\.belgium\.be/, true],
      ['urgent_access','Itsme et eID impossibles', /csam\.be/, true],
      ['urgent_asylum','Demande de protection sans place d accueil', /fedasil\.be|fedasilinfo\.be/, false],
      ['urgent_irregular','Sans titre ni soins', /medecinsdumonde\.be|socialsecurity\.be/, false],
      ['refusals','CPAS et ONEM deja refuses', /actiris\.brussels/, false],
      ['food_social','Refus CPAS et besoin d epicerie', /fdss\.be/, false],
      ['care_zero','Couverture mutuelle perdue', /inami\.fgov\.be|caami-hziv\.fgov\.be/, false],
      ['eid_works_no_phone','Lecteur eID fonctionne mais numero perdu', /csam\.be|bruxelles\.be/, false]
    ];
    for (const [topic, name, expectedLink, urgent] of cases) {
      const selector='#simpleDifficultHelp.active [data-help-topic="'+topic+'"]';
      const target=page.locator(selector).first();
      try {
        const visible=await target.isVisible();
        if (!visible) {
          const expander=page.locator('#simpleDifficultHelp.active details.urgent-secondary summary').first();
          await expander.click();
        }
        await target.click();
        const root=page.locator('#simpleDifficultHelp.active');
        const firstGrid=root.locator('.business-grid').first();
        await firstGrid.locator('.business-card').first().waitFor({state:'visible'});
        const cards=firstGrid.locator('.business-card');
        const cardCount=await cards.count();
        const mainLinks=await firstGrid.locator('.business-card .resource-actions a').evaluateAll(els=>els.map(a=>({text:a.textContent.trim(),href:a.href})));
        const overflow=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,viewportWidth:innerWidth}));
        const text=await root.innerText();
        const cpasFirst=mainLinks.some(a=>/pcswonline|ocmw-cpas-online|first_cpas_request/.test(a.href));
        const details=root.locator('details.ecotank-more-actions');
        const detailsCount=await details.count();
        const detailsOpen=detailsCount ? await details.evaluate(el=>el.open) : false;
        const layout=await root.evaluate(el=>({actionsTop:el.querySelector('.business-grid')?.getBoundingClientRect().top,
          needChoicesTop:el.querySelector('.urgent-needs')?.getBoundingClientRect().top}));
        if (topic!=='overview') record(layout.actionsTop<layout.needChoicesTop,topic+': les options restent AU-DESSUS des solutions');
        const metrics={ id:topic,persona:name,cards:cardCount,links:mainLinks.length,actionsTop:layout.actionsTop,needChoicesTop:layout.needChoicesTop,
          firstLink:mainLinks[0]?.href||'',scrollWidth:overflow.scrollWidth,
          viewportWidth:overflow.viewportWidth,detailSections:detailsCount,
          detailsInitiallyOpen:detailsOpen,cpasFirst,mainTextLength:text.length,
          contentStartsWith:(await firstGrid.innerText()).slice(0,210)};
        results.push(metrics);
        record(cardCount>=1 && cardCount<=3,topic+': '+cardCount+' actions visibles (attendu 1-3)');
        record(mainLinks.some(a=>expectedLink.test(a.href)),topic+': lien officiel pertinent absent des premieres actions');
        record(mainLinks.every(a=>a.href.startsWith('https://')),topic+': lien non HTTPS');
        record(overflow.scrollWidth<=overflow.viewportWidth+5,topic+': debordement horizontal ('+overflow.scrollWidth+' / '+overflow.viewportWidth+')');
        record(!detailsOpen,topic+': les informations secondaires ne sont pas repliees');
        if (topic==='refusals') record(!cpasFirst, 'Double refus: premiere demande CPAS reproposee dans les premieres actions');
        if (topic==='urgent_shelter') record(/pas|sans|aucune/i.test(text)&&/place/i.test(text), 'Samusocial : limites des places non precisees');
        if (topic==='urgent_care') record(/rendez-vous/i.test(text), 'CASO : prise de rendez-vous absente');
        if (screenshots.has(topic)) await page.screenshot({
          path:path.join(outputDir,topic+'.png'), fullPage:false, animations:'disabled'
        });
        process.stdout.write('PARCOURS '+topic+' : '+JSON.stringify(metrics)+'\n');
      } catch(e) {
        failures.push(topic+': '+e.message.slice(0,330));
        try {await page.screenshot({path:path.join(outputDir,topic+'-ERREUR.png'),fullPage:false});}catch{}
      }
    }
    // Test du sous-parcours d'authentification issu d'une eID valide mais sans SMS.
    try {
      await page.locator('#simpleDifficultHelp.active [data-help-access]').click();
      await page.locator('#simpleDifficultHelp.active select[data-access-issue]').selectOption('eid_ok_no_sms');
      await page.locator('#simpleDifficultHelp.active select[data-access-service]').selectOption('myminfin');
      const text=await page.locator('#simpleDifficultHelp.active').innerText();
      record(/CSAM/.test(text) && /sans|aucun|SMS/i.test(text),'eID sans SMS: solution claire absente');
      record(/MyMinfin/.test(text),'Liaison MyMinfin non visible');
      await page.screenshot({path:path.join(outputDir,'access-guide.png'),fullPage:false,animations:'disabled'});
      results.push({id:'access-guide',issue:'eid_ok_no_sms',service:'myminfin',status:'rendu navigateur confirme'});
    }catch(e){failures.push('guide eID: '+e.message.slice(0,330));}
    // Test de lisibilite a 320px et 360px, sur le meme site actif.
    for(const width of [320,360]){
      await page.setViewportSize({width,height:740});
      const metrics=await page.evaluate(()=>({
        scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
        leftSelect:document.querySelector('.access-helper-fields select')?.getBoundingClientRect().left||0,
        rightSelect:document.querySelector('.access-helper-fields select')?.getBoundingClientRect().right||0
      }));
      record(metrics.scrollWidth<=metrics.clientWidth+5,'Guide eID: debordement sur '+width+'px ('+metrics.scrollWidth+'/'+metrics.clientWidth+')');
      results.push({id:'responsive-'+width,...metrics});
      if(width===320) await page.screenshot({path:path.join(outputDir,'small-screen.png'),fullPage:false,animations:'disabled'});
    }
  } catch(e) {
    failures.push('DEMARRAGE NAVIGATEUR: '+e.message.slice(0,550));
    try{await page.screenshot({path:path.join(outputDir,'ERREUR-DEMARRAGE.png'),fullPage:false});}catch{}
  }
} finally {
  await browser.close();
}
const report={auditedAt:timestamp,url,viewport:'390x844 mobile, puis 320x740 et 360x740',syntheticUserTestsOnly:true,
  count:results.length,failures,warnings,pageErrors:pageErrors.slice(0,20),results};
await writeFile(path.join(outputDir,'audit.json'),JSON.stringify(report,null,2),'utf8');
let md='# EcoTank – test navigateur mobile automatise\n\n';
md+='Effectue le '+timestamp+'. Navigateur Chromium/Chrome en emulation tactile mobile. Aucune personne reelle testee.\n\n';
md+='Parcours evalues : '+results.length+'. Anomalies bloquantes : '+failures.length+'. Observations : '+warnings.length+'.\n\n';
md+='## Anomalies\n'+(failures.length?failures.map(x=>'- '+x).join('\n'):'Aucune')+'\n\n## Observations\n'+(warnings.length?warnings.map(x=>'- '+x).join('\n'):'Aucune')+'\n\n';
md+='## Resultats parcours\n| Cas | Actions visibles | Liens directs | Debordement (px) | Premiere URL |\n|---|---:|---:|---:|---|\n';
for(const r of results.filter(x=>x.persona)) md+='| '+r.persona+' | '+r.cards+' | '+r.links+' | '+Math.max(0,r.scrollWidth-r.viewportWidth)+' | '+r.firstLink+' |\n';
md+='\n## Captures\n'+[...screenshots].map(x=>'- '+x+'.png').join('\n')+'\n';
await writeFile(path.join(outputDir,'rapport.md'),md,'utf8');
console.log('=== AUDIT MOBILE ECOTANK ===');
console.log('VISITE '+url);
console.log('ANOMALIES '+failures.length+' : '+JSON.stringify(failures));
console.log('REMARQUES '+warnings.length+' : '+JSON.stringify(warnings));
console.log('ERREURS JAVASCRIPT '+pageErrors.length+' : '+JSON.stringify(pageErrors.slice(0,8)));
console.log('TABLEAU '+JSON.stringify(results.map(r=>({id:r.id,cards:r.cards,links:r.links,overflow:r.scrollWidth&&r.viewportWidth?r.scrollWidth-r.viewportWidth:undefined}))));
if(failures.length) process.exitCode=1;
