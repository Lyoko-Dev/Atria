// ═══════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════
const ALTER_PERMISSION_IDS = ['finanzas','emociones','diario','comunicacion','agenda','proyectos','normas','wishlist'];
function readStoredAltersState() {
  const raw = localStorage.getItem('tid_alters');
  if (raw == null) return { status:'missing', alters:[] };
  try {
    const parsed = JSON.parse(raw);
    let list = [];
    if (Array.isArray(parsed)) list = parsed;
    else if (parsed && Array.isArray(parsed.alters)) list = parsed.alters;
    else if (parsed && Array.isArray(parsed.items)) list = parsed.items;
    else if (parsed && typeof parsed === 'object' && parsed.id && (parsed.name || parsed.role || parsed.emoji)) list = [parsed];
    else return { status:'unsupported', alters:[], raw };
    const alters = list.filter(a => a && typeof a === 'object').map(normalizeAlterPermissions);
    return alters.length ? { status:'ok', alters } : { status:'empty', alters:[] };
  }
  catch (error) { return { status:'invalid', alters:[], raw, error }; }
}
function hasStoredAtriaDataBesidesAlters() {
  return Object.keys(localStorage).some(k => k.startsWith('tid_') && k !== 'tid_alters');
}
function loadAlters() {
  return readStoredAltersState().alters;
}
function saveAlters(list) {
  try {
    localStorage.setItem('tid_alters', JSON.stringify((list || []).map(normalizeAlterPermissions)));
  } catch(e) { if(e.name==='QuotaExceededError'||e.code===22||e.code===1014) showToast('⚠ Almacenamiento lleno — reduce el tamaño de la imagen'); else showToast('⚠ Error al guardar'); }
}

// Comprime y redimensiona una imagen con canvas antes de guardarla.
// maxW/maxH: dimensiones máximas. quality: 0-1 para JPEG.
// Devuelve Promise<dataURL>.
function compressImage(file, maxW, maxH, quality=0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let {width:w, height:h} = img;
      if(w > maxW || h > maxH) {
        const ratio = Math.min(maxW/w, maxH/h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo cargar la imagen')); };
    img.src = url;
  });
}
function formatImageBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function dataUrlBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round(base64.length * 0.75);
}
async function compressImageForStorage(file, maxW, maxH, quality = 0.82, targetKB = 420) {
  const qualities = [quality, 0.74, 0.66, 0.58, 0.50];
  let best = '';
  for (const q of qualities) {
    best = await compressImage(file, maxW, maxH, q);
    if (dataUrlBytes(best) <= targetKB * 1024) break;
  }
  return best;
}
function showImageCompressedToast(file, b64, label = 'Imagen') {
  showToast(`${label} comprimida: ${formatImageBytes(file?.size || 0)} -> ${formatImageBytes(dataUrlBytes(b64))}`);
}
function validateImageFile(file, maxMB = 2) {
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  if (!allowed.includes(file.type)) {
    const ext = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : '?';
    return `Formato no válido (.${ext}). Solo JPG, PNG, WEBP o GIF.`;
  }
  if (file.size > maxMB * 1024 * 1024) {
    return `Imagen demasiado grande (${formatImageBytes(file.size)}). Atria puede comprimir hasta ${maxMB} MB; elige una imagen menor o reduce su resolucion.`;
  }
  return null;
}
// Renderiza el avatar de un alter (imagen si existe, emoji si no)
// size: tamaño en px del contenedor (el emoji se escala automáticamente)
function alterAv(a, size) {
  if (!a) return '?';
  if (a.avatarImg) {
    return `<img src="${a.avatarImg}" style="width:${size}px;height:${size}px;max-width:${size}px;max-height:${size}px;object-fit:cover;border-radius:50%;display:block;flex-shrink:0">`;
  }
  const fs = Math.round(size * 0.44);
  return `<span style="font-size:${fs}px;line-height:1">${a.emoji||'◎'}</span>`;
}


function getAlters(includeArchived) {
  const all = loadAlters();
  return includeArchived ? all : all.filter(a=>!a.isArchived);
}

// Alias para compatibilidad
let ALTERS = loadAlters();

const DEFAULT_CATS = [
  {id:'alimentacion', name:'Alimentación', color:'#ffb450'},
  {id:'transporte',   name:'Transporte',   color:'#8ab4ff'},
  {id:'salud',        name:'Salud',        color:'#5fffb0'},
  {id:'ocio',         name:'Ocio',         color:'#ff8ae2'},
  {id:'servicios',    name:'Servicios',    color:'#a08aff'},
  {id:'ropa',         name:'Ropa',         color:'#ff9f7f'},
  {id:'educacion',    name:'Educación',    color:'#7fffda'},
  {id:'otros',        name:'Otros',        color:'#8a8aaa'},
];

const HUB_SECTIONS = [
  {
    id:'comunicacion', label:'Comunicación', icon:'◭', color:'#8affe0',
    modules:[
      {id:'innerchat',   name:'Comunicación',       icon:'◭', desc:'Chat, tablón, solicitudes y deseos',  color:'#8affe0', bg:'rgba(138,255,224,0.1)', badge:'activo',   view:'innerchat'},
    ]
  },
  {
    id:'organizacion', label:'Organización', icon:'◰', color:'#a08aff',
    modules:[
      {id:'agenda',      name:'Agenda',             icon:'◷', desc:'Eventos y recordatorios',               color:'#ffb450', bg:'rgba(255,180,80,0.1)',  badge:'activo',   view:'agenda'},
      {id:'rutinas',     name:'Rutinas',            icon:'◎', desc:'Hábitos, checklists y organización diaria', color:'#ffd580', bg:'rgba(255,213,128,0.12)', badge:'nuevo', view:'rutinas'},
      {id:'proyectos',   name:'Proyectos',          icon:'◉', desc:'Seguimiento de proyectos y tareas',     color:'#8affe0', bg:'rgba(138,255,224,0.1)', badge:'activo',   view:'proyectos'},
      {id:'finanzas',    name:'Finanzas',           icon:'$', desc:'Movimientos, presupuestos y resumen',   color:'#5fffb0', bg:'rgba(95,255,176,0.1)',  badge:'activo',   view:'finanzas'},
    ]
  },
  {
    id:'personal', label:'Personal', icon:'◫', color:'#ff8ae2',
    modules:[
      {id:'diario',      name:'Diario',             icon:'◫', desc:'Entradas y reflexiones personales',     color:'#ff8ae2', bg:'rgba(255,138,226,0.1)', badge:'activo',   view:'diario'},
      {id:'normas',      name:'Normas',             icon:'◳', desc:'Reglas y acuerdos del sistema',         color:'#8ab4ff', bg:'rgba(138,180,255,0.1)', badge:'activo',   view:'normas'},
      {id:'polls',       name:'Votaciones',         icon:'◎', desc:'Polls y decisiones internas',           color:'#ffd580', bg:'rgba(255,213,128,0.12)', badge:'nuevo',    view:'polls'},
      {id:'memoria',     name:'Memoria',            icon:'◌', desc:'Historia, contactos, recursos y docs',  color:'#ffb450', bg:'rgba(255,180,80,0.1)',  badge:'activo',   view:'memoria'},
      {id:'biblioteca',  name:'Biblioteca',         icon:'◫', desc:'Contactos, salud, recursos y documentos', color:'#a08aff', bg:'rgba(160,138,255,0.1)', badge:'activo',   view:'biblioteca'},
    ]
  },

  {
    id:'sistema', label:'Sistema', icon:'◎', color:'#ff8ae2',
    modules:[
      {id:'fronting',    name:'Fronting',           icon:'◉', desc:'Quién está al frente ahora',             color:'#ff8ae2', bg:'rgba(255,138,226,0.1)', badge:'activo',   view:'fronting'},
      {id:'perfiles',    name:'Alters',             icon:'◎', desc:'Gestionar perfiles y fichas',            color:'#8ab4ff', bg:'rgba(138,180,255,0.1)', badge:'activo',   view:'perfiles'},
      {id:'analisis',    name:'Análisis',           icon:'◈', desc:'Dashboard, actividad, emociones y triggers', color:'#5fffb0', bg:'rgba(95,255,176,0.1)', badge:'activo',   view:'analisis'},
    ]
  },
];
// Flat list for legacy use
const HUB_MODULES = HUB_SECTIONS.flatMap(s=>s.modules);

// ═══════════════════════════════════════════════
// PERFILES CONSTANTS
// ═══════════════════════════════════════════════
const ROLE_TYPES = [
  {id:'anfitrion', label:'Anfitrión',  emoji:'🌙'},
  {id:'protector', label:'Protector',  emoji:'🛡'},
  {id:'guardian',  label:'Guardián',   emoji:'🐺'},
  {id:'nino',      label:'Niñx',       emoji:'🌸'},
  {id:'perseguidor',label:'Perseguidor',emoji:'⚡'},
  {id:'fragmento', label:'Fragmento',  emoji:'🔮'},
  {id:'otro',      label:'Otro',       emoji:'◎'},
];
function loadCustomRoleTypes() { try { return JSON.parse(localStorage.getItem('tid_custom_role_types'))||[]; } catch{return[];} }
function saveCustomRoleTypes(arr) { localStorage.setItem('tid_custom_role_types', JSON.stringify(arr)); }
function getAllRoleTypes() {
  const customs = loadCustomRoleTypes().map(c => ({id:'custom_'+c, label:c, emoji:'◎', custom:true}));
  return [...ROLE_TYPES, ...customs];
}
const AGE_TYPES = [
  {id:'bebe',    label:'Bebé (0-3)'},
  {id:'nino',    label:'Niñx (4-12)'},
  {id:'adolescente',label:'Adolescente (13-17)'},
  {id:'adulto',  label:'Adulto (18+)'},
  {id:'anciano', label:'Anciano'},
  {id:'ageless', label:'Sin edad'},
];
const PRONOUNS_LIST = [
  'ella','él','elle','ellos','elles','ninguno',
  'ella/elle','él/elle','elle/ella','elle/él',
  'xe/xem','ze/zir','fae/faer','ey/em',
  'it/its','ne/nem','ve/ver','per/per',
];
const PRONOUNS_DATALIST = `<datalist id="pronouns-datalist">${PRONOUNS_LIST.map(p=>`<option value="${p}">`).join('')}</datalist>`;
const MODULES_PERMS = [
  {id:'finanzas',     label:'Finanzas',      desc:'Ver y gestionar datos económicos'},
  {id:'emociones',    label:'Emociones',     desc:'Registrar estados emocionales'},
  {id:'diario',       label:'Diario',        desc:'Leer y escribir entradas'},
  {id:'comunicacion', label:'Comunicación',  desc:'Mensajes internos'},
  {id:'agenda',       label:'Agenda',        desc:'Ver y crear eventos'},
  {id:'proyectos',    label:'Proyectos',     desc:'Acceder a proyectos y tareas'},
  {id:'normas',       label:'Normas',        desc:'Ver y votar normas del sistema'},
  {id:'wishlist',     label:'Wishlist',      desc:'Ver y gestionar deseos'},
];
function buildFullPermissions() {
  return Object.fromEntries(ALTER_PERMISSION_IDS.map(id => [id, true]));
}
function normalizeAlterPermissions(alter) {
  if (!alter) return alter;
  const permissions = alter.isAdmin
    ? buildFullPermissions()
    : {...buildFullPermissions(), ...(alter.permissions || {})};
  return {...alter, permissions, intimacyLevel: alter.intimacyLevel || 'interno'};
}
const ALTER_COLORS = ['#a08aff','#ff8ae2','#8affe0','#ffb450','#8ab4ff','#ff6b8a','#5fffb0','#ffd580','#b8a0ff','#80ffcc'];
const RELATION_TYPES = [
  {id:'protector',     label:'Protector/a',        color:'#8affe0'},
  {id:'cofronting',    label:'Co-front habitual',   color:'#a08aff'},
  {id:'complementario',label:'Complementario/a',    color:'#ffd580'},
  {id:'conflicto',     label:'Conflicto',           color:'#ff6b8a'},
  {id:'origen',        label:'Origen/fragmento',    color:'#ffb450'},
  {id:'otro',          label:'Otro',                color:'#8ab4ff'},
];
const FRONT_CUSTOM_STATES = [
  {id:'alterado',   label:'Alterado',   icon:'⚡'},
  {id:'disociado',  label:'Disociado',  icon:'◌'},
  {id:'flashback',  label:'Flashback',  icon:'↩'},
  {id:'cansado',    label:'Cansado',    icon:'◫'},
  {id:'ansioso',    label:'Ansioso',    icon:'◎'},
  {id:'tranquilo',  label:'Tranquilo',  icon:'◷'},
];

const ALTER_STATES = [
  {id:'activo',      label:'Activo/a',      icon:'●', color:'#5fffb0'},
  {id:'dormido',     label:'Dormido/a',     icon:'○', color:'#8ab4ff'},
  {id:'emergente',   label:'Emergente',     icon:'◑', color:'#ffd580'},
  {id:'transitorio', label:'Transitorio/a', icon:'◌', color:'#ff8ae2'},
];
// Capas de intimidad — determinan si un dato puede salir del dispositivo
const INTIMACY_LEVELS = [
  {id:'privado',    label:'Privado',    icon:'🔒', desc:'Solo este sistema — nunca sale de la app',      color:'#ff6b8a'},
  {id:'interno',    label:'Interno',    icon:'🏠', desc:'Visible entre alters, no sale del dispositivo', color:'#a08aff'},
  {id:'compartido', label:'Compartido', icon:'🤝', desc:'Compartible con amigos online',                 color:'#8ab4ff'},
  {id:'publico',    label:'Público',    icon:'📤', desc:'Exportable manualmente',                        color:'#5fffb0'},
];

function loadSubsystems() { try { return JSON.parse(localStorage.getItem('tid_subsystems'))||[]; } catch{return[];} }
function saveSubsystems(s) { localStorage.setItem('tid_subsystems', JSON.stringify(s)); }
function moveSubsystemInOrder(id, direction) {
  const list = loadSubsystems(); const index = list.findIndex(s=>s.id===id); const next=index+direction;
  if(index<0||next<0||next>=list.length) return;
  [list[index],list[next]]=[list[next],list[index]]; saveSubsystems(list); renderAlters();
}

const EMOJI_DATA = [
  // Cosmos
  {e:'🌙',t:'luna noche moon night oscuro dark',c:'cos'},
  {e:'☀️',t:'sol día sun day luz light',c:'cos'},
  {e:'⭐',t:'estrella star noche brillar shine',c:'cos'},
  {e:'🌟',t:'estrella brillante dorada golden star',c:'cos'},
  {e:'🌠',t:'estrella fugaz deseo shooting wish',c:'cos'},
  {e:'🌌',t:'galaxia cosmos espacio universe stars',c:'cos'},
  {e:'🪐',t:'planeta saturno cosmos space',c:'cos'},
  {e:'🌑',t:'luna nueva oscuridad fase black',c:'cos'},
  {e:'🌞',t:'sol feliz verano calor sunny',c:'cos'},
  {e:'☄️',t:'cometa meteoro cosmos espacio estrella',c:'cos'},
  {e:'🌍',t:'tierra mundo planeta earth world',c:'cos'},
  {e:'🌒',t:'luna creciente fase crescent moon',c:'cos'},
  {e:'🌕',t:'luna llena full moon fase bright',c:'cos'},
  {e:'🔭',t:'telescopio espacio cosmos observar telescope',c:'cos'},
  // Naturaleza
  {e:'🌸',t:'flor sakura primavera spring rosa pink',c:'nat'},
  {e:'🌊',t:'ola mar océano agua wave sea',c:'nat'},
  {e:'🌿',t:'planta hoja verde naturaleza herb green',c:'nat'},
  {e:'🌈',t:'arcoiris colores rainbow esperanza',c:'nat'},
  {e:'🌺',t:'flor hibisco tropical roja red',c:'nat'},
  {e:'🍃',t:'hojas brisa naturaleza wind leaf',c:'nat'},
  {e:'🌵',t:'cactus desierto planta spiky',c:'nat'},
  {e:'🍄',t:'seta hongo bosque mushroom',c:'nat'},
  {e:'💧',t:'gota agua lluvia drop water',c:'nat'},
  {e:'☁️',t:'nube cloud cielo gris grey',c:'nat'},
  {e:'🌧️',t:'lluvia rain agua nube weather',c:'nat'},
  {e:'🌪️',t:'tornado viento tormenta caos storm',c:'nat'},
  {e:'🌻',t:'girasol sunflower verano amarillo yellow',c:'nat'},
  {e:'🌼',t:'margarita daisy amarilla spring flor',c:'nat'},
  {e:'🍀',t:'trébol suerte verde fortuna luck',c:'nat'},
  {e:'🌹',t:'rosa roja amor flor flower red',c:'nat'},
  {e:'🌾',t:'trigo wheat dorado otoño field',c:'nat'},
  {e:'🪷',t:'loto flor agua lotus',c:'nat'},
  {e:'🌷',t:'tulipán pink flor spring',c:'nat'},
  {e:'🌲',t:'árbol tree bosque forest pino',c:'nat'},
  {e:'🌴',t:'palmera palm tropical verano beach',c:'nat'},
  {e:'🌱',t:'brote plántula nueva vida seedling',c:'nat'},
  {e:'🍁',t:'hoja otoño maple fall red',c:'nat'},
  {e:'🍂',t:'hojas otoño fall brown caída',c:'nat'},
  {e:'❄️',t:'hielo nieve frío invierno snow ice',c:'nat'},
  {e:'🏔️',t:'montaña nevada mountain peak cumbre',c:'nat'},
  {e:'🌬️',t:'viento wind soplando brisa breeze',c:'nat'},
  {e:'🌋',t:'volcán lava erupción fuego volcano',c:'nat'},
  // Animales
  {e:'🐺',t:'lobo wolf animal manada',c:'ani'},
  {e:'🦋',t:'mariposa butterfly transformación vuelo',c:'ani'},
  {e:'🐉',t:'dragón dragon mítico fuego',c:'ani'},
  {e:'🦅',t:'águila eagle vuelo libertad',c:'ani'},
  {e:'🦊',t:'zorro fox astuto naranja cunning',c:'ani'},
  {e:'🐱',t:'gato cat felino animal kitty',c:'ani'},
  {e:'🦁',t:'león lion fuerza rey strength king',c:'ani'},
  {e:'🐍',t:'serpiente snake reptil misterio',c:'ani'},
  {e:'🦌',t:'ciervo deer bosque grácil',c:'ani'},
  {e:'🦚',t:'pavo real plumas colorido peacock',c:'ani'},
  {e:'🐦',t:'pájaro bird vuelo libertad',c:'ani'},
  {e:'🐾',t:'huellas patas animal rastro paw',c:'ani'},
  {e:'🐲',t:'dragón verde serpiente green dragon',c:'ani'},
  {e:'🐸',t:'rana frog verde green',c:'ani'},
  {e:'🦇',t:'murciélago bat noche oscuro night',c:'ani'},
  {e:'🦄',t:'unicornio unicorn mágico magia rainbow',c:'ani'},
  {e:'🐻',t:'oso bear fuerte marrón brown',c:'ani'},
  {e:'🐼',t:'panda oso blanco negro china',c:'ani'},
  {e:'🐯',t:'tigre tiger rayas stripes feroz',c:'ani'},
  {e:'🦝',t:'mapache raccoon travieso bandido mask',c:'ani'},
  {e:'🦦',t:'nutria otter agua juguetón playful',c:'ani'},
  {e:'🐬',t:'delfín dolphin mar océano inteligente',c:'ani'},
  {e:'🐋',t:'ballena whale gran mar ocean',c:'ani'},
  {e:'🦈',t:'tiburón shark peligro ocean',c:'ani'},
  {e:'🐧',t:'pingüino penguin frío antártico cute',c:'ani'},
  {e:'🦉',t:'búho owl noche sabiduría wisdom',c:'ani'},
  {e:'🦜',t:'loro parrot colorido tropical habla',c:'ani'},
  {e:'🦢',t:'cisne swan elegante grácil graceful',c:'ani'},
  {e:'🕊️',t:'paloma dove paz peace blanca white',c:'ani'},
  {e:'🐢',t:'tortuga turtle lenta calma patience',c:'ani'},
  {e:'🦔',t:'erizo hedgehog espinas púas cute',c:'ani'},
  {e:'🦭',t:'foca seal agua marina ocean',c:'ani'},
  // Magia
  {e:'🔮',t:'bola cristal magia misterio crystal magic',c:'mag'},
  {e:'💫',t:'destello giro magia spark star',c:'mag'},
  {e:'🎭',t:'máscara teatro drama dualidad mask',c:'mag'},
  {e:'🌀',t:'espiral torbellino vértigo spiral swirl',c:'mag'},
  {e:'🧿',t:'ojo turco amuleto protección evil eye',c:'mag'},
  {e:'☯️',t:'yin yang balance dualidad paz',c:'mag'},
  {e:'✨',t:'destellos magia sparkles brillo shine',c:'mag'},
  {e:'⚜️',t:'flor de lis noble símbolo heraldic',c:'mag'},
  {e:'♾️',t:'infinito eterno forever loop eternal',c:'mag'},
  {e:'🪬',t:'amuleto mano protección hamsa ojo',c:'mag'},
  {e:'📿',t:'cuentas collar rosario amuleto beads',c:'mag'},
  {e:'⚗️',t:'alquimia experimento magia alchemy potion',c:'mag'},
  {e:'🪄',t:'varita magia magic wand hechizo spell',c:'mag'},
  {e:'☮️',t:'paz peace símbolo harmonía calm',c:'mag'},
  {e:'🗝️',t:'llave antigua secreto key mystery',c:'mag'},
  {e:'🧙',t:'mago wizard bruja witch spell hechizo',c:'mag'},
  {e:'🧚',t:'hada fairy magia fantástico wings',c:'mag'},
  {e:'🧜',t:'sirena mermaid mar agua fantasía',c:'mag'},
  {e:'🧛',t:'vampiro vampire noche oscuro blood',c:'mag'},
  {e:'👁️',t:'ojo vista observar eye secreto tercer',c:'mag'},
  {e:'🕯️',t:'vela llama luz suave noche candle',c:'mag'},
  // Corazones
  {e:'💜',t:'corazón morado amor violeta purple heart',c:'cor'},
  {e:'🖤',t:'corazón negro amor oscuro dark heart',c:'cor'},
  {e:'🤍',t:'corazón blanco amor puro white heart',c:'cor'},
  {e:'💙',t:'corazón azul amor blue heart',c:'cor'},
  {e:'💚',t:'corazón verde naturaleza vida green heart',c:'cor'},
  {e:'💛',t:'corazón amarillo alegría sol yellow heart',c:'cor'},
  {e:'🧡',t:'corazón naranja energía fuego orange heart',c:'cor'},
  {e:'❤️',t:'corazón rojo amor pasión red heart',c:'cor'},
  {e:'💕',t:'corazones amor cariño love two hearts',c:'cor'},
  {e:'💞',t:'corazones girando amor revolving hearts',c:'cor'},
  {e:'💗',t:'corazón creciendo amor growing pink heart',c:'cor'},
  {e:'💖',t:'corazón brillante amor sparkling heart',c:'cor'},
  {e:'💝',t:'corazón lazo regalo amor heart ribbon',c:'cor'},
  {e:'🩷',t:'corazón rosa pink heart amor',c:'cor'},
  {e:'🩶',t:'corazón gris grey heart amor',c:'cor'},
  {e:'🩵',t:'corazón azul cielo light blue heart',c:'cor'},
  {e:'🤎',t:'corazón marrón brown heart amor tierra',c:'cor'},
  // Poder
  {e:'🔥',t:'fuego llama fire pasión calor',c:'pod'},
  {e:'⚡',t:'rayo tormenta energía lightning thunder',c:'pod'},
  {e:'💎',t:'diamante gema joya gem crystal',c:'pod'},
  {e:'🗡️',t:'espada daga guerrero sword blade',c:'pod'},
  {e:'🛡️',t:'escudo protección defensa shield',c:'pod'},
  {e:'🔱',t:'tridente neptuno poder water power',c:'pod'},
  {e:'🎯',t:'diana objetivo meta target focus',c:'pod'},
  {e:'⚔️',t:'espadas cruzadas combate battle swords',c:'pod'},
  {e:'🏹',t:'arco flecha arquero bow arrow',c:'pod'},
  {e:'💪',t:'bíceps fuerza muscle strong power',c:'pod'},
  {e:'🦾',t:'brazo robótico fuerza cyborg strong',c:'pod'},
  {e:'⛓️',t:'cadenas ataduras chains bonds',c:'pod'},
  {e:'🪃',t:'bumerán vuelta return boomerang',c:'pod'},
  // Personas
  {e:'🧒',t:'niñx child pequeño young kid',c:'per'},
  {e:'👧',t:'niña girl pequeña young child',c:'per'},
  {e:'🧑',t:'persona adulto neutral person adult',c:'per'},
  {e:'👦',t:'niño boy pequeño young child',c:'per'},
  {e:'👩',t:'mujer woman ella her',c:'per'},
  {e:'👨',t:'hombre man él him',c:'per'},
  {e:'🧓',t:'ancianx elder mayor old person',c:'per'},
  {e:'👴',t:'anciano elder mayor hombre old man',c:'per'},
  {e:'👵',t:'anciana elder mayor mujer old woman',c:'per'},
  {e:'🧑‍🎤',t:'cantante artista música rock star',c:'per'},
  {e:'🧑‍🎨',t:'artista pintor creativo painter artist',c:'per'},
  {e:'🧑‍🔬',t:'científicx investigador science lab',c:'per'},
  {e:'🧑‍💻',t:'programador tech tecnología code geek',c:'per'},
  {e:'🧑‍⚕️',t:'médico salud health doctor nurse',c:'per'},
  {e:'🧑‍🏫',t:'maestro profesor teacher school',c:'per'},
  {e:'🧑‍⚖️',t:'juez justicia law justice',c:'per'},
  {e:'🧑‍🍳',t:'cocinero chef cocina kitchen cook',c:'per'},
  {e:'👑',t:'corona rey reina crown royalty',c:'per'},
  {e:'🤡',t:'payaso clown gracioso funny jester',c:'per'},
  {e:'🎃',t:'calabaza halloween oscuro pumpkin',c:'per'},
  {e:'👻',t:'fantasma ghost susto miedo spooky',c:'per'},
  {e:'💀',t:'calavera skull muerte death oscuro',c:'per'},
  {e:'🤖',t:'robot máquina tecnología cyborg android',c:'per'},
  {e:'👽',t:'alienígena extraterrestre alien space',c:'per'},
  // Objetos
  {e:'📚',t:'libros books leer estudiar knowledge',c:'obj'},
  {e:'🎸',t:'guitarra eléctrica música rock music',c:'obj'},
  {e:'🎹',t:'piano teclado música keys instrument',c:'obj'},
  {e:'🎵',t:'nota musical song melodía music',c:'obj'},
  {e:'🎶',t:'notas música song melodía notes',c:'obj'},
  {e:'🎨',t:'paleta pintura arte color canvas art',c:'obj'},
  {e:'✏️',t:'lápiz escribir dibujar pencil draw',c:'obj'},
  {e:'🖊️',t:'bolígrafo escritura pen write',c:'obj'},
  {e:'📖',t:'libro abierto leer read study',c:'obj'},
  {e:'📝',t:'notas apuntes memo notes',c:'obj'},
  {e:'💊',t:'píldora medicación salud pill health',c:'obj'},
  {e:'🩺',t:'estetoscopio médico salud doctor health',c:'obj'},
  {e:'🎮',t:'videojuego gaming joystick play',c:'obj'},
  {e:'🧩',t:'puzzle pieza encajar jigsaw piece',c:'obj'},
  {e:'🎲',t:'dado suerte azar dice game',c:'obj'},
  {e:'🃏',t:'carta baraja juego joker card',c:'obj'},
  {e:'🪆',t:'matrioska muñeca rusa doll russia',c:'obj'},
  {e:'🧸',t:'osito peluche ternura teddy bear',c:'obj'},
  {e:'🎀',t:'lazo cinta regalo pink ribbon bow',c:'obj'},
  {e:'💍',t:'anillo joya compromiso ring jewelry',c:'obj'},
  {e:'🌂',t:'paraguas lluvia rain umbrella',c:'obj'},
  {e:'🕶️',t:'gafas sol cool sunglasses cool',c:'obj'},
  {e:'🎭',t:'máscaras teatro drama dualidad masks',c:'obj'},
  {e:'🪞',t:'espejo reflejo mirror reflection',c:'obj'},
  {e:'🔑',t:'llave acceso key door lock',c:'obj'},
  {e:'📜',t:'pergamino scroll carta antigua scroll',c:'obj'},
  {e:'⚖️',t:'balanza justicia equilibrio balance',c:'obj'},
  {e:'🧲',t:'imán atracción magnet attract',c:'obj'},
  {e:'💻',t:'ordenador laptop computadora tech',c:'obj'},
  {e:'📱',t:'móvil teléfono smartphone phone',c:'obj'},
  // Misc
  {e:'🌈',t:'arcoiris pride orgullo colores colors rainbow',c:'mis'},
  {e:'🏳️‍🌈',t:'bandera pride orgullo lgbtq arcoiris',c:'mis'},
  {e:'🏳️‍⚧️',t:'bandera trans transgénero pride',c:'mis'},
  {e:'☕',t:'café coffee caliente warm morning',c:'mis'},
  {e:'🍵',t:'té tea caliente warm relaxar',c:'mis'},
  {e:'🍰',t:'pastel tarta torta cumpleaños cake',c:'mis'},
  {e:'🌃',t:'ciudad noche skyline urban nocturna',c:'mis'},
  {e:'🏡',t:'casa hogar home safe cozy',c:'mis'},
  {e:'🌅',t:'amanecer alba sunrise mañana dawn',c:'mis'},
  {e:'🌄',t:'anochecer puesta sol sunset dusk',c:'mis'},
  {e:'💤',t:'dormir sueño descanso sleep zzz rest',c:'mis'},
  {e:'🧘',t:'meditación calma paz yoga relax',c:'mis'},
  {e:'🎆',t:'fuegos artificiales celebración fireworks',c:'mis'},
  {e:'🌐',t:'global mundo internet earth web',c:'mis'},
  {e:'🔔',t:'campana alerta aviso bell notification',c:'mis'},
  {e:'🎁',t:'regalo presente cumpleaños gift present',c:'mis'},
];

// ── PERMISOS ──────────────────────────────────────
// Mapa permiso → vistas que controla
const PERM_VIEWS = {
  comunicacion: ['innerchat'],
  finanzas:     ['finanzas'],
  diario:       ['diario'],
  agenda:       ['agenda'],
  proyectos:    ['proyectos'],
  normas:       ['normas','polls'],

  emociones:    ['tracker'],
  wishlist:     ['wishlist'],
};

function canAccess(view) {
  if (!activeAlter) return false;
  if (activeAlter.isAdmin) return true;
  const p = activeAlter.permissions;
  if (!p) return true;
  for (const [perm, views] of Object.entries(PERM_VIEWS)) {
    if (views.includes(view)) return p[perm] !== false;
  }
  return true;
}

function accessControlledView(view) {
  if (!view || view === 'hub') return 'hub';
  if (['notas','solicitudes','tablon'].includes(view)) return 'innerchat';
  if (view.startsWith('finanzas/')) return 'finanzas';
  return view;
}

function renderAccessDenied(view) {
  const target = accessControlledView(view);
  const labels = {
    innerchat: 'Comunicación',
    finanzas: 'Finanzas',
    diario: 'Diario',
    agenda: 'Agenda',
    proyectos: 'Proyectos',
    normas: 'Normas',
    polls: 'Votaciones',
    tracker: 'Estado',
    wishlist: 'Wishlist',
  };
  setCrumbs([{label:'Hub', action:()=>navigateTo('hub')}, {label: labels[target] || 'Restringido'}]);
  document.getElementById('app').innerHTML = `<div class="empty-state" style="margin-top:60px"><div class="empty-icon">🔒</div><div>No tienes permisos para acceder a ${labels[target] || 'esta sección'}</div></div>`;
}

function renderSidebarNav() {
  const nav = document.getElementById('sb-nav');
  if (!nav) return;
  const currentSection = currentView === 'innerchat' ? comTab || 'chat' : currentView;
  const onlineItems = getOnlineProfile().enabled
    ? [
        {view:'online-amigos', icon:'◉', label:'Amigos'},
        {view:'innerchat', comtab:'online', icon:'💬', label:'Chat online', perm:'comunicacion'},
        {view:'online-perfil', icon:'◇', label:'Perfil online'},
      ]
    : [
        {view:'config', cfg:'online', icon:'☁', label:'Activar online'},
      ];
  const sections = [
    {
      label: 'Sistema',
      items: [
        {view:'innerchat', comtab:'chat',       icon:'◭', label:'Chat',        perm:'comunicacion'},
        {view:'fronting',      icon:'◉', label:'Fronting'},
        {view:'perfiles',      icon:'◎', label:'Alters'},
        {view:'tracker', icon:'◉', label:'Estado',  perm:'emociones'},
        {view:'recordatorios', icon:'◱', label:'Recordatorios'},
      ]
    },
    {
      label: 'Online',
      items: onlineItems
    },
    {
      label: 'Personal',
      items: [
        {view:'diario',  icon:'◫', label:'Diario',  perm:'diario'},
        {view:'normas',  icon:'◳', label:'Normas',  perm:'normas'},
        {view:'polls',   icon:'◎', label:'Votaciones', perm:'normas'},
        {view:'memoria',    icon:'◌', label:'Memoria'},
        {view:'biblioteca', icon:'◫', label:'Biblioteca'},
        {view:'headspace', icon:'⌂', label:'Headspace'},
        {view:'relations', icon:'↔', label:'Relaciones'},
        {view:'wiki', url:'https://atria.lyokodev.com/wiki/', icon:'?', label:'Guía'},
      ]
    },
    {
      label: 'Herramientas',
      items: [
        {view:'agenda',    icon:'◷', label:'Agenda',    perm:'agenda'},
        {view:'rutinas',   icon:'◎', label:'Rutinas'},
        {view:'proyectos', icon:'◉', label:'Proyectos', perm:'proyectos'},
        {view:'finanzas',  icon:'◈', label:'Finanzas',  perm:'finanzas'},
      ]
    },
  ];

  let html = `<button type="button" class="nav-item${currentSection === 'hub' ? ' active' : ''}" data-view="hub" data-label="Hub"${currentSection === 'hub' ? ' aria-current="page"' : ''}>
    <div class="nav-icon">⌂</div><div class="nav-label">Hub</div>
  </button>`;

  sections.forEach(sec => {
    const visible = sec.items.filter(it => {
      if (!it.perm) return true;
      if (!activeAlter || activeAlter.isAdmin) return true;
      const p = activeAlter.permissions;
      if (!p) return true;
      return p[it.perm] !== false;
    });
    if (!visible.length) return;
    html += `<div class="nav-separator"></div><div class="nav-group-label">${sec.label}</div>`;
    visible.forEach(it => {
      const extra = it.comtab ? ` data-comtab="${it.comtab}"` : '';
      const destination = it.url ? ` data-url="${it.url}"` : '';
      const isActive = it.comtab ? currentSection === it.comtab : currentSection === it.view;
      html += `<button type="button" class="nav-item${isActive ? ' active' : ''}" data-view="${it.view}" data-label="${it.label}"${extra}${destination}${isActive ? ' aria-current="page"' : ''}>
        <div class="nav-icon">${it.icon}</div><div class="nav-label">${it.label}</div>
      </button>`;
    });
  });

  nav.innerHTML = html;
  nav.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => {
      if (el.dataset.url) { window.location.href = el.dataset.url; return; }
      if (el.dataset.comtab) comTab = el.dataset.comtab;
      if (el.dataset.cfg) {
        navigateTo(el.dataset.view);
        setTimeout(() => {
          if (typeof renderConfigSection === 'function') renderConfigSection(el.dataset.cfg);
        }, 0);
        return;
      }
      navigateTo(el.dataset.view);
    });
  });
}
// ─────────────────────────────────────────────────

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let activeAlter = null;
let currentView = 'hub';
let _pendingSwitchAlterId = null; // alter pendiente de confirmar switch desde layer-0
let _frontTimerInterval = null;  // interval para actualizar el timer en vivo
let _pendingNotifNav = null;
let _pendingNotifTab = null;

// STORAGE helpers
function storageKey(section) { return window.AtriaStorage.storageKey(activeAlter, section); }
function load(section, def=[]) { return window.AtriaStorage.loadSection(activeAlter, section, def); }
function save(section, data) { return window.AtriaStorage.saveSection(activeAlter, section, data); }

function capturePendingNotifRouteFromUrl() {
  try {
    const url = new URL(location.href);
    const nav = url.searchParams.get('notifNav');
    const tab = url.searchParams.get('notifTab');
    if (nav) _pendingNotifNav = nav;
    if (tab) _pendingNotifTab = tab;
    if (nav || tab) {
      url.searchParams.delete('notifNav');
      url.searchParams.delete('notifTab');
      history.replaceState(history.state || {}, '', url.pathname + url.search + url.hash);
    }
  } catch (e) {
    console.warn('capturePendingNotifRouteFromUrl error:', e);
  }
}

function processPendingNotifRoute() {
  if (!_pendingNotifNav || !activeAlter) return false;
  const nav = _pendingNotifNav;
  const tab = _pendingNotifTab;
  _pendingNotifNav = null;
  _pendingNotifTab = null;
  if (nav === 'innerchat' && tab) comTab = tab;
  else if (tab) notasModuleTab = tab;
  navigateTo(nav);
  return true;
}

// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('toast-undo');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// softDelete: delays actual deletion 5s, shows "Deshacer" in toast.
// deleteFn() is called if not cancelled; onUndo() restores state.
const _pendingDeletes = new Map();
function softDelete(label, deleteFn, onUndo) {
  const key = 'del_' + uid();
  const t = document.getElementById('toast');
  // Cancel any previous pending delete
  _pendingDeletes.forEach((v, k) => { clearTimeout(v.timer); v.commit(); _pendingDeletes.delete(k); });
  const timer = setTimeout(() => {
    _pendingDeletes.delete(key);
    deleteFn();
    t.classList.remove('show');
  }, 5000);
  _pendingDeletes.set(key, { timer, commit: deleteFn });
  t.innerHTML = `${label} <button id="undo-btn" style="margin-left:10px;background:none;border:1px solid currentColor;border-radius:4px;padding:1px 8px;cursor:pointer;font-size:11px;color:inherit">Deshacer</button>`;
  t.classList.add('show', 'toast-undo');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 5200);
  t.querySelector('#undo-btn')?.addEventListener('click', () => {
    clearTimeout(timer);
    _pendingDeletes.delete(key);
    t.classList.remove('show');
    onUndo();
  });
}

function fmt(n) {
  return new Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR'}).format(n);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function monthName(m, y) {
  return new Date(y, m-1, 1).toLocaleString('es-ES', {month:'long', year:'numeric'});
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// WCAG 2.1 contrast ratio between two hex colors
function wcagContrastRatio(hex1, hex2) {
  const lum = hex => {
    const c = hex.replace('#','');
    return [0,2,4].map(i => {
      const v = parseInt(c.slice(i,i+2),16)/255;
      return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    }).reduce((acc,v,i) => acc + v * [0.2126,0.7152,0.0722][i], 0);
  };
  const l1 = lum(hex1), l2 = lum(hex2);
  return (Math.max(l1,l2)+0.05) / (Math.min(l1,l2)+0.05);
}

function ensureGlobalConnectionStyles() {
  if (document.getElementById('global-connection-styles')) return;
  const style = document.createElement('style');
  style.id = 'global-connection-styles';
  style.textContent = `
    .global-connection-indicator{margin-left:auto;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);background:var(--bg-1);color:var(--text-2);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:650;line-height:1;cursor:pointer;white-space:nowrap;min-height:30px}
    .global-connection-indicator:hover{border-color:var(--accent);color:var(--text-1)}
    .global-connection-dot{width:8px;height:8px;border-radius:50%;background:var(--text-3);box-shadow:0 0 0 3px rgba(255,255,255,.04)}
    .global-connection-online .global-connection-dot{background:#5fffb0}
    .global-connection-sync .global-connection-dot{background:#80d0ff}
    .global-connection-pending .global-connection-dot{background:#ffb450}
    .global-connection-error .global-connection-dot{background:#ff6b8a}
    .global-connection-offline .global-connection-dot,.global-connection-local .global-connection-dot{background:var(--text-3)}
    .global-status-grid{display:grid;grid-template-columns:minmax(110px,.8fr) 1fr;gap:8px 12px;font-size:12px;line-height:1.45}
    .global-status-k{color:var(--text-3)}
    .global-status-v{color:var(--text-1);min-width:0;word-break:break-word}
    .global-connection-indicator + .btn-crisis-header,.global-connection-indicator + .btn-crisis-header + #btn-search-global{margin-left:0}
    @media(max-width:768px){.global-connection-indicator{padding:7px;width:32px;justify-content:center;margin-right:42px}.global-connection-label{display:none}}
  `;
  document.head.appendChild(style);
}

function parseStoredJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getOnlineDevicesDiagnosticsDeps() {
  return {
    lang: 'es',
    loadConfig: typeof loadConfig === 'function' ? loadConfig : null,
    loadSyncLog: typeof loadSyncLog === 'function' ? loadSyncLog : null,
    loadSyncDevices: typeof loadSyncDevices === 'function' ? loadSyncDevices : null,
    getOnlineProfile: typeof getOnlineProfile === 'function' ? getOnlineProfile : null,
    loadOnlineAccount: typeof loadOnlineAccount === 'function' ? loadOnlineAccount : null,
    loadOnlineSession: typeof loadOnlineSession === 'function' ? loadOnlineSession : null,
    loadOnlineDevicesCache: typeof loadOnlineDevicesCache === 'function' ? loadOnlineDevicesCache : null,
    loadOnlineSyncState: typeof loadOnlineSyncState === 'function' ? loadOnlineSyncState : null,
    hasOnlineBackendConfigured: typeof hasOnlineBackendConfigured === 'function' ? hasOnlineBackendConfigured : null,
    loadOnlineConversationIndex: typeof loadOnlineConversationIndex === 'function' ? loadOnlineConversationIndex : null,
    loadOnlineBackupStatus: typeof loadOnlineBackupStatus === 'function' ? loadOnlineBackupStatus : null,
    loadOnlineFriends: typeof loadOnlineFriends === 'function' ? loadOnlineFriends : null,
    browserOnline: navigator.onLine !== false,
    parseStoredJson,
  };
}

function formatConnectionTs(ts) {
  return window.AtriaOnlineDevicesDiagnostics.formatConnectionTs(ts, 'es');
}

function getGlobalConnectionState() {
  return window.AtriaOnlineDevicesDiagnostics.getGlobalConnectionState(getOnlineDevicesDiagnosticsDeps());
}

function getOnlineDeviceSyncDiagnostics() {
  return window.AtriaOnlineDevicesDiagnostics.getOnlineDeviceSyncDiagnostics(getOnlineDevicesDiagnosticsDeps());
}

function getLegacySyncDiagnostics() {
  return window.AtriaOnlineDevicesDiagnostics.getLegacySyncDiagnostics(getOnlineDevicesDiagnosticsDeps());
}
function renderGlobalConnectionIndicator() {
  ensureGlobalConnectionStyles();
  const s = getGlobalConnectionState();
  return `<button class="global-connection-indicator global-connection-${s.kind}" id="global-connection-indicator" title="${escM(s.title)}" aria-label="Estado online y sync: ${escM(s.short)}"><span class="global-connection-dot"></span><span class="global-connection-label">${escM(s.short)}</span></button>`;
}

function refreshGlobalConnectionIndicator() {
  const current = document.getElementById('global-connection-indicator');
  if (!current) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = renderGlobalConnectionIndicator();
  const next = wrap.firstElementChild;
  current.replaceWith(next);
  bindGlobalConnectionIndicator();
}

function openGlobalConnectionDetails() {
  const s = getGlobalConnectionState();
  const lastSyncText = s.lastSync
    ? `${s.lastSync.action === 'push' ? 'Push' : 'Pull'} · ${s.lastSync.deviceName || 'dispositivo'} · ${formatConnectionTs(s.lastSync.ts)}${s.lastSync.status === 'error' ? ' · ERROR' : ''}`
    : 'Sin operaciones registradas';
  const rows = [
    ['Estado', s.short],
    ['Conexion del navegador', s.browserOnline ? 'Con conexion' : 'Sin conexion'],
    ['Online', s.onlineProfile?.enabled ? (s.backendConfigured ? 'Activo online' : 'Servicio pendiente') : 'Desactivado'],
    ['Sesion online', s.onlineSession ? (s.onlineSession.email || s.onlineSession.systemId || 'Activa') : 'Sin sesion'],
    ['Ultimo online', formatConnectionTs(s.lastOnlineTs)],
    ['Dispositivos sync', String(s.syncDevices.length)],
    ['Ultimo sync', lastSyncText],
    ['Ultimo error', s.lastError ? String(s.lastError) : 'Sin errores registrados'],
  ];
  openModal(`
    <div style="display:flex;flex-direction:column;gap:14px;max-width:520px">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="global-connection-dot" style="background:${s.kind === 'online' ? '#5fffb0' : s.kind === 'sync' ? '#80d0ff' : s.kind === 'pending' ? '#ffb450' : s.kind === 'error' ? '#ff6b8a' : 'var(--text-3)'}"></span>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text-1)">Estado online y sync</div>
          <div style="font-size:12px;color:var(--text-2)">Resumen rapido de conectividad, online y sync de dispositivos</div>
        </div>
      </div>
      <div class="global-status-grid">
        ${rows.map(([k,v]) => `<div class="global-status-k">${escM(k)}</div><div class="global-status-v">${escM(v)}</div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-cancel>Cerrar</button>
        <button class="btn btn-primary btn-sm" id="global-connection-go-sync">Ver Sync</button>
      </div>
    </div>
  `);
  document.getElementById('global-connection-go-sync')?.addEventListener('click', () => {
    closeModal();
    navigateTo('config');
    setTimeout(() => { if (typeof renderConfigSection === 'function') renderConfigSection('sync'); }, 0);
  });
}

function bindGlobalConnectionIndicator() {
  document.getElementById('global-connection-indicator')?.addEventListener('click', openGlobalConnectionDetails);
}

function setCrumbs(crumbs) {
  const bc = document.getElementById('breadcrumbs');
  bc.innerHTML = crumbs.map((c, i) => {
    const last = i === crumbs.length - 1;
    const sep = i > 0 ? '<span class="crumb-sep"> / </span>' : '';
    return `${sep}<span class="crumb ${last?'current':'clickable'}" data-idx="${i}">${c.label}</span>`;
  }).join('') + renderGlobalConnectionIndicator() + '<button class="btn-crisis-header" id="btn-crisis-header" title="Crisis" aria-label="Crisis">⚠</button><button id="btn-context-help" class="context-help-btn" title="Ayuda de este módulo" aria-label="Ayuda de este módulo">?</button><button id="btn-search-global" title="Buscar (Ctrl+K)" aria-label="Búsqueda global">⌕</button>';
  // Restore mobile nav toggle at the start of breadcrumbs
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'mob-nav-toggle';
  toggleBtn.setAttribute('aria-label', 'Menú de navegación');
  toggleBtn.innerHTML = '<span id="mob-nav-toggle-icon">☰</span>';
  bc.prepend(toggleBtn);
  toggleBtn.addEventListener('click', () => {
    const nav = document.getElementById('mobile-nav');
    if (!nav) return;
    const isOpen = nav.classList.contains('mob-nav-open');
    if (isOpen) { closeMobileNav(); } else {
      nav.classList.remove('mob-nav-hidden');
      nav.classList.add('mob-nav-open');
      toggleBtn.querySelector('span').textContent = '✕';
    }
  });
  bc.querySelectorAll('.crumb.clickable').forEach(el =>
    el.addEventListener('click', () => crumbs[+el.dataset.idx].action?.())
  );
  bindGlobalConnectionIndicator();
  document.getElementById('btn-crisis-header')?.addEventListener('click', () => navigateTo('crisis'));
  document.getElementById('btn-context-help')?.addEventListener('click', openContextHint);
  document.getElementById('btn-search-global')?.addEventListener('click', openSearch);
}

const CONTEXT_HINTS = {
  fronting: ['Fronting', 'Registra quién está al frente, revisa el historial, edita sesiones pasadas y consulta estadísticas descriptivas por tiempo.'],
  analisis: ['Análisis', 'Usa los filtros de fecha e identidad para revisar actividad descriptiva. Los agregados resumen tus registros; no son diagnósticos ni predicciones.'],
  perfiles: ['Perfiles', 'Crea y organiza identidades, campos personalizados, relaciones, roles, permisos y perfiles archivados.'],
  proyectos: ['Proyectos', 'Guarda trabajos personales de más recorrido vinculados a una identidad o miembro. Las tareas siguen siendo locales y exportables.'],
  diario: ['Diario', 'Usa filtros de identidad, etiquetas, estado, ánimo y fecha para encontrar entradas. Las entradas privadas no se comparten online.'],
  tracker: ['Estado', 'Registra ánimo e intensidad para una identidad. Los resúmenes muestran los registros de origen y el rango seleccionado.'],
  innerchat: ['Chat interno', 'Usa la identidad emisora seleccionada, canales, borradores y estado de no leídos para la comunicación interna.'],
  polls: ['Votaciones', 'Crea decisiones internas ligeras, vota, archiva y elige explícitamente si una votación puede compartirse online.'],
  config: ['Configuración', 'Cambia presentación local, datos, notificaciones, cuenta online, backup y opciones de privacidad.'],
  agenda: ['Agenda', 'Consulta eventos y recordatorios. Exporta los datos visibles al calendario en formato ICS cuando necesites una copia externa.']
};
function openContextHint() {
  const hint = CONTEXT_HINTS[currentView] || ['Este módulo', 'Esta pantalla funciona localmente por defecto. Usa los filtros y acciones visibles para explorar o cambiar sus registros.'];
  openModal(`<div class="modal-title">${hint[0]}</div><div style="font-size:13px;line-height:1.6;color:var(--text-1);margin:4px 0 12px">${hint[1]}</div><div class="modal-footer"><button class="btn btn-primary" data-cancel>Cerrar</button></div>`, () => {});
}

function closeModal() {
  const m = document.querySelector('.modal-overlay');
  if (m) m.remove();
}

function enhanceLargeSelects(root = document) {
  root.querySelectorAll('select:not([data-search-ready])').forEach(select => {
    const options = [...select.options];
    if (options.length < 8) return;
    select.dataset.searchReady = '1';
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'select-search';
    input.placeholder = 'Buscar opciones...';
    input.autocomplete = 'off';
    input.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:5px;padding:7px 9px;background:var(--bg-0);border:1px solid var(--border);border-radius:7px;color:var(--text-1);font-size:12px';
    select.parentNode.insertBefore(input, select);
    input.addEventListener('input', () => {
      const query = input.value.trim().toLocaleLowerCase();
      options.forEach(option => { option.hidden = !!query && !String(option.textContent || option.value).toLocaleLowerCase().includes(query); });
    });
  });
}

window.AtriaPickerSearch = { enhanceLargeSelects };

function openModal(html, onSubmit, extraClass) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal${extraClass?' '+extraClass:''}">${html}</div>`;
  document.body.appendChild(overlay);
  enhanceLargeSelects(overlay);
  if (extraClass === 'alter-modal-wide' && window.innerWidth <= 768) {
    overlay.style.alignItems = 'flex-end';
    overlay.style.justifyContent = 'stretch';
    overlay.style.padding = '0';
    overlay.style.overflowX = 'hidden';
    const modalEl = overlay.querySelector('.modal');
    if (modalEl) {
      modalEl.style.width = '100%';
      modalEl.style.maxWidth = 'none';
      modalEl.style.minHeight = '100dvh';
      modalEl.style.maxHeight = '100dvh';
      modalEl.style.borderRadius = '16px 16px 0 0';
      modalEl.style.padding = '20px 16px calc(20px + env(safe-area-inset-bottom,0px))';
      modalEl.style.margin = '0';
      modalEl.style.overflowX = 'hidden';
    }
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  overlay.querySelector('[data-cancel]')?.addEventListener('click', closeModal);
  overlay.querySelector('[data-submit]')?.addEventListener('click', () => { onSubmit(overlay); closeModal(); });
}

// ═══════════════════════════════════════════════
// I18N — sistema de idioma (layer 0)
// ═══════════════════════════════════════════════
const I18N = {
  es: {
    title:       '¿Quién está presente?',
    refresh:     'Actualizar lista de alters',
    manage:      '⚙ Gestionar perfiles',
    addNew:      'Nuevo alter',
    addNewRole:  'añadir',
  },
  en: {
    title:       'Who is present?',
    refresh:     'Refresh alter list',
    manage:      '⚙ Manage profiles',
    addNew:      'New alter',
    addNewRole:  'add',
  }
};

let currentLang = localStorage.getItem('atria_lang') || 'es';

function t(key) { return (I18N[currentLang] || I18N.es)[key] || key; }

function setLang(lang) {
  if (!I18N[lang]) return;
  localStorage.setItem('atria_lang', lang);
  if (lang !== 'es') {
    window.location.href = '../' + lang + '/';
    return;
  }
  currentLang = lang;
  // Actualizar toggle visual
  document.querySelectorAll('.l0-lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  // Re-render layer 0 con nuevo idioma
  renderLayer0();
}

function initLangToggle() {
  document.querySelectorAll('.l0-lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
}

function placeLangToggle() {
  const toggle = document.querySelector('.l0-lang-toggle');
  if (!toggle) return;
  const mobileActions = document.querySelector('.l0-actions');
  const layer0 = document.getElementById('layer-0');
  if (window.innerWidth <= 768 && mobileActions) {
    if (toggle.parentElement !== mobileActions) mobileActions.appendChild(toggle);
  } else if (layer0) {
    if (toggle.parentElement !== layer0) layer0.insertBefore(toggle, layer0.firstChild);
  }
}

// ═══════════════════════════════════════════════
// LAYER 0
// ═══════════════════════════════════════════════
const L0_PER_PAGE_DESK = 6;
let l0Page = 0;
let l0Query = '';

function l0IsMobile() { return window.innerWidth <= 768; }
function handleLayer0Logout() {
  if (!confirm('¿Cerrar la sesión online de este navegador?')) return;
  disableOnlineAccountSession();
  if (typeof lockOnlineAccess === 'function') lockOnlineAccess();
  showToast('Sesión cerrada');
  window.AtriaOnboardingView.show({ authOnly: true });
}
function updateLayer0LogoutButton() {
  const visible = loadOnlineSession() ? 'inline-flex' : 'none';

  document.getElementById('btn-l0-footer-logout')?.style && (document.getElementById('btn-l0-footer-logout').style.display = visible);
  document.getElementById('btn-l0-online-logout')?.style && (document.getElementById('btn-l0-online-logout').style.display = visible);
  document.getElementById('btn-shell-logout')?.style && (document.getElementById('btn-shell-logout').style.display = visible);
}
function storageRecoveryReason(state) {
  if (state?.status === 'missing') return 'No se encontro la clave principal `tid_alters`, pero si existen otros datos de Atria.';
  if (state?.status === 'empty') return 'La clave `tid_alters` esta vacia, pero si existen otros datos de Atria.';
  if (state?.status === 'invalid') return 'El contenido de `tid_alters` no se puede leer como JSON valido.';
  return 'El formato guardado en `tid_alters` no coincide con un formato compatible.';
}
function renderStorageRecoveryNotice(state) {
  const app = document.getElementById('app');
  if (!app) return;
  const hasOtherTidKeys = hasStoredAtriaDataBesidesAlters();
  const reason = state?.status === 'invalid'
    ? 'El contenido de `tid_alters` no se puede leer como JSON válido.'
    : 'El formato guardado en `tid_alters` no coincide con un formato compatible.';
  app.innerHTML = `
    <div class="empty-state" style="max-width:760px;margin:40px auto;padding:28px;text-align:left">
      <div class="empty-icon">⚠</div>
      <div style="font-size:20px;font-weight:800;color:var(--text-0);margin-top:8px">Se detectaron datos previos, pero esta versión no pudo leer los perfiles guardados.</div>
      <div style="margin-top:10px;color:var(--text-1);line-height:1.7">
        ${storageRecoveryReason(state)}
        ${hasOtherTidKeys ? ' Hay más claves `tid_*` en este navegador, así que abrir el onboarding ahora podría aparentar una instalación nueva y dejar datos antiguos ocultos.' : ''}
      </div>
      <div style="margin-top:14px;color:var(--text-2);font-size:12px;line-height:1.7">
        Recomendación: no crear perfiles nuevos en este navegador hasta revisar una copia del valor antiguo de <code>tid_alters</code> o restaurar desde backup.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
        <button class="btn" id="storage-retry-btn">Reintentar lectura</button>
        <button class="btn btn-ghost" id="storage-config-btn">Abrir configuración</button>
      </div>
    </div>`;
  document.getElementById('storage-retry-btn')?.addEventListener('click', () => {
    const retryState = readStoredAltersState();
    if (retryState.status === 'ok') checkPinOnStart(renderLayer0);
    else renderStorageRecoveryNotice(retryState);
  });
  document.getElementById('storage-config-btn')?.addEventListener('click', () => {
    renderConfigSection('almacenamiento');
  });
}

function renderLayer0() {
  placeLangToggle();
  updateSystemStateBadge();
  updateLayer0LogoutButton();
  const titleEl = document.getElementById('l0-title');
  if (titleEl) titleEl.textContent = t('title');
  const manageBtn = document.getElementById('btn-manage-alters');
  if (manageBtn) manageBtn.textContent = t('manage');
  const refreshBtn = document.getElementById('btn-refresh-layer0');
  if (refreshBtn) refreshBtn.title = t('refresh');

  if (typeof isOnlineAccessLocked === 'function' && isOnlineAccessLocked()) {
    window.AtriaOnboardingView.show({ authOnly: true });
    return;
  }

  ALTERS = getAlters();
  if (!ALTERS.length) {
    if (loadOnlineSession()) {
      renderLayer0OnlineNoProfiles();
      return;
    }
    const altersState = readStoredAltersState();
    if ((altersState.status === 'missing' || altersState.status === 'empty') && !hasStoredAtriaDataBesidesAlters()) window.AtriaOnboardingView.show();
    else renderStorageRecoveryNotice(altersState);
    return;
  }

  // Buscador
  const searchEl = document.getElementById('l0-search');
  if (searchEl) {
    searchEl.disabled = false;
    searchEl.value = l0Query;
    searchEl.oninput = (e) => {
      l0Query = e.target.value.trim().toLowerCase();
      l0Page = 0;
      renderL0Grid();
    };
  }

  renderL0Grid();

  const shellLogoutBtn = document.getElementById('btn-shell-logout');
  if (shellLogoutBtn) shellLogoutBtn.onclick = handleLayer0Logout;

  document.getElementById('btn-l0-footer-logout')?.addEventListener('click', handleLayer0Logout);
  document.getElementById('btn-add-alter')?.addEventListener('click', () => openAlterModal(null, renderLayer0));
  document.getElementById('btn-refresh-layer0')?.addEventListener('click', () => { l0Query=''; l0Page=0; renderLayer0(); });
  document.getElementById('btn-manage-alters')?.addEventListener('click', () => showPerfilesFromLayer0());
}

function handleOnlineLoginHydrationResult(result) {
  const restoreError = String(result?.restoreError || '').trim();
  const currentStatus = loadOnlineBackupStatus() || {};
  if (!restoreError) {
    if (currentStatus.loginRestoreBlocked) {
      saveOnlineBackupStatus({ ...currentStatus, loginRestoreBlocked: false, lastError: null });
    }
    return false;
  }
  const session = loadOnlineSession();
  if (session) saveOnlineSession({ ...session, autoBackup: false });
  saveOnlineBackupStatus({
    ...currentStatus,
    autoBackupEnabled: false,
    loginRestoreBlocked: true,
    lastError: restoreError,
    lastFailedAt: new Date().toISOString(),
    lastReason: 'login-restore',
  });
  return true;
}
const ALTER_ORDER_KEY = 'tid_alter_order';
function loadAlterOrder() { try { const v=JSON.parse(localStorage.getItem(ALTER_ORDER_KEY)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; } }
function saveAlterOrder(ids) { localStorage.setItem(ALTER_ORDER_KEY, JSON.stringify(ids)); }
function orderAlters(list) {
  const order = loadAlterOrder();
  const rank = new Map(order.map((id,i)=>[id,i]));
  return [...list].sort((a,b)=>(rank.get(a.id)??999999)-(rank.get(b.id)??999999));
}
function moveAlterInOrder(id, direction) {
  const ids = orderAlters(getAlters(true)).map(a=>a.id);
  const index = ids.indexOf(id); const next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return;
  [ids[index], ids[next]] = [ids[next], ids[index]]; saveAlterOrder(ids); renderAlters();
}

function renderLayer0OnlineNoProfiles() {
  const titleEl = document.getElementById('l0-title');
  if (titleEl) titleEl.textContent = 'Sesión online iniciada';
  const searchEl = document.getElementById('l0-search');
  if (searchEl) {
    searchEl.value = '';
    searchEl.disabled = true;
    searchEl.placeholder = 'Crea tu primer perfil cuando quieras';
  }
  const manageBtn = document.getElementById('btn-manage-alters');
  if (manageBtn) manageBtn.textContent = 'Crear primer perfil';
  const session = loadOnlineSession();
  const account = loadOnlineAccount();
  const backupStatus = loadOnlineBackupStatus() || {};
  const restoreBlocked = !!backupStatus.loginRestoreBlocked;
  const grid = document.getElementById('alter-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="alter-card-wrap" style="max-width:340px">
      <div class="alter-card" style="--card-color:#5fffb0;cursor:default;min-height:220px;align-items:flex-start;text-align:left;padding:20px">
        <div style="font-size:12px;color:var(--text-3);letter-spacing:.08em;text-transform:uppercase">Cuenta online</div>
        <div style="font-size:20px;font-weight:800;color:var(--text-1);margin-top:10px">${esc(account?.displayName || account?.systemId || 'Atria')}</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);margin-top:8px">${esc(account?.friendCode || 'ATRIA-XXXX-XXXX-XXXX')}</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:10px">${esc(account?.email || session?.email || '')}</div>
        <div style="font-size:12px;color:${restoreBlocked ? '#ffcf6f' : 'var(--text-2)'};margin-top:14px">${restoreBlocked
          ? `La cuenta online existe, pero no se pudieron restaurar sus perfiles. El backup automático queda pausado para proteger la copia remota. ${esc(backupStatus.lastError || '')}`
          : 'Esta cuenta online no tiene perfiles restaurables ahora mismo. Puedes crear uno o restaurar datos más tarde.'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
          <button class="btn ${restoreBlocked ? 'btn-ghost' : 'btn-primary'}" id="btn-l0-create-first-profile">${restoreBlocked ? 'Crear un perfil nuevo igualmente' : 'Crear primer perfil'}</button>
          <button class="btn btn-danger" id="btn-l0-online-logout">Cerrar sesión</button>
        </div>
      </div>
    </div>`;
  document.getElementById('btn-l0-create-first-profile')?.addEventListener('click', () => window.AtriaOnboardingView.show());
  document.getElementById('btn-l0-online-logout')?.addEventListener('click', handleLayer0Logout);
}

function renderL0Grid() {
  const filteredRaw = l0Query
    ? ALTERS.filter(a => a.name.toLowerCase().includes(l0Query) || (a.role||'').toLowerCase().includes(l0Query))
    : ALTERS;
  const filtered = filteredRaw
    .map((alter, index) => ({alter, index}))
    .sort((a,b)=>(isFavoriteAlter(b.alter)?1:0)-(isFavoriteAlter(a.alter)?1:0) || a.index-b.index)
    .map(item => item.alter);

  // En móvil: sin paginación, mostrar todos (scroll nativo)
  let pageAlters, totalPages, showAdd;
  if (l0IsMobile()) {
    pageAlters = filtered;
    totalPages = 1;
    l0Page = 0;
    showAdd = true;
  } else {
    const perPage = L0_PER_PAGE_DESK;
    totalPages = Math.max(1, Math.ceil((filtered.length + 1) / perPage)); // +1 por botón add
    if (l0Page >= totalPages) l0Page = totalPages - 1;
    const startIdx = l0Page * perPage;
    const isLastPage = l0Page === totalPages - 1;
    pageAlters = filtered.slice(startIdx, isLastPage ? undefined : startIdx + perPage);
    showAdd = isLastPage || filtered.length === 0;
  }

  const frontActualId = getFrontingActual()?.alterId || null;
  const grid = document.getElementById('alter-grid');
  grid.innerHTML = pageAlters.map((a,i) => {
    const isFronting = a.id === frontActualId;
    return `
    <div class="alter-card-wrap" style="animation-delay:${i*40}ms">
      <div class="alter-card${isFronting?' is-fronting':''}" data-id="${a.id}" style="--card-color:${a.color}">
        ${isFronting ? `<div class="l0-front-badge">◉ al frente</div>` : ''}
        <button type="button" class="alter-card-fav${isFavoriteAlter(a)?' active':''}" data-fav-id="${a.id}" title="${isFavoriteAlter(a)?'Quitar de favoritos':'Fijar alter'}" aria-label="${isFavoriteAlter(a)?'Quitar de favoritos':'Fijar alter'}">&#9733;</button>
        <div class="alter-avatar" style="background:${a.bg};overflow:hidden;display:flex;align-items:center;justify-content:center">${alterAv(a,48)}</div>
        <div class="alter-name">${esc(a.name)}</div>
        <div class="alter-role">${a.roleType ? getAllRoleTypes().find(r=>r.id===a.roleType)?.label||a.role : a.role}</div>
      </div>
      <div class="alter-card-edit btn-quick-edit" data-id="${a.id}" title="Editar perfil">✎</div>
    </div>`;
  }).join('') +
    (showAdd ? `<div class="alter-card-wrap"><div class="alter-card add-new" id="btn-add-alter">
      <div class="alter-avatar" style="background:var(--bg-2);font-size:28px;border:none">+</div>
      <div class="alter-name">${t('addNew')}</div>
      <div class="alter-role">${t('addNewRole')}</div>
    </div></div>` : '');

  grid.querySelectorAll('.alter-card:not(.add-new)').forEach(card =>
    card.addEventListener('click', () => {
      const a = ALTERS.find(x => x.id === card.closest('.alter-card-wrap').querySelector('.alter-card').dataset.id ||
                                  x.id === card.dataset.id);
      if(a) selectAlter(a);
    })
  );
  grid.querySelectorAll('.btn-quick-edit').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const a = ALTERS.find(x=>x.id===btn.dataset.id);
      if(a) openAlterModal(a, renderLayer0);
    })
  );
  grid.querySelectorAll('.alter-card-fav').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavoriteAlter(btn.dataset.favId);
    })
  );
  document.getElementById('btn-add-alter')?.addEventListener('click', () => openAlterModal(null, renderLayer0));

  // Paginación
  const pgEl = document.getElementById('l0-pagination');
  if (pgEl) {
    if (totalPages <= 1) {
      pgEl.innerHTML = '';
    } else {
      pgEl.innerHTML = `
        <button class="l0-pg-btn" id="l0-pg-prev" ${l0Page===0?'disabled':''}>‹</button>
        <span class="l0-pg-info">${l0Page+1} / ${totalPages}</span>
        <button class="l0-pg-btn" id="l0-pg-next" ${l0Page===totalPages-1?'disabled':''}>›</button>`;
      document.getElementById('l0-pg-prev')?.addEventListener('click', () => { if(l0Page>0){l0Page--;renderL0Grid();} });
      document.getElementById('l0-pg-next')?.addEventListener('click', () => { if(l0Page<totalPages-1){l0Page++;renderL0Grid();} });
    }
  }
}

function isFavoriteAlter(alter) {
  return !!(alter?.isFavorite || alter?.favorite || alter?.pinned);
}

function toggleFavoriteAlter(alterId) {
  if (!alterId) return;
  const list = getAlters(true).map(a => a.id === alterId ? {...a, isFavorite: !isFavoriteAlter(a)} : a);
  saveAlters(list);
  ALTERS = list;
  renderL0Grid();
}

function selectAlter(alter) {
  const previousAlterId = activeAlter?.id || null;
  const frontingAlterId = getFrontingActual()?.alterId || null;
  const isSwitch = (previousAlterId && previousAlterId !== alter.id) || (frontingAlterId && frontingAlterId !== alter.id);
  activeAlter = alter;
  document.body.classList.toggle('atria-simplified-mode', !!loadConfig().simplifiedMode || ['bebe','nino'].includes(alter.ageType));
  registrarSesion(alter.id);
  // Fronting desacoplado: solo registra switch automático si no hay sesión activa de otro alter
  const frontActual = getFrontingActual();
  if (!frontActual) {
    // Sin sesión activa → registrar switch automáticamente
    iniciarFronting(alter.id);
  } else if (frontActual.alterId === alter.id) {
    // Misma persona ya al frente → no tocar fronting
  } else {
    // Hay sesión activa de OTRO alter → preguntar
    _pendingSwitchAlterId = alter.id;
  }
  if (getOnlineProfile().enabled && getOnlineProfile().fronting && hasOnlineBackendConfigured()) {
    setTimeout(() => setOnlinePresenceState(loadOnlineSession()?.presenceState || 'online').catch(() => {}), 50);
  }
  document.getElementById('layer-0').classList.add('exit');
  const sbAv = document.getElementById('sb-avatar');
  if(sbAv) {
    sbAv.innerHTML = alterAv(alter, 34);
    sbAv.style.cssText = `background:${alter.bg};border-color:${alter.color}`;
  }
  document.getElementById('sb-name').textContent = alter.name;
  document.getElementById('sb-role').textContent = alter.role;
  renderSidebarNav();
  setTimeout(() => {
    document.getElementById('shell').classList.add('visible');
    // Bind mobile nav
    document.querySelectorAll('.mob-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.id === 'mob-nav-search') { closeMobileNav(); window.AtriaSearchView.open(); return; }
        if (item.id === 'mob-nav-switch') {
          activeAlter = null;
          document.getElementById('shell').classList.remove('visible');
          const l0 = document.getElementById('layer-0');
          l0.classList.remove('exit');
          closeMobileNav();
          return;
        }
        if (!item.dataset.view) { closeMobileNav(); return; }
        navigateTo(item.dataset.view);
        closeMobileNav();
      });
    });
    // Arrancar scheduler de notificaciones nativas si el permiso ya está concedido
    if (nativeNotifGranted()) startNotifScheduler();
    // Preguntar cómo se siente el alter al entrar
    askMoodOnEntry(alter, isSwitch, () => {
      navigateTo('hub');
      processPendingNotifRoute();
      // Si hay un switch pendiente por confirmar, mostrar modal después del mood
      if (_pendingSwitchAlterId) {
        const pid = _pendingSwitchAlterId;
        _pendingSwitchAlterId = null;
        setTimeout(() => openConfirmarSwitchModal(pid), 400);
      }
    });
  }, 350);
}

function askMoodOnEntry(alter, isSwitch, onDone) {
  const today = new Date().toISOString().slice(0,10);
  const promptKey = 'tid_mood_entry_prompt';
  let lastPrompt = null;
  try { lastPrompt = JSON.parse(localStorage.getItem(promptKey) || 'null'); } catch (_) {}
  if (lastPrompt?.date === today && (!isSwitch || lastPrompt.alterId === alter.id)) {
    onDone();
    return;
  }
  localStorage.setItem(promptKey, JSON.stringify({ alterId: alter.id, date: today }));
  const moods = getMoods();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay mood-entry-overlay';
  ov.style.cssText = 'animation:fadeUp 280ms ease both';
  ov.innerHTML = `
    <div class="modal mood-entry-modal" style="animation:fadeUp 280ms ease both">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="width:40px;height:40px;border-radius:50%;background:${alter.bg};border:2px solid ${alter.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">${alterAv(alter,40)}</div>
        <div>
          <div style="font-size:15px;font-weight:600;color:var(--text-1)">Hola, ${esc(alter.name)}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px">¿Cómo te encuentras ahora mismo?</div>
        </div>
      </div>
      <div id="mood-entry-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;margin-bottom:16px">
        ${moods.map(m=>`
          <button class="mood-entry-btn" data-mood="${m.id}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-2);cursor:pointer;transition:all .15s;font-size:11px;color:var(--text-2);line-height:1.2">
            <span style="font-size:22px">${m.emoji}</span>
            <span>${m.label}</span>
          </button>`).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="mood-entry-skip">Ahora no</button>
        <button class="btn btn-primary btn-sm" id="mood-entry-save" style="display:none">Guardar</button>
      </div>
    </div>`;

  document.body.appendChild(ov);
  let selMood = null;

  ov.querySelectorAll('.mood-entry-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selMood = btn.dataset.mood;
      ov.querySelectorAll('.mood-entry-btn').forEach(b => {
        b.style.borderColor = b.dataset.mood === selMood ? alter.color : 'var(--border)';
        b.style.background  = b.dataset.mood === selMood ? alter.bg : 'var(--bg-2)';
        b.style.color       = b.dataset.mood === selMood ? 'var(--text-1)' : 'var(--text-2)';
      });
      ov.querySelector('#mood-entry-save').style.display = '';
    });
  });

  const finish = () => { ov.remove(); onDone(); };

  ov.querySelector('#mood-entry-skip').addEventListener('click', finish);

  ov.querySelector('#mood-entry-save').addEventListener('click', () => {
    if (!selMood) { finish(); return; }
    const today = new Date().toISOString().slice(0,10);
    const entries = loadTracker();
    const existing = entries.findIndex(e => e.date === today && e.alterId === alter.id);
    const entry = {id:uid(), alterId:alter.id, date:today, mood:selMood, intensity:3, note:'', ts:Date.now()};
    if (existing >= 0) entries[existing] = {...entries[existing], ...entry, id:entries[existing].id};
    else entries.push(entry);
    saveTracker(entries);
    finish();
  });
}

function closeMobileNav() {
  const nav = document.getElementById('mobile-nav');
  if (!nav) return;
  nav.classList.remove('mob-nav-open');
  nav.classList.add('mob-nav-hidden');
  const icon = document.querySelector('#mob-nav-toggle-icon');
  if (icon) icon.textContent = '☰';
}

function showPerfilesFromLayer0() {
  // Show perfiles manager as a full overlay directly from layer 0
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.style.cssText = 'align-items:flex-start;padding:40px 20px;overflow-y:auto';
  ov.innerHTML = `<div class="modal" style="width:min(860px,95vw);max-height:none">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <div>
        <div class="modal-title">⚙ Gestión de perfiles</div>
        <div class="modal-subtitle">Crea, edita y configura los alters del sistema</div>
      </div>
      <button class="btn btn-ghost" data-cancel>✕ Cerrar</button>
    </div>
    <div id="perfiles-inline-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-top:16px"></div>
    <div style="margin-top:14px">
      <button class="btn btn-primary" id="btn-new-alter-inline">+ Nuevo alter</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-cancel]').addEventListener('click', () => { ov.remove(); renderLayer0(); });
  ov.addEventListener('click', e => { if(e.target===ov){ ov.remove(); renderLayer0(); } });
  ov.querySelector('#btn-new-alter-inline').addEventListener('click', () => { ov.remove(); openAlterModal(null, ()=>showPerfilesFromLayer0()); });
  renderPerfilesInline(ov.querySelector('#perfiles-inline-grid'), ov);
}

function renderPerfilesInline(grid, ov) {
  const alters = getAlters();
  const MODULES_LIST = [{id:'finanzas',label:'Finanzas'},{id:'emociones',label:'Emociones'},{id:'diario',label:'Diario'},{id:'comunicacion',label:'Comunicación'},{id:'perfiles',label:'Perfiles'}];
  grid.innerHTML = alters.map(a => {
    const rt = getAllRoleTypes().find(r=>r.id===a.roleType);
    return `<div class="perfil-card" data-id="${a.id}">
      ${a.bannerImg
        ? `<div class="perfil-card-banner" style="background-image:url(${a.bannerImg})">
             <div class="perfil-card-banner-av">
               <div class="perfil-card-avatar" style="background:${a.bg};border-color:${a.color};overflow:hidden;display:flex;align-items:center;justify-content:center">${alterAv(a,52)}</div>
             </div>
           </div>`
        : ''}
      <div class="perfil-card-top${a.bannerImg?' has-banner':''}">
        ${!a.bannerImg?`<div class="perfil-card-avatar" style="background:${a.bg};border-color:${a.color};overflow:hidden;display:flex;align-items:center;justify-content:center">${alterAv(a,52)}</div>`:''}
        <div class="perfil-card-info">
          <div class="perfil-card-name">${esc(a.name)}${a.isAdmin?'<span class="perfil-admin-badge">Admin</span>':''}${(()=>{const _s=ALTER_STATES.find(s=>s.id===(a.state||'activo'));return _s&&_s.id!=='activo'?`<span class="alter-state-badge" style="color:${_s.color}">${_s.icon} ${_s.label}</span>`:'';})()}</div>
          <div class="perfil-card-role" style="color:${a.color}">${rt?rt.emoji+' ':''} ${a.role||rt?.label||'—'}</div>
          <div class="perfil-card-pronouns">${a.pronouns||''}${a.pronouns&&a.ageType?' · ':''}${AGE_TYPES.find(x=>x.id===a.ageType)?.label?.replace(/\s*\(.*?\)/,'')||''}</div>
        </div>
      </div>
      ${a.description?`<div class="perfil-card-desc">${renderSafeProfileMarkdown(a.description)}</div>`:''}
      ${a.galleryImgs?.length?`<div class="alter-media-strip">${a.galleryImgs.slice(0,4).map(img=>`<img src="${img}" alt="" loading="lazy">`).join('')}</div>`:''}
      ${a.referenceImgs?.length?`<div class="alter-reference-links">${a.referenceImgs.slice(0,4).map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">↗ Referencia</a>`).join('')}</div>`:''}
      ${a.identityFlags?.length?`<div class="perfil-card-flags">${a.identityFlags.map(flag=>`<span class="perm-chip on">${esc(flag)}</span>`).join('')}</div>`:''}
      ${a.identityTerms?`<div style="font-size:11px;color:var(--text-2);margin:5px 0">Términos: ${esc(a.identityTerms)}</div>`:''}
      ${a.mentionedAlterIds?.length?`<div style="font-size:11px;color:var(--text-2);margin:5px 0">Menciones: ${a.mentionedAlterIds.map(id=>getAlters(true).find(x=>x.id===id)?.name).filter(Boolean).map(esc).join(', ')}</div>`:''}
      <div class="perfil-card-perms">
        ${MODULES_LIST.map(m=>`<span class="perm-chip ${a.permissions?.[m.id]?'on':'off'}">${m.label}</span>`).join('')}
      </div>
      <div class="perfil-card-actions">
        <button class="btn btn-ghost btn-sm btn-edit-perfil" data-id="${a.id}">✎ Editar</button>
        ${!a.isAdmin?`<button class="btn btn-danger btn-sm btn-del-perfil" data-id="${a.id}">✕</button>`:''}
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.btn-edit-perfil').forEach(b=>b.addEventListener('click',()=>{
    const a=getAlters().find(x=>x.id===b.dataset.id);
    if(a){ ov.remove(); openAlterModal(a,()=>showPerfilesFromLayer0()); }
  }));
  grid.querySelectorAll('.btn-del-perfil').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('¿Eliminar este alter?')) return;
    purgeAlterData(b.dataset.id);
    saveAlters(getAlters(true).filter(x=>x.id!==b.dataset.id));
    renderLayer0();
    renderPerfilesInline(grid, ov);
    showToast('Alter eliminado');
  }));
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function showErrorBoundary(view, err) {
  console.error('[Atria] Error en módulo:', view, err);
  const app = document.getElementById('app');
  if (!app) return;
  const msg = err?.message || String(err) || 'Error desconocido';
  app.innerHTML = [
    '<div class="error-boundary">',
    '<div class="error-boundary-icon">&#9888;&#65039;</div>',
    '<div class="error-boundary-title">Algo salió mal en este módulo</div>',
    '<div class="error-boundary-desc">Ocurrió un error al cargar <strong>' + escF(view) + '</strong>.<br>Tus datos no se han perdido. Puedes volver al inicio y seguir usando la app.</div>',
    '<details style="width:100%;max-width:420px">',
    '<summary style="font-family:DM Mono,monospace;font-size:10px;color:var(--text-2);cursor:pointer;margin-bottom:6px">Ver detalle del error</summary>',
    '<div class="error-boundary-detail">' + escF(msg) + '</div>',
    '</details>',
    '<div class="error-boundary-actions">',
    '<button class="btn btn-primary" id="err-go-hub">Volver al inicio</button>',
    '<button class="btn btn-ghost" id="err-retry">Reintentar</button>',
    '</div>',
    '</div>'
  ].join('');
  document.getElementById('err-go-hub')?.addEventListener('click', () => navigateTo('hub'));
  document.getElementById('err-retry')?.addEventListener('click', () => navigateTo(view));
}

function navigateTo(view, _fromPopstate) {
  // Limpiar timer de fronting si salimos de la vista
  if (view !== 'fronting' && _frontTimerInterval) {
    clearInterval(_frontTimerInterval);
    _frontTimerInterval = null;
  }
  if (navigateTo._running) { console.error('navigateTo recursion detected! view:', view, new Error().stack); return; }
  navigateTo._running = true;
  try {
  const accessView = accessControlledView(view);
  if (accessView !== 'hub' && !canAccess(accessView)) {
    currentView = accessView;
    renderAccessDenied(accessView);
    return;
  }
  currentView = view;
  if (!_fromPopstate) {
    history.pushState({ view }, '', location.href.split('?')[0]);
  }
  // Reset chat layout styles when leaving
  const app = document.getElementById('app');
  if (app && view !== 'innerchat') { app.style.padding=''; app.style.overflow=''; app.style.display=''; app.style.flexDirection=''; app.style.height=''; app.classList.remove('chat-app-mode'); }
  if (view !== 'diario') { diarioMode='list'; diarioEditing=null; }
  if (!['innerchat','notas','solicitudes'].includes(view)) { notasModuleTab='solicitudes'; }
  if (!['innerchat','tablon','notas','solicitudes','wishlist'].includes(view)) { comTab='chat'; }
  if (view !== 'wishlist') { wishStatusFilter='all'; wishCatFilter='all'; }
  if (view !== 'normas') { normasTab='activas'; }
  if (view !== 'tracker') { window._trackerHistoryLimit = undefined; }
  if (view !== 'rutinas') { rutinasTab='hoy'; }
  if (view !== 'archivo') archivoOpenSections={diario:true,notas:true,proyectos:true,normas:true,wishlist:true};
  if (getOnlineProfile().enabled && hasOnlineBackendConfigured()) startOnlineSyncLoop();
  else stopOnlineSyncLoop();
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
  // Update mobile nav active state — secciones del hub
  {
    const MOB_SECTION_MAP = {
      hub:        'hub',
      innerchat:  'innerchat', notas:'innerchat', solicitudes:'innerchat', tablon:'innerchat', wishlist:'innerchat',
      agenda:     'agenda', rutinas:'agenda', proyectos:'agenda',
      finanzas:   'agenda', 'finanzas/ig':'agenda', 'finanzas/ahorros':'agenda',
      'finanzas/presupuestos':'agenda', 'finanzas/registro':'agenda', 'finanzas/categorias':'agenda', 'finanzas/sistema':'agenda',
      crisis:     'crisis',
      perfiles:   'config', fichas:'config', fronting:'config',
    memoria:    'config', biblioteca:'config', normas:'config', polls:'config', diario:'config',
      headspace:'config', relations:'config',
      config:     'config', archivo:'config', seguridad:'config', notif:'config',
      tracker:'config', recordatorios:'config',
    };
    const sect = MOB_SECTION_MAP[view] || (typeof view === 'string' ? view.split('/')[0] : '');
    document.querySelectorAll('.mob-nav-item').forEach(n => {
      const isActive = n.dataset.view === sect;
      n.classList.toggle('active', isActive);
      if (isActive) n.setAttribute('aria-current', 'page');
      else n.removeAttribute('aria-current');
    });
  }
  const root = view === 'hub' ? 'hub' : view.split('/')[0];
  try {
    if (root === 'innerchat' || root === 'notas' || root === 'tablon' || root === 'solicitudes' || root === 'wishlist') {
      // Resaltar el sub-item correcto de Comunicación
      document.querySelectorAll('.nav-item[data-view="innerchat"]').forEach(el => {
        el.classList.remove('active');
        el.removeAttribute('aria-current');
      });
      const activeComTab = comTab || 'chat';
      const activeChatItem = document.querySelector(`.nav-item[data-view="innerchat"][data-comtab="${activeComTab}"]`);
      activeChatItem?.classList.add('active');
      activeChatItem?.setAttribute('aria-current', 'page');
    } else {
      const activeItem = document.querySelector(`[data-view="${root}"]`);
      activeItem?.classList.add('active');
      activeItem?.setAttribute('aria-current', 'page');
    }
  } catch(e) {
    const activeItem = document.querySelector(`[data-view="${root}"]`);
    activeItem?.classList.add('active');
    activeItem?.setAttribute('aria-current', 'page');
  }
  closeModal();

  const routes = window.AtriaCore.registerViews({}, {
    hub: renderHub,
    perfiles: renderPerfiles,
    agenda: renderAgenda,
    rutinas: renderRutinas,
    innerchat: renderInnerChat,
    diario: window.AtriaDiaryView?.render || renderDiario,
    config: renderConfig,
    archivo: renderArchivo,
    normas: window.AtriaRulesView.render,
    polls: renderPolls,
    notas: renderNotas,
    wishlist: renderWishlist,
    proyectos: renderProyectos,
    memoria: renderMemoria,
    biblioteca: renderBiblioteca,
    notif: renderNotif,
    crisis: renderCrisis,
    seguridad: renderSeguridadRoute,
    finanzas: renderFinanzasDashboard,
    fronting: renderFronting,
    tablon: renderTablon,
    fichas: renderFichas,
    tracker: window.AtriaTrackerView.render,
    analisis: renderAnalisis,
    recordatorios: window.AtriaReminderView.render,
    'online-amigos': renderOnlineAmigos,
    'online-perfil': renderOnlinePerfil,
    'online-shared-profile': renderOnlineSharedProfile,
    'online-sync': renderOnlineSync,
    headspace: renderHeadspace,
    relations: renderRelations,
    'finanzas/ig': renderIG,
    'finanzas/ahorros': renderAhorros,
    'finanzas/presupuestos': renderPresupuestos,
    'finanzas/registro': renderRegistro,
    'finanzas/categorias': renderCategorias,
    'finanzas/sistema': renderFinanzasSistema,
  });
  try {
    (routes[view] || (() => showToast('Módulo próximamente')))();
  } catch(renderErr) {
    showErrorBoundary(view, renderErr);
  }
  } finally { navigateTo._running = false; }
}

// ═══════════════════════════════════════════════
// HUB
// ═══════════════════════════════════════════════
function renderHub() {
  if (renderHub._running) { console.error('renderHub recursion!', new Error().stack); return; }
  renderHub._running = true;
  try {
  setCrumbs([{label:'Hub'}]);

  const now    = new Date();
  const h      = now.getHours();
  const greet  = h<6?'Buenas noches':h<13?'Buenos días':h<20?'Buenas tardes':'Buenas noches';
  const dayStr = now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});

  // ── DATA ──
  const solicPend = loadSolicitudes().filter(s=>
    (s.toId===activeAlter.id||s.toId==='sistema')&&s.status==='pendiente'
  );
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const remindersHoy = (() => { try { return loadReminders().filter(r=>!r.done&&r.datetime<=todayEnd.getTime()&&(!r.alterId||r.alterId===activeAlter.id)); } catch{return[];} })();

  // Barra de estado: fronting
  const frontCurrent = loadFronting().find(s=>!s.end);
  const allAlters = getAlters();
  let frontStatusHtml = '';
  if (frontCurrent) {
    const fa = allAlters.find(a=>a.id===frontCurrent.alterId);
    if (fa) {
      const ms = Date.now()-frontCurrent.start;
      const m = Math.floor(ms/60000); const hh = Math.floor(m/60);
      const elapsed = hh>0 ? hh+'h '+(m%60)+'m' : m+'m';
      const coCount = (frontCurrent.coFronting||[]).length;
      frontStatusHtml = `<span style="font-size:13px">${fa.emoji}</span><div style="min-width:0"><div class="hub-status-val" style="color:${fa.color}">${fa.name}${coCount?` +${coCount}`:''}</div><div class="hub-status-label">◷ ${elapsed}</div></div>`;
    }
  } else {
    frontStatusHtml = `<span class="hub-status-icon" style="color:var(--text-3)">◉</span><div><div class="hub-status-val" style="color:var(--text-2)">Sin sesión</div><div class="hub-status-label">fronting</div></div>`;
  }

  // Barra de estado: tablón
  const tablonMsgs = loadTablon().sort((a,b)=>b.ts-a.ts);
  const tablonPin = tablonMsgs.find(m=>m.pinned);
  const tablonLast = tablonPin || tablonMsgs[0];
  let tablonStatusHtml = '';
  if (tablonLast) {
    const ta = allAlters.find(a=>a.id===tablonLast.alterId)||{emoji:'◎',name:'Sistema',color:'var(--text-2)'};
    const txt = tablonLast.text.length>38 ? tablonLast.text.slice(0,38)+'…' : tablonLast.text;
    tablonStatusHtml = `<span style="font-size:13px">${ta.emoji}</span><div style="min-width:0"><div class="hub-status-val">${escM(txt)}</div><div class="hub-status-label">${tablonPin?'◈ fijado · ':''}${ta.name}</div></div>`;
  } else {
    tablonStatusHtml = `<span class="hub-status-icon" style="color:var(--text-3)">◈</span><div><div class="hub-status-val" style="color:var(--text-2)">Sin mensajes</div><div class="hub-status-label">tablón</div></div>`;
  }

  // Snapshot: rutinas hoy y próximo recordatorio
  const allRoutines = (() => { try { return loadRoutines().filter(r => routineVisibleToAlter(r, activeAlter?.id) && routineDueOnDate(r, new Date().toISOString().slice(0,10))); } catch{return[];} })();
  const doneRoutinesToday = allRoutines.filter(r => routineProgress(r, new Date().toISOString().slice(0,10)).done).length;
  const nextReminder = (() => { try { return loadReminders().filter(r=>!r.done&&r.datetime>Date.now()&&(!r.alterId||r.alterId===activeAlter.id)).sort((a,b)=>a.datetime-b.datetime)[0]||null; } catch{return null;} })();

  // ── DASHBOARD CARDS ──
  const todayStr = now.toISOString().slice(0,10);

  // Tracker hoy
  const trackerHoy = loadTracker().find(e => e.alterId===activeAlter.id && e.date===todayStr);
  const moodObj    = trackerHoy ? getMoods().find(m=>m.id===trackerHoy.mood) : null;
  const moodEmoji  = moodObj?.emoji || '◫';
  const moodLabel  = moodObj?.label || trackerHoy?.mood || '—';
  const moodInt    = trackerHoy?.intensity || 0;

  // Proyectos y tareas
  const proyActivos  = loadProyectos().filter(p=>p.status==='activo');
  const tareasAll    = loadTareas();
  const tareasPend   = tareasAll.filter(t=>t.status!=='completada'&&(t.assigneeId===activeAlter.id||proyActivos.some(p=>p.id===t.proyId)));
  const tareasVenc   = tareasPend.filter(t=>t.deadline&&t.deadline<todayStr);

  // Próxima cita de agenda
  const nowMs = Date.now();
  const nextEvent = (() => {
    try {
      return loadEvents()
        .filter(e => (e.scope==='compartido'||getEventAlterIds(e).includes(activeAlter.id)) && eventDate(e.date, e.time || '23:59').getTime() >= nowMs)
        .sort((a,b) => eventDate(a.date, a.time || '23:59').getTime() - eventDate(b.date, b.time || '23:59').getTime())[0] || null;
    } catch { return null; }
  })();

  const _onlineEnabled = getOnlineProfile().enabled;

  // Módulos del hub — filtrados por permisos del alter activo
  const HUB_NAV_DEF = [
    {
      label:'Sistema', color:'#ff8ae2',
      items:[
        {id:'innerchat',     name:'Comunicación',   icon:'◭', color:'#8affe0', view:'innerchat',     perm:'comunicacion'},
        {id:'fronting',      name:'Fronting',        icon:'◉', color:'#ff8ae2', view:'fronting'},
        {id:'perfiles',      name:'Alters',          icon:'◎', color:'#8ab4ff', view:'perfiles'},
        {id:'tracker',       name:'Estado',          icon:'🌡', color:'#ffd580', view:'tracker',       perm:'emociones'},
        {id:'analisis',      name:'Análisis',        icon:'◈', color:'#5fffb0', view:'analisis'},
        {id:'recordatorios', name:'Recordatorios',   icon:'🔔', color:'#8affe0', view:'recordatorios'},
      ]
    },
    {
      label:'Personal', color:'#ff8ae2',
      items:[
        {id:'diario',     name:'Diario',     icon:'◫', color:'#ff8ae2', view:'diario',     perm:'diario'},
        {id:'normas',     name:'Normas',     icon:'◳', color:'#8ab4ff', view:'normas',     perm:'normas'},
        {id:'polls',      name:'Votaciones', icon:'◎', color:'#ffd580', view:'polls',      perm:'normas'},
        {id:'memoria',    name:'Memoria',    icon:'◌', color:'#ffb450', view:'memoria'},
        {id:'biblioteca', name:'Biblioteca', icon:'◫', color:'#a08aff', view:'biblioteca'},
      ]
    },
    {
      label:'Interno', color:'#ff8ae2',
      items:[
        {id:'headspace', name:'Headspace', icon:'⌂', color:'#8ab4ff', view:'headspace'},
        {id:'relations', name:'Relaciones', icon:'↔', color:'#ff8ae2', view:'relations'},
      ]
    },
    {
      label:'Herramientas', color:'#a08aff',
      items:[
        {id:'agenda',    name:'Agenda',    icon:'◷', color:'#ffb450', view:'agenda',    perm:'agenda'},
        {id:'rutinas',   name:'Rutinas',   icon:'◎', color:'#ffd580', view:'rutinas'},
        {id:'proyectos', name:'Proyectos', icon:'◉', color:'#8affe0', view:'proyectos', perm:'proyectos'},
        {id:'finanzas',  name:'Finanzas',  icon:'◈', color:'#5fffb0', view:'finanzas',  perm:'finanzas'},
      ]
    },
    ...(_onlineEnabled ? [{
      label:'Online', color:'#5fffb0',
      items:[
        {id:'online-amigos',     name:'Amigos',  icon:'◉', color:'#ff8ae2', view:'online-amigos'},
        {id:'hub-online-chat',   name:'Chat',    icon:'💬', color:'#8affe0', view:'innerchat'},
        {id:'online-perfil',     name:'Perfil',  icon:'◎', color:'#8ab4ff', view:'online-perfil'},
        {id:'online-sync',       name:'Sync',    icon:'🔄', color:'#80d0ff', view:'online-sync'},
      ]
    }] : []),
  ];
  const HUB_NAV = HUB_NAV_DEF
    .map(sec => ({
      ...sec,
      items: sec.items.filter(it => {
        if (!it.perm) return true;
        if (activeAlter.isAdmin) return true;
        const p = activeAlter.permissions;
        if (!p) return true;
        return p[it.perm] !== false;
      })
    }))
    .filter(sec => sec.items.length > 0);



  const onlinePresenceSummary = _onlineEnabled ? getOnlinePresenceSummary() : { total:0, online:0, idle:0 };
  const onlinePresenceMap = _onlineEnabled ? loadOnlinePresenceCache() : {};
  const _onlinePendingReqs = _onlineEnabled ? loadOnlineFriendRequests().filter(r => r.status === 'pending').length : 0;
  const onlinePresenceHtml = (_onlineEnabled && (onlinePresenceSummary.total || Object.keys(onlinePresenceMap).length)) ? `
  <div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-md)">
    <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.1em;font-family:'DM Mono',monospace">☁ Presencia online</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--text-1)">
      <span><strong style="color:#5fffb0">${onlinePresenceSummary.online}</strong> online</span>
      <span><strong style="color:#ffd580">${onlinePresenceSummary.idle}</strong> idle</span>
      <span><strong style="color:var(--text-2)">${onlinePresenceSummary.total}</strong> visible${onlinePresenceSummary.total!==1?'s':''}</span>
    </div>
    ${loadOnlineFriends().slice(0,4).map(f => {
      const p = onlinePresenceMap[f.id];
      if (!p || !p.state || p.state === 'offline') return '';
      return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-1)">
        <span style="color:${p.state==='online'?'#5fffb0':p.state==='idle'?'#ffd580':'var(--text-3)'}">◉</span>
        <span style="font-weight:600">${escM(f.displayName || f.identifier)}</span>
        <span style="color:var(--text-2)">— ${escM(p.state)}</span>
      </div>`;
    }).join('')}
  </div>` : '';

  // ── NOTIFICACIONES ──
  let notifBannersHtml = '';
  try { notifBannersHtml = activeAlter ? renderNotifBanners(activeAlter.id) : ''; } catch(e) { console.warn('Notif error:', e); }

  document.getElementById('app').innerHTML = `
    <div class="hub-view">

      <!-- CABECERA -->
      <div>
        <div class="hub-greeting-label">${greet} · ${dayStr}</div>
        <div class="hub-greeting-title">Hola, <span style="color:${activeAlter.color}">${activeAlter.name}</span></div>
      </div>

      ${notifBannersHtml}

      <!-- BARRA DE ESTADO -->
      <div class="hub-status-bar">
        <div class="hub-status-item" id="hub-status-front" style="flex:1;min-width:0">
          ${frontStatusHtml}
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-hub-quick-switch" style="flex-shrink:0;white-space:nowrap" title="Switch rápido de fronting">⇄ Switch</button>
        <div class="hub-status-item" id="hub-status-tablon">
          ${tablonStatusHtml}
        </div>
        ${solicPend.length>0?`<div class="hub-status-item" id="hub-status-solic" style="flex:0 0 auto">
          <span class="hub-status-icon" style="color:#ff8ae2">◱</span>
          <div><div class="hub-status-val" style="color:#ff8ae2">${solicPend.length} pendiente${solicPend.length!==1?'s':''}</div><div class="hub-status-label">solicitudes</div></div>
        </div>`:''}
        ${remindersHoy.length>0?`<div class="hub-status-item" id="hub-status-reminders" style="flex:0 0 auto;cursor:pointer">
          <span class="hub-status-icon">🔔</span>
          <div><div class="hub-status-val" style="color:#ffd580">${remindersHoy.length} hoy</div><div class="hub-status-label">recordatorios</div></div>
        </div>`:''}
      </div>

      ${onlinePresenceHtml}

      <!-- SNAPSHOT -->
      ${(allRoutines.length > 0 || nextReminder) ? `<div class="hub-snapshot">
        ${allRoutines.length > 0 ? `<div class="hub-snap-card" id="snap-rutinas">
          <span class="hub-snap-icon">◎</span>
          <div>
            <div class="hub-snap-val">${doneRoutinesToday}/${allRoutines.length}</div>
            <div class="hub-snap-label">rutinas hoy</div>
          </div>
          <div class="hub-snap-bar">
            <div class="hub-snap-fill" style="width:${allRoutines.length?Math.round((doneRoutinesToday/allRoutines.length)*100):0}%;background:var(--accent-2)"></div>
          </div>
        </div>` : ''}
        ${nextReminder ? `<div class="hub-snap-card" id="snap-reminder">
          <span class="hub-snap-icon">🔔</span>
          <div>
            <div class="hub-snap-val" style="font-size:12px">${escM(nextReminder.title.length>22?nextReminder.title.slice(0,22)+'…':nextReminder.title)}</div>
            <div class="hub-snap-label">${new Date(nextReminder.datetime).toLocaleString('es-ES',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
          </div>
        </div>` : ''}
      </div>` : ''}

      <!-- DASHBOARD CARDS -->
      <div class="hub-dashboard">
        ${(activeAlter.permissions?.emociones !== false || activeAlter.isAdmin) ? `<div class="hub-dash-card" id="dash-tracker" title="Ver tracker emocional">
          <div class="hub-dash-card-header">
            <span class="hub-dash-card-label">Estado hoy</span>
            ${trackerHoy ? '' : `<span style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace">+ añadir</span>`}
          </div>
          ${trackerHoy
            ? `<div class="hub-dash-card-main">${moodEmoji} <span style="font-weight:700;color:var(--text-1)">${escM(moodLabel)}</span></div>
               <div class="hub-dash-int-row">${[1,2,3,4,5].map(i=>`<span class="hub-dash-int-pip${moodInt>=i?' on':''}" style="${moodInt>=i?'background:var(--accent)':''}"></span>`).join('')}</div>`
            : `<div class="hub-dash-card-main" style="color:var(--text-1);font-size:13px">Sin registro hoy</div>`
          }
        </div>` : ''}
        <div class="hub-dash-card" id="dash-proyectos" title="Ver proyectos">
          <div class="hub-dash-card-header">
            <span class="hub-dash-card-label">Proyectos</span>
            ${tareasVenc.length ? `<span style="font-size:10px;color:#ff6b8a;font-family:'DM Mono',monospace">⚠ ${tareasVenc.length} vencida${tareasVenc.length!==1?'s':''}</span>` : ''}
          </div>
          <div class="hub-dash-card-main">${proyActivos.length} <span style="font-size:11px;color:var(--text-1);font-weight:400">activo${proyActivos.length!==1?'s':''}</span></div>
          <div style="font-size:11px;color:var(--text-1);margin-top:2px">${tareasPend.length} tarea${tareasPend.length!==1?'s':''} pendiente${tareasPend.length!==1?'s':''}</div>
        </div>
        ${(activeAlter.permissions?.agenda !== false || activeAlter.isAdmin) ? `<div class="hub-dash-card" id="dash-agenda" title="Ver agenda">
          <div class="hub-dash-card-header"><span class="hub-dash-card-label">Próxima cita</span></div>
          ${nextEvent
            ? `<div class="hub-dash-card-main" style="font-size:12px;font-weight:700;line-height:1.3">${escM(nextEvent.title.length>26?nextEvent.title.slice(0,26)+'…':nextEvent.title)}</div>
               <div style="font-size:11px;color:var(--accent);margin-top:2px;font-family:'DM Mono',monospace">${eventDate(nextEvent.date,nextEvent.time).toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})}${nextEvent.allDay||!nextEvent.time ? ' · Todo el día' : ''}</div>`
            : `<div class="hub-dash-card-main" style="color:var(--text-1);font-size:13px">Sin eventos</div>`
          }
        </div>` : ''}
        ${_onlineEnabled ? `<div class="hub-dash-card" id="dash-online" title="Ver amigos online" style="cursor:pointer">
          <div class="hub-dash-card-header"><span class="hub-dash-card-label" style="color:#5fffb0">Online</span></div>
          <div class="hub-dash-card-main" style="font-size:13px">
            <span style="color:${onlinePresenceSummary.online>0?'#5fffb0':'var(--text-3)'}">●</span>
            <span style="font-weight:700">${onlinePresenceSummary.online}</span>
            <span style="font-size:11px;color:var(--text-1);font-weight:400">amigo${onlinePresenceSummary.online!==1?'s':''} online</span>
          </div>
          ${_onlinePendingReqs > 0 ? `<div style="font-size:11px;color:#ffd580;margin-top:2px">⚑ ${_onlinePendingReqs} solicitud${_onlinePendingReqs!==1?'es':''} pendiente${_onlinePendingReqs!==1?'s':''}</div>` : ''}
        </div>` : ''}
      </div>

      <!-- NAVEGACIÓN POR MÓDULOS -->
      <div class="hub-nav">
        ${HUB_NAV.map(sec=>`
          <div>
            <div class="hub-section-label">${sec.label}</div>
            <div class="hub-btn-grid">
              ${sec.items.map(item=>`
                <button class="hub-btn${item.full?' full':''}" data-view="${item.view}" data-id="${item.id}"
                  style="--btn-color:${item.color}">
                  <span class="hub-btn-icon">${item.icon}</span>
                  <span class="hub-btn-name">${item.name}</span>
                  ${item.badge?`<span class="hub-btn-badge ${item.badgeClass||''}">${item.badge}</span>`:''}
                </button>`).join('')}
            </div>
          </div>`).join('')}
      </div>

    </div>`;

  // Wire barra de estado
  document.getElementById('snap-rutinas')?.addEventListener('click',()=>navigateTo('rutinas'));
  document.getElementById('snap-reminder')?.addEventListener('click',()=>navigateTo('recordatorios'));
  document.getElementById('dash-tracker')?.addEventListener('click',()=>navigateTo('tracker'));
  document.getElementById('dash-proyectos')?.addEventListener('click',()=>navigateTo('proyectos'));
  document.getElementById('dash-agenda')?.addEventListener('click',()=>navigateTo('agenda'));
  document.getElementById('dash-online')?.addEventListener('click',()=>navigateTo('online-amigos'));
  document.getElementById('hub-status-front')?.addEventListener('click',()=>navigateTo('fronting'));
  document.getElementById('btn-hub-quick-switch')?.addEventListener('click', openQuickSwitchModal);
  document.getElementById('hub-status-tablon')?.addEventListener('click',()=>{ comTab='tablon'; navigateTo('innerchat'); });
  document.getElementById('hub-status-solic')?.addEventListener('click',()=>{ comTab='solicitudes'; navigateTo('innerchat'); });
  document.getElementById('hub-status-reminders')?.addEventListener('click',()=>navigateTo('recordatorios'));
  // Wire botones de módulos
  document.querySelectorAll('.hub-btn[data-view]').forEach(btn=>btn.addEventListener('click',()=>{
    const id = btn.dataset.id;
    const view = btn.dataset.view;
    if(id==='solicitudes') { comTab='solicitudes'; }
    else if(id==='wishlist') { comTab='deseos'; }
    else if(id==='innerchat') { comTab='chat'; }
    else if(id==='hub-online-chat') { comTab='online'; }
    navigateTo(view);
  }));

  try { if (activeAlter) wireNotifBanners(activeAlter.id); } catch(e) { console.warn('Wire notif error:', e); }

  if (localStorage.getItem('tid_tutorial_version') !== '20260831-1') { setTimeout(showTutorial, 600); }

  } finally { renderHub._running = false; }
}

// ═══════════════════════════════════════════════
// FINANZAS MAIN
// ═══════════════════════════════════════════════
let financeDashboardFilter = { month: new Date().getMonth()+1, year: new Date().getFullYear(), category: 'all' };
const FINANCE_CURRENCIES = [{id:'EUR',label:'€ EUR — Euro'},{id:'USD',label:'$ USD — Dólar estadounidense'},{id:'GBP',label:'£ GBP — Libra esterlina'},{id:'MXN',label:'$ MXN — Peso mexicano'},{id:'ARS',label:'$ ARS — Peso argentino'},{id:'CAD',label:'$ CAD — Dólar canadiense'},{id:'AUD',label:'$ AUD — Dólar australiano'},{id:'CHF',label:'CHF — Franco suizo'},{id:'JPY',label:'¥ JPY — Yen japonés'}];
function getFinanceCurrency() { return loadConfig()?.financeCurrency || 'EUR'; }
function financeFmt(value) { return window.AtriaFinanceService.formatAmount(value, getFinanceCurrency(), 'es-ES'); }
function getAllFinanceTransactions() {
  return getAlters().flatMap(alter => {
    try { return (JSON.parse(localStorage.getItem(`tid_${alter.id}_transactions`)) || []).map(t => ({ ...t, alterId: t.alterId || alter.id })); }
    catch { return []; }
  });
}
function getAllFinanceCategories() {
  return getAlters().flatMap(alter => {
    try { return (JSON.parse(localStorage.getItem(`tid_${alter.id}_categories`)) || DEFAULT_CATS).map(c => ({ ...c, alterId: alter.id })); }
    catch { return DEFAULT_CATS.map(c => ({ ...c, alterId: alter.id })); }
  });
}

function renderFinanzasDashboard() {
  procesarTxRecurrentes();
  const month = financeDashboardFilter.month;
  const year = financeDashboardFilter.year;
  const financeStore = window.AtriaFinanceStore.create(load, save, activeAlter?.id);
  const financeService = window.AtriaFinanceService;
  const cats = financeStore.categories(DEFAULT_CATS);
  const txs = financeService.filterTransactions(financeStore.transactions(), { month, year, category: financeDashboardFilter.category });
  const allTxs = financeStore.transactions();
  const { income, expense, balance } = financeService.summarize(txs);
  const budgets = financeStore.budgets();
  const savings = financeService.savingsProgress(financeStore.savings());
  const monthLabel = new Date(year, month-1, 1).toLocaleString('es-ES',{month:'long',year:'numeric'});
  const months = Array.from({length:12},(_,i)=>({v:i+1,l:new Date(2000,i,1).toLocaleString('es-ES',{month:'short'})}));
  const years = [...new Set(allTxs.map(t=>new Date(t.date).getFullYear()).filter(Number.isFinite))];
  if (!years.includes(year)) years.push(year); years.sort((a,b)=>b-a);
  const budgetCards = financeService.budgetProgress(budgets, allTxs, month, year).slice(0,4).map(p => {
    const used = p.used;
    const pct = p.percent;
    const cat = cats.find(c=>c.id===p.categoryId);
    return `<div style="display:grid;gap:5px"><div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(cat?.name||p.categoryId)}</span><span>${financeFmt(used)} / ${financeFmt(p.limit)}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pct>=100?'var(--red)':pct>=80?'var(--accent-4)':'var(--accent-3)'}"></div></div><div style="font-size:10px;color:var(--text-3)">${pct}% usado</div></div>`;
  }).join('');
  const cards = [
    ['Ingresos', income, 'pos'], ['Gastos', expense, 'neg'], ['Balance', balance, balance>=0?'pos':'neg']
  ].map(([label,value,klass]) => `<div class="balance-card ${klass==='pos'?'positive':klass==='neg'?'negative':'neutral'}"><div class="bc-label">${label}</div><div class="bc-value ${klass}">${financeFmt(value)}</div></div>`).join('');
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Finanzas'}]);
  document.getElementById('app').innerHTML = `<div class="fin-view">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><div class="fin-title">◈ Finanzas</div><div class="fin-subtitle">Resumen de ${esc(activeAlter.name)} · ${monthLabel}</div></div><button class="btn btn-primary" id="btn-dashboard-add">+ Nueva transacción</button></div>
    <div class="ig-balance-row">${cards}</div>
    <div class="ig-toolbar"><div class="filter-group"><select id="fin-dash-month">${months.map(m=>`<option value="${m.v}" ${m.v===month?'selected':''}>${m.l}</option>`).join('')}</select><select id="fin-dash-year">${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></div><select id="fin-dash-category"><option value="all">Todas las categorías</option>${cats.map(c=>`<option value="${c.id}" ${c.id===financeDashboardFilter.category?'selected':''}>${esc(c.name)}</option>`).join('')}</select><select id="fin-currency" aria-label="Moneda">${FINANCE_CURRENCIES.map(c=>`<option value="${c.id}" ${c.id===getFinanceCurrency()?'selected':''}>${c.label}</option>`).join('')}</select><button class="btn btn-ghost ml-auto" data-view="finanzas/ig">Ver movimientos</button></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px"><div class="fin-sistema-banner"><div class="section-title">Flujo de caja</div><div style="font-size:12px;color:var(--text-2)">${txs.length} movimientos este mes</div><div style="margin-top:12px;height:10px;border-radius:8px;background:var(--bg-3);overflow:hidden"><div style="height:100%;width:${income?Math.min(100,expense/income*100):0}%;background:var(--accent-4)"></div></div><div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px"><span>Gasto frente a ingresos</span><strong>${income?Math.round(expense/income*100):0}%</strong></div></div><div class="fin-sistema-banner"><div class="section-title">Presupuestos</div>${budgetCards||'<div style="font-size:12px;color:var(--text-3)">Aún no hay presupuestos para este alter.</div>'}<button class="btn btn-ghost btn-sm" data-view="finanzas/presupuestos" style="margin-top:10px">Gestionar presupuestos</button></div><div class="fin-sistema-banner"><div class="section-title">Ahorros</div>${savings.length?`<div style="display:grid;gap:8px">${savings.slice(0,3).map(a=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px"><span>${esc(a.name)}</span><strong>${Math.min(100,Math.round((a.current/a.target)*100))}%</strong></div>`).join('')}</div>`:'<div style="font-size:12px;color:var(--text-3)">Aún no hay metas de ahorro.</div>'}<button class="btn btn-ghost btn-sm" data-view="finanzas/ahorros" style="margin-top:10px">Ver ahorros</button></div></div>
    <div><div class="section-title">Últimos movimientos</div><div class="ig-list">${txs.slice(0,5).map(t=>`<div class="tx-row"><div class="tx-desc">${esc(t.description)}</div><div>${esc(cats.find(c=>c.id===t.category)?.name||'—')}</div><div class="tx-date">${fmtDate(t.date)}</div><div class="tx-amount ${t.type==='ingreso'?'ing':'gst'}">${t.type==='ingreso'?'+':'−'}${financeFmt(t.amount)}</div><div></div></div>`).join('')||'<div class="empty-state"><div>No hay movimientos en este período.</div></div>'}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost" data-view="finanzas/registro">Registro mensual</button><button class="btn btn-ghost" data-view="finanzas/categorias">Gestionar categorías</button></div>
  </div>`;
  const alterFilter = document.createElement('select'); alterFilter.id='fin-dash-alter'; alterFilter.setAttribute('aria-label','Alter'); alterFilter.innerHTML=getAlters().map(a=>`<option value="${a.id}" ${a.id===activeAlter?.id?'selected':''}>${esc(a.name)}</option>`).join(''); document.querySelector('.ig-toolbar')?.prepend(alterFilter); alterFilter.addEventListener('change',e=>{const alter=getAlters().find(a=>a.id===e.target.value); if(alter){selectAlter(alter); renderFinanzasDashboard();}});
  document.getElementById('fin-dash-month').addEventListener('change',e=>{financeDashboardFilter.month=+e.target.value;renderFinanzasDashboard();});
  document.getElementById('fin-dash-year').addEventListener('change',e=>{financeDashboardFilter.year=+e.target.value;renderFinanzasDashboard();});
  document.getElementById('fin-dash-category').addEventListener('change',e=>{financeDashboardFilter.category=e.target.value;renderFinanzasDashboard();});
  document.getElementById('fin-currency').addEventListener('change',e=>{saveConfig({...loadConfig(),financeCurrency:e.target.value});renderFinanzasDashboard();});
  document.getElementById('btn-dashboard-add').addEventListener('click',()=>openTxModal(null));
  document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>{ if(el.dataset.view==='finanzas/ig') igFilter.category=financeDashboardFilter.category; navigateTo(el.dataset.view); }));
}

function renderFinanzas() {
  const fmt = financeFmt;
  setCrumbs([
    {label:'Hub', action:()=>navigateTo('hub')},
    {label:'Finanzas'},
  ]);
  const subs = [
    {view:'finanzas/ig',          icon:'↕', name:'Ingresos / Gastos',  desc:'Registro de transacciones',   color:'#a08aff', bg:'rgba(160,138,255,0.1)'},
    {view:'finanzas/ahorros',     icon:'◆', name:'Ahorros',             desc:'Metas y progreso',             color:'#8affe0', bg:'rgba(138,255,224,0.1)'},
    {view:'finanzas/presupuestos',icon:'▤', name:'Presupuestos',        desc:'Límites por categoría',        color:'#ffb450', bg:'rgba(255,180,80,0.1)'},
    {view:'finanzas/registro',    icon:'≡', name:'Registro mensual',    desc:'Resumen agregado',             color:'#ff8ae2', bg:'rgba(255,138,226,0.1)'},
  ];

  const isAdmin = activeAlter?.isAdmin;
  const allTxs = getAllFinanceTransactions();
  const now = new Date();
  const thisMo = allTxs.filter(t=>{ const d=new Date(t.date); return d.getMonth()+1===now.getMonth()+1&&d.getFullYear()===now.getFullYear(); });
  const sysIngresos = thisMo.filter(t=>t.type==='ingreso').reduce((s,t)=>s+t.amount,0);
  const sysGastos   = thisMo.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0);
  const sysBalance  = sysIngresos - sysGastos;

  document.getElementById('app').innerHTML = `
    <div class="fin-view">
      <div>
        <div class="fin-title">◈ Finanzas</div>
        <div class="fin-subtitle">Gestión económica de ${activeAlter.name}</div>
      </div>
      ${isAdmin ? `
      <div class="fin-sistema-banner">
        <div class="fin-sistema-title">◎ Resumen del sistema · ${now.toLocaleString('es-ES',{month:'long',year:'numeric'})}</div>
        <div class="ig-balance-row" style="margin-top:10px">
          <div class="balance-card positive"><div class="bc-label">Ingresos totales</div><div class="bc-value pos">${fmt(sysIngresos)}</div></div>
          <div class="balance-card negative"><div class="bc-label">Gastos totales</div><div class="bc-value neg">${fmt(sysGastos)}</div></div>
          <div class="balance-card neutral"><div class="bc-label">Balance sistema</div><div class="bc-value ${sysBalance>=0?'pos':'neg'}">${fmt(sysBalance)}</div></div>
        </div>
        <button class="btn btn-ghost" id="btn-fin-sistema" style="margin-top:10px">Ver detalle del sistema →</button>
      </div>` : ''}
      <div>
        <div class="section-title">Submódulos</div>
        <div class="fin-submods">
          ${subs.map(s=>`
            <div class="fin-sub-card" data-view="${s.view}">
              <div class="fin-sub-icon" style="background:${s.bg};color:${s.color}">${s.icon}</div>
              <div>
                <div class="fin-sub-name">${s.name}</div>
                <div class="fin-sub-desc">${s.desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div style="margin-top:4px">
        <div class="section-title">Ajustes</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost" data-view="finanzas/categorias">⚙ Gestionar categorías</button>
        </div>
      </div>
    </div>`;
  document.querySelectorAll('[data-view]').forEach(el =>
    el.addEventListener('click', () => navigateTo(el.dataset.view))
  );
  document.getElementById('btn-fin-sistema')?.addEventListener('click', () => navigateTo('finanzas/sistema'));
}

// ═══════════════════════════════════════════════
// INGRESOS / GASTOS
// ═══════════════════════════════════════════════
let igFilter = { month: new Date().getMonth()+1, year: new Date().getFullYear(), type: 'all', category: 'all', account: 'all', source: 'all' };

function renderIG() {
  const fmt = financeFmt;
  procesarTxRecurrentes();
  setCrumbs([
    {label:'Hub',action:()=>navigateTo('hub')},
    {label:'Finanzas',action:()=>navigateTo('finanzas')},
    {label:'Ingresos / Gastos'},
  ]);
  const financeStore = window.AtriaFinanceStore.create(load, save, activeAlter?.id);
  const financeService = window.AtriaFinanceService;
  const cats = financeStore.categories(DEFAULT_CATS);
  const txs  = financeStore.transactions();
  const accounts = [...new Set(txs.map(t=>t.account).filter(Boolean))].sort();
  const sources = [...new Set(txs.map(t=>t.source).filter(Boolean))].sort();
  const filtered = financeService.filterTransactions(txs, {month:igFilter.month, year:igFilter.year, type:igFilter.type, category:igFilter.category, account:igFilter.account, source:igFilter.source});

  const ingresos = filtered.filter(t=>t.type==='ingreso').reduce((s,t)=>s+t.amount,0);
  const gastos   = filtered.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0);
  const balance  = ingresos - gastos;

  const years = [...new Set(txs.map(t=>new Date(t.date).getFullYear()))];
  if (!years.includes(igFilter.year)) years.push(igFilter.year);
  years.sort((a,b)=>b-a);

  const months = Array.from({length:12},(_,i)=>({v:i+1,l:new Date(2000,i,1).toLocaleString('es-ES',{month:'long'})}));

  document.getElementById('app').innerHTML = `
    <div class="ig-view">
      <div class="ig-balance-row">
        <div class="balance-card positive">
          <div class="bc-label">Ingresos</div>
          <div class="bc-value pos">${fmt(ingresos)}</div>
        </div>
        <div class="balance-card negative">
          <div class="bc-label">Gastos</div>
          <div class="bc-value neg">${fmt(gastos)}</div>
        </div>
        <div class="balance-card neutral">
          <div class="bc-label">Balance</div>
          <div class="bc-value ${balance>=0?'pos':'neg'}">${fmt(balance)}</div>
        </div>
      </div>

      <div class="ig-toolbar">
        <div class="filter-group">
          <select id="fil-month">${months.map(m=>`<option value="${m.v}" ${m.v===igFilter.month?'selected':''}>${m.l}</option>`).join('')}</select>
          <select id="fil-year">${years.map(y=>`<option value="${y}" ${y===igFilter.year?'selected':''}>${y}</option>`).join('')}</select>
        </div>
        <div class="filter-group">
          <select id="fil-type">
            <option value="all" ${igFilter.type==='all'?'selected':''}>Todo</option>
            <option value="ingreso" ${igFilter.type==='ingreso'?'selected':''}>Ingresos</option>
            <option value="gasto" ${igFilter.type==='gasto'?'selected':''}>Gastos</option>
          </select>
          <select id="fil-category"><option value="all">Todas las categorías</option>${cats.map(c=>`<option value="${c.id}" ${igFilter.category===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
          <select id="fil-account"><option value="all">Todas las cuentas</option>${accounts.map(v=>`<option value="${esc(v)}" ${igFilter.account===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
          <select id="fil-source"><option value="all">Todos los orígenes</option>${sources.map(v=>`<option value="${esc(v)}" ${igFilter.source===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary ml-auto" id="btn-add-tx">+ Nueva transacción</button>
      </div>

      ${(()=>{
        // Pie chart de gastos por categoría
        const gastCats = {};
        filtered.filter(t=>t.type==='gasto').forEach(t=>{
          const cid = t.category||'_sin';
          gastCats[cid]=(gastCats[cid]||0)+t.amount;
        });
        const totalGast = Object.values(gastCats).reduce((a,b)=>a+b,0);
        if(!totalGast) return '';
        const entries = Object.entries(gastCats).sort((a,b)=>b[1]-a[1]);
        // SVG donut
        const R=54, r=32, cx=64, cy=64;
        let cumPct=0;
        const slices = entries.map(([cid,amt])=>{
          const cat=cats.find(c=>c.id===cid);
          const color=cat?.color||'#888';
          const pct=amt/totalGast;
          const startAngle=(cumPct*2*Math.PI)-Math.PI/2;
          cumPct+=pct;
          const endAngle=(cumPct*2*Math.PI)-Math.PI/2;
          const lx1=cx+R*Math.cos(startAngle), ly1=cy+R*Math.sin(startAngle);
          const lx2=cx+R*Math.cos(endAngle), ly2=cy+R*Math.sin(endAngle);
          const sx1=cx+r*Math.cos(startAngle), sy1=cy+r*Math.sin(startAngle);
          const sx2=cx+r*Math.cos(endAngle), sy2=cy+r*Math.sin(endAngle);
          const large=pct>0.5?1:0;
          const d=`M${lx1.toFixed(1)},${ly1.toFixed(1)} A${R},${R},0,${large},1,${lx2.toFixed(1)},${ly2.toFixed(1)} L${sx2.toFixed(1)},${sy2.toFixed(1)} A${r},${r},0,${large},0,${sx1.toFixed(1)},${sy1.toFixed(1)} Z`;
          return {d,color,cat,amt,pct};
        });
        return `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);width:100%;margin-bottom:4px">Gastos por categoría</div>
          <svg width="128" height="128" viewBox="0 0 128 128" style="flex-shrink:0">
            ${slices.map(s=>`<path d="${s.d}" fill="${s.color}" opacity="0.9"><title>${s.cat?.name||'—'}: ${fmt(s.amt)} (${Math.round(s.pct*100)}%)</title></path>`).join('')}
            <circle cx="64" cy="64" r="22" fill="var(--bg-1)"/>
            <text x="64" y="68" text-anchor="middle" font-family="DM Mono,monospace" font-size="10" fill="var(--text-2)">${fmt(totalGast)}</text>
          </svg>
          <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:120px">
            ${slices.map(s=>`<div style="display:flex;align-items:center;gap:7px">
              <div style="width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0"></div>
              <div style="flex:1;font-size:12px;color:var(--text-1)">${s.cat?.name||'—'}</div>
              <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">${Math.round(s.pct*100)}%</div>
              <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${fmt(s.amt)}</div>
            </div>`).join('')}
          </div>
        </div>`;
      })()}

      <div class="ig-list">
        <div class="ig-list-header">
          <span>Descripción</span>
          <span>Categoría</span>
          <span>Fecha</span>
          <span>Importe</span>
          <span></span>
        </div>
        ${filtered.length===0 ? `
          <div class="empty-state">
            <div class="empty-icon">◈</div>
            <div>No hay transacciones este período</div>
          </div>` :
          filtered.map(t => {
            const cat = cats.find(c=>c.id===t.category);
            const isRecur = t.recur && t.recur !== 'none';
            return `<div class="tx-row" data-id="${t.id}">
              <div><div class="tx-desc" title="${t.description}">${t.description}${isRecur?` <span class="event-recur-badge">↺</span>`:''}</div>${t.account||t.source?`<div class="tx-meta">${esc([t.account,t.source].filter(Boolean).join(' · '))}</div>`:''}</div>
              <div><span class="tx-cat" style="background:${cat?cat.color+'22':'rgba(255,255,255,.06)'};color:${cat?cat.color:'var(--text-2)'}">${cat?cat.name:'—'}</span></div>
              <div class="tx-date">${fmtDate(t.date)}</div>
              <div class="tx-amount ${t.type==='ingreso'?'ing':'gst'}">${t.type==='ingreso'?'+':'−'}${fmt(t.amount)}</div>
              <div class="tx-actions">
                <button class="icon-btn btn-edit-tx" data-id="${t.id}" title="Editar">✎</button>
                <button class="icon-btn btn-duplicate-tx" data-id="${t.id}" title="Duplicar">⧉</button>
                <button class="icon-btn btn-del-tx" data-id="${t.id}" title="Eliminar">✕</button>
              </div>
            </div>`;
          }).join('')
        }
      </div>
    </div>`;

  document.getElementById('fil-month').addEventListener('change', e => { igFilter.month=+e.target.value; renderIG(); });
  document.getElementById('fil-year').addEventListener('change', e => { igFilter.year=+e.target.value; renderIG(); });
  document.getElementById('fil-type').addEventListener('change', e => { igFilter.type=e.target.value; renderIG(); });
  document.getElementById('fil-category').addEventListener('change', e => { igFilter.category=e.target.value; renderIG(); });
  document.getElementById('fil-account').addEventListener('change', e => { igFilter.account=e.target.value; renderIG(); });
  document.getElementById('fil-source').addEventListener('change', e => { igFilter.source=e.target.value; renderIG(); });
  document.getElementById('btn-add-tx').addEventListener('click', () => openTxModal(null));
  document.querySelectorAll('.btn-edit-tx').forEach(b => b.addEventListener('click', () => {
    const tx = load('transactions').find(t=>t.id===b.dataset.id);
    if (tx) openTxModal(tx);
  }));
  document.querySelectorAll('.btn-duplicate-tx').forEach(b => b.addEventListener('click', () => {
    const source = financeStore.transactions().find(t=>t.id===b.dataset.id);
    if (!source) return;
    financeStore.saveTransactions(financeService.duplicateTransaction(financeStore.transactions(), source, uid));
    showToast('Transacción duplicada');
    renderIG();
  }));
  document.querySelectorAll('.btn-del-tx').forEach(b => b.addEventListener('click', () => {
    const txs = load('transactions').filter(t=>t.id!==b.dataset.id);
    save('transactions', txs);
    showToast('Transacción eliminada');
    renderIG();
  }));
}

function openTxModal(tx) {
  const fmt = financeFmt;
  const cats = load('categories', DEFAULT_CATS);
  const isEdit = !!tx;
  const today = new Date().toISOString().slice(0,10);
  const TX_RECUR_OPTS = window.AtriaFinanceRecurring.getTransactionRecurrenceOptions('es');
  openModal(`
    <div class="modal-title">${isEdit?'Editar':'Nueva'} transacción</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Tipo</div>
        <div class="radio-group">
          <div class="radio-opt ${!isEdit||tx.type==='ingreso'?'selected-ing':''}" data-type="ingreso">↑ Ingreso</div>
          <div class="radio-opt ${isEdit&&tx.type==='gasto'?'selected-gst':''}" data-type="gasto">↓ Gasto</div>
        </div>
        <input type="hidden" id="tx-type" value="${tx?.type||'ingreso'}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción</div>
        <input type="text" id="tx-desc" placeholder="Ej: Nómina, Supermercado…" value="${tx?.description||''}">
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Importe (€)</div>
          <input type="number" id="tx-amount" placeholder="0.00" step="0.01" min="0" value="${tx?.amount||''}">
        </div>
        <div class="form-row">
          <div class="form-label">Fecha</div>
          <input type="date" id="tx-date" value="${tx?.date||today}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Categoría</div>
        <select id="tx-cat">
          ${cats.map(c=>`<option value="${c.id}" ${tx?.category===c.id?'selected':''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row two-col">
        <div class="form-row"><div class="form-label">Cuenta (opcional)</div><input type="text" id="tx-account" placeholder="Banco, efectivo…" value="${tx?.account||''}"></div>
        <div class="form-row"><div class="form-label">Origen (opcional)</div><input type="text" id="tx-source" placeholder="Nómina, supermercado…" value="${tx?.source||''}"></div>
      </div>
      <div class="form-row">
        <div class="form-label">↺ Repetición</div>
        <div class="recur-opts">
          ${TX_RECUR_OPTS.map(r=>`<div class="recur-opt ${(tx?.recur||'none')===r.id?'selected':''}" data-txrecur="${r.id}">${r.label}</div>`).join('')}
        </div>
        <input type="hidden" id="tx-recur" value="${tx?.recur||'none'}">
      </div>
      ${isEdit && tx?._recurOrigin ? `<div class="form-row"><div class="form-label">Aplicar cambios a</div><select id="tx-scope"><option value="one">Solo este movimiento</option><option value="future">Este y los siguientes</option><option value="series">Toda la serie</option></select></div>` : ''}
      <div class="form-row">
        <div class="form-label">Nota (opcional)</div>
        <textarea id="tx-note" placeholder="Notas adicionales…">${tx?.note||''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar cambios':'Añadir'}</button>
    </div>`,
    (overlay) => {
      const type   = overlay.querySelector('#tx-type').value;
      const desc   = overlay.querySelector('#tx-desc').value.trim();
      const amount = parseFloat(overlay.querySelector('#tx-amount').value);
      const date   = overlay.querySelector('#tx-date').value;
      const cat    = overlay.querySelector('#tx-cat').value;
      const account = overlay.querySelector('#tx-account').value.trim();
      const source = overlay.querySelector('#tx-source').value.trim();
      const recur  = overlay.querySelector('#tx-recur').value;
      const note   = overlay.querySelector('#tx-note').value.trim();
      const scope  = overlay.querySelector('#tx-scope')?.value || 'one';
      if (!desc || isNaN(amount) || amount<=0 || !date) return showToast('⚠ Completa los campos obligatorios');
      const financeStore = window.AtriaFinanceStore.create(load, save, activeAlter?.id);
      let txs = financeStore.transactions();
      if (isEdit) {
        txs = window.AtriaFinanceService.updateTransaction(txs, tx.id, {...{type,description:desc,amount,date,category:cat,account,source,recur,note}, _recurOrigin:recur!=='none' ? (tx._recurOrigin||uid()) : null}, scope);
      } else {
        txs.push({id:uid(),type,description:desc,amount,date,category:cat,account,source,recur,note,alterId:activeAlter?.id||null,_recurOrigin:recur!=='none'?uid():null});
      }
      financeStore.saveTransactions(txs);
      closeModal();
      showToast(isEdit?'Transacción actualizada':'Transacción añadida ✓');
      // Alerta de presupuesto excedido
      if (type === 'gasto') {
        const pres = load('presupuestos', []).find(p => p.categoryId === cat);
        if (pres) {
          const txDate = new Date(date);
          const gastado = load('transactions').filter(t =>
            t.type === 'gasto' && t.category === cat &&
            (() => { const d = new Date(t.date); return d.getMonth() === txDate.getMonth() && d.getFullYear() === txDate.getFullYear(); })()
          ).reduce((s, t) => s + t.amount, 0);
          if (gastado > pres.limit) {
            const cats = load('categories', DEFAULT_CATS);
            const catName = cats.find(c => c.id === cat)?.name || cat;
            showToast(`⚠ Presupuesto de "${catName}" excedido: ${fmt(gastado)} / ${fmt(pres.limit)}`);
          }
        }
      }
      renderIG();
    }
  );
  // Radio type select
  const overlay = document.querySelector('.modal-overlay');
  overlay.querySelectorAll('.radio-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      overlay.querySelectorAll('.radio-opt').forEach(o => o.className='radio-opt');
      opt.classList.add(opt.dataset.type==='ingreso'?'selected-ing':'selected-gst');
      overlay.querySelector('#tx-type').value = opt.dataset.type;
    });
  });
  // Recur opts
  overlay.querySelectorAll('[data-txrecur]').forEach(opt => {
    opt.addEventListener('click', () => {
      overlay.querySelectorAll('[data-txrecur]').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      overlay.querySelector('#tx-recur').value = opt.dataset.txrecur;
    });
  });
}

// Genera las transacciones recurrentes que faltan hasta hoy
function procesarTxRecurrentes() {
  return window.AtriaFinanceRecurring.processRecurringTransactions({ load, save, uid });
}

function renderAhorros() {
  const fmt = financeFmt;
  setCrumbs([
    {label:'Hub',action:()=>navigateTo('hub')},
    {label:'Finanzas',action:()=>navigateTo('finanzas')},
    {label:'Ahorros'},
  ]);
  const ahorros = load('ahorros', []);
  document.getElementById('app').innerHTML = `
    <div class="ahorros-view">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="fin-title">◆ Ahorros</div>
          <div class="fin-subtitle">Metas de ahorro de ${activeAlter.name}</div>
        </div>
        <button class="btn btn-primary" id="btn-add-ahorro">+ Nueva meta</button>
      </div>
      <div class="ahorros-grid" id="ahorros-grid">
        ${ahorros.length===0 ? `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="empty-icon">◆</div>
            <div>Sin metas de ahorro todavía</div>
          </div>` :
          ahorros.map(a => {
            const pct = Math.min(100, Math.round((a.current/a.target)*100));
            return `<div class="ahorro-card" data-id="${a.id}">
              <div class="ahorro-header">
                <div>
                  <div class="ahorro-name">${esc(a.name)}</div>
                  <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-top:2px">${a.deadline?'Fecha: '+fmtDate(a.deadline):'Sin plazo'}</div>
                </div>
                <div class="ahorro-emoji">${a.emoji||'💰'}</div>
              </div>
              <div class="ahorro-amounts">
                <div class="ahorro-current" style="color:var(--accent-3)">${fmt(a.current)}</div>
                <div class="ahorro-target">Meta: ${fmt(a.target)}</div>
              </div>
              <div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                <div class="ahorro-pct" style="margin-top:5px">${pct}% completado</div>
              </div>
              <div class="ahorro-actions">
                <button class="btn btn-ghost btn-sm btn-aport" data-id="${a.id}">+ Aportación</button>
                <button class="btn btn-ghost btn-sm btn-retiro" data-id="${a.id}">− Retirada</button>
                <button class="btn btn-ghost btn-sm btn-edit-ahorro" data-id="${a.id}">✎</button>
                <button class="icon-btn btn-del-ahorro" data-id="${a.id}">✕</button>
              </div>
            </div>`;
          }).join('')
        }
      </div>
    </div>`;

  document.getElementById('btn-add-ahorro').addEventListener('click', () => openAhorroModal(null));
  document.querySelectorAll('.btn-edit-ahorro').forEach(b => b.addEventListener('click', () => {
    const a = load('ahorros',[]).find(x=>x.id===b.dataset.id);
    if (a) openAhorroModal(a);
  }));
  document.querySelectorAll('.btn-del-ahorro').forEach(b => b.addEventListener('click', () => {
    save('ahorros', load('ahorros',[]).filter(x=>x.id!==b.dataset.id));
    showToast('Meta eliminada');
    renderAhorros();
  }));
  document.querySelectorAll('.btn-aport').forEach(b => b.addEventListener('click', () => openAportModal(b.dataset.id)));
  document.querySelectorAll('.btn-retiro').forEach(b => b.addEventListener('click', () => openAportModal(b.dataset.id, 'withdraw')));
}

function openAhorroModal(a) {
  const isEdit = !!a;
  const emojis = ['💰','🏠','✈️','🎓','💊','🎁','🚗','💻','🐾','🌱'];
  openModal(`
    <div class="modal-title">${isEdit?'Editar':'Nueva'} meta de ahorro</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Emoji</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${emojis.map(e=>`<span style="font-size:22px;cursor:pointer;padding:4px;border-radius:6px;border:1px solid ${a?.emoji===e?'var(--border-active)':'transparent'};transition:var(--transition)" class="emoji-opt" data-e="${e}">${e}</span>`).join('')}
        </div>
        <input type="hidden" id="a-emoji" value="${a?.emoji||'💰'}">
      </div>
      <div class="form-row">
        <div class="form-label">Nombre de la meta</div>
        <input type="text" id="a-name" placeholder="Ej: Fondo de emergencia" value="${a?.name||''}">
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Importe actual (€)</div>
          <input type="number" id="a-current" placeholder="0.00" step="0.01" min="0" value="${a?.current||''}">
        </div>
        <div class="form-row">
          <div class="form-label">Meta (€)</div>
          <input type="number" id="a-target" placeholder="0.00" step="0.01" min="0" value="${a?.target||''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Fecha límite (opcional)</div>
        <input type="date" id="a-deadline" value="${a?.deadline||''}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Crear meta'}</button>
    </div>`,
    (overlay) => {
      const name    = overlay.querySelector('#a-name').value.trim();
      const current = parseFloat(overlay.querySelector('#a-current').value)||0;
      const target  = parseFloat(overlay.querySelector('#a-target').value);
      const emoji   = overlay.querySelector('#a-emoji').value;
      const deadline= overlay.querySelector('#a-deadline').value;
      if (!name || isNaN(target)||target<=0) return showToast('⚠ Completa los campos obligatorios');
      let list = load('ahorros',[]);
      if (isEdit) list = list.map(x=>x.id===a.id?{...x,name,current,target,emoji,deadline}:x);
      else list.push({id:uid(),name,current,target,emoji,deadline});
      save('ahorros',list);
      closeModal();
      showToast(isEdit?'Meta actualizada':'Meta creada ✓');
      renderAhorros();
    }
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelectorAll('.emoji-opt').forEach(el => el.addEventListener('click', () => {
    ov.querySelectorAll('.emoji-opt').forEach(o=>o.style.borderColor='transparent');
    el.style.borderColor='var(--border-active)';
    ov.querySelector('#a-emoji').value = el.dataset.e;
  }));
}

function openAportModal(id, mode = 'add') {
  const fmt = financeFmt;
  openModal(`
    <div class="modal-title">${mode==='withdraw'?'Registrar retirada':'Registrar aportación'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Importe (${getFinanceCurrency()})</div>
        <input type="number" id="aport-amount" placeholder="0.00" step="0.01" min="0">
      </div>
      <div class="form-row"><div class="form-label">Nota (opcional)</div><input type="text" id="aport-note" placeholder="Ej: transferencia, emergencia…"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${mode==='withdraw'?'Retirar':'Añadir'}</button>
    </div>`,
    (overlay) => {
      const amount = parseFloat(overlay.querySelector('#aport-amount').value);
      if (isNaN(amount)||amount<=0) return showToast('⚠ Importe inválido');
      const source = load('ahorros',[]).find(x=>x.id===id);
      if (!source || (mode==='withdraw' && amount > Number(source.current||0))) return showToast('⚠ La retirada supera el saldo actual');
      const delta = mode==='withdraw' ? -amount : amount;
      const note = overlay.querySelector('#aport-note').value.trim();
      const entry = {id:uid(),type:mode==='withdraw'?'withdraw':'deposit',amount,date:new Date().toISOString().slice(0,10),note};
      const list = load('ahorros',[]).map(x=>x.id===id?{...x,current:Number(x.current||0)+delta,history:[...(x.history||[]),entry]}:x);
      save('ahorros',list);
      closeModal();
      showToast(`${mode==='withdraw'?'−':'+'}${fmt(amount)} ${mode==='withdraw'?'retirados':'añadidos'} ✓`);
      renderAhorros();
    }
  );
}

// ═══════════════════════════════════════════════
// PRESUPUESTOS
// ═══════════════════════════════════════════════
function renderPresupuestos() {
  const fmt = financeFmt;
  setCrumbs([
    {label:'Hub',action:()=>navigateTo('hub')},
    {label:'Finanzas',action:()=>navigateTo('finanzas')},
    {label:'Presupuestos'},
  ]);
  const cats = load('categories', DEFAULT_CATS);
  const pres = load('presupuestos', []);
  const now  = new Date();
  const txs = load('transactions');
  const progress = window.AtriaFinanceService.budgetProgress(pres, txs, now.getMonth()+1, now.getFullYear());

  document.getElementById('app').innerHTML = `
    <div class="pres-view">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="fin-title">▤ Presupuestos</div>
          <div class="fin-subtitle">Límites de gasto de ${monthName(now.getMonth()+1, now.getFullYear())}</div>
        </div>
        <button class="btn btn-primary" id="btn-add-pres">+ Nuevo presupuesto</button>
      </div>
      <div class="pres-list">
        ${pres.length===0 ? `<div class="empty-state"><div class="empty-icon">▤</div><div>Sin presupuestos configurados</div></div>` :
          pres.map(p => {
            const cat = cats.find(c=>c.id===p.categoryId);
            const current = progress.find(x=>x.id===p.id) || p;
            const used = current.used || 0;
            const pct = current.percent || 0;
            const over = used > p.limit;
            const color = over ? 'var(--red)' : pct>80 ? 'var(--accent-4)' : 'var(--accent-3)';
            return `<div class="pres-card" data-id="${p.id}">
              <div class="pres-header">
                <div class="pres-cat">
                  <div class="pres-cat-dot" style="background:${cat?.color||'#888'}"></div>
                  <div class="pres-cat-name">${cat?.name||p.categoryId}</div>
                </div>
                <div class="pres-amounts">
                  <div class="pres-used" style="color:${color}">${fmt(used)}</div>
                  <div class="pres-limit">de ${fmt(p.limit)}</div>
                </div>
              </div>
              <div class="pres-prog"><div class="pres-prog-fill" style="width:${pct}%;background:${color}"></div></div>
              <div class="pres-meta">
                <div class="pres-pct" style="color:${color}">${pct}% ${p.period==='yearly'?'· Anual':'· Mensual'} ${over?'⚠ EXCEDIDO':''}</div>
                <div class="pres-actions">
                  <button class="btn btn-ghost btn-sm btn-edit-pres" data-id="${p.id}">✎ Editar</button>
                  <button class="icon-btn btn-del-pres" data-id="${p.id}">✕</button>
                </div>
              </div>
            </div>`;
          }).join('')
        }
      </div>
    </div>`;

  document.getElementById('btn-add-pres').addEventListener('click', () => openPresModal(null));
  document.querySelectorAll('.btn-edit-pres').forEach(b => b.addEventListener('click', () => {
    const p = load('presupuestos',[]).find(x=>x.id===b.dataset.id);
    if (p) openPresModal(p);
  }));
  document.querySelectorAll('.btn-del-pres').forEach(b => b.addEventListener('click', () => {
    save('presupuestos', load('presupuestos',[]).filter(x=>x.id!==b.dataset.id));
    showToast('Presupuesto eliminado');
    renderPresupuestos();
  }));
}

function openPresModal(p) {
  const fmt = financeFmt;
  const cats = load('categories', DEFAULT_CATS);
  const isEdit = !!p;
  openModal(`
    <div class="modal-title">${isEdit?'Editar':'Nuevo'} presupuesto</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Categoría</div>
        <select id="p-cat">${cats.map(c=>`<option value="${c.id}" ${p?.categoryId===c.id?'selected':''}>${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-label">Límite mensual (€)</div>
        <input type="number" id="p-limit" placeholder="0.00" step="0.01" min="0" value="${p?.limit||''}">
      </div>
      <div class="form-row"><div class="form-label">Periodo</div><select id="p-period"><option value="monthly" ${p?.period!=='yearly'?'selected':''}>Mensual</option><option value="yearly" ${p?.period==='yearly'?'selected':''}>Anual</option></select></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Crear'}</button>
    </div>`,
    (overlay) => {
      const catId = overlay.querySelector('#p-cat').value;
      const limit = parseFloat(overlay.querySelector('#p-limit').value);
      const period = overlay.querySelector('#p-period').value;
      if (isNaN(limit)||limit<=0) return showToast('⚠ Importe inválido');
      let list = load('presupuestos',[]);
      if (isEdit) list = list.map(x=>x.id===p.id?{...x,categoryId:catId,limit,period}:x);
      else {
        if (list.find(x=>x.categoryId===catId)) return showToast('⚠ Ya existe un presupuesto para esa categoría');
        list.push({id:uid(),categoryId:catId,limit,period});
      }
      save('presupuestos',list);
      closeModal();
      showToast(isEdit?'Presupuesto actualizado':'Presupuesto creado ✓');
      renderPresupuestos();
    }
  );
}

// ═══════════════════════════════════════════════
// REGISTRO MENSUAL
// ═══════════════════════════════════════════════
function renderRegistro() {
  const fmt = financeFmt;
  setCrumbs([
    {label:'Hub',action:()=>navigateTo('hub')},
    {label:'Finanzas',action:()=>navigateTo('finanzas')},
    {label:'Registro mensual'},
  ]);
  const txs = load('transactions');
  if (txs.length===0) {
    document.getElementById('app').innerHTML = `
      <div class="reg-view">
        <div class="fin-title">≡ Registro mensual</div>
        <div class="fin-subtitle">Resumen agregado por mes</div>
        <div class="empty-state"><div class="empty-icon">≡</div><div>Sin transacciones registradas</div></div>
      </div>`;
    return;
  }
  // Agrupar por mes
  const byMonth = {};
  txs.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!byMonth[key]) byMonth[key] = {ingresos:0,gastos:0};
    if (t.type==='ingreso') byMonth[key].ingresos+=t.amount;
    else byMonth[key].gastos+=t.amount;
  });
  const sorted = Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0]));

  document.getElementById('app').innerHTML = `
    <div class="reg-view">
      <div>
        <div class="fin-title">≡ Registro mensual</div>
        <div class="fin-subtitle">Historial agregado de ${activeAlter.name}</div>
      </div>
      <div class="reg-cards">
        ${sorted.map(([key,data]) => {
          const [y,m] = key.split('-');
          const balance = data.ingresos - data.gastos;
          return `<div class="reg-month-card">
            <div class="reg-month-label">${monthName(+m,+y)}</div>
            <div class="reg-divider"></div>
            <div class="reg-month-stats">
              <div class="reg-stat-row">
                <span class="reg-stat-label">Ingresos</span>
                <span class="reg-stat-val pos">${fmt(data.ingresos)}</span>
              </div>
              <div class="reg-stat-row">
                <span class="reg-stat-label">Gastos</span>
                <span class="reg-stat-val neg">${fmt(data.gastos)}</span>
              </div>
              <div class="reg-divider" style="margin:4px 0"></div>
              <div class="reg-stat-row">
                <span class="reg-stat-label">Balance</span>
                <span class="reg-stat-val ${balance>=0?'pos':'neg'}">${fmt(balance)}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════
// CATEGORÍAS
// ═══════════════════════════════════════════════
function renderCategorias() {
  setCrumbs([
    {label:'Hub',action:()=>navigateTo('hub')},
    {label:'Finanzas',action:()=>navigateTo('finanzas')},
    {label:'Categorías'},
  ]);
  const cats = load('categories', DEFAULT_CATS);
  document.getElementById('app').innerHTML = `
    <div class="cats-view">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="fin-title">⚙ Categorías</div>
          <div class="fin-subtitle">Gestión de categorías de gasto</div>
        </div>
        <button class="btn btn-primary" id="btn-add-cat">+ Nueva categoría</button>
      </div>
      <div class="cats-grid">
        ${cats.map(c=>`
          <div class="cat-pill" data-id="${c.id}">
            <div style="display:flex;align-items:center">
              <div class="cat-dot" style="background:${c.color}"></div>
              <span>${c.name}</span>
            </div>
            <div style="display:flex;gap:4px">
              <button class="icon-btn btn-edit-cat" data-id="${c.id}" style="font-size:12px">✎</button>
              <button class="icon-btn btn-del-cat" data-id="${c.id}" style="font-size:12px">✕</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  document.getElementById('btn-add-cat').addEventListener('click', () => openCatModal(null));
  document.querySelectorAll('.btn-edit-cat').forEach(b => b.addEventListener('click', () => {
    const c = load('categories',DEFAULT_CATS).find(x=>x.id===b.dataset.id);
    if (c) openCatModal(c);
  }));
  document.querySelectorAll('.btn-del-cat').forEach(b => b.addEventListener('click', () => {
    const updated = load('categories',DEFAULT_CATS).filter(x=>x.id!==b.dataset.id);
    save('categories', updated);
    showToast('Categoría eliminada');
    renderCategorias();
  }));
}

const CAT_COLORS = ['#ffb450','#a08aff','#8affe0','#ff8ae2','#8ab4ff','#ff6b8a','#5fffb0','#ff9f7f','#7fffda','#d4a0ff'];

function openCatModal(c) {
  const isEdit = !!c;
  openModal(`
    <div class="modal-title">${isEdit?'Editar':'Nueva'} categoría</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Nombre</div>
        <input type="text" id="c-name" placeholder="Ej: Suscripciones" value="${c?.name||''}">
      </div>
      <div class="form-row">
        <div class="form-label">Color</div>
        <div class="ob-auth-actions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;align-items:start">
          ${CAT_COLORS.map(col=>`<div class="color-opt" data-color="${col}" style="width:28px;height:28px;border-radius:50%;background:${col};cursor:pointer;border:2px solid ${c?.color===col?'white':'transparent'};transition:var(--transition)"></div>`).join('')}
        </div>
        <input type="hidden" id="c-color" value="${c?.color||CAT_COLORS[0]}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Crear'}</button>
    </div>`,
    (overlay) => {
      const name  = overlay.querySelector('#c-name').value.trim();
      const color = overlay.querySelector('#c-color').value;
      if (!name) return showToast('⚠ Nombre obligatorio');
      let list = load('categories', DEFAULT_CATS);
      if (isEdit) list = list.map(x=>x.id===c.id?{...x,name,color}:x);
      else list.push({id:name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''), name, color});
      save('categories',list);
      closeModal();
      showToast(isEdit?'Categoría actualizada':'Categoría creada ✓');
      renderCategorias();
    }
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelectorAll('.color-opt').forEach(el => el.addEventListener('click', () => {
    ov.querySelectorAll('.color-opt').forEach(o=>o.style.borderColor='transparent');
    el.style.borderColor='white';
    ov.querySelector('#c-color').value = el.dataset.color;
  }));
}

// ═══════════════════════════════════════════════
// FINANZAS SISTEMA (solo admin)
// ═══════════════════════════════════════════════
function renderFinanzasSistema() {
  const fmt = financeFmt;
  if (!activeAlter?.isAdmin) { navigateTo('finanzas'); return; }
  setCrumbs([
    {label:'Hub', action:()=>navigateTo('hub')},
    {label:'Finanzas', action:()=>navigateTo('finanzas')},
    {label:'Vista del sistema'},
  ]);
  const alters   = getAlters();
  const cats     = getAllFinanceCategories();
  const allTxs   = getAllFinanceTransactions();
  const now      = new Date();

  let fsMonth = parseInt(sessionStorage.getItem('fin_sis_month')||now.getMonth()+1);
  let fsYear  = parseInt(sessionStorage.getItem('fin_sis_year')||now.getFullYear());

  const filtered = allTxs.filter(t=>{
    const d=new Date(t.date);
    return d.getMonth()+1===fsMonth && d.getFullYear()===fsYear;
  }).sort((a,b)=>new Date(b.date)-new Date(a.date));

  const sysIngresos = filtered.filter(t=>t.type==='ingreso').reduce((s,t)=>s+t.amount,0);
  const sysGastos   = filtered.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0);
  const sysBalance  = sysIngresos - sysGastos;

  const months = Array.from({length:12},(_,i)=>({v:i+1,l:new Date(2000,i,1).toLocaleString('es-ES',{month:'long'})}));
  const years  = [...new Set(allTxs.map(t=>new Date(t.date).getFullYear()))];
  if(!years.includes(fsYear)) years.push(fsYear);
  years.sort((a,b)=>b-a);

  // Agrupar por alter
  const byAlter = {};
  filtered.forEach(t=>{
    const aid = t.alterId||'_sin';
    if(!byAlter[aid]) byAlter[aid]={ingresos:0,gastos:0,txs:[]};
    if(t.type==='ingreso') byAlter[aid].ingresos+=t.amount;
    else byAlter[aid].gastos+=t.amount;
    byAlter[aid].txs.push(t);
  });

  document.getElementById('app').innerHTML=`
    <div class="ig-view">
      <div class="ig-balance-row">
        <div class="balance-card positive"><div class="bc-label">Ingresos sistema</div><div class="bc-value pos">${fmt(sysIngresos)}</div></div>
        <div class="balance-card negative"><div class="bc-label">Gastos sistema</div><div class="bc-value neg">${fmt(sysGastos)}</div></div>
        <div class="balance-card neutral"><div class="bc-label">Balance</div><div class="bc-value ${sysBalance>=0?'pos':'neg'}">${fmt(sysBalance)}</div></div>
      </div>
      <div class="ig-toolbar">
        <div class="filter-group">
          <select id="fs-month">${months.map(m=>`<option value="${m.v}" ${m.v===fsMonth?'selected':''}>${m.l}</option>`).join('')}</select>
          <select id="fs-year">${years.map(y=>`<option value="${y}" ${y===fsYear?'selected':''}>${y}</option>`).join('')}</select>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px">
        ${Object.entries(byAlter).map(([aid,data])=>{
          const a = aid==='_sin' ? {name:'Sin alter',emoji:'◎',color:'var(--text-2)'} : alters.find(x=>x.id===aid)||{name:'?',emoji:'?',color:'var(--text-2)'};
          const bal = data.ingresos-data.gastos;
          return `<div class="fin-sistema-alter-block">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:20px">${a.emoji}</span>
              <span style="font-weight:700;color:${a.color}">${esc(a.name)}</span>
              <span style="font-size:12px;color:var(--text-3);margin-left:auto">${data.txs.length} movimientos</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
              <div class="balance-card positive" style="padding:8px 12px"><div class="bc-label" style="font-size:10px">Ingresos</div><div class="bc-value pos" style="font-size:14px">${fmt(data.ingresos)}</div></div>
              <div class="balance-card negative" style="padding:8px 12px"><div class="bc-label" style="font-size:10px">Gastos</div><div class="bc-value neg" style="font-size:14px">${fmt(data.gastos)}</div></div>
              <div class="balance-card neutral" style="padding:8px 12px"><div class="bc-label" style="font-size:10px">Balance</div><div class="bc-value ${bal>=0?'pos':'neg'}" style="font-size:14px">${fmt(bal)}</div></div>
            </div>
            <div class="ig-list">
              ${data.txs.slice(0,5).map(t=>{
                const cat=cats.find(c=>c.id===t.category && c.alterId===t.alterId) || cats.find(c=>c.id===t.category);
                return `<div class="tx-row">
                  <div class="tx-desc">${esc(t.description)}</div>
                  <div class="tx-cat" style="color:${cat?.color||'var(--text-3)'}">${cat?.name||'—'}</div>
                  <div>${esc(t.account||'—')}</div>
                  <div>${esc(t.source||'—')}</div>
                  <div class="tx-date">${new Date(t.date).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                  <div>${esc(t.note||'—')}</div>
                  <div class="tx-amount ${t.type==='ingreso'?'positive':'negative'}">${t.type==='ingreso'?'+':'−'}${fmt(t.amount)}</div>
                  <div></div>
                </div>`;
              }).join('')}
              ${data.txs.length>5?`<div style="font-size:11px;color:var(--text-3);padding:6px 0">+${data.txs.length-5} más</div>`:''}
            </div>
          </div>`;
        }).join('')}
        ${Object.keys(byAlter).length===0?`<div class="empty-state"><div class="empty-icon">◈</div><div>Sin movimientos este período</div></div>`:''}
      </div>
    </div>`;

  document.getElementById('fs-month')?.addEventListener('change',e=>{
    sessionStorage.setItem('fin_sis_month',e.target.value);
    renderFinanzasSistema();
  });
  document.getElementById('fs-year')?.addEventListener('change',e=>{
    sessionStorage.setItem('fin_sis_year',e.target.value);
    renderFinanzasSistema();
  });
}
// ═══════════════════════════════════════════════
const NOTA_COLORS = [
  {id:'amber',   hex:'#2a2010', text:'#ffd580', border:'rgba(255,213,128,.25)'},
  {id:'purple',  hex:'#1a1528', text:'#c4aaff', border:'rgba(160,138,255,.25)'},
  {id:'teal',    hex:'#0f2420', text:'#7affd4', border:'rgba(138,255,224,.25)'},
  {id:'pink',    hex:'#2a1020', text:'#ffaad4', border:'rgba(255,138,226,.25)'},
  {id:'blue',    hex:'#101828', text:'#90c4ff', border:'rgba(138,180,255,.25)'},
  {id:'red',     hex:'#2a1015', text:'#ff9090', border:'rgba(255,107,138,.25)'},
  {id:'green',   hex:'#102015', text:'#90ffb0', border:'rgba(95,255,176,.25)'},
  {id:'neutral', hex:'#16162a', text:'#b8b4d8', border:'rgba(120,120,200,.15)'},
];

let notasViewMode   = 'grid';   // 'grid' | 'list'
let notasFilterAlter = 'all';
let notasFilterTag   = null;
let notasFilterFrom  = '';
let notasFilterTo    = '';

function loadNotas()   { try { return JSON.parse(localStorage.getItem('tid_notas'))||[]; } catch{return[];} }
function saveNotas(n)  { localStorage.setItem('tid_notas', JSON.stringify(n)); }

function loadTemplates() { try { return JSON.parse(localStorage.getItem('tid_templates'))||[]; } catch{return[];} }
function saveTemplates(t) { localStorage.setItem('tid_templates', JSON.stringify(t)); }
function getTemplates(type, includeArchived = false) {
  return loadTemplates().filter(t => t.type === type && (includeArchived || !t.archived));
}
function escTpl(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function parseTemplateTags(raw) {
  return String(raw||'').split(/\s+/).map(x=>x.replace(/^#/,'').trim().toLowerCase().replace(/[^a-z0-9áéíóúüñ_-]/g,'')).filter(Boolean);
}
function templateTypeLabel(type) { return type === 'task' ? 'tarea' : 'nota'; }
function templateDefaults(type) {
  return type === 'task'
    ? {type, name:'', title:'', body:'', tags:[], priority:'media', status:'pendiente', archived:false}
    : {type, name:'', title:'', body:'', tags:[], color:'neutral', archived:false};
}
function renderTemplateCard(t, context) {
  const tags = (t.tags||[]).slice(0,4).map(tag=>`<span class="nota-card-tag">#${escTpl(tag)}</span>`).join('');
  const meta = t.type === 'task'
    ? `<span>${t.priority||'media'}</span><span>${t.status||'pendiente'}</span>`
    : `<span>${t.color||'neutral'}</span>`;
  return `<div class="template-row${t.archived?' archived':''}" data-template-id="${t.id}">
    <div class="template-row-main">
      <div class="template-row-title">${escTpl(t.name || t.title || 'Plantilla')}</div>
      <div class="template-row-preview">${escTpl(t.title || '')}${t.body ? ` · ${escTpl(t.body).slice(0,90)}` : ''}</div>
      <div class="template-row-meta">${meta}${tags}</div>
    </div>
    <div class="template-row-actions">
      ${!t.archived?`<button class="btn btn-primary btn-sm" data-template-use="${t.id}">Usar</button>`:''}
      <button class="icon-btn" data-template-edit="${t.id}" title="Editar">✎</button>
      <button class="icon-btn" data-template-dup="${t.id}" title="Duplicar">⧉</button>
      ${!t.archived?`<button class="icon-btn" data-template-archive="${t.id}" title="Archivar">↓</button>`:''}
    </div>
  </div>`;
}
function openTemplatesModal(type, context = {}) {
  const templates = getTemplates(type, true).sort((a,b)=>(a.archived?1:0)-(b.archived?1:0)||((b.updatedTs||b.ts||0)-(a.updatedTs||a.ts||0)));
  const activeCount = templates.filter(t=>!t.archived).length;
  openModal(`
    <div class="modal-title">Plantillas de ${templateTypeLabel(type)}s</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2)">${activeCount} activas · ${templates.length-activeCount} archivadas</div>
      <button class="btn btn-primary btn-sm" id="btn-template-new">+ Nueva plantilla</button>
    </div>
    <div class="template-list">
      ${templates.length ? templates.map(t=>renderTemplateCard(t, context)).join('') : `<div class="task-empty" style="padding:28px"><div class="task-empty-icon">◇</div><div>Sin plantillas todavía</div></div>`}
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" data-cancel>Cerrar</button></div>`,
    ()=>{}
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelector('#btn-template-new')?.addEventListener('click',()=>openTemplateEditor(type, null, context));
  ov.querySelectorAll('[data-template-use]').forEach(btn=>btn.addEventListener('click',()=>useTemplate(btn.dataset.templateUse, context)));
  ov.querySelectorAll('[data-template-edit]').forEach(btn=>btn.addEventListener('click',()=>openTemplateEditor(type, loadTemplates().find(t=>t.id===btn.dataset.templateEdit), context)));
  ov.querySelectorAll('[data-template-dup]').forEach(btn=>btn.addEventListener('click',()=>{
    const src = loadTemplates().find(t=>t.id===btn.dataset.templateDup);
    if(!src) return;
    const copy = {...src, id:uid(), name:`${src.name || src.title || 'Plantilla'} copia`, archived:false, ts:Date.now(), updatedTs:Date.now()};
    const list = loadTemplates(); list.push(copy); saveTemplates(list);
    closeModal(); showToast('Plantilla duplicada'); openTemplatesModal(type, context);
  }));
  ov.querySelectorAll('[data-template-archive]').forEach(btn=>btn.addEventListener('click',()=>{
    const list = loadTemplates(); const tpl = list.find(t=>t.id===btn.dataset.templateArchive);
    if(tpl){ tpl.archived = true; tpl.updatedTs = Date.now(); saveTemplates(list); closeModal(); showToast('Plantilla archivada'); openTemplatesModal(type, context); }
  }));
}
function openTemplateEditor(type, template, context = {}) {
  const isEdit = !!template;
  const t = template || templateDefaults(type);
  openModal(`
    <div class="modal-title">${isEdit?'Editar':'Nueva'} plantilla de ${templateTypeLabel(type)}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Nombre de plantilla</div>
        <input id="tpl-name" type="text" value="${escTpl(t.name||'')}" placeholder="Rutina de mañana">
      </div>
      <div class="form-row">
        <div class="form-label">Título por defecto</div>
        <input id="tpl-title" type="text" value="${escTpl(t.title||'')}" placeholder="${type==='task'?'Revisar mochila':'Check-in rápido'}">
      </div>
      <div class="form-row">
        <div class="form-label">${type==='task'?'Descripción':'Contenido'}</div>
        <textarea id="tpl-body" style="min-height:130px" placeholder="${type==='task'?'Pasos, criterios o contexto...':'Preguntas, secciones o pauta...'}">${escTpl(t.body||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Tags</div>
        <input id="tpl-tags" type="text" value="${(t.tags||[]).map(tag=>'#'+escTpl(tag)).join(' ')}" placeholder="#rutina #salud">
      </div>
      ${type==='task'?`
        <div class="form-row two-col">
          <div class="form-row">
            <div class="form-label">Prioridad</div>
            <select id="tpl-priority">${PRIORITIES.map(p=>`<option value="${p.id}" ${(t.priority||'media')===p.id?'selected':''}>${p.label}</option>`).join('')}</select>
          </div>
          <div class="form-row">
            <div class="form-label">Estado inicial</div>
            <select id="tpl-status">${TASK_STATUSES.map(s=>`<option value="${s.id}" ${(t.status||'pendiente')===s.id?'selected':''}>${s.label}</option>`).join('')}</select>
          </div>
        </div>`:`
        <div class="form-row">
          <div class="form-label">Color</div>
          <select id="tpl-color">${NOTA_COLORS.map(c=>`<option value="${c.id}" ${(t.color||'neutral')===c.id?'selected':''}>${c.id}</option>`).join('')}</select>
        </div>`}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Crear plantilla'}</button>
    </div>`,
    (ov)=>{
      const name = ov.querySelector('#tpl-name').value.trim();
      const title = ov.querySelector('#tpl-title').value.trim();
      const body = ov.querySelector('#tpl-body').value.trim();
      if(!name && !title) return showToast('⚠ Ponle nombre o título');
      const entry = {...t, id:t.id||uid(), type, name:name||title, title, body, tags:parseTemplateTags(ov.querySelector('#tpl-tags').value), archived:false, ts:t.ts||Date.now(), updatedTs:Date.now()};
      if(type==='task') { entry.priority=ov.querySelector('#tpl-priority').value; entry.status=ov.querySelector('#tpl-status').value; }
      else entry.color=ov.querySelector('#tpl-color').value;
      let list = loadTemplates();
      if(isEdit) list = list.map(x=>x.id===t.id?entry:x); else list.push(entry);
      saveTemplates(list);
      closeModal(); showToast(isEdit?'Plantilla guardada':'Plantilla creada'); setTimeout(()=>openTemplatesModal(type, context), 0);
    }
  );
}
function useTemplate(templateId, context = {}) {
  const tpl = loadTemplates().find(t=>t.id===templateId);
  if(!tpl || tpl.archived) return;
  if(tpl.type === 'note') {
    const list = loadNotas();
    list.push({id:uid(),alterId:activeAlter.id,title:tpl.title||tpl.name||'',body:tpl.body||'',color:tpl.color||'neutral',tags:[...(tpl.tags||[])],isPrivate:false,pinned:false,ts:Date.now()});
    saveNotas(list);
    closeModal(); showToast('Nota creada desde plantilla');
    if(context.afterUse==='notas-module') renderNotasSolicView(); else renderNotasView();
    return;
  }
  const proyId = context.proyId || activeProyId;
  if(!proyId) return showToast('⚠ Elige un proyecto');
  const tasks = loadTareas();
  tasks.push({id:uid(),proyId,title:tpl.title||tpl.name||'',desc:tpl.body||'',assigneeId:activeAlter?.id||null,status:tpl.status||'pendiente',priority:tpl.priority||'media',deadline:'',tags:[...(tpl.tags||[])],ts:Date.now()});
  saveTareas(tasks);
  closeModal(); showToast('Tarea creada desde plantilla'); renderProyView();
}

function getVisibleNotas() {
  return loadNotas().filter(n =>
    !n.isPrivate || n.alterId === activeAlter.id
  );
}

// renderNotas: overridden by solicitudes module

function renderNotasView() {
  return window.AtriaNotesView.render();
}
function renderNotas() {
  renderNotasView();
}

// ARCHIVO
// ═══════════════════════════════════════════════
let archivoOpenSections = {diario:true, notas:true, proyectos:true, normas:true, wishlist:true, tareas:true};

// Helpers — each section defines how to get, restore, delete, preview items
function getArchivedDiario() {
  // Diario doesn't have explicit "archived" status — we expose deleted via a separate "archivo" flag
  // Items with isArchived===true
  return loadEntries().filter(e=>e.isArchived);
}
function getArchivedNotas() {
  return loadNotas().filter(n=>n.isArchived);
}
function getArchivedProyectos() {
  return loadProyectos().filter(p=>p.status==='archivado');
}
function getArchivedNormas() {
  return loadNormas().filter(n=>n.status==='archivada');
}
function getArchivedWishes() {
  return loadWishes().filter(w=>w.status==='descartado');
}
function getArchivedTareas() {
  return loadTareas().filter(t=>t.status==='completada');
}

// ═══════════════════════════════════════════════
// NOTIFICACIONES — vista standalone
// ═══════════════════════════════════════════════
function renderNotif(){ return window.AtriaNotificationsView.render(); }

function renderArchivo() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Archivo'}]);
  renderArchivoView();
}

function renderArchivoView() {
  const app    = document.getElementById('app');
  const alters = getAlters();

  const sections = [
    {
      id:'diario', icon:'◫', label:'Entradas del diario', color:'var(--accent-2)',
      items: getArchivedDiario(),
      renderItem: (e)=>({
        icon: getMoods().find(m=>m.id===e.mood)?.emoji||'◫',
        title: e.title||'(sin título)',
        preview: e.body||'',
        date: e.ts,
        badges: [alters.find(a=>a.id===e.alterId)?.name||'?'].filter(Boolean),
        id: e.id,
      }),
      restore: (id)=>{
        const es=loadEntries(); const e=es.find(x=>x.id===id);
        if(e){ delete e.isArchived; saveEntries(es); showToast('Entrada restaurada al Diario ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const e=loadEntries().find(x=>x.id===id); if(!e) return;
        const alt=alters.find(a=>a.id===e.alterId);
        const mood=getMoods().find(m=>m.id===e.mood);
        previewModal('Entrada del diario',[
          {label:'Autor', val:(alt?.emoji||'')+' '+(alt?.name||'?')},
          {label:'Estado', val:mood?mood.emoji+' '+mood.label:'—'},
          {label:'Fecha', val:new Date(e.ts).toLocaleString('es-ES',{day:'numeric',month:'long',year:'numeric'})},
        ], e.title||'(sin título)', e.body||'');
      },
      del: (id)=>{
        if(!confirm('¿Eliminar permanentemente esta entrada?')) return;
        saveEntries(loadEntries().filter(x=>x.id!==id));
        showToast('Entrada eliminada permanentemente'); renderArchivoView();
      },
    },
    {
      id:'notas', icon:'◧', label:'Notas', color:'var(--accent-4)',
      items: getArchivedNotas(),
      renderItem: (n)=>({
        icon:'◧', title:n.title||'(sin título)', preview:n.body||'',
        date:n.ts,
        badges:[alters.find(a=>a.id===n.alterId)?.name||'?', ...(n.tags||[]).slice(0,2).map(t=>'#'+t)],
        id:n.id,
      }),
      restore: (id)=>{
        const ns=loadNotas(); const n=ns.find(x=>x.id===id);
        if(n){ delete n.isArchived; saveNotas(ns); showToast('Nota restaurada ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const n=loadNotas().find(x=>x.id===id); if(!n) return;
        const alt=alters.find(a=>a.id===n.alterId);
        const col=getNotaColor(n.color);
        previewModal('Nota',[
          {label:'Autor', val:(alt?.emoji||'')+' '+(alt?.name||'?')},
          {label:'Color', val:`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${col.text}"></span>`},
          {label:'Tags', val:(n.tags||[]).map(t=>'#'+t).join(' ')||'—'},
        ], n.title||'(sin título)', n.body||'');
      },
      del: (id)=>{
        if(!confirm('¿Eliminar permanentemente esta nota?')) return;
        saveNotas(loadNotas().filter(x=>x.id!==id));
        showToast('Nota eliminada permanentemente'); renderArchivoView();
      },
    },
    {
      id:'proyectos', icon:'◉', label:'Proyectos', color:'var(--accent-3)',
      items: getArchivedProyectos(),
      renderItem: (p)=>{
        const prog=proyProgress(p.id);
        const resp=alters.find(a=>a.id===p.responsableId);
        return {
          icon:'◉', title:p.name, preview:p.desc||'Sin descripción',
          date:p.ts, badges:[resp?.name||'', prog.total+' tareas'].filter(Boolean), id:p.id,
        };
      },
      restore: (id)=>{
        const ps=loadProyectos(); const p=ps.find(x=>x.id===id);
        if(p){ p.status='activo'; saveProyectos(ps); showToast('Proyecto restaurado como Activo ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const p=loadProyectos().find(x=>x.id===id); if(!p) return;
        const resp=alters.find(a=>a.id===p.responsableId);
        const prog=proyProgress(id);
        previewModal('Proyecto',[
          {label:'Responsable', val:resp?(resp.emoji+' '+resp.name):'Sin asignar'},
          {label:'Progreso', val:`${prog.done}/${prog.total} tareas (${prog.pct}%)`},
          {label:'Archivado', val:p.deadline?fmtDate(p.deadline):'—'},
        ], p.name, p.desc||'');
      },
      del: (id)=>{
        if(!confirm('¿Eliminar proyecto y todas sus tareas permanentemente?')) return;
        saveProyectos(loadProyectos().filter(x=>x.id!==id));
        saveTareas(loadTareas().filter(t=>t.proyId!==id));
        showToast('Proyecto eliminado permanentemente'); renderArchivoView();
      },
    },
    {
      id:'normas', icon:'◳', label:'Normas', color:'var(--accent)',
      items: getArchivedNormas(),
      renderItem: (n)=>{
        const prop=alters.find(a=>a.id===n.proposerId);
        const pri=PRIORITIES.find(p=>p.id===n.priority)||PRIORITIES[1];
        return {icon:pri.emoji, title:n.title, preview:n.desc||'', date:n.ts, badges:[prop?.name||'?'], id:n.id};
      },
      restore: (id)=>{
        const ns=loadNormas(); const n=ns.find(x=>x.id===id);
        if(n){ n.status='activa'; saveNormas(ns); showToast('Norma restaurada como Activa ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const n=loadNormas().find(x=>x.id===id); if(!n) return;
        const prop=alters.find(a=>a.id===n.proposerId);
        const pri=PRIORITIES.find(p=>p.id===n.priority)||PRIORITIES[1];
        previewModal('Norma',[
          {label:'Propuesta por', val:prop?(prop.emoji+' '+prop.name):'?'},
          {label:'Prioridad', val:pri.emoji+' '+pri.label},
          {label:'Votos', val:`✓ ${(n.votes||[]).filter(v=>v.vote==='yes').length} / ✕ ${(n.votes||[]).filter(v=>v.vote==='no').length}`},
        ], n.title, n.desc||'');
      },
      del: (id)=>{
        if(!confirm('¿Eliminar permanentemente esta norma?')) return;
        saveNormas(loadNormas().filter(x=>x.id!==id));
        showToast('Norma eliminada permanentemente'); renderArchivoView();
      },
    },
    {
      id:'wishlist', icon:'◈', label:'Deseos descartados', color:'var(--green)',
      items: getArchivedWishes(),
      renderItem: (w)=>{
        const cat=WISH_CATS.find(c=>c.id===w.category)||WISH_CATS[4];
        const alt=alters.find(a=>a.id===w.alterId);
        return {icon:'✕', title:w.title, preview:w.desc||'', date:w.ts,
          badges:[cat.label, w.price?'~'+w.price+'€':'', alt?.name||''].filter(Boolean), id:w.id};
      },
      restore: (id)=>{
        const ws=loadWishes(); const w=ws.find(x=>x.id===id);
        if(w){ w.status='deseado'; saveWishes(ws); showToast('Deseo restaurado a la Wishlist ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const w=loadWishes().find(x=>x.id===id); if(!w) return;
        const cat=WISH_CATS.find(c=>c.id===w.category)||WISH_CATS[4];
        const alt=alters.find(a=>a.id===w.alterId);
        previewModal('Deseo descartado',[
          {label:'Categoría', val:cat.label},
          {label:'Precio estimado', val:w.price?'~'+w.price+'€':'—'},
          {label:'Autor', val:alt?(alt.emoji+' '+alt.name):'?'},
          {label:'Enlace', val:w.url?`<a href="${w.url}" target="_blank" style="color:var(--accent);font-size:11px">🔗 Ver</a>`:'—'},
        ], w.title, w.desc||'');
      },
      del: (id)=>{
        if(!confirm('¿Eliminar permanentemente este deseo?')) return;
        saveWishes(loadWishes().filter(x=>x.id!==id));
        showToast('Deseo eliminado permanentemente'); renderArchivoView();
      },
    },
    {
      id:'tareas', icon:'✓', label:'Tareas completadas', color:'var(--green)',
      items: getArchivedTareas(),
      renderItem: (t)=>{
        const proy=loadProyectos().find(p=>p.id===t.proyId);
        const assignee=alters.find(a=>a.id===t.assigneeId);
        const pri={alta:'🔴',media:'🟡',baja:'🟢'}[t.priority]||'⚪';
        return {
          icon:'✓', title:t.title, preview:t.desc||'',
          date:t.deadline||t.ts||Date.now(),
          badges:[proy?'◉ '+proy.name:'', assignee?assignee.emoji+' '+assignee.name:'', pri+' '+({alta:'Alta',media:'Media',baja:'Baja'}[t.priority]||'')].filter(Boolean),
          id:t.id,
        };
      },
      restore: (id)=>{
        const ts=loadTareas(); const t=ts.find(x=>x.id===id);
        if(t){ t.status='pendiente'; saveTareas(ts); showToast('Tarea restaurada como Pendiente ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const t=loadTareas().find(x=>x.id===id); if(!t) return;
        const proy=loadProyectos().find(p=>p.id===t.proyId);
        const assignee=alters.find(a=>a.id===t.assigneeId);
        previewModal('Tarea completada',[
          {label:'Proyecto', val:proy?proy.name:'—'},
          {label:'Asignada a', val:assignee?(assignee.emoji+' '+assignee.name):'—'},
          {label:'Prioridad', val:{alta:'🔴 Alta',media:'🟡 Media',baja:'🟢 Baja'}[t.priority]||'—'},
          {label:'Fecha límite', val:t.deadline?fmtDate(t.deadline):'—'},
        ], t.title, t.desc||'');
      },
      del: (id)=>{
        if(!confirm('¿Eliminar permanentemente esta tarea?')) return;
        saveTareas(loadTareas().filter(x=>x.id!==id));
        showToast('Tarea eliminada permanentemente'); renderArchivoView();
      },
    },
  ];

  const totalItems = sections.reduce((s,sec)=>s+sec.items.length,0);

  app.innerHTML = `
    <div class="archivo-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◪ Archivo</div>
          <div class="fin-subtitle">${totalItems} elemento${totalItems!==1?'s':''} archivados</div>
        </div>
        ${totalItems>0?`<button class="btn btn-danger btn-sm" id="btn-purge-all">✕ Vaciar archivo</button>`:''}
      </div>

      ${totalItems===0?`<div class="empty-state" style="padding:60px 20px">
        <div class="empty-icon">◪</div>
        <div>El archivo está vacío</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);margin-top:6px">
          El contenido archivado aparece aquí automáticamente
        </div>
      </div>`:''}

      ${sections.filter(s=>s.items.length>0).map(sec=>`
        <div class="archivo-section">
          <div class="archivo-section-header" data-sec="${sec.id}">
            <div class="archivo-section-left">
              <div class="archivo-section-icon" style="color:${sec.color}">${sec.icon}</div>
              <div class="archivo-section-title">${sec.label}</div>
              <div class="archivo-section-count">${sec.items.length}</div>
            </div>
            <span class="archivo-section-toggle${archivoOpenSections[sec.id]?' open':''}">▶</span>
          </div>
          ${archivoOpenSections[sec.id]?`
          <div class="archivo-items">
            ${sec.items.map(item=>{
              const ri=sec.renderItem(item);
              const d=new Date(ri.date).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'});
              return `<div class="archivo-item">
                <div class="archivo-item-icon">${ri.icon}</div>
                <div class="archivo-item-body">
                  <div class="archivo-item-title">${escArchivo(ri.title)}</div>
                  ${ri.preview?`<div class="archivo-item-preview">${escArchivo(ri.preview)}</div>`:''}
                  <div class="archivo-item-meta">
                    <span class="archivo-item-date">📅 ${d}</span>
                    ${ri.badges.map(b=>`<span class="archivo-item-badge">${escArchivo(b)}</span>`).join('')}
                  </div>
                </div>
                <div class="archivo-item-actions">
                  <button class="btn btn-ghost btn-sm btn-archivo-preview" data-sec="${sec.id}" data-iid="${ri.id}" title="Vista previa">👁</button>
                  <button class="btn btn-ghost btn-sm btn-archivo-restore" data-sec="${sec.id}" data-iid="${ri.id}" title="Restaurar">↑ Restaurar</button>
                  <button class="btn btn-danger btn-sm btn-archivo-del" data-sec="${sec.id}" data-iid="${ri.id}" title="Eliminar">✕</button>
                </div>
              </div>`;
            }).join('')}
          </div>`:''}
        </div>`).join('')}

      <!-- GUÍA -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 20px">
        <div style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-2);margin-bottom:12px">Cómo llega el contenido aquí</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${[
            {icon:'◫', text:'Entradas del Diario marcadas con "Archivar" desde su menú'},
            {icon:'◧', text:'Notas marcadas como archivadas desde su menú'},
            {icon:'◉', text:'Proyectos con estado "Archivado"'},
            {icon:'◳', text:'Normas con estado "Archivada" (gestionado por el admin)'},
            {icon:'◈', text:'Deseos de la Wishlist marcados como "Descartado"'},
            {icon:'✓', text:'Tareas de Proyectos con estado "Completada"'},
          ].map(g=>`<div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--text-1)">
            <span style="font-size:14px;flex-shrink:0;width:20px;text-align:center">${g.icon}</span>
            <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2)">${g.text}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>`;

  // Section collapse
  app.querySelectorAll('[data-sec]').forEach(hdr=>{
    if(!hdr.classList.contains('archivo-section-header')) return;
    hdr.addEventListener('click',()=>{ archivoOpenSections[hdr.dataset.sec]=!archivoOpenSections[hdr.dataset.sec]; renderArchivoView(); });
  });

  // Wire buttons using sections map
  const secMap = Object.fromEntries(sections.map(s=>[s.id,s]));
  app.querySelectorAll('.btn-archivo-preview').forEach(b=>b.addEventListener('click',()=>secMap[b.dataset.sec]?.preview(b.dataset.iid)));
  app.querySelectorAll('.btn-archivo-restore').forEach(b=>b.addEventListener('click',()=>secMap[b.dataset.sec]?.restore(b.dataset.iid)));
  app.querySelectorAll('.btn-archivo-del').forEach(b=>b.addEventListener('click',()=>secMap[b.dataset.sec]?.del(b.dataset.iid)));

  // Purge all
  app.querySelector('#btn-purge-all')?.addEventListener('click',()=>{
    if(!confirm(`¿Eliminar permanentemente los ${totalItems} elementos archivados? Esta acción no se puede deshacer.`)) return;
    // Delete from each source
    saveEntries(loadEntries().filter(e=>!e.isArchived));
    saveNotas(loadNotas().filter(n=>!n.isArchived));
    const archivedPIDs=getArchivedProyectos().map(p=>p.id);
    saveProyectos(loadProyectos().filter(p=>p.status!=='archivado'));
    saveTareas(loadTareas().filter(t=>!archivedPIDs.includes(t.proyId) && t.status!=='completada'));
    saveNormas(loadNormas().filter(n=>n.status!=='archivada'));
    saveWishes(loadWishes().filter(w=>w.status!=='descartado'));
    showToast('Archivo vaciado ✓'); renderArchivoView();
  });
}

function escArchivo(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function previewModal(tipo, meta, title, body) {
  openModal(`
    <div class="preview-modal">
      <span class="preview-modal-tag">${tipo}</span>
      ${title?`<div class="preview-modal-title">${escArchivo(title)}</div>`:''}
      ${body?`<div class="preview-modal-body">${escArchivo(body)}</div>`:''}
      <div class="preview-modal-meta">
        ${meta.map(m=>`<div style="display:flex;align-items:center;gap:5px">
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em">${m.label}:</span>
          <span style="font-size:12px;color:var(--text-1)">${m.val}</span>
        </div>`).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cerrar</button>
    </div>`,
    ()=>{}
  );
}

// ── Lógica de archivar integrada directamente en renderDiarioDetail y renderNotasContent ──

// ═══════════════════════════════════════════════
// NOTIFICACIONES
// ═══════════════════════════════════════════════
const NOTIF_DEFAULTS = {
  agenda:      true,
  solicitudes: true,
  normas:      true,
  backup:      true,
  onlinePushMessage: true,
  onlinePushFriendRequest: true,
  onlinePushReminder: true,
  // DND
  dndEnabled:  false,
  dndFrom:     '23:00',
  dndTo:       '08:00',
  // Regla condicional: solo notificar si cierto alter está al frente
  frontingRuleEnabled: false,
  frontingRuleAlterId: null,
};
const NOTIF_KEY     = 'tid_notif_config';
const NOTIF_DIM_KEY = 'tid_notif_dismissed'; // dismissed today per alter

function loadNotifConfig() {
  try { return Object.assign({}, NOTIF_DEFAULTS, JSON.parse(localStorage.getItem(NOTIF_KEY))||{}); }
  catch { return {...NOTIF_DEFAULTS}; }
}
function saveNotifConfig(c) { localStorage.setItem(NOTIF_KEY, JSON.stringify(c)); }

function getOnlinePushPreferencesFromNotifConfig(cfg = loadNotifConfig()) {
  return {
    message: cfg.onlinePushMessage !== false,
    friend_request: cfg.onlinePushFriendRequest !== false,
    reminder: cfg.onlinePushReminder !== false,
  };
}

// dismissed = {alterId: {date:'YYYY-MM-DD', keys:[], history:[{date, keys[]}]}}
function getDismissed() {
  try { return JSON.parse(localStorage.getItem(NOTIF_DIM_KEY))||{}; }
  catch { return {}; }
}
function saveDismissed(d) { localStorage.setItem(NOTIF_DIM_KEY, JSON.stringify(d)); }

function isDismissedToday(alterId, key) {
  const today = new Date().toISOString().slice(0,10);
  const d = getDismissed();
  return d[alterId]?.date === today && (d[alterId].keys||[]).includes(key);
}
function dismissToday(alterId, key) {
  const today = new Date().toISOString().slice(0,10);
  const d = getDismissed();
  if (!d[alterId] || d[alterId].date !== today) {
    // Archive previous day to history
    if (d[alterId]?.date && d[alterId].keys?.length) {
      if (!d[alterId].history) d[alterId].history = [];
      d[alterId].history.push({date: d[alterId].date, keys: d[alterId].keys});
      // Keep only last 7 days in history
      d[alterId].history = d[alterId].history.slice(-7);
    }
    d[alterId] = {...(d[alterId]||{}), date: today, keys: [], history: d[alterId]?.history||[]};
  }
  if (!d[alterId].keys.includes(key)) d[alterId].keys.push(key);
  saveDismissed(d);
}

function getDismissedHistory(alterId) {
  const d = getDismissed();
  const rec = d[alterId];
  if (!rec) return [];
  const today = new Date().toISOString().slice(0,10);
  const hist = [...(rec.history||[])];
  if (rec.keys?.length) hist.push({date: rec.date||today, keys: rec.keys});
  return hist.sort((a,b)=>b.date.localeCompare(a.date));
}

// ── COMPUTE NOTIFICATIONS ──
function _isInDND(cfg) {
  if (!cfg.dndEnabled) return false;
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const curMin = h*60+m;
  const [fh,fm] = (cfg.dndFrom||'23:00').split(':').map(Number);
  const [th,tm] = (cfg.dndTo||'08:00').split(':').map(Number);
  const fromMin = fh*60+fm, toMin = th*60+tm;
  if (fromMin <= toMin) return curMin >= fromMin && curMin < toMin;
  return curMin >= fromMin || curMin < toMin; // overnight
}

function computeNotifs(alterId) {
  if (!alterId) return [];
  try {
  const cfg    = loadNotifConfig();
  // Check DND
  if (_isInDND(cfg)) return [];
  // Check fronting rule
  if (cfg.frontingRuleEnabled && cfg.frontingRuleAlterId) {
    const current = getFrontingActual();
    const fronters = [current?.alterId, ...(current?.coFronting||[])];
    if (!fronters.includes(cfg.frontingRuleAlterId)) return [];
  }
  const alters = getAlters();
  const now    = new Date();
  const todayStr = now.toISOString().slice(0,10);
  const notifs = [];

  // AGENDA — eventos hoy o mañana
  if (cfg.agenda && !isDismissedToday(alterId, 'agenda')) {
    const tomorrow = new Date(now.getTime() + 86400000);
    const events = expandRecurring(
      loadEvents().filter(e => e.scope==='compartido' || getEventAlterIds(e).includes(alterId)),
      now, new Date(now.getTime() + 2*86400000)
    );
    const soon = events.filter(e => {
      const d = eventDate(e._instanceDate);
      return e._instanceDate===localDateKey(now) || e._instanceDate===localDateKey(tomorrow);
    });
    if (soon.length) {
      const first = soon[0];
      const d = new Date(first._instanceDate);
      const label = first._instanceDate===localDateKey(now) ? 'Hoy' : 'Mañana';
      notifs.push({
        key: 'agenda',
        icon: '◷',
        color: '#ffb450', border: 'rgba(255,180,80,.25)', bg: 'rgba(255,180,80,.07)',
        title: `${soon.length} evento${soon.length>1?'s':''} próximo${soon.length>1?'s':''}`,
        sub: `${label}: ${first.title}${first.allDay||!first.time?' · Todo el día':first.time?' · '+first.time:''}`,
        nav: 'agenda',
      });
    }
  }

  // SOLICITUDES — pendientes para este alter
  if (cfg.solicitudes && !isDismissedToday(alterId, 'solicitudes')) {
    const pend = loadSolicitudes().filter(s =>
      (s.toId===alterId || s.toId==='sistema') && s.status==='pendiente'
    );
    if (pend.length) {
      notifs.push({
        key: 'solicitudes',
        icon: '◱',
        color: '#a08aff', border: 'rgba(160,138,255,.25)', bg: 'rgba(160,138,255,.07)',
        title: `${pend.length} solicitud${pend.length>1?'es':''} pendiente${pend.length>1?'s':''}`,
        sub: `De: ${[...new Set(pend.map(s=>{ const a=alters.find(x=>x.id===s.fromId); return a?a.name:'?'; }))].slice(0,2).join(', ')}`,
        nav: 'notas', tab: 'solicitudes',
      });
    }
  }

  // Notificación de diario eliminada

  // NORMAS — pendientes de voto de este alter
  if (cfg.normas && !isDismissedToday(alterId, 'normas')) {
    const pendVoto = loadNormas().filter(n =>
      n.status==='propuesta' &&
      !(n.votes||[]).some(v => v.alterId===alterId)
    );
    if (pendVoto.length) {
      notifs.push({
        key: 'normas',
        icon: '◳',
        color: '#8ab4ff', border: 'rgba(138,180,255,.25)', bg: 'rgba(138,180,255,.07)',
        title: `${pendVoto.length} norma${pendVoto.length>1?'s':''} pendiente${pendVoto.length>1?'s':''} de voto`,
        sub: pendVoto[0].title,
        nav: 'normas',
      });
    }
  }

  // BACKUP — sin exportar en más de 7 días
  if (cfg.backup && !isDismissedToday(alterId, 'backup')) {
    const lastBackup = parseInt(localStorage.getItem('tid_last_backup')||'0', 10);
    const daysSince = lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : null;
    const neverDone = !lastBackup;
    if (neverDone || daysSince >= 7) {
      notifs.push({
        key: 'backup',
        icon: '◬',
        color: '#ffb450', border: 'rgba(255,180,80,.25)', bg: 'rgba(255,180,80,.07)',
        title: neverDone ? 'Sin copia externa exportada' : `Exportación manual hace ${daysSince} días`,
        sub: 'Si quieres una copia fuera de Atria, puedes exportarla desde Configuración',
        nav: 'config',
      });
    }
  }

  return notifs;
  } catch(e) { console.warn('computeNotifs error:', e); return []; }
}

// ── RENDER BANNERS ──
function renderNotifBanners(alterId) {
  const notifs = computeNotifs(alterId);
  if (!notifs.length) return '';
  let html = '<div class="notif-banner-stack">';
  notifs.forEach(function(n) {
    html += '<div class="notif-banner" data-notif-key="' + n.key + '" data-notif-nav="' + n.nav + '"';
    if (n.tab) html += ' data-notif-tab="' + n.tab + '"';
    html += ' style="background:' + n.bg + ';border-color:' + n.border + '">';
    html += '<span class="notif-banner-icon" style="color:' + n.color + '">' + n.icon + '</span>';
    html += '<div class="notif-banner-body">';
    html += '<div class="notif-banner-title" style="color:' + n.color + '">' + n.title + '</div>';
    html += '<div class="notif-banner-sub">' + n.sub + '</div>';
    html += '</div>';
    html += '<span class="notif-banner-arrow" style="color:' + n.color + '">→</span>';
    html += '<button class="notif-banner-dismiss" data-dismiss="' + n.key + '" title="Descartar hoy">✕</button>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function wireNotifBanners(alterId) {
  document.querySelectorAll('.notif-banner[data-notif-nav]').forEach(b => {
    b.addEventListener('click', e => {
      if (e.target.dataset.dismiss) return; // handled below
      const tab = b.dataset.notifTab;
      if (tab) notasModuleTab = tab;
      navigateTo(b.dataset.notifNav);
    });
  });
  document.querySelectorAll('[data-dismiss]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      dismissToday(alterId, btn.dataset.dismiss);
      const banner = btn.closest('.notif-banner');
      banner.style.animation = 'none';
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(-6px)';
      banner.style.transition = 'all 200ms ease';
      setTimeout(() => {
        banner.remove();
        // remove stack if empty
        const stack = document.querySelector('.notif-banner-stack');
        if (stack && !stack.children.length) stack.remove();
      }, 200);
    });
  });
}

// ── NOTIFICACIONES NATIVAS ──
const _nativeFired = new Set();

function nativeNotifSupported() {
  return 'Notification' in window;
}
function nativeNotifGranted() {
  return nativeNotifSupported() && Notification.permission === 'granted';
}
function nativeNotifBlocked() {
  return nativeNotifSupported() && Notification.permission === 'denied';
}

// Solicitar permiso — llamar solo desde gesto de usuario
async function requestNativeNotifPermission() {
  if (!nativeNotifSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  return result;
}

function webPushSupported() {
  return nativeNotifSupported() && 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

let _webPushEnsurePromise = null;
async function ensureOnlineWebPushSubscription() {
  if (!webPushSupported() || !nativeNotifGranted() || !hasOnlineBackendConfigured()) return false;
  const session = loadOnlineSession();
  if (!session?.authToken) return false;
  if (_webPushEnsurePromise) return _webPushEnsurePromise;
  _webPushEnsurePromise = (async () => {
    const pushConfig = await onlineFetch('/v1/push/public-key', { method: 'GET' });
    if (!pushConfig?.enabled || !pushConfig.publicKey) return false;
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey),
      });
    }
    await onlineFetch('/v1/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ ...subscription.toJSON(), preferences: getOnlinePushPreferencesFromNotifConfig() }),
    });
    const latestSession = loadOnlineSession();
    if (latestSession) saveOnlineSession({ ...latestSession, webPushSubscribedAt: new Date().toISOString() });
    return true;
  })().catch(err => {
    console.warn('ensureOnlineWebPushSubscription error:', err);
    return false;
  }).finally(() => {
    _webPushEnsurePromise = null;
  });
  return _webPushEnsurePromise;
}

function scheduleOnlineWebPushSubscription() {
  ensureOnlineWebPushSubscription().catch(err => console.warn('scheduleOnlineWebPushSubscription error:', err));
}

let _reminderPushSyncTimer = null;
function scheduleReminderPushSync() {
  clearTimeout(_reminderPushSyncTimer);
  _reminderPushSyncTimer = setTimeout(() => {
    syncReminderPushSchedule().catch(err => console.warn('syncReminderPushSchedule error:', err));
  }, 700);
}

async function syncReminderPushSchedule() {
  if (!hasOnlineBackendConfigured() || !loadOnlineSession()?.authToken) return false;
  const reminders = (typeof loadReminders === 'function' ? loadReminders() : [])
    .filter(r => r && !r.done && Number(r.datetime) > 0)
    .map(r => ({
      id: String(r.id || ''),
      datetime: Number(r.datetime || 0),
      recurrence: r.recurrence || 'none',
      done: !!r.done,
    }));
  await onlineFetch('/v1/reminders/push', {
    method: 'POST',
    body: JSON.stringify({ reminders }),
  });
  return true;
}

// ── Alarma local (sonido + vibración) para recordatorios vencidos ──
function formatOnlineNotifDiagTs(ts) {
  if (!ts) return '—';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es');
}

async function getServiceWorkerRegistrationFast() {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise(resolve => setTimeout(() => resolve(null), 1200)),
  ]).catch(() => null);
}

async function collectOnlineNotificationDiagnostics() {
  const session = loadOnlineSession();
  const hasBackend = hasOnlineBackendConfigured();
  const reg = await getServiceWorkerRegistrationFast();
  let browserSubscription = null;
  try {
    browserSubscription = reg?.pushManager ? await reg.pushManager.getSubscription() : null;
  } catch {}
  let publicKey = null;
  let server = null;
  if (hasBackend) {
    try { publicKey = await onlineFetch('/v1/push/public-key', { method: 'GET' }); } catch (e) { publicKey = { error: e?.message || String(e) }; }
    if (session?.authToken) {
      try { server = (await onlineFetch('/v1/push/diagnostics', { method: 'GET' }))?.diagnostics || null; } catch (e) { server = { error: e?.message || String(e) }; }
    }
  }
  return {
    browserOnline: navigator.onLine !== false,
    permission: nativeNotifSupported() ? Notification.permission : 'unsupported',
    swSupported: 'serviceWorker' in navigator,
    swReady: !!reg,
    swActive: !!reg?.active,
    pushSupported: webPushSupported(),
    browserSubscribed: !!browserSubscription,
    onlineEnabled: !!getOnlineProfile().enabled,
    hasBackend,
    hasSession: !!session?.authToken,
    sessionSubscribedAt: session?.webPushSubscribedAt || null,
    publicKey,
    server,
    localReminderItems: (typeof loadReminders === 'function' ? loadReminders() : []).filter(r => r && !r.done && Number(r.datetime) > 0).length,
  };
}

function renderOnlineNotificationDiagnostics(container) {
  if (!container) return;
  container.innerHTML = `<div style="padding:12px 20px;color:var(--text-3);font-size:12px">Comprobando notificaciones online...</div>`;
  collectOnlineNotificationDiagnostics().then(diag => {
    const status = (ok, warn = false) => ok ? ['OK', '#5fffb0'] : warn ? ['REVISAR', '#ffcf6f'] : ['NO', 'var(--text-3)'];
    const row = (label, value, tone = 'var(--text-2)') => `
      <div class="notif-config-row">
        <div class="notif-config-left"><div class="notif-config-label">${label}</div></div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:${tone};text-align:right">${value}</div>
      </div>`;
    const permissionTone = diag.permission === 'granted' ? '#5fffb0' : diag.permission === 'denied' ? '#ff8a8a' : '#ffcf6f';
    const vapidOk = !!diag.publicKey?.enabled && !!diag.publicKey?.publicKey;
    const vapidStatus = diag.publicKey?.error ? ['ERROR', '#ff8a8a'] : status(vapidOk, diag.hasBackend);
    const server = diag.server || {};
    const serverError = server.error ? String(server.error) : '';
    const subscribedOk = diag.browserSubscribed && !!server.deviceSubscribed;
    const subStatus = serverError ? ['ERROR', '#ff8a8a'] : status(subscribedOk, diag.hasSession && diag.pushSupported);
    const prefs = { ...getOnlinePushPreferencesFromNotifConfig(), ...(server.preferences || {}) };
    const prefRow = (key, label, sub) => `
      <div class="notif-config-row">
        <div class="notif-config-left">
          <div class="notif-config-label">${label}</div>
          <div class="notif-config-sub">${sub}</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="online-push-pref" data-push-pref="${key}" ${prefs[key] !== false ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>`;
    container.innerHTML = `
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:10px">
        <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
          <span style="font-size:14px">☁</span>
          <span style="font-size:13px;font-weight:700;flex:1">Notificaciones online</span>
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:${subStatus[1]}">${subStatus[0]}</span>
        </div>
        <div style="padding:4px 20px 8px">
          ${row('Permiso del navegador', diag.permission, permissionTone)}
          ${row('Service worker', diag.swSupported ? (diag.swReady ? (diag.swActive ? 'ACTIVO' : 'LISTO') : 'CARGANDO') : 'NO SOPORTADO', diag.swActive ? '#5fffb0' : '#ffcf6f')}
          ${row('Push del navegador', diag.pushSupported ? (diag.browserSubscribed ? 'SUSCRITO' : 'SIN SUSCRIPCION') : 'NO SOPORTADO', diag.browserSubscribed ? '#5fffb0' : '#ffcf6f')}
           ${row('Clave de notificaciones', vapidStatus[0], vapidStatus[1])}
          ${row('Sesion online', diag.hasSession ? 'ACTIVA' : 'SIN SESION', diag.hasSession ? '#5fffb0' : 'var(--text-3)')}
           ${row('Dispositivos registrados', serverError || `${server.deviceSubscriptions || 0} dispositivo / ${server.systemSubscriptions || 0} sistema`, serverError ? '#ff8a8a' : (server.deviceSubscribed ? '#5fffb0' : '#ffcf6f'))}
          ${row('Ultima suscripcion', formatOnlineNotifDiagTs(server.lastSubscribedAt || diag.sessionSubscribedAt))}
          ${row('Ultimo push', formatOnlineNotifDiagTs(server.lastPushSentAt))}
           ${row('Recordatorios sincronizados', `${server.reminderItems ?? 0} online / ${diag.localReminderItems} locales`)}
          ${row('Ultimo sync recordatorios', formatOnlineNotifDiagTs(server.lastReminderSyncAt))}
          ${row('Ultimo envio recordatorio', formatOnlineNotifDiagTs(server.lastReminderSentAt))}
          ${server.lastPushError ? row('Ultimo error push', `${server.lastPushError.status || 0} ${escM(server.lastPushError.message || '')}`, '#ff8a8a') : ''}
        </div>
        <div style="padding:4px 20px 8px;border-top:1px solid var(--border)">
          ${prefRow('message', 'Mensajes online', 'Push generico cuando llega un DM online')}
          ${prefRow('friend_request', 'Solicitudes de amistad', 'Push generico cuando llega una solicitud')}
          ${prefRow('reminder', 'Recordatorios', 'Push generico cuando vence un recordatorio sincronizado')}
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" id="btn-online-notif-refresh">Actualizar</button>
          <button class="btn btn-primary btn-sm" id="btn-online-notif-reconnect">Reconectar</button>
          <button class="btn btn-ghost btn-sm" data-online-push-test="message">Test mensaje</button>
          <button class="btn btn-ghost btn-sm" data-online-push-test="friend_request">Test amistad</button>
          <button class="btn btn-ghost btn-sm" data-online-push-test="reminder">Test recordatorio</button>
        </div>
      </div>`;
    container.querySelectorAll('.online-push-pref').forEach(chk => chk.addEventListener('change', async () => {
      const c = loadNotifConfig();
      const field = chk.dataset.pushPref === 'friend_request' ? 'onlinePushFriendRequest' : chk.dataset.pushPref === 'reminder' ? 'onlinePushReminder' : 'onlinePushMessage';
      c[field] = chk.checked;
      saveNotifConfig(c);
      try {
        await onlineFetch('/v1/push/preferences', { method: 'PATCH', body: JSON.stringify({ preferences: getOnlinePushPreferencesFromNotifConfig(c) }) });
        showToast(chk.checked ? 'Push activado' : 'Push desactivado');
      } catch (e) {
        showToast('Preferencia guardada localmente');
      }
      renderOnlineNotificationDiagnostics(container);
    }));
    container.querySelector('#btn-online-notif-refresh')?.addEventListener('click', () => renderOnlineNotificationDiagnostics(container));
    container.querySelector('#btn-online-notif-reconnect')?.addEventListener('click', async event => {
      const btn = event.currentTarget;
      btn.disabled = true;
      try {
        if (nativeNotifSupported() && Notification.permission === 'default') await requestNativeNotifPermission();
        const ok = await ensureOnlineWebPushSubscription();
        await syncReminderPushSchedule().catch(() => {});
        showToast(ok ? 'Notificaciones online reconectadas' : 'No se pudo completar la suscripcion push');
      } finally {
        btn.disabled = false;
        renderOnlineNotificationDiagnostics(container);
      }
    });
    container.querySelectorAll('[data-online-push-test]').forEach(btn => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const kind = btn.dataset.onlinePushTest || 'message';
        const result = (await onlineFetch('/v1/push/test', { method: 'POST', body: JSON.stringify({ kind }) }))?.result;
        showToast(result?.sent > 0 ? 'Push de prueba enviado' : 'No hay suscripcion push para este dispositivo');
      } catch (e) {
        showToast('No se pudo enviar el push de prueba');
      } finally {
        btn.disabled = false;
        renderOnlineNotificationDiagnostics(container);
      }
    }));
  }).catch(error => {
    container.innerHTML = `<div style="padding:12px 20px;color:#ff8a8a;font-size:12px">No se pudo leer el diagnostico online: ${escM(error?.message || String(error))}</div>`;
  });
}

let _alarmCtx = null;
function playAlarmSound() {
  try {
    if (!_alarmCtx) _alarmCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _alarmCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
    const tones = [880, 1100, 880];
    let t = ctx.currentTime;
    for (const freq of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
      t += 0.35;
    }
  } catch (e) {
    console.warn('playAlarmSound error:', e);
  }
}
let _activeReminderAlertKey = null;
function showDueReminderAlert(reminder, key) {
  if (!reminder || _activeReminderAlertKey === key || document.querySelector(`[data-reminder-due-key="${key}"]`)) return;
  _activeReminderAlertKey = key;
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.dataset.reminderDueKey = key;
  ov.innerHTML = `<div class="modal" style="max-width:420px">
    <div class="modal-title">${esc(reminder.icon || '🔔')} ${esc(reminder.title || 'Recordatorio')}</div>
    ${reminder.desc ? `<div style="font-size:13px;color:var(--text-2);line-height:1.5;margin:8px 0 16px">${esc(reminder.desc)}</div>` : `<div style="font-size:13px;color:var(--text-2);margin:8px 0 16px">Recordatorio vencido</div>`}
    <div class="modal-footer" style="gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost" data-reminder-snooze>Posponer 15 min</button>
      <button class="btn btn-primary" data-reminder-done>Marcar hecho</button>
    </div>
  </div>`;
  const close = () => { _activeReminderAlertKey = null; ov.remove(); };
  ov.querySelector('[data-reminder-snooze]')?.addEventListener('click', () => {
    const list = loadReminders();
    const r = list.find(x => x.id === reminder.id);
    if (r) r.snoozedUntil = Date.now() + 15 * 60 * 1000;
    saveReminders(list);
    showToast('Recordatorio pospuesto 15 min');
    close();
    if (currentView === 'recordatorios') renderReminders();
  });
  ov.querySelector('[data-reminder-done]')?.addEventListener('click', () => {
    const list = loadReminders();
    const r = list.find(x => x.id === reminder.id);
    if (r) {
      if (r.recurrence && r.recurrence !== 'none') {
        const dt = new Date(r.datetime);
        if (r.recurrence === 'every8h') dt.setTime(dt.getTime() + 8 * 3600 * 1000);
        if (r.recurrence === 'daily') dt.setDate(dt.getDate() + 1);
        if (r.recurrence === 'weekly') dt.setDate(dt.getDate() + 7);
        if (r.recurrence === 'monthly') dt.setMonth(dt.getMonth() + 1);
        r.datetime = dt.getTime();
        r.snoozedUntil = null;
      } else {
        r.done = true;
      }
    }
    saveReminders(list);
    close();
    if (currentView === 'recordatorios') renderReminders();
  });
  document.body.appendChild(ov);
}
function vibrateAlarm() {
  try {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
  } catch (e) {}
}

// Lanzar notificación nativa (vía SW si disponible, sino directa)
async function fireNativeNotif({ title, body, icon, tag, nav, tab }) {
  if (!nativeNotifGranted()) return;
  const privateNotifications = localStorage.getItem('tid_private_notifications') === '1';
  if (privateNotifications) {
    title = 'Atria';
    body = 'Tienes una nueva notificacion';
  }
  const payload = {
    title: title || 'Atria',
    body: body || '',
    icon: icon || '../assets/Icon/icon192x192.png',
    tag: tag || 'atria',
    data: { nav: nav || '/', tab: tab || null },
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.active) {
        reg.active.postMessage({ type: 'SHOW_NOTIFICATION', ...payload });
        return;
      }
    }
    // Fallback directo
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      tag: payload.tag,
    });
  } catch (e) {
    console.warn('fireNativeNotif error:', e);
  }
}

// Revisar recordatorios vencidos y lanzar notif nativa (una vez por id por sesión)
// Online chat live refresh and notifications live in online-chat.js after R6.

function getReminderDueOccurrenceTs(reminder, now = Date.now()) {
  const base = Number(reminder?.datetime || 0);
  if (!base || base > now) return null;
  const recurrence = reminder?.recurrence || 'none';
  if (!recurrence || recurrence === 'none') return base;
  if (recurrence === 'every8h') {
    return base + Math.floor((now - base) / (8 * 3600 * 1000)) * 8 * 3600 * 1000;
  }
  if (recurrence === 'daily') {
    return base + Math.floor((now - base) / 86400000) * 86400000;
  }
  if (recurrence === 'weekly') {
    return base + Math.floor((now - base) / (7 * 86400000)) * 7 * 86400000;
  }
  if (recurrence === 'monthly') {
    const dt = new Date(base);
    let guard = 0;
    while (guard < 240) {
      const next = new Date(dt.getTime());
      next.setMonth(next.getMonth() + 1);
      if (next.getTime() > now) return dt.getTime();
      dt.setMonth(dt.getMonth() + 1);
      guard += 1;
    }
    return dt.getTime();
  }
  return base;
}

function checkAndFireReminderNotifs() {
  const now = Date.now();
  const reminders = loadReminders().filter(r =>
    !r.done &&
    r.datetime <= now &&
    (!r.snoozedUntil || r.snoozedUntil <= now) &&
    (!r.alterId || r.alterId === activeAlter?.id)
  );
  for (const r of reminders) {
    const occurrenceTs = getReminderDueOccurrenceTs(r, now);
    if (!occurrenceTs) continue;
    const key = `rem_${r.id}_${occurrenceTs}`;
    if (_nativeFired.has(key)) continue;
    _nativeFired.add(key);
    playAlarmSound();
    vibrateAlarm();
    showDueReminderAlert(r, key);
    if (nativeNotifGranted()) {
      fireNativeNotif({
        title: r.icon ? `${r.icon} ${r.title}` : r.title,
        body: r.desc || 'Recordatorio vencido',
        tag: key,
        nav: 'recordatorios',
      });
    }
  }
}

// Revisar banners del hub (agenda, solicitudes, normas, backup) — una vez por clave por sesión
function checkAndFireHubNotifs() {
  if (!nativeNotifGranted() || !activeAlter) return;
  const notifs = computeNotifs(activeAlter.id);
  for (const n of notifs) {
    const key = 'hub_' + n.key + '_' + activeAlter.id;
    if (_nativeFired.has(key)) continue;
    _nativeFired.add(key);
    fireNativeNotif({
      title: n.title,
      body: n.sub,
      tag: 'atria_' + n.key,
      nav: n.nav,
      tab: n.tab,
    });
  }
}

// Scheduler principal — llamado al arrancar la app
let _notifInterval = null;
function startNotifScheduler() {
  if (_notifInterval) return; // ya en marcha
  // Primera comprobación tras un pequeño delay (activeAlter necesita estar listo)
  setTimeout(() => {
    checkAndFireReminderNotifs();
    checkAndFireHubNotifs();
  }, 1500);
  // Luego cada 60 segundos
  _notifInterval = setInterval(() => {
    checkAndFireReminderNotifs();
    checkAndFireHubNotifs();
  }, 60000);
}

// Escuchar mensajes del SW (click en notif → navegar)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'NOTIF_NAV' && event.data.nav) {
      _pendingNotifNav = event.data.nav;
      _pendingNotifTab = event.data.tab || null;
      processPendingNotifRoute();
    }
  });
}

// ── NOTIFICACIONES CONFIG (dentro de Configuración) ──
function renderNotifConfig(container) {
  const cfg = loadNotifConfig();

  const items = [
    { key:'agenda',      icon:'◷', color:'#ffb450', label:'Eventos próximos',         sub:'Eventos de hoy y mañana en la Agenda' },
    { key:'solicitudes', icon:'◱', color:'#a08aff', label:'Solicitudes pendientes',   sub:'Peticiones sin respuesta dirigidas a este alter' },
    { key:'normas',      icon:'◳', color:'#8ab4ff', label:'Normas pendientes de voto',sub:'Propuestas que aún no has votado' },
    { key:'backup',      icon:'◬', color:'#ffb450', label:'Exportación opcional',   sub:'Aviso por si quieres guardar una copia externa manual' },
  ];

  // Estado del permiso nativo
  const supported = nativeNotifSupported();
  const granted   = nativeNotifGranted();
  const blocked   = nativeNotifBlocked();

  let permBlock = '';
  if (!supported) {
    permBlock = `
      <div style="padding:12px 20px;display:flex;align-items:center;gap:10px;opacity:.6">
        <span style="font-size:18px">🚫</span>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-1)">No disponible en este navegador</div>
          <div style="font-size:11px;color:var(--text-3)">Las notificaciones nativas no están soportadas aquí</div>
        </div>
      </div>`;
  } else if (blocked) {
    permBlock = `
      <div style="padding:12px 20px;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">🔕</span>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:#ff6b8a">Notificaciones bloqueadas</div>
          <div style="font-size:11px;color:var(--text-3)">Permiso bloqueado: abre la configuración del sitio en tu navegador, permite notificaciones y vuelve a Atria.</div>
        </div>
      </div>`;
  } else if (granted) {
    permBlock = `
      <div style="padding:12px 20px;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">🔔</span>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:#8affe0">Notificaciones activadas</div>
          <div style="font-size:11px;color:var(--text-3)">Los recordatorios y alertas llegarán aunque la app esté en segundo plano</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-test-notif">Probar</button>
      </div>`;
  } else {
    permBlock = `
      <div style="padding:12px 20px;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">🔔</span>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:var(--text-1)">Notificaciones del sistema</div>
          <div style="font-size:11px;color:var(--text-3)">Activa el permiso desde este botón para recibir recordatorios aunque la app esté en segundo plano.</div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-request-notif-perm">Activar</button>
      </div>`;
  }

  container.innerHTML = `
    <div class="config-section-header">
      <div class="config-section-icon">◬</div>
      <div class="config-section-title">Notificaciones</div>
    </div>
    <div class="config-rows">
    <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:10px">
      <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <span style="font-size:14px">🔔</span>
        <span style="font-size:13px;font-weight:700;flex:1">Notificaciones nativas</span>
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${granted?'activo':'sistema'}</span>
      </div>
      ${permBlock}
    </div>
    <div id="online-notif-diagnostics"></div>
    <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
      <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <span style="font-size:14px">◬</span>
        <span style="font-size:13px;font-weight:700;flex:1">Alertas del Hub</span>
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">Banners al entrar</span>
      </div>
      <div style="padding:4px 20px 8px">
        ${items.map(item => `
          <div class="notif-config-row">
            <div class="notif-config-left">
              <div class="notif-config-label" style="display:flex;align-items:center;gap:7px">
                <span style="color:${item.color}">${item.icon}</span>${item.label}
              </div>
              <div class="notif-config-sub">${item.sub}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" class="notif-toggle" data-nkey="${item.key}" ${cfg[item.key]?'checked':''}>
              <span class="toggle-slider"></span>
            </label>
          </div>`).join('')}
      </div>
    </div>`;
  renderOnlineNotificationDiagnostics(container.querySelector('#online-notif-diagnostics'));

  container.querySelectorAll('.notif-toggle').forEach(chk => {
    chk.addEventListener('change', () => {
      const c = loadNotifConfig();
      c[chk.dataset.nkey] = chk.checked;
      saveNotifConfig(c);
      showToast(chk.checked ? 'Notificación activada ✓' : 'Notificación desactivada');
    });
  });

  // ── DND ──
  const dndSection = document.createElement('div');
  dndSection.style.cssText='background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-top:10px';
  dndSection.innerHTML = `
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
      <span style="font-size:14px">🌙</span>
      <span style="font-size:13px;font-weight:700;flex:1">Horario de silencio (DND)</span>
    </div>
    <div style="padding:12px 20px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:12px;color:var(--text-1)">Activar silencio automático</div>
          <div style="font-size:11px;color:var(--text-3)">No se muestran alertas en el rango horario indicado</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" id="dnd-enabled" ${cfg.dndEnabled?'checked':''}><span class="toggle-slider"></span></label>
      </div>
      <div style="display:flex;gap:12px;align-items:center" id="dnd-time-row" style="display:${cfg.dndEnabled?'flex':'none'}">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--text-3)">Desde</span>
          <input type="time" id="dnd-from" value="${cfg.dndFrom||'23:00'}" style="font-family:'DM Mono',monospace;font-size:12px;padding:4px 8px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;color:var(--text-1)">
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--text-3)">Hasta</span>
          <input type="time" id="dnd-to" value="${cfg.dndTo||'08:00'}" style="font-family:'DM Mono',monospace;font-size:12px;padding:4px 8px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;color:var(--text-1)">
        </div>
      </div>
    </div>`;
  container.appendChild(dndSection);

  // ── REGLA CONDICIONAL ──
  const altersAll = getAlters();
  const ruleSection = document.createElement('div');
  ruleSection.style.cssText='background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-top:10px';
  ruleSection.innerHTML = `
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
      <span style="font-size:14px">◉</span>
      <span style="font-size:13px;font-weight:700;flex:1">Regla condicional de fronting</span>
    </div>
    <div style="padding:12px 20px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:12px;color:var(--text-1)">Notificar solo si un alter específico está al frente</div>
          <div style="font-size:11px;color:var(--text-3)">Las alertas solo aparecen cuando ese alter fronts</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" id="front-rule-enabled" ${cfg.frontingRuleEnabled?'checked':''}><span class="toggle-slider"></span></label>
      </div>
      <div id="front-rule-alter-row" style="display:${cfg.frontingRuleEnabled?'block':'none'}">
        <select id="front-rule-alter" style="width:100%;padding:7px 10px;background:var(--bg-2);border:1px solid var(--border);border-radius:7px;color:var(--text-1)">
          ${altersAll.map(a=>`<option value="${a.id}" ${cfg.frontingRuleAlterId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
    </div>`;
  container.appendChild(ruleSection);

  // Wire DND
  container.querySelector('#dnd-enabled')?.addEventListener('change', e => {
    const c = loadNotifConfig(); c.dndEnabled = e.target.checked; saveNotifConfig(c);
    const row = container.querySelector('#dnd-time-row');
    if (row) row.style.display = e.target.checked ? 'flex' : 'none';
  });
  container.querySelector('#dnd-from')?.addEventListener('change', e => {
    const c = loadNotifConfig(); c.dndFrom = e.target.value; saveNotifConfig(c);
  });
  container.querySelector('#dnd-to')?.addEventListener('change', e => {
    const c = loadNotifConfig(); c.dndTo = e.target.value; saveNotifConfig(c);
  });
  // Wire fronting rule
  container.querySelector('#front-rule-enabled')?.addEventListener('change', e => {
    const c = loadNotifConfig(); c.frontingRuleEnabled = e.target.checked; saveNotifConfig(c);
    const row = container.querySelector('#front-rule-alter-row');
    if (row) row.style.display = e.target.checked ? 'block' : 'none';
  });
  container.querySelector('#front-rule-alter')?.addEventListener('change', e => {
    const c = loadNotifConfig(); c.frontingRuleAlterId = e.target.value; saveNotifConfig(c);
  });

  // Show DND time row based on current state
  const dndRow = container.querySelector('#dnd-time-row');
  if (dndRow) dndRow.style.display = cfg.dndEnabled ? 'flex' : 'none';

  // Botón solicitar permiso
  container.querySelector('#btn-request-notif-perm')?.addEventListener('click', async () => {
    const result = await requestNativeNotifPermission();
    if (result === 'granted') {
      showToast('¡Notificaciones activadas! ✓');
      startNotifScheduler();
      scheduleOnlineWebPushSubscription();
      renderNotifConfig(container);
    } else if (result === 'denied') {
        showToast('Permiso bloqueado — permite notificaciones en la configuración del sitio');
      renderNotifConfig(container);
    }
  });

  // Botón de prueba de notificación push con icono de Atria
  container.querySelector('#btn-test-notif')?.addEventListener('click', () => {
    fireNativeNotif({
      title: 'Atria · Prueba ✓',
      body: 'Las notificaciones funcionan correctamente',
      tag: 'atria-test',
      nav: 'notif',
    });
    showToast('Notificación de prueba enviada');
  });
}

// ═══════════════════════════════════════════════
// SEGURIDAD
// ═══════════════════════════════════════════════

// ── PIN HELPERS ──
const PIN_STORAGE_KEY   = 'tid_pin_hash';
const PIN_SALT_KEY      = 'tid_pin_salt';
const PIN_ENABLED_KEY   = 'tid_pin_enabled';
const SESSION_UNLOCKED_KEY = 'tid_session_unlocked'; // sessionStorage — clears on tab close
const PIN_RECOVERY_KEY  = 'tid_pin_recovery'; // { question, answerHash, salt }
const AUTO_LOCK_KEY     = 'tid_auto_lock_background';
const PIN_KEYS = [PIN_STORAGE_KEY, PIN_ENABLED_KEY, SESSION_UNLOCKED_KEY, PIN_RECOVERY_KEY];

function getPinEnabled()  { return localStorage.getItem(PIN_ENABLED_KEY) === '1'; }
function setPinEnabled(v) { localStorage.setItem(PIN_ENABLED_KEY, v ? '1' : '0'); }
function getStoredPinHash()  { return localStorage.getItem(PIN_STORAGE_KEY) || ''; }
function setStoredPinHash(h) { localStorage.setItem(PIN_STORAGE_KEY, h); }
function isSessionUnlocked() { return sessionStorage.getItem(SESSION_UNLOCKED_KEY) === '1'; }
function markSessionUnlocked() { sessionStorage.setItem(SESSION_UNLOCKED_KEY, '1'); }
function clearSessionUnlock()  { sessionStorage.removeItem(SESSION_UNLOCKED_KEY); }
function hasStoredPinConfig() { return getStoredPinHash().trim().length > 0; }
function clearBrokenPinState() {
  setPinEnabled(false);
  localStorage.removeItem(PIN_STORAGE_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
  localStorage.removeItem(PIN_ENABLED_KEY);
  clearPinRecovery();
}

// ── PIN CRYPTO ──
// PBKDF2-SHA256 with 100 000 iterations. Returns hex string.
async function hashPinAsync(pin, saltHex) {
  const enc  = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/../g), h => parseInt(h, 16));
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    base, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generatePinSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(PIN_SALT_KEY, hex);
  return hex;
}

function getOrCreatePinSalt() {
  return localStorage.getItem(PIN_SALT_KEY) || generatePinSalt();
}

// Detect legacy djb2 hash (8 hex chars) produced by the old hashPin()
function isLegacyPinHash(h) { return h.length === 8; }

// ── RECOVERY HELPERS ──
function getPinRecovery() {
  try { return JSON.parse(localStorage.getItem(PIN_RECOVERY_KEY)) || null; } catch { return null; }
}
async function setPinRecovery(question, answer) {
  const salt = generatePinSalt(); // fresh salt for recovery answer
  const answerHash = await hashPinAsync(answer.trim().toLowerCase(), salt);
  const recovery = getPinRecovery();
  localStorage.setItem(PIN_RECOVERY_KEY, JSON.stringify({
    question,
    answerHash,
    salt,
    // keep existing pin salt separate — recovery uses its own salt
    pinSalt: recovery?.pinSalt || getOrCreatePinSalt()
  }));
}
function clearPinRecovery() { localStorage.removeItem(PIN_RECOVERY_KEY); }

// ── PIN LOCK SCREEN ──
function showPinLock(onSuccess) {
  let entered = '';
  const digits = 4;
  let attempt = 0;
  let inRecovery = false;

  const el = document.createElement('div');
  el.id = 'pin-lock-screen';

  function renderLock() {
    el.innerHTML = `
    <div class="pin-lock-inner">
      <div class="pin-lock-logo">🔒</div>
      <div class="pin-lock-title">Atria</div>
      <div class="pin-lock-sub">Introduce tu PIN para continuar</div>
      <div class="pin-dots">
        ${Array(digits).fill('<div class="pin-dot"></div>').join('')}
      </div>
      <div class="pin-error-msg" id="pin-err"></div>
      <div class="pin-pad">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k=>`
          <button class="pin-key${k===''?' invisible':k==='⌫'?' del':''}" data-key="${k}">${k}</button>
        `).join('')}
      </div>
      ${attempt >= 3 ? `<button class="btn btn-ghost" id="btn-forgot-pin" style="margin-top:8px;font-size:12px;color:var(--text-3)">¿Olvidaste el PIN?</button>` : ''}
    </div>`;

    el.querySelectorAll('.invisible').forEach(b => { b.style.visibility='hidden'; b.disabled=true; });

    function updateDots() {
      el.querySelectorAll('.pin-dot').forEach((d,i) => {
        d.classList.toggle('filled', i < entered.length);
        d.classList.remove('error');
      });
      el.querySelector('#pin-err').textContent = '';
    }

    function shakeError(msg) {
      el.querySelectorAll('.pin-dot').forEach(d => { d.classList.remove('filled'); d.classList.add('error'); });
      el.querySelector('#pin-err').textContent = msg;
      setTimeout(()=>{ entered=''; updateDots(); }, 600);
    }

    async function tryPin() {
      const storedHash = getStoredPinHash();
      if (isLegacyPinHash(storedHash)) {
        // Old djb2 hash detected — force re-enrolment
        setPinEnabled(false);
        localStorage.removeItem(PIN_STORAGE_KEY);
        localStorage.removeItem(PIN_SALT_KEY);
        clearPinRecovery();
        el.remove();
        showToast('⚠ PIN antiguo detectado por seguridad — configura uno nuevo en Seguridad');
        onSuccess();
        return;
      }
      const salt = getOrCreatePinSalt();
      const hash = await hashPinAsync(entered, salt);
      if (hash === storedHash) {
        markSessionUnlocked();
        document.removeEventListener('keydown', onKey);
        el.remove();
        onSuccess();
      } else {
        attempt++;
        shakeError(attempt >= 3 ? `PIN incorrecto (intento ${attempt})` : 'PIN incorrecto');
        setTimeout(() => { if (!inRecovery) renderLock(); }, 700); // re-render to show/hide forgot button
      }
    }

    el.querySelectorAll('.pin-key:not(.invisible)').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.key;
        if (k === '⌫') { entered = entered.slice(0,-1); updateDots(); }
        else if (entered.length < digits) {
          entered += k; updateDots();
          if (entered.length === digits) setTimeout(tryPin, 80);
        }
      });
    });

    el.querySelector('#btn-forgot-pin')?.addEventListener('click', () => { inRecovery = true; showPinRecovery(el, onSuccess); });
  }

  renderLock();
  document.body.appendChild(el);

  function onKey(e) {
    if (e.key >= '0' && e.key <= '9' && entered.length < digits) {
      entered += e.key;
      el.querySelectorAll('.pin-dot').forEach((d,i) => d.classList.toggle('filled', i < entered.length));
      if (entered.length === digits) setTimeout(() => tryPin(), 80);
    } else if (e.key === 'Backspace') {
      entered = entered.slice(0,-1);
      el.querySelectorAll('.pin-dot').forEach((d,i) => d.classList.toggle('filled', i < entered.length));
    }
  }
  document.addEventListener('keydown', onKey);
  el._cleanup = () => document.removeEventListener('keydown', onKey);
}

// ── PIN RECOVERY SCREEN ──
function showPinRecovery(lockEl, onSuccess) {
  const recovery = getPinRecovery();

  // No recovery question set → ir directo a opción nuclear
  if (!recovery) {
    showPinNuclear(lockEl, onSuccess);
    return;
  }

  lockEl.innerHTML = `
    <div class="pin-lock-inner">
      <div class="pin-lock-logo">🔑</div>
      <div class="pin-lock-title">Recuperar acceso</div>
      <div class="pin-lock-sub" style="text-align:center;max-width:260px">${escC(recovery.question)}</div>
      <input type="text" id="rec-answer" placeholder="Tu respuesta…"
        style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:14px;width:100%;box-sizing:border-box;margin-top:4px">
      <div class="pin-error-msg" id="rec-err"></div>
      <div style="display:flex;gap:8px;margin-top:8px;width:100%">
        <button class="btn btn-ghost" id="btn-rec-back" style="flex:1">← Volver</button>
        <button class="btn btn-primary" id="btn-rec-submit" style="flex:2">Verificar</button>
      </div>
      <button class="btn btn-ghost" id="btn-rec-nuclear" style="margin-top:16px;font-size:11px;color:var(--red);border-color:rgba(255,80,80,.3)">No recuerdo la respuesta…</button>
    </div>`;

  lockEl.querySelector('#btn-rec-back').addEventListener('click', () => {
    lockEl._cleanup?.();
    lockEl.querySelector('.pin-lock-inner').remove();
    // Re-render lock
    lockEl.innerHTML = '';
    showPinLock(onSuccess);
    lockEl.remove();
  });

  lockEl.querySelector('#btn-rec-submit').addEventListener('click', async () => {
    const ans = lockEl.querySelector('#rec-answer').value.trim().toLowerCase();
    if (!ans) return;
    // Use the salt stored with the recovery entry (new format), fallback to pin salt for legacy entries
    const recSalt = recovery.salt || recovery.pinSalt || getOrCreatePinSalt();
    const ansHash = await hashPinAsync(ans, recSalt);
    if (ansHash === recovery.answerHash) {
      // Respuesta correcta → resetear PIN
      setPinEnabled(false);
      localStorage.removeItem(PIN_STORAGE_KEY);
      localStorage.removeItem(PIN_SALT_KEY);
      clearPinRecovery();
      markSessionUnlocked();
      lockEl._cleanup?.();
      lockEl.remove();
      showToast('Respuesta correcta. PIN eliminado — configura uno nuevo en Seguridad ✓');
      onSuccess();
    } else {
      lockEl.querySelector('#rec-err').textContent = 'Respuesta incorrecta';
      lockEl.querySelector('#rec-answer').value = '';
    }
  });

  lockEl.querySelector('#rec-answer').addEventListener('keydown', e => {
    if (e.key === 'Enter') lockEl.querySelector('#btn-rec-submit').click();
  });

  lockEl.querySelector('#btn-rec-nuclear').addEventListener('click', () => showPinNuclear(lockEl, onSuccess));
}

// ── NUCLEAR OPTION (borrar todo) ──
function showPinNuclear(lockEl, onSuccess) {
  lockEl.innerHTML = `
    <div class="pin-lock-inner">
      <div class="pin-lock-logo">⚠</div>
      <div class="pin-lock-title" style="color:var(--red)">Borrar todo</div>
      <div class="pin-lock-sub" style="text-align:center;max-width:260px;color:var(--text-2)">
        Esta acción eliminará <strong style="color:var(--text-0)">todos los datos</strong> de Atria de forma irreversible. No se puede deshacer.
      </div>
      <div style="width:100%;margin-top:8px">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:6px;font-family:'DM Mono',monospace">Escribe BORRAR para confirmar</div>
        <input type="text" id="nuke-confirm" placeholder="BORRAR"
          style="background:var(--bg-2);border:1px solid rgba(255,80,80,.4);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:14px;width:100%;box-sizing:border-box">
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;width:100%">
        <button class="btn btn-ghost" id="btn-nuke-back" style="flex:1">← Volver</button>
        <button class="btn btn-danger" id="btn-nuke-confirm" style="flex:2">Borrar todo</button>
      </div>
    </div>`;

  lockEl.querySelector('#btn-nuke-back').addEventListener('click', () => {
    lockEl._cleanup?.();
    lockEl.innerHTML = '';
    showPinLock(onSuccess);
    lockEl.remove();
  });

  lockEl.querySelector('#btn-nuke-confirm').addEventListener('click', () => {
    const val = lockEl.querySelector('#nuke-confirm').value.trim();
    if (val !== 'BORRAR') {
      lockEl.querySelector('#nuke-confirm').style.borderColor = 'var(--red)';
      lockEl.querySelector('#nuke-confirm').placeholder = 'Escribe BORRAR exactamente';
      return;
    }
    wipeAllData();
    lockEl._cleanup?.();
    lockEl.remove();
    showToast('Datos eliminados. Puedes empezar de nuevo.');
    onSuccess();
  });
}

// ── CHECK PIN ON APP START ──
function checkPinOnStart(proceed) {
  if (getPinEnabled() && !hasStoredPinConfig()) {
    clearBrokenPinState();
    proceed();
    return;
  }
  if (!getPinEnabled() || isSessionUnlocked()) { proceed(); return; }
  showPinLock(proceed);
}

let _hiddenSince = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (getPinEnabled() && localStorage.getItem(AUTO_LOCK_KEY) === '1') _hiddenSince = Date.now();
    return;
  }
  if (!_hiddenSince || !getPinEnabled()) return;
  _hiddenSince = 0;
  clearSessionUnlock();
  if (!document.getElementById('pin-lock-screen')) showPinLock(() => {});
});

// ── XOR CIPHER (obfuscation only) ──
function xorCipher(str, key) {
  let result = '';
  for (let i = 0; i < str.length; i++)
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return result;
}
function toB64(str)   { return btoa(unescape(encodeURIComponent(str))); }
function fromB64(str) { try { return decodeURIComponent(escape(atob(str))); } catch { return null; } }
function bytesToB64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function b64ToBytes(str) {
  try {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}
const BACKUP_KDF_ITERATIONS = 250000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
function getCryptoApi() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error('Este navegador no soporta cifrado seguro para backups.');
  return cryptoApi;
}
async function deriveBackupKey(password, salt, usages) {
  const cryptoApi = getCryptoApi();
  const baseKey = await cryptoApi.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: BACKUP_KDF_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages
  );
}
async function encryptBackupData(json, password) {
  const cryptoApi = getCryptoApi();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt, ['encrypt']);
  const cipherBuffer = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(json));
  return {
    v: 2,
    encrypted: true,
    kdf: 'PBKDF2',
    cipher: 'AES-GCM',
    iterations: BACKUP_KDF_ITERATIONS,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    data: bytesToB64(new Uint8Array(cipherBuffer)),
  };
}
async function decryptBackupPayload(payload, password) {
  if (!payload?.encrypted) {
    if (typeof payload?.data !== 'string') throw new Error('Formato inválido');
    const raw = fromB64(payload.data);
    if (raw === null) throw new Error('Error de decodificación');
    return raw;
  }
  if (!password) throw new Error('Este backup está cifrado. Introduce la contraseña.');
  if (payload.cipher === 'AES-GCM') {
    const salt = b64ToBytes(payload.salt || '');
    const iv = b64ToBytes(payload.iv || '');
    const cipherBytes = b64ToBytes(payload.data || '');
    if (!salt || !iv || !cipherBytes) throw new Error('Backup cifrado inválido');
    try {
      const key = await deriveBackupKey(password, salt, ['decrypt']);
      const plainBuffer = await getCryptoApi().subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
      return textDecoder.decode(plainBuffer);
    } catch {
      throw new Error('Contraseña incorrecta o backup corrupto');
    }
  }
  throw new Error('Formato de cifrado no soportado — backup no puede descifrarse');
}

const TID_KEYS = ['tid_alters', 'tid_config', 'tid_events', 'tid_channels', 'tid_messages', 'tid_diary', 'tid_notas', 'tid_solicitudes', 'tid_wishes', 'tid_proyectos', 'tid_tareas', 'tid_templates', 'tid_normas', 'tid_polls', 'tid_actividad', 'tid_salud_triggers', 'tid_alergias', 'tid_medicaciones', 'tid_med_intake', 'tid_timeline', 'tid_cambios', 'tid_integracion', 'tid_contactos', 'tid_recursos', 'tid_documentos', 'tid_protocolos', 'tid_tecnicas', 'tid_contactos_e', 'tid_calm_msg', 'tid_fronting', 'tid_tablon', 'tid_alter_fichas', 'tid_enc_enabled', 'tid_last_backup', 'tid_tracker', 'tid_reminders', 'tid_front_presets', 'tid_system_state', 'tid_moods', 'tid_crisis_log', 'tid_notif_config', 'tid_routines', 'tid_routine_log', 'tid_front_schedule', 'tid_subsystems', 'tid_custom_role_types', 'tid_headspace_rooms', 'tid_headspace_presence', 'tid_internal_relationships', 'tid_emotional_snapshots'];
// Finance data is stored per-alter via storageKey(): tid_{alterId}_transactions/ahorros/presupuestos
// These are handled explicitly in exportBackup/wipeAllData/WIPE_GROUPS

// ── PURGE ALTER DATA ──
// Called on alter delete. Removes per-alter keys and orphaned refs in shared stores.
function purgeAlterData(alterId) {
  // 1. Per-alter localStorage keys (exclusive data — delete)
  [`tid_calm_msg_${alterId}`, `tid_${alterId}_transactions`, `tid_${alterId}_ahorros`,
   `tid_${alterId}_presupuestos`, `tid_${alterId}_categories`
  ].forEach(k => localStorage.removeItem(k));

  // 2. Shared stores: null out the alterId reference so data is not lost
  saveEntries(loadEntries().map(e => e.alterId === alterId ? { ...e, alterId: null } : e));
  saveNotas(loadNotas().map(n => n.alterId === alterId ? { ...n, alterId: null } : n));
  saveTareas(loadTareas().map(t => t.alterId === alterId ? { ...t, alterId: null } : t));
  saveEvents(loadEvents().map(e => e.alterId === alterId ? { ...e, alterId: null } : e));
  saveCrisisLog(loadCrisisLog().map(e => e.alterId === alterId ? { ...e, alterId: null } : e));
  saveSaludTriggers(loadSaludTriggers().map(t => t.alterId === alterId ? { ...t, alterId: null } : t));
  saveReminders(loadReminders().map(r => r.alterId === alterId ? { ...r, alterId: null } : r));

  // 3. Tracker and fronting: remove entries tied exclusively to this alter
  saveTracker(loadTracker().filter(e => e.alterId !== alterId));
  saveFronting(
    loadFronting()
      .filter(s => s.alterId !== alterId)
      .map(s => ({ ...s, coFronting: (s.coFronting || []).filter(id => id !== alterId) }))
  );
}

// ── CSV EXPORT ──
function downloadCSV(rows, filename) {
  const escape = v => { const s = v==null?'':String(v); return s.includes(',')||s.includes('"')||s.includes('\n') ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const csv = rows.map(r=>r.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}

function downloadTextFile(text, filename, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function icsEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function icsFold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

function icsLocalStamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function icsDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`;
}

function icsDateOnlyEnd(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return icsDate(d);
}

function icsRRule(recur) {
  const rules = {daily:'FREQ=DAILY',weekly:'FREQ=WEEKLY',monthly:'FREQ=MONTHLY',yearly:'FREQ=YEARLY',every8h:'FREQ=HOURLY;INTERVAL=8'};
  return rules[recur] || '';
}

function reminderDateTime(reminder) {
  if (Number(reminder.datetime) > 0) return new Date(Number(reminder.datetime));
  if (reminder.date) return new Date(`${reminder.date}T${reminder.time || '09:00'}:00`);
  return null;
}

function eventDescription(ev, alters) {
  const names = getEventAlterIds(ev).map(id => alters.find(a => a.id === id)?.name).filter(Boolean);
  const parts = [];
  if (ev.note) parts.push(ev.note);
  if (names.length) parts.push(`Alter: ${names.join(', ')}`);
  if (ev.scope === 'compartido') parts.push('Compartido');
  return parts.join('\n');
}

function buildAgendaICS(from, to) {
  const alters = getAlters();
  const now = new Date();
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null;
  const inRange = ms => (!fromMs || ms >= fromMs) && (!toMs || ms <= toMs);
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Atria//Agenda v0.13//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Atria Agenda'];

  loadEvents().forEach(ev => {
    if (!ev || !ev.date) return;
    const baseMs = new Date(`${ev.date}T${ev.time || '12:00'}:00`).getTime();
    if (!inRange(baseMs)) return;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${icsEscape(`event-${ev.id || baseMs}@atria.local`)}`);
    lines.push(`DTSTAMP:${icsLocalStamp(now)}`);
    lines.push(icsFold(`SUMMARY:${icsEscape(ev.title || 'Evento Atria')}`));
    const desc = eventDescription(ev, alters);
    if (desc) lines.push(icsFold(`DESCRIPTION:${icsEscape(desc)}`));
    if (ev.allDay || !ev.time) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(new Date(`${ev.date}T12:00:00`))}`);
      lines.push(`DTEND;VALUE=DATE:${icsDateOnlyEnd(ev.date)}`);
    } else {
      const start = new Date(`${ev.date}T${ev.time}:00`);
      const end = new Date(start.getTime() + Math.max(5, Number(ev.duration) || 60) * 60000);
      lines.push(`DTSTART:${icsLocalStamp(start)}`);
      lines.push(`DTEND:${icsLocalStamp(end)}`);
    }
    const rrule = icsRRule(ev.recur);
    if (rrule) lines.push(`RRULE:${rrule}`);
    if (Number(ev.reminderMins) > 0) {
      lines.push('BEGIN:VALARM','ACTION:DISPLAY',`TRIGGER:-PT${Math.max(1, Number(ev.reminderMins))}M`,icsFold(`DESCRIPTION:${icsEscape(ev.title || 'Evento Atria')}`),'END:VALARM');
    }
    lines.push('END:VEVENT');
  });

  loadReminders().forEach(rem => {
    if (!rem || rem.done) return;
    const dt = reminderDateTime(rem);
    if (!dt || Number.isNaN(dt.getTime()) || !inRange(dt.getTime())) return;
    const end = new Date(dt.getTime() + 15 * 60000);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${icsEscape(`reminder-${rem.id || dt.getTime()}@atria.local`)}`);
    lines.push(`DTSTAMP:${icsLocalStamp(now)}`);
    lines.push(icsFold(`SUMMARY:${icsEscape(rem.title || 'Recordatorio Atria')}`));
    if (rem.desc || rem.note) lines.push(icsFold(`DESCRIPTION:${icsEscape(rem.desc || rem.note)}`));
    lines.push(`DTSTART:${icsLocalStamp(dt)}`);
    lines.push(`DTEND:${icsLocalStamp(end)}`);
    const rrule = icsRRule(rem.recurrence || rem.recur);
    if (rrule) lines.push(`RRULE:${rrule}`);
    lines.push('BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0M',icsFold(`DESCRIPTION:${icsEscape(rem.title || 'Recordatorio Atria')}`),'END:VALARM');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

async function exportAgendaICS(from, to) {
  const ics = buildAgendaICS(from, to);
  const count = (ics.match(/BEGIN:VEVENT/g) || []).length;
  const filename = `atria-agenda-${new Date().toISOString().slice(0,10)}.ics`, file = new File([ics], filename, {type:'text/calendar'});
  const warning = 'El archivo puede contener nombres de alters, notas y detalles de eventos. Se compartirá con la aplicación o persona que elijas. ¿Continuar?';
  if (!confirm(warning)) return;
  if (navigator.share && navigator.canShare?.({files:[file]})) {
    try { await navigator.share({files:[file], title:'Agenda Atria', text:'Calendario exportado desde Atria'}); showToast(`${count} elementos compartidos con el calendario`); return; } catch (error) { if (error?.name === 'AbortError') return; }
  }
  downloadTextFile(ics, filename, 'text/calendar;charset=utf-8');
  showToast(`${count} elementos exportados a calendario`);
}

function openCSVRangeModal(title, exportFn, actionLabel = '↓ Exportar CSV') {
  const today = new Date().toISOString().slice(0,10);
  const y1 = new Date(); y1.setFullYear(y1.getFullYear()-1);
  const defFrom = y1.toISOString().slice(0,10);
  openModal(`
    <div class="modal-header"><span>${title}</span><button class="modal-close" id="crm-close">✕</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label class="field-label">Desde</label><input id="crm-from" class="input" type="date" value="${defFrom}"></div>
        <div><label class="field-label">Hasta</label><input id="crm-to" class="input" type="date" value="${today}"></div>
      </div>
      <div style="font-size:12px;color:var(--text-3)">Deja ambos campos vacíos para exportar todo.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" id="crm-all">Todo</button>
        <button class="btn btn-primary" id="crm-ok">${actionLabel}</button>
      </div>
    </div>`);
  document.getElementById('crm-close')?.addEventListener('click', closeModal);
  document.getElementById('crm-all')?.addEventListener('click', ()=>{
    document.getElementById('crm-from').value='';
    document.getElementById('crm-to').value='';
  });
  document.getElementById('crm-ok')?.addEventListener('click', ()=>{
    const from = document.getElementById('crm-from').value || null;
    const to   = document.getElementById('crm-to').value   || null;
    closeModal();
    exportFn(from, to);
  });
}

function exportFrontingCSV(from, to) {
  const alters = getAlters();
  const alterName = id => alters.find(a=>a.id===id)?.name||id;
  let sessions = (()=>{ try{return JSON.parse(localStorage.getItem('tid_fronting'))||[];}catch{return[];} })()
    .filter(s=>s.end).sort((a,b)=>a.start-b.start);
  if(from) sessions = sessions.filter(s=>new Date(s.start).toISOString().slice(0,10)>=from);
  if(to)   sessions = sessions.filter(s=>new Date(s.start).toISOString().slice(0,10)<=to);
  const rows = [['Fecha','Hora inicio','Hora fin','Alter','Co-fronting','Duración (min)','Nota']];
  sessions.forEach(s=>{
    const d = new Date(s.start);
    rows.push([
      d.toISOString().slice(0,10),
      d.toTimeString().slice(0,5),
      s.end ? new Date(s.end).toTimeString().slice(0,5) : '',
      alterName(s.alterId),
      (s.coFronting||[]).map(alterName).join('; '),
      s.duration ? Math.round(s.duration/60000) : '',
      s.note||''
    ]);
  });
  downloadCSV(rows, `fronting-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(`${rows.length-1} sesiones exportadas ✓`);
}

function exportTrackerCSV(from, to) {
  const alters  = getAlters();
  const alterName = id => alters.find(a=>a.id===id)?.name||id;
  let entries = (()=>{ try{return JSON.parse(localStorage.getItem('tid_tracker'))||[];}catch{return[];} })()
    .filter(e => !e.isPrivate || e.alterId === activeAlter.id)
    .sort((a,b)=>a.date.localeCompare(b.date));
  if(from) entries = entries.filter(e=>e.date>=from);
  if(to)   entries = entries.filter(e=>e.date<=to);
  const rows = [['Fecha','Alter','Estado','Intensidad','Nota']];
  entries.forEach(e=>rows.push([e.date, alterName(e.alterId), e.mood||'', e.intensity!=null?e.intensity:'', e.note||'']));
  downloadCSV(rows, `tracker-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(`${rows.length-1} registros exportados ✓`);
}

function exportFinanzasCSV(from, to) {
  const alters = getAlters();
  const rows   = [['Fecha','Alter','Tipo','Descripción','Importe','Categoría','Cuenta','Origen','Nota']];
  alters.forEach(alter=>{
    let txs = (()=>{ try{return JSON.parse(localStorage.getItem(`tid_${alter.id}_transactions`))||[];}catch{return[];} })();
    if(from) txs = txs.filter(t=>(t.date||'')>=from);
    if(to)   txs = txs.filter(t=>(t.date||'')<=to);
    txs.forEach(t=>rows.push([
      t.date||'', alter.name,
      t.type==='ingreso' || t.type==='income' ? 'Ingreso' : 'Gasto',
      t.description||'',
      t.amount!=null?t.amount:'',
      t.category||'',
      t.account||'',
      t.source||'',
      t.note||''
    ]));
  });
  rows.sort((a,b)=>a[0].localeCompare(b[0]));
  downloadCSV(rows, `finanzas-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(`${rows.length-1} transacciones exportadas ✓`);
}

function exportFinanzasJSON() {
  const alters = getAlters();
  const data = { version: 1, exportedAt: new Date().toISOString(), currency: getFinanceCurrency(), alters: {} };
  alters.forEach(a => { data.alters[a.id] = {}; ['transactions','ahorros','presupuestos','categories'].forEach(section => { try { data.alters[a.id][section] = JSON.parse(localStorage.getItem(`tid_${a.id}_${section}`)) || []; } catch { data.alters[a.id][section] = []; } }); });
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download=`finanzas-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
  showToast('Finanzas exportadas ✓');
}

function importFinanzasJSON(file) {
  const reader = new FileReader();
  reader.onload = event => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data || typeof data.alters !== 'object') throw new Error('Formato financiero no válido');
      const known = getAlters().filter(a => data.alters[a.id]);
      openModal(`<div class="modal-title">Importar finanzas</div><div class="form-grid"><div class="form-row">Elige qué alters y secciones financieras restaurar.</div><div style="display:grid;gap:8px">${known.map(a => `<div style="border:1px solid var(--border);padding:8px;border-radius:8px"><label><input type="checkbox" data-import-alter="${a.id}" checked> <strong>${esc(a.name)}</strong></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${['transactions','ahorros','presupuestos','categories'].map(section => `<label style="font-size:11px"><input type="checkbox" data-import-section="${a.id}:${section}" checked> ${section}</label>`).join('')}</div></div>`).join('')}</div><div style="color:var(--red);font-size:11px">Los datos seleccionados serán reemplazados.</div></div><div class="modal-footer"><button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-danger" data-submit>Importar selección</button></div>`, overlay => {
        known.forEach(a => { if (!overlay.querySelector(`[data-import-alter="${a.id}"]`)?.checked) return; const sections=data.alters[a.id]; ['transactions','ahorros','presupuestos','categories'].forEach(section => { if (overlay.querySelector(`[data-import-section="${a.id}:${section}"]`)?.checked && Array.isArray(sections[section])) localStorage.setItem(`tid_${a.id}_${section}`, JSON.stringify(sections[section])); }); });
        const cfg=loadConfig(); if (data.currency) saveConfig({...cfg,financeCurrency:String(data.currency)});
        closeModal(); showToast('Finanzas importadas ✓'); renderFinanzasDashboard();
      });
    } catch (error) { showToast('⚠ ' + error.message); }
  };
  reader.readAsText(file);
}

function exportRemindersCSV(from, to) {
  const alters = getAlters();
  const alterName = id => alters.find(a=>a.id===id)?.name||'—';
  const RECUR = {none:'Sin repetición',every8h:'Cada 8h',daily:'Diario',weekly:'Semanal',monthly:'Mensual'};
  let reminders = (()=>{ try{return JSON.parse(localStorage.getItem('tid_reminders'))||[];}catch{return[];} })()
    .sort((a,b)=>a.datetime-b.datetime);
  if(from) reminders = reminders.filter(r=>new Date(r.datetime).toISOString().slice(0,10)>=from);
  if(to)   reminders = reminders.filter(r=>new Date(r.datetime).toISOString().slice(0,10)<=to);
  const rows = [['Fecha','Hora','Alter','Título','Descripción','Repetición','Completado']];
  reminders.forEach(r=>{
    const d = new Date(r.datetime);
    rows.push([
      d.toISOString().slice(0,10),
      d.toTimeString().slice(0,5),
      alterName(r.alterId),
      r.title||'',
      r.desc||'',
      RECUR[r.recurrence]||r.recurrence||'',
      r.done?'Sí':'No'
    ]);
  });
  downloadCSV(rows, `recordatorios-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(`${rows.length-1} recordatorios exportados ✓`);
}

function exportTareasCSV(from, to) {
  const alters    = getAlters();
  const proyectos = (()=>{ try{return JSON.parse(localStorage.getItem('tid_proyectos'))||[];}catch{return[];} })();
  const alterName = id => alters.find(a=>a.id===id)?.name||'—';
  const proyName  = id => proyectos.find(p=>p.id===id)?.name||'—';
  const STATUS_ES = {pendiente:'Pendiente','en-progreso':'En progreso',completada:'Completada',bloqueada:'Bloqueada'};
  const PRIO_ES   = {alta:'Alta',media:'Media',baja:'Baja'};
  let tareas = (()=>{ try{return JSON.parse(localStorage.getItem('tid_tareas'))||[];}catch{return[];} })();
  if(from) tareas = tareas.filter(t=>(t.deadline||'')>=from);
  if(to)   tareas = tareas.filter(t=>!t.deadline||(t.deadline<=to));
  tareas.sort((a,b)=>(a.deadline||'').localeCompare(b.deadline||''));
  const rows = [['Deadline','Proyecto','Tarea','Asignada a','Prioridad','Estado','Descripción']];
  tareas.forEach(t=>rows.push([
    t.deadline||'',
    proyName(t.proyId),
    t.title||'',
    alterName(t.assigneeId),
    PRIO_ES[t.priority]||t.priority||'',
    STATUS_ES[t.status]||t.status||'',
    t.desc||''
  ]));
  downloadCSV(rows, `tareas-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(`${rows.length-1} tareas exportadas ✓`);
}

function exportResumenTXT(from, to) {
  const alters    = getAlters();
  const proyectos = (()=>{ try{return JSON.parse(localStorage.getItem('tid_proyectos'))||[];}catch{return[];} })();
  const tareas    = (()=>{ try{return JSON.parse(localStorage.getItem('tid_tareas'))||[];}catch{return[];} })();
  let sessions  = (()=>{ try{return JSON.parse(localStorage.getItem('tid_fronting'))||[];}catch{return[];} })().filter(s=>s.end);
  let tracker   = (()=>{ try{return JSON.parse(localStorage.getItem('tid_tracker'))||[];}catch{return[];} })()
    .filter(e => !e.isPrivate || e.alterId === activeAlter.id);
  const today     = new Date().toISOString().slice(0,10);
  const alterName = id => alters.find(a=>a.id===id)?.name||id;

  if(from) { sessions=sessions.filter(s=>new Date(s.start).toISOString().slice(0,10)>=from); tracker=tracker.filter(e=>e.date>=from); }
  if(to)   { sessions=sessions.filter(s=>new Date(s.start).toISOString().slice(0,10)<=to);   tracker=tracker.filter(e=>e.date<=to); }

  const frontTotals = {};
  sessions.forEach(s=>{ frontTotals[s.alterId]=(frontTotals[s.alterId]||0)+(s.duration||0); });

  const pending = tareas.filter(t=>t.status!=='completada');
  const overdue = pending.filter(t=>t.deadline&&t.deadline<today);

  const periodLabel = from||to ? `${from||'inicio'} — ${to||today}` : 'Todo el historial';

  const lines = [];
  lines.push('═══════════════════════════════════════════');
  lines.push('  RESUMEN DEL SISTEMA');
  lines.push(`  Período: ${periodLabel}`);
  lines.push(`  Generado: ${new Date().toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`);
  lines.push('═══════════════════════════════════════════');
  lines.push('');

  lines.push('── ALTERS ──────────────────────────────────');
  alters.forEach(a=>lines.push(`  ${a.emoji||'●'} ${a.name}${a.pronouns?' ('+a.pronouns+')':''}${a.role?' · '+a.role:''}`));
  lines.push('');

  lines.push(`── FRONTING (${periodLabel}) ──────────────`);
  lines.push(`  ${sessions.length} sesiones registradas`);
  if(Object.keys(frontTotals).length) {
    Object.entries(frontTotals).sort((a,b)=>b[1]-a[1]).forEach(([id,ms])=>
      lines.push(`  · ${alterName(id)}: ${(ms/3600000).toFixed(1)} h`));
  }
  lines.push('');

  lines.push(`── TRACKER EMOCIONAL (${periodLabel}) ──────`);
  if(tracker.length) {
    const moodCount={};
    tracker.forEach(e=>{ moodCount[e.mood]=(moodCount[e.mood]||0)+1; });
    Object.entries(moodCount).sort((a,b)=>b[1]-a[1]).forEach(([m,n])=>lines.push(`  · ${m}: ${n} registro${n!==1?'s':''}`));
  } else {
    lines.push('  Sin registros en el período');
  }
  lines.push('');

  const activeProy = proyectos.filter(p=>p.status==='activo');
  lines.push('── PROYECTOS ACTIVOS ─────────────────────────');
  if(activeProy.length) {
    activeProy.forEach(p=>{
      const total=tareas.filter(t=>t.proyId===p.id).length;
      const done=tareas.filter(t=>t.proyId===p.id&&t.status==='completada').length;
      lines.push(`  · ${p.name} [${done}/${total}] — responsable: ${p.responsableId?alterName(p.responsableId):'—'}${p.deadline?' · plazo: '+p.deadline:''}`);
    });
  } else {
    lines.push('  Sin proyectos activos');
  }
  lines.push('');

  if(overdue.length) {
    lines.push('── TAREAS VENCIDAS ───────────────────────────');
    overdue.sort((a,b)=>a.deadline.localeCompare(b.deadline)).forEach(t=>{
      lines.push(`  ⚠ [${t.deadline}] ${t.title} (${proyectos.find(p=>p.id===t.proyId)?.name||'—'}) → ${alterName(t.assigneeId)}`);
    });
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════');
  lines.push('  Generado por Atria');
  lines.push('═══════════════════════════════════════════');

  const blob = new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download=`resumen-sistema-${today}.txt`; a.click(); URL.revokeObjectURL(url);
  showToast('Resumen exportado ✓');
}

function exportInformeTerapeutico(from, to) {
  const alters     = getAlters();
  const today      = new Date().toISOString().slice(0,10);
  const alterName  = id => alters.find(a=>a.id===id)?.name||id;
  const cfg        = loadConfig();

  let sessions = (()=>{ try{return JSON.parse(localStorage.getItem('tid_fronting'))||[];}catch{return[];} })().filter(s=>s.end);
  let tracker  = (()=>{ try{return JSON.parse(localStorage.getItem('tid_tracker'))||[];}catch{return[];} })()
    .filter(e => !e.isPrivate || e.alterId === activeAlter.id);
  let diary    = (()=>{ try{return JSON.parse(localStorage.getItem('tid_diary'))||[];}catch{return[];} })()
    .filter(e => !e.isPrivate || e.alterId === activeAlter.id)
    .filter(e => !e.isArchived);
  let crisisLog = loadCrisisLog();
  const triggers = loadSaludTriggers();

  if(from) { sessions=sessions.filter(s=>new Date(s.start).toISOString().slice(0,10)>=from); tracker=tracker.filter(e=>e.date>=from); diary=diary.filter(e=>{const d=new Date(e.ts).toISOString().slice(0,10);return d>=from;}); crisisLog=crisisLog.filter(e=>new Date(e.startedAt).toISOString().slice(0,10)>=from); }
  if(to)   { sessions=sessions.filter(s=>new Date(s.start).toISOString().slice(0,10)<=to);   tracker=tracker.filter(e=>e.date<=to);   diary=diary.filter(e=>{const d=new Date(e.ts).toISOString().slice(0,10);return d<=to;});   crisisLog=crisisLog.filter(e=>new Date(e.startedAt).toISOString().slice(0,10)<=to); }

  const periodLabel = from||to ? `${from||'inicio'} — ${to||today}` : 'Todo el historial';
  const NIVEL_ES = {leve:'Leve',moderado:'Moderado',intenso:'Intenso',severo:'Severo'};

  const lines = [];
  const sep  = '═══════════════════════════════════════════';
  const sep2 = '───────────────────────────────────────────';

  lines.push(sep);
  lines.push('  INFORME DE BIENESTAR DEL SISTEMA');
  if(cfg.systemName) lines.push(`  Sistema: ${cfg.systemName}`);
  lines.push(`  Período: ${periodLabel}`);
  lines.push(`  Generado: ${new Date().toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'})}`);
  lines.push(sep);
  lines.push('');
  lines.push('  Este informe contiene información sensible.');
  lines.push('  Compártelo solo con profesionales de confianza.');
  lines.push('');

  // COMPOSICIÓN DEL SISTEMA
  lines.push('── COMPOSICIÓN DEL SISTEMA ─────────────────');
  lines.push(`  ${alters.length} alter${alters.length!==1?'s':''} activos`);
  alters.forEach(a=>{
    let line = `  ${a.emoji||'●'} ${a.name}`;
    if(a.pronouns) line += ` (${a.pronouns})`;
    if(a.role)     line += ` — ${a.role}`;
    lines.push(line);
  });
  lines.push('');

  // PRESENCIA (FRONTING)
  lines.push('── PRESENCIA EN EL PERÍODO ─────────────────');
  if(sessions.length) {
    const frontTotals={}, frontCount={};
    sessions.forEach(s=>{ frontTotals[s.alterId]=(frontTotals[s.alterId]||0)+(s.duration||0); frontCount[s.alterId]=(frontCount[s.alterId]||0)+1; });
    const totalH = Object.values(frontTotals).reduce((a,b)=>a+b,0)/3600000;
    lines.push(`  ${sessions.length} sesiones · ${totalH.toFixed(1)} h en total`);
    Object.entries(frontTotals).sort((a,b)=>b[1]-a[1]).forEach(([id,ms])=>{
      lines.push(`  · ${alterName(id)}: ${(ms/3600000).toFixed(1)} h (${frontCount[id]} ses.)`);
    });
  } else {
    lines.push('  Sin sesiones registradas en el período');
  }
  lines.push('');

  // ESTADO EMOCIONAL
  lines.push('── ESTADO EMOCIONAL ────────────────────────');
  if(tracker.length) {
    const moodCount={}, intensities=[];
    tracker.forEach(e=>{ moodCount[e.mood]=(moodCount[e.mood]||0)+1; if(e.intensity!=null) intensities.push(e.intensity); });
    const avgInt = intensities.length ? (intensities.reduce((a,b)=>a+b,0)/intensities.length).toFixed(1) : null;
    lines.push(`  ${tracker.length} registro${tracker.length!==1?'s':''}`+(avgInt?` · intensidad media: ${avgInt}/5`:''));
    lines.push('  Estados más frecuentes:');
    Object.entries(moodCount).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,n])=>lines.push(`    · ${m}: ${n} vez${n!==1?'':''}${n!==1?'es':''}`));
    // Per alter breakdown
    const byAlter={};
    tracker.forEach(e=>{ if(!byAlter[e.alterId]) byAlter[e.alterId]={count:{},total:0}; byAlter[e.alterId].count[e.mood]=(byAlter[e.alterId].count[e.mood]||0)+1; byAlter[e.alterId].total++; });
    if(Object.keys(byAlter).length>1) {
      lines.push('  Por alter:');
      Object.entries(byAlter).forEach(([id,d])=>{
        const top=Object.entries(d.count).sort((a,b)=>b[1]-a[1])[0];
        lines.push(`    · ${alterName(id)}: ${d.total} registro${d.total!==1?'s':''}, principalmente "${top[0]}"`);
      });
    }
  } else {
    lines.push('  Sin registros en el período');
  }
  lines.push('');

  // ENTRADAS DE DIARIO
  lines.push('── ENTRADAS DE DIARIO ──────────────────────');
  if(diary.length) {
    diary.sort((a,b)=>b.ts-a.ts).forEach(e=>{
      const d=new Date(e.ts).toISOString().slice(0,10);
      lines.push(`  [${d}] ${alterName(e.alterId)}${e.mood?' · '+e.mood:''}`);
      if(e.title) lines.push(`  "${e.title}"`);
      if(e.body) {
        const snippet = e.body.length>200 ? e.body.slice(0,200)+'…' : e.body;
        snippet.split('\n').forEach(l=>lines.push('  '+l));
      }
      lines.push('  '+sep2.slice(2));
    });
  } else {
    lines.push('  Sin entradas en el período');
  }
  lines.push('');

  // EPISODIOS DE CRISIS
  lines.push('── EPISODIOS DE CRISIS ─────────────────────');
  if(crisisLog.length) {
    lines.push(`  ${crisisLog.length} episodio${crisisLog.length!==1?'s':''} registrado${crisisLog.length!==1?'s':''}`);
    crisisLog.sort((a,b)=>b.startedAt-a.startedAt).forEach(e=>{
      const d=new Date(e.startedAt).toISOString().slice(0,10);
      const dur=e.endedAt?Math.round((e.endedAt-e.startedAt)/60000):null;
      const trig=e.triggerId?triggers.find(t=>t.id===e.triggerId)?.titulo:'—';
      let line=`  · [${d}] ${alterName(e.alterId)} · ${NIVEL_ES[e.level]||e.level}`;
      if(trig&&trig!=='—') line+=` · trigger: ${trig}`;
      if(dur!=null) line+=` · duración: ${dur} min`;
      lines.push(line);
      if(e.note) lines.push(`    Nota: ${e.note}`);
    });
  } else {
    lines.push('  Sin episodios en el período');
  }
  lines.push('');

  lines.push(sep);
  lines.push('  Generado por Atria · atria-app.com');
  lines.push(sep);

  const blob = new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download=`informe-bienestar-${today}.txt`; a.click(); URL.revokeObjectURL(url);
  showToast('Informe exportado ✓');
}

function printInformeBienestar(from, to) {
  const alters    = getAlters();
  const today     = new Date().toISOString().slice(0,10);
  const alterName = id => alters.find(a=>a.id===id)?.name||id;
  const cfg       = loadConfig();

  let sessions = (()=>{ try{return JSON.parse(localStorage.getItem('tid_fronting'))||[];}catch{return[];} })().filter(s=>s.end);
  let tracker  = (()=>{ try{return JSON.parse(localStorage.getItem('tid_tracker'))||[];}catch{return[];} })()
    .filter(e => !e.isPrivate || e.alterId === activeAlter?.id);
  let diary    = (()=>{ try{return JSON.parse(localStorage.getItem('tid_diary'))||[];}catch{return[];} })()
    .filter(e => !e.isPrivate || e.alterId === activeAlter?.id).filter(e=>!e.isArchived);
  let crisisLog = loadCrisisLog();
  const triggers = loadSaludTriggers();

  if(from) { sessions=sessions.filter(s=>new Date(s.start).toISOString().slice(0,10)>=from); tracker=tracker.filter(e=>e.date>=from); diary=diary.filter(e=>new Date(e.ts).toISOString().slice(0,10)>=from); crisisLog=crisisLog.filter(e=>new Date(e.startedAt).toISOString().slice(0,10)>=from); }
  if(to)   { sessions=sessions.filter(s=>new Date(s.start).toISOString().slice(0,10)<=to);   tracker=tracker.filter(e=>e.date<=to);   diary=diary.filter(e=>new Date(e.ts).toISOString().slice(0,10)<=to);   crisisLog=crisisLog.filter(e=>new Date(e.startedAt).toISOString().slice(0,10)<=to); }

  const periodLabel = from||to ? `${from||'inicio'} — ${to||today}` : 'Todo el historial';
  const NIVEL_ES = {leve:'Leve',moderado:'Moderado',intenso:'Intenso',severo:'Severo'};

  const frontTotals={}, frontCount={};
  sessions.forEach(s=>{ frontTotals[s.alterId]=(frontTotals[s.alterId]||0)+(s.duration||0); frontCount[s.alterId]=(frontCount[s.alterId]||0)+1; });
  const moodCount={};
  tracker.forEach(e=>{ moodCount[e.mood]=(moodCount[e.mood]||0)+1; });

  const rows = (obj) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${escM(k)}</td><td>${v}</td></tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Informe de Bienestar${cfg.systemName?' — '+cfg.systemName:''}</title>
<style>
  body{font-family:Georgia,serif;max-width:760px;margin:40px auto;color:#111;line-height:1.6;font-size:14px}
  h1{font-size:22px;margin-bottom:4px}
  h2{font-size:15px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:28px}
  .meta{color:#666;font-size:12px;margin-bottom:24px}
  .warning{background:#fff8e1;border:1px solid #f9a825;border-radius:6px;padding:10px 14px;font-size:12px;color:#6d4c00;margin-bottom:20px}
  table{border-collapse:collapse;width:100%;margin-top:8px;font-size:13px}
  th{text-align:left;padding:4px 8px;background:#f5f5f5;border-bottom:1px solid #ddd}
  td{padding:4px 8px;border-bottom:1px solid #eee}
  .alter-row{display:flex;align-items:center;gap:8px;margin:4px 0}
  .crisis-item{padding:6px 0;border-bottom:1px solid #eee}
  .diary-item{padding:8px 0;border-bottom:1px solid #eee}
  .diary-title{font-weight:700;font-size:13px}
  .diary-body{color:#444;font-size:12px;margin-top:2px;max-height:80px;overflow:hidden}
  @media print{body{margin:20px}}
</style></head><body>
<h1>Informe de Bienestar del Sistema</h1>
<div class="meta">
  ${cfg.systemName?`Sistema: <strong>${escM(cfg.systemName)}</strong> · `:''}
  Período: <strong>${escM(periodLabel)}</strong> ·
  Generado: ${new Date().toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'})}
</div>
<div class="warning">⚠ Este informe contiene información sensible. Compártelo solo con profesionales de confianza.</div>

<h2>Composición del sistema</h2>
<p>${alters.length} alter${alters.length!==1?'s':''}</p>
${alters.map(a=>`<div class="alter-row"><span>${a.emoji||'●'}</span><strong>${escM(a.name)}</strong>${a.pronouns?` <span style="color:#666">(${escM(a.pronouns)})</span>`:''} ${a.role?`— ${escM(a.role)}`:''}</div>`).join('')}

<h2>Presencia (fronting) — ${escM(periodLabel)}</h2>
${sessions.length ? `<p>${sessions.length} sesiones registradas</p>
<table><tr><th>Alter</th><th>Horas</th><th>Sesiones</th></tr>
${Object.entries(frontTotals).sort((a,b)=>b[1]-a[1]).map(([id,ms])=>`<tr><td>${escM(alterName(id))}</td><td>${(ms/3600000).toFixed(1)} h</td><td>${frontCount[id]}</td></tr>`).join('')}
</table>` : `<p style="color:#888">Sin sesiones en el período</p>`}

<h2>Estado emocional — ${escM(periodLabel)}</h2>
${Object.keys(moodCount).length ? `<table><tr><th>Estado</th><th>Registros</th></tr>${rows(moodCount)}</table>` : `<p style="color:#888">Sin registros en el período</p>`}

<h2>Diario — ${diary.length} entrad${diary.length!==1?'as':'a'}</h2>
${diary.slice(-10).reverse().map(e=>`<div class="diary-item">
  <div class="diary-title">${escM(e.title||'Sin título')} <span style="font-size:11px;color:#888;font-weight:400">— ${escM(alterName(e.alterId))} · ${new Date(e.ts).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}</span></div>
  ${e.body?`<div class="diary-body">${escM(e.body.slice(0,200))}${e.body.length>200?'…':''}</div>`:''}
</div>`).join('')}
${diary.length > 10 ? `<p style="color:#888;font-size:12px">Mostrando las últimas 10 entradas de ${diary.length}.</p>` : ''}

<h2>Episodios de crisis — ${crisisLog.length}</h2>
${crisisLog.length ? crisisLog.slice(-10).reverse().map(e=>{
  const trig = e.triggerId ? triggers.find(t=>t.id===e.triggerId)?.titulo : null;
  return `<div class="crisis-item">[${new Date(e.startedAt).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}] ${escM(alterName(e.alterId))} · ${NIVEL_ES[e.level]||e.level||'—'}${trig?` · trigger: ${escM(trig)}`:''}${e.note?`<br><small style="color:#666">${escM(e.note)}</small>`:''}</div>`;
}).join('') : `<p style="color:#888">Sin episodios en el período</p>`}

<p style="margin-top:40px;font-size:11px;color:#aaa;border-top:1px solid #ddd;padding-top:12px">Generado por Atria · atria-app.com</p>
</body></html>`;

  const w = window.open('', '_blank', 'width=820,height=700');
  if (!w) { showToast('Permite ventanas emergentes para imprimir'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

// ── BACKUP EXPORT ──
const BACKUP_SCHEMA_VERSION = 3;

async function checksumBackupText(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function validateBackupEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('El archivo de backup no tiene un formato valido');
  const version = Number(payload.schemaVersion || payload.v || 0);
  if (!version || version > BACKUP_SCHEMA_VERSION) throw new Error(`Version de backup no compatible: ${version || 'desconocida'}`);
  if (typeof payload.data !== 'string') throw new Error('El backup no contiene datos validos');
  return version;
}

function validateBackupData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('El contenido del backup no es un objeto valido');
  const keys = Object.keys(data).filter(key => key.startsWith('tid_'));
  if (!keys.length) throw new Error('El backup no contiene datos de Atria');
  if (data.tid_alters) {
    let alters;
    try { alters = JSON.parse(data.tid_alters); } catch { throw new Error('El backup contiene alters dañados'); }
    if (!Array.isArray(alters)) throw new Error('El backup contiene una lista de alters invalida');
  }
  return keys.length;
}

function describeBackupPasswordStrength(password) {
  const value = String(password || '');
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return score >= 4 ? ['Fuerte', '#5fffb0'] : score >= 2 ? ['Aceptable', '#ffcf6f'] : ['Debil', '#ff8a8a'];
}

window.AtriaBackupIntegrity = { checksumBackupText, validateBackupEnvelope, validateBackupData };

const BACKUP_RESTORE_MODULE_KEYS = {
  identities: ['tid_alters', 'tid_alter_fichas', 'tid_subsystems', 'tid_custom_role_types'],
  fronts: ['tid_fronting', 'tid_front_presets', 'tid_front_schedule'],
  journal: ['tid_diary', 'tid_notas', 'tid_actividad', 'tid_cambios', 'tid_timeline', 'tid_tracker'],
  reminders: ['tid_reminders', 'tid_routines', 'tid_routine_log', 'tid_notif_config'],
  settings: ['tid_config', 'tid_moods', 'tid_salud_triggers', 'tid_alergias', 'tid_medicaciones', 'tid_med_intake'],
  projects: ['tid_proyectos', 'tid_tareas', 'tid_templates', 'tid_wishes', 'tid_normas', 'tid_polls'],
};

function backupKeyBelongsToModule(key, module) {
  if (module === 'finances') return /_transactions$|_ahorros$|_presupuestos$|_categories$/.test(key);
  return BACKUP_RESTORE_MODULE_KEYS[module]?.some(prefix => key === prefix || key.startsWith(prefix + '_')) || false;
}

function shouldRestoreBackupKey(key, selectedModules) {
  if (!Array.isArray(selectedModules) || !selectedModules.length) return true;
  return selectedModules.some(module => backupKeyBelongsToModule(key, module));
}

async function exportBackup(password) {
  const data = {};
  TID_KEYS.forEach(k => { const v = localStorage.getItem(k); if(v) data[k] = v; });
  // Per-alter dynamic keys (not in TID_KEYS)
  try { (JSON.parse(localStorage.getItem('tid_alters'))||[]).forEach(a => {
    ['tid_calm_msg_'+a.id, `tid_${a.id}_transactions`, `tid_${a.id}_ahorros`, `tid_${a.id}_presupuestos`, `tid_${a.id}_categories`].forEach(k => { const v=localStorage.getItem(k); if(v) data[k]=v; });
  }); } catch {}
  const json = JSON.stringify(data);
  const checksum = await checksumBackupText(json);
  const payload = JSON.stringify({
    ...(password ? await encryptBackupData(json, password) : { encrypted: false, data: toB64(json) }),
    v: BACKUP_SCHEMA_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    checksum,
    createdAt: new Date().toISOString(),
  });

  const blob = new Blob([payload], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `tid-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem('tid_last_backup', Date.now().toString());
  showToast('Backup exportado ✓');
}

// ── BACKUP IMPORT ──
function importBackup(file, password, onDone, selectedModules = null) {
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const payload = JSON.parse(e.target.result);
      const version = validateBackupEnvelope(payload);
      const raw = await decryptBackupPayload(payload, password);
      if (version >= BACKUP_SCHEMA_VERSION && payload.checksum !== await checksumBackupText(raw)) throw new Error('El checksum del backup no coincide; el archivo puede estar dañado');
      const data = JSON.parse(raw);
      validateBackupData(data);
      Object.entries(data).forEach(([k,v]) => {
        if (shouldRestoreBackupKey(k, selectedModules) && !shouldSkipIncomingSyncWrite(k, v) && !PIN_KEYS.includes(k) && (TID_KEYS.includes(k) || k.startsWith('tid_'))) localStorage.setItem(k, v);
      });
      onDone(null);
    } catch(err) { onDone(err.message || 'Error al importar'); }
  };
  reader.readAsText(file);
}

// ── WIPE ALL DATA ──
function wipeAllData() {
  // Remove per-alter dynamic keys — scan all localStorage keys to avoid missing orphans
  const dynamicSuffixes = ['_transactions', '_ahorros', '_presupuestos', '_categories'];
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('tid_calm_msg_')) { localStorage.removeItem(k); return; }
    if (dynamicSuffixes.some(s => k.endsWith(s)) && k.startsWith('tid_')) localStorage.removeItem(k);
  });
  TID_KEYS.forEach(k => localStorage.removeItem(k));
  clearSessionUnlock();
  setPinEnabled(false);
  localStorage.removeItem(PIN_STORAGE_KEY);
  localStorage.removeItem(PIN_ENABLED_KEY);
  clearPinRecovery();
}

// ── RENDER SEGURIDAD VIEW ──
function renderSeguridad() {
  // accessed from config tab
  const app = document.getElementById('app');
  // Called from within config — render as section
  renderSeguridadView(app);
}

function renderSeguridadView(container) {
  const pinEnabled = getPinEnabled();

  container.innerHTML = `
    <div class="sec-view">
      <div>
        <div class="fin-title">🔒 Seguridad</div>
        <div class="fin-subtitle">PIN, sesión y gestión de datos</div>
      </div>

      <!-- PIN -->
      <div class="sec-section">
        <div class="sec-section-header">
          <span class="sec-section-icon">🔑</span>
          <span class="sec-section-title">PIN de acceso</span>
          <span class="sec-status-badge" style="color:${pinEnabled?'var(--green)':'var(--text-3)'};border-color:${pinEnabled?'var(--green)':'var(--border)'}">
            ${pinEnabled ? '● Activo' : '○ Desactivado'}
          </span>
        </div>
        <div class="sec-section-body">
          <div class="sec-row">
            <div>
              <div class="sec-row-label">PIN global de 4 dígitos</div>
              <div class="sec-row-sub">Se pide al abrir la app en una nueva sesión</div>
            </div>
            <button class="btn btn-${pinEnabled?'ghost':'primary'}" id="btn-pin-toggle">
              ${pinEnabled ? 'Desactivar' : 'Activar PIN'}
            </button>
          </div>
          ${pinEnabled ? `<div class="sec-row">
            <div>
              <div class="sec-row-label">Cambiar PIN</div>
              <div class="sec-row-sub">Introduce el PIN actual y el nuevo</div>
            </div>
            <button class="btn btn-ghost" id="btn-pin-change">Cambiar</button>
          </div>
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Pregunta de recuperación</div>
              <div class="sec-row-sub">${getPinRecovery() ? '● Configurada' : '○ No configurada — sin ella solo puedes recuperar borrando todo'}</div>
            </div>
            <button class="btn btn-ghost" id="btn-pin-recovery">${getPinRecovery() ? 'Editar' : 'Configurar'}</button>
          </div>` : ''}
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Bloquear ahora</div>
              <div class="sec-row-sub">Cierra la sesión activa inmediatamente</div>
            </div>
            <button class="btn btn-ghost" id="btn-lock-now" ${!pinEnabled?'disabled style="opacity:.4;cursor:not-allowed"':''}>Bloquear</button>
          </div>
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Bloquear al salir de la app</div>
              <div class="sec-row-sub">Pedir el PIN al volver desde otra app o pestaña del navegador</div>
            </div>
            <label class="toggle-switch"><input type="checkbox" id="cfg-auto-lock" ${localStorage.getItem(AUTO_LOCK_KEY)==='1'?'checked':''} ${!pinEnabled?'disabled':''}><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>

      <!-- PROTECCION local -->
      <div class="sec-section">
        <div class="sec-section-header">
          <span class="sec-section-icon">◎</span>
          <span class="sec-section-title">Protección local</span>
        </div>
        <div class="sec-section-body">
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2);line-height:1.6;padding:10px;background:var(--bg-2);border-radius:8px;border:1px solid var(--border)">
            ⚠ El PIN protege la sesión y añade una barrera básica local, pero no cifra todo el almacenamiento del navegador. Para compartir o mover datos con seguridad, usa el backup cifrado con contraseña.
          </div>
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Estado de la protección</div>
              <div class="sec-row-sub" id="enc-status-sub">Comprobando…</div>
            </div>
            <button class="btn btn-ghost" id="btn-enc-toggle" ${!pinEnabled?'disabled style="opacity:.4;cursor:not-allowed"':''}>
              ${localStorage.getItem('tid_enc_enabled')==='1'?'Ver estado':'Activar protección'}
            </button>
          </div>
        </div>
      </div>

      <!-- NOTIFICACIONES PRIVADAS -->
      <div class="sec-section">
        <div class="sec-section-header">
          <span class="sec-section-icon">◌</span>
          <span class="sec-section-title">Notificaciones privadas</span>
        </div>
        <div class="sec-section-body">
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Ocultar detalles de notificaciones</div>
              <div class="sec-row-sub">Usa texto generico para que nombres y contenidos no aparezcan en la pantalla bloqueada</div>
            </div>
            <label class="toggle-switch"><input type="checkbox" id="btn-private-notifications" ${localStorage.getItem('tid_private_notifications')==='1'?'checked':''}><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>

      <!-- BACKUP -->
      <div class="sec-section">
        <div class="sec-section-header">
          <span class="sec-section-icon">◫</span>
          <span class="sec-section-title">Backup</span>
        </div>
        <div class="sec-section-body">
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Exportar backup</div>
              <div class="sec-row-sub">Guarda una copia externa en .json si quieres conservarla fuera de Atria</div>
            </div>
            <button class="btn btn-primary" id="btn-export">Exportar</button>
          </div>
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Importar backup</div>
              <div class="sec-row-sub">Restaura desde un archivo .json (sobrescribe los datos actuales)</div>
            </div>
            <button class="btn btn-ghost" id="btn-sec-import">Importar</button>
            <input type="file" id="import-file-input" accept=".json" style="display:none">
          </div>
        </div>
      </div>

    </div>`;

  // Enc status
  const encEnabled = localStorage.getItem('tid_enc_enabled') === '1';
  container.querySelector('#enc-status-sub').textContent =
    encEnabled ? '● Protección local básica con PIN' : '○ Protección local desactivada';

  // PIN toggle
  container.querySelector('#btn-pin-toggle')?.addEventListener('click', () => {
    if (pinEnabled) openPinDisableModal();
    else openPinSetModal(false);
  });

  // PIN change
  container.querySelector('#btn-pin-change')?.addEventListener('click', () => openPinSetModal(true));

  // PIN recovery question
  container.querySelector('#btn-pin-recovery')?.addEventListener('click', () => openPinRecoveryEditModal());

  container.querySelector('#btn-private-notifications')?.addEventListener('change', e => {
    localStorage.setItem('tid_private_notifications', e.target.checked ? '1' : '0');
    showToast(e.target.checked ? 'Notificaciones privadas activadas ✓' : 'Detalles de notificaciones visibles');
  });
  container.querySelector('#cfg-auto-lock')?.addEventListener('change', e => {
    localStorage.setItem(AUTO_LOCK_KEY, e.target.checked ? '1' : '0');
    showToast(e.target.checked ? 'Bloqueo automatico activado ✓' : 'Bloqueo automatico desactivado');
  });

  // Lock now
  container.querySelector('#btn-lock-now')?.addEventListener('click', () => {
    if (!getPinEnabled()) return;
    clearSessionUnlock();
    showToast('Sesión bloqueada ✓');
    setTimeout(() => { location.reload(); }, 800);
  });

  // Encrypt toggle
  container.querySelector('#btn-enc-toggle')?.addEventListener('click', () => {
    if (!getPinEnabled()) return showToast('⚠ Activa el PIN primero');
    showToast('Protección local básica disponible con PIN activo ✓');
  });

  // Export
  container.querySelector('#btn-export')?.addEventListener('click', () => {
    openModal(`
      <div class="modal-title">Exportar backup</div>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-label">Contraseña de cifrado (opcional)</div>
          <input type="password" id="exp-pwd" placeholder="Deja vacío para exportar sin cifrar">
          <div id="exp-pwd-strength" style="font-size:11px;color:var(--text-3)">Sin contraseña: copia sin cifrar</div>
        </div>
        <div class="form-row">
          <div class="form-label">Confirmar contraseña</div>
          <input type="password" id="exp-pwd2" placeholder="">
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);padding:8px;background:var(--bg-2);border-radius:6px">
          Esta copia es opcional. Si pones contraseña, necesitarás la misma para importarla. Sin contraseña no irá cifrada.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-cancel>Cancelar</button>
        <button class="btn btn-primary" data-submit>Descargar</button>
      </div>`,
      (ov) => {
        const p1 = ov.querySelector('#exp-pwd').value;
        const p2 = ov.querySelector('#exp-pwd2').value;
        if (p1 && p1 !== p2) return showToast('⚠ Las contraseñas no coinciden');
        closeModal();
      exportBackup(p1 || null).catch(err => showToast('⚠ ' + (err.message || 'Error al exportar')));
      }
    );
    const pwd = document.querySelector('#exp-pwd');
    const strength = document.querySelector('#exp-pwd-strength');
    const updateStrength = () => { const [label, color] = describeBackupPasswordStrength(pwd?.value); if (strength) { strength.textContent = pwd?.value ? `Fortaleza: ${label}` : 'Sin contraseña: copia sin cifrar'; strength.style.color = color; } };
    pwd?.addEventListener('input', updateStrength);
  });

  // Import
  container.querySelector('#btn-sec-import')?.addEventListener('click', () => {
    container.querySelector('#import-file-input').click();
  });
  container.querySelector('#import-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    openModal(`
      <div class="modal-title">Importar backup</div>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-label">Archivo seleccionado</div>
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);padding:8px;background:var(--bg-2);border-radius:6px">${file.name}</div>
        </div>
        <div class="form-row">
          <div class="form-label">Contraseña (solo si el backup está cifrado)</div>
          <input type="password" id="imp-pwd" placeholder="Deja vacío si no tiene contraseña">
        </div>
        <div class="form-row"><div class="form-label">Módulos a restaurar</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;font-size:12px">${[['identities','Identidades'],['fronts','Fronting'],['journal','Journal'],['reminders','Recordatorios'],['settings','Ajustes'],['projects','Proyectos'],['finances','Finanzas']].map(([id,label])=>`<label><input type="checkbox" data-restore-module="${id}" checked> ${label}</label>`).join('')}</div></div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--red);padding:8px;background:rgba(255,80,80,.06);border-radius:6px;border:1px solid rgba(255,80,80,.2)">
          ⚠ Importar sobrescribirá todos los datos actuales. Si quieres conservar una copia externa del estado actual, expórtala antes.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-cancel>Cancelar</button>
        <button class="btn btn-danger" data-submit>Importar y sobrescribir</button>
      </div>`,
      (ov) => {
        const pwd = ov.querySelector('#imp-pwd').value;
        const selectedModules = [...ov.querySelectorAll('[data-restore-module]:checked')].map(input => input.dataset.restoreModule);
        importBackup(file, pwd || null, (err) => {
          if (err) { showToast('⚠ ' + err); return; }
          closeModal();
          showToast('Datos importados correctamente ✓');
          setTimeout(() => location.reload(), 1000);
        }, selectedModules);
      }
    );
    e.target.value = '';
  });

}

// ── PIN SET MODAL ──
function openPinSetModal(isChange) {
  let step = isChange ? 'verify' : 'set'; // verify current → set new → confirm → recovery
  let newPin = '';

  openModal(`
    <div class="modal-title">${isChange ? 'Cambiar PIN' : 'Activar PIN'}</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:10px 0">
      <div class="pin-lock-sub" id="pin-modal-sub">${isChange ? 'Introduce tu PIN actual' : 'Elige un PIN de 4 dígitos'}</div>
      <div class="pin-dots" id="pin-modal-dots">
        ${Array(4).fill('<div class="pin-dot"></div>').join('')}
      </div>
      <div class="pin-error-msg" id="pin-modal-err"></div>
      <div class="pin-pad" style="max-width:220px;width:100%">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k=>`
          <button class="pin-key${k===''?' invisible':k==='⌫'?' del':''}" data-pkey="${k}">${k}</button>
        `).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
    </div>`,
    () => {}
  );

  const ov = document.querySelector('.modal-overlay');
  ov.querySelectorAll('.invisible').forEach(b => { b.style.visibility='hidden'; b.disabled=true; });
  let entered = '';

  function updateDots() {
    ov.querySelectorAll('.pin-dot').forEach((d,i) => {
      d.classList.toggle('filled', i < entered.length);
      d.classList.remove('error');
    });
    ov.querySelector('#pin-modal-err').textContent = '';
  }

  function shake(msg) {
    ov.querySelectorAll('.pin-dot').forEach(d => { d.classList.remove('filled'); d.classList.add('error'); });
    ov.querySelector('#pin-modal-err').textContent = msg;
    setTimeout(() => { entered = ''; updateDots(); }, 600);
  }

  function goToRecoveryStep() {
    // Replace modal content with recovery question setup
    ov.querySelector('.modal').innerHTML = `
      <div class="modal-title">Pregunta de seguridad</div>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-label">Pregunta de recuperación</div>
          <input type="text" id="rec-q" placeholder="Ej: ¿Nombre de tu primer alter?" maxlength="120"
            style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:13px;width:100%;box-sizing:border-box">
        </div>
        <div class="form-row">
          <div class="form-label">Respuesta</div>
          <input type="text" id="rec-a" placeholder="Tu respuesta (no distingue mayúsculas)" maxlength="120"
            style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:13px;width:100%;box-sizing:border-box">
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);padding:8px;background:var(--bg-2);border-radius:6px">
          Si olvidas el PIN, esta respuesta te permitirá recuperar el acceso sin perder datos. Puedes omitirla, pero si la omites solo podrás recuperar el acceso borrando todo.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="btn-rec-skip">Omitir</button>
        <button class="btn btn-primary" id="btn-rec-save">Guardar y activar</button>
      </div>`;

    async function finalize(question, answer) {
      const salt = generatePinSalt();
      const hash = await hashPinAsync(newPin, salt);
      setStoredPinHash(hash);
      setPinEnabled(true);
      markSessionUnlocked();
      if (question && answer) await setPinRecovery(question, answer);
      else clearPinRecovery();
      closeModal();
      showToast('PIN activado ✓');
      if (document.querySelector('.sec-view')) renderSeguridadView(document.getElementById('app'));
    }

    ov.querySelector('#btn-rec-save').addEventListener('click', () => {
      const q = ov.querySelector('#rec-q').value.trim();
      const a = ov.querySelector('#rec-a').value.trim();
      if (!q || !a) { showToast('⚠ Rellena pregunta y respuesta, o usa Omitir'); return; }
      finalize(q, a);
    });

    ov.querySelector('#btn-rec-skip').addEventListener('click', () => finalize('', ''));
  }

  async function handleComplete() {
    if (step === 'verify') {
      const storedHash = getStoredPinHash();
      if (isLegacyPinHash(storedHash)) {
        // Old djb2 hash — skip verify step and let user set a new PIN directly
        step = 'set'; entered = '';
        ov.querySelector('#pin-modal-sub').textContent = 'Elige tu nuevo PIN';
        updateDots(); return;
      }
      const salt = getOrCreatePinSalt();
      const hash = await hashPinAsync(entered, salt);
      if (hash !== storedHash) { shake('PIN incorrecto'); return; }
      step = 'set'; entered = '';
      ov.querySelector('#pin-modal-sub').textContent = 'Elige tu nuevo PIN';
      updateDots();
    } else if (step === 'set') {
      newPin = entered; step = 'confirm'; entered = '';
      ov.querySelector('#pin-modal-sub').textContent = 'Confirma el nuevo PIN';
      updateDots();
    } else {
      if (entered !== newPin) { shake('Los PINs no coinciden'); step='set'; newPin=''; return; }
      if (isChange) {
        // Al cambiar PIN, mantener pregunta existente, no preguntar de nuevo
        const salt = generatePinSalt();
        const hash = await hashPinAsync(entered, salt);
        setStoredPinHash(hash);
        setPinEnabled(true);
        markSessionUnlocked();
        closeModal();
        showToast('PIN actualizado ✓');
        if (document.querySelector('.sec-view')) renderSeguridadView(document.getElementById('app'));
      } else {
        goToRecoveryStep();
      }
    }
  }

  let processing = false;
  ov.querySelectorAll('[data-pkey]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (processing) return;
      const k = btn.dataset.pkey;
      if (k === '⌫') { entered = entered.slice(0,-1); updateDots(); }
      else if (entered.length < 4) {
        entered += k; updateDots();
        if (entered.length === 4) {
          processing = true;
          setTimeout(() => { handleComplete(); processing = false; }, 80);
        }
      }
    });
  });
}

function openPinRecoveryEditModal() {
  const existing = getPinRecovery();
  openModal(`
    <div class="modal-title">Pregunta de recuperación</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Pregunta</div>
        <input type="text" id="rec-edit-q" value="${existing ? escC(existing.question) : ''}" placeholder="Ej: ¿Nombre de tu primer alter?" maxlength="120"
          style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:13px;width:100%;box-sizing:border-box">
      </div>
      <div class="form-row">
        <div class="form-label">Respuesta nueva${existing ? ' (deja vacío para no cambiarla)' : ''}</div>
        <input type="text" id="rec-edit-a" placeholder="Tu respuesta" maxlength="120"
          style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:13px;width:100%;box-sizing:border-box">
      </div>
    </div>
    <div class="modal-footer">
      ${existing ? `<button class="btn btn-ghost" id="btn-rec-delete" style="color:var(--red);margin-right:auto">Eliminar</button>` : ''}
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>Guardar</button>
    </div>`,
    (ov) => {
      const q = ov.querySelector('#rec-edit-q').value.trim();
      const a = ov.querySelector('#rec-edit-a').value.trim();
      if (!q) { showToast('⚠ La pregunta no puede estar vacía'); return; }
      if (!a && !existing) { showToast('⚠ Introduce una respuesta'); return; }
      if (a) setPinRecovery(q, a);
      else localStorage.setItem(PIN_RECOVERY_KEY, JSON.stringify({ question: q, answerHash: existing.answerHash }));
      closeModal();
      showToast('Pregunta de recuperación guardada ✓');
      if (document.querySelector('.sec-view')) renderSeguridadView(document.getElementById('app'));
    }
  );
  document.querySelector('#btn-rec-delete')?.addEventListener('click', () => {
    clearPinRecovery(); closeModal();
    showToast('Pregunta de recuperación eliminada');
    if (document.querySelector('.sec-view')) renderSeguridadView(document.getElementById('app'));
  });
}

function openPinDisableModal() {
  openModal(`
    <div class="modal-title">Desactivar PIN</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:10px 0">
      <div class="pin-lock-sub">Introduce tu PIN actual para desactivarlo</div>
      <div class="pin-dots" id="pind-dots">${Array(4).fill('<div class="pin-dot"></div>').join('')}</div>
      <div class="pin-error-msg" id="pind-err"></div>
      <div class="pin-pad" style="max-width:220px;width:100%">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k=>`
          <button class="pin-key${k===''?' invisible':k==='⌫'?' del':''}" data-dpkey="${k}">${k}</button>
        `).join('')}
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" data-cancel>Cancelar</button></div>`,
    () => {}
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelectorAll('.invisible').forEach(b => { b.style.visibility='hidden'; b.disabled=true; });
  let entered = '';
  function updateD() { ov.querySelectorAll('.pin-dot').forEach((d,i)=>{ d.classList.toggle('filled',i<entered.length); d.classList.remove('error'); }); ov.querySelector('#pind-err').textContent=''; }
  ov.querySelectorAll('[data-dpkey]').forEach(btn=>btn.addEventListener('click',()=>{
    const k=btn.dataset.dpkey;
    if(k==='⌫'){ entered=entered.slice(0,-1); updateD(); }
    else if(entered.length<4){ entered+=k; updateD();
      if(entered.length===4) setTimeout(async ()=>{
        const storedHash = getStoredPinHash();
        let ok = false;
        if (isLegacyPinHash(storedHash)) { ok = true; }
        else { const salt = getOrCreatePinSalt(); ok = (await hashPinAsync(entered, salt)) === storedHash; }
        if(!ok){ ov.querySelectorAll('.pin-dot').forEach(d=>{d.classList.remove('filled');d.classList.add('error');}); ov.querySelector('#pind-err').textContent='PIN incorrecto'; setTimeout(()=>{entered='';updateD();},600); return; }
        setPinEnabled(false); localStorage.removeItem(PIN_STORAGE_KEY); localStorage.removeItem(PIN_SALT_KEY); clearPinRecovery(); closeModal();
        showToast('PIN desactivado ✓');
        if(document.querySelector('.sec-view')) renderSeguridadView(document.getElementById('app'));
      },80);
    }
  }));
}


function renderSeguridadRoute() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Configuración',action:()=>navigateTo('config')},{label:'Seguridad'}]);
  renderSeguridadView(document.getElementById('app'));
}
// ═══════════════════════════════════════════════
// CRISIS
// ═══════════════════════════════════════════════
const CRISIS_LEVELS = [
  {id:'leve',     label:'Leve',     color:'#ffd580', bg:'rgba(255,213,128,.15)'},
  {id:'moderado', label:'Moderado', color:'#ffb450', bg:'rgba(255,180,80,.15)'},
  {id:'severo',   label:'Severo',   color:'#ff7f7f', bg:'rgba(255,127,127,.15)'},
  {id:'extremo',  label:'Extremo',  color:'#ff3030', bg:'rgba(255,48,48,.15)'},
];
const TEC_TYPES = [
  {id:'respiracion', label:'Respiración', icon:'🌬', color:'#8affe0', bg:'rgba(138,255,224,.15)'},
  {id:'grounding',   label:'Grounding',   icon:'🌱', color:'#5fffb0', bg:'rgba(95,255,176,.15)'},
  {id:'movimiento',  label:'Movimiento',  icon:'🤸', color:'#a08aff', bg:'rgba(160,138,255,.15)'},
  {id:'cognitiva',   label:'Cognitiva',   icon:'💭', color:'#ffd580', bg:'rgba(255,213,128,.15)'},
  {id:'sensorial',   label:'Sensorial',   icon:'✋', color:'#ff8ae2', bg:'rgba(255,138,226,.15)'},
  {id:'otra',        label:'Otra',        icon:'◈',  color:'#6e6a90', bg:'rgba(110,106,144,.15)'},
];

let crisisTab = 'sos'; // 'sos' | 'protocolos' | 'tecnicas' | 'contactos' | 'historial'

// ── STORAGE ──
function loadProtocolos()    { try { return JSON.parse(localStorage.getItem('tid_protocolos'))||[];    } catch{return[];} }
function saveProtocolos(d)   { localStorage.setItem('tid_protocolos', JSON.stringify(d)); }
function loadTecnicas()      { try { return JSON.parse(localStorage.getItem('tid_tecnicas'))||[];      } catch{return[];} }
function saveTecnicas(d)     { localStorage.setItem('tid_tecnicas', JSON.stringify(d)); }
function loadContactosE()    { try { return JSON.parse(localStorage.getItem('tid_contactos_e'))||[];   } catch{return[];} }
function saveContactosE(d)   { localStorage.setItem('tid_contactos_e', JSON.stringify(d)); }
function loadCrisisLog()     { try { return JSON.parse(localStorage.getItem('tid_crisis_log'))||[];    } catch{return[];} }
function saveCrisisLog(d)    { localStorage.setItem('tid_crisis_log', JSON.stringify(d)); }

function escC(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

// ── MAIN ──
function renderCrisis() {
  return window.AtriaCrisisView.render();
}

// ════ MODALES ════
function renderBiblioteca() {
  return window.AtriaLibraryView.render();
}

function openContactoModal(item) {
  const isEdit=!!item;
  const it=item||{name:'',emoji:'◎',relation:'',contactInfo:[],alterIds:[],note:''};
  const alters=getAlters();
  let edAlters=[...(it.alterIds||[])];
  let edInfo=[...(it.contactInfo||[])];

  openModal(`
    <div class="modal-title">${isEdit?'Editar contacto':'Nuevo contacto'}</div>
    <div class="form-grid">
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Emoji / Avatar</div>
          <input type="text" id="ct-emoji" placeholder="◎" value="${escB(it.emoji||'◎')}" maxlength="4" style="font-size:20px;text-align:center">
        </div>
        <div class="form-row">
          <div class="form-label">Nombre</div>
          <input type="text" id="ct-name" placeholder="Nombre del contacto" value="${escB(it.name)}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Relación con el sistema</div>
        <input type="text" id="ct-relation" placeholder="Ej: Terapeuta, amigo de Luna, familiar…" value="${escB(it.relation||'')}">
      </div>
      <div class="form-row">
        <div class="form-label">Información de contacto</div>
        <div id="ct-info-list" style="display:flex;flex-direction:column;gap:6px">
          ${edInfo.map((ci,i)=>renderContactInfoRow(ci,i)).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-add-info" style="align-self:flex-start;margin-top:6px">+ Añadir</button>
      </div>
      <div class="form-row">
        <div class="form-label">Conocido por</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${alters.map(a=>`<div class="recur-opt${edAlters.includes(a.id)?' selected':''}" data-aid="${a.id}" style="padding:6px 10px;font-size:12px">
            ${a.emoji} ${esc(a.name)}
          </div>`).join('')}
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Notas privadas</div>
        <textarea id="ct-note" placeholder="Solo visible para el alter que lo registró…" rows="3">${escB(it.note||'')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Añadir'}</button>
    </div>`,
    (ov)=>{
      const name=ov.querySelector('#ct-name').value.trim();
      if(!name) return showToast('⚠ El nombre es obligatorio');
      const entry={id:it.id||uid(),name,emoji:ov.querySelector('#ct-emoji').value.trim()||'◎',
        relation:ov.querySelector('#ct-relation').value.trim(),contactInfo:[...edInfo],
        alterIds:[...edAlters],note:ov.querySelector('#ct-note').value.trim()};
      let list=loadContactos();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveContactos(list); closeModal(); showToast(isEdit?'Contacto actualizado ✓':'Contacto añadido ✓'); _refreshBib('contactos');
    }
  );
  const ov=document.querySelector('.modal-overlay');

  // Alter toggles
  ov.querySelectorAll('[data-aid]').forEach(opt=>opt.addEventListener('click',()=>{
    const aid=opt.dataset.aid;
    if(edAlters.includes(aid)) edAlters=edAlters.filter(x=>x!==aid); else edAlters.push(aid);
    opt.classList.toggle('selected');
  }));

  // Info rows
  function refreshInfoRows(){
    const list=ov.querySelector('#ct-info-list');
    if(!list) return;
    list.innerHTML=edInfo.map((ci,i)=>renderContactInfoRow(ci,i)).join('');
    list.querySelectorAll('[data-del-ci]').forEach(b=>b.addEventListener('click',()=>{ edInfo.splice(+b.dataset.delCi,1); refreshInfoRows(); }));
    list.querySelectorAll('[data-ci-type]').forEach(sel=>sel.addEventListener('change',()=>{ edInfo[+sel.dataset.ciType].type=sel.value; }));
    list.querySelectorAll('[data-ci-val]').forEach(inp=>inp.addEventListener('input',()=>{ edInfo[+inp.dataset.ciVal].value=inp.value; }));
  }
  ov.querySelector('#btn-add-info')?.addEventListener('click',()=>{ edInfo.push({type:'telefono',value:''}); refreshInfoRows(); });
  ov.querySelectorAll('[data-del-ci]').forEach(b=>b.addEventListener('click',()=>{ edInfo.splice(+b.dataset.delCi,1); refreshInfoRows(); }));
  ov.querySelectorAll('[data-ci-type]').forEach(sel=>sel.addEventListener('change',()=>{ edInfo[+sel.dataset.ciType].type=sel.value; }));
  ov.querySelectorAll('[data-ci-val]').forEach(inp=>inp.addEventListener('input',()=>{ edInfo[+inp.dataset.ciVal].value=inp.value; }));
}

function renderContactInfoRow(ci, i) {
  return `<div style="display:flex;gap:6px;align-items:center">
    <select data-ci-type="${i}" style="flex-shrink:0;width:120px">
      ${REDES.map(r=>`<option value="${r.id}" ${ci.type===r.id?'selected':''}>${r.icon} ${r.label}</option>`).join('')}
    </select>
    <input type="text" data-ci-val="${i}" value="${escB(ci.value)}" placeholder="valor…" style="flex:1">
    <button class="icon-btn" data-del-ci="${i}" style="flex-shrink:0">✕</button>
  </div>`;
}

function openRecursoModal(item) {
  const isEdit=!!item;
  const it=item||{title:'',desc:'',url:'',category:'articulo',alterId:activeAlter?.id||'',tags:[]};
  const alters=getAlters();
  let edTags=[...(it.tags||[])];

  openModal(`
    <div class="modal-title">${isEdit?'Editar recurso':'Nuevo recurso'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="rc-title" placeholder="Nombre del recurso" value="${escB(it.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción</div>
        <textarea id="rc-desc" placeholder="¿De qué trata? ¿Por qué es útil?">${escB(it.desc||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">URL / Enlace</div>
        <input type="url" id="rc-url" placeholder="https://…" value="${escB(it.url||'')}">
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Categoría</div>
          <select id="rc-cat">
            ${REC_CATS.map(c=>`<option value="${c.id}" ${it.category===c.id?'selected':''}>${c.icon} ${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Recomendado por</div>
          <select id="rc-alter">
            <option value="">—</option>
            ${alters.map(a=>`<option value="${a.id}" ${it.alterId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Etiquetas</div>
        <div id="rc-tags-row" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:6px 10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;min-height:36px">
          ${edTags.map((t,i)=>`<span class="tag-pill-rm">${esc(t)}<button data-ti="${i}">✕</button></span>`).join('')}
          <input class="tag-input" id="rc-tag-input" placeholder="etiqueta…" style="flex:1;min-width:60px">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Añadir'}</button>
    </div>`,
    (ov)=>{
      const title=ov.querySelector('#rc-title').value.trim();
      if(!title) return showToast('⚠ El título es obligatorio');
      const entry={id:it.id||uid(),title,desc:ov.querySelector('#rc-desc').value.trim(),
        url:ov.querySelector('#rc-url').value.trim(),category:ov.querySelector('#rc-cat').value,
        alterId:ov.querySelector('#rc-alter').value||null,tags:[...edTags],ts:it.ts||Date.now()};
      let list=loadRecursos();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveRecursos(list); closeModal(); showToast(isEdit?'Recurso actualizado ✓':'Recurso añadido ✓'); _refreshBib('recursos');
    }
  );
  const ov=document.querySelector('.modal-overlay');
  function refreshRcTags(){
    const row=ov.querySelector('#rc-tags-row'); if(!row) return;
    row.innerHTML=`${edTags.map((t,i)=>`<span class="tag-pill-rm">${esc(t)}<button data-ti="${i}">✕</button></span>`).join('')}<input class="tag-input" id="rc-tag-input" placeholder="etiqueta…" style="flex:1;min-width:60px">`;
    row.querySelectorAll('[data-ti]').forEach(b=>b.addEventListener('click',()=>{ edTags.splice(+b.dataset.ti,1); refreshRcTags(); }));
    ov.querySelector('#rc-tag-input')?.addEventListener('keydown',rcTagKey);
  }
  function rcTagKey(e){
    if((e.key==='Enter'||e.key===','||e.key===' ')&&e.target.value.trim()){
      e.preventDefault(); const t=e.target.value.trim().toLowerCase().replace(/[^a-z0-9áéíóúüñ-]/g,'');
      if(t&&!edTags.includes(t)) edTags.push(t); refreshRcTags();
    }
    if(e.key==='Backspace'&&!e.target.value&&edTags.length){ edTags.pop(); refreshRcTags(); }
  }
  ov.querySelectorAll('[data-ti]').forEach(b=>b.addEventListener('click',()=>{ edTags.splice(+b.dataset.ti,1); refreshRcTags(); }));
  ov.querySelector('#rc-tag-input')?.addEventListener('keydown',rcTagKey);
}

function openDocumentoModal(item) {
  const isEdit=!!item;
  const it=item||{name:'',desc:'',url:'',category:'personal',alterId:activeAlter?.id||'',access:'privado'};
  const alters=getAlters();

  openModal(`
    <div class="modal-title">${isEdit?'Editar documento':'Nuevo documento'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Nombre</div>
        <input type="text" id="dc-name" placeholder="Nombre del documento" value="${escB(it.name)}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción</div>
        <textarea id="dc-desc" placeholder="¿Qué contiene este documento?">${escB(it.desc||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Enlace / URL (opcional)</div>
        <input type="url" id="dc-url" placeholder="https://… o ruta de archivo" value="${escB(it.url||'')}">
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Categoría</div>
          <select id="dc-cat">
            ${DOC_CATS.map(c=>`<option value="${c.id}" ${it.category===c.id?'selected':''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Propietario</div>
          <select id="dc-alter">
            <option value="">Sistema</option>
            ${alters.map(a=>`<option value="${a.id}" ${it.alterId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Acceso</div>
        <div style="display:flex;gap:8px">
          <div class="recur-opt${(it.access||'privado')==='privado'?' selected':''}" data-acc="privado" style="flex:1;text-align:center;padding:10px 8px">
            <div style="font-size:16px">🔒</div><div style="font-size:11px;margin-top:4px;font-weight:600">Privado</div>
            <div style="font-size:10px;color:var(--text-2);margin-top:2px">Solo el propietario</div>
          </div>
          <div class="recur-opt${it.access==='compartido'?' selected':''}" data-acc="compartido" style="flex:1;text-align:center;padding:10px 8px">
            <div style="font-size:16px">◎</div><div style="font-size:11px;margin-top:4px;font-weight:600">Compartido</div>
            <div style="font-size:10px;color:var(--text-2);margin-top:2px">Todos los alters</div>
          </div>
        </div>
        <input type="hidden" id="dc-access" value="${it.access||'privado'}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Añadir'}</button>
    </div>`,
    (ov)=>{
      const name=ov.querySelector('#dc-name').value.trim();
      if(!name) return showToast('⚠ El nombre es obligatorio');
      const entry={id:it.id||uid(),name,desc:ov.querySelector('#dc-desc').value.trim(),
        url:ov.querySelector('#dc-url').value.trim(),category:ov.querySelector('#dc-cat').value,
        alterId:ov.querySelector('#dc-alter').value||null,access:ov.querySelector('#dc-access').value,
        ts:it.ts||Date.now()};
      let list=loadDocumentos();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveDocumentos(list); closeModal(); showToast(isEdit?'Documento actualizado ✓':'Documento añadido ✓'); _refreshBib('documentos');
    }
  );
  const ov=document.querySelector('.modal-overlay');
  ov.querySelectorAll('[data-acc]').forEach(opt=>opt.addEventListener('click',()=>{
    ov.querySelectorAll('[data-acc]').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected'); ov.querySelector('#dc-access').value=opt.dataset.acc;
  }));
}

// ═══════════════════════════════════════════════
// MEMORIA
// ═══════════════════════════════════════════════
const TL_TYPES = [
  {id:'hito',       label:'Hito',       color:'#a08aff', bg:'rgba(160,138,255,.15)'},
  {id:'cambio',     label:'Cambio',     color:'#ffb450', bg:'rgba(255,180,80,.15)'},
  {id:'crisis',     label:'Crisis',     color:'#ff7f7f', bg:'rgba(255,127,127,.15)'},
  {id:'logro',      label:'Logro',      color:'#5fffb0', bg:'rgba(95,255,176,.15)'},
  {id:'reflexion',  label:'Reflexión',  color:'#ff8ae2', bg:'rgba(255,138,226,.15)'},
];
const CAMBIO_IMPORTANCE = [
  {id:'bajo',  emoji:'○', color:'var(--text-2)'},
  {id:'medio', emoji:'◑', color:'var(--accent-4)'},
  {id:'alto',  emoji:'⬤', color:'var(--accent)'},
  {id:'critico',emoji:'⚠',color:'var(--red)'},
];

// ═══════════════════════════════════════════════
// TABLÓN DEL SISTEMA
// ═══════════════════════════════════════════════

// ── STORAGE ──
function loadTablon()  { try { return JSON.parse(localStorage.getItem('tid_tablon'))||[]; } catch{return[];} }
function saveTablon(t) { localStorage.setItem('tid_tablon', JSON.stringify(t)); }

// ── HELPERS ──
function openTablonCompose(onDone) {
  openModal(`
    <div class="modal-title">◈ Escribir en el tablón</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Mensaje para el sistema</div>
        <textarea id="tablon-msg-text" class="tablon-textarea" placeholder="Escribe algo para que lo vean todos los alters..." style="min-height:100px"></textarea>
      </div>
      <div class="form-row" style="flex-direction:row;align-items:center;gap:10px">
        <input type="checkbox" id="tablon-pin-check" style="width:16px;height:16px;accent-color:var(--accent)">
        <label for="tablon-pin-check" style="font-size:12px;color:var(--text-1);cursor:pointer">Fijar este mensaje (reemplaza el mensaje fijado actual)</label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>Publicar</button>
    </div>`,
    (ov)=>{
      const text = ov.querySelector('#tablon-msg-text').value.trim();
      if(!text) return showToast('⚠ Escribe algo primero');
      const pinned = ov.querySelector('#tablon-pin-check').checked;
      let msgs = loadTablon();
      // Si se fija, desfijar el anterior
      if(pinned) msgs = msgs.map(m=>({...m, pinned:false}));
      msgs.unshift({id:uid(), alterId:activeAlter.id, text, pinned, ts:Date.now()});
      saveTablon(msgs);
      showToast('Mensaje publicado ✓');
      if(onDone) onDone();
    }
  );
}

// ── RENDER PRINCIPAL ──
function renderTablon() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Tablón'}]);
  renderTablonView();
}

function renderTablonView() {
  const app = document.getElementById('app');
  const alters = getAlters();
  const msgs = loadTablon().sort((a,b)=>{
    // Pinned first, then by date
    if(a.pinned && !b.pinned) return -1;
    if(!a.pinned && b.pinned) return 1;
    return b.ts - a.ts;
  });
  const pinned = msgs.find(m=>m.pinned);

  const fmtTs = ts => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if(diff < 60000) return 'Ahora mismo';
    if(diff < 3600000) return Math.floor(diff/60000)+'m';
    if(d.toDateString()===now.toDateString()) return d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
    return d.toLocaleDateString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  };

  app.innerHTML = `
    <div class="tablon-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◈ Tablón del sistema</div>
          <div class="fin-subtitle">Mensajes visibles para todos los alters</div>
        </div>
        <button class="btn btn-primary" id="btn-tablon-new">+ Escribir</button>
      </div>

      ${pinned ? `
      <!-- MENSAJE FIJADO -->
      <div class="tablon-pin">
        <div class="tablon-pin-label">◈ Mensaje fijado</div>
        <div class="tablon-pin-body">${escM(pinned.text)}</div>
        <div class="tablon-pin-meta">
          ${(() => { const a=alters.find(x=>x.id===pinned.alterId)||{emoji:'◎',name:'Sistema',color:'var(--accent)'}; return `<span style="display:flex;align-items:center;gap:6px"><span style="font-size:14px">${a.emoji}</span><span style="font-weight:700;color:${a.color}">${esc(a.name)}</span></span>`; })()}
          <span>${fmtTs(pinned.ts)}</span>
          <button class="btn btn-ghost" style="padding:2px 8px;font-size:10px" data-unpin="${pinned.id}">Desfijar</button>
        </div>
      </div>` : ''}

      <!-- COMPOSE -->
      <div class="tablon-compose">
        <div class="tablon-compose-header">
          <div class="tablon-compose-av" style="background:${activeAlter.bg};border-color:${activeAlter.color};overflow:hidden">${alterAv(activeAlter,30)}</div>
          <div class="tablon-compose-name" style="color:${activeAlter.color}">${activeAlter.name}</div>
        </div>
        <textarea id="tablon-inline-text" class="tablon-textarea" placeholder="Escribe algo para el sistema..."></textarea>
        <div class="tablon-compose-footer">
          <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-2);cursor:pointer">
            <input type="checkbox" id="tablon-inline-pin" style="accent-color:var(--accent)">
            Fijar mensaje
          </label>
          <button class="btn btn-primary" id="btn-tablon-publish" style="margin-left:auto">Publicar</button>
        </div>
      </div>

      <!-- MENSAJES -->
      ${msgs.filter(m=>!m.pinned).length === 0 && !pinned ? `
      <div class="empty-state" style="padding:40px 20px">
        <div class="empty-icon">◈</div>
        <div>El tablón está vacío</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);margin-top:6px">Sé el primero en escribir</div>
      </div>` : `
      <div class="tablon-msg-list">
        ${msgs.filter(m=>!m.pinned).map(m=>{
          const a = alters.find(x=>x.id===m.alterId)||{emoji:'◎',bg:'var(--bg-2)',color:'var(--border)',name:'Sistema'};
          const isOwn = m.alterId===activeAlter.id;
          return `<div class="tablon-msg${m.pinned?' pinned':''}">
            <div class="tablon-msg-av" style="background:${a.bg};border-color:${a.color};overflow:hidden">${alterAv(a,34)}</div>
            <div class="tablon-msg-body">
              <div class="tablon-msg-header">
                <span class="tablon-msg-name" style="color:${a.color}">${esc(a.name)}</span>
                <span class="tablon-msg-ts">${fmtTs(m.ts)}</span>
              </div>
              <div class="tablon-msg-text">${escM(m.text)}</div>
              <div class="tablon-msg-actions">
                <button class="btn btn-ghost" style="padding:3px 8px;font-size:10px" data-pin-msg="${m.id}">◈ Fijar</button>
                ${isOwn?`<button class="icon-btn" data-del-msg="${m.id}">✕</button>`:''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>`;

  // Wire
  app.querySelector('#btn-tablon-new')?.addEventListener('click',()=>openTablonCompose(()=>renderTablonView()));
  app.querySelector('#btn-tablon-publish')?.addEventListener('click',()=>{
    const text = app.querySelector('#tablon-inline-text').value.trim();
    if(!text) return showToast('⚠ Escribe algo primero');
    const pinned = app.querySelector('#tablon-inline-pin').checked;
    let msgs = loadTablon();
    if(pinned) msgs = msgs.map(m=>({...m,pinned:false}));
    msgs.unshift({id:uid(), alterId:activeAlter.id, text, pinned, ts:Date.now()});
    saveTablon(msgs);
    showToast('Mensaje publicado ✓');
    renderTablonView();
  });
  app.querySelector('[data-unpin]')?.addEventListener('click',e=>{
    const id=e.target.dataset.unpin;
    saveTablon(loadTablon().map(m=>m.id===id?{...m,pinned:false}:m));
    renderTablonView();
  });
  app.querySelectorAll('[data-pin-msg]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=btn.dataset.pinMsg;
      let msgs=loadTablon().map(m=>({...m,pinned:false}));
      msgs=msgs.map(m=>m.id===id?{...m,pinned:true}:m);
      saveTablon(msgs);
      showToast('Mensaje fijado ✓');
      renderTablonView();
    });
  });
  app.querySelectorAll('[data-del-msg]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!confirm('¿Eliminar este mensaje?')) return;
      saveTablon(loadTablon().filter(m=>m.id!==btn.dataset.delMsg));
      showToast('Mensaje eliminado');
      renderTablonView();
    });
  });
}

// ═══════════════════════════════════════════════
// FRONTING
// ═══════════════════════════════════════════════

// ── STORAGE ──
function loadFronting()  { try { return JSON.parse(localStorage.getItem('tid_fronting'))||[]; } catch{return[];} }
let _onlineFrontingPresenceTimer = null;
function publishOnlineFrontingPresenceSoon() {
  if (typeof getOnlineProfile !== 'function' || typeof hasOnlineBackendConfigured !== 'function' || typeof setOnlinePresenceState !== 'function') return;
  if (!getOnlineProfile().enabled || !getOnlineProfile().fronting || !hasOnlineBackendConfigured()) return;
  if (_onlineFrontingPresenceTimer) clearTimeout(_onlineFrontingPresenceTimer);
  _onlineFrontingPresenceTimer = setTimeout(() => {
    _onlineFrontingPresenceTimer = null;
    setOnlinePresenceState(loadOnlineSession()?.presenceState || 'online').catch(() => {});
  }, 120);
}
function saveFronting(f) {
  localStorage.setItem('tid_fronting', JSON.stringify(f));
  publishOnlineFrontingPresenceSoon();
}
function loadFrontSchedule()  { try { return JSON.parse(localStorage.getItem('tid_front_schedule'))||[]; } catch{return[];} }
function saveFrontSchedule(s) { localStorage.setItem('tid_front_schedule', JSON.stringify(s)); }

// ── MODAL CONFIRMACIÓN SWITCH (al entrar como alter diferente al que fronta) ──
function openConfirmarSwitchModal(alterId) {
  const alters = getAlters();
  const a = alters.find(x => x.id === alterId);
  const current = getFrontingActual();
  const prev = current ? alters.find(x => x.id === current.alterId) : null;
  if (!a) return;
  const otherAlters = alters.filter(x => x.id !== alterId);
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal">
    <div class="modal-title">◉ ¿Registrar switch de fronting?</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
      ${prev ? `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-2);border-radius:8px">
        <div style="width:36px;height:36px;border-radius:50%;background:${prev.bg};border:2px solid ${prev.color};display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">${alterAv(prev,36)}</div>
        <div>
          <div style="font-size:11px;color:var(--text-3);font-family:'DM Mono',monospace">Fronting actual</div>
          <div style="font-weight:800;color:${prev.color}">${prev.name}</div>
        </div>
      </div>` : ''}
      <div style="text-align:center;color:var(--text-3);font-size:18px">↓</div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-2);border-radius:8px;border:1px solid ${a.color}40">
        <div style="width:36px;height:36px;border-radius:50%;background:${a.bg};border:2px solid ${a.color};display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">${alterAv(a,36)}</div>
        <div>
          <div style="font-size:11px;color:var(--text-3);font-family:'DM Mono',monospace">Nuevo fronting</div>
          <div style="font-weight:800;color:${a.color}">${esc(a.name)}</div>
        </div>
      </div>
      ${otherAlters.length ? `<div>
        <div style="font-size:11px;color:var(--text-2);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">¿Alguien más al frente? (co-front)</div>
        <div id="switch-cofront-row" style="display:flex;flex-wrap:wrap;gap:6px">
          ${otherAlters.map(x=>`
            <div class="front-cofront-chip" data-caid="${x.id}" style="--chip-color:${x.color};--chip-bg:${x.bg}">
              <span style="font-size:14px">${x.emoji||'◎'}</span>
              <span class="front-cofront-chip-name">${esc(x.name)}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}
    </div>
    <div class="modal-footer" style="flex-direction:column;gap:8px">
      <button class="btn btn-primary" style="width:100%" id="btn-confirm-switch">◉ Sí, registrar switch</button>
      <button class="btn btn-ghost" style="width:100%" id="btn-cancel-switch">No, solo estoy usando la app</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.querySelectorAll('.front-cofront-chip[data-caid]').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });
  ov.querySelector('#btn-cancel-switch').addEventListener('click', () => ov.remove());
  ov.querySelector('#btn-confirm-switch').addEventListener('click', () => {
    const coFronting = [...ov.querySelectorAll('.front-cofront-chip.active')].map(c => c.dataset.caid);
    ov.remove();
    iniciarFronting(alterId, coFronting);
    const coNames = coFronting.map(id => alters.find(x=>x.id===id)?.name).filter(Boolean);
    const coLabel = coNames.length ? ` + ${coNames.join(', ')}` : '';
    showToast(`◉ Switch registrado → ${a.name}${coLabel}`);
    if (currentView === 'hub') renderHub();
    else if (currentView === 'fronting') renderFronting();
  });
}

// ── MODAL SWITCH RÁPIDO DESDE HUB (un solo paso) ──
function openQuickSwitchModal() {
  const alters = getAlters();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal">
    <div class="modal-title">⇄ Switch rápido</div>
    <div style="font-size:12px;color:var(--text-2);margin-bottom:12px">Selecciona quién está al frente ahora</div>
    <div id="qs-alter-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      ${alters.map(a=>`
        <div class="front-cofront-chip" data-qsid="${a.id}" style="--chip-color:${a.color};--chip-bg:${a.bg}">
          <span style="font-size:16px">${a.emoji||'◎'}</span>
          <span class="front-cofront-chip-name">${esc(a.name)}</span>
        </div>`).join('')}
    </div>
    <div id="qs-cofront-section" style="display:none">
      <div style="font-size:11px;color:var(--text-2);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">¿Alguien más al frente?</div>
      <div id="qs-cofront-row" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
    <div class="modal-footer" style="margin-top:16px">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" id="btn-qs-confirm" disabled>◉ Registrar switch</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('[data-cancel]').addEventListener('click', () => ov.remove());

  let selectedId = null;
  const grid = ov.querySelector('#qs-alter-grid');
  const coSection = ov.querySelector('#qs-cofront-section');
  const coRow = ov.querySelector('#qs-cofront-row');
  const btnConfirm = ov.querySelector('#btn-qs-confirm');

  grid.querySelectorAll('[data-qsid]').forEach(chip => {
    chip.addEventListener('click', () => {
      grid.querySelectorAll('[data-qsid]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedId = chip.dataset.qsid;
      btnConfirm.disabled = false;
      // Mostrar co-front con los demás
      const others = alters.filter(a => a.id !== selectedId);
      if (others.length) {
        coRow.innerHTML = others.map(a=>`
          <div class="front-cofront-chip" data-qscaid="${a.id}" style="--chip-color:${a.color};--chip-bg:${a.bg}">
            <span style="font-size:14px">${a.emoji||'◎'}</span>
            <span class="front-cofront-chip-name">${esc(a.name)}</span>
          </div>`).join('');
        coRow.querySelectorAll('[data-qscaid]').forEach(c => c.addEventListener('click', () => c.classList.toggle('active')));
        coSection.style.display = '';
      } else {
        coSection.style.display = 'none';
      }
    });
  });

  btnConfirm.addEventListener('click', () => {
    if (!selectedId) return;
    const coFronting = [...ov.querySelectorAll('[data-qscaid].active')].map(c => c.dataset.qscaid);
    ov.remove();
    iniciarFronting(selectedId, coFronting);
    const fa = alters.find(a=>a.id===selectedId);
    if (fa) {
      activeAlter = fa;
      const sbAv = document.getElementById('sb-avatar');
      if (sbAv) {
        sbAv.innerHTML = alterAv(fa, 34);
        sbAv.style.cssText = `background:${fa.bg};border-color:${fa.color}`;
      }
      const sbName = document.getElementById('sb-name');
      const sbRole = document.getElementById('sb-role');
      if (sbName) sbName.textContent = fa.name;
      if (sbRole) sbRole.textContent = fa.role || '';
      renderSidebarNav();
    }
    const coNames = coFronting.map(id => alters.find(a=>a.id===id)?.name).filter(Boolean);
    showToast(`◉ Switch → ${fa?.name||''}${coNames.length?' + '+coNames.join(', '):''}`);
    if (currentView === 'hub') renderHub();
    else if (currentView === 'fronting') renderFronting();
  });
}

// ── MODAL REGISTRO MANUAL DE SWITCH (desde módulo Fronting) ──
function openFrontingRegistroManual() {
  const alters = getAlters();
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  openModal(`
    <div class="modal-title">◉ Registrar switch</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">¿Quién fronta?</div>
        <select id="frs-alter" class="form-input">
          ${alters.map(a => `<option value="${a.id}">${a.emoji || '◎'} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-label">Inicio de sesión</div>
        <input type="datetime-local" id="frs-start" class="form-input" value="${localISO}">
      </div>
      <div class="form-row">
        <div class="form-label" style="display:flex;align-items:center;gap:8px">
          Fin de sesión
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(vacío = sesión abierta)</span>
        </div>
        <input type="datetime-local" id="frs-end" class="form-input" value="">
      </div>
      <div class="form-row">
        <div class="form-label">Nota <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(opcional)</span></div>
        <textarea id="frs-note" class="front-note-input" placeholder="Contexto, cómo se sentía, qué estaba pasando..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Co-fronting <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(opcional)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${alters.map(a => `<label class="front-cofront-chip" style="--chip-color:${a.color};--chip-bg:${a.bg}"><input type="checkbox" data-frs-coid="${a.id}" style="accent-color:${a.color}"><span>${a.emoji || '◎'}</span><span class="front-cofront-chip-name">${esc(a.name)}</span></label>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>Guardar</button>
    </div>`,
    (ov) => {
      const alterId = ov.querySelector('#frs-alter').value;
      const startVal = ov.querySelector('#frs-start').value;
      const endVal   = ov.querySelector('#frs-end').value;
      const coFronting = [...ov.querySelectorAll('[data-frs-coid]:checked')].map(c => c.dataset.frsCoid).filter(id => id && id !== alterId);
      const note     = ov.querySelector('#frs-note').value.trim();
      if (!alterId || !startVal) { showToast('Faltan datos obligatorios'); return; }
      const startMs = new Date(startVal).getTime();
      const endMs   = endVal ? new Date(endVal).getTime() : null;
      if (endMs && endMs <= startMs) { showToast('El fin debe ser posterior al inicio'); return; }
      // Si la nueva sesión es "abierta", cerrar la actual
      const sessions = loadFronting();
      if (!endMs) {
        const open = sessions.find(s => !s.end);
        if (open) { open.end = startMs; open.duration = open.end - open.start; }
      }
      sessions.push({
        id: uid(),
        alterId,
        coFronting,
        start: startMs,
        end: endMs,
        duration: endMs ? endMs - startMs : null,
        note,
        manual: true
      });
      saveFronting(sessions);
      showToast('◉ Switch registrado ✓');
      renderFrontingView();
    }
  );
}

// ── NOTIFICACIÓN PERSISTENTE DE FRONTING ──
async function fireFrontingNotif(alterId, coFronting) {
  if (!nativeNotifGranted()) return;
  const alters = getAlters();
  const fa = alters.find(a=>a.id===alterId);
  if (!fa) return;
  const coNames = (coFronting||[]).map(id=>alters.find(a=>a.id===id)?.name).filter(Boolean);
  const body = coNames.length ? `Co-front: ${coNames.join(', ')}` : 'Sesión activa';
  await fireNativeNotif({
    title: `◉ ${fa.name} al frente`,
    body,
    tag: 'atria-front-active',
    nav: 'fronting',
  });
}

// ── LÓGICA CORE ──
function iniciarFronting(alterId, coFronting) {
  const sessions = loadFronting();
  // Cerrar sesión abierta anterior
  const open = sessions.find(s=>!s.end);
  if(open) { open.end = Date.now(); open.duration = open.end - open.start; }
  // Abrir nueva sesión
  sessions.push({id:uid(), alterId, coFronting: coFronting||[], start:Date.now(), end:null, duration:null, note:''});
  saveFronting(sessions);
  // Notificación persistente (no bloquea)
  fireFrontingNotif(alterId, coFronting).catch(()=>{});
}

function cerrarFronting() {
  const sessions = loadFronting();
  const open = sessions.find(s=>!s.end);
  if(open) { open.end = Date.now(); open.duration = open.end - open.start; saveFronting(sessions); }
}

function getFrontingActual() {
  return loadFronting().find(s=>!s.end)||null;
}

function addCoFronting(alterId) {
  const sessions = loadFronting();
  const open = sessions.find(s=>!s.end);
  if(!open) return;
  if(!open.coFronting) open.coFronting=[];
  if(!open.coFronting.includes(alterId)) open.coFronting.push(alterId);
  else open.coFronting = open.coFronting.filter(id=>id!==alterId);
  saveFronting(sessions);
}

function setFrontingNote(note) {
  const sessions = loadFronting();
  const open = sessions.find(s=>!s.end);
  if(!open) return;
  open.note = note;
  saveFronting(sessions);
}

function setFrontingCustomState(stateId) {
  const sessions = loadFronting();
  const open = sessions.find(s=>!s.end);
  if(!open) return;
  // Toggle: si ya tiene este estado, quitar; si no, poner
  open.customState = open.customState === stateId ? null : stateId;
  saveFronting(sessions);
}

function fmtFrontDuration(ms) {
  if(!ms) return '—';
  const m = Math.floor(ms/60000);
  const h = Math.floor(m/60);
  const d = Math.floor(h/24);
  if(d>0) return d+'d '+( h%24)+'h';
  if(h>0) return h+'h '+(m%60)+'m';
  return m+'m';
}

// ── MODALES RÁPIDOS ──
function openFrontingSwitch() {
  // Volver a layer 0 para seleccionar alter, igual que el botón "Cambiar alter" del sidebar
  activeAlter = null;
  closeModal();
  document.getElementById('shell').classList.remove('visible');
  const l0 = document.getElementById('layer-0');
  l0.classList.remove('exit');
}

function openFrontingNoteModal() {
  const current = getFrontingActual();
  const note = current?.note||'';
  openModal(`
    <div class="modal-title">Nota de sesión</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Nota visible para el historial</div>
        <textarea id="front-note-val" class="front-note-input" placeholder="Cómo te sientes, qué estás haciendo, notas para el sistema...">${note}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>Guardar</button>
    </div>`,
    (ov)=>{
      setFrontingNote(ov.querySelector('#front-note-val').value.trim());
      showToast('Nota guardada ✓');
      if(currentView==='hub') renderHub();
      else if(currentView==='fronting') renderFronting();
    }
  );
}

// ── RENDER PRINCIPAL ──
let frontingTab = 'actual'; // 'actual' | 'historial' | 'timeline' | 'stats' | 'planif'
let _histFilterAlterId = null; // filtro activo en tab historial
let rutinasTab = 'hoy'; // 'hoy' | 'todas' | 'plantillas' | 'adherencia'

function renderFronting() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Fronting'}]);
  renderFrontingView();
}

function renderFrontingView() {
  const app = document.getElementById('app');
  const alters = getAlters();
  const current = getFrontingActual();
  const sessions = loadFronting().filter(s=>s.end).sort((a,b)=>b.start-a.start);

  app.innerHTML = `
    <div class="front-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◉ Fronting</div>
          <div class="fin-subtitle">Registro de presencia al frente del sistema</div>
        </div>
        <button class="btn btn-primary" id="btn-front-switch">⇄ Cambiar alter</button>
      </div>

      <div class="mem-tabs">
        ${[
          {id:'actual',    label:'◉ Ahora'},
          {id:'historial', label:'◌ Historial'},
          {id:'timeline',  label:'◫ Línea temporal'},
          {id:'stats',     label:'◈ Estadísticas'},
          {id:'planif',    label:'◷ Planificación'},
        ].map(t=>`<div class="mem-tab${frontingTab===t.id?' active':''}" data-ft="${t.id}">${t.label}</div>`).join('')}
      </div>

      <div id="front-content"></div>
    </div>`;

  app.querySelectorAll('.mem-tab[data-ft]').forEach(t=>t.addEventListener('click',()=>{ frontingTab=t.dataset.ft; renderFrontingView(); }));
  app.querySelector('#btn-front-switch')?.addEventListener('click',()=>openFrontingSwitch());

  const cont = app.querySelector('#front-content');
  if(frontingTab==='actual')    { renderFrontActual(cont, alters, current); renderFrontPresetsSection(cont, alters); }
  if(frontingTab==='historial') renderFrontHistorial(cont, alters, sessions);
  if(frontingTab==='timeline')  renderFrontTimeline(cont, alters, sessions);
  if(frontingTab==='stats')     renderFrontStats(cont, alters, sessions);
  if(frontingTab==='planif')    renderFrontPlanif(cont, alters);
}

// ── TAB ACTUAL ──
function renderFrontActual(cont, alters, current) {
  if(!current) {
    cont.innerHTML=`<div class="empty-state" style="padding:40px 20px">
      <div class="empty-icon">◉</div>
      <div>Sin sesión activa</div>
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);margin-top:6px;margin-bottom:16px">Selecciona alter al entrar o registra un switch manualmente</div>
      <button class="btn btn-primary" id="btn-front-manual">◉ Registrar switch</button>
    </div>`;
    cont.querySelector('#btn-front-manual')?.addEventListener('click', openFrontingRegistroManual);
    return;
  }
  const fa = alters.find(a=>a.id===current.alterId);
  if(!fa) { cont.innerHTML='<div class="empty-state">Alter no encontrado</div>'; return; }

  const ms = Date.now()-current.start;
  const m = Math.floor(ms/60000); const h=Math.floor(m/60);
  const elapsed = h>0 ? h+'h '+(m%60)+'m' : m+'m';

  const coAlters = (current.coFronting||[]).map(cid=>alters.find(a=>a.id===cid)).filter(Boolean);

  cont.innerHTML=`
    <!-- PANEL PRINCIPAL -->
    <div class="front-panel">
      <div class="front-panel-label">◉ Al frente ahora</div>
      <div class="front-alter-row">
        <div class="front-avatar-lg" style="background:${fa.bg};border-color:${fa.color};overflow:hidden">${alterAv(fa,58)}</div>
        <div class="front-alter-info">
          <div class="front-alter-name" style="color:${fa.color}">${fa.name}</div>
          <div class="front-alter-role">${fa.role||''}</div>
        </div>
        <div class="front-timer">◷ ${elapsed}</div>
      </div>

      <!-- NOTA DE SESIÓN -->
      <div>
        <div class="form-label" style="margin-bottom:6px">Nota de sesión</div>
        <textarea id="front-session-note" class="front-note-input" placeholder="Cómo te sientes, qué estás haciendo...">${current.note||''}</textarea>
        <button class="btn btn-ghost" id="btn-save-note" style="margin-top:6px;font-size:11px">Guardar nota</button>
      </div>

      <!-- ESTADO DE SESIÓN -->
      <div>
        <div class="form-label" style="margin-bottom:8px">Estado de sesión <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(opcional)</span></div>
        <div class="front-cofronting-row">
          ${FRONT_CUSTOM_STATES.map(s=>`
            <div class="front-cofront-chip${current.customState===s.id?' active':''}" data-fstate="${s.id}"
              style="--chip-color:var(--accent-2);--chip-bg:rgba(255,138,226,0.1)">
              <span style="font-size:13px">${s.icon}</span>
              <span class="front-cofront-chip-name">${s.label}</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- CO-FRONTING -->
      <div>
        <div class="form-label" style="margin-bottom:8px">Co-fronting</div>
        <div class="front-cofronting-row">
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">Selecciona:</span>
          ${alters.filter(a=>a.id!==fa.id).map(a=>`
            <div class="front-cofront-chip${(current.coFronting||[]).includes(a.id)?' active':''}" data-caid="${a.id}"
              style="--chip-color:${a.color};--chip-bg:${a.bg}">
              <span style="font-size:15px">${a.emoji}</span>
              <span class="front-cofront-chip-name">${esc(a.name)}</span>
            </div>
          `).join('')}
          ${alters.filter(a=>a.id!==fa.id).length===0?'<span style="font-size:11px;color:var(--text-3)">No hay otros alters</span>':''}
        </div>
        ${coAlters.length?`<div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">También al frente:</span>
          ${coAlters.map(ca=>`<span style="font-size:12px;padding:3px 8px;background:${ca.bg};border:1px solid ${ca.color}40;border-radius:5px;font-weight:700">${ca.emoji} ${ca.name}</span>`).join('')}
        </div>`:''}
      </div>
    </div>

    <!-- GUARDAR PRESET + INICIO DE SESIÓN -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:4px 0">
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);display:flex;gap:16px;flex-wrap:wrap">
      <span>Inicio: ${new Date(current.start).toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
      <span>·</span>
      <span>Duración: <span data-live-dur>${elapsed}</span></span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="btn-front-manual-panel">◉ Registrar otro switch</button>
        <button class="btn btn-ghost btn-sm" id="btn-save-preset">◈ Guardar combinación</button>
      </div>
    </div>`;

  // Wire co-fronting toggles
  cont.querySelectorAll('.front-cofront-chip[data-caid]').forEach(el=>{
    el.addEventListener('click',()=>{
      addCoFronting(el.dataset.caid);
      renderFrontingView();
    });
  });
  // Wire nota
  cont.querySelector('#btn-save-note')?.addEventListener('click',()=>{
    setFrontingNote(cont.querySelector('#front-session-note').value.trim());
    showToast('Nota guardada ✓');
  });
  // Wire estado de sesión
  cont.querySelectorAll('.front-cofront-chip[data-fstate]').forEach(el=>{
    el.addEventListener('click',()=>{
      setFrontingCustomState(el.dataset.fstate);
      renderFrontingView();
    });
  });
  // Wire guardar combinación
  cont.querySelector('#btn-save-preset')?.addEventListener('click',()=>openSavePresetModal(current, alters));
  // Wire registro manual desde panel activo
  cont.querySelector('#btn-front-manual-panel')?.addEventListener('click', openFrontingRegistroManual);

  // Timer en vivo: actualizar elapsed cada 60s
  if (_frontTimerInterval) clearInterval(_frontTimerInterval);
  _frontTimerInterval = setInterval(() => {
    const timerEl = cont.querySelector('.front-timer');
    const metaEl  = cont.querySelectorAll('.front-meta-inline');
    if (!timerEl) { clearInterval(_frontTimerInterval); _frontTimerInterval = null; return; }
    const msCur = Date.now() - current.start;
    const mCur  = Math.floor(msCur/60000), hCur = Math.floor(mCur/60);
    const elapsedCur = hCur>0 ? hCur+'h '+(mCur%60)+'m' : mCur+'m';
    timerEl.textContent = '◷ ' + elapsedCur;
    cont.querySelectorAll('[data-live-dur]').forEach(el => { el.textContent = elapsedCur; });
  }, 60000);
}

// ── TAB ACTUAL: PRESETS ──
function renderFrontPresetsSection(cont, alters) {
  const presets = loadFrontPresets();
  if (!presets.length) return;
  const div = document.createElement('div');
  div.style.cssText = 'margin-top:16px';
  div.innerHTML = `
    <div class="form-label" style="margin-bottom:8px">◈ Combinaciones guardadas</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${presets.map(p => {
        const mainAlter = alters.find(a=>a.id===p.alterId);
        if (!mainAlter) return '';
        const coAlters = (p.coFronting||[]).map(id=>alters.find(a=>a.id===id)).filter(Boolean);
        return `<div class="front-preset-row">
          <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
            <div style="font-size:16px;width:28px;text-align:center">${mainAlter.emoji||'◎'}</div>
            <div>
              <div style="font-size:12px;font-weight:700">${mainAlter.name}</div>
              ${coAlters.length?`<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">con ${coAlters.map(a=>a.name).join(', ')}</div>`:''}
            </div>
            ${p.label?`<div class="badge" style="margin-left:4px">${p.label}</div>`:''}
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" data-apply-preset="${p.id}">Aplicar</button>
            <button class="icon-btn" data-del-preset="${p.id}" title="Eliminar">✕</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  cont.appendChild(div);
  // Wire
  div.querySelectorAll('[data-apply-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = loadFrontPresets().find(x=>x.id===btn.dataset.applyPreset);
      if (!p) return;
      iniciarFronting(p.alterId, p.coFronting||[]);
      showToast('◉ Combinación aplicada ✓');
      frontingTab = 'actual';
      renderFrontingView();
    });
  });
  div.querySelectorAll('[data-del-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      saveFrontPresets(loadFrontPresets().filter(x=>x.id!==btn.dataset.delPreset));
      renderFrontingView();
    });
  });
}

// ── TAB HISTORIAL ──

function openEditFrontModal(sid, alters) {
  const sessions = loadFronting();
  const s = sessions.find(x=>x.id===sid);
  if (!s) return;
  const toLocal = ts => { const d = new Date(ts); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
  openModal(`
    <div class="modal-title">✎ Editar entrada</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">¿Quién fronta?</div>
        <select id="fe-alter" class="form-input">
          ${alters.map(a=>`<option value="${a.id}"${a.id===s.alterId?' selected':''}>${a.emoji||'◎'} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-label">Inicio</div>
        <input type="datetime-local" id="fe-start" class="form-input" value="${toLocal(s.start)}">
      </div>
      <div class="form-row">
        <div class="form-label">Fin <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(vacío = sesión abierta)</span></div>
        <input type="datetime-local" id="fe-end" class="form-input" value="${s.end?toLocal(s.end):''}">
      </div>
      <div class="form-row">
        <div class="form-label">Nota</div>
        <textarea id="fe-note" class="front-note-input">${s.note||''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Co-fronting <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(opcional)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${alters.map(a => `<label class="front-cofront-chip${(s.coFronting||[]).includes(a.id)?' active':''}" style="--chip-color:${a.color};--chip-bg:${a.bg}"><input type="checkbox" data-fe-coid="${a.id}" ${(s.coFronting||[]).includes(a.id)?'checked':''} style="accent-color:${a.color}"><span>${a.emoji || '◎'}</span><span class="front-cofront-chip-name">${esc(a.name)}</span></label>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>Guardar</button>
    </div>`,
    (ov) => {
      const alterId  = ov.querySelector('#fe-alter').value;
      const startVal = ov.querySelector('#fe-start').value;
      const endVal   = ov.querySelector('#fe-end').value;
      const coFronting = [...ov.querySelectorAll('[data-fe-coid]:checked')].map(c => c.dataset.feCoid).filter(id => id && id !== alterId);
      const note     = ov.querySelector('#fe-note').value.trim();
      if (!startVal) { showToast('Falta la fecha de inicio'); return; }
      const startMs = new Date(startVal).getTime();
      const endMs   = endVal ? new Date(endVal).getTime() : null;
      if (endMs && endMs <= startMs) { showToast('El fin debe ser posterior al inicio'); return; }
      const idx = sessions.findIndex(x=>x.id===sid);
      if (idx === -1) return;
      sessions[idx] = { ...sessions[idx], alterId, coFronting, start: startMs, end: endMs, duration: endMs ? endMs-startMs : null, note };
      saveFronting(sessions);
      showToast('Entrada actualizada ✓');
      renderFrontingView();
    }
  );
}

function renderFrontHistorial(cont, alters, sessions) {
  if(!sessions.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">◌</div>
      <div>Sin historial todavía</div>
    </div>`;
    return;
  }

  // Filtro por alter
  const filtered = _histFilterAlterId ? sessions.filter(s=>s.alterId===_histFilterAlterId) : sessions;

  // Agrupar por día
  const byDay = {};
  filtered.forEach(s=>{
    const key = new Date(s.start).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    if(!byDay[key]) byDay[key]=[];
    byDay[key].push(s);
  });

  // Chips de filtro por alter (solo alters que tienen historial)
  const alterIds = [...new Set(sessions.map(s=>s.alterId))];

  cont.innerHTML=`
    <!-- FILTRO POR ALTER -->
    <div class="front-hist-filter">
      <div class="front-hist-filter-chip${!_histFilterAlterId?' active':''}" data-faid="">Todos</div>
      ${alterIds.map(aid=>{
        const a = alters.find(x=>x.id===aid);
        if(!a) return '';
        return `<div class="front-hist-filter-chip${_histFilterAlterId===aid?' active':''}" data-faid="${aid}"
          style="--chip-color:${a.color};--chip-bg:${a.bg}">
          ${a.emoji} ${esc(a.name)}
        </div>`;
      }).join('')}
    </div>

    <div class="front-hist-list">
      ${Object.entries(byDay).length ? Object.entries(byDay).map(([day,list])=>`
        <div class="front-hist-day-sep">${day}</div>
        ${list.map(s=>{
          const fa = alters.find(a=>a.id===s.alterId);
          if(!fa) return '';
          const co = (s.coFronting||[]).map(cid=>alters.find(a=>a.id===cid)).filter(Boolean);
          const startStr = new Date(s.start).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
          const endStr   = s.end ? new Date(s.end).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : 'activo';
          const durMs    = s.duration || 0;
          return `<div class="front-hist-card" style="--hist-color:${fa.color}">
            <div class="front-hist-color-bar" style="background:${fa.color}"></div>
            <div class="front-hist-av" style="background:${fa.bg};border-color:${fa.color};overflow:hidden">${alterAv(fa,36)}</div>
            <div class="front-hist-body">
              <div class="front-hist-name" style="color:${fa.color}">${fa.name}</div>
              <div class="front-hist-meta">
                <span>🕐 ${startStr} → ${endStr}</span>
                ${durMs?`<span class="front-hist-dur">◷ ${fmtFrontDuration(durMs)}</span>`:'<span class="front-hist-dur" style="color:var(--accent)">activo</span>'}
              </div>
              ${co.length?`<div class="front-hist-cofront">
                <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">co-front:</span>
                ${co.map(ca=>`<span style="font-size:11px;padding:1px 6px;background:${ca.bg};border:1px solid ${ca.color}33;border-radius:4px;font-weight:700;color:${ca.color}">${ca.emoji} ${ca.name}</span>`).join('')}
              </div>`:''}
              ${s.customState ? (() => { const cs = FRONT_CUSTOM_STATES.find(x=>x.id===s.customState); return cs ? `<div class="front-hist-note" style="color:var(--accent-2)">${cs.icon} ${cs.label}</div>` : ''; })() : ''}
              ${s.note?`<div class="front-hist-note">💬 ${s.note}</div>`:''}
            </div>
            <div class="front-hist-actions">
              <button class="icon-btn" data-edit-front="${s.id}" title="Editar">✎</button>
              <button class="icon-btn" data-del-front="${s.id}" title="Eliminar">✕</button>
            </div>
          </div>`;
        }).join('')}
      `).join('') : `<div class="empty-state" style="padding:30px 20px"><div>Sin entradas para este alter</div></div>`}
    </div>`;

  // Filtro
  cont.querySelectorAll('[data-faid]').forEach(chip=>{
    chip.addEventListener('click',()=>{
      _histFilterAlterId = chip.dataset.faid || null;
      renderFrontingView();
    });
  });

  // Editar
  cont.querySelectorAll('[data-edit-front]').forEach(btn=>{
    btn.addEventListener('click',()=>openEditFrontModal(btn.dataset.editFront, alters));
  });

  // Eliminar
  cont.querySelectorAll('[data-del-front]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      openModal(`
        <div class="modal-title">Eliminar entrada</div>
        <div style="color:var(--text-2);font-size:13px;margin-bottom:16px">Esta entrada del historial se eliminará permanentemente.</div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-danger" data-submit>Eliminar</button>
        </div>`,
        () => {
          const list = loadFronting().filter(s=>s.id!==btn.dataset.delFront);
          saveFronting(list);
          showToast('Entrada eliminada');
          renderFrontingView();
        }
      );
    });
  });
}

// ── TAB LÍNEA TEMPORAL (GANTT + SWIMLANE) ──
function renderFrontTimeline(cont, alters, sessions) {
  if (!sessions.length) {
    cont.innerHTML = `<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">◫</div>
      <div>Sin historial todavía</div>
    </div>`;
    return;
  }

  // Rango: últimos 7 días por defecto, ajustable
  const rangeOptions = [
    {id:'1d', label:'Hoy',        ms: 86400000},
    {id:'3d', label:'3 días',     ms: 3*86400000},
    {id:'7d', label:'7 días',     ms: 7*86400000},
    {id:'30d',label:'30 días',    ms: 30*86400000},
  ];
  if (!cont._ganttRange) cont._ganttRange = '7d';
  const selRange = rangeOptions.find(r=>r.id===cont._ganttRange) || rangeOptions[2];
  const rangeEnd   = Date.now();
  const rangeStart = rangeEnd - selRange.ms;

  // Sesiones en el rango (incluyendo las que empezaron antes y siguen activas o solapan)
  const inRange = sessions.filter(s => (s.end||rangeEnd) >= rangeStart && s.start <= rangeEnd);

  // Alters con actividad en el rango
  const activeIds = [...new Set(inRange.map(s=>s.alterId))];
  const activeAlters = activeIds.map(id=>alters.find(a=>a.id===id)).filter(Boolean);

  // Helpers de posición
  const rangeDur = rangeEnd - rangeStart;
  const pct = (ts) => Math.max(0, Math.min(100, (ts - rangeStart) / rangeDur * 100));
  const pctW = (start, end) => Math.max(0.3, pct(Math.min(end, rangeEnd)) - pct(Math.max(start, rangeStart)));

  // Labels del eje X (horas o días según rango)
  const xLabels = [];
  if (selRange.ms <= 86400000) {
    // Hoy: cada 3 horas
    for (let h = 0; h <= 24; h += 3) {
      const ts = rangeStart + (h/24)*rangeDur;
      xLabels.push({pct: h/24*100, label: new Date(ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})});
    }
  } else if (selRange.ms <= 3*86400000) {
    // 3 días: cada 12h
    for (let i = 0; i <= selRange.ms; i += 12*3600000) {
      const ts = rangeStart + i;
      xLabels.push({pct: i/rangeDur*100, label: new Date(ts).toLocaleDateString('es-ES',{weekday:'short',hour:'2-digit',minute:'2-digit'})});
    }
  } else {
    // 7-30 días: por día
    const d = new Date(rangeStart); d.setHours(0,0,0,0);
    while (d.getTime() <= rangeEnd) {
      xLabels.push({pct: pct(d.getTime()), label: new Date(d).toLocaleDateString('es-ES',{day:'numeric',month:'short'})});
      d.setDate(d.getDate()+1);
    }
  }

  if (!cont._timelineMode) cont._timelineMode = 'gantt';
  const isSwim = cont._timelineMode === 'swimlane';

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">

      <!-- SELECTOR MODO + RANGO -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <div style="display:flex;gap:4px;border:1px solid var(--border);border-radius:7px;padding:2px">
          <button class="btn btn-sm${!isSwim?' btn-primary':' btn-ghost'}" data-tl-mode="gantt" style="border-radius:5px">◫ Gantt</button>
          <button class="btn btn-sm${isSwim?' btn-primary':' btn-ghost'}" data-tl-mode="swimlane" style="border-radius:5px">⊞ Swimlane</button>
        </div>
        ${!isSwim?rangeOptions.map(r=>`
          <button class="btn btn-sm${r.id===selRange.id?' btn-primary':' btn-ghost'}" data-gantt-range="${r.id}">${r.label}</button>
        `).join(''):''}
      </div>

      ${activeAlters.length === 0 ? `<div class="empty-state" style="padding:30px 20px"><div>Sin actividad en este período</div></div>` : `

      <!-- GANTT CHART -->
      <div class="front-gantt-wrap">

        <!-- Nombres de alters (columna izquierda) -->
        <div class="front-gantt-labels">
          ${activeAlters.map(a=>`
            <div class="front-gantt-label-row">
              <div class="front-gantt-av" style="background:${a.bg};border-color:${a.color};overflow:hidden">${alterAv(a,22)}</div>
              <span class="front-gantt-name" style="color:${a.color}">${esc(a.name)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Área de barras -->
        <div class="front-gantt-area">

          <!-- Eje X -->
          <div class="front-gantt-xaxis">
            ${xLabels.map(l=>`<div class="front-gantt-xlabel" style="left:${l.pct}%">${l.label}</div>`).join('')}
          </div>

          <!-- Grid lines -->
          <div class="front-gantt-grid">
            ${xLabels.map(l=>`<div class="front-gantt-gridline" style="left:${l.pct}%"></div>`).join('')}
          </div>

          <!-- Filas por alter -->
          ${activeAlters.map(a=>{
            const alterSessions = inRange.filter(s=>s.alterId===a.id);
            return `<div class="front-gantt-row">
              ${alterSessions.map(s=>{
                const sStart = Math.max(s.start, rangeStart);
                const sEnd   = s.end ? Math.min(s.end, rangeEnd) : rangeEnd;
                const left   = pct(sStart);
                const width  = pctW(s.start, s.end||rangeEnd);
                const isActive = !s.end;
                const dur    = fmtFrontDuration(s.duration || (Date.now()-s.start));
                const coIds  = (s.coFronting||[]);
                const startLbl = new Date(s.start).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
                const endLbl   = s.end ? new Date(s.end).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : 'activo';
                return `<div class="front-gantt-bar${isActive?' is-active':''}"
                  style="left:${left}%;width:${width}%;background:${a.color};box-shadow:0 0 0 1px ${a.color}55"
                  title="${esc(a.name)} · ${startLbl}→${endLbl} · ${dur}${coIds.length?' · co:'+coIds.map(id=>{const ca=alters.find(x=>x.id===id);return ca?ca.name:'?';}).join(','):''}">
                  ${isActive?`<div class="front-gantt-bar-pulse" style="background:${a.color}"></div>`:''}
                  ${width>8?`<span class="front-gantt-bar-label">${a.emoji||''} ${dur}</span>`:''}
                </div>`;
              }).join('')}
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- LÍNEA DE "AHORA" indicator -->
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-align:right">
        ◉ ahora = borde derecho del gráfico
      </div>`}

      ${isSwim ? (() => {
        // SWIMLANE: vertical day-by-day, each alter gets a column
        const SWIM_DAYS = 14;
        const swimAlters = [...new Set(sessions.map(s=>s.alterId))].map(id=>alters.find(a=>a.id===id)).filter(Boolean);
        if (!swimAlters.length) return '<div class="empty-state" style="padding:30px">Sin datos</div>';
        const today = new Date(); today.setHours(23,59,59,999);
        const days = Array.from({length:SWIM_DAYS},(_,i)=>{
          const d = new Date(today); d.setDate(d.getDate()-(SWIM_DAYS-1-i));
          return d.toISOString().slice(0,10);
        });
        return `<div style="overflow-x:auto">
          <table style="border-collapse:collapse;width:100%;min-width:${50+swimAlters.length*80}px">
            <thead>
              <tr>
                <th style="width:70px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);text-align:left;padding:4px 6px">Día</th>
                ${swimAlters.map(a=>`<th style="font-size:12px;font-weight:700;color:${a.color};padding:4px 6px;text-align:center">${a.emoji} ${esc(a.name)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${days.map(iso=>{
                const d=new Date(iso+'T12:00:00');
                const label=d.toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
                const isToday=iso===new Date().toISOString().slice(0,10);
                return `<tr style="border-top:1px solid var(--border)${isToday?';background:var(--bg-2)':''}">
                  <td style="font-family:'DM Mono',monospace;font-size:10px;color:${isToday?'var(--accent)':'var(--text-3)'};padding:5px 6px;white-space:nowrap">${isToday?'Hoy':label}</td>
                  ${swimAlters.map(a=>{
                    const daySess=sessions.filter(s=>s.alterId===a.id&&new Date(s.start).toISOString().slice(0,10)===iso);
                    if(!daySess.length) return `<td style="padding:5px 6px;text-align:center"><div style="width:100%;height:28px;border-radius:5px;background:var(--bg-3);opacity:.3"></div></td>`;
                    const totMin=daySess.reduce((s,x)=>s+(x.duration||0),0);
                    const opacity=Math.max(0.2,Math.min(1,totMin/120));
                    const coFronts=[...new Set(daySess.flatMap(s=>s.coFronting||[]))].map(id=>alters.find(x=>x.id===id)?.emoji||'').filter(Boolean);
                    return `<td style="padding:5px 6px">
                      <div style="background:${a.color};opacity:${opacity.toFixed(2)};border-radius:5px;padding:4px 6px;text-align:center" title="${fmtFrontDuration(totMin)}${coFronts.length?' · co: '+coFronts.join(''):''}">
                        <div style="font-family:'DM Mono',monospace;font-size:9px;color:#fff;opacity:1">${fmtFrontDuration(totMin)}</div>
                        ${coFronts.length?`<div style="font-size:9px;opacity:.8">${coFronts.join('')}</div>`:''}
                      </div>
                    </td>`;
                  }).join('')}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);margin-top:8px">Intensidad de color = tiempo en sesión · emoji = co-fronters</div>
        </div>`;
      })() : ''}

    </div>`;

  // Selector de rango
  cont.querySelectorAll('[data-gantt-range]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      cont._ganttRange = btn.dataset.ganttRange;
      renderFrontTimeline(cont, alters, sessions);
    });
  });
  // Modo toggle
  cont.querySelectorAll('[data-tl-mode]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      cont._timelineMode = btn.dataset.tlMode;
      renderFrontTimeline(cont, alters, sessions);
    });
  });
}

// ── TAB ESTADÍSTICAS ──
function renderFrontStats(cont, alters, sessions) {
  const allSessions = sessions;
  const statsFrom = cont._statsFrom || '';
  const statsTo = cont._statsTo || '';
  if (statsFrom || statsTo) {
    const fromMs = statsFrom ? new Date(statsFrom + 'T00:00:00').getTime() : -Infinity;
    const toMs = statsTo ? new Date(statsTo + 'T23:59:59.999').getTime() : Infinity;
    sessions = sessions.filter(s => s.start <= toMs && (s.end || s.start) >= fromMs);
  }
  if(!sessions.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px"><div class="empty-icon">◈</div><div>Sin datos todavía</div></div>`;
    return;
  }

  const total = sessions.reduce((s,x)=>s+(x.duration||0),0);
  const now   = Date.now();

  // Por alter
  const byAlter = {};
  sessions.forEach(s=>{
    if(!byAlter[s.alterId]) byAlter[s.alterId]={duration:0,count:0,longest:0,last:0};
    byAlter[s.alterId].duration += s.duration||0;
    byAlter[s.alterId].count++;
    if((s.duration||0) > byAlter[s.alterId].longest) byAlter[s.alterId].longest = s.duration||0;
    if(s.start > byAlter[s.alterId].last) byAlter[s.alterId].last = s.start;
  });
  const sorted = Object.entries(byAlter).sort((a,b)=>b[1].duration-a[1].duration);

  // Sesión más larga global
  const longestSession = sessions.reduce((best,s)=>((s.duration||0)>(best.duration||0)?s:best), sessions[0]);
  const longestAlter   = alters.find(a=>a.id===longestSession.alterId);

  // Últimos 7 días (stacked por alter)
  const days7 = Array.from({length:7},(_,i)=>{
    const d = new Date(now-(6-i)*86400000);
    return {label:d.toLocaleDateString('es-ES',{weekday:'short'}), date:d.toDateString(), byAlt:{}};
  });
  sessions.forEach(s=>{
    const d = new Date(s.start).toDateString();
    const day = days7.find(x=>x.date===d);
    if(day){ if(!day.byAlt[s.alterId]) day.byAlt[s.alterId]=0; day.byAlt[s.alterId]+=s.duration||0; }
  });
  const maxDayMs = Math.max(...days7.map(d=>Object.values(d.byAlt).reduce((a,b)=>a+b,0)),1);

  // Vista detalle de un alter (estado local)
  if (!cont._statsAlterId) cont._statsAlterId = null;
  const detailAid = cont._statsAlterId;
  const detailAlter = detailAid ? alters.find(a=>a.id===detailAid) : null;
  const detailSessions = detailAid ? sessions.filter(s=>s.alterId===detailAid) : [];

  cont.innerHTML=`
    <div style="display:flex;flex-direction:column;gap:18px">

      <div class="hub-widget">
        <div class="hw-header"><div class="hw-icon" style="color:var(--accent);background:rgba(160,138,255,.1)">⌕</div><div class="hw-title">Rango de fechas</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
          <label class="form-row" style="flex:1;min-width:140px"><span class="form-label">Desde</span><input class="form-input" type="date" id="stats-from" value="${statsFrom}"></label>
          <label class="form-row" style="flex:1;min-width:140px"><span class="form-label">Hasta</span><input class="form-input" type="date" id="stats-to" value="${statsTo}"></label>
          <button class="btn btn-ghost btn-sm" id="stats-clear-range">Todo el tiempo</button>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:6px">${statsFrom || statsTo ? `${sessions.length} sesiones en el rango seleccionado` : 'Todas las sesiones cerradas'}</div>
      </div>

      <!-- STATS GLOBALES -->
      <div class="front-stat-grid">
        <div class="front-stat">
          <div class="front-stat-val" style="color:var(--accent)">${sessions.length}</div>
          <div class="front-stat-label">Sesiones totales</div>
        </div>
        <div class="front-stat">
          <div class="front-stat-val" style="color:var(--accent-3)">${fmtFrontDuration(total)}</div>
          <div class="front-stat-label">Tiempo total</div>
        </div>
        <div class="front-stat">
          <div class="front-stat-val" style="color:var(--accent-4)">${sorted.length}</div>
          <div class="front-stat-label">Alters activos</div>
        </div>
        <div class="front-stat">
          <div class="front-stat-val" style="color:var(--accent-2)">${fmtFrontDuration(Math.round(total/sessions.length))}</div>
          <div class="front-stat-label">Duración media</div>
        </div>
      </div>

      ${longestAlter ? `
      <div class="front-stat" style="background:var(--bg-2);flex-direction:row;align-items:center;gap:12px;padding:12px 16px">
        <div style="width:32px;height:32px;border-radius:50%;background:${longestAlter.bg};border:2px solid ${longestAlter.color};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;overflow:hidden">${alterAv(longestAlter,32)}</div>
        <div style="flex:1">
          <div style="font-size:11px;font-weight:800;color:${longestAlter.color}">${longestAlter.name}</div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">Sesión más larga · ${fmtFrontDuration(longestSession.duration)}</div>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${new Date(longestSession.start).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
      </div>` : ''}

      <!-- GRÁFICO 7 DÍAS (stacked) -->
      <div class="hub-widget">
        <div class="hw-header">
          <div class="hw-icon" style="color:var(--accent);background:rgba(160,138,255,.1)">◷</div>
          <div class="hw-title">Actividad — últimos 7 días</div>
        </div>
        <div class="front-bar-chart">
          ${days7.map(d=>{
            const total7 = Object.values(d.byAlt).reduce((a,b)=>a+b,0);
            const h = Math.max(total7/maxDayMs*100, total7?6:2);
            // Stacked: ordenar por alter más activo primero
            const segs = Object.entries(d.byAlt).sort((a,b)=>b[1]-a[1]);
            return `<div class="front-bar-col">
              <div style="position:relative;height:${h}%;width:100%;border-radius:3px 3px 0 0;overflow:hidden;display:flex;flex-direction:column-reverse">
                ${segs.map(([aid,ms])=>{
                  const a = alters.find(x=>x.id===aid);
                  const segPct = total7>0 ? ms/total7*100 : 0;
                  return `<div style="width:100%;height:${segPct}%;background:${a?a.color:'var(--accent)'};flex-shrink:0"></div>`;
                }).join('')}
              </div>
              <div class="front-bar-lbl">${d.label}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- BREAKDOWN POR ALTER (clickable → detalle) -->
      <div class="hub-widget">
        <div class="hw-header">
          <div class="hw-icon" style="color:var(--accent-2);background:rgba(255,138,226,.1)">◎</div>
          <div class="hw-title">Por alter <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">— pulsa para ver detalle</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${sorted.map(([aid,st])=>{
            const a = alters.find(x=>x.id===aid);
            if(!a) return '';
            const pct = total>0?Math.round((st.duration/total)*100):0;
            const isSelected = detailAid===aid;
            return `<div class="front-stat-alter-row${isSelected?' selected':''}" data-stat-alter="${aid}" style="--alter-color:${a.color}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
                <div style="width:26px;height:26px;border-radius:50%;background:${a.bg};border:2px solid ${a.color};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;overflow:hidden">${alterAv(a,26)}</div>
                <div style="flex:1">
                  <div style="font-size:12px;font-weight:800;color:${isSelected?a.color:'var(--text-0)'}">${esc(a.name)}</div>
                  <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${st.count} sesiones · ${fmtFrontDuration(st.duration)} · media ${fmtFrontDuration(Math.round(st.duration/st.count))}</div>
                </div>
                <div style="font-family:'DM Mono',monospace;font-size:12px;color:${a.color};font-weight:700">${pct}%</div>
              </div>
              <div style="height:5px;background:var(--bg-3);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${a.color};border-radius:3px;transition:width .4s ease"></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- CO-FRONTING MÁS FRECUENTE -->
      ${(()=>{
        const pairs = {};
        sessions.forEach(s=>{
          (s.coFronting||[]).forEach(cid=>{
            const key = [s.alterId,cid].sort().join('|');
            pairs[key]=(pairs[key]||0)+1;
          });
        });
        const topPairs = Object.entries(pairs).sort((a,b)=>b[1]-a[1]).slice(0,3);
        if (!topPairs.length) return '';
        return `<div class="hub-widget">
          <div class="hw-header">
            <div class="hw-icon" style="color:var(--accent-3);background:rgba(138,255,224,.1)">◈</div>
            <div class="hw-title">Co-fronting más frecuente</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${topPairs.map(([key,count])=>{
              const [a1id,a2id]=key.split('|');
              const a1=alters.find(a=>a.id===a1id), a2=alters.find(a=>a.id===a2id);
              if(!a1||!a2) return '';
              return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg-2);border-radius:8px">
                <span style="font-size:18px">${a1.emoji}</span>
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">+</span>
                <span style="font-size:18px">${a2.emoji}</span>
                <div style="flex:1">
                  <span style="font-size:12px;font-weight:600;color:${a1.color}">${a1.name}</span>
                  <span style="font-size:11px;color:var(--text-3)"> & </span>
                  <span style="font-size:12px;font-weight:600;color:${a2.color}">${a2.name}</span>
                </div>
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">${count}x</div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      })()}

      <!-- DÍAS MÁS ACTIVOS POR ALTER (detalle expandible) -->
      ${detailAlter ? `
      <div class="hub-widget" id="stat-alter-detail">
        <div class="hw-header">
          <div class="front-hist-av" style="background:${detailAlter.bg};border-color:${detailAlter.color};overflow:hidden;width:28px;height:28px;border-radius:50%;border:1.5px solid;display:flex;align-items:center;justify-content:center;font-size:14px">${alterAv(detailAlter,28)}</div>
          <div class="hw-title" style="color:${detailAlter.color}">${detailAlter.name} — detalle</div>
          <button class="icon-btn" id="btn-close-stat-detail" style="margin-left:auto">✕</button>
        </div>
        ${(()=>{
          // Días más activos
          const byDay = {};
          detailSessions.forEach(s=>{
            const iso=new Date(s.start).toISOString().slice(0,10);
            byDay[iso]=(byDay[iso]||0)+(s.duration||0);
          });
          const topDays=Object.entries(byDay).sort((a,b)=>b[1]-a[1]).slice(0,3);
          // Estado más frecuente
          const stateCount={};
          detailSessions.forEach(s=>{if(s.customState) stateCount[s.customState]=(stateCount[s.customState]||0)+1;});
          const topState=Object.entries(stateCount).sort((a,b)=>b[1]-a[1])[0];
          const topStateObj=topState?FRONT_CUSTOM_STATES.find(x=>x.id===topState[0]):null;
          // Avg duration
          const avgDur = detailSessions.length ? Math.round(detailSessions.reduce((s,x)=>s+(x.duration||0),0)/detailSessions.length) : 0;
          return `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px">
            <div class="front-stat" style="padding:10px"><div class="front-stat-val" style="color:${detailAlter.color}">${detailSessions.length}</div><div class="front-stat-label">Sesiones</div></div>
            <div class="front-stat" style="padding:10px"><div class="front-stat-val" style="color:${detailAlter.color}">${fmtFrontDuration(avgDur)}</div><div class="front-stat-label">Media/sesión</div></div>
            ${topStateObj?`<div class="front-stat" style="padding:10px"><div class="front-stat-val">${topStateObj.icon}</div><div class="front-stat-label">${topStateObj.label} (${topState[1]}x)</div></div>`:''}
          </div>
          ${topDays.length?`<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.1em">Días más activos</div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
            ${topDays.map(([iso,dur])=>`<div style="display:flex;align-items:center;gap:8px">
              <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);width:90px">${new Date(iso+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})}</div>
              <div style="flex:1;height:4px;background:var(--bg-3);border-radius:2px"><div style="height:100%;width:${Math.round(dur/byDay[topDays[0][0]]*100)}%;background:${detailAlter.color};border-radius:2px"></div></div>
              <div style="font-family:'DM Mono',monospace;font-size:10px;color:${detailAlter.color}">${fmtFrontDuration(dur)}</div>
            </div>`).join('')}
          </div>`:''}`;
        })()}
        <div style="display:flex;flex-direction:column;gap:5px;max-height:200px;overflow-y:auto">
          ${detailSessions.slice(0,15).map(s=>{
            const co = (s.coFronting||[]).map(cid=>alters.find(a=>a.id===cid)).filter(Boolean);
            const startStr = new Date(s.start).toLocaleDateString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
            const endStr   = s.end ? new Date(s.end).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : 'activo';
            return `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:var(--bg-2);border-radius:7px;border-left:3px solid ${detailAlter.color}">
              <div style="flex:1;min-width:0">
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">${startStr} → ${endStr}</div>
                ${co.length?`<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">co: ${co.map(ca=>ca.name).join(', ')}</div>`:''}
                ${s.note?`<div style="font-size:11px;color:var(--text-1);margin-top:2px">${s.note}</div>`:''}
              </div>
              <div style="font-family:'DM Mono',monospace;font-size:10px;color:${detailAlter.color};flex-shrink:0">${fmtFrontDuration(s.duration)}</div>
            </div>`;
          }).join('')}
          ${detailSessions.length>15?`<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-align:center;padding:6px">+${detailSessions.length-15} más en Historial</div>`:''}
        </div>
      </div>` : ''}

    </div>`;

  cont.querySelector('#stats-from')?.addEventListener('change', e=>{ cont._statsFrom=e.target.value; renderFrontStats(cont, alters, allSessions); });
  cont.querySelector('#stats-to')?.addEventListener('change', e=>{ cont._statsTo=e.target.value; renderFrontStats(cont, alters, allSessions); });
  cont.querySelector('#stats-clear-range')?.addEventListener('click',()=>{ cont._statsFrom=''; cont._statsTo=''; renderFrontStats(cont, alters, allSessions); });

  // Click en alter → detalle
  cont.querySelectorAll('[data-stat-alter]').forEach(row=>{
    row.addEventListener('click',()=>{
      cont._statsAlterId = cont._statsAlterId===row.dataset.statAlter ? null : row.dataset.statAlter;
      renderFrontStats(cont, alters, sessions);
      if(cont._statsAlterId) setTimeout(()=>cont.querySelector('#stat-alter-detail')?.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
    });
  });
  cont.querySelector('#btn-close-stat-detail')?.addEventListener('click',()=>{
    cont._statsAlterId = null;
    renderFrontStats(cont, alters, sessions);
  });
}

// ── TAB PLANIFICACIÓN ──
function renderFrontPlanif(cont, alters) {
  const schedule = loadFrontSchedule();
  const today = new Date().toISOString().slice(0,10);
  // Mostrar los próximos 14 días
  const days = [];
  for (let i=0; i<14; i++) {
    const d = new Date(); d.setDate(d.getDate()+i);
    days.push(d.toISOString().slice(0,10));
  }
  const fmt = d => { const [y,m,dy]=d.split('-'); return `${dy}/${m}/${y}`; };
  const alterName = id => alters.find(a=>a.id===id)?.name || '?';
  const STATUS_LABEL = {scheduled:'Planificado', done:'Realizado', skipped:'Omitido'};
  const STATUS_COLOR = {scheduled:'var(--accent-4)', done:'var(--green)', skipped:'var(--text-3)'};

  const upcoming = schedule.filter(b=>b.date>=today).sort((a,b)=>a.date.localeCompare(b.date)||(a.startTime||'').localeCompare(b.startTime||''));
  const past     = schedule.filter(b=>b.date<today).sort((a,b)=>b.date.localeCompare(a.date));

  cont.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary" id="btn-new-schedule">+ Nuevo bloque</button>
    </div>
    ${!upcoming.length && !past.length ? `<div class="empty-state" style="padding:60px 20px"><div class="empty-icon">◷</div><div>Sin bloques planificados</div></div>` : ''}
    ${upcoming.length ? `
      <div class="analisis-section-title" style="margin-bottom:8px">Próximos</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
        ${upcoming.map(b=>`
          <div class="card" style="display:flex;align-items:center;gap:12px;padding:12px 14px" data-sid="${b.id}">
            <div style="min-width:80px;font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2)">${fmt(b.date)}</div>
            <div style="min-width:90px;font-family:'DM Mono',monospace;font-size:11px">${b.startTime||''}${b.endTime?' – '+b.endTime:''}</div>
            <div style="flex:1">
              <div style="font-weight:600">${alterName(b.alterId)}</div>
              ${b.coAlterIds?.length ? `<div style="font-size:11px;color:var(--text-2)">+${b.coAlterIds.map(alterName).join(', ')}</div>` : ''}
              ${b.note ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${b.note}</div>` : ''}
            </div>
            <div style="font-size:11px;color:${STATUS_COLOR[b.status]||'var(--text-2)'}">${STATUS_LABEL[b.status]||b.status}</div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm" data-edit-sid="${b.id}" style="padding:2px 8px">✎</button>
              <button class="btn btn-ghost btn-sm" data-del-sid="${b.id}" style="padding:2px 8px;color:var(--red)">✕</button>
            </div>
          </div>`).join('')}
      </div>` : ''}
    ${past.length ? `
      <details>
        <summary style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);cursor:pointer;padding:6px 2px;letter-spacing:.1em;text-transform:uppercase">↓ Historial (${past.length})</summary>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
          ${past.slice(0,30).map(b=>`
            <div class="card" style="display:flex;align-items:center;gap:12px;padding:10px 14px;opacity:.7">
              <div style="min-width:80px;font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2)">${fmt(b.date)}</div>
              <div style="min-width:90px;font-family:'DM Mono',monospace;font-size:11px">${b.startTime||''}${b.endTime?' – '+b.endTime:''}</div>
              <div style="flex:1"><div style="font-weight:600">${alterName(b.alterId)}</div>${b.note?`<div style="font-size:11px;color:var(--text-3)">${b.note}</div>`:''}</div>
              <div style="font-size:11px;color:${STATUS_COLOR[b.status]||'var(--text-2)'}">${STATUS_LABEL[b.status]||b.status}</div>
              <button class="btn btn-ghost btn-sm" data-del-sid="${b.id}" style="padding:2px 8px;color:var(--red)">✕</button>
            </div>`).join('')}
        </div>
      </details>` : ''}`;

  cont.querySelector('#btn-new-schedule')?.addEventListener('click', ()=>openFrontScheduleModal(null, alters));
  cont.querySelectorAll('[data-edit-sid]').forEach(b=>b.addEventListener('click',()=>{
    const entry = loadFrontSchedule().find(x=>x.id===b.dataset.editSid);
    if(entry) openFrontScheduleModal(entry, alters);
  }));
  cont.querySelectorAll('[data-del-sid]').forEach(b=>b.addEventListener('click',()=>{
    saveFrontSchedule(loadFrontSchedule().filter(x=>x.id!==b.dataset.delSid));
    showToast('Bloque eliminado');
    renderFrontingView();
  }));
}

function openFrontScheduleModal(entry, alters) {
  const isEdit = !!entry;
  const today  = new Date().toISOString().slice(0,10);
  const b      = entry || {id:uid(), date:today, startTime:'', endTime:'', alterId:'', coAlterIds:[], note:'', status:'scheduled'};
  const STATUSES = [{id:'scheduled',label:'Planificado'},{id:'done',label:'Realizado'},{id:'skipped',label:'Omitido'}];

  openModal(`
    <div class="modal-header"><span>${isEdit?'Editar bloque':'Nuevo bloque de fronting'}</span><button class="modal-close" id="ms-close">✕</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label class="field-label">Alter principal *</label>
        <select id="ms-alter" class="input">
          <option value="">— Selecciona —</option>
          ${alters.map(a=>`<option value="${a.id}"${a.id===b.alterId?' selected':''}>${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div>
          <label class="field-label">Fecha *</label>
          <input id="ms-date" class="input" type="date" value="${b.date}">
        </div>
        <div>
          <label class="field-label">Inicio</label>
          <input id="ms-start" class="input" type="time" value="${b.startTime}">
        </div>
        <div>
          <label class="field-label">Fin</label>
          <input id="ms-end" class="input" type="time" value="${b.endTime}">
        </div>
      </div>
      <div>
        <label class="field-label">Co-fronting (opcional)</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${alters.filter(a=>a.id!==b.alterId).map(a=>`
            <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer">
              <input type="checkbox" value="${a.id}" ${(b.coAlterIds||[]).includes(a.id)?'checked':''} class="ms-co"> ${esc(a.name)}
            </label>`).join('')}
        </div>
      </div>
      <div>
        <label class="field-label">Estado</label>
        <select id="ms-status" class="input">
          ${STATUSES.map(s=>`<option value="${s.id}"${s.id===b.status?' selected':''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">Nota</label>
        <input id="ms-note" class="input" placeholder="Contexto opcional…" value="${b.note||''}">
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
        <button class="btn btn-ghost" id="ms-cancel">Cancelar</button>
        <button class="btn btn-primary" id="ms-save">Guardar</button>
      </div>
    </div>`);

  document.getElementById('ms-close')?.addEventListener('click', closeModal);
  document.getElementById('ms-cancel')?.addEventListener('click', closeModal);
  document.getElementById('ms-save')?.addEventListener('click', ()=>{
    const alterId   = document.getElementById('ms-alter').value;
    const date      = document.getElementById('ms-date').value;
    const startTime = document.getElementById('ms-start').value;
    const endTime   = document.getElementById('ms-end').value;
    const status    = document.getElementById('ms-status').value;
    const note      = document.getElementById('ms-note').value.trim();
    const coAlterIds= [...document.querySelectorAll('.ms-co:checked')].map(c=>c.value);
    if(!alterId || !date) { showToast('⚠ Elige alter y fecha'); return; }
    const list = loadFrontSchedule();
    const upd  = {...b, alterId, date, startTime, endTime, status, note, coAlterIds};
    if(isEdit) { const i=list.findIndex(x=>x.id===b.id); if(i>=0) list[i]=upd; else list.push(upd); }
    else list.push(upd);
    saveFrontSchedule(list);
    closeModal();
    showToast(isEdit?'Bloque actualizado ✓':'Bloque creado ✓');
    renderFrontingView();
  });
}

// ═══════════════════════════════════════════════
let memoriaTab = 'actividad'; // 'actividad' | 'timeline' | 'cambios' | 'integracion'
let alteresTab = 'perfiles'; // 'perfiles' | 'fichas'
let alteresViewMode = 'cards'; // 'cards' | 'list'
let alteresSortMode = 'default'; // 'default' | 'alpha' | 'date'
let alteresRoleFilter = ''; // '' = todos, o id de ROLE_TYPES

// ── STORAGE ──
function loadActividad()    { try { return JSON.parse(localStorage.getItem('tid_actividad'))||[]; } catch{return[];} }
function saveActividad(a)   { localStorage.setItem('tid_actividad', JSON.stringify(a)); }
function loadTimeline()     { try { return JSON.parse(localStorage.getItem('tid_timeline'))||[]; } catch{return[];} }
function saveTimeline(t)    { localStorage.setItem('tid_timeline', JSON.stringify(t)); }
function loadCambios()      { try { return JSON.parse(localStorage.getItem('tid_cambios'))||[]; } catch{return[];} }
function saveCambios(c)     { localStorage.setItem('tid_cambios', JSON.stringify(c)); }
function loadIntegracion()  { try { return JSON.parse(localStorage.getItem('tid_integracion'))||[]; } catch{return[];} }
function saveIntegracion(i) { localStorage.setItem('tid_integracion', JSON.stringify(i)); }
function loadSaludTriggers()   { try { return JSON.parse(localStorage.getItem('tid_salud_triggers'))||[]; } catch{return[];} }
function saveSaludTriggers(d)  { localStorage.setItem('tid_salud_triggers', JSON.stringify(d)); }
function loadAlergias()        { try { return JSON.parse(localStorage.getItem('tid_alergias'))||[]; } catch{return[];} }
function saveAlergias(d)       { localStorage.setItem('tid_alergias', JSON.stringify(d)); }
function loadMedicaciones()    { try { return JSON.parse(localStorage.getItem('tid_medicaciones'))||[]; } catch{return[];} }
function saveMedicaciones(d)   { localStorage.setItem('tid_medicaciones', JSON.stringify(d)); }
function loadMedIntake()       { try { return JSON.parse(localStorage.getItem('tid_med_intake'))||[]; } catch{return[];} }
function saveMedIntake(d)      { localStorage.setItem('tid_med_intake', JSON.stringify(d)); }
function isMedTakenToday(medId) {
  const today = new Date().toISOString().slice(0,10);
  return loadMedIntake().some(r => r.medicacionId === medId && r.date === today);
}
function toggleMedToday(medId) {
  const today = new Date().toISOString().slice(0,10);
  const list = loadMedIntake();
  const idx = list.findIndex(r => r.medicacionId === medId && r.date === today);
  if (idx >= 0) { list.splice(idx, 1); } else { list.push({ medicacionId: medId, date: today, ts: Date.now() }); }
  saveMedIntake(list);
}

// ── AUTO-REGISTRO: called on alter switch ──
function registrarSesion(alterId) {
  const sessions = loadActividad();
  // Close previous open session
  const open = sessions.find(s=>!s.end);
  if(open) { open.end = Date.now(); open.duration = open.end - open.start; }
  // Open new session
  sessions.push({id:uid(), alterId, start:Date.now(), end:null, duration:null, note:null});
  saveActividad(sessions);
}

function renderMemoria() {
  const tabLabel = {actividad:'Actividad',timeline:'Línea temporal',cambios:'Cambios',integracion:'Integración'};
  if(!['actividad','timeline','cambios','integracion'].includes(memoriaTab)) memoriaTab='actividad';
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Memoria · '+(tabLabel[memoriaTab]||'')}]);
  renderMemoriaView();
}

function renderMemoriaView() {
  const app    = document.getElementById('app');
  const alters = getAlters();

  const btnLabel = {
    timeline:'+ Añadir', cambios:'+ Añadir', integracion:'+ Añadir',
    actividad:null
  }[memoriaTab];

  app.innerHTML = `
    <div class="mem-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◌ Memoria</div>
          <div class="fin-subtitle">Registro histórico del sistema</div>
        </div>
        ${btnLabel?`<button class="btn btn-primary" id="btn-mem-new">${btnLabel}</button>`:''}
      </div>

      <div class="mem-tabs">
        ${[
          {id:'actividad',   label:'◷ Actividad'},
          {id:'timeline',    label:'◌ Línea temporal'},
          {id:'cambios',     label:'◑ Cambios'},
          {id:'integracion', label:'◐ Integración'},
        ].map(t=>`<div class="mem-tab${memoriaTab===t.id?' active':''}" data-mt="${t.id}">${t.label}</div>`).join('')}
      </div>

      <div id="mem-content"></div>
    </div>`;

  app.querySelectorAll('.mem-tab').forEach(t=>t.addEventListener('click',()=>{ memoriaTab=t.dataset.mt; renderMemoriaView(); }));
  app.querySelector('#btn-mem-new')?.addEventListener('click',()=>{
    if(memoriaTab==='timeline')    openTimelineModal(null);
    else if(memoriaTab==='cambios')     openCambioModal(null);
    else if(memoriaTab==='integracion') openIntegModal(null);
  });

  const cont = app.querySelector('#mem-content');
  if(memoriaTab==='actividad')   renderActividadTab(cont, alters);
  if(memoriaTab==='timeline')    renderTimelineTab(cont, alters);
  if(memoriaTab==='cambios')     renderCambiosTab(cont, alters);
  if(memoriaTab==='integracion') renderIntegTab(cont, alters);
}

// ════ TAB ACTIVIDAD ════
function renderActividadTab(cont, alters) {
  const sessions = loadActividad().filter(s=>s.end).sort((a,b)=>b.start-a.start);

  if(sessions.length===0) {
    cont.innerHTML=`<div class="empty-state" style="padding:60px 20px">
      <div class="empty-icon">◷</div>
      <div>Sin sesiones registradas</div>
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);margin-top:6px">
        El registro se activa automáticamente al cambiar de alter
      </div>
    </div>`;
    return;
  }

  // Stats per alter
  const statsByAlter = {};
  sessions.forEach(s=>{
    if(!statsByAlter[s.alterId]) statsByAlter[s.alterId]={count:0,duration:0};
    statsByAlter[s.alterId].count++;
    statsByAlter[s.alterId].duration+=s.duration||0;
  });
  const totalDuration = sessions.reduce((s,x)=>s+(x.duration||0),0);

  // Last 7 days chart data
  const now = Date.now();
  const days7 = Array.from({length:7},(_,i)=>{
    const d = new Date(now - (6-i)*86400000);
    return {label:d.toLocaleDateString('es-ES',{weekday:'short'}), date:d.toDateString(), count:0};
  });
  sessions.forEach(s=>{
    const d=new Date(s.start).toDateString();
    const day=days7.find(x=>x.date===d);
    if(day) day.count++;
  });
  const maxCount = Math.max(...days7.map(d=>d.count),1);

  // Group by day
  const byDay = {};
  sessions.forEach(s=>{
    const key=new Date(s.start).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
    if(!byDay[key]) byDay[key]=[];
    byDay[key].push(s);
  });

  cont.innerHTML = `
    <!-- STATS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px">
      <div class="wish-stat">
        <div class="wish-stat-val" style="color:var(--accent)">${sessions.length}</div>
        <div class="wish-stat-label">Sesiones totales</div>
      </div>
      <div class="wish-stat">
        <div class="wish-stat-val" style="color:var(--accent-3)">${fmtDuration(totalDuration)}</div>
        <div class="wish-stat-label">Tiempo total</div>
      </div>
      <div class="wish-stat">
        <div class="wish-stat-val" style="color:var(--accent-4)">${Object.keys(statsByAlter).length}</div>
        <div class="wish-stat-label">Alters activos</div>
      </div>
    </div>

    <!-- MINI CHART -->
    <div class="hub-widget" style="margin-bottom:16px">
      <div class="hw-header">
        <div class="hw-icon" style="color:var(--accent);background:rgba(160,138,255,.1)">◷</div>
        <div class="hw-title">Actividad últimos 7 días</div>
      </div>
      <div class="act-chart">
        ${days7.map(d=>`
          <div class="act-bar-wrap">
            <div class="act-bar" style="height:${Math.max(d.count/maxCount*100,d.count?8:2)}%;background:${d.count?'var(--accent)':'var(--bg-3)'}"></div>
            <div class="act-bar-label">${d.label}</div>
          </div>`).join('')}
      </div>
      <!-- ALTER BREAKDOWN -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
        ${Object.entries(statsByAlter).sort((a,b)=>b[1].duration-a[1].duration).map(([aid,st])=>{
          const alt=alters.find(a=>a.id===aid);
          if(!alt) return '';
          const pct=Math.round((st.duration/totalDuration)*100);
          return `<div style="display:flex;align-items:center;gap:6px;font-size:12px">
            <div style="width:24px;height:24px;border-radius:50%;background:${alt.bg};border:2px solid ${alt.color};display:flex;align-items:center;justify-content:center;font-size:12px;overflow:hidden">${alterAv(alt,24)}</div>
            <div>
              <div style="font-size:11px;font-weight:700">${alt.name}</div>
              <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${st.count} ses. · ${pct}%</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- SESSIONS LIST -->
    <div style="display:flex;flex-direction:column;gap:0">
      ${Object.entries(byDay).slice(0,10).map(([day,sss])=>`
        <div class="act-day-header">${day} <span style="background:var(--bg-2);padding:1px 7px;border-radius:4px;font-size:9px">${sss.length}</span></div>
        ${sss.map(s=>{
          const alt=alters.find(a=>a.id===s.alterId);
          if(!alt) return '';
          const start=new Date(s.start).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
          const end=s.end?new Date(s.end).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'activa';
          return `<div class="act-session" data-sid="${s.id}">
            <div class="act-session-avatar" style="background:${alt.bg};border-color:${alt.color}">${alt.emoji}</div>
            <div class="act-session-body">
              <div class="act-session-name" style="color:${alt.color}">${alt.name}</div>
              <div class="act-session-time">${start} → ${end} · ${s.duration?fmtDuration(s.duration):'en curso'}</div>
              ${s.note?`<div class="act-session-note">${escM(s.note)}</div>`:''}
            </div>
          </div>`;
        }).join('')}
      `).join('')}
    </div>`;
}

function fmtDuration(ms) {
  if(!ms) return '—';
  const h = Math.floor(ms/3600000);
  const m = Math.floor((ms%3600000)/60000);
  if(h>0) return `${h}h ${m}m`;
  if(m>0) return `${m}m`;
  return '<1m';
}

// ════ TAB TIMELINE ════
function renderTimelineTab(cont, alters) {
  const items = loadTimeline().sort((a,b)=>b.date.localeCompare(a.date));

  if(items.length===0) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">◌</div>
      <div>Línea temporal vacía</div>
      <button class="btn btn-primary" style="margin-top:8px" id="btn-tl-add">Añadir primer evento</button>
    </div>`;
    cont.querySelector('#btn-tl-add')?.addEventListener('click',()=>openTimelineModal(null));
    return;
  }

  cont.innerHTML=`<div class="timeline">
    ${items.map(item=>{
      const typ=TL_TYPES.find(t=>t.id===item.type)||TL_TYPES[0];
      const d=new Date(item.date).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'});
      const alt=alters.find(a=>a.id===item.alterId);
      return `<div class="tl-item" data-tlid="${item.id}">
        <div class="tl-dot" style="background:${typ.color};border-color:var(--bg-0)"></div>
        <div class="tl-card">
          <div class="tl-card-header">
            <div class="tl-card-title">${escM(item.title)}</div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              <span class="tl-type-badge" style="color:${typ.color};border-color:${typ.color};background:${typ.bg}">${typ.label}</span>
              <span class="tl-card-date">${d}</span>
            </div>
          </div>
          ${item.body?`<div class="tl-card-body">${escM(item.body)}</div>`:''}
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
            <div class="tl-card-tags">
              ${(item.tags||[]).map(t=>`<span class="tl-tag">#${t}</span>`).join('')}
              ${alt?`<span style="font-size:13px" title="${alt.name}">${alt.emoji}</span>`:''}
            </div>
            <div style="display:flex;gap:4px">
              <button class="icon-btn btn-tl-edit" data-tlid="${item.id}" title="Editar">✎</button>
              <button class="icon-btn btn-tl-del"  data-tlid="${item.id}" title="Eliminar">✕</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  cont.querySelectorAll('.btn-tl-edit').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const item=loadTimeline().find(x=>x.id===b.dataset.tlid); if(item) openTimelineModal(item);
  }));
  cont.querySelectorAll('.btn-tl-del').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(!confirm('¿Eliminar este evento?')) return;
    saveTimeline(loadTimeline().filter(x=>x.id!==b.dataset.tlid));
    showToast('Evento eliminado'); renderMemoriaView();
  }));
}

// ════ TAB CAMBIOS ════
function renderCambiosTab(cont, alters) {
  const items = loadCambios().sort((a,b)=>b.date.localeCompare(a.date));

  if(items.length===0) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">◑</div>
      <div>Sin cambios registrados</div>
      <button class="btn btn-primary" style="margin-top:8px" id="btn-cambio-add">Registrar cambio</button>
    </div>`;
    cont.querySelector('#btn-cambio-add')?.addEventListener('click',()=>openCambioModal(null));
    return;
  }

  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:10px">
    ${items.map(item=>{
      const imp=CAMBIO_IMPORTANCE.find(i=>i.id===item.importance)||CAMBIO_IMPORTANCE[1];
      const alt=alters.find(a=>a.id===item.alterId);
      const d=new Date(item.date).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'});
      return `<div class="cambio-card" data-cid="${item.id}">
        <div class="cambio-accent" style="background:${imp.color}"></div>
        <div class="cambio-body">
          <div class="cambio-header">
            <div class="cambio-title">${escM(item.title)}</div>
            <div class="cambio-importance" title="${imp.id}" style="color:${imp.color}">${imp.emoji}</div>
          </div>
          ${item.desc?`<div class="cambio-desc">${escM(item.desc)}</div>`:''}
          <div class="cambio-meta">
            <span>📅 ${d}</span>
            ${alt?`<span>${alt.emoji} ${alt.name}</span>`:''}
            <div style="margin-left:auto;display:flex;gap:4px">
              <button class="icon-btn btn-cambio-edit" data-cid="${item.id}">✎</button>
              <button class="icon-btn btn-cambio-del" data-cid="${item.id}">✕</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  cont.querySelectorAll('.btn-cambio-edit').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const item=loadCambios().find(x=>x.id===b.dataset.cid); if(item) openCambioModal(item);
  }));
  cont.querySelectorAll('.btn-cambio-del').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(!confirm('¿Eliminar este cambio?')) return;
    saveCambios(loadCambios().filter(x=>x.id!==b.dataset.cid));
    showToast('Cambio eliminado'); renderMemoriaView();
  }));
}

// ════ TAB INTEGRACIÓN ════
function renderIntegTab(cont, alters) {
  const items = loadIntegracion().sort((a,b)=>b.ts-a.ts);

  if(items.length===0) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">◐</div>
      <div>Sin notas de integración</div>
      <button class="btn btn-primary" style="margin-top:8px" id="btn-integ-add">Nueva nota</button>
    </div>`;
    cont.querySelector('#btn-integ-add')?.addEventListener('click',()=>openIntegModal(null));
    return;
  }

  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:10px">
    ${items.map(item=>{
      const a1=alters.find(a=>a.id===item.alter1Id);
      const a2=item.alter2Id?alters.find(a=>a.id===item.alter2Id):null;
      const d=new Date(item.ts).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'});
      return `<div class="integ-card" data-iid="${item.id}">
        <div class="integ-alters">
          ${a1?`<div class="integ-alter-av" style="background:${a1.bg};border-color:${a1.color}">${a1.emoji}</div>`:''}
          ${a2?`<span class="integ-arrow">⟷</span><div class="integ-alter-av" style="background:${a2.bg};border-color:${a2.color}">${a2.emoji}</div>`:''}
          <div style="margin-left:6px">
            <div style="font-size:12px;font-weight:700">${a1?.name||'?'}${a2?' ↔ '+a2.name:''}</div>
            <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${d}</div>
          </div>
        </div>
        ${item.title?`<div style="font-size:13px;font-weight:700">${escM(item.title)}</div>`:''}
        ${item.body?`<div style="font-size:12px;color:var(--text-1);line-height:1.6">${escM(item.body)}</div>`:''}
        ${item.progress!=null?`
        <div>
          <div style="display:flex;justify-content:space-between;font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-bottom:4px">
            <span>Progreso</span><span>${item.progress}%</span>
          </div>
          <div class="integ-progress-bar"><div class="integ-progress-fill" style="width:${item.progress}%"></div></div>
        </div>`:''}
        <div style="display:flex;justify-content:flex-end;gap:4px">
          <button class="icon-btn btn-integ-edit" data-iid="${item.id}">✎</button>
          <button class="icon-btn btn-integ-del" data-iid="${item.id}">✕</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  cont.querySelectorAll('.btn-integ-edit').forEach(b=>b.addEventListener('click',()=>{
    const item=loadIntegracion().find(x=>x.id===b.dataset.iid); if(item) openIntegModal(item);
  }));
  cont.querySelectorAll('.btn-integ-del').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('¿Eliminar esta nota?')) return;
    saveIntegracion(loadIntegracion().filter(x=>x.id!==b.dataset.iid));
    showToast('Nota eliminada'); renderMemoriaView();
  }));
}

function escM(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

function getAutoDeviceName() {
  const ua = navigator.userAgent;
  let browser = 'Navegador';
  if (/Edg\//.test(ua))               browser = 'Edge';
  else if (/OPR\//.test(ua))          browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Browser';
  else if (/Chrome\//.test(ua))       browser = 'Chrome';
  else if (/Firefox\//.test(ua))      browser = 'Firefox';
  else if (/Safari\//.test(ua))       browser = 'Safari';
  let os = 'dispositivo';
  if (/Android/.test(ua))             os = 'Android';
  else if (/iPhone|iPad/.test(ua))    os = 'iOS';
  else if (/Win/.test(ua))            os = 'Windows';
  else if (/Mac/.test(ua))            os = 'macOS';
  else if (/Linux/.test(ua))          os = 'Linux';
  return `${browser} en ${os}`;
}

// ════ MODALES ════
function openTimelineModal(item) {
  const isEdit=!!item;
  const it=item||{title:'',body:'',type:'hito',date:new Date().toISOString().slice(0,10),tags:[],alterId:activeAlter.id};
  let edTags=[...(it.tags||[])];
  const alters=getAlters();

  openModal(`
    <div class="modal-title">${isEdit?'Editar evento':'Nuevo evento en la línea temporal'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="tl-title" placeholder="¿Qué ocurrió?" value="${escM(it.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción (opcional)</div>
        <textarea id="tl-body" placeholder="Más detalles...">${escM(it.body||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Tipo</div>
          <select id="tl-type">
            ${TL_TYPES.map(t=>`<option value="${t.id}" ${it.type===t.id?'selected':''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Fecha</div>
          <input type="date" id="tl-date" value="${it.date}">
        </div>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Alter</div>
          <select id="tl-alter">
            <option value="">Sistema</option>
            ${alters.map(a=>`<option value="${a.id}" ${it.alterId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Etiquetas</div>
          <div id="tl-tags-row" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:6px 10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;min-height:36px">
            ${edTags.map((t,i)=>`<span class="tag-pill-rm">${esc(t)}<button data-ti="${i}">✕</button></span>`).join('')}
            <input class="tag-input" id="tl-tag-input" placeholder="tag..." style="flex:1;min-width:50px">
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Añadir'}</button>
    </div>`,
    (ov)=>{
      const title=ov.querySelector('#tl-title').value.trim();
      if(!title) return showToast('⚠ El título es obligatorio');
      const entry={id:it.id||uid(),title,body:ov.querySelector('#tl-body').value.trim(),
        type:ov.querySelector('#tl-type').value,date:ov.querySelector('#tl-date').value,
        alterId:ov.querySelector('#tl-alter').value||null,tags:[...edTags]};
      let list=loadTimeline();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveTimeline(list); closeModal(); showToast(isEdit?'Evento actualizado ✓':'Evento añadido ✓'); renderMemoriaView();
    }
  );
  const ov=document.querySelector('.modal-overlay');
  function refreshTlTags(){
    const row=ov.querySelector('#tl-tags-row'); if(!row) return;
    row.innerHTML=`${edTags.map((t,i)=>`<span class="tag-pill-rm">${esc(t)}<button data-ti="${i}">✕</button></span>`).join('')}<input class="tag-input" id="tl-tag-input" placeholder="tag..." style="flex:1;min-width:50px">`;
    row.querySelectorAll('[data-ti]').forEach(b=>b.addEventListener('click',()=>{ edTags.splice(+b.dataset.ti,1); refreshTlTags(); }));
    ov.querySelector('#tl-tag-input')?.addEventListener('keydown',tlTagKey);
  }
  function tlTagKey(e){
    if((e.key==='Enter'||e.key===','||e.key===' ')&&e.target.value.trim()){
      e.preventDefault(); const t=e.target.value.trim().toLowerCase().replace(/[^a-z0-9áéíóúüñ-]/g,'');
      if(t&&!edTags.includes(t)) edTags.push(t); refreshTlTags();
    }
    if(e.key==='Backspace'&&!e.target.value&&edTags.length){ edTags.pop(); refreshTlTags(); }
  }
  ov.querySelectorAll('[data-ti]').forEach(b=>b.addEventListener('click',()=>{ edTags.splice(+b.dataset.ti,1); refreshTlTags(); }));
  ov.querySelector('#tl-tag-input')?.addEventListener('keydown',tlTagKey);
}

function openCambioModal(item) {
  const isEdit=!!item;
  const it=item||{title:'',desc:'',importance:'medio',date:new Date().toISOString().slice(0,10),alterId:activeAlter.id};
  const alters=getAlters();

  openModal(`
    <div class="modal-title">${isEdit?'Editar cambio':'Registrar cambio importante'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="cb-title" placeholder="¿Qué cambió?" value="${escM(it.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción (opcional)</div>
        <textarea id="cb-desc" placeholder="Contexto y detalles...">${escM(it.desc||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Importancia</div>
          <div style="display:flex;gap:6px">
            ${CAMBIO_IMPORTANCE.map(i=>`<div class="recur-opt${it.importance===i.id?' selected':''}" data-imp="${i.id}" style="flex:1;text-align:center;padding:8px 4px">
              <div style="font-size:18px;color:${i.color}">${i.emoji}</div>
              <div style="font-size:10px;font-weight:600;margin-top:3px">${i.id}</div>
            </div>`).join('')}
          </div>
          <input type="hidden" id="cb-importance" value="${it.importance||'medio'}">
        </div>
        <div class="form-row">
          <div class="form-label">Fecha</div>
          <input type="date" id="cb-date" value="${it.date}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Alter</div>
        <select id="cb-alter">
          <option value="">Sistema</option>
          ${alters.map(a=>`<option value="${a.id}" ${it.alterId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Registrar'}</button>
    </div>`,
    (ov)=>{
      const title=ov.querySelector('#cb-title').value.trim();
      if(!title) return showToast('⚠ El título es obligatorio');
      const entry={id:it.id||uid(),title,desc:ov.querySelector('#cb-desc').value.trim(),
        importance:ov.querySelector('#cb-importance').value,date:ov.querySelector('#cb-date').value,
        alterId:ov.querySelector('#cb-alter').value||null};
      let list=loadCambios();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveCambios(list); closeModal(); showToast(isEdit?'Cambio actualizado ✓':'Cambio registrado ✓'); renderMemoriaView();
    }
  );
  const ov=document.querySelector('.modal-overlay');
  ov.querySelectorAll('[data-imp]').forEach(opt=>opt.addEventListener('click',()=>{
    ov.querySelectorAll('[data-imp]').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected'); ov.querySelector('#cb-importance').value=opt.dataset.imp;
  }));
}

function openIntegModal(item) {
  const isEdit=!!item;
  const it=item||{title:'',body:'',alter1Id:activeAlter.id,alter2Id:'',progress:0};
  const alters=getAlters();

  openModal(`
    <div class="modal-title">${isEdit?'Editar nota de integración':'Nueva nota de integración'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título (opcional)</div>
        <input type="text" id="ig-title" placeholder="Tema de trabajo..." value="${escM(it.title||'')}">
      </div>
      <div class="form-row">
        <div class="form-label">Notas</div>
        <textarea id="ig-body" placeholder="Observaciones, avances, reflexiones..." style="min-height:120px">${escM(it.body||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Alter</div>
          <select id="ig-alter1">
            ${alters.map(a=>`<option value="${a.id}" ${it.alter1Id===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Alter (opcional)</div>
          <select id="ig-alter2">
            <option value="">—</option>
            ${alters.map(a=>`<option value="${a.id}" ${it.alter2Id===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Progreso (0–100)</div>
        <input type="range" id="ig-progress" min="0" max="100" value="${it.progress||0}" style="width:100%">
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);text-align:right" id="ig-progress-val">${it.progress||0}%</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Añadir'}</button>
    </div>`,
    (ov)=>{
      const body=ov.querySelector('#ig-body').value.trim();
      if(!body) return showToast('⚠ Escribe algo');
      const entry={id:it.id||uid(),title:ov.querySelector('#ig-title').value.trim(),body,
        alter1Id:ov.querySelector('#ig-alter1').value,alter2Id:ov.querySelector('#ig-alter2').value||null,
        progress:+ov.querySelector('#ig-progress').value,ts:it.ts||Date.now()};
      let list=loadIntegracion();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveIntegracion(list); closeModal(); showToast(isEdit?'Nota actualizada ✓':'Nota añadida ✓'); renderMemoriaView();
    }
  );
  const ov=document.querySelector('.modal-overlay');
  const rng=ov.querySelector('#ig-progress'); const lbl=ov.querySelector('#ig-progress-val');
  rng?.addEventListener('input',()=>{ if(lbl) lbl.textContent=rng.value+'%'; });
}

// ═══════════════════════════════════════════════
// PROYECTOS
// ═══════════════════════════════════════════════
const ROUTINE_SCOPE_LABELS = { personal:'Personal', shared:'Compartida', system:'Sistema' };
const ROUTINE_SCOPE_OPTIONS = [
  {id:'personal', label:'Personal'},
  {id:'shared', label:'Compartida'},
  {id:'system', label:'Sistema'},
];
const ROUTINE_FREQ_OPTIONS = [
  {id:'daily', label:'Diaria'},
  {id:'weekly', label:'Semanal'},
];
const ROUTINE_DAY_OPTIONS = [
  {id:1, short:'L', label:'Lunes'},
  {id:2, short:'M', label:'Martes'},
  {id:3, short:'X', label:'Miércoles'},
  {id:4, short:'J', label:'Jueves'},
  {id:5, short:'V', label:'Viernes'},
  {id:6, short:'S', label:'Sábado'},
  {id:0, short:'D', label:'Domingo'},
];

function loadRoutines()    { try { return JSON.parse(localStorage.getItem('tid_routines'))||[]; } catch{return[];} }
function saveRoutines(rs)  { localStorage.setItem('tid_routines', JSON.stringify(rs)); }
function loadRoutineLog()  { try { return JSON.parse(localStorage.getItem('tid_routine_log'))||[]; } catch{return[];} }
function saveRoutineLog(l) { localStorage.setItem('tid_routine_log', JSON.stringify(l)); }
function todayIso() { return new Date().toISOString().slice(0,10); }
function routineVisibleToAlter(r, alterId) {
  if (r.scope === 'system' || r.scope === 'shared') return true;
  const ids = Array.isArray(r.alterIds) ? r.alterIds : [];
  return !!alterId && ids.includes(alterId);
}
function routineDueOnDate(r, isoDate) {
  if (!r?.active) return false;
  if (r.frequency !== 'weekly') return true;
  const day = new Date(`${isoDate}T12:00:00`).getDay();
  return (Array.isArray(r.daysOfWeek) ? r.daysOfWeek : []).includes(day);
}
function getRoutineLogEntry(routineId, date) {
  return loadRoutineLog().find(x=>x.routineId===routineId && x.date===date) || null;
}
function upsertRoutineLogEntry(entry) {
  const list = loadRoutineLog();
  const idx = list.findIndex(x=>x.routineId===entry.routineId && x.date===entry.date);
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  saveRoutineLog(list);
}
function routineProgress(r, date) {
  const entry = getRoutineLogEntry(r.id, date);
  const steps = Array.isArray(r.checklist) ? r.checklist : [];
  const completed = entry?.completedSteps || [];
  const total = steps.length;
  const doneCount = total ? steps.filter(s=>completed.includes(s.id)).length : (entry?.done ? 1 : 0);
  const done = total ? doneCount >= total && total > 0 : !!entry?.done;
  return { entry, total, doneCount, done };
}
function setRoutineStepDone(routineId, date, stepId, checked) {
  const entry = getRoutineLogEntry(routineId, date) || { id:uid(), routineId, date, completedSteps:[], done:false, alterId:activeAlter?.id||null, ts:Date.now() };
  const steps = new Set(entry.completedSteps || []);
  if (checked) steps.add(stepId); else steps.delete(stepId);
  entry.completedSteps = [...steps];
  entry.done = false;
  entry.ts = Date.now();
  upsertRoutineLogEntry(entry);
}
function setRoutineDone(routineId, date, done) {
  const entry = getRoutineLogEntry(routineId, date) || { id:uid(), routineId, date, completedSteps:[], done:false, alterId:activeAlter?.id||null, ts:Date.now() };
  entry.done = !!done;
  entry.ts = Date.now();
  upsertRoutineLogEntry(entry);
}
function routineAssigneeText(r, alters) {
  const ids = Array.isArray(r.alterIds) ? r.alterIds : [];
  if (r.scope === 'system') return 'Sistema';
  if (!ids.length) return r.scope === 'shared' ? 'Compartida' : 'Sin alter asignado';
  return ids.map(id => alters.find(a=>a.id===id)?.name).filter(Boolean).join(' · ');
}
function renderRutinasAdherencia(routines, todayDate) {
  if (!routines.length) return `<div class="task-panel"><div class="task-empty"><div class="task-empty-icon">◎</div><div>No hay rutinas activas</div></div></div>`;

  const log = loadRoutineLog();
  const DAYS = 30;

  // Generar últimos 30 días
  const dates = [];
  for (let i = DAYS-1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    dates.push(d.toISOString().slice(0,10));
  }

  return routines.map(r => {
    const dueDates   = dates.filter(d => routineDueOnDate(r, d));
    const doneDates  = dueDates.filter(d => {
      const entry = log.find(x=>x.routineId===r.id && x.date===d);
      return routineProgress(r, d).done || entry?.done;
    });

    const pct = dueDates.length ? Math.round((doneDates.length / dueDates.length)*100) : null;

    // Racha actual (días consecutivos completados hacia atrás desde hoy)
    let streak = 0;
    for (let i = 0; i < dates.length; i++) {
      const d = dates[dates.length-1-i];
      if (!routineDueOnDate(r, d)) continue;
      const done = doneDates.includes(d);
      if (done) streak++; else break;
    }

    // Mini dots — últimos 14 días
    const last14 = dates.slice(-14);
    const dots = last14.map(d => {
      if (!routineDueOnDate(r, d)) return `<span style="width:10px;height:10px;border-radius:50%;background:var(--bg-3);flex-shrink:0;display:inline-block" title="${d}"></span>`;
      const done = doneDates.includes(d);
      return `<span style="width:10px;height:10px;border-radius:50%;background:${done?'var(--accent-2)':'var(--bg-3)'};border:${done?'none':'1px solid var(--border-active)'};flex-shrink:0;display:inline-block" title="${d}"></span>`;
    }).join('');

    return `<div class="task-panel" style="gap:10px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">${r.emoji||'◎'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;color:var(--text-0)">${escM(r.name)}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${r.frequency==='weekly'?'Semanal':'Diaria'} · ${doneDates.length}/${dueDates.length} días completados</div>
        </div>
        ${pct!=null ? `<div style="text-align:right;flex-shrink:0">
          <div style="font-size:18px;font-weight:800;color:${pct>=80?'var(--accent-2)':pct>=50?'var(--accent)':'var(--accent-4)'}">${pct}%</div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">adherencia</div>
        </div>` : ''}
      </div>
      <div style="height:4px;background:var(--bg-3);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${pct??0}%;background:${(pct??0)>=80?'var(--accent-2)':(pct??0)>=50?'var(--accent)':'var(--accent-4)'};border-radius:2px;transition:width .4s"></div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
        ${dots}
        ${streak>0 ? `<span style="margin-left:6px;font-family:'DM Mono',monospace;font-size:9px;color:var(--accent-2)">🔥 ${streak} racha</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderRutinas() {
  return window.AtriaRoutinesView.render();
}

function renderProyectos() {
  return window.AtriaProjectsView.render();
}

function openProyModal(proy) {
  const isEdit=!!proy;
  const p=proy||{name:'',desc:'',color:PROY_COLORS[0],responsableId:activeAlter.id,deadline:'',status:'activo',categories:['General']};
  const alters=getAlters();

  openModal(`
    <div class="modal-title">${isEdit?'Editar proyecto':'Nuevo proyecto'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Nombre del proyecto</div>
        <input type="text" id="pr-name" placeholder="Nombre del proyecto" value="${escP(p.name)}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción (opcional)</div>
        <textarea id="pr-desc" placeholder="¿De qué trata este proyecto?">${escP(p.desc||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Notas del proyecto</div>
        <textarea id="pr-notes" placeholder="Notas, contexto o decisiones del proyecto...">${escP(p.notes||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Documentos y enlaces</div>
        <textarea id="pr-documents" placeholder="Un enlace por línea: nombre | https://ejemplo.com">${escP((p.documents||[]).map(d=>`${d.name||''} | ${d.url||''}`).join('\n'))}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Categorías de tareas (opcional)</div>
        <input type="text" id="pr-categories" placeholder="General, Casa, Salud" value="${escP((p.categories||['General']).join(', '))}">
      </div>
      <div class="form-row">
        <div class="form-label">Color</div>
        <div class="chan-color-opts">
          ${PROY_COLORS.map((c,i)=>`<div class="chan-color-opt${p.color===c?' selected':''}" data-pc="${c}" style="background:${c};${p.color===c?'border-color:white':''}""></div>`).join('')}
        </div>
        <input type="hidden" id="pr-color" value="${p.color||PROY_COLORS[0]}">
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Responsable</div>
          <select id="pr-resp">
            <option value="">Sin asignar</option>
            ${alters.map(a=>`<option value="${a.id}" ${p.responsableId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Estado</div>
          <select id="pr-status">
            ${PROY_STATUSES.map(s=>`<option value="${s.id}" ${p.status===s.id?'selected':''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Fecha límite (opcional)</div>
        <input type="date" id="pr-deadline" value="${p.deadline||''}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Crear proyecto'}</button>
    </div>`,
    (ov)=>{
      const name=ov.querySelector('#pr-name').value.trim();
      if(!name) return showToast('⚠ El nombre es obligatorio');
      const categories=[...new Set(ov.querySelector('#pr-categories').value.split(',').map(x=>x.trim()).filter(Boolean))];
      const documents=ov.querySelector('#pr-documents').value.split('\n').map(line=>{const [rawName,...rawUrl]=line.split('|'),url=rawUrl.join('|').trim();return {id:uid(),name:(rawName||url).trim(),url};}).filter(d=>d.url);
      const entry={id:p.id||uid(),name,desc:ov.querySelector('#pr-desc').value.trim(),notes:ov.querySelector('#pr-notes').value.trim(),documents,categories:categories.length?categories:['General'],
        color:ov.querySelector('#pr-color').value,responsableId:ov.querySelector('#pr-resp').value||null,
        status:ov.querySelector('#pr-status').value,deadline:ov.querySelector('#pr-deadline').value,ts:p.ts||Date.now()};
      let list=loadProyectos();
      if(isEdit) list=list.map(x=>x.id===p.id?entry:x);
      else { list.push(entry); activeProyId=entry.id; }
      saveProyectos(list);
      closeModal(); showToast(isEdit?'Proyecto actualizado ✓':'Proyecto creado ✓'); renderProyView();
    }
  );
  const ov=document.querySelector('.modal-overlay');
  ov.querySelectorAll('.chan-color-opt').forEach(sw=>sw.addEventListener('click',()=>{
    ov.querySelectorAll('.chan-color-opt').forEach(s=>{s.classList.remove('selected');s.style.borderColor='transparent';});
    sw.classList.add('selected'); sw.style.borderColor='white';
    ov.querySelector('#pr-color').value=sw.dataset.pc;
  }));
}

function openTaskModal(task, proyId, alters) {
  const isEdit=!!task;
  const t=task||{title:'',desc:'',assigneeId:activeAlter.id,priority:'media',status:'pendiente',deadline:'',tags:[],category:'General',parentId:null};
  const project=loadProyectos().find(p=>p.id===proyId);
  const categories=taskCategories(proyId, project);
  const parents=loadTareas().filter(x=>x.proyId===proyId&&x.id!==t.id&&!x.parentId);

  openModal(`
    <div class="modal-title">${isEdit?'Editar tarea':'Nueva tarea'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="tk-title" placeholder="¿Qué hay que hacer?" value="${escP(t.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción (opcional)</div>
        <textarea id="tk-desc" placeholder="Más detalles...">${escP(t.desc||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Categoría</div>
          <select id="tk-category">${categories.map(c=>`<option value="${escP(c)}" ${t.category===c?'selected':''}>${escP(c)}</option>`).join('')}</select>
        </div>
        <div class="form-row">
          <div class="form-label">Subtarea de</div>
          <select id="tk-parent"><option value="">Tarea principal</option>${parents.map(x=>`<option value="${x.id}" ${t.parentId===x.id?'selected':''}>${escP(x.title)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Asignar a</div>
          <select id="tk-assignee">
            <option value="">Sin asignar</option>
            ${alters.map(a=>`<option value="${a.id}" ${t.assigneeId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Estado</div>
          <select id="tk-status">
            ${TASK_STATUSES.map(s=>`<option value="${s.id}" ${t.status===s.id?'selected':''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Prioridad</div>
        <div class="priority-opts" style="gap:5px">
          ${PRIORITIES.map(pr=>`<div class="priority-opt${t.priority===pr.id?' selected':''} ${pr.id}" data-pri="${pr.id}" style="padding:6px 4px">
            <div style="font-size:15px">${pr.emoji}</div>
            <div class="priority-opt-label" style="font-size:9px">${pr.label}</div>
          </div>`).join('')}
        </div>
        <input type="hidden" id="tk-priority" value="${t.priority||'media'}">
      </div>
      <div class="form-row">
        <div class="form-label">Fecha límite (opcional)</div>
        <input type="date" id="tk-deadline" value="${t.deadline||''}">
      </div>
      <div class="form-row">
        <div class="form-label">Tags</div>
        <input type="text" id="tk-tags" placeholder="#salud #casa" value="${(t.tags||[]).map(tag=>'#'+escP(tag)).join(' ')}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Crear tarea'}</button>
    </div>`,
    (ov)=>{
      const title=ov.querySelector('#tk-title').value.trim();
      if(!title) return showToast('⚠ El título es obligatorio');
      const tags = ov.querySelector('#tk-tags').value.split(/\s+/).map(x=>x.replace(/^#/,'').trim()).filter(Boolean);
      const entry={id:t.id||uid(),proyId,title,desc:ov.querySelector('#tk-desc').value.trim(),category:ov.querySelector('#tk-category').value||'General',parentId:ov.querySelector('#tk-parent').value||null,
        assigneeId:ov.querySelector('#tk-assignee').value||null,
        status:ov.querySelector('#tk-status').value,priority:ov.querySelector('#tk-priority').value,
        deadline:ov.querySelector('#tk-deadline').value,tags,ts:t.ts||Date.now()};
      let list=loadTareas();
      if(isEdit) list=list.map(x=>x.id===t.id?entry:x);
      else list.push(entry);
      saveTareas(list); closeModal();
      showToast(isEdit?'Tarea actualizada ✓':'Tarea creada ✓'); renderProyView();
    }
  );
  const ov=document.querySelector('.modal-overlay');
  ov.querySelectorAll('.priority-opt').forEach(opt=>opt.addEventListener('click',()=>{
    ov.querySelectorAll('.priority-opt').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected'); ov.querySelector('#tk-priority').value=opt.dataset.pri;
  }));
}

// ═══════════════════════════════════════════════
// WISHLIST
// ═══════════════════════════════════════════════
const WISH_CATS = [
  {id:'personal',    label:'Personal',    accent:'#c4aaff', cls:'wish-cat-personal'},
  {id:'material',    label:'Material',    accent:'#ffd580', cls:'wish-cat-material'},
  {id:'experiencia', label:'Experiencia', accent:'#7affd4', cls:'wish-cat-experiencia'},
  {id:'sistema',     label:'Sistema',     accent:'#ff8ae2', cls:'wish-cat-sistema'},
  {id:'otro',        label:'Otro',        accent:'#b8b4d8', cls:'wish-cat-otro'},
];
const WISH_STATUSES = [
  {id:'deseado',    label:'Deseado',     emoji:'✨'},
  {id:'en-progreso',label:'En progreso', emoji:'⏳'},
  {id:'conseguido', label:'Conseguido',  emoji:'✅'},
  {id:'descartado', label:'Descartado',  emoji:'✕'},
];

let wishScope      = 'personal'; // 'personal' | 'sistema'
let wishViewMode   = 'grid';
let wishStatusFilter = 'all';
let wishCatFilter    = 'all';

function loadWishes()   { try { return JSON.parse(localStorage.getItem('tid_wishes'))||[]; } catch{return[];} }
function saveWishes(w)  { localStorage.setItem('tid_wishes', JSON.stringify(w)); }

function getMyWishes()   { return loadWishes().filter(w=>w.scope==='personal'&&w.alterId===activeAlter.id); }
function getSysWishes()  { return loadWishes().filter(w=>w.scope==='sistema'); }

function renderWishlist() {
  comTab = 'deseos';
  renderInnerChat();
}

function renderWishInContainer(cont) {
  if (!cont) return;
  const alters = getAlters();
  const pool   = wishScope==='personal' ? getMyWishes() : getSysWishes();
  const total       = pool.length;
  const conseguidos = pool.filter(w=>w.status==='conseguido').length;
  const enProgreso  = pool.filter(w=>w.status==='en-progreso').length;
  const totalPrice  = pool.filter(w=>w.price&&w.status!=='conseguido'&&w.status!=='descartado')
                         .reduce((s,w)=>s+(parseFloat(w.price)||0),0);
  let filtered = pool.filter(w=>{
    const stOk  = wishStatusFilter==='all'||w.status===wishStatusFilter;
    const catOk = wishCatFilter==='all'||w.category===wishCatFilter;
    return stOk && catOk;
  });
  filtered.sort((a,b)=>{
    const po={alta:0,media:1,baja:2};
    const stEnd=(s)=>s==='conseguido'||s==='descartado'?1:0;
    return stEnd(a.status)-stEnd(b.status)||(po[a.priority]??1)-(po[b.priority]??1)||(b.ts-a.ts);
  });
  const activeCats = [...new Set(pool.map(w=>w.category).filter(Boolean))];

  cont.innerHTML = `
    <div class="wish-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◈ Deseos</div>
          <div class="fin-subtitle">${total} deseo${total!==1?'s':''} · ${conseguidos} conseguido${conseguidos!==1?'s':''}</div>
        </div>
        <button class="btn btn-primary" id="btn-new-wish">+ Añadir deseo</button>
      </div>
      <div class="wish-stats">
        <div class="wish-stat"><div class="wish-stat-val" style="color:var(--accent)">${total}</div><div class="wish-stat-label">Total</div></div>
        <div class="wish-stat"><div class="wish-stat-val" style="color:var(--accent-4)">${enProgreso}</div><div class="wish-stat-label">En progreso</div></div>
        <div class="wish-stat"><div class="wish-stat-val" style="color:var(--green)">${conseguidos}</div><div class="wish-stat-label">Conseguidos</div></div>
        ${totalPrice>0?`<div class="wish-stat"><div class="wish-stat-val" style="color:var(--accent-3)">${totalPrice.toFixed(0)}€</div><div class="wish-stat-label">Precio estimado</div></div>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="wish-scope-toggle">
          <div class="wish-scope-btn${wishScope==='personal'?' active':''}" data-scope="personal">👤 Personal</div>
          <div class="wish-scope-btn${wishScope==='sistema'?' active':''}" data-scope="sistema">◎ Sistema</div>
        </div>
        <div class="notas-view-toggle">
          <div class="notas-view-btn${wishViewMode==='grid'?' active':''}" id="btn-wish-grid" title="Grid">⊞</div>
          <div class="notas-view-btn${wishViewMode==='list'?' active':''}" id="btn-wish-list" title="Lista">☰</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="wish-status-filter">
          <div class="wish-status-chip${wishStatusFilter==='all'?' active':''}" data-sf="all">Todos · ${pool.length}</div>
          ${WISH_STATUSES.map(s=>{ const cnt=pool.filter(w=>w.status===s.id).length; if(!cnt) return '';
            return `<div class="wish-status-chip${wishStatusFilter===s.id?' active':''}" data-sf="${s.id}">${s.emoji} ${s.label} · ${cnt}</div>`; }).join('')}
        </div>
        ${activeCats.length>1?`<div class="wish-status-filter">
          <div class="wish-status-chip${wishCatFilter==='all'?' active':''}" data-cf="all">Todas las categorías</div>
          ${activeCats.map(cid=>{ const cat=WISH_CATS.find(c=>c.id===cid); if(!cat) return '';
            return `<div class="wish-status-chip${wishCatFilter===cid?' active':''}" data-cf="${cid}">${cat.label}</div>`; }).join('')}
        </div>`:''}
      </div>
      <div id="wish-content">
        ${filtered.length===0?`<div class="empty-state" style="padding:50px 20px">
          <div class="empty-icon">◈</div>
          <div>${total===0?'Tu wishlist está vacía':'Sin deseos con estos filtros'}</div>
          ${total===0?`<button class="btn btn-primary" style="margin-top:8px" id="btn-empty-wish">Añadir primer deseo</button>`:''}
        </div>`:
        wishViewMode==='grid'?renderWishGrid(filtered,alters):renderWishListView(filtered,alters)}
      </div>
    </div>`;

  cont.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>{ wishScope=b.dataset.scope; renderComTabContent(cont); }));
  cont.querySelector('#btn-wish-grid')?.addEventListener('click',()=>{ wishViewMode='grid'; renderComTabContent(cont); });
  cont.querySelector('#btn-wish-list')?.addEventListener('click',()=>{ wishViewMode='list'; renderComTabContent(cont); });
  cont.querySelectorAll('[data-sf]').forEach(b=>b.addEventListener('click',()=>{ wishStatusFilter=b.dataset.sf; renderComTabContent(cont); }));
  cont.querySelectorAll('[data-cf]').forEach(b=>b.addEventListener('click',()=>{ wishCatFilter=b.dataset.cf; renderComTabContent(cont); }));
  cont.querySelector('#btn-new-wish')?.addEventListener('click',()=>openWishModal(null));
  cont.querySelector('#btn-empty-wish')?.addEventListener('click',()=>openWishModal(null));
  wireWishCards(cont);
}


function renderWishView() {
  const app    = document.getElementById('app');
  const alters = getAlters();
  const pool   = wishScope==='personal' ? getMyWishes() : getSysWishes();

  // Stats
  const total     = pool.length;
  const conseguidos = pool.filter(w=>w.status==='conseguido').length;
  const enProgreso  = pool.filter(w=>w.status==='en-progreso').length;
  const totalPrice  = pool.filter(w=>w.price&&w.status!=='conseguido'&&w.status!=='descartado')
                         .reduce((s,w)=>s+(parseFloat(w.price)||0),0);

  // Filters
  let filtered = pool.filter(w=>{
    const stOk  = wishStatusFilter==='all'||w.status===wishStatusFilter;
    const catOk = wishCatFilter==='all'||w.category===wishCatFilter;
    return stOk && catOk;
  });
  // conseguido/descartado al final
  filtered.sort((a,b)=>{
    const po={alta:0,media:1,baja:2};
    const stEnd = (s)=>s==='conseguido'||s==='descartado'?1:0;
    return stEnd(a.status)-stEnd(b.status)||(po[a.priority]??1)-(po[b.priority]??1)||(b.ts-a.ts);
  });

  const activeCats = [...new Set(pool.map(w=>w.category).filter(Boolean))];

  app.innerHTML = `
    <div class="wish-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◈ Wishlist</div>
          <div class="fin-subtitle">${total} deseo${total!==1?'s':''} · ${conseguidos} conseguido${conseguidos!==1?'s':''}</div>
        </div>
        <button class="btn btn-primary" id="btn-new-wish">+ Añadir deseo</button>
      </div>

      <!-- STATS -->
      <div class="wish-stats">
        <div class="wish-stat">
          <div class="wish-stat-val" style="color:var(--accent)">${total}</div>
          <div class="wish-stat-label">Total</div>
        </div>
        <div class="wish-stat">
          <div class="wish-stat-val" style="color:var(--accent-4)">${enProgreso}</div>
          <div class="wish-stat-label">En progreso</div>
        </div>
        <div class="wish-stat">
          <div class="wish-stat-val" style="color:var(--green)">${conseguidos}</div>
          <div class="wish-stat-label">Conseguidos</div>
        </div>
        ${totalPrice>0?`<div class="wish-stat">
          <div class="wish-stat-val" style="color:var(--accent-3)">${totalPrice.toFixed(0)}€</div>
          <div class="wish-stat-label">Precio estimado</div>
        </div>`:''}
      </div>

      <!-- TOOLBAR -->
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="wish-scope-toggle">
          <div class="wish-scope-btn${wishScope==='personal'?' active':''}" data-scope="personal">👤 Personal</div>
          <div class="wish-scope-btn${wishScope==='sistema'?' active':''}" data-scope="sistema">◎ Sistema</div>
        </div>
        <div class="notas-view-toggle">
          <div class="notas-view-btn${wishViewMode==='grid'?' active':''}" id="btn-wish-grid" title="Grid">⊞</div>
          <div class="notas-view-btn${wishViewMode==='list'?' active':''}" id="btn-wish-list" title="Lista">☰</div>
        </div>
      </div>

      <!-- STATUS FILTER -->
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="wish-status-filter">
          <div class="wish-status-chip${wishStatusFilter==='all'?' active':''}" data-sf="all">Todos · ${pool.length}</div>
          ${WISH_STATUSES.map(s=>{
            const cnt=pool.filter(w=>w.status===s.id).length;
            if(!cnt) return '';
            return `<div class="wish-status-chip${wishStatusFilter===s.id?' active':''}" data-sf="${s.id}">${s.emoji} ${s.label} · ${cnt}</div>`;
          }).join('')}
        </div>
        ${activeCats.length>1?`<div class="wish-status-filter">
          <div class="wish-status-chip${wishCatFilter==='all'?' active':''}" data-cf="all">Todas las categorías</div>
          ${activeCats.map(cid=>{
            const cat=WISH_CATS.find(c=>c.id===cid);
            if(!cat) return '';
            return `<div class="wish-status-chip${wishCatFilter===cid?' active':''}" data-cf="${cid}" style="${wishCatFilter===cid?`border-color:${cat.accent};background:rgba(0,0,0,.0);color:${cat.accent}`:''}">${cat.label}</div>`;
          }).join('')}
        </div>`:''}
      </div>

      <!-- CONTENT -->
      <div id="wish-content">
        ${filtered.length===0?`<div class="empty-state" style="padding:50px 20px">
          <div class="empty-icon">◈</div>
          <div>${total===0?'Tu wishlist está vacía':'Sin deseos con estos filtros'}</div>
          ${total===0?`<button class="btn btn-primary" style="margin-top:8px" id="btn-empty-wish">Añadir primer deseo</button>`:''}
        </div>`:
        wishViewMode==='grid'?renderWishGrid(filtered,alters):renderWishListView(filtered,alters)}
      </div>
    </div>`;

  // Scope toggle
  app.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>{ wishScope=b.dataset.scope; renderInnerChat(); }));
  // View toggle
  app.querySelector('#btn-wish-grid')?.addEventListener('click',()=>{ wishViewMode='grid'; renderInnerChat(); });
  app.querySelector('#btn-wish-list')?.addEventListener('click',()=>{ wishViewMode='list'; renderInnerChat(); });
  // Status filter
  app.querySelectorAll('[data-sf]').forEach(b=>b.addEventListener('click',()=>{ wishStatusFilter=b.dataset.sf; renderInnerChat(); }));
  // Cat filter
  app.querySelectorAll('[data-cf]').forEach(b=>b.addEventListener('click',()=>{ wishCatFilter=b.dataset.cf; renderInnerChat(); }));
  // New
  app.querySelector('#btn-new-wish')?.addEventListener('click',()=>openWishModal(null));
  app.querySelector('#btn-empty-wish')?.addEventListener('click',()=>openWishModal(null));

  wireWishCards(app);
}

function catOf(cid) { return WISH_CATS.find(c=>c.id===cid)||WISH_CATS[4]; }
function statusOf(sid) { return WISH_STATUSES.find(s=>s.id===sid)||WISH_STATUSES[0]; }

function renderWishGrid(wishes, alters) {
  return `<div class="wish-grid">
    ${wishes.map(w=>{
      const cat = catOf(w.category);
      const st  = statusOf(w.status);
      const alt = alters.find(a=>a.id===w.alterId);
      const isOwn = w.alterId===activeAlter.id;
      return `<div class="wish-card ${w.status}" data-wid="${w.id}">
        <div class="wish-card-accent" style="background:${cat.accent}"></div>
        <div class="wish-card-inner">
          <div class="wish-card-header">
            <div class="wish-card-title">${escB(w.title)}</div>
            <div class="wish-card-status-icon" title="${st.label}">${st.emoji}</div>
          </div>
          ${w.desc?`<div class="wish-card-body">${escB(w.desc)}</div>`:''}
          <div class="wish-card-meta">
            <span class="wish-cat-chip ${cat.cls}">${cat.label}</span>
            ${w.price?`<span class="wish-price">~${w.price}€</span>`:''}
            ${w.url?`<a href="${w.url}" target="_blank" class="wish-url-icon" title="Abrir enlace">🔗</a>`:''}
          </div>
        </div>
        <div class="wish-card-footer">
          <div class="wish-alter-row">
            <span>${alt?.emoji||''}</span>
            <span>${wishScope==='sistema'?(alt?.name||''):'Mía'}</span>
            ${w.scope==='sistema'?`<span class="wish-shared-badge">compartida</span>`:''}
          </div>
          ${isOwn?`<div class="wish-card-actions">
            ${w.status!=='conseguido'&&w.status!=='descartado'?`<button class="icon-btn btn-wish-got" data-wid="${w.id}" title="Marcar conseguido">✅</button>`:''}
            <button class="icon-btn btn-wish-edit" data-wid="${w.id}" title="Editar">✎</button>
            <button class="icon-btn btn-wish-del" data-wid="${w.id}" title="Eliminar">✕</button>
          </div>`:''}
        </div>
      </div>`;
    }).join('')}
    <div class="nota-add-card" id="btn-add-wish-grid">
      <div class="nota-add-icon">+</div><div>Añadir deseo</div>
    </div>
  </div>`;
}

function renderWishListView(wishes, alters) {
  return `<div class="wish-list">
    ${wishes.map(w=>{
      const cat = catOf(w.category);
      const st  = statusOf(w.status);
      const alt = alters.find(a=>a.id===w.alterId);
      const isOwn = w.alterId===activeAlter.id;
      const d = new Date(w.ts).toLocaleDateString('es-ES',{day:'numeric',month:'short'});
      return `<div class="wish-list-item ${w.status}" data-wid="${w.id}">
        <div class="wish-accent-bar" style="background:${cat.accent}"></div>
        <div style="font-size:16px">${st.emoji}</div>
        <div class="wish-list-title">${escB(w.title)}</div>
        <span class="wish-cat-chip ${cat.cls}">${cat.label}</span>
        ${w.price?`<span class="wish-price" style="flex-shrink:0">~${w.price}€</span>`:''}
        ${w.url?`<a href="${w.url}" target="_blank" class="wish-url-icon" title="Abrir">🔗</a>`:''}
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);flex-shrink:0">${d}</span>
        ${wishScope==='sistema'?`<span title="${alt?.name||''}">${alt?.emoji||''}</span>`:''}
        ${isOwn?`<div class="wish-list-actions">
          ${w.status!=='conseguido'&&w.status!=='descartado'?`<button class="icon-btn btn-wish-got" data-wid="${w.id}" title="Conseguido">✅</button>`:''}
          <button class="icon-btn btn-wish-edit" data-wid="${w.id}" title="Editar">✎</button>
          <button class="icon-btn btn-wish-del" data-wid="${w.id}" title="Eliminar">✕</button>
        </div>`:''}
      </div>`;
    }).join('')}
  </div>`;
}


function wireWishCards(app) {
  // Click to detail
  app.querySelectorAll('[data-wid]').forEach(el=>el.addEventListener('click', e=>{
    if(e.target.closest('.wish-card-actions,.wish-list-actions,a')) return;
    const w=loadWishes().find(x=>x.id===el.dataset.wid);
    if(w) openWishDetail(w);
  }));
  app.querySelector('#btn-add-wish-grid')?.addEventListener('click',()=>openWishModal(null));
  // Got
  app.querySelectorAll('.btn-wish-got').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const ws=loadWishes(); const w=ws.find(x=>x.id===b.dataset.wid);
    if(w){ w.status='conseguido'; saveWishes(ws); showToast('¡Conseguido! ✅'); renderInnerChat(); }
  }));
  // Edit
  app.querySelectorAll('.btn-wish-edit').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const w=loadWishes().find(x=>x.id===b.dataset.wid); if(w) openWishModal(w);
  }));
  // Delete
  app.querySelectorAll('.btn-wish-del').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(!confirm('¿Eliminar este deseo?')) return;
    saveWishes(loadWishes().filter(x=>x.id!==b.dataset.wid));
    showToast('Deseo eliminado'); renderInnerChat();
  }));
}

function openWishDetail(w) {
  const cat = catOf(w.category);
  const st  = statusOf(w.status);
  const alt = getAlters().find(a=>a.id===w.alterId);
  const isOwn = w.alterId===activeAlter.id;
  const d = new Date(w.ts).toLocaleString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  openModal(`
    <div style="border-top:4px solid ${cat.accent};margin:-4px -4px 12px;border-radius:var(--radius-lg) var(--radius-lg) 0 0"></div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div class="modal-title" style="margin:0">${escB(w.title)}</div>
        <div style="font-size:22px" title="${st.label}">${st.emoji}</div>
      </div>
      ${w.desc?`<div style="font-size:13px;color:var(--text-1);line-height:1.65">${escB(w.desc)}</div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span class="wish-cat-chip ${cat.cls}">${cat.label}</span>
        ${w.price?`<span class="wish-price" style="font-size:13px">~${w.price}€</span>`:''}
        ${w.scope==='sistema'?`<span class="wish-shared-badge">◎ compartida</span>`:''}
      </div>
      ${w.url?`<a href="${w.url}" target="_blank" style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);word-break:break-all">🔗 ${w.url}</a>`:''}
      <div style="display:flex;align-items:center;gap:8px">
        <span>${alt?.emoji||''}</span>
        <span style="font-size:12px;color:var(--text-2)">${alt?.name||''}</span>
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-left:auto">${d}</span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cerrar</button>
      ${isOwn&&w.status!=='conseguido'&&w.status!=='descartado'?`<button class="btn btn-primary" id="det-wish-got">✅ Conseguido</button>`:''}
      ${isOwn?`<button class="btn btn-ghost" id="det-wish-edit">✎ Editar</button>`:''}
    </div>`,
    ()=>{}
  );
  document.getElementById('det-wish-got')?.addEventListener('click',()=>{
    const ws=loadWishes(); const ww=ws.find(x=>x.id===w.id);
    if(ww){ ww.status='conseguido'; saveWishes(ws); }
    closeModal(); showToast('¡Conseguido! ✅'); renderInnerChat();
  });
  document.getElementById('det-wish-edit')?.addEventListener('click',()=>{ closeModal(); openWishModal(w); });
}

function openWishModal(wish) {
  const isEdit = !!wish;
  const w = wish||{title:'',desc:'',category:'personal',priority:'media',status:'deseado',price:'',url:'',scope:'personal'};

  openModal(`
    <div class="modal-title">${isEdit?'Editar deseo':'Nuevo deseo'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="wh-title" placeholder="¿Qué deseas?" value="${escB(w.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción (opcional)</div>
        <textarea id="wh-desc" placeholder="Más detalles...">${escB(w.desc||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Categoría</div>
          <select id="wh-cat">
            ${WISH_CATS.map(c=>`<option value="${c.id}" ${w.category===c.id?'selected':''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Prioridad</div>
          <div class="priority-opts" style="gap:5px">
            ${PRIORITIES.map(p=>`<div class="priority-opt${w.priority===p.id?' selected':''} ${p.id}" data-pri="${p.id}" style="padding:6px 4px">
              <div style="font-size:15px">${p.emoji}</div>
              <div class="priority-opt-label" style="font-size:9px">${p.label}</div>
            </div>`).join('')}
          </div>
          <input type="hidden" id="wh-priority" value="${w.priority||'media'}">
        </div>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Precio estimado (€)</div>
          <input type="number" id="wh-price" placeholder="0.00" min="0" step="0.01" value="${w.price||''}">
        </div>
        <div class="form-row">
          <div class="form-label">Estado</div>
          <select id="wh-status">
            ${WISH_STATUSES.map(s=>`<option value="${s.id}" ${w.status===s.id?'selected':''}>${s.emoji} ${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Enlace URL (opcional)</div>
        <input type="url" id="wh-url" placeholder="https://..." value="${escB(w.url||'')}">
      </div>
      <div class="form-row">
        <div class="form-label">Visibilidad</div>
        <div style="display:flex;gap:8px">
          <div class="recur-opt${(w.scope||'personal')==='personal'?' selected':''}" data-scope-opt="personal" style="flex:1;text-align:center;padding:10px">
            <div style="font-size:18px">👤</div>
            <div style="font-size:11px;font-weight:700;margin-top:4px">Personal</div>
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">Solo yo la veo</div>
          </div>
          <div class="recur-opt${w.scope==='sistema'?' selected':''}" data-scope-opt="sistema" style="flex:1;text-align:center;padding:10px">
            <div style="font-size:18px">◎</div>
            <div style="font-size:11px;font-weight:700;margin-top:4px">Sistema</div>
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">Visible para todos</div>
          </div>
        </div>
        <input type="hidden" id="wh-scope" value="${w.scope||'personal'}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Añadir'}</button>
    </div>`,
    (ov) => {
      const title    = ov.querySelector('#wh-title').value.trim();
      const desc     = ov.querySelector('#wh-desc').value.trim();
      const category = ov.querySelector('#wh-cat').value;
      const priority = ov.querySelector('#wh-priority').value;
      const status   = ov.querySelector('#wh-status').value;
      const price    = ov.querySelector('#wh-price').value.trim();
      const url      = ov.querySelector('#wh-url').value.trim();
      const scope    = ov.querySelector('#wh-scope').value;
      if(!title) return showToast('⚠ El título es obligatorio');
      let list = loadWishes();
      const entry = {id:w.id||uid(),alterId:activeAlter.id,title,desc,category,priority,status,price,url,scope,ts:w.ts||Date.now()};
      if(isEdit) list=list.map(x=>x.id===w.id?entry:x);
      else list.push(entry);
      saveWishes(list);
      closeModal();
      wishScope=scope;
      showToast(isEdit?'Deseo actualizado ✓':'Deseo añadido ✓');
      renderInnerChat();
    }
  );

  const ov=document.querySelector('.modal-overlay');
  ov.querySelectorAll('.priority-opt').forEach(opt=>opt.addEventListener('click',()=>{
    ov.querySelectorAll('.priority-opt').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected'); ov.querySelector('#wh-priority').value=opt.dataset.pri;
  }));
  ov.querySelectorAll('[data-scope-opt]').forEach(opt=>opt.addEventListener('click',()=>{
    ov.querySelectorAll('[data-scope-opt]').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected'); ov.querySelector('#wh-scope').value=opt.dataset.scopeOpt;
  }));
}

// ═══════════════════════════════════════════════
// SOLICITUDES (compartido con módulo Notas)
// ═══════════════════════════════════════════════
const SOLIC_STATUSES = [
  {id:'pendiente',  label:'Pendiente',  color:'var(--accent-4)'},
  {id:'aceptada',   label:'Aceptada',   color:'var(--green)'},
  {id:'rechazada',  label:'Rechazada',  color:'var(--red)'},
  {id:'completada', label:'Completada', color:'var(--text-2)'},
];
const SOLIC_PRI_COLORS = {alta:'var(--red)',media:'var(--accent-4)',baja:'var(--accent-3)'};

let notasModuleTab = 'solicitudes'; // 'solicitudes' | 'diario'
let solicTab       = 'recibidas'; // 'recibidas' | 'enviadas' | 'todas'

function loadSolicitudes()  { try { return JSON.parse(localStorage.getItem('tid_solicitudes'))||[]; } catch{return[];} }
function saveSolicitudes(s) { localStorage.setItem('tid_solicitudes', JSON.stringify(s)); }

// renderNotas → redirige a Comunicación tab Tablón (definida más arriba en la sección de innerChat)
// renderDiario → redirige a Personal/Referencia con tab diario
function renderDiarioFromNotas() {
  // alias legacy
  renderDiario();
}

// ── Solicitudes como módulo standalone (también accesible desde Comunicación) ──
function renderSolicitudesStandalone() {
  notasModuleTab = 'solicitudes';
  renderNotasSolicView();
}

function renderNotasSolicView() {
  // Solo Solicitudes y Diario — Notas absorbida por Tablón
  const app = document.getElementById('app');
  const pendRecibidas = loadSolicitudes().filter(s=>
    (s.toId===activeAlter.id||s.toId==='sistema') && s.status==='pendiente'
  ).length;
  const titles = {solicitudes:'◱ Solicitudes', diario:'◫ Diario'};
  const subs   = {solicitudes:'Peticiones internas entre alters', diario:'Entradas y reflexiones personales'};
  const btnNew = {solicitudes:'+ Nueva solicitud', diario:'+ Nueva entrada'};
  const tab = ['solicitudes','diario'].includes(notasModuleTab) ? notasModuleTab : 'solicitudes';

  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:titles[tab]||'Solicitudes'}]);

  app.innerHTML = `<div style="max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:20px;animation:fadeUp 360ms ease both">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div>
        <div class="fin-title">${titles[tab]}</div>
        <div class="fin-subtitle">${subs[tab]}</div>
      </div>
      <button class="btn btn-primary" id="btn-module-new">${btnNew[tab]}</button>
    </div>
    <div class="module-tabs">
      <div class="module-tab${tab==='solicitudes'?' active':''}" data-mt="solicitudes">
        ◱ Solicitudes${pendRecibidas>0?`<span class="mtab-badge">${pendRecibidas}</span>`:''}
      </div>
      <div class="module-tab${tab==='diario'?' active':''}" data-mt="diario">◫ Diario</div>
    </div>
    <div id="module-content"></div>
  </div>`;

  app.querySelectorAll('[data-mt]').forEach(t=>t.addEventListener('click',()=>{
    notasModuleTab=t.dataset.mt; renderNotasSolicView();
  }));
  app.querySelector('#btn-module-new')?.addEventListener('click',()=>{
    if(tab==='solicitudes') openSolicModal(null);
    else { const a=document.getElementById('app'); diarioMode='write'; diarioEditing=null; editorTags=[]; renderDiarioInContainer(document.getElementById('module-content')); }
  });

  const cont = app.querySelector('#module-content');
  if(tab==='solicitudes') renderSolicitudesInContainer(cont);
  else renderDiarioInContainer(cont);
}

// ── Reuse notas rendering inside container ──
function renderNotasInContainer(container) {
  const alters = getAlters();
  const todas  = getVisibleNotas();
  let filtered = todas.filter(n=>{
    const alterOk = notasFilterAlter==='all'||n.alterId===notasFilterAlter;
    const tagOk   = !notasFilterTag||(n.tags||[]).includes(notasFilterTag);
    return alterOk && tagOk;
  });
  filtered.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||(b.ts-a.ts));
  const allTags   = [...new Set(todas.flatMap(n=>n.tags||[]))].sort();
  const countByAlter={};
  todas.forEach(n=>{ countByAlter[n.alterId]=(countByAlter[n.alterId]||0)+1; });

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="btn-note-templates2">Plantillas</button>
        <div class="notas-view-toggle">
          <div class="notas-view-btn${notasViewMode==='grid'?' active':''}" id="btn-view-grid2" title="Grid">⊞</div>
          <div class="notas-view-btn${notasViewMode==='list'?' active':''}" id="btn-view-list2" title="Lista">☰</div>
        </div>
        <div class="notas-filter-alter">
          <div class="nota-alter-chip${notasFilterAlter==='all'?' active':''}" data-fa2="all"
            style="${notasFilterAlter==='all'?'border-color:var(--border-active);background:var(--bg-3)':''}">Todos · ${todas.length}</div>
          ${alters.filter(a=>countByAlter[a.id]).map(a=>`
            <div class="nota-alter-chip${notasFilterAlter===a.id?' active':''}" data-fa2="${a.id}"
              style="${notasFilterAlter===a.id?`border-color:${a.color};background:${a.bg};color:${a.color}`:''}">
              ${a.emoji} ${esc(a.name)} · ${countByAlter[a.id]||0}
            </div>`).join('')}
        </div>
        ${allTags.length>0?`<div style="display:flex;gap:4px;flex-wrap:wrap">
          <div class="nota-alter-chip${!notasFilterTag?' active':''}" data-ft2="" style="${!notasFilterTag?'border-color:var(--border-active);background:var(--bg-3)':''}">Todos</div>
          ${allTags.map(t=>`<div class="nota-alter-chip${notasFilterTag===t?' active':''}" data-ft2="${t}"
            style="${notasFilterTag===t?'border-color:var(--accent);background:rgba(160,138,255,.1);color:var(--accent)':''}">#${t}</div>`).join('')}
        </div>`:''}
      </div>
      <div id="notas-content2"></div>
    </div>`;

  container.querySelectorAll('[data-fa2]').forEach(el=>el.addEventListener('click',()=>{ notasFilterAlter=el.dataset.fa2; renderNotasInContainer(container); }));
  container.querySelectorAll('[data-ft2]').forEach(el=>el.addEventListener('click',()=>{ notasFilterTag=el.dataset.ft2||null; renderNotasInContainer(container); }));
  container.querySelector('#btn-view-grid2')?.addEventListener('click',()=>{ notasViewMode='grid'; renderNotasInContainer(container); });
  container.querySelector('#btn-view-list2')?.addEventListener('click',()=>{ notasViewMode='list'; renderNotasInContainer(container); });
  container.querySelector('#btn-note-templates2')?.addEventListener('click',()=>openTemplatesModal('note', {afterUse:'notas-module'}));
  renderNotasContent(container.querySelector('#notas-content2'), filtered, alters);
}

// ── SOLICITUDES VIEW ──
function renderSolicitudesInContainer(container) {
  const alters = getAlters();
  const todas  = loadSolicitudes();

  const recibidas = todas.filter(s=>s.toId===activeAlter.id||s.toId==='sistema');
  const enviadas  = todas.filter(s=>s.fromId===activeAlter.id);
  const current   = solicTab==='recibidas'?recibidas : solicTab==='enviadas'?enviadas : todas;

  const sorted = [...current].sort((a,b)=>{
    const po={alta:0,media:1,baja:2};
    const so={pendiente:0,aceptada:1,completada:2,rechazada:3};
    return (so[a.status]??0)-(so[b.status]??0)||(po[a.priority]??1)-(po[b.priority]??1)||(b.ts-a.ts);
  });

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="normas-tabs">
        ${[
          {id:'recibidas', label:'Recibidas', count:recibidas.filter(s=>s.status==='pendiente').length},
          {id:'enviadas',  label:'Enviadas',  count:0},
          {id:'todas',     label:'Todas',     count:0},
        ].map(t=>`<div class="normas-tab${solicTab===t.id?' active':''}" data-st="${t.id}">
          ${t.label}${t.count>0?`<span class="tab-badge">${t.count}</span>`:''}
        </div>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px" id="solic-list">
        ${sorted.length===0?`<div class="empty-state" style="padding:50px 20px">
          <div class="empty-icon">◱</div>
          <div>Sin solicitudes ${solicTab==='recibidas'?'recibidas':solicTab==='enviadas'?'enviadas':''}</div>
        </div>`:sorted.map(s=>renderSolicCard(s,alters)).join('')}
      </div>
    </div>`;

  container.querySelectorAll('[data-st]').forEach(t=>t.addEventListener('click',()=>{ solicTab=t.dataset.st; renderSolicitudesInContainer(container); }));
  wireSolicCards(container, alters, container);
}

function renderSolicCard(s, alters) {
  const from = alters.find(a=>a.id===s.fromId);
  const to   = s.toId==='sistema' ? {name:'Sistema',emoji:'◎',color:'var(--text-2)',bg:'var(--bg-2)'} : alters.find(a=>a.id===s.toId);
  const pri  = PRIORITIES.find(p=>p.id===s.priority)||PRIORITIES[1];
  const priColor = SOLIC_PRI_COLORS[s.priority]||'var(--text-2)';
  const isFrom = s.fromId===activeAlter.id;
  const isTo   = s.toId===activeAlter.id||s.toId==='sistema';
  const today  = new Date().toISOString().slice(0,10);
  const overdue= s.deadline && s.deadline<today && s.status==='pendiente';
  const d      = new Date(s.ts).toLocaleDateString('es-ES',{day:'numeric',month:'short'});

  return `<div class="solic-card ${s.status}" data-sid="${s.id}">
    <div class="solic-top">
      <div class="solic-avatar-pair">
        <div class="solic-av" style="background:${from?.bg||'var(--bg-2)'};border-color:${from?.color||'transparent'}">${from?.emoji||'◎'}</div>
        <div class="solic-av solic-av-to" style="background:${to?.bg||'var(--bg-2)'};border-color:${to?.color||'transparent'}">${to?.emoji||'◎'}</div>
      </div>
      <div class="solic-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div class="solic-title">${escSolic(s.title)}</div>
          <span class="solic-status-badge ${s.status}">${s.status}</span>
        </div>
        ${s.desc?`<div class="solic-desc">${escSolic(s.desc)}</div>`:''}
        <div class="solic-meta">
          <div class="solic-from-to">
            <span style="color:${from?.color||'var(--text-1)'};font-weight:700">${from?.name||'?'}</span>
            <span style="color:var(--text-3);font-size:10px">→</span>
            <span style="color:${to?.color||'var(--text-1)'};font-weight:700">${to?.name||'Sistema'}</span>
          </div>
          <div class="solic-priority-dot" style="background:${priColor}" title="${pri.label}"></div>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:${priColor}">${s.priority}</span>
          <span class="solic-date" style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">📅 ${d}</span>
          ${s.deadline?`<span class="solic-deadline${overdue?' overdue':''}">⏱ ${overdue?'Vencida: ':'Límite: '}${fmtDate(s.deadline)}</span>`:''}
        </div>
      </div>
    </div>

    ${s.response?`
    <div class="solic-response">
      <div class="solic-response-avatar" style="background:${to?.bg||'var(--bg-2)'};border-color:${to?.color||'transparent'}">${to?.emoji||'◎'}</div>
      <div>
        <div class="solic-response-bubble">${escSolic(s.response)}</div>
        <div class="solic-response-meta">${to?.name||'?'} · ${s.respondedTs?new Date(s.respondedTs).toLocaleDateString('es-ES',{day:'numeric',month:'short'}):''}</div>
      </div>
    </div>`:''}

    <div class="solic-actions">
      ${isTo&&s.status==='pendiente'?`
        <button class="btn btn-primary btn-sm btn-aceptar-solic" data-sid="${s.id}">✓ Aceptar</button>
        <button class="btn btn-danger btn-sm btn-rechazar-solic" data-sid="${s.id}">✕ Rechazar</button>
        <button class="btn btn-ghost btn-sm btn-responder-toggle" data-sid="${s.id}">💬 Responder</button>`:''}
      ${isFrom&&s.status==='aceptada'?`
        <button class="btn btn-primary btn-sm btn-completar-solic" data-sid="${s.id}">✓ Marcar completada</button>`:''}
      ${isFrom&&s.status==='pendiente'?`
        <button class="btn btn-ghost btn-sm btn-edit-solic" data-sid="${s.id}">✎ Editar</button>`:''}
      ${(isFrom||activeAlter.isAdmin)?`
        <button class="btn btn-danger btn-sm btn-del-solic" data-sid="${s.id}" style="margin-left:auto">✕ Eliminar</button>`:''}
    </div>

    <div class="solic-respond-area" id="respond-area-${s.id}" style="display:none">
      <textarea class="solic-respond-input" id="respond-input-${s.id}" placeholder="Escribe tu respuesta..." rows="2"></textarea>
      <button class="btn btn-primary btn-sm btn-send-response" data-sid="${s.id}">Enviar</button>
    </div>
  </div>`;
}

function escSolic(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function wireSolicCards(container, alters, parentContainer) {
  // Aceptar
  container.querySelectorAll('.btn-aceptar-solic').forEach(b=>b.addEventListener('click',()=>{
    const ss=loadSolicitudes(); const s=ss.find(x=>x.id===b.dataset.sid);
    if(s){ s.status='aceptada'; s.respondedTs=Date.now(); saveSolicitudes(ss); }
    showToast('Solicitud aceptada ✓'); renderSolicitudesInContainer(parentContainer);
  }));
  // Rechazar
  container.querySelectorAll('.btn-rechazar-solic').forEach(b=>b.addEventListener('click',()=>{
    const ss=loadSolicitudes(); const s=ss.find(x=>x.id===b.dataset.sid);
    if(s){ s.status='rechazada'; s.respondedTs=Date.now(); saveSolicitudes(ss); }
    showToast('Solicitud rechazada'); renderSolicitudesInContainer(parentContainer);
  }));
  // Completar
  container.querySelectorAll('.btn-completar-solic').forEach(b=>b.addEventListener('click',()=>{
    const ss=loadSolicitudes(); const s=ss.find(x=>x.id===b.dataset.sid);
    if(s){ s.status='completada'; saveSolicitudes(ss); }
    showToast('Solicitud completada ✓'); renderSolicitudesInContainer(parentContainer);
  }));
  // Toggle respond area
  container.querySelectorAll('.btn-responder-toggle').forEach(b=>b.addEventListener('click',()=>{
    const area=container.querySelector(`#respond-area-${b.dataset.sid}`);
    if(area){ area.style.display=area.style.display==='none'?'flex':'none'; area.querySelector('textarea')?.focus(); }
  }));
  // Send response
  container.querySelectorAll('.btn-send-response').forEach(b=>b.addEventListener('click',()=>{
    const inp=container.querySelector(`#respond-input-${b.dataset.sid}`);
    const text=inp?.value.trim(); if(!text) return showToast('⚠ Escribe algo');
    const ss=loadSolicitudes(); const s=ss.find(x=>x.id===b.dataset.sid);
    if(s){ s.response=text; s.respondedTs=Date.now(); s.status='aceptada'; saveSolicitudes(ss); }
    showToast('Respuesta enviada ✓'); renderSolicitudesInContainer(parentContainer);
  }));
  // Edit
  container.querySelectorAll('.btn-edit-solic').forEach(b=>b.addEventListener('click',()=>{
    const s=loadSolicitudes().find(x=>x.id===b.dataset.sid); if(s) openSolicModal(s);
  }));
  // Delete
  container.querySelectorAll('.btn-del-solic').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('¿Eliminar solicitud?')) return;
    saveSolicitudes(loadSolicitudes().filter(x=>x.id!==b.dataset.sid));
    showToast('Solicitud eliminada'); renderSolicitudesInContainer(parentContainer);
  }));
}

function openSolicModal(solic) {
  const isEdit = !!solic;
  const s = solic||{title:'',desc:'',toId:'',priority:'media',deadline:''};
  const alters = getAlters().filter(a=>a.id!==activeAlter.id);

  openModal(`
    <div class="modal-title">${isEdit?'Editar solicitud':'Nueva solicitud'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="sl-title" placeholder="¿Qué necesitas?" value="${escSolic(s.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción (opcional)</div>
        <textarea id="sl-desc" placeholder="Más contexto sobre la solicitud...">${escSolic(s.desc||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Dirigida a</div>
          <select id="sl-to">
            <option value="sistema" ${s.toId==='sistema'?'selected':''}>◎ Sistema (todos)</option>
            ${alters.map(a=>`<option value="${a.id}" ${s.toId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Prioridad</div>
          <div class="priority-opts" style="gap:5px">
            ${PRIORITIES.map(p=>`<div class="priority-opt${s.priority===p.id?' selected':''} ${p.id}" data-pri="${p.id}" style="padding:6px 4px">
              <div style="font-size:15px">${p.emoji}</div>
              <div class="priority-opt-label" style="font-size:9px">${p.label}</div>
            </div>`).join('')}
          </div>
          <input type="hidden" id="sl-priority" value="${s.priority||'media'}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Fecha límite (opcional)</div>
        <input type="date" id="sl-deadline" value="${s.deadline||''}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Enviar solicitud'}</button>
    </div>`,
    (ov) => {
      const title    = ov.querySelector('#sl-title').value.trim();
      const desc     = ov.querySelector('#sl-desc').value.trim();
      const toId     = ov.querySelector('#sl-to').value;
      const priority = ov.querySelector('#sl-priority').value;
      const deadline = ov.querySelector('#sl-deadline').value;
      if(!title) return showToast('⚠ El título es obligatorio');
      if(!toId)  return showToast('⚠ Selecciona destinatario');
      let list = loadSolicitudes();
      const entry = {id:s.id||uid(),fromId:activeAlter.id,toId,title,desc,priority,deadline,status:s.status||'pendiente',ts:s.ts||Date.now(),response:s.response,respondedTs:s.respondedTs};
      if(isEdit) list=list.map(x=>x.id===s.id?entry:x);
      else { list.push(entry); solicTab='enviadas'; }
      saveSolicitudes(list);
      closeModal();
      showToast(isEdit?'Solicitud actualizada ✓':'Solicitud enviada ✓');
      notasModuleTab='solicitudes'; renderNotasSolicView();
    }
  );
  const ov=document.querySelector('.modal-overlay');
  ov.querySelectorAll('.priority-opt').forEach(opt=>opt.addEventListener('click',()=>{
    ov.querySelectorAll('.priority-opt').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected'); ov.querySelector('#sl-priority').value=opt.dataset.pri;
  }));
}

// ═══════════════════════════════════════════════
// NORMAS
// ═══════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════
function renderPollCard(p, alters) {
  const creator = alters.find(a=>a.id===p.creatorId);
  const options = Array.isArray(p.options) && p.options.length ? p.options : [{id:'yes', label:'Si'}, {id:'no', label:'No'}];
  const votes = Array.isArray(p.votes) ? p.votes : [];
  const total = votes.length;
  const myVote = votes.find(v=>v.alterId===activeAlter.id)?.optionId || null;
  const dateStr = new Date(p.ts || Date.now()).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'});
  return `<div class="norma-card ${p.status||'activa'}" data-pid="${p.id}">
    <div class="norma-card-top">
      <div class="norma-priority media">◎</div>
      <div class="norma-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div class="norma-title">${escNorma(p.title)}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
            ${p.shareOnline && p.status!=='archivada'?`<span class="norma-status-badge activa">online</span>`:''}
            <span class="norma-status-badge ${p.status||'activa'}">${p.status==='archivada'?'archivada':'activa'}</span>
          </div>
        </div>
        ${p.desc?`<div class="norma-desc">${escNorma(p.desc)}</div>`:''}
        <div class="norma-meta">
          ${creator?`<div class="norma-proposer"><span class="norma-proposer-avatar">${creator.emoji}</span><span style="color:${creator.color};font-weight:600">${creator.name}</span></div>`:''}
          <span class="norma-date">📅 ${dateStr}</span>
          <span>${total} voto${total!==1?'s':''}</span>
        </div>
      </div>
    </div>
    <div class="norma-votes" style="flex-direction:column;align-items:stretch">
      ${options.map(opt=>{
        const count = votes.filter(v=>v.optionId===opt.id).length;
        const pct = total ? Math.round((count/total)*100) : 0;
        return `<div style="display:flex;align-items:center;gap:8px">
          <button class="vote-btn poll-vote-btn${myVote===opt.id?' voted-yes':''}" data-pid="${p.id}" data-option="${opt.id}" ${p.status==='archivada'?'disabled':''}>${escNorma(opt.label)}</button>
          <div class="vote-bar-wrap" style="flex:1">
            <div class="vote-bar"><div class="vote-bar-a" style="width:${pct}%"></div></div>
            <div class="vote-labels"><span>${count}</span><span>${pct}%</span></div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="norma-actions">
      ${p.creatorId===activeAlter.id||isAdmin()?`<button class="btn btn-ghost btn-sm btn-edit-poll" data-pid="${p.id}">✎ Editar</button>`:''}
      ${p.status!=='archivada'?`<button class="btn btn-ghost btn-sm btn-toggle-poll-share" data-pid="${p.id}">${p.shareOnline?'Dejar de compartir':'Compartir online'}</button>`:''}
      ${p.status!=='archivada'?`<button class="btn btn-ghost btn-sm btn-archive-poll" data-pid="${p.id}">↓ Archivar</button>`:`<button class="btn btn-ghost btn-sm btn-restore-poll" data-pid="${p.id}">↑ Restaurar</button>`}
      ${isAdmin()||p.creatorId===activeAlter.id?`<button class="btn btn-danger btn-sm btn-del-poll" data-pid="${p.id}">✕</button>`:''}
    </div>
  </div>`;
}

function wirePollCards(app) {
  app.querySelectorAll('.poll-vote-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const polls = loadPolls();
    const poll = polls.find(p=>p.id===btn.dataset.pid);
    if(!poll || poll.status==='archivada') return;
    if(!Array.isArray(poll.votes)) poll.votes = [];
    const existing = poll.votes.findIndex(v=>v.alterId===activeAlter.id);
    if(existing>=0){
      if(poll.votes[existing].optionId===btn.dataset.option) poll.votes.splice(existing,1);
      else poll.votes[existing].optionId = btn.dataset.option;
    } else {
      poll.votes.push({alterId:activeAlter.id, optionId:btn.dataset.option, ts:Date.now()});
    }
    savePolls(polls);
    rerenderPollSurface();
  }));
  app.querySelectorAll('.btn-edit-poll').forEach(btn=>btn.addEventListener('click',()=>{
    const poll = loadPolls().find(p=>p.id===btn.dataset.pid);
    if(poll) openPollModal(poll);
  }));
  app.querySelectorAll('.btn-toggle-poll-share').forEach(btn=>btn.addEventListener('click',()=>{
    const polls = loadPolls();
    const poll = polls.find(p=>p.id===btn.dataset.pid);
    if(poll){ poll.shareOnline = !poll.shareOnline; savePolls(polls); rerenderPollSurface(); }
  }));
  app.querySelectorAll('.btn-archive-poll').forEach(btn=>btn.addEventListener('click',()=>{
    const polls = loadPolls();
    const poll = polls.find(p=>p.id===btn.dataset.pid);
    if(poll){ poll.status='archivada'; poll.shareOnline=false; savePolls(polls); rerenderPollSurface(); }
  }));
  app.querySelectorAll('.btn-restore-poll').forEach(btn=>btn.addEventListener('click',()=>{
    const polls = loadPolls();
    const poll = polls.find(p=>p.id===btn.dataset.pid);
    if(poll){ poll.status='activa'; savePolls(polls); rerenderPollSurface(); }
  }));
  app.querySelectorAll('.btn-del-poll').forEach(btn=>btn.addEventListener('click',()=>{
    if(!confirm('¿Eliminar esta votación?')) return;
    savePolls(loadPolls().filter(p=>p.id!==btn.dataset.pid));
    rerenderPollSurface();
  }));
}

function openPollModal(poll) {
  const isEdit = !!poll;
  const p = poll || {title:'', desc:'', status:'activa', shareOnline:false, options:[{id:'opt-1', label:''},{id:'opt-2', label:''}], votes:[]};
  openModal(`
    <div class="modal-title">${isEdit?'Editar votación':'Nueva votación'}</div>
    <div class="form-grid">
      <div class="form-row"><div class="form-label">Título</div><input type="text" id="poll-title" value="${escNorma(p.title||'')}" placeholder="Ej: ¿Qué plan preferimos?"></div>
      <div class="form-row"><div class="form-label">Descripción opcional</div><textarea id="poll-desc" placeholder="Contexto de la votación...">${escNorma(p.desc||'')}</textarea></div>
      <div class="form-row"><div class="form-label">Opciones, una por línea</div><textarea id="poll-options" placeholder="Opción A&#10;Opción B">${escNorma((p.options||[]).map(o=>o.label).join('\n'))}</textarea></div>
      <div class="form-row"><div class="form-label">Estado</div><select id="poll-status"><option value="activa" ${p.status!=='archivada'?'selected':''}>Activa</option><option value="archivada" ${p.status==='archivada'?'selected':''}>Archivada</option></select></div>
      <label class="perm-toggle-row"><div><div class="perm-toggle-label">Compartir online</div><div class="perm-toggle-sublabel">Solo aparece para amistades con permiso de polls.</div></div><span class="toggle-switch"><input type="checkbox" id="poll-share-online" ${p.shareOnline && p.status!=='archivada'?'checked':''}><span class="toggle-slider"></span></span></label>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Crear'}</button></div>`,
    (ov) => {
      const title = ov.querySelector('#poll-title').value.trim();
      const desc = ov.querySelector('#poll-desc').value.trim();
      const status = ov.querySelector('#poll-status').value;
      const labels = ov.querySelector('#poll-options').value.split(/\n+/).map(v=>v.trim()).filter(Boolean);
      if(!title) return showToast('⚠ El título es obligatorio');
      if(labels.length < 2) return showToast('⚠ Añade al menos dos opciones');
      const oldOptions = Array.isArray(p.options) ? p.options : [];
      const options = labels.map((label, index)=>({ id: oldOptions[index]?.id || `opt-${Date.now()}-${index}`, label }));
      const allowedIds = new Set(options.map(o=>o.id));
      const votes = (p.votes||[]).filter(v=>allowedIds.has(v.optionId));
      const entry = { id: p.id || uid(), title, desc, status, creatorId: p.creatorId || activeAlter.id, ts: p.ts || Date.now(), options, votes, shareOnline: (status !== 'archivada' && ov.querySelector('#poll-share-online')?.checked) || undefined };
      const list = loadPolls();
      savePolls(isEdit ? list.map(x=>x.id===p.id?entry:x) : [...list, entry]);
      closeModal();
      showToast(isEdit?'Votación actualizada ✓':'Votación creada ✓');
      rerenderPollSurface();
    }
  );
}

const APP_VERSION = 'v0.13.0';
const ACCENT_COLORS = [
  {id:'purple', label:'Púrpura',  value:'#a08aff', bg:'rgba(160,138,255,0.12)'},
  {id:'pink',   label:'Rosa',     value:'#ff8ae2', bg:'rgba(255,138,226,0.12)'},
  {id:'teal',   label:'Verde',    value:'#8affe0', bg:'rgba(138,255,224,0.12)'},
  {id:'amber',  label:'Ámbar',    value:'#ffb450', bg:'rgba(255,180,80,0.12)'},
  {id:'blue',   label:'Azul',     value:'#8ab4ff', bg:'rgba(138,180,255,0.12)'},
  {id:'coral',  label:'Coral',    value:'#ff7f7f', bg:'rgba(255,127,127,0.12)'},
];
const STORAGE_KEYS = [
  {key:'tid_alters',       label:'Perfiles de alters',   section:'perfiles'},
  {key:'tid_events',       label:'Eventos de agenda',    section:'agenda'},
  {key:'tid_diary',        label:'Entradas del diario',  section:'diario'},
  {key:'tid_channels',     label:'Canales del chat',     section:'innerchat'},
  {key:'tid_messages',     label:'Mensajes del chat',    section:'innerchat'},
  {key:'tid_config',       label:'Configuración',        section:'config'},
  {key:'tid_tracker',      label:'Tracker emocional',    section:'tracker'},
  {key:'tid_reminders',    label:'Recordatorios',        section:'recordatorios'},
];

function loadConfig() {
  return window.AtriaStorage.loadConfig({ onlineApiBaseUrl: 'https://demos.lyokodev.com/api' });
}
function saveConfig(c) { return window.AtriaStorage.saveConfig(c); }
// Online frontend services live in online-services.js after R5.

function showReloadPrompt(msg) {
  const ex = document.getElementById('reload-prompt');
  if (ex) ex.remove();
  const el = document.createElement('div');
  el.id = 'reload-prompt';
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius);padding:14px 18px;z-index:9999;display:flex;align-items:center;gap:14px;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:360px;width:calc(100% - 32px)';
  el.innerHTML = `<span style="font-size:13px;color:var(--text-1);flex:1">${msg}</span><button class="btn btn-primary btn-sm" id="reload-prompt-btn">OK</button>`;
  document.body.appendChild(el);
  document.getElementById('reload-prompt-btn').addEventListener('click', () => location.reload());
}

function applyConfig(cfg) {
  // Accent color
  if (cfg.accentColor) {
    const ac = ACCENT_COLORS.find(a=>a.id===cfg.accentColor);
    if (ac) document.documentElement.style.setProperty('--accent', ac.value);
  }
  const theme = cfg.theme || 'auto';
  const isLightTheme = theme === 'light' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  applyTheme(theme);
  const custom = isLightTheme ? {} : (cfg.customTheme || {});
  const root = document.documentElement;
  const validHex = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));
  [['--bg-0', custom.background], ['--bg-1', custom.surface], ['--text-0', custom.text]].forEach(([name, value]) => {
    if (validHex(value)) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  });
  // Font size — zoom scales everything (all CSS uses px, not rem)
  const zooms = {small:'0.88', medium:'1', large:'1.13'};
  document.documentElement.style.zoom = zooms[cfg.fontSize||'medium'] || '1';
  // System name in label
  if (cfg.systemName) {
    const lbl = document.querySelector('.l0-label');
    if (lbl) lbl.textContent = cfg.systemName + ' · Atria';
  }
  // Theme (light/dark/auto)
  document.body.classList.toggle('mobile-nav-fixed', !!cfg.mobileNavFixed);
  document.body.classList.toggle('atria-simplified-mode', !!cfg.simplifiedMode || ['bebe','nino'].includes(activeAlter?.ageType));
}

function applyTheme(theme) {
  const prefer = window.matchMedia('(prefers-color-scheme: light)').matches;
  const isLight = theme === 'light' || (theme === 'auto' && prefer);
  document.documentElement.classList.toggle('light-mode', isLight);
}

function themeHexContrast(a, b) {
  const channel = (hex, i) => parseInt(hex.slice(i, i + 2), 16) / 255;
  const lum = hex => [1, 3, 5].map(i => channel(hex, i)).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

function renderConfigEmociones(app, back) {
  const renderList = () => {
    const moods = getMoods();
    app.innerHTML = `
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both">
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">🎭</div>
          <div><div class="config-section-title">Emociones</div><div class="config-section-desc">Personaliza los estados del tracker emocional</div></div>
        </div>
        <div class="config-rows" id="moods-list">
          ${moods.map((m,i) => `
            <div class="config-row" data-mood-idx="${i}">
              <div class="config-row-left" style="display:flex;align-items:center;gap:12px">
                <span style="font-size:22px">${m.emoji}</span>
                <div>
                  <div class="config-row-label">${m.label}</div>
                  <div class="config-row-sub" style="font-family:'DM Mono',monospace;font-size:10px">${m.id}</div>
                </div>
              </div>
              <div class="config-row-right" style="gap:6px">
                <button class="btn btn-ghost btn-sm btn-edit-mood" data-idx="${i}">✎ Editar</button>
                ${moods.length > 1 ? `<button class="btn btn-ghost btn-sm btn-del-mood" data-idx="${i}" style="color:#ff6b8a">✕</button>` : ''}
              </div>
            </div>`).join('')}
        </div>
        <div style="padding:12px 16px;border-top:1px solid var(--border)">
          <button class="btn btn-primary btn-sm" id="btn-add-mood">+ Añadir emoción</button>
          ${moods.length !== 10 || JSON.stringify(moods) !== JSON.stringify(getMoods()) ? '' : ''}
          <button class="btn btn-ghost btn-sm" id="btn-reset-moods" style="margin-left:8px;color:var(--text-3)">Restaurar por defecto</button>
        </div>
      </div>
    </div>`;

    app.querySelectorAll('.btn-edit-mood').forEach(btn => {
      btn.addEventListener('click', () => openMoodModal(getMoods()[+btn.dataset.idx], +btn.dataset.idx, renderList));
    });
    app.querySelectorAll('.btn-del-mood').forEach(btn => {
      btn.addEventListener('click', () => {
        const ms = getMoods(); ms.splice(+btn.dataset.idx, 1); saveMoods(ms);
        showToast('Emoción eliminada'); renderList();
      });
    });
    app.querySelector('#btn-add-mood').addEventListener('click', () => openMoodModal(null, null, renderList));
    app.querySelector('#btn-reset-moods').addEventListener('click', () => {
      if (confirm('¿Restaurar las emociones por defecto? Se perderán las personalizadas.')) {
        localStorage.removeItem('tid_moods'); showToast('Emociones restauradas ✓'); renderList();
      }
    });
  };
  renderList();
}

function openMoodModal(mood, idx, onDone) {
  const isNew = mood === null;
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal" style="max-width:360px;width:92%;padding:24px">
      <div class="modal-title">${isNew ? 'Nueva emoción' : 'Editar emoción'}</div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:16px">
        <div>
          <label class="config-row-sub" style="display:block;margin-bottom:6px">Emoji</label>
          <div style="display:flex;align-items:center;gap:10px">
            <div id="mood-emoji-preview" style="font-size:32px;min-width:40px;text-align:center">${mood?.emoji||'😊'}</div>
            <input class="system-name-input" id="mood-emoji-input" maxlength="4" placeholder="Emoji..." value="${mood?.emoji||'😊'}" style="width:80px;text-align:center;font-size:20px">
          </div>
        </div>
        <div>
          <label class="config-row-sub" style="display:block;margin-bottom:6px">Nombre</label>
          <input class="system-name-input" id="mood-label-input" maxlength="24" placeholder="Nombre de la emoción..." value="${mood?.label||''}" style="width:100%">
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
        <button class="btn btn-ghost btn-sm" data-cancel>Cancelar</button>
        <button class="btn btn-primary btn-sm" id="btn-save-mood-cfg">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  ov.querySelector('#mood-emoji-input').addEventListener('input', e => {
    ov.querySelector('#mood-emoji-preview').textContent = e.target.value || '😊';
  });
  ov.querySelector('[data-cancel]').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });

  ov.querySelector('#btn-save-mood-cfg').addEventListener('click', () => {
    const emoji = ov.querySelector('#mood-emoji-input').value.trim() || '😊';
    const label = ov.querySelector('#mood-label-input').value.trim();
    if (!label) { showToast('⚠ Escribe un nombre'); return; }
    const ms = getMoods();
    if (isNew) {
      const id = 'custom-' + Date.now();
      ms.push({id, emoji, label});
    } else {
      ms[idx] = {...ms[idx], emoji, label};
    }
    saveMoods(ms);
    showToast(isNew ? 'Emoción añadida ✓' : 'Emoción actualizada ✓');
    ov.remove();
    onDone();
  });
}

// Online hub views live in es/online-views.js after R4.

function renderConfig() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Configuración'}]);
  const cfg = loadConfig();
  const app = document.getElementById('app');
  const online = getOnlineProfile(cfg);

  // Storage total rápido
  let totalBytes = 0;
  for (let i=0; i<localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('tid_')) totalBytes += new Blob([localStorage.getItem(k)||'']).size;
  }
  const fmtBytes = b => b<1024?b+'B':b<1024*1024?(b/1024).toFixed(1)+'KB':(b/1024/1024).toFixed(2)+'MB';

  const onlineFriends = loadOnlineFriends();
  const onlinePending = loadOnlineFriendRequests().filter(r => r.status === 'pending');
  const sections = [
    {id:'personalizacion', icon:'🎨', name:'Personalización',  desc:'Nombre del sistema, colores y fuente',  color:'#c4aaff', bg:'rgba(196,170,255,0.08)'},
    {id:'datos',           icon:'💾', name:'Datos',            desc:'Copia externa, importar y exportar',           color:'#8affe0', bg:'rgba(138,255,224,0.08)'},
    {id:'almacenamiento',  icon:'🗄', name:'Almacenamiento',   desc:fmtBytes(totalBytes)+' usados en local',  color:'#ffb450', bg:'rgba(255,180,80,0.08)'},
    {id:'emociones',       icon:'🎭', name:'Emociones',        desc:'Personalizar estados del tracker',      color:'#ffd580', bg:'rgba(255,213,128,0.08)'},
    {id:'notificaciones',  icon:'🔔', name:'Notificaciones',   desc:'Qué avisos recibir y cuándo',           color:'#ff8ae2', bg:'rgba(255,138,226,0.08)'},
    {id:'online',          icon:'☁',  name:'Funciones online', desc:online.enabled ? `Activas · ${online.email || online.systemId} · sync automático` : 'Amigos, chat online, presencia, sync y backup', color:'#5fffb0', bg:'rgba(95,255,176,0.08)'},
    {id:'peligro',         icon:'⚠️', name:'Zona de peligro',  desc:'Resetear módulos o borrar todo',        color:'#ff6b8a', bg:'rgba(255,107,138,0.08)'},
    {id:'acerca',          icon:'💜', name:'Sobre Atria',      desc:APP_VERSION+' · Privado, local-first y con funciones online opcionales', color:'#a08aff', bg:'rgba(160,138,255,0.08)'},
  ];

  app.innerHTML = `
  <div style="max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:24px;animation:fadeUp 360ms ease both">
    <div>
      <div class="fin-title">⚙ Configuración</div>
      <div class="fin-subtitle">Sistema · ${APP_VERSION}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
      ${sections.map(s=>`
        <button class="cfg-hub-card" data-cfg="${s.id}" style="--card-c:${s.color};--card-bg:${s.bg}">
          <div class="cfg-hub-icon">${s.icon}</div>
          <div style="flex:1;text-align:left">
            <div class="cfg-hub-name">${s.name}</div>
            <div class="cfg-hub-desc">${s.desc}</div>
          </div>
          <div style="color:var(--text-3);font-size:14px">›</div>
        </button>`).join('')}
    </div>
  </div>`;

  app.querySelectorAll('.cfg-hub-card').forEach(btn => btn.addEventListener('click', () => {
    renderConfigSection(btn.dataset.cfg);
  }));
}

function renderConfigSection(section) {
  const back = () => renderConfig();
  const labels = {personalizacion:'Personalización',datos:'Datos',almacenamiento:'Almacenamiento',emociones:'Emociones',notificaciones:'Notificaciones',online:'Funciones online',peligro:'Zona de peligro',acerca:'Sobre Atria'};
  setCrumbs([
    {label:'Hub', action:()=>navigateTo('hub')},
    {label:'Configuración', action: back},
    {label: labels[section]||section},
  ]);

  const app = document.getElementById('app');
  const cfg = loadConfig();

  if (section === 'personalizacion') {
    const selAccent = cfg.accentColor||'purple';
    const selFont   = cfg.fontSize||'medium';
    const selTheme  = cfg.theme||'auto';
    const customTheme = cfg.customTheme || {};
    app.innerHTML = `
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both">
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">🎨</div>
          <div><div class="config-section-title">Personalización</div><div class="config-section-desc">Apariencia y nombre del sistema</div></div>
        </div>
        <div class="config-rows">
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Nombre del sistema</div>
              <div class="config-row-sub">Aparece en la pantalla de inicio</div>
            </div>
            <div class="config-row-right">
              <input class="system-name-input" id="cfg-sysname" placeholder="Nombre del sistema..." value="${cfg.systemName||''}">
              <button class="btn btn-ghost btn-sm" id="btn-save-sysname">Guardar</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Tema</div>
              <div class="config-row-sub">Claro u oscuro · Auto sigue el sistema</div>
            </div>
            <div class="config-row-right">
              <div class="font-size-row">
                <div class="font-size-opt${selTheme==='auto'?' selected':''}" data-theme="auto">Auto</div>
                <div class="font-size-opt${selTheme==='dark'?' selected':''}" data-theme="dark">Oscuro</div>
                <div class="font-size-opt${selTheme==='light'?' selected':''}" data-theme="light">Claro</div>
              </div>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Color de acento</div>
              <div class="config-row-sub">Color principal de la interfaz</div>
            </div>
            <div class="config-row-right">
              <div class="accent-grid">
                ${ACCENT_COLORS.map(ac=>`<div class="accent-opt${selAccent===ac.id?' selected':''}" data-accent="${ac.id}" style="background:${ac.value}" title="${ac.label}"></div>`).join('')}
              </div>
            </div>
          </div>
          <div class="config-row config-row-stack">
            <div class="config-row-left"><div class="config-row-label">Tema avanzado</div><div class="config-row-sub">Colores propios para fondo, superficies y texto</div></div>
            <div class="config-row-right theme-custom-controls">
              <label>Fondo <input type="color" id="cfg-custom-bg" value="${customTheme.background || '#0a0a0f'}"></label>
              <label>Superficie <input type="color" id="cfg-custom-surface" value="${customTheme.surface || '#10101a'}"></label>
              <label>Texto <input type="color" id="cfg-custom-text" value="${customTheme.text || '#f0eeff'}"></label>
              <button class="btn btn-ghost btn-sm" id="btn-reset-custom-theme">Restaurar</button>
              <div class="config-row-sub" id="cfg-theme-contrast" aria-live="polite"></div>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Tamaño de fuente</div>
              <div class="config-row-sub">Afecta a toda la interfaz</div>
            </div>
            <div class="config-row-right">
              <div class="font-size-row">
                <div class="font-size-opt${selFont==='small'?' selected':''}" data-size="small" style="font-size:11px">A</div>
                <div class="font-size-opt${selFont==='medium'?' selected':''}" data-size="medium" style="font-size:13px">A</div>
                <div class="font-size-opt${selFont==='large'?' selected':''}" data-size="large" style="font-size:15px">A</div>
              </div>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Idioma</div>
              <div class="config-row-sub">Idioma de la interfaz</div>
            </div>
            <div class="config-row-right">
              <select id="cfg-lang" style="width:140px">
                <option value="es" ${(cfg.lang||'es')==='es'?'selected':''}>🇪🇸 Español</option>
                <option value="en" ${cfg.lang==='en'?'selected':''}>🇬🇧 English</option>
              </select>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Navbar inferior fija</div>
              <div class="config-row-sub">Mantiene visible la barra inferior en móvil sin botón de abrir/cerrar</div>
            </div>
            <div class="config-row-right">
              <label class="toggle-switch"><input type="checkbox" id="cfg-mobile-nav-fixed" ${cfg.mobileNavFixed?'checked':''}><span class="toggle-slider"></span></label>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left"><div class="config-row-label">Modo simplificado / littles</div><div class="config-row-sub">Menos módulos visibles, texto más grande y menos ruido visual</div></div>
            <div class="config-row-right"><label class="toggle-switch"><input type="checkbox" id="cfg-simplified-mode" ${cfg.simplifiedMode?'checked':''}><span class="toggle-slider"></span></label></div>
          </div>
        </div>
      </div>
    </div>`;
    app.querySelector('#btn-save-sysname')?.addEventListener('click',()=>{
      const name=app.querySelector('#cfg-sysname').value.trim();
      const c=loadConfig(); c.systemName=name; saveConfig(c); applyConfig(c); showToast('Nombre guardado ✓');
    });
    const updateCustomTheme = () => {
      const background = app.querySelector('#cfg-custom-bg').value;
      const surface = app.querySelector('#cfg-custom-surface').value;
      const text = app.querySelector('#cfg-custom-text').value;
      const ratio = themeHexContrast(background, text);
      const status = app.querySelector('#cfg-theme-contrast');
      status.textContent = `Contraste texto/fondo: ${ratio.toFixed(2)}:1${ratio < 4.5 ? ' · bajo para texto normal' : ' · correcto'}`;
      status.style.color = ratio < 4.5 ? 'var(--red)' : 'var(--green)';
      const c=loadConfig(); c.customTheme={background,surface,text}; saveConfig(c); applyConfig(c);
    };
    ['#cfg-custom-bg','#cfg-custom-surface','#cfg-custom-text'].forEach(sel=>app.querySelector(sel)?.addEventListener('input', updateCustomTheme));
    app.querySelector('#btn-reset-custom-theme')?.addEventListener('click',()=>{ const c=loadConfig(); delete c.customTheme; saveConfig(c); applyConfig(c); renderConfigSection('personalizacion'); showToast('Tema avanzado restaurado ✓'); });
    updateCustomTheme();
    app.querySelectorAll('[data-theme]').forEach(opt=>opt.addEventListener('click',()=>{
      app.querySelectorAll('[data-theme]').forEach(o=>o.classList.remove('selected')); opt.classList.add('selected');
      const c=loadConfig(); c.theme=opt.dataset.theme; saveConfig(c);
      applyConfig(c);
      showToast('Tema actualizado ✓');
    }));
    app.querySelectorAll('.accent-opt').forEach(opt=>opt.addEventListener('click',()=>{
      app.querySelectorAll('.accent-opt').forEach(o=>o.classList.remove('selected')); opt.classList.add('selected');
      const c=loadConfig(); c.accentColor=opt.dataset.accent; saveConfig(c);
      showReloadPrompt('Es necesario actualizar para aplicar los cambios.');
    }));
    app.querySelectorAll('.font-size-opt').forEach(opt=>opt.addEventListener('click',()=>{
      app.querySelectorAll('.font-size-opt').forEach(o=>o.classList.remove('selected')); opt.classList.add('selected');
      const c=loadConfig(); c.fontSize=opt.dataset.size; saveConfig(c);
      applyConfig(c);
      showToast('Tamaño de fuente actualizado ✓');
    }));
    app.querySelector('#cfg-lang')?.addEventListener('change',e=>{
      const lang = e.target.value;
      const c=loadConfig(); c.lang=lang; saveConfig(c);
      localStorage.setItem('atria_lang', lang);
      showToast('Cambiando idioma...');
      setTimeout(() => {
        if (lang === 'en') {
          window.location.href = '../../en/';
        } else {
          window.location.href = '../../es/';
        }
      }, 800);
    });
    app.querySelector('#cfg-mobile-nav-fixed')?.addEventListener('change',e=>{
      const c = loadConfig();
      c.mobileNavFixed = !!e.target.checked;
      saveConfig(c);
      applyConfig(c);
      showToast('Navbar inferior actualizada ✓');
    });
    app.querySelector('#cfg-simplified-mode')?.addEventListener('change', e=>{
      const c=loadConfig(); c.simplifiedMode=!!e.target.checked; saveConfig(c); applyConfig(c); showToast(c.simplifiedMode?'Modo simplificado activado ✓':'Modo simplificado desactivado ✓');
    });

  } else if (section === 'datos') {
    app.innerHTML = `
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both">
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">💾</div>
          <div><div class="config-section-title">Datos</div><div class="config-section-desc">Backup, importación y almacenamiento</div></div>
        </div>
        <div class="config-rows">
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">🔒 Seguridad avanzada</div>
              <div class="config-row-sub">PIN, copia cifrada opcional y gestión de sesión</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-go-seguridad">Abrir →</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Exportar todos los datos</div>
              <div class="config-row-sub">Descarga un archivo JSON con todo el sistema</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-export">↓ Exportar</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Exportar fronting a CSV</div>
              <div class="config-row-sub">Sesiones de fronting con duración y notas</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-csv-fronting">↓ CSV</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Exportar tracker emocional a CSV</div>
              <div class="config-row-sub">Registro de estados de ánimo por alter y fecha</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-csv-tracker">↓ CSV</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Exportar finanzas a CSV</div>
              <div class="config-row-sub">Todas las transacciones de todos los alters</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-csv-finanzas">↓ CSV</button></div>
          </div>
          <div class="config-row"><div class="config-row-left"><div class="config-row-label">Exportar finanzas JSON</div><div class="config-row-sub">Transacciones, ahorros, presupuestos, categorías y moneda</div></div><div class="config-row-right" style="gap:6px"><button class="btn btn-ghost" id="btn-json-finanzas">↓ JSON</button><label class="btn btn-ghost" style="cursor:pointer">↑ Importar<input type="file" id="btn-import-finanzas-json" accept=".json" style="display:none"></label></div></div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Exportar recordatorios a CSV</div>
              <div class="config-row-sub">Todos los recordatorios del sistema</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-csv-reminders">↓ CSV</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Exportar agenda a calendario</div>
              <div class="config-row-sub">Eventos y recordatorios en formato ICS</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-ics-agenda">ICS</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Exportar tareas a CSV</div>
              <div class="config-row-sub">Todas las tareas de todos los proyectos</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-csv-tareas">↓ CSV</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Resumen del sistema</div>
              <div class="config-row-sub">Informe interno con alters, fronting, estados, proyectos y tareas vencidas</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-resumen-txt">↓ Resumen</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Informe de bienestar</div>
              <div class="config-row-sub">Informe para profesionales: presencia, emociones, diario y crisis del período</div>
            </div>
            <div class="config-row-right" style="gap:6px">
              <button class="btn btn-ghost" id="btn-informe-terapeutico">↓ TXT</button>
              <button class="btn btn-ghost" id="btn-informe-print">🖨 PDF</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Importar backup</div>
              <div class="config-row-sub">Restaura datos desde un archivo JSON exportado de Atria</div>
            </div>
            <div class="config-row-right">
              <label class="btn btn-ghost" style="cursor:pointer">↑ Importar<input type="file" id="btn-import" accept=".json" style="display:none"></label>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Importar desde otro sistema</div>
              <div class="config-row-sub">Migra alters y fronting desde Simply Plural, PluralKit o Atria Exchange Format (AEF)</div>
            </div>
            <div class="config-row-right">
              <label class="btn btn-ghost" style="cursor:pointer;white-space:nowrap">◈ Importar<input type="file" id="btn-import-ecosystem" accept=".json" style="display:none"></label>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    app.querySelector('#btn-go-seguridad')?.addEventListener('click',()=>navigateTo('seguridad'));
    app.querySelector('#btn-export')?.addEventListener('click',()=>{
      const data={};
      for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('tid_')){ try{data[k]=JSON.parse(localStorage.getItem(k));}catch{data[k]=localStorage.getItem(k);} } }
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob); const a=document.createElement('a');
      a.href=url; a.download=`tid-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
      showToast('Backup exportado ✓');
    });
    app.querySelector('#btn-csv-fronting')?.addEventListener('click',  ()=>openCSVRangeModal('Exportar fronting',  exportFrontingCSV));
    app.querySelector('#btn-csv-tracker')?.addEventListener('click',   ()=>openCSVRangeModal('Exportar tracker',   exportTrackerCSV));
    app.querySelector('#btn-csv-finanzas')?.addEventListener('click',  ()=>openCSVRangeModal('Exportar finanzas',  exportFinanzasCSV));
    app.querySelector('#btn-json-finanzas')?.addEventListener('click', exportFinanzasJSON);
    app.querySelector('#btn-import-finanzas-json')?.addEventListener('change', e => { const file=e.target.files[0]; if(file) importFinanzasJSON(file); e.target.value=''; });
    app.querySelector('#btn-csv-reminders')?.addEventListener('click', ()=>openCSVRangeModal('Exportar recordatorios', exportRemindersCSV));
    app.querySelector('#btn-ics-agenda')?.addEventListener('click',    ()=>openCSVRangeModal('Exportar agenda', exportAgendaICS, 'Exportar ICS'));
    app.querySelector('#btn-csv-tareas')?.addEventListener('click',    ()=>openCSVRangeModal('Exportar tareas',    exportTareasCSV));
    app.querySelector('#btn-resumen-txt')?.addEventListener('click',   ()=>openCSVRangeModal('Resumen del sistema', exportResumenTXT));
    app.querySelector('#btn-informe-terapeutico')?.addEventListener('click', ()=>openCSVRangeModal('Informe de bienestar', exportInformeTerapeutico));
    app.querySelector('#btn-informe-print')?.addEventListener('click', ()=>openCSVRangeModal('Imprimir informe de bienestar', printInformeBienestar));
    app.querySelector('#btn-import-ecosystem')?.addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      if (typeof window.atriaExternalImport?.preview === 'function') {
        const reader = new FileReader();
        reader.onload = ev => { try { const parsed = atriaExternalImport.parse(JSON.parse(ev.target.result)); window.__atriaExternalImportParsed = parsed; } catch { showToast('⚠ JSON externo inválido'); } };
        reader.onloadend = () => { if (window.__atriaExternalImportParsed) { const parsed = window.__atriaExternalImportParsed; window.__atriaExternalImportParsed = null; window.atriaExternalImport.preview(parsed); } };
        reader.readAsText(file);
      }
    });
    app.querySelector('#btn-import')?.addEventListener('change',e=>{
      const file=e.target.files[0]; if(!file) return;
      const reader=new FileReader();
      reader.onload=ev=>{ try{
        const data=JSON.parse(ev.target.result); let count=0;
        Object.entries(data).forEach(([k,v])=>{ if(k.startsWith('tid_')){ const raw=JSON.stringify(v); if(!shouldSkipIncomingSyncWrite(k, raw)){ localStorage.setItem(k,raw); count++; } } });
        ALTERS=getAlters(); showToast(`${count} claves importadas ✓ — recarga para aplicar`); renderConfigSection('datos');
      }catch{ showToast('⚠ Archivo inválido'); } };
      reader.readAsText(file);
    });

  } else if (section === 'almacenamiento') {
    const STORAGE_KEYS_RENDER = typeof STORAGE_KEYS !== 'undefined' ? STORAGE_KEYS : [];
    const storageData = STORAGE_KEYS_RENDER.map(k=>{
      const raw=localStorage.getItem(k.key)||''; const bytes=new Blob([raw]).size;
      let count=0; try{const p=JSON.parse(raw);count=Array.isArray(p)?p.length:1;}catch{}
      return {...k,raw,bytes,count};
    });
    const alterKeys=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&k.startsWith('tid_')&&!STORAGE_KEYS_RENDER.find(x=>x.key===k)){
        const raw=localStorage.getItem(k)||''; const bytes=new Blob([raw]).size;
        alterKeys.push({key:k,label:k.replace('tid_','').replace(/_/g,' '),bytes,count:0,raw});
      }
    }
    const allStorage=[...storageData,...alterKeys];
    const totalB=allStorage.reduce((s,x)=>s+x.bytes,0);
    const fmtB=b=>b<1024?b+'B':b<1024*1024?(b/1024).toFixed(1)+'KB':(b/1024/1024).toFixed(2)+'MB';
    app.innerHTML=`
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both">
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">🗄</div>
          <div><div class="config-section-title">Almacenamiento local</div><div class="config-section-desc">${fmtB(totalB)} usados · ${allStorage.length} claves</div></div>
        </div>
        <div style="padding:16px 20px">
          <div class="storage-bar"><div class="storage-bar-fill" style="width:${Math.min(100,(totalB/51200)*100).toFixed(1)}%"></div></div>
          <div class="storage-items" style="margin-top:14px">
            ${allStorage.filter(x=>x.bytes>0).map(x=>`
              <div class="storage-item">
                <div><div class="storage-item-key">${x.label||x.key}</div>${x.count?`<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${x.count} elemento${x.count!==1?'s':''}</div>`:''}</div>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="storage-item-size">${fmtB(x.bytes)}</div>
                  <button class="storage-item-del btn-del-key" data-key="${x.key}" title="Eliminar esta clave">✕</button>
                </div>
              </div>`).join('')}
            ${allStorage.every(x=>x.bytes===0)?`<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);text-align:center;padding:20px">Sin datos guardados</div>`:''}
          </div>
        </div>
      </div>
    </div>`;
    app.querySelectorAll('.btn-del-key').forEach(btn=>btn.addEventListener('click',()=>{
      if(!confirm(`¿Eliminar "${btn.dataset.key}"?`)) return;
      localStorage.removeItem(btn.dataset.key); showToast('Clave eliminada'); renderConfigSection('almacenamiento');
    }));

  } else if (section === 'emociones') {
    renderConfigEmociones(app, back);

  } else if (section === 'notificaciones') {
    app.innerHTML=`<div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both"><div id="config-notif-mount"></div></div>`;
    renderNotifConfig(app.querySelector('#config-notif-mount'));

  } else if (section === 'online') {
    const online = getOnlineProfile(cfg);
    const onlineAccount = loadOnlineAccount();
    const onlineSession = loadOnlineSession();
    const onlineDevices = loadOnlineDevicesCache();
    const onlineDeviceName = onlineSession?.deviceName || online.deviceName;
    const currentDeviceId = onlineSession?.deviceId || loadConfig().onlineDeviceId || (onlineDevices.find(d => (d.platform || d.name) === onlineDeviceName)?.id || '');
    const onlineDevicesHtml = onlineDevices.length
      ? onlineDevices.map(d => {
          const id = d.id || '';
          const name = d.platform || d.name || 'Dispositivo';
          const isCurrent = id && id === currentDeviceId;
          return `<div class="online-device-row${isCurrent?' current':''}" data-device-id="${escAttr(id)}">
            <div class="online-device-main">
              <input class="online-device-inline-name" data-device-name="${escAttr(id)}" value="${escAttr(name)}" maxlength="40">
              <div class="online-device-meta">${isCurrent ? 'Este dispositivo' : 'Dispositivo vinculado'}${d.lastSeenAt ? ' · ' + new Date(d.lastSeenAt).toLocaleString('es') : ''}</div>
            </div>
            <button class="btn btn-ghost btn-sm" data-device-save="${escAttr(id)}">Guardar</button>
          </div>`;
        }).join('')
      : `<div style="font-size:12px;color:var(--text-3);padding:8px 0">Sin dispositivos cargados todavía.</div>`;
    const backupStatus = loadOnlineBackupStatus();
    const backupSummary = describeOnlineBackupStatus({ ...backupStatus, autoBackupEnabled: online.autoBackup });
    const backupToneColor = backupSummary.tone === 'error' ? '#ff8a8a' : backupSummary.tone === 'ok' ? '#5fffb0' : backupSummary.tone === 'warn' ? '#ffcf6f' : 'var(--text-3)';
    const syncStatus = online.enabled ? 'Activo automáticamente con la cuenta online' : 'Pendiente de activar';
    app.innerHTML = `
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both;display:flex;flex-direction:column;gap:16px">
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">☁</div>
          <div><div class="config-section-title">Funciones online</div><div class="config-section-desc">Amigos, chat online, presencia, sync multidispositivo y backup automático</div></div>
        </div>
        <div class="config-rows">
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Estado actual</div>
              <div class="config-row-sub">${online.enabled ? 'Funciones online activadas en este dispositivo' : 'Funciones online todavÃ­a no activadas'}</div>
            </div>
            <div class="config-row-right" style="font-family:'DM Mono',monospace;font-size:11px;color:${online.enabled?'#5fffb0':'var(--text-3)'}">${online.enabled?'ONLINE':'NO_ACTIVADO'}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Sync multidispositivo</div>
              <div class="config-row-sub">Si el online está activo, la sincronización también lo está y se realiza automáticamente.</div>
            </div>
            <div class="config-row-right" style="font-size:12px;color:var(--text-2)">${syncStatus}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">ConexiÃ³n online</div>
              <div class="config-row-sub">Atria se conecta al servicio configurado; si falta esa parte, online queda pendiente.</div>
            </div>
            <div class="config-row-right" style="font-size:11px;color:${hasOnlineBackendConfigured(cfg)?'#5fffb0':'var(--text-3)'}">${hasOnlineBackendConfigured(cfg) ? 'SERVICIO_LISTO' : 'SIN_SERVICIO'}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Servicio online preconfigurado</div>
              <div class="config-row-sub">Si esto queda vacÃ­o, la cuenta sigue siendo solo local en este dispositivo.</div>
            </div>
            <div class="config-row-right" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
              <input id="online-api-base-url" type="text" value="${escM(getOnlineApiBaseUrl(cfg) || '')}" placeholder="https://api.tu-servidor.com" style="display:none">
              <button class="btn btn-ghost btn-sm" id="btn-online-save-backend" style="display:none">Guardar</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Privacidad</div>
              <div class="config-row-sub">Los mensajes y datos privados se cifran antes de salir del dispositivo; solo se comparte lo que activas.</div>
            </div>
            <div class="config-row-right" style="font-size:12px;color:var(--text-2)">E2E prioritario</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Sesión online</div>
              <div class="config-row-sub">Cuenta y dispositivo activos para usar amigos, chat online, sync y backup.</div>
            </div>
            <div class="config-row-right" style="font-size:12px;color:var(--text-2)">${onlineSession ? 'Preparada' : 'Sin sesión'}</div>
          </div>
        </div>
      </div>

      ${online.enabled ? `
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">👤</div>
          <div><div class="config-section-title">Cuenta y dispositivo</div><div class="config-section-desc">Tu cuenta online y este dispositivo</div></div>
        </div>
        <div class="config-rows">
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Correo</div>
              <div class="config-row-sub">Solo para la cuenta e inicio de sesión</div>
            </div>
            <div class="config-row-right" style="font-size:12px;color:var(--text-1)">${escM(onlineAccount?.email || online.email || '—')}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">ID interno</div>
              <div class="config-row-sub">Nombre público del sistema para compartir</div>
            </div>
            <div class="config-row-right" style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent)">${escM(onlineAccount?.systemId || online.systemId)}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Código ATRIA</div>
              <div class="config-row-sub">Código seguro para compartir sin exponer el correo</div>
            </div>
            <div class="config-row-right" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
              <div data-online-config-friend-code style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent)">${escM(onlineAccount?.friendCode || online.friendCode || 'ATRIA-XXXX-XXXX-XXXX')}</div>
              <button class="btn btn-ghost btn-sm" id="btn-copy-online-friendcode">Copiar</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Nombre del dispositivo</div>
              <div class="config-row-sub">Nombre visible de esta sesión</div>
            </div>
            <div class="config-row-right">
              <input id="online-device-name" type="text" value="${escM(onlineDeviceName)}" maxlength="40" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <button class="btn btn-ghost btn-sm" id="btn-online-save-device">Guardar</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Dispositivos preparados</div>
              <div class="config-row-sub">Dispositivos vinculados a tu cuenta online</div>
            </div>
            <div class="config-row-right" style="min-width:min(100%,360px);display:flex;flex-direction:column;gap:8px">${onlineDevicesHtml}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Último acceso</div>
              <div class="config-row-sub">Marca local de la última autenticación</div>
            </div>
            <div class="config-row-right" style="font-size:12px;color:var(--text-2)">${onlineSession?.lastAuthAt ? new Date(onlineSession.lastAuthAt).toLocaleString('es') : '—'}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Fronting continuo</div>
              <div class="config-row-sub">Solo se compartirá si lo activas explícitamente</div>
            </div>
            <div class="config-row-right">
              <label class="toggle-switch"><input type="checkbox" id="online-fronting-enabled" ${online.fronting?'checked':''}><span class="toggle-slider"></span></label>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Backup automático</div>
              <div class="config-row-sub">Se guarda cifrado autom&aacute;ticamente para tu cuenta online</div>
            </div>
            <div class="config-row-right">
              <label class="toggle-switch"><input type="checkbox" id="online-backup-enabled" ${online.autoBackup?'checked':''}><span class="toggle-slider"></span></label>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Estado del backup online</div>
              <div class="config-row-sub">${escM(backupSummary.detail)}</div>
              ${backupSummary.meta ? `<div class="config-row-sub" style="margin-top:4px;color:var(--text-3)">${escM(backupSummary.meta)}</div>` : ''}
            </div>
            <div class="config-row-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
              <div style="font-family:'DM Mono',monospace;font-size:10px;color:${backupToneColor}">${escM(backupSummary.code)}</div>
              <button class="btn btn-ghost btn-sm" id="btn-online-run-backup">${escM(backupSummary.actionLabel)}</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Funciones online</div>
              <div class="config-row-sub">Puedes volver al modo local cuando quieras</div>
            </div>
            <div class="config-row-right">
              <button class="btn btn-danger btn-sm" id="btn-online-disable">Desactivar</button>
            </div>
          </div>
        </div>
      </div>` : `
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">🔐</div>
          <div><div class="config-section-title">Crear cuenta o iniciar sesión</div><div class="config-section-desc">Mismo espacio online en cualquier dispositivo autenticado</div></div>
        </div>
        <div class="config-rows">
          <div class="config-row" style="flex-direction:column;align-items:flex-start;gap:12px;padding:14px 16px;background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg)">
            <div class="config-row-left" style="width:100%">
              <div class="config-row-label">Activar funciones online</div>
              <div class="config-row-sub">Al activarlas, Atria asumir&aacute; sync autom&aacute;tico, chat online, amigos, presencia y backup cifrado.</div>
            </div>
            <label style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--text-1);line-height:1.5;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px 12px;width:100%;box-sizing:border-box">
              <input type="checkbox" id="online-consent" style="margin-top:2px">
              <span>Entiendo que Atria usará funciones online opcionales para conectar mis dispositivos y guardar una copia cifrada. Mis datos privados se cifran antes de salir del dispositivo y solo compartiré lo que elija.</span>
            </label>
            <div style="font-size:11px;color:var(--text-3);line-height:1.4">DespuÃ©s, elige una sola acciÃ³n: crear cuenta o iniciar sesiÃ³n.</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Crear cuenta</div>
              <div class="config-row-sub">Para activar online por primera vez</div>
            </div>
            <div class="config-row-right" style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
              <input id="online-register-email" type="email" placeholder="correo@ejemplo.com" style="width:min(100%,260px);background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <input id="online-register-password" type="password" placeholder="Contraseña (mín. 8)" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <input id="online-register-display" type="text" placeholder="Nombre de tu sistema" value="${escM(cfg.systemName || '')}" maxlength="40" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <details style="width:220px;margin-top:2px">
                <summary style="font-size:12px;color:var(--text-2);cursor:pointer">▸ Personalizar nombre del dispositivo</summary>
                <input id="online-register-device" type="text" value="${escM(getAutoDeviceName())}" maxlength="40" style="width:100%;margin-top:6px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              </details>
              <label style="display:flex;align-items:flex-start;gap:8px;width:220px;font-size:12px;color:var(--text-2)"><input id="online-remember-session" type="checkbox" checked style="margin-top:2px"><span>Mantener sesión en este navegador</span></label>
              <button class="btn btn-primary btn-sm" id="btn-online-register">Crear cuenta</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Iniciar sesión</div>
              <div class="config-row-sub">Para entrar con la misma cuenta en otro dispositivo</div>
            </div>
            <div class="config-row-right" style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
              <input id="online-login-email" type="email" placeholder="correo@ejemplo.com" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <input id="online-login-password" type="password" placeholder="Contraseña" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <details style="width:220px;margin-top:2px">
                <summary style="font-size:12px;color:var(--text-2);cursor:pointer">▸ Personalizar nombre del dispositivo</summary>
                <input id="online-login-device" type="text" value="${escM(getAutoDeviceName())}" maxlength="40" style="width:100%;margin-top:6px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              </details>
              <label style="display:flex;align-items:flex-start;gap:8px;width:220px;font-size:12px;color:var(--text-2)"><input id="online-login-remember" type="checkbox" checked style="margin-top:2px"><span>Mantener sesión en este navegador</span></label>
              <button class="btn btn-ghost btn-sm" id="btn-online-login">Iniciar sesión</button>
              <details style="width:220px;margin-top:4px">
                <summary style="font-size:12px;color:var(--text-2);cursor:pointer">Olvid&eacute; mi contrase&ntilde;a</summary>
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
                  <button class="btn btn-ghost btn-sm" id="btn-online-reset-request" type="button">Enviar correo de recuperaci&oacute;n</button>
                  <input id="online-reset-token" type="text" placeholder="C&oacute;digo de recuperaci&oacute;n" value="${escM(new URLSearchParams(location.search).get('resetToken') || '')}" autocomplete="one-time-code" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
                  <input id="online-reset-old-password" type="password" placeholder="Contrase&ntilde;a anterior (opcional)" autocomplete="current-password" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
                  <input id="online-reset-password" type="password" placeholder="Nueva contrase&ntilde;a (min. 8)" autocomplete="new-password" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
                  <div style="font-size:11px;color:var(--text-2);line-height:1.4">Si recuerdas la contrase&ntilde;a anterior, Atria puede conservar la clave del backup online antiguo. Sin ella, restaura desde un dispositivo que todav&iacute;a tenga tus datos o importa un backup manual.</div>
                  <button class="btn btn-primary btn-sm" id="btn-online-reset-confirm" type="button">Guardar nueva contrase&ntilde;a</button>
                </div>
              </details>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Añadir amistades</div>
              <div class="config-row-sub">La idea es permitir ID del sistema, código amigo o correo, sin pasos técnicos.</div>
            </div>
            <div class="config-row-right" style="font-size:12px;color:var(--text-3)">Objetivo v0.13</div>
          </div>
        </div>
      </div>`}
    </div>`;

    app.querySelector('#btn-online-register')?.addEventListener('click', async () => {
      const consent = app.querySelector('#online-consent')?.checked;
      const email = (app.querySelector('#online-register-email')?.value || '').trim().toLowerCase();
      const password = (app.querySelector('#online-register-password')?.value || '').trim();
      const displayName = (app.querySelector('#online-register-display')?.value || '').trim() || cfg.systemName || '';
      const deviceName = (app.querySelector('#online-register-device')?.value || '').trim() || getAutoDeviceName();
      const rememberSession = app.querySelector('#online-remember-session')?.checked !== false;
      if (!consent) return showToast('⚠ Debes aceptar el uso de funciones online');
      if (!isValidEmail(email)) return showToast('⚠ Escribe un correo válido');
      if (password.length < 8) return showToast('⚠ La contraseña debe tener al menos 8 caracteres');
      if (!displayName) return showToast('⚠ Escribe el nombre de tu sistema');
      const btn = app.querySelector('#btn-online-register');
      if (btn) btn.disabled = true;
      try {
        const result = await registerOnlineAccountRemote({
          email,
          password,
          deviceName,
          consentAt: new Date().toISOString(),
          displayName,
          rememberSession,
        });
        showToast(result.mode === 'remote' ? 'Cuenta online creada ✓' : 'Funciones online preparadas ✓');
        if (typeof unlockOnlineAccess === 'function') unlockOnlineAccess();
        renderConfigSection('online');
      } catch (e) {
        showToast('⚠ ' + (e?.message || 'No se pudo crear la cuenta'));
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    app.querySelector('#btn-online-login')?.addEventListener('click', async () => {
      const consent = app.querySelector('#online-consent')?.checked;
      const email = (app.querySelector('#online-login-email')?.value || '').trim().toLowerCase();
      const password = (app.querySelector('#online-login-password')?.value || '').trim();
      const deviceName = (app.querySelector('#online-login-device')?.value || '').trim() || getAutoDeviceName();
      const rememberSession = app.querySelector('#online-login-remember')?.checked !== false;
      if (!consent) return showToast('⚠ Debes aceptar el uso de funciones online');
      if (!isValidEmail(email)) return showToast('⚠ Escribe un correo válido');
      if (password.length < 8) return showToast('⚠ Escribe tu contraseña');
      const baseCfg = loadConfig();
      const btn = app.querySelector('#btn-online-login');
      if (btn) btn.disabled = true;
      try {
        const result = await loginOnlineAccountRemote({
          email,
          password,
          deviceName,
          consentAt: baseCfg.onlineConsentAt || new Date().toISOString(),
          rememberSession,
        });
        handleOnlineLoginHydrationResult(result);
        showToast(result.restoreError ? `Sesión iniciada, pero no se restauraron los perfiles: ${result.restoreError}` : (result.mode === 'remote' ? 'Sesión online iniciada ✓' : 'Sesión online preparada ✓'));
        if (typeof unlockOnlineAccess === 'function') unlockOnlineAccess();
        renderLayer0();
      } catch (e) {
        showToast('⚠ ' + (e?.message || 'No se pudo iniciar sesión'));
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    app.querySelector('#btn-online-reset-request')?.addEventListener('click', async () => {
      const email = (app.querySelector('#online-login-email')?.value || '').trim().toLowerCase();
      if (!isValidEmail(email)) return showToast('Escribe primero el correo de tu cuenta');
      const btn = app.querySelector('#btn-online-reset-request');
      if (btn) btn.disabled = true;
      try {
        await requestOnlinePasswordReset({ email });
        showToast('Si ese correo existe, Atria envi\u00f3 un c\u00f3digo de recuperaci\u00f3n');
      } catch (e) {
        showToast(e?.message || 'No se pudo enviar el correo de recuperaci\u00f3n');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    app.querySelector('#btn-online-reset-confirm')?.addEventListener('click', async () => {
      const token = (app.querySelector('#online-reset-token')?.value || '').trim();
      const password = (app.querySelector('#online-reset-password')?.value || '').trim();
      const oldPassword = (app.querySelector('#online-reset-old-password')?.value || '').trim();
      if (!token) return showToast('Escribe el c\u00f3digo de recuperaci\u00f3n');
      if (password.length < 8) return showToast('La contrase\u00f1a debe tener al menos 8 caracteres');
      const btn = app.querySelector('#btn-online-reset-confirm');
      if (btn) btn.disabled = true;
      try {
        const result = await confirmOnlinePasswordReset({ token, password, oldPassword });
        app.querySelector('#online-login-password').value = password;
        showToast(result?.preservedOldBackupKey ? 'Contrase\u00f1a actualizada. Clave del backup antiguo conservada.' : 'Contrase\u00f1a actualizada. Inicia sesi\u00f3n y restaura desde un dispositivo con datos si hace falta.');
      } catch (e) {
        showToast(e?.message || 'No se pudo actualizar la contrase\u00f1a');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    async function saveOnlineDeviceNameFromConfig(deviceId, deviceName, btn = null) {
      const nextName = String(deviceName || '').trim();
      if (!nextName) return showToast('Escribe un nombre de dispositivo');
      if (btn) btn.disabled = true;
      try {
        const session = loadOnlineSession();
        const cfgNow = loadConfig();
        const currentId = session?.deviceId || cfgNow.onlineDeviceId || '';
        const shouldUpdateCurrent = !deviceId || !currentId || deviceId === currentId;
        if (deviceId && session?.authToken && hasOnlineBackendConfigured()) {
          await renameOnlineDevice(deviceId, nextName);
        } else if (deviceId) {
          const now = new Date().toISOString();
          saveOnlineDevicesCache(loadOnlineDevicesCache().map(device => {
            if ((device.id || '') !== deviceId) return device;
            return { ...device, platform: nextName, name: nextName, lastSeenAt: now };
          }));
        }
        if (shouldUpdateCurrent) {
          saveConfig({ ...cfgNow, onlineDeviceName: nextName, onlineDeviceId: deviceId || cfgNow.onlineDeviceId || null });
          if (session) {
            saveOnlineSession({ ...session, deviceName: nextName, deviceId: deviceId || session.deviceId || cfgNow.onlineDeviceId || null });
            if (!deviceId) upsertOnlineDevice(nextName, session.email, session.systemId);
          }
        }
        showToast('Dispositivo actualizado');
        renderConfigSection('online');
      } catch (e) {
        showToast((e?.message || 'No se pudo actualizar el dispositivo'));
        if (btn) btn.disabled = false;
      }
    }
    app.querySelector('#btn-online-save-device')?.addEventListener('click', event => {
      event.stopImmediatePropagation();
      const deviceName = (app.querySelector('#online-device-name')?.value || '').trim() || cfg.systemName || 'Este dispositivo';
      saveOnlineDeviceNameFromConfig(currentDeviceId, deviceName, app.querySelector('#btn-online-save-device'));
    });
    app.querySelectorAll('[data-device-save]').forEach(btn => btn.addEventListener('click', () => {
      const row = btn.closest('.online-device-row');
      const deviceId = row?.dataset?.deviceId || btn.dataset.deviceSave || '';
      const deviceName = row?.querySelector('.online-device-inline-name')?.value || '';
      saveOnlineDeviceNameFromConfig(deviceId, deviceName, btn);
    }));
    const updateConfigFriendCode = account => {
      const freshAccount = account || loadOnlineAccount() || {};
      const freshOnline = getOnlineProfile(loadConfig());
      const code = freshAccount.friendCode || freshOnline.friendCode || '';
      const el = app.querySelector('[data-online-config-friend-code]');
      if (el) el.textContent = code || 'ATRIA-XXXX-XXXX-XXXX';
      return code;
    };
    if (online.enabled && typeof refreshOnlineAccountIdentityFromBackend === 'function') {
      refreshOnlineAccountIdentityFromBackend().then(updateConfigFriendCode).catch(() => {});
    }
    app.querySelector('#btn-copy-online-friendcode')?.addEventListener('click', async () => {
      const freshAccount = await refreshOnlineAccountIdentityFromBackend().catch(() => null);
      const code = updateConfigFriendCode(freshAccount);
      if (!code) return showToast('Aviso: Todavia no hay codigo ATRIA disponible');
      navigator.clipboard.writeText(code)
        .then(() => showToast('Codigo ATRIA copiado'))
        .catch(() => showToast('Aviso: No se pudo copiar el codigo ATRIA'));
    });
    app.querySelector('#online-api-base-url')?.addEventListener('change', e => {
      const next = { ...loadConfig(), onlineApiBaseUrl: String(e.target.value || '').trim() };
      saveConfig(next);
      if (getOnlineProfile(next).enabled && hasOnlineBackendConfigured(next)) startOnlineSyncLoop();
      else stopOnlineSyncLoop();
      showToast('Funciones online actualizadas ✓');
      renderLayer0();
    });
    app.querySelector('#btn-online-save-backend')?.addEventListener('click', () => {
      const next = { ...loadConfig(), onlineApiBaseUrl: String(app.querySelector('#online-api-base-url')?.value || '').trim() };
      saveConfig(next);
      if (getOnlineProfile(next).enabled && hasOnlineBackendConfigured(next)) startOnlineSyncLoop();
      else stopOnlineSyncLoop();
      showToast('Funciones online actualizadas ✓');
      renderLayer0();
    });
    app.querySelector('#online-fronting-enabled')?.addEventListener('change', e => {
      const enabled = !!e.target.checked;
      saveConfig({ ...loadConfig(), onlineFrontingEnabled: enabled });
      const session = loadOnlineSession();
      if (session) saveOnlineSession({ ...session, frontingEnabled: enabled });
      showToast('Preferencia de fronting guardada ✓');
    });
    app.querySelector('#online-backup-enabled')?.addEventListener('change', e => {
      const enabled = !!e.target.checked;
      saveConfig({ ...loadConfig(), onlineAutoBackup: enabled });
      const session = loadOnlineSession();
      if (session) saveOnlineSession({ ...session, autoBackup: enabled });
      saveOnlineBackupStatus({ ...(loadOnlineBackupStatus() || {}), autoBackupEnabled: enabled, lastError: null });
      showToast('Preferencia de backup guardada ✓');
      renderLayer0();
    });
    app.querySelector('#btn-online-run-backup')?.addEventListener('click', () => {
      const btn = app.querySelector('#btn-online-run-backup');
      if (btn) btn.disabled = true;
      runOnlineAutomaticBackup('manual-test')
        .then(({ mode }) => {
          showToast(mode === 'remote' ? 'Backup online subido ✓' : 'Backup online preparado en local ✓');
          renderConfigSection('online');
        })
        .catch(e => {
          showToast('⚠ ' + e.message);
          renderConfigSection('online');
        })
        .finally(() => {
          if (btn) btn.disabled = false;
        });
    });
    app.querySelector('#btn-online-disable')?.addEventListener('click', async () => {
      const session = loadOnlineSession();
      if (session?.authToken && hasOnlineBackendConfigured()) {
        await onlineFetch('/v1/auth/logout', { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
      }
      disableOnlineAccountSession();
      showToast('Funciones online desactivadas ✓');
      renderLayer0();
    });

  } else if (section === 'sync') {
    renderConfigSync(app, back);

  } else if (section === 'peligro') {
    const WIPE_ROWS = [
      {id:'cache',      label:'Limpiar caché',          sub:'Fuerza la descarga de la versión más reciente.'},
      {id:'sistema',    label:'Sistema',                 sub:'Alters, front, presets, estado del sistema, emociones.'},
      {id:'chat',       label:'Chat interno',            sub:'Mensajes, tablón, solicitudes, normas.'},
      {id:'personal',   label:'Personal',                sub:'Diario, notas, tracker, memoria.'},
      {id:'fichas',     label:'Fichas',                  sub:'Fichas de alter.'},
      {id:'biblioteca', label:'Biblioteca',              sub:'Contactos, recursos, documentos, salud.'},
      {id:'agenda',     label:'Agenda, recordatorios y rutinas',  sub:'Eventos, recordatorios y rutinas.'},
      {id:'proyectos',  label:'Proyectos y tareas',      sub:'Proyectos y tareas.'},
      {id:'finanzas',   label:'Finanzas',                sub:'Transacciones, ahorros y presupuestos.'},
      {id:'crisis',     label:'Crisis',                  sub:'Protocolos, técnicas y mensajes de calma.'},
      {id:'todo',       label:'Limpiar todo',            sub:'Elimina todos los datos de la app. Irreversible.'},
    ];
    app.innerHTML=`
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both">
      <div class="config-section" style="border-color:rgba(255,107,138,.2)">
        <div class="config-section-header" style="border-color:rgba(255,107,138,.1)">
          <div class="config-section-icon">⚠️</div>
          <div><div class="config-section-title" style="color:var(--red)">Zona de peligro</div><div class="config-section-desc">Estas acciones no se pueden deshacer</div></div>
        </div>
        <div class="config-rows">
          ${WIPE_ROWS.map(r=>`
            <div class="danger-row" ${r.id==='todo'?'style="border-top:1px solid rgba(255,80,80,.2);padding-top:12px;margin-top:4px"':''}>
              <div><div class="danger-label">${r.label}</div><div class="danger-sub">${r.sub}</div></div>
              <button class="btn ${r.id==='cache'?'btn-ghost':'btn-danger'} btn-sm btn-wipe-action" data-wipe="${r.id}">${r.id==='cache'?'Limpiar':'Borrar'}</button>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
    const WIPE_GROUPS = {
      sistema:    ['tid_alters','tid_fronting','tid_front_presets','tid_system_state','tid_moods'],
      chat:       ['tid_channels','tid_messages','tid_tablon','tid_solicitudes','tid_normas'],
      personal:   ['tid_diary','tid_notas','tid_tracker','tid_actividad','tid_timeline','tid_cambios','tid_integracion'],
      fichas:     ['tid_alter_fichas'],
      biblioteca: ['tid_contactos','tid_contactos_e','tid_recursos','tid_documentos','tid_salud_triggers','tid_alergias','tid_medicaciones'],
      agenda:     ['tid_events','tid_reminders','tid_routines','tid_routine_log'],
      proyectos:  ['tid_proyectos','tid_tareas'],
      finanzas:   [], // per-alter: populated dynamically below
      crisis:     ['tid_protocolos','tid_tecnicas','tid_calm_msg','tid_crisis_log'],
    };
    try { (JSON.parse(localStorage.getItem('tid_alters'))||[]).forEach(a => {
      WIPE_GROUPS.finanzas.push(`tid_${a.id}_transactions`, `tid_${a.id}_ahorros`, `tid_${a.id}_presupuestos`, `tid_${a.id}_categories`);
    }); } catch {}
    app.querySelectorAll('.btn-wipe-action').forEach(btn=>btn.addEventListener('click', async ()=>{
      const id = btn.dataset.wipe;
      const label = WIPE_ROWS.find(r=>r.id===id)?.label || id;
      if (id === 'cache') {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k=>caches.delete(k)));
          if (navigator.serviceWorker?.controller) navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'});
          showToast('Caché eliminada. Recargando…');
          setTimeout(()=>location.reload(true), 800);
        } catch(e) { showToast('⚠ No se pudo limpiar la caché'); }
        return;
      }
      openModal(`
        <div class="modal-title" style="color:#ff7f7f">⚠ Borrar ${label}</div>
        <div class="form-grid">
          <div style="font-size:13px;line-height:1.6;color:var(--text-1)">
            Esta acción eliminará todos los datos de <strong>${label}</strong> de forma permanente e irreversible.
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2)">
            Escribe <strong>BORRAR</strong> para confirmar:
          </div>
          <input type="text" id="wipe-peligro-confirm" placeholder="BORRAR" style="letter-spacing:.1em;font-weight:700">
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn btn-danger" data-submit>Eliminar ${label}</button>
        </div>`,
        (ov)=>{
          if (ov.querySelector('#wipe-peligro-confirm').value.trim() !== 'BORRAR')
            return showToast('⚠ Escribe BORRAR para confirmar');
          closeModal();
          if (id === 'todo') { wipeAllData(); showToast('Datos eliminados'); }
          else { WIPE_GROUPS[id].forEach(k=>localStorage.removeItem(k)); showToast(`${label} eliminado ✓`); }
          setTimeout(()=>location.reload(), 800);
        }
      );
    }));

  } else if (section === 'acerca') {
    app.innerHTML=`
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both">
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">💜</div>
          <div><div class="config-section-title">Sobre Atria</div><div class="config-section-desc">${APP_VERSION} · Privado, local-first y pensado con cuidado</div></div>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
          <div style="font-size:13px;color:var(--text-1);line-height:1.7">
            Atria es una herramienta de gestión interna para sistemas disociativos, diseñada para funcionar localmente desde el primer momento.
            Te ayuda a organizar alters, fronting, agenda, diario, notas y cuidado cotidiano desde una sola app.
            Tus datos se guardan localmente por defecto. Si activas las funciones online, puedes usar una cuenta para sincronizar dispositivos, amistades, chat y copias de seguridad cifradas de extremo a extremo.
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);display:flex;flex-direction:column;gap:4px">
            <div>Versión · ${APP_VERSION}</div>
            <div>Almacenamiento · localStorage por defecto · sync y backup online opcionales</div>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <a href="https://ko-fi.com/lyokodev" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;background:rgba(160,138,255,0.12);color:var(--accent);font-size:12px;font-family:'DM Mono',monospace;text-decoration:none;border:1px solid rgba(160,138,255,0.2)">☕ Ko-fi</a>
            <a href="https://github.com/lyoko-dev" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;background:rgba(160,138,255,0.12);color:var(--accent);font-size:12px;font-family:'DM Mono',monospace;text-decoration:none;border:1px solid rgba(160,138,255,0.2)">◬ GitHub</a>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:16px">
            <button class="btn btn-ghost btn-sm" id="btn-relaunch-tutorial" style="font-size:12px">🎓 Ver tutorial de nuevo</button>
          </div>
        </div>
      </div>
    </div>`;
    app.querySelector('#btn-relaunch-tutorial').addEventListener('click', () => {
      localStorage.removeItem('tid_tutorial_done');
      localStorage.removeItem('tid_tutorial_version');
      showTutorial();
    });
  }
}



// ═══════════════════════════════════════════════
// DIARIO
// ═══════════════════════════════════════════════
const DEFAULT_MOODS = [
  {id:'muy-bien',  emoji:'🌟', label:'Muy bien'},
  {id:'bien',      emoji:'😊', label:'Bien'},
  {id:'neutro',    emoji:'😐', label:'Neutro'},
  {id:'mal',       emoji:'😔', label:'Mal'},
  {id:'muy-mal',   emoji:'😢', label:'Muy mal'},
  {id:'ansioso',   emoji:'😰', label:'Ansioso'},
  {id:'enfadado',  emoji:'😠', label:'Enfadado'},
  {id:'confuso',   emoji:'😵', label:'Confuso'},
  {id:'disociado', emoji:'🌫️', label:'Disociado'},
  {id:'en-calma',  emoji:'🌿', label:'En calma'},
];
function loadMoods() {
  try {
    const m = JSON.parse(localStorage.getItem('tid_moods'));
    return (Array.isArray(m) && m.length) ? m : DEFAULT_MOODS;
  } catch { return DEFAULT_MOODS; }
}
function saveMoods(list) { localStorage.setItem('tid_moods', JSON.stringify(list)); }
function getMoods() { return loadMoods(); }


let diarioFilter   = { alterId: 'all', mood: null, ownedByMe: false };
let diarioMode     = 'list'; // 'list' | 'write' | 'detail'
let diarioEditing  = null;   // entry being edited
let diarioDetailId = null;
let editorTags     = [];

function loadEntries()  { try { return JSON.parse(localStorage.getItem('tid_diary'))||[]; } catch{return[];} }
function saveEntries(e) { localStorage.setItem('tid_diary', JSON.stringify(e)); }

function getVisibleEntries() {
  return loadEntries().filter(e => {
    // Private: only visible to author
    if (e.isPrivate && e.alterId !== activeAlter.id) return false;
    return true;
  });
}

// Diario ahora vive dentro del módulo Escritura (tab 'diario')
function renderDiario() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Diario'}]);
  diarioMode = 'list';
  diarioEditing = null;
  renderDiarioView();
}

function renderDiarioInContainer(container) {
  // Reutiliza el mismo HTML y lógica de renderDiarioView pero dentro de un contenedor ya montado
  if (!container) return;

  if (diarioMode === 'write') {
    renderDiarioEditor(container);
    return;
  }
  if (diarioMode === 'detail') {
    renderDiarioDetail(container);
    return;
  }

  const alters  = getAlters();
  const entries = getVisibleEntries();

  const filtered = entries.filter(e => {
    const alterOk = diarioFilter.alterId==='all' || e.alterId===diarioFilter.alterId;
    const moodOk  = !diarioFilter.mood || e.mood===diarioFilter.mood;
    return alterOk && moodOk;
  }).sort((a,b)=>b.ts-a.ts);

  const countByAlter = {};
  entries.forEach(e=>{ countByAlter[e.alterId]=(countByAlter[e.alterId]||0)+1; });

  const byMonth = {};
  filtered.forEach(e=>{
    const d = new Date(e.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if(!byMonth[key]) byMonth[key]=[];
    byMonth[key].push(e);
  });

  container.innerHTML = `
    <div class="diario-layout">
      <div class="diario-filters">
        <div>
          <div class="diario-filter-title">Alter</div>
          <div class="diario-alter-filter">
            <div class="diario-alter-opt${diarioFilter.alterId==='all'?' active':''}" data-alter="all">
              <div class="diario-alter-dot" style="background:var(--text-2)"></div>
              <div class="diario-alter-name">Todos</div>
              <div class="diario-alter-count">${entries.length}</div>
            </div>
            ${alters.map(a=>`
              <div class="diario-alter-opt${diarioFilter.alterId===a.id?' active':''}" data-alter="${a.id}">
                <div style="font-size:14px">${a.emoji}</div>
                <div class="diario-alter-name">${esc(a.name)}</div>
                <div class="diario-alter-count">${countByAlter[a.id]||0}</div>
              </div>`).join('')}
          </div>
        </div>
        <div>
          <div class="diario-filter-title">Estado emocional</div>
          <div class="diario-mood-filter">
            <div class="mood-filter-chip${!diarioFilter.mood?' active':''}" data-mood="">Todo</div>
            ${getMoods().filter(m=>entries.some(e=>e.mood===m.id)).map(m=>`
              <div class="mood-filter-chip${diarioFilter.mood===m.id?' active':''}" data-mood="${m.id}" title="${m.label}">
                ${m.emoji}
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="diario-timeline">
        ${Object.keys(byMonth).length===0 ? `
          <div class="empty-state" style="padding:40px 20px">
            <div class="empty-icon">◫</div>
            <div>${filtered.length===0&&entries.length>0?'Sin entradas con estos filtros':'El diario está vacío'}</div>
          </div>` :
          Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([key, monthEntries])=>{
            const [y,m] = key.split('-');
            const label = new Date(+y,+m-1,1).toLocaleString('es-ES',{month:'long',year:'numeric'});
            return `<div class="diario-month-group">
              <div class="diario-month-label">
                <span style="text-transform:capitalize">${label}</span>
                <span>${monthEntries.length} entrada${monthEntries.length!==1?'s':''}</span>
              </div>
              ${monthEntries.map(e => renderEntryCard(e, alters)).join('')}
            </div>`;
          }).join('')
        }
      </div>
    </div>`;

  container.querySelectorAll('[data-alter]').forEach(el=>el.addEventListener('click',()=>{
    diarioFilter.alterId=el.dataset.alter; renderNotasSolicView();
  }));
  container.querySelectorAll('[data-mood]').forEach(el=>el.addEventListener('click',()=>{
    diarioFilter.mood=el.dataset.mood||null; renderNotasSolicView();
  }));
  container.querySelectorAll('.entry-card[data-eid]').forEach(card=>
    card.addEventListener('click', e=>{
      if(e.target.closest('.entry-actions')) return;
      diarioDetailId=card.dataset.eid; diarioMode='detail'; renderNotasSolicView();
    })
  );
  container.querySelectorAll('.btn-edit-entry').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const entry=loadEntries().find(x=>x.id===b.dataset.eid);
    if(entry){ diarioEditing=entry; editorTags=[...(entry.tags||[])]; diarioMode='write'; renderNotasSolicView(); }
  }));
  container.querySelectorAll('.btn-del-entry').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const eid = b.dataset.eid;
    const all = loadEntries(); const entry = all.find(x=>x.id===eid);
    if(!entry) return;
    saveEntries(all.filter(x=>x.id!==eid)); renderNotasSolicView();
    softDelete('Entrada eliminada', ()=>{}, ()=>{ const cur=loadEntries(); cur.push(entry); saveEntries(cur); renderNotasSolicView(); });
  }));
}

// INNER-CHAT
// ═══════════════════════════════════════════════
const REACTION_EMOJIS = ['❤️','😊','😢','😂','🔥','👍','💜','🌸','✨','🐺'];
const CHAN_COLORS = ['#8affe0','#a08aff','#ff8ae2','#ffb450','#8ab4ff','#ff6b8a','#5fffb0','#ffd580'];
const DEFAULT_CHANNELS = [
  {id:'general', name:'general',     icon:'#', desc:'Canal general del sistema', color:'#8affe0', type:'channel'},
  {id:'sistema', name:'sistema',     icon:'⚙', desc:'Avisos y cambios del sistema', color:'#8ab4ff', type:'channel'},
  {id:'apoyo',   name:'apoyo',       icon:'💜', desc:'Espacio de apoyo mutuo',       color:'#ff8ae2', type:'channel'},
];

let chatActiveChannel = null; // {id, type:'channel'|'dm'|'tablon', ...}
let chatSenderId = null;     // alter currently "typing" — null = activeAlter
let comTab = 'chat'; // 'chat' | 'tablon' | 'solicitudes' | 'deseos'
let onlineChatActiveFriendId = null;

function getChatSenderAlter() {
  const frontId = typeof getFrontingActual === 'function' ? getFrontingActual()?.alterId : null;
  const senderId = chatSenderId || frontId || activeAlter?.id;
  return getAlters(true).find(a => a.id === senderId) || activeAlter || null;
}

// Online chat/composer lives in online-chat.js after R6.

function renderChatSidebarActive() {
  document.querySelectorAll('.chat-channel-item,.chat-dm-alter').forEach(el=>el.classList.remove('active'));
  if (chatActiveChannel?.type==='tablon') {
    document.querySelector('#chat-tablon-item')?.classList.add('active');
  } else if (chatActiveChannel?.type==='channel') {
    document.querySelector(`[data-ch="${chatActiveChannel.id}"]`)?.classList.add('active');
  } else if (chatActiveChannel?.type==='dm') {
    document.querySelector(`[data-alter="${chatActiveChannel.alterId}"]`)?.classList.add('active');
  }
}

function renderTablonInChatPanel(panel) {
  const alters = getAlters();
  const msgs = loadTablon().sort((a,b)=>{
    if(a.pinned && !b.pinned) return -1;
    if(!a.pinned && b.pinned) return 1;
    return b.ts - a.ts;
  });
  const pinned = msgs.find(m=>m.pinned);
  const fmtTs = ts => {
    const d = new Date(ts); const now = new Date(); const diff = now-d;
    if(diff<60000) return 'Ahora';
    if(diff<3600000) return Math.floor(diff/60000)+'m';
    if(d.toDateString()===now.toDateString()) return d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
    return d.toLocaleDateString('es-ES',{day:'numeric',month:'short'});
  };

  panel.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-icon" style="color:#a08aff">◈</div>
      <div class="chat-header-info">
        <div class="chat-header-name">Tablón del sistema</div>
        <div class="chat-header-desc">Mensajes visibles para todos los alters</div>
      </div>
    </div>
    <div class="chat-messages" id="tablon-panel-list" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px">
      ${msgs.length===0?`<div class="chat-empty"><div class="chat-empty-icon">◈</div><div>Sin mensajes todavía</div><div style="font-size:11px;color:var(--text-3)">Sé el primero en escribir</div></div>`:''}
      ${pinned?`<div class="tablon-pin" style="border:1px solid rgba(160,138,255,.3);background:rgba(160,138,255,.06);border-radius:10px;padding:12px 14px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--accent);margin-bottom:6px">◈ mensaje fijado</div>
        ${(()=>{const a=alters.find(x=>x.id===pinned.alterId)||{emoji:'◎',bg:'var(--bg-2)',color:'var(--border)',name:'Sistema'};
          return `<div style="display:flex;gap:10px;align-items:flex-start">
            <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:1.5px solid;background:${a.bg};border-color:${a.color};flex-shrink:0">${a.emoji}</div>
            <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:${a.color}">${esc(a.name)}</div>
            <div style="font-size:13px;color:var(--text-1);margin-top:3px;line-height:1.5">${escM(pinned.text)}</div></div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="icon-btn tablon-unpin" data-id="${pinned.id}" title="Desfijar" style="font-size:10px;opacity:.6">◈</button>
              ${pinned.alterId===activeAlter.id?`<button class="icon-btn tablon-del" data-id="${pinned.id}" title="Eliminar" style="font-size:11px;opacity:.5">✕</button>`:''}
            </div></div>`;
        })()}
      </div>`:''}
      ${msgs.filter(m=>!m.pinned).map(m=>{
        const a=alters.find(x=>x.id===m.alterId)||{emoji:'◎',bg:'var(--bg-2)',color:'var(--border)',name:'Sistema'};
        return `<div class="tablon-msg-item" style="display:flex;gap:10px;align-items:flex-start">
          <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:1.5px solid;background:${a.bg};border-color:${a.color};flex-shrink:0">${a.emoji}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:12px;font-weight:700;color:${a.color}">${esc(a.name)}</span><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${fmtTs(m.ts)}</span></div>
            <div style="font-size:13px;color:var(--text-1);margin-top:2px;line-height:1.5">${escM(m.text)}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;opacity:0;transition:opacity .15s" class="tablon-item-actions">
            <button class="icon-btn tablon-pin" data-id="${m.id}" title="Fijar" style="font-size:10px">◈</button>
            ${m.alterId===activeAlter.id?`<button class="icon-btn tablon-del" data-id="${m.id}" title="Eliminar" style="font-size:11px">✕</button>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="chat-input-bar">
      <textarea class="chat-input" id="tablon-input" placeholder="Escribir en el tablón..." rows="1"></textarea>
      <button class="chat-send-btn" id="tablon-send">↑</button>
    </div>`;

  // Hover actions
  panel.querySelectorAll('.tablon-msg-item').forEach(el=>{
    el.addEventListener('mouseenter',()=>el.querySelector('.tablon-item-actions')?.style.setProperty('opacity','1'));
    el.addEventListener('mouseleave',()=>el.querySelector('.tablon-item-actions')?.style.setProperty('opacity','0'));
  });
  // Pin
  panel.querySelectorAll('.tablon-pin,.tablon-unpin').forEach(btn=>btn.addEventListener('click',()=>{
    const t=loadTablon(); t.forEach(m=>m.pinned=false);
    const msg=t.find(m=>m.id===btn.dataset.id);
    if(msg && btn.classList.contains('tablon-pin')) msg.pinned=true;
    saveTablon(t); renderTablonInChatPanel(panel);
  }));
  // Delete
  panel.querySelectorAll('.tablon-del').forEach(btn=>btn.addEventListener('click',()=>{
    if(!confirm('¿Eliminar este mensaje?')) return;
    saveTablon(loadTablon().filter(m=>m.id!==btn.dataset.id));
    renderTablonInChatPanel(panel);
  }));
  // Send
  const sendTablon = () => {
    const val = panel.querySelector('#tablon-input')?.value.trim();
    if(!val) return;
    const t = loadTablon();
    t.push({id:uid(),alterId:activeAlter.id,text:val,pinned:false,ts:Date.now()});
    saveTablon(t);
    panel.querySelector('#tablon-input').value='';
    renderTablonInChatPanel(panel);
  };
  panel.querySelector('#tablon-send')?.addEventListener('click', sendTablon);
  panel.querySelector('#tablon-input')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendTablon();}
  });
  // Auto scroll
  const list = panel.querySelector('#tablon-panel-list');
  if(list) list.scrollTop = list.scrollHeight;
}

function renderChatMessages() {
  const panel = document.getElementById('chat-messages-panel');
  if (!panel || !chatActiveChannel) return;
  const ch = chatActiveChannel;

  // ── TABLÓN ──
  if (ch.type === 'tablon') {
    renderTablonInChatPanel(panel);
    return;
  }

  const key = chatChannelKey(ch);
  const msgs = loadMessages().filter(m=>m.channelKey===key).sort((a,b)=>a.ts-b.ts);


  const isDM = ch.type==='dm';
  const otherAlter = isDM ? getAlters().find(a=>a.id===ch.alterId) : null;
  const headerName = isDM ? (otherAlter?.emoji+' '+otherAlter?.name) : '# '+ch.name;
  const headerDesc = isDM
    ? `DM con ${otherAlter?.name} · ${otherAlter?.role||''}`
    : ch.desc||'';

  panel.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-icon" style="color:${ch.color||'var(--accent-3)'}">
        ${isDM ? (otherAlter?.emoji||'◎') : (ch.icon||'#')}
      </div>
      <div class="chat-header-info">
        <div class="chat-header-name">${isDM?(otherAlter?.name||'DM'):'# '+ch.name}</div>
        <div class="chat-header-desc">${headerDesc}</div>
      </div>
    </div>
    <div class="chat-messages" id="chat-msg-list">
      ${msgs.length===0?`
        <div class="chat-empty">
          <div class="chat-empty-icon">${isDM?'💬':'◭'}</div>
          <div>${isDM?'Inicio de tu conversación con '+otherAlter?.name:'Inicio del canal # '+ch.name}</div>
          <div style="font-size:11px;color:var(--text-3)">Sé el primero en escribir</div>
        </div>`:
        renderMessageList(msgs)
      }
    </div>
    <div class="chat-input-area">
      <div class="chat-input-wrap" style="display:flex;align-items:flex-end;gap:6px">
        ${(()=>{const s=getAlters().find(a=>a.id===(chatSenderId||activeAlter.id))||activeAlter;return `<button id="chat-sender-btn" title="Cambiar alter que escribe" style="flex-shrink:0;width:32px;height:32px;border-radius:50%;border:2px solid ${s.color};background:${s.bg};font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">${s.emoji||'◎'}</button>`;})()}
        <textarea class="chat-input" id="chat-input" placeholder="Escribe un mensaje..." rows="1" style="flex:1"></textarea>
        <button class="chat-send-btn" id="chat-send">↑</button>
      </div>
    </div>`;

  // Auto-scroll
  const list = panel.querySelector('#chat-msg-list');
  if (list) list.scrollTop = list.scrollHeight;

  // Send
  const input = panel.querySelector('#chat-input');
  const sendBtn = panel.querySelector('#chat-send');
  input?.addEventListener('input', () => {
    input.style.height='auto';
    input.style.height=Math.min(input.scrollHeight,120)+'px';
  });
  input?.addEventListener('keydown', e => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  sendBtn?.addEventListener('click', sendMessage);

  // Alter-sender picker
  const senderBtn = panel.querySelector('#chat-sender-btn');
  senderBtn?.addEventListener('click', () => {
    document.getElementById('chat-sender-popover')?.remove();
    const allAlters = getAlters();
    const pop = document.createElement('div');
    pop.id = 'chat-sender-popover';
    pop.style.cssText = 'position:absolute;bottom:60px;left:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:8px;display:flex;flex-wrap:wrap;gap:6px;z-index:50;box-shadow:0 4px 16px rgba(0,0,0,.3)';
    allAlters.forEach(a => {
      const btn = document.createElement('button');
      const isCur = a.id === (chatSenderId || activeAlter.id);
      btn.style.cssText = `display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;border:2px solid ${a.color};background:${isCur?a.bg:'transparent'};cursor:pointer;font-size:13px;color:var(--text)`;
      btn.innerHTML = `${a.emoji||'◎'} ${esc(a.name)}`;
      btn.addEventListener('click', () => {
        chatSenderId = a.id;
        pop.remove();
        renderChatMessages();
      });
      pop.appendChild(btn);
    });
    const area = panel.querySelector('.chat-input-area');
    area.style.position = 'relative';
    area.appendChild(pop);
    const closePop = e => { if (!pop.contains(e.target) && e.target !== senderBtn) { pop.remove(); document.removeEventListener('click', closePop, true); } };
    setTimeout(() => document.addEventListener('click', closePop, true), 10);
  });

  wireMessageEvents(panel);
}

function renderMessageList(msgs) {
  const alters = getAlters();
  let lastDate = null;
  let html = '';
  msgs.forEach(msg => {
    const sender = alters.find(a=>a.id===msg.senderId);
    const isSelf = msg.senderId === activeAlter.id;
    const d = new Date(msg.ts);
    const dateStr = d.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
    if (dateStr !== lastDate) {
      html += `<div class="chat-date-divider">${dateStr}</div>`;
      lastDate = dateStr;
    }
    const timeStr = d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
    const avatarMarkup = sender?.avatarImg
      ? `<img src="${sender.avatarImg}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : esc(sender?.emoji||'◎');

    // Group reactions
    const reactionMap = {};
    (msg.reactions||[]).forEach(r=>{
      if(!reactionMap[r.emoji]) reactionMap[r.emoji]={count:0,mine:false};
      reactionMap[r.emoji].count++;
      if(r.alterId===activeAlter.id) reactionMap[r.emoji].mine=true;
    });

    html += `<div class="chat-msg${isSelf?' is-self':''}" data-mid="${msg.id}">
      <div class="chat-msg-avatar" style="background:${sender?.bg||'var(--bg-2)'};border-color:${sender?.color||'transparent'};overflow:hidden">${avatarMarkup}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-meta">
          <span class="chat-msg-sender" style="color:${sender?.color||'var(--accent)'}">${sender?.name||'?'}</span>
          <span class="chat-msg-time">${timeStr}</span>
        </div>
        <div class="chat-msg-bubble">${escC(msg.text)}</div>
        ${Object.keys(reactionMap).length>0?`
          <div class="chat-msg-reactions">
            ${Object.entries(reactionMap).map(([emoji,data])=>`
              <div class="reaction-chip${data.mine?' mine':''}" data-mid="${msg.id}" data-emoji="${emoji}">
                <span>${emoji}</span><span class="reaction-count">${data.count}</span>
              </div>`).join('')}
          </div>`:''}
      </div>
      <div class="chat-msg-actions">
        <button class="chat-action-btn btn-react" data-mid="${msg.id}" title="Reaccionar">☺</button>
        ${isSelf?`<button class="chat-action-btn btn-del-msg" data-mid="${msg.id}" title="Eliminar">✕</button>`:''}
      </div>
    </div>`;
  });
  return html;
}


function wireMessageEvents(panel) {
  // React buttons
  panel.querySelectorAll('.btn-react').forEach(btn=>btn.addEventListener('click',e=>{
    e.stopPropagation();
    showEmojiPicker(btn, btn.dataset.mid);
  }));
  // Reaction chips (toggle)
  panel.querySelectorAll('.reaction-chip').forEach(chip=>chip.addEventListener('click',()=>{
    toggleReaction(chip.dataset.mid, chip.dataset.emoji);
  }));
  // Delete
  panel.querySelectorAll('.btn-del-msg').forEach(btn=>btn.addEventListener('click',()=>{
    const msgs = loadMessages().filter(m=>m.id!==btn.dataset.mid);
    saveMessages(msgs);
    renderChatMessages();
    showToast('Mensaje eliminado');
  }));
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text || !chatActiveChannel) return;
  const msg = {
    id: uid(),
    channelKey: chatChannelKey(chatActiveChannel),
    senderId: chatSenderId || activeAlter.id,
    text,
    ts: Date.now(),
    reactions: [],
  };
  const msgs = loadMessages();
  msgs.push(msg);
  saveMessages(msgs);
  input.value = '';
  input.style.height = 'auto';
  renderChatMessages();
}

function toggleReaction(msgId, emoji) {
  const msgs = loadMessages();
  const msg = msgs.find(m=>m.id===msgId);
  if (!msg) return;
  if (!msg.reactions) msg.reactions=[];
  const idx = msg.reactions.findIndex(r=>r.emoji===emoji&&r.alterId===activeAlter.id);
  if (idx>=0) msg.reactions.splice(idx,1);
  else msg.reactions.push({emoji,alterId:activeAlter.id});
  saveMessages(msgs);
  renderChatMessages();
}

function showEmojiPicker(anchor, msgId) {
  document.querySelectorAll('.emoji-popover').forEach(p=>p.remove());
  const pop = document.createElement('div');
  pop.className='emoji-popover';
  pop.innerHTML = REACTION_EMOJIS.map(e=>`<span data-e="${e}">${e}</span>`).join('');
  document.body.appendChild(pop);
  const rect = anchor.getBoundingClientRect();
  pop.style.top  = (rect.top - pop.offsetHeight - 8 + window.scrollY)+'px';
  pop.style.left = Math.max(8, rect.left - 80)+'px';
  pop.querySelectorAll('span').forEach(s=>s.addEventListener('click',()=>{
    toggleReaction(msgId, s.dataset.e);
    pop.remove();
  }));
  setTimeout(()=>document.addEventListener('click',()=>pop.remove(),{once:true}),0);
}

function openNewChannelModal() {
  let selColor = '#8affe0';
  openModal(`
    <div class="modal-title">Nuevo canal</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Nombre del canal</div>
        <input type="text" id="nc-name" placeholder="ej: desahogo, tareas, recuerdos...">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción (opcional)</div>
        <input type="text" id="nc-desc" placeholder="Para qué sirve este canal">
      </div>
      <div class="form-row">
        <div class="form-label">Icono</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${['#','💬','📌','🎭','🌊','🌿','⭐','🔥','🎵','📖'].map(i=>`<div class="recur-opt" data-icon="${i}" style="font-size:16px;min-width:36px;text-align:center">${i}</div>`).join('')}
        </div>
        <input type="hidden" id="nc-icon" value="#">
      </div>
      <div class="form-row">
        <div class="form-label">Color</div>
        <div class="chan-color-opts">
          ${CHAN_COLORS.map((c,i)=>`<div class="chan-color-opt${i===0?' selected':''}" data-color="${c}" style="background:${c}"></div>`).join('')}
        </div>
        <input type="hidden" id="nc-color" value="${selColor}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>Crear canal</button>
    </div>`,
    (ov) => {
      const name = ov.querySelector('#nc-name').value.trim().toLowerCase().replace(/\s+/g,'-');
      const desc = ov.querySelector('#nc-desc').value.trim();
      const icon = ov.querySelector('#nc-icon').value;
      const color= ov.querySelector('#nc-color').value;
      if (!name) return showToast('⚠ El nombre es obligatorio');
      const channels = loadChannels();
      if (channels.find(c=>c.id===name)) return showToast('⚠ Ya existe un canal con ese nombre');
      channels.push({id:name,name,icon,desc,color,type:'channel'});
      saveChannels(channels);
      chatActiveChannel={id:name,name,icon,desc,color,type:'channel'};
      closeModal();
      showToast('# '+name+' creado ✓');
      renderChatLayout();
      renderChatMessages();
    }
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelectorAll('[data-icon]').forEach(el=>el.addEventListener('click',()=>{
    ov.querySelectorAll('[data-icon]').forEach(o=>o.classList.remove('selected'));
    el.classList.add('selected');
    ov.querySelector('#nc-icon').value=el.dataset.icon;
  }));
  ov.querySelectorAll('.chan-color-opt').forEach(sw=>sw.addEventListener('click',()=>{
    ov.querySelectorAll('.chan-color-opt').forEach(s=>s.classList.remove('selected'));
    sw.classList.add('selected');
    ov.querySelector('#nc-color').value=sw.dataset.color;
  }));
}

// ═══════════════════════════════════════════════

// ════════════════════════════════════════════════
// SALUD
// ════════════════════════════════════════════════

function renderSaludTab(cont, alters) {
  const triggers    = loadSaludTriggers();
  const alergias    = loadAlergias();
  const medicaciones= loadMedicaciones();
  const citasMedicas= loadEvents().filter(e => e.type === 'cita_medica').sort((a,b)=>a.date>b.date?1:-1);
  const today       = new Date().toISOString().slice(0,10);

  cont.innerHTML = `
    <div class="salud-grid">

      <!-- TRIGGERS -->
      <div class="salud-card">
        <div class="salud-card-header">
          <div class="salud-card-title">⚡ Triggers</div>
          <button class="btn btn-sm btn-primary" id="btn-new-trigger">+ Añadir</button>
        </div>
        <div class="salud-card-body" id="salud-triggers-list">
          ${triggers.length === 0
            ? '<div class="salud-empty">Sin triggers registrados</div>'
            : (() => {
                const crisisLog = loadCrisisLog();
                return triggers.map(t => {
                  const alt = t.alterId ? alters.find(a=>a.id===t.alterId) : null;
                  const episodios = crisisLog.filter(e => e.triggerId === t.id).length;
                  const lastEp = crisisLog.filter(e => e.triggerId === t.id).sort((a,b)=>b.startedAt-a.startedAt)[0];
                  return `<div class="salud-item" data-id="${t.id}">
                  <div class="salud-item-main">
                    <div class="salud-item-title">${esc(t.titulo)}</div>
                    ${t.descripcion ? `<div class="salud-item-desc">${esc(t.descripcion)}</div>` : ''}
                    <div class="salud-item-tags">
                      ${alt ? `<span class="salud-tag" style="background:${alt.color||'var(--accent)'}22;color:${alt.color||'var(--accent)'}">⬡ ${esc(alt.name)}</span>` : ''}
                      ${t.provocaSwitcheo ? '<span class="salud-tag salud-tag-warn">⇄ Provoca switcheo</span>' : ''}
                      ${t.intensidad ? `<span class="salud-tag">Intensidad ${t.intensidad}/5</span>` : ''}
                      ${episodios > 0 ? `<span class="salud-tag salud-tag-warn" title="${lastEp ? 'Último: '+new Date(lastEp.startedAt).toLocaleDateString('es') : ''}">⚡ ${episodios} episodio${episodios>1?'s':''}</span>` : ''}
                    </div>
                  </div>
                  <div class="salud-item-actions">
                    <button class="btn btn-xs btn-ghost" data-edit-trigger="${t.id}">✎</button>
                    <button class="btn btn-xs btn-ghost btn-danger" data-del-trigger="${t.id}">✕</button>
                  </div>
                </div>`;
                }).join('');
              })()
          }
        </div>
      </div>

      <!-- ALERGIAS -->
      <div class="salud-card">
        <div class="salud-card-header">
          <div class="salud-card-title">⚠ Alergias</div>
          <button class="btn btn-sm btn-primary" id="btn-new-alergia">+ Añadir</button>
        </div>
        <div class="salud-card-body" id="salud-alergias-list">
          ${alergias.length === 0
            ? '<div class="salud-empty">Sin alergias registradas</div>'
            : alergias.map(a => `<div class="salud-item" data-id="${a.id}">
                <div class="salud-item-main">
                  <div class="salud-item-title">${esc(a.nombre)}</div>
                  ${a.reaccion ? `<div class="salud-item-desc">Reacción: ${esc(a.reaccion)}</div>` : ''}
                  <div class="salud-item-tags">
                    <span class="salud-tag salud-tag-${a.gravedad||'media'}">${{leve:'● Leve',media:'●● Media',grave:'●●● Grave'}[a.gravedad]||'Media'}</span>
                  </div>
                </div>
                <div class="salud-item-actions">
                  <button class="btn btn-xs btn-ghost" data-edit-alergia="${a.id}">✎</button>
                  <button class="btn btn-xs btn-ghost btn-danger" data-del-alergia="${a.id}">✕</button>
                </div>
              </div>`).join('')
          }
        </div>
      </div>

      <!-- MEDICACIONES -->
      <div class="salud-card">
        <div class="salud-card-header">
          <div class="salud-card-title">💊 Medicaciones</div>
          <button class="btn btn-sm btn-primary" id="btn-new-medicacion">+ Añadir</button>
        </div>
        <div class="salud-card-body" id="salud-medicaciones-list">
          ${medicaciones.length === 0
            ? '<div class="salud-empty">Sin medicaciones registradas</div>'
            : medicaciones.map(m => {
                const reminders = loadReminders().filter(r => r.medicacionId === m.id);
                const taken = m.activa !== false && isMedTakenToday(m.id);
                return `<div class="salud-item${taken ? ' med-taken' : ''}" data-id="${m.id}">
                  <div class="salud-item-main">
                    <div class="salud-item-title">${esc(m.nombre)}</div>
                    ${m.dosis ? `<div class="salud-item-desc">${esc(m.dosis)}</div>` : ''}
                    <div class="salud-item-tags">
                      ${m.activa !== false ? '<span class="salud-tag salud-tag-ok">◎ Activa</span>' : '<span class="salud-tag">◌ Inactiva</span>'}
                      ${reminders.length > 0 ? `<span class="salud-tag" style="cursor:pointer" data-go-reminders>🔔 ${reminders.length} recordatorio${reminders.length>1?'s':''}</span>` : ''}
                      ${taken ? '<span class="salud-tag salud-tag-ok">✓ Tomada hoy</span>' : ''}
                    </div>
                  </div>
                  <div class="salud-item-actions">
                    ${m.activa !== false ? `<button class="btn btn-xs ${taken ? 'btn-primary' : 'btn-ghost'}" data-toggle-med="${m.id}" title="${taken ? 'Marcar como no tomada' : 'Marcar como tomada hoy'}">${taken ? '✓' : '○'}</button>` : ''}
                    <button class="btn btn-xs btn-ghost" data-add-reminder-med="${m.id}" title="Añadir recordatorio">🔔</button>
                    <button class="btn btn-xs btn-ghost" data-edit-medicacion="${m.id}">✎</button>
                    <button class="btn btn-xs btn-ghost btn-danger" data-del-medicacion="${m.id}">✕</button>
                  </div>
                </div>`;
              }).join('')
          }
        </div>
      </div>

      <!-- CITAS MÉDICAS -->
      <div class="salud-card">
        <div class="salud-card-header">
          <div class="salud-card-title">🏥 Citas médicas</div>
          <button class="btn btn-sm btn-ghost" id="btn-ir-agenda">Ver agenda →</button>
        </div>
        <div class="salud-card-body" id="salud-citas-list">
          ${citasMedicas.length === 0
            ? '<div class="salud-empty">Sin citas médicas · Añade eventos de tipo "Cita médica" en la agenda</div>'
            : citasMedicas.map(ev => {
                const isPast = ev.date < today;
                return `<div class="salud-item ${isPast ? 'salud-item-past' : ''}">
                  <div class="salud-item-main">
                    <div class="salud-item-title">🏥 ${esc(ev.title)}</div>
                    <div class="salud-item-desc">${ev.date}${ev.time?' · '+ev.time:''}${ev.note?' · '+esc(ev.note):''}</div>
                    ${isPast ? '<div class="salud-item-tags"><span class="salud-tag">◌ Pasada</span></div>' : ''}
                  </div>
                  <button class="btn btn-xs btn-ghost" data-edit-event="${ev.id}">✎</button>
                </div>`;
              }).join('')
          }
        </div>
      </div>

    </div>`;

  // Eventos
  cont.querySelector('#btn-new-trigger')?.addEventListener('click', () => openTriggerModal(null, ()=>{ _refreshSalud(); }));
  cont.querySelector('#btn-new-alergia')?.addEventListener('click', () => openAlergiaModal(null, ()=>{ _refreshSalud(); }));
  cont.querySelector('#btn-new-medicacion')?.addEventListener('click', () => openMedicacionModal(null, ()=>{ _refreshSalud(); }));
  cont.querySelector('#btn-ir-agenda')?.addEventListener('click', () => navigateTo('agenda'));

  cont.querySelectorAll('[data-edit-trigger]').forEach(b => {
    const t = triggers.find(x=>x.id===b.dataset.editTrigger);
    if(t) b.addEventListener('click', () => openTriggerModal(t, ()=>{ _refreshSalud(); }));
  });
  cont.querySelectorAll('[data-del-trigger]').forEach(b => {
    b.addEventListener('click', () => {
      if(!confirm('¿Eliminar trigger?')) return;
      saveSaludTriggers(loadSaludTriggers().filter(x=>x.id!==b.dataset.delTrigger));
      showToast('Trigger eliminado'); _refreshSalud();
    });
  });
  cont.querySelectorAll('[data-edit-alergia]').forEach(b => {
    const a = alergias.find(x=>x.id===b.dataset.editAlergia);
    if(a) b.addEventListener('click', () => openAlergiaModal(a, ()=>{ _refreshSalud(); }));
  });
  cont.querySelectorAll('[data-del-alergia]').forEach(b => {
    b.addEventListener('click', () => {
      if(!confirm('¿Eliminar alergia?')) return;
      saveAlergias(loadAlergias().filter(x=>x.id!==b.dataset.delAlergia));
      showToast('Alergia eliminada'); _refreshSalud();
    });
  });
  cont.querySelectorAll('[data-edit-medicacion]').forEach(b => {
    const m = medicaciones.find(x=>x.id===b.dataset.editMedicacion);
    if(m) b.addEventListener('click', () => openMedicacionModal(m, ()=>{ _refreshSalud(); }));
  });
  cont.querySelectorAll('[data-del-medicacion]').forEach(b => {
    b.addEventListener('click', () => {
      if(!confirm('¿Eliminar medicación?')) return;
      saveMedicaciones(loadMedicaciones().filter(x=>x.id!==b.dataset.delMedicacion));
      showToast('Medicación eliminada'); _refreshSalud();
    });
  });
  cont.querySelectorAll('[data-toggle-med]').forEach(b => {
    b.addEventListener('click', () => {
      toggleMedToday(b.dataset.toggleMed);
      _refreshSalud();
    });
  });
  cont.querySelectorAll('[data-add-reminder-med]').forEach(b => {
    const medId = b.dataset.addReminderMed;
    const med   = medicaciones.find(x=>x.id===medId);
    b.addEventListener('click', () => openMedicacionReminderModal(med, ()=>{ _refreshSalud(); }));
  });
  cont.querySelectorAll('[data-go-reminders]').forEach(b => {
    b.addEventListener('click', () => navigateTo('recordatorios'));
  });
  cont.querySelectorAll('[data-edit-event]').forEach(b => {
    const ev = loadEvents().find(x=>x.id===b.dataset.editEvent);
    if(ev) b.addEventListener('click', () => { openEventModal(ev); });
  });
}

function _refreshBib(tab){
  bibTab = tab || bibTab;
  if(currentView==='biblioteca') renderBibliotecaView();
  else { memoriaTab = tab || memoriaTab; renderMemoriaView(); }
}

function _refreshSalud(){
  if(currentView==='biblioteca'){ bibTab='salud'; renderBibliotecaView(); }
  else { _refreshSalud(); }
}

function esc(str) {
  if(!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── MODALES SALUD ──

function openTriggerModal(item, onDone) {
  const isEdit = !!item;
  const alters = getAlters();
  const t = item || { titulo:'', descripcion:'', alterId:null, provocaSwitcheo:false, intensidad:3 };

  openModal(`
    <div class="modal-title">${isEdit ? 'Editar trigger' : 'Nuevo trigger'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="tr-titulo" placeholder="Describe el trigger..." value="${esc(t.titulo)}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción (opcional)</div>
        <textarea id="tr-desc" rows="3" placeholder="Contexto, situaciones, detalles...">${esc(t.descripcion)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Alter que lo provoca (opcional)</div>
        <select id="tr-alter">
          <option value="">Ninguno / general</option>
          ${alters.map(a=>`<option value="${a.id}" ${t.alterId===a.id?'selected':''}>${a.emoji||''} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row" style="flex-direction:row;align-items:center;justify-content:space-between">
        <div>
          <div class="perm-toggle-label">⇄ Provoca switcheo</div>
          <div class="perm-toggle-sublabel">Este trigger puede provocar un cambio de alter en frente</div>
        </div>
        <div class="toggle-switch ${t.provocaSwitcheo?'on':''}" id="tr-switcheo"></div>
      </div>
      <div class="form-row">
        <div class="form-label">Intensidad percibida</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${[1,2,3,4,5].map(n=>`<div class="rec-opt${t.intensidad===n?' selected':''}" data-inten="${n}">${n}</div>`).join('')}
        </div>
        <input type="hidden" id="tr-intensidad" value="${t.intensidad||3}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit ? 'Guardar' : 'Añadir'}</button>
    </div>`,
    (ov) => {
      const titulo = ov.querySelector('#tr-titulo').value.trim();
      if(!titulo) return showToast('⚠ El título es obligatorio');
      const entry = {
        id: isEdit ? t.id : uid(),
        titulo,
        descripcion: ov.querySelector('#tr-desc').value.trim(),
        alterId: ov.querySelector('#tr-alter').value || null,
        provocaSwitcheo: ov.querySelector('#tr-switcheo').classList.contains('on'),
        intensidad: parseInt(ov.querySelector('#tr-intensidad').value)||3,
      };
      const list = loadSaludTriggers();
      if(isEdit) { const i=list.findIndex(x=>x.id===t.id); if(i>=0) list[i]=entry; else list.push(entry); }
      else list.push(entry);
      saveSaludTriggers(list);
      closeModal();
      showToast(isEdit ? 'Trigger actualizado ✓' : 'Trigger añadido ✓');
      if(onDone) onDone();
    }
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelector('#tr-switcheo')?.addEventListener('click', () => ov.querySelector('#tr-switcheo').classList.toggle('on'));
  ov.querySelectorAll('[data-inten]').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('[data-inten]').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
    ov.querySelector('#tr-intensidad').value = b.dataset.inten;
  }));
}

function openAlergiaModal(item, onDone) {
  const isEdit = !!item;
  const a = item || { nombre:'', reaccion:'', gravedad:'media', notas:'' };

  openModal(`
    <div class="modal-title">${isEdit ? 'Editar alergia' : 'Nueva alergia'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Nombre / sustancia</div>
        <input type="text" id="al-nombre" placeholder="Ej: Ibuprofeno, cacahuetes..." value="${esc(a.nombre)}">
      </div>
      <div class="form-row">
        <div class="form-label">Reacción</div>
        <input type="text" id="al-reaccion" placeholder="Describe la reacción..." value="${esc(a.reaccion)}">
      </div>
      <div class="form-row">
        <div class="form-label">Gravedad</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${[{id:'leve',label:'Leve'},{id:'media',label:'Media'},{id:'grave',label:'Grave'}].map(g=>`<div class="rec-opt${a.gravedad===g.id?' selected':''}" data-grav="${g.id}">${g.label}</div>`).join('')}
        </div>
        <input type="hidden" id="al-gravedad" value="${a.gravedad||'media'}">
      </div>
      <div class="form-row">
        <div class="form-label">Notas (opcional)</div>
        <textarea id="al-notas" rows="2" placeholder="Información adicional...">${esc(a.notas)}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit ? 'Guardar' : 'Añadir'}</button>
    </div>`,
    (ov) => {
      const nombre = ov.querySelector('#al-nombre').value.trim();
      if(!nombre) return showToast('⚠ El nombre es obligatorio');
      const entry = {
        id: isEdit ? a.id : uid(),
        nombre,
        reaccion: ov.querySelector('#al-reaccion').value.trim(),
        gravedad: ov.querySelector('#al-gravedad').value,
        notas:    ov.querySelector('#al-notas').value.trim(),
      };
      const list = loadAlergias();
      if(isEdit) { const i=list.findIndex(x=>x.id===a.id); if(i>=0) list[i]=entry; else list.push(entry); }
      else list.push(entry);
      saveAlergias(list);
      closeModal();
      showToast(isEdit ? 'Alergia actualizada ✓' : 'Alergia añadida ✓');
      if(onDone) onDone();
    }
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelectorAll('[data-grav]').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('[data-grav]').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
    ov.querySelector('#al-gravedad').value = b.dataset.grav;
  }));
}

function openMedicacionModal(item, onDone) {
  const isEdit = !!item;
  const m = item || { nombre:'', dosis:'', frecuencia:'', notas:'', activa:true };

  openModal(`
    <div class="modal-title">${isEdit ? 'Editar medicación' : 'Nueva medicación'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Nombre</div>
        <input type="text" id="med-nombre" placeholder="Nombre del medicamento..." value="${esc(m.nombre)}">
      </div>
      <div class="form-row">
        <div class="form-label">Dosis</div>
        <input type="text" id="med-dosis" placeholder="Ej: 20mg, 1 comprimido..." value="${esc(m.dosis)}">
      </div>
      <div class="form-row">
        <div class="form-label">Frecuencia</div>
        <input type="text" id="med-frecuencia" placeholder="Ej: Cada 8h, 1 vez al día..." value="${esc(m.frecuencia)}">
      </div>
      <div class="form-row">
        <div class="form-label">Notas (opcional)</div>
        <textarea id="med-notas" rows="2" placeholder="Efectos, indicaciones...">${esc(m.notas)}</textarea>
      </div>
      <div class="form-row" style="flex-direction:row;align-items:center;justify-content:space-between">
        <div>
          <div class="perm-toggle-label">◎ Medicación activa</div>
          <div class="perm-toggle-sublabel">¿Se está tomando actualmente?</div>
        </div>
        <div class="toggle-switch ${m.activa!==false?'on':''}" id="med-activa"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit ? 'Guardar' : 'Añadir'}</button>
    </div>`,
    (ov) => {
      const nombre = ov.querySelector('#med-nombre').value.trim();
      if(!nombre) return showToast('⚠ El nombre es obligatorio');
      const entry = {
        id: isEdit ? m.id : uid(),
        nombre,
        dosis:      ov.querySelector('#med-dosis').value.trim(),
        frecuencia: ov.querySelector('#med-frecuencia').value.trim(),
        notas:      ov.querySelector('#med-notas').value.trim(),
        activa:     ov.querySelector('#med-activa').classList.contains('on'),
      };
      const list = loadMedicaciones();
      if(isEdit) { const i=list.findIndex(x=>x.id===m.id); if(i>=0) list[i]=entry; else list.push(entry); }
      else list.push(entry);
      saveMedicaciones(list);
      closeModal();
      showToast(isEdit ? 'Medicación actualizada ✓' : 'Medicación añadida ✓');
      if(onDone) onDone();
    }
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelector('#med-activa')?.addEventListener('click', () => ov.querySelector('#med-activa').classList.toggle('on'));
}

function openMedicacionReminderModal(med, onDone) {
  // Crea recordatorio pre-rellenado con el nombre de la medicación, enlazado por medicacionId
  const alters = getAlters();
  const dtDefault = new Date(Date.now() + 3600000).toISOString().slice(0,16);

  openModal(`
    <div class="modal-title">🔔 Recordatorio para ${esc(med?.nombre||'medicación')}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="mrem-title" value="Tomar ${esc(med?.nombre||'')}${med?.dosis?' ('+esc(med.dosis)+')':''}" placeholder="Título...">
      </div>
      <div class="form-row">
        <div class="form-label">Fecha y hora</div>
        <input type="datetime-local" id="mrem-dt" value="${dtDefault}">
      </div>
      <div class="form-row">
        <div class="form-label">Repetición</div>
        <div class="recurrence-opts">
          ${REMINDER_RECURRENCE.map(rc=>`<div class="rec-opt${rc.id==='daily'?' selected':''}" data-rc="${rc.id}">${rc.label}</div>`).join('')}
        </div>
        <input type="hidden" id="mrem-rec" value="daily">
      </div>
      <div class="form-row">
        <div class="form-label">Para alter (opcional)</div>
        <select id="mrem-alter">
          <option value="">Todo el sistema</option>
          ${alters.map(a=>`<option value="${a.id}">${a.emoji||''} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>Crear recordatorio</button>
    </div>`,
    (ov) => {
      const title = ov.querySelector('#mrem-title').value.trim();
      if(!title) return showToast('⚠ El título es obligatorio');
      const dtVal = ov.querySelector('#mrem-dt').value;
      if(!dtVal) return showToast('⚠ La fecha es obligatoria');
      const entry = {
        id: uid(),
        title,
        desc: med ? `Medicación: ${med.nombre}${med.dosis?' — '+med.dosis:''}` : '',
        icon: '💊',
        datetime: new Date(dtVal).getTime(),
        recurrence: ov.querySelector('#mrem-rec').value,
        alterId: ov.querySelector('#mrem-alter').value || null,
        done: false,
        medicacionId: med?.id || null,
      };
      const list = loadReminders();
      list.push(entry);
      saveReminders(list);
      closeModal();
      showToast('Recordatorio de medicación creado ✓');
      if(onDone) onDone();
    }
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelectorAll('[data-rc]').forEach(btn => btn.addEventListener('click', () => {
    ov.querySelectorAll('[data-rc]').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    ov.querySelector('#mrem-rec').value = btn.dataset.rc;
  }));
}

// AGENDA
// ═══════════════════════════════════════════════
function renderAgenda(){ return window.AtriaAgendaView.render(); }

const AGENDA_COLORS = ['#a08aff','#8affe0','#ffb450','#ff8ae2','#8ab4ff','#ff6b8a','#5fffb0','#ffd580'];
const RECUR_OPTS = [
  {id:'none',   label:'Sin repetición'},
  {id:'daily',  label:'Diario'},
  {id:'weekly', label:'Semanal'},
  {id:'monthly',label:'Mensual'},
  {id:'yearly', label:'Anual'},
];
const EVENT_TYPES = [
  {id:'cita',       label:'Cita',        emoji:'📅'},
  {id:'terapia',    label:'Terapia',     emoji:'🧠'},
  {id:'tarea',      label:'Tarea',       emoji:'✓'},
  {id:'recordatorio',label:'Recordatorio',emoji:'🔔'},
  {id:'social',     label:'Social',      emoji:'👥'},
  {id:'personal',   label:'Personal',    emoji:'🌙'},
  {id:'otro',       label:'Otro',        emoji:'◎'},
  {id:'cita_medica', label:'Cita médica',  emoji:'🏥'},
];

let agendaView = 'mes'; // mes | semana | lista
let agendaCal  = { month: new Date().getMonth(), year: new Date().getFullYear() };
let agendaWeek = new Date(); // week anchor

function loadEvents()  { try { return JSON.parse(localStorage.getItem('tid_events'))||[]; } catch{return[];} }
function saveEvents(e) { localStorage.setItem('tid_events', JSON.stringify(e)); }
function eventDate(date, time) {
  const [y,m,d] = String(date||'').split('-').map(Number);
  if (![y,m,d].every(Number.isFinite)) return new Date(NaN);
  const [hh,mm] = String(time||'00:00').split(':').map(Number);
  return new Date(y, m-1, d, Number.isFinite(hh)?hh:0, Number.isFinite(mm)?mm:0);
}
function localDateKey(date) {
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}

function getEventAlterIds(e) {
  if (Array.isArray(e.alterIds) && e.alterIds.length) return e.alterIds;
  if (e.alterId) return [e.alterId];
  return [];
}

function getVisibleEvents() {
  // Returns events visible to active alter: shared + own (supports alterIds[])
  return loadEvents().filter(e =>
    e.scope === 'compartido' || getEventAlterIds(e).includes(activeAlter.id)
  );
}

function expandRecurring(events, from, to) {
  // Expand recurring events into the given date range
  const result = [];
  const fromMs = from.getTime(), toMs = to.getTime();
  events.forEach(ev => {
    const base = eventDate(ev.date);
    if (ev.recur === 'none' || !ev.recur) {
      if (base >= from && base <= to) result.push({...ev, _instanceDate: ev.date});
      return;
    }
    let cur = new Date(base);
    let safety = 0;
    while (cur.getTime() <= toMs && safety++ < 500) {
      if (cur.getTime() >= fromMs) result.push({...ev, _instanceDate: localDateKey(cur)});
      if (ev.recur==='daily')        cur.setDate(cur.getDate()+1);
      else if (ev.recur==='weekly')  cur.setDate(cur.getDate()+7);
      else if (ev.recur==='monthly') cur.setMonth(cur.getMonth()+1);
      else if (ev.recur==='yearly')  cur.setFullYear(cur.getFullYear()+1);
      else break;
    }
  });
  return result;
}

function openEventModal(ev, prefillDate) {
  const isEdit = !!ev;
  const alters = getAlters();
  const today  = prefillDate || new Date().toISOString().slice(0,10);
  const existingAlterIds = ev ? getEventAlterIds(ev) : [activeAlter.id];
  const e = ev || {
    title:'', type:'otro', date:today, time:'', duration:60,
    color:'#a08aff', scope:'personal', alterIds:[activeAlter.id],
    recur:'none', reminderMins:0, note:'', allDay:false
  };
  const isAllDay = !!e.allDay;

  const REMINDER_OPTS = [
    {v:0,   l:'Sin recordatorio'},
    {v:15,  l:'15 min antes'},
    {v:30,  l:'30 min antes'},
    {v:60,  l:'1h antes'},
    {v:120, l:'2h antes'},
    {v:1440,l:'1 día antes'},
  ];

  openModal(`
    <div class="modal-title">${isEdit?'Editar evento':'Nuevo evento'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="ev-title" placeholder="Nombre del evento" value="${e.title||''}">
      </div>

      <div class="form-row">
        <div class="form-label">Tipo</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${EVENT_TYPES.map(t=>`<div class="recur-opt ${e.type===t.id?'selected':''}" data-etype="${t.id}">${t.emoji} ${t.label}</div>`).join('')}
        </div>
        <input type="hidden" id="ev-type" value="${e.type||'otro'}">
      </div>

      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Fecha</div>
          <input type="date" id="ev-date" value="${e.date||today}">
        </div>
        <div class="form-row" style="flex-direction:row;align-items:center;justify-content:space-between;padding-top:20px">
          <div class="perm-toggle-label">Todo el día</div>
          <div class="toggle-switch ${isAllDay?'on':''}" id="ev-allday"></div>
        </div>
      </div>

      <div class="form-row two-col" id="ev-time-row" style="${isAllDay?'display:none':''}">
        <div class="form-row">
          <div class="form-label">Hora (opcional)</div>
          <input type="time" id="ev-time" value="${e.time||''}">
        </div>
        <div class="form-row">
          <div class="form-label">Duración (min)</div>
          <input type="number" id="ev-dur" min="5" step="5" value="${e.duration||60}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-label">Color</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0">
          ${AGENDA_COLORS.map(c=>`<div class="color-swatch ${e.color===c?'selected':''}" data-color="${c}" style="background:${c};width:24px;height:24px"></div>`).join('')}
        </div>
        <input type="hidden" id="ev-color" value="${e.color||'#a08aff'}">
      </div>

      <div class="form-row">
        <div class="form-label">Visibilidad</div>
        <div class="scope-tabs">
          <div class="scope-tab ${e.scope==='personal'?'active':''}" data-scope="personal">🔒 Personal</div>
          <div class="scope-tab ${e.scope==='compartido'?'active':''}" data-scope="compartido">🌐 Compartido</div>
        </div>
        <input type="hidden" id="ev-scope" value="${e.scope||'personal'}">
      </div>

      <div class="form-row" id="alter-row" style="${e.scope==='compartido'?'display:none':''}">
        <div class="form-label">Asignar a alter(s)</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0">
          ${alters.map(a=>`<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;padding:5px 10px;border-radius:7px;border:1px solid ${existingAlterIds.includes(a.id)?a.color+'88':'var(--border)'};background:${existingAlterIds.includes(a.id)?a.bg:'transparent'};transition:var(--transition)">
            <input type="checkbox" class="ev-alter-chk" value="${a.id}" ${existingAlterIds.includes(a.id)?'checked':''} style="accent-color:${a.color}">
            <span>${a.emoji} ${esc(a.name)}</span>
          </label>`).join('')}
        </div>
      </div>

      <div class="form-row">
        <div class="form-label">Repetición</div>
        <div class="recur-opts">
          ${RECUR_OPTS.map(r=>`<div class="recur-opt ${e.recur===r.id?'selected':''}" data-recur="${r.id}">${r.label}</div>`).join('')}
        </div>
        <input type="hidden" id="ev-recur" value="${e.recur||'none'}">
      </div>

      <div class="form-row">
        <div class="form-label">🔔 Recordatorio</div>
        <select id="ev-reminder-mins">
          ${REMINDER_OPTS.map(o=>`<option value="${o.v}" ${(e.reminderMins||0)===o.v?'selected':''}>${o.l}</option>`).join('')}
        </select>
      </div>

      <div class="form-row">
        <div class="form-label">Notas</div>
        <textarea id="ev-note" placeholder="Detalles adicionales...">${e.note||''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Crear evento'}</button>
    </div>`,
    (overlay) => {
      const title      = overlay.querySelector('#ev-title').value.trim();
      const type       = overlay.querySelector('#ev-type').value;
      const date       = overlay.querySelector('#ev-date').value;
      const allDay     = overlay.querySelector('#ev-allday').classList.contains('on');
      const time       = allDay ? '' : overlay.querySelector('#ev-time').value;
      const duration   = allDay ? 0 : parseInt(overlay.querySelector('#ev-dur').value)||60;
      const color      = overlay.querySelector('#ev-color').value;
      const scope      = overlay.querySelector('#ev-scope').value;
      const alterIds   = scope === 'compartido' ? [] : [...overlay.querySelectorAll('.ev-alter-chk:checked')].map(c=>c.value);
      const recur      = overlay.querySelector('#ev-recur').value;
      const reminderMins = parseInt(overlay.querySelector('#ev-reminder-mins').value)||0;
      const note       = overlay.querySelector('#ev-note').value.trim();
      if(!title||!date) return showToast('⚠ Título y fecha son obligatorios');
      if(scope !== 'compartido' && alterIds.length === 0) return showToast('⚠ Selecciona al menos un alter');

      // Detección de conflictos (eventos con hora del mismo alter en el mismo día)
      if (!allDay && time && alterIds.length) {
        const [hh,mm] = time.split(':').map(Number);
        const startMin = hh*60+mm;
        const endMin   = startMin + duration;
        const conflicts = loadEvents().filter(x => {
          if (x.id === ev?.id) return false;
          if (x.allDay || !x.time || x.date !== date) return false;
          const xIds = getEventAlterIds(x);
          if (!xIds.some(id => alterIds.includes(id))) return false;
          const [xh,xm] = x.time.split(':').map(Number);
          const xStart = xh*60+xm, xEnd = xStart+(x.duration||60);
          return startMin < xEnd && endMin > xStart;
        });
        if (conflicts.length) {
          showToast(`⚠ Conflicto: "${conflicts[0].title}" en el mismo horario`);
          // seguimos guardando (aviso, no bloqueo)
        }
      }

      let list = loadEvents();
      const entry = {id:ev?.id||uid(),title,type,date,allDay,time,duration,color,scope,alterIds,recur,reminderMins,note};
      if(isEdit) list = list.map(x=>x.id===ev.id?entry:x);
      else list.push(entry);
      saveEvents(list);

      // Crear/actualizar recordatorio en tid_reminders si reminderMins > 0 y hay hora
      if (reminderMins > 0 && time && !allDay) {
        const [rh,rm] = time.split(':').map(Number);
        const eventMinutes = rh*60+rm;
        const remMinutes   = eventMinutes - reminderMins;
        const remH = Math.floor(((remMinutes % 1440) + 1440) % 1440 / 60);
        const remM = ((remMinutes % 60) + 60) % 60;
        const remTime = `${String(remH).padStart(2,'0')}:${String(remM).padStart(2,'0')}`;
        const reminders = (() => { try { return JSON.parse(localStorage.getItem('tid_reminders'))||[]; } catch{return[];} })();
        // Remove old reminder for this event if editing
        const cleaned = reminders.filter(r => r._eventId !== entry.id);
        cleaned.push({
          id: uid(), _eventId: entry.id,
          title: `🗓 ${title}`, note: `En ${reminderMins < 60 ? reminderMins+' min' : (reminderMins/60)+'h'}`,
          date, time: remTime, alterId: alterIds[0]||activeAlter.id,
          recur: recur||'none', active: true
        });
        localStorage.setItem('tid_reminders', JSON.stringify(cleaned));
      }

      closeModal();
      showToast(isEdit?'Evento actualizado ✓':'Evento creado ✓');
      renderAgendaContent();
    }
  );

  const ov = document.querySelector('.modal-overlay');
  // Type select
  ov.querySelectorAll('[data-etype]').forEach(opt=>opt.addEventListener('click',()=>{
    ov.querySelectorAll('[data-etype]').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected');
    ov.querySelector('#ev-type').value=opt.dataset.etype;
  }));
  // All-day toggle
  ov.querySelector('#ev-allday')?.addEventListener('click',()=>{
    const btn = ov.querySelector('#ev-allday');
    btn.classList.toggle('on');
    const timeRow = ov.querySelector('#ev-time-row');
    if (timeRow) timeRow.style.display = btn.classList.contains('on') ? 'none' : '';
  });
  // Scope tabs
  ov.querySelectorAll('[data-scope]').forEach(tab=>tab.addEventListener('click',()=>{
    ov.querySelectorAll('[data-scope]').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    ov.querySelector('#ev-scope').value=tab.dataset.scope;
    ov.querySelector('#alter-row').style.display=tab.dataset.scope==='compartido'?'none':'';
  }));
  // Recur opts
  ov.querySelectorAll('[data-recur]').forEach(opt=>opt.addEventListener('click',()=>{
    ov.querySelectorAll('[data-recur]').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected');
    ov.querySelector('#ev-recur').value=opt.dataset.recur;
  }));
  // Color swatches
  ov.querySelectorAll('.color-swatch').forEach(sw=>sw.addEventListener('click',()=>{
    ov.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));
    sw.classList.add('selected');
    ov.querySelector('#ev-color').value=sw.dataset.color;
  }));
  // Alter checkbox visual feedback
  ov.querySelectorAll('.ev-alter-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      const lbl = chk.closest('label');
      const a = alters.find(x=>x.id===chk.value);
      if (!lbl || !a) return;
      lbl.style.borderColor = chk.checked ? a.color+'88' : 'var(--border)';
      lbl.style.background  = chk.checked ? a.bg : 'transparent';
    });
  });
}

// ═══════════════════════════════════════════════
// ONBOARDING (primera vez)
// ═══════════════════════════════════════════════
// TUTORIAL (primera visita al hub)
// ═══════════════════════════════════════════════
function showTutorial() {
  if (document.getElementById('tut-overlay')) return;

  const STEPS = [
    {
      label: 'Tutorial · 1 de 5',
      title: 'Tu panel de control',
      desc: 'El Hub es tu punto de entrada cada vez que entras al sistema. Desde aquí llegas a todos los módulos con un solo toque.',
      features: [
        { icon: '⚡', name: 'Acceso rápido', desc: 'Todos los módulos visibles de un vistazo' },
        { icon: '◈', name: 'Tablón', desc: 'Mensajes fijados del sistema al instante' },
        { icon: '◷', name: 'Fronting activo', desc: 'Quién está presente en tiempo real' },
      ]
    },
    {
      label: 'Tutorial · 2 de 5',
      title: 'Sistema',
      desc: 'Gestiona quiénes forman tu sistema, registra el fronting y haz seguimiento del estado emocional colectivo.',
      features: [
        { icon: '👥', name: 'Perfiles', desc: 'Fichas con roles, permisos y apariencia de cada parte' },
        { icon: '🔄', name: 'Fronting', desc: 'Sesiones de fronting con historial y estadísticas' },
        { icon: '🎭', name: 'Tracker', desc: 'Registro diario del estado emocional' },
      ]
    },
    {
      label: 'Tutorial · 3 de 5',
      title: 'Comunicación y espacio personal',
      desc: 'Organiza la comunicación interna y el espacio personal de cada parte del sistema.',
      features: [
        { icon: '💬', name: 'Comunicación', desc: 'Chat interno, tablón, solicitudes y deseos' },
        { icon: '📓', name: 'Diario', desc: 'Entradas personales con niveles de privacidad' },
        { icon: '📚', name: 'Biblioteca y normas', desc: 'Recursos, documentos y reglas del sistema' },
      ]
    },
    {
      label: 'Tutorial · 4 de 5',
      title: 'Herramientas',
      desc: 'Organiza el día a día con agenda, rutinas, proyectos y un control de finanzas completo.',
      features: [
        { icon: '📅', name: 'Agenda', desc: 'Citas, eventos y recordatorios con notificaciones' },
        { icon: '🔁', name: 'Rutinas', desc: 'Hábitos diarios con seguimiento de adherencia' },
        { icon: '💰', name: 'Finanzas', desc: 'Gastos, ahorros y presupuestos por alter' },
      ]
    },
    {
      label: 'Tutorial · 5 de 5',
      title: 'Tus datos y tus conexiones',
      desc: 'Por defecto tus datos se guardan en este dispositivo. Si activas Online, puedes sincronizar entre dispositivos y mantener un backup cifrado automático.',
      features: [
        { icon: '☁️', name: 'Online y Sync', desc: 'Amigos, chat online y sincronización cifrada entre dispositivos' },
        { icon: '💾', name: 'Copias de seguridad', desc: 'Backup online automático o exportación/importación manual' },
        { icon: '🔒', name: 'PIN', desc: 'Protege el acceso con contraseña local' },
        { icon: '⚙️', name: 'Configuración', desc: 'Gestiona privacidad, dispositivos y notificaciones' },
      ]
    },
  ];

  const ov = document.createElement('div');
  ov.id = 'tut-overlay';
  let step = 0;

  function renderStep() {
    const s = STEPS[step];
    const isLast = step === STEPS.length - 1;
    ov.innerHTML = `
      <div class="tut-wrap">
        <div class="ob-progress">
          ${STEPS.map((_,i)=>`<div class="ob-dot ${i===step?'active':i<step?'done':''}"></div>`).join('')}
        </div>
        <div class="ob-step active">
          <div>
            <div class="ob-step-label">${s.label}</div>
            <div class="ob-step-title">${s.title}</div>
            <div class="ob-step-desc" style="margin-top:8px">${s.desc}</div>
          </div>
          <div class="tut-feature-grid">
            ${s.features.map(f=>`
              <div class="ob-tip">
                <div class="ob-tip-icon">${f.icon}</div>
                <div>
                  <div class="ob-tip-title">${f.name}</div>
                  <div class="ob-tip-desc">${f.desc}</div>
                </div>
              </div>`).join('')}
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${step > 0 ? `<button class="btn btn-ghost" id="tut-back">← Atrás</button>` : ''}
            <button class="btn btn-primary" id="tut-next">${isLast ? 'Entendido ✓' : 'Siguiente →'}</button>
            ${!isLast ? `<button class="btn btn-ghost" id="tut-skip" style="margin-left:auto;font-size:12px;opacity:.7">Saltar tutorial</button>` : ''}
          </div>
        </div>
      </div>`;
    ov.querySelector('#tut-next').addEventListener('click', () => {
      if (isLast) { closeTutorial(); } else { step++; renderStep(); }
    });
    ov.querySelector('#tut-back')?.addEventListener('click', () => { step--; renderStep(); });
    ov.querySelector('#tut-skip')?.addEventListener('click', closeTutorial);
  }

  function closeTutorial() {
    localStorage.setItem('tid_tutorial_done', '1');
    localStorage.setItem('tid_tutorial_version', '20260831-1');
    ov.style.opacity = '0';
    ov.style.transform = 'scale(0.97)';
    ov.style.transition = 'all 350ms ease';
    setTimeout(() => ov.remove(), 350);
  }

  document.body.appendChild(ov);
  renderStep();
}

// ═══════════════════════════════════════════════
// PERFILES VIEW
// ═══════════════════════════════════════════════
function renderPerfiles() {
  alteresTab = 'perfiles';
  renderAlters();
}

function renderFichasLegacy() {
  alteresTab = 'fichas';
  renderAlters();
}

function renderAlters() {
  const tabLabel = {perfiles:'Perfiles', fichas:'Fichas'};
  const _altLabel = {perfiles:'Perfiles',fichas:'Fichas'};
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Alters · '+(_altLabel[alteresTab]||'Perfiles')}]);
  const app = document.getElementById('app');
  const alters = getAlters();
  const btnNew = alteresTab==='perfiles'
    ? `<button class="btn btn-primary" id="btn-alters-new">+ Nuevo alter</button>`
    : `<button class="btn btn-primary" id="btn-alters-new">+ Nueva ficha</button>`;

  app.innerHTML = `
    <div class="perfiles-view" style="max-width:960px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◎ Alters del sistema</div>
          <div class="fin-subtitle">${alters.length} alter${alters.length!==1?'s':''} registrados${(() => { const arch = getAlters(true).filter(a=>a.isArchived); return arch.length ? ` · <span style="color:#ffd580">${arch.length} archivado${arch.length!==1?'s':''}</span>` : ''; })()}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${(() => { const arch = getAlters(true).filter(a=>a.isArchived); return arch.length ? `<button class="btn btn-ghost btn-sm" id="btn-show-archived">◫ Archivados</button>` : ''; })()}
          ${btnNew}
        </div>
      </div>
      <div class="module-tabs">
        <div class="module-tab${alteresTab==='perfiles'?' active':''}" data-at="perfiles">◎ Perfiles</div>
        <div class="module-tab${alteresTab==='fichas'?' active':''}" data-at="fichas">◈ Fichas</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 6px">
        <div class="view-toggle-group">
          <button class="view-toggle-btn${alteresViewMode==='cards'?' active':''}" id="btn-view-cards" title="Vista cards">⊞</button>
          <button class="view-toggle-btn${alteresViewMode==='list'?' active':''}" id="btn-view-list" title="Vista lista">☰</button>
        </div>
        <select id="sort-select" class="sort-select">
          <option value="default"${alteresSortMode==='default'?' selected':''}>Orden original</option>
          <option value="alpha"${alteresSortMode==='alpha'?' selected':''}>A–Z</option>
          <option value="date"${alteresSortMode==='date'?' selected':''}>Fecha de creación</option>
        </select>
        ${alteresTab==='perfiles'
          ? `<select id="role-filter-select" class="sort-select">
              <option value="">Todos los roles</option>
              ${getAllRoleTypes().map(r=>`<option value="${r.id}"${alteresRoleFilter===r.id?' selected':''}>${r.emoji} ${r.label}</option>`).join('')}
             </select>`
          : (() => {
              const roles = [...new Set(loadFichas().map(f=>(f.rol_publico||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
              return roles.length ? `<select id="role-filter-select" class="sort-select">
                <option value="">Todos los roles</option>
                ${roles.map(role=>`<option value="${role}"${alteresRoleFilter===role?' selected':''}>${role}</option>`).join('')}
              </select>` : '';
            })()
        }
      </div>
      <div id="alters-content"></div>
    </div>`;

  app.querySelectorAll('[data-at]').forEach(t=>t.addEventListener('click',()=>{
    const nextTab = t.dataset.at;
    if (alteresTab !== nextTab) alteresRoleFilter = '';
    alteresTab=nextTab; renderAlters();
  }));
  app.querySelector('#btn-view-cards')?.addEventListener('click',()=>{ alteresViewMode='cards'; renderAlters(); });
  app.querySelector('#btn-view-list')?.addEventListener('click',()=>{ alteresViewMode='list'; renderAlters(); });
  app.querySelector('#sort-select')?.addEventListener('change',e=>{ alteresSortMode=e.target.value; renderAlters(); });
  app.querySelector('#role-filter-select')?.addEventListener('change',e=>{ alteresRoleFilter=e.target.value; renderAlters(); });
  app.querySelector('#btn-alters-new')?.addEventListener('click',()=>{
    if(alteresTab==='perfiles') openAlterModal(null, renderAlters);
    else openFichaModal(null);
  });
  app.querySelector('#btn-show-archived')?.addEventListener('click', openArchivedAltersModal);

  const cont = app.querySelector('#alters-content');
  if(alteresTab==='perfiles') renderPerfilesInAltersContainer(cont);
  else renderFichasInAltersContainer(cont);
}

function renderPerfilesInAltersContainer(cont) {
  let alters = getAlters();
  if (alteresSortMode === 'default') alters = orderAlters(alters);
  const allAltersList = getAlters(); // lista completa para resolver relaciones
  const fichas = loadFichas();

  // Filtrar por rol
  if(alteresRoleFilter) alters = alters.filter(a => a.roleType === alteresRoleFilter);
  // Ordenar
  if(alteresSortMode === 'alpha') alters = [...alters].sort((a,b)=>a.name.localeCompare(b.name));
  else if(alteresSortMode === 'date') alters = [...alters].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));

  const isListMode = alteresViewMode === 'list';
  const subsystems = loadSubsystems();

  // Helper: render a single alter card or list item
  const _cardHtml = a => {
    const rt = getAllRoleTypes().find(r=>r.id===a.roleType);
    const at = AGE_TYPES.find(x=>x.id===a.ageType);
    const ficha = fichas.find(f => f.alterId === a.id) || fichas.find(f => f.nombre && f.nombre.toLowerCase() === a.name.toLowerCase());
    const fichaBtn = ficha
      ? `<button class="btn btn-ghost btn-sm btn-ver-ficha" data-id="${a.id}" data-ficha-id="${ficha.id}" style="color:var(--accent);border-color:rgba(160,138,255,0.25)">◈ Ver ficha</button>`
      : `<button class="btn btn-ghost btn-sm btn-crear-ficha" data-id="${a.id}" style="color:var(--text-2)">◈ Crear ficha</button>`;
    const stateBadge = (()=>{const _s=ALTER_STATES.find(s=>s.id===(a.state||'activo'));return _s&&_s.id!=='activo'?`<span class="alter-state-badge" style="color:${_s.color}">${_s.icon} ${_s.label}</span>`:''})();
    const _il = INTIMACY_LEVELS.find(l=>l.id===(a.intimacyLevel||'interno'))||INTIMACY_LEVELS[1];
    const intimacyBadge = `<span class="intimacy-badge" style="color:${_il.color};border-color:${_il.color}44">${_il.icon} ${_il.label}</span>`;
    if(isListMode) {
      return `<div class="alter-list-item${a.bannerImg?' has-banner':''}" data-id="${a.id}" style="--card-color:${a.color};--card-bg:${a.bg}">
        ${a.bannerImg ? `<div class="list-banner" style="background-image:url(${a.bannerImg})"></div>` : ''}
        <div class="list-main">
          <div class="ali-av list-avatar" style="background:${a.bg};border:2px solid ${a.color};overflow:hidden">${alterAv(a,44)}</div>
          <div class="ali-info list-info">
            <div class="ali-name">${esc(a.name)}${a.isAdmin?'<span class="perfil-admin-badge">Admin</span>':''}${stateBadge}</div>
            <div class="ali-sub" style="color:${a.color}">${rt?rt.emoji+' '+rt.label:a.role||'—'}${a.pronouns?' · '+a.pronouns:''}${at?.label?' · '+at.label.replace(/\s*\(.*?\)/,''):''}</div>
            ${a.description?`<div class="list-desc">${renderSafeProfileMarkdown(a.description)}</div>`:''}
            <div class="list-tags">
              ${intimacyBadge}
              ${MODULES_PERMS.map(m=>`<span class="perm-chip ${a.permissions?.[m.id]?'on':'off'}">${m.label}</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="ali-actions list-actions">
          <button class="btn btn-ghost btn-sm" data-move-alter="${a.id}" data-direction="-1" title="Subir">↑</button><button class="btn btn-ghost btn-sm" data-move-alter="${a.id}" data-direction="1" title="Bajar">↓</button><button class="btn btn-ghost btn-sm btn-edit-p" data-id="${a.id}">✎ Editar</button>
          ${fichaBtn}
          ${!a.isAdmin?`<button class="btn btn-danger btn-sm btn-del-p" data-id="${a.id}">✕</button>`:''}
        </div>
      </div>`;
    }
    return `<div class="perfil-card" data-id="${a.id}">
      ${a.bannerImg
        ? `<div class="perfil-card-banner" style="background-image:url(${a.bannerImg})">
             <div class="perfil-card-banner-av">
               <div class="perfil-card-avatar" style="background:${a.bg};border-color:${a.color};overflow:hidden;display:flex;align-items:center;justify-content:center">${alterAv(a,52)}</div>
             </div>
           </div>`
        : ''}
      <div class="perfil-card-top${a.bannerImg?' has-banner':''}">
        ${!a.bannerImg?`<div class="perfil-card-avatar" style="background:${a.bg};border-color:${a.color};overflow:hidden;display:flex;align-items:center;justify-content:center">${alterAv(a,52)}</div>`:''}
        <div class="perfil-card-info">
          <div class="perfil-card-name">${esc(a.name)}${a.isAdmin?'<span class="perfil-admin-badge">Admin</span>':''}${stateBadge}</div>
          <div class="perfil-card-role" style="color:${a.color}">${rt?rt.emoji+' ':''} ${a.role||rt?.label||'—'}</div>
          <div class="perfil-card-pronouns">${a.pronouns?a.pronouns+' · ':''}${at?.label?.replace(/\s*\(.*?\)/,'') ||''}</div>
        </div>
      </div>
      ${a.description?`<div class="perfil-card-desc">${renderSafeProfileMarkdown(a.description)}</div>`:''}
      <div class="perfil-card-perms">
        ${intimacyBadge}
        ${MODULES_PERMS.map(m=>`<span class="perm-chip ${a.permissions?.[m.id]?'on':'off'}">${m.label}</span>`).join('')}
      </div>
      <div class="perfil-card-actions">
        <button class="btn btn-ghost btn-sm" data-move-alter="${a.id}" data-direction="-1" title="Subir">↑</button><button class="btn btn-ghost btn-sm" data-move-alter="${a.id}" data-direction="1" title="Bajar">↓</button><button class="btn btn-ghost btn-sm btn-edit-p" data-id="${a.id}">✎ Editar</button>
        ${fichaBtn}
        ${!a.isAdmin?`<button class="btn btn-danger btn-sm btn-del-p" data-id="${a.id}">✕ Eliminar</button>`:''}
      </div>
    </div>`;
  };

  // Build HTML — grouped if subsystems exist, flat otherwise
  let gridHtml = '';
  if(subsystems.length) {
    const innerCls = isListMode ? 'alters-list' : 'perfiles-grid';
    subsystems.forEach(ss => {
      const group = alters.filter(a => a.subsystemId === ss.id);
      if(!group.length) return;
      gridHtml += `<div class="subsystem-group">
        <div class="subsystem-group-header" style="--ss-color:${ss.color}">
          <span class="subsystem-group-dot" style="background:${ss.color}"></span>
          <span class="subsystem-group-name">${escM(ss.name)}</span>
          <span class="subsystem-group-count">${group.length}</span>
          ${ss.description?`<span class="subsystem-group-desc">${escM(ss.description)}</span>`:''}
          ${activeAlter?.isAdmin?`<button class="btn btn-ghost btn-xs btn-ss-edit" data-ssid="${ss.id}" style="margin-left:auto;font-size:10px">✎</button>`:''}
        </div>
        <div class="${innerCls}">${group.map(_cardHtml).join('')}</div>
      </div>`;
    });
    const ungrouped = alters.filter(a => !a.subsystemId || !subsystems.some(s=>s.id===a.subsystemId));
    if(ungrouped.length) {
      gridHtml += `<div class="subsystem-group">
        <div class="subsystem-group-header" style="--ss-color:var(--text-3)">
          <span class="subsystem-group-dot" style="background:var(--text-3)"></span>
          <span class="subsystem-group-name" style="color:var(--text-2)">Sin subsistema</span>
          <span class="subsystem-group-count">${ungrouped.length}</span>
        </div>
        <div class="${innerCls}">${ungrouped.map(_cardHtml).join('')}</div>
      </div>`;
    }
  } else {
    gridHtml = alters.map(_cardHtml).join('');
  }

  cont.innerHTML = `
    ${activeAlter?.isAdmin ? `<div style="display:flex;justify-content:flex-end;margin-bottom:6px">
      <button class="btn btn-ghost btn-sm" id="btn-manage-subsystems" style="font-size:11px">◉ Gestionar subsistemas</button>
    </div>` : ''}
    <div class="${isListMode?'alters-list':'perfiles-grid'}" id="perfiles-grid">${subsystems.length?'':gridHtml}</div>
    ${subsystems.length?`<div id="perfiles-subsystem-container">${gridHtml}</div>`:''}`;
  const actionsRoot = cont.querySelector('#perfiles-subsystem-container') || cont.querySelector('#perfiles-grid') || cont;
  actionsRoot.querySelectorAll('.btn-edit-p').forEach(b=>b.addEventListener('click',()=>{
    const a = getAlters().find(x=>x.id===b.dataset.id);
    if(a) openAlterModal(a, renderAlters);
  }));
  actionsRoot.querySelectorAll('[data-move-alter]').forEach(b=>b.addEventListener('click',()=>moveAlterInOrder(b.dataset.moveAlter, Number(b.dataset.direction))));
  actionsRoot.querySelectorAll('.btn-ver-ficha').forEach(b=>b.addEventListener('click',()=>{
    const fichaId = b.dataset.fichaId;
    alteresTab='fichas'; renderAlters();
    // Highlight the ficha after navigation settles
    setTimeout(()=>{
      const card = document.querySelector(`.alter-profile-card[data-id="${fichaId}"]`);
      if(card){
        card.scrollIntoView({behavior:'smooth',block:'center'});
        card.style.transition='box-shadow 400ms';
        card.style.boxShadow='0 0 0 2px var(--accent)';
        setTimeout(()=>{ card.style.boxShadow=''; }, 1800);
      }
    }, 320);
  }));
  actionsRoot.querySelectorAll('.btn-crear-ficha').forEach(b=>b.addEventListener('click',()=>{
    const a = getAlters().find(x=>x.id===b.dataset.id);
    if(!a) return;
    // Pre-fill ficha with alter data
    const prefill = {
      _new: true,
      id: uid(),
      alterId: a.id,
      nombre: a.name,
      pronombres: a.pronouns||'',
      emoji: a.emoji||'◎',
      symbol: '◈',
      color: a.color||'#a08aff',
      bg: a.bg||'rgba(160,138,255,0.10)',
      bannerImg: a.bannerImg || null,
      avatarImg: a.avatarImg || null,
      rol_publico: a.role||'',
      descripcion: a.description||'',
      apodos:'', genero:'', edad:'', arquetipo:'', energia:'', elemento:'',
      paleta:[], frase:'', frecuencia: a.frecuencia||'ocasional', senales:'', afinidades:'', limites:'',
      rasgos:[], fortalezas:'', vulnerabilidades:'', valores:'', conflicto:'',
      nivel_emocional:50, estetica:'', musica:'', colores:'', animal:'', objeto:'',
      estacion:'', moodboard:[], frase_larga:'', habilidades:'', social:'',
      energia_habitual:3, como_hablar:'', incomoda:'', seguridad:'',
      relationships: a.relationships||[]
    };
    openFichaModal(prefill);
  }));
  actionsRoot.querySelectorAll('.btn-del-p').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('¿Eliminar este alter y todos sus datos?')) return;
    purgeAlterData(b.dataset.id);
    saveAlters(getAlters(true).filter(x=>x.id!==b.dataset.id));
    ALTERS = getAlters();
    renderAlters();
    showToast('Alter eliminado');
  }));
  cont.querySelector('#btn-manage-subsystems')?.addEventListener('click', openSubsystemsModal);
  cont.querySelectorAll('.btn-ss-edit').forEach(b=>b.addEventListener('click',()=>{
    const ss = loadSubsystems().find(s=>s.id===b.dataset.ssid);
    if(ss) openSubsystemsModal(ss.id);
  }));
}

function openSubsystemsModal(focusId) {
  let closeAndRefresh = null;
  const renderList = () => {
    const ssList = loadSubsystems();
    listEl.innerHTML = ssList.length
      ? ssList.map(ss=>`<div class="ss-item" style="--ss-color:${ss.color}">
          <span class="ss-item-dot" style="background:${ss.color}"></span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13px">${escM(ss.name)}</div>
            ${ss.description?`<div style="font-size:11px;color:var(--text-2)">${escM(ss.description)}</div>`:''}
          </div>
          <button class="btn btn-ghost btn-xs" data-move-ss="${ss.id}" data-direction="-1" title="Subir">↑</button><button class="btn btn-ghost btn-xs" data-move-ss="${ss.id}" data-direction="1" title="Bajar">↓</button><button class="btn btn-ghost btn-xs btn-ss-ed" data-ssid="${ss.id}">✎</button>
          <button class="btn btn-danger btn-xs btn-ss-del" data-ssid="${ss.id}">✕</button>
        </div>`).join('')
      : `<div style="font-size:12px;color:var(--text-3);padding:12px 0">No hay subsistemas definidos.</div>`;
    listEl.querySelectorAll('.btn-ss-del').forEach(b=>b.addEventListener('click',()=>{
      if(!confirm('¿Eliminar subsistema?')) return;
      saveSubsystems(loadSubsystems().filter(s=>s.id!==b.dataset.ssid));
      if(closeAndRefresh) closeAndRefresh('Subsistema eliminado ✓');
    }));
    listEl.querySelectorAll('[data-move-ss]').forEach(b=>b.addEventListener('click',()=>{
      const list=loadSubsystems(); const i=list.findIndex(s=>s.id===b.dataset.moveSs); const n=i+Number(b.dataset.direction);
      if(i>=0&&n>=0&&n<list.length){[list[i],list[n]]=[list[n],list[i]];saveSubsystems(list);renderList();}
    }));
    listEl.querySelectorAll('.btn-ss-ed').forEach(b=>b.addEventListener('click',()=>{
      const ss = loadSubsystems().find(s=>s.id===b.dataset.ssid);
      if(!ss) return;
      nameInput.value = ss.name;
      descInput.value = ss.description||'';
      colorInput.value = ss.color||'#a08aff';
      editingId = ss.id;
      saveBtn.textContent = 'Guardar cambios';
    }));
  };

  let editingId = null;
  const ov = document.createElement('div'); ov.className='modal-overlay';
  ov.innerHTML=`<div class="modal" style="max-width:400px">
    <div class="modal-header"><span style="font-weight:700">◉ Subsistemas</span><button class="modal-close" id="ss-close">✕</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
      <div id="ss-list"></div>
      <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:8px">
        <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.08em">Nuevo / editar</div>
        <input class="input" id="ss-name" placeholder="Nombre del subsistema" maxlength="40">
        <input class="input" id="ss-desc" placeholder="Descripción (opcional)" maxlength="100">
        <div style="display:flex;align-items:center;gap:8px">
          <label style="font-size:12px;color:var(--text-2)">Color</label>
          <input type="color" id="ss-color" value="#a08aff" style="height:32px;border-radius:6px;border:1px solid var(--border);cursor:pointer">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" id="ss-cancel">Cancelar</button>
          <button class="btn btn-primary btn-sm" id="ss-save">Añadir subsistema</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const listEl     = ov.querySelector('#ss-list');
  const nameInput  = ov.querySelector('#ss-name');
  const descInput  = ov.querySelector('#ss-desc');
  const colorInput = ov.querySelector('#ss-color');
  const saveBtn    = ov.querySelector('#ss-save');
  closeAndRefresh = (message) => {
    ov.remove();
    renderAlters();
    if(message) showToast(message);
  };
  renderList();
  ov.querySelector('#ss-close').addEventListener('click',()=>ov.remove());
  ov.querySelector('#ss-cancel').addEventListener('click',()=>{ editingId=null; nameInput.value=''; descInput.value=''; colorInput.value='#a08aff'; saveBtn.textContent='Añadir subsistema'; });
  ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
  saveBtn.addEventListener('click',()=>{
    const name = nameInput.value.trim();
    if(!name) return showToast('⚠ El nombre es obligatorio');
    const list = loadSubsystems();
    const hex  = colorInput.value||'#a08aff';
    if(editingId) {
      const idx = list.findIndex(s=>s.id===editingId);
      if(idx>=0) list[idx] = {...list[idx], name, description: descInput.value.trim(), color: hex};
      editingId = null; saveBtn.textContent = 'Añadir subsistema';
    } else {
      list.push({id:uid(), name, description: descInput.value.trim(), color: hex});
    }
    saveSubsystems(list);
    closeAndRefresh('Subsistema guardado ✓');
  });
}

function renderPerfilesGrid() {
  // Legacy alias: usada desde layer-0 y otros puntos
  const grid = document.getElementById('perfiles-subsystem-container') || document.getElementById('perfiles-grid');
  if (!grid) { renderAlters(); return; }
  renderPerfilesInAltersContainer(grid.closest('#alters-content') || grid.parentElement);
}

// ═══════════════════════════════════════════════
// ALTER MODAL (crear / editar)
// ═══════════════════════════════════════════════
function openAlterModal(alter, onDone) {
  const isEdit = !!alter;
  const a = normalizeAlterPermissions(alter || {
    emoji:'🌙', color:'#a08aff', bg:'rgba(160,138,255,0.12)',
    roleType:'otro', role:'', pronouns:'elle',
    ageType:'adulto', description:'', isAdmin:false, avatarImg: null,
    permissions:{finanzas:true,emociones:true,diario:true,comunicacion:true}
  });
  const adminCount = getAlters(true).filter(x => x.isAdmin).length;
  const isOnlyAdmin = !!a.isAdmin && adminCount <= 1;

  // Estado temporal del avatar y banner
  let _avatarImg  = a.avatarImg || null;  // base64 string o null
  let _avatarMode = _avatarImg ? 'img' : 'emoji'; // 'emoji' | 'img'
  let _bannerImg  = a.bannerImg || null;  // base64 string o null
  let _galleryImgs = Array.isArray(a.galleryImgs) ? [...a.galleryImgs] : [];
  let _referenceImgs = Array.isArray(a.referenceImgs) ? [...a.referenceImgs] : [];
  let _mediaTracking = Array.isArray(a.mediaTracking) ? [...a.mediaTracking] : [];
  const _isCustomColor = !ALTER_COLORS.includes(a.color);

  const modalHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div class="modal-title">${isEdit?'Editar perfil':'Nuevo alter'}</div>
        <div class="modal-subtitle">${isEdit?a.name:'Configuración completa'}</div>
      </div>
    </div>

    <div class="alter-modal-scroll">
    <div class="alter-modal-layout">
      <!-- Preview lateral -->
      <div class="alter-modal-preview">
        <div id="preview-avatar" class="alter-modal-av" style="border-color:${a.color};background:${a.bg}">
          ${_avatarImg
            ? `<img src="${_avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : `<span id="preview-emoji" style="font-size:32px">${a.emoji}</span>`}
        </div>
        <div id="preview-name" class="alter-modal-pname">${a.name||'Nombre'}</div>
        <div id="preview-role" class="alter-modal-prole" style="color:${a.color}">${a.role||'Rol'}</div>
      </div>

      <!-- Formulario con tabs -->
      <div class="alter-modal-form">
        <div class="type-tabs" id="modal-tabs">
          <div class="type-tab active" data-tab="basic">Básico</div>
          <div class="type-tab" data-tab="apariencia">Apariencia</div>
          ${activeAlter?.isAdmin ? `<div class="type-tab" data-tab="permisos">Permisos</div>` : ''}
          ${isEdit ? `<div class="type-tab" data-tab="relaciones">Relaciones</div>` : ''}
          ${isEdit ? `<div class="type-tab" data-tab="media">Media</div>` : ''}
        </div>

        <!-- TAB BÁSICO -->
        <div id="tab-basic" class="form-grid" style="margin-top:14px">
          <div class="form-row">
            <div class="form-label">Nombre</div>
            <input type="text" id="a-name" placeholder="Nombre del alter" value="${a.name||''}">
          </div>
          <div class="alter-two-col">
            <div class="form-row">
              <div class="form-label">Pronombres</div>
              <input type="text" id="a-pronouns" placeholder="ella / él / elle…" value="${escC(a.pronouns||'')}" autocomplete="off">
            </div>
            <div class="form-row">
              <div class="form-label">Edad aparente</div>
              <select id="a-agetype">
                ${AGE_TYPES.map(x=>`<option value="${x.id}" ${a.ageType===x.id?'selected':''}>${x.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-label">Tipo de rol</div>
            <div class="role-type-grid" id="role-type-grid">
              ${getAllRoleTypes().map(r=>`
                <div class="role-type-opt ${a.roleType===r.id?'selected':''}" data-rt="${r.id}" ${r.custom?'data-custom="1"':''}>
                  <div class="rt-emoji">${r.emoji}</div>
                  <div class="rt-label">${r.label}</div>
                </div>`).join('')}
              <div class="role-type-opt" data-rt="__new_custom__" id="btn-add-custom-role" title="Añadir tipo personalizado">
                <div class="rt-emoji">+</div>
                <div class="rt-label" style="font-size:9px">Personalizado</div>
              </div>
              <div class="role-type-opt" data-rt="__manage_custom__" id="btn-manage-custom-role" title="Editar, borrar u ordenar roles personalizados">
                <div class="rt-emoji">☷</div><div class="rt-label" style="font-size:9px">Gestionar</div>
              </div>
            </div>
            <input type="hidden" id="a-roletype" value="${a.roleType||'otro'}">
          </div>
          <div class="form-row">
            <div class="form-label">Nombre del rol</div>
            <input type="text" id="a-role" placeholder="Ej: Co-anfitriona, Guardiana..." value="${a.role||''}">
          </div>
          <div class="form-row">
            <div class="form-label">Descripción / notas</div>
            <textarea id="a-desc" placeholder="Descripción del alter, función en el sistema...">${a.description||''}</textarea>
          </div>
          <div class="alter-two-col">
            <div class="form-row"><div class="form-label">Flags / términos</div><input type="text" id="a-flags" placeholder="creador, introyección, ficticio..." value="${escC((a.identityFlags||[]).join(', '))}"><div style="font-size:10px;color:var(--text-3)">Etiquetas separadas por comas para el contexto de identidad</div></div>
            <div class="form-row"><div class="form-label">Términos personales</div><input type="text" id="a-terms" placeholder="Términos preferidos, lenguaje o límites" value="${escC(a.identityTerms||'')}"></div>
          </div>
          <div class="form-row"><div class="form-label">Identidades mencionadas</div><div style="display:flex;flex-wrap:wrap;gap:6px">${getAlters(true).filter(x=>x.id!==a.id).map(x=>`<label class="front-cofront-chip"><input type="checkbox" data-mention-id="${x.id}" ${(a.mentionedAlterIds||[]).includes(x.id)?'checked':''}> ${esc(x.emoji||'◎')} ${esc(x.name)}</label>`).join('') || '<span style="font-size:11px;color:var(--text-3)">Crea otro perfil para poder mencionarlo aquí.</span>'}</div><div style="font-size:10px;color:var(--text-3)">Referencias locales privadas; no se comparten online por defecto.</div></div>
          <div class="alter-two-col">
            <div class="form-row">
              <div class="form-label">Frecuencia de presencia</div>
              <select id="a-frecuencia">
                <option value="rara" ${(a.frecuencia||'ocasional')==='rara'?'selected':''}>○ Rara</option>
                <option value="ocasional" ${(a.frecuencia||'ocasional')==='ocasional'?'selected':''}>◑ Ocasional</option>
                <option value="frecuente" ${(a.frecuencia||'ocasional')==='frecuente'?'selected':''}>● Frecuente</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-label">Estado</div>
              <select id="a-state">
                ${ALTER_STATES.map(s=>`<option value="${s.id}" ${(a.state||'activo')===s.id?'selected':''}>${s.icon} ${s.label}</option>`).join('')}
              </select>
            </div>
          </div>
          ${activeAlter?.isAdmin ? `<div class="form-row">
            <div class="form-label">Subsistema</div>
            <select id="a-subsystem">
              <option value="">— Sin subsistema —</option>
              ${loadSubsystems().map(s=>`<option value="${s.id}" ${a.subsystemId===s.id?'selected':''}>${s.name}</option>`).join('')}
            </select>
          </div>` : ''}
          <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
            <div style="font-size:10px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Límites de memoria</div>
            <div class="form-row">
              <div class="form-label">¿Qué conoce del sistema?</div>
              <textarea id="a-memoria-conoce" rows="2" placeholder="Sabe sobre: otros alters, eventos, historia...">${escM(a.memoriaConoce||'')}</textarea>
            </div>
            <div class="form-row">
              <div class="form-label">¿Qué NO conoce?</div>
              <textarea id="a-memoria-no-conoce" rows="2" placeholder="No tiene acceso a: trauma X, alter Y, período Z...">${escM(a.memoriaNoConoce||'')}</textarea>
            </div>
          </div>
          ${activeAlter?.isAdmin ? `<div class="form-row" style="flex-direction:row;align-items:center;justify-content:space-between">
            <div>
              <div class="perm-toggle-label">Admin del sistema</div>
              <div class="perm-toggle-sublabel">${isOnlyAdmin?'Debe quedar al menos un admin del sistema':'Puede gestionar otros perfiles'}</div>
            </div>
            <div class="toggle-switch ${a.isAdmin?'on':''}" id="toggle-admin" data-admin-toggle="1" ${isOnlyAdmin?'data-locked-admin="1"':''}></div>
          </div>` : a.isAdmin ? `<div style="font-family:DM Mono,monospace;font-size:11px;color:var(--text-2);padding:6px 0">⚠ Este alter es el administrador principal del sistema</div>` : ''}
        </div>

        <!-- TAB APARIENCIA -->
        <div id="tab-apariencia" class="form-grid" style="margin-top:14px;display:none">

          <!-- AVATAR: emoji o imagen -->
          <div class="form-row">
            <div class="form-label">Avatar</div>
            <div class="avatar-mode-toggle">
              <div class="avatar-mode-btn${_avatarMode==='emoji'?' active':''}" id="avatar-mode-emoji">Emoji</div>
              <div class="avatar-mode-btn${_avatarMode==='img'?' active':''}" id="avatar-mode-img">Imagen</div>
            </div>
          </div>

          <div id="avatar-emoji-panel" style="${_avatarMode==='img'?'display:none':''}">
            <div id="emoji-cat-filter" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
              <button class="emoji-cat-btn active" data-cat="all" style="padding:2px 9px;border-radius:20px;border:1px solid rgba(160,138,255,.8);background:rgba(160,138,255,.2);color:var(--text-0);font-size:11px;cursor:pointer;transition:all .15s">Todos</button>
              <button class="emoji-cat-btn" data-cat="cos" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">🌌 Cosmos</button>
              <button class="emoji-cat-btn" data-cat="nat" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">🌿 Naturaleza</button>
              <button class="emoji-cat-btn" data-cat="ani" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">🐾 Animales</button>
              <button class="emoji-cat-btn" data-cat="mag" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">✨ Magia</button>
              <button class="emoji-cat-btn" data-cat="cor" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">❤️ Corazones</button>
              <button class="emoji-cat-btn" data-cat="pod" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">⚔️ Poder</button>
              <button class="emoji-cat-btn" data-cat="per" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">🧑 Personas</button>
              <button class="emoji-cat-btn" data-cat="obj" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">📚 Objetos</button>
              <button class="emoji-cat-btn" data-cat="mis" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">🌈 Misc</button>
            </div>
            <input type="text" id="emoji-search" placeholder="🔍 Buscar emoji..." autocomplete="off"
              style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:6px 8px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;color:var(--text-0);font-size:12px;outline:none">
            <div class="emoji-picker" id="emoji-picker">
              ${EMOJI_DATA.map(({e,t,c})=>`<div class="emoji-opt-btn ${(!_avatarImg && a.emoji===e)?'selected':''}" data-e="${e}" data-tags="${t}" data-cat="${c}">${e}</div>`).join('')}
            </div>
            <input type="hidden" id="a-emoji" value="${a.emoji||'🌙'}">
          </div>

          <div id="avatar-img-panel" style="${_avatarMode==='emoji'?'display:none':''}">
            <div class="avatar-upload-area" id="avatar-upload-area">
              <div id="avatar-img-preview" style="${_avatarImg?'':'display:none'}">
                <img id="avatar-img-el" src="${_avatarImg||''}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--border-active)">
                <button class="btn btn-ghost btn-sm" id="btn-remove-img" style="margin-top:6px;font-size:11px">✕ Quitar imagen</button>
              </div>
              <div id="avatar-img-placeholder" style="${_avatarImg?'display:none':''}">
                <div style="font-size:28px;margin-bottom:6px">📷</div>
                <div style="font-size:12px;color:var(--text-2)">Subir imagen de avatar</div>
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:3px">JPG, PNG, WEBP · máx. 2MB</div>
              </div>
              <input type="file" id="avatar-file-input" accept="image/*" style="display:none">
            </div>
            <input type="hidden" id="a-avatar-img" value="${_avatarImg||''}">
          </div>

          <div class="form-row">
            <div class="form-label">Color del alter</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px">
              ${ALTER_COLORS.map(c=>`<div class="color-swatch ${a.color===c?'selected':''}" data-color="${c}" style="background:${c}"></div>`).join('')}
              <label class="color-swatch${_isCustomColor?' selected':''}" id="custom-color-swatch" for="a-custom-color-input" title="Color personalizado"
                style="${_isCustomColor?`background:${a.color}`:'background:linear-gradient(135deg,#a08aff,#ff8ae2,#ffb450,#8affe0)'};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;line-height:1;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.7);cursor:pointer;border-color:rgba(255,255,255,0.25)">+</label>
            </div>
            <input type="color" id="a-custom-color-input" value="${a.color||'#a08aff'}" style="visibility:hidden;width:0;height:0;border:0;padding:0;margin:0;display:block">
            <input type="hidden" id="a-color" value="${a.color||'#a08aff'}">
            <div id="color-contrast-warn" style="display:none;font-size:11px;color:var(--accent-4);margin-top:4px">⚠ Contraste bajo con texto blanco (WCAG AA). Considera un color más oscuro.</div>
          </div>

          <div class="form-row">
            <div class="form-label">Banner de perfil</div>
            <div class="avatar-upload-area" id="banner-upload-area" style="height:72px;flex-direction:row;justify-content:center;${_bannerImg?`background-image:url(${_bannerImg});background-size:cover;background-position:center;border-color:var(--border-active)`:''}">
              ${_bannerImg
                ? `<button class="btn btn-ghost btn-sm" id="btn-remove-banner" style="font-size:11px;background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.2);color:#fff">✕ Quitar banner</button>`
                : `<div style="text-align:center"><div style="font-size:20px;margin-bottom:4px">🖼</div><div style="font-size:11px;color:var(--text-2)">Imagen de banner</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);margin-top:2px">Se muestra detrás del avatar en el perfil</div></div>`
              }
              <input type="file" id="banner-file-input" accept="image/*" style="display:none">
            </div>
            <input type="hidden" id="a-banner-img" value="${_bannerImg||''}">
          </div>
          <div class="form-row">
            <div class="form-label">Galería de imágenes</div>
            <div class="image-gallery-grid" id="alter-gallery-previews">${_galleryImgs.map((img,i)=>`<div class="image-gallery-item"><img src="${img}" alt=""><button type="button" class="btn btn-ghost btn-sm" data-remove-gallery="${i}">✕</button></div>`).join('')}</div>
            <label class="avatar-upload-area gallery-add-area" for="alter-gallery-input"><span style="font-size:20px">＋</span><span>Añadir imágenes</span><small>JPG, PNG o WEBP · máx. 8 MB cada una</small></label>
            <input type="file" id="alter-gallery-input" accept="image/jpeg,image/png,image/webp,image/gif" multiple style="display:none">
          </div>
          <div class="form-row">
            <div class="form-label">Imágenes de referencia</div>
            <textarea id="alter-reference-imgs" rows="3" placeholder="Un enlace por línea (faceclaims, referencias visuales...)" >${_referenceImgs.join('\n')}</textarea>
            <div style="font-size:10px;color:var(--text-3)">Solo se guardan los enlaces; no se descargan imágenes automáticamente.</div>
          </div>
        </div>

        <!-- TAB PERMISOS -->
        <div id="tab-permisos" style="margin-top:14px;display:none">
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-bottom:10px;letter-spacing:.1em;text-transform:uppercase">Nivel de intimidad</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:10px">Determina si este alter puede aparecer en comparticiones online futuras.</div>
          <div id="intimacy-selector" style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
            ${INTIMACY_LEVELS.map(lvl=>`
              <div class="intimacy-opt${(a.intimacyLevel||'interno')===lvl.id?' selected':''}" data-level="${lvl.id}" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-md);border:1px solid ${(a.intimacyLevel||'interno')===lvl.id?lvl.color+'88':'var(--border)'};background:${(a.intimacyLevel||'interno')===lvl.id?lvl.color+'11':'transparent'};cursor:pointer;transition:border-color .15s,background .15s">
                <span style="font-size:15px;flex-shrink:0">${lvl.icon}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600;color:${(a.intimacyLevel||'interno')===lvl.id?lvl.color:'var(--text-1)'}">${lvl.label}</div>
                  <div style="font-size:10px;color:var(--text-3)">${lvl.desc}</div>
                </div>
                <div class="intimacy-radio" style="width:14px;height:14px;border-radius:50%;border:2px solid ${(a.intimacyLevel||'interno')===lvl.id?lvl.color:'var(--border)'};background:${(a.intimacyLevel||'interno')===lvl.id?lvl.color:'transparent'};flex-shrink:0;transition:all .15s"></div>
              </div>`).join('')}
          </div>
          <input type="hidden" id="a-intimacy-level" value="${a.intimacyLevel||'interno'}">
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-bottom:12px;letter-spacing:.1em;text-transform:uppercase">Acceso por módulo</div>
          ${MODULES_PERMS.map(m=>`
            <div class="perm-toggle-row">
              <div>
                <div class="perm-toggle-label">${m.label}</div>
                <div class="perm-toggle-sublabel">${m.desc}</div>
              </div>
              <div class="toggle-switch ${a.permissions?.[m.id]?'on':''}" id="perm-${m.id}" data-perm="${m.id}"></div>
            </div>`).join('')}
          <div id="perm-summary" style="margin-top:16px;padding:12px 14px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-md)">
            <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Resumen de visibilidad</div>
            <div id="perm-summary-content" style="display:flex;flex-wrap:wrap;gap:6px">
              ${MODULES_PERMS.map(m=>`<span class="perm-chip ${a.permissions?.[m.id]?'on':'off'}" id="perm-chip-${m.id}">${a.permissions?.[m.id]?'✓':'✕'} ${m.label}</span>`).join('')}
            </div>
          </div>
        </div>

        ${isEdit ? `<div id="tab-media" style="margin-top:14px;display:none"><div class="media-tracking-list" id="media-tracking-list"></div><button type="button" class="btn btn-ghost btn-sm" id="btn-add-media">+ Añadir contenido</button></div>` : ''}

        <!-- TAB RELACIONES -->
        ${isEdit ? `<div id="tab-relaciones" style="margin-top:14px;display:none">
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-bottom:12px;letter-spacing:.1em;text-transform:uppercase">Vínculos con otros alters</div>
          <div id="relations-list" style="display:flex;flex-direction:column;gap:8px">
            ${(a.relationships||[]).map(rel => {
              const rt = RELATION_TYPES.find(t=>t.id===rel.type)||RELATION_TYPES[RELATION_TYPES.length-1];
              const relLabel = (rel.customLabel||rel.label||'').trim() || rt.label;
              const relTitle = relLabel === rt.label ? rt.label : `${relLabel} (${rt.label})`;
              const ta = getAlters().find(x=>x.id===rel.targetId);
              if (!ta) return '';
              return `<div class="perm-toggle-row" data-rel-id="${rel.id}" style="gap:8px;align-items:flex-start">
                <span style="font-size:16px;flex-shrink:0">${ta.emoji||'●'}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:600;color:var(--text-1)">${escM(ta.name)}</div>
                  <div><span class="perm-chip on" title="${escM(relTitle)}" style="background:${rt.color}22;border-color:${rt.color};color:${rt.color}">${escM(relLabel)}</span></div>
                  ${rel.note?`<div style="font-size:11px;color:var(--text-3);margin-top:3px">${escM(rel.note)}</div>`:''}
                </div>
                <button class="icon-btn btn-del-rel" data-rel-id="${rel.id}" title="Eliminar">✕</button>
              </div>`;
            }).join('')}
          </div>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--border);padding-top:12px">
            <div style="font-size:11px;color:var(--text-3);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em">Añadir vínculo</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
              <select id="rel-target" style="flex:1;min-width:100px">
                <option value="">Alter…</option>
                ${getAlters().filter(x=>x.id!==a.id).map(x=>`<option value="${x.id}">${x.emoji||''} ${escM(x.name)}</option>`).join('')}
              </select>
              <select id="rel-type" style="flex:1;min-width:100px">
                ${RELATION_TYPES.map(t=>`<option value="${t.id}">${t.label}</option>`).join('')}
              </select>
              <input type="text" id="rel-label" maxlength="40" placeholder="Nombre del vinculo (opcional)" style="flex:1.5;min-width:150px">
              <input type="text" id="rel-note" placeholder="Nota (opcional)" style="flex:2;min-width:120px">
              <button class="btn btn-primary btn-sm" id="btn-add-rel">Añadir</button>
            </div>
          </div>
        </div>` : ''}
      </div>
    </div>
    </div>

    <!-- TAB EXTRAS -->
        ${isEdit?`<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px">
          <div class="form-row">
            <div class="form-label">Archivar alter</div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:12px;color:var(--text-2)">Oculta al alter sin borrar sus datos</div>
              </div>
              <div class="toggle-switch ${a.isArchived?'on':''}" id="toggle-archive"></div>
            </div>
            ${a.isArchived?`<div class="form-row" style="margin-top:8px">
              <div class="form-label">Motivo del archivo</div>
              <input type="text" id="archive-reason" placeholder="Opcional..." value="${a.archiveReason||''}">
            </div>`:''}
          </div>
        </div>`:''}

    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar cambios':'Crear alter'}</button>
    </div>`;

  openModal(modalHTML, (overlay) => {
    const name     = overlay.querySelector('#a-name').value.trim();
    const pronouns = overlay.querySelector('#a-pronouns').value;
    const ageType  = overlay.querySelector('#a-agetype').value;
    const roleType = overlay.querySelector('#a-roletype').value;
    const role     = overlay.querySelector('#a-role').value.trim();
    const desc     = overlay.querySelector('#a-desc').value.trim();
    const identityFlags = overlay.querySelector('#a-flags')?.value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,20) || [];
    const identityTerms = overlay.querySelector('#a-terms')?.value.trim() || '';
    const mentionedAlterIds = [...overlay.querySelectorAll('[data-mention-id]:checked')].map(x=>x.dataset.mentionId);
    const emoji    = overlay.querySelector('#a-emoji').value;
    const color    = overlay.querySelector('#a-color').value;
    const avatarImg = overlay.querySelector('#a-avatar-img').value || null;
      const bannerImg = overlay.querySelector('#a-banner-img').value || null;
    let isAdminVal = activeAlter?.isAdmin
      ? (overlay.querySelector('#toggle-admin')?.classList.contains('on') || false)
      : (a.isAdmin || false); // no-admin no puede cambiar esto
    if (a.isAdmin && !isAdminVal && adminCount <= 1) {
      showToast('Aviso: Debe quedar al menos un admin del sistema');
      isAdminVal = true;
    }
    let permissions = {};
    if (activeAlter?.isAdmin) {
      MODULES_PERMS.forEach(m => {
        permissions[m.id] = overlay.querySelector(`#perm-${m.id}`)?.classList.contains('on') || false;
      });
    } else {
      // conservar permisos existentes
      MODULES_PERMS.forEach(m => { permissions[m.id] = a.permissions?.[m.id] ?? true; });
    }
    if (isAdminVal) permissions = buildFullPermissions();
    if(!name) return showToast('⚠ El nombre es obligatorio');

    const hex = color.replace('#','');
    const r=parseInt(hex.substring(0,2),16),g=parseInt(hex.substring(2,4),16),b=parseInt(hex.substring(4,6),16);
    const bg = `rgba(${r},${g},${b},0.12)`;
    const displayRole = role || getAllRoleTypes().find(x=>x.id===roleType)?.label || roleType;

    let list = getAlters(true);
    // Custom fields ahora solo en fichas
    const isArchivedToggle = overlay.querySelector('#toggle-archive');
    const isArchived = isArchivedToggle ? isArchivedToggle.classList.contains('on') : (alter?.isArchived||false);
    const archiveReason = overlay.querySelector('#archive-reason')?.value.trim()||alter?.archiveReason||'';

    const frecuencia     = overlay.querySelector('#a-frecuencia')?.value || 'ocasional';
    const state          = overlay.querySelector('#a-state')?.value || 'activo';
    const subsystemId    = overlay.querySelector('#a-subsystem')?.value || null;
    const memoriaConoce   = overlay.querySelector('#a-memoria-conoce')?.value.trim() || '';
    const memoriaNoConoce = overlay.querySelector('#a-memoria-no-conoce')?.value.trim() || '';
    const relationships = (() => { try { return JSON.parse(overlay.querySelector('#a-relations-data')?.value||'[]'); } catch{return alter?.relationships||[];} })();
    const intimacyLevel  = overlay.querySelector('#a-intimacy-level')?.value || 'interno';
    const entry = normalizeAlterPermissions({
      ...(isEdit ? alter : {id:uid(), createdAt:Date.now()}),
      name, pronouns, ageType, roleType,
      role: displayRole, description: desc,
      identityFlags, identityTerms, mentionedAlterIds,
      emoji, color, bg, avatarImg, bannerImg, galleryImgs: _galleryImgs, referenceImgs: (overlay.querySelector('#alter-reference-imgs')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,20), isAdmin: isAdminVal, permissions,
      isArchived, archiveReason, frecuencia, state, subsystemId: subsystemId||null, mediaTracking: _mediaTracking,
      memoriaConoce, memoriaNoConoce, relationships, intimacyLevel
    });
    if(isEdit) {
      list = list.map(x => x.id===alter.id ? entry : x);
      if(activeAlter?.id===alter.id) {
        activeAlter = entry;
        const sbAv = document.getElementById('sb-avatar');
        if(sbAv) {
          if(avatarImg) {
            sbAv.innerHTML = `<img src="${avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
          } else {
            sbAv.textContent = emoji;
          }
          sbAv.style.cssText = `background:${bg};border-color:${color}`;
        }
        const sbName = document.getElementById('sb-name');
        const sbRole = document.getElementById('sb-role');
        if(sbName) sbName.textContent = name;
        if(sbRole) sbRole.textContent = displayRole;
      }
    } else {
      list.push(entry);
    }
    saveAlters(list);
    ALTERS = list;
    closeModal();
    showToast(isEdit?`Perfil de ${name} actualizado ✓`:`${name} añadido al sistema ✓`);
    renderSidebarNav();
    if(onDone) onDone(); else renderLayer0();
  }, 'alter-modal-wide');

  const ov = document.querySelector('.modal-overlay');

  // Tab switching
  ov.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      ov.querySelectorAll('.type-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      ['basic','apariencia','permisos','relaciones','media'].forEach(id => {
        const el = ov.querySelector(`#tab-${id}`);
        if(el) el.style.display = id===tab.dataset.tab ? '' : 'none';
      });
    });
  });
// Role type selection
  const _wireRoleTypeOpts = () => {
    ov.querySelectorAll('.role-type-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        if (opt.dataset.rt === '__manage_custom__') return;
        if (opt.dataset.rt === '__new_custom__') {
          // Solicitar nuevo tipo personalizado
          openModal(`
            <div class="modal-title">Tipo de rol personalizado</div>
            <div class="form-grid">
              <div class="form-row">
                <div class="form-label">Nombre del tipo</div>
                <input type="text" id="custom-role-inp" class="form-input" placeholder="Ej: Persónaje ficticio, Guía interno...">
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" data-cancel>Cancelar</button>
              <button class="btn btn-primary" data-submit>Crear</button>
            </div>`,
            (innerOv) => {
              const val = innerOv.querySelector('#custom-role-inp').value.trim();
              if (!val) return;
              const customs = loadCustomRoleTypes();
              if (!customs.includes(val)) { customs.push(val); saveCustomRoleTypes(customs); }
              const newId = 'custom_' + val;
              // Regenerar grid
              const grid = ov.querySelector('#role-type-grid');
              grid.innerHTML = getAllRoleTypes().map(r=>`
                <div class="role-type-opt${r.id===newId?' selected':''}" data-rt="${r.id}" ${r.custom?'data-custom="1"':''}>
                  <div class="rt-emoji">${r.emoji}</div>
                  <div class="rt-label">${r.label}</div>
                </div>`).join('') +
                `<div class="role-type-opt" data-rt="__new_custom__" id="btn-add-custom-role" title="Añadir tipo personalizado">
                  <div class="rt-emoji">+</div>
                  <div class="rt-label" style="font-size:9px">Personalizado</div>
                </div><div class="role-type-opt" data-rt="__manage_custom__" id="btn-manage-custom-role"><div class="rt-emoji">☷</div><div class="rt-label" style="font-size:9px">Gestionar</div></div>`;
              ov.querySelector('#a-roletype').value = newId;
              ov.querySelector('#a-role').value = val;
              _wireRoleTypeOpts();
              updatePreview(ov);
            }
          );
          return;
        }
        ov.querySelectorAll('.role-type-opt').forEach(o=>o.classList.remove('selected'));
        opt.classList.add('selected');
        ov.querySelector('#a-roletype').value = opt.dataset.rt;
        const inp = ov.querySelector('#a-role');
        if(!inp.value) inp.value = getAllRoleTypes().find(r=>r.id===opt.dataset.rt)?.label||'';
        updatePreview(ov);
      });
    });
    ov.querySelector('#btn-manage-custom-role')?.addEventListener('click', () => {
      const value = prompt('Tipos de rol personalizados, en orden (separados por comas). Quita un nombre para borrarlo:', loadCustomRoleTypes().join(', '));
      if (value === null) return;
      const next = [...new Set(value.split(',').map(x=>x.trim()).filter(Boolean))].slice(0, 30);
      saveCustomRoleTypes(next);
      const grid = ov.querySelector('#role-type-grid');
      const selected = ov.querySelector('#a-roletype').value;
      grid.innerHTML = getAllRoleTypes().map(r=>`<div class="role-type-opt${r.id===selected?' selected':''}" data-rt="${r.id}" ${r.custom?'data-custom="1"':''}><div class="rt-emoji">${r.emoji}</div><div class="rt-label">${esc(r.label)}</div></div>`).join('') + '<div class="role-type-opt" data-rt="__new_custom__" id="btn-add-custom-role"><div class="rt-emoji">+</div><div class="rt-label">Personalizado</div></div><div class="role-type-opt" data-rt="__manage_custom__" id="btn-manage-custom-role"><div class="rt-emoji">☷</div><div class="rt-label">Gestionar</div></div>';
      _wireRoleTypeOpts();
      showToast('Roles personalizados actualizados ✓');
    });
  };
  _wireRoleTypeOpts();

  // Emoji picker
  ov.querySelectorAll('.emoji-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ov.querySelectorAll('.emoji-opt-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      ov.querySelector('#a-emoji').value = btn.dataset.e;
      ov.querySelector('#a-avatar-img').value = '';
      updatePreview(ov);
    });
  });
  let _emojiCat = 'all';
  const _filterEmojis = () => {
    const q = ov.querySelector('#emoji-search')?.value.toLowerCase().trim() || '';
    ov.querySelectorAll('.emoji-opt-btn').forEach(btn => {
      const tagMatch = !q || btn.dataset.tags?.includes(q) || btn.dataset.e === q;
      const catMatch = _emojiCat === 'all' || btn.dataset.cat === _emojiCat;
      btn.style.display = (tagMatch && catMatch) ? '' : 'none';
    });
  };
  ov.querySelectorAll('.emoji-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ov.querySelectorAll('.emoji-cat-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.borderColor = 'var(--border)';
        b.style.color = 'var(--text-2)';
      });
      btn.classList.add('active');
      btn.style.background = 'rgba(160,138,255,.2)';
      btn.style.borderColor = 'rgba(160,138,255,.8)';
      btn.style.color = 'var(--text-0)';
      _emojiCat = btn.dataset.cat;
      _filterEmojis();
    });
  });
  ov.querySelector('#emoji-search')?.addEventListener('input', _filterEmojis);

  // Color swatches
  ov.querySelectorAll('.color-swatch:not(#custom-color-swatch)').forEach(sw => {
    sw.addEventListener('click', () => {
      ov.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));
      sw.classList.add('selected');
      ov.querySelector('#a-color').value = sw.dataset.color;
      updatePreview(ov);
    });
  });
  ov.querySelector('#a-custom-color-input')?.addEventListener('input', e => {
    const hex = e.target.value;
    const sw = ov.querySelector('#custom-color-swatch');
    sw.style.background = hex;
    sw.style.borderColor = 'white';
    sw.textContent = '';
    ov.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));
    sw.classList.add('selected');
    ov.querySelector('#a-color').value = hex;
    updatePreview(ov);
    // WCAG AA contrast check vs white text
    const warn = ov.querySelector('#color-contrast-warn');
    if (warn) warn.style.display = wcagContrastRatio(hex, '#ffffff') < 4.5 ? '' : 'none';
  });

  // Avatar mode toggle
  ov.querySelector('#avatar-mode-emoji')?.addEventListener('click', () => {
    ov.querySelector('#avatar-mode-emoji').classList.add('active');
    ov.querySelector('#avatar-mode-img').classList.remove('active');
    ov.querySelector('#avatar-emoji-panel').style.display = '';
    ov.querySelector('#avatar-img-panel').style.display = 'none';
  });
  ov.querySelector('#avatar-mode-img')?.addEventListener('click', () => {
    ov.querySelector('#avatar-mode-img').classList.add('active');
    ov.querySelector('#avatar-mode-emoji').classList.remove('active');
    ov.querySelector('#avatar-img-panel').style.display = '';
    ov.querySelector('#avatar-emoji-panel').style.display = 'none';
  });

  // Upload area click → trigger file input
  ov.querySelector('#avatar-upload-area')?.addEventListener('click', (e) => {
    if(e.target.id === 'btn-remove-img') return;
    ov.querySelector('#avatar-file-input').click();
  });

  // File input change → compress with canvas and store as base64
  ov.querySelector('#avatar-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const err = validateImageFile(file, 8);
    if(err) { showToast('⚠ ' + err); e.target.value = ''; return; }
    compressImageForStorage(file, 384, 384, 0.86, 520).then(b64 => {
      showImageCompressedToast(file, b64, 'Avatar');
      ov.querySelector('#a-avatar-img').value = b64;
      const imgEl = ov.querySelector('#avatar-img-el');
      if(imgEl) imgEl.src = b64;
      ov.querySelector('#avatar-img-preview').style.display = '';
      ov.querySelector('#avatar-img-placeholder').style.display = 'none';
      updatePreview(ov);
    }).catch(() => showToast('⚠ No se pudo procesar la imagen'));
  });

  // Remove avatar image
  ov.querySelector('#btn-remove-img')?.addEventListener('click', (e) => {
    e.stopPropagation();
    ov.querySelector('#a-avatar-img').value = '';
    ov.querySelector('#avatar-img-el').src = '';
    ov.querySelector('#avatar-img-preview').style.display = 'none';
    ov.querySelector('#avatar-img-placeholder').style.display = '';
    updatePreview(ov);
  });

  // Banner upload
  ov.querySelector('#banner-upload-area')?.addEventListener('click', (e) => {
    if(e.target.id === 'btn-remove-banner') return;
    ov.querySelector('#banner-file-input').click();
  });
  ov.querySelector('#banner-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const err = validateImageFile(file, 12);
    if(err) { showToast('⚠ ' + err); e.target.value = ''; return; }
    compressImageForStorage(file, 1000, 320, 0.82, 780).then(b64 => {
      showImageCompressedToast(file, b64, 'Banner');
      _bannerImg = b64;
      ov.querySelector('#a-banner-img').value = b64;
      const area = ov.querySelector('#banner-upload-area');
      area.style.backgroundImage = `url(${b64})`;
      area.style.backgroundSize = 'cover';
      area.style.backgroundPosition = 'center';
      area.style.borderColor = 'var(--border-active)';
      area.innerHTML = `<button class="btn btn-ghost btn-sm" id="btn-remove-banner" style="font-size:11px;background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.2);color:#fff">✕ Quitar banner</button><input type="file" id="banner-file-input" accept="image/*" style="display:none">`;
      ov.querySelector('#banner-file-input')?.addEventListener('change', (ev) => {
        const f2 = ev.target.files[0]; if(!f2) return;
        compressImageForStorage(f2, 1000, 320, 0.82, 780).then(b => {
          showImageCompressedToast(f2, b, 'Banner');
          _bannerImg = b; ov.querySelector('#a-banner-img').value = b;
          area.style.backgroundImage = `url(${b})`;
        }).catch(() => showToast('⚠ No se pudo procesar la imagen'));
      });
      ov.querySelector('#btn-remove-banner')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        _bannerImg = null;
  ov.querySelector('#a-banner-img').value = '';
        area.style.backgroundImage = ''; area.style.backgroundSize = ''; area.style.backgroundPosition = ''; area.style.borderColor = '';
        area.innerHTML = `<div style="text-align:center"><div style="font-size:20px;margin-bottom:4px">🖼</div><div style="font-size:11px;color:var(--text-2)">Imagen de banner</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);margin-top:2px">Se muestra detrás del avatar en el perfil</div></div><input type="file" id="banner-file-input" accept="image/*" style="display:none">`;
      });
    }).catch(() => showToast('⚠ No se pudo procesar la imagen'));
  });

  // Toggle switches
  const refreshGallery = () => { const host=ov.querySelector('#alter-gallery-previews'); if(host) host.innerHTML=_galleryImgs.map((img,i)=>`<div class="image-gallery-item"><img src="${img}" alt=""><button type="button" class="btn btn-ghost btn-sm" data-remove-gallery="${i}">✕</button></div>`).join(''); host?.querySelectorAll('[data-remove-gallery]').forEach(btn=>btn.addEventListener('click',()=>{_galleryImgs.splice(+btn.dataset.removeGallery,1);refreshGallery();})); };
  ov.querySelector('#alter-gallery-input')?.addEventListener('change', async e=>{ for(const file of [...e.target.files].slice(0,8-_galleryImgs.length)){const err=validateImageFile(file,8);if(err){showToast('⚠ '+err);continue;}try{const b64=await compressImageForStorage(file,800,800,.82,520);_galleryImgs.push(b64);showImageCompressedToast(file,b64,'Galería');}catch{showToast('⚠ No se pudo procesar la imagen');}} e.target.value='';refreshGallery(); });
  refreshGallery();
  const renderMediaTracking = () => { const host=ov.querySelector('#media-tracking-list'); if(!host)return; host.innerHTML=_mediaTracking.map((item,i)=>`<div class="media-tracking-row"><input data-media-field="title" data-media-index="${i}" value="${escC(item.title||'')}" placeholder="Título"><select data-media-field="type" data-media-index="${i}"><option ${item.type==='Libro'?'selected':''}>Libro</option><option ${item.type==='Serie'?'selected':''}>Serie</option><option ${item.type==='Película'?'selected':''}>Película</option><option ${item.type==='Juego'?'selected':''}>Juego</option><option ${item.type==='Otro'?'selected':''}>Otro</option></select><select data-media-field="status" data-media-index="${i}"><option ${item.status==='Pendiente'?'selected':''}>Pendiente</option><option ${item.status==='En curso'?'selected':''}>En curso</option><option ${item.status==='Completado'?'selected':''}>Completado</option><option ${item.status==='Abandonado'?'selected':''}>Abandonado</option></select><input data-media-field="progress" data-media-index="${i}" type="number" min="0" max="100" value="${Number(item.progress)||0}" aria-label="Progreso (%)"><button type="button" class="btn btn-ghost btn-sm" data-remove-media="${i}">✕</button></div>`).join('') || '<div style="font-size:11px;color:var(--text-3);margin-bottom:8px">Aún no hay contenido registrado.</div>'; host.querySelectorAll('[data-media-field]').forEach(input=>input.addEventListener('input',()=>{_mediaTracking[+input.dataset.mediaIndex][input.dataset.mediaField]=input.type==='number'?Math.max(0,Math.min(100,Number(input.value)||0)):input.value;})); host.querySelectorAll('[data-remove-media]').forEach(btn=>btn.addEventListener('click',()=>{_mediaTracking.splice(+btn.dataset.removeMedia,1);renderMediaTracking();})); };
  ov.querySelector('#btn-add-media')?.addEventListener('click',()=>{_mediaTracking.push({id:uid(),title:'',type:'Otro',status:'Pendiente',progress:0});renderMediaTracking();});
  renderMediaTracking();
  ov.querySelectorAll('.toggle-switch').forEach(sw => {
    sw.addEventListener('click', () => {
      if (sw.dataset.lockedAdmin === '1' && sw.classList.contains('on')) {
        showToast('Aviso: Debe quedar al menos un admin del sistema');
        return;
      }
      sw.classList.toggle('on');
      // Actualizar chip del resumen de visibilidad si es un perm toggle
      const permId = sw.dataset.perm;
      if (permId) {
        const chip = ov.querySelector(`#perm-chip-${permId}`);
        if (chip) {
          const isOn = sw.classList.contains('on');
          chip.className = `perm-chip ${isOn ? 'on' : 'off'}`;
          chip.textContent = `${isOn ? '✓' : '✕'} ${MODULES_PERMS.find(m=>m.id===permId)?.label||permId}`;
        }
      }
    });
  });

  // Intimacy selector wiring
  ov.querySelectorAll('.intimacy-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const lvlId = opt.dataset.level;
      const lvl = INTIMACY_LEVELS.find(l=>l.id===lvlId);
      if (!lvl) return;
      ov.querySelector('#a-intimacy-level').value = lvlId;
      ov.querySelectorAll('.intimacy-opt').forEach(o => {
        const ol = INTIMACY_LEVELS.find(l=>l.id===o.dataset.level);
        const sel = o.dataset.level === lvlId;
        o.style.borderColor = sel ? ol.color+'88' : 'var(--border)';
        o.style.background  = sel ? ol.color+'11' : 'transparent';
        o.querySelector('div > div:first-child').style.color = sel ? ol.color : 'var(--text-1)';
        o.querySelector('.intimacy-radio').style.borderColor  = sel ? ol.color : 'var(--border)';
        o.querySelector('.intimacy-radio').style.background   = sel ? ol.color : 'transparent';
      });
    });
  });

  // Relations wiring
  function renderRelList() {
    const list = ov.querySelector('#relations-list');
    if (!list) return;
    const alts = getAlters();
    const rels = (JSON.parse(ov.querySelector('#a-relations-data')?.value||'[]'));
    list.innerHTML = rels.map(rel => {
      const rt = RELATION_TYPES.find(t=>t.id===rel.type)||RELATION_TYPES[RELATION_TYPES.length-1];
      const relLabel = (rel.customLabel||rel.label||'').trim() || rt.label;
      const relTitle = relLabel === rt.label ? rt.label : `${relLabel} (${rt.label})`;
      const ta = alts.find(x=>x.id===rel.targetId);
      if (!ta) return '';
      return `<div class="perm-toggle-row" data-rel-id="${rel.id}" style="gap:8px;align-items:flex-start">
        <span style="font-size:16px;flex-shrink:0">${ta.emoji||'●'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text-1)">${escM(ta.name)}</div>
          <div><span class="perm-chip on" title="${escM(relTitle)}" style="background:${rt.color}22;border-color:${rt.color};color:${rt.color}">${escM(relLabel)}</span></div>
          ${rel.note?`<div style="font-size:11px;color:var(--text-3);margin-top:3px">${escM(rel.note)}</div>`:''}
        </div>
        <button class="icon-btn btn-del-rel" data-rel-id="${rel.id}" title="Eliminar">✕</button>
      </div>`;
    }).join('');
    list.querySelectorAll('.btn-del-rel').forEach(btn => {
      btn.addEventListener('click', () => {
        const cur = JSON.parse(ov.querySelector('#a-relations-data').value||'[]');
        ov.querySelector('#a-relations-data').value = JSON.stringify(cur.filter(r=>r.id!==btn.dataset.relId));
        renderRelList();
      });
    });
  }
  // Hidden field to carry relationships through the save callback
  if (!ov.querySelector('#a-relations-data')) {
    const hid = document.createElement('input'); hid.type='hidden'; hid.id='a-relations-data';
    hid.value = JSON.stringify(a.relationships||[]);
    ov.querySelector('.alter-modal-form').appendChild(hid);
  }
  renderRelList();
  ov.querySelector('#btn-add-rel')?.addEventListener('click', () => {
    const targetId = ov.querySelector('#rel-target').value;
    const type     = ov.querySelector('#rel-type').value;
    const customLabel = ov.querySelector('#rel-label')?.value.trim() || '';
    const note     = ov.querySelector('#rel-note').value.trim();
    if (!targetId) { showToast('⚠ Elige un alter'); return; }
    const cur = JSON.parse(ov.querySelector('#a-relations-data').value||'[]');
    if (cur.find(r=>r.targetId===targetId)) { showToast('⚠ Ya existe un vínculo con ese alter'); return; }
    cur.push({id:uid(), targetId, type, customLabel, note});
    ov.querySelector('#a-relations-data').value = JSON.stringify(cur);
    ov.querySelector('#rel-target').value = '';
    const labelInput = ov.querySelector('#rel-label');
    if (labelInput) labelInput.value = '';
    ov.querySelector('#rel-note').value = '';
    renderRelList();
  });

  // Live preview
  ov.querySelector('#a-name')?.addEventListener('input', () => updatePreview(ov));
  ov.querySelector('#a-role')?.addEventListener('input', () => updatePreview(ov));
}

function updatePreview(ov) {
  const name   = ov.querySelector('#a-name')?.value || 'Nombre';
  const role   = ov.querySelector('#a-role')?.value || ov.querySelector('#a-roletype')?.value || 'Rol';
  const emoji  = ov.querySelector('#a-emoji')?.value || '🌙';
  const color  = ov.querySelector('#a-color')?.value || '#a08aff';
  const imgSrc = ov.querySelector('#a-avatar-img')?.value || '';
  const hex    = color.replace('#','');
  const r=parseInt(hex.substring(0,2),16),g=parseInt(hex.substring(2,4),16),b=parseInt(hex.substring(4,6),16);
  const bg = `rgba(${r},${g},${b},0.12)`;

  const av = ov.querySelector('#preview-avatar');
  if(av) {
    av.style.cssText = `border-color:${color};background:${bg}`;
    if(imgSrc) {
      av.innerHTML = `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      av.innerHTML = `<span style="font-size:32px">${emoji}</span>`;
    }
  }
  const pname = ov.querySelector('#preview-name');
  const prole = ov.querySelector('#preview-role');
  if(pname) pname.textContent = name;
  if(prole) { prole.textContent = role; prole.style.color = color; }
}



// ═══════════════════════════════════════════════
// IMPORTAR DESDE OTRO SISTEMA (Simply Plural / PluralKit)
// ═══════════════════════════════════════════════

function _detectarFormatoImport(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.aef_version) return 'aef';
  if (data.frontHistory || (Array.isArray(data.members) && data.members[0]?._id)) return 'simply';
  if (data.switches || (Array.isArray(data.members) && data.members[0]?.proxy_tags !== undefined)) return 'pluralkit';
  if (Array.isArray(data.members) && data.members.length > 0) return 'simply';
  return null;
}

function _spPronombres(raw) {
  if (!raw) return 'elle';
  const trimmed = raw.trim();
  // If it already matches a known value exactly, keep it as-is
  const known = ['ella','él','ele','elle','ellos','elles','ninguno'];
  if (known.includes(trimmed.toLowerCase())) return trimmed.toLowerCase();
  const s = trimmed.toLowerCase().replace(/[/|,\s]+/g, ' ').trim();
  if (/\bella\b/.test(s) || /\bshe\b/.test(s)) return 'ella';
  if (/\bél\b/.test(s) || /^el\b/.test(s) || /\bhe\b/.test(s)) return 'él';
  if (/\belles\b/.test(s)) return 'elles';
  if (/\bellos\b/.test(s)) return 'ellos';
  if (/\belle\b/.test(s) || /\bthey\b/.test(s)) return 'elle';
  if (/ninguno|none|no\s+pronoun/.test(s)) return 'ninguno';
  const first = trimmed.split(/[/|, ]/)[0].trim().toLowerCase();
  if (known.includes(first)) return first;
  // Preserve unrecognised custom neopronouns as-is instead of defaulting to 'elle'
  return trimmed;
}

function _spRolType(roleText) {
  if (!roleText) return 'otro';
  const s = roleText.toLowerCase();
  if (/anfitrion|anfitrión|host/.test(s)) return 'anfitrion';
  if (/protector|defender/.test(s)) return 'protector';
  if (/guardian|guardián|gatekeeper|keeper/.test(s)) return 'guardian';
  if (/niñ|nino|niño|child|little|kiddo|pequeñ/.test(s)) return 'nino';
  if (/perseguidor|persecutor/.test(s)) return 'perseguidor';
  if (/fragmento|fragment|shard/.test(s)) return 'fragmento';
  return 'otro';
}

function _spAgeType(edadRaw) {
  const n = parseInt(edadRaw);
  if (!n) return 'adulto';
  if (n <= 3)  return 'bebe';
  if (n <= 12) return 'nino';
  if (n <= 17) return 'adolescente';
  return 'adulto';
}

function _mkColorBg(hexInput) {
  const hex = (hexInput || '').replace('#', '');
  const r = parseInt(hex.slice(0,2), 16) || 160;
  const g = parseInt(hex.slice(2,4), 16) || 138;
  const b = parseInt(hex.slice(4,6), 16) || 255;
  return { color: `#${hex}`, bg: `rgba(${r},${g},${b},0.12)` };
}

const _IMPORT_COLORS = ['#a08aff','#ff8ab4','#8ae4ff','#8affa0','#ffd98a','#ff8a8a','#c08aff','#8affea','#ffb38a','#aaffdb'];
const _IMPORT_EMOJIS = ['🌙','⭐','🌸','🌊','🔥','🌿','💜','✨','🦋','🌺'];

function _mkAlterBase(id, i) {
  return {
    id, createdAt: Date.now(),
    name: '', pronouns: 'elle',
    emoji: _IMPORT_EMOJIS[i % _IMPORT_EMOJIS.length],
    roleType: 'otro', role: '', description: '',
    color: _IMPORT_COLORS[i % _IMPORT_COLORS.length], bg: '',
    avatarImg: null, bannerImg: null,
    ageType: 'adulto', isAdmin: false,
    permissions: { finanzas:true, emociones:true, diario:true, comunicacion:true, agenda:true, proyectos:true, normas:true, wishlist:true },
    memoriaConoce: '', memoriaNoConoce: '',
    frecuencia: 'ocasional', state: 'activo',
    intimacyLevel: 'interno',
    relationships: [], subsystemId: null,
    isArchived: false, archiveReason: ''
  };
}

// ── Simply Plural ─────────────────────────────
function importarSimply(data) {
  const resultado = { alters:0, fronting:0, canales:0, triggers:0, advertencias:[] };

  const cfMap = {};
  (data.customFields || []).forEach(cf => { cfMap[cf._id] = cf.name; });

  // Patrones para clasificar campos custom
  const CF_MEMORY  = /notas?|notes?|memoria|memory|conoce|knows?|info\s+adicional|additional/i;
  const CF_TRIGGER = /triggers?|gatillo|limitaci|no\s+(sabe|conoce)|not\s+know/i;

  const idToAtria = {};
  const triggersPendientes = []; // { alterId, textos[] }

  const altersNuevos = (data.members || []).map((m, i) => {
    const id = uid();
    idToAtria[m._id] = id;

    // Color (descartar negro/blanco puros)
    const rawColor = m.color && !/^#?0{6}$/i.test(m.color) && !/^#?[fF]{6}$/.test(m.color)
      ? (m.color.startsWith('#') ? m.color : '#' + m.color)
      : _IMPORT_COLORS[i % _IMPORT_COLORS.length];
    const { color, bg } = _mkColorBg(rawColor);

    // Descripción base: limpiar decoraciones de Simply
    const descBase = (m.desc || '')
      .replace(/╭[^╮]*╮/g, '')
      .replace(/⧉-[^⟤]*⟤-\s*\[[^\]]*\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Clasificar campos custom en sus campos correspondientes
    const info = m.info || {};
    let ageRaw = null, roleRaw = '';
    const descLines = [], memoriaLines = [], triggerTextos = [];

    Object.entries(info).forEach(([cfId, val]) => {
      if (!val) return;
      const nombre = cfMap[cfId] || cfId;
      const nl = nombre.toLowerCase().trim();
      if (/^(age|edad)$/i.test(nl))              { ageRaw = val; return; }
      if (/^(system\s*role|rol(e)?)$/i.test(nl)) { roleRaw = val; return; }
      if (CF_TRIGGER.test(nl)) { triggerTextos.push(...val.split('\n').map(s=>s.trim()).filter(Boolean)); return; }
      if (CF_MEMORY.test(nl))  { memoriaLines.push(val); return; }
      descLines.push(`${nombre}: ${val}`);
    });

    if (triggerTextos.length > 0) triggersPendientes.push({ alterId: id, textos: triggerTextos });

    // URL de avatar: anotarla en descripción (no se puede descargar sin backend)
    if (m.avatarUrl) descLines.push(`Avatar: ${m.avatarUrl}`);

    return {
      ..._mkAlterBase(id, i),
      name: m.name,
      pronouns: _spPronombres(m.pronouns),
      color, bg,
      ageType: _spAgeType(ageRaw),
      roleType: _spRolType(roleRaw),
      role: roleRaw,
      description: [descBase, ...descLines].filter(Boolean).join('\n\n'),
      memoriaConoce: memoriaLines.join('\n').trim(),
      intimacyLevel: m.private ? 'privado' : 'interno',
      _simplyId: m._id
    };
  });

  if (altersNuevos.length === 0) {
    resultado.advertencias.push('No se encontraron alters en el archivo.');
  } else {
    const existentes = getAlters(true);
    const nombresExistentes = new Set(existentes.map(a => a.name.toLowerCase()));
    const filtrados = altersNuevos.filter(a => {
      if (nombresExistentes.has(a.name.toLowerCase())) {
        resultado.advertencias.push(`"${a.name}" ya existe — omitido.`);
        return false;
      }
      return true;
    });
    if (filtrados.length > 0) {
      const merged = [...existentes, ...filtrados];
      saveAlters(merged);
      ALTERS = merged;
    }
    resultado.alters = filtrados.length;
  }

  // Triggers → tid_salud_triggers con el alter asociado
  if (triggersPendientes.length > 0) {
    const triggerList = loadSaludTriggers();
    triggersPendientes.forEach(({ alterId, textos }) => {
      textos.forEach(texto => {
        triggerList.push({
          id: uid(),
          titulo: texto.length > 80 ? texto.slice(0, 77) + '…' : texto,
          descripcion: texto.length > 80 ? texto : '',
          alterId,
          provocaSwitcheo: false,
          intensidad: 3
        });
        resultado.triggers++;
      });
    });
    saveSaludTriggers(triggerList);
  }

  // Canales de chat
  const canalesSimply = data.channels || [];
  if (canalesSimply.length > 0) {
    const existentes = (() => { try { return JSON.parse(localStorage.getItem('tid_channels'))||[]; } catch { return []; } })();
    const nombresExist = new Set(existentes.map(c => c.name.toLowerCase()));
    const nuevosCanales = canalesSimply
      .filter(c => c.name && !nombresExist.has(c.name.toLowerCase()))
      .map(c => ({ id: uid(), name: c.name, icon: c.icon||'#', desc: c.desc||'', color: c.color||'#a08aff', type: 'channel', pinned: false }));
    if (nuevosCanales.length > 0) {
      localStorage.setItem('tid_channels', JSON.stringify([...existentes, ...nuevosCanales]));
      resultado.canales = nuevosCanales.length;
    }
  }

  // Estados de sesión personalizados de SP (tags de miembro → FRONT_CUSTOM_STATES)
  const spCustomStates = data.customFronts || data.customStatuses || [];
  if (spCustomStates.length > 0) {
    const spIdToAtria = {};
    getAlters().forEach(a => { if (a._simplyId) spIdToAtria[a._simplyId] = a.id; });
    Object.entries(idToAtria).forEach(([sid,aid]) => { spIdToAtria[sid]=aid; });
    const sesionesActuales = (() => { try { return JSON.parse(localStorage.getItem('tid_fronting'))||[]; } catch{return[];} })();
    let modificado = false;
    spCustomStates.forEach(cs => {
      if (!cs.member || !cs.status) return;
      const alterId = spIdToAtria[cs.member];
      if (!alterId) return;
      const byLabel = FRONT_CUSTOM_STATES.find(s => s.label.toLowerCase() === cs.status.toLowerCase());
      if (!byLabel) return;
      // Buscar la sesión más reciente de este alter y asignar el estado
      const sIdx = sesionesActuales.map((s,i)=>({s,i}))
        .filter(x=>x.s.alterId===alterId && x.s.end)
        .sort((a,b)=>b.s.start-a.s.start)[0];
      if (sIdx && !sIdx.s.customState) {
        sesionesActuales[sIdx.i].customState = byLabel.id;
        modificado = true;
      }
    });
    if (modificado) localStorage.setItem('tid_fronting', JSON.stringify(sesionesActuales));
  }

  // Historial de fronting
  // SP exporta una entrada por fronter — agrupar por startTime para capturar co-fronting
  const fh = (data.frontHistory || []).filter(f => f.member && f.startTime && f.endTime && !f.live);
  if (fh.length > 0) {
    const todosAlters = getAlters();
    const simplyToAtria = {};
    todosAlters.forEach(a => { if (a._simplyId) simplyToAtria[a._simplyId] = a.id; });
    Object.entries(idToAtria).forEach(([sid, aid]) => { simplyToAtria[sid] = aid; });
    const sesionesExistentes = (() => { try { return JSON.parse(localStorage.getItem('tid_fronting'))||[]; } catch { return []; } })();
    const tsExistentes = new Set(sesionesExistentes.map(s => s.start));

    // Agrupar entradas por startTime: la primera es el fronter principal, el resto co-fronters
    const grupos = {};
    fh.forEach(f => {
      if (!simplyToAtria[f.member]) return;
      const key = f.startTime;
      if (!grupos[key]) grupos[key] = { startTime: f.startTime, endTime: f.endTime, members: [] };
      grupos[key].members.push(f.member);
    });

    const nuevasSesiones = Object.values(grupos)
      .filter(g => !tsExistentes.has(g.startTime))
      .map(g => {
        const [main, ...co] = g.members;
        return {
          id: uid(), alterId: simplyToAtria[main],
          start: g.startTime, end: g.endTime,
          duration: Math.round((g.endTime - g.startTime) / 60000),
          note: '',
          coFronting: co.map(sid => simplyToAtria[sid]).filter(Boolean)
        };
      });

    if (nuevasSesiones.length > 0) {
      const merged = [...sesionesExistentes, ...nuevasSesiones].sort((a,b) => a.start - b.start);
      localStorage.setItem('tid_fronting', JSON.stringify(merged));
      resultado.fronting = nuevasSesiones.length;
    }
  }

  return resultado;
}

// ── PluralKit ─────────────────────────────────
function importarPluralKit(data) {
  const resultado = { alters:0, fronting:0, canales:0, advertencias:[] };

  const idToAtria = {};
  const altersNuevos = (data.members || []).map((m, i) => {
    const id = uid();
    idToAtria[m.id] = id;

    // Color: hex de 6 chars sin # (e.g. "a08aff")
    const rawColor = m.color && m.color.trim()
      ? (m.color.startsWith('#') ? m.color : '#' + m.color)
      : _IMPORT_COLORS[i % _IMPORT_COLORS.length];
    const { color, bg } = _mkColorBg(rawColor);

    // Extraer edad y rol de los campos de decoración ⧉-emoji⟤- [ valor ]
    const rawDesc = m.description || '';
    let ageRaw = null, roleRaw = '';
    rawDesc.replace(/⧉-[^⟤]*⟤-\s*\[([^\]]+)\]/g, (_, v) => {
      const val = v.trim();
      if (/^\d+$/.test(val) && !ageRaw) { ageRaw = val; return; }
      if (!roleRaw) { const r = _spRolType(val); if (r !== 'otro') roleRaw = val; }
    });

    // Limpiar decoraciones de la descripción
    const descBase = rawDesc
      .replace(/╭[^╮]*╮/g, '')
      .replace(/⧉-[^⟤]*⟤-\s*\[[^\]]*\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Cumpleaños: omitir año si claramente inválido (< 1900), mostrar solo DD/MM
    const descLines = [];
    if (m.birthday) {
      const parts = m.birthday.split('-');
      const year = parseInt(parts[0]);
      const bdDisplay = year < 1900 && parts.length >= 3
        ? `${parts[2]}/${parts[1]}`
        : m.birthday;
      descLines.push(`Cumpleaños: ${bdDisplay}`);
    }
    if (m.avatar_url) descLines.push(`Avatar: ${m.avatar_url}`);
    if (m.banner)     descLines.push(`Banner: ${m.banner}`);
    if (m.display_name && m.display_name !== m.name) descLines.push(`Nombre display: ${m.display_name}`);

    return {
      ..._mkAlterBase(id, i),
      name:          m.name,
      pronouns:      _spPronombres(m.pronouns),
      color, bg,
      ageType:       _spAgeType(ageRaw),
      roleType:      _spRolType(roleRaw),
      role:          roleRaw,
      description:   [descBase, ...descLines].filter(Boolean).join('\n\n'),
      intimacyLevel: m.privacy?.visibility === 'private' ? 'privado' : 'interno',
      _pkId:         m.id
    };
  });

  if (altersNuevos.length === 0) {
    resultado.advertencias.push('No se encontraron alters en el archivo.');
  } else {
    const existentes = getAlters(true);
    const nombresExistentes = new Set(existentes.map(a => a.name.toLowerCase()));
    const filtrados = altersNuevos.filter(a => {
      if (nombresExistentes.has(a.name.toLowerCase())) {
        resultado.advertencias.push(`"${a.name}" ya existe — omitido.`);
        return false;
      }
      return true;
    });
    if (filtrados.length > 0) {
      const merged = [...existentes, ...filtrados];
      saveAlters(merged);
      ALTERS = merged;
    }
    resultado.alters = filtrados.length;
  }

  // Switches → historial de fronting
  const switches = (data.switches || []).filter(s => s.timestamp && Array.isArray(s.members) && s.members.length > 0);
  if (switches.length > 0) {
    switches.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const todosAlters = getAlters();
    const pkToAtria = {};
    todosAlters.forEach(a => { if (a._pkId) pkToAtria[a._pkId] = a.id; });
    Object.entries(idToAtria).forEach(([pid, aid]) => { pkToAtria[pid] = aid; });
    const sesionesExistentes = (() => { try { return JSON.parse(localStorage.getItem('tid_fronting'))||[]; } catch { return []; } })();
    const tsExistentes = new Set(sesionesExistentes.map(s => s.start));
    const nuevasSesiones = [];
    switches.forEach((sw, idx) => {
      const startTs = new Date(sw.timestamp).getTime();
      if (tsExistentes.has(startTs)) return;
      const endTs = idx + 1 < switches.length
        ? new Date(switches[idx+1].timestamp).getTime()
        : startTs + 3600000;
      const [mainId, ...coIds] = sw.members;
      const alterId = pkToAtria[mainId];
      if (!alterId) return;
      nuevasSesiones.push({
        id: uid(), alterId,
        start: startTs, end: endTs,
        duration: Math.round((endTs - startTs) / 60000),
        note: '',
        coFronting: coIds.map(cid => pkToAtria[cid]).filter(Boolean)
      });
    });
    if (nuevasSesiones.length > 0) {
      const merged = [...sesionesExistentes, ...nuevasSesiones].sort((a,b) => a.start - b.start);
      localStorage.setItem('tid_fronting', JSON.stringify(merged));
      resultado.fronting = nuevasSesiones.length;
    }
  }

  return resultado;
}

// ── Atria Exchange Format (AEF) ───────────────
function importarAEF(data) {
  const resultado = { alters:0, fronting:0, canales:0, triggers:0, estados:0, advertencias:[] };

  function _tsMs(v) {
    if (!v) return null;
    if (typeof v === 'number') return v;
    const n = new Date(v).getTime();
    return isNaN(n) ? null : n;
  }

  function _aefRolType(t) {
    if (!t) return 'otro';
    switch(t.toLowerCase()) {
      case 'host':       return 'anfitrion';
      case 'protector':  return 'protector';
      case 'guardian':   return 'guardian';
      case 'little':     return 'nino';
      case 'persecutor': return 'perseguidor';
      case 'fragment':   return 'fragmento';
      default:           return 'otro';
    }
  }

  function _aefAgeType(t) {
    if (!t) return 'adulto';
    switch(t.toLowerCase()) {
      case 'baby':  return 'bebe';
      case 'child': return 'nino';
      case 'teen':  return 'adolescente';
      default:      return 'adulto';
    }
  }

  function _getSubsystemId(name) {
    if (!name) return null;
    const subs = loadSubsystems();
    const ex = subs.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (ex) return ex.id;
    const newSub = { id: uid(), name };
    subs.push(newSub);
    saveSubsystems(subs);
    return newSub.id;
  }

  const idToAtria = {};

  // ── Alters ──
  const members = Array.isArray(data.members) ? data.members : [];
  const altersNuevos = [];
  members.forEach((m, i) => {
    if (!m.name || !m.name.trim()) {
      resultado.advertencias.push(`Miembro ${i+1}: nombre vacío — omitido.`);
      return;
    }
    const id = uid();
    if (m.id) idToAtria[m.id] = id;
    const rawColor = m.color && /^#?[0-9a-fA-F]{6}$/.test((m.color||'').replace('#',''))
      ? (m.color.startsWith('#') ? m.color : '#' + m.color)
      : _IMPORT_COLORS[i % _IMPORT_COLORS.length];
    const { color, bg } = _mkColorBg(rawColor);
    const descLines = [];
    if (m.avatar_url) descLines.push(`Avatar: ${m.avatar_url}`);
    altersNuevos.push({
      ..._mkAlterBase(id, i),
      name:          m.name.trim(),
      pronouns:      _spPronombres(m.pronouns || ''),
      color, bg,
      description:   [(m.description||'').trim(), ...descLines].filter(Boolean).join('\n\n'),
      role:          m.role || '',
      roleType:      _aefRolType(m.role_type),
      ageType:       _aefAgeType(m.age_type),
      isArchived:    !!m.is_archived,
      intimacyLevel: m.is_private ? 'privado' : 'interno',
      subsystemId:   _getSubsystemId(m.subsystem || null),
      _aefId:        m.id || null
    });
  });
  if (altersNuevos.length > 0) {
    const existentes = getAlters(true);
    const nombresExistentes = new Set(existentes.map(a => a.name.toLowerCase()));
    const filtrados = altersNuevos.filter(a => {
      if (nombresExistentes.has(a.name.toLowerCase())) {
        resultado.advertencias.push(`"${a.name}" ya existe — omitido.`);
        return false;
      }
      return true;
    });
    if (filtrados.length > 0) {
      const merged = [...existentes, ...filtrados];
      saveAlters(merged);
      ALTERS = merged;
      resultado.alters = filtrados.length;
    }
  }

  // ── Front history ──
  const frontHistory = Array.isArray(data.front_history) ? data.front_history : [];
  if (frontHistory.length > 0) {
    getAlters().forEach(a => { if (a._aefId) idToAtria[a._aefId] = a.id; });
    const sesionesExistentes = (() => { try { return JSON.parse(localStorage.getItem('tid_fronting'))||[]; } catch { return []; } })();
    const tsExistentes = new Set(sesionesExistentes.map(s => s.start));
    const nuevasSesiones = [];
    frontHistory.forEach(f => {
      const startTs = _tsMs(f.start);
      const endTs   = _tsMs(f.end);
      if (!startTs || !endTs || endTs <= startTs) return;
      if (tsExistentes.has(startTs)) return;
      const alterId = idToAtria[f.member_id];
      if (!alterId) return;
      let customState = null, stateNote = '';
      if (f.state) {
        const byId    = FRONT_CUSTOM_STATES.find(s => s.id    === f.state.toLowerCase());
        const byLabel = FRONT_CUSTOM_STATES.find(s => s.label.toLowerCase() === f.state.toLowerCase());
        if      (byId)    customState = byId.id;
        else if (byLabel) customState = byLabel.id;
        else              stateNote   = f.state;
      }
      nuevasSesiones.push({
        id: uid(), alterId,
        start: startTs, end: endTs,
        duration: Math.round((endTs - startTs) / 60000),
        note: [f.note||'', stateNote].filter(Boolean).join(' | '),
        coFronting: (Array.isArray(f.co_members) ? f.co_members : []).map(cid => idToAtria[cid]).filter(Boolean),
        customState
      });
    });
    if (nuevasSesiones.length > 0) {
      const merged = [...sesionesExistentes, ...nuevasSesiones].sort((a,b) => a.start - b.start);
      localStorage.setItem('tid_fronting', JSON.stringify(merged));
      resultado.fronting = nuevasSesiones.length;
    }
  }

  // ── Channels ──
  const channels = Array.isArray(data.channels) ? data.channels : [];
  if (channels.length > 0) {
    const existentes = (() => { try { return JSON.parse(localStorage.getItem('tid_channels'))||[]; } catch { return []; } })();
    const nombresExist = new Set(existentes.map(c => c.name.toLowerCase()));
    const nuevos = channels
      .filter(c => c.name && !nombresExist.has(c.name.toLowerCase()))
      .map(c => ({ id: uid(), name: c.name, icon: c.icon||'#', desc: c.desc||'', color: c.color||'#a08aff', type: 'channel', pinned: false }));
    if (nuevos.length > 0) {
      localStorage.setItem('tid_channels', JSON.stringify([...existentes, ...nuevos]));
      resultado.canales = nuevos.length;
    }
  }

  // ── Front states ──
  const frontStates = Array.isArray(data.front_states) ? data.front_states : [];
  if (frontStates.length > 0) {
    frontStates.forEach(fs => {
      if (!fs.name) return;
      const label = fs.name.trim();
      const byLabel = FRONT_CUSTOM_STATES.find(s => s.label.toLowerCase() === label.toLowerCase());
      const byId    = FRONT_CUSTOM_STATES.find(s => s.id    === label.toLowerCase());
      if (byLabel || byId) {
        resultado.estados++;
      } else {
        resultado.advertencias.push(`Estado de fronting "${label}" no reconocido — omitido.`);
      }
    });
  }

  // ── Triggers ──
  const triggers = Array.isArray(data.triggers) ? data.triggers : [];
  if (triggers.length > 0) {
    getAlters().forEach(a => { if (a._aefId) idToAtria[a._aefId] = a.id; });
    const triggerList = loadSaludTriggers();
    triggers.forEach(t => {
      if (!t.title) return;
      const titulo = t.title.length > 80 ? t.title.slice(0, 77) + '…' : t.title;
      triggerList.push({
        id: uid(),
        titulo,
        descripcion:      t.description || '',
        alterId:          (t.member_id && idToAtria[t.member_id]) || null,
        provocaSwitcheo:  false,
        intensidad:       Math.min(5, Math.max(1, parseInt(t.intensity) || 3))
      });
      resultado.triggers++;
    });
    saveSaludTriggers(triggerList);
  }

  return resultado;
}

function mostrarResultadoImport(res, source) {
  const lineas = [
    res.alters   > 0 ? `✓ ${res.alters} alter${res.alters!==1?'s':''} importado${res.alters!==1?'s':''}` : null,
    res.canales  > 0 ? `✓ ${res.canales} canal${res.canales!==1?'es':''} importado${res.canales!==1?'s':''}` : null,
    res.fronting > 0 ? `✓ ${res.fronting} sesiones de fronting importadas` : null,
    res.triggers > 0 ? `✓ ${res.triggers} trigger${res.triggers!==1?'s':''} añadido${res.triggers!==1?'s':''} a Salud` : null,
    res.estados  > 0 ? `✓ ${res.estados} estado${res.estados!==1?'s de sesión':' de sesión'} importado${res.estados!==1?'s':''}` : null,
    ...res.advertencias
  ].filter(Boolean);

  const html = `
    <div class="modal-title">Importación completada</div>
    <div class="modal-subtitle">Desde ${source}</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin:4px 0">
      ${lineas.map(l => `<div style="font-size:13px;padding:8px 12px;background:var(--bg-2);border-radius:8px;font-family:'DM Mono',monospace">${l}</div>`).join('')}
      ${res.alters===0&&res.fronting===0&&res.canales===0 ? '<div style="color:var(--text-2);font-size:13px">No se importó ningún dato.</div>' : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" data-cancel>Aceptar</button>
    </div>`;
  openModal(html, () => {});
}

// ═══════════════════════════════════════════════
// CUSTOM FIELDS EN ALTERS
// ═══════════════════════════════════════════════
// Los custom fields se guardan en alter.customFields = [{id, key, value}]
// Se muestran en la ficha y en el modal de edición (tab Básico, sección extra)

function renderCustomFields(fields, containerId, readonly) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const list = fields || [];
  wrap.innerHTML = list.map((f, i) => `
    <div class="cf-row" data-cfi="${i}">
      ${readonly
        ? `<div class="cf-key">${escB(f.key)}</div><div class="cf-val">${escB(f.value)}</div>`
        : `<input class="cf-input-key" placeholder="Campo" value="${escB(f.key)}" data-cfi="${i}" data-type="key">
           <input class="cf-input-val" placeholder="Valor" value="${escB(f.value)}" data-cfi="${i}" data-type="val">
           <button class="icon-btn cf-del" data-cfi="${i}" title="Eliminar">✕</button>`
      }
    </div>`).join('') + (readonly ? '' : `
    <button class="btn btn-ghost btn-sm" id="btn-add-cf" style="margin-top:6px;font-size:11px">+ Añadir campo</button>`);
}

// ═══════════════════════════════════════════════
// FRONT STATUSES (presets de fronting)
// ═══════════════════════════════════════════════
function loadFrontPresets()  { try { return JSON.parse(localStorage.getItem('tid_front_presets'))||[]; } catch{return[];} }
function saveFrontPresets(p) { localStorage.setItem('tid_front_presets', JSON.stringify(p)); }

function renderFrontPresets(cont, alters) {
  const presets = loadFrontPresets();
  if (!presets.length) return;
  cont.innerHTML += `
    <div style="margin-top:16px">
      <div class="form-label" style="margin-bottom:8px">Combinaciones guardadas</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${presets.map(p => {
          const mainAlter = alters.find(a=>a.id===p.alterId);
          if (!mainAlter) return '';
          const coAlters = (p.coFronting||[]).map(id=>alters.find(a=>a.id===id)).filter(Boolean);
          return `<div class="front-preset-row">
            <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
              <div style="font-size:16px">${mainAlter.emoji||'◎'}</div>
              <div>
                <div style="font-size:12px;font-weight:700">${mainAlter.name}</div>
                ${coAlters.length?`<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">con ${coAlters.map(a=>a.name).join(', ')}</div>`:''}
              </div>
              ${p.label?`<div class="badge" style="margin-left:4px">${p.label}</div>`:''}
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" data-apply-preset="${p.id}">Aplicar</button>
              <button class="icon-btn" data-del-preset="${p.id}" title="Eliminar">✕</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // Wire presets
  cont.querySelectorAll('[data-apply-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = loadFrontPresets().find(x=>x.id===btn.dataset.applyPreset);
      if (!p) return;
      iniciarFronting(p.alterId, p.coFronting||[]);
      showToast(`◉ Fronting: ${alters.find(a=>a.id===p.alterId)?.name||'—'} ✓`);
      frontingTab = 'actual';
      renderFrontingView();
    });
  });
  cont.querySelectorAll('[data-del-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      saveFrontPresets(loadFrontPresets().filter(x=>x.id!==btn.dataset.delPreset));
      renderFrontingView();
    });
  });
}

function openSavePresetModal(current, alters) {
  if (!current) { showToast('⚠ No hay sesión activa'); return; }
  const fa = alters.find(a=>a.id===current.alterId);
  const coAlters = (current.coFronting||[]).map(id=>alters.find(a=>a.id===id)).filter(Boolean);
  const modalHTML = `
    <div class="modal-title">Guardar combinación</div>
    <div class="modal-subtitle">${fa?.name||'—'}${coAlters.length?' + '+coAlters.map(a=>a.name).join(', '):''}</div>
    <div class="form-row" style="margin-top:14px">
      <div class="form-label">Etiqueta (opcional)</div>
      <input type="text" id="preset-label" placeholder="Ej: Mañana, Trabajo, Salidas...">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>Guardar</button>
    </div>`;
  openModal(modalHTML, ov => {
    const label = ov.querySelector('#preset-label').value.trim();
    const presets = loadFrontPresets();
    presets.push({id:uid(), alterId:current.alterId, coFronting:[...(current.coFronting||[])], label});
    saveFrontPresets(presets);
    closeModal();
    showToast('Combinación guardada ✓');
    renderFrontingView();
  });
}

// ═══════════════════════════════════════════════
// ESTADOS EMOCIONALES
// ═══════════════════════════════════════════════
const SYSTEM_STATES = [
  {id:'ok',        emoji:'🟢', label:'Estable',      color:'#8affe0'},
  {id:'alert',     emoji:'🟡', label:'Alerta',        color:'#ffd580'},
  {id:'stress',    emoji:'🔴', label:'Estrés',        color:'#ff8a8a'},
  {id:'dissoc',    emoji:'🌫️', label:'Disociación',   color:'#8ab4ff'},
  {id:'switch',    emoji:'⚡', label:'En cambio',     color:'#c4aaff'},
  {id:'rest',      emoji:'🌙', label:'Descanso',      color:'#6e6a90'},
];

function loadSystemState()  { try { return JSON.parse(localStorage.getItem('tid_system_state'))||null; } catch{return null;} }
function saveSystemState(s) { localStorage.setItem('tid_system_state', JSON.stringify(s)); }

function setSystemState(stateId) {
  const st = SYSTEM_STATES.find(s=>s.id===stateId);
  if (!st) return;
  saveSystemState({id:stateId, ts:Date.now()});
  // Actualizar badge en UI
  updateSystemStateBadge();
  showToast(`${st.emoji} Estado: ${st.label}`);
}

function updateSystemStateBadge() {
  const state = loadSystemState();
  const badge = document.getElementById('system-state-badge');
  if (!badge) return;
  if (!state) { badge.textContent = '○'; badge.style.color = 'var(--text-3)'; badge.title = 'Estado del sistema'; return; }
  const st = SYSTEM_STATES.find(s=>s.id===state.id);
  if (st) { badge.textContent = st.emoji; badge.style.color = st.color; badge.title = st.label; }
}

function openSystemStateModal() {
  const current = loadSystemState();
  const modalHTML = `
    <div class="modal-title">Estado del sistema</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px">
      ${SYSTEM_STATES.map(s=>`
        <div class="state-opt-btn${current?.id===s.id?' selected':''}" data-state="${s.id}" style="--sc:${s.color}">
          <span style="font-size:22px">${s.emoji}</span>
          <span style="font-weight:700;font-size:13px">${s.label}</span>
        </div>`).join('')}
    </div>
    ${current?`<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:12px;text-align:center">
      Desde ${new Date(current.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}
      · <span style="cursor:pointer;color:var(--accent)" id="clear-state">Limpiar</span>
    </div>`:''}
    <div class="modal-footer" style="margin-top:4px">
      <button class="btn btn-ghost" data-cancel>Cerrar</button>
    </div>`;
  openModal(modalHTML, ()=>{});
  const ov = document.querySelector('.modal-overlay');
  ov.querySelectorAll('[data-state]').forEach(btn => {
    btn.addEventListener('click', () => {
      setSystemState(btn.dataset.state);
      closeModal();
    });
  });
  ov.querySelector('#clear-state')?.addEventListener('click', () => {
    saveSystemState(null);
    updateSystemStateBadge();
    closeModal();
    showToast('Estado limpiado');
  });
}


// ═══════════════════════════════════════════════
// MODAL DE ALTERS ARCHIVADOS
// ═══════════════════════════════════════════════
function openArchivedAltersModal() {
  const archived = getAlters(true).filter(a => a.isArchived);
  if (!archived.length) { showToast('No hay alters archivados'); return; }
  const modalHTML = `
    <div class="modal-title">Alters archivados</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;max-height:60vh;overflow-y:auto">
      ${archived.map(a => `
        <div class="alter-archived-banner" style="gap:12px;align-items:center;padding:12px 14px">
          <div style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;background:${a.bg};border:1.5px solid ${a.color}40">
            ${alterAv(a, 36)}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--text-0)">${esc(a.name)}</div>
            ${a.archiveReason?`<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:2px">${escB(a.archiveReason)}</div>`:''}
          </div>
          <button class="btn btn-ghost btn-sm" data-restore="${a.id}">Restaurar</button>
        </div>`).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cerrar</button>
    </div>`;
  openModal(modalHTML, ()=>{});
  const ov = document.querySelector('.modal-overlay');
  ov.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = loadAlters();
      const a = list.find(x=>x.id===btn.dataset.restore);
      if (!a) return;
      a.isArchived = false; a.archiveReason = '';
      saveAlters(list);
      showToast(`${a.name} restaurado ✓`);
      closeModal();
      renderAlters();
    });
  });
}
// ═══════════════════════════════════════════════
// BÚSQUEDA GLOBAL
// ═══════════════════════════════════════════════
function loadTracker()  { try { return JSON.parse(localStorage.getItem('tid_tracker'))||[]; } catch{return[];} }
function saveTracker(t) { localStorage.setItem('tid_tracker', JSON.stringify(t)); }
const TRACKER_HISTORY_PAGE = 30;

// ═══════════════════════════════════════════════
// ANÁLISIS — Phase 4
// ═══════════════════════════════════════════════
let analisisTab = 'dashboard';
let analisisPatternDays = 14;
let analisisMoodTimelineFilter = { alterId:'all', from:'', to:'', group:'day' };

function renderAnalisis() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Análisis'}]);
  if (!['dashboard','actividad','heatmap','emociones','timeline-emocional','triggers','patrones'].includes(analisisTab)) analisisTab = 'dashboard';
  renderAnalisisView();
}

function renderAnalisisView() {
  const app = document.getElementById('app');
  const tabs = [
    {id:'dashboard', label:'◈ Dashboard'},
    {id:'actividad', label:'◷ Actividad'},
    {id:'heatmap',   label:'◫ Heatmap'},
    {id:'emociones', label:'◎ Emociones'},
    {id:'timeline-emocional', label:'↝ Timeline emocional'},
    {id:'patrones',   label:'◇ Patrones'},
    {id:'triggers',  label:'⚡ Triggers'},
  ];
  app.innerHTML = `
    <div class="mem-tabs" style="margin-bottom:16px">
      ${tabs.map(t=>`<div class="mem-tab${analisisTab===t.id?' active':''}" data-at="${t.id}">${t.label}</div>`).join('')}
    </div>
    <div id="analisis-content"></div>`;
  app.querySelectorAll('.mem-tab').forEach(t=>t.addEventListener('click',()=>{ analisisTab=t.dataset.at; renderAnalisisView(); }));
  const cont = app.querySelector('#analisis-content');
  const alters = getAlters();
  if (analisisTab==='dashboard') renderAnalisisDashboard(cont, alters);
  if (analisisTab==='actividad') renderAnalisisActividad(cont, alters);
  if (analisisTab==='heatmap')   renderAnalisisHeatmap(cont, alters);
  if (analisisTab==='emociones') renderAnalisisEmociones(cont, alters);
  if (analisisTab==='timeline-emocional') renderAnalisisMoodTimeline(cont, alters);
  if (analisisTab==='patrones')  renderAnalisisPatterns(cont, alters);
  if (analisisTab==='triggers')  renderAnalisisTriggers(cont, alters);
}

// ── helpers compartidos ──
function _analisisStatCard(val, label, color) {
  return `<div class="wish-stat"><div class="wish-stat-val" style="color:${color}">${val}</div><div class="wish-stat-label">${label}</div></div>`;
}
function _analisisBarH(pct, color) {
  return `<div style="flex:1;height:8px;border-radius:4px;background:var(--bg-3);overflow:hidden"><div style="height:100%;width:${pct}%;border-radius:4px;background:${color};transition:width .3s"></div></div>`;
}

// ── DASHBOARD ──
function renderAnalisisDashboard(cont, alters) {
  const sessions  = loadActividad().filter(s=>s.end);
  const tracker   = loadTracker();
  const crisisLog = loadCrisisLog();
  const moods     = getMoods();
  const triggers  = loadSaludTriggers();
  const now       = Date.now();
  const ms30days  = 30*24*3600*1000;

  // Top fronter por tiempo
  const timeByAlter = {};
  sessions.forEach(s=>{ timeByAlter[s.alterId]=(timeByAlter[s.alterId]||0)+(s.duration||0); });
  const topFronterId = Object.entries(timeByAlter).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topFronter   = alters.find(a=>a.id===topFronterId);

  // Most common mood
  const moodCount = {};
  tracker.forEach(e=>{ moodCount[e.mood]=(moodCount[e.mood]||0)+1; });
  const topMoodId = Object.entries(moodCount).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topMood   = moods.find(m=>m.id===topMoodId);

  // Most frequent trigger
  const trigCount = {};
  crisisLog.forEach(e=>{ if(e.triggerId) trigCount[e.triggerId]=(trigCount[e.triggerId]||0)+1; });
  const topTrigId = Object.entries(trigCount).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topTrig   = triggers.find(t=>t.id===topTrigId);

  // Last 30 days
  const recentCrisis  = crisisLog.filter(e=>e.startedAt>now-ms30days).length;
  const recentSessions= sessions.filter(s=>s.start>now-ms30days).length;
  const totalFrontTime= Object.values(timeByAlter).reduce((a,b)=>a+b,0);

  // Last 14 days switch activity (bar chart)
  const last14 = Array.from({length:14},(_,i)=>{
    const d = new Date(now - (13-i)*86400000);
    return {label:d.toLocaleDateString('es-ES',{weekday:'short'}), iso:d.toISOString().slice(0,10), count:0};
  });
  sessions.forEach(s=>{ const iso=new Date(s.start).toISOString().slice(0,10); const d=last14.find(x=>x.iso===iso); if(d) d.count++; });
  const maxLast14 = Math.max(...last14.map(d=>d.count),1);

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
        ${_analisisStatCard(sessions.length, 'Sesiones totales', 'var(--accent)')}
        ${_analisisStatCard(fmtDuration(totalFrontTime), 'Tiempo total front', 'var(--accent-3)')}
        ${_analisisStatCard(recentSessions, 'Sesiones (30 días)', 'var(--accent-4)')}
        ${_analisisStatCard(recentCrisis, 'Crisis (30 días)', recentCrisis>0?'#ff6b8a':'var(--accent-2)')}
      </div>

      <!-- Top cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        ${topFronter ? `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px">
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Alter más activo</div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:26px">${escM(topFronter.emoji||'●')}</span>
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text-1)">${escM(topFronter.name)}</div>
              <div style="font-size:11px;color:var(--text-3)">${fmtDuration(timeByAlter[topFronter.id]||0)}</div>
            </div>
          </div>
        </div>` : ''}
        ${topMood ? `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px">
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Estado más frecuente</div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:26px">${topMood.emoji}</span>
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text-1)">${escM(topMood.label)}</div>
              <div style="font-size:11px;color:var(--text-3)">${moodCount[topMoodId]} registro${moodCount[topMoodId]!==1?'s':''}</div>
            </div>
          </div>
        </div>` : ''}
        ${topTrig ? `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px">
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Trigger más frecuente</div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:22px">⚡</span>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text-1);line-height:1.3">${escM(topTrig.titulo)}</div>
              <div style="font-size:11px;color:var(--text-3)">${trigCount[topTrigId]} vez${trigCount[topTrigId]!==1?'es':''}</div>
            </div>
          </div>
        </div>` : ''}
      </div>

      <!-- Activity chart últimos 14 días -->
      ${sessions.length ? `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Sesiones · últimos 14 días</div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:60px">
          ${last14.map(d=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="flex:1;width:100%;display:flex;align-items:flex-end">
              <div style="width:100%;border-radius:3px 3px 0 0;background:${d.count?'var(--accent)':'var(--bg-3)'};height:${d.count?Math.max(Math.round((d.count/maxLast14)*48),6):2}px"></div>
            </div>
            <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3)">${d.label}</div>
          </div>`).join('')}
        </div>
      </div>` : ''}

      ${!sessions.length && !tracker.length && !crisisLog.length ? `<div class="empty-state" style="padding:40px 20px"><div class="empty-icon">◈</div><div>Sin datos todavía</div><div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);margin-top:6px">Los datos se acumulan con el uso del sistema</div></div>` : ''}
    </div>`;
}

// ── ACTIVIDAD ──
// ── HEATMAP DE FRONTING ──
function renderAnalisisHeatmap(cont, alters) {
  const sessions = loadActividad().filter(s => s.end);

  // Construir mapa de sesiones y duración total por día (últimas 16 semanas = 112 días)
  const WEEKS = 16;
  const DAYS  = WEEKS * 7;
  const today = new Date(); today.setHours(23,59,59,999);
  const cells = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    cells.push(d.toISOString().slice(0,10));
  }

  const byDate = {};
  sessions.forEach(s => {
    const ds = new Date(s.start).toISOString().slice(0,10);
    if (!byDate[ds]) byDate[ds] = {count:0, dur:0, alters:{}};
    byDate[ds].count++;
    byDate[ds].dur += s.duration||0;
    byDate[ds].alters[s.alterId] = (byDate[ds].alters[s.alterId]||0) + 1;
  });

  const maxCount = Math.max(...cells.map(d => byDate[d]?.count||0), 1);

  // Agrupar en semanas (columnas)
  const weeks = [];
  for (let w = 0; w < WEEKS; w++) weeks.push(cells.slice(w*7, w*7+7));

  const DOW_LABELS = ['D','L','M','X','J','V','S'];
  const todayStr = new Date().toISOString().slice(0,10);

  function cellColor(ds) {
    const c = byDate[ds]?.count||0;
    if (!c) return 'var(--bg-3)';
    const intensity = Math.max(0.15, Math.min(1, c / maxCount));
    return `rgba(160,138,255,${intensity.toFixed(2)})`;
  }

  function cellTitle(ds) {
    const d = byDate[ds];
    if (!d) return ds + ': sin sesiones';
    const topAlt = Object.entries(d.alters).sort((a,b)=>b[1]-a[1])[0];
    const altName = topAlt ? (alters.find(a=>a.id===topAlt[0])?.name||'—') : '—';
    return `${ds}: ${d.count} sesión${d.count!==1?'es':''} · ${fmtDuration(d.dur)} · principal: ${altName}`;
  }

  // Total de días con sesiones, sesiones totales, alter más activo
  const activeDays = cells.filter(d => byDate[d]?.count).length;
  const totalSess  = cells.reduce((s,d) => s + (byDate[d]?.count||0), 0);
  const alterTotals = {};
  sessions.forEach(s => { alterTotals[s.alterId] = (alterTotals[s.alterId]||0)+1; });
  const topFronter  = Object.entries(alterTotals).sort((a,b)=>b[1]-a[1])[0];
  const topFronterAlt = topFronter ? alters.find(a=>a.id===topFronter[0]) : null;

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">
        ${_analisisStatCard(activeDays, 'Días con sesiones', 'var(--accent)')}
        ${_analisisStatCard(totalSess, 'Sesiones (período)', 'var(--accent-3)')}
        ${topFronterAlt ? _analisisStatCard(`${topFronterAlt.emoji} ${escM(topFronterAlt.name)}`, 'Alter más activo', topFronterAlt.color||'var(--accent-2)') : ''}
      </div>

      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;overflow-x:auto">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Actividad de fronting · últimas ${WEEKS} semanas</div>
        <div style="display:flex;gap:3px;align-items:flex-start">
          <!-- etiquetas días -->
          <div style="display:flex;flex-direction:column;gap:3px;margin-top:18px">
            ${DOW_LABELS.map(l=>`<div style="height:12px;font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3);line-height:12px;width:10px">${l}</div>`).join('')}
          </div>
          <!-- columnas semanas -->
          <div style="display:flex;gap:3px">
            ${weeks.map((week, wi) => {
              const firstDay = new Date(week[0]+'T12:00:00');
              const monthLabel = wi===0 || firstDay.getDate()<=7 ? firstDay.toLocaleDateString('es-ES',{month:'short'}) : '';
              return `<div style="display:flex;flex-direction:column;gap:3px">
                <div style="height:14px;font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3);text-align:center;white-space:nowrap">${monthLabel}</div>
                ${week.map(ds=>`<div style="width:12px;height:12px;border-radius:2px;background:${cellColor(ds)};border:${ds===todayStr?'1px solid var(--accent)':'none'};flex-shrink:0;cursor:default" title="${cellTitle(ds)}"></div>`).join('')}
              </div>`;
            }).join('')}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:10px">
          <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3)">Menos</span>
          ${[0,0.2,0.4,0.7,1].map(o=>`<div style="width:10px;height:10px;border-radius:2px;background:rgba(160,138,255,${o||0.06})"></div>`).join('')}
          <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3)">Más</span>
        </div>
      </div>
    </div>`;
}

function renderAnalisisActividad(cont, alters) {
  const sessions = loadActividad().filter(s=>s.end).sort((a,b)=>b.start-a.start);

  if (!sessions.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:60px 20px"><div class="empty-icon">◷</div><div>Sin sesiones registradas</div></div>`;
    return;
  }

  // Stats per alter
  const byAlter = {};
  sessions.forEach(s=>{
    if (!byAlter[s.alterId]) byAlter[s.alterId]={count:0,dur:0};
    byAlter[s.alterId].count++;
    byAlter[s.alterId].dur += s.duration||0;
  });
  const totalDur = sessions.reduce((s,x)=>s+(x.duration||0),0);
  const sortedAlters = Object.entries(byAlter).sort((a,b)=>b[1].dur-a[1].dur);

  // Hour-of-day distribution
  const byHour = Array(24).fill(0);
  sessions.forEach(s=>{ byHour[new Date(s.start).getHours()]++; });
  const maxHour = Math.max(...byHour, 1);

  // Weekly pattern (day-of-week)
  const byDow = Array(7).fill(0);
  const dowLabels = ['D','L','M','X','J','V','S'];
  sessions.forEach(s=>{ byDow[new Date(s.start).getDay()]++; });
  const maxDow = Math.max(...byDow, 1);

  const avgDur = totalDur / sessions.length;

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
        ${_analisisStatCard(sessions.length, 'Sesiones totales', 'var(--accent)')}
        ${_analisisStatCard(fmtDuration(totalDur), 'Tiempo total', 'var(--accent-3)')}
        ${_analisisStatCard(fmtDuration(avgDur), 'Duración media', 'var(--accent-4)')}
        ${_analisisStatCard(Object.keys(byAlter).length, 'Alters con sesiones', 'var(--accent-2)')}
      </div>

      <!-- Distribución por alter -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Tiempo por alter</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sortedAlters.map(([aid,st])=>{
            const alt = alters.find(a=>a.id===aid);
            if (!alt) return '';
            const pct = Math.round((st.dur/totalDur)*100);
            return `<div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:16px">${escM(alt.emoji||'●')}</span>
                <span style="font-size:12px;font-weight:600;color:var(--text-1);flex:1">${escM(alt.name)}</span>
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${fmtDuration(st.dur)} · ${pct}%</span>
              </div>
              ${_analisisBarH(pct, alt.color||'var(--accent)')}
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Patrón por hora del día -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Actividad por hora del día</div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:48px">
          ${byHour.map((c,h)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px" title="${h}:00 — ${c} sesión${c!==1?'es':''}">
            <div style="width:100%;border-radius:2px 2px 0 0;background:${c?'var(--accent)':'var(--bg-3)'};height:${c?Math.max(Math.round((c/maxHour)*40),4):2}px"></div>
            ${h%6===0?`<div style="font-family:'DM Mono',monospace;font-size:7px;color:var(--text-3)">${h}h</div>`:``}
          </div>`).join('')}
        </div>
      </div>

      <!-- Patrón por día de semana -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Distribución por día de semana</div>
        <div style="display:flex;align-items:flex-end;gap:6px;height:60px">
          ${byDow.map((c,i)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="flex:1;width:100%;display:flex;align-items:flex-end">
              <div style="width:100%;border-radius:3px 3px 0 0;background:${c?'var(--accent-3)':'var(--bg-3)'};height:${c?Math.max(Math.round((c/maxDow)*44),6):2}px"></div>
            </div>
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${dowLabels[i]}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function renderAnalisisPatterns(cont, alters) {
  const read = key => { try { const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; } };
  const stamp = item => { const v=item?.ts||item?.timestamp||item?.createdAt||item?.date||item?.sentAt; const n=typeof v==='number'?v:new Date(v||0).getTime(); return Number.isFinite(n)&&n>0?n:null; };
  const days = [7,14,30].includes(analisisPatternDays) ? analisisPatternDays : 14;
  const start=Date.now()-(days-1)*86400000;
  const rows=Array.from({length:days},(_,i)=>{const d=new Date(start+i*86400000);return {iso:d.toISOString().slice(0,10),label:d.toLocaleDateString('es-ES',{day:'numeric',month:'short'}),front:0,journal:0,reminders:0,chat:0};});
  const add=(items,key)=>items.forEach(item=>{const ts=stamp(item);if(!ts)return;const row=rows.find(r=>r.iso===new Date(ts).toISOString().slice(0,10));if(row)row[key]++;});
  add(loadActividad().filter(s=>s.end),'front'); add(read('tid_diary'),'journal'); add(read('tid_reminders'),'reminders'); add(read('tid_messages'),'chat');
  const max=Math.max(...rows.map(r=>r.front+r.journal+r.reminders+r.chat),1);
  const totals=rows.reduce((a,r)=>({front:a.front+r.front,journal:a.journal+r.journal,reminders:a.reminders+r.reminders,chat:a.chat+r.chat}),{front:0,journal:0,reminders:0,chat:0});
  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:16px"><div style="display:flex;gap:6px;flex-wrap:wrap">${[7,14,30].map(n=>`<button class="btn btn-sm${days===n?' btn-primary':' btn-ghost'}" data-pattern-days="${n}">${n} días</button>`).join('')}</div><div class="hub-widget"><div class="hw-header"><div class="hw-icon" style="color:var(--accent)">◇</div><div class="hw-title">Patrones entre módulos</div></div><div style="font-size:11px;color:var(--text-2);margin-bottom:10px">Recuento descriptivo por día. Sirve para consultar patrones, no para afirmar causalidad ni hacer predicciones.</div><div style="display:flex;flex-direction:column;gap:5px">${rows.map(r=>{const total=r.front+r.journal+r.reminders+r.chat;return `<div style="display:flex;align-items:center;gap:7px"><span style="width:52px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${r.label}</span><div style="flex:1;height:12px;background:var(--bg-3);border-radius:3px;overflow:hidden;display:flex"><span title="Fronting" style="width:${r.front/max*100}%;background:var(--accent)"></span><span title="Diario" style="width:${r.journal/max*100}%;background:var(--accent-3)"></span><span title="Recordatorios" style="width:${r.reminders/max*100}%;background:var(--accent-4)"></span><span title="Chat" style="width:${r.chat/max*100}%;background:var(--accent-2)"></span></div><span style="width:22px;text-align:right;font-family:'DM Mono',monospace;font-size:9px;color:var(--text-2)">${total}</span></div>`;}).join('')}</div><div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)"><span style="color:var(--accent)">■ fronting ${totals.front}</span><span style="color:var(--accent-3)">■ diario ${totals.journal}</span><span style="color:var(--accent-4)">■ recordatorios ${totals.reminders}</span><span style="color:var(--accent-2)">■ chat ${totals.chat}</span></div></div></div>`;
  cont.querySelectorAll('[data-pattern-days]').forEach(btn=>btn.addEventListener('click',()=>{analisisPatternDays=Number(btn.dataset.patternDays);renderAnalisisPatterns(cont,alters);}));
}


function renderAnalisisMoodTimeline(cont, alters) {
  const moods = getMoods();
  const moodById = new Map(moods.map(m=>[m.id,m]));
  const f = analisisMoodTimelineFilter;
  const localDate = value => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value || 0);
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const weekStart = iso => {
    const d = new Date(iso+'T12:00:00');
    d.setDate(d.getDate()-((d.getDay()+6)%7));
    return localDate(d);
  };
  const all = loadTracker().map(e=>({...e,_date:localDate(e.date||e.ts)})).filter(e=>e._date);
  const entries = all.filter(e=>(f.alterId==='all'||e.alterId===f.alterId)&&(!f.from||e._date>=f.from)&&(!f.to||e._date<=f.to)).sort((a,b)=>(a._date===b._date?(b.ts||0)-(a.ts||0):b._date.localeCompare(a._date)));
  const moodCount = {};
  const intensities = [];
  entries.forEach(e=>{ moodCount[e.mood]=(moodCount[e.mood]||0)+1; const n=Number(e.intensity); if(n>=1&&n<=5) intensities.push(n); });
  const topMoodId = Object.entries(moodCount).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topMood = moodById.get(topMoodId);
  const avgIntensity = intensities.length ? (intensities.reduce((a,b)=>a+b,0)/intensities.length).toFixed(1) : '—';
  const grouped = {};
  entries.forEach(e=>{ const key=f.group==='week'?weekStart(e._date):e._date; if(!grouped[key])grouped[key]=[]; grouped[key].push(e); });
  const groups = Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxGroup = Math.max(...groups.map(([,list])=>list.length),1);
  const summarize = list => {
    const counts={}; const ints=[];
    list.forEach(e=>{counts[e.mood]=(counts[e.mood]||0)+1;const n=Number(e.intensity);if(n>=1&&n<=5)ints.push(n);});
    const moodId=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0];
    return {count:list.length,mood:moodById.get(moodId),avg:ints.length?ints.reduce((a,b)=>a+b,0)/ints.length:null};
  };
  const timedEntries = entries.map(e=>{
    const d=new Date(e.ts||0);
    return Number.isFinite(d.getTime())&&localDate(d)===e._date?{...e,_hour:d.getHours()}:null;
  }).filter(Boolean);
  const hourly = Array.from({length:24},(_,hour)=>({hour,list:timedEntries.filter(e=>e._hour===hour)})).filter(row=>row.list.length);
  const weekdayOrder=[1,2,3,4,5,6,0];
  const weekday = weekdayOrder.map(day=>({day,list:entries.filter(e=>new Date(e._date+'T12:00:00').getDay()===day)})).filter(row=>row.list.length);
  const comparisons = ['week','month'].map(kind=>{
    const periods={};
    entries.forEach(e=>{const key=kind==='week'?weekStart(e._date):e._date.slice(0,7);if(!periods[key])periods[key]=[];periods[key].push(e);});
    const keys=Object.keys(periods).sort();
    const currentKey=keys.at(-1); const previousKey=keys.at(-2);
    return {kind,currentKey,previousKey,current:currentKey?summarize(periods[currentKey]):null,previous:previousKey?summarize(periods[previousKey]):null};
  });
  const comparisonLabel = (kind,key) => kind==='week'?`Semana del ${new Date(key+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}`:new Date(key+'-01T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const renderTimeRows = (rows,labelFor) => rows.map(row=>{const s=summarize(row.list);return `<div style="display:grid;grid-template-columns:70px 1fr auto;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)"><span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${labelFor(row)}</span><span style="font-size:11px;color:var(--text-2)">${s.mood?`${s.mood.emoji} ${escM(s.mood.label)}`:'—'}</span><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${s.count} · ${s.avg===null?'—':s.avg.toFixed(1)+'/5'}</span></div>`;}).join('');
  const presentAlterIds = [...new Set(all.map(e=>e.alterId))];
  const filterRow = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px">
    <label><span class="form-label">Identidad</span><select class="form-input" id="mood-timeline-alter"><option value="all">Todas</option>${presentAlterIds.map(id=>{const a=alters.find(x=>x.id===id);return a?`<option value="${id}"${f.alterId===id?' selected':''}>${escM(a.name)}</option>`:'';}).join('')}</select></label>
    <label><span class="form-label">Desde</span><input class="form-input" id="mood-timeline-from" type="date" value="${f.from}"></label>
    <label><span class="form-label">Hasta</span><input class="form-input" id="mood-timeline-to" type="date" value="${f.to}"></label>
    <label><span class="form-label">Agrupar</span><select class="form-input" id="mood-timeline-group"><option value="day"${f.group==='day'?' selected':''}>Día</option><option value="week"${f.group==='week'?' selected':''}>Semana</option></select></label>
  </div>`;
  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:16px">
    <div class="hub-widget"><div class="hw-header"><div class="hw-icon" style="color:var(--accent)">↝</div><div class="hw-title">Timeline emocional</div></div>${filterRow}<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:10px"><span style="font-size:11px;color:var(--text-3)">Resumen descriptivo; no implica diagnóstico, causalidad ni predicción.</span><button class="btn btn-ghost btn-sm" id="mood-timeline-clear">Todo el tiempo</button></div></div>
    ${entries.length?`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px">${_analisisStatCard(entries.length,'Registros','var(--accent)')}${_analisisStatCard(topMood?`${topMood.emoji} ${escM(topMood.label)}`:'—','Más frecuente','var(--accent-3)')}${_analisisStatCard(avgIntensity==='—'?'—':avgIntensity+'/5','Intensidad media','var(--accent-4)')}${_analisisStatCard(groups.length,f.group==='week'?'Semanas con datos':'Días con datos','var(--accent-2)')}</div>
    ${entries.length<3?`<div style="font-size:11px;color:var(--text-3);padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius)">Muestra pequeña: consulta los registros individuales antes de interpretar el resumen.</div>`:''}
    <div class="hub-widget"><div class="hw-header"><div class="hw-icon" style="color:var(--accent-3)">▥</div><div class="hw-title">Frecuencia e intensidad por ${f.group==='week'?'semana':'día'}</div></div><div style="display:flex;flex-direction:column;gap:8px">${groups.map(([key,list])=>{const counts={};const ints=[];list.forEach(e=>{counts[e.mood]=(counts[e.mood]||0)+1;const n=Number(e.intensity);if(n>=1&&n<=5)ints.push(n);});const avg=ints.length?(ints.reduce((a,b)=>a+b,0)/ints.length).toFixed(1):null;const label=f.group==='week'?`Semana del ${new Date(key+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}`:new Date(key+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});return `<div style="display:grid;grid-template-columns:minmax(95px,135px) 1fr auto;gap:8px;align-items:center"><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${label}</span><div><div style="height:8px;border-radius:4px;background:var(--bg-3);overflow:hidden"><div style="height:100%;width:${list.length/maxGroup*100}%;background:var(--accent);border-radius:4px"></div></div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">${Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([id,n])=>{const m=moodById.get(id);return `<span style="font-size:10px;color:var(--text-2)">${m?.emoji||'◎'} ${n}</span>`;}).join('')}</div></div><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${list.length}${avg?' · '+avg+'/5':''}</span></div>`;}).join('')}</div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">
      <div class="hub-widget" id="mood-timeline-hour-summary"><div class="hw-header"><div class="hw-icon" style="color:var(--accent-4)">◷</div><div class="hw-title">Estado más frecuente por hora</div></div>${hourly.length?`<div style="font-size:10px;color:var(--text-3);margin-bottom:6px">Solo incluye ${timedEntries.length} registro${timedEntries.length!==1?'s':''} con hora verificable.</div>${renderTimeRows(hourly,row=>String(row.hour).padStart(2,'0')+':00')}`:'<div style="font-size:11px;color:var(--text-3)">No hay registros con una hora verificable en este rango.</div>'}</div>
      <div class="hub-widget" id="mood-timeline-weekday-summary"><div class="hw-header"><div class="hw-icon" style="color:var(--accent-2)">▦</div><div class="hw-title">Estado más frecuente por día semanal</div></div>${renderTimeRows(weekday,row=>['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][row.day])}</div>
    </div>
    <div class="hub-widget" id="mood-timeline-comparisons"><div class="hw-header"><div class="hw-icon" style="color:var(--accent-3)">⇄</div><div class="hw-title">Comparaciones semanales y mensuales</div></div><div style="font-size:10px;color:var(--text-3);margin-bottom:10px">Compara los dos últimos períodos con datos dentro del filtro actual. Los registros fuente aparecen debajo.</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">${comparisons.map(c=>`<div style="padding:10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-2)"><div style="font-size:11px;font-weight:700;color:var(--text-1);margin-bottom:7px">${c.kind==='week'?'Semana frente a semana':'Mes frente a mes'}</div>${c.current&&c.previous?`<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${comparisonLabel(c.kind,c.previousKey)} → ${comparisonLabel(c.kind,c.currentKey)}</div><div style="font-size:12px;color:var(--text-2);margin-top:6px">Registros: ${c.previous.count} → ${c.current.count} (${c.current.count-c.previous.count>=0?'+':''}${c.current.count-c.previous.count})</div><div style="font-size:11px;color:var(--text-2);margin-top:3px">Intensidad media: ${c.previous.avg===null?'—':c.previous.avg.toFixed(1)} → ${c.current.avg===null?'—':c.current.avg.toFixed(1)}</div><div style="font-size:11px;color:var(--text-2);margin-top:3px">Más frecuente: ${c.previous.mood?c.previous.mood.emoji+' '+escM(c.previous.mood.label):'—'} → ${c.current.mood?c.current.mood.emoji+' '+escM(c.current.mood.label):'—'}</div>`:'<div style="font-size:11px;color:var(--text-3)">Se necesitan registros en al menos dos períodos.</div>'}</div>`).join('')}</div></div>
    <div class="hub-widget"><div class="hw-header"><div class="hw-icon" style="color:var(--accent-2)">≡</div><div class="hw-title">Registros incluidos</div></div><div style="display:flex;flex-direction:column;gap:7px">${entries.map(e=>{const a=alters.find(x=>x.id===e.alterId);const m=moodById.get(e.mood);return `<div style="display:flex;gap:9px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:20px">${m?.emoji||'◎'}</span><div style="flex:1;min-width:0"><div style="font-size:12px;color:var(--text-1)">${escM(m?.label||e.mood||'—')} ${e.intensity?`<span style="color:var(--text-3)">· ${e.intensity}/5</span>`:''}</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${new Date(e._date+'T12:00:00').toLocaleDateString('es-ES')} · ${escM(a?.name||'—')}</div>${e.note?`<div style="font-size:11px;color:var(--text-2);margin-top:3px">${escM(e.note)}</div>`:''}</div></div>`;}).join('')}</div></div>`:`<div class="empty-state" style="padding:50px 20px"><div class="empty-icon">◎</div><div>Sin registros en este rango</div></div>`}
  </div>`;
  const snapshotHost = document.createElement('div'); cont.appendChild(snapshotHost); if (typeof renderP5Snapshots === 'function') renderP5Snapshots(snapshotHost, entries, f);
  const apply=()=>{f.alterId=cont.querySelector('#mood-timeline-alter').value;f.from=cont.querySelector('#mood-timeline-from').value;f.to=cont.querySelector('#mood-timeline-to').value;f.group=cont.querySelector('#mood-timeline-group').value;if(f.from&&f.to&&f.from>f.to){[f.from,f.to]=[f.to,f.from];}renderAnalisisMoodTimeline(cont,alters);};
  ['mood-timeline-alter','mood-timeline-from','mood-timeline-to','mood-timeline-group'].forEach(id=>cont.querySelector('#'+id)?.addEventListener('change',apply));
  cont.querySelector('#mood-timeline-clear')?.addEventListener('click',()=>{analisisMoodTimelineFilter={alterId:'all',from:'',to:'',group:f.group};renderAnalisisMoodTimeline(cont,alters);});
}
function renderSafeProfileMarkdown(str) {
  if (window.AtriaSafeMarkdown) return window.AtriaSafeMarkdown.render(str);
  return esc(str).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/__(.+?)__/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>').replace(/(^|[^_])_([^_\n]+)_/g,'$1<em>$2</em>').replace(/\n/g,'<br>');
}

// ── EMOCIONES ──
function renderAnalisisEmociones(cont, alters) {
  const entries = loadTracker();
  const moods   = getMoods();

  if (!entries.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:60px 20px"><div class="empty-icon">◎</div><div>Sin registros emocionales</div></div>`;
    return;
  }

  // Global mood distribution
  const moodCount = {};
  moods.forEach(m=>{ moodCount[m.id]=0; });
  entries.forEach(e=>{ if(moodCount[e.mood]!==undefined) moodCount[e.mood]++; else moodCount[e.mood]=(moodCount[e.mood]||0)+1; });
  const totalMoods = entries.length;
  const sortedMoods = moods.filter(m=>moodCount[m.id]>0).sort((a,b)=>(moodCount[b.id]||0)-(moodCount[a.id]||0));

  // Per-alter top moods
  const byAlter = {};
  entries.forEach(e=>{
    if (!byAlter[e.alterId]) byAlter[e.alterId] = {moodCounts:{}, intensities:[], count:0};
    byAlter[e.alterId].moodCounts[e.mood] = (byAlter[e.alterId].moodCounts[e.mood]||0)+1;
    if (e.intensity) byAlter[e.alterId].intensities.push(e.intensity);
    byAlter[e.alterId].count++;
  });

  // Last 30 days mood by day (for trend)
  const last30 = {};
  const now = Date.now();
  for (let i=29;i>=0;i--) {
    const d = new Date(now - i*86400000).toISOString().slice(0,10);
    last30[d] = {date:d, entries:[]};
  }
  entries.forEach(e=>{ if(last30[e.date]) last30[e.date].entries.push(e); });

  // Build MOOD_SCORE for trend
  const MOOD_SCORE = {};
  moods.forEach((m,i)=>{ MOOD_SCORE[m.id] = Math.max(1, Math.round(5-(i/Math.max(moods.length-1,1))*4)); });
  const trendDays = Object.values(last30);
  const maxScore  = Math.max(...trendDays.map(d=>d.entries.length ? d.entries.reduce((s,e)=>s+(MOOD_SCORE[e.mood]||3),0)/d.entries.length : 0), 1);

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <!-- Global mood freq -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Distribución global · ${totalMoods} registros</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sortedMoods.map(m=>{
            const c = moodCount[m.id]||0;
            const pct = Math.round((c/totalMoods)*100);
            return `<div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:18px">${m.emoji}</span>
                <span style="font-size:12px;color:var(--text-1);flex:1">${escM(m.label)}</span>
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${c} · ${pct}%</span>
              </div>
              ${_analisisBarH(pct, 'var(--accent)')}
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Trend últimos 30 días -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Tendencia · últimos 30 días</div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:48px">
          ${trendDays.map((d,i)=>{
            const score = d.entries.length ? d.entries.reduce((s,e)=>s+(MOOD_SCORE[e.mood]||3),0)/d.entries.length : 0;
            const h = score>0 ? Math.max(Math.round((score/maxScore)*44),4) : 2;
            const isToday = d.date === new Date().toISOString().slice(0,10);
            return `<div style="flex:1;border-radius:2px 2px 0 0;background:${score>0?(isToday?'var(--accent)':'var(--accent-3)'):'var(--bg-3)'};height:${h}px" title="${d.date}${d.entries.length?' · '+d.entries.length+' registro'+(d.entries.length!==1?'s':''):''}"></div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3)">hace 30 días</span>
          <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3)">hoy</span>
        </div>
      </div>

      <!-- Por alter -->
      ${Object.keys(byAlter).length > 1 ? `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Por alter</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${Object.entries(byAlter).sort((a,b)=>b[1].count-a[1].count).map(([aid,st])=>{
            const alt = alters.find(a=>a.id===aid); if(!alt) return '';
            const top3 = Object.entries(st.moodCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
            const avgInt = st.intensities.length ? (st.intensities.reduce((a,b)=>a+b,0)/st.intensities.length).toFixed(1) : null;
            return `<div style="display:flex;align-items:flex-start;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
              <span style="font-size:22px;flex-shrink:0">${escM(alt.emoji||'●')}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:${alt.color||'var(--text-1)'};">${escM(alt.name)}</div>
                <div style="font-size:11px;color:var(--text-3);margin-top:2px">${st.count} registro${st.count!==1?'s':''}${avgInt?' · int. '+avgInt+'/5':''}</div>
                <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
                  ${top3.map(([mid,c])=>{ const m=moods.find(x=>x.id===mid); return m?`<span style="font-size:11px;background:var(--bg-2);border:1px solid var(--border);border-radius:20px;padding:2px 8px">${m.emoji} ${escM(m.label)} <span style="color:var(--text-3)">${c}</span></span>`:''; }).join('')}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>`;
}

// ── TRIGGERS ──
function renderAnalisisTriggers(cont, alters) {
  const crisisLog = loadCrisisLog();
  const triggers  = loadSaludTriggers();

  if (!crisisLog.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:60px 20px"><div class="empty-icon">⚡</div><div>Sin episodios de crisis registrados</div></div>`;
    return;
  }

  // Trigger frequency
  const trigCount = {};
  crisisLog.forEach(e=>{ if(e.triggerId) trigCount[e.triggerId]=(trigCount[e.triggerId]||0)+1; });
  const maxTrigCount = Math.max(...Object.values(trigCount), 1);
  const sortedTrigs  = Object.entries(trigCount).sort((a,b)=>b[1]-a[1]);

  // Crisis level distribution
  const levelCount = {};
  crisisLog.forEach(e=>{ levelCount[e.level]=(levelCount[e.level]||0)+1; });
  const totalCrisis = crisisLog.length;

  // Average duration per level
  const levelDur = {};
  const levelN   = {};
  crisisLog.forEach(e=>{
    if (e.endedAt && e.startedAt) {
      levelDur[e.level] = (levelDur[e.level]||0) + (e.endedAt - e.startedAt);
      levelN[e.level]   = (levelN[e.level]||0) + 1;
    }
  });

  // Without trigger
  const noTrigger = crisisLog.filter(e=>!e.triggerId).length;

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <!-- Resumen niveles -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Distribución por nivel · ${totalCrisis} episodios</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${CRISIS_LEVELS.filter(l=>levelCount[l.id]).map(l=>{
            const c   = levelCount[l.id]||0;
            const pct = Math.round((c/totalCrisis)*100);
            const avgD= levelN[l.id] ? fmtDuration(Math.round(levelDur[l.id]/levelN[l.id])) : null;
            return `<div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span class="proto-level-badge" style="color:${l.color};border-color:${l.color};background:${l.bg};flex-shrink:0">${l.label}</span>
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);flex:1">${c} episodio${c!==1?'s':''}${avgD?' · media '+avgD:''}</span>
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${pct}%</span>
              </div>
              ${_analisisBarH(pct, l.color)}
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Trigger frequency -->
      ${sortedTrigs.length ? `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Frecuencia de triggers</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sortedTrigs.map(([tid,c])=>{
            const trig = triggers.find(t=>t.id===tid);
            const pct  = Math.round((c/maxTrigCount)*100);
            // Qué niveles tiene este trigger
            const thisLevels = {};
            crisisLog.filter(e=>e.triggerId===tid).forEach(e=>{ thisLevels[e.level]=(thisLevels[e.level]||0)+1; });
            const topLevel = Object.entries(thisLevels).sort((a,b)=>b[1]-a[1])[0]?.[0];
            const lvl = CRISIS_LEVELS.find(l=>l.id===topLevel);
            return `<div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:14px">⚡</span>
                <span style="font-size:12px;color:var(--text-1);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escM(trig?.titulo||tid)}</span>
                ${lvl?`<span style="font-size:10px;color:${lvl.color};border:1px solid ${lvl.color};background:${lvl.bg};border-radius:4px;padding:1px 5px;flex-shrink:0">${lvl.label}</span>`:''}
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);flex-shrink:0">${c}×</span>
              </div>
              ${_analisisBarH(pct, '#ff8ae2')}
            </div>`;
          }).join('')}
          ${noTrigger>0?`<div style="font-size:11px;color:var(--text-3);padding-top:4px;border-top:1px solid var(--border)">${noTrigger} episodio${noTrigger!==1?'s':''} sin trigger registrado</div>`:''}
        </div>
      </div>` : `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:20px;text-align:center;color:var(--text-3);font-size:13px">Sin triggers asociados a los episodios</div>`}
    </div>`;
}

function renderTracker() {
  return window.AtriaTrackerView.render();
}
function openReminderModal(reminder, onDone) {
  const isEdit = !!reminder;
  const r = reminder || {
    title:'', desc:'', icon:'🔔', datetime: Date.now() + 3600000,
    recurrence:'none', alterId: activeAlter?.id||null, done: false
  };

  const alters = getAlters();
  const dtStr = new Date(r.datetime).toISOString().slice(0,16); // datetime-local format

  const modalHTML = `
    <div class="modal-title">${isEdit?'Editar recordatorio':'Nuevo recordatorio'}</div>
    <div class="reminder-form-grid">
      <div class="form-row">
        <div class="form-label">Icono</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px">
          ${REMINDER_ICONS.map(ic=>`<div class="emoji-opt-btn${r.icon===ic?' selected':''}" data-ri="${ic}" style="font-size:20px;width:36px;height:36px">${ic}</div>`).join('')}
        </div>
        <input type="hidden" id="r-icon" value="${r.icon||'🔔'}">
      </div>
      <div class="form-row">
        <div class="form-label">Título</div>
        <input type="text" id="r-title" placeholder="Qué recordar..." value="${r.title||''}">
      </div>
      <div class="form-row">
        <div class="form-label">Descripción (opcional)</div>
        <textarea id="r-desc" rows="2" placeholder="Detalles...">${r.desc||''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Fecha y hora</div>
        <input type="datetime-local" id="r-datetime" value="${dtStr}">
      </div>
      <div class="form-row">
        <div class="form-label">Repetición</div>
        <div class="recurrence-opts">
          ${REMINDER_RECURRENCE.map(rc=>`<div class="rec-opt${r.recurrence===rc.id?' selected':''}" data-rc="${rc.id}">${rc.label}</div>`).join('')}
        </div>
        <input type="hidden" id="r-recurrence" value="${r.recurrence||'none'}">
      </div>
      <div class="form-row">
        <div class="form-label">Para alter (opcional)</div>
        <select id="r-alter">
          <option value="">Todo el sistema</option>
          ${alters.map(a=>`<option value="${a.id}" ${r.alterId===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancelar</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Guardar':'Crear'}</button>
    </div>`;

  openModal(modalHTML, ov => {
    const title = ov.querySelector('#r-title').value.trim();
    if (!title) { showToast('⚠ El título es obligatorio'); return; }
    const datetimeVal = ov.querySelector('#r-datetime').value;
    if (!datetimeVal) { showToast('⚠ La fecha es obligatoria'); return; }
    const datetime = new Date(datetimeVal).getTime();
    const entry = {
      id: isEdit ? r.id : uid(),
      title,
      desc: ov.querySelector('#r-desc').value.trim(),
      icon: ov.querySelector('#r-icon').value,
      datetime,
      recurrence: ov.querySelector('#r-recurrence').value,
      alterId: ov.querySelector('#r-alter').value || null,
      done: false,
    };
    const list = loadReminders();
    if (isEdit) { const i=list.findIndex(x=>x.id===r.id); if(i>=0) list[i]=entry; else list.push(entry); }
    else list.push(entry);
    saveReminders(list);
    closeModal();
    showToast(isEdit?'Recordatorio actualizado ✓':'Recordatorio creado ✓');
    if (onDone) onDone();
  });

  const ov = document.querySelector('.modal-overlay');
  // Icon picker
  ov.querySelectorAll('[data-ri]').forEach(btn => {
    btn.addEventListener('click', () => {
      ov.querySelectorAll('[data-ri]').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      ov.querySelector('#r-icon').value = btn.dataset.ri;
    });
  });
  // Recurrence opts
  ov.querySelectorAll('[data-rc]').forEach(btn => {
    btn.addEventListener('click', () => {
      ov.querySelectorAll('[data-rc]').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      ov.querySelector('#r-recurrence').value = btn.dataset.rc;
    });
  });
}

function checkReminderAlerts() {
  // Mostrar badge en hub si hay recordatorios vencidos o para hoy
  const now = Date.now();
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const pending = loadReminders().filter(r =>
    !r.done && r.datetime <= todayEnd.getTime() &&
    (!r.alterId || r.alterId === activeAlter?.id)
  );
  // Actualizar badge en hub si existe
  const badge = document.querySelector('[data-id="reminders"] .hub-btn-badge, #hub-reminder-badge');
  if (badge && pending.length > 0) {
    badge.textContent = pending.length;
    badge.classList.add('num');
  }
}


// ═══════════════════════════════════════════════
// FICHAS DE ALTERS
// ═══════════════════════════════════════════════
function loadFichas()  { try { return JSON.parse(localStorage.getItem('tid_alter_fichas'))||[]; } catch{return[];} }
function saveFichas(f) { localStorage.setItem('tid_alter_fichas', JSON.stringify(f)); }

function escF(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════════════════
// EXPORTAR FICHA COMO IMAGEN
// ═══════════════════════════════════════════════
function exportFichaAsImage(fichaId) {
  const fichas = loadFichas();
  const f = fichas.find(x => x.id === fichaId);
  if (!f) return;

  const btn = document.querySelector(`[data-ficha-export="${fichaId}"]`);
  if (btn) { btn.classList.add('loading'); btn.textContent = '…'; }

  const color = f.color || '#a08aff';
  const hex = color.replace('#','');
  const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
  const bgAccent = `rgba(${r},${g},${b},0.08)`;
  const freqLabel = {rara:'○ Rara', ocasional:'◑ Ocasional', frecuente:'● Frecuente'}[f.frecuencia||'ocasional'];
  const freqColors = {rara:'rgba(95,255,176,.2)', ocasional:'rgba(255,180,80,.2)', frecuente:'rgba(160,138,255,.25)'};
  const freqTextColors = {rara:'#5fffb0', ocasional:'#ffb450', frecuente:'#a08aff'};

  const rasgosHtml = (f.rasgos||[]).map(r => `<span class="fec-tag">${r}</span>`).join('');
  const paletteHtml = (f.paleta||[]).map(c => `<div class="fec-swatch" style="background:${c}"></div>`).join('');
  const moodHtml = (f.moodboard||[]).map(w => `<span class="fec-tag">${w}</span>`).join('');

  const nivelEmocional = f.nivel_emocional || 50;
  const energiaHab = ((f.energia_habitual || 3) / 5) * 100;

  const fv = (val) => val ? `<div class="fec-value">${val}</div>` : '';
  const frow = (label, val) => val ? `<div class="fec-field"><div class="fec-label">${label}</div><div class="fec-value">${val}</div></div>` : '';

  const stage = document.getElementById('ficha-export-stage');
  stage.innerHTML = `
    <div class="ficha-export-card" id="fec-render">
      ${f.bannerImg ? `<div style="height:70px;background-image:url(${f.bannerImg});background-size:cover;background-position:center;border-radius:12px 12px 0 0;flex-shrink:0"></div>` : ''}
      <div class="fec-header" style="background:${bgAccent}${f.bannerImg?';padding-top:20px':''}">
        <div class="fec-avatar" style="background:${f.bg||bgAccent};border:2px solid ${color}">
          ${f.avatarImg ? `<img src="${f.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : (f.emoji || '◎')}
          <div class="fec-avatar-symbol" style="color:${color};border:1px solid ${color}">${f.symbol || '◈'}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="fec-name">${f.nombre || 'Sin nombre'}</div>
          ${f.apodos ? `<div style="font-size:10px;color:#8884a8;font-family:'DM Mono',monospace;margin-bottom:2px">${f.apodos}</div>` : ''}
          <div class="fec-archetype">${[f.arquetipo, f.genero, f.edad].filter(Boolean).join(' · ') || '—'}</div>
          <div class="fec-pronombres" style="color:${color}">${f.pronombres || '—'}</div>
        </div>
        <div class="fec-freq" style="border-color:${freqColors[f.frecuencia||'ocasional']};color:${freqTextColors[f.frecuencia||'ocasional']};background:${freqColors[f.frecuencia||'ocasional']}">${freqLabel}</div>
      </div>
      <div class="fec-body">
        ${f.frase ? `<div class="fec-quote" style="border-color:${color};color:#b8b4d8">${f.frase}</div>` : ''}
        ${f.frase_larga ? `<div class="fec-field"><div class="fec-label">Reflexión</div><div class="fec-value" style="font-style:italic">${f.frase_larga}</div></div>` : ''}

        <div class="fec-row">
          ${frow('Rol en el sistema', f.rol_publico)}
          ${frow('Energía · Elemento', [f.energia, f.elemento].filter(Boolean).join(' · '))}
        </div>

        ${f.descripcion ? `<div class="fec-field"><div class="fec-label">Descripción</div><div class="fec-value">${f.descripcion}</div></div>` : ''}

        ${rasgosHtml ? `<div class="fec-field"><div class="fec-label">Rasgos</div><div class="fec-tags">${rasgosHtml}</div></div>` : ''}

        ${(f.fortalezas || f.vulnerabilidades) ? `
        <div class="fec-row">
          ${f.fortalezas ? `<div class="fec-field"><div class="fec-label">Fortalezas</div><div class="fec-value">${f.fortalezas}</div></div>` : '<div></div>'}
          ${f.vulnerabilidades ? `<div class="fec-field"><div class="fec-label">Vulnerabilidades</div><div class="fec-value">${f.vulnerabilidades}</div></div>` : '<div></div>'}
        </div>` : ''}

        ${f.valores ? `<div class="fec-field"><div class="fec-label">Valores</div><div class="fec-value">${f.valores}</div></div>` : ''}
        ${f.conflicto ? `<div class="fec-field"><div class="fec-label">Conflicto interno</div><div class="fec-value">${f.conflicto}</div></div>` : ''}

        ${(f.senales || f.afinidades || f.limites) ? `
        <div class="fec-field" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">
          <div class="fec-label" style="margin-bottom:6px">Sistema</div>
          ${f.senales ? `<div style="margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Señales: </span><span style="font-size:11px;color:#c8c4e8">${f.senales}</span></div>` : ''}
          ${f.afinidades ? `<div style="margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Afinidades: </span><span style="font-size:11px;color:#c8c4e8">${f.afinidades}</span></div>` : ''}
          ${f.limites ? `<div><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Límites: </span><span style="font-size:11px;color:#c8c4e8">${f.limites}</span></div>` : ''}
        </div>` : ''}

        <div class="fec-bars">
          <div class="fec-bar-wrap">
            <div class="fec-bar-label">Emocional</div>
            <div class="fec-bar-track"><div class="fec-bar-fill" style="width:${nivelEmocional}%;background:linear-gradient(90deg,${color},#ff8ae2)"></div></div>
            <span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">${nivelEmocional}%</span>
          </div>
          <div class="fec-bar-wrap">
            <div class="fec-bar-label">Energía hab.</div>
            <div class="fec-bar-track"><div class="fec-bar-fill" style="width:${energiaHab}%;background:${color}"></div></div>
            <span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">${f.energia_habitual||3}/5</span>
          </div>
        </div>

        ${(f.estetica || f.musica || f.colores) ? `
        <div class="fec-row">
          ${f.estetica ? `<div class="fec-field"><div class="fec-label">Estética</div><div class="fec-value">${f.estetica}</div></div>` : '<div></div>'}
          ${f.musica ? `<div class="fec-field"><div class="fec-label">Música</div><div class="fec-value">${f.musica}</div></div>` : '<div></div>'}
        </div>` : ''}
        ${f.colores ? `<div class="fec-field"><div class="fec-label">Colores</div><div class="fec-value">${f.colores}</div></div>` : ''}

        ${(f.animal || f.objeto || f.estacion) ? `
        <div class="fec-row">
          ${f.animal ? `<div class="fec-field"><div class="fec-label">Animal</div><div class="fec-value">${f.animal}</div></div>` : '<div></div>'}
          ${f.objeto ? `<div class="fec-field"><div class="fec-label">Objeto</div><div class="fec-value">${f.objeto}</div></div>` : '<div></div>'}
          ${f.estacion ? `<div class="fec-field"><div class="fec-label">Estación</div><div class="fec-value">${f.estacion}</div></div>` : '<div></div>'}
        </div>` : ''}

        ${paletteHtml ? `<div class="fec-field"><div class="fec-label">Paleta personal</div><div class="fec-palette">${paletteHtml}</div></div>` : ''}
        ${moodHtml ? `<div class="fec-field"><div class="fec-label">Moodboard</div><div class="fec-tags">${moodHtml}</div></div>` : ''}

        ${(f.habilidades || f.social) ? `
        <div class="fec-row">
          ${f.habilidades ? `<div class="fec-field"><div class="fec-label">Habilidades</div><div class="fec-value">${f.habilidades}</div></div>` : '<div></div>'}
          ${f.social ? `<div class="fec-field"><div class="fec-label">Social</div><div class="fec-value">${f.social}</div></div>` : '<div></div>'}
        </div>` : ''}

        ${f.como_hablar ? `<div class="fec-field"><div class="fec-label">Cómo hablarle</div><div class="fec-value">${f.como_hablar}</div></div>` : ''}
        ${f.incomoda ? `<div class="fec-field"><div class="fec-label">Qué le incomoda</div><div class="fec-value">${f.incomoda}</div></div>` : ''}
        ${f.seguridad ? `<div class="fec-field"><div class="fec-label">Qué le hace sentir segurx</div><div class="fec-value">${f.seguridad}</div></div>` : ''}

        ${(()=>{ const cfs=(f.customFields||[]).filter(cf=>cf.key); return cfs.length ? `
        <div class="fec-field" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">
          <div class="fec-label" style="margin-bottom:6px">Campos adicionales</div>
          ${cfs.map(cf=>`<div style="display:flex;gap:8px;margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90;min-width:90px;flex-shrink:0">${cf.key}</span><span style="font-size:11px;color:#c8c4e8">${cf.value||'—'}</span></div>`).join('')}
        </div>` : ''; })()}
      </div>
      <div class="fec-footer">
        <span class="fec-footer-label">Atria</span>
        <span class="fec-footer-label" style="color:${color}">${f.nombre || ''} ${f.symbol || '◈'}</span>
      </div>
    </div>`;

  const node = document.getElementById('fec-render');

  setTimeout(() => {
    if (typeof html2canvas === 'undefined') {
      stage.innerHTML = '';
      if (btn) { btn.classList.remove('loading'); btn.textContent = '\u2193 img'; }
      showToast('La exportación de imagen requiere conexión o librería local');
      return;
    }
    html2canvas(node, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `ficha-${(f.nombre||'alter').toLowerCase().replace(/\s+/g,'-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      stage.innerHTML = '';
      if (btn) { btn.classList.remove('loading'); btn.textContent = '↓ img'; }
      showToast(`Ficha de ${f.nombre} exportada ✓`);
    }).catch(() => {
      stage.innerHTML = '';
      if (btn) { btn.classList.remove('loading'); btn.textContent = '↓ img'; }
      showToast('⚠ Error al exportar la imagen');
    });
  }, 100);
}

function exportFichaAsHTML(fichaId) {
  const fichas = loadFichas();
  const f = fichas.find(x => x.id === fichaId);
  if (!f) return;

  const color = f.color || '#a08aff';
  const hex = color.replace('#','');
  const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
  const bgAccent = `rgba(${r},${g},${b},0.08)`;
  const freqLabel = {rara:'○ Rara', ocasional:'◑ Ocasional', frecuente:'● Frecuente'}[f.frecuencia||'ocasional'];
  const freqColors = {rara:'rgba(95,255,176,.2)', ocasional:'rgba(255,180,80,.2)', frecuente:'rgba(160,138,255,.25)'};
  const freqTextColors = {rara:'#5fffb0', ocasional:'#ffb450', frecuente:'#a08aff'};

  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const rasgosHtml = (f.rasgos||[]).map(r2 => `<span class="fec-tag">${esc(r2)}</span>`).join('');
  const paletteHtml = (f.paleta||[]).map(c => `<div class="fec-swatch" style="background:${c}"></div>`).join('');
  const moodHtml = (f.moodboard||[]).map(w => `<span class="fec-tag">${esc(w)}</span>`).join('');
  const nivelEmocional = f.nivel_emocional || 50;
  const energiaHab = ((f.energia_habitual || 3) / 5) * 100;
  const frow = (label, val) => val ? `<div class="fec-field"><div class="fec-label">${label}</div><div class="fec-value">${esc(val)}</div></div>` : '';

  const cardHTML = `
    ${f.bannerImg ? `<div style="height:70px;background-image:url(${f.bannerImg});background-size:cover;background-position:center;border-radius:12px 12px 0 0;flex-shrink:0"></div>` : ''}
    <div class="fec-header" style="background:${bgAccent}${f.bannerImg?';padding-top:20px':''}">
      <div class="fec-avatar" style="background:${f.bg||bgAccent};border:2px solid ${color}">
        ${f.avatarImg ? `<img src="${f.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : esc(f.emoji || '◎')}
        <div class="fec-avatar-symbol" style="color:${color};border:1px solid ${color}">${esc(f.symbol || '◈')}</div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="fec-name">${esc(f.nombre || 'Sin nombre')}</div>
        ${f.apodos ? `<div style="font-size:10px;color:#8884a8;font-family:'DM Mono',monospace;margin-bottom:2px">${esc(f.apodos)}</div>` : ''}
        <div class="fec-archetype">${esc([f.arquetipo, f.genero, f.edad].filter(Boolean).join(' · ') || '—')}</div>
        <div class="fec-pronombres" style="color:${color}">${esc(f.pronombres || '—')}</div>
      </div>
      <div class="fec-freq" style="border-color:${freqColors[f.frecuencia||'ocasional']};color:${freqTextColors[f.frecuencia||'ocasional']};background:${freqColors[f.frecuencia||'ocasional']}">${freqLabel}</div>
    </div>
    <div class="fec-body">
      ${f.frase ? `<div class="fec-quote" style="border-color:${color};color:#b8b4d8">${esc(f.frase)}</div>` : ''}
      ${f.frase_larga ? `<div class="fec-field"><div class="fec-label">Reflexión</div><div class="fec-value" style="font-style:italic">${esc(f.frase_larga)}</div></div>` : ''}
      <div class="fec-row">
        ${frow('Rol en el sistema', f.rol_publico)}
        ${frow('Energía · Elemento', [f.energia, f.elemento].filter(Boolean).join(' · '))}
      </div>
      ${f.descripcion ? `<div class="fec-field"><div class="fec-label">Descripción</div><div class="fec-value">${esc(f.descripcion)}</div></div>` : ''}
      ${rasgosHtml ? `<div class="fec-field"><div class="fec-label">Rasgos</div><div class="fec-tags">${rasgosHtml}</div></div>` : ''}
      ${(f.fortalezas || f.vulnerabilidades) ? `<div class="fec-row">
        ${f.fortalezas ? `<div class="fec-field"><div class="fec-label">Fortalezas</div><div class="fec-value">${esc(f.fortalezas)}</div></div>` : '<div></div>'}
        ${f.vulnerabilidades ? `<div class="fec-field"><div class="fec-label">Vulnerabilidades</div><div class="fec-value">${esc(f.vulnerabilidades)}</div></div>` : '<div></div>'}
      </div>` : ''}
      ${frow('Valores', f.valores)}
      ${frow('Conflicto interno', f.conflicto)}
      ${(f.senales || f.afinidades || f.limites) ? `<div class="fec-field" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">
        <div class="fec-label" style="margin-bottom:6px">Sistema</div>
        ${f.senales ? `<div style="margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Señales: </span><span style="font-size:11px;color:#c8c4e8">${esc(f.senales)}</span></div>` : ''}
        ${f.afinidades ? `<div style="margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Afinidades: </span><span style="font-size:11px;color:#c8c4e8">${esc(f.afinidades)}</span></div>` : ''}
        ${f.limites ? `<div><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Límites: </span><span style="font-size:11px;color:#c8c4e8">${esc(f.limites)}</span></div>` : ''}
      </div>` : ''}
      <div class="fec-bars">
        <div class="fec-bar-wrap">
          <div class="fec-bar-label">Emocional</div>
          <div class="fec-bar-track"><div class="fec-bar-fill" style="width:${nivelEmocional}%;background:linear-gradient(90deg,${color},#ff8ae2)"></div></div>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">${nivelEmocional}%</span>
        </div>
        <div class="fec-bar-wrap">
          <div class="fec-bar-label">Energía hab.</div>
          <div class="fec-bar-track"><div class="fec-bar-fill" style="width:${energiaHab}%;background:${color}"></div></div>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">${f.energia_habitual||3}/5</span>
        </div>
      </div>
      ${(f.estetica || f.musica) ? `<div class="fec-row">
        ${f.estetica ? `<div class="fec-field"><div class="fec-label">Estética</div><div class="fec-value">${esc(f.estetica)}</div></div>` : '<div></div>'}
        ${f.musica ? `<div class="fec-field"><div class="fec-label">Música</div><div class="fec-value">${esc(f.musica)}</div></div>` : '<div></div>'}
      </div>` : ''}
      ${frow('Colores', f.colores)}
      ${(f.animal || f.objeto || f.estacion) ? `<div class="fec-row">
        ${f.animal ? `<div class="fec-field"><div class="fec-label">Animal</div><div class="fec-value">${esc(f.animal)}</div></div>` : '<div></div>'}
        ${f.objeto ? `<div class="fec-field"><div class="fec-label">Objeto</div><div class="fec-value">${esc(f.objeto)}</div></div>` : '<div></div>'}
        ${f.estacion ? `<div class="fec-field"><div class="fec-label">Estación</div><div class="fec-value">${esc(f.estacion)}</div></div>` : '<div></div>'}
      </div>` : ''}
      ${paletteHtml ? `<div class="fec-field"><div class="fec-label">Paleta personal</div><div class="fec-palette">${paletteHtml}</div></div>` : ''}
      ${moodHtml ? `<div class="fec-field"><div class="fec-label">Moodboard</div><div class="fec-tags">${moodHtml}</div></div>` : ''}
      ${(f.habilidades || f.social) ? `<div class="fec-row">
        ${f.habilidades ? `<div class="fec-field"><div class="fec-label">Habilidades</div><div class="fec-value">${esc(f.habilidades)}</div></div>` : '<div></div>'}
        ${f.social ? `<div class="fec-field"><div class="fec-label">Social</div><div class="fec-value">${esc(f.social)}</div></div>` : '<div></div>'}
      </div>` : ''}
      ${frow('Cómo hablarle', f.como_hablar)}
      ${frow('Qué le incomoda', f.incomoda)}
      ${frow('Qué le hace sentir segurx', f.seguridad)}
      ${(()=>{ const cfs=(f.customFields||[]).filter(cf=>cf.key); return cfs.length ? `<div class="fec-field" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">
        <div class="fec-label" style="margin-bottom:6px">Campos adicionales</div>
        ${cfs.map(cf=>`<div style="display:flex;gap:8px;margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90;min-width:90px;flex-shrink:0">${esc(cf.key)}</span><span style="font-size:11px;color:#c8c4e8">${esc(cf.value||'—')}</span></div>`).join('')}
      </div>` : ''; })()}
    </div>
    <div class="fec-footer">
      <span class="fec-footer-label">Atria</span>
      <span class="fec-footer-label" style="color:${color}">${esc(f.nombre || '')} ${esc(f.symbol || '◈')}</span>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ficha — ${esc(f.nombre || 'Alter')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a14;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;padding:40px 20px;font-family:'Syne',system-ui,sans-serif}
.ficha-export-card{width:480px;max-width:100%;background:#10101a;border-radius:16px;overflow:hidden;font-family:'Syne',system-ui,sans-serif;border:1px solid rgba(120,120,200,0.15)}
.fec-header{padding:28px 28px 20px;display:flex;align-items:center;gap:18px;border-bottom:1px solid rgba(120,120,200,0.10)}
.fec-avatar{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;flex-shrink:0;position:relative}
.fec-avatar-symbol{position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:#10101a;display:flex;align-items:center;justify-content:center;font-size:10px}
.fec-name{font-size:22px;font-weight:800;letter-spacing:-.02em;color:#f0eeff;line-height:1.1}
.fec-archetype{font-family:'DM Mono',monospace;font-size:11px;color:#6e6a90;margin-top:4px;letter-spacing:.08em}
.fec-pronombres{font-family:'DM Mono',monospace;font-size:10px;margin-top:3px}
.fec-body{padding:20px 28px;display:flex;flex-direction:column;gap:14px}
.fec-quote{font-size:13px;font-style:italic;color:#b8b4d8;line-height:1.6;padding:12px 16px;background:rgba(255,255,255,.03);border-left:3px solid;border-radius:0 8px 8px 0}
.fec-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fec-field{display:flex;flex-direction:column;gap:3px}
.fec-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#3e3a5a}
.fec-value{font-size:12px;color:#b8b4d8;line-height:1.4}
.fec-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}
.fec-tag{font-family:'DM Mono',monospace;font-size:9px;padding:2px 7px;border-radius:4px;background:#1e1e35;border:1px solid rgba(120,120,200,0.12);color:#b8b4d8}
.fec-palette{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.fec-swatch{width:20px;height:20px;border-radius:50%;border:1px solid rgba(255,255,255,.1)}
.fec-bars{display:flex;flex-direction:column;gap:5px}
.fec-bar-wrap{display:flex;align-items:center;gap:8px}
.fec-bar-label{font-family:'DM Mono',monospace;font-size:9px;color:#3e3a5a;width:60px;flex-shrink:0}
.fec-bar-track{flex:1;height:4px;background:#1e1e35;border-radius:3px;overflow:hidden}
.fec-bar-fill{height:100%;border-radius:3px}
.fec-footer{padding:14px 28px;border-top:1px solid rgba(120,120,200,0.08);display:flex;align-items:center;justify-content:space-between}
.fec-footer-label{font-family:'DM Mono',monospace;font-size:9px;color:#3e3a5a;letter-spacing:.1em}
.fec-freq{font-family:'DM Mono',monospace;font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid}
</style>
</head>
<body>
<div class="ficha-export-card">${cardHTML}</div>
</body>
</html>`;

  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ficha-${(f.nombre||'alter').toLowerCase().replace(/\s+/g,'-')}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  showToast(`Ficha de ${f.nombre} exportada como HTML ✓`);
}

function renderFichas() {
  alteresTab = 'fichas';
  renderAlters();
}

function renderFichasInAltersContainer(cont) {
  if (!cont) return;
  let fichas = loadFichas();
  if(!fichas.length) {
    cont.innerHTML = `
    <div class="empty-state" style="padding:60px 20px">
      <div class="empty-icon">◈</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">Sin fichas creadas</div>
      <div>Crea fichas de presentación detalladas para los alters del sistema.</div>
      <button class="btn btn-primary" style="margin-top:16px" id="btn-new-ficha-2">Crear primera ficha</button>
    </div>`;
    cont.querySelector('#btn-new-ficha-2')?.addEventListener('click', () => openFichaModal(null));
    return;
  }

  // Filtrar por rol si hay filtro activo
  if(alteresRoleFilter) fichas = fichas.filter(f => (f.rol_publico||'').trim().toLowerCase() === alteresRoleFilter.trim().toLowerCase());
  // Ordenar
  if(alteresSortMode === 'alpha') fichas = [...fichas].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  else if(alteresSortMode === 'date') fichas = [...fichas].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));

  const isListMode = alteresViewMode === 'list';
  const gridClass = isListMode ? 'fichas-list' : 'fichas-grid';

  cont.innerHTML = `<div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <div style="position:relative;flex:1;min-width:200px;max-width:320px">
          <input id="fichas-search" type="text" placeholder="Buscar por nombre, rol o arquetipo…"
            style="width:100%;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;color:var(--text-0);font-family:'Syne',sans-serif;font-size:12px;padding:8px 32px 8px 11px;outline:none;transition:border-color var(--transition)">
          <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-3);pointer-events:none;font-size:13px">◈</span>
        </div>
      </div>
      <div class="${gridClass}" id="fichas-grid">
        ${fichas.map(f => isListMode ? renderFichaListItem(f) : renderFichaCard(f)).join('')}
      </div>
    </div>`;

  cont.querySelector('#fichas-search')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const grid = cont.querySelector('#fichas-grid');
    if (!grid) return;
    let all = loadFichas();
    if(alteresRoleFilter) all = all.filter(f => (f.rol_publico||'').trim().toLowerCase() === alteresRoleFilter.trim().toLowerCase());
    if(alteresSortMode === 'alpha') all = [...all].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
    else if(alteresSortMode === 'date') all = [...all].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    const filtered = q ? all.filter(f =>
      (f.nombre||'').toLowerCase().includes(q) ||
      (f.arquetipo||'').toLowerCase().includes(q) ||
      (f.rol_publico||'').toLowerCase().includes(q) ||
      (f.pronombres||'').toLowerCase().includes(q) ||
      (f.apodos||'').toLowerCase().includes(q)
    ) : all;
    grid.innerHTML = filtered.length
      ? filtered.map(f => isListMode ? renderFichaListItem(f) : renderFichaCard(f)).join('')
      : `<div style="grid-column:1/-1;padding:40px 20px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;color:var(--text-3)">Sin resultados para «${esc(q)}»</div>`;
    wiresFichas(grid);
  });

  wiresFichas(cont);
}

function renderFichaListItem(f) {
  const freqDot = {rara:'○',ocasional:'◑',frecuente:'●'}[f.frecuencia||'ocasional']||'◑';
  return `<div class="ficha-list-item${f.bannerImg?' has-banner':''}" data-id="${f.id}" style="--card-color:${f.color||'#a08aff'};--card-bg:${f.bg||'rgba(160,138,255,0.10)'}">
    ${f.bannerImg ? `<div class="list-banner" style="background-image:url(${f.bannerImg})"></div>` : ''}
    <div class="list-main">
    <div class="fli-av list-avatar" style="background:${f.bg||'rgba(160,138,255,0.10)'};border:2px solid ${f.color||'#a08aff'};overflow:hidden;font-size:18px">
      ${f.avatarImg?`<img src="${f.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:escF(f.emoji||'◎')}
    </div>
    <div class="fli-info list-info">
      <div class="fli-name">${escF(f.nombre||'Sin nombre')}</div>
      <div class="fli-sub">${escF(f.rol_publico||'—')}${f.pronombres?' · '+escF(f.pronombres):''}${f.arquetipo?' · '+escF(f.arquetipo):''} <span style="color:var(--text-3)">${freqDot}</span></div>
      ${f.descripcion?`<div class="list-desc">${escF(f.descripcion)}</div>`:''}
      <div class="list-tags">
        ${f.rol_publico?`<span class="perm-chip on">${escF(f.rol_publico)}</span>`:''}
        ${f.arquetipo?`<span class="perm-chip">${escF(f.arquetipo)}</span>`:''}
      </div>
    </div>
    </div>
    <div class="fli-actions list-actions">
      <button class="btn btn-ghost btn-sm" style="padding:4px 9px;font-size:10px" data-ficha-edit="${f.id}" title="Editar ficha">✎ Editar</button>
      <button class="ficha-export-btn" data-ficha-export="${f.id}" title="Exportar como imagen">↓ img</button>
      <button class="ficha-export-btn" data-ficha-html="${f.id}" title="Exportar como HTML">↓ html</button>
      <button class="btn btn-danger" style="padding:4px 9px;font-size:10px;border-color:rgba(255,107,138,.15)" data-ficha-del="${f.id}" title="Eliminar ficha">✕</button>
    </div>
  </div>`;
}

function wiresFichas(container) {
  // Expand toggle
  container.querySelectorAll('.card-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.alter-profile-card');
      const isExp = card.classList.contains('expanded');
      container.querySelectorAll('.alter-profile-card.expanded').forEach(c => { if(c!==card) c.classList.remove('expanded'); });
      card.classList.toggle('expanded', !isExp);
    });
  });
  // Panel tabs
  container.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const panel = tab.closest('.card-panel');
      panel.querySelectorAll('.panel-tab').forEach(t=>t.classList.remove('active'));
      panel.querySelectorAll('.panel-content').forEach(c=>c.classList.remove('active'));
      tab.classList.add('active');
      panel.querySelector(`.panel-content[data-tab="${tab.dataset.tab}"]`)?.classList.add('active');
    });
  });
  // Edit
  container.querySelectorAll('[data-ficha-edit]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const f = loadFichas().find(x=>x.id===btn.dataset.fichaEdit);
      if(f) openFichaModal(f);
    });
  });
  // Delete
  container.querySelectorAll('[data-ficha-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if(!confirm('¿Eliminar esta ficha?')) return;
      saveFichas(loadFichas().filter(x=>x.id!==btn.dataset.fichaDel));
      showToast('Ficha eliminada');
      renderAlters();
    });
  });
  // Export as image
  container.querySelectorAll('[data-ficha-export]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      exportFichaAsImage(btn.dataset.fichaExport);
    });
  });
  // Export as HTML
  container.querySelectorAll('[data-ficha-html]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      exportFichaAsHTML(btn.dataset.fichaHtml);
    });
  });
}

function renderFichaCard(f) {
  const _allAlters = getAlters();
  const _linkedAlter = _allAlters.find(x => x.id === f.alterId);
  const _rels = _linkedAlter?.relationships || f.relationships || [];
  const relsHtml = _rels.length ? _rels.map(rel => {
    const rt = RELATION_TYPES.find(t=>t.id===rel.type)||RELATION_TYPES[RELATION_TYPES.length-1];
    const relLabel = (rel.customLabel||rel.label||'').trim() || rt.label;
    const relTitle = relLabel === rt.label ? rt.label : `${relLabel} (${rt.label})`;
    const ta = _allAlters.find(x=>x.id===rel.targetId);
    if (!ta) return '';
    return `<span class="perm-chip" style="background:${rt.color}18;border-color:${rt.color}55;color:${rt.color}" title="${escF(relTitle)}${rel.note?' — '+rel.note:''}">${ta.emoji||'●'} ${escF(ta.name)} · ${escF(relLabel)}</span>`;
  }).filter(Boolean).join('') : '';
  const energyPips = Array.from({length:5}, (_,i) =>
    `<div class="ficha-energy-pip ${i<(f.energia_habitual||3)?'on':''}"></div>`
  ).join('');
  const levelFill = f.nivel_emocional||50;
  const dotsTotal=5, dotsFilled=Math.round((levelFill/100)*dotsTotal);
  const dotsStr='▓'.repeat(dotsFilled)+'░'.repeat(dotsTotal-dotsFilled);
  const rasgos = (f.rasgos||[]).map(r=>`<span class="ficha-tag">${escF(r)}</span>`).join('');
  const moodWords = (f.moodboard||[]).map(w=>`<span class="ficha-moodword">${escF(w)}</span>`).join('');
  const palette = (f.paleta||[]).map(c=>`<div class="ficha-swatch-lg" style="background:${c}" title="${c}"></div>`).join('');
  const freqClass = f.frecuencia||'ocasional';
  const freqLabel = {rara:'Rara',ocasional:'Ocasional',frecuente:'Frecuente'}[freqClass]||'Ocasional';
  const freqDot = {rara:'○',ocasional:'◑',frecuente:'●'}[freqClass]||'◑';

  const fv = (val) => val
    ? `<div class="ffield-value">${escF(val)}</div>`
    : `<div class="ffield-value empty">—</div>`;

  return `
<div class="alter-profile-card" data-id="${f.id}" style="--card-color:${f.color||'#a08aff'};--card-bg:${f.bg||'rgba(160,138,255,0.10)'}">
  ${f.bannerImg?`<div class="ficha-card-banner" style="background-image:url(${f.bannerImg});background-size:cover;background-position:center;height:60px;position:relative"><div class="ficha-card-banner-av" style="position:absolute;bottom:-22px;left:14px"><div class="ficha-avatar" style="width:44px;height:44px;font-size:20px">${f.avatarImg?`<img src="${f.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:escF(f.emoji||'◎')}<div class="ficha-avatar-symbol" style="width:16px;height:16px;font-size:9px">${escF(f.symbol||'◈')}</div></div></div></div>`:''}
  <div class="card-top${f.bannerImg?' has-banner':''}">
    ${!f.bannerImg?`<div class="ficha-avatar">
      ${f.avatarImg
        ? `<img src="${f.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : escF(f.emoji||'◎')}
      <div class="ficha-avatar-symbol">${escF(f.symbol||'◈')}</div>
    </div>`:''}
    <div class="card-header-info">
      <div class="card-name">${escF(f.nombre||'Sin nombre')}</div>
      <div class="card-pronouns">${escF(f.pronombres||'—')}${f.edad?` · ${escF(f.edad)}`:''}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;margin-left:auto">
      <button class="btn btn-ghost" style="padding:4px 9px;font-size:10px" data-ficha-edit="${f.id}" title="Editar ficha">✎ Editar</button>
      <button class="ficha-export-btn" data-ficha-export="${f.id}" title="Exportar como imagen">↓ img</button>
      <button class="ficha-export-btn" data-ficha-html="${f.id}" title="Exportar como HTML">↓ html</button>
      <button class="btn btn-danger" style="padding:4px 9px;font-size:10px;border-color:rgba(255,107,138,.15)" data-ficha-del="${f.id}" title="Eliminar ficha">✕ Borrar</button>
    </div>
  </div>
  <div class="card-role-block">
    <div class="card-role-label">Rol en el sistema</div>
    <div class="card-role-text">${escF(f.rol_publico||'—')}</div>
  </div>
  ${f.frase?`<div class="card-quote">${escF(f.frase)}</div>`:''}
  <div class="card-expand-btn">
    <span class="card-expand-label">Ver más</span>
    <span class="card-expand-chevron">▾</span>
  </div>
  <div class="card-panel">
    <div class="panel-tabs">
      <div class="panel-tab active" data-tab="identidad">Identidad</div>
      <div class="panel-tab" data-tab="sistema">Sistema</div>
      <div class="panel-tab" data-tab="psique">Psique</div>
      <div class="panel-tab" data-tab="preferencias">Preferencias</div>
      <div class="panel-tab" data-tab="funcional">Funcional</div>
    </div>

    <div class="panel-content active" data-tab="identidad">
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Nombre</div>${fv(f.nombre)}</div>
        <div class="ffield"><div class="ffield-label">Apodos</div>${fv(f.apodos)}</div>
      </div>
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Pronombres</div>${fv(f.pronombres)}</div>
        <div class="ffield"><div class="ffield-label">Género</div>${fv(f.genero)}</div>
      </div>
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Edad / rango</div>${fv(f.edad)}</div>
        <div class="ffield"><div class="ffield-label">Arquetipo</div>${fv(f.arquetipo)}</div>
      </div>
      ${(f.paleta||[]).length?`<div class="ffield"><div class="ffield-label">Paleta personal</div><div class="ficha-palette">${palette}</div></div>`:''}
      <div class="ffield"><div class="ffield-label">Descripción</div>${fv(f.descripcion)}</div>
      ${f.frase_larga?`<div class="ffield"><div class="ffield-label">Reflexión</div>${fv(f.frase_larga)}</div>`:''}
    </div>

    <div class="panel-content" data-tab="sistema">
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Rol público</div>${fv(f.rol_publico)}</div>
        <div class="ffield">
          <div class="ffield-label">Frecuencia de presencia</div>
          <div><span class="ficha-freq-badge ${freqClass}">${freqDot} ${freqLabel}</span></div>
        </div>
      </div>
      <div class="ffield"><div class="ffield-label">Señales de presencia</div>${fv(f.senales)}</div>
      <div class="ffield"><div class="ffield-label">Afinidades con otros alters</div>${fv(f.afinidades)}</div>
      <div class="ffield"><div class="ffield-label">Límites y necesidades</div>${fv(f.limites)}</div>
      ${relsHtml ? `<div class="ffield"><div class="ffield-label">Vínculos</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">${relsHtml}</div></div>` : ''}
      ${_linkedAlter?.memoriaConoce ? `<div class="ffield"><div class="ffield-label">Conoce del sistema</div>${fv(_linkedAlter.memoriaConoce)}</div>` : ''}
      ${_linkedAlter?.memoriaNoConoce ? `<div class="ffield"><div class="ffield-label">No conoce</div>${fv(_linkedAlter.memoriaNoConoce)}</div>` : ''}
    </div>

    <div class="panel-content" data-tab="psique">
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Energía dominante</div>${fv(f.energia)}</div>
        <div class="ffield"><div class="ffield-label">Elemento</div>${fv(f.elemento)}</div>
      </div>
      ${rasgos?`<div class="ffield"><div class="ffield-label">Rasgos</div><div class="ficha-tags">${rasgos}</div></div>`:''}
      <div class="ffield"><div class="ffield-label">Fortalezas</div>${fv(f.fortalezas)}</div>
      <div class="ffield"><div class="ffield-label">Vulnerabilidades</div>${fv(f.vulnerabilidades)}</div>
      <div class="ffield"><div class="ffield-label">Valores</div>${fv(f.valores)}</div>
      <div class="ffield"><div class="ffield-label">Conflicto interno</div>${fv(f.conflicto)}</div>
      <div class="ffield">
        <div class="ffield-label">Nivel emocional · ${levelFill}%</div>
        <div class="ficha-emotion-bar-wrap">
          <div class="ficha-emotion-bar"><div class="ficha-emotion-bar-fill" style="width:${levelFill}%"></div></div>
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">${dotsStr}</span>
        </div>
      </div>
    </div>

    <div class="panel-content" data-tab="preferencias">
      <div class="ffield"><div class="ffield-label">Estética</div>${fv(f.estetica)}</div>
      <div class="ffield"><div class="ffield-label">Música</div>${fv(f.musica)}</div>
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Colores favoritos</div>${fv(f.colores)}</div>
        <div class="ffield"><div class="ffield-label">Animal</div>${fv(f.animal)}</div>
      </div>
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Objeto simbólico</div>${fv(f.objeto)}</div>
        <div class="ffield"><div class="ffield-label">Estación</div>${fv(f.estacion)}</div>
      </div>
      ${moodWords?`<div class="ffield"><div class="ffield-label">Moodboard</div><div style="display:flex;flex-wrap:wrap;gap:5px">${moodWords}</div></div>`:''}
      ${f.frase_larga?`<div class="ffield"><div class="ffield-label">Reflexión</div>${fv(f.frase_larga)}</div>`:''}
    </div>

    <div class="panel-content" data-tab="funcional">
      <div class="ffield"><div class="ffield-label">Habilidades</div>${fv(f.habilidades)}</div>
      <div class="ffield"><div class="ffield-label">Cómo interactúa socialmente</div>${fv(f.social)}</div>
      <div class="ffield">
        <div class="ffield-label">Energía habitual</div>
        <div class="ficha-energy-row">${energyPips}<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">${f.energia_habitual||3}/5</span></div>
      </div>
      <div class="ffield"><div class="ffield-label">Cómo hablarle</div>${fv(f.como_hablar)}</div>
      <div class="ffield"><div class="ffield-label">Qué le incomoda</div>${fv(f.incomoda)}</div>
      <div class="ffield"><div class="ffield-label">Qué le hace sentir segurx</div>${fv(f.seguridad)}</div>
      ${(()=>{ const cfs=(f.customFields||[]).filter(cf=>cf.key); return cfs.length?`
        <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px">
          <div class="ffield-label" style="margin-bottom:6px">Campos adicionales</div>
          ${cfs.map(cf=>`
            <div class="ffield"><div class="ffield-label">${escF(cf.key)}</div><div class="ffield-value">${escF(cf.value)||'—'}</div></div>
          `).join('')}
        </div>`:''; })()}
    </div>
  </div>
</div>`;
}

function openFichaModal(ficha) {
  const isEdit = !!ficha && !ficha._new;
  const f = ficha || {
    id: uid(), nombre:'', apodos:'', pronombres:'', genero:'', edad:'',
    arquetipo:'', energia:'', elemento:'', paleta:[], descripcion:'', frase:'',
    emoji:'◎', symbol:'◈', color:'#a08aff', bg:'rgba(160,138,255,0.10)',
    rol_publico:'', frecuencia:'ocasional', senales:'', afinidades:'', limites:'',
    rasgos:[], fortalezas:'', vulnerabilidades:'', valores:'', conflicto:'',
    nivel_emocional:50, estetica:'', musica:'', colores:'', animal:'', objeto:'',
    estacion:'', moodboard:[], frase_larga:'', habilidades:'', social:'',
    energia_habitual:3, como_hablar:'', incomoda:'', seguridad:'',
    relationships: []
  };

  let _fichaAvatarImg  = f.avatarImg || null;
  let _fichaAvatarMode = _fichaAvatarImg ? 'img' : 'emoji';
  let _fichaBannerImg  = f.bannerImg || null;

  // Relationship chips — read from linked alter (live) or stored in ficha
  const _fmAllAlters = getAlters();
  const _fmLinkedAlter = _fmAllAlters.find(x => x.id === f.alterId);
  const _fmRels = _fmLinkedAlter?.relationships || f.relationships || [];
  const _fmRelsHtml = _fmRels.length ? _fmRels.map(rel => {
    const rt = RELATION_TYPES.find(t=>t.id===rel.type)||RELATION_TYPES[RELATION_TYPES.length-1];
    const relLabel = (rel.customLabel||rel.label||'').trim() || rt.label;
    const relTitle = relLabel === rt.label ? rt.label : `${relLabel} (${rt.label})`;
    const ta = _fmAllAlters.find(x=>x.id===rel.targetId);
    if (!ta) return '';
    return `<span class="perm-chip" style="background:${rt.color}18;border-color:${rt.color}55;color:${rt.color}" title="${escF(relTitle)}${rel.note?' — '+rel.note:''}">${ta.emoji||'●'} ${escF(ta.name)} · ${escF(relLabel)}</span>`;
  }).filter(Boolean).join('') : '';

  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.style.cssText='align-items:flex-start;padding:32px 16px;overflow-y:auto';

  overlay.innerHTML=`<div class="ficha-modal">
    <div class="ficha-modal-header">
      <div>
        <div class="modal-title">${isEdit?'Editar ficha · '+escF(f.nombre):'Nueva ficha'}</div>
        <div class="modal-subtitle">Información detallada del alter</div>
      </div>
      <button class="icon-btn" id="fm-close">✕</button>
    </div>
    <div class="ficha-modal-tabs">
      ${['Identidad','Sistema','Psique','Preferencias','Funcional','Extras'].map((t,i)=>
        `<div class="ficha-modal-tab${i===0?' active':''}" data-section="${t.toLowerCase()}">${esc(t)}</div>`
      ).join('')}
    </div>
    <div class="ficha-modal-body">

      <!-- IDENTIDAD -->
      <div class="ficha-modal-section active" data-sec="identidad">
        <div class="ficha-form-field full">
          <div class="ficha-form-label">Avatar</div>
          <div class="avatar-mode-toggle" style="margin-bottom:8px">
            <div class="avatar-mode-btn${_fichaAvatarMode==='emoji'?' active':''}" id="fav-mode-emoji">Emoji</div>
            <div class="avatar-mode-btn${_fichaAvatarMode==='img'?' active':''}" id="fav-mode-img">Imagen</div>
          </div>
          <div id="fav-emoji-panel" style="${_fichaAvatarMode==='img'?'display:none':''}">
            <input class="ficha-form-input" id="fm-emoji" value="${escF(f.emoji)}" placeholder="◎" style="max-width:80px">
          </div>
          <div id="fav-img-panel" style="${_fichaAvatarMode==='emoji'?'display:none':''}">
            <div class="avatar-upload-area" id="fav-upload-area">
              <div id="fav-img-preview" style="${_fichaAvatarImg?'':'display:none'}">
                <img id="fav-img-el" src="${_fichaAvatarImg||''}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--border-active)">
                <button class="btn btn-ghost btn-sm" id="fav-btn-remove" style="margin-top:6px;font-size:11px">✕ Quitar imagen</button>
              </div>
              <div id="fav-img-placeholder" style="${_fichaAvatarImg?'display:none':''}">
                <div style="font-size:28px;margin-bottom:6px">📷</div>
                <div style="font-size:12px;color:var(--text-2)">Subir imagen de avatar</div>
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:3px">JPG, PNG, WEBP · máx. 2MB</div>
              </div>
              <input type="file" id="fav-file-input" accept="image/*" style="display:none">
            </div>
            <input type="hidden" id="fm-avatar-img" value="${_fichaAvatarImg||''}">
          </div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Símbolo</div><input class="ficha-form-input" id="fm-symbol" value="${escF(f.symbol)}" placeholder="◈" style="max-width:80px"></div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Color</div><input type="color" id="fm-color" value="${f.color}" style="height:36px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);cursor:pointer"></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Pronombres</div><input class="ficha-form-input" id="fm-pronombres" value="${escF(f.pronombres)}" placeholder="ella, él, elle..."></div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field full">
            <div class="ficha-form-label">Banner de perfil</div>
            <div class="avatar-upload-area" id="fm-banner-area" style="height:72px;flex-direction:row;justify-content:center;${_fichaBannerImg?`background-image:url(${_fichaBannerImg});background-size:cover;background-position:center;border-color:var(--border-active)`:''}">
              ${_fichaBannerImg
                ? `<button class="btn btn-ghost btn-sm" id="fm-banner-remove" style="font-size:11px;background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.2);color:#fff">✕ Quitar banner</button>`
                : `<div style="text-align:center"><div style="font-size:20px;margin-bottom:4px">🖼</div><div style="font-size:11px;color:var(--text-2)">Imagen de banner</div></div>`}
              <input type="file" id="fm-banner-input" accept="image/*" style="display:none">
            </div>
            <input type="hidden" id="fm-banner-img" value="${_fichaBannerImg||''}">
          </div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Nombre</div><input class="ficha-form-input" id="fm-nombre" value="${escF(f.nombre)}" placeholder="Nombre del alter"></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Apodos</div><input class="ficha-form-input" id="fm-apodos" value="${escF(f.apodos)}" placeholder="Apodos o nombres alternativos"></div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Género</div><input class="ficha-form-input" id="fm-genero" value="${escF(f.genero)}" placeholder="Género o identidad"></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Edad / rango</div><input class="ficha-form-input" id="fm-edad" value="${escF(f.edad)}" placeholder="Adulto, niñx, 20s..."></div>
        </div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Descripción general</div><textarea class="ficha-form-input" id="fm-descripcion" rows="3" placeholder="Quién es este alter, su esencia...">${escF(f.descripcion)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Frase representativa</div><input class="ficha-form-input" id="fm-frase" value="${escF(f.frase)}" placeholder="Una frase que lo/la/le define..."></div>
      </div>

      <!-- SISTEMA -->
      <div class="ficha-modal-section" data-sec="sistema">
        <div class="ficha-form-field full"><div class="ficha-form-label">Rol en el sistema</div><textarea class="ficha-form-input" id="fm-rol" rows="2" placeholder="Qué función cumple dentro del sistema...">${escF(f.rol_publico)}</textarea></div>
        <div class="ficha-form-field full">
          <div class="ficha-form-label">Frecuencia de presencia</div>
          <select class="ficha-form-input" id="fm-frecuencia">
            <option value="rara" ${f.frecuencia==='rara'?'selected':''}>○ Rara</option>
            <option value="ocasional" ${f.frecuencia==='ocasional'?'selected':''}>◑ Ocasional</option>
            <option value="frecuente" ${f.frecuencia==='frecuente'?'selected':''}>● Frecuente</option>
          </select>
        </div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Señales de presencia (cómo saber que está)</div><textarea class="ficha-form-input" id="fm-senales" rows="2" placeholder="Cambios en el habla, postura, energía...">${escF(f.senales)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Afinidades con otros alters</div><textarea class="ficha-form-input" id="fm-afinidades" rows="2" placeholder="Con quién conecta bien y por qué...">${escF(f.afinidades)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Límites y necesidades</div><textarea class="ficha-form-input" id="fm-limites" rows="2" placeholder="Qué necesita del sistema y qué pide que se respete...">${escF(f.limites)}</textarea></div>
        ${_fmRelsHtml ? `<div class="ficha-form-field full"><div class="ficha-form-label" style="margin-bottom:8px">Vínculos</div><div style="display:flex;flex-wrap:wrap;gap:6px">${_fmRelsHtml}</div></div>` : ''}
      </div>

      <!-- PSIQUE -->
      <div class="ficha-modal-section" data-sec="psique">
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Energía dominante</div><input class="ficha-form-input" id="fm-energia" value="${escF(f.energia)}" placeholder="Lunar, ígnea, etérea..."></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Elemento</div><input class="ficha-form-input" id="fm-elemento" value="${escF(f.elemento)}" placeholder="Agua, tierra, fuego, aire..."></div>
        </div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Rasgos principales (separados por coma)</div><input class="ficha-form-input" id="fm-rasgos" value="${escF((f.rasgos||[]).join(', '))}" placeholder="introspectiva, leal, analítica..."></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Fortalezas</div><textarea class="ficha-form-input" id="fm-fortalezas" rows="2" placeholder="Capacidades, virtudes, recursos internos...">${escF(f.fortalezas)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Vulnerabilidades</div><textarea class="ficha-form-input" id="fm-vulnerabilidades" rows="2" placeholder="Puntos sensibles, dificultades...">${escF(f.vulnerabilidades)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Valores</div><input class="ficha-form-input" id="fm-valores" value="${escF(f.valores)}" placeholder="Honestidad, autonomía, cuidado..."></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Conflicto interno</div><textarea class="ficha-form-input" id="fm-conflicto" rows="2" placeholder="Tensión o paradoja interna...">${escF(f.conflicto)}</textarea></div>
        <div class="ficha-form-field full">
          <div class="ficha-form-label">Nivel emocional — <span id="fm-nivel-label">${f.nivel_emocional||50}</span>%</div>
          <input type="range" class="ficha-form-range" id="fm-nivel" min="0" max="100" value="${f.nivel_emocional||50}">
        </div>
      </div>

      <!-- PREFERENCIAS -->
      <div class="ficha-modal-section" data-sec="preferencias">
        <div class="ficha-form-field full"><div class="ficha-form-label">Estética</div><input class="ficha-form-input" id="fm-estetica" value="${escF(f.estetica)}" placeholder="Dark academia, minimalista, feérica..."></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Música</div><input class="ficha-form-input" id="fm-musica" value="${escF(f.musica)}" placeholder="Géneros, artistas, ambientes sonoros..."></div>
        <div class="ficha-form-field full">
          <div class="ficha-form-label">Paleta personal</div>
          <div class="ficha-palette-editor" id="fm-paleta-editor">
            <div class="ficha-palette-swatches" id="fm-paleta-swatches">
              ${(f.paleta||[]).length
                ? (f.paleta||[]).map(c=>`<div class="ficha-palette-swatch-wrap" data-color="${c}"><div class="ficha-palette-swatch-edit" style="background:${c}" title="${c}"></div><button class="ficha-palette-swatch-del" title="Eliminar">✕</button></div>`).join('')
                : '<span class="ficha-palette-empty">Sin colores aún</span>'}
            </div>
            <div class="ficha-palette-add-row">
              <input type="color" class="ficha-palette-add-input" id="fm-paleta-picker" value="#a08aff" title="Elige un color">
              <button class="ficha-palette-add-btn" id="fm-paleta-add">+ Añadir color</button>
            </div>
          </div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Colores favoritos</div><input class="ficha-form-input" id="fm-colores" value="${escF(f.colores)}" placeholder="Violeta, gris, azul noche..."></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Animal</div><input class="ficha-form-input" id="fm-animal" value="${escF(f.animal)}" placeholder="Cuervo, gato, lobo..."></div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Objeto simbólico</div><input class="ficha-form-input" id="fm-objeto" value="${escF(f.objeto)}" placeholder="Una vela, una libreta..."></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Estación</div><input class="ficha-form-input" id="fm-estacion" value="${escF(f.estacion)}" placeholder="Otoño, invierno..."></div>
        </div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Moodboard en palabras (coma)</div><input class="ficha-form-input" id="fm-moodboard" value="${escF((f.moodboard||[]).join(', '))}" placeholder="silencio, luna llena, tinta..."></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Reflexión o frase larga</div><textarea class="ficha-form-input" id="fm-frase-larga" rows="3" placeholder="Una reflexión más personal...">${escF(f.frase_larga)}</textarea></div>
      </div>

      <!-- FUNCIONAL -->
      <div class="ficha-modal-section" data-sec="funcional">
        <div class="ficha-form-field full"><div class="ficha-form-label">Habilidades destacadas</div><textarea class="ficha-form-input" id="fm-habilidades" rows="2" placeholder="Escritura, escucha activa, análisis...">${escF(f.habilidades)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Cómo interactúa socialmente</div><textarea class="ficha-form-input" id="fm-social" rows="2" placeholder="Reservada, conecta profundamente...">${escF(f.social)}</textarea></div>
        <div class="ficha-form-field full">
          <div class="ficha-form-label">Nivel de energía habitual — <span id="fm-energia-label">${f.energia_habitual||3}</span>/5</div>
          <input type="range" class="ficha-form-range" id="fm-energia-hab" min="1" max="5" value="${f.energia_habitual||3}">
        </div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Cómo prefiere que le hablen</div><textarea class="ficha-form-input" id="fm-como-hablar" rows="2" placeholder="Con calma, sin urgencias...">${escF(f.como_hablar)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Qué le incomoda</div><textarea class="ficha-form-input" id="fm-incomoda" rows="2" placeholder="Ruido excesivo, interrupciones...">${escF(f.incomoda)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Qué le hace sentir segurx</div><textarea class="ficha-form-input" id="fm-seguridad" rows="2" placeholder="Espacios silenciosos, rutinas...">${escF(f.seguridad)}</textarea></div>
      </div>

      <!-- EXTRAS -->
      <div class="ficha-modal-section" data-sec="extras">
        <div style="margin-bottom:10px;font-size:11px;color:var(--text-2);font-family:'DM Mono',monospace">CAMPOS PERSONALIZADOS</div>
        <div id="fce-container"></div>
      </div>

    </div>
    <div class="ficha-modal-footer">
      ${isEdit?`<button class="btn btn-danger" id="fm-delete">Eliminar ficha</button>`:'<div></div>'}
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" id="fm-cancel">Cancelar</button>
        <button class="btn btn-primary" id="fm-save">${isEdit?'Guardar cambios':'Crear ficha'}</button>
      </div>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  // Tab switching
  overlay.querySelectorAll('.ficha-modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.ficha-modal-tab').forEach(t=>t.classList.remove('active'));
      overlay.querySelectorAll('.ficha-modal-section').forEach(s=>s.classList.remove('active'));
      tab.classList.add('active');
      overlay.querySelector(`.ficha-modal-section[data-sec="${tab.dataset.section}"]`)?.classList.add('active');
    });
  });

  // ── Ficha custom fields editor ──
  (function() {
    const fce = overlay.querySelector('#fce-container');
    if (!fce) return;
    let _fcf = [...(f.customFields||[])];
    const refreshFCF = () => {
      fce.innerHTML = _fcf.map((cf,i)=>`<div class="cf-row" data-fcfi="${i}" style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <input class="cf-input-key" placeholder="Campo" value="${escB(cf.key)}" data-fcfi="${i}" data-type="key" style="width:110px;flex-shrink:0">
        <input class="cf-input-val" placeholder="Valor" value="${escB(cf.value)}" data-fcfi="${i}" data-type="val" style="flex:1;min-width:0">
        <button class="icon-btn cf-del" data-fcfi="${i}" style="flex-shrink:0">✕</button>
      </div>`).join('') + '<button class="btn btn-ghost btn-sm" id="btn-add-fcf" style="margin-top:6px;font-size:11px">+ Añadir campo</button>';
      fce.querySelectorAll('.cf-del').forEach(b=>b.addEventListener('click',()=>{ _fcf.splice(+b.dataset.fcfi,1); refreshFCF(); }));
      fce.querySelectorAll('[data-type]').forEach(inp=>inp.addEventListener('input',e=>{
        const i=+e.target.dataset.fcfi; if(!_fcf[i]) return;
        if(e.target.dataset.type==='key') _fcf[i].key=e.target.value; else _fcf[i].value=e.target.value;
      }));
      fce.querySelector('#btn-add-fcf')?.addEventListener('click',()=>{ _fcf.push({id:uid(),key:'',value:''}); refreshFCF(); });
    };
    refreshFCF();
    // Expose to save handler via closure reference on the element
    fce.dataset.ready = '1';
    fce._getCF = () => _fcf.filter(cf=>cf.key.trim());
  })();

  // Avatar ficha toggle
  overlay.querySelector('#fav-mode-emoji')?.addEventListener('click', () => {
    _fichaAvatarMode = 'emoji';
    overlay.querySelector('#fav-mode-emoji').classList.add('active');
    overlay.querySelector('#fav-mode-img').classList.remove('active');
    overlay.querySelector('#fav-emoji-panel').style.display = '';
    overlay.querySelector('#fav-img-panel').style.display = 'none';
  });
  overlay.querySelector('#fav-mode-img')?.addEventListener('click', () => {
    _fichaAvatarMode = 'img';
    overlay.querySelector('#fav-mode-img').classList.add('active');
    overlay.querySelector('#fav-mode-emoji').classList.remove('active');
    overlay.querySelector('#fav-img-panel').style.display = '';
    overlay.querySelector('#fav-emoji-panel').style.display = 'none';
  });
  overlay.querySelector('#fav-upload-area')?.addEventListener('click', (e) => {
    if (e.target.id === 'fav-btn-remove') return;
    overlay.querySelector('#fav-file-input').click();
  });
  overlay.querySelector('#fav-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const err = validateImageFile(file, 8);
    if(err) { showToast('⚠ ' + err); e.target.value = ''; return; }
    compressImageForStorage(file, 384, 384, 0.86, 520).then(b64 => {
      showImageCompressedToast(file, b64, 'Avatar');
      _fichaAvatarImg = b64;
      overlay.querySelector('#fav-img-el').src = b64;
      overlay.querySelector('#fm-avatar-img').value = b64;
      overlay.querySelector('#fav-img-preview').style.display = '';
      overlay.querySelector('#fav-img-placeholder').style.display = 'none';
    }).catch(() => showToast('⚠ No se pudo procesar la imagen'));
  });
  overlay.querySelector('#fav-btn-remove')?.addEventListener('click', () => {
    _fichaAvatarImg = null;
    overlay.querySelector('#fav-img-el').src = '';
    overlay.querySelector('#fm-avatar-img').value = '';
    overlay.querySelector('#fav-img-preview').style.display = 'none';
    overlay.querySelector('#fav-img-placeholder').style.display = '';
  });

  // Banner de ficha
  overlay.querySelector('#fm-banner-area')?.addEventListener('click', (e) => {
    if(e.target.id === 'fm-banner-remove') return;
    overlay.querySelector('#fm-banner-input').click();
  });
  overlay.querySelector('#fm-banner-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if(!file) return;
    const err = validateImageFile(file, 12);
    if(err) { showToast('⚠ ' + err); e.target.value = ''; return; }
    compressImageForStorage(file, 1000, 320, 0.82, 780).then(b64 => {
      showImageCompressedToast(file, b64, 'Banner');
      _fichaBannerImg = b64;
      overlay.querySelector('#fm-banner-img').value = b64;
      const area = overlay.querySelector('#fm-banner-area');
      area.style.backgroundImage = `url(${b64})`;
      area.style.backgroundSize = 'cover'; area.style.backgroundPosition = 'center'; area.style.borderColor = 'var(--border-active)';
      area.innerHTML = `<button class="btn btn-ghost btn-sm" id="fm-banner-remove" style="font-size:11px;background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.2);color:#fff">✕ Quitar banner</button><input type="file" id="fm-banner-input" accept="image/*" style="display:none">`;
      area.querySelector('#fm-banner-remove')?.addEventListener('click', ev => {
        ev.stopPropagation(); _fichaBannerImg = null; overlay.querySelector('#fm-banner-img').value = '';
        area.style.cssText = 'height:72px;flex-direction:row;justify-content:center;';
        area.innerHTML = `<div style="text-align:center"><div style="font-size:20px;margin-bottom:4px">🖼</div><div style="font-size:11px;color:var(--text-2)">Imagen de banner</div></div><input type="file" id="fm-banner-input" accept="image/*" style="display:none">`;
        area.querySelector('#fm-banner-input')?.addEventListener('change', ev2 => { const f2=ev2.target.files[0]; if(!f2) return; compressImageForStorage(f2,1000,320,0.82,780).then(b=>{showImageCompressedToast(f2,b,'Banner');_fichaBannerImg=b;overlay.querySelector('#fm-banner-img').value=b;area.style.backgroundImage=`url(${b})`;area.style.backgroundSize='cover';area.style.backgroundPosition='center';}).catch(()=>showToast('⚠ No se pudo procesar la imagen')); });
      });
      area.querySelector('#fm-banner-input')?.addEventListener('change', ev2 => { const f2=ev2.target.files[0]; if(!f2) return; compressImageForStorage(f2,1000,320,0.82,780).then(b=>{showImageCompressedToast(f2,b,'Banner');_fichaBannerImg=b;overlay.querySelector('#fm-banner-img').value=b;area.style.backgroundImage=`url(${b})`;}).catch(()=>showToast('⚠ No se pudo procesar la imagen')); });
    }).catch(() => showToast('⚠ No se pudo procesar la imagen'));
  });

  // Range labels
  overlay.querySelector('#fm-nivel')?.addEventListener('input', e => {
    overlay.querySelector('#fm-nivel-label').textContent = e.target.value;
  });
  overlay.querySelector('#fm-energia-hab')?.addEventListener('input', e => {
    overlay.querySelector('#fm-energia-label').textContent = e.target.value;
  });

  // ── Palette editor ──
  function renderPaletteSwatches() {
    const swatchesEl = overlay.querySelector('#fm-paleta-swatches');
    if (!swatchesEl) return;
    const wraps = swatchesEl.querySelectorAll('.ficha-palette-swatch-wrap');
    const colors = Array.from(wraps).map(w => w.dataset.color);
    if (colors.length === 0) {
      swatchesEl.innerHTML = '<span class="ficha-palette-empty">Sin colores aún</span>';
    } else {
      swatchesEl.innerHTML = colors.map(c =>
        `<div class="ficha-palette-swatch-wrap" data-color="${c}">` +
        `<div class="ficha-palette-swatch-edit" style="background:${c}" title="${c}"></div>` +
        `<button class="ficha-palette-swatch-del" title="Eliminar">✕</button>` +
        `</div>`
      ).join('');
    }
    // Bind delete buttons
    swatchesEl.querySelectorAll('.ficha-palette-swatch-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        btn.closest('.ficha-palette-swatch-wrap').remove();
        renderPaletteSwatches();
      });
    });
  }

  // Initial bind for existing swatches
  renderPaletteSwatches();

  overlay.querySelector('#fm-paleta-add')?.addEventListener('click', () => {
    const picker = overlay.querySelector('#fm-paleta-picker');
    const color = picker?.value || '#a08aff';
    const swatchesEl = overlay.querySelector('#fm-paleta-swatches');
    if (!swatchesEl) return;
    // Remove empty placeholder if present
    const empty = swatchesEl.querySelector('.ficha-palette-empty');
    if (empty) empty.remove();
    // Avoid duplicates
    const existing = Array.from(swatchesEl.querySelectorAll('.ficha-palette-swatch-wrap')).map(w=>w.dataset.color);
    if (existing.includes(color)) { showToast('Ese color ya está en la paleta'); return; }
    if (existing.length >= 12) { showToast('Máximo 12 colores en la paleta'); return; }
    const wrap = document.createElement('div');
    wrap.className = 'ficha-palette-swatch-wrap';
    wrap.dataset.color = color;
    wrap.innerHTML = `<div class="ficha-palette-swatch-edit" style="background:${color}" title="${color}"></div><button class="ficha-palette-swatch-del" title="Eliminar">✕</button>`;
    wrap.querySelector('.ficha-palette-swatch-del').addEventListener('click', e => {
      e.stopPropagation();
      wrap.remove();
      renderPaletteSwatches();
    });
    swatchesEl.appendChild(wrap);
  });

  const close = () => overlay.remove();
  overlay.querySelector('#fm-close').addEventListener('click', close);
  overlay.querySelector('#fm-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if(e.target===overlay) close(); });

  overlay.querySelector('#fm-delete')?.addEventListener('click', () => {
    if(!confirm('¿Eliminar esta ficha?')) return;
    saveFichas(loadFichas().filter(x=>x.id!==f.id));
    close(); showToast('Ficha eliminada'); renderAlters();
  });

  overlay.querySelector('#fm-save').addEventListener('click', () => {
    const g = id => overlay.querySelector(id)?.value?.trim()||'';
    const nombre = g('#fm-nombre');
    if(!nombre) return showToast('⚠ El nombre es obligatorio');

    const colorVal = overlay.querySelector('#fm-color')?.value || '#a08aff';
    const hex = colorVal.replace('#','');
    const r=parseInt(hex.substring(0,2),16),gr=parseInt(hex.substring(2,4),16),b=parseInt(hex.substring(4,6),16);

    const rasgosRaw = g('#fm-rasgos');
    const moodRaw = g('#fm-moodboard');

    // Custom fields propios de la ficha
    const fceContainer = overlay.querySelector('#fce-container');
    const fichaCustomFields = fceContainer?._getCF ? fceContainer._getCF() : (f.customFields||[]);

    const updated = {
      ...f,
      emoji: g('#fm-emoji')||'◎',
      symbol: g('#fm-symbol')||'◈',
      color: colorVal,
      bg: `rgba(${r},${gr},${b},0.10)`,
      avatarImg: overlay.querySelector('#fm-avatar-img')?.value || null,
      bannerImg: overlay.querySelector('#fm-banner-img')?.value || null,
      nombre,
      apodos: g('#fm-apodos'),
      pronombres: g('#fm-pronombres'),
      genero: g('#fm-genero'),
      edad: g('#fm-edad'),
      arquetipo: g('#fm-arquetipo'),
      energia: g('#fm-energia'),
      elemento: g('#fm-elemento'),
      descripcion: g('#fm-descripcion'),
      frase: g('#fm-frase'),
      rol_publico: g('#fm-rol'),
      frecuencia: overlay.querySelector('#fm-frecuencia')?.value||'ocasional',
      senales: g('#fm-senales'),
      afinidades: g('#fm-afinidades'),
      limites: g('#fm-limites'),
      rasgos: rasgosRaw?rasgosRaw.split(',').map(s=>s.trim()).filter(Boolean):[],
      fortalezas: g('#fm-fortalezas'),
      vulnerabilidades: g('#fm-vulnerabilidades'),
      valores: g('#fm-valores'),
      conflicto: g('#fm-conflicto'),
      nivel_emocional: parseInt(overlay.querySelector('#fm-nivel')?.value||50),
      estetica: g('#fm-estetica'),
      musica: g('#fm-musica'),
      colores: g('#fm-colores'),
      animal: g('#fm-animal'),
      objeto: g('#fm-objeto'),
      estacion: g('#fm-estacion'),
      moodboard: moodRaw?moodRaw.split(',').map(s=>s.trim()).filter(Boolean):[],
      frase_larga: g('#fm-frase-larga'),
      paleta: Array.from(overlay.querySelectorAll('#fm-paleta-swatches .ficha-palette-swatch-wrap')).map(w=>w.dataset.color).filter(Boolean),
      habilidades: g('#fm-habilidades'),
      social: g('#fm-social'),
      energia_habitual: parseInt(overlay.querySelector('#fm-energia-hab')?.value||3),
      como_hablar: g('#fm-como-hablar'),
      incomoda: g('#fm-incomoda'),
      seguridad: g('#fm-seguridad'),
      customFields: fichaCustomFields,
      relationships: f.relationships||[],
      createdAt: f.createdAt || Date.now(),
    };

    // Ensure _new flag is never persisted
    delete updated._new;
    let list = loadFichas();
    if(isEdit) list = list.map(x=>x.id===f.id?updated:x);
    else list.push(updated);
    saveFichas(list);
    close();
    showToast(isEdit?`Ficha de ${updated.nombre} guardada ✓`:`${updated.nombre} añadidx ✓`);
    alteresTab = 'fichas';
    renderAlters();
  });
}

// ═══════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════
document.getElementById('btn-search-global')?.addEventListener('click', () => window.AtriaSearchView.open());
document.getElementById('system-state-badge')?.addEventListener('click', openSystemStateModal);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.key==='k') { e.preventDefault(); window.AtriaSearchView.open(); }
});
// Footer nav items (Config, Crisis) — outside #sb-nav so need own listeners
document.querySelectorAll('.sb-footer .nav-item[data-view]').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.view));
});

document.getElementById('sb-toggle').addEventListener('click', () =>
  document.getElementById('sidebar').classList.toggle('collapsed')
);
document.getElementById('switch-btn').addEventListener('click', () => {
  activeAlter = null;
  document.getElementById('shell').classList.remove('visible');
  const l0 = document.getElementById('layer-0');
  l0.classList.remove('exit');
});

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// PWA — SERVICE WORKER
// ═══════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  const swPaths = ['../../sw.js', '../sw.js', './sw.js', '/sw.js'];
  (async () => {
    for (const path of swPaths) {
      try {
        await navigator.serviceWorker.register(path, { scope: './' });
        break;
      } catch {}
    }
  })();
}

// ── Back navigation: botón atrás móvil / Backspace desktop ──────────────────
window.addEventListener('popstate', (e) => {
  if (currentView === 'hub') {
    history.pushState({ view: 'hub' }, '', location.href.split('?')[0]);
  } else {
    navigateTo('hub', true);
  }
});

// Desktop: Backspace fuera de inputs → volver al hub
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Backspace' && e.key !== 'BrowserBack') return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
  if (currentView !== 'hub') {
    e.preventDefault();
    navigateTo('hub');
  }
});

// Aplicar configuración guardada al arrancar
capturePendingNotifRouteFromUrl();
applyConfig(loadConfig());
installOnlineAutoBackupWatcher();
if (getOnlineProfile().enabled && hasOnlineBackendConfigured()) {
  migrateOnlineSessionCryptoSilently().finally(() => {
    startOnlineSyncLoop();
  });
}
// Escuchar cambios del sistema en modo auto
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  const cfg = loadConfig();
  if (!cfg.theme || cfg.theme === 'auto') applyTheme('auto');
});
window.addEventListener('online', refreshGlobalConnectionIndicator);
window.addEventListener('offline', refreshGlobalConnectionIndicator);
startNotifScheduler();
if (nativeNotifGranted()) scheduleOnlineWebPushSubscription();
scheduleReminderPushSync();

// Primera vez: si no hay alters guardados, mostrar onboarding
// requestAnimationFrame garantiza que el navegador pinte el esqueleto HTML antes de
// ejecutar las lecturas de localStorage — mejora arranque en WebViews lentos (ej. Xiaomi).
initLangToggle();
placeLangToggle();
window.addEventListener('resize', placeLangToggle);
requestAnimationFrame(() => {
  expireOnlineSessionIfNeeded();
  const altersState = readStoredAltersState();
  if ((altersState.status === 'missing' || altersState.status === 'empty') && !hasStoredAtriaDataBesidesAlters() && !loadOnlineSession()) {
    window.AtriaOnboardingView.show();
  } else if (altersState.status !== 'ok') {
    renderStorageRecoveryNotice(altersState);
  } else {
    checkPinOnStart(renderLayer0);
  }
});
