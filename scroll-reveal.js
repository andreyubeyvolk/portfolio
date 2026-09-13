// ── Scroll reveal: fades + rises gallery photos into view as the page
// scrolls, on both the desktop .project-content gallery and the mobile
// .mobile-project flat list. Shared across every project-template page
// (Brands and Inhouse). Observes every .pv-wide/.pv-pair__photo
// (desktop) and .mobile-project__photo (mobile)—excluding the cover
// (already on screen the instant the page loads, nothing to "reveal"
// itself from) plus, on desktop, the one real photo right after it
// (also already on/near screen on a wide viewport), and on mobile the
// first two real photos (a phone screen shows more of the top of the
// gallery than a desktop one does)—plus text on desktop only—About
// (.pv-row--about) and Challenge/Solution (.pv-info .pv-row)—and on
// mobile, .mobile-project__block. The Download/Next actions row
// (.pv-actions) isn't its own entry: it's a descendant of the Solution
// row, so it fades in together with that text. Text fades only, no
// rise, since --reveal-distance is zeroed on its container (see
// scroll-reveal.css). Once revealed, an item stays revealed (observer
// unwatches it). Desktop and mobile get separate observers since they
// watch different element sets.
(function () {
  // .project-content > .vp: a standalone full-audio video player
  // (as opposed to a silent .vp-bare clip nested in a pair)—only ovo
  // currently has one at the top level, but the selector is harmless
  // (empty match) on every page that doesn't. querySelectorAll always
  // returns matches in document order regardless of how many
  // comma-separated selectors were used, so slicing off the first one
  // here reliably means "whichever photo comes first," not
  // specifically a .pv-wide or a .pv-pair__photo. Desktop only skips
  // that first one (mobile skips the first two—see below); on desktop
  // even the second photo is usually still below the fold, so it gets
  // to animate in like the rest.
  var desktopPhotos = Array.prototype.slice.call(
    document.querySelectorAll('.project-content .pv-wide, .project-content .pv-pair__photo, .project-content > .vp')
  ).slice(1);
  // .pv-actions (Download/Next) is deliberately NOT its own entry
  // here—it's a descendant of the Solution .pv-row, which is
  // already observed below, so it fades in together with the
  // Solution text instead of waiting for its own (much later,
  // since it sits at the very bottom of a long block) trigger.
  var desktopText = Array.prototype.slice.call(document.querySelectorAll('.pv-row--about, .pv-info .pv-row'));
  var desktopItems = desktopPhotos.concat(desktopText);

  // Mobile keeps skipping the cover plus the first two real photos
  // (unlike desktop above, now back to just skipping one): a small
  // phone screen still has more of the top of the gallery in view at
  // load than a wide desktop viewport does. .mobile-project__photo
  // includes the cover itself (it's the same class, just first in
  // document order), so skipping 3 lands on "cover + first two real
  // photos."
  var mobilePhotos = Array.prototype.slice.call(document.querySelectorAll('.mobile-project__photo')).slice(3);
  var mobileBlocks = Array.prototype.slice.call(document.querySelectorAll('.mobile-project__blocks .mobile-project__block'));
  var mobileItems = mobilePhotos.concat(mobileBlocks);

  if (!desktopItems.length && !mobileItems.length) return;
  desktopItems.forEach(function (el) { el.classList.add('reveal'); });
  mobileItems.forEach(function (el) { el.classList.add('reveal'); });

  var DESKTOP_TRIGGER_PERCENT = 5;
  var MOBILE_TRIGGER_PERCENT = 5;

  // The bug this guards against: an early trigger point + a long
  // duration means the fade can finish *before* a loading="lazy"
  // image has actually fetched—so the item lands fully opaque and
  // "in position" while the image is still blank, showing the
  // host's #d3d3d3 placeholder background through it. Fix: don't
  // add is-revealed until the image is actually loaded (or errors,
  // so a broken image doesn't stay invisible forever).
  function revealCallback(entries, observer) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      var img = entry.target.querySelector('img');
      if (img && !img.complete) {
        var reveal = function () { entry.target.classList.add('is-revealed'); };
        img.addEventListener('load', reveal, { once: true });
        img.addEventListener('error', reveal, { once: true });
      } else {
        entry.target.classList.add('is-revealed');
      }
    });
  }

  var desktopObserver = new IntersectionObserver(revealCallback, {
    rootMargin: '0px 0px -' + DESKTOP_TRIGGER_PERCENT + '% 0px',
    threshold: 0
  });
  desktopItems.forEach(function (el) { desktopObserver.observe(el); });

  var mobileObserver = new IntersectionObserver(revealCallback, {
    rootMargin: '0px 0px -' + MOBILE_TRIGGER_PERCENT + '% 0px',
    threshold: 0
  });
  mobileItems.forEach(function (el) { mobileObserver.observe(el); });
})();
