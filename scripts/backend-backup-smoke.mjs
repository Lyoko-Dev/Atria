import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class MemoryStorage {
  #data = new Map();
  get length() { return this.#data.size; }
  key(index) { return [...this.#data.keys()][index] ?? null; }
  getItem(key) { return this.#data.has(String(key)) ? this.#data.get(String(key)) : null; }
  setItem(key, value) { this.#data.set(String(key), String(value)); }
  removeItem(key) { this.#data.delete(String(key)); }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
globalThis.window = {
  AtriaStorage: {
    parseJsonKey: (key, fallback) => {
      try { return JSON.parse(storage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
    },
    writeJsonKey: (key, value) => storage.setItem(key, JSON.stringify(value)),
  },
  confirm: () => true,
};
vm.runInThisContext(readFileSync('shared/online/backup.js', 'utf8'), { filename: 'shared/online/backup.js' });
const backup = window.AtriaOnlineBackup;
const deps = {
  tidKeys: ['tid_alters', 'tid_config'],
  crypto: { getRandomValues(bytes) { bytes.fill(7); return bytes; } },
  bufferToBase64Url: buffer => Buffer.from(buffer).toString('base64url'),
  encryptBackupData: async (json, secret) => ({ encrypted: true, data: Buffer.from(`${secret}:${json}`).toString('base64') }),
  hasOnlineBackendConfigured: () => false,
  loadOnlineSession: () => ({ autoBackup: true }),
  loadOnlineAccount: () => ({ id: 'test-account' }),
  onlineFetch: async () => { throw new Error('onlineFetch should not be called in local mode'); },
  lang: 'en',
};

storage.setItem('tid_alters', JSON.stringify([{ id: 'a1', name: 'Alpha' }]));
storage.setItem('tid_config', '{"theme":"dark"}');
storage.setItem('tid_a1_transactions', '[{"amount":3}]');
storage.setItem('tid_online_backup_secret', 'existing-secret');
storage.setItem('tid_online_backup_status', '{"lastMode":"old"}');

const collected = backup.collectBackupExportData(deps);
assert.deepEqual(Object.keys(collected).sort(), ['tid_a1_transactions', 'tid_alters', 'tid_config']);
const payload = await backup.buildOnlineAutomaticBackupPayload(deps);
assert.equal(payload.encrypted, true);
assert.equal(payload.keyCount, 3);
assert.equal(backup.loadOnlineBackupSecret(), 'existing-secret');

const localRun = await backup.runOnlineAutomaticBackup('manual-test', deps);
assert.equal(localRun.mode, 'local');
assert.equal(backup.loadOnlineBackupStatus().lastMode, 'local');

storage.setItem('tid_local_only', 'remove-me');
const restoreDeps = {
  ...deps,
  hasOnlineBackendConfigured: () => true,
  onlineFetch: async path => {
    assert.equal(path, '/v1/backups/latest');
    return { backup: { payload: 'ciphertext' } };
  },
  decryptBackupPayload: async () => JSON.stringify({
    tid_alters: JSON.stringify([{ id: 'a2', name: 'Beta' }]),
    tid_config: '{"theme":"light"}',
  }),
};
const restored = await backup.restoreOnlineAutomaticBackup(restoreDeps);
assert.equal(restored.count, 2);
assert.equal(storage.getItem('tid_local_only'), null);
assert.match(storage.getItem('tid_alters'), /Beta/);
assert.equal(storage.getItem('tid_online_backup_secret'), 'existing-secret');
assert.equal(window.__atriaOnlineRestoreInProgress, false);

console.log('Backend/backup smoke OK: local payload, encryption envelope, restore replacement and protected keys');
