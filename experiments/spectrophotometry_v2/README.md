# Spectrophotometry Studio v2

Open [Spectrophotometry Studio v2](https://virtuallab.az/experiments/spectrophotometry_v2/) in a WebGL 2 browser. To run a local copy, launch **Start Lab.ps1** or run `python serve.py` and open [the local studio](http://127.0.0.1:8774/). The simulation and hand tracker run in the browser. The published page uses the same Google Analytics measurement ID as the original lab.

This is a standalone 3D edition of the [Blue #1 calibration lab](../spectrophotometry/). Its 95 steps cover the measured standards, unknown-drink dilution and graded notebook. The studio has its own launch port and bench-layout storage.

## At the bench

- **Bench**, **Solutions** and **Instrument** frame each workstation. **Show target** centers the next action. **Inspect** brings an individual object close enough to read its markings. **Follow step** frames the tools for the current transfer and starts enabled on phones and tablets.
- Drag a pipette by its bulb or shaft, or drag the cuvette by its rim. To pipette, keep holding as the tip passes through the vessel opening. Release in the source to draw. At the receiver, drag down to deliver. You can also click once to carry the tool, then press the opening and drag down. **Targets** provides keyboard and touchscreen controls.
- Choose **Hands → Start hands**, frame your working hand, then select **Use this frame**. With **Tools** and **Guided stroke** selected, open your palm over the pipette and curl three fingers to grab it. Bring the tip to the Blue #1 opening. At the gold ring, dip your closed hand slightly and hold it there. Watch the volume rise beside the bulb. For the second standard, lift when the pipette reads **8.0 mL**, carry it to the **8/2** tube, then dip and hold while it empties. Lifting early pauses the transfer. A fresh dip finishes the remaining volume. Open your palm to put the pipette down.
- For separate bulb control, select **Hands → Pipette bulb → Manual squeeze**. Keep your middle, ring and little fingers curled around the tool. Above the source, pinch thumb and index finger, lower the tip while pinching, then spread thumb and index to draw. At the receiving vessel, lower the tip first, then pinch and hold to dispense.
- **Camera size** in either **Hands** or **Camera** adjusts the live image and palm outline together. The default is 80% of the full webcam image fitted to the bench. The setting is saved on this device. Use **Reach width** to choose how far your hand travels across the preview to reach both ends of the bench. The camera stays steady around the middle and shifts sideways or vertically as you reach the edges. The cursor stays on your palm.
- Turn your wrist to tip the cuvette. Close and reopen over the lid, a key or the clipboard to use it. Select **View** to orbit with one closed palm or zoom with two. **Tools** returns to handling equipment.
- **Immerse** expands the bench and retains access to the procedure, notebook, camera and targets. Use **Exit** or Escape to return. Opening a dialog or changing modes suspends active handling at its current volume.
- **Camera → Live camera** places the virtual bench against a live room view. Camera settings include mirroring and device switching when several inputs are available. Hands and the live background share one video stream. **Stop hands** can leave the room view running. **Camera off**, **Stop**, reset, leaving the page or hiding the tab releases the camera. All video processing stays on the device.

## Student workflow

1. Prepare five Blue #1 standards and a water blank with the stock and water pipettes. Zero the instrument at 630 nm. Measure the standards and blank, then open **Notebook → Fit my standards**. The graph fits the six measured pairs through the origin and shows the equation and R².
2. Read the original drink. Compare its absorbance with the dye standards. Choose **1–9 mL** of drink for a **10 mL** final mixture. A predicted absorbance inside the measured nonblank interval qualifies the recipe. Feedback explains how to adjust an unsuitable aliquot before using liquid.
3. Remove the cuvette, discard the original sample and rinse. Deliver drink with the violet pipette and distilled water with the teal pipette into the dedicated graduated cylinder. The guide specifies the volumes from the accepted recipe. Draw 3 mL of mixed sample, insert the cuvette, close the lid and press **READ**.
4. Use the notebook to submit the diluted concentration, dilution factor and original concentration. Each answer is checked against the recorded measurements within 1% to accommodate rounding. A successful submission unlocks the worked solution. Download the notebook JSON for a complete record or the CSV for the readings and submitted results.

## Quantitative model

The six calibration samples retain v1's 2.31 µM stock, dilution volumes and tabulated teaching transmittances. The optical path is fixed at 1 cm. Measurement uses A = −log₁₀(%T/100). Blank correction motivates the activity’s through-origin fit, m = Σ(CA)/Σ(C²), using the recorded concentrations and four-decimal absorbances. The displayed R² uses the centered total sum of squares.

The undiluted drink retains v1's configured signal of 39%T. At fixed path length its absorbance scales with the fraction of original drink physically present in the cuvette. Equivalently, T = 0.39 raised to that fraction. Standards use v1's lookup data. The original and diluted drink readings are excluded from the calibration. The original concentration is a student estimate based on the measured slope.

The model assumes additive volumes, ideal mixing, fixed wavelength and deterministic signals. For a diluted sample, C = A/m. The dilution factor is the ratio of aliquot volume in the cuvette to its original-drink component, equivalent to total preparation volume divided by the original aliquot. The original estimate is C × dilution factor.

## Teacher check

Using **5 mL drink and 5 mL water** gives approximately 62.45%T and 0.2045 A. With the fitted slope of 0.13148 A/µM the diluted concentration is about 1.56 µM and the original is 3.11 µM. Other bracketed recipes produce different measured absorbances and recover the same original concentration within rounding.

## Scene and sources

The worktop, cabinetry, instrument, hinged sample chamber, rack, labeled glassware, three pipettes and liquid surfaces are rendered in 3D. The distant room is a generated panoramic image of a clean laboratory. A roughness-filtered reflection atlas baked from that image supplies the windows and room reflections on the equipment. The glass and dye use real-time transmission approximations. Camera mode composites the virtual island over the video image in screen coordinates.

The runtime loads the finished geometry from `assets/`. The [Blender source](authoring/instrument-details.blend) and [authoring script](authoring/instrument.py) contain the new console, fasteners, ventilation and power lead. To rebuild the geometry with the original v2 apparatus mesh, run Blender with `--factory-startup --python authoring/instrument.py`, then pass the original unindexed `equipment.json` to `python authoring/pack_equipment.py path/to/equipment.json`. To rebuild the lighting atlas, run `python authoring/bake_room.py authoring/clean-lab.png`. These offline authoring scripts use NumPy, Pillow and OpenCV.

The palm gesture recognizer and contour tracer come from B06 Hand building in the chemistry 3D collection. The lab adds a guided pipette stroke, optional manual bulb pressure, wrist rotation for pouring and physically positioned vessel openings. All views use the same underlying experiment state.

## Verification

Run `npm test` for the local model, handling, camera and geometry checks. [The carry regression](tests/browser-carry.mjs) measures pickup and drag at the bulb, shaft, grip and cuvette rim and checks release, capture loss and reacquisition. [The mouse regression](tests/browser-direct-mouse.js) completes the full procedure with real pointer events and notebook entries. [The studio browser checks](tests/browser-studio.mjs) exercise palm pickup, outline rendering, orbit, zoom, immersive notebook access and a shared simulated camera. They accept a Playwright page on the running studio.

Real mouse input completed all 95 steps in Bench and Follow step views. The completed notebook exported 103 history entries and eight readings. Phone and tablet touch runs carried the pipette and delivered the first 10 mL standard. Raw B06 hand packets drove the rendered bench through manual pipetting, zeroing the instrument, removing the cuvette and pouring the blank. Photographic camera replays prepared all six standards using the stock and water pipettes. Each exported tube contained 10.0 mL at its labeled ratio. [B06 source and camera verification](tests/B06_HANDS.md)

[Bench preview](preview/bench.jpg) · [Instrument close-up](preview/instrument.jpg) · [Palm outline](preview/palm-outline.jpg)
