(() => {
  if (globalThis.ANTISHORTS_DEFAULT_SETTINGS) {
    return;
  }

  const DEFAULT_SETTINGS = Object.freeze({
    hideHomeShortsShelf: true,
    hideWatchShortsShelves: true,
    lockShortsNavigation: true,
    hideShortsNavButtons: true,
    hideShortsPreviewGraphics: true
  });

  const SETTING_FIELDS = Object.freeze([
    {
      key: "hideHomeShortsShelf",
      title: "Hide homepage Shorts shelves",
      description: "Removes Shorts shelves from the logged-in YouTube homepage."
    },
    {
      key: "hideWatchShortsShelves",
      title: "Hide watch-page Shorts shelves",
      description: "Removes Shorts recommendation shelves from standard /watch pages."
    },
    {
      key: "lockShortsNavigation",
      title: "Lock Shorts navigation",
      description: "Blocks moving from the current Short to another one through YouTube's in-app Shorts viewer."
    },
    {
      key: "hideShortsNavButtons",
      title: "Hide Shorts navigation buttons",
      description: "Hides the visible up/down navigation buttons in the Shorts viewer."
    },
    {
      key: "hideShortsPreviewGraphics",
      title: "Hide Shorts preview graphics",
      description: "Removes the generated preview placeholders and thumbnails for queued Shorts."
    }
  ]);

  function getExtensionApi() {
    return globalThis.browser || globalThis.chrome || null;
  }

  globalThis.ANTISHORTS_DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  globalThis.ANTISHORTS_SETTING_FIELDS = SETTING_FIELDS;
  globalThis.ANTISHORTS_getExtensionApi = getExtensionApi;
})();