(function () {
  const STRINGS = {
    es: {
      selectFriend: 'Selecciona una amistad',
      friendNotFound: 'Amistad no encontrada',
      invalidOpenResponse: 'Respuesta invalida al abrir la conversacion',
      chatDisabled: 'Chat desactivado para esta amistad',
      encryptionRequired: 'No se pudo cifrar el mensaje online. Vuelve a sincronizar la amistad e intentalo de nuevo.',
      encryptedMessage: '[mensaje cifrado]',
    },
    en: {
      selectFriend: 'Select a friend',
      friendNotFound: 'Friend not found',
      invalidOpenResponse: 'Invalid response while opening the conversation',
      chatDisabled: 'Chat is disabled for this friendship',
      encryptionRequired: 'The online message could not be encrypted. Refresh this friendship and try again.',
      encryptedMessage: '[encrypted message]',
    },
  };

  function strings(lang) {
    return STRINGS[lang] || STRINGS.en;
  }

  async function ensureOnlineConversation(friend, deps) {
    const s = strings(deps.lang);
    if (!friend) throw new Error(s.selectFriend);
    if (friend.permissions?.chat === false) throw new Error(s.chatDisabled);
    const index = deps.loadOnlineConversationIndex();
    if (index[friend.id]?.conversationId) return index[friend.id].conversationId;
    const data = await deps.onlineFetch('/v1/conversations/dm', {
      method: 'POST',
      body: JSON.stringify({
        targetIdentifier: friend.identifier,
      }),
    });
    const conversationId = data?.conversation?.id || data?.id || data?.conversationId;
    if (!conversationId) throw new Error(s.invalidOpenResponse);
    index[friend.id] = { conversationId, lastSyncAt: new Date().toISOString() };
    deps.saveOnlineConversationIndex(index);
    return conversationId;
  }

  async function refreshOnlineConversation(friendId, deps) {
    const s = strings(deps.lang);
    const friend = deps.loadOnlineFriends().find(f => f.id === friendId);
    if (!friend) throw new Error(s.friendNotFound);
    if (friend.permissions?.chat === false) throw new Error(s.chatDisabled);
    if (!deps.hasOnlineBackendConfigured()) return deps.getOnlineConversationMessages(friendId);
    const conversationId = await ensureOnlineConversation(friend, deps);
    const data = await deps.onlineFetch(`/v1/conversations/${encodeURIComponent(conversationId)}/messages`);
    const rawMessages = Array.isArray(data?.messages) ? data.messages : Array.isArray(data) ? data : [];
    const messages = typeof deps.migrateOnlineConversationCiphertext === 'function'
      ? await deps.migrateOnlineConversationCiphertext(friend, conversationId, rawMessages)
      : rawMessages;
    const normalized = await Promise.all(messages.map(async msg => {
      const payload = typeof deps.decryptOnlineMessagePayload === 'function'
        ? await deps.decryptOnlineMessagePayload(friend, msg).catch(() => null)
        : null;
      const text = payload
        ? (payload.text || s.encryptedMessage)
        : (typeof deps.decryptOnlineMessageText === 'function'
          ? await deps.decryptOnlineMessageText(friend, msg).catch(() => msg.body || msg.text || s.encryptedMessage)
          : (msg.body || msg.text || s.encryptedMessage));
      return {
        id: msg.id || deps.uid(),
        dir: (msg.senderSystemId && msg.senderSystemId === (deps.loadOnlineAccount()?.systemId || '')) ? 'out' : 'in',
        text,
        ts: msg.createdAt ? new Date(msg.createdAt).getTime() : (msg.ts || Date.now()),
        senderDisplayName: msg.senderDisplayName || null,
        senderAlter: payload?.senderAlter || msg.senderAlter || null,
        readByPeer: !!msg.readByPeer,
      };
    }));
    return deps.mergeOnlineConversationMessages(friendId, normalized);
  }

  async function sendOnlineConversationMessage(friendId, text, deps, options = {}) {
    const s = strings(deps.lang);
    const friend = deps.loadOnlineFriends().find(f => f.id === friendId);
    if (!friend) throw new Error(s.friendNotFound);
    if (friend.permissions?.chat === false) throw new Error(s.chatDisabled);
    if (!deps.hasOnlineBackendConfigured()) {
      deps.appendOnlineConversationMessage(friendId, { id: deps.uid(), dir: 'out', text, ts: Date.now(), senderAlter: options.senderAlter || null, readByPeer: false });
      deps.setOnlineConversationMeta(friendId, { lastMessageTs: Date.now() });
      return { mode: 'local' };
    }
    const conversationId = await ensureOnlineConversation(friend, deps);
    const packet = typeof deps.encryptOnlineMessagePacket === 'function'
      ? await deps.encryptOnlineMessagePacket(friend, text, options).catch(() => null)
      : null;
    if (!packet) throw new Error(s.encryptionRequired);
    const data = await deps.onlineFetch(`/v1/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ packet, encrypted: true }),
    });
    deps.appendOnlineConversationMessage(friendId, {
      id: data?.message?.id || deps.uid(),
      dir: 'out',
      text,
      ts: data?.message?.createdAt ? new Date(data.message.createdAt).getTime() : Date.now(),
      senderDisplayName: data?.message?.senderDisplayName || null,
      senderAlter: options.senderAlter || null,
      readByPeer: false,
    });
    deps.setOnlineConversationMeta(friendId, { lastMessageTs: Date.now() });
    return { mode: 'remote', data };
  }

  async function markOnlineConversationRead(friendId, deps) {
    const meta = deps.getOnlineConversationMeta(friendId);
    const messages = deps.getOnlineConversationMessages(friendId);
    const lastIncomingTs = messages.filter(m => m.dir === 'in').reduce((max, m) => Math.max(max, m.ts || 0), 0);
    deps.setOnlineConversationMeta(friendId, {
      unreadCount: 0,
      lastReadTs: Math.max(meta.lastReadTs || 0, lastIncomingTs || Date.now()),
    });
    if (!deps.hasOnlineBackendConfigured()) return { mode: 'local' };
    const friend = deps.loadOnlineFriends().find(f => f.id === friendId);
    if (!friend) return { mode: 'local' };
    const conversationId = await ensureOnlineConversation(friend, deps);
    await deps.onlineFetch(`/v1/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return { mode: 'remote' };
  }

  window.AtriaOnlineConversations = {
    ensureOnlineConversation,
    refreshOnlineConversation,
    sendOnlineConversationMessage,
    markOnlineConversationRead,
  };
})();
