let _searchOpen = false;

function openSearch() {
  if (_searchOpen) return;
  _searchOpen = true;

  const overlay = document.createElement('div');
  overlay.id = 'search-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding-top:60px;backdrop-filter:blur(3px)';
  overlay.innerHTML = `
    <div class="search-modal">
      <div class="search-input-wrap">
        <span class="search-icon">⌕</span>
        <input id="search-q" type="text" placeholder="Buscar en todo el sistema..." autocomplete="off">
      </div>
      <div class="search-results" id="search-results">
        <div class="search-empty">Escribe para buscar en diario, notas, tareas, agenda, rutinas y más</div>
      </div>
      <div class="search-hint">
        <span class="search-hint-item"><span class="search-hint-key">↑↓</span> navegar</span>
        <span class="search-hint-item"><span class="search-hint-key">↵</span> abrir</span>
        <span class="search-hint-item"><span class="search-hint-key">Esc</span> cerrar</span>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  const input = overlay.querySelector('#search-q');
  setTimeout(() => input.focus(), 50);

  const onKey = e => { if ((e.ctrlKey||e.metaKey) && e.key==='k') { e.preventDefault(); close(); } };
  let close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    _searchOpen = false;
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  let debounce, focusIdx = -1;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => runSearch(input.value.trim(), overlay), 180);
  });

  input.addEventListener('keydown', e => {
    const items = overlay.querySelectorAll('.search-result-item');
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx = Math.min(focusIdx+1, items.length-1); updateFocus(items, focusIdx); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); focusIdx = Math.max(focusIdx-1, 0);              updateFocus(items, focusIdx); }
    if (e.key === 'Enter' && focusIdx >= 0) { items[focusIdx]?.click(); }
  });

  // Ctrl+K cierra si ya está abierto
  document.addEventListener('keydown', onKey);
}

function updateFocus(items, idx) {
  items.forEach((el,i) => el.classList.toggle('focused', i===idx));
  items[idx]?.scrollIntoView({block:'nearest'});
}

function runSearch(q, overlay) {
  const res = overlay.querySelector('#search-results');
  if (!q || q.length < 2) {
    res.innerHTML = '<div class="search-empty">Escribe para buscar en diario, notas, tareas, agenda, rutinas y más</div>';
    return;
  }
  const ql = q.toLowerCase();
  const alters = getAlters();
  const alterName = id => alters.find(a=>a.id===id)?.name || '—';

  const sections = [];

  const SEARCH_LIMIT = 3; // initial items per section; "ver más" expands all

  // Diario
  const diarioAll = loadEntries().filter(e =>
    !e.isArchived &&
    (e.title?.toLowerCase().includes(ql) || e.body?.toLowerCase().includes(ql) || (e.tags||[]).some(t=>t.toLowerCase().includes(ql)))
  );
  if (diarioAll.length) sections.push({
    label:'Diario', color:'#ff8ae2', icon:'◫',
    allItems: diarioAll.map(e => ({
      icon:'◫', iconBg:'rgba(255,138,226,0.15)', iconColor:'#ff8ae2',
      title: e.title||'Sin título',
      meta: `${alterName(e.alterId)} · ${new Date(e.ts).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}`,
      snippet: e.body?.slice(0,100),
      action: () => { overlay.remove(); _searchOpen=false; navigateTo('diario'); setTimeout(()=>{ diarioMode='detail'; diarioDetailId=e.id; renderDiario(); },100); }
    }))
  });

  // Notas
  const notasAll = loadNotas().filter(n =>
    (n.title?.toLowerCase().includes(ql) || n.body?.toLowerCase().includes(ql) || (n.tags||[]).some(t=>t.toLowerCase().includes(ql)))
  );
  if (notasAll.length) sections.push({
    label:'Notas', color:'#c4aaff', icon:'◧',
    allItems: notasAll.map(n => ({
      icon:'◧', iconBg:'rgba(196,170,255,0.15)', iconColor:'#c4aaff',
      title: n.title||'Sin título',
      meta: `${alterName(n.alterId)} · ${new Date(n.ts).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}`,
      snippet: n.body?.slice(0,100),
      action: () => { comTab='tablon'; navigateTo('innerchat'); }
    }))
  });

  // Tareas
  const tareasAll = loadTareas().filter(t =>
    t.title?.toLowerCase().includes(ql) || t.desc?.toLowerCase().includes(ql)
  );
  if (tareasAll.length) sections.push({
    label:'Tareas', color:'#8affe0', icon:'◉',
    allItems: tareasAll.map(t => ({
      icon:'◉', iconBg:'rgba(138,255,224,0.12)', iconColor:'#8affe0',
      title: t.title,
      meta: `${t.status||'pendiente'} · ${alterName(t.alterId)}`,
      snippet: t.desc,
      action: () => navigateTo('proyectos')
    }))
  });

  // Solicitudes
  const solicAll = loadSolicitudes().filter(s =>
    s.title?.toLowerCase().includes(ql) || s.desc?.toLowerCase().includes(ql)
  );
  if (solicAll.length) sections.push({
    label:'Solicitudes', color:'#ff8ae2', icon:'◱',
    allItems: solicAll.map(s => ({
      icon:'◱', iconBg:'rgba(255,138,226,0.12)', iconColor:'#ff8ae2',
      title: s.title,
      meta: `de ${alterName(s.fromId)} → ${alterName(s.toId)} · ${s.status}`,
      snippet: s.desc,
      action: () => { comTab='solicitudes'; navigateTo('innerchat'); }
    }))
  });

  // Agenda (eventos)
  const agendaAll = loadEvents().filter(e =>
    e.title?.toLowerCase().includes(ql) || e.note?.toLowerCase().includes(ql)
  );
  if (agendaAll.length) sections.push({
    label:'Agenda', color:'#90c4ff', icon:'◷',
    allItems: agendaAll.map(e => ({
      icon:'◷', iconBg:'rgba(144,196,255,0.12)', iconColor:'#90c4ff',
      title: e.title,
      meta: `${e.date}${e.time?' · '+e.time:''}${e.alterId?' · '+alterName(e.alterId):''}`,
      snippet: e.note?.slice(0,80),
      action: () => navigateTo('agenda')
    }))
  });

  // Rutinas
  const rutinasAll = loadRoutines().filter(r =>
    r.name?.toLowerCase().includes(ql) || r.description?.toLowerCase().includes(ql) ||
    (r.steps||[]).some(s=>s.toLowerCase().includes(ql))
  );
  if (rutinasAll.length) sections.push({
    label:'Rutinas', color:'#5fffb0', icon:'↻',
    allItems: rutinasAll.map(r => ({
      icon:'↻', iconBg:'rgba(95,255,176,0.12)', iconColor:'#5fffb0',
      title: r.name,
      meta: r.description?.slice(0,60)||'',
      action: () => navigateTo('rutinas')
    }))
  });

  // Contactos
  const contactosAll = loadContactos().filter(c =>
    c.name?.toLowerCase().includes(ql) || c.notes?.toLowerCase().includes(ql) || c.relation?.toLowerCase().includes(ql)
  );
  if (contactosAll.length) sections.push({
    label:'Contactos', color:'#90c4ff', icon:'◎',
    allItems: contactosAll.map(c => ({
      icon:'◎', iconBg:'rgba(144,196,255,0.12)', iconColor:'#90c4ff',
      title: c.name,
      meta: c.relation||'',
      snippet: c.notes?.slice(0,80),
      action: () => { memoriaTab='contactos'; navigateTo('memoria'); }
    }))
  });

  // Alters
  const altersAll = alters.filter(a =>
    a.name?.toLowerCase().includes(ql) || a.role?.toLowerCase().includes(ql) || a.description?.toLowerCase().includes(ql)
  );
  if (altersAll.length) sections.push({
    label:'Alters', color:'#a08aff', icon:'◎',
    allItems: altersAll.map(a => ({
      icon: null, avatarAlt: a, size: 28,
      iconBg: a.bg, iconColor: a.color,
      title: a.name,
      meta: a.role||a.roleType,
      snippet: a.description?.slice(0,80),
      action: () => { alteresTab='perfiles'; navigateTo('perfiles'); }
    }))
  });

  if (!sections.length) {
    res.innerHTML = `<div class="search-empty">Sin resultados para "<strong>${esc(q)}</strong>"</div>`;
    return;
  }

  const renderSection = (sec, showAll) => {
    const displayed = showAll ? sec.allItems : sec.allItems.slice(0, SEARCH_LIMIT);
    const remaining = sec.allItems.length - displayed.length;
    return `<div class="search-section" data-sec="${escC(sec.label)}">
      <div class="search-section-label">${sec.label}</div>
      <div class="search-section-items">
        ${displayed.map(item => `
          <div class="search-result-item" data-action>
            <div class="search-result-icon" style="background:${item.iconBg};color:${item.iconColor};overflow:hidden">
              ${item.avatarAlt ? alterAv(item.avatarAlt, 28) : item.icon}
            </div>
            <div style="flex:1;min-width:0">
              <div class="search-result-title">${highlight(item.title||'',q)}</div>
              ${item.meta ? `<div class="search-result-meta">${esc(item.meta)}</div>` : ''}
              ${item.snippet ? `<div class="search-result-snippet">${highlight(item.snippet,q)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
      ${remaining > 0 ? `<button class="search-show-more" data-more-sec="${escC(sec.label)}" style="width:100%;text-align:left;padding:5px 10px;font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;font-family:'DM Mono',monospace">Ver ${remaining} más →</button>` : ''}
    </div>`;
  };

  res.innerHTML = sections.map(sec => renderSection(sec, false)).join('');

  // Wire actions
  const wireActions = () => {
    res.querySelectorAll('.search-result-item').forEach(el => {
      const secLabel = el.closest('.search-section')?.dataset.sec;
      const sec = sections.find(s => s.label === secLabel);
      const idx = Array.from(el.closest('.search-section-items').children).indexOf(el);
      el.addEventListener('click', () => {
        overlay.remove(); _searchOpen = false;
        sec?.allItems[idx]?.action?.();
      });
    });
    // Ver más
    res.querySelectorAll('.search-show-more').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = sections.find(s => s.label === btn.dataset.moreSec);
        if (!sec) return;
        btn.closest('.search-section').outerHTML = renderSection(sec, true);
        // Re-assign since DOM changed; re-wire this section
        wireActions();
      });
    });
  };
  wireActions();
}

function highlight(text, q) {
  if (!text || !q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return text.replace(re, '<mark style="background:rgba(160,138,255,.3);color:var(--accent);border-radius:2px">$1</mark>');
}

// ═══════════════════════════════════════════════
// TRACKER EMOCIONAL
// ═══════════════════════════════════════════════
