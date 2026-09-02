(function () {
  const ROOMS_KEY = 'tid_headspace_rooms';
  const MOVES_KEY = 'tid_headspace_presence';
  const RELS_KEY = 'tid_internal_relationships';
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'es';
  const copy = {
    es: {
      headspace:'Headspace', map:'Mapa', timeline:'Timeline', manage:'Gestion',
      relations:'Relaciones', newRoom:'Nueva sala', room:'Sala', rooms:'Salas',
      name:'Nombre', description:'Descripcion', color:'Color', icon:'Icono', save:'Guardar', cancel:'Cancelar',
      archive:'Archivar', restore:'Restaurar', edit:'Editar', move:'Mover', current:'Ubicacion actual',
      noRooms:'Todavia no hay salas. Crea la primera desde Gestion.', noMoves:'Todavia no hay movimientos.',
      identity:'Alter / miembro', destination:'Destino', note:'Nota', now:'Ahora', source:'Origen',
      manual:'manual', unassigned:'Sin sala', addMove:'Registrar movimiento', archived:'Archivadas',
      noRelations:'Todavia no hay relaciones internas.', newRelation:'Nueva relacion', from:'Desde', to:'Hacia',
      type:'Tipo', label:'Etiqueta opcional', details:'Detalles', add:'Añadir', delete:'Eliminar',
      types:{family:'Familia', friendship:'Amistad', protective:'Proteccion', conflict:'Conflicto', romantic:'Romantica', collaboration:'Colaboracion', other:'Otra'},
      selfError:'El origen y el destino deben ser diferentes', saved:'Guardado', invalid:'Selecciona origen, destino y tipo',
      private:'Privado/local: no se comparte online', noAlter:'Crea un alter antes de usar este modulo',
    },
    en: {
      headspace:'Headspace', map:'Map', timeline:'Timeline', manage:'Manage',
      relations:'Relationships', newRoom:'New room', room:'Room', rooms:'Rooms',
      name:'Name', description:'Description', color:'Color', icon:'Icon', save:'Save', cancel:'Cancel',
      archive:'Archive', restore:'Restore', edit:'Edit', move:'Move', current:'Current location',
      noRooms:'No rooms yet. Create the first one from Manage.', noMoves:'No movements yet.',
      identity:'Alter / member', destination:'Destination', note:'Note', now:'Now', source:'Source',
      manual:'manual', unassigned:'Unassigned', addMove:'Record movement', archived:'Archived',
      noRelations:'No internal relationships yet.', newRelation:'New relationship', from:'From', to:'To',
      type:'Type', label:'Optional label', details:'Details', add:'Add', delete:'Delete',
      types:{family:'Family', friendship:'Friendship', protective:'Protective', conflict:'Conflict', romantic:'Romantic', collaboration:'Collaboration', other:'Other'},
      selfError:'Source and target must be different', saved:'Saved', invalid:'Select source, target, and type',
      private:'Private/local: not shared online', noAlter:'Create an alter before using this module',
    },
  };
  const t = key => copy[lang()][key] || key;
  const escI = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uidI = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const read = key => { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const alters = () => typeof getAlters === 'function' ? getAlters(true) : [];
  const alterName = id => alters().find(a => a.id === id)?.name || t('unassigned');
  const roomName = id => read(ROOMS_KEY).find(r => r.id === id)?.name || t('unassigned');
  const avatar = a => a?.avatarImg ? `<img src="${a.avatarImg}" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover">` : escI(a?.emoji || '◎');
  const shell = (title, body, crumbs) => {
    const app = document.getElementById('app');
    if (!app) return null;
    if (typeof setCrumbs === 'function') setCrumbs(crumbs || [{label:'Hub',action:()=>navigateTo('hub')},{label:title}]);
    app.innerHTML = `<div class="org-shell" style="max-width:1100px;width:100%;box-sizing:border-box;margin:0 auto;display:flex;flex-direction:column;gap:16px;animation:fadeUp 360ms ease both"><div><div style="font-size:24px;font-weight:800">${escI(title)}</div><div style="font-size:11px;color:var(--text-3);margin-top:4px">${escI(t('private'))}</div></div>${body}</div>`;
    return app;
  };
  const tabs = (active, base) => `<div class="module-tabs" style="display:flex;gap:6px;flex-wrap:wrap"><button class="module-tab ${active==='map'?'active':''}" data-org-tab="map">${escI(t('map'))}</button><button class="module-tab ${active==='timeline'?'active':''}" data-org-tab="timeline">${escI(t('timeline'))}</button><button class="module-tab ${active==='manage'?'active':''}" data-org-tab="manage">${escI(t('manage'))}</button></div>`;
  function renderHeadspace(tab = 'map') {
    const rooms = read(ROOMS_KEY).sort((a,b)=>(a.order||0)-(b.order||0));
    const moves = read(MOVES_KEY).sort((a,b)=>(b.ts||0)-(a.ts||0));
    const people = alters();
    if (!people.length) return shell(t('headspace'), `<div class="empty-state">${escI(t('noAlter'))}</div>`);
    let body = tabs(tab, 'headspace');
    if (tab === 'map') {
      const current = new Map();
      moves.forEach(m => { if (!current.has(m.alterId)) current.set(m.alterId, m); });
      body += `<div style="display:flex;justify-content:flex-end"><button class="btn btn-primary" id="hs-open-move">↗ ${escI(t('addMove'))}</button></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">${rooms.filter(r=>!r.archived).map(r=>{
        const occupants = people.filter(a=>current.get(a.id)?.roomId===r.id);
        return `<section style="border:1px solid ${escI(r.color||'var(--border)')};border-radius:14px;padding:14px;background:linear-gradient(145deg,${escI(r.color||'#8ab4ff')}18,transparent)"><div style="font-size:22px">${escI(r.icon||'⌂')}</div><h3 style="margin:6px 0 3px">${escI(r.name)}</h3><div style="font-size:11px;color:var(--text-3);min-height:28px">${escI(r.description||'')}</div><div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px">${occupants.length?occupants.map(a=>`<span title="${escI(a.name)}" style="display:flex;align-items:center;gap:5px;padding:5px 8px;border-radius:20px;background:${escI(a.bg||'var(--bg-2)')};border:1px solid ${escI(a.color||'var(--border)')}">${avatar(a)}<span style="font-size:11px">${escI(a.name)}</span></span>`).join(''):`<span style="font-size:11px;color:var(--text-3)">${escI(t('unassigned'))}</span>`}</div></section>`;
      }).join('')}${rooms.filter(r=>!r.archived).length?'':`<div class="empty-state">${escI(t('noRooms'))}</div>`}</div>`;
      const unassigned = people.filter(a=>!current.get(a.id)?.roomId || !rooms.some(r=>r.id===current.get(a.id)?.roomId&&!r.archived));
      if (unassigned.length) body += `<div style="border:1px dashed var(--border);border-radius:12px;padding:12px"><strong>${escI(t('unassigned'))}</strong><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${unassigned.map(a=>`<span style="padding:5px 9px;border-radius:16px;background:var(--bg-2)">${avatar(a)} ${escI(a.name)}</span>`).join('')}</div></div>`;
    } else if (tab === 'timeline') {
      body += `<div style="display:flex;flex-direction:column;gap:8px">${moves.length?moves.map(m=>`<article style="display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--bg-2)"><div style="font-size:20px">↗</div><div style="flex:1"><strong>${escI(alterName(m.alterId))}</strong><div style="font-size:12px;margin-top:3px">${escI(roomName(m.roomId))}</div><div style="font-size:11px;color:var(--text-3);margin-top:3px">${new Date(m.ts).toLocaleString(lang()==='en'?'en-GB':'es-ES')} · ${escI(m.source||t('manual'))}${m.note?' · '+escI(m.note):''}</div></div></article>`).join(''):`<div class="empty-state">${escI(t('noMoves'))}</div>`}</div>`;
    } else {
      body += `<div style="display:flex;justify-content:flex-end"><button class="btn btn-primary" id="hs-add-room">+ ${escI(t('newRoom'))}</button></div><div style="display:flex;flex-direction:column;gap:8px">${rooms.length?rooms.map(r=>`<article style="display:flex;gap:10px;align-items:center;padding:12px;border:1px solid var(--border);border-radius:12px;opacity:${r.archived?.55:1}"><span style="font-size:22px">${escI(r.icon||'⌂')}</span><div style="flex:1"><strong>${escI(r.name)}</strong><div style="font-size:11px;color:var(--text-3)">${escI(r.description||'')}</div></div><button class="btn btn-ghost hs-edit-room" data-id="${escI(r.id)}">${escI(t('edit'))}</button><button class="btn btn-ghost hs-archive-room" data-id="${escI(r.id)}">${escI(r.archived?t('restore'):t('archive'))}</button></article>`).join(''):`<div class="empty-state">${escI(t('noRooms'))}</div>`}</div>`;
    }
    const app = shell(t('headspace'), body);
    app.querySelectorAll('[data-org-tab]').forEach(b=>b.addEventListener('click',()=>renderHeadspace(b.dataset.orgTab)));
    app.querySelector('#hs-add-room')?.addEventListener('click',()=>openRoomForm());
    app.querySelectorAll('.hs-edit-room').forEach(b=>b.addEventListener('click',()=>openRoomForm(b.dataset.id)));
    app.querySelectorAll('.hs-archive-room').forEach(b=>b.addEventListener('click',()=>{const all=read(ROOMS_KEY);const r=all.find(x=>x.id===b.dataset.id);if(r){r.archived=!r.archived;write(ROOMS_KEY,all);renderHeadspace('manage');}}));
    app.querySelector('#hs-open-move')?.addEventListener('click',()=>openMoveForm());
  }
  function openRoomForm(id) {
    const old = read(ROOMS_KEY).find(r=>r.id===id) || {name:'',description:'',color:'#8ab4ff',icon:'⌂'};
    const app = document.getElementById('app');
    app.querySelector('#hs-room-form')?.remove();
    const form = document.createElement('div'); form.id='hs-room-form'; form.style.cssText='border:1px solid var(--border);border-radius:14px;padding:14px;background:var(--bg-2)';
    form.innerHTML=`<h3 style="margin:0 0 12px">${escI(id?t('edit'):t('newRoom'))}</h3><div class="org-form-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><input id="hs-r-name" placeholder="${escI(t('name'))}" value="${escI(old.name)}"><input id="hs-r-icon" placeholder="${escI(t('icon'))}" value="${escI(old.icon)}"><input id="hs-r-color" type="color" value="${escI(old.color||'#8ab4ff')}"><input id="hs-r-desc" placeholder="${escI(t('description'))}" value="${escI(old.description)}"></div><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-primary" id="hs-r-save">${escI(t('save'))}</button><button class="btn btn-ghost" id="hs-r-cancel">${escI(t('cancel'))}</button></div>`;
    app.querySelector('[data-org-tab="manage"]')?.after(form); form.scrollIntoView({behavior:'smooth',block:'nearest'});
    form.querySelector('#hs-r-cancel').onclick=()=>form.remove();
    form.querySelector('#hs-r-save').onclick=()=>{const name=form.querySelector('#hs-r-name').value.trim();if(!name)return;const all=read(ROOMS_KEY);const item={...(all.find(r=>r.id===id)||{}),id:id||uidI('room'),name,icon:form.querySelector('#hs-r-icon').value.trim()||'⌂',color:form.querySelector('#hs-r-color').value,description:form.querySelector('#hs-r-desc').value.trim(),archived:false,order:id?(all.find(r=>r.id===id)?.order||0):all.length};const next=id?all.map(r=>r.id===id?item:r):[...all,item];write(ROOMS_KEY,next);renderHeadspace('manage');};
  }
  function openMoveForm() {
    const app = document.getElementById('app'); const people=alters(); const rooms=read(ROOMS_KEY).filter(r=>!r.archived); const form=document.createElement('div');form.style.cssText='border:1px solid var(--border);border-radius:14px;padding:14px;background:var(--bg-2);margin:10px 0';
    form.innerHTML=`<h3 style="margin:0 0 12px">${escI(t('addMove'))}</h3><div class="org-form-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><select id="hs-m-person"><option value="">${escI(t('identity'))}</option>${people.map(a=>`<option value="${escI(a.id)}">${escI(a.name)}</option>`).join('')}</select><select id="hs-m-room"><option value="">${escI(t('destination'))}</option>${rooms.map(r=>`<option value="${escI(r.id)}">${escI(r.icon||'⌂')} ${escI(r.name)}</option>`).join('')}</select><input id="hs-m-note" placeholder="${escI(t('note'))}"></div><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-primary" id="hs-m-save">${escI(t('save'))}</button><button class="btn btn-ghost" id="hs-m-cancel">${escI(t('cancel'))}</button></div>`;
    app.querySelector('#hs-open-move')?.after(form);form.querySelector('#hs-m-cancel').onclick=()=>form.remove();form.querySelector('#hs-m-save').onclick=()=>{const alterId=form.querySelector('#hs-m-person').value,roomId=form.querySelector('#hs-m-room').value;if(!alterId||!roomId)return;const all=read(MOVES_KEY);all.push({id:uidI('move'),alterId,roomId,ts:Date.now(),note:form.querySelector('#hs-m-note').value.trim(),source:'manual'});write(MOVES_KEY,all);renderHeadspace('map');};
  }
  function renderRelations() {
    const people=alters(), rels=read(RELS_KEY); let body=`<div style="display:flex;justify-content:flex-end"><button class="btn btn-primary" id="rel-new">+ ${escI(t('newRelation'))}</button></div>`;
    body+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">${people.map(a=>`<div style="padding:12px;border:1px solid ${escI(a.color||'var(--border)')};border-radius:12px;background:${escI(a.bg||'var(--bg-2)')};display:flex;gap:8px;align-items:center">${avatar(a)}<div><strong>${escI(a.name)}</strong><div style="font-size:10px;color:var(--text-3)">${escI(a.role||'')}</div></div></div>`).join('')}</div>`;
    body+=`<div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">${rels.length?rels.map(r=>`<article style="display:flex;gap:10px;align-items:center;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--bg-2)"><div style="font-size:20px">↔</div><div style="flex:1"><strong>${escI(alterName(r.fromId))} ↔ ${escI(alterName(r.toId))}</strong><div style="font-size:11px;color:var(--accent);margin-top:3px">${escI(copy[lang()].types[r.type]||r.type)}${r.label?' · '+escI(r.label):''}</div>${r.note?`<div style="font-size:11px;color:var(--text-3);margin-top:3px">${escI(r.note)}</div>`:''}</div><button class="btn btn-ghost rel-del" data-id="${escI(r.id)}">${escI(t('delete'))}</button></article>`).join(''):`<div class="empty-state">${escI(t('noRelations'))}</div>`}</div>`;
    const app=shell(t('relations'),body);app.querySelector('#rel-new')?.addEventListener('click',()=>openRelationForm());app.querySelectorAll('.rel-del').forEach(b=>b.onclick=()=>{write(RELS_KEY,read(RELS_KEY).filter(r=>r.id!==b.dataset.id));renderRelations();});
  }
  function openRelationForm(){const people=alters();const app=document.getElementById('app');const form=document.createElement('div');form.style.cssText='border:1px solid var(--border);border-radius:14px;padding:14px;background:var(--bg-2);margin:10px 0';form.innerHTML=`<h3 style="margin:0 0 12px">${escI(t('newRelation'))}</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px"><select id="rel-from"><option value="">${escI(t('from'))}</option>${people.map(a=>`<option value="${escI(a.id)}">${escI(a.name)}</option>`).join('')}</select><select id="rel-to"><option value="">${escI(t('to'))}</option>${people.map(a=>`<option value="${escI(a.id)}">${escI(a.name)}</option>`).join('')}</select><select id="rel-type"><option value="">${escI(t('type'))}</option>${Object.entries(copy[lang()].types).map(([k,v])=>`<option value="${k}">${escI(v)}</option>`).join('')}</select><input id="rel-label" placeholder="${escI(t('label'))}"><input id="rel-note" placeholder="${escI(t('details'))}"></div><div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-primary" id="rel-save">${escI(t('add'))}</button><button class="btn btn-ghost" id="rel-cancel">${escI(t('cancel'))}</button></div>`;app.querySelector('#rel-new').after(form);form.querySelector('#rel-cancel').onclick=()=>form.remove();form.querySelector('#rel-save').onclick=()=>{const fromId=form.querySelector('#rel-from').value,toId=form.querySelector('#rel-to').value,type=form.querySelector('#rel-type').value;if(!fromId||!toId||!type||fromId===toId){showToast(fromId===toId&&fromId?t('selfError'):t('invalid'));return;}const all=read(RELS_KEY);all.push({id:uidI('rel'),fromId,toId,type,label:form.querySelector('#rel-label').value.trim(),note:form.querySelector('#rel-note').value.trim(),createdAt:Date.now()});write(RELS_KEY,all);renderRelations();};}
  window.renderHeadspace = renderHeadspace;
  window.renderRelations = renderRelations;
  window.AtriaInternalOrganization = { ROOMS_KEY, MOVES_KEY, RELS_KEY };
})();
