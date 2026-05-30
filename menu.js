(function () {
  var menuBtn = document.querySelector('.mobile-bar__menu');
  var overlay = document.getElementById('menu-overlay');

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
