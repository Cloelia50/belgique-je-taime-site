# Guides SEO — branche de préparation

Ces pages ne sont pas en production tant que cette branche n’est pas fusionnée.

- Génération sans coût d’API : `node scripts/build_seo_guides.mjs --repo . --as-of 2026-10-09`
- La page « ce week-end » **doit être reconstruite à chaque publication** avec la date locale Europe/Brussels pour éviter des résultats périmés.
- Le chemin `guides/` est hors des dossiers `activikids/`, `cogito/` et `ecotank/` remplacés par leurs robots respectifs.
- À la fusion, ajouter après la copie des données publiques, avant le commit du workflow privé de publication : `node generated-public-repo/scripts/build_seo_guides.mjs --repo generated-public-repo`.
- Vérifier les cinq pages HTML, leurs sources, la canonique, le sitemap, les liens, l’absence de contenu expiré et le respect de la confidentialité.
- Les pages de listing n’ont volontairement pas de balisage Event ; Google demande une page dédiée par événement pour les fonctionnalités Event.
- Le générateur ne change aucune source ni aucun seuil de validation. Si l’export Cogito est absent ou illisible, la génération s’arrête sans produire de faux résultats.
- Ne pas ouvrir de pull request ni fusionner tant que la contrainte de minutes GitHub Actions s’applique. Le workflow du site public se déclenche sur PR et push main, **pas** sur push de cette branche.
- Quand le domaine sera acquis, fournir `--base-url https://nouveau-domaine.example/`, puis ajuster aussi l’accueil, le sitemap et les canoniques des autres pages.
