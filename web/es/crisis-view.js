function renderCrisis() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Crisis'}]);
  renderCrisisView();
}

function renderCrisisView() {
  const app    = document.getElementById('app');
  const alters = getAlters();

  app.innerHTML = `
    <div class="crisis-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title" style="color:#ff7f7f">⚠ Crisis</div>
          <div class="fin-subtitle">Protocolos, técnicas y contactos de emergencia</div>
        </div>
        ${crisisTab!=='sos'?`<button class="btn btn-primary" id="btn-crisis-new">+ Añadir</button>`:''}
      </div>

      <div class="crisis-tabs">
        ${[
          {id:'sos',        label:'⬤ Emergencia'},
          {id:'protocolos', label:'⚠ Protocolos'},
          {id:'tecnicas',   label:'◈ Técnicas'},
          {id:'contactos',  label:'◎ Contactos'},
          {id:'historial',  label:'▤ Historial'},
        ].map(t=>`<div class="crisis-tab${crisisTab===t.id?' active':''}" data-ct="${t.id}">${t.label}</div>`).join('')}
      </div>

      <div id="crisis-content"></div>
    </div>`;

  app.querySelectorAll('.crisis-tab').forEach(t=>t.addEventListener('click',()=>{ crisisTab=t.dataset.ct; renderCrisisView(); }));
  app.querySelector('#btn-crisis-new')?.addEventListener('click',()=>{
    if(crisisTab==='protocolos') openProtocoloModal(null);
    else if(crisisTab==='tecnicas') openTecnicaModal(null);
    else if(crisisTab==='contactos') openContactoEModal(null);
    else if(crisisTab==='historial') openCrisisLogModal(null);
  });

  const cont = app.querySelector('#crisis-content');
  if(crisisTab==='sos')        renderSosTab(cont, alters);
  if(crisisTab==='protocolos') renderProtocolosTab(cont, alters);
  if(crisisTab==='tecnicas')   renderTecnicasTab(cont, alters);
  if(crisisTab==='contactos')  renderContactosETab(cont, alters);
  if(crisisTab==='historial')  renderCrisisHistorialTab(cont, alters);
}

// ════ SOS ════
function getCalmMsgForAlter(alterId) {
  const perAlter = alterId ? localStorage.getItem('tid_calm_msg_' + alterId) : null;
  return perAlter || getCalmMsg();
}

function renderSosTab(cont, alters) {
  const alter = activeAlter;
  const calmMsg = getCalmMsgForAlter(alter?.id);
  const hasPerAlter = alter && !!localStorage.getItem('tid_calm_msg_' + alter.id);

  cont.innerHTML = `
    <!-- BOTÓN EMERGENCIA -->
    <div class="sos-btn" id="sos-trigger">
      <span class="sos-icon">⬤</span>
      <span>BOTÓN DE EMERGENCIA</span>
    </div>

    <!-- INSTRUCCIONES -->
    <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px">
      <div style="font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--text-3);margin-bottom:12px">Al pulsar el botón verás</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${[
          {icon:'💬', text:'Tu mensaje de calma personal'},
          {icon:'◈', text:'Técnicas de regulación configuradas'},
          {icon:'◎', text:'Acceso directo a contactos de emergencia'},
        ].map(i=>`<div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-1)">
          <span style="font-size:16px">${i.icon}</span><span>${i.text}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- MENSAJE DE CALMA -->
    <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--text-3)">
          Mensaje de calma${alter ? ` · ${escC(alter.emoji||'')} ${escC(alter.name)}` : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${hasPerAlter ? `<button class="btn btn-ghost btn-sm" id="btn-clear-calm-alter">Usar global</button>` : ''}
          <button class="btn btn-ghost btn-sm" id="btn-edit-calm">Editar</button>
        </div>
      </div>
      ${hasPerAlter ? '' : `<div style="font-size:10px;color:var(--text-3);margin-bottom:10px">Mensaje global — personaliza uno para este alter</div>`}
      <div id="calm-msg-display" style="font-size:14px;line-height:1.7;color:var(--text-1);white-space:pre-wrap">${escF(calmMsg)}</div>
    </div>

    <!-- CONTACTOS -->
    <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--text-3)">Contactos de emergencia</div>
        <button class="btn btn-ghost btn-sm" id="btn-go-contactos">Gestionar →</button>
      </div>
      <div style="font-size:12px;color:var(--text-2);margin-top:8px">${loadContactosE().length} contacto${loadContactosE().length===1?'':'s'} configurado${loadContactosE().length===1?'':'s'}</div>
    </div>`;

  cont.querySelector('#sos-trigger').addEventListener('click', ()=>openSosPanel(alters));
  cont.querySelector('#btn-go-contactos').addEventListener('click', ()=>{ crisisTab='contactos'; renderCrisisView(); });
  cont.querySelector('#btn-edit-calm').addEventListener('click', ()=>{
    const isPerAlter = alter && hasPerAlter;
    openModal(`
      <div class="modal-title">Mensaje de calma${alter ? ` · ${escC(alter.name)}` : ''}</div>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-label">${alter ? `Mensaje personalizado para ${escC(alter.name)}. Si lo dejas vacío, se usará el mensaje global.` : 'Este mensaje aparecerá al pulsar el botón de emergencia.'}</div>
          <textarea id="calm-edit" rows="6" style="font-size:13px;line-height:1.6">${escF(calmMsg)}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-submit>Guardar</button>
      </div>`,
      (ov)=>{
        const msg=ov.querySelector('#calm-edit').value.trim();
        if(alter) {
          if(msg) localStorage.setItem('tid_calm_msg_' + alter.id, msg);
          else localStorage.removeItem('tid_calm_msg_' + alter.id);
        } else {
          localStorage.setItem('tid_calm_msg', msg);
        }
        closeModal(); showToast('Mensaje guardado ✓'); renderCrisisView();
      }
    );
  });
  cont.querySelector('#btn-clear-calm-alter')?.addEventListener('click', ()=>{
    if(!alter) return;
    localStorage.removeItem('tid_calm_msg_' + alter.id);
    showToast('Mensaje del alter eliminado ✓'); renderCrisisView();
  });
}

function getCalmMsg() {
  return localStorage.getItem('tid_calm_msg') ||
    'Estás a salvo. Esto es temporal.\n\nRespira lentamente. Nota tus pies en el suelo.\nEl sistema está aquí contigo.';
}

function openSosPanel(alters) {
  // Auto-registrar episodio en historial
  const autoEntry = {
    id: 'cl' + Date.now(),
    alterId: activeAlter?.id || null,
    level: 'moderado',
    triggerId: null,
    startedAt: Date.now(),
    endedAt: null,
    note: null,
    auto: true,
  };
  saveCrisisLog([autoEntry, ...loadCrisisLog()]);
  let currentEntryId = autoEntry.id;

  const tecnicas       = loadTecnicas().slice(0,3);
  const contactos      = loadContactosE();
  const calmMsg        = getCalmMsgForAlter(activeAlter?.id);
  const alergiasGraves = loadAlergias().filter(a => a.gravedad === 'grave');

  const panel = document.createElement('div');
  panel.className = 'sos-panel';
  panel.innerHTML = `
    <div class="sos-panel-inner" style="position:relative">
      <button class="sos-panel-close" id="sos-close">✕ Cerrar</button>

      <div style="text-align:center">
        <div style="font-size:28px;margin-bottom:6px">🫶</div>
        <div class="sos-calm-msg">${escC(calmMsg)}</div>
      </div>

      ${alergiasGraves.length?`
      <div style="background:rgba(255,48,48,.07);border:1px solid rgba(255,80,80,.3);border-radius:var(--radius-md);padding:12px 14px">
        <div class="sos-section-title" style="color:#ff5050;margin-bottom:8px">⚠ Alergias graves</div>
        ${alergiasGraves.map(a=>`<div style="font-size:12px;padding:6px 0;border-bottom:1px solid rgba(255,80,80,.15);display:flex;flex-direction:column;gap:2px">
          <div style="font-weight:700;color:var(--text-1)">${escC(a.nombre)}</div>
          ${a.reaccion?`<div style="color:var(--text-2)">${escC(a.reaccion)}</div>`:''}
        </div>`).join('')}
      </div>`:''}

      ${tecnicas.length?`
      <div>
        <div class="sos-section-title">Técnicas de regulación</div>
        ${tecnicas.map(t=>{
          const typ=TEC_TYPES.find(x=>x.id===t.type)||TEC_TYPES[5];
          return `<div class="sos-tecnica-card" data-tid="${t.id}">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="font-size:14px">${typ.icon}</span>
              <div class="sos-tecnica-name">${escC(t.name)}</div>
              ${t.duration?`<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-left:auto">${escC(t.duration)}</span>`:''}
            </div>
            ${t.desc?`<div class="sos-tecnica-desc">${escC(t.desc)}</div>`:''}
          </div>`;
        }).join('')}
      </div>`:''}

      ${contactos.length?`
      <div>
        <div class="sos-section-title">Contactos de emergencia</div>
        ${contactos.map(c=>`
          <div class="sos-contacto-row">
            <div class="sos-contacto-avatar">${c.emoji||'◎'}</div>
            <div style="flex:1;min-width:0">
              <div class="sos-contacto-name">${escC(c.name)}</div>
              ${c.relation?`<div class="sos-contacto-info">${escC(c.relation)}</div>`:''}
              ${(c.contactInfo||[]).length?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">
                ${(c.contactInfo||[]).map(ci=>{
                  const href=ci.type==='telefono'?`tel:${ci.value}`:ci.type==='email'?`mailto:${ci.value}`:`#`;
                  const icon=ci.type==='telefono'?'📞':ci.type==='email'?'✉️':'🔗';
                  const label=ci.type==='telefono'?ci.value:ci.type==='email'?ci.value:ci.value;
                  return `<a href="${href}" class="ce-info-btn" title="${escC(ci.value)}" style="font-size:11px">${icon} <span style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle">${escC(label)}</span></a>`;
                }).join('')}
              </div>`:''}
            </div>
          </div>`).join('')}
      </div>`:''}

      ${!tecnicas.length&&!contactos.length?`<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);text-align:center;padding:10px">
        Añade técnicas y contactos de emergencia para que aparezcan aquí
      </div>`:''}

      <button class="btn btn-ghost" id="sos-go-contactos" style="width:100%;font-size:12px;justify-content:center">◎ Gestionar contactos de emergencia</button>

      <!-- INTENSIDAD + ESTOY BIEN -->
      <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:4px">
        <div style="font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--text-3);margin-bottom:10px;text-align:center">¿Qué intensidad tuvo la crisis?</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center" id="sos-intensity-btns">
          ${CRISIS_LEVELS.map(l=>`<button class="sos-intensity-btn" data-level="${l.id}" style="border:1px solid ${l.color};color:${l.color};background:${l.bg};border-radius:var(--radius);padding:6px 12px;font-size:12px;cursor:pointer;transition:var(--transition)">${l.label}</button>`).join('')}
        </div>
        <button class="sos-btn" id="sos-close-2" style="margin-top:12px">Estoy bien · Cerrar</button>
      </div>
    </div>`;

  document.body.appendChild(panel);

  const closePanel = () => panel.remove();

  panel.querySelector('#sos-close').addEventListener('click', closePanel);
  panel.querySelector('#sos-go-contactos').addEventListener('click', ()=>{ closePanel(); crisisTab='contactos'; navigateTo('crisis'); });
  panel.addEventListener('click', e=>{ if(e.target===panel) closePanel(); });

  // Selector de intensidad
  panel.querySelectorAll('.sos-intensity-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      panel.querySelectorAll('.sos-intensity-btn').forEach(b=>b.style.opacity='0.4');
      btn.style.opacity='1';
      btn.style.fontWeight='700';
      // Actualizar entrada en historial
      const list = loadCrisisLog();
      const idx = list.findIndex(x=>x.id===currentEntryId);
      if(idx>=0) { list[idx].level=btn.dataset.level; saveCrisisLog(list); }
    });
  });

  // Estoy bien — cerrar y finalizar episodio
  panel.querySelector('#sos-close-2').addEventListener('click', ()=>{
    const list = loadCrisisLog();
    const idx = list.findIndex(x=>x.id===currentEntryId);
    if(idx>=0) { list[idx].endedAt=Date.now(); saveCrisisLog(list); }
    closePanel();
  });

  // Expandir técnica al clicar
  panel.querySelectorAll('.sos-tecnica-card[data-tid]').forEach(card=>{
    card.addEventListener('click', ()=>{
      const t=loadTecnicas().find(x=>x.id===card.dataset.tid);
      if(!t||!t.steps?.length) return;
      const existing=card.querySelector('.sos-steps-expand');
      if(existing){ existing.remove(); return; }
      const div=document.createElement('div');
      div.className='sos-steps-expand';
      div.style.cssText='margin-top:10px;display:flex;flex-direction:column;gap:5px;border-top:1px solid var(--border);padding-top:10px';
      div.innerHTML=t.steps.map((s,i)=>`<div style="display:flex;gap:8px;font-size:11px;color:var(--text-1)">
        <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);flex-shrink:0;margin-top:2px">${i+1}.</span>
        <span>${escC(s)}</span>
      </div>`).join('');
      card.appendChild(div);
    });
  });
}


// ════ EJEMPLOS PRECARGADOS ════
function loadProtocolosEjemplos() {
  const ejemplos = [
    {id:'ep1',title:'Respiración 4-7-8',level:'moderado',responsableId:'',activation:'manual',steps:['Inhala por la nariz contando 4 segundos','Mantén el aire contando 7 segundos','Exhala lentamente por la boca contando 8 segundos','Repite 4 ciclos']},
    {id:'ep2',title:'Grounding 5-4-3-2-1',level:'severo',responsableId:'',activation:'manual',steps:['Nombra 5 cosas que puedes VER ahora mismo','Nombra 4 cosas que puedes TOCAR','Nombra 3 cosas que puedes OÍR','Nombra 2 cosas que puedes OLER','Nombra 1 cosa que puedes SABOREAR']},
    {id:'ep3',title:'Protocolo de disociación leve',level:'leve',responsableId:'',activation:'manual',steps:['Siéntate o apoya la espalda en algo sólido','Siente el peso de tu cuerpo contra la silla o el suelo','Nombra en voz alta dónde estás: ciudad, lugar, fecha','Bebe agua fría o agarra algo con textura','Avisa al sistema interno de que estás segure']},
    {id:'ep4',title:'Crisis severa — pedir ayuda',level:'extremo',responsableId:'',activation:'manual',steps:['Para lo que estés haciendo','Busca un lugar físicamente seguro','Contacta con alguien del sistema o de emergencia','Si estás en peligro, llama al 024 o al 112','No estés sole — espera a que llegue ayuda']},
  ];
  const existing = loadProtocolos();
  const newIds = ejemplos.map(e=>e.id);
  const merged = [...existing.filter(p=>!newIds.includes(p.id)), ...ejemplos];
  saveProtocolos(merged);
  showToast('Protocolos de ejemplo cargados ✓');
  renderCrisisView();
}

function loadTecnicasEjemplos() {
  const ejemplos = [
    {id:'te1',name:'Respiración cuadrada',type:'respiracion',duration:'5 min',desc:'Inhala 4s, mantén 4s, exhala 4s, mantén 4s. Repite.',steps:['Inhala contando 4','Mantén contando 4','Exhala contando 4','Mantén vacío contando 4','Repite 6 veces']},
    {id:'te2',name:'Ruido blanco / sonidos de naturaleza',type:'sensorial',duration:'Variable',desc:'Pon auriculares con lluvia, olas o ruido blanco para anclarte al presente.',steps:['Busca auriculares o altavoz','Activa lluvia, olas o ruido blanco (YouTube, app, Spotify)','Cierra los ojos y centra toda tu atención en el sonido','Deja que el sonido llene el espacio mental']},
    {id:'te3',name:'Temperatura — agua fría',type:'sensorial',duration:'2 min',desc:'El frío activa el nervio vago y reduce la respuesta de pánico.',steps:['Ve al baño','Abre el grifo de agua fría','Moja tus muñecas y parte interna de los codos','Opcional: pon agua fría en la nuca','Respira mientras sientes el frío']},
    {id:'te4',name:'Movimiento consciente',type:'movimiento',duration:'5 min',desc:'Sacudir el cuerpo para soltar tensión acumulada.',steps:['De pie o sentade, empieza por los pies','Sacude ligeramente pies, piernas, manos, brazos','Mueve el cuello con suavidad de lado a lado','Termina con tres respiraciones profundas']},
    {id:'te5',name:'Mensaje al sistema',type:'cognitiva',duration:'Variable',desc:'Escribe en el chat interno para comunicar el estado al sistema.',steps:['Abre Comunicación en Atria','Escribe cómo te sientes y qué necesitas','Pregunta si alguien puede al frente','Espera respuesta o pide un switch consciente']},
  ];
  const existing = loadTecnicas();
  const newIds = ejemplos.map(e=>e.id);
  const merged = [...existing.filter(t=>!newIds.includes(t.id)), ...ejemplos];
  saveTecnicas(merged);
  showToast('Técnicas de ejemplo cargadas ✓');
  renderCrisisView();
}

// ════ PROTOCOLOS ════
function renderProtocolosTab(cont, alters) {
  const items = loadProtocolos().sort((a,b)=>{
    const order=['extremo','severo','moderado','leve'];
    return order.indexOf(a.level)-order.indexOf(b.level);
  });

  if(!items.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">⚠</div>
      <div>Sin protocolos definidos</div>
      <button class="btn btn-ghost" id="btn-load-proto-examples" style="margin-top:16px;font-size:12px">Cargar ejemplos</button>
    </div>`;
    cont.querySelector('#btn-load-proto-examples')?.addEventListener('click',()=>loadProtocolosEjemplos());
    return;
  }

  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:10px">
    ${items.map(p=>{
      const lvl=CRISIS_LEVELS.find(l=>l.id===p.level)||CRISIS_LEVELS[1];
      const resp=alters.find(a=>a.id===p.responsableId);
      return `<div class="proto-card" data-pid="${p.id}">
        <div class="proto-level-bar" style="background:${lvl.color}"></div>
        <div class="proto-body">
          <div class="proto-header">
            <div class="proto-title">${escC(p.title)}</div>
            <span class="proto-level-badge" style="color:${lvl.color};border-color:${lvl.color};background:${lvl.bg}">${lvl.label}</span>
          </div>
          ${p.steps?.length?`<div class="proto-steps">
            ${p.steps.map((s,i)=>`<div class="proto-step">
              <div class="proto-step-num">${i+1}</div>
              <div>${escC(s)}</div>
            </div>`).join('')}
          </div>`:''}
          <div class="proto-meta">
            ${resp?`<span>${resp.emoji} ${resp.name}</span>`:''}
            <span>${p.activation==='auto'?'⚡ Automático':'○ Manual'}</span>
            <div style="margin-left:auto;display:flex;gap:4px">
              <button class="icon-btn btn-p-edit" data-pid="${p.id}">✎</button>
              <button class="icon-btn btn-p-del" data-pid="${p.id}">✕</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  cont.querySelectorAll('.btn-p-edit').forEach(b=>b.addEventListener('click',()=>{
    const p=loadProtocolos().find(x=>x.id===b.dataset.pid); if(p) openProtocoloModal(p);
  }));
  cont.querySelectorAll('.btn-p-del').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('¿Eliminar este protocolo?')) return;
    saveProtocolos(loadProtocolos().filter(x=>x.id!==b.dataset.pid));
    showToast('Protocolo eliminado'); renderCrisisView();
  }));
}

// ════ TÉCNICAS ════
function renderTecnicasTab(cont, alters) {
  const items = loadTecnicas();

  if(!items.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">◈</div>
      <div>Sin técnicas definidas</div>
      <button class="btn btn-ghost" id="btn-load-tec-examples" style="margin-top:16px;font-size:12px">Cargar ejemplos</button>
    </div>`;
    cont.querySelector('#btn-load-tec-examples')?.addEventListener('click',()=>loadTecnicasEjemplos());
    return;
  }

  cont.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
    ${items.map(t=>{
      const typ=TEC_TYPES.find(x=>x.id===t.type)||TEC_TYPES[5];
      return `<div class="tecnica-card" data-tid="${t.id}">
        <div class="tecnica-type-bar" style="background:${typ.color}"></div>
        <div class="tecnica-body">
          <div class="tecnica-header">
            <div class="tecnica-type-icon" style="background:${typ.bg};color:${typ.color}">${typ.icon}</div>
            <div class="tecnica-title">${escC(t.name)}</div>
            ${t.duration?`<div class="tecnica-dur">${escC(t.duration)}</div>`:''}
          </div>
          ${t.desc?`<div class="tecnica-desc">${escC(t.desc)}</div>`:''}
          ${t.steps?.length?`<div class="tecnica-steps">
            ${t.steps.map((s,i)=>`<div class="tecnica-step">
              <div class="tecnica-step-dot">${i+1}</div>
              <div>${escC(s)}</div>
            </div>`).join('')}
          </div>`:''}
          <div style="display:flex;justify-content:flex-end;gap:4px;margin-top:4px">
            <button class="icon-btn btn-t-edit" data-tid="${t.id}">✎</button>
            <button class="icon-btn btn-t-del" data-tid="${t.id}">✕</button>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  cont.querySelectorAll('.btn-t-edit').forEach(b=>b.addEventListener('click',()=>{
    const t=loadTecnicas().find(x=>x.id===b.dataset.tid); if(t) openTecnicaModal(t);
  }));
  cont.querySelectorAll('.btn-t-del').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('¿Eliminar esta técnica?')) return;
    saveTecnicas(loadTecnicas().filter(x=>x.id!==b.dataset.tid));
    showToast('Técnica eliminada'); renderCrisisView();
  }));
}

// ════ CONTACTOS EMERGENCIA ════
function renderContactosETab(cont, alters) {
  const items = loadContactosE();

  if(!items.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px"><div class="empty-icon">◎</div><div>Sin contactos de emergencia</div></div>`;
    return;
  }

  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px">
    ${items.map(c=>`<div class="ce-card" data-ceid="${c.id}">
      <div class="ce-avatar">${c.emoji||'◎'}</div>
      <div class="ce-body">
        <div class="ce-name">${escC(c.name)}</div>
        ${c.relation?`<div class="ce-rel">${escC(c.relation)}</div>`:''}
        <div class="ce-infos">
          ${(c.contactInfo||[]).map(ci=>{
            const href=ci.type==='telefono'?`tel:${ci.value}`:ci.type==='email'?`mailto:${ci.value}`:'#';
            const icon=ci.type==='telefono'?'📞':ci.type==='email'?'✉':'🔗';
            return `<a href="${href}" class="ce-info-btn">${icon} ${escC(ci.value)}</a>`;
          }).join('')}
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;align-self:flex-start">
        <button class="icon-btn btn-ce-edit" data-ceid="${c.id}">✎</button>
        <button class="icon-btn btn-ce-del" data-ceid="${c.id}">✕</button>
      </div>
    </div>`).join('')}
  </div>`;

  cont.querySelectorAll('.btn-ce-edit').forEach(b=>b.addEventListener('click',()=>{
    const c=loadContactosE().find(x=>x.id===b.dataset.ceid); if(c) openContactoEModal(c);
  }));
  cont.querySelectorAll('.btn-ce-del').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('¿Eliminar este contacto?')) return;
    saveContactosE(loadContactosE().filter(x=>x.id!==b.dataset.ceid));
    showToast('Contacto eliminado'); renderCrisisView();
  }));
}


// ════ HISTORIAL CRISIS ════
function renderCrisisHistorialTab(cont, alters) {
  const items = loadCrisisLog().sort((a,b)=>b.startedAt-a.startedAt);

  if(!items.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px"><div class="empty-icon">▤</div><div>Sin episodios registrados</div></div>`;
    return;
  }

  // ── Analytics: frecuencia mensual últimos 6 meses ──
  const now = new Date();
  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    return { y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleDateString('es',{month:'short',year:'2-digit'}) };
  });
  const countByMonth = months.map(mo =>
    items.filter(e => { const d=new Date(e.startedAt); return d.getFullYear()===mo.y && d.getMonth()===mo.m; }).length
  );
  const maxCount = Math.max(...countByMonth, 1);
  const triggers = loadSaludTriggers();
  const topTriggers = Object.entries(
    items.filter(e=>e.triggerId).reduce((acc,e)=>{ acc[e.triggerId]=(acc[e.triggerId]||0)+1; return acc; }, {})
  ).sort((a,b)=>b[1]-a[1]).slice(0,3);

  const analyticsHtml = `<div class="crisis-analytics" style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Frecuencia · últimos 6 meses</div>
    <div style="display:flex;align-items:flex-end;gap:6px;height:48px">
      ${months.map((mo,i) => {
        const c = countByMonth[i];
        const h = c ? Math.max(8, Math.round((c/maxCount)*44)) : 4;
        const isCurrentMonth = mo.y===now.getFullYear() && mo.m===now.getMonth();
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-size:9px;font-family:'DM Mono',monospace;color:var(--text-3)">${c||''}</div>
          <div style="width:100%;height:${h}px;background:${isCurrentMonth?'var(--accent)':'var(--accent-2)'};border-radius:3px 3px 0 0;opacity:${c?1:0.2}"></div>
          <div style="font-size:9px;font-family:'DM Mono',monospace;color:var(--text-3);white-space:nowrap">${mo.label}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap">
      <div style="font-size:11px;color:var(--text-2)">Total: <strong style="color:var(--text-1)">${items.length}</strong></div>
      ${topTriggers.length ? `<div style="font-size:11px;color:var(--text-2)">Triggers frecuentes: ${topTriggers.map(([id,n])=>{const t=triggers.find(x=>x.id===id); return t?`<strong style="color:var(--text-1)">${escC(t.titulo)}</strong> (${n})`:''}).filter(Boolean).join(', ')}</div>` : ''}
    </div>
  </div>`;

  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px">${analyticsHtml}
    ${items.map(e=>{
      const alter=alters.find(a=>a.id===e.alterId);
      const trigger=e.triggerId?loadSaludTriggers().find(t=>t.id===e.triggerId):null;
      const lvl=CRISIS_LEVELS.find(l=>l.id===e.level)||CRISIS_LEVELS[1];
      const start=new Date(e.startedAt);
      const end=e.endedAt?new Date(e.endedAt):null;
      const dur=end?Math.round((e.endedAt-e.startedAt)/60000):null;
      return `<div class="crisis-log-card" data-lid="${e.id}">
        <div class="crisis-log-level-bar" style="background:${lvl.color}"></div>
        <div class="crisis-log-body">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div>
              <span class="proto-level-badge" style="color:${lvl.color};border-color:${lvl.color};background:${lvl.bg}">${lvl.label}</span>
              ${alter?`<span style="font-size:12px;color:var(--text-2);margin-left:6px">${escC(alter.emoji||'')} ${escC(alter.name)}</span>`:''}
            ${e.auto?`<span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);border:1px solid var(--border);padding:1px 5px;border-radius:4px">AUTO</span>`:''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="icon-btn btn-log-edit" data-lid="${e.id}">✎</button>
              <button class="icon-btn btn-log-del" data-lid="${e.id}">✕</button>
            </div>
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:4px">
            ${start.toLocaleDateString('es')} ${start.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}
            ${end?' → '+end.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}):'· En curso'}
            ${dur!==null?' · '+dur+'min':''}
          </div>
          ${trigger?`<div style="font-size:11px;color:var(--text-2);margin-top:4px">⚡ ${escC(trigger.titulo)}</div>`:''}
          ${e.note?`<div style="font-size:12px;color:var(--text-1);margin-top:6px;line-height:1.5">${escC(e.note)}</div>`:''}
          ${e.recovery?`<div style="font-size:12px;margin-top:8px;padding:8px 10px;background:rgba(100,200,100,0.07);border-left:2px solid #5cb85c;border-radius:0 6px 6px 0;color:var(--text-1);line-height:1.5"><span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--text-3);display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.1em">Recuperación · <button class="btn-inline-link btn-log-recovery" data-lid="${e.id}" style="font-size:10px;cursor:pointer;background:none;border:none;color:var(--accent);padding:0">editar</button></span>${escC(e.recovery)}</div>`:
            `<button class="btn btn-ghost btn-sm btn-log-recovery" data-lid="${e.id}" style="margin-top:6px;font-size:11px;padding:3px 8px">+ Añadir recuperación</button>`}
        </div>
      </div>`;
    }).join('')}
  </div>`;

  cont.querySelectorAll('.btn-log-edit').forEach(b=>b.addEventListener('click',()=>{
    const e=loadCrisisLog().find(x=>x.id===b.dataset.lid); if(e) openCrisisLogModal(e);
  }));
  cont.querySelectorAll('.btn-log-recovery').forEach(b=>b.addEventListener('click',e2=>{
    e2.stopPropagation();
    const entry=loadCrisisLog().find(x=>x.id===b.dataset.lid); if(!entry) return;
    openCrisisRecoveryModal(entry);
  }));
  cont.querySelectorAll('.btn-log-del').forEach(b=>b.addEventListener('click',()=>{
    openModal(`
      <div class="modal-title">Eliminar episodio</div>
      <div style="font-size:13px;color:var(--text-1);padding:4px 0 16px">¿Eliminar este registro de crisis?</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-cancel>Cancelar</button>
        <button class="btn btn-danger" data-submit>Eliminar</button>
      </div>`,
      ()=>{ saveCrisisLog(loadCrisisLog().filter(x=>x.id!==b.dataset.lid)); showToast('Episodio eliminado'); renderCrisisView(); }
    );
  }));
}

function openCrisisLogModal(item) {
  const isEdit=!!item;
  const alters=getAlters();
  const triggers=loadSaludTriggers();
  const now=Date.now();
  const it=item||{id:null,alterId:activeAlter?.id||'',level:'moderado',triggerId:'',startedAt:now,endedAt:null,note:''};

  const fmtLocal = ts => {
    if(!ts) return '';
    const d=new Date(ts);
    const pad=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
  };

  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = '<div class="modal">'
    + '<div class="modal-title">' + (isEdit?'Editar episodio':'Registrar episodio de crisis') + '</div>'
    + '<div class="form-grid">'
      + '<div class="form-row"><div class="form-label">Nivel</div>'
        + '<select id="cl-level">'
          + CRISIS_LEVELS.map(l=>'<option value="'+l.id+'"'+(it.level===l.id?' selected':'')+'>'+l.label+'</option>').join('')
        + '</select></div>'
      + '<div class="form-row"><div class="form-label">Alter</div>'
        + '<select id="cl-alter">'
          + '<option value="">Sin especificar</option>'
          + alters.map(a=>'<option value="'+a.id+'"'+(it.alterId===a.id?' selected':'')+'>'+escC(a.emoji||'')+' '+escC(a.name)+'</option>').join('')
        + '</select></div>'
      + '<div class="form-row"><div class="form-label">Trigger (opcional)</div>'
        + '<select id="cl-trigger">'
          + '<option value="">Sin trigger asociado</option>'
          + triggers.map(t=>'<option value="'+t.id+'"'+(it.triggerId===t.id?' selected':'')+'>'+escC(t.titulo)+'</option>').join('')
        + '</select></div>'
      + '<div class="form-row"><div class="form-label">Inicio</div>'
        + '<input type="datetime-local" id="cl-start" value="'+fmtLocal(it.startedAt)+'"></div>'
      + '<div class="form-row"><div class="form-label">Fin (opcional)</div>'
        + '<input type="datetime-local" id="cl-end" value="'+fmtLocal(it.endedAt)+'"></div>'
      + '<div class="form-row"><div class="form-label">Nota</div>'
        + '<textarea id="cl-note" rows="4" placeholder="Qué pasó, cómo te sentiste, qué ayudó…"></textarea></div>'
    + '</div>'
    + '<div class="modal-footer">'
      + '<button class="btn btn-ghost" data-cancel>Cancelar</button>'
      + '<button class="btn btn-primary" data-submit>'+(isEdit?'Guardar cambios':'Registrar')+'</button>'
    + '</div>'
    + '</div>';

  ov.querySelector('#cl-note').value = it.note || '';
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  ov.querySelector('[data-cancel]').addEventListener('click', ()=>ov.remove());
  ov.querySelector('[data-submit]').addEventListener('click', ()=>{
    const startVal=ov.querySelector('#cl-start').value;
    const endVal=ov.querySelector('#cl-end').value;
    const entry={
      id: it.id||('cl'+Date.now()),
      alterId: ov.querySelector('#cl-alter').value||null,
      level: ov.querySelector('#cl-level').value,
      triggerId: ov.querySelector('#cl-trigger').value||null,
      startedAt: startVal?new Date(startVal).getTime():now,
      endedAt: endVal?new Date(endVal).getTime():null,
      note: ov.querySelector('#cl-note').value.trim()||null,
      auto: it.auto||false,
    };
    let list=loadCrisisLog();
    if(isEdit) list=list.map(x=>x.id===entry.id?entry:x);
    else list.unshift(entry);
    saveCrisisLog(list);
    ov.remove();
    showToast(isEdit?'Episodio actualizado ✓':'Episodio registrado ✓');
    renderCrisisView();
  });
}

function openCrisisRecoveryModal(entry) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal">
    <div class="modal-title">${entry.recovery ? 'Editar recuperación' : 'Añadir recuperación'}</div>
    <div style="font-size:12px;color:var(--text-3);margin-bottom:12px">¿Qué ayudó a salir del episodio? Técnicas, personas, estrategias…</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Recuperación</div>
        <textarea id="cr-recovery" rows="5" placeholder="Ej: Respiración profunda, contacto con X, distracción con música…"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      ${entry.recovery ? '<button class="btn btn-danger btn-sm" id="cr-clear">Eliminar</button>' : ''}
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>Guardar</button>
    </div>
  </div>`;

  ov.querySelector('#cr-recovery').value = entry.recovery || '';
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('[data-cancel]').addEventListener('click', () => ov.remove());

  ov.querySelector('#cr-clear')?.addEventListener('click', () => {
    const list = loadCrisisLog().map(x => x.id === entry.id ? {...x, recovery: null} : x);
    saveCrisisLog(list);
    ov.remove();
    showToast('Recuperación eliminada');
    renderCrisisView();
  });

  ov.querySelector('[data-submit]').addEventListener('click', () => {
    const text = ov.querySelector('#cr-recovery').value.trim();
    if (!text) { showToast('⚠ Escribe algo antes de guardar'); return; }
    const list = loadCrisisLog().map(x => x.id === entry.id ? {...x, recovery: text} : x);
    saveCrisisLog(list);
    ov.remove();
    showToast('Recuperación guardada ✓');
    renderCrisisView();
  });
}

// ════ MODALES ════
function openProtocoloModal(item) {
  const isEdit=!!item;
  const it=item||{title:'',level:'moderado',responsableId:'',activation:'manual',steps:[]};
  const alters=getAlters();
  let steps=[...(it.steps||[])];

  openModal(`
    <div class="modal-title">${isEdit?'Editar protocolo':'Nuevo protocolo'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="pr-title" placeholder="Nombre del protocolo" value="${escC(it.title)}">
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Nivel de crisis</div>
          <select id="pr-level">
            ${CRISIS_LEVELS.map(l=>`<option value="${l.id}" ${it.level===l.id?'selected':''}>${l.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Activación</div>
          <select id="pr-activation">
            <option value="manual" ${it.activation!=='auto'?'selected':''}>○ Manual</option>
            <option value="auto" ${it.activation==='auto'?'selected':''}>⚡ Automática</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Responsable</div>
        <select id="pr-resp">
          <option value="">Sin asignar</option>
          ${alters.map(a=>`<option value="${a.id}" ${it.responsableId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-label">Pasos a seguir</div>
        <div id="pr-steps-list" style="display:flex;flex-direction:column;gap:6px"></div>
        <button class="btn btn-ghost btn-sm" id="btn-add-pstep" style="margin-top:6px;align-self:flex-start">+ Añadir paso</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Crear'}</button>
    </div>`,
    (ov)=>{
      const title=ov.querySelector('#pr-title').value.trim();
      if(!title) return showToast('⚠ El título es obligatorio');
      // collect steps from inputs
      const stepInputs=ov.querySelectorAll('.pr-step-input');
      const finalSteps=[...stepInputs].map(i=>i.value.trim()).filter(Boolean);
      const entry={id:it.id||uid(),title,level:ov.querySelector('#pr-level').value,
        responsableId:ov.querySelector('#pr-resp').value||null,
        activation:ov.querySelector('#pr-activation').value,steps:finalSteps};
      let list=loadProtocolos();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveProtocolos(list); closeModal(); showToast(isEdit?'Protocolo actualizado ✓':'Protocolo creado ✓'); renderCrisisView();
    }
  );
  const ov=document.querySelector('.modal-overlay');
  function refreshPSteps(){
    const list=ov.querySelector('#pr-steps-list'); if(!list) return;
    list.innerHTML=steps.map((s,i)=>`<div style="display:flex;gap:6px;align-items:center">
      <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);width:16px;text-align:center;flex-shrink:0">${i+1}</span>
      <input class="pr-step-input" type="text" value="${escC(s)}" placeholder="Paso ${i+1}…" style="flex:1" data-si="${i}">
      <button class="icon-btn" data-del-ps="${i}">✕</button>
    </div>`).join('');
    list.querySelectorAll('[data-del-ps]').forEach(b=>b.addEventListener('click',()=>{ steps.splice(+b.dataset.delPs,1); refreshPSteps(); }));
    list.querySelectorAll('.pr-step-input').forEach(inp=>inp.addEventListener('input',()=>{ steps[+inp.dataset.si]=inp.value; }));
  }
  refreshPSteps();
  ov.querySelector('#btn-add-pstep')?.addEventListener('click',()=>{ steps.push(''); refreshPSteps(); ov.querySelectorAll('.pr-step-input').item(steps.length-1)?.focus(); });
}

function openTecnicaModal(item) {
  const isEdit=!!item;
  const it=item||{name:'',desc:'',type:'respiracion',duration:'',steps:[]};
  let steps=[...(it.steps||[])];

  openModal(`
    <div class="modal-title">${isEdit?'Editar técnica':'Nueva técnica'}</div>
    <div class="form-grid">
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Nombre</div>
          <input type="text" id="tc-name" placeholder="Nombre de la técnica" value="${escC(it.name)}">
        </div>
        <div class="form-row">
          <div class="form-label">Duración estimada</div>
          <input type="text" id="tc-dur" placeholder="Ej: 5 min, 2-3 min…" value="${escC(it.duration||'')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Tipo</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${TEC_TYPES.map(t=>`<div class="recur-opt${it.type===t.id?' selected':''}" data-ttype="${t.id}" style="padding:8px 12px;font-size:12px;display:flex;align-items:center;gap:5px">
            <span>${t.icon}</span><span>${t.label}</span>
          </div>`).join('')}
        </div>
        <input type="hidden" id="tc-type" value="${it.type||'respiracion'}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción breve</div>
        <textarea id="tc-desc" placeholder="¿En qué consiste?">${escC(it.desc||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Pasos (opcional)</div>
        <div id="tc-steps-list" style="display:flex;flex-direction:column;gap:6px"></div>
        <button class="btn btn-ghost btn-sm" id="btn-add-tstep" style="margin-top:6px;align-self:flex-start">+ Añadir paso</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Añadir'}</button>
    </div>`,
    (ov)=>{
      const name=ov.querySelector('#tc-name').value.trim();
      if(!name) return showToast('⚠ El nombre es obligatorio');
      const stepInputs=ov.querySelectorAll('.tc-step-input');
      const finalSteps=[...stepInputs].map(i=>i.value.trim()).filter(Boolean);
      const entry={id:it.id||uid(),name,desc:ov.querySelector('#tc-desc').value.trim(),
        type:ov.querySelector('#tc-type').value,duration:ov.querySelector('#tc-dur').value.trim(),steps:finalSteps};
      let list=loadTecnicas();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveTecnicas(list); closeModal(); showToast(isEdit?'Técnica actualizada ✓':'Técnica añadida ✓'); renderCrisisView();
    }
  );
  const ov=document.querySelector('.modal-overlay');
  ov.querySelectorAll('[data-ttype]').forEach(opt=>opt.addEventListener('click',()=>{
    ov.querySelectorAll('[data-ttype]').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected'); ov.querySelector('#tc-type').value=opt.dataset.ttype;
  }));
  function refreshTSteps(){
    const list=ov.querySelector('#tc-steps-list'); if(!list) return;
    list.innerHTML=steps.map((s,i)=>`<div style="display:flex;gap:6px;align-items:center">
      <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);width:16px;text-align:center;flex-shrink:0">${i+1}</span>
      <input class="tc-step-input" type="text" value="${escC(s)}" placeholder="Paso ${i+1}…" style="flex:1" data-si="${i}">
      <button class="icon-btn" data-del-ts="${i}">✕</button>
    </div>`).join('');
    list.querySelectorAll('[data-del-ts]').forEach(b=>b.addEventListener('click',()=>{ steps.splice(+b.dataset.delTs,1); refreshTSteps(); }));
    list.querySelectorAll('.tc-step-input').forEach(inp=>inp.addEventListener('input',()=>{ steps[+inp.dataset.si]=inp.value; }));
  }
  refreshTSteps();
  ov.querySelector('#btn-add-tstep')?.addEventListener('click',()=>{ steps.push(''); refreshTSteps(); ov.querySelectorAll('.tc-step-input').item(steps.length-1)?.focus(); });
}

function openContactoEModal(item) {
  const isEdit=!!item;
  const it=item||{name:'',emoji:'◎',relation:'',contactInfo:[]};
  let edInfo=[...(it.contactInfo||[])];

  openModal(`
    <div class="modal-title">${isEdit?'Editar contacto de emergencia':'Nuevo contacto de emergencia'}</div>
    <div class="form-grid">
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Emoji</div>
          <input type="text" id="ce-emoji" value="${escC(it.emoji||'◎')}" maxlength="4" style="font-size:20px;text-align:center">
        </div>
        <div class="form-row">
          <div class="form-label">Nombre</div>
          <input type="text" id="ce-name" placeholder="Nombre" value="${escC(it.name)}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Relación / Rol</div>
        <input type="text" id="ce-rel" placeholder="Ej: Terapeuta, línea de crisis 024, amigo…" value="${escC(it.relation||'')}">
      </div>
      <div class="form-row">
        <div class="form-label">Información de contacto</div>
        <div id="ce-info-list" style="display:flex;flex-direction:column;gap:6px">
          ${edInfo.map((ci,i)=>renderCEInfoRow(ci,i)).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-add-ceinfo" style="margin-top:6px;align-self:flex-start">+ Añadir</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Añadir'}</button>
    </div>`,
    (ov)=>{
      const name=ov.querySelector('#ce-name').value.trim();
      if(!name) return showToast('⚠ El nombre es obligatorio');
      const entry={id:it.id||uid(),name,emoji:ov.querySelector('#ce-emoji').value.trim()||'◎',
        relation:ov.querySelector('#ce-rel').value.trim(),contactInfo:[...edInfo]};
      let list=loadContactosE();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveContactosE(list); closeModal(); showToast(isEdit?'Contacto actualizado ✓':'Contacto añadido ✓'); renderCrisisView();
    }
  );
  const ov=document.querySelector('.modal-overlay');
  function refreshCEInfo(){
    const list=ov.querySelector('#ce-info-list'); if(!list) return;
    list.innerHTML=edInfo.map((ci,i)=>renderCEInfoRow(ci,i)).join('');
    list.querySelectorAll('[data-del-cei]').forEach(b=>b.addEventListener('click',()=>{ edInfo.splice(+b.dataset.delCei,1); refreshCEInfo(); }));
    list.querySelectorAll('[data-cei-type]').forEach(sel=>sel.addEventListener('change',()=>{ edInfo[+sel.dataset.ceiType].type=sel.value; }));
    list.querySelectorAll('[data-cei-val]').forEach(inp=>inp.addEventListener('input',()=>{ edInfo[+inp.dataset.ceiVal].value=inp.value; }));
  }
  ov.querySelector('#btn-add-ceinfo')?.addEventListener('click',()=>{ edInfo.push({type:'telefono',value:''}); refreshCEInfo(); });
  ov.querySelectorAll('[data-del-cei]').forEach(b=>b.addEventListener('click',()=>{ edInfo.splice(+b.dataset.delCei,1); refreshCEInfo(); }));
  ov.querySelectorAll('[data-cei-type]').forEach(sel=>sel.addEventListener('change',()=>{ edInfo[+sel.dataset.ceiType].type=sel.value; }));
  ov.querySelectorAll('[data-cei-val]').forEach(inp=>inp.addEventListener('input',()=>{ edInfo[+inp.dataset.ceiVal].value=inp.value; }));
}

function renderCEInfoRow(ci, i) {
  const REDES_CE=[{id:'telefono',label:'Teléfono',icon:'📞'},{id:'email',label:'Email',icon:'✉'},{id:'otro',label:'Otro',icon:'◎'}];
  return `<div style="display:flex;gap:6px;align-items:center">
    <select data-cei-type="${i}" style="flex-shrink:0;width:110px">
      ${REDES_CE.map(r=>`<option value="${r.id}" ${ci.type===r.id?'selected':''}>${r.icon} ${r.label}</option>`).join('')}
    </select>
    <input type="text" data-cei-val="${i}" value="${escC(ci.value)}" placeholder="valor…" style="flex:1">
    <button class="icon-btn" data-del-cei="${i}">✕</button>
  </div>`;
}

// ═══════════════════════════════════════════════
// BIBLIOTECA
// ═══════════════════════════════════════════════
const REC_CATS = [
  {id:'articulo',   label:'Artículo',    icon:'◧', color:'#90c4ff', bg:'rgba(144,196,255,.12)'},
  {id:'video',      label:'Vídeo',       icon:'▶', color:'#ff8ae2', bg:'rgba(255,138,226,.12)'},
  {id:'libro',      label:'Libro',       icon:'◫', color:'#ffd580', bg:'rgba(255,213,128,.12)'},
  {id:'herramienta',label:'Herramienta', icon:'⚙', color:'#8affe0', bg:'rgba(138,255,224,.12)'},
  {id:'audio',      label:'Audio',       icon:'◉', color:'#a08aff', bg:'rgba(160,138,255,.12)'},
  {id:'otro',       label:'Otro',        icon:'◌', color:'#6e6a90', bg:'rgba(110,106,144,.12)'},
];
const DOC_CATS = [
  {id:'personal',   label:'Personal',   color:'#a08aff'},
  {id:'medico',     label:'Médico',     color:'#ff7f7f'},
  {id:'legal',      label:'Legal',      color:'#ffd580'},
  {id:'sistema',    label:'Sistema',    color:'#8affe0'},
  {id:'otro',       label:'Otro',       color:'#6e6a90'},
];
const REDES = [
  {id:'telefono', label:'Teléfono', icon:'📞'},
  {id:'email',    label:'Email',    icon:'✉'},
  {id:'instagram',label:'Instagram',icon:'◈'},
  {id:'twitter',  label:'Twitter',  icon:'◭'},
  {id:'otro',     label:'Otro',     icon:'◎'},
];

let bibRecCat = 'all';
let bibDocCat = 'all';

// ── STORAGE ──
function loadContactos()   { try { return JSON.parse(localStorage.getItem('tid_contactos'))||[];  } catch{return[];} }
function saveContactos(d)  { localStorage.setItem('tid_contactos', JSON.stringify(d)); }
function loadRecursos()    { try { return JSON.parse(localStorage.getItem('tid_recursos'))||[];   } catch{return[];} }
function saveRecursos(d)   { localStorage.setItem('tid_recursos', JSON.stringify(d)); }
function loadDocumentos()  { try { return JSON.parse(localStorage.getItem('tid_documentos'))||[]; } catch{return[];} }
function saveDocumentos(d) { localStorage.setItem('tid_documentos', JSON.stringify(d)); }

function escB(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── MAIN ──
let bibTab = 'contactos';

window.AtriaCrisisView = Object.freeze({ render: renderCrisis });
