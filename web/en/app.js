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
  } catch(e) { if(e.name==='QuotaExceededError'||e.code===22||e.code===1014) showToast('⚠ Storage full — reduce image size'); else showToast('⚠ Error saving'); }
}

// Compress and resize an image with canvas before storing.
// maxW/maxH: max dimensions. quality: 0-1 for JPEG output.
// Returns Promise<dataURL>.
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
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')); };
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
function showImageCompressedToast(file, b64, label = 'Image') {
  showToast(`${label} compressed: ${formatImageBytes(file?.size || 0)} -> ${formatImageBytes(dataUrlBytes(b64))}`);
}
function validateImageFile(file, maxMB = 2) {
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  if (!allowed.includes(file.type)) {
    const ext = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : '?';
    return `Invalid format (.${ext}). Only JPG, PNG, WEBP or GIF.`;
  }
  if (file.size > maxMB * 1024 * 1024) {
    return `Image too large (${formatImageBytes(file.size)}). Atria can compress up to ${maxMB} MB; choose a smaller image or lower its resolution.`;
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
  {id:'alimentacion', name:'Food', color:'#ffb450'},
  {id:'transporte',   name:'Transport',   color:'#8ab4ff'},
  {id:'salud',        name:'Health',        color:'#5fffb0'},
  {id:'ocio',         name:'Entertainment',         color:'#ff8ae2'},
  {id:'servicios',    name:'Services',    color:'#a08aff'},
  {id:'ropa',         name:'Clothes',         color:'#ff9f7f'},
  {id:'educacion',    name:'Education',    color:'#7fffda'},
  {id:'otros',        name:'Misc.',        color:'#8a8aaa'},
];

const HUB_SECTIONS = [
  {
    id:'comunicacion', label:'Communication', icon:'◭', color:'#8affe0',
    modules:[
      {id:'innerchat',   name:'Communication',       icon:'◭', desc:'Chat, board, requests and wishes',  color:'#8affe0', bg:'rgba(138,255,224,0.1)', badge:'active',   view:'innerchat'},
    ]
  },
  {
    id:'organizacion', label:'Organization', icon:'◰', color:'#a08aff',
    modules:[
      {id:'agenda',      name:'Agenda',             icon:'◷', desc:'Events and reminders',               color:'#ffb450', bg:'rgba(255,180,80,0.1)',  badge:'active',   view:'agenda'},
      {id:'rutinas',     name:'Routines',           icon:'◎', desc:'Habits, checklists and daily structure', color:'#ffd580', bg:'rgba(255,213,128,0.12)', badge:'new', view:'rutinas'},
      {id:'proyectos',   name:'Projects',          icon:'◉', desc:'Project and task tracking',     color:'#8affe0', bg:'rgba(138,255,224,0.1)', badge:'active',   view:'proyectos'},
      {id:'finanzas',    name:'Finances',           icon:'$', desc:'Transactions, budgets and summary',   color:'#5fffb0', bg:'rgba(95,255,176,0.1)',  badge:'active',   view:'finanzas'},
    ]
  },
  {
    id:'personal', label:'Personal', icon:'◫', color:'#ff8ae2',
    modules:[
      {id:'diario',      name:'Journal',             icon:'◫', desc:'Personal entries and reflections',     color:'#ff8ae2', bg:'rgba(255,138,226,0.1)', badge:'active',   view:'diario'},
      {id:'normas',      name:'Rules',             icon:'◳', desc:'System rules and agreements',         color:'#8ab4ff', bg:'rgba(138,180,255,0.1)', badge:'active',   view:'normas'},
      {id:'polls',       name:'Polls',             icon:'◎', desc:'Polls and internal decisions',       color:'#ffd580', bg:'rgba(255,213,128,0.12)', badge:'new',      view:'polls'},
      {id:'memoria',     name:'Memory',            icon:'◌', desc:'History, contacts, resources and docs',  color:'#ffb450', bg:'rgba(255,180,80,0.1)',  badge:'active',   view:'memoria'},
      {id:'biblioteca',  name:'Library',           icon:'◫', desc:'Contacts, health, resources and docs',   color:'#a08aff', bg:'rgba(160,138,255,0.1)', badge:'active',   view:'biblioteca'},
    ]
  },

  {
    id:'sistema', label:'System', icon:'◎', color:'#ff8ae2',
    modules:[
      {id:'fronting',    name:'Fronting',           icon:'◉', desc:'Who is fronting now',             color:'#ff8ae2', bg:'rgba(255,138,226,0.1)', badge:'active',   view:'fronting'},
      {id:'perfiles',    name:'Alters',             icon:'◎', desc:'Manage profiles',            color:'#8ab4ff', bg:'rgba(138,180,255,0.1)', badge:'active',   view:'perfiles'},
      {id:'analisis',    name:'Analytics',          icon:'◈', desc:'Dashboard, activity, emotions & triggers', color:'#5fffb0', bg:'rgba(95,255,176,0.1)', badge:'active',   view:'analisis'},
    ]
  },
];
// Flat list for legacy use
const HUB_MODULES = HUB_SECTIONS.flatMap(s=>s.modules);

// ═══════════════════════════════════════════════
// PERFILES CONSTANTS
// ═══════════════════════════════════════════════
const ROLE_TYPES = [
  {id:'anfitrion', label:'Host',  emoji:'🌙'},
  {id:'protector', label:'Protector',  emoji:'🛡'},
  {id:'guardian',  label:'Gatekeeper',   emoji:'🐺'},
  {id:'nino',      label:'Little',       emoji:'🌸'},
  {id:'perseguidor',label:'Persecutor',emoji:'⚡'},
  {id:'fragmento', label:'Fragment',  emoji:'🔮'},
  {id:'otro',      label:'Other',       emoji:'◎'},
];
function loadCustomRoleTypes() { try { return JSON.parse(localStorage.getItem('tid_custom_role_types'))||[]; } catch{return[];} }
function saveCustomRoleTypes(arr) { localStorage.setItem('tid_custom_role_types', JSON.stringify(arr)); }
function getAllRoleTypes() {
  const customs = loadCustomRoleTypes().map(c => ({id:'custom_'+c, label:c, emoji:'◎', custom:true}));
  return [...ROLE_TYPES, ...customs];
}
const AGE_TYPES = [
  {id:'bebe',    label:'Baby (0-3)'},
  {id:'nino',    label:'Child (4-12)'},
  {id:'adolescente',label:'Teen (13-17)'},
  {id:'adulto',  label:'Adult (18+)'},
  {id:'anciano', label:'Elder'},
  {id:'ageless', label:'Ageless'},
];
const PRONOUNS_LIST = [
  'she/her','he/him','they/them','she/they','he/they','none',
  'she/he','they/she','they/he',
  'xe/xem','ze/zir','fae/faer','ey/em',
  'it/its','ne/nem','ve/ver','per/per',
];
const PRONOUNS_DATALIST = `<datalist id="pronouns-datalist">${PRONOUNS_LIST.map(p=>`<option value="${p}">`).join('')}</datalist>`;
const MODULES_PERMS = [
  {id:'finanzas',     label:'Finances',      desc:'View and manage financial data'},
  {id:'emociones',    label:'Emotions',      desc:'Emotions management'},
  {id:'diario',       label:'Journal',        desc:'Read and write entries'},
  {id:'comunicacion', label:'Communication',  desc:'Internal messages'},
  {id:'agenda',       label:'Agenda',        desc:'View and create events'},
  {id:'proyectos',    label:'Projects',     desc:'Access projects and tasks'},
  {id:'normas',       label:'Rules',        desc:'View and vote on system rules'},
  {id:'wishlist',     label:'Wishlist',      desc:'View and manage wishes'},
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
  {id:'protector',     label:'Protector',          color:'#8affe0'},
  {id:'cofronting',    label:'Habitual co-front',   color:'#a08aff'},
  {id:'complementario',label:'Complementary',       color:'#ffd580'},
  {id:'conflicto',     label:'Conflict',            color:'#ff6b8a'},
  {id:'origen',        label:'Origin/fragment',     color:'#ffb450'},
  {id:'otro',          label:'Other',               color:'#8ab4ff'},
];
const FRONT_CUSTOM_STATES = [
  {id:'alterado',   label:'Distressed',  icon:'⚡'},
  {id:'disociado',  label:'Dissociated', icon:'◌'},
  {id:'flashback',  label:'Flashback',   icon:'↩'},
  {id:'cansado',    label:'Exhausted',   icon:'◫'},
  {id:'ansioso',    label:'Anxious',     icon:'◎'},
  {id:'tranquilo',  label:'Calm',        icon:'◷'},
];

const ALTER_STATES = [
  {id:'activo',      label:'Active',       icon:'●', color:'#5fffb0'},
  {id:'dormido',     label:'Dormant',      icon:'○', color:'#8ab4ff'},
  {id:'emergente',   label:'Emerging',     icon:'◑', color:'#ffd580'},
  {id:'transitorio', label:'Transitory',   icon:'◌', color:'#ff8ae2'},
];
// Intimacy layers — determine whether data can leave the device
const INTIMACY_LEVELS = [
  {id:'privado',    label:'Private',   icon:'🔒', desc:'This system only — never leaves the app',     color:'#ff6b8a'},
  {id:'interno',    label:'Internal',  icon:'🏠', desc:'Visible between alters, stays on device',     color:'#a08aff'},
  {id:'compartido', label:'Shared',    icon:'🤝', desc:'Shareable with online friends',                color:'#8ab4ff'},
  {id:'publico',    label:'Public',    icon:'📤', desc:'Manually exportable',                          color:'#5fffb0'},
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
  {e:'🌙',t:'moon night dark crescent',c:'cos'},
  {e:'☀️',t:'sun day light bright',c:'cos'},
  {e:'⭐',t:'star night shine glimmer',c:'cos'},
  {e:'🌟',t:'glowing star bright golden',c:'cos'},
  {e:'🌠',t:'shooting star wish night',c:'cos'},
  {e:'🌌',t:'galaxy cosmos space universe stars',c:'cos'},
  {e:'🪐',t:'planet saturn cosmos space',c:'cos'},
  {e:'🌑',t:'new moon dark phase black',c:'cos'},
  {e:'🌞',t:'sunny face summer warm happy',c:'cos'},
  {e:'☄️',t:'comet meteor cosmos space star',c:'cos'},
  {e:'🌍',t:'earth world planet globe',c:'cos'},
  {e:'🌒',t:'crescent moon phase waxing',c:'cos'},
  {e:'🌕',t:'full moon phase bright night',c:'cos'},
  {e:'🔭',t:'telescope space cosmos observe star',c:'cos'},
  // Nature
  {e:'🌸',t:'flower sakura spring pink blossom',c:'nat'},
  {e:'🌊',t:'wave sea ocean water',c:'nat'},
  {e:'🌿',t:'plant leaf green nature herb',c:'nat'},
  {e:'🌈',t:'rainbow colors hope',c:'nat'},
  {e:'🌺',t:'hibiscus flower tropical red',c:'nat'},
  {e:'🍃',t:'leaves breeze nature wind leaf',c:'nat'},
  {e:'🌵',t:'cactus desert plant spiky',c:'nat'},
  {e:'🍄',t:'mushroom fungus forest magic',c:'nat'},
  {e:'💧',t:'drop water rain blue',c:'nat'},
  {e:'☁️',t:'cloud sky grey weather',c:'nat'},
  {e:'🌧️',t:'rain cloud weather water',c:'nat'},
  {e:'🌪️',t:'tornado wind storm chaos',c:'nat'},
  {e:'🌻',t:'sunflower summer yellow bright',c:'nat'},
  {e:'🌼',t:'daisy yellow spring flower',c:'nat'},
  {e:'🍀',t:'clover luck green fortune',c:'nat'},
  {e:'🌹',t:'red rose flower love',c:'nat'},
  {e:'🌾',t:'wheat field golden autumn',c:'nat'},
  {e:'🪷',t:'lotus flower water',c:'nat'},
  {e:'🌷',t:'tulip pink flower spring',c:'nat'},
  {e:'🌲',t:'tree forest pine woods',c:'nat'},
  {e:'🌴',t:'palm tree tropical summer beach',c:'nat'},
  {e:'🌱',t:'seedling sprout new life growth',c:'nat'},
  {e:'🍁',t:'maple leaf autumn fall red',c:'nat'},
  {e:'🍂',t:'fallen leaves autumn fall brown',c:'nat'},
  {e:'❄️',t:'ice snow cold winter frost',c:'nat'},
  {e:'🏔️',t:'snowy mountain peak summit',c:'nat'},
  {e:'🌬️',t:'wind blowing breeze air',c:'nat'},
  {e:'🌋',t:'volcano lava fire eruption',c:'nat'},
  // Animals
  {e:'🐺',t:'wolf animal pack',c:'ani'},
  {e:'🦋',t:'butterfly transformation flight',c:'ani'},
  {e:'🐉',t:'dragon mythical fire power',c:'ani'},
  {e:'🦅',t:'eagle flight freedom soar',c:'ani'},
  {e:'🦊',t:'fox cunning clever orange',c:'ani'},
  {e:'🐱',t:'cat feline animal kitty',c:'ani'},
  {e:'🦁',t:'lion strength king mane',c:'ani'},
  {e:'🐍',t:'snake reptile mystery',c:'ani'},
  {e:'🦌',t:'deer forest graceful animal',c:'ani'},
  {e:'🦚',t:'peacock feathers colorful',c:'ani'},
  {e:'🐦',t:'bird flight freedom sky',c:'ani'},
  {e:'🐾',t:'paw print animal tracks',c:'ani'},
  {e:'🐲',t:'green dragon serpent mythical',c:'ani'},
  {e:'🐸',t:'frog green cool',c:'ani'},
  {e:'🦇',t:'bat night dark flying',c:'ani'},
  {e:'🦄',t:'unicorn magical rainbow fantasy',c:'ani'},
  {e:'🐻',t:'bear strong brown animal',c:'ani'},
  {e:'🐼',t:'panda black white china',c:'ani'},
  {e:'🐯',t:'tiger stripes fierce wild',c:'ani'},
  {e:'🦝',t:'raccoon mischievous bandit mask',c:'ani'},
  {e:'🦦',t:'otter water playful cute',c:'ani'},
  {e:'🐬',t:'dolphin sea ocean smart',c:'ani'},
  {e:'🐋',t:'whale great ocean sea',c:'ani'},
  {e:'🦈',t:'shark danger ocean predator',c:'ani'},
  {e:'🐧',t:'penguin cold arctic cute',c:'ani'},
  {e:'🦉',t:'owl night wisdom knowledge',c:'ani'},
  {e:'🦜',t:'parrot colorful tropical talk',c:'ani'},
  {e:'🦢',t:'swan elegant graceful white',c:'ani'},
  {e:'🕊️',t:'dove peace white calm',c:'ani'},
  {e:'🐢',t:'turtle slow calm patience',c:'ani'},
  {e:'🦔',t:'hedgehog spiky cute little',c:'ani'},
  {e:'🦭',t:'seal ocean marine water',c:'ani'},
  // Magic
  {e:'🔮',t:'crystal ball magic mystery vision',c:'mag'},
  {e:'💫',t:'sparkle spin magic star',c:'mag'},
  {e:'🎭',t:'mask theater drama duality',c:'mag'},
  {e:'🌀',t:'spiral swirl vortex dizzy',c:'mag'},
  {e:'🧿',t:'evil eye amulet protection',c:'mag'},
  {e:'☯️',t:'yin yang balance duality peace',c:'mag'},
  {e:'✨',t:'sparkles magic shine glitter',c:'mag'},
  {e:'⚜️',t:'fleur de lis noble symbol heraldic',c:'mag'},
  {e:'♾️',t:'infinity eternal forever loop',c:'mag'},
  {e:'🪬',t:'hamsa hand protection amulet eye',c:'mag'},
  {e:'📿',t:'prayer beads rosary amulet',c:'mag'},
  {e:'⚗️',t:'alchemy experiment magic potion',c:'mag'},
  {e:'🪄',t:'magic wand spell enchant',c:'mag'},
  {e:'☮️',t:'peace symbol harmony calm',c:'mag'},
  {e:'🗝️',t:'old key secret mystery lock',c:'mag'},
  {e:'🧙',t:'wizard witch mage spell',c:'mag'},
  {e:'🧚',t:'fairy magic fantasy wings',c:'mag'},
  {e:'🧜',t:'mermaid sea water fantasy',c:'mag'},
  {e:'🧛',t:'vampire night dark blood',c:'mag'},
  {e:'👁️',t:'eye sight observe secret all seeing',c:'mag'},
  {e:'🕯️',t:'candle flame soft light night',c:'mag'},
  // Hearts
  {e:'💜',t:'purple heart love violet',c:'cor'},
  {e:'🖤',t:'black heart dark love',c:'cor'},
  {e:'🤍',t:'white heart love pure',c:'cor'},
  {e:'💙',t:'blue heart love water',c:'cor'},
  {e:'💚',t:'green heart nature life',c:'cor'},
  {e:'💛',t:'yellow heart joy sun',c:'cor'},
  {e:'🧡',t:'orange heart energy fire',c:'cor'},
  {e:'❤️',t:'red heart love passion',c:'cor'},
  {e:'💕',t:'two hearts love affection',c:'cor'},
  {e:'💞',t:'revolving hearts love spinning',c:'cor'},
  {e:'💗',t:'growing heart love pink',c:'cor'},
  {e:'💖',t:'sparkling heart love glitter',c:'cor'},
  {e:'💝',t:'heart ribbon gift love',c:'cor'},
  {e:'🩷',t:'pink heart love soft',c:'cor'},
  {e:'🩶',t:'grey heart love neutral',c:'cor'},
  {e:'🩵',t:'light blue heart love sky',c:'cor'},
  {e:'🤎',t:'brown heart love earth',c:'cor'},
  // Power
  {e:'🔥',t:'fire flame passion heat',c:'pod'},
  {e:'⚡',t:'lightning thunder energy storm',c:'pod'},
  {e:'💎',t:'diamond gem jewel crystal',c:'pod'},
  {e:'🗡️',t:'dagger sword blade warrior',c:'pod'},
  {e:'🛡️',t:'shield protection defense',c:'pod'},
  {e:'🔱',t:'trident neptune power water',c:'pod'},
  {e:'🎯',t:'target goal focus bullseye',c:'pod'},
  {e:'⚔️',t:'crossed swords battle combat',c:'pod'},
  {e:'🏹',t:'bow arrow archer hunt',c:'pod'},
  {e:'💪',t:'biceps muscle strength power',c:'pod'},
  {e:'🦾',t:'robotic arm cyborg strength',c:'pod'},
  {e:'⛓️',t:'chains bonds shackle',c:'pod'},
  {e:'🪃',t:'boomerang return throw',c:'pod'},
  // People
  {e:'🧒',t:'child kid young person',c:'per'},
  {e:'👧',t:'girl child young female',c:'per'},
  {e:'🧑',t:'person adult neutral',c:'per'},
  {e:'👩',t:'woman female adult',c:'per'},
  {e:'👨',t:'man male adult',c:'per'},
  {e:'🧑‍🎤',t:'singer rockstar performer stage',c:'per'},
  {e:'👑',t:'crown royalty king queen leader',c:'per'},
  {e:'🤡',t:'clown joker fool mask',c:'per'},
  {e:'👻',t:'ghost spirit haunted spooky',c:'per'},
  {e:'💀',t:'skull death dark bones',c:'per'},
  {e:'🤖',t:'robot android machine ai',c:'per'},
  {e:'👽',t:'alien extraterrestrial space being',c:'per'},
  {e:'🧝',t:'elf fantasy magical forest',c:'per'},
  {e:'🧛',t:'vampire dark blood nocturnal',c:'per'},
  {e:'🧟',t:'zombie undead dark creature',c:'per'},
  {e:'🧞',t:'genie wish magic lamp',c:'per'},
  {e:'🧜',t:'mermaid sea water fantasy',c:'per'},
  {e:'🧚',t:'fairy magic fantasy wings',c:'per'},
  {e:'🥷',t:'ninja warrior stealth dark',c:'per'},
  {e:'🦸',t:'superhero hero power cape',c:'per'},
  {e:'🦹',t:'supervillain villain dark power',c:'per'},
  {e:'🎭',t:'masks theater drama performance',c:'per'},
  {e:'🪆',t:'doll matryoshka layers nested',c:'per'},
  // Objects
  {e:'📚',t:'books reading knowledge study',c:'obj'},
  {e:'🎸',t:'guitar music rock instrument',c:'obj'},
  {e:'🎹',t:'piano keyboard music instrument',c:'obj'},
  {e:'🎨',t:'palette art paint creative',c:'obj'},
  {e:'✏️',t:'pencil write drawing sketch',c:'obj'},
  {e:'💊',t:'pill medicine health capsule',c:'obj'},
  {e:'🎮',t:'game controller gaming play',c:'obj'},
  {e:'🧩',t:'puzzle piece game logic',c:'obj'},
  {e:'🪞',t:'mirror reflection self identity',c:'obj'},
  {e:'🔑',t:'key lock access secret',c:'obj'},
  {e:'📜',t:'scroll document ancient text',c:'obj'},
  {e:'🧸',t:'teddy bear plush comfort toy',c:'obj'},
  {e:'🎀',t:'bow ribbon pink gift',c:'obj'},
  {e:'🪬',t:'hamsa protection evil eye charm',c:'obj'},
  {e:'🔮',t:'crystal ball fortune magic predict',c:'obj'},
  {e:'🪄',t:'magic wand spell enchant',c:'obj'},
  {e:'⚗️',t:'alchemy science experiment flask',c:'obj'},
  {e:'🧬',t:'dna genetics science biology',c:'obj'},
  {e:'📷',t:'camera photo memory capture',c:'obj'},
  {e:'🎵',t:'music note sound melody',c:'obj'},
  {e:'🎤',t:'microphone sing voice perform',c:'obj'},
  {e:'🖋️',t:'pen ink writing calligraphy',c:'obj'},
  {e:'🃏',t:'joker card wild unpredictable',c:'obj'},
  {e:'🎲',t:'dice random chance game',c:'obj'},
  // Misc
  {e:'🌈',t:'rainbow colors spectrum pride',c:'mis'},
  {e:'🏳️‍🌈',t:'pride flag rainbow lgbtq',c:'mis'},
  {e:'🏳️‍⚧️',t:'trans flag transgender pride',c:'mis'},
  {e:'☕',t:'coffee warm calm morning',c:'mis'},
  {e:'🍵',t:'tea cup calm cozy warm',c:'mis'},
  {e:'🏡',t:'home house safe comfort',c:'mis'},
  {e:'🌅',t:'sunrise sunset sky peaceful',c:'mis'},
  {e:'🧘',t:'meditation calm peace mindful',c:'mis'},
  {e:'🎆',t:'fireworks celebration joy burst',c:'mis'},
  {e:'💤',t:'sleep rest tired drowsy zzz',c:'mis'},
  {e:'🌀',t:'spiral dizzy cyclone dizziness',c:'mis'},
  {e:'🫧',t:'bubbles float light airy',c:'mis'},
  {e:'🕊️',t:'dove peace freedom white bird',c:'mis'},
  {e:'🌊',t:'wave ocean sea blue deep',c:'mis'},
  {e:'🫶',t:'heart hands love care support',c:'mis'},
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
    innerchat: 'Communication',
    finanzas: 'Finances',
    diario: 'Journal',
    agenda: 'Agenda',
    proyectos: 'Projects',
    normas: 'Rules',
    polls: 'Polls',
    tracker: 'State',
    wishlist: 'Wishlist',
  };
  setCrumbs([{label:'Hub', action:()=>navigateTo('hub')}, {label: labels[target] || 'Restricted'}]);
  document.getElementById('app').innerHTML = `<div class="empty-state" style="margin-top:60px"><div class="empty-icon">🔒</div><div>You do not have permission to access ${labels[target] || 'this section'}</div></div>`;
}

function renderSidebarNav() {
  const nav = document.getElementById('sb-nav');
  if (!nav) return;
  const currentSection = currentView === 'innerchat' ? comTab || 'chat' : currentView;
  const onlineItems = getOnlineProfile().enabled
    ? [
        {view:'online-amigos', icon:'◉', label:'Friends'},
        {view:'innerchat', comtab:'online', icon:'💬', label:'Online chat', perm:'comunicacion'},
        {view:'online-perfil', icon:'◇', label:'Online profile'},
      ]
    : [
        {view:'config', cfg:'online', icon:'☁', label:'Online setup'},
      ];
  const sections = [
    {
      label: 'System',
      items: [
        {view:'innerchat', comtab:'chat',       icon:'◭', label:'Chat',        perm:'comunicacion'},
        {view:'fronting',      icon:'◉', label:'Fronting'},
        {view:'perfiles',      icon:'◎', label:'Alters'},
        {view:'tracker', icon:'◉', label:'State',  perm:'emociones'},
        {view:'recordatorios', icon:'◱', label:'Reminders'},
      ]
    },
    {
      label: 'Online',
      items: onlineItems
    },
    {
      label: 'Personal',
      items: [
        {view:'diario',  icon:'◫', label:'Journal',  perm:'diario'},
        {view:'normas',  icon:'◳', label:'Rules',  perm:'normas'},
        {view:'polls',   icon:'◎', label:'Polls',  perm:'normas'},
        {view:'memoria',    icon:'◌', label:'Memory'},
        {view:'biblioteca', icon:'◫', label:'Library'},
        {view:'headspace', icon:'⌂', label:'Headspace'},
        {view:'relations', icon:'↔', label:'Relationships'},
        {view:'wiki', icon:'?', label:'Guide'},
      ]
    },
    {
      label: 'Tools',
      items: [
        {view:'agenda',    icon:'◷', label:'Agenda',    perm:'agenda'},
        {view:'rutinas',   icon:'◎', label:'Routines'},
        {view:'proyectos', icon:'◉', label:'Projects', perm:'proyectos'},
        {view:'finanzas',  icon:'◈', label:'Finances',  perm:'finanzas'},
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
      const isActive = it.comtab ? currentSection === it.comtab : currentSection === it.view;
      html += `<button type="button" class="nav-item${isActive ? ' active' : ''}" data-view="${it.view}" data-label="${it.label}"${extra}${isActive ? ' aria-current="page"' : ''}>
        <div class="nav-icon">${it.icon}</div><div class="nav-label">${it.label}</div>
      </button>`;
    });
  });

  nav.innerHTML = html;
  nav.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => {
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
let _pendingSwitchAlterId = null; // alter pending switch confirmation from layer-0
let _frontTimerInterval = null;  // interval to update live timer
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

// softDelete: delays actual deletion 5s, shows "Undo" in toast.
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
  t.innerHTML = `${label} <button id="undo-btn" style="margin-left:8px;background:none;border:1px solid currentColor;border-radius:4px;color:inherit;cursor:pointer;padding:2px 8px;font-size:12px">Undo</button>`;
  t.classList.add('show', 'toast-undo');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 5200);
  t.querySelector('#undo-btn')?.addEventListener('click', () => {
    clearTimeout(timer); _pendingDeletes.delete(key);
    t.classList.remove('show'); onUndo();
  });
}

function fmt(n) {
  return new Intl.NumberFormat('en-GB', {style:'currency', currency:'EUR'}).format(n);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function monthName(m, y) {
  return new Date(y, m-1, 1).toLocaleString('en-GB', {month:'long', year:'numeric'});
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
    lang: 'en',
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
  return window.AtriaOnlineDevicesDiagnostics.formatConnectionTs(ts, 'en');
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
  return `<button class="global-connection-indicator global-connection-${s.kind}" id="global-connection-indicator" title="${escM(s.title)}" aria-label="Online and sync status: ${escM(s.short)}"><span class="global-connection-dot"></span><span class="global-connection-label">${escM(s.short)}</span></button>`;
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
    ? `${s.lastSync.action === 'push' ? 'Push' : 'Pull'} · ${s.lastSync.deviceName || 'device'} · ${formatConnectionTs(s.lastSync.ts)}${s.lastSync.status === 'error' ? ' · ERROR' : ''}`
    : 'No operations recorded';
  const rows = [
    ['Status', s.short],
    ['Browser connection', s.browserOnline ? 'Connected' : 'Offline'],
    ['Online', s.onlineProfile?.enabled ? (s.backendConfigured ? 'Enabled automatically' : 'Service pending') : 'Disabled'],
    ['Online session', s.onlineSession ? (s.onlineSession.email || s.onlineSession.systemId || 'Active') : 'No session'],
    ['Last online', formatConnectionTs(s.lastOnlineTs)],
    ['Sync devices', String(s.syncDevices.length)],
    ['Last sync', lastSyncText],
    ['Last error', s.lastError ? String(s.lastError) : 'No errors recorded'],
  ];
  openModal(`
    <div style="display:flex;flex-direction:column;gap:14px;max-width:520px">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="global-connection-dot" style="background:${s.kind === 'online' ? '#5fffb0' : s.kind === 'sync' ? '#80d0ff' : s.kind === 'pending' ? '#ffb450' : s.kind === 'error' ? '#ff6b8a' : 'var(--text-3)'}"></span>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text-1)">Online and sync status</div>
          <div style="font-size:12px;color:var(--text-2)">Quick connectivity, online and device sync summary</div>
        </div>
      </div>
      <div class="global-status-grid">
        ${rows.map(([k,v]) => `<div class="global-status-k">${escM(k)}</div><div class="global-status-v">${escM(v)}</div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-cancel>Close</button>
        <button class="btn btn-primary btn-sm" id="global-connection-go-sync">View Sync</button>
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
  }).join('') + renderGlobalConnectionIndicator() + '<button class="btn-crisis-header" id="btn-crisis-header" title="Crisis" aria-label="Crisis">⚠</button><button id="btn-context-help" class="context-help-btn" title="About this module" aria-label="About this module">?</button><button id="btn-search-global" title="Search (Ctrl+K)" aria-label="Global search">⌕</button>';
  // Restore mobile nav toggle at the start of breadcrumbs
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'mob-nav-toggle';
  toggleBtn.setAttribute('aria-label', 'Navigation menu');
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
  fronting: ['Fronting', 'Register who is at the front, review history, edit past sessions, and inspect descriptive time statistics.'],
  analisis: ['Analytics', 'Use date and identity filters to review descriptive activity. Aggregates summarize saved records; they are not diagnoses or predictions.'],
  perfiles: ['Profiles', 'Create and organize identities, custom fields, relationships, roles, permissions, and archived profiles.'],
  proyectos: ['Projects', 'Keep longer-running personal work tied to an identity or member. Tasks remain local and can be exported with your data.'],
  diario: ['Journal', 'Use identity, tag, mood, archive, and date filters to find entries. Private entries are not shared online.'],
  tracker: ['State tracker', 'Record a mood and intensity for an identity. Summaries show the underlying entries and selected date range.'],
  innerchat: ['Internal chat', 'Use the selected sender identity, channels, drafts, and unread state for internal communication.'],
  polls: ['Polls', 'Create lightweight internal decisions, vote, archive, and explicitly choose whether a poll may be shared online.'],
  config: ['Settings', 'Change local presentation, data, notifications, online account, backup, and privacy options.'],
  agenda: ['Agenda', 'Review events and reminders. Export visible calendar data as ICS when you need an external copy.']
};
function openContextHint() {
  const hint = CONTEXT_HINTS[currentView] || ['This module', 'This screen works locally by default. Use the visible filters and actions to explore or change its records.'];
  openModal(`<div class="modal-title">${hint[0]}</div><div style="font-size:13px;line-height:1.6;color:var(--text-1);margin:4px 0 12px">${hint[1]}</div><div class="modal-footer"><button class="btn btn-primary" data-cancel>Close</button></div>`, () => {});
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
    input.placeholder = 'Search options...';
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
// LAYER 0
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// I18N — language system (layer 0)
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

let currentLang = localStorage.getItem('atria_lang') || 'en';

function t(key) { return (I18N[currentLang] || I18N.en)[key] || key; }

function setLang(lang) {
  if (!I18N[lang]) return;
  localStorage.setItem('atria_lang', lang);
  if (lang !== 'en') {
    window.location.href = '../' + lang + '/';
    return;
  }
  currentLang = lang;
  // Update visual toggle
  document.querySelectorAll('.l0-lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  // Re-render layer 0 with new language
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
  if (!confirm('Log out of this browser session?')) return;
  disableOnlineAccountSession();
  if (typeof lockOnlineAccess === 'function') lockOnlineAccess();
  showToast('Logged out');
  window.AtriaOnboardingView.show({ authOnly: true });
}
function updateLayer0LogoutButton() {
  const visible = loadOnlineSession() ? 'inline-flex' : 'none';

  document.getElementById('btn-l0-footer-logout')?.style && (document.getElementById('btn-l0-footer-logout').style.display = visible);
  document.getElementById('btn-l0-online-logout')?.style && (document.getElementById('btn-l0-online-logout').style.display = visible);
  document.getElementById('btn-shell-logout')?.style && (document.getElementById('btn-shell-logout').style.display = visible);
}
function storageRecoveryReason(state) {
  if (state?.status === 'missing') return 'The main `tid_alters` key is missing, but other Atria data exists.';
  if (state?.status === 'empty') return 'The `tid_alters` key is empty, but other Atria data exists.';
  if (state?.status === 'invalid') return 'The contents of `tid_alters` cannot be parsed as valid JSON.';
  return 'The saved `tid_alters` payload does not match a supported format.';
}
function renderStorageRecoveryNotice(state) {
  const app = document.getElementById('app');
  if (!app) return;
  const hasOtherTidKeys = hasStoredAtriaDataBesidesAlters();
  const reason = state?.status === 'invalid'
    ? 'The contents of `tid_alters` cannot be parsed as valid JSON.'
    : 'The saved `tid_alters` payload does not match a supported format.';
  app.innerHTML = `
    <div class="empty-state" style="max-width:760px;margin:40px auto;padding:28px;text-align:left">
      <div class="empty-icon">⚠</div>
      <div style="font-size:20px;font-weight:800;color:var(--text-0);margin-top:8px">Previous data was found, but this version could not read the saved alter profiles.</div>
      <div style="margin-top:10px;color:var(--text-1);line-height:1.7">
        ${storageRecoveryReason(state)}
        ${hasOtherTidKeys ? ' There are other `tid_*` keys in this browser, so opening onboarding now could make the app look new while older data stays hidden.' : ''}
      </div>
      <div style="margin-top:14px;color:var(--text-2);font-size:12px;line-height:1.7">
        Recommendation: do not create new profiles in this browser until the old <code>tid_alters</code> value has been reviewed or restored from a backup.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
        <button class="btn" id="storage-retry-btn">Retry</button>
        <button class="btn btn-ghost" id="storage-config-btn">Open settings</button>
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

  // Search
  const searchEl = document.getElementById('l0-search');
  if (searchEl) {
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
  if (titleEl) titleEl.textContent = 'Online session active';
  const searchEl = document.getElementById('l0-search');
  if (searchEl) {
    searchEl.value = '';
    searchEl.disabled = true;
    searchEl.placeholder = 'Create your first profile whenever you are ready';
  }
  const manageBtn = document.getElementById('btn-manage-alters');
  if (manageBtn) manageBtn.textContent = 'Create first profile';
  const session = loadOnlineSession();
  const account = loadOnlineAccount();
  const backupStatus = loadOnlineBackupStatus() || {};
  const restoreBlocked = !!backupStatus.loginRestoreBlocked;
  const grid = document.getElementById('alter-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="alter-card-wrap" style="max-width:340px">
      <div class="alter-card" style="--card-color:#5fffb0;cursor:default;min-height:220px;align-items:flex-start;text-align:left;padding:20px">
        <div style="font-size:12px;color:var(--text-3);letter-spacing:.08em;text-transform:uppercase">Online account</div>
        <div style="font-size:20px;font-weight:800;color:var(--text-1);margin-top:10px">${esc(account?.displayName || account?.systemId || 'Atria')}</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);margin-top:8px">${esc(account?.friendCode || 'ATRIA-XXXX-XXXX-XXXX')}</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:10px">${esc(account?.email || session?.email || '')}</div>
        <div style="font-size:12px;color:${restoreBlocked ? '#ffcf6f' : 'var(--text-2)'};margin-top:14px">${restoreBlocked
          ? `Your online account exists, but its profiles could not be restored. Automatic backup is paused to protect the remote copy. ${esc(backupStatus.lastError || '')}`
          : 'This online account does not currently have restorable profiles. You can create a profile now or restore data later.'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
          <button class="btn ${restoreBlocked ? 'btn-ghost' : 'btn-primary'}" id="btn-l0-create-first-profile">${restoreBlocked ? 'Create a new profile anyway' : 'Create first profile'}</button>
          <button class="btn btn-danger" id="btn-l0-online-logout">Log out</button>
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

  // On mobile: no pagination, show all (native scroll)
  let pageAlters, totalPages, showAdd;
  if (l0IsMobile()) {
    pageAlters = filtered;
    totalPages = 1;
    l0Page = 0;
    showAdd = true;
  } else {
    const perPage = L0_PER_PAGE_DESK;
    totalPages = Math.max(1, Math.ceil((filtered.length + 1) / perPage)); // +1 for add button
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
        ${isFronting ? `<div class="l0-front-badge">◉ fronting</div>` : ''}
        <button type="button" class="alter-card-fav${isFavoriteAlter(a)?' active':''}" data-fav-id="${a.id}" title="${isFavoriteAlter(a)?'Remove favorite':'Pin alter'}" aria-label="${isFavoriteAlter(a)?'Remove favorite':'Pin alter'}">&#9733;</button>
        <div class="alter-avatar" style="background:${a.bg};overflow:hidden;display:flex;align-items:center;justify-content:center">${alterAv(a,48)}</div>
        <div class="alter-name">${esc(a.name)}</div>
        <div class="alter-role">${a.roleType ? getAllRoleTypes().find(r=>r.id===a.roleType)?.label||a.role : a.role}</div>
      </div>
      <div class="alter-card-edit btn-quick-edit" data-id="${a.id}" title="Edit profile">✎</div>
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

  // Pagination
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
  activeAlter = alter;
  document.body.classList.toggle('atria-simplified-mode', !!loadConfig().simplifiedMode || ['bebe','nino'].includes(alter.ageType));
  registrarSesion(alter.id);
  // Fronting decoupled: only auto-register switch if no active session from a different alter
  const frontActual = getFrontingActual();
  if (!frontActual) {
    // No active session → register switch automatically
    iniciarFronting(alter.id);
  } else if (frontActual.alterId === alter.id) {
    // Same alter already fronting → don't touch fronting
  } else {
    // Active session from a DIFFERENT alter → ask for confirmation
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
    // Start native notification scheduler if permission already granted
    if (nativeNotifGranted()) startNotifScheduler();
    // Ask how the alter feels on entry
    askMoodOnEntry(alter, () => {
      navigateTo('hub');
      processPendingNotifRoute();
      // If there's a pending switch confirmation, show modal after mood
      if (_pendingSwitchAlterId) {
        const pid = _pendingSwitchAlterId;
        _pendingSwitchAlterId = null;
        setTimeout(() => openConfirmarSwitchModal(pid), 400);
      }
    });
  }, 350);
}

function showPerfilesFromLayer0() {
  // Show perfiles manager as a full overlay directly from layer 0
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.style.cssText = 'align-items:flex-start;padding:40px 20px;overflow-y:auto';
  ov.innerHTML = `<div class="modal" style="width:min(860px,95vw);max-height:none">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <div>
        <div class="modal-title">⚙ Manage profiles</div>
        <div class="modal-subtitle">Create, edit and configure the system alters</div>
      </div>
      <button class="btn btn-ghost" data-cancel>✕ Close</button>
    </div>
    <div id="perfiles-inline-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-top:16px"></div>
    <div style="margin-top:14px">
      <button class="btn btn-primary" id="btn-new-alter-inline">+ New alter</button>
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
  const MODULES_LIST = [{id:'finanzas',label:'Finances'},{id:'emociones',label:'Emotions'},{id:'diario',label:'Journal'},{id:'comunicacion',label:'Communication'},{id:'perfiles',label:'Profiles'}];
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
      ${a.referenceImgs?.length?`<div class="alter-reference-links">${a.referenceImgs.slice(0,4).map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">↗ Reference</a>`).join('')}</div>`:''}
      ${a.identityFlags?.length?`<div class="perfil-card-flags">${a.identityFlags.map(flag=>`<span class="perm-chip on">${esc(flag)}</span>`).join('')}</div>`:''}
      ${a.identityTerms?`<div style="font-size:11px;color:var(--text-2);margin:5px 0">Terms: ${esc(a.identityTerms)}</div>`:''}
      ${a.mentionedAlterIds?.length?`<div style="font-size:11px;color:var(--text-2);margin:5px 0">Mentions: ${a.mentionedAlterIds.map(id=>getAlters(true).find(x=>x.id===id)?.name).filter(Boolean).map(esc).join(', ')}</div>`:''}
      <div class="perfil-card-perms">
        ${MODULES_LIST.map(m=>`<span class="perm-chip ${a.permissions?.[m.id]?'on':'off'}">${m.label}</span>`).join('')}
      </div>
      <div class="perfil-card-actions">
        <button class="btn btn-ghost btn-sm btn-edit-perfil" data-id="${a.id}">✎ Edit</button>
        ${!a.isAdmin?`<button class="btn btn-danger btn-sm btn-del-perfil" data-id="${a.id}">✕</button>`:''}
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.btn-edit-perfil').forEach(b=>b.addEventListener('click',()=>{
    const a=getAlters().find(x=>x.id===b.dataset.id);
    if(a){ ov.remove(); openAlterModal(a,()=>showPerfilesFromLayer0()); }
  }));
  grid.querySelectorAll('.btn-del-perfil').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('Delete this alter?')) return;
    purgeAlterData(b.dataset.id);
    saveAlters(getAlters(true).filter(x=>x.id!==b.dataset.id));
    renderLayer0();
    renderPerfilesInline(grid, ov);
    showToast('Alter deleted');
  }));
}

function closeMobileNav() {
  const nav = document.getElementById('mobile-nav');
  if (!nav) return;
  nav.classList.remove('mob-nav-open');
  nav.classList.add('mob-nav-hidden');
  const icon = document.querySelector('#mob-nav-toggle-icon');
  if (icon) icon.textContent = '☰';
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function showErrorBoundary(view, err) {
  console.error('[Atria] Error in module:', view, err);
  const app = document.getElementById('app');
  if (!app) return;
  const msg = err?.message || String(err) || 'Unknown error';
  app.innerHTML = [
    '<div class="error-boundary">',
    '<div class="error-boundary-icon">&#9888;&#65039;</div>',
    '<div class="error-boundary-title">Something went wrong in this module</div>',
    '<div class="error-boundary-desc">An error occurred while loading <strong>' + escF(view) + '</strong>.<br>Your data has not been lost. You can go back to home and keep using the app.</div>',
    '<details style="width:100%;max-width:420px">',
    '<summary style="font-family:DM Mono,monospace;font-size:10px;color:var(--text-2);cursor:pointer;margin-bottom:6px">View error details</summary>',
    '<div class="error-boundary-detail">' + escF(msg) + '</div>',
    '</details>',
    '<div class="error-boundary-actions">',
    '<button class="btn btn-primary" id="err-go-hub">Go back to home</button>',
    '<button class="btn btn-ghost" id="err-retry">Retry</button>',
    '</div>',
    '</div>'
  ].join('');
  document.getElementById('err-go-hub')?.addEventListener('click', () => navigateTo('hub'));
  document.getElementById('err-retry')?.addEventListener('click', () => navigateTo(view));
}

function navigateTo(view, _fromPopstate) {
  // Clear fronting timer if leaving that view
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
    wiki: window.AtriaWikiView.render,
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
    (routes[view] || (() => showToast('Module coming soon')))();
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
  const greet  = h<6?'Good evening':h<13?'Good morning':h<20?'Good afternoon':'Good evening';
  const dayStr = now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});

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
    frontStatusHtml = `<span class="hub-status-icon" style="color:var(--text-3)">◉</span><div><div class="hub-status-val" style="color:var(--text-2)">No session</div><div class="hub-status-label">fronting</div></div>`;
  }

  // Barra de estado: tablón
  const tablonMsgs = loadTablon().sort((a,b)=>b.ts-a.ts);
  const tablonPin = tablonMsgs.find(m=>m.pinned);
  const tablonLast = tablonPin || tablonMsgs[0];
  let tablonStatusHtml = '';
  if (tablonLast) {
    const ta = allAlters.find(a=>a.id===tablonLast.alterId)||{emoji:'◎',name:'System',color:'var(--text-2)'};
    const txt = tablonLast.text.length>38 ? tablonLast.text.slice(0,38)+'…' : tablonLast.text;
    tablonStatusHtml = `<span style="font-size:13px">${ta.emoji}</span><div style="min-width:0"><div class="hub-status-val">${escM(txt)}</div><div class="hub-status-label">${tablonPin?'◈ pinned · ':''}${ta.name}</div></div>`;
  } else {
    tablonStatusHtml = `<span class="hub-status-icon" style="color:var(--text-3)">◈</span><div><div class="hub-status-val" style="color:var(--text-2)">No messages</div><div class="hub-status-label">board</div></div>`;
  }

  // Snapshot: today's routines and next reminder
  const allRoutines = (() => { try { return loadRoutines().filter(r => routineVisibleToAlter(r, activeAlter?.id) && routineDueOnDate(r, new Date().toISOString().slice(0,10))); } catch{return[];} })();
  const doneRoutinesToday = allRoutines.filter(r => routineProgress(r, new Date().toISOString().slice(0,10)).done).length;
  const nextReminder = (() => { try { return loadReminders().filter(r=>!r.done&&r.datetime>Date.now()&&(!r.alterId||r.alterId===activeAlter.id)).sort((a,b)=>a.datetime-b.datetime)[0]||null; } catch{return null;} })();

  // ── DASHBOARD CARDS ──
  const todayStr = now.toISOString().slice(0,10);

  // Tracker today
  const trackerHoy = loadTracker().find(e => e.alterId===activeAlter.id && e.date===todayStr);
  const moodObj    = trackerHoy ? getMoods().find(m=>m.id===trackerHoy.mood) : null;
  const moodEmoji  = moodObj?.emoji || '◫';
  const moodLabel  = moodObj?.label || trackerHoy?.mood || '—';
  const moodInt    = trackerHoy?.intensity || 0;

  // Projects and tasks
  const proyActivos  = loadProyectos().filter(p=>p.status==='activo');
  const tareasAll    = loadTareas();
  const tareasPend   = tareasAll.filter(t=>t.status!=='completada'&&(t.assigneeId===activeAlter.id||proyActivos.some(p=>p.id===t.proyId)));
  const tareasVenc   = tareasPend.filter(t=>t.deadline&&t.deadline<todayStr);

  // Next agenda event
  const nowMs = Date.now();
  const nextEvent = (() => {
    try {
      return loadEvents()
        .filter(e => (e.scope==='compartido'||getEventAlterIds(e).includes(activeAlter.id)) && eventDate(e.date, e.time || '23:59').getTime() >= nowMs)
        .sort((a,b) => eventDate(a.date, a.time || '23:59').getTime() - eventDate(b.date, b.time || '23:59').getTime())[0] || null;
    } catch { return null; }
  })();

  const _onlineEnabled = getOnlineProfile().enabled;

  // Hub modules — filtered by active alter permissions
  const HUB_NAV_DEF = [
    {
      label:'System', color:'#ff8ae2',
      items:[
        {id:'innerchat',     name:'Communication',  icon:'◭', color:'#8affe0', view:'innerchat',     perm:'comunicacion'},
        {id:'fronting',      name:'Fronting',        icon:'◉', color:'#ff8ae2', view:'fronting'},
        {id:'perfiles',      name:'Alters',          icon:'◎', color:'#8ab4ff', view:'perfiles'},
        {id:'tracker',       name:'State',           icon:'🌡', color:'#ffd580', view:'tracker',       perm:'emociones'},
        {id:'analisis',      name:'Analytics',       icon:'◈', color:'#5fffb0', view:'analisis'},
        {id:'recordatorios', name:'Reminders',       icon:'🔔', color:'#8affe0', view:'recordatorios'},
      ]
    },
    {
      label:'Personal', color:'#ff8ae2',
      items:[
        {id:'diario',  name:'Journal', icon:'◫', color:'#ff8ae2', view:'diario',  perm:'diario'},
        {id:'normas',     name:'Rules',    icon:'◳', color:'#8ab4ff', view:'normas',     perm:'normas'},
        {id:'polls',      name:'Polls',    icon:'◎', color:'#ffd580', view:'polls',      perm:'normas'},
        {id:'memoria',    name:'Memory',   icon:'◌', color:'#ffb450', view:'memoria'},
        {id:'biblioteca', name:'Library',  icon:'◫', color:'#a08aff', view:'biblioteca'},
      ]
    },
    {
      label:'Internal', color:'#ff8ae2',
      items:[
        {id:'headspace', name:'Headspace', icon:'⌂', color:'#8ab4ff', view:'headspace'},
        {id:'relations', name:'Relationships', icon:'↔', color:'#ff8ae2', view:'relations'},
      ]
    },
    {
      label:'Tools', color:'#a08aff',
      items:[
        {id:'agenda',    name:'Agenda',    icon:'◷', color:'#ffb450', view:'agenda',    perm:'agenda'},
        {id:'rutinas',   name:'Routines',  icon:'◎', color:'#ffd580', view:'rutinas'},
        {id:'proyectos', name:'Projects',  icon:'◉', color:'#8affe0', view:'proyectos', perm:'proyectos'},
        {id:'finanzas',  name:'Finances',  icon:'◈', color:'#5fffb0', view:'finanzas',  perm:'finanzas'},
      ]
    },
    ...(_onlineEnabled ? [{
      label:'Online', color:'#5fffb0',
      items:[
        {id:'online-amigos',     name:'Friends', icon:'◉', color:'#ff8ae2', view:'online-amigos'},
        {id:'hub-online-chat',   name:'Chat',    icon:'💬', color:'#8affe0', view:'innerchat'},
        {id:'online-perfil',     name:'Profile', icon:'◎', color:'#8ab4ff', view:'online-perfil'},
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
  const _onlinePendingReqs = _onlineEnabled ? loadOnlineFriendRequests().filter(r => r.status === 'pending').length : 0;


  // ── NOTIFICATIONS ──
  let notifBannersHtml = '';
  try { notifBannersHtml = activeAlter ? renderNotifBanners(activeAlter.id) : ''; } catch(e) { console.warn('Notif error:', e); }

  document.getElementById('app').innerHTML = `
    <div class="hub-view">

      <!-- HEADER -->
      <div>
        <div class="hub-greeting-label">${greet} · ${dayStr}</div>
        <div class="hub-greeting-title">Hello, <span style="color:${activeAlter.color}">${activeAlter.name}</span></div>
      </div>

      ${notifBannersHtml}

      <!-- STATUS BAR -->
      <div class="hub-status-bar">
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
          <div class="hub-status-item" id="hub-status-front" style="flex:1;min-width:0">
            ${frontStatusHtml}
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-hub-quick-switch" style="flex-shrink:0;white-space:nowrap" title="Quick fronting switch">⇄ Switch</button>
        </div>
        <div class="hub-status-item" id="hub-status-tablon">
          ${tablonStatusHtml}
        </div>
        ${solicPend.length>0?`<div class="hub-status-item" id="hub-status-solic" style="flex:0 0 auto">
          <span class="hub-status-icon" style="color:#ff8ae2">◱</span>
          <div><div class="hub-status-val" style="color:#ff8ae2">${solicPend.length} pending</div><div class="hub-status-label">Requests</div></div>
        </div>`:''}
        ${remindersHoy.length>0?`<div class="hub-status-item" id="hub-status-reminders" style="flex:0 0 auto;cursor:pointer">
          <span class="hub-status-icon">🔔</span>
          <div><div class="hub-status-val" style="color:#ffd580">${remindersHoy.length} today</div><div class="hub-status-label">reminders</div></div>
        </div>`:''}
      </div>


      <!-- SNAPSHOT -->
      ${(allRoutines.length > 0 || nextReminder) ? `<div class="hub-snapshot">
        ${allRoutines.length > 0 ? `<div class="hub-snap-card" id="snap-rutinas">
          <span class="hub-snap-icon">◎</span>
          <div>
            <div class="hub-snap-val">${doneRoutinesToday}/${allRoutines.length}</div>
            <div class="hub-snap-label">routines today</div>
          </div>
          <div class="hub-snap-bar">
            <div class="hub-snap-fill" style="width:${allRoutines.length?Math.round((doneRoutinesToday/allRoutines.length)*100):0}%;background:var(--accent-2)"></div>
          </div>
        </div>` : ''}
        ${nextReminder ? `<div class="hub-snap-card" id="snap-reminder">
          <span class="hub-snap-icon">🔔</span>
          <div>
            <div class="hub-snap-val" style="font-size:12px">${escM(nextReminder.title.length>22?nextReminder.title.slice(0,22)+'…':nextReminder.title)}</div>
            <div class="hub-snap-label">${new Date(nextReminder.datetime).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
          </div>
        </div>` : ''}
      </div>` : ''}

      <!-- DASHBOARD CARDS -->
      <div class="hub-dashboard">
        ${(activeAlter.permissions?.emociones !== false || activeAlter.isAdmin) ? `<div class="hub-dash-card" id="dash-tracker" title="View mood tracker">
          <div class="hub-dash-card-header">
            <span class="hub-dash-card-label">Today's state</span>
            ${trackerHoy ? '' : `<span style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace">+ add</span>`}
          </div>
          ${trackerHoy
            ? `<div class="hub-dash-card-main">${moodEmoji} <span style="font-weight:700;color:var(--text-1)">${escM(moodLabel)}</span></div>
               <div class="hub-dash-int-row">${[1,2,3,4,5].map(i=>`<span class="hub-dash-int-pip${moodInt>=i?' on':''}" style="${moodInt>=i?'background:var(--accent)':''}"></span>`).join('')}</div>`
            : `<div class="hub-dash-card-main" style="color:var(--text-1);font-size:13px">No entry today</div>`
          }
        </div>` : ''}
        <div class="hub-dash-card" id="dash-proyectos" title="View projects">
          <div class="hub-dash-card-header">
            <span class="hub-dash-card-label">Projects</span>
            ${tareasVenc.length ? `<span style="font-size:10px;color:#ff6b8a;font-family:'DM Mono',monospace">⚠ ${tareasVenc.length} overdue</span>` : ''}
          </div>
          <div class="hub-dash-card-main">${proyActivos.length} <span style="font-size:11px;color:var(--text-1);font-weight:400">active</span></div>
          <div style="font-size:11px;color:var(--text-1);margin-top:2px">${tareasPend.length} pending task${tareasPend.length!==1?'s':''}</div>
        </div>
        ${(activeAlter.permissions?.agenda !== false || activeAlter.isAdmin) ? `<div class="hub-dash-card" id="dash-agenda" title="View calendar">
          <div class="hub-dash-card-header"><span class="hub-dash-card-label">Next event</span></div>
          ${nextEvent
            ? `<div class="hub-dash-card-main" style="font-size:12px;font-weight:700;line-height:1.3">${escM(nextEvent.title.length>26?nextEvent.title.slice(0,26)+'…':nextEvent.title)}</div>
               <div style="font-size:11px;color:var(--accent);margin-top:2px;font-family:'DM Mono',monospace">${eventDate(nextEvent.date,nextEvent.time).toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'})}${nextEvent.allDay||!nextEvent.time ? ' · All day' : ''}</div>`
            : `<div class="hub-dash-card-main" style="color:var(--text-1);font-size:13px">No events</div>`
          }
        </div>` : ''}
        ${_onlineEnabled ? `<div class="hub-dash-card" id="dash-online" title="View online friends" style="cursor:pointer">
          <div class="hub-dash-card-header"><span class="hub-dash-card-label" style="color:#5fffb0">Online</span></div>
          <div class="hub-dash-card-main" style="font-size:13px">
            <span style="color:${onlinePresenceSummary.online>0?'#5fffb0':'var(--text-3)'}">●</span>
            <span style="font-weight:700">${onlinePresenceSummary.online}</span>
            <span style="font-size:11px;color:var(--text-1);font-weight:400">friend${onlinePresenceSummary.online!==1?'s':''} online</span>
          </div>
          ${_onlinePendingReqs > 0 ? `<div style="font-size:11px;color:#ffd580;margin-top:2px">⚑ ${_onlinePendingReqs} pending request${_onlinePendingReqs!==1?'s':''}</div>` : ''}
        </div>` : ''}
      </div>

      <!-- Hub navigation -->
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
const FINANCE_CURRENCIES = [{id:'EUR',label:'€ EUR — Euro'},{id:'USD',label:'$ USD — US dollar'},{id:'GBP',label:'£ GBP — Pound sterling'},{id:'MXN',label:'$ MXN — Mexican peso'},{id:'ARS',label:'$ ARS — Argentine peso'},{id:'CAD',label:'$ CAD — Canadian dollar'},{id:'AUD',label:'$ AUD — Australian dollar'},{id:'CHF',label:'CHF — Swiss franc'},{id:'JPY',label:'¥ JPY — Japanese yen'}];
function getFinanceCurrency() { return loadConfig()?.financeCurrency || 'EUR'; }
function financeFmt(value) { return window.AtriaFinanceService.formatAmount(value, getFinanceCurrency(), 'en-GB'); }
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
  const financeStore=window.AtriaFinanceStore.create(load,save,activeAlter?.id), financeService=window.AtriaFinanceService;
  const cats=financeStore.categories(DEFAULT_CATS), txs=financeService.filterTransactions(financeStore.transactions(),{month,year,category:financeDashboardFilter.category}), allTxs=financeStore.transactions();
  const {income,expense,balance}=financeService.summarize(txs), budgets=financeStore.budgets(), savings=financeService.savingsProgress(financeStore.savings()), monthLabel=new Date(year,month-1,1).toLocaleString('en-GB',{month:'long',year:'numeric'}), months=Array.from({length:12},(_,i)=>({v:i+1,l:new Date(2000,i,1).toLocaleString('en-GB',{month:'short'})}));
  const years=[...new Set(allTxs.map(t=>new Date(t.date).getFullYear()).filter(Number.isFinite))]; if(!years.includes(year))years.push(year); years.sort((a,b)=>b-a);
  const budgetCards=financeService.budgetProgress(budgets,allTxs,month,year).slice(0,4).map(p=>{const used=p.used,pct=p.percent,cat=cats.find(c=>c.id===p.categoryId);return `<div style="display:grid;gap:5px"><div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(cat?.name||p.categoryId)}</span><span>${financeFmt(used)} / ${financeFmt(p.limit)}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pct>=100?'var(--red)':pct>=80?'var(--accent-4)':'var(--accent-3)'}"></div></div><div style="font-size:10px;color:var(--text-3)">${pct}% used</div></div>`;}).join('');
  const cards=[['Income',income,'pos'],['Expenses',expense,'neg'],['Balance',balance,balance>=0?'pos':'neg']].map(([label,value,klass])=>`<div class="balance-card ${klass==='pos'?'positive':klass==='neg'?'negative':'neutral'}"><div class="bc-label">${label}</div><div class="bc-value ${klass}">${financeFmt(value)}</div></div>`).join('');
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Finances'}]);
  document.getElementById('app').innerHTML=`<div class="fin-view"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><div class="fin-title">◈ Finances</div><div class="fin-subtitle">${esc(activeAlter.name)} · ${monthLabel}</div></div><button class="btn btn-primary" id="btn-dashboard-add">+ New transaction</button></div><div class="ig-balance-row">${cards}</div><div class="ig-toolbar"><div class="filter-group"><select id="fin-dash-month">${months.map(m=>`<option value="${m.v}" ${m.v===month?'selected':''}>${m.l}</option>`).join('')}</select><select id="fin-dash-year">${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></div><select id="fin-dash-category"><option value="all">All categories</option>${cats.map(c=>`<option value="${c.id}" ${c.id===financeDashboardFilter.category?'selected':''}>${esc(c.name)}</option>`).join('')}</select><select id="fin-currency" aria-label="Currency">${FINANCE_CURRENCIES.map(c=>`<option value="${c.id}" ${c.id===getFinanceCurrency()?'selected':''}>${c.label}</option>`).join('')}</select><button class="btn btn-ghost ml-auto" data-view="finanzas/ig">View transactions</button></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px"><div class="fin-sistema-banner"><div class="section-title">Cash flow</div><div style="font-size:12px;color:var(--text-2)">${txs.length} transactions this month</div><div style="margin-top:12px;height:10px;border-radius:8px;background:var(--bg-3);overflow:hidden"><div style="height:100%;width:${income?Math.min(100,expense/income*100):0}%;background:var(--accent-4)"></div></div><div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px"><span>Expenses vs income</span><strong>${income?Math.round(expense/income*100):0}%</strong></div></div><div class="fin-sistema-banner"><div class="section-title">Budgets</div>${budgetCards||'<div style="font-size:12px;color:var(--text-3)">No budgets for this alter yet.</div>'}<button class="btn btn-ghost btn-sm" data-view="finanzas/presupuestos" style="margin-top:10px">Manage budgets</button></div><div class="fin-sistema-banner"><div class="section-title">Savings</div>${savings.length?`<div style="display:grid;gap:8px">${savings.slice(0,3).map(a=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px"><span>${esc(a.name)}</span><strong>${Math.min(100,Math.round((a.current/a.target)*100))}%</strong></div>`).join('')}</div>`:'<div style="font-size:12px;color:var(--text-3)">No savings goals yet.</div>'}<button class="btn btn-ghost btn-sm" data-view="finanzas/ahorros" style="margin-top:10px">View savings</button></div></div><div><div class="section-title">Recent transactions</div><div class="ig-list">${txs.slice(0,5).map(t=>`<div class="tx-row"><div class="tx-desc">${esc(t.description)}</div><div>${esc(cats.find(c=>c.id===t.category)?.name||'—')}</div><div class="tx-date">${fmtDate(t.date)}</div><div class="tx-amount ${t.type==='ingreso'?'ing':'gst'}">${t.type==='ingreso'?'+':'−'}${financeFmt(t.amount)}</div><div></div></div>`).join('')||'<div class="empty-state"><div>No transactions in this period.</div></div>'}</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost" data-view="finanzas/registro">Monthly record</button><button class="btn btn-ghost" data-view="finanzas/categorias">Manage categories</button></div></div>`;
  const alterFilter=document.createElement('select'); alterFilter.id='fin-dash-alter'; alterFilter.setAttribute('aria-label','Alter'); alterFilter.innerHTML=getAlters().map(a=>`<option value="${a.id}" ${a.id===activeAlter?.id?'selected':''}>${esc(a.name)}</option>`).join(''); document.querySelector('.ig-toolbar')?.prepend(alterFilter); alterFilter.addEventListener('change',e=>{const alter=getAlters().find(a=>a.id===e.target.value);if(alter){selectAlter(alter);renderFinanzasDashboard();}}); document.getElementById('fin-dash-month').addEventListener('change',e=>{financeDashboardFilter.month=+e.target.value;renderFinanzasDashboard();}); document.getElementById('fin-dash-year').addEventListener('change',e=>{financeDashboardFilter.year=+e.target.value;renderFinanzasDashboard();}); document.getElementById('fin-dash-category').addEventListener('change',e=>{financeDashboardFilter.category=e.target.value;renderFinanzasDashboard();}); document.getElementById('fin-currency').addEventListener('change',e=>{saveConfig({...loadConfig(),financeCurrency:e.target.value});renderFinanzasDashboard();}); document.getElementById('btn-dashboard-add').addEventListener('click',()=>openTxModal(null)); document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>{if(el.dataset.view==='finanzas/ig')igFilter.category=financeDashboardFilter.category;navigateTo(el.dataset.view);}));
}

function renderFinanzas() {
  const fmt = financeFmt;
  setCrumbs([
    {label:'Hub', action:()=>navigateTo('hub')},
    {label:'Finances'},
  ]);
  const subs = [
    {view:'finanzas/ig',          icon:'↕', name:'Income / Expenses',  desc:'Transaction Log',            color:'#a08aff', bg:'rgba(160,138,255,0.1)'},
    {view:'finanzas/ahorros',     icon:'◆', name:'Savings',             desc:'Goals & Progress',            color:'#8affe0', bg:'rgba(138,255,224,0.1)'},
    {view:'finanzas/presupuestos',icon:'▤', name:'Budgets',             desc:'Category Limits',             color:'#ffb450', bg:'rgba(255,180,80,0.1)'},
    {view:'finanzas/registro',    icon:'≡', name:'Monthly Log',         desc:'Aggregate Summary',           color:'#ff8ae2', bg:'rgba(255,138,226,0.1)'},
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
        <div class="fin-title">◈ Finances</div>
        <div class="fin-subtitle">Finances of ${activeAlter.name}</div>
      </div>
      ${isAdmin ? `
      <div class="fin-sistema-banner">
        <div class="fin-sistema-title">◎ System overview · ${now.toLocaleString('en-GB',{month:'long',year:'numeric'})}</div>
        <div class="ig-balance-row" style="margin-top:10px">
          <div class="balance-card positive"><div class="bc-label">Total income</div><div class="bc-value pos">${fmt(sysIngresos)}</div></div>
          <div class="balance-card negative"><div class="bc-label">Total expenses</div><div class="bc-value neg">${fmt(sysGastos)}</div></div>
          <div class="balance-card neutral"><div class="bc-label">System balance</div><div class="bc-value ${sysBalance>=0?'pos':'neg'}">${fmt(sysBalance)}</div></div>
        </div>
        <button class="btn btn-ghost" id="btn-fin-sistema" style="margin-top:10px">View system detail →</button>
      </div>` : ''}
      <div>
        <div class="section-title">Submodules</div>
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
        <div class="section-title">Settings</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost" data-view="finanzas/categorias">⚙ Manage categories</button>
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
    {label:'Finances',action:()=>navigateTo('finanzas')},
    {label:'Income / Expenses'},
  ]);
  const financeStore = window.AtriaFinanceStore.create(load, save, activeAlter?.id);
  const financeService = window.AtriaFinanceService;
  const cats = financeStore.categories(DEFAULT_CATS);
  const txs = financeStore.transactions();
  const accounts = [...new Set(txs.map(t=>t.account).filter(Boolean))].sort();
  const sources = [...new Set(txs.map(t=>t.source).filter(Boolean))].sort();
  const filtered = financeService.filterTransactions(txs, {month:igFilter.month, year:igFilter.year, type:igFilter.type, category:igFilter.category, account:igFilter.account, source:igFilter.source});

  const ingresos = filtered.filter(t=>t.type==='ingreso').reduce((s,t)=>s+t.amount,0);
  const gastos   = filtered.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0);
  const balance  = ingresos - gastos;

  const years = [...new Set(txs.map(t=>new Date(t.date).getFullYear()))];
  if (!years.includes(igFilter.year)) years.push(igFilter.year);
  years.sort((a,b)=>b-a);

  const months = Array.from({length:12},(_,i)=>({v:i+1,l:new Date(2000,i,1).toLocaleString('en-GB',{month:'long'})}));

  document.getElementById('app').innerHTML = `
    <div class="ig-view">
      <div class="ig-balance-row">
        <div class="balance-card positive">
          <div class="bc-label">Income</div>
          <div class="bc-value pos">${fmt(ingresos)}</div>
        </div>
        <div class="balance-card negative">
          <div class="bc-label">Expenses</div>
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
            <option value="all" ${igFilter.type==='all'?'selected':''}>All</option>
            <option value="ingreso" ${igFilter.type==='ingreso'?'selected':''}>Income</option>
            <option value="gasto" ${igFilter.type==='gasto'?'selected':''}>Expenses</option>
          </select>
          <select id="fil-category"><option value="all">All categories</option>${cats.map(c=>`<option value="${c.id}" ${igFilter.category===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
          <select id="fil-account"><option value="all">All accounts</option>${accounts.map(v=>`<option value="${esc(v)}" ${igFilter.account===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
          <select id="fil-source"><option value="all">All sources</option>${sources.map(v=>`<option value="${esc(v)}" ${igFilter.source===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary ml-auto" id="btn-add-tx">+ New transaction</button>
      </div>

      <div class="ig-list">
        <div class="ig-list-header">
          <span>Description</span>
          <span>Category</span>
          <span>Date</span>
          <span>Amount</span>
          <span></span>
        </div>
        ${filtered.length===0 ? `
          <div class="empty-state">
            <div class="empty-icon">◈</div>
            <div>No transactions this period</div>
          </div>` :
          filtered.map(t => {
            const cat = cats.find(c=>c.id===t.category);
            const isRecur = t.recur && t.recur !== 'none';
            return `<div class="tx-row" data-id="${t.id}">
              <div><div class="tx-desc" title="${t.description}">${t.description}${isRecur?` <span class="event-recur-badge">R</span>`:''}</div>${t.account||t.source?`<div class="tx-meta">${esc([t.account,t.source].filter(Boolean).join(' · '))}</div>`:''}</div>
              <div><span class="tx-cat" style="background:${cat?cat.color+'22':'rgba(255,255,255,.06)'};color:${cat?cat.color:'var(--text-2)'}">${cat?cat.name:'—'}</span></div>
              <div class="tx-date">${fmtDate(t.date)}</div>
              <div class="tx-amount ${t.type==='ingreso'?'ing':'gst'}">${t.type==='ingreso'?'+':'−'}${fmt(t.amount)}</div>
              <div class="tx-actions">
                <button class="icon-btn btn-edit-tx" data-id="${t.id}" title="Edit">✎</button>
                <button class="icon-btn btn-duplicate-tx" data-id="${t.id}" title="Duplicate">⧉</button>
                <button class="icon-btn btn-del-tx" data-id="${t.id}" title="Delete">✕</button>
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
    showToast('Transaction duplicated');
    renderIG();
  }));
  document.querySelectorAll('.btn-del-tx').forEach(b => b.addEventListener('click', () => {
    const txs = load('transactions').filter(t=>t.id!==b.dataset.id);
    save('transactions', txs);
    showToast('Transaction deleted');
    renderIG();
  }));
}

function openTxModal(tx) {
  const fmt = financeFmt;
  const cats = load('categories', DEFAULT_CATS);
  const isEdit = !!tx;
  const today = new Date().toISOString().slice(0,10);
  const TX_RECUR_OPTS = window.AtriaFinanceRecurring.getTransactionRecurrenceOptions('en');
  openModal(`
    <div class="modal-title">${isEdit?'Edit':'New'} transaction</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Type</div>
        <div class="radio-group">
          <div class="radio-opt ${!isEdit||tx.type==='ingreso'?'selected-ing':''}" data-type="ingreso">↑ Income</div>
          <div class="radio-opt ${isEdit&&tx.type==='gasto'?'selected-gst':''}" data-type="gasto">↓ Expenses</div>
        </div>
        <input type="hidden" id="tx-type" value="${tx?.type||'ingreso'}">
      </div>
      <div class="form-row">
        <div class="form-label">Description</div>
        <input type="text" id="tx-desc" placeholder="E.g. Paycheck, Supermarket…" value="${tx?.description||''}">
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Amount (€)</div>
          <input type="number" id="tx-amount" placeholder="0.00" step="0.01" min="0" value="${tx?.amount||''}">
        </div>
        <div class="form-row">
          <div class="form-label">Date</div>
          <input type="date" id="tx-date" value="${tx?.date||today}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Category</div>
        <select id="tx-cat">
          ${cats.map(c=>`<option value="${c.id}" ${tx?.category===c.id?'selected':''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row two-col">
        <div class="form-row"><div class="form-label">Account (optional)</div><input type="text" id="tx-account" placeholder="Bank, cash…" value="${tx?.account||''}"></div>
        <div class="form-row"><div class="form-label">Source (optional)</div><input type="text" id="tx-source" placeholder="Salary, groceries…" value="${tx?.source||''}"></div>
      </div>
      <div class="form-row">
        <div class="form-label">Repeat</div>
        <div class="recur-opts">
          ${TX_RECUR_OPTS.map(r=>`<div class="recur-opt ${(tx?.recur||'none')===r.id?'selected':''}" data-txrecur="${r.id}">${r.label}</div>`).join('')}
        </div>
        <input type="hidden" id="tx-recur" value="${tx?.recur||'none'}">
      </div>
      ${isEdit && tx?._recurOrigin ? `<div class="form-row"><div class="form-label">Apply changes to</div><select id="tx-scope"><option value="one">This transaction only</option><option value="future">This and future transactions</option><option value="series">Entire series</option></select></div>` : ''}
      <div class="form-row">
        <div class="form-label">Note (optional)</div>
        <textarea id="tx-note" placeholder="Additional notes…">${tx?.note||''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save Changes':'Add'}</button>
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
      if (!desc || isNaN(amount) || amount<=0 || !date) return showToast('⚠ Complete the required fields');
      const financeStore = window.AtriaFinanceStore.create(load, save, activeAlter?.id);
      let txs = financeStore.transactions();
      if (isEdit) {
        txs = window.AtriaFinanceService.updateTransaction(txs, tx.id, {...{type,description:desc,amount,date,category:cat,account,source,recur,note}, _recurOrigin:recur!=='none' ? (tx._recurOrigin||uid()) : null}, scope);
      } else {
        txs.push({id:uid(),type,description:desc,amount,date,category:cat,account,source,recur,note,alterId:activeAlter?.id||null,_recurOrigin:recur!=='none'?uid():null});
      }
      financeStore.saveTransactions(txs);
      closeModal();
      showToast(isEdit?'Transaction updated':'Transaction added ✓');
      // Budget exceeded alert
      if (type === 'gasto') {
        const pres = load('presupuestos', []).find(p => p.categoryId === cat);
        if (pres) {
          const txDate = new Date(date);
          const spent = load('transactions').filter(t =>
            t.type === 'gasto' && t.category === cat &&
            (() => { const d = new Date(t.date); return d.getMonth() === txDate.getMonth() && d.getFullYear() === txDate.getFullYear(); })()
          ).reduce((s, t) => s + t.amount, 0);
          if (spent > pres.limit) {
            const cats = load('categories', DEFAULT_CATS);
            const catName = cats.find(c => c.id === cat)?.name || cat;
            showToast(`⚠ Budget for "${catName}" exceeded: ${fmt(spent)} / ${fmt(pres.limit)}`);
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
  overlay.querySelectorAll('[data-txrecur]').forEach(opt => {
    opt.addEventListener('click', () => {
      overlay.querySelectorAll('[data-txrecur]').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      overlay.querySelector('#tx-recur').value = opt.dataset.txrecur;
    });
  });
}

// ═══════════════════════════════════════════════
// AHORROS
// ═══════════════════════════════════════════════
function procesarTxRecurrentes() {
  return window.AtriaFinanceRecurring.processRecurringTransactions({ load, save, uid });
}

function renderAhorros() {
  const fmt = financeFmt;
  setCrumbs([
    {label:'Hub',action:()=>navigateTo('hub')},
    {label:'Finances',action:()=>navigateTo('finanzas')},
    {label:'Savings'},
  ]);
  const ahorros = load('ahorros', []);
  document.getElementById('app').innerHTML = `
    <div class="ahorros-view">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="fin-title">◆ Savings</div>
          <div class="fin-subtitle">${activeAlter.name}'s savings goals</div>
        </div>
        <button class="btn btn-primary" id="btn-add-ahorro">+ New goal</button>
      </div>
      <div class="ahorros-grid" id="ahorros-grid">
        ${ahorros.length===0 ? `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="empty-icon">◆</div>
            <div>No savings goals yet</div>
          </div>` :
          ahorros.map(a => {
            const pct = Math.min(100, Math.round((a.current/a.target)*100));
            return `<div class="ahorro-card" data-id="${a.id}">
              <div class="ahorro-header">
                <div>
                  <div class="ahorro-name">${esc(a.name)}</div>
                  <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-top:2px">${a.deadline?'Due: '+fmtDate(a.deadline):'No deadline'}</div>
                </div>
                <div class="ahorro-emoji">${a.emoji||'💰'}</div>
              </div>
              <div class="ahorro-amounts">
                <div class="ahorro-current" style="color:var(--accent-3)">${fmt(a.current)}</div>
                <div class="ahorro-target">Meta: ${fmt(a.target)}</div>
              </div>
              <div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                <div class="ahorro-pct" style="margin-top:5px">${pct}% complete</div>
              </div>
              <div class="ahorro-actions">
                <button class="btn btn-ghost btn-sm btn-aport" data-id="${a.id}">+ Contribution</button>
                <button class="btn btn-ghost btn-sm btn-retiro" data-id="${a.id}">− Withdrawal</button>
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
    showToast('Goal deleted');
    renderAhorros();
  }));
  document.querySelectorAll('.btn-aport').forEach(b => b.addEventListener('click', () => openAportModal(b.dataset.id)));
  document.querySelectorAll('.btn-retiro').forEach(b => b.addEventListener('click', () => openAportModal(b.dataset.id, 'withdraw')));
}

function openAhorroModal(a) {
  const isEdit = !!a;
  const emojis = ['💰','🏠','✈️','🎓','💊','🎁','🚗','💻','🐾','🌱'];
  openModal(`
    <div class="modal-title">${isEdit?'Edit':'New'} savings goal</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Emoji</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${emojis.map(e=>`<span style="font-size:22px;cursor:pointer;padding:4px;border-radius:6px;border:1px solid ${a?.emoji===e?'var(--border-active)':'transparent'};transition:var(--transition)" class="emoji-opt" data-e="${e}">${e}</span>`).join('')}
        </div>
        <input type="hidden" id="a-emoji" value="${a?.emoji||'💰'}">
      </div>
      <div class="form-row">
        <div class="form-label">Goal name</div>
        <input type="text" id="a-name" placeholder="E.g. Emergency fund" value="${a?.name||''}">
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
        <div class="form-label">Deadline (optional)</div>
        <input type="date" id="a-deadline" value="${a?.deadline||''}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Create Goal'}</button>
    </div>`,
    (overlay) => {
      const name    = overlay.querySelector('#a-name').value.trim();
      const current = parseFloat(overlay.querySelector('#a-current').value)||0;
      const target  = parseFloat(overlay.querySelector('#a-target').value);
      const emoji   = overlay.querySelector('#a-emoji').value;
      const deadline= overlay.querySelector('#a-deadline').value;
      if (!name || isNaN(target)||target<=0) return showToast('⚠ Complete the required fields');
      let list = load('ahorros',[]);
      if (isEdit) list = list.map(x=>x.id===a.id?{...x,name,current,target,emoji,deadline}:x);
      else list.push({id:uid(),name,current,target,emoji,deadline});
      save('ahorros',list);
      closeModal();
      showToast(isEdit?'Goal updated':'Goal created ✓');
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
    <div class="modal-title">${mode==='withdraw'?'Log withdrawal':'Log contribution'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Amount (${getFinanceCurrency()})</div>
        <input type="number" id="aport-amount" placeholder="0.00" step="0.01" min="0">
      </div>
      <div class="form-row"><div class="form-label">Note (optional)</div><input type="text" id="aport-note" placeholder="e.g. transfer, emergency…"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${mode==='withdraw'?'Withdraw':'Add'}</button>
    </div>`,
    (overlay) => {
      const amount = parseFloat(overlay.querySelector('#aport-amount').value);
      if (isNaN(amount)||amount<=0) return showToast('⚠ Invalid amount');
      const source = load('ahorros',[]).find(x=>x.id===id);
      if (!source || (mode==='withdraw' && amount > Number(source.current||0))) return showToast('⚠ Withdrawal exceeds current balance');
      const delta = mode==='withdraw' ? -amount : amount;
      const note = overlay.querySelector('#aport-note').value.trim();
      const entry = {id:uid(),type:mode==='withdraw'?'withdraw':'deposit',amount,date:new Date().toISOString().slice(0,10),note};
      const list = load('ahorros',[]).map(x=>x.id===id?{...x,current:Number(x.current||0)+delta,history:[...(x.history||[]),entry]}:x);
      save('ahorros',list);
      closeModal();
      showToast(`${mode==='withdraw'?'−':'+'}${fmt(amount)} ${mode==='withdraw'?'withdrawn':'added'} ✓`);
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
    {label:'Finances',action:()=>navigateTo('finanzas')},
    {label:'Budgets'},
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
          <div class="fin-title">▤ Budgets</div>
          <div class="fin-subtitle">Spending limits for ${monthName(now.getMonth()+1, now.getFullYear())}</div>
        </div>
        <button class="btn btn-primary" id="btn-add-pres">+ New budget</button>
      </div>
      <div class="pres-list">
        ${pres.length===0 ? `<div class="empty-state"><div class="empty-icon">▤</div><div>No budgets configured</div></div>` :
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
                  <div class="pres-limit">of ${fmt(p.limit)}</div>
                </div>
              </div>
              <div class="pres-prog"><div class="pres-prog-fill" style="width:${pct}%;background:${color}"></div></div>
              <div class="pres-meta">
                <div class="pres-pct" style="color:${color}">${pct}% ${p.period==='yearly'?'· Yearly':'· Monthly'} ${over?'⚠ EXCEEDED':''}</div>
                <div class="pres-actions">
                  <button class="btn btn-ghost btn-sm btn-edit-pres" data-id="${p.id}">✎ Edit</button>
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
    showToast('Budget deleted');
    renderPresupuestos();
  }));
}

function openPresModal(p) {
  const fmt = financeFmt;
  const cats = load('categories', DEFAULT_CATS);
  const isEdit = !!p;
  openModal(`
    <div class="modal-title">${isEdit?'Edit':'New'} budget</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Category</div>
        <select id="p-cat">${cats.map(c=>`<option value="${c.id}" ${p?.categoryId===c.id?'selected':''}>${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-label">Monthly limit</div>
        <input type="number" id="p-limit" placeholder="0.00" step="0.01" min="0" value="${p?.limit||''}">
      </div>
      <div class="form-row"><div class="form-label">Period</div><select id="p-period"><option value="monthly" ${p?.period!=='yearly'?'selected':''}>Monthly</option><option value="yearly" ${p?.period==='yearly'?'selected':''}>Yearly</option></select></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Create'}</button>
    </div>`,
    (overlay) => {
      const catId = overlay.querySelector('#p-cat').value;
      const limit = parseFloat(overlay.querySelector('#p-limit').value);
      const period = overlay.querySelector('#p-period').value;
      if (isNaN(limit)||limit<=0) return showToast('⚠ Invalid amount');
      let list = load('presupuestos',[]);
      if (isEdit) list = list.map(x=>x.id===p.id?{...x,categoryId:catId,limit,period}:x);
      else {
        if (list.find(x=>x.categoryId===catId)) return showToast('⚠ A budget already exists for that category');
        list.push({id:uid(),categoryId:catId,limit,period});
      }
      save('presupuestos',list);
      closeModal();
      showToast(isEdit?'Budget updated':'Budget created ✓');
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
    {label:'Finances',action:()=>navigateTo('finanzas')},
    {label:'Monthly Log'},
  ]);
  const txs = load('transactions');
  if (txs.length===0) {
    document.getElementById('app').innerHTML = `
      <div class="reg-view">
        <div class="fin-title">≡ Monthly summary</div>
        <div class="fin-subtitle">Summary by month</div>
        <div class="empty-state"><div class="empty-icon">≡</div><div>No transactions recorded</div></div>
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
        <div class="fin-title">≡ Monthly summary</div>
        <div class="fin-subtitle">${activeAlter.name}'s aggregated history</div>
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
                <span class="reg-stat-label">Income</span>
                <span class="reg-stat-val pos">${fmt(data.ingresos)}</span>
              </div>
              <div class="reg-stat-row">
                <span class="reg-stat-label">Expenses</span>
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
    {label:'Finances',action:()=>navigateTo('finanzas')},
    {label:'Categories'},
  ]);
  const cats = load('categories', DEFAULT_CATS);
  document.getElementById('app').innerHTML = `
    <div class="cats-view">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="fin-title">⚙ Categories</div>
          <div class="fin-subtitle">Expense category management</div>
        </div>
        <button class="btn btn-primary" id="btn-add-cat">+ New category</button>
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
    showToast('Category deleted');
    renderCategorias();
  }));
}

const CAT_COLORS = ['#ffb450','#a08aff','#8affe0','#ff8ae2','#8ab4ff','#ff6b8a','#5fffb0','#ff9f7f','#7fffda','#d4a0ff'];

function openCatModal(c) {
  const isEdit = !!c;
  openModal(`
    <div class="modal-title">${isEdit?'Edit':'New'} category</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Name</div>
        <input type="text" id="c-name" placeholder="E.g. Subscriptions" value="${c?.name||''}">
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
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Create'}</button>
    </div>`,
    (overlay) => {
      const name  = overlay.querySelector('#c-name').value.trim();
      const color = overlay.querySelector('#c-color').value;
      if (!name) return showToast("⚠ Name can't be empty");
      let list = load('categories', DEFAULT_CATS);
      if (isEdit) list = list.map(x=>x.id===c.id?{...x,name,color}:x);
      else list.push({id:name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''), name, color});
      save('categories',list);
      closeModal();
      showToast(isEdit?'Category updated':'Category created ✓');
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
// FINANCES — SYSTEM VIEW (admin only)
// ═══════════════════════════════════════════════
function renderFinanzasSistema() {
  const fmt = financeFmt;
  if (!activeAlter?.isAdmin) { navigateTo('finanzas'); return; }
  setCrumbs([
    {label:'Hub', action:()=>navigateTo('hub')},
    {label:'Finances', action:()=>navigateTo('finanzas')},
    {label:'System view'},
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

  const months = Array.from({length:12},(_,i)=>({v:i+1,l:new Date(2000,i,1).toLocaleString('en-GB',{month:'long'})}));
  const years  = [...new Set(allTxs.map(t=>new Date(t.date).getFullYear()))];
  if(!years.includes(fsYear)) years.push(fsYear);
  years.sort((a,b)=>b-a);

  // Group by alter
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
        <div class="balance-card positive"><div class="bc-label">System income</div><div class="bc-value pos">${fmt(sysIngresos)}</div></div>
        <div class="balance-card negative"><div class="bc-label">System expenses</div><div class="bc-value neg">${fmt(sysGastos)}</div></div>
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
          const a = aid==='_sin' ? {name:'No alter',emoji:'◎',color:'var(--text-2)'} : alters.find(x=>x.id===aid)||{name:'?',emoji:'?',color:'var(--text-2)'};
          const bal = data.ingresos-data.gastos;
          return `<div class="fin-sistema-alter-block">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:20px">${a.emoji}</span>
              <span style="font-weight:700;color:${a.color}">${esc(a.name)}</span>
              <span style="font-size:12px;color:var(--text-3);margin-left:auto">${data.txs.length} transactions</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
              <div class="balance-card positive" style="padding:8px 12px"><div class="bc-label" style="font-size:10px">Income</div><div class="bc-value pos" style="font-size:14px">${fmt(data.ingresos)}</div></div>
              <div class="balance-card negative" style="padding:8px 12px"><div class="bc-label" style="font-size:10px">Expenses</div><div class="bc-value neg" style="font-size:14px">${fmt(data.gastos)}</div></div>
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
                  <div class="tx-date">${new Date(t.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
                  <div>${esc(t.note||'—')}</div>
                  <div class="tx-amount ${t.type==='ingreso'?'positive':'negative'}">${t.type==='ingreso'?'+':'−'}${fmt(t.amount)}</div>
                  <div></div>
                </div>`;
              }).join('')}
              ${data.txs.length>5?`<div style="font-size:11px;color:var(--text-3);padding:6px 0">+${data.txs.length-5} more</div>`:''}
            </div>
          </div>`;
        }).join('')}
        ${Object.keys(byAlter).length===0?`<div class="empty-state"><div class="empty-icon">◈</div><div>No transactions this period</div></div>`:''}
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
// NOTAS
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
function templateTypeLabel(type) { return type === 'task' ? 'task' : 'note'; }
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
      <div class="template-row-title">${escTpl(t.name || t.title || 'Template')}</div>
      <div class="template-row-preview">${escTpl(t.title || '')}${t.body ? ` · ${escTpl(t.body).slice(0,90)}` : ''}</div>
      <div class="template-row-meta">${meta}${tags}</div>
    </div>
    <div class="template-row-actions">
      ${!t.archived?`<button class="btn btn-primary btn-sm" data-template-use="${t.id}">Use</button>`:''}
      <button class="icon-btn" data-template-edit="${t.id}" title="Edit">✎</button>
      <button class="icon-btn" data-template-dup="${t.id}" title="Duplicate">⧉</button>
      ${!t.archived?`<button class="icon-btn" data-template-archive="${t.id}" title="Archive">↓</button>`:''}
    </div>
  </div>`;
}
function openTemplatesModal(type, context = {}) {
  const templates = getTemplates(type, true).sort((a,b)=>(a.archived?1:0)-(b.archived?1:0)||((b.updatedTs||b.ts||0)-(a.updatedTs||a.ts||0)));
  const activeCount = templates.filter(t=>!t.archived).length;
  openModal(`
    <div class="modal-title">${templateTypeLabel(type)} templates</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2)">${activeCount} active · ${templates.length-activeCount} archived</div>
      <button class="btn btn-primary btn-sm" id="btn-template-new">+ New template</button>
    </div>
    <div class="template-list">
      ${templates.length ? templates.map(t=>renderTemplateCard(t, context)).join('') : `<div class="task-empty" style="padding:28px"><div class="task-empty-icon">◇</div><div>No templates yet</div></div>`}
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" data-cancel>Close</button></div>`,
    ()=>{}
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelector('#btn-template-new')?.addEventListener('click',()=>openTemplateEditor(type, null, context));
  ov.querySelectorAll('[data-template-use]').forEach(btn=>btn.addEventListener('click',()=>useTemplate(btn.dataset.templateUse, context)));
  ov.querySelectorAll('[data-template-edit]').forEach(btn=>btn.addEventListener('click',()=>openTemplateEditor(type, loadTemplates().find(t=>t.id===btn.dataset.templateEdit), context)));
  ov.querySelectorAll('[data-template-dup]').forEach(btn=>btn.addEventListener('click',()=>{
    const src = loadTemplates().find(t=>t.id===btn.dataset.templateDup);
    if(!src) return;
    const copy = {...src, id:uid(), name:`${src.name || src.title || 'Template'} copy`, archived:false, ts:Date.now(), updatedTs:Date.now()};
    const list = loadTemplates(); list.push(copy); saveTemplates(list);
    closeModal(); showToast('Template duplicated'); openTemplatesModal(type, context);
  }));
  ov.querySelectorAll('[data-template-archive]').forEach(btn=>btn.addEventListener('click',()=>{
    const list = loadTemplates(); const tpl = list.find(t=>t.id===btn.dataset.templateArchive);
    if(tpl){ tpl.archived = true; tpl.updatedTs = Date.now(); saveTemplates(list); closeModal(); showToast('Template archived'); openTemplatesModal(type, context); }
  }));
}
function openTemplateEditor(type, template, context = {}) {
  const isEdit = !!template;
  const t = template || templateDefaults(type);
  openModal(`
    <div class="modal-title">${isEdit?'Edit':'New'} ${templateTypeLabel(type)} template</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Template name</div>
        <input id="tpl-name" type="text" value="${escTpl(t.name||'')}" placeholder="Morning routine">
      </div>
      <div class="form-row">
        <div class="form-label">Default title</div>
        <input id="tpl-title" type="text" value="${escTpl(t.title||'')}" placeholder="${type==='task'?'Check bag':'Quick check-in'}">
      </div>
      <div class="form-row">
        <div class="form-label">${type==='task'?'Description':'Content'}</div>
        <textarea id="tpl-body" style="min-height:130px" placeholder="${type==='task'?'Steps, criteria, or context...':'Questions, sections, or prompt...'}">${escTpl(t.body||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Tags</div>
        <input id="tpl-tags" type="text" value="${(t.tags||[]).map(tag=>'#'+escTpl(tag)).join(' ')}" placeholder="#routine #health">
      </div>
      ${type==='task'?`
        <div class="form-row two-col">
          <div class="form-row">
            <div class="form-label">Priority</div>
            <select id="tpl-priority">${PRIORITIES.map(p=>`<option value="${p.id}" ${(t.priority||'media')===p.id?'selected':''}>${p.label}</option>`).join('')}</select>
          </div>
          <div class="form-row">
            <div class="form-label">Initial status</div>
            <select id="tpl-status">${TASK_STATUSES.map(s=>`<option value="${s.id}" ${(t.status||'pendiente')===s.id?'selected':''}>${s.label}</option>`).join('')}</select>
          </div>
        </div>`:`
        <div class="form-row">
          <div class="form-label">Color</div>
          <select id="tpl-color">${NOTA_COLORS.map(c=>`<option value="${c.id}" ${(t.color||'neutral')===c.id?'selected':''}>${c.id}</option>`).join('')}</select>
        </div>`}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Create template'}</button>
    </div>`,
    (ov)=>{
      const name = ov.querySelector('#tpl-name').value.trim();
      const title = ov.querySelector('#tpl-title').value.trim();
      const body = ov.querySelector('#tpl-body').value.trim();
      if(!name && !title) return showToast('⚠ Add a name or title');
      const entry = {...t, id:t.id||uid(), type, name:name||title, title, body, tags:parseTemplateTags(ov.querySelector('#tpl-tags').value), archived:false, ts:t.ts||Date.now(), updatedTs:Date.now()};
      if(type==='task') { entry.priority=ov.querySelector('#tpl-priority').value; entry.status=ov.querySelector('#tpl-status').value; }
      else entry.color=ov.querySelector('#tpl-color').value;
      let list = loadTemplates();
      if(isEdit) list = list.map(x=>x.id===t.id?entry:x); else list.push(entry);
      saveTemplates(list);
      closeModal(); showToast(isEdit?'Template saved':'Template created'); setTimeout(()=>openTemplatesModal(type, context), 0);
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
    closeModal(); showToast('Note created from template');
    if(context.afterUse==='notas-module') renderNotasSolicView(); else renderNotasView();
    return;
  }
  const proyId = context.proyId || activeProyId;
  if(!proyId) return showToast('⚠ Choose a project');
  const tasks = loadTareas();
  tasks.push({id:uid(),proyId,title:tpl.title||tpl.name||'',desc:tpl.body||'',assigneeId:activeAlter?.id||null,status:tpl.status||'pendiente',priority:tpl.priority||'media',deadline:'',tags:[...(tpl.tags||[])],ts:Date.now()});
  saveTareas(tasks);
  closeModal(); showToast('Task created from template'); renderProyView();
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

function renderNotif(){ return window.AtriaNotificationsView.render(); }

function renderArchivo() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Archive'}]);
  renderArchivoView();
}

function renderArchivoView() {
  const sections = [
    {
      id:'diario', icon:'◫', label:'Diary entry', color:'var(--accent-2)',
      items: getArchivedDiario(),
      renderItem: (e)=>({
        icon: getMoods().find(m=>m.id===e.mood)?.emoji||'◫',
        title: e.title||'(no title)',
        preview: e.body||'',
        date: e.ts,
        badges: [alters.find(a=>a.id===e.alterId)?.name||'?'].filter(Boolean),
        id: e.id,
      }),
      restore: (id)=>{
        const es=loadEntries(); const e=es.find(x=>x.id===id);
        if(e){ delete e.isArchived; saveEntries(es); showToast('Diary entry restored ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const e=loadEntries().find(x=>x.id===id); if(!e) return;
        const alt=alters.find(a=>a.id===e.alterId);
        const mood=getMoods().find(m=>m.id===e.mood);
        previewModal('Journal entry',[
          {label:'Autor', val:(alt?.emoji||'')+' '+(alt?.name||'?')},
          {label:'State', val:mood?mood.emoji+' '+mood.label:'—'},
          {label:'Date', val:new Date(e.ts).toLocaleString('en-GB',{day:'numeric',month:'long',year:'numeric'})},
        ], e.title||'(no title)', e.body||'');
      },
      del: (id)=>{
        if(!confirm('Permanently delete this entry?')) return;
        saveEntries(loadEntries().filter(x=>x.id!==id));
        showToast('Entry deleted permanently'); renderArchivoView();
      },
    },
    {
      id:'notas', icon:'◧', label:'Notes', color:'var(--accent-4)',
      items: getArchivedNotas(),
      renderItem: (n)=>({
        icon:'◧', title:n.title||'(no title)', preview:n.body||'',
        date:n.ts,
        badges:[alters.find(a=>a.id===n.alterId)?.name||'?', ...(n.tags||[]).slice(0,2).map(t=>'#'+t)],
        id:n.id,
      }),
      restore: (id)=>{
        const ns=loadNotas(); const n=ns.find(x=>x.id===id);
        if(n){ delete n.isArchived; saveNotas(ns); showToast('Note restored ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const n=loadNotas().find(x=>x.id===id); if(!n) return;
        const alt=alters.find(a=>a.id===n.alterId);
        const col=getNotaColor(n.color);
        previewModal('Note',[
          {label:'Author', val:(alt?.emoji||'')+' '+(alt?.name||'?')},
          {label:'Color', val:`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${col.text}"></span>`},
          {label:'Tags', val:(n.tags||[]).map(t=>'#'+t).join(' ')||'—'},
        ], n.title||'(no title)', n.body||'');
      },
      del: (id)=>{
        if(!confirm('Permanently delete this note?')) return;
        saveNotas(loadNotas().filter(x=>x.id!==id));
        showToast('Note deleted permanently'); renderArchivoView();
      },
    },
    {
      id:'proyectos', icon:'◉', label:'Projects', color:'var(--accent-3)',
      items: getArchivedProyectos(),
      renderItem: (p)=>{
        const prog=proyProgress(p.id);
        const resp=alters.find(a=>a.id===p.responsableId);
        return {
          icon:'◉', title:p.name, preview:p.desc||'No description',
          date:p.ts, badges:[resp?.name||'', prog.total+' tareas'].filter(Boolean), id:p.id,
        };
      },
      restore: (id)=>{
        const ps=loadProyectos(); const p=ps.find(x=>x.id===id);
        if(p){ p.status='activo'; saveProyectos(ps); showToast('Project restored as Active ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const p=loadProyectos().find(x=>x.id===id); if(!p) return;
        const resp=alters.find(a=>a.id===p.responsableId);
        const prog=proyProgress(id);
        previewModal('Project',[
          {label:'Assignee', val:resp?(resp.emoji+' '+resp.name):'Unassigned'},
          {label:'Progress', val:`${prog.done}/${prog.total} tareas (${prog.pct}%)`},
          {label:'Archived', val:p.deadline?fmtDate(p.deadline):'—'},
        ], p.name, p.desc||'');
      },
      del: (id)=>{
        if(!confirm('Permanently delete project and all tasks?')) return;
        saveProyectos(loadProyectos().filter(x=>x.id!==id));
        saveTareas(loadTareas().filter(t=>t.proyId!==id));
        showToast('Project deleted permanently.'); renderArchivoView();
      },
    },
    {
      id:'normas', icon:'◳', label:'Rules', color:'var(--accent)',
      items: getArchivedNormas(),
      renderItem: (n)=>{
        const prop=alters.find(a=>a.id===n.proposerId);
        const pri=PRIORITIES.find(p=>p.id===n.priority)||PRIORITIES[1];
        return {icon:pri.emoji, title:n.title, preview:n.desc||'', date:n.ts, badges:[prop?.name||'?'], id:n.id};
      },
      restore: (id)=>{
        const ns=loadNormas(); const n=ns.find(x=>x.id===id);
        if(n){ n.status='activa'; saveNormas(ns); showToast('Rule restored as Active ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const n=loadNormas().find(x=>x.id===id); if(!n) return;
        const prop=alters.find(a=>a.id===n.proposerId);
        const pri=PRIORITIES.find(p=>p.id===n.priority)||PRIORITIES[1];
        previewModal('Norma',[
          {label:'Proposed by', val:prop?(prop.emoji+' '+prop.name):'?'},
          {label:'Priority', val:pri.emoji+' '+pri.label},
          {label:'Votes', val:`✓ ${(n.votes||[]).filter(v=>v.vote==='yes').length} / ✕ ${(n.votes||[]).filter(v=>v.vote==='no').length}`},
        ], n.title, n.desc||'');
      },
      del: (id)=>{
        if(!confirm('Permanently delete this rule?')) return;
        saveNormas(loadNormas().filter(x=>x.id!==id));
        showToast('Rule permanently deleted'); renderArchivoView();
      },
    },
    {
      id:'wishlist', icon:'◈', label:'Discarded wishes', color:'var(--green)',
      items: getArchivedWishes(),
      renderItem: (w)=>{
        const cat=WISH_CATS.find(c=>c.id===w.category)||WISH_CATS[4];
        const alt=alters.find(a=>a.id===w.alterId);
        return {icon:'✕', title:w.title, preview:w.desc||'', date:w.ts,
          badges:[cat.label, w.price?'~'+w.price+'€':'', alt?.name||''].filter(Boolean), id:w.id};
      },
      restore: (id)=>{
        const ws=loadWishes(); const w=ws.find(x=>x.id===id);
        if(w){ w.status='deseado'; saveWishes(ws); showToast('Wish restored to wishlist ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const w=loadWishes().find(x=>x.id===id); if(!w) return;
        const cat=WISH_CATS.find(c=>c.id===w.category)||WISH_CATS[4];
        const alt=alters.find(a=>a.id===w.alterId);
        previewModal('Discarded wish',[
          {label:'Category', val:cat.label},
          {label:'Estimated price', val:w.price?'~'+w.price+'€':'—'},
          {label:'Autor', val:alt?(alt.emoji+' '+alt.name):'?'},
          {label:'Enlace', val:w.url?`<a href="${w.url}" target="_blank" style="color:var(--accent);font-size:11px">🔗 View</a>`:'—'},
        ], w.title, w.desc||'');
      },
      del: (id)=>{
        if(!confirm('Permanently delete this wish?')) return;
        saveWishes(loadWishes().filter(x=>x.id!==id));
        showToast('Wish permanently deleted'); renderArchivoView();
      },
    },
    {
      id:'tareas', icon:'✓', label:'Completed tasks', color:'var(--green)',
      items: getArchivedTareas(),
      renderItem: (t)=>{
        const proy=loadProyectos().find(p=>p.id===t.proyId);
        const assignee=alters.find(a=>a.id===t.assigneeId);
        const pri={alta:'🔴',media:'🟡',baja:'🟢'}[t.priority]||'⚪';
        return {
          icon:'✓', title:t.title, preview:t.desc||'',
          date:t.deadline||t.ts||Date.now(),
          badges:[proy?'◉ '+proy.name:'', assignee?assignee.emoji+' '+assignee.name:'', pri+' '+({alta:'High',media:'Medium',baja:'Low'}[t.priority]||'')].filter(Boolean),
          id:t.id,
        };
      },
      restore: (id)=>{
        const ts=loadTareas(); const t=ts.find(x=>x.id===id);
        if(t){ t.status='pendiente'; saveTareas(ts); showToast('Task restored as Pending ✓'); renderArchivoView(); }
      },
      preview: (id)=>{
        const t=loadTareas().find(x=>x.id===id); if(!t) return;
        const proy=loadProyectos().find(p=>p.id===t.proyId);
        const assignee=alters.find(a=>a.id===t.assigneeId);
        previewModal('Completed task',[
          {label:'Proyecto', val:proy?proy.name:'—'},
          {label:'Assigned to', val:assignee?(assignee.emoji+' '+assignee.name):'—'},
          {label:'Priority', val:{alta:'🔴 High',media:'🟡 Medium',baja:'🟢 Low'}[t.priority]||'—'},
          {label:'Deadline', val:t.deadline?fmtDate(t.deadline):'—'},
        ], t.title, t.desc||'');
      },
      del: (id)=>{
        if(!confirm('Permanently delete this task?')) return;
        saveTareas(loadTareas().filter(x=>x.id!==id));
        showToast('Task permanently deleted'); renderArchivoView();
      },
    },
  ];

  const totalItems = sections.reduce((s,sec)=>s+sec.items.length,0);

  app.innerHTML = `
    <div class="archivo-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◪ Archive</div>
          <div class="fin-subtitle">${totalItems} elemento${totalItems!==1?'s':''} archived</div>
        </div>
        ${totalItems>0?`<button class="btn btn-danger btn-sm" id="btn-purge-all">✕ Empty archive</button>`:''}
      </div>

      ${totalItems===0?`<div class="empty-state" style="padding:60px 20px">
        <div class="empty-icon">◪</div>
        <div>Archive is empty</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);margin-top:6px">
          The archived content appears here automatically.
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
              const d=new Date(ri.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
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
                  <button class="btn btn-ghost btn-sm btn-archivo-preview" data-sec="${sec.id}" data-iid="${ri.id}" title="Preview">👁</button>
                  <button class="btn btn-ghost btn-sm btn-archivo-restore" data-sec="${sec.id}" data-iid="${ri.id}" title="Restore">↑ Restore</button>
                  <button class="btn btn-danger btn-sm btn-archivo-del" data-sec="${sec.id}" data-iid="${ri.id}" title="Delete">✕</button>
                </div>
              </div>`;
            }).join('')}
          </div>`:''}
        </div>`).join('')}

      <!-- GUÍA -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 20px">
        <div style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-2);margin-bottom:12px">How content gets here</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${[
            {icon:'◫', text:'Journal entries marked with "Archive" from their menu'},
            {icon:'◧', text:'Notes marked as archived from their menu'},
            {icon:'◉', text:'Archived projects'},
            {icon:'◳', text:'Archived rules (managed by admin)'},
            {icon:'◈', text:'Wishlist items marked as "Discarded"'},
            {icon:'✓', text:'Completed project tasks'},
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
    if(!confirm(`Permanently delete ${totalItems} archived items? This action cannot be undone.`)) return;
    // Delete from each source
    saveEntries(loadEntries().filter(e=>!e.isArchived));
    saveNotas(loadNotas().filter(n=>!n.isArchived));
    const archivedPIDs=getArchivedProyectos().map(p=>p.id);
    saveProyectos(loadProyectos().filter(p=>p.status!=='archivado'));
    saveTareas(loadTareas().filter(t=>!archivedPIDs.includes(t.proyId) && t.status!=='completada'));
    saveNormas(loadNormas().filter(n=>n.status!=='archivada'));
    saveWishes(loadWishes().filter(w=>w.status!=='descartado'));
    showToast('Archive cleared ✓'); renderArchivoView();
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
      <button class="btn btn-ghost" data-cancel>Close</button>
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

// dismissed = {alterId: {date:'YYYY-MM-DD', keys:[]}}
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
  if (!d[alterId] || d[alterId].date !== today) d[alterId] = {date:today, keys:[]};
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

function _isInDND(cfg) {
  if (!cfg.dndEnabled) return false;
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const curMin = h*60+m;
  const [fh,fm] = (cfg.dndFrom||'23:00').split(':').map(Number);
  const [th,tm] = (cfg.dndTo||'08:00').split(':').map(Number);
  const fromMin = fh*60+fm, toMin = th*60+tm;
  if (fromMin <= toMin) return curMin >= fromMin && curMin < toMin;
  return curMin >= fromMin || curMin < toMin;
}

// ── COMPUTE NOTIFICATIONS ──
function computeNotifs(alterId) {
  if (!alterId) return [];
  try {
  const cfg    = loadNotifConfig();
  if (_isInDND(cfg)) return [];
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
      const label = first._instanceDate===localDateKey(now) ? 'Today' : 'Tomorrow';
      notifs.push({
        key: 'agenda',
        icon: '◷',
        color: '#ffb450', border: 'rgba(255,180,80,.25)', bg: 'rgba(255,180,80,.07)',
        title: `${soon.length} event${soon.length>1?'s':''} upcoming${soon.length>1?'s':''}`,
        sub: `${label}: ${first.title}${first.allDay||!first.time?' · All day':first.time?' · '+first.time:''}`,
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
        title: `${pend.length} pending request${pend.length>1?'s':''}`,
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
        title: `${pendVoto.length} rule${pendVoto.length>1?'s':''} pending vote`,
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
        title: neverDone ? 'No external export yet' : `Manual export ${daysSince} days ago`,
        sub: 'If you want a copy outside Atria, you can export it from Settings',
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
    html += '<button class="notif-banner-dismiss" data-dismiss="' + n.key + '" title="Dismiss today">✕</button>';
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

// ═══════════════════════════════════════════════
// NATIVE NOTIFICATIONS (Web Notifications API)
// ═══════════════════════════════════════════════

// Keys already fired this session (prevent spam within same tab)
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

// Request permission — only call from a user gesture
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

// ── Local alarm (sound + vibration) for due reminders ──
function formatOnlineNotifDiagTs(ts) {
  if (!ts) return '—';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en');
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
  container.innerHTML = `<div style="padding:12px 20px;color:var(--text-3);font-size:12px">Checking online notifications...</div>`;
  collectOnlineNotificationDiagnostics().then(diag => {
    const status = (ok, warn = false) => ok ? ['OK', '#5fffb0'] : warn ? ['CHECK', '#ffcf6f'] : ['NO', 'var(--text-3)'];
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
          <span style="font-size:13px;font-weight:700;flex:1">Online notifications</span>
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:${subStatus[1]}">${subStatus[0]}</span>
        </div>
        <div style="padding:4px 20px 8px">
          ${row('Browser permission', diag.permission, permissionTone)}
          ${row('Service worker', diag.swSupported ? (diag.swReady ? (diag.swActive ? 'ACTIVE' : 'READY') : 'LOADING') : 'UNSUPPORTED', diag.swActive ? '#5fffb0' : '#ffcf6f')}
          ${row('Browser push', diag.pushSupported ? (diag.browserSubscribed ? 'SUBSCRIBED' : 'NO SUBSCRIPTION') : 'UNSUPPORTED', diag.browserSubscribed ? '#5fffb0' : '#ffcf6f')}
           ${row('Notification key', vapidStatus[0], vapidStatus[1])}
          ${row('Online session', diag.hasSession ? 'ACTIVE' : 'NO SESSION', diag.hasSession ? '#5fffb0' : 'var(--text-3)')}
           ${row('Registered devices', serverError || `${server.deviceSubscriptions || 0} device / ${server.systemSubscriptions || 0} system`, serverError ? '#ff8a8a' : (server.deviceSubscribed ? '#5fffb0' : '#ffcf6f'))}
          ${row('Last subscription', formatOnlineNotifDiagTs(server.lastSubscribedAt || diag.sessionSubscribedAt))}
          ${row('Last push', formatOnlineNotifDiagTs(server.lastPushSentAt))}
           ${row('Synced reminders', `${server.reminderItems ?? 0} online / ${diag.localReminderItems} local`)}
          ${row('Last reminder sync', formatOnlineNotifDiagTs(server.lastReminderSyncAt))}
          ${row('Last reminder send', formatOnlineNotifDiagTs(server.lastReminderSentAt))}
          ${server.lastPushError ? row('Last push error', `${server.lastPushError.status || 0} ${escM(server.lastPushError.message || '')}`, '#ff8a8a') : ''}
        </div>
        <div style="padding:4px 20px 8px;border-top:1px solid var(--border)">
          ${prefRow('message', 'Online messages', 'Generic push when an online DM arrives')}
          ${prefRow('friend_request', 'Friend requests', 'Generic push when a friend request arrives')}
          ${prefRow('reminder', 'Reminders', 'Generic push when a synced reminder is due')}
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" id="btn-online-notif-refresh">Refresh</button>
          <button class="btn btn-primary btn-sm" id="btn-online-notif-reconnect">Reconnect</button>
          <button class="btn btn-ghost btn-sm" data-online-push-test="message">Test message</button>
          <button class="btn btn-ghost btn-sm" data-online-push-test="friend_request">Test request</button>
          <button class="btn btn-ghost btn-sm" data-online-push-test="reminder">Test reminder</button>
        </div>
      </div>`;
    container.querySelectorAll('.online-push-pref').forEach(chk => chk.addEventListener('change', async () => {
      const c = loadNotifConfig();
      const field = chk.dataset.pushPref === 'friend_request' ? 'onlinePushFriendRequest' : chk.dataset.pushPref === 'reminder' ? 'onlinePushReminder' : 'onlinePushMessage';
      c[field] = chk.checked;
      saveNotifConfig(c);
      try {
        await onlineFetch('/v1/push/preferences', { method: 'PATCH', body: JSON.stringify({ preferences: getOnlinePushPreferencesFromNotifConfig(c) }) });
        showToast(chk.checked ? 'Push enabled' : 'Push disabled');
      } catch (e) {
        showToast('Preference saved locally');
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
        showToast(ok ? 'Online notifications reconnected' : 'Could not complete push subscription');
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
        showToast(result?.sent > 0 ? 'Test push sent' : 'No push subscription for this device');
      } catch (e) {
        showToast('Could not send test push');
      } finally {
        btn.disabled = false;
        renderOnlineNotificationDiagnostics(container);
      }
    }));
  }).catch(error => {
    container.innerHTML = `<div style="padding:12px 20px;color:#ff8a8a;font-size:12px">Could not read online diagnostics: ${escM(error?.message || String(error))}</div>`;
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
    <div class="modal-title">${esc(reminder.icon || '🔔')} ${esc(reminder.title || 'Reminder')}</div>
    ${reminder.desc ? `<div style="font-size:13px;color:var(--text-2);line-height:1.5;margin:8px 0 16px">${esc(reminder.desc)}</div>` : `<div style="font-size:13px;color:var(--text-2);margin:8px 0 16px">Reminder due</div>`}
    <div class="modal-footer" style="gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost" data-reminder-snooze>Snooze 15 min</button>
      <button class="btn btn-primary" data-reminder-done>Mark done</button>
    </div>
  </div>`;
  const close = () => { _activeReminderAlertKey = null; ov.remove(); };
  ov.querySelector('[data-reminder-snooze]')?.addEventListener('click', () => {
    const list = loadReminders();
    const r = list.find(x => x.id === reminder.id);
    if (r) r.snoozedUntil = Date.now() + 15 * 60 * 1000;
    saveReminders(list);
    showToast('Reminder snoozed 15 min');
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

// Fire a native notification (via SW if available, else direct)
async function fireNativeNotif({ title, body, icon, tag, nav, tab }) {
  if (!nativeNotifGranted()) return;
  const privateNotifications = localStorage.getItem('tid_private_notifications') === '1';
  if (privateNotifications) {
    title = 'Atria';
    body = 'You have a new notification';
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
    // Direct fallback
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      tag: payload.tag,
    });
  } catch (e) {
    console.warn('fireNativeNotif error:', e);
  }
}

// Check due reminders and fire native notif (once per id per session)
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
        body: r.desc || 'Reminder due',
        tag: key,
        nav: 'recordatorios',
      });
    }
  }
}

// Check hub banners (agenda, requests, rules, backup) — once per key per session
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

// Main scheduler — called at app boot
let _notifInterval = null;
function startNotifScheduler() {
  if (_notifInterval) return; // already running
  // First check after a short delay (activeAlter needs to be ready)
  setTimeout(() => {
    checkAndFireReminderNotifs();
    checkAndFireHubNotifs();
  }, 1500);
  // Then every 60 seconds
  _notifInterval = setInterval(() => {
    checkAndFireReminderNotifs();
    checkAndFireHubNotifs();
  }, 60000);
}

// Listen for SW messages (notification click → navigate)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'NOTIF_NAV' && event.data.nav) {
      _pendingNotifNav = event.data.nav;
      _pendingNotifTab = event.data.tab || null;
      processPendingNotifRoute();
    }
  });
}

// ── NOTIFICATIONS CONFIG (inside Settings) ──
function renderNotifConfig(container) {
  const cfg = loadNotifConfig();

  const items = [
    { key:'agenda',      icon:'◷', color:'#ffb450', label:'Upcoming events',    sub:'Events today and tomorrow in Agenda' },
    { key:'solicitudes', icon:'◱', color:'#a08aff', label:'Pending requests',   sub:'Unanswered requests directed to this alter' },
    { key:'normas',      icon:'◳', color:'#8ab4ff', label:'Rules pending vote', sub:'Proposals you have not voted on yet' },
    { key:'backup',      icon:'◬', color:'#ffb450', label:'Optional export',    sub:'Reminder in case you want to keep a manual external copy' },
  ];

  // Native permission state
  const supported = nativeNotifSupported();
  const granted   = nativeNotifGranted();
  const blocked   = nativeNotifBlocked();

  let permBlock = '';
  if (!supported) {
    permBlock = `
      <div style="padding:12px 20px;display:flex;align-items:center;gap:10px;opacity:.6">
        <span style="font-size:18px">🚫</span>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-1)">Not available in this browser</div>
          <div style="font-size:11px;color:var(--text-3)">Native notifications are not supported here</div>
        </div>
      </div>`;
  } else if (blocked) {
    permBlock = `
      <div style="padding:12px 20px;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">🔕</span>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:#ff6b8a">Notifications blocked</div>
          <div style="font-size:11px;color:var(--text-3)">Permission is blocked: open this site’s browser settings, allow notifications, then return to Atria.</div>
        </div>
      </div>`;
  } else if (granted) {
    permBlock = `
      <div style="padding:12px 20px;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">🔔</span>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:#8affe0">Notifications enabled</div>
          <div style="font-size:11px;color:var(--text-3)">Reminders and alerts will arrive even when the app is in the background</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-test-notif">Test</button>
      </div>`;
  } else {
    permBlock = `
      <div style="padding:12px 20px;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">🔔</span>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:var(--text-1)">System notifications</div>
          <div style="font-size:11px;color:var(--text-3)">Enable permission here to receive reminders while the app is in the background.</div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-req-notif-perm">Enable</button>
      </div>`;
  }

  container.innerHTML = `
    <div class="config-section-header">
      <div class="config-section-icon">◬</div>
      <div class="config-section-title">Notifications</div>
    </div>
    <div class="config-rows">
    <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:10px">
      <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <span style="font-size:14px">🔔</span>
        <span style="font-size:13px;font-weight:700;flex:1">Native notifications</span>
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${granted?'active':'system'}</span>
      </div>
      ${permBlock}
    </div>
    <div id="online-notif-diagnostics"></div>
    <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
      <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <span style="font-size:14px">◬</span>
        <span style="font-size:13px;font-weight:700;flex:1">Hub alerts</span>
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">Banners on entry</span>
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

  // Hub banner toggles
  container.querySelectorAll('.notif-toggle').forEach(chk => {
    chk.addEventListener('change', () => {
      const c = loadNotifConfig();
      c[chk.dataset.nkey] = chk.checked;
      saveNotifConfig(c);
      showToast(chk.checked ? 'Notification enabled ✓' : 'Notification disabled');
    });
  });

  // Request permission button
  container.querySelector('#btn-req-notif-perm')?.addEventListener('click', async () => {
    const result = await requestNativeNotifPermission();
    if (result === 'granted') {
      showToast('Notifications enabled! ✓');
      startNotifScheduler();
      scheduleOnlineWebPushSubscription();
      renderNotifConfig(container);
    } else if (result === 'denied') {
        showToast('Permission blocked — allow notifications in this site’s settings');
      renderNotifConfig(container);
    }
  });

  // Test notification button
  container.querySelector('#btn-test-notif')?.addEventListener('click', () => {
    fireNativeNotif({
      title: 'Atria · Test ✓',
      body: 'Notifications are working correctly',
      tag: 'atria-test',
      nav: 'notif',
    });
    showToast('Test notification sent');
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
      <div class="pin-lock-sub">Enter your PIN to continue</div>
      <div class="pin-dots">
        ${Array(digits).fill('<div class="pin-dot"></div>').join('')}
      </div>
      <div class="pin-error-msg" id="pin-err"></div>
      <div class="pin-pad">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k=>`
          <button class="pin-key${k===''?' invisible':k==='⌫'?' del':''}" data-key="${k}">${k}</button>
        `).join('')}
      </div>
      ${attempt >= 3 ? `<button class="btn btn-ghost" id="btn-forgot-pin" style="margin-top:8px;font-size:12px;color:var(--text-3)">Forgot PIN?</button>` : ''}
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
        showToast('⚠ Old PIN detected for security reasons — please set a new one in Security');
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
        shakeError(attempt >= 3 ? `Wrong PIN (attempt ${attempt})` : 'Wrong PIN');
        setTimeout(() => { if (!inRecovery) renderLock(); }, 700);
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

  // No recovery question set → go straight to nuclear option
  if (!recovery) {
    showPinNuclear(lockEl, onSuccess);
    return;
  }

  lockEl.innerHTML = `
    <div class="pin-lock-inner">
      <div class="pin-lock-logo">🔑</div>
      <div class="pin-lock-title">Recover access</div>
      <div class="pin-lock-sub" style="text-align:center;max-width:260px">${escC(recovery.question)}</div>
      <input type="text" id="rec-answer" placeholder="Your answer…"
        style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:14px;width:100%;box-sizing:border-box;margin-top:4px">
      <div class="pin-error-msg" id="rec-err"></div>
      <div style="display:flex;gap:8px;margin-top:8px;width:100%">
        <button class="btn btn-ghost" id="btn-rec-back" style="flex:1">← Back</button>
        <button class="btn btn-primary" id="btn-rec-submit" style="flex:2">Verify</button>
      </div>
      <button class="btn btn-ghost" id="btn-rec-nuclear" style="margin-top:16px;font-size:11px;color:var(--red);border-color:rgba(255,80,80,.3)">I don't remember the answer…</button>
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
      // Correct answer → reset PIN
      setPinEnabled(false);
      localStorage.removeItem(PIN_STORAGE_KEY);
      localStorage.removeItem(PIN_SALT_KEY);
      clearPinRecovery();
      markSessionUnlocked();
      lockEl._cleanup?.();
      lockEl.remove();
      showToast('Correct answer. PIN removed — set a new one in Security ✓');
      onSuccess();
    } else {
      lockEl.querySelector('#rec-err').textContent = 'Incorrect answer';
      lockEl.querySelector('#rec-answer').value = '';
    }
  });

  lockEl.querySelector('#rec-answer').addEventListener('keydown', e => {
    if (e.key === 'Enter') lockEl.querySelector('#btn-rec-submit').click();
  });

  lockEl.querySelector('#btn-rec-nuclear').addEventListener('click', () => showPinNuclear(lockEl, onSuccess));
}

// ── NUCLEAR OPTION (wipe all) ──
function showPinNuclear(lockEl, onSuccess) {
  lockEl.innerHTML = `
    <div class="pin-lock-inner">
      <div class="pin-lock-logo">⚠</div>
      <div class="pin-lock-title" style="color:var(--red)">Delete everything</div>
      <div class="pin-lock-sub" style="text-align:center;max-width:260px;color:var(--text-2)">
        This will permanently delete <strong style="color:var(--text-0)">all Atria data</strong>. This cannot be undone.
      </div>
      <div style="width:100%;margin-top:8px">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:6px;font-family:'DM Mono',monospace">Type DELETE to confirm</div>
        <input type="text" id="nuke-confirm" placeholder="DELETE"
          style="background:var(--bg-2);border:1px solid rgba(255,80,80,.4);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:14px;width:100%;box-sizing:border-box">
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;width:100%">
        <button class="btn btn-ghost" id="btn-nuke-back" style="flex:1">← Back</button>
        <button class="btn btn-danger" id="btn-nuke-confirm" style="flex:2">Delete everything</button>
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
    if (val !== 'DELETE') {
      lockEl.querySelector('#nuke-confirm').style.borderColor = 'var(--red)';
      lockEl.querySelector('#nuke-confirm').placeholder = 'Type DELETE exactly';
      return;
    }
    wipeAllData();
    lockEl._cleanup?.();
    lockEl.remove();
    showToast('Data deleted. You can start fresh.');
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
  if (!cryptoApi?.subtle) throw new Error('This browser does not support secure backup encryption.');
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
    if (typeof payload?.data !== 'string') throw new Error('Invalid format');
    const raw = fromB64(payload.data);
    if (raw === null) throw new Error('Decoding error');
    return raw;
  }
  if (!password) throw new Error('This backup is encrypted. Enter the password.');
  if (payload.cipher === 'AES-GCM') {
    const salt = b64ToBytes(payload.salt || '');
    const iv = b64ToBytes(payload.iv || '');
    const cipherBytes = b64ToBytes(payload.data || '');
    if (!salt || !iv || !cipherBytes) throw new Error('Invalid encrypted backup');
    try {
      const key = await deriveBackupKey(password, salt, ['decrypt']);
      const plainBuffer = await getCryptoApi().subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
      return textDecoder.decode(plainBuffer);
    } catch {
      throw new Error('Incorrect password or corrupted backup');
    }
  }
  throw new Error('Unsupported encryption format — backup cannot be decrypted');
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
  if (ev.scope === 'compartido') parts.push('Shared');
  return parts.join('\n');
}

function buildAgendaICS(from, to) {
  const alters = getAlters();
  const now = new Date();
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null;
  const inRange = ms => (!fromMs || ms >= fromMs) && (!toMs || ms <= toMs);
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Atria//Agenda v0.13//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Atria Agenda'];

  loadEvents().forEach(ev => {
    if (!ev || !ev.date) return;
    const baseMs = new Date(`${ev.date}T${ev.time || '12:00'}:00`).getTime();
    if (!inRange(baseMs)) return;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${icsEscape(`event-${ev.id || baseMs}@atria.local`)}`);
    lines.push(`DTSTAMP:${icsLocalStamp(now)}`);
    lines.push(icsFold(`SUMMARY:${icsEscape(ev.title || 'Atria event')}`));
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
      lines.push('BEGIN:VALARM','ACTION:DISPLAY',`TRIGGER:-PT${Math.max(1, Number(ev.reminderMins))}M`,icsFold(`DESCRIPTION:${icsEscape(ev.title || 'Atria event')}`),'END:VALARM');
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
    lines.push(icsFold(`SUMMARY:${icsEscape(rem.title || 'Atria reminder')}`));
    if (rem.desc || rem.note) lines.push(icsFold(`DESCRIPTION:${icsEscape(rem.desc || rem.note)}`));
    lines.push(`DTSTART:${icsLocalStamp(dt)}`);
    lines.push(`DTEND:${icsLocalStamp(end)}`);
    const rrule = icsRRule(rem.recurrence || rem.recur);
    if (rrule) lines.push(`RRULE:${rrule}`);
    lines.push('BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0M',icsFold(`DESCRIPTION:${icsEscape(rem.title || 'Atria reminder')}`),'END:VALARM');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

async function exportAgendaICS(from, to) {
  const ics = buildAgendaICS(from, to);
  const count = (ics.match(/BEGIN:VEVENT/g) || []).length;
  const filename = `atria-agenda-${new Date().toISOString().slice(0,10)}.ics`, file = new File([ics], filename, {type:'text/calendar'});
  const warning = 'This file may contain alter names, notes, and event details. It will be shared with the app or person you choose. Continue?';
  if (!confirm(warning)) return;
  if (navigator.share && navigator.canShare?.({files:[file]})) {
    try { await navigator.share({files:[file], title:'Atria agenda', text:'Calendar exported from Atria'}); showToast(`${count} items shared with calendar`); return; } catch (error) { if (error?.name === 'AbortError') return; }
  }
  downloadTextFile(ics, filename, 'text/calendar;charset=utf-8');
  showToast(`${count} items exported to calendar`);
}

function openCSVRangeModal(title, exportFn, actionLabel = '↓ Export CSV') {
  const today = new Date().toISOString().slice(0,10);
  const y1 = new Date(); y1.setFullYear(y1.getFullYear()-1);
  const defFrom = y1.toISOString().slice(0,10);
  openModal(`
    <div class="modal-header"><span>${title}</span><button class="modal-close" id="crm-close">✕</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label class="field-label">From</label><input id="crm-from" class="input" type="date" value="${defFrom}"></div>
        <div><label class="field-label">To</label><input id="crm-to" class="input" type="date" value="${today}"></div>
      </div>
      <div style="font-size:12px;color:var(--text-3)">Leave both fields empty to export everything.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" id="crm-all">All</button>
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
  const rows = [['Date','Start time','End time','Alter','Co-fronting','Duration (min)','Note']];
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
  showToast(`${rows.length-1} sessions exported ✓`);
}

function exportTrackerCSV(from, to) {
  const alters  = getAlters();
  const alterName = id => alters.find(a=>a.id===id)?.name||id;
  let entries = (()=>{ try{return JSON.parse(localStorage.getItem('tid_tracker'))||[];}catch{return[];} })()
    .filter(e => !e.isPrivate || e.alterId === activeAlter.id)
    .sort((a,b)=>a.date.localeCompare(b.date));
  if(from) entries = entries.filter(e=>e.date>=from);
  if(to)   entries = entries.filter(e=>e.date<=to);
  const rows = [['Date','Alter','Mood','Intensity','Note']];
  entries.forEach(e=>rows.push([e.date, alterName(e.alterId), e.mood||'', e.intensity!=null?e.intensity:'', e.note||'']));
  downloadCSV(rows, `tracker-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(`${rows.length-1} entries exported ✓`);
}

function exportFinanzasCSV(from, to) {
  const alters = getAlters();
  const rows   = [['Date','Alter','Type','Description','Amount','Category','Account','Source','Note']];
  alters.forEach(alter=>{
    let txs = (()=>{ try{return JSON.parse(localStorage.getItem(`tid_${alter.id}_transactions`))||[];}catch{return[];} })();
    if(from) txs = txs.filter(t=>(t.date||'')>=from);
    if(to)   txs = txs.filter(t=>(t.date||'')<=to);
    txs.forEach(t=>rows.push([
      t.date||'', alter.name,
      t.type==='ingreso' || t.type==='income' ? 'Income' : 'Expense',
      t.description||'',
      t.amount!=null?t.amount:'',
      t.category||'',
      t.account||'',
      t.source||'',
      t.note||''
    ]));
  });
  rows.sort((a,b)=>a[0].localeCompare(b[0]));
  downloadCSV(rows, `finances-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(`${rows.length-1} transactions exported ✓`);
}

function exportFinanzasJSON() {
  const alters = getAlters();
  const data = { version: 1, exportedAt: new Date().toISOString(), currency: getFinanceCurrency(), alters: {} };
  alters.forEach(a => { data.alters[a.id] = {}; ['transactions','ahorros','presupuestos','categories'].forEach(section => { try { data.alters[a.id][section] = JSON.parse(localStorage.getItem(`tid_${a.id}_${section}`)) || []; } catch { data.alters[a.id][section] = []; } }); });
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download=`finances-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
  showToast('Finances exported ✓');
}

function importFinanzasJSON(file) {
  const reader = new FileReader();
  reader.onload = event => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data || typeof data.alters !== 'object') throw new Error('Invalid finance file format');
      const known = getAlters().filter(a => data.alters[a.id]);
      openModal(`<div class="modal-title">Import finances</div><div class="form-grid"><div class="form-row">Choose which alters and finance sections to restore.</div><div style="display:grid;gap:8px">${known.map(a => `<div style="border:1px solid var(--border);padding:8px;border-radius:8px"><label><input type="checkbox" data-import-alter="${a.id}" checked> <strong>${esc(a.name)}</strong></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${['transactions','ahorros','presupuestos','categories'].map(section => `<label style="font-size:11px"><input type="checkbox" data-import-section="${a.id}:${section}" checked> ${section}</label>`).join('')}</div></div>`).join('')}</div><div style="color:var(--red);font-size:11px">Selected current data will be replaced.</div></div><div class="modal-footer"><button class="btn btn-ghost" data-cancel>Cancel</button><button class="btn btn-danger" data-submit>Import selected</button></div>`, overlay => {
        known.forEach(a => { if (!overlay.querySelector(`[data-import-alter="${a.id}"]`)?.checked) return; const sections=data.alters[a.id]; ['transactions','ahorros','presupuestos','categories'].forEach(section => { if (overlay.querySelector(`[data-import-section="${a.id}:${section}"]`)?.checked && Array.isArray(sections[section])) localStorage.setItem(`tid_${a.id}_${section}`, JSON.stringify(sections[section])); }); });
        const cfg=loadConfig(); if (data.currency) saveConfig({...cfg,financeCurrency:String(data.currency)});
        closeModal(); showToast('Finances imported ✓'); renderFinanzasDashboard();
      });
    } catch (error) { showToast('⚠ ' + error.message); }
  };
  reader.readAsText(file);
}

function exportRemindersCSV(from, to) {
  const alters = getAlters();
  const alterName = id => alters.find(a=>a.id===id)?.name||'—';
  const RECUR = {none:'No repeat',every8h:'Every 8h',daily:'Daily',weekly:'Weekly',monthly:'Monthly'};
  let reminders = (()=>{ try{return JSON.parse(localStorage.getItem('tid_reminders'))||[];}catch{return[];} })()
    .sort((a,b)=>a.datetime-b.datetime);
  if(from) reminders = reminders.filter(r=>new Date(r.datetime).toISOString().slice(0,10)>=from);
  if(to)   reminders = reminders.filter(r=>new Date(r.datetime).toISOString().slice(0,10)<=to);
  const rows = [['Date','Time','Alter','Title','Description','Recurrence','Done']];
  reminders.forEach(r=>{
    const d = new Date(r.datetime);
    rows.push([
      d.toISOString().slice(0,10),
      d.toTimeString().slice(0,5),
      alterName(r.alterId),
      r.title||'',
      r.desc||'',
      RECUR[r.recurrence]||r.recurrence||'',
      r.done?'Yes':'No'
    ]);
  });
  downloadCSV(rows, `reminders-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(`${rows.length-1} reminders exported ✓`);
}

function exportTareasCSV(from, to) {
  const alters    = getAlters();
  const proyectos = (()=>{ try{return JSON.parse(localStorage.getItem('tid_proyectos'))||[];}catch{return[];} })();
  const alterName = id => alters.find(a=>a.id===id)?.name||'—';
  const proyName  = id => proyectos.find(p=>p.id===id)?.name||'—';
  const STATUS_EN = {pendiente:'Pending','en-progreso':'In progress',completada:'Done',bloqueada:'Blocked'};
  const PRIO_EN   = {alta:'High',media:'Medium',baja:'Low'};
  let tareas = (()=>{ try{return JSON.parse(localStorage.getItem('tid_tareas'))||[];}catch{return[];} })();
  if(from) tareas = tareas.filter(t=>(t.deadline||'')>=from);
  if(to)   tareas = tareas.filter(t=>!t.deadline||(t.deadline<=to));
  tareas.sort((a,b)=>(a.deadline||'').localeCompare(b.deadline||''));
  const rows = [['Deadline','Project','Task','Assigned to','Priority','Status','Description']];
  tareas.forEach(t=>rows.push([
    t.deadline||'',
    proyName(t.proyId),
    t.title||'',
    alterName(t.assigneeId),
    PRIO_EN[t.priority]||t.priority||'',
    STATUS_EN[t.status]||t.status||'',
    t.desc||''
  ]));
  downloadCSV(rows, `tasks-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(`${rows.length-1} tasks exported ✓`);
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

  const periodLabel = from||to ? `${from||'start'} — ${to||today}` : 'Full history';

  const lines = [];
  lines.push('═══════════════════════════════════════════');
  lines.push('  SYSTEM SUMMARY');
  lines.push(`  Period: ${periodLabel}`);
  lines.push(`  Generated: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`);
  lines.push('═══════════════════════════════════════════');
  lines.push('');

  lines.push('── ALTERS ──────────────────────────────────');
  alters.forEach(a=>lines.push(`  ${a.emoji||'●'} ${a.name}${a.pronouns?' ('+a.pronouns+')':''}${a.role?' · '+a.role:''}`));
  lines.push('');

  lines.push(`── FRONTING (${periodLabel}) ──────────────`);
  lines.push(`  ${sessions.length} sessions recorded`);
  if(Object.keys(frontTotals).length) {
    Object.entries(frontTotals).sort((a,b)=>b[1]-a[1]).forEach(([id,ms])=>
      lines.push(`  · ${alterName(id)}: ${(ms/3600000).toFixed(1)} h`));
  }
  lines.push('');

  lines.push(`── MOOD TRACKER (${periodLabel}) ──────────`);
  if(tracker.length) {
    const moodCount={};
    tracker.forEach(e=>{ moodCount[e.mood]=(moodCount[e.mood]||0)+1; });
    Object.entries(moodCount).sort((a,b)=>b[1]-a[1]).forEach(([m,n])=>lines.push(`  · ${m}: ${n} entry${n!==1?'s':''}`));
  } else {
    lines.push('  No entries in the period');
  }
  lines.push('');

  const activeProy = proyectos.filter(p=>p.status==='activo');
  lines.push('── ACTIVE PROJECTS ───────────────────────────');
  if(activeProy.length) {
    activeProy.forEach(p=>{
      const total=tareas.filter(t=>t.proyId===p.id).length;
      const done=tareas.filter(t=>t.proyId===p.id&&t.status==='completada').length;
      lines.push(`  · ${p.name} [${done}/${total}] — owner: ${p.responsableId?alterName(p.responsableId):'—'}${p.deadline?' · due: '+p.deadline:''}`);
    });
  } else {
    lines.push('  No active projects');
  }
  lines.push('');

  if(overdue.length) {
    lines.push('── OVERDUE TASKS ─────────────────────────────');
    overdue.sort((a,b)=>a.deadline.localeCompare(b.deadline)).forEach(t=>{
      lines.push(`  ⚠ [${t.deadline}] ${t.title} (${proyectos.find(p=>p.id===t.proyId)?.name||'—'}) → ${alterName(t.assigneeId)}`);
    });
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════');
  lines.push('  Generated by Atria');
  lines.push('═══════════════════════════════════════════');

  const blob = new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download=`system-summary-${today}.txt`; a.click(); URL.revokeObjectURL(url);
  showToast('Summary exported ✓');
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

  const periodLabel = from||to ? `${from||'start'} — ${to||today}` : 'Full history';
  const NIVEL_EN = {leve:'Mild',moderado:'Moderate',intenso:'Intense',severo:'Severe'};

  const lines = [];
  const sep  = '═══════════════════════════════════════════';
  const sep2 = '───────────────────────────────────────────';

  lines.push(sep);
  lines.push('  WELLBEING REPORT');
  if(cfg.systemName) lines.push(`  System: ${cfg.systemName}`);
  lines.push(`  Period: ${periodLabel}`);
  lines.push(`  Generated: ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}`);
  lines.push(sep);
  lines.push('');
  lines.push('  This report contains sensitive information.');
  lines.push('  Share only with trusted professionals.');
  lines.push('');

  lines.push('── SYSTEM COMPOSITION ──────────────────────');
  lines.push(`  ${alters.length} active alter${alters.length!==1?'s':''}`);
  alters.forEach(a=>{
    let line = `  ${a.emoji||'●'} ${a.name}`;
    if(a.pronouns) line += ` (${a.pronouns})`;
    if(a.role)     line += ` — ${a.role}`;
    lines.push(line);
  });
  lines.push('');

  lines.push('── PRESENCE / FRONTING ─────────────────────');
  if(sessions.length) {
    const frontTotals={}, frontCount={};
    sessions.forEach(s=>{ frontTotals[s.alterId]=(frontTotals[s.alterId]||0)+(s.duration||0); frontCount[s.alterId]=(frontCount[s.alterId]||0)+1; });
    const totalH = Object.values(frontTotals).reduce((a,b)=>a+b,0)/3600000;
    lines.push(`  ${sessions.length} sessions · ${totalH.toFixed(1)} h total`);
    Object.entries(frontTotals).sort((a,b)=>b[1]-a[1]).forEach(([id,ms])=>{
      lines.push(`  · ${alterName(id)}: ${(ms/3600000).toFixed(1)} h (${frontCount[id]} ses.)`);
    });
  } else {
    lines.push('  No sessions recorded in the period');
  }
  lines.push('');

  lines.push('── EMOTIONAL STATE ─────────────────────────');
  if(tracker.length) {
    const moodCount={}, intensities=[];
    tracker.forEach(e=>{ moodCount[e.mood]=(moodCount[e.mood]||0)+1; if(e.intensity!=null) intensities.push(e.intensity); });
    const avgInt = intensities.length ? (intensities.reduce((a,b)=>a+b,0)/intensities.length).toFixed(1) : null;
    lines.push(`  ${tracker.length} record${tracker.length!==1?'s':''}${avgInt?' · average intensity: '+avgInt+'/5':''}`);
    lines.push('  Most frequent states:');
    Object.entries(moodCount).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,n])=>lines.push(`    · ${m}: ${n} time${n!==1?'s':''}`));
    const byAlter={};
    tracker.forEach(e=>{ if(!byAlter[e.alterId]) byAlter[e.alterId]={count:{},total:0}; byAlter[e.alterId].count[e.mood]=(byAlter[e.alterId].count[e.mood]||0)+1; byAlter[e.alterId].total++; });
    if(Object.keys(byAlter).length>1) {
      lines.push('  By alter:');
      Object.entries(byAlter).forEach(([id,d])=>{
        const top=Object.entries(d.count).sort((a,b)=>b[1]-a[1])[0];
        lines.push(`    · ${alterName(id)}: ${d.total} record${d.total!==1?'s':''}, mainly "${top[0]}"`);
      });
    }
  } else {
    lines.push('  No records in the period');
  }
  lines.push('');

  lines.push('── DIARY ENTRIES ────────────────────────────');
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
    lines.push('  No entries in the period');
  }
  lines.push('');

  lines.push('── CRISIS EPISODES ─────────────────────────');
  if(crisisLog.length) {
    lines.push(`  ${crisisLog.length} episode${crisisLog.length!==1?'s':''} recorded`);
    crisisLog.sort((a,b)=>b.startedAt-a.startedAt).forEach(e=>{
      const d=new Date(e.startedAt).toISOString().slice(0,10);
      const dur=e.endedAt?Math.round((e.endedAt-e.startedAt)/60000):null;
      const trig=e.triggerId?triggers.find(t=>t.id===e.triggerId)?.titulo:'—';
      let line=`  · [${d}] ${alterName(e.alterId)} · ${NIVEL_EN[e.level]||e.level}`;
      if(trig&&trig!=='—') line+=` · trigger: ${trig}`;
      if(dur!=null) line+=` · duration: ${dur} min`;
      lines.push(line);
      if(e.note) lines.push(`    Note: ${e.note}`);
    });
  } else {
    lines.push('  No episodes in the period');
  }
  lines.push('');

  lines.push(sep);
  lines.push('  Generated by Atria · atria-app.com');
  lines.push(sep);

  const blob = new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download=`wellbeing-report-${today}.txt`; a.click(); URL.revokeObjectURL(url);
  showToast('Report exported ✓');
}

// ── PRINT WELLBEING REPORT (PDF) ──
function printInformeBienestar(from, to) {
  const alters = getAlters();
  const sessions = loadFronting().filter(s=>s.end && s.start>=from && s.start<=to).sort((a,b)=>a.start-b.start);
  const moods = loadMoods().filter(m=>m.ts>=from && m.ts<=to);
  const diaryEntries = loadDiary().filter(e=>e.date && new Date(e.date).getTime()>=from && new Date(e.date).getTime()<=to);
  const crisisLog = loadCrisisLog().filter(c=>c.ts>=from && c.ts<=to);

  const fmtDate = ts => new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const fmtDay  = d  => new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});

  const moodCounts = {};
  moods.forEach(m=>{ moodCounts[m.mood]=(moodCounts[m.mood]||0)+1; });

  const frontStats = {};
  sessions.forEach(s=>{
    if(!frontStats[s.alterId]) frontStats[s.alterId]={count:0,ms:0};
    frontStats[s.alterId].count++;
    frontStats[s.alterId].ms += (s.duration||0);
  });

  const win = window.open('','_blank');
  if(!win) { showToast('Could not open print window'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Atria Wellbeing Report</title>
  <style>
    body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#1a1a2e;font-size:14px;line-height:1.6}
    h1{font-size:22px;border-bottom:2px solid #a08aff;padding-bottom:8px;color:#6040c0}
    h2{font-size:16px;color:#6040c0;margin-top:28px;margin-bottom:8px}
    h3{font-size:13px;font-weight:700;margin:10px 0 4px}
    .meta{color:#666;font-size:12px;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px}
    th{text-align:left;border-bottom:1px solid #ccc;padding:4px 8px;color:#444}
    td{padding:4px 8px;border-bottom:1px solid #eee}
    .entry{margin-bottom:10px;padding:8px 12px;border-left:3px solid #a08aff;background:#f8f6ff}
    .entry-date{font-size:11px;color:#888;margin-bottom:4px}
    .footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:8px}
    @media print{body{margin:20px}}
  </style>
  </head><body>
  <h1>Atria — Wellbeing Report</h1>
  <div class="meta">Period: ${fmtDay(from)} – ${fmtDay(to)} · Generated: ${new Date().toLocaleDateString('en-GB')}</div>

  <h2>◉ Fronting — ${sessions.length} sessions</h2>
  <table><tr><th>Alter</th><th>Sessions</th><th>Total time</th></tr>
  ${Object.entries(frontStats).sort((a,b)=>b[1].ms-a[1].ms).map(([id,st])=>{
    const alt = alters.find(a=>a.id===id);
    const h = Math.floor(st.ms/3600000), m = Math.floor((st.ms%3600000)/60000);
    return `<tr><td>${escM(alt?.name||id)}</td><td>${st.count}</td><td>${h>0?h+'h ':''}${m}m</td></tr>`;
  }).join('')}
  </table>

  <h2>🎭 Emotions — ${moods.length} records</h2>
  <table><tr><th>Mood</th><th>Count</th></tr>
  ${Object.entries(moodCounts).sort((a,b)=>b[1]-a[1]).map(([m,c])=>`<tr><td>${escM(m)}</td><td>${c}</td></tr>`).join('')}
  </table>

  <h2>📓 Journal — ${diaryEntries.length} entries</h2>
  ${diaryEntries.map(e=>`<div class="entry"><div class="entry-date">${fmtDay(e.date)}${e.alterId?' · '+escM(alters.find(a=>a.id===e.alterId)?.name||''):''}</div><div>${escM(e.content||'')}</div></div>`).join('')}

  <h2>🆘 Crisis log — ${crisisLog.length} episodes</h2>
  ${crisisLog.length?crisisLog.map(c=>`<div class="entry"><div class="entry-date">${fmtDate(c.ts)}${c.alterId?' · '+escM(alters.find(a=>a.id===c.alterId)?.name||''):''}</div><div>${escM(c.notes||'')}</div></div>`).join(''):'<p style="color:#aaa;font-size:13px">No crisis episodes recorded in this period.</p>'}

  <div class="footer">Generated by Atria · Private and confidential · For therapeutic use only</div>
  </body></html>`);
  win.document.close();
  win.print();
}

// ── BACKUP EXPORT ──
const BACKUP_SCHEMA_VERSION = 3;

async function checksumBackupText(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function validateBackupEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Backup file has an invalid format');
  const version = Number(payload.schemaVersion || payload.v || 0);
  if (!version || version > BACKUP_SCHEMA_VERSION) throw new Error(`Unsupported backup version: ${version || 'unknown'}`);
  if (typeof payload.data !== 'string') throw new Error('Backup does not contain valid data');
  return version;
}

function validateBackupData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Backup content is not a valid object');
  const keys = Object.keys(data).filter(key => key.startsWith('tid_'));
  if (!keys.length) throw new Error('Backup contains no Atria data');
  if (data.tid_alters) {
    let alters;
    try { alters = JSON.parse(data.tid_alters); } catch { throw new Error('Backup contains damaged alters'); }
    if (!Array.isArray(alters)) throw new Error('Backup contains an invalid alters list');
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
  return score >= 4 ? ['Strong', '#5fffb0'] : score >= 2 ? ['Acceptable', '#ffcf6f'] : ['Weak', '#ff8a8a'];
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
  showToast('Backup exported ✓');
}

// ── BACKUP IMPORT ──
function importBackup(file, password, onDone, selectedModules = null) {
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const payload = JSON.parse(e.target.result);
      const version = validateBackupEnvelope(payload);
      const raw = await decryptBackupPayload(payload, password);
      if (version >= BACKUP_SCHEMA_VERSION && payload.checksum !== await checksumBackupText(raw)) throw new Error('Backup checksum does not match; the file may be damaged');
      const data = JSON.parse(raw);
      validateBackupData(data);
      Object.entries(data).forEach(([k,v]) => {
        if (shouldRestoreBackupKey(k, selectedModules) && !shouldSkipIncomingSyncWrite(k, v) && !PIN_KEYS.includes(k) && (TID_KEYS.includes(k) || k.startsWith('tid_'))) localStorage.setItem(k, v);
      });
      onDone(null);
    } catch(err) { onDone(err.message || 'Error importing'); }
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
        <div class="fin-title">🔒 Security</div>
        <div class="fin-subtitle">PIN, session and data management</div>
      </div>

      <!-- PIN -->
      <div class="sec-section">
        <div class="sec-section-header">
          <span class="sec-section-icon">🔑</span>
          <span class="sec-section-title">Access PIN</span>
          <span class="sec-status-badge" style="color:${pinEnabled?'var(--green)':'var(--text-3)'};border-color:${pinEnabled?'var(--green)':'var(--border)'}">
            ${pinEnabled ? '● Active' : '○ Disabled'}
          </span>
        </div>
        <div class="sec-section-body">
          <div class="sec-row">
            <div>
              <div class="sec-row-label">4-digit global PIN</div>
              <div class="sec-row-sub">Asked when opening the app in a new session</div>
            </div>
            <button class="btn btn-${pinEnabled?'ghost':'primary'}" id="btn-pin-toggle">
              ${pinEnabled ? 'Disable PIN' : 'Enable PIN'}
            </button>
          </div>
          ${pinEnabled ? `<div class="sec-row">
            <div>
              <div class="sec-row-label">Change PIN</div>
              <div class="sec-row-sub">Enter your current PIN and your new PIN</div>
            </div>
            <button class="btn btn-ghost" id="btn-pin-change">Change</button>
          </div>
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Recovery question</div>
              <div class="sec-row-sub">${getPinRecovery() ? '● Set' : '○ Not set — without it you can only recover by wiping all data'}</div>
            </div>
            <button class="btn btn-ghost" id="btn-pin-recovery">${getPinRecovery() ? 'Edit' : 'Set up'}</button>
          </div>` : ''}
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Block now</div>
              <div class="sec-row-sub">Closes the active session immediately</div>
            </div>
            <button class="btn btn-ghost" id="btn-lock-now" ${!pinEnabled?'disabled style="opacity:.4;cursor:not-allowed"':''}>Lock</button>
          </div>
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Lock when leaving the app</div>
              <div class="sec-row-sub">Ask for the PIN again when returning from another app or browser tab</div>
            </div>
            <label class="toggle-switch"><input type="checkbox" id="cfg-auto-lock" ${localStorage.getItem(AUTO_LOCK_KEY)==='1'?'checked':''} ${!pinEnabled?'disabled':''}><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>

      <!-- LOCAL PROTECTION -->
      <div class="sec-section">
        <div class="sec-section-header">
          <span class="sec-section-icon">◎</span>
          <span class="sec-section-title">Local protection</span>
        </div>
        <div class="sec-section-body">
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2);line-height:1.6;padding:10px;background:var(--bg-2);border-radius:8px;border:1px solid var(--border)">
            ⚠ PIN protects the session and adds a basic local barrier, but it does not encrypt all browser storage. For secure sharing or transfer, use an encrypted backup with a password.
          </div>
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Protection status</div>
              <div class="sec-row-sub" id="enc-status-sub">Checking…</div>
            </div>
            <button class="btn btn-ghost" id="btn-enc-toggle" ${!pinEnabled?'disabled style="opacity:.4;cursor:not-allowed"':''}>
              ${localStorage.getItem('tid_enc_enabled')==='1'?'View status':'Enable protection'}
            </button>
          </div>
        </div>
      </div>

      <!-- PRIVATE NOTIFICATIONS -->
      <div class="sec-section">
        <div class="sec-section-header">
          <span class="sec-section-icon">◌</span>
          <span class="sec-section-title">Private notifications</span>
        </div>
        <div class="sec-section-body">
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Hide notification details</div>
              <div class="sec-row-sub">Use generic text so names and reminder contents do not appear on the lock screen</div>
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
              <div class="sec-row-sub">Download data as .json (optional encryption)</div>
            </div>
            <button class="btn btn-primary" id="btn-export">Export</button>
          </div>
          <div class="sec-row">
            <div>
              <div class="sec-row-label">Import backup</div>
              <div class="sec-row-sub">Restore from a .json file (overwrites current data)</div>
            </div>
            <button class="btn btn-ghost" id="btn-sec-import">Import</button>
            <input type="file" id="import-file-input" accept=".json" style="display:none">
          </div>
        </div>
      </div>

    </div>`;

  // Enc status
  const encEnabled = localStorage.getItem('tid_enc_enabled') === '1';
  container.querySelector('#enc-status-sub').textContent =
    encEnabled ? '● Basic local protection with PIN' : '○ Local protection disabled';

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
    showToast(e.target.checked ? 'Private notifications enabled ✓' : 'Notification details visible');
  });
  container.querySelector('#cfg-auto-lock')?.addEventListener('change', e => {
    localStorage.setItem(AUTO_LOCK_KEY, e.target.checked ? '1' : '0');
    showToast(e.target.checked ? 'Auto-lock enabled ✓' : 'Auto-lock disabled');
  });

  // Lock now
  container.querySelector('#btn-lock-now')?.addEventListener('click', () => {
    if (!getPinEnabled()) return;
    clearSessionUnlock();
    showToast('Session locked ✓');
    setTimeout(() => { location.reload(); }, 800);
  });

  // Encrypt toggle
  container.querySelector('#btn-enc-toggle')?.addEventListener('click', () => {
    if (!getPinEnabled()) return showToast('⚠ Activate PIN first');
    showToast('Basic local protection available with active PIN ✓');
  });

  // Export
  container.querySelector('#btn-export')?.addEventListener('click', () => {
    openModal(`
      <div class="modal-title">Export backup</div>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-label">Encryption password (optional)</div>
          <input type="password" id="exp-pwd" placeholder="Leave empty to export without encryption">
          <div id="exp-pwd-strength" style="font-size:11px;color:var(--text-3)">No password: unencrypted copy</div>
        </div>
        <div class="form-row">
          <div class="form-label">Confirm password</div>
          <input type="password" id="exp-pwd2" placeholder="">
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);padding:8px;background:var(--bg-2);border-radius:6px">
			This export is optional. If you set a password, you'll need the same password to import it. Without a password, it will not be encrypted.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-cancel>Cancel</button>
        <button class="btn btn-primary" data-submit>Download</button>
      </div>`,
      (ov) => {
        const p1 = ov.querySelector('#exp-pwd').value;
        const p2 = ov.querySelector('#exp-pwd2').value;
        if (p1 && p1 !== p2) return showToast('⚠ Passwords do not match');
        closeModal();
      exportBackup(p1 || null).catch(err => showToast('⚠ ' + (err.message || 'Export failed')));
      }
    );
    const pwd = document.querySelector('#exp-pwd');
    const strength = document.querySelector('#exp-pwd-strength');
    const updateStrength = () => { const [label, color] = describeBackupPasswordStrength(pwd?.value); if (strength) { strength.textContent = pwd?.value ? `Strength: ${label}` : 'No password: unencrypted copy'; strength.style.color = color; } };
    pwd?.addEventListener('input', updateStrength);
  });

  // Import
  container.querySelector('#btn-sec-import')?.addEventListener('click', () => {
    container.querySelector('#import-file-input').click();
  });
  container.querySelector('#import-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    openModal(`
      <div class="modal-title">Import backup</div>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-label">Selected file</div>
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);padding:8px;background:var(--bg-2);border-radius:6px">${file.name}</div>
        </div>
        <div class="form-row">
          <div class="form-label">Password (only if backup is encrypted)</div>
          <input type="password" id="imp-pwd" placeholder="Leave empty if no password">
        </div>
        <div class="form-row"><div class="form-label">Modules to restore</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;font-size:12px">${[['identities','Identities'],['fronts','Fronting'],['journal','Journal'],['reminders','Reminders'],['settings','Settings'],['projects','Projects'],['finances','Finances']].map(([id,label])=>`<label><input type="checkbox" data-restore-module="${id}" checked> ${label}</label>`).join('')}</div></div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--red);padding:8px;background:rgba(255,80,80,.06);border-radius:6px;border:1px solid rgba(255,80,80,.2)">
          ⚠ Importing will overwrite all current data. If you want to keep an external copy of the current state, export it first.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-cancel>Cancel</button>
        <button class="btn btn-danger" data-submit>Import and overwrite</button>
      </div>`,
      (ov) => {
        const pwd = ov.querySelector('#imp-pwd').value;
        const selectedModules = [...ov.querySelectorAll('[data-restore-module]:checked')].map(input => input.dataset.restoreModule);
        importBackup(file, pwd || null, (err) => {
          if (err) { showToast('⚠ ' + err); return; }
          closeModal();
          showToast('Data imported successfully ✓');
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
    <div class="modal-title">${isChange ? 'Change PIN' : 'Enable PIN'}</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:10px 0">
      <div class="pin-lock-sub" id="pin-modal-sub">${isChange ? 'Enter your current PIN' : 'Choose a 4-digit PIN'}</div>
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
      <button class="btn btn-ghost" data-cancel>Cancel</button>
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
      <div class="modal-title">Recovery question</div>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-label">Recovery question</div>
          <input type="text" id="rec-q" placeholder="e.g. Name of your first alter?" maxlength="120"
            style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:13px;width:100%;box-sizing:border-box">
        </div>
        <div class="form-row">
          <div class="form-label">Answer</div>
          <input type="text" id="rec-a" placeholder="Your answer (case-insensitive)" maxlength="120"
            style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:13px;width:100%;box-sizing:border-box">
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);padding:8px;background:var(--bg-2);border-radius:6px">
          If you forget your PIN, this answer lets you recover access without losing data. You can skip it, but if you do, the only recovery option is wiping all data.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="btn-rec-skip">Skip</button>
        <button class="btn btn-primary" id="btn-rec-save">Save & enable</button>
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
      showToast('PIN enabled ✓');
      if (document.querySelector('.sec-view')) renderSeguridadView(document.getElementById('app'));
    }

    ov.querySelector('#btn-rec-save').addEventListener('click', () => {
      const q = ov.querySelector('#rec-q').value.trim();
      const a = ov.querySelector('#rec-a').value.trim();
      if (!q || !a) { showToast('⚠ Fill in question and answer, or use Skip'); return; }
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
        ov.querySelector('#pin-modal-sub').textContent = 'Create new PIN';
        updateDots(); return;
      }
      const salt = getOrCreatePinSalt();
      const hash = await hashPinAsync(entered, salt);
      if (hash !== storedHash) { shake('Incorrect PIN'); return; }
      step = 'set'; entered = '';
      ov.querySelector('#pin-modal-sub').textContent = 'Create new PIN';
      updateDots();
    } else if (step === 'set') {
      newPin = entered; step = 'confirm'; entered = '';
      ov.querySelector('#pin-modal-sub').textContent = 'Confirm new PIN';
      updateDots();
    } else {
      if (entered !== newPin) { shake("PINs don't match"); step='set'; newPin=''; return; }
      if (isChange) {
        // When changing PIN, keep existing recovery question, do not ask again
        const salt = generatePinSalt();
        const hash = await hashPinAsync(entered, salt);
        setStoredPinHash(hash);
        setPinEnabled(true);
        markSessionUnlocked();
        closeModal();
        showToast('PIN updated ✓');
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
    <div class="modal-title">Recovery question</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Question</div>
        <input type="text" id="rec-edit-q" value="${existing ? escC(existing.question) : ''}" placeholder="e.g. Name of your first alter?" maxlength="120"
          style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:13px;width:100%;box-sizing:border-box">
      </div>
      <div class="form-row">
        <div class="form-label">New answer${existing ? ' (leave blank to keep current)' : ''}</div>
        <input type="text" id="rec-edit-a" placeholder="Your answer" maxlength="120"
          style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-0);font-family:'DM Mono',monospace;font-size:13px;width:100%;box-sizing:border-box">
      </div>
    </div>
    <div class="modal-footer">
      ${existing ? `<button class="btn btn-ghost" id="btn-rec-delete" style="color:var(--red);margin-right:auto">Remove</button>` : ''}
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>Save</button>
    </div>`,
    (ov) => {
      const q = ov.querySelector('#rec-edit-q').value.trim();
      const a = ov.querySelector('#rec-edit-a').value.trim();
      if (!q) { showToast('⚠ Question cannot be empty'); return; }
      if (!a && !existing) { showToast('⚠ Enter an answer'); return; }
      if (a) setPinRecovery(q, a);
      else localStorage.setItem(PIN_RECOVERY_KEY, JSON.stringify({ question: q, answerHash: existing.answerHash }));
      closeModal();
      showToast('Recovery question saved ✓');
      if (document.querySelector('.sec-view')) renderSeguridadView(document.getElementById('app'));
    }
  );
  document.querySelector('#btn-rec-delete')?.addEventListener('click', () => {
    clearPinRecovery(); closeModal();
    showToast('Recovery question removed');
    if (document.querySelector('.sec-view')) renderSeguridadView(document.getElementById('app'));
  });
}

function openPinDisableModal() {
  openModal(`
    <div class="modal-title">Disable PIN</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:10px 0">
      <div class="pin-lock-sub">Enter your current PIN to disable it</div>
      <div class="pin-dots" id="pind-dots">${Array(4).fill('<div class="pin-dot"></div>').join('')}</div>
      <div class="pin-error-msg" id="pind-err"></div>
      <div class="pin-pad" style="max-width:220px;width:100%">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k=>`
          <button class="pin-key${k===''?' invisible':k==='⌫'?' del':''}" data-dpkey="${k}">${k}</button>
        `).join('')}
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" data-cancel>Cancel</button></div>`,
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
        if(!ok){ ov.querySelectorAll('.pin-dot').forEach(d=>{d.classList.remove('filled');d.classList.add('error');}); ov.querySelector('#pind-err').textContent='Incorrect PIN'; setTimeout(()=>{entered='';updateD();},600); return; }
        setPinEnabled(false); localStorage.removeItem(PIN_STORAGE_KEY); localStorage.removeItem(PIN_SALT_KEY); clearPinRecovery(); closeModal();
        showToast('PIN disabled ✓');
        if(document.querySelector('.sec-view')) renderSeguridadView(document.getElementById('app'));
      },80);
    }
  }));
}


function renderSeguridadRoute() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Settings',action:()=>navigateTo('config')},{label:'Security'}]);
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
  {id:'respiracion', label:'Breathing', icon:'🌬', color:'#8affe0', bg:'rgba(138,255,224,.15)'},
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
    <div class="modal-title">${isEdit?'Edit contact':'New contact'}</div>
    <div class="form-grid">
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Emoji / Avatar</div>
          <input type="text" id="ct-emoji" placeholder="◎" value="${escB(it.emoji||'◎')}" maxlength="4" style="font-size:20px;text-align:center">
        </div>
        <div class="form-row">
          <div class="form-label">Name</div>
          <input type="text" id="ct-name" placeholder="Contact name" value="${escB(it.name)}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Relationship with the system</div>
        <input type="text" id="ct-relation" placeholder="E.g. Therapist, Luna's friend, family member…" value="${escB(it.relation||'')}">
      </div>
      <div class="form-row">
        <div class="form-label">Contact information</div>
        <div id="ct-info-list" style="display:flex;flex-direction:column;gap:6px">
          ${edInfo.map((ci,i)=>renderContactInfoRow(ci,i)).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-add-info" style="align-self:flex-start;margin-top:6px">+ Add</button>
      </div>
      <div class="form-row">
        <div class="form-label">Known for</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${alters.map(a=>`<div class="recur-opt${edAlters.includes(a.id)?' selected':''}" data-aid="${a.id}" style="padding:6px 10px;font-size:12px">
            ${a.emoji} ${esc(a.name)}
          </div>`).join('')}
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Secret notes</div>
        <textarea id="ct-note" placeholder="Only visible to the alter who logged it…" rows="3">${escB(it.note||'')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Add'}</button>
    </div>`,
    (ov)=>{
      const name=ov.querySelector('#ct-name').value.trim();
      if(!name) return showToast('⚠ Name is required');
      const entry={id:it.id||uid(),name,emoji:ov.querySelector('#ct-emoji').value.trim()||'◎',
        relation:ov.querySelector('#ct-relation').value.trim(),contactInfo:[...edInfo],
        alterIds:[...edAlters],note:ov.querySelector('#ct-note').value.trim()};
      let list=loadContactos();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveContactos(list); closeModal(); showToast(isEdit?'Contact updated ✓':'Contact added ✓'); _refreshBib('contactos');
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
    <input type="text" data-ci-val="${i}" value="${escB(ci.value)}" placeholder="value…" style="flex:1">
    <button class="icon-btn" data-del-ci="${i}" style="flex-shrink:0">✕</button>
  </div>`;
}

function openRecursoModal(item) {
  const isEdit=!!item;
  const it=item||{title:'',desc:'',url:'',category:'articulo',alterId:activeAlter?.id||'',tags:[]};
  const alters=getAlters();
  let edTags=[...(it.tags||[])];

  openModal(`
    <div class="modal-title">${isEdit?'Edit resource':'New resource'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Title</div>
        <input type="text" id="rc-title" placeholder="Resource name" value="${escB(it.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Description</div>
        <textarea id="rc-desc" placeholder="What is it about? Why is it useful?">${escB(it.desc||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">URL / Enlace</div>
        <input type="url" id="rc-url" placeholder="https://…" value="${escB(it.url||'')}">
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Category</div>
          <select id="rc-cat">
            ${REC_CATS.map(c=>`<option value="${c.id}" ${it.category===c.id?'selected':''}>${c.icon} ${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Recommended by </div>
          <select id="rc-alter">
            <option value="">—</option>
            ${alters.map(a=>`<option value="${a.id}" ${it.alterId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Tags</div>
        <div id="rc-tags-row" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:6px 10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;min-height:36px">
          ${edTags.map((t,i)=>`<span class="tag-pill-rm">${esc(t)}<button data-ti="${i}">✕</button></span>`).join('')}
          <input class="tag-input" id="rc-tag-input" placeholder="tag…" style="flex:1;min-width:60px">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Add'}</button>
    </div>`,
    (ov)=>{
      const title=ov.querySelector('#rc-title').value.trim();
      if(!title) return showToast('⚠ Title is required');
      const entry={id:it.id||uid(),title,desc:ov.querySelector('#rc-desc').value.trim(),
        url:ov.querySelector('#rc-url').value.trim(),category:ov.querySelector('#rc-cat').value,
        alterId:ov.querySelector('#rc-alter').value||null,tags:[...edTags],ts:it.ts||Date.now()};
      let list=loadRecursos();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveRecursos(list); closeModal(); showToast(isEdit?'Resource updated ✓':'Resource added ✓'); _refreshBib('recursos');
    }
  );
  const ov=document.querySelector('.modal-overlay');
  function refreshRcTags(){
    const row=ov.querySelector('#rc-tags-row'); if(!row) return;
    row.innerHTML=`${edTags.map((t,i)=>`<span class="tag-pill-rm">${esc(t)}<button data-ti="${i}">✕</button></span>`).join('')}<input class="tag-input" id="rc-tag-input" placeholder="tag…" style="flex:1;min-width:60px">`;
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
    <div class="modal-title">${isEdit?'Edit document':'New document'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Name</div>
        <input type="text" id="dc-name" placeholder="Document name" value="${escB(it.name)}">
      </div>
      <div class="form-row">
        <div class="form-label">Description</div>
        <textarea id="dc-desc" placeholder="What does this document contain?">${escB(it.desc||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Link / URL (optional)</div>
        <input type="url" id="dc-url" placeholder="https://… or file path." value="${escB(it.url||'')}">
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Category</div>
          <select id="dc-cat">
            ${DOC_CATS.map(c=>`<option value="${c.id}" ${it.category===c.id?'selected':''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Owner</div>
          <select id="dc-alter">
            <option value="">System</option>
            ${alters.map(a=>`<option value="${a.id}" ${it.alterId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Access</div>
        <div style="display:flex;gap:8px">
          <div class="recur-opt${(it.access||'privado')==='privado'?' selected':''}" data-acc="privado" style="flex:1;text-align:center;padding:10px 8px">
            <div style="font-size:16px">🔒</div><div style="font-size:11px;margin-top:4px;font-weight:600">Private</div>
            <div style="font-size:10px;color:var(--text-2);margin-top:2px">Owner only</div>
          </div>
          <div class="recur-opt${it.access==='compartido'?' selected':''}" data-acc="compartido" style="flex:1;text-align:center;padding:10px 8px">
            <div style="font-size:16px">◎</div><div style="font-size:11px;margin-top:4px;font-weight:600">Shared</div>
            <div style="font-size:10px;color:var(--text-2);margin-top:2px">All alters</div>
          </div>
        </div>
        <input type="hidden" id="dc-access" value="${it.access||'privado'}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Add'}</button>
    </div>`,
    (ov)=>{
      const name=ov.querySelector('#dc-name').value.trim();
      if(!name) return showToast('⚠ Name is required');
      const entry={id:it.id||uid(),name,desc:ov.querySelector('#dc-desc').value.trim(),
        url:ov.querySelector('#dc-url').value.trim(),category:ov.querySelector('#dc-cat').value,
        alterId:ov.querySelector('#dc-alter').value||null,access:ov.querySelector('#dc-access').value,
        ts:it.ts||Date.now()};
      let list=loadDocumentos();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveDocumentos(list); closeModal(); showToast(isEdit?'Document updated ✓':'Document added ✓'); _refreshBib('documentos');
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
  {id:'hito',       label:'Milestone',       color:'#a08aff', bg:'rgba(160,138,255,.15)'},
  {id:'cambio',     label:'Change',     color:'#ffb450', bg:'rgba(255,180,80,.15)'},
  {id:'crisis',     label:'Crisis',     color:'#ff7f7f', bg:'rgba(255,127,127,.15)'},
  {id:'logro',      label:'Achievement',      color:'#5fffb0', bg:'rgba(95,255,176,.15)'},
  {id:'reflexion',  label:'Thought',  color:'#ff8ae2', bg:'rgba(255,138,226,.15)'},
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
    <div class="modal-title">◈ Write on the board</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Message to the system</div>
        <textarea id="tablon-msg-text" class="tablon-textarea" placeholder="Write something for all alters to see..." style="min-height:100px"></textarea>
      </div>
      <div class="form-row" style="flex-direction:row;align-items:center;gap:10px">
        <input type="checkbox" id="tablon-pin-check" style="width:16px;height:16px;accent-color:var(--accent)">
        <label for="tablon-pin-check" style="font-size:12px;color:var(--text-1);cursor:pointer">Pin this message (replaces the current pinned message)</label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>Post</button>
    </div>`,
    (ov)=>{
      const text = ov.querySelector('#tablon-msg-text').value.trim();
      if(!text) return showToast('⚠ Write something first.');
      const pinned = ov.querySelector('#tablon-pin-check').checked;
      let msgs = loadTablon();
      // Si se fija, desfijar el anterior
      if(pinned) msgs = msgs.map(m=>({...m, pinned:false}));
      msgs.unshift({id:uid(), alterId:activeAlter.id, text, pinned, ts:Date.now()});
      saveTablon(msgs);
      showToast('Message posted ✓');
      if(onDone) onDone();
    }
  );
}

// ── RENDER PRINCIPAL ──
function renderTablon() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Board'}]);
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
    if(diff < 60000) return 'Right now';
    if(diff < 3600000) return Math.floor(diff/60000)+'m';
    if(d.toDateString()===now.toDateString()) return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  };

  app.innerHTML = `
    <div class="tablon-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◈ System board</div>
          <div class="fin-subtitle">Messages visible to all alters</div>
        </div>
        <button class="btn btn-primary" id="btn-tablon-new">+ Write</button>
      </div>

      ${pinned ? `
      <!-- MENSAJE FIJADO -->
      <div class="tablon-pin">
        <div class="tablon-pin-label">◈ Pinned message</div>
        <div class="tablon-pin-body">${escM(pinned.text)}</div>
        <div class="tablon-pin-meta">
          ${(() => { const a=alters.find(x=>x.id===pinned.alterId)||{emoji:'◎',name:'System',color:'var(--accent)'}; return `<span style="display:flex;align-items:center;gap:6px"><span style="font-size:14px">${a.emoji}</span><span style="font-weight:700;color:${a.color}">${esc(a.name)}</span></span>`; })()}
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
        <textarea id="tablon-inline-text" class="tablon-textarea" placeholder="Write something for the system..."></textarea>
        <div class="tablon-compose-footer">
          <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-2);cursor:pointer">
            <input type="checkbox" id="tablon-inline-pin" style="accent-color:var(--accent)">
            Fijar mensaje
          </label>
          <button class="btn btn-primary" id="btn-tablon-publish" style="margin-left:auto">Post</button>
        </div>
      </div>

      <!-- MENSAJES -->
      ${msgs.filter(m=>!m.pinned).length === 0 && !pinned ? `
      <div class="empty-state" style="padding:40px 20px">
        <div class="empty-icon">◈</div>
        <div>Board is empty</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);margin-top:6px">Be the first to write</div>
      </div>` : `
      <div class="tablon-msg-list">
        ${msgs.filter(m=>!m.pinned).map(m=>{
          const a = alters.find(x=>x.id===m.alterId)||{emoji:'◎',bg:'var(--bg-2)',color:'var(--border)',name:'System'};
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
    if(!text) return showToast('⚠ Write something first');
    const pinned = app.querySelector('#tablon-inline-pin').checked;
    let msgs = loadTablon();
    if(pinned) msgs = msgs.map(m=>({...m,pinned:false}));
    msgs.unshift({id:uid(), alterId:activeAlter.id, text, pinned, ts:Date.now()});
    saveTablon(msgs);
    showToast('Message posted ✓');
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
      showToast('Message pinned ✓');
      renderTablonView();
    });
  });
  app.querySelectorAll('[data-del-msg]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!confirm('Delete this message?')) return;
      saveTablon(loadTablon().filter(m=>m.id!==btn.dataset.delMsg));
      showToast('Message deleted');
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

// ── MODAL SWITCH CONFIRMATION (entering as different alter than current fronter) ──
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
    <div class="modal-title">◉ Register fronting switch?</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
      ${prev ? `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-2);border-radius:8px">
        <div style="width:36px;height:36px;border-radius:50%;background:${prev.bg};border:2px solid ${prev.color};display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">${alterAv(prev,36)}</div>
        <div>
          <div style="font-size:11px;color:var(--text-3);font-family:'DM Mono',monospace">Currently fronting</div>
          <div style="font-weight:800;color:${prev.color}">${prev.name}</div>
        </div>
      </div>` : ''}
      <div style="text-align:center;color:var(--text-3);font-size:18px">↓</div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-2);border-radius:8px;border:1px solid ${a.color}40">
        <div style="width:36px;height:36px;border-radius:50%;background:${a.bg};border:2px solid ${a.color};display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">${alterAv(a,36)}</div>
        <div>
          <div style="font-size:11px;color:var(--text-3);font-family:'DM Mono',monospace">New fronter</div>
          <div style="font-weight:800;color:${a.color}">${esc(a.name)}</div>
        </div>
      </div>
      ${otherAlters.length ? `<div>
        <div style="font-size:11px;color:var(--text-2);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Anyone else fronting? (co-front)</div>
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
      <button class="btn btn-primary" style="width:100%" id="btn-confirm-switch">◉ Yes, register switch</button>
      <button class="btn btn-ghost" style="width:100%" id="btn-cancel-switch">No, just using the app</button>
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
    showToast(`◉ Switch registered → ${a.name}${coLabel}`);
    if (currentView === 'hub') renderHub();
    else if (currentView === 'fronting') renderFronting();
  });
}

// ── MANUAL SWITCH REGISTRATION MODAL (from Fronting module) ──
function openFrontingRegistroManual() {
  const alters = getAlters();
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  openModal(`
    <div class="modal-title">◉ Register switch</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Who is fronting?</div>
        <select id="frs-alter" class="form-input">
          ${alters.map(a => `<option value="${a.id}">${a.emoji || '◎'} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-label">Session start</div>
        <input type="datetime-local" id="frs-start" class="form-input" value="${localISO}">
      </div>
      <div class="form-row">
        <div class="form-label" style="display:flex;align-items:center;gap:8px">
          Session end
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(leave empty = open session)</span>
        </div>
        <input type="datetime-local" id="frs-end" class="form-input" value="">
      </div>
      <div class="form-row">
        <div class="form-label">Note <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(optional)</span></div>
        <textarea id="frs-note" class="front-note-input" placeholder="Context, how they felt, what was happening..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Co-fronting <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(optional)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${alters.map(a => `<label class="front-cofront-chip" style="--chip-color:${a.color};--chip-bg:${a.bg}"><input type="checkbox" data-frs-coid="${a.id}" style="accent-color:${a.color}"><span>${a.emoji || '&#9678;'}</span><span class="front-cofront-chip-name">${esc(a.name)}</span></label>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>Save</button>
    </div>`,
    (ov) => {
      const alterId = ov.querySelector('#frs-alter').value;
      const startVal = ov.querySelector('#frs-start').value;
      const endVal   = ov.querySelector('#frs-end').value;
      const coFronting = [...ov.querySelectorAll('[data-frs-coid]:checked')].map(c => c.dataset.frsCoid).filter(id => id && id !== alterId);
      const note     = ov.querySelector('#frs-note').value.trim();
      if (!alterId || !startVal) { showToast('Missing required fields'); return; }
      const startMs = new Date(startVal).getTime();
      const endMs   = endVal ? new Date(endVal).getTime() : null;
      if (endMs && endMs <= startMs) { showToast('End must be after start'); return; }
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
      showToast('◉ Switch registered ✓');
      renderFrontingView();
    }
  );
}

// ── PERSISTENT FRONTING NOTIFICATION ──
async function fireFrontingNotif(alterId, coFronting) {
  if (!nativeNotifGranted()) return;
  const alters = getAlters();
  const fa = alters.find(a=>a.id===alterId);
  if (!fa) return;
  const coNames = (coFronting||[]).map(id=>alters.find(a=>a.id===id)?.name).filter(Boolean);
  const body = coNames.length ? `Co-fronting: ${coNames.join(', ')}` : 'Active session';
  await fireNativeNotif({
    title: `◉ ${fa.name} fronting`,
    body,
    tag: 'atria-front-active',
    nav: 'fronting',
  });
}

// ── CORE LOGIC ──
function iniciarFronting(alterId, coFronting) {
  const sessions = loadFronting();
  // Close previous open session
  const open = sessions.find(s=>!s.end);
  if(open) { open.end = Date.now(); open.duration = open.end - open.start; }
  // Open new session
  sessions.push({id:uid(), alterId, coFronting: coFronting||[], start:Date.now(), end:null, duration:null, note:''});
  saveFronting(sessions);
  // Persistent notification (non-blocking)
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
    <div class="modal-title">Session note</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Note visible in history</div>
        <textarea id="front-note-val" class="front-note-input" placeholder="How you feel, what you are doing, notes for the system...">${note}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>Save</button>
    </div>`,
    (ov)=>{
      setFrontingNote(ov.querySelector('#front-note-val').value.trim());
      showToast('Note saved ✓');
      if(currentView==='hub') renderHub();
      else if(currentView==='fronting') renderFronting();
    }
  );
}

function openQuickSwitchModal() {
  const alters = getAlters();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal" style="max-width:480px">
    <div class="modal-title">⇄ Quick switch</div>
    <div class="form-label" style="margin-bottom:8px">Select alter to bring to front</div>
    <div id="qs-alter-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      ${alters.map(a=>`
        <div class="front-cofront-chip" data-qsid="${a.id}"
          style="--chip-color:${a.color};--chip-bg:${a.bg}">
          <span style="font-size:18px">${a.emoji||'◎'}</span>
          <span class="front-cofront-chip-name">${esc(a.name)}</span>
        </div>`).join('')}
    </div>
    <div id="qs-cofront-section" style="display:none">
      <div class="form-label" style="margin-bottom:8px">Co-fronting (optional)</div>
      <div id="qs-cofront-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" id="btn-qs-confirm" disabled>◉ Register switch</button>
    </div>
  </div>`;

  let selectedId = null;
  const coSelected = new Set();

  const grid = ov.querySelector('#qs-alter-grid');
  const coSection = ov.querySelector('#qs-cofront-section');
  const coGrid = ov.querySelector('#qs-cofront-grid');
  const btnConfirm = ov.querySelector('#btn-qs-confirm');

  grid.querySelectorAll('[data-qsid]').forEach(chip=>{
    chip.addEventListener('click',()=>{
      selectedId = chip.dataset.qsid;
      grid.querySelectorAll('[data-qsid]').forEach(c=>c.classList.toggle('active', c.dataset.qsid===selectedId));
      btnConfirm.disabled = false;
      coSelected.clear();
      coGrid.innerHTML = alters.filter(a=>a.id!==selectedId).map(a=>`
        <div class="front-cofront-chip" data-qscoid="${a.id}"
          style="--chip-color:${a.color};--chip-bg:${a.bg}">
          <span style="font-size:15px">${a.emoji||'◎'}</span>
          <span class="front-cofront-chip-name">${esc(a.name)}</span>
        </div>`).join('');
      coGrid.querySelectorAll('[data-qscoid]').forEach(c=>{
        c.addEventListener('click',()=>{
          const cid = c.dataset.qscoid;
          if(coSelected.has(cid)) coSelected.delete(cid); else coSelected.add(cid);
          c.classList.toggle('active', coSelected.has(cid));
        });
      });
      coSection.style.display = alters.filter(a=>a.id!==selectedId).length ? '' : 'none';
    });
  });

  btnConfirm.addEventListener('click',()=>{
    if(!selectedId) return;
    iniciarFronting(selectedId, [...coSelected]);
    document.body.removeChild(ov);
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
    if(currentView==='hub') renderHub();
    else if(currentView==='fronting') renderFronting();
    showToast('Switch registered ✓');
  });

  ov.querySelector('[data-cancel]').addEventListener('click',()=>document.body.removeChild(ov));
  ov.addEventListener('click',e=>{ if(e.target===ov) document.body.removeChild(ov); });
  document.body.appendChild(ov);
}

// ── RENDER PRINCIPAL ──
let frontingTab = 'actual'; // 'actual' | 'historial' | 'timeline' | 'stats' | 'planif'
let _histFilterAlterId = null; // active filter in history tab
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
          <div class="fin-subtitle">Presence record at the front of the system</div>
        </div>
        <button class="btn btn-primary" id="btn-front-switch">⇄ Switch alter</button>
      </div>

      <div class="mem-tabs">
        ${[
          {id:'actual',    label:'◉ Now'},
          {id:'historial', label:'◌ History'},
          {id:'timeline',  label:'◫ Timeline'},
          {id:'stats',     label:'◈ Statistics'},
          {id:'planif',    label:'◷ Schedule'},
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
      <div>No active session</div>
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);margin-top:6px;margin-bottom:16px">Select an alter on entry or register a switch manually</div>
      <button class="btn btn-primary" id="btn-front-manual">◉ Register switch</button>
    </div>`;
    cont.querySelector('#btn-front-manual')?.addEventListener('click', openFrontingRegistroManual);
    return;
  }
  const fa = alters.find(a=>a.id===current.alterId);
  if(!fa) { cont.innerHTML='<div class="empty-state">Alter not found</div>'; return; }

  const ms = Date.now()-current.start;
  const m = Math.floor(ms/60000); const h=Math.floor(m/60);
  const elapsed = h>0 ? h+'h '+(m%60)+'m' : m+'m';

  const coAlters = (current.coFronting||[]).map(cid=>alters.find(a=>a.id===cid)).filter(Boolean);

  cont.innerHTML=`
    <!-- PANEL PRINCIPAL -->
    <div class="front-panel">
      <div class="front-panel-label">◉ Currently fronting</div>
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
        <div class="form-label" style="margin-bottom:6px">Session note</div>
        <textarea id="front-session-note" class="front-note-input" placeholder="How you feel, what you are doing...">${current.note||''}</textarea>
        <button class="btn btn-ghost" id="btn-save-note" style="margin-top:6px;font-size:11px">Save note</button>
      </div>

      <!-- SESSION STATE -->
      <div>
        <div class="form-label" style="margin-bottom:8px">Session state <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(optional)</span></div>
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
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">Select:</span>
          ${alters.filter(a=>a.id!==fa.id).map(a=>`
            <div class="front-cofront-chip${(current.coFronting||[]).includes(a.id)?' active':''}" data-caid="${a.id}"
              style="--chip-color:${a.color};--chip-bg:${a.bg}">
              <span style="font-size:15px">${a.emoji}</span>
              <span class="front-cofront-chip-name">${esc(a.name)}</span>
            </div>
          `).join('')}
          ${alters.filter(a=>a.id!==fa.id).length===0?'<span style="font-size:11px;color:var(--text-3)">There are no other alters</span>':''}
        </div>
        ${coAlters.length?`<div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">Also fronting:</span>
          ${coAlters.map(ca=>`<span style="font-size:12px;padding:3px 8px;background:${ca.bg};border:1px solid ${ca.color}40;border-radius:5px;font-weight:700">${ca.emoji} ${ca.name}</span>`).join('')}
        </div>`:''}
      </div>
    </div>

    <!-- GUARDAR PRESET + INICIO DE SESIÓN -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:4px 0">
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);display:flex;gap:16px;flex-wrap:wrap">
      <span>Start: ${new Date(current.start).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
      <span>·</span>
      <span>Duration: <span data-live-dur>${elapsed}</span></span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="btn-front-manual-panel">◉ Register another switch</button>
        <button class="btn btn-ghost btn-sm" id="btn-save-preset">◈ Save combination</button>
      </div>
    </div>`;

  // Wire session state chips
  cont.querySelectorAll('.front-cofront-chip[data-fstate]').forEach(el=>{
    el.addEventListener('click',()=>{
      setFrontingCustomState(el.dataset.fstate);
      renderFrontingView();
    });
  });
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
    showToast('Note saved ✓');
  });
  // Wire guardar combinación
  cont.querySelector('#btn-save-preset')?.addEventListener('click',()=>openSavePresetModal(current, alters));
  // Wire registro manual desde panel activo
  cont.querySelector('#btn-front-manual-panel')?.addEventListener('click', openFrontingRegistroManual);

  // Live timer: update elapsed every 60s
  if (_frontTimerInterval) clearInterval(_frontTimerInterval);
  _frontTimerInterval = setInterval(() => {
    const timerEl = cont.querySelector('.front-timer');
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
    <div class="form-label" style="margin-bottom:8px">◈ Saved combinations</div>
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
            <button class="icon-btn" data-del-preset="${p.id}" title="Delete">✕</button>
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
      showToast('◉ Combination applied ✓');
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
    <div class="modal-title">✎ Edit entry</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Who is fronting?</div>
        <select id="fe-alter" class="form-input">
          ${alters.map(a=>`<option value="${a.id}"${a.id===s.alterId?' selected':''}>${a.emoji||'◎'} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-label">Start</div>
        <input type="datetime-local" id="fe-start" class="form-input" value="${toLocal(s.start)}">
      </div>
      <div class="form-row">
        <div class="form-label">End <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(empty = open session)</span></div>
        <input type="datetime-local" id="fe-end" class="form-input" value="${s.end?toLocal(s.end):''}">
      </div>
      <div class="form-row">
        <div class="form-label">Note</div>
        <textarea id="fe-note" class="front-note-input">${s.note||''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Co-fronting <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">(optional)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${alters.map(a => `<label class="front-cofront-chip${(s.coFronting||[]).includes(a.id)?' active':''}" style="--chip-color:${a.color};--chip-bg:${a.bg}"><input type="checkbox" data-fe-coid="${a.id}" ${(s.coFronting||[]).includes(a.id)?'checked':''} style="accent-color:${a.color}"><span>${a.emoji || '&#9678;'}</span><span class="front-cofront-chip-name">${esc(a.name)}</span></label>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>Save</button>
    </div>`,
    (ov) => {
      const alterId  = ov.querySelector('#fe-alter').value;
      const startVal = ov.querySelector('#fe-start').value;
      const endVal   = ov.querySelector('#fe-end').value;
      const coFronting = [...ov.querySelectorAll('[data-fe-coid]:checked')].map(c => c.dataset.feCoid).filter(id => id && id !== alterId);
      const note     = ov.querySelector('#fe-note').value.trim();
      if (!startVal) { showToast('Start date required'); return; }
      const startMs = new Date(startVal).getTime();
      const endMs   = endVal ? new Date(endVal).getTime() : null;
      if (endMs && endMs <= startMs) { showToast('End must be after start'); return; }
      const idx = sessions.findIndex(x=>x.id===sid);
      if (idx === -1) return;
      sessions[idx] = { ...sessions[idx], alterId, coFronting, start: startMs, end: endMs, duration: endMs ? endMs-startMs : null, note };
      saveFronting(sessions);
      showToast('Entry updated ✓');
      renderFrontingView();
    }
  );
}

function renderFrontHistorial(cont, alters, sessions) {
  if(!sessions.length) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">◌</div>
      <div>No history yet</div>
    </div>`;
    return;
  }

  // Filter by alter
  const filtered = _histFilterAlterId ? sessions.filter(s=>s.alterId===_histFilterAlterId) : sessions;

  // Group by day
  const byDay = {};
  filtered.forEach(s=>{
    const key = new Date(s.start).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    if(!byDay[key]) byDay[key]=[];
    byDay[key].push(s);
  });

  // Filter chips by alter (only alters with history)
  const alterIds = [...new Set(sessions.map(s=>s.alterId))];

  cont.innerHTML=`
    <!-- FILTER BY ALTER -->
    <div class="front-hist-filter">
      <div class="front-hist-filter-chip${!_histFilterAlterId?' active':''}" data-faid="">All</div>
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
          const startStr = new Date(s.start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
          const endStr   = s.end ? new Date(s.end).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : 'active';
          const durMs    = s.duration || 0;
          return `<div class="front-hist-card" style="--hist-color:${fa.color}">
            <div class="front-hist-color-bar" style="background:${fa.color}"></div>
            <div class="front-hist-av" style="background:${fa.bg};border-color:${fa.color};overflow:hidden">${alterAv(fa,36)}</div>
            <div class="front-hist-body">
              <div class="front-hist-name" style="color:${fa.color}">${fa.name}</div>
              <div class="front-hist-meta">
                <span>🕐 ${startStr} → ${endStr}</span>
                ${durMs?`<span class="front-hist-dur">◷ ${fmtFrontDuration(durMs)}</span>`:'<span class="front-hist-dur" style="color:var(--accent)">active</span>'}
              </div>
              ${co.length?`<div class="front-hist-cofront">
                <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">co-front:</span>
                ${co.map(ca=>`<span style="font-size:11px;padding:1px 6px;background:${ca.bg};border:1px solid ${ca.color}33;border-radius:4px;font-weight:700;color:${ca.color}">${ca.emoji} ${ca.name}</span>`).join('')}
              </div>`:''}
              ${s.customState ? (() => { const cs = FRONT_CUSTOM_STATES.find(x=>x.id===s.customState); return cs ? `<div class="front-hist-note" style="color:var(--accent-2)">${cs.icon} ${cs.label}</div>` : ''; })() : ''}
              ${s.note?`<div class="front-hist-note">💬 ${s.note}</div>`:''}
            </div>
            <div class="front-hist-actions">
              <button class="icon-btn" data-edit-front="${s.id}" title="Edit">✎</button>
              <button class="icon-btn" data-del-front="${s.id}" title="Delete">✕</button>
            </div>
          </div>`;
        }).join('')}
      `).join('') : `<div class="empty-state" style="padding:30px 20px"><div>No entries for this alter</div></div>`}
    </div>`;

  // Filter
  cont.querySelectorAll('[data-faid]').forEach(chip=>{
    chip.addEventListener('click',()=>{
      _histFilterAlterId = chip.dataset.faid || null;
      renderFrontingView();
    });
  });

  // Edit
  cont.querySelectorAll('[data-edit-front]').forEach(btn=>{
    btn.addEventListener('click',()=>openEditFrontModal(btn.dataset.editFront, alters));
  });

  // Delete
  cont.querySelectorAll('[data-del-front]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      openModal(`
        <div class="modal-title">Delete entry</div>
        <div style="color:var(--text-2);font-size:13px;margin-bottom:16px">This history entry will be permanently deleted.</div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-cancel>Cancel</button>
          <button class="btn btn-danger" data-submit>Delete</button>
        </div>`,
        () => {
          const list = loadFronting().filter(s=>s.id!==btn.dataset.delFront);
          saveFronting(list);
          showToast('Entry deleted');
          renderFrontingView();
        }
      );
    });
  });
}

// ── TAB TIMELINE (GANTT) ──
function renderFrontTimeline(cont, alters, sessions) {
  if (!sessions.length) {
    cont.innerHTML = `<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">◫</div>
      <div>No history yet</div>
    </div>`;
    return;
  }

  // Range: last 7 days by default, adjustable
  const rangeOptions = [
    {id:'1d', label:'Today',    ms: 86400000},
    {id:'3d', label:'3 days',   ms: 3*86400000},
    {id:'7d', label:'7 days',   ms: 7*86400000},
    {id:'30d',label:'30 days',  ms: 30*86400000},
  ];
  if (!cont._ganttRange) cont._ganttRange = '7d';
  const selRange   = rangeOptions.find(r=>r.id===cont._ganttRange) || rangeOptions[2];
  const rangeEnd   = Date.now();
  const rangeStart = rangeEnd - selRange.ms;

  // Sessions in range (including those that started before and are still active or overlap)
  const inRange = sessions.filter(s => (s.end||rangeEnd) >= rangeStart && s.start <= rangeEnd);

  // Alters with activity in range
  const activeIds = [...new Set(inRange.map(s=>s.alterId))];
  const activeAlters = activeIds.map(id=>alters.find(a=>a.id===id)).filter(Boolean);

  // Position helpers
  const rangeDur = rangeEnd - rangeStart;
  const pct  = (ts) => Math.max(0, Math.min(100, (ts - rangeStart) / rangeDur * 100));
  const pctW = (start, end) => Math.max(0.3, pct(Math.min(end, rangeEnd)) - pct(Math.max(start, rangeStart)));

  // X-axis labels (hours or days depending on range)
  const xLabels = [];
  if (selRange.ms <= 86400000) {
    // Today: every 3 hours
    for (let h = 0; h <= 24; h += 3) {
      const ts = rangeStart + (h/24)*rangeDur;
      xLabels.push({pct: h/24*100, label: new Date(ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})});
    }
  } else if (selRange.ms <= 3*86400000) {
    // 3 days: every 12h
    for (let i = 0; i <= selRange.ms; i += 12*3600000) {
      const ts = rangeStart + i;
      xLabels.push({pct: i/rangeDur*100, label: new Date(ts).toLocaleDateString('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit'})});
    }
  } else {
    // 7-30 days: by day
    const d = new Date(rangeStart); d.setHours(0,0,0,0);
    while (d.getTime() <= rangeEnd) {
      xLabels.push({pct: pct(d.getTime()), label: new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'})});
      d.setDate(d.getDate()+1);
    }
  }

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">

      <!-- RANGE SELECTOR -->
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${rangeOptions.map(r=>`
          <button class="btn btn-sm${r.id===selRange.id?' btn-primary':' btn-ghost'}" data-gantt-range="${r.id}">${r.label}</button>
        `).join('')}
      </div>
      ${activeAlters.length === 0 ? `<div class="empty-state" style="padding:30px 20px"><div>No activity in this period</div></div>` : `
      <div class="front-gantt-wrap">

        <!-- Alter names (left column) -->
        <div class="front-gantt-labels">
          ${activeAlters.map(a=>`
            <div class="front-gantt-label-row">
              <div class="front-gantt-av" style="background:${a.bg};border-color:${a.color};overflow:hidden">${alterAv(a,22)}</div>
              <span class="front-gantt-name" style="color:${a.color}">${esc(a.name)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Bar area -->
        <div class="front-gantt-area">

          <!-- X axis -->
          <div class="front-gantt-xaxis">
            ${xLabels.map(l=>`<div class="front-gantt-xlabel" style="left:${l.pct}%">${l.label}</div>`).join('')}
          </div>

          <!-- Grid lines -->
          <div class="front-gantt-grid">
            ${xLabels.map(l=>`<div class="front-gantt-gridline" style="left:${l.pct}%"></div>`).join('')}
          </div>

          <!-- Rows per alter -->
          ${activeAlters.map(a=>{
            const alterSessions = inRange.filter(s=>s.alterId===a.id);
            return `<div class="front-gantt-row">
              ${alterSessions.map(s=>{
                const left  = pct(Math.max(s.start, rangeStart));
                const width = pctW(s.start, s.end||rangeEnd);
                const isActive = !s.end;
                const dur   = fmtFrontDuration(s.duration || (Date.now()-s.start));
                const startLbl = new Date(s.start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
                const endLbl   = s.end ? new Date(s.end).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : 'active';
                const coIds = (s.coFronting||[]);
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
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-align:right">◉ now = right edge</div>`}
    </div>`;

  // Range selector
  cont.querySelectorAll('[data-gantt-range]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      cont._ganttRange = btn.dataset.ganttRange;
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
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px"><div class="empty-icon">◈</div><div>No data yet</div></div>`;
    return;
  }

  const total = sessions.reduce((s,x)=>s+(x.duration||0),0);
  const now   = Date.now();

  // By alter
  const byAlter = {};
  sessions.forEach(s=>{
    if(!byAlter[s.alterId]) byAlter[s.alterId]={duration:0,count:0,longest:0,last:0};
    byAlter[s.alterId].duration += s.duration||0;
    byAlter[s.alterId].count++;
    if((s.duration||0) > byAlter[s.alterId].longest) byAlter[s.alterId].longest = s.duration||0;
    if(s.start > byAlter[s.alterId].last) byAlter[s.alterId].last = s.start;
  });
  const sorted = Object.entries(byAlter).sort((a,b)=>b[1].duration-a[1].duration);

  // Longest session overall
  const longestSession = sessions.reduce((best,s)=>((s.duration||0)>(best.duration||0)?s:best), sessions[0]);
  const longestAlter   = alters.find(a=>a.id===longestSession.alterId);

  // Last 7 days (stacked by alter)
  const days7 = Array.from({length:7},(_,i)=>{
    const d = new Date(now-(6-i)*86400000);
    return {label:d.toLocaleDateString('en-GB',{weekday:'short'}), date:d.toDateString(), byAlt:{}};
  });
  sessions.forEach(s=>{
    const d = new Date(s.start).toDateString();
    const day = days7.find(x=>x.date===d);
    if(day){ if(!day.byAlt[s.alterId]) day.byAlt[s.alterId]=0; day.byAlt[s.alterId]+=s.duration||0; }
  });
  const maxDayMs = Math.max(...days7.map(d=>Object.values(d.byAlt).reduce((a,b)=>a+b,0)),1);

  // Alter detail view (local state)
  if (!cont._statsAlterId) cont._statsAlterId = null;
  const detailAid    = cont._statsAlterId;
  const detailAlter  = detailAid ? alters.find(a=>a.id===detailAid) : null;
  const detailSessions = detailAid ? sessions.filter(s=>s.alterId===detailAid) : [];

  cont.innerHTML=`
    <div style="display:flex;flex-direction:column;gap:18px">

      <div class="hub-widget">
        <div class="hw-header"><div class="hw-icon" style="color:var(--accent);background:rgba(160,138,255,.1)">⌕</div><div class="hw-title">Date range</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
          <label class="form-row" style="flex:1;min-width:140px"><span class="form-label">From</span><input class="form-input" type="date" id="stats-from" value="${statsFrom}"></label>
          <label class="form-row" style="flex:1;min-width:140px"><span class="form-label">To</span><input class="form-input" type="date" id="stats-to" value="${statsTo}"></label>
          <button class="btn btn-ghost btn-sm" id="stats-clear-range">All time</button>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:6px">${statsFrom || statsTo ? `${sessions.length} sessions in selected range` : 'All completed sessions'}</div>
      </div>

      <!-- GLOBAL STATS -->
      <div class="front-stat-grid">
        <div class="front-stat"><div class="front-stat-val" style="color:var(--accent)">${sessions.length}</div><div class="front-stat-label">Total sessions</div></div>
        <div class="front-stat"><div class="front-stat-val" style="color:var(--accent-3)">${fmtFrontDuration(total)}</div><div class="front-stat-label">Total time</div></div>
        <div class="front-stat"><div class="front-stat-val" style="color:var(--accent-4)">${sorted.length}</div><div class="front-stat-label">Active alters</div></div>
        <div class="front-stat"><div class="front-stat-val" style="color:var(--accent-2)">${fmtFrontDuration(Math.round(total/sessions.length))}</div><div class="front-stat-label">Avg duration</div></div>
      </div>

      ${longestAlter ? `
      <div class="front-stat" style="background:var(--bg-2);flex-direction:row;align-items:center;gap:12px;padding:12px 16px">
        <div style="width:32px;height:32px;border-radius:50%;background:${longestAlter.bg};border:2px solid ${longestAlter.color};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;overflow:hidden">${alterAv(longestAlter,32)}</div>
        <div style="flex:1">
          <div style="font-size:11px;font-weight:800;color:${longestAlter.color}">${longestAlter.name}</div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">Longest session · ${fmtFrontDuration(longestSession.duration)}</div>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${new Date(longestSession.start).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
      </div>` : ''}

      <!-- 7-DAY CHART (stacked) -->
      <div class="hub-widget">
        <div class="hw-header">
          <div class="hw-icon" style="color:var(--accent);background:rgba(160,138,255,.1)">◷</div>
          <div class="hw-title">Activity — last 7 days</div>
        </div>
        <div class="front-bar-chart">
          ${days7.map(d=>{
            const total7 = Object.values(d.byAlt).reduce((a,b)=>a+b,0);
            const h = Math.max(total7/maxDayMs*100, total7?6:2);
            // Stacked: sort by most active alter first
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

      <!-- BREAKDOWN BY ALTER (clickable → detail) -->
      <div class="hub-widget">
        <div class="hw-header">
          <div class="hw-icon" style="color:var(--accent-2);background:rgba(255,138,226,.1)">◎</div>
          <div class="hw-title">By alter <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">— tap to see detail</span></div>
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
                  <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${st.count} sessions · ${fmtFrontDuration(st.duration)} · avg ${fmtFrontDuration(Math.round(st.duration/st.count))}</div>
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

      <!-- SELECTED ALTER DETAIL -->
      ${detailAlter ? `
      <div class="hub-widget" id="stat-alter-detail">
        <div class="hw-header">
          <div class="front-hist-av" style="background:${detailAlter.bg};border-color:${detailAlter.color};overflow:hidden;width:28px;height:28px;border-radius:50%;border:1.5px solid;display:flex;align-items:center;justify-content:center;font-size:14px">${alterAv(detailAlter,28)}</div>
          <div class="hw-title" style="color:${detailAlter.color}">${detailAlter.name} — own history</div>
          <button class="icon-btn" id="btn-close-stat-detail" style="margin-left:auto">✕</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto">
          ${detailSessions.slice(0,20).map(s=>{
            const co = (s.coFronting||[]).map(cid=>alters.find(a=>a.id===cid)).filter(Boolean);
            const startStr = new Date(s.start).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
            const endStr   = s.end ? new Date(s.end).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : 'active';
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-2);border-radius:7px;border-left:3px solid ${detailAlter.color}">
              <div style="flex:1;min-width:0">
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">${startStr} → ${endStr}</div>
                ${co.length?`<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">co: ${co.map(ca=>ca.name).join(', ')}</div>`:''}
                ${s.note?`<div style="font-size:11px;color:var(--text-1);margin-top:2px">${s.note}</div>`:''}
              </div>
              <div style="font-family:'DM Mono',monospace;font-size:10px;color:${detailAlter.color};flex-shrink:0">${fmtFrontDuration(s.duration)}</div>
            </div>`;
          }).join('')}
          ${detailSessions.length>20?`<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);text-align:center;padding:6px">+${detailSessions.length-20} more in History</div>`:''}
        </div>
      </div>` : ''}

    </div>`;

  cont.querySelector('#stats-from')?.addEventListener('change', e=>{ cont._statsFrom=e.target.value; renderFrontStats(cont, alters, allSessions); });
  cont.querySelector('#stats-to')?.addEventListener('change', e=>{ cont._statsTo=e.target.value; renderFrontStats(cont, alters, allSessions); });
  cont.querySelector('#stats-clear-range')?.addEventListener('click',()=>{ cont._statsFrom=''; cont._statsTo=''; renderFrontStats(cont, alters, allSessions); });

  // Click on alter → detail
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

// ── TAB SCHEDULE ──
function renderFrontPlanif(cont, alters) {
  const schedule = loadFrontSchedule();
  const today = new Date().toISOString().slice(0,10);
  // Show next 14 days
  const days = [];
  for (let i=0; i<14; i++) {
    const d = new Date(); d.setDate(d.getDate()+i);
    days.push(d.toISOString().slice(0,10));
  }
  const fmt = d => { const [y,m,dy]=d.split('-'); return `${dy}/${m}/${y}`; };
  const alterName = id => alters.find(a=>a.id===id)?.name || '?';
  const STATUS_LABEL = {scheduled:'Scheduled', done:'Done', skipped:'Skipped'};
  const STATUS_COLOR = {scheduled:'var(--accent-4)', done:'var(--green)', skipped:'var(--text-3)'};

  const upcoming = schedule.filter(b=>b.date>=today).sort((a,b)=>a.date.localeCompare(b.date)||(a.startTime||'').localeCompare(b.startTime||''));
  const past     = schedule.filter(b=>b.date<today).sort((a,b)=>b.date.localeCompare(a.date));

  cont.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary" id="btn-new-schedule">+ New block</button>
    </div>
    ${!upcoming.length && !past.length ? `<div class="empty-state" style="padding:60px 20px"><div class="empty-icon">◷</div><div>No scheduled blocks</div></div>` : ''}
    ${upcoming.length ? `
      <div class="analisis-section-title" style="margin-bottom:8px">Upcoming</div>
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
        <summary style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);cursor:pointer;padding:6px 2px;letter-spacing:.1em;text-transform:uppercase">↓ History (${past.length})</summary>
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
    showToast('Block deleted');
    renderFrontingView();
  }));
}

function openFrontScheduleModal(entry, alters) {
  const isEdit = !!entry;
  const today  = new Date().toISOString().slice(0,10);
  const b      = entry || {id:uid(), date:today, startTime:'', endTime:'', alterId:'', coAlterIds:[], note:'', status:'scheduled'};
  const STATUSES = [{id:'scheduled',label:'Scheduled'},{id:'done',label:'Done'},{id:'skipped',label:'Skipped'}];

  openModal(`
    <div class="modal-header"><span>${isEdit?'Edit block':'New fronting block'}</span><button class="modal-close" id="ms-close">✕</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label class="field-label">Main alter *</label>
        <select id="ms-alter" class="input">
          <option value="">— Select —</option>
          ${alters.map(a=>`<option value="${a.id}"${a.id===b.alterId?' selected':''}>${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div>
          <label class="field-label">Date *</label>
          <input id="ms-date" class="input" type="date" value="${b.date}">
        </div>
        <div>
          <label class="field-label">Start</label>
          <input id="ms-start" class="input" type="time" value="${b.startTime}">
        </div>
        <div>
          <label class="field-label">End</label>
          <input id="ms-end" class="input" type="time" value="${b.endTime}">
        </div>
      </div>
      <div>
        <label class="field-label">Co-fronting (optional)</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${alters.filter(a=>a.id!==b.alterId).map(a=>`
            <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer">
              <input type="checkbox" value="${a.id}" ${(b.coAlterIds||[]).includes(a.id)?'checked':''} class="ms-co"> ${esc(a.name)}
            </label>`).join('')}
        </div>
      </div>
      <div>
        <label class="field-label">Status</label>
        <select id="ms-status" class="input">
          ${STATUSES.map(s=>`<option value="${s.id}"${s.id===b.status?' selected':''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">Note</label>
        <input id="ms-note" class="input" placeholder="Optional context…" value="${b.note||''}">
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
        <button class="btn btn-ghost" id="ms-cancel">Cancel</button>
        <button class="btn btn-primary" id="ms-save">Save</button>
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
    if(!alterId || !date) { showToast('⚠ Choose an alter and date'); return; }
    const list = loadFrontSchedule();
    const upd  = {...b, alterId, date, startTime, endTime, status, note, coAlterIds};
    if(isEdit) { const i=list.findIndex(x=>x.id===b.id); if(i>=0) list[i]=upd; else list.push(upd); }
    else list.push(upd);
    saveFrontSchedule(list);
    closeModal();
    showToast(isEdit?'Block updated ✓':'Block created ✓');
    renderFrontingView();
  });
}

// ═══════════════════════════════════════════════
let memoriaTab = 'actividad'; // 'actividad' | 'timeline' | 'cambios' | 'integracion'
let alteresTab = 'perfiles'; // 'perfiles' | 'fichas'
let alteresViewMode = 'cards'; // 'cards' | 'list'
let alteresSortMode = 'default'; // 'default' | 'alpha' | 'date'
let alteresRoleFilter = ''; // '' = all, or ROLE_TYPES id

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
  const tabLabel = {actividad:'Activity',timeline:'Timeline',cambios:'Changes',integracion:'Integration'};
  if(!['actividad','timeline','cambios','integracion'].includes(memoriaTab)) memoriaTab='actividad';
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Memory · '+(tabLabel[memoriaTab]||'')}]);
  renderMemoriaView();
}

function renderMemoriaView() {
  const app    = document.getElementById('app');
  const alters = getAlters();

  const btnLabel = {
    timeline:'+ Add', cambios:'+ Add', integracion:'+ Add',
    actividad:null
  }[memoriaTab];

  app.innerHTML = `
    <div class="mem-view">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◌ Memory</div>
          <div class="fin-subtitle">System history</div>
        </div>
        ${btnLabel?`<button class="btn btn-primary" id="btn-mem-new">${btnLabel}</button>`:''}
      </div>

      <div class="mem-tabs">
        ${[
          {id:'actividad',   label:'◷ Activity'},
          {id:'timeline',    label:'◌ Timeline'},
          {id:'cambios',     label:'◑ Changes'},
          {id:'integracion', label:'◐ Integration'},
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
      <div>No sessions recorded</div>
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);margin-top:6px">
        Log is automatically activated when changing to alter
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
    return {label:d.toLocaleDateString('en-GB',{weekday:'short'}), date:d.toDateString(), count:0};
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
    const key=new Date(s.start).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
    if(!byDay[key]) byDay[key]=[];
    byDay[key].push(s);
  });

  cont.innerHTML = `
    <!-- STATS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px">
      <div class="wish-stat">
        <div class="wish-stat-val" style="color:var(--accent)">${sessions.length}</div>
        <div class="wish-stat-label">Total sessions</div>
      </div>
      <div class="wish-stat">
        <div class="wish-stat-val" style="color:var(--accent-3)">${fmtDuration(totalDuration)}</div>
        <div class="wish-stat-label">Total time</div>
      </div>
      <div class="wish-stat">
        <div class="wish-stat-val" style="color:var(--accent-4)">${Object.keys(statsByAlter).length}</div>
        <div class="wish-stat-label">Active alters</div>
      </div>
    </div>

    <!-- MINI CHART -->
    <div class="hub-widget" style="margin-bottom:16px">
      <div class="hw-header">
        <div class="hw-icon" style="color:var(--accent);background:rgba(160,138,255,.1)">◷</div>
        <div class="hw-title">Activity last 7 days</div>
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
          const start=new Date(s.start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
          const end=s.end?new Date(s.end).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'activa';
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
      <div>Empty timeline</div>
      <button class="btn btn-primary" style="margin-top:8px" id="btn-tl-add">Add first event</button>
    </div>`;
    cont.querySelector('#btn-tl-add')?.addEventListener('click',()=>openTimelineModal(null));
    return;
  }

  cont.innerHTML=`<div class="timeline">
    ${items.map(item=>{
      const typ=TL_TYPES.find(t=>t.id===item.type)||TL_TYPES[0];
      const d=new Date(item.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
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
              <button class="icon-btn btn-tl-edit" data-tlid="${item.id}" title="Edit">✎</button>
              <button class="icon-btn btn-tl-del"  data-tlid="${item.id}" title="Delete">✕</button>
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
    if(!confirm('Delete this event?')) return;
    saveTimeline(loadTimeline().filter(x=>x.id!==b.dataset.tlid));
    showToast('Event deleted'); renderMemoriaView();
  }));
}

// ════ TAB CAMBIOS ════
function renderCambiosTab(cont, alters) {
  const items = loadCambios().sort((a,b)=>b.date.localeCompare(a.date));

  if(items.length===0) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">◑</div>
      <div>No changes recorded</div>
      <button class="btn btn-primary" style="margin-top:8px" id="btn-cambio-add">Log change</button>
    </div>`;
    cont.querySelector('#btn-cambio-add')?.addEventListener('click',()=>openCambioModal(null));
    return;
  }

  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:10px">
    ${items.map(item=>{
      const imp=CAMBIO_IMPORTANCE.find(i=>i.id===item.importance)||CAMBIO_IMPORTANCE[1];
      const alt=alters.find(a=>a.id===item.alterId);
      const d=new Date(item.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
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
    if(!confirm('Delete this change?')) return;
    saveCambios(loadCambios().filter(x=>x.id!==b.dataset.cid));
    showToast('Change deleted'); renderMemoriaView();
  }));
}

// ════ TAB INTEGRACIÓN ════
function renderIntegTab(cont, alters) {
  const items = loadIntegracion().sort((a,b)=>b.ts-a.ts);

  if(items.length===0) {
    cont.innerHTML=`<div class="empty-state" style="padding:50px 20px">
      <div class="empty-icon">◐</div>
      <div>No integration notes</div>
      <button class="btn btn-primary" style="margin-top:8px" id="btn-integ-add">New note</button>
    </div>`;
    cont.querySelector('#btn-integ-add')?.addEventListener('click',()=>openIntegModal(null));
    return;
  }

  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:10px">
    ${items.map(item=>{
      const a1=alters.find(a=>a.id===item.alter1Id);
      const a2=item.alter2Id?alters.find(a=>a.id===item.alter2Id):null;
      const d=new Date(item.ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
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
    if(!confirm('Delete this note?')) return;
    saveIntegracion(loadIntegracion().filter(x=>x.id!==b.dataset.iid));
    showToast('Note deleted'); renderMemoriaView();
  }));
}

function escM(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

function getAutoDeviceName() {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (/Edg\//.test(ua))               browser = 'Edge';
  else if (/OPR\//.test(ua))          browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Browser';
  else if (/Chrome\//.test(ua))       browser = 'Chrome';
  else if (/Firefox\//.test(ua))      browser = 'Firefox';
  else if (/Safari\//.test(ua))       browser = 'Safari';
  let os = 'device';
  if (/Android/.test(ua))             os = 'Android';
  else if (/iPhone|iPad/.test(ua))    os = 'iOS';
  else if (/Win/.test(ua))            os = 'Windows';
  else if (/Mac/.test(ua))            os = 'macOS';
  else if (/Linux/.test(ua))          os = 'Linux';
  return `${browser} on ${os}`;
}

// ════ MODALES ════
function openTimelineModal(item) {
  const isEdit=!!item;
  const it=item||{title:'',body:'',type:'hito',date:new Date().toISOString().slice(0,10),tags:[],alterId:activeAlter.id};
  let edTags=[...(it.tags||[])];
  const alters=getAlters();

  openModal(`
    <div class="modal-title">${isEdit?'Edit event':'New timeline event'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Title</div>
        <input type="text" id="tl-title" placeholder="What happened?" value="${escM(it.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Description (optional)</div>
        <textarea id="tl-body" placeholder="More details...">${escM(it.body||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Tipo</div>
          <select id="tl-type">
            ${TL_TYPES.map(t=>`<option value="${t.id}" ${it.type===t.id?'selected':''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Date</div>
          <input type="date" id="tl-date" value="${it.date}">
        </div>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Alter</div>
          <select id="tl-alter">
            <option value="">System</option>
            ${alters.map(a=>`<option value="${a.id}" ${it.alterId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Tags</div>
          <div id="tl-tags-row" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:6px 10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;min-height:36px">
            ${edTags.map((t,i)=>`<span class="tag-pill-rm">${esc(t)}<button data-ti="${i}">✕</button></span>`).join('')}
            <input class="tag-input" id="tl-tag-input" placeholder="tag..." style="flex:1;min-width:50px">
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Add'}</button>
    </div>`,
    (ov)=>{
      const title=ov.querySelector('#tl-title').value.trim();
      if(!title) return showToast('⚠ Title is required');
      const entry={id:it.id||uid(),title,body:ov.querySelector('#tl-body').value.trim(),
        type:ov.querySelector('#tl-type').value,date:ov.querySelector('#tl-date').value,
        alterId:ov.querySelector('#tl-alter').value||null,tags:[...edTags]};
      let list=loadTimeline();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveTimeline(list); closeModal(); showToast(isEdit?'Event updated ✓':'Event added ✓'); renderMemoriaView();
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
    <div class="modal-title">${isEdit?'Edit change':'Log important change'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Title</div>
        <input type="text" id="cb-title" placeholder="What changed?" value="${escM(it.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Description (optional)</div>
        <textarea id="cb-desc" placeholder="Context and detail...">${escM(it.desc||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Importance</div>
          <div style="display:flex;gap:6px">
            ${CAMBIO_IMPORTANCE.map(i=>`<div class="recur-opt${it.importance===i.id?' selected':''}" data-imp="${i.id}" style="flex:1;text-align:center;padding:8px 4px">
              <div style="font-size:18px;color:${i.color}">${i.emoji}</div>
              <div style="font-size:10px;font-weight:600;margin-top:3px">${i.id}</div>
            </div>`).join('')}
          </div>
          <input type="hidden" id="cb-importance" value="${it.importance||'medio'}">
        </div>
        <div class="form-row">
          <div class="form-label">Date</div>
          <input type="date" id="cb-date" value="${it.date}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Alter</div>
        <select id="cb-alter">
          <option value="">System</option>
          ${alters.map(a=>`<option value="${a.id}" ${it.alterId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Register'}</button>
    </div>`,
    (ov)=>{
      const title=ov.querySelector('#cb-title').value.trim();
      if(!title) return showToast('⚠ Title is required');
      const entry={id:it.id||uid(),title,desc:ov.querySelector('#cb-desc').value.trim(),
        importance:ov.querySelector('#cb-importance').value,date:ov.querySelector('#cb-date').value,
        alterId:ov.querySelector('#cb-alter').value||null};
      let list=loadCambios();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveCambios(list); closeModal(); showToast(isEdit?'Change updated ✓':'Change logged ✓'); renderMemoriaView();
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
    <div class="modal-title">${isEdit?'Edit integration note':'New integration note'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Title (optional)</div>
        <input type="text" id="ig-title" placeholder="Topic..." value="${escM(it.title||'')}">
      </div>
      <div class="form-row">
        <div class="form-label">Notes</div>
        <textarea id="ig-body" placeholder="Observations, progress, reflexions..." style="min-height:120px">${escM(it.body||'')}</textarea>
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
        <div class="form-label">Progress (0–100)</div>
        <input type="range" id="ig-progress" min="0" max="100" value="${it.progress||0}" style="width:100%">
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);text-align:right" id="ig-progress-val">${it.progress||0}%</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Add'}</button>
    </div>`,
    (ov)=>{
      const body=ov.querySelector('#ig-body').value.trim();
      if(!body) return showToast('⚠ Write something');
      const entry={id:it.id||uid(),title:ov.querySelector('#ig-title').value.trim(),body,
        alter1Id:ov.querySelector('#ig-alter1').value,alter2Id:ov.querySelector('#ig-alter2').value||null,
        progress:+ov.querySelector('#ig-progress').value,ts:it.ts||Date.now()};
      let list=loadIntegracion();
      if(isEdit) list=list.map(x=>x.id===it.id?entry:x); else list.push(entry);
      saveIntegracion(list); closeModal(); showToast(isEdit?'Note updated ✓':'Note added ✓'); renderMemoriaView();
    }
  );
  const ov=document.querySelector('.modal-overlay');
  const rng=ov.querySelector('#ig-progress'); const lbl=ov.querySelector('#ig-progress-val');
  rng?.addEventListener('input',()=>{ if(lbl) lbl.textContent=rng.value+'%'; });
}

// ═══════════════════════════════════════════════
// PROYECTOS
// ═══════════════════════════════════════════════
const ROUTINE_SCOPE_LABELS = { personal:'Personal', shared:'Shared', system:'System' };
const ROUTINE_SCOPE_OPTIONS = [
  {id:'personal', label:'Personal'},
  {id:'shared', label:'Shared'},
  {id:'system', label:'System'},
];
const ROUTINE_FREQ_OPTIONS = [
  {id:'daily', label:'Daily'},
  {id:'weekly', label:'Weekly'},
];
const ROUTINE_DAY_OPTIONS = [
  {id:1, short:'M', label:'Monday'},
  {id:2, short:'T', label:'Tuesday'},
  {id:3, short:'W', label:'Wednesday'},
  {id:4, short:'T', label:'Thursday'},
  {id:5, short:'F', label:'Friday'},
  {id:6, short:'S', label:'Saturday'},
  {id:0, short:'S', label:'Sunday'},
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
  if (r.scope === 'system') return 'System';
  if (!ids.length) return r.scope === 'shared' ? 'Shared' : 'No assigned alter';
  return ids.map(id => alters.find(a=>a.id===id)?.name).filter(Boolean).join(' · ');
}
function renderRutinasAdherencia(routines, todayDate) {
  if (!routines.length) return `<div class="task-panel"><div class="task-empty"><div class="task-empty-icon">◎</div><div>No active routines</div></div></div>`;
  const log = loadRoutineLog();
  const DAYS = 30;

  // Generate last 30 days
  const dates = [];
  for (let i = DAYS-1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    dates.push(d.toISOString().slice(0,10));
  }

  return routines.map(r => {
    const dueDates  = dates.filter(d => routineDueOnDate(r, d));
    const doneDates = dueDates.filter(d => {
      const entry = log.find(x=>x.routineId===r.id && x.date===d);
      return routineProgress(r, d).done || entry?.done;
    });

    const pct = dueDates.length ? Math.round((doneDates.length / dueDates.length)*100) : null;

    // Current streak (consecutive days completed backwards from today)
    let streak = 0;
    for (let i = 0; i < dates.length; i++) {
      const d = dates[dates.length-1-i];
      if (!routineDueOnDate(r, d)) continue;
      if (doneDates.includes(d)) streak++; else break;
    }

    // Mini dots — last 14 days
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
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${r.frequency==='weekly'?'Weekly':'Daily'} · ${doneDates.length}/${dueDates.length} days completed</div>
        </div>
        ${pct!=null ? `<div style="text-align:right;flex-shrink:0">
          <div style="font-size:18px;font-weight:800;color:${pct>=80?'var(--accent-2)':pct>=50?'var(--accent)':'var(--accent-4)'}">${pct}%</div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">adherence</div>
        </div>` : ''}
      </div>
      <div style="height:4px;background:var(--bg-3);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${pct??0}%;background:${(pct??0)>=80?'var(--accent-2)':(pct??0)>=50?'var(--accent)':'var(--accent-4)'};border-radius:2px;transition:width .4s"></div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
        ${dots}
        ${streak>0 ? `<span style="margin-left:6px;font-family:'DM Mono',monospace;font-size:9px;color:var(--accent-2)">🔥 ${streak} streak</span>` : ''}
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
    <div class="modal-title">${isEdit?'Edit project':'New project'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Project name</div>
        <input type="text" id="pr-name" placeholder="Project name" value="${escP(p.name)}">
      </div>
      <div class="form-row">
        <div class="form-label">Description (optional)</div>
        <textarea id="pr-desc" placeholder="What is this project about?">${escP(p.desc||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Project notes</div>
        <textarea id="pr-notes" placeholder="Notes, context, or project decisions...">${escP(p.notes||'')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Documents and links</div>
        <textarea id="pr-documents" placeholder="One link per line: name | https://example.com">${escP((p.documents||[]).map(d=>`${d.name||''} | ${d.url||''}`).join('\n'))}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Task categories (optional)</div>
        <input type="text" id="pr-categories" placeholder="General, Home, Health" value="${escP((p.categories||['General']).join(', '))}">
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
          <div class="form-label">Alter in charge</div>
          <select id="pr-resp">
            <option value="">Unassigned</option>
            ${alters.map(a=>`<option value="${a.id}" ${p.responsableId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Status</div>
          <select id="pr-status">
            ${PROY_STATUSES.map(s=>`<option value="${s.id}" ${p.status===s.id?'selected':''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Deadline (optional)</div>
        <input type="date" id="pr-deadline" value="${p.deadline||''}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Create project'}</button>
    </div>`,
    (ov)=>{
      const name=ov.querySelector('#pr-name').value.trim();
      if(!name) return showToast('⚠ Name required');
      const categories=[...new Set(ov.querySelector('#pr-categories').value.split(',').map(x=>x.trim()).filter(Boolean))];
      const documents=ov.querySelector('#pr-documents').value.split('\n').map(line=>{const [rawName,...rawUrl]=line.split('|'),url=rawUrl.join('|').trim();return {id:uid(),name:(rawName||url).trim(),url};}).filter(d=>d.url);
      const entry={id:p.id||uid(),name,desc:ov.querySelector('#pr-desc').value.trim(),notes:ov.querySelector('#pr-notes').value.trim(),documents,categories:categories.length?categories:['General'],
        color:ov.querySelector('#pr-color').value,responsableId:ov.querySelector('#pr-resp').value||null,
        status:ov.querySelector('#pr-status').value,deadline:ov.querySelector('#pr-deadline').value,ts:p.ts||Date.now()};
      let list=loadProyectos();
      if(isEdit) list=list.map(x=>x.id===p.id?entry:x);
      else { list.push(entry); activeProyId=entry.id; }

     saveProyectos(list);
      closeModal(); showToast(isEdit?'Project updated ✓':'Project created ✓'); renderProyView();
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
    <div class="modal-title">${isEdit?'Edit task':'New task'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Title</div>
        <input type="text" id="tk-title" placeholder="What needs to be done?" value="${escP(t.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Description (optional)</div>
        <textarea id="tk-desc" placeholder="More details...">${escP(t.desc||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Category</div>
          <select id="tk-category">${categories.map(c=>`<option value="${escP(c)}" ${t.category===c?'selected':''}>${escP(c)}</option>`).join('')}</select>
        </div>
        <div class="form-row">
          <div class="form-label">Subtask of</div>
          <select id="tk-parent"><option value="">Main task</option>${parents.map(x=>`<option value="${x.id}" ${t.parentId===x.id?'selected':''}>${escP(x.title)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Assign to</div>
          <select id="tk-assignee">
            <option value="">Unassigned</option>
            ${alters.map(a=>`<option value="${a.id}" ${t.assigneeId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Status</div>
          <select id="tk-status">
            ${TASK_STATUSES.map(s=>`<option value="${s.id}" ${t.status===s.id?'selected':''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Priority</div>
        <div class="priority-opts" style="gap:5px">
          ${PRIORITIES.map(pr=>`<div class="priority-opt${t.priority===pr.id?' selected':''} ${pr.id}" data-pri="${pr.id}" style="padding:6px 4px">
            <div style="font-size:15px">${pr.emoji}</div>
            <div class="priority-opt-label" style="font-size:9px">${pr.label}</div>
          </div>`).join('')}
        </div>
        <input type="hidden" id="tk-priority" value="${t.priority||'media'}">
      </div>
      <div class="form-row">
        <div class="form-label">Deadline (optional)</div>
        <input type="date" id="tk-deadline" value="${t.deadline||''}">
      </div>
      <div class="form-row">
        <div class="form-label">Tags</div>
        <input type="text" id="tk-tags" placeholder="#health #home" value="${(t.tags||[]).map(tag=>'#'+escP(tag)).join(' ')}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Create task'}</button>
    </div>`,
    (ov)=>{
      const title=ov.querySelector('#tk-title').value.trim();
      if(!title) return showToast('⚠ Title is required');
      const tags = ov.querySelector('#tk-tags').value.split(/\s+/).map(x=>x.replace(/^#/,'').trim()).filter(Boolean);
      const entry={id:t.id||uid(),proyId,title,desc:ov.querySelector('#tk-desc').value.trim(),category:ov.querySelector('#tk-category').value||'General',parentId:ov.querySelector('#tk-parent').value||null,
        assigneeId:ov.querySelector('#tk-assignee').value||null,
        status:ov.querySelector('#tk-status').value,priority:ov.querySelector('#tk-priority').value,
        deadline:ov.querySelector('#tk-deadline').value,tags,ts:t.ts||Date.now()};
      let list=loadTareas();
      if(isEdit) list=list.map(x=>x.id===t.id?entry:x);
      else list.push(entry);
      saveTareas(list); closeModal();
      showToast(isEdit?'Task updated ✓':'Task created ✓'); renderProyView();
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
  {id:'experiencia', label:'Experience', accent:'#7affd4', cls:'wish-cat-experiencia'},
  {id:'sistema',     label:'System',     accent:'#ff8ae2', cls:'wish-cat-sistema'},
  {id:'otro',        label:'Misc.',        accent:'#b8b4d8', cls:'wish-cat-otro'},
];
const WISH_STATUSES = [
  {id:'deseado',    label:'Wished',     emoji:'✨'},
  {id:'en-progreso',label:'In progress', emoji:'⏳'},
  {id:'conseguido', label:'Achieved',  emoji:'✅'},
  {id:'descartado', label:'Discarded',  emoji:'✕'},
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
          <div class="fin-title">◈ Wishes</div>
          <div class="fin-subtitle">${total} wish${total!==1?'es':''} · ${conseguidos} achieved</div>
        </div>
        <button class="btn btn-primary" id="btn-new-wish">+ Add wish</button>
      </div>
      <div class="wish-stats">
        <div class="wish-stat"><div class="wish-stat-val" style="color:var(--accent)">${total}</div><div class="wish-stat-label">Total</div></div>
        <div class="wish-stat"><div class="wish-stat-val" style="color:var(--accent-4)">${enProgreso}</div><div class="wish-stat-label">In progress</div></div>
        <div class="wish-stat"><div class="wish-stat-val" style="color:var(--green)">${conseguidos}</div><div class="wish-stat-label">Achieved</div></div>
        ${totalPrice>0?`<div class="wish-stat"><div class="wish-stat-val" style="color:var(--accent-3)">${totalPrice.toFixed(0)}€</div><div class="wish-stat-label">Estimated price</div></div>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="wish-scope-toggle">
          <div class="wish-scope-btn${wishScope==='personal'?' active':''}" data-scope="personal">👤 Personal</div>
          <div class="wish-scope-btn${wishScope==='sistema'?' active':''}" data-scope="sistema">◎ System</div>
        </div>
        <div class="notas-view-toggle">
          <div class="notas-view-btn${wishViewMode==='grid'?' active':''}" id="btn-wish-grid" title="Grid">⊞</div>
          <div class="notas-view-btn${wishViewMode==='list'?' active':''}" id="btn-wish-list" title="List">☰</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="wish-status-filter">
          <div class="wish-status-chip${wishStatusFilter==='all'?' active':''}" data-sf="all">All · ${pool.length}</div>
          ${WISH_STATUSES.map(s=>{ const cnt=pool.filter(w=>w.status===s.id).length; if(!cnt) return '';
            return `<div class="wish-status-chip${wishStatusFilter===s.id?' active':''}" data-sf="${s.id}">${s.emoji} ${s.label} · ${cnt}</div>`; }).join('')}
        </div>
        ${activeCats.length>1?`<div class="wish-status-filter">
          <div class="wish-status-chip${wishCatFilter==='all'?' active':''}" data-cf="all">All categories</div>
          ${activeCats.map(cid=>{ const cat=WISH_CATS.find(c=>c.id===cid); if(!cat) return '';
            return `<div class="wish-status-chip${wishCatFilter===cid?' active':''}" data-cf="${cid}">${cat.label}</div>`; }).join('')}
        </div>`:''}
      </div>
      <div id="wish-content">
        ${filtered.length===0?`<div class="empty-state" style="padding:50px 20px">
          <div class="empty-icon">◈</div>
          <div>${total===0?'Your wishlist is empty':'No wishes with these filters'}</div>
          ${total===0?`<button class="btn btn-primary" style="margin-top:8px" id="btn-empty-wish">Add first wish</button>`:''}
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
          <div class="fin-subtitle">${total} wish${total!==1?'es':''} · ${conseguidos} achieved</div>
        </div>
        <button class="btn btn-primary" id="btn-new-wish">+ Add wish</button>
      </div>

      <!-- STATS -->
      <div class="wish-stats">
        <div class="wish-stat">
          <div class="wish-stat-val" style="color:var(--accent)">${total}</div>
          <div class="wish-stat-label">Total</div>
        </div>
        <div class="wish-stat">
          <div class="wish-stat-val" style="color:var(--accent-4)">${enProgreso}</div>
          <div class="wish-stat-label">In progress</div>
        </div>
        <div class="wish-stat">
          <div class="wish-stat-val" style="color:var(--green)">${conseguidos}</div>
          <div class="wish-stat-label">Achieved</div>
        </div>
        ${totalPrice>0?`<div class="wish-stat">
          <div class="wish-stat-val" style="color:var(--accent-3)">${totalPrice.toFixed(0)}€</div>
          <div class="wish-stat-label">Estimated price</div>
        </div>`:''}
      </div>

      <!-- TOOLBAR -->
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="wish-scope-toggle">
          <div class="wish-scope-btn${wishScope==='personal'?' active':''}" data-scope="personal">👤 Personal</div>
          <div class="wish-scope-btn${wishScope==='sistema'?' active':''}" data-scope="sistema">◎ System</div>
        </div>
        <div class="notas-view-toggle">
          <div class="notas-view-btn${wishViewMode==='grid'?' active':''}" id="btn-wish-grid" title="Grid">⊞</div>
          <div class="notas-view-btn${wishViewMode==='list'?' active':''}" id="btn-wish-list" title="List">☰</div>
        </div>
      </div>

      <!-- STATUS FILTER -->
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="wish-status-filter">
          <div class="wish-status-chip${wishStatusFilter==='all'?' active':''}" data-sf="all">All · ${pool.length}</div>
          ${WISH_STATUSES.map(s=>{
            const cnt=pool.filter(w=>w.status===s.id).length;
            if(!cnt) return '';
            return `<div class="wish-status-chip${wishStatusFilter===s.id?' active':''}" data-sf="${s.id}">${s.emoji} ${s.label} · ${cnt}</div>`;
          }).join('')}
        </div>
        ${activeCats.length>1?`<div class="wish-status-filter">
          <div class="wish-status-chip${wishCatFilter==='all'?' active':''}" data-cf="all">All categories</div>
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
          <div>${total===0?'Your wishlist is empty':'No wishes with these filters'}</div>
          ${total===0?`<button class="btn btn-primary" style="margin-top:8px" id="btn-empty-wish">Add first wish</button>`:''}
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
            ${w.url?`<a href="${w.url}" target="_blank" class="wish-url-icon" title="Open link">🔗</a>`:''}
          </div>
        </div>
        <div class="wish-card-footer">
          <div class="wish-alter-row">
            <span>${alt?.emoji||''}</span>
            <span>${wishScope==='sistema'?(alt?.name||''):'Mine'}</span>
            ${w.scope==='sistema'?`<span class="wish-shared-badge">compartida</span>`:''}
          </div>
          ${isOwn?`<div class="wish-card-actions">
            ${w.status!=='conseguido'&&w.status!=='descartado'?`<button class="icon-btn btn-wish-got" data-wid="${w.id}" title="Mark as achieved">✅</button>`:''}
            <button class="icon-btn btn-wish-edit" data-wid="${w.id}" title="Edit">✎</button>
            <button class="icon-btn btn-wish-del" data-wid="${w.id}" title="Delete">✕</button>
          </div>`:''}
        </div>
      </div>`;
    }).join('')}
    <div class="nota-add-card" id="btn-add-wish-grid">
      <div class="nota-add-icon">+</div><div>Add wish</div>
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
      const d = new Date(w.ts).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
      return `<div class="wish-list-item ${w.status}" data-wid="${w.id}">
        <div class="wish-accent-bar" style="background:${cat.accent}"></div>
        <div style="font-size:16px">${st.emoji}</div>
        <div class="wish-list-title">${escB(w.title)}</div>
        <span class="wish-cat-chip ${cat.cls}">${cat.label}</span>
        ${w.price?`<span class="wish-price" style="flex-shrink:0">~${w.price}€</span>`:''}
        ${w.url?`<a href="${w.url}" target="_blank" class="wish-url-icon" title="Open">🔗</a>`:''}
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);flex-shrink:0">${d}</span>
        ${wishScope==='sistema'?`<span title="${alt?.name||''}">${alt?.emoji||''}</span>`:''}
        ${isOwn?`<div class="wish-list-actions">
          ${w.status!=='conseguido'&&w.status!=='descartado'?`<button class="icon-btn btn-wish-got" data-wid="${w.id}" title="Conseguido">✅</button>`:''}
          <button class="icon-btn btn-wish-edit" data-wid="${w.id}" title="Edit">✎</button>
          <button class="icon-btn btn-wish-del" data-wid="${w.id}" title="Delete">✕</button>
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
    if(w){ w.status='conseguido'; saveWishes(ws); showToast('Achieved! ✅'); renderInnerChat(); }
  }));
  // Edit
  app.querySelectorAll('.btn-wish-edit').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const w=loadWishes().find(x=>x.id===b.dataset.wid); if(w) openWishModal(w);
  }));
  // Delete
  app.querySelectorAll('.btn-wish-del').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(!confirm('Delete this wish?')) return;
    saveWishes(loadWishes().filter(x=>x.id!==b.dataset.wid));
    showToast('Wish deleted'); renderInnerChat();
  }));
}

function openWishDetail(w) {
  const cat = catOf(w.category);
  const st  = statusOf(w.status);
  const alt = getAlters().find(a=>a.id===w.alterId);
  const isOwn = w.alterId===activeAlter.id;
  const d = new Date(w.ts).toLocaleString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

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
      <button class="btn btn-ghost" data-cancel>Close</button>
      ${isOwn&&w.status!=='conseguido'&&w.status!=='descartado'?`<button class="btn btn-primary" id="det-wish-got">✅ Mark achieved</button>`:''}
      ${isOwn?`<button class="btn btn-ghost" id="det-wish-edit">✎ Edit</button>`:''}
    </div>`,
    ()=>{}
  );
  document.getElementById('det-wish-got')?.addEventListener('click',()=>{
    const ws=loadWishes(); const ww=ws.find(x=>x.id===w.id);
    if(ww){ ww.status='conseguido'; saveWishes(ws); }
    closeModal(); showToast('Achieved! ✅'); renderInnerChat();
  });
  document.getElementById('det-wish-edit')?.addEventListener('click',()=>{ closeModal(); openWishModal(w); });
}

function openWishModal(wish) {
  const isEdit = !!wish;
  const w = wish||{title:'',desc:'',category:'personal',priority:'media',status:'deseado',price:'',url:'',scope:'personal'};

  openModal(`
    <div class="modal-title">${isEdit?'Edit wish':'New wish'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Title</div>
        <input type="text" id="wh-title" placeholder="What do you wish for?" value="${escB(w.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Description (optional)</div>
        <textarea id="wh-desc" placeholder="More details...">${escB(w.desc||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Category</div>
          <select id="wh-cat">
            ${WISH_CATS.map(c=>`<option value="${c.id}" ${w.category===c.id?'selected':''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Priority</div>
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
          <div class="form-label">Estimated price (€)</div>
          <input type="number" id="wh-price" placeholder="0.00" min="0" step="0.01" value="${w.price||''}">
        </div>
        <div class="form-row">
          <div class="form-label">Status</div>
          <select id="wh-status">
            ${WISH_STATUSES.map(s=>`<option value="${s.id}" ${w.status===s.id?'selected':''}>${s.emoji} ${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-label">Link / URL (optional)</div>
        <input type="url" id="wh-url" placeholder="https://..." value="${escB(w.url||'')}">
      </div>
      <div class="form-row">
        <div class="form-label">Visibility</div>
        <div style="display:flex;gap:8px">
          <div class="recur-opt${(w.scope||'personal')==='personal'?' selected':''}" data-scope-opt="personal" style="flex:1;text-align:center;padding:10px">
            <div style="font-size:18px">👤</div>
            <div style="font-size:11px;font-weight:700;margin-top:4px">Personal</div>
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">Only me</div>
          </div>
          <div class="recur-opt${w.scope==='sistema'?' selected':''}" data-scope-opt="sistema" style="flex:1;text-align:center;padding:10px">
            <div style="font-size:18px">◎</div>
            <div style="font-size:11px;font-weight:700;margin-top:4px">System</div>
            <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">Visible for everyone</div>
          </div>
        </div>
        <input type="hidden" id="wh-scope" value="${w.scope||'personal'}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Add'}</button>
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
      if(!title) return showToast('⚠ Title is required');
      let list = loadWishes();
      const entry = {id:w.id||uid(),alterId:activeAlter.id,title,desc,category,priority,status,price,url,scope,ts:w.ts||Date.now()};
      if(isEdit) list=list.map(x=>x.id===w.id?entry:x);
      else list.push(entry);
      saveWishes(list);
      closeModal();
      wishScope=scope;
      showToast(isEdit?'Wish updated ✓':'Wish added ✓');
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
  {id:'pendiente',  label:'Pending',  color:'var(--accent-4)'},
  {id:'aceptada',   label:'Accepted',   color:'var(--green)'},
  {id:'rechazada',  label:'Rejected',  color:'var(--red)'},
  {id:'completada', label:'Completed', color:'var(--text-2)'},
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
  const titles = {solicitudes:'◱ Requests', diario:'◫ Journal'};
  const subs   = {solicitudes:'Internal requests between alters', diario:'Personal entries and reflections'};
  const btnNew = {solicitudes:'+ New request', diario:'+ New entry'};
  const tab = ['solicitudes','diario'].includes(notasModuleTab) ? notasModuleTab : 'solicitudes';

  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:titles[tab]||'Requests'}]);

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
        ◱ Requests${pendRecibidas>0?`<span class="mtab-badge">${pendRecibidas}</span>`:''}
      </div>
      <div class="module-tab${tab==='diario'?' active':''}" data-mt="diario">◫ Journal</div>
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
        <button class="btn btn-ghost btn-sm" id="btn-note-templates2">Templates</button>
        <div class="notas-view-toggle">
          <div class="notas-view-btn${notasViewMode==='grid'?' active':''}" id="btn-view-grid2" title="Grid">⊞</div>
          <div class="notas-view-btn${notasViewMode==='list'?' active':''}" id="btn-view-list2" title="List">☰</div>
        </div>
        <div class="notas-filter-alter">
          <div class="nota-alter-chip${notasFilterAlter==='all'?' active':''}" data-fa2="all"
            style="${notasFilterAlter==='all'?'border-color:var(--border-active);background:var(--bg-3)':''}">All · ${todas.length}</div>
          ${alters.filter(a=>countByAlter[a.id]).map(a=>`
            <div class="nota-alter-chip${notasFilterAlter===a.id?' active':''}" data-fa2="${a.id}"
              style="${notasFilterAlter===a.id?`border-color:${a.color};background:${a.bg};color:${a.color}`:''}">
              ${a.emoji} ${esc(a.name)} · ${countByAlter[a.id]||0}
            </div>`).join('')}
        </div>
        ${allTags.length>0?`<div style="display:flex;gap:4px;flex-wrap:wrap">
          <div class="nota-alter-chip${!notasFilterTag?' active':''}" data-ft2="" style="${!notasFilterTag?'border-color:var(--border-active);background:var(--bg-3)':''}">All</div>
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
          {id:'recibidas', label:'Received', count:recibidas.filter(s=>s.status==='pendiente').length},
          {id:'enviadas',  label:'Sent',  count:0},
          {id:'todas',     label:'All',     count:0},
        ].map(t=>`<div class="normas-tab${solicTab===t.id?' active':''}" data-st="${t.id}">
          ${t.label}${t.count>0?`<span class="tab-badge">${t.count}</span>`:''}
        </div>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px" id="solic-list">
        ${sorted.length===0?`<div class="empty-state" style="padding:50px 20px">
          <div class="empty-icon">◱</div>
          <div>No requests ${solicTab==='recibidas'?'received':solicTab==='enviadas'?'sent':''}</div>
        </div>`:sorted.map(s=>renderSolicCard(s,alters)).join('')}
      </div>
    </div>`;

  container.querySelectorAll('[data-st]').forEach(t=>t.addEventListener('click',()=>{ solicTab=t.dataset.st; renderSolicitudesInContainer(container); }));
  wireSolicCards(container, alters, container);
}

function renderSolicCard(s, alters) {
  const from = alters.find(a=>a.id===s.fromId);
  const to   = s.toId==='sistema' ? {name:'System',emoji:'◎',color:'var(--text-2)',bg:'var(--bg-2)'} : alters.find(a=>a.id===s.toId);
  const pri  = PRIORITIES.find(p=>p.id===s.priority)||PRIORITIES[1];
  const priColor = SOLIC_PRI_COLORS[s.priority]||'var(--text-2)';
  const isFrom = s.fromId===activeAlter.id;
  const isTo   = s.toId===activeAlter.id||s.toId==='sistema';
  const today  = new Date().toISOString().slice(0,10);
  const overdue= s.deadline && s.deadline<today && s.status==='pendiente';
  const d      = new Date(s.ts).toLocaleDateString('en-GB',{day:'numeric',month:'short'});

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
            <span style="color:${to?.color||'var(--text-1)'};font-weight:700">${to?.name||'System'}</span>
          </div>
          <div class="solic-priority-dot" style="background:${priColor}" title="${pri.label}"></div>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:${priColor}">${s.priority}</span>
          <span class="solic-date" style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">📅 ${d}</span>
          ${s.deadline?`<span class="solic-deadline${overdue?' overdue':''}">⏱ ${overdue?'Overdue: ':'Limit: '}${fmtDate(s.deadline)}</span>`:''}
        </div>
      </div>
    </div>

    ${s.response?`
    <div class="solic-response">
      <div class="solic-response-avatar" style="background:${to?.bg||'var(--bg-2)'};border-color:${to?.color||'transparent'}">${to?.emoji||'◎'}</div>
      <div>
        <div class="solic-response-bubble">${escSolic(s.response)}</div>
        <div class="solic-response-meta">${to?.name||'?'} · ${s.respondedTs?new Date(s.respondedTs).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):''}</div>
      </div>
    </div>`:''}

    <div class="solic-actions">
      ${isTo&&s.status==='pendiente'?`
        <button class="btn btn-primary btn-sm btn-aceptar-solic" data-sid="${s.id}">✓ Accept</button>
        <button class="btn btn-danger btn-sm btn-rechazar-solic" data-sid="${s.id}">✕ Reject</button>
        <button class="btn btn-ghost btn-sm btn-responder-toggle" data-sid="${s.id}">💬 Respond</button>`:''}
      ${isFrom&&s.status==='aceptada'?`
        <button class="btn btn-primary btn-sm btn-completar-solic" data-sid="${s.id}">✓ Mark complete</button>`:''}
      ${isFrom&&s.status==='pendiente'?`
        <button class="btn btn-ghost btn-sm btn-edit-solic" data-sid="${s.id}">✎ Edit</button>`:''}
      ${(isFrom||activeAlter.isAdmin)?`
        <button class="btn btn-danger btn-sm btn-del-solic" data-sid="${s.id}" style="margin-left:auto">✕ Delete</button>`:''}
    </div>

    <div class="solic-respond-area" id="respond-area-${s.id}" style="display:none">
      <textarea class="solic-respond-input" id="respond-input-${s.id}" placeholder="Write your response..." rows="2"></textarea>
      <button class="btn btn-primary btn-sm btn-send-response" data-sid="${s.id}">Send</button>
    </div>
  </div>`;
}

function escSolic(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function wireSolicCards(container, alters, parentContainer) {
  // Aceptar
  container.querySelectorAll('.btn-aceptar-solic').forEach(b=>b.addEventListener('click',()=>{
    const ss=loadSolicitudes(); const s=ss.find(x=>x.id===b.dataset.sid);
    if(s){ s.status='aceptada'; s.respondedTs=Date.now(); saveSolicitudes(ss); }
    showToast('Request accepted ✓'); renderSolicitudesInContainer(parentContainer);
  }));
  // Rechazar
  container.querySelectorAll('.btn-rechazar-solic').forEach(b=>b.addEventListener('click',()=>{
    const ss=loadSolicitudes(); const s=ss.find(x=>x.id===b.dataset.sid);
    if(s){ s.status='rechazada'; s.respondedTs=Date.now(); saveSolicitudes(ss); }
    showToast('Request rejected'); renderSolicitudesInContainer(parentContainer);
  }));
  // Completar
  container.querySelectorAll('.btn-completar-solic').forEach(b=>b.addEventListener('click',()=>{
    const ss=loadSolicitudes(); const s=ss.find(x=>x.id===b.dataset.sid);
    if(s){ s.status='completada'; saveSolicitudes(ss); }
    showToast('Request completed ✓'); renderSolicitudesInContainer(parentContainer);
  }));
  // Toggle respond area
  container.querySelectorAll('.btn-responder-toggle').forEach(b=>b.addEventListener('click',()=>{
    const area=container.querySelector(`#respond-area-${b.dataset.sid}`);
    if(area){ area.style.display=area.style.display==='none'?'flex':'none'; area.querySelector('textarea')?.focus(); }
  }));
  // Send response
  container.querySelectorAll('.btn-send-response').forEach(b=>b.addEventListener('click',()=>{
    const inp=container.querySelector(`#respond-input-${b.dataset.sid}`);
    const text=inp?.value.trim(); if(!text) return showToast('⚠ Write something');
    const ss=loadSolicitudes(); const s=ss.find(x=>x.id===b.dataset.sid);
    if(s){ s.response=text; s.respondedTs=Date.now(); s.status='aceptada'; saveSolicitudes(ss); }
    showToast('Response sent ✓'); renderSolicitudesInContainer(parentContainer);
  }));
  // Edit
  container.querySelectorAll('.btn-edit-solic').forEach(b=>b.addEventListener('click',()=>{
    const s=loadSolicitudes().find(x=>x.id===b.dataset.sid); if(s) openSolicModal(s);
  }));
  // Delete
  container.querySelectorAll('.btn-del-solic').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('Delete request?')) return;
    saveSolicitudes(loadSolicitudes().filter(x=>x.id!==b.dataset.sid));
    showToast('Request deleted'); renderSolicitudesInContainer(parentContainer);
  }));
}

function openSolicModal(solic) {
  const isEdit = !!solic;
  const s = solic||{title:'',desc:'',toId:'',priority:'media',deadline:''};
  const alters = getAlters().filter(a=>a.id!==activeAlter.id);

  openModal(`
    <div class="modal-title">${isEdit?'Edit request':'New request'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Title</div>
        <input type="text" id="sl-title" placeholder="What do you need?" value="${escSolic(s.title)}">
      </div>
      <div class="form-row">
        <div class="form-label">Description (optional)</div>
        <textarea id="sl-desc" placeholder="More context about the request...">${escSolic(s.desc||'')}</textarea>
      </div>
      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Recipient</div>
          <select id="sl-to">
            <option value="sistema" ${s.toId==='sistema'?'selected':''}>◎ System (all)</option>
            ${alters.map(a=>`<option value="${a.id}" ${s.toId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Priority</div>
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
        <div class="form-label">Deadline (optional)</div>
        <input type="date" id="sl-deadline" value="${s.deadline||''}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Send request'}</button>
    </div>`,
    (ov) => {
      const title    = ov.querySelector('#sl-title').value.trim();
      const desc     = ov.querySelector('#sl-desc').value.trim();
      const toId     = ov.querySelector('#sl-to').value;
      const priority = ov.querySelector('#sl-priority').value;
      const deadline = ov.querySelector('#sl-deadline').value;
      if(!title) return showToast('⚠ Title is required');
      if(!toId)  return showToast('⚠ Select a recipient');
      let list = loadSolicitudes();
      const entry = {id:s.id||uid(),fromId:activeAlter.id,toId,title,desc,priority,deadline,status:s.status||'pendiente',ts:s.ts||Date.now(),response:s.response,respondedTs:s.respondedTs};
      if(isEdit) list=list.map(x=>x.id===s.id?entry:x);
      else { list.push(entry); solicTab='enviadas'; }
      saveSolicitudes(list);
      closeModal();
      showToast(isEdit?'Request updated ✓':'Request sent ✓');
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
  const options = Array.isArray(p.options) && p.options.length ? p.options : [{id:'yes', label:'Yes'}, {id:'no', label:'No'}];
  const votes = Array.isArray(p.votes) ? p.votes : [];
  const total = votes.length;
  const myVote = votes.find(v=>v.alterId===activeAlter.id)?.optionId || null;
  const dateStr = new Date(p.ts || Date.now()).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  return `<div class="norma-card ${p.status||'activa'}" data-pid="${p.id}">
    <div class="norma-card-top">
      <div class="norma-priority media">◎</div>
      <div class="norma-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div class="norma-title">${escNorma(p.title)}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
            ${p.shareOnline && p.status!=='archivada'?`<span class="norma-status-badge activa">online</span>`:''}
            <span class="norma-status-badge ${p.status||'activa'}">${p.status==='archivada'?'archived':'active'}</span>
          </div>
        </div>
        ${p.desc?`<div class="norma-desc">${escNorma(p.desc)}</div>`:''}
        <div class="norma-meta">
          ${creator?`<div class="norma-proposer"><span class="norma-proposer-avatar">${creator.emoji}</span><span style="color:${creator.color};font-weight:600">${creator.name}</span></div>`:''}
          <span class="norma-date">📅 ${dateStr}</span>
          <span>${total} vote${total!==1?'s':''}</span>
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
      ${p.creatorId===activeAlter.id||isAdmin()?`<button class="btn btn-ghost btn-sm btn-edit-poll" data-pid="${p.id}">✎ Edit</button>`:''}
      ${p.status!=='archivada'?`<button class="btn btn-ghost btn-sm btn-toggle-poll-share" data-pid="${p.id}">${p.shareOnline?'Stop sharing':'Share online'}</button>`:''}
      ${p.status!=='archivada'?`<button class="btn btn-ghost btn-sm btn-archive-poll" data-pid="${p.id}">↓ Archive</button>`:`<button class="btn btn-ghost btn-sm btn-restore-poll" data-pid="${p.id}">↑ Restore</button>`}
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
  app.querySelectorAll('.btn-edit-poll').forEach(btn=>btn.addEventListener('click',()=>{ const poll = loadPolls().find(p=>p.id===btn.dataset.pid); if(poll) openPollModal(poll); }));
  app.querySelectorAll('.btn-toggle-poll-share').forEach(btn=>btn.addEventListener('click',()=>{ const polls = loadPolls(); const poll = polls.find(p=>p.id===btn.dataset.pid); if(poll){ poll.shareOnline = !poll.shareOnline; savePolls(polls); rerenderPollSurface(); } }));
  app.querySelectorAll('.btn-archive-poll').forEach(btn=>btn.addEventListener('click',()=>{ const polls = loadPolls(); const poll = polls.find(p=>p.id===btn.dataset.pid); if(poll){ poll.status='archivada'; poll.shareOnline=false; savePolls(polls); rerenderPollSurface(); } }));
  app.querySelectorAll('.btn-restore-poll').forEach(btn=>btn.addEventListener('click',()=>{ const polls = loadPolls(); const poll = polls.find(p=>p.id===btn.dataset.pid); if(poll){ poll.status='activa'; savePolls(polls); rerenderPollSurface(); } }));
  app.querySelectorAll('.btn-del-poll').forEach(btn=>btn.addEventListener('click',()=>{ if(!confirm('Delete this poll?')) return; savePolls(loadPolls().filter(p=>p.id!==btn.dataset.pid)); rerenderPollSurface(); }));
}

function openPollModal(poll) {
  const isEdit = !!poll;
  const p = poll || {title:'', desc:'', status:'activa', shareOnline:false, options:[{id:'opt-1', label:''},{id:'opt-2', label:''}], votes:[]};
  openModal(`
    <div class="modal-title">${isEdit?'Edit poll':'New poll'}</div>
    <div class="form-grid">
      <div class="form-row"><div class="form-label">Title</div><input type="text" id="poll-title" value="${escNorma(p.title||'')}" placeholder="E.g. Which plan do we prefer?"></div>
      <div class="form-row"><div class="form-label">Optional description</div><textarea id="poll-desc" placeholder="Poll context...">${escNorma(p.desc||'')}</textarea></div>
      <div class="form-row"><div class="form-label">Options, one per line</div><textarea id="poll-options" placeholder="Option A&#10;Option B">${escNorma((p.options||[]).map(o=>o.label).join('\n'))}</textarea></div>
      <div class="form-row"><div class="form-label">Status</div><select id="poll-status"><option value="activa" ${p.status!=='archivada'?'selected':''}>Active</option><option value="archivada" ${p.status==='archivada'?'selected':''}>Archived</option></select></div>
      <label class="perm-toggle-row"><div><div class="perm-toggle-label">Share online</div><div class="perm-toggle-sublabel">Only visible to friends with poll permission.</div></div><span class="toggle-switch"><input type="checkbox" id="poll-share-online" ${p.shareOnline && p.status!=='archivada'?'checked':''}><span class="toggle-slider"></span></span></label>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" data-cancel>Cancel</button><button class="btn btn-primary" data-submit>${isEdit?'Save':'Create'}</button></div>`,
    (ov) => {
      const title = ov.querySelector('#poll-title').value.trim();
      const desc = ov.querySelector('#poll-desc').value.trim();
      const status = ov.querySelector('#poll-status').value;
      const labels = ov.querySelector('#poll-options').value.split(/\n+/).map(v=>v.trim()).filter(Boolean);
      if(!title) return showToast('⚠ Title is required');
      if(labels.length < 2) return showToast('⚠ Add at least two options');
      const oldOptions = Array.isArray(p.options) ? p.options : [];
      const options = labels.map((label, index)=>({ id: oldOptions[index]?.id || `opt-${Date.now()}-${index}`, label }));
      const allowedIds = new Set(options.map(o=>o.id));
      const votes = (p.votes||[]).filter(v=>allowedIds.has(v.optionId));
      const entry = { id: p.id || uid(), title, desc, status, creatorId: p.creatorId || activeAlter.id, ts: p.ts || Date.now(), options, votes, shareOnline: (status !== 'archivada' && ov.querySelector('#poll-share-online')?.checked) || undefined };
      const list = loadPolls();
      savePolls(isEdit ? list.map(x=>x.id===p.id?entry:x) : [...list, entry]);
      closeModal();
      showToast(isEdit?'Poll updated ✓':'Poll created ✓');
      rerenderPollSurface();
    }
  );
}

const APP_VERSION = 'v0.13.0';
const ACCENT_COLORS = [
  {id:'purple', label:'Purple',  value:'#a08aff', bg:'rgba(160,138,255,0.12)'},
  {id:'pink',   label:'Pink',     value:'#ff8ae2', bg:'rgba(255,138,226,0.12)'},
  {id:'teal',   label:'Teal',    value:'#8affe0', bg:'rgba(138,255,224,0.12)'},
  {id:'amber',  label:'Amber',    value:'#ffb450', bg:'rgba(255,180,80,0.12)'},
  {id:'blue',   label:'Blue',     value:'#8ab4ff', bg:'rgba(138,180,255,0.12)'},
  {id:'coral',  label:'Coral',    value:'#ff7f7f', bg:'rgba(255,127,127,0.12)'},
];
const STORAGE_KEYS = [
  {key:'tid_alters',       label:'Alter profiles',   section:'perfiles'},
  {key:'tid_events',       label:'Agenda events',    section:'agenda'},
  {key:'tid_diary',        label:'Diary entries',        section:'diario'},
  {key:'tid_channels',     label:'Chat channels',     section:'innerchat'},
  {key:'tid_messages',     label:'Chat messages',    section:'innerchat'},
  {key:'tid_config',       label:'Settings',        section:'config'},
  {key:'tid_tracker',      label:'Emotional tracker',    section:'tracker'},
  {key:'tid_reminders',    label:'Reminders',        section:'recordatorios'},
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
  const custom = cfg.customTheme || {};
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
  applyTheme(cfg.theme||'auto');
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


function askMoodOnEntry(alter, onDone) {
  const moods = getMoods();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay mood-entry-overlay';
  ov.style.cssText = 'animation:fadeUp 280ms ease both';
  ov.innerHTML = `
    <div class="modal mood-entry-modal" style="animation:fadeUp 280ms ease both">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="width:40px;height:40px;border-radius:50%;background:${alter.bg};border:2px solid ${alter.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">${alterAv(alter,40)}</div>
        <div>
          <div style="font-size:15px;font-weight:600;color:var(--text-1)">Hello, ${esc(alter.name)}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px">How are you feeling right now?</div>
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
        <button class="btn btn-ghost btn-sm" id="mood-entry-skip">Not now</button>
        <button class="btn btn-primary btn-sm" id="mood-entry-save" style="display:none">Save</button>
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


function renderConfigEmociones(app, back) {
  const renderList = () => {
    const moods = getMoods();
    app.innerHTML = `
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both">
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">🎭</div>
          <div><div class="config-section-title">Emotions</div><div class="config-section-desc">Customize the emotional tracker states</div></div>
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
                <button class="btn btn-ghost btn-sm btn-edit-mood" data-idx="${i}">✎ Edit</button>
                ${moods.length > 1 ? `<button class="btn btn-ghost btn-sm btn-del-mood" data-idx="${i}" style="color:#ff6b8a">✕</button>` : ''}
              </div>
            </div>`).join('')}
        </div>
        <div style="padding:12px 16px;border-top:1px solid var(--border)">
          <button class="btn btn-primary btn-sm" id="btn-add-mood">+ Add emotion</button>
          <button class="btn btn-ghost btn-sm" id="btn-reset-moods" style="margin-left:8px;color:var(--text-3)">Restore defaults</button>
        </div>
      </div>
    </div>`;

    app.querySelectorAll('.btn-edit-mood').forEach(btn => {
      btn.addEventListener('click', () => openMoodModal(getMoods()[+btn.dataset.idx], +btn.dataset.idx, renderList));
    });
    app.querySelectorAll('.btn-del-mood').forEach(btn => {
      btn.addEventListener('click', () => {
        const ms = getMoods(); ms.splice(+btn.dataset.idx, 1); saveMoods(ms);
        showToast('Emotion deleted'); renderList();
      });
    });
    app.querySelector('#btn-add-mood').addEventListener('click', () => openMoodModal(null, null, renderList));
    app.querySelector('#btn-reset-moods').addEventListener('click', () => {
      if (confirm('Restore default emotions? Custom ones will be lost.')) {
        localStorage.removeItem('tid_moods'); showToast('Emotions restored ✓'); renderList();
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
      <div class="modal-title">${isNew ? 'New emotion' : 'Edit emotion'}</div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:16px">
        <div>
          <label class="config-row-sub" style="display:block;margin-bottom:6px">Emoji</label>
          <div style="display:flex;align-items:center;gap:10px">
            <div id="mood-emoji-preview" style="font-size:32px;min-width:40px;text-align:center">${mood?.emoji||'😊'}</div>
            <input class="system-name-input" id="mood-emoji-input" maxlength="4" placeholder="Emoji..." value="${mood?.emoji||'😊'}" style="width:80px;text-align:center;font-size:20px">
          </div>
        </div>
        <div>
          <label class="config-row-sub" style="display:block;margin-bottom:6px">Name</label>
          <input class="system-name-input" id="mood-label-input" maxlength="24" placeholder="Emotion name..." value="${mood?.label||''}" style="width:100%">
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
        <button class="btn btn-ghost btn-sm" data-cancel>Cancel</button>
        <button class="btn btn-primary btn-sm" id="btn-save-mood-cfg">Save</button>
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
    if (!label) { showToast('⚠ Enter a name'); return; }
    const ms = getMoods();
    if (isNew) {
      const id = 'custom-' + Date.now();
      ms.push({id, emoji, label});
    } else {
      ms[idx] = {...ms[idx], emoji, label};
    }
    saveMoods(ms);
    showToast(isNew ? 'Emotion added ✓' : 'Emotion updated ✓');
    ov.remove();
    onDone();
  });
}

// Online hub views live in en/online-views.js after R4.

function renderConfig() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Settings'}]);
  const cfg = loadConfig();
  const app = document.getElementById('app');

  // Storage total rápido
  let totalBytes = 0;
  for (let i=0; i<localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('tid_')) totalBytes += new Blob([localStorage.getItem(k)||'']).size;
  }
  const fmtBytes = b => b<1024?b+'B':b<1024*1024?(b/1024).toFixed(1)+'KB':(b/1024/1024).toFixed(2)+'MB';

  const onlineEnabled = !!cfg.onlineEnabled;
  const onlineBaseUrl = String(getOnlineApiBaseUrl(cfg) || '').trim();
  const sections = [
    {id:'personalizacion', icon:'🎨', name:'Personalization',  desc:'System name, colours and font',  color:'#c4aaff', bg:'rgba(196,170,255,0.08)'},
    {id:'datos',           icon:'💾', name:'Data',            desc:'External copy, import and export',           color:'#8affe0', bg:'rgba(138,255,224,0.08)'},
    {id:'almacenamiento',  icon:'🗄', name:'Storage',   desc:fmtBytes(totalBytes)+' used locally',  color:'#ffb450', bg:'rgba(255,180,80,0.08)'},
    {id:'emociones',       icon:'🎭', name:'Emotions',         desc:'Customize tracker emotion states',      color:'#ffd580', bg:'rgba(255,213,128,0.08)'},
    {id:'notificaciones',  icon:'🔔', name:'Notifications',   desc:'Which alerts to receive and when',           color:'#ff8ae2', bg:'rgba(255,138,226,0.08)'},
    {id:'online',          icon:'☁', name:'Online features', desc:onlineEnabled ? `Enabled${onlineBaseUrl ? ' · service ready' : ' · local only'} · automatic sync` : 'Friends, online chat, presence, sync and backup', color:'#5fffb0', bg:'rgba(95,255,176,0.08)'},
    {id:'peligro',         icon:'⚠️', name:'Danger zone',  desc:'Reset modules or delete everything',        color:'#ff6b8a', bg:'rgba(255,107,138,0.08)'},
    {id:'acerca',          icon:'💜', name:'About Atria',      desc:APP_VERSION+' · Private, local-first, with optional online features', color:'#a08aff', bg:'rgba(160,138,255,0.08)'},
  ];

  app.innerHTML = `
  <div style="max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:24px;animation:fadeUp 360ms ease both">
    <div>
      <div class="fin-title">⚙ Settings</div>
      <div class="fin-subtitle">System · ${APP_VERSION}</div>
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
  const labels = {personalizacion:'Personalization',datos:'Data',almacenamiento:'Storage',emociones:'Emotions',notificaciones:'Notifications',online:'Online features',peligro:'Danger zone',acerca:'About Atria'};
  setCrumbs([
    {label:'Hub', action:()=>navigateTo('hub')},
    {label:'Settings', action: back},
    {label: labels[section]||section},
  ]);

  const app = document.getElementById('app');
  const cfg = loadConfig();

  if (section === 'personalizacion') {
    const selAccent = cfg.accentColor||'purple';
    const selFont   = cfg.fontSize||'medium';
    const customTheme = cfg.customTheme || {};
    app.innerHTML = `
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both">
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">🎨</div>
          <div><div class="config-section-title">Personalization</div><div class="config-section-desc">Appearance and system name</div></div>
        </div>
        <div class="config-rows">
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">System name</div>
              <div class="config-row-sub">Shown on the home screen</div>
            </div>
            <div class="config-row-right">
              <input class="system-name-input" id="cfg-sysname" placeholder="System name..." value="${cfg.systemName||''}">
              <button class="btn btn-ghost btn-sm" id="btn-save-sysname">Save</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Accent color</div>
              <div class="config-row-sub">Main interface color</div>
            </div>
            <div class="config-row-right">
              <div class="accent-grid">
                ${ACCENT_COLORS.map(ac=>`<div class="accent-opt${selAccent===ac.id?' selected':''}" data-accent="${ac.id}" style="background:${ac.value}" title="${ac.label}"></div>`).join('')}
              </div>
            </div>
          </div>
          <div class="config-row config-row-stack">
            <div class="config-row-left"><div class="config-row-label">Advanced theme</div><div class="config-row-sub">Custom colours for background, surfaces and text</div></div>
            <div class="config-row-right theme-custom-controls">
              <label>Background <input type="color" id="cfg-custom-bg" value="${customTheme.background || '#0a0a0f'}"></label>
              <label>Surface <input type="color" id="cfg-custom-surface" value="${customTheme.surface || '#10101a'}"></label>
              <label>Text <input type="color" id="cfg-custom-text" value="${customTheme.text || '#f0eeff'}"></label>
              <button class="btn btn-ghost btn-sm" id="btn-reset-custom-theme">Reset</button>
              <div class="config-row-sub" id="cfg-theme-contrast" aria-live="polite"></div>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Font size</div>
              <div class="config-row-sub">Affects the whole interface</div>
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
              <div class="config-row-label">Theme</div>
              <div class="config-row-sub">Light, dark or automatic</div>
            </div>
            <div class="config-row-right">
              <div class="font-size-row">
                <div class="font-size-opt${(cfg.theme||'auto')==='auto'?' selected':''}" data-theme="auto">Auto</div>
                <div class="font-size-opt${cfg.theme==='dark'?' selected':''}" data-theme="dark">Dark</div>
                <div class="font-size-opt${cfg.theme==='light'?' selected':''}" data-theme="light">Light</div>
              </div>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Language</div>
              <div class="config-row-sub">Interface language</div>
            </div>
            <div class="config-row-right">
              <select id="cfg-lang" style="width:140px">
                <option value="es">🇪🇸 Español</option>
                <option value="en" selected>🇬🇧 English</option>
              </select>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Fixed bottom navbar</div>
              <div class="config-row-sub">Keeps the mobile bottom bar visible without the open/close button</div>
            </div>
            <div class="config-row-right">
              <label class="toggle-switch"><input type="checkbox" id="cfg-mobile-nav-fixed" ${cfg.mobileNavFixed?'checked':''}><span class="toggle-slider"></span></label>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left"><div class="config-row-label">Simplified / littles mode</div><div class="config-row-sub">Fewer visible modules, larger text and lower visual noise</div></div>
            <div class="config-row-right"><label class="toggle-switch"><input type="checkbox" id="cfg-simplified-mode" ${cfg.simplifiedMode?'checked':''}><span class="toggle-slider"></span></label></div>
          </div>
        </div>
      </div>
    </div>`;
    app.querySelector('#btn-save-sysname')?.addEventListener('click',()=>{
      const name=app.querySelector('#cfg-sysname').value.trim();
      const c=loadConfig(); c.systemName=name; saveConfig(c); applyConfig(c); showToast('Name saved ✓');
    });
    const updateCustomTheme = () => {
      const background = app.querySelector('#cfg-custom-bg').value;
      const surface = app.querySelector('#cfg-custom-surface').value;
      const text = app.querySelector('#cfg-custom-text').value;
      const ratio = themeHexContrast(background, text);
      const status = app.querySelector('#cfg-theme-contrast');
      status.textContent = `Text/background contrast: ${ratio.toFixed(2)}:1${ratio < 4.5 ? ' · low for normal text' : ' · passes'}`;
      status.style.color = ratio < 4.5 ? 'var(--red)' : 'var(--green)';
      const c=loadConfig(); c.customTheme={background,surface,text}; saveConfig(c); applyConfig(c);
    };
    ['#cfg-custom-bg','#cfg-custom-surface','#cfg-custom-text'].forEach(sel=>app.querySelector(sel)?.addEventListener('input', updateCustomTheme));
    app.querySelector('#btn-reset-custom-theme')?.addEventListener('click',()=>{ const c=loadConfig(); delete c.customTheme; saveConfig(c); applyConfig(c); renderConfigSection('personalizacion'); showToast('Advanced theme reset ✓'); });
    updateCustomTheme();
    app.querySelectorAll('.accent-opt').forEach(opt=>opt.addEventListener('click',()=>{
      app.querySelectorAll('.accent-opt').forEach(o=>o.classList.remove('selected')); opt.classList.add('selected');
      const c=loadConfig(); c.accentColor=opt.dataset.accent; saveConfig(c);
      showReloadPrompt('A reload is required to apply the changes.');
    }));
    app.querySelectorAll('.font-size-opt[data-size]').forEach(opt=>opt.addEventListener('click',()=>{
      app.querySelectorAll('.font-size-opt[data-size]').forEach(o=>o.classList.remove('selected')); opt.classList.add('selected');
      const c=loadConfig(); c.fontSize=opt.dataset.size; saveConfig(c);
      applyConfig(c);
      showToast('Font size updated ✓');
    }));
    app.querySelectorAll('[data-theme]').forEach(opt=>opt.addEventListener('click',()=>{
      app.querySelectorAll('[data-theme]').forEach(o=>o.classList.remove('selected')); opt.classList.add('selected');
      const c=loadConfig(); c.theme=opt.dataset.theme; saveConfig(c);
      applyTheme(c.theme);
      showToast('Theme updated ✓');
    }));
    app.querySelector('#cfg-lang')?.addEventListener('change',e=>{
      const lang = e.target.value;
      const c = loadConfig(); c.lang = lang; saveConfig(c);
      localStorage.setItem('atria_lang', lang);
      showToast('Switching language...');
      setTimeout(() => {
        if (lang === 'es') {
          window.location.href = '../../es/';
        } else {
          window.location.href = '../../en/';
        }
      }, 800);
    });
    app.querySelector('#cfg-mobile-nav-fixed')?.addEventListener('change',e=>{
      const c = loadConfig();
      c.mobileNavFixed = !!e.target.checked;
      saveConfig(c);
      applyConfig(c);
      showToast('Bottom navbar updated ✓');
    });
    app.querySelector('#cfg-simplified-mode')?.addEventListener('change', e=>{
      const c=loadConfig(); c.simplifiedMode=!!e.target.checked; saveConfig(c); applyConfig(c); showToast(c.simplifiedMode?'Simplified mode enabled ✓':'Simplified mode disabled ✓');
    });

  } else if (section === 'datos') {
    app.innerHTML = `
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both">
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">💾</div>
          <div><div class="config-section-title">Data</div><div class="config-section-desc">External copy, import and storage</div></div>
        </div>
        <div class="config-rows">
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">🔒 Seguridad avanzada</div>
              <div class="config-row-sub">PIN, optional encrypted copy, session management</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-go-seguridad">Open →</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Export all data</div>
              <div class="config-row-sub">Download a JSON file with the entire system</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-export">↓ Export</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Export fronting to CSV</div>
              <div class="config-row-sub">Fronting sessions with duration and notes</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-csv-fronting">↓ CSV</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Export mood tracker to CSV</div>
              <div class="config-row-sub">Mood records by alter and date</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-csv-tracker">↓ CSV</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Export finances to CSV</div>
              <div class="config-row-sub">All transactions across all alters</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-csv-finanzas">↓ CSV</button></div>
          </div>
          <div class="config-row"><div class="config-row-left"><div class="config-row-label">Export finances to JSON</div><div class="config-row-sub">Transactions, savings, budgets, categories, and currency</div></div><div class="config-row-right" style="gap:6px"><button class="btn btn-ghost" id="btn-json-finanzas">↓ JSON</button><label class="btn btn-ghost" style="cursor:pointer">↑ Import<input type="file" id="btn-import-finanzas-json" accept=".json" style="display:none"></label></div></div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Export reminders to CSV</div>
              <div class="config-row-sub">All system reminders</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-csv-reminders">↓ CSV</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Export agenda to calendar</div>
              <div class="config-row-sub">Events and reminders in ICS format</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-ics-agenda">ICS</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Export tasks to CSV</div>
              <div class="config-row-sub">All tasks across all projects</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-csv-tareas">↓ CSV</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">System summary</div>
              <div class="config-row-sub">Internal report with alters, fronting, moods, projects and overdue tasks</div>
            </div>
            <div class="config-row-right"><button class="btn btn-ghost" id="btn-resumen-txt">↓ Summary</button></div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Wellbeing report</div>
              <div class="config-row-sub">Report for professionals: presence, emotions, diary entries and crisis episodes</div>
            </div>
            <div class="config-row-right" style="gap:6px">
              <button class="btn btn-ghost" id="btn-informe-terapeutico">↓ TXT</button>
              <button class="btn btn-ghost" id="btn-informe-print">🖨 PDF</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Import backup</div>
              <div class="config-row-sub">Restore data from a JSON file exported from Atria</div>
            </div>
            <div class="config-row-right">
              <label class="btn btn-ghost" style="cursor:pointer">↑ Import<input type="file" id="btn-import" accept=".json" style="display:none"></label>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Import from another system</div>
              <div class="config-row-sub">Import alters and fronting from Simply Plural, PluralKit or Atria Exchange Format (AEF)</div>
            </div>
            <div class="config-row-right">
              <label class="btn btn-ghost" style="cursor:pointer;white-space:nowrap">◈ Import<input type="file" id="btn-import-ecosystem" accept=".json" style="display:none"></label>
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
      showToast('Backup exported ✓');
    });
    app.querySelector('#btn-csv-fronting')?.addEventListener('click',  ()=>openCSVRangeModal('Export fronting',   exportFrontingCSV));
    app.querySelector('#btn-csv-tracker')?.addEventListener('click',   ()=>openCSVRangeModal('Export tracker',    exportTrackerCSV));
    app.querySelector('#btn-csv-finanzas')?.addEventListener('click',  ()=>openCSVRangeModal('Export finances',   exportFinanzasCSV));
    app.querySelector('#btn-json-finanzas')?.addEventListener('click', exportFinanzasJSON);
    app.querySelector('#btn-import-finanzas-json')?.addEventListener('change', e => { const file=e.target.files[0]; if(file) importFinanzasJSON(file); e.target.value=''; });
    app.querySelector('#btn-csv-reminders')?.addEventListener('click', ()=>openCSVRangeModal('Export reminders',  exportRemindersCSV));
    app.querySelector('#btn-ics-agenda')?.addEventListener('click',    ()=>openCSVRangeModal('Export agenda', exportAgendaICS, 'Export ICS'));
    app.querySelector('#btn-csv-tareas')?.addEventListener('click',    ()=>openCSVRangeModal('Export tasks',      exportTareasCSV));
    app.querySelector('#btn-resumen-txt')?.addEventListener('click',   ()=>openCSVRangeModal('System summary', exportResumenTXT));
    app.querySelector('#btn-informe-terapeutico')?.addEventListener('click', ()=>openCSVRangeModal('Wellbeing report', exportInformeTerapeutico));
    app.querySelector('#btn-informe-print')?.addEventListener('click', ()=>openCSVRangeModal('Print wellbeing report', printInformeBienestar));
    app.querySelector('#btn-import-ecosystem')?.addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      if (typeof window.atriaExternalImport?.preview === 'function') {
        // Re-open through the preview-first importer; the selected file is handled below.
        const reader = new FileReader();
        reader.onload = ev => { try { const parsed = atriaExternalImport.parse(JSON.parse(ev.target.result)); window.__atriaExternalImportParsed = parsed; } catch { showToast('⚠ Invalid external JSON'); } };
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
        ALTERS=getAlters(); showToast(`${count} keys imported ✓ — reload to apply`); renderConfigSection('datos');
      }catch{ showToast('⚠ Invalid file'); } };
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
          <div><div class="config-section-title">Local storage</div><div class="config-section-desc">${fmtB(totalB)} usados · ${allStorage.length} claves</div></div>
        </div>
        <div style="padding:16px 20px">
          <div class="storage-bar"><div class="storage-bar-fill" style="width:${Math.min(100,(totalB/51200)*100).toFixed(1)}%"></div></div>
          <div class="storage-items" style="margin-top:14px">
            ${allStorage.filter(x=>x.bytes>0).map(x=>`
              <div class="storage-item">
                <div><div class="storage-item-key">${x.label||x.key}</div>${x.count?`<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${x.count} elemento${x.count!==1?'s':''}</div>`:''}</div>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="storage-item-size">${fmtB(x.bytes)}</div>
                  <button class="storage-item-del btn-del-key" data-key="${x.key}" title="Delete this key">✕</button>
                </div>
              </div>`).join('')}
            ${allStorage.every(x=>x.bytes===0)?`<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);text-align:center;padding:20px">No saved data</div>`:''}
          </div>
        </div>
      </div>
    </div>`;
    app.querySelectorAll('.btn-del-key').forEach(btn=>btn.addEventListener('click',()=>{
      if(!confirm(`Delete "${btn.dataset.key}"?`)) return;
      localStorage.removeItem(btn.dataset.key); showToast('Key deleted'); renderConfigSection('almacenamiento');
    }));

  } else if (section === 'emociones') {
    renderConfigEmociones(app, back);

  } else if (section === 'notificaciones') {
    app.innerHTML=`<div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both"><div id="config-notif-mount"></div></div>`;
    renderNotifConfig(app.querySelector('#config-notif-mount'));

  } else if (section === 'online') {
    const online = getOnlineProfile(cfg);
    const onlineEnabledNow = online.enabled;
    const onlineBaseUrlNow = getOnlineApiBaseUrl(cfg);
    const onlineAccount = loadOnlineAccount();
    const onlineSession = loadOnlineSession();
    const onlineDevices = loadOnlineDevicesCache();
    const backupStatus = loadOnlineBackupStatus();
    const backupSummary = describeOnlineBackupStatus({ ...backupStatus, autoBackupEnabled: cfg.onlineAutoBackup !== false });
    const backupToneColor = backupSummary.tone === 'error' ? '#ff8a8a' : backupSummary.tone === 'ok' ? '#5fffb0' : backupSummary.tone === 'warn' ? '#ffcf6f' : 'var(--text-3)';
    const onlineDeviceName = onlineSession?.deviceName || online.deviceName;
    const currentDeviceId = onlineSession?.deviceId || loadConfig().onlineDeviceId || (onlineDevices.find(d => (d.platform || d.name) === onlineDeviceName)?.id || '');
    const onlineDevicesHtml = onlineDevices.length
      ? onlineDevices.map(d => {
          const id = d.id || '';
          const name = d.platform || d.name || 'Device';
          const isCurrent = id && id === currentDeviceId;
          return `<div class="online-device-row${isCurrent?' current':''}" data-device-id="${escAttr(id)}">
            <div class="online-device-main">
              <input class="online-device-inline-name" data-device-name="${escAttr(id)}" value="${escAttr(name)}" maxlength="40">
              <div class="online-device-meta">${isCurrent ? 'This device' : 'Linked device'}${d.lastSeenAt ? ' · ' + new Date(d.lastSeenAt).toLocaleString('en') : ''}</div>
            </div>
            <button class="btn btn-ghost btn-sm" data-device-save="${escAttr(id)}">Save</button>
          </div>`;
        }).join('')
      : `<div style="font-size:12px;color:var(--text-3);padding:8px 0">No devices loaded yet.</div>`;
    const sessionText = onlineSession ? (onlineSession.email || onlineSession.systemId || 'Prepared') : 'No session';
    app.innerHTML = `
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both;display:flex;flex-direction:column;gap:16px">
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">☁</div>
          <div><div class="config-section-title">Online features</div><div class="config-section-desc">Friends, online chat, presence, device sync and encrypted backup</div></div>
        </div>
        <div class="config-rows">
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Current status</div>
              <div class="config-row-sub">${onlineEnabledNow ? 'Online features are enabled on this device' : 'Online is not activated yet'}</div>
            </div>
            <div class="config-row-right" style="font-family:'DM Mono',monospace;font-size:11px;color:${onlineEnabledNow?'#5fffb0':'var(--text-3)'}">${onlineEnabledNow?'ONLINE':'NOT_ACTIVE'}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Device sync</div>
              <div class="config-row-sub">When online is enabled, sync is treated as automatic. The user should not need manual push/pull.</div>
            </div>
            <div class="config-row-right" style="font-size:12px;color:var(--text-2)">${onlineEnabledNow ? 'Automatic with online account' : 'Pending activation'}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Online connection</div>
              <div class="config-row-sub">Atria connects automatically. You do not need to configure anything manually.</div>
            </div>
            <div class="config-row-right" style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
              <div style="font-size:11px;color:${hasOnlineBackendConfigured(cfg)?'#5fffb0':'var(--text-3)'}">${getOnlineBackendStateLabel(cfg)}</div>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Preconfigured online service</div>
              <div class="config-row-sub">If this is empty, the account stays local on this device.</div>
            </div>
            <div class="config-row-right" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
              <input id="online-api-base-url" type="text" value="${escM(getOnlineApiBaseUrl(cfg) || '')}" placeholder="https://api.your-server.com" style="display:none">
              <button class="btn btn-ghost btn-sm" id="btn-online-save-backend" style="display:none">Save</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Privacy</div>
              <div class="config-row-sub">Private messages and data are encrypted before leaving this device; only sharing choices you enable are sent.</div>
            </div>
            <div class="config-row-right" style="font-size:12px;color:var(--text-2)">E2E first</div>
          </div>
        </div>
      </div>

      ${onlineEnabledNow ? `
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">◎</div>
          <div><div class="config-section-title">Account and device</div><div class="config-section-desc">Your online account and this device</div></div>
        </div>
        <div class="config-rows">
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Email</div>
              <div class="config-row-sub">Only for the account and sign-in</div>
            </div>
            <div class="config-row-right" style="font-size:12px;color:var(--text-1)">${escM(onlineAccount?.email || online.email || sessionText || '—')}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Visible ID</div>
              <div class="config-row-sub">Public system name to share.</div>
            </div>
            <div class="config-row-right" style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent)">${escM(onlineAccount?.systemId || online.systemId)}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">ATRIA code</div>
              <div class="config-row-sub">Safe code to share without exposing email.</div>
            </div>
            <div class="config-row-right" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
              <div data-online-config-friend-code style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent)">${escM(onlineAccount?.friendCode || online.friendCode || 'ATRIA-XXXX-XXXX-XXXX')}</div>
              <button class="btn btn-ghost btn-sm" id="btn-copy-online-friendcode">Copy</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Device name</div>
              <div class="config-row-sub">Visible name for this installation</div>
            </div>
            <div class="config-row-right" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
              <input id="online-device-name" type="text" value="${escM(onlineDeviceName)}" maxlength="40" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <button class="btn btn-ghost btn-sm" id="btn-online-save-device">Save</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Prepared devices</div>
              <div class="config-row-sub">Devices linked to your online account.</div>
            </div>
            <div class="config-row-right" style="min-width:min(100%,360px);display:flex;flex-direction:column;gap:8px">${onlineDevicesHtml}</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Online fronting</div>
              <div class="config-row-sub">Only share fronting if explicitly enabled.</div>
            </div>
            <div class="config-row-right">
              <label class="toggle-switch"><input type="checkbox" id="online-fronting-enabled" ${cfg.onlineFrontingEnabled?'checked':''}><span class="toggle-slider"></span></label>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Automatic backup</div>
              <div class="config-row-sub">Saved encrypted automatically for your online account.</div>
            </div>
            <div class="config-row-right">
              <label class="toggle-switch"><input type="checkbox" id="online-backup-enabled" ${cfg.onlineAutoBackup !== false?'checked':''}><span class="toggle-slider"></span></label>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Online backup status</div>
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
              <div class="config-row-label">Online features</div>
              <div class="config-row-sub">You can disable online whenever you want.</div>
            </div>
            <div class="config-row-right">
              <button class="btn btn-danger btn-sm" id="btn-online-disable">Disable</button>
            </div>
          </div>
        </div>
      </div>` : `
      <div class="config-section">
        <div class="config-section-header">
          <div class="config-section-icon">🔐</div>
          <div><div class="config-section-title">Create account or sign in</div><div class="config-section-desc">Same online space on every authenticated device</div></div>
        </div>
        <div class="config-rows">
          <div class="config-row" style="flex-direction:column;align-items:flex-start;gap:12px;padding:14px 16px;background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-lg)">
            <div class="config-row-left" style="width:100%">
              <div class="config-row-label">Enable online features</div>
              <div class="config-row-sub">Online enables automatic sync, online chat, friends, presence and encrypted backup.</div>
            </div>
            <label style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--text-1);line-height:1.5;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px 12px;width:100%;box-sizing:border-box">
              <input type="checkbox" id="online-consent" style="margin-top:2px">
              <span>I understand that Atria uses optional online features to connect my devices and store an encrypted copy. Private data is encrypted before leaving this device, and I choose what to share.</span>
            </label>
            <div style="font-size:11px;color:var(--text-3);line-height:1.4">After that, choose one action: create account or sign in.</div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Create account</div>
              <div class="config-row-sub">Use this the first time you enable online</div>
            </div>
            <div class="config-row-right" style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
              <input id="online-register-email" type="email" placeholder="email@example.com" style="width:min(100%,260px);background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <input id="online-register-password" type="password" placeholder="Password (min. 8)" style="width:min(100%,260px);background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <details style="width:min(100%,260px);margin-top:2px">
                <summary style="font-size:12px;color:var(--text-2);cursor:pointer">▸ Customize device name</summary>
                <input id="online-register-device" type="text" value="${escM(getAutoDeviceName())}" maxlength="40" style="width:100%;margin-top:6px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              </details>
              <input id="online-register-display" type="text" placeholder="Your system's name" value="${escM(cfg.systemName || '')}" maxlength="40" style="width:min(100%,260px);background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <label style="display:flex;align-items:flex-start;gap:8px;width:min(100%,260px);font-size:12px;color:var(--text-2)"><input id="online-remember-session" type="checkbox" checked style="margin-top:2px"><span>Keep this browser signed in</span></label>
              <button class="btn btn-primary btn-sm" id="btn-online-register">Create account</button>
            </div>
          </div>
          <div class="config-row">
            <div class="config-row-left">
              <div class="config-row-label">Sign in</div>
              <div class="config-row-sub">Use the same account on another device</div>
            </div>
            <div class="config-row-right" style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
              <input id="online-login-email" type="email" placeholder="email@example.com" style="width:min(100%,260px);background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <input id="online-login-password" type="password" placeholder="Password" style="width:min(100%,260px);background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              <details style="width:min(100%,260px);margin-top:2px">
                <summary style="font-size:12px;color:var(--text-2);cursor:pointer">Customize device name</summary>
                <input id="online-login-device" type="text" value="${escM(getAutoDeviceName())}" maxlength="40" style="width:100%;margin-top:6px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
              </details>
              <label style="display:flex;align-items:flex-start;gap:8px;width:min(100%,260px);font-size:12px;color:var(--text-2)"><input id="online-login-remember" type="checkbox" checked style="margin-top:2px"><span>Keep this browser signed in</span></label>
              <button class="btn btn-ghost btn-sm" id="btn-online-login">Sign in</button>
              <details style="width:220px;margin-top:4px">
                <summary style="font-size:12px;color:var(--text-2);cursor:pointer">Forgot password?</summary>
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
                  <button class="btn btn-ghost btn-sm" id="btn-online-reset-request" type="button">Send reset email</button>
                  <input id="online-reset-token" type="text" placeholder="Recovery code" value="${escM(new URLSearchParams(location.search).get('resetToken') || '')}" autocomplete="one-time-code" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
                  <input id="online-reset-old-password" type="password" placeholder="Previous password (optional)" autocomplete="current-password" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
                  <input id="online-reset-password" type="password" placeholder="New password (min. 8)" autocomplete="new-password" style="width:220px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--text-1)">
                  <div style="font-size:11px;color:var(--text-2);line-height:1.4">If you remember the previous password, Atria can keep the old online backup key. Without it, restore from a device that still has your Atria data or import a manual backup.</div>
                  <button class="btn btn-primary btn-sm" id="btn-online-reset-confirm" type="button">Set new password</button>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>`}
    </div>`;

    app.querySelector('#btn-online-save-backend')?.addEventListener('click', () => {
      const next = { ...loadConfig(), onlineApiBaseUrl: String(app.querySelector('#online-api-base-url')?.value || '').trim() };
      saveConfig(next);
      if (getOnlineProfile(next).enabled && hasOnlineBackendConfigured(next) && typeof startOnlineSyncLoop === 'function') startOnlineSyncLoop();
      else if (typeof stopOnlineSyncLoop === 'function') stopOnlineSyncLoop();
      showToast('Online service updated ✓');
      renderLayer0();
    });
    app.querySelector('#btn-online-register')?.addEventListener('click', async () => {
      const consent = app.querySelector('#online-consent')?.checked;
      const email = (app.querySelector('#online-register-email')?.value || '').trim().toLowerCase();
      const password = (app.querySelector('#online-register-password')?.value || '').trim();
      const deviceName = (app.querySelector('#online-register-device')?.value || '').trim() || getAutoDeviceName();
      const displayName = (app.querySelector('#online-register-display')?.value || '').trim() || cfg.systemName || '';
      const rememberSession = app.querySelector('#online-remember-session')?.checked !== false;
      if (!consent) return showToast('You must accept online features first');
      if (!isValidEmail(email)) return showToast('Enter a valid email');
      if (password.length < 8) return showToast('Password must be at least 8 characters');
      if (!displayName) return showToast('Enter your system name');
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
        showToast(result.mode === 'remote' ? 'Online account created' : 'Online features prepared');
        if (typeof unlockOnlineAccess === 'function') unlockOnlineAccess();
        renderConfigSection('online');
      } catch (e) {
        showToast(e?.message || 'Could not create the account');
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
      if (!consent) return showToast('You must accept online features first');
      if (!isValidEmail(email)) return showToast('Enter a valid email');
      if (password.length < 8) return showToast('Enter your password');
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
        showToast(result.restoreError ? `Signed in, but profiles were not restored: ${result.restoreError}` : (result.mode === 'remote' ? 'Online session started' : 'Online session prepared'));
        if (typeof unlockOnlineAccess === 'function') unlockOnlineAccess();
        renderLayer0();
      } catch (e) {
        showToast(e?.message || 'Could not sign in');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    app.querySelector('#btn-online-reset-request')?.addEventListener('click', async () => {
      const email = (app.querySelector('#online-login-email')?.value || '').trim().toLowerCase();
      if (!isValidEmail(email)) return showToast('Enter your account email first');
      const btn = app.querySelector('#btn-online-reset-request');
      if (btn) btn.disabled = true;
      try {
        await requestOnlinePasswordReset({ email });
        showToast('If that email exists, Atria sent a recovery code');
      } catch (e) {
        showToast(e?.message || 'Could not send recovery email');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    app.querySelector('#btn-online-reset-confirm')?.addEventListener('click', async () => {
      const token = (app.querySelector('#online-reset-token')?.value || '').trim();
      const password = (app.querySelector('#online-reset-password')?.value || '').trim();
      const oldPassword = (app.querySelector('#online-reset-old-password')?.value || '').trim();
      if (!token) return showToast('Enter the recovery code');
      if (password.length < 8) return showToast('Password must be at least 8 characters');
      const btn = app.querySelector('#btn-online-reset-confirm');
      if (btn) btn.disabled = true;
      try {
        const result = await confirmOnlinePasswordReset({ token, password, oldPassword });
        app.querySelector('#online-login-password').value = password;
        showToast(result?.preservedOldBackupKey ? 'Password updated. Old backup key kept.' : 'Password updated. Sign in, then restore from a device with data if needed.');
      } catch (e) {
        showToast(e?.message || 'Could not update password');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    async function saveOnlineDeviceNameFromConfig(deviceId, deviceName, btn = null) {
      const nextName = String(deviceName || '').trim();
      if (!nextName) return showToast('Enter a device name');
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
        showToast('Device updated');
        renderConfigSection('online');
      } catch (e) {
        showToast((e?.message || 'Could not update the device'));
        if (btn) btn.disabled = false;
      }
    }
    app.querySelector('#btn-online-save-device')?.addEventListener('click', event => {
      event.stopImmediatePropagation();
      const deviceName = (app.querySelector('#online-device-name')?.value || '').trim() || cfg.systemName || 'This device';
      saveOnlineDeviceNameFromConfig(currentDeviceId, deviceName, app.querySelector('#btn-online-save-device'));
    });
    app.querySelectorAll('[data-device-save]').forEach(btn => btn.addEventListener('click', () => {
      const row = btn.closest('.online-device-row');
      const deviceId = row?.dataset?.deviceId || btn.dataset.deviceSave || '';
      const deviceName = row?.querySelector('.online-device-inline-name')?.value || '';
      saveOnlineDeviceNameFromConfig(deviceId, deviceName, btn);
    }));
    app.querySelector('#btn-online-save-device')?.addEventListener('click', () => {
      const deviceName = (app.querySelector('#online-device-name')?.value || '').trim() || cfg.systemName || 'This device';
      const nextCfg = { ...loadConfig(), onlineDeviceName: deviceName };
      saveConfig(nextCfg);
      const session = loadOnlineSession();
      if (session) {
        saveOnlineSession({ ...session, deviceName });
        upsertOnlineDevice(deviceName, session.email, session.systemId);
      }
      showToast('Device updated ✓');
      renderLayer0();
    });
    const updateConfigFriendCode = account => {
      const freshAccount = account || loadOnlineAccount() || {};
      const freshOnline = getOnlineProfile(loadConfig());
      const code = freshAccount.friendCode || freshOnline.friendCode || '';
      const el = app.querySelector('[data-online-config-friend-code]');
      if (el) el.textContent = code || 'ATRIA-XXXX-XXXX-XXXX';
      return code;
    };
    if (onlineEnabledNow && typeof refreshOnlineAccountIdentityFromBackend === 'function') {
      refreshOnlineAccountIdentityFromBackend().then(updateConfigFriendCode).catch(() => {});
    }
    app.querySelector('#btn-copy-online-friendcode')?.addEventListener('click', async () => {
      const freshAccount = await refreshOnlineAccountIdentityFromBackend().catch(() => null);
      const code = updateConfigFriendCode(freshAccount);
      if (!code) return showToast('Warning: No ATRIA code is available yet');
      navigator.clipboard.writeText(code)
        .then(() => showToast('ATRIA code copied'))
        .catch(() => showToast('Warning: Could not copy the ATRIA code'));
    });
    app.querySelector('#online-fronting-enabled')?.addEventListener('change', e => {
      const enabled = !!e.target.checked;
      saveConfig({ ...loadConfig(), onlineFrontingEnabled: enabled });
      const session = loadOnlineSession();
      if (session) saveOnlineSession({ ...session, frontingEnabled: enabled });
      showToast('Fronting preference saved ✓');
    });
    app.querySelector('#online-backup-enabled')?.addEventListener('change', e => {
      const enabled = !!e.target.checked;
      saveConfig({ ...loadConfig(), onlineAutoBackup: enabled });
      const session = loadOnlineSession();
      if (session) saveOnlineSession({ ...session, autoBackup: enabled });
      saveOnlineBackupStatus({ ...(loadOnlineBackupStatus() || {}), autoBackupEnabled: enabled, lastError: null });
      showToast('Backup preference saved ✓');
      renderLayer0();
    });
    app.querySelector('#btn-online-run-backup')?.addEventListener('click', () => {
      const btn = app.querySelector('#btn-online-run-backup');
      if (btn) btn.disabled = true;
      runOnlineAutomaticBackup('manual-test')
        .then(({ mode }) => {
          showToast(mode === 'remote' ? 'Online backup uploaded ✓' : 'Online backup prepared on this device ✓');
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
    app.querySelector('#btn-online-disable')?.addEventListener('click', () => {
      disableOnlineAccountSession();
      showToast('Online features disabled ✓');
      renderLayer0();
    });

  } else if (section === 'sync') {
    renderConfigSync(app, back);

  } else if (section === 'peligro') {
    const WIPE_ROWS = [
      {id:'cache',      label:'Clear cache',              sub:'Forces download of the latest version.'},
      {id:'sistema',    label:'System',                   sub:'Alters, fronting, presets, system state, emotions.'},
      {id:'chat',       label:'Inner chat',               sub:'Messages, bulletin board, requests, norms.'},
      {id:'personal',   label:'Personal',                 sub:'Diary, notes, tracker, memory.'},
      {id:'fichas',     label:'Alter cards',              sub:'Alter profile cards.'},
      {id:'biblioteca', label:'Library',                  sub:'Contacts, resources, documents, health.'},
      {id:'agenda',     label:'Schedule, reminders & routines',     sub:'Events, reminders and routines.'},
      {id:'proyectos',  label:'Projects & tasks',         sub:'Projects and tasks.'},
      {id:'finanzas',   label:'Finances',                 sub:'Transactions, savings and budgets.'},
      {id:'crisis',     label:'Crisis',                   sub:'Protocols, techniques and calm messages.'},
      {id:'todo',       label:'Wipe all',                 sub:'Deletes all app data. Irreversible.'},
    ];
    app.innerHTML=`
    <div class="config-view" style="max-width:640px;margin:0 auto;animation:fadeUp 360ms ease both">
      <div class="config-section" style="border-color:rgba(255,107,138,.2)">
        <div class="config-section-header" style="border-color:rgba(255,107,138,.1)">
          <div class="config-section-icon">⚠️</div>
          <div><div class="config-section-title" style="color:var(--red)">Danger zone</div><div class="config-section-desc">These actions cannot be undone</div></div>
        </div>
        <div class="config-rows">
          ${WIPE_ROWS.map(r=>`
            <div class="danger-row" ${r.id==='todo'?'style="border-top:1px solid rgba(255,80,80,.2);padding-top:12px;margin-top:4px"':''}>
              <div><div class="danger-label">${r.label}</div><div class="danger-sub">${r.sub}</div></div>
              <button class="btn ${r.id==='cache'?'btn-ghost':'btn-danger'} btn-sm btn-wipe-action" data-wipe="${r.id}">${r.id==='cache'?'Clear':'Delete'}</button>
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
          showToast('Cache cleared. Reloading…');
          setTimeout(()=>location.reload(true), 800);
        } catch(e) { showToast('⚠ Could not clear cache'); }
        return;
      }
      openModal(`
        <div class="modal-title" style="color:#ff7f7f">⚠ Delete ${label}</div>
        <div class="form-grid">
          <div style="font-size:13px;line-height:1.6;color:var(--text-1)">
            This action will permanently and irreversibly delete all <strong>${label}</strong> data.
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-2)">
            Write <strong>DELETE</strong> to confirm:
          </div>
          <input type="text" id="wipe-peligro-confirm" placeholder="DELETE" style="letter-spacing:.1em;font-weight:700">
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-cancel>Cancel</button>
          <button class="btn btn-danger" data-submit>Delete ${label}</button>
        </div>`,
        (ov)=>{
          if (ov.querySelector('#wipe-peligro-confirm').value.trim() !== 'DELETE')
            return showToast('⚠ Write DELETE to confirm');
          closeModal();
          if (id === 'todo') { wipeAllData(); showToast('Data deleted'); }
          else { WIPE_GROUPS[id].forEach(k=>localStorage.removeItem(k)); showToast(`${label} deleted ✓`); }
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
          <div><div class="config-section-title">About Atria</div><div class="config-section-desc">${APP_VERSION} · Private, local-first, and made with care</div></div>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
          <div style="font-size:13px;color:var(--text-1);line-height:1.7">
            Atria is an internal management tool for dissociative systems, designed to work locally from the start.
            It helps you organize alters, fronting, agenda, journal, notes, and everyday care in one place.
            Your data is stored locally by default. If you enable online features, you can use an account to sync devices, friends, chat, and end-to-end encrypted backups.
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);display:flex;flex-direction:column;gap:4px">
            <div>Version · ${APP_VERSION}</div>
            <div>Storage · localStorage by default · optional online sync and backup</div>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <a href="https://ko-fi.com/lyokodev" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;background:rgba(160,138,255,0.12);color:var(--accent);font-size:12px;font-family:'DM Mono',monospace;text-decoration:none;border:1px solid rgba(160,138,255,0.2)">☕ Ko-fi</a>
            <a href="https://github.com/lyoko-dev" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;background:rgba(160,138,255,0.12);color:var(--accent);font-size:12px;font-family:'DM Mono',monospace;text-decoration:none;border:1px solid rgba(160,138,255,0.2)">◬ GitHub</a>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:16px">
            <button class="btn btn-ghost btn-sm" id="btn-relaunch-tutorial" style="font-size:12px">🎓 View tutorial again</button>
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
  {id:'muy-bien',  emoji:'🌟', label:'Very good'},
  {id:'bien',      emoji:'😊', label:'Good'},
  {id:'neutro',    emoji:'😐', label:'Neutral'},
  {id:'mal',       emoji:'😔', label:'Bad'},
  {id:'muy-mal',   emoji:'😢', label:'Very bad'},
  {id:'ansioso',   emoji:'😰', label:'Anxious'},
  {id:'enfadado',  emoji:'😠', label:'Angry'},
  {id:'confuso',   emoji:'😵', label:'Confused'},
  {id:'disociado', emoji:'🌫️', label:'Dissociated'},
  {id:'en-calma',  emoji:'🌿', label:'Calm'},
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
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Journal'}]);
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
              <div class="diario-alter-name">All</div>
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
          <div class="diario-filter-title">Emotional state</div>
          <div class="diario-mood-filter">
            <div class="mood-filter-chip${!diarioFilter.mood?' active':''}" data-mood="">All</div>
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
            <div>${filtered.length===0&&entries.length>0?'No entries with these filters':'Journal is empty'}</div>
          </div>` :
          Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([key, monthEntries])=>{
            const [y,m] = key.split('-');
            const label = new Date(+y,+m-1,1).toLocaleString('en-GB',{month:'long',year:'numeric'});
            return `<div class="diario-month-group">
              <div class="diario-month-label">
                <span style="text-transform:capitalize">${label}</span>
                <span>${monthEntries.length} entr${monthEntries.length!==1?'ies':'y'}</span>
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
    softDelete('Entry deleted', ()=>{}, ()=>{ const cur=loadEntries(); cur.push(entry); saveEntries(cur); renderNotasSolicView(); });
  }));
}

// INNER-CHAT
// ═══════════════════════════════════════════════
const REACTION_EMOJIS = ['❤️','😊','😢','😂','🔥','👍','💜','🌸','✨','🐺'];
const CHAN_COLORS = ['#8affe0','#a08aff','#ff8ae2','#ffb450','#8ab4ff','#ff6b8a','#5fffb0','#ffd580'];
const DEFAULT_CHANNELS = [
  {id:'general', name:'general',     icon:'#', desc:'General system channel', color:'#8affe0', type:'channel'},
  {id:'sistema', name:'system',      icon:'⚙', desc:'System notices and changes', color:'#8ab4ff', type:'channel'},
  {id:'apoyo',   name:'support',     icon:'💜', desc:'Mutual support space',         color:'#ff8ae2', type:'channel'},
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
    if(diff<60000) return 'Now';
    if(diff<3600000) return Math.floor(diff/60000)+'m';
    if(d.toDateString()===now.toDateString()) return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  };

  panel.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-icon" style="color:#a08aff">◈</div>
      <div class="chat-header-info">
        <div class="chat-header-name">System board</div>
        <div class="chat-header-desc">Messages visible to all alters</div>
      </div>
    </div>
    <div class="chat-messages" id="tablon-panel-list" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px">
      ${msgs.length===0?`<div class="chat-empty"><div class="chat-empty-icon">◈</div><div>No messages yet</div><div style="font-size:11px;color:var(--text-3)">Be the first to write</div></div>`:''}
      ${pinned?`<div class="tablon-pin" style="border:1px solid rgba(160,138,255,.3);background:rgba(160,138,255,.06);border-radius:10px;padding:12px 14px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--accent);margin-bottom:6px">◈ pinned message</div>
        ${(()=>{const a=alters.find(x=>x.id===pinned.alterId)||{emoji:'◎',bg:'var(--bg-2)',color:'var(--border)',name:'System'};
          return `<div style="display:flex;gap:10px;align-items:flex-start">
            <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:1.5px solid;background:${a.bg};border-color:${a.color};flex-shrink:0">${a.emoji}</div>
            <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:${a.color}">${esc(a.name)}</div>
            <div style="font-size:13px;color:var(--text-1);margin-top:3px;line-height:1.5">${escM(pinned.text)}</div></div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="icon-btn tablon-unpin" data-id="${pinned.id}" title="Desfijar" style="font-size:10px;opacity:.6">◈</button>
              ${pinned.alterId===activeAlter.id?`<button class="icon-btn tablon-del" data-id="${pinned.id}" title="Delete" style="font-size:11px;opacity:.5">✕</button>`:''}
            </div></div>`;
        })()}
      </div>`:''}
      ${msgs.filter(m=>!m.pinned).map(m=>{
        const a=alters.find(x=>x.id===m.alterId)||{emoji:'◎',bg:'var(--bg-2)',color:'var(--border)',name:'System'};
        return `<div class="tablon-msg-item" style="display:flex;gap:10px;align-items:flex-start">
          <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:1.5px solid;background:${a.bg};border-color:${a.color};flex-shrink:0">${a.emoji}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:12px;font-weight:700;color:${a.color}">${esc(a.name)}</span><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${fmtTs(m.ts)}</span></div>
            <div style="font-size:13px;color:var(--text-1);margin-top:2px;line-height:1.5">${escM(m.text)}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;opacity:0;transition:opacity .15s" class="tablon-item-actions">
            <button class="icon-btn tablon-pin" data-id="${m.id}" title="Fijar" style="font-size:10px">◈</button>
            ${m.alterId===activeAlter.id?`<button class="icon-btn tablon-del" data-id="${m.id}" title="Delete" style="font-size:11px">✕</button>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="chat-input-bar">
      <textarea class="chat-input" id="tablon-input" placeholder="Write on the board..." rows="1"></textarea>
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
    if(!confirm('Delete this message?')) return;
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
          <div>${isDM?'Start of your conversation with '+otherAlter?.name:'Start of channel # '+ch.name}</div>
          <div style="font-size:11px;color:var(--text-3)">Be the first to write</div>
        </div>`:
        renderMessageList(msgs)
      }
    </div>
    <div class="chat-input-area">
      <div class="chat-input-wrap" style="display:flex;align-items:flex-end;gap:6px">
        ${(()=>{const s=getAlters().find(a=>a.id===(chatSenderId||activeAlter.id))||activeAlter;return `<button id="chat-sender-btn" title="Change sending alter" style="flex-shrink:0;width:32px;height:32px;border-radius:50%;border:2px solid ${s.color};background:${s.bg};font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">${s.emoji||'◎'}</button>`;})()}
        <textarea class="chat-input" id="chat-input" placeholder="Write a message..." rows="1" style="flex:1"></textarea>
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
    const dateStr = d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
    if (dateStr !== lastDate) {
      html += `<div class="chat-date-divider">${dateStr}</div>`;
      lastDate = dateStr;
    }
    const timeStr = d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
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
        ${isSelf?`<button class="chat-action-btn btn-del-msg" data-mid="${msg.id}" title="Delete">✕</button>`:''}
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
    showToast('Message deleted');
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
    <div class="modal-title">New channel</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Channel name</div>
        <input type="text" id="nc-name" placeholder="e.g. venting, tasks, memories...">
      </div>
      <div class="form-row">
        <div class="form-label">Description (optional)</div>
        <input type="text" id="nc-desc" placeholder="What this channel is for">
      </div>
      <div class="form-row">
        <div class="form-label">Icon</div>
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
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>Create channel</button>
    </div>`,
    (ov) => {
      const name = ov.querySelector('#nc-name').value.trim().toLowerCase().replace(/\s+/g,'-');
      const desc = ov.querySelector('#nc-desc').value.trim();
      const icon = ov.querySelector('#nc-icon').value;
      const color= ov.querySelector('#nc-color').value;
      if (!name) return showToast('⚠ Name is required');
      const channels = loadChannels();
      if (channels.find(c=>c.id===name)) return showToast('⚠ A channel with that name already exists');
      channels.push({id:name,name,icon,desc,color,type:'channel'});
      saveChannels(channels);
      chatActiveChannel={id:name,name,icon,desc,color,type:'channel'};
      closeModal();
      showToast('# '+name+' created ✓');
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
// HEALTH
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
          <button class="btn btn-sm btn-primary" id="btn-new-trigger">+ Add</button>
        </div>
        <div class="salud-card-body" id="salud-triggers-list">
          ${triggers.length === 0
            ? '<div class="salud-empty">No triggers registered</div>'
            : triggers.map(t => {
                const alt = t.alterId ? alters.find(a=>a.id===t.alterId) : null;
                return `<div class="salud-item" data-id="${t.id}">
                  <div class="salud-item-main">
                    <div class="salud-item-title">${esc(t.titulo)}</div>
                    ${t.descripcion ? `<div class="salud-item-desc">${esc(t.descripcion)}</div>` : ''}
                    <div class="salud-item-tags">
                      ${alt ? `<span class="salud-tag" style="background:${alt.color||'var(--accent)'}22;color:${alt.color||'var(--accent)'}">⬡ ${esc(alt.name)}</span>` : ''}
                      ${t.provocaSwitcheo ? '<span class="salud-tag salud-tag-warn">⇄ Causes switching</span>' : ''}
                      ${t.intensidad ? `<span class="salud-tag">Intensity ${t.intensidad}/5</span>` : ''}
                    </div>
                  </div>
                  <div class="salud-item-actions">
                    <button class="btn btn-xs btn-ghost" data-edit-trigger="${t.id}">✎</button>
                    <button class="btn btn-xs btn-ghost btn-danger" data-del-trigger="${t.id}">✕</button>
                  </div>
                </div>`;
              }).join('')
          }
        </div>
      </div>

      <!-- ALLERGIES -->
      <div class="salud-card">
        <div class="salud-card-header">
          <div class="salud-card-title">⚠ Allergies</div>
          <button class="btn btn-sm btn-primary" id="btn-new-alergia">+ Add</button>
        </div>
        <div class="salud-card-body" id="salud-alergias-list">
          ${alergias.length === 0
            ? '<div class="salud-empty">No allergies registered</div>'
            : alergias.map(a => `<div class="salud-item" data-id="${a.id}">
                <div class="salud-item-main">
                  <div class="salud-item-title">${esc(a.nombre)}</div>
                  ${a.reaccion ? `<div class="salud-item-desc">Reaction: ${esc(a.reaccion)}</div>` : ''}
                  <div class="salud-item-tags">
                    <span class="salud-tag salud-tag-${a.gravedad||'media'}">${{leve:'● Mild',media:'●● Moderate',grave:'●●● Severe'}[a.gravedad]||'Moderate'}</span>
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

      <!-- MEDICATIONS -->
      <div class="salud-card">
        <div class="salud-card-header">
          <div class="salud-card-title">💊 Medications</div>
          <button class="btn btn-sm btn-primary" id="btn-new-medicacion">+ Add</button>
        </div>
        <div class="salud-card-body" id="salud-medicaciones-list">
          ${medicaciones.length === 0
            ? '<div class="salud-empty">No medications registered</div>'
            : medicaciones.map(m => {
                const reminders = loadReminders().filter(r => r.medicacionId === m.id);
                const taken = m.activa !== false && isMedTakenToday(m.id);
                return `<div class="salud-item${taken ? ' med-taken' : ''}" data-id="${m.id}">
                  <div class="salud-item-main">
                    <div class="salud-item-title">${esc(m.nombre)}</div>
                    ${m.dosis ? `<div class="salud-item-desc">${esc(m.dosis)}</div>` : ''}
                    <div class="salud-item-tags">
                      ${m.activa !== false ? '<span class="salud-tag salud-tag-ok">◎ Active</span>' : '<span class="salud-tag">◌ Inactive</span>'}
                      ${reminders.length > 0 ? `<span class="salud-tag" style="cursor:pointer" data-go-reminders>🔔 ${reminders.length} reminder${reminders.length>1?'s':''}</span>` : ''}
                      ${taken ? '<span class="salud-tag salud-tag-ok">✓ Taken today</span>' : ''}
                    </div>
                  </div>
                  <div class="salud-item-actions">
                    ${m.activa !== false ? `<button class="btn btn-xs ${taken ? 'btn-primary' : 'btn-ghost'}" data-toggle-med="${m.id}" title="${taken ? 'Mark as not taken' : 'Mark as taken today'}">${taken ? '✓' : '○'}</button>` : ''}
                    <button class="btn btn-xs btn-ghost" data-add-reminder-med="${m.id}" title="Add reminder">🔔</button>
                    <button class="btn btn-xs btn-ghost" data-edit-medicacion="${m.id}">✎</button>
                    <button class="btn btn-xs btn-ghost btn-danger" data-del-medicacion="${m.id}">✕</button>
                  </div>
                </div>`;
              }).join('')
          }
        </div>
      </div>

      <!-- MEDICAL APPOINTMENTS -->
      <div class="salud-card">
        <div class="salud-card-header">
          <div class="salud-card-title">🏥 Medical appointments</div>
          <button class="btn btn-sm btn-ghost" id="btn-ir-agenda">Go to agenda →</button>
        </div>
        <div class="salud-card-body" id="salud-citas-list">
          ${citasMedicas.length === 0
            ? '<div class="salud-empty">No appointments · Add events of type "Medical appt" in the agenda</div>'
            : citasMedicas.map(ev => {
                const isPast = ev.date < today;
                return `<div class="salud-item ${isPast ? 'salud-item-past' : ''}">
                  <div class="salud-item-main">
                    <div class="salud-item-title">🏥 ${esc(ev.title)}</div>
                    <div class="salud-item-desc">${ev.date}${ev.time?' · '+ev.time:''}${ev.note?' · '+esc(ev.note):''}</div>
                    ${isPast ? '<div class="salud-item-tags"><span class="salud-tag">◌ Past</span></div>' : ''}
                  </div>
                  <button class="btn btn-xs btn-ghost" data-edit-event="${ev.id}">✎</button>
                </div>`;
              }).join('')
          }
        </div>
      </div>

    </div>`;

  // Events
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
      if(!confirm('Delete trigger?')) return;
      saveSaludTriggers(loadSaludTriggers().filter(x=>x.id!==b.dataset.delTrigger));
      showToast('Trigger deleted'); _refreshSalud();
    });
  });
  cont.querySelectorAll('[data-edit-alergia]').forEach(b => {
    const a = alergias.find(x=>x.id===b.dataset.editAlergia);
    if(a) b.addEventListener('click', () => openAlergiaModal(a, ()=>{ _refreshSalud(); }));
  });
  cont.querySelectorAll('[data-del-alergia]').forEach(b => {
    b.addEventListener('click', () => {
      if(!confirm('Delete allergy?')) return;
      saveAlergias(loadAlergias().filter(x=>x.id!==b.dataset.delAlergia));
      showToast('Allergy deleted'); _refreshSalud();
    });
  });
  cont.querySelectorAll('[data-edit-medicacion]').forEach(b => {
    const m = medicaciones.find(x=>x.id===b.dataset.editMedicacion);
    if(m) b.addEventListener('click', () => openMedicacionModal(m, ()=>{ _refreshSalud(); }));
  });
  cont.querySelectorAll('[data-del-medicacion]').forEach(b => {
    b.addEventListener('click', () => {
      if(!confirm('Delete medication?')) return;
      saveMedicaciones(loadMedicaciones().filter(x=>x.id!==b.dataset.delMedicacion));
      showToast('Medication deleted'); _refreshSalud();
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

// ── HEALTH MODALS ──

function openTriggerModal(item, onDone) {
  const isEdit = !!item;
  const alters = getAlters();
  const t = item || { titulo:'', descripcion:'', alterId:null, provocaSwitcheo:false, intensidad:3 };

  openModal(`
    <div class="modal-title">${isEdit ? 'Edit trigger' : 'New trigger'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Title</div>
        <input type="text" id="tr-titulo" placeholder="Describe the trigger..." value="${esc(t.titulo)}">
      </div>
      <div class="form-row">
        <div class="form-label">Description (optional)</div>
        <textarea id="tr-desc" rows="3" placeholder="Context, situations, details...">${esc(t.descripcion)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Alter that causes it (optional)</div>
        <select id="tr-alter">
          <option value="">None / general</option>
          ${alters.map(a=>`<option value="${a.id}" ${t.alterId===a.id?'selected':''}>${a.emoji||''} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row" style="flex-direction:row;align-items:center;justify-content:space-between">
        <div>
          <div class="perm-toggle-label">⇄ Causes switching</div>
          <div class="perm-toggle-sublabel">This trigger may cause a fronting alter change</div>
        </div>
        <div class="toggle-switch ${t.provocaSwitcheo?'on':''}" id="tr-switcheo"></div>
      </div>
      <div class="form-row">
        <div class="form-label">Perceived intensity</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${[1,2,3,4,5].map(n=>`<div class="rec-opt${t.intensidad===n?' selected':''}" data-inten="${n}">${n}</div>`).join('')}
        </div>
        <input type="hidden" id="tr-intensidad" value="${t.intensidad||3}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit ? 'Save' : 'Add'}</button>
    </div>`,
    (ov) => {
      const titulo = ov.querySelector('#tr-titulo').value.trim();
      if(!titulo) return showToast('⚠ Title is required');
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
      showToast(isEdit ? 'Trigger updated ✓' : 'Trigger added ✓');
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
    <div class="modal-title">${isEdit ? 'Edit allergy' : 'New allergy'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Name / substance</div>
        <input type="text" id="al-nombre" placeholder="E.g. Ibuprofen, peanuts..." value="${esc(a.nombre)}">
      </div>
      <div class="form-row">
        <div class="form-label">Reaction</div>
        <input type="text" id="al-reaccion" placeholder="Describe the reaction..." value="${esc(a.reaccion)}">
      </div>
      <div class="form-row">
        <div class="form-label">Severity</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${[{id:'leve',label:'Mild'},{id:'media',label:'Moderate'},{id:'grave',label:'Severe'}].map(g=>`<div class="rec-opt${a.gravedad===g.id?' selected':''}" data-grav="${g.id}">${g.label}</div>`).join('')}
        </div>
        <input type="hidden" id="al-gravedad" value="${a.gravedad||'media'}">
      </div>
      <div class="form-row">
        <div class="form-label">Notes (optional)</div>
        <textarea id="al-notas" rows="2" placeholder="Additional information...">${esc(a.notas)}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit ? 'Save' : 'Add'}</button>
    </div>`,
    (ov) => {
      const nombre = ov.querySelector('#al-nombre').value.trim();
      if(!nombre) return showToast('⚠ Name is required');
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
      showToast(isEdit ? 'Allergy updated ✓' : 'Allergy added ✓');
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
    <div class="modal-title">${isEdit ? 'Edit medication' : 'New medication'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Name</div>
        <input type="text" id="med-nombre" placeholder="Medication name..." value="${esc(m.nombre)}">
      </div>
      <div class="form-row">
        <div class="form-label">Dose</div>
        <input type="text" id="med-dosis" placeholder="E.g. 20mg, 1 tablet..." value="${esc(m.dosis)}">
      </div>
      <div class="form-row">
        <div class="form-label">Frequency</div>
        <input type="text" id="med-frecuencia" placeholder="E.g. Every 8h, once a day..." value="${esc(m.frecuencia)}">
      </div>
      <div class="form-row">
        <div class="form-label">Notes (optional)</div>
        <textarea id="med-notas" rows="2" placeholder="Effects, instructions...">${esc(m.notas)}</textarea>
      </div>
      <div class="form-row" style="flex-direction:row;align-items:center;justify-content:space-between">
        <div>
          <div class="perm-toggle-label">◎ Active medication</div>
          <div class="perm-toggle-sublabel">Currently being taken?</div>
        </div>
        <div class="toggle-switch ${m.activa!==false?'on':''}" id="med-activa"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit ? 'Save' : 'Add'}</button>
    </div>`,
    (ov) => {
      const nombre = ov.querySelector('#med-nombre').value.trim();
      if(!nombre) return showToast('⚠ Name is required');
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
      showToast(isEdit ? 'Medication updated ✓' : 'Medication added ✓');
      if(onDone) onDone();
    }
  );
  const ov = document.querySelector('.modal-overlay');
  ov.querySelector('#med-activa')?.addEventListener('click', () => ov.querySelector('#med-activa').classList.toggle('on'));
}

function openMedicacionReminderModal(med, onDone) {
  // Creates a pre-filled reminder with the medication name, linked by medicationId
  const alters = getAlters();
  const dtDefault = new Date(Date.now() + 3600000).toISOString().slice(0,16);

  openModal(`
    <div class="modal-title">🔔 Reminder for ${esc(med?.nombre||'medication')}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Title</div>
        <input type="text" id="mrem-title" value="Take ${esc(med?.nombre||'')}${med?.dosis?' ('+esc(med.dosis)+')':''}" placeholder="Title...">
      </div>
      <div class="form-row">
        <div class="form-label">Date and time</div>
        <input type="datetime-local" id="mrem-dt" value="${dtDefault}">
      </div>
      <div class="form-row">
        <div class="form-label">Repeat</div>
        <div class="recurrence-opts">
          ${REMINDER_RECURRENCE.map(rc=>`<div class="rec-opt${rc.id==='daily'?' selected':''}" data-rc="${rc.id}">${rc.label}</div>`).join('')}
        </div>
        <input type="hidden" id="mrem-rec" value="daily">
      </div>
      <div class="form-row">
        <div class="form-label">For alter (optional)</div>
        <select id="mrem-alter">
          <option value="">Whole system</option>
          ${alters.map(a=>`<option value="${a.id}">${a.emoji||''} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>Create reminder</button>
    </div>`,
    (ov) => {
      const title = ov.querySelector('#mrem-title').value.trim();
      if(!title) return showToast('⚠ Title is required');
      const dtVal = ov.querySelector('#mrem-dt').value;
      if(!dtVal) return showToast('⚠ Date is required');
      const entry = {
        id: uid(),
        title,
        desc: med ? `Medication: ${med.nombre}${med.dosis?' — '+med.dosis:''}` : '',
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
      showToast('Medication reminder created ✓');
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
  {id:'none',   label:'No repeat'},
  {id:'daily',  label:'Daily'},
  {id:'weekly', label:'Weekly'},
  {id:'monthly',label:'Monthly'},
  {id:'yearly', label:'Annual'},
];
const EVENT_TYPES = [
  {id:'cita',       label:'Appointment', emoji:'📅'},
  {id:'terapia',    label:'Therapy',     emoji:'🧠'},
  {id:'tarea',      label:'Task',        emoji:'✓'},
  {id:'recordatorio',label:'Reminder',emoji:'🔔'},
  {id:'social',     label:'Social',      emoji:'👥'},
  {id:'personal',   label:'Personal',    emoji:'🌙'},
  {id:'otro',       label:'Other',       emoji:'◎'},
  {id:'cita_medica', label:'Medical appt', emoji:'🏥'},
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
  // Returns events visible to active alter: shared + own
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
  const e = ev || {
    title:'', type:'otro', date:today, time:'', duration:60,
    color:'#a08aff', scope:'personal', alterId:activeAlter.id,
    recur:'none', reminder:false, note:''
  };

  openModal(`
    <div class="modal-title">${isEdit?'Edit event':'New event'}</div>
    <div class="form-grid">
      <div class="form-row">
        <div class="form-label">Title</div>
        <input type="text" id="ev-title" placeholder="Event name" value="${e.title||''}">
      </div>

      <div class="form-row">
        <div class="form-label">Type</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${EVENT_TYPES.map(t=>`<div class="recur-opt ${e.type===t.id?'selected':''}" data-etype="${t.id}">${t.emoji} ${t.label}</div>`).join('')}
        </div>
        <input type="hidden" id="ev-type" value="${e.type||'otro'}">
      </div>

      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Date</div>
          <input type="date" id="ev-date" value="${e.date||today}">
        </div>
        <div class="form-row">
          <div class="form-label">Time (optional)</div>
          <input type="time" id="ev-time" value="${e.time||''}">
        </div>
      </div>

      <div class="form-row two-col">
        <div class="form-row">
          <div class="form-label">Duration (min)</div>
          <input type="number" id="ev-dur" min="5" step="5" value="${e.duration||60}">
        </div>
        <div class="form-row">
          <div class="form-label">Color</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0">
            ${AGENDA_COLORS.map(c=>`<div class="color-swatch ${e.color===c?'selected':''}" data-color="${c}" style="background:${c};width:24px;height:24px"></div>`).join('')}
          </div>
          <input type="hidden" id="ev-color" value="${e.color||'#a08aff'}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-label">Visibility</div>
        <div class="scope-tabs">
          <div class="scope-tab ${e.scope==='personal'?'active':''}" data-scope="personal">🔒 Personal</div>
          <div class="scope-tab ${e.scope==='compartido'?'active':''}" data-scope="compartido">🌐 Shared</div>
        </div>
        <input type="hidden" id="ev-scope" value="${e.scope||'personal'}">
      </div>

      <div class="form-row" id="alter-row" style="${e.scope==='compartido'?'display:none':''}">
        <div class="form-label">Assign to alter</div>
        <select id="ev-alter">
          ${alters.map(a=>`<option value="${a.id}" ${e.alterId===a.id?'selected':''}>${a.emoji} ${esc(a.name)}</option>`).join('')}
        </select>
      </div>

      <div class="form-row">
        <div class="form-label">Repeat</div>
        <div class="recur-opts">
          ${RECUR_OPTS.map(r=>`<div class="recur-opt ${e.recur===r.id?'selected':''}" data-recur="${r.id}">${r.label}</div>`).join('')}
        </div>
        <input type="hidden" id="ev-recur" value="${e.recur||'none'}">
      </div>

      <div class="form-row" style="flex-direction:row;align-items:center;justify-content:space-between">
        <div>
          <div class="perm-toggle-label">🔔 Visual reminder</div>
          <div class="perm-toggle-sublabel">Highlights the event in the agenda</div>
        </div>
        <div class="toggle-switch ${e.reminder?'on':''}" id="ev-reminder"></div>
      </div>

      <div class="form-row">
        <div class="form-label">Notes</div>
        <textarea id="ev-note" placeholder="Additional details...">${e.note||''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Create event'}</button>
    </div>`,
    (overlay) => {
      const title    = overlay.querySelector('#ev-title').value.trim();
      const type     = overlay.querySelector('#ev-type').value;
      const date     = overlay.querySelector('#ev-date').value;
      const time     = overlay.querySelector('#ev-time').value;
      const duration = parseInt(overlay.querySelector('#ev-dur').value)||60;
      const color    = overlay.querySelector('#ev-color').value;
      const scope    = overlay.querySelector('#ev-scope').value;
      const alterId  = overlay.querySelector('#ev-alter').value;
      const recur    = overlay.querySelector('#ev-recur').value;
      const reminder = overlay.querySelector('#ev-reminder').classList.contains('on');
      const note     = overlay.querySelector('#ev-note').value.trim();
      if(!title||!date) return showToast('⚠ Title and date are required');
      let list = loadEvents();
      const entry = {id:ev?.id||uid(),title,type,date,time,duration,color,scope,alterId,recur,reminder,note};
      if(isEdit) list = list.map(x=>x.id===ev.id?entry:x);
      else list.push(entry);
      saveEvents(list);
      closeModal();
      showToast(isEdit?'Event updated ✓':'Event created ✓');
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
  // Toggle
  ov.querySelector('#ev-reminder')?.addEventListener('click',()=>ov.querySelector('#ev-reminder').classList.toggle('on'));
}

// ═══════════════════════════════════════════════
// ONBOARDING (primera vez)
// ═══════════════════════════════════════════════
// TUTORIAL (first hub visit)
// ═══════════════════════════════════════════════
function showTutorial() {
  if (document.getElementById('tut-overlay')) return;

  const STEPS = [
    {
      label: 'Tutorial · 1 of 5',
      title: 'Your control panel',
      desc: 'The Hub is your entry point every time you access the system. From here you reach every module in a single tap.',
      features: [
        { icon: '⚡', name: 'Quick access', desc: 'All modules visible at a glance' },
        { icon: '◈', name: 'Board', desc: 'Pinned system messages at a glance' },
        { icon: '◷', name: 'Active fronting', desc: 'Who is present in real time' },
      ]
    },
    {
      label: 'Tutorial · 2 of 5',
      title: 'System',
      desc: 'Manage who makes up your system, log fronting sessions, and track the collective emotional state.',
      features: [
        { icon: '👥', name: 'Profiles', desc: 'Cards with roles, permissions and appearance for each part' },
        { icon: '🔄', name: 'Fronting', desc: 'Fronting sessions with history and statistics' },
        { icon: '🎭', name: 'Tracker', desc: 'Daily emotional state log' },
      ]
    },
    {
      label: 'Tutorial · 3 of 5',
      title: 'Communication and personal space',
      desc: 'Organise internal communication and each part’s personal space.',
      features: [
        { icon: '💬', name: 'Communication', desc: 'Internal chat, board, requests and wishlist' },
        { icon: '📓', name: 'Diary', desc: 'Personal entries with privacy levels' },
        { icon: '📚', name: 'Library and norms', desc: 'Resources, documents and system rules' },
      ]
    },
    {
      label: 'Tutorial · 4 of 5',
      title: 'Tools',
      desc: 'Organise your day with a calendar, routines, projects and a full finance tracker.',
      features: [
        { icon: '📅', name: 'Calendar', desc: 'Appointments, events and reminders with notifications' },
        { icon: '🔁', name: 'Routines', desc: 'Daily habits with adherence tracking' },
        { icon: '💰', name: 'Finance', desc: 'Expenses, savings and budgets per alter' },
      ]
    },
    {
      label: 'Tutorial · 5 of 5',
      title: 'Your data and connections',
      desc: 'By default your data stays on this device. If you enable Online, you can sync across devices and keep an automatic encrypted backup.',
      features: [
        { icon: '☁️', name: 'Online and Sync', desc: 'Friends, online chat and encrypted multi-device sync' },
        { icon: '💾', name: 'Backups', desc: 'Automatic online backup or manual export/import' },
        { icon: '🔒', name: 'PIN', desc: 'Protect access with a local password' },
        { icon: '⚙️', name: 'Settings', desc: 'Manage privacy, devices and notifications' },
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
            ${step > 0 ? `<button class="btn btn-ghost" id="tut-back">← Back</button>` : ''}
            <button class="btn btn-primary" id="tut-next">${isLast ? 'Got it ✓' : 'Next →'}</button>
            ${!isLast ? `<button class="btn btn-ghost" id="tut-skip" style="margin-left:auto;font-size:12px;opacity:.7">Skip tutorial</button>` : ''}
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

  const tabLabel = {perfiles:'Profiles', fichas:'Cards'};
  const _altLabel = {perfiles:'Profiles',fichas:'Cards'};
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Alters · '+(_altLabel[alteresTab]||'Profiles')}]);
  const app = document.getElementById('app');
  const alters = getAlters();
  const btnNew = alteresTab==='perfiles'
    ? `<button class="btn btn-primary" id="btn-alters-new">+ New alter</button>`
    : `<button class="btn btn-primary" id="btn-alters-new">+ New card</button>`;

  app.innerHTML = `
    <div class="perfiles-view" style="max-width:960px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fin-title">◎ System alters</div>
          <div class="fin-subtitle">${alters.length} alter${alters.length!==1?'s':''} registered${(() => { const arch = getAlters(true).filter(a=>a.isArchived); return arch.length ? ` · <span style="color:#ffd580">${arch.length} archived</span>` : ''; })()}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${(() => { const arch = getAlters(true).filter(a=>a.isArchived); return arch.length ? `<button class="btn btn-ghost btn-sm" id="btn-show-archived">◫ Archived</button>` : ''; })()}
          ${btnNew}
        </div>
      </div>
      <div class="module-tabs">
        <div class="module-tab${alteresTab==='perfiles'?' active':''}" data-at="perfiles">◎ Profiles</div>
        <div class="module-tab${alteresTab==='fichas'?' active':''}" data-at="fichas">◈ Cards</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 6px">
        <div class="view-toggle-group">
          <button class="view-toggle-btn${alteresViewMode==='cards'?' active':''}" id="btn-view-cards" title="Card view">⊞</button>
          <button class="view-toggle-btn${alteresViewMode==='list'?' active':''}" id="btn-view-list" title="List view">☰</button>
        </div>
        <select id="sort-select" class="sort-select">
          <option value="default"${alteresSortMode==='default'?' selected':''}>Default order</option>
          <option value="alpha"${alteresSortMode==='alpha'?' selected':''}>A–Z</option>
          <option value="date"${alteresSortMode==='date'?' selected':''}>Creation date</option>
        </select>
        ${alteresTab==='perfiles'
          ? `<select id="role-filter-select" class="sort-select">
              <option value="">All roles</option>
              ${ROLE_TYPES.map(r=>`<option value="${r.id}"${alteresRoleFilter===r.id?' selected':''}>${r.emoji} ${r.label}</option>`).join('')}
             </select>`
          : (() => {
              const roles = [...new Set(loadFichas().map(f=>(f.rol_publico||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
              return roles.length ? `<select id="role-filter-select" class="sort-select">
                <option value="">All roles</option>
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
  const allAltersList = getAlters(); // full list to resolve relationships
  const fichas = loadFichas();
  const subsystems = loadSubsystems();

  // Filter by role
  if(alteresRoleFilter) alters = alters.filter(a => a.roleType === alteresRoleFilter);
  // Sort
  if(alteresSortMode === 'alpha') alters = [...alters].sort((a,b)=>a.name.localeCompare(b.name));
  else if(alteresSortMode === 'date') alters = [...alters].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));

  const isListMode = alteresViewMode === 'list';

  const _cardHtml = (a) => {
    const rt = getAllRoleTypes().find(r=>r.id===a.roleType);
    const at = AGE_TYPES.find(x=>x.id===a.ageType);
    const ficha = fichas.find(f => f.alterId === a.id) || fichas.find(f => f.nombre && f.nombre.toLowerCase() === a.name.toLowerCase());
    const fichaBtn = ficha
      ? `<button class="btn btn-ghost btn-sm btn-ver-ficha" data-id="${a.id}" data-ficha-id="${ficha.id}" style="color:var(--accent);border-color:rgba(160,138,255,0.25)">◈ View card</button>`
      : `<button class="btn btn-ghost btn-sm btn-crear-ficha" data-id="${a.id}" style="color:var(--text-2)">◈ Create card</button>`;
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
          <button class="btn btn-ghost btn-sm" data-move-alter="${a.id}" data-direction="-1" title="Move up">↑</button><button class="btn btn-ghost btn-sm" data-move-alter="${a.id}" data-direction="1" title="Move down">↓</button><button class="btn btn-ghost btn-sm btn-edit-p" data-id="${a.id}">✎ Edit</button>
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
        <button class="btn btn-ghost btn-sm" data-move-alter="${a.id}" data-direction="-1" title="Move up">↑</button><button class="btn btn-ghost btn-sm" data-move-alter="${a.id}" data-direction="1" title="Move down">↓</button><button class="btn btn-ghost btn-sm btn-edit-p" data-id="${a.id}">✎ Edit</button>
        ${fichaBtn}
        ${!a.isAdmin?`<button class="btn btn-danger btn-sm btn-del-p" data-id="${a.id}">✕ Delete</button>`:''}
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
          <span class="subsystem-group-name" style="color:var(--text-2)">No subsystem</span>
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
      <button class="btn btn-ghost btn-sm" id="btn-manage-subsystems" style="font-size:11px">◉ Manage subsystems</button>
    </div>` : ''}
    <div class="${isListMode?'alters-list':'perfiles-grid'}" id="perfiles-grid">${subsystems.length?'':gridHtml}</div>
    ${subsystems.length?`<div id="perfiles-subsystem-container">${gridHtml}</div>`:''}`;
  const actionsRoot = cont.querySelector('#perfiles-subsystem-container') || cont.querySelector('#perfiles-grid') || cont;

  if(activeAlter?.isAdmin) {
    cont.querySelector('#btn-manage-subsystems')?.addEventListener('click', openSubsystemsModal);
    cont.querySelectorAll('.btn-ss-edit').forEach(b=>b.addEventListener('click',()=>openSubsystemsModal(b.dataset.ssid)));
  }
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
    if(!confirm('Delete this alter and all their data?')) return;
    purgeAlterData(b.dataset.id);
    saveAlters(getAlters(true).filter(x=>x.id!==b.dataset.id));
    ALTERS = getAlters();
    renderAlters();
    showToast('Alter deleted');
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
          <button class="btn btn-ghost btn-xs" data-move-ss="${ss.id}" data-direction="-1" title="Move up">↑</button><button class="btn btn-ghost btn-xs" data-move-ss="${ss.id}" data-direction="1" title="Move down">↓</button><button class="btn btn-ghost btn-xs btn-ss-ed" data-ssid="${ss.id}">✎</button>
          <button class="btn btn-danger btn-xs btn-ss-del" data-ssid="${ss.id}">✕</button>
        </div>`).join('')
      : `<div style="font-size:12px;color:var(--text-3);padding:12px 0">No subsystems defined yet.</div>`;
    listEl.querySelectorAll('.btn-ss-del').forEach(b=>b.addEventListener('click',()=>{
      if(!confirm('Delete this subsystem?')) return;
      saveSubsystems(loadSubsystems().filter(s=>s.id!==b.dataset.ssid));
      if(closeAndRefresh) closeAndRefresh('Subsystem deleted');
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
      saveBtn.textContent = 'Save changes';
    }));
  };

  let editingId = null;
  const ov = document.createElement('div'); ov.className='modal-overlay';
  ov.innerHTML=`<div class="modal" style="max-width:400px">
    <div class="modal-header"><span style="font-weight:700">◉ Subsystems</span><button class="modal-close" id="ss-close">✕</button></div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
      <div id="ss-list"></div>
      <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:8px">
        <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.08em">New / edit</div>
        <input class="input" id="ss-name" placeholder="Subsystem name" maxlength="40">
        <input class="input" id="ss-desc" placeholder="Description (optional)" maxlength="100">
        <div style="display:flex;align-items:center;gap:8px">
          <label style="font-size:12px;color:var(--text-2)">Color</label>
          <input type="color" id="ss-color" value="#a08aff" style="height:32px;border-radius:6px;border:1px solid var(--border);cursor:pointer">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" id="ss-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" id="ss-save">Add subsystem</button>
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
  ov.querySelector('#ss-cancel').addEventListener('click',()=>{ editingId=null; nameInput.value=''; descInput.value=''; colorInput.value='#a08aff'; saveBtn.textContent='Add subsystem'; });
  ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
  saveBtn.addEventListener('click',()=>{
    const name = nameInput.value.trim();
    if(!name) return showToast('⚠ Name is required');
    const list = loadSubsystems();
    const hex  = colorInput.value||'#a08aff';
    if(editingId) {
      const idx = list.findIndex(s=>s.id===editingId);
      if(idx>=0) list[idx] = {...list[idx], name, description: descInput.value.trim(), color: hex};
      editingId = null; saveBtn.textContent = 'Add subsystem';
    } else {
      list.push({id:uid(), name, description: descInput.value.trim(), color: hex});
    }
    saveSubsystems(list);
    closeAndRefresh('Subsystem saved ✓');
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

  // Temporary state for avatar and banner
  let _avatarImg  = a.avatarImg || null;  // base64 string or null
  let _avatarMode = _avatarImg ? 'img' : 'emoji'; // 'emoji' | 'img'
  let _bannerImg  = a.bannerImg || null;  // base64 string or null
  let _galleryImgs = Array.isArray(a.galleryImgs) ? [...a.galleryImgs] : [];
  let _referenceImgs = Array.isArray(a.referenceImgs) ? [...a.referenceImgs] : [];
  let _mediaTracking = Array.isArray(a.mediaTracking) ? [...a.mediaTracking] : [];
  const _isCustomColor = !ALTER_COLORS.includes(a.color);

  const modalHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div class="modal-title">${isEdit?'Edit profile':'New alter'}</div>
        <div class="modal-subtitle">${isEdit?a.name:'Full settings'}</div>
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
        <div id="preview-name" class="alter-modal-pname">${a.name||'Name'}</div>
        <div id="preview-role" class="alter-modal-prole" style="color:${a.color}">${a.role||'Role'}</div>
      </div>

      <!-- Formulario con tabs -->
      <div class="alter-modal-form">
        <div class="type-tabs" id="modal-tabs">
          <div class="type-tab active" data-tab="basic">Basic</div>
          <div class="type-tab" data-tab="apariencia">Appearance</div>
          ${activeAlter?.isAdmin ? `<div class="type-tab" data-tab="permisos">Permissions</div>` : ''}
          ${isEdit ? `<div class="type-tab" data-tab="relaciones">Relationships</div>` : ''}
          ${isEdit ? `<div class="type-tab" data-tab="media">Media</div>` : ''}
        </div>

        <!-- TAB BÁSICO -->
        <div id="tab-basic" class="form-grid" style="margin-top:14px">
          <div class="form-row">
            <div class="form-label">Name</div>
            <input type="text" id="a-name" placeholder="Alter name" value="${a.name||''}">
          </div>
          <div class="alter-two-col">
            <div class="form-row">
              <div class="form-label">Pronouns</div>
              <input type="text" id="a-pronouns" placeholder="she/her · he/him · they/them…" value="${escC(a.pronouns||'')}" autocomplete="off">
            </div>
            <div class="form-row">
              <div class="form-label">Apparent age</div>
              <select id="a-agetype">
                ${AGE_TYPES.map(x=>`<option value="${x.id}" ${a.ageType===x.id?'selected':''}>${x.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-label">Role type</div>
            <div class="role-type-grid" id="role-type-grid">
              ${getAllRoleTypes().map(r=>`
                <div class="role-type-opt ${a.roleType===r.id?'selected':''}" data-rt="${r.id}">
                  <div class="rt-emoji">${r.emoji}</div>
                  <div class="rt-label">${r.label}</div>
                </div>`).join('')}
              <div class="role-type-opt" id="btn-add-role-type" title="Add custom role type">
                <div class="rt-emoji">+</div>
                <div class="rt-label">Custom</div>
              </div>
              <div class="role-type-opt" id="btn-manage-role-types" title="Edit, delete or reorder custom roles">
                <div class="rt-emoji">☷</div>
                <div class="rt-label">Manage</div>
              </div>
            </div>
            <input type="hidden" id="a-roletype" value="${a.roleType||'otro'}">
          </div>
          <div class="form-row">
            <div class="form-label">Role name</div>
            <input type="text" id="a-role" placeholder="E.g. Co-host, Guardian..." value="${a.role||''}">
          </div>
          <div class="form-row">
            <div class="form-label">Description / notes</div>
            <textarea id="a-desc" placeholder="Alter description, function in the system...">${a.description||''}</textarea>
          </div>
          <div class="alter-two-col">
            <div class="form-row"><div class="form-label">Flags / terms</div><input type="text" id="a-flags" placeholder="creator, introject, fictive..." value="${escC((a.identityFlags||[]).join(', '))}"><div style="font-size:10px;color:var(--text-3)">Comma-separated labels for identity context</div></div>
            <div class="form-row"><div class="form-label">Personal terms</div><input type="text" id="a-terms" placeholder="Preferred terms, language or boundaries" value="${escC(a.identityTerms||'')}"></div>
          </div>
          <div class="form-row"><div class="form-label">Mentioned identities</div><div style="display:flex;flex-wrap:wrap;gap:6px">${getAlters(true).filter(x=>x.id!==a.id).map(x=>`<label class="front-cofront-chip"><input type="checkbox" data-mention-id="${x.id}" ${(a.mentionedAlterIds||[]).includes(x.id)?'checked':''}> ${esc(x.emoji||'◎')} ${esc(x.name)}</label>`).join('') || '<span style="font-size:11px;color:var(--text-3)">Create another profile to mention it here.</span>'}</div><div style="font-size:10px;color:var(--text-3)">Private local cross-member references; not shared online by default.</div></div>
          <div class="alter-two-col">
            <div class="form-row">
              <div class="form-label">Presence frequency</div>
              <select id="a-frecuencia">
                <option value="rara" ${(a.frecuencia||'ocasional')==='rara'?'selected':''}>○ Rare</option>
                <option value="ocasional" ${(a.frecuencia||'ocasional')==='ocasional'?'selected':''}>◑ Occasional</option>
                <option value="frecuente" ${(a.frecuencia||'ocasional')==='frecuente'?'selected':''}>● Frequent</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-label">State</div>
              <select id="a-state">
                ${ALTER_STATES.map(s=>`<option value="${s.id}" ${(a.state||'activo')===s.id?'selected':''}>${s.icon} ${s.label}</option>`).join('')}
              </select>
            </div>
          </div>
          ${activeAlter?.isAdmin ? `<div class="form-row">
            <div class="form-label">Subsystem</div>
            <select id="a-subsystem">
              <option value="">— No subsystem —</option>
              ${loadSubsystems().map(s=>`<option value="${s.id}" ${a.subsystemId===s.id?'selected':''}>${s.name}</option>`).join('')}
            </select>
          </div>` : ''}
          <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
            <div style="font-size:10px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Memory boundaries</div>
            <div class="form-row">
              <div class="form-label">What do they know about the system?</div>
              <textarea id="a-memoria-conoce" rows="2" placeholder="Knows about: other alters, events, history...">${escM(a.memoriaConoce||'')}</textarea>
            </div>
            <div class="form-row">
              <div class="form-label">What do they NOT know?</div>
              <textarea id="a-memoria-no-conoce" rows="2" placeholder="Has no access to: trauma X, alter Y, period Z...">${escM(a.memoriaNoConoce||'')}</textarea>
            </div>
          </div>
          ${activeAlter?.isAdmin ? `<div class="form-row" style="flex-direction:row;align-items:center;justify-content:space-between">
            <div>
              <div class="perm-toggle-label">System admin</div>
              <div class="perm-toggle-sublabel">${isOnlyAdmin?'At least one system admin is required':'Can manage other profiles'}</div>
            </div>
            <div class="toggle-switch ${a.isAdmin?'on':''}" id="toggle-admin" data-admin-toggle="1" ${isOnlyAdmin?'data-locked-admin="1"':''}></div>
          </div>` : a.isAdmin ? `<div style="font-family:DM Mono,monospace;font-size:11px;color:var(--text-2);padding:6px 0">⚠ This alter is the main system administrator</div>` : ''}
        </div>

        <!-- TAB APARIENCIA -->
        <div id="tab-apariencia" class="form-grid" style="margin-top:14px;display:none">

          <!-- AVATAR: emoji o imagen -->
          <div class="form-row">
            <div class="form-label">Avatar</div>
            <div class="avatar-mode-toggle">
              <div class="avatar-mode-btn${_avatarMode==='emoji'?' active':''}" id="avatar-mode-emoji">Emoji</div>
              <div class="avatar-mode-btn${_avatarMode==='img'?' active':''}" id="avatar-mode-img">Image</div>
            </div>
          </div>

          <div id="avatar-emoji-panel" style="${_avatarMode==='img'?'display:none':''}">
            <div id="emoji-cat-filter" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
              <button class="emoji-cat-btn active" data-cat="all" style="padding:2px 9px;border-radius:20px;border:1px solid rgba(160,138,255,.8);background:rgba(160,138,255,.2);color:var(--text-0);font-size:11px;cursor:pointer;transition:all .15s">All</button>
              <button class="emoji-cat-btn" data-cat="cos" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">🌌 Cosmos</button>
              <button class="emoji-cat-btn" data-cat="nat" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">🌿 Nature</button>
              <button class="emoji-cat-btn" data-cat="ani" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">🐾 Animals</button>
              <button class="emoji-cat-btn" data-cat="mag" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">✨ Magic</button>
              <button class="emoji-cat-btn" data-cat="cor" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">❤️ Hearts</button>
              <button class="emoji-cat-btn" data-cat="pod" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">⚔️ Power</button>
              <button class="emoji-cat-btn" data-cat="per" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">🧑 People</button>
              <button class="emoji-cat-btn" data-cat="obj" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">📚 Objects</button>
              <button class="emoji-cat-btn" data-cat="mis" style="padding:2px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-2);font-size:11px;cursor:pointer;transition:all .15s">🌈 Misc</button>
            </div>
            <input type="text" id="emoji-search" placeholder="🔍 Search emoji..." autocomplete="off"
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
                <button class="btn btn-ghost btn-sm" id="btn-remove-img" style="margin-top:6px;font-size:11px">✕ Remove image</button>
              </div>
              <div id="avatar-img-placeholder" style="${_avatarImg?'display:none':''}">
                <div style="font-size:28px;margin-bottom:6px">📷</div>
                <div style="font-size:12px;color:var(--text-2)">Upload avatar image</div>
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:3px">JPG, PNG, WEBP · max. 2MB</div>
              </div>
              <input type="file" id="avatar-file-input" accept="image/*" style="display:none">
            </div>
            <input type="hidden" id="a-avatar-img" value="${_avatarImg||''}">
          </div>

          <div class="form-row">
            <div class="form-label">Alter color</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px">
              ${ALTER_COLORS.map(c=>`<div class="color-swatch ${a.color===c?'selected':''}" data-color="${c}" style="background:${c}"></div>`).join('')}
              <label class="color-swatch${_isCustomColor?' selected':''}" id="custom-color-swatch" for="a-custom-color-input" title="Custom color"
                style="${_isCustomColor?`background:${a.color}`:'background:linear-gradient(135deg,#a08aff,#ff8ae2,#ffb450,#8affe0)'};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;line-height:1;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.7);cursor:pointer;border-color:rgba(255,255,255,0.25)">+</label>
            </div>
            <input type="color" id="a-custom-color-input" value="${a.color||'#a08aff'}" style="visibility:hidden;width:0;height:0;border:0;padding:0;margin:0;display:block">
            <input type="hidden" id="a-color" value="${a.color||'#a08aff'}">
            <div id="color-contrast-warn" style="display:none;color:#e07b00;font-size:12px;margin-top:4px">⚠ Low contrast with white text — may be hard to read (WCAG AA)</div>
          </div>

          <div class="form-row">
            <div class="form-label">Profile banner</div>
            <div class="avatar-upload-area" id="banner-upload-area" style="height:72px;flex-direction:row;justify-content:center;${_bannerImg?`background-image:url(${_bannerImg});background-size:cover;background-position:center;border-color:var(--border-active)`:''}">
              ${_bannerImg
                ? `<button class="btn btn-ghost btn-sm" id="btn-remove-banner" style="font-size:11px;background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.2);color:#fff">✕ Remove banner</button>`
                : `<div style="text-align:center"><div style="font-size:20px;margin-bottom:4px">🖼</div><div style="font-size:11px;color:var(--text-2)">Banner image</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);margin-top:2px">Shown behind the avatar on the profile card</div></div>`
              }
              <input type="file" id="banner-file-input" accept="image/*" style="display:none">
            </div>
            <input type="hidden" id="a-banner-img" value="${_bannerImg||''}">
          </div>
          <div class="form-row"><div class="form-label">Image gallery</div><div class="image-gallery-grid" id="alter-gallery-previews">${_galleryImgs.map((img,i)=>`<div class="image-gallery-item"><img src="${img}" alt=""><button type="button" class="btn btn-ghost btn-sm" data-remove-gallery="${i}">✕</button></div>`).join('')}</div><label class="avatar-upload-area gallery-add-area" for="alter-gallery-input"><span style="font-size:20px">＋</span><span>Add images</span><small>JPG, PNG or WEBP · max. 8 MB each</small></label><input type="file" id="alter-gallery-input" accept="image/jpeg,image/png,image/webp,image/gif" multiple style="display:none"></div>
          <div class="form-row"><div class="form-label">Reference images</div><textarea id="alter-reference-imgs" rows="3" placeholder="One link per line (faceclaims, visual references...)">${_referenceImgs.join('\n')}</textarea><div style="font-size:10px;color:var(--text-3)">Only links are saved; images are not downloaded automatically.</div></div>
        </div>

        <!-- TAB PERMISOS -->
        <div id="tab-permisos" style="margin-top:14px;display:none">
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-bottom:10px;letter-spacing:.1em;text-transform:uppercase">Intimacy level</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:10px">Determines whether this alter can appear in future online sharing.</div>
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
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-bottom:12px;letter-spacing:.1em;text-transform:uppercase">Access by module</div>
          ${MODULES_PERMS.map(m=>`
            <div class="perm-toggle-row">
              <div>
                <div class="perm-toggle-label">${m.label}</div>
                <div class="perm-toggle-sublabel">${m.desc}</div>
              </div>
              <div class="toggle-switch ${a.permissions?.[m.id]?'on':''}" id="perm-${m.id}" data-perm="${m.id}"></div>
            </div>`).join('')}
          <div id="perm-summary" style="margin-top:16px;padding:12px 14px;background:var(--bg-0);border:1px solid var(--border);border-radius:var(--radius-md)">
            <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Visibility summary</div>
            <div id="perm-summary-content" style="display:flex;flex-wrap:wrap;gap:6px">
              ${MODULES_PERMS.map(m=>`<span class="perm-chip ${a.permissions?.[m.id]?'on':'off'}" id="perm-chip-${m.id}">${a.permissions?.[m.id]?'✓':'✕'} ${m.label}</span>`).join('')}
            </div>
          </div>
        </div>

        ${isEdit ? `<div id="tab-media" style="margin-top:14px;display:none"><div class="media-tracking-list" id="media-tracking-list"></div><button type="button" class="btn btn-ghost btn-sm" id="btn-add-media">+ Add media</button></div>` : ''}

        <!-- TAB RELATIONSHIPS -->
        ${isEdit ? `<div id="tab-relaciones" style="margin-top:14px;display:none">
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2);margin-bottom:12px;letter-spacing:.1em;text-transform:uppercase">Links with other alters</div>
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
                <button class="icon-btn btn-del-rel" data-rel-id="${rel.id}" title="Remove">✕</button>
              </div>`;
            }).join('')}
          </div>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--border);padding-top:12px">
            <div style="font-size:11px;color:var(--text-3);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.08em">Add link</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
              <select id="rel-target" style="flex:1;min-width:100px">
                <option value="">Alter…</option>
                ${getAlters().filter(x=>x.id!==a.id).map(x=>`<option value="${x.id}">${x.emoji||''} ${escM(x.name)}</option>`).join('')}
              </select>
              <select id="rel-type" style="flex:1;min-width:100px">
                ${RELATION_TYPES.map(t=>`<option value="${t.id}">${t.label}</option>`).join('')}
              </select>
              <input type="text" id="rel-label" maxlength="40" placeholder="Custom link name (optional)" style="flex:1.5;min-width:150px">
              <input type="text" id="rel-note" placeholder="Note (optional)" style="flex:2;min-width:120px">
              <button class="btn btn-primary btn-sm" id="btn-add-rel">Add</button>
            </div>
          </div>
        </div>` : ''}
        </div>
      </div>
    </div>

    <!-- TAB EXTRAS -->
        ${isEdit?`<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px">
          <div class="form-row">
            <div class="form-label">Archive alter</div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:12px;color:var(--text-2)">Hides the alter without deleting their data</div>
              </div>
              <div class="toggle-switch ${a.isArchived?'on':''}" id="toggle-archive"></div>
            </div>
            ${a.isArchived?`<div class="form-row" style="margin-top:8px">
              <div class="form-label">Reason for archiving</div>
              <input type="text" id="archive-reason" placeholder="Optional..." value="${a.archiveReason||''}">
            </div>`:''}
          </div>
        </div>`:''}

    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save Changes':'Create alter'}</button>
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
      showToast('Warning: At least one system admin is required');
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
    if(!name) return showToast('⚠ Name is required');

    const hex = color.replace('#','');
    const r=parseInt(hex.substring(0,2),16),g=parseInt(hex.substring(2,4),16),b=parseInt(hex.substring(4,6),16);
    const bg = `rgba(${r},${g},${b},0.12)`;
    const displayRole = role || getAllRoleTypes().find(x=>x.id===roleType)?.label || roleType;

    let list = getAlters(true);
    // Custom fields are now only in fichas
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
    showToast(isEdit?`${name} profile updated ✓`:`${name} added to the system ✓`);
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
    ov.querySelectorAll('.role-type-opt[data-rt]').forEach(opt => {
      opt.addEventListener('click', () => {
        if (opt.id === 'btn-manage-role-types') return;
        ov.querySelectorAll('.role-type-opt').forEach(o=>o.classList.remove('selected'));
        opt.classList.add('selected');
        ov.querySelector('#a-roletype').value = opt.dataset.rt;
        const inp = ov.querySelector('#a-role');
        if(!inp.value) inp.value = getAllRoleTypes().find(r=>r.id===opt.dataset.rt)?.label||'';
        updatePreview(ov);
      });
    });
    ov.querySelector('#btn-add-role-type')?.addEventListener('click', () => {
      const name = prompt('New role type name:');
      if (!name || !name.trim()) return;
      const trimmed = name.trim();
      const customs = loadCustomRoleTypes();
      if (!customs.includes(trimmed)) { customs.push(trimmed); saveCustomRoleTypes(customs); }
      const grid = ov.querySelector('#role-type-grid');
      const addBtn = ov.querySelector('#btn-add-role-type');
      const newOpt = document.createElement('div');
      newOpt.className = 'role-type-opt';
      newOpt.dataset.rt = 'custom_' + trimmed;
      newOpt.innerHTML = `<div class="rt-emoji">◎</div><div class="rt-label">${esc(trimmed)}</div>`;
      grid.insertBefore(newOpt, addBtn);
      _wireRoleTypeOpts();
    });
    ov.querySelector('#btn-manage-role-types')?.addEventListener('click', () => {
      const current = loadCustomRoleTypes();
      const value = prompt('Custom role types, in display order (comma separated). Remove a name to delete it:', current.join(', '));
      if (value === null) return;
      const next = [...new Set(value.split(',').map(x=>x.trim()).filter(Boolean))].slice(0, 30);
      saveCustomRoleTypes(next);
      const grid = ov.querySelector('#role-type-grid');
      const selected = ov.querySelector('#a-roletype').value;
      grid.innerHTML = getAllRoleTypes().map(r=>`<div class="role-type-opt ${selected===r.id?'selected':''}" data-rt="${r.id}"><div class="rt-emoji">${r.emoji}</div><div class="rt-label">${esc(r.label)}</div></div>`).join('') + '<div class="role-type-opt" id="btn-add-role-type"><div class="rt-emoji">+</div><div class="rt-label">Custom</div></div><div class="role-type-opt" id="btn-manage-role-types"><div class="rt-emoji">☷</div><div class="rt-label">Manage</div></div>';
      _wireRoleTypeOpts();
      showToast('Custom roles updated ✓');
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
    }).catch(() => showToast('⚠ Could not process image'));
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
      area.innerHTML = `<button class="btn btn-ghost btn-sm" id="btn-remove-banner" style="font-size:11px;background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.2);color:#fff">✕ Remove banner</button><input type="file" id="banner-file-input" accept="image/*" style="display:none">`;
      ov.querySelector('#banner-file-input')?.addEventListener('change', (ev) => {
        const f2 = ev.target.files[0]; if(!f2) return;
        compressImageForStorage(f2, 1000, 320, 0.82, 780).then(b => {
          showImageCompressedToast(f2, b, 'Banner');
          _bannerImg = b; ov.querySelector('#a-banner-img').value = b;
          area.style.backgroundImage = `url(${b})`;
        }).catch(() => showToast('⚠ Could not process image'));
      });
      ov.querySelector('#btn-remove-banner')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        _bannerImg = null;
        ov.querySelector('#a-banner-img').value = '';
        area.style.backgroundImage = ''; area.style.backgroundSize = ''; area.style.backgroundPosition = ''; area.style.borderColor = '';
        area.innerHTML = `<div style="text-align:center"><div style="font-size:20px;margin-bottom:4px">🖼</div><div style="font-size:11px;color:var(--text-2)">Banner image</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3);margin-top:2px">Shown behind the avatar on the profile card</div></div><input type="file" id="banner-file-input" accept="image/*" style="display:none">`;
      });
    }).catch(() => showToast('⚠ Could not process image'));
  });

  // Toggle switches
  const refreshGallery = () => { const host=ov.querySelector('#alter-gallery-previews'); if(host) host.innerHTML=_galleryImgs.map((img,i)=>`<div class="image-gallery-item"><img src="${img}" alt=""><button type="button" class="btn btn-ghost btn-sm" data-remove-gallery="${i}">✕</button></div>`).join(''); host?.querySelectorAll('[data-remove-gallery]').forEach(btn=>btn.addEventListener('click',()=>{_galleryImgs.splice(+btn.dataset.removeGallery,1);refreshGallery();})); };
  ov.querySelector('#alter-gallery-input')?.addEventListener('change', async e=>{ for(const file of [...e.target.files].slice(0,8-_galleryImgs.length)){const err=validateImageFile(file,8);if(err){showToast('⚠ '+err);continue;}try{const b64=await compressImageForStorage(file,800,800,.82,520);_galleryImgs.push(b64);showImageCompressedToast(file,b64,'Gallery');}catch{showToast('⚠ Could not process the image');}} e.target.value='';refreshGallery(); });
  refreshGallery();
  const renderMediaTracking = () => { const host=ov.querySelector('#media-tracking-list'); if(!host)return; host.innerHTML=_mediaTracking.map((item,i)=>`<div class="media-tracking-row"><input data-media-field="title" data-media-index="${i}" value="${escC(item.title||'')}" placeholder="Title"><select data-media-field="type" data-media-index="${i}"><option ${item.type==='Book'?'selected':''}>Book</option><option ${item.type==='Series'?'selected':''}>Series</option><option ${item.type==='Movie'?'selected':''}>Movie</option><option ${item.type==='Game'?'selected':''}>Game</option><option ${item.type==='Other'?'selected':''}>Other</option></select><select data-media-field="status" data-media-index="${i}"><option ${item.status==='Pending'?'selected':''}>Pending</option><option ${item.status==='In progress'?'selected':''}>In progress</option><option ${item.status==='Completed'?'selected':''}>Completed</option><option ${item.status==='Dropped'?'selected':''}>Dropped</option></select><input data-media-field="progress" data-media-index="${i}" type="number" min="0" max="100" value="${Number(item.progress)||0}" aria-label="Progress (%)"><button type="button" class="btn btn-ghost btn-sm" data-remove-media="${i}">✕</button></div>`).join('') || '<div style="font-size:11px;color:var(--text-3);margin-bottom:8px">No media tracked yet.</div>'; host.querySelectorAll('[data-media-field]').forEach(input=>input.addEventListener('input',()=>{_mediaTracking[+input.dataset.mediaIndex][input.dataset.mediaField]=input.type==='number'?Math.max(0,Math.min(100,Number(input.value)||0)):input.value;})); host.querySelectorAll('[data-remove-media]').forEach(btn=>btn.addEventListener('click',()=>{_mediaTracking.splice(+btn.dataset.removeMedia,1);renderMediaTracking();})); };
  ov.querySelector('#btn-add-media')?.addEventListener('click',()=>{_mediaTracking.push({id:uid(),title:'',type:'Other',status:'Pending',progress:0});renderMediaTracking();});
  renderMediaTracking();
  ov.querySelectorAll('.toggle-switch').forEach(sw => {
    sw.addEventListener('click', () => {
      if (sw.dataset.lockedAdmin === '1' && sw.classList.contains('on')) {
        showToast('Warning: At least one system admin is required');
        return;
      }
      sw.classList.toggle('on');
      // Update visibility summary chip if this is a perm toggle
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
        <button class="icon-btn btn-del-rel" data-rel-id="${rel.id}" title="Remove">✕</button>
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
    if (!targetId) { showToast('⚠ Select an alter'); return; }
    const cur = JSON.parse(ov.querySelector('#a-relations-data').value||'[]');
    if (cur.find(r=>r.targetId===targetId)) { showToast('⚠ A link with that alter already exists'); return; }
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
  const name   = ov.querySelector('#a-name')?.value || 'Name';
  const role   = ov.querySelector('#a-role')?.value || ov.querySelector('#a-roletype')?.value || 'Role';
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
// IMPORT FROM ANOTHER SYSTEM (Simply Plural / PluralKit)
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
  if (!raw) return 'they/them';
  const trimmed = raw.trim();
  // If it already matches a known value exactly, keep it as-is
  const known = ['she/her','he/him','they/them','she/they','he/they','none'];
  if (known.includes(trimmed.toLowerCase())) return trimmed.toLowerCase();
  const s = trimmed.toLowerCase().replace(/[/|,\s]+/g, ' ').trim();
  if (/\bshe\b/.test(s)) return 'she/her';
  if (/\bhe\b/.test(s) && !/\bthey\b/.test(s)) return 'he/him';
  if (/\bthey\b/.test(s)) return 'they/them';
  if (/none|no\s+pronoun/.test(s)) return 'none';
  const first = trimmed.split(/[/|, ]/)[0].trim().toLowerCase();
  if (known.includes(first)) return first;
  // Preserve unrecognised custom neopronouns as-is
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

  // Patterns to categorize custom fields
  const CF_MEMORY  = /notas?|notes?|memoria|memory|conoce|knows?|info\s+adicional|additional/i;
  const CF_TRIGGER = /triggers?|gatillo|limitaci|no\s+(sabe|conoce)|not\s+know/i;

  const idToAtria = {};
  const triggersPendientes = []; // { alterId, textos[] }

  const altersNuevos = (data.members || []).map((m, i) => {
    const id = uid();
    idToAtria[m._id] = id;

    // Color (discard pure black/white)
    const rawColor = m.color && !/^#?0{6}$/i.test(m.color) && !/^#?[fF]{6}$/.test(m.color)
      ? (m.color.startsWith('#') ? m.color : '#' + m.color)
      : _IMPORT_COLORS[i % _IMPORT_COLORS.length];
    const { color, bg } = _mkColorBg(rawColor);

    // Base description: strip Simply decorative formatting
    const descBase = (m.desc || '')
      .replace(/╭[^╮]*╮/g, '')
      .replace(/⧉-[^⟤]*⟤-\s*\[[^\]]*\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Classify custom fields into their proper Atria fields
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

    // Avatar URL: note in description (cannot download without backend)
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
    resultado.advertencias.push('No alters found in the file.');
  } else {
    const existentes = getAlters(true);
    const nombresExistentes = new Set(existentes.map(a => a.name.toLowerCase()));
    const filtrados = altersNuevos.filter(a => {
      if (nombresExistentes.has(a.name.toLowerCase())) {
        resultado.advertencias.push(`"${a.name}" already exists — skipped.`);
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

  // Triggers → tid_salud_triggers with associated alter
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

  // Chat channels
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

  // Fronting history
  // SP exports one entry per fronter — group by startTime to capture co-fronting
  const fh = (data.frontHistory || []).filter(f => f.member && f.startTime && f.endTime && !f.live);
  if (fh.length > 0) {
    const todosAlters = getAlters();
    const simplyToAtria = {};
    todosAlters.forEach(a => { if (a._simplyId) simplyToAtria[a._simplyId] = a.id; });
    Object.entries(idToAtria).forEach(([sid, aid]) => { simplyToAtria[sid] = aid; });
    const sesionesExistentes = (() => { try { return JSON.parse(localStorage.getItem('tid_fronting'))||[]; } catch { return []; } })();
    const tsExistentes = new Set(sesionesExistentes.map(s => s.start));

    // Group entries by startTime: first is main fronter, rest are co-fronters
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

    // Color: 6-char hex without # (e.g. "a08aff")
    const rawColor = m.color && m.color.trim()
      ? (m.color.startsWith('#') ? m.color : '#' + m.color)
      : _IMPORT_COLORS[i % _IMPORT_COLORS.length];
    const { color, bg } = _mkColorBg(rawColor);

    // Extract age and role from decoration fields ⧉-emoji⟤- [ value ]
    const rawDesc = m.description || '';
    let ageRaw = null, roleRaw = '';
    rawDesc.replace(/⧉-[^⟤]*⟤-\s*\[([^\]]+)\]/g, (_, v) => {
      const val = v.trim();
      if (/^\d+$/.test(val) && !ageRaw) { ageRaw = val; return; }
      if (!roleRaw) { const r = _spRolType(val); if (r !== 'otro') roleRaw = val; }
    });

    // Strip decorations from description
    const descBase = rawDesc
      .replace(/╭[^╮]*╮/g, '')
      .replace(/⧉-[^⟤]*⟤-\s*\[[^\]]*\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Birthday: skip clearly invalid years (< 1900), show DD/MM only
    const descLines = [];
    if (m.birthday) {
      const parts = m.birthday.split('-');
      const year = parseInt(parts[0]);
      const bdDisplay = year < 1900 && parts.length >= 3
        ? `${parts[2]}/${parts[1]}`
        : m.birthday;
      descLines.push(`Birthday: ${bdDisplay}`);
    }
    if (m.avatar_url) descLines.push(`Avatar: ${m.avatar_url}`);
    if (m.banner)     descLines.push(`Banner: ${m.banner}`);
    if (m.display_name && m.display_name !== m.name) descLines.push(`Display name: ${m.display_name}`);

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
    resultado.advertencias.push('No alters found in the file.');
  } else {
    const existentes = getAlters(true);
    const nombresExistentes = new Set(existentes.map(a => a.name.toLowerCase()));
    const filtrados = altersNuevos.filter(a => {
      if (nombresExistentes.has(a.name.toLowerCase())) {
        resultado.advertencias.push(`"${a.name}" already exists — skipped.`);
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

  // Switches → fronting history
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

  // ── Members ──
  const members = Array.isArray(data.members) ? data.members : [];
  const altersNuevos = [];
  members.forEach((m, i) => {
    if (!m.name || !m.name.trim()) {
      resultado.advertencias.push(`Member ${i+1}: name missing — skipped.`);
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
        resultado.advertencias.push(`"${a.name}" already exists — skipped.`);
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
        resultado.advertencias.push(`Front state "${label}" not recognised — skipped.`);
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
        descripcion:     t.description || '',
        alterId:         (t.member_id && idToAtria[t.member_id]) || null,
        provocaSwitcheo: false,
        intensidad:      Math.min(5, Math.max(1, parseInt(t.intensity) || 3))
      });
      resultado.triggers++;
    });
    saveSaludTriggers(triggerList);
  }

  return resultado;
}

function mostrarResultadoImport(res, source) {
  const lineas = [
    res.alters   > 0 ? `✓ ${res.alters} alter${res.alters!==1?'s':''} imported` : null,
    res.canales  > 0 ? `✓ ${res.canales} channel${res.canales!==1?'s':''} imported` : null,
    res.fronting > 0 ? `✓ ${res.fronting} fronting session${res.fronting!==1?'s':''} imported` : null,
    res.triggers > 0 ? `✓ ${res.triggers} trigger${res.triggers!==1?'s':''} added to Health` : null,
    res.estados  > 0 ? `✓ ${res.estados} session state${res.estados!==1?'s':''} imported` : null,
    ...res.advertencias
  ].filter(Boolean);

  const html = `
    <div class="modal-title">Import completed</div>
    <div class="modal-subtitle">From ${source}</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin:4px 0">
      ${lineas.map(l => `<div style="font-size:13px;padding:8px 12px;background:var(--bg-2);border-radius:8px;font-family:'DM Mono',monospace">${l}</div>`).join('')}
      ${res.alters===0&&res.fronting===0&&res.canales===0 ? '<div style="color:var(--text-2);font-size:13px">No data imported.</div>' : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" data-cancel>OK</button>
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
        : `<input class="cf-input-key" placeholder="Field" value="${escB(f.key)}" data-cfi="${i}" data-type="key">
           <input class="cf-input-val" placeholder="Value" value="${escB(f.value)}" data-cfi="${i}" data-type="val">
           <button class="icon-btn cf-del" data-cfi="${i}" title="Delete">✕</button>`
      }
    </div>`).join('') + (readonly ? '' : `
    <button class="btn btn-ghost btn-sm" id="btn-add-cf" style="margin-top:6px;font-size:11px">+ Add field</button>`);
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
      <div class="form-label" style="margin-bottom:8px">Saved combinations</div>
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
              <button class="icon-btn" data-del-preset="${p.id}" title="Delete">✕</button>
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
      showToast(`◉ Now fronting: ${alters.find(a=>a.id===p.alterId)?.name||'—'} ✓`);
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
  if (!current) { showToast('⚠ No active session'); return; }
  const fa = alters.find(a=>a.id===current.alterId);
  const coAlters = (current.coFronting||[]).map(id=>alters.find(a=>a.id===id)).filter(Boolean);
  const modalHTML = `
    <div class="modal-title">Save combination</div>
    <div class="modal-subtitle">${fa?.name||'—'}${coAlters.length?' + '+coAlters.map(a=>a.name).join(', '):''}</div>
    <div class="form-row" style="margin-top:14px">
      <div class="form-label">Tag (optional)</div>
      <input type="text" id="preset-label" placeholder="E.g. Tomorrow, Work, Outings...">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>Save</button>
    </div>`;
  openModal(modalHTML, ov => {
    const label = ov.querySelector('#preset-label').value.trim();
    const presets = loadFrontPresets();
    presets.push({id:uid(), alterId:current.alterId, coFronting:[...(current.coFronting||[])], label});
    saveFrontPresets(presets);
    closeModal();
    showToast('Combination saved ✓');
    renderFrontingView();
  });
}

// ═══════════════════════════════════════════════
// ESTADOS EMOCIONALES
// ═══════════════════════════════════════════════
const SYSTEM_STATES = [
  {id:'ok',        emoji:'🟢', label:'Stable',      color:'#8affe0'},
  {id:'alert',     emoji:'🟡', label:'Alert',        color:'#ffd580'},
  {id:'stress',    emoji:'🔴', label:'Stress',        color:'#ff8a8a'},
  {id:'dissoc',    emoji:'🌫️', label:'Dissociation',   color:'#8ab4ff'},
  {id:'switch',    emoji:'⚡', label:'Switching',     color:'#c4aaff'},
  {id:'rest',      emoji:'🌙', label:'Rest',      color:'#6e6a90'},
];

function loadSystemState()  { try { return JSON.parse(localStorage.getItem('tid_system_state'))||null; } catch{return null;} }
function saveSystemState(s) { localStorage.setItem('tid_system_state', JSON.stringify(s)); }

function setSystemState(stateId) {
  const st = SYSTEM_STATES.find(s=>s.id===stateId);
  if (!st) return;
  saveSystemState({id:stateId, ts:Date.now()});
  // Actualizar badge en UI
  updateSystemStateBadge();
  showToast(`${st.emoji} State: ${st.label}`);
}

function updateSystemStateBadge() {
  const state = loadSystemState();
  const badge = document.getElementById('system-state-badge');
  if (!badge) return;
  if (!state) { badge.textContent = '○'; badge.style.color = 'var(--text-3)'; badge.title = 'System state'; return; }
  const st = SYSTEM_STATES.find(s=>s.id===state.id);
  if (st) { badge.textContent = st.emoji; badge.style.color = st.color; badge.title = st.label; }
}

function openSystemStateModal() {
  const current = loadSystemState();
  const modalHTML = `
    <div class="modal-title">System state</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px">
      ${SYSTEM_STATES.map(s=>`
        <div class="state-opt-btn${current?.id===s.id?' selected':''}" data-state="${s.id}" style="--sc:${s.color}">
          <span style="font-size:22px">${s.emoji}</span>
          <span style="font-weight:700;font-size:13px">${s.label}</span>
        </div>`).join('')}
    </div>
    ${current?`<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:12px;text-align:center">
      Since ${new Date(current.ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
      · <span style="cursor:pointer;color:var(--accent)" id="clear-state">Clear</span>
    </div>`:''}
    <div class="modal-footer" style="margin-top:4px">
      <button class="btn btn-ghost" data-cancel>Close</button>
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
    showToast('State cleared');
  });
}


// ═══════════════════════════════════════════════
// MODAL DE ALTERS ARCHIVADOS
// ═══════════════════════════════════════════════
function openArchivedAltersModal() {
  const archived = getAlters(true).filter(a => a.isArchived);
  if (!archived.length) { showToast('No archived alters'); return; }
  const modalHTML = `
    <div class="modal-title">Archived alters</div>
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
          <button class="btn btn-ghost btn-sm" data-restore="${a.id}">Restore</button>
        </div>`).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Close</button>
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
// ═══════════════════════════════════════════════
// ANALYTICS — Phase 4
// ═══════════════════════════════════════════════
let analisisTab = 'dashboard';
let analisisPatternDays = 14;
let analisisMoodTimelineFilter = { alterId:'all', from:'', to:'', group:'day' };

function renderAnalisis() {
  setCrumbs([{label:'Hub',action:()=>navigateTo('hub')},{label:'Analytics'}]);
  if (!['dashboard','actividad','heatmap','emociones','timeline-emocional','triggers','patrones'].includes(analisisTab)) analisisTab = 'dashboard';
  renderAnalisisView();
}

function renderAnalisisView() {
  const app = document.getElementById('app');
  const tabs = [
    {id:'dashboard', label:'◈ Dashboard'},
    {id:'actividad', label:'◷ Activity'},
    {id:'heatmap',   label:'◫ Heatmap'},
    {id:'emociones', label:'◎ Emotions'},
    {id:'timeline-emocional', label:'↝ Emotional timeline'},
    {id:'patrones',   label:'◇ Patterns'},
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

// ── shared helpers ──
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

  // Top fronter by time
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

  const recentCrisis   = crisisLog.filter(e=>e.startedAt>now-ms30days).length;
  const recentSessions = sessions.filter(s=>s.start>now-ms30days).length;
  const totalFrontTime = Object.values(timeByAlter).reduce((a,b)=>a+b,0);

  // Last 14 days switch activity (bar chart)
  const last14 = Array.from({length:14},(_,i)=>{
    const d = new Date(now - (13-i)*86400000);
    return {label:d.toLocaleDateString('en-GB',{weekday:'short'}), iso:d.toISOString().slice(0,10), count:0};
  });
  sessions.forEach(s=>{ const iso=new Date(s.start).toISOString().slice(0,10); const d=last14.find(x=>x.iso===iso); if(d) d.count++; });
  const maxLast14 = Math.max(...last14.map(d=>d.count),1);

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
        ${_analisisStatCard(sessions.length, 'Total sessions', 'var(--accent)')}
        ${_analisisStatCard(fmtDuration(totalFrontTime), 'Total front time', 'var(--accent-3)')}
        ${_analisisStatCard(recentSessions, 'Sessions (30 days)', 'var(--accent-4)')}
        ${_analisisStatCard(recentCrisis, 'Crises (30 days)', recentCrisis>0?'#ff6b8a':'var(--accent-2)')}
      </div>

      <!-- Top cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        ${topFronter ? `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px">
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Most active alter</div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:26px">${escM(topFronter.emoji||'●')}</span>
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text-1)">${escM(topFronter.name)}</div>
              <div style="font-size:11px;color:var(--text-3)">${fmtDuration(timeByAlter[topFronter.id]||0)}</div>
            </div>
          </div>
        </div>` : ''}
        ${topMood ? `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px">
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Most frequent state</div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:26px">${topMood.emoji}</span>
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text-1)">${escM(topMood.label)}</div>
              <div style="font-size:11px;color:var(--text-3)">${moodCount[topMoodId]} record${moodCount[topMoodId]!==1?'s':''}</div>
            </div>
          </div>
        </div>` : ''}
        ${topTrig ? `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px">
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Most frequent trigger</div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:22px">⚡</span>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text-1);line-height:1.3">${escM(topTrig.titulo)}</div>
              <div style="font-size:11px;color:var(--text-3)">${trigCount[topTrigId]} time${trigCount[topTrigId]!==1?'s':''}</div>
            </div>
          </div>
        </div>` : ''}
      </div>

      <!-- Activity chart last 14 days -->
      ${sessions.length ? `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Sessions · last 14 days</div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:60px">
          ${last14.map(d=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="flex:1;width:100%;display:flex;align-items:flex-end">
              <div style="width:100%;border-radius:3px 3px 0 0;background:${d.count?'var(--accent)':'var(--bg-3)'};height:${d.count?Math.max(Math.round((d.count/maxLast14)*48),6):2}px"></div>
            </div>
            <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3)">${d.label}</div>
          </div>`).join('')}
        </div>
      </div>` : ''}
      ${!sessions.length && !tracker.length && !crisisLog.length ? `<div class="empty-state" style="padding:40px 20px"><div class="empty-icon">◈</div><div>No data yet</div><div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-3);margin-top:6px">Data accumulates as you use the system</div></div>` : ''}
    </div>`;
}

// ── FRONTING HEATMAP ──
function renderAnalisisHeatmap(cont, alters) {
  const sessions = loadActividad().filter(s => s.end);

  // Build session map and total duration per day (last 16 weeks = 112 days)
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

  // Group into weeks (columns)
  const weeks = [];
  for (let w = 0; w < WEEKS; w++) weeks.push(cells.slice(w*7, w*7+7));
  const DOW_LABELS = ['S','M','T','W','T','F','S'];
  const todayStr = new Date().toISOString().slice(0,10);

  function cellColor(ds) {
    const c = byDate[ds]?.count||0;
    if (!c) return 'var(--bg-3)';
    return `rgba(160,138,255,${Math.max(0.15, Math.min(1, c/maxCount)).toFixed(2)})`;
  }

  function cellTitle(ds) {
    const d = byDate[ds];
    if (!d) return ds + ': no sessions';
    const topAlt = Object.entries(d.alters).sort((a,b)=>b[1]-a[1])[0];
    const altName = topAlt ? (alters.find(a=>a.id===topAlt[0])?.name||'—') : '—';
    return `${ds}: ${d.count} session${d.count!==1?'s':''} · ${fmtDuration(d.dur)} · main: ${altName}`;
  }

  // Total days with sessions, total sessions, most active alter
  const activeDays = cells.filter(d => byDate[d]?.count).length;
  const totalSess  = cells.reduce((s,d) => s + (byDate[d]?.count||0), 0);
  const alterTotals = {};
  sessions.forEach(s => { alterTotals[s.alterId] = (alterTotals[s.alterId]||0)+1; });
  const topFronter = Object.entries(alterTotals).sort((a,b)=>b[1]-a[1])[0];
  const topFronterAlt = topFronter ? alters.find(a=>a.id===topFronter[0]) : null;

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">
        ${_analisisStatCard(activeDays, 'Days with sessions', 'var(--accent)')}
        ${_analisisStatCard(totalSess, 'Sessions (period)', 'var(--accent-3)')}
        ${topFronterAlt ? _analisisStatCard(`${topFronterAlt.emoji} ${escM(topFronterAlt.name)}`, 'Most active alter', topFronterAlt.color||'var(--accent-2)') : ''}
      </div>

      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;overflow-x:auto">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Fronting activity · last ${WEEKS} weeks</div>
        <div style="display:flex;gap:3px;align-items:flex-start">
          <!-- day labels -->
          <div style="display:flex;flex-direction:column;gap:3px;margin-top:18px">
            ${DOW_LABELS.map(l=>`<div style="height:12px;font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3);line-height:12px;width:10px">${l}</div>`).join('')}
          </div>
          <!-- week columns -->
          <div style="display:flex;gap:3px">
            ${weeks.map((week, wi) => {
              const firstDay = new Date(week[0]+'T12:00:00');
              const monthLabel = wi===0 || firstDay.getDate()<=7 ? firstDay.toLocaleDateString('en-GB',{month:'short'}) : '';
              return `<div style="display:flex;flex-direction:column;gap:3px">
                <div style="height:14px;font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3);text-align:center;white-space:nowrap">${monthLabel}</div>
                ${week.map(ds=>`<div style="width:12px;height:12px;border-radius:2px;background:${cellColor(ds)};border:${ds===todayStr?'1px solid var(--accent)':'none'};flex-shrink:0;cursor:default" title="${cellTitle(ds)}"></div>`).join('')}
              </div>`;
            }).join('')}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:10px">
          <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3)">Less</span>
          ${[0,0.2,0.4,0.7,1].map(o=>`<div style="width:10px;height:10px;border-radius:2px;background:rgba(160,138,255,${o||0.06})"></div>`).join('')}
          <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3)">More</span>
        </div>
      </div>
    </div>`;
}

function renderAnalisisActividad(cont, alters) {
  const sessions = loadActividad().filter(s=>s.end).sort((a,b)=>b.start-a.start);
  if (!sessions.length) { cont.innerHTML=`<div class="empty-state" style="padding:60px 20px"><div class="empty-icon">◷</div><div>No sessions recorded</div></div>`; return; }

  // Stats per alter
  const byAlter = {};
  sessions.forEach(s=>{ if (!byAlter[s.alterId]) byAlter[s.alterId]={count:0,dur:0}; byAlter[s.alterId].count++; byAlter[s.alterId].dur+=s.duration||0; });
  const totalDur = sessions.reduce((s,x)=>s+(x.duration||0),0);
  const sortedAlters = Object.entries(byAlter).sort((a,b)=>b[1].dur-a[1].dur);

  // Hour-of-day distribution
  const byHour = Array(24).fill(0);
  sessions.forEach(s=>{ byHour[new Date(s.start).getHours()]++; });
  const maxHour = Math.max(...byHour, 1);

  // Weekly pattern (day-of-week)
  const byDow = Array(7).fill(0);
  const dowLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  sessions.forEach(s=>{ byDow[new Date(s.start).getDay()]++; });
  const maxDow = Math.max(...byDow, 1);

  const avgDur = totalDur / sessions.length;

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
        ${_analisisStatCard(sessions.length, 'Total sessions', 'var(--accent)')}
        ${_analisisStatCard(fmtDuration(totalDur), 'Total time', 'var(--accent-3)')}
        ${_analisisStatCard(fmtDuration(avgDur), 'Avg duration', 'var(--accent-4)')}
        ${_analisisStatCard(Object.keys(byAlter).length, 'Active alters', 'var(--accent-2)')}
      </div>

      <!-- Distribution by alter -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Time by alter</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sortedAlters.map(([aid,st])=>{
            const alt=alters.find(a=>a.id===aid); if(!alt) return '';
            const pct=Math.round((st.dur/totalDur)*100);
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

      <!-- Hour-of-day pattern -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Activity by hour of day</div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:48px">
          ${byHour.map((c,h)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px" title="${h}:00 — ${c} session${c!==1?'s':''}">
            <div style="width:100%;border-radius:2px 2px 0 0;background:${c?'var(--accent)':'var(--bg-3)'};height:${c?Math.max(Math.round((c/maxHour)*40),4):2}px"></div>
            ${h%6===0?`<div style="font-family:'DM Mono',monospace;font-size:7px;color:var(--text-3)">${h}h</div>`:``}
          </div>`).join('')}
        </div>
      </div>

      <!-- Day-of-week pattern -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Distribution by day of week</div>
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
  const rows=Array.from({length:days},(_,i)=>{const d=new Date(start+i*86400000);return {iso:d.toISOString().slice(0,10),label:d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}),front:0,journal:0,reminders:0,chat:0};});
  const add=(items,key)=>items.forEach(item=>{const ts=stamp(item);if(!ts)return;const row=rows.find(r=>r.iso===new Date(ts).toISOString().slice(0,10));if(row)row[key]++;});
  add(loadActividad().filter(s=>s.end),'front'); add(read('tid_diary'),'journal'); add(read('tid_reminders'),'reminders'); add(read('tid_messages'),'chat');
  const max=Math.max(...rows.map(r=>r.front+r.journal+r.reminders+r.chat),1);
  const totals=rows.reduce((a,r)=>({front:a.front+r.front,journal:a.journal+r.journal,reminders:a.reminders+r.reminders,chat:a.chat+r.chat}),{front:0,journal:0,reminders:0,chat:0});
  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:16px"><div style="display:flex;gap:6px;flex-wrap:wrap">${[7,14,30].map(n=>`<button class="btn btn-sm${days===n?' btn-primary':' btn-ghost'}" data-pattern-days="${n}">${n} days</button>`).join('')}</div><div class="hub-widget"><div class="hw-header"><div class="hw-icon" style="color:var(--accent)">◇</div><div class="hw-title">Cross-module activity patterns</div></div><div style="font-size:11px;color:var(--text-2);margin-bottom:10px">Descriptive counts by day. These records are shown as a pattern aid, not causality or prediction.</div><div style="display:flex;flex-direction:column;gap:5px">${rows.map(r=>{const total=r.front+r.journal+r.reminders+r.chat;return `<div style="display:flex;align-items:center;gap:7px"><span style="width:52px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${r.label}</span><div style="flex:1;height:12px;background:var(--bg-3);border-radius:3px;overflow:hidden;display:flex"><span title="Fronting" style="width:${r.front/max*100}%;background:var(--accent)"></span><span title="Journal" style="width:${r.journal/max*100}%;background:var(--accent-3)"></span><span title="Reminders" style="width:${r.reminders/max*100}%;background:var(--accent-4)"></span><span title="Chat" style="width:${r.chat/max*100}%;background:var(--accent-2)"></span></div><span style="width:22px;text-align:right;font-family:'DM Mono',monospace;font-size:9px;color:var(--text-2)">${total}</span></div>`;}).join('')}</div><div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)"><span style="color:var(--accent)">■ fronting ${totals.front}</span><span style="color:var(--accent-3)">■ journal ${totals.journal}</span><span style="color:var(--accent-4)">■ reminders ${totals.reminders}</span><span style="color:var(--accent-2)">■ chat ${totals.chat}</span></div></div></div>`;
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
  const weekStart = iso => { const d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return localDate(d); };
  const all = loadTracker().map(e=>({...e,_date:localDate(e.date||e.ts)})).filter(e=>e._date);
  const entries = all.filter(e=>(f.alterId==='all'||e.alterId===f.alterId)&&(!f.from||e._date>=f.from)&&(!f.to||e._date<=f.to)).sort((a,b)=>(a._date===b._date?(b.ts||0)-(a.ts||0):b._date.localeCompare(a._date)));
  const moodCount={}; const intensities=[];
  entries.forEach(e=>{moodCount[e.mood]=(moodCount[e.mood]||0)+1;const n=Number(e.intensity);if(n>=1&&n<=5)intensities.push(n);});
  const topMoodId=Object.entries(moodCount).sort((a,b)=>b[1]-a[1])[0]?.[0]; const topMood=moodById.get(topMoodId);
  const avgIntensity=intensities.length?(intensities.reduce((a,b)=>a+b,0)/intensities.length).toFixed(1):'—';
  const grouped={}; entries.forEach(e=>{const key=f.group==='week'?weekStart(e._date):e._date;if(!grouped[key])grouped[key]=[];grouped[key].push(e);});
  const groups=Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0])); const maxGroup=Math.max(...groups.map(([,list])=>list.length),1);
  const summarize=list=>{const counts={};const ints=[];list.forEach(e=>{counts[e.mood]=(counts[e.mood]||0)+1;const n=Number(e.intensity);if(n>=1&&n<=5)ints.push(n);});const moodId=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0];return {count:list.length,mood:moodById.get(moodId),avg:ints.length?ints.reduce((a,b)=>a+b,0)/ints.length:null};};
  const timedEntries=entries.map(e=>{const d=new Date(e.ts||0);return Number.isFinite(d.getTime())&&localDate(d)===e._date?{...e,_hour:d.getHours()}:null;}).filter(Boolean);
  const hourly=Array.from({length:24},(_,hour)=>({hour,list:timedEntries.filter(e=>e._hour===hour)})).filter(row=>row.list.length);
  const weekdayOrder=[1,2,3,4,5,6,0];
  const weekday=weekdayOrder.map(day=>({day,list:entries.filter(e=>new Date(e._date+'T12:00:00').getDay()===day)})).filter(row=>row.list.length);
  const comparisons=['week','month'].map(kind=>{const periods={};entries.forEach(e=>{const key=kind==='week'?weekStart(e._date):e._date.slice(0,7);if(!periods[key])periods[key]=[];periods[key].push(e);});const keys=Object.keys(periods).sort();const currentKey=keys.at(-1);const previousKey=keys.at(-2);return {kind,currentKey,previousKey,current:currentKey?summarize(periods[currentKey]):null,previous:previousKey?summarize(periods[previousKey]):null};});
  const comparisonLabel=(kind,key)=>kind==='week'?`Week of ${new Date(key+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`:new Date(key+'-01T12:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  const renderTimeRows=(rows,labelFor)=>rows.map(row=>{const s=summarize(row.list);return `<div style="display:grid;grid-template-columns:70px 1fr auto;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)"><span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${labelFor(row)}</span><span style="font-size:11px;color:var(--text-2)">${s.mood?`${s.mood.emoji} ${escM(s.mood.label)}`:'—'}</span><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${s.count} · ${s.avg===null?'—':s.avg.toFixed(1)+'/5'}</span></div>`;}).join('');
  const presentAlterIds=[...new Set(all.map(e=>e.alterId))];
  const filterRow=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px">
    <label><span class="form-label">Identity</span><select class="form-input" id="mood-timeline-alter"><option value="all">All</option>${presentAlterIds.map(id=>{const a=alters.find(x=>x.id===id);return a?`<option value="${id}"${f.alterId===id?' selected':''}>${escM(a.name)}</option>`:'';}).join('')}</select></label>
    <label><span class="form-label">From</span><input class="form-input" id="mood-timeline-from" type="date" value="${f.from}"></label>
    <label><span class="form-label">To</span><input class="form-input" id="mood-timeline-to" type="date" value="${f.to}"></label>
    <label><span class="form-label">Group by</span><select class="form-input" id="mood-timeline-group"><option value="day"${f.group==='day'?' selected':''}>Day</option><option value="week"${f.group==='week'?' selected':''}>Week</option></select></label>
  </div>`;
  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:16px">
    <div class="hub-widget"><div class="hw-header"><div class="hw-icon" style="color:var(--accent)">↝</div><div class="hw-title">Emotional timeline</div></div>${filterRow}<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:10px"><span style="font-size:11px;color:var(--text-3)">Descriptive summary only; it does not imply diagnosis, causality, or prediction.</span><button class="btn btn-ghost btn-sm" id="mood-timeline-clear">All time</button></div></div>
    ${entries.length?`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px">${_analisisStatCard(entries.length,'Records','var(--accent)')}${_analisisStatCard(topMood?`${topMood.emoji} ${escM(topMood.label)}`:'—','Most frequent','var(--accent-3)')}${_analisisStatCard(avgIntensity==='—'?'—':avgIntensity+'/5','Average intensity','var(--accent-4)')}${_analisisStatCard(groups.length,f.group==='week'?'Weeks with data':'Days with data','var(--accent-2)')}</div>
    ${entries.length<3?`<div style="font-size:11px;color:var(--text-3);padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius)">Small sample: inspect the individual records before interpreting the summary.</div>`:''}
    <div class="hub-widget"><div class="hw-header"><div class="hw-icon" style="color:var(--accent-3)">▥</div><div class="hw-title">Frequency and intensity by ${f.group==='week'?'week':'day'}</div></div><div style="display:flex;flex-direction:column;gap:8px">${groups.map(([key,list])=>{const counts={};const ints=[];list.forEach(e=>{counts[e.mood]=(counts[e.mood]||0)+1;const n=Number(e.intensity);if(n>=1&&n<=5)ints.push(n);});const avg=ints.length?(ints.reduce((a,b)=>a+b,0)/ints.length).toFixed(1):null;const label=f.group==='week'?`Week of ${new Date(key+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`:new Date(key+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});return `<div style="display:grid;grid-template-columns:minmax(95px,135px) 1fr auto;gap:8px;align-items:center"><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${label}</span><div><div style="height:8px;border-radius:4px;background:var(--bg-3);overflow:hidden"><div style="height:100%;width:${list.length/maxGroup*100}%;background:var(--accent);border-radius:4px"></div></div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">${Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([id,n])=>{const m=moodById.get(id);return `<span style="font-size:10px;color:var(--text-2)">${m?.emoji||'◎'} ${n}</span>`;}).join('')}</div></div><span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${list.length}${avg?' · '+avg+'/5':''}</span></div>`;}).join('')}</div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">
      <div class="hub-widget" id="mood-timeline-hour-summary"><div class="hw-header"><div class="hw-icon" style="color:var(--accent-4)">◷</div><div class="hw-title">Most frequent state by hour</div></div>${hourly.length?`<div style="font-size:10px;color:var(--text-3);margin-bottom:6px">Includes only ${timedEntries.length} record${timedEntries.length!==1?'s':''} with a verifiable time.</div>${renderTimeRows(hourly,row=>String(row.hour).padStart(2,'0')+':00')}`:'<div style="font-size:11px;color:var(--text-3)">No records have a verifiable time in this range.</div>'}</div>
      <div class="hub-widget" id="mood-timeline-weekday-summary"><div class="hw-header"><div class="hw-icon" style="color:var(--accent-2)">▦</div><div class="hw-title">Most frequent state by weekday</div></div>${renderTimeRows(weekday,row=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][row.day])}</div>
    </div>
    <div class="hub-widget" id="mood-timeline-comparisons"><div class="hw-header"><div class="hw-icon" style="color:var(--accent-3)">⇄</div><div class="hw-title">Weekly and monthly comparisons</div></div><div style="font-size:10px;color:var(--text-3);margin-bottom:10px">Compares the latest two periods with data inside the current filter. Source records appear below.</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">${comparisons.map(c=>`<div style="padding:10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-2)"><div style="font-size:11px;font-weight:700;color:var(--text-1);margin-bottom:7px">${c.kind==='week'?'Week over week':'Month over month'}</div>${c.current&&c.previous?`<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${comparisonLabel(c.kind,c.previousKey)} → ${comparisonLabel(c.kind,c.currentKey)}</div><div style="font-size:12px;color:var(--text-2);margin-top:6px">Records: ${c.previous.count} → ${c.current.count} (${c.current.count-c.previous.count>=0?'+':''}${c.current.count-c.previous.count})</div><div style="font-size:11px;color:var(--text-2);margin-top:3px">Average intensity: ${c.previous.avg===null?'—':c.previous.avg.toFixed(1)} → ${c.current.avg===null?'—':c.current.avg.toFixed(1)}</div><div style="font-size:11px;color:var(--text-2);margin-top:3px">Most frequent: ${c.previous.mood?c.previous.mood.emoji+' '+escM(c.previous.mood.label):'—'} → ${c.current.mood?c.current.mood.emoji+' '+escM(c.current.mood.label):'—'}</div>`:'<div style="font-size:11px;color:var(--text-3)">Records in at least two periods are required.</div>'}</div>`).join('')}</div></div>
    <div class="hub-widget"><div class="hw-header"><div class="hw-icon" style="color:var(--accent-2)">≡</div><div class="hw-title">Included records</div></div><div style="display:flex;flex-direction:column;gap:7px">${entries.map(e=>{const a=alters.find(x=>x.id===e.alterId);const m=moodById.get(e.mood);return `<div style="display:flex;gap:9px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:20px">${m?.emoji||'◎'}</span><div style="flex:1;min-width:0"><div style="font-size:12px;color:var(--text-1)">${escM(m?.label||e.mood||'—')} ${e.intensity?`<span style="color:var(--text-3)">· ${e.intensity}/5</span>`:''}</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text-3)">${new Date(e._date+'T12:00:00').toLocaleDateString('en-GB')} · ${escM(a?.name||'—')}</div>${e.note?`<div style="font-size:11px;color:var(--text-2);margin-top:3px">${escM(e.note)}</div>`:''}</div></div>`;}).join('')}</div></div>`:`<div class="empty-state" style="padding:50px 20px"><div class="empty-icon">◎</div><div>No records in this range</div></div>`}
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

// ── EMOTIONS ──
function renderAnalisisEmociones(cont, alters) {
  const entries = loadTracker();
  const moods   = getMoods();
  if (!entries.length) { cont.innerHTML=`<div class="empty-state" style="padding:60px 20px"><div class="empty-icon">◎</div><div>No emotional records</div></div>`; return; }

  // Global mood distribution
  const moodCount = {};
  moods.forEach(m=>{ moodCount[m.id]=0; });
  entries.forEach(e=>{ moodCount[e.mood]=(moodCount[e.mood]||0)+1; });
  const totalMoods  = entries.length;
  const sortedMoods = moods.filter(m=>moodCount[m.id]>0).sort((a,b)=>(moodCount[b.id]||0)-(moodCount[a.id]||0));

  // Per-alter top moods
  const byAlter = {};
  entries.forEach(e=>{
    if (!byAlter[e.alterId]) byAlter[e.alterId]={moodCounts:{},intensities:[],count:0};
    byAlter[e.alterId].moodCounts[e.mood]=(byAlter[e.alterId].moodCounts[e.mood]||0)+1;
    if (e.intensity) byAlter[e.alterId].intensities.push(e.intensity);
    byAlter[e.alterId].count++;
  });

  // Last 30 days mood by day (for trend)
  const last30 = {};
  const now = Date.now();
  for (let i=29;i>=0;i--) { const d=new Date(now-i*86400000).toISOString().slice(0,10); last30[d]={date:d,entries:[]}; }
  entries.forEach(e=>{ if(last30[e.date]) last30[e.date].entries.push(e); });

  // Build MOOD_SCORE for trend
  const MOOD_SCORE = {};
  moods.forEach((m,i)=>{ MOOD_SCORE[m.id]=Math.max(1,Math.round(5-(i/Math.max(moods.length-1,1))*4)); });
  const trendDays = Object.values(last30);
  const maxScore  = Math.max(...trendDays.map(d=>d.entries.length?d.entries.reduce((s,e)=>s+(MOOD_SCORE[e.mood]||3),0)/d.entries.length:0),1);

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <!-- Global mood frequency -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Global distribution · ${totalMoods} records</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sortedMoods.map(m=>{
            const c=moodCount[m.id]||0; const pct=Math.round((c/totalMoods)*100);
            return `<div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:18px">${m.emoji}</span>
                <span style="font-size:12px;color:var(--text-1);flex:1">${escM(m.label)}</span>
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${c} · ${pct}%</span>
              </div>
              ${_analisisBarH(pct,'var(--accent)')}
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Trend last 30 days -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Trend · last 30 days</div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:48px">
          ${trendDays.map(d=>{
            const score=d.entries.length?d.entries.reduce((s,e)=>s+(MOOD_SCORE[e.mood]||3),0)/d.entries.length:0;
            const h=score>0?Math.max(Math.round((score/maxScore)*44),4):2;
            const isToday=d.date===new Date().toISOString().slice(0,10);
            return `<div style="flex:1;border-radius:2px 2px 0 0;background:${score>0?(isToday?'var(--accent)':'var(--accent-3)'):'var(--bg-3)'};height:${h}px" title="${d.date}${d.entries.length?' · '+d.entries.length+' record'+(d.entries.length!==1?'s':''):''}"></div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3)">30 days ago</span>
          <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text-3)">today</span>
        </div>
      </div>
      ${Object.keys(byAlter).length>1?`<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">By alter</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${Object.entries(byAlter).sort((a,b)=>b[1].count-a[1].count).map(([aid,st])=>{
            const alt=alters.find(a=>a.id===aid); if(!alt) return '';
            const top3=Object.entries(st.moodCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
            const avgInt=st.intensities.length?(st.intensities.reduce((a,b)=>a+b,0)/st.intensities.length).toFixed(1):null;
            return `<div style="display:flex;align-items:flex-start;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
              <span style="font-size:22px;flex-shrink:0">${escM(alt.emoji||'●')}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:${alt.color||'var(--text-1)'}">${escM(alt.name)}</div>
                <div style="font-size:11px;color:var(--text-3);margin-top:2px">${st.count} record${st.count!==1?'s':''}${avgInt?' · int. '+avgInt+'/5':''}</div>
                <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
                  ${top3.map(([mid,c])=>{ const m=moods.find(x=>x.id===mid); return m?`<span style="font-size:11px;background:var(--bg-2);border:1px solid var(--border);border-radius:20px;padding:2px 8px">${m.emoji} ${escM(m.label)} <span style="color:var(--text-3)">${c}</span></span>`:''; }).join('')}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`:''}
    </div>`;
}

// ── TRIGGERS ──
function renderAnalisisTriggers(cont, alters) {
  const crisisLog = loadCrisisLog();
  const triggers  = loadSaludTriggers();
  if (!crisisLog.length) { cont.innerHTML=`<div class="empty-state" style="padding:60px 20px"><div class="empty-icon">⚡</div><div>No crisis episodes recorded</div></div>`; return; }

  const trigCount   = {};
  crisisLog.forEach(e=>{ if(e.triggerId) trigCount[e.triggerId]=(trigCount[e.triggerId]||0)+1; });
  const maxTrigCount = Math.max(...Object.values(trigCount),1);
  const sortedTrigs  = Object.entries(trigCount).sort((a,b)=>b[1]-a[1]);

  // Crisis level distribution
  const levelCount = {};
  crisisLog.forEach(e=>{ levelCount[e.level]=(levelCount[e.level]||0)+1; });
  const totalCrisis = crisisLog.length;

  const levelDur = {}; const levelN = {};
  crisisLog.forEach(e=>{ if(e.endedAt&&e.startedAt){ levelDur[e.level]=(levelDur[e.level]||0)+(e.endedAt-e.startedAt); levelN[e.level]=(levelN[e.level]||0)+1; } });

  // Without trigger
  const noTrigger = crisisLog.filter(e=>!e.triggerId).length;

  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <!-- Level summary -->
      <div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">By level · ${totalCrisis} episodes</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${CRISIS_LEVELS.filter(l=>levelCount[l.id]).map(l=>{
            const c=levelCount[l.id]||0; const pct=Math.round((c/totalCrisis)*100);
            const avgD=levelN[l.id]?fmtDuration(Math.round(levelDur[l.id]/levelN[l.id])):null;
            return `<div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span class="proto-level-badge" style="color:${l.color};border-color:${l.color};background:${l.bg};flex-shrink:0">${l.label}</span>
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);flex:1">${c} episode${c!==1?'s':''}${avgD?' · avg '+avgD:''}</span>
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3)">${pct}%</span>
              </div>
              ${_analisisBarH(pct,l.color)}
            </div>`;
          }).join('')}
        </div>
      </div>
      ${sortedTrigs.length?`<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Trigger frequency</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sortedTrigs.map(([tid,c])=>{
            const trig=triggers.find(t=>t.id===tid); const pct=Math.round((c/maxTrigCount)*100);
            const thisLevels={};
            crisisLog.filter(e=>e.triggerId===tid).forEach(e=>{ thisLevels[e.level]=(thisLevels[e.level]||0)+1; });
            const topLevel=Object.entries(thisLevels).sort((a,b)=>b[1]-a[1])[0]?.[0];
            const lvl=CRISIS_LEVELS.find(l=>l.id===topLevel);
            return `<div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:14px">⚡</span>
                <span style="font-size:12px;color:var(--text-1);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escM(trig?.titulo||tid)}</span>
                ${lvl?`<span style="font-size:10px;color:${lvl.color};border:1px solid ${lvl.color};background:${lvl.bg};border-radius:4px;padding:1px 5px;flex-shrink:0">${lvl.label}</span>`:''}
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);flex-shrink:0">${c}×</span>
              </div>
              ${_analisisBarH(pct,'#ff8ae2')}
            </div>`;
          }).join('')}
          ${noTrigger>0?`<div style="font-size:11px;color:var(--text-3);padding-top:4px;border-top:1px solid var(--border)">${noTrigger} episode${noTrigger!==1?'s':''} with no trigger recorded</div>`:''}
        </div>
      </div>`:`<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:var(--radius-md);padding:20px;text-align:center;color:var(--text-3);font-size:13px">No triggers linked to episodes</div>`}
    </div>`;
}
function loadTracker()  { try { return JSON.parse(localStorage.getItem('tid_tracker'))||[]; } catch{return[];} }
function saveTracker(t) { localStorage.setItem('tid_tracker', JSON.stringify(t)); }
const TRACKER_HISTORY_PAGE = 30;

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
    <div class="modal-title">${isEdit?'Edit reminder':'New reminder'}</div>
    <div class="reminder-form-grid">
      <div class="form-row">
        <div class="form-label">Icon</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px">
          ${REMINDER_ICONS.map(ic=>`<div class="emoji-opt-btn${r.icon===ic?' selected':''}" data-ri="${ic}" style="font-size:20px;width:36px;height:36px">${ic}</div>`).join('')}
        </div>
        <input type="hidden" id="r-icon" value="${r.icon||'🔔'}">
      </div>
      <div class="form-row">
        <div class="form-label">Title</div>
        <input type="text" id="r-title" placeholder="What to remember..." value="${r.title||''}">
      </div>
      <div class="form-row">
        <div class="form-label">Description (optional)</div>
        <textarea id="r-desc" rows="2" placeholder="Details...">${r.desc||''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-label">Date and time</div>
        <input type="datetime-local" id="r-datetime" value="${dtStr}">
      </div>
      <div class="form-row">
        <div class="form-label">Repeat</div>
        <div class="recurrence-opts">
          ${REMINDER_RECURRENCE.map(rc=>`<div class="rec-opt${r.recurrence===rc.id?' selected':''}" data-rc="${rc.id}">${rc.label}</div>`).join('')}
        </div>
        <input type="hidden" id="r-recurrence" value="${r.recurrence||'none'}">
      </div>
      <div class="form-row">
        <div class="form-label">For alter (optional)</div>
        <select id="r-alter">
          <option value="">Entire system</option>
          ${alters.map(a=>`<option value="${a.id}" ${r.alterId===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-primary" data-submit>${isEdit?'Save':'Create'}</button>
    </div>`;

  openModal(modalHTML, ov => {
    const title = ov.querySelector('#r-title').value.trim();
    if (!title) { showToast('⚠ Title is required'); return; }
    const datetimeVal = ov.querySelector('#r-datetime').value;
    if (!datetimeVal) { showToast('⚠ Date is required'); return; }
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
    showToast(isEdit?'Reminder updated ✓':'Reminder created ✓');
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
  const freqLabel = {rara:'○ Rare', ocasional:'◑ Occasional', frecuente:'● Frequent'}[f.frecuencia||'ocasional'];
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
          <div class="fec-name">${f.nombre || 'No name'}</div>
          ${f.apodos ? `<div style="font-size:10px;color:#8884a8;font-family:'DM Mono',monospace;margin-bottom:2px">${f.apodos}</div>` : ''}
          <div class="fec-archetype">${[f.arquetipo, f.genero, f.edad].filter(Boolean).join(' · ') || '—'}</div>
          <div class="fec-pronombres" style="color:${color}">${f.pronombres || '—'}</div>
        </div>
        <div class="fec-freq" style="border-color:${freqColors[f.frecuencia||'ocasional']};color:${freqTextColors[f.frecuencia||'ocasional']};background:${freqColors[f.frecuencia||'ocasional']}">${freqLabel}</div>
      </div>
      <div class="fec-body">
        ${f.frase ? `<div class="fec-quote" style="border-color:${color};color:#b8b4d8">${f.frase}</div>` : ''}
        ${f.frase_larga ? `<div class="fec-field"><div class="fec-label">Reflection</div><div class="fec-value" style="font-style:italic">${f.frase_larga}</div></div>` : ''}

        <div class="fec-row">
          ${frow('Role in the system', f.rol_publico)}
          ${frow('Energy · Element', [f.energia, f.elemento].filter(Boolean).join(' · '))}
        </div>

        ${f.descripcion ? `<div class="fec-field"><div class="fec-label">Description</div><div class="fec-value">${f.descripcion}</div></div>` : ''}
        ${rasgosHtml ? `<div class="fec-field"><div class="fec-label">Traits</div><div class="fec-tags">${rasgosHtml}</div></div>` : ''}

        ${(f.fortalezas || f.vulnerabilidades) ? `
        <div class="fec-row">
          ${f.fortalezas ? `<div class="fec-field"><div class="fec-label">Strengths</div><div class="fec-value">${f.fortalezas}</div></div>` : '<div></div>'}
          ${f.vulnerabilidades ? `<div class="fec-field"><div class="fec-label">Vulnerabilities</div><div class="fec-value">${f.vulnerabilidades}</div></div>` : '<div></div>'}
        </div>` : ''}

        ${f.valores ? `<div class="fec-field"><div class="fec-label">Values</div><div class="fec-value">${f.valores}</div></div>` : ''}
        ${f.conflicto ? `<div class="fec-field"><div class="fec-label">Internal conflict</div><div class="fec-value">${f.conflicto}</div></div>` : ''}

        ${(f.senales || f.afinidades || f.limites) ? `
        <div class="fec-field" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">
          <div class="fec-label" style="margin-bottom:6px">System</div>
          ${f.senales ? `<div style="margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Signs: </span><span style="font-size:11px;color:#c8c4e8">${f.senales}</span></div>` : ''}
          ${f.afinidades ? `<div style="margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Affinities: </span><span style="font-size:11px;color:#c8c4e8">${f.afinidades}</span></div>` : ''}
          ${f.limites ? `<div><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Limits: </span><span style="font-size:11px;color:#c8c4e8">${f.limites}</span></div>` : ''}
        </div>` : ''}

        <div class="fec-bars">
          <div class="fec-bar-wrap">
            <div class="fec-bar-label">Emotional</div>
            <div class="fec-bar-track"><div class="fec-bar-fill" style="width:${nivelEmocional}%;background:linear-gradient(90deg,${color},#ff8ae2)"></div></div>
            <span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">${nivelEmocional}%</span>
          </div>
          <div class="fec-bar-wrap">
            <div class="fec-bar-label">Usual energy</div>
            <div class="fec-bar-track"><div class="fec-bar-fill" style="width:${energiaHab}%;background:${color}"></div></div>
            <span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">${f.energia_habitual||3}/5</span>
          </div>
        </div>

        ${(f.estetica || f.musica || f.colores) ? `
        <div class="fec-row">
          ${f.estetica ? `<div class="fec-field"><div class="fec-label">Aesthetic</div><div class="fec-value">${f.estetica}</div></div>` : '<div></div>'}
          ${f.musica ? `<div class="fec-field"><div class="fec-label">Music</div><div class="fec-value">${f.musica}</div></div>` : '<div></div>'}
        </div>` : ''}
        ${f.colores ? `<div class="fec-field"><div class="fec-label">Colors</div><div class="fec-value">${f.colores}</div></div>` : ''}

        ${(f.animal || f.objeto || f.estacion) ? `
        <div class="fec-row">
          ${f.animal ? `<div class="fec-field"><div class="fec-label">Animal</div><div class="fec-value">${f.animal}</div></div>` : '<div></div>'}
          ${f.objeto ? `<div class="fec-field"><div class="fec-label">Object</div><div class="fec-value">${f.objeto}</div></div>` : '<div></div>'}
          ${f.estacion ? `<div class="fec-field"><div class="fec-label">Season</div><div class="fec-value">${f.estacion}</div></div>` : '<div></div>'}
        </div>` : ''}

        ${paletteHtml ? `<div class="fec-field"><div class="fec-label">Personal palette</div><div class="fec-palette">${paletteHtml}</div></div>` : ''}
        ${moodHtml ? `<div class="fec-field"><div class="fec-label">Moodboard</div><div class="fec-tags">${moodHtml}</div></div>` : ''}

        ${(f.habilidades || f.social) ? `
        <div class="fec-row">
          ${f.habilidades ? `<div class="fec-field"><div class="fec-label">Skills</div><div class="fec-value">${f.habilidades}</div></div>` : '<div></div>'}
          ${f.social ? `<div class="fec-field"><div class="fec-label">Social</div><div class="fec-value">${f.social}</div></div>` : '<div></div>'}
        </div>` : ''}

        ${f.como_hablar ? `<div class="fec-field"><div class="fec-label">How to talk to them</div><div class="fec-value">${f.como_hablar}</div></div>` : ''}
        ${f.incomoda ? `<div class="fec-field"><div class="fec-label">What bothers them</div><div class="fec-value">${f.incomoda}</div></div>` : ''}
        ${f.seguridad ? `<div class="fec-field"><div class="fec-label">What makes them feel safe</div><div class="fec-value">${f.seguridad}</div></div>` : ''}

        ${(()=>{ const cfs=(f.customFields||[]).filter(cf=>cf.key); return cfs.length ? `
        <div class="fec-field" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">
          <div class="fec-label" style="margin-bottom:6px">Additional fields</div>
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
      showToast('Image export requires connectivity or a local library');
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
      showToast(`Card exported: ${f.nombre} ✓`);
    }).catch(() => {
      stage.innerHTML = '';
      if (btn) { btn.classList.remove('loading'); btn.textContent = '↓ img'; }
      showToast('⚠ Error exporting image');
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
  const freqLabel = {rara:'○ Rare', ocasional:'◑ Occasional', frecuente:'● Frequent'}[f.frecuencia||'ocasional'];
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
        <div class="fec-name">${esc(f.nombre || 'No name')}</div>
        ${f.apodos ? `<div style="font-size:10px;color:#8884a8;font-family:'DM Mono',monospace;margin-bottom:2px">${esc(f.apodos)}</div>` : ''}
        <div class="fec-archetype">${esc([f.arquetipo, f.genero, f.edad].filter(Boolean).join(' · ') || '—')}</div>
        <div class="fec-pronombres" style="color:${color}">${esc(f.pronombres || '—')}</div>
      </div>
      <div class="fec-freq" style="border-color:${freqColors[f.frecuencia||'ocasional']};color:${freqTextColors[f.frecuencia||'ocasional']};background:${freqColors[f.frecuencia||'ocasional']}">${freqLabel}</div>
    </div>
    <div class="fec-body">
      ${f.frase ? `<div class="fec-quote" style="border-color:${color};color:#b8b4d8">${esc(f.frase)}</div>` : ''}
      ${f.frase_larga ? `<div class="fec-field"><div class="fec-label">Reflection</div><div class="fec-value" style="font-style:italic">${esc(f.frase_larga)}</div></div>` : ''}
      <div class="fec-row">
        ${frow('Role in the system', f.rol_publico)}
        ${frow('Energy · Element', [f.energia, f.elemento].filter(Boolean).join(' · '))}
      </div>
      ${f.descripcion ? `<div class="fec-field"><div class="fec-label">Description</div><div class="fec-value">${esc(f.descripcion)}</div></div>` : ''}
      ${rasgosHtml ? `<div class="fec-field"><div class="fec-label">Traits</div><div class="fec-tags">${rasgosHtml}</div></div>` : ''}
      ${(f.fortalezas || f.vulnerabilidades) ? `<div class="fec-row">
        ${f.fortalezas ? `<div class="fec-field"><div class="fec-label">Strengths</div><div class="fec-value">${esc(f.fortalezas)}</div></div>` : '<div></div>'}
        ${f.vulnerabilidades ? `<div class="fec-field"><div class="fec-label">Vulnerabilities</div><div class="fec-value">${esc(f.vulnerabilidades)}</div></div>` : '<div></div>'}
      </div>` : ''}
      ${frow('Values', f.valores)}
      ${frow('Inner conflict', f.conflicto)}
      ${(f.senales || f.afinidades || f.limites) ? `<div class="fec-field" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">
        <div class="fec-label" style="margin-bottom:6px">System</div>
        ${f.senales ? `<div style="margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Signals: </span><span style="font-size:11px;color:#c8c4e8">${esc(f.senales)}</span></div>` : ''}
        ${f.afinidades ? `<div style="margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Affinities: </span><span style="font-size:11px;color:#c8c4e8">${esc(f.afinidades)}</span></div>` : ''}
        ${f.limites ? `<div><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">Limits: </span><span style="font-size:11px;color:#c8c4e8">${esc(f.limites)}</span></div>` : ''}
      </div>` : ''}
      <div class="fec-bars">
        <div class="fec-bar-wrap">
          <div class="fec-bar-label">Emotional</div>
          <div class="fec-bar-track"><div class="fec-bar-fill" style="width:${nivelEmocional}%;background:linear-gradient(90deg,${color},#ff8ae2)"></div></div>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">${nivelEmocional}%</span>
        </div>
        <div class="fec-bar-wrap">
          <div class="fec-bar-label">Usual energy</div>
          <div class="fec-bar-track"><div class="fec-bar-fill" style="width:${energiaHab}%;background:${color}"></div></div>
          <span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90">${f.energia_habitual||3}/5</span>
        </div>
      </div>
      ${(f.estetica || f.musica) ? `<div class="fec-row">
        ${f.estetica ? `<div class="fec-field"><div class="fec-label">Aesthetic</div><div class="fec-value">${esc(f.estetica)}</div></div>` : '<div></div>'}
        ${f.musica ? `<div class="fec-field"><div class="fec-label">Music</div><div class="fec-value">${esc(f.musica)}</div></div>` : '<div></div>'}
      </div>` : ''}
      ${frow('Colours', f.colores)}
      ${(f.animal || f.objeto || f.estacion) ? `<div class="fec-row">
        ${f.animal ? `<div class="fec-field"><div class="fec-label">Animal</div><div class="fec-value">${esc(f.animal)}</div></div>` : '<div></div>'}
        ${f.objeto ? `<div class="fec-field"><div class="fec-label">Object</div><div class="fec-value">${esc(f.objeto)}</div></div>` : '<div></div>'}
        ${f.estacion ? `<div class="fec-field"><div class="fec-label">Season</div><div class="fec-value">${esc(f.estacion)}</div></div>` : '<div></div>'}
      </div>` : ''}
      ${paletteHtml ? `<div class="fec-field"><div class="fec-label">Colour palette</div><div class="fec-palette">${paletteHtml}</div></div>` : ''}
      ${moodHtml ? `<div class="fec-field"><div class="fec-label">Moodboard</div><div class="fec-tags">${moodHtml}</div></div>` : ''}
      ${(f.habilidades || f.social) ? `<div class="fec-row">
        ${f.habilidades ? `<div class="fec-field"><div class="fec-label">Skills</div><div class="fec-value">${esc(f.habilidades)}</div></div>` : '<div></div>'}
        ${f.social ? `<div class="fec-field"><div class="fec-label">Social</div><div class="fec-value">${esc(f.social)}</div></div>` : '<div></div>'}
      </div>` : ''}
      ${frow('How to talk to them', f.como_hablar)}
      ${frow('What makes them uncomfortable', f.incomoda)}
      ${frow('What makes them feel safe', f.seguridad)}
      ${(()=>{ const cfs=(f.customFields||[]).filter(cf=>cf.key); return cfs.length ? `<div class="fec-field" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">
        <div class="fec-label" style="margin-bottom:6px">Additional fields</div>
        ${cfs.map(cf=>`<div style="display:flex;gap:8px;margin-bottom:4px"><span style="font-family:'DM Mono',monospace;font-size:9px;color:#6e6a90;min-width:90px;flex-shrink:0">${esc(cf.key)}</span><span style="font-size:11px;color:#c8c4e8">${esc(cf.value||'—')}</span></div>`).join('')}
      </div>` : ''; })()}
    </div>
    <div class="fec-footer">
      <span class="fec-footer-label">Atria</span>
      <span class="fec-footer-label" style="color:${color}">${esc(f.nombre || '')} ${esc(f.symbol || '◈')}</span>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Card — ${esc(f.nombre || 'Alter')}</title>
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
  a.download = `card-${(f.nombre||'alter').toLowerCase().replace(/\s+/g,'-')}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  showToast(`Card for ${f.nombre} exported as HTML ✓`);
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
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">No cards created</div>
      <div>Create detailed profile cards for the system alters.</div>
      <button class="btn btn-primary" style="margin-top:16px" id="btn-new-ficha-2">Create first card</button>
    </div>`;
    cont.querySelector('#btn-new-ficha-2')?.addEventListener('click', () => openFichaModal(null));
    return;
  }

  // Filter by role if active
  if(alteresRoleFilter) fichas = fichas.filter(f => (f.rol_publico||'').trim().toLowerCase() === alteresRoleFilter.trim().toLowerCase());
  // Sort
  if(alteresSortMode === 'alpha') fichas = [...fichas].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  else if(alteresSortMode === 'date') fichas = [...fichas].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));

  const isListMode = alteresViewMode === 'list';
  const gridClass = isListMode ? 'fichas-list' : 'fichas-grid';

  cont.innerHTML = `<div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <div style="position:relative;flex:1;min-width:200px;max-width:320px">
          <input id="fichas-search" type="text" placeholder="Search by name, role or archetype…"
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
      : `<div style="grid-column:1/-1;padding:40px 20px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;color:var(--text-3)">No results for «${esc(q)}»</div>`;
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
      <div class="fli-name">${escF(f.nombre||'No name')}</div>
      <div class="fli-sub">${escF(f.rol_publico||'—')}${f.pronombres?' · '+escF(f.pronombres):''}${f.arquetipo?' · '+escF(f.arquetipo):''} <span style="color:var(--text-3)">${freqDot}</span></div>
      ${f.descripcion?`<div class="list-desc">${escF(f.descripcion)}</div>`:''}
      <div class="list-tags">
        ${f.rol_publico?`<span class="perm-chip on">${escF(f.rol_publico)}</span>`:''}
        ${f.arquetipo?`<span class="perm-chip">${escF(f.arquetipo)}</span>`:''}
      </div>
    </div>
    </div>
    <div class="fli-actions list-actions">
      <button class="btn btn-ghost btn-sm" style="padding:4px 9px;font-size:10px" data-ficha-edit="${f.id}" title="Edit card">✎ Edit</button>
      <button class="ficha-export-btn" data-ficha-export="${f.id}" title="Export as image">↓ img</button>
      <button class="ficha-export-btn" data-ficha-html="${f.id}" title="Export as HTML">↓ html</button>
      <button class="btn btn-danger" style="padding:4px 9px;font-size:10px;border-color:rgba(255,107,138,.15)" data-ficha-del="${f.id}" title="Delete card">✕</button>
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
      if(!confirm('Delete this card?')) return;
      saveFichas(loadFichas().filter(x=>x.id!==btn.dataset.fichaDel));
      showToast('Card deleted');
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
  const freqLabel = {rara:'Rare',ocasional:'Occasional',frecuente:'Frequent'}[freqClass]||'Occasional';
  const freqDot = {rara:'○',ocasional:'◑',frecuente:'●'}[freqClass]||'◑';

  const fv = (val) => val
    ? `<div class="ffield-value">${escF(val)}</div>`
    : `<div class="ffield-value empty">—</div>`;

  return `
<div class="alter-profile-card" data-id="${f.id}" style="--card-color:${f.color||'#a08aff'};--card-bg:${f.bg||'rgba(160,138,255,0.10)'}">
  ${f.bannerImg?`<div class="ficha-card-banner" style="background-image:url(${f.bannerImg});background-size:cover;background-position:center;height:60px;position:relative"><div class="ficha-card-banner-av" style="position:absolute;bottom:-22px;left:14px"><div class="ficha-avatar" style="width:44px;height:44px;font-size:20px">${f.avatarImg?`<img src="${f.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:escF(f.emoji||'◎')}<div class="ficha-avatar-symbol" style="width:16px;height:16px;font-size:9px">${escF(f.symbol||'◈')}</div></div></div></div>`:''}
  <div class="card-top${f.bannerImg?' has-banner':''}">
    ${!f.bannerImg?`<div class="ficha-avatar">
      ${f.avatarImg ? `<img src="${f.avatarImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : escF(f.emoji||'◎')}
      <div class="ficha-avatar-symbol">${escF(f.symbol||'◈')}</div>
    </div>`:''}
    <div class="card-header-info">
      <div class="card-name">${escF(f.nombre||'No name')}</div>
      <div class="card-pronouns">${escF(f.pronombres||'—')}${f.edad?` · ${escF(f.edad)}`:''}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;margin-left:auto">
      <button class="btn btn-ghost" style="padding:4px 9px;font-size:10px" data-ficha-edit="${f.id}" title="Edit profile">✎ Edit</button>
      <button class="ficha-export-btn" data-ficha-export="${f.id}" title="Export as image">↓ img</button>
      <button class="ficha-export-btn" data-ficha-html="${f.id}" title="Export as HTML">↓ html</button>
      <button class="btn btn-danger" style="padding:4px 9px;font-size:10px;border-color:rgba(255,107,138,.15)" data-ficha-del="${f.id}" title="Delete profile">✕ Delete</button>
    </div>
  </div>
  <div class="card-role-block">
    <div class="card-role-label">Role in the system</div>
    <div class="card-role-text">${escF(f.rol_publico||'—')}</div>
  </div>
  ${f.frase?`<div class="card-quote">${escF(f.frase)}</div>`:''}
  <div class="card-expand-btn">
    <span class="card-expand-label">See more</span>
    <span class="card-expand-chevron">▾</span>
  </div>
  <div class="card-panel">
    <div class="panel-tabs">
      <div class="panel-tab active" data-tab="identidad">Identity</div>
      <div class="panel-tab" data-tab="sistema">System</div>
      <div class="panel-tab" data-tab="psique">Psyche</div>
      <div class="panel-tab" data-tab="preferencias">Preferences</div>
      <div class="panel-tab" data-tab="funcional">Functional</div>
    </div>

    <div class="panel-content active" data-tab="identidad">
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Name</div>${fv(f.nombre)}</div>
        <div class="ffield"><div class="ffield-label">Nicknames</div>${fv(f.apodos)}</div>
      </div>
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Pronouns</div>${fv(f.pronombres)}</div>
        <div class="ffield"><div class="ffield-label">Gender</div>${fv(f.genero)}</div>
      </div>
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Age / range</div>${fv(f.edad)}</div>
        <div class="ffield"><div class="ffield-label">Archetype</div>${fv(f.arquetipo)}</div>
      </div>
      ${(f.paleta||[]).length?`<div class="ffield"><div class="ffield-label">Personal palette</div><div class="ficha-palette">${palette}</div></div>`:''}
      <div class="ffield"><div class="ffield-label">Description</div>${fv(f.descripcion)}</div>
      ${f.frase_larga?`<div class="ffield"><div class="ffield-label">Reflection</div>${fv(f.frase_larga)}</div>`:''}
    </div>

    <div class="panel-content" data-tab="sistema">
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Public role</div>${fv(f.rol_publico)}</div>
        <div class="ffield">
          <div class="ffield-label">Presence frequency</div>
          <div><span class="ficha-freq-badge ${freqClass}">${freqDot} ${freqLabel}</span></div>
        </div>
      </div>
      <div class="ffield"><div class="ffield-label">Presence signs</div>${fv(f.senales)}</div>
      <div class="ffield"><div class="ffield-label">Affinities with other alters</div>${fv(f.afinidades)}</div>
      <div class="ffield"><div class="ffield-label">Limits & Needs</div>${fv(f.limites)}</div>
      ${relsHtml ? `<div class="ffield"><div class="ffield-label">Links</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">${relsHtml}</div></div>` : ''}
      ${_linkedAlter?.memoriaConoce ? `<div class="ffield"><div class="ffield-label">Knows about the system</div>${fv(_linkedAlter.memoriaConoce)}</div>` : ''}
      ${_linkedAlter?.memoriaNoConoce ? `<div class="ffield"><div class="ffield-label">Does not know</div>${fv(_linkedAlter.memoriaNoConoce)}</div>` : ''}
    </div>

    <div class="panel-content" data-tab="psique">
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Dominant energy</div>${fv(f.energia)}</div>
        <div class="ffield"><div class="ffield-label">Element</div>${fv(f.elemento)}</div>
      </div>
      ${rasgos?`<div class="ffield"><div class="ffield-label">Traits</div><div class="ficha-tags">${rasgos}</div></div>`:''}
      <div class="ffield"><div class="ffield-label">Strengths</div>${fv(f.fortalezas)}</div>
      <div class="ffield"><div class="ffield-label">Vulnerabilities</div>${fv(f.vulnerabilidades)}</div>
      <div class="ffield"><div class="ffield-label">Values</div>${fv(f.valores)}</div>
      <div class="ffield"><div class="ffield-label">Internal conflict</div>${fv(f.conflicto)}</div>
      <div class="ffield">
        <div class="ffield-label">Emotional level · ${levelFill}%</div>
        <div class="ficha-emotion-bar-wrap">
          <div class="ficha-emotion-bar"><div class="ficha-emotion-bar-fill" style="width:${levelFill}%"></div></div>
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">${dotsStr}</span>
        </div>
      </div>
    </div>

    <div class="panel-content" data-tab="preferencias">
      <div class="ffield"><div class="ffield-label">Aesthetic</div>${fv(f.estetica)}</div>
      <div class="ffield"><div class="ffield-label">Music</div>${fv(f.musica)}</div>
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Favorite colors</div>${fv(f.colores)}</div>
        <div class="ffield"><div class="ffield-label">Animal</div>${fv(f.animal)}</div>
      </div>
      <div class="ffield-row">
        <div class="ffield"><div class="ffield-label">Symbolic object</div>${fv(f.objeto)}</div>
        <div class="ffield"><div class="ffield-label">Season</div>${fv(f.estacion)}</div>
      </div>
      ${moodWords?`<div class="ffield"><div class="ffield-label">Moodboard</div><div style="display:flex;flex-wrap:wrap;gap:5px">${moodWords}</div></div>`:''}
      ${f.frase_larga?`<div class="ffield"><div class="ffield-label">Reflection</div>${fv(f.frase_larga)}</div>`:''}
    </div>

    <div class="panel-content" data-tab="funcional">
      <div class="ffield"><div class="ffield-label">Skills</div>${fv(f.habilidades)}</div>
      <div class="ffield"><div class="ffield-label">How they interact socially</div>${fv(f.social)}</div>
      <div class="ffield">
        <div class="ffield-label">Usual energy</div>
        <div class="ficha-energy-row">${energyPips}<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-2)">${f.energia_habitual||3}/5</span></div>
      </div>
      <div class="ffield"><div class="ffield-label">How to talk to them</div>${fv(f.como_hablar)}</div>
      <div class="ffield"><div class="ffield-label">What makes them uncomfortable</div>${fv(f.incomoda)}</div>
      <div class="ffield"><div class="ffield-label">What makes them feel safe</div>${fv(f.seguridad)}</div>
      ${(()=>{ const cfs=(f.customFields||[]).filter(cf=>cf.key); return cfs.length?`
        <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px">
          <div class="ffield-label" style="margin-bottom:6px">Additional fields</div>
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
        <div class="modal-title">${isEdit?'Edit sheet · '+escF(f.nombre):'New sheet'}</div>
        <div class="modal-subtitle">Detailed alter information</div>
      </div>
      <button class="icon-btn" id="fm-close">✕</button>
    </div>
    <div class="ficha-modal-tabs">
      ${['Identity','System','Psyche','Preferences','Functional','Extras'].map((t,i)=>
        `<div class="ficha-modal-tab${i===0?' active':''}" data-section="${t.toLowerCase()}">${esc(t)}</div>`
      ).join('')}
    </div>
    <div class="ficha-modal-body">

      <!-- IDENTITY -->
      <div class="ficha-modal-section active" data-sec="identity">
        <div class="ficha-form-field full">
          <div class="ficha-form-label">Avatar</div>
          <div class="avatar-mode-toggle" style="margin-bottom:8px">
            <div class="avatar-mode-btn${_fichaAvatarMode==='emoji'?' active':''}" id="fav-mode-emoji">Emoji</div>
            <div class="avatar-mode-btn${_fichaAvatarMode==='img'?' active':''}" id="fav-mode-img">Image</div>
          </div>
          <div id="fav-emoji-panel" style="${_fichaAvatarMode==='img'?'display:none':''}">
            <input class="ficha-form-input" id="fm-emoji" value="${escF(f.emoji)}" placeholder="◎" style="max-width:80px">
          </div>
          <div id="fav-img-panel" style="${_fichaAvatarMode==='emoji'?'display:none':''}">
            <div class="avatar-upload-area" id="fav-upload-area">
              <div id="fav-img-preview" style="${_fichaAvatarImg?'':'display:none'}">
                <img id="fav-img-el" src="${_fichaAvatarImg||''}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--border-active)">
                <button class="btn btn-ghost btn-sm" id="fav-btn-remove" style="margin-top:6px;font-size:11px">✕ Remove image</button>
              </div>
              <div id="fav-img-placeholder" style="${_fichaAvatarImg?'display:none':''}">
                <div style="font-size:28px;margin-bottom:6px">📷</div>
                <div style="font-size:12px;color:var(--text-2)">Upload avatar image</div>
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text-3);margin-top:3px">JPG, PNG, WEBP · max 2MB</div>
              </div>
              <input type="file" id="fav-file-input" accept="image/*" style="display:none">
            </div>
            <input type="hidden" id="fm-avatar-img" value="${_fichaAvatarImg||''}">
          </div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Symbol</div><input class="ficha-form-input" id="fm-symbol" value="${escF(f.symbol)}" placeholder="◈" style="max-width:80px"></div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Color</div><input type="color" id="fm-color" value="${f.color}" style="height:36px;border-radius:8px;border:1px solid var(--border);background:var(--bg-2);cursor:pointer"></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Pronouns</div><input class="ficha-form-input" id="fm-pronombres" value="${escF(f.pronombres)}" placeholder="she, he, they..."></div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field full">
            <div class="ficha-form-label">Profile banner</div>
            <div class="avatar-upload-area" id="fm-banner-area" style="height:72px;flex-direction:row;justify-content:center;${_fichaBannerImg?`background-image:url(${_fichaBannerImg});background-size:cover;background-position:center;border-color:var(--border-active)`:''}">
              ${_fichaBannerImg
                ? `<button class="btn btn-ghost btn-sm" id="fm-banner-remove" style="font-size:11px;background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.2);color:#fff">✕ Remove banner</button>`
                : `<div style="text-align:center"><div style="font-size:20px;margin-bottom:4px">🖼</div><div style="font-size:11px;color:var(--text-2)">Banner image</div></div>`}
              <input type="file" id="fm-banner-input" accept="image/*" style="display:none">
            </div>
            <input type="hidden" id="fm-banner-img" value="${_fichaBannerImg||''}">
          </div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Name</div><input class="ficha-form-input" id="fm-nombre" value="${escF(f.nombre)}" placeholder="Alter name"></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Nicknames</div><input class="ficha-form-input" id="fm-apodos" value="${escF(f.apodos)}" placeholder="Nicknames or alternative names"></div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Gender</div><input class="ficha-form-input" id="fm-genero" value="${escF(f.genero)}" placeholder="Gender or identity"></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Age / range</div><input class="ficha-form-input" id="fm-edad" value="${escF(f.edad)}" placeholder="Adult, little, 20s..."></div>
        </div>
        <div class="ficha-form-field full"><div class="ficha-form-label">General description</div><textarea class="ficha-form-input" id="fm-descripcion" rows="3" placeholder="Who is this alter, their essence...">${escF(f.descripcion)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Representative quote</div><input class="ficha-form-input" id="fm-frase" value="${escF(f.frase)}" placeholder="A phrase that defines them..."></div>
      </div>

      <!-- SISTEMA -->
      <div class="ficha-modal-section" data-sec="system">
        <div class="ficha-form-field full"><div class="ficha-form-label">Role in the system</div><textarea class="ficha-form-input" id="fm-rol" rows="2" placeholder="What function they serve in the system...">${escF(f.rol_publico)}</textarea></div>
        <div class="ficha-form-field full">
          <div class="ficha-form-label">Presence frequency</div>
          <select class="ficha-form-input" id="fm-frecuencia">
            <option value="rara" ${f.frecuencia==='rara'?'selected':''}>○ Rare</option>
            <option value="ocasional" ${f.frecuencia==='ocasional'?'selected':''}>◑ Occasional</option>
            <option value="frecuente" ${f.frecuencia==='frecuente'?'selected':''}>● Frequent</option>
          </select>
        </div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Presence signs (how to know they are here)</div><textarea class="ficha-form-input" id="fm-senales" rows="2" placeholder="Changes in speech, posture, energy...">${escF(f.senales)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Affinities with other alters</div><textarea class="ficha-form-input" id="fm-afinidades" rows="2" placeholder="Who they connect well with and why...">${escF(f.afinidades)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Limits & Needs</div><textarea class="ficha-form-input" id="fm-limites" rows="2" placeholder="What they need from the system and what they ask to be respected...">${escF(f.limites)}</textarea></div>
        ${_fmRelsHtml ? `<div class="ficha-form-field full"><div class="ficha-form-label" style="margin-bottom:8px">Links</div><div style="display:flex;flex-wrap:wrap;gap:6px">${_fmRelsHtml}</div></div>` : ''}
      </div>

      <!-- PSIQUE -->
      <div class="ficha-modal-section" data-sec="psyche">
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Dominant energy</div><input class="ficha-form-input" id="fm-energia" value="${escF(f.energia)}" placeholder="Lunar, fiery, ethereal..."></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Element</div><input class="ficha-form-input" id="fm-elemento" value="${escF(f.elemento)}" placeholder="Water, earth, fire, air..."></div>
        </div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Main traits (comma-separated)</div><input class="ficha-form-input" id="fm-rasgos" value="${escF((f.rasgos||[]).join(', '))}" placeholder="introspective, loyal, analytical..."></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Strengths</div><textarea class="ficha-form-input" id="fm-fortalezas" rows="2" placeholder="Capabilities, virtues, inner resources...">${escF(f.fortalezas)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Vulnerabilities</div><textarea class="ficha-form-input" id="fm-vulnerabilidades" rows="2" placeholder="Sensitive points, difficulties...">${escF(f.vulnerabilidades)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Values</div><input class="ficha-form-input" id="fm-valores" value="${escF(f.valores)}" placeholder="Honesty, autonomy, care..."></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Internal conflict</div><textarea class="ficha-form-input" id="fm-conflicto" rows="2" placeholder="Internal tension or paradox...">${escF(f.conflicto)}</textarea></div>
        <div class="ficha-form-field full">
          <div class="ficha-form-label">Emotional level — <span id="fm-nivel-label">${f.nivel_emocional||50}</span>%</div>
          <input type="range" class="ficha-form-range" id="fm-nivel" min="0" max="100" value="${f.nivel_emocional||50}">
        </div>
      </div>

      <!-- PREFERENCIAS -->
      <div class="ficha-modal-section" data-sec="preferences">
        <div class="ficha-form-field full"><div class="ficha-form-label">Aesthetic</div><input class="ficha-form-input" id="fm-estetica" value="${escF(f.estetica)}" placeholder="Dark academia, minimalist, fae..."></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Music</div><input class="ficha-form-input" id="fm-musica" value="${escF(f.musica)}" placeholder="Genres, artists, sound environments..."></div>
        <div class="ficha-form-field full">
          <div class="ficha-form-label">Personal palette</div>
          <div class="ficha-palette-editor" id="fm-paleta-editor">
            <div class="ficha-palette-swatches" id="fm-paleta-swatches">
              ${(f.paleta||[]).length
                ? (f.paleta||[]).map(c=>`<div class="ficha-palette-swatch-wrap" data-color="${c}"><div class="ficha-palette-swatch-edit" style="background:${c}" title="${c}"></div><button class="ficha-palette-swatch-del" title="Delete">✕</button></div>`).join('')
                : '<span class="ficha-palette-empty">No colors yet</span>'}
            </div>
            <div class="ficha-palette-add-row">
              <input type="color" class="ficha-palette-add-input" id="fm-paleta-picker" value="#a08aff" title="Pick a color">
              <button class="ficha-palette-add-btn" id="fm-paleta-add">+ Add color</button>
            </div>
          </div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Favorite colors</div><input class="ficha-form-input" id="fm-colores" value="${escF(f.colores)}" placeholder="Violet, grey, midnight blue..."></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Animal</div><input class="ficha-form-input" id="fm-animal" value="${escF(f.animal)}" placeholder="Raven, cat, wolf..."></div>
        </div>
        <div class="ficha-form-row">
          <div class="ficha-form-field"><div class="ficha-form-label">Symbolic object</div><input class="ficha-form-input" id="fm-objeto" value="${escF(f.objeto)}" placeholder="A candle, a journal..."></div>
          <div class="ficha-form-field"><div class="ficha-form-label">Season</div><input class="ficha-form-input" id="fm-estacion" value="${escF(f.estacion)}" placeholder="Autumn, winter..."></div>
        </div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Moodboard in words (comma-separated)</div><input class="ficha-form-input" id="fm-moodboard" value="${escF((f.moodboard||[]).join(', '))}" placeholder="silence, full moon, ink..."></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">Reflection or longer phrase</div><textarea class="ficha-form-input" id="fm-frase-larga" rows="3" placeholder="A more personal reflection...">${escF(f.frase_larga)}</textarea></div>
      </div>

      <!-- FUNCIONAL -->
      <div class="ficha-modal-section" data-sec="functional">
        <div class="ficha-form-field full"><div class="ficha-form-label">Notable skills</div><textarea class="ficha-form-input" id="fm-habilidades" rows="2" placeholder="Writing, active listening, analysis...">${escF(f.habilidades)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">How they interact socially</div><textarea class="ficha-form-input" id="fm-social" rows="2" placeholder="Reserved, connects deeply...">${escF(f.social)}</textarea></div>
        <div class="ficha-form-field full">
          <div class="ficha-form-label">Usual energy level — <span id="fm-energia-label">${f.energia_habitual||3}</span>/5</div>
          <input type="range" class="ficha-form-range" id="fm-energia-hab" min="1" max="5" value="${f.energia_habitual||3}">
        </div>
        <div class="ficha-form-field full"><div class="ficha-form-label">How they prefer to be spoken to</div><textarea class="ficha-form-input" id="fm-como-hablar" rows="2" placeholder="Calmly, without urgency...">${escF(f.como_hablar)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">What makes them uncomfortable</div><textarea class="ficha-form-input" id="fm-incomoda" rows="2" placeholder="Excessive noise, interruptions...">${escF(f.incomoda)}</textarea></div>
        <div class="ficha-form-field full"><div class="ficha-form-label">What makes them feel safe</div><textarea class="ficha-form-input" id="fm-seguridad" rows="2" placeholder="Quiet spaces, routines...">${escF(f.seguridad)}</textarea></div>
      </div>

      <!-- EXTRAS -->
      <div class="ficha-modal-section" data-sec="extras">
        <div style="margin-bottom:10px;font-size:11px;color:var(--text-2);font-family:'DM Mono',monospace">CUSTOM FIELDS</div>
        <div id="fce-container"></div>
      </div>

    </div>
    <div class="ficha-modal-footer">
      ${isEdit?`<button class="btn btn-danger" id="fm-delete">Delete card</button>`:'<div></div>'}
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" id="fm-cancel">Cancel</button>
        <button class="btn btn-primary" id="fm-save">${isEdit?'Save Changes':'Create card'}</button>
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
        <input class="cf-input-key" placeholder="Field" value="${escB(cf.key)}" data-fcfi="${i}" data-type="key" style="width:110px;flex-shrink:0">
        <input class="cf-input-val" placeholder="Value" value="${escB(cf.value)}" data-fcfi="${i}" data-type="val" style="flex:1;min-width:0">
        <button class="icon-btn cf-del" data-fcfi="${i}" style="flex-shrink:0">✕</button>
      </div>`).join('') + '<button class="btn btn-ghost btn-sm" id="btn-add-fcf" style="margin-top:6px;font-size:11px">+ Add field</button>';
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
    }).catch(() => showToast('⚠ Could not process image'));
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
      area.innerHTML = `<button class="btn btn-ghost btn-sm" id="fm-banner-remove" style="font-size:11px;background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.2);color:#fff">✕ Remove banner</button><input type="file" id="fm-banner-input" accept="image/*" style="display:none">`;
      area.querySelector('#fm-banner-remove')?.addEventListener('click', ev => {
        ev.stopPropagation(); _fichaBannerImg = null; overlay.querySelector('#fm-banner-img').value = '';
        area.style.cssText = 'height:72px;flex-direction:row;justify-content:center;';
        area.innerHTML = `<div style="text-align:center"><div style="font-size:20px;margin-bottom:4px">🖼</div><div style="font-size:11px;color:var(--text-2)">Banner image</div></div><input type="file" id="fm-banner-input" accept="image/*" style="display:none">`;
        area.querySelector('#fm-banner-input')?.addEventListener('change', ev2 => { const f2=ev2.target.files[0]; if(!f2) return; compressImageForStorage(f2,1000,320,0.82,780).then(b=>{showImageCompressedToast(f2,b,'Banner');_fichaBannerImg=b;overlay.querySelector('#fm-banner-img').value=b;area.style.backgroundImage=`url(${b})`;area.style.backgroundSize='cover';area.style.backgroundPosition='center';}).catch(()=>showToast('⚠ Could not process image')); });
      });
      area.querySelector('#fm-banner-input')?.addEventListener('change', ev2 => { const f2=ev2.target.files[0]; if(!f2) return; compressImageForStorage(f2,1000,320,0.82,780).then(b=>{showImageCompressedToast(f2,b,'Banner');_fichaBannerImg=b;overlay.querySelector('#fm-banner-img').value=b;area.style.backgroundImage=`url(${b})`;}).catch(()=>showToast('⚠ Could not process image')); });
    }).catch(() => showToast('⚠ Could not process image'));
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
      swatchesEl.innerHTML = '<span class="ficha-palette-empty">No colors yet</span>';
    } else {
      swatchesEl.innerHTML = colors.map(c =>
        `<div class="ficha-palette-swatch-wrap" data-color="${c}">` +
        `<div class="ficha-palette-swatch-edit" style="background:${c}" title="${c}"></div>` +
        `<button class="ficha-palette-swatch-del" title="Delete">✕</button>` +
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
    if (existing.includes(color)) { showToast('That color is already in the palette'); return; }
    if (existing.length >= 12) { showToast('Maximum 12 colors in the palette'); return; }
    const wrap = document.createElement('div');
    wrap.className = 'ficha-palette-swatch-wrap';
    wrap.dataset.color = color;
    wrap.innerHTML = `<div class="ficha-palette-swatch-edit" style="background:${color}" title="${color}"></div><button class="ficha-palette-swatch-del" title="Delete">✕</button>`;
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
    if(!confirm('Delete this card?')) return;
    saveFichas(loadFichas().filter(x=>x.id!==f.id));
    close(); showToast('Card deleted'); renderAlters();
  });

  overlay.querySelector('#fm-save').addEventListener('click', () => {
    const g = id => overlay.querySelector(id)?.value?.trim()||'';
    const nombre = g('#fm-nombre');
    if(!nombre) return showToast('⚠ Name is required');
    const colorVal = overlay.querySelector('#fm-color')?.value || '#a08aff';
    const hex = colorVal.replace('#','');
    const r=parseInt(hex.substring(0,2),16),gr=parseInt(hex.substring(2,4),16),b=parseInt(hex.substring(4,6),16);

    const rasgosRaw = g('#fm-rasgos');
    const moodRaw = g('#fm-moodboard');

    // Custom fields from ficha
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
    showToast(isEdit?`Card for ${updated.nombre} saved ✓`:`${updated.nombre} added ✓`);
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

// ── Back navigation: mobile back button / Backspace desktop ─────────────────
window.addEventListener('popstate', (e) => {
  if (currentView === 'hub') {
    history.pushState({ view: 'hub' }, '', location.href.split('?')[0]);
  } else {
    navigateTo('hub', true);
  }
});

// Desktop: Backspace outside inputs → go back to hub
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Backspace' && e.key !== 'BrowserBack') return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
  if (currentView !== 'hub') {
    e.preventDefault();
    navigateTo('hub');
  }
});

// Apply saved configuration on startup
capturePendingNotifRouteFromUrl();
applyConfig(loadConfig());
installOnlineAutoBackupWatcher();
// Listen for system theme changes in auto mode
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  const cfg = loadConfig();
  if (!cfg.theme || cfg.theme === 'auto') applyTheme('auto');
});
window.addEventListener('online', refreshGlobalConnectionIndicator);
window.addEventListener('offline', refreshGlobalConnectionIndicator);
startNotifScheduler();
if (nativeNotifGranted()) scheduleOnlineWebPushSubscription();
scheduleReminderPushSync();

// First time: if no alters saved, show onboarding
// requestAnimationFrame lets the browser paint the HTML skeleton before running
// localStorage reads — improves startup on slow WebViews (e.g. Xiaomi devices).
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
