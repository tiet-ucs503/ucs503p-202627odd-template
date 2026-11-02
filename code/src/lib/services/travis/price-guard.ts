/**
 * Travis has no live prices, so it must not state any.
 *
 * The system prompt says so, but a prompt is a request, not a guarantee, and
 * a plausible-sounding "around ₹40,000 return" is exactly the kind of thing a
 * model volunteers. A traveller would reasonably take it as a quote. This
 * module is the enforcement: it recognises money amounts in text so the
 * pipeline can ask the model to redo its answer, and as a last resort remove
 * the offending sentences itself.
 *
 * Deliberately narrow. It matches a currency marker *next to a number*, so
 * ordinary digits ("7 days", "June 2027", "25–30°C") are left alone.
 */

const CURRENCY_WORDS =
  "INR|USD|EUR|GBP|AUD|CAD|SGD|AED|THB|JPY|Rs\\.?|rupees?|dollars?|euros?|pounds?|bucks|baht|yen";

/** A symbol or code immediately before a number: "$300", "₹ 5,000", "USD 120", "Rs. 900". */
const BEFORE = new RegExp(`(?:[₹$€£¥]\\s?\\d)|(?:\\b(?:${CURRENCY_WORDS})\\s?\\d)`, "i");

/** A number immediately before a currency word: "300 dollars", "5,000 INR", "2 lakh". */
const AFTER = new RegExp(`\\d[\\d,.]*\\s?(?:${CURRENCY_WORDS}|lakhs?|crores?)\\b`, "i");

export function containsPriceClaim(text: string): boolean {
  return BEFORE.test(text) || AFTER.test(text);
}

/** The sentences in `text` that state an amount of money. Empty when there are none. */
export function findPriceClaims(text: string): string[] {
  return splitSentences(text).filter(containsPriceClaim);
}

/** `text` with every sentence that states an amount of money removed. */
export function stripPriceClaims(text: string): string {
  return splitSentences(text)
    .filter((sentence) => !containsPriceClaim(sentence))
    .join(" ")
    .trim();
}

/**
 * Keeps the terminating punctuation with each sentence so the text rejoins cleanly.
 *
 * "Rs. 5,000" has a full stop that is not a sentence end; left alone it would
 * split the amount away from its marker and the claim would go unnoticed.
 */
function splitSentences(text: string): string[] {
  const unabbreviated = text.replace(/\bRs\.(?=\s?\d)/gi, "Rs");
  return unabbreviated.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}
