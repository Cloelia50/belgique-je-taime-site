/* EcoTank — sas d'entrée par situation + parcours entreprise */
(() => {
  "use strict";

  const state = {
    catalog: null,
    promise: null,
    router: null,
    answers: {},
    destinationId: "",
    bypassStart: false,
    bypassAdminStart: false,
    fromAdminHome: false,
    accessIssue: "",
    accessService: "general",
    businessAnswers: {}
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));

  function ensureScreens(){
    const shell=document.querySelector("#simpleApp .simple-shell");
    if(!shell)return false;
    if(!document.getElementById("simpleEntryRouter")){
      const entry=document.createElement("section");
      entry.id="simpleEntryRouter";
      entry.className="simple-screen";
      entry.innerHTML='<div class="simple-card"><div id="entryRouterHost" class="entry-question"></div></div>';
      shell.insertBefore(entry,document.getElementById("simpleWizard")||null);
    }
    if(!document.getElementById("simpleEntryDestination")){
      const dest=document.createElement("section");
      dest.id="simpleEntryDestination";
      dest.className="simple-screen";
      dest.innerHTML='<div class="simple-card"><div id="entryDestinationHost" class="entry-destination"></div></div>';
      shell.insertBefore(dest,document.getElementById("simpleWizard")||null);
    }
    if(!document.getElementById("simpleDifficultHelp")){
      const help=document.createElement("section");
      help.id="simpleDifficultHelp";
      help.className="simple-screen";
      help.innerHTML='<div class="simple-card"><div id="entryDifficultHost" class="entry-destination"></div></div>';
      shell.insertBefore(help,document.getElementById("simpleWizard")||null);
    }
    if(!document.getElementById("simpleBusinessHome")){
      const business=document.createElement("section");
      business.id="simpleBusinessHome";
      business.className="simple-screen";
      business.innerHTML='<div class="simple-card"><div id="businessHomeHost" class="business-home"></div></div>';
      shell.insertBefore(business,document.getElementById("simpleWizard")||null);
    }
    return true;
  }

  function showScreen(id){
    document.body.classList.add("simple-mode");
    document.body.classList.remove("explore-mode","advanced-explore");
    document.querySelectorAll("#simpleApp .simple-screen").forEach(el=>el.classList.toggle("active",el.id===id));
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function hideCustomScreens(){
    ["simpleEntryRouter","simpleEntryDestination","simpleBusinessHome","simpleDifficultHelp"].forEach(id=>document.getElementById(id)?.classList.remove("active"));
  }

  function loadCatalog(){
    if(state.catalog&&state.router)return Promise.resolve(state.catalog);
    if(!state.promise){
      state.promise=fetch("./admin-profile.json",{cache:"no-store"})
        .then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
        .then(data=>{
          const router=data&&data.entry_router;
          if(!router||!Array.isArray(router.questions)||!Array.isArray(router.destinations))throw new Error("entry-router-missing");
          state.catalog=data;
          state.router=router;
          return data;
        })
        .catch(err=>{state.promise=null;throw err;});
    }
    return state.promise;
  }

  function question(id){
    return (state.router?.questions||[]).find(q=>q.id===id)||null;
  }

  function destination(id){
    return (state.router?.destinations||[]).find(d=>d.id===id)||null;
  }

  function optionFor(qid,oid){
    const q=question(qid);
    return (q?.options||[]).find(o=>o.id===oid)||null;
  }

  function currentDestinationFromFirst(){
    const first=optionFor("q_entry_situation",state.answers.q_entry_situation);
    return first?.destination_id||state.destinationId||"guided_orientation";
  }

  function optionClass(opt){
    if(opt.id==="company_director"||opt.id==="self_employed")return "entry-choice company";
    if(opt.id==="start_from_zero"||opt.id==="other_unknown")return "entry-choice foundation";
    return "entry-choice";
  }

  function renderQuestion(qid){
    const q=question(qid),host=document.getElementById("entryRouterHost");
    if(!q||!host)return renderLoadFailure();
    const max=state.router?.entry_policy?.max_questions_before_destination||3;
    const order=Math.min(Number(q.order||1),max);
    const optionMap=new Map((q.options||[]).map(o=>[o.id,o]));
    let controls="";
    if(qid==="q_lost_rights_goal"){
      const selected=state.lostRightsSelected||[];
      controls='<div class="entry-choice-grid">'+(q.options||[]).map(opt=>
        '<label class="entry-choice" style="display:flex;align-items:center;gap:12px;cursor:pointer"><input type="checkbox" data-lost-rights-check="'+esc(opt.id)+'" '+(selected.includes(opt.id)?'checked':'')+'><span>'+esc(opt.label)+'</span></label>'
      ).join("")+'</div><div class="entry-route-actions"><button type="button" class="primary" data-lost-rights-submit>Continuer</button></div>';
    }else 
    if(Array.isArray(q.groups)&&q.groups.length){
      controls=q.groups.map(group=>{
        const opts=(group.option_ids||[]).map(id=>optionMap.get(id)).filter(Boolean);
        if(!opts.length)return "";
        return '<div class="entry-group"><div class="entry-group-title">'+esc(group.label||"")+'</div><div class="entry-choice-grid">'+opts.map(opt=>'<button type="button" class="'+optionClass(opt)+'" data-entry-question="'+esc(q.id)+'" data-entry-option="'+esc(opt.id)+'">'+esc(opt.label)+'</button>').join("")+'</div></div>';
      }).join("");
    }else{
      controls='<div class="entry-choice-grid">'+(q.options||[]).map(opt=>'<button type="button" class="'+optionClass(opt)+'" data-entry-question="'+esc(q.id)+'" data-entry-option="'+esc(opt.id)+'">'+esc(opt.label)+'</button>').join("")+'</div>';
    }
    host.innerHTML=
      '<div class="entry-topline"><button type="button" class="linkish" data-entry-home>← Accueil</button><span class="entry-step">Étape '+order+' sur '+max+' max.</span></div>'+
      '<div class="simple-kicker">EcoTank · Faire des économies</div>'+
      '<h2>'+esc(q.text||"Votre situation")+'</h2>'+
      (q.helper?'<p>'+esc(q.helper)+'</p>':"")+
      (qid==="q_entry_situation"?'<div class="entry-choice-grid"><button type="button" class="entry-choice foundation" data-homeless-start>Je suis sans domicile ou sans ressources : trouver une aide humaine</button></div>':"")+
      (qid==="q_entry_situation"?'<button type="button" class="entry-choice foundation" data-kevin-start>Anderlecht · Hébergé chez des proches, dettes ou chômage en difficulté</button>':"")+
      (qid==="q_entry_situation"?'<button type="button" class="entry-choice foundation" data-fatou-start>Molenbeek · Parent seul avec enfants : électricité, pension et aides</button>':"")+
      (qid==="q_entry_situation"?'<button type="button" class="entry-choice foundation" data-jozef-start>Koekelberg · Pension, carrière à l’étranger ou chambre sans bail</button>':"")+
      (qid==="q_entry_situation"?'<button type="button" class="entry-choice foundation" data-samira-start>Schaerbeek · Je travaille mais j’ai des dettes, un huissier ou un loyer impayé</button>':"")+
      (qid==="q_entry_situation"?'<button type="button" class="entry-choice foundation" data-celine-start>Ganshoren · Famille nombreuse : quatre économies à vérifier</button>':"")+
      (qid==="q_entry_situation"?'<button type="button" class="entry-choice foundation" data-karim-start>Jette · Parent veuf avec enfant en situation de handicap : droits déjà obtenus</button>':"")+
      ((qid==="q_entry_situation"||qid==="q_employee_goal")?'<button type="button" class="entry-choice foundation" data-lotte-start>Grossesse · Mon contrat se termine avant la naissance</button>':"")+
      ((qid==="q_entry_situation"||qid==="q_employee_goal")?'<button type="button" class="entry-choice foundation" data-beatrice-start>Famille recomposée · garde alternée, impôts et pensions alimentaires</button>':"")+
      ((qid==="q_entry_situation"||qid==="q_independent_goal")?'<button type="button" class="entry-choice foundation" data-thomas-start>Indépendant · Animaux dans le bail, cotisations et déductions</button>':"")+
      ((qid==="q_entry_situation"||qid==="q_independent_goal")?'<button type="button" class="entry-choice foundation" data-jessica-start>Indépendant · Dépenses et énergie de mon commerce</button>':"")+
      controls+
      '<div class="entry-footer"><span></span><button type="button" class="linkish" data-entry-unknown>Je ne sais pas quoi choisir</button></div>';
    showScreen("simpleEntryRouter");
  }

  function chooseOption(qid,oid){
    const q=question(qid),opt=optionFor(qid,oid);
    if(!q||!opt)return;
    state.answers[qid]=oid;
    if(qid==="q_entry_situation")state.destinationId=opt.destination_id||"";
    // EcoTank s'adresse aux particuliers. On ne demande les blocages que dans les branches concernées.
    const unemployment={not_registered:"no_job"};
    const blocked={refused:"refusals",stopped:"urgent_income",administrative:"urgent_access",nothing:"urgent_income"};
    const disability={work:"handicap_employment"};
    const picked=qid==="q_unemployed_goal"?unemployment[oid]:
      qid==="q_lost_rights_goal"?blocked[oid]:
      qid==="q_disability_goal"?disability[oid]:null;
    if(picked){state.destinationId="foundation_recovery";return renderDifficultHelp(picked);}
    if(qid==="q_actiris_allowance"){
      state.destinationId="foundation_recovery";
      if(oid==="no")return renderDifficultHelp("actiris_no_income");
      if(oid==="yes")return renderDifficultHelp("employer_aid");
      return renderDifficultHelp("urgent_income");
    }
    if(qid==="q_worker_type"){state.answers.q_work_class=oid;}
    if(qid==="q_independent_goal"){state.answers.q_business_stage=oid==="hiring"?"hiring":oid;state.businessCardIndex=0;}
    if(qid==="q_independent_region"){state.businessCardIndex=0;}
    if(qid==="q_household_region"){state.destinationId="guided_orientation";return renderPersonalCheck();}
    // Les dépenses du ménage relèvent du moteur général d'économies, pas de la liste administrative.
    if(qid==="q_household_goal"){state.destinationId="guided_orientation";return handoffGeneral();}
    if(qid==="q_home_goal"&&!opt.next_question_id&&["household","family"].includes(oid)){state.destinationId="guided_orientation";return handoffGeneral();}
    if(qid==="q_home_goal"&&oid==="job"){state.destinationId="foundation_recovery";return renderDifficultHelp("no_job");}
    if((qid==="q_retired_goal"||qid==="q_student_goal"||qid==="q_employee_goal")&&!opt.next_question_id){state.destinationId=opt.destination_id||"guided_orientation";return handoffGeneral();}
    const next=opt.next_question_id||q.next_question_id;
    if(next){
      renderQuestion(next);
      return;
    }
    routeToDestination(opt.destination_id||q.destination_id||currentDestinationFromFirst());
  }

  // First evidence-backed eligibility rules (federal measures, 2026-10-11).
  // A response selects a POSSIBILITY, not an administrative award.
  const savingsRules=[
    {id:"energy_social",title:"Tarif social fédéral de l’énergie",answers:["ris","grapa","handicap_allowance"],url:"https://economie.fgov.be/fr/themes/energie/energie-sociale/tarif-social-pour-lenergie",action:"Vérifier si le tarif social est appliqué à votre domicile",note:"Le droit dépend de l’allocation exacte et du contrat résidentiel."},
    {id:"bim_auto",title:"Intervention majorée pour les soins (BIM)",answers:["ris","grapa","handicap_allowance"],url:"https://www.inami.fgov.be/fr/themes/soins-de-sante-cout-et-remboursement/facilites-financieres/intervention-majoree",action:"Vérifier l’intervention majorée auprès de votre mutualité",note:"L’octroi peut être automatique, mais dépend de l’allocation exacte et parfois de sa durée."}
  ];
  function renderPersonalCheck(){
    const host=document.getElementById("entryDestinationHost");if(!host)return;
    const region=state.answers.q_household_region||"unknown";
    const selected=state.answers.q_qualifying_allowance;
    if(!selected){
      host.innerHTML='<div class="simple-kicker">Économies du ménage</div><h2>Quel revenu ou allocation votre ménage reçoit-il ?</h2>'+
        '<p>Une réponse suffit pour vérifier les premiers tarifs sociaux. Nous ne demandons aucun montant.</p>'+
        '<div class="entry-choice-grid">'+[
          ["ris","Revenu d’intégration (RIS) du CPAS"],
          ["grapa","Garantie de revenus aux personnes âgées (GRAPA)"],
          ["handicap_allowance","Allocation de personne handicapée reconnue (SPF)"],
          ["other","Autre revenu ou allocation"],
          ["none","Aucune de ces allocations"],
          ["unknown","Je ne sais pas"]
        ].map(x=>'<button type="button" class="entry-choice" data-saving-allowance="'+x[0]+'">'+esc(x[1])+'</button>').join("")+
        '</div><div class="entry-footer"><button type="button" data-entry-restart>Recommencer</button></div>';
      showScreen("simpleEntryDestination");return;
    }
    const possible=savingsRules.filter(rule=>rule.answers.includes(selected));
    const index=Math.min(Math.max(Number(state.savingStep||0),0),Math.max(0,possible.length-1));
    const rule=possible[index];
    if(!rule){
      host.innerHTML='<div class="simple-kicker">Économies du ménage</div><h2>Pas encore de résultat fiable</h2>'+
        '<p>Avec cette réponse, nous ne pouvons pas affirmer que vous bénéficiez d’un tarif particulier. Une demande BIM fondée sur les revenus pourrait toutefois être possible après examen par la mutualité.</p>'+
        '<div class="guided-actions"><a href="https://www.inami.fgov.be/fr/themes/soins-de-sante-cout-et-remboursement/facilites-financieres/intervention-majoree" target="_blank" rel="noopener noreferrer">Voir les conditions officielles du BIM ↗</a>'+
        '<button type="button" data-saving-again>Corriger ma réponse</button><button type="button" data-personal-continue>Continuer vers les autres économies</button></div>';
    }else{
      host.innerHTML='<div class="simple-kicker">Économies du ménage</div><h2>Une économie potentielle à vérifier</h2>'+
        '<section class="guided-one-step"><h3>'+esc(rule.title)+'</h3><p>'+esc(rule.note)+'</p>'+
        '<p><strong>Ce droit n’est pas confirmé par EcoTank.</strong> Votre situation doit être vérifiée par le service compétent.</p>'+
        '<div class="guided-main-link"><a href="'+esc(rule.url)+'" target="_blank" rel="noopener noreferrer">'+esc(rule.action)+' ↗</a></div>'+
        '<div class="guided-actions">'+(index+1<possible.length?'<button type="button" data-saving-next>Voir une autre économie possible</button>':'')+
        '<button type="button" data-saving-again>Corriger ma réponse</button><button type="button" data-personal-continue>Continuer vers les autres économies</button></div></section>';
    }
    showScreen("simpleEntryDestination");
  }

  function routeToDestination(id){
    state.destinationId=id||currentDestinationFromFirst();
    if(state.destinationId==="company"||state.destinationId==="self_employed"){
      renderBusiness(state.destinationId);
      return;
    }
    renderDestination(state.destinationId);
  }

  function answerLabel(qid){
    const o=optionFor(qid,state.answers[qid]);
    return o?.label||"";
  }

  function prefillEmployment(){
    let employment="";
    const d=state.destinationId;
    if(d==="employee")employment="employee";
    else if(d==="self_employed")employment="self";
    else if(d==="student")employment="student";
    else if(d==="retired")employment="pensioner";
    else if(d==="social_protection"){
      const r=state.answers.q_replacement_income_type;
      if(r==="unemployment")employment="unemployed";
      else if(r==="incapacity_invalidity")employment="incapacity";
      else if(r==="pension_or_grapa")employment="pensioner";
      if(r==="cpas"){
        try{
          if(typeof facts!=="undefined"){facts.ris="yes";save();syncFactForm();paint();}
        }catch(e){}
      }
    }
    window.ECOTANK_ENTRY_EMPLOYMENT=employment;
  }

  function renderNoDocsSuggestions(){
    const host=document.getElementById("entryDestinationHost");if(!host)return;
    const cards=[
      ["Allocations familiales","Vérifiez auprès de votre caisse les montants versés et les suppléments qui pourraient manquer. Vous n’avez pas besoin d’un AER pour poser la question.","https://famiris.brussels/fr/"],
      ["Soins moins chers","Demandez à votre mutualité si vous bénéficiez de l’intervention majorée et quels justificatifs seraient nécessaires pour l’examiner.","https://www.inami.fgov.be/fr"],
      ["Énergie","Vérifiez si un tarif social ou une aide énergie s’applique à votre situation. Une facture récente peut être utile, mais n’est pas obligatoire pour commencer cette vérification.","https://www.socialenergie.be/"],
      ["Logement et dépenses importantes","Si le loyer, les dettes ou le logement posent problème, demandez un accompagnement ciblé au service social de votre commune plutôt qu’une liste de petites primes.","https://be.brussels/fr"]
    ];
    host.innerHTML='<div class="simple-kicker">Économies sans documents</div><h2>Quatre démarches à explorer sans AER</h2><p>Voici une première orientation, et non un calcul personnalisé ou la confirmation d’un droit. Ne recherchez des pièces fiscales que lorsque le service vous indique ce qu’elles changent.</p>'+
      cards.map(x=>'<section class="guided-one-step"><h3>'+esc(x[0])+'</h3><p>'+esc(x[1])+'</p><a target="_blank" rel="noopener noreferrer" href="'+esc(x[2])+'">Voir le service ↗</a></section>').join('')+
      '<div class="guided-actions"><button type="button" data-general-detailed>Affiner si cela en vaut la peine</button><button type="button" data-entry-restart>Changer de situation</button></div>';
    showScreen("simpleEntryDestination");
  }
  function handoffGeneral(){
    // Montrer la contrepartie AVANT de demander une information fiscale difficile à trouver.
    if(!ensureScreens())return;
    const host=document.getElementById("entryDestinationHost");
    host.innerHTML='<div class="simple-kicker">EcoTank · Vos économies</div>'+
      '<h2>Commencez sans sortir vos documents</h2>'+
      '<p>Vous pouvez explorer des aides et leurs conditions sans chercher votre avertissement-extrait de rôle (AER), donner votre revenu annuel ni indiquer des informations intimes.</p>'+
      '<section class="guided-one-step"><h3>Ce que vous pouvez obtenir maintenant</h3>'+
      '<p>Une première liste de démarches à vérifier : allocations familiales et suppléments, remboursements de soins, logement, énergie ou emploi selon votre situation. Aucun montant ni droit n’est garanti sans vérification.</p>'+
      '<p><strong>Pourquoi demander éventuellement des documents plus tard ?</strong> Seulement pour départager les aides soumises à plafonds ou chiffrer un gain qui ne peut pas être estimé autrement. Avant chaque demande, EcoTank doit expliquer ce qu’elle permettra de calculer.</p>'+
      '<div class="guided-actions"><button type="button" class="primary" data-general-skip-docs>Explorer les pistes sans AER</button>'+
      '<button type="button" data-general-detailed>Je souhaite affiner avec mes informations</button>'+
      '<button type="button" data-entry-restart>Choisir une autre situation</button></div></section>';
    showScreen("simpleEntryDestination");
  }
  function handoffGeneralProceed(){
    prefillEmployment();
    hideCustomScreens();
    state.bypassStart=true;
    const start=document.getElementById("simpleStart");
    if(start)start.click();
  }



  // L'ancien écran administratif met les listes de pièces AVANT les solutions.
  // On conserve ses contrôles et ses réponses, mais on affiche les démarches d'abord.
  function prioritizeAdminResults(){
    const screen=document.getElementById("simpleAdminResults");
    const pathways=document.getElementById("simpleAdminPathways");
    const sources=document.getElementById("simpleAdminSources");
    const readiness=document.getElementById("simpleOnlineReadiness");
    if(!screen||!pathways||!sources||!readiness||document.getElementById("simpleAdminActionFirst"))return;
    const action=document.createElement("section");
    action.id="simpleAdminActionFirst";
    action.className="ecotank-action-first";
    action.innerHTML='<h3>Voici votre plan : les démarches d’abord</h3>'+
      '<p>Vous pouvez consulter les pistes adaptées à vos réponses dès maintenant. Vérifier vos codes, vos documents ou votre compte est facultatif : cela ne doit pas vous empêcher de demander de l’aide.</p>'+
      '<div class="entry-route-actions"><a class="primary" href="#simpleAdminPathways">Voir mon plan de démarches ↓</a>'+
      '<button type="button" data-admin-immediate-help>Voir les premières aides sans autre question</button></div>';
    const warnings=document.getElementById("simpleAdminWarningHost");
    screen.insertBefore(action,warnings||readiness);
    screen.insertBefore(pathways,readiness);
    screen.insertBefore(sources,readiness);
    const more=document.createElement("details");
    more.id="simpleAdminOptionalChecks";
    more.className="ecotank-optional-checks";
    more.innerHTML='<summary>Vérifier mes accès et préparer mes documents (facultatif)</summary>'+
      '<p>Ces listes servent à débloquer des démarches si vous en avez besoin. Elles ne conditionnent pas l’affichage de votre plan.</p>';
    screen.insertBefore(more,readiness);
    [readiness,screen.querySelector(".admin-proof-pack"),screen.querySelector(".admin-submit-protocol")]
      .filter(Boolean).forEach(section=>more.appendChild(section));
  }

  // Le bouton « Ma situation administrative est compliquée » doit montrer
  // l'aide rapide, pas commencer par un nouvel interrogatoire.
  function startImmediateHelp(){
    if(!ensureScreens())return false;
    state.destinationId="foundation_recovery";
    state.difficultTopic="";
    const host=document.getElementById("entryDifficultHost");
    if(host)host.innerHTML='<div class="simple-kicker">Aide immédiate</div>'+
      '<h2>Recherche des premières démarches…</h2><p>Aucune réponse obligatoire.</p>';
    showScreen("simpleDifficultHelp");
    loadCatalog().then(()=>renderDifficultHelp()).catch(()=>{
      if(host)host.innerHTML='<h2>Impossible de charger les pistes pour le moment</h2>'+
        '<p>Vous pouvez réessayer ou ouvrir le parcours administratif classique.</p>'+
        '<div class="entry-route-actions"><button type="button" data-admin-retry>Réessayer</button>'+
        '<button type="button" data-help-detailed>Ouvrir le parcours détaillé</button></div>';
    });
    return true;
  }


  // Guide de dépannage de l'accès public : toutes les sorties sont locales et facultatives.
  // Les 16 cas sont des obstacles techniques, PAS une déduction d'éligibilité.
  const ACCESS_REFS={
    csam:["CSAM : mes clés numériques","https://www.csam.be/fr/profil-egov.html"],
    csam_help:["BOSA : aide à l'identification sans eID","https://sma-help.bosa.belgium.be/fr/identification-sans-eid"],
    csam_office:["BOSA : activation en bureau d'enregistrement","https://bosa.belgium.be/en/services/requesting-and-activating-digital-keys"],
    eid:["Tester le lecteur et le logiciel eID","https://eid.belgium.be/fr"],
    pin:["Demander de nouveaux codes PIN/PUK","https://www.belgium.be/fr/services_en_ligne/app_reimpression_pin_puk"],
    loss:["Carte perdue ou volée : démarches","https://www.belgium.be/fr/famille/identite/carte_d_identite/perte_ou_vol"],
    itsme:["Activation itsme et conditions","https://www.itsme-id.com/fr-BE/get-started/eid"],
    email:["Guide officiel : clé numérique par e-mail","https://bosa.belgium.be/sites/default/files/documents/activer_une_cle_numerique-e-mail_otp.pdf"],
    actiris:["Actiris : s'inscrire, se réinscrire, antennes","https://www.actiris.brussels/fr/citoyens/comment-minscrire-ou-me-reinscrire/"],
    caami:["CAAMI : formulaires imprimables et au guichet","https://www.caami-hziv.fgov.be/fr/membres/formulaires"],
    caami_post:["CAAMI : recevoir l'inscription par la poste","https://www.caami-hziv.fgov.be/fr/membres/devenir-membre/commande-de-formulaire-dinscription"],
    ebox:["My eBox : comment se connecter via CSAM","https://myebox.be/fr/faq/comment-acceder-a-my-ebox"],
    tax:["MyMinfin : connexion par eID/lecteur/PIN","https://finances.belgium.be/fr/node/2890"],
    handicap:["My Handicap : connexion eID et accompagnement","https://www.socialsecurity.be/citizen/fr/static/applics/myhandicap/index.htm"],
    cpas:["CPAS Online : première demande uniquement","https://www.socialsecurity.be/citizen/fr/static/applics/ocmw-cpas-online/index.htm"],
    onem:["ONEM : démarche via un organisme de paiement","https://www.onem.be/citoyens/chomage-complet/comment-devez-vous-demander-les-allocations-/comment-devez-vous-introduire-une-demande-apres-une-interruption-du-chomage"],
    epn:["Bruxelles : espaces publics numériques","https://www.bruxelles.be/ou-trouver-des-espaces-publics-numeriques-epn"]
  };
  const ACCESS_PROBLEMS=[
    ["eid_ok_no_sms","Mon eID et mon lecteur fonctionnent, mais itsme exige un SMS",[
      ["Continuer sans itsme","Vous avez déjà le lecteur et le PIN : choisissez « Identification avec un lecteur de cartes eID » sur le service public lorsqu'il le propose. Aucun nouveau numéro de GSM, nouveau lecteur ou code SMS n'est nécessaire.",["csam","eid"]],
      ["Créer une alternative par e-mail si vous avez un e-mail","Connectez-vous une seule fois avec votre eID dans Mes clés numériques CSAM, puis activez le code de sécurité par e-mail. Cette clé fonctionne uniquement sur les services qui l'acceptent ; elle n'active pas itsme.",["csam","email"]],
      ["Si le service n'offre vraiment qu'itsme","Ne répétez pas l'activation impossible. Demandez à CE service une procédure au guichet, par courrier, par e-mail ou une autre identification reconnue. Les accès proposés diffèrent selon les sites.",["csam_help"]]
    ]],
    ["number_lost","Ancien numéro perdu, résilié ou attribué à quelqu'un d'autre",[
      ["Ne pas dépendre de l'ancien numéro","N'essayez pas de recevoir un SMS sur un numéro qui ne vous appartient plus. Pour les services publics compatibles, utilisez eID ou une clé CSAM déjà active. Les démarches de récupération d'itsme sont distinctes.",["csam","itsme"]],
      ["Choisir un autre canal de contact","Demandez la modification de vos coordonnées directement au service concerné : guichet, courrier ou formulaire officiel. Ne communiquez pas vos codes à un tiers.",["actiris","caami"]]
    ]],
    ["phone_no_sms","GSM présent mais impossible de recevoir un SMS",[
      ["Essayer un moyen d'identification sans SMS","Si vous disposez d'une eID et d'un lecteur fonctionnels, choisissez l'eID sur CSAM. Si une clé e-mail est déjà active et acceptée par le service, vous pouvez aussi l'utiliser.",["csam","email"]],
      ["Vérifier la ligne sans bloquer les autres démarches","Pour l'activation d'itsme, il faut un numéro capable de recevoir le SMS. Examinez le problème de ligne avec l'opérateur, mais continuez les démarches administratives indépendantes.",["itsme"]]
    ]],
    ["no_smartphone","Pas de smartphone, smartphone hors service ou trop ancien",[
      ["Utiliser un ordinateur et l'eID","itsme n'est pas obligatoire pour tout service public. Le lecteur eID sur ordinateur reste une solution lorsque le site propose CSAM.",["eid","csam"]],
      ["Autres possibilités avec une adresse e-mail","Sur les services compatibles, une clé CSAM avec code par e-mail peut fonctionner sans smartphone une fois activée avec eID ou via un bureau d'enregistrement.",["csam","csam_office"]]
    ]],
    ["reader_missing","J'ai une carte eID et le PIN, mais pas de lecteur",[
      ["Trouver un accès à un lecteur compatible","Un ordinateur seul ne remplace pas le lecteur. Demandez à une antenne, une association ou un Espace Public Numérique si un ordinateur équipé d'un lecteur eID est accessible. Vérifiez avant de vous déplacer.",["epn","eid"]],
      ["Si impossible d'avoir un lecteur","Pour créer une autre clé numérique CSAM sans eID utilisable, un bureau d'enregistrement peut aider après vérification d'identité, mais une adresse e-mail personnelle est requise. Sinon, demandez une démarche physique ou papier.",["csam_office","csam_help"]]
    ]],
    ["reader_broken","Le lecteur ou le logiciel eID ne fonctionne pas",[
      ["Tester l'installation avant toute autre démarche","Sur un ordinateur Windows, macOS ou Linux compatible, vérifiez le logiciel eID et le test de connexion CSAM. Un problème de navigateur, certificat ou orientation de carte ne signifie pas qu'itsme est obligatoire.",["eid"]],
      ["Si l'erreur persiste","Ne fournissez jamais le PIN à un accompagnateur. Consultez l'aide du logiciel eID ou choisissez le guichet du service concerné ; certaines clés alternatives nécessitent une activation préalable.",["eid","csam_help"]]
    ]],
    ["pin_missing","PIN ou PUK oublié, eID bloquée",[
      ["Faire rétablir le PIN/PUK","Un PIN oublié ou bloqué ne se débloque pas sur EcoTank. Demandez la procédure officielle de réimpression des codes, puis faites les opérations nécessaires auprès de votre commune.",["pin"]],
      ["Pendant l'attente des codes","Si vous avez déjà une clé numérique alternative active et acceptée, utilisez-la ; sinon demandez une procédure papier ou en personne au service concerné.",["csam","csam_help"]]
    ]],
    ["card_lost","Carte eID perdue, volée, expirée ou inutilisable",[
      ["Perte ou vol : protéger vos documents","Faites bloquer la carte via DOC STOP ou selon la procédure communale et demandez son remplacement. Ne tentez pas de continuer avec les certificats d'une carte annulée.",["loss"]],
      ["Si la carte est expirée ou ne contient pas les bons certificats","Contactez la commune pour renouvellement ou vérification des certificats. Un bureau d'enregistrement CSAM peut proposer une clé alternative avec pièce d'identité et adresse e-mail personnelle.",["csam_office","eid"]]
    ]],
    ["no_belgian_eid","Pas de carte eID belge ni de titre électronique compatible",[
      ["Bureau d'enregistrement des clés numériques","BOSA prévoit un enregistrement en personne pour les personnes sans eID/itsme compatibles, notamment certains résidents étrangers. Il faut une pièce d'identité reconnue et une adresse e-mail personnelle.",["csam_office","csam_help"]],
      ["Vérifier les autres procédures propres au service","Selon le statut ou la nationalité, le service peut proposer un guichet ou une autre identification ; aucun accès n'est garanti automatiquement.",["csam_help"]]
    ]],
    ["no_email","Pas d'adresse e-mail personnelle accessible",[
      ["Ne pas recommander la clé CSAM par e-mail","Sans accès à une boîte e-mail personnelle, le code par e-mail ne peut pas être utilisé. Le bureau d'enregistrement CSAM exige également une adresse e-mail personnelle pour activer ces clés.",["csam_office"]],
      ["Utiliser eID ou une démarche hors ligne","Si votre eID et le lecteur fonctionnent, connectez-vous directement avec eux. Sinon demandez une démarche au guichet ou sur papier, et éventuellement un accompagnement pour créer une boîte e-mail personnelle.",["csam","actiris","caami"]]
    ]],
    ["no_computer","Pas d'ordinateur, d'accès Internet ou de connexion stable",[
      ["Trouver un accès physique ou matériel","Les Espaces Publics Numériques peuvent proposer l'ordinateur et un accompagnement ; vérifiez s'ils disposent d'un lecteur eID. Actiris propose des antennes et des Self-Zones accessibles aux conditions précisées sur son site.",["epn","actiris"]],
      ["Ne pas bloquer une démarche urgente","La CAAMI publie des documents à envoyer par la poste ou remettre au guichet. D'autres organismes acceptent parfois un dossier papier ou un rendez-vous : demandez-le au service concerné.",["caami"]]
    ]],
    ["service_itsme_only","Le service affiche seulement itsme ou refuse mon eID",[
      ["Vérifier les moyens réellement acceptés","CSAM propose plusieurs clés, mais le service choisit lesquelles il accepte. Une clé par e-mail n'est donc pas un passe-partout ; eID n'active pas itsme.",["csam","csam_help"]],
      ["Demander l'alternative au service concerné","Cherchez son assistance, un guichet, un formulaire papier ou une procédure encadrée. EcoTank ne promet pas le contournement d'une identification légalement requise.",["actiris","caami","onem"]]
    ]],
    ["keys_lost","Mot de passe CSAM ou accès aux anciennes clés numériques perdu",[
      ["Utiliser l'eID pour gérer vos clés si possible","Si votre eID et votre lecteur fonctionnent, identifiez-vous à Mes clés numériques CSAM pour consulter ou modifier les clés proposées. Sans cela, consultez les procédures d'aide ou d'enregistrement.",["csam","csam_help"]],
      ["E-mail perdu : récupérer d'abord un accès personnel","La clé par e-mail nécessite une boîte accessible. Un service d'aide numérique peut accompagner la récupération sans connaître ni demander votre mot de passe.",["epn","csam_office"]]
    ]],
    ["site_error","Erreur de connexion, site indisponible ou page qui tourne en boucle",[
      ["Distinguer problème technique et refus d'accès","Testez la carte et le lecteur sur le site officiel eID. Si ce test fonctionne, notez le message d'erreur exact, la date et le service concerné, puis contactez l'assistance du service sans transmettre vos codes.",["eid","csam_help"]],
      ["Quand le délai est important","Demandez au service comment déposer la démarche en personne, par courrier ou avec preuve de la tentative ; n'attendez pas une réparation technique si une échéance approche.",["actiris","caami"]]
    ]],
    ["no_address","Pas de domicile stable ou impossible de recevoir les courriers d'activation",[
      ["Signaler l'obstacle matériel","Une adresse postale ou de référence peut être nécessaire pour certains documents. Demandez à la commune ou à un service social quelles modalités sont possibles : ne supposez pas que tous les organismes acceptent une adresse e-mail à la place.",["csam_help"]],
      ["Si l'eID fonctionne, éviter les envois de codes inutiles","L'eID/lecteur/PIN peut suffire à accéder aux services compatibles sans nouvelle lettre ni SMS. Si le service impose une notification papier, demandez son alternative officielle.",["csam"]]
    ]],
    ["other","Autre blocage ou plusieurs problèmes en même temps",[
      ["Commencer par le moyen que vous possédez réellement","Si l'eID et le lecteur fonctionnent, utilisez d'abord l'identification eID. Sinon cherchez une clé CSAM déjà active, puis une aide humaine ou un guichet. N'achetez pas un équipement avant d'avoir vérifié les alternatives.",["csam","csam_help"]],
      ["Identifier le service avant de recommencer","Choisissez ci-dessous l'organisme concerné pour voir les modalités officielles connues. Les modes de connexion ne sont pas identiques partout.",["actiris","caami"]]
    ]]
  ];
  const ACCESS_SERVICES=[
    ["general","Je ne sais pas encore / plusieurs services","Le choix des clés numériques dépend de chaque site : vérifiez les méthodes proposées directement sur son écran d'identification.",["csam"]],
    ["actiris","Actiris / recherche d'emploi","Actiris propose My Actiris et des démarches dans ses antennes. Les Self-Zones permettent certaines opérations sans rendez-vous ; une inscription accompagnée se fait sur rendez-vous. Demandez les modalités en personne si vous n'avez pas de GSM.",["actiris"]],
    ["caami","CAAMI / mutuelle / remboursement santé","La CAAMI accepte l'eID ou itsme sur myCAAMI, mais propose aussi des formulaires web sans identification, des PDF à imprimer, un envoi postal ou le guichet. Les modalités des autres mutualités doivent être vérifiées auprès de chacune.",["caami","caami_post"]],
    ["ebox","My eBox / documents officiels","My eBox utilise l'identification CSAM. Si vous avez une eID et son lecteur, essayez directement cette clé. Les autres clés disponibles dépendent du niveau demandé par le service.",["ebox","csam"]],
    ["myminfin","MyMinfin / impôts / documents fiscaux","Le SPF Finances décrit explicitement la connexion avec eID, lecteur et PIN comme alternative à itsme pour MyMinfin.",["tax"]],
    ["handicap","My Handicap / demande d'aide au handicap","My Handicap permet au citoyen de se connecter avec eID et code PIN. Un accompagnement par des professionnels autorisés existe ; vérifiez les conditions, sans partager vos identifiants privés.",["handicap"]],
    ["cpas","CPAS / dossier social","CPAS Online sert à une première demande. Avec eID/lecteur, il existe une version authentifiée ; sans eID, une version non authentifiée. Si le CPAS a déjà refusé la demande, ne redéposez pas automatiquement une première demande : contactez le service pour suivi, décision écrite ou recours.",["cpas"]],
    ["onem","ONEM / CAPAC / allocations de chômage","Les demandes et leur suivi peuvent passer par la CAPAC ou un organisme de paiement syndical. L'ONEM prévoit des démarches en personne ; un refus déjà signifié ne se résout pas en recréant son compte itsme.",["onem"]],
    ["other","Autre organisme ou service exclusivement en ligne","Il faut examiner la page d'identification et les instructions de CET organisme ; les clés CSAM ne fonctionnent pas universellement. Demandez une alternative officielle pour les personnes privées de téléphone, de carte ou d'e-mail.",["csam_help","csam_office"]]
  ];
  function renderAccessHelp(){
    if(!ensureScreens())return;
    const host=document.getElementById("entryDifficultHost");
    if(!host)return;
    const issue=ACCESS_PROBLEMS.find(x=>x[0]===state.accessIssue);
    const service=ACCESS_SERVICES.find(x=>x[0]===state.accessService)||ACCESS_SERVICES[0];
    const link=k=>{
      const entry=ACCESS_REFS[k];
      return entry?'<a href="'+esc(entry[1])+'" target="_blank" rel="noopener noreferrer">'+esc(entry[0])+' ↗</a>':"";
    };
    const needsOffline=issue&&["reader_missing","reader_broken","pin_missing","card_lost","no_belgian_eid","no_computer","site_error"].includes(issue[0]);
    const serviceCaveat=needsOffline&&service[0]!=="general"?
      '<p class="business-safety"><strong>Attention :</strong> la fiche de ce service présente ses moyens disponibles, mais votre blocage peut rendre sa connexion en ligne inutilisable aujourd’hui. Ne recommencez pas la même tentative : cherchez une démarche au guichet, par courrier, un accompagnement ou l’assistance officielle du service.</p>':"";
    const cards=issue?issue[2]:[
      ["D'abord : ne pas imposer itsme","Une eID fonctionnelle donne accès aux services qui proposent l'identification eID. Aucun numéro GSM n'est requis pour cette connexion. La clé CSAM par e-mail n'est utilisable que si vous avez une adresse e-mail accessible et si le service accepte cette clé.",["csam","eid"]],
      ["Si l'eID est impossible, cherchez la solution humaine","Un bureau d'enregistrement BOSA peut aider à activer des clés alternatives avec vérification d'identité et adresse e-mail personnelle. Des administrations proposent aussi des guichets ou formulaires papier.",["csam_office","actiris","caami"]]
    ];
    host.innerHTML=
      '<div class="entry-topline"><button type="button" class="linkish" data-access-back>← Retour aux aides</button><span class="entry-step">Sans compte, sans données envoyées</span></div>'+
      '<div class="simple-kicker">Accès aux démarches · solutions de rechange</div>'+
      '<h2>Faire mes démarches sans itsme</h2>'+
      '<p>Choisissez votre blocage. Nous proposons des solutions sans demander vos codes, votre numéro national ni votre mot de passe.</p>'+
      '<div class="access-helper-fields">'+
      '<label>Quel est votre blocage ?<select data-access-issue><option value="">Je ne sais pas / plusieurs problèmes</option>'+
        ACCESS_PROBLEMS.map(x=>'<option value="'+esc(x[0])+'" '+(issue&&issue[0]===x[0]?'selected':'')+'>'+esc(x[1])+'</option>').join("")+
      '</select></label>'+
      '<label>Quel service devez-vous utiliser ? (facultatif)<select data-access-service>'+
        ACCESS_SERVICES.map(x=>'<option value="'+esc(x[0])+'" '+(service[0]===x[0]?'selected':'')+'>'+esc(x[1])+'</option>').join("")+
      '</select></label></div>'+
      '<div class="business-safety"><strong>À retenir :</strong> perdre un numéro GSM n’annule pas votre carte eID. Une clé CSAM par e-mail ne remplace pas une clé plus forte si le service ne l’accepte pas. Si un délai de recours approche, contactez directement le service.</div>'+
      '<h3 class="access-helper-subtitle">'+esc(issue?issue[1]:"Premières solutions possibles")+'</h3>'+
      '<div class="access-helper-cards">'+cards.map((card,i)=>
        '<article class="business-card '+(i===0?'priority':'')+'"><h4>'+esc(card[0])+'</h4><p>'+esc(card[1])+'</p>'+
        '<div class="resource-actions">'+card[2].map(link).join("")+'</div></article>'
      ).join("")+'</div>'+
      '<section class="access-service-card"><h3>'+esc(service[1])+'</h3>'+serviceCaveat+'<p>'+esc(service[2])+'</p>'+
      '<div class="resource-actions">'+service[3].map(link).join("")+'</div></section>'+
      '<div class="entry-route-actions"><button type="button" class="linkish" data-access-reset>Recommencer le choix</button>'+
      '<button type="button" data-access-back>Retour aux aides et droits</button></div>';
    showScreen("simpleDifficultHelp");
  }

  // Parcours Daniel : aucune saisie personnelle, sortie rapide du questionnaire.

  // Parcours autonome : n'altère aucun état des autres parcours.
  // Orientation professionnelle indépendante : n'utilise ni AER ni données du ménage.
  function jessicaEntry(){
    if(!ensureScreens())return;
    const h=document.getElementById("entryDifficultHost");
    h.innerHTML='<h2>Indépendante : votre besoin principal ?</h2><p>Vos dépenses du salon ne sont pas des dépenses du ménage. Aucune déclaration fiscale à fournir pour commencer.</p><div class="entry-choice-grid">'+
      '<button type="button" data-jessica-topic="energy">La facture d’énergie de mon salon augmente</button>'+
      '<button type="button" data-jessica-topic="deductions">Quels frais du salon puis-je déduire ?</button>'+
      '<button type="button" data-jessica-topic="cotisations">J’ai du mal à payer mes cotisations</button>'+
      '<button type="button" data-jessica-topic="social">Maladie, arrêt d’activité ou maternité</button></div><button type="button" data-jessica-back>Retour</button>';
    showScreen("simpleDifficultHelp");
  }
  function jessicaGuide(short=false){
    if(!ensureScreens())return;
    const h=document.getElementById("entryDifficultHost");
    const tasks=[
      ["energy","Facture du salon et aides à l’investissement","Commencez par distinguer la facture du local commercial de celle du domicile. Le service gratuit 1819 de hub.brussels (tél. 1819, jours ouvrables 9 h–13 h ; mardi aussi 16 h–18 h) peut orienter vers les aides d’entreprise adaptées. Une prime bruxelloise de transition économique peut couvrir certains investissements énergétiques, sous conditions : demande préalable, investissement éligible d’au moins 2 000 euros et siège d’exploitation bruxellois. Ne commandez pas de travaux en présumant que la prime sera octroyée.","https://economie-emploi.brussels/prime-transition-investissements"],
      ["deductions","Frais professionnels : liste concrète à vérifier","Dans une activité de coiffure réellement exercée à titre professionnel, certains coûts peuvent être déductibles sous conditions : loyer du salon, consommations d’eau et d’électricité, produits capillaires, petit matériel, amortissement du mobilier et des équipements, assurance professionnelle, publicité, logiciel de caisse, comptabilité et cotisations sociales. Il faut des preuves, une ventilation des usages mixtes et tenir compte des règles de TVA et d’amortissement. Une dépense déductible ne signifie pas un remboursement intégral : elle réduit la base imposable. La TVA récupérable est une question distincte et dépend du régime TVA.","https://finances.belgium.be/fr/entreprises"],
      ["cotisations","Cotisations sociales : demander un plan plutôt que laisser impayé","Contactez votre caisse d’assurances sociales avant l’accumulation des échéances : demandez l’adaptation des cotisations provisoires si les revenus ont baissé, ou un plan d’apurement / des facilités de paiement. En cas de difficultés graves, faites vérifier la dispense éventuelle. Les cotisations définitives peuvent ensuite être régularisées.","https://socialsecurity.belgium.be/fr/octroi-des-droits-sociaux/vos-droits-en-tant-quindependant"],
      ["social","Arrêt, incapacité et maternité : vos droits personnels","Demandez à votre caisse d’assurances sociales les conditions du droit passerelle en cas de cessation ou d’interruption répondant aux critères ; une simple hausse de la facture n’ouvre pas automatiquement le droit. Vérifiez avec votre mutualité les indemnités d’incapacité et de maternité pour indépendante, les délais et les conditions de cotisations. Vous pouvez préparer ces droits avant d’en avoir besoin.","https://socialsecurity.belgium.be/fr/octroi-des-droits-sociaux/vos-droits-en-tant-quindependant"]
    ];
    const priority=state.jessicaTopic||"energy";
    const ordered=tasks.filter(x=>x[0]===priority).concat(tasks.filter(x=>x[0]!==priority));
    h.innerHTML='<div id="jessica-sheet" style="max-width:750px;margin:auto;padding:12px;color:#111;background:#fff"><h2>Mon activité indépendante · Bruxelles-Ville</h2><p><strong>EcoTank vise les particuliers :</strong> pour votre salon, cette fiche donne une orientation fiable et des contacts professionnels, pas un simulateur complet de TVA ou de subsides d’entreprise. Elle ne mélange pas facture du salon et aides énergétiques du ménage.</p>'+
      ordered.map((x,i)=>'<section style="border-top:1px solid #aaa;padding:9px 0;break-inside:avoid"><h3>'+(i+1)+'. '+esc(x[1])+'</h3><p>'+esc(x[2])+'</p>'+(short?'':'<p style="overflow-wrap:anywhere;font-size:.85em">'+esc(x[3])+'</p>')+'</section>').join('')+
      '<p><strong>Avant de rechercher des pièces :</strong> dites simplement au 1819 que vous exploitez un salon de coiffure à Bruxelles et que vous voulez vérifier les aides à l’économie d’énergie. Demandez quels achats ou travaux sont éligibles avant de dépenser. Pour les frais déductibles, rassemblez uniquement les factures utiles lorsque vous choisissez de faire un calcul avec un comptable.</p></div>'+
      '<div class="entry-route-actions"><button type="button" data-jessica-short>Fiche courte</button><button type="button" data-jessica-full>Fiche détaillée</button><button type="button" data-jessica-print>Imprimer / PDF</button><button type="button" data-jessica-edit>Autre priorité</button><button type="button" data-jessica-back>Retour</button></div>';
    if(!document.getElementById("jessica-print-style")){const st=document.createElement("style");st.id="jessica-print-style";st.textContent='@media print{body *{visibility:hidden!important}#jessica-sheet,#jessica-sheet *{visibility:visible!important}#jessica-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;color:#000!important;background:#fff!important}@page{size:A4;margin:12mm}}';document.head.appendChild(st);}
    showScreen("simpleDifficultHelp");
  }

  function thomasEntry(){
    if(!ensureScreens())return;
    const h=document.getElementById("entryDifficultHost");
    h.innerHTML='<h2>Indépendant et locataire avec animaux</h2><p>Quelle question voulez-vous résoudre d’abord ? Aucun revenu annuel, AER ou montant fiscal demandé.</p><div class="entry-choice-grid">'+
      '<button type="button" data-thomas-topic="pets">Mon propriétaire peut-il interdire mon chien ou mon chat ?</button>'+
      '<button type="button" data-thomas-topic="tax">Quels frais puis-je déduire comme indépendant ?</button>'+
      '<button type="button" data-thomas-topic="social">Mes revenus changent : comment adapter mes cotisations ?</button>'+
      '<button type="button" data-thomas-topic="pension">Comment préparer ma pension complémentaire ?</button></div><button type="button" data-thomas-back>Retour</button>';
    showScreen("simpleDifficultHelp");
  }
  function thomasGuide(short=false){
    if(!ensureScreens())return;
    const h=document.getElementById("entryDifficultHost");
    const tasks=[
      ["pets","Bail et animaux","À Bruxelles, une clause interdisant purement et simplement les animaux de compagnie est réputée non écrite depuis novembre 2024. Des limites motivées concernant nuisances, espèces ou nombre restent possibles. Gardez le bail et les échanges ; si le bailleur conteste, demandez un conseil juridique locatif avant de répondre. Le locataire reste responsable des dégâts et troubles.","https://be.brussels/fr/logement/modification-de-la-legislation-sur-les-baux-en-novembre-2024"],
      ["animalcost","Chien, règles locales et assurance","Demandez à la commune d’Ixelles de confirmer l’existence ou non d’une taxe sur les chiens pour l’année en cours : EcoTank ne suppose pas qu’elle existe. Vérifiez la couverture dégâts causés par vos animaux dans votre assurance responsabilité civile familiale et les exclusions. Les dépenses privées des animaux ne sont pas automatiquement des frais professionnels.","https://www.ixelles.be/"],
      ["social","Cotisations provisoires et revenus variables","Les cotisations définitives sont basées sur le revenu professionnel de l’année concernée, mais les acomptes reposent souvent sur une année antérieure. Contactez votre caisse d’assurances sociales avec une estimation raisonnable des revenus de cette année et des éléments concrets pour demander une réduction, si admissible. Une réduction trop forte peut provoquer régularisation et majorations.","https://www.rsvz-inasti.fgov.be/fr/faq/combien-de-cotisations-sociales-dois-je-payer"],
      ["pension","Pension libre complémentaire pour indépendants","Demandez à votre caisse ou assureur une simulation de pension libre complémentaire pour indépendants (PLCI), avec coûts, limites de versement, traitement fiscal et couverture éventuelle. Elle est facultative et son intérêt dépend de vos revenus et de votre trésorerie. Ne souscrivez pas simplement pour obtenir une réduction d’impôt supposée.","https://www.inasti.be/fr"],
      ["tax","Frais professionnels du graphiste","Distinguez les dépenses justifiées réellement professionnelles : matériel, logiciels, abonnement internet et part raisonnable du bureau à domicile, avec ventilation documentable des usages mixtes. Ne déduisez pas automatiquement votre loyer intégral ni les frais du chien ou du chat. Vérifiez avec un comptable le bail et les conséquences fiscales possibles pour le bailleur avant d’imputer une partie du loyer.","https://finances.belgium.be/fr/entreprises/impot_des_societes/declaration/preparation-de-la-declaration/frais-professionnels"]
    ];
    const topic=state.thomasTopic||"pets";const rank=[topic,...tasks.map(x=>x[0]).filter(x=>x!==topic)];
    const ordered=rank.map(k=>tasks.find(x=>x[0]===k)).filter(Boolean);
    h.innerHTML='<div id="thomas-sheet" style="max-width:740px;margin:auto;padding:12px;background:#fff;color:#111"><h2>Indépendant, chien et chat · Ixelles</h2><p><strong>Votre question en premier.</strong> L’an dernier ne reflète pas forcément vos revenus actuels. Pas d’AER pour lire ces réponses.</p>'+
      ordered.map((x,i)=>'<section style="border-top:1px solid #aaa;padding:9px 0;break-inside:avoid"><h3>'+(i+1)+'. '+esc(x[1])+'</h3><p>'+esc(x[2])+'</p>'+(short?'':'<p style="overflow-wrap:anywhere;font-size:.84em">'+esc(x[3])+'</p>')+'</section>').join('')+
      '<p><strong>À conserver si vous voulez affiner :</strong> bail, contrat d’assurance, dernier relevé de cotisations et dépenses professionnelles approximatives. Aucun document requis pour ce premier plan.</p></div><div class="entry-route-actions"><button type="button" data-thomas-short>Fiche courte</button><button type="button" data-thomas-full>Fiche détaillée</button><button type="button" data-thomas-print>Imprimer / PDF</button><button type="button" data-thomas-edit>Changer de question</button><button type="button" data-thomas-back>Retour</button></div>';
    if(!document.getElementById("thomas-print-style")){const st=document.createElement("style");st.id="thomas-print-style";st.textContent='@media print{body *{visibility:hidden!important}#thomas-sheet,#thomas-sheet *{visibility:visible!important}#thomas-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;color:#000!important;background:#fff!important}@page{size:A4;margin:12mm}}';document.head.appendChild(st);}
    showScreen("simpleDifficultHelp");
  }
  function beatriceEntry(){
    if(!ensureScreens())return;
    const h=document.getElementById("entryDifficultHost");
    h.innerHTML='<h2>Famille recomposée : quelle question vous préoccupe ?</h2><p>Aucune date de naissance, aucun avertissement-extrait de rôle ni revenu annuel pour commencer.</p><div class="entry-choice-grid">'+
      '<button type="button" data-beatrice-topic="tax">Qui peut déclarer les enfants et quelles déductions ?</button>'+
      '<button type="button" data-beatrice-topic="maintenance">Pension alimentaire et frais de garde</button>'+
      '<button type="button" data-beatrice-topic="benefits">Qui reçoit les allocations familiales ?</button>'+
      '<button type="button" data-beatrice-topic="home">Crédit et logement en indivision</button></div><button type="button" data-beatrice-back>Retour</button>';
    showScreen("simpleDifficultHelp");
  }
  function beatriceGuide(short=false){
    if(!ensureScreens())return;
    const h=document.getElementById("entryDifficultHost");
    const steps=[
      ["tax","Enfants fiscalement à charge et hébergement égalitaire","Ne comptez pas automatiquement cinq enfants à charge parce qu’ils vivent chez vous certaines semaines. Pour chaque enfant, distinguez parent fiscal, domicile, hébergement réellement égalitaire et existence d’un jugement ou d’une convention enregistrée / homologuée. Le partage de l’avantage fiscal requiert des conditions légales. À vérifier en priorité dans la déclaration préremplie et auprès du SPF Finances.","https://finances.belgium.be/fr/particuliers/famille/personnes_a_charge"],
      ["maintenance","Pensions alimentaires : attention au non-cumul","Une pension alimentaire versée peut être partiellement déductible sous conditions. Pour les versements de 2026, la part déductible est de 60 %. Pour un même enfant et une même période, la coparentalité fiscale avec partage de l’avantage pour enfant à charge ne se cumule pas avec cette déduction. Avant de modifier la déclaration, vérifiez les décisions et paiements effectifs.","https://finances.belgium.be/fr/particuliers/famille/rente_alimentaire/payee"],
      ["care","Frais de garde : calcul à partir des attestations","La réduction d’impôt normale est de 45 % des dépenses admissibles, plafonnées à 17,30 € par jour et par enfant pour les dépenses 2026. Gardez les attestations de la crèche, garderie ou stages. En coparentalité fiscale, chaque parent peut sous conditions déclarer les frais qu’il a payés : ne recopiez pas les frais de l’ex-partenaire.","https://finances.belgium.be/fr/particuliers/avantages_fiscaux/garde_enfants/parents-isol%C3%A9s"],
      ["benefits","Allocations familiales : vérifier l’allocataire","La garde alternée ne partage pas automatiquement les allocations. Demandez à la caisse de chaque enfant qui reçoit les versements, si une décision de justice change l’allocataire et si les suppléments sont correctement calculés. Ne supposez pas que tous les enfants recomposés relèvent d’un dossier unique.","https://famiris.brussels/fr/faq/allocations-familiales/que-se-passe-t-il-en-cas-de-separation-des-parents/"],
      ["leisure","Titres-services, sport et culture","Vérifiez les dispositifs réellement ouverts dans votre commune et les conditions des titres-services bruxellois. Les chèques sport ou culture ne sont pas des droits universels ; n’avancez aucun gain sans dispositif et période confirmés.","https://www.titresservices.brussels/"],
      ["home","Crédit en indivision : sécuriser la propriété","Si le logement est détenu en indivision, faites examiner par le notaire l’acte de propriété, les parts, le crédit, l’assurance solde restant dû et les possibilités de sortie. Une clause ne s’invente pas après coup et une séparation ne libère pas automatiquement un coemprunteur.","https://www.notaire.be/"]
    ];
    const chosen=state.beatriceTopic||"tax";
    const ordered=steps.filter(x=>x[0]===chosen).concat(steps.filter(x=>x[0]!==chosen));
    h.innerHTML='<div id="beatrice-sheet" style="max-width:740px;margin:auto;padding:12px;background:#fff;color:#111"><h2>Famille recomposée · Woluwe-Saint-Lambert</h2><p><strong>Première réponse, sans profil fiscal.</strong> On vérifie d’abord la situation de chaque enfant et les éventuels non-cumuls. Aucun AER requis pour comprendre les règles.</p>'+
      ordered.map((x,i)=>'<section style="border-top:1px solid #aaa;padding:9px 0;break-inside:avoid"><h3>'+(i+1)+'. '+esc(x[1])+'</h3><p>'+esc(x[2])+'</p>'+(short?'':'<p style="overflow-wrap:anywhere;font-size:.85em">'+esc(x[3])+'</p>')+'</section>').join('')+
      '<p><strong>À préparer uniquement pour un calcul précis :</strong> le nombre d’enfants concernés, le document fixant l’hébergement s’il existe, les attestations de garde réellement payées et les pensions versées. Rien de tout cela n’est nécessaire pour consulter le plan.</p></div>'+
      '<div class="entry-route-actions"><button type="button" data-beatrice-short>Fiche courte</button><button type="button" data-beatrice-full>Fiche détaillée</button><button type="button" data-beatrice-print>Imprimer / PDF</button><button type="button" data-beatrice-edit>Changer de priorité</button><button type="button" data-beatrice-back>Retour</button></div>';
    if(!document.getElementById("beatrice-print-style")){const st=document.createElement("style");st.id="beatrice-print-style";st.textContent='@media print{body *{visibility:hidden!important}#beatrice-sheet,#beatrice-sheet *{visibility:visible!important}#beatrice-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;color:#000!important;background:#fff!important}@page{size:A4;margin:12mm}}';document.head.appendChild(st);}
    showScreen("simpleDifficultHelp");
  }
  function lotteEntry(){
    if(!ensureScreens())return;
    const h=document.getElementById("entryDifficultHost");
    h.innerHTML='<h2>Votre contrat de travail pendant la grossesse</h2><p>Une seule question. Aucun revenu, AER ni date précise à fournir.</p><div class="entry-choice-grid">'+
      '<button type="button" data-lotte-case="before">Mon CDD se termine avant la naissance</button>'+
      '<button type="button" data-lotte-case="during">Mon contrat continue au début du congé</button>'+
      '<button type="button" data-lotte-case="unknown">Je ne sais pas encore</button></div>'+
      '<button type="button" data-lotte-back>Retour aux situations</button>';
    showScreen("simpleDifficultHelp");
  }
  function lotteGuide(short=false){
    if(!ensureScreens())return;
    const h=document.getElementById("entryDifficultHost");
    const before=state.lotteCase==="before";
    const first=before
      ?"Un CDD qui se termine avant l’accouchement ne fait pas automatiquement disparaître le droit aux indemnités de maternité. Il faut vérifier votre situation exacte à la date de début du repos, les conditions d’assurance et l’éventuel passage au chômage. Contactez votre mutualité avant la fin du contrat ; demandez une réponse écrite."
      :"Le droit aux indemnités dépend du statut au début du repos de maternité et des conditions d’assurance. Demandez à votre mutualité de vérifier votre situation, particulièrement si votre contrat peut se terminer entre-temps.";
    const tasks=[
      ["1. Le plus important : protéger mes indemnités",first+" Demandez quels justificatifs précis sont nécessaires et à quelle date les transmettre.", "https://www.inami.fgov.be/fr/themes/grossesse-et-naissance/maternite/repos-de-maternite-pour-les-salariees-ou-les-chomeuses"],
      ["2. Prévoir le début du repos","Avant la fin du contrat, discutez de votre calendrier avec l’employeur. Transmettez à la mutualité un certificat mentionnant la date prévue de l’accouchement et la date souhaitée de début du repos. Demandez comment déclarer la fin du CDD à la mutualité et à l’organisme de paiement si nécessaire.","https://www.inami.fgov.be/fr/themes/grossesse-et-naissance/maternite/repos-de-maternite-pour-les-salariees-ou-les-chomeuses"],
      ["3. Chercher une crèche sans attendre","À Etterbeek, les demandes de crèches communales passent par BeKid. Choisissez les lieux et la date souhaitée ; surveillez le renouvellement de la demande tous les trois mois si nécessaire. Le réseau néerlandophone dispose de son propre guichet d’inscription.","https://etterbeek.brussels/fr/demarches/famille-et-sante/inscription-dans-une-creche"],
      ["4. Allocation de naissance","Demandez à une caisse d’allocations familiales bruxelloise quand introduire la demande et quels justificatifs sont nécessaires. Vous n’avez pas besoin d’un AER pour cette première démarche.","https://famiris.brussels/fr/"],
      ["5. Reconnaissance avant la naissance si vous n’êtes pas mariés","Le compagnon peut demander à l’état civil une reconnaissance prénatale avec votre consentement, selon les règles applicables. Une attestation médicale de grossesse indiquant la date prévue est normalement nécessaire.","https://www.belgium.be/fr/famille/enfants/naissance/reconnaissance"],
      ["6. Congé de naissance du compagnon indépendant","Le compagnon doit contacter sa caisse d’assurances sociales afin de vérifier son droit au congé de naissance et à son indemnité d’indépendant, les délais de demande et les justificatifs.","https://www.inasti.be/fr"]
    ];
    h.innerHTML='<div id="lotte-sheet" style="max-width:730px;margin:auto;background:#fff;color:#111;padding:12px"><h2>Grossesse et CDD · Etterbeek</h2><p><strong>La première question est celle des indemnités, pas des primes.</strong> La fin d’un CDD ne supprime pas systématiquement le droit au congé indemnisé : votre mutualité doit vérifier votre dossier. Cette fiche est provisoirement en français.</p>'+
      tasks.map(t=>'<section style="border-top:1px solid #aaa;padding:9px 0;break-inside:avoid"><h3>'+esc(t[0])+'</h3><p>'+esc(t[1])+'</p>'+(short?'':'<p style="overflow-wrap:anywhere;font-size:.84em">'+esc(t[2])+'</p>')+'</section>').join('')+
      '<p><strong>À demander à la mutualité :</strong> « Mon CDD se termine avant la naissance. Quels seront mon statut et mes indemnités à la date de début du repos de maternité, et quelles démarches dois-je faire avant la fin du contrat ? »</p></div><div class="entry-route-actions">'+
      '<button type="button" data-lotte-short>Fiche courte</button><button type="button" data-lotte-full>Fiche détaillée</button><button type="button" data-lotte-print>Imprimer / PDF</button><button type="button" data-lotte-edit>Modifier ma situation</button></div>';
    if(!document.getElementById("lotte-print-style")){const st=document.createElement("style");st.id="lotte-print-style";st.textContent='@media print{body *{visibility:hidden!important}#lotte-sheet,#lotte-sheet *{visibility:visible!important}#lotte-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;color:#000!important;background:#fff!important}@page{size:A4;margin:12mm}}';document.head.appendChild(st);}
    showScreen("simpleDifficultHelp");
  }

  function karimInventory(){
    if(!ensureScreens())return;
    const host=document.getElementById("entryDifficultHost");
    const checks=[
      ["enfant","Supplément d’allocations familiales pour l’affection de mon enfant"],
      ["survie","Pension de survie ou allocation de transition après le décès"],
      ["conge","Congé ou aménagement des horaires pour m’occuper de mon enfant"],
      ["repit","Aide à domicile, répit ou transport adapté"],
      ["fiscal","Avantages fiscaux pour enfant à charge et frais de garde"]
    ];
    const have=state.karimHave||{};
    host.innerHTML='<h2>Qu’avez-vous déjà obtenu ?</h2><p>Cochez seulement ce que vous avez déjà. Vous pouvez aussi ne rien cocher. Aucun document, diagnostic détaillé ou revenu annuel n’est demandé.</p>'+
      checks.map(x=>'<label style="display:block;padding:12px 0;border-bottom:1px solid #aaa"><input type="checkbox" data-karim-have="'+x[0]+'" '+(have[x[0]]?'checked':'')+'> '+esc(x[1])+'</label>').join('')+
      '<div class="entry-route-actions"><button type="button" data-karim-result>Voir seulement ce qu’il me reste à vérifier</button><button type="button" data-karim-back>Retour</button></div>';
    showScreen("simpleDifficultHelp");
  }
  function karimGuide(short=false){
    if(!ensureScreens())return;
    const host=document.getElementById("entryDifficultHost");
    const have=state.karimHave||{};
    const steps=[
      ["enfant","Reconnaissance de l’affection de votre enfant et supplément","Vérifiez auprès de votre caisse d’allocations familiales si un supplément est ouvert pour votre enfant. C’est le Centre d’évaluation de l’autonomie et du handicap d’Iriscare qui évalue les conséquences du handicap : le diagnostic d’autisme ne suffit pas à établir automatiquement les points. Si le supplément est déjà obtenu, demandez simplement si le dossier est à jour ou révisable.","https://famiris.brussels/fr/faq/handicap/comment-demander-un-supplement/"],
      ["survie","Pension de survie et salaire","Contactez le Service fédéral des Pensions (1765) pour vérifier si une pension de survie ou une allocation de transition a été demandée, selon l’âge lors du décès et les conditions légales. Demandez le plafond de cumul applicable à votre emploi, car le salaire peut modifier le droit ou le montant. Ne devinez pas un plafond universel.","https://www.sfpd.fgov.be/fr/montant-de-la-pension/calcul/types-de-pensions/cumul"],
      ["conge","Congé et aménagement des horaires","Votre mutualité peut vérifier si vous remplissez les conditions pour être reconnu aidant proche avec droits sociaux ; cette reconnaissance est nécessaire au congé pour aidants proches. Vous pouvez également examiner d’autres congés familiaux et discuter d’horaires adaptés avec votre employeur. Un aménagement demandé n’est pas toujours un droit automatique.","https://www.onem.be/index.php/citoyens/interruption-de-carriere-credit-temps-et-conges-thematiques/conges-thematiques-tous-secteurs/conge-pour-aidants-proches"],
      ["repit","Soutien, transport et temps de répit","Demandez à un service social à Jette ou à une association spécialisée de faire le point sur les aides à domicile, le répit et les transports adaptés accessibles à votre enfant. Précisez l’âge et le besoin de mobilité seulement au moment de vérifier une offre concrète.","https://www.iriscare.brussels/fr/"],
      ["fiscal","Fiscalité : ne pas confondre thérapie et frais de garde","Demandez au SPF Finances ou à un service fiscal de vérifier l’avantage pour enfant à charge avec handicap reconnu et, séparément, la réduction pour frais de garde admissibles (sous conditions et avec attestation). Les séances de thérapie ne sont pas automatiquement déductibles comme frais de garde. Ne rassemblez les attestations que pour un avantage applicable.","https://finances.belgium.be/fr/particuliers/avantages_fiscaux/garde_enfants/parents-isol%C3%A9s"]
    ];
    const remaining=steps.filter(x=>!have[x[0]]);
    host.innerHTML='<div id="karim-sheet" style="max-width:730px;margin:auto;padding:12px;background:#fff;color:#111">'+
      '<h2>Parent veuf avec enfant autiste · Jette</h2><p><strong>Déjà obtenu :</strong> '+(steps.filter(x=>have[x[0]]).map(x=>esc(x[1])).join(' · ')||'Aucun élément indiqué')+'</p>'+
      '<h3>Ce qu’il vous reste à vérifier ('+remaining.length+')</h3>'+
      (remaining.length?remaining.map((x,i)=>'<section style="padding:9px 0;border-top:1px solid #aaa;break-inside:avoid"><h3>'+(i+1)+'. '+esc(x[1])+'</h3><p>'+esc(x[2])+'</p>'+(short?'':'<p style="overflow-wrap:anywhere;font-size:.84em">'+esc(x[3])+'</p>')+'</section>').join(''):'<p>Vous avez coché les cinq domaines. Aucun nouveau dossier imposé : vous pouvez simplement vérifier si un droit doit être renouvelé ou révisé.</p>')+
      '<p>Un organisme qui vous demande un document doit pouvoir vous dire quel droit il permet de vérifier. Ne recherchez pas votre AER pour cette première orientation.</p></div>'+
      '<div class="entry-route-actions"><button type="button" data-karim-edit>Modifier mon inventaire</button><button type="button" data-karim-print>Imprimer / enregistrer PDF</button><button type="button" data-karim-short>Version courte</button><button type="button" data-karim-full>Version détaillée</button></div>';
    if(!document.getElementById("karim-print-style")){const st=document.createElement("style");st.id="karim-print-style";st.textContent='@media print{body *{visibility:hidden!important}#karim-sheet,#karim-sheet *{visibility:visible!important}#karim-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;color:#000!important;background:#fff!important}@page{size:A4;margin:12mm}}';document.head.appendChild(st);}
    showScreen("simpleDifficultHelp");
  }
  function celineGuide(){
    if(!ensureScreens())return;
    const h=document.getElementById("entryDifficultHost");
    const actions=[
      ["1. Allocations familiales : vérifier les suppléments","10 à 20 minutes pour contacter la caisse","Gain annuel possible : à calculer à partir des versements actuels. Le supplément social pour une famille avec au moins trois enfants dépend des revenus et de l'âge. Demandez à la caisse de vérifier les cinq enfants et les éventuels suppléments non versés.","https://famiris.brussels/fr/faq/supplement-social/droit-supplement-social/"],
      ["2. Soins : demander le remboursement majoré","10 à 20 minutes pour contacter la mutualité","Gain annuel possible : variable selon les soins réellement utilisés. Demandez si les sept personnes bénéficient de l'intervention majorée (anciennement appelée Omnio). La mutualité peut demander les revenus fiscaux et les vérifier avec vous : ne les inventez pas.","https://www.inami.fgov.be/fr/themes/soins-de-sante-cout-et-remboursement/facilites-financieres/intervention-majoree"],
      ["3. Crèche : revoir le tarif si un enfant est accueilli","10 à 20 minutes pour demander une vérification","Gain annuel : différence entre ancien et nouveau tarif journalier × jours réellement facturés. Si un enfant fréquente une crèche subventionnée à tarif selon les revenus, demandez une réévaluation et vérifiez les réductions liées aux familles d'au moins trois enfants. Sinon, passez cette étape.","https://www.one.be/"],
      ["4. Énergie et frais scolaires : un bilan groupé","20 à 40 minutes pour préparer deux demandes","Gain annuel : impossible à chiffrer sans factures et situation réelle. Faites vérifier le tarif social énergie (non automatique pour une famille nombreuse) et demandez aux écoles / au CPAS les aides pour repas, fournitures et sorties.","https://www.socialenergie.be/"]
    ];
    const cards=actions.map(a=>'<section style="padding:12px 0;border-top:1px solid #999;break-inside:avoid"><h3>'+esc(a[0])+'</h3><p><strong>Temps indicatif : </strong>'+esc(a[1])+'</p><p>'+esc(a[2])+'</p><a href="'+esc(a[3])+'" target="_blank" rel="noopener noreferrer">Informations officielles ↗</a></section>').join('');
    h.innerHTML='<div id="celine-sheet" style="background:white;color:#111;padding:12px;max-width:740px;margin:auto"><h2>Famille nombreuse · Ganshoren</h2><p>Deux adultes et cinq enfants : pas besoin de saisir cinq âges ni d’inventer votre revenu imposable. Voici les quatre vérifications qui méritent votre attention. Les gains exacts ne peuvent être établis qu’après vérification des droits.</p>'+cards+
      '<p><strong>Pour l’isolation :</strong> si vous êtes locataire, parlez au propriétaire des améliorations possibles. Ne présumez pas de l’existence d’une prime RENOLUTION ouverte en 2026 : le régime a été interrompu pour les nouveaux travaux.</p><p><strong>Montant annuel :</strong> demandez à chaque organisme « Quel supplément ou remboursement manque aujourd’hui et depuis quand ? » puis multipliez les montants mensuels confirmés par 12, sans compter deux fois les aides déjà versées.</p></div>'+
      '<div class="entry-route-actions"><button type="button" data-celine-print>Imprimer / enregistrer PDF</button><button type="button" data-celine-back>Retour aux situations</button></div>';
    if(!document.getElementById("celine-print-style")){const st=document.createElement("style");st.id="celine-print-style";st.textContent='@media print{body *{visibility:hidden!important}#celine-sheet,#celine-sheet *{visibility:visible!important}#celine-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;color:black!important;background:white!important}@page{size:A4;margin:12mm}}';document.head.appendChild(st);}
    showScreen("simpleDifficultHelp");
  }
  function samiraGuide(short=false){
    if(!ensureScreens())return;
    const host=document.getElementById("entryDifficultHost");
    const steps=[
      ["URGENT — dettes et risque de saisie","Médiation de dettes du CPAS de Schaerbeek : boulevard Auguste Reyers 70, tél. 02 435 50 40. Permanences sans rendez-vous : lundi et vendredi 8h–10h, mardi 13h–15h, accueil limité à 5 personnes. Téléphone lundi–jeudi 8h–12h et 13h–16h. Ce service aide aussi les salariés, pour les arriérés de loyer et les huissiers. Apportez les courriers, sans attendre de calculer votre revenu annuel.","https://www.cpas-schaerbeek.brussels/mediation-des-dettes/"],
      ["Huissier : vérifier le dossier et les délais","Demandez un décompte écrit détaillant dette initiale, paiements, intérêts et frais. Vérifiez le titre, les actes reçus et les dates limites avec le médiateur ou une aide juridique. Si une saisie de salaire, un commandement ou une vente est annoncé, traitez-le immédiatement : la médiation ne suspend pas automatiquement les poursuites. Un plan de paiement doit être réaliste, sans signer dans la précipitation.","https://www.mediationdedettes.be/"],
      ["Loyer impayé et humidité : protéger le logement","Expliquez également les arriérés au médiateur. Prenez des photos datées de l'humidité, gardez les échanges et demandez au propriétaire par écrit les réparations nécessaires. Faites relire une mise en demeure par une association logement. Avant de saisir l'inspection régionale, vérifiez les conséquences possibles sur votre hébergement. Ne cessez pas unilatéralement de payer le loyer.","https://be.brussels/fr/logement/location/logement-en-mauvais-etat"],
      ["Logement social, aide au loyer et énergie","Demandez l'inscription au logement social si nécessaire. L'allocation-loyer exige notamment un bail de résidence principale, une inscription sur liste d'attente et des critères de revenus et de priorité. Pour le tarif social énergie, vérifiez votre droit réel : être salariée à temps partiel ne suffit pas automatiquement. Si vos factures sont impayées, service énergie du CPAS 02 435 50 30.","https://be.brussels/fr/logement/location/aides-la-location/aides-financieres/allocation-loyer"],
      ["Enfants en garde alternée","Contactez la caisse d'allocations familiales qui verse actuellement les prestations. Demandez comment la garde alternée, le domicile et les décisions judiciaires affectent les versements et les éventuels suppléments. Ne supposez pas automatiquement un statut de famille monoparentale.","https://famiris.brussels/fr/"],
      ["Emploi à temps partiel et formation","Quand les urgences de dette et de logement sont sécurisées, demandez à l'employeur si des heures complémentaires compatibles sont possibles. Vérifiez aussi les formations de Bruxelles Formation et les droits liés au temps partiel, sans supposer d'office un complément chômage. Les titres-services ne garantissent pas des heures supplémentaires.","https://www.bruxellesformation.brussels/"]
    ];
    const mini=[
      "1. URGENCE : Médiation de dettes CPAS Schaerbeek, bd Auguste Reyers 70, 02 435 50 40. Lundi/vendredi 8h–10h ; mardi 13h–15h (maximum 5 personnes).",
      "2. HUISSIER : garder les courriers, demander le décompte et faire vérifier tout délai de saisie ou vente. La médiation ne suspend pas automatiquement la procédure.",
      "3. LOGEMENT : photographier l'humidité, écrire au propriétaire et demander conseil avant une plainte. Ne pas arrêter seule de payer le loyer.",
      "4. LOGEMENT / ÉNERGIE : logement social, allocation-loyer sous conditions ; énergie CPAS 02 435 50 30.",
      "5. ENFANTS : demander à la caisse comment la garde alternée change les allocations et suppléments.",
      "6. TRAVAIL : heures complémentaires si possibles, formations et vérification des droits liés au temps partiel."
    ];
    host.innerHTML='<div id="samira-sheet" style="max-width:720px;margin:auto;padding:12px;background:#fff;color:#111"><h2>Dettes, huissier et logement · Schaerbeek</h2><p><strong>Vous avez un emploi, mais les dettes sont prioritaires.</strong> Aucun revenu imposable annuel n’est requis. Vous pouvez être aidée par un service de médiation même si vous travaillez.</p>'+
      (short?mini.map(x=>'<p style="border-top:1px solid #aaa;padding:7px 0">'+esc(x)+'</p>').join(''):steps.map((x,i)=>'<section style="border-top:1px solid #aaa;padding:8px 0;break-inside:avoid"><h3>'+(i+1)+'. '+esc(x[0])+'</h3><p>'+esc(x[1])+'</p><p style="font-size:.83em;overflow-wrap:anywhere">'+esc(x[2])+'</p></section>').join(''))+
      '<p><strong>À demander :</strong> « Je travaille à temps partiel. J’ai des arriérés de loyer et un huissier me réclame de l’argent. Je voudrais faire vérifier les délais, éviter une saisie si possible et établir un plan de remboursement que je puisse payer. »</p>'+
      '<p>Si une vente ou une saisie est imminente, commencez par le courrier de l’huissier et l’aide juridique, même avant les autres démarches.</p></div>'+
      '<div class="entry-route-actions"><button type="button" data-samira-print>Imprimer / enregistrer PDF</button><button type="button" data-samira-short>Fiche courte pour capture</button><button type="button" data-samira-full>Fiche détaillée</button><button type="button" data-samira-back>Retour</button></div>';
    if(!document.getElementById("samira-print-style")){const st=document.createElement("style");st.id="samira-print-style";st.textContent='@media print{body *{visibility:hidden!important}#samira-sheet,#samira-sheet *{visibility:visible!important}#samira-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;color:#000!important;background:#fff!important}@page{size:A4;margin:12mm}}';document.head.appendChild(st);}
    showScreen("simpleDifficultHelp");
  }
  function jozefGuide(short=false){
    if(!ensureScreens())return;
    const h=document.getElementById("entryDifficultHost");
    const tasks=[
      ["Pension : carrière aux Pays-Bas","Appelez le Service fédéral des Pensions au 1765, lundi-vendredi 8h30-12h. Expliquez vos années de travail aux Pays-Bas et demandez si elles ont été prises en compte, si un droit néerlandais reste à demander et comment obtenir un rendez-vous physique. Pas besoin de mypension ni d'ordinateur.","https://www.sfpd.fgov.be/fr/"],
      ["Petit revenu : aide pour personnes âgées","Demandez au Service fédéral des Pensions d'examiner le droit à la garantie de revenus aux personnes âgées (GRAPA), sous réserve des conditions de résidence, de ressources et de situation familiale. Signalez la pension des Pays-Bas.","https://www.sfpd.fgov.be/fr/droit-a-la-pension/grapa"],
      ["Soins moins chers et énergie","Demandez à la mutualité de vérifier l'intervention majorée (BIM : soins moins chers). Demandez ensuite si le tarif social énergie est applicable à votre situation : une petite pension seule ne suffit pas toujours.","https://www.inami.fgov.be/fr"],
      ["Chambre louée sans bail et mauvais état","Notez les problèmes concrets (humidité, chauffage, électricité, sécurité). Demandez à un service logement de vérifier vos droits, les preuves de location et la possibilité d'un bail écrit. Ne déclenchez pas une plainte à l'inspection du logement sans examiner les conséquences possibles sur votre hébergement : une interdiction d'occuper peut nécessiter un relogement.","https://be.brussels/fr/logement/location/logement-en-mauvais-etat"],
      ["Une personne pour vous accompagner à Koekelberg","CPAS de Koekelberg, rue François Delcoigne 39, 1081 Koekelberg. Téléphone : 02 412 16 40. Demandez le service social, un accueil en néerlandais et une aide pour les démarches pension, logement et santé. Faites confirmer l'horaire de permanence avant de venir.","https://koekelberg.be/"]
    ];
    h.innerHTML='<div id="jozef-sheet" style="max-width:730px;margin:auto;background:#fff;color:#111;padding:12px"><h2>Pension et chambre louée · Koekelberg</h2><p>Vous pouvez demander un accompagnement sans utiliser Internet chez vous. Cette fiche reste provisoirement en français ; demandez explicitement un accueil en néerlandais.</p>'+
      (short?tasks.map((x,i)=>'<p style="border-top:1px solid #aaa;padding:8px 0"><strong>'+(i+1)+'. '+esc(x[0])+'</strong> '+esc(x[1])+'</p>').join(''):tasks.map((x,i)=>'<section style="border-top:1px solid #aaa;padding:8px 0;break-inside:avoid"><h3>'+(i+1)+'. '+esc(x[0])+'</h3><p>'+esc(x[1])+'</p><p style="font-size:.85em;overflow-wrap:anywhere">'+esc(x[2])+'</p></section>').join(''))+
      '<p><strong>Premier contact en personne :</strong> au CPAS, dites « Je suis pensionné, j’ai travaillé aux Pays-Bas et je loue une chambre sans bail. Je souhaite parler à un assistant social en néerlandais et vérifier mes droits. »</p></div>'+
      '<div class="entry-route-actions"><button type="button" data-jozef-print>Imprimer / PDF</button><button type="button" data-jozef-short>Version courte</button><button type="button" data-jozef-full>Version détaillée</button><button type="button" data-jozef-back>Retour</button></div>';
    if(!document.getElementById("jozef-print-style")){const st=document.createElement("style");st.id="jozef-print-style";st.textContent='@media print{body *{visibility:hidden!important}#jozef-sheet,#jozef-sheet *{visibility:visible!important}#jozef-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;color:#000!important;background:#fff!important}@page{size:A4;margin:12mm}}';document.head.appendChild(st);}
    showScreen("simpleDifficultHelp");
  }
  function fatouEntry(){
    if(!ensureScreens())return;
    const host=document.getElementById("entryDifficultHost");
    host.innerHTML='<h2>Quelle est votre urgence ce mois-ci ?</h2><p>Choisissez une réponse. Pas besoin de connaître votre revenu annuel.</p><div class="entry-choice-grid">'+
      '<button type="button" data-fatou-choice="electricity">L’électricité coupe ou risque de couper</button>'+
      '<button type="button" data-fatou-choice="maintenance">La pension alimentaire n’est pas payée</button>'+
      '<button type="button" data-fatou-choice="children">Je manque d’argent pour mes enfants</button>'+
      '<button type="button" data-fatou-choice="housing">Je risque de perdre mon logement</button></div><button type="button" data-fatou-back>Retour</button>';
    showScreen("simpleDifficultHelp");
  }
  function fatouGuide(short=false){
    if(!ensureScreens())return;
    const host=document.getElementById("entryDifficultHost");
    const steps=[
      ["Électricité coupée ou menacée","Contact concret : Cellule de Prévention en Énergie du CPAS, rue de l’Indépendance 56, 1080 Molenbeek, téléphone 02 412 47 86, permanence téléphonique en semaine de 13 h à 16 h (horaires différents en juillet-août). Dire que trois enfants vivent au foyer et que les coupures sont répétées. Demander une aide urgente, une vérification du compteur à prépaiement, du contrat et du tarif social. Le statut de client protégé est distinct et soumis à conditions, notamment dette et mise en demeure.","https://brugel.brussels/page/client-protege"],
      ["Pension alimentaire impayée","Demander au SECAL la récupération des impayés et vérifier la possibilité d'avances si un titre exécutoire prévoit une pension. Sinon, demander comment établir ce droit. Les avances ne sont pas automatiques.","https://finances.belgium.be/fr/particuliers/famille/rente_alimentaire/secal/je_suis_creancier_d_aliments"],
      ["Allocations pour parent isolé","Contacter la caisse qui paie les allocations familiales. Pour trois enfants de 3, 7 et 11 ans, demander de vérifier le supplément social et le supplément monoparental selon les conditions de revenus et de ménage.","https://famiris.brussels/fr/faq/supplement-social/supplement-famille-monoparentale/"],
      ["Logement social et loyer","Vérifier l'inscription au logement social. L'allocation-loyer bruxelloise exige notamment une inscription sur liste d'attente et un bail de résidence principale ; elle n'est pas automatique.","https://be.brussels/fr/logement/location/aides-la-location/aides-financieres/allocation-loyer"],
      ["Santé","Contacter la mutualité : demander si les remboursements majorés, souvent appelés BIM, sont appliqués, et comment limiter les frais pour les enfants.","https://www.inami.fgov.be/fr"],
      ["École et repas","Vérifier avec la caisse le supplément d'âge annuel (prime scolaire, payé en août). Demander aux écoles et au CPAS les aides aux repas, fournitures et activités.","https://famiris.brussels/fr/faq/paiements-allocations-familiales/prime-scolaire/"]
    ];
    const priorities={electricity:[0,1,2,3,4,5],maintenance:[1,0,2,3,4,5],children:[2,0,1,4,5,3],housing:[3,0,1,2,4,5]};
    const ordered=(priorities[state.fatouPriority]||priorities.electricity).map(i=>steps[i]);
    host.innerHTML='<div id="fatou-sheet" style="max-width:730px;margin:auto;background:#fff;color:#111;padding:12px"><h2>Parent isolé · Molenbeek</h2><p><strong>Urgence : avoir de l’électricité et répondre aux besoins des enfants.</strong> Aucun revenu annuel à calculer pour lire ce plan.</p>'+
      ordered.map((x,i)=>'<section style="border-top:1px solid #aaa;padding:8px 0;break-inside:avoid"><h3>'+(i+1)+'. '+esc(x[0])+'</h3><p>'+esc(x[1])+'</p>'+(short?'':'<p style="overflow-wrap:anywhere;font-size:.83em">'+esc(x[2])+'</p>')+'</section>').join('')+
      '<p><strong>À dire au CPAS :</strong> « Je vis seule avec trois enfants. L’électricité coupe souvent et l’autre parent ne paie pas la pension alimentaire. J’ai besoin d’aide pour le courant aujourd’hui et pour vérifier mes droits. Pouvez-vous m’accompagner oralement ? »</p></div>'+
      '<div class="entry-route-actions"><button type="button" data-fatou-print>Imprimer / enregistrer PDF</button><button type="button" data-fatou-short>Version courte pour capture</button><button type="button" data-fatou-full>Version détaillée</button><button type="button" data-fatou-back>Retour</button></div>';
    if(!document.getElementById("fatou-print-style")){const st=document.createElement("style");st.id="fatou-print-style";st.textContent='@media print{body *{visibility:hidden!important}#fatou-sheet,#fatou-sheet *{visibility:visible!important}#fatou-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;color:#000!important;background:#fff!important}@page{size:A4;margin:12mm}}';document.head.appendChild(st);}
    showScreen("simpleDifficultHelp");
  }
  function kevinGuide(short=false){
    if(!ensureScreens())return;
    const host=document.getElementById("entryDifficultHost");
    const steps=[
      ["Adresse et courrier","CPAS d’Anderlecht, avenue Raymond Vander Bruggen 62-64. Je suis hébergé provisoirement chez des amis : demander la vérification des conditions d’adresse de référence, ou d’une domiciliation adaptée. Éviter toute promesse automatique. L’aide financière peut être demandée sans attendre la régularisation de l’adresse.","https://www.belgium.be/fr/logement/logement_social/sans-abri"],
      ["Chômage : date réelle de fin de droits","Contacter la CAPAC ou son syndicat et demander la date de fin des allocations, les décisions et les montants restants. Les changements de 2026 dépendent du dossier ; ne pas calculer la date à partir d’une seule réponse.","https://www.onem.be/reforme-de-la-reglementation-du-chomage"],
      ["Dettes / huissier : priorité aux délais","Si saisie, vente ou jugement annoncé : faire vérifier le courrier immédiatement. Médiation de dettes du CPAS d’Anderlecht : 02 529 96 10 ou 02 529 96 17 ; med@cpas-anderlecht.brussels. Confirmez le lieu du rendez-vous avec le service, car les annuaires indiquent plusieurs sites. La médiation ne suspend pas automatiquement les procédures.","https://cpas-ocmw.anderlecht.be/aides/mediation-de-dettes/consultation-et-urgence/"],
      ["Demander un complément ou une aide sociale","Faire examiner rapidement les droits au revenu d’intégration, à une aide complémentaire ou à une autre aide sociale selon les revenus et la situation d’hébergement ; demander un accusé de réception daté. CPAS d’Anderlecht : avenue Raymond Vander Bruggen 62-64. Si exclusion du chômage : HUB square Marie Curie 50, sur rendez-vous, à demander sur place.","https://cpas-ocmw.anderlecht.be/2026/09/18/reforme-chomage-laccueil-temporaire-pour-les-personnes-exclues-du-chomage-demenage/"],
      ["Logement : garantie et installation","Avant de signer un bail, demander à la cellule Logement du CPAS si une aide à la garantie locative existe. La prime d’installation pour ancien sans-abri dépend de conditions précises, notamment d’un nouveau logement principal et de l’absence de prime reçue auparavant.","https://cpas-ocmw.anderlecht.be/aides/logement-et-energie/logement/"],
      ["Emploi et formation, ensuite","Une fois les urgences et échéances protégées, demander un accompagnement à Actiris ou à une Mission locale ; explorer Bruxelles Formation. Ne pas refaire une inscription Actiris existante.","https://www.actiris.brussels/fr/citoyens/"]
    ];
    const brief=[
      "1. CPAS avenue Raymond Vander Bruggen 62-64 : demander adresse de référence et aide sociale sans attendre.",
      "2. CAPAC ou syndicat : date de fin des allocations, décision et courrier.",
      "3. Huissier : conserver les courriers. Médiation 02 529 96 10 / 17 ; urgence si saisie ou vente.",
      "4. CPAS : examen aide complémentaire, accusé de réception. Exclusion chômage : HUB square Marie Curie 50 sur rendez-vous.",
      "5. Cellule Logement CPAS : garantie locative et prime d’installation sous conditions.",
      "6. Ensuite : Actiris, Mission locale, Bruxelles Formation."
    ];
    host.innerHTML='<div id="kevin-sheet" style="max-width:730px;margin:auto;padding:12px;color:#111;background:#fff"><h2>Hébergé chez des amis · Anderlecht</h2><p>Vous n’avez pas besoin de remplir un profil de vingt questions. Le courrier et les dettes sont prioritaires. En cas de saisie ou de vente annoncée, vérifiez immédiatement le délai, même avant les autres démarches.</p>'+
      (short?brief.map(x=>'<p style="border-top:1px solid #999;padding:7px 0">'+esc(x)+'</p>').join(''):steps.map((x,i)=>'<section style="border-top:1px solid #999;padding:8px 0;break-inside:avoid"><h3>'+(i+1)+'. '+esc(x[0])+'</h3><p>'+esc(x[1])+'</p><p style="overflow-wrap:anywhere;font-size:.85em">'+esc(x[2])+'</p></section>').join(''))+
      '<p><strong>Si un huissier a annoncé une saisie, une vente ou un délai proche :</strong> ne suivez pas passivement l’ordre de cette fiche ; contactez d’abord le service de médiation de dettes et demandez la procédure d’urgence. Les démarches d’adresse et de revenu peuvent avancer en parallèle.</p><p>À dire au CPAS : « Je suis hébergé temporairement, je ne reçois pas mon courrier de façon fiable, et j’ai des dettes. Pouvez-vous enregistrer ma demande, vérifier l’adresse de référence et m’orienter vers un médiateur ? »</p><p>Un courrier d’huissier ne signifie pas nécessairement une saisie immédiate. Il peut néanmoins déclencher des délais : ne l’ignorez pas.</p></div>'+
      '<div class="entry-route-actions"><button type="button" data-kevin-print>Imprimer / enregistrer PDF</button><button type="button" data-kevin-short>Fiche courte pour capture</button><button type="button" data-kevin-full>Fiche détaillée</button><button type="button" data-kevin-back>Retour</button></div><p>Cette fiche ne demande ni compte, ni adresse, ni téléphone.</p>';
    if(!document.getElementById("kevin-print-style")){const style=document.createElement("style");style.id="kevin-print-style";style.textContent='@media print{body *{visibility:hidden!important}#kevin-sheet,#kevin-sheet *{visibility:visible!important}#kevin-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;color:#000!important;background:#fff!important}@page{size:A4;margin:12mm}}';document.head.appendChild(style);}
    showScreen("simpleDifficultHelp");
  }
  function homelessEntry(){
    if(!ensureScreens())return;
    const host=document.getElementById("entryDifficultHost");
    host.innerHTML='<div class="simple-kicker">EcoTank · Aide pour vivre sans domicile</div><h2>Où êtes-vous actuellement ?</h2><p>Une seule question, pour éviter de vous envoyer au mauvais CPAS. Aucun nom, numéro de téléphone ou identifiant n’est demandé.</p><div class="entry-choice-grid"><button type="button" data-homeless-local>Saint-Gilles (Bruxelles)</button><button type="button" data-homeless-other>Une autre commune</button></div><button type="button" data-homeless-close>Retour aux situations</button>';
    showScreen("simpleDifficultHelp");
  }
  function homelessGuide(short=false){
    if(!ensureScreens())return;
    const host=document.getElementById("entryDifficultHost");
    if(!short && state.homelessOutsideSaintGilles){
      host.innerHTML='<h2>Un accueil près de vous</h2><p>Les adresses détaillées de cette fiche concernent Saint-Gilles. Ne vous rendez pas à ces guichets sans vérifier leur compétence territoriale. Pour une aide sociale, contactez le CPAS de votre lieu de séjour habituel ; pour une nuit d’urgence à Bruxelles, le Samusocial peut orienter, sous réserve de disponibilité.</p><p>Si vous êtes effectivement à Saint-Gilles, vous pouvez ouvrir le parcours local.</p><div class="entry-choice-grid"><button type="button" data-homeless-local>Je suis à Saint-Gilles</button><button type="button" data-homeless-close>Retour</button></div>';
      showScreen("simpleDifficultHelp");return;
    }
    const steps=[
      {title:"1 — Aujourd'hui : manger, se laver, demander une mise à l'abri",
       action:"Allez si possible au centre de jour L'Ilot, 73 rue de l'Église Saint-Gilles, 1060 Bruxelles. Repas, douches, repos et permanence sociale, du lundi au vendredi (lundi et mercredi-vendredi 8h30-17h ; mardi 8h30-13h30). Fermé le week-end. Pour la nuit, demandez à un travailleur social de vous aider à contacter le Samusocial au 0800 99 340. La place n'est pas garantie.",
       ask:"Je suis à la rue. Pouvez-vous m'aider aujourd'hui pour manger, dormir et rencontrer un travailleur social ?",url:"https://ilot.be/accueil-durgence/"},
      {title:"2 — Dès que possible : déposer une demande d'aide ET d'adresse de référence",
       action:"CPAS de Saint-Gilles : 40 rue Fernand Bernier, 1060 Bruxelles. Pour une première demande, privilégiez la matinée : le site du CPAS indique l'accueil des nouvelles demandes sans rendez-vous de 8h à 11h45 les jours ouvrables. Demandez une preuve datée du dépôt. Demandez l'examen du revenu d'intégration ou de toute autre aide sociale adaptée ET de l'adresse de référence. On peut demander le RIS même sans domicile officiel. La compétence du CPAS dépend du lieu de séjour effectif et de certaines exceptions.",
       ask:"Je souhaite déposer aujourd'hui une demande d'aide sociale et demander une adresse de référence. Pouvez-vous enregistrer la demande et me remettre un accusé de réception daté ?",url:"https://www.cpas1060.be/"},
      {title:"3 — Papiers et courrier : avec l'assistant social",
       action:"Faites vérifier quel document d'identité existe encore et la procédure de perte ou de renouvellement applicable. Une adresse de référence peut permettre de recevoir du courrier selon les conditions légales ; convenez de la fréquence et du lieu de retrait. N'attendez pas le renouvellement de la carte pour déposer la demande d'aide.",
       ask:"Quel document faut-il refaire d'abord, où puis-je récupérer le courrier et qui peut m'accompagner ?",url:"https://www.belgium.be/fr/logement/logement_social/sans-abri"},
      {title:"4 — Soins et mutualité",
       action:"Demandez au CPAS et à une mutualité ou à la CAAMI de vérifier votre couverture et les possibilités de soins. Une situation médicale urgente ne doit pas attendre les papiers.",
       ask:"Je ne sais pas si je suis encore couvert. Qui peut vérifier mes droits et m'aider à recevoir des soins ?",url:"https://www.caami-hziv.fgov.be/fr"},
      {title:"5 — Compte bancaire et versement",
       action:"Avec un professionnel, vérifiez les justificatifs exigés pour un compte et l'éventuel service bancaire de base. Si vous n'avez pas encore de compte, demandez au CPAS comment recevoir une aide pendant ce délai.",
       ask:"De quoi ai-je besoin pour ouvrir un compte, et comment recevoir l'aide en attendant ?",url:"https://economie.fgov.be/fr/themes/services-financiers/services-de-paiement/service-bancaire-de-base"},
      {title:"6 — Vérifier le chômage s'il y a eu un emploi",
       action:"Si vous avez travaillé ou reçu une allocation, demandez à un organisme de paiement (CAPAC ou syndicat) de vérifier votre dossier et les délais. Cette vérification ne doit pas retarder la demande au CPAS.",
       ask:"Pouvez-vous vérifier si j'ai encore des droits et m'expliquer toute décision écrite ?",url:"https://www.onem.be/"},
      {title:"7 — Ensuite : stabilisation et avenir",
       action:"Avec le travailleur social, demandez une recherche de logement stable, puis vérifiez progressivement formation, emploi, tarifs sociaux et économies. Pas de conseils d'énergie domestique tant qu'aucun logement n'est disponible.",
       ask:"Quelle est ma prochaine démarche après l'urgence et les documents ?",url:"https://www.cpas1060.be/"}
    ];
    const mini=[
      ["1 · Aujourd'hui","L'Ilot : 73 rue de l'Église Saint-Gilles (repas, douche, travailleur social, semaine). Nuit : Samusocial 0800 99 340, place non garantie."],
      ["2 · Demander l'aide sans attendre","CPAS : 40 rue Fernand Bernier, matin avant 11h45 les jours ouvrables. Demander aide financière / RIS + adresse de référence + accusé de réception."],
      ["3 · Papiers et courrier","Avec le travailleur social : identité, éventuelle déclaration de perte, adresse de référence et récupération du courrier."],
      ["4 · Soins","Vérifier mutuelle / CAAMI, aides aux soins. Les urgences ne doivent pas attendre."],
      ["5 · Compte","Faire examiner le service bancaire de base et comment recevoir l'aide sans compte."],
      ["6 · Chômage","CAPAC ou syndicat : vérifier ses droits si l'on a déjà travaillé. Ne pas retarder le CPAS."],
      ["7 · Après","Logement stable, puis formation, emploi et tarifs sociaux."]
    ];
    const details=steps.map((item,i)=>{
      return '<section class="homeless-step" style="padding:9px 0;border-top:1px solid #999;break-inside:avoid">'+
        '<h3>'+esc(item.title)+'</h3>'+
        (short?'<p>'+esc(mini[i][1])+'</p>':'<p>'+esc(item.action)+'</p><p><strong>À demander :</strong> '+esc(item.ask)+'</p><p><small>'+esc(item.url)+'</small></p>')+
        '</section>';
    }).join("");
    host.innerHTML='<div id="homeless-sheet" style="max-width:720px;margin:auto;background:white;color:#111;padding:12px">'+
      '<h2>'+(short?'Mon plan en 7 étapes — Saint-Gilles':'Ma feuille de route — Sans domicile · Saint-Gilles')+'</h2>'+
      '<p><strong>Ne pas commencer par des économies :</strong> se mettre à l’abri, demander des droits, rétablir les moyens de les recevoir. Les étapes 1 et 2 peuvent démarrer le même jour. Pas besoin de régler les papiers avant de demander une aide.</p>'+
      '<section style="border:2px solid #222;padding:12px"><h3>Besoin d’une vraie personne ?</h3><p><strong>Point d’Appui — 40 rue de Bosnie, Saint-Gilles.</strong> Sans rendez-vous lundi-vendredi, 9h-12h et 13h-16h. Aide aux démarches et impression de documents. Ce n’est pas le guichet de dépôt de nouvelles demandes : pour déposer l’aide financière, allez au CPAS, rue Fernand Bernier 40, le matin.</p><p><strong>À dire :</strong> « Je dors dehors, je n’ai pas de smartphone, ni d’e-mail, ni d’adresse pour recevoir du courrier. Pouvez-vous m’aider à faire ces démarches et imprimer ce plan ? »</p></section>'+
      details+
      (short?'':'<p><strong>Sans imprimante :</strong> affichez la version courte et prenez une photo avec un appareil disponible, ou demandez au Point d’Appui d’imprimer ce plan. Aucune connexion n’est nécessaire pour consulter ce plan.</p>')+
      '</div><div class="entry-route-actions" data-homeless-controls><button type="button" data-homeless-print>Imprimer / enregistrer PDF</button><button type="button" data-homeless-short>Voir la version courte (capture)</button><button type="button" data-homeless-full>Version détaillée</button><button type="button" data-homeless-close>Retour aux situations</button></div>'+
      '<p><strong>Ordinateur partagé :</strong> cette fiche ne demande aucune donnée personnelle. Pensez à fermer le navigateur ou votre session. Ne sauvegardez pas vos identifiants sur ce poste.</p>';
    if(!document.getElementById("homeless-print-style")){
      const style=document.createElement("style");style.id="homeless-print-style";
      style.textContent='@media print{body *{visibility:hidden!important}#homeless-sheet,#homeless-sheet *{visibility:visible!important}#homeless-sheet{position:absolute;top:0;left:0;width:100%!important;max-width:none!important;font-size:10pt;color:#000!important;background:#fff!important;padding:0!important}#homeless-sheet .homeless-step{break-inside:avoid!important}@page{size:A4;margin:12mm}}';
      document.head.appendChild(style);
    }
    showScreen("simpleDifficultHelp");
  }

  function feasibleAction(key,url,label){
    const status=(state.feasibility||{})[key]||"";
    const buttons=items=>'<div class="entry-choice-grid">'+items.map(x=>'<button type="button" class="entry-choice" data-feasible="'+x[0]+'" data-feasible-key="'+esc(key)+'">'+esc(x[1])+'</button>').join('')+'</div>';
    if(!status)return '<section class="guided-feasibility"><h3>Pouvez-vous réellement effectuer cette démarche ?</h3>'+buttons([["ready","Oui"],["no_phone","Je n’ai pas de téléphone"],["no_internet","Pas de connexion ni de matériel"],["no_travel","Déplacement impossible"],["previous","Déjà essayé sans résultat"],["no_documents","Documents manquants"]])+'</section>';
    if(status==="ready")return '<section class="guided-feasibility"><h3>Voici le lien correspondant</h3><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a><p>Gardez EcoTank ouvert pour suivre les consignes.</p>'+buttons([["previous","Cette démarche n’a pas fonctionné"]])+'</section>';
    const advice={no_phone:"Demandez une alternative sans SMS, par e-mail, au guichet ou par eID/CSAM si le service le permet.",no_internet:"Demandez un formulaire papier, un guichet ou un espace public numérique accompagné.",no_travel:"Demandez un échange à distance ou une permanence proche et vérifiez avant de payer un trajet.",previous:"Notez la réponse et son motif. Cherchez un réexamen, un recours ou une autre structure plutôt que répéter la même demande.",no_documents:"Faites préciser les pièces indispensables, les alternatives acceptées et comment obtenir les pièces manquantes."};
    return '<section class="guided-feasibility"><h3>Votre alternative</h3><p>'+esc(advice[status])+'</p>'+buttons([["ready","Je peux maintenant essayer"],["reset","Choisir un autre obstacle"]])+'<p>Si cela reste impossible, choisissez une autre piste sans recommencer le parcours.</p></section>';
  }

  // Chaque ressource doit être accompagnée de consignes avant de quitter EcoTank.
  // Les démarches, coordonnées et conditions sont à revérifier auprès du service.
  function actionGuide(kind){
    const instructions={
      orientation:["Sur place : demandez à l'accueil un entretien d'orientation individuel, et expliquez que vous ne savez pas encore quel métier chercher.","Demandez une liste de deux ou trois métiers possibles, les formations utiles et une prochaine action précise.","Si vous ne pouvez pas vous déplacer, écrivez à info@cdm-bp.brussels en décrivant votre situation et en demandant les possibilités de conseil à distance."],
      person:["Sur la page de la Région, repérez la Mission locale de votre commune (ou la plus accessible).","Contactez l'accueil et demandez un accompagnement individuel gratuit pour chercher un emploi. Précisez si vous avez besoin d'aide avec votre CV, les offres ou les formalités.","Demandez explicitement les horaires, la nécessité d'un rendez-vous et les pièces réellement utiles avant de vous déplacer."],
      applications:["Choisissez une offre à laquelle vous avez répondu, si vous en avez une, et conservez votre CV actuel.","Demandez à une Mission locale une relecture de ce CV et de cette candidature ainsi qu'une simulation d'entretien.","Si vous n'avez ni CV ni ordinateur, dites-le lors du premier contact : c'est précisément une des raisons de demander un accompagnement."],
      offers:["Cherchez d'abord les offres qui vous intéressent : métier, lieu, horaires et expérience demandée.","Ouvrez une offre et relevez le nom de l'employeur, les conditions, la date limite et la manière de postuler.","S'il est impossible de déposer la candidature, revenez à EcoTank et choisissez le blocage qui vous empêche d'avancer."],
      identity:["Notez quel document manque : carte d'identité, séjour, permis de travail ou autre, sans transmettre de copie à EcoTank.","Sur le site de l'ADDE, cherchez le service de conseil juridique relatif au séjour et à l'accès au travail ; demandez comment vérifier votre situation précise.","Préparez seulement vos documents existants ; ne payez aucune démarche et ne concluez pas à un droit au travail sans vérification."],
      digital:["Sur le site CSAM, recherchez « se connecter avec eID ». Utilisez la carte, le lecteur et le PIN uniquement si le portail concerné propose cette option.","Si le service impose une autre méthode, notez son nom et demandez à ce service une procédure au guichet ou sur papier.","Ne communiquez jamais votre PIN, vos mots de passe ou vos codes de connexion à un accompagnateur."],
      cvdocs:["Identifiez une annonce ou un type de poste qui vous attire.","Demandez à la Mission locale un rendez-vous pour construire votre CV ou écrire une candidature, même si vous n'avez aucun document prêt.","Demandez quelles pièces sont exigées pour cette offre, plutôt que de refaire tous vos papiers d'avance."],
      travel:["Cherchez un accompagnement au plus près de votre commune, puis demandez au service si un premier entretien à distance est possible.","Expliquez que vous ne pouvez pas avancer les frais de déplacement et demandez si une prise en charge est envisageable.","Ne supposez aucun remboursement acquis ; confirmez les conditions avant de vous déplacer."],
      unknown_docs:["Choisissez l'offre ou la démarche qui vous intéresse et notez ce qu'elle demande réellement.","Demandez à une Mission locale de distinguer les documents indispensables maintenant de ceux nécessaires seulement lors du contrat.","Si une pièce manque, faites préciser l'organisme et la procédure pour l'obtenir."],
      registered:["Ne recommencez pas votre inscription Actiris.","Si vous visez un emploi ACS, choisissez une offre ACS précise, puis demandez si vous êtes admissible et comment obtenir l'attestation correspondante.","Si vous souhaitez une FPIE, présentez un projet de formation et d'embauche à Bruxelles Formation avant tout début."],
      unregistered:["Commencez à consulter et à répondre aux offres qui vous intéressent : ce n'est pas réservé aux personnes inscrites.","Si une offre ou une mesure exige une inscription Actiris, lisez la procédure et vérifiez la possibilité d'un rendez-vous en antenne.","Signalez immédiatement si vous ne pouvez pas vous identifier en ligne."],
      unsure:["Demandez à une Maison de l'Emploi comment vérifier l'existence d'une inscription Actiris déjà ouverte.","Préparez votre identité et la date approximative d'une éventuelle inscription, sans transmettre ces données à EcoTank.","Ne créez pas un deuxième dossier avant d'avoir obtenu la réponse."],
      acs:["Repérez une offre explicitement indiquée « ACS ». Notez sa référence.","Demandez à Actiris de vérifier les critères de cette offre et la possibilité d'obtenir l'attestation correspondante.","Ne dites pas à l'employeur que vous détenez une attestation tant qu'elle n'est pas délivrée."],
      fpie:["Identifiez un employeur potentiellement intéressé par une formation suivie d'une embauche.","Demandez à Bruxelles Formation une vérification des conditions FPIE avant de commencer toute formation.","Conservez la réponse et vérifiez l'engagement prévu après la formation."],
      article60:["Vérifiez si vous percevez une aide du CPAS ou si un refus doit d'abord être examiné.","Demandez un avis sur les conditions de l'emploi d'insertion et sur le refus, s'il existe.","Ne présentez pas l'article 60 comme un droit automatique ni comme une solution certaine sans CPAS."],
      all_advantages:["Commencez par noter la commune de résidence, la situation Actiris et la nature du poste visé.","Examinez les conditions ACS pour une offre précise, puis la FPIE comme dispositif distinct.","Si le CPAS vous a refusé une aide, vérifiez ce refus avant d'envisager un article 60."],
      food:["Ouvrez le répertoire d'aide alimentaire et cherchez votre commune ou une commune accessible.","Notez le lieu, le type d'aide (repas, colis, épicerie), les horaires, le contact et les conditions éventuelles.","Avant de vous déplacer, demandez si l'aide est accessible aujourd'hui et quels justificatifs sont réellement nécessaires."],
      shelter:["Cherchez sur la page officielle les modalités du jour pour demander un hébergement d'urgence.","Relevez le numéro, le créneau d'inscription et le lieu éventuellement indiqué ; une demande ne garantit pas de place.","Si vous êtes sans moyen d'appel ou de connexion, recherchez l'accueil physique ou un service de proximité qui peut effectuer l'appel avec vous."],
      care:["Cherchez la rubrique des consultations et permanences de Médecins du Monde près de vous.","Vérifiez les jours d'accueil et si un rendez-vous est exigé ; expliquez que vous ne pouvez pas avancer de frais.","En cas de danger médical immédiat, n'attendez pas cette démarche : appelez le 112."],
      other:["Écrivez en une phrase le besoin immédiat et ce que vous avez déjà tenté.","Utilisez la recherche du site pour trouver la fiche correspondant exactement au besoin.","Si une fiche ne donne pas de démarche praticable, revenez à EcoTank pour choisir une autre priorité."],
      refused:["Prenez la décision écrite si vous l'avez, puis notez l'organisme, la date de notification et le motif du refus.","Demandez à un service juridique de vérifier les délais de recours et les démarches possibles, même si vous n'avez pas tous les papiers.","Ne déposez pas aveuglément une nouvelle demande identique ; ne laissez pas passer un délai de recours pendant la recherche d'aide."],
      stopped:["Recherchez la décision écrite d'arrêt des allocations et sa date de réception.","Demandez à l'organisme payeur le motif officiel, la date d'effet et les possibilités de contestation.","Faites rapidement vérifier les délais par une permanence juridique si vous contestez la décision."],
      administrative:["Notez le nom du service auquel vous ne pouvez plus accéder et le message de blocage, sans enregistrer vos identifiants.","Essayez eID/CSAM seulement si ce service l'accepte ; sinon cherchez sur le site du service les contacts du guichet ou du formulaire papier.","Si une date limite approche, demandez comment prouver votre tentative et déposer dans les temps."],
    };
    const steps=instructions[kind]||instructions.other;
    return '<div class="guided-howto"><h3>Concrètement, que faire ?</h3><ol>'+steps.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol><p><strong>Avant de quitter EcoTank :</strong> gardez cette page ouverte pour retrouver les étapes. Les horaires et critères peuvent changer.</p></div>';
  }

  // Parcours rapide réservé aux personnes qui rencontrent des blocages.
  // Les autres parcours EcoTank et le questionnaire détaillé restent inchangés.
  function renderDifficultHelp(nextTopic){
    if(!ensureScreens())return;
    if(nextTopic){state.difficultTopic=nextTopic;state.helpStep=0;state.foodLocationConfirmed=false;}
    const initial=state.destinationId==="residence_status"?"residence":
      state.destinationId==="international_special"?"international":"overview";
    const topic=state.difficultTopic||initial;
    const host=document.getElementById("entryDifficultHost");
    if(!host)return;
    const sources=state.catalog?.official_sources||{};
    // Blocages cumulés : orienter vers une démarche concrète propre à chaque difficulté.
    if((state.lostRightsQueue||[]).length){
      const issue=state.lostRightsQueue[state.lostRightsIndex||0];
      const tasks={
        nothing:[
          ["Chercher une aide alimentaire accessible sans attendre","Vous n’avez déclaré aucun revenu. La première démarche est de trouver un repas ou un colis disponible près de chez vous.","https://www.fdss.be/fr/aide-alimentaire/","Chercher une aide alimentaire"],
          ["Faire vérifier l’accès aux soins sans couverture","La gratuité ou la prise en charge n'est pas automatique. Un service de soins pour personnes précarisées peut vous orienter.","https://www.medecinsdumonde.be/","Trouver une consultation"],
          ["Demander un avis indépendant sur les aides encore possibles","Même après un refus, une aide ponctuelle, une nouvelle situation ou un recours peuvent nécessiter un examen individualisé.","https://www.droitsquotidiens.be/fr","Vérifier mes possibilités"]
        ],
        refused:[
          ["Vérifier la date et la raison du refus","Prenez la décision écrite, notez la date de notification et faites vérifier rapidement le délai de recours. Ne recommencez pas une première demande sans examiner le refus.","https://www.droitsquotidiens.be/fr","Examiner les possibilités de recours"],
          ["Demander un premier avis juridique","Le premier conseil juridique peut être gratuit. Apportez la décision du CPAS ou de l'ONEM et vos documents disponibles.","https://www.avocats.be/fr","Trouver une aide juridique"]
        ],
        stopped:[
          ["Demander la décision d'arrêt et son motif","Identifiez l'organisme qui a arrêté le paiement (ONEM, mutualité ou autre). Demandez la décision datée et vérifiez rapidement les délais de contestation.","https://www.onem.be/","Vérifier les démarches ONEM"],
          ["Faire examiner l'arrêt de vos allocations","En cas d'arrêt contesté, un service juridique peut vérifier si une révision ou un recours est possible.","https://www.droitsquotidiens.be/fr","Vérifier les recours"]
        ],
        administrative:[
          ["Identifier la démarche qui bloque","Si vous avez une carte eID et son code PIN, certains services permettent de se connecter via CSAM sans itsme. Sinon, demandez une possibilité au guichet ou sur papier.","https://www.csam.be/fr/index.html","Voir les moyens de connexion"],
          ["Chercher une aide numérique de proximité","Des espaces publics numériques peuvent aider à effectuer les démarches sans imposer l'achat d'un téléphone.","https://www.1890.be/","Chercher une aide"]
        ]
      };
      if(issue==="nothing"&&state.immediateNeed==="work"){
        const step=state.workStage||"block";
        const pick=items=>'<div class="entry-choice-grid">'+items.map(x=>'<button type="button" class="entry-choice" data-work-pick="'+x[0]+'">'+esc(x[1])+'</button>').join("")+'</div>';
        const common='<div class="entry-footer"><button type="button" data-work-back>← Étape précédente</button><button type="button" data-lost-rights-next>Passer à une autre difficulté</button><button type="button" data-lost-rights-reselect>Modifier mes réponses</button></div>';
        let html='<div class="simple-kicker">EcoTank · Retrouver un emploi</div>';
        if(step==="block"){
          html+='<h2>Qu’est-ce qui vous bloque aujourd’hui ?</h2><p>Vous pouvez chercher un emploi sans percevoir d’allocations et sans être inscrit chez Actiris. On vérifie d’abord ce qui vous manque, avant de vous envoyer vers un organisme.</p>'+pick([
            ["orientation","Je ne sais pas où chercher ou quel métier viser"],
            ["person","J’ai besoin d’une personne pour m’aider"],
            ["documents","Mes papiers ou mon accès numérique me bloquent"],
            ["advantages","Je veux connaître les aides possibles à l’embauche"],
            ["applications","J’envoie des candidatures mais ça ne fonctionne pas"],
            ["offers","Je veux trouver des offres, sans accompagnement"]
          ]);
        }else if(step==="actiris"){
          html+='<h2>Êtes-vous déjà inscrit chez Actiris ?</h2><p>Cette question sert uniquement à éviter une inscription inutile et à examiner certaines mesures. Vous pouvez toujours postuler sans inscription.</p>'+pick([["registered","Oui"],["unregistered","Non"],["unsure","Je ne sais plus"]]);
        }else if(step==="documents"){
          html+='<h2>Qu’est-ce qui vous empêche de faire les démarches ?</h2>'+pick([
            ["identity","Carte d’identité, titre de séjour ou droit de travailler"],
            ["digital","Je n’ai pas accès à itsme, à un GSM ou à Internet"],
            ["cvdocs","Je n’ai pas de CV, de diplôme ou de justificatifs"],
            ["travel","Je ne peux pas payer les déplacements"],
            ["unknown_docs","Je ne sais pas quel papier est nécessaire"]
          ]);
        }else if(step==="advantages_detail"){
          html+='<h2>Que souhaitez-vous vérifier ?</h2>'+pick([
            ["acs","Une attestation pour un emploi ACS"],
            ["fpie","Une formation en entreprise avant embauche (FPIE)"],
            ["article60","Un emploi d’insertion via le CPAS"],
            ["all_advantages","Je ne sais pas : examiner les pistes accessibles"]
          ]);
        }else if(step==="support"){
          const pages={
            orientation:["Parler à un conseiller pour choisir par où commencer","Vous ne devez pas chercher seul dans le site. Rendez-vous directement à l’accueil de la Cité des métiers, avenue de l’Astronomie 14, 1210 Bruxelles (Madou). Demandez un conseil individuel d’orientation sans rendez-vous et gratuit. Dites : « Je cherche un emploi, mais je ne sais pas dans quel métier ni par où commencer. Pouvez-vous regarder avec moi mes possibilités et les prochaines démarches ? » L’accueil-conseil est ouvert lundi, mardi, mercredi et vendredi 9h30–12h30 et 13h30–16h, jeudi 13h30–19h (jusqu’à 16h pendant les vacances scolaires). Si vous ne pouvez pas venir, envoyez votre demande à info@cdm-bp.brussels ou utilisez leur conseil à distance. Objectif : repartir avec une piste de métier, une formation ou un accompagnement adapté, et savoir quelle démarche faire ensuite.","https://www.citedesmetiers.brussels/fr/accueil/je-me-rends-a-la-cite-des-metiers/","Voir où aller et comment rencontrer un conseiller"],
            person:["Parler à quelqu’un qui accompagne réellement les recherches","Une Mission locale peut vous aider en personne à définir un projet, chercher des offres, rédiger votre CV et préparer des entretiens. Contactez celle de votre commune et vérifiez ses permanences.","https://be.brussels/fr/emploi/un-emploi-bruxelles/missions-locales-dinsertion-socio-professionnelle","Trouver une Mission locale"],
            applications:["Revoir une candidature plutôt que recommencer les mêmes envois","Demandez à une Mission locale de revoir avec vous une annonce précise, votre CV et le résultat des candidatures précédentes. Signalez si vous n’avez ni ordinateur ni moyen de déplacement.","https://be.brussels/fr/emploi/un-emploi-bruxelles/missions-locales-dinsertion-socio-professionnelle","Accompagnement en personne"],
            offers:["Accéder aux offres sans refaire une inscription","Vous pouvez consulter des offres publiques et postuler directement auprès des employeurs. Une inscription chez Actiris peut aider pour certains services, mais n’est pas une condition générale pour rechercher un travail.","https://www.actiris.brussels/fr/citoyens/","Consulter des offres"],
            identity:["Vérifier le droit au travail avant de postuler inutilement","Les documents et le droit au travail dépendent de votre nationalité et de votre titre de séjour. Faites vérifier les documents existants par un service spécialisé ; ne concluez pas vous-même qu’une carte manquante interdit tout emploi.","https://www.adde.be/","Trouver un conseil sur le séjour et le travail"],
            digital:["Une démarche sans itsme ni téléphone","Si votre eID, votre code PIN et votre lecteur fonctionnent, essayez l’identification eID via CSAM quand le service l’autorise : elle ne demande pas de SMS. Sinon demandez un guichet ou un accompagnement en présentiel. N’achetez pas un téléphone uniquement pour commencer.","https://www.csam.be/fr/index.html","Méthodes de connexion CSAM"],
            cvdocs:["Préparer les documents vraiment nécessaires","Une candidature ne nécessite pas toujours un diplôme ou un CV complet. Une Mission locale peut aider à rédiger un CV ou une candidature spontanée ; demandez à l’employeur les pièces exigées pour l’offre précise.","https://be.brussels/fr/emploi/un-emploi-bruxelles/missions-locales-dinsertion-socio-professionnelle","Aide aux candidatures"],
            travel:["Chercher une aide locale et des entretiens accessibles","Privilégiez une Mission locale proche ou demandez un premier contact à distance. Expliquez que le transport est un obstacle et faites examiner les possibilités de prise en charge AVANT de vous déplacer ; aucun remboursement n’est garanti.","https://be.brussels/fr/emploi/un-emploi-bruxelles/missions-locales-dinsertion-socio-professionnelle","Accompagnement près de chez vous"],
            unknown_docs:["Faire une liste courte des pièces réellement exigées","Choisissez d’abord un métier ou une offre. Une Mission locale peut vous aider à distinguer ce qui est obligatoire pour postuler de ce qui ne sera nécessaire qu’à l’embauche.","https://be.brussels/fr/emploi/un-emploi-bruxelles/missions-locales-dinsertion-socio-professionnelle","Vérifier avec une Mission locale"],
            registered:["Ne pas refaire l’inscription","Votre inscription existante suffit pour commencer la vérification. Pour les ACS, l’attestation dépend des conditions d’une offre précise. Pour une FPIE, Bruxelles Formation doit vérifier le dossier avant le début.","https://www.actiris.brussels/fr/citoyens/agents-contractuels-subventionnes/","Vérifier les offres ACS"],
            unregistered:["Distinguer candidature ordinaire et aide conditionnée","Vous pouvez déjà postuler. Une inscription comme chercheur d’emploi peut être nécessaire pour une mesure ciblée. Si vous décidez de la demander, vérifiez le canal possible, y compris en antenne.","https://www.actiris.brussels/fr/citoyens/comment-minscrire-ou-me-reinscrire/","Conditions d’inscription"],
            unsure:["Vérifier l’inscription sans recréer de dossier","Une antenne ou Maison de l’Emploi peut vous aider à vérifier votre inscription. Si vous n’avez plus de GSM, signalez-le dès le premier contact.","https://www.actiris.brussels/fr/citoyens/maison-de-lemploi/","Trouver une Maison de l’Emploi"],
            acs:["ACS : vérifier une offre précise","Les emplois ACS ont des critères liés au poste et au candidat. Il faut repérer une offre ACS puis faire vérifier l’éligibilité et l’attestation par Actiris ; ce n’est pas un statut général ni automatique.","https://www.actiris.brussels/fr/citoyens/agents-contractuels-subventionnes/","Conditions ACS"],
            fpie:["FPIE : vérifier avant de commencer","La formation professionnelle individuelle en entreprise peut préparer une embauche, sous conditions. Elle se construit avec un employeur et Bruxelles Formation AVANT le démarrage. Ne présentez pas la FPIE comme une prime déjà acquise.","https://www.bruxellesformation.brussels/","Contacter Bruxelles Formation"],
            article60:["Emploi d’insertion : vérifier d’abord les droits","L’article 60 §7 exige des conditions précises, notamment liées à l’aide sociale et à la situation administrative. En cas de refus CPAS, faites d’abord examiner ce refus ; un renvoi automatique au CPAS serait inutile.","https://www.droitsquotidiens.be/fr","Examiner les conditions et le refus"],
            all_advantages:["Comparer les mesures avant de parler d’attestation","Vérifiez séparément : ACS (sur offre précise), FPIE (projet avec employeur), emploi d’insertion (conditions CPAS). Certaines réductions ONSS concernent l’employeur lui-même. Aucune éligibilité ne peut être affirmée sur ces seules réponses.","https://www.actiris.brussels/fr/citoyens/agents-contractuels-subventionnes/","Commencer par les conditions ACS"]
          };
          const t=pages[state.workChoice]||pages.person;
          const howto=actionGuide(state.workChoice);
          html+='<h2>Une première action adaptée</h2><section class="guided-one-step"><h3>'+esc(t[0])+'</h3><p>'+esc(t[1])+'</p></p>'+feasibleAction('work-'+state.workChoice,t[2],t[3])+'<p>'+
            howto+'<p>Cette piste est-elle praticable pour vous ?</p>'+pick([
              ["cannot_access","Non : impossible d’y accéder (connexion, téléphone, déplacement)"],
              ["already_tried","Non : j’ai déjà essayé sans résultat"],
              ["person","Je préfère une aide en personne"],
              ["advantages","Vérifier aussi les aides à l’embauche"],
              ["block_again","Explorer un autre obstacle"]
            ])+'</section>';
        }else if(step==="obstacle"){
          html+='<h2>Quelle alternative vous aiderait à avancer ?</h2>'+pick([
            ["digital","Je n’ai pas de moyen de connexion"],
            ["travel","Je ne peux pas me déplacer"],
            ["person","Je souhaite une aide physique et gratuite"],
            ["orientation","Je veux une autre porte d’entrée"],
            ["block_again","Revoir les difficultés"]
          ]);
          html+='<p>EcoTank ne considérera pas une simple redirection comme une solution.</p>';
        }
        host.innerHTML=html+common;
        showScreen("simpleDifficultHelp");return;
      }
      if(issue==="nothing"&&!state.immediateNeed){
        host.innerHTML='<div class="simple-kicker">Une aide concrète, maintenant</div><h2>Qu’est-ce qui vous manque le plus aujourd’hui ?</h2>'+
          '<div class="entry-choice-grid"><button type="button" class="entry-choice" data-immediate-need="food">De quoi manger</button>'+
          '<button type="button" class="entry-choice" data-immediate-need="shelter">Un endroit où dormir</button>'+
          '<button type="button" class="entry-choice" data-immediate-need="care">Des soins</button>'+
          '<button type="button" class="entry-choice" data-immediate-need="work">Retrouver un travail</button>'+ 
          '<button type="button" class="entry-choice" data-immediate-need="other">Une autre aide urgente</button></div>'+
          '<div class="entry-footer"><button type="button" data-lost-rights-reselect>Modifier mes réponses</button></div>';
        showScreen("simpleDifficultHelp");return;
      }
      if(issue==="nothing"&&state.immediateNeed){
        const need={
          food:["Chercher une aide alimentaire près de chez vous","Les repas, colis et épiceries ont des conditions différentes. Le répertoire permet d'identifier les lieux et de vérifier comment y accéder.","https://www.fdss.be/fr/aide-alimentaire/","Voir les aides alimentaires"],
          shelter:["Chercher un accueil pour cette nuit","Consultez les modalités d'accueil et les contacts du Samusocial. Une place n'est jamais garantie.","https://samusocial.be/","Voir les possibilités d'accueil"],
          care:["Chercher une consultation accessible","Médecins du Monde propose des dispositifs de soins pour les personnes en difficulté d'accès. Vérifiez le centre et ses conditions.","https://www.medecinsdumonde.be/","Trouver des soins"],
          work:["Faire le point sur les aides qui facilitent une embauche","Vous pouvez chercher du travail même sans allocations. Si vous êtes déjà inscrit chez Actiris, il n'est pas nécessaire de recommencer cette inscription. Vérifiez les dispositifs ACS, FPIE et les offres adaptées à votre situation.","https://www.actiris.brussels/fr/citoyens/","Chercher un emploi et des aides à l'embauche"],
          other:["Demander une orientation pour une nécessité immédiate","Il faut identifier le besoin précis plutôt que vous renvoyer vers une demande de CPAS déjà refusée.","https://www.droitsquotidiens.be/fr","Voir les possibilités d'aide"]
        };
        tasks.nothing=[need[state.immediateNeed]];
      }
      const all=tasks[issue]||tasks.nothing;
      const step=Math.min(Math.max(0,Number(state.helpStep||0)),all.length-1);
      const task=all[step];
      host.innerHTML='<div class="simple-kicker">Une démarche à la fois</div><h2>'+esc(({nothing:"Je n'ai aucun revenu",refused:"Une aide m'a été refusée",stopped:"Mes allocations ont été arrêtées",administrative:"Une démarche est bloquée"})[issue])+'</h2>'+
        '<section class="guided-one-step"><p class="guided-step-count">Piste '+(step+1)+' sur '+all.length+'</p><h3>'+esc(task[0])+'</h3><p>'+esc(task[1])+'</p>'+
        feasibleAction('help-'+issue+'-'+(state.immediateNeed||'')+'-'+step,task[2],task[3])+ 
        actionGuide(issue==="nothing"?(state.immediateNeed||"other"):issue)+
        '<div class="guided-actions">'+(step+1<all.length?'<button type="button" data-help-next>Cette piste ne convient pas — une autre</button>':'')+
        '<button type="button" data-lost-rights-next>'+((state.lostRightsIndex||0)+1<(state.lostRightsQueue||[]).length?'Passer à une autre situation':'Revenir à mes situations')+'</button>'+
        '<button type="button" data-lost-rights-reselect>Modifier mes réponses</button></div></section>';
      showScreen("simpleDifficultHelp");return;
    }

    // Sources vérifiées manuellement pour les deux refus (CPAS + ONEM).
    // Les liens de la base officielle restent prioritaires pour les autres situations.
    const refusalSources={
      article60_info:{url:"https://www.actiris.brussels/fr/citoyens/contrat-emploi-dinsertion/"},
      article57_law:{url:"https://refli.be/fr/lex/1976D70810"},
      article57_request:{url:"https://www.droitsquotidiens.be/fr/question/comment-demander-laide-sociale-au-cpas"},
      ale_actiris:{url:"https://www.actiris.brussels/fr/citoyens/contrat-agence-locale-pour-l-emploi/"},
      phare_aids:{url:"https://www.handicap.brussels/fr/themes/le-travail/le-travail-dans-le-milieu-ordinaire/les-aides-a-lemploi/les-aides-a-lemploi-du-service-phare"},
      student_at_work:{url:"https://www.studentatwork.be/fr/index.html"},
      actiris_training:{url:"https://www.actiris.brussels/fr/employeurs/former-pour-recruter/"},
      job_plus:{url:"https://www.wallonie.be/fr/actualites/job-plus-un-nouvel-incitant-lembauche"},
      first_hire_onss:{url:"https://emploi.belgique.be/fr/themes/emploi-et-marche-du-travail/mesures-demploi/reduction-premiers-engagements"},
      acs_official:{url:"https://www.actiris.brussels/fr/citoyens/agents-contractuels-subventionnes/"},
      appeal_cpas:{url:"https://www.mi-is.be/sites/default/files/documents/guide_du_recours_contre_la_decision_du_cpas_1_0.pdf"},
      appeal_onem:{url:"https://www.onem.be/index.php/citoyens/chomage-complet/comment-devez-vous-demander-les-allocations-/comment-votre-dossier-sera-t-il-traite"},
      appeal_court:{url:"https://www.rechtbanken-tribunaux.be/fr/node/3801"},
      legal_aid:{url:"https://www.justice.belgium.be/fr/besoin_dun_avis_juridique"},
      fdss_help:{url:"https://www.fdss.be/fr/membres/allo-aide-sociale-numero-gratuit-bruxelles-0800-35-243/"},
      fdss_food:{url:"https://www.fdss.be/fr/caa/repertoire-de-l-aide-alimentaire/"},
      inami_sick:{url:"https://www.inami.fgov.be/fr/themes/incapacite-de-travail/salaries-et-chomeurs/declarer-son-incapacite-de-travail"},
      arr_disability:{url:"https://handicap.belgium.be/fr/allocations/allocation-de-remplacement-de-revenus"},
      grapa_seniors:{url:"https://www.sfpd.fgov.be/fr/droit-a-la-pension/grapa"},
      actiris_register:{url:"https://www.actiris.brussels/fr/citoyens/comment-minscrire-ou-me-reinscrire/"},
      actiris_fpie:{url:"https://www.actiris.brussels/fr/citoyens/formation-professionnelle-en-entreprise"},
      actiris_fpie_employer:{url:"https://www.actiris.brussels/fr/employeurs/formation-professionnelle-individuelle-en-entreprise/"},
      actiris_activa_end:{url:"https://www.actiris.brussels/fr/citoyens/details-d-une-news/20735-abrogation-de-la-mesure-activa-brussels-ce"},
      food_croixrouge:{url:"https://a-aide-alimentaire.croix-rouge.be/epiceries-sociales/"},
      food_fdss:{url:"https://www.fdss.be/fr/caa/repertoire-de-l-aide-alimentaire/"},
      caami_join:{url:"https://www.caami-hziv.fgov.be/fr/membres/devenir-membre/commande-de-formulaire-dinscription"},
      caami_public:{url:"https://www.caami-hziv.fgov.be/fr/pro/devenir-membre"},
      inami_insured:{url:"https://www.inami.fgov.be/fr/themes/soins-de-sante-cout-et-remboursement/assurabilite"},
      inami_rates_2026:{url:"https://www.inami.fgov.be/fr/themes/soins-de-sante-cout-et-remboursement/assurabilite/cotisation-personnelle-pour-etre-assure-si-vous-ne-payez-pas-de-cotisations-sociales"},
      inami_dependant:{url:"https://www.inami.fgov.be/fr/themes/soins-de-sante-cout-et-remboursement/assurabilite/votre-droit-au-remboursement-de-soins-en-tant-que-personne-a-charge"},
      eID_no_phone:{url:"https://sma-help.bosa.belgium.be/fr/management/identity/Eid"},
      epn_access:{url:"https://www.bruxelles.be/ou-trouver-des-espaces-publics-numeriques-epn"},
      itsme_sms:{url:"https://www.itsme-id.com/fr-BE/get-started/eid"},
      itsme_change_number:{url:"https://support.itsme-id.com/hc/fr/articles/360053148953-Modifier-num%C3%A9ro-de-t%C3%A9l%C3%A9phone"},
      csam_keys:{url:"https://www.csam.be/fr/profil-egov.html"},
      csam_email_guide:{url:"https://bosa.belgium.be/sites/default/files/documents/activer_une_cle_numerique-e-mail_otp.pdf"},
      csam_eid_steps:{url:"https://www.bruxelles.be/comment-vous-connecter-avec-votre-carte-didentite-electronique-eid"},
      itsme_sms_confirm:{url:"https://www.itsme-id.com/fr-BE/get-started/eid"},
      samu_web:{url:"https://0800.samusocial.be/"},
      samu_help:{url:"https://samusocial.be/help/"},
      mdm_care:{url:"https://medecinsdumonde.be/j-ai-besoin-de-voir-un-medecin"},
      mdm_caso:{url:"https://medecinsdumonde.be/projets/centre-daccueil-de-soins-et-dorientation-caso-bruxelles"},
      fedasil_reception:{url:"https://fedasil.be/fr/asile-en-belgique/accueil-des-demandeurs-dasile"},
      fedasil_contact:{url:"https://fedasil.be/fr/contact"},
      fedasil_registration:{url:"https://www.fedasilinfo.be/fr/enregistrement-de-votre-demande"},
      fedasil_waitlist:{url:"https://www.fedasilinfo.be/fr/senregistrer-pour-une-place-daccueil"},
      amu_official:{url:"https://www.socialsecurity.be/citizen/fr/assistance-sociale-et-cpas/aide-pour-les-frais-medicaux"}
    };
    const safeLink=(key,label)=>{
      const source=sources[key]||refusalSources[key];
      if(!source||typeof source.url!=="string"||!/^https:\/\//i.test(source.url))return "";
      return '<a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(label||source.label||"Ouvrir la source officielle")+' ↗</a>';
    };
    // Chaque piste renvoie à une source officielle déjà référencée dans la base.
    // Aucune réponse ne permet de déduire automatiquement l'ouverture d'un droit.
    const guides={
      urgent_food:[
        ["Trouver une distribution alimentaire","Dans le répertoire FDSS, choisissez votre commune puis les filtres colis, repas ou épicerie sociale. Chaque organisme précise ses critères : un refus du RIS n'entraîne pas automatiquement un refus d'aide alimentaire. Vérifiez l'accueil et les horaires avant le déplacement.",[["fdss_food","Répertoire des distributions et épiceries"]]],
        ["Sans téléphone, demander par e-mail","Écrivez à aidealimentaire@fdss.be en donnant la commune, le besoin urgent et le fait que vous ne pouvez pas téléphoner. Sans e-mail, demandez les modalités directement à une association du répertoire. Une place n'est pas garantie.",[["fdss_food","Coordonnées des organismes alimentaires"]]],
        ["Si l'accès à une épicerie est refusé","Demandez quels justificatifs sont acceptés et s'il existe une distribution, un restaurant social ou une autre structure. Un service associatif peut parfois établir l'orientation sociale, selon le règlement de l'épicerie.",[["food_croixrouge","Conditions des épiceries sociales"],["fdss_food","Autres solutions alimentaires"]]]
      ],
      urgent_shelter:[
        ["Demander une nuit au Samusocial","À Bruxelles, l'hébergement est gratuit, sans exigence de séjour régulier. Inscription annoncée entre 9 h et 15 h par le site ou au 0800 99 340. Une inscription ne garantit pas une place : confirmez les modalités du jour.",[["samu_web","S'inscrire par Internet"],["samu_help","Mode d'emploi Samusocial"]]],
        ["Sans téléphone ni SMS","L'inscription web est possible avec Internet. Si vous empruntez un téléphone, notez le code d'inscription ; vous pouvez rappeler le 0800 99 340 avec ce code pour savoir si une place a été attribuée. Les équipes sont joignables 24 h/24.",[["samu_help","Suivre son inscription sans GSM personnel"]]],
        ["Si la demande n'aboutit pas","Demandez au Samusocial les possibilités de réorientation et signalez les vulnérabilités particulières. Aucune place n'est garantie. En cas de danger médical immédiat, appelez le 112.",[["samu_help","Contacter l'équipe et comprendre les limites"]]]
      ],
      urgent_care:[
        ["Voir un généraliste sans couverture : Athéna","À Bruxelles, Centre Athéna, boulevard Bischoffsheim 31, 1000 Bruxelles ; 02 244 53 02 ; accueil@athenabrussels.be. Médecins du Monde indique un accueil possible sans rendez-vous, selon la disponibilité. Si urgence vitale : 112.",[["mdm_care","Adresse, horaires et accès à Athéna"]]],
        ["CASO : soin sur rendez-vous et aide aux droits","Rue Botanique 75, 1210 Bruxelles, 02 225 43 13. Le CASO de Médecins du Monde oriente les personnes exclues des soins. Attention : pas de consultation médicale sans rendez-vous au CASO.",[["mdm_care","Permanence téléphonique CASO"],["mdm_caso","Présentation du centre de soins"]]],
        ["Rétablir les remboursements en parallèle","La fin du chômage n'interrompt pas toujours immédiatement les droits aux soins. Interrogez l'ancienne mutualité ou la CAAMI ; une cotisation personnelle nulle existe sous conditions. Ne retardez pas une consultation nécessaire pour cela.",[["inami_affiliation","Conditions de couverture"],["caami_join","CAAMI : recevoir un formulaire"]]]
      ],
      urgent_income:[
        ["Chercher un emploi même sans allocations","L'inscription comme demandeur d'emploi chez Actiris ne suppose pas de toucher le chômage. Pour certains candidats, la FPIE peut aider un employeur à former puis engager ; contactez Bruxelles Formation AVANT de commencer.",[["actiris_register","Inscription Actiris et antennes"],["actiris_fpie","FPIE : conditions"]]],
        ["Préserver les besoins essentiels en attendant","Pour manger immédiatement, cherchez distribution ou restaurant social dans le répertoire FDSS. Les organismes vérifient eux-mêmes les critères et les capacités.",[["fdss_food","Trouver une aide alimentaire"]]],
        ["Si CPAS et chômage ont déjà dit non","N'introduisez pas une nouvelle première demande CPAS sans vérifier votre situation. Faites étudier les refus, leur date et les possibilités de recours ; le parcours « CPAS et chômage : deux refus » détaille les autres droits.",[["legal_aid","Aide juridique indépendante"],["appeal_court","Recours sociaux"]]]
      ],
      article_60_61:[
        ["Vérifier si l’emploi d’insertion vous concerne","À Bruxelles, le contrat emploi d’insertion exige notamment le RIS ou une aide financière équivalente, une inscription au registre de la population ou des étrangers et l’absence de droit au chômage complet. Le CPAS est l’employeur juridique ; être inscrit chez Actiris ne suffit pas.",[["article60_info","Conditions officielles Actiris"]]],
        ["Si vous remplissez les conditions, demander le service emploi du CPAS","Demandez au département emploi de votre CPAS de vérifier la possibilité d’un contrat emploi d’insertion article 60 §7. Le CPAS peut vous employer ou vous mettre à disposition d’un partenaire, parfois dans le cadre de l’article 61. Ce n’est pas un droit automatique.",[["article60_info","Comment faire la demande"]]],
        ["Si vous avez reçu un refus CPAS","Ne recommencez pas une première demande. Demandez les motifs écrits et vérifiez les recours possibles. Si l’article 60 n’est pas accessible, explorez séparément ACS et FPIE.",[["article60_info","Conditions article 60"],["legal_aid","Aide juridique"]]]
      ],
      a6_j6:[
        ["Trouver l’offre ACS concernée","L’appellation A6/J6 apparaît notamment dans d’anciennes procédures administratives des emplois ACS. Aujourd’hui, Actiris demande une attestation d’éligibilité liée à l’offre. Elle n’est pas un statut général donnant droit à une prime pour toute embauche.",[["acs_official","Actiris : conditions des offres ACS"]]],
        ["Demander la vérification à Actiris","Si vous habitez Bruxelles et êtes inscrit comme chercheur d’emploi inoccupé, contactez Actiris au sujet de l’offre ACS précise. Actiris vérifie les conditions supplémentaires et place, si vous êtes éligible, l’attestation dans My Actiris.",[["acs_official","Attestation dans My Actiris"]]],
        ["Si vous n'êtes pas éligible à cette offre","Demandez quel critère bloque l’attestation. D’autres offres ACS peuvent avoir des conditions différentes ; explorez la FPIE séparément.",[["acs_official","Autres offres ACS"],["actiris_fpie","FPIE"]]]
      ],
      article_57:[
        ["Identifier l’aide dont vous avez besoin","L’article 57 de la loi organique des CPAS définit la mission générale d’aide sociale : aide matérielle, médicale, sociale ou psychologique. Ce n’est pas une attestation d’embauche ni une allocation unique à obtenir.",[["article57_law","Texte légal de l’article 57"]]],
        ["Faire une demande précise d’aide sociale","Demandez au CPAS compétent une aide concrète (par exemple aide alimentaire, médicale ou matérielle), en précisant votre besoin. La demande peut être présentée sur place ou par écrit ; conservez un accusé de réception. CPAS Online est réservé aux premières demandes.",[["article57_request","Comment demander l’aide sociale"]]],
        ["Si le CPAS a déjà refusé","Ne refaites pas automatiquement une première demande. Vérifiez ce qui a été refusé, les motifs et le délai de recours. Une demande concernant un besoin distinct doit être examinée selon les conditions applicables ; l’octroi n’est pas garanti.",[["article57_request","Démarches et suivi"],["legal_aid","Aide juridique"]]]
      ],
      ale_work:[["Vérifier vos conditions ALE","À Bruxelles, du 1er mars 2026 au 28 février 2027, les chercheurs d'emploi inoccupés inscrits depuis au moins 12 mois (6 mois dès 45 ans) peuvent aussi accéder à l'ALE, même sans allocation, selon les autres conditions applicables. Les règles sont différentes en Wallonie.",[["ale_actiris","ALE : conditions Actiris"]]],["Contacter l'ALE de votre commune","L'ALE propose certaines activités de proximité. Demandez les activités autorisées, l'inscription et les conditions de rémunération ; ce n'est pas un emploi ordinaire ni une prime générale à l'embauche.",[["ale_actiris","Démarche ALE"]]]],
      handicap_employment:[["Vérifier si une reconnaissance PHARE vous concerne","À Bruxelles, l'admission au Service PHARE peut donner accès à des aides d'emploi sous conditions. Une difficulté de santé n'entraîne pas automatiquement cette reconnaissance. Vous n'avez pas à détailler votre diagnostic à EcoTank.",[["phare_aids","Conditions PHARE"]]],["Demander les aides au poste de travail","Si vous êtes admis au PHARE et domicilié à Bruxelles, votre futur employeur peut notamment examiner une prime d'insertion, un tutorat et une adaptation du poste. La demande relève du formulaire officiel et de la décision du PHARE.",[["phare_aids","Aides à l'emploi et formulaires"]]]],
      student_job:[["Vérifier vos heures Student at Work","Les 650 premières heures annuelles sous contrat étudiant peuvent bénéficier de cotisations sociales de solidarité réduites, si les conditions sont remplies.",[["student_at_work","Mon quota et mon attestation"]]],["Télécharger une attestation pour un employeur","Student at Work fournit une attestation du solde des heures à transmettre à un futur employeur. La preuve de la qualité d'étudiant reste nécessaire.",[["student_at_work","Obtenir mon attestation"]]]],
      young_worker:[["Vérifier votre situation à la fin des études","Une inscription comme chercheur d'emploi et le début éventuel du stage d'insertion peuvent être importants. Cela ne signifie pas automatiquement une prime employeur.",[["actiris_register","Vérifier l'inscription"]]],["Examiner Stage First ou la FPIE","À Bruxelles, un stage ou une formation chez l'employeur peut faciliter un recrutement selon âge, expérience et conditions du programme.",[["actiris_training","Formations pour recruter"]]]],
      senior_worker:[["Vérifier les aides actuellement applicables","Ne présumez pas d'une réduction employeur liée uniquement à l'âge : plusieurs mesures régionales ont changé en juillet 2026. Vérifiez votre région et la date d'engagement.",[["actiris_training","Solutions formation emploi"]]],["Vérifier la FPIE ou l'ALE","À Bruxelles, l'ALE prévoit des conditions de durée d'inscription adaptées dès 45 ans ; la FPIE peut aussi être une piste selon votre situation.",[["ale_actiris","ALE et âge"]]]],
      long_unemployed:[["Vérifier votre durée d'inscription","La durée d'inscription peut ouvrir certaines mesures, y compris l'ALE bruxelloise en 2026. Le critère varie selon la région et le dispositif.",[["ale_actiris","Vérifier l'ALE"]]],["Demander quelles aides sont liées à votre dossier","Selon la région, vérifier FPIE, emplois ACS ou Job Plus en Wallonie, sans supposer que le seul temps sans emploi suffit.",[["job_plus","Job Plus Wallonie"],["actiris_fpie","FPIE Bruxelles"]]]],
      first_hire:[["Vérifier si l'entreprise peut bénéficier de la réduction premier engagement","Cette réduction de cotisations concerne l'historique de recrutement de l'employeur, pas un statut personnel du candidat. Elle peut être importante même si vous n'avez aucune attestation particulière.",[["first_hire_onss","Conditions premiers engagements"]]],["Proposer à l'employeur de faire vérifier son éligibilité","Demandez à son secrétariat social de confirmer le rang d'engagement et les autres conditions ONSS avant de compter cet avantage dans le coût du recrutement.",[["first_hire_onss","Procédure ONSS"]]]],
      no_status:[["Votre absence de statut n'empêche pas toute aide","Commencez par regarder si l'employeur est admissible à la réduction premiers engagements. Cette aide dépend de sa situation, pas de votre âge ou de vos allocations.",[["first_hire_onss","Réduction premiers engagements"]]],["Vérifier votre inscription et votre ancienneté","Si vous êtes inscrit chez Actiris, le nombre de mois d'inscription peut rendre certaines pistes possibles, dont l'ALE en 2026. N'inventez pas une attestation que vous n'avez pas.",[["ale_actiris","Conditions ALE"]]],["Explorer une formation chez l'employeur","Même sans réduction liée au profil, la FPIE peut permettre de se former avant une embauche, sous conditions vérifiées avec Bruxelles Formation.",[["actiris_fpie","Conditions FPIE"]]]],
      employer_aid:[
        ["Vérifier mon éligibilité aux emplois ACS","Si vous êtes domicilié à Bruxelles et inscrit comme chercheur d’emploi inoccupé chez Actiris, regardez les offres ACS. Chaque offre peut avoir des conditions supplémentaires. Actiris vérifie votre éligibilité ; l’attestation ACS est indispensable avant l’entretien et le contrat.",[["acs_official","Actiris : offres ACS et attestation"]]],
        ["Vérifier une FPIE auprès d'un employeur","La FPIE permet à un employeur de vous former avant une embauche. Ce n'est pas une attestation ACS ou Activa ; les conditions sont vérifiées avec Bruxelles Formation avant la formation.",[["actiris_fpie_employer","FPIE : avantages et conditions"]]],
        ["Autres aides : vérifier celles de l'employeur","Certaines réductions ONSS, comme les premiers recrutements, dépendent surtout de l'entreprise : elles ne créent pas un statut personnel. Activa.brussels ne délivre plus de nouvelle attestation depuis le 15 juillet 2026.",[["actiris_activa_end","Fin des nouvelles attestations Activa"],["acs_official","ACS : conditions"]]]
      ],
      actiris_no_income:[
        ["Vérifier si une FPIE peut faciliter votre embauche","La FPIE permet à une entreprise de vous former 4 semaines à 6 mois, avec engagement ensuite sous conditions. Vous devez notamment être inscrit comme chercheur d’emploi inoccupé. Contactez Bruxelles Formation avant de commencer.",[["actiris_fpie","Vérifier les conditions FPIE"]]],
        ["Présenter la FPIE à un employeur","Vous pouvez parler de la FPIE lors d'un entretien. L'employeur peut former un candidat en versant une indemnité de formation plutôt qu'un salaire habituel pendant la formation. Une prime spécifique peut exister pour un candidat bruxellois non indemnisé, de diplôme au plus CESS. Ce n'est pas une attestation Activa.",[["actiris_fpie_employer","FPIE : informations pour l'employeur"]]],
        ["Si la FPIE ne convient pas","Votre inscription Actiris reste valable. Vérifiez d'autres possibilités de stages et formations adaptées à votre situation ; le dispositif Activa pour nouveaux engagements est supprimé depuis le 15 juillet 2026.",[["actiris_activa_end","Activa supprimé : annonce officielle"],["actiris_register","Services Actiris"]]]
      ],
      no_job:[
        ["Vérifier votre inscription comme chercheur d'emploi","L'inscription chez Actiris permet d'accéder aux offres, formations et accompagnements même sans toucher d'allocations.",[["actiris_register","M'inscrire ou vérifier mon inscription"]]],
        ["Examiner une formation directement chez un employeur","La FPIE peut ouvrir un chemin vers un emploi si vous remplissez les conditions et trouvez une entreprise intéressée.",[["actiris_fpie","Conditions FPIE"]]],
        ["Trouver un autre accompagnement à l'emploi","Actiris donne accès à des services d'accompagnement, aux offres et aux formations. L'ancienne mesure Activa n'est plus accessible aux nouveaux engagements.",[["actiris_register","Services Actiris"]]]
      ],
      urgent_refusal:[
        ["Repérer la date limite du recours","Rassemblez la décision écrite, sa date de notification et le motif du refus. Les recours devant le tribunal du travail sont généralement possibles dans les 3 mois ; faites contrôler le délai propre à votre décision.",[["appeal_court","Recours devant le tribunal du travail"]]],
        ["Accéder à un avis juridique gratuit","Un premier avis juridique est gratuit ; un avocat peut être désigné gratuitement ou à faible coût selon les ressources. Apportez les refus du CPAS, chômage ou autres institutions.",[["legal_aid","Demander une aide juridique"]]],
        ["Si le refus n'a été donné qu'oralement","Demandez une décision datée et motivée, sans attendre pour vérifier vos possibilités de recours. Le recours ne garantit pas le versement d'un revenu entre-temps.",[["appeal_cpas","Guide des recours CPAS"],["appeal_onem","Procédure ONEM"]]]
      ],
      urgent_access:[
        ["Si eID et lecteur fonctionnent : ne pas refaire itsme","Sur un service compatible, choisissez CSAM et « Identification avec lecteur de cartes eID », puis utilisez votre PIN. Vous n'avez pas besoin de recevoir de SMS pour cette connexion.",[["csam_keys","Gérer les clés CSAM"]]],
        ["Si vous avez accès à une adresse e-mail","Une clé CSAM avec code par e-mail peut être activée avec l'eID et servir sur certains portails, pas tous. Sans e-mail, n'essayez pas cette méthode.",[["csam_email_guide","Créer une clé par e-mail"]]],
        ["S'il manque téléphone, lecteur, carte ou PIN","Utilisez le guide « Impossible de me connecter » pour votre blocage précis. Des guichets, procédures papier et bureaux d'enregistrement existent selon le service ; évitez de racheter un appareil avant d'avoir vérifié.",[["brussels_digital_help","Aide numérique en Belgique"]]]
      ],
      urgent_asylum:[
        ["Pour déposer une nouvelle demande de protection","L'Office des étrangers enregistre les demandes à Bruxelles, rue Belliard 68 (vérifiez les modalités et heures actuelles). Le Petit-Château n'enregistre plus directement la première demande.",[["fedasil_registration","Où enregistrer une demande de protection"]]],
        ["Fedasil : demander l'accueil matériel","Après l'enregistrement, Fedasil examine le droit à l'accueil et aux soins, distinct d'une allocation CPAS. L'attribution dépend des conditions et des capacités, sans garantie de place immédiate.",[["fedasil_reception","Accueil des demandeurs d'asile"]]],
        ["Sans place malgré l'enregistrement : liste d'attente","Si l'accueil n'a pas été attribué après l'enregistrement, Fedasil prévoit une inscription sur liste d'attente. Vérifiez la procédure officielle : les réponses peuvent arriver par e-mail. Selon la situation, des soins et une assistance juridique restent accessibles pendant l'attente ; sans e-mail, demandez une voie de contact au Point Info. Aucune place immédiate garantie.",[["fedasil_waitlist","S'inscrire sur la liste d'attente Fedasil"],["fedasil_contact","Point Info Fedasil et contact"]]]
      ],
      urgent_irregular:[
        ["Se soigner sans attendre de documents","À Bruxelles, Athéna peut accueillir des personnes sans autre accès au médecin et le CASO oriente les personnes sans couverture (sur rendez-vous pour consultation). En urgence vitale, appelez le 112.",[["mdm_care","Athéna et CASO : comment obtenir des soins"]]],
        ["Aide médicale urgente (AMU)","Une personne sans séjour légal et sans moyens peut demander l'AMU pour ses soins. Elle passe légalement par le CPAS compétent, même après un refus du RIS : ce sont deux droits distincts. Les conditions et soins éligibles doivent être vérifiés.",[["amu_official","Conditions légales de l'AMU"]]],
        ["Si vous n'avez pas de toit","Le Samusocial accepte les demandes de nuit même en séjour irrégulier, sous réserve de places. Inscription par Internet si vous n'avez pas de numéro GSM personnel.",[["samu_web","Demander une nuit au Samusocial"],["samu_help","Conditions de l'accueil"]]]
      ],
      overview:[
        ["Commencer par une aide humaine et concrète","Si vous n'arrivez plus à faire face aux besoins essentiels, demandez à un service social de faire le point avec vous. N'attendez pas d'avoir tous vos documents.",[["cpas_dis_procedure","Comprendre les démarches auprès du CPAS"]]],
        ["Ne pas perdre l'accès aux soins","Vérifiez votre affiliation ou les démarches pour la rétablir, indépendamment de vos autres droits.",[["inami_affiliation","Mutualité ou CAAMI"]]],
        ["Remettre en ordre ce qui bloque","Une adresse administrative incertaine peut empêcher d'autres démarches. C'est un problème à traiter, pas une raison d'arrêter la recherche.",[["reference_address","Adresse de référence et aides"]]]
      ],
      refusals:[
        ["Faire valoir sa candidature auprès d'un employeur","Inscrivez-vous ou vérifiez votre inscription comme chercheur d'emploi chez Actiris, même sans allocation. Demandez un justificatif d'inscription. Proposez la FPIE à un employeur : formation rémunérée par indemnité de formation, suivie d'un contrat de travail d'au moins la même durée. Une prime FPIE existe sous conditions pour l'employeur recrutant ensuite un candidat bruxellois non indemnisé et au plus diplômé du CESS. Contactez Bruxelles Formation AVANT de commencer. ATTENTION : aucune nouvelle attestation activa.brussels n'est délivrée depuis le 15 juillet 2026.",[["actiris_register","S'inscrire chez Actiris, y compris en antenne"],["actiris_fpie","FPIE : mode d'emploi pour le candidat"],["actiris_fpie_employer","FPIE et prime : fiche à montrer à l'employeur"],["actiris_activa_end","Pourquoi activa.brussels n'existe plus"]]],
        ["Accéder à une épicerie sociale sans décision positive du CPAS","L'accès n'est pas automatique : chaque épicerie vérifie les ressources et peut demander une orientation par un service social compétent. Un service social associatif, et pas uniquement le CPAS, peut aider à évaluer la demande et à chercher une orientation. Présentez les preuves d'absence de revenus et de refus si vous les avez ; demandez quels autres justificatifs sont acceptés si vous ne les avez pas. Vérifiez toujours les places et les conditions d'accueil auprès de la structure. Le répertoire FDSS propose aussi un contact e-mail : aidealimentaire@fdss.be.",[["food_fdss","Répertoire et contacts des aides alimentaires"],["food_croixrouge","Épiceries sociales Croix-Rouge : accès sur orientation"]]],
        ["Retrouver des remboursements de soins sans chômage ni RIS","Demandez à votre ancienne mutualité de vérifier d'abord si vos remboursements sont encore ouverts : la fin du chômage ne met pas toujours immédiatement fin aux soins. Sinon, examinez une affiliation comme résident avec faibles ou nuls revenus, éventuellement une cotisation personnelle de 0 € si les conditions INAMI sont remplies, ou une affiliation comme personne à charge si vous êtes éligible. La CAAMI ne demande pas de cotisation complémentaire, mais les conditions de l'assurance obligatoire continuent de s'appliquer. Formulaires CAAMI possibles par courrier postal : itsme n'est pas nécessaire pour toute la procédure.",[["inami_insured","Vérifier si les soins restent remboursés"],["inami_rates_2026","Cotisation résident : barèmes et possibilité de 0 €"],["caami_join","Demander les formulaires CAAMI par la poste"],["inami_dependant","Vérifier le droit comme personne à charge"]]],
        ["Utiliser le lecteur eID déjà fonctionnel, même sans numéro de téléphone","Si le lecteur eID et le code PIN fonctionnent, ne réinstallez rien et n'essayez pas d'activer itsme pour commencer. Sur le portail public visé, choisissez Se connecter, puis CSAM et Identification avec un lecteur de cartes eID. Aucun SMS ni numéro de GSM n'est nécessaire pour cette connexion, même sans numéro actif. Si vous disposez d'une adresse e-mail, la clé numérique CSAM Code de sécurité par e-mail peut aussi être activée avec l'eID : elle ne fonctionnera que sur les services qui l'acceptent. Si un service impose exclusivement itsme, cherchez sa démarche en personne, par courrier ou auprès de son assistance ; la connexion eID ne contourne pas une exigence itsme.",[["csam_eid_steps","Se connecter directement avec l'eID : étapes officielles"],["csam_keys","Gérer mes clés numériques CSAM"],["csam_email_guide","Activer la clé Code de sécurité par e-mail"],["actiris_register","Actiris : démarches possibles en antenne"]]],
        ["Contester les refus à temps","Conservez les refus écrits, dates et motifs. Un recours auprès du tribunal du travail est généralement possible dans les 3 mois de la notification : faites vérifier chaque délai sans attendre. Si la réponse n'était qu'orale, demandez une décision écrite. Faire un recours ne garantit ni son succès ni une aide en attendant.",[["appeal_court","Informations sur le tribunal du travail"],["appeal_cpas","Guide des recours CPAS"],["legal_aid","Aide juridique de première ligne et avocat"]]],
        ["Si les besoins essentiels ne peuvent pas attendre","Un service social associatif peut rechercher une aide matérielle ou alimentaire, même quand le CPAS n'a pas attribué de RIS. À Bruxelles, Allo Aide Sociale est joignable au 0800 35 243 depuis un téléphone disponible ; si vous n'avez pas de ligne, utilisez le répertoire FDSS par e-mail ou allez dans un service associatif de proximité. Il faut vérifier les modalités et places disponibles. Ces aides ne sont pas une allocation mensuelle garantie.",[["fdss_food","Trouver une association d'aide alimentaire"],["fdss_help","Allo Aide Sociale — information et orientation"]]],
        ["Ne pas oublier les autres droits, uniquement si la situation correspond","Selon les conditions de santé, de handicap ou d'âge, des indemnités de mutualité, l'allocation de remplacement de revenus ou la GRAPA peuvent être examinées séparément. La seule absence de revenus ne suffit pas pour ouvrir ces droits.",[["inami_sick","INAMI : incapacité de travail"],["arr_disability","Allocation de remplacement de revenus"],["grapa_seniors","GRAPA"]]]
      ],
      employment_no_income:[
        ["Obtenir un justificatif Actiris, même sans allocations","L'inscription Actiris est gratuite et distincte du chômage. Une première inscription se fait sur My Actiris ou en antenne avec rendez-vous. Sans itsme ou GSM, renseignez-vous auprès d'une antenne sur les modalités d'accès physique ; pour certaines réinscriptions et attestations, il existe aussi des permanences sans rendez-vous.",[["actiris_register","Inscription et attestations Actiris"]]],
        ["Présenter une FPIE comme avantage réel au recruteur","La FPIE permet à l'entreprise de former le candidat de 4 semaines à 6 mois moyennant indemnité de formation, sans cotisations patronales sur celle-ci, puis de l'engager pour au moins la durée de la formation. Le dossier se prépare avec Bruxelles Formation avant le début. Sous conditions, un employeur peut recevoir une prime FPIE pour un candidat non indemnisé et peu qualifié. Contact FPIE : fpie@bruxellesformation.brussels.",[["actiris_fpie","Conditions FPIE pour le candidat"],["actiris_fpie_employer","Informations et prime pour l'employeur"]]],
        ["Ne pas demander une attestation activa.brussels","Depuis le 15 juillet 2026, activa.brussels, activa.brussels plus et aptitude réduite ont été supprimés pour les nouvelles embauches. Aucune nouvelle attestation n'est délivrée. La prime FPIE est un dispositif distinct.",[["actiris_activa_end","Annonce officielle de suppression"]]]
      ],
      food_social:[
        ["Faire évaluer l'accès par un service social associatif","Les épiceries sociales appliquent leurs propres critères et peuvent exiger une orientation par un organisme social compétent. Même si le CPAS a refusé un revenu d'intégration, un service associatif peut examiner la situation et demander comment orienter la personne. Ce n'est pas un droit automatique sur seule déclaration.",[["food_croixrouge","Critères d'accès Croix-Rouge"],["food_fdss","Répertoire des structures et coordonnées"]]],
        ["Demander une aide alimentaire même sans attestations complètes","Expliquez l'absence de revenus et demandez quels documents peuvent remplacer l'attestation CPAS : preuve de refus, déclaration de situation, charges du ménage, etc. La structure décide selon ses conditions. Avant de se déplacer, contactez-la, car les places et horaires varient. FDSS : aidealimentaire@fdss.be ; Bruxelles : 0800 35 243 si un téléphone est accessible.",[["food_fdss","Repérer un service associatif ou une distribution"]]]
      ],
      care_zero:[
        ["Ne pas conclure qu'il n'y a plus de mutuelle","Demandez à la mutualité actuelle si l'assurabilité est encore ouverte. L'INAMI précise qu'après la fin des allocations chômage, le remboursement des soins est souvent conservé pendant une période déterminée. Il faut vérifier le dossier individuel.",[["inami_insured","Droit aux soins après le chômage"]]],
        ["Affiliation de résident et cotisation éventuellement nulle","Sans cotisations via un emploi ou chômage, la mutualité peut examiner les règles d'assurance personnelle. Les barèmes INAMI de 2026 prévoient sous conditions une cotisation trimestrielle de 0 € pour certaines personnes résidentes aux très faibles revenus. Ce n'est pas automatique.",[["inami_rates_2026","Lire les conditions et barèmes INAMI"]]],
        ["CAAMI ou personne à charge","La CAAMI est une alternative sans cotisation complémentaire et permet de demander des formulaires par courrier ; elle n'annule pas les conditions légales de l'assurance obligatoire. Une inscription à charge d'un conjoint ou cohabitant assuré est possible seulement si les critères sont respectés.",[["caami_public","Affiliation CAAMI"],["caami_join","Formulaires par courrier"],["inami_dependant","Conditions personne à charge"]]]
      ],
      eid_works_no_phone:[
        ["Se connecter avec l'eID existante, sans itsme","Le lecteur de carte fonctionne déjà : il n'y a rien à acheter ni à réactiver. Sur un portail public qui propose CSAM, choisissez Identification avec un lecteur de cartes eID, puis utilisez votre code PIN. Il n'y a pas de vérification par SMS ni de numéro de téléphone à fournir. Attention : se connecter à CSAM avec eID n'active pas itsme.",[["csam_eid_steps","Mode d'emploi officiel : connexion eID"],["csam_keys","Accéder aux clés numériques CSAM"]]],
        ["Activer une clé de secours reçue par e-mail","Avec le lecteur eID fonctionnel et une adresse e-mail accessible, allez dans Mes clés numériques CSAM et activez Code de sécurité par e-mail. Une fois créé, ce moyen permet une connexion sans téléphone sur certains services, mais pas ceux qui exigent un niveau de sécurité supérieur ou imposent itsme.",[["csam_email_guide","Tutoriel officiel : code par e-mail"],["csam_keys","Activer une clé numérique"]]],
        ["Si le service exige itsme seulement","Un lecteur eID, même parfaitement fonctionnel, ne permet pas de finaliser l'activation itsme sans numéro recevant le SMS requis. Ne recommencez pas la procédure en boucle. Contactez le service concerné pour une alternative au guichet, par courrier ou par un autre canal d'identification. Pour Actiris, une antenne constitue une voie d'accès ; la première inscription exige normalement un rendez-vous.",[["itsme_sms_confirm","itsme : étape de confirmation SMS"],["actiris_register","Actiris : modalités en antenne"]]]
      ],
      no_phone:[
        ["Pas de SMS : vérifier si une eID fonctionne déjà","L'activation itsme requiert un numéro de GSM et un code reçu par SMS, même avec un lecteur eID. Si vous avez déjà une carte eID et un lecteur fonctionnels, choisissez plutôt la rubrique Lecteur eID fonctionnel mais itsme bloqué : aucune nouvelle activation n'est nécessaire pour utiliser la connexion eID sur les services compatibles.",[["csam_keys","Se connecter via CSAM sans itsme"],["csam_eid_steps","Se connecter avec une eID sans itsme"],["itsme_sms_confirm","Pourquoi itsme demande un SMS"]]],
        ["Si la personne a une eID, mais pas de lecteur","La carte eID avec son PIN permet la connexion CSAM sur les services compatibles. Un Espace Public Numérique peut parfois fournir un ordinateur et de l'accompagnement ; vérifiez l'existence d'un lecteur de carte sur place.",[["eID_no_phone","Connexion avec l'eID"],["epn_access","Espaces Publics Numériques"]]],
        ["Sans accès numérique : demander une démarche papier ou en personne","Actiris propose des démarches en antenne et la CAAMI peut envoyer des formulaires papier. La récupération d'une ligne perdue dépend de l'opérateur. Ne donnez jamais votre code PIN ou mot de passe à un accompagnateur.",[["actiris_register","Actiris en présentiel"],["caami_join","CAAMI : formulaires papier"],["itsme_change_number","Numéro perdu et compte itsme"]]]
      ],
      income:[
        ["Demander un examen de votre situation","Sans revenu ou après une interruption de droits, le CPAS peut examiner les aides accessibles selon votre situation. Ce n'est pas une garantie d'attribution.",[["cpas_dis_procedure","Comprendre la procédure CPAS"]]],
        ["Introduire une première demande, si vous n'avez pas déjà de dossier","Deux accès existent, dont un sans identification itsme. Si un dossier est déjà ouvert, reprenez contact avec votre CPAS plutôt que de déposer une nouvelle première demande.",[["cpas_online","Première demande avec identification"],["cpas_online_unsecured","Première demande sans connexion"]]],
        ["Préserver l'accès aux soins","Un droit au revenu suspendu n'implique pas qu'il faille attendre pour vérifier sa couverture santé.",[["inami_affiliation","Vérifier sa couverture santé"]]]
      ],
      housing:[
        ["Dormir en sécurité dès ce soir","Si vous êtes sans hébergement à Bruxelles, inscrivez-vous au Samusocial entre 9 h et 15 h par Internet ou au 0800 99 340 ; une demande ne garantit pas de place. Sans téléphone personnel, le site décrit le suivi grâce au code d'inscription.",[["samu_web","Demander un hébergement"],["samu_help","Inscription et suivi sans GSM personnel"]]],
        ["Autres problèmes de logement et de charges","Un service social peut examiner votre situation, les risques immédiats et les aides envisageables.",[["cpas_dis_procedure","Démarches et aides sociales"]]],
        ["Sans domicile officiel ou en cas d'adresse perdue","Vérifiez la possibilité d'une adresse de référence. Les conditions doivent être examinées au cas par cas.",[["reference_address","Adresse de référence"]]],
        ["Conserver l'accès aux décisions importantes","Si votre courrier est instable, faites le point sur les moyens de recevoir les communications officielles.",[["myebox","My eBox"],["mygov","MyGov.be"]]]
      ],
      health:[
        ["Besoin de soins sans mutuelle : Athéna ou CASO","Médecins du Monde indique des consultations possibles à Athéna sans rendez-vous selon disponibilités, et au CASO sur rendez-vous. En urgence vitale : 112.",[["mdm_care","Soins et coordonnées directement accessibles"]]],
        ["Vérifier ou rétablir la couverture santé","La mutualité ou la CAAMI peut préciser les démarches même sans chômage ou RIS ; sous conditions, une cotisation de résident de 0 € existe.",[["inami_affiliation","Affiliation"],["inami_rates_2026","Cotisation de résident"]]],
        ["Si le séjour irrégulier bloque vos soins","L'aide médicale urgente est une procédure médicale particulière qui peut passer par le CPAS même si un revenu d'intégration a été refusé. Vous pouvez aussi solliciter l'orientation du CASO.",[["amu_official","Conditions de l'aide médicale urgente"],["mdm_caso","CASO"]]]
      ],
      identity:[
        ["Vous ne retrouvez plus votre code PIN eID","La procédure officielle permet de demander un nouveau code. N'indiquez jamais votre code PIN sur EcoTank.",[["belgium_eid_pin","Demander un nouveau PIN"]]],
        ["Vous devez obtenir une attestation","Vérifiez le portail officiel et ses moyens de connexion avant de vous déplacer.",[["mondossier","Mon Dossier — attestations"]]],
        ["L'identification numérique vous bloque","L'activation itsme n'est pas la seule voie possible pour toutes les démarches.",[["itsme_activate","Activer itsme"],["cpas_online_unsecured","Première demande CPAS sans identification"]]]
      ],
      digital:[
        ["Première demande sociale sans itsme","Si c'est une première demande, le formulaire sans connexion peut constituer une solution. Pour un dossier existant, contactez votre CPAS.",[["cpas_online_unsecured","Ouvrir le formulaire sans connexion"]]],
        ["Chercher un accompagnement numérique","À Bruxelles, des structures peuvent aider avec eID, courriels ou formulaires. Ailleurs, renseignez-vous auprès de votre commune ou d'un service social.",[["brussels_digital_help","Aide numérique à Bruxelles"]]],
        ["Récupérer ou activer un accès","Utilisez les pages officielles pour retrouver votre PIN ou activer votre identité numérique.",[["belgium_eid_pin","Nouveau PIN eID"],["itsme_activate","Activer itsme"]]]
      ],
      decision:[
        ["Comprendre la décision et ses délais","Conservez la décision écrite et sa date. Pour une décision CPAS, la procédure officielle explique le cadre applicable; les délais sont à vérifier sans attendre.",[["cpas_dis_procedure","Procédure et décisions CPAS"]]],
        ["Un dossier CPAS est déjà ouvert","Contactez directement le CPAS qui gère votre dossier; n'utilisez pas le lien de première demande comme s'il s'agissait d'un dossier nouveau.",[["cpas_dis_procedure","Informations officielles CPAS"]]],
        ["Conserver les documents officiels","Vérifiez les canaux sur lesquels vos décisions sont disponibles, si vous pouvez y accéder.",[["myebox","Consulter My eBox"]]]
      ],
      bank:[
        ["Sans compte bancaire utilisable","Le service bancaire de base existe sous conditions. Un établissement doit examiner votre demande et les règles applicables.",[["basic_bank","Service bancaire de base"]]],
        ["Vérifier les possibilités alternatives","Le service bancaire universel répond à un autre besoin et ne remplace pas nécessairement le service bancaire de base.",[["universal_bank","Service bancaire universel"]]],
        ["Si l'absence de compte bloque vos aides","Signalez-le à l'organisme ou au service social qui traite votre demande afin d'examiner les possibilités.",[["cpas_dis_procedure","Démarches CPAS"]]]
      ],
      residence:[
        ["En demande de protection et sans accueil ?","Après l'enregistrement auprès de l'Office des étrangers, Fedasil examine le droit à l'accueil matériel, distinct des aides CPAS. Pour un dossier de séjour autre que l'asile, commencez par identifier le titre réel.",[["fedasil_registration","Office des étrangers : enregistrement"],["fedasil_reception","Fedasil : accueil matériel"]]],
        ["Identifier votre situation de séjour","La procédure dépend notamment de votre nationalité et du document réellement détenu. EcoTank ne peut pas décider de votre statut.",[["dofi_union","Citoyens de l'Union européenne"],["dofi_third_country","Ressortissants de pays tiers"]]],
        ["Si vous avez une procédure de protection","Vérifiez les étapes et autorités compétentes, sans déduire automatiquement un droit d'un document.",[["cgra_asylum","Protection internationale — CGRA"]]],
        ["Si vous manquez de ressources ou de soins","Un service compétent doit examiner les possibilités selon votre situation administrative. Certaines aides varient avec le séjour.",[["cpas_dis_procedure","Comprendre la procédure sociale"]]]
      ],
      international:[
        ["Clarifier votre régime spécial","La situation des personnes liées à une mission ou à une organisation internationale relève de règles particulières.",[["diplomacy_special","Statuts spéciaux"],["diplomacy_io","Organisations internationales"]]],
        ["Vérifier quel régime social s'applique","Les situations transfrontalières et internationales requièrent une vérification auprès des autorités compétentes.",[["socialsecurity_international","Coordination internationale"],["coming_to_belgium","Coming to Belgium"]]],
        ["Si la couverture santé pose question","L'organisme compétent dépend de votre régime réel. Ne supposez pas une affiliation belge sans vérification.",[["inami_affiliation","Affiliation en Belgique"]]]
      ]
    };
    const choices=[
      ["urgent_food","Manger / obtenir des courses"],
      ["urgent_shelter","Dormir en sécurité"],
      ["urgent_care","Me soigner"],
      ["urgent_income","Revenus ou emploi"],
      ["actiris_no_income","Inscrit chez Actiris, sans emploi ni allocations"],
      ["employer_aid","Ai-je une attestation ou une aide qui facilite mon embauche ?"],
      ["article_60_61","Article 60 / 61 : emploi d’insertion via le CPAS"],
      ["ale_work","Travailler via une ALE"],
      ["handicap_employment","Handicap ou limitation de travail"],
      ["student_job","Je suis étudiant"],
      ["young_worker","Je suis jeune ou viens de terminer mes études"],
      ["senior_worker","Je suis plus âgé"],
      ["long_unemployed","Sans emploi depuis longtemps"],
      ["first_hire","L'employeur débute ou engage son premier salarié"],
      ["no_status","Je n'ai aucun statut avantageux"],
      ["a6_j6","A6/J6 : attestation pour une offre ACS"],
      ["article_57","Article 57 : demander une aide sociale"],
      ["no_job","Je n’ai pas d’emploi"],
      ["urgent_refusal","Contester un refus"],
      ["urgent_access","Débloquer une démarche"],
      ["urgent_asylum","Protection internationale : sans accueil"],
      ["urgent_irregular","Sans titre de séjour : soins et hébergement"],
      ["refusals","CPAS ET chômage : deux refus, aucun revenu"],
      ["employment_no_income","Je cherche un emploi sans allocations"],
      ["food_social","Accéder à une épicerie sociale"],
      ["care_zero","Retrouver la mutuelle sans revenu"],
      ["eid_works_no_phone","Mon lecteur eID fonctionne, mais itsme refuse sans GSM"],
      ["no_phone","Plus de GSM, de numéro ou d'itsme"],
      ["income","Revenus ou droits coupés"],["housing","Logement ou adresse"],
      ["health","Soins de santé"],["identity","Papiers et eID"],
      ["digital","itsme / démarches en ligne"],["decision","Décision ou recours"],
      ["bank","Compte bancaire"],["residence","Séjour / protection"]
    ];
    const selected=guides[topic]?topic:"overview";
    const cards=guides[selected];
    const urgentIds=new Set(["urgent_food","urgent_shelter","urgent_care","urgent_income","urgent_refusal","urgent_access","no_status"]);
    const firstChoices=choices.filter(([id])=>urgentIds.has(id));
    const otherChoices=choices.filter(([id])=>!urgentIds.has(id));
    const title={
      overview:"De quoi avez-vous besoin aujourd’hui ?",
      urgent_food:"Trouver de quoi manger maintenant",
      urgent_shelter:"Trouver un hébergement pour cette nuit",
      urgent_care:"Recevoir des soins sans couverture",
      urgent_income:"Retrouver des ressources sans attendre",
      actiris_no_income:"Inscrit chez Actiris, sans allocations",
      ale_work:"Travailler via une ALE",
      handicap_employment:"Handicap ou limitation de travail",
      student_job:"Je suis étudiant",
      young_worker:"Je suis jeune ou viens de terminer mes études",
      senior_worker:"Je suis plus âgé",
      long_unemployed:"Sans emploi depuis longtemps",
      first_hire:"L'employeur débute ou engage son premier salarié",
      no_status:"Je n'ai aucun statut avantageux",
      employer_aid:"Quelles aides à l’embauche pour mon profil ?",
      article_60_61:"Article 60 / 61 : contrat emploi d’insertion",
      a6_j6:"A6/J6 : attestation pour les emplois ACS",
      article_57:"Article 57 : demander une aide sociale",
      no_job:"Je cherche un emploi",
      urgent_refusal:"Un refus : vérifier mes recours",
      urgent_access:"Faire une démarche sans itsme ni GSM",
      urgent_asylum:"Protection internationale : accueil et soins",
      urgent_irregular:"Sans titre : soins et hébergement",
      refusals:"Plus de revenus : le CPAS et le chômage ont déjà refusé",
      employment_no_income:"Retrouver un emploi sans allocations",
      food_social:"Accéder à une épicerie sociale",
      care_zero:"Retrouver une couverture santé sans revenu",
      eid_works_no_phone:"Lecteur eID fonctionnel : continuer sans itsme ni SMS",
      no_phone:"Faire des démarches sans numéro de téléphone"
    }[selected]||"Vos premières démarches possibles";

    // Lieux alimentaires dont les coordonnées sont publiées ; admission jamais présumée.
    const FOOD_PLACES={
      "1020":{lat:50.87663,lon:4.3554716,name:"Resto du Cœur de Laeken",address:"Rue Stéphanie 26-32, 1020 Laeken",hours:"Repas chauds : lundi à vendredi, 11 h 30–13 h 30",note:"Colis sur rendez-vous ; confirmer les conditions et la disponibilité.",url:"https://restosducoeur.be/fr/nos-restos/resto-du-coeur-de-laeken"},
      "1060":{lat:50.8292,lon:4.3352,name:"Resto du Cœur de Saint-Gilles",address:"Rue de Bosnie 22, 1060 Saint-Gilles",hours:"Repas chauds : lundi à vendredi, 11 h–13 h",note:"Colis après rendez-vous social ; vérifier l'accueil avant de se déplacer.",url:"https://aiguillages.brussels/precarite/"}
    };
    const FOOD_COMMUNES={"laeken":"1020","saint-gilles":"1060","st gilles":"1060"};
    function foodCode(value){const v=String(value||"").trim().toLowerCase();return FOOD_COMMUNES[v]||(v.match(/\b1[0-2][0-9]{2}\b/)||[])[0]||"";}
    function foodDay(){const d=new Date();if(state.foodDay==="tomorrow")d.setDate(d.getDate()+1);return d;}
    function foodDistance(a,b,c,d){const rad=Math.PI/180;const x=(d-b)*rad*Math.cos((a+c)*rad/2),y=(c-a)*rad;return Math.round(6371*Math.hypot(x,y)*10)/10;}
    function foodCandidates(){const d=foodDay();if(d.getDay()===0||d.getDay()===6)return [];const places=Object.values(FOOD_PLACES);if(state.foodCoords){return places.sort((a,b)=>foodDistance(state.foodCoords.lat,state.foodCoords.lon,a.lat,a.lon)-foodDistance(state.foodCoords.lat,state.foodCoords.lon,b.lat,b.lon));}
      const code=foodCode(state.foodLocation);return places.filter(p=>p===FOOD_PLACES[code]);}
    const compact={
      urgent_food:["Choisissez votre commune dans le répertoire alimentaire.","Sans téléphone, écrivez à aidealimentaire@fdss.be.","Si l'épicerie refuse, cherchez une distribution de colis ou de repas."],
      urgent_shelter:["Demandez une place au Samusocial pour cette nuit. Place non garantie.","Sans GSM, consultez la procédure avec un téléphone emprunté.","Si aucune place, demandez au Samusocial une réorientation."],
      urgent_care:["Demandez une consultation au centre Athéna.","Prenez contact avec le CASO pour un rendez-vous.","Vérifiez vos droits auprès de votre ancienne mutuelle ou de la CAAMI."],
      urgent_refusal:["Repérez la date de notification du refus. Vérifiez vite le délai de recours.","Demandez un avis juridique avec la décision.","Si le refus est oral, demandez une décision écrite et datée."],
      a6_j6:["Repérez une offre ACS qui vous intéresse.","Demandez à Actiris de vérifier votre éligibilité pour cette offre.","Si ce n’est pas possible, explorez d’autres offres ou la FPIE."],
      article_57:["Précisez l’aide sociale dont vous avez besoin.","Introduisez une demande précise au CPAS compétent.","En cas de refus déjà reçu, vérifiez les voies de recours."],
      article_60_61:["Vérifiez les conditions de l’emploi d’insertion auprès d’Actiris.","Si elles sont remplies, contactez le service emploi de votre CPAS.","En cas de refus, vérifiez le motif avant toute nouvelle démarche."],
      employer_aid:["Vérifiez si vous pouvez obtenir une attestation ACS sur My Actiris.","Vérifiez les conditions d’une FPIE à présenter à un employeur.","Certaines réductions dépendent uniquement de l’employeur."],
      actiris_no_income:["Vérifiez les conditions de la FPIE pour travailler en entreprise.","Présentez la FPIE à un employeur potentiel.","Si la FPIE ne convient pas, explorez une autre formation Actiris."],
      no_job:["Vérifiez votre inscription chez Actiris.","Examinez la FPIE pour vous former chez un employeur.","Consultez les autres possibilités de formation et d’accompagnement."],
      urgent_access:["Essayez l'eID et le lecteur via CSAM, sans itsme.","Si vous avez un e-mail, vérifiez la clé CSAM par e-mail.","Sans accès numérique, demandez une procédure papier ou un guichet."]
    };
    const choicesHtml=list=>list.map(([id,label])=>'<button type="button" class="entry-choice" data-help-topic="'+id+'">'+esc(label)+'</button>').join("");
    const choose='<section class="urgent-needs"><h3>De quoi avez-vous besoin ?</h3><div class="urgent-needs-grid">'+choicesHtml(firstChoices)+'</div><details><summary>Autres problèmes</summary><div class="entry-choice-grid">'+choicesHtml(otherChoices)+'</div></details></section>';
    if(selected==="urgent_food"&&!state.foodLocationConfirmed){
      host.innerHTML='<div class="simple-kicker">Une question seulement</div><h2>Dans quelle commune êtes-vous ?</h2>'+
        '<p>Pour trouver une aide alimentaire, sans demander vos revenus.</p>'+
        '<div class="guided-one-step"><button type="button" data-food-geo>📍 Utiliser ma position (facultatif)</button><p id="food-geo-status">Ou indiquez votre commune.</p><label for="food-postal">Commune ou code postal</label>'+
        '<input id="food-postal" inputmode="text" autocomplete="address-level2" placeholder="Ex. 1020 ou Laeken" value="'+esc(state.foodLocation||"")+'">'+
        '<label for="food-day">Quand avez-vous besoin d’aide ?</label><select id="food-day"><option value="today">Aujourd’hui</option><option value="tomorrow">Demain</option></select><div class="guided-actions"><button type="button" data-food-find>Voir ma première démarche</button>'+
        '<button type="button" data-help-reset>Changer de problème</button></div></div>';
      showScreen("simpleDifficultHelp");return;
    }
    if(selected==="urgent_food"&&Number(state.helpStep||0)===0){
      const place=foodCandidates()[0];
      if(place){
        host.innerHTML='<div class="simple-kicker">Une démarche à la fois</div><h2>Manger / obtenir des courses</h2>'+
          '<section class="guided-one-step"><p class="guided-step-count">Première piste dans votre commune</p>'+
          '<h3>'+esc(place.name)+'</h3><p class="guided-instruction">'+esc(place.address)+'</p>'+
          '<p>'+esc(place.hours)+'</p><p>'+esc(place.note)+'</p>'+
          '<p>'+(state.foodCoords?'Distance approximative à vol d’oiseau : '+foodDistance(state.foodCoords.lat,state.foodCoords.lon,place.lat,place.lon)+' km. ':'')+'Horaires publiés, accueil non garanti.</p><div class="guided-main-link"><a href="'+esc(place.url)+'" target="_blank" rel="noopener noreferrer">Vérifier comment être accueilli ↗</a></div>'+
          '<div class="guided-actions"><button type="button" data-help-next>Ça n’a pas marché → Autre solution</button>'+
          '<button type="button" data-food-change>Changer de commune</button><button type="button" data-help-reset>Autre problème</button></div></section>';
      }else{
        const commune=String(state.foodLocation||"votre commune");
        const subject=encodeURIComponent("Aide alimentaire urgente — "+commune);
        const body=encodeURIComponent("Bonjour, je cherche une aide alimentaire accessible dans ma commune ("+commune+"). Pourriez-vous m’indiquer un lieu concret et les conditions pour être accueilli, si possible sans appel téléphonique ? Merci.");
        host.innerHTML='<div class="simple-kicker">Une démarche à la fois</div><h2>Demander une adresse alimentaire</h2>'+
          '<section class="guided-one-step"><p>Je n’ai pas encore de lieu vérifié pour cette commune. Je préfère ne pas vous envoyer à une mauvaise adresse.</p>'+
          '<h3>Contacter directement l’équipe d’aide alimentaire FDSS</h3>'+
          '<p class="guided-instruction">Indiquez votre commune et demandez où obtenir de la nourriture.</p>'+
          '<div class="guided-main-link"><a href="mailto:aidealimentaire@fdss.be?subject='+subject+'&body='+body+'">Envoyer un e-mail prêt à l’emploi ↗</a></div>'+
          '<div class="guided-actions"><button type="button" data-help-next>Pas d’e-mail ? Autre possibilité</button>'+
          '<button type="button" data-food-change>Changer de commune</button><button type="button" data-help-reset>Autre problème</button></div>'+
          '<details><summary>En savoir plus</summary><p>La FDSS recommande de confirmer critères, horaires et capacité d’accueil avant tout déplacement. Une réponse immédiate n’est pas garantie.</p></details></section>';
      }
      showScreen("simpleDifficultHelp");return;
    }
    if(selected==="overview"){
      host.innerHTML='<div class="simple-kicker">EcoTank vous guide</div><h2>De quoi avez-vous besoin aujourd’hui ?</h2><p>Un choix, une démarche à la fois.</p>'+choose+'<p class="business-safety">Danger médical immédiat : 112.</p>';
    }else{
      const n=Math.min(Number(state.helpStep||0),Math.max(0,cards.length-1)),card=cards[n];
      const instruction=(compact[selected]||[])[n]||card[1].split(/[.!?] /)[0].slice(0,145)+'.';
      const urls=card[2].map(link=>safeLink(link[0],link[1])).filter(Boolean);
      host.innerHTML='<div class="simple-kicker">Une démarche à la fois</div><h2>'+esc(title)+'</h2>'+
        '<section class="guided-one-step" aria-live="polite"><p class="guided-step-count">Solution '+(n+1)+' sur '+cards.length+'</p>'+
        '<h3>'+esc(card[0])+'</h3><p class="guided-instruction">'+esc(instruction)+'</p>'+
        '<div class="guided-main-link">'+(urls[0]||'')+'</div>'+
        '<div class="guided-actions"><button type="button" data-help-next '+(n>=cards.length-1?'disabled':'')+'>Ça n’a pas marché → Autre solution</button>'+
        '<button type="button" data-help-reset>Changer de problème</button></div>'+
        '<details><summary>En savoir plus (facultatif)</summary><p>'+esc(card[1])+'</p>'+urls.slice(1).join('')+'</details></section>'+
        '<p class="business-safety">Les aides ne sont jamais garanties. Danger vital : 112.</p>';
    }
    showScreen("simpleDifficultHelp");
  }

  function handoffAdmin(){
    hideCustomScreens();
    const b=document.getElementById("simpleAdminStart");
    if(b){state.bypassAdminStart=true;b.click();}
  }

  function renderDestination(id){
    const d=destination(id)||destination("guided_orientation");
    const host=document.getElementById("entryDestinationHost");
    if(!host||!d)return;
    const foundation=state.answers.q_foundations_ok;
    const needsRepair=(foundation==="no_or_unknown");
    const someRepair=(foundation==="some_problems");
    const adminFirst=d.administrative_first===true||id==="residence_status"||id==="foundation_recovery"||id==="international_special"||id==="guided_orientation"||needsRepair;

    let context="";
    if(id==="social_protection"&&answerLabel("q_replacement_income_type"))context='<div class="business-context"><span class="business-pill">'+esc(answerLabel("q_replacement_income_type"))+'</span></div>';
    if(needsRepair)context+='<div class="entry-route-note warning"><strong>On commence par les bases.</strong><br>Vous gardez votre parcours « '+esc(d.title||"")+' », mais identité, adresse, mutualité, compte, courrier ou accès numérique peuvent être remis en ordre avant les autres démarches.</div>';
    else if(someRepair)context+='<div class="entry-route-note"><strong>Quelques bases sont à vérifier.</strong><br>Vous pouvez continuer vos recherches d’économies tout en traitant les blocages administratifs en parallèle.</div>';

    let actions="";
    if(adminFirst){
      actions+='<button type="button" class="primary" data-entry-admin>Voir mes premières solutions</button>';
      if(id!=="foundation_recovery"&&id!=="international_special"&&id!=="guided_orientation"){
        actions+='<button type="button" data-entry-general>Continuer aussi vers mes économies</button>';
      }
    }else{
      actions+='<button type="button" class="primary" data-entry-general>Continuer dans mon parcours</button>';
      if(someRepair)actions+='<button type="button" data-entry-admin>Voir des solutions pour mes blocages</button>';
    }
    host.innerHTML=
      '<div class="entry-topline"><button type="button" class="linkish" data-entry-restart>← Changer de situation</button></div>'+
      '<div class="simple-kicker">Votre parcours</div>'+
      '<h2>'+esc(d.title||"Votre parcours EcoTank")+'</h2>'+
      '<p>'+esc(d.intro||"EcoTank adapte maintenant la suite à votre situation.")+'</p>'+
      context+
      '<div class="entry-route-note"><strong>Vous ne serez pas enfermé dans ce parcours.</strong><br>Vous pourrez toujours vérifier un autre droit ou revenir modifier cette orientation.</div>'+
      '<div class="entry-route-actions">'+actions+'</div>';
    showScreen("simpleEntryDestination");
  }

  function isCardCurrent(card){
    if(!card?.expires_or_recheck_after)return true;
    const end=new Date(card.expires_or_recheck_after+"T23:59:59");
    return Number.isNaN(end.getTime())||end>=new Date();
  }

  function priorityTokens(){
    const tokens=[state.answers.q_company_stage,state.answers.q_company_goal,state.answers.q_business_stage].filter(Boolean);
    const cash=state.businessAnswers.cash_position||"";
    const debts=state.businessAnswers.debts||"";
    const employees=state.businessAnswers.employees||"";
    if(cash==="c’est serré"||cash==="non")tokens.push("cashflow_problem","difficulty");
    if(debts==="fiscales")tokens.push("taxes","difficulty");
    if(debts==="cotisations sociales")tokens.push("cashflow_problem","difficulty");
    if(debts==="ONSS")tokens.push("staff","difficulty");
    if(debts==="banque/crédit"||debts==="fournisseurs"||debts==="loyer/énergie")tokens.push("cashflow_problem","difficulty");
    if(employees&&employees!=="aucun"&&employees!=="je ne sais pas")tokens.push("employer","staff");
    return [...new Set(tokens)];
  }

  function resourceCardHtml(card,index,priority){
    const contact=[];
    if(card.phone)contact.push("☎ "+esc(card.phone));
    if(card.email)contact.push("✉ "+esc(card.email));
    const emailButton=card.email&&card.email_body?'<button type="button" data-business-email="'+esc(card.id)+'">Préparer mon e-mail</button>':"";
    return '<article class="business-card '+(priority?"priority":"")+'" data-resource-card="'+esc(card.id)+'">'+
      '<h3>'+esc(card.title||"Ressource utile")+'</h3>'+
      '<p>'+esc(card.description||"")+'</p>'+
      (contact.length?'<div class="business-contact">'+contact.join(" · ")+'</div>':"")+
      '<div class="resource-meta">'+esc(card.authority||"Source officielle")+(card.verified_at?' · vérifié le '+esc(card.verified_at):"")+'</div>'+
      '<div class="resource-actions"><a class="primary" href="'+esc(card.url||card.source_url||"#")+'" target="_blank" rel="noopener noreferrer">'+esc(card.action_label||"Ouvrir")+'</a>'+emailButton+'</div>'+
      '<div class="business-email-box" data-business-email-box="'+esc(card.id)+'" hidden></div>'+
      '</article>';
  }

  function renderBusiness(id){
    const d=destination(id),host=document.getElementById("businessHomeHost");
    if(!d||!host)return renderDestination("guided_orientation");
    const tokens=priorityTokens();
    const goal=id==="company"?state.answers.q_company_goal:state.answers.q_business_stage;
    const matchWords={starting:/prime indépendant|lancement|entrepreneuriale|starter|airbag|chèques/i,running:/subsides|digitalisation|franchise|financement|TVA/i,cashflow_problem:/cotisations|paiement|dette|passerelle|trésorerie/i,interruption:/passerelle|cessation|interrompre|arrêt/i,hiring:/recrut|engag|premier travailleur|emploi/i,staff:/recrut|engag|premier travailleur|emploi/i,financing:/subsides|primes|investissement|financement/i,cashflow:/paiement|trésorerie|cotisations|dettes/i,administration:/fiscal|TVA|cotisations|obligation/i};
    const preferred=matchWords[goal];
    const cards=(d.resource_cards||[]).filter(isCardCurrent).map(card=>({
      card,
      priority:(preferred&&preferred.test(card.title+" "+card.description)?3:0)+((card.priority_for||[]).some(x=>tokens.includes(x))?1:0)
    })).sort((a,b)=>b.priority-a.priority);
    const intake=d.intake;
    // Ne pas montrer les fiches sans lien avec le besoin déclaré comme résultats personnalisés.
    const region=state.answers.q_independent_region||"unknown";
    // Catalogue contrôlé : une fiche n'est admissible que pour l'objectif choisi et la région.
    // Une réponse manquante bloque les aides régionales et ne devient jamais un droit confirmé.
    const allowedByGoal={
      starting:["self_1819","self_actiris_prime","self_tremplin","self_airbag","self_cheques","self_primostarter","self_student"],
      running:["self_subsidies","self_vat_franchise","self_cheques","self_1819","self_brussels_prime_status"],
      cashflow_problem:["self_social_contributions","self_cotisations","self_passerelle","self_1819"],
      interruption:["self_passerelle","self_cotisations","self_1819"],
      hiring:["company_hiring_shared","self_1819"]
    };
    const regionById={
      self_1819:"brussels",self_actiris_prime:"brussels",self_subsidies:"brussels",
      self_brussels_prime_status:"brussels",self_airbag:"wallonia",self_cheques:"wallonia"
    };
    const ids=allowedByGoal[goal]||[];
    const relevantCards=id==="self_employed" ? cards.filter(x=>
      ids.includes(x.card.id)&&(!regionById[x.card.id]||regionById[x.card.id]===region)
    ) : [];

    const index=Math.max(0,Math.min(Number(state.businessCardIndex||0),Math.max(0,relevantCards.length-1)));
    const visibleCards=relevantCards.slice(index,index+1);
    const intakeHtml=intake&&Array.isArray(intake.questions)?(
      '<section class="business-intake"><h3>Pour affiner « Mon entreprise »</h3><p>'+esc(intake.privacy||"Ces réponses restent dans cette page.")+'</p><div class="business-intake-grid">'+
      intake.questions.map(q=>'<label>'+esc(q.label)+'<select data-business-intake="'+esc(q.id)+'"><option value="">Je préfère ne pas préciser</option>'+(q.options||[]).map(o=>'<option value="'+esc(o)+'" '+(state.businessAnswers[q.id]===o?'selected':'')+'>'+esc(o)+'</option>').join("")+'</select></label>').join("")+
      '</div></section>'
    ):"";
    const future=(d.future_sections||[]).map(x=>'<span>'+esc(x)+'</span>').join("");
    const context=[
      answerLabel("q_company_stage"),
      answerLabel("q_company_goal"),
      answerLabel("q_business_stage")
    ].filter(Boolean).map(x=>'<span class="business-pill">'+esc(x)+'</span>').join("");
    const routeTitle=id==="company"?"Mon entreprise":"Mon activité indépendante";
    host.innerHTML=
      '<div class="entry-topline"><button type="button" class="linkish" data-entry-restart>← Changer de situation</button></div>'+
      '<div class="business-head"><div class="simple-kicker">EcoTank professionnel</div><h2>'+esc(d.title||routeTitle)+'</h2><p class="business-lead">'+esc(d.intro||"EcoTank adapte ses conseils à votre activité professionnelle.")+'</p><div class="business-context">'+context+'</div></div>'+
      '<div class="business-safety"><strong>Important :</strong> ces pistes servent à agir et à vérifier. EcoTank ne déduit jamais automatiquement qu’une prime, un plan de paiement ou un autre droit vous est accordé.</div>'+
      '<section><h3>Première économie ou démarche à vérifier</h3><div class="business-grid">'+(relevantCards.length?visibleCards.map((x,i)=>resourceCardHtml(x.card,index+i,x.priority)).join(""):'<div class="business-card"><h3>Le parcours se construit</h3><p>Les premières sources officielles sont en cours de raccordement.</p></div>')+'</div></section>'+
      (relevantCards.length>index+1?'<div class="entry-route-actions"><button type="button" data-business-more>Cela ne me concerne pas → Autre piste</button></div>':'')+

      '<div class="entry-route-actions"><button type="button" data-business-refine>Préciser mon besoin</button><button type="button" data-entry-personal>Je veux aussi vérifier mes droits personnels</button><button type="button" class="linkish" data-entry-home>Accueil</button></div>';
    showScreen("simpleBusinessHome");
  }

  function openEmail(cardId){
    const d=destination(state.destinationId);
    const card=(d?.resource_cards||[]).find(x=>x.id===cardId);
    const box=document.querySelector('[data-business-email-box="'+cardId+'"]');
    if(!card||!box)return;
    const subject=card.email_subject||"Demande d’information";
    const body=card.email_body||"Bonjour,\nJ’aurais besoin d’une information concernant mon entreprise.\nMerci d’avance.";
    const mailto='mailto:'+encodeURIComponent(card.email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    box.hidden=false;
    box.innerHTML='<strong>'+esc(subject)+'</strong><pre>'+esc(body)+'</pre><div class="resource-actions"><button type="button" data-copy-business-email="'+esc(card.id)+'">Copier le texte</button><a href="'+esc(mailto)+'">Ouvrir mon e-mail</a></div>';
  }

  async function copyEmail(cardId){
    const d=destination(state.destinationId);
    const card=(d?.resource_cards||[]).find(x=>x.id===cardId);
    if(!card)return;
    const text=(card.email_subject?card.email_subject+"\n\n":"")+(card.email_body||"");
    try{await navigator.clipboard.writeText(text);}catch(e){
      const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();
    }
    const b=document.querySelector('[data-copy-business-email="'+cardId+'"]');
    if(b){const old=b.textContent;b.textContent="Copié";setTimeout(()=>b.textContent=old,1200);}
  }

  function renderLoadFailure(){
    const host=document.getElementById("entryRouterHost");
    if(!host)return;
    host.innerHTML='<div class="simple-kicker">Orientation</div><h2>Le nouveau parcours n’a pas pu être chargé.</h2><p>Vous pouvez continuer avec le questionnaire EcoTank classique ; aucune donnée n’a été envoyée.</p><div class="entry-route-actions"><button type="button" class="primary" data-entry-fallback>Continuer</button><button type="button" class="linkish" data-entry-home>Accueil</button></div>';
    showScreen("simpleEntryRouter");
  }

  function start(){
    if(state.bypassStart){state.bypassStart=false;return false;}
    if(!ensureScreens())return false;
    state.answers={};
    state.destinationId="";
    state.fromAdminHome=false;
    state.difficultTopic="";
    state.businessAnswers={};
    state.immediateNeed="";
    state.lostRightsSelected=[];
    state.lostRightsQueue=[];
    state.lostRightsIndex=0;
    state.businessCardIndex=0;
    state.savingStep=0;
    const host=document.getElementById("entryRouterHost");
    host.innerHTML='<div class="simple-kicker">EcoTank · Faire des économies</div><h2>Je veux explorer des pistes pour pouvoir faire des économies.</h2>';
    showScreen("simpleEntryRouter");
    loadCatalog().then(()=>renderQuestion("q_entry_situation")).catch(renderLoadFailure);
    return true;
  }

  document.addEventListener("click",event=>{
    if(event.target.closest("[data-lost-rights-submit]")){
      const chosen=[...document.querySelectorAll("[data-lost-rights-check]:checked")].map(e=>e.dataset.lostRightsCheck);
      state.lostRightsSelected=chosen;state.answers.q_lost_rights_goal=chosen.join(",");
      if(!chosen.length){const h=document.getElementById("entryRouterHost");h?.querySelector("[data-lost-rights-submit]")?.focus();return;}
      const order=["nothing","refused","stopped","administrative"];
      state.lostRightsQueue=order.filter(x=>chosen.includes(x));
      state.lostRightsIndex=0;
      const chosenPriority=state.lostRightsQueue[0];
      state.destinationId="foundation_recovery";
      const topic=({nothing:"urgent_income",refused:"refusals",stopped:"urgent_income",administrative:"urgent_access"})[chosenPriority];
      renderDifficultHelp(topic);return;
    }
    if(event.target.closest("[data-lost-rights-reselect]")){
      state.lostRightsQueue=[];state.lostRightsIndex=0;state.immediateNeed="";renderQuestion("q_lost_rights_goal");return;
    }
    if(event.target.closest("[data-jessica-start]")){jessicaEntry();return;}
    const jt=event.target.closest("[data-jessica-topic]");if(jt){state.jessicaTopic=jt.dataset.jessicaTopic;jessicaGuide(false);return;}
    if(event.target.closest("[data-jessica-short]")){jessicaGuide(true);return;}
    if(event.target.closest("[data-jessica-full]")){jessicaGuide(false);return;}
    if(event.target.closest("[data-jessica-print]")){window.print();return;}
    if(event.target.closest("[data-jessica-edit]")){jessicaEntry();return;}
    if(event.target.closest("[data-jessica-back]")){renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-thomas-start]")){thomasEntry();return;}
    const tt=event.target.closest("[data-thomas-topic]");if(tt){state.thomasTopic=tt.dataset.thomasTopic;thomasGuide(false);return;}
    if(event.target.closest("[data-thomas-short]")){thomasGuide(true);return;}
    if(event.target.closest("[data-thomas-full]")){thomasGuide(false);return;}
    if(event.target.closest("[data-thomas-print]")){window.print();return;}
    if(event.target.closest("[data-thomas-edit]")){thomasEntry();return;}
    if(event.target.closest("[data-thomas-back]")){renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-beatrice-start]")){beatriceEntry();return;}
    const bt=event.target.closest("[data-beatrice-topic]");if(bt){state.beatriceTopic=bt.dataset.beatriceTopic;beatriceGuide(false);return;}
    if(event.target.closest("[data-beatrice-short]")){beatriceGuide(true);return;}
    if(event.target.closest("[data-beatrice-full]")){beatriceGuide(false);return;}
    if(event.target.closest("[data-beatrice-print]")){window.print();return;}
    if(event.target.closest("[data-beatrice-edit]")){beatriceEntry();return;}
    if(event.target.closest("[data-beatrice-back]")){renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-lotte-start]")){lotteEntry();return;}
    const lc=event.target.closest("[data-lotte-case]");if(lc){state.lotteCase=lc.dataset.lotteCase;lotteGuide(false);return;}
    if(event.target.closest("[data-lotte-short]")){lotteGuide(true);return;}
    if(event.target.closest("[data-lotte-full]")){lotteGuide(false);return;}
    if(event.target.closest("[data-lotte-print]")){window.print();return;}
    if(event.target.closest("[data-lotte-edit]")){lotteEntry();return;}
    if(event.target.closest("[data-lotte-back]")){renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-karim-start]")){state.karimHave={};karimInventory();return;}
    const karimTick=event.target.closest("[data-karim-have]");if(karimTick){const k=karimTick.dataset.karimHave;state.karimHave=state.karimHave||{};state.karimHave[k]=!!karimTick.checked;return;}
    if(event.target.closest("[data-karim-result]")){karimGuide(false);return;}
    if(event.target.closest("[data-karim-edit]")){karimInventory();return;}
    if(event.target.closest("[data-karim-short]")){karimGuide(true);return;}
    if(event.target.closest("[data-karim-full]")){karimGuide(false);return;}
    if(event.target.closest("[data-karim-print]")){window.print();return;}
    if(event.target.closest("[data-karim-back]")){renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-celine-start]")){celineGuide();return;}
    if(event.target.closest("[data-celine-print]")){window.print();return;}
    if(event.target.closest("[data-celine-back]")){renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-samira-start]")){samiraGuide(false);return;}
    if(event.target.closest("[data-samira-short]")){samiraGuide(true);return;}
    if(event.target.closest("[data-samira-full]")){samiraGuide(false);return;}
    if(event.target.closest("[data-samira-print]")){window.print();return;}
    if(event.target.closest("[data-samira-back]")){renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-jozef-start]")){jozefGuide(false);return;}
    if(event.target.closest("[data-jozef-print]")){window.print();return;}
    if(event.target.closest("[data-jozef-short]")){jozefGuide(true);return;}
    if(event.target.closest("[data-jozef-full]")){jozefGuide(false);return;}
    if(event.target.closest("[data-jozef-back]")){renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-fatou-start]")){state.fatouPriority="";fatouEntry();return;}
    const fatouChoice=event.target.closest("[data-fatou-choice]");
    if(fatouChoice){state.fatouPriority=fatouChoice.dataset.fatouChoice;fatouGuide(false);return;}
    if(event.target.closest("[data-fatou-short]")){fatouGuide(true);return;}
    if(event.target.closest("[data-fatou-full]")){fatouGuide(false);return;}
    if(event.target.closest("[data-fatou-print]")){window.print();return;}
    if(event.target.closest("[data-fatou-back]")){renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-kevin-start]")){kevinGuide(false);return;}
    if(event.target.closest("[data-kevin-print]")){window.print();return;}
    if(event.target.closest("[data-kevin-short]")){kevinGuide(true);return;}
    if(event.target.closest("[data-kevin-full]")){kevinGuide(false);return;}
    if(event.target.closest("[data-kevin-back]")){renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-homeless-start]")){state.homelessOutsideSaintGilles=false;homelessEntry();return;}
    if(event.target.closest("[data-homeless-local]")){state.homelessOutsideSaintGilles=false;homelessGuide(false);return;}
    if(event.target.closest("[data-homeless-other]")){state.homelessOutsideSaintGilles=true;homelessGuide(false);return;}
    if(event.target.closest("[data-homeless-print]")){window.print();return;}
    if(event.target.closest("[data-homeless-short]")){homelessGuide(true);return;}
    if(event.target.closest("[data-homeless-full]")){homelessGuide(false);return;}
    if(event.target.closest("[data-homeless-close]")){renderQuestion("q_entry_situation");return;}
    const feasible=event.target.closest("[data-feasible]");
    if(feasible){state.feasibility=state.feasibility||{};const k=feasible.dataset.feasibleKey;if(feasible.dataset.feasible==="reset")delete state.feasibility[k];else state.feasibility[k]=feasible.dataset.feasible;renderDifficultHelp();return;}
    const work=event.target.closest("[data-work-pick]");
    if(work){
      const choice=work.dataset.workPick;
      if(choice==="advantages"){state.workStage="advantages_detail";state.workChoice="";}
      else if(choice==="documents"){state.workStage="documents";state.workChoice="";}
      else if(choice==="block_again"){state.workStage="block";state.workChoice="";}
      else if(choice==="cannot_access"||choice==="already_tried"){state.workStage="obstacle";state.workChoice=choice;}
      else if(["acs","fpie","article60","all_advantages"].includes(choice)){state.workStage="actiris";state.workChoice=choice;state.workAid=choice;}
      else if(["registered","unregistered","unsure"].includes(choice)){state.workStage="support";state.workRegistration=choice;state.workChoice=state.workAid||choice;}
      else if(["identity","digital","cvdocs","travel","unknown_docs"].includes(choice)){state.workStage="support";state.workChoice=choice;}
      else {state.workStage="support";state.workChoice=choice;}
      renderDifficultHelp();return;
    }
    if(event.target.closest("[data-work-back]")){
      if(state.workStage==="support"&&state.workAid)state.workStage="actiris";
      else if(state.workStage==="actiris")state.workStage="advantages_detail";
      else state.workStage="block";
      renderDifficultHelp();return;
    }
    const immediate=event.target.closest("[data-immediate-need]");if(immediate){state.immediateNeed=immediate.dataset.immediateNeed;state.workStage="block";state.workChoice="";state.workAid="";state.helpStep=0;renderDifficultHelp();return;}
    if(event.target.closest("[data-lost-rights-next]")){
      const order=["nothing","refused","stopped","administrative"];
      const saved=order.filter(x=>(state.lostRightsSelected||[]).includes(x));
      const queue=saved.length>(state.lostRightsQueue||[]).length?saved:(state.lostRightsQueue||[]);
      state.lostRightsQueue=queue;
      state.lostRightsIndex=Number(state.lostRightsIndex||0)+1;
      state.helpStep=0;state.immediateNeed="";state.workStage="block";
      if(state.lostRightsIndex<queue.length){
        const selected=queue[state.lostRightsIndex];
        const topics={nothing:"urgent_income",refused:"refusals",stopped:"urgent_income",administrative:"urgent_access"};
        renderDifficultHelp(topics[selected]);return;
      }
      state.lostRightsIndex=0;
      renderQuestion("q_lost_rights_goal");return;
    }
    if(event.target.closest("[data-lost-rights-restart]")){
      state.lostRightsQueue=["nothing","refused","stopped","administrative"].filter(x=>(state.lostRightsSelected||[]).includes(x));
      state.lostRightsIndex=0;const first=(state.lostRightsQueue||[])[0];renderDifficultHelp(({nothing:"urgent_income",refused:"refusals",stopped:"urgent_income",administrative:"urgent_access"})[first]||"urgent_income");return;
    }
    const opt=event.target.closest("[data-entry-option]");
    if(opt){chooseOption(opt.dataset.entryQuestion,opt.dataset.entryOption);return;}

    const allowance=event.target.closest("[data-saving-allowance]");if(allowance){state.answers.q_qualifying_allowance=allowance.dataset.savingAllowance;state.savingStep=0;renderPersonalCheck();return;}
    if(event.target.closest("[data-saving-again]")){delete state.answers.q_qualifying_allowance;state.savingStep=0;renderPersonalCheck();return;}
    if(event.target.closest("[data-saving-next]")){state.savingStep=Number(state.savingStep||0)+1;renderPersonalCheck();return;}
    if(event.target.closest("[data-general-skip-docs]")){state.skipSensitiveProfile=true;renderNoDocsSuggestions();return;}
    if(event.target.closest("[data-general-detailed]")){handoffGeneralProceed();return;}
    if(event.target.closest("[data-personal-continue]")){handoffGeneral();return;}
    if(event.target.closest("[data-business-more]")){state.businessCardIndex=Number(state.businessCardIndex||0)+1;renderBusiness(state.destinationId);return;}
    if(event.target.closest("[data-business-refine]")){renderQuestion(state.destinationId==="company"?"q_employer_goal":"q_independent_goal");return;}
    if(event.target.closest("[data-entry-home]")){hideCustomScreens();document.getElementById("simpleHome")?.classList.add("active");window.scrollTo({top:0,behavior:"smooth"});return;}
    if(event.target.closest("[data-entry-restart]")){state.answers={};state.destinationId="";renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-entry-unknown]")){routeToDestination("guided_orientation");return;}
    if(event.target.closest("[data-entry-fast-help]")){state.fromAdminHome=false;state.destinationId="foundation_recovery";state.difficultTopic="";renderDifficultHelp();return;}
    if(event.target.closest("[data-entry-access-help]")){state.fromAdminHome=false;state.accessIssue="";state.accessService="general";renderAccessHelp();return;}
    if(event.target.closest("[data-help-access]")){state.accessIssue="";state.accessService="general";renderAccessHelp();return;}
    if(event.target.closest("[data-access-back]")){renderDifficultHelp();return;}
    if(event.target.closest("[data-access-reset]")){state.accessIssue="";state.accessService="general";renderAccessHelp();return;}
    if(event.target.closest("[data-entry-admin]")){state.difficultTopic="";renderDifficultHelp();return;}
    if(event.target.closest("[data-food-geo]")){const status=document.getElementById("food-geo-status");if(!navigator.geolocation){if(status)status.textContent="Position non disponible. Entrez votre commune.";return;}navigator.geolocation.getCurrentPosition(p=>{state.foodCoords={lat:p.coords.latitude,lon:p.coords.longitude};if(status)status.textContent="Position reçue pour cette recherche (non envoyée à EcoTank).";},()=>{if(status)status.textContent="Position refusée ou indisponible : entrez votre commune.";},{enableHighAccuracy:false,timeout:10000});return;}
    if(event.target.closest("[data-food-find]")){state.foodLocation=document.getElementById("food-postal")?.value?.trim()||"";state.foodDay=document.getElementById("food-day")?.value||"today";state.foodLocationConfirmed=true;state.helpStep=0;renderDifficultHelp();return;}
    if(event.target.closest("[data-food-change]")){state.foodLocationConfirmed=false;renderDifficultHelp();return;}
    if(event.target.closest("[data-help-next]")){state.helpStep=(state.helpStep||0)+1;renderDifficultHelp();return;}
    const topic=event.target.closest("[data-help-topic]");
    if(topic){renderDifficultHelp(topic.dataset.helpTopic);return;}
    if(event.target.closest("[data-help-back]")){
      if(state.fromAdminHome){hideCustomScreens();document.getElementById("simpleHome")?.classList.add("active");window.scrollTo({top:0,behavior:"smooth"});}
      else renderDestination(state.destinationId);
      return;
    }
    if(event.target.closest("[data-help-reset]")){state.lostRightsQueue=[];state.difficultTopic="";state.helpStep=0;renderDifficultHelp();return;}
    if(event.target.closest("[data-help-detailed]")){handoffAdmin();return;}
    if(event.target.closest("[data-admin-retry]")){startImmediateHelp();return;}
    if(event.target.closest("[data-admin-immediate-help]")){state.fromAdminHome=true;startImmediateHelp();return;}
    if(event.target.closest("[data-entry-general]")){handoffGeneral();return;}
    if(event.target.closest("[data-entry-fallback]")){handoffGeneral();return;}
    if(event.target.closest("[data-entry-personal]")){
      window.ECOTANK_ENTRY_EMPLOYMENT=state.destinationId==="self_employed"?"self":"";
      hideCustomScreens();state.bypassStart=true;document.getElementById("simpleStart")?.click();return;
    }
    if(event.target.closest("[data-business-refresh]")){renderBusiness(state.destinationId);return;}
    const email=event.target.closest("[data-business-email]");if(email){openEmail(email.dataset.businessEmail);return;}
    const copy=event.target.closest("[data-copy-business-email]");if(copy){copyEmail(copy.dataset.copyBusinessEmail);return;}
  },true);

  document.addEventListener("change",event=>{
    const issue=event.target.closest("[data-access-issue]");
    if(issue){state.accessIssue=ACCESS_PROBLEMS.some(x=>x[0]===issue.value)?issue.value:"";renderAccessHelp();return;}
    const service=event.target.closest("[data-access-service]");
    if(service){state.accessService=ACCESS_SERVICES.some(x=>x[0]===service.value)?service.value:"general";renderAccessHelp();return;}
    const input=event.target.closest("[data-business-intake]");
    if(input)state.businessAnswers[input.dataset.businessIntake]=input.value;
  });

  // Capture AVANT le gestionnaire historique attaché directement au bouton.
  // L'accès au questionnaire détaillé reste disponible via handoffAdmin().
  window.addEventListener?.("click",event=>{
    const target=event.target?.closest?.("#simpleAdminStart");
    if(!target)return;
    if(state.bypassAdminStart){state.bypassAdminStart=false;return;}
    if(!ensureScreens())return;
    event.preventDefault?.();
    event.stopPropagation?.();
    state.fromAdminHome=true;
    startImmediateHelp();
  },true);


  // On mobile, rendre l'aide concrète visible AVANT le parcours d'économies.
  // Reclasser les boutons existants conserve leurs gestionnaires et les autres parcours.
  function highlightUrgentEntry(){
    const urgent=document.getElementById("simpleAdminStart");
    const standard=document.getElementById("simpleStart");
    if(!urgent||!standard||!urgent.parentElement||urgent.parentElement!==standard.parentElement)return;
    urgent.innerHTML='<strong>Besoin d’aide maintenant ?</strong>'+
      '<span>Nourriture, hébergement, soins, revenus, refus ou accès aux démarches · sans long questionnaire</span>';
    urgent.setAttribute("aria-label","Besoin d’aide maintenant ? Trouver des solutions");
    urgent.parentElement.insertBefore(urgent,standard);
  }

  prioritizeAdminResults();
  highlightUrgentEntry();
  ensureScreens();
  function startWithChoice(choice){
    if(!["working","not_working"].includes(choice))return;
    if(!ensureScreens())return;
    state.answers={};state.destinationId="";state.difficultTopic="";state.businessAnswers={};
    showScreen("simpleEntryRouter");
    const host=document.getElementById("entryRouterHost");
    if(host)host.innerHTML='<div class="simple-kicker">EcoTank · Faire des économies</div><p>Préparation de votre parcours…</p>';
    loadCatalog().then(()=>chooseOption("q_entry_situation",choice)).catch(renderLoadFailure);
  }
  window.EcoTankEntryRouter={start,startWithChoice};
  // Le questionnaire de deux choix est maintenant la véritable page d’entrée.
  // Attendre la fin du chargement du site historique avant de l’afficher.
  // Le HTML initial contient directement les deux choix.
})();
