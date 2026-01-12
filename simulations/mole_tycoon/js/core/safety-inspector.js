/**
 * MoleTycoon Safety Inspector
 * Random audits during gameplay with lab safety questions.
 * 
 * Cycle 5: Safety Inspector
 */

/**
 * Lab Safety Questions Bank
 * Categories: PPE, Chemical Disposal, Emergency Protocols, Equipment
 */
const SAFETY_QUESTIONS = [
    // PPE Questions
    {
        id: 'ppe-1',
        category: 'PPE',
        question: 'When should safety goggles be worn in the lab?',
        options: [
            'Only when handling acids',
            'Whenever chemicals are present',
            'Only during experiments',
            'When the teacher is watching'
        ],
        correctIndex: 1,
        explanation: 'Safety goggles should be worn at all times when any chemicals are present in the lab.'
    },
    {
        id: 'ppe-2',
        category: 'PPE',
        question: 'Which type of footwear is appropriate for the chemistry lab?',
        options: [
            'Open-toed sandals',
            'Flip-flops',
            'Closed-toe shoes',
            'High heels'
        ],
        correctIndex: 2,
        explanation: 'Closed-toe shoes protect feet from spills and dropped equipment.'
    },
    {
        id: 'ppe-3',
        category: 'PPE',
        question: 'A lab coat should be:',
        options: [
            'Buttoned up completely',
            'Left open for comfort',
            'Worn only with acids',
            'Made of polyester'
        ],
        correctIndex: 0,
        explanation: 'Lab coats should be fully buttoned to provide maximum protection.'
    },

    // Chemical Disposal Questions
    {
        id: 'disposal-1',
        category: 'Disposal',
        question: 'Where should chemical waste be disposed?',
        options: [
            'Down the sink',
            'In the regular trash',
            'In labeled waste containers',
            'Outside the window'
        ],
        correctIndex: 2,
        explanation: 'Chemical waste must go in properly labeled containers for safe disposal.'
    },
    {
        id: 'disposal-2',
        category: 'Disposal',
        question: 'What should you do with broken glass in the lab?',
        options: [
            'Throw it in regular trash',
            'Put it in the glass disposal box',
            'Leave it on the floor',
            'Hide it under the table'
        ],
        correctIndex: 1,
        explanation: 'Broken glass should go in a designated glass disposal container.'
    },
    {
        id: 'disposal-3',
        category: 'Disposal',
        question: 'Unused chemicals should be:',
        options: [
            'Poured back into original container',
            'Disposed of properly',
            'Given to a friend',
            'Saved in your pocket'
        ],
        correctIndex: 1,
        explanation: 'Never return unused chemicals to the original container to avoid contamination.'
    },

    // Emergency Protocol Questions
    {
        id: 'emergency-1',
        category: 'Emergency',
        question: 'If chemicals splash in your eyes, what is the FIRST step?',
        options: [
            'Rub your eyes',
            'Use the eyewash station for 15 minutes',
            'Finish your experiment first',
            'Close your eyes tightly'
        ],
        correctIndex: 1,
        explanation: 'Immediately flush eyes at the eyewash station for at least 15 minutes.'
    },
    {
        id: 'emergency-2',
        category: 'Emergency',
        question: 'What should you do if your clothes catch fire?',
        options: [
            'Run to get help',
            'Fan the flames',
            'Stop, drop, and roll',
            'Continue working'
        ],
        correctIndex: 2,
        explanation: 'Stop, drop, and roll to smother flames. Use a safety shower if available.'
    },
    {
        id: 'emergency-3',
        category: 'Emergency',
        question: 'If you spill a chemical on yourself, you should:',
        options: [
            'Wipe it off with a paper towel',
            'Rinse the area with water immediately',
            'Ignore small spills',
            'Keep working carefully'
        ],
        correctIndex: 1,
        explanation: 'Immediately rinse any chemical contact with water and notify the instructor.'
    },

    // Equipment Handling Questions
    {
        id: 'equipment-1',
        category: 'Equipment',
        question: 'How should you heat a test tube?',
        options: [
            'Point it at yourself',
            'Point it away from people',
            'Heat the bottom directly',
            'Shake it while heating'
        ],
        correctIndex: 1,
        explanation: 'Always point test tubes away from yourself and others when heating.'
    },
    {
        id: 'equipment-2',
        category: 'Equipment',
        question: 'Before using a hot plate, you should:',
        options: [
            'Touch it to check temperature',
            'Assume it is cold',
            'Check if it is on and wait for it to heat',
            'Place flammable materials nearby'
        ],
        correctIndex: 2,
        explanation: 'Always check equipment status and ensure the area is clear of hazards.'
    },
    {
        id: 'equipment-3',
        category: 'Equipment',
        question: 'When handling a graduated cylinder, you should:',
        options: [
            'Hold it at eye level to read',
            'Read from above',
            'Estimate the measurement',
            'Hold it up to the light'
        ],
        correctIndex: 0,
        explanation: 'Read graduated cylinders at eye level for accurate measurements.'
    },
];

/**
 * Safety Inspector Manager
 */
const SafetyInspector = {
    // ==================== CONFIGURATION ====================

    auditChance: 0.15,        // 15% chance per contract
    bonusAmount: 50,          // $50 for passing
    fineAmount: 100,          // $100 for failing

    // Track audits this shift
    auditsThisShift: [],
    pendingAudit: null,

    // ==================== AUDIT CONTROL ====================

    /**
     * Check if an audit should trigger
     * @returns {boolean} Whether to trigger an audit
     */
    shouldTriggerAudit() {
        return Math.random() < this.auditChance;
    },

    /**
     * Get a random safety question
     * @returns {object} Question object
     */
    getRandomQuestion() {
        const index = Math.floor(Math.random() * SAFETY_QUESTIONS.length);
        return { ...SAFETY_QUESTIONS[index] };
    },

    /**
     * Start an audit - returns the question to display
     * @returns {object} Audit data with question
     */
    startAudit() {
        const question = this.getRandomQuestion();
        this.pendingAudit = {
            question,
            startTime: Date.now(),
        };
        console.log('👷 Safety Inspection triggered!');
        return this.pendingAudit;
    },

    /**
     * Process audit result
     * @param {number} selectedIndex - User's selected answer index
     * @returns {object} Result with pass/fail and consequences
     */
    processAuditResult(selectedIndex) {
        if (!this.pendingAudit) return null;

        const { question } = this.pendingAudit;
        const passed = selectedIndex === question.correctIndex;
        const consequence = passed ? this.bonusAmount : -this.fineAmount;

        const result = {
            passed,
            question,
            selectedIndex,
            correctIndex: question.correctIndex,
            consequence,
            explanation: question.explanation,
        };

        // Track result
        this.auditsThisShift.push(result);
        this.pendingAudit = null;

        console.log(`👷 Audit ${passed ? 'PASSED' : 'FAILED'}: ${consequence >= 0 ? '+' : ''}$${consequence}`);

        return result;
    },

    /**
     * Get shift audit summary
     */
    getShiftSummary() {
        const passed = this.auditsThisShift.filter(a => a.passed).length;
        const failed = this.auditsThisShift.filter(a => !a.passed).length;
        const totalConsequence = this.auditsThisShift.reduce((sum, a) => sum + a.consequence, 0);

        return {
            total: this.auditsThisShift.length,
            passed,
            failed,
            totalConsequence,
            audits: this.auditsThisShift,
        };
    },

    /**
     * Reset for new shift
     */
    resetForShift() {
        this.auditsThisShift = [];
        this.pendingAudit = null;
        console.log('👷 Safety Inspector reset for new shift');
    },

    /**
     * Check if there's a pending audit
     */
    hasPendingAudit() {
        return this.pendingAudit !== null;
    },
};

// Make globally available
window.SafetyInspector = SafetyInspector;

// Export
export { SafetyInspector, SAFETY_QUESTIONS };
export default SafetyInspector;
