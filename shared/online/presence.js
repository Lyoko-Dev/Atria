(function () {
  const ONLINE_PRESENCE_KEY = 'tid_online_presence_cache';
  const PRESENCE_STALE_AFTER_MS = 2 * 60 * 1000;

  function readPresence() {
    const saved = window.AtriaStorage.parseJsonKey(ONLINE_PRESENCE_KEY, {});
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }

  function writePresence(presence) {
    window.AtriaStorage.writeJsonKey(
      ONLINE_PRESENCE_KEY,
      presence && typeof presence === 'object' && !Array.isArray(presence) ? presence : {}
    );
  }

  function normalizePresenceState(state) {
    return ['online','idle','offline'].includes(state) ? state : 'offline';
  }

  function getPresenceDisplayState(presence, options = {}) {
    const state = normalizePresenceState(presence?.state);
    if (state === 'offline') return 'offline';
    if (options.transportFailed || options.forceStale) return 'stale';
    const updatedAt = presenceTimestamp(presence?.updatedAt);
    const now = Number(options.now) || Date.now();
    return updatedAt && now - updatedAt > PRESENCE_STALE_AFTER_MS ? 'stale' : state;
  }

  function getCurrentOnlineFrontingPayload(deps) {
    const { getOnlineProfile, loadFronting } = deps;
    const profile = getOnlineProfile();
    if (!profile.fronting) return null;
    const frontSession = (typeof loadFronting === 'function' ? loadFronting() : []).find(s => !s.end);
    const activeAlter = typeof deps.getActiveAlter === 'function' ? deps.getActiveAlter() : null;
    const allAlters = typeof deps.getAlters === 'function' ? deps.getAlters() : [];
    if (frontSession?.alterId) {
      const frontAlter = allAlters.find(a => a.id === frontSession.alterId) || (activeAlter?.id === frontSession.alterId ? activeAlter : null);
      return {
        alterId: frontSession.alterId,
        alterName: frontAlter?.name || frontSession.alterName || null,
        alterEmoji: frontAlter?.emoji || frontSession.alterEmoji || null,
        startedAt: frontSession.start || null,
      };
    }
    if (activeAlter?.id) {
      return {
        alterId: activeAlter.id,
        alterName: activeAlter.name || null,
        alterEmoji: activeAlter.emoji || null,
        startedAt: new Date().toISOString(),
      };
    }
    return null;
  }

  async function buildOnlinePresencePackets(state, visibility = 'friends', deps) {
    const { loadOnlineFriends, loadOnlineKeypair, deriveOnlineSharedKey, bridgeEncryptPacket } = deps;
    const friends = loadOnlineFriends().filter(friend => friend.cryptoPublicKey);
    const keypair = loadOnlineKeypair();
    const fronting = getCurrentOnlineFrontingPayload(deps);
    const packets = {};
    for (const friend of friends) {
      try {
        const sharedKey = await deriveOnlineSharedKey(friend);
        const permissions = typeof deps.normalizeOnlineFriendPermissions === 'function'
          ? deps.normalizeOnlineFriendPermissions(friend.permissions)
          : { viewFronting: friend?.permissions?.viewFronting !== false };
        packets[friend.systemId] = await bridgeEncryptPacket({
          type: 'presence',
          state,
          visibility,
          fronting: permissions.viewFronting ? fronting : null,
          updatedAt: new Date().toISOString(),
        }, sharedKey, keypair?.sigPriv || '');
      } catch {}
    }
    return packets;
  }

  async function decryptOnlinePresencePayload(friend, item, deps) {
    const { deriveOnlineSharedKey, bridgeDecryptPacket } = deps;
    if (!item?.encryptedPacket) return null;
    const sharedKey = await deriveOnlineSharedKey(friend);
    const payload = await bridgeDecryptPacket(item.encryptedPacket, sharedKey, friend?.cryptoSigPub || '');
    return payload && typeof payload === 'object' ? payload : null;
  }

  function presenceTimestamp(value) {
    const ts = Date.parse(value || '');
    return Number.isFinite(ts) ? ts : 0;
  }

  function choosePresencePayload(decrypted, item) {
    if (!decrypted) return item || {};
    const decryptedTs = presenceTimestamp(decrypted.updatedAt);
    const publicTs = presenceTimestamp(item?.updatedAt);
    return publicTs > decryptedTs ? (item || {}) : decrypted;
  }

  function loadOnlinePresenceCache() {
    return readPresence();
  }

  function saveOnlinePresenceCache(presence) {
    writePresence(presence);
  }

  function getOnlinePresenceForFriend(friendId) {
    const all = loadOnlinePresenceCache();
    return all[friendId] || null;
  }

  function upsertLocalOnlinePresence(friendId, patch) {
    const all = loadOnlinePresenceCache();
    all[friendId] = {
      ...(all[friendId] || {}),
      ...patch,
      updatedAt: patch?.updatedAt || new Date().toISOString(),
    };
    saveOnlinePresenceCache(all);
    return all[friendId];
  }

  function getOnlinePresenceSummary() {
    const all = Object.values(loadOnlinePresenceCache());
    const visible = all.filter(p => p && p.state && normalizePresenceState(p.state) !== 'offline');
    return {
      total: visible.length,
      online: visible.filter(p => p.state === 'online').length,
      idle: visible.filter(p => p.state === 'idle').length,
    };
  }

  async function refreshOnlinePresenceFromBackend(deps) {
    const { hasOnlineBackendConfigured, onlineFetch, loadOnlineFriends } = deps;
    if (!hasOnlineBackendConfigured()) return loadOnlinePresenceCache();
    const data = await onlineFetch('/v1/presence/friends');
    const items = Array.isArray(data?.friends) ? data.friends : Array.isArray(data) ? data : [];
    const friends = loadOnlineFriends();
    const next = { ...loadOnlinePresenceCache() };
    for (const item of items) {
      const friend = friends.find(f =>
        (item.systemId && f.systemId === item.systemId) ||
        (item.email && f.email === item.email) ||
        (item.friendId && f.id === item.friendId)
      );
      if (!friend) continue;
      const decrypted = await decryptOnlinePresencePayload(friend, item, deps).catch(() => null);
      const chosen = choosePresencePayload(decrypted, item);
      const hasChosenFronting = chosen && Object.prototype.hasOwnProperty.call(chosen, 'fronting');
      const hasItemFronting = item && Object.prototype.hasOwnProperty.call(item, 'fronting');
      next[friend.id] = {
        ...(next[friend.id] || {}),
        state: normalizePresenceState(chosen?.state || item.state || next[friend.id]?.state || 'offline'),
        fronting: hasChosenFronting ? (chosen.fronting || null) : (hasItemFronting ? (item.fronting || null) : (next[friend.id]?.fronting || null)),
        updatedAt: chosen?.updatedAt || item.updatedAt || next[friend.id]?.updatedAt || new Date().toISOString(),
        encrypted: !!item.encryptedPacket,
      };
    }
    Object.keys(next).forEach(friendId => {
      if (!friends.some(f => f.id === friendId)) delete next[friendId];
    });
    saveOnlinePresenceCache(next);
    return next;
  }

  async function setOnlinePresenceState(state, deps) {
    const { loadOnlineSession, saveOnlineSession, hasOnlineBackendConfigured, onlineFetch } = deps;
    const normalized = normalizePresenceState(state);
    const session = loadOnlineSession();
    if (session) saveOnlineSession({ ...session, presenceState: normalized });
    if (!hasOnlineBackendConfigured()) return { state: normalized, mode: 'local' };
    const fronting = getCurrentOnlineFrontingPayload(deps);
    const packets = await buildOnlinePresencePackets(normalized, 'friends', deps);
    await onlineFetch('/v1/presence/settings', {
      method: 'PATCH',
      body: JSON.stringify({ state: normalized, fronting, packets }),
    });
    return { state: normalized, mode: 'remote' };
  }

  window.AtriaOnlinePresence = {
    keys: { ONLINE_PRESENCE_KEY },
    getCurrentOnlineFrontingPayload,
    buildOnlinePresencePackets,
    decryptOnlinePresencePayload,
    choosePresencePayload,
    normalizePresenceState,
    getPresenceDisplayState,
    loadOnlinePresenceCache,
    saveOnlinePresenceCache,
    getOnlinePresenceForFriend,
    upsertLocalOnlinePresence,
    getOnlinePresenceSummary,
    refreshOnlinePresenceFromBackend,
    setOnlinePresenceState,
  };
})();
