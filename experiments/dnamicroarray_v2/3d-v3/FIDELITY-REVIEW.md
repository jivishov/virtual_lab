# DNA Microarray 3D v3: fidelity review

Reviewed on 2026-09-22 against the supplied **Edvotek #235 manual, version 235.180419**: the background (pp.4–6), procedure (p.8), study questions (p.9), pre-lab preparation and QuickStrip/card photograph (p.11), and the results photograph and table (p.12). The procedure model in v2 already matched p.8 (32 individually checked deposits, row order, one fresh tip per well, three draw/return mixes, the matching spot, and three drying stages of 5 min at 37 °C or 10 min at room temperature). v3 keeps that model and fixes how the results are shown and read, and how the apparatus looks.

## Findings in v2 and what v3 changes

| Manual evidence | v2 | v3 |
|---|---|---|
| p.12 photograph: under long-wave UV the card looks blue and the spots glow with soft halos; blanks are dark grey. | Flat coloured discs in a daylit room. | Turning the lamp on dims the room. Paper fluoresces blue (optical brighteners), spots fluoresce only under the lamp, with halos. Blank and no-expression spots stay dark grey. |
| p.12 photograph: the Up control and red gene spots look orange-red/peach. | Pink-red. | Fluorescence hue matched to the photograph; the legend reads "Red (appears orange-red under UV)". |
| p.12: "the first four columns represent the control samples and should be checked first to ensure that the experiment worked as expected." Table headings: Normal, Up, Down, Blank. | Controls were "interpreted" with the gene options; Blank was read as "no expression". | Controls are recorded as observed colours and **validated** against the expected Normal / Up / Down / Blank pattern. Only genes are interpreted, using the table's ↑ ↓ N – notation. |
| Reading the card is an observation. | A Y/R/G/– letter was printed on every spot and the notebook pre-filled each spot's colour. | No letters and no pre-filled colours. Students record what they see; checks name patients, not cells. |
| p.11 photograph: QuickStrip foil printed with a letter over each well; card printed only with "A Patient 1…" labels, column numbers and circles. | Grey slab labelled "QUICKSTRIP / PATIENT SAMPLES"; card printed with "CONTROLS / GENES" and a divider. | Foil-sealed strip plate with a letter over each well, column numbers and row letters; piercing leaves a hole with a torn edge. The card print shows only row labels, column numbers and circles; the group label is handwritten in a corner. The controls/genes grouping lives in the notebook. |
| p.8, step 12: a handheld long-wave lamp. | Overhead gantry lamp. | Handheld long-wave lamp resting in a stand above a dark viewing mat; UV goggles (amber) sit on the bench until put on. |
| p.8, steps 3/9/11: incubator drying. | Roof removed as a "cutaway". | Benchtop incubator with a glass door and amber display; the card is seen on the shelf through the door. |
| p.11: reagents are 200 µL aliquots in labelled microcentrifuge tubes; p.3: "snap top tubes". | Tinted liquids (EB blue, control cDNA green, samples pink) and a printed label that changed its volume. | Near-clear liquids, so daylight shows no fluorophore colour. Reagents are identified by cap colour (EB blue, cDNA violet, HB magenta) and a fixed handwritten label. Volumes appear only in the tool panel. |
| p.11: "The experiment can be paused after any of the incubation steps and resumed at a later point." | No persistence. | Validated save and resume at any point, resuming paused. |
| p.9 study questions. | Not present. | Paraphrased as written responses, plus seven auto-checked reasoning questions grounded in pp.3, 5–6 and 12. |
| p.7: gloves, goggles; UV goggles for UV. | Checkbox acknowledgements. | Unchanged checks. Gloves box and goggles props are on the bench; the goggles disappear once worn. |

## Reasoning-question key, checked against p.12

The key is checked against RESULTS for both card sets in `tests/v3.test.cjs`:
- Gene 3 (column 7) is green, meaning decreased, in all four patients.
- Gene 1 is decreased in Patients 2–4 and shows no expression in Patient 1.
- Gene 2 is normal in Patients 1, 3 and 4 and up in Patient 2.
- Gene 4 is up in Patients 1, 2 and 4 and shows no expression in Patient 3.

The questions use each card set's own row letters (for example B6 or F6).

## Hand technique (added 2026-09-28)

Checked against standard micropipetting practice and the handling rules in the PLTW/Edvotek #468 ELISA student procedure: mix by "gently pipetting up and down", and replace the tip between components. The microarray manual pages cited above remain the procedure source.

| Real technique | Hand control |
|---|---|
| Press the plunger before the tip enters the liquid, then release slowly inside to draw. | Required. Pressing with an empty tip already in the liquid of a tube or well is refused as *bubbles*, explained in the guide and logged as *Plunger technique* in the debrief. Keeping the plunger pressed while lifting out makes the stroke valid again. |
| Mix by pipetting up and down with the tip kept in the liquid. | After delivering into a well with the tip still in the liquid, releasing the plunger draws the liquid back up, so mixing is press and release inside the well. The protocol still requires three complete cycles (p.8). |
| After dispensing onto a surface, lift the tip away before releasing the plunger. | The guide says so. Releasing on the paper draws nothing. |
| Never lay down or hang up a pipette with liquid in the tip. | Hanging up at the stand is refused while the tip holds liquid. |
| Put the pipette back on its stand. | Bring it to the stand and show an open palm (in pinch mode, spread the fingers) for about half a second. An open hand elsewhere keeps the pipette. |
| The thumb works the plunger. | A calibrated thumb press is the default, and a press counts from 55% of the calibrated travel. A pinch plunger remains an option. |
| Arm sway does not move a seated tip out of a tube. | A lock ends only when an exit lasts 0.3 s or is clearly deliberate: about 2 cm of lift, 2 cm sideways (3 cm once inserted), or at least 7 mm onto a neighbouring spot. |

Approximations that remain in hand technique:
- **One plunger stop.** There is no separate first stop (measure) and second stop (blow-out); one press delivers the full 5 µL. Webcam thumb tracking cannot reliably tell two stops apart.
- **Tip ejection** uses a plunger press over the waste instead of the separate ejector button.
- **Release speed** is not measured, so "release slowly" is guidance only.
- **Immersion depth** is schematic: the tip counts as in the liquid at 85% of the insertion travel, just below the modelled surface.

## Deliberate approximations that remain

- **Scale.** Scene units are arbitrary. The card and plate are enlarged relative to the pipette, tubes and incubator for legibility, as in v2.
- **Tube size.** 1.5 mL is assumed; the manual gives the 200 µL aliquot but not the tube size.
- **Well contents.** The QuickStrip wells show a small, fixed visual layer of prepared sample. The manual does not give its volume, so it is never counted. Only the added 5 µL control aliquots enter the liquid balance.
- **Daylight appearance of dried spots.** Not specified by the manual; they are shown as paper. While wet, a spot is drawn noticeably darker than real wet paper, so treated spots can be seen on screen.
- **Fluorescence.**
  - Hues and intensities are tuned by eye to the single p.12 photograph. They are not calibrated emission spectra, and there is no photobleaching.
  - Room dimming under UV is a presentation choice, not a procedure step.
  - The lamp stand is a convenience for a handheld lamp.
- **Unchanged from v2.** Contact depth, plunger force, fluid dynamics, molecular kinetics and linear evaporation remain schematic.

## Verification evidence

- **Node tests:** `node --test 3d-v3/tests/*.test.cjs` gave 37 tests, all passing, at the 2026-09-22 review. After the 2026-09-28 hand-technique work it gives 63, all passing.
- **Browser run:** `tests/e2e-in-page.js` ran a full experiment in Chromium through the real page controls. It recorded:
  - 589 checked actions and 34 tips
  - 40 µL left in each reagent, 480 µL evaporated, 0 balance error
  - drying in incubator, room-temperature and incubator modes
  - the pause check passing
  - one deliberately inverted-card rejection and one deliberately wrong control colour, both recorded
  - all genes checked and all seven questions answered, with the debrief rendered

  The window was hidden during the run, so the app's drying clock correctly paused and the script advanced simulated time itself.
- **Real mouse strokes:** fitting a tip, drawing EB, depositing on A1 and a wrong-reagent attempt were exercised with the mouse on the new geometry. Resume was checked after reloads at mid-EB, mid-sample and analysis states.
- **Bugs found and fixed during verification:**
  - The full-screen composite depth-tested against the canvas depth buffer, which froze the image after the first frame.
  - A `pow()` of a slightly negative value produced one NaN pixel that bloom spread into a black block.
  - The Low path copied an alpha-less canvas into an RGBA texture.
  - Auto-framing could produce an invalid camera while the canvas was collapsed.
  - Checking one question discarded unchecked choices in the others.
- **Performance:** about 10–14 ms per frame at 769×706 on an Intel Arc integrated GPU. This is CPU-bound by per-mesh work; the app renders on demand and caps animation near 30 fps.

## Not yet validated

- Webcam hand control with real students.
- The Playwright camera inference script for v3.
- Safari and Firefox.
- Low-end Chromebooks.
- Screen-reader walkthroughs of the notebook.
