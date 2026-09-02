(function () {
  const ONLINE_CONVERSATIONS_KEY = 'tid_online_conversations_cache';
  const ONLINE_CONVERSATION_INDEX_KEY = 'tid_online_conversation_index';

  function readObject(key) {
    const saved = window.AtriaStorage.parseJsonKey(key, {});
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }

  function writeObject(key, value) {
    window.AtriaStorage.writeJsonKey(key, value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  }

  function loadOnlineConversations() {
    return readObject(ONLINE_CONVERSATIONS_KEY);
  }

  function saveOnlineConversations(conversations) {
    writeObject(ONLINE_CONVERSATIONS_KEY, conversations);
  }

  function getOnlineConversationMessages(friendId) {
    const all = loadOnlineConversations();
    return Array.isArray(all[friendId]) ? all[friendId] : [];
  }

  function appendOnlineConversationMessage(friendId, message) {
    const all = loadOnlineConversations();
    if (!Array.isArray(all[friendId])) all[friendId] = [];
    all[friendId].push(message);
    if (all[friendId].length > 500) all[friendId] = all[friendId].slice(-500);
    saveOnlineConversations(all);
  }

  function loadOnlineConversationIndex() {
    return readObject(ONLINE_CONVERSATION_INDEX_KEY);
  }

  function saveOnlineConversationIndex(index) {
    writeObject(ONLINE_CONVERSATION_INDEX_KEY, index);
  }

  function getOnlineConversationMeta(friendId) {
    const index = loadOnlineConversationIndex();
    return index[friendId] || {};
  }

  function setOnlineConversationMeta(friendId, patch) {
    const index = loadOnlineConversationIndex();
    index[friendId] = { ...(index[friendId] || {}), ...patch };
    saveOnlineConversationIndex(index);
    return index[friendId];
  }

  function getOnlineTotalUnreadCount() {
    const index = loadOnlineConversationIndex();
    return Object.values(index).reduce((sum, meta) => sum + (Number(meta.unreadCount) || 0), 0);
  }

  function mergeOnlineConversationMessages(friendId, normalized) {
    const existing = getOnlineConversationMessages(friendId);
    const byId = new Map();
    existing.forEach(msg => byId.set(msg.id, msg));
    normalized.forEach(msg => byId.set(msg.id, { ...(byId.get(msg.id) || {}), ...msg }));
    const merged = Array.from(byId.values()).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const all = loadOnlineConversations();
    all[friendId] = merged;
    saveOnlineConversations(all);
    const meta = getOnlineConversationMeta(friendId);
    const lastReadTs = meta.lastReadTs || 0;
    const unreadCount = merged.filter(msg => msg.dir === 'in' && (msg.ts || 0) > lastReadTs).length;
    setOnlineConversationMeta(friendId, {
      unreadCount,
      lastMessageTs: merged.length ? merged[merged.length - 1].ts : meta.lastMessageTs || 0,
    });
    return merged;
  }

  window.AtriaOnlineConversationsStorage = {
    keys: {
      ONLINE_CONVERSATIONS_KEY,
      ONLINE_CONVERSATION_INDEX_KEY,
    },
    loadOnlineConversations,
    saveOnlineConversations,
    getOnlineConversationMessages,
    appendOnlineConversationMessage,
    loadOnlineConversationIndex,
    saveOnlineConversationIndex,
    getOnlineConversationMeta,
    setOnlineConversationMeta,
    getOnlineTotalUnreadCount,
    mergeOnlineConversationMessages,
  };
})();
