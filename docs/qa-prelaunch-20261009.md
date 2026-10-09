# Prévol SEO / données événementielles — 9 octobre 2026

## Statut

Tous les changements de cette livraison restent sur la branche `seo/qa-complete-preparation-20261009`, non fusionnée sur `main`. Aucun GitHub Actions n'a été déclenché dans ce chantier. Les données privées des robots restent dans le dépôt privé distinct.

## Contrôles directement effectués sur les fichiers de branche

- **16/16 fiches événement** : H1 unique, titre HTML présent et non dupliqué, méta-description unique, URL canonique distincte, JSON-LD Event exploitable, lien officiel présent.
- **32/32 champs `startDate` / `endDate`** : date civile ou date-heure avec décalage horaire explicite. Les neuf fiches Activikids ont reçu leurs décalages UTC corrects pour octobre–décembre 2026.
- **8/8 guides + 2 hubs** : titres, descriptions et canoniques distincts, H1 présent.
- **409 références internes** contrôlées dans les 26 pages (201 dans les guides/hubs et 208 dans les fiches événement) : aucune cible manquante dans l'arbre GitHub examiné, y compris 26 liens CSS. Il s'agit de liens *internes* ; les destinations externes ne font pas partie de ce contrôle.
- **34 URL** dans le sitemap examiné, sans doublon. Les dix pages guides/hubs testées y possèdent leur URL canonique.

Cette validation statique ne vaut **pas** exécution de la suite complète Node.js et Python. Le conteneur local ne peut pas résoudre `github.com`, donc le clone complet reste indisponible. Cinq tests isolés du module privé de dates ont réellement passé sous Python 3.13 ; la compilation locale des fichiers présents n'a signalé aucune erreur.

## Corrections événementielles

### Filem'On : EVT-0285, 25 octobre 2026, 14 h, Bozar Studio

Tarif confirmé par l'organisateur **Filem'On** : **8 € standard ; 6 € moins de 26 ans**. Lien : https://filemon.be/fr/festival-filemon/programme/?programID=652&viewing=1062

La fiche initiale « À vérifier » a été corrigée dans le générateur `scripts/build_seo_events.mjs` et dans la page pré-générée correspondante. Le prix est lié à **cette édition et cette séance** ; ne pas le reporter automatiquement sur d'autres dates ou films.

### Halloween au Rouge-Cloître : EVT-0010, 31 octobre 2026

La commune d'Auderghem annonce un parcours **17 h 30 – 20 h 30**, sans inscription ni réservation, mais sa page ne contient pas de tarif explicite : https://www.auderghem.be/agenda/halloween-rouge-cloitre-oserez-vous-affronter-la-nuit

Le tarif reste « À confirmer », notamment afin de ne pas revendiquer abusivement la gratuité.

## Correctifs techniques conservés

- 9 fiches Activikids avec UTC offsets explicites dans le JSON-LD du cache HTML de préparation.
- Générateur : fuseau `Europe/Brussels` calculé pour la véritable heure de chaque date ; les heures ambiguës ou inexistantes restent des dates seules dans les données structurées.
- `scripts/test_seo_offline.mjs` : contrôle des champs datetime structurés avec offset obligatoire lorsqu'une heure est fournie, des tarifs Filem'On et du prix indéterminé du Rouge-Cloître.
- Aucune API payante, nouveau workflow, suppression de source ou fusion vers `main`.

## Vérification d'exécution encore obligatoire

Sur une **copie locale complète** de ce dépôt :

```bash
node scripts/build_seo_guides.mjs --repo . --as-of 2026-10-09
node scripts/test_seo_offline.mjs
node scripts/test_seo_links.mjs
python scripts/site_quality.py
```

Sur une copie locale complète du dépôt privé, branche `quality/dates-fuseaux-evenements-20261009` :

```bash
python -m unittest discover -s tests -p 'test_event_datetime*.py' -v
python -m unittest discover -s tests -v
```

Les scripts doivent être exécutés sans Github Actions. Vérifier séparément les pages organisateurs restantes et les données actuelles avant publication. Ne pas créer de PR : le workflow qualité public est déclenché sur chaque PR et sur tout push vers `main`.

## Quota GitHub Actions

Les quatre workflows programmés du dépôt privé restent actifs dans `main`. Les branches `maintenance/pause-quota-20261009` et `maintenance/quota-seo-integration-20261009` préparent une mise en sommeil via `AUTOMATION_ENABLED`, mais **ne suspendent pas les horaires de `main`**. Les désactiver manuellement dans l'onglet Actions du dépôt privé si l'objectif est zéro minute consommée. Ne pas fusionner simplement pour les désactiver.
