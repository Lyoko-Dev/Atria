function renderBiblioteca() {
  if(!['contactos','salud','recursos','documentos'].includes(bibTab)) bibTab='contactos';
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Biblioteca'}]);
  renderBibliotecaView();
}

function renderBibliotecaView() {
  const app    = document.getElementById('app');
  const alters = getAlters();
  const contactos  = loadContactos();
  const recursos   = loadRecursos();
  const documentos = loadDocumentos();

  app.innerHTML = `
    <div class="bib-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◫ Biblioteca</div>
          <div class="fin-subtitle">${contactos.length} contactos · ${recursos.length} recursos · ${documentos.length} documentos</div>
        </div>
        ${bibTab!=='salud'?`<button class="btn btn-primary" id="btn-bib-new">+ Añadir</button>`:''}
      </div>

      <div class="bib-tabs">
        ${[
          {id:'contactos',  label:'◎ Contactos',  n:contactos.length},
          {id:'salud',      label:'✚ Salud',       n:null},
          {id:'recursos',   label:'◧ Recursos',   n:recursos.length},
          {id:'documentos', label:'◪ Documentos', n:documentos.length},
        ].map(t=>`<div class="bib-tab${bibTab===t.id?' active':''}" data-bt="${t.id}">
          ${t.label}${t.n!==null?` <span style="font-size:9px;opacity:.6">${t.n}</span>`:''}
        </div>`).join('')}
      </div>

      <div id="bib-content"></div>
    </div>`;

  app.querySelectorAll('.bib-tab').forEach(t=>t.addEventListener('click',()=>{ bibTab=t.dataset.bt; renderBibliotecaView(); }));
  app.querySelector('#btn-bib-new')?.addEventListener('click',()=>{
    if(bibTab==='contactos')  openContactoModal(null);
    else if(bibTab==='recursos')   openRecursoModal(null);
    else if(bibTab==='documentos') openDocumentoModal(null);
  });

  const cont = app.querySelector('#bib-content');
  if(bibTab==='contactos')  renderContactosTab(cont, alters);
  if(bibTab==='salud')      renderSaludTab(cont, alters);
  if(bibTab==='recursos')   renderRecursosTab(cont, alters);
  if(bibTab==='documentos') renderDocumentosTab(cont, alters);
}

// ════ CONTACTOS ════
function renderContactosTab(cont, alters) {
  const items = loadContactos().sort((a,b)=>a.name.localeCompare(b.name));
  if(!items.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:60px 20px"><div class="empty-icon">◎</div><div>Sin contactos aún</div></div>`;
    return;
  }
  cont.innerHTML=`<div class="contacto-grid">${items.map(c=>{
    const alterChips = (c.alterIds||[]).map(aid=>{
      const a=alters.find(x=>x.id===aid); return a?`<span class="contacto-alter-chip">${a.emoji} ${esc(a.name)}</span>`:'';
    }).join('');
    const detalles = (c.contactInfo||[]).map(ci=>{
      const red=REDES.find(r=>r.id===ci.type)||REDES[4];
      return `<div class="contacto-detail"><span class="contacto-detail-icon">${red.icon}</span><span>${escB(ci.value)}</span></div>`;
    }).join('');
    return `<div class="contacto-card" data-cid="${c.id}">
      <div class="contacto-actions">
        <button class="icon-btn btn-c-edit" data-cid="${c.id}" title="Editar">✎</button>
        <button class="icon-btn btn-c-del"  data-cid="${c.id}" title="Eliminar">✕</button>
      </div>
      <div class="contacto-header">
        <div class="contacto-avatar" style="font-size:22px;background:var(--bg-2)">${c.emoji||'◎'}</div>
        <div>
          <div class="contacto-name">${escB(c.name)}</div>
          ${c.relation?`<div class="contacto-rel">${escB(c.relation)}</div>`:''}
        </div>
      </div>
      ${detalles?`<div class="contacto-details">${detalles}</div>`:''}
      ${alterChips?`<div class="contacto-alters">${alterChips}</div>`:''}
      ${c.note?`<div class="contacto-note">${escB(c.note)}</div>`:''}
    </div>`;
  }).join('')}</div>`;

  cont.querySelectorAll('.btn-c-edit').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const c=loadContactos().find(x=>x.id===b.dataset.cid); if(c) openContactoModal(c);
  }));
  cont.querySelectorAll('.btn-c-del').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(!confirm('¿Eliminar este contacto?')) return;
    saveContactos(loadContactos().filter(x=>x.id!==b.dataset.cid));
    showToast('Contacto eliminado'); _refreshBib('contactos');
  }));
}

// ════ RECURSOS ════
function renderRecursosTab(cont, alters) {
  let items = loadRecursos().sort((a,b)=>b.ts-a.ts);
  const cats = [...new Set(items.map(r=>r.category))];

  if(bibRecCat!=='all') items=items.filter(r=>r.category===bibRecCat);

  const filterHtml = cats.length>1?`<div class="bib-filters">
    <span class="bib-filter-chip${bibRecCat==='all'?' active':''}" data-rc="all">Todos</span>
    ${cats.map(c=>{ const cat=REC_CATS.find(x=>x.id===c)||REC_CATS[5];
      return `<span class="bib-filter-chip${bibRecCat===c?' active':''}" data-rc="${c}">${cat.icon} ${cat.label}</span>`;
    }).join('')}
  </div>`:'';

  cont.innerHTML = filterHtml + (items.length?`<div class="recurso-list">${items.map(r=>{
    const cat=REC_CATS.find(x=>x.id===r.category)||REC_CATS[5];
    const rec=alters.find(a=>a.id===r.alterId);
    return `<div class="recurso-card" data-rid="${r.id}">
      <div class="recurso-cat-icon" style="background:${cat.bg};color:${cat.color}">${cat.icon}</div>
      <div class="recurso-body">
        <div class="recurso-title">${escB(r.title)}</div>
        ${r.desc?`<div class="recurso-desc">${escB(r.desc)}</div>`:''}
        <div class="recurso-meta">
          <span class="recurso-tag" style="color:${cat.color};border-color:${cat.color}">${cat.label}</span>
          ${(r.tags||[]).map(t=>`<span class="recurso-tag">#${escB(t)}</span>`).join('')}
          ${rec?`<span style="font-size:11px;color:var(--text-2)">${rec.emoji} ${rec.name}</span>`:''}
          ${r.url?`<a href="${escB(r.url)}" target="_blank" class="recurso-url-link" style="font-family:'DM Mono',monospace;font-size:10px;color:var(--accent);text-decoration:none">🔗 Abrir</a>`:''}
        </div>
      </div>
      <div class="recurso-actions">
        <button class="icon-btn btn-r-edit" data-rid="${r.id}" title="Editar">✎</button>
        <button class="icon-btn btn-r-del"  data-rid="${r.id}" title="Eliminar">✕</button>
      </div>
    </div>`;
  }).join('')}</div>` : `<div class="empty-state" style="padding:40px 20px"><div class="empty-icon">◧</div><div>Sin recursos</div></div>`);

  cont.querySelectorAll('[data-rc]').forEach(chip=>chip.addEventListener('click',()=>{ bibRecCat=chip.dataset.rc; _refreshBib('recursos'); }));
  cont.querySelectorAll('.recurso-url-link').forEach(a=>a.addEventListener('click',e=>e.stopPropagation()));
  cont.querySelectorAll('.btn-r-edit').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const r=loadRecursos().find(x=>x.id===b.dataset.rid); if(r) openRecursoModal(r);
  }));
  cont.querySelectorAll('.btn-r-del').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(!confirm('¿Eliminar este recurso?')) return;
    saveRecursos(loadRecursos().filter(x=>x.id!==b.dataset.rid));
    showToast('Recurso eliminado'); _refreshBib('recursos');
  }));
}

// ════ DOCUMENTOS ════
function renderDocumentosTab(cont, alters) {
  const activeId = activeAlter?.id;
  let items = loadDocumentos().filter(d=>d.access==='compartido'||d.alterId===activeId).sort((a,b)=>b.ts-a.ts);
  if(bibDocCat!=='all') items=items.filter(d=>d.category===bibDocCat);
  const cats=[...new Set(loadDocumentos().map(d=>d.category))];

  const filterHtml=cats.length>1?`<div class="bib-filters">
    <span class="bib-filter-chip${bibDocCat==='all'?' active':''}" data-dc="all">Todos</span>
    ${cats.map(c=>{ const cat=DOC_CATS.find(x=>x.id===c)||DOC_CATS[4];
      return `<span class="bib-filter-chip${bibDocCat===c?' active':''}" data-dc="${c}" style="border-color:${cat.color}">${cat.label}</span>`;
    }).join('')}
  </div>`:'';

  cont.innerHTML = filterHtml + (items.length?`<div class="doc-list">${items.map(d=>{
    const cat=DOC_CATS.find(x=>x.id===d.category)||DOC_CATS[4];
    const owner=alters.find(a=>a.id===d.alterId);
    const isPrivate=d.access!=='compartido';
    return `<div class="doc-card" data-did="${d.id}">
      <div class="doc-icon-wrap" style="background:rgba(144,196,255,.1);color:#90c4ff">◪</div>
      <div class="doc-body">
        <div class="doc-title">${escB(d.name)}</div>
        ${d.desc?`<div class="doc-desc">${escB(d.desc)}</div>`:''}
        <div class="doc-meta">
          <span style="color:${cat.color}">${cat.label}</span>
          ${owner?`<span>${owner.emoji} ${owner.name}</span>`:''}
          <span class="doc-access-badge" style="color:${isPrivate?'var(--accent-4)':'var(--green)'};border-color:${isPrivate?'var(--accent-4)':'var(--green)'}">
            ${isPrivate?'🔒 Privado':'◎ Compartido'}
          </span>
          ${d.url?`<a href="${escB(d.url)}" target="_blank" class="doc-url-link" style="color:var(--accent);text-decoration:none;font-size:10px">🔗 Enlace</a>`:''}
        </div>
      </div>
      <div class="doc-actions">
        <button class="icon-btn btn-d-edit" data-did="${d.id}" title="Editar">✎</button>
        <button class="icon-btn btn-d-del"  data-did="${d.id}" title="Eliminar">✕</button>
      </div>
    </div>`;
  }).join('')}</div>` : `<div class="empty-state" style="padding:40px 20px"><div class="empty-icon">◪</div><div>Sin documentos</div></div>`);

  cont.querySelectorAll('[data-dc]').forEach(chip=>chip.addEventListener('click',()=>{ bibDocCat=chip.dataset.dc; _refreshBib('documentos'); }));
  cont.querySelectorAll('.doc-url-link').forEach(a=>a.addEventListener('click',e=>e.stopPropagation()));
  cont.querySelectorAll('.btn-d-edit').forEach(b=>b.addEventListener('click',()=>{
    const d=loadDocumentos().find(x=>x.id===b.dataset.did); if(d) openDocumentoModal(d);
  }));
  cont.querySelectorAll('.btn-d-del').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('¿Eliminar este documento?')) return;
    saveDocumentos(loadDocumentos().filter(x=>x.id!==b.dataset.did));
    showToast('Documento eliminado'); _refreshBib('documentos');
  }));
}

window.AtriaLibraryView = Object.freeze({ render: renderBiblioteca });
