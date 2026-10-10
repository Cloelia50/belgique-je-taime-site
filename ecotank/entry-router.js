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
        '<div class="entry-route-actions entry-fast-help"><button type="button" class="primary" data-entry-fast-help>Mes droits sont coupés ou ma situation est compliquée : voir des premières pistes</button><button type="button" data-entry-access-help>Je ne peux pas me connecter (eID, itsme, GSM, PIN, e-mail…)</button></div>'+
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
    // Sources vérifiées manuellement pour les deux refus (CPAS + ONEM).
    // Les liens de la base officielle restent prioritaires pour les autres situations.
    const refusalSources={
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
        ["Pas de SMS : vérifier si une eID fonctionne déjà","L'activation itsme requiert un numéro de GSM et un code reçu par SMS, même avec un lecteur eID. Si vous avez déjà une carte eID et un lecteur fonctionnels, choisissez plutôt la rubrique Lecteur eID fonctionnel mais itsme bloqué : aucune nouvelle activation n'est nécessaire pour utiliser la connexion eID sur les services compatibles.",[["csam_eid_steps","Se connecter avec une eID sans itsme"],["itsme_sms_confirm","Pourquoi itsme demande un SMS"]]],
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
    const urgentIds=new Set(["urgent_food","urgent_shelter","urgent_care","urgent_income","urgent_refusal","urgent_access"]);
    const firstChoices=choices.filter(([id])=>urgentIds.has(id));
    const otherChoices=choices.filter(([id])=>!urgentIds.has(id));
    const title={
      overview:"De quoi avez-vous besoin aujourd’hui ?",
      urgent_food:"Trouver de quoi manger maintenant",
      urgent_shelter:"Trouver un hébergement pour cette nuit",
      urgent_care:"Recevoir des soins sans couverture",
      urgent_income:"Retrouver des ressources sans attendre",
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
    const visibleCards=selected==="overview"?[guides.urgent_food[0],guides.urgent_shelter[0],guides.urgent_care[0]]:cards.slice(0,3);
    const moreCards=selected==="overview"?cards:cards.slice(3);
    const choicesHtml=list=>list.map(([id,label])=>
      '<button type="button" class="entry-choice" data-help-topic="'+id+'" aria-pressed="'+(id===selected?'true':'false')+'">'+esc(label)+'</button>'
    ).join("");
    const cardHtml=list=>list.map((card,i)=>
      '<article class="business-card '+(i===0?'priority':'')+'"><h3>'+(i+1)+'. '+esc(card[0])+'</h3><p>'+esc(card[1])+'</p>'+
      '<div class="resource-actions">'+card[2].map(link=>safeLink(link[0],link[1])).filter(Boolean).join("")+'</div></article>'
    ).join("");
    const needSection=
      '<section class="urgent-needs"><h3>Ce qui est urgent pour vous</h3>'+
      '<div class="urgent-needs-grid">'+choicesHtml(firstChoices)+'</div>'+
      '<details class="urgent-secondary"><summary>Autres situations : deux refus, séjour, banque, papiers, logement…</summary>'+
      '<div class="entry-choice-grid">'+choicesHtml(otherChoices)+'</div></details></section>';
    const actionSection=
      (selected==="refusals"?'<p class="business-safety"><strong>Les refus sont déjà connus.</strong> Nous ne proposons pas une nouvelle première demande CPAS, mais d’autres démarches et les recours.</p>':"")+
      '<h3 class="urgent-actions-title">'+(selected==="overview"?"Premiers gestes possibles":"À faire en premier")+'</h3>'+
      '<div class="business-grid">'+cardHtml(visibleCards)+'</div>'+
      (moreCards.length?'<details class="ecotank-more-actions"><summary>Autres démarches et détails ('+moreCards.length+')</summary>'+
        '<div class="business-grid">'+cardHtml(moreCards)+'</div></details>':"");
    host.innerHTML=
      '<div class="entry-topline"><button type="button" class="linkish" data-help-back>← Retour</button><span class="entry-step">Sans questionnaire</span></div>'+
      '<div class="simple-kicker">Aides concrètes à Bruxelles</div>'+
      '<h2>'+esc(title)+'</h2>'+
      '<p>'+(selected==="overview"?"Un clic suffit : choisissez votre besoin et découvrez les premières démarches.":"Voici quoi faire d’abord, sans autre formulaire obligatoire. Les droits et les places ne sont pas garantis.")+'</p>'+
      (selected==="overview"?
        needSection+actionSection:
        actionSection+'<div class="entry-route-actions"><button type="button" class="linkish" data-help-reset>← Choisir un autre besoin</button></div>'+needSection)+
      '<div class="entry-route-actions access-shortcut"><button type="button" data-help-access>Accès numérique bloqué ? Alternative sans itsme</button></div>'+
      '<div class="entry-route-actions"><button type="button" class="linkish" data-help-reset>Revenir aux premières aides</button>'+
      '<button type="button" data-help-detailed>Examiner ma situation en détail (facultatif)</button></div>'+
      '<p class="business-safety">Ne communiquez jamais ici votre code PIN, mot de passe ou numéro national. Urgence médicale vitale : 112.</p>';
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
    if(event.target.closest("[data-entry-access-help]")){state.fromAdminHome=false;state.accessIssue="";state.accessService="general";renderAccessHelp();return;}
    if(event.target.closest("[data-help-access]")){state.accessIssue="";state.accessService="general";renderAccessHelp();return;}
    if(event.target.closest("[data-access-back]")){renderDifficultHelp();return;}
    if(event.target.closest("[data-access-reset]")){state.accessIssue="";state.accessService="general";renderAccessHelp();return;}
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
  window.EcoTankEntryRouter={start};
})();
