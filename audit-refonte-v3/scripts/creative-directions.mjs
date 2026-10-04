// Recherche créative de CREATIVE_ENGINE_V9 pour les trois directions du site éditorial (cycle 3).
// Cette fois la cible est un site de lecture, ce pour quoi le moteur est fait ; ses sorties restent des graines
// (palette, typographie, densité, navigation, mouvement), étendues ensuite à la main en feuilles de style.
//   node audit-refonte-v3/scripts/creative-directions.mjs [chemin de CREATIVE_ENGINE_V9] > audit-refonte-v3/evidence/creative-directions.json
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
  s.project = { ...s.project, name, project_type: 'REDESIGN', domain: 'GENERIC', subdomain: 'TRAVEL_EDITORIAL', reason_now: 'Site éditorial de voyage en van devant un outil de préparation existant' };
  s.business = { ...s.business, name: 'Atlas van', activity: 'Atlas de lieux et carnet de voyage en van', description: 'Site éditorial : destinations, road trips, carnet, guides ; puis un outil de préparation de voyage avec 1 600 lieux.', geographic_area: ['Europe'], positioning: 'Outil de voyage calme, lisible, local', differentiators: ['fonctionne hors connexion', 'données locales', 'carte et carnet réunis'], trust_signals: [] };
  s.goals = { primary: { id: 'OPEN_PLANNER', action: 'Préparer mon voyage', priority: 5 }, secondary: [{ id: 'BROWSE_DESTINATIONS', action: 'Parcourir les destinations', priority: 5 }, { id: 'READ_ROAD_TRIPS', action: 'Lire un road trip', priority: 4 }], success_metrics: [] };
  s.audiences = [{ name: 'Voyageur en van', market: 'B2C', location: 'Europe', knowledge_level: 'Moyen', needs: ['trouver un lieu vite', 'lire en mobilité', 'garder ses notes'], motivations: ['autonomie', 'simplicité'], objections: [], devices: ['mobile', 'desktop'] }];
  s.brand = { ...s.brand, desired_traits: traits, forbidden_traits: forbidden, required_colors: [], forbidden_colors: [], required_fonts: [] };
  s.visual_direction = { creative_freedom: freedom, emotion_axes: axes, motion_level: motion, preferred_patterns: patterns, avoid };
  s.pages = { architecture_mode: 'AXDIA_PROPOSE', items: [{ name: 'Accueil', slug: '/', purpose: 'inspiration puis accès au Planner', required: true }, { name: 'Destinations', slug: '/destinations', purpose: 'pays et lieux', required: true }, { name: 'Road trips', slug: '/road-trips', purpose: 'itinéraires', required: true }] };
  s.features = []; s.booking = { enabled: false }; s.assets = []; s.local_seo = { enabled: false, locations: [] };
  s.constraints = { must_have: mustHave, must_not_have: ['look tableau de bord SaaS', 'dégradés partout', 'glassmorphism'], technical: ['pages statiques', 'aucune dépendance réseau', 'aucun traceur'] };
  s.unknowns = [];
  return s;
}
const BRIEFS = {
  A: spec({ name: 'Atlas Van — Atlas éditorial cinématique', traits: ['éditorial', 'cinématique', 'calme', 'premium', 'cartographique'], forbidden: ['SaaS', 'néon', 'corporate'], patterns: ['large imagery', 'editorial typography', 'generous whitespace', 'calm navigation'], avoid: ['generic SaaS hero', 'three identical cards', 'dashboard'], axes: { minimal_to_dense: 22, classic_to_experimental: 35, cold_to_warm: 62, corporate_to_human: 72 }, freedom: 65, motion: 'ELEGANT', mustHave: ['première page immersive', 'accès permanent au Planner'] }),
  B: spec({ name: 'Atlas Van — Carnet de route contemporain', traits: ['carnet', 'humain', 'chaleureux', 'authentique', 'matière'], forbidden: ['froid', 'technique', 'SaaS'], patterns: ['journal', 'annotations', 'paper texture', 'map sketches'], avoid: ['generic SaaS hero', 'glassmorphism', 'dashboard'], axes: { minimal_to_dense: 40, classic_to_experimental: 45, cold_to_warm: 88, corporate_to_human: 92 }, freedom: 70, motion: 'SUBTLE', mustHave: ['repères et étiquettes', 'carte comme page de carnet'] }),
  C: spec({ name: 'Atlas Van — Outdoor minimal', traits: ['nature', 'robuste', 'direct', 'fonctionnel', 'minimal'], forbidden: ['décoratif', 'luxe ostentatoire'], patterns: ['utility index', 'high legibility', 'flat color blocks'], avoid: ['generic SaaS hero', 'gradients'], axes: { minimal_to_dense: 15, classic_to_experimental: 30, cold_to_warm: 40, corporate_to_human: 60 }, freedom: 45, motion: 'SUBTLE', mustHave: ['grandes destinations', 'lisibilité en plein jour'] })
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
