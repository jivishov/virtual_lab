// en.js - English translations (reference/default)
export default {
    // ==========================================
    // UI LABELS
    // ==========================================
    ui: {
        // Page title
        pageTitle: "AP Chem: Copper Analysis Lab",

        // Sidebar
        labEquipment: "Lab Equipment",

        // Step tracker
        stepOf: "Step {current} / {total}",
        brassLab: "Brass Lab",
        undo: "Undo (max 10)",
        autoForward: "Auto-forward",
        toggleList: "Toggle list",
        complete: "Complete!",

        // Notebook
        labNotebook: "Lab Notebook",
        sampleData: "1. Sample Data",
        massBrass: "Mass Brass",
        condition: "Condition",
        spectrophotometry: "2. Spectrophotometry",
        sample: "Sample",
        abs: "Abs",
        calibrationCurve: "Calibration Curve (Abs vs Conc)",

        // Cleaning checklist
        cleanupChecklist: "Lab Cleanup Checklist:",
        cleanupItem1: "Discard liquid from all cuvettes into waste beaker",
        cleanupItem2: "Rinse cuvettes with d.water at least 3 times",
        cleanupItem3: "Discard all pipettes into waste beaker",
        cleanupItem4: "Wash hands",
        completeCleanup: "Complete Cleanup",

        // Calculation area
        calcMassPercent: "Calc Mass % Cu:",
        showHint: "Show Hint",
        hideHint: "Hide Hint",
        formulaTitle: "Formula:",
        formulaConc: "Conc = (Abs + 0.00538) / 2.426",
        formulaMass: "Mass % Cu = (Conc x 0.100L x 63.55) / brass mass x 100",
        check: "Check",
        percentPlaceholder: "%"
    },

    // ==========================================
    // EQUIPMENT LABELS (Shelf)
    // ==========================================
    equipment: {
        balance: "Balance",
        brass: "Brass Sample",
        pipette: "Pipette",
        waste: "Waste Beaker",
        beaker: "50 mL Beaker",
        acid: "Conc. HNO₃",
        flask: "100 mL Flask",
        water: "Dist. Water",
        spec: "Spec 20",
        rack: "Cuvette Rack",
        cuvette: "Cuvette",
        std1: "0.1 M Std",
        std2: "0.2 M Std",
        std4: "0.4 M Std"
    },

    // ==========================================
    // CONTENT/SOLUTION LABELS
    // ==========================================
    content: {
        acid: "HNO₃",
        water: "H₂O",
        copper: "Cu²⁺",
        std01: "0.1M",
        std02: "0.2M",
        std04: "0.4M",
        unknown: "Unk",
        blank: "Blank"
    },

    // ==========================================
    // GRAPHICS/SVG TEXT
    // ==========================================
    graphics: {
        getCuvette: "GET CUVETTE",
        waste: "WASTE",
        pipettes: "{count} pipette(s)",
        lid: "LID",
        open: "OPEN",
        beakerLabel: "50ml"
    },

    // ==========================================
    // GRAPH LABELS
    // ==========================================
    graph: {
        concentration: "Conc (M)",
        absorbance: "Abs",
        unknown: "Unk",
        standards: "Std",
        fit: "Fit"
    },

    // ==========================================
    // CONDITIONS
    // ==========================================
    conditions: {
        solid: "Solid",
        dissolved: "Dissolved"
    },

    // ==========================================
    // FEEDBACK MESSAGES
    // ==========================================
    messages: {
        // General
        welcome: "Welcome! Follow the instructions to complete the lab.",
        labComplete: "Lab complete! No more steps.",
        nothingToUndo: "Nothing to undo.",
        undoSuccessful: "Undo successful.",
        invalidInteraction: "Invalid interaction. Check the current instruction.",
        enterNumeric: "Enter a numeric value.",

        // Equipment placement
        alreadyPlaced: "This equipment is already on the workbench.",
        equipmentPlaced: "{equipment} placed on workbench.",
        wrongEquipment: "Place {expected}, not this item.",

        // Brass weighing
        dragBrassToBalance: "Drag the Brass Sample to the Balance.",
        dropOnBalance: "Drop the brass on the Balance.",
        brassMassRecorded: "Brass mass: {mass} g recorded.",

        // Brass transfer
        dragBrassSample: "Drag the Brass Sample.",
        dropIntoBeaker: "Drop the brass into the Beaker.",
        weighFirst: "Weigh the brass first!",
        brassTransferred: "Brass transferred to beaker.",

        // Pipette operations
        usePipetteToFill: "Use a Pipette to fill.",
        sourceNotFound: "Source container not found.",
        pipetteAlreadyFull: "Pipette is already full. Empty it first.",
        fillFromBeaker: "Fill from the beaker with dissolved brass.",
        fillFromFlask: "Fill from the volumetric flask.",
        usePipetteToDispense: "Use a Pipette to dispense.",
        pipetteEmpty: "Pipette is empty. Fill it first.",
        destNotFound: "Destination container not found.",
        solutionTransferred: "Solution transferred.",
        selectPipetteToDispose: "Select the pipette to dispose.",
        dropPipetteInWaste: "Drop the pipette into the Waste Beaker.",
        cannotDispenseBack: "Cannot dispense back into a reagent bottle.",
        fillPipetteFirst: "Fill the pipette first.",
        usePipetteForCuvette: "Use a pipette to fill the cuvette.",
        pipetteDisposed: "Pipette disposed.",

        // Reaction
        reactionInProgress: "Reaction in progress... brass dissolving.",
        addAcidFirst: "Add acid to the beaker with brass first.",
        brassDissolvedReady: "Brass dissolved! Copper solution ready.",

        // Cuvette operations
        clickCuvetteRack: "Click on the Cuvette Rack.",
        cuvetteReady: "Cuvette ready for {type}.",
        dispenseToCuvette: "Dispense into a cuvette.",
        cuvetteAlreadyFilled: "Cuvette is already filled.",
        cuvetteFilled: "Cuvette filled from pipette.",
        cuvetteEmptied: "Cuvette emptied into waste.",

        // Spec 20 operations
        openLidFirst: "Open the Spec 20 lid first.",
        removeCuvetteFirst: "Remove the current cuvette first.",
        dragCuvetteToSpec: "Drag a cuvette to the Spec 20.",
        fillCuvetteFirst: "Fill the cuvette first.",
        cuvetteInserted: "Cuvette inserted into Spec 20.",
        noCuvetteToRemove: "No cuvette to remove.",
        cuvetteRemoved: "Cuvette removed.",
        insertBlankFirst: "Insert the blank cuvette first.",
        useBlankToCalibrate: "Use a blank cuvette (distilled water) to calibrate.",
        specCalibrated: "Spec 20 calibrated to 0.000 absorbance.",
        calibrateFirst: "Calibrate the Spec 20 with a blank first.",
        insertCuvetteFirst: "Insert a cuvette first.",
        absorbanceReading: "Absorbance: {reading}",
        lidAlready: "Lid is already {state}.",
        lidToggled: "Lid {state}.",
        closeLidToMeasure: "Close the lid to measure.",

        // Calculation
        checking: "Checking...",
        measureUnknownFirst: "Measure the unknown sample first.",
        correct: "Correct! Mass % Cu = {percent}%",
        incorrect: "Incorrect. Expected ~{percent}%.",

        // Cleanup
        completeCleanupFirst: "Complete all cleanup tasks before proceeding.",
        cleanupComplete: "Lab cleanup complete! Now calculate your results.",
        cuvettesRinsed: "Cuvettes rinsed with distilled water.",
        handsWashed: "Hands washed. Good lab practice!",
        noCuvettesToEmpty: "No cuvettes to empty.",
        emptyingCuvettes: "Emptying and stacking cuvettes...",
        noWasteBeaker: "No waste beaker found.",
        noPipettesToDispose: "No pipettes to dispose.",
        disposingPipettes: "Disposing pipettes..."
    },

    // ==========================================
    // ALL 60 INSTRUCTION STEPS (0-59)
    // ==========================================
    instructions: [
        // PHASE 1: SAMPLE PREPARATION (0-4)
        "Drag the Balance to the workbench.",
        "Drag the Brass Sample to the workbench.",
        "Place the Brass Sample on the Balance pan to weigh it.",
        "Drag the 50mL Beaker to the workbench.",
        "Transfer the weighed brass into the Beaker.",

        // PHASE 2: DISSOLUTION (5-11)
        "Drag the Waste Beaker to the workbench.",
        "Drag a Pipette to the workbench (for acid only).",
        "Drag the Conc. HNO₃ bottle to the workbench.",
        "Fill the Pipette from the HNO₃ bottle.",
        "Dispense acid into the Beaker to dissolve the brass.",
        "Dispose the acid pipette into the Waste Beaker.",
        "Wait for the brass to dissolve completely (observe the reaction).",

        // PHASE 3: DILUTION (12-20)
        "Drag the 100mL Volumetric Flask to the workbench.",
        "Drag a NEW Pipette for transferring copper solution.",
        "Fill the Pipette from the dissolved brass solution.",
        "Transfer the copper solution to the Flask.",
        "Dispose the copper pipette into the Waste Beaker.",
        "Drag a NEW Pipette for distilled water.",
        "Drag the Distilled Water bottle to the workbench.",
        "Fill the Pipette with distilled water.",
        "Dilute the Flask to the 100mL mark.",

        // PHASE 4: SPECTROPHOTOMETRY SETUP (21-28)
        "Drag the Spec 20 to the workbench.",
        "Drag the Cuvette Rack to the workbench.",
        "Click the Rack to get a cuvette for the BLANK.",
        "Fill the water pipette from the Distilled Water bottle.",
        "Dispense water into the blank cuvette.",
        "Open the Spec 20 lid (click LID).",
        "Insert the blank cuvette into the Spec 20.",
        "Close the lid and calibrate (click the 0.00 button).",

        // PHASE 5: STANDARDS MEASUREMENT (29-49)
        // 0.1M Standard
        "Open the lid and remove the blank cuvette.",
        "Click the Rack to get a cuvette for 0.1M standard.",
        "Drag the 0.1M Standard bottle to the workbench.",
        "Fill a pipette from the 0.1M Standard bottle.",
        "Dispense into the 0.1M cuvette.",
        "Insert the 0.1M cuvette into Spec 20.",
        "Close the lid and record the absorbance.",

        // 0.2M Standard
        "Open the lid and remove the 0.1M cuvette.",
        "Click the Rack to get a cuvette for 0.2M standard.",
        "Drag the 0.2M Standard bottle to the workbench.",
        "Fill a pipette from the 0.2M Standard bottle.",
        "Dispense into the 0.2M cuvette.",
        "Insert the 0.2M cuvette into Spec 20.",
        "Close the lid and record the absorbance.",

        // 0.4M Standard
        "Open the lid and remove the 0.2M cuvette.",
        "Click the Rack to get a cuvette for 0.4M standard.",
        "Drag the 0.4M Standard bottle to the workbench.",
        "Fill a pipette from the 0.4M Standard bottle.",
        "Dispense into the 0.4M cuvette.",
        "Insert the 0.4M cuvette into Spec 20.",
        "Close the lid and record the absorbance.",

        // PHASE 6: UNKNOWN MEASUREMENT (50-59)
        "Open the lid and remove the 0.4M cuvette.",
        "Click the Rack to get a cuvette for the UNKNOWN.",
        "Drag a NEW Pipette for the unknown solution.",
        "Fill the pipette from the Flask (unknown solution).",
        "Dispense into the unknown cuvette.",
        "Insert the unknown cuvette into Spec 20.",
        "Close the lid and record the absorbance.",
        "Open the lid and remove the unknown cuvette.",
        "Complete the cleanup checklist in the Lab Notebook (resize if needed to see it).",
        "Calculate the mass percent of copper and submit your answer."
    ]
};
