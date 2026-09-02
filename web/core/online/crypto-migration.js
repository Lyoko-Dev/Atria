(function () {
  async function migrateOnlineSessionCryptoSilently(deps) {
    const {
      getOnlineProfile,
      loadOnlineSession,
      hasOnlineBackendConfigured,
      loadOnlineKeypair,
      onlineFetch,
      saveOnlineAccount,
      loadOnlineAccount,
      loadBridgeKeypair,
      saveOnlineKeypair,
      encryptBackupData,
      getOrCreateOnlineBackupSecret,
      uploadOnlineCryptoBundle,
      loadOnlineSyncState,
      saveOnlineSyncState,
    } = deps;

    const profile = getOnlineProfile();
    const session = loadOnlineSession();
    if (!profile.enabled || !hasOnlineBackendConfigured() || !session?.authToken || loadOnlineKeypair()) return false;
    try {
      const me = await onlineFetch('/v1/auth/me');
      const account = me?.account || null;
      if (account) {
        saveOnlineAccount({
          id: account.id || loadOnlineAccount()?.id || null,
          email: account.email || loadOnlineAccount()?.email || '',
          systemId: account.systemId || loadOnlineAccount()?.systemId || '',
          displayName: account.displayName || loadOnlineAccount()?.displayName || '',
          crypto: account.crypto || null,
          consentAt: account.onlineConsentAt || loadOnlineAccount()?.consentAt || null,
          createdAt: account.createdAt || loadOnlineAccount()?.createdAt || null,
        });
      }
      const bridgeKeypair = typeof loadBridgeKeypair === 'function' ? loadBridgeKeypair() : null;
      if (bridgeKeypair?.privateKey) {
        saveOnlineKeypair(bridgeKeypair);
        if (!account?.crypto?.publicKey) {
          const encryptedPrivateBundle = await encryptBackupData(JSON.stringify({
            publicKey: bridgeKeypair.publicKey,
            privateKey: bridgeKeypair.privateKey,
            sigPub: bridgeKeypair.sigPub,
            sigPriv: bridgeKeypair.sigPriv,
          }), getOrCreateOnlineBackupSecret());
          await uploadOnlineCryptoBundle({
            publicKey: bridgeKeypair.publicKey,
            sigPub: bridgeKeypair.sigPub,
            encryptedPrivateBundle,
          }).catch(() => {});
        }
        return true;
      }
      saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), needsCryptoRestore: true });
    } catch (e) {
      saveOnlineSyncState({ ...(loadOnlineSyncState() || {}), cryptoMigrationError: e?.message || 'crypto_migration_failed' });
    }
    return false;
  }

  window.AtriaOnlineCryptoMigration = {
    migrateOnlineSessionCryptoSilently,
  };
})();
