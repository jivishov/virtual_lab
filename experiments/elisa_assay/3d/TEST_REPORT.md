# ELISA 3D v1.1 — test report

Executed 2026-09-17. Scope: the separate 3D experiment only.

## Results

| Suite | Passed | Scope |
|---|---:|---|
| Node domain / gesture / controller tests | 58 / 58 | All 20 allowed patient pairings; volume conservation; sequence constraints; individual labeling; manual serial mixing; separate strip handling; palm contacts; thumb press/release and cancellation |
| Chromium mouse-driven assay | 119 / 119 | Real Playwright pointer events from unlabeled strips through final interpretation, without any keyboard event or guided-assist action |
| Chromium camera lifecycle | 10 / 10 | Mocked camera and model: worker/main-thread fallback, local paths, permission failure, start/stop/restart, late-stream cleanup, per-mode calibration and tracking-loss cancellation |

The full mouse run recorded 615 events: 611 manually triggered protocol actions and four incubation-complete events. All 11 receiving standards completed five draw-and-return mixing cycles. Final liquid-volume balance error was 0 µL. No browser JavaScript exceptions or protocol errors occurred in that run.

The mouse test used the actual scene projections and DOM pointer events. Incubations were started through timer clicks; elapsed protocol time was then advanced programmatically to avoid waiting. Software-GPU painting was paused between interaction checks for test speed, and restored for the final rendered screenshot. Therefore this is not a frame-rate or user-effort benchmark.

## Important negative tests

A stationary marker click does not label a well. A tip-rack click without downward travel does not attach a tip. Thumb motion does not attach a tip. Hand-mode aspiration without palm immersion draws nothing. Leaving a source, losing pointer capture, blurring the page, or losing hand tracking cancels pending aspiration. Dispensing followed by release does not aspirate back. Draining one strip does not empty the other. Final mixing requires both strips.

## Not established by these tests

No real webcam or physical micropipette was available to validate actual MediaPipe detections. The camera suite explicitly mocks both the video device and model. Successful loading on every browser, GPU and school network is not established. Browser testing used Chromium in a controlled environment, not an interactive test of the deployed URL. Human comfort, occlusion robustness and calibration thresholds need a live-device trial.

No claim of photograph-level rendering, calibrated colorimetry, hydrodynamic fidelity or clinical validity is made.
