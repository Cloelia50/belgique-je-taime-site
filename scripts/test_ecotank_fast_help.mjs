// Test local et déterministe du sas rapide EcoTank.
// Aucun robot, aucune requête réseau : les données sont lues dans le dépôt public.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../ecotank/entry-router.js", import.meta.url), "utf8");
const profile = JSON.parse(readFileSync(new URL("../ecotank/admin-profile.json", import.meta.url), "utf8"));
assert.ok(profile.entry_router?.questions?.length);

function session() {
  const elements = new Map(), listeners = {};
  const classList = () => ({ add() {}, remove() {}, toggle() {} });
  const element = (id = "") => ({ id, innerHTML: "", className: "", classList: classList() });
  const shell = {
    insertBefore(node) {
      elements.set(node.id, node);
      for (const match of node.innerHTML.matchAll(/\bid="([^"]+)"/g)) {
        elements.set(match[1], element(match[1]));
      }
    }
  };
  const document = {
    body: { classList: classList() },
    querySelector: query => query === "#simpleApp .simple-shell" ? shell : null,
    getElementById: id => elements.get(id) ?? null,
    createElement: () => element(),
    querySelectorAll: () => [...elements.values()].filter(item => item.className === "simple-screen"),
    addEventListener: (type, handler) => { listeners[type] = handler; }
  };
  elements.set("simpleHome", element("simpleHome"));
  const windowListeners = {};
  const window = { scrollTo() {}, addEventListener(type, handler) { windowListeners[type] = handler; } };
  const fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(profile) });
  runInNewContext(source, { document, window, fetch });
  return {
    window, elements,
    adminEntryClick() {
      const event = {
        target: { closest: selector => selector === "#simpleAdminStart" ? { id: "simpleAdminStart" } : null },
        prevented: false, stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; }
      };
      windowListeners.click(event);
      return event;
    },
    click(selector, dataset = {}) {
      listeners.click({ target: { closest: current => current === selector ? { dataset } : null } });
    },
    choose(question, option) {
      this.click("[data-entry-option]", { entryQuestion: question, entryOption: option });
    },
    change(selector, value) {
      listeners.change({ target: { value, closest: current => current === selector ? { value } : null } });
    },
    html(id) {
      return elements.get(id)?.innerHTML ?? "";
    }
  };
}
async function ready(session) {
  assert.equal(session.window.EcoTankEntryRouter.start(), true);
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function hasHelp(html) {
  return html.includes("Aucune autre réponse obligatoire");
}

const quick = session();
await ready(quick);
assert.match(quick.html("entryRouterHost"), /data-entry-fast-help/);
assert.ok(
  quick.html("entryRouterHost").indexOf('data-entry-fast-help') <
    quick.html("entryRouterHost").indexOf('data-entry-option'),
  "L'aide urgente doit être visible AVANT la liste de situations, même sur petit écran"
);
quick.click("[data-entry-fast-help]");
assert.ok(hasHelp(quick.html("entryDifficultHost")), "Premières pistes accessibles sans formulaire");
assert.match(quick.html("entryDifficultHost"), /Commencer par une aide humaine/);
assert.match(quick.html("entryDifficultHost"), /https:\/\//);
quick.click("[data-help-topic]", { helpTopic: "housing" });
assert.match(quick.html("entryDifficultHost"), /logement/i);
await ready(quick);
quick.click("[data-entry-fast-help]");
assert.match(quick.html("entryDifficultHost"), /Commencer par une aide humaine/, "Le sujet ne doit pas fuir vers le parcours suivant");

const journeys = [
  ["sans droits ni documents", [["q_entry_situation", "start_from_zero"]], true],
  ["situation inconnue", [["q_entry_situation", "other_unknown"]], true],
  ["séjour à clarifier", [["q_entry_situation", "new_arrival_or_residence"]], true],
  ["statut international", [["q_entry_situation", "international_special"]], true],
  ["salarié avec bases administratives perdues", [["q_entry_situation", "employee"], ["q_foundations_ok", "no_or_unknown"]], true],
  ["étudiant avec difficultés administratives", [["q_entry_situation", "student"], ["q_foundations_ok", "some_problems"]], true],
  ["salarié sans difficultés déclarées", [["q_entry_situation", "employee"], ["q_foundations_ok", "yes"]], false],
  ["allocation existante sans difficultés déclarées", [["q_entry_situation", "replacement_income"], ["q_replacement_income_type", "unemployment"]], false]
];
for (const [name, answers, expectHelp] of journeys) {
  const s = session();
  await ready(s);
  for (const [question, option] of answers) s.choose(question, option);
  const destination = s.html("entryDestinationHost");
  assert.ok(destination, name + " : aucune orientation");
  const available = destination.includes("data-entry-admin");
  assert.equal(available, expectHelp, name + " : parcours ordinaire modifié ou aide inaccessible");
  if (available) {
    s.click("[data-entry-admin]");
    assert.ok(hasHelp(s.html("entryDifficultHost")), name + " : pas de conseils");
  }
}

// Chaque identifiant de source des premières pistes existe dans le catalogue officiel.
const linkedKeys = [...source.matchAll(/\[\["([a-z][a-z0-9_]+)","[^"]+"\]/g)].map(match => match[1]);
const verifiedAdditionalUrls = Object.fromEntries(
  [...source.matchAll(/^\s*([a-z][a-z0-9_]*):\{url:"(https:\/\/[^"]+)"\},?$/gm)]
    .map(match => [match[1], match[2]])
);
for (const key of new Set(linkedKeys)) {
  const url = profile.official_sources?.[key]?.url || verifiedAdditionalUrls[key];
  assert.ok(url?.startsWith("https://"), "Source officielle ou associative vérifiée manquante : " + key);
}
console.log("EcoTank : accès immédiat, retour à zéro, 8 parcours et sources officielles — OK (aucun robot exécuté).");

// La vraie entrée « situation administrative compliquée » doit court-circuiter
// le vieil interrogatoire et conduire aux liens officiels dès le premier clic.
const entry = session();
const blocked = entry.adminEntryClick();
assert.equal(blocked.prevented, true, "Le clic doit interrompre l'ancien questionnaire");
assert.equal(blocked.stopped, true, "Le formulaire historique ne doit pas démarrer");
for (let i = 0; i < 8; i++) await Promise.resolve();
assert.ok(hasHelp(entry.html("entryDifficultHost")), "Le bouton de l'accueil doit montrer l'aide immédiate");
assert.match(entry.html("entryDifficultHost"), /https:\/\//);
assert.match(entry.html("entryDifficultHost"), /data-help-topic="income"/);

// Régression de mise en page : conserver le plan AVANT le contrôle des justificatifs.
assert.match(source, /screen\.insertBefore\(pathways,readiness\)/);
assert.match(source, /screen\.insertBefore\(sources,readiness\)/);
assert.match(source, /more\.appendChild\(section\)/);
assert.match(source, /data-admin-immediate-help/);
console.log("EcoTank : entrée situation compliquée vers aide immédiate et plan avant les documents — OK.");

// Cas d'impasse : deux refus, aucune ressource. Ne jamais renvoyer par défaut
// vers une nouvelle première demande CPAS.
const doubleRefusal=session();
await ready(doubleRefusal);
doubleRefusal.click("[data-entry-fast-help]");
assert.match(doubleRefusal.html("entryDifficultHost"), /data-help-topic="refusals"/);
doubleRefusal.click("[data-help-topic]",{helpTopic:"refusals"});
const refusedHtml=doubleRefusal.html("entryDifficultHost");
assert.match(refusedHtml, /CPAS et le chômage ont déjà refusé/);
assert.match(refusedHtml, /tribunal du travail/);
assert.match(refusedHtml, /3 mois/);
assert.match(refusedHtml, /décision écrite/);
assert.match(refusedHtml, /0800 35 243/);
assert.match(refusedHtml, /aide alimentaire/);
assert.match(refusedHtml, /mutualité/);
assert.match(refusedHtml, /allocation mensuelle garantie/);
assert.doesNotMatch(refusedHtml, /Première demande CPAS sans connexion|Première demande avec identification|cpas_online_unsecured/);
assert.match(refusedHtml, /https:\/\/www\.justice\.belgium\.be/);
assert.match(refusedHtml, /https:\/\/www\.fdss\.be/);
doubleRefusal.click("[data-help-topic]",{helpTopic:"income"});
assert.match(doubleRefusal.html("entryDifficultHost"), /Demander un examen/,"Le parcours revenus ordinaire doit rester utilisable");
console.log("EcoTank : double refus CPAS/chômage — recours, aide associative et autres droits sans nouveau formulaire CPAS : OK.");

// Régressions terrain : mêmes droits d'accès pour une personne sans revenus,
// téléphone, itsme, chômage ou revenu d'intégration. Aucune attestation Activa
// nouvelle n'est annoncée depuis la suppression du 15 juillet 2026.
const practical=session();
await ready(practical);
practical.click("[data-entry-fast-help]");
const practicalChoices=practical.html("entryDifficultHost");
for(const topic of ["employment_no_income","food_social","care_zero","no_phone"]){
  assert.match(practicalChoices, new RegExp('data-help-topic="'+topic+'"'));
}
practical.click("[data-help-topic]",{helpTopic:"refusals"});
const overview=practical.html("entryDifficultHost");
for (const phrase of ["FPIE","activa.brussels","15 juillet 2026","épicerie sociale","cotisation personnelle de 0 €","itsme","sans numéro actif","aidealimentaire@fdss.be"]){
  assert.ok(overview.includes(phrase),"Parcours double refus incomplet : "+phrase);
}
assert.doesNotMatch(overview,/Première demande CPAS sans connexion|Première demande avec identification/);
for(const [topic,needles] of [
  ["employment_no_income",["Actiris","FPIE","prime FPIE","15 juillet 2026","fpie@bruxellesformation.brussels"]],
  ["food_social",["associatif","orientation","aidealimentaire@fdss.be"]],
  ["care_zero",["INAMI","0 €","CAAMI","personne à charge"]],
  ["no_phone",["SMS","eID","sans numéro de téléphone","Espaces Publics Numériques","papier"]]
]){
  practical.click("[data-help-topic]",{helpTopic:topic});
  const h=practical.html("entryDifficultHost");
  for(const phrase of needles)assert.ok(h.includes(phrase),topic+" missing "+phrase);
  assert.match(h,/https:\/\//,topic+" missing URLs");
  assert.doesNotMatch(h,/cpas_online_unsecured|Première demande CPAS sans connexion/);
}
console.log("EcoTank : sans revenus/chômage/CPAS/téléphone, accès FPIE, épicerie, CAAMI et eID — OK.");


const cleanTitle=practical.html("entryDifficultHost");
practical.click("[data-help-topic]",{helpTopic:"refusals"});
const readableTitles=practical.html("entryDifficultHost");
assert.doesNotMatch(readableTitles, /<h3>\d+\. \d+\./, "Les titres ne doivent pas avoir une double numérotation");
assert.match(readableTitles, /3 mois/, "Délai de recours indiqué dans le parcours");
assert.match(readableTitles, /allocation mensuelle garantie/, "Aucune garantie d'allocation suggérée");
console.log("EcoTank : titres lisibles et absence de droits automatiques — OK.");

// Cas réel : lecteur eID + carte + PIN déjà opérationnels ; numéro de GSM perdu.
// Ne jamais renvoyer l'usager en boucle vers l'activation itsme ni le rachat d'un lecteur.
const eidReady=session();
await ready(eidReady);
eidReady.click("[data-entry-fast-help]");
assert.match(eidReady.html("entryDifficultHost"), /data-help-topic="eid_works_no_phone"/);
eidReady.click("[data-help-topic]",{helpTopic:"eid_works_no_phone"});
const withoutSms=eidReady.html("entryDifficultHost");
for(const must of ["lecteur de cartes eID","aucun","sans téléphone","Code de sécurité par e-mail","sans numéro","guichet"]){
  assert.ok(withoutSms.toLowerCase().includes(must.toLowerCase()),"Clé manquante pour eID fonctionnel : "+must);
}
assert.match(withoutSms,/csam\.be\/fr\/profil-egov\.html/);
assert.match(withoutSms,/activer_une_cle_numerique-e-mail_otp\.pdf/);
assert.match(withoutSms,/bruxelles\.be\/comment-vous-connecter/);
assert.match(overview,/sans numéro actif/,"Le double refus doit préciser que l'eID fonctionne sans GSM actif");
assert.doesNotMatch(withoutSms,/Première demande CPAS sans connexion|cpas_online_unsecured/);
console.log("EcoTank : lecteur eID fonctionnel sans GSM, identification CSAM et clé e-mail sans itsme — OK.");

// Parcours de dépannage sans matériel/numéro/code obligatoire :
// tous les obstacles courants sont couverts par une solution concrète.
const access=session();
await ready(access);
assert.match(access.html("entryRouterHost"), /data-entry-access-help/);
access.click("[data-entry-access-help]");
const initialAccess=access.html("entryDifficultHost");
assert.match(initialAccess,/data-access-issue/);
assert.match(initialAccess,/data-access-service/);
const issues=[
  "eid_ok_no_sms","number_lost","phone_no_sms","no_smartphone","reader_missing",
  "reader_broken","pin_missing","card_lost","no_belgian_eid","no_email",
  "no_computer","service_itsme_only","keys_lost","site_error","no_address","other"
];
const services=["general","actiris","caami","ebox","myminfin","handicap","cpas","onem","other"];
for(const id of issues){
  assert.match(initialAccess,new RegExp('<option value="'+id+'"'));
  access.change("[data-access-issue]",id);
  const html=access.html("entryDifficultHost");
  assert.match(html,/href="https:\/\//,id+" : au moins une source HTTPS");
  assert.match(html,/data-access-back/,id+" : sortie vers les aides");
  assert.doesNotMatch(html,/data-help-detailed/,id+" : pas de questionnaire obligatoire");
}
for(const id of services){
  access.change("[data-access-service]",id);
  assert.match(access.html("entryDifficultHost"),new RegExp('<option value="'+id+'" selected'),id+": sélection du service");
}
access.change("[data-access-issue]","eid_ok_no_sms");
access.change("[data-access-service]","myminfin");
const eidAndTax=access.html("entryDifficultHost");
assert.match(eidAndTax,/Aucun nouveau numéro de GSM/);
assert.match(eidAndTax,/finances\.belgium\.be\/fr\/node\/2890/);
assert.match(eidAndTax,/csam\.be\/fr\/profil-egov\.html/);
assert.doesNotMatch(eidAndTax,/activer obligatoirement itsme/i);
access.change("[data-access-issue]","no_email");
const noEmail=access.html("entryDifficultHost");
assert.match(noEmail,/Sans accès à une boîte e-mail personnelle/);
assert.match(noEmail,/adresse e-mail personnelle/);
access.change("[data-access-issue]","pin_missing");
assert.match(access.html("entryDifficultHost"),/belgium\.be\/fr\/services_en_ligne\/app_reimpression_pin_puk/);
access.change("[data-access-issue]","no_belgian_eid");
assert.match(access.html("entryDifficultHost"),/bureau d(?:'|&#39;)enregistrement/i);
access.change("[data-access-service]","cpas");
assert.match(access.html("entryDifficultHost"),/Si le CPAS a déjà refusé/);
access.click("[data-access-reset]");
assert.match(access.html("entryDifficultHost"),/<option value="" selected|<option value="">Je ne sais pas/);
access.click("[data-access-back]");
assert.match(access.html("entryDifficultHost"),/Situations compliquées/);
assert.match(access.html("entryDifficultHost"),/data-help-access/);
console.log("EcoTank : 16 blocages, 9 services, alternatives eID/CSAM/guichet/papier sans numéro — OK.");

access.change("[data-access-issue]","no_belgian_eid");
access.change("[data-access-service]","myminfin");
assert.match(access.html("entryDifficultHost"),/votre blocage peut rendre sa connexion en ligne inutilisable/);
assert.match(access.html("entryDifficultHost"),/guichet/);
console.log("EcoTank : service limité par équipement manquant, alternative proposée — OK.");


// Parcours de précarité : aide opérationnelle AVANT les longs questionnaires.
// Le test lit des rendus du routeur sans activer aucune collecte distante.
const precarious=session();
await ready(precarious);
precarious.click("[data-entry-fast-help]");
const firstHtml=precarious.html("entryDifficultHost");
const priorityStart=firstHtml.indexOf('class="urgent-needs-grid"');
const firstCards=firstHtml.indexOf('class="business-grid"');
assert.ok(priorityStart>=0 && priorityStart<firstCards, "Choix du besoin avant les cartes explicatives");
const primaryChoices=firstHtml.slice(priorityStart,firstHtml.indexOf('</div>',priorityStart));
assert.equal((primaryChoices.match(/data-help-topic=/g)||[]).length,6,"Six choix immédiats visibles");
assert.match(primaryChoices,/data-help-topic="urgent_food"/);
assert.match(primaryChoices,/data-help-topic="urgent_shelter"/);
assert.match(primaryChoices,/data-help-topic="urgent_care"/);
assert.match(firstHtml,/class="urgent-secondary"/,"Les situations détaillées restent accessibles");
assert.ok(firstHtml.includes("Commencer par une aide humaine"),"Aucun ancien contenu supprimé");
function visibleActions(html){
  const start=html.indexOf('<div class="business-grid">');
  if(start<0)throw new Error("Aucune carte affichée");
  const rest=html.slice(start);
  return rest.split('<details class="ecotank-more-actions">')[0].split('<div class="entry-route-actions">')[0];
}
const urgentScenarios=[
  ["urgent_food",["aidealimentaire@fdss.be","fdss.be","justificatifs"]],
  ["urgent_shelter",["Samusocial","0800 99 340","9 h et 15 h","sans GSM"]],
  ["urgent_care",["Athéna","Bischoffsheim 31","CASO","pas de consultation médicale sans rendez-vous"]],
  ["urgent_income",["Actiris","FPIE","première demande CPAS"]],
  ["urgent_refusal",["3 mois","aide juridique","décision écrite"]],
  ["urgent_access",["lecteur","CSAM","SMS"]],
  ["urgent_asylum",["Fedasil","rue Belliard 68","accueil matériel"]],
  ["urgent_irregular",["Athéna","aide médicale urgente","Samusocial"]],
  ["refusals",["FPIE","mutualité","tribunal du travail"]],
  ["housing",["Samusocial","code d'inscription"]],
  ["health",["Athéna","CAAMI"]],
  ["residence",["Fedasil","Office des étrangers"]]
];
for(const [topic,words] of urgentScenarios){
  precarious.click("[data-help-topic]",{helpTopic:topic});
  const content=precarious.html("entryDifficultHost"),front=visibleActions(content);
  const count=(front.match(/class="business-card /g)||[]).length;
  assert.equal(count,3,topic+": trois actions au maximum avant « autres détails »");
  for(const word of words) assert.ok(content.toLowerCase().includes(word.toLowerCase()),topic+": manque "+word);
  assert.match(front,/href="https:\/\//,topic+": aucun lien direct utilisable");
  assert.match(content,/data-help-detailed/,topic+": détails toujours facultatifs");
}
precarious.click("[data-help-topic]",{helpTopic:"refusals"});
const longRefusal=precarious.html("entryDifficultHost");
assert.match(longRefusal,/<details class="ecotank-more-actions">/,"Les quatre étapes suivantes sont repliées");
assert.doesNotMatch(visibleActions(longRefusal),/Première demande CPAS sans connexion/);
precarious.click("[data-help-reset]");
assert.match(precarious.html("entryDifficultHost"),/De quoi avez-vous besoin aujourd/);
const firstRequest=profile.online_assistance.fast_actions.find(a=>a.id==="first_cpas_request");
const autoItsme=profile.online_assistance.fast_actions.find(a=>a.id==="activate_itsme");
assert.ok(firstRequest&&autoItsme,"Les sources et aides historiques restent conservées");
for(const action of [firstRequest,autoItsme]){
  assert.deepEqual(action.when_profiles_any,[],"Aucun renvoi automatique pour "+action.id);
  assert.deepEqual(action.when_readiness,{},"Aucune condition implicite pour "+action.id);
}
assert.ok(firstRequest.needs_explicit_first_request,"Une vraie première demande exige confirmation");
assert.ok(autoItsme.needs_explicit_sms_access,"Ne pas activer itsme sans numéro");
console.log("EcoTank précarité : 12 parcours, six besoins immédiats, trois actions visibles, pas de boucle CPAS/itsme — OK.");
