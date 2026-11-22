# Spectrophotometry Studio v2

Open [Spectrophotometry Studio v2](https://virtuallab.az/experiments/spectrophotometry_v2/) in a WebGL 2 browser. To run a local copy, launch **Start Lab.ps1** or run `python serve.py` and open [the local studio](http://127.0.0.1:8774/). The simulation and hand tracker run in the browser. The published page uses the same Google Analytics measurement ID as the original lab.

This is a standalone 3D edition of the [Blue #1 calibration lab](../spectrophotometry/). Its 95 steps cover the measured standards, unknown-drink dilution and graded notebook. The studio has its own launch port and bench-layout storage.

## At the bench

- Choose **Classic** for warm, light controls or **SciFi** for the dark instrument display. The switch in the header and in **Settings** remembers your choice on this device. Both themes work in the standard and immersive views.
- **Procedure voice** reads the current step after your first lab interaction. It pronounces volumes, tube ratios and wavelengths and follows the dilution you choose in the notebook. **Replay step** repeats the instruction. **Voice off** mutes automatic narration and is remembered on this device. The British English clips were generated locally with the George voice. [Kokoro voice model](https://huggingface.co/hexgrad/Kokoro-82M)
- **Immerse** adds a live procedure strip, a pipette volume dial and brackets around the targeted equipment. The wavelength scale beneath the bench views shows the instrument setting. The speaker and replay controls are also available at the top of this view.
- **Bench**, **Solutions** and **Instrument** frame each workstation. Left-drag empty space to orbit left or right and tilt up or down. Right-drag to pan the bench vertically or sideways. **Show target** centers the next action. **Inspect** brings an individual object close enough to read its markings. **Follow step** frames the tools for the current transfer and starts enabled on phones and tablets.
- Drag a pipette by its bulb or shaft, or drag the cuvette by its rim. To pipette, keep holding as the tip passes through the vessel opening. Release in the source to draw. At the receiver, drag down to deliver. You can also click once to carry the tool, then press the opening and drag down. **Targets** provides keyboard and touchscreen controls.
- Choose **Hands → Start hands**, frame your working hand, then select **Use this frame**. With **Tools** and **Guided stroke** selected, open your palm over the pipette and curl three fingers to grab it. Bring the tip to the Blue #1 opening. At the gold ring, dip your closed hand slightly and hold it there. Watch the volume rise beside the bulb. For the second standard, lift when the pipette reads **8.0 mL**, carry it to the **8/2** tube, then dip and hold while it empties. Lifting early pauses the transfer. A fresh dip finishes the remaining volume. Open your palm to put the pipette down.
- For separate bulb control, select **Hands → Pipette bulb → Manual squeeze**. Keep your middle, ring and little fingers curled around the tool. Above the source, pinch thumb and index finger, lower the tip while pinching, then spread thumb and index to draw. At the receiving vessel, lower the tip first, then pinch and hold to dispense.
- **Webcam scale** changes the size of the live picture and palm outline on the bench. The solid cyan frame in **Hands** resizes as you move the slider. The **Camera settings** panel shows the same footprint on a miniature bench. The default is 80% and the setting is saved on this device. **Reach width** changes the dashed box inside the picture. Tap the image to center that box where your hand rests. A smaller box takes less hand travel to cross the bench.
- Turn your wrist to tip the cuvette. Close and reopen over the lid, a key or the clipboard to use it. The **Tools / View** switch sits just below **Hands**. Select **View** to orbit with one closed palm or zoom with two. **Tools** returns to handling equipment.
- In **Immerse + Hands**, the palm outline stays visible over the lab interior. As you grasp the pipette, the readout switches from the palm target to the tip target. The dial turns amber while liquid moves. Use **Exit** or Escape to return. Opening a dialog or changing modes suspends active handling at its current volume.
- Click **Camera** to show the live room. Click the active **Camera** button to turn off the webcam and hand tracking. The arrow beside it opens **Camera settings** for the background, framing, mirroring and device selection. **Stop hands** can leave the room view running. Stopping or resetting the experiment, leaving the page or hiding the tab also releases the camera. All video processing stays on the device.

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

With Playwright available and `STUDIO_URL` pointing to the running app, `node tests/browser-visor-panels.cjs` checks the three toolbar rows, wavelength scale, panel controls and wrapped HUD text at desktop and phone widths. `node tests/browser-camera-framing.cjs` compares the preview frames with the size of a known marker in the rendered webcam image and checks that the Camera button releases the shared video track.

[SciFi bench](preview/bench.jpg) / [Classic bench](preview/bench-classic.jpg) · [Instrument close-up](preview/instrument.jpg) · [Palm outline](preview/palm-outline.jpg) · [Hands setup](preview/hands-setup.jpg) · [Webcam scale preview](preview/webcam-scale.webp) · [Immersive Hands](preview/hands-hud.jpg) · [Phone setup](preview/hands-setup-mobile.jpg) · [Phone HUD](preview/hands-hud-mobile.jpg) · [Completed notebook](preview/notebook.jpg)
