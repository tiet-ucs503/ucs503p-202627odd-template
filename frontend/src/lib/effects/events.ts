// Turns what the server said into named gameplay events.
//
// Effects are only ever triggered by these events, and every event comes from
// a server response. Nothing here looks at the clock, the mouse, or the camera.

import type { AnswerResponse } from '@/lib/api';

export type GameEventType =
  | 'mission_start'      // the server created the mission: villain entrance
  | 'player_strike'      // the server judged the answer correct: Spider-Man lands a hit
  | 'villain_attack'     // the server judged a chosen answer wrong: villain counter-attacks
  | 'time_out'           // no answer was given in time: villain taunt
  | 'combo_special'      // a correct answer that takes the streak to 3, 5 or 7: Spider-Man's special, in place of a plain strike
  | 'villain_special'    // the second wrong answer in a row: the villain's signature move, in place of a plain attack
  | 'villain_staggered'  // half the hits needed have landed: villain weakened (once per mission)
  | 'hint'               // the hint arrived from the server
  | 'victory'
  | 'villain_defeated'   // with victory: the villain's own way of going down
  | 'defeat';

export interface GameEvent {
  type: GameEventType;
  /** Current correct streak, where it matters. */
  streak?: number;
  /** True for events that belong to the end screen, shown after the answer's result. */
  afterResult?: boolean;
}

export const COMBO_MILESTONES = [3, 5, 7];

/** What needs remembering between answers within one mission. */
export interface EventState {
  wrongInARow: number;
  staggered: boolean;
}

export const initialEventState = (): EventState => ({ wrongInARow: 0, staggered: false });

/**
 * The events caused by one judged answer.
 * `timedOut` is true when the answer was sent empty because time ran out.
 */
export function deriveEvents(
  state: EventState,
  response: Pick<AnswerResponse, 'correct' | 'session' | 'session_status'>,
  timedOut: boolean,
): { events: GameEvent[]; state: EventState } {
  const events: GameEvent[] = [];
  const next: EventState = { ...state };
  const { session } = response;

  if (response.correct) {
    next.wrongInARow = 0;
    // One move per answer: at a streak milestone the special replaces the plain strike.
    const special = COMBO_MILESTONES.includes(session.streak);
    events.push({ type: special ? 'combo_special' : 'player_strike', streak: session.streak });
    const halfway = session.correct_count * 2 >= session.questions_to_win;
    if (halfway && !state.staggered && response.session_status === 'active') {
      next.staggered = true;
      events.push({ type: 'villain_staggered' });
    }
  } else {
    next.wrongInARow = state.wrongInARow + 1;
    if (timedOut) {
      events.push({ type: 'time_out' });
    } else {
      // One move per answer: the second wrong answer in a row brings the signature move instead.
      events.push({ type: next.wrongInARow === 2 ? 'villain_special' : 'villain_attack' });
    }
  }

  if (response.session_status === 'victory') {
    events.push({ type: 'victory', afterResult: true }, { type: 'villain_defeated', afterResult: true });
  }
  if (response.session_status === 'defeat') events.push({ type: 'defeat', afterResult: true });

  return { events, state: next };
}
