// Espace communautaire « Partage » : pages statiques du site. Le contenu des contributions vient du serveur communautaire,
// lu dans le navigateur ; ces pages n'en contiennent aucun et restent lisibles quand le serveur est absent ou injoignable.
export function partagePages(ctx, h) {
  const { esc, eyebrow, emptyState, plannerBand } = h;
  return [{ path: 'partage/index.html', title: 'Partage', crumbs: [['partage/index.html', 'Partage']], noindex: true,
    description: 'Partage : circuits, spots, astuces et retours d’expérience proposés par la communauté des voyageurs en van.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Communauté')}<h1 class="page-title">Partage</h1><p class="page-lead">Circuits, spots, astuces et retours d’expérience proposés par d’autres voyageurs.</p></header>
<section class="section section-tight"><div class="wrap">${emptyState('L’espace Partage n’est pas encore ouvert', 'Il ouvrira prochainement.')}</div></section>
${plannerBand(to, { title: 'Préparer votre voyage', text: 'Le Planner fonctionne hors ligne, sur votre appareil, sans compte.' })}` }];
}
