(function () {
  function storageKey(activeAlter, section) {
    const alterId = activeAlter && activeAlter.id;
    if (!alterId) return `tid_unknown_${section}`;
    return `tid_${alterId}_${section}`;
  }

  function loadSection(activeAlter, section, fallback = []) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(activeAlter, section))) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveSection(activeAlter, section, data) {
    localStorage.setItem(storageKey(activeAlter, section), JSON.stringify(data));
  }

  function parseJsonKey(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJsonKey(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadConfig(defaults = {}) {
    const saved = parseJsonKey('tid_config', {});
    const config = Object.assign({}, defaults, saved || {});
    if (typeof config.onlineApiBaseUrl === 'string') {
      const trimmed = config.onlineApiBaseUrl.trim();
      const defaultUrl = typeof defaults.onlineApiBaseUrl === 'string' ? defaults.onlineApiBaseUrl.trim() : '';
      config.onlineApiBaseUrl = trimmed || defaultUrl;
    }
    return config;
  }

  function saveConfig(config) {
    writeJsonKey('tid_config', config || {});
  }

  window.AtriaStorage = {
    storageKey,
    loadSection,
    saveSection,
    parseJsonKey,
    writeJsonKey,
    loadConfig,
    saveConfig,
  };
})();
