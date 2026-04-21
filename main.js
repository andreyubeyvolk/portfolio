(function () {
  const copyButtons = Array.from(document.querySelectorAll("[data-copy-email]"));

  if (copyButtons.length === 0) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = "copy-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = "Email copied";
  document.body.appendChild(toast);

  let toastTimer = 0;

  const showToast = () => {
    window.clearTimeout(toastTimer);
    toast.classList.add("is-visible");

    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 1600);
  };

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
    button.addEventListener("click", async () => {
      const email = button.getAttribute("data-copy-email");

      if (!email) {
        return;
      }

      try {
        await copyText(email);
        showToast();
      } catch (error) {
        window.location.href = `mailto:${email}`;
      }
    });
  });
})();
