function renderAgenda() {
  if (activeAlter && activeAlter.permissions !== undefined && !activeAlter.permissions?.agenda) {
    document.getElementById('app').innerHTML = `<div class="empty-state" style="margin-top:60px"><div class="empty-icon">🔒</div><div>You do not have permission to access Agenda</div></div>`;
    return;
  }
  setCrumbs([
    {label:'Hub',action:()=>navigateTo('hub')},
    {label:'Agenda'},
  ]);
  document.getElementById('app').innerHTML = `
    <div class="agenda-view" id="agenda-root">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◷ Agenda</div>
          <div class="fin-subtitle">Events for ${activeAlter.name} and shared</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="agenda-view-tabs">
            <div class="agenda-view-tab ${agendaView==='mes'?'active':''}" data-av="mes">Month</div>
            <div class="agenda-view-tab ${agendaView==='semana'?'active':''}" data-av="semana">Week</div>
            <div class="agenda-view-tab ${agendaView==='lista'?'active':''}" data-av="lista">List</div>
          </div>
          <button class="btn btn-ghost" id="btn-export-agenda-ics">ICS</button>
          <button class="btn btn-primary" id="btn-add-event">+ Event</button>
        </div>
      </div>
      <div id="agenda-content"></div>
    </div>`;

  document.querySelectorAll('[data-av]').forEach(t =>
    t.addEventListener('click', () => { agendaView = t.dataset.av; renderAgendaContent(); renderAgenda(); })
  );
  document.getElementById('btn-export-agenda-ics')?.addEventListener('click', () => openCSVRangeModal('Share agenda', exportAgendaICS, 'Share / export calendar'));
  document.getElementById('btn-add-event').addEventListener('click', () => openEventModal(null));
  renderAgendaContent();
}

function renderAgendaContent() {
  const c = document.getElementById('agenda-content');
  if (!c) return;
  if (agendaView === 'mes')    renderCalMonth(c);
  else if (agendaView === 'semana') renderCalWeek(c);
  else renderAgendaList(c);
}

// ─── MONTH VIEW ───
function renderCalMonth(container) {
  const {month, year} = agendaCal;
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const startDow = (firstDay.getDay()+6)%7; // Mon=0
  const from = new Date(year, month, 1-startDow);
  const to   = new Date(year, month+1, 7);

  const events = expandRecurring(getVisibleEvents(), from, to);
  const byDate = {};
  events.forEach(e => {
    const k = e._instanceDate || e.date;
    if(!byDate[k]) byDate[k]=[];
    byDate[k].push(e);
  });

  const monthLabel = new Date(year,month,1).toLocaleString('en-GB',{month:'long',year:'numeric'});
  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // Local date formatter (avoids UTC offset shift in UTC+ timezones)
  const localDateStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayIso = localDateStr(today);

  let cells = '';
  let cur = new Date(from);
  while (cur <= lastDay || cur.getDay() !== 1) {
    const iso = localDateStr(cur);
    const isToday = iso === todayIso;
    const isOther = cur.getMonth() !== month;
    const dayEvs = byDate[iso]||[];
    const maxShow = 2;
    cells += `<div class="cal-day${isOther?' other-month':''}${isToday?' today':''}" data-date="${iso}">
      <div class="cal-day-num">${cur.getDate()}</div>
      ${dayEvs.slice(0,maxShow).map(e=>`
        <div class="cal-event-dot" style="background:${e.color||'var(--accent)'}22;color:${e.color||'var(--accent)'}" data-eid="${e.id}" title="${e.title}">
          ${e.title}
        </div>`).join('')}
      ${dayEvs.length>maxShow?`<div class="cal-more">+${dayEvs.length-maxShow} more</div>`:''}
    </div>`;
    cur.setDate(cur.getDate()+1);
    if(cur > lastDay && cur.getDay()===1) break;
  }

  container.innerHTML = `
    <div class="cal-grid-wrap">
      <div class="cal-header">
        <div class="cal-month-label" style="text-transform:capitalize">${monthLabel}</div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" id="cal-today-btn">Today</button>
          <div class="cal-nav">
            <div class="cal-nav-btn" id="cal-prev">‹</div>
            <div class="cal-nav-btn" id="cal-next">›</div>
          </div>
        </div>
      </div>
      <div class="cal-weekdays">${weekdays.map(w=>`<div class="cal-weekday">${w}</div>`).join('')}</div>
      <div class="cal-days">${cells}</div>
    </div>`;

  document.getElementById('cal-prev').addEventListener('click', () => {
    agendaCal.month--; if(agendaCal.month<0){agendaCal.month=11;agendaCal.year--;}
    renderAgendaContent();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    agendaCal.month++; if(agendaCal.month>11){agendaCal.month=0;agendaCal.year++;}
    renderAgendaContent();
  });
  document.getElementById('cal-today-btn').addEventListener('click', () => {
    agendaCal = {month:new Date().getMonth(), year:new Date().getFullYear()};
    renderAgendaContent();
  });
  container.querySelectorAll('.cal-day').forEach(d =>
    d.addEventListener('click', e => {
      if(!e.target.closest('.cal-event-dot')) openEventModal(null, d.dataset.date);
    })
  );
  container.querySelectorAll('.cal-event-dot').forEach(dot =>
    dot.addEventListener('click', e => {
      e.stopPropagation();
      const ev = loadEvents().find(x=>x.id===dot.dataset.eid);
      if(ev) openEventDetail(ev);
    })
  );
}

// ─── WEEK VIEW ───
function renderCalWeek(container) {
  const today = new Date();
  // Get Monday of agendaWeek
  const dow = (agendaWeek.getDay()+6)%7;
  const monday = new Date(agendaWeek);
  monday.setDate(monday.getDate()-dow);
  const days = Array.from({length:7},(_,i)=>{ const d=new Date(monday); d.setDate(d.getDate()+i); return d; });
  const from = days[0], to = days[6];

  const events = expandRecurring(getVisibleEvents(), from, new Date(to.getTime()+86400000));
  const hours = Array.from({length:24},(_,i)=>i);
  const weekLabel = `${monday.toLocaleString('en-GB',{day:'numeric',month:'short'})} – ${days[6].toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;

  container.innerHTML = `
    <div class="week-grid">
      <div class="cal-header">
        <div class="cal-month-label">${weekLabel}</div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" id="week-today-btn">Today</button>
          <div class="cal-nav">
            <div class="cal-nav-btn" id="week-prev">‹</div>
            <div class="cal-nav-btn" id="week-next">›</div>
          </div>
        </div>
      </div>
      <div class="week-header">
        <div style="border-right:1px solid var(--border)"></div>
        ${days.map(d=>{
          const iso=localDateKey(d);
          const isTod=iso===localDateKey(today);
          return `<div class="week-header-day">
            <div class="week-header-label">${d.toLocaleString('en-GB',{weekday:'short'}).toUpperCase()}</div>
            <div class="week-header-num${isTod?' today':''}">${d.getDate()}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="week-body" id="week-body">
        <div class="week-time-col">
          ${hours.map(h=>`<div class="week-time-slot"><div class="week-time-label">${String(h).padStart(2,'0')}:00</div></div>`).join('')}
        </div>
        ${days.map(d=>{
          const iso=localDateKey(d);
          const dayEvs=events.filter(e=>e._instanceDate===iso&&e.time);
          return `<div class="week-day-col" data-date="${iso}">
            ${hours.map(h=>`<div style="height:44px;border-bottom:1px solid var(--border)"></div>`).join('')}
            ${dayEvs.map(e=>{
              const [hh,mm]=e.time.split(':').map(Number);
              const top=hh*44+Math.round(mm/60*44);
              const dur=e.duration||60;
              const height=Math.max(22,Math.round(dur/60*44));
              return `<div class="week-event" style="top:${top}px;height:${height}px;background:${e.color||'var(--accent)'}22;color:${e.color||'var(--accent)'};border-left:2px solid ${e.color||'var(--accent)'}" data-eid="${e.id}">
                ${e.time} ${e.title}
              </div>`;
            }).join('')}
          </div>`;
        }).join('')}
      </div>
    </div>`;

  document.getElementById('week-prev').addEventListener('click',()=>{ agendaWeek.setDate(agendaWeek.getDate()-7); renderAgendaContent(); });
  document.getElementById('week-next').addEventListener('click',()=>{ agendaWeek.setDate(agendaWeek.getDate()+7); renderAgendaContent(); });
  document.getElementById('week-today-btn').addEventListener('click',()=>{ agendaWeek=new Date(); renderAgendaContent(); });
  container.querySelectorAll('.week-event').forEach(el=>el.addEventListener('click',e=>{
    e.stopPropagation();
    const ev=loadEvents().find(x=>x.id===el.dataset.eid);
    if(ev) openEventDetail(ev);
  }));
  container.querySelectorAll('.week-day-col').forEach(col=>col.addEventListener('click',e=>{
    if(!e.target.closest('.week-event')) openEventModal(null,col.dataset.date);
  }));
}

// ─── LIST VIEW ───
function renderAgendaList(container) {
  const today = new Date();
  const from  = new Date(today); from.setDate(from.getDate()-7);
  const to    = new Date(today); to.setDate(to.getDate()+60);
  const events = expandRecurring(getVisibleEvents(), from, to)
    .sort((a,b)=>a._instanceDate.localeCompare(b._instanceDate)||(a.time||'').localeCompare(b.time||''));

  const alters = getAlters();
  if(!events.length){
    container.innerHTML=`<div class="empty-state"><div class="empty-icon">◷</div><div>No upcoming events</div></div>`;
    return;
  }

  // Group by date
  const byDate={};
  events.forEach(e=>{ const k=e._instanceDate; if(!byDate[k])byDate[k]=[]; byDate[k].push(e); });

  container.innerHTML=`<div class="agenda-list">
    ${Object.entries(byDate).map(([iso,evs])=>{
      const d=new Date(iso+'T12:00:00');
      const isTod=iso===localDateKey(today);
      const label=isTod?'HOY · '+d.toLocaleString('en-GB',{weekday:'long',day:'numeric',month:'long'}):
        d.toLocaleString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      return `<div class="agenda-list-day">
        <div class="agenda-list-date${isTod?' today-label':''}">${label.toUpperCase()}</div>
        ${evs.map(e=>{
          const alt=alters.find(a=>a.id===e.alterId);
          const et=EVENT_TYPES.find(x=>x.id===e.type);
          return `<div class="agenda-event-row" data-eid="${e.id}">
            <div class="event-color-bar" style="background:${e.color||'var(--accent)'}"></div>
            <div style="font-size:16px">${et?.emoji||'◎'}</div>
            <div class="event-time">${e.allDay||!e.time?'All day':e.time}</div>
            <div class="event-title">${e.title}${e.recur&&e.recur!=='none'?` <span class="event-recur-badge">↺ ${RECUR_OPTS.find(r=>r.id===e.recur)?.label||''}</span>`:''}</div>
            ${e.scope==='compartido'?`<span class="event-alter-chip" style="background:rgba(138,255,224,.1);color:var(--accent-3)">shared</span>`:
              alt?`<span class="event-alter-chip" style="background:${alt.bg};color:${alt.color}">${alt.emoji} ${alt.name}</span>`:''}
            ${e.reminder?`<div class="event-reminder-dot" title="Active reminder"></div>`:''}
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}
  </div>`;

  container.querySelectorAll('.agenda-event-row').forEach(row=>row.addEventListener('click',()=>{
    const ev=loadEvents().find(x=>x.id===row.dataset.eid);
    if(ev) openEventDetail(ev);
  }));
}

// ─── EVENT DETAIL ───
function openEventDetail(ev) {
  const alters = getAlters();
  const alt = alters.find(a=>a.id===ev.alterId);
  const et  = EVENT_TYPES.find(x=>x.id===ev.type);
  openModal(`
    <div style="display:flex;align-items:flex-start;gap:14px">
      <div style="font-size:36px">${et?.emoji||'◎'}</div>
      <div style="flex:1">
        <div class="modal-title">${ev.title}</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2);margin-top:4px;display:flex;flex-wrap:wrap;gap:8px">
          <span>📅 ${fmtDate(ev.date)}${ev.allDay||!ev.time?' · All day':ev.time?' · '+ev.time:''}</span>
          ${ev.recur&&ev.recur!=='none'?`<span>↺ ${RECUR_OPTS.find(r=>r.id===ev.recur)?.label||''}</span>`:''}
          ${ev.duration?`<span>⏱ ${ev.duration} min</span>`:''}
          <span style="color:${ev.scope==='compartido'?'var(--accent-3)':'var(--accent)'}">${ev.scope==='compartido'?'🌐 Shared':'🔒 Personal'}</span>
        </div>
      </div>
    </div>
    ${alt?`<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:${alt.bg};border-radius:8px;border:1px solid ${alt.color}22">
      <span>${alt.emoji}</span><span style="font-size:13px;font-weight:600;color:${alt.color}">${alt.name}</span>
      <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">${alt.role}</span>
    </div>`:''}
    ${ev.note?`<div style="font-size:13px;color:var(--text-1);line-height:1.6;padding:12px 14px;background:var(--bg-2);border-radius:8px">${ev.note}</div>`:''}
    ${ev.reminder?`<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent-4)">🔔 Active reminder</div>`:''}
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Close</button>
      <button class="btn btn-ghost" id="det-edit-btn">✎ Edit</button>
      <button class="btn btn-danger" id="det-del-btn">✕ Delete</button>
    </div>`,
    () => {}
  );
  document.getElementById('det-edit-btn')?.addEventListener('click',()=>{ closeModal(); openEventModal(ev); });
  document.getElementById('det-del-btn')?.addEventListener('click',()=>{
    if(!confirm('Delete this event?')) return;
    saveEvents(loadEvents().filter(x=>x.id!==ev.id));
    closeModal();
    showToast('Event deleted');
    renderAgendaContent();
  });
}

// ─── EVENT MODAL ───
window.AtriaAgendaView = Object.freeze({ render: renderAgenda });
