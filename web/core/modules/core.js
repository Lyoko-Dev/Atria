(function (global) {
  'use strict';

  function registerViews(target, definitions) {
    const routes = target || Object.create(null);
    Object.entries(definitions || {}).forEach(([name, renderer]) => {
      if (typeof renderer === 'function') routes[name] = renderer;
    });
    Object.defineProperties(routes, {
      register: { value(name, renderer) { if (typeof renderer === 'function') routes[name] = renderer; return routes; } },
      resolve: { value(name) { return routes[name]; } },
      keys: { value() { return Object.keys(routes); } },
    });
    return routes;
  }

  function readJSON(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch (_) { return fallback; }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  global.AtriaCore = Object.freeze({ registerViews, readJSON, writeJSON });
})(window);
