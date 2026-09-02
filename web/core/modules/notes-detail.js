(function (global) {
  'use strict';
  function openNotaDetail(n) {
    const es = document.documentElement.lang === 'es';
    const col = getNotaColor(n.color);
    const alt = getAlters().find(a => a.id === n.alterId);
    const date = new Date(n.ts).toLocaleString(es ? 'es-ES' : 'en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const own = n.alterId === activeAlter.id;
    openModal(`<div style="background:${col.hex};border-radius:var(--radius-lg);padding:20px;margin:-4px;color:${col.text};display:flex;flex-direction:column;gap:12px"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px"><div style="flex:1">${n.pinned ? `<div style="font-size:13px;margin-bottom:6px">📌 ${es ? 'Fijada' : 'Pinned'}</div>` : ''}${n.isPrivate ? `<div style="font-size:12px;opacity:.6;margin-bottom:4px">🔒 ${es ? 'Privado' : 'Private'}</div>` : ''}${n.title ? `<div style="font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.2">${escN(n.title)}</div>` : ''}</div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0"><span style="font-size:16px">${alt?.emoji || ''}</span><span style="font-size:12px;font-weight:600;opacity:.7">${escN(alt?.name || '')}</span></div></div><div style="font-size:14px;line-height:1.7;white-space:pre-wrap;opacity:.9">${escN(n.body || '')}</div>${(n.tags || []).length ? `<div style="display:flex;gap:5px;flex-wrap:wrap">${n.tags.map(t => `<span style="font-family:'DM Mono',monospace;font-size:10px;padding:3px 8px;border-radius:4px;background:rgba(0,0,0,.2)">#${escN(t)}</span>`).join('')}</div>` : ''}<div style="font-family:'DM Mono',monospace;font-size:10px;opacity:.5">${date}</div></div><div class="modal-footer"><button class="btn btn-ghost" data-cancel>${es ? 'Cerrar' : 'Close'}</button>${own ? `<button class="btn btn-ghost" id="det-nota-edit">✎ ${es ? 'Editar' : 'Edit'}</button><button class="btn btn-danger" id="det-nota-del">✕ ${es ? 'Eliminar' : 'Delete'}</button>` : ''}</div>`, () => {});
    document.getElementById('det-nota-edit')?.addEventListener('click', () => { closeModal(); openNotaModal(n); });
    document.getElementById('det-nota-del')?.addEventListener('click', () => { if (!confirm(es ? '¿Eliminar?' : 'Delete?')) return; saveNotas(loadNotas().filter(x => x.id !== n.id)); closeModal(); showToast(es ? 'Nota eliminada' : 'Note deleted'); renderNotasView(); });
  }
  global.openNotaDetail = openNotaDetail;
})(window);
