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

/**
 * Returns a predicted CropCategory based on user-typed crop name in English or vernacular,
 * or null if no confident match was found.
 */
export function matchCropCategory(cropInput: string | undefined | null): CropCategory | null {
  if (!cropInput) return null;
  const normalized = cropInput.trim().toLowerCase();
  if (normalized.length === 0) return null;

  // Direct match or word boundary match
  for (const [category, keywords] of Object.entries(CROP_CATEGORY_MAP) as [CropCategory, string[]][]) {
    for (const keyword of keywords) {
      if (
        normalized === keyword ||
        normalized.startsWith(`${keyword} `) ||
        normalized.endsWith(` ${keyword}`) ||
        normalized.includes(` ${keyword} `)
      ) {
        return category;
      }
    }
  }

  // Substring match for compound words (e.g., "organic wheat", "kashmiri chilli")
  for (const [category, keywords] of Object.entries(CROP_CATEGORY_MAP) as [CropCategory, string[]][]) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return category;
      }
    }
  }

  return null;
}
