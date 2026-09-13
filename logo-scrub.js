// ── Logo hover-scrub (desktop only via CSS gating on .site-nav—see
// styles.css/mobile.css). Moving the cursor across the brand mark
// divides its width into 7 zones and swaps in a different brush-stroke
// rendering per zone; the <a>'s own click behavior (go home) is never
// touched. Shared across every Brands page—see the matching #brand-scrub
// CSS in graffiti.css.
(function () {
  var brand = document.getElementById('brand-scrub');
  if (!brand) return;
  var brushes = brand.querySelectorAll('.brand-mark--brush');
  if (!brushes.length) return;
  // Tracks whether we're already mid-scrub (as opposed to this
  // being the first move right after the cursor arrived), so only
  // the original→first-brush swap and the final brush→original
  // swap get the eased class—every swap between brushes while
  // actively moving stays instant (see the matching CSS).
  var entered = false;

  brand.addEventListener('mousemove', function (e) {
    var rect = brand.getBoundingClientRect();
    if (!rect.width) return;
    var pct = (e.clientX - rect.left) / rect.width;
    var index = Math.min(brushes.length - 1, Math.max(0, Math.floor(pct * brushes.length)));
    brand.classList.toggle('is-transitioning', !entered);
    entered = true;
    brand.classList.add('is-scrubbing');
    brushes.forEach(function (img, i) {
      img.classList.toggle('is-active', i === index);
    });
  });
  brand.addEventListener('mouseleave', function () {
    entered = false;
    brand.classList.add('is-transitioning');
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
