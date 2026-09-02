(function () {
  const ONLINE_ACCOUNT_KEY = 'tid_online_account';
  const ONLINE_SESSION_KEY = 'tid_online_session';
  const ONLINE_DEVICES_CACHE_KEY = 'tid_online_devices_cache';
  const ONLINE_KEYPAIR_KEY = 'tid_online_keypair';
  const ONLINE_AUTH_LOCK_KEY = 'tid_online_auth_lock';
  const ONLINE_SESSION_TTL_MS = 1000 * 60 * 60 * 12;

  function readStoredJson(storage, key, fallback) {
    try {
      const raw = storage?.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function writeStoredJson(storage, key, value) {
    if (!storage) return;
    storage.setItem(key, JSON.stringify(value));
  }

  function removeStoredKey(key) {
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(key); } catch {}
  }

  function lockOnlineAccess() {
    try { localStorage.setItem(ONLINE_AUTH_LOCK_KEY, '1'); } catch {}
  }

  function unlockOnlineAccess() {
    try { localStorage.removeItem(ONLINE_AUTH_LOCK_KEY); } catch {}
  }

  function isOnlineAccessLocked() {
    try { return localStorage.getItem(ONLINE_AUTH_LOCK_KEY) === '1'; }
    catch { return false; }
  }

  function getSessionPersistence(loadConfig) {
    const cfg = typeof loadConfig === 'function'
      ? loadConfig()
      : (window.AtriaStorage?.loadConfig ? window.AtriaStorage.loadConfig({}) : {});
    return cfg?.onlineSessionPersistence === 'session' ? 'session' : 'local';
  }

  function preferredStorage(loadConfig) {
    return getSessionPersistence(loadConfig) === 'session' ? sessionStorage : localStorage;
  }

  function randomFromAlphabet(alphabet, length) {
    const chars = [];
    const arr = new Uint32Array(length);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(arr);
    else for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 0xffffffff);
    for (let i = 0; i < length; i++) chars.push(alphabet[arr[i] % alphabet.length]);
    return chars.join('');
  }

  function formatOnlineFriendCode(digits) {
    const clean = String(digits || '').replace(/\D+/g, '').slice(0, 12);
    if (clean.length !== 12) return '';
    return `ATRIA-${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
  }

  function normalizeOnlineFriendCode(value) {
    return formatOnlineFriendCode(value);
  }

  function generateOnlineFriendCode() {
    return formatOnlineFriendCode(randomFromAlphabet('0123456789', 12));
  }

  function buildOnlineFriendCode(value) {
    return normalizeOnlineFriendCode(value) || generateOnlineFriendCode();
  }

  function normalizeOnlineSystemId(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 20);
  }

  function generateOnlineSystemId() {
    return randomFromAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 16);
  }

  function buildOnlineSystemId(cfg) {
    return normalizeOnlineSystemId(cfg?.onlineSystemId || '');
  }

  function getOnlineProfile(cfg, options = {}) {
    const enabled = !!cfg.onlineEnabled;
    const defaultDeviceName = options.defaultDeviceName || 'This device';
    return {
      enabled,
      consentAt: cfg.onlineConsentAt || null,
      email: cfg.onlineAccountEmail || '',
      systemId: buildOnlineSystemId(cfg),
      friendCode: normalizeOnlineFriendCode(cfg.onlineFriendCode || ''),
      deviceId: cfg.onlineDeviceId || null,
      deviceName: cfg.onlineDeviceName || cfg.systemName || defaultDeviceName,
      fronting: !!cfg.onlineFrontingEnabled,
      autoBackup: cfg.onlineAutoBackup !== false,
      syncImplicit: enabled,
      lastAuthAt: cfg.onlineLastAuthAt || null,
    };
  }

  function loadOnlineAccount(loadConfig) {
    const saved = readStoredJson(sessionStorage, ONLINE_ACCOUNT_KEY, null) ?? readStoredJson(localStorage, ONLINE_ACCOUNT_KEY, null);
    if (saved && typeof saved === 'object') return saved;
    const cfg = loadConfig();
    if (!cfg.onlineAccountEmail) return null;
    return {
      id: cfg.onlineAccountId || null,
      email: cfg.onlineAccountEmail,
      systemId: buildOnlineSystemId(cfg),
      friendCode: normalizeOnlineFriendCode(cfg.onlineFriendCode || ''),
      displayName: cfg.onlineDisplayName || cfg.systemName || normalizeOnlineFriendCode(cfg.onlineFriendCode || '') || buildOnlineSystemId(cfg),
      crypto: cfg.onlineAccountCrypto || null,
      consentAt: cfg.onlineConsentAt || null,
      createdAt: cfg.onlineConsentAt || cfg.onlineLastAuthAt || null,
    };
  }

  function saveOnlineAccount(account, loadConfig, saveConfig) {
    removeStoredKey(ONLINE_ACCOUNT_KEY);
    if (account) writeStoredJson(preferredStorage(loadConfig), ONLINE_ACCOUNT_KEY, account);
    const cfg = loadConfig();
    saveConfig({
      ...cfg,
      onlineAccountCrypto: account?.crypto || null,
      onlineFriendCode: normalizeOnlineFriendCode(account?.friendCode || cfg.onlineFriendCode || ''),
    });
  }

  function loadOnlineSession(loadConfig, options = {}) {
    const saved = readStoredJson(sessionStorage, ONLINE_SESSION_KEY, null) ?? readStoredJson(localStorage, ONLINE_SESSION_KEY, null);
    if (saved && typeof saved === 'object') return saved;
    const cfg = loadConfig();
    if (!cfg.onlineEnabled) return null;
    const defaultDeviceName = options.defaultDeviceName || 'This device';
    return {
      accountId: cfg.onlineAccountId || null,
      email: cfg.onlineAccountEmail || '',
      systemId: buildOnlineSystemId(cfg),
      friendCode: normalizeOnlineFriendCode(cfg.onlineFriendCode || ''),
      deviceName: cfg.onlineDeviceName || cfg.systemName || defaultDeviceName,
      lastAuthAt: cfg.onlineLastAuthAt || null,
      frontingEnabled: !!cfg.onlineFrontingEnabled,
      autoBackup: cfg.onlineAutoBackup !== false,
      authToken: cfg.onlineAuthToken || '',
    };
  }

  function saveOnlineSession(session, loadConfig = null) {
    removeStoredKey(ONLINE_SESSION_KEY);
    if (session) writeStoredJson(preferredStorage(loadConfig), ONLINE_SESSION_KEY, session);
  }

  function loadOnlineKeypair() {
    const saved = window.AtriaStorage.parseJsonKey(ONLINE_KEYPAIR_KEY, null);
    return saved && typeof saved === 'object' ? saved : null;
  }

  function saveOnlineKeypair(keypair) {
    if (!keypair) localStorage.removeItem(ONLINE_KEYPAIR_KEY);
    else window.AtriaStorage.writeJsonKey(ONLINE_KEYPAIR_KEY, keypair);
  }

  function loadOnlineDevicesCache() {
    const saved = window.AtriaStorage.parseJsonKey(ONLINE_DEVICES_CACHE_KEY, []);
    return Array.isArray(saved) ? saved : [];
  }

  function saveOnlineDevicesCache(devices) {
    window.AtriaStorage.writeJsonKey(ONLINE_DEVICES_CACHE_KEY, Array.isArray(devices) ? devices : []);
  }

  function saveOnlineDeviceCache(devices) {
    return saveOnlineDevicesCache(devices);
  }

  function upsertOnlineDevice(deviceName, email, systemId) {
    const devices = loadOnlineDevicesCache();
    const id = `local-${systemId}-${deviceName}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const now = new Date().toISOString();
    const existing = devices.find(d => d.id === id);
    if (existing) {
      existing.name = deviceName;
      existing.email = email;
      existing.systemId = systemId;
      existing.lastAuthAt = now;
    } else {
      devices.unshift({ id, name: deviceName, email, systemId, lastAuthAt: now, current: true });
    }
    devices.forEach(d => { d.current = d.id === id; });
    saveOnlineDevicesCache(devices.slice(0, 12));
  }

  function activateOnlineAccountSession(params, deps) {
    const {
      accountId = null,
      email,
      systemId = '',
      displayName = '',
      deviceName,
      consentAt,
      frontingEnabled = false,
      autoBackup = true,
      authToken = '',
      devices = null,
      keypair = null,
      accountCrypto = null,
      friendCode = '',
      deviceId = null,
      rememberSession = true,
      sessionTtlMs = ONLINE_SESSION_TTL_MS,
    } = params || {};
    const { loadConfig, saveConfig, hasOnlineBackendConfigured, startOnlineSyncLoop, stopOnlineSyncLoop } = deps;
    const baseCfg = loadConfig();
    const resolvedSystemId = normalizeOnlineSystemId(systemId || baseCfg.onlineSystemId || '') || generateOnlineSystemId();
    const resolvedFriendCode = normalizeOnlineFriendCode(friendCode || baseCfg.onlineFriendCode || '') || generateOnlineFriendCode();
    const now = new Date().toISOString();
    const nextCfg = {
      ...baseCfg,
      onlineEnabled: true,
      onlineConsentAt: consentAt || baseCfg.onlineConsentAt || now,
      onlineAccountEmail: email,
      onlineDeviceName: deviceName,
      onlineSystemId: resolvedSystemId,
      onlineAccountId: accountId,
      onlineDisplayName: displayName || baseCfg.onlineDisplayName || baseCfg.systemName || resolvedFriendCode,
      onlineFriendCode: resolvedFriendCode,
      onlineDeviceId: deviceId || baseCfg.onlineDeviceId || null,
      onlineAuthToken: authToken || baseCfg.onlineAuthToken || '',
      onlineSessionPersistence: rememberSession === false ? 'session' : 'local',
      onlineRememberSession: rememberSession !== false,
      onlineSessionExpiresAt: rememberSession === false ? new Date(Date.now() + sessionTtlMs).toISOString() : null,
      onlineAutoBackup: autoBackup,
      onlineFrontingEnabled: frontingEnabled,
      onlineLastAuthAt: now,
    };
    saveConfig(nextCfg);
    saveOnlineAccount({
      id: accountId,
      email,
      systemId: resolvedSystemId,
      friendCode: nextCfg.onlineFriendCode,
      displayName: displayName || baseCfg.systemName || resolvedFriendCode,
      crypto: accountCrypto || null,
      consentAt: nextCfg.onlineConsentAt,
      createdAt: loadOnlineAccount(loadConfig)?.createdAt || now,
    }, loadConfig, saveConfig);
    saveOnlineSession({
      accountId,
      email,
      systemId: resolvedSystemId,
      friendCode: nextCfg.onlineFriendCode,
      deviceId: nextCfg.onlineDeviceId,
      deviceName,
      lastAuthAt: now,
      frontingEnabled,
      autoBackup,
      authToken: authToken || '',
    }, loadConfig);
    if (keypair) saveOnlineKeypair(keypair);
    if (Array.isArray(devices) && devices.length) saveOnlineDevicesCache(devices);
    else upsertOnlineDevice(deviceName, email, resolvedSystemId);
    if (hasOnlineBackendConfigured && hasOnlineBackendConfigured(nextCfg) && typeof startOnlineSyncLoop === 'function') {
      if (typeof stopOnlineSyncLoop === 'function') stopOnlineSyncLoop();
      startOnlineSyncLoop();
    }
    unlockOnlineAccess();
    return nextCfg;
  }

  function disableOnlineAccountSession(deps) {
    const { loadConfig, saveConfig, stopOnlineSyncLoop } = deps;
    const current = loadConfig();
    saveConfig({ ...current, onlineEnabled: false, onlineFrontingEnabled: false, onlineAuthToken: '', onlineAccountId: null, onlineRememberSession: true, onlineSessionPersistence: 'local', onlineSessionExpiresAt: null });
    saveOnlineSession(null);
    saveOnlineKeypair(null);
    saveOnlineAccount(null, loadConfig, saveConfig);
    localStorage.removeItem('tid_online_backup_status');
    localStorage.removeItem('tid_online_backup_secret');
    lockOnlineAccess();
    if (typeof window !== 'undefined' && window.AtriaOnlineBackend?.clearEphemeralToken) {
      window.AtriaOnlineBackend.clearEphemeralToken();
    }
    if (typeof stopOnlineSyncLoop === 'function') stopOnlineSyncLoop();
  }

  window.AtriaOnlineAccount = {
    keys: {
      ONLINE_ACCOUNT_KEY,
      ONLINE_SESSION_KEY,
      ONLINE_DEVICES_CACHE_KEY,
      ONLINE_KEYPAIR_KEY,
    },
    normalizeOnlineSystemId,
    generateOnlineSystemId,
    normalizeOnlineFriendCode,
    buildOnlineSystemId,
    buildOnlineFriendCode,
    generateOnlineFriendCode,
    formatOnlineFriendCode,
    getOnlineProfile,
    loadOnlineAccount,
    saveOnlineAccount,
    loadOnlineSession,
    saveOnlineSession,
    loadOnlineKeypair,
    saveOnlineKeypair,
    loadOnlineDevicesCache,
    saveOnlineDevicesCache,
    saveOnlineDeviceCache,
    upsertOnlineDevice,
    activateOnlineAccountSession,
    disableOnlineAccountSession,
    lockOnlineAccess,
    unlockOnlineAccess,
    isOnlineAccessLocked,
  };
})();
