/**
 * Routes a Kisan message: keep marketplace/app chat on the legacy Gemini path;
 * send agronomy/scheme/weather to grounded RAG; escalate high-stakes chemical/medical asks.
 */

export type AssistantRoute = 'legacy' | 'grounded' | 'escalate';

export type EscalationReason =
  | 'pesticide_dose'
  | 'medical_adjacent'
  | 'low_confidence';

const ESCALATE_PATTERNS: { reason: EscalationReason; pattern: RegExp }[] = [
  {
    reason: 'pesticide_dose',
    pattern:
      /\b(ml\/?l|ml per|per litre|per liter|ppm|dose|dosage|spray schedule|how much (to )?spray|mix .*spray|pesticide dose|fungicide dose|insecticide dose|herbicide dose|concentrate|dilut(?:e|ion))\b/i,
  },
  {
    reason: 'pesticide_dose',
    pattern:
      /\b(chlorpyrifos|cypermethrin|imidacloprid|glyphosate|mancozeb|carbendazim|monocrotophos|acephate)\b/i,
  },
  {
    reason: 'medical_adjacent',
    pattern:
      /\b(poison(?:ed|ing)?|ate the spray|drank|swallow|skin burn|eye (?:pain|burn)|hospital|antidote|first aid after spray|nausea after pesticide)\b/i,
  },
];

const ADVISORY_PATTERNS: RegExp[] = [
  /\b(wheat|rice|paddy|tomato|onion|potato|mustard|maize|cotton|crop|soil|irrigat|sow(?:ing)?|transplant|harvest|blight|rust|aphid|bollworm|fungus|disease|pest|weather|frost|rain|heat|humidity|msp|pm-?kisan|pmfby|fasal bima|insurance|scheme|fertilizer|urea|compost|seed rate)\b/i,
  /\b(गेहूं|धान|टमाटर|प्याज|आलू|सरसों|मक्का|कपास|फसल|सिंचाई|बीमारी|कीट|मौसम|पाला|वर्षा|बीमा|योजना)\b/i,
  /\b(ਕਣਕ|ਝੋਨਾ|ਟਮਾਟਰ|ਪਿਆਜ਼|ਆਲੂ|ਸਰੋਂ|ਮੱਕੀ|ਫਸਲ|ਸਿੰਚਾਈ|ਬਿਮਾਰੀ|ਕੀੜੇ|ਮੌਸਮ|ਪਾਲਾ|ਬੀਮਾ|ਯੋਜਨਾ)\b/i,
];

const LEGACY_PATTERNS: RegExp[] = [
  /\b(list(?:ing)?|order|payment|escrow|razorpay|cod|chat|call|profile|login|register|marketplace|mandi price|upload photo|dashboard|notification|agronomist)\b/i,
  /\b(how (do|to) (i )?(use|open|sell|buy|pay)|place an order|create (a )?listing)\b/i,
];

export function classifyAssistantRoute(message: string): {
  route: AssistantRoute;
  reason?: EscalationReason;
} {
  const text = message.trim();
  if (!text) return { route: 'legacy' };

  for (const rule of ESCALATE_PATTERNS) {
    if (rule.pattern.test(text)) {
      return { route: 'escalate', reason: rule.reason };
    }
  }

  const advisory = ADVISORY_PATTERNS.some((pattern) => pattern.test(text));
  const legacy = LEGACY_PATTERNS.some((pattern) => pattern.test(text));

  if (advisory) return { route: 'grounded' };
  if (legacy) return { route: 'legacy' };

  // Out-of-pack / research-y agronomy: try retrieval so empty pack → refuse (not invent).
  if (
    /\b(quinoa|cassava|crispr|aquaponics|allele|photoperiod|saponin|hydroponics|gmo|transgenic)\b/i.test(
      text,
    )
  ) {
    return { route: 'grounded' };
  }

  return { route: 'legacy' };
}
