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
assert.doesNotMatch(withoutSms,/Première demande CPAS sans connexion|cpas_online_unsecured/);
console.log("EcoTank : lecteur eID fonctionnel sans GSM, identification CSAM et clé e-mail sans itsme — OK.");
