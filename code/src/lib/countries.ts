/**
 * The countries TripEase plans trips to.
 *
 * Forty-five of them, chosen for how many travellers go there and, because
 * most of this project's travellers start in India, for how easy they are to
 * reach from there. This list is the single source of truth: the destination
 * picker, the Travis assistant, the planner's fallback and the photographs all
 * read it, so a country is either fully supported everywhere or not at all.
 *
 * Everything here is deliberately the kind of fact a guidebook states and does
 * not change from year to year. There are no prices, no visa rules and no
 * opening hours, because those go stale and this file is not checked against
 * anything live. `bestMonths` is the broad window with the most settled
 * weather; a large or varied country has several good seasons and this names
 * only the most reliable one.
 */

export type Region =
  | "South Asia"
  | "Southeast Asia"
  | "East Asia"
  | "Middle East"
  | "Europe"
  | "Africa"
  | "Americas"
  | "Oceania";

export interface CountryCity {
  /** A real city or well-known base, in the form a map search would find it. */
  name: string;
  /** Relative weight when splitting a trip's days across cities. */
  share: number;
}

export interface Country {
  /** ISO 3166-1 alpha-2. */
  code: string;
  /** The name stored on a trip and shown everywhere. */
  name: string;
  region: Region;
  /** Other things a traveller might type: short forms, cities, regions. */
  aliases: string[];
  tagline: string;
  /** 1 to 12. `from` is later than `to` when the window crosses New Year. */
  bestMonths: { from: number; to: number };
  cities: CountryCity[];
}

const c = (
  code: string,
  name: string,
  region: Region,
  aliases: string[],
  tagline: string,
  bestMonths: [number, number],
  cities: [string, number][],
): Country => ({
  code,
  name,
  region,
  aliases,
  tagline,
  bestMonths: { from: bestMonths[0], to: bestMonths[1] },
  cities: cities.map(([cityName, share]) => ({ name: cityName, share })),
});

/**
 * In the order a traveller is most likely to want them: this is what the
 * picker shows before anything is typed.
 */
export const COUNTRIES: Country[] = [
  c("TH", "Thailand", "Southeast Asia", ["bangkok", "phuket", "chiang mai", "krabi", "pattaya", "koh samui", "phi phi", "thai"],
    "Island beaches, street food and temples within one easy trip.", [11, 2],
    [["Bangkok", 0.4], ["Phuket", 0.35], ["Chiang Mai", 0.25]]),
  c("AE", "United Arab Emirates", "Middle East", ["uae", "dubai", "abu dhabi", "emirates", "sharjah"],
    "Record-setting skylines beside quiet desert and calm beaches.", [11, 3],
    [["Dubai", 0.65], ["Abu Dhabi", 0.35]]),
  c("SG", "Singapore", "Southeast Asia", ["singapura"],
    "A garden city of hawker food, harbour views and spotless streets.", [2, 4],
    [["Singapore", 1]]),
  c("ID", "Indonesia", "Southeast Asia", ["bali", "ubud", "jakarta", "java", "lombok", "komodo", "yogyakarta", "seminyak"],
    "Rice terraces, volcano sunrises and island temples.", [4, 10],
    [["Ubud", 0.4], ["Seminyak", 0.3], ["Uluwatu", 0.3]]),
  c("MV", "Maldives", "South Asia", ["maldive", "atoll"],
    "Turquoise lagoons and overwater villas on coral atolls.", [11, 4],
    [["Malé", 0.35], ["Maafushi", 0.65]]),
  c("MY", "Malaysia", "Southeast Asia", ["kuala lumpur", "kl", "penang", "langkawi", "george town", "borneo", "malacca"],
    "Twin towers, hill-station tea and some of Asia's best street food.", [12, 4],
    [["Kuala Lumpur", 0.45], ["Penang", 0.3], ["Langkawi", 0.25]]),
  c("VN", "Vietnam", "Southeast Asia", ["hanoi", "ho chi minh", "saigon", "hoi an", "ha long", "da nang", "sapa"],
    "Limestone bays, lantern-lit old towns and a coastline built for road trips.", [2, 4],
    [["Hanoi", 0.35], ["Hoi An", 0.3], ["Ho Chi Minh City", 0.35]]),
  c("LK", "Sri Lanka", "South Asia", ["colombo", "kandy", "galle", "sigiriya", "ceylon"],
    "Tea hills, ancient rock fortresses and surf-lined southern beaches.", [12, 3],
    [["Colombo", 0.2], ["Kandy", 0.3], ["Ella", 0.25], ["Galle", 0.25]]),
  c("JP", "Japan", "East Asia", ["tokyo", "kyoto", "osaka", "hokkaido", "nara", "hiroshima", "fuji", "nippon"],
    "Kyoto's temples, Tokyo's neon and Mount Fuji, joined by bullet trains.", [3, 5],
    [["Tokyo", 0.4], ["Kyoto", 0.35], ["Osaka", 0.25]]),
  c("IN", "India", "South Asia", ["goa", "kerala", "rajasthan", "delhi", "mumbai", "himachal", "ladakh", "agra", "jaipur", "udaipur", "varanasi", "bharat"],
    "Palaces, backwaters, Himalayan passes and beaches, all in one country.", [10, 3],
    [["Delhi", 0.3], ["Jaipur", 0.3], ["Agra", 0.2], ["Udaipur", 0.2]]),
  c("NP", "Nepal", "South Asia", ["kathmandu", "pokhara", "everest", "annapurna", "himalaya"],
    "The Himalayas up close, from lakeside Pokhara to the Annapurna trails.", [10, 11],
    [["Kathmandu", 0.4], ["Pokhara", 0.6]]),
  c("BT", "Bhutan", "South Asia", ["thimphu", "paro", "punakha", "tiger's nest", "tigers nest"],
    "Cliffside monasteries and fortress-monasteries in the eastern Himalaya.", [3, 5],
    [["Thimphu", 0.35], ["Paro", 0.4], ["Punakha", 0.25]]),
  c("KR", "South Korea", "East Asia", ["korea", "seoul", "busan", "jeju", "k-pop"],
    "Palaces beside skyscrapers, night markets and a volcanic island to escape to.", [4, 6],
    [["Seoul", 0.55], ["Busan", 0.3], ["Jeju", 0.15]]),
  c("KH", "Cambodia", "Southeast Asia", ["siem reap", "angkor", "phnom penh", "angkor wat"],
    "Angkor Wat at sunrise and the temples that surround it.", [11, 3],
    [["Siem Reap", 0.6], ["Phnom Penh", 0.4]]),
  c("PH", "Philippines", "Southeast Asia", ["manila", "cebu", "palawan", "el nido", "boracay", "coron", "bohol"],
    "Limestone lagoons and white-sand islands across more than seven thousand of them.", [12, 4],
    [["El Nido", 0.4], ["Cebu", 0.3], ["Manila", 0.3]]),
  c("TR", "Turkey", "Middle East", ["turkiye", "türkiye", "istanbul", "cappadocia", "antalya", "pamukkale", "goreme"],
    "Where two continents meet: Istanbul's mosques, Cappadocia's balloons, Aegean coast.", [4, 6],
    [["Istanbul", 0.45], ["Göreme", 0.3], ["Antalya", 0.25]]),
  c("OM", "Oman", "Middle East", ["muscat", "nizwa", "salalah", "wahiba"],
    "Desert dunes, mountain forts and quiet coast, without the crowds.", [10, 3],
    [["Muscat", 0.55], ["Nizwa", 0.45]]),
  c("JO", "Jordan", "Middle East", ["amman", "petra", "wadi rum", "dead sea", "aqaba"],
    "Petra's rose-red facades and the red desert of Wadi Rum.", [3, 5],
    [["Amman", 0.25], ["Petra", 0.45], ["Wadi Rum", 0.3]]),
  c("GE", "Georgia", "Middle East", ["tbilisi", "batumi", "kazbegi", "svaneti", "caucasus"],
    "Mountain villages, cave towns and a wine tradition thousands of years old.", [5, 6],
    [["Tbilisi", 0.5], ["Kazbegi", 0.25], ["Batumi", 0.25]]),
  c("FR", "France", "Europe", ["paris", "provence", "lyon", "riviera", "normandy", "bordeaux", "mont saint-michel"],
    "Paris, the Riviera and lavender fields, with food at every stop.", [4, 6],
    [["Paris", 0.5], ["Nice", 0.3], ["Lyon", 0.2]]),
  c("IT", "Italy", "Europe", ["rome", "venice", "florence", "milan", "naples", "amalfi", "tuscany", "cinque terre", "sicily", "roma"],
    "Rome, Venice and Florence, then the coast and the Dolomites beyond.", [4, 6],
    [["Rome", 0.35], ["Florence", 0.3], ["Venice", 0.35]]),
  c("ES", "Spain", "Europe", ["barcelona", "madrid", "seville", "granada", "mallorca", "ibiza", "andalusia", "valencia"],
    "Gaudí, flamenco and Moorish palaces in sunshine from coast to coast.", [4, 6],
    [["Barcelona", 0.35], ["Madrid", 0.3], ["Seville", 0.35]]),
  c("CH", "Switzerland", "Europe", ["zurich", "lucerne", "interlaken", "zermatt", "matterhorn", "geneva", "swiss", "alps"],
    "Lakes, glaciers and the Matterhorn, all reached by punctual trains.", [6, 9],
    [["Lucerne", 0.3], ["Interlaken", 0.35], ["Zermatt", 0.2], ["Zurich", 0.15]]),
  c("GB", "United Kingdom", "Europe", ["uk", "britain", "great britain", "england", "scotland", "wales", "london", "edinburgh"],
    "London's landmarks, Scottish glens and the villages in between.", [5, 9],
    [["London", 0.5], ["Edinburgh", 0.3], ["Bath", 0.2]]),
  c("GR", "Greece", "Europe", ["athens", "santorini", "mykonos", "crete", "meteora", "greek"],
    "Whitewashed islands, ancient ruins and long, easy sea-view dinners.", [5, 6],
    [["Athens", 0.35], ["Santorini", 0.35], ["Mykonos", 0.3]]),
  c("DE", "Germany", "Europe", ["berlin", "munich", "cologne", "bavaria", "hamburg", "neuschwanstein", "rhine"],
    "Fairytale castles, Bavarian Alps and cities with serious history.", [5, 9],
    [["Berlin", 0.35], ["Munich", 0.35], ["Cologne", 0.3]]),
  c("NL", "Netherlands", "Europe", ["holland", "dutch", "amsterdam", "rotterdam", "tulips", "the hague"],
    "Canals, bicycles and fields of tulips in spring.", [4, 5],
    [["Amsterdam", 0.55], ["Rotterdam", 0.25], ["The Hague", 0.2]]),
  c("PT", "Portugal", "Europe", ["lisbon", "lisboa", "algarve", "madeira", "azores", "sintra"],
    "Tiled streets, tram rides and golden cliffs on the Atlantic.", [5, 6],
    [["Lisbon", 0.4], ["Porto", 0.35], ["Lagos", 0.25]]),
  c("AT", "Austria", "Europe", ["vienna", "salzburg", "innsbruck", "hallstatt", "tyrol"],
    "Imperial Vienna, Mozart's Salzburg and alpine lakes.", [6, 9],
    [["Vienna", 0.4], ["Salzburg", 0.35], ["Innsbruck", 0.25]]),
  c("HR", "Croatia", "Europe", ["dubrovnik", "zagreb", "hvar", "plitvice", "adriatic"],
    "Walled Dubrovnik, island-hopping and waterfall-lined lakes.", [5, 6],
    [["Dubrovnik", 0.35], ["Split", 0.4], ["Zagreb", 0.25]]),
  c("CZ", "Czechia", "Europe", ["czech republic", "czech", "prague", "praha", "cesky krumlov"],
    "Prague's spires and bridges, and fairytale towns a short train away.", [4, 5],
    [["Prague", 0.65], ["Český Krumlov", 0.35]]),
  c("IS", "Iceland", "Europe", ["reykjavik", "ring road", "northern lights", "aurora", "golden circle"],
    "Waterfalls, glaciers and, in winter, the northern lights.", [6, 8],
    [["Reykjavik", 0.5], ["Vik", 0.25], ["Akureyri", 0.25]]),
  c("NO", "Norway", "Europe", ["oslo", "bergen", "tromso", "lofoten", "fjords", "geirangerfjord"],
    "Deep fjords, midnight sun and, up north, the aurora.", [6, 8],
    [["Oslo", 0.3], ["Bergen", 0.4], ["Tromsø", 0.3]]),
  c("MU", "Mauritius", "Africa", ["port louis", "grand baie", "flic en flac", "le morne"],
    "Lagoons, waterfalls and a mountain rising straight from the sea.", [9, 11],
    [["Grand Baie", 0.5], ["Flic en Flac", 0.5]]),
  c("EG", "Egypt", "Africa", ["cairo", "luxor", "aswan", "giza", "pyramids", "nile", "hurghada", "sharm el sheikh"],
    "The Pyramids, Luxor's temples and a Nile cruise between them.", [10, 4],
    [["Cairo", 0.4], ["Luxor", 0.35], ["Aswan", 0.25]]),
  c("MA", "Morocco", "Africa", ["marrakech", "marrakesh", "fes", "fez", "chefchaouen", "sahara", "merzouga", "casablanca"],
    "Marrakech's souks, blue Chefchaouen and the dunes of the Sahara.", [3, 5],
    [["Marrakech", 0.45], ["Fes", 0.3], ["Chefchaouen", 0.25]]),
  c("ZA", "South Africa", "Africa", ["cape town", "johannesburg", "kruger", "safari", "garden route"],
    "Cape Town beneath Table Mountain, and safari in Kruger.", [5, 9],
    [["Cape Town", 0.5], ["Johannesburg", 0.2], ["Kruger National Park", 0.3]]),
  c("KE", "Kenya", "Africa", ["nairobi", "masai mara", "maasai mara", "amboseli", "mombasa", "diani"],
    "The Masai Mara's wildlife, including the great migration in season.", [7, 10],
    [["Nairobi", 0.25], ["Masai Mara", 0.5], ["Diani Beach", 0.25]]),
  c("US", "United States", "Americas", ["usa", "america", "united states of america", "new york", "los angeles", "san francisco", "las vegas", "grand canyon", "yosemite", "hawaii", "florida"],
    "New York, the national parks and the open road in between.", [4, 6],
    [["New York City", 0.4], ["Los Angeles", 0.3], ["San Francisco", 0.3]]),
  c("CA", "Canada", "Americas", ["toronto", "vancouver", "banff", "niagara", "montreal", "rockies", "lake louise"],
    "Rocky Mountain lakes, big-city Toronto and Vancouver, and Niagara.", [6, 9],
    [["Toronto", 0.3], ["Banff", 0.4], ["Vancouver", 0.3]]),
  c("MX", "Mexico", "Americas", ["cancun", "cancún", "tulum", "mexico city", "oaxaca", "chichen itza", "playa del carmen", "yucatan"],
    "Mayan ruins, Caribbean coast and a capital that never runs out of food.", [11, 4],
    [["Mexico City", 0.4], ["Oaxaca", 0.25], ["Cancún", 0.35]]),
  c("BR", "Brazil", "Americas", ["rio", "rio de janeiro", "sao paulo", "são paulo", "salvador", "iguazu", "amazon", "copacabana"],
    "Rio's beaches and Christ the Redeemer, plus Iguazu's waterfalls.", [9, 11],
    [["Rio de Janeiro", 0.55], ["São Paulo", 0.25], ["Salvador", 0.2]]),
  c("PE", "Peru", "Americas", ["lima", "cusco", "cuzco", "machu picchu", "sacred valley", "arequipa", "inca"],
    "Machu Picchu and the Sacred Valley in the high Andes.", [5, 9],
    [["Lima", 0.25], ["Cusco", 0.5], ["Arequipa", 0.25]]),
  c("AU", "Australia", "Oceania", ["sydney", "melbourne", "cairns", "uluru", "great barrier reef", "queensland", "perth", "aussie"],
    "The Opera House, the Great Barrier Reef and the red heart of Uluru.", [9, 11],
    [["Sydney", 0.4], ["Melbourne", 0.35], ["Cairns", 0.25]]),
  c("NZ", "New Zealand", "Oceania", ["auckland", "queenstown", "rotorua", "milford sound", "wellington", "kiwi"],
    "Fiords, glaciers and lakes in compact, drivable distances.", [12, 2],
    [["Auckland", 0.3], ["Queenstown", 0.4], ["Rotorua", 0.3]]),
];

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export function countryByCode(code: string): Country | null {
  return BY_CODE.get(code.toUpperCase()) ?? null;
}

/** Lower case, no accents, single spaces: so "Türkiye" and "turkiye" are one word. */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Indexed {
  country: Country;
  name: string;
  aliases: string[];
}

const INDEX: Indexed[] = COUNTRIES.map((country) => ({
  country,
  name: normalise(country.name),
  aliases: country.aliases.map(normalise),
}));

/**
 * The countries that match what has been typed, best first. With nothing typed
 * it returns the first few of the list in its own order, so the picker is
 * never empty. A name matches before an alias, and a match at the start of
 * the name or of one of its words matches before one in the middle.
 */
export function searchCountries(query: string, limit = 8): Country[] {
  const q = normalise(query);
  if (!q) return COUNTRIES.slice(0, limit);

  const scored: { country: Country; score: number; order: number }[] = [];
  INDEX.forEach(({ country, name, aliases }, order) => {
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 90;
    else if (name.split(" ").some((word) => word.startsWith(q))) score = 80;
    else if (aliases.includes(q)) score = 70;
    else if (aliases.some((alias) => alias.startsWith(q))) score = 60;
    else if (aliases.some((alias) => alias.split(" ").some((word) => word.startsWith(q)))) score = 50;
    else if (q.length >= 3 && (name.includes(q) || aliases.some((alias) => alias.includes(q)))) score = 30;
    if (score > 0) scored.push({ country, score, order });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((hit) => hit.country);
}

const escapeForRegExp = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where `term` last appears in `text` as whole words, or -1. */
function lastWholeWord(text: string, term: string): number {
  const pattern = new RegExp(`(?:^| )(${escapeForRegExp(term)})(?= |$)`, "g");
  let at = -1;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    at = match.index + match[0].length - match[1].length;
  }
  return at;
}

/**
 * Which supported country a piece of text is about, or null.
 *
 * This exists for text that did not come from the picker: a trip saved before
 * the list existed ("Bali, Indonesia"), or something the AI wrote. An exact
 * country name wins. Otherwise a country's name or one of its aliases has to
 * appear as whole words ("goa" in "Goa, India" is a match, "goa" in "Mogoa" is
 * not), and when several countries are named the last one wins, because in
 * "Georgia, USA" or "Goa, India" the country comes last.
 */
export function resolveCountry(text: string): Country | null {
  const t = normalise(text);
  if (!t) return null;

  const exact = INDEX.find((entry) => entry.name === t);
  if (exact) return exact.country;

  let best: { country: Country; at: number; length: number } | null = null;
  for (const { country, name, aliases } of INDEX) {
    for (const term of [name, ...aliases]) {
      const at = lastWholeWord(t, term);
      if (at < 0) continue;
      if (!best || at > best.at || (at === best.at && term.length > best.length)) {
        best = { country, at, length: term.length };
      }
    }
  }
  return best ? best.country : null;
}

/** True only for the exact name of a supported country. */
export function isSupportedCountry(name: string): boolean {
  return COUNTRIES.some((country) => country.name === name);
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov–Feb". */
export function bestMonthsLabel(country: Country): string {
  const { from, to } = country.bestMonths;
  return from === to ? MONTH_NAMES[from - 1] : `${MONTH_NAMES[from - 1]}–${MONTH_NAMES[to - 1]}`;
}

/** Whether a 1-based month falls inside the country's best window. */
export function isBestMonth(country: Country, month: number): boolean {
  const { from, to } = country.bestMonths;
  return from <= to ? month >= from && month <= to : month >= from || month <= to;
}

export const MONTH_FULL_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Countries whose best weather includes `month`, in the list's own order, with
 * enough others added to reach `minimum` when a month has few (August has
 * fewer good-weather countries than November does). Those added ones are
 * marked `inSeason: false` so a caller can be straight about it.
 */
export function countriesForMonth(
  month: number,
  { limit = 8, minimum = 4 }: { limit?: number; minimum?: number } = {},
): { country: Country; inSeason: boolean }[] {
  const inSeason = COUNTRIES.filter((country) => isBestMonth(country, month)).map((country) => ({
    country,
    inSeason: true,
  }));
  const picked = inSeason.slice(0, limit);
  // Never pad past what was asked for.
  const wanted = Math.min(minimum, limit);
  if (picked.length >= wanted) return picked;

  const rest = COUNTRIES.filter((country) => !isBestMonth(country, month)).map((country) => ({
    country,
    inSeason: false,
  }));
  return [...picked, ...rest.slice(0, wanted - picked.length)];
}
