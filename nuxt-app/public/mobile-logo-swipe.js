// ── Mobile logo swipe-to-cycle. Swiping horizontally across the
// "Andrey Ubeyvolk" wordmark in the mobile bottom bar cycles through
// the plain Inter text (the default, same as .mobile-bar__menu) plus
// the same 7 brush-stroke letterings the desktop hover-scrub
// (#brand-scrub) uses—reusing their already-resolved <img>.src values
// rather than hardcoding a relative path here, so this works
// unmodified at any folder depth and costs nothing extra to load: the
// browser already fetched those 7 small SVGs for the desktop nav on
// this same page load, so swapping to one is served straight from
// cache. Only one <img> element exists for this (its src is swapped in
// place), not seven—there's nothing here sized proportional to a
// gallery or a session's browsing, just one small handle of state.
//
// The direction matters: a right swipe steps forward through the loop
// (text -> lettering 1 -> 2 -> ... -> 7 -> text -> 1 -> ...), a left
// swipe steps backward through the same loop (text -> 7 -> 6 -> ... ->
// 1 -> text -> 7 -> ...). The plain text is one stop on that 8-item
// loop (index 0)—not a separate "unset" state outside it—so cycling
// all the way around in either direction always lands back on it. The
// choice is kept in sessionStorage, so it survives closing/reopening
// the mobile menu (and any other in-session navigation) but resets on
// a fresh tab/session, same lifetime as the rest of the site's
// per-viewer state.
(function () {
  var brand = document.querySelector('.mobile-bar__brand');
  if (!brand) return;
  var textEl = brand.querySelector('.brand-mark--text');
  var img = brand.querySelector('.mobile-brand-lettering');
  if (!textEl || !img) return;

  var brushImgs = document.querySelectorAll('#brand-scrub .brand-mark--brush');
  if (!brushImgs.length) return;
  var urls = Array.prototype.map.call(brushImgs, function (el) { return el.src; });

  var STORAGE_KEY = 'mobileLogoLetteringIndex';
  var STATE_COUNT = urls.length + 1; // 0 = plain text (the default), 1..N = the letterings
  var currentIndex = 0;

  function applyState(index) {
    currentIndex = index;
    if (index === 0) {
      brand.classList.remove('is-lettering');
    } else {
      img.src = urls[index - 1];
      brand.classList.add('is-lettering');
    }
  }

  var stored = null;
  try { stored = sessionStorage.getItem(STORAGE_KEY); } catch (err) { /* private-mode storage access can throw */ }
  if (stored !== null) {
    var restored = parseInt(stored, 10);
    if (restored >= 0 && restored < STATE_COUNT) applyState(restored);
  }
  // No stored value: stays at index 0 (plain text), already the
  // markup's own starting state—nothing to apply.

  var startX = 0, startY = 0, tracking = false;
  var SWIPE_THRESHOLD = 32; // px—short flicks shouldn't accidentally trigger this over a tap

  brand.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
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
    // A real horizontal swipe, not a tap—don't also let it navigate
    // home via the <a>'s own click. Right steps forward, left steps
    // backward, both wrapping through the same 8-item loop.
    e.preventDefault();
    var step = dx > 0 ? 1 : -1;
    applyState((currentIndex + step + STATE_COUNT) % STATE_COUNT);
    try { sessionStorage.setItem(STORAGE_KEY, String(currentIndex)); } catch (err) { /* ditto */ }
  });
})();
