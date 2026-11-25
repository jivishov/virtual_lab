# B06 hand controls

The reference activity is **Hand building** in `virtual_lab/temp/chemistry-3d-collection/dist/practice/b06`.

- Studio adapts B06's hand tracking, navigation filtering, three-finger grasp and release. The bench uses the observed palm center for grasping and the observed index fingertip for pointing. Both share the current exposure's scale, placement and mirror setting with the hand outline.
- The lab reserves the target under the open palm as the fingers start closing. Crossing to another tool during the grasp dwell cancels pickup. In Follow step, the stand and vessels stay within reach.
- A missing exposure stops motion and liquid flow immediately. A single empty image can retain a pipette grip if the same wrist, hand size and handedness return within 300 ms. A seated guided stroke continues only when the same closed palm returns within 8 px of its held position. Missing time adds no liquid. Repeated absence or ambiguous tracking interrupts the stroke. Confirmed loss requires a fresh open palm, grasp and dip.
- A late inference during a seated guided stroke pauses the liquid. Two matching closed-palm exposures captured after the pause confirm the held position. The first must return within 1.5 seconds. A changed hand, an empty frame or a longer stall freezes the tool for regrasping.
- `src/palm-outline.js` uses B06's `hand-trace.js` contour algorithm. Setup, acquisition and two-hand navigation use the full camera image. During a pipette carry, the detector follows a square around the established palm. A missed detection brings the full frame back into view. Landmarks map back to the original exposure before gesture recognition or drawing. The contour, cursor and optional live background share the same placement and mirror setting. Immersive Hands keeps the lab interior visible by default and reports targeting, grip and pipette volume at the edge of the bench.
- Guided stroke uses the closed B06 grasp. When the rim turns gold, dip the closed hand slightly and hold. The tip seats inside the vessel and the bulb draws or dispenses the prescribed volume. Lift to withdraw. Manual squeeze accepts thumb-to-index fingertip or thumb-to-index knuckle pressure while three fingers stay curled. The cuvette responds to wrist rotation. Tracking loss stops flow and preserves the partial volume. A fresh open palm re-arms hand input.

## Verification

Run these checks from the studio directory.

```sh
node --test tests/hand-adapter.test.mjs tests/studio-camera.test.mjs tests/camera-lifecycle.test.mjs
```

The anatomical landmark fixtures exercise pickup, release, hand identity when detections change order, brief occlusion, reacquisition, pipetting, blanking and wrist pouring. The browser checks exercise the real bench with the same raw packet path. The learner's grip survives the appearance of a second hand and opening the working palm leaves the tool in place.

For camera replay, start the local studio and supply Playwright with its Chromium browser and a Y4M video containing a visible hand.

```sh
node tests/browser-b06-camera.cjs path/to/hand.y4m
```

To exercise the guided bulb with image-based inference, supply the MediaPipe open-hand and fist test photographs. The camera replay uses palm movements to draw 10 mL for the first standard, then 8 mL for the 8/2 tube. It measures the short dip at each opening and checks that a small wobble keeps the tip seated. During the first draw it hides the hand, regrips and finishes the remaining volume with a fresh dip. It checks the visible 8.0 mL readout, each tube's volume, the empty pipette and the exported notebook.

```sh
node tests/browser-photographic-pipetting.cjs path/to/right_hands.jpg path/to/fist.jpg
```

Append `--all-tubes` to prepare the entire rack. The replay switches between the stock and water pipettes by hand. It checks the visible reading after every draw, every tube's composition after each stroke, the exported notebook and the number of tracking freezes. Add `--immersive` to check the live HUD, `--laptop` for 1280 × 800, or `--phone` for 390 × 844. Set `HAND_PREVIEW_DIR` to save rendered previews of camera setup and the 8/2 transfer. The landmark tests also withdraw a 3 mL sample from every prepared tube and the unknown dilution.

Set `WIDE_BENCH=1` to repeat the pipette check in an 1856 × 866 immersive bench overview. Set `HAND_SIDE=Left` to reflect the hand photographs and use the Left working-hand setting. Run `node tests/browser-camera-framing.cjs` to measure a known-size reference square in the rendered webcam image at 50%, 80% and 100%, after mirroring and on a portrait screen.

`HAND_VIDEO` can supply the video path. `EXPECT_HAND_MOTION=1` checks motion across the frame. `CHROMIUM_EXECUTABLE` selects a different Chromium executable. The screenshots and measurements are written to the system temporary directory under `spectro-studio-review/b06-hands`. Set `UPDATE_HAND_PREVIEW=1` to regenerate the studio's palm preview.

For the recorded verification, a MediaPipe hand photograph moved across the frame of a simulated camera. The bundled GPU detector followed that motion and the contour stayed visible over the tabletop. Physical webcam tracking under classroom lighting remains unverified. [MediaPipe hand photograph](https://storage.googleapis.com/mediapipe-assets/right_hands.jpg) · [MediaPipe test-data manifest](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/testdata/vision/BUILD)
