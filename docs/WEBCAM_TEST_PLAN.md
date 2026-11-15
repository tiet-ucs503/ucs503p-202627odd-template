# Webcam test plan

**Status: not yet run on real hardware.** Until the results table below is
filled in, the camera feature must be described as tested with a simulated
camera only.

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
