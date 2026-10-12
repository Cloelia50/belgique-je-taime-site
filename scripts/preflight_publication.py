"""Prévol statique du site public Belgique, je t'aime.

Lecture seule, pas d'accès réseau, pas de publication ni de modification des
catalogues. Rapport JSON pour la revue avant toute nouvelle mise en ligne.
"""
from __future__ import annotations

import argparse
from datetime import datetime
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://cloelia50.github.io/belgique-je-taime-site/"
PUBLIC_PREFIX = "/belgique-je-taime-site/"


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag in {"a", "link", "script", "img"}:
            key = "href" if tag in {"a", "link"} else "src"
            if attrs.get(key):
                self.refs.append((tag, attrs[key]))


def target_path(page: Path, url: str):
    """Map only internal GitHub Pages URLs, preventing traversal."""
    if url.startswith(("#", "mailto:", "tel:", "javascript:", "data:", "blob:")):
        return None
    parsed = urlsplit(url)
    if parsed.scheme and parsed.scheme not in {"https", "http"}:
        return None
    if parsed.netloc and parsed.netloc.lower() != "cloelia50.github.io":
        return None
    pathname = unquote(parsed.path)
    if parsed.netloc:
        if not pathname.startswith(PUBLIC_PREFIX):
            return None
        relative = pathname[len(PUBLIC_PREFIX):]
        path = ROOT / relative
    elif pathname.startswith("/"):
        if not pathname.startswith(PUBLIC_PREFIX):
            return ("outside_project_root", url)
        path = ROOT / pathname[len(PUBLIC_PREFIX):]
    else:
        path = page.parent / pathname
    path = path.resolve()
    try:
        path.relative_to(ROOT)
    except ValueError:
        return ("path_traversal", url)
    if not path.suffix or pathname.endswith("/"):
        path /= "index.html"
    return path


def preflight(today=None):
    today = today or datetime.now(ZoneInfo("Europe/Brussels")).date()
    errors, warnings, facts = [], [], {}
    required = [
        "index.html", "activikids/index.html", "activikids/data/catalog.json",
        "cogito/index.html", "ecotank/index.html", "lirabelge/index.html",
        "lirabelge/ligne-editoriale.html", "analytics.js", "site.css",
    ]
    for rel in required:
        if not (ROOT / rel).is_file():
            errors.append(f"missing_file:{rel}")

    # Most important site and footer links, plus sitemap links.
    checked_links = 0
    for rel in [
        "index.html", "a-propos.html", "methodologie.html",
        "confidentialite.html", "signaler.html",
        "lirabelge/ligne-editoriale.html",
    ]:
        path = ROOT / rel
        if not path.exists():
            errors.append(f"missing_page:{rel}")
            continue
        parser = Links()
        parser.feed(path.read_text(encoding="utf-8"))
        for tag, href in parser.refs:
            if href.startswith("#"):
                if tag == "a" and href[1:] and href[1:] not in parser.ids:
                    warnings.append(f"unknown_dynamic_anchor:{rel}:{href}")
                continue
            target = target_path(path, href)
            if target is None:
                continue
            if isinstance(target, tuple):
                errors.append(f"unsafe_internal_link:{rel}:{href}")
            elif not target.is_file():
                errors.append(f"broken_internal_link:{rel}:{href}")
            checked_links += 1
    facts["internal_refs_checked"] = checked_links

    sm = ROOT / "sitemap.xml"
    if sm.exists():
        parsed = ET.fromstring(sm.read_text(encoding="utf-8"))
        all_urls = [x.text or "" for x in parsed.iter() if x.tag.endswith("loc")]
        if len(set(all_urls)) != len(all_urls):
            errors.append("duplicate_sitemap_url")
        missing = []
        for url in all_urls:
            target = target_path(ROOT / "index.html", url)
            if isinstance(target, Path) and not target.is_file():
                missing.append(url)
        if missing:
            errors.extend("sitemap_target_missing:" + x for x in missing[:25])
            if len(missing) > 25:
                errors.append(f"sitemap_more_missing:{len(missing)-25}")
        facts["sitemap_urls"] = len(all_urls)
        facts["sitemap_missing_files"] = len(missing)
    else:
        errors.append("missing_sitemap")

    home = (ROOT / "index.html").read_text(encoding="utf-8")
    for href in ("ecotank/", "activikids/", "cogito/", "lirabelge/"):
        if f'href="{href}"' not in home:
            errors.append(f"homepage_missing_engine:{href}")
    if not re.search(r'Belveillance.{0,10000}Bientôt disponible', home, re.S):
        warnings.append("belveillance_state_unclear")
    if "Artisans, créateurs, producteurs" in home:
        warnings.append("belveillance_description_obsolete_adult_activity_modes")
    if 'href="volet6/"' not in home:
        facts["volet6_publication"] = "non_relie_a_l_accueil"
    facts["public_pages_mapped"] = 4

    catalog_path = ROOT / "activikids/data/catalog.json"
    html_path = ROOT / "activikids/index.html"
    if catalog_path.exists() and html_path.exists():
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        html = html_path.read_text(encoding="utf-8")
        match = re.search(
            r'<script\s+type="application/json"\s+id="ak-data">([\s\S]*?)</script>',
            html,
        )
        if not match:
            errors.append("activikids_embedded_data_absent")
        elif json.loads(match.group(1)) != catalog:
            errors.append("activikids_embedded_catalog_differs_from_external_json")
        events = catalog.get("events", [])
        ids = [x.get("id") for x in events]
        if any(not x for x in ids) or len(ids) != len(set(ids)):
            errors.append("activikids_duplicate_or_empty_ids")
        if not events:
            errors.append("activikids_no_events")
        facts["activikids_events"] = len(events)
        facts["activikids_asof"] = catalog.get("asof")
        try:
            days = (today - datetime.strptime(catalog["asof"], "%Y-%m-%d").date()).days
            facts["activikids_catalogue_age_days"] = days
            if days > 1:
                warnings.append(f"activikids_catalogue_outdated:{days}_days")
            if days > 7:
                errors.append(f"activikids_catalogue_too_old:{days}_days")
            if days < 0:
                errors.append("activikids_catalogue_future_dated")
        except (KeyError, ValueError, TypeError):
            errors.append("activikids_catalogue_asof_invalid")
        if "window.Activikids" not in html or "function passDate(" not in html:
            errors.append("activikids_filter_logic_missing")

    cogito_path = ROOT / "cogito/index.html"
    if cogito_path.is_file():
        c = cogito_path.read_text(encoding="utf-8")
        match = re.search(
            r'<script\s+type="application/json"\s+id="cogito-data">([\s\S]*?)</script>',
            c,
        )
        if not match:
            errors.append("cogito_embedded_agenda_absent")
        else:
            dataset = json.loads(match.group(1))
            events = dataset.get("events", [])
            ids = [x.get("id") for x in events]
            if len(set(ids)) != len(ids) or any(not x for x in ids):
                errors.append("cogito_duplicate_or_empty_ids")
            if dataset.get("export_meta", {}).get("event_count") != len(events):
                errors.append("cogito_export_count_mismatch")
            old = sum(str(x.get("date") or "") < today.isoformat() for x in events)
            if old:
                warnings.append(f"cogito_past_dated_events_still_visible:{old}")
            if any(not x.get("official_url") for x in events):
                warnings.append("cogito_entries_missing_official_url")
            if any("interest_score" in x or "score_breakdown" in x for x in events):
                errors.append("cogito_private_scores_exposed")
            facts["cogito_public_events"] = len(events)
            facts["cogito_expired_rows"] = old
            facts["cogito_generated_on"] = dataset.get("export_meta", {}).get("generated_on")

    return {
        "audit": "bjt-public-preflight-20261012-v1",
        "mode": "local_static_read_only",
        "deployed_http_checked": False,
        "today_brussels": today.isoformat(),
        "ready_for_publication": not errors and not warnings,
        "blocking_errors": errors,
        "warnings": warnings,
        "facts": facts,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", default="preflight-public.json")
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    report = preflight()
    target = Path(args.report)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.strict and (report["blocking_errors"] or report["warnings"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
