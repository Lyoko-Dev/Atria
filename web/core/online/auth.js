(function () {
  const STRINGS = {
    es: {
      missingCryptoBundle: 'La cuenta no tiene bundle criptografico',
      missingOnlineBackup: 'Esta cuenta todavia no tiene backup online con perfiles. Abre Atria en el dispositivo donde estan tus alters y ejecuta/sube un backup antes de iniciar sesion aqui.',
      oldPasswordUnlockFailed: 'La contrasena anterior no pudo abrir la clave del backup antiguo. Revisa esa contrasena o dejala vacia si no la recuerdas.',
    },
    en: {
      missingCryptoBundle: 'The account has no crypto bundle',
      missingOnlineBackup: 'This account does not have an online backup with profiles yet. Open Atria on the device that has your alters and run/upload a backup before signing in here.',
      oldPasswordUnlockFailed: 'The previous password could not unlock the old backup key. Check that password, or leave it empty if you do not remember it.',
    },
  };

  function strings(lang) {
    return STRINGS[lang] || STRINGS.en;
  }

  async function hydrateOnlineAccountData(deps) {
    const {
      restoreOnlineAutomaticBackup,
      runOnlineSyncBootstrap,
      requireBackup = false,
      lang = 'en',
    } = deps;
    const s = strings(lang);
    let restoredBackup = null;
    let restoreError = null;
    if (typeof restoreOnlineAutomaticBackup === 'function') {
      try {
        restoredBackup = await restoreOnlineAutomaticBackup();
      } catch (e) {
        if ((e?.message || '').includes('backup_not_found')) {
          if (requireBackup) restoreError = s.missingOnlineBackup;
          restoredBackup = null;
        } else {
          restoreError = e?.message || String(e);
        }
      }
    }
    let bootstrap = null;
    if (typeof runOnlineSyncBootstrap === 'function') {
      bootstrap = await runOnlineSyncBootstrap().catch(() => null);
    }
    return { restoredBackup, bootstrap, restoreError };
  }

  async function buildOnlineCryptoRegistration(password, deps) {
    const { generateBridgeKeypair, encryptBackupData, getOrCreateOnlineBackupSecret } = deps;
    const keypair = await generateBridgeKeypair();
    return buildOnlineCryptoBundleForKeypair(keypair, password, deps);
  }

  async function buildOnlineCryptoBundleForKeypair(keypair, password, deps) {
    const { encryptBackupData, getOrCreateOnlineBackupSecret } = deps;
    const backupSecret = typeof getOrCreateOnlineBackupSecret === 'function' ? getOrCreateOnlineBackupSecret() : '';
    const encryptedPrivateBundle = await encryptBackupData(JSON.stringify({
      publicKey: keypair.publicKey,
      privateKey: keypair.privateKey,
      sigPub: keypair.sigPub,
      sigPriv: keypair.sigPriv,
      backupSecret,
    }), password);
    return {
      keypair,
      upload: {
        publicKey: keypair.publicKey,
        sigPub: keypair.sigPub,
        encryptedPrivateBundle,
      },
    };
  }

  async function uploadOnlineCryptoBundle(upload, deps) {
    const { hasOnlineBackendConfigured, onlineFetch } = deps;
    if (!hasOnlineBackendConfigured()) return null;
    return onlineFetch('/v1/auth/crypto', {
      method: 'PATCH',
      body: JSON.stringify({ crypto: upload }),
    });
  }

  async function restoreOnlineKeypairFromAccount(account, password, deps) {
    const { decryptBackupPayload, decryptBackupData, saveOnlineBackupSecret, lang = 'en' } = deps;
    const decrypt = decryptBackupPayload || decryptBackupData;
    const bundle = account?.crypto?.encryptedPrivateBundle;
    if (!bundle) throw new Error(strings(lang).missingCryptoBundle);
    const json = await decrypt(bundle, password);
    const parsed = JSON.parse(json || '{}');
    if (parsed.backupSecret && typeof saveOnlineBackupSecret === 'function') {
      saveOnlineBackupSecret(parsed.backupSecret);
    }
    return {
      publicKey: parsed.publicKey || account?.crypto?.publicKey || '',
      privateKey: parsed.privateKey || '',
      sigPub: parsed.sigPub || account?.crypto?.sigPub || '',
      sigPriv: parsed.sigPriv || '',
    };
  }

  async function ensureOnlineCryptoProvisioned(account, password, deps) {
    if (account?.crypto?.encryptedPrivateBundle && account?.crypto?.publicKey) {
      return restoreOnlineKeypairFromAccount(account, password, deps);
    }
    const cryptoBundle = await buildOnlineCryptoRegistration(password, deps);
    await uploadOnlineCryptoBundle(cryptoBundle.upload, deps).catch(() => {});
    return cryptoBundle.keypair;
  }

  async function registerOnlineAccountRemote({ email, password, deviceName, consentAt, systemId = '', friendCode = '', displayName = '', rememberSession = true }, deps) {
    const {
      hasOnlineBackendConfigured,
      loadOnlineKeypair,
      generateBridgeKeypair,
      activateOnlineAccountSession,
      onlineAuthFetch,
      buildOnlineSystemId,
      loadConfig,
      restoreOnlineAutomaticBackup,
      runOnlineAutomaticBackup,
      runOnlineSyncBootstrap,
      lang = 'en',
    } = deps;

    if (!hasOnlineBackendConfigured()) {
      const keypair = loadOnlineKeypair() || await generateBridgeKeypair();
      activateOnlineAccountSession({
        email,
        systemId,
        friendCode,
        displayName,
        deviceName,
        consentAt,
        frontingEnabled: false,
        autoBackup: true,
        keypair,
        rememberSession,
      });
      return { mode: 'local' };
    }

    const cryptoBundle = await buildOnlineCryptoRegistration(password, deps);
    const data = await onlineAuthFetch('/v1/auth/register-account', {
      email,
      password,
      deviceName,
      acceptedOnlineConsent: true,
      systemId: systemId || buildOnlineSystemId(loadConfig()) || '',
      friendCode,
      displayName: displayName || loadConfig().systemName || friendCode || 'Atria',
      crypto: cryptoBundle.upload,
    });
    if (data?.token) window.AtriaOnlineBackend.setEphemeralToken(data.token);
    // Server no longer echoes email — use the one from the form
    activateOnlineAccountSession({
      email,
      systemId: data?.systemId || buildOnlineSystemId({ ...loadConfig(), onlineAccountEmail: email }),
      displayName: data?.displayName || '',
      friendCode: data?.friendCode || null,
      deviceId: data?.deviceId || null,
      deviceName,
      consentAt,
      frontingEnabled: false,
      autoBackup: true,
      authToken: data?.token || '',
      devices: Array.isArray(data?.devices) ? data.devices : null,
      keypair: cryptoBundle.keypair,
      accountCrypto: cryptoBundle.upload,
      rememberSession,
    });
    const initialBackup = typeof runOnlineAutomaticBackup === 'function'
      ? await runOnlineAutomaticBackup('initial-register').catch(error => ({ mode: 'error', error: error.message || String(error) }))
      : null;
    const bootstrap = typeof runOnlineSyncBootstrap === 'function'
      ? await runOnlineSyncBootstrap().catch(() => null)
      : null;
    return { mode: 'remote', data, initialBackup, restoredBackup: null, bootstrap };
  }

  async function loginOnlineAccountRemote({ email, password, deviceName, consentAt, rememberSession = true }, deps) {
    const {
      hasOnlineBackendConfigured,
      loadOnlineKeypair,
      generateBridgeKeypair,
      activateOnlineAccountSession,
      onlineAuthFetch,
      buildOnlineSystemId,
      loadConfig,
      restoreOnlineAutomaticBackup,
      runOnlineSyncBootstrap,
      lang = 'en',
    } = deps;

    if (!hasOnlineBackendConfigured()) {
      const cfg = loadConfig();
      const keypair = loadOnlineKeypair() || await generateBridgeKeypair();
      activateOnlineAccountSession({
        email,
        deviceName,
        consentAt,
        frontingEnabled: !!cfg.onlineFrontingEnabled,
        autoBackup: cfg.onlineAutoBackup !== false,
        keypair,
        rememberSession,
      });
      return { mode: 'local' };
    }

    const data = await onlineAuthFetch('/v1/auth/login', {
      email,
      password,
      deviceName,
    });
    if (data?.token) window.AtriaOnlineBackend.setEphemeralToken(data.token);
    // Server returns flat response — crypto is included for keypair restoration
    const keypair = await ensureOnlineCryptoProvisioned({ crypto: data?.crypto || null }, password, deps);
    const cfg = loadConfig();
    // Server no longer echoes email — use the one from the form
    activateOnlineAccountSession({
      email,
      systemId: data?.systemId || buildOnlineSystemId({ ...cfg, onlineAccountEmail: email }),
      displayName: data?.displayName || '',
      friendCode: data?.friendCode || null,
      deviceId: data?.deviceId || null,
      deviceName,
      consentAt,
      frontingEnabled: !!cfg.onlineFrontingEnabled,
      autoBackup: cfg.onlineAutoBackup !== false,
      authToken: data?.token || '',
      devices: Array.isArray(data?.devices) ? data.devices : null,
      keypair,
      accountCrypto: data?.crypto || null,
      rememberSession,
    });
    const hydration = await hydrateOnlineAccountData({
      restoreOnlineAutomaticBackup,
      runOnlineSyncBootstrap,
      requireBackup: true,
      lang,
    });
    return { mode: 'remote', data, ...hydration };
  }

  async function requestOnlinePasswordReset({ email }, deps) {
    const {
      hasOnlineBackendConfigured,
      onlineAuthFetch,
      lang = 'en',
    } = deps;
    if (!hasOnlineBackendConfigured()) {
      throw new Error(lang === 'es'
        ? 'La recuperacion de contrasena necesita el servicio online'
        : 'Password recovery needs the online service');
    }
    return onlineAuthFetch('/v1/auth/password-reset/request', { email });
  }

  async function requestOnlinePasswordResetCrypto({ token }, deps) {
    const {
      hasOnlineBackendConfigured,
      onlineAuthFetch,
      lang = 'en',
    } = deps;
    if (!hasOnlineBackendConfigured()) {
      throw new Error(lang === 'es'
        ? 'La recuperacion de contrasena necesita el servicio online'
        : 'Password recovery needs the online service');
    }
    if (!token) {
      throw new Error(lang === 'es' ? 'Escribe el codigo de recuperacion' : 'Enter the recovery code');
    }
    return onlineAuthFetch('/v1/auth/password-reset/crypto', { token });
  }

  async function buildPasswordResetCryptoBundle(token, password, oldPassword, deps) {
    const lang = deps?.lang || 'en';
    if (oldPassword) {
      let account = null;
      try {
        const previous = await requestOnlinePasswordResetCrypto({ token }, deps);
        account = { crypto: previous?.crypto || null };
        // Keep the account's online identity when the old password is known.
        // Messages are encrypted with the X25519 key and signed with the ECDSA
        // key; generating a fresh pair here would make the account recoverable
        // but would make its existing messages unreadable on the new device.
        const oldKeypair = await restoreOnlineKeypairFromAccount(account, oldPassword, deps);
        const rebuilt = await buildOnlineCryptoBundleForKeypair(oldKeypair, password, deps);
        return {
          ...rebuilt,
          preservedOnlineKeys: true,
        };
      } catch (error) {
        const message = error?.message || '';
        if (message === 'invalid_or_expired_reset_token') throw error;
        throw new Error(strings(lang).oldPasswordUnlockFailed);
      }
    }
    const fresh = await buildOnlineCryptoRegistration(password, deps);
    return { ...fresh, preservedOnlineKeys: false };
  }

  async function confirmOnlinePasswordReset({ token, password, oldPassword = '' }, deps) {
    const {
      hasOnlineBackendConfigured,
      onlineAuthFetch,
      lang = 'en',
    } = deps;
    if (!hasOnlineBackendConfigured()) {
      throw new Error(lang === 'es'
        ? 'La recuperacion de contrasena necesita el servicio online'
        : 'Password recovery needs the online service');
    }
    if (!token) {
      throw new Error(lang === 'es' ? 'Escribe el codigo de recuperacion' : 'Enter the recovery code');
    }
    if (!password || password.length < 8) {
      throw new Error(lang === 'es' ? 'La contrasena debe tener al menos 8 caracteres' : 'Password must be at least 8 characters');
    }
    const previousPassword = String(oldPassword || '').trim();
    const cryptoBundle = await buildPasswordResetCryptoBundle(token, password, previousPassword, deps);
    const data = await onlineAuthFetch('/v1/auth/password-reset/confirm', {
      token,
      password,
      crypto: cryptoBundle.upload,
    });
    return {
      data,
      keypair: cryptoBundle.keypair,
      accountCrypto: cryptoBundle.upload,
      preservedOldBackupKey: !!previousPassword,
      preservedOnlineKeys: !!cryptoBundle.preservedOnlineKeys,
    };
  }

  window.AtriaOnlineAuth = {
    buildOnlineCryptoRegistration,
    uploadOnlineCryptoBundle,
    restoreOnlineKeypairFromAccount,
    ensureOnlineCryptoProvisioned,
    registerOnlineAccountRemote,
    loginOnlineAccountRemote,
    requestOnlinePasswordReset,
    requestOnlinePasswordResetCrypto,
    confirmOnlinePasswordReset,
  };
})();
