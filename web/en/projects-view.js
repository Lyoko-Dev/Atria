
function renderProyectos() {
  if (activeAlter && activeAlter.permissions !== undefined && !activeAlter.permissions?.proyectos) {
    document.getElementById('app').innerHTML = `<div class="empty-state" style="margin-top:60px"><div class="empty-icon">🔒</div><div>You do not have permission to access Projects</div></div>`;
    setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Projects'}]);
    return;
  }
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Projects'}]);
  if(!activeProyId) {
    const ps=loadProyectos(); if(ps.length) activeProyId=ps[0].id;
  }
  if(proyTab==='responsabilidades') renderRespoPanel();
  else renderProyView();
}

function renderProyView() {
  const app    = document.getElementById('app');
  const alters = getAlters();
  const proyectos = loadProyectos();
  const active = proyectos.find(p=>p.id===activeProyId);

  app.innerHTML = `
    <div class="proy-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◉ Projects</div>
          <div class="fin-subtitle">${proyectos.length} project${proyectos.length!==1?'s':''} · ${proyectos.filter(p=>p.status==='activo').length} active</div>
        </div>
        <button class="btn btn-primary" id="btn-new-proy">+ New project</button>
      </div>
      <div class="mem-tabs" style="margin-bottom:4px">
        <div class="mem-tab${proyTab==='proyectos'?' active':''}" data-ptab="proyectos">◉ Projects</div>
        <div class="mem-tab${proyTab==='responsabilidades'?' active':''}" data-ptab="responsabilidades">◈ Responsibilities</div>
      </div>

      <div class="proy-layout">
        <!-- PANEL IZQUIERDO: lista de proyectos -->
        <div class="proy-panel">
          ${proyectos.filter(p=>p.status!=='archivado').map(p=>renderProyCard(p,alters)).join('')}
          ${proyectos.filter(p=>p.status==='archivado').length?`
            <details style="margin-top:4px">
              <summary style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);cursor:pointer;padding:6px 2px;letter-spacing:.1em;text-transform:uppercase">
                ↓ Archived (${proyectos.filter(p=>p.status==='archivado').length})
              </summary>
              <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
                ${proyectos.filter(p=>p.status==='archivado').map(p=>renderProyCard(p,alters)).join('')}
              </div>
            </details>`:''}
          <div class="proy-add-card" id="btn-add-proy-inline">+ New project</div>
        </div>

        <!-- PANEL DERECHO: tareas del proyecto activo -->
        <div id="task-panel-wrap">
          ${active ? renderTaskPanel(active, alters) :
            `<div class="task-panel"><div class="task-empty">
              <div class="task-empty-icon">◉</div>
              <div>Select or create a new project</div>
              <button class="btn btn-primary" style="margin-top:8px" id="btn-new-proy-2">Create first project</button>
            </div></div>`}
        </div>
      </div>
    </div>`;

  // New project
  app.querySelectorAll('#btn-new-proy,#btn-add-proy-inline,#btn-new-proy-2').forEach(b=>
    b?.addEventListener('click',()=>openProyModal(null))
  );

  // Project card clicks
  app.querySelectorAll('.proy-card[data-pid]').forEach(card=>card.addEventListener('click',e=>{
    if(e.target.closest('.proy-card-actions')) return;
    activeProyId=card.dataset.pid; renderProyView();
  }));

  app.querySelectorAll('[data-ptab]').forEach(t=>t.addEventListener('click',()=>{
    proyTab=t.dataset.ptab; renderProyectos();
  }));

  wireProyActions(app, alters);
  wireTaskPanel(app, active, alters);
}

function renderRespoPanel() {
  const app    = document.getElementById('app');
  const alters = getAlters();
  const proyectos = loadProyectos();
  const tareas    = loadTareas();
  const today     = new Date().toISOString().slice(0,10);
  const STATUS_LABEL = {pendiente:'Pending','en-progreso':'In progress',completada:'Done',bloqueada:'Blocked'};
  const STATUS_COLOR = {pendiente:'var(--text-2)','en-progreso':'var(--accent-4)',completada:'var(--green)',bloqueada:'var(--red)'};
  const PRIO_LABEL   = {alta:'⚠ High',media:'● Medium',baja:'○ Low'};
  const PRIO_COLOR   = {alta:'var(--red)',media:'var(--accent-4)',baja:'var(--text-3)'};
  const proyName     = id => proyectos.find(p=>p.id===id)?.name || '—';

  app.innerHTML = `
    <div class="proy-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◉ Projects</div>
          <div class="fin-subtitle">${proyectos.length} project${proyectos.length!==1?'s':''} · ${proyectos.filter(p=>p.status==='activo').length} active</div>
        </div>
        <button class="btn btn-primary" id="btn-new-proy">+ New project</button>
      </div>
      <div class="mem-tabs" style="margin-bottom:4px">
        <div class="mem-tab" data-ptab="proyectos">◉ Projects</div>
        <div class="mem-tab active" data-ptab="responsabilidades">◈ Responsibilities</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:20px;margin-top:8px">
        ${alters.map(alter=>{
          const myProys  = proyectos.filter(p=>p.responsableId===alter.id && p.status!=='archivado');
          const myTareas = tareas.filter(t=>t.assigneeId===alter.id && t.status!=='completada');
          if(!myProys.length && !myTareas.length) return '';
          return `
            <div class="card" style="padding:14px 16px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <div style="font-size:20px">${alter.emoji||'●'}</div>
                <div style="font-weight:700;font-size:15px">${esc(alter.name)}</div>
                <div style="margin-left:auto;font-size:11px;color:var(--text-3)">${myProys.length} project${myProys.length!==1?'s':''} · ${myTareas.length} task${myTareas.length!==1?'s':''}</div>
              </div>
              ${myProys.length ? `
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin-bottom:6px;font-family:'DM Mono',monospace">Responsible for projects</div>
                <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
                  ${myProys.map(p=>{
                    const prog = proyProgress(p.id);
                    const overdue = p.deadline && p.deadline<today && p.status==='activo';
                    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface-2);border-radius:8px">
                      <div style="width:8px;height:8px;border-radius:50%;background:${p.color||'var(--accent-4)'}"></div>
                      <div style="flex:1;font-size:13px">${p.name}</div>
                      ${p.deadline?`<div style="font-size:11px;color:${overdue?'var(--red)':'var(--text-3)'}">${overdue?'⚠ ':''} ${p.deadline}</div>`:''}
                      <div style="font-size:11px;color:var(--text-2)">${prog.done}/${prog.total}</div>
                    </div>`;}).join('')}
                </div>` : ''}
              ${myTareas.length ? `
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin-bottom:6px;font-family:'DM Mono',monospace">Assigned tasks</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                  ${myTareas.map(t=>{
                    const overdue = t.deadline && t.deadline<today;
                    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface-2);border-radius:8px">
                      <div style="flex:1">
                        <div style="font-size:13px">${t.title}</div>
                        <div style="font-size:11px;color:var(--text-3)">${proyName(t.proyId)}</div>
                      </div>
                      ${t.priority?`<div style="font-size:11px;color:${PRIO_COLOR[t.priority]||'var(--text-2)'}">${PRIO_LABEL[t.priority]||t.priority}</div>`:''}
                      ${t.deadline?`<div style="font-size:11px;color:${overdue?'var(--red)':'var(--text-3)'}">${overdue?'⚠ ':''} ${t.deadline}</div>`:''}
                      <div style="font-size:11px;color:${STATUS_COLOR[t.status]||'var(--text-2)'}">${STATUS_LABEL[t.status]||t.status}</div>
                    </div>`;}).join('')}
                </div>` : ''}
            </div>`;
        }).filter(Boolean).join('') || `<div class="empty-state" style="padding:60px 20px"><div class="empty-icon">◎</div><div>No alter has assigned projects or tasks</div></div>`}
      </div>
    </div>`;

  app.querySelector('#btn-new-proy')?.addEventListener('click',()=>openProyModal(null));
  app.querySelectorAll('[data-ptab]').forEach(t=>t.addEventListener('click',()=>{
    proyTab=t.dataset.ptab; renderProyectos();
  }));
}

function renderProyCard(p, alters) {
  const prog = proyProgress(p.id);
  const resp = alters.find(a=>a.id===p.responsableId);
  const today = new Date().toISOString().slice(0,10);
  const overdue = p.deadline && p.deadline<today && p.status==='activo';
  const isActive = p.id===activeProyId;

  return `<div class="proy-card${p.status==='archivado'?' archivado':''}${isActive?' active-proj':''}" data-pid="${p.id}">
    <div class="proy-card-accent" style="background:${p.color||'var(--accent)'}"></div>
    <div class="proy-card-body">
      <div class="proy-card-header">
        <div class="proy-card-name">${escP(p.name)}</div>
        <span class="proy-card-status proy-status-${p.status}">${p.status}</span>
      </div>
      ${p.desc?`<div style="font-size:11px;color:var(--text-2);line-height:1.45">${escP(p.desc)}</div>`:''}
      <div class="proy-progress-wrap">
        <div class="proy-progress-bar">
          <div class="proy-progress-fill" style="width:${prog.pct}%;background:${p.color||'var(--accent)'}"></div>
        </div>
        <div class="proy-progress-label">
          <span>${prog.done}/${prog.total} tasks</span>
          <span>${prog.pct}%</span>
        </div>
      </div>
      <div class="proy-card-meta">
        ${resp?`<span class="proy-meta-item">${resp.emoji} ${resp.name}</span>`:''}
        ${p.deadline?`<span class="proy-meta-item${overdue?' overdue':''}">⏱ ${fmtDate(p.deadline)}</span>`:''}
        <div class="proy-card-actions" style="margin-left:auto;display:flex;gap:3px;opacity:0;transition:opacity var(--transition)">
          <button class="icon-btn btn-edit-proy" data-pid="${p.id}" title="Edit">✎</button>
          <button class="icon-btn btn-del-proy" data-pid="${p.id}" title="Delete">✕</button>
        </div>
      </div>
+    </div>
  </div>`;
}

function renderTaskPanel(p, alters) {
  const tareas  = loadTareas().filter(t=>t.proyId===p.id);
  const prog    = proyProgress(p.id);
  const resp    = alters.find(a=>a.id===p.responsableId);
  const today   = new Date().toISOString().slice(0,10);

  // Group by status
  const groups = [
    {id:'en-progreso', label:'In progress', color:'var(--accent-4)', icon:'⏳'},
    {id:'pendiente',   label:'Pending',   color:'var(--text-2)',  icon:'○'},
    {id:'bloqueada',   label:'Blocked',   color:'var(--red)',     icon:'✕'},
    {id:'completada',  label:'Completed',  color:'var(--green)',   icon:'✓'},
  ];

  return `<div class="task-panel">
    <div class="task-panel-header">
      <div>
        <div class="task-panel-title" style="color:${p.color||'var(--text-0)'}">${escP(p.name)}</div>
        ${p.desc?`<div class="task-panel-desc">${escP(p.desc)}</div>`:''}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" id="btn-task-templates">Templates</button>
        <button class="btn btn-primary btn-sm" id="btn-new-task">+ Task</button>
      </div>
    </div>
    <div class="task-panel-meta">
      <span class="proy-card-status proy-status-${p.status}">${p.status}</span>
      ${resp?`<span style="font-size:12px;color:var(--text-2)">${resp.emoji} ${resp.name}</span>`:''}
      ${p.deadline?`<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">⏱ ${fmtDate(p.deadline)}</span>`:''}
      <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-left:auto">${prog.pct}% · ${prog.done}/${prog.total}</span>
      <button class="btn btn-ghost btn-sm btn-edit-proy" data-pid="${p.id}" style="padding:3px 8px">✎ Edit project</button>
    </div>
    ${renderProjectResources(p)}
    ${renderQuickTaskCapture()}
    <div class="task-groups">
      ${groups.map(g=>{
        const items = tareas.filter(t=>t.status===g.id).sort((a,b)=>{
          const po={alta:0,media:1,baja:2};
          return (a.order??999999)-(b.order??999999)||(po[a.priority]??1)-(po[b.priority]??1)||(a.ts-b.ts);
        });
        const collapsed = collapsedGroups[p.id+'_'+g.id];
        if(items.length===0 && g.id!=='pendiente') return '';
        return `<div class="task-group">
          <div class="task-group-header" data-grp="${g.id}">
            <div class="task-group-label" style="color:${g.color}">
              ${g.icon} ${g.label}
              <span class="task-group-count">${items.length}</span>
            </div>
            <span class="task-group-toggle${collapsed?'':' open'}">▶</span>
          </div>
          ${collapsed?'':
            `<div class="task-items">
              ${items.length===0?`<div style="padding:12px 20px;font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3)">No tasks here</div>`:''}
              ${items.map(t=>renderTaskItem(t,alters,today)).join('')}
            </div>`}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderProjectResources(project) {
  const notes = project.notes ? `<div class="project-resource-notes">${escP(project.notes).replace(/\n/g,'<br>')}</div>` : `<span style="color:var(--text-3)">No notes</span>`;
  const docs = (project.documents||[]).map(d=>`<a class="project-resource-link" href="${escP(d.url)}" target="_blank" rel="noopener noreferrer">↗ ${escP(d.name||d.url)}</a>`).join('') || `<span style="color:var(--text-3)">No documents</span>`;
  return `<div class="project-resources"><div><div class="project-resource-label">Notes</div>${notes}</div><div><div class="project-resource-label">Documents</div><div class="project-resource-links">${docs}</div></div></div>`;
}

function renderQuickTaskCapture() {
  return `<div class="quick-task-capture" style="display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--bg-2);margin:12px 0">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input id="quick-task-input" class="input" type="text" autocomplete="off" placeholder="Quick capture: call Ana #health @Luna !tomorrow !high" style="flex:1;min-width:min(220px,100%)">
      <button class="btn btn-primary btn-sm" id="btn-quick-task-add">+ Task</button>
    </div>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      ${[['today','Today'],['soon','Soon'],['later','Later']].map(([id,label])=>`<button class="btn btn-ghost btn-sm quick-task-bucket${quickTaskBucket===id?' active':''}" data-qbucket="${id}" style="${quickTaskBucket===id?'border-color:var(--accent);color:var(--accent)':''}">${label}</button>`).join('')}
      <span style="font-size:11px;color:var(--text-3)">Use #tags, @alter, !today, !tomorrow, !soon, !later, !high</span>
    </div>
  </div>`;
}

function renderTaskItem(t, alters, today) {
  const assignee = alters.find(a=>a.id===t.assigneeId);
  const pri      = PRIORITIES.find(p=>p.id===t.priority)||PRIORITIES[1];
  const priColor = {alta:'var(--red)',media:'var(--accent-4)',baja:'var(--accent-3)'}[t.priority]||'var(--text-2)';
  const overdue  = t.deadline && t.deadline<today && t.status!=='completada';
  const isDone   = t.status==='completada';

  return `<div class="task-item" data-tid="${t.id}" draggable="true" title="Drag to reorder">
    <div class="task-check ${isDone?'done':t.status==='bloqueada'?'bloqueada':t.status==='en-progreso'?'en-progreso':''}" data-chk="${t.id}"></div>
    <div class="task-item-body">
      <div class="task-item-title${isDone?' done':''}" style="${t.parentId?'padding-left:14px;border-left:2px solid var(--accent)':''}">${t.parentId?'↳ ':''}${escP(t.title)}</div>
      ${t.desc?`<div class="task-item-desc">${escP(t.desc)}</div>`:''}
      <div class="task-item-meta">
        <div class="task-priority-dot" style="background:${priColor}" title="${pri.label}"></div>
        ${assignee?`<span class="task-assignee" title="${assignee.name}">${assignee.emoji}</span>`:''}
        ${t.category?`<span class="task-deadline" style="color:var(--accent)">${escP(t.category)}</span>`:''}
        ${(t.tags||[]).slice(0,3).map(tag=>`<span class="task-deadline">#${escP(tag)}</span>`).join('')}
        ${t.deadline?`<span class="task-deadline${overdue?' overdue':''}">⏱ ${fmtDate(t.deadline)}</span>`:''}
      </div>
    </div>
    <div class="task-item-actions">
      <button class="icon-btn btn-move-task" data-tid="${t.id}" data-dir="-1" title="Move up" aria-label="Move task up">↑</button>
      <button class="icon-btn btn-move-task" data-tid="${t.id}" data-dir="1" title="Move down" aria-label="Move task down">↓</button>
      <button class="icon-btn btn-edit-task" data-tid="${t.id}" title="Edit">✎</button>
      <button class="icon-btn btn-del-task"  data-tid="${t.id}" title="Delete">✕</button>
    </div>
  </div>`;
}

function escP(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function wireProyActions(app, alters) {
  // Hover visibility for proy-card-actions
  app.querySelectorAll('.proy-card').forEach(card=>{
    const acts=card.querySelector('.proy-card-actions');
    if(acts){ card.addEventListener('mouseenter',()=>acts.style.opacity='1'); card.addEventListener('mouseleave',()=>acts.style.opacity='0'); }
  });
  app.querySelectorAll('.btn-edit-proy').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const p=loadProyectos().find(x=>x.id===b.dataset.pid); if(p) openProyModal(p);
  }));
  app.querySelectorAll('.btn-del-proy').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(!confirm('Delete project and all tasks?')) return;
    saveProyectos(loadProyectos().filter(x=>x.id!==b.dataset.pid));
    saveTareas(loadTareas().filter(t=>t.proyId!==b.dataset.pid));
    if(activeProyId===b.dataset.pid) activeProyId=loadProyectos()[0]?.id||null;
    showToast('Project deleted'); renderProyView();
  }));
}

function wireTaskPanel(app, active, alters) {
  if(!active) return;

  app.querySelectorAll('.btn-move-task').forEach(btn=>btn.addEventListener('click', e=>{
    e.stopPropagation(); const all=loadTareas(), current=all.find(t=>t.id===btn.dataset.tid); if(!current) return;
    const group=all.filter(t=>t.proyId===current.proyId&&t.status===current.status).sort((a,b)=>(a.order??999999)-(b.order??999999)||(a.ts-b.ts));
    const index=group.findIndex(t=>t.id===current.id), next=index+Number(btn.dataset.dir); if(index<0||next<0||next>=group.length)return;
    [group[index],group[next]]=[group[next],group[index]]; group.forEach((t,i)=>{t.order=i;}); saveTareas(all); renderProyView();
  }));
  let draggedTaskId = null;
  app.querySelectorAll('.task-item[draggable="true"]').forEach(item=>{
    item.addEventListener('dragstart', e=>{ draggedTaskId=item.dataset.tid; item.classList.add('is-dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', draggedTaskId); });
    item.addEventListener('dragend', ()=>{ draggedTaskId=null; item.classList.remove('is-dragging'); app.querySelectorAll('.task-item').forEach(x=>x.classList.remove('drag-over')); });
    item.addEventListener('dragover', e=>{ if(!draggedTaskId||draggedTaskId===item.dataset.tid)return; e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', ()=>item.classList.remove('drag-over'));
    item.addEventListener('drop', e=>{ e.preventDefault(); item.classList.remove('drag-over'); const all=loadTareas(), from=all.find(t=>t.id===draggedTaskId), to=all.find(t=>t.id===item.dataset.tid); if(!from||!to||from.proyId!==to.proyId||from.status!==to.status)return; const group=all.filter(t=>t.proyId===to.proyId&&t.status===to.status).sort((a,b)=>(a.order??999999)-(b.order??999999)||(a.ts-b.ts)); const fi=group.findIndex(t=>t.id===from.id), ti=group.findIndex(t=>t.id===to.id); if(fi<0||ti<0)return; group.splice(fi,1); group.splice(ti,0,from); group.forEach((t,i)=>{t.order=i;}); saveTareas(all); renderProyView(); });
  });

  // New task button
  app.querySelector('#btn-new-task')?.addEventListener('click',()=>openTaskModal(null, active.id, alters));
  app.querySelector('#btn-task-templates')?.addEventListener('click',()=>openTemplatesModal('task', {proyId: active.id}));

  app.querySelectorAll('[data-qbucket]').forEach(btn=>btn.addEventListener('click',()=>{
    quickTaskBucket = btn.dataset.qbucket;
    renderProyView();
    setTimeout(()=>document.getElementById('quick-task-input')?.focus(), 0);
  }));
  const addQuickTask = () => {
    const input = app.querySelector('#quick-task-input');
    const parsed = parseQuickTaskInput(input?.value || '', alters, quickTaskBucket);
    if (!parsed) return showToast('Warning: Write a task');
    const list = loadTareas();
    list.push({id:uid(),proyId:active.id,title:parsed.title,desc:'',assigneeId:parsed.assigneeId,status:'pendiente',priority:parsed.priority,deadline:parsed.deadline,tags:parsed.tags,category:'General',parentId:null,ts:Date.now()});
    saveTareas(list);
    if (input) input.value = '';
    showToast('Task captured');
    renderProyView();
  };
  app.querySelector('#btn-quick-task-add')?.addEventListener('click', addQuickTask);
  app.querySelector('#quick-task-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addQuickTask(); }
  });

  // Group collapse
  app.querySelectorAll('[data-grp]').forEach(hdr=>hdr.addEventListener('click',()=>{
    const key=active.id+'_'+hdr.dataset.grp;
    collapsedGroups[key]=!collapsedGroups[key];
    renderProyView();
  }));

  // Checkbox quick toggle (pending ↔ completed)
  app.querySelectorAll('[data-chk]').forEach(chk=>chk.addEventListener('click',e=>{
    e.stopPropagation();
    const ts=loadTareas(); const t=ts.find(x=>x.id===chk.dataset.chk);
    if(!t) return;
    t.status=t.status==='completada'?'pendiente':'completada';
    saveTareas(ts); renderProyView();
  }));

  // Task click → detail/edit
  app.querySelectorAll('.task-item').forEach(item=>item.addEventListener('click',e=>{
    if(e.target.closest('.task-item-actions,[data-chk]')) return;
    const t=loadTareas().find(x=>x.id===item.dataset.tid);
    if(t) openTaskModal(t, active.id, alters);
  }));

  // Edit task
  app.querySelectorAll('.btn-edit-task').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const t=loadTareas().find(x=>x.id===b.dataset.tid);
    if(t) openTaskModal(t, active.id, alters);
  }));

  // Delete task
  app.querySelectorAll('.btn-del-task').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const tid = b.dataset.tid;
    const all = loadTareas(); const tarea = all.find(x=>x.id===tid);
    if(!tarea) return;
    saveTareas(all.filter(x=>x.id!==tid)); renderProyView();
    softDelete('Task deleted', ()=>{}, ()=>{ const cur=loadTareas(); cur.push(tarea); saveTareas(cur); renderProyView(); });
  }));
}

// ── MODALES ──
window.AtriaProjectsView = Object.freeze({ render: renderProyectos });
