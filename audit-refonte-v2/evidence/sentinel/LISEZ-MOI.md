# Preuves SENTINEL

`SUMMARY.json` résume chaque passage : statut, phases, secrets, vulnérabilités, constats, graphe de code.

Les artefacts bruts produits par SENTINEL (`AUDIT_RESULT.json`, `AUDIT_PLAN.json`, `TARGET_READ_ONLY.json`,
`ARTIFACT_SECRET_SCAN.json`, `gitleaks.json`, `static-triage.json`…) ne sont **pas** dans le dépôt : ils décrivent la
configuration interne de l'outil (fournisseurs enregistrés, états d'authentification). Ils sont conservés sur la
machine où les audits ont tourné, dans ce même dossier, hors du suivi Git. Aucun ne contient de clé.
