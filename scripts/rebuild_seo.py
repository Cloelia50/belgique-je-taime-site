#!/usr/bin/env python3
"""Régénération SEO gratuite : python scripts/rebuild_seo.py
Récupère uniquement les exports publics déjà dans le dépôt. Ne touche pas aux listes sources.
Pour tester l'expiration : SEO_AS_OF=2027-01-01 python scripts/rebuild_seo.py
"""
import json
import os
import re
import html
import unicodedata
from pathlib import Path
from datetime import date, datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
BASE = json.loads((ROOT / "seo/site.json").read_text(encoding="utf8"))["site_base_url"]
AS_OF = date.fromisoformat(os.environ.get("SEO_AS_OF", datetime.now(ZoneInfo("Europe/Brussels")).date().isoformat()))
if not BASE.endswith("/") or urlparse(BASE).scheme != "https":
    raise ValueError("site_base_url doit être une URL HTTPS terminée par /")

def e(x):
    return html.escape(str(x if x is not None else ""), quote=True)

def slug(x):
    x = unicodedata.normalize("NFD", str(x)).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", x).strip("-")[:65].strip("-") or "fiche"

def url_ok(x):
    return isinstance(x, str) and bool(re.match(r"^https?://[^\s<>\"']+$", x))

def write(rel, content):
    dest = ROOT / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding="utf8")

def load(rel, fallback=None):
    p = ROOT / rel
    return json.loads(p.read_text(encoding="utf8")) if p.exists() else (fallback if fallback is not None else {})

def web_path(rel):
    return "" if rel == "index.html" else rel[:-10] if rel.endswith("/index.html") else rel

def render(rel, title, description, contents, indexable=True):
    root = "../" * (len(Path(rel).parts) - 1)
    canonical = BASE + web_path(rel)
    head = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>' + e(title) + '</title><meta name="description" content="' + e(description[:155]) + '">'
            '<meta name="robots" content="' + ('index,follow' if indexable else 'noindex,follow') + '">'
            '<link rel="stylesheet" href="' + root + 'site.css">')
    if indexable:
        head += ('<link rel="canonical" href="' + e(canonical) + '">'
                 '<meta property="og:url" content="' + e(canonical) + '">'
                 '<meta property="og:title" content="' + e(title) + '">'
                 '<meta property="og:description" content="' + e(description[:155]) + '">')
    return (head + '</head><body><a class="skip" href="#contenu">Aller au contenu</a>'
            '<main id="contenu" class="page"><p><a href="' + root + '">Belgique, je t’aime</a></p>'
            + contents + '<p><a href="' + root + '">← Accueil</a></p></main></body></html>\n')

def ext_link(url, label):
    return '<a href="' + e(url) + '" target="_blank" rel="noopener noreferrer">' + e(label) + '</a>' if url_ok(url) else ''

def existing_path(old, key, prefix, label):
    record = old.get(key) or {}
    if isinstance(record, dict) and record.get("path", "").startswith(prefix) and record["path"].endswith("/index.html"):
        return record["path"]
    return prefix + slug(label) + "/index.html"

def archive(old, new):
    for key, record in old.items():
        if key in new or not isinstance(record, dict):
            continue
        rel = record.get("path", "")
        if not rel or not (ROOT / rel).is_file():
            continue
        body = ('<h1>Information à actualiser</h1><p>Cette édition ou piste ne figure plus '
                'parmi les éléments publiables de la base. Il ne faut pas la considérer comme actuelle.</p>'
                '<p>Retrouvez des renseignements à jour dans les moteurs du site et vérifiez auprès de la source.</p>')
        write(rel, render(rel, "Information à actualiser | Belgique, je t’aime",
                          "Information archivée à confirmer à la source.", body, False))

def hub(rel, title, intro, links):
    if not links:
        return False
    body = '<h1>' + e(title) + '</h1><p>' + e(intro) + '</p><ul>'
    body += ''.join('<li><a href="' + e(href) + '">' + e(name) + '</a></li>' for href, name in links)
    body += '</ul><p>Toutes les informations sujettes à changement doivent être vérifiées à leur source.</p>'
    write(rel, render(rel, title + " | Belgique, je t’aime", intro, body))
    return True

def read_exports():
    activ = load("activikids/data/catalog.json")
    cog_html = (ROOT / "cogito/index.html").read_text(encoding="utf8")
    cog_match = re.search(r'<script[^>]*id=["\x27]cogito-data["\x27][^>]*>(.*?)</script>', cog_html, re.S | re.I)
    eco_html = (ROOT / "ecotank/index.html").read_text(encoding="utf8")
    eco_match = re.search(r'const DATA\s*=\s*(\[.*?\]);\s*</script>', eco_html, re.S)
    if not cog_match or not eco_match:
        raise ValueError("Export Cogito/Écotank introuvable, génération arrêtée")
    cog = json.loads(cog_match.group(1))
    eco = json.loads(eco_match.group(1))
    if not isinstance(activ.get("events"), list) or not isinstance(cog.get("events"), list) or not isinstance(eco, list):
        raise ValueError("Structure inattendue, génération arrêtée")
    return activ, cog, eco

def build_events(module, events, old):
    prefix = module + "/evenements/"
    pages = {}
    links = []
    for event, edition in events:
        key = str(event["id"])
        name = str(event["n"] if module == "activikids" else event["title"])
        city = str(event.get("co") if module == "activikids" else event.get("city"))
        day = str(edition["s"] if module == "activikids" else event["date"])
        summary = str(edition.get("prog") if module == "activikids" else event["description"])
        source = str(edition["src"] if module == "activikids" else event["official_url"])
        rel = existing_path(old, key, prefix, name + "-" + city + "-" + key)
        details = []
        if module == "activikids":
            info = [("Lieu", edition.get("lieu") or event.get("lieu")),
                    ("Adresse", edition.get("adr") or event.get("adr")),
                    ("Horaire", edition.get("hs")), ("Prix indiqué", edition.get("prix") or event.get("prix")),
                    ("Public", event.get("age")), ("Organisateur", event.get("org"))]
        else:
            info = [("Lieu", event.get("location")), ("Heure", event.get("time")),
                    ("Modalité", event.get("mode")), ("Prix annoncé", event.get("price_label")),
                    ("Organisateur", event.get("organizer")), ("Thème", event.get("category"))]
        for k, v in info:
            if v:
                details.append("<dt><strong>" + e(k) + "</strong></dt><dd>" + e(v) + "</dd>")
        body = ('<p class="kicker">' + e(module.title()) + ' · ' + e(city) + '</p>'
                '<h1>' + e(name) + '</h1><p><strong>Date indiquée : <time datetime="' + e(day) + '">' + e(day) + '</time></strong></p>'
                '<p>' + e(summary) + '</p><h2>Informations pratiques</h2><dl>' + ''.join(details) + '</dl>'
                '<p>Les horaires, prix, conditions et annulations doivent être confirmés auprès de la source.</p>'
                '<p>' + ext_link(source, "Consulter la source") + '</p><p><a href="../">Tous les événements</a></p>')
        write(rel, render(rel, name + " à " + city + " | " + module.title(),
                          name + " à " + city + ", " + day + ". Programme, informations pratiques et source.", body))
        pages[key] = {"path": rel, "date": day}
        links.append((rel.split("/")[-2] + "/", name + " — " + city + " (" + day + ")"))
    links.sort(key=lambda pair: pair[1])
    if hub(prefix + "index.html", "Événements " + module.title() + " en Belgique",
           "Éditions futures datées et sourcées, à vérifier auprès des organisateurs.", links):
        indexable.append(prefix + "index.html")
    archive(old, pages)
    write("seo/generated-" + module + ".json", json.dumps(pages, ensure_ascii=False, indent=2) + "\n")
    indexable.extend(v["path"] for v in pages.values())
    return len(pages)

def build_ecotank(categories, old):
    current = {}
    master_links = []
    used_categories = {}
    for cat in categories:
        infos = []
        for item in cat.get("items", []):
            stamp = item.get("verifiedAt")
            if not (item.get("t") and len(item.get("d") or "") >= 120
                    and url_ok(item.get("src")) and stamp
                    and len(item.get("steps") or []) >= 2):
                continue
            try:
                valid_date = date.fromisoformat(stamp)
                if (AS_OF - valid_date).days > 180 or valid_date > AS_OF:
                    continue
            except (TypeError, ValueError):
                continue
            infos.append(item)
        if not infos:
            continue
        catid = slug(cat["id"])
        catprefix = "ecotank/aides/" + catid + "/"
        sublinks = []
        for item in infos:
            key = str(cat["id"]) + "|" + str(item["t"])
            rel = existing_path(old, key, catprefix, item["t"] + "-" + key)
            intro = ('<p class="kicker">Écotank · ' + e(cat.get("title")) + '</p><h1>' + e(item["t"]) + '</h1>'
                     '<div class="notice"><strong>Piste à vérifier, non droit acquis.</strong>'
                     ' Les conditions dépendent de chaque personne.</div><p>' + e(item["d"]) + '</p>')
            if item.get("w"):
                intro += "<p><strong>Précisions :</strong> " + e(item["w"]) + "</p>"
            if item.get("when"):
                intro += "<p><strong>Quand agir :</strong> " + e(item["when"]) + "</p>"
            intro += "<h2>Démarches</h2><ol>" + ''.join("<li>" + e(s) + "</li>" for s in item["steps"]) + "</ol>"
            if item.get("docs"):
                intro += "<h2>Documents possibles</h2><ul>" + ''.join("<li>" + e(s) + "</li>" for s in item["docs"]) + "</ul>"
            if item.get("contact"):
                intro += "<h2>Contact</h2><p>" + e(item["contact"]) + "</p>"
            intro += ('<p>Dernière vérification indiquée dans la base : ' + e(item["verifiedAt"]) + '</p>'
                      '<p>' + ext_link(item["src"], "Vérifier la source") + '</p>'
                      '<p>Belgique, je t’aime n’est pas un organisme public et ne confirme pas votre éligibilité.</p>'
                      '<p><a href="../../">Toutes les fiches Écotank</a></p>')
            write(rel, render(rel, item["t"] + " | Écotank", item["d"][:150], intro))
            current[key] = {"path": rel, "verifiedAt": item["verifiedAt"]}
            sublinks.append((rel.split("/")[-2] + "/", item["t"]))
        if len(sublinks) >= 2:
            rel = catprefix + "index.html"
            intro = cat.get("intro") or "Pistes sourcées sur ce thème : vérifiez les conditions et procédures."
            if hub(rel, cat.get("title") or "Aides et démarches", intro, sublinks):
                indexable.append(rel)
                used_categories[catid] = rel
            master_links.append((catid + "/", cat.get("title") or catid))
        else:
            for _, itemname in sublinks:
                record = next((v for k,v in current.items() if k.startswith(str(cat["id"]) + "|") and itemname in k), None)
                if record:
                    master_links.append((catid + "/" + record["path"].split("/")[-2] + "/", itemname))
    if hub("ecotank/aides/index.html", "Aides, économies et démarches documentées",
           "Pistes informatives à Bruxelles : les conditions et droits restent à confirmer.", master_links):
        indexable.append("ecotank/aides/index.html")
    archive(old, current)
    # Archiver également les anciens index thématiques abandonnés.
    old_cats = load("seo/generated-ecotank-categories.json", {})
    for catid, rel in old_cats.items():
        if catid not in used_categories and (ROOT / rel).is_file():
            write(rel, render(rel, "Catégorie à actualiser", "Cette catégorie est à actualiser.",
                              "<h1>Catégorie à actualiser</h1><p>Retrouvez les fiches dans le moteur Écotank.</p>", False))
    write("seo/generated-ecotank-categories.json", json.dumps(used_categories, ensure_ascii=False, indent=2) + "\n")
    write("seo/generated-ecotank.json", json.dumps(current, ensure_ascii=False, indent=2) + "\n")
    indexable.extend(v["path"] for v in current.values())
    return len(current)

def sync_domain():
    old_base = "https://cloelia50.github.io/belgique-je-taime-site/"
    paths = ["index.html", "activikids/index.html", "ecotank/index.html", "cogito/index.html",
             "a-propos.html", "methodologie.html", "confidentialite.html", "signaler.html"]
    for rel in paths:
        p = ROOT / rel
        c = p.read_text(encoding="utf8")
        c = c.replace(old_base, BASE)
        p.write_text(c, encoding="utf8")
    not_found = ROOT / "404.html"
    if not_found.exists():
        text = not_found.read_text(encoding="utf8")
        target_root = urlparse(BASE).path or "/"
        text = text.replace("/belgique-je-taime-site/", target_root)
        not_found.write_text(text, encoding="utf8")

def main():
    global indexable
    indexable = []
    a, c, eco = read_exports()  # Lecture préalable : erreur => aucune suppression de pages.
    av = []
    for event in a["events"]:
        if event.get("stat") != "actif" or not event.get("id") or not event.get("n") or not event.get("co"):
            continue
        eds = [d for d in event.get("ed", []) if d.get("st") == "annoncee" and d.get("s","") >= AS_OF.isoformat()
               and len(d.get("prog") or "") >= 40 and url_ok(d.get("src"))]
        if eds:
            av.append((event, sorted(eds, key=lambda d:d["s"])[0]))
    cv = []
    for event in c["events"]:
        if event.get("date", "") >= AS_OF.isoformat() and event.get("id") and event.get("title") and event.get("city") \
                and len(event.get("description") or "") >= 60 and url_ok(event.get("official_url")):
            cv.append((event, event))
    ac = build_events("activikids", av, load("seo/generated-activikids.json", {}))
    cc = build_events("cogito", cv, load("seo/generated-cogito.json", {}))
    ec = build_ecotank(eco, load("seo/generated-ecotank.json", {}))
    sync_domain()
    primary = ["index.html", "activikids/index.html", "ecotank/index.html", "cogito/index.html",
               "a-propos.html", "methodologie.html", "confidentialite.html", "signaler.html"]
    all_paths = list(dict.fromkeys(primary + indexable))
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sitemap += ''.join("  <url><loc>" + e(BASE + web_path(p)) + "</loc></url>\n" for p in all_paths)
    write("sitemap.xml", sitemap + "</urlset>\n")
    write("robots.txt", "User-agent: *\nAllow: /\n\nSitemap: " + BASE + "sitemap.xml\n")
    print("SEO:", ac, "fiches Activikids,", cc, "Cogito,", ec, "Écotank;", len(all_paths), "URL indexables")

if __name__ == "__main__":
    main()
