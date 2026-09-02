const PRIORITIES = [
  {id:'alta',  label:'Alta',  emoji:'⚠', color:'var(--red)'},
  {id:'media', label:'Media', emoji:'●', color:'var(--accent-4)'},
  {id:'baja',  label:'Baja',  emoji:'○', color:'var(--accent-3)'},
];

let normasTab = 'activas'; // activas | pendientes | archivadas

function loadNormas()   { try { return JSON.parse(localStorage.getItem('tid_normas'))||[]; } catch{return[];} }
function saveNormas(n)  { localStorage.setItem('tid_normas', JSON.stringify(n)); }
function loadPolls()    { try { return JSON.parse(localStorage.getItem('tid_polls'))||[]; } catch{return[];} }
function savePolls(p)   { localStorage.setItem('tid_polls', JSON.stringify(p)); }

function isAdmin() { return activeAlter?.isAdmin === true; }

function renderNormas() {
  if (activeAlter && activeAlter.permissions !== undefined && !activeAlter.permissions?.normas) {
    document.getElementById('app').innerHTML = `<div class="empty-state" style="margin-top:60px"><div class="empty-icon">🔒</div><div>No tienes permisos para acceder a Normas</div></div>`;
    setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Normas'}]);
    return;
  }
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Normas'}]);
  renderNormasView();
}

function renderPolls() {
  if (activeAlter && activeAlter.permissions !== undefined && !activeAlter.permissions?.normas) {
    document.getElementById('app').innerHTML = `<div class="empty-state" style="margin-top:60px"><div class="empty-icon">🔒</div><div>No tienes permisos para acceder a Votaciones</div></div>`;
    setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Votaciones'}]);
    return;
  }
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Votaciones'}]);
  renderPollsView();
}

function renderPollsView() {
  const app = document.getElementById('app');
  const polls = loadPolls();
  const alters = getAlters();
  const activePolls = polls.filter(p=>p.status!=='archivada').sort((a,b)=>(b.ts||0)-(a.ts||0));
  const archivedPolls = polls.filter(p=>p.status==='archivada').sort((a,b)=>(b.ts||0)-(a.ts||0));
  app.innerHTML = `
    <div class="normas-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◎ Votaciones</div>
          <div class="fin-subtitle">${polls.length} votación${polls.length!==1?'es':''} · ${activePolls.length} activa${activePolls.length!==1?'s':''}</div>
        </div>
        <button class="btn btn-primary" id="btn-new-poll">+ Nueva votación</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(255,213,128,.07);border:1px solid rgba(255,213,128,.2);border-radius:var(--radius);font-size:12px;color:var(--text-1)">
        <span style="font-size:16px">◎</span>
        <span>Las votaciones viven separadas de Normas y solo se comparten online si marcas cada poll como compartible.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px" id="polls-list">
        ${activePolls.length===0?`
          <div class="empty-state" style="padding:50px 20px">
            <div class="empty-icon">◎</div>
            <div>No hay votaciones activas</div>
            <button class="btn btn-primary" style="margin-top:8px" id="btn-new-poll-2">Crear la primera</button>
          </div>`:
          activePolls.map(p=>renderPollCard(p, alters)).join('')
        }
        ${archivedPolls.length?`
          <div class="diario-month-label" style="margin-top:4px"><span>Archivadas</span><span>${archivedPolls.length}</span></div>
          ${archivedPolls.map(p=>renderPollCard(p, alters)).join('')}`:''}
      </div>
    </div>`;
  app.querySelectorAll('#btn-new-poll,#btn-new-poll-2').forEach(b=>b?.addEventListener('click',()=>openPollModal(null)));
  wirePollCards(app);
}

function rerenderPollSurface() {
  if (currentView === 'polls') renderPollsView();
  else renderNormasView();
}

function renderNormasView() {
  const app   = document.getElementById('app');
  const todas = loadNormas();
  const alters = getAlters();

  const byTab = {
    activas:    todas.filter(n=>n.status==='activa'),
    pendientes: todas.filter(n=>n.status==='pendiente'),
    archivadas: todas.filter(n=>n.status==='archivada'),
  };
  const current = byTab[normasTab] || [];

  // Sort: alta > media > baja, luego por fecha desc
  const priOrder = {alta:0,media:1,baja:2};
  current.sort((a,b)=>(priOrder[a.priority]??2)-(priOrder[b.priority]??2)||(b.ts-a.ts));

  app.innerHTML = `
    <div class="normas-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◳ Normas del sistema</div>
          <div class="fin-subtitle">${todas.length} norma${todas.length!==1?'s':''} en total · ${byTab.activas.length} activas</div>
        </div>
        <button class="btn btn-primary" id="btn-new-norma">+ Proponer norma</button>
      </div>

      <!-- Info banner para no-admin -->
      ${!isAdmin()?`<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(138,180,255,.07);border:1px solid rgba(138,180,255,.2);border-radius:var(--radius);font-size:12px;color:var(--text-1)">
        <span style="font-size:16px">ℹ️</span>
        <span>Puedes proponer normas y votar. Solo el alter admin puede aprobarlas o archivarlas.</span>
      </div>`:''}

      <!-- TABS -->
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="normas-tabs">
          ${[
            {id:'activas',    label:'Activas'},
            {id:'pendientes', label:'Pendientes de aprobación'},
            {id:'archivadas', label:'Archivadas'},
          ].map(t=>`
            <div class="normas-tab${normasTab===t.id?' active':''}" data-tab="${t.id}">
              ${t.label}
              ${byTab[t.id].length>0?`<span class="tab-badge">${byTab[t.id].length}</span>`:''}
            </div>`).join('')}
        </div>
      </div>

      <!-- LISTA -->
      <div style="display:flex;flex-direction:column;gap:10px" id="normas-list">
        ${current.length===0?`
          <div class="empty-state" style="padding:50px 20px">
            <div class="empty-icon">◳</div>
            <div>${normasTab==='activas'?'No hay normas activas aún':normasTab==='pendientes'?'No hay normas pendientes de aprobación':'No hay normas archivadas'}</div>
            ${normasTab==='activas'?`<button class="btn btn-primary" style="margin-top:8px" id="btn-new-norma-2">Proponer la primera</button>`:''}
          </div>`:
          current.map(n=>renderNormaCard(n, alters)).join('')
        }
      </div>
    </div>`;

  // Tab switch
  app.querySelectorAll('[data-tab]').forEach(t=>t.addEventListener('click',()=>{
    normasTab=t.dataset.tab; renderNormasView();
  }));

  // New norma buttons
  app.querySelectorAll('#btn-new-norma,#btn-new-norma-2').forEach(b=>
    b?.addEventListener('click',()=>openNormaModal(null))
  );

  wireNormaCards(app, alters);
}

function renderNormaCard(n, alters) {
  const proposer = alters.find(a=>a.id===n.proposerId);
  const pri      = PRIORITIES.find(p=>p.id===n.priority)||PRIORITIES[1];
  const d        = new Date(n.ts);
  const dateStr  = d.toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'});

  // Votes
  const votesYes = (n.votes||[]).filter(v=>v.vote==='yes');
  const votesNo  = (n.votes||[]).filter(v=>v.vote==='no');
  const total    = votesYes.length + votesNo.length;
  const myVote   = (n.votes||[]).find(v=>v.alterId===activeAlter.id)?.vote||null;
  const pctYes   = total>0?Math.round((votesYes.length/total)*100):0;
  const pctNo    = total>0?Math.round((votesNo.length/total)*100):0;

  return `<div class="norma-card ${n.status}" data-nid="${n.id}">
    <div class="norma-card-top">
      <div class="norma-priority ${n.priority}">${pri.emoji}</div>
      <div class="norma-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div class="norma-title">${escNorma(n.title)}</div>
          <span class="norma-status-badge ${n.status}">${n.status}</span>
        </div>
        ${n.desc?`<div class="norma-desc">${escNorma(n.desc)}</div>`:''}
        <div class="norma-meta">
          ${proposer?`<div class="norma-proposer">
            <span class="norma-proposer-avatar">${proposer.emoji}</span>
            <span style="color:${proposer.color};font-weight:600">${proposer.name}</span>
          </div>`:''}
          <span class="norma-date">📅 ${dateStr}</span>
          <span class="norma-priority-chip" style="font-family:'DM Mono',monospace;font-size:9px;color:${pri.color};text-transform:uppercase;letter-spacing:.08em">${n.priority}</span>
        </div>
      </div>
    </div>

    <!-- VOTOS -->
    <div class="norma-votes">
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);min-width:60px">Votos</div>
      <div class="vote-bar-wrap">
        <div class="vote-bar">
          <div class="vote-bar-a" style="width:${pctYes}%"></div>
          <div class="vote-bar-b" style="width:${pctNo}%"></div>
        </div>
        <div class="vote-labels">
          <span style="color:var(--green)">✓ ${votesYes.length}</span>
          <span style="color:var(--text-3)">${total} voto${total!==1?'s':''}</span>
          <span style="color:var(--red)">✕ ${votesNo.length}</span>
        </div>
      </div>
      <div style="display:flex;gap:5px">
        <div class="vote-avatars">
          ${votesYes.slice(0,3).map(v=>{const a=alters.find(x=>x.id===v.alterId);return`<div class="vote-avatar" style="background:${a?.bg||'var(--bg-2)'};border-color:${a?.color||'transparent'}" title="${a?.name||'?'} ✓">${a?.emoji||'◎'}</div>`;}).join('')}
        </div>
      </div>
      ${n.status!=='archivada'?`
      <div style="display:flex;gap:5px;margin-left:auto">
        <div class="vote-btn${myVote==='yes'?' voted-yes':''}" data-vote="yes" data-nid="${n.id}">✓ A favor</div>
        <div class="vote-btn${myVote==='no'?' voted-no':''}" data-vote="no" data-nid="${n.id}">✕ En contra</div>
      </div>`:''}
    </div>

    <!-- ACCIONES -->
    <div class="norma-actions">
      ${n.proposerId===activeAlter.id||isAdmin()?`<button class="btn btn-ghost btn-sm btn-edit-norma" data-nid="${n.id}">✎ Editar</button>`:''}
      ${isAdmin()&&n.status==='pendiente'?`<button class="btn btn-primary btn-sm btn-aprobar" data-nid="${n.id}">✓ Aprobar</button>`:''}
      ${isAdmin()&&n.status==='activa'?`<button class="btn btn-ghost btn-sm btn-archivar" data-nid="${n.id}">↓ Archivar</button>`:''}
      ${isAdmin()&&n.status==='archivada'?`<button class="btn btn-ghost btn-sm btn-restaurar" data-nid="${n.id}">↑ Restaurar</button>`:''}
      ${isAdmin()||n.proposerId===activeAlter.id?`<button class="btn btn-danger btn-sm btn-del-norma" data-nid="${n.id}">✕</button>`:''}
    </div>
  </div>`;
}

function escNorma(t) {
  return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function wireNormaCards(app, alters) {
  // Vote buttons
  app.querySelectorAll('.vote-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const normas = loadNormas();
    const n = normas.find(x=>x.id===btn.dataset.nid);
    if(!n) return;
    if(!n.votes) n.votes=[];
    const existing = n.votes.findIndex(v=>v.alterId===activeAlter.id);
    const newVote  = btn.dataset.vote;
    if(existing>=0){
      // Toggle off if same vote, else change
      if(n.votes[existing].vote===newVote) n.votes.splice(existing,1);
      else n.votes[existing].vote=newVote;
    } else {
      n.votes.push({alterId:activeAlter.id, vote:newVote, ts:Date.now()});
    }
    saveNormas(normas);
    renderNormasView();
    showToast(newVote==='yes'?'Voto a favor registrado ✓':'Voto en contra registrado');
  }));

  // Edit
  app.querySelectorAll('.btn-edit-norma').forEach(b=>b.addEventListener('click',()=>{
    const n=loadNormas().find(x=>x.id===b.dataset.nid);
    if(n) openNormaModal(n);
  }));

  // Admin: Aprobar
  app.querySelectorAll('.btn-aprobar').forEach(b=>b.addEventListener('click',()=>{
    const normas=loadNormas();
    const n=normas.find(x=>x.id===b.dataset.nid);
    if(n){ n.status='activa'; n.approvedBy=activeAlter.id; n.approvedTs=Date.now(); saveNormas(normas); }
    showToast('Norma aprobada ✓');
    renderNormasView();
  }));

  // Admin: Archivar
  app.querySelectorAll('.btn-archivar').forEach(b=>b.addEventListener('click',()=>{
    const normas=loadNormas();
    const n=normas.find(x=>x.id===b.dataset.nid);
    if(n){ n.status='archivada'; saveNormas(normas); }
    showToast('Norma archivada');
    normasTab='archivadas';
    renderNormasView();
  }));

  // Admin: Restaurar
  app.querySelectorAll('.btn-restaurar').forEach(b=>b.addEventListener('click',()=>{
    const normas=loadNormas();
    const n=normas.find(x=>x.id===b.dataset.nid);
    if(n){ n.status='activa'; saveNormas(normas); }
    showToast('Norma restaurada ✓');
    normasTab='activas';
    renderNormasView();
  }));

  // Delete
  app.querySelectorAll('.btn-del-norma').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('¿Eliminar esta norma?')) return;
    saveNormas(loadNormas().filter(x=>x.id!==b.dataset.nid));
    showToast('Norma eliminada');
    renderNormasView();
  }));
}

function openNormaModal(norma) {
  const isEdit = !!norma;
  const n = norma || {title:'',desc:'',priority:'media',status:'pendiente',proposerId:activeAlter.id};

  openModal(`
    <div class="modal-title">${isEdit?'Editar norma':'Proponer norma'}</div>
    ${!isEdit&&!isAdmin()?`<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent-4);padding:8px 12px;background:rgba(255,180,80,.07);border-radius:8px;border:1px solid rgba(255,180,80,.2)">
      ⏳ Tu propuesta quedará pendiente de aprobación por el alter admin.
    </div>`:''}
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título de la norma</div>
        <input type="text" id="n-title" placeholder="Ej: No interrumpir durante terapia" value="${escNorma(n.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción (opcional)</div>
        <textarea id="n-desc" placeholder="Contexto, motivo, cómo aplicar esta norma...">${escNorma(n.desc||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Prioridad</div>
        <div class="priority-opts">
          ${PRIORITIES.map(p=>`
            <div class="priority-opt${n.priority===p.id?' selected':''} ${p.id}" data-pri="${p.id}">
              <div style="font-size:18px">${p.emoji}</div>
              <div class="priority-opt-label">${p.label}</div>
            </div>`).join('')}
        </div>
        <input type="hidden" id="n-priority" value="${n.priority||'media'}">
      </div>
      ${isEdit&&isAdmin()?`
      <div class="form-row">
        <div class="form-label">Estado</div>
        <select id="n-status">
          <option value="pendiente" ${n.status==='pendiente'?'selected':''}>⏳ Pendiente</option>
          <option value="activa"    ${n.status==='activa'?'selected':''}>✓ Activa</option>
          <option value="archivada" ${n.status==='archivada'?'selected':''}>↓ Archivada</option>
        </select>
      </div>`:''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Proponer'}</button>
    </div>`,
    (ov) => {
      const title    = ov.querySelector('#n-title').value.trim();
      const desc     = ov.querySelector('#n-desc').value.trim();
      const priority = ov.querySelector('#n-priority').value;
      const status   = ov.querySelector('#n-status')?.value ||
                       (isEdit ? n.status : (isAdmin()?'activa':'pendiente'));
      if(!title) return showToast('⚠ El título es obligatorio');

      let list = loadNormas();
      const entry = {
        id: n.id||uid(),
        title, desc, priority, status,
        proposerId: n.proposerId||activeAlter.id,
        ts: n.ts||Date.now(),
        votes: n.votes||[],
        approvedBy: status==='activa'&&!n.approvedBy ? activeAlter.id : n.approvedBy,
        approvedTs: status==='activa'&&!n.approvedTs ? Date.now() : n.approvedTs,
      };
      if(isEdit) list=list.map(x=>x.id===n.id?entry:x);
      else { list.push(entry); normasTab=isAdmin()?'activas':'pendientes'; }
      saveNormas(list);
      closeModal();
      showToast(isEdit?'Norma actualizada ✓':isAdmin()?'Norma creada y activada ✓':'Norma propuesta — pendiente de aprobación');
      renderNormasView();
    }
  );

  // Priority opts
  const ov = document.querySelector('.modal-overlay');
  ov.querySelectorAll('.priority-opt').forEach(opt=>opt.addEventListener('click',()=>{
    ov.querySelectorAll('.priority-opt').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected');
    ov.querySelector('#n-priority').value=opt.dataset.pri;
  }));
}

// ═══════════════════════════════════════════════
