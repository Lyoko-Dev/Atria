const PRIORITIES = [
  {id:'alta',  label:'High',  emoji:'⚠', color:'var(--red)'},
  {id:'media', label:'Medium', emoji:'●', color:'var(--accent-4)'},
  {id:'baja',  label:'Low',  emoji:'○', color:'var(--accent-3)'},
];

let normasTab = 'activas'; // activas | pendientes | archivadas

function loadNormas()   { try { return JSON.parse(localStorage.getItem('tid_normas'))||[]; } catch{return[];} }
function saveNormas(n)  { localStorage.setItem('tid_normas', JSON.stringify(n)); }
function loadPolls()    { try { return JSON.parse(localStorage.getItem('tid_polls'))||[]; } catch{return[];} }
function savePolls(p)   { localStorage.setItem('tid_polls', JSON.stringify(p)); }

function isAdmin() { return activeAlter?.isAdmin === true; }

function renderNormas() {
  if (activeAlter && activeAlter.permissions !== undefined && !activeAlter.permissions?.normas) {
    document.getElementById('app').innerHTML = `<div class="empty-state" style="margin-top:60px"><div class="empty-icon">🔒</div><div>You do not have permission to access Rules</div></div>`;
    setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Rules'}]);
    return;
  }
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Rules'}]);
  renderNormasView();
}

function renderPolls() {
  if (activeAlter && activeAlter.permissions !== undefined && !activeAlter.permissions?.normas) {
    document.getElementById('app').innerHTML = `<div class="empty-state" style="margin-top:60px"><div class="empty-icon">🔒</div><div>You do not have permission to access Polls</div></div>`;
    setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Polls'}]);
    return;
  }
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Polls'}]);
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
          <div class="fin-title">◎ Polls</div>
          <div class="fin-subtitle">${polls.length} poll${polls.length!==1?'s':''} · ${activePolls.length} active</div>
        </div>
        <button class="btn btn-primary" id="btn-new-poll">+ New poll</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(255,213,128,.07);border:1px solid rgba(255,213,128,.2);border-radius:var(--radius);font-size:12px;color:var(--text-1)">
        <span style="font-size:16px">◎</span>
        <span>Polls are separate from Rules and are shared online only when each poll is marked as shareable.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px" id="polls-list">
        ${activePolls.length===0?`
          <div class="empty-state" style="padding:50px 20px">
            <div class="empty-icon">◎</div>
            <div>No active polls</div>
            <button class="btn btn-primary" style="margin-top:8px" id="btn-new-poll-2">Create the first one</button>
          </div>`:
          activePolls.map(p=>renderPollCard(p, alters)).join('')
        }
        ${archivedPolls.length?`
          <div class="diario-month-label" style="margin-top:4px"><span>Archived</span><span>${archivedPolls.length}</span></div>
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
          <div class="fin-title">◳ System rules</div>
          <div class="fin-subtitle">${todas.length} rule${todas.length!==1?'s':''} total · ${byTab.activas.length} active</div>
        </div>
        <button class="btn btn-primary" id="btn-new-norma">+ Propose rule</button>
      </div>

      <!-- Info banner para no-admin -->
      ${!isAdmin()?`<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(138,180,255,.07);border:1px solid rgba(138,180,255,.2);border-radius:var(--radius);font-size:12px;color:var(--text-1)">
        <span style="font-size:16px">ℹ️</span>
        <span>You can propose rules and vote. Only the admin alter can approve or archive them.</span>
      </div>`:''}

      <!-- TABS -->
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="normas-tabs">
          ${[
            {id:'activas',    label:'Active'},
            {id:'pendientes', label:'Pending approval'},
            {id:'archivadas', label:'Archived'},
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
            <div>${normasTab==='activas'?'No active rules yet':normasTab==='pendientes'?'No rules pending approval':'No archived rules'}</div>
            ${normasTab==='activas'?`<button class="btn btn-primary" style="margin-top:8px" id="btn-new-norma-2">Propose the first one</button>`:''}
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
  const dateStr  = d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});

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
          <span style="color:var(--text-3)">${total} vote${total!==1?'s':''}</span>
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
      ${n.proposerId===activeAlter.id||isAdmin()?`<button class="btn btn-ghost btn-sm btn-edit-norma" data-nid="${n.id}">✎ Edit</button>`:''}
      ${isAdmin()&&n.status==='pendiente'?`<button class="btn btn-primary btn-sm btn-aprobar" data-nid="${n.id}">✓ Approve</button>`:''}
      ${isAdmin()&&n.status==='activa'?`<button class="btn btn-ghost btn-sm btn-archivar" data-nid="${n.id}">↓ Archive</button>`:''}
      ${isAdmin()&&n.status==='archivada'?`<button class="btn btn-ghost btn-sm btn-restaurar" data-nid="${n.id}">↑ Restore</button>`:''}
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
    showToast(newVote==='yes'?'Vote in favor registered ✓':'Vote against registered');
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
    showToast('Rule approved ✓');
    renderNormasView();
  }));

  // Admin: Archivar
  app.querySelectorAll('.btn-archivar').forEach(b=>b.addEventListener('click',()=>{
    const normas=loadNormas();
    const n=normas.find(x=>x.id===b.dataset.nid);
    if(n){ n.status='archivada'; saveNormas(normas); }
    showToast('Rule archived');
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
    if(!confirm('Delete this rule?')) return;
    saveNormas(loadNormas().filter(x=>x.id!==b.dataset.nid));
    showToast('Rule deleted');
    renderNormasView();
  }));
}

function openNormaModal(norma) {
  const isEdit = !!norma;
  const n = norma || {title:'',desc:'',priority:'media',status:'pendiente',proposerId:activeAlter.id};

  openModal(`
    <div class="modal-title">${isEdit?'Edit rule':'Propose rule'}</div>
    ${!isEdit&&!isAdmin()?`<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent-4);padding:8px 12px;background:rgba(255,180,80,.07);border-radius:8px;border:1px solid rgba(255,180,80,.2)">
      ⏳ Your proposal will remain pending approval by the admin alter.
    </div>`:''}
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Rule title</div>
        <input type="text" id="n-title" placeholder="E.g. Do not interrupt during therapy" value="${escNorma(n.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Description (optional)</div>
        <textarea id="n-desc" placeholder="Context, reason, how to apply this rule...">${escNorma(n.desc||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Priority</div>
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
        <div class="form-label">Status</div>
        <select id="n-status">
          <option value="pendiente" ${n.status==='pendiente'?'selected':''}>⏳ Pending</option>
          <option value="activa"    ${n.status==='activa'?'selected':''}>✓ Active</option>
          <option value="archivada" ${n.status==='archivada'?'selected':''}>↓ Archived</option>
        </select>
      </div>`:''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Propose'}</button>
    </div>`,
    (ov) => {
      const title    = ov.querySelector('#n-title').value.trim();
      const desc     = ov.querySelector('#n-desc').value.trim();
      const priority = ov.querySelector('#n-priority').value;
      const status   = ov.querySelector('#n-status')?.value ||
                       (isEdit ? n.status : (isAdmin()?'activa':'pendiente'));
      if(!title) return showToast('⚠ Title is required');

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
      showToast(isEdit?'Rule updated ✓':isAdmin()?'Rule created and activated ✓':'Proposed rule — pending approval');
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
