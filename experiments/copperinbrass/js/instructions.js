// instructions.js - Step-by-step experiment workflow

const instructions = [
    // =============================================
    // PHASE 1: SAMPLE PREPARATION (Steps 0-4)
    // =============================================
    {
        step: 0,
        text: "Drag the Balance to the workbench.",
        action: 'placeEquipment',
        equipment: 'balance',
        gear: ['Balance'],
        highlight: ['balance']
    },
    {
        step: 1,
        text: "Drag the Brass Sample to the workbench.",
        action: 'placeEquipment',
        equipment: 'brass',
        gear: ['Brass Sample'],
        highlight: ['brass']
    },
    {
        step: 2,
        text: "Place the Brass Sample on the Balance pan to weigh it.",
        action: 'weighBrass',
        gear: ['Brass Sample', 'Balance'],
        highlight: ['brass', 'balance']
    },
    {
        step: 3,
        text: "Drag the 50mL Beaker to the workbench.",
        action: 'placeEquipment',
        equipment: 'beaker',
        gear: ['50mL Beaker'],
        highlight: ['beaker']
    },
    {
        step: 4,
        text: "Transfer the weighed brass into the Beaker.",
        action: 'transferBrass',
        gear: ['Brass Sample', '50mL Beaker'],
        highlight: ['brass', 'beaker']
    },

    // =============================================
    // PHASE 2: DISSOLUTION (Steps 5-11)
    // =============================================
    {
        step: 5,
        text: "Drag the Waste Beaker to the workbench.",
        action: 'placeEquipment',
        equipment: 'waste',
        gear: ['Waste Beaker'],
        highlight: ['waste']
    },
    {
        step: 6,
        text: "Drag a Pipette to the workbench (for acid only).",
        action: 'placeEquipment',
        equipment: 'pipette',
        assignAs: 'acid',
        gear: ['Pipette'],
        highlight: ['pipette']
    },
    {
        step: 7,
        text: "Drag the Conc. HNO₃ bottle to the workbench.",
        action: 'placeEquipment',
        equipment: 'acid',
        gear: ['Conc. HNO₃'],
        highlight: ['acid']
    },
    {
        step: 8,
        text: "Fill the Pipette from the HNO₃ bottle.",
        action: 'fillPipette',
        source: 'acid',
        gear: ['Pipette', 'Conc. HNO₃'],
        highlight: ['pipette', 'acid']
    },
    {
        step: 9,
        text: "Dispense acid into the Beaker to dissolve the brass.",
        action: 'dispensePipette',
        destination: 'beaker',
        triggerReaction: true,
        gear: ['Pipette', '50mL Beaker'],
        highlight: ['pipette', 'beaker']
    },
    {
        step: 10,
        text: "Dispose the acid pipette into the Waste Beaker.",
        action: 'disposePipette',
        pipetteAssignment: 'acid',
        gear: ['Pipette', 'Waste Beaker'],
        highlight: ['pipette', 'waste']
    },
    {
        step: 11,
        text: "Wait for the brass to dissolve completely (observe the reaction).",
        action: 'waitReaction',
        gear: ['50mL Beaker'],
        highlight: ['beaker']
    },

    // =============================================
    // PHASE 3: DILUTION (Steps 12-20)
    // =============================================
    {
        step: 12,
        text: "Drag the 100mL Volumetric Flask to the workbench.",
        action: 'placeEquipment',
        equipment: 'flask',
        gear: ['100mL Flask'],
        highlight: ['flask']
    },
    {
        step: 13,
        text: "Drag a NEW Pipette for transferring copper solution.",
        action: 'placeEquipment',
        equipment: 'pipette',
        assignAs: 'copper',
        gear: ['Pipette'],
        highlight: ['pipette']
    },
    {
        step: 14,
        text: "Fill the Pipette from the dissolved brass solution.",
        action: 'fillPipette',
        source: 'beaker',
        gear: ['Pipette', '50mL Beaker'],
        highlight: ['copper', 'beaker']
    },
    {
        step: 15,
        text: "Transfer the copper solution to the Flask.",
        action: 'dispensePipette',
        destination: 'flask',
        gear: ['Pipette', '100mL Flask'],
        highlight: ['copper', 'flask']
    },
    {
        step: 16,
        text: "Dispose the copper pipette into the Waste Beaker.",
        action: 'disposePipette',
        pipetteAssignment: 'copper',
        gear: ['Pipette', 'Waste Beaker'],
        highlight: ['copper', 'waste']
    },
    {
        step: 17,
        text: "Drag a NEW Pipette for distilled water.",
        action: 'placeEquipment',
        equipment: 'pipette',
        assignAs: 'water',
        gear: ['Pipette'],
        highlight: ['pipette']
    },
    {
        step: 18,
        text: "Drag the Distilled Water bottle to the workbench.",
        action: 'placeEquipment',
        equipment: 'water',
        gear: ['Distilled Water'],
        highlight: ['water']
    },
    {
        step: 19,
        text: "Fill the Pipette with distilled water.",
        action: 'fillPipette',
        source: 'water',
        gear: ['Pipette', 'Distilled Water'],
        highlight: ['water', 'water']
    },
    {
        step: 20,
        text: "Dilute the Flask to the 100mL mark.",
        action: 'dispensePipette',
        destination: 'flask',
        gear: ['Pipette', '100mL Flask'],
        highlight: ['water', 'flask']
    },

    // =============================================
    // PHASE 4: SPECTROPHOTOMETRY SETUP (Steps 21-28)
    // =============================================
    {
        step: 21,
        text: "Drag the Spec 20 to the workbench.",
        action: 'placeEquipment',
        equipment: 'spec',
        gear: ['Spec 20'],
        highlight: ['spec']
    },
    {
        step: 22,
        text: "Drag the Cuvette Rack to the workbench.",
        action: 'placeEquipment',
        equipment: 'rack',
        gear: ['Cuvette Rack'],
        highlight: ['rack']
    },
    {
        step: 23,
        text: "Click the Rack to get a cuvette for the BLANK.",
        action: 'getCuvette',
        assignAs: 'blank',
        gear: ['Cuvette Rack', 'Cuvette'],
        highlight: ['rack']
    },
    {
        step: 24,
        text: "Fill the water pipette from the Distilled Water bottle.",
        action: 'fillPipette',
        source: 'water',
        gear: ['Pipette', 'Distilled Water'],
        highlight: ['water', 'water']
    },
    {
        step: 25,
        text: "Dispense water into the blank cuvette.",
        action: 'dispenseToCuvette',
        cuvetteType: 'blank',
        gear: ['Pipette', 'Cuvette'],
        highlight: ['water', 'cuvette_blank']
    },
    {
        step: 26,
        text: "Open the Spec 20 lid (click LID).",
        action: 'toggleLid',
        targetState: 'open',
        gear: ['Spec 20'],
        highlight: ['spec']
    },
    {
        step: 27,
        text: "Insert the blank cuvette into the Spec 20.",
        action: 'insertCuvette',
        cuvetteType: 'blank',
        gear: ['Cuvette', 'Spec 20'],
        highlight: ['cuvette_blank', 'spec']
    },
    {
        step: 28,
        text: "Close the lid and calibrate (click the 0.00 button).",
        action: 'calibrateSpec',
        gear: ['Spec 20'],
        highlight: ['spec']
    },

    // =============================================
    // PHASE 5: STANDARDS MEASUREMENT (Steps 29-49)
    // =============================================

    // --- 0.1M Standard ---
    {
        step: 29,
        text: "Open the lid and remove the blank cuvette.",
        action: 'removeCuvette',
        gear: ['Spec 20'],
        highlight: ['spec']
    },
    {
        step: 30,
        text: "Click the Rack to get a cuvette for 0.1M standard.",
        action: 'getCuvette',
        assignAs: 'std_0.1',
        gear: ['Cuvette Rack', 'Cuvette'],
        highlight: ['rack']
    },
    {
        step: 31,
        text: "Drag the 0.1M Standard bottle to the workbench.",
        action: 'placeEquipment',
        equipment: 'std1',
        gear: ['0.1M Standard'],
        highlight: ['std1']
    },
    {
        step: 32,
        text: "Fill a pipette from the 0.1M Standard bottle.",
        action: 'fillPipette',
        source: 'std1',
        gear: ['Pipette', '0.1M Standard'],
        highlight: ['water', 'std1']
    },
    {
        step: 33,
        text: "Dispense into the 0.1M cuvette.",
        action: 'dispenseToCuvette',
        cuvetteType: 'std_0.1',
        gear: ['Pipette', 'Cuvette'],
        highlight: ['water', 'cuvette_std_0.1']
    },
    {
        step: 34,
        text: "Insert the 0.1M cuvette into Spec 20.",
        action: 'insertCuvette',
        cuvetteType: 'std_0.1',
        gear: ['Cuvette', 'Spec 20'],
        highlight: ['cuvette_std_0.1', 'spec']
    },
    {
        step: 35,
        text: "Close the lid and record the absorbance.",
        action: 'measure',
        sample: '0.1M',
        concentration: 0.1,
        gear: ['Spec 20'],
        highlight: ['spec']
    },

    // --- 0.2M Standard ---
    {
        step: 36,
        text: "Open the lid and remove the 0.1M cuvette.",
        action: 'removeCuvette',
        gear: ['Spec 20'],
        highlight: ['spec']
    },
    {
        step: 37,
        text: "Click the Rack to get a cuvette for 0.2M standard.",
        action: 'getCuvette',
        assignAs: 'std_0.2',
        gear: ['Cuvette Rack', 'Cuvette'],
        highlight: ['rack']
    },
    {
        step: 38,
        text: "Drag the 0.2M Standard bottle to the workbench.",
        action: 'placeEquipment',
        equipment: 'std2',
        gear: ['0.2M Standard'],
        highlight: ['std2']
    },
    {
        step: 39,
        text: "Fill a pipette from the 0.2M Standard bottle.",
        action: 'fillPipette',
        source: 'std2',
        gear: ['Pipette', '0.2M Standard'],
        highlight: ['water', 'std2']
    },
    {
        step: 40,
        text: "Dispense into the 0.2M cuvette.",
        action: 'dispenseToCuvette',
        cuvetteType: 'std_0.2',
        gear: ['Pipette', 'Cuvette'],
        highlight: ['water', 'cuvette_std_0.2']
    },
    {
        step: 41,
        text: "Insert the 0.2M cuvette into Spec 20.",
        action: 'insertCuvette',
        cuvetteType: 'std_0.2',
        gear: ['Cuvette', 'Spec 20'],
        highlight: ['cuvette_std_0.2', 'spec']
    },
    {
        step: 42,
        text: "Close the lid and record the absorbance.",
        action: 'measure',
        sample: '0.2M',
        concentration: 0.2,
        gear: ['Spec 20'],
        highlight: ['spec']
    },

    // --- 0.4M Standard ---
    {
        step: 43,
        text: "Open the lid and remove the 0.2M cuvette.",
        action: 'removeCuvette',
        gear: ['Spec 20'],
        highlight: ['spec']
    },
    {
        step: 44,
        text: "Click the Rack to get a cuvette for 0.4M standard.",
        action: 'getCuvette',
        assignAs: 'std_0.4',
        gear: ['Cuvette Rack', 'Cuvette'],
        highlight: ['rack']
    },
    {
        step: 45,
        text: "Drag the 0.4M Standard bottle to the workbench.",
        action: 'placeEquipment',
        equipment: 'std4',
        gear: ['0.4M Standard'],
        highlight: ['std4']
    },
    {
        step: 46,
        text: "Fill a pipette from the 0.4M Standard bottle.",
        action: 'fillPipette',
        source: 'std4',
        gear: ['Pipette', '0.4M Standard'],
        highlight: ['water', 'std4']
    },
    {
        step: 47,
        text: "Dispense into the 0.4M cuvette.",
        action: 'dispenseToCuvette',
        cuvetteType: 'std_0.4',
        gear: ['Pipette', 'Cuvette'],
        highlight: ['water', 'cuvette_std_0.4']
    },
    {
        step: 48,
        text: "Insert the 0.4M cuvette into Spec 20.",
        action: 'insertCuvette',
        cuvetteType: 'std_0.4',
        gear: ['Cuvette', 'Spec 20'],
        highlight: ['cuvette_std_0.4', 'spec']
    },
    {
        step: 49,
        text: "Close the lid and record the absorbance.",
        action: 'measure',
        sample: '0.4M',
        concentration: 0.4,
        gear: ['Spec 20'],
        highlight: ['spec']
    },

    // =============================================
    // PHASE 6: UNKNOWN MEASUREMENT (Steps 50-59)
    // =============================================
    {
        step: 50,
        text: "Open the lid and remove the 0.4M cuvette.",
        action: 'removeCuvette',
        gear: ['Spec 20'],
        highlight: ['spec']
    },
    {
        step: 51,
        text: "Click the Rack to get a cuvette for the UNKNOWN.",
        action: 'getCuvette',
        assignAs: 'unknown',
        gear: ['Cuvette Rack', 'Cuvette'],
        highlight: ['rack']
    },
    {
        step: 52,
        text: "Drag a NEW Pipette for the unknown solution.",
        action: 'placeEquipment',
        equipment: 'pipette',
        assignAs: 'unknown',
        gear: ['Pipette'],
        highlight: ['pipette']
    },
    {
        step: 53,
        text: "Fill the pipette from the Flask (unknown solution).",
        action: 'fillPipette',
        source: 'flask',
        gear: ['Pipette', '100mL Flask'],
        highlight: ['unknown', 'flask']
    },
    {
        step: 54,
        text: "Dispense into the unknown cuvette.",
        action: 'dispenseToCuvette',
        cuvetteType: 'unknown',
        gear: ['Pipette', 'Cuvette'],
        highlight: ['unknown', 'cuvette_unknown']
    },
    {
        step: 55,
        text: "Insert the unknown cuvette into Spec 20.",
        action: 'insertCuvette',
        cuvetteType: 'unknown',
        gear: ['Cuvette', 'Spec 20'],
        highlight: ['cuvette_unknown', 'spec']
    },
    {
        step: 56,
        text: "Close the lid and record the absorbance.",
        action: 'measure',
        sample: 'Unknown',
        concentration: -1,  // Special flag for unknown
        gear: ['Spec 20'],
        highlight: ['spec']
    },
    {
        step: 57,
        text: "Open the lid and remove the unknown cuvette.",
        action: 'removeCuvette',
        gear: ['Spec 20'],
        highlight: ['spec']
    },
    {
        step: 58,
        text: "Complete the cleanup checklist in the Lab Notebook (resize if needed to see it).",
        action: 'cleaningChecklist',
        gear: ['Lab Notebook'],
        highlight: ['notebook']
    },
    {
        step: 59,
        text: "Calculate the mass percent of copper and submit your answer.",
        action: 'submitCalculation',
        gear: ['Lab Notebook'],
        highlight: ['notebook']
    }
];

export default instructions;

// Helper to get total step count
export function getTotalSteps() {
    return instructions.length;
}

// Helper to get step config by index
export function getStepConfig(stepIndex) {
    return instructions[stepIndex] || null;
}
