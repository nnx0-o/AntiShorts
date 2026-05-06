(() => {
  if (window.__antishortsContentScriptInstalled) {
    return;
  }

  window.__antishortsContentScriptInstalled = true;

  const extensionApi = globalThis.ANTISHORTS_getExtensionApi?.() || globalThis.browser || globalThis.chrome;
  const DEFAULT_SETTINGS = globalThis.ANTISHORTS_DEFAULT_SETTINGS || Object.freeze({
    hideHomeShortsShelf: true,
    hideWatchShortsShelves: true,
    lockShortsNavigation: true,
    hideShortsNavButtons: true,
    hideShortsPreviewGraphics: true
  });
  const BLOCK_EVENT_NAME = "antishorts:navigation-blocked";
  const HIDDEN_CLASS = "antishorts-hidden";
  const HIDDEN_REASON_PREFIX = "antishorts-hidden-";
  const LOCKED_CLASS = "antishorts-shorts-locked";
  const HIDE_NAV_BUTTONS_CLASS = "antishorts-hide-shorts-nav-buttons";
  const SHORTS_NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp"]);
  const SHORTS_PATH_RE = /^\/shorts\/([^/?#]+)/i;
  const ROUTE_EVENTS = ["yt-navigate-finish", "yt-page-data-updated", "popstate", "pageshow", "hashchange"];

  let mutationObserver = null;
  let sweepScheduled = false;
  let touchStartY = null;
  let lockedShortUrl = "";
  let settings = { ...DEFAULT_SETTINGS };

  function getReasonClass(reason) {
    return `${HIDDEN_REASON_PREFIX}${reason}`;
  }

  function setElementHidden(element, reason, shouldHide) {
    if (!element) {
      return;
    }

    const reasonClass = getReasonClass(reason);
    element.classList.toggle(reasonClass, shouldHide);

    const hasHiddenReason = Array.from(element.classList).some((className) => className.startsWith(HIDDEN_REASON_PREFIX));
    element.classList.toggle(HIDDEN_CLASS, hasHiddenReason);

    if (hasHiddenReason) {
      element.setAttribute("data-antishorts-hidden", "true");
      return;
    }

    element.removeAttribute("data-antishorts-hidden");
  }

  function clearHiddenReason(reason) {
    const selector = `.${getReasonClass(reason)}`;
    for (const element of document.querySelectorAll(selector)) {
      setElementHidden(element, reason, false);
    }
  }

  function getUrl(value = location.href) {
    try {
      return new URL(value, location.href);
    } catch {
      return null;
    }
  }

  function getShortId(value = location.href) {
    const url = getUrl(value);
    if (!url) {
      return "";
    }

    const match = SHORTS_PATH_RE.exec(url.pathname);
    return match ? match[1] : "";
  }

  function isShortsUrl(value = location.href) {
    return Boolean(getShortId(value));
  }

  function isHomeUrl(value = location.href) {
    const url = getUrl(value);
    return Boolean(url) && url.pathname === "/";
  }

  function isWatchUrl(value = location.href) {
    const url = getUrl(value);
    return Boolean(url) && url.pathname === "/watch";
  }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getSectionLabel(element) {
    const labelNode = element.querySelector("#title, #title-text, #header, h2, yt-formatted-string");
    return normalizeText(labelNode?.textContent || element.textContent || "");
  }

  function hasShortsLinks(element) {
    return Boolean(element.querySelector('a[href*="/shorts/"]'));
  }

  function pruneHomeShorts() {
    clearHiddenReason("home");

    for (const section of document.querySelectorAll("ytd-rich-section-renderer")) {
      if (getSectionLabel(section).startsWith("shorts") && hasShortsLinks(section)) {
        setElementHidden(section, "home", true);
      }
    }

    for (const shelf of document.querySelectorAll("ytd-rich-shelf-renderer")) {
      if (getSectionLabel(shelf).startsWith("shorts") && hasShortsLinks(shelf)) {
        setElementHidden(shelf.closest("ytd-rich-section-renderer") || shelf, "home", true);
      }
    }
  }

  function pruneWatchShorts() {
    clearHiddenReason("watch");

    for (const shelf of document.querySelectorAll("ytd-reel-shelf-renderer")) {
      setElementHidden(shelf.closest("ytd-item-section-renderer") || shelf, "watch", true);
    }
  }

  function pruneShortsSequencePreviews() {
    if (!isShortsUrl()) {
      return;
    }

    clearHiddenReason("preview");

    const sequenceNodes = Array.from(document.querySelectorAll(".reel-video-in-sequence-new"));

    for (const node of sequenceNodes) {
      const isCurrentSequenceNode = Boolean(
        node.querySelector("ytd-reel-video-renderer, ytd-player, video") || normalizeText(node.textContent).length > 0
      );

      setElementHidden(node, "preview", !isCurrentSequenceNode);

      for (const thumbnail of node.querySelectorAll(".reel-video-in-sequence-thumbnail")) {
        setElementHidden(thumbnail, "preview", !isCurrentSequenceNode);
      }
    }
  }

  function refreshRecommendations() {
    if (isHomeUrl() && settings.hideHomeShortsShelf) {
      pruneHomeShorts();
    } else {
      clearHiddenReason("home");
    }

    if (isWatchUrl() && settings.hideWatchShortsShelves) {
      pruneWatchShorts();
    } else {
      clearHiddenReason("watch");
    }

    if (isShortsUrl() && settings.hideShortsPreviewGraphics) {
      pruneShortsSequencePreviews();
    } else {
      clearHiddenReason("preview");
    }
  }

  function restoreShortsPosition() {
    if (!isShortsUrl()) {
      return;
    }

    const activeRenderer = document.querySelector(
      "ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[is-active-item], ytd-reel-video-renderer"
    );

    activeRenderer?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
  }

  function refreshRouteState() {
    const onShortsPage = isShortsUrl();
    const shouldLockShorts = onShortsPage && settings.lockShortsNavigation;
    const shouldHideNavButtons = onShortsPage && settings.hideShortsNavButtons;

    document.documentElement.classList.toggle(LOCKED_CLASS, shouldLockShorts);
    document.documentElement.classList.toggle(HIDE_NAV_BUTTONS_CLASS, shouldHideNavButtons);
    document.documentElement.dataset.antishortsLockNavigation = shouldLockShorts ? "true" : "false";

    if (onShortsPage) {
      if (shouldLockShorts) {
        lockedShortUrl = location.href;
        restoreShortsPosition();
      } else {
        lockedShortUrl = "";
      }

      if (settings.hideShortsPreviewGraphics) {
        pruneShortsSequencePreviews();
      } else {
        clearHiddenReason("preview");
      }

      return;
    }

    lockedShortUrl = "";
    touchStartY = null;
    clearHiddenReason("preview");
  }

  function scheduleSweep() {
    if (sweepScheduled) {
      return;
    }

    sweepScheduled = true;
    requestAnimationFrame(() => {
      sweepScheduled = false;
      refreshRouteState();
      refreshRecommendations();
    });
  }

  function observeDom() {
    if (mutationObserver || !document.documentElement) {
      return;
    }

    mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length || mutation.removedNodes.length) {
          scheduleSweep();
          return;
        }
      }
    });

    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function isEditableTarget(target) {
    return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName));
  }

  function isIgnoredInteractionTarget(target) {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          "tp-yt-paper-dialog, ytd-popup-container, ytd-engagement-panel-section-list-renderer, ytd-comment-view-model"
        )
      )
    );
  }

  function isInsideShortsViewport(target) {
    return (
      target instanceof Element &&
      Boolean(target.closest("ytd-shorts, ytd-reel-video-renderer, ytd-reel-player-overlay-renderer"))
    );
  }

  function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function handleNavButtonClick(event) {
    if (!isShortsUrl() || !settings.lockShortsNavigation) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const navButton = target.closest(
      "#navigation-button-down, #navigation-button-up, button[aria-label='Next video'], button[aria-label='Previous video']"
    );

    if (navButton) {
      stopEvent(event);
      restoreShortsPosition();
    }
  }

  function handleWheel(event) {
    if (!isShortsUrl() || !settings.lockShortsNavigation) {
      return;
    }

    if (Math.abs(event.deltaY) < 4) {
      return;
    }

    if (isIgnoredInteractionTarget(event.target) || !isInsideShortsViewport(event.target)) {
      return;
    }

    stopEvent(event);
    restoreShortsPosition();
  }

  function handleTouchStart(event) {
    if (!isShortsUrl() || !settings.lockShortsNavigation) {
      return;
    }

    touchStartY = event.touches[0]?.clientY ?? null;
  }

  function handleTouchMove(event) {
    if (!isShortsUrl() || !settings.lockShortsNavigation || touchStartY === null) {
      return;
    }

    if (isIgnoredInteractionTarget(event.target) || !isInsideShortsViewport(event.target)) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? touchStartY;
    if (Math.abs(currentY - touchStartY) < 12) {
      return;
    }

    stopEvent(event);
    restoreShortsPosition();
  }

  function handleTouchEnd() {
    touchStartY = null;
  }

  function handleKeydown(event) {
    if (!isShortsUrl() || !settings.lockShortsNavigation) {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) {
      return;
    }

    if (SHORTS_NAV_KEYS.has(event.key)) {
      stopEvent(event);
      restoreShortsPosition();
    }
  }

  function handleBlockedNavigation() {
    if (!settings.lockShortsNavigation) {
      return;
    }

    if (!lockedShortUrl) {
      lockedShortUrl = location.href;
    }

    if (lockedShortUrl && location.href !== lockedShortUrl) {
      history.replaceState(history.state, "", lockedShortUrl);
    }

    requestAnimationFrame(() => {
      restoreShortsPosition();
    });
  }

  function injectHistoryBridge() {
    if (document.documentElement?.dataset.antishortsBridge === "true") {
      return;
    }

    const script = document.createElement("script");
    script.textContent = `(() => {
      if (window.__antishortsHistoryBridgeInstalled) {
        return;
      }

      window.__antishortsHistoryBridgeInstalled = true;

      const eventName = ${JSON.stringify(BLOCK_EVENT_NAME)};
      const shortsPath = /^\\/shorts\\/([^/?#]+)/i;
      const getShortId = (input) => {
        try {
          const url = new URL(input == null ? location.href : String(input), location.href);
          const match = shortsPath.exec(url.pathname);
          return match ? match[1] : "";
        } catch {
          return "";
        }
      };

      const shouldBlock = (target) => {
        const lockEnabled = document.documentElement?.dataset.antishortsLockNavigation === "true";
        const currentId = getShortId(location.href);
        const nextId = getShortId(target);
        return Boolean(lockEnabled && currentId && nextId && currentId !== nextId);
      };

      const wrapHistoryMethod = (methodName) => {
        const original = history[methodName];
        if (typeof original !== "function") {
          return;
        }

        history[methodName] = function (...args) {
          const target = args[2];
          if (shouldBlock(target)) {
            window.dispatchEvent(
              new CustomEvent(eventName, {
                detail: {
                  method: methodName,
                  from: location.href,
                  to: String(target)
                }
              })
            );
            return undefined;
          }

          return original.apply(this, args);
        };
      };

      wrapHistoryMethod("pushState");
      wrapHistoryMethod("replaceState");
    })();`;

    (document.documentElement || document.head).prepend(script);
    script.remove();

    if (document.documentElement) {
      document.documentElement.dataset.antishortsBridge = "true";
    }
  }

  injectHistoryBridge();
  observeDom();

  async function loadSettings() {
    if (!extensionApi?.storage?.local) {
      settings = { ...DEFAULT_SETTINGS };
      scheduleSweep();
      return;
    }

    try {
      const stored = await extensionApi.storage.local.get(DEFAULT_SETTINGS);
      settings = { ...DEFAULT_SETTINGS, ...stored };
    } catch {
      settings = { ...DEFAULT_SETTINGS };
    }

    scheduleSweep();
  }

  if (extensionApi?.storage?.onChanged?.addListener) {
    extensionApi.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      let didChange = false;
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (!(key in changes)) {
          continue;
        }

        settings[key] = changes[key].newValue ?? DEFAULT_SETTINGS[key];
        didChange = true;
      }

      if (didChange) {
        scheduleSweep();
      }
    });
  }

  for (const eventName of ROUTE_EVENTS) {
    window.addEventListener(eventName, scheduleSweep, true);
  }

  window.addEventListener(BLOCK_EVENT_NAME, handleBlockedNavigation);
  document.addEventListener("click", handleNavButtonClick, true);
  window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
  window.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
  window.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false });
  window.addEventListener("touchend", handleTouchEnd, true);
  window.addEventListener("touchcancel", handleTouchEnd, true);
  window.addEventListener("keydown", handleKeydown, true);

  loadSettings();
  scheduleSweep();
})();