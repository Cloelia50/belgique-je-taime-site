#!/usr/bin/env python3
"""Test d'intégration réel : EcoTank économies d'abord, sans publication d'aides privées."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait

ROOT = Path(__file__).resolve().parent.parent
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server=ThreadingHTTPServer(("127.0.0.1",0),partial(QuietHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
url=f"http://127.0.0.1:{server.server_port}/ecotank/"
opts=Options()
for arg in ("--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu"):
    opts.add_argument(arg)
opts.add_experimental_option("mobileEmulation",{"deviceMetrics":{"width":390,"height":844,"pixelRatio":2,"touch":True}})
driver=webdriver.Chrome(options=opts)
driver.set_page_load_timeout(70)
def visible(selector):
    return WebDriverWait(driver,25).until(lambda d: next((e for e in d.find_elements(By.CSS_SELECTOR,selector) if e.is_displayed()),None))
def click(selector):
    el=visible(selector)
    driver.execute_script("arguments[0].scrollIntoView({block:'center',behavior:'instant'})",el)
    el.click()
def reset():
    driver.get(url)
    visible("#ecotankHomeQuickAccess.economies-first [data-ecotank-home='savings']")
    assert driver.execute_script("return document.documentElement.scrollWidth <= innerWidth + 5")

try:
    reset()
    assert "économies" in driver.find_element(By.CSS_SELECTOR,"#simpleHome h1").text.lower()
    assert len(driver.find_elements(By.CSS_SELECTOR,"#simpleHome .simple-home-buttons button"))==2
    assert not driver.find_element(By.CSS_SELECTOR,"#simpleHome .simple-home-buttons").is_displayed()
    print("OK économies prioritaires, ancienne impasse masquée",flush=True)

    click("[data-ecotank-home='savings']")
    visible("#simpleWizard.active [data-choice='employment']")
    assert "situation principale" in driver.find_element(By.ID,"simpleQuestionHost").text.lower()
    click("[data-choice='employment'][data-value='employee']")
    visible("#simpleWizard.active [data-extra='pet']")
    click("[data-extra='pet']")
    click("[data-extra-continue]")
    visible("#simpleWizard.active #sqCommune")
    Select(driver.find_element(By.ID,"sqCommune")).select_by_visible_text("Auderghem")
    click("[data-continue='commune']")
    visible("#simpleResults.active .simple-result")
    results=driver.find_elements(By.CSS_SELECTOR,"#simpleResultsList .simple-result")
    assert len(results)>0
    assert all(x.find_elements(By.CSS_SELECTOR,".ecotank-obtention") for x in results)
    assert driver.find_elements(By.CSS_SELECTOR,"#simpleSituationGroups")
    assert "démarche" in driver.find_element(By.ID,"simpleResultsList").text.lower()
    print("OK situation > besoins cumulables > commune > résultats, badges démarches",flush=True)

    click("#simpleRefineAnswers")
    visible("#simpleWizard.active #sqAge")
    print("OK affinage facultatif, patrimoine de profils préservé",flush=True)

    reset()
    click("[data-ecotank-home='urgent']")
    visible("#simpleDifficultHelp.active .urgent-needs-grid")
    print("OK urgence disponible en accès secondaire",flush=True)

    reset()
    click("[data-ecotank-home='administration']")
    visible("#simpleAdminWizard.active #simpleAdminQuestionHost")
    print("OK parcours administratif conservé",flush=True)

    reset()
    click("[data-ecotank-home='blocked']")
    visible("#simpleDifficultHelp.active #entryDifficultHost")
    print("OK dépannage numérique conservé",flush=True)

    # Aucun formulaire envoyé ; aucun changement vers les autres moteurs.
finally:
    driver.quit()
    server.shutdown()
