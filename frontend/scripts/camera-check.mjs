// Runs the camera path end to end in a real browser with a PRETEND webcam.
//
// Chrome can replace the webcam with a test pattern or a video file. That lets
// this script exercise the real thing: the browser's camera call, the real
// face model, the real requests and the real database rows. It never opens
// your actual webcam.
//
// It does NOT prove that a physical webcam works. See docs/WEBCAM_TEST_PLAN.md.
//
// Before running: start the backend on :8001 and the frontend on :5173.
//   node scripts/camera-check.mjs                     (test pattern: there is no face in it)
//   node scripts/camera-check.mjs --video face.mjpeg  (a clip of a face; .mjpeg or .y4m)
//   node scripts/camera-check.mjs --browser msedge
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const APP = 'http://localhost:5173';
const API = 'http://localhost:8001';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..', '..', 'backend');

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const VIDEO = flag('--video') ? path.resolve(flag('--video')) : null;
const BROWSER = flag('--browser') ?? 'chrome';
if (VIDEO && !existsSync(VIDEO)) throw new Error(`No such video file: ${VIDEO}`);

// A throwaway student in the local development database, used only by this script.
const ACCOUNT = { name: 'Camera Check', email: 'camera-check@example.com', password: 'camera-check-local-only', role: 'student' };

const results = [];
const record = (scenario, check, pass, detail = '') => {
  results.push({ scenario, check, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${scenario}] ${check}${detail ? `  (${detail})` : ''}`);
};
const note = (scenario, text) => console.log(`note  [${scenario}] ${text}`);

async function signIn() {
  const post = (url, body) => fetch(`${API}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let res = await post('/auth/login', { email: ACCOUNT.email, password: ACCOUNT.password });
  if (!res.ok) res = await post('/auth/register', ACCOUNT);
  if (!res.ok) throw new Error(`Could not sign in the test student: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

/** camera: 'fake' (pretend webcam), 'denied' (permission refused), 'none' (no camera at all) */
async function openMission(token, { camera, video = null, slow = false }) {
  const launchArgs = ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'];
  if (camera === 'fake') {
    launchArgs.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream');
    if (video) launchArgs.push(`--use-file-for-fake-video-capture=${video}`);
  }
  if (camera === 'denied') launchArgs.push('--use-fake-device-for-media-stream'); // a camera exists, permission is refused
  if (camera === 'none') launchArgs.push('--use-fake-device-for-media-stream=device-count=0', '--use-fake-ui-for-media-stream');

  const browser = await chromium.launch({ channel: BROWSER, headless: true, args: launchArgs });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript((t) => localStorage.setItem('mathverse_token', t), token);
  const page = await context.newPage();

  const requests = [];
  page.on('request', (req) => {
    const body = req.postDataBuffer();
    const entry = { url: req.url(), method: req.method(), type: req.headers()['content-type'] ?? '', bytes: body ? body.length : 0, text: req.postData(), refused: false };
    requests.push(entry);
    req.response().then((res) => { if (!res) entry.refused = true; }).catch(() => { entry.refused = true; });
  });
  const refusals = [];
  page.on('console', (msg) => { if (/Content Security Policy/.test(msg.text())) refusals.push(msg.text().slice(0, 160)); });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  if (slow) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  await page.goto(`${APP}/?attentionDebug=1`);
  await page.getByRole('button', { name: 'Hero Portal' }).click();
  await page.getByRole('button', { name: /Engage Target/ }).click();
  await page.getByRole('dialog').waitFor();

  const readout = () => page.locator('[data-attention-debug]').innerText();
  const waitReadout = (pattern, timeout = 30000) =>
    page.waitForFunction((src) => new RegExp(src).test(document.querySelector('[data-attention-debug]')?.innerText ?? ''), pattern.source, { timeout });
  const answers = () => requests.filter((r) => r.method === 'POST' && /\/attempts\/\d+\/answer$/.test(r.url)).map((r) => ({ ...JSON.parse(r.text), attemptId: Number(r.url.match(/attempts\/(\d+)/)[1]) }));
  const answer = async () => {
    const before = answers().length;
    const started = Date.now();
    const done = page.waitForResponse((r) => /\/attempts\/\d+\/answer$/.test(r.url()));
    await page.getByRole('button', { name: /^A\s/ }).click();
    await done;
    const ms = Date.now() - started;
    // Wait for the next question (or the end screen) before going on.
    await page.waitForFunction(() => {
      const option = [...document.querySelectorAll('button')].find((b) => /^A\s/.test(b.innerText));
      return !option || !option.disabled;
    }, null, { timeout: 15000 });
    return { sent: answers()[before], ms };
  };
  return { browser, page, requests, refusals, pageErrors, readout, waitReadout, answers, answer };
}

const KEYS = ['blink_rate_per_min', 'face_present_pct', 'on_screen_pct', 'sample_seconds'];
const number = (text, label) => Number((text.match(new RegExp(`${label}: (-?[\\d.]+)`)) ?? [])[1]);

async function granted(token) {
  const name = VIDEO ? 'camera on (video of a face)' : 'camera on (test pattern, no face)';
  const m = await openMission(token, { camera: 'fake', video: VIDEO });
  try {
    await m.page.getByRole('button', { name: 'Enable Camera' }).click();
    await m.waitReadout(/camera: on/);
    record(name, 'camera turns on after choosing Enable Camera', true);
    await m.waitReadout(/face present: (yes|no)/);
    record(name, 'the real face model loads and reads frames', true);
    await m.page.waitForTimeout(6000); // past the 5 s calibration
    const text = await m.readout();
    console.log(text.split('\n').map((l) => `      | ${l}`).join('\n'));
    const rate = number(text, 'readings per second');
    record(name, 'readings arrive steadily', rate >= 2, `${rate} per second`);

    const { sent } = await m.answer();
    const a = sent.attention;
    record(name, 'the answer carries exactly the four numbers', !!a && JSON.stringify(Object.keys(a).sort()) === JSON.stringify(KEYS), a ? JSON.stringify(a) : 'attention was null');
    if (a && VIDEO) {
      record(name, 'a face in the video is counted as present', a.face_present_pct >= 50, `face ${a.face_present_pct}%`);
      note(name, `on screen ${a.on_screen_pct}% for this clip; yaw/pitch are in the readout above`);
    }
    if (a && !VIDEO) {
      record(name, 'no face: present and on-screen are 0, nothing is invented', a.face_present_pct === 0 && a.on_screen_pct === 0 && a.blink_rate_per_min === null, `face ${a.face_present_pct}%, on screen ${a.on_screen_pct}%, blinks ${a.blink_rate_per_min}`);
    }

    // Switch off, answer, switch back on, answer.
    await m.page.getByRole('button', { name: /Camera on/ }).click();
    await m.waitReadout(/camera: off/);
    await m.page.waitForTimeout(1500); // the face library sends its usage log when it shuts down
    const live = await m.page.evaluate(() => [...document.querySelectorAll('video')].some((v) => v.srcObject && v.srcObject.getTracks().some((t) => t.readyState === 'live')));
    record(name, 'switching off stops the camera at once', !live);
    const off = await m.answer();
    record(name, 'answers after switching off carry no attention', off.sent.attention === null);
    await m.page.getByRole('button', { name: /Camera off/ }).click();
    await m.waitReadout(/camera: on/);
    record(name, 'switching back on resumes with no second consent screen', (await m.page.getByRole('dialog').count()) === 0);
    await m.page.waitForTimeout(1500);
    const on = await m.answer();
    record(name, 'answers after switching back on carry numbers again', on.sent.attention !== null);
    record(name, 'no errors on the page', m.pageErrors.length === 0, m.pageErrors.join(' | '));
    return m;
  } finally {
    await m.browser.close();
  }
}

async function unusable(token, camera, name) {
  const m = await openMission(token, { camera });
  try {
    await m.page.getByRole('button', { name: 'Enable Camera' }).click();
    await m.waitReadout(/camera: unavailable/);
    record(name, 'the camera is reported unavailable', true);
    const notices = await m.page.getByText(/Camera unavailable, carrying on without it/).count();
    record(name, 'one calm notice is shown', notices === 1, `${notices} shown`);
    const first = await m.answer();
    const second = await m.answer();
    record(name, 'the mission is still playable', true);
    record(name, 'answers carry no attention', first.sent.attention === null && second.sent.attention === null);
    record(name, 'no errors on the page', m.pageErrors.length === 0, m.pageErrors.join(' | '));
    return m;
  } finally {
    await m.browser.close();
  }
}

async function slowDevice(token) {
  const name = 'slow device (CPU 4x slower)';
  const m = await openMission(token, { camera: 'fake', video: VIDEO, slow: true });
  try {
    await m.page.getByRole('button', { name: 'Enable Camera' }).click();
    await m.waitReadout(/face present: (yes|no)/, 90000);
    await m.page.waitForTimeout(4000);
    const rate = number(await m.readout(), 'readings per second');
    record(name, 'readings still arrive', rate >= 1, `${rate} per second`);
    const { ms } = await m.answer();
    record(name, 'answering stays responsive', ms < 3000, `${ms} ms from click to result`);
    return m;
  } finally {
    await m.browser.close();
  }
}

function privacy(missions) {
  const name = 'privacy';
  const all = missions.flatMap((m) => m.requests);
  const toBackend = all.filter((r) => r.url.startsWith(API));
  const uploads = toBackend.filter((r) => r.bytes > 0);
  const notJson = uploads.filter((r) => !r.type.includes('application/json'));
  const biggest = Math.max(0, ...uploads.map((r) => r.bytes));
  record(name, 'everything sent to the backend is JSON text', notJson.length === 0, `${uploads.length} requests with a body`);
  record(name, 'nothing sent is big enough to be a picture', biggest < 1024, `largest body ${biggest} bytes`);
  const looksLikeImage = uploads.filter((r) => /data:image|base64|video\/|image\//i.test(r.text ?? ''));
  record(name, 'no image or video data in any request body', looksLikeImage.length === 0);
  const elsewhere = all.filter((r) => !r.url.startsWith(API) && !r.url.startsWith(APP) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  const sentElsewhere = elsewhere.filter((r) => r.bytes > 0 && !r.refused);
  const hosts = (list) => [...new Set(list.map((r) => new URL(r.url).host))].join(', ') || 'none';
  record(name, 'nothing is sent to any other site', sentElsewhere.length === 0, sentElsewhere.length ? `sent to: ${hosts(sentElsewhere)}` : `downloads only from: ${hosts(elsewhere.filter((r) => !r.refused))}`);
  const refused = missions.flatMap((m) => m.refusals);
  note(name, refused.length ? `the browser refused ${refused.length} connection(s): ${refused[0]}` : 'the browser refused no connections');
}

function database(missions) {
  const name = 'stored rows';
  const sent = missions.flatMap((m) => m.answers()).map((a) => ({ id: a.attemptId, measured: a.attention !== null }));
  const python = path.join(BACKEND, 'venv', 'Scripts', 'python.exe');
  const out = execFileSync(existsSync(python) ? python : 'python', [path.join(BACKEND, 'tools', 'verify_attempts.py'), JSON.stringify(sent)], { cwd: BACKEND, encoding: 'utf8' });
  for (const line of JSON.parse(out)) record(name, line.check, line.pass, line.detail);
}

const token = await signIn();
console.log(`Browser: ${BROWSER}. Pretend camera: ${VIDEO ? `video file ${path.basename(VIDEO)}` : 'built-in test pattern (no face)'}.\n`);
const missions = [];
for (const run of [
  () => granted(token),
  () => unusable(token, 'denied', 'permission denied'),
  () => unusable(token, 'none', 'no camera present'),
  () => slowDevice(token),
]) {
  try {
    missions.push(await run());
  } catch (error) {
    record('script', 'scenario ran to the end', false, String(error).split('\n')[0]);
  }
}
privacy(missions);
try {
  database(missions);
} catch (error) {
  record('stored rows', 'rows could be checked', false, String(error).split('\n')[0]);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed.`);
console.log('This used a pretend camera. It does not show that a physical webcam works.');
process.exit(failed.length ? 1 : 0);
