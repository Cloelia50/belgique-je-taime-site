# SEO de Belgique, je t'aime — version publique

Huit guides et leurs fiches événement sont exportés depuis les catalogues déjà PUBLICS du site. Les guides sont reconstruits avec la date Europe/Brussels à chaque passage du workflow public `public-seo-refresh.yml`.

Les fiches EVT-0280, EVT-0319, EVT-0432 et l'atelier Jan Carson ont été exclues de la sélection de fiches SEO individuelles faute de validation factuelle finale ; elles restent dans leurs catalogues sources. Aucun effacement de données n'est effectué.

Le robot du dépôt PRIVÉ ne doit jamais être déclenché manuellement pour générer ces guides. Le workflow privé remplace le contenu de /activikids/ et ne touche pas à /guides/, /evenements/ et /sorties-permanentes/.

Tests dans le dépôt public : `node scripts/test_seo_offline.mjs`, `node scripts/test_seo_links.mjs`.
