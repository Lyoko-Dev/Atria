(() => {
  const sections = [
    ['Getting started', 'Learn how to start, change language, and install Atria on your device.', 'Open Atria without an account, or enable online features when you need them.'],
    ['Alters and profiles', 'Create profiles with a name, pronouns, image, role, and personal details.', 'Manage each profile’s images, relationships, and notes from Alters.'],
    ['Fronting', 'Record who is fronting and who is co-fronting.', 'Review your history and statistics whenever you need them.'],
    ['Journal, notes, and feelings', 'Write private entries, save notes, and record emotional states.', 'Your data stays local and can be reviewed over time.'],
    ['Calendar and routines', 'Organize events, appointments, reminders, routines, and tasks.', 'Notifications depend on your device permissions.'],
    ['Projects, finances, and library', 'Manage projects, expenses, budgets, savings, and recurring payments.', 'You can also organize books, films, games, and other interests.'],
    ['Headspace and relationships', 'Use private spaces for internal communication, Headspace, and system relationships.', 'Content stays on your device unless you choose to share it.'],
    ['Polls and analysis', 'Create internal polls and review activity and emotional analysis.', 'Analysis describes your records; it does not diagnose or predict.'],
    ['Online features', 'Create an account, connect devices, add friends, and use chat.', 'Control each friend’s permissions and share only what you choose.'],
    ['Sync and backups', 'Synchronize compatible information and create encrypted backups.', 'You can also export and import a manual backup to recover your data.'],
    ['Privacy', 'Atria works locally and online features are optional.', 'Private data is protected before it leaves your device.'],
    ['From 0.12 to 0.13', 'The upgrade keeps your local data and recognizes the previous format.', 'Migration is automatic. As a precaution, create a backup before upgrading.'],
  ];

  function renderWikiEn() {
    setCrumbs([{label:'Hub', action:()=>navigateTo('hub')}, {label:'Guide'}]);
    const app = document.getElementById('app');
    app.innerHTML = `<div class="page-wrap wiki-view"><div class="page-header"><div><div class="page-eyebrow">ATRIA</div><h1>Atria guide</h1><p class="page-subtitle">Help for the app’s current features.</p></div><button class="btn btn-ghost" id="wiki-lang-es">Español</button></div><div class="wiki-grid">${sections.map(([title,desc,detail])=>`<article class="hub-widget wiki-card"><h2>${title}</h2><p>${desc}</p><p class="wiki-detail">${detail}</p></article>`).join('')}</div></div>`;
    app.querySelector('#wiki-lang-es')?.addEventListener('click',()=>{ window.location.href='../es/index.html'; });
  }
  window.AtriaWikiView = { render: renderWikiEn };
})();
