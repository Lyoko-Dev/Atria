(function () {
  let eventsSource = null;
  let reconnectTimer = null;
  let syncPending = false;
  let onlineListenerBound = false;
  let lifecycleListenerBound = false;
  let latestDeps = null;

  function scheduleOnlineRealtimeSync(deps) {
    const { runOnlineSyncChanges, saveOnlineSyncState, loadOnlineSyncState, render } = deps;
    if (syncPending) return;
    syncPending = true;
    setTimeout(() => {
      syncPending = false;
      runOnlineSyncChanges()
        .then(() => {
          if (typeof render === 'function') render();
        })
        .catch(e => saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), lastError: e.message || 'realtime_sync_error' }));
    }, 120);
  }

  async function applyOnlineRealtimeMessage(change, deps) {
    const {
      loadOnlineAccount,
      findOnlineFriendBySystemId,
      decryptOnlineMessageText,
      mergeOnlineConversationMessages,
      getOnlineConversationMeta,
      setOnlineConversationMeta,
      markOnlineConversationRead,
      getOnlineChatActiveFriendId,
      uid,
      encryptedFallbackText,
      notifyOnlineEvent,
    } = deps;
    const payload = change?.payload || {};
    const account = loadOnlineAccount();
    const members = Array.isArray(payload.members) ? payload.members : [];
    const peerSystemId = members.find(id => id && id !== account?.systemId) || '';
    const friend = findOnlineFriendBySystemId(peerSystemId);
    const message = payload.message || null;
    if (!friend || !message) return false;
    const decryptedPayload = typeof deps.decryptOnlineMessagePayload === 'function'
      ? await deps.decryptOnlineMessagePayload(friend, message).catch(() => null)
      : null;
    const normalized = {
      id: message.id || uid(),
      dir: message.senderSystemId === account?.systemId ? 'out' : 'in',
      text: decryptedPayload?.text || await decryptOnlineMessageText(friend, message).catch(() => message.body || encryptedFallbackText),
      ts: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
      senderDisplayName: message.senderDisplayName || null,
      senderAlter: decryptedPayload?.senderAlter || message.senderAlter || null,
      readByPeer: !!message.readByPeer,
    };
    const messages = mergeOnlineConversationMessages(friend.id, [normalized]);
    const meta = getOnlineConversationMeta(friend.id);
    const activeFriendId = typeof getOnlineChatActiveFriendId === 'function' ? getOnlineChatActiveFriendId() : null;
    const unreadCount = activeFriendId === friend.id
      ? 0
      : messages.filter(msg => msg.dir === 'in' && (msg.ts || 0) > (meta.lastReadTs || 0)).length;
    setOnlineConversationMeta(friend.id, {
      conversationId: payload.conversationId || meta.conversationId || null,
      unreadCount,
      lastMessageTs: normalized.ts,
    });
    if (activeFriendId === friend.id) {
      await markOnlineConversationRead(friend.id).catch(() => {});
    }
    if (normalized.dir === 'in' && typeof notifyOnlineEvent === 'function') {
      notifyOnlineEvent({
        kind: 'message',
        id: normalized.id,
        friendId: friend.id,
        title: deps.lang === 'es' ? 'Nuevo mensaje online' : 'New online message',
        body: `${friend.displayName || friend.identifier || 'Atria'}: ${normalized.text || encryptedFallbackText}`,
        nav: 'innerchat',
        tab: 'online',
      });
    }
    return messages.length >= 0;
  }

  function applyOnlineRealtimeRead(change, deps) {
    const { loadOnlineAccount, findOnlineFriendBySystemId, loadOnlineConversations, saveOnlineConversations } = deps;
    const payload = change?.payload || {};
    const account = loadOnlineAccount();
    const members = Array.isArray(payload.members) ? payload.members : [];
    const peerSystemId = members.find(id => id && id !== account?.systemId) || '';
    const friend = findOnlineFriendBySystemId(peerSystemId);
    if (!friend || payload.reader === account?.systemId) return false;
    const readAt = Number(payload.readAt) || 0;
    const all = loadOnlineConversations();
    const messages = Array.isArray(all[friend.id]) ? all[friend.id].map(msg => {
      if (msg.dir !== 'out') return msg;
      return { ...msg, readByPeer: (msg.ts || 0) <= readAt };
    }) : [];
    all[friend.id] = messages;
    saveOnlineConversations(all);
    return true;
  }

  async function applyOnlineRealtimePresence(change, deps) {
    const { findOnlineFriendBySystemId, decryptOnlinePresencePayload, upsertLocalOnlinePresence } = deps;
    const payload = change?.payload || {};
    const friend = findOnlineFriendBySystemId(payload.systemId || '');
    if (!friend) return false;
    const decrypted = await decryptOnlinePresencePayload(friend, payload).catch(() => null);
    const chosen = typeof deps.choosePresencePayload === 'function'
      ? deps.choosePresencePayload(decrypted, payload)
      : (decrypted || payload);
    const hasChosenFronting = chosen && Object.prototype.hasOwnProperty.call(chosen, 'fronting');
    const hasPayloadFronting = payload && Object.prototype.hasOwnProperty.call(payload, 'fronting');
    const normalizePresenceState = typeof deps.normalizePresenceState === 'function'
      ? deps.normalizePresenceState
      : state => (['online','idle','offline'].includes(state) ? state : 'offline');
    upsertLocalOnlinePresence(friend.id, {
      state: normalizePresenceState(chosen?.state || payload.state || 'offline'),
      fronting: hasChosenFronting ? (chosen.fronting || null) : (hasPayloadFronting ? (payload.fronting || null) : null),
      updatedAt: chosen?.updatedAt || payload.updatedAt || new Date().toISOString(),
      encrypted: !!payload.encryptedPacket,
    });
    return true;
  }

  async function handleOnlineRealtimeChange(change, deps) {
    const type = change?.type || '';
    if (type === 'conversation.message') return applyOnlineRealtimeMessage(change, deps);
    if (type === 'conversation.read') return applyOnlineRealtimeRead(change, deps);
    if (type === 'presence.updated') return applyOnlineRealtimePresence(change, deps);
    if (type === 'friend_request.created' || type === 'friend_request.updated' || type === 'friendship.created' || type === 'friendship.updated' || type === 'friendship.deleted') {
      await deps.refreshOnlineFriendsFromBackend().catch(() => {});
      if (type === 'friend_request.created' && typeof deps.notifyOnlineEvent === 'function') {
        const req = change?.payload?.request || {};
        deps.notifyOnlineEvent({
          kind: 'friend_request',
          id: req.id || change?.payload?.id || change?.cursor || Date.now(),
          title: deps.lang === 'es' ? 'Nueva solicitud online' : 'New online request',
          body: req.displayName || req.targetIdentifier || (deps.lang === 'es' ? 'Tienes una solicitud de amistad pendiente' : 'You have a pending friend request'),
          nav: 'online-amigos',
        });
      }
      return true;
    }
    return false;
  }

  function parseEventData(event) {
    try {
      return JSON.parse(event.data || '{}');
    } catch {
      return null;
    }
  }

  function handleEventData(data, deps) {
    const { saveOnlineSyncState, loadOnlineSyncState, render } = deps;
    handleOnlineRealtimeChange(data, deps).then(applied => {
      if (!applied) scheduleOnlineRealtimeSync(deps);
      else if (typeof render === 'function') render();
    }).catch(() => scheduleOnlineRealtimeSync(deps));
    if (data?.cursor) {
      saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), realtimeLastEventAt: new Date().toISOString(), cursorHint: data.cursor, lastError: null });
    }
  }

  function startOnlineEventsChannel(deps) {
    latestDeps = deps;
    const {
      loadOnlineSession,
      getOnlineApiBaseUrl,
      loadOnlineSyncState,
      saveOnlineSyncState,
      getOnlineProfile,
      hasOnlineBackendConfigured,
      EventSourceCtor = window.EventSource,
    } = deps;
    const session = loadOnlineSession();
    const baseUrl = getOnlineApiBaseUrl();
    if (eventsSource || !session?.authToken || !baseUrl || typeof EventSourceCtor === 'undefined') return false;
    if (!onlineListenerBound && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      onlineListenerBound = true;
      window.addEventListener('online', () => {
        const activeDeps = latestDeps || deps;
        const { loadOnlineSyncState, saveOnlineSyncState, getOnlineProfile, hasOnlineBackendConfigured } = activeDeps;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        if (eventsSource) return;
        if (!getOnlineProfile().enabled || !hasOnlineBackendConfigured()) return;
        saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), realtimeOnlineAt: new Date().toISOString(), lastError: null });
        startOnlineEventsChannel(activeDeps);
        scheduleOnlineRealtimeSync(activeDeps);
      });
      window.addEventListener('offline', () => {
        const activeDeps = latestDeps || deps;
        const { loadOnlineSyncState, saveOnlineSyncState } = activeDeps;
        if (eventsSource) {
          eventsSource.close();
          eventsSource = null;
        }
        saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), realtimeOfflineAt: new Date().toISOString(), realtimeState: 'offline', lastError: 'browser_offline' });
      });
    }
    if (!lifecycleListenerBound && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      lifecycleListenerBound = true;
      const resume = () => {
        const activeDeps = latestDeps || deps;
        if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
        const state = activeDeps.loadOnlineSyncState() || {};
        activeDeps.saveOnlineSyncState({ ...state, realtimeForegroundAt: new Date().toISOString(), realtimeState: 'resuming', lastError: null });
        if (!eventsSource && activeDeps.getOnlineProfile().enabled && activeDeps.hasOnlineBackendConfigured()) startOnlineEventsChannel(activeDeps);
        scheduleOnlineRealtimeSync(activeDeps);
        if (typeof activeDeps.flushOnlineMessageOutbox === 'function') activeDeps.flushOnlineMessageOutbox().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        const activeDeps = latestDeps || deps;
        if (document.visibilityState === 'hidden') {
          if (eventsSource) { eventsSource.close(); eventsSource = null; }
          activeDeps.saveOnlineSyncState({ ...(activeDeps.loadOnlineSyncState() || {}), realtimeBackgroundAt: new Date().toISOString(), realtimeState: 'background' });
        } else resume();
      });
      window.addEventListener('pageshow', resume);
      window.addEventListener('pagehide', () => {
        const activeDeps = latestDeps || deps;
        activeDeps.saveOnlineSyncState({ ...(activeDeps.loadOnlineSyncState() || {}), realtimeBackgroundAt: new Date().toISOString(), realtimeState: 'background' });
      });
    }
    const cursor = encodeURIComponent(loadOnlineSyncState().cursor || '0');
    const token = encodeURIComponent(session.authToken);
    const url = `${baseUrl}/v1/events?token=${token}&cursor=${cursor}`;
    eventsSource = new EventSourceCtor(url);
    eventsSource.addEventListener('connected', event => {
      try {
        const data = JSON.parse(event.data || '{}');
        if (data?.cursor) saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), cursor: data.cursor, realtimeConnectedAt: new Date().toISOString(), lastError: null });
      } catch {}
    });
    eventsSource.addEventListener('change', event => handleEventData(parseEventData(event), deps));
    ['friend_request.created','friend_request.updated','friendship.created','friendship.updated','friendship.deleted','conversation.message','conversation.read','presence.updated'].forEach(type => {
      eventsSource.addEventListener(type, event => handleEventData(parseEventData(event), deps));
    });
    eventsSource.onerror = () => {
      if (eventsSource) {
        eventsSource.close();
        eventsSource = null;
      }
      saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), realtimeDisconnectedAt: new Date().toISOString(), realtimeState: 'error', lastError: 'realtime_disconnected' });
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (getOnlineProfile().enabled && hasOnlineBackendConfigured()) {
          startOnlineEventsChannel(deps);
          scheduleOnlineRealtimeSync(deps);
        }
      }, 3000);
    };
    return true;
  }

  function stopOnlineEventsChannel() {
    if (eventsSource) {
      eventsSource.close();
      eventsSource = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    syncPending = false;
  }

  window.AtriaOnlineRealtime = {
    scheduleOnlineRealtimeSync,
    applyOnlineRealtimeMessage,
    applyOnlineRealtimeRead,
    applyOnlineRealtimePresence,
    handleOnlineRealtimeChange,
    startOnlineEventsChannel,
    stopOnlineEventsChannel,
  };
})();
