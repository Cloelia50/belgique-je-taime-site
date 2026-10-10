#!/usr/bin/env python3
"""Essais Chromium mobile de l'EcoTank complet (et non DOM simulé)."""
import functools, http.server, json, pathlib, threading
from urllib.request import urlopen
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

ROOT=pathlib.Path(__file__).resolve().parent.parent
DEST=ROOT/"reports/ecotank-mobile"
DEST.mkdir(parents=True,exist_ok=True)
BASE="http://127.0.0.1:8765/ecotank/"
PUBLIC="https://cloelia50.github.io/belgique-je-taime-site/ecotank/"
CASES=[
 ("manger","urgent_food","fdss.be"),
 ("dormir","urgent_shelter","samusocial.be"),
 ("soins","urgent_care","medecinsdumonde.be"),
 ("revenus","urgent_income","actiris.brussels"),
 ("recours","urgent_refusal","rechtbanken-tribunaux.be"),
 ("identification","urgent_access","csam.be"),
 ("double_refus","refusals","actiris.brussels"),
 ("sans_logement","housing","samusocial.be"),
 ("sans_mutuelle","care_zero","inami.fgov.be"),
 ("asile_sans_accueil","urgent_asylum","fedasil.be"),
 ("sans_titre_et_soins","urgent_irregular","medecinsdumonde.be"),
 ("eid_numero_perdu","eid_works_no_phone","csam.be"),
 ("plus_de_telephone","no_phone","csam.be")]
results=[]

class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

def report(key,passed,info):
 results.append({"scenario":key,"ok":bool(passed),"mesures":info})
 print(("OK " if passed else "ECHEC ")+key+" "+str(info)[:330],flush=True)

def start_chrome(w,h):
 o=Options()
 for arg in ["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu"]:
  o.add_argument(arg)
 o.page_load_strategy="eager"
 o.add_experimental_option("mobileEmulation",{"deviceMetrics":{
  "width":w,"height":h,"pixelRatio":2,"touch":True}})
 d=webdriver.Chrome(options=o)
 d.set_page_load_timeout(55)
 return d

def click(d,selector):
 e=WebDriverWait(d,15).until(lambda x:x.find_element(By.CSS_SELECTOR,selector))
 e.click()

def metrics(d):
 return d.execute_script("""
 const h=document.querySelector('#entryDifficultHost'),
 box=h?.querySelector(':scope > .business-grid'),
 link=box?.querySelector('a[href]');
 return {title:h?.querySelector('h2')?.textContent, width:innerWidth,
 height:innerHeight,documentWidth:document.documentElement.scrollWidth,
 sixChoices:h?.querySelectorAll('.urgent-needs-grid [data-help-topic]').length,
 actions:box?.querySelectorAll(':scope > article').length||0,
 firstLinkY:link?Math.round(link.getBoundingClientRect().top):null,
 firstLinkAboveFold:!!link&&link.getBoundingClientRect().top<innerHeight,
 urls:Array.from(box?.querySelectorAll('a[href]')||[],x=>x.href),
 otherCollapsed:h?.querySelector('details.ecotank-more-actions')?.open===false,
 textLength:h?.innerText?.length||0};
 """)

def choose(d,topic):
 selector='[data-help-topic="'+topic+'"]'
 e=d.find_element(By.CSS_SELECTOR,selector)
 if not e.is_displayed():
  click(d,"#entryDifficultHost .urgent-secondary summary")
 click(d,selector)
 WebDriverWait(d,12).until(lambda x:bool(x.find_elements(
  By.CSS_SELECTOR,"#entryDifficultHost > .business-grid > article")))

def run(w,h):
 name=f"{w}x{h}"
 d=start_chrome(w,h)
 try:
  d.get(BASE)
  WebDriverWait(d,25).until(lambda x:x.execute_script(
   "return !!window.EcoTankEntryRouter && document.readyState !== 'loading'"))
  d.save_screenshot(str(DEST/(name+"-accueil.png")))
  home=d.execute_script("""
   let a=document.querySelector('#simpleAdminStart'),b=document.querySelector('#simpleStart');
   return {entry:!!a,standard:!!b,label:a?.innerText,
           firstIsUrgent:!!(a&&b&&a.compareDocumentPosition(b)&4),
           width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth};
  """)
  report(name+"-accueil",home["entry"] and home["standard"] and home["firstIsUrgent"],home)
  click(d,"#simpleAdminStart")
  WebDriverWait(d,20).until(lambda x:bool(x.find_elements(
   By.CSS_SELECTOR,"#simpleDifficultHelp.active .urgent-needs-grid")))
  first=metrics(d)
  d.save_screenshot(str(DEST/(name+"-six-besoins.png")))
  report(name+"-6-besoins",first["sixChoices"]==6,first)
  for label,topic,domain in CASES:
   try:
    choose(d,topic)
    m=metrics(d)
    ok=m["actions"]==3 and any(domain in u for u in m["urls"])
    report(name+"-"+label,ok,{**m,"domaine_recherche":domain})
    if label in ("manger","dormir","soins","double_refus","asile_sans_accueil","eid_numero_perdu"):
     d.save_screenshot(str(DEST/(name+"-"+label+".png")))
   except Exception as e:
    report(name+"-"+label,False,{"erreur":repr(e)[:220]})
    d.save_screenshot(str(DEST/(name+"-ERREUR-"+label+".png")))
  # L'entrée générale ne doit pas condamner à remplir un autre questionnaire.
  try:
   d.get(BASE)
   click(d,"#simpleStart")
   WebDriverWait(d,15).until(lambda x:bool(x.find_elements(
    By.CSS_SELECTOR,"#entryRouterHost [data-entry-fast-help]")))
   click(d,"[data-entry-fast-help]")
   WebDriverWait(d,12).until(lambda x:bool(x.find_elements(
    By.CSS_SELECTOR,"#entryDifficultHost .urgent-needs-grid")))
   report(name+"-entree-generale",True,"Aide immédiate après Commencer")
  except Exception as e:
   report(name+"-entree-generale",False,repr(e)[:220])
  # Contrôle en plus de la version effectivement publiée.
  if w==390:
   try:
    with urlopen(PUBLIC,timeout=15) as response: status=response.status
    d.get(PUBLIC)
    WebDriverWait(d,25).until(lambda x:x.execute_script(
     "return !!window.EcoTankEntryRouter"))
    click(d,"#simpleAdminStart")
    WebDriverWait(d,12).until(lambda x:bool(x.find_elements(
     By.CSS_SELECTOR,"#entryDifficultHost .urgent-needs-grid")))
    m=metrics(d)
    report(name+"-public",status==200 and m["sixChoices"]==6,m)
    d.save_screenshot(str(DEST/"390-public.png"))
   except Exception as e:
    results.append({"scenario":name+"-public","reserve":"Site publié non accessible ou propagation : "+repr(e)[:170]})
 finally:
  d.quit()

def main():
 server=http.server.ThreadingHTTPServer(("127.0.0.1",8765),functools.partial(Handler,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  for w,h in [(390,844),(360,740)]:
   try: run(w,h)
   except Exception as e: report(str(w)+"-navigateur",False,repr(e)[:400])
  failures=[x for x in results if x.get("ok") is False]
  summary={"tests_valides":sum(x.get("ok") is True for x in results),
   "tests_echoues":len(failures),"test_humain":False,
   "environnement":"Chromium headless en émulation tactile mobile ; vrai HTML/CSS/JS du dépôt",
   "observations":results}
  (DEST/"rapport.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2))
  rows=["# Audit navigateur mobile — EcoTank",
   f"Réussites : {summary['tests_valides']} — échecs : {len(failures)}",
   "Deux écrans : 390×844 et 360×740. Captures incluses.",
   "Les tests restent techniques : pas de bénéficiaires humains ni de confirmation d'éligibilité."]
  rows.extend(("- ✓ " if r.get("ok") else "- ✗ " if r.get("ok") is False else "- ? ")+r["scenario"]+
              " — "+str(r.get("reserve",r.get("mesures",{})))[:240] for r in results)
  (DEST/"rapport.md").write_text("\n".join(rows)+"\n")
  print("\n".join(rows),flush=True)
  if failures: raise SystemExit(1)
 finally: server.shutdown()

if __name__=="__main__": main()
