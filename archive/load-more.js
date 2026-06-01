(function () {
  var PAGE_SIZE = 8;
  var grid = document.querySelector('.archive-grid');
  var btn = document.querySelector('.load-more-btn');
  if (!grid || !btn) return;

  var cards = Array.from(grid.querySelectorAll('.archive-card'));
  if (cards.length <= PAGE_SIZE) return;

  cards.slice(PAGE_SIZE).forEach(function (card) {
    card.classList.add('archive-card--more');
  });

  btn.addEventListener('click', function () {
    cards.forEach(function (card) {
      card.classList.remove('archive-card--more');
    });
    btn.style.display = 'none';
  });
})();
