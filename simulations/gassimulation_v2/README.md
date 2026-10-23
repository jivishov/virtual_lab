# Gas Laws Lab

Interactive 3D gas law simulations for high school chemistry. Five laws, seven real systems, one equation underneath.

| Law | Systems |
|---|---|
| Boyle's law | Sealed syringe on a lab bench, with a pressure sensor |
| Charles's law | Hot air balloon in a field (hot inflation, tethered flight). Balloon in temperature baths (liquid nitrogen to boiling water) |
| Gay-Lussac's law | Pressure cooker on a gas stove. Car tire through the seasons |
| Avogadro's law | Party balloon filled with helium, air or CO₂ |
| Ideal gas law | Scuba tank: fill station, then a cold quarry, a temperate sea or a tropical reef |

## Deploy (GitHub Pages)

Static files only; no build step.

1. Delete the old contents of `simulations/gassimulation/` (old `styles.css` and `js/*.js`).
2. Copy in `index.html`, `css/` and `js/` from this folder.
3. Commit and push. The page loads Three.js 0.160.0 from jsDelivr and Barlow fonts from Google Fonts.

`index.html#pressureCooker` (or any system id) opens a system directly. The Google Analytics tag from the old page (G-6QQR2741ZZ) is carried over in `index.html`; delete that block if it is not wanted.

`preview/gas-laws-preview.html` is the same app bundled into one file for previewing. Rebuild it with `python3 preview/build_app.py`. It is not needed on the site.

## Tests

```
node --test tests/model.test.mjs tests/particles.test.mjs
```

65 tests: PV = nRT at every step in every system, each law's behavior, every safety event, steam table values, instrument behavior, particle containment, Maxwell-Boltzmann speeds, and pressure from particle impacts matching the model.

## How it is built

```
js/model/       pure physics, no DOM: the source of truth
  runtime.js      initWorld, setInput, act, stepWorld, observe
  scenarios.js    the seven systems: inputs, instruments, events, readouts, notes
  hotAir.js       hot air balloon process (two phases, lift, tether)
  cooker.js       pressure cooker process (energy balance, steam, regulator, plug, lid lock)
  steam.js        water vapor pressure (Antoine equation)
  instrument.js   gauges and sensors with lag, overshoot, rounding, sampling
js/particles/   kinetic particle engine that follows the model
js/view/        Three.js: stage, environments, one scene file per system
js/ui/          panel helpers: units, the law check, the graph
js/main.js      wiring
```

Each frame the model steps first; the particle engine then matches the model's sphere count, container size and temperature; the 3D scene and panel read the same snapshot.

## Physics choices worth knowing

- Pressure readings come from instruments, as in a lab: a sensor with lag for the syringe, the tire display in whole psi every 2 s, a damped needle for scuba and the cooker. Gauge readings are converted to absolute pressure in the "Check the law" panel.
- **Hot air balloon.** Mouth open, so P = outside pressure. While filling: Charles's law (fixed n). Once full (2,800 m³): V fixed, air spills out, n = PV/RT. Lift-off when (ρ_out − ρ_in)·V exceeds 680 kg: about 78 °C on a 10 °C morning, about 113 °C on a 32 °C afternoon. Warning at 110 °C, limit 120 °C.
- **Pressure cooker.** P = water vapor pressure + leftover air. Gay-Lussac's law alone gives 1.34 atm at 121 °C; the cooker reaches 2.02 atm because evaporation adds gas. Regulator 15 psi, overpressure plug 22 psi, lid lock above 0.3 psi: typical values, labeled as such. Quick release with the stove still on lets the vent reseal and pressure rebuild, as a real float valve does.
- **Scuba.** Filling only at the fill station; dive sites only let air out (breathing). Fill heating and the fill drop come from an energy balance with the cylinder wall.
- Time is compressed where real processes take minutes; each system says so in "About this model".
- Particle spheres collide at 80% of their drawn diameter so the drawn gas stays close to ideal (oversized spheres would behave like a real gas).

## Known limits

- Performance was tested only in a software renderer (no GPU here). Check frame rate on a classroom Chromebook.
- Envelope temperature is one average value; real envelopes are hotter at the crown.
- Real gas effects are noted, not modeled (for example, scuba air at 200 atm is about 4% less compressible than ideal).
