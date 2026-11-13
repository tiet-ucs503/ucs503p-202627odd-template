/**
 * Indian airports TripEase can price a flight from, or to on a trip inside
 * India.
 *
 * Coordinates are each airport's own position (not the city centre), rounded
 * to about 100 m, and are only used to measure great-circle distance. `serves`
 * lists the places a traveller might name that are normally reached through
 * that airport: "Munnar" is a road trip from Kochi, so a trip starting in
 * Munnar is priced to COK.
 */

export type AirportRole =
  /** Big enough that almost every other Indian airport has a nonstop to it. */
  | "hub"
  /** Busy enough to have nonstops to the hubs and to each other. */
  | "focus"
  /** Mostly nonstops to the hubs only. */
  | "regional";

export interface IndianAirport {
  code: string;
  /** The city as a traveller would say it; shown in the picker and the quote. */
  city: string;
  lat: number;
  lng: number;
  role: AirportRole;
  /**
   * How much dearer this airport's routes are than their distance suggests:
   * small aircraft, few seats, heavy tourist demand. 1 (or absent) is a normal
   * airport.
   */
  premium?: number;
  /** Lowercase names of the places this airport is the usual way into. */
  serves: string[];
  /** Offered as a "Flying from" choice. */
  origin?: boolean;
  /**
   * Months this airport is unusually cheap or dear to fly into, as a ratio to
   * its yearly average. Only for strongly seasonal places (Goa, Leh, ...).
   */
  season?: Partial<Record<number, number>>;
}

export const INDIAN_AIRPORTS: IndianAirport[] = [
  // Hubs
  { code: "DEL", city: "Delhi", lat: 28.556, lng: 77.1, role: "hub", origin: true,
    serves: ["delhi", "new delhi", "old delhi", "noida", "greater noida", "gurgaon", "gurugram", "ghaziabad",
      "faridabad", "agra", "mathura", "vrindavan", "ncr"] },
  { code: "BOM", city: "Mumbai", lat: 19.09, lng: 72.866, role: "hub", origin: true,
    serves: ["mumbai", "bombay", "navi mumbai", "thane", "alibaug"] },
  { code: "BLR", city: "Bengaluru", lat: 13.199, lng: 77.707, role: "hub", origin: true,
    serves: ["bengaluru", "bangalore", "mysuru", "mysore", "nandi hills"],
    season: { 2: 0.83, 3: 0.85, 10: 1.18 } },
  { code: "MAA", city: "Chennai", lat: 12.994, lng: 80.171, role: "hub", origin: true,
    serves: ["chennai", "madras", "mahabalipuram", "mamallapuram", "pondicherry", "puducherry", "kanchipuram"] },
  { code: "HYD", city: "Hyderabad", lat: 17.24, lng: 78.429, role: "hub", origin: true,
    serves: ["hyderabad", "secunderabad"] },
  { code: "CCU", city: "Kolkata", lat: 22.655, lng: 88.447, role: "hub", origin: true,
    serves: ["kolkata", "calcutta", "sundarbans", "shantiniketan"] },

  // Focus cities
  { code: "COK", city: "Kochi", lat: 10.152, lng: 76.402, role: "focus", origin: true,
    serves: ["kochi", "cochin", "ernakulam", "fort kochi", "munnar", "alleppey", "alappuzha", "kumarakom",
      "thekkady", "kerala"],
    season: { 2: 0.9, 12: 1.16 } },
  { code: "GOI", city: "Goa", lat: 15.381, lng: 73.831, role: "focus", origin: true,
    serves: ["goa", "panaji", "panjim", "calangute", "baga", "anjuna", "candolim", "palolem", "vagator", "margao",
      "north goa", "south goa", "gokarna"],
    season: { 1: 1.15, 7: 0.75, 9: 0.72, 11: 1.12, 12: 1.4 } },
  { code: "AMD", city: "Ahmedabad", lat: 23.077, lng: 72.635, role: "focus", origin: true,
    serves: ["ahmedabad", "gandhinagar", "gujarat"] },
  { code: "PNQ", city: "Pune", lat: 18.582, lng: 73.92, role: "focus", origin: true,
    serves: ["pune", "lonavala", "khandala", "mahabaleshwar", "panchgani"] },
  { code: "JAI", city: "Jaipur", lat: 26.824, lng: 75.812, role: "focus", origin: true,
    serves: ["jaipur", "ajmer", "pushkar", "ranthambore", "sawai madhopur"] },
  { code: "LKO", city: "Lucknow", lat: 26.761, lng: 80.889, role: "focus", origin: true,
    serves: ["lucknow", "ayodhya"] },
  { code: "GAU", city: "Guwahati", lat: 26.106, lng: 91.586, role: "focus", origin: true,
    serves: ["guwahati", "shillong", "kaziranga", "cherrapunji", "meghalaya", "assam"] },

  // Regional airports
  { code: "IXC", city: "Chandigarh", lat: 30.674, lng: 76.789, role: "regional", origin: true,
    serves: ["chandigarh", "mohali", "panchkula", "zirakpur", "patiala", "kasauli", "shimla"] },
  { code: "ATQ", city: "Amritsar", lat: 31.71, lng: 74.797, role: "regional", origin: true,
    serves: ["amritsar"] },
  { code: "TRV", city: "Thiruvananthapuram", lat: 8.482, lng: 76.92, role: "regional", origin: true,
    serves: ["thiruvananthapuram", "trivandrum", "kovalam", "varkala", "kanyakumari"] },
  { code: "CCJ", city: "Kozhikode", lat: 11.137, lng: 75.955, role: "regional", origin: true,
    serves: ["kozhikode", "calicut", "wayanad"] },
  { code: "CJB", city: "Coimbatore", lat: 11.03, lng: 77.043, role: "regional", origin: true,
    serves: ["coimbatore", "ooty", "udhagamandalam", "coonoor", "nilgiris"] },
  { code: "IXE", city: "Mangaluru", lat: 12.961, lng: 74.89, role: "regional", origin: true, premium: 1.05,
    serves: ["mangaluru", "mangalore", "udupi", "coorg", "kodagu", "madikeri"] },
  { code: "IXM", city: "Madurai", lat: 9.835, lng: 78.093, role: "regional", origin: true,
    serves: ["madurai", "rameswaram", "kodaikanal"] },
  { code: "VTZ", city: "Visakhapatnam", lat: 17.721, lng: 83.225, role: "regional", origin: true,
    serves: ["visakhapatnam", "vizag", "araku"] },
  { code: "BBI", city: "Bhubaneswar", lat: 20.244, lng: 85.818, role: "regional", origin: true,
    serves: ["bhubaneswar", "puri", "konark", "odisha"] },
  { code: "NAG", city: "Nagpur", lat: 21.092, lng: 79.047, role: "regional", origin: true,
    serves: ["nagpur", "tadoba"] },
  { code: "IDR", city: "Indore", lat: 22.722, lng: 75.801, role: "regional", origin: true,
    serves: ["indore", "ujjain", "mandu", "omkareshwar"] },
  { code: "VNS", city: "Varanasi", lat: 25.452, lng: 82.859, role: "regional", origin: true,
    serves: ["varanasi", "banaras", "benares", "kashi", "sarnath"] },
  { code: "DED", city: "Dehradun", lat: 30.19, lng: 78.18, role: "regional", origin: true, premium: 1.05,
    serves: ["dehradun", "rishikesh", "haridwar", "mussoorie"] },
  { code: "IXB", city: "Bagdogra", lat: 26.681, lng: 88.329, role: "regional", origin: true, premium: 1.15,
    serves: ["bagdogra", "siliguri", "darjeeling", "gangtok", "sikkim", "kalimpong", "pelling"],
    season: { 5: 1.2, 10: 1.25 } },
  { code: "IXJ", city: "Jammu", lat: 32.689, lng: 74.837, role: "regional", origin: true,
    serves: ["jammu", "katra", "vaishno devi"] },
  { code: "SXR", city: "Srinagar", lat: 33.987, lng: 74.774, role: "regional", origin: true, premium: 1.35,
    serves: ["srinagar", "gulmarg", "pahalgam", "sonamarg", "kashmir"],
    season: { 4: 1.25, 5: 1.3, 6: 1.3, 9: 0.7 } },
  { code: "UDR", city: "Udaipur", lat: 24.618, lng: 73.896, role: "regional", origin: true, premium: 1.1,
    serves: ["udaipur", "kumbhalgarh", "chittorgarh", "mount abu"], season: { 12: 1.15 } },

  // Small or seasonal airports: priced to, never offered as a starting point.
  { code: "JDH", city: "Jodhpur", lat: 26.251, lng: 73.049, role: "regional", premium: 1.1,
    serves: ["jodhpur"] },
  { code: "JSA", city: "Jaisalmer", lat: 26.889, lng: 70.865, role: "regional", premium: 1.5,
    serves: ["jaisalmer"], season: { 1: 1.2, 6: 0.8, 7: 0.8, 12: 1.25 } },
  { code: "IXL", city: "Leh", lat: 34.136, lng: 77.547, role: "regional", premium: 1.35,
    serves: ["leh", "ladakh", "nubra", "pangong"],
    season: { 2: 0.8, 5: 1.6, 6: 1.8, 7: 1.4, 11: 0.77 } },
  { code: "KUU", city: "Kullu", lat: 31.877, lng: 77.154, role: "regional", premium: 1.8,
    serves: ["manali", "kullu", "kasol", "solang"], season: { 5: 1.3, 6: 1.35, 12: 1.15 } },
  { code: "DHM", city: "Dharamshala", lat: 32.165, lng: 76.263, role: "regional", premium: 1.35,
    serves: ["dharamshala", "dharamsala", "mcleodganj", "mcleod ganj", "bir", "dalhousie"] },
  { code: "IXZ", city: "Port Blair", lat: 11.641, lng: 92.73, role: "regional", premium: 1.35,
    serves: ["port blair", "andaman", "havelock", "swaraj dweep", "neil island", "shaheed dweep"],
    season: { 1: 1.2, 7: 0.85, 12: 1.25 } },
  { code: "HBX", city: "Hubballi", lat: 15.362, lng: 75.085, role: "regional", premium: 1.1,
    serves: ["hubballi", "hubli", "hampi", "dharwad"] },
  { code: "IXU", city: "Aurangabad", lat: 19.863, lng: 75.398, role: "regional", premium: 1.1,
    serves: ["aurangabad", "ajanta", "ellora", "chhatrapati sambhajinagar"] },
  { code: "HJR", city: "Khajuraho", lat: 24.817, lng: 79.919, role: "regional", premium: 1.5,
    serves: ["khajuraho"] },
  { code: "TIR", city: "Tirupati", lat: 13.633, lng: 79.543, role: "regional", premium: 1.05,
    serves: ["tirupati", "tirumala"] },
  { code: "SAG", city: "Shirdi", lat: 19.689, lng: 74.379, role: "regional", premium: 1.1,
    serves: ["shirdi"] },
];

export const DEFAULT_ORIGIN = "DEL";

export const ORIGIN_AIRPORTS = INDIAN_AIRPORTS.filter((a) => a.origin);

const BY_CODE = new Map(INDIAN_AIRPORTS.map((a) => [a.code, a]));

export function indianAirport(code: string | null | undefined): IndianAirport | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

export function isOriginAirport(code: string | null | undefined): boolean {
  return Boolean(indianAirport(code)?.origin);
}
