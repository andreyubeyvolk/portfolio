(function () {
  var grid = document.querySelector('.archive-grid');
  var btn = document.querySelector('.load-more-btn');
  if (!grid || !btn) return;

  // Batch size differs by breakpoint (28 cards/click on desktop+tablet,
  // 20 on phone)—matches mobile.css's own phone cutoff, since that's
  // where the archive grid's DOM/CSS actually diverges (phone swaps to
  // a flat swipe card system; tablet still renders the same grid as
  // desktop, just narrower). Decided once at load, not on resize—not
  // worth reacting live to a mid-browse window resize for this.
  var BATCH = window.matchMedia('(max-width: 640px)').matches ? 20 : 28;

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
    var incoming = cards.slice(shown, shown + BATCH);
    shown += BATCH;

    // Fade the newly-revealed batch in instead of popping it in
    // instantly: mark it as still-fading (opacity:0) before dropping
    // the display:none that was hiding it, then clear that mark a
    // couple frames later so the opacity:1 transition on .archive-card
    // has something to animate from. Doing both in the same tick would
    // just paint the final state directly, with nothing to fade.
    incoming.forEach(function (card) { card.classList.add('archive-card--revealing'); });
    reveal();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        incoming.forEach(function (card) { card.classList.remove('archive-card--revealing'); });
      });
    });
  });
})();
