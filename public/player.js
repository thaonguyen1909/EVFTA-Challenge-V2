'use strict';
const socket = io();
let state = null;
let currentTeams = [
  { id: 'team_1', name: 'Nhóm 4', icon: '🌾', color: '#e6ad29', groupNumber: 4, memberCount: 0, isFull: false },
  { id: 'team_2', name: 'Nhóm 5', icon: '🤝', color: '#3986e8', groupNumber: 5, memberCount: 0, isFull: false },
  { id: 'team_3', name: 'Nhóm 6', icon: '🚀', color: '#f16575', groupNumber: 6, memberCount: 0, isFull: false },
  { id: 'team_4', name: 'Nhóm 7', icon: '🌿', color: '#39ad77', groupNumber: 7, memberCount: 0, isFull: false },
  { id: 'team_5', name: 'Nhóm 8', icon: '⚡', color: '#9c5de8', groupNumber: 8, memberCount: 0, isFull: false },
  { id: 'team_6', name: 'Nhóm 9', icon: '🎯', color: '#f97316', groupNumber: 9, memberCount: 0, isFull: false }
];
let selectedTeam = 'team_1';
let registrationLocked = false;

const saved = () => { try { return JSON.parse(localStorage.getItem('evfta:player') || 'null'); } catch { return null; } };
const save = (data) => localStorage.setItem('evfta:player', JSON.stringify(data));

const qsCode = new URLSearchParams(location.search).get('room');
if (qsCode) $('#roomCode').value = qsCode;

function showMessage(msg) { $('#joinError').textContent = msg || ''; }

function renderPicker(teams = currentTeams) {
  currentTeams = teams;
  const maxPerTeam = 6;

  // If selected team is now full, try to pick first non-full team
  const currentSel = currentTeams.find(t => t.id === selectedTeam);
  if (currentSel && currentSel.memberCount >= maxPerTeam) {
    const available = currentTeams.find(t => (t.memberCount || 0) < maxPerTeam);
    if (available) selectedTeam = available.id;
  }

  $('#teamPicker').innerHTML = currentTeams.map(t => {
    const mem = t.memberCount || 0;
    const isFull = mem >= maxPerTeam;
    const isSelected = selectedTeam === t.id;
    let badgeText = `${mem}/${maxPerTeam} thành viên`;
    let subStatus = 'Còn chỗ';
    if (isFull) {
      subStatus = 'Đã đầy';
    } else if (mem === maxPerTeam - 1) {
      subStatus = 'Còn 1 chỗ';
    }

    return `
      <button type="button" class="pick-card ${isSelected ? 'selected' : ''} ${isFull ? 'card-full' : ''}" data-team="${esc(t.id)}" style="--team:${esc(t.color)}">
        <span class="pick-icon">${esc(t.icon)}</span>
        <span class="pick-text">
          <strong>${esc(t.name)}</strong>
          <small class="pick-capacity ${isFull ? 'cap-full' : mem === maxPerTeam - 1 ? 'cap-warning' : ''}">${badgeText} • ${subStatus}</small>
        </span>
        <span class="radio-circle">${isFull ? '✕' : ''}</span>
      </button>
    `;
  }).join('');

  $$('[data-team]', $('#teamPicker')).forEach(btn => btn.addEventListener('click', () => {
    const teamId = btn.dataset.team;
    const target = currentTeams.find(t => t.id === teamId);
    if (target && (target.memberCount || 0) >= maxPerTeam) {
      showMessage('Đội đã đủ 6 thành viên. Vui lòng chọn đội khác.');
      return;
    }
    selectedTeam = teamId;
    showMessage('');
    renderPicker(currentTeams);
  }));

  if (registrationLocked) {
    showMessage('🔒 Host đã khóa đăng ký tham gia.');
    $('#joinBtn').disabled = true;
  } else {
    $('#joinBtn').disabled = false;
  }
}

function peekRoom() {
  const code = $('#roomCode').value.trim();
  if (!/^\d{6}$/.test(code)) return;
  socket.emit('room:peek', { code }, r => {
    if (r.ok) {
      registrationLocked = !!r.registrationLocked;
      renderPicker(r.teams);
      $('#capacityHint').textContent = `Tổng: ${r.totalMembers || 0}/${r.totalCapacity || 36} sinh viên (Tối đa 6 người/đội)`;
    } else {
      showMessage(r.error);
    }
  });
}

$('#roomCode').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  if (e.target.value.length === 6) peekRoom();
});

function join(credential = null) {
  const code = $('#roomCode').value.trim(), name = $('#nickname').value.trim();
  if (!/^\d{6}$/.test(code)) return showMessage('Mã phòng phải gồm 6 chữ số.');
  if (!credential && name.length < 2) return showMessage('Vui lòng nhập họ tên sinh viên ít nhất 2 ký tự.');

  if (!credential) {
    const targetTeam = currentTeams.find(t => t.id === selectedTeam);
    if (targetTeam && (targetTeam.memberCount || 0) >= 6) {
      return showMessage('Đội đã đủ 6 thành viên. Vui lòng chọn đội khác.');
    }
  }

  $('#joinBtn').disabled = true;
  socket.emit('player:join', { code, name, team: selectedTeam, credential }, r => {
    $('#joinBtn').disabled = false;
    if (!r.ok) {
      showMessage(r.error);
      if (credential) localStorage.removeItem('evfta:player');
      return;
    }
    showMessage('');
    save({ code: r.code, credential: r.credential, name: r.name, team: r.team });
    $('#joinSection').hidden = true;
    $('#gameSection').hidden = false;
  });
}

$('#joinBtn').addEventListener('click', () => join());
$('#leaveBtn').addEventListener('click', () => {
  if (!confirm('Rời đội hiện tại để chọn đội khác? Bạn sẽ nhường lại vị trí cho bạn khác.')) return;
  socket.emit('player:leave', {}, r => {
    if (!r.ok) return alert(r.error);
    localStorage.removeItem('evfta:player');
    location.href = '/play';
  });
});

socket.on('player:kicked', data => {
  alert(data?.reason || 'Bạn đã bị xóa khỏi phòng.');
  localStorage.removeItem('evfta:player');
  location.href = '/play';
});

socket.on('connect', () => {
  setNet(true);
  const old = saved();
  if (old) {
    $('#roomCode').value = old.code;
    $('#nickname').value = old.name;
    selectedTeam = old.team;
    join(old.credential);
  } else if ($('#roomCode').value.length === 6) {
    peekRoom();
  }
});
socket.on('disconnect', () => setNet(false));

socket.on('room:state', s => {
  state = s;
  window.serverOffset = Date.now() - s.serverNow;
  registrationLocked = !!s.registrationLocked;
  if (!s.me) {
    renderPicker(s.teams);
    return;
  }
  render();
});

function render() {
  if (!state) return;
  $('#joinSection').hidden = true;
  $('#gameSection').hidden = false;
  $('.player-intro').hidden = true;
  $('#leaveBtn').hidden = state.status !== 'lobby';

  const myTeam = state.teams.find(t => t.id === state.me.team) || state.teams[0];
  $('#playerRoom').textContent = `PHÒNG ${state.code} · ${statusText(state.status)}`;
  $('#playerTeamTitle').textContent = `${myTeam.icon} ${myTeam.name} (${myTeam.memberCount}/${myTeam.maxMembers || 6} người)`;
  $('#playerName').textContent = `Người chơi: ${state.me.name}`;
  $('#playerCash').textContent = `${fmt(myTeam.cash)} xu`;

  $('#playerScores').innerHTML = teamRows(state);
  $('#playerStages').innerHTML = stageList(state, true);

  const box = $('#playerChallenge');
  if (state.status === 'lobby') {
    box.innerHTML = `
      <div class="empty-state">
        <div class="emoji">⌛</div>
        <h2>Đã vào ${esc(myTeam.name)}!</h2>
        <p>Đội bạn có <b>${myTeam.memberCount}/${myTeam.maxMembers || 6}</b> thành viên. Toàn phòng có <b>${state.teams.reduce((a, t) => a + t.memberCount, 0)}/36</b> sinh viên.</p>
        <p class="tip">Quy tắc công bằng: Đội 3, 4, 5 hoặc 6 người đều thi đấu như nhau. Điểm và vốn tính theo quyết định đa số của đội, không nhân theo sĩ số.</p>
      </div>
    `;
    return;
  }
  if (state.status === 'finished') {
    const rank = [...state.teams].filter(t => t.active).sort((a, b) => b.projectedProfit - a.projectedProfit || b.cash - a.cash);
    box.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🏆</div>
        <h2>Đã cập cảng châu Âu!</h2>
        <p>Đội chiến thắng: <b>${esc(rank[0]?.icon || '')} ${esc(rank[0]?.name || 'Chưa có đội')}</b> với lợi nhuận <b>${fmt(rank[0]?.projectedProfit || 0)} xu</b>.</p>
        <p>Host có thể chọn "Chơi lại" để mở ván mới.</p>
      </div>
    `;
    return;
  }

  const step = state.step, currentVote = state.me.vote;
  const review = state.status === 'review';
  const currentTeamResult = state.result?.summaries.find(r => r.team === state.me.team);

  box.innerHTML = `
    <div class="step-head">
      <span class="step-badge">${esc(step.icon)} Ải ${step.stageIndex + 1}/5 · ${esc(stepLabel(step))}</span>
      <span class="timer-inline" data-timer>${review ? 'Đã chốt' : '-- giây'}</span>
    </div>
    <h2>${esc(step.title)}${step.questionNo ? ` <small>Câu ${step.questionNo}/${step.questionTotal}</small>` : ''}</h2>
    ${step.prompt ? `<div class="question-prompt">${esc(step.prompt)}</div>` : `<p class="step-description">${esc(step.description)}</p>`}
    ${step.kind === 'auction' ? `<p class="question-help">🔒 Đấu giá kín: giá đặt của đội chỉ được công bố sau khi tất cả đã bỏ phiếu xong.</p>` : ''}
    <div class="options-vote">
      ${step.options.map((o, i) => `
        <button type="button" class="vote-option ${currentVote === i ? 'active' : ''}" data-choice="${i}" ${review ? 'disabled' : ''}>
          <span class="option-letter">${step.kind === 'quiz' || step.kind === 'brandquiz' ? 'ABCD'[i] : i}</span>
          <span><strong>${esc(o.label)}</strong>${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</span>
          ${currentVote === i ? '✅' : ''}
        </button>
      `).join('')}
    </div>
    ${review ? `
      <div class="vote-confirm">🔒 Lượt đã đóng. ${currentTeamResult ? `Đội bạn: ${esc(currentTeamResult.note)}` : 'Chưa có kết quả cho đội.'}</div>
      ${step.correct !== undefined ? `<div class="explain">✅ Đáp án đúng: ${'ABCD'[step.correct]} — ${esc(step.explanation)}</div>` : ''}
      ${resultInfo(state)}
      <p class="question-help">Chờ host bắt đầu thử thách tiếp theo.</p>
    ` : currentVote !== null ? `
      <div class="vote-confirm">✅ Bạn đã bình chọn. Có thể đổi lựa chọn trước khi hết giờ.</div>
    ` : `
      <p class="question-help">🗳️ Chọn một đáp án/chiến lược. Quyết định của đội được xác định theo đa số phiếu.</p>
    `}
  `;

  if (!review) {
    $$('[data-choice]', box).forEach(btn => btn.addEventListener('click', () => {
      socket.emit('player:vote', { choice: Number(btn.dataset.choice) }, r => {
        if (!r.ok) alert(r.error);
      });
    }));
  }
}

setInterval(() => {
  if (!state || state.status !== 'running') return;
  const t = voteElapsed(state);
  $$('[data-timer]').forEach(el => el.textContent = `⏱ ${t} giây`);
}, 250);

renderPicker();
