(function () {
  function accountOptions(deps = {}) {
    return { defaultDeviceName: deps.defaultDeviceName || 'This device' };
  }

  function buildOnlineSystemId(cfg) {
    return window.AtriaOnlineAccount.buildOnlineSystemId(cfg);
  }

  function getOnlineProfile(cfg, deps = {}) {
    return window.AtriaOnlineAccount.getOnlineProfile(cfg, accountOptions(deps));
  }

  function loadOnlineAccount(deps = {}) {
    return window.AtriaOnlineAccount.loadOnlineAccount(deps.loadConfig);
  }

  function saveOnlineAccount(account, deps = {}) {
    return window.AtriaOnlineAccount.saveOnlineAccount(account, deps.loadConfig, deps.saveConfig);
  }

  function loadOnlineSession(deps = {}) {
    return window.AtriaOnlineAccount.loadOnlineSession(deps.loadConfig, accountOptions(deps));
  }

  function saveOnlineSession(session, deps = {}) {
    return window.AtriaOnlineAccount.saveOnlineSession(session, deps.loadConfig);
  }

  function loadOnlineKeypair() {
    return window.AtriaOnlineAccount.loadOnlineKeypair();
  }

  function saveOnlineKeypair(keypair) {
    return window.AtriaOnlineAccount.saveOnlineKeypair(keypair);
  }

  function loadOnlineDevicesCache() {
    return window.AtriaOnlineAccount.loadOnlineDevicesCache();
  }

  function saveOnlineDevicesCache(devices) {
    return window.AtriaOnlineAccount.saveOnlineDevicesCache(devices);
  }

  function upsertOnlineDevice(deviceName, email, systemId) {
    return window.AtriaOnlineAccount.upsertOnlineDevice(deviceName, email, systemId);
  }

  function activateOnlineAccountSession(session, deps = {}) {
    return window.AtriaOnlineAccount.activateOnlineAccountSession(session, {
      loadConfig: deps.loadConfig,
      saveConfig: deps.saveConfig,
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      startOnlineSyncLoop: deps.startOnlineSyncLoop,
      stopOnlineSyncLoop: deps.stopOnlineSyncLoop,
    });
  }

  function disableOnlineAccountSession(deps = {}) {
    return window.AtriaOnlineAccount.disableOnlineAccountSession({
      loadConfig: deps.loadConfig,
      saveConfig: deps.saveConfig,
      stopOnlineSyncLoop: deps.stopOnlineSyncLoop,
    });
  }

  function getOnlineApiBaseUrl(cfg) {
    return window.AtriaOnlineBackend.getOnlineApiBaseUrl(cfg);
  }

  function hasOnlineBackendConfigured(cfg) {
    return window.AtriaOnlineBackend.hasOnlineBackendConfigured(cfg);
  }

  function getOnlineBackendStateLabel(cfg, deps = {}) {
    return window.AtriaOnlineBackend.getOnlineBackendStateLabel(cfg, deps.lang || 'en');
  }

  function onlineFetch(path, options = {}, deps = {}) {
    return window.AtriaOnlineBackend.onlineFetch(path, options, deps);
  }

  function onlineAuthFetch(path, payload, deps = {}) {
    return window.AtriaOnlineBackend.onlineAuthFetch(path, payload, deps);
  }

  function getOnlineAuthDeps(deps = {}) {
    return {
      lang: deps.lang || 'en',
      generateBridgeKeypair: deps.generateBridgeKeypair,
      encryptBackupData: deps.encryptBackupData,
      decryptBackupPayload: deps.decryptBackupPayload,
      getOrCreateOnlineBackupSecret: deps.getOrCreateOnlineBackupSecret,
      saveOnlineBackupSecret: deps.saveOnlineBackupSecret,
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      onlineFetch: deps.onlineFetch,
      onlineAuthFetch: deps.onlineAuthFetch,
      loadOnlineKeypair: deps.loadOnlineKeypair,
      activateOnlineAccountSession: deps.activateOnlineAccountSession,
      buildOnlineSystemId: deps.buildOnlineSystemId,
      loadConfig: deps.loadConfig,
      restoreOnlineAutomaticBackup: typeof deps.restoreOnlineAutomaticBackup === 'function' ? deps.restoreOnlineAutomaticBackup : null,
      runOnlineAutomaticBackup: typeof deps.runOnlineAutomaticBackup === 'function' ? deps.runOnlineAutomaticBackup : null,
      runOnlineSyncBootstrap: typeof deps.runOnlineSyncBootstrap === 'function' ? deps.runOnlineSyncBootstrap : null,
    };
  }

  function buildOnlineCryptoRegistration(password, deps = {}) {
    return window.AtriaOnlineAuth.buildOnlineCryptoRegistration(password, getOnlineAuthDeps(deps));
  }

  function uploadOnlineCryptoBundle(upload, deps = {}) {
    return window.AtriaOnlineAuth.uploadOnlineCryptoBundle(upload, getOnlineAuthDeps(deps));
  }

  function restoreOnlineKeypairFromAccount(account, password, deps = {}) {
    return window.AtriaOnlineAuth.restoreOnlineKeypairFromAccount(account, password, getOnlineAuthDeps(deps));
  }

  function ensureOnlineCryptoProvisioned(account, password, deps = {}) {
    return window.AtriaOnlineAuth.ensureOnlineCryptoProvisioned(account, password, getOnlineAuthDeps(deps));
  }

  function registerOnlineAccountRemote(payload, deps = {}) {
    return window.AtriaOnlineAuth.registerOnlineAccountRemote(payload, getOnlineAuthDeps(deps));
  }

  function loginOnlineAccountRemote(payload, deps = {}) {
    return window.AtriaOnlineAuth.loginOnlineAccountRemote(payload, getOnlineAuthDeps(deps));
  }

  function requestOnlinePasswordReset(payload, deps = {}) {
    return window.AtriaOnlineAuth.requestOnlinePasswordReset(payload, getOnlineAuthDeps(deps));
  }

  function requestOnlinePasswordResetCrypto(payload, deps = {}) {
    return window.AtriaOnlineAuth.requestOnlinePasswordResetCrypto(payload, getOnlineAuthDeps(deps));
  }

  function confirmOnlinePasswordReset(payload, deps = {}) {
    return window.AtriaOnlineAuth.confirmOnlinePasswordReset(payload, getOnlineAuthDeps(deps));
  }

  function getOnlineFriendsDeps(deps = {}) {
    return {
      lang: deps.lang || 'en',
      uid: deps.uid,
      loadOnlineAccount: deps.loadOnlineAccount,
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      onlineFetch: deps.onlineFetch,
      loadOnlinePresenceCache: deps.loadOnlinePresenceCache || loadOnlinePresenceCache,
      saveOnlinePresenceCache: deps.saveOnlinePresenceCache || saveOnlinePresenceCache,
    };
  }

  function getOnlineDevicesDeps(deps = {}) {
    return {
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      onlineFetch: deps.onlineFetch,
      saveOnlineDevicesCache: deps.saveOnlineDevicesCache,
    };
  }

  function refreshOnlineDevices(deps = {}) {
    return window.AtriaOnlineDevices.refreshOnlineDevices(getOnlineDevicesDeps(deps));
  }

  function revokeOnlineDevice(deviceId, deps = {}) {
    return window.AtriaOnlineDevices.revokeOnlineDevice(deviceId, getOnlineDevicesDeps(deps));
  }

  function renameOnlineDevice(deviceId, platform, deps = {}) {
    return window.AtriaOnlineDevices.renameOnlineDevice(deviceId, platform, getOnlineDevicesDeps(deps));
  }

  function loadOnlineFriends() {
    return window.AtriaOnlineFriends.loadOnlineFriends();
  }

  function saveOnlineFriends(friends) {
    return window.AtriaOnlineFriends.saveOnlineFriends(friends);
  }

  function loadOnlineFriendRequests() {
    return window.AtriaOnlineFriends.loadOnlineFriendRequests();
  }

  function saveOnlineFriendRequests(requests) {
    return window.AtriaOnlineFriends.saveOnlineFriendRequests(requests);
  }

  function loadOnlineFriendLookupCache() {
    return window.AtriaOnlineFriends.loadOnlineFriendLookupCache();
  }

  function saveOnlineFriendLookupCache(results) {
    return window.AtriaOnlineFriends.saveOnlineFriendLookupCache(results);
  }

  function normalizeFriendIdentifier(raw) {
    return window.AtriaOnlineFriends.normalizeFriendIdentifier(raw);
  }

  function detectFriendIdentifierType(raw) {
    return window.AtriaOnlineFriends.detectFriendIdentifierType(raw);
  }

  function normalizeOnlineFriendPermissions(permissions) {
    return window.AtriaOnlineFriends.normalizeOnlineFriendPermissions(permissions);
  }

  function buildOnlinePrivacyLockdownPermissions() {
    return window.AtriaOnlineFriends.buildOnlinePrivacyLockdownPermissions();
  }

  function friendPermissionEnabled(friend, key) {
    return window.AtriaOnlineFriends.friendPermissionEnabled(friend, key);
  }

  function createLocalOnlineFriendRequest(identifier, source, deps = {}) {
    return window.AtriaOnlineFriends.createLocalOnlineFriendRequest(identifier, source, getOnlineFriendsDeps(deps));
  }

  function cancelLocalOnlineFriendRequest(requestId) {
    return window.AtriaOnlineFriends.cancelLocalOnlineFriendRequest(requestId);
  }

  function createLocalOnlineFriend(identifier, displayName, deps = {}) {
    return window.AtriaOnlineFriends.createLocalOnlineFriend(identifier, displayName, getOnlineFriendsDeps(deps));
  }

  function acceptLocalOnlineFriendRequest(requestId, deps = {}) {
    return window.AtriaOnlineFriends.acceptLocalOnlineFriendRequest(requestId, getOnlineFriendsDeps(deps));
  }

  function rejectLocalOnlineFriendRequest(requestId, deps = {}) {
    return window.AtriaOnlineFriends.rejectLocalOnlineFriendRequest(requestId, getOnlineFriendsDeps(deps));
  }

  function findOnlineFriendBySystemId(systemId) {
    return window.AtriaOnlineFriends.findOnlineFriendBySystemId(systemId);
  }

  function refreshOnlineFriendsFromBackend(deps = {}) {
    return window.AtriaOnlineFriends.refreshOnlineFriendsFromBackend(getOnlineFriendsDeps(deps));
  }

  function lookupOnlineAccounts(query, deps = {}) {
    return window.AtriaOnlineFriends.lookupOnlineAccounts(query, getOnlineFriendsDeps(deps));
  }

  function sendOnlineFriendRequest(identifier, deps = {}) {
    return window.AtriaOnlineFriends.sendOnlineFriendRequest(identifier, getOnlineFriendsDeps(deps));
  }
  function removeOnlineFriend(friend, deps = {}) {
    return window.AtriaOnlineFriends.removeOnlineFriend(friend, getOnlineFriendsDeps(deps));
  }

  function updateOnlineFriendPermissions(friendId, permissions, deps = {}) {
    return window.AtriaOnlineFriends.updateOnlineFriendPermissions(friendId, permissions, getOnlineFriendsDeps(deps));
  }

  function bulkUpdateOnlineFriendPermissions(friendIds, permissions, deps = {}) {
    return window.AtriaOnlineFriends.bulkUpdateOnlineFriendPermissions(friendIds, permissions, getOnlineFriendsDeps(deps));
  }

  function loadOnlineConversations() {
    return window.AtriaOnlineConversationsStorage.loadOnlineConversations();
  }

  function saveOnlineConversations(conversations) {
    return window.AtriaOnlineConversationsStorage.saveOnlineConversations(conversations);
  }

  function getOnlineConversationMessages(friendId) {
    return window.AtriaOnlineConversationsStorage.getOnlineConversationMessages(friendId);
  }

  function appendOnlineConversationMessage(friendId, message) {
    return window.AtriaOnlineConversationsStorage.appendOnlineConversationMessage(friendId, message);
  }

  function loadOnlineConversationIndex() {
    return window.AtriaOnlineConversationsStorage.loadOnlineConversationIndex();
  }

  function saveOnlineConversationIndex(index) {
    return window.AtriaOnlineConversationsStorage.saveOnlineConversationIndex(index);
  }

  function getOnlineConversationMeta(friendId) {
    return window.AtriaOnlineConversationsStorage.getOnlineConversationMeta(friendId);
  }

  function setOnlineConversationMeta(friendId, patch) {
    return window.AtriaOnlineConversationsStorage.setOnlineConversationMeta(friendId, patch);
  }

  function getOnlineTotalUnreadCount() {
    return window.AtriaOnlineConversationsStorage.getOnlineTotalUnreadCount();
  }

  function mergeOnlineConversationMessages(friendId, normalized) {
    return window.AtriaOnlineConversationsStorage.mergeOnlineConversationMessages(friendId, normalized);
  }

  function getOnlineConversationsDeps(deps = {}) {
    return {
      lang: deps.lang || 'en',
      uid: deps.uid,
      loadOnlineFriends: deps.loadOnlineFriends,
      loadOnlineAccount: deps.loadOnlineAccount,
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      onlineFetch: deps.onlineFetch,
      loadOnlineConversationIndex: deps.loadOnlineConversationIndex,
      saveOnlineConversationIndex: deps.saveOnlineConversationIndex,
      getOnlineConversationMessages: deps.getOnlineConversationMessages,
      appendOnlineConversationMessage: deps.appendOnlineConversationMessage,
      getOnlineConversationMeta: deps.getOnlineConversationMeta,
      setOnlineConversationMeta: deps.setOnlineConversationMeta,
      mergeOnlineConversationMessages: deps.mergeOnlineConversationMessages,
      migrateOnlineConversationCiphertext: deps.migrateOnlineConversationCiphertext,
      decryptOnlineMessagePayload: deps.decryptOnlineMessagePayload,
      decryptOnlineMessageText: deps.decryptOnlineMessageText,
      encryptOnlineMessagePacket: deps.encryptOnlineMessagePacket,
    };
  }

  function ensureOnlineConversation(friend, deps = {}) {
    return window.AtriaOnlineConversations.ensureOnlineConversation(friend, getOnlineConversationsDeps(deps));
  }

  function refreshOnlineConversation(friendId, deps = {}) {
    return window.AtriaOnlineConversations.refreshOnlineConversation(friendId, getOnlineConversationsDeps(deps));
  }

  function sendOnlineConversationMessage(friendId, text, deps = {}, options = {}) {
    return window.AtriaOnlineConversations.sendOnlineConversationMessage(friendId, text, getOnlineConversationsDeps(deps), options);
  }

  function markOnlineConversationRead(friendId, deps = {}) {
    return window.AtriaOnlineConversations.markOnlineConversationRead(friendId, getOnlineConversationsDeps(deps));
  }

  function getOnlineMessagesCryptoDeps(deps = {}) {
    return {
      lang: deps.lang || 'en',
      loadOnlineKeypair: deps.loadOnlineKeypair,
      loadOnlineAccount: deps.loadOnlineAccount,
      bridgeDeriveSharedKey: deps.bridgeDeriveSharedKey,
      bridgeEncryptPacket: deps.bridgeEncryptPacket,
      bridgeDecryptPacket: deps.bridgeDecryptPacket,
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      onlineFetch: deps.onlineFetch,
    };
  }

  function deriveOnlineSharedKey(friend, deps = {}) {
    return window.AtriaOnlineMessagesCrypto.deriveOnlineSharedKey(friend, getOnlineMessagesCryptoDeps(deps));
  }

  function encryptOnlineMessagePacket(friend, text, deps = {}, options = {}) {
    return window.AtriaOnlineMessagesCrypto.encryptOnlineMessagePacket(friend, text, getOnlineMessagesCryptoDeps(deps), options);
  }

  function decryptOnlineMessagePayload(friend, message, deps = {}) {
    return window.AtriaOnlineMessagesCrypto.decryptOnlineMessagePayload(friend, message, getOnlineMessagesCryptoDeps(deps));
  }

  function decryptOnlineMessageText(friend, message, deps = {}) {
    return window.AtriaOnlineMessagesCrypto.decryptOnlineMessageText(friend, message, getOnlineMessagesCryptoDeps(deps));
  }

  function migrateOnlineConversationCiphertext(friend, conversationId, messages, deps = {}) {
    return window.AtriaOnlineMessagesCrypto.migrateOnlineConversationCiphertext(
      friend,
      conversationId,
      messages,
      getOnlineMessagesCryptoDeps(deps)
    );
  }

  function getOnlinePresenceDeps(deps = {}) {
    return {
      lang: deps.lang || 'en',
      getOnlineProfile: deps.getOnlineProfile,
      getActiveAlter: deps.getActiveAlter,
      getAlters: deps.getAlters,
      loadFronting: deps.loadFronting,
      loadOnlineFriends: deps.loadOnlineFriends,
      normalizeOnlineFriendPermissions,
      loadOnlineKeypair: deps.loadOnlineKeypair,
      deriveOnlineSharedKey: deps.deriveOnlineSharedKey,
      bridgeEncryptPacket: deps.bridgeEncryptPacket,
      bridgeDecryptPacket: deps.bridgeDecryptPacket,
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      onlineFetch: deps.onlineFetch,
      loadOnlineSession: deps.loadOnlineSession,
      saveOnlineSession: deps.saveOnlineSession,
    };
  }

  function loadOnlinePresenceCache() {
    return window.AtriaOnlinePresence.loadOnlinePresenceCache();
  }

  function saveOnlinePresenceCache(presence) {
    return window.AtriaOnlinePresence.saveOnlinePresenceCache(presence);
  }

  function getOnlinePresenceForFriend(friendId) {
    return window.AtriaOnlinePresence.getOnlinePresenceForFriend(friendId);
  }

  function upsertLocalOnlinePresence(friendId, patch) {
    return window.AtriaOnlinePresence.upsertLocalOnlinePresence(friendId, patch);
  }

  function getOnlinePresenceSummary() {
    return window.AtriaOnlinePresence.getOnlinePresenceSummary();
  }

  function getCurrentOnlineFrontingPayload(deps = {}) {
    return window.AtriaOnlinePresence.getCurrentOnlineFrontingPayload(getOnlinePresenceDeps(deps));
  }

  function buildOnlinePresencePackets(state, visibility = 'friends', deps = {}) {
    return window.AtriaOnlinePresence.buildOnlinePresencePackets(state, visibility, getOnlinePresenceDeps(deps));
  }

  function decryptOnlinePresencePayload(friend, item, deps = {}) {
    return window.AtriaOnlinePresence.decryptOnlinePresencePayload(friend, item, getOnlinePresenceDeps(deps));
  }

  function choosePresencePayload(decrypted, item) {
    return window.AtriaOnlinePresence.choosePresencePayload(decrypted, item);
  }

  function normalizePresenceState(state) {
    return window.AtriaOnlinePresence.normalizePresenceState(state);
  }

  function refreshOnlinePresenceFromBackend(deps = {}) {
    return window.AtriaOnlinePresence.refreshOnlinePresenceFromBackend(getOnlinePresenceDeps(deps));
  }

  function setOnlinePresenceState(state, deps = {}) {
    return window.AtriaOnlinePresence.setOnlinePresenceState(state, getOnlinePresenceDeps(deps));
  }

  function getOnlineSyncDeps(deps = {}) {
    return {
      lang: deps.lang || 'en',
      uid: deps.uid,
      saveOnlineFriends: deps.saveOnlineFriends,
      saveOnlineFriendRequests: deps.saveOnlineFriendRequests,
      loadOnlineFriendRequests: deps.loadOnlineFriendRequests,
      loadOnlineFriends: deps.loadOnlineFriends,
      normalizeOnlineFriendPermissions,
      saveOnlinePresenceCache: deps.saveOnlinePresenceCache,
      normalizePresenceState,
      loadOnlineConversationIndex: deps.loadOnlineConversationIndex,
      saveOnlineConversationIndex: deps.saveOnlineConversationIndex,
      loadOnlineAccount: deps.loadOnlineAccount,
      decryptOnlineMessagePayload: deps.decryptOnlineMessagePayload,
      decryptOnlineMessageText: deps.decryptOnlineMessageText,
      mergeOnlineConversationMessages: deps.mergeOnlineConversationMessages,
      getOnlineConversationMessages: deps.getOnlineConversationMessages,
      getOnlineConversationMeta: deps.getOnlineConversationMeta,
      migrateOnlineConversationCiphertext: deps.migrateOnlineConversationCiphertext,
      loadOnlineBackupStatus: deps.loadOnlineBackupStatus,
      saveOnlineBackupStatus: deps.saveOnlineBackupStatus,
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      getOnlineProfile: deps.getOnlineProfile,
      onlineFetch: deps.onlineFetch,
      startOnlineEventsChannel: deps.startOnlineEventsChannel,
      stopOnlineEventsChannel: deps.stopOnlineEventsChannel,
      notifyOnlineEvent: deps.notifyOnlineEvent,
      render: deps.render,
    };
  }

  function loadOnlineSyncState() {
    return window.AtriaOnlineSync.loadOnlineSyncState();
  }

  function saveOnlineSyncState(state) {
    return window.AtriaOnlineSync.saveOnlineSyncState(state);
  }

  function applyOnlineSyncBootstrapPayload(payload, deps = {}) {
    return window.AtriaOnlineSync.applyOnlineSyncBootstrapPayload(payload, getOnlineSyncDeps(deps));
  }

  function runOnlineSyncBootstrap(deps = {}) {
    return window.AtriaOnlineSync.runOnlineSyncBootstrap(getOnlineSyncDeps(deps));
  }

  function runOnlineSyncChanges(deps = {}) {
    return window.AtriaOnlineSync.runOnlineSyncChanges(getOnlineSyncDeps(deps));
  }

  function getOnlineCryptoMigrationDeps(deps = {}) {
    return {
      getOnlineProfile: deps.getOnlineProfile,
      loadOnlineSession: deps.loadOnlineSession,
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      loadOnlineKeypair: deps.loadOnlineKeypair,
      onlineFetch: deps.onlineFetch,
      saveOnlineAccount: deps.saveOnlineAccount,
      loadOnlineAccount: deps.loadOnlineAccount,
      loadBridgeKeypair: deps.loadBridgeKeypair,
      saveOnlineKeypair: deps.saveOnlineKeypair,
      encryptBackupData: deps.encryptBackupData,
      getOrCreateOnlineBackupSecret: deps.getOrCreateOnlineBackupSecret,
      uploadOnlineCryptoBundle: deps.uploadOnlineCryptoBundle,
      loadOnlineSyncState: deps.loadOnlineSyncState,
      saveOnlineSyncState: deps.saveOnlineSyncState,
    };
  }

  function migrateOnlineSessionCryptoSilently(deps = {}) {
    return window.AtriaOnlineCryptoMigration.migrateOnlineSessionCryptoSilently(getOnlineCryptoMigrationDeps(deps));
  }

  function getOnlineBackupDeps(deps = {}) {
    return {
      lang: deps.lang || 'en',
      crypto: deps.crypto,
      bufferToBase64Url: deps.bufferToBase64Url,
      tidKeys: deps.tidKeys,
      encryptBackupData: deps.encryptBackupData,
      decryptBackupPayload: deps.decryptBackupPayload,
      shouldSkipIncomingSyncWrite: deps.shouldSkipIncomingSyncWrite,
      pinKeys: deps.pinKeys,
      getLocalAtriaDataKeysForOnlineRestore: deps.getLocalAtriaDataKeysForOnlineRestore,
      confirmReplaceLocalDataForOnlineRestore: deps.confirmReplaceLocalDataForOnlineRestore,
      loadOnlineSession: deps.loadOnlineSession,
      loadOnlineAccount: deps.loadOnlineAccount,
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      onlineFetch: deps.onlineFetch,
    };
  }

  function getOrCreateOnlineBackupSecret(deps = {}) {
    return window.AtriaOnlineBackup.getOrCreateOnlineBackupSecret(getOnlineBackupDeps(deps));
  }

  function loadOnlineBackupSecret() {
    return window.AtriaOnlineBackup.loadOnlineBackupSecret();
  }

  function saveOnlineBackupSecret(secret) {
    return window.AtriaOnlineBackup.saveOnlineBackupSecret(secret);
  }

  function loadOnlineBackupStatus() {
    return window.AtriaOnlineBackup.loadOnlineBackupStatus();
  }

  function saveOnlineBackupStatus(status) {
    return window.AtriaOnlineBackup.saveOnlineBackupStatus(status);
  }

  function describeOnlineBackupStatus(status, deps = {}) {
    return window.AtriaOnlineBackup.describeOnlineBackupStatus(status, getOnlineBackupDeps(deps));
  }

  function collectBackupExportData(deps = {}) {
    return window.AtriaOnlineBackup.collectBackupExportData(getOnlineBackupDeps(deps));
  }

  function buildOnlineAutomaticBackupPayload(deps = {}) {
    return window.AtriaOnlineBackup.buildOnlineAutomaticBackupPayload(getOnlineBackupDeps(deps));
  }

  function runOnlineAutomaticBackup(reason = 'manual', deps = {}) {
    return window.AtriaOnlineBackup.runOnlineAutomaticBackup(reason, getOnlineBackupDeps(deps));
  }

  function restoreOnlineAutomaticBackup(deps = {}) {
    return window.AtriaOnlineBackup.restoreOnlineAutomaticBackup(getOnlineBackupDeps(deps));
  }

  function scheduleOnlineAutomaticBackup(reason = 'auto-change', deps = {}) {
    return window.AtriaOnlineBackup.scheduleOnlineAutomaticBackup(reason, getOnlineBackupDeps(deps));
  }

  function installOnlineAutoBackupWatcher(deps = {}) {
    return window.AtriaOnlineBackup.installOnlineAutoBackupWatcher(getOnlineBackupDeps(deps));
  }

  function getOnlineRealtimeDeps(deps = {}) {
    return {
      lang: deps.lang || 'en',
      uid: deps.uid,
      loadOnlineAccount: deps.loadOnlineAccount,
      findOnlineFriendBySystemId: deps.findOnlineFriendBySystemId,
      decryptOnlineMessagePayload: deps.decryptOnlineMessagePayload,
      decryptOnlineMessageText: deps.decryptOnlineMessageText,
      mergeOnlineConversationMessages: deps.mergeOnlineConversationMessages,
      getOnlineConversationMeta: deps.getOnlineConversationMeta,
      setOnlineConversationMeta: deps.setOnlineConversationMeta,
      markOnlineConversationRead: deps.markOnlineConversationRead,
      getOnlineChatActiveFriendId: deps.getOnlineChatActiveFriendId,
      encryptedFallbackText: deps.encryptedFallbackText,
      loadOnlineConversations: deps.loadOnlineConversations,
      saveOnlineConversations: deps.saveOnlineConversations,
      decryptOnlinePresencePayload: deps.decryptOnlinePresencePayload,
      choosePresencePayload,
      normalizePresenceState,
      upsertLocalOnlinePresence: deps.upsertLocalOnlinePresence,
      refreshOnlineFriendsFromBackend: deps.refreshOnlineFriendsFromBackend,
      notifyOnlineEvent: deps.notifyOnlineEvent,
      runOnlineSyncChanges: deps.runOnlineSyncChanges,
      saveOnlineSyncState: deps.saveOnlineSyncState,
      loadOnlineSyncState: deps.loadOnlineSyncState,
      render: deps.render,
      loadOnlineSession: deps.loadOnlineSession,
      getOnlineApiBaseUrl: deps.getOnlineApiBaseUrl,
      getOnlineProfile: deps.getOnlineProfile,
      hasOnlineBackendConfigured: deps.hasOnlineBackendConfigured,
      EventSourceCtor: deps.EventSourceCtor,
    };
  }

  function scheduleOnlineRealtimeSync(deps = {}) {
    return window.AtriaOnlineRealtime.scheduleOnlineRealtimeSync(getOnlineRealtimeDeps(deps));
  }

  function applyOnlineRealtimeMessage(change, deps = {}) {
    return window.AtriaOnlineRealtime.applyOnlineRealtimeMessage(change, getOnlineRealtimeDeps(deps));
  }

  function applyOnlineRealtimeRead(change, deps = {}) {
    return window.AtriaOnlineRealtime.applyOnlineRealtimeRead(change, getOnlineRealtimeDeps(deps));
  }

  function applyOnlineRealtimePresence(change, deps = {}) {
    return window.AtriaOnlineRealtime.applyOnlineRealtimePresence(change, getOnlineRealtimeDeps(deps));
  }

  function handleOnlineRealtimeChange(change, deps = {}) {
    return window.AtriaOnlineRealtime.handleOnlineRealtimeChange(change, getOnlineRealtimeDeps(deps));
  }

  function startOnlineEventsChannel(deps = {}) {
    return window.AtriaOnlineRealtime.startOnlineEventsChannel(getOnlineRealtimeDeps(deps));
  }

  function stopOnlineEventsChannel() {
    return window.AtriaOnlineRealtime.stopOnlineEventsChannel();
  }

  function startOnlineSyncLoop(deps = {}) {
    return window.AtriaOnlineSync.startOnlineSyncLoop(getOnlineSyncDeps(deps));
  }

  function stopOnlineSyncLoop(deps = {}) {
    return window.AtriaOnlineSync.stopOnlineSyncLoop(getOnlineSyncDeps(deps));
  }

  window.AtriaOnlineBootstrap = {
    buildOnlineSystemId,
    getOnlineProfile,
    loadOnlineAccount,
    saveOnlineAccount,
    loadOnlineSession,
    saveOnlineSession,
    loadOnlineKeypair,
    saveOnlineKeypair,
    loadOnlineDevicesCache,
    saveOnlineDevicesCache,
    upsertOnlineDevice,
    refreshOnlineDevices,
    revokeOnlineDevice,
    renameOnlineDevice,
    activateOnlineAccountSession,
    disableOnlineAccountSession,
    getOnlineApiBaseUrl,
    hasOnlineBackendConfigured,
    getOnlineBackendStateLabel,
    onlineFetch,
    onlineAuthFetch,
    getOnlineAuthDeps,
    buildOnlineCryptoRegistration,
    uploadOnlineCryptoBundle,
    restoreOnlineKeypairFromAccount,
    ensureOnlineCryptoProvisioned,
    registerOnlineAccountRemote,
    loginOnlineAccountRemote,
    requestOnlinePasswordReset,
    requestOnlinePasswordResetCrypto,
    confirmOnlinePasswordReset,
    getOnlineFriendsDeps,
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
    getOnlineConversationsDeps,
    ensureOnlineConversation,
    refreshOnlineConversation,
    sendOnlineConversationMessage,
    markOnlineConversationRead,
    getOnlineMessagesCryptoDeps,
    deriveOnlineSharedKey,
    encryptOnlineMessagePacket,
    decryptOnlineMessagePayload,
    decryptOnlineMessageText,
    migrateOnlineConversationCiphertext,
    getOnlinePresenceDeps,
    loadOnlinePresenceCache,
    saveOnlinePresenceCache,
    getOnlinePresenceForFriend,
    upsertLocalOnlinePresence,
    getOnlinePresenceSummary,
    getCurrentOnlineFrontingPayload,
    buildOnlinePresencePackets,
    decryptOnlinePresencePayload,
    choosePresencePayload,
    normalizePresenceState,
    refreshOnlinePresenceFromBackend,
    setOnlinePresenceState,
    getOnlineSyncDeps,
    loadOnlineSyncState,
    saveOnlineSyncState,
    applyOnlineSyncBootstrapPayload,
    runOnlineSyncBootstrap,
    runOnlineSyncChanges,
    getOnlineCryptoMigrationDeps,
    migrateOnlineSessionCryptoSilently,
    getOnlineBackupDeps,
    getOrCreateOnlineBackupSecret,
    loadOnlineBackupSecret,
    saveOnlineBackupSecret,
    loadOnlineBackupStatus,
    saveOnlineBackupStatus,
    describeOnlineBackupStatus,
    collectBackupExportData,
    buildOnlineAutomaticBackupPayload,
    runOnlineAutomaticBackup,
    restoreOnlineAutomaticBackup,
    scheduleOnlineAutomaticBackup,
    installOnlineAutoBackupWatcher,
    getOnlineRealtimeDeps,
    scheduleOnlineRealtimeSync,
    applyOnlineRealtimeMessage,
    applyOnlineRealtimeRead,
    applyOnlineRealtimePresence,
    handleOnlineRealtimeChange,
    startOnlineEventsChannel,
    stopOnlineEventsChannel,
    startOnlineSyncLoop,
    stopOnlineSyncLoop,
  };
})();
