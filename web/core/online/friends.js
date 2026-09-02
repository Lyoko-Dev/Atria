(function () {
  const ONLINE_FRIENDS_KEY = 'tid_online_friends_cache';
  const ONLINE_FRIEND_REQUESTS_KEY = 'tid_online_friend_requests_cache';
  const ONLINE_FRIEND_LOOKUP_CACHE_KEY = 'tid_online_friend_lookup_cache';
  const DEFAULT_ONLINE_FRIEND_PERMISSIONS = {
    viewFronting: true,
    frontNotifications: false,
    chat: true,
    profileSharing: 'none',
    selectedProfileIds: [],
    journalSharing: false,
    pollsSharing: false,
  };

  const STRINGS = {
    es: {
      emptyIdentifier: 'Necesitas escribir un ID, codigo o correo',
      enableOnlineFirst: 'Activa primero las funciones online',
      selfRequest: 'No puedes enviarte una solicitud a ti',
      duplicateRequest: 'Ya hay una solicitud pendiente para ese destino',
      invalidIdentifier: 'Identificador invalido',
      fallbackFriendName: 'Amistad',
    },
    en: {
      emptyIdentifier: 'Enter an ID, code or email',
      enableOnlineFirst: 'Enable online features first',
      selfRequest: 'You cannot send a request to yourself',
      duplicateRequest: 'A pending request already exists for that destination',
      invalidIdentifier: 'Invalid identifier',
      fallbackFriendName: 'Friend',
    },
  };

  function strings(lang) {
    return STRINGS[lang] || STRINGS.en;
  }

  function readArray(key) {
    const saved = window.AtriaStorage.parseJsonKey(key, []);
    return Array.isArray(saved) ? saved : [];
  }

  function writeArray(key, value) {
    window.AtriaStorage.writeJsonKey(key, Array.isArray(value) ? value : []);
  }

  function loadOnlineFriends() {
    return readArray(ONLINE_FRIENDS_KEY);
  }

  function saveOnlineFriends(friends) {
    writeArray(ONLINE_FRIENDS_KEY, friends);
  }

  function loadOnlineFriendRequests() {
    return readArray(ONLINE_FRIEND_REQUESTS_KEY);
  }

  function saveOnlineFriendRequests(requests) {
    writeArray(ONLINE_FRIEND_REQUESTS_KEY, requests);
  }

  function loadOnlineFriendLookupCache() {
    return readArray(ONLINE_FRIEND_LOOKUP_CACHE_KEY);
  }

  function saveOnlineFriendLookupCache(results) {
    writeArray(ONLINE_FRIEND_LOOKUP_CACHE_KEY, results);
  }

  function normalizeFriendIdentifier(raw) {
    return String(raw || '').trim().toLowerCase();
  }

  function detectFriendIdentifierType(raw) {
    const value = normalizeFriendIdentifier(raw);
    if (!value) return '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
    if (/^atria-\d{4}-\d{4}-\d{4}$/i.test(value)) return 'friend_code';
    return 'system_id';
  }

  function normalizeOnlineFriendPermissions(permissions = {}) {
    const value = permissions && typeof permissions === 'object' && !Array.isArray(permissions) ? permissions : {};
    const profileSharing = ['none', 'selected', 'all'].includes(value.profileSharing) ? value.profileSharing : 'none';
    const selectedProfileIds = Array.isArray(value.selectedProfileIds)
      ? [...new Set(value.selectedProfileIds.map(id => String(id || '').trim()).filter(Boolean))].slice(0, 500)
      : [];
    return {
      viewFronting: value.viewFronting !== false,
      frontNotifications: value.frontNotifications === true,
      chat: value.chat !== false,
      profileSharing,
      selectedProfileIds: profileSharing === 'selected' ? selectedProfileIds : [],
      journalSharing: value.journalSharing === true,
      pollsSharing: value.pollsSharing === true,
    };
  }

  function buildOnlinePrivacyLockdownPermissions() {
    return {
      viewFronting: false,
      frontNotifications: false,
      chat: false,
      profileSharing: 'none',
      selectedProfileIds: [],
      journalSharing: false,
      pollsSharing: false,
    };
  }

  function friendPermissionEnabled(friend, key) {
    const permissions = normalizeOnlineFriendPermissions(friend?.permissions);
    return permissions[key] !== false;
  }

  function createLocalOnlineFriendRequest(identifier, source = 'manual', deps) {
    const { uid, loadOnlineAccount, lang = 'en' } = deps;
    const s = strings(lang);
    const value = normalizeFriendIdentifier(identifier);
    if (!value) throw new Error(s.emptyIdentifier);
    const type = detectFriendIdentifierType(value);
    const account = loadOnlineAccount();
    if (!account) throw new Error(s.enableOnlineFirst);
    if (
      (type === 'email' && value === String(account.email || '').toLowerCase())
      || (type === 'system_id' && value === String(account.systemId || '').toLowerCase())
      || (type === 'friend_code' && value === String(account.friendCode || '').toLowerCase())
    ) {
      throw new Error(s.selfRequest);
    }
    const requests = loadOnlineFriendRequests();
    if (requests.some(r => r.identifier === value && r.status === 'pending' && r.direction === 'outgoing')) {
      throw new Error(s.duplicateRequest);
    }
    const now = new Date().toISOString();
    const req = {
      id: uid(),
      identifier: value,
      identifierType: type,
      direction: 'outgoing',
      status: 'pending',
      source,
      createdAt: now,
      updatedAt: now,
    };
    requests.unshift(req);
    saveOnlineFriendRequests(requests.slice(0, 100));
    return req;
  }

  function cancelLocalOnlineFriendRequest(requestId) {
    const requests = loadOnlineFriendRequests().map(r => r.id === requestId ? { ...r, status: 'cancelled', updatedAt: new Date().toISOString() } : r);
    saveOnlineFriendRequests(requests);
  }

  function createLocalOnlineFriend(identifier, displayName, deps) {
    const { uid, lang = 'en' } = deps;
    const value = normalizeFriendIdentifier(identifier);
    if (!value) throw new Error(strings(lang).invalidIdentifier);
    const friends = loadOnlineFriends();
    if (friends.some(f => f.identifier === value)) return null;
    const type = detectFriendIdentifierType(value);
    const friend = {
      id: uid(),
      identifier: value,
      identifierType: type,
      displayName: displayName || value,
      systemId: type === 'system_id' ? value : null,
      friendCode: type === 'friend_code' ? value.toUpperCase() : null,
      email: type === 'email' ? value : null,
      permissions: normalizeOnlineFriendPermissions(),
      addedAt: new Date().toISOString(),
    };
    friends.unshift(friend);
    saveOnlineFriends(friends.slice(0, 200));
    return friend;
  }

  async function acceptLocalOnlineFriendRequest(requestId, deps) {
    const { hasOnlineBackendConfigured, onlineFetch } = deps;
    if (hasOnlineBackendConfigured() && typeof onlineFetch === 'function') {
      const requests = loadOnlineFriendRequests();
      const req = requests.find(r => r.id === requestId);
      if (req) {
        req.status = 'accepted';
        req.updatedAt = new Date().toISOString();
        saveOnlineFriendRequests(requests);
        createLocalOnlineFriend(req.identifier, req.displayName || req.identifier, deps);
      }
      const data = await onlineFetch('/v1/friends/request/respond', {
        method: 'PATCH',
        body: JSON.stringify({ requestId, decision: 'accept' }),
      });
      refreshOnlineFriendsFromBackend(deps).catch(() => {});
      return data?.friend || null;
    }
    const requests = loadOnlineFriendRequests();
    const req = requests.find(r => r.id === requestId);
    if (!req) return null;
    req.status = 'accepted';
    req.updatedAt = new Date().toISOString();
    saveOnlineFriendRequests(requests);
    return createLocalOnlineFriend(req.identifier, req.identifier, deps);
  }

  async function rejectLocalOnlineFriendRequest(requestId, deps) {
    const { hasOnlineBackendConfigured, onlineFetch } = deps;
    if (hasOnlineBackendConfigured() && typeof onlineFetch === 'function') {
      const requests = loadOnlineFriendRequests().map(r => r.id === requestId ? { ...r, status: 'rejected', updatedAt: new Date().toISOString() } : r);
      saveOnlineFriendRequests(requests);
      await onlineFetch('/v1/friends/request/respond', {
        method: 'PATCH',
        body: JSON.stringify({ requestId, decision: 'reject' }),
      });
      refreshOnlineFriendsFromBackend(deps).catch(() => {});
      return;
    }
    const requests = loadOnlineFriendRequests().map(r => r.id === requestId ? { ...r, status: 'rejected', updatedAt: new Date().toISOString() } : r);
    saveOnlineFriendRequests(requests);
  }

  function findOnlineFriendBySystemId(systemId) {
    return loadOnlineFriends().find(friend => friend.systemId && friend.systemId === systemId) || null;
  }

  function normalizeBackendFriend(friend, deps) {
    const { uid, lang = 'en' } = deps;
    const s = strings(lang);
    return {
      id: friend.id || uid(),
      identifier: friend.friendCode || friend.systemId || friend.email || friend.handle || friend.displayName || friend.id,
      identifierType: friend.friendCode ? 'friend_code' : (friend.systemId ? 'system_id' : (friend.email ? 'email' : 'system_id')),
      displayName: friend.displayName || friend.friendCode || friend.handle || friend.systemId || friend.email || s.fallbackFriendName,
      systemId: friend.systemId || null,
      friendCode: friend.friendCode || null,
      email: friend.email || null,
      cryptoPublicKey: friend.cryptoPublicKey || null,
      cryptoSigPub: friend.cryptoSigPub || null,
      permissions: normalizeOnlineFriendPermissions(friend.permissions),
      addedAt: friend.createdAt || friend.addedAt || new Date().toISOString(),
    };
  }

  function normalizeBackendRequest(req, deps) {
    const { uid } = deps;
    return {
      id: req.id || uid(),
      identifier: req.targetIdentifier || req.targetSystemId || req.email || req.handle || req.displayName || req.id,
      identifierType: req.email ? 'email' : (req.targetIdentifier?.startsWith?.('atria-') ? 'friend_code' : 'system_id'),
      direction: req.direction || (req.isIncoming ? 'incoming' : 'outgoing'),
      status: req.status || 'pending',
      source: 'backend',
      createdAt: req.createdAt || new Date().toISOString(),
      updatedAt: req.updatedAt || req.createdAt || new Date().toISOString(),
    };
  }

  async function refreshOnlineFriendsFromBackend(deps) {
    const { hasOnlineBackendConfigured, onlineFetch } = deps;
    if (!hasOnlineBackendConfigured() || typeof onlineFetch !== 'function') {
      return {
        friends: loadOnlineFriends(),
        requests: loadOnlineFriendRequests(),
        mode: 'local',
      };
    }
    const [friendsData, requestsData] = await Promise.all([
      onlineFetch('/v1/friends'),
      onlineFetch('/v1/friends/requests'),
    ]);
    const friends = Array.isArray(friendsData?.friends) ? friendsData.friends.map(friend => normalizeBackendFriend(friend, deps)) : [];
    const requests = Array.isArray(requestsData?.requests) ? requestsData.requests.map(req => normalizeBackendRequest(req, deps)) : [];
    saveOnlineFriends(friends);
    saveOnlineFriendRequests(requests);
    return { friends, requests, mode: 'remote' };
  }

  async function lookupOnlineAccounts(query, deps) {
    const { uid, hasOnlineBackendConfigured, onlineFetch } = deps;
    const value = normalizeFriendIdentifier(query);
    if (!value) return [];
    if (!hasOnlineBackendConfigured() || typeof onlineFetch !== 'function') {
      const type = detectFriendIdentifierType(value);
      const local = [{
        id: `lookup-${value}`,
        identifier: value,
        identifierType: type,
        displayName: value,
        systemId: type === 'system_id' ? value : null,
        email: type === 'email' ? value : null,
        source: 'local',
      }];
      saveOnlineFriendLookupCache(local);
      return local;
    }
    const data = await onlineFetch(`/v1/friends/lookup?q=${encodeURIComponent(value)}`);
    const results = Array.isArray(data?.results) ? data.results.map(item => ({
      id: item.id || uid(),
      identifier: item.friendCode || item.systemId || item.email || item.handle || value,
      identifierType: item.friendCode ? 'friend_code' : (item.email ? 'email' : 'system_id'),
      displayName: item.displayName || item.friendCode || item.handle || item.systemId || item.email || value,
      systemId: item.systemId || null,
      friendCode: item.friendCode || null,
      email: item.email || null,
      cryptoPublicKey: item.cryptoPublicKey || null,
      cryptoSigPub: item.cryptoSigPub || null,
      permissions: normalizeOnlineFriendPermissions(item.permissions),
      source: 'backend',
    })) : [];
    saveOnlineFriendLookupCache(results);
    return results;
  }

  async function sendOnlineFriendRequest(identifier, deps) {
    const { hasOnlineBackendConfigured, onlineFetch } = deps;
    if (!hasOnlineBackendConfigured() || typeof onlineFetch !== 'function') {
      return { request: createLocalOnlineFriendRequest(identifier, 'config', deps), mode: 'local' };
    }
    const data = await onlineFetch('/v1/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetIdentifier: normalizeFriendIdentifier(identifier) }),
    });
    refreshOnlineFriendsFromBackend(deps).catch(() => {});
    return { request: data?.request || null, status: data?.status || '', mode: 'remote' };
  }

  async function updateOnlineFriendPermissions(friendId, permissions, deps) {
    const normalized = normalizeOnlineFriendPermissions(permissions);
    const friends = loadOnlineFriends();
    const friend = friends.find(item => item.id === friendId);
    if (!friend) throw new Error('friend_not_found');
    const next = friends.map(item => item.id === friendId ? { ...item, permissions: normalized } : item);
    saveOnlineFriends(next);
    const { hasOnlineBackendConfigured, onlineFetch } = deps;
    if (hasOnlineBackendConfigured() && typeof onlineFetch === 'function') {
      const target = friend.systemId || friend.friendCode || friend.identifier || friend.id || '';
      const data = await onlineFetch(`/v1/friends/${encodeURIComponent(target)}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: normalized }),
      });
      const updated = data?.friend ? normalizeBackendFriend(data.friend, deps) : null;
      if (updated) {
        const latest = loadOnlineFriends().map(item => item.id === friendId ? updated : item);
        saveOnlineFriends(latest);
        return updated.permissions;
      }
    }
    return normalized;
  }

  async function bulkUpdateOnlineFriendPermissions(friendIds, permissions, deps) {
    const ids = new Set(Array.isArray(friendIds) ? friendIds : []);
    const targets = loadOnlineFriends().filter(friend => ids.size === 0 || ids.has(friend.id));
    const results = [];
    for (const friend of targets) {
      results.push(await updateOnlineFriendPermissions(friend.id, permissions, deps));
    }
    return { count: targets.length, permissions: normalizeOnlineFriendPermissions(permissions), results };
  }

  async function removeOnlineFriend(friend, deps) {
    const { hasOnlineBackendConfigured, onlineFetch } = deps;
    const target = friend?.systemId || friend?.friendCode || friend?.identifier || friend?.id || '';
    if (!target) throw new Error('missing_friend_identifier');
    if (hasOnlineBackendConfigured() && typeof onlineFetch === 'function') {
      await onlineFetch(`/v1/friends/${encodeURIComponent(target)}`, { method: 'DELETE' });
      refreshOnlineFriendsFromBackend(deps).catch(() => {});
    }
    const next = loadOnlineFriends().filter(item =>
      item.id !== friend.id &&
      item.systemId !== friend.systemId &&
      item.identifier !== friend.identifier
    );
    saveOnlineFriends(next);
    const pendingRequests = loadOnlineFriendRequests().map(request => {
      const matchesFriend =
        (friend.systemId && (request.identifier === friend.systemId || request.targetIdentifier === friend.systemId || request.targetSystemId === friend.systemId || request.fromSystemId === friend.systemId || request.toSystemId === friend.systemId)) ||
        (friend.friendCode && (request.identifier === friend.friendCode || request.targetIdentifier === friend.friendCode)) ||
        (friend.identifier && (request.identifier === friend.identifier || request.targetIdentifier === friend.identifier));
      return matchesFriend && request.status === 'pending'
        ? { ...request, status: 'cancelled', updatedAt: new Date().toISOString() }
        : request;
    });
    saveOnlineFriendRequests(pendingRequests);
    if (typeof deps.loadOnlinePresenceCache === 'function' && typeof deps.saveOnlinePresenceCache === 'function') {
      const presence = deps.loadOnlinePresenceCache();
      if (presence && typeof presence === 'object') {
        delete presence[friend.id];
        deps.saveOnlinePresenceCache(presence);
      }
    }
    return next;
  }

  window.AtriaOnlineFriends = {
    keys: {
      ONLINE_FRIENDS_KEY,
      ONLINE_FRIEND_REQUESTS_KEY,
      ONLINE_FRIEND_LOOKUP_CACHE_KEY,
    },
    loadOnlineFriends,
    saveOnlineFriends,
    loadOnlineFriendRequests,
    saveOnlineFriendRequests,
    loadOnlineFriendLookupCache,
    saveOnlineFriendLookupCache,
    normalizeFriendIdentifier,
    detectFriendIdentifierType,
    normalizeOnlineFriendPermissions,
    buildOnlinePrivacyLockdownPermissions,
    friendPermissionEnabled,
    createLocalOnlineFriendRequest,
    cancelLocalOnlineFriendRequest,
    createLocalOnlineFriend,
    acceptLocalOnlineFriendRequest,
    rejectLocalOnlineFriendRequest,
    findOnlineFriendBySystemId,
    refreshOnlineFriendsFromBackend,
    lookupOnlineAccounts,
    sendOnlineFriendRequest,
    updateOnlineFriendPermissions,
    bulkUpdateOnlineFriendPermissions,
    removeOnlineFriend,
  };
})();
