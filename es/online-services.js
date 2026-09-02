// Funciones de acceso a los servicios online.
// Se carga antes de app.js porque las vistas actuales usan estas funciones globales.
// -- ONLINE WIRING --
// Account and local session wrappers
function getOnlineBootstrapDeps() {
  return {
    lang: 'es',
    defaultDeviceName: 'Este dispositivo',
    loadConfig,
    saveConfig,
    hasOnlineBackendConfigured,
    startOnlineSyncLoop,
    stopOnlineSyncLoop,
    generateBridgeKeypair,
    encryptBackupData,
    decryptBackupPayload,
    getOrCreateOnlineBackupSecret,
    saveOnlineBackupSecret,
    onlineFetch,
    onlineAuthFetch,
    loadOnlineKeypair,
    activateOnlineAccountSession,
    buildOnlineSystemId,
    restoreOnlineAutomaticBackup: typeof restoreOnlineAutomaticBackup === 'function' ? restoreOnlineAutomaticBackup : null,
    runOnlineAutomaticBackup: typeof runOnlineAutomaticBackup === 'function' ? runOnlineAutomaticBackup : null,
    runOnlineSyncBootstrap: typeof runOnlineSyncBootstrap === 'function' ? runOnlineSyncBootstrap : null,
    uid,
    loadOnlineAccount,
  };
}
function buildOnlineSystemId(cfg) {
  return window.AtriaOnlineBootstrap.buildOnlineSystemId(cfg);
}
function normalizeOnlineSystemId(value, fallbackCfg = {}) {
  return buildOnlineSystemId({ ...fallbackCfg, onlineSystemId: String(value || '').trim() });
}
function normalizeOnlineFriendCode(value) {
  return window.AtriaOnlineAccount.normalizeOnlineFriendCode(value);
}
function generateOnlineFriendCode() {
  return window.AtriaOnlineAccount.generateOnlineFriendCode();
}
function getOnlineProfile(cfg = loadConfig()) {
  return window.AtriaOnlineBootstrap.getOnlineProfile(cfg, getOnlineBootstrapDeps());
}
const ONLINE_ACCOUNT_KEY = window.AtriaOnlineAccount.keys.ONLINE_ACCOUNT_KEY;
const ONLINE_SESSION_KEY = window.AtriaOnlineAccount.keys.ONLINE_SESSION_KEY;
const ONLINE_DEVICES_CACHE_KEY = window.AtriaOnlineAccount.keys.ONLINE_DEVICES_CACHE_KEY;
const ONLINE_KEYPAIR_KEY = window.AtriaOnlineAccount.keys.ONLINE_KEYPAIR_KEY;
function loadOnlineAccount() {
  return window.AtriaOnlineBootstrap.loadOnlineAccount(getOnlineBootstrapDeps());
}
function saveOnlineAccount(account) {
  return window.AtriaOnlineBootstrap.saveOnlineAccount(account, getOnlineBootstrapDeps());
}
function loadOnlineSession() {
  return window.AtriaOnlineBootstrap.loadOnlineSession(getOnlineBootstrapDeps());
}
function saveOnlineSession(session) {
  return window.AtriaOnlineBootstrap.saveOnlineSession(session);
}
function loadOnlineKeypair() {
  return window.AtriaOnlineBootstrap.loadOnlineKeypair();
}
function saveOnlineKeypair(keypair) {
  return window.AtriaOnlineBootstrap.saveOnlineKeypair(keypair);
}
function loadOnlineDevicesCache() {
  return window.AtriaOnlineBootstrap.loadOnlineDevicesCache();
}
function saveOnlineDevicesCache(devices) {
  return window.AtriaOnlineBootstrap.saveOnlineDevicesCache(devices);
}
function upsertOnlineDevice(deviceName, email, systemId) {
  return window.AtriaOnlineBootstrap.upsertOnlineDevice(deviceName, email, systemId);
}
function renameOnlineDevice(deviceId, platform) {
  return window.AtriaOnlineBootstrap.renameOnlineDevice(deviceId, platform, getOnlineBootstrapDeps());
}
function activateOnlineAccountSession({ accountId = null, email, systemId = '', displayName = '', deviceName, deviceId = null, consentAt, frontingEnabled = false, autoBackup = true, authToken = '', devices = null, keypair = null, accountCrypto = null, rememberSession = true }) {
  const session = window.AtriaOnlineBootstrap.activateOnlineAccountSession({
    accountId,
    email,
    systemId,
    displayName,
    deviceName,
    deviceId,
    consentAt,
    frontingEnabled,
    autoBackup,
    authToken,
    devices,
    keypair,
    accountCrypto,
    rememberSession,
  }, getOnlineBootstrapDeps());
  if (typeof scheduleOnlineWebPushSubscription === 'function') scheduleOnlineWebPushSubscription();
  return session;
}
function disableOnlineAccountSession() {
  return window.AtriaOnlineBootstrap.disableOnlineAccountSession(getOnlineBootstrapDeps());
}
// Backend wrappers
function getOnlineApiBaseUrl(cfg = loadConfig()) {
  return window.AtriaOnlineBootstrap.getOnlineApiBaseUrl(cfg);
}
function hasOnlineBackendConfigured(cfg = loadConfig()) {
  return window.AtriaOnlineBootstrap.hasOnlineBackendConfigured(cfg);
}
function getOnlineBackendStateLabel(cfg = loadConfig()) {
  return window.AtriaOnlineBootstrap.getOnlineBackendStateLabel(cfg, getOnlineBootstrapDeps());
}
async function onlineFetch(path, options = {}) {
  return window.AtriaOnlineBootstrap.onlineFetch(path, options, { loadConfig, loadOnlineAccount, loadOnlineSession, lang: 'es' });
}
async function refreshOnlineAccountIdentityFromBackend() {
  if (!hasOnlineBackendConfigured()) return loadOnlineAccount();
  const data = await onlineFetch('/v1/auth/me');
  const current = loadOnlineAccount() || {};
  const session = loadOnlineSession() || {};
  const nextAccount = {
    ...current,
    id: data?.id || current.id || session.accountId || null,
    systemId: data?.systemId || current.systemId || session.systemId || '',
    friendCode: data?.friendCode || current.friendCode || session.friendCode || '',
    displayName: data?.displayName || current.displayName || '',
    crypto: data?.crypto || current.crypto || null,
  };
  saveOnlineAccount(nextAccount);
  const cfg = loadConfig();
  saveConfig({
    ...cfg,
    onlineAccountId: nextAccount.id || cfg.onlineAccountId || null,
    onlineSystemId: nextAccount.systemId || cfg.onlineSystemId || '',
    onlineFriendCode: nextAccount.friendCode || cfg.onlineFriendCode || '',
    onlineDisplayName: nextAccount.displayName || cfg.onlineDisplayName || cfg.systemName || '',
  });
  saveOnlineSession({
    ...session,
    accountId: nextAccount.id || session.accountId || null,
    systemId: nextAccount.systemId || session.systemId || '',
    friendCode: nextAccount.friendCode || session.friendCode || '',
  });
  return nextAccount;
}
async function onlineAuthFetch(path, payload) {
  return window.AtriaOnlineBootstrap.onlineAuthFetch(path, payload, { loadConfig, lang: 'es' });
}
// Auth and provisioning wrappers
function getOnlineAuthDeps() {
  return window.AtriaOnlineBootstrap.getOnlineAuthDeps(getOnlineBootstrapDeps());
}
async function buildOnlineCryptoRegistration(password) {
  return window.AtriaOnlineBootstrap.buildOnlineCryptoRegistration(password, getOnlineBootstrapDeps());
}
async function uploadOnlineCryptoBundle(upload) {
  return window.AtriaOnlineBootstrap.uploadOnlineCryptoBundle(upload, getOnlineBootstrapDeps());
}
async function restoreOnlineKeypairFromAccount(account, password) {
  return window.AtriaOnlineBootstrap.restoreOnlineKeypairFromAccount(account, password, getOnlineBootstrapDeps());
}
async function ensureOnlineCryptoProvisioned(account, password) {
  return window.AtriaOnlineBootstrap.ensureOnlineCryptoProvisioned(account, password, getOnlineBootstrapDeps());
}
async function registerOnlineAccountRemote({ email, password, deviceName, consentAt, systemId, friendCode, displayName, rememberSession }) {
  return window.AtriaOnlineBootstrap.registerOnlineAccountRemote({ email, password, deviceName, consentAt, systemId, friendCode, displayName, rememberSession }, getOnlineBootstrapDeps());
}
async function loginOnlineAccountRemote({ email, password, deviceName, consentAt, rememberSession }) {
  return window.AtriaOnlineBootstrap.loginOnlineAccountRemote({ email, password, deviceName, consentAt, rememberSession }, getOnlineBootstrapDeps());
}
async function requestOnlinePasswordReset({ email }) {
  return window.AtriaOnlineBootstrap.requestOnlinePasswordReset({ email }, getOnlineBootstrapDeps());
}
async function requestOnlinePasswordResetCrypto({ token }) {
  return window.AtriaOnlineBootstrap.requestOnlinePasswordResetCrypto({ token }, getOnlineBootstrapDeps());
}
async function confirmOnlinePasswordReset({ token, password, oldPassword = '' }) {
  return window.AtriaOnlineBootstrap.confirmOnlinePasswordReset({ token, password, oldPassword }, getOnlineBootstrapDeps());
}
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}
function expireOnlineSessionIfNeeded() {
  const cfg = loadConfig();
  const expiresAt = cfg.onlineSessionExpiresAt ? Date.parse(cfg.onlineSessionExpiresAt) : 0;
  if (!cfg.onlineEnabled || cfg.onlineRememberSession !== false || !expiresAt || Number.isNaN(expiresAt)) return false;
  if (Date.now() <= expiresAt) return false;
  disableOnlineAccountSession();
  return true;
}
// Friends wrappers
const ONLINE_FRIENDS_KEY = window.AtriaOnlineFriends.keys.ONLINE_FRIENDS_KEY;
const ONLINE_FRIEND_REQUESTS_KEY = window.AtriaOnlineFriends.keys.ONLINE_FRIEND_REQUESTS_KEY;
const ONLINE_FRIEND_LOOKUP_CACHE_KEY = window.AtriaOnlineFriends.keys.ONLINE_FRIEND_LOOKUP_CACHE_KEY;
function getOnlineFriendsDeps() {
  return window.AtriaOnlineBootstrap.getOnlineFriendsDeps(getOnlineBootstrapDeps());
}
function loadOnlineFriends() {
  return window.AtriaOnlineBootstrap.loadOnlineFriends();
}
function saveOnlineFriends(friends) {
  return window.AtriaOnlineBootstrap.saveOnlineFriends(friends);
}
function loadOnlineFriendRequests() {
  return window.AtriaOnlineBootstrap.loadOnlineFriendRequests();
}
function saveOnlineFriendRequests(requests) {
  return window.AtriaOnlineBootstrap.saveOnlineFriendRequests(requests);
}
function loadOnlineFriendLookupCache() {
  return window.AtriaOnlineBootstrap.loadOnlineFriendLookupCache();
}
function saveOnlineFriendLookupCache(results) {
  return window.AtriaOnlineBootstrap.saveOnlineFriendLookupCache(results);
}
function normalizeFriendIdentifier(raw) {
  return window.AtriaOnlineBootstrap.normalizeFriendIdentifier(raw);
}
function detectFriendIdentifierType(raw) {
  return window.AtriaOnlineBootstrap.detectFriendIdentifierType(raw);
}
function normalizeOnlineFriendPermissions(permissions) {
  return window.AtriaOnlineBootstrap.normalizeOnlineFriendPermissions(permissions);
}
function buildOnlinePrivacyLockdownPermissions() {
  return window.AtriaOnlineBootstrap.buildOnlinePrivacyLockdownPermissions();
}
function friendPermissionEnabled(friend, key) {
  return window.AtriaOnlineBootstrap.friendPermissionEnabled(friend, key);
}
function createLocalOnlineFriendRequest(identifier, source = 'manual') {
  return window.AtriaOnlineBootstrap.createLocalOnlineFriendRequest(identifier, source, getOnlineBootstrapDeps());
}
function cancelLocalOnlineFriendRequest(requestId) {
  return window.AtriaOnlineBootstrap.cancelLocalOnlineFriendRequest(requestId);
}
function createLocalOnlineFriend(identifier, displayName) {
  return window.AtriaOnlineBootstrap.createLocalOnlineFriend(identifier, displayName, getOnlineBootstrapDeps());
}
function acceptLocalOnlineFriendRequest(requestId) {
  return window.AtriaOnlineBootstrap.acceptLocalOnlineFriendRequest(requestId, getOnlineBootstrapDeps());
}
function rejectLocalOnlineFriendRequest(requestId) {
  return window.AtriaOnlineBootstrap.rejectLocalOnlineFriendRequest(requestId, getOnlineBootstrapDeps());
}
function findOnlineFriendBySystemId(systemId) {
  return window.AtriaOnlineBootstrap.findOnlineFriendBySystemId(systemId);
}
async function refreshOnlineFriendsFromBackend() {
  return window.AtriaOnlineBootstrap.refreshOnlineFriendsFromBackend(getOnlineBootstrapDeps());
}
async function lookupOnlineAccounts(query) {
  return window.AtriaOnlineBootstrap.lookupOnlineAccounts(query, getOnlineBootstrapDeps());
}
async function sendOnlineFriendRequest(identifier) {
  return window.AtriaOnlineBootstrap.sendOnlineFriendRequest(identifier, getOnlineBootstrapDeps());
}
async function updateOnlineFriendPermissions(friendId, permissions) {
  return window.AtriaOnlineBootstrap.updateOnlineFriendPermissions(friendId, permissions, getOnlineBootstrapDeps());
}
async function bulkUpdateOnlineFriendPermissions(friendIds, permissions) {
  return window.AtriaOnlineBootstrap.bulkUpdateOnlineFriendPermissions(friendIds, permissions, getOnlineBootstrapDeps());
}
async function removeOnlineFriend(friend) {
  return window.AtriaOnlineBootstrap.removeOnlineFriend(friend, getOnlineBootstrapDeps());
}
function withOnlineActionTimeout(promise, ms, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
// Conversation storage wrappers
const ONLINE_CONVERSATIONS_KEY = window.AtriaOnlineConversationsStorage.keys.ONLINE_CONVERSATIONS_KEY;
const ONLINE_CONVERSATION_INDEX_KEY = window.AtriaOnlineConversationsStorage.keys.ONLINE_CONVERSATION_INDEX_KEY;
function loadOnlineConversations() {
  return window.AtriaOnlineBootstrap.loadOnlineConversations();
}
function saveOnlineConversations(conversations) {
  return window.AtriaOnlineBootstrap.saveOnlineConversations(conversations);
}
function getOnlineConversationMessages(friendId) {
  return window.AtriaOnlineBootstrap.getOnlineConversationMessages(friendId);
}
function appendOnlineConversationMessage(friendId, message) {
  return window.AtriaOnlineBootstrap.appendOnlineConversationMessage(friendId, message);
}
function removeOnlineConversationMessage(friendId, messageId) {
  const all = loadOnlineConversations();
  all[friendId] = (Array.isArray(all[friendId]) ? all[friendId] : []).filter(msg => msg.id !== messageId);
  saveOnlineConversations(all);
}
function loadOnlineConversationIndex() {
  return window.AtriaOnlineBootstrap.loadOnlineConversationIndex();
}
function saveOnlineConversationIndex(index) {
  return window.AtriaOnlineBootstrap.saveOnlineConversationIndex(index);
}
function getOnlineConversationMeta(friendId) {
  return window.AtriaOnlineBootstrap.getOnlineConversationMeta(friendId);
}
function setOnlineConversationMeta(friendId, patch) {
  return window.AtriaOnlineBootstrap.setOnlineConversationMeta(friendId, patch);
}
function getOnlineTotalUnreadCount() {
  return window.AtriaOnlineBootstrap.getOnlineTotalUnreadCount();
}
function mergeOnlineConversationMessages(friendId, normalized) {
  return window.AtriaOnlineBootstrap.mergeOnlineConversationMessages(friendId, normalized);
}
// Message crypto wrappers
function getOnlineBootstrapDepsForMessageCrypto() {
  return {
    lang: 'es',
    loadOnlineKeypair,
    loadOnlineAccount,
    bridgeDeriveSharedKey,
    bridgeEncryptPacket,
    bridgeDecryptPacket,
    hasOnlineBackendConfigured,
    onlineFetch,
  };
}
function getOnlineMessagesCryptoDeps() {
  return window.AtriaOnlineBootstrap.getOnlineMessagesCryptoDeps(getOnlineBootstrapDepsForMessageCrypto());
}
async function deriveOnlineSharedKey(friend) {
  return window.AtriaOnlineBootstrap.deriveOnlineSharedKey(friend, getOnlineBootstrapDepsForMessageCrypto());
}
async function encryptOnlineMessagePacket(friend, text, options = {}) {
  return window.AtriaOnlineBootstrap.encryptOnlineMessagePacket(friend, text, getOnlineBootstrapDepsForMessageCrypto(), options);
}
async function decryptOnlineMessagePayload(friend, message) {
  return window.AtriaOnlineBootstrap.decryptOnlineMessagePayload(friend, message, getOnlineBootstrapDepsForMessageCrypto());
}
async function decryptOnlineMessageText(friend, message) {
  return window.AtriaOnlineBootstrap.decryptOnlineMessageText(friend, message, getOnlineBootstrapDepsForMessageCrypto());
}
async function migrateOnlineConversationCiphertext(friend, conversationId, messages) {
  return window.AtriaOnlineBootstrap.migrateOnlineConversationCiphertext(
    friend,
    conversationId,
    messages,
    getOnlineBootstrapDepsForMessageCrypto()
  );
}
// Presence wrappers
function getOnlineBootstrapDepsForPresence() {
  return {
    lang: 'es',
    getOnlineProfile,
    getActiveAlter: () => (typeof activeAlter !== 'undefined' ? activeAlter : null),
    getAlters: () => (typeof getAlters === 'function' ? getAlters(true) : []),
    loadFronting: typeof loadFronting === 'function' ? loadFronting : null,
    loadOnlineFriends,
    loadOnlineKeypair,
    deriveOnlineSharedKey,
    bridgeEncryptPacket,
    bridgeDecryptPacket,
    hasOnlineBackendConfigured,
    onlineFetch,
    loadOnlineSession,
    saveOnlineSession,
  };
}
function getOnlinePresenceDeps() {
  return window.AtriaOnlineBootstrap.getOnlinePresenceDeps(getOnlineBootstrapDepsForPresence());
}
const ONLINE_PRESENCE_KEY = window.AtriaOnlinePresence.keys.ONLINE_PRESENCE_KEY;
function loadOnlinePresenceCache() {
  return window.AtriaOnlineBootstrap.loadOnlinePresenceCache();
}
function saveOnlinePresenceCache(presence) {
  return window.AtriaOnlineBootstrap.saveOnlinePresenceCache(presence);
}
function getOnlinePresenceForFriend(friendId) {
  return window.AtriaOnlineBootstrap.getOnlinePresenceForFriend(friendId);
}

function getOnlinePresenceDisplayState(presence, options = {}) {
  return window.AtriaOnlinePresence.getPresenceDisplayState(presence, options);
}
function upsertLocalOnlinePresence(friendId, patch) {
  return window.AtriaOnlineBootstrap.upsertLocalOnlinePresence(friendId, patch);
}
function getOnlinePresenceSummary() {
  return window.AtriaOnlineBootstrap.getOnlinePresenceSummary();
}
function getCurrentOnlineFrontingPayload() {
  return window.AtriaOnlineBootstrap.getCurrentOnlineFrontingPayload(getOnlineBootstrapDepsForPresence());
}
async function buildOnlinePresencePackets(state, visibility = 'friends') {
  return window.AtriaOnlineBootstrap.buildOnlinePresencePackets(state, visibility, getOnlineBootstrapDepsForPresence());
}
async function decryptOnlinePresencePayload(friend, item) {
  return window.AtriaOnlineBootstrap.decryptOnlinePresencePayload(friend, item, getOnlineBootstrapDepsForPresence());
}
function choosePresencePayload(decrypted, item) {
  return window.AtriaOnlineBootstrap.choosePresencePayload(decrypted, item);
}
async function refreshOnlinePresenceFromBackend() {
  return window.AtriaOnlineBootstrap.refreshOnlinePresenceFromBackend(getOnlineBootstrapDepsForPresence());
}
async function setOnlinePresenceState(state) {
  return window.AtriaOnlineBootstrap.setOnlinePresenceState(state, getOnlineBootstrapDepsForPresence());
}
// Conversation domain wrappers
function getOnlineConversationsDeps() {
  return window.AtriaOnlineBootstrap.getOnlineConversationsDeps({
    lang: 'es',
    uid,
    loadOnlineFriends,
    loadOnlineAccount,
    hasOnlineBackendConfigured,
    onlineFetch,
    loadOnlineConversationIndex,
    saveOnlineConversationIndex,
    getOnlineConversationMessages,
    appendOnlineConversationMessage,
    getOnlineConversationMeta,
    setOnlineConversationMeta,
    mergeOnlineConversationMessages,
    migrateOnlineConversationCiphertext,
    decryptOnlineMessagePayload,
    decryptOnlineMessageText,
    encryptOnlineMessagePacket,
  });
}
async function ensureOnlineConversation(friend) {
  return window.AtriaOnlineBootstrap.ensureOnlineConversation(friend, getOnlineBootstrapDepsForConversations());
}
async function refreshOnlineConversation(friendId) {
  return window.AtriaOnlineBootstrap.refreshOnlineConversation(friendId, getOnlineBootstrapDepsForConversations());
}
async function sendOnlineConversationMessage(friendId, text, options = {}) {
  return window.AtriaOnlineBootstrap.sendOnlineConversationMessage(friendId, text, getOnlineBootstrapDepsForConversations(), options);
}
async function markOnlineConversationRead(friendId) {
  return window.AtriaOnlineBootstrap.markOnlineConversationRead(friendId, getOnlineBootstrapDepsForConversations());
}
function getOnlineBootstrapDepsForConversations() {
  return {
    lang: 'es',
    uid,
    loadOnlineFriends,
    loadOnlineAccount,
    hasOnlineBackendConfigured,
    onlineFetch,
    loadOnlineConversationIndex,
    saveOnlineConversationIndex,
    getOnlineConversationMessages,
    appendOnlineConversationMessage,
    getOnlineConversationMeta,
    setOnlineConversationMeta,
    mergeOnlineConversationMessages,
    migrateOnlineConversationCiphertext,
    decryptOnlineMessagePayload,
    decryptOnlineMessageText,
    encryptOnlineMessagePacket,
  };
}
// Crypto migration wrappers
function getOnlineBootstrapDepsForCryptoMigration() {
  return {
    getOnlineProfile,
    loadOnlineSession,
    hasOnlineBackendConfigured,
    loadOnlineKeypair,
    onlineFetch,
    saveOnlineAccount,
    loadOnlineAccount,
    saveOnlineKeypair,
    encryptBackupData,
    getOrCreateOnlineBackupSecret,
    uploadOnlineCryptoBundle,
    loadOnlineSyncState,
    saveOnlineSyncState,
  };
}
function getOnlineCryptoMigrationDeps() {
  return window.AtriaOnlineBootstrap.getOnlineCryptoMigrationDeps(getOnlineBootstrapDepsForCryptoMigration());
}
async function migrateOnlineSessionCryptoSilently() {
  return window.AtriaOnlineBootstrap.migrateOnlineSessionCryptoSilently(getOnlineBootstrapDepsForCryptoMigration());
}
// Sync wrappers
const ONLINE_SYNC_STATE_KEY = window.AtriaOnlineSync.keys.ONLINE_SYNC_STATE_KEY;
function getOnlineBootstrapDepsForSyncCore() {
  return {
    lang: 'es',
    uid,
    saveOnlineFriends,
    loadOnlineFriendRequests,
    saveOnlineFriendRequests,
    loadOnlineFriends,
    saveOnlinePresenceCache,
    loadOnlinePresenceCache,
    loadOnlineConversationIndex,
    saveOnlineConversationIndex,
    loadOnlineAccount,
    decryptOnlineMessagePayload,
    decryptOnlineMessageText,
    mergeOnlineConversationMessages,
    getOnlineConversationMessages,
    getOnlineConversationMeta,
    migrateOnlineConversationCiphertext,
    loadOnlineBackupStatus,
    saveOnlineBackupStatus,
    hasOnlineBackendConfigured,
    getOnlineProfile,
    onlineFetch,
    startOnlineEventsChannel,
    stopOnlineEventsChannel,
    notifyOnlineEvent,
    render: renderOnlineLiveUpdate,
  };
}
function getOnlineSyncDeps() {
  return window.AtriaOnlineBootstrap.getOnlineSyncDeps(getOnlineBootstrapDepsForSyncCore());
}
function loadOnlineSyncState() {
  return window.AtriaOnlineBootstrap.loadOnlineSyncState();
}
function saveOnlineSyncState(state) {
  return window.AtriaOnlineBootstrap.saveOnlineSyncState(state);
}
async function applyOnlineSyncBootstrapPayload(payload) {
  return window.AtriaOnlineBootstrap.applyOnlineSyncBootstrapPayload(payload, getOnlineBootstrapDepsForSyncCore());
}
async function runOnlineSyncBootstrap() {
  return window.AtriaOnlineBootstrap.runOnlineSyncBootstrap(getOnlineBootstrapDepsForSyncCore());
}
async function runOnlineSyncChanges() {
  return window.AtriaOnlineBootstrap.runOnlineSyncChanges(getOnlineBootstrapDepsForSyncCore());
}
// Realtime wrappers
function getOnlineBootstrapDepsForRealtimeHandlers() {
  return {
    lang: 'es',
    uid,
    loadOnlineAccount,
    findOnlineFriendBySystemId,
    decryptOnlineMessagePayload,
    decryptOnlineMessageText,
    mergeOnlineConversationMessages,
    getOnlineConversationMeta,
    setOnlineConversationMeta,
    markOnlineConversationRead,
    getOnlineChatActiveFriendId: () => (typeof onlineChatActiveFriendId !== 'undefined' ? onlineChatActiveFriendId : null),
    encryptedFallbackText: '[mensaje cifrado]',
    loadOnlineConversations,
    saveOnlineConversations,
    decryptOnlinePresencePayload,
    choosePresencePayload,
    upsertLocalOnlinePresence,
    refreshOnlineFriendsFromBackend,
    notifyOnlineEvent,
    runOnlineSyncChanges,
    saveOnlineSyncState,
    loadOnlineSyncState,
    render: renderOnlineLiveUpdate,
    loadOnlineSession,
    getOnlineApiBaseUrl,
    getOnlineProfile,
    hasOnlineBackendConfigured,
    EventSourceCtor: typeof EventSource !== 'undefined' ? EventSource : undefined,
  };
}
function getOnlineRealtimeDeps() {
  return window.AtriaOnlineBootstrap.getOnlineRealtimeDeps(getOnlineBootstrapDepsForRealtimeHandlers());
}
function scheduleOnlineRealtimeSync() {
  return window.AtriaOnlineBootstrap.scheduleOnlineRealtimeSync(getOnlineBootstrapDepsForRealtimeHandlers());
}
async function applyOnlineRealtimeMessage(change) {
  return window.AtriaOnlineBootstrap.applyOnlineRealtimeMessage(change, getOnlineBootstrapDepsForRealtimeHandlers());
}
function applyOnlineRealtimeRead(change) {
  return window.AtriaOnlineBootstrap.applyOnlineRealtimeRead(change, getOnlineBootstrapDepsForRealtimeHandlers());
}
async function applyOnlineRealtimePresence(change) {
  return window.AtriaOnlineBootstrap.applyOnlineRealtimePresence(change, getOnlineBootstrapDepsForRealtimeHandlers());
}
async function handleOnlineRealtimeChange(change) {
  return window.AtriaOnlineBootstrap.handleOnlineRealtimeChange(change, getOnlineBootstrapDepsForRealtimeHandlers());
}
function startOnlineEventsChannel() {
  return window.AtriaOnlineBootstrap.startOnlineEventsChannel(getOnlineBootstrapDepsForRealtimeHandlers());
}
function stopOnlineEventsChannel() {
  return window.AtriaOnlineBootstrap.stopOnlineEventsChannel();
}
function startOnlineSyncLoop() {
  return window.AtriaOnlineBootstrap.startOnlineSyncLoop(getOnlineBootstrapDepsForSyncCore());
}
function stopOnlineSyncLoop() {
  return window.AtriaOnlineBootstrap.stopOnlineSyncLoop(getOnlineBootstrapDepsForSyncCore());
}
function _bufToB64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function _b64urlToBuf(str) {
  const pad = str.length % 4 ? str + '='.repeat(4 - str.length % 4) : str;
  return Uint8Array.from(atob(pad.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)).buffer;
}
function readIncomingAltersState(raw) {
  if (raw == null) return { status:'missing', alters:[] };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    let list = [];
    if (Array.isArray(parsed)) list = parsed;
    else if (parsed && Array.isArray(parsed.alters)) list = parsed.alters;
    else if (parsed && Array.isArray(parsed.items)) list = parsed.items;
    else if (parsed && typeof parsed === 'object' && parsed.id && (parsed.name || parsed.role || parsed.emoji)) list = [parsed];
    else return { status:'unsupported', alters:[], raw };
    const alters = list.filter(a => a && typeof a === 'object').map(normalizeAlterPermissions);
    return alters.length ? { status:'ok', alters } : { status:'empty', alters:[] };
  } catch (error) {
    return { status:'invalid', alters:[], raw, error };
  }
}
function shouldSkipIncomingSyncWrite(key, value) {
  if (key !== 'tid_alters') return false;
  const current = readStoredAltersState();
  const incoming = readIncomingAltersState(value);
  if (current.status === 'ok' && incoming.status !== 'ok') return true;
  if (hasStoredAtriaDataBesidesAlters() && incoming.status !== 'ok') return true;
  return false;
}
async function bridgeDeriveSharedKey(myPrivB64url, peerPubB64url) {
  const myPrivKey = await crypto.subtle.importKey('pkcs8', _b64urlToBuf(myPrivB64url), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']);
  const peerPubKey = await crypto.subtle.importKey('raw', _b64urlToBuf(peerPubB64url), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerPubKey }, myPrivKey, 256);
  const hkdfKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const sharedKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('atria-p6-shared-key-v1') },
    hkdfKey, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  return _bufToB64url(await crypto.subtle.exportKey('raw', sharedKey));
}
async function bridgeEncryptPacket(payload, sharedKeyB64, mySignPrivB64) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', _b64urlToBuf(sharedKeyB64), { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  const ctB64 = _bufToB64url(ct), ivB64 = _bufToB64url(iv.buffer);
  let sig = '';
  if (mySignPrivB64) {
    const sigPriv = await crypto.subtle.importKey('pkcs8', _b64urlToBuf(mySignPrivB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    sig = _bufToB64url(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, sigPriv, new TextEncoder().encode(ctB64)));
  }
  return { v: 1, ct: ctB64, nonce: ivB64, sig, ts: new Date().toISOString() };
}
async function bridgeDecryptPacket(packet, sharedKeyB64, peerSigPubB64, options = {}) {
  if (peerSigPubB64 && packet.sig) {
    const sigPub = await crypto.subtle.importKey('raw', _b64urlToBuf(peerSigPubB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, sigPub, _b64urlToBuf(packet.sig), new TextEncoder().encode(packet.ct));
    if (!valid) throw new Error(options.lang === 'es' ? 'Firma de paquete invalida' : 'Invalid packet signature');
  }
  const key = await crypto.subtle.importKey('raw', _b64urlToBuf(sharedKeyB64), { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(_b64urlToBuf(packet.nonce)) }, key, _b64urlToBuf(packet.ct))));
}
async function generateBridgeKeypair() {
  const ecdhPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const ecdsaPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const [pubRaw, privPkcs8, sigPubRaw, sigPrivPkcs8] = await Promise.all([
    crypto.subtle.exportKey('raw', ecdhPair.publicKey),
    crypto.subtle.exportKey('pkcs8', ecdhPair.privateKey),
    crypto.subtle.exportKey('raw', ecdsaPair.publicKey),
    crypto.subtle.exportKey('pkcs8', ecdsaPair.privateKey),
  ]);
  return {
    publicKey: _bufToB64url(pubRaw),
    privateKey: _bufToB64url(privPkcs8),
    sigPub: _bufToB64url(sigPubRaw),
    sigPriv: _bufToB64url(sigPrivPkcs8),
    createdAt: new Date().toISOString(),
  };
}
// Backup wrappers
const ONLINE_BACKUP_SECRET_KEY = window.AtriaOnlineBackup.keys.ONLINE_BACKUP_SECRET_KEY;
const ONLINE_BACKUP_STATUS_KEY = window.AtriaOnlineBackup.keys.ONLINE_BACKUP_STATUS_KEY;
function getLocalAtriaDataKeysForOnlineRestore() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  return keys.filter(key =>
    key.startsWith('tid_') &&
    !key.startsWith('tid_online_') &&
    key !== ONLINE_BACKUP_SECRET_KEY &&
    key !== ONLINE_BACKUP_STATUS_KEY &&
    key !== 'tid_last_backup' &&
    !PIN_KEYS.includes(key)
  );
}
function confirmReplaceLocalDataForOnlineRestore({ localKeyCount, remoteKeyCount }) {
  return confirm(`Este dispositivo ya tiene datos locales de Atria (${localKeyCount} claves). Para cargar tu cuenta online, Atria reemplazara esos datos locales por el backup online validado (${remoteKeyCount} claves). Si tienes cambios locales sin subir, cancela y exporta un backup manual antes. Continuar?`);
}
function getOnlineBootstrapDepsForBackup() {
  return {
    lang: 'es',
    crypto,
    bufferToBase64Url: _bufToB64url,
    tidKeys: TID_KEYS,
    encryptBackupData,
    decryptBackupPayload,
    shouldSkipIncomingSyncWrite,
    pinKeys: PIN_KEYS,
    getLocalAtriaDataKeysForOnlineRestore,
    confirmReplaceLocalDataForOnlineRestore,
    loadOnlineSession,
    loadOnlineAccount,
    hasOnlineBackendConfigured,
    onlineFetch,
  };
}
function getOnlineBackupDeps() {
  return window.AtriaOnlineBootstrap.getOnlineBackupDeps(getOnlineBootstrapDepsForBackup());
}
function getOrCreateOnlineBackupSecret() {
  return window.AtriaOnlineBootstrap.getOrCreateOnlineBackupSecret(getOnlineBootstrapDepsForBackup());
}
function saveOnlineBackupSecret(secret) {
  return window.AtriaOnlineBootstrap.saveOnlineBackupSecret(secret);
}
function loadOnlineBackupStatus() {
  return window.AtriaOnlineBootstrap.loadOnlineBackupStatus();
}
function saveOnlineBackupStatus(status) {
  return window.AtriaOnlineBootstrap.saveOnlineBackupStatus(status);
}
function describeOnlineBackupStatus(status) {
  return window.AtriaOnlineBootstrap.describeOnlineBackupStatus(status, getOnlineBootstrapDepsForBackup());
}
function collectBackupExportData() {
  return window.AtriaOnlineBootstrap.collectBackupExportData(getOnlineBootstrapDepsForBackup());
}
async function buildOnlineAutomaticBackupPayload() {
  return window.AtriaOnlineBootstrap.buildOnlineAutomaticBackupPayload(getOnlineBootstrapDepsForBackup());
}
async function runOnlineAutomaticBackup(reason = 'manual') {
  return window.AtriaOnlineBootstrap.runOnlineAutomaticBackup(reason, getOnlineBootstrapDepsForBackup());
}
async function restoreOnlineAutomaticBackup() {
  return window.AtriaOnlineBootstrap.restoreOnlineAutomaticBackup(getOnlineBootstrapDepsForBackup());
}
function installOnlineAutoBackupWatcher() {
  return window.AtriaOnlineBootstrap.installOnlineAutoBackupWatcher(getOnlineBootstrapDepsForBackup());
}
