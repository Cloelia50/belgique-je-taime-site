#!/usr/bin/env python3
"""Contrôle navigateur ciblé d'EcoTank : vrai HTML/CSS/JS, sans réseau externe."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parent.parent
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/ecotank/"
opts = Options()
for arg in ("--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"):
    opts.add_argument(arg)
opts.add_experimental_option("mobileEmulation", {
    "deviceMetrics": {"width": 390, "height": 844, "pixelRatio": 2, "touch": True}
})
driver = webdriver.Chrome(options=opts)
driver.set_page_load_timeout(60)
def ready(selector):
    return WebDriverWait(driver, 25).until(
        lambda d: next((e for e in d.find_elements(By.CSS_SELECTOR, selector) if e.is_displayed()), None)
    )
def home():
    driver.get(url)
    ready("#ecotankHomeQuickAccess [data-ecotank-home='urgent']")
    assert len(driver.find_elements(By.CSS_SELECTOR, "#simpleHome .simple-home-buttons button")) == 2
    assert driver.execute_script("return document.documentElement.scrollWidth <= innerWidth + 5")
def tap(selector):
    el = ready(selector)
    driver.execute_script("arguments[0].scrollIntoView({block:'center',behavior:'instant'})", el)
    el.click()

try:
    home()
    for key in ("urgent", "administration", "blocked", "business"):
        assert driver.find_elements(By.CSS_SELECTOR, f"#ecotankHomeQuickAccess [data-ecotank-home='{key}']")
    tap("#ecotankHomeQuickAccess [data-ecotank-home='urgent']")
    ready("#simpleDifficultHelp.active .urgent-needs-grid [data-help-topic]")
    print("OK aide immédiate depuis l'accueil", flush=True)

    home()
    tap("#ecotankHomeQuickAccess [data-ecotank-home='administration']")
    ready("#simpleAdminWizard.active #simpleAdminQuestionHost")
    assert driver.find_element(By.ID, "simpleAdminQuestionHost").text.strip()
    print("OK démarches administratives", flush=True)

    home()
    tap("#ecotankHomeQuickAccess [data-ecotank-home='blocked']")
    ready("#simpleDifficultHelp.active #entryDifficultHost")
    assert len(driver.find_element(By.ID,"entryDifficultHost").text) > 30
    print("OK dépannage des accès numériques", flush=True)

    home()
    tap("#ecotankHomeQuickAccess [data-ecotank-home='business']")
    ready("#simpleEntryRouter.active [data-ecotank-business-kind='self_employed']")
    tap("[data-ecotank-business-kind='self_employed']")
    ready("#simpleEntryRouter.active [data-entry-option]")
    assert "activité" in driver.find_element(By.ID,"entryRouterHost").text.lower()
    print("OK parcours indépendant", flush=True)

    home()
    tap("#ecotankHomeQuickAccess [data-ecotank-home='business']")
    tap("[data-ecotank-business-kind='company_director']")
    ready("#simpleEntryRouter.active [data-entry-option]")
    assert "entreprise" in driver.find_element(By.ID,"entryRouterHost").text.lower()
    print("OK parcours société", flush=True)

    home()
    tap("#simpleHome .simple-home-buttons button")
    ready("#simpleEntryRouter.active [data-general-group]")
    print("OK ancienne entrée économies conservée", flush=True)
finally:
    driver.quit()
    server.shutdown()
