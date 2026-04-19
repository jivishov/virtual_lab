const stages = [
  {
    short: "Entry",
    title: "Viral Entry",
    description:
      "Viruses enter through exposed areas like the throat or nasal cavity and reach nearby cells.",
    caption: "At this point, viruses are still outside cells and searching for a target.",
    nodeStatus: "Waiting for dendritic cell message...",
    host: { alert: false, burst: false, signal: false },
    scene: {
      viruses: { count: 16, xMin: 8, xMax: 86, yMin: 10, yMax: 38, bound: 0 },
      debris: { count: 0 },
      neutrophils: { count: 0 },
      macrophages: { count: 0 },
      dendritic: { count: 0, traveling: false },
      antibodies: { count: 0 }
    },
    nodeCells: []
  },
  {
    short: "Takeover",
    title: "Cell Takeover",
    description:
      "A virus enters a host cell and injects genetic instructions (DNA or RNA), pushing the cell to make virus copies.",
    caption: "The host cell is now a virus factory.",
    nodeStatus: "No adaptive response yet.",
    host: { alert: true, burst: false, signal: false },
    scene: {
      viruses: { count: 14, xMin: 32, xMax: 58, yMin: 42, yMax: 69, bound: 0 },
      debris: { count: 0 },
      neutrophils: { count: 0 },
      macrophages: { count: 0 },
      dendritic: { count: 0, traveling: false },
      antibodies: { count: 0 }
    },
    nodeCells: []
  },
  {
    short: "Lysis",
    title: "Cell Lysis (Bursting)",
    description:
      "After enough copies are made, the host cell bursts and releases many viruses plus damaged cell material.",
    caption:
      "This violent rupture is a danger signal. It looks different from normal, tidy cell death.",
    nodeStatus: "Innate immune system is being alerted.",
    host: { alert: true, burst: true, signal: true },
    scene: {
      viruses: { count: 24, xMin: 26, xMax: 74, yMin: 32, yMax: 80, bound: 0 },
      debris: { count: 28, xMin: 23, xMax: 75, yMin: 31, yMax: 80 },
      neutrophils: { count: 0 },
      macrophages: { count: 0 },
      dendritic: { count: 0, traveling: false },
      antibodies: { count: 0 }
    },
    nodeCells: []
  },
  {
    short: "Innate",
    title: "Innate Immune Alarm",
    description:
      "Neutrophils and macrophages sense danger, rush in, release signals, and begin devouring viral particles.",
    caption:
      "Phagocytes clean up debris and call in help through inflammation signals.",
    nodeStatus: "Dendritic cells are scanning debris.",
    host: { alert: true, burst: false, signal: true },
    scene: {
      viruses: { count: 18, xMin: 20, xMax: 80, yMin: 28, yMax: 84, bound: 0 },
      debris: { count: 18, xMin: 24, xMax: 73, yMin: 33, yMax: 78 },
      neutrophils: { count: 9, xMin: 10, xMax: 88, yMin: 44, yMax: 88 },
      macrophages: { count: 6, xMin: 13, xMax: 90, yMin: 48, yMax: 88 },
      dendritic: { count: 3, xMin: 20, xMax: 74, yMin: 36, yMax: 72, traveling: false },
      antibodies: { count: 0 }
    },
    nodeCells: [{ label: "Dendritic scouts", type: "dendritic", count: 1 }]
  },
  {
    short: "Handoff",
    title: "Dendritic Handoff",
    description:
      "Dendritic cells carry viral fragments to lymph nodes, where they search for matching T and B cell receptors.",
    caption:
      "This search can take days in real life before the exact match is found.",
    nodeStatus: "Dendritic cells arrived with viral antigens.",
    host: { alert: true, burst: false, signal: true },
    scene: {
      viruses: { count: 11, xMin: 18, xMax: 80, yMin: 30, yMax: 84, bound: 0 },
      debris: { count: 11, xMin: 25, xMax: 72, yMin: 33, yMax: 76 },
      neutrophils: { count: 7, xMin: 10, xMax: 88, yMin: 48, yMax: 90 },
      macrophages: { count: 5, xMin: 12, xMax: 88, yMin: 48, yMax: 90 },
      dendritic: { count: 5, xMin: 30, xMax: 83, yMin: 25, yMax: 52, traveling: true },
      antibodies: { count: 0 }
    },
    nodeCells: [{ label: "Dendritic presenters", type: "dendritic", count: 2 }]
  },
  {
    short: "Activate",
    title: "T & B Cell Activation",
    description:
      "Matched T cells activate and clone. They then help activate B cells, which prepare to release targeted antibodies.",
    caption:
      "Adaptive immunity is now specific to this virus, not a generic response.",
    nodeStatus: "Matching receptors found. Clonal expansion underway.",
    host: { alert: true, burst: false, signal: true },
    scene: {
      viruses: { count: 9, xMin: 18, xMax: 80, yMin: 32, yMax: 84, bound: 0 },
      debris: { count: 7, xMin: 22, xMax: 72, yMin: 34, yMax: 74 },
      neutrophils: { count: 6, xMin: 10, xMax: 88, yMin: 48, yMax: 90 },
      macrophages: { count: 5, xMin: 12, xMax: 88, yMin: 48, yMax: 90 },
      dendritic: { count: 3, xMin: 28, xMax: 78, yMin: 28, yMax: 55, traveling: false },
      antibodies: { count: 0 }
    },
    nodeCells: [
      { label: "Activated T cells", type: "tcell", count: 6 },
      { label: "Activated B cells", type: "bcell", count: 6 }
    ]
  },
  {
    short: "Antibodies",
    title: "Antibody Flood",
    description:
      "B cells release antibodies that bind virus particles and block them from entering more cells.",
    caption:
      "Bound viruses are easier targets for phagocytes and cannot infect as effectively.",
    nodeStatus: "B cells are pumping out antibodies.",
    host: { alert: true, burst: false, signal: false },
    scene: {
      viruses: { count: 8, xMin: 20, xMax: 80, yMin: 34, yMax: 84, bound: 8 },
      debris: { count: 3, xMin: 24, xMax: 72, yMin: 36, yMax: 76 },
      neutrophils: { count: 6, xMin: 12, xMax: 88, yMin: 48, yMax: 90 },
      macrophages: { count: 6, xMin: 10, xMax: 88, yMin: 48, yMax: 90 },
      dendritic: { count: 2, xMin: 30, xMax: 78, yMin: 30, yMax: 60, traveling: false },
      antibodies: { count: 17, xMin: 16, xMax: 86, yMin: 34, yMax: 86 }
    },
    nodeCells: [
      { label: "Helper T cells", type: "tcell", count: 8 },
      { label: "Plasma B cells", type: "bcell", count: 8 }
    ]
  },
  {
    short: "Clear",
    title: "Clearance & Recovery",
    description:
      "Phagocytes finish cleanup, neutralized viruses are removed, and infection resolves.",
    caption:
      "The immune system returns to baseline after eliminating infected debris and viral particles.",
    nodeStatus: "Threat cleared. Memory cells remain for faster future defense.",
    host: { alert: false, burst: false, signal: false },
    scene: {
      viruses: { count: 2, xMin: 22, xMax: 75, yMin: 40, yMax: 76, bound: 2 },
      debris: { count: 2, xMin: 26, xMax: 72, yMin: 42, yMax: 76 },
      neutrophils: { count: 4, xMin: 12, xMax: 85, yMin: 50, yMax: 90 },
      macrophages: { count: 4, xMin: 12, xMax: 86, yMin: 50, yMax: 90 },
      dendritic: { count: 1, xMin: 30, xMax: 70, yMin: 26, yMax: 54, traveling: false },
      antibodies: { count: 8, xMin: 18, xMax: 85, yMin: 36, yMax: 86 }
    },
    nodeCells: [
      { label: "Memory T cells", type: "tcell", count: 3 },
      { label: "Memory B cells", type: "bcell", count: 3 }
    ]
  }
];

const cellFocusTimeline = [
  {
    status: "Stable cell",
    focus: "Viruses are near the membrane, but no viral genes are inside this cell yet.",
    copies: 0,
    integrity: 100,
    genome: "Outside cell",
    checkpoint: 1,
    state: "normal",
    injection: false,
    burst: false,
    complete: false
  },
  {
    status: "Hijacked cell",
    focus: "Viral genetic material is injected into the cell and starts forcing the cell to build virus parts.",
    copies: 14,
    integrity: 72,
    genome: "Injected and replicating",
    checkpoint: 3,
    state: "infected",
    injection: true,
    burst: false,
    complete: false
  },
  {
    status: "Cell lysis",
    focus: "The overloaded cell membrane ruptures and virus copies spill out into nearby tissue.",
    copies: 4,
    integrity: 8,
    genome: "Released into tissue",
    checkpoint: 4,
    state: "burst",
    injection: false,
    burst: true,
    complete: false
  },
  {
    status: "Destroyed cell",
    focus: "The infected cell is gone. Debris and free viral particles trigger immune cleanup.",
    copies: 0,
    integrity: 15,
    genome: "Fragments remain",
    checkpoint: 5,
    state: "damaged",
    injection: false,
    burst: false,
    complete: false
  },
  {
    status: "Damage under cleanup",
    focus: "Dendritic cells carry viral fragments away while local phagocytes continue removing debris.",
    copies: 0,
    integrity: 30,
    genome: "Antigen fragments only",
    checkpoint: 5,
    state: "damaged",
    injection: false,
    burst: false,
    complete: false
  },
  {
    status: "Adaptive response building",
    focus: "No new takeover here. T and B cells are being activated in lymph nodes to target this virus.",
    copies: 0,
    integrity: 52,
    genome: "No active takeover",
    checkpoint: 5,
    state: "damaged",
    injection: false,
    burst: false,
    complete: false
  },
  {
    status: "Protected tissue",
    focus: "Antibodies now block viral entry, making it hard for nearby healthy cells to be hijacked.",
    copies: 0,
    integrity: 78,
    genome: "Blocked by antibodies",
    checkpoint: 5,
    state: "recovered",
    injection: false,
    burst: false,
    complete: false
  },
  {
    status: "Recovered",
    focus: "Infected debris is mostly cleared and tissue is returning to normal with immune memory left behind.",
    copies: 0,
    integrity: 96,
    genome: "No active infection",
    checkpoint: 5,
    state: "recovered",
    injection: false,
    burst: false,
    complete: true
  }
];

const stageActionSummaries = [
  "Viruses drift through exposed airway tissue and probe for a vulnerable host cell.",
  "Viral genes cross the membrane and the host cell starts producing viral building blocks.",
  "Cell lysis releases a burst of new viruses plus inflammatory debris into local tissue.",
  "Neutrophils and macrophages lock onto targets, engulf viral particles, and digest them.",
  "Dendritic cells collect antigen fragments and migrate toward the lymph-node corridor.",
  "Dendritic cells test receptor matches, then trigger T-cell and B-cell activation.",
  "Antibodies bind viral spikes, neutralizing entry while phagocytes clear bound particles.",
  "Residual viruses are consumed, debris is removed, and local tissue stabilizes."
];

const stageActionBullets = [
  [
    "Viruses remain outside the host-cell membrane.",
    "No antibodies are present yet.",
    "Innate immune patrol is still minimal."
  ],
  [
    "Viral DNA/RNA instructions are active inside the host cell.",
    "Replication pressure begins to lower cell integrity.",
    "New particles accumulate before release."
  ],
  [
    "Bursting differs from neat programmed cell death.",
    "Spilled contents amplify danger signaling.",
    "More nearby cells are now at risk of infection."
  ],
  [
    "Phagocytes chase specific viral targets instead of random roaming.",
    "Engulfed viruses are digested and removed from the scene.",
    "Dendritic scouts sample debris for antigen clues."
  ],
  [
    "Dendritic cells carry antigen fragments to lymph tissue.",
    "Local phagocytes continue cleanup in parallel.",
    "Adaptive-response search is now in progress."
  ],
  [
    "Matched T cells begin clonal expansion.",
    "Activated T cells help activate B cells.",
    "B cells prepare targeted antibody production."
  ],
  [
    "Antibodies coat free viruses and block receptor entry.",
    "Bound viruses are easier for phagocytes to capture.",
    "Viral spread drops rapidly."
  ],
  [
    "Final engulfment removes remaining infectious particles.",
    "Inflammatory signals taper as danger decreases.",
    "Memory cells remain for faster future response."
  ]
];

const nodeActionDetails = [
  "No antigen briefing in the lymph node yet. T and B cells remain on standby.",
  "Lymph node remains in baseline surveillance while local infection escalates.",
  "Innate alarms rise, but adaptive matching has not started in the node.",
  "Dendritic cells begin preparing antigen fragments for transport.",
  "Dendritic cells enter the node and scan many T/B cells for matching receptors.",
  "Receptor match found: dendritic cells activate T cells, then B cells, triggering clonal expansion.",
  "Activated B cells drive antibody output; activated T cells coordinate focused immune support.",
  "Threat archived: memory T and B cells persist for faster secondary response."
];

const nodeStageChecklist = [
  ["Standby scan of circulating cells", "No antigen match yet", "Adaptive cells remain idle"],
  ["Background surveillance continues", "No dendritic antigen handoff", "No clonal expansion signals"],
  ["Inflammatory alerts rising", "Node receives early context", "Receptor matching not active yet"],
  ["Dendritic antigen packaging", "Migration corridor opens", "T/B receptor search preparing"],
  ["Dendritic scan across T/B cells", "Candidate receptor checks", "Best match signal locked in"],
  ["Matched T cells activated", "B-cell activation follows", "Clonal expansion accelerates"],
  ["B cells release antibody orders", "Helper T cells coordinate response", "Effector pool is sustained"],
  ["Memory-cell archive retained", "Effector traffic decreases", "Node returns to baseline watch"]
];

const epithelialBackdropLayout = [
  { x: 8, y: 24, w: 90, h: 50, r: -7, o: 0.46 },
  { x: 22, y: 26, w: 84, h: 48, r: 6, o: 0.42 },
  { x: 36, y: 23, w: 92, h: 52, r: -5, o: 0.44 },
  { x: 52, y: 25, w: 88, h: 50, r: 7, o: 0.42 },
  { x: 67, y: 24, w: 86, h: 48, r: -6, o: 0.44 },
  { x: 82, y: 26, w: 90, h: 51, r: 5, o: 0.42 },
  { x: 95, y: 24, w: 82, h: 46, r: -8, o: 0.45 },
  { x: 7, y: 44, w: 96, h: 54, r: -6, o: 0.54 },
  { x: 21, y: 46, w: 92, h: 52, r: 5, o: 0.56 },
  { x: 36, y: 45, w: 98, h: 56, r: -7, o: 0.55 },
  { x: 50, y: 47, w: 90, h: 52, r: 6, o: 0.54 },
  { x: 64, y: 45, w: 96, h: 55, r: -4, o: 0.56 },
  { x: 79, y: 46, w: 92, h: 54, r: 7, o: 0.54 },
  { x: 93, y: 44, w: 88, h: 50, r: -5, o: 0.55 },
  { x: 9, y: 63, w: 100, h: 58, r: -8, o: 0.6 },
  { x: 24, y: 65, w: 94, h: 54, r: 6, o: 0.62 },
  { x: 39, y: 64, w: 102, h: 60, r: -6, o: 0.6 },
  { x: 53, y: 66, w: 96, h: 56, r: 4, o: 0.62 },
  { x: 68, y: 64, w: 100, h: 58, r: -7, o: 0.6 },
  { x: 83, y: 65, w: 94, h: 55, r: 6, o: 0.62 },
  { x: 97, y: 63, w: 88, h: 52, r: -5, o: 0.6 },
  { x: 11, y: 82, w: 104, h: 62, r: -6, o: 0.66 },
  { x: 27, y: 84, w: 96, h: 57, r: 8, o: 0.68 },
  { x: 43, y: 83, w: 106, h: 62, r: -7, o: 0.66 },
  { x: 58, y: 85, w: 98, h: 58, r: 5, o: 0.68 },
  { x: 73, y: 83, w: 104, h: 61, r: -8, o: 0.66 },
  { x: 88, y: 84, w: 96, h: 57, r: 6, o: 0.68 }
];

const ambientTypeZones = {
  virus: { yMin: 10, yMax: 34, scaleMin: 0.84, scaleMax: 0.96, oMin: 0.16, oMax: 0.22 },
  neutrophil: { yMin: 44, yMax: 86, scaleMin: 0.9, scaleMax: 1.02, oMin: 0.18, oMax: 0.24 },
  macrophage: { yMin: 46, yMax: 88, scaleMin: 0.94, scaleMax: 1.06, oMin: 0.18, oMax: 0.24 },
  dendritic: { yMin: 42, yMax: 84, scaleMin: 0.92, scaleMax: 1.04, oMin: 0.18, oMax: 0.24 },
  antibody: { yMin: 58, yMax: 88, scaleMin: 0.88, scaleMax: 0.98, oMin: 0.16, oMax: 0.22 }
};

const entityInspectorProfiles = {
  host: {
    displayName: "Host Epithelial Cell",
    category: "Human Tissue Cell (Infection Target)",
    functionText:
      "Forms the airway lining and normally protects tissue, but can be hijacked by viruses to produce new viral particles.",
    characteristics: [
      "Acts as a physical barrier in throat and nasal tissue.",
      "Contains normal DNA machinery for healthy cell functions.",
      "Can be reprogrammed by viral genetic instructions.",
      "When overloaded by viral copies, it may rupture (lysis)."
    ],
    interiorParts: [
      { label: "Cell membrane", className: "membrane", x: 50, y: 22 },
      { label: "Nucleus", className: "mac-nucleus", x: 48, y: 54 },
      { label: "Cytoplasm", className: "cytoplasm", x: 62, y: 66 },
      { label: "Ribosomes", className: "ribosomes", x: 36, y: 66 }
    ]
  },
  virus: {
    displayName: "Respiratory Virus Particle",
    category: "Pathogen",
    functionText:
      "Binds host-cell receptors, delivers genetic instructions, and turns the cell into a virus-copy factory.",
    characteristics: [
      "Has outer spike proteins used to attach to host cells.",
      "Carries compact genetic payload (DNA or RNA instructions).",
      "Cannot reproduce alone; it must hijack a host cell.",
      "Once released, each particle can infect another nearby cell."
    ],
    interiorParts: [
      { label: "Spike proteins", className: "spikes", x: 24, y: 36 },
      { label: "Lipid envelope", className: "envelope", x: 50, y: 25 },
      { label: "Genetic payload", className: "genome", x: 50, y: 52 },
      { label: "Capsid shell", className: "capsid", x: 64, y: 66 }
    ]
  },
  neutrophil: {
    displayName: "Neutrophil",
    category: "Innate Immune Cell (Rapid Responder)",
    functionText:
      "Arrives quickly at infection sites, engulfs microbes, and releases antimicrobial enzymes to destroy them.",
    characteristics: [
      "One of the first immune cells to respond to tissue damage.",
      "Uses phagocytosis to swallow and digest pathogens.",
      "Contains enzyme-rich granules for microbial killing.",
      "Short-lived but very fast and abundant during acute infection."
    ],
    interiorParts: [
      { label: "Segmented nucleus", className: "lobed-nucleus", x: 50, y: 50 },
      { label: "Granules", className: "granules", x: 34, y: 64 },
      { label: "Phagolysosome", className: "phagolysosome", x: 66, y: 62 },
      { label: "Receptors", className: "receptors", x: 26, y: 36 }
    ]
  },
  macrophage: {
    displayName: "Macrophage",
    category: "Innate Immune Cell (Cleanup + Signaling)",
    functionText:
      "Engulfs pathogens and debris, digests them, and releases cytokine signals to coordinate further immune action.",
    characteristics: [
      "Large phagocyte specialized for cleanup and containment.",
      "Can keep engulfing many particles over time.",
      "Releases inflammatory signals to recruit other cells.",
      "Helps bridge innate and adaptive immune responses."
    ],
    interiorParts: [
      { label: "Nucleus", className: "mac-nucleus", x: 48, y: 52 },
      { label: "Lysosomes", className: "lysosomes", x: 34, y: 64 },
      { label: "Phagosome", className: "phagosome", x: 66, y: 60 },
      { label: "Signal vesicles", className: "vesicles", x: 58, y: 34 }
    ]
  },
  dendritic: {
    displayName: "Dendritic Cell",
    category: "Antigen-Presenting Immune Cell",
    functionText:
      "Samples pathogen fragments in tissue, then travels to lymph nodes to present antigens and activate T/B responses.",
    characteristics: [
      "Acts as a messenger from infection site to lymph node.",
      "Displays antigen fragments for receptor matching.",
      "Critical for activating targeted adaptive immunity.",
      "Coordinates T-cell priming and downstream B-cell activation."
    ],
    interiorParts: [
      { label: "Antigen vesicles", className: "antigen-vesicles", x: 62, y: 60 },
      { label: "Presentation complex", className: "presentation", x: 44, y: 30 },
      { label: "Dendrite arms", className: "arms", x: 46, y: 56 },
      { label: "Chemokine receptors", className: "chemokine", x: 26, y: 42 }
    ]
  },
  tcell: {
    displayName: "T Cell",
    category: "Adaptive Immune Cell",
    functionText:
      "Recognizes specific antigens presented by dendritic cells, then expands and coordinates targeted immune responses.",
    characteristics: [
      "Activated only when its receptor matches the presented antigen.",
      "Rapidly clones after activation (clonal expansion).",
      "Helper T cells boost B-cell antibody production.",
      "Memory T cells remain for faster responses to future infections."
    ],
    interiorParts: [
      { label: "T-cell receptor complex", className: "receptors", x: 24, y: 42 },
      { label: "Signaling proteins", className: "presentation", x: 54, y: 34 },
      { label: "Nucleus", className: "mac-nucleus", x: 48, y: 56 },
      { label: "Cytokine vesicles", className: "vesicles", x: 66, y: 64 }
    ]
  },
  bcell: {
    displayName: "B Cell",
    category: "Adaptive Immune Cell",
    functionText:
      "After activation, differentiates into plasma cells that produce antibodies targeting the specific virus.",
    characteristics: [
      "Uses antigen-specific B-cell receptors for target recognition.",
      "Activated with T-cell help after receptor matching.",
      "Can become plasma cells that release high antibody volumes.",
      "Memory B cells remain and speed up later antibody responses."
    ],
    interiorParts: [
      { label: "B-cell receptor complex", className: "receptors", x: 24, y: 38 },
      { label: "Antibody assembly vesicles", className: "vesicles", x: 66, y: 62 },
      { label: "Endoplasmic reticulum", className: "envelope", x: 52, y: 30 },
      { label: "Nucleus", className: "mac-nucleus", x: 48, y: 56 }
    ]
  },
  antibody: {
    displayName: "Antibody (Immune Protein)",
    category: "Adaptive Immune Molecule",
    functionText:
      "Binds specific viral targets and blocks entry into cells, making viruses easier for phagocytes to clear.",
    characteristics: [
      "Not a cell: a Y-shaped immune protein made by B cells.",
      "Highly specific binding to viral antigens.",
      "Neutralizes pathogens by blocking receptor interactions.",
      "Tags bound particles for faster cleanup by phagocytes."
    ],
    interiorParts: [
      { label: "Antigen-binding arms", className: "arms", x: 32, y: 34 },
      { label: "Hinge region", className: "hinge", x: 50, y: 52 },
      { label: "Constant region", className: "constant", x: 62, y: 36 },
      { label: "Effector tail", className: "tail", x: 50, y: 70 }
    ]
  }
};

const inspectableEntityTypes = new Set(Object.keys(entityInspectorProfiles));

const quizData = [
  {
    question: "What usually alerts neutrophils and macrophages first in this model?",
    options: [
      "Violent cell rupture and spilled cell contents",
      "A normal programmed cell death package",
      "Antibodies from B cells",
      "Signals from memory cells"
    ],
    answer: 0,
    explain:
      "Correct. Sudden rupture (lysis) creates strong danger signals that trigger innate immune cells."
  },
  {
    question: "Which cell carries viral fragments to the lymphatic system?",
    options: ["Neutrophil", "Dendritic cell", "Macrophage", "Red blood cell"],
    answer: 1,
    explain:
      "Dendritic cells present antigen to matching T and B cells in lymph nodes."
  },
  {
    question: "Why can adaptive response take a few days?",
    options: [
      "T and B cells need to find matching receptors and clone",
      "Viruses stop moving at night",
      "Macrophages only work once per day",
      "Antibodies are made in the throat directly"
    ],
    answer: 0,
    explain:
      "Matching and clonal expansion takes time before enough targeted cells and antibodies are produced."
  },
  {
    question: "What is the main antibody job in this activity?",
    options: [
      "Burst host cells",
      "Build new cells",
      "Bind viruses and block cell entry",
      "Convert B cells into dendritic cells"
    ],
    answer: 2,
    explain:
      "Antibodies neutralize viruses by binding them and reducing their ability to infect new cells."
  },
  {
    question: "Which sequence is most accurate?",
    options: [
      "Entry -> lysis -> innate response -> antigen handoff -> T/B activation -> antibodies -> clearance",
      "Antibodies -> entry -> lysis -> clearance",
      "T cells first -> virus entry -> B cells next",
      "Clearance happens before cell infection"
    ],
    answer: 0,
    explain:
      "That order best matches the staged flow of infection and immune defense shown above."
  },
  {
    question: "What happens inside a host cell right before lysis in this simulation?",
    options: [
      "The cell makes many virus copies",
      "The cell turns into a dendritic cell",
      "The cell makes antibodies",
      "The cell becomes a memory cell"
    ],
    answer: 0,
    explain:
      "Before lysis, the infected host cell is hijacked and used as a virus-copy factory."
  },
  {
    question: "Which group below contains only phagocytes used in this activity?",
    options: [
      "Neutrophils, macrophages, dendritic cells",
      "B cells, red blood cells, platelets",
      "Antibodies, T cells, epithelial cells",
      "Viruses, macrophages, antibodies"
    ],
    answer: 0,
    explain:
      "Neutrophils, macrophages, and dendritic cells are phagocytes that sample or engulf particles."
  },
  {
    question: "After host-cell lysis, what is released into nearby tissue?",
    options: [
      "Only antibodies",
      "Only memory cells",
      "Virus particles and damaged cell debris",
      "Only T cells"
    ],
    answer: 2,
    explain:
      "Lysis releases both viral particles and spilled cell contents, which intensifies danger signals."
  },
  {
    question: "In the lymph node sequence shown here, dendritic cells activate which first?",
    options: ["B cells first, then T cells", "T cells first, then B cells", "Only B cells", "Only macrophages"],
    answer: 1,
    explain:
      "In this model, dendritic cells activate matched T cells, then B cells, leading to antibody production."
  },
  {
    question: "Why do antibody-coated viruses get cleared faster?",
    options: [
      "They can no longer be seen by immune cells",
      "They become host cells",
      "They are easier for phagocytes to recognize and remove",
      "They immediately turn into memory cells"
    ],
    answer: 2,
    explain:
      "Antibodies tag and neutralize viruses, making them easier targets for phagocyte cleanup."
  },
  {
    question: "What remains after the infection is mostly cleared?",
    options: [
      "Only free viruses",
      "Memory T and B cells for quicker future response",
      "No immune cells at all",
      "Only dendritic cells in tissue"
    ],
    answer: 1,
    explain:
      "Memory lymphocytes persist after recovery and help the body respond faster next time."
  }
];

const refs = {
  stageIndex: document.getElementById("stageIndex"),
  stageTotal: document.getElementById("stageTotal"),
  stageTitle: document.getElementById("stageTitle"),
  stageDescription: document.getElementById("stageDescription"),
  progressBar: document.getElementById("progressBar"),
  timelineCards: document.getElementById("timelineCards"),
  sceneCaption: document.getElementById("sceneCaption"),
  actionReadout: document.getElementById("actionReadout"),
  actionSummary: document.getElementById("actionSummary"),
  actionBullets: document.getElementById("actionBullets"),
  metricViruses: document.getElementById("metricViruses"),
  metricEngulfments: document.getElementById("metricEngulfments"),
  metricNeutralized: document.getElementById("metricNeutralized"),
  infectionScene: document.getElementById("infectionScene"),
  epithelialLayer: document.getElementById("epithelialLayer"),
  ambientCellLayer: document.getElementById("ambientCellLayer"),
  virusLayer: document.getElementById("virusLayer"),
  debrisLayer: document.getElementById("debrisLayer"),
  immuneLayer: document.getElementById("immuneLayer"),
  antibodyLayer: document.getElementById("antibodyLayer"),
  taskLayer: document.getElementById("taskLayer"),
  hostCell: document.getElementById("hostCell"),
  signalPulse: document.getElementById("signalPulse"),
  zoomCell: document.getElementById("zoomCell"),
  cellInjection: document.getElementById("cellInjection"),
  cellGenomeLayer: document.getElementById("cellGenomeLayer"),
  cellFactoryLayer: document.getElementById("cellFactoryLayer"),
  cellCopyLayer: document.getElementById("cellCopyLayer"),
  cellEgressLayer: document.getElementById("cellEgressLayer"),
  cellBurstMarks: document.getElementById("cellBurstMarks"),
  cellStatusBadge: document.getElementById("cellStatusBadge"),
  cellFocusText: document.getElementById("cellFocusText"),
  cellCopiesCount: document.getElementById("cellCopiesCount"),
  cellIntegrityValue: document.getElementById("cellIntegrityValue"),
  cellGenomeState: document.getElementById("cellGenomeState"),
  cellChecklist: document.getElementById("cellChecklist"),
  lymphStatus: document.getElementById("lymphStatus"),
  nodeActionText: document.getElementById("nodeActionText"),
  nodeScene: document.getElementById("nodeScene"),
  nodeChecklist: document.getElementById("nodeChecklist"),
  nodeSignalLayer: document.getElementById("nodeSignalLayer"),
  nodeTaskLayer: document.getElementById("nodeTaskLayer"),
  lymphCells: document.getElementById("lymphCells"),
  entityInspector: document.getElementById("entityInspector"),
  closeInspectorBtn: document.getElementById("closeInspectorBtn"),
  inspectorVisual: document.getElementById("inspectorVisual"),
  inspectorPartLayer: document.getElementById("inspectorPartLayer"),
  inspectorTitle: document.getElementById("inspectorTitle"),
  inspectorCategory: document.getElementById("inspectorCategory"),
  inspectorFunction: document.getElementById("inspectorFunction"),
  inspectorPrompt: document.getElementById("inspectorPrompt"),
  inspectorTraits: document.getElementById("inspectorTraits"),
  inspectorParts: document.getElementById("inspectorParts"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  autoBtn: document.getElementById("autoBtn"),
  resetBtn: document.getElementById("resetBtn"),
  speedRange: document.getElementById("speedRange"),
  speedLabel: document.getElementById("speedLabel"),
  quizCard: document.getElementById("quizCard"),
  openAboutDialogBtn: document.getElementById("openAboutDialogBtn"),
  aboutDialog: document.getElementById("aboutDialog"),
  closeAboutDialogBtn: document.getElementById("closeAboutDialogBtn")
};

const state = {
  stageIndex: 0,
  autoPlay: false,
  speed: 1,
  timer: null,
  quiz: {
    index: 0,
    score: 0,
    answered: false
  },
  nodeTimers: [],
  readoutTimers: [],
  virusRemovalTimers: [],
  motionTimers: [],
  ambientMotionTimer: null,
  ambientStageIndex: -1,
  inspector: {
    open: false,
    entityType: null
  },
  aboutDialog: {
    open: false,
    triggerEl: null
  }
};

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clearLayer(layer) {
  layer.innerHTML = "";
}

function seededUnit(seed) {
  const raw = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return raw - Math.floor(raw);
}

function seededBetween(seed, min, max) {
  return min + seededUnit(seed) * (max - min);
}

function ambientCountsForStage(stageIndex) {
  const scene = stages[stageIndex]?.scene || stages[0].scene;
  return {
    virus: clampValue(Math.round(scene.viruses.count * 0.36), 1, 10),
    neutrophil: clampValue(Math.round(scene.neutrophils.count * 0.56), 0, 6),
    macrophage: clampValue(Math.round(scene.macrophages.count * 0.56), 0, 6),
    dendritic: clampValue(Math.round(scene.dendritic.count * 0.6), 0, 5),
    antibody: clampValue(Math.round(scene.antibodies.count * 0.34), 0, 7)
  };
}

function buildAmbientEntities(stageIndex) {
  const counts = ambientCountsForStage(stageIndex);
  const entities = [];
  const typeOrder = ["virus", "neutrophil", "macrophage", "dendritic", "antibody"];

  typeOrder.forEach((type, typeIdx) => {
    const count = counts[type] || 0;
    const zone = ambientTypeZones[type];
    for (let i = 0; i < count; i += 1) {
      const seedBase = stageIndex * 101 + typeIdx * 53 + i * 17 + 1;
      entities.push({
        type,
        x: seededBetween(seedBase + 2, 8, 92),
        y: seededBetween(seedBase + 3, zone.yMin, zone.yMax),
        scale: seededBetween(seedBase + 4, zone.scaleMin, zone.scaleMax),
        o: seededBetween(seedBase + 5, zone.oMin, zone.oMax)
      });
    }
  });

  return entities;
}

function renderEpithelialBackdrop() {
  if (!refs.epithelialLayer || refs.epithelialLayer.childElementCount > 0) {
    return;
  }

  epithelialBackdropLayout.forEach((cell, idx) => {
    const el = document.createElement("div");
    el.className = `epi-cell ${cell.y < 42 ? "upper" : ""}`.trim();
    el.style.setProperty("--x", `${cell.x}%`);
    el.style.setProperty("--y", `${cell.y}%`);
    el.style.setProperty("--w", `${cell.w}px`);
    el.style.setProperty("--h", `${cell.h}px`);
    el.style.setProperty("--r", `${cell.r}deg`);
    el.style.setProperty("--o", `${cell.o}`);
    el.style.setProperty("--a", `${44 + ((idx * 9) % 18)}%`);
    el.style.setProperty("--b", `${56 - ((idx * 7) % 16)}%`);
    el.style.setProperty("--c", `${46 + ((idx * 5) % 14)}%`);
    el.style.setProperty("--d", `${54 - ((idx * 4) % 12)}%`);
    el.style.setProperty("--e", `${43 + ((idx * 6) % 15)}%`);
    el.style.setProperty("--f", `${57 - ((idx * 5) % 14)}%`);
    el.style.setProperty("--g", `${42 + ((idx * 7) % 16)}%`);
    el.style.setProperty("--h2", `${58 - ((idx * 6) % 15)}%`);
    refs.epithelialLayer.appendChild(el);
  });
}

function addAmbientEntity(layer, config, idx) {
  const type = config.type;
  const el = document.createElement("div");
  el.className = `entity ${type} ambient-bg-cell`;
  el.style.left = `${config.x}%`;
  el.style.top = `${config.y}%`;
  el.style.setProperty("--ambient-o", `${config.o ?? 0.2}`);
  el.style.setProperty("--drift-x", `${(Math.sin((idx + 1) * 1.7) * 4.6).toFixed(2)}px`);
  el.style.setProperty("--drift-y", `${(Math.cos((idx + 2) * 1.4) * 3.8).toFixed(2)}px`);
  el.style.setProperty("--drift-rot", `${(((idx % 7) - 3) * 1.8).toFixed(2)}deg`);
  el.style.setProperty("--drift-time", `${(7.2 + (idx % 5) * 1.1).toFixed(2)}s`);
  el.style.setProperty("--pulse-time", `${(3.4 + (idx % 4) * 0.65).toFixed(2)}s`);
  el.style.setProperty("--orbit-time", `${(4.6 + (idx % 3) * 0.9).toFixed(2)}s`);
  el.style.setProperty("--cell-wobble", `${(2.2 + (idx % 5) * 0.6).toFixed(2)}deg`);

  const isCellLike = type === "macrophage" || type === "neutrophil" || type === "dendritic" || type === "virus";
  if (isCellLike) {
    el.style.setProperty("--blob-a", `${44 + ((idx * 9) % 20)}%`);
    el.style.setProperty("--blob-b", `${56 - ((idx * 7) % 18)}%`);
    el.style.setProperty("--blob-c", `${46 + ((idx * 5) % 16)}%`);
    el.style.setProperty("--blob-d", `${54 - ((idx * 6) % 16)}%`);
    el.style.setProperty("--blob-e", `${43 + ((idx * 8) % 18)}%`);
    el.style.setProperty("--blob-f", `${57 - ((idx * 5) % 16)}%`);
    el.style.setProperty("--blob-g", `${42 + ((idx * 7) % 18)}%`);
    el.style.setProperty("--blob-h", `${58 - ((idx * 6) % 18)}%`);
  }

  const baseSize = type === "antibody" ? 15 : type === "virus" ? 16 : 18;
  const scale = config.scale ?? 1;
  const sizePx = Math.round(baseSize * scale * 10) / 10;
  el.style.width = `${sizePx}px`;
  el.style.height = `${sizePx}px`;
  el.dataset.anchorX = String(config.x);
  el.dataset.anchorY = String(config.y);
  const span = type === "virus" ? 7.8 : type === "antibody" ? 6.8 : 7.2;
  el.dataset.span = span.toFixed(1);

  layer.appendChild(el);
}

function renderAmbientBackdropCells() {
  if (!refs.ambientCellLayer) {
    return;
  }
  if (state.ambientStageIndex === state.stageIndex && refs.ambientCellLayer.childElementCount > 0) {
    return;
  }

  clearLayer(refs.ambientCellLayer);
  const entities = buildAmbientEntities(state.stageIndex);
  entities.forEach((config, idx) => {
    addAmbientEntity(refs.ambientCellLayer, config, idx);
  });
  state.ambientStageIndex = state.stageIndex;
  nudgeAmbientBackdropCells();
}

function nudgeAmbientBackdropCells() {
  if (!refs.ambientCellLayer) {
    return;
  }
  const cells = refs.ambientCellLayer.querySelectorAll(".entity.ambient-bg-cell");
  cells.forEach((cell, idx) => {
    const anchorX = Number(cell.dataset.anchorX || cell.style.left.replace("%", "")) || 50;
    const anchorY = Number(cell.dataset.anchorY || cell.style.top.replace("%", "")) || 55;
    const span = Number(cell.dataset.span || "7.0");
    const nextX = clampValue(anchorX + randomBetween(-span, span), 4, 96);
    const nextY = clampValue(anchorY + randomBetween(-(span * 0.72), span * 0.72), 8, 92);
    const moveTimeMs = Math.round(randomBetween(1650, 2850));
    cell.style.setProperty("--ambient-move-time", `${moveTimeMs}ms`);
    cell.style.left = `${nextX.toFixed(2)}%`;
    cell.style.top = `${nextY.toFixed(2)}%`;
    cell.style.setProperty("--drift-x", `${randomBetween(-8, 8).toFixed(2)}px`);
    cell.style.setProperty("--drift-y", `${randomBetween(-7, 7).toFixed(2)}px`);
    cell.style.setProperty("--drift-rot", `${randomBetween(-12, 12).toFixed(2)}deg`);
    cell.style.setProperty("--pulse-time", `${randomBetween(3.2, 5.1).toFixed(2)}s`);
    cell.style.setProperty("--orbit-time", `${randomBetween(4.2, 6.2).toFixed(2)}s`);
    if (idx % 3 === 0) {
      cell.style.setProperty("--cell-wobble", `${randomBetween(2.2, 6.2).toFixed(2)}deg`);
    }
  });
}

function startAmbientBackdropMotion() {
  if (state.ambientMotionTimer || !refs.ambientCellLayer) {
    return;
  }
  nudgeAmbientBackdropCells();
  state.ambientMotionTimer = setInterval(nudgeAmbientBackdropCells, 1850);
}

function stopAmbientBackdropMotion() {
  if (!state.ambientMotionTimer) {
    return;
  }
  clearInterval(state.ambientMotionTimer);
  state.ambientMotionTimer = null;
}

function inspectorRefsReady() {
  return Boolean(
    refs.entityInspector &&
      refs.inspectorVisual &&
      refs.inspectorPartLayer &&
      refs.inspectorTitle &&
      refs.inspectorCategory &&
      refs.inspectorFunction &&
      refs.inspectorPrompt &&
      refs.inspectorTraits &&
      refs.inspectorParts
  );
}

function clearEntitySelection() {
  document
    .querySelectorAll(
      ".entity.inspector-selected, .host-cell.inspector-selected, .node-actor.inspector-selected, .node-pill.inspector-selected"
    )
    .forEach((entity) => entity.classList.remove("inspector-selected"));
}

function clearSceneInspectFocus() {
  if (!refs.infectionScene) {
    return;
  }
  refs.infectionScene.classList.remove("scene-inspecting");
  refs.infectionScene.style.removeProperty("--inspect-x");
  refs.infectionScene.style.removeProperty("--inspect-y");
}

function setSceneInspectFocus(entity) {
  if (!entity || !refs.infectionScene) {
    return;
  }
  const point = entityPoint(entity);
  refs.infectionScene.style.setProperty("--inspect-x", `${point.x}%`);
  refs.infectionScene.style.setProperty("--inspect-y", `${point.y}%`);
  refs.infectionScene.classList.add("scene-inspecting");
}

function clearNodeInspectFocus() {
  if (!refs.nodeScene) {
    return;
  }
  refs.nodeScene.classList.remove("node-inspecting");
  refs.nodeScene.style.removeProperty("--node-inspect-x");
  refs.nodeScene.style.removeProperty("--node-inspect-y");
}

function setNodeInspectFocus(entity) {
  if (!entity || !refs.nodeScene || !refs.nodeScene.contains(entity)) {
    return;
  }
  refs.nodeScene.classList.add("node-inspecting");
  if (entity.classList.contains("node-actor")) {
    const x = parseFloat(entity.style.left || "50");
    const y = parseFloat(entity.style.top || "50");
    refs.nodeScene.style.setProperty("--node-inspect-x", `${x}%`);
    refs.nodeScene.style.setProperty("--node-inspect-y", `${y}%`);
  } else {
    refs.nodeScene.style.removeProperty("--node-inspect-x");
    refs.nodeScene.style.removeProperty("--node-inspect-y");
  }
}

function renderInspectorContent(entityType) {
  const profile = entityInspectorProfiles[entityType];
  if (!profile || !inspectorRefsReady()) {
    return;
  }

  refs.inspectorTitle.textContent = profile.displayName;
  refs.inspectorCategory.textContent = profile.category;
  refs.inspectorFunction.textContent = profile.functionText;
  refs.inspectorPrompt.textContent = "";

  refs.inspectorTraits.innerHTML = "";
  profile.characteristics.forEach((trait) => {
    const item = document.createElement("li");
    item.textContent = trait;
    refs.inspectorTraits.appendChild(item);
  });

  refs.inspectorParts.innerHTML = "";
  profile.interiorParts.forEach((part) => {
    const item = document.createElement("li");
    item.textContent = part.label;
    refs.inspectorParts.appendChild(item);
  });

  refs.inspectorVisual.className = `inspector-visual ${entityType}`;
  refs.inspectorPartLayer.innerHTML = "";
  const fallbackPositions = [
    { x: 30, y: 36 },
    { x: 62, y: 34 },
    { x: 44, y: 58 },
    { x: 66, y: 66 }
  ];
  profile.interiorParts.forEach((part, idx) => {
    const particle = document.createElement("div");
    particle.className = `inspector-part ${part.className}`.trim();
    const fallback = fallbackPositions[idx % fallbackPositions.length];
    const px = typeof part.x === "number" ? part.x : fallback.x;
    const py = typeof part.y === "number" ? part.y : fallback.y;
    particle.style.left = `${px}%`;
    particle.style.top = `${py}%`;
    particle.style.animationDelay = `${(idx * 0.09).toFixed(2)}s`;
    particle.setAttribute("title", part.label);
    particle.setAttribute("aria-label", part.label);
    refs.inspectorPartLayer.appendChild(particle);
  });
}

function renderInspectorPlaceholder() {
  if (!inspectorRefsReady()) {
    return;
  }
  refs.inspectorTitle.textContent = "No Cell Selected";
  refs.inspectorCategory.textContent = "Interactive View";
  refs.inspectorFunction.textContent =
    "Click the host cell, a virus, or an immune cell in the Infection Site panel to inspect its interior structure.";
  refs.inspectorPrompt.textContent = "Tip: click a cell in the Infection Site panel to lock and inspect it.";
  refs.inspectorTraits.innerHTML = `
    <li>Shows what the selected cell/particle does during infection.</li>
    <li>Highlights major internal components with animated markers.</li>
    <li>Updates instantly as you select different cell types.</li>
  `;
  refs.inspectorParts.innerHTML = `
    <li>Interior highlights appear here after selection.</li>
  `;
  refs.inspectorVisual.className = "inspector-visual idle";
  refs.inspectorPartLayer.innerHTML = "";
}

function openEntityInspector(entityType, sourceEntity = null) {
  if (!inspectableEntityTypes.has(entityType) || !inspectorRefsReady()) {
    return;
  }

  stopAutoPlay();
  state.inspector.open = true;
  state.inspector.entityType = entityType;
  refs.entityInspector.classList.remove("idle");
  refs.entityInspector.classList.add("open");
  renderInspectorContent(entityType);

  clearEntitySelection();
  clearSceneInspectFocus();
  clearNodeInspectFocus();

  if (sourceEntity) {
    sourceEntity.classList.add("inspector-selected");
    if (refs.infectionScene?.contains(sourceEntity)) {
      setSceneInspectFocus(sourceEntity);
    } else if (refs.nodeScene?.contains(sourceEntity)) {
      setNodeInspectFocus(sourceEntity);
    }
  }
}

function closeEntityInspector() {
  state.inspector.open = false;
  state.inspector.entityType = null;
  if (!inspectorRefsReady()) {
    return;
  }
  refs.entityInspector.classList.remove("open");
  refs.entityInspector.classList.add("idle");
  renderInspectorPlaceholder();
  clearEntitySelection();
  clearSceneInspectFocus();
  clearNodeInspectFocus();
}

function syncEntityInspectorForStage() {
  clearEntitySelection();
  clearSceneInspectFocus();
  clearNodeInspectFocus();

  if (!state.inspector.open || !state.inspector.entityType || !refs.infectionScene) {
    return;
  }

  const infectionCandidate =
    state.inspector.entityType === "host"
      ? refs.hostCell
      : refs.infectionScene.querySelector(`.entity.${state.inspector.entityType}`);
  const nodeCandidate = refs.nodeScene?.querySelector(
    `.node-actor.${state.inspector.entityType}, .node-pill[data-entity-type="${state.inspector.entityType}"]`
  );
  openEntityInspector(state.inspector.entityType, infectionCandidate || nodeCandidate || null);
}

function scheduleNodeTask(fn, delayMs) {
  const timerId = setTimeout(fn, delayMs);
  state.nodeTimers.push(timerId);
}

function clearNodeTasks() {
  state.nodeTimers.forEach((timerId) => clearTimeout(timerId));
  state.nodeTimers = [];
  if (refs.nodeTaskLayer) {
    clearLayer(refs.nodeTaskLayer);
  }
  if (refs.nodeSignalLayer) {
    clearLayer(refs.nodeSignalLayer);
  }
}

function scheduleReadoutUpdate(fn, delayMs) {
  const timerId = setTimeout(() => {
    state.readoutTimers = state.readoutTimers.filter((id) => id !== timerId);
    fn();
  }, delayMs);
  state.readoutTimers.push(timerId);
}

function clearReadoutTimers() {
  state.readoutTimers.forEach((timerId) => clearTimeout(timerId));
  state.readoutTimers = [];
}

function clearVirusRemovalTimers() {
  state.virusRemovalTimers.forEach((timerId) => clearTimeout(timerId));
  state.virusRemovalTimers = [];
}

function scheduleMotionTask(fn, delayMs) {
  const timerId = setTimeout(() => {
    state.motionTimers = state.motionTimers.filter((id) => id !== timerId);
    fn();
  }, delayMs);
  state.motionTimers.push(timerId);
}

function clearMotionTasks() {
  state.motionTimers.forEach((timerId) => clearTimeout(timerId));
  state.motionTimers = [];
}

function addEntity(layer, type, x, y, extraClass = "") {
  const el = document.createElement("div");
  const animOffset = `${Math.random() * 1.4}s`;
  el.className = `entity ${type} ${extraClass}`.trim();
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;
  el.style.animationDelay = animOffset;
  el.style.setProperty("--anim-offset", animOffset);

  const isImmune = type === "macrophage" || type === "neutrophil" || type === "dendritic";
  const isVirus = type === "virus";
  const driftRange = isImmune ? 12 : isVirus ? 9 : 6;
  const driftMin = isImmune ? 2.1 : 2.5;
  const driftMax = isImmune ? 3.8 : 4.4;
  const pulseMin = isVirus ? 1.0 : 1.3;
  const pulseMax = isVirus ? 1.8 : 2.7;
  const isCellLike = isImmune || type === "virus";

  el.style.setProperty("--drift-x", `${randomBetween(-driftRange, driftRange).toFixed(2)}px`);
  el.style.setProperty("--drift-y", `${randomBetween(-driftRange, driftRange).toFixed(2)}px`);
  el.style.setProperty("--drift-rot", `${randomBetween(-14, 14).toFixed(2)}deg`);
  el.style.setProperty("--drift-time", `${randomBetween(driftMin, driftMax).toFixed(2)}s`);
  el.style.setProperty("--pulse-time", `${randomBetween(pulseMin, pulseMax).toFixed(2)}s`);
  el.style.setProperty("--orbit-time", `${randomBetween(1.8, 3.6).toFixed(2)}s`);
  el.style.setProperty("--cell-wobble", `${randomBetween(2.5, 6.5).toFixed(2)}deg`);
  el.style.setProperty("--devour-time", `${randomBetween(1.4, 2.4).toFixed(2)}s`);

  if (isCellLike) {
    el.style.setProperty("--blob-a", `${randomBetween(30, 70).toFixed(1)}%`);
    el.style.setProperty("--blob-b", `${randomBetween(30, 70).toFixed(1)}%`);
    el.style.setProperty("--blob-c", `${randomBetween(32, 74).toFixed(1)}%`);
    el.style.setProperty("--blob-d", `${randomBetween(28, 68).toFixed(1)}%`);
    el.style.setProperty("--blob-e", `${randomBetween(30, 70).toFixed(1)}%`);
    el.style.setProperty("--blob-f", `${randomBetween(28, 68).toFixed(1)}%`);
    el.style.setProperty("--blob-g", `${randomBetween(30, 72).toFixed(1)}%`);
    el.style.setProperty("--blob-h", `${randomBetween(28, 70).toFixed(1)}%`);
  }

  if (extraClass.includes("traveling")) {
    el.style.setProperty("--travel-span", `${randomBetween(18, 34).toFixed(2)}px`);
  }

  if (inspectableEntityTypes.has(type)) {
    const profile = entityInspectorProfiles[type];
    el.classList.add("inspectable");
    el.dataset.entityType = type;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", `Inspect ${profile.displayName}`);
    el.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openEntityInspector(type, el);
    });
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        openEntityInspector(type, el);
      }
    });
  }

  layer.appendChild(el);
  return el;
}

function spawnGroup(layer, type, config) {
  const count = config?.count || 0;
  const xMin = config?.xMin ?? 10;
  const xMax = config?.xMax ?? 90;
  const yMin = config?.yMin ?? 12;
  const yMax = config?.yMax ?? 88;
  const bound = config?.bound || 0;
  const traveling = Boolean(config?.traveling);
  const clumpyType =
    type === "macrophage" ||
    type === "neutrophil" ||
    type === "dendritic" ||
    type === "debris" ||
    type === "virus";
  const useClusters = clumpyType && !traveling && count > 2;
  const anchors = [];

  if (useClusters) {
    const anchorCount = Math.max(1, Math.min(4, Math.round(Math.sqrt(count / 2))));
    const edgePadX = Math.min(8, (xMax - xMin) * 0.12);
    const edgePadY = Math.min(7, (yMax - yMin) * 0.12);
    for (let i = 0; i < anchorCount; i += 1) {
      anchors.push({
        x: randomBetween(xMin + edgePadX, xMax - edgePadX),
        y: randomBetween(yMin + edgePadY, yMax - edgePadY)
      });
    }
  }

  for (let i = 0; i < count; i += 1) {
    let x = randomBetween(xMin, xMax);
    let y = randomBetween(yMin, yMax);
    const classes = [];
    const spreadX = type === "virus" ? 7.5 : type === "debris" ? 10 : 11;
    const spreadY = type === "virus" ? 6.2 : type === "debris" ? 8 : 9;

    if (useClusters && Math.random() < 0.84) {
      const anchor = anchors[Math.floor(randomBetween(0, anchors.length))];
      x = clampValue(anchor.x + randomBetween(-spreadX, spreadX), xMin, xMax);
      y = clampValue(anchor.y + randomBetween(-spreadY, spreadY), yMin, yMax);
    }

    if (type === "virus" && i < bound) {
      classes.push("bound");
    }
    if (traveling && i % 2 === 0) {
      classes.push("traveling");
    }

    addEntity(layer, type, x, y, classes.join(" "));
  }
}

function shuffleArray(items) {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function pickEntities(elements, count) {
  const pool = shuffleArray(elements);
  const safeCount = Math.max(0, Math.min(count, pool.length));
  return pool.slice(0, safeCount);
}

function entityPoint(entity) {
  return {
    x: parseFloat(entity.style.left || "50"),
    y: parseFloat(entity.style.top || "50")
  };
}

function steerEntityToward(entity, target, strength = 1.8, speedBias = 1) {
  const origin = entityPoint(entity);
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const noise = distance > 12 ? 0.9 : 0.35;
  const intentAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const intentTime = clampValue((2.8 - distance * 0.06) * speedBias, 0.7, 2.4);

  entity.style.setProperty(
    "--drift-x",
    `${clampValue(dx * strength + randomBetween(-noise, noise), -24, 24).toFixed(2)}px`
  );
  entity.style.setProperty(
    "--drift-y",
    `${clampValue(dy * strength + randomBetween(-noise, noise), -24, 24).toFixed(2)}px`
  );
  entity.style.setProperty("--drift-rot", `${(intentAngle + randomBetween(-3, 3)).toFixed(2)}deg`);
  entity.style.setProperty("--drift-time", `${intentTime.toFixed(2)}s`);
}

function moveEntityToward(entity, target, pull = 0.72, speedBias = 1) {
  const origin = entityPoint(entity);
  const nextX = clampValue(origin.x + (target.x - origin.x) * pull, 4, 96);
  const nextY = clampValue(origin.y + (target.y - origin.y) * pull, 4, 96);
  const dist = Math.hypot(target.x - origin.x, target.y - origin.y);
  const durationMs = Math.round(clampValue((460 + dist * 17) * speedBias, 300, 1650));

  entity.classList.add("task-focused");
  entity.style.setProperty("--move-time", `${durationMs}ms`);
  entity.style.transition = `left ${durationMs}ms cubic-bezier(0.2, 0.78, 0.2, 1), top ${durationMs}ms cubic-bezier(0.2, 0.78, 0.2, 1)`;

  requestAnimationFrame(() => {
    entity.style.left = `${nextX}%`;
    entity.style.top = `${nextY}%`;
  });
}

function createTaskLine(start, end, variant = "") {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 4) {
    return;
  }

  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cue = document.createElement("div");
  cue.className = `task-line ${variant}`.trim();
  cue.style.left = `${start.x}%`;
  cue.style.top = `${start.y}%`;
  cue.style.width = `${length}%`;
  cue.style.transform = `translateY(-50%) rotate(${angle}deg)`;
  const cueTime = randomBetween(0.75, 1.35);
  cue.style.setProperty("--cue-time", `${cueTime}s`);
  refs.taskLayer.appendChild(cue);

  const cleanupMs = Math.round(cueTime * 1250);
  setTimeout(() => {
    if (cue.isConnected) {
      cue.remove();
    }
  }, cleanupMs);
}

function createTaskPulse(point, variant = "") {
  const pulse = document.createElement("div");
  pulse.className = `task-pulse ${variant}`.trim();
  pulse.style.left = `${point.x}%`;
  pulse.style.top = `${point.y}%`;
  const pulseTime = randomBetween(0.75, 1.2);
  pulse.style.setProperty("--pulse-time", `${pulseTime}s`);
  refs.taskLayer.appendChild(pulse);

  const cleanupMs = Math.round(pulseTime * 1450);
  setTimeout(() => {
    if (pulse.isConnected) {
      pulse.remove();
    }
  }, cleanupMs);
}

function createNodeActor(type, x, y, extraClass = "") {
  if (!refs.nodeTaskLayer) {
    return null;
  }
  const actor = document.createElement("div");
  actor.className = `node-actor ${type} ${extraClass}`.trim();
  actor.style.left = `${x}%`;
  actor.style.top = `${y}%`;
  if (inspectableEntityTypes.has(type)) {
    const profile = entityInspectorProfiles[type];
    actor.classList.add("inspectable-node");
    actor.dataset.entityType = type;
    actor.setAttribute("role", "button");
    actor.setAttribute("tabindex", "0");
    actor.setAttribute("aria-label", `Inspect ${profile.displayName}`);
    actor.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openEntityInspector(type, actor);
    });
    actor.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        openEntityInspector(type, actor);
      }
    });
  }
  refs.nodeTaskLayer.appendChild(actor);
  return actor;
}

function moveNodeActor(actor, x, y, durationMs = 700) {
  if (!actor) {
    return;
  }
  actor.style.setProperty("--node-move-time", `${durationMs}ms`);
  actor.style.transition = `left ${durationMs}ms cubic-bezier(0.2, 0.78, 0.2, 1), top ${durationMs}ms cubic-bezier(0.2, 0.78, 0.2, 1)`;
  requestAnimationFrame(() => {
    actor.style.left = `${x}%`;
    actor.style.top = `${y}%`;
  });
}

function createNodeRoute(start, end, variant = "") {
  if (!refs.nodeTaskLayer) {
    return;
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 3) {
    return;
  }
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const route = document.createElement("div");
  route.className = `node-route ${variant}`.trim();
  route.style.left = `${start.x}%`;
  route.style.top = `${start.y}%`;
  route.style.width = `${length}%`;
  route.style.transform = `translateY(-50%) rotate(${angle}deg)`;
  refs.nodeTaskLayer.appendChild(route);
  setTimeout(() => {
    if (route.isConnected) {
      route.remove();
    }
  }, 1200);
}

function createNodeSignal(type, x, y, delaySec = 0) {
  if (!refs.nodeSignalLayer) {
    return null;
  }
  const signal = document.createElement("div");
  signal.className = `node-signal ${type}`.trim();
  signal.style.left = `${x}%`;
  signal.style.top = `${y}%`;
  signal.style.animationDelay = `${delaySec}s`;
  refs.nodeSignalLayer.appendChild(signal);
  return signal;
}

function createNodeBeam(start, end, variant = "", delaySec = 0) {
  if (!refs.nodeSignalLayer) {
    return;
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 3) {
    return;
  }
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const beam = document.createElement("div");
  beam.className = `node-beam ${variant}`.trim();
  beam.style.left = `${start.x}%`;
  beam.style.top = `${start.y}%`;
  beam.style.width = `${length}%`;
  beam.style.transform = `translateY(-50%) rotate(${angle}deg)`;
  beam.style.animationDelay = `${delaySec}s`;
  refs.nodeSignalLayer.appendChild(beam);
}

function applyNodeTaskAnimations(stageIndex) {
  if (!refs.nodeTaskLayer) {
    return;
  }

  if (stageIndex < 4) {
    return;
  }

  if (stageIndex === 4) {
    const tCandidates = [
      createNodeActor("tcell", 62, 30),
      createNodeActor("tcell", 72, 56),
      createNodeActor("tcell", 50, 72)
    ].filter(Boolean);
    const bCandidates = [
      createNodeActor("bcell", 30, 36),
      createNodeActor("bcell", 42, 58),
      createNodeActor("bcell", 28, 74)
    ].filter(Boolean);
    const dendritic = createNodeActor("dendritic", 8, 18, "active");
    const scanPath = shuffleArray([...tCandidates, ...bCandidates]).slice(0, 4);

    let current = { x: 8, y: 18 };
    let time = 120;

    scanPath.forEach((candidate) => {
      if (!candidate || !dendritic) {
        return;
      }
      const target = {
        x: parseFloat(candidate.style.left),
        y: parseFloat(candidate.style.top)
      };
      scheduleNodeTask(() => {
        candidate.classList.add("scanned");
        createNodeRoute(current, target, "scan");
        moveNodeActor(dendritic, target.x, target.y, 640);
      }, time);
      current = target;
      time += 640;
    });

    scheduleNodeTask(() => {
      if (!dendritic) {
        return;
      }
      const exitPoint = { x: 90, y: 16 };
      createNodeRoute(current, exitPoint, "migrate");
      dendritic.classList.add("migrating");
      moveNodeActor(dendritic, exitPoint.x, exitPoint.y, 720);
    }, time + 90);

    return;
  }

  if (stageIndex === 5) {
    const matchedT = createNodeActor("tcell", 64, 40, "matched");
    const matchedB = createNodeActor("bcell", 36, 64, "matched");
    const dendritic = createNodeActor("dendritic", 12, 20, "active");

    if (dendritic && matchedT) {
      createNodeRoute({ x: 12, y: 20 }, { x: 64, y: 40 }, "match");
      moveNodeActor(dendritic, 64, 40, 720);
      scheduleNodeTask(() => {
        matchedT.classList.add("activated");
      }, 740);
    }

    if (dendritic && matchedB) {
      scheduleNodeTask(() => {
        createNodeRoute({ x: 64, y: 40 }, { x: 36, y: 64 }, "match");
        moveNodeActor(dendritic, 36, 64, 700);
      }, 840);
      scheduleNodeTask(() => {
        matchedB.classList.add("activated");
      }, 1560);
    }

    const tClones = [
      { x: 70, y: 32 },
      { x: 74, y: 46 },
      { x: 56, y: 50 }
    ];
    const bClones = [
      { x: 30, y: 56 },
      { x: 40, y: 74 },
      { x: 46, y: 60 }
    ];

    scheduleNodeTask(() => {
      tClones.forEach((pos, idx) => {
        scheduleNodeTask(() => {
          createNodeActor("tcell", pos.x, pos.y, "activated");
        }, idx * 110);
      });
      bClones.forEach((pos, idx) => {
        scheduleNodeTask(() => {
          createNodeActor("bcell", pos.x, pos.y, "activated");
        }, idx * 110);
      });
    }, 1650);

    return;
  }

  if (stageIndex >= 6) {
    createNodeActor("dendritic", 22, 28, "resting");
    createNodeActor("tcell", 62, 40, "activated");
    createNodeActor("tcell", 72, 50, "activated");
    createNodeActor("bcell", 36, 62, "activated");
    createNodeActor("bcell", 45, 72, "activated");
    createNodeRoute({ x: 36, y: 62 }, { x: 88, y: 44 }, "signal");
  }
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function scheduleVirusRemoval(virus) {
  if (virus.dataset.devourScheduled === "1") {
    return;
  }
  virus.dataset.devourScheduled = "1";

  const delaySec = parseFloat(virus.style.getPropertyValue("--devour-delay") || "0.25");
  const durationSec = parseFloat(virus.style.getPropertyValue("--devour-time") || "1.8");
  const removeAfterMs = Math.max(250, (delaySec + durationSec) * 1000 + 120);

  const timerId = setTimeout(() => {
    state.virusRemovalTimers = state.virusRemovalTimers.filter((id) => id !== timerId);
    if (virus.isConnected) {
      virus.classList.add("task-destroyed");
      virus.remove();
      renderActionReadout(state.stageIndex);
    }
  }, removeAfterMs);
  state.virusRemovalTimers.push(timerId);
}

function markVirusAsDevoured(virus, hunterPoint) {
  virus.classList.add("task-being-devoured");
  virus.style.setProperty("--devour-delay", `${randomBetween(0.18, 1.1)}s`);
  steerEntityToward(virus, hunterPoint, 2.2, 0.74);
  moveEntityToward(virus, hunterPoint, 0.9, 0.82);
  scheduleVirusRemoval(virus);
}

function applyTaskAnimations(stageIndex) {
  const hostPoint = { x: 45, y: 54 };
  const viruses = [...refs.virusLayer.querySelectorAll(".entity.virus")];
  const debris = [...refs.debrisLayer.querySelectorAll(".entity.debris")];
  const neutrophils = [...refs.immuneLayer.querySelectorAll(".entity.neutrophil")];
  const macrophages = [...refs.immuneLayer.querySelectorAll(".entity.macrophage")];
  const dendritic = [...refs.immuneLayer.querySelectorAll(".entity.dendritic")];
  const antibodies = [...refs.antibodyLayer.querySelectorAll(".entity.antibody")];
  const phagocytes = [...neutrophils, ...macrophages];

  if (stageIndex === 0) {
    pickEntities(viruses, Math.ceil(viruses.length * 0.5)).forEach((virus) => {
      virus.classList.add("task-probing");
      const probeTarget = { x: randomBetween(36, 56), y: randomBetween(44, 63) };
      steerEntityToward(virus, probeTarget, 1.7, 1);
      moveEntityToward(virus, probeTarget, 0.55, 1);
      createTaskLine(entityPoint(virus), probeTarget, "cue-probe");
    });
    return;
  }

  if (stageIndex === 1) {
    pickEntities(viruses, Math.ceil(viruses.length * 0.65)).forEach((virus) => {
      virus.classList.add("task-attack-host");
      steerEntityToward(virus, hostPoint, 2.2, 0.85);
      moveEntityToward(virus, hostPoint, 0.66, 0.9);
      createTaskLine(entityPoint(virus), hostPoint, "cue-infect");
    });
    return;
  }

  if (stageIndex === 2) {
    const ejecting = pickEntities(viruses, Math.ceil(viruses.length * 0.76));
    ejecting.forEach((virus, idx) => {
      virus.classList.add("task-burst-out");
      virus.classList.add("task-ejected");
      const angle = (idx / Math.max(1, ejecting.length)) * Math.PI * 2 + randomBetween(-0.28, 0.28);
      const distance = randomBetween(20, 44);
      const burstTarget = {
        x: clampValue(hostPoint.x + Math.cos(angle) * distance, 7, 93),
        y: clampValue(hostPoint.y + Math.sin(angle) * distance, 10, 92)
      };

      virus.style.left = `${clampValue(hostPoint.x + randomBetween(-1.8, 1.8), 7, 93)}%`;
      virus.style.top = `${clampValue(hostPoint.y + randomBetween(-1.8, 1.8), 10, 92)}%`;
      virus.style.opacity = "0";
      const startPoint = entityPoint(virus);
      const delayMs = Math.round((idx * 95) / state.speed);

      scheduleMotionTask(() => {
        if (!virus.isConnected) {
          return;
        }
        virus.style.opacity = "1";
        steerEntityToward(virus, burstTarget, 2.8, 0.68);
        moveEntityToward(virus, burstTarget, 0.96, 0.74);
        createTaskLine(hostPoint, burstTarget, "cue-burst");
        createTaskPulse(hostPoint, "pulse-rupture");
        createTaskLine(startPoint, burstTarget, "cue-burst");
      }, delayMs);
    });

    const residual = viruses.filter((virus) => !ejecting.includes(virus));
    residual.forEach((virus) => {
      const vp = entityPoint(virus);
      const outward = {
        x: vp.x + (vp.x - hostPoint.x) * 0.6,
        y: vp.y + (vp.y - hostPoint.y) * 0.6
      };
      steerEntityToward(virus, outward, 2.2, 0.9);
      moveEntityToward(virus, outward, 0.66, 0.9);
    });
    return;
  }

  if (stageIndex === 3) {
    const hunters = pickEntities(phagocytes, Math.min(phagocytes.length, viruses.length));
    const targets = pickEntities(viruses, hunters.length);

    hunters.forEach((hunter, idx) => {
      const target = targets[idx];
      if (!target) {
        return;
      }
      const hunterPoint = entityPoint(hunter);
      const targetPoint = entityPoint(target);

      if (idx % 2 === 0) {
        hunter.classList.add("task-engulfing");
        markVirusAsDevoured(target, hunterPoint);
        steerEntityToward(hunter, targetPoint, 2.6, 0.78);
        moveEntityToward(hunter, targetPoint, 0.88, 0.78);
        createTaskLine(hunterPoint, targetPoint, "cue-engulf");
        createTaskPulse(midpoint(hunterPoint, targetPoint), "pulse-engulf");
      } else {
        hunter.classList.add("task-engulfing");
        target.classList.add("task-evading");
        steerEntityToward(hunter, targetPoint, 2.4, 0.8);
        steerEntityToward(target, hunterPoint, -1.7, 1.1);
        moveEntityToward(hunter, targetPoint, 0.76, 0.86);
        moveEntityToward(target, { x: targetPoint.x + (targetPoint.x - hunterPoint.x), y: targetPoint.y + (targetPoint.y - hunterPoint.y) }, 0.4, 1.05);
        createTaskLine(hunterPoint, targetPoint, "cue-chase");
      }
    });

    pickEntities(dendritic, Math.max(1, Math.round(dendritic.length * 0.8))).forEach((cell) => {
      cell.classList.add("task-collecting");
      if (debris.length > 0) {
        const piece = debris[Math.floor(randomBetween(0, debris.length))];
        createTaskLine(entityPoint(piece), entityPoint(cell), "cue-scan");
      }
    });
    return;
  }

  if (stageIndex === 4) {
    pickEntities(dendritic, Math.max(1, dendritic.length)).forEach((cell) => {
      cell.classList.add("task-migrating");
      const nodeTarget = { x: 93, y: randomBetween(8, 20) };
      steerEntityToward(cell, nodeTarget, 2.3, 0.75);
      moveEntityToward(cell, nodeTarget, 0.9, 0.8);
      createTaskLine(entityPoint(cell), nodeTarget, "cue-migrate");
      if (debris.length > 0) {
        const piece = debris[Math.floor(randomBetween(0, debris.length))];
        createTaskLine(entityPoint(piece), entityPoint(cell), "cue-scan");
      }
    });
    return;
  }

  if (stageIndex === 5) {
    pickEntities(dendritic, Math.max(1, dendritic.length)).forEach((cell) => {
      cell.classList.add("task-signaling");
      const signalTarget = { x: 92, y: randomBetween(8, 16) };
      createTaskLine(entityPoint(cell), signalTarget, "cue-signal");
    });
    pickEntities(phagocytes, Math.max(1, Math.floor(phagocytes.length * 0.7))).forEach((cell) => {
      cell.classList.add("task-cleanup");
    });
    return;
  }

  if (stageIndex === 6) {
    const targetedViruses = pickEntities(
      viruses,
      Math.max(1, Math.min(viruses.length, Math.ceil(antibodies.length / 2)))
    );
    const bindingAntibodies = pickEntities(antibodies, Math.min(antibodies.length, targetedViruses.length * 2));

    bindingAntibodies.forEach((antibody, idx) => {
      const target = targetedViruses[idx % targetedViruses.length];
      if (!target) {
        return;
      }
      antibody.classList.add("task-binding");
      target.classList.add("task-neutralized");
      steerEntityToward(antibody, entityPoint(target), 2.4, 0.75);
      moveEntityToward(antibody, entityPoint(target), 0.88, 0.84);
      createTaskLine(entityPoint(antibody), entityPoint(target), "cue-bind");
    });

    pickEntities(phagocytes, Math.min(phagocytes.length, targetedViruses.length)).forEach((cell, idx) => {
      const target = targetedViruses[idx % targetedViruses.length];
      if (!target) {
        return;
      }
      const cellPoint = entityPoint(cell);
      const targetPoint = entityPoint(target);
      cell.classList.add("task-engulfing");
      if (idx % 2 === 0) {
        markVirusAsDevoured(target, cellPoint);
        createTaskLine(cellPoint, targetPoint, "cue-engulf");
        createTaskPulse(midpoint(cellPoint, targetPoint), "pulse-engulf");
      } else {
        steerEntityToward(target, cellPoint, 1.4, 0.9);
        moveEntityToward(target, cellPoint, 0.6, 0.95);
        createTaskLine(cellPoint, targetPoint, "cue-cleanup");
      }
      steerEntityToward(cell, targetPoint, 2.2, 0.8);
      moveEntityToward(cell, targetPoint, 0.85, 0.82);
    });
    return;
  }

  if (stageIndex === 7) {
    const residues = [...viruses, ...debris];
    const cleaners = pickEntities(phagocytes, Math.min(phagocytes.length, residues.length));
    cleaners.forEach((cell, idx) => {
      const residue = residues[idx % residues.length];
      if (!residue) {
        return;
      }
      const cellPoint = entityPoint(cell);
      const residuePoint = entityPoint(residue);
      cell.classList.add("task-cleanup");
      steerEntityToward(cell, residuePoint, 2.1, 0.85);
      moveEntityToward(cell, residuePoint, 0.84, 0.9);
      if (residue.classList.contains("virus")) {
        markVirusAsDevoured(residue, cellPoint);
        createTaskLine(cellPoint, residuePoint, "cue-engulf");
        createTaskPulse(midpoint(cellPoint, residuePoint), "pulse-engulf");
      } else {
        createTaskLine(cellPoint, residuePoint, "cue-cleanup");
      }
    });

    pickEntities(antibodies, Math.ceil(antibodies.length * 0.35)).forEach((antibody) => {
      antibody.classList.add("task-patrol");
    });
  }
}

function renderNodeCells(cells) {
  refs.lymphCells.innerHTML = "";

  cells.forEach((group) => {
    const count = Math.max(1, group.count);
    for (let i = 0; i < count; i += 1) {
      const pill = document.createElement("span");
      pill.className = "node-pill";
      pill.innerHTML = `<span class="node-dot ${group.type}"></span>${group.label}`;
      if (inspectableEntityTypes.has(group.type)) {
        const profile = entityInspectorProfiles[group.type];
        pill.classList.add("inspectable-node");
        pill.dataset.entityType = group.type;
        pill.setAttribute("role", "button");
        pill.setAttribute("tabindex", "0");
        pill.setAttribute("aria-label", `Inspect ${profile.displayName}`);
        pill.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openEntityInspector(group.type, pill);
        });
        pill.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            openEntityInspector(group.type, pill);
          }
        });
      }
      refs.lymphCells.appendChild(pill);
    }
  });
}

function renderNodePanelDetails(stageIndex) {
  if (!refs.nodeChecklist) {
    return;
  }

  const checklistItems = nodeStageChecklist[stageIndex] || nodeStageChecklist[0];
  refs.nodeChecklist.innerHTML = "";
  checklistItems.forEach((line, idx) => {
    const item = document.createElement("li");
    item.textContent = line;
    item.style.setProperty("--node-delay", `${(idx * 0.08).toFixed(2)}s`);
    refs.nodeChecklist.appendChild(item);
  });
}

function setHostAppearance(hostState) {
  refs.hostCell.classList.toggle("alert", hostState.alert);
  refs.hostCell.classList.toggle("burst", hostState.burst);
  refs.signalPulse.classList.toggle("on", hostState.signal);
}

function renderCellCopies(count) {
  clearLayer(refs.cellCopyLayer);
  const visualCount = Math.max(0, Math.min(24, count + (count > 0 ? 2 : 0)));
  const anchors = [];
  const anchorCount = Math.max(1, Math.min(3, Math.round(visualCount / 8)));

  for (let i = 0; i < anchorCount; i += 1) {
    anchors.push({
      x: randomBetween(32, 68),
      y: randomBetween(30, 72)
    });
  }

  for (let i = 0; i < visualCount; i += 1) {
    const dot = document.createElement("div");
    dot.className = "copy-dot";
    let x = randomBetween(12, 88);
    let y = randomBetween(14, 86);
    if (Math.random() < 0.88) {
      const anchor = anchors[Math.floor(randomBetween(0, anchors.length))];
      x = clampValue(anchor.x + randomBetween(-20, 20), 12, 88);
      y = clampValue(anchor.y + randomBetween(-18, 18), 14, 86);
    }
    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
    dot.style.animationDelay = `${Math.random() * 1.2}s`;
    refs.cellCopyLayer.appendChild(dot);
  }
}

function createCellParticle(layer, className, x, y, delaySec = 0) {
  if (!layer) {
    return null;
  }
  const particle = document.createElement("div");
  particle.className = className;
  particle.style.left = `${x}%`;
  particle.style.top = `${y}%`;
  particle.style.animationDelay = `${delaySec}s`;
  layer.appendChild(particle);
  return particle;
}

function renderCellMicroActions(stageIndex, cellData) {
  if (!refs.cellGenomeLayer || !refs.cellFactoryLayer || !refs.cellEgressLayer) {
    return;
  }

  clearLayer(refs.cellGenomeLayer);
  clearLayer(refs.cellFactoryLayer);
  clearLayer(refs.cellEgressLayer);

  const copyIntensity = clampValue(Math.round(cellData.copies / 2), 0, 12);

  if (stageIndex === 0) {
    createCellParticle(refs.cellGenomeLayer, "cell-strand docking", 16, 52, 0.05);
    createCellParticle(refs.cellGenomeLayer, "cell-strand docking", 22, 46, 0.2);
    return;
  }

  if (stageIndex >= 1 && stageIndex <= 2) {
    const strandCount = stageIndex === 2 ? 5 : 3;
    for (let i = 0; i < strandCount; i += 1) {
      const strand = createCellParticle(
        refs.cellGenomeLayer,
        "cell-strand replicating",
        randomBetween(20, 78),
        randomBetween(30, 72),
        i * 0.12
      );
      if (strand) {
        strand.style.setProperty("--strand-rot", `${randomBetween(-65, 65).toFixed(1)}deg`);
      }
    }

    const ribosomeCount = Math.max(4, Math.min(12, 4 + copyIntensity));
    for (let i = 0; i < ribosomeCount; i += 1) {
      createCellParticle(
        refs.cellFactoryLayer,
        "cell-ribosome active",
        randomBetween(14, 86),
        randomBetween(16, 86),
        Math.random() * 0.8
      );
      if (i % 3 === 0) {
        createCellParticle(
          refs.cellFactoryLayer,
          "cell-assembly",
          randomBetween(18, 84),
          randomBetween(22, 84),
          Math.random() * 0.65
        );
      }
    }
  }

  if (stageIndex === 2) {
    const egressCount = 13;
    for (let i = 0; i < egressCount; i += 1) {
      const virion = createCellParticle(refs.cellEgressLayer, "cell-egress-virion", 50, 50, i * 0.08);
      if (virion) {
        const angle = (i / egressCount) * Math.PI * 2 + randomBetween(-0.22, 0.22);
        const dx = Math.cos(angle) * randomBetween(24, 88);
        const dy = Math.sin(angle) * randomBetween(18, 72);
        virion.style.setProperty("--egress-x", `${dx.toFixed(2)}px`);
        virion.style.setProperty("--egress-y", `${dy.toFixed(2)}px`);
      }
    }
    return;
  }

  if (stageIndex >= 3 && stageIndex <= 5) {
    for (let i = 0; i < 8; i += 1) {
      createCellParticle(
        refs.cellEgressLayer,
        "cell-fragment",
        randomBetween(12, 88),
        randomBetween(18, 86),
        i * 0.1
      );
    }
  }

  if (stageIndex >= 6) {
    for (let i = 0; i < 7; i += 1) {
      createCellParticle(
        refs.cellFactoryLayer,
        "cell-repair",
        randomBetween(20, 80),
        randomBetween(22, 82),
        i * 0.12
      );
    }
    createCellParticle(refs.cellGenomeLayer, "cell-strand recovered", 48, 50, 0.05);
    createCellParticle(refs.cellGenomeLayer, "cell-strand recovered", 58, 56, 0.22);
  }
}

function updateCellChecklist(checkpoint, complete) {
  const items = [...refs.cellChecklist.querySelectorAll("li")];
  items.forEach((item) => {
    const step = Number(item.dataset.step);
    item.classList.remove("done", "active");

    if (complete || step < checkpoint) {
      item.classList.add("done");
    } else if (step === checkpoint) {
      item.classList.add("active");
    }
  });
}

function renderCellFocus(index) {
  const cellData = cellFocusTimeline[index] || cellFocusTimeline[0];

  refs.cellStatusBadge.textContent = cellData.status;
  refs.cellFocusText.textContent = cellData.focus;
  refs.cellCopiesCount.textContent = String(cellData.copies);
  refs.cellIntegrityValue.textContent = `${cellData.integrity}%`;
  refs.cellGenomeState.textContent = cellData.genome;

  refs.zoomCell.classList.remove("normal", "infected", "burst", "damaged", "recovered");
  refs.zoomCell.classList.add(cellData.state);
  refs.cellInjection.classList.toggle("on", cellData.injection);
  refs.cellBurstMarks.classList.toggle("on", cellData.burst);

  renderCellMicroActions(index, cellData);
  renderCellCopies(cellData.copies);
  updateCellChecklist(cellData.checkpoint, cellData.complete);
}

function renderActionReadout(stageIndex) {
  const summary = stageActionSummaries[stageIndex] || stageActionSummaries[0];
  const bullets = stageActionBullets[stageIndex] || [];
  const liveViruses = refs.virusLayer.querySelectorAll(".entity.virus:not(.task-destroyed)").length;
  const engulfedTargets = refs.virusLayer.querySelectorAll(".entity.virus.task-being-devoured").length;
  const activeHunters = refs.immuneLayer.querySelectorAll(".entity.task-engulfing").length;
  const neutralized = refs.virusLayer.querySelectorAll(".entity.virus.bound, .entity.virus.task-neutralized").length;

  refs.actionSummary.textContent = summary;
  refs.metricViruses.textContent = String(liveViruses);
  refs.metricEngulfments.textContent = String(Math.max(engulfedTargets, Math.min(activeHunters, liveViruses)));
  refs.metricNeutralized.textContent = String(neutralized);

  refs.actionBullets.innerHTML = "";
  bullets.forEach((bullet) => {
    const item = document.createElement("li");
    item.textContent = bullet;
    refs.actionBullets.appendChild(item);
  });
}

function renderNodeActionText(stageIndex) {
  refs.nodeActionText.textContent = nodeActionDetails[stageIndex] || nodeActionDetails[0];
}

function renderTimeline() {
  refs.timelineCards.innerHTML = "";

  stages.forEach((stage, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "timeline-card";
    card.textContent = `${index + 1}. ${stage.short}`;
    card.setAttribute("aria-label", `Go to stage ${index + 1}: ${stage.title}`);
    card.setAttribute("aria-pressed", "false");
    card.addEventListener("click", () => {
      state.stageIndex = index;
      stopAutoPlay();
      renderStage();
    });
    refs.timelineCards.appendChild(card);
  });
}

function updateTimelineState() {
  const cards = [...refs.timelineCards.children];
  cards.forEach((card, index) => {
    card.classList.toggle("active", index === state.stageIndex);
    card.classList.toggle("done", index < state.stageIndex);
    card.setAttribute("aria-pressed", index === state.stageIndex ? "true" : "false");
    if (index === state.stageIndex) {
      card.setAttribute("aria-current", "step");
    } else {
      card.removeAttribute("aria-current");
    }
  });
}

function renderStage() {
  const current = stages[state.stageIndex];
  const progress = ((state.stageIndex + 1) / stages.length) * 100;

  refs.stageIndex.textContent = String(state.stageIndex + 1);
  refs.stageTotal.textContent = String(stages.length);
  refs.stageTitle.textContent = current.title;
  refs.stageDescription.textContent = current.description;
  refs.sceneCaption.textContent = current.caption;
  refs.progressBar.style.width = `${progress}%`;
  refs.lymphStatus.textContent = current.nodeStatus;

  clearLayer(refs.virusLayer);
  clearLayer(refs.debrisLayer);
  clearLayer(refs.immuneLayer);
  clearLayer(refs.antibodyLayer);
  clearLayer(refs.taskLayer);
  clearReadoutTimers();
  clearVirusRemovalTimers();
  clearMotionTasks();
  clearNodeTasks();
  clearEntitySelection();
  clearSceneInspectFocus();
  clearNodeInspectFocus();

  renderAmbientBackdropCells();
  setHostAppearance(current.host);
  spawnGroup(refs.virusLayer, "virus", current.scene.viruses);
  spawnGroup(refs.debrisLayer, "debris", current.scene.debris);
  spawnGroup(refs.immuneLayer, "neutrophil", current.scene.neutrophils);
  spawnGroup(refs.immuneLayer, "macrophage", current.scene.macrophages);
  spawnGroup(refs.immuneLayer, "dendritic", current.scene.dendritic);
  spawnGroup(refs.antibodyLayer, "antibody", current.scene.antibodies);
  applyTaskAnimations(state.stageIndex);
  applyNodeTaskAnimations(state.stageIndex);
  renderNodePanelDetails(state.stageIndex);
  renderActionReadout(state.stageIndex);
  renderNodeActionText(state.stageIndex);
  renderCellFocus(state.stageIndex);
  renderNodeCells(current.nodeCells);
  updateTimelineState();
  syncEntityInspectorForStage();

  const renderedStage = state.stageIndex;
  scheduleReadoutUpdate(() => {
    if (state.stageIndex === renderedStage) {
      renderActionReadout(renderedStage);
    }
  }, 520);
  scheduleReadoutUpdate(() => {
    if (state.stageIndex === renderedStage) {
      renderActionReadout(renderedStage);
    }
  }, 1240);
}

function stepForward() {
  if (state.stageIndex < stages.length - 1) {
    state.stageIndex += 1;
    renderStage();
  } else {
    stopAutoPlay();
  }
}

function stepBackward() {
  if (state.stageIndex > 0) {
    state.stageIndex -= 1;
    renderStage();
  }
}

function scheduleAutoPlayTick() {
  clearTimeout(state.timer);
  if (!state.autoPlay) {
    return;
  }
  const delay = Math.round(2800 / state.speed);
  state.timer = setTimeout(() => {
    stepForward();
    if (state.autoPlay && state.stageIndex < stages.length - 1) {
      scheduleAutoPlayTick();
    } else {
      stopAutoPlay();
    }
  }, delay);
}

function startAutoPlay() {
  if (state.autoPlay) {
    return;
  }
  state.autoPlay = true;
  refs.autoBtn.textContent = "Pause";
  refs.autoBtn.setAttribute("aria-pressed", "true");
  scheduleAutoPlayTick();
}

function stopAutoPlay() {
  state.autoPlay = false;
  refs.autoBtn.textContent = "Auto Play";
  refs.autoBtn.setAttribute("aria-pressed", "false");
  clearTimeout(state.timer);
}

function resetSimulation() {
  stopAutoPlay();
  state.stageIndex = 0;
  renderStage();
}

function renderQuiz() {
  const quizState = state.quiz;
  const activeQuestion = quizData[quizState.index];
  const isFinished = quizState.index >= quizData.length;

  if (isFinished) {
    refs.quizCard.innerHTML = `
      <p class="quiz-question">Mission complete</p>
      <p>You scored <strong>${quizState.score} / ${quizData.length}</strong>.</p>
      <p class="quiz-feedback">${
        quizState.score === quizData.length
          ? "Perfect score. You can explain this immune sequence like a pro."
          : "Nice work. Replay the simulation and try to beat your score."
      }</p>
      <button id="restartQuizBtn" class="btn primary" type="button">Restart Quiz</button>
    `;
    const restartBtn = document.getElementById("restartQuizBtn");
    restartBtn.addEventListener("click", () => {
      state.quiz = { index: 0, score: 0, answered: false };
      renderQuiz();
    });
    return;
  }

  const scoreLabel = `<span class="pill-score">Score: ${quizState.score} / ${quizData.length}</span>`;
  const options = activeQuestion.options
    .map(
      (option, index) =>
        `<button class="quiz-option" type="button" data-option="${index}">${option}</button>`
    )
    .join("");

  refs.quizCard.innerHTML = `
    ${scoreLabel}
    <p class="quiz-question">Q${quizState.index + 1}. ${activeQuestion.question}</p>
    <div class="quiz-options">${options}</div>
    <p id="quizFeedback" class="quiz-feedback"></p>
    <div class="quiz-controls">
      <button id="nextQuestionBtn" class="btn ghost" type="button" disabled>Next Question</button>
    </div>
  `;

  const optionEls = [...refs.quizCard.querySelectorAll(".quiz-option")];
  const feedbackEl = document.getElementById("quizFeedback");
  const nextBtn = document.getElementById("nextQuestionBtn");

  optionEls.forEach((optionEl) => {
    optionEl.addEventListener("click", () => {
      if (quizState.answered) {
        return;
      }

      const picked = Number(optionEl.dataset.option);
      quizState.answered = true;
      nextBtn.disabled = false;

      optionEls.forEach((btn, idx) => {
        if (idx === activeQuestion.answer) {
          btn.classList.add("correct");
        } else if (idx === picked && picked !== activeQuestion.answer) {
          btn.classList.add("wrong");
        }
      });

      if (picked === activeQuestion.answer) {
        quizState.score += 1;
      }
      feedbackEl.textContent = activeQuestion.explain;
    });
  });

  nextBtn.addEventListener("click", () => {
    if (!quizState.answered) {
      return;
    }
    quizState.index += 1;
    quizState.answered = false;
    renderQuiz();
  });
}

function getDialogFocusableElements(container) {
  if (!container) {
    return [];
  }
  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ];
  return [...container.querySelectorAll(selectors.join(","))];
}

function openAboutDialog() {
  if (!refs.aboutDialog) {
    return;
  }

  const activeEl = document.activeElement;
  state.aboutDialog.triggerEl = activeEl instanceof HTMLElement ? activeEl : refs.openAboutDialogBtn;
  refs.aboutDialog.hidden = false;
  document.body.classList.add("dialog-open");
  state.aboutDialog.open = true;

  const focusables = getDialogFocusableElements(refs.aboutDialog);
  if (focusables.length) {
    focusables[0].focus();
  }
}

function closeAboutDialog() {
  if (!refs.aboutDialog || !state.aboutDialog.open) {
    return;
  }

  refs.aboutDialog.hidden = true;
  document.body.classList.remove("dialog-open");
  state.aboutDialog.open = false;

  if (state.aboutDialog.triggerEl && typeof state.aboutDialog.triggerEl.focus === "function") {
    state.aboutDialog.triggerEl.focus();
  }
  state.aboutDialog.triggerEl = null;
}

function handleAboutDialogKeydown(event) {
  if (!state.aboutDialog.open || !refs.aboutDialog) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeAboutDialog();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusables = getDialogFocusableElements(refs.aboutDialog);
  if (!focusables.length) {
    event.preventDefault();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function wireControls() {
  refs.nextBtn.addEventListener("click", () => {
    stopAutoPlay();
    stepForward();
  });

  refs.prevBtn.addEventListener("click", () => {
    stopAutoPlay();
    stepBackward();
  });

  refs.autoBtn.addEventListener("click", () => {
    if (state.autoPlay) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  });

  refs.resetBtn.addEventListener("click", () => {
    resetSimulation();
  });

  refs.speedRange.addEventListener("input", (event) => {
    const newSpeed = Number(event.target.value);
    state.speed = newSpeed;
    refs.speedLabel.textContent = `${newSpeed.toFixed(1)}x`;

    if (state.autoPlay) {
      scheduleAutoPlayTick();
    }
  });

  if (refs.openAboutDialogBtn) {
    refs.openAboutDialogBtn.addEventListener("click", () => {
      openAboutDialog();
    });
  }

  if (refs.closeAboutDialogBtn) {
    refs.closeAboutDialogBtn.addEventListener("click", () => {
      closeAboutDialog();
    });
  }

  if (refs.aboutDialog) {
    refs.aboutDialog.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.dataset.aboutClose === "true") {
        closeAboutDialog();
      }
    });
  }

  if (refs.closeInspectorBtn) {
    refs.closeInspectorBtn.addEventListener("click", () => {
      closeEntityInspector();
    });
  }

  if (refs.hostCell) {
    refs.hostCell.classList.add("inspectable-host");
    refs.hostCell.setAttribute("role", "button");
    refs.hostCell.setAttribute("tabindex", "0");
    refs.hostCell.setAttribute("aria-label", "Inspect Host Epithelial Cell");
    refs.hostCell.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openEntityInspector("host", refs.hostCell);
    });
    refs.hostCell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        openEntityInspector("host", refs.hostCell);
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (state.aboutDialog.open) {
      handleAboutDialogKeydown(event);
      if (event.defaultPrevented) {
        return;
      }
    }

    if (event.key === "Escape" && state.inspector.open) {
      closeEntityInspector();
    }
  });
}

function init() {
  stopAmbientBackdropMotion();
  renderEpithelialBackdrop();
  renderAmbientBackdropCells();
  startAmbientBackdropMotion();
  renderInspectorPlaceholder();
  renderTimeline();
  renderStage();
  renderQuiz();
  wireControls();
}

init();
