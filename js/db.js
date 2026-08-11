// ── Limpiar completedLevels para evitar claves de niveles futuros ──
function cleanCompletedLevels(arr) {
  if (!Array.isArray(arr)) return [];
  const maxLvl = Math.max(currentMainLevel, unlockedLevel);
  return arr.filter(key => {
    const match = key.match(/^L(\d+)_P/);
    return match && parseInt(match[1]) <= maxLvl;
  });
}

// ── Guardar progreso de misiones ──────────────
async function saveMissionProgress() {
  if (!currentUser) return;
  const missionFlags = {
    mission1_completed: missionsCompleted.includes(0),
    mission2_completed: missionsCompleted.includes(1),
    mission3_completed: missionsCompleted.includes(2),
    mission4_completed: missionsCompleted.includes(3),
    mission5_completed: missionsCompleted.includes(4)
  };
  try {
    await _supabase.from('profiles').update({
      total_coins_earned:   totalCoinsEarned,
      total_shields_earned: totalShieldsEarned,
      max_streak:           maxStreak,
      diamond_armor:    hasDiamondArmor,
      inventory_codex_sword: inventory.codex_sword || 0,
      chosen_reward: chosenReward,
      pending_choice: pendingChoice,
      total_attacks: totalAttacks,
      ...missionFlags
    }).eq('id', currentUser.id);
  } catch(e) { console.error('Error guardando misiones:', e); }
}

// ── Ataque con Espada del Códice ──────────────
async function attackWithCodexSword(targetId, targetName) {
  if (!inventory.codex_sword || inventory.codex_sword <= 0) return showToast('No tienes la Espada del Códice', 'tomato');
  if (!confirm(`⚔️💀 ¿Usar la ESPADA DEL CÓDICE contra ${targetName}?\nSus puntos quedarán en 0. Ignora todos los escudos.\n(Solo la Armadura de Diamante puede resistirla)`)) return;

  const prevSwordCount = inventory.codex_sword;

  inventory.codex_sword--;
  updateInventoryUI();

  try {
    // Primero guardar el descuento del atacante
    const { error: attError } = await _supabase.from('profiles').update({
      inventory_codex_sword: inventory.codex_sword
    }).eq('id', currentUser.id);
    if (attError) throw new Error('No se pudo usar la Espada.');

    // Obtener datos de la víctima
    const { data: victim, error: fetchError } = await _supabase.from('profiles').select('total_score, diamond_armor, username').eq('id', targetId).single();
    if (fetchError || !victim) throw new Error('Rival no encontrado');

    if (victim.diamond_armor) {
      showToast(`🛡️<img src="${GITHUB}/diamante.svg" class="coin-inline"> ¡${targetName} tiene la ARMADURA DE DIAMANTE! Tu Espada del Códice no tuvo efecto.`, 'tomato', 6000);
      // Devolver la espada
      inventory.codex_sword++;
      updateInventoryUI();
      await _supabase.from('profiles').update({ inventory_codex_sword: inventory.codex_sword }).eq('id', currentUser.id);
    } else {
      const { error: updateError } = await _supabase.from('profiles').update({ total_score: 0 }).eq('id', targetId);
      if (updateError) throw updateError;
      showToast(`⚔️💀 ¡DEVASTADOR! ${targetName} ha perdido TODOS sus puntos (${victim.total_score} → 0)`, 'tomato', 7000);
      AudioEngine.playEpic();
      updateRanking();
    }
  } catch(e) {
    console.error('Error en ataque Espada del Códice:', e);
    // Revertir
    inventory.codex_sword = prevSwordCount;
    updateInventoryUI();
    await _supabase.from('profiles').update({ inventory_codex_sword: prevSwordCount }).eq('id', currentUser.id);
    showToast('❌ Error: ' + e.message, 'tomato');
  }
}

// ── Ataque general a usuario ──
async function attackUser(targetId, targetName, weaponType) {
  const weapon = WEAPONS[weaponType];
  if(!weapon) return;
  if(inventory[weaponType] <= 0) return showToast("¡No tienes esta arma!",'tomato');
  if(!confirm(`¿Usar ${weapon.icon} ${weapon.name} contra ${targetName}? (-${weapon.damage} pts, -${weapon.shieldDmg} 🛡️)`)) return;

  const prevInventory = { ...inventory };
  const prevAttacks = totalAttacks;

  inventory[weaponType]--; totalAttacks++; updateInventoryUI();
  checkAndAwardMissions();
  renderMissionCards();

  try {
    // 1. Guardar descuento del atacante
    const { error: updateAttackerError } = await _supabase.from('profiles').update({
      [`inventory_${weaponType}`]: inventory[weaponType],
      total_attacks: totalAttacks
    }).eq('id', currentUser.id);
    if (updateAttackerError) throw new Error('No se pudo descontar el arma.');

    // 2. Leer estado de la víctima
    const { data: victim, error: fetchError } = await _supabase
      .from('profiles')
      .select('total_score, shield_durability')
      .eq('id', targetId)
      .single();
    if(fetchError || !victim) throw new Error("Aspirante no encontrado");

    let updates = {};
    let msg = '';
    let victimShield = victim.shield_durability || 0;
    let currentVictimScore = victim.total_score || 0;

    if(victimShield > 0) {
      const newShield = Math.max(0, victimShield - weapon.shieldDmg);
      updates.shield_durability = newShield;
      msg = `🛡️ ¡${targetName} tenía PROTECCIÓN! Tu ${weapon.icon} le quitó ${weapon.shieldDmg} puntos de escudo.`;
      if(newShield === 0) msg += " ¡Escudo destruido!";
    } else {
      const newScore = Math.max(0, currentVictimScore - weapon.damage);
      updates.total_score = newScore;
      msg = `${weapon.icon} ¡Atacaste a ${targetName} con ${weapon.name}! Perdió ${weapon.damage} puntos. (${currentVictimScore} → ${newScore})`;
    }

    const { error: updateError } = await _supabase
      .from('profiles')
      .update(updates)
      .eq('id', targetId);
    if(updateError) throw updateError;

    showToast(msg, 'tomato', 5000);
    updateRanking();
  } catch(e) {
    console.error('Error en ataque:', e);
    // Revertir localmente
    inventory = prevInventory;
    totalAttacks = prevAttacks;
    updateInventoryUI();
    // Intentar restaurar en BD
    await _supabase.from('profiles').update({
      [`inventory_${weaponType}`]: prevInventory[weaponType],
      total_attacks: prevAttacks
    }).eq('id', currentUser.id);
    showToast("❌ Error: " + e.message, 'tomato');
  }
}

// ── Guardar inventario en BD ──
function saveInventory(){
  if(!currentUser) return;
  _supabase.from('profiles').update({
    inventory_dagger: inventory.dagger, inventory_sword: inventory.sword,
    inventory_bow: inventory.bow, inventory_axe: inventory.axe, inventory_hammer: inventory.hammer,
    shield_durability: shieldDurability, total_attacks: totalAttacks,
    gems: gems
  }).eq('id', currentUser.id).then(res => { if(res.error) console.error("Error guardando inventario", res.error); });
}

// ── Actualizar ranking global ──
let rankInt;
let rankingDataCache = [];
async function updateRanking(){
  const list = document.getElementById('ranking-list');
  try {
    const { data, error } = await _supabase.from('profiles')
      .select('id,username,total_score,avatar_style,banner_style,pet_style,completed_at,is_banned,squad_id,shield_durability,player_health,last_seen,current_level,coins,gems,total_attacks,purchased_skills,pvp_victorias,pvp_derrotas')
      .is('completed_at', null)
      .eq('is_banned', false)
      .order('total_score',{ascending:false});
    if(error) throw error;
    if(!data||!data.length){ list.innerHTML='<li style="text-align:center;padding:10px;color:#666;">La corte está vacía.</li>'; return; }

    rankingDataCache = data;
    renderFullRanking(data);
    updateSquadRanking(data);
    loadActiveMissions(data);
  } catch(err){ list.innerHTML='<li style="text-align:center;padding:10px;color:red;">Error.</li>'; }
}

// ── Actualizar ranking de clanes/squads ──
function updateSquadRanking(all){
  const list = document.getElementById('squad-list'), ss = {};
  Object.keys(SQUADS).forEach(id=>ss[id]=0);
  all.forEach(u=>{ if(u.squad_id&&SQUADS[u.squad_id]) ss[u.squad_id] += (u.total_score||0); });
  list.innerHTML = Object.entries(ss).sort((a,b)=>b[1]-a[1]).map(([id,sc])=>{
    const sq = SQUADS[id];
    return `<li class="squad-rank-item" style="border-left-color:${sq.color}"><div class="squad-rank-left"><div class="squad-shield-small">${sq.svg}</div><div class="squad-name-scroll" style="color:${sq.color}"><span class="squad-name-text">${sq.name}</span></div></div><span class="squad-score">${sc} pts</span></li>`;
  }).join('');
}

// ── Cargar decretos activos para la interfaz del alumno ──
async function loadActiveMissions(allData){
  if(!userSquadId) { document.getElementById('squad-missions-panel').style.display='none'; return; }
  document.getElementById('squad-missions-panel').style.display = 'block';
  const { data: missions } = await _supabase.from('squad_missions').select('*').eq('is_active', true);
  if(!missions || missions.length === 0) { document.getElementById('missions-body').innerHTML = '<p style="text-align:center;color:#666;font-family:\'Cinzel\',serif;">No hay decretos activos.</p>'; return; }
  const { data: granted } = await _supabase.from('decreto_recompensas').select('mission_id').eq('squad_id', userSquadId);
  const grantedSet = new Set((granted||[]).map(g => g.mission_id));
  _supabase.rpc('resolver_decretos').catch(() => {});
  const squadMembers = allData.filter(u => u.squad_id == userSquadId);
  let squadPoints = squadMembers.reduce((sum, u) => sum + (u.total_score||0), 0);
  let squadAttacks = squadMembers.reduce((sum, u) => sum + (u.total_attacks||0), 0);
  let maxLevel = Math.max(...squadMembers.map(u => u.current_level||1), 0);
  const body = document.getElementById('missions-body');
  body.innerHTML = missions.map(m => {
    let currentVal = 0;
    if(m.type === 'points') currentVal = squadPoints;
    else if(m.type === 'attacks') currentVal = squadAttacks;
    else if(m.type === 'level') currentVal = maxLevel;
    const pct = Math.min(100, Math.round((currentVal / m.goal) * 100));
    const done = pct >= 100;
    const awarded = grantedSet.has(m.id);
    const txt = awarded ? '🎁 ¡Recompensa entregada!' : (done ? '✅ ¡Completada!' : `${Math.min(currentVal, m.goal)}/${m.goal}`);
    return `<div class="mission-item ${done?'mission-complete':''}"><div class="mission-header"><span class="mission-name">${m.name}</span><span class="mission-reward">+${m.reward} <img src="${GITHUB}/florines.svg" class="coin-inline"></span></div><div class="mission-bar-wrap"><div class="mission-bar" style="width:${pct}%"></div></div><div class="mission-progress-text">${txt}</div></div>`;
  }).join('');
}

// ── Salón de los Reyes ──
async function loadHallOfFame(){
  const list = document.getElementById('fame-list');
  try {
    const { data, error } = await _supabase.from('profiles').select('username,completed_at').not('completed_at','is',null).order('completed_at',{ascending:true}).limit(5);
    if(error) throw error;
    if(!data||!data.length){ list.innerHTML='<li style="text-align:center;color:#555;font-size:.8rem;padding:10px;font-family:\'Cinzel\',serif;">Nadie ha completado el Códice aún</li>'; return; }
    list.innerHTML = data.map(u=>{ const d = new Date(u.completed_at); return `<li class="fame-item"><i class="fas fa-crown" style="color:var(--cr-gold)"></i><span style="font-family:'Cinzel',serif;">Rey ${u.username}</span><span class="fame-time">${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></li>`; }).join('');
  } catch(e) { console.error(e); }
}

// ── Iniciar Heartbeat y control de tiempo del alumno ──
function startStudentHeartbeat(){
  setInterval(async () => { if(currentUser && !isAdmin) await _supabase.from('profiles').update({last_seen: new Date().toISOString()}).eq('id', currentUser.id); }, 15000);
  if (currentUser && !isAdmin) {
    _supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
  }
  setInterval(() => { if(!isGridLocked && !hasFinishedGame){ playTimeCounter++; if(playTimeCounter%60 === 0) saveTime(); } }, 1000);
  setInterval(async () => {
    if(!currentUser || isAdmin) return;
    const { data } = await _supabase.from('profiles').select('pending_gift_coins').eq('id', currentUser.id).single();
    if(data && data.pending_gift_coins > 0) {
      const amount = data.pending_gift_coins;
      currentCoins += amount;
      updateCoinDisplay();
      await _supabase.from('profiles').update({
        pending_gift_coins: 0,
        coins: currentCoins
      }).eq('id', currentUser.id);
      const icon = document.getElementById('gift-icon');
      const badge = document.getElementById('gift-badge');
      icon.style.display = 'inline-block'; icon.classList.add('blinking');
      badge.style.display = 'block'; badge.innerText = `+${amount}`;
      showToast(`🎁 ¡El Maestre te ha ofrendado ${amount} florines!`, 'success', 5000);
      AudioEngine.playSuccess();
      // Las misiones no se disparan por esto
      setTimeout(() => { icon.classList.remove('blinking'); setTimeout(() => { icon.style.display = 'none'; badge.style.display = 'none'; }, 2500); }, 4000);
    }
  }, 4000);
}

// ── Iniciar sesión del alumno ──
async function handleLogin(){
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value;
  const e = document.getElementById('login-error');
  if(!u || p.length < 6){ e.textContent = "Datos incompletos."; e.style.display='block'; return; }
  try {
    const { data, error } = await _supabase.auth.signInWithPassword({ email: u+"@profemiguel.com", password: p });
    if(error) throw error;
    currentUser = data.user; showApp();
  } catch(err){ e.textContent = "Error: "+err.message; e.style.display='block'; }
}

// ── Registro de cuenta de alumno ──
async function handleRegister(){
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value;
  const e = document.getElementById('login-error');
  if(!u || p.length < 6){ e.textContent = "Datos incompletos."; e.style.display='block'; return; }
  try {
    const { data, error } = await _supabase.auth.signUp({ email: u+"@profemiguel.com", password: p });
    if(error) throw error;
    await _supabase.from('profiles').insert({
      id: data.user.id,
      username: u,
      total_score: 0,
      current_level: 1,
      current_problem: 1,
      coins: 0,
      gems: 0,
      player_health: 100,
      is_dead: false,
      enemy_energy: 100,
      shield_durability: 0,
      total_attacks: 0,
      avatar_style: 'avatar1',
      squad_id: 0,
      is_banned: false,
      completed_levels: [],
      inventory_dagger: 0,
      inventory_sword: 0,
      inventory_bow: 0,
      inventory_axe: 0,
      inventory_hammer: 0
    });
    alert("Registrado. Entra ahora.");
  } catch(err){ e.textContent = "Error: "+err.message; e.style.display='block'; }
}

// ── Cerrar sesión ──
async function logout(){
  if (currentUser && !isAdmin) {
    await saveScore();
  }
  document.body.classList.remove('admin-mode');
  await _supabase.auth.signOut();
  currentUser = null; totalScore = 0; currentCoins = 0; enemyEnergy = 100; currentStreak = 0;
  inventory = { dagger:0, sword:0, bow:0, axe:0, hammer:0 };
  shieldDurability = 0; completedLevels = []; savedProblemKey = null; currentEnemyLevel = 1;
  gems = 0; playerHealth = 100; isDead = false;
  chosenReward = null;
  pendingChoice = false;
  showLogin(); clearInterval(rankInt);
}

// ── Cargar perfil completo de base de datos ──
async function loadScore(user){
  try {
    const { data } = await _supabase.from('profiles').select('*').eq('id', user.id).single();
    if(data?.is_banned){ alert("Tu cuenta está suspendida."); logout(); return; }
    isAdmin = data?.is_admin === true || user.email.split('@')[0] === ADMIN_USER;
    currentCoins = data?.coins || 0;
    gems = data?.gems || 0;
    playerHealth = data?.player_health != null ? data.player_health : 100;
    isDead = data?.is_dead || false;

    // Regalos del profesor
    if (data?.pending_gift_coins > 0) {
      const gift = data.pending_gift_coins;
      currentCoins += gift;
      await _supabase.from('profiles').update({
        coins: currentCoins,
        pending_gift_coins: 0
      }).eq('id', user.id);
      showToast(`🎁 ¡Recibiste ${gift} florines de ofrenda!`, 'success');
    }

    totalScore = data?.total_score || 0;
    currentAvatarStyle = data?.avatar_style || 'avatar1';
    unlockedLevel = data?.current_level || 1;
    currentProblemInLevel = data?.current_problem || 1;
    if(currentProblemInLevel > 10) currentProblemInLevel = 1;
    hasFinishedGame = data?.completed_at || false;
    savedProblemKey = data?.current_problem_key || null;
    if (savedProblemKey) {
      const m2 = savedProblemKey.match(/^L(\d+)_P(\d+)_D(\d+)_S(\d+)$/);
      if (m2) currentProblemInLevel = parseInt(m2[2]);
    }
    currentEnemyLevel = data?.enemy_level || unlockedLevel;
    // Confiar SIEMPRE en la energía guardada: si el enemigo quedó vencido (0) debe seguir vencido.
    // La columna legacy enemy_level puede traer un valor viejo y descartar la sangre por error.
    if (data?.enemy_energy != null && data.enemy_energy >= 0) {
      enemyEnergy = data.enemy_energy;
    } else {
      enemyEnergy = 100;
    }
    currentEnemyLevel = unlockedLevel;

    playTimeCounter = data?.total_time_played || 0;
    shieldDurability = data?.shield_durability || 0;
    totalAttacks = data?.total_attacks || 0;
    inventory.dagger = data?.inventory_dagger || 0;
    inventory.sword = data?.inventory_sword || 0;
    inventory.bow = data?.inventory_bow || 0;
    inventory.axe = data?.inventory_axe || 0;
    inventory.hammer = data?.inventory_hammer || 0;
    totalCoinsEarned   = data?.total_coins_earned   || 0;
    totalShieldsEarned = data?.total_shields_earned || 0;
    maxStreak          = data?.max_streak           || 0;
    hasDiamondArmor    = data?.diamond_armor        || false;
    inventory.codex_sword = data?.inventory_codex_sword || 0;
    chosenReward = data?.chosen_reward || null;
    pendingChoice = data?.pending_choice || false;
    purchasedAvatars = data?.purchased_avatars || [];
    purchasedBanners = data?.purchased_banners || [];
    currentBanner = data?.banner_style || 'banner1';
    purchasedPets = data?.purchased_pets || [];
    currentPet = data?.pet_style || 'none';
    purchasedSkills = data?.purchased_skills || [];

    // ── Nivel real y autocura de cuentas atrasadas ──
    // Se deriva de completed_levels CRUDO (antes de limpiar, porque cleanCompletedLevels
    // filtra por currentMainLevel que al cargar aún es 1 y descartaría niveles futuros)
    const rawCompleted = data?.completed_levels || [];
    let derivedLevel = 1;
    for (const k of rawCompleted) {
      const mk = k.match(/^L(\d+)_P/);
      if (mk) derivedLevel = Math.max(derivedLevel, parseInt(mk[1]));
    }
    if ((data?.current_level || 1) > derivedLevel) derivedLevel = data.current_level;
    const derivedComplete = `L${derivedLevel}_P${PROBLEMS_PER_LEVEL}`;
    if (rawCompleted.includes(derivedComplete) && derivedLevel < TOTAL_LEVELS) derivedLevel++;
    if (unlockedLevel < derivedLevel) {
      unlockedLevel = derivedLevel;
      enemyEnergy = 100;
      const keyLvl = savedProblemKey && savedProblemKey.match(/^L(\d+)_P/);
      if (!savedProblemKey || (keyLvl && parseInt(keyLvl[1]) < derivedLevel)) {
        currentProblemInLevel = 1;
        savedProblemKey = null;
        await _supabase.from('profiles').update({
          current_level: unlockedLevel,
          current_problem: 1,
          enemy_energy: 100,
          current_problem_key: null
        }).eq('id', user.id);
      } else {
        await _supabase.from('profiles').update({ current_level: unlockedLevel }).eq('id', user.id);
      }
    }
    // currentMainLevel ya corregido para que el limpiado conserve los niveles reales
    if (currentMainLevel < unlockedLevel) currentMainLevel = unlockedLevel;
    completedLevels = cleanCompletedLevels(rawCompleted);

    // Corregir energía baja en cuentas afectadas por el bug de problemas repetidos
    const doneLevel = completedLevels.filter(k => k.startsWith('L' + unlockedLevel + '_P')).length;
    const expectedFinal = Math.max(0, 100 - doneLevel * 10);
    if (enemyEnergy < expectedFinal) enemyEnergy = expectedFinal;
    enemyEnergy = Math.min(100, enemyEnergy);

    missionsCompleted = [];
    if (data?.mission1_completed) missionsCompleted.push(0);
    if (data?.mission2_completed) missionsCompleted.push(1);
    if (data?.mission3_completed) missionsCompleted.push(2);
    if (data?.mission4_completed) missionsCompleted.push(3);
    if (data?.mission5_completed) missionsCompleted.push(4);

    updateCoinDisplay(); updateHealthBar(); updateInventoryUI(); updateStreakUI();
    renderMissionCards();
    updatePvPBadge();

    if(data?.squad_id && SQUADS[data.squad_id]){
      userSquadId = data.squad_id;
    } else { userSquadId = null; }
  } catch(e){
    console.error('Error cargando score:', e);
    totalScore = 0; currentAvatarStyle = 'avatar1'; unlockedLevel = 1;
    currentProblemInLevel = 1; hasFinishedGame = false; playTimeCounter = 0;
    currentCoins = 0; shieldDurability = 0; totalAttacks = 0;
    inventory = { dagger:0, sword:0, bow:0, axe:0, hammer:0 };
    completedLevels = []; savedProblemKey = null; enemyEnergy = 100; currentEnemyLevel = 1;
    gems = 0; playerHealth = 100; isDead = false;
    isAdmin = (user.email.split('@')[0] === ADMIN_USER);
  }
  document.getElementById('admin-header-btn').classList.toggle('visible', isAdmin);
  if(hasFinishedGame) document.getElementById('msg').innerHTML = "<span style='color:var(--cr-gold);font-family:\"Cinzel\",serif;'>¡Ya completaste el Códice!</span>";
  currentMainLevel = unlockedLevel;
  populateLevelSelect(); updateUI(); renderMainAvatar(); if(typeof renderSkillOrbs==='function') renderSkillOrbs();
}

// ── Guardar progreso de tiempo jugado ──
async function saveTime(){
  if(!currentUser) return;
  try { await _supabase.from('profiles').update({total_time_played: playTimeCounter}).eq('id', currentUser.id); } catch(e){}
}

// ── Guardar estado completo del alumno (ej. al salir) ──
async function saveScore(){
  if(!currentUser) return false;
  try {
    const safeCompleted = cleanCompletedLevels(completedLevels);
    const { error } = await _supabase
      .from('profiles')
      .update({
        total_score: totalScore,
        current_level: unlockedLevel,
        current_problem: currentProblemInLevel,
        coins: currentCoins,
        inventory_dagger: inventory.dagger,
        inventory_sword: inventory.sword,
        inventory_bow: inventory.bow,
        inventory_axe: inventory.axe,
        inventory_hammer: inventory.hammer,
        shield_durability: shieldDurability,
        completed_levels: safeCompleted,
        gems: gems,
        player_health: playerHealth,
        is_dead: isDead,
        total_coins_earned: totalCoinsEarned,
        total_shields_earned: totalShieldsEarned,
        max_streak: maxStreak,
        diamond_armor: hasDiamondArmor,
        inventory_codex_sword: inventory.codex_sword || 0,
        chosen_reward: chosenReward,
        pending_choice: pendingChoice,
        mission1_completed: missionsCompleted.includes(0),
        mission2_completed: missionsCompleted.includes(1),
        mission3_completed: missionsCompleted.includes(2),
        mission4_completed: missionsCompleted.includes(3),
        mission5_completed: missionsCompleted.includes(4),
        enemy_energy: enemyEnergy,
        current_problem_key: savedProblemKey,
        total_attacks: totalAttacks,
        purchased_pets: purchasedPets,
        pet_style: currentPet,
        purchased_skills: purchasedSkills
      })
      .eq('id', currentUser.id);
    if(error) throw error;
    return true;
  } catch(e) { console.error('Error guardando score:', e); return false; }
}

async function showApp(){
  document.getElementById('login-screen').style.display='none';
  document.querySelector('.app-container').style.display='flex';
  playMusic();
  if(currentUser){ try{ await loadScore(currentUser); } catch(e){ console.error(e); } }
  if(isAdmin){ showAdminDashboard(); } else { startMaestreIdle(); initGame(); startRanking(); loadHallOfFame(); initSeason(); startStudentHeartbeat(); }
}

function showLogin(){
  document.getElementById('login-screen').style.display='flex';
  document.querySelector('.app-container').style.display='none';
  const inp = document.getElementById('login-username'), img = document.getElementById('login-avatar-img');
  const ni = inp.cloneNode(true); inp.parentNode.replaceChild(ni, inp);
  document.getElementById('login-username').addEventListener('input', e => {
    clearTimeout(typingTimer);
    if(!e.target.value.trim()){ img.src="https://mikettrt-maker.github.io/divisiones-profe/img/1.png"; return; }
    typingTimer = setTimeout(() => { img.src = `https://api.dicebear.com/8.x/adventurer/svg?seed=${e.target.value.trim()}`; }, 500);
  });
}

