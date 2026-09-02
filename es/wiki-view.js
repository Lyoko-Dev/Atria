(() => {
  const sections = [
    ['Primeros pasos', 'Cómo empezar, cambiar de idioma e instalar Atria en tu dispositivo.', 'Abre Atria sin cuenta o activa las funciones online cuando las necesites.'],
    ['Alters y perfiles', 'Crea perfiles con nombre, pronombres, imagen, rol y detalles propios.', 'Las imágenes, relaciones y notas de cada perfil se gestionan desde Alters.'],
    ['Fronting', 'Registra quién está al frente y quién comparte el fronting.', 'Consulta el historial y las estadísticas cuando quieras.'],
    ['Diario, notas y emociones', 'Escribe entradas privadas, guarda notas y registra estados emocionales.', 'Los datos se guardan localmente y puedes revisarlos con el tiempo.'],
    ['Agenda y rutinas', 'Organiza eventos, citas, recordatorios, rutinas y tareas.', 'Las notificaciones dependen de los permisos del dispositivo.'],
    ['Proyectos, finanzas y biblioteca', 'Gestiona proyectos, gastos, presupuestos, ahorros y pagos periódicos.', 'También puedes organizar libros, películas, juegos y otros intereses.'],
    ['Headspace y relaciones', 'Usa espacios privados para la comunicación interna, Headspace y relaciones del sistema.', 'El contenido permanece en el dispositivo salvo que decidas compartirlo.'],
    ['Votaciones y análisis', 'Crea votaciones internas y consulta el análisis de actividad y emociones.', 'El análisis describe tus registros; no realiza diagnósticos ni predicciones.'],
    ['Funciones online', 'Crea una cuenta, conecta dispositivos, añade amistades y utiliza el chat.', 'Puedes controlar los permisos de cada amistad y compartir solo lo que elijas.'],
    ['Sincronización y copias', 'Sincroniza información compatible entre dispositivos y crea copias cifradas.', 'También puedes exportar e importar una copia manual para recuperar tus datos.'],
    ['Privacidad', 'Atria funciona localmente y las funciones online son opcionales.', 'Los datos privados se protegen antes de salir del dispositivo.'],
    ['De 0.12 a 0.13', 'La actualización conserva tus datos locales y reconoce el formato anterior.', 'La migración es automática. Como precaución, crea una copia antes de actualizar.'],
  ];

  function renderWikiEs() {
    setCrumbs([{label:'Hub', action:()=>navigateTo('hub')}, {label:'Guía'}]);
    const app = document.getElementById('app');
    app.innerHTML = `<div class="page-wrap wiki-view"><div class="page-header"><div><div class="page-eyebrow">ATRIA</div><h1>Guía de Atria</h1><p class="page-subtitle">Ayuda sobre las funciones actuales de la aplicación.</p></div><button class="btn btn-ghost" id="wiki-lang-en">English</button></div><div class="wiki-grid">${sections.map(([title,desc,detail])=>`<article class="hub-widget wiki-card"><h2>${title}</h2><p>${desc}</p><p class="wiki-detail">${detail}</p></article>`).join('')}</div></div>`;
    app.querySelector('#wiki-lang-en')?.addEventListener('click',()=>{ window.location.href='../en/index.html'; });
  }
  window.AtriaWikiView = { render: renderWikiEs };
})();
