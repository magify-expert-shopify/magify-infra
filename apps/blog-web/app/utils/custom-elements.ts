import {
  customElementAssetRegistry,
  type SupportedCustomElementTagName,
} from "~/constants/custom-elements";

const externalScriptLoaderCache = new Map<string, Promise<void>>();
const externalScriptCacheBuster = Date.now().toString();

function extractCustomElementTagNames(html: string) {
  const normalizedHtml = html.trim();

  if (!normalizedHtml) {
    return [];
  }

  const matches = normalizedHtml.matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]+)\b/gi);
  const tagNames = new Set<string>();

  for (const match of matches) {
    const tagName = match[1]?.toLowerCase().trim();

    if (tagName) {
      tagNames.add(tagName);
    }
  }

  return [...tagNames];
}

function resolveCustomElementAssetPaths(html: string) {
  return extractCustomElementTagNames(html)
    .map((tagName) => {
      const assetPath =
        customElementAssetRegistry[
          tagName as SupportedCustomElementTagName
        ] ?? null;

      if (!assetPath) {
        return null;
      }

      return {
        tagName,
        assetPath,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        tagName: string;
        assetPath: string;
      } => !!entry,
    );
}

async function loadExternalScript(src: string) {
  if (!import.meta.client) {
    return;
  }

  if (externalScriptLoaderCache.has(src)) {
    await externalScriptLoaderCache.get(src);
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[data-custom-element-src="${src}"]`,
  );

  if (existingScript) {
    const pendingPromise = new Promise<void>((resolve, reject) => {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), {
        once: true,
      });
      existingScript.addEventListener(
        "error",
        () => reject(new Error(`Impossible de charger ${src}.`)),
        {
          once: true,
        },
      );
    });

    externalScriptLoaderCache.set(src, pendingPromise);
    await pendingPromise;
    return;
  }

  const loadPromise = new Promise<void>((resolve, reject) => {
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

  externalScriptLoaderCache.set(src, loadPromise);
  await loadPromise;
}

function normalizeExternalScriptUrls(urls: string[]) {
  const normalizedUrls: string[] = [];
  const seenUrls = new Set<string>();

  for (const url of urls) {
    const trimmedUrl = url.trim();

    if (!trimmedUrl || seenUrls.has(trimmedUrl)) {
      continue;
    }

    seenUrls.add(trimmedUrl);
    normalizedUrls.push(trimmedUrl);
  }

  return normalizedUrls;
}

function appendCacheBuster(url: string, version: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return trimmedUrl;
  }

  const hashIndex = trimmedUrl.indexOf('#');
  const hash = hashIndex >= 0 ? trimmedUrl.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? trimmedUrl.slice(0, hashIndex) : trimmedUrl;
  const separator = withoutHash.includes('?') ? '&' : '?';

  return `${withoutHash}${separator}v=${version}${hash}`;
}

export async function ensureCustomElementsLoadedForHtml(html: string) {
  if (!import.meta.client) {
    return;
  }

  const entries = resolveCustomElementAssetPaths(html);

  for (const entry of entries) {
    if (window.customElements.get(entry.tagName)) {
      continue;
    }

    await loadExternalScript(entry.assetPath);
  }
}

export async function ensureExternalScriptsLoaded(urls: string[]) {
  if (!import.meta.client) {
    return;
  }

  for (const url of normalizeExternalScriptUrls(urls)) {
    await loadExternalScript(appendCacheBuster(url, externalScriptCacheBuster));
  }
}

export function buildStorefrontCustomElementLoaderSnippet() {
  return `(() => {
  const registry = ${JSON.stringify(customElementAssetRegistry, null, 2)};
  const loadedScripts = new Map();

  function loadScript(src) {
    if (loadedScripts.has(src)) {
      return loadedScripts.get(src);
    }

    const existing = document.querySelector(\`script[data-custom-element-src="\${src}"]\`);

    if (existing) {
      const promise = new Promise((resolve, reject) => {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }

        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(\`Impossible de charger \${src}.\`)), { once: true });
      });

      loadedScripts.set(src, promise);
      return promise;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.customElementSrc = src;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(\`Impossible de charger \${src}.\`)), { once: true });
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
    document.addEventListener("DOMContentLoaded", () => ensureRegisteredElements(), { once: true });
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
})();`;
}
