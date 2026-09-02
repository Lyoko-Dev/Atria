(function () {
  async function refreshOnlineDevices(deps) {
    const { hasOnlineBackendConfigured, onlineFetch, saveOnlineDevicesCache } = deps;
    if (!hasOnlineBackendConfigured()) {
      return { mode: 'local', devices: [] };
    }
    const data = await onlineFetch('/v1/devices');
    const devices = Array.isArray(data?.devices) ? data.devices : [];
    saveOnlineDevicesCache(devices);
    return { mode: 'remote', devices };
  }

  async function revokeOnlineDevice(deviceId, deps) {
    const { hasOnlineBackendConfigured, onlineFetch, saveOnlineDevicesCache } = deps;
    if (!deviceId) throw new Error('device_missing');
    if (!hasOnlineBackendConfigured()) {
      throw new Error('backend_not_configured');
    }
    const data = await onlineFetch(`/v1/devices/${encodeURIComponent(deviceId)}/revoke`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const devices = Array.isArray(data?.devices) ? data.devices : [];
    saveOnlineDevicesCache(devices);
    return { mode: 'remote', devices };
  }

  async function renameOnlineDevice(deviceId, platform, deps) {
    const { hasOnlineBackendConfigured, onlineFetch, saveOnlineDevicesCache } = deps;
    const nextName = String(platform || '').trim();
    if (!deviceId || !nextName) throw new Error('device_missing');
    if (!hasOnlineBackendConfigured()) {
      throw new Error('backend_not_configured');
    }
    const data = await onlineFetch(`/v1/devices/${encodeURIComponent(deviceId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ platform: nextName }),
    });
    const devices = Array.isArray(data?.devices) ? data.devices : [];
    saveOnlineDevicesCache(devices);
    return { mode: 'remote', devices, deviceId, platform: nextName };
  }

  window.AtriaOnlineDevices = {
    refreshOnlineDevices,
    revokeOnlineDevice,
    renameOnlineDevice,
  };
})();
