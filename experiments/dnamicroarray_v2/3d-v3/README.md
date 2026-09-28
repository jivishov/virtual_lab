# DNA/RNA Microarray 3D — version 3

Open `../microarray-3d.html` through a static HTTP server. There is no build step, and a served page makes no external runtime request. WebGL2 is required; camera control also requires HTTPS, localhost or a file page with internet access. Opened directly as a file (`file://`), hand control still works with an internet connection: the browser cannot load the bundled tracker from a file page, so the same MediaPipe 0.10.17 files are loaded over HTTPS from this lab's published copy on virtuallab.az, then from the pinned jsDelivr/Google copies. Video frames never leave the device. Offline, serve the folder instead. This is the only 3D page: on 2026-09-28 it replaced version 2 at `../microarray-3d.html` (the old `microarray-3d-v3.html` address forwards here). The 2D activity (`../index.html`) is unchanged. v3 reuses the bundled `../vendor/mediapipe/` and `../assets/fonts/`.

```powershell
python -m http.server 8766 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8766/microarray-3d.html`.

## What changed from v2

**Spacious layout with guided steps.** There is no sidebar; the bench fills the window and everything else floats over it in small panels that can be dragged by their header, resized from any corner and collapsed. The layout is remembered in this browser, and *Menu → Reset panel layout* restores it.
- **Set-up dialog (step 1).** Two short pages: the group label and card set, then a safety and set-up checklist (gloves and goggles, card and QuickStrip orientation, tapping the QuickStrip). *Start the lab* unlocks when every item is ticked, and the dialog then disappears for the rest of the run.
- **Step card (top left).** It shows the step number and title, a nine-segment progress strip and the next action in large text. *Show me* highlights the target and brings it into view, and a correction line explains the last mistake until the next successful action. Step-specific controls appear only when needed: the drying method, clock and buttons; returning the card; UV goggles, card and lamp; opening the notebook; and the finishing actions. *About this step* holds the manual text. It collapses to a one-line reminder.
- **Next-target beacon.** A soft double ring marks the next target on the bench; it can be turned off in the Menu.
- **Top bar and dock.** Run / Pause / Stop, the save indicator, Controls & model, Notebook (highlighted when it is time to read the card) and a Menu with the drying clock rate, graphics quality, beacon, layout reset and a fresh start. Camera views sit behind the dock's camera button; *Targets* opens the click, keyboard and touch controls.
- **Hand-control panel.** It resizes from all four corners. A live instruction over the video says what to do now: start the camera, calibrate, grab, aim, insert, draw, deliver, eject. A four-step set-up tracker and seven gesture cards replace the paragraph of text, and the gesture expected next is highlighted.
- **Framing follows the layout.** Auto-framing fits the working set into the free area around whichever panels are open, and refits after a panel is moved, resized, collapsed or closed.

**Resume.** The run, notebook, answers and correction log are saved in this browser after every checked action, every few seconds while drying, and when the tab is hidden or closed. On reload, a prompt shows the group label, card set, step and save age, and offers Resume or Start fresh. Runs resume **paused**, and time while the page was closed does not count. `Protocol.restore()` validates the save (version, card layout, every quantity, the tip, the timer, notebook values and the liquid balance) and refuses a tampered or foreign save. It warns if the lab is open in another tab. Camera calibration is never stored. "Start a fresh experiment" deletes the save.

**Auto-framing.** Each step has a working set: preparation frames the plate and card; EB/HB the card, tube rack and tips; samples the plate, card, rack, tips and waste; drying the incubator (seen through its glass door); UV the card close-up. The bench was compacted, so the rack, tips and waste sit behind the plate and card. That makes targets roughly twice v2's on-screen size. Framing fits the set into the free area around the overlays. It moves only between strokes and at step changes, never while a contact or plunger stroke is pending, so mouse and hand targeting stay stable. It tweens over 650 ms and cuts instantly under reduced motion. A manual orbit, zoom or preset suspends it until the next step or until **Auto** is chosen. **Locate target** brings the target into view.

**Live headline.** The scene header shows the step, the next action ("Draw 5 µL control cDNA for A3.") and progress ("2 / 32 samples spotted · A3 · 2/3 mixes"). The bottom hint keeps gesture help; the sidebar keeps the step overview.

**Observation-first notebook.** The notebook docks beside the scene, so the card stays visible while it is read.
1. Record the colour you see on each control spot (columns 1–4: Normal, Up, Down, Blank, as in the manual's p.12 table). *Check controls* validates the run against the expected pattern.
2. Gene cells (columns 5–8) unlock only after the controls are valid. Record colour and meaning (↑ ↓ N –).
3. Check feedback names **patients, not cells**, so a check cannot be used to locate each answer. Nothing on the card or in the notebook shows the true colour; there are no printed letters on the spots.
4. Seven auto-checked **reasoning questions** unlock after the gene check. They cover the two-colour principle, up-regulation, why controls come first, a failed-Blank scenario, reading the data, dark versus green, and limits of use. Each has misconception-based distractors and per-choice feedback; option order is stable but varied.
5. Six **written responses** (the p.9 study questions, paraphrased, plus a claim–evidence–reasoning prompt) for the teacher.

**Debrief.** Samples spotted without a technique correction; corrections by area (tip handling, wrong reagent, row order, mixing, matching, duplicates, volume, preparation, drying, UV) with a one-line reminder each; the most recent corrections; tips used (minimum 34); control and gene checks (first try or number of checks); first-try reasoning accuracy; written responses answered; remaining reagent, evaporation and balance; drying stages; active time per step. It is printable, and included in the JSON export with the full correction log.

**Scene.** Surfaces render in linear HDR with 4× MSAA, filmic tone mapping, bloom limited to emitters, soft PCF shadows, ground occlusion and procedural surface detail (resin bench, paper fibre, foil, brushed steel, polypropylene). Apparatus follows the manual's photographs; see `FIDELITY-REVIEW.md`. Colour comes from real objects, and large surfaces stay low-saturation and mid-tone:
- slate-blue resin bench, cream wall, wood trim and shelf
- coral tube rack
- blue, violet and magenta snap caps
- blue tip-box base
- kraft waste carton
- blue nitrile gloves
- amber UV goggles

Red, green and yellow are reserved for fluorescence. Switching the lamp on dims the room; the paper glows blue and the spots fluoresce with halos in hues matched to the p.12 photograph (Up appears orange-red). **Graphics quality** (High / Balanced / Low) is in the sidebar; Low uses the v2 LDR path for older devices and is selected automatically when float render targets are unavailable.

## Controls

Mouse handling is unchanged from v2: select a tool, aim, hold and move down about 28 px to insert, then release to aspirate; loaded tips deliver when inserted. **Right-drag sideways pans the bench; right-drag up or down tilts the view** about the horizontal axis, as in v2; Shift + right-drag (or middle-drag) orbits fully; the wheel zooms toward the point under the cursor. Working views use an oblique, v2-like angle. The target label sits below the target and hides while the tip is inserted, so it never covers the tip. The accessible **Click / keyboard controls** perform any individual action through the same protocol checks. Hand control (MediaPipe, on-device) was redesigned for comfort and reliability:
- **Thumb plunger (default).** As on a real micropipette, the thumb presses the plunger. Capture *Rest* and *Press* once per hand; a press then counts from 55% of the calibrated travel, since quick real presses are shallower than the held calibration press. Holding the pipette only needs a hand that is not spread open (a loose curl is fine); picking up a tool needs a closed grip. A thumb-to-index *pinch* plunger that needs no calibration remains in *Hand settings*; a pinch saved earlier only because it was the default is reset to the thumb press.
- **Home-centred cursor.** The comfortable hand position (set automatically after a second of steady tracking, or with *Set centre here*) maps to the centre of the bench. *Cursor speed* (1–4×) is a real gain, so small movements cover the whole bench without moving to the edge of the camera view. A single One Euro filter with a *Smoothing* setting replaces the old double smoothing and dead zone.
- **Aim assist (optional).** Hand input gets larger hit areas. When no target is under the cursor, it snaps to the next expected target within about 75 px; the spot the cursor is actually on always wins. It never performs an action by itself.
- **Lock, insert, leave.** The pipette hovers straight above the aim point and follows the hand continuously. Pause for 160 ms (cursor within a few pixels) to lock; the target ring turns gold and the cursor ring snaps onto it and fills with insertion depth. Spots crossed on the way never lock, and a straight drop right after a short pause keeps the paused target even though lowering also moves the cursor down. Lowering the hand inserts. Before insertion, moving onto a neighbouring spot hands the lock over and lifting releases it; neither cancels anything. After insertion, lifting back up leaves. An extended arm sways and trembles, so a lock ends only when an exit lasts 0.3 s or is clearly deliberate: lifting about 2 cm, sliding about 2 cm off an isolated target (3 cm once inserted), or moving at least 7 mm onto a neighbouring spot and staying nearer it. Brief sways and jolts never knock the tip off. Limits are in hand travel (normalized camera units), so they do not shrink when *Cursor speed* is raised. The plunger may be pinched before a lock; the stroke binds to the target that locks. The palm point uses the wrist and index/pinky knuckles only, so pinching never moves it.
- **Tolerant tracking.** A tracking gap longer than 400 ms, an open (thumb mode) or spread (pinch mode) hand held for 150 ms, or, in thumb mode, a thumb pose uncertain for more than 200 ms cancels a pending stroke. A loosely curled hand still holds the pipette; only a closed grip is needed to pick a tool up. Shorter misreads and stale packets count as missed detections and never produce a gesture edge.
- **Deliberate tool handling.** Close the grip (or pinch) over a tool to pick it up. The micropipette is put away by bringing it to its stand and showing an open palm (or spread fingers) there for about half a second; it then hangs back in place. An open hand elsewhere only pauses handling and reminds the learner where the stand is.
- **Real plunger technique.** An empty tip must have the plunger pressed before it enters the liquid. Pressing with the tip already in a tube or well is refused as *bubbles*, shown in the guide and logged as *Plunger technique* in the debrief; keeping the plunger pressed while lifting out makes the stroke valid again. After delivering into a well with the tip still in the liquid, releasing the plunger draws the liquid back up, so mixing is press and release inside the well. The mouse path is unchanged: a mouse press always starts above the target.
- **Guide below the video.** The live instruction no longer covers the video.

During verification a lock-on timing bug was found and fixed: the contact kept the hover-start timestamp, so at typical in-browser inference rates (about 20 fps) it expired the moment it locked. A regression test now covers 50 ms frame spacing.

## Structure

- `protocol.js`: authoritative procedure, quantities, coded rejections, observation/interpretation model, serialize/restore.
- `analysis.js`: correction categories, reasoning and written questions, answer recording, debrief metrics.
- `session.js`: local save/load/clear and other-tab detection.
- `framing.js`: per-step working sets, safe-area fitting and camera tweening.
- `renderer.js`: WebGL2 renderer with HDR, MSAA, bloom, UV lamp lighting and fluorescence; LDR fallback.
- `scene.js`, `liquid.js`: apparatus, printing, liquids and fluorescence presentation.
- `interaction.js`, `hand-core.js`, `camera.js`, `hand-tuning.js`: mouse and hand input (v2, plus a rejection hook).
- `panels.js`: floating panels (drag, four-corner resize, collapse, remembered layout) and the notebook's edge resize.
- `notebook-ui.js`, `app.js`, `style.css`, `../microarray-3d.html`: interface.

## Verification

```powershell
node --test 3d-v3/tests/*.test.cjs
```

37 Node tests cover:
- the 28 v2 tests, with the notebook test rewritten for the observe → validate → interpret flow
- coded rejections and logged action details
- serialize/restore round trips mid-sample, mid-drying and in analysis
- rejection of 12 kinds of tampered save
- session storage, including unavailable storage
- question keys against the manual example for both card sets
- attempt and first-try recording, and debrief metrics
- framing working sets and fitting into the safe area
- auto-framing never moving during a stroke and yielding to manual control

`tests/e2e-in-page.js` runs a complete experiment through the real page controls: the two-page set-up dialog, the Targets panel's selector and action button, the step card's drying, card-move and UV controls, pause/run, the notebook and the questions. Serve the folder, open the page, then in the console:

```js
const {runE2E}=await import('./3d-v3/tests/e2e-in-page.js'); console.table(await runE2E());
```

If the tab is hidden while it runs, the app correctly pauses its drying clock; the script then advances simulated drying time itself and reports that. `tests/camera-inference.cjs` (Playwright, unchanged apart from the page name) was not re-run for v3.
