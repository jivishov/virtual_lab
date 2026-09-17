# ELISA 3D v1.1 — direct manipulation

This is an additive experiment. The original 2D `index.html`, JavaScript, styles, vendor assets and analytics are unchanged.

Open `../elisa-3d.html` on the deployed site:
https://jivishov.github.io/virtual_lab/experiments/elisa_assay/elisa-3d.html

## Mouse controls

- Click a physical tool or its dock button to pick it up. Move the mouse freely; the held tool follows it. Click TOOL RETURN to park it.
- Marker: hold the left button and make a short writing stroke over each well's label pad. One well is numbered per stroke/contact. Stationary clicks do not label. Numbers are generated labels, not handwriting recognition.
- Tip: aim at the rack, hold the left button and move downward about 18 pixels. Release to lift. Plunger clicks do not seat tips.
- Aspirate: press and release over the same source. Dispense: press over the receiving well. Release after dispensing does not draw liquid back.
- Mixing: aspirate and dispense back into the same receiving standard, five cycles. The model counts actual completed draw/return cycles.
- Eject: right-click over waste with an empty tip. Left-click over waste to discard the final dilution aliquot.
- Wash pipette: squeeze/release over the beaker to load; squeeze over a well to fill.
- Strips: click the left tab, right-click to invert, then lower and lift over towels four times. Click the strip's home position to return it. Handle each strip separately. Final mixing is upright, with four gentle taps.
- Click the bench timer to incubate. Right-drag orbits the camera, the wheel zooms, and Arrange moves equipment.

Guided assistance and keyboard controls are optional, inside collapsed panels.

## Hand controls and camera

Open the HTTPS page in its own tab, allow Camera, choose Free hand or Real micropipette, and capture Rest then Press. Each mode has its own calibration. Close the grip over a tool to pick it up; open the hand briefly to return it.

Hold steady over the tip rack, then lower the palm to seat a tip. To aspirate, press the thumb, lower the palm into the liquid, then release the thumb. Thumb press dispenses a loaded tip. Palm travel and thumb press are separate channels; palm motion is mapped to virtual depth, not measured physical force.

Inference tries existing `../vendor/mediapipe` assets first, then pinned MediaPipe 0.10.17 CDN assets. Classic workers allow the Wasm loader's importScripts calls; GPU/CPU and main-thread fallbacks handle unsupported worker environments. Camera frames are processed on-device. Tracking loss cancels pending actions rather than completing them.

Real webcam tracking, occlusion tolerance and physical-pipette usability still require a live user trial. Synthetic gesture and mocked camera tests are not a validation of those capabilities.

## Tests

From this directory:

```sh
node --test tests/*.test.cjs
```

See `TEST_REPORT.md` for the executed browser and camera-test scope and limitations.

## Reference and boundaries

Protocol and reference photograph: supplied EDVOTEK / PLTW #468, version 468.190508, pages 8–16. The photo is reproduced under the document's non-profit educational permission. Blue endpoint and printed patient concentrations are retained. Geometry, glass and lighting are approximations, not manufacturer CAD or photogrammetry. The color response is illustrative, not absorbance or clinical data. Wash fill/capacity choices and timing simplifications are disclosed in the in-app help. No diagnostic use.
