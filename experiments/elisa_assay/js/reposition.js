/* =============================================================================
 * reposition.js  —  Moving a thing on the screen out of the way of the work.
 *
 * Two different things need this, for the same reason.
 *
 *   THE WORK SURFACES — the strips and the paper towels.  These are worked
 *   OVER rather than reached for, and where they sit vertically decides how
 *   high the hand has to be held to use them.  With a mouse that is a matter
 *   of taste.  Under the camera it is not: an arm held up near the top of the
 *   screen leaves the picture at the wrist, and the tracker loses the thumb —
 *   the one joint the whole gesture vocabulary is built on.
 *
 *   THE CAMERA PANEL — which has to be somewhere, and wherever that is it is
 *   on top of something.  Parked at the foot of the sidebar it covers the end
 *   of the procedure, which is the one panel a student reads while working.
 *
 * Neither is a layout problem with a right answer, because the answer depends
 * on the student's own arm and on which part of the page they are reading.
 * So both are simply movable, and both stay where they are put.
 *
 * The offset is a TRANSFORM, never a margin or a new left/top.  It must not
 * reflow anything: sliding the towels down has to open space above them, not
 * shove the strips off the bench — and every hit-test on this bench is
 * elementFromPoint against a live rect, so a transform is seen by the tools
 * exactly as a move is.
 *
 * Travel is clamped, to the bench for a work surface and to the window for the
 * panel.  js/tools.js keeps a tool's working point inside the bench, so a
 * surface dragged outside it would be a surface no pipette could reach again.
 *
 * Exposed as  Lab.reposition
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var STEP = 12;                 // one arrow-key nudge
  var STEP_BIG = 48;             // …with shift held
  var EDGE = 8;                  // never park anything hard against the edge

  var blocks = [];
  /* Where each named thing was put, kept apart from the element itself: the
     camera panel is destroyed when it is switched off and built again when it
     comes back, and it has to come back where the student left it. */
  var parked = {};

  /* ----- the two boxes things are kept inside ---------------------------- */
  function benchBox() {
    var b = document.getElementById('bench');
    if (!b || b.hidden) return null;
    var r = b.getBoundingClientRect();
    return r.height ? r : null;
  }
  function windowBox() {
    var w = document.documentElement.clientWidth, h = document.documentElement.clientHeight;
    if (!w || !h) return null;
    return { left: EDGE, top: EDGE, right: w - EDGE, bottom: h - EDGE };
  }

  /* Two offsets per thing, and they are not the same offset.  `want` is where
     the student put it and is never overwritten by the layout; `shown` is
     that, clamped to whatever room there is at the moment.  Keeping them
     apart is what lets something that had to be pulled in — when the camera
     came on, or the window was made small — go back out again afterwards. */
  function apply(blk) {
    if (!blk.el.isConnected) return;
    var want = blk.want;
    var x = blk.axis === 'y' ? 0 : want.x;
    var y = want.y;
    var box = blk.box();
    if (box) {
      /* The rect on screen carries the offset ALREADY APPLIED, so the resting
         edges come out by subtracting `shown` — not `want`, which is the
         value being tested and is a whole drag step away from the truth. */
      var r = blk.el.getBoundingClientRect();
      if (r.width && r.height) {
        x = Math.max(box.left - (r.left - blk.shown.x),
            Math.min(box.right - (r.right - blk.shown.x), x));
        y = Math.max(box.top - (r.top - blk.shown.y),
            Math.min(box.bottom - (r.bottom - blk.shown.y), y));
      }
    }
    blk.shown = { x: Math.round(x), y: Math.round(y) };
    blk.el.style.setProperty('--slide-x', blk.shown.x + 'px');
    blk.el.style.setProperty('--slide-y', blk.shown.y + 'px');
    blk.el.classList.toggle('is-slid', !!(blk.shown.x || Math.abs(blk.shown.y) > 1));
    if (blk.id) parked[blk.id] = { x: want.x, y: want.y };
  }

  /* A nudge is measured from where the thing actually IS, so dragging into an
     edge and back off it answers the hand straight away instead of unwinding
     however far the pointer ran on past it. */
  function nudge(blk, dx, dy) {
    blk.want = { x: blk.shown.x + dx, y: blk.shown.y + dy };
    apply(blk);
  }
  function home(blk) { blk.want = { x: 0, y: 0 }; apply(blk); }

  /* ----- make one thing movable ------------------------------------------
     opts.handle   what has to be dragged (a selector inside el)
     opts.ignore   what inside the handle is NOT a drag (buttons)
     opts.axis     'y' for a work surface, 'xy' for the panel
     opts.box      'bench' (the default) or 'window'
     opts.id       remembered under this name across a rebuild            */
  function attach(el, opts) {
    if (!el) return null;
    opts = opts || {};
    var handle = opts.handle || '.apparatus__cap';
    var bar = el.querySelector(handle);
    if (!bar) return null;

    var was = opts.id && parked[opts.id];
    var blk = {
      el: el, bar: bar, ignore: opts.ignore, id: opts.id || null,
      axis: opts.axis === 'xy' ? 'xy' : 'y',
      box: opts.box === 'window' ? windowBox : benchBox,
      want: { x: was ? was.x : 0, y: was ? was.y : 0 },
      shown: { x: 0, y: 0 }
    };
    blocks.push(blk);

    if (Lab.env.interact) {
      var cfg = {
        allowFrom: handle,
        startAxis: blk.axis, inertia: false, autoScroll: false,
        listeners: {
          start: function () {
            el.classList.add('is-moving');
            document.body.classList.add('repositioning');
          },
          move: function (ev) { nudge(blk, blk.axis === 'y' ? 0 : ev.dx, ev.dy); },
          end: function () {
            el.classList.remove('is-moving');
            document.body.classList.remove('repositioning');
          }
        }
      };
      if (blk.axis === 'y') cfg.lockAxis = 'y';
      if (opts.ignore) cfg.ignoreFrom = opts.ignore;
      interact(el).draggable(cfg);
    }

    /* Everything here that can be dragged can also be worked without
       dragging, and this is no exception: the grip is a real button, so the
       arrow keys move the thing and Home puts it back. */
    var grip = bar.querySelector('.grip');
    if (grip) {
      grip.addEventListener('keydown', function (e) {
        var big = e.shiftKey ? STEP_BIG : STEP;
        var side = blk.axis === 'xy';
        if (e.key === 'ArrowUp') { e.preventDefault(); nudge(blk, 0, -big); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(blk, 0, big); }
        else if (side && e.key === 'ArrowLeft') { e.preventDefault(); nudge(blk, -big, 0); }
        else if (side && e.key === 'ArrowRight') { e.preventDefault(); nudge(blk, big, 0); }
        else if (e.key === 'Home' || e.key === 'Escape') { e.preventDefault(); home(blk); }
      });
      grip.addEventListener('click', function (e) { e.preventDefault(); });
    }
    bar.addEventListener('dblclick', function (e) {
      if (opts.ignore && e.target.closest(opts.ignore)) return;
      home(blk);
    });

    apply(blk);
    return blk;
  }

  /* ----- the bench's own movable surfaces ---------------------------------
     Anything marked [data-movable] moves.  The markup says which surfaces
     those are, because that is a decision about the bench rather than one
     about this module. */
  function build() {
    blocks = blocks.filter(function (b) { return b.el.isConnected && b.id; });
    var found = document.querySelectorAll('.bench [data-movable]');
    for (var i = 0; i < found.length; i++) attach(found[i]);
  }

  /** Stop tracking something that has been taken off the page. */
  function release(el) {
    blocks = blocks.filter(function (b) { return b.el !== el; });
  }

  /* The equipment columns slide down the bench when the camera comes on, the
     bench changes height with the window, and the window itself is resized.
     Anything parked at an old edge has to be brought inside the new one — and
     let back out again when the room returns. */
  function reclamp() {
    blocks = blocks.filter(function (b) { return b.el.isConnected; });
    blocks.forEach(apply);
  }

  function resetAll() { blocks.forEach(home); }

  /** A camera pinch uses the same bounds and positioning as a mouse drag.
      Hit-test the visible header so a hidden or covered caption cannot move. */
  function beginAt(point) {
    var target = document.elementFromPoint(point.x, point.y);
    if (!target) return null;
    var blk = blocks.find(function (b) {
      return b.el.isConnected && b.bar.contains(target) &&
        !(b.ignore && target.closest(b.ignore));
    });
    if (!blk) return null;
    blk.el.classList.add('is-moving');
    document.body.classList.add('repositioning');
    return {
      moveBy: function (dx, dy) { nudge(blk, blk.axis === 'y' ? 0 : dx, dy); },
      end: function () {
        blk.el.classList.remove('is-moving');
        document.body.classList.remove('repositioning');
      }
    };
  }

  window.addEventListener('resize', function () { reclamp(); });

  Lab.reposition = {
    build: build,
    attach: attach,
    release: release,
    reclamp: reclamp,
    resetAll: resetAll,
    beginAt: beginAt
  };
})(window.Lab = window.Lab || {});
