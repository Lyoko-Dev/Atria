(function (global) {
  'use strict';
  const esc = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  function getNotaColor(colorId) { return NOTA_COLORS.find(c => c.id === colorId) || NOTA_COLORS[7]; }
  function gridCard(n, alters) {
    const col = getNotaColor(n.color), alt = alters.find(a => a.id === n.alterId), own = n.alterId === activeAlter.id;
    return `<div class="nota-card${n.pinned ? ' pinned' : ''}${n.isPrivate ? ' is-private' : ''}" data-nid="${n.id}" style="background:${col.hex};border-color:${col.border};color:${col.text}">${n.title ? `<div class="nota-card-title" style="padding-right:${n.pinned || n.isPrivate ? '28px' : '0'}">${esc(n.title)}</div>` : ''}<div class="nota-card-body" style="padding-right:${n.pinned || n.isPrivate ? '24px' : '0'}">${esc(n.body || '')}</div><div class="nota-card-footer"><div class="nota-card-tags">${(n.tags || []).map(t => `<span class="nota-card-tag">#${t}</span>`).join('')}</div><span class="nota-card-alter" title="${alt?.name || ''}">${alt?.emoji || ''}</span></div>${own ? `<div class="nota-card-actions"><button class="nota-card-btn btn-nota-pin" data-nid="${n.id}" title="${n.pinned ? 'Unpin' : 'Pin'}">📌</button><button class="nota-card-btn btn-nota-edit" data-nid="${n.id}" title="Edit">✎</button><button class="nota-card-btn btn-nota-del" data-nid="${n.id}" title="Delete">✕</button></div>` : ''}</div>`;
  }
  function listItem(n, alters) {
    const col = getNotaColor(n.color), alt = alters.find(a => a.id === n.alterId), own = n.alterId === activeAlter.id;
    const date = new Date(n.ts).toLocaleDateString(document.documentElement.lang === 'es' ? 'es-ES' : 'en-GB', { day:'numeric', month:'short' });
    return `<div class="nota-list-item" data-nid="${n.id}"><div class="nota-color-dot" style="background:${col.text}"></div>${n.pinned ? '<span style="font-size:12px">📌</span>' : ''}${n.isPrivate ? '<span style="font-size:12px">🔒</span>' : ''}<div class="nota-list-title">${esc(n.title || n.body?.slice(0, 40) || (document.documentElement.lang === 'es' ? 'Sin título' : 'No title'))}</div><div class="nota-list-preview">${esc(n.body?.slice(0, 80) || '')}</div><div class="nota-list-tags">${(n.tags || []).slice(0, 2).map(t => `<span class="nota-list-tag">#${t}</span>`).join('')}</div><div class="nota-list-meta"><span>${alt?.emoji || ''}</span><span>${date}</span></div>${own ? `<div class="nota-list-actions"><button class="icon-btn btn-nota-pin" data-nid="${n.id}" title="Pin">📌</button><button class="icon-btn btn-nota-edit" data-nid="${n.id}" title="Edit">✎</button><button class="icon-btn btn-nota-del" data-nid="${n.id}" title="Delete">✕</button></div>` : ''}</div>`;
  }
  function renderNotasContent(container, notas, alters) {
    if (!container) return;
    const es = document.documentElement.lang === 'es';
    if (notasViewMode === 'grid') {
      container.innerHTML = `<div class="notas-grid" id="notas-grid"></div>`;
      const grid = container.querySelector('#notas-grid');
      grid.innerHTML = notas.map(n => gridCard(n, alters)).join('') + `<div class="nota-add-card" id="btn-add-grid"><div class="nota-add-icon">+</div><div>${es ? 'Nueva nota' : 'New note'}</div></div>`;
      grid.querySelector('#btn-add-grid')?.addEventListener('click', () => openNotaModal(null));
    } else if (!notas.length) {
      container.innerHTML = `<div class="empty-state" style="padding:50px 20px"><div class="empty-icon">◧</div><div>${es ? 'Sin notas que mostrar' : 'No notes to show'}</div><button class="btn btn-primary" style="margin-top:8px" id="btn-empty-add">${es ? 'Primera nota' : 'First note'}</button></div>`;
      container.querySelector('#btn-empty-add')?.addEventListener('click', () => openNotaModal(null));
      return;
    } else container.innerHTML = `<div class="notas-list">${notas.map(n => listItem(n, alters)).join('')}</div>`;
    container.querySelectorAll('[data-nid]').forEach(el => el.addEventListener('click', e => { if (e.target.closest('.nota-card-actions,.nota-list-actions')) return; const n = getVisibleNotas().find(x => x.id === el.dataset.nid); if (n) openNotaDetail(n); }));
    container.querySelectorAll('.btn-nota-edit').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const n = loadNotas().find(x => x.id === b.dataset.nid); if (n) openNotaModal(n); }));
    container.querySelectorAll('.btn-nota-pin').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const list = loadNotas(), n = list.find(x => x.id === b.dataset.nid); if (n) { n.pinned = !n.pinned; saveNotas(list); renderNotasView(); showToast(n.pinned ? (es ? 'Nota fijada 📌' : 'Note pinned 📌') : (es ? 'Nota desfijada' : 'Note unpinned')); } }));
    container.querySelectorAll('.btn-nota-del').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const id = b.dataset.nid, all = loadNotas(), note = all.find(x => x.id === id); if (!note) return; saveNotas(all.filter(x => x.id !== id)); renderNotasView(); softDelete(es ? 'Nota eliminada' : 'Note deleted', () => {}, () => { const cur = loadNotas(); cur.push(note); saveNotas(cur); renderNotasView(); }); }));
    container.querySelectorAll('.nota-card-actions,.nota-list-actions').forEach(actions => { const card = actions.closest('[data-nid]'); const note = card && loadNotas().find(x => x.id === card.dataset.nid); if (!note || note.alterId !== activeAlter.id || note.isArchived || actions.querySelector('.btn-nota-archive')) return; const button = document.createElement('button'); button.className = 'nota-card-btn btn-nota-archive icon-btn'; button.dataset.nid = note.id; button.title = es ? 'Archivar' : 'Archive'; button.textContent = '↓'; button.addEventListener('click', e => { e.stopPropagation(); const list = loadNotas(), current = list.find(x => x.id === note.id); if (current) { current.isArchived = true; saveNotas(list); showToast(es ? 'Nota archivada' : 'Note archived'); renderNotasView(); } }); actions.insertBefore(button, actions.querySelector('.btn-nota-del')); });
  }
  global.getNotaColor = getNotaColor;
  global.escN = esc;
  global.renderNotasContent = renderNotasContent;
})(window);
