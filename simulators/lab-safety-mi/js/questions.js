// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Questions Database
// ===================================

const MISSION_SCENARIOS = [
    {
        id: 1,
        title: "SCENARIO ALPHA - PPE CHECKPOINT",
        threatLevel: "low",
        situation: "Agent must infiltrate the lab. Intelligence reports hazardous materials present. Select proper protective equipment before entry.",
        sceneType: "ppe",
        sceneHTML: `
            <div class="xray-scan"></div>
            <div style="font-size: 100px; animation: float 2s ease-in-out infinite;">
                🥽🧤🥼
            </div>
        `,
        options: [
            {
                text: "CASUAL ATTIRE",
                icon: "👕",
                description: "Regular clothing and open-toed shoes",
                correct: false
            },
            {
                text: "PARTIAL PPE",
                icon: "🥽",
                description: "Only safety goggles",
                correct: false
            },
            {
                text: "FULL PROTECTION",
                icon: "🥼",
                description: "Lab coat, goggles, gloves, closed shoes",
                correct: true
            },
            {
                text: "MINIMAL GEAR",
                icon: "🧤",
                description: "Only gloves",
                correct: false
            }
        ],
        explanation: "Full PPE is mandatory in laboratory environments. Lab coat protects clothing and skin, goggles protect eyes from splashes, gloves prevent hand contamination, and closed-toe shoes protect feet from spills and dropped objects.",
        correctAnswer: 2
    },
    {
        id: 2,
        title: "SCENARIO BRAVO - CHEMICAL IDENTIFICATION",
        threatLevel: "medium",
        situation: "Surveillance detected an unmarked container. Identify the hazard symbol to proceed safely.",
        sceneType: "chemical",
        sceneHTML: `
            <div class="infrared-effect"></div>
            <div class="heat-signature" style="top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
            <div style="font-size: 120px; animation: pulse 1.5s infinite;">
                ⚠️☣️☢️🔥
            </div>
        `,
        options: [
            {
                text: "CORROSIVE",
                icon: "🧪",
                description: "Acids and bases that burn skin",
                correct: false
            },
            {
                text: "FLAMMABLE",
                icon: "🔥",
                description: "Easily ignites and burns",
                correct: false
            },
            {
                text: "BIOHAZARD",
                icon: "☣️",
                description: "Biological agents, infectious materials",
                correct: true
            },
            {
                text: "RADIOACTIVE",
                icon: "☢️",
                description: "Emits harmful radiation",
                correct: false
            }
        ],
        explanation: "The biohazard symbol (☣️) indicates biological agents that pose a threat to human health. These include bacteria, viruses, and other microorganisms. Always handle with extreme caution and proper containment protocols.",
        correctAnswer: 2
    },
    {
        id: 3,
        title: "SCENARIO CHARLIE - FIRE PROTOCOL ALPHA",
        threatLevel: "high",
        situation: "CRITICAL: Target's lab coat has caught fire during experiment. Immediate action required!",
        sceneType: "fire",
        sceneHTML: `
            <div class="fire-effect">
                <div class="flame"></div>
            </div>
            <div class="alarm-light" style="left: 20px;"></div>
            <div class="alarm-light" style="right: 20px;"></div>
            <div style="font-size: 80px; margin-top: 200px; animation: shake 0.3s infinite;">
                🧑‍🔬🔥
            </div>
        `,
        options: [
            {
                text: "WATER SPRAY",
                icon: "💧",
                description: "Use water to extinguish",
                correct: false
            },
            {
                text: "FIRE BLANKET",
                icon: "🧯",
                description: "Smother flames with fire blanket",
                correct: true
            },
            {
                text: "FIRE EXTINGUISHER",
                icon: "🧴",
                description: "Spray with CO₂ extinguisher",
                correct: false
            },
            {
                text: "EVACUATE ONLY",
                icon: "🚪",
                description: "Leave immediately, no action",
                correct: false
            }
        ],
        explanation: "When a person's clothing is on fire, use a FIRE BLANKET to smother the flames by cutting off oxygen supply. Drop and roll is also effective. Never use a chemical fire extinguisher directly on a person as it can cause harm.",
        correctAnswer: 1
    },
    {
        id: 4,
        title: "SCENARIO DELTA - CONTAMINATION ALERT",
        threatLevel: "high",
        situation: "Chemical spill detected in Sector 7. Corrosive substance spreading. What is your first action?",
        sceneType: "spill",
        sceneHTML: `
            <div class="biohazard-effect">⚠️</div>
            <div style="margin-top: 20px; font-size: 60px;">
                <div style="animation: pulse 0.5s infinite;">💧💦</div>
                <div style="color: #ff8800; margin-top: 10px;">☣️ CONTAMINATION ZONE ☣️</div>
            </div>
        `,
        options: [
            {
                text: "ALERT SUPERVISOR",
                icon: "📢",
                description: "Immediately notify teacher/supervisor",
                correct: true
            },
            {
                text: "CLEAN YOURSELF",
                icon: "🧹",
                description: "Attempt cleanup alone",
                correct: false
            },
            {
                text: "IGNORE & CONTINUE",
                icon: "➡️",
                description: "Report later, continue work",
                correct: false
            },
            {
                text: "ASK CLASSMATE",
                icon: "👥",
                description: "Get peer assistance first",
                correct: false
            }
        ],
        explanation: "ALWAYS immediately alert your teacher or supervisor about any chemical spill. They are trained to handle hazardous situations and have access to proper cleanup equipment and safety protocols.",
        correctAnswer: 0
    },
    {
        id: 5,
        title: "SCENARIO ECHO - MIXING PROTOCOL",
        threatLevel: "high",
        situation: "Mission requires diluting concentrated sulfuric acid with water. Choose the CORRECT method to prevent exothermic reaction.",
        sceneType: "mixing",
        sceneHTML: `
            <div class="particle-system">
                ${Array.from({length: 20}, (_, i) => `
                    <div class="particle" style="
                        left: ${Math.random() * 100}%;
                        top: ${Math.random() * 100}%;
                        --tx: ${(Math.random() - 0.5) * 200}px;
                        --ty: ${(Math.random() - 0.5) * 200}px;
                        animation-delay: ${Math.random() * 3}s;
                    "></div>
                `).join('')}
            </div>
            <div style="font-size: 80px; animation: pulse 1s infinite;">
                🧪 + 💧 = ?
            </div>
        `,
        options: [
            {
                text: "WATER TO ACID",
                icon: "💥",
                description: "Pour water into acid",
                correct: false
            },
            {
                text: "QUICK MIX",
                icon: "🌀",
                description: "Mix both quickly together",
                correct: false
            },
            {
                text: "ACID TO WATER",
                icon: "✅",
                description: "Slowly add acid to water",
                correct: true
            },
            {
                text: "EQUAL PORTIONS",
                icon: "⚖️",
                description: "Pour equal amounts simultaneously",
                correct: false
            }
        ],
        explanation: "CRITICAL PROTOCOL: Always add ACID to WATER, never water to acid! The reaction releases significant heat. Adding acid to water allows the larger volume of water to dissipate the heat safely. Water to acid causes violent boiling and splattering.",
        correctAnswer: 2
    },
    {
        id: 6,
        title: "SCENARIO FOXTROT - LAB RESPONSIBILITY",
        threatLevel: "low",
        situation: "Experiment complete. Lab station contains used equipment and chemical residue. Determine cleanup responsibility.",
        sceneType: "cleanup",
        sceneHTML: `
            <div style="font-size: 70px;">
                <div style="animation: float 2s ease-in-out infinite;">🧪⚗️🔬</div>
                <div style="margin-top: 20px; font-size: 40px;">
                    ❓ WHO CLEANS ❓
                </div>
            </div>
        `,
        options: [
            {
                text: "TEACHER ONLY",
                icon: "👨‍🏫",
                description: "Only the teacher cleans",
                correct: false
            },
            {
                text: "LAB ASSISTANT",
                icon: "🧑‍🔬",
                description: "Designated lab assistant",
                correct: false
            },
            {
                text: "ALL STUDENTS",
                icon: "👥",
                description: "Everyone who used the lab",
                correct: true
            },
            {
                text: "NEXT CLASS",
                icon: "⏰",
                description: "Leave for next period",
                correct: false
            }
        ],
        explanation: "Lab safety is EVERYONE'S responsibility. All students who use lab equipment and materials must clean their work area, properly dispose of waste, and return equipment. This ensures safety for the next users.",
        correctAnswer: 2
    },
    {
        id: 7,
        title: "SCENARIO GOLF - FLAMMABLE MATERIALS",
        threatLevel: "medium",
        situation: "Alcohol and other flammable solvents must be stored. Identify the PROHIBITED location.",
        sceneType: "storage",
        sceneHTML: `
            <div class="fire-effect" style="position: absolute; right: 20px; top: 20px;">
                <div class="flame"></div>
            </div>
            <div style="font-size: 80px; display: flex; gap: 30px; align-items: center;">
                <div>🧪</div>
                <div style="animation: pulse 0.8s infinite; color: #ff8800;">⚠️</div>
                <div style="animation: flicker 0.5s infinite;">🔥</div>
            </div>
        `,
        options: [
            {
                text: "VENTILATED CABINET",
                icon: "🗄️",
                description: "Proper chemical storage cabinet",
                correct: false
            },
            {
                text: "COOL DARK AREA",
                icon: "🌡️",
                description: "Temperature-controlled space",
                correct: false
            },
            {
                text: "NEAR BURNER",
                icon: "🔥",
                description: "Next to Bunsen burner/heat source",
                correct: true
            },
            {
                text: "LABELED SHELF",
                icon: "📦",
                description: "Designated flammable shelf",
                correct: false
            }
        ],
        explanation: "NEVER store flammable materials near heat sources, open flames, or Bunsen burners! Flammable liquids have low ignition points and can easily catch fire, causing explosions. Store in designated cabinets away from heat.",
        correctAnswer: 2
    },
    {
        id: 8,
        title: "SCENARIO HOTEL - ACCESS CONTROL",
        threatLevel: "low",
        situation: "Laboratory door is locked. Agent needs access. Determine authorized entry protocol.",
        sceneType: "access",
        sceneHTML: `
            <div style="font-size: 100px; animation: pulse 1.5s infinite;">
                🚪🔒
            </div>
            <div style="font-size: 50px; margin-top: 30px; color: var(--accent-blue);">
                <div>👨‍🏫 SUPERVISOR REQUIRED?</div>
            </div>
        `,
        options: [
            {
                text: "ANYTIME ACCESS",
                icon: "🕐",
                description: "Enter whenever school is open",
                correct: false
            },
            {
                text: "WITH PERMISSION",
                icon: "✅",
                description: "Only with teacher authorization",
                correct: true
            },
            {
                text: "DURING CLASS",
                icon: "📚",
                description: "Only during scheduled class",
                correct: false
            },
            {
                text: "PEER ESCORT",
                icon: "👥",
                description: "With another student",
                correct: false
            }
        ],
        explanation: "NEVER enter a science laboratory without teacher permission and supervision. Labs contain hazardous materials and equipment that require trained oversight. Unauthorized access poses serious safety risks.",
        correctAnswer: 1
    },
    {
        id: 9,
        title: "SCENARIO INDIA - BEHAVIOR PROTOCOL",
        threatLevel: "medium",
        situation: "Multiple agents operating in confined lab space. Identify the STRICTLY FORBIDDEN behavior.",
        sceneType: "behavior",
        sceneHTML: `
            <div style="font-size: 80px;">
                <div style="display: flex; gap: 20px; justify-content: center;">
                    <div style="animation: float 1s ease-in-out infinite;">🧑‍🔬</div>
                    <div style="animation: shake 0.3s infinite;">🏃</div>
                    <div style="animation: float 1.5s ease-in-out infinite;">🧪</div>
                </div>
                <div style="margin-top: 30px; font-size: 60px; color: #ff0000;">
                    ⛔ PROHIBITED ⛔
                </div>
            </div>
        `,
        options: [
            {
                text: "QUIET DISCUSSION",
                icon: "🤫",
                description: "Quietly talking with lab partners",
                correct: false
            },
            {
                text: "TAKING NOTES",
                icon: "📝",
                description: "Writing observations",
                correct: false
            },
            {
                text: "RUNNING/HORSEPLAY",
                icon: "🏃",
                description: "Running around or playing",
                correct: true
            },
            {
                text: "ASKING QUESTIONS",
                icon: "❓",
                description: "Seeking clarification from teacher",
                correct: false
            }
        ],
        explanation: "Running, horseplay, and playing around are STRICTLY FORBIDDEN in the lab. These behaviors can cause accidents, spills, fires, or injuries. Labs require calm, focused behavior at all times for everyone's safety.",
        correctAnswer: 2
    },
    {
        id: 10,
        title: "SCENARIO JULIET - FINAL PROTOCOL",
        threatLevel: "high",
        situation: "MISSION CRITICAL: Examining biological pond water samples under microscope. Identify the MOST DANGEROUS action.",
        sceneType: "biological",
        sceneHTML: `
            <div class="microscope-view" style="position: relative; margin: 0 auto;">
                ${Array.from({length: 5}, (_, i) => `
                    <div class="microorganism" style="
                        top: ${Math.random() * 80 + 10}%;
                        left: ${Math.random() * 80 + 10}%;
                        animation-delay: ${i * 0.8}s;
                    "></div>
                `).join('')}
            </div>
            <div style="font-size: 50px; margin-top: 30px; color: #ff0000; animation: pulse 1s infinite;">
                🦠 BIOHAZARD WARNING 🦠
            </div>
        `,
        options: [
            {
                text: "WEAR GLOVES",
                icon: "🧤",
                description: "Put on protective gloves",
                correct: false
            },
            {
                text: "USE GOGGLES",
                icon: "🥽",
                description: "Wear safety goggles",
                correct: false
            },
            {
                text: "TASTE SAMPLE",
                icon: "👅",
                description: "Taste a small amount",
                correct: true
            },
            {
                text: "PROPER DISPOSAL",
                icon: "🗑️",
                description: "Dispose in designated waste",
                correct: false
            }
        ],
        explanation: "NEVER taste, smell, or ingest ANY laboratory substance! Even 'harmless' water samples can contain dangerous microorganisms, parasites, bacteria, or chemical contaminants that cause serious illness or death. Use only your eyes and instruments.",
        correctAnswer: 2
    }
];

// Badge definitions
const BADGES = [
    {
        id: "speed",
        name: "SPEED OPERATIVE",
        description: "Completed 5 scenarios in under 8 seconds each",
        icon: "⚡",
        requirement: (stats) => stats.quickAnswers >= 5
    },
    {
        id: "perfect",
        name: "PERFECT PROTOCOL",
        description: "All scenarios executed correctly",
        icon: "🏆",
        requirement: (stats) => stats.correctAnswers === MISSION_SCENARIOS.length
    },
    {
        id: "safety",
        name: "SAFETY SPECIALIST",
        description: "All emergency scenarios handled correctly",
        icon: "🛡️",
        requirement: (stats) => {
            // Emergency scenarios: 3 (Fire), 4 (Spill), 5 (Mixing), 10 (Biological)
            const emergencyIds = [3, 4, 5, 10];
            return emergencyIds.every(id => stats.correctScenarios.includes(id));
        }
    },
    {
        id: "streak",
        name: "STREAK MASTER",
        description: "5 consecutive correct protocols",
        icon: "🔥",
        requirement: (stats) => stats.maxStreak >= 5
    }
];

// Agent levels
const AGENT_LEVELS = [
    {
        name: "RECRUIT",
        minPoints: 0,
        maxPoints: 30,
        startingPoints: 0
    },
    {
        name: "FIELD AGENT",
        minPoints: 30,
        maxPoints: 60,
        startingPoints: 30
    },
    {
        name: "SPECIAL OPS",
        minPoints: 60,
        maxPoints: 90,
        startingPoints: 60
    },
    {
        name: "IMF DIRECTOR",
        minPoints: 90,
        maxPoints: 150,
        startingPoints: 90
    }
];

// Get current agent level based on points
function getAgentLevel(points) {
    for (let i = AGENT_LEVELS.length - 1; i >= 0; i--) {
        if (points >= AGENT_LEVELS[i].minPoints) {
            return AGENT_LEVELS[i];
        }
    }
    return AGENT_LEVELS[0];
}
