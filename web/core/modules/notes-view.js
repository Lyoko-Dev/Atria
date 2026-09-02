(function (global) {
  'use strict';

  function render() {
    const es = document.documentElement.lang === 'es' || /(?:^|\/)es(?:\/|$)/.test(location.pathname);
    const copy = es ? {
      title: 'Notas', visible: ['nota', 'notas'], all: 'Todos', tags: '# Etiquetas:',
      from: 'Desde', to: 'Hasta', clear: 'Limpiar fechas', templates: 'Plantillas',
      add: '+ Nueva nota', empty: 'Sin notas que mostrar', first: 'Primera nota',
      grid: 'Cuadrícula', list: 'Lista', pinned: 'Nota fijada 📌', unpinned: 'Nota desfijada'
    } : {
      title: 'Notes', visible: ['note', 'notes'], all: 'All', tags: '# Tags:',
      from: 'From', to: 'To', clear: 'Clear dates', templates: 'Templates',
      add: '+ New note', empty: 'No notes to show', first: 'First note',
      grid: 'Grid', list: 'List', pinned: 'Note pinned 📌', unpinned: 'Note unpinned'
    };
    const app = document.getElementById('app');
    const alters = getAlters();
    const todas = getVisibleNotas();
    let filtered = todas.filter(n => {
      const alterOk = notasFilterAlter === 'all' || n.alterId === notasFilterAlter;
      const tagOk = !notasFilterTag || (n.tags || []).includes(notasFilterTag);
      const day = n.ts ? new Date(n.ts).toISOString().slice(0, 10) : '';
      return alterOk && tagOk && (!notasFilterFrom || (day && day >= notasFilterFrom)) && (!notasFilterTo || (day && day <= notasFilterTo));
    });
    filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.ts - a.ts));
    const allTags = [...new Set(todas.flatMap(n => n.tags || []))].sort();
    const countByAlter = {};
    todas.forEach(n => { countByAlter[n.alterId] = (countByAlter[n.alterId] || 0) + 1; });
    const plural = filtered.length === 1 ? copy.visible[0] : copy.visible[1];

    app.innerHTML = `<div class="notas-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div><div class="fin-title">◧ ${copy.title}</div><div class="fin-subtitle">${filtered.length} ${plural} ${es ? 'visible' : 'visible'}${filtered.length === 1 ? '' : es ? 's' : ''}</div></div>
        <div style="display:flex;gap:8px;align-items:center"><div class="notas-view-toggle">
          <div class="notas-view-btn${notasViewMode === 'grid' ? ' active' : ''}" id="btn-view-grid" title="${copy.grid}">⊞</div>
          <div class="notas-view-btn${notasViewMode === 'list' ? ' active' : ''}" id="btn-view-list" title="${copy.list}">☰</div>
        </div><button class="btn btn-ghost" id="btn-note-templates">${copy.templates}</button><button class="btn btn-primary" id="btn-new-nota">${copy.add}</button></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px"><div class="notas-filter-alter">
        <div class="nota-alter-chip${notasFilterAlter === 'all' ? ' active' : ''}" data-fa="all" style="${notasFilterAlter === 'all' ? 'border-color:var(--border-active);background:var(--bg-3)' : ''}">${copy.all} · ${todas.length}</div>
        ${alters.filter(a => countByAlter[a.id]).map(a => `<div class="nota-alter-chip${notasFilterAlter === a.id ? ' active' : ''}" data-fa="${a.id}" style="${notasFilterAlter === a.id ? `border-color:${a.color};background:${a.bg};color:${a.color}` : ''}">${a.emoji} ${esc(a.name)} · ${countByAlter[a.id]}</div>`).join('')}
      </div>${allTags.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center"><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.1em">${copy.tags}</span><div class="nota-alter-chip${!notasFilterTag ? ' active' : ''}" data-ft="" style="${!notasFilterTag ? 'border-color:var(--border-active);background:var(--bg-3)' : ''}">${copy.all}</div>${allTags.map(t => `<div class="nota-alter-chip${notasFilterTag === t ? ' active' : ''}" data-ft="${t}" style="${notasFilterTag === t ? 'border-color:var(--accent);background:rgba(160,138,255,.1);color:var(--accent)' : ''}">#${t}</div>`).join('')}</div>` : ''}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--text-3)"><label>${copy.from} <input type="date" id="notas-filter-from" value="${notasFilterFrom}" style="font-size:11px"></label><label>${copy.to} <input type="date" id="notas-filter-to" value="${notasFilterTo}" style="font-size:11px"></label>${(notasFilterFrom || notasFilterTo) ? `<button class="btn btn-ghost btn-xs" id="notas-filter-clear">${copy.clear}</button>` : ''}</div>
      <div id="notas-content"></div></div>`;

    app.querySelectorAll('[data-fa]').forEach(el => el.addEventListener('click', () => { notasFilterAlter = el.dataset.fa; render(); }));
    app.querySelectorAll('[data-ft]').forEach(el => el.addEventListener('click', () => { notasFilterTag = el.dataset.ft || null; render(); }));
    app.querySelector('#notas-filter-from')?.addEventListener('change', e => { notasFilterFrom = e.target.value; render(); });
    app.querySelector('#notas-filter-to')?.addEventListener('change', e => { notasFilterTo = e.target.value; render(); });
    app.querySelector('#notas-filter-clear')?.addEventListener('click', () => { notasFilterFrom = ''; notasFilterTo = ''; render(); });
    app.querySelector('#btn-view-grid')?.addEventListener('click', () => { notasViewMode = 'grid'; render(); });
    app.querySelector('#btn-view-list')?.addEventListener('click', () => { notasViewMode = 'list'; render(); });
    app.querySelector('#btn-new-nota')?.addEventListener('click', () => openNotaModal(null));
    app.querySelector('#btn-note-templates')?.addEventListener('click', () => openTemplatesModal('note'));
    renderNotasContent(app.querySelector('#notas-content'), filtered, alters);
  }

  global.AtriaNotesView = Object.freeze({ render });
})(window);
