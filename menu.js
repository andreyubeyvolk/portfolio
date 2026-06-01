(function () {
  var menuBtn = document.querySelector('.mobile-bar__menu');
  var overlay = document.getElementById('menu-overlay');
  var menuLinks = document.querySelectorAll('.menu-tabs a');

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
    if (menuBtn) {
      menuBtn.textContent = 'Close';
      menuBtn.setAttribute('aria-expanded', 'true');
    }
  }

  function close() {
    document.body.classList.remove('menu-is-open');
    if (menuBtn) {
      menuBtn.textContent = 'Menu';
      menuBtn.setAttribute('aria-expanded', 'false');
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
    if (e.key === 'Escape') close();
  });
})();
