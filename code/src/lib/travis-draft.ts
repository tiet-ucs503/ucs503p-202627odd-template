import { saveDraft, saveDraftOrigin, type PartialDraft } from "@/lib/draft-storage";
import type { DestinationSuggestion } from "@/types/travis";

/**
 * From one of Travis's suggestions to a wizard that is already half filled in.
 *
 * Only what the suggestion genuinely knows is carried over: where, when, and
 * the styles it matched. Budget, currency and who is travelling are the
 * traveller's to say — Travis never asked, so the wizard keeps asking.
 */
export function suggestionToDraft(suggestion: DestinationSuggestion): PartialDraft {
  return {
    destination: suggestion.destination,
    startDate: suggestion.startDate,
    endDate: suggestion.endDate,
    // The wizard needs at least one style to generate; if Travis named none,
    // leave the choice to the traveller rather than inventing one.
    ...(suggestion.styles.length > 0 ? { preferences: suggestion.styles } : {}),
  };
}

/** Hand a suggestion to the wizard (via session storage) ready for it to open. */
export function startTripFromSuggestion(suggestion: DestinationSuggestion): void {
  saveDraft(suggestionToDraft(suggestion));
  saveDraftOrigin({
    source: "travis",
    destination: suggestion.destination,
    windowLabel: suggestion.windowLabel,
  });
}
