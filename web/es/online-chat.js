// Vistas del chat online y del editor de mensajes.
// Se carga antes de app.js porque las rutas actuales usan estas funciones globales.
const _onlineNotifFired = new Set();
const ONLINE_CHAT_DRAFTS_KEY = 'tid_online_chat_drafts';
function loadOnlineChatDrafts() {
  try {
    const saved = JSON.parse(localStorage.getItem(ONLINE_CHAT_DRAFTS_KEY) || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch { return {}; }
}
function saveOnlineChatDraft(friendId, text) {
  if (!friendId) return;
  const drafts = loadOnlineChatDrafts();
  if (text) drafts[friendId] = text;
  else delete drafts[friendId];
  localStorage.setItem(ONLINE_CHAT_DRAFTS_KEY, JSON.stringify(drafts));
}
function getOnlineChatDraft(friendId) {
  return friendId ? (loadOnlineChatDrafts()[friendId] || '') : '';
}
function getOnlineChatAllowedFriends() {
  return loadOnlineFriends().filter(friend => friend.permissions?.chat !== false);
}
function getOnlineChatUnreadCountForAllowedFriends(friends = getOnlineChatAllowedFriends()) {
  return friends.reduce((total, friend) => {
    const unread = Number(getOnlineConversationMeta(friend.id)?.unreadCount || 0);
    return total + (Number.isFinite(unread) ? unread : 0);
  }, 0);
}
let _onlineChatDeferredRenderTimer = null;
let _onlineChatPendingFocusedRender = false;
function isOnlineChatComposerFocused() {
  const input = document.getElementById('online-chat-input');
  return !!input && document.activeElement === input;
}
function scheduleOnlineChatFullRenderAfterTyping() {
  _onlineChatPendingFocusedRender = true;
  if (_onlineChatDeferredRenderTimer) clearTimeout(_onlineChatDeferredRenderTimer);
  _onlineChatDeferredRenderTimer = setTimeout(() => {
    _onlineChatDeferredRenderTimer = null;
    if (currentView !== 'innerchat' || comTab !== 'online' || !document.getElementById('chat-root')) return;
    if (isOnlineChatComposerFocused()) {
      scheduleOnlineChatFullRenderAfterTyping();
      return;
    }
    _onlineChatPendingFocusedRender = false;
    renderOnlineChatLayout();
  }, 900);
}
function flushOnlineChatDeferredRender() {
  if (!_onlineChatPendingFocusedRender) return;
  if (_onlineChatDeferredRenderTimer) {
    clearTimeout(_onlineChatDeferredRenderTimer);
    _onlineChatDeferredRenderTimer = null;
  }
  setTimeout(() => {
    if (isOnlineChatComposerFocused()) {
      scheduleOnlineChatFullRenderAfterTyping();
      return;
    }
    if (currentView !== 'innerchat' || comTab !== 'online' || !document.getElementById('chat-root')) return;
    _onlineChatPendingFocusedRender = false;
    renderOnlineChatLayout();
  }, 0);
}
function renderOnlineLiveUpdate() {
  if (currentView === 'innerchat' && comTab === 'online' && document.getElementById('chat-root')) {
    if (isOnlineChatComposerFocused()) {
      scheduleOnlineChatFullRenderAfterTyping();
      return;
    }
    renderOnlineChatLayout();
    return;
  }
  if (currentView === 'online-amigos') {
    renderSidebarNav();
    return;
  }
  renderSidebarNav();
}
function notifyOnlineEvent(event = {}) {
  const key = `${event.kind || 'online'}:${event.id || event.friendId || event.body || Date.now()}`;
  if (_onlineNotifFired.has(key)) return;
  _onlineNotifFired.add(key);
  const title = event.title || 'Actividad online';
  const body = event.body || '';
  showToast(body ? `${title}: ${body}` : title);
  fireNativeNotif({
    title,
    body,
    tag: key,
    nav: event.nav || 'innerchat',
    tab: event.tab || null,
  });
}

function getOnlineSenderAlterSnapshot() {
  const a = getChatSenderAlter();
  if (!a) return null;
  return {
    id: a.id,
    name: a.name || '',
    emoji: a.emoji || '',
    color: a.color || '#5fffb0',
    bg: a.bg || 'rgba(95,255,176,.12)',
    avatarImg: a.avatarImg && a.avatarImg.length < 90000 ? a.avatarImg : '',
  };
}

function renderOnlineAlterAvatar(alter, size = 32) {
  const a = alter || getOnlineSenderAlterSnapshot();
  if (!a) return '<span style="font-size:14px;line-height:1">◎</span>';
  if (a.avatarImg) {
    return `<img src="${a.avatarImg}" style="width:${size}px;height:${size}px;max-width:${size}px;max-height:${size}px;object-fit:cover;border-radius:50%;display:block;flex-shrink:0">`;
  }
  return `<span style="font-size:${Math.round(size * 0.44)}px;line-height:1">${esc(a.emoji || '◎')}</span>`;
}

function loadChannels()   { try { return JSON.parse(localStorage.getItem('tid_channels'))||DEFAULT_CHANNELS; } catch{return DEFAULT_CHANNELS;} }
function saveChannels(c)  { localStorage.setItem('tid_channels', JSON.stringify(c)); }
function loadMessages()   { try { return JSON.parse(localStorage.getItem('tid_messages'))||[]; } catch{return [];} }
function saveMessages(m)  { localStorage.setItem('tid_messages', JSON.stringify(m)); }

function chatChannelKey(ch) {
  // DMs sorted so A↔B and B↔A use same key
  if (ch.type === 'dm') {
    const pair = [ch.alterId, activeAlter.id].sort().join('_');
    return 'dm_' + pair;
  }
  return 'ch_' + ch.id;
}

function renderTablon() {
  // Tablón ahora vive dentro de Inner-Chat
  chatActiveChannel = {id:'tablon', type:'tablon', name:'Tablón del sistema'};
  renderInnerChat();
}

// ── Alias para rutas que apuntan a sub-tabs ──
function renderTablon()   { comTab='tablon';      renderInnerChat(); }
function renderNotas()    { comTab='tablon';       renderInnerChat(); } // Notas absorbida por Tablón
function renderWishlistFromCom() { comTab='deseos'; renderInnerChat(); }
function renderSolicFromCom()    { comTab='solicitudes'; renderInnerChat(); }

function renderInnerChat() {
  const tabLabel = {chat:'Chat interno', online:'Chat online', tablon:'Tablón', solicitudes:'Solicitudes', deseos:'Deseos'};
  const _comLabel = {chat:'Chat interno', online:'Chat online', tablon:'Tablón', solicitudes:'Solicitudes', deseos:'Deseos'};
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Comunicación · '+(_comLabel[comTab]||'Chat')}]);

  const app = document.getElementById('app');

  if (comTab === 'chat') {
    if (!chatActiveChannel) {
      const channels = loadChannels();
      chatActiveChannel = channels[0] ? {...channels[0], type:'channel'} : null;
    }
    app.style.padding = '0';
    app.style.overflow = 'hidden';
    app.style.display = 'flex';
    app.style.flexDirection = 'column';
    app.style.height = '100%';
    app.classList.add('chat-app-mode');
    app.innerHTML = `
      ${renderComTabsHTML()}
      <div class="chat-layout" id="chat-root"></div>`;
    renderChatLayout();
  } else if (comTab === 'online') {
    app.style.padding = '0';
    app.style.overflow = 'hidden';
    app.style.display = 'flex';
    app.style.flexDirection = 'column';
    app.style.height = '100%';
    app.classList.add('chat-app-mode');
    app.innerHTML = `
      ${renderComTabsHTML()}
      <div class="chat-layout online-chat-layout" id="chat-root"></div>`;
    renderOnlineChatLayout();
  } else {
    app.style.padding = '';
    app.style.overflow = '';
    app.style.display = '';
    app.style.flexDirection = '';
    app.style.height = '';
    app.classList.remove('chat-app-mode');
    app.innerHTML = `
      <div style="max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:20px;animation:fadeUp 360ms ease both">
        ${renderComTabsHTML()}
        <div id="com-content"></div>
      </div>`;
    renderComTabContent(app.querySelector('#com-content'));
  }

  // Tab clicks (fuera del chat-layout para que los encuentre en ambos casos)
  app.querySelectorAll('.com-tab[data-ct]').forEach(t => t.addEventListener('click', () => {
    comTab = t.dataset.ct; renderInnerChat();
  }));
}

function renderComTabsHTML() {
  const onlineEnabled = getOnlineProfile().enabled;
  const pendSolic = loadSolicitudes().filter(s =>
    (s.toId===activeAlter?.id||s.toId==='sistema') && s.status==='pendiente'
  ).length;
  const onlineUnread = getOnlineChatUnreadCountForAllowedFriends();
  const tabs = [
    {id:'chat',        label:'◭ Interno'},
    ...(onlineEnabled ? [{id:'online', label:'☁ Online', badge: onlineUnread || null}] : []),
    {id:'tablon',      label:'◈ Tablón'},
    {id:'solicitudes', label:'◱ Solicitudes', badge: pendSolic||null},
    {id:'deseos',      label:'◈ Deseos'},
  ];
  return `<div class="com-tabs-bar">
    ${tabs.map(t=>`<div class="module-tab com-tab${comTab===t.id?' active':''}" data-ct="${t.id}">
      ${t.label}${t.badge?`<span class="mtab-badge">${t.badge}</span>`:''}
    </div>`).join('')}
  </div>`;
}

function renderComTabContent(cont) {
  if (!cont) return;
  if (comTab === 'tablon')      renderTablonInChatPanel(cont);
  else if (comTab === 'online') renderOnlineChatPanel(cont);
  else if (comTab === 'solicitudes') renderSolicitudesInContainer(cont);
  else if (comTab === 'deseos')      renderWishInContainer(cont);
}

function renderChatLayout() {
  const root = document.getElementById('chat-root');
  if (!root) return;
  const channels = loadChannels();
  const alters   = getAlters().filter(a => a.id !== activeAlter.id);

  root.innerHTML = `
    <!-- SIDEBAR -->
    <div class="chat-sidebar">
      <div class="chat-sidebar-header">
        <div class="chat-sidebar-title">Canales</div>
        <button class="icon-btn" id="btn-new-channel" title="Nuevo canal" style="font-size:16px">+</button>
      </div>
      <div class="chat-channel-list">
        <div class="chat-section-label" style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3);padding:8px 10px 4px">Sistema</div>
        <div class="chat-channel-item${chatActiveChannel?.type==='tablon'?' active':''}" id="chat-tablon-item">
          <div class="chat-channel-icon" style="color:#a08aff">◈</div>
          <div class="chat-channel-name">Tablón del sistema</div>
        </div>

        <div class="chat-section-label" style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3);padding:8px 10px 4px">Canales</div>
        ${channels.map(ch => {
          const isActive = chatActiveChannel?.type==='channel' && chatActiveChannel?.id===ch.id;
          return `<div class="chat-channel-item${isActive?' active':''}" data-ch="${ch.id}" data-type="channel">
            <div class="chat-channel-icon" style="color:${ch.color}">${ch.icon||'#'}</div>
            <div class="chat-channel-name">${ch.name}</div>
            ${!DEFAULT_CHANNELS.find(d=>d.id===ch.id)?`<button class="icon-btn chat-del-ch" data-ch="${ch.id}" style="font-size:11px;opacity:.4" title="Eliminar canal">✕</button>`:''}
          </div>`;
        }).join('')}

        <div class="chat-dm-section">
          <div class="chat-dm-label">Mensajes directos</div>
          ${alters.map(a => {
            const isActive = chatActiveChannel?.type==='dm' && chatActiveChannel?.alterId===a.id;
            return `<div class="chat-dm-alter${isActive?' active':''}" data-alter="${a.id}" data-type="dm">
              <div class="chat-dm-avatar" style="background:${a.bg};border-color:${a.color};overflow:hidden">${alterAv(a,24)}</div>
              <div class="chat-dm-name">${esc(a.name)}</div>
            </div>`;
          }).join('')}
          ${alters.length===0?`<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);padding:4px 10px">Solo hay un alter</div>`:''}
        </div>
      </div>
    </div>

    <!-- MAIN -->
    <div class="chat-main">
      <div id="chat-messages-panel" style="display:flex;flex-direction:column;flex:1;overflow:hidden"></div>
    </div>`;

  // Tablón click
  root.querySelector('#chat-tablon-item')?.addEventListener('click', () => {
    chatActiveChannel = {id:'tablon', type:'tablon', name:'Tablón del sistema'};
    renderChatMessages(); renderChatSidebarActive();
  });
  // Channel clicks
  root.querySelectorAll('.chat-channel-item[data-ch]').forEach(el => el.addEventListener('click', e => {
    if (e.target.closest('.chat-del-ch')) return;
    const ch = loadChannels().find(c=>c.id===el.dataset.ch);
    if (ch) { chatActiveChannel={...ch,type:'channel'}; renderChatMessages(); renderChatSidebarActive(); }
  }));
  // DM clicks
  root.querySelectorAll('.chat-dm-alter[data-alter]').forEach(el => el.addEventListener('click', () => {
    const a = getAlters().find(x=>x.id===el.dataset.alter);
    if (a) { chatActiveChannel={id:'dm_'+a.id,type:'dm',alterId:a.id,name:a.name,color:a.color,emoji:a.emoji,bg:a.bg}; renderChatMessages(); renderChatSidebarActive(); }
  }));
  // Delete custom channel
  root.querySelectorAll('.chat-del-ch').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    if (!confirm('¿Eliminar este canal?')) return;
    saveChannels(loadChannels().filter(c=>c.id!==btn.dataset.ch));
    if (chatActiveChannel?.id===btn.dataset.ch) chatActiveChannel = loadChannels()[0];
    renderChatLayout();
    renderChatMessages();
  }));
  // New channel
  root.querySelector('#btn-new-channel')?.addEventListener('click', openNewChannelModal);

  renderChatMessages();
}

function renderOnlineChatMessagesOnly() {
  const list = document.getElementById('online-chat-msg-list');
  if (!list || !onlineChatActiveFriendId) return false;
  const activeFriend = getOnlineChatAllowedFriends().find(f => f.id === onlineChatActiveFriendId);
  if (!activeFriend) return false;
  const msgs = getOnlineConversationMessages(activeFriend.id);
  const account = loadOnlineAccount();
  const onlineSenderSnapshot = getOnlineSenderAlterSnapshot();
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  list.innerHTML = msgs.length ? msgs.map(msg => {
    const isSelf = msg.dir === 'out';
    const senderAlter = isSelf ? (msg.senderAlter || onlineSenderSnapshot) : msg.senderAlter;
    const senderName = senderAlter?.name || (isSelf ? (account?.systemId || 'yo') : (activeFriend.displayName || activeFriend.identifier));
    const senderColor = senderAlter?.color || (isSelf ? '#5fffb0' : 'var(--accent)');
    const timeStr = new Date(msg.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
    return `<div class="chat-msg${isSelf?' is-self':''}">
      <div class="chat-msg-avatar" style="background:${senderAlter?.bg || (isSelf?'rgba(95,255,176,.12)':'var(--bg-2)')};border-color:${senderColor};overflow:hidden">${isSelf || senderAlter ? renderOnlineAlterAvatar(senderAlter, 32) : '👤'}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-meta">
          <span class="chat-msg-sender" style="color:${senderColor}">${esc(senderName)}</span>
          <span class="chat-msg-time">${timeStr}</span>
        </div>
        <div class="chat-msg-bubble">${escC(msg.text)}${msg.pending ? ' <span style="color:var(--text-3);font-size:10px">enviando...</span>' : ''}</div>
      </div>
    </div>`;
  }).join('') : `<div class="chat-empty"><div class="chat-empty-icon">☁</div><div>Sin mensajes todavía</div><div style="font-size:11px;color:var(--text-3)">Cuando llegue un mensaje aparecerá aquí al momento</div></div>`;
  if (nearBottom) list.scrollTop = list.scrollHeight;
  return true;
}

function renderOnlineChatPanel(panel) {
  if (!panel) return;
  const friends = getOnlineChatAllowedFriends();
  if (!onlineChatActiveFriendId && friends[0]) onlineChatActiveFriendId = friends[0].id;
  let activeFriend = friends.find(f => f.id === onlineChatActiveFriendId) || null;
  if (onlineChatActiveFriendId && !activeFriend) {
    onlineChatActiveFriendId = friends[0]?.id || null;
    activeFriend = friends.find(f => f.id === onlineChatActiveFriendId) || null;
  }
  const msgs = activeFriend ? getOnlineConversationMessages(activeFriend.id) : [];
  const account = loadOnlineAccount();
  const backendConfigured = hasOnlineBackendConfigured();
  const presence = activeFriend ? getOnlinePresenceForFriend(activeFriend.id) : null;
  const activeMeta = activeFriend ? getOnlineConversationMeta(activeFriend.id) : {};
  const onlineSender = getChatSenderAlter();
  const onlineSenderSnapshot = getOnlineSenderAlterSnapshot();
  panel.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-icon" style="color:#5fffb0">☁</div>
      <div class="chat-header-info">
        <div class="chat-header-name">${activeFriend ? esc(activeFriend.displayName || activeFriend.identifier) : 'Chat online'}</div>
        <div class="chat-header-desc">${activeFriend ? `DM online${presence?.state ? ` · presencia ${esc(presence.state)}` : ''}${activeMeta?.unreadCount ? ` · ${activeMeta.unreadCount} sin leer` : ''}` : 'Selecciona una amistad para abrir su conversación online'}</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:${backendConfigured?'#5fffb0':'var(--text-3)'}">${backendConfigured?'ONLINE':'EN_DISPOSITIVO'}</div>
        <button class="icon-btn" id="btn-online-chat-refresh" title="Refrescar chat online" style="font-size:12px">↻</button>
      </div>
    </div>
    <div class="chat-messages" id="online-chat-msg-list">
      ${activeFriend ? (
        msgs.length ? msgs.map(msg => {
          const isSelf = msg.dir === 'out';
          const senderAlter = isSelf ? (msg.senderAlter || onlineSenderSnapshot) : msg.senderAlter;
          const senderName = senderAlter?.name || (isSelf ? (account?.systemId || 'yo') : (activeFriend.displayName || activeFriend.identifier));
          const senderColor = senderAlter?.color || (isSelf ? '#5fffb0' : 'var(--accent)');
          const timeStr = new Date(msg.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
          return `<div class="chat-msg${isSelf?' is-self':''}">
            <div class="chat-msg-avatar" style="background:${senderAlter?.bg || (isSelf?'rgba(95,255,176,.12)':'var(--bg-2)')};border-color:${senderColor};overflow:hidden">${isSelf || senderAlter ? renderOnlineAlterAvatar(senderAlter, 32) : '👤'}</div>
            <div class="chat-msg-body">
              <div class="chat-msg-meta">
                <span class="chat-msg-sender" style="color:${senderColor}">${esc(senderName)}</span>
                <span class="chat-msg-time">${timeStr}</span>
              </div>
              <div class="chat-msg-bubble">${escC(msg.text)}${msg.pending ? ' <span style="color:var(--text-3);font-size:10px">enviando...</span>' : ''}</div>
            </div>
          </div>`;
        }).join('') : `<div class="chat-empty"><div class="chat-empty-icon">☁</div><div>Sin mensajes todavía</div><div style="font-size:11px;color:var(--text-3)">Cuando llegue un mensaje aparecerá aquí al momento</div></div>`
      ) : `<div class="chat-empty"><div class="chat-empty-icon">☁</div><div>No hay amistad seleccionada</div><div style="font-size:11px;color:var(--text-3)">Añade amigos desde Hub → Online → Amigos</div></div>`}
    </div>
    <div class="chat-input-area">
      <div class="chat-input-wrap" style="display:flex;align-items:flex-end;gap:6px">
        <button id="online-chat-sender-btn" title="Cambiar alter que escribe" style="flex-shrink:0;width:32px;height:32px;border-radius:50%;border:2px solid ${onlineSender?.color || '#5fffb0'};background:${onlineSender?.bg || 'rgba(95,255,176,.12)'};font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:0">${renderOnlineAlterAvatar(onlineSenderSnapshot, 32)}</button>
        <textarea class="chat-input" id="online-chat-input" placeholder="${activeFriend ? `Escribe a ${esc(activeFriend.displayName || activeFriend.identifier)}...` : 'Selecciona una amistad primero'}" rows="1" style="flex:1" ${activeFriend ? '' : 'disabled'}></textarea>
        <button class="chat-send-btn" id="online-chat-send" ${activeFriend ? '' : 'disabled'}>↑</button>
      </div>
    </div>`;
  const list = panel.querySelector('#online-chat-msg-list');
  if (list) list.scrollTop = list.scrollHeight;
  const input = panel.querySelector('#online-chat-input');
  if (input && activeFriend) {
    const savedDraft = getOnlineChatDraft(activeFriend.id);
    if (savedDraft && !input.value) {
      input.value = savedDraft;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }
  }
  input?.addEventListener('input', () => {
    if (activeFriend) saveOnlineChatDraft(activeFriend.id, input.value);
    input.style.height='auto';
    input.style.height=Math.min(input.scrollHeight,120)+'px';
  });
  input?.addEventListener('blur', flushOnlineChatDeferredRender);
  const send = () => {
    const text = input?.value.trim();
    if (!text || !activeFriend) return;
    const btn = panel.querySelector('#online-chat-send');
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempTs = Date.now();
    const senderAlter = getOnlineSenderAlterSnapshot();
    if (input) {
      input.value = '';
      saveOnlineChatDraft(activeFriend.id, '');
      input.style.height = 'auto';
      input.focus();
    }
    appendOnlineConversationMessage(activeFriend.id, {
      id: tempId,
      dir: 'out',
      text,
      ts: tempTs,
      readByPeer: false,
      pending: true,
      senderAlter,
    });
    setOnlineConversationMeta(activeFriend.id, { lastMessageTs: tempTs });
    renderOnlineChatPanel(panel);
    panel.querySelector('#online-chat-input')?.focus();
    if (btn) btn.disabled = true;
    sendOnlineConversationMessage(activeFriend.id, text, { senderAlter })
      .then(({ mode }) => {
        removeOnlineConversationMessage(activeFriend.id, tempId);
        renderOnlineChatPanel(panel);
        if (mode === 'remote') showToast('Mensaje online enviado ✓');
      })
      .catch(e => {
        removeOnlineConversationMessage(activeFriend.id, tempId);
        renderOnlineChatPanel(panel);
        const nextInput = panel.querySelector('#online-chat-input');
        if (nextInput && !nextInput.value) {
          nextInput.value = text;
          saveOnlineChatDraft(activeFriend.id, text);
          nextInput.focus();
        }
        showToast('⚠ ' + e.message);
      })
      .finally(() => {
        if (btn) btn.disabled = false;
      });
  };
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  panel.querySelector('#online-chat-send')?.addEventListener('click', send);
  panel.querySelector('#online-chat-sender-btn')?.addEventListener('click', () => openChatSenderPopover(panel, true));
  panel.querySelector('#btn-online-chat-refresh')?.addEventListener('click', async () => {
    if (!activeFriend) return;
    try {
      await refreshOnlineConversation(activeFriend.id);
      await refreshOnlinePresenceFromBackend().catch(() => {});
      renderOnlineChatPanel(panel);
      showToast(backendConfigured ? 'Chat online actualizado ✓' : 'Funciones online no disponibles: mostrando datos guardados en este dispositivo');
    } catch (e) {
      showToast('⚠ ' + e.message);
    }
  });
  if (activeFriend && activeMeta?.unreadCount) {
    markOnlineConversationRead(activeFriend.id).catch(() => {});
  }
}

function openChatSenderPopover(panel, isOnline = false) {
  const senderBtn = panel.querySelector(isOnline ? '#online-chat-sender-btn' : '#chat-sender-btn');
  if (!senderBtn) return;
  document.getElementById('chat-sender-popover')?.remove();
  const allAlters = getAlters();
  const pop = document.createElement('div');
  pop.id = 'chat-sender-popover';
  pop.style.cssText = 'position:absolute;bottom:60px;left:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px;display:flex;flex-wrap:wrap;gap:6px;z-index:50;box-shadow:0 4px 16px rgba(0,0,0,.3)';
  allAlters.forEach(a => {
    const btn = document.createElement('button');
    const isCur = a.id === (getChatSenderAlter()?.id || activeAlter?.id);
    btn.style.cssText = `display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;border:2px solid ${a.color};background:${isCur?a.bg:'transparent'};cursor:pointer;font-size:13px;color:var(--text)`;
    btn.innerHTML = `${alterAv(a, 20)} ${esc(a.name)}`;
    btn.addEventListener('click', () => {
      chatSenderId = a.id;
      pop.remove();
      if (isOnline) renderOnlineChatPanel(panel);
      else renderChatMessages();
    });
    pop.appendChild(btn);
  });
  const area = panel.querySelector('.chat-input-area');
  if (!area) return;
  area.style.position = 'relative';
  area.appendChild(pop);
  const closePop = e => {
    if (!pop.contains(e.target) && e.target !== senderBtn) {
      pop.remove();
      document.removeEventListener('click', closePop, true);
    }
  };
  setTimeout(() => document.addEventListener('click', closePop, true), 10);
}

function renderOnlineChatLayout() {
  const root = document.getElementById('chat-root');
  if (!root) return;
  if (isOnlineChatComposerFocused()) {
    scheduleOnlineChatFullRenderAfterTyping();
    return;
  }
  const friends = getOnlineChatAllowedFriends();
  if (!onlineChatActiveFriendId && friends[0]) onlineChatActiveFriendId = friends[0].id;
  if (onlineChatActiveFriendId && !friends.some(f => f.id === onlineChatActiveFriendId)) onlineChatActiveFriendId = friends[0]?.id || null;
  if (onlineChatActiveFriendId) {
    const meta = getOnlineConversationMeta(onlineChatActiveFriendId);
    if (meta?.unreadCount) {
      const messages = getOnlineConversationMessages(onlineChatActiveFriendId);
      const lastIncomingTs = messages.filter(m => m.dir === 'in').reduce((max, m) => Math.max(max, m.ts || 0), 0);
      setOnlineConversationMeta(onlineChatActiveFriendId, {
        unreadCount: 0,
        lastReadTs: Math.max(meta.lastReadTs || 0, lastIncomingTs || Date.now()),
      });
    }
  }
  root.innerHTML = `
    <div class="chat-sidebar">
      <div class="chat-sidebar-header">
        <div class="chat-sidebar-title">Chat online</div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:#5fffb0">${friends.length} amistad${friends.length!==1?'es':''}</div>
      </div>
      <div class="chat-channel-list">
        <div class="chat-section-label" style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3);padding:8px 10px 4px">Online</div>
        ${friends.length ? friends.map(f => {
          const isActive = f.id === onlineChatActiveFriendId;
          const preview = getOnlineConversationMessages(f.id).slice(-1)[0];
          const meta = getOnlineConversationMeta(f.id);
          return `<div class="chat-channel-item${isActive?' active':''}" data-online-friend="${f.id}">
            <div class="chat-channel-icon" style="color:#5fffb0">☁</div>
            <div style="display:flex;flex-direction:column;min-width:0;flex:1">
              <div class="chat-channel-name">${esc(f.displayName || f.identifier)}</div>
              <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${preview ? esc(preview.text).slice(0,32) : 'Sin mensajes'}</div>
            </div>
            ${meta?.unreadCount ? `<div class="mtab-badge">${meta.unreadCount}</div>` : ''}
          </div>`;
        }).join('') : `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);padding:10px">Sin amistades online todavía</div>`}
      </div>
    </div>
    <div class="chat-main">
      <div id="chat-messages-panel" style="display:flex;flex-direction:column;flex:1;overflow:hidden"></div>
    </div>`;
  root.querySelectorAll('[data-online-friend]').forEach(el => el.addEventListener('click', () => {
    onlineChatActiveFriendId = el.dataset.onlineFriend;
    renderOnlineChatLayout();
  }));
  renderOnlineChatPanel(root.querySelector('#chat-messages-panel'));
  if (onlineChatActiveFriendId && hasOnlineBackendConfigured()) {
    refreshOnlineConversation(onlineChatActiveFriendId)
      .then(() => {
        if (isOnlineChatComposerFocused()) scheduleOnlineChatFullRenderAfterTyping();
        else renderOnlineChatPanel(root.querySelector('#chat-messages-panel'));
      })
      .catch(() => {});
  }
}
