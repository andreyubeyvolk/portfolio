// ── Logo scrub (brand mark swap). Two input paths share one piece of
// state (which of the 7 brush-stroke renderings--or plain text--is
// showing), picked per interaction by pointer type rather than viewport
// width alone:
//   - Mouse (pointer:fine), any width #brand-scrub is actually visible at
//     (tablet included--site-nav only hides below 641px, see mobile.css):
//     hovering swaps in the next lettering in sequence; leaving reverts to
//     plain text. Same behavior a desktop browser gets when resized down
//     to tablet width.
//   - Touch (pointer:coarse), tablet width only (641-980px--phones get
//     their own swipe via mobile-logo-swipe.js on the bottom bar instead,
//     and touch is rare/unsupported at real desktop width): swiping the
//     wordmark left/right cycles the same loop, and the choice sticks
//     (sessionStorage) instead of reverting on release--there's no
//     "pointer left" event on touch to revert to.
(function () {
  var brand = document.getElementById('brand-scrub');
  if (!brand) return;
  var brushes = brand.querySelectorAll('.brand-mark--brush');
  if (!brushes.length) return;
  // Every swap eases now (text->lettering, lettering->text or ->next
  // lettering)--there's no more "track the cursor instantly" requirement.
  brand.classList.add('is-transitioning');

  // index 0 = plain text, 1..N = brushes[index - 1]
  var STATE_COUNT = brushes.length + 1;
  var currentIndex = 0;
  function applyState(index) {
    currentIndex = index;
    brand.classList.toggle('is-scrubbing', index !== 0);
    brushes.forEach(function (img, i) { img.classList.toggle('is-active', i === index - 1); });
  }

  // ── Hover path ──
  var hoverQuery = window.matchMedia('(min-width: 641px) and (pointer: fine)');
  var nextHoverIndex = 0;
  brand.addEventListener('mouseenter', function () {
    if (!hoverQuery.matches) return;
    var index = nextHoverIndex;
    nextHoverIndex = (nextHoverIndex + 1) % brushes.length;
    applyState(index + 1);
  });
  brand.addEventListener('mouseleave', function () {
    if (!hoverQuery.matches) return;
    applyState(0);
  });

  // ── Touch-swipe path (tablet width only) ──
  // Same loop/direction/threshold as mobile-logo-swipe.js's bottom-bar
  // version, applied to #brand-scrub's own markup instead.
  var swipeQuery = window.matchMedia('(min-width: 641px) and (max-width: 980px) and (pointer: coarse)');
  var STORAGE_KEY = 'brandScrubLetteringIndex';
  var startX = 0, startY = 0, tracking = false;
  var SWIPE_THRESHOLD = 32;

  brand.addEventListener('touchstart', function (e) {
    if (!swipeQuery.matches || e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  brand.addEventListener('touchend', function (e) {
    if (!tracking) return;
    tracking = false;
    var touch = e.changedTouches[0];
    var dx = touch.clientX - startX;
    var dy = touch.clientY - startY;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    // A real horizontal swipe, not a tap--don't also let it navigate home
    // via the <a>'s own click.
    e.preventDefault();
    var step = dx > 0 ? 1 : -1;
    applyState((currentIndex + step + STATE_COUNT) % STATE_COUNT);
    try { sessionStorage.setItem(STORAGE_KEY, String(currentIndex)); } catch (err) { /* private-mode storage access can throw */ }
  });

  // Restores the swiped-to lettering on load/navigation--only meaningful
  // for the touch path (hover never persists past mouseleave). Exposed for
  // legacy-nav-scripts.client.ts's page:finish hook, same pattern
  // mobile-logo-swipe.js uses for its own persisted state.
  function restoreFromStorage() {
    if (!swipeQuery.matches) return;
    var stored = null;
    try { stored = sessionStorage.getItem(STORAGE_KEY); } catch (err) { /* ditto */ }
    if (stored !== null) {
      var restored = parseInt(stored, 10);
      if (restored >= 0 && restored < STATE_COUNT) applyState(restored);
    }
  }
  restoreFromStorage();
  window.reapplyBrandScrub = restoreFromStorage;

  // Nudges toward the hidden Ctrl+drag feature: five full seconds of
  // mouse inactivity anywhere on the page shows a hint at wherever the
  // cursor was last, not anchored to the logo (idle can strike with the
  // mouse sitting anywhere). Reuses .pv-icon-tip for the look (black
  // rectangle, white text, Inter--see graffiti.css). Desktop-only: a wide
  // touch device (tablet, or a phone with desktop-site requested) has no
  // real Ctrl key, so the hint would otherwise get created and then just
  // sit there forever with nothing able to dismiss it--same reasoning as
  // before, unrelated to the hover/swipe split above.
  var desktopQuery = window.matchMedia('(min-width: 981px) and (pointer: fine)');
  if (!desktopQuery.matches) return;

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
