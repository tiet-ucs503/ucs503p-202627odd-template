/**
 * Curated agri knowledge for Grounded Kisan (PRD §8.2).
 * Sources are summarized one-pagers for teaching/demo — not official legal text.
 * Prefer citing these over free-form Gemini inventing doses or eligibility.
 */

export type KnowledgeCategory = 'crop' | 'scheme' | 'weather';

export interface KnowledgeChunk {
  id: string;
  title: string;
  /** Human-readable citation shown to the farmer. */
  source: string;
  category: KnowledgeCategory;
  tags: string[];
  text: string;
}

export const KNOWLEDGE_PACK: readonly KnowledgeChunk[] = [
  {
    id: 'crop-wheat-sowing',
    title: 'Wheat — sowing window and seed rate',
    source: 'ICAR-style wheat card (curated)',
    category: 'crop',
    tags: ['wheat', 'gehu', 'sowing', 'seed', 'rabi'],
    text: 'For north-west India rabi wheat, the main sowing window is mid-October to mid-November. Use certified seed. Typical seed rate is about 100 kg/ha for line sowing (adjust for variety and seed size). Avoid late sowing after late November where possible — yield drops with delay. Confirm local university / KVK calendar for your district.',
  },
  {
    id: 'crop-wheat-irrigation',
    title: 'Wheat — irrigation stages',
    source: 'ICAR-style wheat card (curated)',
    category: 'crop',
    tags: ['wheat', 'irrigation', 'water', 'crown root'],
    text: 'Critical irrigation stages for wheat include crown-root initiation (about 20–25 days after sowing), tillering, jointing, flowering, and grain filling. Do not let the field crack at CRI. Excess standing water also hurts roots — drain waterlogging. Exact intervals depend on soil type and rainfall.',
  },
  {
    id: 'crop-wheat-rust',
    title: 'Wheat — rust and foliar disease signs',
    source: 'ICAR-style wheat card (curated)',
    category: 'crop',
    tags: ['wheat', 'rust', 'disease', 'yellow', 'leaf'],
    text: 'Yellow/stripe rust shows yellow stripes on leaves; leaf rust shows orange-brown pustules; stem rust is darker and on stems. Prefer resistant varieties for your zone. At first disease sighting, consult KVK / plant clinic for confirmation — do not spray a chemical dose from chat. Remove heavily infected debris after harvest where advised.',
  },
  {
    id: 'crop-rice-nursery',
    title: 'Rice — nursery and transplanting basics',
    source: 'ICAR-style rice card (curated)',
    category: 'crop',
    tags: ['rice', 'paddy', 'dhhaan', 'nursery', 'transplant'],
    text: 'Raise a healthy nursery with treated certified seed. Transplant 20–30 day old seedlings for many short/medium varieties (follow variety leaflet). Maintain shallow standing water after establishment; avoid continuous deep flooding that weakens plants. Line transplanting helps weeding and fertilizer use.',
  },
  {
    id: 'crop-rice-blast',
    title: 'Rice — blast disease awareness',
    source: 'ICAR-style rice card (curated)',
    category: 'crop',
    tags: ['rice', 'blast', 'fungus', 'neck'],
    text: 'Rice blast can show diamond-shaped leaf spots and neck infection that kills panicles. Humid weather favors it. Use resistant varieties where available, avoid excess nitrogen at once, and seek local diagnosis before any fungicide. Kisan will escalate pesticide dosing questions to an agronomist.',
  },
  {
    id: 'crop-tomato-care',
    title: 'Tomato — staking, watering, common issues',
    source: 'ICAR-style tomato card (curated)',
    category: 'crop',
    tags: ['tomato', 'tamatar', 'staking', 'blight'],
    text: 'Stake or trellis indeterminate tomatoes. Water at the base regularly; avoid wetting foliage late in the day. Watch for early/late blight (leaf spots, rapid collapse in wet weather) and fruit borers. Prefer resistant hybrids when possible. For spray schedules and doses, ask a local agronomist or KVK — not chat.',
  },
  {
    id: 'crop-onion-storage',
    title: 'Onion — harvest and curing',
    source: 'ICAR-style onion card (curated)',
    category: 'crop',
    tags: ['onion', 'pyaz', 'curing', 'storage', 'harvest'],
    text: 'Harvest onions when necks soften and tops fall for many bulb crops. Field-cure in shade with good air flow before storage. Store in dry, ventilated heaps or racks; discard soft/rotten bulbs. High moisture causes storage rot.',
  },
  {
    id: 'crop-potato-seed',
    title: 'Potato — seed and late blight watch',
    source: 'ICAR-style potato card (curated)',
    category: 'crop',
    tags: ['potato', 'aloo', 'seed', 'blight'],
    text: 'Use healthy certified seed tubers. Cut seed only when advised and treat cuts per local guidance. Late blight thrives in cool wet weather — watch leaf lesions with pale borders. Destroy volunteer plants. Chemical control doses must come from an agronomist label, not from Kisan.',
  },
  {
    id: 'crop-mustard-basics',
    title: 'Mustard — sowing and aphids',
    source: 'ICAR-style mustard card (curated)',
    category: 'crop',
    tags: ['mustard', 'sarson', 'aphid', 'rabi'],
    text: 'Mustard is a major rabi oilseed in north India. Timely sowing and balanced fertility help. Aphids often appear at flowering — monitor colonies on growing tips. Prefer cultural/biological options first where suitable; for insecticide choice and dose, escalate to an agronomist.',
  },
  {
    id: 'crop-maize-basics',
    title: 'Maize — spacing and nitrogen',
    source: 'ICAR-style maize card (curated)',
    category: 'crop',
    tags: ['maize', 'makka', 'corn', 'nitrogen'],
    text: 'Maize needs good drainage and adequate nitrogen split across growth. Follow recommended spacing for the hybrid. Silking and grain fill are moisture-sensitive. Avoid water stress then. Confirm fertilizer rates from local package of practices.',
  },
  {
    id: 'crop-cotton-ipm',
    title: 'Cotton — IPM mindset for bollworm',
    source: 'ICAR-style cotton card (curated)',
    category: 'crop',
    tags: ['cotton', 'kapas', 'bollworm', 'ipm'],
    text: 'Monitor cotton for bollworm and sucking pests with regular field walks. Prefer IPM: resistant hybrids where relevant, threshold-based action, and conserve beneficial insects. Do not calendar-spray blindly. Exact pesticide products and ml/litre rates require agronomist / label guidance.',
  },
  {
    id: 'crop-general-soil',
    title: 'Soil — testing and organic matter',
    source: 'ICAR general soil note (curated)',
    category: 'crop',
    tags: ['soil', 'fertilizer', 'organic', 'ph', 'test'],
    text: 'Get soil tested every few seasons through a soil testing lab / KVK. Add organic matter (FYM/compost) to improve structure. Match NPK to the test report and crop. Blind heavy urea use wastes money and can lodge cereals.',
  },
  {
    id: 'scheme-pm-kisan',
    title: 'PM-Kisan — what it is',
    source: 'PM-Kisan one-pager (curated summary)',
    category: 'scheme',
    tags: ['pm-kisan', 'pmkisan', 'scheme', 'income', 'installment'],
    text: 'PM-Kisan Samman Nidhi provides income support to eligible landholding farmer families in installments credited to a linked bank account, subject to government eligibility rules and exclusions (for example some institutional landholders and higher-income categories may be excluded). Keep Aadhaar, land, and bank details updated on the official PM-Kisan portal / CSC. AgriConnect cannot check your personal eligibility live — verify on the official site or with a local agriculture office.',
  },
  {
    id: 'scheme-pm-kisan-howto',
    title: 'PM-Kisan — registration checkpoints',
    source: 'PM-Kisan one-pager (curated summary)',
    category: 'scheme',
    tags: ['pm-kisan', 'register', 'aadhaar', 'bank', 'e-kyc'],
    text: 'Typical checkpoints: valid land record in eligible category, Aadhaar seeding, bank account for DBT, and e-KYC when required by the portal. If an installment is pending, check beneficiary status and correct mismatches through the official grievance / CSC channel. Do not share OTPs or bank passwords in AgriConnect chat.',
  },
  {
    id: 'scheme-pmfby',
    title: 'PMFBY — crop insurance idea',
    source: 'PMFBY one-pager (curated summary)',
    category: 'scheme',
    tags: ['pmfby', 'insurance', 'crop insurance', 'premium', 'claim'],
    text: 'Pradhan Mantri Fasal Bima Yojana (PMFBY) is a crop insurance scheme that can cover notified crops against notified risks (such as drought, flood, pests in defined cases) when the farmer is enrolled for the season in a notified area. Premium rates and cut-off dates are notified by government. Enrol through bank / CSC / authorized channel before the cut-off. Claims follow crop cutting experiments / weather triggers — keep sowing proof and follow district instructions after a loss.',
  },
  {
    id: 'scheme-pmfby-claim',
    title: 'PMFBY — after a crop loss',
    source: 'PMFBY one-pager (curated summary)',
    category: 'scheme',
    tags: ['pmfby', 'claim', 'loss', 'flood', 'drought'],
    text: 'After a suspected insured loss, inform the insurer / bank / CSC quickly as per the season circular, and cooperate with surveys. Photograph damage if advised locally. Do not wait until harvest is fully cleared if early intimation is required. Exact claim amounts depend on official assessment, not on chat estimates.',
  },
  {
    id: 'scheme-msp',
    title: 'MSP — minimum support price basics',
    source: 'MSP one-pager (curated summary)',
    category: 'scheme',
    tags: ['msp', 'minimum support', 'procurement', 'fci', 'mandi'],
    text: 'Minimum Support Price (MSP) is a government-announced price for selected crops intended to support farmers when market prices fall. Actual procurement happens only for notified crops at designated centers with quality specs (moisture, foreign matter). MSP is not a guarantee that every private buyer pays MSP. Check the current season MSP list from official agriculture / food ministry releases for your crop.',
  },
  {
    id: 'scheme-msp-vs-market',
    title: 'MSP vs AgriConnect market price',
    source: 'MSP one-pager (curated summary)',
    category: 'scheme',
    tags: ['msp', 'market', 'listing', 'price', 'mandi'],
    text: 'On AgriConnect you set a listing price with buyers directly. Mandi / MSP figures are references for fairness, not automatic checkout prices. Compare your offer with local mandi trends and any MSP for that crop, then negotiate quality, logistics, and payment terms on the platform.',
  },
  {
    id: 'weather-irrigation',
    title: 'Weather — irrigation around rain',
    source: 'Weather advisory rules (curated)',
    category: 'weather',
    tags: ['weather', 'rain', 'irrigation', 'forecast'],
    text: 'If significant rain is forecast within 24–48 hours, delay irrigation for most field crops to avoid waterlogging. After heavy rain, drain low spots. Before a dry heat spell, irrigate critical stages (flowering, grain fill) early morning or evening when possible.',
  },
  {
    id: 'weather-frost',
    title: 'Weather — frost watch for rabi',
    source: 'Weather advisory rules (curated)',
    category: 'weather',
    tags: ['frost', 'cold', 'rabi', 'potato', 'mustard'],
    text: 'Frost can damage potato, mustard, and young vegetables. When a frost night is forecast, light irrigation the previous afternoon (where soils allow) and covering sensitive nursery beds with cloth/mulch can reduce injury. Avoid spraying just before a hard frost unless a local expert says otherwise.',
  },
  {
    id: 'weather-heat',
    title: 'Weather — heat stress',
    source: 'Weather advisory rules (curated)',
    category: 'weather',
    tags: ['heat', 'temperature', 'wilting', 'shade'],
    text: 'During extreme heat, irrigate to maintain soil moisture, mulch where practical, and prefer morning/evening field work. Temporary shade nets help nurseries and vegetables. Wilting at midday that recovers by evening can be temporary; continuous wilt needs root/disease checks with an expert.',
  },
  {
    id: 'weather-spray-window',
    title: 'Weather — when not to spray',
    source: 'Weather advisory rules (curated)',
    category: 'weather',
    tags: ['spray', 'wind', 'rain', 'pesticide'],
    text: 'Do not spray plant protection chemicals when rain is expected within a few hours or in strong wind — drift and wash-off waste product and raise risk. Exact products and doses are high-stakes: Kisan escalates those questions to an agronomist.',
  },
  {
    id: 'weather-harvest',
    title: 'Weather — harvest timing',
    source: 'Weather advisory rules (curated)',
    category: 'weather',
    tags: ['harvest', 'rain', 'drying', 'moisture'],
    text: 'Avoid harvesting grain into heavy rain; high moisture invites spoilage and rejection at purchase. Dry produce to safe moisture before bagging. For onions and vegetables, avoid packing wet produce into closed bags.',
  },
] as const;
