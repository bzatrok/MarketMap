export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_LABELS = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export const PROVINCES = [
  'Drenthe',
  'Flevoland',
  'Friesland',
  'Gelderland',
  'Groningen',
  'Limburg',
  'Noord-Brabant',
  'Noord-Holland',
  'Overijssel',
  'Utrecht',
  'Zeeland',
  'Zuid-Holland',
];

export const PROVINCE_LABELS = {
  'Drenthe': 'DR',
  'Flevoland': 'FL',
  'Friesland': 'FR',
  'Gelderland': 'GLD',
  'Groningen': 'GR',
  'Limburg': 'LB',
  'Noord-Brabant': 'NB',
  'Noord-Holland': 'NH',
  'Overijssel': 'OV',
  'Utrecht': 'UT',
  'Zeeland': 'ZL',
  'Zuid-Holland': 'ZH',
};

export const MARKET_TYPES = [
  { value: 'weekly_market', label: 'Weekmarkt' },
  { value: 'farmers_market', label: 'Boerenmarkt' },
  { value: 'organic_market', label: 'Biologisch' },
  { value: 'groentemarkt', label: 'Groentemarkt' },
  { value: 'bloemenmarkt', label: 'Bloemenmarkt' },
  { value: 'flower_market', label: 'Bloemenmarkt' },
  { value: 'boekenmarkt', label: 'Boekenmarkt' },
  { value: 'book_market', label: 'Boekenmarkt' },
  { value: 'fabric_market', label: 'Stoffenmarkt' },
  { value: 'antique_market', label: 'Antiekmarkt' },
  { value: 'warenmarkt', label: 'Warenmarkt' },
  { value: 'regional_market', label: 'Streekmarkt' },
  { value: 'minimarkt', label: 'Minimarkt' },
];

export const MAP_DEFAULTS = {
  center: [52.1326, 5.2913], // Netherlands center
  zoom: 7,
};

// CARTO basemaps require an API key since 2025 (free to 5M tile requests/month,
// see https://carto.com/basemaps/apikey/). The key is public by design -- it ships
// in the client bundle -- and is domain-locked in the CARTO dashboard.
// CARTO's GL styles carry no key parameter, so Map.js appends it per request.
export const BASEMAP = {
  styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  host: 'cartocdn.com',
  key: process.env.NEXT_PUBLIC_CARTO_KEY,
};
