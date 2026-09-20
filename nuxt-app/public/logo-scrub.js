// ── Logo hover-scrub (desktop only). Hovering the brand mark swaps in
// one of the 7 brush-stroke renderings—not tracking cursor position
// across the logo's width anymore (no "scrub as you move" sweep), just
// one lettering per hover, advancing to the next in sequence each time
// the cursor re-enters. Moving the cursor away always returns to the
// plain text mark; the <a>'s own click behavior (go home) is never
// touched. Shared across the whole site—see the matching #brand-scrub
// CSS in graffiti.css.
(function () {
  // #brand-scrub itself is already hidden below this breakpoint (see
  // styles.css/mobile.css), which makes the hover-scrub inert there on
  // its own—but the idle-hint timer below listens on `window`, not on
  // #brand-scrub, and touch input never fires 'mousemove' at all. That
  // meant the 5s-idle timer effectively always fired on a phone (no
  // mousemove ever arrives to keep re-arming it) and then just sat
  // there forever (nothing ever calls hideTip() either, same reason)—
  // a "Ctrl+click to tag!" hint for a desktop-only Ctrl+drag feature,
  // permanently stuck on screen on mobile. Bailing out entirely here
  // is simpler and more robust than gating just the idle-timer piece.
  // (pointer: fine) on top of the width check--a wide-viewport touch
  // device (tablet in landscape, a phone with desktop-site requested)
  // still has no real Ctrl key, so the hint would otherwise get created
  // and then just sit there forever with nothing able to dismiss it.
  var desktopQuery = window.matchMedia('(min-width: 981px) and (pointer: fine)');
  if (!desktopQuery.matches) return;

  var brand = document.getElementById('brand-scrub');
  if (!brand) return;
  var brushes = brand.querySelectorAll('.brand-mark--brush');
  if (!brushes.length) return;
  // Every swap (text->lettering on enter, lettering->text on leave) now
  // eases—there's no more "track the cursor instantly" requirement
  // since a single hover only ever shows one lettering, never sweeping
  // between several while the mouse is still over it.
  brand.classList.add('is-transitioning');
  var nextIndex = 0;

  brand.addEventListener('mouseenter', function () {
    var index = nextIndex;
    nextIndex = (nextIndex + 1) % brushes.length;
    brand.classList.add('is-scrubbing');
    brushes.forEach(function (img, i) {
      img.classList.toggle('is-active', i === index);
    });
  });
  brand.addEventListener('mouseleave', function () {
    brand.classList.remove('is-scrubbing');
    brushes.forEach(function (img) { img.classList.remove('is-active'); });
  });

  // Nudges toward the hidden Ctrl+drag feature: five full seconds of
  // mouse inactivity anywhere on the page shows a hint at wherever the
  // cursor was last, not anchored to the logo (idle can strike with the
  // mouse sitting anywhere). Reuses .pv-icon-tip for the look (black
  // rectangle, white text, Inter—see graffiti.css).
  var tip = document.createElement('div');
  tip.className = 'pv-icon-tip';
  tip.textContent = 'Ctrl+click to tag!';
  document.body.appendChild(tip);
  var lastMouseX = 0, lastMouseY = 0;

  function positionTipAt(x, y) {
    var off = 16;
    var left = x + off;
    var top = y + off;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    if (left + tw > window.innerWidth - 8) left = x - off - tw;
    if (top + th > window.innerHeight - 8) top = y - off - th;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function showTip(x, y) {
    positionTipAt(x, y);
    tip.classList.add('is-visible');
  }
  function hideTip() {
    tip.classList.remove('is-visible');
  }

  // Any mouse movement anywhere dismisses the tip (if up) and resets
  // the idle clock; it only actually shows once a full 5s passes with
  // no movement at all.
  var idleTimer = null;
  function armIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { showTip(lastMouseX, lastMouseY); }, 5000);
  }
  window.addEventListener('mousemove', function (e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    hideTip();
    armIdleTimer();
  });
  armIdleTimer();
})();
