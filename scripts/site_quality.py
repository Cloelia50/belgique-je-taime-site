from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

required = [
    "index.html", "a-propos.html", "methodologie.html", "confidentialite.html",
    "404.html", "signaler.html", "robots.txt", "sitemap.xml", "analytics.js", "site.css",
    "activikids/index.html", "ecotank/index.html", "cogito/index.html",
    "lirabelge/index.html", "lirabelge/ligne-editoriale.html",
    "belveillance/index.html", "belveillance/catalogue.json",
    "volet6/index.html", "volet6/catalogue.json",
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
for target in ("activikids/", "ecotank/", "cogito/", "lirabelge/", "belveillance/", "volet6/"):
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

# Belveillance must not expose the private scouting registers.
belveillance = (ROOT / "belveillance/index.html").read_text(encoding="utf-8")
for label in ("En solo, au calme", "En solo, mais envie de sociabiliser", "En couple", "Entre amis"):
    if label not in belveillance:
        errors.append("belveillance_missing_mode:" + label)
if '<link rel="canonical" href="' + BASE + 'belveillance/">' not in belveillance:
    errors.append("belveillance_canonical_invalid")
import json
with (ROOT / "belveillance/catalogue.json").open(encoding="utf-8") as fh:
    listings=json.load(fh)
for item in listings.get("items",[]):
    if item.get("publication_status") != "Autorisé" or item.get("verified") is not True:
        errors.append("belveillance_unverified_listing")

# Volet 6 starts with a small, public-only registry. Never promote unverified shops.
import json
v6 = json.loads((ROOT / "volet6/catalogue.json").read_text(encoding="utf-8"))
if v6.get("schema") != "bjt-volet6-public-v1" or not isinstance(v6.get("items"), list):
    errors.append("volet6_catalogue_schema_invalid")
else:
    ids=set()
    for item in v6["items"]:
        key=item.get("id")
        if not key or key in ids:
            errors.append("volet6_missing_or_duplicate_id")
        ids.add(key)
        if item.get("category") not in {"vintage","lieu","artisan","troc"}:
            errors.append("volet6_unknown_category")
        if not re.match(r"^https://[^@\s]+$",str(item.get("source_url","")),re.I):
            errors.append("volet6_unverified_source")
        if any(field in item for field in ("email","telephone","phone","private_notes")):
            errors.append("volet6_private_field")
if "Troc Forest" in (ROOT / "volet6/catalogue.json").read_text(encoding="utf-8"):
    errors.append("volet6_unconfirmed_forest_opening")
if '<link rel="canonical" href="' + BASE + 'volet6/">' not in (ROOT / "volet6/index.html").read_text(encoding="utf-8"):
    errors.append("volet6_canonical_missing")

sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
if BASE + "volet6/" not in sitemap:
    errors.append("sitemap_missing:volet6")
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

if errors:
    print("SITE QUALITY FAILED")
    for error in errors:
        print(" -", error)
    sys.exit(1)

print("SITE QUALITY OK")