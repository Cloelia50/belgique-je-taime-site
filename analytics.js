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

  function hit(action,key){
    if(location.protocol!=='http:'&&location.protocol!=='https:')return;
    var url=API+'/'+encodeURIComponent(NS)+'/'+encodeURIComponent(action)+'/'+encodeURIComponent(key)+'?trackOnly=true';
    try{
      fetch(url,{method:'GET',mode:'no-cors',keepalive:true,cache:'no-store'}).catch(function(){});
    }catch(err){}
  }

  var section=sectionFromPath();
  hit('view',section);

  document.addEventListener('click',function(ev){
    var target=ev.target&&ev.target.closest?ev.target.closest('[data-bjt-action]'):null;
    if(!target)return;
    var action=target.getAttribute('data-bjt-action')||'click';
    var key=target.getAttribute('data-bjt-key')||section;
    hit(action,key);
  },true);

  window.BelgiqueJeTaimeAnalytics={hit:hit,section:section,namespace:NS};
})();
