(function () {
  // Generic behavior for any number of `.vp` custom video-player components
  // on a page. Each instance is self-contained: play/pause, mute + volume,
  // seek, auto-hide controls while playing, keyboard support.
  //
  // Per-instance options via data attributes on the .vp root:
  //   data-autoplay="immediate" (default) — muted autoplay as soon as the
  //     page loads (e.g. the homepage reel).
  //   data-autoplay="scroll" — muted autoplay once, the first time the
  //     player scrolls into view (IntersectionObserver, fires once).
  //
  // The <video> can carry a single `src`, OR two responsive sources via
  // data-src-portrait / data-src-landscape (switched at the 981px
  // breakpoint) — the responsive switch only runs if both are present.

  function initPlayer(vp) {
    var video = vp.querySelector('.vp__video');
    var seek = vp.querySelector('[data-role="seek"]');
    var volume = vp.querySelector('[data-role="volume"]');
    var seekFill = seek.querySelector('.vp-slider__fill');
    var volFill = volume.querySelector('.vp-slider__fill');
    var seekHead = seek.querySelector('.vp-slider__head');
    var volHead = volume.querySelector('.vp-slider__head');

    var lastVolume = 0.7; // remembered level for unmute

    // ── Source: pick portrait / landscape by viewport (optional) ───
    if (video.dataset.srcPortrait && video.dataset.srcLandscape) {
      var mq = window.matchMedia('(min-width: 981px)');
      var pickSource = function () {
        var src = mq.matches ? video.dataset.srcLandscape : video.dataset.srcPortrait;
        var current = (video.currentSrc || '').split('/').pop();
        if (current === src.split('/').pop()) return;
        var t = video.currentTime, playing = !video.paused;
        video.src = src;
        video.load();
        video.addEventListener('loadedmetadata', function once() {
          video.removeEventListener('loadedmetadata', once);
          try { video.currentTime = t; } catch (e) {}
          if (playing) video.play().catch(function () {});
        });
      };
      if (mq.addEventListener) mq.addEventListener('change', pickSource);
      pickSource();
    }

    // ── Play / pause ─────────────────────────────────────────────
    function toggle() {
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    }
    // Explicit buttons always toggle play/pause.
    vp.querySelectorAll('.vp__big, .vp__play').forEach(function (el) {
      el.addEventListener('click', toggle);
    });
    // Tapping the video surface: if controls are hidden (touch, no hover),
    // the first tap just reveals them; otherwise it toggles play/pause.
    vp.querySelector('.vp__hit').addEventListener('click', function () {
      if (vp.classList.contains('is-idle')) showControls();
      else toggle();
    });
    video.addEventListener('play', function () { vp.dataset.state = 'playing'; });
    video.addEventListener('pause', function () { vp.dataset.state = 'paused'; });

    // ── Auto-hide controls while playing; reveal on hover/move ──────
    var hideTimer;
    var HIDE_DELAY = 2500;
    function showControls() {
      vp.classList.remove('is-idle');
      clearTimeout(hideTimer);
      if (!video.paused) hideTimer = setTimeout(hideControls, HIDE_DELAY);
    }
    function hideControls() {
      if (!video.paused) vp.classList.add('is-idle');
    }
    vp.addEventListener('mousemove', showControls);
    vp.addEventListener('mouseenter', showControls);
    vp.addEventListener('mouseleave', hideControls);
    video.addEventListener('play', function () { hideTimer = setTimeout(hideControls, HIDE_DELAY); });
    video.addEventListener('pause', function () { clearTimeout(hideTimer); vp.classList.remove('is-idle'); });

    // ── Autoplay (muted): immediately, or once scrolled into view ──
    video.muted = true;
    vp.dataset.muted = 'true';

    var autoplayMode = vp.getAttribute('data-autoplay') || 'immediate';
    if (autoplayMode === 'scroll' && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            video.play().catch(function () {});
            observer.disconnect(); // one-shot: don't re-trigger on scroll back in/out
          }
        });
      }, { threshold: 0.5 });
      observer.observe(vp);
    } else {
      video.play().catch(function () { vp.dataset.state = 'paused'; });
    }

    // ── Mute toggle ──────────────────────────────────────────────
    vp.querySelectorAll('[data-role="mute"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        video.muted = !video.muted;
        if (!video.muted && video.volume === 0) {
          video.volume = lastVolume || 0.7;
        }
        syncVolumeUI();
      });
    });

    // ── Timeline ─────────────────────────────────────────────────
    video.addEventListener('timeupdate', function () {
      if (!video.duration) return;
      var pct = (video.currentTime / video.duration) * 100;
      seekFill.style.width = pct + '%';
      seekHead.style.left = pct + '%';
      seek.setAttribute('aria-valuenow', Math.round(pct));
    });

    // ── Shared slider drag logic ────────────────────────────────
    function ratioFromEvent(el, e, vertical) {
      var r = el.getBoundingClientRect();
      var point = (e.touches ? e.touches[0] : e);
      var v;
      if (vertical) v = 1 - (point.clientY - r.top) / r.height; // top = 1
      else v = (point.clientX - r.left) / r.width;
      return Math.min(1, Math.max(0, v));
    }

    function makeDraggable(el, vertical, onChange) {
      var dragging = false;
      function move(e) { onChange(ratioFromEvent(el, e, vertical)); }
      el.addEventListener('pointerdown', function (e) {
        dragging = true;
        el.classList.add('is-dragging');
        try { el.setPointerCapture(e.pointerId); } catch (err) {} // never let a capture failure abort the drag
        move(e);
      });
      el.addEventListener('pointermove', function (e) { if (dragging) move(e); });
      function end() { dragging = false; el.classList.remove('is-dragging'); }
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('keydown', function (e) {
        var step = 0.05, cur = vertical
          ? (video.muted ? 0 : video.volume)
          : (video.duration ? video.currentTime / video.duration : 0);
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { onChange(Math.min(1, cur + step)); e.preventDefault(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { onChange(Math.max(0, cur - step)); e.preventDefault(); }
      });
    }

    makeDraggable(seek, false, function (ratio) {
      if (video.duration) video.currentTime = ratio * video.duration;
    });

    makeDraggable(volume, true, function (ratio) {
      video.volume = ratio;
      lastVolume = ratio || lastVolume;
      video.muted = ratio === 0;
      syncVolumeUI();
    });

    function syncVolumeUI() {
      var level = video.muted ? 0 : video.volume;
      volFill.style.height = (level * 100) + '%';
      volHead.style.bottom = (level * 100) + '%';
      volume.setAttribute('aria-valuenow', Math.round(level * 100));
      vp.dataset.muted = video.muted ? 'true' : 'false';
    }

    video.volume = lastVolume;
    syncVolumeUI();
  }

  document.querySelectorAll('.vp').forEach(initPlayer);
})();
