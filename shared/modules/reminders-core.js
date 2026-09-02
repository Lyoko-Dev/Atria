(function (global) {
  'use strict';

  const isSpanish = document.documentElement.lang === 'es' || /(?:^|\/)es(?:\/|$)/.test(location.pathname);
  const recurrence = isSpanish ? [
    { id:'none', label:'Sin repetición' },
    { id:'every8h', label:'Cada 8 horas' },
    { id:'daily', label:'Cada día' },
    { id:'weekly', label:'Cada semana' },
    { id:'monthly', label:'Cada mes' },
  ] : [
    { id:'none', label:'No repeat' },
    { id:'every8h', label:'Every 8 hours' },
    { id:'daily', label:'Every day' },
    { id:'weekly', label:'Every week' },
    { id:'monthly', label:'Every month' },
  ];
  const icons = ['🔔','💊','🌙','🌿','💧','🍎','📝','⭐','🛡','💜','◎','⚠'];

  function loadReminders() {
    try { return JSON.parse(localStorage.getItem('tid_reminders')) || []; }
    catch (_) { return []; }
  }

  function saveReminders(reminders) {
    localStorage.setItem('tid_reminders', JSON.stringify(reminders));
    if (typeof global.scheduleReminderPushSync === 'function') global.scheduleReminderPushSync();
    if (typeof global.startNotifScheduler === 'function') global.startNotifScheduler();
  }

  global.loadReminders = loadReminders;
  global.saveReminders = saveReminders;
  global.REMINDER_RECURRENCE = recurrence;
  global.REMINDER_ICONS = icons;
  global.AtriaRemindersCore = Object.freeze({ load: loadReminders, save: saveReminders, recurrence, icons });
})(window);
