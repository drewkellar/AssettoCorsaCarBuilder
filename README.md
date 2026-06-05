# Assetto Corsa Guided Data Editor

A local, browser-based editor for unpacked Assetto Corsa car `data` folders.

## Run

From this folder:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8765/
```

## Use

- `Import Data Folder` loads an unpacked `data` folder from your machine. If you accidentally select a whole car folder, the tool only keeps `data/**`, `data.acd`, and tiny metadata needed for diagnostics.
- `Import Zip` loads a zip that contains a `data` folder or relevant data files.
- `Download Data Zip` exports a replacement `data` folder zip.
- `Instructions` explains how to unpack data, use the editor, export safely, and troubleshoot common issues.

The app inspects imported data, detects whether loose `data` is available, warns when only `data.acd` is present, and blocks editing until data has been unpacked. It edits curated build values in `car.ini`, `engine.ini`, `drivetrain.ini`, `brakes.ini`, `suspensions.ini`, `tyres.ini`, and `power.lut`. Numeric settings use paired sliders and precision inputs: drag the slider for quick tuning or type a specific value into the number box. The engine power curve includes a dyno-style graph with torque and calculated horsepower; drag torque points on the graph or type exact values in the table. Settings are grouped by system, and each field has an information button with quick driving-dynamics guidance.

Additional safety and tuning aids:

- `Setup` edits selected `setup.ini` ranges for fuel, brake bias, tire pressures, ride height, and camber.
- `Compare` shows before/after highlights for important values and peak curve changes.
- Export opens a review dialog with changed items, warnings, backup reminders, and checksum guidance.
- The dyno graph supports automatic scaling or a custom Y-axis maximum for high-power builds.

## Notes

This tool is for local/private modding workflows. It does not write directly into Assetto Corsa install folders and does not validate online server legality.
