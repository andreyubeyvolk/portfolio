(function () {
  // Tap/click info button + sliding caption bar, for photos/videos that
  // need a short attribution or note. Works identically on desktop click
  // and mobile tap (unlike a cursor-follow hover tooltip, which is simply
  // invisible on touch devices).
  //
  // Markup: `<div class="info-note" data-note="Short one-line text">`
  // wrapping the photo/video—host must already be position:relative +
  // overflow:hidden (every .pv-cover/.pv-wide/.pv-pair__photo gallery slot
  // already is). This script builds the toggle button + sliding panel and
  // appends them; nothing else to hand-write per instance.
  //
  // data-note max length: 48 characters. The panel is a single line with
  // no wrap (text-overflow: ellipsis)—48 is the safe ceiling that still
  // fits on the narrowest slot this pattern is used on (a mobile portrait
  // .pv-pair__photo, ~343px wide) without truncating. No period at the
  // end if the note is a single sentence.
  // A standalone bare video (not already inside a .pv-cover/.pv-wide/
  // .pv-pair__photo box with its own fixed aspect-ratio) sizes itself via
  // the browser's normal height:auto flow, which can round to a
  // sub-pixel value slightly off from the host's own box—so the bar,
  // pinned to the host's bottom edge, can end up a hairline below the
  // video's actual painted edge. Fix: give the host an explicit
  // aspect-ratio (from the video's real dimensions) and absolutely
  // position the video inside it with the same 1px overscan used by
  // every other video-in-a-box on the site, so bar and video always
  // share the exact same bottom edge regardless of rounding.
  //
  // This reads the video's width/height HTML attributes (not
  // videoWidth/videoHeight, which stay 0 until the browser has actually
  // fetched metadata over the network). Applying it synchronously off
  // the attributes—rather than waiting for a loadedmetadata event that
  // can fire mid-scroll—avoids a real layout jump: an earlier version
  // waited for loadedmetadata, so the host sat at a default ~2:1 video
  // box until metadata arrived, then snapped to its true aspect ratio,
  // visibly jolting the page if that happened while the video was
  // scrolling into view. So: every standalone bare video must carry
  // width/height attributes matching its real pixel size (same as any
  // <img>) for this to work—there's nothing to fall back on otherwise.
  function fixBareVideoEdge(host) {
    if (host.classList.contains('pv-cover') || host.classList.contains('pv-wide') || host.classList.contains('pv-pair__photo')) return;
    var video = host.querySelector(':scope > video.vp-bare');
    if (!video) return;

    var w = video.width;
    var h = video.height;
    if (!w || !h) return;

    host.style.aspectRatio = w + ' / ' + h;
    video.style.position = 'absolute';
    video.style.inset = '-1px';
    video.style.width = 'calc(100% + 2px)';
    video.style.height = 'calc(100% + 2px)';
    video.style.objectFit = 'cover';
  }

  document.querySelectorAll('.info-note[data-note]').forEach(function (host) {
    var text = host.getAttribute('data-note');
    if (!text) return;

    fixBareVideoEdge(host);

    var bar = document.createElement('div');
    bar.className = 'info-note__bar';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'info-note__toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'More info');

    var icon = document.createElement('span');
    icon.className = 'info-note__icon';
    icon.textContent = 'i';
    btn.appendChild(icon);

    var panel = document.createElement('div');
    panel.className = 'info-note__panel';
    var textEl = document.createElement('span');
    textEl.className = 'info-note__text';
    textEl.textContent = text;
    panel.appendChild(textEl);

    bar.appendChild(btn);
    bar.appendChild(panel);
    host.appendChild(bar);

    var AUTO_CLOSE_MS = 10000;
    var closeTimer = null;

    function open() {
      host.classList.add('is-note-open');
      btn.setAttribute('aria-expanded', 'true');
      icon.textContent = 'X';
      clearTimeout(closeTimer);
      closeTimer = setTimeout(close, AUTO_CLOSE_MS);
    }
    function close() {
      host.classList.remove('is-note-open');
      btn.setAttribute('aria-expanded', 'false');
      icon.textContent = 'i';
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (host.classList.contains('is-note-open')) close();
      else open();
    });

    // Auto-close once the card scrolls out of view, so an open panel never
    // sits waiting out its own 10s timer somewhere off-screen, then pops
    // shut the moment it's scrolled back into view.
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) close();
        });
      }, { threshold: 0 });
      observer.observe(host);
    }
  });
})();
