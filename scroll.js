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
  if (scrollPanes.length === 1) {
    const pane = scrollPanes[0];
    const mq = window.matchMedia("(min-width: 981px)");

    window.addEventListener(
      "wheel",
      (event) => {
        if (!mq.matches) return;
        if (pane.contains(event.target)) return; // already over the pane: let native scroll run
        if (pane.scrollHeight <= pane.clientHeight) return; // nothing to scroll

        pane.scrollTop += event.deltaY;
        event.preventDefault();
      },
      { passive: false }
    );
  }
})();
