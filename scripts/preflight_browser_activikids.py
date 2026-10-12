"""Essai navigateur du catalogue public Activikids, sans publication."""
from __future__ import annotations

import json
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
URL = (ROOT / "activikids/index.html").resolve().as_uri()
TEST_DAY = "2026-10-12"
EXPECTED = {
    "today": ["2026-10-12", "2026-10-12"],
    "tomorrow": ["2026-10-13", "2026-10-13"],
    "wed": ["2026-10-14", "2026-10-14"],
    "weekend": ["2026-10-17", "2026-10-18"],
    "holidays": ["2026-10-19", "2026-11-01"],
}


def run():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--allow-file-access-from-files")
    options.add_argument("--window-size=1280,960")
    driver = webdriver.Chrome(options=options)
    driver.execute_cdp_cmd(
        "Emulation.setTimezoneOverride", {"timezoneId": "Europe/Brussels"}
    )
    wait = WebDriverWait(driver, 15)
    results = {}
    try:
        driver.get(URL + "?today=" + TEST_DAY + "&now=12:00")
        wait.until(lambda d: d.execute_script("return !!window.Activikids"))
        initial = driver.execute_script(
            "return {events:window.Activikids.data.events.length,"
            "today:window.Activikids.temporal.today}"
        )
        if initial["events"] < 1 or initial["today"] != TEST_DAY:
            raise AssertionError("Date ou catalogue initial incorrect: " + repr(initial))
        for value, expected_range in EXPECTED.items():
            button = wait.until(lambda d: d.find_element(
                By.CSS_SELECTOR,
                '[data-single="when"][data-v="' + value + '"]'
            ))
            driver.execute_script("arguments[0].click()", button)
            wait.until(lambda d: d.execute_script(
                "return window.Activikids.state.when"
            ) == value)
            actual = driver.execute_script(
                "return {"
                "range:window.Activikids.temporal.range(arguments[0]),"
                "count:document.querySelector('[data-el=\"count\"]')?.innerText||'',"
                "ready:document.querySelector('#activikids')?.classList.contains('ak-ready')"
                "}", value
            )
            if actual["range"] != expected_range or not actual["ready"]:
                raise AssertionError(f"{value}: {actual} != {expected_range}")
            results[value] = actual

        date_control = driver.find_element(By.CSS_SELECTOR, '[data-el="date"]')
        driver.execute_script(
            "const input=arguments[0];input.value='2026-10-15';"
            "input.dispatchEvent(new Event('change',{bubbles:true}));",
            date_control,
        )
        wait.until(lambda d: d.execute_script(
            "return window.Activikids.state.when==='date' &&"
            "window.Activikids.state.date==='2026-10-15'"
        ))
        results["custom_date"] = driver.execute_script(
            "return window.Activikids.temporal.range('date')"
        )
        if results["custom_date"] != ["2026-10-15", "2026-10-15"]:
            raise AssertionError("Calendrier personnalisé incorrect")
        results["catalogue_events"] = initial["events"]
        results["status"] = "PASS"
        print(json.dumps(results, ensure_ascii=False, indent=2))
    finally:
        driver.quit()


if __name__ == "__main__":
    run()
