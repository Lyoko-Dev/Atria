// Views for the online section of the Hub.
// Loaded before app.js because the routes use these globals.
// ── ONLINE — HUB VIEWS ──
function renderOnlineAmigos() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Online',action:()=>navigateTo('hub')},{label:'Friends'}]);
  const app = document.getElementById('app');
  const friends = loadOnlineFriends();
  const requests = loadOnlineFriendRequests();
  const incoming = requests.filter(r => r.status === 'pending' && r.direction !== 'outgoing');
  const outgoing = requests.filter(r => r.status === 'pending' && r.direction === 'outgoing');
  const presenceMap = loadOnlinePresenceCache();
  const account = loadOnlineAccount();
  const online = getOnlineProfile(loadConfig());
  const session = loadOnlineSession();
  const privacyMode = !!loadConfig().onlinePrivacyMode;
  const syncState = loadOnlineSyncState();
  const transportFailed = !!syncState.lastError || (
    syncState.realtimeDisconnectedAt && (!syncState.realtimeConnectedAt || syncState.realtimeDisconnectedAt > syncState.realtimeConnectedAt)
  ) || (
    syncState.realtimeOfflineAt && (!syncState.realtimeOnlineAt || syncState.realtimeOfflineAt > syncState.realtimeOnlineAt)
  );
  const normalizeAtriaCode = value => {
    const match = String(value || '').match(/ATRIA-\d{4}-\d{4}-\d{4}/i);
    return match ? match[0].toUpperCase() : '';
  };
  const normalizeAtriaSystemId = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 20);
  const extractOnlineIdentifier = value => {
    const raw = String(value || '').trim();
    const code = normalizeAtriaCode(raw);
    if (code) return code;
    const email = raw.match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/);
    if (email) return email[0].toLowerCase();
    const idLine = raw.match(/\bID\s*:\s*([A-Z0-9]{8,20})\b/i);
    if (idLine) return normalizeAtriaSystemId(idLine[1]);
    const compact = normalizeAtriaSystemId(raw);
    return compact.length >= 8 ? compact : raw;
  };
  const currentOnlineIdentity = () => {
    const freshAccount = loadOnlineAccount() || {};
    const freshOnline = getOnlineProfile(loadConfig());
    return {
      friendCode: normalizeAtriaCode(freshAccount.friendCode) || normalizeAtriaCode(freshOnline.friendCode) || '',
      systemId: normalizeAtriaSystemId(freshAccount.systemId || freshOnline.systemId || ''),
    };
  };
  const updateVisibleOnlineIdentity = identity => {
    const code = normalizeAtriaCode(identity?.friendCode) || currentOnlineIdentity().friendCode;
    const systemId = normalizeAtriaSystemId(identity?.systemId || currentOnlineIdentity().systemId);
    const codeEl = app.querySelector('[data-online-my-friend-code]');
    if (codeEl) codeEl.textContent = code || 'ATRIA code pending';
    app.dataset.onlineFriendCode = code || '';
    app.dataset.onlineSystemId = systemId || '';
    return { friendCode: code, systemId };
  };
  const myFriendCode = currentOnlineIdentity().friendCode;
  const mySystemId = normalizeAtriaSystemId(account?.systemId || online.systemId || '');
  const myPresenceState = ['online','idle','offline'].includes(session?.presenceState) ? session.presenceState : 'offline';
  const frontingPayload = getCurrentOnlineFrontingPayload();
  const identityShareText = [
    account?.displayName || online.displayName || loadConfig().systemName || 'Atria System',
    myFriendCode ? `ATRIA code: ${myFriendCode}` : '',
    mySystemId ? `ID: ${mySystemId}` : '',
  ].filter(Boolean).join('\n');

  const presenceDot = (id) => {
    const p = presenceMap[id];
    const state = p ? getOnlinePresenceDisplayState(p, { transportFailed }) : 'unknown';
    const c = state === 'offline' || state === 'unknown' ? 'var(--text-3)' : state === 'stale' ? '#ffb86b' : state === 'online' ? '#5fffb0' : '#ffd580';
    return `<span data-online-presence-dot="${escM(id)}" title="${escAttr(state)}" style="color:${c}">●</span>`;
  };
  const presenceLabel = state => ({ online:'Online', idle:'Away', offline:'Offline', stale:'Unconfirmed', unknown:'Unavailable' })[state] || 'Unavailable';
  const friendPermissionMeta = friend => {
    const p = normalizeOnlineFriendPermissions(friend.permissions);
    const profiles = p.profileSharing === 'all' ? 'all profiles' : p.profileSharing === 'selected' ? `${p.selectedProfileIds.length} profile${p.selectedProfileIds.length!==1?'s':''}` : 'no profiles';
    return `Fronting ${p.viewFronting ? 'yes' : 'no'} · Chat ${p.chat ? 'yes' : 'no'} · ${profiles} · Journal ${p.journalSharing ? 'yes' : 'no'} · Polls ${p.pollsSharing ? 'yes' : 'no'}`;
  };
  const friendPresenceMeta = friend => {
    const p = presenceMap[friend.id] || null;
    const front = p?.fronting || null;
    const stateLabel = presenceLabel(p ? getOnlinePresenceDisplayState(p, { transportFailed }) : 'unknown');
    const frontLabel = front?.alterName ? `Fronting: ${front.alterEmoji ? front.alterEmoji + ' ' : ''}${front.alterName}` : '';
    return [stateLabel, frontLabel, friendPermissionMeta(friend), friend.friendCode || ''].filter(Boolean).join(' · ');
  };
  const requestMeta = r => `${r.direction === 'outgoing' ? 'Sent' : 'Received'}${r.createdAt ? ' · ' + new Date(r.createdAt).toLocaleString('en') : ''}`;

  const renderSignature = JSON.stringify({
    friends: friends.map(f => [f.id, f.displayName, f.identifier, f.friendCode, normalizeOnlineFriendPermissions(f.permissions)]),
    requests: requests.map(r => [r.id, r.status, r.direction, r.displayName, r.identifier, r.fromId, r.toId]),
  });
  app.dataset.onlineAmigosSignature = renderSignature;
  app.innerHTML = `
  <div style="max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:20px;animation:fadeUp 360ms ease both">
    <div>
      <div class="fin-title">◉ Friends</div>
      <div class="fin-subtitle">Online · ${friends.length} friend${friends.length!==1?'s':''} · ${incoming.length} incoming · ${outgoing.length} sent${privacyMode ? ' · privacy active' : ''}</div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;padding:14px 16px;background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-1)">Shareable identity</div>
          <div data-online-my-friend-code style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);margin-top:4px">${escM(myFriendCode || 'ATRIA code pending')}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px">Share this code to receive requests without exposing email.</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" id="btn-online-copy-code">Copy code</button>
          <button class="btn btn-ghost btn-sm" id="btn-online-copy-identity">Copy ID</button>
          <button class="btn btn-ghost btn-sm" id="btn-online-bulk-perms">Bulk permissions</button>
          <button class="btn ${privacyMode?'btn-primary':'btn-ghost'} btn-sm" id="btn-online-privacy-mode">${privacyMode?'Privacy active':'Privacy mode'}</button>
          <button class="btn btn-ghost btn-sm" id="btn-online-refresh-friends">Refresh</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:10px">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text-1)">Presence</div>
          <div style="font-size:11px;color:var(--text-3)">Fronting ${online.fronting ? 'consented' : 'hidden'}${frontingPayload?.alterName ? ` · ${escM(frontingPayload.alterName)}` : ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          ${['online','idle','offline'].map(state => `<button class="btn ${myPresenceState===state?'btn-primary':'btn-ghost'} btn-sm" data-presence-state="${state}">${presenceLabel(state)}</button>`).join('')}
          <label class="toggle-switch" title="Share fronting with friends"><input type="checkbox" id="online-friends-fronting" ${online.fronting?'checked':''}><span class="toggle-slider"></span></label>
        </div>
      </div>
    </div>

    ${incoming.length ? `<div style="display:flex;flex-direction:column;gap:8px">
      <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.1em;font-family:'DM Mono',monospace">Incoming requests</div>
      ${incoming.map(r => `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md)">
        <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text-1)">${escM(r.displayName || r.identifier || r.fromId)}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">${escM(requestMeta(r))}</div></div>
        <button class="btn btn-primary btn-sm" data-req-accept="${escM(r.id)}">Accept</button>
        <button class="btn btn-ghost btn-sm" data-req-reject="${escM(r.id)}">Reject</button>
      </div>`).join('')}
    </div>` : ''}

    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.1em;font-family:'DM Mono',monospace">Friends</div>
      ${friends.length ? friends.map(f => `<div data-online-friend-row="${escM(f.id)}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md)">
        ${presenceDot(f.id)}
        <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text-1)">${escM(f.displayName || f.identifier)}</div><div data-online-presence-meta="${escM(f.id)}" style="font-size:11px;color:var(--text-3);margin-top:2px">${escM(friendPresenceMeta(f))}</div></div>
        <button class="btn btn-ghost btn-xs" data-open-shared-profile="${escM(f.id)}">Profile</button>
        <button class="btn btn-ghost btn-xs" data-online-friend-perms="${escM(f.id)}">Permissions</button>
        <button class="btn btn-ghost btn-xs" data-remove-online-friend="${escM(f.id)}">Remove</button>
      </div>`).join('') : `<div style="font-size:13px;color:var(--text-3);padding:12px 0">No friends yet. Add someone using their code, email or ID.</div>`}
    </div>

    ${outgoing.length ? `<div style="display:flex;flex-direction:column;gap:8px">
      <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.1em;font-family:'DM Mono',monospace">Sent requests</div>
      ${outgoing.map(r => `<div style="padding:10px 12px;background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);font-size:13px;color:var(--text-2)">
        <div style="font-weight:600;color:var(--text-1)">${escM(r.displayName || r.identifier || r.toId)}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">${escM(requestMeta(r))} · pending</div>
      </div>`).join('')}
    </div>` : ''}

    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.1em;font-family:'DM Mono',monospace">Add friend</div>
      <div style="display:flex;gap:8px">
        <input id="online-add-friend-input" type="text" placeholder="ATRIA-XXXX-XXXX-XXXX, email or ID" style="flex:1;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;font-size:13px;color:var(--text-1)">
        <button class="btn btn-primary btn-sm" id="btn-online-add-friend">Send</button>
      </div>
    </div>
  </div>`;

  app.querySelector('#btn-online-copy-code')?.addEventListener('click', async () => {
    const freshAccount = await refreshOnlineAccountIdentityFromBackend().catch(() => null);
    const freshProfile = getOnlineProfile(loadConfig());
    const visible = updateVisibleOnlineIdentity({ friendCode: freshAccount?.friendCode || freshProfile.friendCode, systemId: freshAccount?.systemId || freshProfile.systemId });
    const code = visible.friendCode;
    if (!code) return showToast('ATRIA code is not available yet');
    navigator.clipboard.writeText(code).then(() => showToast('ATRIA code copied')).catch(() => showToast('Could not copy'));
  });
  app.querySelector('#btn-online-copy-identity')?.addEventListener('click', async () => {
    const freshAccount = await refreshOnlineAccountIdentityFromBackend().catch(() => null);
    const freshProfile = getOnlineProfile(loadConfig());
    const systemId = normalizeAtriaSystemId(freshAccount?.systemId || freshProfile.systemId || mySystemId);
    if (!systemId) return showToast('Online ID is not available yet');
    navigator.clipboard.writeText(systemId).then(() => showToast('Online ID copied')).catch(() => showToast('Could not copy'));
  });
  app.querySelector('#btn-online-bulk-perms')?.addEventListener('click', openOnlineBulkPermissionsModal);
  app.querySelector('#btn-online-privacy-mode')?.addEventListener('click', async () => {
    if (loadConfig().onlinePrivacyMode) {
      saveConfig({ ...loadConfig(), onlinePrivacyMode: false });
      showToast('Privacy mode disabled. Permissions are not restored automatically.');
      renderOnlineAmigos();
      return;
    }
    if (!confirm('Enable privacy mode? Fronting, profiles, journal, polls and online chat will be hidden for all current friends.')) return;
    await applyOnlineQuickPrivacyMode();
  });
  refreshOnlineAccountIdentityFromBackend()
    .then(updateVisibleOnlineIdentity)
    .catch(() => {});
  app.querySelector('#btn-online-refresh-friends')?.addEventListener('click', async () => {
    const btn = app.querySelector('#btn-online-refresh-friends');
    if (btn) btn.disabled = true;
    try {
      await refreshOnlineFriendsFromBackend();
      await refreshOnlinePresenceFromBackend().catch(() => {});
      showToast('Friends refreshed');
      renderOnlineAmigos();
    } catch(e) { showToast('⚠ ' + (e?.message || 'Could not refresh')); if (btn) btn.disabled = false; }
  });
  app.querySelectorAll('[data-remove-online-friend]').forEach(btn => btn.addEventListener('click', async () => {
    const friend = loadOnlineFriends().find(f => f.id === btn.dataset.removeOnlineFriend);
    if (!friend) return;
    if (!confirm(`Remove ${friend.displayName || friend.identifier || 'this friend'}? Their presence will be hidden and online chat with this friend will stop.`)) return;
    btn.disabled = true;
    try {
      await removeOnlineFriend(friend);
      showToast('Friend removed');
      renderOnlineAmigos();
    } catch(e) { showToast('⚠ ' + (e?.message || 'Could not remove friend')); btn.disabled = false; }
  }));
  app.querySelectorAll('[data-online-friend-perms]').forEach(btn => btn.addEventListener('click', () => {
    const friend = loadOnlineFriends().find(f => f.id === btn.dataset.onlineFriendPerms);
    if (friend) openOnlineFriendPermissionsModal(friend);
  }));
  app.querySelectorAll('[data-open-shared-profile]').forEach(btn => btn.addEventListener('click', () => {
    window.onlineSharedProfileFriendId = btn.dataset.openSharedProfile;
    navigateTo('online-shared-profile');
  }));
  app.querySelectorAll('[data-presence-state]').forEach(btn => btn.addEventListener('click', async () => {
    const state = btn.dataset.presenceState || 'online';
    btn.disabled = true;
    try {
      await setOnlinePresenceState(state);
      showToast('Presence updated');
      renderOnlineAmigos();
    } catch(e) { showToast('⚠ ' + (e?.message || 'Could not update presence')); btn.disabled = false; }
  }));
  app.querySelector('#online-friends-fronting')?.addEventListener('change', async e => {
    const enabled = !!e.target.checked;
    saveConfig({ ...loadConfig(), onlineFrontingEnabled: enabled });
    const currentSession = loadOnlineSession();
    if (currentSession) saveOnlineSession({ ...currentSession, frontingEnabled: enabled });
    await setOnlinePresenceState(loadOnlineSession()?.presenceState || 'online').catch(() => {});
    showToast(enabled ? 'Fronting sharing enabled' : 'Fronting hidden');
    renderOnlineAmigos();
  });

  app.querySelectorAll('[data-req-accept]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await acceptLocalOnlineFriendRequest(btn.dataset.reqAccept);
      showToast('Request accepted ✓');
      renderOnlineAmigos();
    } catch(e) { showToast('⚠ ' + (e?.message || 'Error')); btn.disabled = false; }
  }));
  app.querySelectorAll('[data-req-reject]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await rejectLocalOnlineFriendRequest(btn.dataset.reqReject);
      showToast('Request rejected');
      renderOnlineAmigos();
    } catch(e) { showToast('⚠ ' + (e?.message || 'Error')); btn.disabled = false; }
  }));
  const addFriendInput = app.querySelector('#online-add-friend-input');
  const addFriendButton = app.querySelector('#btn-online-add-friend');
  if (addFriendButton) addFriendButton.disabled = false;
  addFriendInput?.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') addFriendButton?.click();
  });
  addFriendButton?.addEventListener('click', async () => {
    const input = app.querySelector('#online-add-friend-input');
    const identifier = extractOnlineIdentifier(input?.value || '');
    if (!identifier) return showToast('⚠ Enter an identifier');
    const btn = app.querySelector('#btn-online-add-friend');
    if (btn) btn.disabled = true;
    try {
      await withOnlineActionTimeout(sendOnlineFriendRequest(identifier), 12000, 'The online service did not respond in time');
      showToast('Request sent ✓');
      if (input) input.value = '';
      renderOnlineAmigos();
    } catch(e) { showToast('⚠ ' + (e?.message || 'Could not send request')); }
    finally { if (btn) btn.disabled = false; }
  });
}

function renderOnlineSharedProfile() {
  const friends = loadOnlineFriends();
  const friend = friends.find(item => item.id === window.onlineSharedProfileFriendId) || friends[0] || null;
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Online',action:()=>navigateTo('hub')},{label:'Friends',action:()=>navigateTo('online-amigos')},{label:'Shared profile'}]);
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="system-profile-view">
    <div class="system-profile-title-row">
      <div>
        <div class="fin-title">◇ Shared profile</div>
        <div class="fin-subtitle">${friend ? `Viewing what ${escM(friend.displayName || friend.identifier || 'this friend')} can see` : 'No friend selected'}</div>
      </div>
      <div class="system-profile-actions">
        <button class="btn btn-ghost btn-sm" id="btn-shared-profile-back">Back</button>
        ${friend ? `<button class="btn btn-primary btn-sm" data-copy-preview-profile="${escAttr(friend.id)}">Copy text</button>` : ''}
      </div>
    </div>
    ${friend ? renderPublicSharedProfilePreview(friend) : `<div class="system-profile-empty-share">No shared profile is available yet.</div>`}
  </div>`;
  app.querySelector('#btn-shared-profile-back')?.addEventListener('click', () => navigateTo('online-amigos'));
  bindSystemProfilePreviewActions(app);
}

function getOnlinePermissionProfileOptions() {
  try {
    return (typeof getAlters === 'function' ? getAlters(true) : [])
      .map(alter => ({
        id: String(alter.id || '').trim(),
        name: alter.name || alter.displayName || 'Profile',
        emoji: alter.emoji || alter.symbol || '',
        roleType: alter.roleType || '',
        role: alter.role || '',
        ageType: alter.ageType || '',
      }))
      .filter(alter => alter.id);
  } catch {
    return [];
  }
}
function onlineProfileFilterOptions(key) {
  const values = new Map();
  getOnlinePermissionProfileOptions().forEach(profile => {
    const raw = String(profile[key] || '').trim();
    if (!raw) return;
    values.set(raw, raw.replace(/^custom_/, '').replace(/_/g, ' '));
  });
  return Array.from(values, ([id, label]) => ({ id, label }));
}
function renderOnlineBulkProfileFilters() {
  const roles = onlineProfileFilterOptions('roleType');
  const ages = onlineProfileFilterOptions('ageType');
  if (!roles.length && !ages.length) return '';
  return `<div class="system-profile-panel" style="margin-top:8px">
    <div class="system-profile-panel-title">Select profiles by role / age</div>
    <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-top:10px">
      <label class="ficha-form-field"><div class="ficha-form-label">Role</div><select class="ficha-form-input" id="bulk-profile-role"><option value="">Any role</option>${roles.map(item => `<option value="${escAttr(item.id)}">${escM(item.label)}</option>`).join('')}</select></label>
      <label class="ficha-form-field"><div class="ficha-form-label">Age</div><select class="ficha-form-input" id="bulk-profile-age"><option value="">Any age</option>${ages.map(item => `<option value="${escAttr(item.id)}">${escM(item.label)}</option>`).join('')}</select></label>
      <button class="btn btn-ghost btn-sm" id="bulk-profile-select-matching">Select</button>
    </div>
    <div id="bulk-profile-filter-preview" style="font-size:11px;color:var(--text-3);margin-top:8px">Select a role or age to mark matching profiles.</div>
  </div>`;
}
function applyOnlineBulkProfileFilter(root) {
  const role = root.querySelector('#bulk-profile-role')?.value || '';
  const age = root.querySelector('#bulk-profile-age')?.value || '';
  const profiles = getOnlinePermissionProfileOptions();
  const matched = profiles.filter(profile => (!role || profile.roleType === role) && (!age || profile.ageType === age));
  root.querySelectorAll('[data-friend-perm-profile]').forEach(input => {
    input.checked = matched.some(profile => profile.id === input.dataset.friendPermProfile);
  });
  const sharing = root.querySelector('#friend-perm-profile-sharing');
  if (sharing) sharing.value = 'selected';
  wireOnlineProfilePermissionPicker(root);
  const preview = root.querySelector('#bulk-profile-filter-preview');
  if (preview) preview.textContent = matched.length ? `${matched.length} matching profile${matched.length !== 1 ? 's' : ''} selected` : 'No profiles match that role/age filter';
}

function renderOnlineProfilePermissionOptions(permissions) {
  const profiles = getOnlinePermissionProfileOptions();
  const selected = new Set(permissions.selectedProfileIds || []);
  const rows = profiles.length
    ? profiles.map(profile => `<label class="perm-toggle-row" style="align-items:center">
        <div><div class="perm-toggle-label">${escM([profile.emoji, profile.name].filter(Boolean).join(' '))}</div></div>
        <input type="checkbox" data-friend-perm-profile="${escAttr(profile.id)}" data-friend-perm-role="${escAttr(profile.roleType)}" data-friend-perm-age="${escAttr(profile.ageType)}" ${selected.has(profile.id)?'checked':''}>
      </label>`).join('')
    : `<div style="font-size:12px;color:var(--text-3);line-height:1.5">There are no local profiles to select yet.</div>`;
  return `
    <div style="display:flex;flex-direction:column;gap:8px;padding:12px 0;border-top:1px solid var(--border)">
      <div class="ficha-form-field full">
        <div class="ficha-form-label">Profile sharing</div>
        <select class="ficha-form-input" id="friend-perm-profile-sharing">
          <option value="none" ${permissions.profileSharing==='none'?'selected':''}>Do not share profiles</option>
          <option value="selected" ${permissions.profileSharing==='selected'?'selected':''}>Selected profiles only</option>
          <option value="all" ${permissions.profileSharing==='all'?'selected':''}>All profiles</option>
        </select>
      </div>
      <div data-profile-permission-picker style="display:${permissions.profileSharing==='selected'?'flex':'none'};flex-direction:column;gap:6px">
        ${rows}
      </div>
    </div>`;
}

function collectOnlineFriendPermissionValues(root) {
  const profileSharing = root.querySelector('#friend-perm-profile-sharing')?.value || 'none';
  return {
    viewFronting: !!root.querySelector('#friend-perm-fronting')?.checked,
    frontNotifications: !!root.querySelector('#friend-perm-front-notifs')?.checked,
    chat: !!root.querySelector('#friend-perm-chat')?.checked,
    profileSharing,
    selectedProfileIds: profileSharing === 'selected'
      ? Array.from(root.querySelectorAll('[data-friend-perm-profile]:checked')).map(input => input.dataset.friendPermProfile).filter(Boolean)
      : [],
    journalSharing: !!root.querySelector('#friend-perm-journal')?.checked,
    pollsSharing: !!root.querySelector('#friend-perm-polls')?.checked,
  };
}

function bindOnlineProfileSharingToggle(root) {
  const select = root.querySelector('#friend-perm-profile-sharing');
  const picker = root.querySelector('[data-profile-permission-picker]');
  select?.addEventListener('change', () => {
    if (picker) picker.style.display = select.value === 'selected' ? 'flex' : 'none';
  });
}

async function applyOnlineQuickPrivacyMode() {
  saveConfig({ ...loadConfig(), onlinePrivacyMode: true, onlineFrontingEnabled: false });
  const currentSession = loadOnlineSession();
  if (currentSession) saveOnlineSession({ ...currentSession, frontingEnabled: false, presenceState: 'offline' });
  await bulkUpdateOnlineFriendPermissions([], buildOnlinePrivacyLockdownPermissions());
  await setOnlinePresenceState('offline').catch(() => {});
  showToast('Privacy mode enabled');
  renderOnlineAmigos();
}

function openOnlineBulkPermissionsModal() {
  const friends = loadOnlineFriends();
  const permissions = normalizeOnlineFriendPermissions({});
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="ficha-modal" style="max-width:500px"><div class="ficha-modal-header"><div><div style="font-size:18px;font-weight:800">Bulk permissions</div><div style="font-size:12px;color:var(--text-3);margin-top:3px">Apply to ${friends.length} friend${friends.length!==1?'s':''}</div></div><button class="modal-close" data-close>×</button></div><div class="ficha-modal-body"><div class="ficha-modal-section active">
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Can see your fronting</div><div class="perm-toggle-sublabel">Same value for all current friends</div></div><label class="toggle-switch"><input type="checkbox" id="friend-perm-fronting" checked><span class="toggle-slider"></span></label></div>
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Fronting notifications</div><div class="perm-toggle-sublabel">Future permission for shared alerts</div></div><label class="toggle-switch"><input type="checkbox" id="friend-perm-front-notifs"><span class="toggle-slider"></span></label></div>
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Online chat</div><div class="perm-toggle-sublabel">Allow or block chat for all</div></div><label class="toggle-switch"><input type="checkbox" id="friend-perm-chat" checked><span class="toggle-slider"></span></label></div>
    ${renderOnlineProfilePermissionOptions(permissions)}
    ${renderOnlineBulkProfileFilters()}
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Journal sharing</div><div class="perm-toggle-sublabel">Only entries explicitly marked for online sharing are included.</div></div><label class="toggle-switch"><input type="checkbox" id="friend-perm-journal"><span class="toggle-slider"></span></label></div>
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Polls</div><div class="perm-toggle-sublabel">Only active polls explicitly marked for online sharing are included.</div></div><label class="toggle-switch"><input type="checkbox" id="friend-perm-polls"><span class="toggle-slider"></span></label></div>
  </div></div><div class="ficha-modal-footer"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="bulk-perm-save">Apply</button></div></div>`;
  document.body.appendChild(ov);
  bindOnlineProfileSharingToggle(ov);
  ov.querySelector('#bulk-profile-select-matching')?.addEventListener('click', () => applyOnlineBulkProfileFilter(ov));
  ov.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => ov.remove()));
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('#bulk-perm-save')?.addEventListener('click', async () => {
    const saveBtn = ov.querySelector('#bulk-perm-save');
    const nextPermissions = collectOnlineFriendPermissionValues(ov);
    const profileCount = nextPermissions.profileSharing === 'selected' ? nextPermissions.selectedProfileIds.length : nextPermissions.profileSharing;
    if (!confirm(`Apply these permissions to ${friends.length} friend${friends.length!==1?'s':''}?\nProfiles: ${profileCount}\nChat: ${nextPermissions.chat ? 'yes' : 'no'}\nJournal: ${nextPermissions.journalSharing ? 'yes' : 'no'}\nPolls: ${nextPermissions.pollsSharing ? 'yes' : 'no'}`)) return;
    saveBtn.disabled = true;
    try {
      const result = await bulkUpdateOnlineFriendPermissions([], nextPermissions);
      await setOnlinePresenceState(loadOnlineSession()?.presenceState || 'online').catch(() => {});
      showToast(`Permissions applied to ${result.count} friend${result.count!==1?'s':''}`);
      ov.remove();
      renderOnlineAmigos();
    } catch (e) {
      showToast('Warning: ' + (e?.message || 'Could not apply permissions'));
      saveBtn.disabled = false;
    }
  });
}

function openOnlineFriendPermissionsModal(friend) {
  const permissions = normalizeOnlineFriendPermissions(friend.permissions);
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="ficha-modal" style="max-width:460px"><div class="ficha-modal-header"><div><div style="font-size:18px;font-weight:800">Friend permissions</div><div style="font-size:12px;color:var(--text-3);margin-top:3px">${escM(friend.displayName || friend.identifier || 'Friend')}</div></div><button class="modal-close" data-close>×</button></div><div class="ficha-modal-body"><div class="ficha-modal-section active">
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Can see your fronting</div><div class="perm-toggle-sublabel">Turn this off to hide current fronting from this friend</div></div><label class="toggle-switch"><input type="checkbox" id="friend-perm-fronting" ${permissions.viewFronting?'checked':''}><span class="toggle-slider"></span></label></div>
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Fronting notifications</div><div class="perm-toggle-sublabel">Reserved for alerts when shared fronting changes</div></div><label class="toggle-switch"><input type="checkbox" id="friend-perm-front-notifs" ${permissions.frontNotifications?'checked':''}><span class="toggle-slider"></span></label></div>
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Online chat</div><div class="perm-toggle-sublabel">When disabled, chat with this friend is blocked</div></div><label class="toggle-switch"><input type="checkbox" id="friend-perm-chat" ${permissions.chat?'checked':''}><span class="toggle-slider"></span></label></div>
    ${renderOnlineProfilePermissionOptions(permissions)}
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Journal sharing</div><div class="perm-toggle-sublabel">Only entries explicitly marked for online sharing are included.</div></div><label class="toggle-switch"><input type="checkbox" id="friend-perm-journal" ${permissions.journalSharing?'checked':''}><span class="toggle-slider"></span></label></div>
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Polls</div><div class="perm-toggle-sublabel">Only active polls explicitly marked for online sharing are included.</div></div><label class="toggle-switch"><input type="checkbox" id="friend-perm-polls" ${permissions.pollsSharing?'checked':''}><span class="toggle-slider"></span></label></div>
  </div></div><div class="ficha-modal-footer"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="friend-perm-save">Save</button></div></div>`;
  document.body.appendChild(ov);
  bindOnlineProfileSharingToggle(ov);
  ov.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => ov.remove()));
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('#friend-perm-save')?.addEventListener('click', async () => {
    const saveBtn = ov.querySelector('#friend-perm-save');
    saveBtn.disabled = true;
    try {
      await updateOnlineFriendPermissions(friend.id, collectOnlineFriendPermissionValues(ov));
      await setOnlinePresenceState(loadOnlineSession()?.presenceState || 'online').catch(() => {});
      showToast('Permissions saved');
      ov.remove();
      renderOnlineAmigos();
    } catch (e) {
      showToast('Warning: ' + (e?.message || 'Could not save permissions'));
      saveBtn.disabled = false;
    }
  });
}

function updateOnlineAmigosPresenceRows() {
  if (currentView !== 'online-amigos') return false;
  const app = document.getElementById('app');
  if (!app?.dataset?.onlineAmigosSignature) return false;
  const friends = loadOnlineFriends();
  const requests = loadOnlineFriendRequests();
  const nextSignature = JSON.stringify({
    friends: friends.map(f => [f.id, f.displayName, f.identifier, f.friendCode, normalizeOnlineFriendPermissions(f.permissions)]),
    requests: requests.map(r => [r.id, r.status, r.direction, r.displayName, r.identifier, r.fromId, r.toId]),
  });
  if (nextSignature !== app.dataset.onlineAmigosSignature) return false;
  const presenceMap = loadOnlinePresenceCache();
  const presenceLabel = state => ({ online:'Online', idle:'Away', offline:'Offline' })[state] || 'Offline';
  const friendPermissionMeta = friend => {
    const p = normalizeOnlineFriendPermissions(friend.permissions);
    const profiles = p.profileSharing === 'all' ? 'all profiles' : p.profileSharing === 'selected' ? `${p.selectedProfileIds.length} profile${p.selectedProfileIds.length!==1?'s':''}` : 'no profiles';
    return `Fronting ${p.viewFronting ? 'yes' : 'no'} · Chat ${p.chat ? 'yes' : 'no'} · ${profiles} · Journal ${p.journalSharing ? 'yes' : 'no'} · Polls ${p.pollsSharing ? 'yes' : 'no'}`;
  };
  friends.forEach(friend => {
    const p = presenceMap[friend.id] || null;
    const state = p ? getOnlinePresenceDisplayState(p, { transportFailed }) : 'unknown';
    const color = state === 'offline' || state === 'unknown' ? 'var(--text-3)' : state === 'stale' ? '#ffb86b' : state === 'online' ? '#5fffb0' : '#ffd580';
    const dot = app.querySelector(`[data-online-presence-dot="${CSS.escape(friend.id)}"]`);
    if (dot) {
      dot.style.color = color;
      dot.title = state;
    }
    const front = p?.fronting || null;
    const frontLabel = front?.alterName ? `Fronting: ${front.alterEmoji ? front.alterEmoji + ' ' : ''}${front.alterName}` : '';
    const meta = [presenceLabel(state), frontLabel, friendPermissionMeta(friend), friend.friendCode || ''].filter(Boolean).join(' · ');
    const metaEl = app.querySelector(`[data-online-presence-meta="${CSS.escape(friend.id)}"]`);
    if (metaEl) metaEl.textContent = meta;
  });
  renderSidebarNav();
  return true;
}

const SYSTEM_PROFILE_CARD_KEY = 'tid_system_profile_card';
function escAttr(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function defaultSystemProfileCard() {
  const cfg = loadConfig();
  const online = getOnlineProfile(cfg);
  return { name: cfg.systemName || online.displayName || 'Atria System', emoji: '◎', symbol: '◈', color: '#8ab4ff', tagline: '', description: '', pronouns: '', publicName: online.displayName || cfg.systemName || '', languages: 'ES / EN', values: '', needs: '', boundaries: '', contact: '', profileImage: '', bannerImage: '', shareImages: false, shareFronting: false, shareFriendCode: true, tags: [], updatedAt: new Date().toISOString() };
}
function loadSystemProfileCard() { try { return { ...defaultSystemProfileCard(), ...(JSON.parse(localStorage.getItem(SYSTEM_PROFILE_CARD_KEY)) || {}) }; } catch { return defaultSystemProfileCard(); } }
function saveSystemProfileCard(card) { localStorage.setItem(SYSTEM_PROFILE_CARD_KEY, JSON.stringify({ ...card, updatedAt: new Date().toISOString() })); }
function systemProfileTags(card) { return Array.isArray(card.tags) ? card.tags.filter(Boolean) : String(card.tags || '').split(',').map(t => t.trim()).filter(Boolean); }
function renderSystemProfileCard(card, shared = false) {
  const tags = systemProfileTags(card).map(t => `<span class="system-profile-tag">${escM(t)}</span>`).join('');
  const field = (label, value) => value ? `<div class="system-profile-field"><div class="system-profile-label">${label}</div><div class="system-profile-value">${escM(value)}</div></div>` : '';
  const showImages = !shared || card.shareImages === true;
  const banner = showImages && card.bannerImage ? `<div class="system-profile-banner" style="background-image:url('${escAttr(card.bannerImage)}')"></div>` : '';
  const avatar = showImages && card.profileImage ? `<img class="system-profile-avatar-image" src="${escAttr(card.profileImage)}" alt="">` : `<span>${escM(card.emoji || '◎')}</span>`;
  return `<div class="system-profile-card" style="--system-profile-color:${escAttr(card.color || '#8ab4ff')}">
    ${banner}<div class="system-profile-head"><div class="system-profile-avatar">${avatar}<small>${escM(card.symbol || '◈')}</small></div><div class="system-profile-main"><div class="system-profile-name">${escM(card.name || 'Atria System')}</div><div class="system-profile-sub">${escM(card.tagline || 'General system card')}</div>${card.pronouns ? `<div class="system-profile-pronouns">${escM(card.pronouns)}</div>` : ''}</div></div>
    ${card.description ? `<div class="system-profile-quote">${escM(card.description)}</div>` : ''}
    ${tags ? `<div class="system-profile-tags">${tags}</div>` : ''}
    <div class="system-profile-grid">${field('Public name', card.publicName)}${field('Languages', card.languages)}${field('Values', card.values)}${field('Needs', card.needs)}${field('Boundaries', card.boundaries)}${field('Contact', card.contact)}</div>
  </div>`;
}
function buildSystemProfileShareText(card) {
  const online = getOnlineProfile(loadConfig());
  return [card.name || 'Atria System', card.tagline ? `- ${card.tagline}` : '', card.description || '', card.pronouns ? `Pronouns: ${card.pronouns}` : '', card.values ? `Values: ${card.values}` : '', card.needs ? `Needs: ${card.needs}` : '', card.boundaries ? `Boundaries: ${card.boundaries}` : '', card.contact ? `Contact: ${card.contact}` : '', card.shareFriendCode && online.friendCode ? `ATRIA code: ${online.friendCode}` : '', card.shareFronting ? 'Shareable fronting: yes, with system consent.' : ''].filter(Boolean).join('\n');
}
function getSharedProfilesForFriend(friend) {
  const permissions = normalizeOnlineFriendPermissions(friend?.permissions);
  const profiles = getOnlinePermissionProfileOptions();
  if (permissions.profileSharing === 'all') return profiles;
  if (permissions.profileSharing !== 'selected') return [];
  const selected = new Set(permissions.selectedProfileIds || []);
  return profiles.filter(profile => selected.has(profile.id));
}
function sharedProfileSummary(friend) {
  const permissions = normalizeOnlineFriendPermissions(friend?.permissions);
  if (permissions.profileSharing === 'all') return 'All profiles';
  if (permissions.profileSharing === 'selected') {
    const count = getSharedProfilesForFriend(friend).length;
    return `${count} selected profile${count!==1?'s':''}`;
  }
  return 'No shared profiles';
}
function renderSharedProfilePreview(profiles, journalItems, pollItems) {
  const profileTiles = profiles.map(profile => `
    <div class="system-profile-mini-profile">
      <span class="system-profile-mini-avatar">${escM(profile.emoji || '●')}</span>
      <span>${escM(profile.name || 'Unnamed profile')}</span>
    </div>`).join('');
  const journalTiles = journalItems.map(item => `
    <div class="system-profile-rich-card" data-shared-journal-card="${escAttr(item.id)}">
      <div class="system-profile-rich-title">${escM(item.title)}</div>
      ${item.body ? `<div class="system-profile-rich-body">${escM(item.body)}</div>` : ''}
      ${item.meta ? `<div class="system-profile-rich-meta">${escM(item.meta)}</div>` : ''}
    </div>`).join('');
  const pollTiles = pollItems.map(item => {
    const options = item.options.map(opt => `
      <div class="system-profile-poll-option">
        <span>${escM(opt.label)}</span>
        <strong>${opt.count}</strong>
      </div>`).join('');
    return `<div class="system-profile-rich-card" data-shared-poll-card="${escAttr(item.id)}">
      <div class="system-profile-rich-title">${escM(item.title)}</div>
      ${item.desc ? `<div class="system-profile-rich-body">${escM(item.desc)}</div>` : ''}
      <div class="system-profile-poll-options">${options}</div>
      <div class="system-profile-rich-meta">${item.totalVotes} vote${item.totalVotes !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');
  if (!profileTiles && !journalTiles && !pollTiles) {
    return `<div class="system-profile-empty-share">Nothing shared with this friend yet</div>`;
  }
  return `<div class="system-profile-share-preview">
    ${profileTiles ? `<div class="system-profile-share-block"><div class="system-profile-share-label">Profiles</div><div class="system-profile-mini-grid">${profileTiles}</div></div>` : ''}
    ${journalTiles ? `<div class="system-profile-share-block"><div class="system-profile-share-label">Journal</div><div class="system-profile-rich-list">${journalTiles}</div></div>` : ''}
    ${pollTiles ? `<div class="system-profile-share-block"><div class="system-profile-share-label">Polls</div><div class="system-profile-rich-list">${pollTiles}</div></div>` : ''}
  </div>`;
}
function buildFriendProfileShareText(friend) {
  const { card, profiles, journalItems, pollItems } = getFriendSharedProfilePayload(friend);
  return [
    buildSystemProfileShareText(card),
    profiles.length ? 'Shared profiles:' : '',
    ...profiles.map(profile => `- ${[profile.emoji, profile.name].filter(Boolean).join(' ')}`),
    journalItems.length ? 'Shared journal:' : '',
    ...journalItems.map(item => `- ${item.title}${item.body ? `: ${item.body}` : ''}`),
    pollItems.length ? 'Shareable polls:' : '',
    ...pollItems.map(item => `- ${item.title}${item.options.length ? ` (${item.options.map(opt => `${opt.label}: ${opt.count}`).join(', ')})` : ''}`),
  ].filter(Boolean).join('\n');
}
function getFriendSharedProfilePayload(friend) {
  const card = loadSystemProfileCard();
  const profiles = getSharedProfilesForFriend(friend);
  const permissions = normalizeOnlineFriendPermissions(friend?.permissions);
  return {
    card,
    profiles,
    journalItems: permissions.journalSharing ? getSharedJournalItems() : [],
    pollItems: permissions.pollsSharing ? getSharedPollItems() : [],
  };
}
function renderPublicSharedProfilePreview(friend) {
  if (!friend) {
    return `<div class="system-profile-public-shell" data-public-shared-profile>
      <div class="system-profile-empty-share">Choose a friend to preview the shared profile.</div>
    </div>`;
  }
  const { card, profiles, journalItems, pollItems } = getFriendSharedProfilePayload(friend);
  const sections = renderSharedProfilePreview(profiles, journalItems, pollItems);
  return `<div class="system-profile-public-shell" data-public-shared-profile="${escAttr(friend.id)}">
    <div class="system-profile-public-top">
      <div>
        <div class="system-profile-public-kicker">Preview as</div>
        <div class="system-profile-public-friend">${escM(friend.displayName || friend.identifier || 'Friend')}</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-copy-preview-profile="${escAttr(friend.id)}">Copy text</button>
    </div>
    <div class="system-profile-public-card">
      ${renderSystemProfileCard(card, true)}
      <div class="system-profile-public-section">
        <div class="system-profile-share-label">Shared with this friend</div>
        ${sections}
      </div>
    </div>
  </div>`;
}
function renderPublicProfilePreviewPanel(friends) {
  if (!friends.length) return '';
  const first = friends[0];
  return `<div class="system-profile-panel system-profile-public-panel">
    <div class="system-profile-panel-title">Shared profile preview</div>
    <div class="system-profile-preview-controls">
      <select class="ficha-form-input" id="system-profile-preview-friend">
        ${friends.map(friend => `<option value="${escAttr(friend.id)}">${escM(friend.displayName || friend.identifier || 'Friend')}</option>`).join('')}
      </select>
    </div>
    <div id="system-profile-public-preview">${renderPublicSharedProfilePreview(first)}</div>
  </div>`;
}
function updatePublicProfilePreview(friendId) {
  const target = document.getElementById('system-profile-public-preview');
  if (!target) return;
  const friends = loadOnlineFriends();
  const friend = friends.find(item => item.id === friendId) || friends[0];
  target.innerHTML = renderPublicSharedProfilePreview(friend);
  const select = document.getElementById('system-profile-preview-friend');
  if (select && friend) select.value = friend.id;
  bindSystemProfilePreviewActions(target);
}
function bindSystemProfilePreviewActions(root) {
  root.querySelectorAll('[data-copy-preview-profile]').forEach(btn => btn.addEventListener('click', () => {
    const friend = loadOnlineFriends().find(item => item.id === btn.dataset.copyPreviewProfile);
    if (!friend) return;
    navigator.clipboard.writeText(buildFriendProfileShareText(friend))
      .then(() => showToast('Shared profile copied'))
      .catch(() => showToast('Warning: Could not copy'));
  }));
}
function isExplicitOnlineShare(item) {
  return item?.shareOnline === true || item?.onlineShared === true || item?.sharedOnline === true;
}
function getSharedJournalItems() {
  try {
    return (JSON.parse(localStorage.getItem('tid_diary') || '[]') || [])
      .filter(item => isExplicitOnlineShare(item) && item.isPrivate !== true)
      .slice(0, 5)
      .map(item => {
        const body = String(item.body || '').trim();
        const title = item.title || body.slice(0, 48) || 'Untitled entry';
        const meta = item.ts ? new Date(item.ts).toLocaleDateString('en') : '';
        return { id: item.id || title, title, body: body.length > 220 ? body.slice(0, 220) + '...' : body, meta };
      });
  } catch {
    return [];
  }
}
function getSharedPollItems() {
  try {
    return (JSON.parse(localStorage.getItem('tid_polls') || '[]') || [])
      .filter(item => isExplicitOnlineShare(item) && item.status !== 'archivada')
      .slice(0, 5)
      .map(item => {
        const options = Array.isArray(item.options) && item.options.length ? item.options : [];
        const votes = Array.isArray(item.votes) ? item.votes : [];
        return {
          id: item.id || item.title || 'poll',
          title: item.title || 'Untitled poll',
          desc: String(item.desc || '').trim(),
          totalVotes: votes.length,
          options: options.map(opt => ({
            label: opt.label || opt.id || 'Option',
            count: votes.filter(v => v.optionId === opt.id).length,
          })),
        };
      });
  } catch {
    return [];
  }
}
function renderFriendProfileSharingPanel(friends) {
  if (!friends.length) return '';
  return `<div class="system-profile-panel">
    <div class="system-profile-panel-title">Shared view by friend</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
      ${friends.map(friend => {
        const profiles = getSharedProfilesForFriend(friend);
        const permissions = normalizeOnlineFriendPermissions(friend.permissions);
        const journalItems = permissions.journalSharing ? getSharedJournalItems() : [];
        const pollItems = permissions.pollsSharing ? getSharedPollItems() : [];
        const visibilityRows = [
          profiles.length ? `Profiles: ${profiles.length}` : (permissions.profileSharing === 'none' ? 'Profiles: no permission' : 'Profiles: none selected'),
          permissions.journalSharing ? `Journal: ${journalItems.length} shareable` : 'Journal: no permission',
          permissions.pollsSharing ? `Polls: ${pollItems.length} shareable` : 'Polls: no permission',
        ];
        return `<div class="system-profile-friend-card">
          <div style="flex:1;min-width:0">
            <div class="system-profile-friend-head">
              <div>
                <div class="system-profile-friend-name">${escM(friend.displayName || friend.identifier || 'Friend')}</div>
                <div class="system-profile-friend-sub">${escM(sharedProfileSummary(friend))}</div>
              </div>
              <button class="btn btn-ghost btn-xs" data-copy-friend-profile="${escAttr(friend.id)}">Copy</button>
              <button class="btn btn-ghost btn-xs" data-view-friend-profile="${escAttr(friend.id)}">Preview</button>
            </div>
            <div class="system-profile-visibility-row">${visibilityRows.map(row => `<span class="system-profile-tag">${escM(row)}</span>`).join('')}</div>
            ${renderSharedProfilePreview(profiles, journalItems, pollItems)}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}
function exportSystemProfileAsHTML() {
  const card = loadSystemProfileCard();
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escAttr(card.name || 'System card')}</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;color:#f0eeff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:24px}.system-profile-card{width:min(520px,100%);background:#10101a;border:1px solid rgba(120,120,200,.18);border-radius:16px;padding:22px;color:#f0eeff;--system-profile-color:${escAttr(card.color || '#8ab4ff')}}.system-profile-head{display:flex;gap:16px;align-items:center}.system-profile-avatar{width:68px;height:68px;border-radius:50%;display:grid;place-items:center;background:rgba(138,180,255,.1);border:2px solid var(--system-profile-color);font-size:30px;position:relative}.system-profile-avatar small{position:absolute;right:-3px;bottom:-3px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#10101a;border:1px solid var(--system-profile-color);font-size:11px}.system-profile-name{font-size:24px;font-weight:800}.system-profile-sub{color:#aaa5cc;margin-top:4px}.system-profile-pronouns{font-size:12px;color:var(--system-profile-color);margin-top:6px}.system-profile-quote{margin:18px 0;padding:14px 16px;border-left:3px solid var(--system-profile-color);background:rgba(255,255,255,.035);line-height:1.55}.system-profile-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}.system-profile-tag{font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.1)}.system-profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.system-profile-field{padding:10px;border-radius:10px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}.system-profile-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#777296}.system-profile-value{margin-top:4px;font-size:13px;line-height:1.45;color:#d9d5f6}@media(max-width:560px){.system-profile-grid{grid-template-columns:1fr}}</style></head><body>${renderSystemProfileCard(card)}</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `system-card-${new Date().toISOString().slice(0,10)}.html`; a.click(); URL.revokeObjectURL(a.href);
  showToast('System card exported as HTML ✓');
}
function openSystemProfileModal() {
  const card = loadSystemProfileCard();
  let profileImage = card.profileImage || '';
  let bannerImage = card.bannerImage || '';
  const ov = document.createElement('div'); ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="ficha-modal"><div class="ficha-modal-header"><div><div style="font-size:18px;font-weight:800">General system card</div><div style="font-size:12px;color:var(--text-3);margin-top:3px">Editable, local and shareable when you choose</div></div><button class="modal-close" data-close>×</button></div><div class="ficha-modal-body"><div class="ficha-modal-section active">
    <div class="ficha-form-row"><div class="ficha-form-field"><div class="ficha-form-label">Name</div><input class="ficha-form-input" id="sp-name" value="${escAttr(card.name)}"></div><div class="ficha-form-field"><div class="ficha-form-label">Public name</div><input class="ficha-form-input" id="sp-public" value="${escAttr(card.publicName)}"></div></div>
    <div class="ficha-form-row"><div class="ficha-form-field"><div class="ficha-form-label">Emoji</div><input class="ficha-form-input" id="sp-emoji" value="${escAttr(card.emoji)}"></div><div class="ficha-form-field"><div class="ficha-form-label">Symbol</div><input class="ficha-form-input" id="sp-symbol" value="${escAttr(card.symbol)}"></div></div>
    <div class="ficha-form-row"><div class="ficha-form-field"><div class="ficha-form-label">Color</div><input type="color" id="sp-color" value="${escAttr(card.color || '#8ab4ff')}" style="height:36px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2)"></div><div class="ficha-form-field"><div class="ficha-form-label">Pronouns</div><input class="ficha-form-input" id="sp-pronouns" value="${escAttr(card.pronouns)}"></div></div>
    <div class="ficha-form-row"><div class="ficha-form-field"><div class="ficha-form-label">Profile photo</div><input type="file" id="sp-image" accept="image/*"><button class="btn btn-ghost btn-xs" id="sp-image-clear" type="button">Remove</button></div><div class="ficha-form-field"><div class="ficha-form-label">Banner</div><input type="file" id="sp-banner" accept="image/*"><button class="btn btn-ghost btn-xs" id="sp-banner-clear" type="button">Remove</button></div></div>
    <div class="ficha-form-field full"><div class="ficha-form-label">Short line</div><input class="ficha-form-input" id="sp-tagline" value="${escAttr(card.tagline)}"></div>
    <div class="ficha-form-field full"><div class="ficha-form-label">General description</div><textarea class="ficha-form-input" id="sp-description" rows="3">${escAttr(card.description)}</textarea></div>
    <div class="ficha-form-field full"><div class="ficha-form-label">Public tags</div><input class="ficha-form-input" id="sp-tags" value="${escAttr(systemProfileTags(card).join(', '))}"></div>
    <div class="ficha-form-row"><div class="ficha-form-field"><div class="ficha-form-label">Languages</div><input class="ficha-form-input" id="sp-languages" value="${escAttr(card.languages)}"></div><div class="ficha-form-field"><div class="ficha-form-label">Contact</div><input class="ficha-form-input" id="sp-contact" value="${escAttr(card.contact)}"></div></div>
    <div class="ficha-form-field full"><div class="ficha-form-label">Values</div><textarea class="ficha-form-input" id="sp-values" rows="2">${escAttr(card.values)}</textarea></div>
    <div class="ficha-form-field full"><div class="ficha-form-label">Needs</div><textarea class="ficha-form-input" id="sp-needs" rows="2">${escAttr(card.needs)}</textarea></div>
    <div class="ficha-form-field full"><div class="ficha-form-label">Boundaries</div><textarea class="ficha-form-input" id="sp-boundaries" rows="2">${escAttr(card.boundaries)}</textarea></div>
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Include ATRIA code when sharing</div><div class="perm-toggle-sublabel">Only affects copied text</div></div><label class="toggle-switch"><input type="checkbox" id="sp-share-code" ${card.shareFriendCode?'checked':''}><span class="toggle-slider"></span></label></div>
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Say fronting can be shared</div><div class="perm-toggle-sublabel">This only records your consent; it does not publish your current state.</div></div><label class="toggle-switch"><input type="checkbox" id="sp-share-fronting" ${card.shareFronting?'checked':''}><span class="toggle-slider"></span></label></div>
    <div class="perm-toggle-row"><div><div class="perm-toggle-label">Share photo and banner</div><div class="perm-toggle-sublabel">Off by default; shown only with profile permission.</div></div><label class="toggle-switch"><input type="checkbox" id="sp-share-images" ${card.shareImages?'checked':''}><span class="toggle-slider"></span></label></div>
  </div></div><div class="ficha-modal-footer"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="sp-save">Save card</button></div></div>`;
  document.body.appendChild(ov); ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => ov.remove())); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  const processImage = async (input, kind) => { const file = input.files?.[0]; if (!file) return; try { const value = await compressImageForStorage(file, kind === 'avatar' ? 384 : 1000, kind === 'avatar' ? 384 : 320, .82, kind === 'avatar' ? 520 : 780); if (kind === 'avatar') profileImage = value; else bannerImage = value; showToast(`${kind === 'avatar' ? 'Photo' : 'Banner'} processed ✓`); } catch { showToast('⚠ Could not process image'); } input.value = ''; };
  ov.querySelector('#sp-image')?.addEventListener('change', e => processImage(e.target, 'avatar')); ov.querySelector('#sp-banner')?.addEventListener('change', e => processImage(e.target, 'banner'));
  ov.querySelector('#sp-image-clear')?.addEventListener('click', () => { profileImage = ''; }); ov.querySelector('#sp-banner-clear')?.addEventListener('click', () => { bannerImage = ''; });
  ov.querySelector('#sp-save')?.addEventListener('click', () => { saveSystemProfileCard({ ...card, name: ov.querySelector('#sp-name').value.trim(), publicName: ov.querySelector('#sp-public').value.trim(), emoji: ov.querySelector('#sp-emoji').value.trim() || '◎', symbol: ov.querySelector('#sp-symbol').value.trim() || '◈', color: ov.querySelector('#sp-color').value || '#8ab4ff', profileImage, bannerImage, shareImages: !!ov.querySelector('#sp-share-images').checked, pronouns: ov.querySelector('#sp-pronouns').value.trim(), tagline: ov.querySelector('#sp-tagline').value.trim(), description: ov.querySelector('#sp-description').value.trim(), tags: ov.querySelector('#sp-tags').value.split(',').map(t => t.trim()).filter(Boolean), languages: ov.querySelector('#sp-languages').value.trim(), contact: ov.querySelector('#sp-contact').value.trim(), values: ov.querySelector('#sp-values').value.trim(), needs: ov.querySelector('#sp-needs').value.trim(), boundaries: ov.querySelector('#sp-boundaries').value.trim(), shareFriendCode: !!ov.querySelector('#sp-share-code').checked, shareFronting: !!ov.querySelector('#sp-share-fronting').checked }); showToast('System card saved ✓'); ov.remove(); renderOnlinePerfil(); });
}

function renderOnlinePerfilLegacyStub() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Online',action:()=>navigateTo('hub')},{label:'Profile'}]);
  const app = document.getElementById('app');
  app.innerHTML = `
  <div style="max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:20px;animation:fadeUp 360ms ease both">
    <div>
      <div class="fin-title">◎ Online profile</div>
      <div class="fin-subtitle">Coming soon</div>
    </div>
    <div style="padding:20px;background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);color:var(--text-2);font-size:14px;line-height:1.6">
      The public online profile will arrive in Phase E of the Atria roadmap.<br><br>
      It will include: system avatar, optional public description, and only the sharing choices you enable.
    </div>
  </div>`;
}

function renderOnlinePerfil() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Online',action:()=>navigateTo('hub')},{label:'Profile'}]);
  const app = document.getElementById('app');
  const online = getOnlineProfile(loadConfig());
  const account = loadOnlineAccount();
  const session = loadOnlineSession();
  const friends = loadOnlineFriends();
  const card = loadSystemProfileCard();
  app.innerHTML = `
  <div class="system-profile-view">
    <div class="system-profile-title-row">
      <div>
        <div class="fin-title">◎ Online profile</div>
        <div class="fin-subtitle">General system card · ${online.enabled ? 'online active' : 'online paused'}</div>
      </div>
      <div class="system-profile-actions">
        <button class="btn btn-ghost btn-sm" id="btn-system-profile-share">Copy</button>
        <button class="btn btn-ghost btn-sm" id="btn-system-profile-export">HTML</button>
        <button class="btn btn-primary btn-sm" id="btn-system-profile-edit">Edit</button>
      </div>
    </div>
    ${renderSystemProfileCard(card)}
    ${renderPublicProfilePreviewPanel(friends)}
    <div class="system-profile-sidegrid">
      <div class="system-profile-panel">
        <div class="system-profile-panel-title">Online identity</div>
        <div class="system-profile-meta"><span>System</span><strong>${escM(account?.systemId || online.systemId || '—')}</strong></div>
        <div class="system-profile-meta"><span>ATRIA code</span><strong>${escM(account?.friendCode || online.friendCode || '—')}</strong></div>
        <div class="system-profile-meta"><span>Friends</span><strong>${friends.length}</strong></div>
        <div class="system-profile-meta"><span>Device</span><strong>${escM(session?.deviceName || '—')}</strong></div>
      </div>
      <div class="system-profile-panel">
        <div class="system-profile-panel-title">Sharing</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.5">The card is stored locally. Copy creates a text version with only the fields you filled and the options you enabled.</div>
      </div>
      ${renderFriendProfileSharingPanel(friends)}
    </div>
  </div>`;
  app.querySelector('#btn-system-profile-edit')?.addEventListener('click', openSystemProfileModal);
  app.querySelector('#btn-system-profile-export')?.addEventListener('click', exportSystemProfileAsHTML);
  app.querySelector('#btn-system-profile-share')?.addEventListener('click', () => {
    navigator.clipboard.writeText(buildSystemProfileShareText(loadSystemProfileCard()))
      .then(() => showToast('System card copied ✓'))
      .catch(() => showToast('⚠ Could not copy the card'));
  });
  app.querySelectorAll('[data-copy-friend-profile]').forEach(btn => btn.addEventListener('click', () => {
    const friend = loadOnlineFriends().find(item => item.id === btn.dataset.copyFriendProfile);
    if (!friend) return;
    navigator.clipboard.writeText(buildFriendProfileShareText(friend))
      .then(() => showToast('Shared view copied'))
      .catch(() => showToast('Warning: Could not copy'));
  }));
  app.querySelector('#system-profile-preview-friend')?.addEventListener('change', event => updatePublicProfilePreview(event.target.value));
  app.querySelectorAll('[data-view-friend-profile]').forEach(btn => btn.addEventListener('click', () => updatePublicProfilePreview(btn.dataset.viewFriendProfile)));
  bindSystemProfilePreviewActions(app);
}

function renderConfigSync(app, back) {
  const cfg = loadConfig();
  const online = getOnlineProfile(cfg);
  const session = loadOnlineSession();
  const state = loadOnlineSyncState() || {};
  const devices = loadOnlineDevicesCache() || [];
  const backendReady = hasOnlineBackendConfigured(cfg);
  const lastActivity = state.realtimeLastEventAt || state.lastPollAt || state.lastBootstrapAt || '';
  const status = !online.enabled ? ['ONLINE DISABLED', 'var(--text-3)'] : !backendReady ? ['SERVICE PENDING', '#ffcf6f'] : !session ? ['NO SESSION', '#ffcf6f'] : state.lastError ? ['SYNC ERROR', '#ff8a8a'] : ['SYNC ACTIVE', '#5fffb0'];
  const deviceRows = devices.length ? devices.map(device => `<div class="online-device-row"><div class="online-device-main"><div style="font-size:13px;color:var(--text-1)">${escM(device.platform || device.name || 'Device')}</div><div class="online-device-meta">${device.lastSeenAt ? `Last activity · ${escM(new Date(device.lastSeenAt).toLocaleString('en'))}` : 'Linked device'}</div></div></div>`).join('') : '<div style="font-size:12px;color:var(--text-3);padding:8px 0">No linked devices yet.</div>';
  app.innerHTML = `<div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both;display:flex;flex-direction:column;gap:16px"><div class="config-section"><div class="config-section-header"><div class="config-section-icon">↔</div><div><div class="config-section-title">Multi-device sync</div><div class="config-section-desc">Automatic, encrypted synchronization for online data.</div></div></div><div class="config-rows"><div class="config-row"><div class="config-row-left"><div class="config-row-label">Status</div><div class="config-row-sub">${online.enabled ? 'Your online account controls synchronization automatically.' : 'Enable online features to use Sync.'}</div></div><div class="config-row-right" style="font-family:'DM Mono',monospace;font-size:11px;color:${status[1]}">${status[0]}</div></div><div class="config-row"><div class="config-row-left"><div class="config-row-label">Last activity</div><div class="config-row-sub">Last bootstrap, received change, or realtime event.</div></div><div class="config-row-right" style="font-size:12px;color:var(--text-2)">${lastActivity ? escM(new Date(lastActivity).toLocaleString('en')) : '—'}</div></div><div class="config-row"><div class="config-row-left"><div class="config-row-label">Linked devices</div><div class="config-row-sub">Devices authorized for this account.</div></div><div class="config-row-right" style="font-size:12px;color:var(--text-2)">${devices.length}</div></div>${state.lastError ? `<div class="config-row"><div class="config-row-left"><div class="config-row-label" style="color:#ff8a8a">Last error</div></div><div class="config-row-right" style="font-size:11px;color:#ff8a8a;max-width:260px;text-align:right;overflow-wrap:anywhere">${escM(state.lastError)}</div></div>` : ''}</div><div style="display:flex;gap:8px;justify-content:flex-end;padding:14px 16px;border-top:1px solid var(--border)"><button class="btn btn-ghost btn-sm" id="btn-sync-refresh-devices">Refresh devices</button><button class="btn btn-primary btn-sm" id="btn-sync-now" ${online.enabled && backendReady && session ? '' : 'disabled'}>Sync now</button></div></div><div class="config-section"><div class="config-section-header"><div class="config-section-icon">▦</div><div><div class="config-section-title">Devices</div><div class="config-section-desc">Your data is not exposed in plaintext.</div></div></div><div class="config-rows">${deviceRows}</div></div><button class="btn btn-ghost" id="btn-sync-back">Back</button></div>`;
  app.querySelector('#btn-sync-back')?.addEventListener('click', back);
  app.querySelector('#btn-sync-refresh-devices')?.addEventListener('click', async event => { const btn = event.currentTarget; btn.disabled = true; try { await refreshOnlineDevices(); showToast('Devices updated ✓'); renderConfigSync(app, back); } catch (error) { showToast('⚠ ' + (error?.message || 'Could not update devices')); btn.disabled = false; } });
  app.querySelector('#btn-sync-now')?.addEventListener('click', async event => { const btn = event.currentTarget; btn.disabled = true; try { await runOnlineSyncBootstrap(); showToast('Sync completed ✓'); } catch (error) { showToast('⚠ ' + (error?.message || 'Could not sync')); } renderConfigSync(app, back); });
}

function renderOnlineSync() {
  const app = document.getElementById('app');
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Online',action:()=>navigateTo('hub')},{label:'Sync'}]);
  renderConfigSync(app, () => navigateTo('hub'));
}
