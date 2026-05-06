(() => {
  const extensionApi = globalThis.ANTISHORTS_getExtensionApi?.() || globalThis.browser || globalThis.chrome;
  const defaultSettings = globalThis.ANTISHORTS_DEFAULT_SETTINGS || {};
  const settingFields = globalThis.ANTISHORTS_SETTING_FIELDS || [];
  const form = document.getElementById("settings-form");
  const status = document.getElementById("status");
  const resetButton = document.getElementById("reset-defaults");

  if (!form) {
    return;
  }

  buildForm();
  initialize().catch(() => {
    showStatus("Could not load extension settings.");
  });

  resetButton?.addEventListener("click", async () => {
    if (!extensionApi?.storage?.local) {
      showStatus("Extension storage is unavailable in this context.");
      return;
    }

    await extensionApi.storage.local.set({ ...defaultSettings });
    syncInputs(defaultSettings);
    showStatus("Reset to defaults.");
  });

  async function initialize() {
    if (!extensionApi?.storage?.local) {
      syncInputs(defaultSettings);
      showStatus("Open this file through the extension popup to save settings.");
      return;
    }

    const stored = await extensionApi.storage.local.get(defaultSettings);
    const merged = { ...defaultSettings, ...stored };
    syncInputs(merged);

    form.addEventListener("change", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
        return;
      }

      await extensionApi.storage.local.set({ [target.name]: target.checked });
      showStatus("Saved.");
    });
  }

  function buildForm() {
    for (const field of settingFields) {
      const label = document.createElement("label");
      label.className = "setting-card";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = field.key;
      input.id = field.key;

      const body = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = field.title;
      const description = document.createElement("p");
      description.textContent = field.description;

      body.append(title, description);
      label.append(input, body);
      form.append(label);
    }
  }

  function syncInputs(settings) {
    for (const field of settingFields) {
      const input = document.getElementById(field.key);
      if (input instanceof HTMLInputElement) {
        input.checked = Boolean(settings[field.key]);
      }
    }
  }

  function showStatus(message) {
    status.textContent = message;
    window.clearTimeout(showStatus.timeoutId);
    showStatus.timeoutId = window.setTimeout(() => {
      status.textContent = "";
    }, 1800);
  }
})();