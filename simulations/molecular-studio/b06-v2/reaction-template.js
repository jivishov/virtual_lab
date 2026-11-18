// Reaction Lab owns this markup inside its isolated panel.
// B06 studio layout (phase 3, 2026-11-17): kit on the left, stage head, model, view tools and one
// coach line in the middle, one docked task panel on the right, a slim footer under all three.
// Hidden carriers keep the original form fields (radios, select, checkboxes, range) that the buttons drive.
// The four gesture cards of the hand setup dialog (B06 mock). A closed glyph shows curled fingers.
const handGlyph=closed=>{const h=closed?8:22,y=closed?20:6;
  return '<rect x="16" y="24" width="28" height="24" rx="7"/>'+[16,23.5,31,38.5].map((x,i)=>`<rect x="${x}" y="${y+(i%3?0:3)}" width="5.5" height="${h}" rx="2.7"/>`).join('')+
    `<rect x="${closed?12:6}" y="${closed?26:28}" width="${closed?8:12}" height="6" rx="3"/>`;};
const gestureCards=[['Aim',false,'Open palm moves the pointer'],['Grab or press',true,'Curl three fingers'],['Let go or select',false,'Open your hand'],['Zoom',true,'Two closed hands, spread apart']]
  .map(([title,closed,text])=>`<div><svg width="60" height="54" viewBox="0 0 60 54" fill="currentColor" aria-hidden="true">${handGlyph(closed)}</svg><b>${title}</b>${text}</div>`).join('');
export const reactionTemplate = `
  <div id="app" class="app">
    <aside id="kit" class="rx-kit" aria-label="Reactants and atoms">
      <div id="kit-terms" class="rx-kitgroup" data-rx-desk>
        <h3 class="rx-label">Reactants</h3>
        <div id="reactant-terms" class="rx-terms"></div>
        <p class="rx-traynote">Load the reactants, or choose Build by hand to place every atom yourself.</p>
      </div>
      <div id="kit-view" class="rx-kitgroup rx-kitview" data-rx-hand>
        <h3 class="rx-label">Reaction</h3>
        <div class="rx-tiles" style="--cols:1">
          <button id="shelf-open" class="rx-tile" data-shelf aria-controls="shelf" aria-expanded="false">Reactions</button>
          <button class="rx-tile" data-proxy="fit">Fit view</button>
          <button class="rx-tile" data-ids aria-pressed="false">All IDs</button>
        </div>
      </div>
      <div id="kit-atoms" class="rx-kitgroup" hidden>
        <h3 class="rx-label">Add atoms</h3>
        <div id="kit-elements" class="rx-elgrid" role="group" aria-label="Add atoms"></div>
        <button id="add-atoms" class="rx-btn rx-small" aria-haspopup="dialog" aria-controls="atom-dialog" data-rx-desk>Other elements</button>
        <button id="hand-move-tile" class="rx-tile" aria-pressed="false" data-rx-hand>Move atoms</button>
        <p class="rx-traynote" data-rx-desk>Highlighted elements belong to this reaction. Press two atoms on the model, then Connect.</p>
      </div>
    </aside>

    <section id="stage-col" class="rx-stagecol" aria-label="Reaction model">
      <div id="stagehead" class="rx-stagehead">
        <div id="family-pills" class="rx-pills" role="group" aria-label="Reaction family"></div>
        <div id="example-buttons" class="rx-mols" role="group" aria-label="Reaction"></div>
      </div>
      <div id="scene" class="scene">
        <div id="reaction-stage" tabindex="0" aria-label="Interactive reaction model. Reactants stay on the left and products form on the right. Press an atom to follow it. Drag empty space or use arrow keys to tilt; scroll or pinch to zoom."></div>
        <div class="rx-title"><h2 id="reaction-title"></h2><p id="equation" aria-label="Reaction equation"></p></div>
        <div class="rx-side-headings"><div><strong>Reactants</strong><span id="left-caption">Starting particles</span></div><div><strong>Products</strong><span id="right-caption">Made from the same atoms</span></div></div>
        <div id="empty-state" class="empty-state">
          <strong>Start with the reactants.</strong>
          <p id="empty-copy">Load them from the task panel, or build them by hand.</p>
        </div>
        <div class="rx-stage-caption"><p id="representation-note"></p></div>
        <div class="experience-tools rx-view-tools" aria-label="Immersive tools">
          <button id="imm-shelf" data-shelf aria-controls="shelf" aria-expanded="false">Reactions</button>
          <button id="hands-open" disabled aria-haspopup="dialog" aria-controls="hand-setup" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v6c0 4-2 7-6 7h-1c-2 0-3-1-5-3l-4-5a1.6 1.6 0 0 1 2-2l2 2"/></svg><span>Hands</span></button>
          <button id="immerse" disabled aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg><span>Immerse</span></button>
          <button id="imm-controls" aria-controls="observation-rail" aria-expanded="false" hidden>Controls</button>
        </div>
        <div id="shelf" class="rx-shelf" role="group" aria-labelledby="shelf-title" hidden>
          <h2 id="shelf-title" tabindex="-1">Choose a reaction</h2>
          <div id="shelf-families" class="rx-tiles" style="--cols:3" role="group" aria-label="Reaction family"></div>
          <div id="shelf-cards" class="rx-cards" role="group" aria-label="Reactions in this family"></div>
          <div class="rx-shelfclose"><button id="shelf-close" class="rx-tile">Close</button></div>
        </div>
        <div id="hands-session" class="hands-session" hidden>
          <div class="hand-navigation" role="group" aria-label="Hand action"><button id="hand-rotate" aria-pressed="true">Rotate</button><button id="hand-move" aria-pressed="false">Move atoms</button><button id="hand-zoom-out" aria-label="Zoom out">−</button><button id="hand-zoom-in" aria-label="Zoom in">＋</button></div>
          <p id="hand-status" role="status">Show an open hand.</p>
          <div class="hand-session-actions"><button id="hand-settings">Settings</button><button id="hand-stop">Stop hands</button></div>
        </div>
        <div id="immersive-playback" class="immersive-playback" hidden aria-label="Reaction playback">
          <button id="imm-play" class="primary">React</button><button id="imm-reset">Reset / edit</button>
          <label class="sr-only" for="imm-progress">Observation position</label><input id="imm-progress" type="range" min="0" max="1000" value="0" step="1"><output id="imm-progress-value" for="imm-progress">0%</output>
          <p id="imm-status" role="status">Ready. Follow the same atoms.</p>
        </div>
        <p class="immersive-limit" hidden>Atom accounting, not a mechanism. Playback speed is not reaction rate.</p>
      </div>
      <div id="viewbar" class="rx-viewbar" role="toolbar" aria-label="View tools">
        <div class="rx-seg"><button id="turn-left" class="rx-turn" aria-label="Turn left" title="Turn left">↶</button><button id="turn-right" class="rx-turn" aria-label="Turn right" title="Turn right">↷</button></div>
        <div class="rx-seg"><button id="fit">Fit view</button><button id="zoom-out" aria-label="Zoom out" title="Zoom out">−</button><button id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button></div>
        <div class="rx-seg"><button data-ids aria-pressed="false">All IDs</button><button data-reveal aria-pressed="false">Show products</button></div>
      </div>
      <div id="coach" class="rx-coach"><span class="rx-ico" aria-hidden="true">i</span><span id="status" role="status" aria-live="polite">Load reactants to begin.</span></div>
    </section>

    <aside id="observation-rail" class="rx-rail" aria-label="Your task">
      <button id="close-imm-controls" class="close-imm-controls" aria-label="Close observation controls" hidden>×</button>
      <ol id="steps" class="rx-steps" aria-label="Steps"><li><i>1</i>Prepare</li><li><i>2</i>React</li><li><i>3</i>Observe</li></ol>
      <div id="task" class="rx-task">
        <section id="task-build" aria-labelledby="build-heading">
          <h2 id="build-heading" tabindex="-1">Prepare the reactants</h2>
          <p id="family-description" class="rx-lead" data-rx-desk></p>
          <div id="needed-box" class="rx-box"><small>Reactants needed</small><output id="recipe"></output></div>
          <div class="rx-btnrow rx-prep">
            <button id="load" class="rx-btn">Load reactants</button>
            <button id="manual-toggle" class="rx-btn" aria-pressed="false">Build by hand</button>
            <button class="rx-btn" data-stepped data-rx-hand aria-pressed="false">Step through</button>
          </div>
          <div id="task-manual" class="rx-manual" hidden>
            <h3 id="bond-heading">Connection for two selected atoms</h3>
            <div id="bond-buttons" class="rx-chips" style="--cols:4" role="group" aria-labelledby="bond-heading"></div>
            <div class="rx-chips rx-edit" style="--cols:3">
              <button id="connect">Connect</button><button id="disconnect">Disconnect</button><button id="delete-atoms">Delete</button>
              <button data-proxy="undo" data-rx-hand>Undo</button><button data-proxy="arrange" data-rx-hand>Arrange</button><button data-proxy="clear" data-rx-hand>Clear</button>
            </div>
            <p id="selection-note" class="rx-help">Press two atoms on the model to connect them.</p>
            <div class="rx-sheets" data-rx-desk>
              <details class="rx-sheet"><summary>Atom list (keyboard)</summary><p class="rx-help">Choose two atoms, then a connection and Connect.</p><div id="build-atoms" class="atom-picker"></div></details>
              <details class="rx-sheet"><summary>Connection guide</summary><div id="connection-guide" class="connection-guide"></div><p class="rx-help">Guide numbers restart within each formula amount. Leave dissolved ions separate.</p></details>
            </div>
          </div>
          <div class="rx-acct-slot" data-acct="build"></div>
          <div class="rx-rowlab rx-nomanual" data-rx-desk id="build-stepped"><span>Stop at each of the five views</span><div class="rx-seg"><button data-stepped aria-pressed="false">Step through</button></div></div>
          <p class="rx-lead rx-cond rx-nomanual" data-rx-desk><b>Conditions.</b> <span id="conditions-line"></span></p>
        </section>
        <section id="task-play" aria-labelledby="phase-label" hidden>
          <h2 id="phase-label" tabindex="-1">Observe reactants</h2>
          <p id="phase-note" class="rx-lead" data-rx-desk></p>
          <div id="stops" class="rx-stops" role="group" aria-label="Five views"></div>
          <div class="rx-prog" data-rx-desk><label class="sr-only" for="progress">Observation position</label><input id="progress" type="range" min="0" max="1000" value="0" step="1" disabled><output id="progress-value" for="progress">0%</output></div>
          <div class="rx-rowlab" data-rx-desk><span>Playback speed <small>(not reaction rate)</small></span><div id="speeds" class="rx-seg" role="group" aria-label="Playback speed"></div></div>
          <div id="hand-speeds" class="rx-tiles" style="--cols:4" role="group" aria-label="Playback speed, not reaction rate" data-rx-hand></div>
          <div class="rx-rowlab" data-rx-desk><span>Stop at each of the five views</span><div class="rx-seg"><button data-stepped aria-pressed="false">Step through</button></div></div>
          <div class="rx-tiles" style="--cols:2" data-rx-hand><button class="rx-tile" data-stepped aria-pressed="false">Step through</button><button class="rx-tile" data-reveal aria-pressed="false">Show products</button></div>
          <div class="rx-status rx-trackbox">
            <p id="tracking-note"><b>Track one atom:</b> press it on the model.</p>
            <details class="rx-sheet" data-rx-desk><summary>Track by ID (keyboard)</summary><p class="rx-help">Choose an atom to follow it. Choose it again to stop.</p><div id="track-atoms" class="atom-picker"></div></details>
          </div>
          <div class="rx-acct-slot" data-acct="play"></div>
        </section>
        <div id="accounting" class="rx-status rx-acct"><b id="conserved">0 atoms on bench</b> <span id="inventory">No atoms loaded</span><span id="charge" hidden></span><span id="particles" data-rx-desk></span></div>
      </div>
      <div class="rx-actions">
        <p id="why" class="rx-why"></p>
        <div class="rx-btnrow"><button id="reset" class="rx-btn" hidden>Reset / edit</button><button id="play" class="rx-btn rx-primary" disabled>React <span aria-hidden="true">▶</span></button></div>
      </div>
    </aside>

    <footer id="foot" class="rx-foot">
      <button id="undo" class="rx-btn rx-small">↶ Undo</button>
      <button id="arrange" class="rx-btn rx-small">Arrange</button>
      <button id="clear" class="rx-btn rx-small">Clear bench</button>
      <button id="details-open" class="rx-btn rx-small" aria-haspopup="dialog" aria-controls="reaction-details">Details</button>
      <button id="help-open" class="rx-btn rx-small">Help</button>
      <span class="rx-saved">Atom accounting, not a molecular mechanism. Playback speed is not reaction rate.</span>
    </footer>

    <div id="hand-bar" class="rx-hbar" data-rx-hand>
      <div class="rx-hcoach"><p id="hand-bar-status" role="status" aria-live="polite"></p><small id="hand-bar-hint">Open palm aims · close to press or turn · open to let go · two closed hands spread to zoom</small></div>
      <button id="hand-bar-settings" class="rx-hbtn">Camera</button>
      <button id="hand-bar-exit" class="rx-hbtn rx-hexit">Exit hand building</button>
    </div>

    <div class="rx-carriers" hidden>
      <fieldset class="family-group"><legend>Reaction family</legend><div id="families" class="families"></div></fieldset>
      <label for="example">Example <span id="example-count">1 of 5</span></label><select id="example"></select>
      <details id="manual"><summary>Build atoms yourself</summary></details>
      <fieldset class="connection-group"><legend>Connection</legend>
        <label><input type="radio" name="bond" value="1" checked>Single</label>
        <label><input type="radio" name="bond" value="2">Double</label>
        <label><input type="radio" name="bond" value="3">Triple</label>
        <label><input type="radio" name="bond" value="0">Ionic link</label>
      </fieldset>
      <label><input type="checkbox" id="ids"> All IDs</label>
      <label><input type="checkbox" id="stepped"> Step through</label>
      <label><input type="checkbox" id="reveal"> Show products</label>
      <label for="speed">Playback speed <output id="speed-value">1×</output></label><input id="speed" type="range" min=".25" max="2" step=".25" value="1">
      <label for="track">Follow this ID</label><select id="track" disabled><option value="">Choose an atom</option></select>
    </div>
  </div>

  <dialog id="reaction-details" aria-labelledby="details-title">
    <header class="dialog-heading"><div><p class="eyebrow" id="detail-family"></p><h2 id="details-title"></h2></div><button data-close="reaction-details" autofocus>Done</button></header>
    <div class="detail-body">
      <p id="detail-equation" class="detail-equation"></p>
      <h3>Conditions</h3><p id="conditions"></p>
      <h3>What to observe</h3><p id="lesson"></p>
      <div id="net-ionic-section" hidden><h3>Net ionic equation</h3><p id="net-ionic" class="detail-equation"></p></div>
      <h3>How to read this model</h3><p id="detail-representation"></p>
      <p>The same spheres and atom IDs move from reactants to products. The drawing shows atom accounting; its paths and separated atoms do not represent a reaction mechanism or free-atom intermediates. Only changing connections are removed and formed. Unchanged spectator ions remain unchanged chemically while moving across the equation.</p>
      <details><summary>Connection guide</summary><div id="detail-guide" class="connection-guide"></div></details>
      <details><summary>Model limits and scientific context</summary>
        <p>All 25 equations have neutral overall reactant and product inventories. Endpoint formal ionic charges are checked. Electrons, intermediate charge distributions, solvent molecules, crystal lattices, collisions, activation barriers, thermodynamics, kinetics, equilibrium and yields are not simulated.</p>
        <p>Dissolved strong electrolytes appear as separate ions. Charge labels belong to whole particles. H⁺ is shorthand for hydrated protons; solvent water is omitted. Dashed links represent ionic solid formula-unit samples, not covalent bonds or a full lattice.</p>
        <p>Sizes and distances are illustrative. Carbon geometry is ideally tetrahedral; water is bent, ammonia pyramidal and carbon dioxide linear. Polyatomic ions show one Lewis contributor, not localized resonance bonds. Breaking bonds requires energy; forming bonds releases energy. This model does not display the net energy change.</p>
        <p>Families are teaching categories and can overlap. <a href="https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions" target="_blank" rel="noreferrer">Chemistry reference</a>.</p>
      </details>
    </div>
  </dialog>
  <dialog id="hand-setup" class="hand-setup" aria-labelledby="hand-setup-title">
    <div class="hand-setup-body">
      <h2 id="hand-setup-title">Set up hand building</h2>
      <p class="hand-setup-lead">Place the frame around one student’s hands. Camera images stay on this device.</p>
      <div class="hand-setup-grid">
        <div>
          <div class="hand-camera">
            <button id="hand-preview" class="hand-preview" aria-label="Position the player frame. Click your work area or use the arrow keys.">
              <video id="hand-preview-video" autoplay muted playsinline></video><span id="hand-preview-empty">Camera is off<span>Turn it on when you are ready.</span></span><span id="player-frame" class="player-frame"><span>Your hands control the bench</span></span>
            </button>
            <button id="hand-enable">Turn on camera</button>
          </div>
          <div class="frame-presets" role="group" aria-label="Player framing"><button data-frame-width="80" aria-pressed="true">At a desk</button><button data-frame-width="36" aria-pressed="false">Classroom</button></div>
        </div>
        <div>
          <div class="hand-gestures">${gestureCards}</div>
          <details class="hand-tuning"><summary>Adjust grip sensitivity</summary><div class="hand-tuning-grid">
            <div class="hand-tuning-buttons"><button id="hand-mirror" aria-pressed="true">Mirror</button><button id="hand-switch" hidden>Switch camera</button></div>
            <label class="hand-range" for="hand-frame-width">Frame width <output id="hand-frame-value">80%</output><input id="hand-frame-width" type="range" min="20" max="95" value="80"></label>
            <label class="hand-range" for="hand-zoom">Zoom sensitivity <output id="hand-zoom-value">100%</output><input id="hand-zoom" type="range" min="25" max="200" value="100"></label>
            <label class="hand-range" for="hand-grasp">Close to grasp <output id="hand-grasp-value">65%</output><input id="hand-grasp" type="range" min="50" max="90" value="65"></label>
            <label class="hand-range" for="hand-release">Open to release <output id="hand-release-value">70%</output><input id="hand-release" type="range" min="55" max="95" value="70"></label>
            <label class="check-label"><input id="hand-pinch" type="checkbox"> Also allow thumb and index pinches</label>
            <p class="small">Grab the model to tilt it, or close and open on an atom to follow it. Choose Move atoms to arrange reactants before playback.</p>
          </div></details>
        </div>
      </div>
      <div class="hand-setup-footer"><p id="hand-setup-status" role="status">Camera access begins only when you turn it on.</p><button id="hand-close">Cancel</button><button id="hand-start" class="primary" disabled>Start building</button></div>
    </div>
  </dialog>

  <dialog id="atom-dialog" aria-labelledby="atom-dialog-title">
    <header class="dialog-heading"><div><h2 id="atom-dialog-title">Add atoms</h2><p>Choose an element, then connect your atoms.</p></div><button data-close="atom-dialog" autofocus>Done</button></header>
    <p class="small atom-intro">Highlighted elements belong to this reaction.</p>
    <div id="element-choices" class="element-choices"></div>
    <p id="atom-dialog-status" class="dialog-status" role="status">Choose an element to add one atom.</p>
  </dialog>

  <div id="fatal-error" class="fatal-error" role="alert" hidden><p id="viewer-error"></p><button id="retry-viewer">Retry 3D view</button></div>
`;
