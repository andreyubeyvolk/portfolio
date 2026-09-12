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

  // Nudges toward the hidden Ctrl+drag feature, from two distinct
  // triggers that both show the same hint but anchor it
  // differently:
  //   - hovering the logo for a full second: pinned to the
  //     cursor, right of it (same diagonal-offset-with-clamping
  //     as the "To top" tooltip on project pages), so the cursor
  //     itself never sits on top of it and hides it.
  //   - five full seconds of mouse inactivity ANYWHERE on the
  //     page: shown at wherever the cursor last was, since that's
  //     not necessarily anywhere near the logo.
  // Reuses .pv-icon-tip for the look (black rectangle, white
  // text, Inter—see graffiti.css).
  var tip = document.createElement('div');
  tip.className = 'pv-icon-tip';
  tip.textContent = 'Ctrl+click to tag!';
  document.body.appendChild(tip);
  var tipSource = null; // 'hover' | 'idle' | null—which trigger is currently showing it
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
  function showTip(source, x, y) {
    positionTipAt(x, y);
    tip.classList.add('is-visible');
    tipSource = source;
  }
  function hideTip() {
    tip.classList.remove('is-visible');
    tipSource = null;
  }

  var hoverTimer = null;
  brand.addEventListener('mousemove', function (e) {
    // Keep tracking the cursor while the hover tip is already up,
    // same as "To top" does over its own icon.
    if (tipSource === 'hover') positionTipAt(e.clientX, e.clientY);
  });
  brand.addEventListener('mouseenter', function () {
    hoverTimer = setTimeout(function () { showTip('hover', lastMouseX, lastMouseY); }, 1000);
  });
  brand.addEventListener('mouseleave', function () {
    clearTimeout(hoverTimer);
    // Only dismiss it here if hovering is what showed it—if the
    // idle trigger took over first (see below), leave that alone.
    if (tipSource === 'hover') hideTip();
  });

  // Any mouse movement anywhere resets the idle clock; the tip
  // only actually shows once a full 5s passes with none at all,
  // at whatever position the cursor was left at.
  var idleTimer = null;
  function armIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { showTip('idle', lastMouseX, lastMouseY); }, 5000);
  }
  window.addEventListener('mousemove', function (e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (tipSource === 'idle') hideTip();
    armIdleTimer();
  });
  armIdleTimer();
})();
