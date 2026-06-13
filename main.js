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
