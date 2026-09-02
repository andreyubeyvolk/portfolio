(function () {
  var grid = document.querySelector('.archive-grid');
  var btn = document.querySelector('.load-more-btn');
  if (!grid || !btn) return;

  // Batch size differs by breakpoint (24 cards/click on desktop+tablet,
  // 14 on phone)—matches mobile.css's own phone cutoff, since that's
  // where the archive grid's DOM/CSS actually diverges (phone swaps to
  // a flat swipe card system; tablet still renders the same grid as
  // desktop, just narrower). Decided once at load, not on resize—not
  // worth reacting live to a mid-browse window resize for this.
  var BATCH = window.matchMedia('(max-width: 640px)').matches ? 14 : 24;

  var cards = Array.from(grid.querySelectorAll('.archive-card'));
  if (cards.length <= BATCH) return;

  var shown = BATCH;

  function reveal() {
    cards.forEach(function (card, i) {
      card.classList.toggle('archive-card--more', i >= shown);
    });
    btn.style.display = shown >= cards.length ? 'none' : '';
  }

  reveal();

  btn.addEventListener('click', function () {
    shown += BATCH;
    reveal();
  });
})();
