// A stand-in for the backend, installed over window.fetch. It records every
// request the app makes, so tests can check exactly what was sent.
import { vi } from 'vitest';

export interface RecordedRequest {
  url: string;
  method: string;
  /** Exactly what was passed to fetch as the body. */
  rawBody: unknown;
  /** The body parsed as JSON, when it is a JSON string. */
  json: Record<string, unknown> | null;
}

export const QUESTIONS_TO_WIN = 3; // short missions keep the tests quick

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function installFakeServer(extraRoutes: Record<string, () => unknown> = {}) {
  const requests: RecordedRequest[] = [];
  let correct = 0;
  let attemptId = 100;

  const question = () => {
    attemptId += 1;
    return { attempt_id: attemptId, text: `Puzzle ${attemptId}`, options: ['1', '2', '3', '4'], topic: 'linear_equations', difficulty: 'medium' };
  };
  const session = () => ({
    id: 1, boss_id: 'goblin', status: correct >= QUESTIONS_TO_WIN ? 'victory' : 'active',
    correct_count: correct, wrong_count: 0, streak: correct,
    questions_to_win: QUESTIONS_TO_WIN, max_wrong: 7, points_awarded: correct * 70,
  });
  const progress = () => ({
    points: correct * 70, level: correct >= QUESTIONS_TO_WIN ? 2 : 1,
    unlocked_bosses: ['goblin'], missions_won: 0, link_code: 'SPIDER-TEST01',
  });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = new URL(url).pathname;
    const method = init?.method ?? 'GET';
    const rawBody = init?.body;
    const json = typeof rawBody === 'string' ? JSON.parse(rawBody) : null;
    requests.push({ url, method, rawBody, json });

    if (extraRoutes[path]) return jsonResponse(200, extraRoutes[path]());
    if (path === '/sessions') {
      correct = 0;
      return jsonResponse(201, { session: session(), question: question() });
    }
    if (/^\/attempts\/\d+\/answer$/.test(path)) {
      correct += 1; // every answer in these tests is treated as correct
      const state = session();
      return jsonResponse(200, {
        correct: true, correct_index: json?.selected_index ?? 0, points_awarded: 70,
        bonus_points: 0, mastery: 0.99, mastery_display_pct: 95, session_status: state.status, session: state,
        progress: progress(), next_question: state.status === 'active' ? question() : null,
      });
    }
    if (/^\/attempts\/\d+\/hint$/.test(path)) return jsonResponse(200, { hint: 'Try one step at a time.' });
    return jsonResponse(404, { detail: `No fake route for ${path}` });
  });

  vi.stubGlobal('fetch', fetchMock);
  return {
    requests,
    /** The JSON bodies of every answer the app submitted, in order. */
    answers: () => requests.filter((r) => r.url.endsWith('/answer')).map((r) => r.json!),
  };
}
