(function () {
  const I18N = {
    es: {
      localShort: 'Solo local',
      localTitle: 'Atria esta funcionando solo en este dispositivo',
      browserOffline: 'El navegador no tiene conexion',
      syncError: 'Error sync',
      online: 'Online',
      onlineActive: 'Online activo',
      onlineLocal: 'Online local',
      onlineNoSession: 'Online activado sin sesion confirmada',
      onlineNoBackend: 'Online activado, servicio pendiente de preparar',
      syncReady: 'Sync listo',
      lastSync: 'Ultimo sync',
      autoSyncActive: 'Sync automatico activo',
      manualSync: 'Sync pendiente',
      manualTitle: 'Hay dispositivos vinculados pendientes de sincronizar',
    },
    en: {
      localShort: 'Local only',
      localTitle: 'Atria is running only on this device',
      browserOffline: 'The browser is offline',
      syncError: 'Sync error',
      online: 'Online',
      onlineActive: 'Online enabled',
      onlineLocal: 'Online local',
      onlineNoSession: 'Online is enabled without a confirmed session',
      onlineNoBackend: 'Online is enabled, but the service is not ready yet',
      syncReady: 'Sync ready',
      lastSync: 'Last sync',
      autoSyncActive: 'Automatic sync enabled',
      manualSync: 'Sync pending',
      manualTitle: 'There are linked devices waiting to sync',
    },
  };

  function getLang(deps = {}) {
    return deps.lang === 'es' ? 'es' : 'en';
  }

  function call(fn, fallback, ...args) {
    return typeof fn === 'function' ? fn(...args) : fallback;
  }

  function parseStoredJson(deps, key, fallback = null) {
    if (typeof deps.parseStoredJson === 'function') return deps.parseStoredJson(key, fallback);
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function sortNewest(values) {
    return values
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }

  function formatConnectionTs(ts, lang = 'en') {
    return ts ? new Date(ts).toLocaleString(lang === 'es' ? 'es' : 'en', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  }

  function getGlobalConnectionState(deps = {}) {
    const lang = getLang(deps);
    const t = I18N[lang];
    const cfg = call(deps.loadConfig, {}, undefined) || {};
    const syncLog = call(deps.loadSyncLog, [], undefined) || [];
    const lastSync = syncLog[0] || null;
    const lastSyncError = syncLog.find(e => e?.status === 'error') || null;
    const syncDevices = call(deps.loadSyncDevices, [], undefined) || [];
    const onlineProfile = call(deps.getOnlineProfile, { enabled: !!cfg.onlineEnabled }, cfg) || { enabled: !!cfg.onlineEnabled };
    const onlineSession = call(deps.loadOnlineSession, null, undefined) || parseStoredJson(deps, 'tid_online_session', null);
    const onlineState = call(deps.loadOnlineSyncState, {}, undefined) || parseStoredJson(deps, 'tid_online_sync_state', {});
    const backendConfigured = typeof deps.hasOnlineBackendConfigured === 'function'
      ? deps.hasOnlineBackendConfigured(cfg)
      : !!String(cfg.onlineApiBaseUrl || '').trim();
    const browserOnline = typeof deps.browserOnline === 'boolean' ? deps.browserOnline : navigator.onLine !== false;
    const onlineError = onlineState?.lastError || onlineState?.cryptoMigrationError || '';
    const lastError = lastSync?.status === 'error' ? (lastSync.error || 'sync_error') : onlineError || '';
    const lastOnlineTs = onlineState?.realtimeLastEventAt || onlineState?.lastPollAt || onlineState?.lastBootstrapAt || onlineSession?.lastAuthAt || onlineProfile?.lastAuthAt || null;
    const lastSyncTs = lastSync?.ts || null;

    let kind = 'local';
    let short = t.localShort;
    let title = t.localTitle;

    if (!browserOnline) {
      kind = onlineProfile.enabled ? 'offline' : 'local';
      short = onlineProfile.enabled ? 'Offline' : t.localShort;
      title = t.browserOffline;
    } else if (lastError) {
      kind = 'error';
      short = t.syncError;
      title = String(lastError);
    } else if (onlineProfile.enabled && backendConfigured && onlineSession) {
      kind = 'online';
      short = t.online;
      title = lastOnlineTs ? `${t.online} - ${formatConnectionTs(lastOnlineTs, lang)}` : t.onlineActive;
    } else if (onlineProfile.enabled) {
      kind = 'pending';
      short = t.onlineLocal;
      title = backendConfigured ? t.onlineNoSession : t.onlineNoBackend;
    } else if (cfg.autoSync && syncDevices.length) {
      kind = 'sync';
      short = t.syncReady;
      title = lastSyncTs ? `${t.lastSync} - ${formatConnectionTs(lastSyncTs, lang)}` : t.autoSyncActive;
    } else if (syncDevices.length) {
      kind = 'pending';
      short = t.manualSync;
      title = t.manualTitle;
    }

    return { kind, short, title, browserOnline, onlineProfile, onlineSession, backendConfigured, onlineState, syncDevices, lastSync, lastSyncError, lastError, lastOnlineTs, lastSyncTs };
  }

  function getOnlineDeviceSyncDiagnostics(deps = {}) {
    const cfg = call(deps.loadConfig, {}, undefined) || {};
    const onlineProfile = call(deps.getOnlineProfile, { enabled: !!cfg.onlineEnabled }, cfg) || { enabled: !!cfg.onlineEnabled };
    const account = call(deps.loadOnlineAccount, null, undefined);
    const session = call(deps.loadOnlineSession, null, undefined);
    const devices = call(deps.loadOnlineDevicesCache, [], undefined) || [];
    const onlineState = call(deps.loadOnlineSyncState, {}, undefined) || {};
    const backendConfigured = typeof deps.hasOnlineBackendConfigured === 'function'
      ? deps.hasOnlineBackendConfigured(cfg)
      : !!String(cfg.onlineApiBaseUrl || '').trim();
    const conversationIndex = call(deps.loadOnlineConversationIndex, {}, undefined) || {};
    const backupStatus = call(deps.loadOnlineBackupStatus, {}, undefined) || {};
    const friends = call(deps.loadOnlineFriends, [], undefined) || [];
    const moments = sortNewest([
      onlineState?.realtimeLastEventAt,
      onlineState?.lastPollAt,
      onlineState?.lastBootstrapAt,
      onlineState?.lastPushPreparedAt,
      onlineState?.lastPushUploadedAt,
      session?.lastAuthAt,
      onlineProfile?.lastAuthAt,
      ...devices.map(device => device?.lastAuthAt),
    ]);

    return {
      onlineProfile,
      account,
      session,
      devices,
      backendConfigured,
      conversationIndex,
      conversationCount: Object.keys(conversationIndex || {}).length,
      backupStatus,
      friendCount: friends.length,
      onlineState,
      lastSyncLike: moments[0] || null,
      lastPushPreparedAt: onlineState?.lastPushPreparedAt || null,
      lastPushUploadedAt: onlineState?.lastPushUploadedAt || null,
      pendingRelayPackages: Number(onlineState?.pendingRelayPackages || 0),
      lastError: onlineState?.lastError || onlineState?.cryptoMigrationError || backupStatus?.lastError || '',
    };
  }

  function getLegacySyncDiagnostics(deps = {}) {
    const syncLog = call(deps.loadSyncLog, [], undefined) || [];
    const devices = call(deps.loadSyncDevices, [], undefined) || [];
    const lastPushPrepared = syncLog.find(entry => entry?.action === 'push' && (entry?.preparedAt || entry?.preparedBytes || entry?.status !== 'error')) || null;
    const lastPushUploaded = syncLog.find(entry => entry?.action === 'push' && entry?.status !== 'error') || null;
    const lastPull = syncLog.find(entry => entry?.action === 'pull') || null;
    const lastInspect = syncLog.find(entry => entry?.action === 'inspect') || null;
    const lastError = syncLog.find(entry => entry?.status === 'error') || null;
    const pendingOutgoing = Number(lastInspect?.pendingOutgoing || 0);
    const pendingIncoming = Number(lastInspect?.pendingIncoming || 0);
    const pendingRelayPackages = lastInspect
      ? (lastInspect.pendingPackages ?? lastInspect.packageCount ?? pendingOutgoing + pendingIncoming)
      : null;

    return {
      syncLog,
      devices,
      lastSync: syncLog[0] || null,
      lastPushPrepared,
      lastPushUploaded,
      lastPull,
      lastInspect,
      pendingOutgoing,
      pendingIncoming,
      pendingRelayPackages,
      lastError,
      lastErrorText: lastError?.error || '',
    };
  }

  window.AtriaOnlineDevicesDiagnostics = {
    formatConnectionTs,
    getGlobalConnectionState,
    getOnlineDeviceSyncDiagnostics,
    getLegacySyncDiagnostics,
  };
})();
