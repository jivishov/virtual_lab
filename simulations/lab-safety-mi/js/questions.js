// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Questions Database
//
// The `correct: true` flag on an option is the single source of truth.
// There is deliberately no parallel `correctAnswer` index: options are
// shuffled per attempt, and two copies of the same fact are how a key
// silently goes stale.
//
// Every scenario asks for the SAFE action. Items that used to ask students
// to pick the forbidden action have been rewritten, because the UI marks the
// chosen option green with "PROTOCOL EXECUTED" — which rewarded selecting a
// hazard in a safety module.
// ===================================

const MISSION_SCENARIOS = [
    {
        id: 1,
        title: "SCENARIO ALPHA - PPE CHECKPOINT",
        threatLevel: "low",
        situation: "Agent must infiltrate the lab. Intelligence reports corrosives and open flames in use. Select the protective equipment required for entry.",
        sceneType: "ppe",
        art: "ppe",
        options: [
            {
                text: "CASUAL ATTIRE",
                icon: "tshirt",
                description: "Everyday clothing, open-toed shoes",
                feedback: "Open-toed shoes and bare arms put nothing between a spill and your skin, and dropped glassware lands on your feet."
            },
            {
                text: "GOGGLES ONLY",
                icon: "goggles",
                description: "Eye protection, nothing else",
                feedback: "Your eyes are covered, but your hands and clothing are still exposed to corrosives and hot glassware."
            },
            {
                text: "FULL PROTECTION",
                icon: "lab-coat",
                description: "Lab coat, goggles, gloves, closed shoes",
                correct: true
            },
            {
                text: "GLOVES ONLY",
                icon: "gloves",
                description: "Hand protection, nothing else",
                feedback: "Gloves leave your eyes unprotected, and eye injuries are the most common serious laboratory injury."
            }
        ],
        explanation: "Full PPE is mandatory. The lab coat protects skin and clothing, goggles protect eyes from splashes, gloves prevent contamination and chemical burns, and closed-toe shoes protect feet from spills and dropped glassware. PPE only works as a complete set.",
        protocol: "Wear a lab coat, goggles, gloves and closed shoes for every practical."
    },
    {
        id: 2,
        title: "SCENARIO BRAVO - HAZARD IDENTIFICATION",
        threatLevel: "medium",
        situation: "Surveillance recovered this warning label from an unmarked container. Identify the hazard class it declares.",
        sceneType: "chemical",
        art: "hazard",
        options: [
            {
                text: "CORROSIVE",
                icon: "droplet",
                description: "Acids and bases that burn tissue",
                feedback: "Corrosives are marked with a pictogram of a hand and a surface being eaten away, not three interlocking rings."
            },
            {
                text: "FLAMMABLE",
                icon: "flame",
                description: "Ignites and burns easily",
                feedback: "The flammable pictogram is a flame. Three interlocking rings are the international biohazard symbol."
            },
            {
                text: "BIOHAZARD",
                icon: "biohazard",
                description: "Infectious biological material",
                correct: true
            },
            {
                text: "RADIOACTIVE",
                icon: "radioactive",
                description: "Emits ionising radiation",
                feedback: "Radioactive material uses a trefoil — three solid wedges around a central dot. Similar at a glance, a different hazard entirely."
            }
        ],
        explanation: "Three interlocking rings is the international biohazard symbol: bacteria, viruses, cultures, blood and tissue. Handle only with the containment level your instructor specifies, and never open an unmarked container carrying it.",
        protocol: "Read the pictogram before you touch the container — the symbol tells you which precautions apply."
    },
    {
        id: 3,
        title: "SCENARIO CHARLIE - CLOTHING FIRE",
        threatLevel: "high",
        situation: "CRITICAL: a colleague's sleeve has caught fire at the bench. The safety shower is three metres away, in clear reach. Act now.",
        sceneType: "fire",
        art: "fire",
        options: [
            {
                text: "SAFETY SHOWER",
                icon: "shower",
                description: "Get them under it and drench immediately",
                correct: true
            },
            {
                text: "FIRE BLANKET",
                icon: "blanket",
                description: "Smother the flames with a blanket",
                feedback: "A blanket is the right call when no shower is within reach — but with one three metres away, drenching is faster and also cools the burn instead of trapping heat against the skin."
            },
            {
                text: "CO₂ EXTINGUISHER",
                icon: "extinguisher",
                description: "Spray the person with the extinguisher",
                feedback: "Never aim a CO₂ or dry-powder extinguisher at a person. It can cause cold burns, drive burning material into skin, and displace the air they are breathing."
            },
            {
                text: "RUN FOR HELP",
                icon: "door",
                description: "Leave and fetch a teacher",
                feedback: "Running fans the flames with fresh oxygen and spends the few seconds that decide how deep the burn goes."
            }
        ],
        explanation: "Drench the person under the safety shower at once — it extinguishes the fire and cools the burn in one action. With no shower in reach, smother with a fire blanket or stop-drop-and-roll. Never use a CO₂ or dry-powder extinguisher on a person, and send someone else for help rather than leaving.",
        protocol: "Clothing fire: drench under the safety shower, or smother — never spray a person with an extinguisher."
    },
    {
        id: 4,
        title: "SCENARIO DELTA - CONTAMINATION ALERT",
        threatLevel: "high",
        situation: "A corrosive spill is spreading across the bench in Sector 7. The substance is not identified. What is your first action?",
        sceneType: "spill",
        art: "spill",
        options: [
            {
                text: "ALERT SUPERVISOR",
                icon: "megaphone",
                description: "Tell the teacher or supervisor at once",
                correct: true
            },
            {
                text: "CLEAN IT YOURSELF",
                icon: "broom",
                description: "Deal with it before anyone notices",
                feedback: "Cleaning an unidentified corrosive risks skin contact and the wrong neutraliser — some combinations release heat or toxic gas."
            },
            {
                text: "CARRY ON, REPORT LATER",
                icon: "arrow",
                description: "Finish the experiment first",
                feedback: "A spreading corrosive reaches other people, other reagents and shoes. Every second of delay widens the contaminated zone."
            },
            {
                text: "ASK A CLASSMATE",
                icon: "people",
                description: "Get a peer to help you first",
                feedback: "Your classmate has the same training you do and no access to spill kits or PPE stores. Escalate — don't refer sideways."
            }
        ],
        explanation: "Report every spill to your teacher or supervisor immediately. They are trained in decontamination, know what the substance is, and control the spill kit. Keep others away from the area while you wait.",
        protocol: "Any spill, however small: stop, keep clear, tell the supervisor immediately."
    },
    {
        id: 5,
        title: "SCENARIO ECHO - DILUTION PROTOCOL",
        threatLevel: "high",
        situation: "The mission requires diluting concentrated sulfuric acid. Choose the method that keeps the heat of dilution under control.",
        sceneType: "mixing",
        art: "dilution",
        options: [
            {
                text: "WATER INTO ACID",
                icon: "water-to-acid",
                description: "Pour the water into the acid",
                feedback: "This is the violation from your briefing. Water floats on denser acid, so the entire heat of dilution lands in a thin surface layer, flashes to steam, and ejects boiling acid."
            },
            {
                text: "MIX QUICKLY",
                icon: "swirl",
                description: "Combine them fast and stir hard",
                feedback: "Speed is the hazard here, not the order. Fast mixing releases heat faster than the water can carry it away."
            },
            {
                text: "ACID INTO WATER",
                icon: "acid-to-water",
                description: "Add acid to water slowly, stirring",
                correct: true
            },
            {
                text: "EQUAL PORTIONS",
                icon: "balance",
                description: "Pour both at the same time",
                feedback: "Pouring together still creates moments where acid is the bulk liquid receiving water. There is no safe simultaneous version."
            }
        ],
        explanation: "Always add acid TO water, slowly, with stirring. The large volume of water absorbs and spreads the heat of dilution. Reversing it concentrates that heat in a thin floating layer of water, which boils violently and throws acid out of the vessel.",
        protocol: "Acid into water, slowly — never water into acid."
    },
    {
        id: 6,
        title: "SCENARIO FOXTROT - LAB RESPONSIBILITY",
        threatLevel: "low",
        situation: "The experiment is complete. The station holds used glassware and chemical residue. Determine who is responsible for clearing it.",
        sceneType: "cleanup",
        art: "cleanup",
        options: [
            {
                text: "TEACHER ONLY",
                icon: "teacher",
                description: "Staff clear every station",
                feedback: "One person cannot safely clear thirty stations, and they did not see what went into your glassware."
            },
            {
                text: "LAB TECHNICIAN",
                icon: "microscope",
                description: "The technician handles all of it",
                feedback: "Technicians handle disposal of hazardous waste, not routine tidying — and passing them unlabelled residue makes their job dangerous."
            },
            {
                text: "EVERYONE WHO USED IT",
                icon: "people",
                description: "Each student clears their own station",
                correct: true
            },
            {
                text: "THE NEXT CLASS",
                icon: "clock",
                description: "Leave it for the following period",
                feedback: "The next class inherits unknown residue on a bench they assume is clean. That is how someone else gets hurt by your experiment."
            }
        ],
        explanation: "Everyone who used the lab clears their own station: wash and return glassware, dispose of waste in the designated container, wipe the bench, and wash your hands. The next user has to be able to trust that the bench is clean.",
        protocol: "Clear your own station: glassware returned, waste in the right container, bench wiped, hands washed."
    },
    {
        id: 7,
        title: "SCENARIO GOLF - FLAMMABLE STORAGE",
        threatLevel: "medium",
        situation: "Ethanol and other flammable solvents must be put away at the end of the session. Identify the correct storage location.",
        sceneType: "storage",
        art: "storage",
        options: [
            {
                text: "FLAMMABLES CABINET",
                icon: "cabinet",
                description: "Labelled, vented, approved cabinet",
                correct: true
            },
            {
                text: "BESIDE THE BURNER",
                icon: "burner",
                description: "On the bench next to the heat source",
                feedback: "Solvent vapour is heavier than air and travels along the bench. An ignition source at bench level can flash the vapour trail back to the bottle."
            },
            {
                text: "OPEN BEAKER ON BENCH",
                icon: "beaker",
                description: "An unlabelled beaker, left out",
                feedback: "An open vessel evaporates solvent into the room all night, and nobody downstream knows what the unlabelled liquid is."
            },
            {
                text: "KITCHEN REFRIGERATOR",
                icon: "fridge",
                description: "A domestic fridge keeps it cool",
                feedback: "A household fridge has an internal thermostat and light that spark — a classic cause of solvent explosions. Only lab-rated flammable-storage refrigerators are safe."
            }
        ],
        explanation: "Flammable solvents belong in a labelled, ventilated, approved flammables cabinet, away from heat, flames and electrical ignition sources, with the cap firmly closed. Keep only the working quantity at the bench.",
        protocol: "Flammables live in the approved vented cabinet, capped and labelled, away from every ignition source."
    },
    {
        id: 8,
        title: "SCENARIO HOTEL - ACCESS CONTROL",
        threatLevel: "low",
        situation: "The laboratory door is unlocked and the room is empty. Determine the authorised entry protocol.",
        sceneType: "access",
        art: "access",
        options: [
            {
                text: "ENTER ANY TIME",
                icon: "clock",
                description: "It is open, so it is available",
                feedback: "An unlocked door is not permission. Reactions may be running, and an empty lab means nobody would know you were in trouble."
            },
            {
                text: "ONLY WITH PERMISSION",
                icon: "check",
                description: "Enter only when staff authorise and supervise",
                correct: true
            },
            {
                text: "DURING CLASS ONLY",
                icon: "book",
                description: "Any time a lesson is scheduled",
                feedback: "Close, but a timetabled lesson is not the point — the requirement is a supervisor who knows you are there and what you are handling."
            },
            {
                text: "WITH A CLASSMATE",
                icon: "people",
                description: "Two students together is enough",
                feedback: "A second student doubles the people at risk without adding anyone trained to respond."
            }
        ],
        explanation: "Never enter or work in a laboratory without staff authorisation and supervision. Labs hold hazardous materials, live equipment and running reactions, and emergency response depends on a trained adult being present.",
        protocol: "No supervisor, no entry — regardless of whether the door is open."
    },
    {
        id: 9,
        title: "SCENARIO INDIA - CONDUCT PROTOCOL",
        threatLevel: "medium",
        situation: "Several operatives are working in a crowded lab with hot plates running. Identify the conduct required of all of them.",
        sceneType: "behavior",
        art: "conduct",
        options: [
            {
                text: "MOVE AT WALKING PACE",
                icon: "walk",
                description: "Walk, keep aisles and exits clear",
                correct: true
            },
            {
                text: "HURRY TO SAVE TIME",
                icon: "run",
                description: "Move fast between stations",
                feedback: "Running in a crowded lab knocks glassware off benches and puts you into someone else's hot plate. Time saved is not worth a burn."
            },
            {
                text: "TASTE TO CHECK RESULTS",
                icon: "tongue",
                description: "Confirm a product by tasting it",
                feedback: "Nothing in a laboratory is ever tasted. Even a nominally harmless product may be contaminated by the glassware it sat in."
            },
            {
                text: "GOGGLES OFF WHEN HEATING STOPS",
                icon: "goggles",
                description: "Remove eye protection after the flame is out",
                feedback: "Hot glass, residual pressure and unnoticed splashes persist long after the flame is out. Goggles stay on until all work is cleared away."
            }
        ],
        explanation: "Calm, deliberate movement is a safety requirement, not etiquette. Walk, keep bags and stools out of aisles, keep exits clear, and keep your PPE on until everything is cleared away. Running and horseplay cause spills, breakages, fires and injuries.",
        protocol: "Walk, keep aisles clear, and keep PPE on until the bench is cleared."
    },
    {
        id: 10,
        title: "SCENARIO JULIET - BIOLOGICAL SAMPLE",
        threatLevel: "high",
        situation: "MISSION CRITICAL: pond water samples must be examined under the microscope. Select the required handling protocol.",
        sceneType: "biological",
        art: "biological",
        options: [
            {
                text: "OBSERVE ONLY",
                icon: "microscope",
                description: "Eyes and instruments; gloves on, wash after",
                correct: true
            },
            {
                text: "TASTE A DROP",
                icon: "tongue",
                description: "Sample it directly to compare",
                feedback: "Pond water carries parasites, bacteria and chemical run-off. Tasting any laboratory sample can cause serious illness or death."
            },
            {
                text: "WAFT AND SNIFF",
                icon: "nose",
                description: "Waft the vapour toward your nose",
                feedback: "Wafting is only ever used with a known, low-hazard substance on explicit instruction — never with an uncharacterised biological sample."
            },
            {
                text: "MOUTH PIPETTE IT",
                icon: "straw",
                description: "Draw the sample up by mouth",
                feedback: "Mouth pipetting pulls the sample toward your mouth and has caused laboratory infections for over a century. Always use a bulb or pipettor."
            }
        ],
        explanation: "Examine biological samples with your eyes and instruments only. Wear gloves, keep the sample contained, never taste, smell or mouth-pipette it, dispose of slides in the designated container, and wash your hands afterwards.",
        protocol: "Never taste, smell or mouth-pipette a sample — observe with instruments, then wash your hands."
    }
];

// ===================================
// SHUFFLING
// Option C used to be correct in 7 of 10 items, so always clicking the
// third card scored 70%. Position must carry no signal.
// ===================================

function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// Returns a per-attempt view of a scenario with its options shuffled and the
// correct index derived from the `correct` flag.
//
// Translation happens BEFORE the shuffle and carries `correct` across with the
// rest of the option, so the answer key is derived from the same objects the
// student sees. A translation cannot move the correct answer.
function prepareScenario(scenario) {
    const localized = window.i18n
        ? window.i18n.localizeScenario(scenario)
        : scenario;

    const options = shuffle(localized.options);
    return {
        ...localized,
        options,
        correctIndex: options.findIndex(option => option.correct === true)
    };
}

// ===================================
// DIFFICULTY (how hard the mission is) — deliberately separate from
// RANK (how well the agent did). The old AGENT_LEVELS table was both at
// once, which is why picking IMF DIRECTOR handed out 90 free points and
// made the final rank a function of the menu choice rather than learning.
// ===================================

// `name` and `blurb` are getters rather than stored strings: every call site
// reads them fresh, so a language change is picked up without anyone having to
// remember to re-render. Same pattern for RANKS and BADGES below.
const DIFFICULTY_TIERS = [
    { id: "recruit",    icon: "👤",     timerSeconds: 25, hints: 2 },
    { id: "field",      icon: "🕵️",     timerSeconds: 20, hints: 1 },
    { id: "specialops", icon: "🎯",     timerSeconds: 16, hints: 0 },
    { id: "director",   icon: "👨‍💼",     timerSeconds: 12, hints: 0 }
].map(tier => ({
    ...tier,
    get name()  { return window.i18n ? window.i18n.t(`tier.${this.id}`) : this.id; },
    get blurb() { return window.i18n ? window.i18n.t(`tier.${this.id}.blurb`) : ''; }
}));

// One pass mark for the mission verdict and the certificate.
const PASS_THRESHOLD = 70;

// Earned from accuracy, not from the difficulty picked.
const RANKS = [100, 90, 70, 50, 0].map(minPercent => ({
    minPercent,
    get title() {
        return window.i18n ? window.i18n.t(`rank.${this.minPercent}`) : String(this.minPercent);
    }
}));

function getRank(percent) {
    return RANKS.find(rank => percent >= rank.minPercent) || RANKS[RANKS.length - 1];
}

// ===================================
// BADGES
// ===================================

const BADGES = [
    {
        id: "speed",
        icon: "⚡",
        requirement: (stats) => stats.quickAnswers >= 5
    },
    {
        id: "perfect",
        icon: "🏆",
        requirement: (stats) => stats.correctAnswers === MISSION_SCENARIOS.length
    },
    {
        id: "safety",
        icon: "🛡️",
        requirement: (stats) => {
            // Fire, spill, dilution, biological
            const emergencyIds = [3, 4, 5, 10];
            return emergencyIds.every(id => stats.correctScenarios.includes(id));
        }
    },
    {
        id: "streak",
        icon: "🔥",
        requirement: (stats) => stats.maxStreak >= 5
    },
    {
        id: "unaided",
        icon: "🎖️",
        requirement: (stats) =>
            stats.hintsUsed === 0 &&
            (stats.correctAnswers / MISSION_SCENARIOS.length) * 100 >= PASS_THRESHOLD
    }
].map(badge => ({
    ...badge,
    get name()        { return window.i18n ? window.i18n.t(`badge.${this.id}`) : this.id; },
    get description() { return window.i18n ? window.i18n.t(`badge.${this.id}.desc`) : ''; }
}));

// Fails loudly in the console if a translated option list has drifted out of
// step with the English one it is positionally matched against.
if (window.i18n) window.i18n.auditScenarios(MISSION_SCENARIOS);
