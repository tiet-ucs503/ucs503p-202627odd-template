import { bestMonthsLabel, isBestMonth, normalise, resolveCountry } from "@/lib/countries";
import { formatDateShort } from "@/lib/utils";
import { MAX_TRIP_DAYS, llmTripEditSchema, type LlmOperation, type LlmTripEdit } from "@/lib/validation/trip-agent";
import type { AgentTrip, TripAgentFocus } from "@/types/trip-agent";

/**
 * What the demo stand-in for the trip agent understands: a handful of plain
 * request shapes, matched by pattern, answered with the same operations a real
 * model would return. It reads nothing and invents nothing: a request it can't
 * match gets an honest "I can only do simple ones in demo mode".
 *
 * Its job is to keep the feature fully usable with no key, and to let the whole
 * pipeline (validation, place lookup, preview, apply, undo) run in tests.
 */

const blank = (): LlmOperation => ({
  type: "remove_activity",
  activityId: null,
  dayId: null,
  toDayId: null,
  cityId: null,
  query: null,
  category: null,
  dayCount: null,
  cities: null,
});

const op = (fields: Partial<LlmOperation> & Pick<LlmOperation, "type">): LlmOperation => ({ ...blank(), ...fields });

const ANSWERS = {
  lost:
    "I'm not sure what you mean by that. In demo mode I can answer a few basic questions about the weather and the destination, and make simple changes: make the trip a number of days, remove an activity, move one to another day, add a place to a day, replace one place with another, or add or remove a city.",
};

const GREETING = /^(?:hi|hii+|hello|hey|hey there|hiya|good (?:morning|afternoon|evening)|yo|namaste)\b[\s!.,]*(?:travis)?[\s!.?]*$/i;
const THANKS = /^(?:thanks|thank you|thx|cheers|great|perfect|awesome|nice|cool|ok(?:ay)?)\b[\s\w!.,]*$/i;
const WEATHER = /\b(?:weather|climate|temperature|forecast|rain(?:y|s)?|monsoon|humid(?:ity)?|hot|cold|warm|pack|wear|umbrella|jacket)\b/i;
const KNOWN_FOR = /\b(?:recommend(?:ation)?s?|famous|known for|local(?:ly)?|speciality|specialities|specialty|specialties|must[- ](?:try|see|do)|what (?:should|can) i (?:eat|try|see|do)|things to do|worth (?:seeing|trying|visiting)|food|eat|culture|customs?|festival)\b/i;
/** A message that starts by asking for a change is a change, even if it mentions the weather. */
const EDIT_VERB = /^(?:please\s+)?(?:add|remove|delete|drop|skip|cancel|move|replace|swap|change|switch|make|set|cut|shorten|lengthen|extend|reduce|increase|include)\b/i;

const reply = (text: string, operations: LlmOperation[] = []): LlmTripEdit => llmTripEditSchema.parse({ reply: text, operations });

const THIS = /^(this|it|that|this activity|this place|this one)$/;

/** Strip a trailing full stop and quotes the traveller may have typed. */
const tidy = (text: string) => text.trim().replace(/^["“'‘]+|["”'’.!?]+$/g, "").trim();

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
/** A number written as a word, but only where it counts days: "a day", "two more days", never "a hotel". */
const NUMBER_WORD = new RegExp(
  String.raw`\b(${Object.keys(NUMBER_WORDS).join("|")})\b(?=\s+(?:more\s+|extra\s+|additional\s+|fewer\s+|less\s+)?days?\b)`,
  "gi",
);

/**
 * How the traveller wants the trip's length to change: by an amount ("two more
 * days", "a day shorter", "cut 3 days") or to a number ("make it 7 days").
 * Null when the message isn't about length at all.
 */
function lengthChange(text: string): { relative: boolean; days: number } | null {
  const shorterOrLonger = text.match(/\b(\d+)\s+days?\s+(shorter|longer)\b/i);
  if (shorterOrLonger) return { relative: true, days: Number(shorterOrLonger[1]) * (/longer/i.test(shorterOrLonger[2]) ? 1 : -1) };

  const fewer = text.match(/\b(\d+)\s+(?:fewer|less)\s+days?\b/i);
  if (fewer) return { relative: true, days: -Number(fewer[1]) };

  const by = text.match(/\b(add|extend|lengthen|increase|remove|cut|drop|reduce|shorten)\b(?: it)?(?: by)?\s+(\d+)\s+(?:more\s+|extra\s+)?days?\b/i);
  if (by) return { relative: true, days: Number(by[2]) * (/^(add|extend|lengthen|increase)$/i.test(by[1]) ? 1 : -1) };

  const more = text.match(/\b(\d+)\s+(?:more|extra|additional)\s+days?\b/i);
  if (more) return { relative: true, days: Number(more[1]) };

  const to =
    text.match(/\b(?:make it|change (?:it )?to|reduce (?:it )?to|shorten (?:it )?to|extend (?:it )?to|increase (?:it )?to|set (?:it )?to|to)\s+(?:a\s+)?(\d+)[- ]days?\b/i) ??
    text.match(/\b(\d+)[- ]day trip\b/i);
  if (to) return { relative: false, days: Number(to[1]) };

  return null;
}

export function demoTripEdit(trip: AgentTrip, message: string, focus?: TripAgentFocus): LlmTripEdit {
  const text = tidy(message);
  const cities = [...trip.cities].sort((a, b) => a.order - b.order);
  const daysIn = (cityId: string) => trip.days.filter((d) => d.cityId === cityId).length;
  const allActivities = trip.days.flatMap((d) => d.activities.map((a) => ({ activity: a, day: d })));

  const findCity = (phrase: string) => {
    const wanted = normalise(phrase);
    return cities.find((c) => normalise(c.name) === wanted) ?? null;
  };

  const findActivity = (phrase: string) => {
    const wanted = normalise(phrase);
    if (THIS.test(wanted) && focus?.activityId) return allActivities.find((x) => x.activity.id === focus.activityId) ?? null;
    if (wanted.length < 3) return null;
    return (
      allActivities.find((x) => normalise(x.activity.name) === wanted) ??
      allActivities.find((x) => normalise(x.activity.name).includes(wanted)) ??
      allActivities.find((x) => wanted.includes(normalise(x.activity.name))) ??
      null
    );
  };

  const dayNumbered = (n: number) => trip.days.find((d) => d.dayNumber === n) ?? null;

  // ---- talk -----------------------------------------------------------
  // Questions and pleasantries. Nothing here changes the trip.
  const country = resolveCountry(trip.destination);
  const route = cities.map((c) => c.name).join(", ");

  if (GREETING.test(text)) {
    return reply(
      `Hi! I'm Travis. I can tell you about your trip to ${trip.destination} (the weather, what it's known for) and change the plan when you ask: make it longer or shorter, or swap a city, a place or a hotel. What would you like to do?`,
    );
  }
  if (THANKS.test(text) && !EDIT_VERB.test(text)) {
    return reply("Happy to help! If you want to change anything about the trip, or hear more about the place, just ask.");
  }

  if (!EDIT_VERB.test(text) && WEATHER.test(text)) {
    const dates = `${formatDateShort(trip.startDate)} to ${formatDateShort(trip.endDate)}`;
    if (!country) {
      return reply(
        `I can't see a live forecast, and in demo mode I don't have the usual weather for ${trip.destination}. The live assistant can tell you what to expect for ${dates}.`,
      );
    }
    const startMonth = Number(trip.startDate.slice(5, 7));
    const endMonth = Number(trip.endDate.slice(5, 7));
    const inside = isBestMonth(country, startMonth) || isBestMonth(country, endMonth);
    return reply(
      `I can't see a live forecast, so this is the usual picture, not a promise. ${country.name} is generally at its best from ${bestMonthsLabel(country)}. Your trip runs ${dates}, which ${
        inside ? "falls in that window, so you can expect the typical settled weather" : "falls outside that window, so expect it to be wetter, hotter or cooler than the best months"
      }. In demo mode that's as detailed as I get; the live assistant can talk about each city.`,
    );
  }

  if (!EDIT_VERB.test(text) && KNOWN_FOR.test(text)) {
    return reply(
      `${country ? `${country.name}: ${country.tagline} ` : ""}Your trip covers ${route}. In demo mode I can't go into local food or specific places; the live assistant can suggest dishes and sights, and I can add anything you like to a day.`,
    );
  }

  // ---- length ---------------------------------------------------------
  // "a day", "two more days" and "2 days" are the same thing to a traveller.
  const counted = text.replace(NUMBER_WORD, (word) => String(NUMBER_WORDS[word.toLowerCase()]));
  const change = lengthChange(counted);
  if (change !== null) {
    const target = change.relative ? trip.dayCount + change.days : change.days;
    if (target < 1 || target > MAX_TRIP_DAYS) return reply(`A trip can be 1 to ${MAX_TRIP_DAYS} days long, so I can't make it ${target}.`);
    if (target === trip.dayCount) return reply(`The trip is already ${target} days.`);
    return reply(`I'll make the trip ${target} days long, keeping the same cities.`, [op({ type: "set_trip_length", dayCount: target })]);
  }

  // ---- cities ---------------------------------------------------------
  const addCity =
    text.match(/^(?:please\s+)?(?:add|include)\s+(?:the city of\s+|city\s+)?(.+?)\s+(?:as a (?:new )?city|to the trip|as another city)$/i) ??
    text.match(/^(?:please\s+)?add\s+(?:a\s+)?(?:new\s+)?city\s+(?:called\s+|named\s+)?(.+)$/i);
  if (addCity) {
    const name = tidy(addCity[1]);
    if (findCity(name)) return reply(`${name} is already in the trip.`);
    const donor = [...cities].sort((a, b) => daysIn(b.id) - daysIn(a.id))[0];
    if (!donor || daysIn(donor.id) < 4) return reply(`There isn't enough room in a ${trip.dayCount}-day trip to add another city. Try making the trip longer first.`);
    const list = cities.map((c) => ({ name: c.name, days: daysIn(c.id) - (c.id === donor.id ? 2 : 0) }));
    list.push({ name, days: 2 });
    return reply(`I'll add ${name} for 2 days, taking them from ${donor.name}.`, [op({ type: "set_cities", cities: list })]);
  }

  const dropWord = text.match(/^(?:please\s+)?(?:remove|delete|drop|skip)\s+(?:the city of\s+|city\s+)?(.+?)(?:\s+(?:city|from the trip))?$/i);
  if (dropWord) {
    const city = findCity(dropWord[1]);
    if (city) {
      if (cities.length === 1) return reply(`${city.name} is the only city, so I can't remove it.`);
      const remaining = cities.filter((c) => c.id !== city.id);
      const list = remaining.map((c, i) => ({ name: c.name, days: daysIn(c.id) + (i === 0 ? daysIn(city.id) : 0) }));
      return reply(`I'll remove ${city.name} and give its days to ${remaining[0].name}.`, [op({ type: "set_cities", cities: list })]);
    }
  }

  // ---- hotel ----------------------------------------------------------
  const hotel = text.match(/^(?:please\s+)?(?:change|switch)\s+(?:the\s+)?hotel(?:\s+in\s+(.+?))?\s+to\s+(.+)$/i);
  if (hotel) {
    const city = (hotel[1] ? findCity(hotel[1]) : null) ?? (focus?.cityId ? cities.find((c) => c.id === focus.cityId) ?? null : null) ?? (cities.length === 1 ? cities[0] : null);
    if (!city) return reply("Which city's hotel should I change?");
    return reply(`I'll look for a hotel like "${tidy(hotel[2])}" in ${city.name}.`, [op({ type: "change_hotel", cityId: city.id, query: tidy(hotel[2]) })]);
  }

  // ---- activities -----------------------------------------------------
  const move = text.match(/^(?:please\s+)?move\s+(?:the\s+)?(.+?)\s+to\s+day\s*(\d+)$/i);
  if (move) {
    const found = findActivity(move[1]);
    const day = dayNumbered(Number(move[2]));
    if (!found) return reply(`I couldn't find "${tidy(move[1])}" in this trip.`);
    if (!day) return reply(`There is no Day ${move[2]} in this trip.`);
    return reply(`I'll move ${found.activity.name} to Day ${day.dayNumber}.`, [op({ type: "move_activity", activityId: found.activity.id, toDayId: day.id })]);
  }

  const replace = text.match(/^(?:please\s+)?replace\s+(?:the\s+)?(.+?)\s+with\s+(?:a\s+|an\s+|the\s+)?(.+)$/i);
  if (replace) {
    const found = findActivity(replace[1]);
    if (!found) return reply(`I couldn't find "${tidy(replace[1])}" in this trip.`);
    return reply(`I'll replace ${found.activity.name} with something matching "${tidy(replace[2])}".`, [
      op({ type: "replace_activity", activityId: found.activity.id, query: tidy(replace[2]) }),
    ]);
  }

  const add = text.match(/^(?:please\s+)?add\s+(?:a\s+|an\s+|the\s+)?(.+?)\s+(?:to|on)\s+day\s*(\d+)$/i);
  if (add) {
    const day = dayNumbered(Number(add[2]));
    if (!day) return reply(`There is no Day ${add[2]} in this trip.`);
    return reply(`I'll add "${tidy(add[1])}" to Day ${day.dayNumber}.`, [op({ type: "add_activity", dayId: day.id, query: tidy(add[1]) })]);
  }
  const addHere = text.match(/^(?:please\s+)?add\s+(?:a\s+|an\s+|the\s+)?(.+)$/i);
  if (addHere && focus?.dayId && trip.days.some((d) => d.id === focus.dayId)) {
    const day = trip.days.find((d) => d.id === focus.dayId)!;
    return reply(`I'll add "${tidy(addHere[1])}" to Day ${day.dayNumber}.`, [op({ type: "add_activity", dayId: day.id, query: tidy(addHere[1]) })]);
  }

  const remove = text.match(/^(?:please\s+)?(?:remove|delete|drop|skip|cancel)\s+(?:the\s+)?(.+?)(?:\s+(?:from|on)\s+day\s*\d+)?$/i);
  if (remove) {
    const found = findActivity(remove[1]);
    if (!found) return reply(`I couldn't find "${tidy(remove[1])}" in this trip.`);
    return reply(`I'll remove ${found.activity.name} from Day ${found.day.dayNumber}.`, [op({ type: "remove_activity", activityId: found.activity.id })]);
  }

  return reply(ANSWERS.lost);
}
