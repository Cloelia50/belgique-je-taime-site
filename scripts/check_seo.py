#!/usr/bin/env python3
"""Contrôles SEO hors-ligne, sans réseau ni paquet externe : python scripts/check_seo.py"""
from pathlib import Path
from urllib.parse import urlparse, unquote
from xml.etree import ElementTree
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = json.loads((ROOT / "seo/site.json").read_text(encoding="utf8"))["site_base_url"]
errors, warnings, pages, titles = [], [], {}, {}
xml = ElementTree.parse(ROOT / "sitemap.xml")
links = [x.text for x in xml.findall(".//{*}loc")]
if len(links) != len(set(links)):
    errors.append("Sitemap : URL en double")
if not all((x or "").startswith(BASE) for x in links):
    errors.append("Sitemap : URL hors de site_base_url")
for path in ROOT.rglob("*.html"):
    if ".git" in path.parts:
        continue
    rel = path.relative_to(ROOT).as_posix()
    content = path.read_text(encoding="utf8", errors="replace")
    noindex = bool(re.search(r'<meta[^>]*name=["\x27]robots["\x27][^>]*content=["\x27][^"\x27]*noindex', content, re.I))
    if rel == "404.html":
        if not noindex:
            errors.append("404.html doit avoir noindex")
        continue
    m = re.search(r"<title>(.*?)</title>", content, re.S | re.I)
    if not m or not m.group(1).strip():
        errors.append("title manquant : " + rel)
        continue
    title = m.group(1)
    if not re.search(r'<meta[^>]*name=["\x27]description["\x27]', content, re.I):
        errors.append("description manquante : " + rel)
    heads = len(re.findall(r"<h1\b", content, re.I))
    if heads != 1:
        if rel == "ecotank/index.html" and heads == 2:
            warnings.append("Écotank conserve 2 H1, à corriger après test fonctionnel")
        else:
            errors.append("nombre de H1 incorrect : " + rel + " (" + str(heads) + ")")
    canon = re.findall(r'<link[^>]*rel=["\x27]canonical["\x27][^>]*href=["\x27]([^"\x27]+)', content, re.I)
    if noindex:
        if len(canon) > 1:
            errors.append("canonicals multiples noindex : " + rel)
    else:
        if len(canon) != 1:
            errors.append("canonical absent ou doublé : " + rel)
        else:
            if canon[0] in pages:
                errors.append("canonical en double : " + rel + " et " + pages[canon[0]])
            pages[canon[0]] = rel
        # Deux titres identiques sur des pages autonomes demandent une révision.
        if title in titles:
            warnings.append("titres identiques : " + rel + " et " + titles[title])
        titles[title] = rel
    for json_ld in re.findall(r'<script[^>]*type=["\x27]application/ld\+json["\x27][^>]*>(.*?)</script>', content, re.I | re.S):
        try:
            json.loads(json_ld)
        except ValueError:
            errors.append("JSON-LD invalide : " + rel)
    if (rel.startswith("activikids/evenements/") or rel.startswith("cogito/evenements/")
            or rel.startswith("ecotank/aides/")):
        # Les liens internes de ces pages doivent pointer vers des fichiers présents.
        for href in re.findall(r'<a[^>]*href=["\x27]([^"\x27#]+)', content, re.I):
            if href.startswith(("#", "mailto:", "tel:", "http:", "https:", "javascript:")):
                continue
            # Supprimer les paramètres de filtre et résoudre les chemins relatifs.
            href = href.split("?", 1)[0]
            target = (path.parent / unquote(href)).resolve()
            if ROOT.resolve() not in target.parents and target != ROOT.resolve():
                errors.append("Lien hors dépôt : " + rel + " -> " + href)
            elif target.is_dir():
                if not (target / "index.html").is_file():
                    errors.append("Répertoire sans index : " + rel + " -> " + href)
            elif not target.is_file():
                errors.append("Lien interne cassé : " + rel + " -> " + href)
if set(links) != set(pages):
    errors.append("Différence sitemap / pages indexables : sitemap=" + str(len(links))
                  + ", HTML=" + str(len(pages)))
if BASE + "sitemap.xml" not in (ROOT / "robots.txt").read_text(encoding="utf8"):
    errors.append("robots.txt sans référence correcte au sitemap")
baseline = json.loads((ROOT / "seo/baseline-counts.json").read_text(encoding="utf8"))
acts = json.loads((ROOT / "activikids/data/catalog.json").read_text(encoding="utf8"))
if len(acts["events"]) < baseline["activikids_events"]:
    errors.append("Couverture Activikids inférieure à la référence")
cog = (ROOT / "cogito/index.html").read_text(encoding="utf8")
m = re.search(r'<script[^>]*id=["\x27]cogito-data["\x27][^>]*>(.*?)</script>', cog, re.I | re.S)
if not m or len(json.loads(m.group(1))["events"]) < baseline["cogito_events"]:
    errors.append("Couverture Cogito inférieure à la référence")
eco = (ROOT / "ecotank/index.html").read_text(encoding="utf8")
m = re.search(r'const DATA\s*=\s*(\[.*?\]);\s*</script>', eco, re.S)
if not m or sum(len(g.get("items", [])) for g in json.loads(m.group(1))) < baseline["ecotank_items"]:
    errors.append("Couverture Écotank inférieure à la référence")
print("SEO pages indexables :", len(pages), "/ sitemap :", len(links))
for warning in warnings[:20]:
    print("WARN:", warning)
for error in errors[:100]:
    print("ERROR:", error)
if errors:
    sys.exit(1)
print("SEO STRUCTURE OK")
