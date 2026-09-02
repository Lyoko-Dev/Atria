(function (global) {
  'use strict';

  function render() {
    const es = document.documentElement.lang === 'es' || /(?:^|\/)es(?:\/|$)/.test(location.pathname);
    const copy = es ? {
      crumb:'Recordatorios', title:'Recordatorios', add:'+ Nuevo', empty:'🔔 Sin recordatorios · Crea uno para no olvidar nada', pending:'Pendientes', done:'Completados', repeat:'Repetición', snooze:'Posponer 15 min', edit:'Editar', del:'Eliminar', mark:'Marcar hecho', system:'Todo el sistema', deleted:'Recordatorio eliminado', snoozed:'Recordatorio pospuesto 15 min', recurrence:'↻ Repetición: ', dateLocale:'es-ES'
    } : {
      crumb:'Reminders', title:'Reminders', add:'+ New', empty:'🔔 No reminders · Create one so you do not forget anything', pending:'Pending', done:'Completed', repeat:'Repeat', snooze:'Snooze 15 min', edit:'Edit', del:'Delete', mark:'Mark done', system:'Entire system', deleted:'Reminder deleted', snoozed:'Reminder snoozed 15 min', recurrence:'↻ Repeat: ', dateLocale:'en-GB'
    };
    setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:copy.crumb}]);
    const app = document.getElementById('app');
    const reminders = loadReminders();
    const now = Date.now();
    const alters = getAlters();
    const active = reminders.filter(r=>!r.done).sort((a,b)=>a.datetime-b.datetime);
    const done = reminders.filter(r=>r.done).sort((a,b)=>b.datetime-a.datetime).slice(0,10);
    const renderCard = r => {
      const dt = new Date(r.datetime);
      const overdue = !r.done && r.datetime < now && r.recurrence === 'none';
      const snoozed = r.snoozedUntil && r.snoozedUntil > now;
      const alter = r.alterId ? alters.find(a=>a.id===r.alterId) : null;
      const date = `${dt.toLocaleDateString(copy.dateLocale,{weekday:'short',day:'numeric',month:'short'})} · ${dt.toLocaleTimeString(copy.dateLocale,{hour:'2-digit',minute:'2-digit'})}`;
      const rec = REMINDER_RECURRENCE.find(x=>x.id===r.recurrence)?.label || '';
      return `<div class="reminder-card${r.done?' done':''}${overdue?' overdue':''}" data-id="${r.id}">
        <div class="reminder-icon" style="background:rgba(160,138,255,.12)">${r.icon||'🔔'}</div>
        <div class="reminder-body"><div class="reminder-title">${esc(r.title)}</div><div class="reminder-time">${overdue?'⚠ ':''}${date}</div>${r.desc?`<div class="reminder-desc">${esc(r.desc)}</div>`:''}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">${rec && rec !== (es?'Sin repetición':'No repeat')?`<div class="reminder-recurrence">↻ ${esc(rec)}</div>`:''}${alter?`<div class="reminder-recurrence" style="color:${alter.color}">${esc(alter.name)}</div>`:''}</div></div>
        <div class="reminder-actions">${!r.done?`<button class="icon-btn" data-done="${r.id}" title="${copy.mark}">✓</button>`:''}${!r.done?`<button class="icon-btn" data-snooze="${r.id}" title="${copy.snooze}" style="font-size:11px">z</button>`:''}${snoozed?`<span style="font-size:10px;color:var(--text-3);font-family:'DM Mono',monospace">zz ${new Date(r.snoozedUntil).toLocaleTimeString(copy.dateLocale,{hour:'2-digit',minute:'2-digit'})}</span>`:''}<button class="icon-btn" data-edit="${r.id}" title="${copy.edit}">✎</button><button class="icon-btn" data-del="${r.id}" title="${copy.del}">✕</button></div>
      </div>`;
    };
    app.innerHTML = `<div class="reminders-view" data-reminders-module="modular"><div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:15px;font-weight:700">${copy.title}</div><button class="btn btn-primary btn-sm" id="btn-new-reminder">${copy.add}</button></div>${!active.length&&!done.length?`<div class="reminders-empty">${copy.empty}</div>`:''}${active.length?`<div><div class="reminder-section-label">${copy.pending} (${active.length})</div>${active.map(renderCard).join('')}</div>`:''}${done.length?`<div><div class="reminder-section-label">${copy.done}</div>${done.map(renderCard).join('')}</div>`:''}</div>`;
    app.querySelector('#btn-new-reminder')?.addEventListener('click',()=>openReminderModal(null,render));
    app.querySelectorAll('[data-done]').forEach(btn=>btn.addEventListener('click',()=>{
      const list=loadReminders(); const r=list.find(x=>x.id===btn.dataset.done); if(!r)return;
      if(r.recurrence&&r.recurrence!=='none'){const dt=new Date(r.datetime); if(r.recurrence==='every8h')dt.setTime(dt.getTime()+8*3600*1000); if(r.recurrence==='daily')dt.setDate(dt.getDate()+1); if(r.recurrence==='weekly')dt.setDate(dt.getDate()+7); if(r.recurrence==='monthly')dt.setMonth(dt.getMonth()+1); r.datetime=dt.getTime(); showToast(copy.recurrence+dt.toLocaleDateString(copy.dateLocale,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}));} else r.done=true;
      saveReminders(list); render();
    }));
    app.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>{const r=loadReminders().find(x=>x.id===btn.dataset.edit);if(r)openReminderModal(r,render);}));
    app.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click',()=>{const all=loadReminders(),r=all.find(x=>x.id===btn.dataset.del);if(!r)return;saveReminders(all.filter(x=>x.id!==r.id));render();softDelete(copy.deleted,()=>{},()=>{const cur=loadReminders();cur.push(r);saveReminders(cur);render();});}));
    app.querySelectorAll('[data-snooze]').forEach(btn=>btn.addEventListener('click',()=>{const list=loadReminders(),r=list.find(x=>x.id===btn.dataset.snooze);if(!r)return;r.snoozedUntil=Date.now()+15*60*1000;saveReminders(list);showToast(copy.snoozed);render();}));
    checkReminderAlerts();
  }

  global.AtriaReminderView = Object.freeze({ render });
})(window);
