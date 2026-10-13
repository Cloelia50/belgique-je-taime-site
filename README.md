# Belgique, je t'aime — site public

**État du 13 octobre 2026.** [Ouvrir le site](https://cloelia50.github.io/belgique-je-taime-site/)

Ce dépôt est **public** : il contient les pages destinées aux visiteurs et leurs catalogues publiables. Les robots, preuves, clés, files de vérification et journaux internes restent dans un [dépôt privé séparé](https://github.com/Cloelia50/belgique-je-taime-robots).

## Moteurs et parcours disponibles

| Espace | Accès | Description |
| --- | --- | --- |
| **Activikids** | [`/activikids/`](activikids/) | Sorties pour les enfants et les familles ; catalogue historique conservé et ajouts canoniques autorisés. |
| **EcoTank** | [`/ecotank/`](ecotank/) | Parcours des aides, primes, économies et démarches administratives. |
| **Cogito** | [`/cogito/`](cogito/) | Conférences, débats et culture intellectuelle. La page conserve les événements intégrés et peut lire le flux additionnel [`cogito/canonical.json`](cogito/canonical.json). |
| **Belveillance** | [`/belveillance/`](belveillance/) | Sorties adultes, filtrées par « En solo, au calme », « En solo, mais envie de sociabiliser », « En couple », « Entre amis ». Le catalogue vérifié est dans [`belveillance/catalogue.json`](belveillance/catalogue.json), complété par les événements de Cogito. |
| **Lirabelge** | [`/lirabelge/`](lirabelge/) | Livres et auteurs belges, avec [ligne éditoriale](lirabelge/ligne-editoriale.html). |
| **Volet 6** | [\`/volet6/\`](volet6/) | Première page publique sourcée : marchés vintage et lieux vérifiables, avec recherche et filtres. **Pilote partiel**, artisans et troc gratuit sans fiches confirmées ; robot autonome non validé. |

Le dossier `sorties-permanentes/` offre des ressources complémentaires ; **il n'est pas un sixième moteur livré**.

## Sources de vérité et publication

Pour les événements Activikids, Cogito et Belveillance, les bases communes sont :

- [BJT_SOURCES_OFFICIEL](https://docs.google.com/spreadsheets/d/1cdBq2SFFNrGpjO1UORGWTHri1r7u9HpsNlR8eZ2zPrw/edit) : inventaire des sources, lieux, organisateurs et mots-clés.
- [BJT_CALENDRIER_OFFICIEL](https://docs.google.com/spreadsheets/d/1pVO4oZwLKVEeqMr80q-AYGSj3hpQ1Sjn-KCI6Gl3bzc/edit) : événements et candidats séparés dans deux onglets.

Les candidats « À vérifier » ne doivent **jamais** être publiés par défaut. Les moteurs spécialisés EcoTank, Lirabelge et Volet 6 peuvent avoir d'autres données métier.

Le workflow principal du dépôt privé prépare et publie les nouveautés avec un accès contrôlé à ce dépôt ; Cogito dispose aussi d'une veille ciblée. Ne pas remplacer un catalogue historique par une sélection récente réduite. Les données doivent être dédupliquées et limitées aux champs publics.

**Vérification encore nécessaire :** après les modifications du 13 octobre, le cycle complet d'actualisation automatisée et l'affichage des dernières nouveautés n'ont **pas encore été certifiés par un nouveau test GitHub Actions**. Tests manuels prévus le 14 octobre.

## Confidentialité et qualité

Ne publier ici aucun secret, numéro de compte, contenu privé de Google Sheets, copie de travail, fichier de revue ou journal du robot. Les informations sur les événements, les réservations, les tarifs et les aides doivent être confirmées auprès des organisateurs et administrations compétents.

Les chemins et catalogues ci-dessus reflètent la structure observée du dépôt, et non une promesse que tous les parcours sont exempts de défauts.
