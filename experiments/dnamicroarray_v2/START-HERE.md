# DNA/RNA Microarray 3D

The 3D activity is **microarray-3d.html** (the only 3D page; the old `microarray-3d-v3.html` address forwards to it). It follows the supplied manual's 32-spot, four-gene procedure with mouse, keyboard/touch alternatives and optional on-device hand control. The 2D activity is `index.html`, whose "3D lab" button opens the 3D page.

Hand control uses a calibrated thumb press on the plunger, as with a real micropipette: capture Rest and Press once, pause over a target until its ring turns gold, press the plunger before the tip enters the liquid, lower in, and release to draw. Pressing with the tip already in the liquid is refused as bubbles and noted in the debrief. Mix by pressing and releasing with the tip in the well. Put the pipette away by bringing it to its stand and showing an open palm. A pinch plunger that needs no calibration is available under Hand settings. See [the README](3d-v3/README.md) for details.

Serve this folder over HTTP for fully offline use; camera control requires localhost, HTTPS or a file page with internet access. Opened directly as a file (`file://`), hand control still works with an internet connection: the browser cannot load the bundled tracker from a file page, so the same MediaPipe 0.10.17 files are loaded over HTTPS from this lab's published copy on virtuallab.az, then from the pinned jsDelivr/Google copies. Video frames never leave the device.

```powershell
python -m http.server 8766 --bind 127.0.0.1
```

Open http://127.0.0.1:8766/microarray-3d.html in a WebGL2-capable browser. There is no build step. MediaPipe and fonts are included; when served, the page makes no external runtime requests.

Tests: `node --test 3d-v3/tests/*.test.cjs` (from the repository root: `node --test experiments/dnamicroarray_v2/3d-v3/tests/*.test.cjs`). Webcam comfort and tracking vary by device, so try hand control on the classroom computers before a lesson.
