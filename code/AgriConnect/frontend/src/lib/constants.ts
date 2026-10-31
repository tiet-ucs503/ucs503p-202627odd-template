export const CROP_CATEGORIES = [
  'grains',
  'pulses',
  'vegetables',
  'fruits',
  'spices',
  'oilseeds',
  'other',
] as const;

export const MANDI_CROPS = [
  'Wheat',
  'Rice',
  'Potato',
  'Tomato',
  'Onion',
  'Mustard',
  'Maize',
  'Cotton',
] as const;

/** States with live official mandi data (Agmarknet / data.gov.in). Haryana needs DATA_GOV_IN_API_KEY. */
export const MANDI_LIVE_STATES = [
  'Punjab',
  'Haryana',
  'Maharashtra',
  'Uttar Pradesh',
  'Madhya Pradesh',
  'Karnataka',
] as const;

export const UNITS = ['kg', 'quintal', 'ton'] as const;

export const BUYER_TYPES = ['trader', 'retailer', 'bulk', 'horeca'] as const;

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Bihar',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
] as const;
