function renderNotif() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Notificaciones'}]);
  renderNotifView();
}

function renderNotifView() {
  const app = document.getElementById('app');
  if (!activeAlter) { app.innerHTML = '<p style="padding:24px;color:var(--text-2)">Selecciona un alter primero.</p>'; return; }

  const alterId = activeAlter.id;
  const active  = computeNotifs(alterId);

  // Dismissed hoy + historial
  const today = new Date().toISOString().slice(0,10);
  const dimData = getDismissed();
  const dimKeys = (dimData[alterId]?.date === today) ? (dimData[alterId].keys || []) : [];
  const KEY_META = {
    agenda:      { icon:'◷', label:'Agenda',      color:'#ffb450' },
    solicitudes: { icon:'◱', label:'Solicitudes', color:'#a08aff' },
    diario:      { icon:'◫', label:'Diario',      color:'#ff8ae2' },
    normas:      { icon:'◳', label:'Normas',      color:'#8ab4ff' },
    backup:      { icon:'◬', label:'Backup',      color:'#ffb450' },
  };

  // Obtener datos de las notificaciones descartadas para mostrarlas
  const dismissed = dimKeys.map(k => KEY_META[k] ? { key: k, ...KEY_META[k] } : null).filter(Boolean);
  const histData = getDismissedHistory(alterId).filter(h => h.date !== today);

  // HTML activas
  let activeHtml = '';
  if (active.length === 0) {
    activeHtml = `
      <div class="notif-empty">
        <div class="notif-empty-icon">◎</div>
        <div class="notif-empty-text">Todo al día.<br>No hay alertas pendientes para este alter.</div>
      </div>`;
  } else {
    activeHtml = active.map((n,i) => `
      <div class="notif-card" data-notif-nav="${n.nav}"${n.tab ? ` data-notif-tab="${n.tab}"` : ''} style="background:${n.bg};border-color:${n.border};animation-delay:${i*40}ms">
        <span class="notif-card-icon" style="color:${n.color}">${n.icon}</span>
        <div class="notif-card-body">
          <div class="notif-card-title" style="color:${n.color}">${n.title}</div>
          <div class="notif-card-sub">${n.sub}</div>
          <div class="notif-card-meta">Toca para ir al módulo</div>
        </div>
        <div class="notif-card-actions">
          <span class="notif-card-arrow" style="color:${n.color}">→</span>
          <button class="notif-card-dismiss" data-dismiss="${n.key}" title="Descartar hoy">Descartar</button>
        </div>
      </div>`).join('');
  }

  // HTML descartadas hoy + historial
  let dismissedHtml = '';
  if (dismissed.length > 0 || histData.length > 0) {
    const histHtml = histData.length ? histData.map(h => {
      const d = new Date(h.date+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
      const items = h.keys.map(k=>KEY_META[k]?.icon||'◎').join(' ');
      return `<div class="notif-dismissed-item" style="opacity:.6">
        <span class="notif-dismissed-icon" style="color:var(--text-3)">◷</span>
        <span class="notif-dismissed-text">${d}</span>
        <span class="notif-dismissed-badge">${items}</span>
      </div>`;
    }).join('') : '';

    dismissedHtml = `
      <div>
        <div class="notif-section-label">Descartadas hoy${histData.length?' · Historial':''}</div>
        <div class="notif-dismissed-list">
          ${dismissed.map(d => `
            <div class="notif-dismissed-item">
              <span class="notif-dismissed-icon" style="color:${d.color}">${d.icon}</span>
              <span class="notif-dismissed-text">${d.label}</span>
              <span class="notif-dismissed-badge">Hoy</span>
            </div>`).join('')}
          ${histHtml}
        </div>
      </div>`;
  }

  app.innerHTML = `
    <div class="notif-view">
      <div class="notif-view-header">
        <div>
          <div class="notif-view-title">Notificaciones</div>
          <div class="notif-view-subtitle">Alertas activas para ${activeAlter.emoji || ''} ${activeAlter.name}</div>
        </div>
      </div>

      <div>
        <div class="notif-section-label">Alertas activas — ${active.length}</div>
        ${activeHtml}
      </div>

      ${dismissedHtml}

      <div>
        <div class="notif-section-label">Configuración</div>
        <div class="notif-config-link" id="notif-go-config">
          <span class="notif-config-link-icon">⊙</span>
          <span>Gestionar qué alertas se muestran</span>
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
