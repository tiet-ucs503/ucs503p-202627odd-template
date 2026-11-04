import { postAuthenticated } from "@/lib/api-client";
import { MAX_HISTORY_MESSAGES } from "@/lib/validation/travis";
import type { TravisChatMessage, TravisMessageInput, TravisResponse } from "@/types/travis";

/**
 * The browser side of talking to Travis.
 *
 * The conversation lives in the browser, and each request carries it, so the
 * server keeps nothing between messages. What gets sent is deliberately
 * smaller than what is shown: just the words, and for Travis's own turns the
 * names of the places it suggested — not the cards, which Travis would only
 * have to re-read.
 */

/** The wire form of a conversation: plain text, most recent turns only. */
export function toRequestMessages(messages: TravisChatMessage[]): TravisMessageInput[] {
  return messages.slice(-MAX_HISTORY_MESSAGES).map((message) => {
    if (message.role === "assistant" && message.suggestions && message.suggestions.length > 0) {
      return {
        role: message.role,
        content: message.content,
        suggested: message.suggestions.map((s) => s.destination),
      };
    }
    return { role: message.role, content: message.content };
  });
}

export function askTravis(messages: TravisChatMessage[]): Promise<TravisResponse> {
  return postAuthenticated<TravisResponse>("/api/travis/chat", { messages: toRequestMessages(messages) });
}
