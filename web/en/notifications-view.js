function renderNotif() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Notifications'}]);
  renderNotifView();
}

function renderNotifView() {
  const app = document.getElementById('app');
  if (!activeAlter) { app.innerHTML = '<p style="padding:24px;color:var(--text-2)">Select an alter first.</p>'; return; }

  const alterId = activeAlter.id;
  const active  = computeNotifs(alterId);

  // Dismissed hoy
  const today = new Date().toISOString().slice(0,10);
  const dimData = getDismissed();
  const dimKeys = (dimData[alterId]?.date === today) ? (dimData[alterId].keys || []) : [];

  // Obtener datos de las notificaciones descartadas para mostrarlas
  const allPossibleKeys = ['agenda','solicitudes','diario','normas','backup'];
  const dismissed = dimKeys.map(k => {
    const meta = {
      agenda:      { icon:'◷', label:'Agenda', color:'#ffb450' },
      solicitudes: { icon:'◱', label:'Requests', color:'#a08aff' },
      diario:      { icon:'◫', label:'Journal', color:'#ff8ae2' },
      normas:      { icon:'◳', label:'Rules', color:'#8ab4ff' },
      backup:      { icon:'◬', label:'Backup', color:'#ffb450' },
    };
    return meta[k] ? { key: k, ...meta[k] } : null;
  }).filter(Boolean);

  // HTML activas
  let activeHtml = '';
  if (active.length === 0) {
    activeHtml = `
      <div class="notif-empty">
        <div class="notif-empty-icon">◎</div>
        <div class="notif-empty-text">All up to date.<br>There are no pending alerts for this alter.</div>
      </div>`;
  } else {
    activeHtml = active.map((n,i) => `
      <div class="notif-card" data-notif-nav="${n.nav}"${n.tab ? ` data-notif-tab="${n.tab}"` : ''} style="background:${n.bg};border-color:${n.border};animation-delay:${i*40}ms">
        <span class="notif-card-icon" style="color:${n.color}">${n.icon}</span>
        <div class="notif-card-body">
          <div class="notif-card-title" style="color:${n.color}">${n.title}</div>
          <div class="notif-card-sub">${n.sub}</div>
          <div class="notif-card-meta">Tap to go to the module</div>
        </div>
        <div class="notif-card-actions">
          <span class="notif-card-arrow" style="color:${n.color}">→</span>
          <button class="notif-card-dismiss" data-dismiss="${n.key}" title="Dismiss today">Dismiss</button>
        </div>
      </div>`).join('');
  }

  // HTML descartadas
  let dismissedHtml = '';
  if (dismissed.length > 0) {
    dismissedHtml = `
      <div>
        <div class="notif-section-label">Discarded today</div>
        <div class="notif-dismissed-list">
          ${dismissed.map(d => `
            <div class="notif-dismissed-item">
              <span class="notif-dismissed-icon" style="color:${d.color}">${d.icon}</span>
              <span class="notif-dismissed-text">${d.label}</span>
              <span class="notif-dismissed-badge">Dismissed today</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  app.innerHTML = `
    <div class="notif-view">
      <div class="notif-view-header">
        <div>
          <div class="notif-view-title">Notifications</div>
          <div class="notif-view-subtitle">Active alerts for ${activeAlter.emoji || ''} ${activeAlter.name}</div>
        </div>
      </div>

      <div>
        <div class="notif-section-label">Active alerts — ${active.length}</div>
        ${activeHtml}
      </div>

      ${dismissedHtml}

      <div>
        <div class="notif-section-label">Settings</div>
        <div class="notif-config-link" id="notif-go-config">
          <span class="notif-config-link-icon">⊙</span>
          <span>Manage which alerts are shown</span>
          <span class="notif-config-link-arrow">→</span>
        </div>
      </div>
    </div>`;

  // Bind eventos — cards activas
  app.querySelectorAll('.notif-card[data-notif-nav]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.dataset.dismiss) return;
      const tab = card.dataset.notifTab;
      if (tab) notasModuleTab = tab;
      navigateTo(card.dataset.notifNav);
    });
  });

  // Bind eventos — descartar
  app.querySelectorAll('.notif-card-dismiss[data-dismiss]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      dismissToday(alterId, btn.dataset.dismiss);
      renderNotifView(); // re-render
    });
  });

  // Config link
  app.querySelector('#notif-go-config')?.addEventListener('click', () => navigateTo('config'));
}

window.AtriaNotificationsView = Object.freeze({ render: renderNotif });
