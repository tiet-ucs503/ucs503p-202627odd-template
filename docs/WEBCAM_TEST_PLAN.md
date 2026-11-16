# Webcam test plan

**Status: partly run on real hardware.** On 2026-11-16 the camera was tested
on one laptop, one webcam, one browser and one person (section 8). Cases 1, 5,
6, 8 and part of 10 passed there. Lighting, other cameras and positions, other
browsers, other devices, a camera in use by another app, and a real permission
prompt have **not** been tested on real hardware. A run in a real browser with
a pretend webcam also passes (section 7). Describe the camera as "checked on
one device", not as fully verified.

The automated tests use a pretend camera and a pretend face model. They prove
the app's own logic. They cannot prove that a real browser prompt, a real
webcam, or real head tracking behaves well. This checklist covers that part,
and a person has to run it.

## What is already covered by automated tests

| Covered | Where |
|---|---|
| Consent screen appears first; nothing starts until a choice is made | `MissionPlayer.test.tsx` (camera consent) |
| Playing without the camera sends empty attention on every answer (T1) | `MissionPlayer.test.tsx` |
| Playing with the camera sends the four-number summary (T2) | `MissionPlayer.test.tsx` |
| Permission denied, no camera, camera busy: one notice, game carries on (T3) | `MissionPlayer.test.tsx` |
| Switching off mid-mission stops the camera and sends empty attention (T4) | `MissionPlayer.test.tsx` |
| No image or video in any request (T5) | `MissionPlayer.test.tsx`, `backend/tests/test_attention.py` |
| The summary arithmetic (present %, on-screen %, blinks, calibration) | `lib/attention/summary.test.ts` |
| Attention never changes mastery, difficulty or points | `backend/tests/test_mastery.py`, `test_attention.py` |
| The test readout is off by default, text only, and changes nothing sent | `AttentionDebug.test.tsx` |

## What needs a real device

Everything in the table in section 3: real permission prompts, real hardware
failures, tracking under different light and camera positions, other
browsers, slower machines, and whether the two limits (head turn 25 degrees,
head tilt 20 degrees, both measured from the student's own resting position)
are sensible.

## 1. Setup

1. Start the backend (`uvicorn main:app --port 8001 --reload` in `backend/`,
   with `DEMO_MODE=true` if you want the demo student) and the frontend
   (`npm run dev` in `frontend/`).
2. Open the app on `http://localhost:5173/?attentionDebug=1` and sign in as a
   student. Cameras only work on `localhost` or over HTTPS, so to test a phone
   or a second laptop, either run the app on that device or serve it over
   HTTPS.
3. Open DevTools (F12) and keep the **Network** tab open, with "Preserve log"
   ticked.
4. Start a mission.

To see the consent screen again, clear the saved choice: DevTools, Application,
Local Storage, delete the key starting `mathverse_camera_choice_`.
To reset a blocked permission: click the padlock or camera icon in the address
bar and set Camera back to "Ask".

## 2. The readout (`?attentionDebug=1`)

A small yellow-on-black box at the top of the mission screen. It prints
numbers only: there is no picture, nothing is sent, and it cannot be clicked.
It is absent unless the address contains `attentionDebug`.

| Line | Meaning |
|---|---|
| camera | `off`, `starting`, `on` or `unavailable` |
| face present | whether a face was found in the latest frame |
| head turn (yaw) | left/right angle in degrees |
| head tilt (pitch) | up/down angle in degrees |
| eyes closed | used only to count blinks |
| baseline | the resting head position, measured over the first 5 seconds; shows a countdown until then |
| facing screen now | yes if turn and tilt are within the limits of the baseline |
| this question so far | the summary that will be sent with the next answer |
| readings per second | how many frames per second are being measured (about 5 is normal) |

Sit normally and look at the screen during the first 5 seconds after the
camera turns on, because that is when the baseline is taken.

## 3. Checklist

Record one row per device and browser combination where it matters.

| # | Case | How | Pass when | Result | Notes |
|---|---|---|---|---|---|
| 1 | Permission granted | Choose "Enable Camera", allow the prompt | Button shows "Camera on"; readout shows `face present: yes`; the next answer request carries four numbers | | |
| 2 | Permission denied | Choose "Enable Camera", block the prompt | One calm notice; mission is playable; readout shows `camera: unavailable`; answers carry `"attention": null` | | |
| 3 | Camera unavailable | Unplug or disable the webcam, then enable | Same as 2 | | |
| 4 | Camera in use elsewhere | Open the camera in another app first | Same as 2, or works normally if the system shares the camera | | |
| 5 | Switched off mid-mission | Click the camera button | The camera light goes out at once; readout shows `camera: off`; later answers carry null | | |
| 6 | Switched back on | Click the camera button again | Measuring resumes; no second consent screen; at most one browser prompt | | |
| 7 | No face | Point the camera away or cover it for a whole question | `face present: no`; face % near 0; the report labels it "Away" and invents nothing | | |
| 8 | Face leaves briefly | Lean out of view for about 5 seconds within one question | Face % drops but is not zero | | |
| 9 | Lighting | Repeat while looking at the screen in bright, dim and backlit conditions | Note the on-screen % for each | | |
| 10 | Position and device | Laptop camera above the screen; external camera off to one side; phone | Note the baseline and on-screen % while looking at the screen | | |
| 11 | Browsers | Chrome, Edge, Firefox, Safari if available | Cases 1, 2 and 5 pass in each | | |
| 12 | Slower device | An older laptop, or DevTools, Performance, CPU 4x slowdown | The game stays responsive; note readings per second | | |

### Threshold measurements (for cases 9 and 10)

After the baseline is set, note the yaw and pitch the readout shows for each
pose. This shows whether 25 and 20 degrees are sensible.

| Pose | Yaw | Pitch | "facing screen now" | Should it count as facing? |
|---|---|---|---|---|
| Looking at the centre of the screen | | | | yes |
| Looking at each corner of the screen | | | | yes |
| Looking down at paper on the desk | | | | your call |
| Looking at the keyboard | | | | your call |
| Turned to talk to someone beside you | | | | no |
| Looking at a phone in your lap | | | | no |

## 4. Privacy and independence checks

Do these once, during case 1.

1. **No images leave the browser.** In the Network tab, look at every request
   made during the mission. The only ones to the backend should be small JSON
   requests. Open an `answer` request (`POST /attempts/<id>/answer`): its body should contain an `attention`
   object with exactly `face_present_pct`, `on_screen_pct`,
   `blink_rate_per_min` and `sample_seconds`. There must be no image, video,
   blob or long encoded text anywhere. (The first camera start also downloads
   the face model and its code from the app's own address; those are
   downloads, not uploads.)
2. **Empty means empty.** Play a few answers with the camera on and a few with
   it off, then check the stored rows:

   ```bash
   python -c "import sqlite3; [print(r) for r in sqlite3.connect('mathverse.db').execute('select id, is_correct, face_present_pct, on_screen_pct, blink_rate_per_min, attention_score, attention_label from attempts order by id desc limit 10')]"
   ```

   Run it from `backend/`. Rows answered with the camera off must show `None`
   in all five attention columns, never 0.
3. **Mastery does not depend on the camera.** With two fresh student accounts,
   play the same villain and give the same right and wrong answers in the same
   order, one with the camera on and one without. Points, level and the mastery
   shown on the report must match.

## 5. Results

| Date | Tester | Device | Camera | Browser and version | Cases run | Failures | Notes |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## 6. After the run

- If every case passes, update "Known limits" in `README.md` and "Known gaps" in
  `CLAUDE.md` to say what was verified, on which devices and browsers.
- If the measurements suggest different limits, changing `YAW_LIMIT_DEG` and
  `PITCH_LIMIT_DEG` in `frontend/src/lib/attention/summary.ts` is a separate,
  small change, made with the recorded numbers as the reason.
- Any failure is a bug to fix before the camera is described as working on
  real hardware.

## 7. Automated run with a pretend webcam

`npm run check:camera` (in `frontend/`, with both servers running) drives the
real app in headless Chrome or Edge. Chrome replaces the webcam with a test
pattern, or with a video file given by `--video clip.mjpeg`. Everything else is
real: the browser's camera call, the face model, the requests, the database
rows. It never opens the actual webcam. It signs in as a throwaway student
(`camera-check@example.com`) in the local development database.

What it covers from section 3: cases 1, 2, 3, 5, 6, 7 and 12, plus all of
section 4. What it cannot cover: a physical camera, lighting, camera position,
a camera in use by another app, other devices, Firefox and Safari.

### Result, 2026-11-16, Chrome (headless), test pattern with no face

32 checks, all passed (30 on the first run; two were added later the same day).

| Scenario | Checked | Result |
|---|---|---|
| Camera on | turns on; face model loads; 10 readings a second; answer carries exactly the four numbers | pass |
| No face in view | face 0%, on screen 0%, blink rate empty | pass (after a fix, below) |
| Switch off, then on | camera stops at once; answers carry no attention; resumes with no second consent screen | pass |
| Permission denied | one notice; mission playable; no attention sent | pass |
| No camera present | same | pass |
| CPU 4x slower | 9.5 readings a second; 172 ms from click to result | pass |
| Privacy | only JSON sent to the backend; largest body 162 bytes; no image data; nothing sent to any other site | pass (after a fix, below) |
| Stored rows | 8 rows: attention filled only where measured, NULL otherwise; mastery recomputed from correctness alone matches | pass |

### Two problems this run found, both fixed

1. **A usage log was going to Google.** The face-tracking library posted about
   140 bytes of usage counters (no image) to `odml.pa.googleapis.com` whenever
   the camera was used. The page now allows data connections only to this app
   and its backend, so the browser refuses it. See `docs/PRIVACY.md`.
2. **"No face" was reported as zero blinks a minute.** With nobody in view the
   blink rate is now empty, because blinks cannot be counted without a face.

3. **The webcam stayed on at the end screen** (found with the real webcam,
   section 8). Fixed, and the script now checks it.

### Not yet done

A run with a video of a real face (`--video`), which would exercise face
found, head angles and calibration with real numbers.

## 8. Real webcam run, 2026-11-16

One device: a laptop with its built-in camera above the screen ("HP HD
Camera"), Chrome 157 on Windows 11, indoor room light, one adult tester. The
app was driven through the Claude in Chrome extension; the tester followed
on-screen prompts while the readout was sampled four times a second.

| # | Case | Result | Notes |
|---|---|---|---|
| 1 | Permission granted | pass | Camera on, face found, baseline set, 10 readings a second. The permission had been granted to `localhost` earlier, so the browser prompt itself was not seen. |
| 5 | Switched off mid-mission | pass | Stream ended at once; the next answer carried no attention. Whether the camera light went out was not observed. |
| 6 | Switched back on | pass | New stream, no second consent screen, numbers sent again. |
| 8 | Face leaves briefly | pass | Face present dropped to about 50% while leaning out, not to zero. |
| 10 | Position and device | partly | Built-in camera above the screen only. |
| 2, 3, 4, 7, 9, 11, 12 | | not run on real hardware | 2, 3, 7 and 12 pass with the pretend webcam (section 7). |

Privacy, on the real device: the stream was video only (no sound); the answer
bodies were JSON of at most 166 bytes; the page contacted only this app, its
backend and the two font hosts; the usage log to Google was not sent. Three
stored rows were checked: attention filled where measured, empty where not,
and mastery matching correctness alone.

### Head angles by pose

Median over about 4.5 seconds of holding each pose. The baseline in use was
yaw -0.2, pitch 10.9, taken during the first 5 seconds of the mission.

| Pose | Yaw | Pitch | Face seen | Counted as facing | Should count? |
|---|---|---|---|---|---|
| Centre of the screen | -2.2 | -0.6 | 100% | 100% | yes |
| Top-left corner | 13.4 | -7.8 | 100% | 94% | yes |
| Top-right corner | -24.1 | -8.3 | 100% | **53%** | yes |
| Bottom-left corner | 16.1 | 5.8 | 100% | 100% | yes |
| Bottom-right corner | -24.3 | 7.2 | 100% | **83%** | yes |
| Keyboard | 4.9 | 21.5 | 83% | **83%** | probably not |
| Desk beside the laptop | -11.6 | 16.8 | 100% | **100%** | probably not |
| Lap, as if at a phone | -4.6 | 22.3 | 78% | **78%** | no |
| Turned to the left | 43.0 | 1.5 | 100% | 0% | no |
| Turned to the right | -41.8 | -4.3 | 100% | 11% | no |
| Leaning out of view | - | - | 50% | 0% | no |

### What the numbers say

1. **Turning away is detected clearly.** A turn of about 42 degrees is far past
   the 25 degree limit.
2. **The turn limit is too tight for the screen's own corners.** Looking at the
   right-hand corners gave about 24 degrees, right at the limit, so those
   moments flicker between on and off screen. A limit of about 30 would clear
   the corners and still leave a wide margin before a real turn.
3. **Looking down is not detected.** Keyboard, desk and lap were all counted as
   facing the screen. Two causes: the baseline was taken while the tester was
   looking at the lower part of the screen (pitch 10.9, against -0.6 for the
   centre), and the gap between the bottom of the screen (about 7) and the
   keyboard (about 22) is only about 15 degrees. The baseline can drift by
   nearly that much depending on where the student looks in the first five
   seconds. Head angle alone cannot reliably tell "bottom of the screen" from
   "keyboard" on a laptop.
4. **So the on-screen figure means "head roughly towards the screen"**, and
   mostly catches turning away or leaving. It should not be read as "eyes on
   the question". This is one person on one device; it is evidence, not a
   calibration.

No limit has been changed. Any change to `YAW_LIMIT_DEG` or `PITCH_LIMIT_DEG`
is for the project owner to decide.

### A problem found on the real webcam, fixed

The webcam stayed on while the "mission failed" or "threat neutralized" screen
was showing, where nothing is measured and there is no camera button. It is now
switched off as soon as the mission ends and comes back on if the student plays
again. Covered by a unit test and by `npm run check:camera`.

### A note on one odd reading

During the run, one answer went out with no attention numbers while the camera
appeared to be on. Several automation commands had been cut off and were still
running in the page at the time, clicking the camera button over each other.
A clean repeat of the same steps behaved correctly. The overlap is the likely
cause, but that was not proven.
