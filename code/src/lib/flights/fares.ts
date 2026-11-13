/**
 * The fare data behind TripEase's flight estimates. Every amount is a
 * round-trip economy fare for one adult, in rupees.
 *
 * Where the numbers come from (researched 13 November 2026):
 *
 *  - A gateway marked `route` uses KAYAK India's published average for that
 *    route from Delhi over the previous 12 months, and its cheapest and
 *    dearest months where KAYAK names them.
 *  - A gateway marked `derived` had no 12-month average to read. Its fare is
 *    built from the nearest researched route plus that city's monthly
 *    figures from KAYAK, momondo or Cheapflights.
 *  - Origin factors compare other Indian cities with Delhi on the same
 *    destinations (Mumbai to London is 7% cheaper than Delhi to London, for
 *    example), from the same sources.
 *
 * Nothing here is a live fare. It is a model fitted to a year of real fares,
 * and the quote it produces says so.
 */

/** Destinations whose fares from India move together through the year. */
export type FareGroup =
  | "gulf"
  | "west-asia"
  | "himalaya"
  | "indian-ocean"
  | "southeast-asia"
  | "east-asia"
  | "europe"
  | "africa"
  | "north-america"
  | "south-america"
  | "oceania";

export interface Gateway {
  /** IATA airport or city code. */
  code: string;
  city: string;
  /** 12-month average return fare from Delhi. */
  fromDelhiInr: number;
  source: "route" | "derived";
  /** Lowercase names of the places this airport is the usual way into. */
  serves: string[];
  /** Month (1-12) to ratio of that month's fare to the yearly average. */
  season?: Partial<Record<number, number>>;
  /** How much dearer booking within two weeks is, when researched (0.34 = +34%). */
  lastMinute?: number;
}

export interface CountryFares {
  group: FareGroup;
  /** The first gateway is used when the trip's first city is not recognised. */
  gateways: Gateway[];
}

const g = (
  code: string,
  city: string,
  fromDelhiInr: number,
  source: Gateway["source"],
  serves: string[],
  season?: Gateway["season"],
  lastMinute?: number,
): Gateway => ({ code, city, fromDelhiInr, source, serves, season, lastMinute });

/** Keyed by ISO country code, matching `COUNTRIES` in `@/lib/countries`. */
export const COUNTRY_FARES: Record<string, CountryFares> = {
  TH: { group: "southeast-asia", gateways: [
    g("BKK", "Bangkok", 31_000, "route", ["bangkok", "pattaya", "ayutthaya", "hua hin"],
      { 7: 0.88, 9: 0.85, 6: 1.12, 12: 1.2 }),
    g("HKT", "Phuket", 31_590, "route", ["phuket", "krabi", "phi phi", "ao nang", "khao lak", "koh lanta"],
      { 9: 0.78, 6: 1.05, 12: 1.08 }),
    g("CNX", "Chiang Mai", 36_000, "derived", ["chiang mai", "chiang rai", "pai"]),
    g("USM", "Koh Samui", 42_000, "derived", ["koh samui", "samui", "koh phangan", "koh tao"]),
  ] },
  AE: { group: "gulf", gateways: [
    g("DXB", "Dubai", 28_140, "route", ["dubai", "sharjah", "ras al khaimah"], { 7: 0.78, 12: 1.23 }),
    g("AUH", "Abu Dhabi", 27_500, "derived", ["abu dhabi", "al ain"]),
  ] },
  SG: { group: "southeast-asia", gateways: [
    g("SIN", "Singapore", 30_690, "route", ["singapore", "singapura", "sentosa"], { 3: 0.88, 12: 1.36 }, 0.34),
  ] },
  ID: { group: "southeast-asia", gateways: [
    g("DPS", "Bali", 45_000, "route", ["bali", "ubud", "seminyak", "uluwatu", "denpasar", "kuta", "canggu",
      "nusa dua", "nusa penida", "sanur", "jimbaran", "lombok", "gili"], { 1: 0.75, 6: 1.17, 8: 1.16 }),
    g("CGK", "Jakarta", 38_000, "derived", ["jakarta", "bandung", "java"]),
    g("JOG", "Yogyakarta", 44_000, "derived", ["yogyakarta", "jogja", "borobudur", "prambanan"]),
    g("LBJ", "Labuan Bajo", 52_000, "derived", ["labuan bajo", "komodo", "flores"]),
  ] },
  MV: { group: "indian-ocean", gateways: [
    g("MLE", "Malé", 41_000, "route", ["male", "malé", "maafushi", "maldives", "hulhumale", "atoll"],
      { 4: 0.93, 12: 1.12 }, 0.16),
  ] },
  MY: { group: "southeast-asia", gateways: [
    g("KUL", "Kuala Lumpur", 29_760, "route", ["kuala lumpur", "kl", "malacca", "melaka", "putrajaya",
      "genting", "cameron highlands"], { 3: 0.73, 6: 1.23 }, 0.15),
    g("PEN", "Penang", 33_000, "derived", ["penang", "george town", "georgetown", "ipoh"]),
    g("LGK", "Langkawi", 36_000, "derived", ["langkawi"]),
    g("BKI", "Kota Kinabalu", 40_000, "derived", ["kota kinabalu", "borneo", "sabah"]),
  ] },
  VN: { group: "southeast-asia", gateways: [
    g("HAN", "Hanoi", 31_000, "route", ["hanoi", "ha long", "halong", "ha long bay", "sapa", "ninh binh"],
      { 9: 0.87, 5: 1.07, 12: 1.18 }),
    g("SGN", "Ho Chi Minh City", 31_130, "route", ["ho chi minh", "ho chi minh city", "saigon", "mekong",
      "can tho"], { 7: 0.8, 12: 1.11 }),
    g("DAD", "Da Nang", 34_000, "derived", ["da nang", "danang", "hoi an", "hue", "huế"]),
    g("PQC", "Phu Quoc", 37_000, "derived", ["phu quoc"]),
  ] },
  LK: { group: "indian-ocean", gateways: [
    g("CMB", "Colombo", 32_000, "route", ["colombo", "kandy", "ella", "galle", "sigiriya", "negombo",
      "bentota", "mirissa", "nuwara eliya", "dambulla", "trincomalee", "unawatuna"], { 9: 0.88, 12: 1.07 }, 0.05),
  ] },
  JP: { group: "east-asia", gateways: [
    g("TYO", "Tokyo", 61_050, "route", ["tokyo", "hakone", "nikko", "kamakura", "yokohama", "mount fuji", "fuji",
      "kawaguchiko"], { 1: 0.88, 2: 1.16, 10: 1.16 }, 0.25),
    g("KIX", "Osaka", 50_000, "derived", ["osaka", "kyoto", "nara", "kobe", "hiroshima", "himeji"],
      { 10: 0.81, 3: 1.12 }),
    g("CTS", "Sapporo", 66_000, "derived", ["sapporo", "hokkaido", "niseko", "otaru"]),
  ] },
  NP: { group: "himalaya", gateways: [
    g("KTM", "Kathmandu", 17_330, "route", ["kathmandu", "pokhara", "chitwan", "nagarkot", "bhaktapur", "patan",
      "lumbini", "everest", "annapurna"], { 1: 0.72, 10: 1.57 }, 0.01),
  ] },
  BT: { group: "himalaya", gateways: [
    g("PBH", "Paro", 38_000, "route", ["paro", "thimphu", "punakha", "bhutan", "tiger's nest", "tigers nest",
      "bumthang", "phobjikha"]),
  ] },
  KR: { group: "east-asia", gateways: [
    g("ICN", "Seoul", 50_620, "route", ["seoul", "incheon", "suwon", "nami island"], { 8: 0.93, 12: 1.09 }, 0.18),
    g("PUS", "Busan", 55_000, "derived", ["busan", "gyeongju"]),
    g("CJU", "Jeju", 56_000, "derived", ["jeju", "jeju island"]),
  ] },
  KH: { group: "southeast-asia", gateways: [
    g("REP", "Siem Reap", 42_000, "route", ["siem reap", "angkor", "angkor wat"], { 3: 0.65, 12: 1.1 }),
    g("PNH", "Phnom Penh", 42_000, "derived", ["phnom penh", "kampot", "sihanoukville", "koh rong"]),
  ] },
  PH: { group: "southeast-asia", gateways: [
    g("MNL", "Manila", 42_420, "route", ["manila", "makati", "tagaytay", "baguio"], { 1: 0.79, 6: 1.21 }, 0.25),
    g("CEB", "Cebu", 46_000, "derived", ["cebu", "bohol", "moalboal", "oslob", "siargao"]),
    g("PPS", "Puerto Princesa", 50_000, "derived", ["el nido", "palawan", "puerto princesa", "coron"]),
    g("MPH", "Boracay", 50_000, "derived", ["boracay", "caticlan"]),
  ] },
  TR: { group: "west-asia", gateways: [
    g("IST", "Istanbul", 35_000, "route", ["istanbul"], { 1: 0.7, 7: 1.33, 8: 1.25 }, 0.49),
    g("AYT", "Antalya", 40_000, "derived", ["antalya", "alanya", "kas", "kaş", "side", "kemer"]),
    g("NAV", "Cappadocia", 41_000, "derived", ["cappadocia", "goreme", "göreme", "uchisar", "kayseri",
      "nevsehir", "nevşehir"]),
    g("DLM", "Dalaman", 41_000, "derived", ["fethiye", "dalaman", "oludeniz", "ölüdeniz", "bodrum", "pamukkale"]),
  ] },
  OM: { group: "gulf", gateways: [
    g("MCT", "Muscat", 23_660, "route", ["muscat", "nizwa", "wahiba", "wahiba sands", "sur", "jebel akhdar"],
      { 10: 0.84 }),
    g("SLL", "Salalah", 30_000, "derived", ["salalah", "dhofar"]),
  ] },
  JO: { group: "west-asia", gateways: [
    g("AMM", "Amman", 46_000, "route", ["amman", "petra", "wadi rum", "dead sea", "jerash", "aqaba", "madaba"],
      { 10: 0.84 }),
  ] },
  GE: { group: "west-asia", gateways: [
    g("TBS", "Tbilisi", 47_870, "route", ["tbilisi", "kazbegi", "stepantsminda", "mtskheta", "kakheti",
      "sighnaghi", "gudauri"], { 2: 0.82, 7: 1.25 }, 0.15),
    g("BUS", "Batumi", 50_000, "derived", ["batumi"]),
  ] },
  FR: { group: "europe", gateways: [
    g("PAR", "Paris", 60_000, "route", ["paris", "versailles", "giverny", "disneyland paris", "normandy",
      "loire"], { 3: 1.2, 8: 1.22 }),
    g("NCE", "Nice", 66_000, "derived", ["nice", "cannes", "monaco", "antibes", "menton", "french riviera",
      "provence", "marseille"]),
    g("LYS", "Lyon", 64_000, "derived", ["lyon", "annecy", "chamonix"]),
  ] },
  IT: { group: "europe", gateways: [
    g("ROM", "Rome", 60_480, "route", ["rome", "roma", "vatican", "vatican city"], { 5: 0.77, 1: 1.25 }, 0.35),
    g("MIL", "Milan", 58_000, "derived", ["milan", "milano", "lake como", "como", "bergamo", "turin", "torino"]),
    g("VCE", "Venice", 60_000, "derived", ["venice", "venezia", "verona", "padua", "dolomites", "burano",
      "murano"]),
    g("FLR", "Florence", 66_000, "derived", ["florence", "firenze", "pisa", "tuscany", "siena", "cinque terre",
      "lucca", "san gimignano"]),
    g("NAP", "Naples", 64_000, "derived", ["naples", "napoli", "amalfi", "amalfi coast", "positano", "sorrento",
      "capri", "pompeii"]),
  ] },
  ES: { group: "europe", gateways: [
    g("BCN", "Barcelona", 62_990, "route", ["barcelona", "costa brava", "girona", "montserrat"],
      { 4: 0.89, 8: 1.08, 10: 1.08 }, 0.19),
    g("MAD", "Madrid", 58_000, "derived", ["madrid", "toledo", "segovia"], { 12: 0.86, 8: 1.24 }),
    g("SVQ", "Seville", 66_000, "derived", ["seville", "sevilla", "cordoba", "córdoba", "cadiz", "cádiz"]),
    g("AGP", "Málaga", 64_000, "derived", ["malaga", "málaga", "granada", "marbella", "ronda", "nerja"]),
  ] },
  CH: { group: "europe", gateways: [
    g("ZRH", "Zurich", 62_270, "route", ["zurich", "zürich", "lucerne", "luzern", "interlaken", "grindelwald",
      "lauterbrunnen", "bern", "basel", "st. moritz", "st moritz", "jungfraujoch", "engelberg"],
      { 2: 0.91, 4: 1.16 }, 0.31),
    g("GVA", "Geneva", 64_000, "derived", ["geneva", "genève", "montreux", "lausanne", "zermatt"]),
  ] },
  GB: { group: "europe", gateways: [
    g("LON", "London", 73_580, "route", ["london", "oxford", "cambridge", "bath", "windsor", "stonehenge",
      "cotswolds", "brighton"], { 12: 0.89, 4: 1.12, 8: 1.1 }),
    g("EDI", "Edinburgh", 75_000, "derived", ["edinburgh", "glasgow", "highlands", "inverness", "isle of skye",
      "scotland"]),
    g("MAN", "Manchester", 70_000, "derived", ["manchester", "liverpool", "lake district", "york"]),
  ] },
  GR: { group: "europe", gateways: [
    g("ATH", "Athens", 53_890, "route", ["athens", "delphi", "meteora", "nafplio"],
      { 2: 0.9, 10: 1.1, 12: 1.1 }, 0.29),
    g("JTR", "Santorini", 65_000, "derived", ["santorini", "oia", "fira"]),
    g("JMK", "Mykonos", 65_000, "derived", ["mykonos"]),
    g("HER", "Heraklion", 63_000, "derived", ["crete", "heraklion", "chania"]),
  ] },
  DE: { group: "europe", gateways: [
    g("FRA", "Frankfurt", 62_850, "route", ["frankfurt", "heidelberg", "rhine valley", "rothenburg"],
      { 12: 0.97, 1: 1.32, 3: 1.4 }),
    g("BER", "Berlin", 64_000, "derived", ["berlin", "potsdam", "dresden", "leipzig", "hamburg"],
      { 7: 0.89, 8: 1.1 }),
    g("MUC", "Munich", 74_960, "route", ["munich", "münchen", "neuschwanstein", "bavaria", "fussen", "füssen"],
      { 11: 0.82, 5: 1.16 }),
    g("CGN", "Cologne", 64_000, "derived", ["cologne", "köln", "koln", "bonn", "dusseldorf", "düsseldorf"]),
  ] },
  NL: { group: "europe", gateways: [
    g("AMS", "Amsterdam", 58_720, "route", ["amsterdam", "rotterdam", "the hague", "den haag", "utrecht", "delft",
      "keukenhof", "giethoorn", "zaanse schans", "haarlem"], { 11: 0.94, 3: 1.2, 6: 1.2 }),
  ] },
  PT: { group: "europe", gateways: [
    g("LIS", "Lisbon", 77_170, "route", ["lisbon", "lisboa", "sintra", "cascais"], { 7: 0.88, 3: 1.12 }, 0.1),
    g("OPO", "Porto", 75_000, "derived", ["porto", "douro", "douro valley", "braga"]),
    g("FAO", "Faro", 78_000, "derived", ["lagos", "algarve", "faro", "albufeira"]),
  ] },
  AT: { group: "europe", gateways: [
    g("VIE", "Vienna", 61_000, "route", ["vienna", "wien", "wachau"], { 10: 0.92, 1: 1.2, 3: 1.16 }, 0.1),
    g("SZG", "Salzburg", 66_000, "derived", ["salzburg", "hallstatt"]),
    g("INN", "Innsbruck", 68_000, "derived", ["innsbruck", "tyrol", "tirol"]),
  ] },
  HR: { group: "europe", gateways: [
    g("DBV", "Dubrovnik", 80_000, "route", ["dubrovnik"]),
    g("SPU", "Split", 76_000, "derived", ["split", "hvar", "zadar", "makarska", "trogir"]),
    g("ZAG", "Zagreb", 70_030, "route", ["zagreb", "plitvice", "plitvice lakes"], { 5: 0.95, 3: 1.41 }),
  ] },
  CZ: { group: "europe", gateways: [
    g("PRG", "Prague", 62_000, "route", ["prague", "praha", "cesky krumlov", "český krumlov", "karlovy vary",
      "kutna hora", "kutná hora"], { 1: 0.86, 6: 1.17, 7: 1.18 }),
  ] },
  IS: { group: "europe", gateways: [
    g("KEF", "Reykjavík", 80_000, "route", ["reykjavik", "reykjavík", "vik", "vík", "golden circle",
      "blue lagoon", "akureyri", "iceland"], { 5: 0.89, 8: 1.4 }),
  ] },
  NO: { group: "europe", gateways: [
    g("OSL", "Oslo", 68_000, "route", ["oslo"], { 11: 0.78, 1: 1.21, 4: 1.2 }),
    g("BGO", "Bergen", 74_000, "derived", ["bergen", "flam", "flåm", "geiranger", "fjords", "stavanger"]),
    g("TOS", "Tromsø", 80_000, "derived", ["tromsø", "tromso", "lofoten", "northern lights", "senja"]),
  ] },
  MU: { group: "africa", gateways: [
    g("MRU", "Mauritius", 52_000, "route", ["mauritius", "port louis", "grand baie", "flic en flac", "le morne",
      "belle mare"], { 2: 0.89, 6: 1.22, 7: 1.24 }),
  ] },
  EG: { group: "africa", gateways: [
    g("CAI", "Cairo", 45_740, "route", ["cairo", "giza", "alexandria"], { 11: 0.78, 5: 1.25, 6: 1.35 }, 0.18),
    g("LXR", "Luxor", 52_000, "derived", ["luxor", "aswan", "abu simbel", "nile"]),
    g("HRG", "Hurghada", 52_000, "derived", ["hurghada", "sharm el sheikh", "red sea", "dahab", "marsa alam"]),
  ] },
  MA: { group: "africa", gateways: [
    g("RAK", "Marrakech", 74_000, "route", ["marrakech", "marrakesh", "essaouira", "atlas mountains",
      "ouarzazate", "merzouga", "sahara"], { 9: 0.77, 2: 1.11 }),
    g("FEZ", "Fes", 76_000, "derived", ["fes", "fez", "chefchaouen", "meknes"]),
    g("CMN", "Casablanca", 70_000, "derived", ["casablanca", "rabat", "tangier"]),
  ] },
  ZA: { group: "africa", gateways: [
    g("CPT", "Cape Town", 77_660, "route", ["cape town", "stellenbosch", "franschhoek", "garden route",
      "hermanus", "cape winelands"], { 4: 0.87, 1: 1.24, 7: 1.38 }),
    g("JNB", "Johannesburg", 73_810, "route", ["johannesburg", "pretoria", "kruger", "kruger national park",
      "sun city", "soweto"], { 2: 0.9, 10: 1.1 }),
  ] },
  KE: { group: "africa", gateways: [
    g("NBO", "Nairobi", 52_000, "route", ["nairobi", "masai mara", "maasai mara", "amboseli", "naivasha",
      "nakuru", "lake nakuru"], { 7: 0.84, 6: 1.34 }, 0.19),
    g("MBA", "Mombasa", 58_000, "derived", ["mombasa", "diani", "diani beach", "malindi", "watamu"]),
  ] },
  US: { group: "north-america", gateways: [
    g("NYC", "New York", 92_950, "route", ["new york", "new york city", "nyc", "manhattan", "brooklyn"],
      { 2: 0.86, 8: 1.19 }),
    g("LAX", "Los Angeles", 98_000, "derived", ["los angeles", "hollywood", "santa monica", "san diego",
      "anaheim", "malibu"], { 11: 0.86, 7: 1.2 }),
    g("SFO", "San Francisco", 97_000, "derived", ["san francisco", "san jose", "napa", "napa valley",
      "yosemite", "silicon valley", "palo alto"], { 10: 0.86, 1: 1.15, 8: 1.25 }),
    g("LAS", "Las Vegas", 100_000, "derived", ["las vegas", "grand canyon"]),
    g("CHI", "Chicago", 95_000, "derived", ["chicago"]),
    g("WAS", "Washington", 94_000, "derived", ["washington", "washington dc", "washington, d.c.",
      "philadelphia"]),
    g("BOS", "Boston", 96_000, "derived", ["boston"]),
    g("MIA", "Miami", 105_000, "derived", ["miami", "florida keys", "key west"]),
    g("ORL", "Orlando", 103_000, "derived", ["orlando", "walt disney world"]),
    g("SEA", "Seattle", 100_000, "derived", ["seattle"]),
    g("HNL", "Honolulu", 120_000, "derived", ["honolulu", "hawaii", "maui", "oahu"]),
  ] },
  CA: { group: "north-america", gateways: [
    g("YTO", "Toronto", 112_170, "route", ["toronto", "niagara falls", "niagara", "ottawa"],
      { 11: 0.86, 8: 1.09 }, 0.09),
    g("YVR", "Vancouver", 118_000, "derived", ["vancouver", "whistler", "victoria"], { 11: 0.84, 7: 1.09, 8: 1.29 }),
    g("YYC", "Calgary", 125_000, "derived", ["banff", "calgary", "jasper", "lake louise", "canmore"]),
    g("YMQ", "Montreal", 115_000, "derived", ["montreal", "montréal", "quebec", "québec", "quebec city"]),
  ] },
  MX: { group: "north-america", gateways: [
    g("MEX", "Mexico City", 151_210, "route", ["mexico city", "ciudad de mexico", "cdmx", "teotihuacan",
      "puebla"], { 2: 0.88, 6: 1.22 }),
    g("CUN", "Cancún", 125_000, "derived", ["cancun", "cancún", "tulum", "playa del carmen", "riviera maya",
      "cozumel", "holbox", "chichen itza", "chichén itzá"]),
    g("OAX", "Oaxaca", 160_000, "derived", ["oaxaca"]),
  ] },
  BR: { group: "south-america", gateways: [
    g("RIO", "Rio de Janeiro", 149_140, "route", ["rio de janeiro", "rio", "buzios", "búzios", "paraty"],
      { 2: 0.65 }),
    g("SAO", "São Paulo", 151_790, "route", ["sao paulo", "são paulo"], { 2: 0.87, 1: 1.27 }, 0.18),
    g("SSA", "Salvador", 160_000, "derived", ["salvador", "bahia"]),
    g("IGU", "Foz do Iguaçu", 165_000, "derived", ["iguazu", "iguaçu", "foz do iguacu", "foz do iguaçu",
      "iguazu falls"]),
  ] },
  PE: { group: "south-america", gateways: [
    g("LIM", "Lima", 132_780, "route", ["lima", "paracas", "huacachina", "nazca"], { 9: 0.74 }),
    g("CUZ", "Cusco", 145_000, "derived", ["cusco", "cuzco", "machu picchu", "sacred valley", "aguas calientes",
      "ollantaytambo"]),
    g("AQP", "Arequipa", 145_000, "derived", ["arequipa", "colca", "colca canyon"]),
  ] },
  AU: { group: "oceania", gateways: [
    g("SYD", "Sydney", 88_350, "route", ["sydney", "blue mountains", "bondi", "hunter valley"],
      { 4: 0.93, 10: 1.07, 1: 1.17 }, 0.2),
    g("MEL", "Melbourne", 84_000, "derived", ["melbourne", "great ocean road", "phillip island", "yarra valley"],
      { 5: 0.84 }),
    g("CNS", "Cairns", 95_000, "derived", ["cairns", "great barrier reef", "port douglas", "daintree"]),
    g("BNE", "Brisbane", 86_000, "derived", ["brisbane", "gold coast", "sunshine coast", "noosa"]),
    g("PER", "Perth", 72_000, "derived", ["perth", "fremantle", "rottnest"]),
  ] },
  NZ: { group: "oceania", gateways: [
    g("AKL", "Auckland", 110_000, "route", ["auckland", "rotorua", "waiheke", "waitomo", "hobbiton", "matamata",
      "bay of islands", "taupo"], { 5: 0.88, 1: 1.16, 7: 1.08 }, 0.15),
    g("ZQN", "Queenstown", 115_000, "derived", ["queenstown", "wanaka", "milford sound", "fiordland", "te anau"]),
    g("CHC", "Christchurch", 113_000, "derived", ["christchurch", "tekapo", "lake tekapo", "mount cook", "aoraki",
      "kaikoura"]),
    g("WLG", "Wellington", 112_000, "derived", ["wellington"]),
  ] },
};

/**
 * How each month compares with the yearly average for travellers leaving
 * India, January first. School holidays (May-June), Diwali (October-November)
 * and the December break push fares up; the monsoon months are quiet for most
 * of Asia, while Europe and North America peak in their own summer. A
 * gateway's own `season` overrides these.
 */
export const GROUP_SEASON: Record<FareGroup | "domestic", number[]> = {
  gulf: [1.05, 0.97, 0.95, 0.97, 1.05, 1.04, 0.86, 0.95, 0.92, 0.95, 1.06, 1.23],
  "west-asia": [0.82, 0.88, 0.95, 1.0, 1.08, 1.15, 1.28, 1.18, 0.95, 0.92, 0.86, 0.98],
  himalaya: [0.85, 0.92, 1.0, 1.05, 1.08, 1.05, 0.88, 0.88, 0.95, 1.3, 1.08, 0.96],
  "indian-ocean": [1.02, 0.95, 0.95, 0.95, 1.02, 1.0, 0.95, 0.98, 0.9, 1.02, 1.05, 1.2],
  "southeast-asia": [1.02, 0.92, 0.9, 0.97, 1.08, 1.12, 0.92, 0.95, 0.88, 0.97, 1.05, 1.22],
  "east-asia": [0.92, 1.05, 1.08, 1.1, 1.02, 0.98, 0.95, 0.93, 0.92, 1.05, 0.98, 1.05],
  europe: [0.98, 0.88, 0.97, 1.1, 1.1, 1.12, 1.03, 1.12, 0.95, 0.92, 0.88, 0.95],
  africa: [1.08, 0.95, 0.95, 0.92, 1.02, 1.15, 1.12, 1.05, 0.92, 0.92, 0.9, 1.02],
  "north-america": [1.04, 0.88, 0.92, 0.95, 1.05, 1.1, 1.08, 1.18, 0.92, 0.9, 0.94, 1.04],
  "south-america": [1.15, 0.85, 0.92, 0.95, 1.0, 1.1, 1.08, 1.05, 0.92, 0.95, 0.98, 1.05],
  oceania: [1.17, 1.0, 0.95, 0.93, 0.9, 0.95, 1.05, 0.95, 0.95, 1.05, 1.0, 1.1],
  domestic: [1.06, 0.94, 0.95, 1.0, 1.1, 1.1, 0.88, 0.9, 0.9, 1.02, 1.03, 1.12],
};

/**
 * How much dearer a fare bought within two weeks of departure is than the
 * yearly average, where the gateway has no researched figure of its own.
 * Medians of KAYAK's "last-minute" figures for the researched routes in each
 * group (Singapore +34%, Rome +35%, Kathmandu +1%, Delhi-Mumbai +0%, ...).
 */
export const GROUP_LAST_MINUTE: Record<FareGroup | "domestic", number> = {
  gulf: 0.15,
  "west-asia": 0.3,
  himalaya: 0.05,
  "indian-ocean": 0.12,
  "southeast-asia": 0.25,
  "east-asia": 0.2,
  europe: 0.25,
  africa: 0.18,
  "north-america": 0.15,
  "south-america": 0.18,
  oceania: 0.17,
  domestic: 0.12,
};

/**
 * Fares from a big Indian airport compared with Delhi's, to the same group of
 * destinations. Mumbai is cheaper to Africa and Southeast Asia, Chennai and
 * Kolkata to Southeast Asia, Kochi to the Maldives; Delhi is cheapest to the
 * Gulf and the Himalaya. Smaller airports are priced through these (see
 * `ORIGIN_OVERRIDES`).
 */
export const HUB_FACTORS: Record<string, Record<FareGroup, number>> = {
  DEL: { gulf: 1, "west-asia": 1, himalaya: 1, "indian-ocean": 1, "southeast-asia": 1, "east-asia": 1,
    europe: 1, africa: 1, "north-america": 1, "south-america": 1, oceania: 1 },
  BOM: { gulf: 1.1, "west-asia": 0.97, himalaya: 1.4, "indian-ocean": 0.92, "southeast-asia": 0.82,
    "east-asia": 1, europe: 0.93, africa: 0.8, "north-america": 0.99, "south-america": 0.97, oceania: 0.96 },
  BLR: { gulf: 1.12, "west-asia": 1.02, himalaya: 1.45, "indian-ocean": 0.8, "southeast-asia": 0.86,
    "east-asia": 1, europe: 0.88, africa: 0.9, "north-america": 1.06, "south-america": 1.05, oceania: 0.98 },
  MAA: { gulf: 1.01, "west-asia": 1.03, himalaya: 1.45, "indian-ocean": 0.8, "southeast-asia": 0.78,
    "east-asia": 0.98, europe: 0.92, africa: 0.92, "north-america": 1.08, "south-america": 1.06, oceania: 0.97 },
  HYD: { gulf: 1.22, "west-asia": 1.03, himalaya: 1.4, "indian-ocean": 0.9, "southeast-asia": 0.84,
    "east-asia": 1.02, europe: 0.92, africa: 0.92, "north-america": 1.06, "south-america": 1.06, oceania: 1.05 },
  CCU: { gulf: 1.15, "west-asia": 1.08, himalaya: 0.85, "indian-ocean": 1.05, "southeast-asia": 0.76,
    "east-asia": 0.97, europe: 1.03, africa: 1.06, "north-america": 1.08, "south-america": 1.08, oceania: 1.05 },
  COK: { gulf: 1, "west-asia": 1.02, himalaya: 1.55, "indian-ocean": 0.72, "southeast-asia": 0.9,
    "east-asia": 1.05, europe: 0.95, africa: 0.9, "north-america": 1.12, "south-america": 1.1, oceania: 1.06 },
};

/**
 * Smaller airports with their own direct international flights, where those
 * flights make them cheaper than going through a hub. Researched: Pune and
 * Ahmedabad to Dubai are cheaper than Mumbai to Dubai; Lucknow, Jaipur,
 * Amritsar and Chandigarh are dearer than Delhi. Any group not listed falls
 * back to the hub-connection model.
 */
export const ORIGIN_OVERRIDES: Record<string, Partial<Record<FareGroup, number>>> = {
  AMD: { gulf: 0.92, europe: 0.98 },
  PNQ: { gulf: 0.9 },
  GOI: { gulf: 1.0 },
  JAI: { gulf: 1.07 },
  LKO: { gulf: 1.14 },
  IXC: { gulf: 1.18 },
  ATQ: { gulf: 1.1, europe: 1.02 },
  TRV: { gulf: 0.97, "indian-ocean": 0.7 },
  CCJ: { gulf: 0.97 },
  IXE: { gulf: 1.0 },
};

/**
 * Share of a domestic return fare added when a smaller airport connects to an
 * international flight at a hub. A through ticket costs much less than two
 * separate returns: Chandigarh, Lucknow and Jaipur to Dubai all come out at
 * Delhi's fare plus about this much of the hop to Delhi.
 */
export const CONNECTION_SHARE = 0.45;

/** A domestic return fare, before airport premiums: a floor plus a per-km rate. */
export const DOMESTIC_BASE_INR = 5_200;
export const DOMESTIC_PER_KM_INR = 6;
/** A through ticket with a change is a little cheaper than its two legs bought apart. */
export const DOMESTIC_CONNECTION_DISCOUNT = 0.87;

/**
 * Researched 12-month average return fares between Indian airports, either
 * direction (KAYAK India, plus single recent quotes for the Leh routes). A
 * pair listed here is used as is; any other pair goes through the distance
 * model. Keys are the two codes in alphabetical order.
 */
export const DOMESTIC_ROUTES: Record<string, number> = {
  "BOM-DEL": 12_000,
  "BLR-DEL": 15_700,
  "COK-DEL": 19_950,
  "CCJ-DEL": 17_480,
  "CJB-DEL": 18_110,
  "DEL-IXE": 15_790,
  "DEL-GOI": 12_400,
  "DEL-MAA": 12_200,
  "DEL-HYD": 11_500,
  "CCU-DEL": 12_500,
  "DEL-IXB": 13_330,
  "DEL-SXR": 12_300,
  "DEL-IXL": 12_300,
  "BOM-GOI": 9_080,
  "BLR-BOM": 9_980,
  "BOM-GAU": 18_710,
  "BOM-IXE": 14_000,
  "BOM-IXZ": 25_780,
  "BOM-CCU": 13_000,
  "BOM-IXL": 17_800,
  "HYD-MAA": 9_400,
  "IXC-SXR": 8_480,
  "IXC-IXL": 10_890,
  "AMD-IXL": 17_500,
  "ATQ-IXL": 20_000,
  "IXL-PNQ": 21_400,
  "CCU-IXL": 23_400,
};

/**
 * Researched fares from a city other than Delhi to one gateway, as a ratio to
 * Delhi's fare to the same gateway. Keyed "ORIGIN-GATEWAY". These win over
 * the group factors above, which are only for pairs nobody has measured.
 */
export const ROUTE_FACTORS: Record<string, number> = {
  "BOM-SIN": 0.8, "BLR-SIN": 0.95, "MAA-SIN": 0.78, "CCU-SIN": 0.85,
  "BOM-BKK": 0.84, "BLR-BKK": 0.77, "HYD-BKK": 0.82, "CCU-BKK": 0.69,
  "BOM-DXB": 1.1, "BLR-DXB": 1.12, "MAA-DXB": 1.01, "HYD-DXB": 1.22, "COK-DXB": 1.0,
  "AMD-DXB": 0.92, "PNQ-DXB": 0.89, "JAI-DXB": 1.07, "LKO-DXB": 1.14, "ATQ-DXB": 1.1, "IXC-DXB": 1.17,
  "BOM-LON": 0.93, "BLR-LON": 0.84, "MAA-LON": 0.92, "HYD-LON": 0.92,
  "BOM-NYC": 0.98, "BOM-SAO": 0.96, "BOM-TBS": 0.98, "BOM-JNB": 0.73, "BOM-CAI": 0.8, "BOM-MRU": 1.1,
  "CCU-TYO": 0.97, "COK-MLE": 0.72,
};

/** Two airports closer than this with no nonstop between them are a drive, not a flight. */
export const DRIVE_INSTEAD_KM = 350;
