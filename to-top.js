// ── "To top" on the Solution icon (shared across every project-
// template page: Brands and Inhouse). On desktop, hovering the icon
// rotates it (pure CSS, see .pv-icon:hover img in each page's own
// <style>) and shows a cursor-following "To top ↑" tooltip (styled via
// .pv-icon-tip in graffiti.css); on mobile there's no hover to speak
// of, so the matching .mobile-project__icon just gets the same tap
// target. Either way, clicking/tapping scrolls back to the very
// top—the desktop project pane, or on mobile (below the 981px
// breakpoint) the page itself, since it scrolls natively there
// instead.
(function () {
  var icon = document.querySelector('.pv-icon');
  var mobileIcon = document.querySelector('.mobile-project__icon');
  if (!icon && !mobileIcon) return;

  var tip = null;
  if (icon) {
    tip = document.createElement('div');
    tip.className = 'pv-icon-tip';
    tip.textContent = 'To top ↑';
    document.body.appendChild(tip);

    icon.addEventListener('mousemove', function (e) {
      var off = 16;
      var left = e.clientX + off;
      var top = e.clientY + off;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      if (left + tw > window.innerWidth - 8) left = e.clientX - off - tw;
      if (top + th > window.innerHeight - 8) top = e.clientY - off - th;
      if (left < 8) left = 8;
      if (top < 8) top = 8;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
      tip.classList.add('is-visible');
    });
    icon.addEventListener('mouseleave', function () {
      tip.classList.remove('is-visible');
    });
  }

  var pane = document.querySelector('.project-scroll');
  var desktopQuery = window.matchMedia('(min-width: 981px)');

  // Hand-rolled rAF tween instead of Lenis's own scrollTo—driving
  // the pane's scrollTop directly guarantees one continuous
  // monotonic curve for the whole trip. easeOutQuint: launches
  // fast, then a long, smooth glide all the way to a dead
  // stop—no hard brake at the end.
  function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }
  function animateScrollTo(getPos, setPos, target, duration, onDone) {
    var start = getPos();
    var change = target - start;
    if (!change) { if (onDone) onDone(); return; }
    var startTime = null;
    function step(now) {
      if (startTime === null) startTime = now;
      var t = Math.min((now - startTime) / duration, 1);
      setPos(start + change * easeOutQuint(t));
      if (t < 1) requestAnimationFrame(step);
      else if (onDone) onDone();
    }
    requestAnimationFrame(step);
  }

  var isAnimating = false;

  function scrollProjectToTop() {
    if (isAnimating) return;
    isAnimating = true;
    if (tip) tip.classList.remove('is-visible');

    if (desktopQuery.matches && pane) {
      // Lenis's own autoRaf loop keeps running the whole time, and
      // writing straight to pane.scrollTop bypasses it entirely—
      // Lenis's internal notion of "current scroll" falls out of
      // sync with the real one, and re-converging the two produced
      // a visible stutter right near the end. (lenisInstance.stop()
      // looked like the fix, but it sets overflow:clip on the
      // pane—that silently no-ops every scrollTop write for as
      // long as it's called, which is worse.) Routing each frame
      // through Lenis's own scrollTo with immediate:true instead
      // makes Lenis itself the one writing scrollTop, so its
      // internal state never drifts from reality in the first
      // place—nothing to resync, nothing to fight.
      var setPos = pane.lenisInstance
        ? function (v) { pane.lenisInstance.scrollTo(v, { immediate: true }); }
        : function (v) { pane.scrollTop = v; };
      animateScrollTo(
        function () { return pane.scrollTop; },
        setPos,
        0, 1400,
        function () { isAnimating = false; }
      );
    } else {
      animateScrollTo(
        function () { return window.scrollY; },
        function (v) { window.scrollTo(0, v); },
        0, 1400,
        function () { isAnimating = false; }
      );
    }
  }

  if (icon) icon.addEventListener('click', scrollProjectToTop);
  if (mobileIcon) {
    mobileIcon.addEventListener('click', scrollProjectToTop);
    // role="button" on a plain <img> needs its own Enter/Space
    // handling—native buttons get this for free, this doesn't.
    mobileIcon.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollProjectToTop();
      }
    });
  }
})();
