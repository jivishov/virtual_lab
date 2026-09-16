# Free-hand thumb sensitivity correction

This correction replaces only the uncalibrated `rise` feature returned by
`pipette-control.js`. The real-pipette thumb feature vectors, shape validation,
calibration, classifier, and the shared debounce/release gates are unchanged.
No hand-model confidence thresholds were lowered. Google Analytics is preserved.

## Reproduced failure

The previous `rise` was a weighted wrist-to-thumb distance divided by the entire
thumb-chain length. A moderate articulated bend can change that radial distance
very little. In the new fixed-bone synthetic fixture, a 20-degree MCP bend plus
20-degree IP bend stays below the production gate's 0.16 threshold, so no press
is emitted. The earlier regression fixture used a much larger bend.

The corrected feature projects the IP and tip relative to the thumb MCP onto
the thumb's CMC-to-MCP axis, normalized by the two moving bone lengths. This
measures bending at either thumb joint without an across-finger-knuckle frame.
The signal is scaled to work with the existing gate; timing, hysteresis,
ejector preparation, and interruption protection are not relaxed.

## Validation

Run from the repository root:

```sh
node --check experiments/elisa_assay/js/pipette-control.js
node --test experiments/elisa_assay/tests/free-thumb.test.cjs
```

All 16 focused synthetic unit tests pass after the correction. The first 13
were also run against the preceding implementation: ten failed, including the
moderate-stroke regression, and three passed. The new suite covers short bends,
each thumb joint, the three free-hand tools, held presses and rearming, rigid
rotation/translation/scaling/mirroring, missing finger-knuckle data, slow
strokes, jitter, low frame rates, interrupted presses, ejector selection, and
real-pipette calibration/button discrimination.

The suite loads the production `pipette-control.js` in an isolated VM and
extracts the unchanged production `Gate`, `updateFreeButtons`, and threshold
definitions from `handcontrol.js`. It intentionally does not start a camera,
exercise the complete `onHand`/pickup/engine path, or evaluate MediaPipe on real
video. In this network-restricted editing session, the unchanged gate and
threshold definitions were supplied from connector-fetched source excerpts;
the modified control file was reconstructed and its original Git blob hash
verified before editing. No replacement or excerpt of `handcontrol.js` is part
of this commit. The existing 21-test suite was not rerun in this session.

## Camera acceptance check

Reload the page (the control script URL is bumped to `?v=3`). Select Free-hand
gestures. Show an open hand, close the fingers to pick up a tool, let the raised
thumb settle briefly, then bend the thumb down and raise it again between
presses. No real-pipette calibration is required. Confirm a single press while
held, another after release, and no action from moving the fist alone. Check the
micropipette, transfer pipet, and marker separately at legal protocol targets.

This is a motion gesture, not a measurement of physical thumb pressure. Rigid
whole-thumb motion without bending may still provide little signal. A missing
or badly estimated thumb cannot be recovered by changing this measurement;
real webcam acceptance remains required.
