(() => {
  const registry = {
    "sitemap-generator": "/assets/sitemap-generator.js",
  };
  const loadedScripts = new Map();

  function loadScript(src) {
    if (loadedScripts.has(src)) {
      return loadedScripts.get(src);
    }

    const existing = document.querySelector(
      `script[data-custom-element-src="${src}"]`,
    );

    if (existing) {
      const promise = new Promise((resolve, reject) => {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }

        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error(`Impossible de charger ${src}.`)),
          { once: true },
        );
      });

      loadedScripts.set(src, promise);
      return promise;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src = src;
      script.async = true;
      script.dataset.customElementSrc = src;
      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
          resolve();
        },
        { once: true },
      );
      script.addEventListener(
        "error",
        () => reject(new Error(`Impossible de charger ${src}.`)),
        { once: true },
      );
      document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
  }

  function ensureRegisteredElements(root = document) {
    for (const [tagName, src] of Object.entries(registry)) {
      if (!root.querySelector(tagName) || customElements.get(tagName)) {
        continue;
      }

      loadScript(src).catch((error) => {
        console.error("[custom-elements]", error);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => ensureRegisteredElements(),
      { once: true },
    );
  } else {
    ensureRegisteredElements();
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }

        ensureRegisteredElements(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
