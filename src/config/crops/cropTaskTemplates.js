/**
 * cropTaskTemplates.js — per-crop, per-stage task template library.
 *
 * This augments the generic stage templates in
 * src/lib/dailyTasks/taskTemplates.js with meaningful, crop-aware
 * defaults. The daily-task engine merges them into its pool before
 * the farm-type filter runs, so a cassava+planting farm gets the
 * cassava-specific tasks plus the generic planting ones.
 *
 * Shape:
 *   CROP_TASK_TEMPLATES[canonicalKey][stageKey] = Template[]
 *
 * Template fields (same as taskTemplates.js):
 *   { id, type, priority, title, description, why, audience? }
 *
 * `audience` — optional array: ['backyard'|'small_farm'|'commercial'].
 * When present, the engine filters by farm type so a backyard farmer
 * doesn't see "calibrate boom sprayer" and a commercial farm doesn't
 * see "carry two watering cans".
 *
 * Wording guide
 *   • Backyard → short, conversational, what-to-do-today
 *   • Commercial → precise operational phrasing
 *   • Small_farm → the default (no audience tag needed)
 */

const t = Object.freeze;
const pool = (arr) => t(arr.map(t));

// ─── Cassava ──────────────────────────────────────────────────
const CASSAVA = t({
  planting: pool([
    { id: 'cassava.planting.ridges', type: 'land_prep', priority: 'high',
      title: 'Prepare ridges or mounds',
      description: 'Build ridges about knee-high and a metre apart so water drains well.',
      why: 'Cassava roots rot in waterlogged flats — raised beds keep them aerated.' },
    { id: 'cassava.planting.cuttings', type: 'land_prep', priority: 'high',
      title: 'Select healthy stem cuttings',
      description: 'Use 25 cm stem sections from green, disease-free plants about 8–12 months old.',
      why: 'Weak or diseased cuttings produce weak plants — starting material is everything.' },
    { id: 'cassava.planting.spacing', type: 'land_prep', priority: 'medium',
      title: 'Plant with 1 m × 1 m spacing',
      description: 'Push cuttings in at an angle, about two-thirds buried, with buds pointing up.',
      why: 'Consistent spacing gives each plant room to bulk up its roots.' },
  ]),
  establishment: pool([
    { id: 'cassava.est.replant_gaps', type: 'scout', priority: 'medium',
      title: 'Replant any gaps after 2 weeks',
      description: 'Walk the field and push new cuttings into any rows missing plants.',
      why: 'Gaps let weeds take over and shrink the harvest from those rows.' },
    { id: 'cassava.est.weed_early', type: 'weeding', priority: 'medium',
      title: 'Weed around young plants',
      description: 'Shallow-hoe between rows; avoid damaging the cuttings.',
      why: 'Weeds compete hard in the first 6 weeks before the canopy closes.' },
  ]),
  vegetative: pool([
    { id: 'cassava.veg.leaf_check', type: 'scout', priority: 'medium',
      title: 'Check leaves for mosaic patterns',
      description: 'Look under leaves for yellow mosaic blotches or curling edges.',
      why: 'Cassava mosaic spreads by whitefly and has no cure — spotting it early limits losses.' },
  ]),
  bulking: pool([
    { id: 'cassava.bulk.drainage', type: 'land_prep', priority: 'high',
      title: 'Clear drainage channels',
      description: 'Make sure water moves off the field quickly during rains.',
      why: 'Waterlogged roots at bulking turn into rot fast.' },
    { id: 'cassava.bulk.nutrient', type: 'nutrient', priority: 'low',
      title: 'Top-dress with potassium if planned',
      description: 'A small K-rich side-dress supports tuber enlargement.',
      why: 'Cassava is potassium-hungry — tubers can stay small if K is short.' },
  ]),
  maturation: pool([
    { id: 'cassava.mat.test_lift', type: 'harvest', priority: 'medium',
      title: 'Dig a test root',
      description: 'Lift one plant to check tuber size before planning the full harvest.',
      why: 'Roots keep growing for months — there\u2019s no rush, but you need a baseline.' },
  ]),
  harvest: pool([
    { id: 'cassava.harv.process_same_day', type: 'harvest', priority: 'high',
      title: 'Process or sell roots the same day',
      description: 'Cassava roots spoil fast once dug — get them to buyers or peel/dry them.',
      why: 'Cyanogens rise and quality drops within 48 hours of lifting.' },
  ]),
});

// ─── Maize ────────────────────────────────────────────────────
const MAIZE = t({
  planting: pool([
    { id: 'maize.plant.soil_moist', type: 'land_prep', priority: 'high',
      title: 'Plant into moist, warm soil',
      description: 'Sow 3–4 cm deep, 20–25 cm apart within rows, rows 75 cm apart.',
      why: 'Uneven germination from dry or cold soil wastes weeks of the season.' },
  ]),
  germination: pool([
    { id: 'maize.germ.birds_watch', type: 'scout', priority: 'medium',
      title: 'Guard against birds and rodents',
      description: 'Walk the field early; mark and cover freshly-emerged rows.',
      why: 'Birds and rats can thin a newly-emerged stand 20% in a week.' },
  ]),
  vegetative: pool([
    { id: 'maize.veg.weed', type: 'weeding', priority: 'high',
      title: 'Weed regularly',
      description: 'Keep rows clean while plants are knee-high — hoe once a week.',
      why: 'Maize hates weed competition in the first 6 weeks; yields drop fast.' },
    { id: 'maize.veg.nutrient', type: 'nutrient', priority: 'medium',
      title: 'Side-dress nitrogen if leaves pale',
      description: 'Apply a top-dress along the row, 10 cm from stems.',
      why: 'Pale lower leaves mean nitrogen shortage — act before the plant stunts.' },
    { id: 'maize.veg.faw_scout', type: 'pest', priority: 'high',
      title: 'Scout for fall armyworm',
      description: 'Check whorls for shot-hole damage and frass (droppings).',
      why: 'FAW can strip a young field in days if uncontrolled.' },
  ]),
  tasseling: pool([
    { id: 'maize.tas.water_critical', type: 'irrigation', priority: 'high',
      title: 'Keep moisture steady at tasseling',
      description: 'Irrigate if possible; mulch to protect soil moisture otherwise.',
      why: 'Water stress at tasseling is the single biggest yield killer for maize.' },
  ]),
  grain_fill: pool([
    { id: 'maize.gf.monitor_ears', type: 'scout', priority: 'medium',
      title: 'Check ears for pest damage',
      description: 'Peel back a few husks; look for earworm, mould, or poor fill.',
      why: 'Problems at grain fill hide inside the husk — open one per row.' },
  ]),
  harvest: pool([
    { id: 'maize.harv.dry_cobs', type: 'harvest', priority: 'high',
      title: 'Let cobs dry before storage',
      description: 'Harvest when husks brown; dry cobs to ~14% moisture before bagging.',
      why: 'Stored wet cobs mould fast and lose weight and market grade.' },
  ]),
});

// ─── Rice ─────────────────────────────────────────────────────
const RICE = t({
  seedling: pool([
    { id: 'rice.seed.nursery', type: 'land_prep', priority: 'high',
      title: 'Prepare a clean nursery bed',
      description: 'Level the bed, flood it, and sow pre-germinated seed evenly.',
      why: 'Clean nurseries produce uniform seedlings — uneven transplants lose weeks.' },
  ]),
  transplant: pool([
    { id: 'rice.tr.spacing', type: 'land_prep', priority: 'high',
      title: 'Transplant with 20 × 20 cm spacing',
      description: 'Transplant 2–3 seedlings per hill once soil is puddled and shallow-flooded.',
      why: 'Right spacing + right depth is what lets rice tiller properly.' },
  ]),
  vegetative: pool([
    { id: 'rice.veg.water_level', type: 'irrigation', priority: 'high',
      title: 'Keep 3–5 cm of water in the paddy',
      description: 'Walk the bunds and top up or drain to keep a thin film over the soil.',
      why: 'Too deep drowns tillers, too shallow invites weeds.' },
  ]),
  flowering: pool([
    { id: 'rice.flow.borer_scout', type: 'pest', priority: 'medium',
      title: 'Scout for stem borer damage',
      description: 'Look for dead hearts in tillers and white panicles at heading.',
      why: 'Borers at flowering cause empty grain — catch it early.' },
  ]),
  grain_fill: pool([
    { id: 'rice.gf.water_reduce', type: 'irrigation', priority: 'medium',
      title: 'Gradually reduce water near harvest',
      description: 'Drain the field 7–10 days before harvest so grain firms up.',
      why: 'Harvesting off a muddy field bruises grain and delays drying.' },
  ]),
  harvest: pool([
    { id: 'rice.harv.timing', type: 'harvest', priority: 'high',
      title: 'Harvest when 80% of grain turns golden',
      description: 'Cut, bundle, and thresh promptly on a dry day.',
      why: 'Too early gives chalky grain; too late shatters and loses yield.' },
  ]),
});

// ─── Tomato ───────────────────────────────────────────────────
const TOMATO = t({
  seedling: pool([
    { id: 'tomato.seed.harden', type: 'land_prep', priority: 'medium',
      title: 'Harden off seedlings before transplant',
      description: 'Reduce water slightly and move trays to outdoor shade 3–4 days before planting out.',
      why: 'Hardened seedlings survive transplant shock much better.' },
  ]),
  transplant: pool([
    { id: 'tomato.tr.stake_ready', type: 'land_prep', priority: 'medium',
      title: 'Set stakes before plants grow tall',
      description: 'Drive stakes 30 cm from stems at transplant so roots aren\u2019t cut later.',
      why: 'Setting stakes later damages roots and delays fruiting.' },
  ]),
  vegetative: pool([
    { id: 'tomato.veg.prune', type: 'weeding', priority: 'medium',
      title: 'Remove suckers on staked plants',
      description: 'Pinch out side shoots below the first flower cluster.',
      why: 'Sucker removal puts the plant\u2019s energy into fruit, not extra leaves.' },
  ]),
  flowering: pool([
    { id: 'tomato.flow.water_even', type: 'irrigation', priority: 'high',
      title: 'Water deeply and evenly',
      description: 'Soak the root zone 2–3 times a week rather than light daily splashes.',
      why: 'Uneven water causes blossom-end rot and cracked fruit.' },
    { id: 'tomato.flow.pest_scout', type: 'pest', priority: 'medium',
      title: 'Scout for whitefly, mites, and early blight',
      description: 'Check undersides of leaves and the oldest leaves first.',
      why: 'Most tomato problems show up on the underside or oldest leaves before they spread.' },
  ]),
  fruiting: pool([
    { id: 'tomato.fr.support', type: 'land_prep', priority: 'medium',
      title: 'Tie plants to stakes as fruit develops',
      description: 'Add a second tie once the first fruit truss is forming.',
      why: 'Unsupported plants snap under fruit weight and lose the whole truss.' },
    { id: 'tomato.fr.disease_watch', type: 'pest', priority: 'high',
      title: 'Watch for late blight in humid weather',
      description: 'Remove any leaves with dark water-soaked patches; destroy, don\u2019t compost.',
      why: 'Late blight spreads by spores in one wet night; early removal saves the crop.' },
  ]),
  harvest: pool([
    { id: 'tomato.harv.pick_regularly', type: 'harvest', priority: 'high',
      title: 'Pick ripe fruit every 2 days',
      description: 'Harvest at full colour but firm; leaving fruit invites pests and spoilage.',
      why: 'Frequent picking keeps new fruit setting and pests uninterested.' },
  ]),
});

// ─── Onion ────────────────────────────────────────────────────
const ONION = t({
  seedling: pool([
    { id: 'onion.seed.thin', type: 'weeding', priority: 'medium',
      title: 'Thin seedlings to 1 cm apart',
      description: 'Pull extras gently so remaining seedlings have space to thicken.',
      why: 'Crowded nurseries give you onion strings, not bulbs.' },
  ]),
  transplant: pool([
    { id: 'onion.tr.shallow', type: 'land_prep', priority: 'high',
      title: 'Transplant shallow — 2 cm deep',
      description: 'Plant 10 cm apart in rows; deep planting delays bulbing.',
      why: 'Onions bulb best at the soil surface.' },
  ]),
  vegetative: pool([
    { id: 'onion.veg.weed_clean', type: 'weeding', priority: 'high',
      title: 'Keep beds weed-free',
      description: 'Hand-weed weekly; onions have weak root systems and lose to weeds fast.',
      why: 'Weed pressure directly shrinks bulb size at harvest.' },
  ]),
  bulking: pool([
    { id: 'onion.bulk.reduce_water', type: 'irrigation', priority: 'medium',
      title: 'Reduce watering as bulbs mature',
      description: 'Cut irrigation back 2 weeks before tops start falling.',
      why: 'Dry curing at the end makes bulbs store well.' },
  ]),
  harvest: pool([
    { id: 'onion.harv.cure', type: 'harvest', priority: 'high',
      title: 'Lift and cure bulbs in the sun',
      description: 'Pull when 70% of tops fall; cure under cover 1–2 weeks before storage.',
      why: 'Cured bulbs with dry necks store for months; uncured ones rot in weeks.' },
  ]),
});

// ─── Okra ─────────────────────────────────────────────────────
const OKRA = t({
  planting: pool([
    { id: 'okra.plant.warm_soil', type: 'land_prep', priority: 'high',
      title: 'Sow into warm soil',
      description: 'Plant 2 seeds per hole, 40 cm apart; thin to one after emergence.',
      why: 'Cold wet soils rot okra seed — warm soils give fast, even germination.' },
  ]),
  vegetative: pool([
    { id: 'okra.veg.scout_borer', type: 'pest', priority: 'medium',
      title: 'Scout for shoot and fruit borer',
      description: 'Look for wilting growing tips and tiny holes in young pods.',
      why: 'Borers tunnel before symptoms appear — weekly scouting catches them.' },
  ]),
  flowering: pool([
    { id: 'okra.flow.water_steady', type: 'irrigation', priority: 'medium',
      title: 'Keep water steady through flowering',
      description: 'Water deeply twice a week if rains are patchy.',
      why: 'Water stress causes flowers to abort, so there is nothing to harvest.' },
  ]),
  fruiting: pool([
    { id: 'okra.fr.daily_pick', type: 'harvest', priority: 'high',
      title: 'Pick pods every 2–3 days',
      description: 'Harvest at 8–10 cm — tender and green.',
      why: 'Missed pods turn woody and the plant stops producing new flowers.' },
  ]),
  harvest: pool([
    { id: 'okra.harv.gloves', type: 'harvest', priority: 'low',
      title: 'Wear gloves and long sleeves',
      description: 'Okra plants have tiny spines that irritate skin.',
      why: 'Covered arms keep pickers working longer without rashes.' },
  ]),
});

// ─── Pepper ───────────────────────────────────────────────────
const PEPPER = t({
  seedling: pool([
    { id: 'pepper.seed.warm', type: 'land_prep', priority: 'medium',
      title: 'Keep seedlings warm and bright',
      description: 'Peppers germinate slowly below 25 °C; use a warm, sunny nursery.',
      why: 'Cold starts stunt peppers — they never catch up.' },
  ]),
  transplant: pool([
    { id: 'pepper.tr.spacing', type: 'land_prep', priority: 'medium',
      title: 'Transplant at 50 cm apart',
      description: 'Plant into soft, well-drained beds once seedlings are 15 cm tall.',
      why: 'Crowded peppers share diseases and compete for light.' },
  ]),
  vegetative: pool([
    { id: 'pepper.veg.mulch', type: 'irrigation', priority: 'medium',
      title: 'Mulch around the base',
      description: 'A 5 cm mulch layer holds soil moisture and cuts weed pressure.',
      why: 'Peppers are shallow-rooted — mulch keeps the root zone stable.' },
  ]),
  flowering: pool([
    { id: 'pepper.flow.water_steady', type: 'irrigation', priority: 'high',
      title: 'Water evenly during flowering',
      description: 'Aim for 25 mm per week, split across 2–3 waterings.',
      why: 'Dry spells drop flowers and you lose those fruit clusters.' },
  ]),
  fruiting: pool([
    { id: 'pepper.fr.thrips_scout', type: 'pest', priority: 'medium',
      title: 'Scout for thrips on flowers and young fruit',
      description: 'Tap flowers over a white paper; tiny moving slivers are thrips.',
      why: 'Thrips scar fruit and carry virus — catch them before fruit set.' },
  ]),
  harvest: pool([
    { id: 'pepper.harv.cut', type: 'harvest', priority: 'high',
      title: 'Cut, don\u2019t pull',
      description: 'Use shears — pulling tears branches and stops future fruit.',
      why: 'One broken branch loses the whole cluster of future peppers.' },
  ]),
});

// ─── Potato ───────────────────────────────────────────────────
const POTATO = t({
  planting: pool([
    { id: 'potato.plant.sprouted_seed', type: 'land_prep', priority: 'high',
      title: 'Plant sprouted seed potatoes',
      description: 'Cut large seed pieces to 2–3 eyes each; plant 10 cm deep, 30 cm apart.',
      why: 'Sprouted seed emerges 1–2 weeks earlier and yields more.' },
  ]),
  vegetative: pool([
    { id: 'potato.veg.hill', type: 'land_prep', priority: 'high',
      title: 'Hill soil around the stems',
      description: 'Mound soil up the stem 2–3 times as the plant grows.',
      why: 'Hilling protects tubers from greening (sun exposure) and boosts yield.' },
  ]),
  flowering: pool([
    { id: 'potato.flow.blight_scout', type: 'pest', priority: 'high',
      title: 'Scout weekly for late blight',
      description: 'Check oldest leaves for dark water-soaked spots.',
      why: 'Blight can strip a field in 2 weeks if missed.' },
  ]),
  bulking: pool([
    { id: 'potato.bulk.water_steady', type: 'irrigation', priority: 'medium',
      title: 'Keep soil evenly moist',
      description: 'Irrigate to about 25 mm per week during tuber bulking.',
      why: 'Uneven moisture causes hollow-heart and cracked tubers.' },
  ]),
  harvest: pool([
    { id: 'potato.harv.cure', type: 'harvest', priority: 'high',
      title: 'Cure tubers before storage',
      description: 'Leave lifted tubers in a dark, airy spot for 10–14 days before storing.',
      why: 'Curing thickens the skin so tubers store without rot.' },
  ]),
});

// ─── Banana ───────────────────────────────────────────────────
const BANANA = t({
  planting: pool([
    { id: 'banana.plant.sucker', type: 'land_prep', priority: 'high',
      title: 'Plant healthy sword suckers',
      description: 'Use suckers 1–1.5 m tall from disease-free mothers; plant 3 m × 3 m apart.',
      why: 'Banana mats last years — bad planting material haunts the whole orchard.' },
  ]),
  establishment: pool([
    { id: 'banana.est.mulch', type: 'irrigation', priority: 'medium',
      title: 'Mulch thickly around the mat',
      description: 'Apply 10 cm of leaf or grass mulch but keep it 15 cm from the stem.',
      why: 'Mulch builds soil and holds moisture — banana roots are shallow.' },
  ]),
  vegetative: pool([
    { id: 'banana.veg.desucker', type: 'weeding', priority: 'medium',
      title: 'Thin suckers to 3 per mat',
      description: 'Keep one mother, one daughter, one granddaughter; cut the rest.',
      why: 'Too many suckers share one mat\u2019s resources and shrink bunches.' },
  ]),
  flowering: pool([
    { id: 'banana.flow.deleaf', type: 'weeding', priority: 'medium',
      title: 'Remove dry and diseased leaves',
      description: 'Cut off brown or spotted leaves and burn or bury them.',
      why: 'Sigatoka lives on dead leaves — sanitation keeps it off the next crop.' },
  ]),
  maturation: pool([
    { id: 'banana.mat.prop', type: 'land_prep', priority: 'medium',
      title: 'Prop fruiting plants',
      description: 'Brace stems with forked poles once bunches are half-size.',
      why: 'A mature bunch is heavy — plants topple without support, losing the whole crop.' },
  ]),
  harvest: pool([
    { id: 'banana.harv.bunch', type: 'harvest', priority: 'high',
      title: 'Harvest full, firm bunches',
      description: 'Cut when fingers are plump but still green; ripen off-plant.',
      why: 'Bananas ripen best off the plant; leaving them on the tree risks pests and damage.' },
  ]),
});

// ─── Plantain (aligned with banana lifecycle) ─────────────────
const PLANTAIN = BANANA;

// ─── Cocoa ────────────────────────────────────────────────────
const COCOA = t({
  planting: pool([
    { id: 'cocoa.plant.shade', type: 'land_prep', priority: 'high',
      title: 'Plant under temporary shade',
      description: 'Use banana or plantain as nurse shade so seedlings get ~50% light.',
      why: 'Young cocoa scorches in full sun — shade is non-negotiable.' },
  ]),
  establishment: pool([
    { id: 'cocoa.est.weed', type: 'weeding', priority: 'high',
      title: 'Weed within 1 m of each tree',
      description: 'Keep a clean circle around each seedling for the first 2 years.',
      why: 'Weeds hide pests and compete for scarce water during establishment.' },
  ]),
  vegetative: pool([
    { id: 'cocoa.veg.prune', type: 'weeding', priority: 'medium',
      title: 'Prune for shape and airflow',
      description: 'Remove chupons (suckers) and cross-branches; keep the canopy open.',
      why: 'Good airflow reduces fungal pressure and makes harvest easier.' },
  ]),
  flowering: pool([
    { id: 'cocoa.flow.pollinator', type: 'scout', priority: 'low',
      title: 'Check pollinator presence',
      description: 'Look for midges in leaf litter; keep leaf litter deep.',
      why: 'Cocoa is pollinated by midges — no midges, no pods.' },
  ]),
  fruiting: pool([
    { id: 'cocoa.fr.sanitation', type: 'pest', priority: 'high',
      title: 'Remove black-pod diseased pods weekly',
      description: 'Cut and bury any dark, rotting pods to break the infection cycle.',
      why: 'Leaving rotten pods on the tree seeds the whole farm with spores.' },
  ]),
  harvest: pool([
    { id: 'cocoa.harv.ferment', type: 'harvest', priority: 'high',
      title: 'Ferment and dry beans properly',
      description: 'Heap or box-ferment 5–7 days, then dry on raised mats 6–10 days.',
      why: 'Flavour is made at fermentation — cut this short and the beans fetch a lower grade.' },
  ]),
});

// ─── Mango ────────────────────────────────────────────────────
const MANGO = t({
  planting: pool([
    { id: 'mango.plant.graft', type: 'land_prep', priority: 'high',
      title: 'Plant grafted varieties',
      description: 'Use nursery grafts of a proven variety; dig 60 cm pits with compost.',
      why: 'Seedling mangos take 8+ years — grafts fruit in 3.' },
  ]),
  establishment: pool([
    { id: 'mango.est.stake', type: 'land_prep', priority: 'medium',
      title: 'Stake young trees',
      description: 'Drive a strong stake and tie the graft loosely for the first year.',
      why: 'Wind whips loose grafts and the union snaps.' },
  ]),
  vegetative: pool([
    { id: 'mango.veg.training', type: 'weeding', priority: 'medium',
      title: 'Train to an open centre',
      description: 'Pinch the tip to force 3–4 branches; remove inward-growing shoots.',
      why: 'A well-shaped tree bears more fruit and is easier to harvest.' },
  ]),
  flowering: pool([
    { id: 'mango.flow.mildew', type: 'pest', priority: 'high',
      title: 'Watch panicles for powdery mildew',
      description: 'White dust on flowers means mildew — a single wet week can crash fruit set.',
      why: 'Mildew at flowering is the #1 cause of a failed mango crop.' },
  ]),
  fruiting: pool([
    { id: 'mango.fr.fruit_fly', type: 'pest', priority: 'high',
      title: 'Bag or trap against fruit fly',
      description: 'Place traps around the orchard; bag individual fruit where practical.',
      why: 'Fruit fly damage is invisible until the mango is cut open — by then it\u2019s unsellable.' },
  ]),
  harvest: pool([
    { id: 'mango.harv.firm_mature', type: 'harvest', priority: 'high',
      title: 'Pick at mature-green for transport',
      description: 'Harvest when fruit shoulders round out but flesh is still firm.',
      why: 'Tree-ripe fruit bruises in transit — mature-green ripens well off the tree.' },
  ]),
});

export const CROP_TASK_TEMPLATES = t({
  cassava:        CASSAVA,
  maize:          MAIZE,
  rice:           RICE,
  tomato:         TOMATO,
  onion:          ONION,
  okra:           OKRA,
  pepper:         PEPPER,
  potato:         POTATO,
  banana:         BANANA,
  plantain:       PLANTAIN,
  cocoa:          COCOA,
  mango:          MANGO,
});

/**
 * getCropStageTasks(canonicalKey, stageKey)
 *   Returns the frozen list of crop+stage templates, or an empty
 *   frozen array if either key is unknown — the engine then falls
 *   back to the generic stage pool in taskTemplates.js.
 */
const EMPTY = Object.freeze([]);
export function getCropStageTasks(canonicalKey, stageKey) {
  if (!canonicalKey || !stageKey) return EMPTY;
  const byCrop = CROP_TASK_TEMPLATES[canonicalKey];
  if (!byCrop) return EMPTY;
  return byCrop[stageKey] || EMPTY;
}
