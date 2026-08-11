let selectedGiftAmount = 0;
let selectedIds = new Set();

// ── Agregar decretos/misiones desde administrador ──
async function addMission() {
  const name = document.getElementById('mission-name').value;
  const type = document.getElementById('mission-type').value;
  const goal = parseInt(document.getElementById('mission-goal').value);
  const reward = parseInt(document.getElementById('mission-reward').value);
  if(!name || !goal || !reward) return alert("Completa todos los campos");
  try {
    await _supabase.from('squad_missions').insert({ name, type, goal, reward, is_active: true });
    document.getElementById('mission-name').value = '';
    document.getElementById('mission-goal').value = '';
    document.getElementById('mission-reward').value = '';
    loadAdminMissions();
    showToast("✅ Decreto proclamado", 'success');
  } catch(e) { alert("Error: "+e.message); }
}

// ── Borrar misiones desde administrador ──
async function deleteMission(id) {
  if(!confirm("¿Anular este decreto?")) return;
  await _supabase.from('squad_missions').delete().eq('id', id);
  loadAdminMissions();
}

// ── Cargar listado de decretos en el admin dashboard ──
async function loadAdminMissions() {
  const container = document.getElementById('admin-mission-list');
  const { data: missions } = await _supabase.from('squad_missions').select('*').order('created_at', {ascending: false});
  if(!missions || missions.length === 0) { container.innerHTML = '<p style="color:#666; font-size:.8rem;font-family:\'Cinzel\',serif;">No hay decretos creados.</p>'; return; }
  container.innerHTML = missions.map(m => `<div class="mission-list-item"><div><strong>${m.name}</strong><br><small style="color:#aaa;">Meta: ${m.goal} ${m.type} | Recompensa: ${m.reward} <img src="${GITHUB}/florines.svg" class="coin-inline"></small></div><button class="mission-delete-btn" onclick="deleteMission('${m.id}')"><i class="fas fa-trash"></i></button></div>`).join('');
}

// ── Mostrar dashboard del administrador ──
function showAdminDashboard(){
  document.getElementById('game-layout').style.display = 'none';
  document.getElementById('top-bar-panel').style.display = 'none';
  document.getElementById('admin-dashboard').style.display = 'flex';
  document.body.classList.add('admin-mode');
  loadDashboardData();
  loadAdminMissions();
  setInterval(loadDashboardData, 5000);
}

// ── Alternar visibilidad de consola/salir del admin ──
function toggleAdminDashboard(){
  if(document.getElementById('admin-dashboard').style.display === 'flex'){ logout(); }
  else { showAdminDashboard(); }
}

// ── Cargar datos globales de alumnos para el administrador ──
async function loadDashboardData(){
  const grid = document.getElementById('student-grid');
  try {
    const { data: settings } = await _supabase.from('game_settings').select('*').single();
    updateControlButtons(settings); initSeason(settings);
    const { data: students, error } = await _supabase.from('profiles').select('*').order('total_score',{ascending:false});
    if(error) throw error;
    const now = new Date();
    let ss = {}; Object.keys(SQUADS).forEach(id => ss[id] = {count:0, score:0});
    students.forEach(u => { if(u.squad_id && ss[u.squad_id]){ ss[u.squad_id].count++; ss[u.squad_id].score += (u.total_score||0); } });
    document.getElementById('squad-admin-tbody').innerHTML = Object.entries(ss).map(([id,st]) => {
      const sq = SQUADS[id];
      return `<tr><td class="shield-cell"><div>${sq.svg}</div></td><td style="color:${sq.color};">${sq.name}</td><td>${st.count}</td><td class="points-cell">${st.score}</td></tr>`;
    }).join('');
    initBulkSquadSelect();
    grid.innerHTML = students.map(u => {
      const isOnline = u.last_seen && (now - new Date(u.last_seen) < 30000), isBanned = u.is_banned;
      const mins = u.total_time_played ? Math.floor(u.total_time_played/60) : 0;
      const secs = u.total_time_played ? u.total_time_played%60 : 0;
      let sqOpts = `<option value="0" ${u.squad_id==0?'selected':''}>Sin Casa</option>`;
      Object.entries(SQUADS).forEach(([id,s]) => { sqOpts += `<option value="${id}" ${u.squad_id==id?'selected':''}>${s.name}</option>`; });
      const chk = selectedIds.has(u.id) ? 'checked' : '';
      return `<div class="admin-row ${isBanned?'row-banned':''}">
        <label class="admin-check"><input type="checkbox" class="student-chk" data-id="${u.id}" ${chk} onchange="toggleSelectStudent('${u.id}', this.checked)"></label>
        <div class="admin-user"><img src="${getAvatarUrl(u.username||'guest',u.avatar_style)}" class="sc-avatar"><div class="sc-info"><div class="sc-name">${u.username}</div><div class="sc-status"><span class="status-dot ${isOnline&&!isBanned?'online':''}"></span>${isBanned?'Desterrado':(isOnline?'En la corte':'Offline')}</div></div></div>
        <div class="admin-squad"><select class="squad-select-admin" onchange="assignSquad('${u.id}',this.value)">${sqOpts}</select></div>
        <div class="admin-stat">Florines<br><span>${u.total_score||0}</span></div>
        <div class="admin-stat">Nivel<br><span>${u.current_level||1}</span></div>
        <div class="admin-stat">Tiempo<br><span>${mins}m ${secs}s</span></div>
        <div class="admin-actions"><button class="sc-btn ban ${isBanned?'active':''}" onclick="toggleBan('${u.id}',${isBanned})">${isBanned?'Perdonar':'Desterrar'}</button><button class="sc-btn delete" onclick="deleteUser('${u.id}','${u.username}')">Borrar</button></div>
      </div>`;
    }).join('');
    document.getElementById('student-count').innerText = students.filter(u => (now - new Date(u.last_seen) < 30000) && !u.is_banned).length + " en la corte";
  } catch(e){ grid.innerHTML = "Error al cargar datos"; }
}

// ── Actualizar interfaz de botones de control del maestro ──
function updateControlButtons(settings){
  const pb = document.getElementById('btn-pause'), eb = document.getElementById('btn-exam');
  if(settings){
    if(settings.is_paused){ pb.classList.add('active'); pb.querySelector('span').innerText = "Reanudar"; }
    else { pb.classList.remove('active'); pb.querySelector('span').innerText = "Pausar Juego"; }
    if(settings.exam_level > 0){ eb.classList.add('active'); eb.querySelector('span').innerText = "Fin Examen"; }
    else { eb.classList.remove('active'); eb.querySelector('span').innerText = "Modo Examen"; }
  }
}

// ── Pausar/Reanudar juego global ──
async function togglePause(){
  const { data: s } = await _supabase.from('game_settings').select('is_paused').single();
  await _supabase.from('game_settings').update({is_paused: !s.is_paused}).eq('id',1);
  loadDashboardData();
}

// ── Activar/Desactivar modo examen global ──
async function toggleExamMode(){
  const { data: s } = await _supabase.from('game_settings').select('exam_level').single();
  const nl = s.exam_level > 0 ? 0 : 1;
  await _supabase.from('game_settings').update({exam_level: nl, is_paused: false}).eq('id',1);
  loadDashboardData();
}

// ── Diálogo de inicio de temporada ──
function showSeasonModal(){ const h = prompt("Horas:","0"), m = prompt("Minutos:","0"); if(h||m) startSeason(parseInt(h),parseInt(m)); }

// ── Iniciar nueva temporada ──
async function startSeason(h,m){
  if(h===0 && m===0) return alert("Ingresa tiempo.");
  const end = new Date(Date.now() + h*3600000 + m*60000);
  const { data: s } = await _supabase.from('game_settings').select('season_number').single();
  const ns = (s?.season_number||0) + 1;
  const { data: existing } = await _supabase.from('game_settings').select('id').eq('id',1).maybeSingle();
  if(existing) {
    await _supabase.from('game_settings').update({season_end_time: end.toISOString(), is_paused: false, exam_level: 0, season_number: ns}).eq('id',1);
  } else {
    await _supabase.from('game_settings').insert({ id: 1, season_end_time: end.toISOString(), is_paused: false, exam_level: 0, season_number: ns });
  }
  initSeason({ season_end_time: end.toISOString(), season_number: ns });
  alert("¡Temporada "+ns+" iniciada!"); loadDashboardData();
}

// ── Desterrar/Perdonar alumno ──
async function toggleBan(uid, cur){ try { await _supabase.from('profiles').update({is_banned: !cur}).eq('id',uid); loadDashboardData(); } catch(e){ alert("Error"); } }

// ── Limpiar perfiles vacíos (puntuación 0) ──
async function cleanInactiveUsers(){
  if(!confirm("¿Borrar cuentas con 0 puntos?")) return;
  try { await _supabase.from('profiles').delete().eq('total_score',0).neq('username',ADMIN_USER); alert("Limpieza completada."); loadDashboardData(); }
  catch(e){ alert("Error: "+e.message); }
}

// ── Eliminar estudiante permanentemente ──
async function deleteUser(uid, name){
  if(!confirm(`¿Borrar "${name}" permanentemente?`)) return;
  try {
    const { data, error } = await _supabase.rpc('delete_user', { uid });
    if(error) throw error;
    if(data === 'es_admin'){ alert('No puedes borrar la cuenta del Maestre.'); return; }
    if(data === 'no_existe'){ alert('La cuenta ya no existe.'); return; }
    showToast(`🗑️ ${name} eliminado.`, 'success');
    loadDashboardData();
  } catch(e){ alert("Error: "+e.message); console.error(e); }
}

// ── Reiniciar todos los alumnos de la clase ──
async function resetAllUsers(){
  if(!confirm("¿Reiniciar TODOS los puntos y tiempo?")) return;
  try {
    const { error } = await _supabase.rpc('reset_all_students');
    if (error) throw error;
    alert("¡Todos los estudiantes han sido reiniciados!");
    loadDashboardData();
  } catch(e) {
    alert("Error al reiniciar: " + e.message);
    console.error(e);
  }
}

// ── Asignar casa/squad a estudiante ──
async function assignSquad(uid, sqId){ try { await _supabase.from('profiles').update({squad_id: sqId}).eq('id',uid); loadDashboardData(); } catch(e){ alert("Error"); } }

// ── Selección múltiple en bloque ──
function initBulkSquadSelect(){
  const sel = document.getElementById('bulk-squad-sel');
  if(!sel || sel.dataset.done) return;
  sel.dataset.done = '1';
  let h = '<option value="">Asignar casa...</option><option value="0">Sin Casa</option>';
  Object.entries(SQUADS).forEach(([id,s]) => { h += `<option value="${id}">${s.name}</option>`; });
  sel.innerHTML = h;
}

function toggleSelectStudent(uid, on){ if(on) selectedIds.add(uid); else selectedIds.delete(uid); updateBulkBar(); }
function toggleSelectAll(on){
  selectedIds.clear();
  document.querySelectorAll('.student-chk').forEach(c => { c.checked = on; if(on) selectedIds.add(c.dataset.id); });
  updateBulkBar();
}
function clearSelection(){ selectedIds.clear(); document.querySelectorAll('.student-chk').forEach(c => c.checked = false); updateBulkBar(); }

function updateBulkBar(){
  const n = selectedIds.size;
  const c = document.getElementById('bulk-count');
  if(c) c.innerText = n + ' seleccionado' + (n===1?'':'s');
  const bb = document.getElementById('bulk-ban-btn'), bu = document.getElementById('bulk-unban-btn'), bd = document.getElementById('bulk-del-btn');
  if(bb) bb.innerText = `⛔ Desterrar (${n})`;
  if(bu) bu.innerText = `🙏 Perdonar (${n})`;
  if(bd) bd.innerText = `🗑️ Borrar (${n})`;
}

async function bulkDelete(){
  const n = selectedIds.size;
  if(!n) return alert('Selecciona al menos un jugador.');
  if(!confirm(`¿Borrar ${n} cuenta(s) permanentemente?`)) return;
  let ok = 0;
  for(const uid of selectedIds){
    const { error } = await _supabase.rpc('delete_user', { uid });
    if(!error) ok++; else console.error('delete_user falló:', uid, error);
  }
  clearSelection(); loadDashboardData();
  showToast(`🗑️ ${ok} cuenta(s) eliminada(s).`, ok ? 'success' : 'tomato');
}

async function bulkBan(){
  const n = selectedIds.size;
  if(!n) return alert('Selecciona al menos un jugador.');
  if(!confirm(`¿Desterrar ${n} jugador(es)?`)) return;
  for(const uid of selectedIds){ await _supabase.from('profiles').update({is_banned: true}).eq('id', uid); }
  clearSelection(); loadDashboardData();
  showToast('⛔ Jugadores desterrados.', 'success');
}

async function bulkUnban(){
  const n = selectedIds.size;
  if(!n) return alert('Selecciona al menos un jugador.');
  for(const uid of selectedIds){ await _supabase.from('profiles').update({is_banned: false}).eq('id', uid); }
  clearSelection(); loadDashboardData();
  showToast('🙏 Jugadores perdonados.', 'success');
}

async function bulkAssignSquad(sqId){
  if(!sqId) return;
  const n = selectedIds.size;
  if(!n){ document.getElementById('bulk-squad-sel').value = ''; return alert('Selecciona al menos un jugador.'); }
  for(const uid of selectedIds){ await _supabase.from('profiles').update({squad_id: parseInt(sqId)}).eq('id', uid); }
  document.getElementById('bulk-squad-sel').value = '';
  clearSelection(); loadDashboardData();
  showToast('🏰 Casa asignada en bloque.', 'success');
}

// ── Abrir modal de ofrenda/regalo del maestro ──
function openGiftModal() {
  document.getElementById('gift-modal').style.display = 'flex';
  document.getElementById('gift-amount-display').innerText = 'Selecciona una cantidad';
  selectedGiftAmount = 0;
  const sel = document.getElementById('gift-recipient');
  sel.innerHTML = '<option value="all">👥 Todos los aspirantes</option>';
  _supabase.from('profiles').select('id,username').eq('is_banned', false).is('completed_at', null).order('username').then(({data}) => {
    if(data) data.forEach(u => { sel.innerHTML += `<option value="${u.id}">👤 ${u.username}</option>`; });
  });
}

// ── Cerrar modal de ofrenda ──
function closeGiftModal() { document.getElementById('gift-modal').style.display = 'none'; }

// ── Seleccionar cantidad de ofrenda ──
function selectGiftAmount(amt) {
  selectedGiftAmount = amt;
  document.getElementById('gift-amount-display').innerHTML = `Cantidad seleccionada: ${amt} <img src="${GITHUB}/florines.svg" class="coin-inline">`;
}

// ── Enviar ofrenda de monedas ──
async function executeGift() {
  if(selectedGiftAmount <= 0) return alert('Selecciona una cantidad primero.');
  const recipient = document.getElementById('gift-recipient').value;
  const targetName = recipient === 'all' ? 'todos los aspirantes' : document.getElementById('gift-recipient').selectedOptions[0].text;
  if(!confirm(`¿Enviar ${selectedGiftAmount} florines a ${targetName}?`)) return;
  try {
    let query = _supabase.from('profiles');
    if(recipient === 'all') { query = query.update({ pending_gift_coins: selectedGiftAmount }).eq('is_banned', false).neq('username', ADMIN_USER); }
    else { query = query.update({ pending_gift_coins: selectedGiftAmount }).eq('id', recipient); }
    const { error } = await query;
    if(error) throw error;
    showToast(`🎁 ¡Ofrenda de ${selectedGiftAmount} florines enviada!`, 'success');
    closeGiftModal();
  } catch(e) { alert('Error: ' + e.message); }
}
