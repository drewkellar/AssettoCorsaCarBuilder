(function () {
  const textDecoder = new TextDecoder("utf-8");
  const textEncoder = new TextEncoder();
  const scheduleFrame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));

  const state = {
    files: new Map(),
    originals: new Map(),
    docs: new Map(),
    values: new Map(),
    activeSection: "basics",
    warnings: [],
    diagnostics: [],
    packageInfo: null,
    hasEditableData: false,
    ignoredFileCount: 0,
    curveRows: [],
    graphYMax: 0,
    graphEditMode: "torque",
    torqueUnit: "nm",
    powerUnit: "hp",
  };

  const sections = [
    { id: "basics", label: "Basics" },
    { id: "engine", label: "Engine" },
    { id: "drivetrain", label: "Drivetrain" },
    { id: "brakes", label: "Brakes" },
    { id: "suspension", label: "Suspension" },
    { id: "tyres", label: "Tyres" },
    { id: "setup", label: "Setup" },
  ];

  const controls = [
    field("basics", "car.ini", "INFO", "SCREEN_NAME", "Car name", "text", "Name shown by AC apps and server lists."),
    field("basics", "car.ini", "BASIC", "TOTALMASS", "Total mass (kg)", "number", "Vehicle mass with driver and no fuel, kg.", 200, 4000, 5),
    field("basics", "car.ini", "CONTROLS", "STEER_LOCK", "Steer lock (degrees)", "number", "Degrees from center to full lock.", 90, 1440, 5),
    field("basics", "car.ini", "FUEL", "FUEL", "Default fuel level (liters)", "number", "Starting fuel in liters.", 0, 300, 1),
    field("basics", "car.ini", "FUEL", "MAX_FUEL", "Max fuel level (liters)", "number", "Fuel tank capacity in liters.", 1, 500, 1),
    field("basics", "setup.ini", "FUEL", "MIN", "Minimum selectable fuel (liters)", "number", "Lowest fuel value available in the in-game setup screen.", 0, 300, 1),

    field("engine", "engine.ini", "ENGINE_DATA", "MINIMUM", "Idle RPM", "number", "Engine idle speed.", 300, 3500, 25),
    field("engine", "engine.ini", "ENGINE_DATA", "LIMITER", "Rev limiter", "number", "RPM limiter. Keep above idle.", 2500, 18000, 100),
    field("engine", "engine.ini", "ENGINE_DATA", "INERTIA", "Engine inertia", "number", "Lower values rev faster; extreme values can feel unstable.", 0.01, 2, 0.01),
    field("engine", "engine.ini", "COAST_REF", "TORQUE", "Engine braking torque", "number", "Reference coasting torque in Nm.", 0, 600, 5),
    field("engine", "engine.ini", "DAMAGE", "RPM_THRESHOLD", "RPM damage threshold", "number", "RPM where engine damage starts.", 2500, 22000, 100),

    field("drivetrain", "drivetrain.ini", "GEARS", "GEAR_R", "Reverse gear", "number", "Reverse ratio. Usually negative.", -12, -0.25, 0.01),
    field("drivetrain", "drivetrain.ini", "GEARS", "GEAR_1", "Gear 1", "number", "Forward gear ratio.", 0.1, 12, 0.01),
    field("drivetrain", "drivetrain.ini", "GEARS", "GEAR_2", "Gear 2", "number", "Forward gear ratio.", 0.1, 12, 0.01),
    field("drivetrain", "drivetrain.ini", "GEARS", "GEAR_3", "Gear 3", "number", "Forward gear ratio.", 0.1, 12, 0.01),
    field("drivetrain", "drivetrain.ini", "GEARS", "GEAR_4", "Gear 4", "number", "Forward gear ratio.", 0.1, 12, 0.01),
    field("drivetrain", "drivetrain.ini", "GEARS", "GEAR_5", "Gear 5", "number", "Forward gear ratio.", 0.1, 12, 0.01),
    field("drivetrain", "drivetrain.ini", "GEARS", "FINAL", "Final drive", "number", "Final drive ratio.", 0.5, 12, 0.01),
    field("drivetrain", "drivetrain.ini", "DIFFERENTIAL", "POWER", "Diff power lock", "number", "0 to 1 lock under throttle.", 0, 1, 0.01),
    field("drivetrain", "drivetrain.ini", "DIFFERENTIAL", "COAST", "Diff coast lock", "number", "0 to 1 lock off throttle.", 0, 1, 0.01),
    field("drivetrain", "drivetrain.ini", "CLUTCH", "MAX_TORQUE", "Clutch torque", "number", "Maximum clutch torque in Nm.", 20, 5000, 10),

    field("brakes", "brakes.ini", "DATA", "MAX_TORQUE", "Brake torque", "number", "Maximum brake torque in Nm.", 100, 12000, 25),
    field("brakes", "brakes.ini", "DATA", "FRONT_SHARE", "Front brake share", "number", "Front brake torque share as 0 to 1.", 0.1, 0.95, 0.01),
    field("brakes", "brakes.ini", "DATA", "HANDBRAKE_TORQUE", "Handbrake torque", "number", "Rear handbrake torque in Nm.", 0, 9000, 25),

    field("suspension", "suspensions.ini", "BASIC", "WHEELBASE", "Wheelbase", "number", "Wheelbase in meters.", 1, 5, 0.01),
    field("suspension", "suspensions.ini", "BASIC", "CG_LOCATION", "Front weight distribution", "number", "Front weight distribution as 0 to 1.", 0.2, 0.8, 0.005),
    field("suspension", "suspensions.ini", "ARB", "FRONT", "Front ARB", "number", "Front anti-roll bar stiffness.", 0, 120000, 250),
    field("suspension", "suspensions.ini", "ARB", "REAR", "Rear ARB", "number", "Rear anti-roll bar stiffness.", 0, 120000, 250),
    field("suspension", "suspensions.ini", "FRONT", "ROD_LENGTH", "Front ride height rod", "number", "Positive raises ride height.", -0.5, 0.8, 0.005),
    field("suspension", "suspensions.ini", "REAR", "ROD_LENGTH", "Rear ride height rod", "number", "Positive raises ride height.", -0.5, 0.8, 0.005),
    field("suspension", "suspensions.ini", "FRONT", "STATIC_CAMBER", "Front camber", "number", "Static front camber in degrees.", -15, 8, 0.05),
    field("suspension", "suspensions.ini", "REAR", "STATIC_CAMBER", "Rear camber", "number", "Static rear camber in degrees.", -15, 8, 0.05),
    field("suspension", "suspensions.ini", "FRONT", "SPRING_RATE", "Front spring rate", "number", "Wheel rate stiffness in N/m.", 500, 500000, 500),
    field("suspension", "suspensions.ini", "REAR", "SPRING_RATE", "Rear spring rate", "number", "Wheel rate stiffness in N/m.", 500, 500000, 500),
    field("suspension", "suspensions.ini", "FRONT", "DAMP_BUMP", "Front bump damping", "number", "Slow bump damping.", 50, 80000, 50),
    field("suspension", "suspensions.ini", "FRONT", "DAMP_REBOUND", "Front rebound damping", "number", "Slow rebound damping.", 50, 80000, 50),
    field("suspension", "suspensions.ini", "REAR", "DAMP_BUMP", "Rear bump damping", "number", "Slow bump damping.", 50, 80000, 50),
    field("suspension", "suspensions.ini", "REAR", "DAMP_REBOUND", "Rear rebound damping", "number", "Slow rebound damping.", 50, 80000, 50),

    field("tyres", "tyres.ini", "FRONT", "PRESSURE_STATIC", "Front static pressure", "number", "Default front tire pressure.", 1, 120, 0.5),
    field("tyres", "tyres.ini", "REAR", "PRESSURE_STATIC", "Rear static pressure", "number", "Default rear tire pressure.", 1, 120, 0.5),
    field("tyres", "tyres.ini", "FRONT", "PRESSURE_IDEAL", "Front ideal pressure", "number", "Target front tire pressure.", 1, 120, 0.5),
    field("tyres", "tyres.ini", "REAR", "PRESSURE_IDEAL", "Rear ideal pressure", "number", "Target rear tire pressure.", 1, 120, 0.5),
    field("tyres", "tyres.ini", "FRONT", "DX_REF", "Front longitudinal grip", "number", "Reference longitudinal grip.", 0.05, 6, 0.01),
    field("tyres", "tyres.ini", "REAR", "DX_REF", "Rear longitudinal grip", "number", "Reference longitudinal grip.", 0.05, 6, 0.01),
    field("tyres", "tyres.ini", "FRONT", "DY_REF", "Front lateral grip", "number", "Reference lateral grip.", 0.05, 6, 0.01),
    field("tyres", "tyres.ini", "REAR", "DY_REF", "Rear lateral grip", "number", "Reference lateral grip.", 0.05, 6, 0.01),

    field("setup", "setup.ini", "FRONT_BIAS", "MIN", "Brake bias minimum", "number", "Lowest brake bias available in setup.", 40, 95, 0.5),
    field("setup", "setup.ini", "FRONT_BIAS", "MAX", "Brake bias maximum", "number", "Highest brake bias available in setup.", 40, 95, 0.5),
    field("setup", "setup.ini", "PRESSURE_LF", "MIN", "Front pressure minimum", "number", "Lowest front tire pressure available in setup.", 1, 80, 0.5),
    field("setup", "setup.ini", "PRESSURE_LF", "MAX", "Front pressure maximum", "number", "Highest front tire pressure available in setup.", 1, 120, 0.5),
    field("setup", "setup.ini", "PRESSURE_LR", "MIN", "Rear pressure minimum", "number", "Lowest rear tire pressure available in setup.", 1, 80, 0.5),
    field("setup", "setup.ini", "PRESSURE_LR", "MAX", "Rear pressure maximum", "number", "Highest rear tire pressure available in setup.", 1, 120, 0.5),
    field("setup", "setup.ini", "ROD_LENGTH_LF", "MIN", "Front ride height minimum", "number", "Lowest front rod-length setup value.", 0, 500, 1),
    field("setup", "setup.ini", "ROD_LENGTH_LF", "MAX", "Front ride height maximum", "number", "Highest front rod-length setup value.", 0, 800, 1),
    field("setup", "setup.ini", "ROD_LENGTH_LR", "MIN", "Rear ride height minimum", "number", "Lowest rear rod-length setup value.", 0, 500, 1),
    field("setup", "setup.ini", "ROD_LENGTH_LR", "MAX", "Rear ride height maximum", "number", "Highest rear rod-length setup value.", 0, 800, 1),
    field("setup", "setup.ini", "CAMBER_LF", "MIN", "Front camber minimum", "number", "Most negative front camber available in setup.", -15, 5, 0.1),
    field("setup", "setup.ini", "CAMBER_LF", "MAX", "Front camber maximum", "number", "Most positive front camber available in setup.", -15, 8, 0.1),
    field("setup", "setup.ini", "CAMBER_LR", "MIN", "Rear camber minimum", "number", "Most negative rear camber available in setup.", -15, 5, 0.1),
    field("setup", "setup.ini", "CAMBER_LR", "MAX", "Rear camber maximum", "number", "Most positive rear camber available in setup.", -15, 8, 0.1),
  ];

  function field(section, file, iniSection, key, label, type, help, min, max, step) {
    return { section, file, iniSection, key, label, type, help, min, max, step };
  }

  const groupOrder = {
    basics: ["Identity", "Chassis", "Steering", "Fuel"],
    engine: ["Rev Behavior", "Engine Braking", "Damage", "Power Curve"],
    drivetrain: ["Gear Ratios", "Differential", "Shift System"],
    brakes: ["Brake Force", "Brake Balance"],
    suspension: ["Geometry", "Anti-Roll Bars", "Ride Height", "Alignment", "Springs", "Dampers"],
    tyres: ["Pressures", "Grip Balance"],
    setup: ["Brake Bias Range", "Tire Pressures", "Ride Height", "Alignment"],
  };

  const infoText = {
    "Car name": "Changes the display name used by in-game apps, setup screens, and server lists. It does not change performance, but it helps keep tuned variants easy to identify.",
    "Total mass (kg)": "Higher mass makes the car slower to accelerate, harder to stop, and less responsive in direction changes. Lower mass sharpens braking and corner entry, but unrealistic cuts can make the car too twitchy or overpowered for its tires.",
    "Steer lock (degrees)": "Sets the maximum steering angle available at the wheels. More lock helps tight corners and drift-style saves, but too much can make steering inputs abrupt and can expose suspension geometry limits.",
    "Default fuel level (liters)": "Sets the starting fuel load. More fuel adds weight and can change balance depending on tank position; less fuel improves lap time but shortens stint length.",
    "Max fuel level (liters)": "Sets tank capacity and, when setup.ini supports it, syncs the highest selectable fuel amount to the same value so the setup screen cannot choose more fuel than the tank can hold.",
    "Minimum selectable fuel (liters)": "Sets the lowest fuel amount available in the in-game setup screen. Lower values are useful for hotlaps; keep it below the max fuel level so the setup range remains valid.",
    "Idle RPM": "Sets the engine speed at rest. A higher idle can make launches and low-speed recovery smoother; too high can make the car creepier on throttle pickup and less natural in the pits.",
    "Rev limiter": "Sets the RPM ceiling. Raising it can extend each gear and let the engine stay in power longer, but only helps if the power curve still makes torque there; setting it too high can cause damage or dead rev range.",
    "Engine inertia": "Controls how quickly RPM changes. Lower inertia gives snappier throttle response and faster rev matching; higher inertia smooths launches and makes the drivetrain feel heavier, but can dull throttle control.",
    "Engine braking torque": "Raises or lowers deceleration from the engine when off throttle. More engine braking helps rotate the car into corners but can destabilize the rear on downshifts; less makes coasting smoother.",
    "RPM damage threshold": "Sets when over-rev damage starts. Raising it makes aggressive shifting safer; lowering it punishes missed shifts and extended limiter use.",
    "Reverse gear": "Changes reverse speed and torque multiplication. Shorter reverse ratios give more low-speed shove; longer ratios make reverse less abrupt.",
    "Gear 1": "Shorter ratios improve launch and low-speed acceleration but require earlier shifts. Longer ratios reduce wheelspin and stretch speed range.",
    "Gear 2": "Affects corner exit from slow turns. Shorter values feel punchier; longer values calm traction and reduce shifting.",
    "Gear 3": "Shapes mid-speed acceleration. Use it to keep the engine near peak torque through medium corners.",
    "Gear 4": "Shapes acceleration on faster exits and short straights. Shorter gearing improves pull; longer gearing avoids hitting the limiter too early.",
    "Gear 5": "Primarily affects top speed and high-speed acceleration. Longer gearing can add speed on long straights; shorter gearing improves pull if the car cannot reach redline.",
    "Final drive": "Multiplies every forward gear. Higher final drive shortens the whole gearbox for stronger acceleration; lower final drive stretches all gears for top speed.",
    "Diff power lock": "Controls differential locking while accelerating. More lock improves drive off corners but can add power understeer or throttle oversteer; less lock helps rotation but can spin the inside tire.",
    "Diff coast lock": "Controls locking while braking or coasting. More coast lock stabilizes braking but resists turn-in; less coast lock helps rotation but can make corner entry nervous.",
    "Clutch torque": "Sets how much torque the clutch can hold. Too low lets the clutch slip under power; higher values handle stronger engines but can make shifts feel harsher.",
    "Brake torque": "Sets maximum brake strength. More torque shortens stopping distances if tires can handle it, but too much causes easier lockups and makes pedal modulation harder.",
    "Front brake share": "Moves brake bias forward or rearward. More front bias is stable but can understeer under braking; more rear bias helps rotation but can cause rear lockups.",
    "Handbrake torque": "Controls rear handbrake force. Higher values rotate the car more aggressively at low speed; too much can make it binary and hard to catch.",
    "Wheelbase": "Longer wheelbase improves high-speed stability and smooths weight transfer. Shorter wheelbase rotates more eagerly but can be twitchier.",
    "Front weight distribution": "Moves static mass balance. More front weight can improve front tire load under braking but increases understeer; more rear weight improves traction but can make lift-off rotation stronger.",
    "Front ARB": "Stiffens left-right roll resistance at the front. More front bar sharpens response but usually reduces front grip mid-corner and adds understeer.",
    "Rear ARB": "Stiffens left-right roll resistance at the rear. More rear bar helps rotation and reduces understeer, but too much can make exits loose.",
    "Front ride height rod": "Raises or lowers front ride height through rod length. Lower front height can improve response and aero attitude, but too low risks bottoming and geometry problems.",
    "Rear ride height rod": "Raises or lowers rear ride height. More rear rake can help rotation; too much can make braking and high-speed balance unstable.",
    "Front camber": "Tilts the front tires. More negative camber improves loaded cornering grip but hurts braking and straight-line contact if excessive.",
    "Rear camber": "Tilts the rear tires. More negative rear camber can add mid-corner grip, but too much reduces traction on exits and braking stability.",
    "Front spring rate": "Stiffer front springs reduce roll and pitch but usually reduce front mechanical grip over bumps. Softer front springs improve compliance but can feel lazy.",
    "Rear spring rate": "Stiffer rear springs help rotation and support power delivery, but can reduce traction over bumps. Softer rear springs improve grip but may add understeer.",
    "Front bump damping": "Controls how fast the front compresses over braking, curbs, and turn-in loads. More bump slows weight transfer; too much makes the front skip over bumps.",
    "Front rebound damping": "Controls how fast the front extends after compression. More rebound can steady transitions; too much can hold the front down and reduce grip over repeated bumps.",
    "Rear bump damping": "Controls rear compression under throttle and bumps. More rear bump can stabilize squat, but too much reduces rear compliance and traction.",
    "Rear rebound damping": "Controls rear extension after load changes. More rebound can calm exits and transitions; too much can jack weight away from the rear tires.",
    "Front static pressure": "Sets default front tire pressure. Higher pressure sharpens response and lowers rolling drag but can reduce contact patch; lower pressure adds grip until overheating or sidewall flex becomes a problem.",
    "Rear static pressure": "Sets default rear tire pressure. Use it to tune traction and rotation; lower rear pressure can add drive grip, while higher pressure can loosen the rear.",
    "Front ideal pressure": "Sets the target pressure where the front tire model performs best. Align this with expected hot pressure so the front tires sit in their grip window.",
    "Rear ideal pressure": "Sets the target pressure where the rear tire model performs best. Raising or lowering it changes where rear grip peaks during a stint.",
    "Front longitudinal grip": "Scales front braking and acceleration grip. Increasing it improves braking authority; extreme values can make the front unrealistically strong.",
    "Rear longitudinal grip": "Scales rear drive and braking grip. More rear longitudinal grip improves traction and stability; too much can hide bad gearing or diff setup.",
    "Front lateral grip": "Scales front cornering grip. More front lateral grip reduces understeer and improves turn-in; too much can make the rear feel weak by comparison.",
    "Rear lateral grip": "Scales rear cornering grip. More rear lateral grip improves stability and exit confidence; less rear grip makes the car rotate more readily.",
    "Brake bias minimum": "Controls the rearward limit of brake bias available in setup. Lower values give users more rotation potential but increase rear-lock risk.",
    "Brake bias maximum": "Controls the forward limit of brake bias available in setup. Higher values give users more stable braking options but can encourage understeer.",
    "Front pressure minimum": "Controls the lowest front pressure available in setup. Wider ranges help experimentation but can let users choose unrealistic cold pressures.",
    "Front pressure maximum": "Controls the highest front pressure available in setup. Useful when testing high-load tires, but too high can reduce grip.",
    "Rear pressure minimum": "Controls the lowest rear pressure available in setup. Lower ranges can add traction but may over-flex tires.",
    "Rear pressure maximum": "Controls the highest rear pressure available in setup. Higher rear pressure can loosen the car but may hurt traction.",
    "Front ride height minimum": "Controls the lowest front ride-height setup value. Lower front settings can help response but may bottom out.",
    "Front ride height maximum": "Controls the highest front ride-height setup value. Higher front settings can increase clearance but may reduce front bite.",
    "Rear ride height minimum": "Controls the lowest rear ride-height setup value. Lower rear can stabilize the car but may reduce rotation.",
    "Rear ride height maximum": "Controls the highest rear ride-height setup value. More rear height can add rake and rotation but may destabilize braking.",
    "Front camber minimum": "Controls the most negative front camber users can choose. More range helps aggressive cornering setups but can hurt braking.",
    "Front camber maximum": "Controls the least negative or positive front camber users can choose. Useful for street-like setups or testing tire contact.",
    "Rear camber minimum": "Controls the most negative rear camber users can choose. More rear camber can help mid-corner grip but reduce exit traction.",
    "Rear camber maximum": "Controls the least negative or positive rear camber users can choose. Useful for stability and traction experiments.",
  };

  const el = {
    empty: document.getElementById("emptyState"),
    shell: document.getElementById("editorShell"),
    dataFolderInput: document.getElementById("dataFolderInput"),
    zipInput: document.getElementById("zipInput"),
    helpBtn: document.getElementById("helpBtn"),
    helpModal: document.getElementById("helpModal"),
    helpCloseBtn: document.getElementById("helpCloseBtn"),
    diagnosticsStatusBtn: document.getElementById("diagnosticsStatusBtn"),
    diagnosticsDrawerBackdrop: document.getElementById("diagnosticsDrawerBackdrop"),
    diagnosticsCloseBtn: document.getElementById("diagnosticsCloseBtn"),
    diagnosticsHelpBtn: document.getElementById("diagnosticsHelpBtn"),
    exportBtn: document.getElementById("exportBtn"),
    resetBtn: document.getElementById("resetBtn"),
    diagnosticsCard: document.getElementById("diagnosticsCard"),
    changesList: document.getElementById("changesList"),
    compareList: document.getElementById("compareList"),
    exportModal: document.getElementById("exportModal"),
    exportCloseBtn: document.getElementById("exportCloseBtn"),
    exportChangesList: document.getElementById("exportChangesList"),
    exportWarningsList: document.getElementById("exportWarningsList"),
    confirmExportBtn: document.getElementById("confirmExportBtn"),
    cancelExportBtn: document.getElementById("cancelExportBtn"),
    blockedShell: document.getElementById("blockedShell"),
    blockedMessage: document.getElementById("blockedMessage"),
    blockedHelpBtn: document.getElementById("blockedHelpBtn"),
    workbench: document.getElementById("workbench"),
    tabs: document.getElementById("tabs"),
    controls: document.getElementById("controls"),
    template: document.getElementById("controlTemplate"),
    carName: document.getElementById("carName"),
    fileCount: document.getElementById("fileCount"),
    editedCount: document.getElementById("editedCount"),
    warningCount: document.getElementById("warningCount"),
    warningsList: document.getElementById("warningsList"),
    activeSectionTitle: document.getElementById("activeSectionTitle"),
    curveEditor: document.getElementById("curveEditor"),
    curveRows: document.getElementById("curveRows"),
    powerGraph: document.getElementById("powerGraph"),
    powerGraphSvg: document.getElementById("powerGraphSvg"),
    graphAutoScale: document.getElementById("graphAutoScale"),
    graphYMaxInput: document.getElementById("graphYMaxInput"),
    graphHint: document.getElementById("graphHint"),
    editTorqueBtn: document.getElementById("editTorqueBtn"),
    editPowerBtn: document.getElementById("editPowerBtn"),
    dynoInfoBtn: document.getElementById("dynoInfoBtn"),
    targetPeakLabel: document.getElementById("targetPeakLabel"),
    targetPeakInput: document.getElementById("targetPeakInput"),
    torqueUnitSelect: document.getElementById("torqueUnitSelect"),
    powerUnitSelect: document.getElementById("powerUnitSelect"),
  };

  init();

  function init() {
    renderTabs();
    el.dataFolderInput.addEventListener("change", (event) => handleFolder(event, "folder"));
    el.zipInput.addEventListener("change", handleZip);
    el.helpBtn.addEventListener("click", openHelpModal);
    el.blockedHelpBtn.addEventListener("click", openHelpModal);
    el.helpCloseBtn.addEventListener("click", closeHelpModal);
    el.diagnosticsStatusBtn.addEventListener("click", openDiagnosticsDrawer);
    el.diagnosticsCloseBtn.addEventListener("click", closeDiagnosticsDrawer);
    el.diagnosticsHelpBtn.addEventListener("click", () => {
      closeDiagnosticsDrawer();
      openHelpModal();
    });
    el.diagnosticsDrawerBackdrop.addEventListener("click", (event) => {
      if (event.target === el.diagnosticsDrawerBackdrop) closeDiagnosticsDrawer();
    });
    el.helpModal.addEventListener("click", (event) => {
      if (event.target === el.helpModal) closeHelpModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !el.helpModal.hidden) closeHelpModal();
      if (event.key === "Escape" && !el.exportModal.hidden) closeExportModal();
      if (event.key === "Escape" && !el.diagnosticsDrawerBackdrop.hidden) closeDiagnosticsDrawer();
    });
    el.exportBtn.addEventListener("click", openExportModal);
    el.exportCloseBtn.addEventListener("click", closeExportModal);
    el.cancelExportBtn.addEventListener("click", closeExportModal);
    el.confirmExportBtn.addEventListener("click", exportZip);
    el.exportModal.addEventListener("click", (event) => {
      if (event.target === el.exportModal) closeExportModal();
    });
    el.resetBtn.addEventListener("click", resetChangedValues);
    el.editTorqueBtn.addEventListener("click", () => setGraphEditMode("torque"));
    el.editPowerBtn.addEventListener("click", () => setGraphEditMode("power"));
    el.dynoInfoBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const wrapper = el.dynoInfoBtn.closest(".info-wrap");
      document.querySelectorAll(".info-wrap.open").forEach((item) => {
        if (item !== wrapper) item.classList.remove("open");
      });
      if (wrapper) wrapper.classList.toggle("open");
    });
    el.torqueUnitSelect.addEventListener("change", () => {
      state.torqueUnit = el.torqueUnitSelect.value;
      updateTargetPeakControl();
      renderPowerGraph(state.curveRows);
    });
    el.powerUnitSelect.addEventListener("change", () => {
      state.powerUnit = el.powerUnitSelect.value;
      updateTargetPeakControl();
      renderPowerGraph(state.curveRows);
      renderCompare();
    });
    el.targetPeakInput.addEventListener("change", () => applyTargetPeak());
    el.graphAutoScale.addEventListener("change", () => {
      el.graphYMaxInput.disabled = el.graphAutoScale.checked;
      renderPowerGraph(state.curveRows);
    });
    el.graphYMaxInput.addEventListener("input", () => {
      state.graphYMax = Number(el.graphYMaxInput.value) || 0;
      renderPowerGraph(state.curveRows);
    });
    window.addEventListener("resize", () => {
      if (!el.curveEditor.hidden && state.curveRows.length) renderPowerGraph(state.curveRows);
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".info-wrap.open").forEach((item) => item.classList.remove("open"));
    });
  }

  function openHelpModal() {
    el.helpModal.hidden = false;
    el.helpCloseBtn.focus();
  }

  function closeHelpModal() {
    el.helpModal.hidden = true;
    el.helpBtn.focus();
  }

  function openDiagnosticsDrawer() {
    if (!state.files.size) return;
    renderDiagnostics();
    renderWarningsList();
    el.diagnosticsDrawerBackdrop.hidden = false;
    el.diagnosticsCloseBtn.focus();
  }

  function closeDiagnosticsDrawer() {
    el.diagnosticsDrawerBackdrop.hidden = true;
    el.diagnosticsStatusBtn.focus();
  }

  function openExportModal() {
    if (!state.hasEditableData) return;
    renderExportReview();
    el.exportModal.hidden = false;
    el.confirmExportBtn.focus();
  }

  function closeExportModal() {
    el.exportModal.hidden = true;
    el.exportBtn.focus();
  }

  function renderExportReview() {
    fillList(el.exportChangesList, getChangeSummary(), "No supported editor changes detected.");
    fillList(el.exportWarningsList, state.warnings, "No warnings.");
  }

  function fillList(list, items, emptyText) {
    list.innerHTML = "";
    const shown = items.length ? items : [emptyText];
    for (const item of shown) {
      const li = document.createElement("li");
      li.textContent = item;
      list.append(li);
    }
  }

  function normalizeRelevantPath(rawPath, root) {
    let path = normalizePath(rawPath);
    if (root && (path === root || path.startsWith(`${root}/`))) path = path.slice(root.length).replace(/^\/+/, "");
    if (isLikelyLooseDataFile(path)) path = `data/${path}`;
    return path;
  }

  function detectImportRoot(paths, sourceType) {
    const common = commonFirstSegment(paths);
    if (!common) return "";
    const stripped = paths.map((path) => path.startsWith(`${common}/`) ? path.slice(common.length + 1) : path);
    const hasUsefulSignals = stripped.some((path) => path === "data.acd" || path.startsWith("data/") || path === "ui/ui_car.json" || isLikelyLooseDataFile(path));
    return hasUsefulSignals ? common : "";
  }

  function commonFirstSegment(paths) {
    if (!paths.length) return "";
    const firstSegments = paths.map((path) => path.split("/")[0]).filter(Boolean);
    return firstSegments.length && firstSegments.every((segment) => segment === firstSegments[0]) ? firstSegments[0] : "";
  }

  function analyzePackage(files) {
    const paths = [...files.keys()];
    const hasData = paths.some((path) => path.startsWith("data/"));
    const hasDataAcd = files.has("data.acd");
    const hasUi = paths.some((path) => path.startsWith("ui/"));
    const ignoredCount = Number(state.ignoredFileCount || 0);
    const nestedData = paths.some((path) => /\/data\/[^/]+$/i.test(path) && !path.startsWith("data/"));
    const type = hasData && ignoredCount ? "Data folder from car package" : hasData ? "Data folder" : hasDataAcd ? "Packed car folder" : "Unknown package";
    const status = hasData ? "Ready to Edit" : hasDataAcd ? "Needs Unpack" : "Possible Bad Import";
    const carFolderName = inferCarFolderName(paths, type);
    return { type, status, carFolderName, hasData, hasDataAcd, hasUi, nestedData, ignoredCount };
  }

  function inferCarFolderName(paths, type) {
    const uiName = "ui/ui_car.json";
    if (state.values.has(uiName)) {
      try {
        const parsed = JSON.parse(state.values.get(uiName));
        if (parsed && parsed.name) return parsed.name;
      } catch {}
    }
    if (type === "Data folder") return "Loose data folder";
    const kn5 = paths.find((path) => path.toLowerCase().endsWith(".kn5"));
    if (kn5) return kn5.split("/").pop().replace(/\.kn5$/i, "");
    return "Unknown car";
  }

  function isRelevantImportPath(path) {
    return path.startsWith("data/") || path === "data.acd" || path === "ui/ui_car.json";
  }

  function isLikelyLooseDataFile(path) {
    return !path.includes("/") && /^(car|engine|drivetrain|brakes|suspensions|tyres|aero|setup|electronics|ai|colliders|sounds|analog_instruments|fuel_cons|escmode|wing_animations)\.ini$|^[A-Za-z0-9_.-]+\.(lut|rto)$/i.test(path);
  }

  async function handleFolder(event, sourceType) {
    const raw = new Map();
    const fileList = [...event.target.files];
    const rawPaths = fileList.map((file) => normalizePath(file.webkitRelativePath || file.name));
    const root = detectImportRoot(rawPaths, sourceType);
    for (let index = 0; index < fileList.length; index += 1) {
      const file = fileList[index];
      const normalizedPath = normalizeRelevantPath(rawPaths[index], root);
      if (!isRelevantImportPath(normalizedPath)) continue;
      raw.set(normalizedPath, new Uint8Array(await file.arrayBuffer()));
    }
    state.ignoredFileCount = Math.max(0, fileList.length - raw.size);
    if (!raw.size && fileList.length) raw.set("__IMPORT_INFO__.txt", textEncoder.encode("No data folder or data.acd was found in the selected files."));
    loadFiles(raw);
    event.target.value = "";
  }

  async function handleZip(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const raw = await readZip(new Uint8Array(await file.arrayBuffer()));
      loadFiles(raw);
    } catch (error) {
      alert(`Could not read zip: ${error.message}`);
    }
    event.target.value = "";
  }

  function loadFiles(files) {
    if (!files.size) {
      alert("No files found. Choose a car folder, a data folder, or a zip containing one of those.");
      return;
    }
    state.files = files;
    state.originals = new Map(files);
    state.docs.clear();
    state.values.clear();
    state.curveRows = [];
    for (const [path, bytes] of state.files) {
      if (isTextPath(path)) {
        const text = textDecoder.decode(bytes);
        if (path.toLowerCase().endsWith(".ini")) state.docs.set(path, parseIni(text));
        state.values.set(path, text);
      } else if (path.toLowerCase().endsWith(".json")) {
        state.values.set(path, textDecoder.decode(bytes));
      }
    }
    state.packageInfo = analyzePackage(files);
    state.hasEditableData = state.packageInfo.hasData;
    hydrateValues();
    validate();
    render();
  }

  function hydrateValues() {
    for (const control of controls) {
      const doc = state.docs.get(`data/${control.file}`);
      const value = doc && getIniValue(doc, control.iniSection, control.key);
      control.value = value == null ? "" : stripComment(value).trim();
      control.originalValue = control.value;
    }
  }

  function renderTabs() {
    el.tabs.innerHTML = "";
    for (const section of sections) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tab";
      button.textContent = section.label;
      button.setAttribute("aria-selected", String(section.id === state.activeSection));
      button.addEventListener("click", () => {
        state.activeSection = section.id;
        render();
      });
      el.tabs.append(button);
    }
  }

  function render() {
    el.empty.hidden = Boolean(state.files.size);
    el.shell.hidden = !state.files.size;
    el.workbench.hidden = !state.hasEditableData;
    el.blockedShell.hidden = state.hasEditableData;
    el.exportBtn.disabled = !state.hasEditableData;
    renderTabs();
    renderDiagnostics();
    renderDiagnosticsStatus();
    renderStats();
    renderChanges();
    renderCompare();
    if (state.hasEditableData) {
      renderControls();
      renderCurve();
    } else {
      el.blockedMessage.textContent = state.packageInfo && state.packageInfo.hasDataAcd
        ? "This car has data.acd but no loose data folder. Use Content Manager's Unpack data action, then import the car folder again."
        : "No loose data folder was found. Import the generated data folder directly, or select a car folder only after unpacking data with Content Manager.";
    }
  }

  function renderStats() {
    const carDoc = state.docs.get("data/car.ini");
    const name = carDoc ? stripComment(getIniValue(carDoc, "INFO", "SCREEN_NAME") || "Unknown car").trim() : "Unknown car";
    el.carName.textContent = name && name !== "Unknown car" ? name : (state.packageInfo && state.packageInfo.carFolderName) || "Unknown car";
    el.fileCount.textContent = String(state.files.size);
    el.editedCount.textContent = String(countEditedFiles());
    el.warningCount.textContent = String(state.warnings.length);
    renderDiagnosticsStatus();
    renderWarningsList();
  }

  function renderWarningsList() {
    el.warningsList.innerHTML = "";
    if (!state.warnings.length) {
      const li = document.createElement("li");
      li.textContent = "No warnings.";
      el.warningsList.append(li);
    } else {
      for (const warning of state.warnings) {
        const li = document.createElement("li");
        li.textContent = warning;
        el.warningsList.append(li);
      }
    }
  }

  function renderDiagnosticsStatus() {
    el.diagnosticsStatusBtn.hidden = !state.files.size;
    if (!state.files.size) return;
    const status = diagnosticsStatus();
    el.diagnosticsStatusBtn.textContent = status.label;
    el.diagnosticsStatusBtn.className = `diagnostics-status ${status.className}`;
    el.diagnosticsStatusBtn.title = status.title;
  }

  function diagnosticsStatus() {
    if (state.packageInfo && state.packageInfo.status === "Needs Unpack") {
      return { label: "Needs Unpack", className: "warn", title: "Loose data is missing. Open diagnostics for unpacking guidance." };
    }
    if (state.packageInfo && state.packageInfo.status === "Possible Bad Import") {
      return { label: "Needs Attention", className: "bad", title: "The import does not look like editable Assetto Corsa data." };
    }
    if (state.warnings.length) {
      return { label: `${state.warnings.length} warning${state.warnings.length === 1 ? "" : "s"}`, className: "warn", title: "Open diagnostics to review validation warnings." };
    }
    return { label: "Ready", className: "ok", title: "Editable data is loaded with no validation warnings." };
  }

  function renderDiagnostics() {
    if (!state.packageInfo) {
      el.diagnosticsCard.innerHTML = "";
      return;
    }
    const info = state.packageInfo;
    const statusClass = info.status === "Ready to Edit" ? "ok" : info.status === "Needs Unpack" ? "warn" : "bad";
    const items = [
      ["Import", info.type],
      ["Status", info.status],
      ["Car", info.carFolderName],
      ["Loose data", info.hasData ? "Found" : "Missing"],
      ["Packed data.acd", info.hasDataAcd ? "Found" : "Not found"],
      ["Ignored files", info.ignoredCount ? `${info.ignoredCount} non-data files skipped` : "None"],
    ];
    el.diagnosticsCard.innerHTML = `
      <p class="label">Preflight</p>
      <h3 class="diag-status ${statusClass}">${info.status}</h3>
      <dl>${items.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
    `;
  }

  function renderChanges() {
    el.changesList.innerHTML = "";
    const changes = getChangeSummary();
    if (!changes.length) {
      const li = document.createElement("li");
      li.textContent = "No edits yet.";
      el.changesList.append(li);
      return;
    }
    for (const change of changes.slice(0, 12)) {
      const li = document.createElement("li");
      li.textContent = change;
      el.changesList.append(li);
    }
    if (changes.length > 12) {
      const li = document.createElement("li");
      li.textContent = `...and ${changes.length - 12} more changes.`;
      el.changesList.append(li);
    }
  }

  function renderCompare() {
    const comparisons = getComparisonSummary();
    fillList(el.compareList, comparisons, "No edited values yet.");
  }

  function renderControls() {
    const section = sections.find((item) => item.id === state.activeSection);
    el.activeSectionTitle.textContent = section ? section.label : "Editor";
    el.controls.innerHTML = "";
    const sectionControls = controls.filter((item) => item.section === state.activeSection);
    const grouped = groupControls(sectionControls);
    for (const [group, groupControlsList] of grouped) {
      const groupNode = document.createElement("section");
      groupNode.className = "control-group";
      const heading = document.createElement("h3");
      heading.textContent = group;
      const grid = document.createElement("div");
      grid.className = "control-grid";
      groupNode.append(heading, grid);
      for (const control of groupControlsList) {
        grid.append(createControlCard(control));
      }
      el.controls.append(groupNode);
    }
  }

  function createControlCard(control) {
      const node = el.template.content.cloneNode(true);
      const card = node.querySelector(".control");
      const label = node.querySelector(".control-label");
      const path = node.querySelector(".control-path");
      const top = node.querySelector(".control-top");
      const body = node.querySelector(".control-body");
      const help = node.querySelector(".control-help");
      label.textContent = control.label;
      path.textContent = `${control.file} [${control.iniSection}] ${control.key}`;
      help.textContent = control.help;
      top.append(createInfoButton(control));
      body.append(createControlInput(control));
      return card;
  }

  function groupControls(sectionControls) {
    const grouped = new Map();
    for (const control of sectionControls) {
      const group = getControlGroup(control);
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group).push(control);
    }
    const order = groupOrder[state.activeSection] || [];
    return [...grouped.entries()].sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  function getControlGroup(control) {
    if (control.section === "basics") {
      if (control.key === "SCREEN_NAME") return "Identity";
      if (control.key === "TOTALMASS") return "Chassis";
      if (control.key.includes("STEER")) return "Steering";
      return "Fuel";
    }
    if (control.section === "engine") {
      if (control.iniSection === "ENGINE_DATA") return "Rev Behavior";
      if (control.iniSection === "COAST_REF") return "Engine Braking";
      return "Damage";
    }
    if (control.section === "drivetrain") {
      if (control.iniSection === "GEARS") return "Gear Ratios";
      if (control.iniSection === "DIFFERENTIAL") return "Differential";
      return "Shift System";
    }
    if (control.section === "brakes") {
      if (control.key === "FRONT_SHARE") return "Brake Balance";
      return "Brake Force";
    }
    if (control.section === "suspension") {
      if (control.iniSection === "BASIC") return "Geometry";
      if (control.iniSection === "ARB") return "Anti-Roll Bars";
      if (control.key === "ROD_LENGTH") return "Ride Height";
      if (control.key === "STATIC_CAMBER") return "Alignment";
      if (control.key === "SPRING_RATE") return "Springs";
      return "Dampers";
    }
    if (control.section === "tyres") {
      if (control.key.includes("PRESSURE")) return "Pressures";
      return "Grip Balance";
    }
    if (control.section === "setup") {
      if (control.iniSection === "FRONT_BIAS") return "Brake Bias Range";
      if (control.iniSection.includes("PRESSURE")) return "Tire Pressures";
      if (control.iniSection.includes("ROD_LENGTH")) return "Ride Height";
      return "Alignment";
    }
    return "Controls";
  }

  function createInfoButton(control) {
    const wrapper = document.createElement("span");
    wrapper.className = "info-wrap";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "info-button";
    button.textContent = "i";
    button.setAttribute("aria-label", `About ${control.label}`);
    const panel = document.createElement("span");
    panel.className = "info-panel";
    panel.textContent = infoText[control.label] || control.help;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelectorAll(".info-wrap.open").forEach((item) => {
        if (item !== wrapper) item.classList.remove("open");
      });
      wrapper.classList.toggle("open");
    });
    wrapper.append(button, panel);
    return wrapper;
  }

  function createControlInput(control) {
    const disabled = !state.docs.has(`data/${control.file}`);
    if (control.type !== "number") {
      const input = document.createElement("input");
      input.className = "text-control";
      input.type = control.type;
      input.value = control.value;
      input.disabled = disabled;
      input.setAttribute("aria-label", control.label);
      input.addEventListener("input", () => updateControl(control, input.value));
      return input;
    }

    const wrapper = document.createElement("span");
    wrapper.className = "tuner-control";
    const range = document.createElement("input");
    const number = document.createElement("input");
    const rail = document.createElement("span");
    const min = document.createElement("span");
    const max = document.createElement("span");

    range.type = "range";
    range.min = control.min;
    range.max = control.max;
    range.step = "any";
    range.value = clampToRange(control.value, control.min, control.max);
    range.disabled = disabled;
    range.className = "slider";
    range.setAttribute("aria-label", `${control.label} slider`);

    number.type = "number";
    number.step = control.step;
    number.value = formatDisplayValue(control.value, control);
    number.disabled = disabled;
    number.className = "number-control";
    number.inputMode = "decimal";
    number.setAttribute("aria-label", `${control.label} value`);

    rail.className = "range-meta";
    min.textContent = formatRangeLabel(control.min);
    max.textContent = formatRangeLabel(control.max);
    rail.append(min, max);

    range.addEventListener("input", () => {
      number.value = formatDisplayValue(range.value, control);
      updateControl(control, range.value);
    });
    number.addEventListener("input", () => {
      const value = number.value;
      if (value !== "" && Number.isFinite(Number(value))) range.value = clampToRange(value, control.min, control.max);
      updateControl(control, value);
    });
    number.addEventListener("change", () => {
      number.value = formatDisplayValue(control.value, control);
    });

    wrapper.append(range, number, rail);
    return wrapper;
  }

  function renderCurve() {
    el.curveEditor.hidden = state.activeSection !== "engine" || !state.files.has("data/power.lut");
    el.curveRows.innerHTML = "";
    if (el.curveEditor.hidden) return;
    const rows = parseLut(state.values.get("data/power.lut") || "");
    state.curveRows = rows;
    updateTargetPeakControl();
    if (el.graphHint) el.graphHint.textContent = graphHintText();
    renderPowerGraph(state.curveRows);
    scheduleFrame(() => renderPowerGraph(state.curveRows));
    rows.forEach((row, index) => {
      const wrapper = document.createElement("label");
      wrapper.className = "curve-row";
      wrapper.dataset.curveIndex = String(index);
      const rpm = document.createElement("span");
      rpm.textContent = `${row.x} RPM`;
      const input = document.createElement("input");
      input.type = "number";
      input.step = "1";
      input.value = formatDisplayValue(row.y, { step: 1, min: 0, max: 99999 });
      input.className = "number-control";
      input.setAttribute("aria-label", `${row.x} RPM torque value`);
      input.addEventListener("input", () => {
        rows[index].y = input.value;
        setTextFile("data/power.lut", serializeLut(rows));
        state.curveRows = rows;
        renderPowerGraph(state.curveRows);
        validate();
        renderStats();
        renderChanges();
        renderCompare();
      });
      input.addEventListener("change", () => {
        input.value = formatDisplayValue(rows[index].y, { step: 1, min: 0, max: 99999 });
      });
      wrapper.append(rpm, input);
      el.curveRows.append(wrapper);
    });
  }

  function renderPowerGraph(rows) {
    const canvas = el.powerGraph;
    if (!canvas) return;
    const panel = canvas.closest(".dyno-panel");
    const panelRect = panel ? panel.getBoundingClientRect() : null;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.floor(rect.width || (panelRect && panelRect.width) || canvas.clientWidth || 760);
    const width = Math.max(360, cssWidth);
    const height = Math.max(300, Math.min(460, Math.floor(width * 0.42)));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = "100%";
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    renderPowerGraphSvg(rows, width, height);
    if (!ctx) return;
    try {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPowerGraph(ctx, rows, width, height, null);
    } catch (error) {
      console.warn("Canvas power graph failed; SVG graph is still available.", error);
    }
    attachPowerGraphEvents(canvas, rows);
  }

  function renderPowerGraphSvg(rows, width, height) {
    const svg = el.powerGraphSvg;
    if (!svg) return;
    const points = graphPoints(rows);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = "";
    if (!points.length) {
      svg.append(svgText(width / 2, height / 2, "No valid power.lut rows found.", "middle", "graph-empty"));
      return;
    }

    const chart = { left: 58, right: width - 58, top: 28, bottom: height - 80 };
    const maxRpm = Math.max(...points.map((point) => point.rpm), 1000);
    const maxTorque = niceMax(Math.max(...points.map((point) => point.displayTorque), 100));
    const maxPower = niceMax(Math.max(...points.map((point) => point.displayPower), 100));
    const yMax = graphYMax(maxTorque, maxPower);

    for (let i = 0; i <= 5; i += 1) {
      const value = (yMax / 5) * i;
      const y = mapValue(value, 0, yMax, chart.bottom, chart.top);
      svg.append(svgLine(chart.left, y, chart.right, y, "graph-grid"));
      svg.append(svgText(chart.left - 10, y + 4, String(Math.round(value)), "end", "graph-torque-label"));
      svg.append(svgText(chart.right + 10, y + 4, String(Math.round(value)), "start", "graph-power-label"));
    }

    const rpmStep = niceRpmStep(maxRpm);
    for (let rpm = 0; rpm <= maxRpm; rpm += rpmStep) {
      const x = mapValue(rpm, 0, maxRpm, chart.left, chart.right);
      svg.append(svgLine(x, chart.top, x, chart.bottom, "graph-grid graph-grid-v"));
      svg.append(svgText(x, chart.bottom + 22, String(rpm), "middle", "graph-axis-label"));
    }

    svg.append(svgRect(chart.left, chart.top, chart.right - chart.left, chart.bottom - chart.top, "graph-frame"));
    svg.append(svgText((chart.left + chart.right) / 2, height - 36, "RPM", "middle", "graph-axis-title"));

    const toPoint = (point, value) => `${mapValue(point.rpm, 0, maxRpm, chart.left, chart.right)},${mapValue(value, 0, yMax, chart.bottom, chart.top)}`;
    svg.append(svgPolyline(points.map((point) => toPoint(point, point.displayPower)).join(" "), "graph-power-line"));
    svg.append(svgPolyline(points.map((point) => toPoint(point, point.displayTorque)).join(" "), "graph-torque-line"));

    points.forEach((point) => {
      const cx = mapValue(point.rpm, 0, maxRpm, chart.left, chart.right);
      const value = activeGraphValue(point);
      const cy = mapValue(value, 0, yMax, chart.bottom, chart.top);
      svg.append(svgCircle(cx, cy, 5.5, `graph-point graph-point-${state.graphEditMode}`));
    });

    const peakTorque = points.reduce((best, point) => point.torque > best.torque ? point : best, points[0]);
    const peakPower = points.reduce((best, point) => point.power > best.power ? point : best, points[0]);
    svg.append(svgText(chart.left + 10, chart.top + 18, `Peak torque ${formatGraphNumber(displayTorque(peakTorque.torque))} ${torqueUnitLabel()} @ ${peakTorque.rpm} RPM`, "start", "graph-peak"));
    svg.append(svgText(chart.left + 10, chart.top + 38, `Peak power ${formatGraphNumber(displayPower(peakPower.power))} ${powerUnitLabel()} @ ${peakPower.rpm} RPM`, "start", "graph-peak"));
  }

  function drawPowerGraph(ctx, rows, width, height, activeIndex) {
    const points = graphPoints(rows);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#101311";
    ctx.fillRect(0, 0, width, height);
    if (!points.length) {
      ctx.fillStyle = "#a4aea6";
      ctx.font = "700 14px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No valid power.lut rows found.", width / 2, height / 2);
      return;
    }

    const chart = { left: 58, right: width - 58, top: 28, bottom: height - 80 };
    const maxRpm = Math.max(...points.map((point) => point.rpm), 1000);
    const maxTorque = niceMax(Math.max(...points.map((point) => point.displayTorque), 100));
    const maxPower = niceMax(Math.max(...points.map((point) => point.displayPower), 100));
    const yMax = graphYMax(maxTorque, maxPower);

    ctx.strokeStyle = "#29312c";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#a4aea6";
    ctx.font = "12px ui-monospace, Consolas, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 5; i += 1) {
      const value = (yMax / 5) * i;
      const y = mapValue(value, 0, yMax, chart.bottom, chart.top);
      ctx.beginPath();
      ctx.moveTo(chart.left, y);
      ctx.lineTo(chart.right, y);
      ctx.stroke();
      ctx.fillStyle = "#f4ea30";
      ctx.fillText(String(Math.round(value)), chart.left - 10, y);
      ctx.fillStyle = "#ff2f2f";
      ctx.textAlign = "left";
      ctx.fillText(String(Math.round(value)), chart.right + 10, y);
      ctx.textAlign = "right";
    }

    ctx.fillStyle = "#a4aea6";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const rpmStep = niceRpmStep(maxRpm);
    for (let rpm = 0; rpm <= maxRpm; rpm += rpmStep) {
      const x = mapValue(rpm, 0, maxRpm, chart.left, chart.right);
      ctx.strokeStyle = rpm === 0 ? "#505a52" : "#222923";
      ctx.beginPath();
      ctx.moveTo(x, chart.top);
      ctx.lineTo(x, chart.bottom);
      ctx.stroke();
      ctx.fillText(String(rpm), x, chart.bottom + 22);
    }

    ctx.strokeStyle = "#55615a";
    ctx.lineWidth = 1;
    ctx.strokeRect(chart.left, chart.top, chart.right - chart.left, chart.bottom - chart.top);
    ctx.fillStyle = "#a4aea6";
    ctx.fillText("RPM", (chart.left + chart.right) / 2, height - 36);
    ctx.save();
    ctx.translate(18, (chart.top + chart.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#f4ea30";
    ctx.fillText(`Torque (${torqueUnitLabel()})`, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(width - 18, (chart.top + chart.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#ff2f2f";
    ctx.fillText(`Power (${powerUnitLabel()})`, 0, 0);
    ctx.restore();

    const toCanvas = (point, value) => ({
      x: mapValue(point.rpm, 0, maxRpm, chart.left, chart.right),
      y: mapValue(value, 0, yMax, chart.bottom, chart.top),
    });
    drawGraphLine(ctx, points.map((point) => toCanvas(point, point.displayPower)), "#ff2525", 3);
    drawGraphLine(ctx, points.map((point) => toCanvas(point, point.displayTorque)), "#f4ea30", 3);

    points.forEach((point, index) => {
      const pos = toCanvas(point, activeGraphValue(point));
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, activeIndex === index ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = activeIndex === index ? "#ffffff" : state.graphEditMode === "power" ? "#ff2525" : "#f4ea30";
      ctx.fill();
      ctx.strokeStyle = "#101311";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.fillStyle = "#d2d9d4";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "700 13px ui-sans-serif, system-ui, sans-serif";
    const peakTorque = points.reduce((best, point) => point.torque > best.torque ? point : best, points[0]);
    const peakPower = points.reduce((best, point) => point.power > best.power ? point : best, points[0]);
    ctx.fillText(`Peak torque ${formatGraphNumber(displayTorque(peakTorque.torque))} ${torqueUnitLabel()} @ ${peakTorque.rpm} RPM`, chart.left + 10, chart.top + 10);
    ctx.fillText(`Peak power ${formatGraphNumber(displayPower(peakPower.power))} ${powerUnitLabel()} @ ${peakPower.rpm} RPM`, chart.left + 10, chart.top + 30);

    canvasGraphMeta.set(ctx.canvas, { chart, maxRpm, yMax, points });
  }

  function attachPowerGraphEvents(canvas, rows) {
    let activeIndex = null;
    const ctx = canvas.getContext("2d");
    canvas.onpointerdown = (event) => {
      const meta = canvasGraphMeta.get(canvas);
      if (!meta) return;
      activeIndex = nearestPointIndex(meta, canvasPoint(canvas, event));
      canvas.setPointerCapture(event.pointerId);
      updateGraphDrag(canvas, rows, activeIndex, event);
    };
    canvas.onpointermove = (event) => {
      if (activeIndex == null) return;
      updateGraphDrag(canvas, rows, activeIndex, event);
    };
    canvas.onpointerup = (event) => {
      canvas.releasePointerCapture(event.pointerId);
      activeIndex = null;
      const meta = canvasGraphMeta.get(canvas);
      if (meta) renderPowerGraph(rows);
      if (el.graphHint) el.graphHint.textContent = graphHintText();
    };
    canvas.onpointercancel = canvas.onpointerup;
  }

  function updateGraphDrag(canvas, rows, index, event) {
    const meta = canvasGraphMeta.get(canvas);
    if (!meta || index == null || !rows[index]) return;
    const point = canvasPoint(canvas, event);
    const activeValue = Math.max(0, mapValue(point.y, meta.chart.bottom, meta.chart.top, 0, meta.yMax));
    const rpm = Number(rows[index].x);
    if (state.graphEditMode === "power" && (!Number.isFinite(rpm) || rpm <= 0)) {
      if (el.graphHint) el.graphHint.textContent = "Power is always 0 at 0 RPM; edit this point in torque mode.";
      return;
    }
    const torque = state.graphEditMode === "power"
      ? torqueFromDisplayPower(activeValue, rpm)
      : torqueFromDisplayTorque(activeValue);
    rows[index].y = String(Math.max(0, Math.round(torque)));
    const input = el.curveRows.querySelector(`[data-curve-index="${index}"] input`);
    if (input) input.value = formatDisplayValue(rows[index].y, { step: 1, min: 0, max: 99999 });
    setTextFile("data/power.lut", serializeLut(rows));
    state.curveRows = rows;
    validate();
    renderStats();
    renderChanges();
    renderCompare();
    const ctx = canvas.getContext("2d");
    if (ctx) drawPowerGraph(ctx, rows, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1), index);
    if (el.graphHint) {
      const points = graphPoints(rows);
      const displayPoint = points[index];
      const value = displayPoint ? activeGraphValue(displayPoint) : Number(rows[index].y);
      el.graphHint.textContent = `${rows[index].x} RPM: ${formatGraphNumber(value)} ${activeGraphUnitLabel()}`;
    }
  }

  const canvasGraphMeta = new WeakMap();

  function setGraphEditMode(mode) {
    state.graphEditMode = mode === "power" ? "power" : "torque";
    el.editTorqueBtn.setAttribute("aria-pressed", String(state.graphEditMode === "torque"));
    el.editPowerBtn.setAttribute("aria-pressed", String(state.graphEditMode === "power"));
    updateTargetPeakControl();
    if (el.graphHint) el.graphHint.textContent = graphHintText();
    renderPowerGraph(state.curveRows);
  }

  function updateTargetPeakControl() {
    if (!el.targetPeakInput || !el.targetPeakLabel) return;
    const points = graphPoints(state.curveRows);
    const modeLabel = state.graphEditMode === "power" ? "power" : "torque";
    const unit = activeGraphUnitLabel();
    const peak = peakActiveValue(points);
    const labelText = `Target peak ${modeLabel}`;
    el.targetPeakLabel.firstChild.nodeValue = `${labelText} `;
    el.targetPeakInput.placeholder = peak ? `${formatGraphNumber(peak)} ${unit}` : unit;
    el.targetPeakInput.title = `Scale the full curve to this peak ${modeLabel} value.`;
  }

  function applyTargetPeak() {
    const target = Number(el.targetPeakInput.value);
    if (!Number.isFinite(target) || target <= 0 || !state.curveRows.length) {
      el.targetPeakInput.value = "";
      return;
    }
    const rows = scaleRowsToTargetPeak(state.curveRows, target);
    state.curveRows = rows;
    setTextFile("data/power.lut", serializeLut(rows));
    validate();
    renderStats();
    renderChanges();
    renderCompare();
    renderCurve();
    el.targetPeakInput.value = "";
  }

  function scaleRowsToTargetPeak(rows, target) {
    const points = graphPoints(rows);
    const currentPeak = peakActiveValue(points);
    if (!currentPeak) return rows;
    const ratio = target / currentPeak;
    return rows.map((row) => {
      const torque = Number(row.y);
      if (!Number.isFinite(torque)) return row;
      return { ...row, y: String(Math.max(0, Math.round(torque * ratio))) };
    });
  }

  function peakActiveValue(points) {
    if (!points.length) return 0;
    return Math.max(...points.map((point) => activeGraphValue(point)));
  }

  function activeGraphValue(point) {
    return state.graphEditMode === "power" ? point.displayPower : point.displayTorque;
  }

  function activeGraphUnitLabel() {
    return state.graphEditMode === "power" ? powerUnitLabel() : torqueUnitLabel();
  }

  function graphHintText() {
    return `Drag ${state.graphEditMode} points to shape the curve.`;
  }

  function displayTorque(valueNm) {
    return state.torqueUnit === "lbft" ? valueNm * 0.7375621493 : valueNm;
  }

  function torqueFromDisplayTorque(value) {
    return state.torqueUnit === "lbft" ? value / 0.7375621493 : value;
  }

  function displayPower(valueHp) {
    if (state.powerUnit === "kw") return valueHp * 0.745699872;
    if (state.powerUnit === "ps") return valueHp * 1.013869665;
    return valueHp;
  }

  function torqueFromDisplayPower(value, rpm) {
    if (!Number.isFinite(rpm) || rpm <= 0) return 0;
    let hp = value;
    if (state.powerUnit === "kw") hp = value / 0.745699872;
    if (state.powerUnit === "ps") hp = value / 1.013869665;
    return hp * 7127 / rpm;
  }

  function torqueUnitLabel() {
    return state.torqueUnit === "lbft" ? "lb-ft" : "Nm";
  }

  function powerUnitLabel() {
    if (state.powerUnit === "kw") return "kW";
    if (state.powerUnit === "ps") return "PS";
    return "HP";
  }

  function formatGraphNumber(value) {
    if (!Number.isFinite(value)) return "0";
    if (Math.abs(value) >= 100) return String(Math.round(value));
    return trimTrailingZeros(value.toFixed(1));
  }

  function graphPoints(rows) {
    return rows.map((row) => {
      const rpm = Number(row.x);
      const torque = Number(row.y);
      if (!Number.isFinite(rpm) || !Number.isFinite(torque)) return null;
      const power = rpm * torque / 7127;
      return { rpm, torque, power, displayTorque: displayTorque(torque), displayPower: displayPower(power) };
    }).filter(Boolean);
  }

  function drawGraphLine(ctx, points, color, width) {
    if (!points.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  }

  function nearestPointIndex(meta, point) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    meta.points.forEach((candidate, index) => {
      const x = mapValue(candidate.rpm, 0, meta.maxRpm, meta.chart.left, meta.chart.right);
      const y = mapValue(activeGraphValue(candidate), 0, meta.yMax, meta.chart.bottom, meta.chart.top);
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function canvasPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function mapValue(value, inMin, inMax, outMin, outMax) {
    if (inMax === inMin) return outMin;
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
  }

  function niceMax(value) {
    if (!Number.isFinite(value) || value <= 0) return 100;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    return Math.ceil(value / pow * 2) / 2 * pow;
  }

  function graphYMax(maxTorque, maxPower) {
    const auto = Math.max(maxTorque, maxPower);
    if (el.graphAutoScale && !el.graphAutoScale.checked) {
      const manual = Number(el.graphYMaxInput.value || state.graphYMax);
      if (Number.isFinite(manual) && manual > 0) return Math.max(manual, 10);
    }
    return auto;
  }

  function niceRpmStep(maxRpm) {
    if (maxRpm <= 4000) return 500;
    if (maxRpm <= 9000) return 1000;
    return 2000;
  }

  function svgNode(name, attributes) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function svgLine(x1, y1, x2, y2, className) {
    return svgNode("line", { x1, y1, x2, y2, class: className });
  }

  function svgRect(x, y, width, height, className) {
    return svgNode("rect", { x, y, width, height, class: className });
  }

  function svgCircle(cx, cy, r, className) {
    return svgNode("circle", { cx, cy, r, class: className });
  }

  function svgPolyline(points, className) {
    return svgNode("polyline", { points, class: className });
  }

  function svgText(x, y, text, anchor, className) {
    const node = svgNode("text", { x, y, "text-anchor": anchor, class: className });
    node.textContent = text;
    return node;
  }

  function updateControl(control, value) {
    control.value = value;
    const path = `data/${control.file}`;
    const doc = state.docs.get(path);
    if (!doc) return;
    setIniValue(doc, control.iniSection, control.key, value);
    const text = serializeIni(doc);
    setTextFile(path, text);
    if (isMaxFuelControl(control)) syncSetupFuelMax(value);
    validate();
    renderStats();
    renderChanges();
    renderCompare();
  }

  function isMaxFuelControl(control) {
    return control.file === "car.ini" && control.iniSection === "FUEL" && control.key === "MAX_FUEL";
  }

  function syncSetupFuelMax(value) {
    const setupPath = "data/setup.ini";
    const setupDoc = state.docs.get(setupPath);
    if (!setupDoc) return;
    setIniValue(setupDoc, "FUEL", "MAX", value);
    setTextFile(setupPath, serializeIni(setupDoc));
  }

  function clampToRange(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return String(Math.min(max, Math.max(min, number)));
  }

  function formatRangeLabel(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    if (Math.abs(number) >= 1000) return number.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return String(value);
  }

  function formatDisplayValue(value, control) {
    const number = Number(value);
    if (!Number.isFinite(number)) return value == null ? "" : String(value);
    if (shouldDisplayInteger(control, number)) return String(Math.round(number));
    return trimTrailingZeros(number.toFixed(3));
  }

  function shouldDisplayInteger(control, value) {
    const step = Number(control && control.step);
    const max = Number(control && control.max);
    return Math.abs(value) >= 1000 || Math.abs(max) >= 1000 || step >= 1;
  }

  function trimTrailingZeros(value) {
    return value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  }

  function setTextFile(path, text) {
    state.values.set(path, text);
    state.files.set(path, textEncoder.encode(text));
    if (path.toLowerCase().endsWith(".ini")) state.docs.set(path, parseIni(text));
  }

  function resetChangedValues() {
    state.files = new Map(state.originals);
    state.docs.clear();
    state.values.clear();
    for (const [path, bytes] of state.files) {
      if (isTextPath(path)) {
        const text = textDecoder.decode(bytes);
        if (path.toLowerCase().endsWith(".ini")) state.docs.set(path, parseIni(text));
        state.values.set(path, text);
      }
    }
    hydrateValues();
    validate();
    render();
  }

  function validate() {
    const warnings = [];
    if (state.packageInfo) {
      if (!state.packageInfo.hasData && state.packageInfo.hasDataAcd) warnings.push("Needs Unpack: data.acd is present, but no loose data folder was found.");
      if (!state.packageInfo.hasData && !state.packageInfo.hasDataAcd) warnings.push("Possible Bad Import: no data folder or data.acd was found.");
      if (state.packageInfo.nestedData) warnings.push("Possible nested folder issue: a data folder appears below another root. Import the actual car folder or data folder.");
      if (state.packageInfo.ignoredCount) warnings.push(`${state.packageInfo.ignoredCount} non-data files were ignored to keep the editor fast and data-only.`);
    }
    if (!state.hasEditableData) {
      state.warnings = warnings;
      return;
    }
    for (const required of ["data/car.ini", "data/engine.ini", "data/drivetrain.ini", "data/brakes.ini", "data/suspensions.ini", "data/tyres.ini"]) {
      if (!state.files.has(required)) warnings.push(`Missing ${required}. Related controls are disabled or incomplete.`);
    }
    for (const control of controls) {
      if (!state.docs.has(`data/${control.file}`)) continue;
      if (control.value === "") warnings.push(`${control.label} is missing.`);
      if (control.type === "number") {
        const number = Number(control.value);
        if (!Number.isFinite(number)) warnings.push(`${control.label} must be numeric.`);
        else if (number < control.min || number > control.max) warnings.push(`${control.label} is outside the guided range ${control.min}-${control.max}.`);
      }
    }
    const idle = numericValue("engine.ini", "ENGINE_DATA", "MINIMUM");
    const limiter = numericValue("engine.ini", "ENGINE_DATA", "LIMITER");
    if (idle && limiter && limiter <= idle) warnings.push("Rev limiter must be higher than idle RPM.");
    const fuel = numericValue("car.ini", "FUEL", "FUEL");
    const maxFuel = numericValue("car.ini", "FUEL", "MAX_FUEL");
    if (fuel != null && maxFuel != null && fuel > maxFuel) warnings.push("Default fuel level is higher than max fuel level.");
    const setupFuelMin = numericValue("setup.ini", "FUEL", "MIN");
    const setupFuelMax = numericValue("setup.ini", "FUEL", "MAX");
    if (setupFuelMin != null && maxFuel != null && setupFuelMin > maxFuel) warnings.push("Minimum selectable fuel is higher than max fuel level.");
    if (setupFuelMax != null && maxFuel != null && setupFuelMax !== maxFuel) warnings.push("Setup fuel maximum differs from tank capacity. Editing Max fuel level will sync them.");
    const gearCount = numericValue("drivetrain.ini", "GEARS", "COUNT");
    if (gearCount) {
      for (let i = 1; i <= gearCount; i += 1) {
        if (getIniValue(state.docs.get("data/drivetrain.ini"), "GEARS", `GEAR_${i}`) == null) warnings.push(`GEARS count expects GEAR_${i}.`);
      }
    }
    warnings.push(...validatePowerLut());
    warnings.push(...validateReferencedFiles());
    warnings.push(...validateTyres());
    warnings.push(...validateSetupTargets());
    state.warnings = warnings;
  }

  function validatePowerLut() {
    if (!state.files.has("data/power.lut")) return ["Missing data/power.lut. Engine graph and torque curve editing are unavailable."];
    const rows = parseLut(state.values.get("data/power.lut") || "");
    const warnings = [];
    if (rows.length < 2) warnings.push("power.lut should contain at least two RPM|torque rows.");
    let previous = -Infinity;
    for (const row of rows) {
      const rpm = Number(row.x);
      const torque = Number(row.y);
      if (!Number.isFinite(rpm) || !Number.isFinite(torque)) warnings.push(`power.lut has a malformed row: ${row.x}|${row.y}`);
      if (Number.isFinite(rpm) && rpm < previous) warnings.push("power.lut RPM values should be sorted from low to high.");
      if (Number.isFinite(rpm)) previous = rpm;
    }
    const limiter = numericValue("engine.ini", "ENGINE_DATA", "LIMITER");
    const maxRpm = Math.max(...rows.map((row) => Number(row.x)).filter(Number.isFinite), 0);
    if (limiter && maxRpm && limiter > maxRpm + 750) warnings.push("Rev limiter is far beyond the last power.lut RPM point. Add curve rows or lower the limiter.");
    return [...new Set(warnings)];
  }

  function validateReferencedFiles() {
    const warnings = [];
    const pattern = /(?:^|=)\s*([A-Za-z0-9_.-]+\.(?:lut|ini|ksanim|bank|wav))/gim;
    for (const [path, text] of state.values) {
      if (!path.startsWith("data/")) continue;
      let match;
      while ((match = pattern.exec(text))) {
        const ref = match[1];
        if (/^(FROM_|none$|0$)/i.test(ref)) continue;
        if (!state.files.has(`data/${ref}`) && !state.files.has(ref)) warnings.push(`${path} references missing file ${ref}.`);
      }
    }
    return [...new Set(warnings)];
  }

  function validateTyres() {
    const doc = state.docs.get("data/tyres.ini");
    if (!doc) return [];
    const warnings = [];
    for (const section of ["FRONT", "REAR"]) {
      if (!doc.sections.has(section)) warnings.push(`tyres.ini is missing [${section}] section.`);
      const shortName = stripComment(getIniValue(doc, section, "SHORT_NAME") || "").trim();
      if (shortName.includes(" ")) warnings.push(`tyres.ini [${section}] SHORT_NAME contains spaces, which can cause setup/server issues.`);
      for (const key of ["WEAR_CURVE", "PERFORMANCE_CURVE"]) {
        const ref = stripComment(getIniValue(doc, section, key) || "").trim();
        if (ref && !state.files.has(`data/${ref}`)) warnings.push(`tyres.ini [${section}] ${key} references missing ${ref}.`);
      }
    }
    return [...new Set(warnings)];
  }

  function validateSetupTargets() {
    const setup = state.docs.get("data/setup.ini");
    if (!setup) return [];
    const warnings = [];
    const knownSetupSections = new Set(["PRESSURE_LF", "PRESSURE_RF", "PRESSURE_LR", "PRESSURE_RR", "ROD_LENGTH_LF", "ROD_LENGTH_RF", "ROD_LENGTH_LR", "ROD_LENGTH_RR", "ARB_REAR", "ARB_FRONT", "CAMBER_LF", "CAMBER_RF", "CAMBER_LR", "CAMBER_RR", "TOE_OUT_LF", "TOE_OUT_RF", "TOE_OUT_LR", "TOE_OUT_RR", "FUEL", "FRONT_BIAS", "BRAKE_POWER_MULT"]);
    for (const section of setup.sections.keys()) {
      if (section === "DISPLAY_METHOD") continue;
      if (!knownSetupSections.has(section) && !/^WING_\d+$/i.test(section) && !/^DAMP_/.test(section)) warnings.push(`setup.ini contains unsupported or unrecognized setup item [${section}].`);
    }
    return warnings;
  }

  function numericValue(file, section, key) {
    const doc = state.docs.get(`data/${file}`);
    const value = doc && getIniValue(doc, section, key);
    const number = Number(stripComment(value || "").trim());
    return Number.isFinite(number) ? number : null;
  }

  function countEditedFiles() {
    let count = 0;
    for (const [path, bytes] of state.files) {
      const original = state.originals.get(path);
      if (!original || !sameBytes(bytes, original)) count += 1;
    }
    return count;
  }

  function getChangeSummary() {
    const changes = [];
    for (const control of controls) {
      if (control.value !== control.originalValue) changes.push(`${control.file}: ${control.label} ${control.originalValue || "(blank)"} -> ${control.value || "(blank)"}`);
    }
    if (state.files.has("data/power.lut") && state.originals.has("data/power.lut") && !sameBytes(state.files.get("data/power.lut"), state.originals.get("data/power.lut"))) {
      changes.push("power.lut: torque curve changed");
    }
    for (const [path, bytes] of state.files) {
      if (!state.originals.has(path)) changes.push(`${path}: added`);
      else if (!sameBytes(bytes, state.originals.get(path)) && !changes.some((change) => change.startsWith(path))) changes.push(`${path}: changed`);
    }
    return changes;
  }

  function getComparisonSummary() {
    const summary = [];
    const important = ["Total mass (kg)", "Rev limiter", "Final drive", "Diff power lock", "Front brake share", "Front ARB", "Rear ARB", "Front spring rate", "Rear spring rate", "Front lateral grip", "Rear lateral grip"];
    for (const label of important) {
      const control = controls.find((item) => item.label === label);
      if (control && control.value !== control.originalValue) summary.push(`${label}: ${control.originalValue || "(blank)"} -> ${control.value || "(blank)"}`);
    }
    const originalPower = state.originals.has("data/power.lut") ? parseLut(textDecoder.decode(state.originals.get("data/power.lut"))) : [];
    const currentPower = state.files.has("data/power.lut") ? parseLut(state.values.get("data/power.lut") || "") : [];
    const oldPeak = peakCurveStats(originalPower);
    const newPeak = peakCurveStats(currentPower);
    if (oldPeak && newPeak && (Math.round(oldPeak.torque) !== Math.round(newPeak.torque) || Math.round(oldPeak.power) !== Math.round(newPeak.power))) {
      summary.push(`Peak torque: ${formatGraphNumber(displayTorque(oldPeak.torque))} -> ${formatGraphNumber(displayTorque(newPeak.torque))} ${torqueUnitLabel()}`);
      summary.push(`Peak power: ${formatGraphNumber(displayPower(oldPeak.power))} -> ${formatGraphNumber(displayPower(newPeak.power))} ${powerUnitLabel()}`);
    }
    return summary;
  }

  function peakCurveStats(rows) {
    const points = graphPoints(rows);
    if (!points.length) return null;
    return points.reduce((best, point) => {
      const bestScore = Math.max(best.torque, best.power);
      const pointScore = Math.max(point.torque, point.power);
      return pointScore > bestScore ? point : best;
    }, points[0]);
  }

  function dataOnlyFiles() {
    const output = new Map();
    for (const [path, bytes] of state.files) {
      if (path.startsWith("data/")) output.set(path, bytes);
    }
    output.set("README_EDITED_CAR.txt", textEncoder.encode(editedReadme("data folder export")));
    return output;
  }

  function editedReadme(exportType) {
    const changes = getChangeSummary();
    return [
      "Assetto Corsa Edited Car Data",
      "",
      `Export type: ${exportType}`,
      `Generated by: Assetto Corsa Guided Data Editor`,
      "",
      "IMPORTANT SAFETY NOTES",
      "- Back up the original car folder before replacing any files.",
      "- Edited physics data will likely fail online server checksum checks unless the server and every client use the exact same files.",
      "- If Assetto Corsa still uses data.acd, loose data folder edits may be ignored until you unpack/enable loose data through Content Manager.",
      "- This tool does not repack data.acd.",
      "",
      "CHANGED ITEMS",
      ...(changes.length ? changes.map((change) => `- ${change}`) : ["- No supported editor changes were detected."]),
      "",
    ].join("\n");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function parseIni(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const doc = { lines: [], sections: new Map() };
    let current = "";
    lines.forEach((raw) => {
      const sectionMatch = raw.match(/^\s*\[([^\]]+)\]\s*$/);
      const entry = { raw, section: current, key: null, value: null };
      if (sectionMatch) {
        current = sectionMatch[1];
        entry.sectionHeader = current;
        if (!doc.sections.has(current)) doc.sections.set(current, []);
      } else {
        const keyMatch = raw.match(/^([^=;\s][^=]*?)\s*=(.*)$/);
        if (keyMatch) {
          entry.section = current;
          entry.key = keyMatch[1].trim();
          entry.value = keyMatch[2];
          if (!doc.sections.has(current)) doc.sections.set(current, []);
          doc.sections.get(current).push(entry);
        }
      }
      doc.lines.push(entry);
    });
    return doc;
  }

  function getIniValue(doc, section, key) {
    if (!doc) return null;
    const entries = doc.sections.get(section) || [];
    const entry = entries.find((item) => item.key === key);
    return entry ? entry.value : null;
  }

  function setIniValue(doc, section, key, value) {
    if (!doc.sections.has(section)) {
      doc.lines.push({ raw: "", section: "" }, { raw: `[${section}]`, sectionHeader: section, section });
      doc.sections.set(section, []);
    }
    const entries = doc.sections.get(section);
    let entry = entries.find((item) => item.key === key);
    if (!entry) {
      entry = { raw: `${key}=${value}`, section, key, value: String(value) };
      const insertAt = findSectionEnd(doc, section);
      doc.lines.splice(insertAt, 0, entry);
      entries.push(entry);
      return;
    }
    const comment = commentSuffix(entry.value);
    entry.value = `${value}${comment}`;
    entry.raw = `${key}=${entry.value}`;
  }

  function findSectionEnd(doc, section) {
    let seen = false;
    for (let i = 0; i < doc.lines.length; i += 1) {
      const line = doc.lines[i];
      if (line.sectionHeader === section) seen = true;
      else if (seen && line.sectionHeader) return i;
    }
    return doc.lines.length;
  }

  function serializeIni(doc) {
    return doc.lines.map((line) => line.key ? `${line.key}=${line.value}` : line.raw).join("\n");
  }

  function stripComment(value) {
    return String(value == null ? "" : value).split(";")[0];
  }

  function commentSuffix(value) {
    const index = String(value).indexOf(";");
    return index >= 0 ? ` ${String(value).slice(index)}` : "";
  }

  function parseLut(text) {
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [x, y] = line.split("|");
      return { x: x == null ? "" : x.trim(), y: y == null ? "" : y.trim() };
    });
  }

  function serializeLut(rows) {
    return rows.map((row) => `${row.x}|${row.y}`).join("\n") + "\n";
  }

  function toDataPath(path) {
    const normalized = normalizePath(path);
    const parts = normalized.split("/");
    const dataIndex = parts.lastIndexOf("data");
    if (dataIndex >= 0) return parts.slice(dataIndex).join("/");
    const name = parts[parts.length - 1];
    return name ? `data/${name}` : null;
  }

  function normalizePath(path) {
    return path.replace(/\\/g, "/").replace(/^\/+/, "");
  }

  function isTextPath(path) {
    return /\.(ini|lut|rto)$/i.test(path);
  }

  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
    return true;
  }

  async function exportZip() {
    if (!state.hasEditableData) return;
    const zipBytes = createZip(dataOnlyFiles());
    const blob = new Blob([zipBytes], { type: "application/zip" });
    const name = (el.carName.textContent || "assetto-car").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "assetto-car";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name}-data.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
    closeExportModal();
  }

  function createZip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const [path, data] of [...files.entries()].sort()) {
      const name = textEncoder.encode(path);
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint32(10, dosDateTime(), true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, name.length, true);
      local.set(name, 30);
      chunks.push(local, data);

      const entry = new Uint8Array(46 + name.length);
      const ev = new DataView(entry.buffer);
      ev.setUint32(0, 0x02014b50, true);
      ev.setUint16(4, 20, true);
      ev.setUint16(6, 20, true);
      ev.setUint16(8, 0, true);
      ev.setUint16(10, 0, true);
      ev.setUint32(12, dosDateTime(), true);
      ev.setUint32(16, crc, true);
      ev.setUint32(20, data.length, true);
      ev.setUint32(24, data.length, true);
      ev.setUint16(28, name.length, true);
      ev.setUint32(42, offset, true);
      entry.set(name, 46);
      central.push(entry);
      offset += local.length + data.length;
    }
    const centralSize = central.reduce((sum, item) => sum + item.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, central.length, true);
    endView.setUint16(10, central.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    return concatBytes([...chunks, ...central, end]);
  }

  async function readZip(bytes) {
    const entries = [];
    let offset = 0;
    while (offset < bytes.length - 4) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
      if (view.getUint32(0, true) !== 0x04034b50) break;
      const flags = view.getUint16(6, true);
      const method = view.getUint16(8, true);
      const compressedSize = view.getUint32(18, true);
      const uncompressedSize = view.getUint32(22, true);
      const nameLength = view.getUint16(26, true);
      const extraLength = view.getUint16(28, true);
      if (flags & 0x08) throw new Error("Zip entries using data descriptors are not supported in this lightweight importer.");
      const nameStart = offset + 30;
      const name = normalizePath(textDecoder.decode(bytes.slice(nameStart, nameStart + nameLength)));
      const dataStart = nameStart + nameLength + extraLength;
      if (!name.endsWith("/")) entries.push({ name, dataStart, compressedSize, uncompressedSize, method });
      offset = dataStart + compressedSize;
    }

    const root = detectImportRoot(entries.map((entry) => entry.name), "zip");
    const files = new Map();
    for (const entry of entries) {
      const path = normalizeRelevantPath(entry.name, root);
      if (!isRelevantImportPath(path)) continue;
      const compressed = bytes.slice(entry.dataStart, entry.dataStart + entry.compressedSize);
      let data;
      if (entry.method === 0) data = compressed;
      else if (entry.method === 8) data = await inflateRaw(compressed, entry.uncompressedSize);
      else throw new Error(`Unsupported zip compression method ${entry.method}.`);
      files.set(path, data);
    }
    state.ignoredFileCount = Math.max(0, entries.length - files.size);
    if (!files.size && entries.length) files.set("__IMPORT_INFO__.txt", textEncoder.encode("No data folder or data.acd was found in the zip."));
    return files;
  }

  async function inflateRaw(bytes, expectedSize) {
    if (!("DecompressionStream" in window)) throw new Error("This browser cannot decompress zip files. Import the unpacked data folder instead.");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const data = new Uint8Array(await new Response(stream).arrayBuffer());
    if (expectedSize && data.length !== expectedSize) throw new Error("Decompressed zip entry size did not match its header.");
    return data;
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }

  function dosDateTime() {
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const date = ((now.getFullYear() - 1980) << 25) | ((now.getMonth() + 1) << 21) | (now.getDate() << 16);
    return date | time;
  }

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
})();
