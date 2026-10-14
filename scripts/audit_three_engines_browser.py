#!/usr/bin/env python3
"""R6.5 — Real Chrome/JS smoke test for the three public cultural engines.

Tests actual checked-out public HTML and JSON over localhost, a simulated JSON
outage (CDP Network interception), and the deployed GitHub Pages URLs. No
mutation, API keys, surveillance, payment or recurrent workflow is required.
"""
from __future__ import annotations

import functools
import http.server
import json
import pathlib
import threading
from datetime import datetime, timezone
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEST = ROOT / "reports" / "r65-browser"
BASE_PUBLIC = "https://cloelia50.github.io/belgique-je-taime-site"
ENGINES = {
    "activikids": {
        "embedded": "ak-data",
        "embedded_key": "events",
        "floor": 1139,
        "api": "data/catalog.json",
        "api_key": "events",
        "blocked": ["*activikids/data/catalog.json*"],
    },
    "cogito": {
        "embedded": "cogito-data",
        "embedded_key": "events",
        "floor": 305,
        "api": "canonical.json",
        "api_key": "events",
        "api_floor": 18,
        "blocked": ["*cogito/canonical.json*"],
    },
    "belveillance": {
        "embedded": "bv-embedded-data",
        "embedded_key": "belveillance",
        "floor": 95,
        "api": "catalogue.json",
        "api_key": "items",
        "blocked": ["*belveillance/catalogue.json*", "*cogito/index.html*"],
    },
}
RESULTS = []


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def chrome():
    opts = Options()
    for arg in ("--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
                "--disable-gpu", "--window-size=1320,900"):
        opts.add_argument(arg)
    opts.page_load_strategy = "eager"
    driver = webdriver.Chrome(options=opts)
    driver.set_page_load_timeout(45)
    driver.set_script_timeout(25)
    return driver


def observe(driver, engine):
    config = ENGINES[engine]
    result = driver.execute_script("""
      const engine=arguments[0], id=arguments[1],key=arguments[2];
      let obj=null,error='';
      try {
        const e=document.getElementById(id);
        if (!e) throw Error('Missing embedded data '+id);
        obj=JSON.parse(e.textContent);
      } catch (e) { error=String(e); }
      const items=obj&&obj[key];
      const el=engine==='cogito'?document.getElementById('cogito-list'):
               engine==='belveillance'?document.getElementById('results'):null;
      const count=engine==='cogito'?document.getElementById('cogito-count'):
                  engine==='belveillance'?document.getElementById('count'):null;
      return {
        embedded:Array.isArray(items)?items.length:-1,
        unique:Array.isArray(items)?new Set(items.map(x=>x.id)).size:-1,
        ready:document.readyState,
        visible:document.body&&document.body.innerText.length>200,
        interactive:!!document.querySelector('button,input,select'),
        list_text:el?el.innerText.length:0,
        count_text:count?count.innerText.slice(0,90):'',
        cogito_runtime:engine==='cogito'?window.CogitoApp?.events?.length:null,
        error
      };
    """, engine, config["embedded"], config["embedded_key"])
    ok = (
        result["embedded"] >= config["floor"]
        and result["unique"] == result["embedded"]
        and result["visible"] is True
        and result["interactive"] is True
        and not result["error"]
        and (engine == "activikids" or result["list_text"] > 15)
    )
    if engine == "cogito":
        ok = ok and result["cogito_runtime"] >= config["floor"]
    return ok, result


def api_read(driver, engine):
    config = ENGINES[engine]
    payload = driver.execute_async_script("""
       const path=arguments[0], key=arguments[1], done=arguments[arguments.length-1];
       fetch(path,{cache:'no-store'}).then(async r=>{
         if (!r.ok) throw Error('HTTP '+r.status);
         return r.json();
       }).then(obj=>{
         const arr=obj&&obj[key];
         done({ok:Array.isArray(arr),count:Array.isArray(arr)?arr.length:-1,
           unique:Array.isArray(arr)?new Set(arr.map(x=>x.id)).size:-1});
       }).catch(e=>done({ok:false,count:-1,error:String(e).slice(0,130)}));
    """, config["api"], config["api_key"])
    floor = config.get("api_floor", config["floor"])
    return payload["ok"] and payload["count"] >= floor and payload["unique"] == payload["count"], payload


def check(driver, url, engine, mode, *, network_failure=False):
    label = engine+"-"+mode
    cfg = ENGINES[engine]
    try:
        driver.execute_cdp_cmd("Network.enable", {})
        driver.execute_cdp_cmd(
            "Network.setBlockedURLs",
            {"urls": cfg["blocked"] if network_failure else []})
        driver.get(url)
        WebDriverWait(driver, 24).until(
            lambda d: d.execute_script("return document.readyState !== 'loading'"))
        WebDriverWait(driver, 24).until(lambda d: observe(d,engine)[0])
        ok, item = observe(driver, engine)
        if not network_failure:
            api_ok, api = api_read(driver, engine)
            item["api"] = api
            ok = ok and api_ok
        item["network_failure_simulated"] = bool(network_failure)
        RESULTS.append({"scenario":label,"ok":bool(ok),"detail":item})
        print(("OK " if ok else "FAIL ")+label+" "+json.dumps(item,ensure_ascii=False)[:550],flush=True)
    except Exception as exc:
        safe = repr(exc)[:450]
        RESULTS.append({"scenario":label,"ok":False,"error":safe})
        print("FAIL "+label+" "+safe,flush=True)
        try:
            DEST.mkdir(parents=True, exist_ok=True)
            driver.save_screenshot(str(DEST/(label+".png")))
        except Exception:
            pass
    finally:
        try:
            driver.execute_cdp_cmd("Network.setBlockedURLs", {"urls":[]})
        except Exception:
            pass


def main():
    DEST.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(
        ("127.0.0.1",0), functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    root=f"http://127.0.0.1:{server.server_port}"
    driver=None
    try:
        driver=chrome()
        for engine in ENGINES:
            local=f"{root}/{engine}/"
            check(driver,local,engine,"local-javascript")
            check(driver,local,engine,"offline-json-fallback",network_failure=True)
            check(driver,f"{BASE_PUBLIC}/{engine}/",engine,"github-pages-live")
    finally:
        if driver:
            driver.quit()
        server.shutdown()
    failures=[r["scenario"] for r in RESULTS if not r["ok"]]
    report={
        "schema":"bjt-r65-browser-smoke-v1",
        "date_utc":datetime.now(timezone.utc).isoformat(),
        "browser":"real headless Google Chrome / Selenium",
        "scenarios":len(RESULTS),
        "passed":len(RESULTS)-len(failures),
        "failed":failures,
        "no_publication":True,"no_sheets_writes":True,
        "runs":RESULTS,
    }
    (DEST/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("R65_BROWSER_REPORT "+json.dumps(
        {"passed":report["passed"],"scenarios":report["scenarios"],
         "failed":report["failed"]},ensure_ascii=False),flush=True)
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
