(function () {
  // ── Download PDF — flash highlight on click ──
  const downloadBtns = Array.from(document.querySelectorAll(".download-pdf-btn"));

  downloadBtns.forEach((btn) => {
    let timer = 0;
    btn.addEventListener("click", () => {
      clearTimeout(timer);
      btn.classList.add("is-downloading");
      timer = setTimeout(() => btn.classList.remove("is-downloading"), 1600);
    });
  });
})();

(function () {
  const copyButtons = Array.from(document.querySelectorAll("[data-copy-email]"));

  if (copyButtons.length === 0) {
    return;
  }

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  copyButtons.forEach((button) => {
    let timer = 0;
    button.addEventListener("click", async () => {
      const email = button.getAttribute("data-copy-email");

      if (!email) {
        return;
      }

      try {
        await copyText(email);
        clearTimeout(timer);
        button.classList.add("is-copied");
        timer = setTimeout(() => button.classList.remove("is-copied"), 1600);
      } catch (error) {
        window.location.href = `mailto:${email}`;
      }
    });
  });
})();

(function () {
  // Project cards whose target page isn't built yet ship with href="#".
  // A live href="#" is a dead link: keyboard / screen-reader users focus it
  // and it scrolls to top instead of navigating. Neutralize those cards —
  // drop the href (removes them from the tab order and the link role) and
  // mark them aria-disabled. As soon as a real href is set, the card becomes
  // a working link again on its own, so there's nothing to undo per project.
  const pending = Array.from(
    document.querySelectorAll('a.inhouse-card[href="#"], a.brands-card[href="#"]')
  );

  pending.forEach((card) => {
    card.removeAttribute("href");
    card.setAttribute("aria-disabled", "true");
    card.classList.add("inhouse-card--pending");
  });
})();
