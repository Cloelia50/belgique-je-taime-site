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
for phrase in ("CounterAPI", "Nominatim", "Écotank n’envoie pas de mesure d’audience"):
    if phrase not in privacy:
        errors.append(f"privacy_missing_disclosure:{phrase}")

analytics = (ROOT / "analytics.js").read_text(encoding="utf-8")
for phrase in ("globalPrivacyControl", "doNotTrack", "section==='ecotank'", "referrerPolicy:'no-referrer'"):
    if phrase not in analytics:
        errors.append(f"analytics_missing_guardrail:{phrase}")

for rel in ("index.html", "a-propos.html", "methodologie.html", "confidentialite.html", "404.html"):
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
for required_404 in (PROJECT_ROOT + "site.css", PROJECT_ROOT + '",', PROJECT_ROOT + "activikids/", PROJECT_ROOT + "signaler.html"):
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