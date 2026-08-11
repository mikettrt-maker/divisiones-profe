const SUPABASE_URL = 'https://uksijdbbcdttspulslzw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrc2lqZGJiY2R0dHNwdWxzbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MDU3NjMsImV4cCI6MjA5NDM4MTc2M30.dKcqiaSwb_40oP5NFEHjvWdMaIkBBNjtF3krDbD4K2E';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storage: window.sessionStorage, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false } });

const TOTAL_LEVELS = 10, PROBLEMS_PER_LEVEL = 10, POINTS = 100;
const ADMIN_USER = 'profemiguel';
const GITHUB = 'https://mikettrt-maker.github.io/divisiones-profe/img';

let currentMainLevel = 1, currentProblemInLevel = 1, currentDivisor = 0, currentDividend = 0;
let totalScore = 0, currentUser = null, currentAvatarStyle = 'avatar1';
let isGridLocked = true, hasFinishedGame = false, isVerifying = false;
let unlockedLevel = 1, isAdmin = false;
let currentStreak = 0;
const STREAK_BONUSES = {3:30, 5:70, 10:100, 15:200};
let currentCoins = 0, playTimeCounter = 0;
let completedLevels = [];
const ANTENNA_SEQUENCE = [1,10,5,2,4,8,3,6,7,9];
let currentAntennaIndex = 0;
let gems = 0;
let playerHealth = 100;
let isDead = false;

let savedProblemKey = null;
let currentEnemyLevel = 1;
let enemyEnergy = 100;

let userSquadId = null;
let squadMissionsData = [];

// Variables de misiones
let totalCoinsEarned   = 0;
let totalShieldsEarned = 0;
let maxStreak          = 0;
let missionsCompleted  = [];
let hasDiamondArmor    = false;
let chosenReward = null;
let pendingChoice = false;

const ENEMIES = {
  1:  { name:'El Engendro',             jpg: GITHUB+'/engendro.svg', story:'Nació de un ritual que jamás debió completarse. El hechicero quiso crear vida y solo obtuvo carne que olvida su forma. Dicen que cada noche le crece un miembro nuevo, y que llora con voces que no le pertenecen. Quien lo mira demasiado tiempo empieza a escuchar esas voces dentro de su propia cabeza.' },
  2:  { name:'La Plaga de Sangre',      jpg: GITHUB+'/La%20Plaga%20de%20Sangre.svg', story:'Cuando el último curandero del reino murió sin confesar sus pecados, su sangre siguió viviendo sin él. Ahora corre por los sótanos del castillo buscando un cuerpo digno. Dicen que si la dejas tocarte, deja de ser ella: pasas a ser tú la plaga, y ella quien te recuerda.' },
  3:  { name:'El Monje Ciego',          jpg: GITHUB+'/El%20Monje%20Ciego.svg', story:'En la abadía quemada vaga un monje que se arrancó los ojos para no ver los pecados de sus hermanos. Pero la oscuridad le devolvió algo peor que la vista: la certeza de que ninguno de los suyos murió de verdad. Camina los pasillos con los párpados cosidos, y quien lo oye rezar ya no vuelve a dormir.' },
  4:  { name:'La Dama del Espejo',      jpg: GITHUB+'/La%20Dama%20del%20Espejo.svg', story:'Fue la esposa del rey hasta que el rey prefirió su propio reflejo. Enloquecida, rompió todos los espejos del castillo... menos uno, el que ahora la tiene prisionera al otro lado. Suplican los guardias que no la mires a los ojos: ella no busca un cuerpo, busca un rostro que robar.' },
  5:  { name:'El Verdugo Real',         jpg: GITHUB+'/El%20Verdugo%20Real.svg', story:'Dicen que cuando el rey cayó, todos huyeron del castillo... menos él. El Verdugo Real sigue allí, con su armadura negra y su hacha al hombro, cumpliendo un deber que nadie le ordenó. Sube y baja las escaleras de la torre a la misma hora de cada noche, y ya nadie cuenta sus pasos porque siempre son los mismos. Quien se atreve a pedirle alojamiento recibe la misma respuesta: el rey aún no ha vuelto. Y cuando despiertan a la mañana siguiente, la puerta del castillo está abierta... esperando a que alguien más entre.' },
  6:  { name:'El Sepulturero',          jpg: GITHUB+'/El%20Sepulturero.svg', story:'Cava las tumbas de los vivos. Tiene un cuaderno con la fecha de la muerte de cada habitante del pueblo, y nadie sabe de dónde sacó tanto detalle. Cada atardecer abre una fosa nueva y espera. Si tu nombre aparece en su lista, mejor no preguntes para cuándo.' },
  7:  { name:'La Sombra Eterna',        jpg: GITHUB+'/La%20Sombra%20Eterna.svg', story:'No es una sombra: es lo que queda de una persona que fue borrada del mundo en vida. Camina pegada a las paredes porque el suelo le recuerda que no existe. A veces se equivoca y se pega a un viajero. Cuando eso pasa, el viajero deja de tener reflejo... y ella empieza a tener uno.' },
  8:  { name:'El Cazador de Brujos',    jpg: GITHUB+'/El%20Cazador%20de%20Brujos.svg', story:'Quemó su propia sombra convencido de que era su enemiga. Cuando el humo se disipó, la hoguera seguía encendida y ella seguía dentro, sonriendo. Desde entonces no puede apagar el fuego que arde en su pecho, y caza a todo lo que se le parezca. El pueblo dice que las cenizas de su sombra aún le susurran por las noches.' },
  9:  { name:'El Señor de la Penumbra', jpg: GITHUB+'/El%20Señor%20de%20la%20Penumbra.svg', story:'Gobernó el reino cuando la luz valía más que el oro. Prohibió las velas, los astros y hasta la luna para que nadie viera su verdadera forma. Su trono está en el cuarto sin ventanas del castillo, y los que entraron a servirle salieron... solo de noche, solo de perfil, solo de espaldas.' },
  10: { name:'El Último Merovingio',    jpg: GITHUB+'/El%20Último%20Merovingio.svg', story:'El último de su dinastía no murió: se negó. Su corona quedó clavada en su cráneo el día de su funeral, y desde entonces reina sobre un cortejo fúnebre que no termina de enterrarlo. Cada luna nueva elige un súbdito para que lleve su ataúd un tramo más. Cuando el ataúd llegue al final, el reino entero despertará muerto.' }
};

const WEAPONS = {
  dagger: { icon:'<span class="weapon-icon"><img src="'+GITHUB+'/daga.svg" style="width:100%;height:100%;display:block;"></span>', name:'Daga de los Sicambrios', damage:100, shieldDmg:0, price:100, desc:'Rauda y silenciosa' },
  sword: { icon:'<span class="weapon-icon"><img src="'+GITHUB+'/espada.svg" style="width:100%;height:100%;display:block;"></span>', name:'Espada Franca', damage:300, shieldDmg:1, price:250, desc:'Equilibrio en batalla' },
  bow: { icon:'<span class="weapon-icon"><img src="'+GITHUB+'/arco.svg" style="width:100%;height:100%;display:block;"></span>', name:'Arco de la Reina', damage:500, shieldDmg:2, price:400, desc:'Dispara desde lejos' },
  axe: { icon:'<span class="weapon-icon"><img src="'+GITHUB+'/hacha.svg" style="width:100%;height:100%;display:block;"></span>', name:'Hacha de los Brujos', damage:800, shieldDmg:3, price:600, desc:'Golpe brutal' },
  hammer: { icon:'<span class="weapon-icon"><img src="'+GITHUB+'/martillo.svg" style="width:100%;height:100%;display:block;"></span>', name:'Martillo de la Justicia', damage:1500, shieldDmg:5, price:1000, desc:'Destructor de reinos' }
};

let inventory = { dagger: 0, sword: 0, bow: 0, axe: 0, hammer: 0 };
let shieldDurability = 0;
let totalAttacks = 0;
let purchasedAvatars = [];
let purchasedBanners = [];
let currentBanner = 'banner1';
let purchasedPets = [];
let currentPet = 'none';
let purchasedSkills = [];

const SKILLS = {
  rafaga_plus: { name:'Ráfaga Plus', price:2000, desc:'Duplica las bonificaciones de racha', icon:'⚡', color:'#ffd700', file:'rafaga-plus.svg' },
  escudos_30:  { name:'Escudos x 30',  price:2000, desc:'Obtén 30 usos de escudo al instante', icon:'🛡️', color:'#00bfff', file:'escudos-x-30.svg' },
  runa_doble:  { name:'Runa de Doble Ataque', price:2000, desc:'20% de probabilidad de doblar puntos y monedas al acertar', icon:'🔮', color:'#bf40ff', file:'runa-doble-ataque.svg' },
  reduce_dano: { name:'Escudo de Energía', price:2000, desc:'Reduce el daño recibido al fallar en 50%', icon:'✨', color:'#00ff88', file:'escudo-de-energia.svg' }
};

const PETS = {
  perro:  { name:'Hell Hound',        file:'perro.svg',  price:7000,  desc:'+50% monedas al acertar', coinsBonus:0.5, pointsBonus:0 },
  oso:    { name:'Oso Berserker',     file:'oso.svg',    price:7000,  desc:'+50% puntos al acertar',  coinsBonus:0,   pointsBonus:0.5 },
  lobo: { name:'Lobo de Fenrir',    file:'lobo.svg', price:10000, desc:'+50% monedas y +50% puntos', coinsBonus:0.5, pointsBonus:0.5 }
};

const BANNERS = {};
for(let i=1;i<=12;i++){
  const free = i===1;
  const fileName = i === 8 ? 'banner 8.svg' : 'banner' + i + '.svg';
  BANNERS['banner'+i] = { name: free ? 'Estandarte de Inicio' : 'Estandarte Nº '+i, file: encodeURI(fileName), price: free ? 0 : 2000, free };
}

const VIDEO_AVATARS = {
  avatar16: { name:'Kaelen', file:'kaelen.mp4', price:5000, img:GITHUB+'/kaelen.svg' },
  avatar17: { name:'Thorne', file:'thorne.mp4', price:5000, img:GITHUB+'/thorne.svg' },
  avatar18: { name:'Hermes', file:'hermes.mp4', price:5000, img:GITHUB+'/hermes.svg' }
};

const AVATAR_STYLES_STANDARD = [
  { id:'avatar1', name:'Llama del Norte',    url: GITHUB+'/Llama%20del%20Norte.svg' },
  { id:'avatar11', name:'Valkira',           url: GITHUB+'/valkira.svg' },
  { id:'avatar12', name:'Vira',              url: GITHUB+'/vira.svg' },
  { id:'avatar13', name:'Draven',            url: GITHUB+'/draven.svg' },
  { id:'avatar14', name:'Soren',             url: GITHUB+'/soren.svg' },
  { id:'avatar15', name:'Riven',             url: GITHUB+'/riven.svg' }
];
const AVATAR_STYLES_EXCLUSIVE = [];

const RANKS = [
  {name:"Aprendiz",min:0,max:1499,icon:`<img src="https://mikettrt-maker.github.io/divisiones-profe/img/aprendiz.svg">`,css:"rank-iron",avatar:"avatar-iron"},
  {name:"Compañero",min:1500,max:3999,icon:`<img src="https://mikettrt-maker.github.io/divisiones-profe/img/compañero.svg">`,css:"rank-bronze",avatar:"avatar-bronze"},
  {name:"Caballero",min:4000,max:7999,icon:`<img src="https://mikettrt-maker.github.io/divisiones-profe/img/caballero.svg">`,css:"rank-silver",avatar:"avatar-silver"},
  {name:"Señor del Templo",min:8000,max:12999,icon:`<img src="https://mikettrt-maker.github.io/divisiones-profe/img/señordeltemplo.svg">`,css:"rank-gold",avatar:"avatar-gold"},
  {name:"Gran Maestre",min:13000,max:19999,icon:`<img src="https://mikettrt-maker.github.io/divisiones-profe/img/granmaestre.svg">`,css:"rank-platinum",avatar:"avatar-platinum"},
  {name:"Gran Maestre del Códice",min:20000,max:999999,icon:`<img src="https://mikettrt-maker.github.io/divisiones-profe/img/granmaestredelcodice.svg">`,css:"rank-heroic",avatar:"avatar-heroic"}
];

const SQUADS = {
  1:{name:"La Casa del Trueno",color:"#00d4ff",file:"lacasadeltrueno.svg",svg:`<img src="https://mikettrt-maker.github.io/divisiones-profe/img/lacasadeltrueno.svg">`},
  2:{name:"Reyes Brujos",color:"#9b59b6",file:"reyesbrujos.svg",svg:`<img src="https://mikettrt-maker.github.io/divisiones-profe/img/reyesbrujos.svg">`},
  3:{name:"Guardianes del Grial",color:"#ffd700",file:"guardianesgrial.svg",svg:`<img src="https://mikettrt-maker.github.io/divisiones-profe/img/guardianesgrial.svg">`},
  4:{name:"Ejército de la Penumbra",color:"#c0392b",file:"ejercitodelapenumbra.svg",svg:`<img src="https://mikettrt-maker.github.io/divisiones-profe/img/ejercitodelapenumbra.svg">`}
};

const MISSIONS = [
  { id:0, img:'https://mikettrt-maker.github.io/divisiones-profe/img/14.jpg', title:'3000 Florines', desc:'Acumula 3000 florines en total', check:()=>totalCoinsEarned>=3000, progress:()=>({cur:Math.min(totalCoinsEarned,3000),max:3000}) },
  { id:1, img:'https://mikettrt-maker.github.io/divisiones-profe/img/13.jpg', title:'50 Escudos', desc:'Obtén 50 usos de escudo en total', check:()=>totalShieldsEarned>=50, progress:()=>({cur:Math.min(totalShieldsEarned,50),max:50}) },
  { id:2, img:'https://mikettrt-maker.github.io/divisiones-profe/img/12.jpg', title:'10 Ataques', desc:'Realiza 10 ataques contra rivales', check:()=>totalAttacks>=10, progress:()=>({cur:Math.min(totalAttacks,10),max:10}) },
  { id:3, img:'https://mikettrt-maker.github.io/divisiones-profe/img/11.jpg', title:'Racha de 15', desc:'Alcanza una racha de 15 aciertos', check:()=>maxStreak>=15, progress:()=>({cur:Math.min(maxStreak,15),max:15}) },
  { id:4, img:'https://mikettrt-maker.github.io/divisiones-profe/img/rangos%20del%20clan.svg', title:'2000 Puntos', desc:'Acumula 2000 puntos de rango', check:()=>totalScore>=2000, progress:()=>({cur:Math.min(totalScore,2000),max:2000}) }
];

let typingTimer;

function getRankInfo(score){
  let rank = RANKS[0];
  for(let i=0;i<RANKS.length;i++) if(score>=RANKS[i].min) rank=RANKS[i];
  let tier="I", range=rank.max-rank.min;
  if(score<rank.min+range/3) tier="III";
  else if(score<rank.min+(range/3)*2) tier="II";
  let pct = Math.min(100,((score-rank.min)/range)*100);
  return {...rank, tier, pct};
}
