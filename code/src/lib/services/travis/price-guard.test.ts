import { describe, expect, it } from "vitest";
import { containsPriceClaim, findPriceClaims, stripPriceClaims } from "@/lib/services/travis/price-guard";

describe("containsPriceClaim", () => {
  it.each([
    "Flights are around ₹40,000 return.",
    "Expect to pay $300 a night.",
    "Rooms start from €85.",
    "It costs £1,200 for a week.",
    "Budget about 5,000 INR a day.",
    "Roughly USD 120 per person.",
    "Rs. 900 for a meal.",
    "Rs.900 covers it.",
    "That's about 300 dollars.",
    "Around 2 lakh for the trip.",
    "A room is 4,500 rupees.",
    "About 12000 THB.",
  ])("recognises an amount of money: %s", (text) => {
    expect(containsPriceClaim(text)).toBe(true);
  });

  it.each([
    "Go in June for fewer crowds.",
    "A week is plenty, maybe 7 to 9 days.",
    "Temperatures sit around 25–30°C.",
    "The festival runs through June 2027.",
    "It's lower cost than peak season.",
    "Book about 3 months ahead.",
    "Budget-friendly, especially outside school holidays.",
    "Expect 4.5 hours by train.",
    "Dollar General is not a destination.",
  ])("leaves ordinary numbers and words alone: %s", (text) => {
    expect(containsPriceClaim(text)).toBe(false);
  });
});

describe("findPriceClaims", () => {
  it("returns only the sentences that state an amount", () => {
    const text = "Bali is lovely in June. Flights are about $400. The weather is dry.";
    expect(findPriceClaims(text)).toEqual(["Flights are about $400."]);
  });

  it("is empty when nothing states an amount", () => {
    expect(findPriceClaims("Go in the shoulder season. It is quieter then.")).toEqual([]);
  });

  it("does not split an amount from its marker at an abbreviation's full stop", () => {
    expect(findPriceClaims("Meals are Rs. 500 each. Lovely food.")).toEqual(["Meals are Rs 500 each."]);
  });
});

describe("stripPriceClaims", () => {
  it("removes the offending sentence and keeps the rest readable", () => {
    const text = "Bali is lovely in June. Flights are about $400. The weather is dry.";
    expect(stripPriceClaims(text)).toBe("Bali is lovely in June. The weather is dry.");
  });

  it("leaves clean text untouched", () => {
    const text = "Go in June. It is quieter then.";
    expect(stripPriceClaims(text)).toBe(text);
  });

  it("returns an empty string when every sentence states an amount", () => {
    expect(stripPriceClaims("Rooms are $90. Meals are $10.")).toBe("");
  });
});
