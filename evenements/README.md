# Événements : mini-série SEO (non publiée)

- Fiches individuelles ajoutées dans /evenements/ en dehors du répertoire /activikids/ que le robot remplace.
- Les 16 identifiants de départ sont une liste éditoriale fermée ; aucune publication en masse.
- Source de données : les exports PUBLICS uniquement. Filtrage supplémentaire : date, lieu physique, adresse postale, description, source officielle.
- Reconstruit lors du passage existant de build_seo_guides.mjs, sans nouveau workflow ni API payante.
- La page d’un événement passé reste accessible comme archive avec noindex,follow ; elle est retirée du sitemap. La source dans les bases n’est jamais effacée.
- Avant toute mise en ligne, valider les dates, les tarifs, les sources et la qualité de chaque fiche. Les informations des catalogues ne remplacent pas la source.
- Le balisage Event ne garantit pas un résultat enrichi : la Belgique ne figure pas parmi les pays officiellement éligibles aux événements enrichis de Google à la date de ce travail.
- Pour valider localement : node scripts/build_seo_guides.mjs --repo . --as-of 2026-10-09 ; python scripts/site_quality.py
- Branche de travail : seo/fiches-evenements-20261009. Ne pas créer de PR ou fusionner tant que les minutes GitHub Actions sont limitées.


## Fiabilisation du calendrier — 9 octobre 2026
Le générateur valide désormais les dates civiles réelles : 31 février et 31 avril sont rejetés. L'heure de départ avec fuseau `Europe/Brussels` est calculée à l'heure locale de l'événement, pas à midi : cela évite une erreur lors du changement d'heure. Pour une heure inexistante ou répétée à la transition DST, la donnée structurée ne prétend pas connaître un décalage horaire non confirmé et conserve la date. Tests supplémentaires intégrés à `scripts/test_seo_offline.mjs`. Aucun nouveau workflow GitHub Actions.


## Audit renforcé — 9 octobre 2026
Les huit guides et les seize fiches sont contrôlés pour les titres, méta-descriptions et URL canoniques uniques. Les vérifications des liens CPAS puisent maintenant dans les URL officielles d'Écotank au lieu de figer une adresse susceptible d'être remplacée ultérieurement. Deux coûts (Halloween Rouge-Cloître et Opening Filem'On) nécessitent une vérification humaine. Aucun nouveau workflow n'est ajouté.
