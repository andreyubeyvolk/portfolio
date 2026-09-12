// ── Spray-can graffiti (desktop only). Hold Ctrl: cursor swaps to a
// black spray-can icon. Hold Ctrl + drag with the left mouse button:
// paints a spray-style stroke. Release Ctrl: painting stops, but the
// tag itself stays put—nothing fades or clears on its own. To wipe it,
// press Backspace, Delete, or Space (while not typing in the settings
// panel), or just reload/leave the page.
//
// Shared across every Brands page (originally a nimax-only prototype;
// see graffiti.css for the matching styles and logo-scrub.js for the
// separate logo hover-scrub feature it ships alongside). Targets
// whichever page's own `.content-pane`/`.content-pane__scroll` it finds
// itself on—works the same whether that's a project page's photo
// gallery or the Brands listing's card grid, since neither the pane nor
// the card boundaries this reads are project-specific.
//
// Rendering: no WebGL—this is plain Canvas 2D. Paint that lands
// outside .content-pane (the sidebar/page background) goes on a
// fixed full-viewport canvas, since that area never scrolls.
// Paint that lands ON the pane's scroll body is stored in
// content-relative coordinates on an off-screen canvas (never inserted
// into the page) sized to the gallery's full scrollable height; a small
// on-screen canvas, sized to just the visible scroll window and fixed
// in place over it, shows only the currently-visible slice, re-copied
// on every paint and every scroll (see blitPane). Measured directly:
// the exact same drawing work costs roughly 7x more per frame on
// an on-screen canvas the gallery's full height than on a
// viewport-sized one, purely from the browser having to
// recomposite that much backing store—independent of how little
// of it actually changed. Keeping the tall canvas off-screen
// and only ever showing a viewport-sized crop is what makes
// painting on the pane cost the same as painting on the sidebar.
// Drips that fall on the pane store their content-relative (x, y)
// from the moment they're triggered rather than re-deriving it
// from screen coordinates each frame: doing the latter through
// whatever the current scroll happens to be produced a visible
// "jump" the next time Ctrl was held after scrolling in between.
// The pane's own left/top/right edges (and its header bar, which
// sits above this whole layer and must never get painted over)
// are enforced the same way regardless of which canvas a given
// dot ends up on—see stampDot and updateDrips.
//
// Each "stamp" is a scatter of small dots (two populations: a
// wide sparse outer scatter for the textured edge, plus a tight
// near-opaque core for the bulk of the line)—overlapping dots
// from slow/repeated passes naturally darken via ordinary alpha
// compositing. The scatter is biased toward a fixed cap-tilt
// angle to fake a fat cap held at a consistent lean, widens on
// sharp turns or when the cursor slows down (dwelling pools more
// paint), and its overall radius wobbles a few percent along the
// stroke (a slow random walk, not per-dot noise) so the line
// doesn't read as a perfectly uniform tube.
//
// Self-crossing ("paint over paint gets thicker"): a coarse grid
// tracks how many times a stamp has landed near each cell,
// without ever reading pixels back off the canvas. A cell
// revisited a few times stamps denser; a cell that's really
// piled up triggers a one-shot drip that crawls slowly down the
// page over many frames, wobbling as it falls and widening into
// a rounded, pear-like tip—independent of whatever else is being
// drawn elsewhere in the meantime.
//
// Content-pane surface: paint on it is slightly less opaque, and
// near its left edge paint itself lifts up a few px there (a
// smoothed zone, not a hard cut). Baked directly into each dot's
// own fill color as it's drawn, paint within a band right of the
// edge also lightens from gray toward black the further right it
// lands—reading as the paint itself catching a sheen off the
// surface, not a separate overlay.
//
// The cursor only ever tilts (7deg, while the button's down—
// never a full rotation) and otherwise stays upright, cap fixed
// left, matching the reference icon. Its own position-tracking
// uses an adaptive smoothing factor: tiny movements (hand tremor)
// barely nudge it, real strokes get a snappier factor—filters
// micro-jitter without reintroducing a laggy feel.
//
// Every tunable number lives in CFG below and is exposed live in
// the bottom-right settings panel for dialing in by eye; its
// "Copy JSON" button hands back the finished values to bake in
// as new defaults.
//
// Swap in a real exported brush stamp later by replacing the
// `stampDot` scatter loop with drawImage() calls onto a loaded
// PNG—the path/smoothing/opacity/edge logic underneath doesn't
// need to change.
(function () {
  var desktopQuery = window.matchMedia('(min-width: 981px)');
  if (!desktopQuery.matches) return;

  // Values below are andrey's own tuned pass from the settings
  // panel (2026-09-12)—dialed in by eye, not derived from
  // anything, so don't "fix" any that look unusual (e.g.
  // surfaceAlpha/dotAlphaOuterRange above 1 just clamp to fully
  // opaque; that's fine, it's how they were tuned).
  var CFG = {
    lerpSlow: 0.15,
    lerpFast: 0.6,
    lerpSpeedRef: 8,
    capTilt: 0.8,

    outerCountBase: 70,
    outerCountSpread: 10,
    outerCountMult: 5,
    outerRadiusBase: 10,
    outerRadiusSpread: 30,
    outerRadiusMult: 3,
    coreCountBase: 40,
    coreCountSpread: 10,
    coreRadiusFrac: 1,
    dotAlphaOuterMin: 0.65,
    dotAlphaOuterRange: 1,
    dotAlphaCoreMin: 0.85,
    dotAlphaCoreRange: 0.15,
    widthWobbleRange: 10,

    cellSize: 90,
    crossAt: 9,
    crossBoost: 2,
    dripAt: 2,
    dripFallMin: 0.3,
    dripFallRange: 0.15,
    dripWobbleAccel: 0.1,
    dripWobbleDamp: 0.9,
    dripMaxDistMin: 90,
    dripMaxDistRange: 200,

    surfaceAlpha: 3,
    edgeLiftMax: 7,
    edgeZone: 10,
    sheenWidth: 200,
    sheenLightness: 30
  };
  // Snapshot for the panel's per-field reset icon—CFG itself gets
  // edited live, so the original numbers need to live somewhere
  // else to reset back to.
  var DEFAULTS = Object.assign({}, CFG);

  // Fixed, viewport-sized: paint that lands outside .content-pane
  // (the sidebar/page background), which never scrolls.
  var canvas = document.createElement('canvas');
  canvas.id = 'graffiti-canvas';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  // The paintable "surface" is the scroll body only—NOT the
  // header bar above it (project title + close button, on project
  // pages), which sits on top as its own opaque strip and should
  // never get painted over. paneRect drives every on-surface effect
  // below; cardRect (the whole section, header included) keeps the
  // fixed layer's paint off the header (see stampDot/updateDrips).
  // Resolved here, before resize() and the canvases it sizes, so
  // the very first resize() call has a fresh rect to work from
  // rather than a not-yet-assigned one.
  var pane = document.querySelector('.content-pane__scroll');
  // The pane's single direct child is whatever this particular page
  // scrolls—a project page's photo gallery (`.project-content`) or
  // the Brands listing's card grid (`.inhouse-grid`). Either way it's
  // the thing whose own top/left/width/height anchor every
  // content-relative coordinate below, so there's no need to name its
  // class specifically.
  var article = pane ? pane.firstElementChild : null;
  var paneRect = null;
  // The custom scrollbar track (see scroll.js/styles.css) sits in
  // this many px reserved along the pane's own right edge—paint
  // should stop before it, not visually run underneath/through
  // it. Measured off the track element itself (scroll.js creates
  // it synchronously, earlier in the page, so it already exists
  // here) rather than parsing --scrollbar-gutter directly: that
  // var is a calc() expression, and getComputedStyle returns
  // custom properties as their literal authored text, not the
  // resolved px value—parseFloat on "calc(...)" is just NaN.
  var scrollbarGutter = (function () {
    var track = document.querySelector('.custom-scrollbar');
    var measured = track ? parseFloat(getComputedStyle(track).width) : NaN;
    return isNaN(measured) ? 16 : measured;
  })();
  // Undefined until the first updatePaneRect() call below. A
  // couple of px more conservative than the gutter's own measured
  // width, on purpose: paneRect's own edges come back as
  // fractional CSS px (e.g. 906.671875), and a dot landing right
  // at that boundary can round to a device pixel or two past it
  // once scaled by dpr—visible as a sliver of paint creeping into
  // the scrollbar's own space instead of stopping cleanly short.
  var paneRightEdge = null;
  function updatePaneRect() {
    paneRect = pane ? pane.getBoundingClientRect() : null;
    paneRightEdge = paneRect ? paneRect.right - scrollbarGutter - 2 : null;
  }
  // How far below the section's own bottom edge a stamp's outer
  // scatter can realistically still land (the widest outer radius
  // the tuned CFG below produces)—used only to widen where the
  // fixed canvas refuses to paint near the section's bottom-right
  // corner (see stampDot), not to change anything about the pane
  // itself.
  var CARD_BOTTOM_MARGIN = 150;

  var card = document.querySelector('.content-pane');
  var cardRect = null;
  function updateCardRect() { cardRect = card ? card.getBoundingClientRect() : null; }

  // Real storage for pane paint: off-screen (never inserted into
  // the page), sized to the gallery's full scrollable height.
  // Every pane-side stamp/drip draw below still targets this in
  // content-relative coordinates, exactly as if it were on
  // screen—nothing about that logic changes. Keeping it
  // off-screen is what makes its height free: a canvas this tall
  // (thousands of px) is expensive to composite every frame ONLY
  // if it's actually on screen; measured directly, the same draw
  // work costs ~7x more per frame on an on-screen canvas this
  // size than a viewport-sized one, independent of how little of
  // it is actually painted. Read from, never shown.
  var paneCanvas = document.createElement('canvas');
  var pctx = paneCanvas.getContext('2d');

  // What's actually on screen for the pane: a small canvas, sized
  // to the visible scroll window (not the gallery), fixed in
  // place over it. blitPane() below copies just the currently
  // visible slice of the off-screen store into this—every frame
  // while painting, and on every scroll—so showing pane paint
  // costs the same as the sidebar's viewport-sized canvas,
  // regardless of how tall the gallery is.
  var paneView = document.createElement('canvas');
  paneView.id = 'graffiti-pane-view';
  document.body.appendChild(paneView);
  var pvctx = paneView.getContext('2d');

  var articleRect = null;
  function updateArticleRect() { articleRect = article ? article.getBoundingClientRect() : null; }

  var cursor = document.createElement('div');
  cursor.className = 'graffiti-cursor';
  // Supplied can icon: fixed upright, cap/nozzle permanently facing
  // left (the flare path pointing toward x=0)—it never rotates to
  // face the direction of travel, unlike a real spray-paint jitter
  // cursor might; this one just tracks position.
  cursor.innerHTML =
    '<div class="graffiti-cursor__tilt">' +
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="32" y="22" width="36" height="76" fill="#171717"/>' +
        '<rect x="44" y="2" width="12" height="15" fill="#171717"/>' +
        '<path d="M44 4L0 0V22L44 8L44 4Z" fill="#171717"/>' +
        '<path d="M35 21C35 16.0294 39.0294 12 44 12H56C60.9706 12 65 16.0294 65 21V24H35V21Z" fill="#171717"/>' +
      '</svg>' +
    '</div>';
  document.body.appendChild(cursor);
  var cursorTilt = cursor.querySelector('.graffiti-cursor__tilt');
  // Nozzle/flare tip, in the icon's rendered (46x46, see CSS) size—
  // the point that should sit exactly under the real cursor
  // position. The source viewBox is 100x100 with the flare tip at
  // roughly (1, 10); scaled by the 0.46 display ratio.
  var HOTSPOT_X = 0.5, HOTSPOT_Y = 4.6;

  // Capped rather than the raw devicePixelRatio: these canvases
  // get repainted with dozens–hundreds of arc()+fill() calls per
  // frame while drawing, and that cost scales with backing-store
  // pixel count. 2x/3x retina buffers roughly double/quadruple it
  // for a softness difference that's hard to see in a loose,
  // textured spray effect anyway.
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  // The min-width:981px check at the top of this script only ever
  // runs once, at load—if the page loaded wide enough for the
  // feature to initialize and the window is later narrowed below
  // that (not just an actual mobile visit, but dragging a desktop
  // browser window down, or rotating a tablet), everything below
  // stayed fully live and kept sizing/blitting itself against a
  // pane rect that no longer matches the phone/tablet layout the
  // CSS has switched to underneath it—among other things, that's
  // what was breaking scrolling there. Checked live on every
  // resize instead: below the breakpoint, every overlay hides and
  // Ctrl-mode is force-released; above it, everything comes back.
  function resize() {
    if (!desktopQuery.matches) {
      canvas.style.display = 'none';
      paneView.style.display = 'none';
      setCtrlMode(false);
      return;
    }
    canvas.style.display = '';
    paneView.style.display = '';
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    updatePaneRect();
    updateCardRect();

    if (article) {
      var w = article.offsetWidth, h = article.offsetHeight;
      paneCanvas.width = Math.round(w * dpr);
      paneCanvas.height = Math.round(h * dpr);
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Same dpr transform as the off-screen store—stampDot and
    // friends draw straight onto this too (see stampDot), in the
    // same CSS-space coordinates it uses for pctx, and without
    // this it'd land at 1/dpr scale, squashed toward the top-left
    // corner. blitPane()'s drawImage() needs the opposite (raw
    // device pixels, no transform) since it's copying the whole
    // buffer 1:1—it switches to identity and back around that one
    // call instead.
    if (paneRect) {
      paneView.width = Math.round(paneRect.width * dpr);
      paneView.height = Math.round(paneRect.height * dpr);
      paneView.style.width = paneRect.width + 'px';
      paneView.style.height = paneRect.height + 'px';
      paneView.style.left = paneRect.left + 'px';
      paneView.style.top = paneRect.top + 'px';
      pvctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    updateArticleRect();
    // Reassigning a canvas's width/height always wipes its pixels,
    // even to the same value—true here on every real window
    // resize, and also whenever browser zoom changes (Chrome fires
    // `resize` and reports a different devicePixelRatio, so this
    // whole function reruns). The drip/density bookkeeping below
    // lives independently of those pixels, though, and a drip
    // that's still mid-fall would otherwise keep animating onto
    // the now-blank canvas—paint reappearing with no stroke behind
    // it, out of nowhere. Wipe the logical state to match.
    resetDripState();
    blitPane();
  }
  window.addEventListener('resize', resize);
  resize();
  // The article's own height changes as lazy images load in—keep
  // the pane canvas's drawing buffer matched to it, or paint near
  // the bottom of a long gallery would just get cropped off.
  if (article && 'ResizeObserver' in window) {
    new ResizeObserver(resize).observe(article);
  }

  // Copies just the visible slice of the off-screen pane store
  // into the small on-screen view canvas—the step that actually
  // makes the gallery's full-height paint storage above free to
  // display. Source rect and destination canvas are both worked
  // out in raw device pixels (paneCanvas/paneView's own
  // .width/.height), so this needs the identity transform—the
  // persistent dpr one on pvctx is for stampDot's direct draws
  // (see resize) and would double-scale this 1:1 copy.
  function blitPane() {
    if (!paneRect || !articleRect) return;
    var sy = Math.round((paneRect.top - articleRect.top) * dpr);
    var sw = paneView.width, sh = paneView.height;
    if (sw <= 0 || sh <= 0) return;
    pvctx.save();
    pvctx.setTransform(1, 0, 0, 1, 0, 0);
    pvctx.clearRect(0, 0, sw, sh);
    pvctx.drawImage(paneCanvas, 0, sy, sw, sh, 0, 0, sw, sh);
    pvctx.restore();
  }
  // Scrolling changes which slice is "visible" regardless of
  // whether Ctrl is held or anything is being drawn right now, so
  // this runs unconditionally (tick() below only runs while
  // ctrlHeld)—and deliberately as a scrollTop poll on its own
  // requestAnimationFrame loop, not a 'scroll' event listener.
  // Lenis (see scroll.js) drives scrollTop from its own rAF loop,
  // and browsers are free to dispatch the 'scroll' event on a
  // LATER frame than the one the compositor actually moved the
  // content in—so even a perfectly synchronous scroll handler can
  // end up a frame behind, reading as a parallax drift while
  // scrolling. Polling scrollTop directly every frame instead
  // sidesteps that: since scroll.js registers Lenis's own rAF
  // callback earlier in the page than this one, this callback
  // runs after Lenis has already moved scrollTop for the frame,
  // so it always reads the current value, not last frame's.
  var lastScrollTop = pane ? pane.scrollTop : 0;
  function scrollWatchTick() {
    requestAnimationFrame(scrollWatchTick);
    if (!desktopQuery.matches || !pane) return;
    if (pane.scrollTop !== lastScrollTop) {
      lastScrollTop = pane.scrollTop;
      updateArticleRect();
      blitPane();
    }
  }
  scrollWatchTick();

  // A ridge right at the pane's left edge: paint nudges up there,
  // smoothed over a zone so it reads as a seam, not a glitch.
  // Only ever called for points already confirmed inside the
  // pane's vertical range, so no top/bottom check needed here.
  function edgeLift(x) {
    if (!paneRect) return 0;
    var d = x - paneRect.left;
    if (Math.abs(d) > CFG.edgeZone) return 0;
    return -CFG.edgeLiftMax * (1 - Math.abs(d) / CFG.edgeZone);
  }

  // Lightens paint within a band right of the pane's left edge,
  // fading to pure black by sheenWidth—baked into each dot's own
  // fill color at draw time (not a separate overlay pass), so it
  // can only ever show up on paint that's actually been stamped
  // there, and never accumulates pass after pass.
  function surfaceTone(x) {
    if (!paneRect) return 0;
    var d = x - paneRect.left;
    if (d < 0 || d > CFG.sheenWidth) return 0;
    return Math.round((1 - d / CFG.sheenWidth) * CFG.sheenLightness);
  }

  var ctrlHeld = false;
  var isDrawing = false;
  var raw = { x: -999, y: -999 };
  var smooth = { x: -999, y: -999 };
  var lastStamp = null;
  var lastAngle = 0;
  var rafId = null;
  var widthWobble = 1;
  // Adaptive quality: on a CPU too slow to keep up with the full
  // dot counts below, each stamp would otherwise take even longer
  // to render than the last, snowballing into a stall. Tracking
  // actual frame time and scaling dot counts down when frames run
  // long (recovering slowly when they don't) keeps drawing
  // responsive on weak hardware without touching how dense a fast
  // machine renders it. Reset to 1 each time Ctrl is pressed (see
  // setCtrlMode)—time elapsed while not drawing shouldn't count
  // against it.
  var qualityScale = 1;
  var lastFrameTime = 0;

  // Self-crossing detection: rather than reading pixels back off
  // the canvas (slow, and the exact reason browsers warn about
  // getImageData in a hot loop), a coarse grid of "how many times
  // has a stamp landed near here" counters approximates the same
  // thing—cheap array lookups instead of pixel readback. Crossing
  // a cell that's already seen a few passes stamps denser there
  // ("paint over paint"); a cell that's built up a real pile
  // eventually kicks off a drip. Persists across separate Ctrl
  // sessions—only the manual clear-all resets it—since the tag
  // itself now persists the same way.
  var density = {};
  var dripped = {};
  var drips = [];
  // A long, heavily-crossed session could otherwise trigger drips
  // faster than they finish falling, growing the per-frame update
  // cost without bound. Once this many are live, new trigger
  // points still register as "dripped" (no retry pile-up) but
  // just don't spawn another—existing ones keep falling normally.
  var MAX_DRIPS = 60;
  // Shared by the explicit clear-all below and by resize() (a
  // browser-zoom or window-resize event wipes the canvas pixels
  // either way—see resize()—so this keeps the bookkeeping in sync
  // with that rather than leaving orphaned drips animating onto a
  // blank canvas).
  function resetDripState() {
    density = {};
    dripped = {};
    drips = [];
    widthWobble = 1;
  }
  function cellKey(x, y) { return (x / CFG.cellSize | 0) + '_' + (y / CFG.cellSize | 0); }
  function registerDensity(x, y) {
    var key = cellKey(x, y);
    var d = (density[key] || 0) + 1;
    density[key] = d;
    if (d >= CFG.dripAt && !dripped[key] && drips.length < MAX_DRIPS) {
      dripped[key] = true;
      // Bake the drip's rendering space and any content-surface
      // treatment in once, at creation, from the (x, y) it was
      // triggered at—not re-derived every frame from wherever the
      // article happens to be on screen right now. A drip that
      // falls on the pane is otherwise stored using screen
      // coordinates that go stale the instant the user scrolls
      // while Ctrl is released (tick(), and with it
      // updateArticleRect(), pauses then): the next time Ctrl is
      // held it would suddenly resume from a reprojected position
      // that no longer matches where it actually is, reading as a
      // drip that "jumps" out of nowhere. Content-relative
      // coordinates don't have anywhere to go stale—the canvas
      // they're drawn on scrolls for free.
      // Horizontal-only membership, same as stampDot—a drip
      // triggered above the header or below the current bottom
      // fold is still logically on the pane (see stampDot for
      // why), just not necessarily visible the moment it starts.
      var inPane = paneRect && x >= paneRect.left && x <= paneRightEdge;
      var drip = { vel: 0, dist: 0, maxDist: CFG.dripMaxDistMin + Math.random() * CFG.dripMaxDistRange };
      if (inPane) {
        drip.space = 'pane';
        drip.x = x - (articleRect ? articleRect.left : paneRect.left);
        drip.y = y - (articleRect ? articleRect.top : paneRect.top) + edgeLift(x);
        drip.tone = surfaceTone(x);
        drip.alphaMul = CFG.surfaceAlpha;
      } else {
        drip.space = 'fixed';
        drip.x = x;
        drip.y = y;
        drip.tone = 0;
        drip.alphaMul = 1;
      }
      drips.push(drip);
    }
  }

  // The only way any of this goes away now: reload/navigate, or
  // this explicit wipe (bound to Backspace/Delete/Space below).
  // Eased out with a quick opacity fade (a compositor-only CSS
  // transition—no extra rendering work) instead of a hard cut,
  // then the pixels are actually cleared once invisible and the
  // canvases fade back in already blank. Guarded against a second
  // press mid-fade re-triggering the same cycle on top of itself.
  var clearing = false;
  function clearAll() {
    if (clearing) return;
    clearing = true;
    // Fade the on-screen canvases—paneCanvas is the off-screen
    // store now and was never visible to begin with, so fading
    // that would do nothing.
    var fading = [canvas, paneView];
    fading.forEach(function (c) { c.style.opacity = '0'; });
    setTimeout(function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pctx.clearRect(0, 0, paneCanvas.width, paneCanvas.height);
      resetDripState();
      blitPane();
      fading.forEach(function (c) { c.style.opacity = '1'; });
      clearing = false;
    }, 260);
  }

  function setCtrlMode(on) {
    if (ctrlHeld === on) return;
    ctrlHeld = on;
    document.body.classList.toggle('graffiti-mode', on);
    cursor.classList.toggle('is-active', on);
    if (on) {
      updatePaneRect();
      updateCardRect();
      updateArticleRect();
      // Guards against the rare case where the section shifted
      // position while Ctrl was released without a full resize
      // (e.g. something above it in the page changed height)—
      // cheap enough to just always re-sync rather than detect.
      if (paneRect) {
        paneView.style.left = paneRect.left + 'px';
        paneView.style.top = paneRect.top + 'px';
      }
      blitPane();
      qualityScale = 1;
      lastFrameTime = performance.now();
    } else {
      isDrawing = false;
      lastStamp = null;
    }
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Control') { if (desktopQuery.matches) setCtrlMode(true); return; }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === ' ') {
      // The settings panel has its own inputs/textarea where these
      // keys need to keep doing their normal editing job.
      var tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault(); // Space otherwise scrolls the page, Backspace can navigate back
      clearAll();
    }
  });
  window.addEventListener('keyup', function (e) {
    if (e.key === 'Control') setCtrlMode(false);
  });
  // Alt-tabbing away (or anything else) while Ctrl is physically
  // still down would otherwise leave the mode stuck on forever,
  // since no keyup ever fires on this page.
  window.addEventListener('blur', function () { setCtrlMode(false); });

  window.addEventListener('mousemove', function (e) {
    raw.x = e.clientX;
    raw.y = e.clientY;
  });

  window.addEventListener('mousedown', function (e) {
    if (!ctrlHeld || e.button !== 0) return;
    // Ctrl+click normally opens a link in a new tab—while in
    // paint mode that would fight with drawing over the nav/
    // actions, so it's deliberately suppressed for the duration.
    e.preventDefault();
    isDrawing = true;
    smooth.x = raw.x;
    smooth.y = raw.y;
    lastStamp = { x: raw.x, y: raw.y };
  });
  window.addEventListener('mouseup', function () { isDrawing = false; lastStamp = null; });
  // Belt-and-suspenders: a link's own click handler still runs
  // unless this is stopped too (preventDefault on mousedown alone
  // doesn't cancel the subsequent click on every browser).
  window.addEventListener('click', function (e) { if (ctrlHeld) e.preventDefault(); }, true);

  // Routes each dot to whichever layer actually represents where
  // it landed: inside .content-pane, it goes on the pane's own
  // (scrolling) canvas in content-relative coordinates, with the
  // surface tone/lift/edge-touch treatment; otherwise it's plain
  // paint on the fixed page canvas. A dot can only ever belong to
  // one or the other—no boundary math to get subtly wrong for
  // dots that happen to scatter right at a corner, since the
  // pane canvas's own overflow clipping backstops the rest.
  //
  // Shared low-level primitive—one dot, one context, already-
  // resolved color/alpha/position. Used by stampDot below and by
  // updateDrips (which resolves its own target/color once, at
  // creation, rather than through stampDot's routing). A single
  // stamp can scatter hundreds of these, and the actual bottleneck
  // at that volume is per-fill() overhead (state setup + rasterizer
  // dispatch), not the math—so this doesn't draw immediately.
  // Instead it queues into a bucket keyed by (context, color,
  // quantized alpha) and a real draw only happens when something
  // flushes that bucket (see flushBatch), where every dot sharing
  // a bucket becomes one beginPath()+fill() instead of its own.
  // Alpha is quantized to 16 steps—coarser than the continuous
  // random value each dot would otherwise get, but at this dot
  // size and density the scatter noise already dominates; the
  // banding isn't visible.
  // Keyed by target context itself (not a fixed pair of names)
  // since a pane-side dot now queues into up to two contexts at
  // once—the off-screen store and, when it lands in the currently
  // visible window, the small on-screen view canvas directly (see
  // stampDot/updateDrips)—and the fixed canvas is a third.
  var batches = new Map();
  function paintDot(targetCtx, x, y, g, a) {
    var qa = Math.round(a * 16) / 16;
    if (qa <= 0) return;
    var sub = batches.get(targetCtx);
    if (!sub) { sub = new Map(); batches.set(targetCtx, sub); }
    var key = g + '_' + qa;
    var bucket = sub.get(key);
    if (!bucket) {
      bucket = { style: 'rgba(' + g + ',' + g + ',' + g + ',' + qa.toFixed(3) + ')', dots: [] };
      sub.set(key, bucket);
    }
    bucket.dots.push(x, y, 0.25 + Math.random() * 0.6);
  }
  // Actually draws everything queued for one context since the
  // last flush. Split from paintDot (rather than one flush at the
  // very end of tick()) so updateDrips can flush the fixed
  // canvas's bucket while its own clip against the section's
  // footprint (see updateDrips) is still active—dots queued there
  // must still be drawn under that clip, not after it's already
  // been restored.
  function flushBatch(targetCtx) {
    var sub = batches.get(targetCtx);
    if (!sub || !sub.size) return;
    sub.forEach(function (bucket) {
      targetCtx.fillStyle = bucket.style;
      targetCtx.beginPath();
      var dots = bucket.dots;
      for (var i = 0; i < dots.length; i += 3) {
        // moveTo before each arc—without it, arc() draws a
        // connecting line from the previous dot's edge into this
        // one, and fill() would render that seam too instead of
        // separate circles.
        targetCtx.moveTo(dots[i] + dots[i + 2], dots[i + 1]);
        targetCtx.arc(dots[i], dots[i + 1], dots[i + 2], 0, Math.PI * 2);
      }
      targetCtx.fill();
    });
    sub.clear();
  }

  function stampDot(x, y, alpha) {
    // Membership on the pane is horizontal only (left edge, and
    // the right edge stopping short of the scrollbar gutter—see
    // paneRightEdge). Whether a point is ALSO within the
    // currently-visible vertical window (paneRect.top/bottom) is
    // a separate question, checked further down: scattering above
    // the header or below the current bottom fold doesn't mean
    // "not part of the pane," it means "part of the pane, just
    // not visible at this scroll position." Content-relative
    // storage doesn't care which is true—only the direct draw
    // onto the small view canvas does.
    if (paneRect && x >= paneRect.left && x <= paneRightEdge) {
      var g = surfaceTone(x);
      var a = CFG.surfaceAlpha * alpha;
      var lift = edgeLift(x);
      // Off-screen store: content-relative, so it's still there
      // (and correct) the next time blitPane() has to redraw the
      // view canvas from scratch after a scroll.
      var localX = x - (articleRect ? articleRect.left : paneRect.left);
      var localY = y - (articleRect ? articleRect.top : paneRect.top) + lift;
      paintDot(pctx, localX, localY, g, a);
      // Mirror onto the small on-screen view canvas too, but only
      // when this point is actually inside the currently-visible
      // window right now. A dot that scattered above the header
      // or below the current bottom edge is still logically part
      // of the pane (already stored above in content-relative
      // space, at whatever real position that is)—it just isn't
      // part of what's shown this instant. It surfaces on its own
      // via blitPane() the moment scrolling brings that content-Y
      // into paneRect's visible range, instead of either bleeding
      // onto the header/fixed layer or being lost outright.
      if (y >= paneRect.top && y <= paneRect.bottom) {
        paintDot(pvctx, x - paneRect.left, y - paneRect.top + lift, g, a);
      }
    } else if (!(cardRect && x >= cardRect.left && x <= cardRect.right + 10 && y >= cardRect.top && y <= cardRect.bottom + CARD_BOTTOM_MARGIN)) {
      // Outside the pane horizontally (sidebar, or past the
      // scrollbar gutter) and outside the section's footprint
      // entirely: plain paint on the fixed page canvas. (Outside
      // the pane but still within the section—the header, or the
      // scrollbar gutter strip—gets nothing: both sit visually on
      // top of this layer, so there'd be nothing to see anyway.
      // The bottom margin covers the same case just past the
      // section's own bottom-right corner: without it, a dot from
      // a stamp near there that scatters a bit further down than
      // cardRect.bottom counts as "off the section" and lands on
      // the fixed canvas—which stacks above the scrollbar track,
      // so it showed up as paint bleeding through right where the
      // track ends instead of just disappearing like every other
      // dot this close to the card. The +10 on the right catches
      // the same thing one axis over: a scattered dot's x is
      // ordinary float math, and one landing a fraction past
      // cardRect.right on its own no longer matches "within the
      // section" at all, so it skipped the bottom margin above
      // entirely and leaked through right at the corner where
      // both were needed at once.)
      paintDot(ctx, x, y, 0, alpha);
    }
  }

  // One "stamp" = a scattered cluster of dots around (x, y),
  // biased along the direction of travel plus a fixed cap tilt.
  // `spread` (0..1+) widens the cluster—driven by how sharply the
  // path is turning and how slow the cursor is moving. Two
  // populations layer on top of each other: a wide, sparser outer
  // scatter (the textured spray edge) and a tight, near-opaque
  // core scatter right on the centerline (the "heavier toward the
  // middle" bulk of the line)—together they read as a bold, dense
  // fill, not a light mist. The shared radius also carries a
  // slow, persistent wobble (a random walk, not per-dot jitter)
  // so successive stamps aren't identically wide.
  function stamp(x, y, angle, spread) {
    // "Paint over paint": a spot this stroke (or an earlier one)
    // has already crossed several times stamps denser.
    var crossed = (density[cellKey(x, y)] || 0) >= CFG.crossAt;
    var boost = crossed ? CFG.crossBoost : 1;

    widthWobble += (Math.random() - 0.5) * 0.02;
    widthWobble = Math.max(1 - CFG.widthWobbleRange, Math.min(1 + CFG.widthWobbleRange, widthWobble));

    // Counts (not radius or alpha—the line should get sparser
    // under load, not visibly thinner or fainter) scale down with
    // qualityScale when frames are running slow; see tick().
    var outerRadius = (CFG.outerRadiusBase + spread * CFG.outerRadiusSpread) * CFG.outerRadiusMult * widthWobble;
    var outerCount = Math.round((CFG.outerCountBase + spread * CFG.outerCountSpread) * CFG.outerCountMult * boost * qualityScale);
    for (var i = 0; i < outerCount; i++) {
      var a = angle + CFG.capTilt + (Math.random() - 0.5) * 2.6;
      var r = Math.pow(Math.random(), 1.7) * outerRadius;
      stampDot(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55, CFG.dotAlphaOuterMin + Math.random() * CFG.dotAlphaOuterRange);
    }

    var coreRadius = outerRadius * CFG.coreRadiusFrac;
    var coreCount = Math.round((CFG.coreCountBase + spread * CFG.coreCountSpread) * boost * qualityScale);
    for (var j = 0; j < coreCount; j++) {
      var a2 = angle + CFG.capTilt + (Math.random() - 0.5) * 1.5;
      var r2 = Math.pow(Math.random(), 2.6) * coreRadius;
      stampDot(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2 * 0.55, CFG.dotAlphaCoreMin + Math.random() * CFG.dotAlphaCoreRange);
    }

    registerDensity(x, y);
  }

  // A drip is its own slow, independent animation—once triggered
  // it keeps falling frame after frame regardless of where the
  // cursor is now, so it's still crawling down while later
  // tagging happens elsewhere. Path wobbles (a damped random walk,
  // not a clean sine wave—reads as gravity fighting an uneven
  // surface, not a mechanical wiggle) and widens as it falls, so
  // the accumulating trail tapers into a rounded, pear-like tip
  // instead of ending in a hard point. Renders straight to
  // whichever context/color it was assigned at creation (see
  // registerDensity)—not through stampDot, since a pane-space
  // drip's (x, y) are already content-relative, not screen ones.
  function updateDrips() {
    if (!drips.length) return;
    // A fixed-space drip's own random walk can wander into the
    // content pane's screen-space rectangle—including up under its
    // header bar. The whole section is a raised surface (with an
    // opaque header strip on top of it, on project pages) sitting
    // above this layer, so paint drifting under any part of it
    // should disappear behind it, not smear across its face—clip
    // the fixed canvas to everywhere except the section's current
    // footprint for the duration of this update. (Pane-space drips
    // paint on a different canvas entirely, already confined to
    // the scroll container by its own overflow clip.)
    var clipped = false;
    if (cardRect) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width / dpr, canvas.height / dpr);
      // 1px larger than the section's own rect on every side so the
      // clip's own edge antialiasing can't leave a sub-pixel sliver
      // of paint sitting right on the seam—except the right and
      // bottom, both padded out further (10px, and
      // CARD_BOTTOM_MARGIN) so a fixed-space drip that wanders a
      // bit past the section's bottom-right corner still
      // disappears there instead of bleeding onto the fixed
      // canvas, which stacks above the scrollbar track.
      ctx.rect(cardRect.left - 1, cardRect.top - 1, cardRect.width + 11, cardRect.height + 2 + CARD_BOTTOM_MARGIN);
      ctx.clip('evenodd');
      clipped = true;
    }
    for (var i = drips.length - 1; i >= 0; i--) {
      var d = drips[i];
      d.vel += (Math.random() - 0.5) * CFG.dripWobbleAccel;
      d.vel *= CFG.dripWobbleDamp;
      d.x += d.vel;
      var fall = CFG.dripFallMin + Math.random() * CFG.dripFallRange;
      d.y += fall;
      d.dist += fall;

      var targetCtx = d.space === 'pane' ? pctx : ctx;
      // Same reasoning as stampDot: a pane-space drip's (x, y) are
      // content-relative for persistence, but drawing them AGAIN
      // directly onto the small view canvas whenever they're
      // currently inside the visible window avoids ever needing
      // blitPane()'s expensive full-store copy just because a
      // drip is quietly falling—see stampDot for the measured
      // cost of skipping this.
      var inView = d.space === 'pane' && paneRect && articleRect &&
        (articleRect.top + d.y) >= paneRect.top && (articleRect.top + d.y) <= paneRect.bottom;
      var progress = Math.min(1, d.dist / d.maxDist);
      var radius = 1 + progress * 2.6;
      var n = 3 + Math.round(progress * 3);
      for (var k = 0; k < n; k++) {
        var a = d.alphaMul * (0.75 + Math.random() * 0.25);
        var dotX = d.x + (Math.random() - 0.5) * radius;
        var dotY = d.y + (Math.random() - 0.5) * 1.6;
        paintDot(targetCtx, dotX, dotY, d.tone, a);
        if (inView) paintDot(pvctx, articleRect.left + dotX - paneRect.left, articleRect.top + dotY - paneRect.top, d.tone, a);
      }

      if (d.dist >= d.maxDist) {
        // The bulb: a rounder, denser cluster right at the tip,
        // where a real drop would finally let go.
        for (var b = 0; b < 16; b++) {
          var ang = Math.random() * Math.PI * 2;
          var r = Math.pow(Math.random(), 1.3) * radius * 2;
          var ab = d.alphaMul * (0.8 + Math.random() * 0.2);
          var bx = d.x + Math.cos(ang) * r * 0.7;
          var by = d.y + Math.sin(ang) * r;
          paintDot(targetCtx, bx, by, d.tone, ab);
          if (inView) paintDot(pvctx, articleRect.left + bx - paneRect.left, articleRect.top + by - paneRect.top, d.tone, ab);
        }
        drips.splice(i, 1);
      }
    }
    // Flush the fixed-canvas bucket now, while the clip above is
    // still active—these dots must land under it, not after it's
    // been restored below. Off-screen-store and view-canvas drip
    // dots don't need that clip and are left queued for tick()'s
    // own flush.
    flushBatch(ctx);
    if (clipped) ctx.restore();
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    if (!ctrlHeld) return;

    // Falling behind 30fps (33ms/frame) backs qualityScale off
    // fast; comfortably ahead of it recovers slowly—asymmetric on
    // purpose, so a rough patch reacts immediately but quality
    // doesn't yo-yo back up the moment one fast frame slips in.
    var now = performance.now();
    var frameDt = now - lastFrameTime;
    lastFrameTime = now;
    if (frameDt > 33) {
      qualityScale = Math.max(0.35, qualityScale - 0.06);
    } else if (frameDt < 20) {
      qualityScale = Math.min(1, qualityScale + 0.015);
    }

    // Scrolling the pane while drawing (or while a drip is mid-
    // fall) shifts where "content-relative" coordinates land—
    // keep this current every frame, not just on resize.
    updateArticleRect();

    // Cursor icon: adaptive smoothing—tiny movements (hand
    // tremor, mouse noise) get heavy smoothing so they barely
    // nudge it; real strokes get the snappy factor. Filters
    // micro-jitter without the laggy feel a flat, always-snappy
    // factor produced. Never rotates on its own; it just tilts
    // 7deg left for as long as the mouse button is down, easing
    // back upright the moment it's released.
    var vx = raw.x - smooth.x, vy = raw.y - smooth.y;
    var speed = Math.hypot(vx, vy);
    var lerpT = Math.min(1, speed / CFG.lerpSpeedRef);
    var lerp = CFG.lerpSlow + lerpT * (CFG.lerpFast - CFG.lerpSlow);
    smooth.x += vx * lerp;
    smooth.y += vy * lerp;
    cursor.style.transform = 'translate(' + (raw.x - HOTSPOT_X) + 'px,' + (raw.y - HOTSPOT_Y) + 'px)';
    cursorTilt.style.transform = 'rotate(' + (isDrawing ? -7 : 0) + 'deg)';

    updateDrips();
    // A drip can still be mid-fall on a frame with no active
    // stroke—flush its queued dots now rather than leaving them
    // until the user next draws (they'd otherwise all land at
    // once, several frames late). No blitPane() needed here: any
    // drip dot currently inside the visible window was already
    // drawn straight onto pvctx too (see updateDrips).
    flushBatch(pctx);
    flushBatch(pvctx);

    if (!isDrawing || !lastStamp) return;

    var dxTotal = smooth.x - lastStamp.x;
    var dyTotal = smooth.y - lastStamp.y;
    var dist = Math.hypot(dxTotal, dyTotal);
    var STEP = 3; // px between stamps—dense enough for a solid line at normal speed
    if (dist < STEP) return;

    var angle = Math.atan2(dyTotal, dxTotal);
    var turn = Math.abs(angle - lastAngle);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    var slow = Math.max(0, 1 - dist / 14); // dwelling in place pools more paint
    var spread = Math.min(1.6, turn / 1.4 + slow * 0.6);

    var steps = Math.floor(dist / STEP);
    // A dropped/delayed frame (slow CPU, tab backgrounded a beat)
    // means `dist` can spike huge—stamping every 3px across it
    // would dump hundreds of stamps into one frame and make the
    // next frame even slower. Cap the count and spread it evenly
    // across the same distance instead: the line stays continuous
    // (t still runs 0..1 over the full span below), just a touch
    // thinner for that one recovery frame instead of a stutter.
    if (steps > 40) steps = 40;
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      stamp(lastStamp.x + dxTotal * t, lastStamp.y + dyTotal * t, angle, spread);
    }
    lastStamp = { x: smooth.x, y: smooth.y };
    lastAngle = angle;
    // Same reasoning as above: stampDot already drew straight
    // onto pvctx for anything landing in the visible window, so
    // no blitPane() (and its expensive copy from the full-height
    // off-screen store) is needed just because new stamps were
    // added.
    flushBatch(ctx);
    flushBatch(pctx);
    flushBatch(pvctx);
  }
  tick();

  // ── Settings panel: bottom-left gear toggles a live tuning
  // panel bound directly to CFG—each field updates its value
  // immediately on input. "Copy JSON" serializes the current CFG
  // so the tuned numbers can be sent back and baked in above.
  var FIELDS = [
    ['lerpSlow', 'Сглаживание — медленно', 0, 1, 0.01],
    ['lerpFast', 'Сглаживание — быстро', 0, 1, 0.01],
    ['lerpSpeedRef', 'Порог скорости, px', 1, 30, 1],
    ['capTilt', 'Наклон кэпа, рад', -3, 3, 0.05],
    ['outerCountBase', 'Точек снаружи — база', 0, 300, 1],
    ['outerCountSpread', 'Точек снаружи — разброс', 0, 300, 1],
    ['outerCountMult', 'Точек снаружи — множитель', 0.5, 6, 0.1],
    ['outerRadiusBase', 'Радиус снаружи — база', 1, 100, 1],
    ['outerRadiusSpread', 'Радиус снаружи — разброс', 0, 150, 1],
    ['outerRadiusMult', 'Радиус снаружи — множитель', 0.5, 6, 0.1],
    ['coreCountBase', 'Точек ядра — база', 0, 300, 1],
    ['coreCountSpread', 'Точек ядра — разброс', 0, 300, 1],
    ['coreRadiusFrac', 'Радиус ядра — доля', 0.05, 1, 0.01],
    ['dotAlphaOuterMin', 'Альфа снаружи — мин', 0, 1, 0.01],
    ['dotAlphaOuterRange', 'Альфа снаружи — разброс', 0, 1, 0.01],
    ['dotAlphaCoreMin', 'Альфа ядра — мин', 0, 1, 0.01],
    ['dotAlphaCoreRange', 'Альфа ядра — разброс', 0, 1, 0.01],
    ['widthWobbleRange', 'Вариация толщины, ±', 0, 15, 0.005],
    ['cellSize', 'Размер ячейки плотности', 4, 150, 1],
    ['crossAt', 'Порог перекрестья', 1, 20, 1],
    ['crossBoost', 'Буст на перекрестье, ×', 1, 5, 0.1],
    ['dripAt', 'Порог капли', 1, 40, 1],
    ['dripFallMin', 'Скорость капли — мин', 0.05, 2, 0.01],
    ['dripFallRange', 'Скорость капли — разброс', 0, 2, 0.01],
    ['dripWobbleAccel', 'Виляние капли — accel', 0, 0.5, 0.005],
    ['dripWobbleDamp', 'Виляние капли — damp', 0.5, 0.99, 0.01],
    ['dripMaxDistMin', 'Длина капли — мин, px', 10, 300, 1],
    ['dripMaxDistRange', 'Длина капли — разброс, px', 0, 300, 1],
    ['surfaceAlpha', 'Альфа над пейном', 0.5, 5, 0.01],
    ['edgeLiftMax', 'Сдвиг у края, px', 0, 30, 0.5],
    ['edgeZone', 'Зона сдвига, px', 1, 60, 1],
    ['sheenWidth', 'Ширина блика, px', 0, 400, 5],
    ['sheenLightness', 'Яркость блика, 0–255', 0, 255, 1]
  ];

  var panelToggle = document.createElement('button');
  panelToggle.type = 'button';
  panelToggle.id = 'graffiti-settings-toggle';
  panelToggle.setAttribute('aria-label', 'Настройки граффити');
  panelToggle.textContent = '⚙';
  document.body.appendChild(panelToggle);

  var panel = document.createElement('div');
  panel.id = 'graffiti-settings-panel';
  panel.hidden = true;
  panel.innerHTML =
    '<div class="gs-title">Настройки тега</div>' +
    '<div class="gs-fields">' +
      FIELDS.map(function (f) {
        return '<div class="gs-row">' +
          '<label><span>' + f[1] + '</span>' +
          '<input type="number" data-key="' + f[0] + '" min="' + f[2] + '" max="' + f[3] + '" step="' + f[4] + '" value="' + CFG[f[0]] + '"></label>' +
          '<button type="button" class="gs-reset" data-reset-key="' + f[0] + '" title="Сбросить к дефолту" aria-label="Сбросить ' + f[1] + ' к дефолту">↺</button>' +
          '</div>';
      }).join('') +
    '</div>' +
    '<button type="button" class="gs-copy">Скопировать JSON</button>' +
    '<textarea class="gs-json" readonly></textarea>';
  document.body.appendChild(panel);

  var jsonArea = panel.querySelector('.gs-json');
  function refreshJson() { jsonArea.value = JSON.stringify(CFG, null, 2); }
  // Outlines a field's row while its value differs from the
  // baked-in default, so it's obvious at a glance what's actually
  // been touched versus what's still stock.
  function refreshModified(key) {
    var input = panel.querySelector('input[data-key="' + key + '"]');
    if (!input) return;
    input.closest('.gs-row').classList.toggle('gs-row--modified', CFG[key] !== DEFAULTS[key]);
  }
  FIELDS.forEach(function (f) { refreshModified(f[0]); });
  refreshJson();

  panel.addEventListener('input', function (e) {
    var key = e.target.getAttribute('data-key');
    if (!key) return;
    var v = parseFloat(e.target.value);
    if (isNaN(v)) return;
    CFG[key] = v;
    refreshModified(key);
    refreshJson();
  });

  panel.addEventListener('click', function (e) {
    var key = e.target.getAttribute('data-reset-key');
    if (!key) return;
    CFG[key] = DEFAULTS[key];
    var input = panel.querySelector('input[data-key="' + key + '"]');
    if (input) input.value = DEFAULTS[key];
    refreshModified(key);
    refreshJson();
  });

  panel.querySelector('.gs-copy').addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonArea.value).catch(function () { jsonArea.select(); });
    } else {
      jsonArea.select();
    }
  });

  panelToggle.addEventListener('click', function () {
    panel.hidden = !panel.hidden;
  });
})();
