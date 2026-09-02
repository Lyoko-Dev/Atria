
function renderRutinas() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Rutinas'}]);
  const app = document.getElementById('app');
  const alters = getAlters();
  const date = todayIso();
  const all = loadRoutines().filter(r => routineVisibleToAlter(r, activeAlter?.id));
  const dueToday = all.filter(r => routineDueOnDate(r, date));
  const activeList = all.filter(r => r.active);
  const templates = all.filter(r => !r.active);
  const doneToday = dueToday.filter(r => routineProgress(r, date).done).length;
  const list = rutinasTab === 'hoy' ? dueToday : rutinasTab === 'plantillas' ? templates : activeList;
  const title = rutinasTab === 'hoy' ? 'Rutinas de hoy' : rutinasTab === 'plantillas' ? 'Plantillas' : 'Todas las rutinas';
  const subtitle = rutinasTab === 'hoy'
    ? `${doneToday}/${dueToday.length} completas hoy`
    : rutinasTab === 'plantillas'
      ? `${templates.length} plantilla${templates.length!==1?'s':''} guardadas`
      : rutinasTab === 'adherencia'
        ? `Últimos 30 días`
        : `${activeList.length} rutina${activeList.length!==1?'s':''} activas`;

  app.innerHTML = `
    <div class="proy-view">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div class="fin-title">◎ Rutinas</div>
          <div class="fin-subtitle">${subtitle}</div>
        </div>
        <button class="btn btn-primary" id="btn-new-routine">+ Nueva rutina</button>
      </div>
      <div class="mem-tabs" style="margin-top:14px">
        <div class="mem-tab${rutinasTab==='hoy'?' active':''}" data-rtab="hoy">Hoy</div>
        <div class="mem-tab${rutinasTab==='todas'?' active':''}" data-rtab="todas">Todas</div>
        <div class="mem-tab${rutinasTab==='adherencia'?' active':''}" data-rtab="adherencia">Adherencia</div>
        <div class="mem-tab${rutinasTab==='plantillas'?' active':''}" data-rtab="plantillas">Plantillas</div>
      </div>
      <div class="task-panel" style="margin-top:14px">
        <div class="task-panel-header">
          <div>
            <div class="task-panel-title">${title}</div>
            <div class="task-panel-desc">${rutinasTab==='hoy' ? 'Checklists y hábitos previstos para hoy.' : 'Plantillas reutilizables para organizar la rutina diaria.'}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <span class="proy-card-status proy-status-activo">${dueToday.length} hoy</span>
          <span class="proy-card-status proy-status-pausado">${activeList.length} activas</span>
          <span class="proy-card-status proy-status-completado">${doneToday} completas</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px">
        ${rutinasTab === 'adherencia' ? renderRutinasAdherencia(activeList, date) :
          list.length ? list.map(r => renderRoutineCard(r, alters, date, rutinasTab)).join('') :
          `<div class="task-panel"><div class="task-empty"><div class="task-empty-icon">◎</div><div>No hay elementos en esta vista</div><button class="btn btn-primary" style="margin-top:8px" id="btn-new-routine-empty">Crear rutina</button></div></div>`}
      </div>
    </div>`;

  app.querySelectorAll('.mem-tab[data-rtab]').forEach(tab => tab.addEventListener('click', () => { rutinasTab = tab.dataset.rtab; renderRutinas(); }));
  app.querySelectorAll('#btn-new-routine,#btn-new-routine-empty').forEach(btn => btn?.addEventListener('click', () => openRoutineModal()));
  app.querySelectorAll('[data-routine-edit]').forEach(btn => btn.addEventListener('click', () => {
    const routine = loadRoutines().find(r=>r.id===btn.dataset.routineEdit);
    if (routine) openRoutineModal(routine);
  }));
  app.querySelectorAll('[data-routine-toggle]').forEach(btn => btn.addEventListener('click', () => {
    const list = loadRoutines();
    const routine = list.find(r=>r.id===btn.dataset.routineToggle);
    if (!routine) return;
    routine.active = !routine.active;
    routine.updatedTs = Date.now();
    saveRoutines(list);
    showToast(routine.active ? 'Rutina activada ✓' : 'Convertida en plantilla ✓');
    renderRutinas();
  }));
  app.querySelectorAll('[data-routine-delete]').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm('¿Eliminar esta rutina?')) return;
    saveRoutines(loadRoutines().filter(r=>r.id!==btn.dataset.routineDelete));
    saveRoutineLog(loadRoutineLog().filter(x=>x.routineId!==btn.dataset.routineDelete));
    showToast('Rutina eliminada ✓');
    renderRutinas();
  }));
  app.querySelectorAll('[data-routine-step]').forEach(input => input.addEventListener('change', () => {
    setRoutineStepDone(input.dataset.routineId, date, input.dataset.routineStep, input.checked);
    renderRutinas();
  }));
  app.querySelectorAll('[data-routine-done]').forEach(btn => btn.addEventListener('click', () => {
    const next = btn.dataset.routineDone !== 'true';
    setRoutineDone(btn.dataset.routineId, date, next);
    renderRutinas();
  }));
}

window.AtriaRoutinesView = Object.freeze({ render: renderRutinas });
function renderRoutineCard(r, alters, date, tab) {
  const progress = routineProgress(r, date);
  const scopeText = ROUTINE_SCOPE_LABELS[r.scope] || 'Personal';
  const daysText = r.frequency === 'weekly'
    ? ((Array.isArray(r.daysOfWeek) && r.daysOfWeek.length) ? ROUTINE_DAY_OPTIONS.filter(d=>r.daysOfWeek.includes(d.id)).map(d=>d.short).join(' · ') : 'Semanal')
    : 'Diaria';
  const assigneeText = routineAssigneeText(r, alters);
  const steps = Array.isArray(r.checklist) ? r.checklist : [];
  return `<div class="task-panel">
    <div class="task-panel-header" style="align-items:flex-start">
      <div>
        <div class="task-panel-title">${escP(r.title)}</div>
        ${r.desc ? `<div class="task-panel-desc">${escP(r.desc)}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" data-routine-edit="${r.id}">✎ Editar</button>
        <button class="btn btn-ghost btn-sm" data-routine-toggle="${r.id}">${r.active ? 'Guardar como plantilla' : 'Activar'}</button>
        <button class="btn btn-danger btn-sm" data-routine-delete="${r.id}">✕</button>
      </div>
    </div>
    <div class="task-panel-meta" style="flex-wrap:wrap">
      <span class="proy-card-status proy-status-${r.active ? 'activo' : 'pausado'}">${r.active ? 'Activa' : 'Plantilla'}</span>
      <span style="font-size:12px;color:var(--text-2)">${scopeText}</span>
      <span style="font-size:12px;color:var(--text-2)">${daysText}${r.time ? ` · ${r.time}` : ''}</span>
      <span style="font-size:12px;color:var(--text-2)">${assigneeText}</span>
      ${tab === 'hoy' ? `<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-left:auto">${steps.length ? `${progress.doneCount}/${steps.length} pasos` : (progress.done ? 'Hecha' : 'Pendiente')}</span>` : ''}
    </div>
    ${tab === 'hoy' ? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
        ${steps.length ? steps.map(step => `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--bg-2);cursor:pointer"><input type="checkbox" data-routine-id="${r.id}" data-routine-step="${step.id}" ${progress.entry?.completedSteps?.includes(step.id) ? 'checked' : ''}><span style="color:${progress.entry?.completedSteps?.includes(step.id) ? 'var(--green)' : 'var(--text-1)'}">${escP(step.label)}</span></label>`).join('') : `<div style="padding:10px 12px;border:1px dashed var(--border);border-radius:12px;color:var(--text-2);font-size:12px">Sin checklist. Usa el botón para marcarla como hecha hoy.</div>`}
        <div style="display:flex;justify-content:flex-end"><button class="btn ${progress.done ? 'btn-ghost' : 'btn-primary'} btn-sm" data-routine-id="${r.id}" data-routine-done="${progress.done}">${progress.done ? 'Marcar como pendiente' : 'Marcar como hecha'}</button></div>
      </div>` : `<div style="margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--bg-2)"><div style="font-size:11px;color:var(--text-3);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Checklist</div>${steps.length ? `<div style="display:flex;flex-direction:column;gap:6px">${steps.map(step => `<div style="font-size:13px;color:var(--text-1)">• ${escP(step.label)}</div>`).join('')}</div>` : `<div style="font-size:12px;color:var(--text-2)">Sin pasos definidos todavía.</div>`}</div>`}
  </div>`;
}
function openRoutineModal(item) {
  const isEdit = !!item;
  const alters = getAlters();
  const it = item || { title:'', desc:'', scope:'personal', alterIds:activeAlter?[activeAlter.id]:[], frequency:'daily', daysOfWeek:[], time:'', checklist:[], active:true };
  const selectedDays = new Set(Array.isArray(it.daysOfWeek) ? it.daysOfWeek : []);
  const checklistText = (it.checklist || []).map(x=>x.label).join('\n');
  openModal(`
    <div class="modal-title">${isEdit ? 'Editar rutina' : 'Nueva rutina'}</div>
    <div class="form-grid">
      <div class="form-row"><div class="form-label">Título</div><input type="text" id="routine-title" placeholder="Ej: revisión matinal" value="${escP(it.title||'')}"></div>
      <div class="form-row"><div class="form-label">Descripción</div><textarea id="routine-desc" placeholder="Qué se hace en esta rutina..." style="min-height:90px">${escP(it.desc||'')}</textarea></div>
      <div class="form-row two-col">
        <div class="form-row"><div class="form-label">Ámbito</div><select id="routine-scope">${ROUTINE_SCOPE_OPTIONS.map(opt => `<option value="${opt.id}" ${it.scope===opt.id?'selected':''}>${opt.label}</option>`).join('')}</select></div>
        <div class="form-row"><div class="form-label">Frecuencia</div><select id="routine-frequency">${ROUTINE_FREQ_OPTIONS.map(opt => `<option value="${opt.id}" ${it.frequency===opt.id?'selected':''}>${opt.label}</option>`).join('')}</select></div>
      </div>
      <div class="form-row two-col">
        <div class="form-row"><div class="form-label">Hora (opcional)</div><input type="time" id="routine-time" value="${escP(it.time||'')}"></div>
        <div class="form-row" style="justify-content:flex-end"><label style="display:flex;align-items:center;gap:8px;margin-top:24px;color:var(--text-1)"><input type="checkbox" id="routine-active" ${it.active!==false ? 'checked' : ''}>Activa</label></div>
      </div>
      <div class="form-row"><div class="form-label">Días de la semana</div><div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;align-items:start">${ROUTINE_DAY_OPTIONS.map(day => `<label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:999px;background:var(--bg-2);font-size:12px"><input type="checkbox" data-rday="${day.id}" ${selectedDays.has(day.id) ? 'checked' : ''}>${day.label}</label>`).join('')}</div></div>
      <div class="form-row"><div class="form-label">Asignación</div><div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;align-items:start">${alters.map(a => `<label style="display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid var(--border);border-radius:999px;background:var(--bg-2);font-size:12px"><input type="checkbox" data-ralter="${a.id}" ${(it.alterIds||[]).includes(a.id) ? 'checked' : ''}><span>${a.emoji} ${escP(a.name)}</span></label>`).join('')}</div></div>
      <div class="form-row"><div class="form-label">Checklist (un paso por línea)</div><textarea id="routine-checklist" placeholder="Beber agua&#10;Tomar medicación&#10;Revisar tareas del día" style="min-height:120px">${escP(checklistText)}</textarea></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" data-submit>${isEdit ? 'Guardar' : 'Crear'}</button></div>`,
    (ov) => {
      const title = ov.querySelector('#routine-title').value.trim() || 'Rutina sin título';
      const desc = ov.querySelector('#routine-desc').value.trim();
      const scope = ov.querySelector('#routine-scope').value;
      const frequency = ov.querySelector('#routine-frequency').value;
      const time = ov.querySelector('#routine-time').value || '';
      const active = ov.querySelector('#routine-active').checked;
      const alterIds = [...ov.querySelectorAll('[data-ralter]:checked')].map(x=>x.dataset.ralter);
      let daysOfWeek = [...ov.querySelectorAll('[data-rday]:checked')].map(x=>+x.dataset.rday);
      if (frequency === 'weekly' && !daysOfWeek.length) daysOfWeek = [new Date().getDay()];
      const rawSteps = ov.querySelector('#routine-checklist').value.split('\n').map(s=>s.trim()).filter(Boolean);
      const prevByLabel = new Map((item?.checklist||[]).map(step => [step.label, step.id]));
      const checklist = rawSteps.map((label, idx) => ({ id: prevByLabel.get(label) || `${Date.now()}_${idx}`, label }));
      const entry = {
        id: it.id || uid(),
        title, desc, scope, alterIds, frequency, daysOfWeek, time, checklist, active,
        createdTs: item?.createdTs || Date.now(),
        updatedTs: Date.now(),
      };
      let list = loadRoutines();
      if (isEdit) list = list.map(r => r.id === item.id ? entry : r); else list.unshift(entry);
      saveRoutines(list);
      showToast(isEdit ? 'Rutina actualizada ✓' : 'Rutina creada ✓');
      renderRutinas();
    });
}

const PROY_COLORS = ['#a08aff','#8affe0','#ff8ae2','#ffb450','#8ab4ff','#ff7f7f','#ffd580','#5fffb0'];
const TASK_STATUSES = [
  {id:'pendiente',   label:'Pendiente',   color:'var(--text-2)'},
  {id:'en-progreso', label:'En progreso', color:'var(--accent-4)'},
  {id:'completada',  label:'Completada',  color:'var(--green)'},
  {id:'bloqueada',   label:'Bloqueada',   color:'var(--red)'},
];
const PROY_STATUSES = [
  {id:'activo',      label:'Activo'},
  {id:'pausado',     label:'Pausado'},
  {id:'completado',  label:'Completado'},
  {id:'archivado',   label:'Archivado'},
];

let activeProyId    = null;
let proyTab         = 'proyectos'; // 'proyectos' | 'responsabilidades'
let collapsedGroups = {};
let quickTaskBucket = 'today';

function loadProyectos()  { try { return JSON.parse(localStorage.getItem('tid_proyectos'))||[]; } catch{return[];} }
function saveProyectos(p) { localStorage.setItem('tid_proyectos', JSON.stringify(p)); }
function loadTareas()     { try { return JSON.parse(localStorage.getItem('tid_tareas'))||[]; } catch{return[];} }
function saveTareas(t)    { localStorage.setItem('tid_tareas', JSON.stringify(t)); }
function taskCategories(proyId, project) {
  const configured = Array.isArray(project?.categories) ? project.categories : [];
  const used = loadTareas().filter(t=>t.proyId===proyId).map(t=>t.category).filter(Boolean);
  return [...new Set(['General', ...configured, ...used])].map(String).filter(Boolean);
}

function localISODate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function normalizeQuickToken(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function parseQuickTaskInput(raw, alters = getAlters(), bucket = quickTaskBucket) {
  const original = String(raw || '').trim();
  if (!original) return null;
  const today = localISODate(0);
  const soon = localISODate(3);
  let title = original;
  const tags = [];
  let deadline = bucket === 'today' ? today : bucket === 'soon' ? soon : '';
  let assigneeId = activeAlter?.id || null;
  let priority = 'media';

  title = title.replace(/#([^\s#@!]+)/g, (_, tag) => {
    const clean = tag.trim().replace(/[^\p{L}\p{N}_-]/gu, '');
    if (clean && !tags.includes(clean)) tags.push(clean);
    return ' ';
  });
  title = title.replace(/@([^\s#@!]+)/g, (_, who) => {
    const needle = normalizeQuickToken(who);
    const found = alters.find(a => normalizeQuickToken(a.name) === needle || normalizeQuickToken(a.id) === needle || normalizeQuickToken(a.name).startsWith(needle));
    if (found) assigneeId = found.id;
    return ' ';
  });
  title = title.replace(/!([^\s#@!]+)/g, (_, rawToken) => {
    const token = normalizeQuickToken(rawToken);
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawToken)) deadline = rawToken;
    else if (['hoy','today'].includes(token)) deadline = today;
    else if (['manana','tomorrow'].includes(token)) deadline = localISODate(1);
    else if (['pronto','soon'].includes(token)) deadline = soon;
    else if (['luego','later','someday'].includes(token)) deadline = '';
    else if (['alta','high','urgente'].includes(token)) priority = 'alta';
    else if (['media','medium'].includes(token)) priority = 'media';
    else if (['baja','low'].includes(token)) priority = 'baja';
    return ' ';
  }).replace(/\s+/g, ' ').trim();

  if (!title) return null;
  return { title, tags, deadline, assigneeId, priority };
}

function proyProgress(proyId) {
  const ts = loadTareas().filter(t=>t.proyId===proyId);
  if(!ts.length) return {done:0,total:0,pct:0};
  const done = ts.filter(t=>t.status==='completada').length;
  return {done, total:ts.length, pct:Math.round((done/ts.length)*100)};
}
