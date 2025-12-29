// de.js - Deutsche Übersetzungen
export default {
    // ==========================================
    // BENUTZEROBERFLÄCHEN-BESCHRIFTUNGEN
    // ==========================================
    ui: {
        // Seitentitel
        pageTitle: "AP Chemie: Kupferanalyse-Labor",

        // Seitenleiste
        labEquipment: "Laborgeräte",

        // Schrittverfolgung
        stepOf: "Schritt {current} / {total}",
        brassLab: "Messing-Labor",
        undo: "Rückgängig (max 10)",
        autoForward: "Automatisch weiter",
        toggleList: "Liste ein-/ausblenden",
        complete: "Fertig!",

        // Notizbuch
        labNotebook: "Laborheft",
        sampleData: "1. Probendaten",
        massBrass: "Messing-Masse",
        condition: "Zustand",
        spectrophotometry: "2. Spektrophotometrie",
        sample: "Probe",
        abs: "Abs",
        calibrationCurve: "Kalibrierkurve (Abs vs Konz)",

        // Reinigungscheckliste
        cleanupChecklist: "Labor-Reinigungscheckliste:",
        cleanupItem1: "Flüssigkeit aus allen Küvetten in Abfallbecher entleeren",
        cleanupItem2: "Küvetten mindestens 3x mit dest. Wasser spülen",
        cleanupItem3: "Alle Pipetten in Abfallbecher entsorgen",
        cleanupItem4: "Hände waschen",
        completeCleanup: "Reinigung abschließen",

        // Berechnungsbereich
        calcMassPercent: "Cu Massenprozent berechnen:",
        showHint: "Hinweis zeigen",
        hideHint: "Hinweis verbergen",
        formulaTitle: "Formel:",
        formulaConc: "Konz = (Abs + 0.00538) / 2.426",
        formulaMass: "Cu Masse % = (Konz x 0.100L x 63.55) / Messingmasse x 100",
        check: "Prüfen",
        percentPlaceholder: "%"
    },

    // ==========================================
    // GERÄTE-BESCHRIFTUNGEN (Regal)
    // ==========================================
    equipment: {
        balance: "Waage",
        brass: "Messingprobe",
        pipette: "Pipette",
        waste: "Abfallbecher",
        beaker: "50 mL Becher",
        acid: "Konz. HNO₃",
        flask: "100 mL Kolben",
        water: "Dest. Wasser",
        spec: "Spec 20",
        rack: "Küvettenständer",
        cuvette: "Küvette",
        std1: "0,1 M Std",
        std2: "0,2 M Std",
        std4: "0,4 M Std"
    },

    // ==========================================
    // INHALT/LÖSUNGS-BESCHRIFTUNGEN
    // ==========================================
    content: {
        acid: "HNO₃",
        water: "H₂O",
        copper: "Cu²⁺",
        std01: "0,1M",
        std02: "0,2M",
        std04: "0,4M",
        unknown: "Unbek",
        blank: "Blind"
    },

    // ==========================================
    // GRAFIK/SVG-TEXTE
    // ==========================================
    graphics: {
        getCuvette: "KÜVETTE HOLEN",
        waste: "ABFALL",
        pipettes: "{count} Pipette(n)",
        lid: "DECKEL",
        open: "OFFEN",
        beakerLabel: "50ml"
    },

    // ==========================================
    // DIAGRAMM-BESCHRIFTUNGEN
    // ==========================================
    graph: {
        concentration: "Konz (M)",
        absorbance: "Abs",
        unknown: "Unbek",
        standards: "Std",
        fit: "Fit"
    },

    // ==========================================
    // ZUSTÄNDE
    // ==========================================
    conditions: {
        solid: "Fest",
        dissolved: "Gelöst"
    },

    // ==========================================
    // FEEDBACK-NACHRICHTEN
    // ==========================================
    messages: {
        // Allgemein
        welcome: "Willkommen! Befolgen Sie die Anweisungen, um das Labor abzuschließen.",
        labComplete: "Labor abgeschlossen! Keine weiteren Schritte.",
        nothingToUndo: "Nichts rückgängig zu machen.",
        undoSuccessful: "Rückgängig erfolgreich.",
        invalidInteraction: "Ungültige Aktion. Prüfen Sie die aktuelle Anweisung.",
        enterNumeric: "Geben Sie einen numerischen Wert ein.",

        // Geräteplatzierung
        alreadyPlaced: "Dieses Gerät ist bereits auf der Werkbank.",
        equipmentPlaced: "{equipment} auf Werkbank platziert.",
        wrongEquipment: "Platzieren Sie {expected}, nicht dieses Element.",

        // Messing wiegen
        dragBrassToBalance: "Ziehen Sie die Messingprobe zur Waage.",
        dropOnBalance: "Legen Sie das Messing auf die Waage.",
        brassMassRecorded: "Messingmasse: {mass} g aufgezeichnet.",

        // Messing-Transfer
        dragBrassSample: "Ziehen Sie die Messingprobe.",
        dropIntoBeaker: "Legen Sie das Messing in den Becher.",
        weighFirst: "Wiegen Sie zuerst das Messing!",
        brassTransferred: "Messing in Becher übertragen.",

        // Pipettenoperationen
        usePipetteToFill: "Verwenden Sie eine Pipette zum Befüllen.",
        sourceNotFound: "Quellbehälter nicht gefunden.",
        pipetteAlreadyFull: "Pipette ist bereits voll. Erst entleeren.",
        fillFromBeaker: "Aus dem Becher mit gelöstem Messing befüllen.",
        fillFromFlask: "Aus dem Messkolben befüllen.",
        usePipetteToDispense: "Verwenden Sie eine Pipette zum Abgeben.",
        pipetteEmpty: "Pipette ist leer. Erst befüllen.",
        destNotFound: "Zielbehälter nicht gefunden.",
        solutionTransferred: "Lösung übertragen.",
        selectPipetteToDispose: "Wählen Sie die zu entsorgende Pipette.",
        dropPipetteInWaste: "Legen Sie die Pipette in den Abfallbecher.",
        cannotDispenseBack: "Kann nicht zurück in die Reagenzflasche abgeben.",
        fillPipetteFirst: "Befüllen Sie zuerst die Pipette.",
        usePipetteForCuvette: "Verwenden Sie eine Pipette, um die Küvette zu befüllen.",
        pipetteDisposed: "Pipette entsorgt.",

        // Reaktion
        reactionInProgress: "Reaktion läuft... Messing löst sich auf.",
        addAcidFirst: "Fügen Sie zuerst Säure zum Becher mit Messing hinzu.",
        brassDissolvedReady: "Messing gelöst! Kupferlösung bereit.",

        // Küvettenoperationen
        clickCuvetteRack: "Klicken Sie auf den Küvettenständer.",
        cuvetteReady: "Küvette bereit für {type}.",
        dispenseToCuvette: "In die Küvette abgeben.",
        cuvetteAlreadyFilled: "Küvette ist bereits gefüllt.",
        cuvetteFilled: "Küvette aus Pipette befüllt.",
        cuvetteEmptied: "Küvette in Abfall entleert.",

        // Spec 20 Operationen
        openLidFirst: "Öffnen Sie zuerst den Spec 20 Deckel.",
        removeCuvetteFirst: "Entfernen Sie zuerst die aktuelle Küvette.",
        dragCuvetteToSpec: "Ziehen Sie eine Küvette zum Spec 20.",
        fillCuvetteFirst: "Befüllen Sie zuerst die Küvette.",
        cuvetteInserted: "Küvette in Spec 20 eingesetzt.",
        noCuvetteToRemove: "Keine Küvette zu entfernen.",
        cuvetteRemoved: "Küvette entfernt.",
        insertBlankFirst: "Setzen Sie zuerst die Blindküvette ein.",
        useBlankToCalibrate: "Verwenden Sie eine Blindküvette (dest. Wasser) zur Kalibrierung.",
        specCalibrated: "Spec 20 auf 0,000 Absorbanz kalibriert.",
        calibrateFirst: "Kalibrieren Sie zuerst Spec 20 mit einer Blindprobe.",
        insertCuvetteFirst: "Setzen Sie zuerst eine Küvette ein.",
        absorbanceReading: "Absorbanz: {reading}",
        lidAlready: "Deckel ist bereits {state}.",
        lidToggled: "Deckel {state}.",
        closeLidToMeasure: "Schließen Sie den Deckel zum Messen.",

        // Berechnung
        checking: "Wird geprüft...",
        measureUnknownFirst: "Messen Sie zuerst die unbekannte Probe.",
        correct: "Richtig! Cu Masse % = {percent}%",
        incorrect: "Falsch. Erwartet ~{percent}%.",

        // Reinigung
        completeCleanupFirst: "Schließen Sie alle Reinigungsaufgaben ab, bevor Sie fortfahren.",
        cleanupComplete: "Laborreinigung abgeschlossen! Berechnen Sie jetzt Ihre Ergebnisse.",
        cuvettesRinsed: "Küvetten mit dest. Wasser gespült.",
        handsWashed: "Hände gewaschen. Gute Laborpraxis!",
        noCuvettesToEmpty: "Keine Küvetten zum Entleeren.",
        emptyingCuvettes: "Küvetten werden entleert und gestapelt...",
        noWasteBeaker: "Kein Abfallbecher gefunden.",
        noPipettesToDispose: "Keine Pipetten zu entsorgen.",
        disposingPipettes: "Pipetten werden entsorgt..."
    },

    // ==========================================
    // ALLE 60 ANWEISUNGSSCHRITTE (0-59)
    // ==========================================
    instructions: [
        // PHASE 1: PROBENVORBEREITUNG (0-4)
        "Ziehen Sie die Waage auf die Werkbank.",
        "Ziehen Sie die Messingprobe auf die Werkbank.",
        "Legen Sie die Messingprobe zum Wiegen auf die Waagschale.",
        "Ziehen Sie den 50mL Becher auf die Werkbank.",
        "Übertragen Sie das gewogene Messing in den Becher.",

        // PHASE 2: AUFLÖSUNG (5-11)
        "Ziehen Sie den Abfallbecher auf die Werkbank.",
        "Ziehen Sie eine Pipette auf die Werkbank (nur für Säure).",
        "Ziehen Sie die konz. HNO₃-Flasche auf die Werkbank.",
        "Befüllen Sie die Pipette aus der HNO₃-Flasche.",
        "Geben Sie Säure in den Becher, um das Messing aufzulösen.",
        "Entsorgen Sie die Säurepipette im Abfallbecher.",
        "Warten Sie, bis sich das Messing vollständig aufgelöst hat (Reaktion beobachten).",

        // PHASE 3: VERDÜNNUNG (12-20)
        "Ziehen Sie den 100mL Messkolben auf die Werkbank.",
        "Ziehen Sie eine NEUE Pipette zum Übertragen der Kupferlösung.",
        "Befüllen Sie die Pipette aus der gelösten Messinglösung.",
        "Übertragen Sie die Kupferlösung in den Kolben.",
        "Entsorgen Sie die Kupferpipette im Abfallbecher.",
        "Ziehen Sie eine NEUE Pipette für destilliertes Wasser.",
        "Ziehen Sie die Flasche mit destilliertem Wasser auf die Werkbank.",
        "Befüllen Sie die Pipette mit destilliertem Wasser.",
        "Verdünnen Sie den Kolben bis zur 100mL-Markierung.",

        // PHASE 4: SPEKTROPHOTOMETRIE-SETUP (21-28)
        "Ziehen Sie das Spec 20 auf die Werkbank.",
        "Ziehen Sie den Küvettenständer auf die Werkbank.",
        "Klicken Sie auf den Ständer, um eine Küvette für die BLINDPROBE zu erhalten.",
        "Befüllen Sie die Wasserpipette aus der Flasche mit destilliertem Wasser.",
        "Geben Sie Wasser in die Blindküvette.",
        "Öffnen Sie den Spec 20 Deckel (klicken Sie auf DECKEL).",
        "Setzen Sie die Blindküvette in das Spec 20 ein.",
        "Schließen Sie den Deckel und kalibrieren Sie (klicken Sie auf die 0,00-Taste).",

        // PHASE 5: STANDARDMESSUNGEN (29-49)
        // 0,1M Standard
        "Öffnen Sie den Deckel und entfernen Sie die Blindküvette.",
        "Klicken Sie auf den Ständer, um eine Küvette für 0,1M Standard zu erhalten.",
        "Ziehen Sie die 0,1M Standardflasche auf die Werkbank.",
        "Befüllen Sie eine Pipette aus der 0,1M Standardflasche.",
        "Geben Sie in die 0,1M Küvette.",
        "Setzen Sie die 0,1M Küvette in das Spec 20 ein.",
        "Schließen Sie den Deckel und notieren Sie die Absorbanz.",

        // 0,2M Standard
        "Öffnen Sie den Deckel und entfernen Sie die 0,1M Küvette.",
        "Klicken Sie auf den Ständer, um eine Küvette für 0,2M Standard zu erhalten.",
        "Ziehen Sie die 0,2M Standardflasche auf die Werkbank.",
        "Befüllen Sie eine Pipette aus der 0,2M Standardflasche.",
        "Geben Sie in die 0,2M Küvette.",
        "Setzen Sie die 0,2M Küvette in das Spec 20 ein.",
        "Schließen Sie den Deckel und notieren Sie die Absorbanz.",

        // 0,4M Standard
        "Öffnen Sie den Deckel und entfernen Sie die 0,2M Küvette.",
        "Klicken Sie auf den Ständer, um eine Küvette für 0,4M Standard zu erhalten.",
        "Ziehen Sie die 0,4M Standardflasche auf die Werkbank.",
        "Befüllen Sie eine Pipette aus der 0,4M Standardflasche.",
        "Geben Sie in die 0,4M Küvette.",
        "Setzen Sie die 0,4M Küvette in das Spec 20 ein.",
        "Schließen Sie den Deckel und notieren Sie die Absorbanz.",

        // PHASE 6: UNBEKANNTE MESSUNG (50-59)
        "Öffnen Sie den Deckel und entfernen Sie die 0,4M Küvette.",
        "Klicken Sie auf den Ständer, um eine Küvette für die UNBEKANNTE zu erhalten.",
        "Ziehen Sie eine NEUE Pipette für die unbekannte Lösung.",
        "Befüllen Sie die Pipette aus dem Kolben (unbekannte Lösung).",
        "Geben Sie in die unbekannte Küvette.",
        "Setzen Sie die unbekannte Küvette in das Spec 20 ein.",
        "Schließen Sie den Deckel und notieren Sie die Absorbanz.",
        "Öffnen Sie den Deckel und entfernen Sie die unbekannte Küvette.",
        "Vervollständigen Sie die Reinigungscheckliste im Laborheft (ggf. Größe ändern).",
        "Berechnen Sie den Massenprozent Kupfer und reichen Sie Ihre Antwort ein."
    ]
};
