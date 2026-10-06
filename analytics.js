(function(){
  'use strict';
  var API='https://counterapi.com/api';
  var NS='belgique-je-taime';

  function sectionFromPath(){
    var parts=location.pathname.split('/').filter(Boolean);
    var repoIndex=parts.indexOf('belgique-je-taime-site');
    var section=repoIndex>=0?parts[repoIndex+1]:(parts[0]||'');
    return (section||'home').toLowerCase();
  }

  function privacyPreference(){
    return navigator.globalPrivacyControl===true ||
      navigator.doNotTrack==='1' ||
      window.doNotTrack==='1';
  }

  var section=sectionFromPath();
  var disabled=privacyPreference() || section==='ecotank' || section==='confidentialite.html';

  function hit(action,key){
    if(disabled)return;
    if(location.protocol!=='http:'&&location.protocol!=='https:')return;
    var url=API+'/'+encodeURIComponent(NS)+'/'+encodeURIComponent(action)+'/'+encodeURIComponent(key)+'?trackOnly=true';
    try{
      fetch(url,{
        method:'GET',
        mode:'no-cors',
        credentials:'omit',
        referrerPolicy:'no-referrer',
        keepalive:true,
        cache:'no-store'
      }).catch(function(){});
    }catch(err){}
  }

  if(!disabled)hit('view',section);

  document.addEventListener('click',function(ev){
    if(disabled)return;
    var target=ev.target&&ev.target.closest?ev.target.closest('[data-bjt-action]'):null;
    if(!target)return;
    hit(target.getAttribute('data-bjt-action')||'click',target.getAttribute('data-bjt-key')||section);
  },true);

  window.BelgiqueJeTaimeAnalytics={hit:hit,section:section,namespace:NS,disabled:disabled};
})();