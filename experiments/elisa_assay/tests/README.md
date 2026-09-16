# ELISA hand-control regression checks

Run from the repository root with Node.js 18 or later:

```sh
node --test experiments/elisa_assay/tests/hand-control.test.cjs
node --check experiments/elisa_assay/js/handcontrol.js
node --check experiments/elisa_assay/js/pipette-control.js
```

## September 2026 gesture refinement

The primary button features now use normalized 3D distances between the wrist and thumb landmarks (0 through 4), rather than an across-knuckle coordinate frame. Free-hand plunger travel uses the same wrist/thumb geometry. A usable palm frame is still used for free-hand ejector direction; its absence does not disable the plunger. Grip acquisition, cursor positioning, and hand rendering still use other hand landmarks.

Real-pipette calibration retains representative samples from each of three poses: rest, plunger pressed, and ejector pressed. During each capture, maintain the button depth and make small wrist turns through the angles normally used between reagents and strips. Overlapping or insufficiently distinct button poses are rejected rather than guessed.

After the tool is acquired, uncertain curled-finger readings no longer repeatedly veto an otherwise usable calibrated thumb pose. Positively extended fingers still release grip permission. Missing or malformed thumb geometry never falls back to a projected 2D press. A sustained tracking interruption cancels a pending aspiration upstroke; visible release is required to resume. Free-hand presses use smoothing, hysteresis, and a resting baseline that does not absorb a slow press.

A plausible intermediate position along a learned real-button stroke is distinguished from off-path ambiguity. Intermediate positions never fire a button edge, but have a bounded 1.6-second transition grace so a deliberate slow press/release can finish. Missing or malformed tracking still cancels the pending stroke; off-path ambiguity retains the short interruption grace.

## Validation completed

Twenty-one synthetic-landmark tests pass. They cover rigid rotations, translation, scaling, mirrored geometry, degraded finger coordinates, malformed thumb coordinates, slow presses, duplicate-action prevention, release-to-aspirate, interruption recovery, and protocol-state changes. The continuous-stroke test articulates the thumb joints with fixed bone lengths, exercising down/up strokes lasting 200, 400, 600, 1000, and 1500 milliseconds each. The tests load the production scripts into isolated VMs; test hooks are injected only in the test harness, not exposed by the app.

An offline Chromium DOM smoke check also passed for application boot, preservation of the wash-buffer beaker, switching real/free input, calibration capture/cancel controls, and panel cleanup. That smoke check did not exercise a webcam or run MediaPipe inference.

These results establish application-logic behavior for supplied landmark data, not accuracy on actual occluded hands. Rigid-rotation invariance of the feature calculation does not guarantee that MediaPipe will estimate identical landmarks as a real hand turns. No model was retrained and no detector-confidence thresholds were lowered.

## Camera acceptance check still required

Use an empty physical micropipette. Refresh the app, enable Hand control, and recalibrate in a normal vertical grip with the thumb and wrist in view. Move repeatedly between reagents and strips, making the small rotations needed in normal use. Check that a single deliberate downstroke and release are recognized, that travel alone causes no action, and that the ejector remains distinct.

Repeat in Free-hand gestures mode, allowing the raised thumb to settle briefly after pickup and fully releasing it between presses. A held-down thumb must not repeat an action. Hide the hand briefly, bring it back with the thumb still down, then release: interrupted gestures must not replay. Check open-hand release and mouse ownership as well.

A fully hidden thumb or a missing hand detection cannot be made reliable by these geometry changes. Keep the thumb visible without deliberately presenting all knuckles to the lens. If normal working angles remain problematic, record the observed angle and whether tracking itself disappeared or only the button failed; those are different failure modes.
