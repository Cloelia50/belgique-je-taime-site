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
      '<div class="simple-kicker">Trouver le bon parcours</div>'+
      '<h2>'+esc(q.text||"Votre situation")+'</h2>'+
      (q.helper?'<p>'+esc(q.helper)+'</p>':"")+
      (qid==="q_entry_situation"?
        '<div class="entry-route-actions entry-fast-help"><button type="button" class="primary" data-entry-fast-help>Mes droits sont coupés ou ma situation est compliquée : voir des premières pistes</button></div>'+
        '<p class="entry-fast-help-note">Vous pouvez commencer sans répondre à toutes les questions. Vous pourrez préciser votre difficulté ensuite.</p>':"")+
      controls+
      '<div class="entry-footer"><span></span><button type="button" class="linkish" data-entry-unknown>Je ne sais pas quoi choisir</button></div>';
    showScreen("simpleEntryRouter");
  }

  function chooseOption(qid,oid){
    const q=question(qid),opt=optionFor(qid,oid);
    if(!q||!opt)return;
    state.answers[qid]=oid;
    if(qid==="q_entry_situation")state.destinationId=opt.destination_id||"";
    const next=opt.next_question_id||q.next_question_id;
    if(next){
      renderQuestion(next);
      return;
    }
    routeToDestination(opt.destination_id||q.destination_id||currentDestinationFromFirst());
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

  function handoffGeneral(){
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

  // Parcours rapide réservé aux personnes qui rencontrent des blocages.
  // Les autres parcours EcoTank et le questionnaire détaillé restent inchangés.
  function renderDifficultHelp(nextTopic){
    if(!ensureScreens())return;
    if(nextTopic)state.difficultTopic=nextTopic;
    const initial=state.destinationId==="residence_status"?"residence":
      state.destinationId==="international_special"?"international":"overview";
    const topic=state.difficultTopic||initial;
    const host=document.getElementById("entryDifficultHost");
    if(!host)return;
    const sources=state.catalog?.official_sources||{};
    const safeLink=(key,label)=>{
      const source=sources[key];
      if(!source||typeof source.url!=="string"||!/^https:\/\//i.test(source.url))return "";
      return '<a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(label||source.label||"Ouvrir la source officielle")+' ↗</a>';
    };
    // Chaque piste renvoie à une source officielle déjà référencée dans la base.
    // Aucune réponse ne permet de déduire automatiquement l'ouverture d'un droit.
    const guides={
      overview:[
        ["Commencer par une aide humaine et concrète","Si vous n'arrivez plus à faire face aux besoins essentiels, demandez à un service social de faire le point avec vous. N'attendez pas d'avoir tous vos documents.",[["cpas_dis_procedure","Comprendre les démarches auprès du CPAS"]]],
        ["Ne pas perdre l'accès aux soins","Vérifiez votre affiliation ou les démarches pour la rétablir, indépendamment de vos autres droits.",[["inami_affiliation","Mutualité ou CAAMI"]]],
        ["Remettre en ordre ce qui bloque","Une adresse administrative incertaine peut empêcher d'autres démarches. C'est un problème à traiter, pas une raison d'arrêter la recherche.",[["reference_address","Adresse de référence et aides"]]]
      ],
      income:[
        ["Demander un examen de votre situation","Sans revenu ou après une interruption de droits, le CPAS peut examiner les aides accessibles selon votre situation. Ce n'est pas une garantie d'attribution.",[["cpas_dis_procedure","Comprendre la procédure CPAS"]]],
        ["Introduire une première demande, si vous n'avez pas déjà de dossier","Deux accès existent, dont un sans identification itsme. Si un dossier est déjà ouvert, reprenez contact avec votre CPAS plutôt que de déposer une nouvelle première demande.",[["cpas_online","Première demande avec identification"],["cpas_online_unsecured","Première demande sans connexion"]]],
        ["Préserver l'accès aux soins","Un droit au revenu suspendu n'implique pas qu'il faille attendre pour vérifier sa couverture santé.",[["inami_affiliation","Vérifier sa couverture santé"]]]
      ],
      housing:[
        ["Signaler une urgence de logement ou de charges","Un service social peut examiner votre situation, les risques immédiats et les aides envisageables.",[["cpas_dis_procedure","Démarches et aides sociales"]]],
        ["Sans domicile officiel ou en cas d'adresse perdue","Vérifiez la possibilité d'une adresse de référence. Les conditions doivent être examinées au cas par cas.",[["reference_address","Adresse de référence"]]],
        ["Conserver l'accès aux décisions importantes","Si votre courrier est instable, faites le point sur les moyens de recevoir les communications officielles.",[["myebox","My eBox"],["mygov","MyGov.be"]]]
      ],
      health:[
        ["Vérifier ou rétablir la couverture santé","Une mutualité ou la CAAMI peut préciser les démarches selon votre situation réelle.",[["inami_affiliation","Affiliation et couverture santé"]]],
        ["Signaler un problème d'accès aux soins","Un service social peut vous orienter vers les aides ou procédures qui correspondent à votre cas.",[["cpas_dis_procedure","Se renseigner sur l'aide sociale"]]],
        ["Si les démarches numériques bloquent","Une demande sociale initiale peut, dans certains cas, être introduite sans itsme.",[["cpas_online_unsecured","Première demande CPAS sans connexion"]]]
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
      ["income","Revenus ou droits coupés"],["housing","Logement ou adresse"],
      ["health","Soins de santé"],["identity","Papiers et eID"],
      ["digital","itsme / démarches en ligne"],["decision","Décision ou recours"],
      ["bank","Compte bancaire"],["residence","Séjour / protection"]
    ];
    const selected=guides[topic]?topic:"overview";
    const cards=guides[selected];
    const title=selected==="residence"?"Premières pistes pour votre situation de séjour":
      selected==="international"?"Premières pistes pour votre situation internationale":
      "Voici des premières solutions, sans autre questionnaire";
    host.innerHTML=
      '<div class="entry-topline"><button type="button" class="linkish" data-help-back>← Mon orientation</button><span class="entry-step">Aucune autre réponse obligatoire</span></div>'+
      '<div class="simple-kicker">Situations compliquées · accès rapide</div>'+
      '<h2>'+esc(title)+'</h2>'+
      '<p>Vous pouvez agir dès maintenant. Les liens ci-dessous viennent des sources officielles déjà référencées dans EcoTank. Ce sont des pistes à vérifier, pas des droits accordés automatiquement.</p>'+
      '<div class="business-grid">'+cards.map((card,i)=>
        '<article class="business-card '+(i===0?'priority':'')+'"><h3>'+(i+1)+'. '+esc(card[0])+'</h3><p>'+esc(card[1])+'</p>'+
        '<div class="resource-actions">'+card[2].map(link=>safeLink(link[0],link[1])).filter(Boolean).join("")+'</div></article>'
      ).join("")+'</div>'+
      '<section class="business-intake"><h3>Qu’est-ce qui vous bloque le plus ? (facultatif)</h3>'+
      '<p>Un clic adapte immédiatement ces pistes. Pas besoin de compléter tout votre dossier.</p>'+
      '<div class="entry-choice-grid">'+choices.map(([id,label])=>
        '<button type="button" class="entry-choice" data-help-topic="'+id+'" aria-pressed="'+(id===selected?'true':'false')+'">'+esc(label)+'</button>'
      ).join("")+'</div></section>'+
      '<div class="entry-route-actions"><button type="button" class="linkish" data-help-reset>Revoir les premières pistes</button>'+
      '<button type="button" data-help-detailed>Examiner ma situation en détail (facultatif)</button></div>'+
      '<p class="business-safety">EcoTank ne demande ni numéro national, ni code PIN, ni mot de passe. Si vous avez déjà introduit une demande ou si votre situation est urgente, contactez directement le service compétent sans attendre de terminer le questionnaire.</p>';
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
    const cards=(d.resource_cards||[]).filter(isCardCurrent).map(card=>({
      card,
      priority:(card.priority_for||[]).some(x=>tokens.includes(x))
    })).sort((a,b)=>Number(b.priority)-Number(a.priority));
    const intake=d.intake;
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
      intakeHtml+
      '<section><h3>Les premières actions utiles pour votre situation</h3><div class="business-grid">'+(cards.length?cards.map((x,i)=>resourceCardHtml(x.card,i,x.priority)).join(""):'<div class="business-card"><h3>Le parcours se construit</h3><p>Les premières sources officielles sont en cours de raccordement.</p></div>')+'</div></section>'+
      (future?'<section><h3>Ce volet va aussi couvrir</h3><div class="business-future">'+future+'</div></section>':"")+
      '<div class="entry-route-actions"><button type="button" class="primary" data-business-refresh>Actualiser les actions selon mes réponses</button><button type="button" data-entry-personal>Je veux aussi vérifier mes droits personnels</button><button type="button" class="linkish" data-entry-home>Accueil</button></div>';
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
    const host=document.getElementById("entryRouterHost");
    host.innerHTML='<div class="simple-kicker">Trouver le bon parcours</div><h2>On regarde d’abord d’où vous partez.</h2><p>Quelques secondes suffisent pour éviter de vous envoyer vers un formulaire qui ne correspond pas à votre situation.</p>';
    showScreen("simpleEntryRouter");
    loadCatalog().then(()=>renderQuestion("q_entry_situation")).catch(renderLoadFailure);
    return true;
  }

  document.addEventListener("click",event=>{
    const opt=event.target.closest("[data-entry-option]");
    if(opt){chooseOption(opt.dataset.entryQuestion,opt.dataset.entryOption);return;}

    if(event.target.closest("[data-entry-home]")){hideCustomScreens();document.getElementById("simpleHome")?.classList.add("active");window.scrollTo({top:0,behavior:"smooth"});return;}
    if(event.target.closest("[data-entry-restart]")){state.answers={};state.destinationId="";renderQuestion("q_entry_situation");return;}
    if(event.target.closest("[data-entry-unknown]")){routeToDestination("guided_orientation");return;}
    if(event.target.closest("[data-entry-fast-help]")){state.fromAdminHome=false;state.destinationId="foundation_recovery";state.difficultTopic="";renderDifficultHelp();return;}
    if(event.target.closest("[data-entry-admin]")){state.difficultTopic="";renderDifficultHelp();return;}
    const topic=event.target.closest("[data-help-topic]");
    if(topic){renderDifficultHelp(topic.dataset.helpTopic);return;}
    if(event.target.closest("[data-help-back]")){
      if(state.fromAdminHome){hideCustomScreens();document.getElementById("simpleHome")?.classList.add("active");window.scrollTo({top:0,behavior:"smooth"});}
      else renderDestination(state.destinationId);
      return;
    }
    if(event.target.closest("[data-help-reset]")){state.difficultTopic="";renderDifficultHelp();return;}
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

  prioritizeAdminResults();
  ensureScreens();
  window.EcoTankEntryRouter={start};
})();
