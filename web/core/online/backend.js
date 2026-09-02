(function () {
  const DEFAULT_ONLINE_API_BASE_URL = 'https://demos.lyokodev.com/api';

  // In-memory token cache — set immediately on login/register so onlineFetch
  // never depends on a localStorage round-trip completing first.
  let _ephemeralToken = '';
  function setEphemeralToken(token) { _ephemeralToken = String(token || ''); }
  function clearEphemeralToken() { _ephemeralToken = ''; }
  const STRINGS = {
    es: {
      configured: 'Funciones online disponibles',
      notConfigured: 'Funciones online no disponibles',
      configureFirst: 'Las funciones online no están disponibles ahora mismo',
      responded: 'Las funciones online respondieron con',
    },
    en: {
      configured: 'Online service ready',
      notConfigured: 'Online service unavailable',
      configureFirst: 'The online service is not available right now',
      responded: 'The online service responded with',
    },
  };

  function strings(lang) {
    return STRINGS[lang] || STRINGS.en;
  }

  function getOnlineApiBaseUrl(cfg) {
    const configured = String(cfg?.onlineApiBaseUrl || '').trim().replace(/\/+$/,'');
    return configured || DEFAULT_ONLINE_API_BASE_URL;
  }

  function hasOnlineBackendConfigured(cfg) {
    return !!getOnlineApiBaseUrl(cfg);
  }

  function getOnlineBackendStateLabel(cfg, lang = 'en') {
    const s = strings(lang);
    return hasOnlineBackendConfigured(cfg) ? s.configured : s.notConfigured;
  }

  async function parseErrorDetail(response) {
    try {
      const data = await response.json();
      return data?.error || data?.message || '';
    } catch {
      return '';
    }
  }

  async function onlineFetch(path, options = {}, deps) {
    const {
      loadConfig,
      loadOnlineAccount,
      loadOnlineSession,
      lang = 'en',
    } = deps;
    const s = strings(lang);
    const baseUrl = getOnlineApiBaseUrl(loadConfig());
    if (!baseUrl) throw new Error(s.configureFirst);
    const account = loadOnlineAccount();
    const session = loadOnlineSession();
    const effectiveToken = _ephemeralToken || session?.authToken || '';
    const headers = {
      'Content-Type': 'application/json',
      'X-Atria-Online-Device': session?.deviceName || '',
      ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {
        'X-Atria-Online-Email': account?.email || '',
      }),
      ...(options.headers || {}),
    };
    const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new Error(detail || `${s.responded} ${res.status}`);
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    return res.json();
  }

  async function onlineAuthFetch(path, payload, deps) {
    const { loadConfig, lang = 'en' } = deps;
    const s = strings(lang);
    const baseUrl = getOnlineApiBaseUrl(loadConfig());
    if (!baseUrl) throw new Error(s.configureFirst);
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new Error(detail || `${s.responded} ${res.status}`);
    }
    return res.json();
  }

  window.AtriaOnlineBackend = {
    getOnlineApiBaseUrl,
    hasOnlineBackendConfigured,
    getOnlineBackendStateLabel,
    onlineFetch,
    onlineAuthFetch,
    setEphemeralToken,
    clearEphemeralToken,
  };
})();
