(function () {
  const STRINGS = {
    es: {
      missingPrivateKey: 'Falta la clave privada online en este dispositivo',
      missingFriendPublicKey: 'La amistad no tiene clave publica online',
    },
    en: {
      missingPrivateKey: 'Missing this device online private key',
      missingFriendPublicKey: 'The friend has no online public key',
    },
  };

  function strings(lang) {
    return STRINGS[lang] || STRINGS.en;
  }

  async function deriveOnlineSharedKey(friend, deps) {
    const { loadOnlineKeypair, bridgeDeriveSharedKey, lang = 'en' } = deps;
    const keypair = loadOnlineKeypair();
    const s = strings(lang);
    if (!keypair?.privateKey) throw new Error(s.missingPrivateKey);
    if (!friend?.cryptoPublicKey) throw new Error(s.missingFriendPublicKey);
    return bridgeDeriveSharedKey(keypair.privateKey, friend.cryptoPublicKey);
  }

  async function encryptOnlineMessagePacket(friend, text, deps, options = {}) {
    const { loadOnlineKeypair, bridgeEncryptPacket } = deps;
    const keypair = loadOnlineKeypair();
    const sharedKey = await deriveOnlineSharedKey(friend, deps);
    return bridgeEncryptPacket({
      type: 'message',
      text,
      ts: new Date().toISOString(),
      senderAlter: options.senderAlter || null,
    }, sharedKey, keypair?.sigPriv || '');
  }

  async function decryptOnlineMessagePayload(friend, message, deps) {
    const { loadOnlineAccount, loadOnlineKeypair, bridgeDecryptPacket } = deps;
    if (!message?.encryptedPacket) return { text: message?.body || message?.text || '', senderAlter: message?.senderAlter || null };
    const sharedKey = await deriveOnlineSharedKey(friend, deps);
    const ownSystemId = loadOnlineAccount()?.systemId || '';
    const ownSigPub = loadOnlineKeypair()?.sigPub || '';
    const peerSigPub = message.senderSystemId === ownSystemId ? ownSigPub : (friend?.cryptoSigPub || '');
    const payload = await bridgeDecryptPacket(message.encryptedPacket, sharedKey, peerSigPub);
    return {
      text: payload?.text || '',
      senderAlter: payload?.senderAlter || null,
    };
  }

  async function decryptOnlineMessageText(friend, message, deps) {
    const payload = await decryptOnlineMessagePayload(friend, message, deps);
    return payload?.text || '';
  }

  async function migrateOnlineConversationCiphertext(friend, conversationId, messages, deps) {
    const { hasOnlineBackendConfigured, loadOnlineAccount, loadOnlineKeypair, bridgeEncryptPacket, onlineFetch } = deps;
    if (!hasOnlineBackendConfigured()) return messages;
    const ownSystemId = loadOnlineAccount()?.systemId || '';
    const sharedKey = await deriveOnlineSharedKey(friend, deps).catch(() => null);
    if (!sharedKey) return messages;
    const keypair = loadOnlineKeypair();
    const upgraded = [];
    for (const msg of messages) {
      if (msg?.encrypted || msg?.encryptedPacket || !msg?.body) {
        upgraded.push(msg);
        continue;
      }
      try {
        const packet = await bridgeEncryptPacket(
          { type: 'message', text: msg.body, ts: msg.createdAt || new Date().toISOString() },
          sharedKey,
          msg.senderSystemId === ownSystemId ? (keypair?.sigPriv || '') : ''
        );
        const result = await onlineFetch(`/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(msg.id)}/rekey`, {
          method: 'PATCH',
          body: JSON.stringify({ packet }),
        });
        upgraded.push(result?.message || { ...msg, encrypted: true, encryptedPacket: packet, body: '' });
      } catch {
        upgraded.push(msg);
      }
    }
    return upgraded;
  }

  window.AtriaOnlineMessagesCrypto = {
    deriveOnlineSharedKey,
    encryptOnlineMessagePacket,
    decryptOnlineMessagePayload,
    decryptOnlineMessageText,
    migrateOnlineConversationCiphertext,
  };
})();
