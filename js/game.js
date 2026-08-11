// ── Render de cartas ──────────────────────────
function renderMissionCards() {
  const container = document.getElementById('mission-cards');
  if (!container) return;
  container.innerHTML = '';
  MISSIONS.forEach(m => {
    const done = missionsCompleted.includes(m.id);
    const prog = m.progress();
    const pct  = Math.min(100, Math.round((prog.cur / prog.max) * 100));
    const wrap = document.createElement('div');
    wrap.className = 'mission-card-wrap' + (done ? ' completed' : '');
    wrap.title = m.desc;
    wrap.innerHTML = `
      <img src="${m.img}" alt="${m.title}">
      <div class="mission-progress-bar-bg">
        <div class="mission-progress-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="mission-label ${done ? 'done' : ''}">
        ${done ? '✅ ¡Completada!' : `${prog.cur}/${prog.max}`}
      </div>`;
    container.appendChild(wrap);
  });
}

// ── Verificar y otorgar misiones ──────────────
async function checkAndAwardMissions() {
  if (!currentUser || isAdmin) return;
  let newlyCompleted = false;
  const allDoneBefore = missionsCompleted.length === 5;
  for (const m of MISSIONS) {
    if (!missionsCompleted.includes(m.id) && m.check()) {
      missionsCompleted.push(m.id);
      newlyCompleted = true;
      showToast(`🃏 ¡Misión completada! "${m.title}"`, 'success', 6000);
      AudioEngine.playLevelUp();
    }
  }
  const allDoneNow = missionsCompleted.length === 5;
  if (!allDoneBefore && allDoneNow && !pendingChoice && !chosenReward) {
    pendingChoice = true;
    showToast('🎉 ¡Has completado las 5 misiones! Elige tu recompensa.', 'success', 8000);
    setTimeout(() => triggerEpicEffect(), 500);
    setTimeout(() => showRewardChoice(), 1000);
  }
  if (newlyCompleted) {
    await saveMissionProgress();
    renderMissionCards();
    updateInventoryUI();
  }
}

// ── Elección de recompensa ────────────────────
function showRewardChoice() {
  if (!pendingChoice || chosenReward) return;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:linear-gradient(180deg,#16213e,#0d1c3b);padding:30px;border-radius:16px;max-width:500px;width:95%;border:3px solid gold;box-shadow:0 0 50px rgba(201,168,76,0.6);text-align:center;">
      <h3 style="color:gold;font-family:'Cinzel Decorative',serif;font-size:1.6rem;margin:0 0 20px 0;">⚔️ ¡Elige tu Recompensa! <img src="${GITHUB}/diamante.svg" class="coin-inline"></h3>
      <p style="color:#ccc;font-family:'Cinzel',serif;font-size:0.9rem;margin-bottom:20px;">Has completado las 5 misiones. Elige una de las dos recompensas legendarias. La otra quedará bloqueada.</p>
      <div style="display:flex;justify-content:center;gap:30px;flex-wrap:wrap;">
        <div style="background:rgba(255,68,68,0.1);border:2px solid #ff4444;border-radius:12px;padding:20px;width:180px;cursor:pointer;" onclick="chooseReward('sword', this.closest('[style*=position]'))">
          <img src="https://mikettrt-maker.github.io/divisiones-profe/img/15.jpg" style="width:80px;height:110px;border-radius:8px;margin-bottom:10px;">
          <div style="color:#ff8888;font-family:'Cinzel',serif;font-weight:700;margin-bottom:5px;">Espada del Códice</div>
          <div style="color:#aaa;font-size:0.7rem;">Reduce a 0 los puntos de cualquier rival. Ignora escudos.</div>
          <button class="btn-primary" style="margin-top:10px;width:100%;background:linear-gradient(180deg,#c0392b,#7a0000);color:white;border:none;">Elegir</button>
        </div>
        <div style="background:rgba(0,212,255,0.1);border:2px solid #00d4ff;border-radius:12px;padding:20px;width:180px;cursor:pointer;" onclick="chooseReward('armor', this.closest('[style*=position]'))">
          <img src="https://mikettrt-maker.github.io/divisiones-profe/img/16.jpg" style="width:80px;height:110px;border-radius:8px;margin-bottom:10px;">
          <div style="color:#00d4ff;font-family:'Cinzel',serif;font-weight:700;margin-bottom:5px;">Armadura de Diamante</div>
          <div style="color:#aaa;font-size:0.7rem;">Protección absoluta. Ni la Espada del Códice puede dañarte.</div>
          <button class="btn-primary" style="margin-top:10px;width:100%;background:linear-gradient(180deg,#00d4ff,#0088aa);color:#000;border:none;">Elegir</button>
        </div>
      </div>
      <p style="color:#666;font-size:0.7rem;margin-top:20px;">Puedes cerrar esta ventana y decidir más tarde desde la Tienda.</p>
    </div>`;
  document.body.appendChild(modal);
}

// ── Elegir recompensa ──
async function chooseReward(type, modalElement) {
  if (type === 'sword') {
    inventory.codex_sword = (inventory.codex_sword || 0) + 1;
    chosenReward = 'sword';
    hasDiamondArmor = false;
    showToast('⚔️ ¡Has elegido la Espada del Códice!', 'success', 6000);
  } else {
    hasDiamondArmor = true;
    chosenReward = 'armor';
    inventory.codex_sword = inventory.codex_sword || 0;
    showToast('<img src="'+GITHUB+'/diamante.svg" class="coin-inline"> ¡Has elegido la Armadura de Diamante!', 'success', 6000);
  }
  pendingChoice = false;
  updateInventoryUI();
  await saveMissionProgress();
  if (modalElement) document.body.removeChild(modalElement);
}

// ── Selector de rival para Espada del Códice ──
function prepararAtaqueCodexSword() {
  if (!inventory.codex_sword || inventory.codex_sword <= 0) { showToast('No tienes la Espada del Códice', 'tomato'); return; }
  if (!rankingDataCache || rankingDataCache.length === 0) { showToast('Espera a que cargue la Corte...', 'tomato'); return; }
  const me = currentUser?.email?.split('@')[0];
  const rivals = rankingDataCache.filter(u => u.username !== me);
  if (rivals.length === 0) { showToast('No hay rivales disponibles', 'tomato'); return; }
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.88);z-index:99999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:linear-gradient(180deg,#16213e,#0d1c3b);padding:24px;border-radius:14px;max-width:420px;width:92%;border:3px solid gold;box-shadow:0 0 40px rgba(201,168,76,0.5);">
      <h3 style="color:gold;text-align:center;margin:0 0 6px 0;font-family:'Cinzel Decorative',serif;font-size:1.3rem;">⚔️ Espada del Códice</h3>
      <p style="color:#ff4444;text-align:center;font-family:'Cinzel',serif;font-size:0.8rem;margin:0 0 16px 0;">💀 Reduce a 0 los puntos del rival (ignora escudos)</p>
      <div style="max-height:300px;overflow-y:auto;">
        ${rivals.map(u => {
          const armor = u.diamond_armor ? ' <span title="Armadura de Diamante" style="color:cyan;"><img src="'+GITHUB+'/diamante.svg" class="coin-inline"></span>' : '';
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 6px;border-bottom:1px solid #2a3a5a;">
            <span style="color:#e0e0e0;font-family:'Cinzel',serif;font-size:.85rem;">${u.username}${armor} <small style="color:#888;">— ${u.total_score} pts</small></span>
            <button style="padding:5px 12px;border-radius:6px;border:none;background:linear-gradient(135deg,#c0392b,#7a0000);color:white;font-family:'Cinzel',serif;font-size:.8rem;cursor:pointer;"
              onclick="attackWithCodexSword('${u.id}','${u.username}');document.body.removeChild(this.closest('[style*=position]'));">⚔️ Atacar</button>
          </div>`;
        }).join('')}
      </div>
      <button style="margin-top:14px;width:100%;padding:9px;border-radius:8px;border:1px solid #444;background:#1a2a3a;color:#aaa;font-family:'Cinzel',serif;cursor:pointer;"
        onclick="document.body.removeChild(this.closest('[style*=position]'));">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);
}

// ── GENERADOR DE DIVISIONES ALEATORIAS ──
function generarDivision(nivel, rng) {
  let divisor, dividendo, residuoEsperado = 0, qMin, qMax, remainderChance;
  const R = rng || Math.random;
  const rand = (min, max) => Math.floor(R() * (max - min + 1)) + min;

  if (nivel <= 2) {
    divisor = rand(2, 9);
    qMin = 10; qMax = 199;
    remainderChance = 0.25;
  } else if (nivel <= 5) {
    divisor = rand(10, 99);
    qMin = 5; qMax = 99;
    remainderChance = 0.5;
  } else if (nivel <= 7) {
    divisor = rand(100, 999);
    qMin = 2; qMax = 50;
    remainderChance = 0.75;
  } else if (nivel <= 8) {
    divisor = rand(10, 99);
    qMin = 50; qMax = 500;
    remainderChance = 1;
  } else {
    divisor = rand(100, 999);
    qMin = nivel === 9 ? 10 : 20;
    qMax = nivel === 9 ? 50 : 100;
    remainderChance = 1;
  }

  if (R() < remainderChance) {
    residuoEsperado = rand(1, Math.min(9, divisor - 1));
    dividendo = divisor * rand(qMin, qMax) + residuoEsperado;
  } else {
    dividendo = divisor * rand(qMin, qMax);
  }

  return { d: dividendo, div: divisor };
}

// RNG determinista (mulberry32): misma serie para ambos duelistas con la misma semilla
function seededRand(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Toast de notificaciones ──
function showToast(msg, type='success', duration=4000) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = msg;
  c.appendChild(t);
  setTimeout(() => { if(t.parentNode) t.parentNode.removeChild(t); }, duration);
}

// ── Actualizaciones UI de monedas y salud ──
function updateCoinDisplay(){
  document.getElementById('coinDisplay').innerText = currentCoins;
  document.getElementById('gemDisplay').innerText = gems;
}

function updateHealthBar() {
  const pct = Math.max(0, playerHealth);
  document.getElementById('health-fill').style.width = pct + '%';
  document.getElementById('health-text').innerText = `${playerHealth}/100`;
  if (pct < 30) {
    document.getElementById('health-fill').style.background = 'linear-gradient(90deg, #ff1744, #d50000)';
  } else {
    document.getElementById('health-fill').style.background = 'linear-gradient(90deg, #ff1744, #e53935)';
  }
}

// ── Actualizar UI de inventario y barra rápida ──
function updateInventoryUI() {
  const bar = document.getElementById('inventory-bar');
  if (!bar) return;
  bar.innerHTML = '';
}

// ── Rachas y bonus ──
function incrementStreak() {
  currentStreak++;
  if (currentStreak > maxStreak) maxStreak = currentStreak;
  updateStreakUI();
  const bonus = STREAK_BONUSES[currentStreak];
  const petCoinMult = 1 + ((PETS[currentPet] && PETS[currentPet].coinsBonus) || 0);
  const rafagaMult = purchasedSkills.includes('rafaga_plus') ? 2 : 1;
  const bonusWithPet = bonus ? Math.round(bonus * petCoinMult * rafagaMult) : 0;
  if(currentStreak >= 2) {
    showStreakPopup(currentStreak, bonusWithPet);
    AudioEngine.playStreak();
  }
  if(bonus) {
    currentCoins += bonusWithPet;
    totalCoinsEarned += bonusWithPet;
    updateCoinDisplay();
    if (currentUser && !isAdmin) {
      _supabase.from('profiles').update({
        coins: currentCoins,
        total_coins_earned: totalCoinsEarned
      }).eq('id', currentUser.id);
      checkAndAwardMissions();
      renderMissionCards();
    }
  }
}

function resetStreak() { currentStreak = 0; updateStreakUI(); }

function updateStreakUI() {
  const d = document.getElementById('streak-display'), c = document.getElementById('streak-count'), ic = document.getElementById('streak-icon');
  c.innerText = currentStreak; d.classList.remove('active','on-fire');
  if(currentStreak>=5) { d.classList.add('on-fire'); }
  else if(currentStreak>=2) { d.classList.add('active'); }
}

function showStreakPopup(streak, bonus) {
  const el = document.createElement('div'); el.className = 'bonus-flash';
  el.innerHTML = `<img src="${GITHUB}/racha.svg" style="height:6rem;vertical-align:middle;display:block;margin:0 auto 10px;"> <span style="font-family:'Cinzel Decorative',serif;font-size:2.2rem;color:gold;text-shadow:0 0 20px rgba(255,200,0,0.8);">RACHA x${streak}</span>`+(bonus?`<br><span style="font-size:1.4rem;color:#fff;">+${bonus} <img src="${GITHUB}/florines.svg" class="coin-inline"></span>`:'');
  el.style.position = 'fixed'; el.style.top = '50%'; el.style.left = '50%';
  el.style.transform = 'translate(-50%, -60%)'; el.style.fontSize = '2rem';
  el.style.textAlign = 'center';
  el.style.color = 'gold'; el.style.textShadow = '0 0 10px black';
  el.style.zIndex = '99999';
  el.style.background = 'rgba(0,0,0,0.7)'; el.style.padding = '30px 50px'; el.style.borderRadius = '20px'; el.style.border = '3px solid gold';
  document.body.appendChild(el);
  setTimeout(() => { if(el.parentNode) el.parentNode.removeChild(el); }, 1500);
  if(bonus) showToast(`🔥 ¡Racha de ${streak}! Bonus: +${bonus} monedas`,'success');
}

// ── Avatares ──
const imgCache = {};
function getAvatarUrl(seed, styleOrObj) {
  let url;
  if (typeof styleOrObj === 'object' && styleOrObj.url) {
    url = styleOrObj.url;
  } else if (typeof styleOrObj === 'string') {
    if (VIDEO_AVATARS[styleOrObj]) return VIDEO_AVATARS[styleOrObj].img || AVATAR_STYLES_STANDARD[0].url;
    const allAvatars = [...AVATAR_STYLES_STANDARD, ...AVATAR_STYLES_EXCLUSIVE];
    const found = allAvatars.find(a => a.id === styleOrObj);
    if (found) url = found.url;
    else url = AVATAR_STYLES_STANDARD[0].url;
  } else {
    url = GITHUB+'/1.png';
  }
  if (imgCache[url]) return imgCache[url];
  imgCache[url] = url;
  return url;
}

function isVideoAvatar(id) {
  return !!VIDEO_AVATARS[id];
}

let _videoAvatarCtx = null;
function startVideoAvatar(url) {
  stopVideoAvatar();
  const container = document.getElementById('main-avatar-box');
  const img = document.getElementById('main-avatar-img');
  img.style.display = 'none';
  const video = document.createElement('video');
  video.src = url;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.crossOrigin = 'anonymous';
  video.style.display = 'none';
  container.appendChild(video);
  const canvas = document.createElement('canvas');
  canvas.width = container.offsetWidth || 200;
  canvas.height = container.offsetHeight || 200;
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;pointer-events:none;';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let renderRunning = true;
  _videoAvatarCtx = { video, canvas, ctx, renderRunning };
  video.onerror = () => { console.warn('Video avatar failed to load'); stopVideoAvatar(); };
  video.onloadeddata = () => {
    canvas.width = container.offsetWidth || 200;
    canvas.height = container.offsetHeight || 200;
    video.play().catch(e => console.warn('Video play blocked:', e.message));
  };
  function frame() {
    if (!renderRunning || !_videoAvatarCtx || _videoAvatarCtx.canvas !== canvas) return;
    if (video.readyState < 2) { requestAnimationFrame(frame); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const greeness = g - Math.max(r, b);
      const a = Math.max(0, Math.min(255, Math.round((greeness - 20) * 5)));
      d[i+3] = 255 - a;
    }
    ctx.putImageData(id, 0, 0);
    requestAnimationFrame(frame);
  }
  frame();
}
function stopVideoAvatar() {
  if (_videoAvatarCtx) {
    _videoAvatarCtx.video.pause();
    _videoAvatarCtx.video.remove();
    _videoAvatarCtx.canvas.remove();
    _videoAvatarCtx = null;
  }
  const img = document.getElementById('main-avatar-img');
  if (img) { img.style.display = 'block'; img.style.opacity = '1'; }
}

// ── Maestre del Conocimiento: personaje fijo con chroma key (fondo verde) ──
let _maestreCtx = null;
function startMaestreIdle(){
  if(_maestreCtx) return;
  const canvas = document.getElementById('maestre-icon');
  if(!canvas || !canvas.getContext) return;
  const video = document.createElement('video');
  video.src = GITHUB + '/maestre-del-conocimiento.mp4';
  video.loop = true; video.muted = true; video.playsInline = true; video.autoplay = true;
  video.crossOrigin = 'anonymous';
  video.style.display = 'none';
  document.body.appendChild(video);
  const ctx = canvas.getContext('2d');
  const W = canvas.width = 280, H = canvas.height = 280;
  _maestreCtx = { video, canvas, ctx };
  video.onerror = () => { console.warn('Video del Maestre no cargó'); stopMaestreIdle(); };
  video.onloadeddata = () => video.play().catch(e => console.warn('Play del Maestre bloqueado:', e.message));
  function frame(){
    if(!_maestreCtx || _maestreCtx.video !== video) return;
    if(video.readyState < 2){ requestAnimationFrame(frame); return; }
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(video, 0, 0, W, H);
    const id = ctx.getImageData(0,0,W,H), d = id.data;
    for(let i = 0; i < d.length; i += 4){
      const r = d[i], g = d[i+1], b = d[i+2];
      const greeness = g - Math.max(r,b);
      d[i+3] = 255 - Math.max(0, Math.min(255, Math.round((greeness - 20) * 5)));
    }
    ctx.putImageData(id, 0, 0);
    requestAnimationFrame(frame);
  }
  frame();
}
function stopMaestreIdle(){
  if(_maestreCtx){
    try{ _maestreCtx.video.pause(); }catch(e){}
    _maestreCtx.video.remove();
    _maestreCtx = null;
  }
}

// ── Click en el Maestre: revela la historia del guardián actual ──
async function handleMaestreClick(){
  if(!currentUser){ showToast('Primero inicia sesión, aprendiz','info'); return; }
  openEnemyLore();
}

// ── Historia del Guardián (contexto del enemigo) ──
function openEnemyLore(){
  const enemy = ENEMIES[currentEnemyLevel] || ENEMIES[1];
  const modal = document.getElementById('enemy-lore-modal');
  document.getElementById('enemy-lore-img').src = enemy.jpg;
  document.getElementById('enemy-lore-name').innerText = enemy.name;
  document.getElementById('enemy-lore-story').innerText = enemy.story || 'Su historia se perdió en las páginas del Códice.';
  modal.style.display = 'flex';
  AudioEngine.playClick();
  playEnemyNarration(currentEnemyLevel);
}
function closeEnemyLore(){
  document.getElementById('enemy-lore-modal').style.display = 'none';
  stopEnemyNarration();
}

// ── Narraciones del Maestre (voces grabadas) ──
// Cada enemigo tiene su audio en img/narraciones/<nivel>.mp3
// Si el audio aún no se graba, se ignora en silencio.
let _narrationAudio = null;
function playEnemyNarration(level){
  stopEnemyNarration();
  if(!musicEnabled) return;
  const a = new Audio(GITHUB + '/narraciones/' + (level||1) + '.mp3');
  a.volume = 0.9;
  a.onerror = () => { _narrationAudio = null; };
  a.play().catch(() => { _narrationAudio = null; });
  _narrationAudio = a;
}
function stopEnemyNarration(){
  if(_narrationAudio){
    try{ _narrationAudio.pause(); _narrationAudio = null; }catch(e){ _narrationAudio = null; }
  }
}

function renderMainAvatar() {
  if(!currentUser) return;
  if (VIDEO_AVATARS[currentAvatarStyle]) {
    const info = VIDEO_AVATARS[currentAvatarStyle];
    stopVideoAvatar();
    stopAvatarDustLoop();
    const img = document.getElementById('main-avatar-img');
    img.style.display = 'none';
    startVideoAvatar(GITHUB+'/'+info.file);
    if(userSquadId && SQUADS[userSquadId]) {
      document.getElementById('squad-badge-overlay').innerHTML = SQUADS[userSquadId].svg;
      document.getElementById('squad-badge-overlay').style.display = 'flex';
    } else {
      document.getElementById('squad-badge-overlay').style.display = 'none';
    }
    setTimeout(() => startAvatarDustLoop(), 3000);
    renderPetAvatar();
    renderSkillOrbs();
    return;
  }
  const allAvatars = [...AVATAR_STYLES_STANDARD, ...AVATAR_STYLES_EXCLUSIVE];
  const found = allAvatars.find(a => a.id === currentAvatarStyle);
  const avatarUrl = found ? found.url : getAvatarUrl(currentUser.email.split('@')[0], currentAvatarStyle);
  const img = document.getElementById('main-avatar-img');
  stopVideoAvatar();
  if (found && found.video) {
    startVideoAvatar(avatarUrl);
    const rankInfo = getRankInfo(totalScore);
    if(userSquadId && SQUADS[userSquadId]) {
      document.getElementById('squad-badge-overlay').innerHTML = SQUADS[userSquadId].svg;
      document.getElementById('squad-badge-overlay').style.display = 'flex';
    } else {
      document.getElementById('squad-badge-overlay').style.display = 'none';
    }
    stopAvatarDustLoop();
    renderSkillOrbs();
    return;
  }
  img.crossOrigin = 'anonymous';
  img.src = avatarUrl;
  const rankInfo = getRankInfo(totalScore);
  if(userSquadId && SQUADS[userSquadId]) {
    document.getElementById('squad-badge-overlay').innerHTML = SQUADS[userSquadId].svg;
    document.getElementById('squad-badge-overlay').style.display = 'flex';
  } else {
    document.getElementById('squad-badge-overlay').style.display = 'none';
  }
  stopAvatarDustLoop();
  img.onload = () => { startAvatarDustLoop(); };
  if(img.complete && img.naturalWidth) startAvatarDustLoop();
  renderPetAvatar();
  renderSkillOrbs();
}

function renderPetAvatar() {
  const petContainer = document.getElementById('pet-avatar-display');
  if (!petContainer) return;
  if (currentPet === 'none' || !PETS[currentPet]) {
    petContainer.innerHTML = '';
    return;
  }
  const info = PETS[currentPet];
  petContainer.innerHTML = `<img src="${GITHUB}/${info.file}" class="pet-avatar-img" title="${info.name}">`;
}

function triggerDustEffect() {
  const canvas = document.createElement('canvas');
  canvas.id = 'dust-canvas-overlay';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;pointer-events:none;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const texCanvas = document.createElement('canvas');
  texCanvas.width = canvas.width;
  texCanvas.height = canvas.height;
  const tex = texCanvas.getContext('2d');

  tex.fillStyle = '#d4b483';
  tex.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = Math.random();
    if (r < 0.4) tex.fillStyle = 'rgba(0,0,0,0.05)';
    else if (r < 0.7) tex.fillStyle = 'rgba(255,235,200,0.04)';
    else tex.fillStyle = 'rgba(180,140,90,0.06)';
    tex.fillRect(x, y, 1 + Math.random()*2, 1 + Math.random()*2);
  }
  for (let x = 0; x < canvas.width; x += 4) {
    const v = Math.random() * 25 - 12;
    tex.fillStyle = `rgba(0,0,0,${Math.abs(v)/180})`;
    tex.fillRect(x, 0, 2, canvas.height);
  }

  let start = null;
  const duration = 3200;
  let scrollY = 0;

  function animate(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    const progress = Math.min(1, elapsed / duration);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lineY = progress * canvas.height * 1.3;
    scrollY = (scrollY + 2.5 + progress * 4) % canvas.height;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, lineY, canvas.width, canvas.height - lineY);
    ctx.clip();

    const sh = canvas.height - scrollY;
    ctx.drawImage(texCanvas, 0, scrollY, canvas.width, sh, 0, 0, canvas.width, sh);
    ctx.drawImage(texCanvas, 0, 0, canvas.width, scrollY, 0, sh, canvas.width, scrollY);
    ctx.restore();

    if (progress > 0.65) {
      ctx.globalAlpha = (progress - 0.65) / 0.35;
      ctx.fillStyle = '#0d1c3b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(animate);
}

function renderSkillOrbs() {
  const container = document.getElementById('skill-orb-container');
  if (!container) return;
  const owned = purchasedSkills.filter(id => SKILLS[id] && (id !== 'escudos_30' || shieldDurability > 0));
  if (owned.length === 0) { container.innerHTML = ''; return; }
  const total = owned.length;
  container.innerHTML = owned.map((id, i) => {
    const info = SKILLS[id];
    return `<div class="skill-orb-img" title="${info.name}" style="width:40px;height:40px;border-radius:50%;overflow:hidden;position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><img src="${GITHUB}/${info.file}" style="width:100%;height:100%;object-fit:contain;display:block;border-radius:50%;"></div>`;
  }).join('');
}

function renderRankProgress(){
  const el = document.getElementById('rankProgressBar');
  if(!el) return;
  const MAX_PTS = 20000;
  const pct = Math.min(100, totalScore / MAX_PTS * 100);
  let markersHtml = '';
  RANKS.forEach((r,i) => {
    const pos = i === 0 ? 1.5 : Math.min(98.5, r.min / MAX_PTS * 100);
    const reached = totalScore >= r.max;
    const isCurrent = !reached && totalScore >= r.min;
    const cls = reached ? 'reached' : isCurrent ? 'current' : 'locked';
    markersHtml += '<div class="rank-bar-marker ' + cls + '" style="left:' + pos + '%" title="' + r.name + ' (' + r.min + '-' + r.max + ' pts)">' + r.icon + '</div>';
  });
  el.innerHTML = '<div class="rank-bar-markers">' + markersHtml + '</div><div class="rank-bar-track"><div class="rank-bar-fill" style="width:' + pct + '%"></div></div><div class="rank-bar-label"><span id="scoreDisplay">' + totalScore + '</span> pts &mdash; ' + getRankInfo(totalScore).name + '</div>';

  const bigScore = document.getElementById('score-big-display');
  if(bigScore) bigScore.innerHTML = '<span class="score-big-val">'+totalScore+'</span><span class="score-big-label">Puntos Merovingios</span>';

  // ── Destello breve al renderizar (efecto de "subida de puntos") ──
  const fill = el.querySelector('.rank-bar-fill');
  if (fill) {
    fill.classList.remove('pulse');
    void fill.offsetWidth; // fuerza el reflow para reiniciar la animación
    fill.classList.add('pulse');
  }
}

// ── Tienda ──
function openShop(){
  stopChromaPreviews();
  document.getElementById('shop-modal').style.display='flex';
  document.getElementById('shop-coins-val').innerText = currentCoins;
  const container = document.getElementById('shop-items');
  container.innerHTML = '';
  const weaponsHeader = document.createElement('div');
  weaponsHeader.className = 'shop-section-header';
  weaponsHeader.innerHTML = '<span style="margin-right:8px;">⚔️</span> Arsenal de Guerra';
  container.appendChild(weaponsHeader);
  Object.entries(WEAPONS).forEach(([key, weapon]) => {
    const div = document.createElement('div');
    div.className = 'shop-item orange';
    div.innerHTML = `<span class="shop-item-icon">${weapon.icon}</span><div class="shop-item-name">${weapon.name}</div><div class="shop-item-desc">${weapon.desc} (-${weapon.damage} pts, -${weapon.shieldDmg} 🛡️)</div><div class="shop-item-price"><img src="${GITHUB}/florines.svg" class="coin-inline"> ${weapon.price}</div><div class="shop-qty-badge">x${inventory[key]}</div><button class="shop-buy-btn orange-btn" onclick="buyWeapon('${key}', ${weapon.price})">Adquirir</button>`;
    container.appendChild(div);
  });
  const shieldDiv = document.createElement('div');
  shieldDiv.className = 'shop-item';
  shieldDiv.innerHTML = `<span class="shop-item-icon"><span class="weapon-icon"><img src="${GITHUB}/escudo.svg" style="width:100%;height:100%;display:block;"></span></span><div class="shop-item-name">Protección del Consejo</div><div class="shop-item-desc">Resiste 5 ataques</div><div class="shop-item-price"><img src="${GITHUB}/florines.svg" class="coin-inline"> 300</div><button class="shop-buy-btn" onclick="buyShield(5, 300)">Adquirir</button>`;
  container.appendChild(shieldDiv);

  const plantDiv = document.createElement('div');
  plantDiv.className = 'shop-item';
  plantDiv.innerHTML = `<span class="shop-item-icon"><span class="weapon-icon"><img src="${GITHUB}/planta%20curativa.svg" style="width:100%;height:100%;display:block;"></span></span><div class="shop-item-name">Planta Curativa</div><div class="shop-item-desc">Restaura 30 puntos de salud</div><div class="shop-item-price"><img src="${GITHUB}/florines.svg" class="coin-inline"> 300</div><button class="shop-buy-btn" onclick="buyHealingPlant()">Comprar</button>`;
  container.appendChild(plantDiv);

  const gemDiv = document.createElement('div');
  gemDiv.className = 'shop-item';
  gemDiv.innerHTML = `<span class="shop-item-icon"><img src="${GITHUB}/diamante.svg" class="coin-inline"></span><div class="shop-item-name">Gema del Reino</div><div class="shop-item-desc">Obtén 1 gema para abrir cofres</div><div class="shop-item-price"><img src="${GITHUB}/florines.svg" class="coin-inline"> 500</div><button class="shop-buy-btn" onclick="buyGem()">Comprar</button>`;
  container.appendChild(gemDiv);

  if (pendingChoice && !chosenReward) {
    const choiceDiv = document.createElement('div');
    choiceDiv.style.cssText = 'grid-column:1/-1;text-align:center;padding:20px;background:rgba(201,168,76,0.1);border:2px dashed gold;border-radius:12px;margin-top:10px;';
    choiceDiv.innerHTML = `
      <h3 style="color:gold;font-family:'Cinzel Decorative',serif;">🎉 ¡Recompensa Legendaria Disponible!</h3>
      <p style="color:#ccc;">Has completado las 5 misiones. Elige tu premio.</p>
      <button class="btn-primary" style="margin-top:10px;background:linear-gradient(180deg,gold,#b8860b);color:#000;" onclick="closeShop();showRewardChoice();">⚔️<img src="${GITHUB}/diamante.svg" class="coin-inline"> Elegir Recompensa</button>
    `;
    container.appendChild(choiceDiv);
  }

  const chestDiv = document.createElement('div');
  chestDiv.className = 'shop-item chest-item';
  chestDiv.innerHTML = `<span class="shop-item-icon"><span class="weapon-icon"><img src="${GITHUB}/cofre.svg" style="width:100%;height:100%;display:block;"></span></span><div class="shop-item-name">Cofre Misterioso</div><div class="shop-item-desc">Abre un cofre legendario. ¡Premios aleatorios!</div><div class="shop-item-price"><img src="${GITHUB}/diamante.svg" class="coin-inline"> 1</div><button class="shop-buy-btn chest-btn" onclick="openMysteryChest()">Abrir</button>`;
  container.appendChild(chestDiv);

  // Banners section
  Object.entries(BANNERS).forEach(([id, info]) => {
    if(info.free) return;
    const owned = purchasedBanners.includes(id);
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.style.cssText = 'border-top:4px solid var(--cr-gold-dark);';
    const imgSrc = GITHUB+'/'+info.file;
    div.innerHTML = '<div style="width:100%;height:60px;margin:0 auto 8px;overflow:hidden;border-radius:8px;border:1px solid rgba(201,168,76,0.2);background:rgba(10,22,40,0.5);"><img src="'+imgSrc+'" style="width:100%;height:100%;object-fit:cover;display:block;"></div><div class="shop-item-name">'+info.name+'</div><div class="shop-item-desc">Fondo decorativo para tu carta en el ranking</div><div class="shop-item-price"><img src="'+GITHUB+'/florines.svg" class="coin-inline"> '+info.price+'</div><button class="shop-buy-btn orange-btn" onclick="buyBanner(\''+id+'\','+info.price+')" '+(owned?'disabled':'')+'>'+(owned?'Comprado':'Adquirir')+'</button>';
    container.appendChild(div);
  });

  Object.entries(VIDEO_AVATARS).forEach(([id, info]) => {
    const owned = purchasedAvatars.includes(id);
    const div = document.createElement('div');
    div.className = 'shop-item orange';
    const previewWrap = document.createElement('div');
    previewWrap.style.cssText = 'position:relative;width:100px;height:100px;margin:0 auto 8px;overflow:hidden;border-radius:8px;';
    div.innerHTML = `<div class="shop-item-name">${info.name} — Efigie Legendaria</div><div class="shop-item-desc">Personaje animado exclusivo con efectos de viento</div><div class="shop-item-price"><img src="${GITHUB}/florines.svg" class="coin-inline"> ${info.price}</div><button class="shop-buy-btn orange-btn" onclick="buyAvatar('${id}', ${info.price})" ${owned?'disabled':''}>${owned?'Comprado':'Despertar'}</button>`;
    div.insertBefore(previewWrap, div.firstChild);
    container.appendChild(div);
    initChromaPreview(previewWrap, 100, 100, info.file);
  });

  // ── Mascotas ──
  Object.entries(PETS).forEach(([id, info]) => {
    const owned = purchasedPets.includes(id);
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `<span class="shop-item-icon"><img src="${GITHUB}/${info.file}" style="width:60px;height:60px;object-fit:contain;"></span><div class="shop-item-name">${info.name}</div><div class="shop-item-desc">${info.desc}</div><div class="shop-item-price"><img src="${GITHUB}/florines.svg" class="coin-inline"> ${info.price}</div><button class="shop-buy-btn orange-btn" onclick="buyPet('${id}', ${info.price})" ${owned?'disabled':''}>${owned?'Comprado':'Adoptar'}</button>`;
    container.appendChild(div);
  });

  // ── Habilidades Legendarias ──
  Object.entries(SKILLS).forEach(([id, info]) => {
    const owned = purchasedSkills.includes(id);
    const div = document.createElement('div');
    div.className = 'shop-item';
    const orbHtml = `<span class="shop-item-icon"><img src="${GITHUB}/${info.file}" style="width:60px;height:60px;object-fit:contain;display:block;margin:0 auto;"></span>`;
    div.innerHTML = `${orbHtml}<div class="shop-item-name">${info.name}</div><div class="shop-item-desc">${info.desc}</div><div class="shop-item-price"><img src="${GITHUB}/florines.svg" class="coin-inline"> ${info.price}</div><button class="shop-buy-btn orange-btn" onclick="buySkill('${id}', ${info.price})" ${owned?'disabled':''}>${owned?'Comprado':'Adquirir'}</button>`;
    container.appendChild(div);
  });
}

function closeShop(){ 
  document.getElementById('shop-modal').style.display='none';
  stopChromaPreviews();
}

function openInventory(){
  document.getElementById('inventory-modal').style.display='flex';
  renderInventory();
}
function closeInventory(){
  document.getElementById('inventory-modal').style.display='none';
}
function selectFromInventory(type, id){
  if(type==='avatar'){
    currentAvatarStyle = id;
    if(VIDEO_AVATARS[id]) renderMainAvatar();
    _supabase.from('profiles').update({ avatar_style: id }).eq('id', currentUser.id).then(() => updateRanking());
  } else if(type==='banner'){
    currentBanner = id;
    _supabase.from('profiles').update({ banner_style: id }).eq('id', currentUser.id).then(() => updateRanking());
  } else if(type==='pet'){
    currentPet = id;
    _supabase.from('profiles').update({ pet_style: id }).eq('id', currentUser.id).then(() => updateRanking());
    renderPetAvatar();
  }
  renderInventory();
  showToast('✔ '+(type==='avatar'?'Efigie':type==='banner'?'Estandarte':'Mascota')+' cambiado','info');
}
function renderInventory(){
  const container = document.getElementById('inv-items');
  let html = '';

  // Coins
  html += '<div class="inv-coins-row"><span style="font-family:\'Cinzel\',serif;color:#ccc;font-size:.9rem;"><img src="'+GITHUB+'/florines.svg" class="coin-inline"> Florines</span><span class="inv-coins-val">'+currentCoins+'</span></div>';

  // Weapons
  const weaponNames = { dagger:'Daga del Cuervo', sword:'Espada del Rey', bow:'Arco del Cazador', axe:'Hacha del Verdugo', hammer:'Martillo del Creador' };
  const weaponIcons = { dagger:'<img src="'+GITHUB+'/daga.svg" style="height:2rem;width:auto;vertical-align:middle;">', sword:'<img src="'+GITHUB+'/espada.svg" style="height:2rem;width:auto;vertical-align:middle;">', bow:'<img src="'+GITHUB+'/arco.svg" style="height:2rem;width:auto;vertical-align:middle;">', axe:'<img src="'+GITHUB+'/hacha.svg" style="height:2rem;width:auto;vertical-align:middle;">', hammer:'<img src="'+GITHUB+'/martillo.svg" style="height:2rem;width:auto;vertical-align:middle;">' };
  const weaponDamage = { dagger:100, sword:250, bow:400, axe:600, hammer:900 };
  const hasWeapons = Object.values(inventory).some(v=>v>0);
  if(hasWeapons){
    html += '<div class="inv-category">⚔️ Arsenal — Click para atacar</div>';
    Object.entries(inventory).forEach(([key,qty])=>{
      if(qty>0) {
        const dmg = weaponDamage[key] || 100;
        html += '<div class="inv-row inv-row-weapon" onclick="showItemInfo(\'weapon\',\''+key+'\')"><div class="inv-row-left"><span class="inv-row-icon">'+weaponIcons[key]+'</span><span class="inv-row-name">'+weaponNames[key]+'</span></div><div style="display:flex;align-items:center;gap:8px;"><span class="inv-row-dmg">-'+dmg+' pts</span><span class="inv-row-qty">x'+qty+'</span></div></div>';
      }
    });
  }

  // Shield
  if(shieldDurability>0){
    html += '<div class="inv-category">🛡️ Protección</div>';
    html += '<div class="inv-row"><div class="inv-row-left"><span class="inv-row-icon"><img src="'+GITHUB+'/escudo.svg" style="height:2.2rem;width:auto;vertical-align:middle;display:inline-block;"></span><span class="inv-row-name">Protección del Consejo</span></div><span class="inv-row-qty">'+shieldDurability+' usos</span></div>';
  }

  // Gems
  if(gems>0){
    html += '<div class="inv-category"><img src="'+GITHUB+'/diamante.svg" class="coin-inline"> Gemas</div>';
    html += '<div class="inv-row"><div class="inv-row-left"><span class="inv-row-icon"><img src="'+GITHUB+'/diamante.svg" class="coin-inline"></span><span class="inv-row-name">Gemas del Reino</span></div><span class="inv-row-qty">x'+gems+'</span></div>';
  }

  // Purchased avatars
  const ownedVids = purchasedAvatars.filter(id=>VIDEO_AVATARS[id]);
  if(ownedVids.length>0){
    html += '<div class="inv-category">🎭 Efigies Legendarias</div><div style="display:flex;flex-wrap:wrap;gap:8px;">';
    ownedVids.forEach(id=>{
      const info = VIDEO_AVATARS[id];
      html += '<div class="inv-item-card'+(currentAvatarStyle===id?' inv-item-active':'')+'" onclick="selectFromInventory(\'avatar\',\''+id+'\')"><img src="'+info.img+'" class="inv-preview-img"><div class="inv-item-name">'+info.name+'</div>'+(currentAvatarStyle===id?'<div class="inv-item-badge">✔</div>':'')+'</div>';
    });
    html += '</div>';
  }

  // Purchased banners
  const ownedBanners = purchasedBanners.filter(id=>BANNERS[id]);
  if(ownedBanners.length>0){
    html += '<div class="inv-category">🏴 Estandartes</div><div style="display:flex;flex-wrap:wrap;gap:8px;">';
    ownedBanners.forEach(id=>{
      const info = BANNERS[id];
      html += '<div class="inv-item-card inv-banner-card'+(currentBanner===id?' inv-item-active':'')+'" onclick="selectFromInventory(\'banner\',\''+id+'\')"><img src="'+GITHUB+'/'+info.file+'" class="inv-preview-banner"><div class="inv-item-name">'+info.name+'</div>'+(currentBanner===id?'<div class="inv-item-badge">✔</div>':'')+'</div>';
    });
    html += '</div>';
  }

  // Purchased pets
  const ownedPets = purchasedPets.filter(id=>PETS[id]);
  if(ownedPets.length>0){
    html += '<div class="inv-category">🐾 Mascotas</div><div style="display:flex;flex-wrap:wrap;gap:8px;">';
    ownedPets.forEach(id=>{
      const info = PETS[id];
      html += '<div class="inv-item-card'+(currentPet===id?' inv-item-active':'')+'" onclick="showItemInfo(\'pet\',\''+id+'\')"><img src="'+GITHUB+'/'+info.file+'" style="width:60px;height:60px;object-fit:contain;display:block;margin:0 auto;"><div class="inv-item-name">'+info.name+'</div>'+(currentPet===id?'<div class="inv-item-badge">✔</div>':'')+'</div>';
    });
    html += '</div>';
  }

  if(!html){
    html = '<div class="inv-row-empty">Aún no posees nada, forjador de leyendas.</div>';
  }

  container.innerHTML = html;
}

const itemLore = {
  dagger:{lore:'Forjada en las sombras del Códice, esta daga perteneció al Cuervo Merovingio, un guardián que atacaba desde la oscuridad. Su hoja absorbe la esencia del enemigo.'},
  sword:{lore:'La espada del Rey Olvidado, tallada en acero estelar. Quien la empuña siente el peso de un reino perdido y la furia de sus ancestros.'},
  bow:{lore:'El arco del Cazador Eterno, capaz de disparar flechas de luz. Fue usado por la guardia real para proteger los secretos del Códice.'},
  axe:{lore:'El hacha del Verdugo de Merovia, temida por sus enemigos. Cada golpe resuena como el eco de una ejecución ancestral.'},
  hammer:{lore:'El martillo con que los antiguos forjaron las páginas del Códice. Su peso contiene la fuerza de mil soles.'},
  perro:{lore:'Fiel compañero de los merovingios, este perro guardián olfatea las monedas escondidas en las ruinas del código.'},
  oso:{lore:'El Oso de los Bosques de Merovia, imbuido con la fuerza de la tierra. Su rugido otorga sabiduría ancestral.'},
  lobo:{lore:'El Lobo de las Sombras, guía espiritual de los grandes maestros. Su aullido canaliza tanto monedas como sabiduría.'}
};
function showItemInfo(type, id){
  const modal = document.getElementById('item-info-modal');
  const title = document.getElementById('item-info-title');
  const body = document.getElementById('item-info-body');
  const lore = itemLore[id]?.lore || '';
  let html = '';
  if(type === 'weapon'){
    const w = WEAPONS[id];
    const wNames = { dagger:'Daga del Cuervo', sword:'Espada del Rey', bow:'Arco del Cazador', axe:'Hacha del Verdugo', hammer:'Martillo del Creador' };
    const wIcons = { dagger:'<img src="'+GITHUB+'/daga.svg" style="height:100px;width:auto;">', sword:'<img src="'+GITHUB+'/espada.svg" style="height:100px;width:auto;">', bow:'<img src="'+GITHUB+'/arco.svg" style="height:100px;width:auto;">', axe:'<img src="'+GITHUB+'/hacha.svg" style="height:100px;width:auto;">', hammer:'<img src="'+GITHUB+'/martillo.svg" style="height:100px;width:auto;">' };
    const dmgMap = { dagger:100, sword:250, bow:400, axe:600, hammer:900 };
    const qty = inventory[id] || 0;
    title.textContent = wNames[id] || id;
    html += '<div class="item-info-icon">'+wIcons[id]+'</div>';
    html += '<div class="item-info-stats"><div class="item-info-stat"><div class="item-info-stat-label">Daño</div><div class="item-info-stat-val" style="color:#ff6b6b;">-'+dmgMap[id]+' pts</div></div><div class="item-info-stat"><div class="item-info-stat-label">Cantidad</div><div class="item-info-stat-val">x'+qty+'</div></div></div>';
    html += '<div class="item-info-desc">"'+lore+'"</div>';
    if(qty > 0){
      html += '<button class="item-info-action" onclick="closeItemInfo();prepararAtaque(\''+id+'\')">⚔️ Atacar</button>';
    }
  } else if(type === 'pet'){
    const p = PETS[id];
    if(!p) return;
    title.textContent = p.name;
    html += '<div class="item-info-icon"><img src="'+GITHUB+'/'+p.file+'" style="height:100px;width:auto;object-fit:contain;"></div>';
    html += '<div class="item-info-stats">';
    if(p.coinsBonus > 0) html += '<div class="item-info-stat"><div class="item-info-stat-label">Monedas</div><div class="item-info-stat-val" style="color:var(--cr-gold);">+'+Math.round(p.coinsBonus*100)+'%</div></div>';
    if(p.pointsBonus > 0) html += '<div class="item-info-stat"><div class="item-info-stat-label">Puntos</div><div class="item-info-stat-val" style="color:#66d9ff;">+'+Math.round(p.pointsBonus*100)+'%</div></div>';
    html += '</div>';
    html += '<div class="item-info-desc">"'+lore+'"</div>';
    const active = currentPet === id;
    html += '<button class="item-info-action" onclick="closeItemInfo();selectFromInventory(\'pet\',\''+id+'\')">'+(active ? '✔ Equipado' : '🐾 Equipar')+'</button>';
  }
  body.innerHTML = html;
  modal.style.display = 'flex';
}
function closeItemInfo(){
  document.getElementById('item-info-modal').style.display = 'none';
}
let feedbackTimer = null;
function showFeedbackOverlay(type, htmlContent){
  if(feedbackTimer) clearTimeout(feedbackTimer);
  const overlay = document.getElementById('feedback-overlay');
  const content = document.getElementById('feedback-content');
  content.className = 'feedback-content ' + (type === 'correct' ? 'correct' : 'incorrect');
  content.innerHTML = htmlContent;
  overlay.style.display = 'flex';
  feedbackTimer = setTimeout(() => { overlay.style.display = 'none'; feedbackTimer = null; }, 2000);
}
const _chromaPreviews = new Set();
function initChromaPreview(container, w, h, file) {
  const video = document.createElement('video');
  video.src = GITHUB+'/'+file;
  video.loop = true; video.muted = true; video.playsInline = true; video.autoplay = true;
  video.crossOrigin = 'anonymous';
  video.style.display = 'none';
  container.appendChild(video);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  container.appendChild(canvas);
  container.className = 'chroma-preview';
  const ctx = canvas.getContext('2d');
  video.onloadeddata = () => video.play().catch(() => {});
  let running = true;
  _chromaPreviews.add(container);
  container._stopPreview = () => {
    if (!running) return;
    running = false; _chromaPreviews.delete(container);
    video.pause(); video.remove(); canvas.remove();
  };
  function frame() {
    if (!running) return;
    if (video.readyState < 2) { requestAnimationFrame(frame); return; }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(video, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const greeness = g - Math.max(r, b);
      const a = Math.max(0, Math.min(255, Math.round((greeness - 20) * 5)));
      d[i+3] = 255 - a;
    }
    ctx.putImageData(id, 0, 0);
    requestAnimationFrame(frame);
  }
  frame();
}
function stopChromaPreviews() {
  _chromaPreviews.forEach(el => { if (el._stopPreview) el._stopPreview(); });
}

async function buyAvatar(id, price) {
  const info = VIDEO_AVATARS[id];
  if (!info) return;
  if(currentCoins < price) return showToast(`❌ Necesitas ${price} florines`,'tomato');
  if(!confirm(`¿Despertar a ${info.name} por ${price} florines?`)) return;
  currentCoins -= price;
  purchasedAvatars.push(id);
  currentAvatarStyle = id;
  try {
    const { error } = await _supabase.from('profiles').update({
      coins: currentCoins, purchased_avatars: purchasedAvatars
    }).eq('id', currentUser.id);
    if(error) throw error;
    _supabase.from('profiles').update({ avatar_style: id }).eq('id', currentUser.id)
      .then(r2 => { if(r2.error) console.warn('avatar_style not saved:', r2.error); });
    updateRanking();
  } catch(e) {
    console.error('Error saving purchase:', e);
    showToast('❌ Error al guardar: '+e.message,'tomato');
  }
  updateCoinDisplay();
  renderAvatarOptions();
  renderMainAvatar();
  openShop();
  AudioEngine.playShop();
  showToast(`⚔️ ¡${info.name} ha despertado en tu efigie!`,'success');
}

async function buyBanner(id, price) {
  const info = BANNERS[id];
  if(!info || info.free) return;
  if(currentCoins < price) return showToast(`❌ Necesitas ${price} florines`,'tomato');
  if(!confirm(`¿Adquirir ${info.name} por ${price} florines?`)) return;
  currentCoins -= price;
  purchasedBanners.push(id);
  currentBanner = id;
  updateCoinDisplay();
  openShop();
  AudioEngine.playShop();
  try {
    await _supabase.from('profiles').update({ coins: currentCoins, purchased_banners: purchasedBanners, banner_style: id }).eq('id', currentUser.id);
    updateRanking();
  } catch(e) { console.error('Error saving banner:', e); }
  showToast(`🏴 ${info.name} desplegado!`,'success');
}

async function buyPet(id, price) {
  const info = PETS[id];
  if(!info) return;
  if(currentCoins < price) return showToast(`❌ Necesitas ${price} florines`,'tomato');
  if(!confirm(`¿Adoptar ${info.name} por ${price} florines?`)) return;
  currentCoins -= price;
  purchasedPets.push(id);
  currentPet = id;
  updateCoinDisplay();
  openShop();
  renderPetAvatar();
  AudioEngine.playShop();
  try {
    await _supabase.from('profiles').update({ coins: currentCoins, purchased_pets: purchasedPets, pet_style: id }).eq('id', currentUser.id);
  } catch(e) { console.error('Error saving pet:', e); }
  showToast(`🐾 ¡${info.name} te acompaña!`,'success');
}

async function buySkill(id, price) {
  const info = SKILLS[id];
  if(!info) return;
  if(currentCoins < price) return showToast(`❌ Necesitas ${price} florines`,'tomato');
  if(!confirm(`¿Adquirir ${info.name} por ${price} florines?`)) return;
  currentCoins -= price;
  purchasedSkills.push(id);
  updateCoinDisplay();
  openShop();
  AudioEngine.playShop();
  if(id==='escudos_30') { shieldDurability += 30; totalShieldsEarned += 30; updateInventoryUI(); }
  renderSkillOrbs();
  try {
    await _supabase.from('profiles').update({ coins: currentCoins, purchased_skills: purchasedSkills, shield_durability: shieldDurability, total_shields_earned: totalShieldsEarned }).eq('id', currentUser.id);
  } catch(e) { console.error('Error saving skill:', e); }
  showToast(`✨ ¡${info.name} adquirida!`,'success');
}

function buyWeapon(type, price) {
  if(currentCoins < price) return showToast(`❌ Necesitas ${price} florines`,'tomato');
  if(!confirm(`¿Adquirir ${WEAPONS[type].name} por ${price} florines?`)) return;
  currentCoins -= price; inventory[type]++;
  updateCoinDisplay(); updateInventoryUI(); openShop();
  AudioEngine.playShop();
  showToast(`✅ ${WEAPONS[type].icon} ${WEAPONS[type].name} añadido a tu arsenal!`,'success');
  _supabase.from('profiles').update({ coins: currentCoins, [`inventory_${type}`]: inventory[type] })
    .eq('id', currentUser.id)
    .then(res => { if(res.error) { console.error("Error guardando monedas en compra", res.error); showToast("Error al guardar compra", 'tomato'); } });
  saveInventory();
}

async function buyShield(qty, price) {
  if(currentCoins < price) return showToast(`❌ Necesitas ${price} florines`,'tomato');
  if(!confirm(`¿Comprar Protección del Consejo (${qty} usos) por ${price} florines?`)) return;
  try {
    currentCoins -= price;
    shieldDurability += qty;
    totalShieldsEarned += qty;
    await saveScore();

    const { error } = await _supabase.from('profiles').update({
      coins: currentCoins,
      shield_durability: shieldDurability
    }).eq('id', currentUser.id);
    if (error) throw error;

    checkAndAwardMissions();
    renderMissionCards();
    await saveMissionProgress();

    updateCoinDisplay();
    updateInventoryUI();
    openShop();
    AudioEngine.playShop();
    showToast(`✅ 🛡️ Protección adquirida! Tienes ${shieldDurability} usos`,'success');
  } catch(e) {
    currentCoins += price;
    shieldDurability -= qty;
    totalShieldsEarned -= qty;
    showToast(`❌ Error: ${e.message}`,'tomato');
  }
}

async function buyHealingPlant() {
  const cost = 300;
  if (currentCoins < cost) return showToast('Necesitas 300 monedas', 'tomato');
  if (playerHealth >= 100) return showToast('Tu salud ya está al máximo', 'tomato');
  if (!confirm('¿Comprar una planta curativa por 300 monedas?')) return;
  currentCoins -= cost;
  playerHealth = Math.min(100, playerHealth + 30);
  updateCoinDisplay();
  updateHealthBar();
  const { error } = await _supabase.from('profiles').update({
    coins: currentCoins,
    player_health: playerHealth
  }).eq('id', currentUser.id);
  if (error) {
    const oldHealth = playerHealth;
    currentCoins += cost;
    playerHealth = oldHealth;
    updateCoinDisplay();
    updateHealthBar();
    showToast('❌ Error al guardar la compra', 'tomato');
    console.error("Error en buyHealingPlant:", error);
    return;
  }
  updateRanking();
  showToast('🌿 ¡Salud restaurada! +30', 'success');
}

async function buyGem() {
  const cost = 500;
  if (currentCoins < cost) return showToast('Necesitas 500 monedas', 'tomato');
  if (!confirm('¿Comprar 1 gema por 500 monedas?')) return;
  const prevCoins = currentCoins, prevGems = gems;
  currentCoins -= cost;
  gems += 1;
  updateCoinDisplay();
  const { error } = await _supabase.from('profiles').update({
    coins: currentCoins,
    gems: gems
  }).eq('id', currentUser.id);
  if (error) {
    currentCoins = prevCoins;
    gems = prevGems;
    updateCoinDisplay();
    showToast('❌ Error al comprar gema', 'tomato');
    console.error(error);
  } else {
    showToast('<img src="'+GITHUB+'/diamante.svg" class="coin-inline"> ¡Has comprado 1 gema!', 'success');
  }
}

// ── Render de la lista de ranking ──
function renderFullRanking(data) {
  const list = document.getElementById('ranking-list');
  const me = currentUser?.email?.split('@')[0];
  list.innerHTML = data.map((u,i)=>{
    const s = u.total_score||0, rI = getRankInfo(s);
    const isMe = (me && u.username===me);
    let rc = "vert-rank-item "+rI.css;
    if(i===0) rc+=" rank-1";
    if(isMe) rc+=" me";
    const avUrl = getAvatarUrl(u.username||'guest', u.avatar_style||'adventurer');
    const sq = u.squad_id&&SQUADS[u.squad_id] ? SQUADS[u.squad_id] : null;

    const hp = u.player_health != null ? u.player_health : 100;
    const hpPct = Math.max(0, hp);
    const sh = u.shield_durability || 0;
    const maxSh = 5;
    const shPct = Math.min(100, (sh / maxSh) * 100);
    let shColor = '#00e676', shGlow = 'rgba(0,230,118,0.5)';
    if(shPct <= 30) { shColor = '#ff1744'; shGlow = 'rgba(255,23,68,0.6)'; }
    else if(shPct <= 60) { shColor = '#ffcc00'; shGlow = 'rgba(255,204,0,0.5)'; }

    const bannerId = u.banner_style || 'banner1';
    const bannerUrl = BANNERS[bannerId] ? GITHUB+'/'+BANNERS[bannerId].file : GITHUB+'/banner1.svg';

    return `<li class="${rc}" data-userid="${u.id}" style="--banner:url(${bannerUrl})">
      <div class="vert-rank-pos">#${i+1}</div>
      <div class="vert-rank-top">
        <div class="vert-rank-left">
          <img src="${avUrl}" class="vert-rank-avatar">
          ${sq ? `<div class="vert-rank-squad" style="color:${sq.color}">${sq.svg}<span>${sq.name}</span></div>` : ''}
        </div>
        <div class="vert-rank-data">
          <div class="vert-rank-name-row"><span class="vert-rank-username">${u.username}</span></div>
          <div class="vert-rank-score-line"><span class="vert-rank-rank-line">${rI.icon}</span><div class="vert-rank-score-wrap"><span class="vert-rank-score-text"> ${s} pts</span></div></div>
          <div class="vert-rank-vd"><span class="vd-wins">⚔️ ${u.pvp_victorias||0}</span><span class="vd-losses">💀 ${u.pvp_derrotas||0}</span></div>
          <div class="vert-rank-bars">
            <div class="vert-bar-row"><span class="vert-bar-icon"><img src="${GITHUB}/vida.svg" style="height:1.2rem;width:auto;vertical-align:middle;display:inline-block;"></span><div class="vert-bar-bg"><div class="vert-bar-fill hp-bar-fill" style="width:${hpPct}%;"></div></div><span class="vert-bar-label">${hp}</span></div>
            <div class="vert-bar-row"><span class="vert-bar-icon"><img src="${GITHUB}/escudo.svg" style="height:1.2rem;width:auto;vertical-align:middle;display:inline-block;"></span><div class="vert-bar-bg"><div class="vert-bar-fill sh-bar-fill" style="width:${shPct}%;"></div></div><span class="vert-bar-label">${sh}/${maxSh}</span></div>
          </div>
        </div>
      </div>
    </li>`;
  }).join('');
}

// ── Inicialización y controles de nivel ──
function initGame(){ recuperarDueloAbandonado(); loadProblem(); populateLevelSelect(); }

function jumpToLevel(l){
  AudioEngine.playClick();
  const t = parseInt(l);
  if(t > unlockedLevel){ alert("¡Debes completar el nivel anterior!"); document.getElementById('levelSelect').value = currentMainLevel; return; }
  if(t < unlockedLevel){ alert("¡Ya has superado este nivel! No puedes regresar."); document.getElementById('levelSelect').value = currentMainLevel; return; }
  currentMainLevel = t; currentProblemInLevel = 1;
  loadProblem();
}

// ── Jefes y energías ──
function updateEnemyCard() {
  const level = currentMainLevel;
  currentEnemyLevel = level;
  const enemy = ENEMIES[level] || ENEMIES[1];
  document.getElementById('enemy-name').innerText = enemy.name;
  document.getElementById('enemy-img').src = enemy.jpg;
  document.getElementById('enemy-card-section').classList.add('loaded');
}

function updateEnergyBar() {
  const fill = document.getElementById('energy-bar-fill');
  const text = document.getElementById('energy-text');
  fill.style.width = enemyEnergy + '%';
  text.innerText = `Salud: ${enemyEnergy}%`;
  if (enemyEnergy > 60) {
    fill.style.background = 'linear-gradient(90deg, #00e676, #00c853)';
    fill.style.boxShadow = '0 0 12px rgba(0,230,118,0.7)';
  } else if (enemyEnergy > 30) {
    fill.style.background = 'linear-gradient(90deg, #ffcc00, #ff9800)';
    fill.style.boxShadow = '0 0 12px rgba(255,152,0,0.7)';
  } else {
    fill.style.background = 'linear-gradient(90deg, #ff1744, #d50000)';
    fill.style.boxShadow = '0 0 12px rgba(255,23,68,0.7)';
  }
}

function resetEnemy(fullReset = false) {
  if (fullReset) {
    enemyEnergy = 100;
    savedProblemKey = null;
    if (currentUser) {
      _supabase.from('profiles').update({
        enemy_energy: 100,
        current_problem_key: null
      }).eq('id', currentUser.id);
    }
  }
  document.getElementById('enemy-card').classList.remove('defeated');
  document.getElementById('enemy-card').style.animation = 'none';
  updateEnergyBar();
}

function defeatEnemy() {
  document.getElementById('enemy-card').style.animation = 'none';
  document.getElementById('enemy-card').classList.add('defeated');
  document.getElementById('energy-bar-fill').style.background = '#333';
  document.getElementById('energy-text').innerText = '¡DERROTADO!';
  showFeedbackOverlay('correct', `💀 ¡VICTORIA!<div class="feedback-sub">Has derrotado a ${ENEMIES[currentMainLevel]?.name || 'el enemigo'}</div>`);
}

// ── Carga y render de problemas ──
async function loadProblem(){
  if(hasFinishedGame) return;
  if (isDead) {
    document.getElementById('msg').innerHTML = '<span style="color:red;">💀 Has caído en batalla. Espera la nueva temporada.</span>';
    lockGrid();
    document.getElementById('btn-verify').disabled = true;
    return;
  }
  const canPlay = await checkGlobalState(); if(!canPlay) return;

  isVerifying = false;
  const btn = document.getElementById('btn-verify');
  btn.disabled = false; btn.style.opacity = '1'; btn.innerText = "⚔️ Verificar";

  document.getElementById('subLevelCount').innerText = currentProblemInLevel;
  renderRankProgress();
  populateLevelSelect();

  const expectedPrefix = `L${currentMainLevel}_P${currentProblemInLevel}`;
  let d = null, div = null;
  if (savedProblemKey && savedProblemKey.startsWith(expectedPrefix + '_D')) {
    const m = savedProblemKey.match(/^L(\d+)_P(\d+)_D(\d+)_S(\d+)$/);
    if (m) { d = parseInt(m[3]); div = parseInt(m[4]); }
  }
  if (d === null || div === null || isNaN(d) || isNaN(div) || div <= 0 || d <= 0) {
    const gen = generarDivision(currentMainLevel);
    d = gen.d; div = gen.div;
  }
  currentDividend = d;
  currentDivisor = div;

  // Fijar el problema en la BD para que el refresco NO genere uno nuevo
  if (currentUser) {
    _supabase.from('profiles').update({ current_problem_key: `${expectedPrefix}_D${d}_S${div}` })
      .eq('id', currentUser.id)
      .then(r => { if (r.error) console.error('Error fijando problema:', r.error); });
  }

  document.getElementById('difficultyLabel').innerText = getDifficultyLabel(currentMainLevel);
  updateEnemyCard();

  const hasStartedLevel = completedLevels.some(key => key.startsWith(`L${currentMainLevel}_`));
  if (!hasStartedLevel) {
    enemyEnergy = 100;
    document.getElementById('enemy-card').classList.remove('defeated');
    document.getElementById('enemy-card').style.animation = 'none';
  }

  if (enemyEnergy <= 0) {
    document.getElementById('enemy-card').style.animation = 'none';
    document.getElementById('enemy-card').classList.add('defeated');
    document.getElementById('energy-bar-fill').style.background = '#333';
    document.getElementById('energy-text').innerText = '¡DERROTADO!';
  } else {
    document.getElementById('enemy-card').classList.remove('defeated');
    document.getElementById('enemy-card').style.animation = 'none';
    updateEnergyBar();
  }

  createUI(); createAntena(); resetAll(); lockGrid();
  document.getElementById('msg').innerText = '';
}

function getDifficultyLabel(lvl){ if(lvl<=2) return "Divisor: 1 Cifra"; if([3,4,5,7,9].includes(lvl)) return "Divisor: 2 Cifras"; return "Divisor: 3 Cifras"; }

// ── Bloqueos y desbloqueos de rejilla ──
function lockGrid(){
  isGridLocked = true;
  document.getElementById('grid-lock-overlay').classList.remove('hidden');
  disableCocienteInputs(true);
  document.getElementById('valResiduo').disabled = true;
  document.querySelectorAll('.cell:not(.cell-locked)').forEach(cell => {
    cell.disabled = true; cell.style.pointerEvents = 'none'; cell.style.opacity = '0.4';
  });
}

function unlockGrid(){
  isGridLocked = false;
  document.getElementById('grid-lock-overlay').classList.add('hidden');
  disableCocienteInputs(false);
  document.getElementById('valResiduo').disabled = false;
  document.querySelectorAll('.cell:not(.cell-locked)').forEach(cell => {
    cell.disabled = false; cell.style.pointerEvents = 'auto'; cell.style.opacity = '1';
  });
  document.getElementById('msg').innerText = "¡Sello Real desbloqueado!";
  document.getElementById('msg').style.color = "var(--success)";
  triggerEpicEffect();
}

function triggerEpicEffect(){
  AudioEngine.playEpic();
  const ov = document.getElementById('epic-overlay'), tx = document.getElementById('epic-text');
  const msgs = ["⚔️ ¡Por la Gloria Oscura!","💀 ¡No hay piedad!","🐉 ¡Fuego y Sangre!"];
  tx.innerText = msgs[Math.floor(Math.random()*msgs.length)];
  ov.style.display = 'flex'; tx.style.animation = 'none'; void tx.offsetWidth;
  tx.style.animation = 'epicPulse .5s ease-out forwards';
  setTimeout(() => ov.style.display = 'none', 1500);
}

// ── Pantalla de victoria y confetti ──
function showVictoryScreen(){ createConfetti(); document.getElementById('victory-screen').style.display = 'flex'; AudioEngine.playLevelUp(); }
function hideVictoryScreen(){ document.getElementById('victory-screen').style.display = 'none'; document.querySelectorAll('.confetti').forEach(c=>c.remove()); }

function createConfetti(){
  const sc = document.getElementById('victory-screen');
  const colors = ['#c9a84c','#e2c275','#f5e6b8','#b08c30','#ffffff','#3498db','#6d28d9'];
  for(let i=0;i<60;i++){
    const c = document.createElement('div'); c.className = 'confetti';
    c.style.left = Math.random()*100 + 'vw'; c.style.top = '-10px';
    c.style.background = colors[Math.floor(Math.random()*colors.length)];
    c.style.animationDuration = (Math.random()*2+2) + 's';
    sc.appendChild(c);
  }
}

// ── Construcción de la matriz y inputs ──
function createUI(){
  const g = document.getElementById('gridContainer'), dB = document.getElementById('divisorBox'), tR = document.getElementById('topRow');
  g.innerHTML = ''; dB.innerHTML = ''; tR.innerHTML = '';
  String(currentDivisor).split('').forEach(n => {
    let i = document.createElement('input'); i.type = 'text'; i.className = 'input-div'; i.value = n; i.readOnly = true;
    dB.appendChild(i);
  });
  for(let r=0; r<15; r++) for(let c=0; c<9; c++){
    let i = document.createElement('input'); i.type = 'text'; i.className = 'cell'; i.maxLength = 1; i.id = "c-"+r+"-"+c;
    i.setAttribute('autocomplete','off'); i.setAttribute('autocorrect','off'); i.setAttribute('spellcheck','false');
    i.addEventListener('input', e => {
      if(!isGridLocked && e.target.value){
        let n = (c<8) ? "c-"+r+"-"+(c+1) : (r<14) ? "c-"+(r+1)+"-0" : null;
        if(n) document.getElementById(n).focus();
      }
    });
    g.appendChild(i);
  }
  const sN = String(currentDividend);
  for(let i=0; i<sN.length; i++){
    let cell = document.getElementById("c-0-"+i);
    cell.value = sN[i]; cell.classList.add('cell-locked'); cell.disabled = true;
  }
  document.getElementById('lineH').style.width = (sN.length*32) + 'px';
  for(let i=0; i<sN.length; i++){
    let inp = document.createElement('input'); inp.type = 'text'; inp.className = 'input-cociente-galera'; inp.maxLength = 1; inp.id = "top-"+i;
    inp.setAttribute('autocomplete','off'); inp.setAttribute('autocorrect','off'); inp.setAttribute('spellcheck','false');
    inp.addEventListener('input', e => {
      syncT();
      if(e.target.value && i<sN.length-1) document.getElementById("top-"+(i+1)).focus();
    });
    tR.appendChild(inp);
  }
}

function disableCocienteInputs(d){ document.querySelectorAll('.input-cociente-galera').forEach(i => i.disabled = d); }

function syncT(){ let v = ""; document.querySelectorAll('.input-cociente-galera').forEach(x => v += x.value); document.getElementById('valCociente').value = v; }

// ── Antena (Multiplicaciones del Sello Real) ──
function createAntena(){
  const b = document.getElementById('antenaBody');
  document.getElementById('antenaLabel').innerText = currentDivisor;
  b.innerHTML = '';
  for(let i=1; i<=10; i++){
    let r = document.createElement('div'); r.className = 'antena-row locked-row'; r.id = "row-"+i;
    r.innerHTML = "<span>"+i+" x "+currentDivisor+" =</span><input type='text' inputmode='numeric' pattern='[0-9]*' autocomplete='off' autocorrect='off' spellcheck='false' class='antena-input' id='a"+i+"' disabled>";
    b.appendChild(r);
  }
  currentAntennaIndex = 0; enableNextAntennaInput();
}

function enableNextAntennaInput(){
  if(currentAntennaIndex >= ANTENNA_SEQUENCE.length) return;
  const cId = ANTENNA_SEQUENCE[currentAntennaIndex];
  const inp = document.getElementById("a"+cId), row = document.getElementById("row-"+cId);
  if(inp){
    inp.disabled = false; inp.focus(); row.classList.remove('locked-row');
    inp.oninput = e => { e.target.value = e.target.value.replace(/[^0-9]/g,''); checkAntennaInput(inp, cId); };
  }
}

function checkAntennaInput(inp, id){
  const val = parseInt(inp.value), exp = id * currentDivisor;
  if(val === exp){
    inp.classList.add('status-ok'); inp.disabled = true; inp.classList.remove('status-wrong');
    currentAntennaIndex++;
    if(currentAntennaIndex < ANTENNA_SEQUENCE.length){
      const msg = document.getElementById('msg');
      msg.innerText = ANTENNA_WISE_PHRASES[Math.floor(Math.random()*ANTENNA_WISE_PHRASES.length)];
      msg.style.color = 'var(--success)';
      enableNextAntennaInput();
    } else {
      unlockGrid();
    }
  } else {
    inp.classList.add('status-wrong'); setTimeout(() => inp.classList.remove('status-wrong'), 500);
  }
}

function resetAll(){
  document.getElementById('valCociente').value = '';
  document.getElementById('valResiduo').value = '';
  document.querySelectorAll('.antena-input').forEach(i => { i.value = ''; i.classList.remove('status-ok','status-wrong'); });
  document.querySelectorAll('.input-cociente-galera').forEach(i => i.value = '');
  document.querySelectorAll('.cell:not(.cell-locked)').forEach(i => { i.value = ''; i.disabled = false; i.style.pointerEvents = 'auto'; i.style.opacity = '1'; });
}

// ── Verificar Solución Principal ──
async function verificarSolucion(){
  if(isVerifying) return;
  if(isGridLocked){ alert("¡Rompe el Sello Real primero!"); return; }
  if(isDead) {
    document.getElementById('msg').innerHTML = '<span style="color:red;">💀 Estás muerto. Espera la nueva temporada.</span>';
    return;
  }

  isVerifying = true;
  const btn = document.getElementById('btn-verify');
  btn.disabled = true; btn.style.opacity = '0.4'; btn.innerText = "Verificando...";

  const coc = parseInt(document.getElementById('valCociente').value);
  const res = parseInt(document.getElementById('valResiduo').value) || 0;
  const rC = Math.floor(currentDividend / currentDivisor);
  const rR = currentDividend % currentDivisor;

  if(coc === rC && res === rR){

    const levelKey = `L${currentMainLevel}_P${currentProblemInLevel}`;
    const petBoost = PETS[currentPet] || {};
    const ptsMult = 1 + (petBoost.pointsBonus || 0);
    const coinMult = 1 + (petBoost.coinsBonus || 0);
    let bonusPts = Math.round(POINTS * ptsMult);
    let bonusCoins = Math.round(5 * coinMult);
    let runaMsg = '';
    if (purchasedSkills.includes('runa_doble') && Math.random() < 0.2) {
      bonusPts *= 2; bonusCoins *= 2;
      runaMsg = ' 🔮¡DOBLE!';
    }

    if (!completedLevels.includes(levelKey)) {
      totalScore += bonusPts;
      currentCoins += bonusCoins;
      totalCoinsEarned += bonusCoins;
      completedLevels.push(levelKey);
      renderRankProgress();
      if (currentStreak + 1 > maxStreak) maxStreak = currentStreak + 1;
      checkAndAwardMissions();
      renderMissionCards();

      if (currentProblemInLevel === PROBLEMS_PER_LEVEL) {
        gems += 1;
        if (currentMainLevel < TOTAL_LEVELS) {
          unlockedLevel = currentMainLevel + 1;
        }
      }
      enemyEnergy = Math.max(0, enemyEnergy - 10);
    }
    updateEnergyBar();
    if (enemyEnergy === 0) defeatEnemy();
    updateUI();
    incrementStreak();
    updateCoinDisplay();
    updateHealthBar();
    const petBoostMsg = PETS[currentPet] && PETS[currentPet].pointsBonus > 0 ? ` <span style="color:#ffcc00;font-size:.9rem;">🐾x${1+PETS[currentPet].pointsBonus}</span>` : (PETS[currentPet] && PETS[currentPet].coinsBonus > 0 ? ` <span style="color:#ffcc00;font-size:.9rem;">🐾+50%</span>` : '');
    showFeedbackOverlay('correct', `⚔️ ¡CORRECTO!<div class="feedback-sub">+${bonusPts} pts${petBoostMsg}${runaMsg} & +${bonusCoins} <img src="${GITHUB}/florines.svg" style="height:1.4rem;vertical-align:middle;"></div>`);

    // Guardado inmediato en la base de datos
    if(currentUser) {
      const saveData = {
        total_score: totalScore,
        current_level: unlockedLevel,
        current_problem: currentProblemInLevel === PROBLEMS_PER_LEVEL ? currentProblemInLevel : currentProblemInLevel + 1,
        coins: currentCoins,
        completed_levels: cleanCompletedLevels(completedLevels),
        gems: gems,
        player_health: playerHealth,
        enemy_energy: enemyEnergy,
        current_problem_key: levelKey,
        total_attacks: totalAttacks,
        total_coins_earned: totalCoinsEarned,
        purchased_avatars: purchasedAvatars,
        purchased_skills: purchasedSkills
      };
      let saved = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await _supabase.from('profiles').update(saveData).eq('id', currentUser.id);
        if (!error) { saved = true; break; }
        await new Promise(r => setTimeout(r, 500));
      }
      if (!saved) {
        document.getElementById('msg').innerHTML = '<span style="color:#ff4444;">🔴 Error al guardar. Intenta de nuevo.</span>';
        updateRanking();
        isVerifying = false;
        btn.disabled = false; btn.style.opacity = '1'; btn.innerText = "⚔️ Verificar";
        return;
      }
    }

    updateRanking();

    isVerifying = false;
    btn.disabled = true;

    // Avance de problema o nivel
    if(currentProblemInLevel < PROBLEMS_PER_LEVEL){
      currentProblemInLevel++;
      setTimeout(() => loadProblem(), 1200);
    } else {
        if(currentMainLevel < TOTAL_LEVELS){
          if(feedbackTimer) clearTimeout(feedbackTimer);
          document.getElementById('feedback-overlay').style.display = 'none';
          currentMainLevel++;
          currentProblemInLevel = 1;
          savedProblemKey = null;
          enemyEnergy = 100;
          if(currentUser) {
            await _supabase.from('profiles').update({
              current_level: unlockedLevel,
              current_problem: 1,
              enemy_energy: 100,
              current_problem_key: null
            }).eq('id', currentUser.id);
          }
          showVictoryScreen();
        setTimeout(() => {
          hideVictoryScreen();
          loadProblem();
        }, 3000);
      } else {
        hasFinishedGame = true;
        _supabase.from('profiles').update({ completed_at: new Date().toISOString() }).eq('id', currentUser.id);
        loadHallOfFame();
        showFeedbackOverlay('correct', '📜 ¡CÓDICE COMPLETADO!<div class="feedback-sub">Has desbloqueado todos los secretos.</div>');
        btn.disabled = false; btn.style.opacity = '1'; btn.innerText = "⚔️ Verificar";
      }
    }

  } else {
    showFeedbackOverlay('incorrect', `🛡️ INCORRECTO<div class="feedback-sub">El jefe te ha atacado</div>`);
    resetStreak();

    const damage = purchasedSkills.includes('reduce_dano') ? 5 : 10;
    playerHealth = Math.max(0, playerHealth - damage);
    updateHealthBar();
    updateRanking();

    if (playerHealth === 0) {
      isDead = true;
      lockGrid();
      btn.disabled = true;
      showFeedbackOverlay('incorrect', '💀 HAS MUERTO<div class="feedback-sub">Espera la próxima temporada.</div>');
      if (currentUser) {
        await _supabase.from('profiles').update({ player_health: 0, is_dead: true }).eq('id', currentUser.id);
      }
      isVerifying = false;
      return;
    }

    if (currentUser) {
      await _supabase.from('profiles').update({ player_health: playerHealth }).eq('id', currentUser.id);
    }

    isVerifying = false;
    btn.disabled = false; btn.style.opacity = '1'; btn.innerText = "⚔️ Verificar";
  }
}

// ── Abrir cofre con gemas ──
async function openMysteryChest() {
  if (gems < 1) {
    showToast('<img src="'+GITHUB+'/diamante.svg" class="coin-inline"> Necesitas al menos 1 gema para abrir un cofre', 'tomato', 3000);
    return;
  }
  if (!currentUser) return;

  const prevGems = gems;
  const prevCoins = currentCoins;
  const prevInventory = { ...inventory };
  const prevShield = shieldDurability;
  const prevTotalShields = totalShieldsEarned;

  gems -= 1;
  updateCoinDisplay();

  const rand = Math.floor(Math.random() * 100) + 1;
  let chestName, emoji;
  if (rand <= 30) { chestName = 'Cofre Oxidado'; emoji = '💩'; }
  else if (rand <= 55) { chestName = 'Cofre de Hierro'; emoji = '🟤'; }
  else if (rand <= 75) { chestName = 'Cofre de Plata'; emoji = '⚪'; }
  else if (rand <= 90) { chestName = 'Cofre Dorado'; emoji = '🟡'; }
  else if (rand <= 97) { chestName = 'Cofre Legendario'; emoji = '<img src="'+GITHUB+'/diamante.svg" class="coin-inline">'; }
  else { chestName = 'Cofre Infernal'; emoji = '🔥'; }

  let rewardText = '';
  const randomFromArray = (arr) => arr[Math.floor(Math.random() * arr.length)];

  switch(chestName) {
    case 'Cofre Oxidado':
      if (Math.random() < 0.5) { currentCoins += 5; rewardText = '5 monedas'; }
      else { inventory.dagger++; rewardText = '1 Daga'; }
      break;
    case 'Cofre de Hierro':
      const hierro = [
        { text: '20 monedas', action: () => { currentCoins += 20; } },
        { text: '1 Daga', action: () => { inventory.dagger++; } },
        { text: '2 usos de Escudo 🛡️', action: () => { shieldDurability += 2; totalShieldsEarned += 2; } }
      ];
      const c2 = randomFromArray(hierro); rewardText = c2.text; c2.action();
      break;
    case 'Cofre de Plata':
      const plata = [
        { text: '80 monedas', action: () => { currentCoins += 80; } },
        { text: '1 Espada Franca ⚔️', action: () => { inventory.sword++; } },
        { text: '1 Arco de la Reina 🏹', action: () => { inventory.bow++; } },
        { text: '4 usos de Escudo 🛡️', action: () => { shieldDurability += 4; totalShieldsEarned += 4; } }
      ];
      const c3 = randomFromArray(plata); rewardText = c3.text; c3.action();
      break;
    case 'Cofre Dorado':
      const dorado = [
        { text: '400 monedas', action: () => { currentCoins += 400; } },
        { text: '1 Hacha de los Brujos 🪓', action: () => { inventory.axe++; } },
        { text: '6 usos de Escudo 🛡️', action: () => { shieldDurability += 6; totalShieldsEarned += 6; } },
        { text: '1 Arco + 2 Escudos 🏹🛡️', action: () => { inventory.bow++; shieldDurability += 2; totalShieldsEarned += 2; } }
      ];
      const c4 = randomFromArray(dorado); rewardText = c4.text; c4.action();
      break;
    case 'Cofre Legendario':
      const legend = [
        { text: '1000 monedas', action: () => { currentCoins += 1000; } },
        { text: '1 Martillo de la Justicia 🔨', action: () => { inventory.hammer++; } },
        { text: '10 usos de Escudo 🛡️', action: () => { shieldDurability += 10; totalShieldsEarned += 10; } },
        { text: '1 Martillo + 500 monedas 🔨💰', action: () => { inventory.hammer++; currentCoins += 500; } }
      ];
      const c5 = randomFromArray(legend); rewardText = c5.text; c5.action();
      break;
    case 'Cofre Infernal':
      const infernal = [
        { text: '2000 monedas', action: () => { currentCoins += 2000; } },
        { text: '2 Martillos 🔨🔨', action: () => { inventory.hammer += 2; } },
        { text: '20 usos de Escudo 🛡️', action: () => { shieldDurability += 20; totalShieldsEarned += 20; } },
        { text: '1 Martillo + 1000 monedas + 5 Escudos 🔨💰🛡️', action: () => { inventory.hammer++; currentCoins += 1000; shieldDurability += 5; totalShieldsEarned += 5; } }
      ];
      const c6 = randomFromArray(infernal); rewardText = c6.text; c6.action();
      break;
  }

  updateCoinDisplay();
  updateInventoryUI();

  const { error } = await _supabase.from('profiles').update({
    gems: gems,
    coins: currentCoins,
    inventory_dagger: inventory.dagger,
    inventory_sword: inventory.sword,
    inventory_bow: inventory.bow,
    inventory_axe: inventory.axe,
    inventory_hammer: inventory.hammer,
    shield_durability: shieldDurability,
    total_shields_earned: totalShieldsEarned
  }).eq('id', currentUser.id);

  if (error) {
    gems = prevGems;
    currentCoins = prevCoins;
    inventory = prevInventory;
    shieldDurability = prevShield;
    totalShieldsEarned = prevTotalShields;
    updateCoinDisplay();
    updateInventoryUI();
    showToast('❌ Error al guardar el cofre, intenta de nuevo.', 'tomato');
    console.error(error);
  } else {
    showToast(`${emoji} ¡${chestName}! ${rewardText}`, 'success', 5000);
    AudioEngine.playShop();
    updateRanking();
  }
}

// ── Modal de selección de rival para ataque normal ──
function prepararAtaque(weaponKey) {
  const weapon = WEAPONS[weaponKey];
  if (!weapon) return;
  if (inventory[weaponKey] <= 0) {
    showToast('No tienes ' + weapon.name, 'tomato');
    return;
  }
  if (!rankingDataCache || rankingDataCache.length === 0) {
    showToast('Espera a que cargue la Corte...', 'tomato');
    return;
  }
  const me = currentUser?.email?.split('@')[0];
  const rivals = rankingDataCache.filter(u => u.username !== me);
  if (rivals.length === 0) {
    showToast('No hay rivales disponibles', 'tomato');
    return;
  }
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#16213e;padding:20px;border-radius:12px;max-width:400px;width:90%;border:2px solid gold;">
      <h3 style="color:gold;text-align:center;margin-top:0;">${weapon.icon} Usar ${weapon.name}</h3>
      <div style="max-height:300px;overflow-y:auto;">
        ${rivals.map(u => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #333;">
            <span style="color:#ccc;">${u.username}</span>
            <button class="btn-small" style="padding:4px 10px;"
              onclick="ejecutarAtaqueDesdeInventario('${u.id}','${u.username}','${weaponKey}'); document.body.removeChild(this.closest('[style*=&quot;fixed&quot;]'));">
              ⚔️ Atacar
            </button>
          </div>
        `).join('')}
      </div>
      <button class="btn-small" style="margin-top:10px;width:100%;" onclick="document.body.removeChild(this.closest('[style*=&quot;fixed&quot;]'));">
        Cancelar
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}

function ejecutarAtaqueDesdeInventario(targetId, targetName, weaponKey) {
  attackUser(targetId, targetName, weaponKey);
}

// ── Comprobación global de pausa o examen ──
async function checkGlobalState(){
  if(isAdmin) return true;
  try {
    const { data } = await _supabase.from('game_settings').select('*').single();
    if(data?.is_paused){ lockGrid(); document.getElementById('msg').innerHTML = "<span style='color:var(--cr-red);font-size:1.5rem;font-family:\"Cinzel\",serif;'>⏸️ JUEGO PAUSADO</span>"; return false; }
    if(data?.exam_level > 0){
      if(currentMainLevel !== data.exam_level){ currentMainLevel = data.exam_level; unlockedLevel = data.exam_level; loadProblem(); alert("Modo Examen: Nivel "+data.exam_level); }
    }
    return true;
  } catch(e){ return true; }
}

// ── Cuenta regresiva de temporadas ──
let seasonInterval;

async function initSeason(settings){
  let data = settings;
  if(!data){
    const r = await _supabase.from('game_settings').select('season_end_time,season_number').eq('id',1).single();
    data = r.data;
  }
  const seasonNumEl = document.getElementById('season-num-display');
  if(seasonNumEl) seasonNumEl.innerText = data?.season_number || 1;
  if(data?.season_end_time){
    startCountdown(new Date(data.season_end_time));
  } else {
    document.getElementById('timer-display').innerText = isAdmin ? "SIN INICIAR" : "--:--";
    document.getElementById('season-badge').classList.add('finished');
  }
}

function startCountdown(endDate){
  clearInterval(seasonInterval);
  seasonInterval = setInterval(() => {
    const diff = endDate - new Date();
    if(diff <= 0){
      clearInterval(seasonInterval);
      document.getElementById('timer-display').innerText = "00:00:00";
      document.getElementById('season-badge').classList.add('finished');
      document.getElementById('season-badge').classList.remove('active');
      if(isAdmin){ alert("¡Tiempo terminado!"); resetAllUsers(); }
      return;
    }
    const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
    document.getElementById('timer-display').innerText = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    document.getElementById('season-badge').classList.add('active');
    document.getElementById('season-badge').classList.remove('finished');
  }, 1000);
}

// ── Relleno de niveles para selección ──
function populateLevelSelect(){
  const s = document.getElementById('levelSelect'); s.innerHTML = '';
  for(let i=1; i<=TOTAL_LEVELS; i++){
    let o = document.createElement('option'); o.value = i; o.innerText = "Nivel "+i;
    if(i > unlockedLevel || i < unlockedLevel){ o.disabled = true; o.innerText += " 🔒"; }
    s.appendChild(o);
  }
  s.value = currentMainLevel;
}

// ── Actualizaciones generales de la UI del alumno ──
function updateUI(){
  renderRankProgress();
  const rI = getRankInfo(totalScore);
  document.getElementById('header-rank-icon').innerHTML = rI.icon;
  document.getElementById('header-rank-label').innerHTML = rI.name + " " + rI.tier;
  document.getElementById('header-rank-label').className = "header-rank-label " + rI.css;
  document.getElementById('main-avatar-box').className = "avatar-container " + rI.avatar;
  renderMainAvatar();
  renderSkillOrbs();
}

function startRanking(){ updateRanking(); rankInt = setInterval(updateRanking, 20000); }

// ── Modales de avatares ──
function toggleAvatarModal(){
  const m = document.getElementById('avatar-modal');
  if(m.style.display === 'none'){ m.style.display = 'flex'; renderAvatarOptions(); }
  else { m.style.display = 'none'; stopChromaPreviews(); }
}

function renderAvatarOptions(){
  stopChromaPreviews();
  const gs = document.getElementById('avatar-options-standard'), ge = document.getElementById('avatar-options-exclusive'), es = document.getElementById('exclusive-section');
  gs.innerHTML = ''; ge.innerHTML = '';
  const seed = currentUser.email.split('@')[0], isH = totalScore >= 50000;
  AVATAR_STYLES_STANDARD.forEach(st => {
    let d = document.createElement('div'); d.className = 'avatar-option' + (currentAvatarStyle===st.id?' selected':'');
    d.onclick = () => selectAvatarStyle(st.id);
    d.innerHTML = `<img src="${getAvatarUrl(seed, st)}"><span style="font-size:.7rem;font-weight:600;display:block;font-family:'Cinzel',serif;">${st.name}</span>`;
    gs.appendChild(d);
  });
  Object.entries(VIDEO_AVATARS).forEach(([id, info]) => {
    if (purchasedAvatars.includes(id)) {
      let d = document.createElement('div'); d.className = 'avatar-option' + (currentAvatarStyle===id?' selected':'');
      d.onclick = () => selectAvatarStyle(id);
      const prev = document.createElement('div');
      prev.style.cssText = 'width:70px;height:70px;margin:0 auto;overflow:hidden;';
      d.appendChild(prev);
      d.appendChild(Object.assign(document.createElement('span'), {style:'font-size:.7rem;font-weight:600;display:block;font-family:\'Cinzel\',serif;', textContent:info.name}));
      gs.appendChild(d);
      initChromaPreview(prev, 70, 70, info.file);
    }
  });
  es.style.display = 'none';
}

function avatarDustEffect(callback){
  const container = document.getElementById('main-avatar-box');
  const isVideo = !!VIDEO_AVATARS[currentAvatarStyle] && _videoAvatarCtx;
  let source, hideEl, showEl;
  if (isVideo) {
    source = _videoAvatarCtx.canvas;
    _videoAvatarCtx.renderRunning = false;
    _videoAvatarCtx.video.pause();
    hideEl = () => { _videoAvatarCtx.canvas.style.opacity=0; };
    showEl = () => { _videoAvatarCtx.canvas.style.opacity=1; };
  } else {
    source = document.getElementById('main-avatar-img');
    if(!source || !source.complete || !source.naturalWidth || source.naturalWidth===0){ if(callback) callback(); return; }
    hideEl = () => { source.style.opacity=0; };
    showEl = () => { source.style.opacity=1; };
  }
  const W = container.offsetWidth, H = container.offsetHeight;
  if(!W || !H){ if(callback) callback(); return; }
  try {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;pointer-events:none;';
  canvas.dataset.dust = '1';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  const particles = [];
  for(let y=0; y<H; y+=4) for(let x=0; x<W; x+=4){
    const i=(y*W+x)*4;
    if(data[i+3]>30) particles.push({
      ox:x,oy:y,x:x||0.01,y:y||0.01,
      tx:x+(Math.random()-0.5)*80-(Math.random()-0.5)*20,
      ty:y+(Math.random()-0.5)*60-30,
      rot:0,vr:(Math.random()-0.5)*0.15,
      s:1+Math.random()*2,r:data[i],g:data[i+1],b:data[i+2],a:data[i+3]/255
    });
  }
  hideEl(); let start;
  function anim(ts){
    if(!start) start=ts; const p=(ts-start)/7000;
    if(p>=1){ canvas.remove(); showEl(); if(callback) callback(); return; }
    if(p<0.35) { hideEl(); }
    else if(p<0.45) { hideEl(); }
    else if(p<0.65) { if(isVideo) _videoAvatarCtx.canvas.style.opacity=(p-0.45)/0.2; else source.style.opacity=(p-0.45)/0.2; }
    else { showEl(); }
    canvas.style.opacity=p<0.65?1:1-(p-0.65)/0.35;
    ctx.clearRect(0,0,W,H);
    for(const pt of particles){
      let px,py,al;
      if(p<0.35){
        const t=p/0.35,e=1-(1-t)*(1-t)*(1-t);
        px=pt.ox+(pt.tx-pt.ox)*e; py=pt.oy+(pt.ty-pt.oy)*e; al=1-e*0.3;
      } else if(p<0.45){
        px=pt.tx; py=pt.ty; al=0.6;
      } else if(p<0.65){
        const t=(p-0.45)/0.2,e=t*t*(3-2*t);
        px=pt.tx+(pt.ox-pt.tx)*e; py=pt.ty+(pt.oy-pt.ty)*e; al=0.6+e*0.4;
      } else { px=pt.ox; py=pt.oy; al=1; }
      ctx.globalAlpha=al*pt.a; ctx.fillStyle=`rgb(${pt.r},${pt.g},${pt.b})`;
      ctx.setTransform(1,0,0,1,px,py); ctx.rotate(pt.rot+p*pt.vr*5);
      ctx.fillRect(-pt.s/2,-pt.s/2,pt.s,pt.s);
    }
    ctx.setTransform(1,0,0,1,0,0);
    requestAnimationFrame(anim);
  }
  requestAnimationFrame(anim);
  } catch(e){ console.warn('Dust effect skipped:',e.message); if(callback) callback(); }
}

let _dustTimer = null;
function startAvatarDustLoop(){
  stopAvatarDustLoop();
  const fn = () => { avatarDustEffect(() => {
    if (VIDEO_AVATARS[currentAvatarStyle] && _videoAvatarCtx) {
      _videoAvatarCtx.video.play().catch(() => {});
      _videoAvatarCtx.renderRunning = true;
    }
    _dustTimer = setTimeout(fn, 8000);
  }); };
  _dustTimer = setTimeout(fn, 5000);
}
function stopAvatarDustLoop(){
  if(_dustTimer){ clearTimeout(_dustTimer); _dustTimer = null; }
  const c = document.querySelector('#main-avatar-box canvas[data-dust]');
  if(c) c.remove();
  if (VIDEO_AVATARS[currentAvatarStyle] && _videoAvatarCtx) {
    _videoAvatarCtx.renderRunning = true;
    _videoAvatarCtx.video.play().catch(() => {});
    _videoAvatarCtx.canvas.style.opacity = 1;
  } else {
    const img = document.getElementById('main-avatar-img');
    if(img) img.style.opacity = '1';
  }
}

function selectAvatarStyle(id){
  const all = [...AVATAR_STYLES_STANDARD, ...AVATAR_STYLES_EXCLUSIVE];
  const isEx = AVATAR_STYLES_EXCLUSIVE.some(s => s.id === id);
  if(isEx && totalScore < 50000){ alert("¡Solo para Reyes Merovingios!"); return; }
  const was = currentAvatarStyle;
  currentAvatarStyle = id; renderAvatarOptions(); renderMainAvatar();
  const v = VIDEO_AVATARS[id];
  showToast(`🧙 Efigie cambiada: ${v?v.name:(all.find(s=>s.id===id)||{}).name || id}`,'info');
}

async function saveAvatarChoice(){
  AudioEngine.playClick();
  try {
    const { error } = await _supabase.from('profiles').update({ avatar_style: currentAvatarStyle }).eq('id', currentUser.id);
    if(error) throw error;
    renderMainAvatar(); toggleAvatarModal(); updateRanking();
    showToast('✅ ¡Efigie sellada!','success');
  } catch(e) { console.error('Error guardando avatar:', e); showToast('❌ Error: '+e.message,'tomato'); }
}

// ── PVP RETOS ──────────────────────────────────────────────
let pvpCurrentTab = 'retar';

function openPvPModal(){
  document.getElementById('pvp-modal').style.display = 'flex';
  switchPvPTab(pvpCurrentTab);
}

function closePvPModal(){
  document.getElementById('pvp-modal').style.display = 'none';
}

function switchPvPTab(tab){
  pvpCurrentTab = tab;
  document.querySelectorAll('.pvp-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('pvp-tab-'+tab).classList.add('active');
  const content = document.getElementById('pvp-content');
  content.innerHTML = '<div class="pvp-empty">Cargando los retos de la corte...</div>';
  if(tab === 'retar') renderPvPChallengers();
  else if(tab === 'recibidos') renderPvPIncoming();
  else renderPvPOutgoing();
}

async function updatePvPBadge(){
  if(!currentUser) return;
  const badge = document.getElementById('pvp-badge');
  const tabBadge = document.getElementById('pvp-tab-recibidos-badge');
  try {
    const { data } = await _supabase.from('duelos').select('id').eq('retado_id', currentUser.id).eq('estado', 'pendiente');
    const n = data ? data.length : 0;
    badge.style.display = n > 0 ? 'inline-block' : 'none';
    badge.textContent = n;
    tabBadge.style.display = n > 0 ? 'inline' : 'none';
    tabBadge.textContent = n;
  } catch(e){ console.error('Error badge pvp:', e); }
}

// Cierra (marca 'jugado') los duelos pendientes de la lista donde este jugador abandonó
function cerrarDuelosAbandonados(lista, lado){
  (lista||[]).forEach(d => {
    const abandonado = lado === 'retador' ? (d.tiempo_retador||0) >= 999999 : (d.tiempo_retado||0) >= 999999;
    if(abandonado){
      _supabase.from('duelos').update({ estado: 'jugado', jugado_en: new Date().toISOString() }).eq('id', d.id)
        .then(({ error }) => {
          if(error){ console.error('No se pudo cerrar duelo abandonado:', error); return; }
          resolverDueloAbandonado(d.id, lado);
        })
        .catch(err => console.error('Cierre de duelo fallido:', err));
    }
  });
}

async function renderPvPChallengers(){
  const content = document.getElementById('pvp-content');
  if(!currentUser || !userSquadId){
    content.innerHTML = '<div class="pvp-empty">Debes pertenecer a una casa para retar.</div>';
    return;
  }
  try {
    const { data: players } = await _supabase.from('profiles')
      .select('id,username,total_score,avatar_style,current_level,squad_id,completed_at,is_banned')
      .neq('id', currentUser.id)
      .neq('squad_id', userSquadId)
      .eq('is_banned', false)
      .is('completed_at', null)
      .order('total_score', { ascending:false });
    const { data: pending } = await _supabase.from('duelos')
      .select('id,retado_id,tiempo_retador').eq('retador_id', currentUser.id).eq('estado', 'pendiente');
    cerrarDuelosAbandonados(pending, 'retador');
    const pendingIds = new Set((pending||[]).filter(d => (d.tiempo_retador||0) < 999999).map(d => d.retado_id));
    const { data: incoming } = await _supabase.from('duelos')
      .select('id,retador_id,tiempo_retado').eq('retado_id', currentUser.id).eq('estado', 'pendiente');
    cerrarDuelosAbandonados(incoming, 'retado');
    const incomingIds = new Set((incoming||[]).filter(d => (d.tiempo_retado||0) < 999999).map(d => d.retador_id));
    const others = (players||[]).filter(p => !p.squad_id || p.squad_id != userSquadId);
    if(!others.length){
      content.innerHTML = '<div class="pvp-empty">No hay rivales de otras casas disponibles ahora.</div>';
      return;
    }
    content.innerHTML = others.map(p => {
      const already = pendingIds.has(p.id) || incomingIds.has(p.id);
      return `<div class="pvp-card">
        <img src="${getAvatarUrl(p.username||'guest', p.avatar_style)}" class="pvp-card-avatar">
        <div class="pvp-card-info">
          <div class="pvp-card-name">${p.username||'Visitante'}</div>
          <div class="pvp-card-sub">Nivel ${p.current_level||1} · ${p.total_score||0} pts</div>
        </div>
        <div class="pvp-card-bet">50 <img src="${GITHUB}/florines.svg" class="coin-inline" style="height:1.1rem;"></div>
        <button class="pvp-card-btn" onclick="challengePlayer('${p.id}')" ${already?'disabled':''}>${already?'Reto activo':'Retar'}</button>
      </div>`;
    }).join('');
  } catch(e){ console.error(e); content.innerHTML = '<div class="pvp-empty">Error al cargar rivales.</div>'; }
}

async function renderPvPIncoming(){
  const content = document.getElementById('pvp-content');
  try {
    let { data: duels } = await _supabase.from('duelos')
      .select('id,retador_id,apuesta,estado,seed,aciertos_retador,aciertos_retado,ganador_id,fecha_limite,tiempo_retador,tiempo_retado')
      .eq('retado_id', currentUser.id)
      .eq('estado', 'pendiente')
      .order('creado_en', { ascending:false });
    if(!duels || !duels.length){
      content.innerHTML = '<div class="pvp-empty">No tienes retos recibidos.</div>';
      return;
    }
    cerrarDuelosAbandonados(duels, 'retado');
    duels = duels.filter(d => (d.tiempo_retado||0) < 999999);
    if(!duels.length){
      content.innerHTML = '<div class="pvp-empty">No tienes retos recibidos.</div>';
      return;
    }
    const ids = duels.map(d => d.retador_id);
    const { data: us } = await _supabase.from('profiles').select('id,username,avatar_style,current_level').in('id', ids);
    const byId = {}; (us||[]).forEach(u => byId[u.id] = u);
    content.innerHTML = duels.map(d => {
      const u = byId[d.retador_id] || {};
      const label = d.estado === 'jugado' ? (d.ganador_id === currentUser.id ? '🏆 ¡Venciste al retador!' : '💔 El retador venció') : (d.estado === 'no_presentado' ? '⏳ Vencido (perdiste la apuesta)' : '');
      const hours = Math.max(0, Math.ceil((new Date(d.fecha_limite) - new Date()) / 3600000));
      const yaJugue = ((d.aciertos_retado||0) > 0) || ((d.tiempo_retado||0) > 0);
      return `<div class="pvp-card">
        <img src="${getAvatarUrl(u.username||'guest', u.avatar_style)}" class="pvp-card-avatar">
        <div class="pvp-card-info">
          <div class="pvp-card-name">${u.username||'Visitante'} <span style="font-size:.8rem;color:#fff;font-family:'Cinzel',serif;">${label}</span></div>
          <div class="pvp-card-sub">Apuesta ${d.apuesta} <img src="${GITHUB}/florines.svg" class="coin-inline" style="height:.9rem;"> · ${d.estado==='pendiente' ? 'Quedan '+hours+' h para responder' : 'Resuelto'}</div>
        </div>
        <button class="pvp-card-btn" onclick="playDuel('${d.id}', ${d.seed}, 'retado')" ${d.estado!=='pendiente'||yaJugue?'disabled':''}>${d.estado!=='pendiente'?(d.estado==='jugado'?'Terminado':'Expirado'):(yaJugue?((d.tiempo_retado||0)>=999999?'Abandonaste':'Ya jugado'):'Jugar')}</button>
      </div>`;
    }).join('');
  } catch(e){ console.error(e); content.innerHTML = '<div class="pvp-empty">Error al cargar retos recibidos.</div>'; }
}

async function renderPvPOutgoing(){
  const content = document.getElementById('pvp-content');
  try {
    let { data: duels } = await _supabase.from('duelos')
      .select('id,retado_id,apuesta,estado,aciertos_retador,aciertos_retado,ganador_id,fecha_limite,tiempo_retador,tiempo_retado')
      .eq('retador_id', currentUser.id)
      .eq('estado', 'pendiente')
      .order('creado_en', { ascending:false });
    if(!duels || !duels.length){
      content.innerHTML = '<div class="pvp-empty">Aún no has lanzado retos. ¡Desafía a otra casa!</div>';
      return;
    }
    cerrarDuelosAbandonados(duels, 'retador');
    duels = duels.filter(d => (d.tiempo_retador||0) < 999999);
    if(!duels.length){
      content.innerHTML = '<div class="pvp-empty">Aún no has lanzado retos. ¡Desafía a otra casa!</div>';
      return;
    }
    const ids = duels.map(d => d.retado_id);
    const { data: us } = await _supabase.from('profiles').select('id,username,avatar_style,current_level').in('id', ids);
    const byId = {}; (us||[]).forEach(u => byId[u.id] = u);
    content.innerHTML = duels.map(d => {
      const u = byId[d.retado_id] || {};
      let label;
      if(d.estado === 'pendiente') label = 'Esperando respuesta';
      else if(d.estado === 'no_presentado') label = d.ganador_id === currentUser.id ? '🏆 El rival no se presentó' : '⏳ Expirado';
      else label = d.ganador_id === currentUser.id ? '🏆 ¡Ganaste!' : '💔 Perdiste';
const yaJugue = ((d.aciertos_retador||0) > 0) || ((d.tiempo_retador||0) > 0);
      return `<div class="pvp-card">
        <img src="${getAvatarUrl(u.username||'guest', u.avatar_style)}" class="pvp-card-avatar">
        <div class="pvp-card-info">
          <div class="pvp-card-name">${u.username||'Visitante'} <span style="font-size:.8rem;color:#fff;font-family:'Cinzel',serif;">${label}</span></div>
          <div class="pvp-card-sub">Apuesta ${d.apuesta} <img src="${GITHUB}/florines.svg" class="coin-inline" style="height:.9rem;"> · Resultado ${d.aciertos_retador} - ${d.aciertos_retado}</div>
        </div>
        <button class="pvp-card-btn" onclick="playDuel('${d.id}', ${d.seed}, 'retador')" ${d.estado!=='pendiente'||yaJugue?'disabled':''}>${d.estado!=='pendiente'?(d.estado==='jugado'?'Terminado':'Expirado'):(yaJugue?((d.tiempo_retador||0)>=999999?'Abandonaste':'Ya jugado'):'Jugar')}</button>
      </div>`;
    }).join('');
  } catch(e){ console.error(e); content.innerHTML = '<div class="pvp-empty">Error al cargar tus retos.</div>'; }
}

async function challengePlayer(targetId){
  if(!currentUser) return;
  AudioEngine.playClick();
  if(currentCoins < 50){
    showToast('❌ Necesitas 50 florines para retar','tomato');
    return;
  }
  try {
    const seed = Math.floor(Math.random() * 99999) + 1;
    const { error } = await _supabase.from('duelos').insert({
      retador_id: currentUser.id,
      retado_id: targetId,
      seed,
      apuesta: 50,
      fecha_limite: new Date(Date.now() + 24*3600*1000).toISOString()
    });
    if(error) throw error;
    showToast('⚔️ ¡Reto lanzado! El rival tiene 24h para responder','info');
    renderPvPChallengers(); updatePvPBadge();
  } catch(e){
    console.error(e);
    const msg = (e.details || e.message || '')+'\n'+(e.hint || '');
    showToast('❌ '+msg.replace(/new row violates|row-level security policy for table/g,''),'tomato', 6000);
  }
}

let duelState = null;
let duelTimerInterval = null;

// Serie de 3 divisiones para el duelo: divisor 2 cifras, dividendo 5 cifras, siempre con residuo
function generarSerieReto(seed){
  const R = seededRand(seed);
  const rand = (min,max) => Math.floor(R() * (max - min + 1)) + min;
  const serie = [];
  let guard = 0;
  while(serie.length < 3 && guard++ < 500){
    const div = rand(10, 99);
    const q = rand(102, 9999);
    const res = rand(1, div - 1);
    const d = div * q + res;
    if(d >= 10000 && d <= 99999) serie.push({ d, div });
  }
  return serie;
}

function playDuel(duelId, seed, rolInicial){
  AudioEngine.playClick();
  if(duelState){ showToast('❌ Ya tienes un duelo en curso','tomato'); return; }
  const pm = document.getElementById('pvp-modal');
  if(pm) pm.style.display = 'none';
  if(rolInicial){ try{ sessionStorage.setItem('activeDuel', JSON.stringify({ id: duelId, rol: rolInicial })); }catch(e){} }
  (async () => {
    try {
      const { data: duelo } = await _supabase.from('duelos').select('retador_id,retado_id,aciertos_retador,aciertos_retado,tiempo_retador,tiempo_retado').eq('id', duelId).single();
      if(!duelo) return;
      const miLado = duelo.retador_id === currentUser.id;
      const miRol = miLado ? 'retador' : 'retado';
      const ladoHecho = miLado
        ? ((duelo.aciertos_retador||0) > 0 || (duelo.tiempo_retador||0) > 0)
        : ((duelo.aciertos_retado||0) > 0 || (duelo.tiempo_retado||0) > 0);
      if(ladoHecho){
        clearInterval(duelTimerInterval); duelTimerInterval = null;
        if(duelState && duelState.overlay.parentNode) document.body.removeChild(duelState.overlay);
        duelState = null;
        try{ sessionStorage.removeItem('activeDuel'); }catch(e){}
        const pm2 = document.getElementById('pvp-modal');
        if(pm2) pm2.style.display = 'flex';
        showToast('⚔️ Ya jugaste este duelo: cuenta como derrota','info', 4000);
        return;
      }
      if(duelState) duelState.rol = miRol;
      const rivalId = duelo.retador_id === currentUser.id ? duelo.retado_id : duelo.retador_id;
      const { data: rival } = await _supabase.from('profiles').select('username,avatar_style,squad_id,current_level').eq('id', rivalId).single();
      if(!rival || !duelState || !document.getElementById('duel-rival-panel')) return;
      const av = getAvatarUrl(rival.username||'guest', rival.avatar_style||'avatar1');
      const sq = rival.squad_id && SQUADS[rival.squad_id] ? SQUADS[rival.squad_id] : null;
      const sqSrc = sq ? GITHUB+'/'+encodeURI(sq.file) : null;
      document.getElementById('duel-rival-panel').innerHTML = `
        <div style="font-size:.8rem;letter-spacing:2px;color:#9fb3c8;text-transform:uppercase;">Tu rival</div>
        <div style="position:relative;width:185px;height:185px;margin-left:-50px;flex-shrink:0;">
          ${sqSrc ? `<img id="duelRivalCasa" src="${sqSrc}" style="position:absolute;top:50%;left:50%;transform:translate(calc(-50% - 35px), -50%);width:140%;height:140%;object-fit:contain;z-index:1;filter:drop-shadow(0 0 18px rgba(0,0,0,.7));">` : ''}
          <img id="duelRivalAvatar" src="${av}" style="position:absolute;top:50%;left:50%;transform:translate(calc(-50% - 30px), -50%);width:88%;height:88%;object-fit:contain;z-index:2;filter:drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff) drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff) drop-shadow(0 0 12px rgba(0,0,0,.6));">
        </div>
        <div style="text-align:center;max-width:200px;margin-top:30px;">
          <div style="font-family:'Cinzel Decorative',serif;font-size:1.7rem;font-weight:bold;color:${sq?sq.color:'#ffd700'};text-shadow:0 0 12px rgba(0,0,0,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${rival.username||'Guerrero desconocido'}</div>
          <div style="color:${sq?sq.color:'#9fb3c8'};font-size:1.2rem;font-weight:bold;margin-top:4px;">${sq?sq.name:'Sin Casa'}</div>
          <div style="color:#9fb3c8;font-size:1.1rem;font-weight:bold;margin-top:3px;">Nv. ${rival.current_level||1}</div>
        </div>`;
    } catch(e){ console.error('No se pudo cargar el rival:', e); }
  })();
  const TOTAL = 3;
  const serie = generarSerieReto(seed);
  const LIMITE_SEG = 900; // 15 min máximo para las 3

  const overlay = document.createElement('div');
  overlay.id = 'duel-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(5,12,28,0.55);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px;font-family:\'Cinzel\',serif;padding:18px;box-sizing:border-box;overflow-y:auto;';
  const pRival = `<div id="duel-rival-panel" style="display:flex;flex-direction:column;align-items:center;gap:8px;width:200px;">Cargando rival...</div>`;
  const pAntena = `<div class="antena-panel" style="width:240px;margin:0;">
        <div class="antena-header">Sello Real (x <span id="duelAntenaLabel">...</span>)</div>
        <div id="duelAntenaBody"></div>
      </div>`;
  const pCasita = `<div style="flex-shrink:0;width:440px;max-width:calc(100vw - 40px);">
        <div class="division-row" style="flex-direction:row;align-items:flex-start;gap:0;">
          <div class="col-divisor" id="duelDivisorBox" style="margin-left:0;"></div>
          <div class="col-grid" id="duelGridWrapper" style="position:relative;">
            <div class="grid-disabled-overlay" id="duelGridLockOverlay" style="position:absolute;width:auto;height:auto;left:-1;top:-1;"><div class="lock-msg" style="pointer-events:auto;"><i class="fas fa-lock"></i> ¡Rompe el Sello Real!</div></div>
            <div class="fila-cociente-arriba" id="duelTopRow"></div>
            <div class="fila-horizontal-top" id="duelLineH" style="width:auto;"></div>
            <div class="grid-matriz" id="duelGridContainer"></div>
            <div class="fila-residuo" id="duelResiduoRow"><span class="residuo-label">Residuo:</span><input type="number" id="duelValResiduo" class="input-residuo" placeholder="0" autocomplete="off" autocorrect="off" spellcheck="false"></div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:10px;justify-content:flex-end;">
          <input type="hidden" id="duelValCociente">
          <button id="duelBtnVerify" class="btn-primary" onclick="verificarDuelo()">⚔️ Verificar</button>
          <div id="duelMsg" style="color:#aaa;font-size:.9rem;max-width:280px;white-space:normal;line-height:1.35;"></div>
        </div>
      </div>`;
  const filaDuelo = pAntena + '\n' + pCasita + '\n' + pRival;
  overlay.innerHTML = `
    <video id="duel-bg-video" autoplay muted playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;opacity:1;transition:opacity 0.5s ease-in-out;">
      <source src="https://mikettrt-maker.github.io/divisiones-profe/img/video2.mp4" type="video/mp4">
    </video>
    <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);z-index:1;pointer-events:none;"></div>
    <div style="position:absolute;top:16px;right:20px;width:40px;height:40px;border-radius:50%;border:2px solid rgba(201,168,76,0.3);background:none;color:var(--cr-gold);font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:3;" onclick="closeDuel()">✕</div>
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center;position:relative;z-index:2;">
      <div style="color:var(--cr-gold);font-size:1.5rem;text-shadow:0 0 12px rgba(201,168,76,0.5);font-family:'Cinzel Decorative',serif;">⚔️ DUELO ENTRE CASAS</div>
      <div style="color:#9fb3c8;font-size:1rem;">División <span id="duel-q-idx">1</span>/${TOTAL}</div>
      <div id="duel-timer" style="font-size:1.6rem;font-weight:700;color:#4caf50;text-shadow:0 0 10px rgba(76,175,80,0.4);">0:00</div>
    </div>
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;justify-content:center;width:100%;position:relative;z-index:2;">
      ${filaDuelo}
    </div>`;
  document.body.appendChild(overlay);

  // Bucle suave del video (igual que el juego principal)
  (function(){
    const v = document.getElementById('duel-bg-video');
    if(!v) return;
    let fading = false;
    v.addEventListener('timeupdate', () => {
      if(!fading && v.duration && v.currentTime >= v.duration - 1.5){
        fading = true;
        v.style.transition = 'opacity 1.5s ease-in';
        v.style.opacity = '0';
      }
    });
    v.addEventListener('ended', () => {
      fading = false;
      v.currentTime = 0;
      v.play();
      v.style.transition = 'opacity 1.5s ease-in';
      v.style.opacity = '1';
    });
  })();

  let idx = 0, aciertos = 0, segundos = 0, currentAntennaIndex = 0;
  duelState = { duelId, overlay, rol: rolInicial };
  const $ = id => document.getElementById(id);

  // ── Antena (Sello Real) ──
  function createAntena(divisor){
    $('duelAntenaLabel').innerText = divisor;
    const b = $('duelAntenaBody');
    b.innerHTML = '';
    for(let i = 1; i <= 10; i++){
      const r = document.createElement('div'); r.className = 'antena-row locked-row'; r.id = 'duelRow-'+i;
      r.innerHTML = "<span>"+i+" x "+divisor+" =</span><input type='number' inputmode='numeric' pattern='[0-9]*' autocomplete='off' autocorrect='off' spellcheck='false' class='antena-input' id='duelAntena"+i+"' disabled>";
      b.appendChild(r);
    }
    currentAntennaIndex = 0; enableNextAntenna();
  }

  function enableNextAntenna(){
    if(currentAntennaIndex >= ANTENNA_SEQUENCE.length) return;
    const c = ANTENNA_SEQUENCE[currentAntennaIndex];
    const inp = $('duelAntena'+c), row = $('duelRow-'+c);
    if(!inp) return;
    inp.disabled = false; row.classList.remove('locked-row'); inp.focus();
    inp.oninput = e => {
      e.target.value = e.target.value.replace(/[^0-9]/g,'');
      const val = parseInt(e.target.value), exp = c * serie[idx].div;
      if(val === exp){
        inp.classList.add('status-ok'); inp.disabled = true;
        currentAntennaIndex++;
        if(currentAntennaIndex < ANTENNA_SEQUENCE.length) enableNextAntenna(); else unlockHouse();
      } else if(e.target.value.length) {
        inp.classList.add('status-wrong'); setTimeout(() => inp.classList.remove('status-wrong'), 500);
      }
    };
  }

  // ── Casita (grid) ──
  function createHouse(problema){
    const g = $('duelGridContainer'), dB = $('duelDivisorBox'), tR = $('duelTopRow'), div = String(problema.div), d = String(problema.d);
    g.innerHTML = ''; dB.innerHTML = ''; tR.innerHTML = '';
    div.split('').forEach(n => {
      const i = document.createElement('input'); i.type = 'text'; i.className = 'input-div'; i.value = n; i.readOnly = true;
      dB.appendChild(i);
    });
    for(let r = 0; r < 15; r++) for(let c = 0; c < 9; c++){
      const i = document.createElement('input'); i.type = 'text'; i.className = 'cell'; i.maxLength = 1; i.id = 'dc-'+r+'-'+c;
      i.setAttribute('autocomplete','off'); i.setAttribute('autocorrect','off'); i.setAttribute('spellcheck','false');
      i.addEventListener('input', e => {
        if(!duelState.isGridLocked && e.target.value){
          const n = (c < 8) ? 'dc-'+r+'-'+(c+1) : (r < 14) ? 'dc-'+(r+1)+'-0' : null;
          if(n) $(n).focus();
        }
      });
      g.appendChild(i);
    }
    for(let i = 0; i < d.length; i++){
      const cell = $('dc-0-'+i);
      cell.value = d[i]; cell.classList.add('cell-locked'); cell.disabled = true;
    }
    const s = String(problema.d);
    for(let i = 0; i < s.length; i++){
      const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'input-cociente-galera'; inp.maxLength = 1; inp.id = 'top-'+i;
      inp.setAttribute('autocomplete','off'); inp.setAttribute('autocorrect','off'); inp.setAttribute('spellcheck','false');
      inp.addEventListener('input', () => { syncT(); if(inp.value && i < s.length-1) $('top-'+(i+1)).focus(); });
      tR.appendChild(inp);
    }
    $('duelLineH').style.width = (s.length * 33) + 'px';
    duelState.cocLen = s.length;
  }

  function syncT(){
    let v = ''; document.querySelectorAll('#duelTopRow .input-cociente-galera').forEach(x => v += x.value);
    $('duelValCociente').value = v;
  }
  function lockHouse(){
    duelState.isGridLocked = true;
    $('duelGridLockOverlay').classList.remove('hidden');
    document.querySelectorAll('#duelTopRow .input-cociente-galera').forEach(i => i.disabled = true);
    $('duelValResiduo').disabled = true;
    document.querySelectorAll('#duelGridContainer .cell:not(.cell-locked)').forEach(cell => { cell.disabled = true; cell.style.opacity = '0.4'; });
  }
  function unlockHouse(){
    duelState.isGridLocked = false;
    $('duelGridLockOverlay').classList.add('hidden');
    document.querySelectorAll('#duelTopRow .input-cociente-galera').forEach(i => i.disabled = false);
    $('duelValResiduo').disabled = false;
    document.querySelectorAll('#duelGridContainer .cell:not(.cell-locked)').forEach(cell => { cell.disabled = false; cell.style.opacity = '1'; });
    $('duelMsg').innerHTML = '<span style="color:var(--success);">¡Sello Real desbloqueado! Resuelve la división y pulsa Verificar.</span>';
    destelloAvatar();
    AudioEngine.playEpic();
  }

  function destelloAvatar(){
    const img = document.getElementById('duelRivalAvatar');
    if(!img || !img.animate) return;
    try{
      img.animate([
        { transform:'translate(calc(-50% - 30px), -50%) scale(1)', filter:'drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff) drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff) drop-shadow(0 0 6px rgba(0,0,0,.6))' },
        { transform:'translate(calc(-50% - 30px), -50%) scale(1.18)', filter:'drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff) drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff) drop-shadow(0 0 34px rgba(255,215,0,.95))' },
        { transform:'translate(calc(-50% - 30px), -50%) scale(1)', filter:'drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff) drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff) drop-shadow(0 0 6px rgba(0,0,0,.6))' }
      ], { duration: 900, easing: 'ease-out' });
    }catch(e){}
  }

  // ── Verificación ──
  window.verificarDuelo = function(){
    if(!duelState || duelState.isGridLocked){ $('duelMsg').innerHTML = '<span style="color:#ff6b6b;">¡Rompe el Sello Real primero!</span>'; return; }
    const q = serie[idx];
    const coc = parseInt($('duelValCociente').value);
    const res = parseInt($('duelValResiduo').value) || 0;
    const rC = Math.floor(q.d / q.div), rR = q.d % q.div;
    if(coc === rC && res === rR){
      $('duelMsg').innerHTML = '<span style="color:var(--success);">✔ ¡División correcta!</span>';
      AudioEngine.playSuccess();
      destelloAvatar();
      aciertos++;
      setTimeout(() => {
        idx++;
        if(idx >= TOTAL) terminar();
        else startDivision();
      }, 800);
    } else {
      $('duelMsg').innerHTML = '<span style="color:#ff6b6b;">✘ Verificación incorrecta, revisa y reintenta.</span>';
      AudioEngine.playError();
    }
  };

  function startDivision(){
    $('duel-q-idx').textContent = idx + 1;
    $('duelMsg').innerHTML = '';
    const q = serie[idx];
    createAntena(q.div);
    createHouse(q);
    lockHouse();
  }

  function terminar(){
    clearInterval(duelTimerInterval); duelTimerInterval = null;
    const overlay = duelState.overlay;
    overlay.innerHTML = `
      <video id="duel-bg-video" autoplay muted playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;opacity:1;transition:opacity 0.5s ease-in-out;">
        <source src="https://mikettrt-maker.github.io/divisiones-profe/img/video2.mp4" type="video/mp4">
      </video>
      <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);z-index:1;pointer-events:none;"></div>
      <div style="position:absolute;top:16px;right:20px;width:40px;height:40px;border-radius:50%;border:2px solid rgba(201,168,76,0.3);background:none;color:var(--cr-gold);font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:3;" onclick="closeDuel()">✕</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px;position:relative;z-index:2;">
        <div style="color:var(--cr-gold);font-size:1.8rem;text-shadow:0 0 12px rgba(201,168,76,0.5);font-family:'Cinzel Decorative',serif;">🏁 DUELO TERMINADO</div>
        <div style="font-size:1.5rem;color:#fff;font-family:'Cinzel Decorative',serif;">${aciertos} / ${TOTAL} divisiones</div>
        <div style="color:#9fb3c8;font-size:1.1rem;">Tiempo total: ${formatTime(segundos)}</div>
        <button class="pvp-card-btn" style="font-size:1rem;padding:12px 28px;" onclick="submitDuelResult(${aciertos}, ${segundos})">🌙 Guardar resultado</button>
      </div>`;
  }

  window.closeDuel = function(){
    clearInterval(duelTimerInterval); duelTimerInterval = null;
    if(duelState && duelState.duelId){
      abandonarDuelo(duelState.duelId, duelState.rol);
    }
    try{ sessionStorage.removeItem('activeDuel'); }catch(e){}
    if(duelState && duelState.overlay.parentNode) document.body.removeChild(duelState.overlay);
    duelState = null;
    const pm = document.getElementById('pvp-modal');
    if(pm) pm.style.display = 'flex';
  };

  // Reloj: corre durante las 3 divisiones
  duelTimerInterval = setInterval(() => {
    segundos++;
    const t = $('duel-timer');
    if(!t){ clearInterval(duelTimerInterval); return; }
    t.textContent = formatTime(segundos);
    if(segundos >= LIMITE_SEG){ terminar(); }
  }, 1000);

  startDivision();
}

function formatTime(s){
  const m = Math.floor(s / 60), ss = s % 60;
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}

window.submitDuelResult = async function(aciertos, usados){
    if(!duelState) return;
    const btn = duelState.overlay.querySelector('button');
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      const { data: duelo } = await _supabase.from('duelos').select('retador_id,aciertos_retador,aciertos_retado,tiempo_retador,tiempo_retado').eq('id', duelState.duelId).single();
      const esRetador = duelo.retador_id === currentUser.id;
      const patch = esRetador
        ? { aciertos_retador: aciertos, tiempo_retador: usados }
        : { aciertos_retado: aciertos, tiempo_retado: usados };
      const { error } = await _supabase.from('duelos').update(patch).eq('id', duelState.duelId);
      if(error) throw error;
      const { data: after } = await _supabase.from('duelos').select('aciertos_retador,aciertos_retado,tiempo_retador,tiempo_retado,estado').eq('id', duelState.duelId).single();
      const ladoR = (after.aciertos_retador||0) > 0 || (after.tiempo_retador||0) > 0;
      const ladoT = (after.aciertos_retado||0) > 0 || (after.tiempo_retado||0) > 0;
      if(ladoR && ladoT && after.estado === 'pendiente'){
        await _supabase.from('duelos').update({ estado: 'jugado', jugado_en: new Date().toISOString() }).eq('id', duelState.duelId);
      }
      document.body.removeChild(duelState.overlay);
      duelState = null;
      try{ sessionStorage.removeItem('activeDuel'); }catch(e){}
      showToast('⚔️ Resultado guardado. El ganador se decidirá pronto','info');
      const pm = document.getElementById('pvp-modal');
      if(pm) pm.style.display = 'flex';
      switchPvPTab(pvpCurrentTab); updatePvPBadge();
    } catch(e){
      console.error(e);
      btn.disabled = false; btn.textContent = '💾 Guardar resultado';
      showToast('❌ No se pudo guardar: '+e.message,'tomato');
    }
  };

// ── Resolver un duelo abandonado AL INSTANTE (sin esperar el cron) ──
// Quien abandona (tiempo >= 999999) PIERDE: su rival gana la apuesta y el récord V/D.
async function resolverDueloAbandonado(duelId, ladoAbandonado){
  try {
    const { data: d } = await _supabase.from('duelos').select('retador_id,retado_id,apuesta,ganador_id,estado').eq('id', duelId).single();
    if(!d || d.ganador_id || d.estado !== 'jugado') return;
    let ganador = d.retado_id, perdedor = d.retador_id;
    if(ladoAbandonado === 'retador'){ ganador = d.retado_id; perdedor = d.retador_id; }
    else { ganador = d.retador_id; perdedor = d.retado_id; }
    const ap = d.apuesta || 0;
    const { data: pGan } = await _supabase.from('profiles').select('coins,pvp_victorias').eq('id', ganador).single();
    const { data: pPer } = await _supabase.from('profiles').select('coins,pvp_derrotas').eq('id', perdedor).single();
    await _supabase.from('profiles').update({
      coins: (pGan?.coins||0) + (ap * 2),
      pvp_victorias: (pGan?.pvp_victorias||0) + 1
    }).eq('id', ganador);
    await _supabase.from('profiles').update({
      coins: Math.max(0, (pPer?.coins||0) - ap),
      pvp_derrotas: (pPer?.pvp_derrotas||0) + 1
    }).eq('id', perdedor);
    await _supabase.from('duelos').update({ ganador_id: ganador, resuelto_en: new Date().toISOString() }).eq('id', duelId).is('ganador_id', null);
    if(currentUser && ganador === currentUser.id){
      currentCoins = Math.max(0, (pGan?.coins||0) + (ap * 2));
      document.getElementById('coinDisplay').innerText = currentCoins;
    } else if(currentUser && perdedor === currentUser.id){
      currentCoins = Math.max(0, (pPer?.coins||0) - ap);
      document.getElementById('coinDisplay').innerText = currentCoins;
    }
    updateRanking();
  } catch(e){ console.error('Error resolviendo duelo abandonado:', e); }
}

// ── Abandono del duelo: salir o recargar = derrota automática ──
function abandonarDuelo(duelId, rol){
  if(!duelId || !rol || !currentUser) return;
  const patch = { estado: 'jugado', jugado_en: new Date().toISOString() };
  if(rol === 'retador'){ patch.aciertos_retador = 0; patch.tiempo_retador = 999999; }
  else if(rol === 'retado'){ patch.aciertos_retado = 0; patch.tiempo_retado = 999999; }
  else return;
  _supabase.from('duelos').update(patch).eq('id', duelId).then(({ error }) => {
    if(error){ console.error('Error al registrar abandono:', error); return; }
    resolverDueloAbandonado(duelId, rol);
  }).catch(e => console.error('Abandono fallido:', e));
}

// Llamada rápida (REST + keepalive) para pagehide/reload
function abandonarDueloRapido(duelId, rol){
  try{
    if(!duelId || !rol) return;
    const tok = (() => { try{ return JSON.parse(sessionStorage.getItem('sb-uksijdbbcdttspulslzw-auth-token')).access_token; }catch(err){ return null; } })();
    if(!tok) return;
    const patch = {};
    if(rol === 'retador'){ patch.aciertos_retador = 0; patch.tiempo_retador = 999999; }
    else if(rol === 'retado'){ patch.aciertos_retado = 0; patch.tiempo_retado = 999999; }
    else return;
    fetch(SUPABASE_URL + '/rest/v1/duelos?id=eq.' + duelId, {
      method: 'PATCH', keepalive: true,
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(patch)
    });
  }catch(e){}
}

window.addEventListener('pagehide', () => {
  try{
    const a = JSON.parse(sessionStorage.getItem('activeDuel') || 'null');
    if(a && a.id) abandonarDueloRapido(a.id, a.rol);
  }catch(e){}
});

function recuperarDueloAbandonado(){
  try{
    const a = JSON.parse(sessionStorage.getItem('activeDuel') || 'null');
    if(!a || !a.id) return;
    sessionStorage.removeItem('activeDuel');
    abandonarDuelo(a.id, a.rol);
    showToast('⚔️ Saliste de un duelo en curso: cuenta como derrota','info', 4000);
  }catch(e){}
}

setInterval(() => { if(currentUser) updatePvPBadge(); }, 60000);
