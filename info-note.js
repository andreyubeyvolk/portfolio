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
  document.querySelectorAll('.info-note[data-note]').forEach(function (host) {
    var text = host.getAttribute('data-note');
    if (!text) return;

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
