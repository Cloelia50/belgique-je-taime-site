from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

required = [
    "index.html", "a-propos.html", "methodologie.html", "confidentialite.html",
    "404.html", "signaler.html", "robots.txt", "sitemap.xml", "analytics.js", "site.css",
    "activikids/index.html", "ecotank/index.html", "cogito/index.html",
]
for rel in required:
    if not (ROOT / rel).exists():
        errors.append(f"missing:{rel}")

if (ROOT / "activikids" / "robot").exists():
    errors.append("public_internal_robot_status_must_not_exist")

for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts:
        continue
    rel = p.relative_to(ROOT).as_posix().lower()
    if rel.startswith("review/") or "/review/" in rel:
        errors.append(f"private_review_path:{rel}")

home = (ROOT / "index.html").read_text(encoding="utf-8")
for target in ("activikids/", "ecotank/", "cogito/"):
    if f'href="{target}"' not in home:
        errors.append(f"home_missing_door:{target}")
if len(re.findall(r"<h1\b", home, re.I)) != 1:
    errors.append("home_must_have_one_h1")
for phrase in ("Gratuit", "Indépendant", "Méthode &amp; sources", "Vie privée"):
    if phrase not in home:
        errors.append(f"home_missing_trust_marker:{phrase}")

privacy = (ROOT / "confidentialite.html").read_text(encoding="utf-8")
for phrase in ("CounterAPI", "Nominatim", "Écotank n’envoie pas de mesure d’audience", "Le site public est hébergé par GitHub Pages"):
    if phrase not in privacy:
        errors.append(f"privacy_missing_disclosure:{phrase}")

analytics = (ROOT / "analytics.js").read_text(encoding="utf-8")
for phrase in ("globalPrivacyControl", "doNotTrack", "section==='ecotank'", "referrerPolicy:'no-referrer'"):
    if phrase not in analytics:
        errors.append(f"analytics_missing_guardrail:{phrase}")

for rel in ("index.html", "a-propos.html", "methodologie.html", "confidentialite.html", "signaler.html", "404.html"):
    text = (ROOT / rel).read_text(encoding="utf-8")
    if not re.search(r"<meta[^>]+name=[\"']viewport[\"']", text, re.I):
        errors.append(f"viewport_missing:{rel}")
    if not re.search(r"<title>.+?</title>", text, re.I | re.S):
        errors.append(f"title_missing:{rel}")
    for m in re.finditer(r"<a\b[^>]*target=[\"']_blank[\"'][^>]*>", text, re.I):
        if "noopener" not in m.group(0).lower():
            errors.append(f"blank_without_noopener:{rel}")


BASE = "https://cloelia50.github.io/belgique-je-taime-site/"
PROJECT_ROOT = "/belgique-je-taime-site/"

# Les pages globales doivent annoncer leur URL canonique et garder un accès au signalement.
for rel in ("index.html", "a-propos.html", "methodologie.html", "confidentialite.html", "signaler.html"):
    text = (ROOT / rel).read_text(encoding="utf-8")
    expected = BASE if rel == "index.html" else BASE + rel
    if f'<link rel="canonical" href="{expected}">' not in text:
        errors.append(f"canonical_missing_or_wrong:{rel}")
    if rel != "signaler.html" and 'href="signaler.html"' not in text:
        errors.append(f"report_link_missing:{rel}")

sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
if BASE + "signaler.html" not in sitemap:
    errors.append("sitemap_missing:signaler.html")

not_found = (ROOT / "404.html").read_text(encoding="utf-8")
for required_404 in (PROJECT_ROOT + "site.css", f'href="{PROJECT_ROOT}"', PROJECT_ROOT + "activikids/", PROJECT_ROOT + "signaler.html"):
    if required_404 not in not_found:
        errors.append(f"404_not_project_root_safe:{required_404}")

forbidden_terms = ("interest_score", "score_breakdown", "source_replacement_ledger", "PUBLIC_SITE_TOKEN")
for p in ROOT.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in {".html", ".js", ".json", ".xml", ".txt", ".md"}:
        continue
    # The public catalogues can contain ordinary words; these tokens are exact private implementation markers.
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        continue
    for term in forbidden_terms:
        if term in text:
            errors.append(f"forbidden_private_marker:{p.relative_to(ROOT)}:{term}")


# Guides SEO — contrôle statique sans appel réseau ni consommation d'API.
import xml.etree.ElementTree as ET
guides = [
    "activites-gratuites-bruxelles",
    "sorties-ce-week-end",
    "conferences-bruxelles",
    "rencontres-litteraires",
    "demarches-administratives",
    "sorties-famille-petit-budget",
    "conferences-gratuites-belgique",
    "premiere-demande-cpas",
]
seo_titles = set()
for slug in guides:
    rel = f"guides/{slug}/index.html"
    f = ROOT / rel
    if not f.exists():
        errors.append(f"seo_guide_missing:{rel}")
        continue
    page = f.read_text(encoding="utf-8")
    expected_url = BASE + f"guides/{slug}/"
    if f'<link rel="canonical" href="{expected_url}">' not in page:
        errors.append(f"seo_wrong_canonical:{slug}")
    title = re.search(r"<title>(.*?)</title>", page, re.I | re.S)
    if not title:
        errors.append(f"seo_missing_title:{slug}")
    elif title.group(1) in seo_titles:
        errors.append(f"seo_duplicate_title:{slug}")
    else:
        seo_titles.add(title.group(1))
    if len(re.findall(r"<h1\b", page, re.I)) != 1:
        errors.append(f"seo_h1_count:{slug}")
    if not re.search(r'<meta name="description" content="[^"]{35,}"', page, re.I):
        errors.append(f"seo_description_missing:{slug}")
    if f'href="guides/{slug}/"' not in home:
        errors.append(f"seo_home_link_missing:{slug}")
    if expected_url not in sitemap:
        errors.append(f"seo_sitemap_missing:{slug}")
    if 'href="../../signaler.html"' not in page:
        errors.append(f"seo_signalement_missing:{slug}")
if not (ROOT / "guides" / "guides.css").is_file():
    errors.append("seo_css_missing")
if not (ROOT / "guides" / "index.html").is_file():
    errors.append("seo_hub_missing")
if not (ROOT / "scripts" / "build_seo_guides.mjs").is_file():
    errors.append("seo_generator_missing")
try:
    root = ET.fromstring(sitemap)
    locs = [e.text for e in root.iter() if e.tag.endswith("loc")]
    if len(locs) != len(set(locs)):
        errors.append("seo_duplicate_sitemap_urls")
    if BASE + "guides/" not in locs:
        errors.append("seo_hub_not_in_sitemap")
except ET.ParseError:
    errors.append("seo_sitemap_invalid_xml")


# Fiches événement : contrôle de l'indexation, des sources et du schéma Event
import json as _event_json
event_dir=ROOT/"evenements"
if not (event_dir/"index.html").is_file():
    errors.append("events_hub_missing")
event_sitemap_urls=re.findall(r"<loc>(https?://[^<]*/evenements/[^<]*)</loc>",sitemap)
if len(event_sitemap_urls)!=len(set(event_sitemap_urls)):
    errors.append("events_sitemap_duplicates")
for event_url in event_sitemap_urls:
    slug=event_url.rstrip("/").split("/")[-1]
    event_file=event_dir/("index.html" if slug=="evenements" else f"{slug}/index.html")
    if not event_file.is_file():
        errors.append("event_page_missing:"+slug)
        continue
    content=event_file.read_text(encoding="utf-8")
    if 'content="noindex,follow"' in content:
        errors.append("event_noindex_in_sitemap:"+slug)
    if f'<link rel="canonical" href="{event_url}">' not in content:
        errors.append("event_canonical_wrong:"+slug)
    if slug!="evenements":
        match=re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>',content)
        if not match:
            errors.append("event_structured_data_missing:"+slug)
        else:
            try:
                data=_event_json.loads(match.group(1))
                event=next((v for v in data if v.get("@type")=="Event"),{})
                if not event.get("name") or not event.get("startDate") or not event.get("location",{}).get("address",{}).get("postalCode"):
                    errors.append("event_structured_data_incomplete:"+slug)
            except (ValueError, TypeError):
                errors.append("event_structured_data_invalid:"+slug)
if event_dir.exists():
    for event_file in event_dir.glob("*/index.html"):
        if 'content="noindex,follow"' in event_file.read_text(encoding="utf-8") and BASE+"evenements/"+event_file.parent.name+"/" in sitemap:
            errors.append("archived_event_still_indexed:"+event_file.parent.name)

if errors:
    print("SITE QUALITY FAILED")
    for error in errors:
        print(" -", error)
    sys.exit(1)

print("SITE QUALITY OK")