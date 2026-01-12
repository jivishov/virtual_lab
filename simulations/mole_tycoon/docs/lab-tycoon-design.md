# MoleVille: Lab Tycoon — Game Design Document v2.0

> **Vision**: Chemistry is the engine of a business empire.
> **Target**: Texas High School Chemistry (TEKS aligned).
> **Philosophy**: Accuracy → Yield → Profit. Mistakes have economic consequences.

---

## Part 1: Core Systems

### 1.1 Economy
| Currency | Purpose | Earned By |
|---|---|---|
| **Cash ($)** | Equipment, Materials | Completing contracts profitably |
| **XP** | Career progression | Accuracy, Streak bonuses |
| **Reputation** | Unlock premium contracts | Consistent success |

### 1.2 Career Ladder (Progression)
| Level | Title | Focus | Texas Context |
|---|---|---|---|
| 1-5 | Intern | Unit Conversions | Lab prep |
| 6-10 | Technician | Molarity, Solutions | Clinic supplies |
| 11-15 | Engineer | Stoichiometry | SpaceX fuel |
| 16-20 | Process Lead | Limiting Reactants | Refineries |
| 21+ | Plant Manager | Yield Optimization | Full operations |

### 1.3 Specialization Trees (Post Level 10)
| Track | Focus | Unique Equipment |
|---|---|---|
| **Petrochemical** | Combustion, Energy | Calorimeter |
| **Pharmaceutical** | Purity, Dosing | HPLC Analyzer |
| **Agricultural** | Fertilizer, pH | Soil Analyzer |

---

## Part 2: Gameplay Features

### 2.1 Shift System
- **8-Hour Shift**: Timer ticks. More efficient work = more contracts.
- **Paystub**: End-of-shift summary (Gross, Tax, Net).

### 2.2 Living Avatar
- **Energy Bar**: Problems cost energy. Refills over time or via "Lunch Break".
- **Mood**: Streaks → Happy (XP boost). Errors → Stressed (temp debuff).
- **Cosmetics**: Lab coats, goggles unlocked via XP.

### 2.3 Investor Reviews
- Every 10 contracts: Investor evaluates performance.
- High score = Lab upgrade. Low score = Warning.

### 2.4 Safety Inspector
- Random event: Identify hazards.
- Pass = Bonus. Fail = Fine + Safety Training mini-lesson.

---

## Part 3: Implementation Cycles

> Each cycle is scoped for **1 LLM session** (~50-100 tool calls).
> Cycles are **independent and testable**.

---

### Cycle 0: Foundation (State Management)
**Goal**: Create the economic backbone without UI changes.

| Task | File | Scope |
|---|---|---|
| Create `GameState` class | `js/core/game-state.js` | Cash, XP, Level, Reputation |
| Add persistence | Same | `localStorage` save/load |
| Unit tests | `tests/game-state.test.js` | Verify state operations |

**Exit Criteria**: `GameState` can be imported, modified, and persisted. Console-testable.

---

### Cycle 1: Contract Engine
**Goal**: Wrap existing problems in "Contract" flavor.

| Task | File | Scope |
|---|---|---|
| Create `Contract` class | `js/core/contract.js` | Problem wrapper with client name, pay, time |
| Contract Generator | `js/core/contract-generator.js` | Pull from existing question banks |
| Integrate with `GameEngine` | `js/core/game-engine.js` | Render contract instead of raw question |

**Exit Criteria**: Playing a game shows "Contract from [Client]" instead of plain question.

---

### Cycle 2: Yield & Profit System
**Goal**: Calculate and display economic outcome.

| Task | File | Scope |
|---|---|---|
| Yield Calculator | `js/core/yield-calculator.js` | Accuracy → Yield % |
| Profit Calculator | `js/core/profit-calculator.js` | Revenue - Costs - Waste |
| Results Screen | `js/ui/results-screen.js` | Display Ledger (visual) |

**Exit Criteria**: After a game, a "Profit Report" shows Revenue, Costs, Net.

---

### Cycle 3: Career Progression
**Goal**: Level-up mechanics and title display.

| Task | File | Scope |
|---|---|---|
| XP Thresholds | `js/core/progression.js` | Define level brackets |
| Level-Up Logic | Same | Check XP, trigger level up |
| UI: Career Badge | `js/ui/career-badge.js` | Display title on hub |

**Exit Criteria**: Earning XP increases level. Hub shows "Junior Technician" badge.

---

### Cycle 4: Living Avatar (Needs)
**Goal**: Avatar has Energy and Mood.

| Task | File | Scope |
|---|---|---|
| Avatar State | `js/core/avatar-state.js` | Energy, Mood properties |
| Energy Drain | Integrate with `GameEngine` | Problems cost energy |
| Mood Effects | Same | Streaks affect mood |
| UI: Energy Bar | `css/components.css`, `app.js` | Visual bar on hub |

**Exit Criteria**: Energy decreases with play. Visual bar reflects state.

---

### Cycle 5: Shift System
**Goal**: Time-boxed gameplay sessions.

| Task | File | Scope |
|---|---|---|
| Shift Timer | `js/core/shift-timer.js` | 8-hour (simulated) clock |
| Shift Summary | `js/ui/shift-summary.js` | Paystub modal |
| Integration | `js/app.js` | "Start Shift" button |

**Exit Criteria**: Player can start a shift, clock ticks, shift ends with Paystub.

---

### Cycle 6: Safety Inspector (Random Event)
**Goal**: Add surprise audit events.

| Task | File | Scope |
|---|---|---|
| Event Trigger | `js/core/events.js` | Random chance per contract |
| Safety Questions | `js/data/safety-questions.js` | Question bank (10-20 Qs) |
| UI: Popup Modal | `js/ui/safety-modal.js` | Display and handle answer |

**Exit Criteria**: During gameplay, Safety Inspector can appear. Pass/Fail affects cash.

---

### Cycle 7: Investor Review (Meta Progression)
**Goal**: Long-term accountability.

| Task | File | Scope |
|---|---|---|
| Review Tracker | `js/core/review-tracker.js` | Count contracts, avg performance |
| Review Modal | `js/ui/review-modal.js` | Display Investor feedback |
| Lab Tier System | `js/core/lab-tier.js` | Unlock lab visuals on success |

**Exit Criteria**: Every 10 contracts, Investor Review appears. Good = Upgrade. Bad = Warning.

---

### Cycle 8: Specialization Trees
**Goal**: Branching career paths.

| Task | File | Scope |
|---|---|---|
| Track Definitions | `js/data/specializations.js` | 3 tracks with unique content |
| Selection UI | `js/ui/specialization-select.js` | Modal at Level 10 |
| Filtered Contracts | `js/core/contract-generator.js` | Track-specific problems |

**Exit Criteria**: At Level 10, player chooses a track. Future contracts match track.

---

### Cycle 9: Equipment Upgrades
**Goal**: Spend cash to reduce cognitive load.

| Task | File | Scope |
|---|---|---|
| Equipment Store | `js/ui/equipment-store.js` | List of purchasable items |
| Equipment Effects | `js/core/equipment.js` | Modify problem display (e.g., show molar mass) |
| Persistence | Integrate with `GameState` | Save owned equipment |

**Exit Criteria**: Player can buy "Digital Balance". It auto-displays molar mass in problems.

---

### Cycle 10: Visual Polish
**Goal**: Make the lab evolve.

| Task | File | Scope |
|---|---|---|
| Lab Backgrounds | `assets/backgrounds/` | 3 tiers (Garage, Lab, Facility) |
| Tier Logic | `js/core/lab-tier.js` | Tie to Investor success |
| Hub Refactor | `js/app.js`, `css/` | Dynamic background based on tier |

**Exit Criteria**: Hub background changes as player progresses.

---

## Part 4: File Structure (Proposed)
```
js/
├── core/
│   ├── game-engine.js (existing)
│   ├── game-state.js (Cycle 0)
│   ├── contract.js (Cycle 1)
│   ├── contract-generator.js (Cycle 1)
│   ├── yield-calculator.js (Cycle 2)
│   ├── profit-calculator.js (Cycle 2)
│   ├── progression.js (Cycle 3)
│   ├── avatar-state.js (Cycle 4)
│   ├── shift-timer.js (Cycle 5)
│   ├── events.js (Cycle 6)
│   ├── review-tracker.js (Cycle 7)
│   ├── lab-tier.js (Cycle 7)
│   └── equipment.js (Cycle 9)
├── ui/
│   ├── results-screen.js (Cycle 2)
│   ├── career-badge.js (Cycle 3)
│   ├── shift-summary.js (Cycle 5)
│   ├── safety-modal.js (Cycle 6)
│   ├── review-modal.js (Cycle 7)
│   ├── specialization-select.js (Cycle 8)
│   └── equipment-store.js (Cycle 9)
└── data/
    ├── safety-questions.js (Cycle 6)
    └── specializations.js (Cycle 8)
```
