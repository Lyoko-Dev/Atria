(function () {
  const ONLINE_BACKUP_SECRET_KEY = 'tid_online_backup_secret';
  const ONLINE_BACKUP_STATUS_KEY = 'tid_online_backup_status';

  const STRINGS = {
    es: {
      noSession: 'No hay sesion online activa',
      disabled: 'El backup automatico esta desactivado',
      uploadError: 'Error al subir backup',
      statusError: 'ERROR',
      statusRemote: 'SUBIDO',
      statusLocal: 'PREPARADO',
      statusRestored: 'RESTAURADO',
      statusPaused: 'PAUSADO',
      statusIdle: 'PENDIENTE',
      detailError: 'Ultimo fallo',
      detailRemote: 'Ultima subida',
      detailLocal: 'Ultimo preparado local',
      detailRestored: 'Ultima restauracion',
      detailPaused: 'El backup automatico esta desactivado',
      detailIdle: 'Todavia no se ha preparado ningun backup automatico',
      actionRetry: 'Reintentar ahora',
      actionRun: 'Subir ahora',
    },
    en: {
      noSession: 'No active online session',
      disabled: 'Automatic backup is disabled',
      uploadError: 'Error uploading backup',
      statusError: 'ERROR',
      statusRemote: 'UPLOADED',
      statusLocal: 'PREPARED',
      statusRestored: 'RESTORED',
      statusPaused: 'PAUSED',
      statusIdle: 'PENDING',
      detailError: 'Last failure',
      detailRemote: 'Last upload',
      detailLocal: 'Last local preparation',
      detailRestored: 'Last restore',
      detailPaused: 'Automatic backup is disabled',
      detailIdle: 'No automatic backup has been prepared yet',
      actionRetry: 'Retry now',
      actionRun: 'Upload now',
    },
  };

  function strings(lang) {
    return STRINGS[lang] || STRINGS.en;
  }

  const AUTO_BACKUP_DEBOUNCE_MS = 15000;
  const AUTO_BACKUP_EXCLUDED_KEYS = new Set([
    ONLINE_BACKUP_SECRET_KEY,
    ONLINE_BACKUP_STATUS_KEY,
    'tid_last_backup',
  ]);
  const RESTORE_PRESERVE_PREFIXES = ['tid_online_'];
  const RESTORE_PRESERVE_KEYS = new Set([
    ONLINE_BACKUP_SECRET_KEY,
    ONLINE_BACKUP_STATUS_KEY,
    'tid_last_backup',
  ]);
  let autoBackupTimer = null;
  let autoBackupWatcherInstalled = false;

  function isRelevantBackupKey(key, deps) {
    const value = String(key || '');
    if (!value.startsWith('tid_')) return false;
    if (AUTO_BACKUP_EXCLUDED_KEYS.has(value)) return false;
    if (value.startsWith('tid_online_')) return false;
    if (value.startsWith('tid_unknown_')) return false;
    if (value.startsWith('tid_calm_msg_')) return true;
    if (/^tid_[^_]+_(transactions|ahorros|presupuestos|categories)$/.test(value)) return true;
    return Array.isArray(deps?.tidKeys) && deps.tidKeys.includes(value);
  }

  async function runDeferredOnlineAutomaticBackup(reason, deps) {
    autoBackupTimer = null;
    const session = deps.loadOnlineSession?.();
    const account = deps.loadOnlineAccount?.();
    if (!session || !account) return;
    if (session.autoBackup === false) return;
    if (!deps.hasOnlineBackendConfigured?.() || typeof deps.onlineFetch !== 'function') return;
    if (window.__atriaOnlineRestoreInProgress) return;
    await runOnlineAutomaticBackup(reason, deps).catch(() => {});
  }

  function scheduleOnlineAutomaticBackup(reason = 'auto-change', deps) {
    if (window.__atriaOnlineRestoreInProgress) return;
    if (autoBackupTimer) clearTimeout(autoBackupTimer);
    autoBackupTimer = setTimeout(() => {
      runDeferredOnlineAutomaticBackup(reason, deps);
    }, AUTO_BACKUP_DEBOUNCE_MS);
  }

  function installOnlineAutoBackupWatcher(deps) {
    if (autoBackupWatcherInstalled) return;
    autoBackupWatcherInstalled = true;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      originalSetItem.call(this, key, value);
      if (this === localStorage && isRelevantBackupKey(key, deps)) {
        scheduleOnlineAutomaticBackup('auto-change', deps);
      }
    };
    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      originalRemoveItem.call(this, key);
      if (this === localStorage && isRelevantBackupKey(key, deps)) {
        scheduleOnlineAutomaticBackup('auto-delete', deps);
      }
    };
  }

  function getOrCreateOnlineBackupSecret(deps) {
    const { crypto, bufferToBase64Url } = deps;
    let existing = localStorage.getItem(ONLINE_BACKUP_SECRET_KEY);
    if (existing) return existing;
    const random = crypto.getRandomValues(new Uint8Array(32));
    existing = bufferToBase64Url(random.buffer);
    localStorage.setItem(ONLINE_BACKUP_SECRET_KEY, existing);
    return existing;
  }

  function loadOnlineBackupSecret() {
    return localStorage.getItem(ONLINE_BACKUP_SECRET_KEY) || '';
  }

  function saveOnlineBackupSecret(secret) {
    if (!secret) localStorage.removeItem(ONLINE_BACKUP_SECRET_KEY);
    else localStorage.setItem(ONLINE_BACKUP_SECRET_KEY, String(secret));
  }

  function loadOnlineBackupStatus() {
    const saved = window.AtriaStorage.parseJsonKey(ONLINE_BACKUP_STATUS_KEY, {});
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }

  function saveOnlineBackupStatus(status) {
    window.AtriaStorage.writeJsonKey(
      ONLINE_BACKUP_STATUS_KEY,
      status && typeof status === 'object' && !Array.isArray(status) ? status : {}
    );
  }

  function formatBackupDate(value, lang) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(lang === 'es' ? 'es' : 'en');
  }

  function describeOnlineBackupStatus(status = {}, deps = {}) {
    const lang = deps.lang || 'en';
    const s = strings(lang);
    const normalized = status && typeof status === 'object' && !Array.isArray(status) ? status : {};
    const paused = normalized.autoBackupEnabled === false;
    let code = s.statusIdle;
    let detail = s.detailIdle;
    let tone = 'idle';
    if (normalized.lastError) {
      code = s.statusError;
      const when = formatBackupDate(normalized.lastFailedAt || normalized.lastAttemptAt, lang);
      detail = `${s.detailError}${when ? ` ${when}` : ''}: ${normalized.lastError}`;
      tone = 'error';
    } else if (normalized.lastUploadedAt) {
      code = s.statusRemote;
      detail = `${s.detailRemote} ${formatBackupDate(normalized.lastUploadedAt, lang)}`;
      tone = 'ok';
    } else if (normalized.lastPreparedAt) {
      code = s.statusLocal;
      detail = `${s.detailLocal} ${formatBackupDate(normalized.lastPreparedAt, lang)}`;
      tone = 'warn';
    } else if (normalized.lastRestoredAt) {
      code = s.statusRestored;
      detail = `${s.detailRestored} ${formatBackupDate(normalized.lastRestoredAt, lang)}`;
      tone = 'ok';
    } else if (paused) {
      code = s.statusPaused;
      detail = s.detailPaused;
      tone = 'idle';
    }
    const bits = [];
    if (normalized.lastReason) bits.push(String(normalized.lastReason));
    if (Number.isFinite(normalized.lastPayloadKeyCount)) bits.push(`${normalized.lastPayloadKeyCount} keys`);
    if (Number.isFinite(normalized.lastPayloadBytes)) bits.push(`${Math.round(normalized.lastPayloadBytes / 1024)} KB`);
    return {
      code,
      detail,
      meta: bits.join(' · '),
      tone,
      actionLabel: normalized.lastError ? s.actionRetry : s.actionRun,
    };
  }

  function collectBackupExportData(deps) {
    const { tidKeys } = deps;
    const data = {};
    tidKeys.forEach(k => {
      const v = localStorage.getItem(k);
      if (v) data[k] = v;
    });
    try {
      (JSON.parse(localStorage.getItem('tid_alters')) || []).forEach(a => {
        ['tid_calm_msg_'+a.id, `tid_${a.id}_transactions`, `tid_${a.id}_ahorros`, `tid_${a.id}_presupuestos`, `tid_${a.id}_categories`]
          .forEach(k => {
            const v = localStorage.getItem(k);
            if (v) data[k] = v;
          });
      });
    } catch {}
    return data;
  }

  function readBackupAltersState(raw) {
    if (raw == null) return { status: 'missing', alters: [] };
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      let list = [];
      if (Array.isArray(parsed)) list = parsed;
      else if (parsed && Array.isArray(parsed.alters)) list = parsed.alters;
      else if (parsed && Array.isArray(parsed.items)) list = parsed.items;
      else if (parsed && typeof parsed === 'object' && parsed.id && (parsed.name || parsed.role || parsed.emoji)) list = [parsed];
      else return { status: 'unsupported', alters: [], raw };
      const alters = list.filter(item => item && typeof item === 'object');
      return alters.length ? { status: 'ok', alters } : { status: 'empty', alters: [] };
    } catch (error) {
      return { status: 'invalid', alters: [], raw, error };
    }
  }

  function isProtectedRestoreKey(key, pinKeys = []) {
    if (!String(key || '').startsWith('tid_')) return true;
    if (pinKeys.includes(key)) return true;
    if (RESTORE_PRESERVE_KEYS.has(key)) return true;
    return RESTORE_PRESERVE_PREFIXES.some(prefix => key.startsWith(prefix));
  }

  function getLocalStorageKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  }

  function getLocalAtriaDataKeysForRestore(deps) {
    if (typeof deps.getLocalAtriaDataKeysForOnlineRestore === 'function') {
      const keys = deps.getLocalAtriaDataKeysForOnlineRestore();
      return Array.isArray(keys) ? keys : [];
    }
    const pinKeys = deps.pinKeys || [];
    return getLocalStorageKeys().filter(key => !isProtectedRestoreKey(key, pinKeys));
  }

  function getRestorableBackupEntries(parsed, deps) {
    const pinKeys = deps.pinKeys || [];
    return Object.entries(parsed || {}).filter(([key]) => !isProtectedRestoreKey(key, pinKeys));
  }

  async function confirmReplaceLocalData({ localKeyCount, remoteKeyCount }, deps) {
    if (typeof deps.confirmReplaceLocalDataForOnlineRestore === 'function') {
      return deps.confirmReplaceLocalDataForOnlineRestore({ localKeyCount, remoteKeyCount });
    }
    const lang = deps.lang || 'en';
    const msg = lang === 'es'
      ? `Este dispositivo ya tiene ${localKeyCount} claves locales de Atria. Para cargar los datos de tu cuenta online, Atria reemplazara esos datos locales por el backup online validado (${remoteKeyCount} claves). Continuar?`
      : `This device already has ${localKeyCount} local Atria data keys. To load your online account data, Atria will replace them with the validated online backup (${remoteKeyCount} keys). Continue?`;
    return window.confirm(msg);
  }

  async function buildOnlineAutomaticBackupPayload(deps) {
    const { encryptBackupData } = deps;
    const data = collectBackupExportData(deps);
    const json = JSON.stringify(data);
    const secret = getOrCreateOnlineBackupSecret(deps);
    const encrypted = await encryptBackupData(json, secret);
    return {
      version: 1,
      encrypted: true,
      createdAt: new Date().toISOString(),
      keyCount: Object.keys(data).length,
      byteSize: new Blob([json]).size,
      cipher: encrypted,
    };
  }

  async function runOnlineAutomaticBackup(reason = 'manual', deps) {
    const {
      loadOnlineSession,
      loadOnlineAccount,
      hasOnlineBackendConfigured,
      onlineFetch,
      lang = 'en',
    } = deps;
    const s = strings(lang);
    const session = loadOnlineSession();
    const account = loadOnlineAccount();
    if (!session || !account) throw new Error(s.noSession);
    const manualRun = String(reason || '').startsWith('manual');
    if (session.autoBackup === false && !manualRun) {
      const paused = {
        ...(loadOnlineBackupStatus() || {}),
        autoBackupEnabled: false,
        lastReason: reason,
        lastMode: 'paused',
        lastError: null,
      };
      saveOnlineBackupStatus(paused);
      throw new Error(s.disabled);
    }
    const payload = await buildOnlineAutomaticBackupPayload(deps);
    const status = {
      ...(loadOnlineBackupStatus() || {}),
      autoBackupEnabled: session.autoBackup !== false,
      lastAttemptAt: new Date().toISOString(),
      lastPreparedAt: payload.createdAt,
      lastReason: reason,
      lastMode: hasOnlineBackendConfigured() && typeof onlineFetch === 'function' ? 'remote' : 'local',
      lastPayloadKeyCount: payload.keyCount,
      lastPayloadBytes: payload.byteSize,
      lastError: null,
    };
    if (!hasOnlineBackendConfigured() || typeof onlineFetch !== 'function') {
      saveOnlineBackupStatus(status);
      localStorage.setItem('tid_last_backup', Date.now().toString());
      return { mode: 'local', payload };
    }
    try {
      await onlineFetch('/v1/backups', {
        method: 'POST',
        body: JSON.stringify({
          createdAt: payload.createdAt,
          encrypted: true,
          reason,
          payload: payload.cipher,
        }),
      });
      const uploaded = {
        ...status,
        lastUploadedAt: new Date().toISOString(),
        lastMode: 'remote',
      };
      saveOnlineBackupStatus(uploaded);
      localStorage.setItem('tid_last_backup', Date.now().toString());
      return { mode: 'remote', payload };
    } catch (e) {
      saveOnlineBackupStatus({ ...status, lastFailedAt: new Date().toISOString(), lastError: e.message || s.uploadError });
      throw e;
    }
  }

  async function restoreOnlineAutomaticBackup(deps) {
    const {
      decryptBackupPayload,
      hasOnlineBackendConfigured,
      onlineFetch,
      shouldSkipIncomingSyncWrite,
      pinKeys = [],
      lang = 'en',
    } = deps;
    const s = strings(lang);
    if (!hasOnlineBackendConfigured() || typeof onlineFetch !== 'function') {
      throw new Error(s.noSession);
    }
    const secret = loadOnlineBackupSecret();
    if (!secret) throw new Error(lang === 'es' ? 'No hay secreto de backup recuperable en esta cuenta' : 'No recoverable backup secret is available for this account');
    const data = await onlineFetch('/v1/backups/latest');
    const payload = data?.backup?.payload;
    if (!payload) throw new Error(lang === 'es' ? 'No hay backup online disponible' : 'No online backup is available');
    const raw = await decryptBackupPayload(payload, secret);
    const parsed = JSON.parse(raw || '{}');
    const entries = getRestorableBackupEntries(parsed, deps);
    const localKeys = getLocalAtriaDataKeysForRestore(deps);
    const hasLocalData = localKeys.length > 0;
    const incomingAlters = readBackupAltersState(parsed.tid_alters);
    if (incomingAlters.status !== 'ok') {
      throw new Error(lang === 'es'
        ? 'El backup online no trae perfiles validos; no se restauraron datos'
        : 'The online backup does not contain valid profiles; data was not restored');
    }
    // En una cuenta autenticada, el backup remoto sustituye los datos locales.
    let count = 0;
    const snapshot = {};
    window.__atriaOnlineRestoreInProgress = true;
    try {
      if (hasLocalData) {
        localKeys.forEach(key => {
          snapshot[key] = localStorage.getItem(key);
          localStorage.removeItem(key);
        });
      }
      entries.forEach(([key, value]) => {
        if (typeof shouldSkipIncomingSyncWrite === 'function' && shouldSkipIncomingSyncWrite(key, value)) return;
        localStorage.setItem(key, value);
        count++;
      });
    } catch (error) {
      Object.entries(snapshot).forEach(([key, value]) => {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      });
      throw error;
    } finally {
      window.__atriaOnlineRestoreInProgress = false;
    }
    const restoredAt = new Date().toISOString();
    saveOnlineBackupStatus({ ...(loadOnlineBackupStatus() || {}), lastRestoredAt: restoredAt, lastError: null });
    return { mode: 'remote', count, restoredAt };
  }

  window.AtriaOnlineBackup = {
    keys: {
      ONLINE_BACKUP_SECRET_KEY,
      ONLINE_BACKUP_STATUS_KEY,
    },
    getOrCreateOnlineBackupSecret,
    loadOnlineBackupSecret,
    saveOnlineBackupSecret,
    loadOnlineBackupStatus,
    saveOnlineBackupStatus,
    describeOnlineBackupStatus,
    collectBackupExportData,
    getLocalAtriaDataKeysForRestore,
    buildOnlineAutomaticBackupPayload,
    runOnlineAutomaticBackup,
    restoreOnlineAutomaticBackup,
    scheduleOnlineAutomaticBackup,
    installOnlineAutoBackupWatcher,
  };
})();
