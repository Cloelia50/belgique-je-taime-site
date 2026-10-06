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
    ["simpleEntryRouter","simpleEntryDestination","simpleBusinessHome"].forEach(id=>document.getElementById(id)?.classList.remove("active"));
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

  function handoffAdmin(){
    hideCustomScreens();
    const b=document.getElementById("simpleAdminStart");
    if(b)b.click();
  }

  function renderDestination(id){
    const d=destination(id)||destination("guided_orientation");
    const host=document.getElementById("entryDestinationHost");
    if(!host||!d)return;
    const foundation=state.answers.q_foundations_ok;
    const needsRepair=(foundation==="no_or_unknown");
    const someRepair=(foundation==="some_problems");
    const adminFirst=id==="foundation_recovery"||id==="international_special"||id==="guided_orientation"||needsRepair;

    let context="";
    if(id==="social_protection"&&answerLabel("q_replacement_income_type"))context='<div class="business-context"><span class="business-pill">'+esc(answerLabel("q_replacement_income_type"))+'</span></div>';
    if(needsRepair)context+='<div class="entry-route-note warning"><strong>On commence par les bases.</strong><br>Vous gardez votre parcours « '+esc(d.title||"")+' », mais identité, adresse, mutualité, compte, courrier ou accès numérique peuvent être remis en ordre avant les autres démarches.</div>';
    else if(someRepair)context+='<div class="entry-route-note"><strong>Quelques bases sont à vérifier.</strong><br>Vous pouvez continuer vos recherches d’économies tout en traitant les blocages administratifs en parallèle.</div>';

    let actions="";
    if(adminFirst){
      actions+='<button type="button" class="primary" data-entry-admin>Remettre ma situation en ordre</button>';
      if(id!=="foundation_recovery"&&id!=="international_special"&&id!=="guided_orientation"){
        actions+='<button type="button" data-entry-general>Continuer aussi vers mes économies</button>';
      }
    }else{
      actions+='<button type="button" class="primary" data-entry-general>Continuer dans mon parcours</button>';
      if(someRepair)actions+='<button type="button" data-entry-admin>Vérifier mes bases administratives</button>';
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
    return [state.answers.q_company_stage,state.answers.q_company_goal,state.answers.q_business_stage].filter(Boolean);
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
      intake.questions.map(q=>'<label>'+esc(q.label)+'<select data-business-intake="'+esc(q.id)+'"><option value="">Je préfère ne pas préciser</option>'+(q.options||[]).map(o=>'<option value="'+esc(o)+'">'+esc(o)+'</option>').join("")+'</select></label>').join("")+
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
      '<div class="entry-route-actions"><button type="button" class="primary" data-business-refresh>Mettre à jour les priorités</button><button type="button" data-entry-personal>Je veux aussi vérifier mes droits personnels</button><button type="button" class="linkish" data-entry-home>Accueil</button></div>';
    showScreen("simpleBusinessHome");
  }

  function openEmail(cardId){
    const d=destination(state.destinationId);
    const card=(d?.resource_cards||[]).find(x=>x.id===cardId);
    const box=document.querySelector('[data-business-email-box="'+CSS.escape(cardId)+'"]');
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
    const b=document.querySelector('[data-copy-business-email="'+CSS.escape(cardId)+'"]');
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
    if(event.target.closest("[data-entry-admin]")){handoffAdmin();return;}
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

  ensureScreens();
  window.EcoTankEntryRouter={start};
})();
