'use strict';
const socket = io();
let state = null;
const room = new URLSearchParams(location.search).get('room') || prompt('Nhập mã phòng 6 chữ số để trình chiếu:') || '';
$('#projectRoom').textContent = `Mã phòng: ${room}`;

socket.on('connect', () => {
  setNet(true);
  socket.emit('room:watch', { code: room }, r => {
    if (!r.ok) {
      $('#missionCard').innerHTML = `<div class="empty-state"><h2>⚠️ ${esc(r.error)}</h2><p>Vui lòng mở màn hình trình chiếu từ trang host.</p></div>`;
    }
  });
});
socket.on('disconnect', () => setNet(false));

socket.on('room:state', s => {
  state = s;
  window.serverOffset = Date.now() - s.serverNow;
  renderScreen();
});

function renderScreen() {
  if (!state) return;
  const totalMem = state.teams.reduce((n, t) => n + t.memberCount, 0);
  const maxCap = state.totalCapacity || 36;
  const locked = !!state.registrationLocked;

  $('#projectRoom').textContent = `Mã phòng: ${state.code} • ${totalMem}/${maxCap} người ${locked ? '(Đã khóa)' : ''}`;
  $('#projectionTitle').textContent = state.subtitle;
  $('#currentRound').textContent = state.step ? `Ải ${state.step.stageIndex + 1}/5 • ${state.step.title}` : statusText(state.status);
  $('#shipMap').innerHTML = shipMap(state);
  $('#progressStages').innerHTML = stageList(state);
  $('#missionCard').innerHTML = stepCard(state);
  $('#bigScores').innerHTML = teamRows(state, { large: true });
  $('#voteProgress').innerHTML = progressVotes(state);
  $('#joinQrText').innerHTML = `📱 Vào phòng: <b>${esc(location.origin)}/play?room=${esc(state.code)}</b><br>📌 Mã: <b>${esc(state.code)}</b> • 6 đội (Nhóm 4–10) • ${totalMem}/${maxCap} sinh viên`;
  $('#screenTimer').textContent = state.status === 'running' ? `${voteElapsed(state)}s` : state.status === 'finished' ? '🏆' : '--';
}

setInterval(() => {
  if (!state || state.status !== 'running') return;
  const remain = voteElapsed(state);
  $('#screenTimer').textContent = `${remain}s`;
  $$('[data-timer]').forEach(x => x.textContent = `⏱ ${remain} giây`);
}, 250);
