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

  // 30s of no mouse movement at all before the hint shows--same wait
  // every time it re-arms, not a progressive backoff.
  var IDLE_MS = 30000;

  // Any real mouse movement anywhere dismisses the tip (if up) and
  // resets the idle clock; it only actually shows once the idle window
  // passes with no movement at all.
  var idleTimer = null;
  function armIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      showTip(lastMouseX, lastMouseY);
    }, IDLE_MS);
  }
  // A plain click (mousedown+mouseup with no drag) can still dispatch a
  // 'mousemove' in some browsers, and even when it doesn't, a real human
  // hand isn't perfectly still between mousedown and mouseup--a few px
  // of natural tremor is common. Neither should count as "the user moved
  // the mouse" and reset the idle clock; only a genuine drag should.
  // Tracked for any button (left or right--a right-click's contextmenu
  // is preceded by the same mousedown) via a wider movement threshold
  // while a button is held, rather than ignoring click-adjacent movement
  // outright, so real dragging still works as before. The timeout is a
  // safety net in case mouseup never fires for some OS/browser
  // combination (e.g. a context menu swallowing it).
  var mouseButtonDown = false;
  var mouseButtonDownResetTimer = null;
  function setMouseButtonDown(down) {
    mouseButtonDown = down;
    clearTimeout(mouseButtonDownResetTimer);
    if (down) mouseButtonDownResetTimer = setTimeout(function () { mouseButtonDown = false; }, 500);
  }
  window.addEventListener('mousedown', function () { setMouseButtonDown(true); });
  window.addEventListener('mouseup', function () { setMouseButtonDown(false); });
  window.addEventListener('mousemove', function (e) {
    var dx = e.clientX - lastMouseX, dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    var threshold = mouseButtonDown ? 10 : 2;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
    hideTip();
    armIdleTimer();
  });
  armIdleTimer();
})();
