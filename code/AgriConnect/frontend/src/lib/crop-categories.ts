import { CROP_CATEGORIES } from './constants';

export type CropCategory = (typeof CROP_CATEGORIES)[number];

const CROP_CATEGORY_MAP: Record<CropCategory, string[]> = {
  grains: [
    'wheat', 'gehu', 'kanak', 'rice', 'chawal', 'paddy', 'dhan', 'basmati',
    'maize', 'makka', 'corn', 'bajra', 'millet', 'pearl millet', 'jowar',
    'sorghum', 'ragi', 'finger millet', 'barley', 'jau', 'oats', 'rye',
    'grain', 'grains', 'anaaj',
  ],
  pulses: [
    'chana', 'gram', 'chickpea', 'bengal gram', 'moong', 'mung', 'green gram',
    'urad', 'black gram', 'toor', 'tur', 'arhar', 'pigeon pea', 'masoor',
    'red lentil', 'lentil', 'rajma', 'kidney bean', 'soybean', 'soya',
    'moth', 'lobia', 'cowpea', 'peas', 'matar', 'dal', 'daal',
    'pulse', 'pulses',
  ],
  vegetables: [
    'potato', 'aloo', 'alu', 'tomato', 'tamatar', 'onion', 'pyaz', 'pyaaz',
    'cabbage', 'patta gobhi', 'cauliflower', 'phool gobhi', 'brinjal',
    'eggplant', 'baingan', 'carrot', 'gajar', 'radish', 'mooli', 'spinach',
    'palak', 'capsicum', 'shimla mirch', 'okra', 'bhindi', 'ladyfinger',
    'pumpkin', 'kaddu', 'bottle gourd', 'lauki', 'bitter gourd', 'karela',
    'cucumber', 'kheera', 'beetroot', 'chukandar',
    'vegetable', 'vegetables', 'sabzi', 'sabji',
  ],
  fruits: [
    'apple', 'seb', 'mango', 'aam', 'banana', 'kela', 'orange', 'santra',
    'grapes', 'angoor', 'papaya', 'papita', 'guava', 'amrood', 'pomegranate',
    'anar', 'watermelon', 'tarbooj', 'muskmelon', 'kharbhuja', 'pineapple',
    'ananas', 'strawberry', 'lemon', 'nimbu', 'lime', 'sweet lime', 'mosambi',
    'litchi', 'lychee', 'coconut', 'nariyal', 'custard apple', 'sharifa',
    'fruit', 'fruits', 'phal',
  ],
  spices: [
    'turmeric', 'haldi', 'cumin', 'jeera', 'coriander', 'dhaniya', 'cardamom',
    'elaichi', 'clove', 'laung', 'black pepper', 'kali mirch', 'pepper',
    'red chilli', 'chilli', 'mirch', 'cinnamon', 'dalchini', 'fenugreek',
    'methi', 'fennel', 'saunf', 'saffron', 'kesar', 'nutmeg', 'jaiphal',
    'star anise', 'asafoetida', 'hing', 'ginger', 'adrak', 'garlic', 'lahsun',
    'curry leaves', 'spice', 'spices', 'masala', 'masale',
  ],
  oilseeds: [
    'mustard', 'sarson', 'groundnut', 'moongfali', 'peanut', 'sunflower',
    'surajmukhi', 'sesame', 'til', 'castor', 'arandi', 'flaxseed', 'alsi',
    'canola', 'cottonseed', 'oilseed', 'oilseeds', 'tel',
  ],
  other: ['cotton', 'sugarcane', 'jute', 'tobacco', 'tea', 'coffee'],
};

function stem(word: string): string {
  if (word.endsWith('oes') && word.length > 4) return word.slice(0, -2); // tomatoes -> tomato, potatoes -> potato, mangoes -> mango
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'i'; // chillies -> chilli
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1); // apples -> apple, onions -> onion
  return word;
}

/**
 * Returns a predicted CropCategory based on user-typed crop name in English or vernacular,
 * or null if no confident match was found.
 * Uses exact word-boundary matching and plural stemming to prevent false positives while
 * matching natural variations (e.g., "fresh tomatoes!", "organic wheat", "kashmiri chillies").
 */
export function matchCropCategory(cropInput: string | undefined | null): CropCategory | null {
  if (!cropInput) return null;
  const normalized = cropInput.trim().toLowerCase();
  if (normalized.length === 0) return null;

  // Extract alphanumeric tokens/words from input
  const rawWords = normalized.split(/[^a-z0-9]+/i).filter(Boolean);
  if (rawWords.length === 0) return null;
  const words = rawWords.flatMap((w) => [w, stem(w)]);

  // 1. Direct whole-input match against categories or keywords
  for (const [category, keywords] of Object.entries(CROP_CATEGORY_MAP) as [CropCategory, string[]][]) {
    if (normalized === category || stem(normalized) === category) {
      return category;
    }
    for (const keyword of keywords) {
      if (normalized === keyword || stem(normalized) === keyword) {
        return category;
      }
    }
  }

  // 2. Exact word token matching (e.g., "organic wheat" -> words: ["organic", "wheat"] -> matches "wheat")
  for (const [category, keywords] of Object.entries(CROP_CATEGORY_MAP) as [CropCategory, string[]][]) {
    for (const keyword of keywords) {
      // Single-word keywords matched against isolated tokens (or stemmed tokens)
      if (!keyword.includes(' ')) {
        if (words.includes(keyword) || words.includes(stem(keyword))) {
          return category;
        }
      } else {
        // Multi-word keywords (e.g. "pearl millet", "red chilli", "black pepper") matched with word boundaries
        const pattern = new RegExp(`(?:^|\\W)${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:$|\\W)`, 'i');
        if (pattern.test(normalized)) {
          return category;
        }
      }
    }
  }

  return null;
}
