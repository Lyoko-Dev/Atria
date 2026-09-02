(function () {
  const ONLINE_SYNC_STATE_KEY = 'tid_online_sync_state';
  let syncInterval = null;

  const STRINGS = {
    es: {
      fallbackFriendName: 'Amistad',
      encryptedMessage: '[mensaje cifrado]',
      incomingRequestTitle: 'Nueva solicitud online',
      incomingRequestBody: 'Tienes una solicitud de amistad pendiente',
      incomingMessageTitle: 'Nuevo mensaje online',
    },
    en: {
      fallbackFriendName: 'Friend',
      encryptedMessage: '[encrypted message]',
      incomingRequestTitle: 'New online request',
      incomingRequestBody: 'You have a pending friend request',
      incomingMessageTitle: 'New online message',
    },
  };

  function strings(lang) {
    return STRINGS[lang] || STRINGS.en;
  }

  function loadOnlineSyncState() {
    const saved = window.AtriaStorage.parseJsonKey(ONLINE_SYNC_STATE_KEY, {});
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }

  function saveOnlineSyncState(state) {
    window.AtriaStorage.writeJsonKey(ONLINE_SYNC_STATE_KEY, state && typeof state === 'object' && !Array.isArray(state) ? state : {});
  }

  function normalizeFriend(friend, deps) {
    const s = strings(deps.lang);
    const normalizePermissions = typeof deps.normalizeOnlineFriendPermissions === 'function'
      ? deps.normalizeOnlineFriendPermissions
      : permissions => ({
          viewFronting: permissions?.viewFronting !== false,
          frontNotifications: permissions?.frontNotifications === true,
          chat: permissions?.chat !== false,
          profileSharing: ['none','selected','all'].includes(permissions?.profileSharing) ? permissions.profileSharing : 'none',
          selectedProfileIds: Array.isArray(permissions?.selectedProfileIds) && permissions?.profileSharing === 'selected' ? permissions.selectedProfileIds : [],
          journalSharing: permissions?.journalSharing === true,
          pollsSharing: permissions?.pollsSharing === true,
        });
    return {
      id: friend.id || deps.uid(),
      identifier: friend.friendCode || friend.systemId || friend.email || friend.handle || friend.displayName || friend.id,
      identifierType: friend.friendCode ? 'friend_code' : (friend.email ? 'email' : 'system_id'),
      displayName: friend.displayName || friend.friendCode || friend.handle || friend.systemId || friend.email || s.fallbackFriendName,
      systemId: friend.systemId || null,
      friendCode: friend.friendCode || null,
      email: friend.email || null,
      cryptoPublicKey: friend.cryptoPublicKey || null,
      cryptoSigPub: friend.cryptoSigPub || null,
      permissions: normalizePermissions(friend.permissions),
      addedAt: friend.createdAt || friend.addedAt || new Date().toISOString(),
    };
  }

  function normalizeRequest(req, deps) {
    return {
      id: req.id || deps.uid(),
      identifier: req.targetIdentifier || req.targetSystemId || req.email || req.handle || req.displayName || req.id,
      identifierType: req.email ? 'email' : 'system_id',
      direction: req.direction || (req.isIncoming ? 'incoming' : 'outgoing'),
      status: req.status || 'pending',
      source: 'backend',
      createdAt: req.createdAt || new Date().toISOString(),
      updatedAt: req.updatedAt || req.createdAt || new Date().toISOString(),
    };
  }

  function findFriendForItem(friends, item) {
    return friends.find(f =>
      (item.systemId && f.systemId === item.systemId) ||
      (item.email && f.email === item.email) ||
      (item.friendId && f.id === item.friendId)
    );
  }

  function notifyOnlineEvent(deps, payload) {
    if (deps.suppressOnlineNotifications) return;
    if (typeof deps.notifyOnlineEvent === 'function') {
      deps.notifyOnlineEvent(payload);
    }
  }

  async function applyOnlineSyncBootstrapPayload(payload, deps) {
    if (!payload || typeof payload !== 'object') return;
    const s = strings(deps.lang);

    if (Array.isArray(payload.friends)) {
      deps.saveOnlineFriends(payload.friends.map(friend => normalizeFriend(friend, deps)));
    }

    if (Array.isArray(payload.requests)) {
      const previousRequests = typeof deps.loadOnlineFriendRequests === 'function' ? deps.loadOnlineFriendRequests() : [];
      const seenIncoming = new Set(previousRequests
        .filter(req => req.status === 'pending' && req.direction !== 'outgoing')
        .map(req => req.id));
      const requests = payload.requests.map(req => normalizeRequest(req, deps));
      deps.saveOnlineFriendRequests(requests);
      requests
        .filter(req => req.status === 'pending' && req.direction !== 'outgoing' && !seenIncoming.has(req.id))
        .forEach(req => notifyOnlineEvent(deps, {
          kind: 'friend_request',
          id: req.id,
          title: s.incomingRequestTitle,
          body: req.displayName || req.identifier || s.incomingRequestBody,
          nav: 'online-amigos',
        }));
    }

    if (Array.isArray(payload.presence)) {
      const nextPresence = { ...(typeof deps.loadOnlinePresenceCache === 'function' ? deps.loadOnlinePresenceCache() : {}) };
      const friends = deps.loadOnlineFriends();
      payload.presence.forEach(item => {
        const friend = findFriendForItem(friends, item);
        if (!friend) return;
        const current = nextPresence[friend.id] || {};
        const hasItemFronting = item && Object.prototype.hasOwnProperty.call(item, 'fronting');
        nextPresence[friend.id] = {
          ...current,
          state: typeof deps.normalizePresenceState === 'function'
            ? deps.normalizePresenceState(item.state || current.state || 'offline')
            : (['online','idle','offline'].includes(item.state || current.state) ? (item.state || current.state) : 'offline'),
          fronting: hasItemFronting ? (item.fronting || null) : (current.fronting || null),
          updatedAt: item.updatedAt || new Date().toISOString(),
        };
      });
      Object.keys(nextPresence).forEach(friendId => {
        if (!friends.some(f => f.id === friendId)) delete nextPresence[friendId];
      });
      deps.saveOnlinePresenceCache(nextPresence);
    }

    if (Array.isArray(payload.conversations)) {
      const index = deps.loadOnlineConversationIndex();
      payload.conversations.forEach(conv => {
        const friend = findFriendForItem(deps.loadOnlineFriends(), conv);
        if (!friend) return;
        index[friend.id] = {
          ...(index[friend.id] || {}),
          conversationId: conv.id || conv.conversationId || index[friend.id]?.conversationId,
          unreadCount: conv.unreadCount || 0,
          lastMessageTs: conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : (index[friend.id]?.lastMessageTs || 0),
        };
      });
      deps.saveOnlineConversationIndex(index);
    }

    if (Array.isArray(payload.messages)) {
      for (const group of payload.messages) {
        const friend = findFriendForItem(deps.loadOnlineFriends(), group);
        if (!friend || !Array.isArray(group.messages)) continue;
        const existingIds = new Set(
          typeof deps.getOnlineConversationMessages === 'function'
            ? deps.getOnlineConversationMessages(friend.id).map(msg => msg.id)
            : []
        );
        const normalized = await Promise.all(group.messages.map(async msg => {
          const payload = typeof deps.decryptOnlineMessagePayload === 'function'
            ? await deps.decryptOnlineMessagePayload(friend, msg).catch(() => null)
            : null;
          return {
            id: msg.id || deps.uid(),
            dir: (msg.senderSystemId && msg.senderSystemId === (deps.loadOnlineAccount()?.systemId || '')) ? 'out' : 'in',
            text: payload?.text || await deps.decryptOnlineMessageText(friend, msg).catch(() => msg.body || msg.text || s.encryptedMessage),
            ts: msg.createdAt ? new Date(msg.createdAt).getTime() : (msg.ts || Date.now()),
            senderDisplayName: msg.senderDisplayName || null,
            senderAlter: payload?.senderAlter || msg.senderAlter || null,
            readByPeer: !!msg.readByPeer,
          };
        }));
        deps.mergeOnlineConversationMessages(friend.id, normalized);
        normalized
          .filter(msg => msg.dir === 'in' && !existingIds.has(msg.id))
          .forEach(msg => notifyOnlineEvent(deps, {
            kind: 'message',
            id: msg.id,
            friendId: friend.id,
            title: s.incomingMessageTitle,
            body: `${friend.displayName || friend.identifier || s.fallbackFriendName}: ${msg.text || s.encryptedMessage}`,
            nav: 'innerchat',
            tab: 'online',
          }));
        const conversationId = deps.getOnlineConversationMeta(friend.id)?.conversationId;
        if (conversationId && group.messages.some(msg => !msg.encrypted && (msg.body || msg.text))) {
          deps.migrateOnlineConversationCiphertext(friend, conversationId, group.messages).catch(() => {});
        }
      }
    }

    if (payload.backupStatus && typeof payload.backupStatus === 'object') {
      deps.saveOnlineBackupStatus({ ...(deps.loadOnlineBackupStatus() || {}), ...payload.backupStatus });
    }
  }

  async function runOnlineSyncBootstrap(deps) {
    if (!deps.hasOnlineBackendConfigured() || !deps.getOnlineProfile().enabled) return { mode: 'local' };
    const data = await deps.onlineFetch('/v1/sync/bootstrap');
    await applyOnlineSyncBootstrapPayload(data || {}, { ...deps, suppressOnlineNotifications: true });
    saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), cursor: data?.cursor || null, lastBootstrapAt: new Date().toISOString(), lastError: null });
    return { mode: 'remote', data };
  }

  async function runOnlineSyncChanges(deps) {
    if (!deps.hasOnlineBackendConfigured() || !deps.getOnlineProfile().enabled) return { mode: 'local' };
    const state = loadOnlineSyncState();
    const cursor = state.cursor ? `?cursor=${encodeURIComponent(state.cursor)}` : '';
    const data = await deps.onlineFetch(`/v1/sync/changes${cursor}`);
    await applyOnlineSyncBootstrapPayload(data || {}, deps);
    saveOnlineSyncState({
      ...state,
      cursor: data?.cursor || state.cursor || null,
      lastPollAt: new Date().toISOString(),
      lastError: null,
    });
    return { mode: 'remote', data };
  }

  function isAuthError(e) {
    return e?.status === 401;
  }

  function startOnlineSyncLoop(deps) {
    if (!deps.hasOnlineBackendConfigured() || !deps.getOnlineProfile().enabled) return;
    if (syncInterval) return;
    runOnlineSyncBootstrap(deps).then(() => {
      if (typeof deps.render === 'function') deps.render();
    }).catch(e => {
      saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), lastError: e.message || 'bootstrap_error' });
      if (isAuthError(e)) stopOnlineSyncLoop(deps);
    });
    const hasRealtime = deps.startOnlineEventsChannel();
    if (!hasRealtime) {
      syncInterval = setInterval(() => {
        if (!deps.hasOnlineBackendConfigured() || !deps.getOnlineProfile().enabled) return stopOnlineSyncLoop(deps);
        runOnlineSyncChanges(deps).then(() => {
          if (typeof deps.render === 'function') deps.render();
        }).catch(e => {
          saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), lastError: e.message || 'sync_error' });
          if (isAuthError(e)) stopOnlineSyncLoop(deps);
        });
      }, 3_000);
    } else {
      syncInterval = -1;
    }
  }

  function stopOnlineSyncLoop(deps) {
    if (syncInterval && syncInterval !== -1) clearInterval(syncInterval);
    syncInterval = null;
    if (deps && typeof deps.stopOnlineEventsChannel === 'function') deps.stopOnlineEventsChannel();
  }

  window.AtriaOnlineSync = {
    keys: { ONLINE_SYNC_STATE_KEY },
    loadOnlineSyncState,
    saveOnlineSyncState,
    applyOnlineSyncBootstrapPayload,
    runOnlineSyncBootstrap,
    runOnlineSyncChanges,
    startOnlineSyncLoop,
    stopOnlineSyncLoop,
  };
})();
