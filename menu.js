(function () {
  var menuBtn = document.querySelector('.mobile-bar__menu');
  var overlay = document.getElementById('menu-overlay');
  var menu = document.getElementById('mobile-menu');
  var menuLinks = document.querySelectorAll('.menu-tabs a');

  // Closed by default: keep the hidden menu out of the tab order / a11y tree.
  // (clip-path + pointer-events hide it visually but leave links tabbable.)
  if (menu) menu.setAttribute('inert', '');

  // Focus order for the trap: the menu links, then the Close button (which
  // lives outside the panel, in the bottom bar). Tab cycles within this set.
  function focusables() {
    var list = Array.prototype.slice.call(menuLinks);
    if (menuBtn) list.push(menuBtn);
    return list;
  }

  // Mark the link that matches the current page as active
  if (menuLinks.length) {
    var currentPath = window.location.pathname.replace(/\/index\.html$/, '/');
    menuLinks.forEach(function (link) {
      try {
        var linkPath = new URL(link.href).pathname.replace(/\/index\.html$/, '/');
        if (currentPath.startsWith(linkPath)) {
          link.setAttribute('aria-current', 'page');
        }
      } catch (e) {}
    });
  }

  // Persist tap highlight while the page is loading
  menuLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      menuLinks.forEach(function (l) { l.classList.remove('is-tapped'); });
      link.classList.add('is-tapped');
    });
  });

  function open() {
    document.body.classList.add('menu-is-open');
    if (menu) menu.removeAttribute('inert');
    if (menuBtn) {
      menuBtn.textContent = 'Close';
      menuBtn.setAttribute('aria-expanded', 'true');
    }
    // Move focus into the dialog (first nav link).
    if (menuLinks.length) menuLinks[0].focus();
  }

  function close() {
    var wasOpen = document.body.classList.contains('menu-is-open');
    document.body.classList.remove('menu-is-open');
    if (menu) menu.setAttribute('inert', '');
    if (menuBtn) {
      menuBtn.textContent = 'Menu';
      menuBtn.setAttribute('aria-expanded', 'false');
      // Return focus to the trigger so keyboard users aren't dropped at the top.
      if (wasOpen) menuBtn.focus();
    }
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      document.body.classList.contains('menu-is-open') ? close() : open();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', close);
  }

  document.addEventListener('keydown', function (e) {
    if (!document.body.classList.contains('menu-is-open')) return;

    if (e.key === 'Escape') {
      close();
      return;
    }

    // Trap focus: keep Tab / Shift+Tab cycling within the menu + Close button.
    if (e.key === 'Tab') {
      var f = focusables();
      if (!f.length) return;
      var idx = f.indexOf(document.activeElement);
      if (e.shiftKey) {
        if (idx <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      } else if (idx === -1 || idx === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
    }
  });
})();
