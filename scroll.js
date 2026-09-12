(function () {
  const scrollPanes = Array.from(document.querySelectorAll(".custom-scroll"));

  scrollPanes.forEach((pane) => {
    const host = pane.parentElement;

    if (!host) {
      return;
    }

    if (getComputedStyle(host).position === "static") {
      host.style.position = "relative";
    }

    const track = document.createElement("div");
    const thumb = document.createElement("div");

    track.className = "custom-scrollbar";
    thumb.className = "custom-scrollbar__thumb";
    track.appendChild(thumb);
    host.appendChild(track);

    let isDragging = false;
    let dragStartY = 0;
    let dragStartScrollTop = 0;

    const getMetrics = () => {
      const paneRect = pane.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      const scrollHeight = pane.scrollHeight;
      const clientHeight = pane.clientHeight;
      const maxScrollTop = Math.max(scrollHeight - clientHeight, 0);
      const trackHeight = paneRect.height;
      const thumbHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 48);
      const maxThumbTop = Math.max(trackHeight - thumbHeight, 0);

      return {
        top: paneRect.top - hostRect.top,
        height: trackHeight,
        thumbHeight,
        maxThumbTop,
        maxScrollTop,
      };
    };

    const update = () => {
      const metrics = getMetrics();

      track.hidden = metrics.maxScrollTop <= 1 || metrics.height <= 0;
      track.style.top = `${metrics.top}px`;
      track.style.height = `${metrics.height}px`;

      if (track.hidden) {
        return;
      }

      const scrollRatio = pane.scrollTop / metrics.maxScrollTop;
      const thumbTop = scrollRatio * metrics.maxThumbTop;

      thumb.style.height = `${metrics.thumbHeight}px`;
      thumb.style.transform = `translateY(${thumbTop}px)`;
    };

    const scrollToPointer = (clientY) => {
      const metrics = getMetrics();
      const trackRect = track.getBoundingClientRect();
      const targetThumbTop = clientY - trackRect.top - metrics.thumbHeight / 2;
      const clampedThumbTop = Math.max(0, Math.min(targetThumbTop, metrics.maxThumbTop));
      const ratio = metrics.maxThumbTop > 0 ? clampedThumbTop / metrics.maxThumbTop : 0;

      pane.scrollTop = ratio * metrics.maxScrollTop;
    };

    pane.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("load", update);

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(update);
      observer.observe(pane);
      observer.observe(host);
    }

    track.addEventListener("pointerdown", (event) => {
      if (event.target === thumb) {
        return;
      }

      scrollToPointer(event.clientY);
    });

    thumb.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      isDragging = true;
      dragStartY = event.clientY;
      dragStartScrollTop = pane.scrollTop;
      thumb.setPointerCapture(event.pointerId);
    });

    thumb.addEventListener("pointermove", (event) => {
      if (!isDragging) {
        return;
      }

      const metrics = getMetrics();
      const dragDelta = event.clientY - dragStartY;
      const scrollRatio = metrics.maxThumbTop > 0 ? dragDelta / metrics.maxThumbTop : 0;

      pane.scrollTop = dragStartScrollTop + scrollRatio * metrics.maxScrollTop;
    });

    thumb.addEventListener("pointerup", (event) => {
      isDragging = false;
      thumb.releasePointerCapture(event.pointerId);
    });

    update();
  });

  // Let the wheel scroll the content pane no matter where the cursor is on
  // the page (sidebar, margins, even the fake scrollbar track), not only
  // while hovering the pane itself. Desktop layout only: below 981px the
  // page already scrolls natively (body overflow-y:auto), so there's
  // nothing to redirect there.
  let lenis = null;

  if (scrollPanes.length === 1) {
    const pane = scrollPanes[0];
    const mq = window.matchMedia("(min-width: 981px)");

    // ── Smooth scroll (Lenis), desktop only ──
    // Animates the pane's own scrollTop with easing instead of jumping
    // straight to the wheel delta—Lenis wraps native scroll rather than
    // faking it with transforms, so the custom scrollbar's `scroll`
    // listener above keeps working unmodified. Requires the Lenis
    // script (loaded from a CDN in the page's own <head>/script
    // includes) to already be on the page; pages that haven't added it
    // yet just keep today's plain scroll—this guard is what makes it
    // safe to roll out one page at a time instead of everywhere at once.
    if (mq.matches && typeof window.Lenis === "function") {
      lenis = new window.Lenis({
        wrapper: pane,
        content: pane.firstElementChild,
        autoRaf: true,
      });
      // Exposed on the pane (not window) so a page-specific script can
      // pause/resume this exact instance—e.g. around a hand-rolled
      // scrollTop tween of its own, so Lenis's autoRaf loop isn't still
      // live and quietly resyncing/fighting the last few frames of it.
      pane.lenisInstance = lenis;
    }

    window.addEventListener(
      "wheel",
      (event) => {
        if (!mq.matches) return;
        // The archive preview overlay (single-image or the series
        // filmstrip) sits as a *sibling* of the pane, not inside it, so
        // pane.contains(event.target) never catches wheeling over it—this
        // global handler kept scrolling the dimmed background grid
        // underneath even with a photo open. Both preview modes add this
        // class on open (see openPreviewFor in archive/index.html).
        if (document.body.classList.contains("is-preview-open")) return;
        if (pane.contains(event.target)) return; // already over the pane: let native scroll run
        if (pane.scrollHeight <= pane.clientHeight) return; // nothing to scroll

        if (lenis) {
          // Forward the real wheel event onto the pane instead of
          // nudging a scrollTo target from the current scrollTop:
          // Lenis's own wheel listener (bound to the pane, not window)
          // never sees wheel events that start outside it, so this was
          // the only way to reach it—but scrollTo() by itself doesn't
          // build velocity across consecutive ticks the way Lenis's
          // native wheel handling does, so scrolling from outside the
          // pane felt visibly slower than scrolling directly over it.
          // Re-dispatching the same event lets Lenis process it with
          // the exact same physics either way.
          pane.dispatchEvent(new WheelEvent("wheel", event));
        } else {
          pane.scrollTop += event.deltaY;
        }
        event.preventDefault();
      },
      { passive: false }
    );
  }
})();
