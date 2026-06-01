(function () {
  var PAGE_SIZE = 8;
  var grid = document.querySelector('.inhouse-grid');
  var btn = document.querySelector('.load-more-btn');
  if (!grid || !btn) return;

  var cards = Array.from(grid.querySelectorAll('.inhouse-card'));
  if (cards.length <= PAGE_SIZE) return;

  cards.slice(PAGE_SIZE).forEach(function (card) {
    card.classList.add('inhouse-card--more');
  });

  btn.addEventListener('click', function () {
    cards.forEach(function (card) {
      card.classList.remove('inhouse-card--more');
    });
    btn.style.display = 'none';
  });
})();
