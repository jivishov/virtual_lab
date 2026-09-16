/* =============================================================================
 * tools.js  —  Shared behaviour for every hand tool on the bench.
 *
 * Three different instruments get picked up in this protocol: the adjustable
 * micropipette, the plastic transfer pipet for wash buffer, and the fine-tipped
 * marker for labelling the strips.  They are different objects doing different
 * jobs, but they are picked up, carried and set down identically — so the drag
 * behaviour, the "which tool is in my hand" bookkeeping, the fly-to for the
 * click path, and the falling droplet all live here exactly once.
 *
 * Every tool reports its own WORKING POINT (the tip of the pipette, the nib of
 * the marker), because that — not the centre of the sprite — is what has to be
 * over a well for the action to land.
 *
 * Exposed as  Lab.tools
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var svgNS = 'http://www.w3.org/2000/svg';
  var layer = null;
  var current = null;          // id of the tool currently being dragged
  var currentOwner = null;     // camera and mouse cannot move the same tool
  var registry = {};           // id -> { el, tip }

  /* The protocol draws wash buffer from an open vessel with a disposable
     transfer pipet.  Keep the legacy washBottle() API and .wash-bottle class
     because stations.js/main.js use them as stable hooks, but render the
     physical source as a labelled 100 mL beaker instead of a squeeze bottle. */
  function installWashBufferBeaker() {
    if (!Lab.assets || typeof Lab.assets.washBottle !== 'function') return;
    Lab.assets.washBottle = function () {
      var cfg = Lab.config;
      var paint = (Lab.theme && Lab.theme.sci) ? Lab.theme.sci('WASH', 'fill') : cfg.REAGENTS.WASH.fill;
      var dark = (Lab.theme && Lab.theme.sci) ? Lab.theme.sci('WASH', 'dark') : cfg.REAGENTS.WASH.dark;
      return '' +
      '<svg class="station wash-bottle wash-beaker" data-station="wash" data-reagent="WASH" ' +
          'style="--tube-paint:' + paint + ';--tube-cap:' + dark + '" viewBox="0 0 110 168" ' +
          'role="button" tabindex="0" aria-label="100 mL beaker containing wash buffer" ' +
          'xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="wash-glass" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0" stop-color="#dfeaf0" stop-opacity=".72"/>' +
            '<stop offset=".24" stop-color="#ffffff" stop-opacity=".22"/>' +
            '<stop offset=".72" stop-color="#ffffff" stop-opacity=".08"/>' +
            '<stop offset="1" stop-color="#c9d8e0" stop-opacity=".62"/>' +
          '</linearGradient>' +
          '<linearGradient id="wash-liquid" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="var(--tube-paint)" stop-opacity=".72"/>' +
            '<stop offset="1" stop-color="var(--tube-paint)" stop-opacity=".92"/>' +
          '</linearGradient>' +
          '<clipPath id="wash-beaker-clip">' +
            '<path d="M24 34 L86 34 L82 143 Q81 150 73 151 L37 151 Q29 150 28 143 Z"/>' +
          '</clipPath>' +
        '</defs>' +
        '<rect x="11" y="19" width="88" height="137" rx="4" fill="#fff" fill-opacity=".001"/>' +
        '<path d="M23 35 L87 35 L83 143 Q82 151 73 152 L37 152 Q28 151 27 143 Z" ' +
          'fill="url(#wash-glass)" class="m-line" stroke-width="1.4"/>' +
        '<g clip-path="url(#wash-beaker-clip)">' +
          '<rect x="27" y="74" width="56" height="78" fill="url(#wash-liquid)"/>' +
          '<ellipse cx="55" cy="74" rx="28" ry="4.5" fill="var(--tube-paint)" fill-opacity=".86"/>' +
          '<ellipse cx="55" cy="77" rx="23" ry="2.4" fill="#fff" fill-opacity=".16"/>' +
        '</g>' +
        '<path d="M21 34 Q55 27 89 34" fill="none" class="m-line" stroke-width="2"/>' +
        '<path d="M24 36 Q55 42 86 36" fill="none" class="m-line" stroke-width=".8" opacity=".55"/>' +
        '<path d="M86 35 L95 31 L87 43" fill="url(#wash-glass)" class="m-line" stroke-width="1"/>' +
        '<g class="m-line" stroke-width=".75" opacity=".72">' +
          '<line x1="69" y1="126" x2="82" y2="126"/>' +
          '<line x1="73" y1="108" x2="82" y2="108"/>' +
          '<line x1="69" y1="90" x2="82" y2="90"/>' +
          '<line x1="73" y1="72" x2="82" y2="72"/>' +
          '<line x1="69" y1="54" x2="82" y2="54"/>' +
        '</g>' +
        '<g class="station-caption" font-size="6.6" text-anchor="end">' +
          '<text x="67" y="128">20</text><text x="71" y="110">40</text>' +
          '<text x="67" y="92">60</text><text x="71" y="74">80</text>' +
          '<text x="67" y="56">100</text>' +
        '</g>' +
        '<text x="40" y="49" class="station-caption" font-size="6.2" font-weight="700">100 mL</text>' +
        '<rect x="31" y="116" width="32" height="22" rx="2.5" fill="#fff" fill-opacity=".82" ' +
          'stroke="var(--tube-cap)" stroke-width=".7"/>' +
        '<text x="47" y="124" text-anchor="middle" class="station-caption" font-size="5.9" font-weight="700">WASH</text>' +
        '<text x="47" y="132" text-anchor="middle" class="station-caption" font-size="5.3">BUFFER</text>' +
      '</svg>';
    };
  }
  installWashBufferBeaker();

  function setLayer(el) { layer = el; }
  function active() { return current; }
  function elementOf(id) { return registry[id] && registry[id].el; }
  function tipOf(id) { return registry[id] && registry[id].tip; }

  function posOf(el) {
    if (!el.__pos) el.__pos = { x: 0, y: 0 };
    return el.__pos;
  }
  function place(el, x, y) {
    var p = posOf(el);
    p.x = x; p.y = y;
    /* Position with the individual CSS translate property instead of the
       transform shorthand.  The transfer-pipet squeeze animation uses GSAP
       scaleX on `transform`; when both position and squeeze owned the same
       property, the animation could overwrite the drag translation and make
       the pipet jump away from the pointer.  Independent translate + transform
       properties compose, so dragging now remains 1:1 while the bulb squeezes. */
    el.style.translate = x + 'px ' + y + 'px';
  }

  /** Put a tool's working point exactly on a screen point, with no animation. */
  function parkAt(el, tipFn, point) {
    var p = posOf(el), t = tipFn();
    place(el, p.x + (point.x - t.x), p.y + (point.y - t.y));
  }

  /* Keep a tool's WORKING POINT on the bench — and only the working point.  A
     pipette is 180px tall and hangs upward from its tip, so constraining the
     whole sprite would stop the tip ever reaching the top row of wells.

     This was an interact restrictRect whose elementRect guessed the tip at
     "85–100% of the sprite".  The pipette's tip is actually at about 72% of
     its height, so the guessed band sat BELOW the real tip: parking the
     pipette low on the bench left it outside its own restriction, and the
     first drag snapped it 44px upward and then pinned its Y entirely — the
     tool bolting away from the hand.  The point is measured here instead of
     guessed at, which also makes it correct for the marker and the transfer
     pipet, whose nibs sit at different fractions again. */
  function clampTip(el, tipFn) {
    if (!layer) return;
    var b = layer.getBoundingClientRect();
    if (!b.width || !b.height) return;
    var t = tipFn(), dx = 0, dy = 0;
    if (t.x < b.left) dx = b.left - t.x;
    else if (t.x > b.right) dx = b.right - t.x;
    if (t.y < b.top) dy = b.top - t.y;
    else if (t.y > b.bottom) dy = b.bottom - t.y;
    if (dx || dy) { var p = posOf(el); place(el, p.x + dx, p.y + dy); }
  }

  /* ----- picking a tool up, moving it, setting it down -------------------
     The mouse is not the only hand on this bench: js/handcontrol.js puts the
     student's real hand on it through the camera.  Both drive these same
     three calls, so "which tool am I holding", the grabbing cursor and the
     body classes have exactly one implementation and cannot disagree — a tool
     picked up by the camera reports itself through active() like any other,
     and the two hands therefore cannot hold the same tool at once. */
  function grab(id, owner) {
    var r = registry[id];
    if (!r || r.el.classList.contains('tool-stowed')) return false;
    if (current) drop(current);
    current = id;
    currentOwner = owner || 'mouse';
    if (Lab.env.gsap) gsap.killTweensOf(posOf(r.el));
    r.el.classList.add('grabbing');
    document.body.classList.add('tool-active', 'tool-' + id);
    return true;
  }
  function moveBy(id, dx, dy) {
    var r = registry[id];
    if (!r) return;
    var p = posOf(r.el);
    place(r.el, p.x + dx, p.y + dy);
    clampTip(r.el, r.tip);
  }
  function drop(id) {
    var r = registry[id];
    if (!r) return;
    r.el.classList.remove('grabbing');
    document.body.classList.remove('tool-active', 'tool-' + id);
    if (current === id) { current = null; currentOwner = null; }
  }

  /* ----- drag ------------------------------------------------------------
     interact.js moves the element; every move reports the tool's working
     point to the engine, which is what makes hover-to-act work. */
  function drag(el, id, tipFn) {
    registry[id] = { el: el, tip: tipFn };
    if (!Lab.env.interact) { console.warn('interact.js missing — drag disabled'); return; }
    interact(el).draggable({
      inertia: false,
      autoScroll: false,
      listeners: {
        start: function () { grab(id); },
        move: function (event) {
          moveBy(id, event.dx, event.dy);
          Lab.engine.hoverAt(tipFn(), id);
        },
        end: function () {
          drop(id);
          Lab.engine.releaseAt(tipFn(), id);
          Lab.engine.clearHighlight();
        }
      }
    });
  }

  /* ----- fly-to (the click / keyboard path) ------------------------------ */
  function flyTo(el, pos, tipFn, point, cb) {
    var t = tipFn();
    var nx = pos.x + (point.x - t.x);
    var ny = pos.y + (point.y - t.y);
    if (!Lab.env.gsap || (Lab.theme && Lab.theme.reducedMotion)) {
      place(el, nx, ny); pos.x = nx; pos.y = ny; if (cb) cb(); return;
    }
    gsap.to(pos, {
      x: nx, y: ny, duration: 0.42, ease: 'power2.inOut',
      onUpdate: function () { el.style.translate = pos.x + 'px ' + pos.y + 'px'; },
      onComplete: function () { el.__pos = pos; if (cb) cb(); }
    });
  }

  /* ----- a droplet falling from a tool onto a target --------------------- */
  function droplet(from, targetEl, color) {
    if (!layer) return;
    var to = centerOf(targetEl);
    var host = layer.getBoundingClientRect();
    /* NOT named `drop` — that is now the module function that sets a tool
       down, and a local shadowing it inside here is a trap waiting to be
       stepped in. */
    var bead = document.createElementNS(svgNS, 'svg');
    bead.setAttribute('class', 'droplet');
    bead.setAttribute('width', '16'); bead.setAttribute('height', '20');
    bead.innerHTML =
      '<path d="M8 1 C8 1 15 11 15 15 A7 7 0 1 1 1 15 C1 11 8 1 8 1 Z" fill="' + color +
        '" class="m-line" stroke-width="0.5"/>' +
      '<ellipse class="m-sheen" cx="5.5" cy="12" rx="2" ry="3.2" opacity=".4"/>';
    bead.style.position = 'absolute';
    bead.style.left = (from.x - host.left - 8) + 'px';
    bead.style.top = (from.y - host.top - 4) + 'px';
    bead.style.pointerEvents = 'none';
    layer.appendChild(bead);
    if (!Lab.env.gsap || (Lab.theme && Lab.theme.reducedMotion)) { layer.removeChild(bead); return; }
    gsap.timeline({ onComplete: function () { if (layer.contains(bead)) layer.removeChild(bead); } })
      .to(bead, { duration: 0.3, top: (to.y - host.top - 6) + 'px',
                  left: (to.x - host.left - 8) + 'px', ease: 'power2.in' })
      .to(bead, { duration: 0.16, scaleX: 1.7, scaleY: 0.35, opacity: 0,
                  transformOrigin: '50% 100%', ease: 'power1.out' });
  }

  function centerOf(node) {
    var r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /** Show or hide a tool.  A tool that is not needed at this step is not on
      the bench — that is a real affordance, not decoration. */
  function show(id, on) {
    var el = elementOf(id);
    if (!el) return;
    el.classList.toggle('tool-stowed', !on);
  }

  Lab.tools = {
    setLayer: setLayer,
    drag: drag,
    grab: grab,
    moveBy: moveBy,
    drop: drop,
    tipOf: tipOf,
    flyTo: flyTo,
    droplet: droplet,
    parkAt: parkAt,
    place: place,
    posOf: posOf,
    centerOf: centerOf,
    active: active,
    owner: function () { return currentOwner; },
    elementOf: elementOf,
    show: show
  };
})(window.Lab = window.Lab || {});
