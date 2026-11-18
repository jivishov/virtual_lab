# B06 hand controls

The reference activity is **Hand building** in `virtual_lab/temp/chemistry-3d-collection/dist/practice/b06`.

- Studio's `src/view-gestures.js` is a byte-for-byte copy of B06's `hand-gestures.js`. It tracks each palm, filters motion, recognizes a three-finger grasp and release, and defines the reach area shown in the setup preview.
- In Follow step, Hands mode leaves space around the stand and both vessels for a pipette carry. If MediaPipe reports a flattened duplicate on the moving fist, the lab adapter keeps the established palm. A missed camera frame stops motion immediately. During a carry, a single missed frame can be bridged when the same hand returns along its measured path within 300 ms. Separate hands and ambiguous overlaps still go through B06's identity checks.
- `src/palm-outline.js` uses B06's `hand-trace.js` contour algorithm. Inference receives the full camera exposure. The background, foreground contour and grab cursor share an aspect-preserving placement and mirror setting. Camera size sets the visible scale. Reach width controls the movement needed to cover the bench.
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

Append `--all-tubes` to prepare the entire rack. The replay switches between the stock and water pipettes by hand. It checks the visible pipette reading after every draw, the stock and water in each of the six tubes after every stroke, and the exported notebook after the final 0/10 blank. The landmark tests also withdraw a 3 mL sample from every prepared tube and the unknown dilution. The geometry tests check that the tip stays submerged as the liquid falls and that each bore rejects a tip in its neighbor.

Set `WIDE_BENCH=1` to repeat the pipette check in an 1856 × 866 immersive bench overview. Set `HAND_SIDE=Left` to reflect the hand photographs and use the Left working-hand setting. Run `node tests/browser-camera-framing.cjs` to measure a known-size reference square in the rendered webcam image at 50%, 80% and 100%, after mirroring and on a portrait screen.

`HAND_VIDEO` can supply the video path. `EXPECT_HAND_MOTION=1` checks motion across the frame. `CHROMIUM_EXECUTABLE` selects a different Chromium executable. The screenshots and measurements are written to the system temporary directory under `spectro-studio-review/b06-hands`. Set `UPDATE_HAND_PREVIEW=1` to regenerate the studio's palm preview.

For the recorded verification, a MediaPipe hand photograph moved across the frame of a simulated camera. The bundled GPU detector followed that motion and the contour stayed visible over the tabletop. Physical webcam tracking under classroom lighting remains unverified. [MediaPipe hand photograph](https://storage.googleapis.com/mediapipe-assets/right_hands.jpg) · [MediaPipe test-data manifest](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/testdata/vision/BUILD)
