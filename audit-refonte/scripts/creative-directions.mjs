// Exécute la recherche créative de CREATIVE_ENGINE_V9 pour les trois briefs de direction (A, B, C).
// Le moteur vise des sites vitrines : seules ses sorties transposables à une application sont reprises
// (palette, typographie, densité, navigation, mouvement, intensité de direction artistique).
//   node audit-refonte/scripts/creative-directions.mjs [chemin de CREATIVE_ENGINE_V9] > evidence/creative-directions.json
import fs from 'node:fs';
import path from 'node:path';
const CE = path.resolve(process.argv[2] || '/Users/dreano/Downloads/CREATIVE_ENGINE_V9');
const { buildCreativeCandidatePool, selectDiverseDirections, divergenceScore, candidateDistance } = await import(path.join(CE, 'src/creative-explorer.mjs'));
const { loadKnowledge } = await import(path.join(CE, 'src/knowledge-loader.mjs'));
const { validateSpec } = await import(path.join(CE, 'src/validator.mjs'));
const { contrastRatio, darkPalette } = await import(path.join(CE, 'src/color-engine.mjs'));
const { objectiveVector } = await import(path.join(CE, 'src/objective-evaluator.mjs'));
const { ENGINE_VERSION } = await import(path.join(CE, 'src/utils.mjs'));

const base = JSON.parse(fs.readFileSync(path.join(CE, 'examples/restaurant-v9-project-spec.json'), 'utf8'));
function spec({ name, traits, forbidden, patterns, avoid, axes, freedom, motion, mustHave }) {
  const s = structuredClone(base);
  s.project = { ...s.project, name, project_type: 'REDESIGN', domain: 'GENERIC', subdomain: 'TRAVEL_PLANNING_APP', reason_now: 'Refonte UI/UX d\'une application de voyage en van existante' };
  s.business = { ...s.business, name: 'Atlas van', activity: 'Application personnelle de préparation de voyage en van', description: 'Carte de 1 600 lieux en Europe, trajets, budget et carnet de voyage, hors connexion.', geographic_area: ['Europe'], positioning: 'Outil de voyage calme, lisible, local', differentiators: ['fonctionne hors connexion', 'données locales', 'carte et carnet réunis'], trust_signals: [] };
  s.goals = { primary: { id: 'PLAN_TRIP', action: 'Préparer un trajet', priority: 5 }, secondary: [{ id: 'EXPLORE_MAP', action: 'Explorer la carte', priority: 5 }, { id: 'WRITE_JOURNAL', action: 'Écrire le carnet', priority: 4 }], success_metrics: [] };
  s.audiences = [{ name: 'Voyageur en van', market: 'B2C', location: 'Europe', knowledge_level: 'Moyen', needs: ['trouver un lieu vite', 'lire en mobilité', 'garder ses notes'], motivations: ['autonomie', 'simplicité'], objections: [], devices: ['mobile', 'desktop'] }];
  s.brand = { ...s.brand, desired_traits: traits, forbidden_traits: forbidden, required_colors: [], forbidden_colors: [], required_fonts: [] };
  s.visual_direction = { creative_freedom: freedom, emotion_axes: axes, motion_level: motion, preferred_patterns: patterns, avoid };
  s.pages = { architecture_mode: 'AXDIA_PROPOSE', items: [{ name: 'Application', slug: '/', purpose: 'carte, trajet, carnet', required: true }] };
  s.features = []; s.booking = { enabled: false }; s.assets = []; s.local_seo = { enabled: false, locations: [] };
  s.constraints = { must_have: mustHave, must_not_have: ['look tableau de bord SaaS', 'dégradés partout', 'glassmorphism'], technical: ['fichier HTML autonome', 'aucune dépendance réseau'] };
  s.unknowns = [];
  return s;
}
const BRIEFS = {
  A: spec({ name: 'Atlas van — Atlas éditorial', traits: ['éditorial', 'authentique', 'sobre', 'cartographique'], forbidden: ['corporate', 'luxe ostentatoire'], patterns: ['editorial typography', 'atlas papier', 'filets fins'], avoid: ['generic SaaS hero', 'three identical cards'], axes: { minimal_to_dense: 35, classic_to_experimental: 25, cold_to_warm: 70, corporate_to_human: 75 }, freedom: 55, motion: 'SUBTLE', mustHave: ['carte dominante', 'lisibilité'] }),
  B: spec({ name: 'Atlas van — Outdoor moderne', traits: ['nature', 'fiable', 'direct', 'lisible'], forbidden: ['décoratif', 'corporate'], patterns: ['utility index', 'navigation outdoor', 'high legibility'], avoid: ['generic SaaS hero', 'gradients'], axes: { minimal_to_dense: 30, classic_to_experimental: 45, cold_to_warm: 45, corporate_to_human: 65 }, freedom: 50, motion: 'SUBTLE', mustHave: ['actions rapides au pouce', 'contraste maîtrisé'] }),
  C: spec({ name: 'Atlas van — Carnet contemporain', traits: ['chaleureux', 'humain', 'sensoriel', 'photographique'], forbidden: ['froid', 'technique'], patterns: ['large photography', 'journal', 'storytelling'], avoid: ['generic SaaS hero', 'dashboard'], axes: { minimal_to_dense: 25, classic_to_experimental: 40, cold_to_warm: 85, corporate_to_human: 92 }, freedom: 70, motion: 'ELEGANT', mustHave: ['carnet et carte intégrés', 'place aux photos'] })
};
const knowledge = loadKnowledge('GENERIC');
const out = { engine: 'AXDIA Creative Engine', engine_version: ENGINE_VERSION, generated_at: new Date().toISOString(), note: 'Recherche créative réellement exécutée (E1). Les valeurs « objectives » sont des priors du moteur, pas des mesures.', briefs: {} };
const tops = [];
for (const [key, s] of Object.entries(BRIEFS)) {
  const v = validateSpec(s);
  const pool = buildCreativeCandidatePool(s, knowledge, 100, { seed: key, ledger: [] });
  const dirs = selectDiverseDirections(pool, 3);
  const pick = (d) => ({ id: d.id, family: d.family, variant: d.variant, composition_id: d.composition_id, density: d.density, navigation_type: d.navigation_type, media_strategy: d.media_strategy, cta_grammar: d.cta_grammar, type_variant: d.type_variant,
    typography: { display: d.typography.display, body: d.typography.body, utility: d.typography.utility, scale_name: d.typography.scale_name, line_height: d.typography.line_height, license_status: d.typography.license_status },
    colors: d.colors, dark: darkPalette(d.colors), motion: d.motion, art_direction: { profile: d.art_direction?.profile, intensity: d.art_direction?.intensity, asymmetry: d.art_direction?.asymmetry, hero_scale: d.art_direction?.hero_scale }, objectives_prior: objectiveVector(d), selection: d.selection });
  out.briefs[key] = { project: s.project.name, spec_valid: v.valid, spec_errors: v.errors, desired_traits: s.brand.desired_traits, pool: pool.length, internal_divergence: divergenceScore(dirs), directions: dirs.map(pick) };
  tops.push(dirs[0]);
}
out.cross_brief_distance = { A_B: candidateDistance(tops[0], tops[1]), A_C: candidateDistance(tops[0], tops[2]), B_C: candidateDistance(tops[1], tops[2]) };
out.contrast_helper = 'contrastRatio (color-engine.mjs)';
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
