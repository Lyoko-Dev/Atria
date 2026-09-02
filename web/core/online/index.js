(function () {
  const modules = [
    { id: 'account', global: 'AtriaOnlineAccount', file: 'account.js' },
    { id: 'backend', global: 'AtriaOnlineBackend', file: 'backend.js' },
    { id: 'auth', global: 'AtriaOnlineAuth', file: 'auth.js' },
    { id: 'friends', global: 'AtriaOnlineFriends', file: 'friends.js' },
    { id: 'devices', global: 'AtriaOnlineDevices', file: 'devices.js' },
    { id: 'bootstrap', global: 'AtriaOnlineBootstrap', file: 'bootstrap.js' },
    { id: 'conversations-storage', global: 'AtriaOnlineConversationsStorage', file: 'conversations-storage.js' },
    { id: 'messages-crypto', global: 'AtriaOnlineMessagesCrypto', file: 'messages-crypto.js' },
    { id: 'conversations', global: 'AtriaOnlineConversations', file: 'conversations.js' },
    { id: 'crypto-migration', global: 'AtriaOnlineCryptoMigration', file: 'crypto-migration.js' },
    { id: 'presence', global: 'AtriaOnlinePresence', file: 'presence.js' },
    { id: 'realtime', global: 'AtriaOnlineRealtime', file: 'realtime.js' },
    { id: 'sync', global: 'AtriaOnlineSync', file: 'sync.js' },
    { id: 'backup', global: 'AtriaOnlineBackup', file: 'backup.js' },
    { id: 'devices-diagnostics', global: 'AtriaOnlineDevicesDiagnostics', file: 'devices-diagnostics.js' },
  ];

  function getMissingModules() {
    return modules.filter(module => !window[module.global]);
  }

  function isReady() {
    return getMissingModules().length === 0;
  }

  function getModuleIds() {
    return modules.map(module => module.id);
  }

  window.AtriaOnline = {
    version: '0.13.0',
    kind: 'online',
    modules,
    getMissingModules,
    getModuleIds,
    isReady,
  };
})();
