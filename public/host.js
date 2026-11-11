'use strict';
const socket = io();
let state = null, working = null, dirty = false, activeStage = -1, activeQuestion = 0, activeTab = 'teamsConfig', roomCode = null, hostPw = '';
let selectedGroups = new Set([4, 5, 6, 7, 8, 9]);

const GROUP_DEFS = {
  4: { name: 'Nhóm 4', icon: '🌾', color: '#e6ad29' },
  5: { name: 'Nhóm 5', icon: '🤝', color: '#3986e8' },
  6: { name: 'Nhóm 6', icon: '🚀', color: '#f16575' },
  7: { name: 'Nhóm 7', icon: '🌿', color: '#39ad77' },
  8: { name: 'Nhóm 8', icon: '⚡', color: '#9c5de8' },
  9: { name: 'Nhóm 9', icon: '🎯', color: '#f97316' },
  10: { name: 'Nhóm 10', icon: '🚢', color: '#0ea5e9' }
};

const setNotice = (s) => { $('#hostNotice').textContent = s || ''; };
const setAuthError = (s) => { $('#authError').textContent = s || ''; };
const updateDirty = () => { dirty = true; $('#dirtyBadge').hidden = false; };
const hostSession = () => { try { return JSON.parse(sessionStorage.getItem('evfta:host') || 'null'); } catch { return null; } };

function attach(code, pw) {
  socket.emit('host:attach', { code, password: pw }, r => {
    if (!r.ok) {
      setAuthError(r.error);
      sessionStorage.removeItem('evfta:host');
      $('#hostAuth').hidden = false;
      $('#hostWorkspace').hidden = true;
    } else {
      onAuth(r.code, pw);
    }
  });
}

function onAuth(code, pw) {
  roomCode = code;
  hostPw = pw;
  sessionStorage.setItem('evfta:host', JSON.stringify({ code, password: pw }));
  $('#hostAuth').hidden = true;
  $('#hostWorkspace').hidden = false;
  $('#hostCode').textContent = code;
  setAuthError('');
}

$('#newRoom').addEventListener('click', () => {
  const pw = $('#hostPassword').value;
  if (!pw) return setAuthError('Vui lòng nhập mật khẩu host.');
  socket.emit('host:create', { password: pw }, r => {
    if (!r.ok) return setAuthError(r.error);
    working = null;
    dirty = false;
    onAuth(r.code, pw);
  });
});

$('#attachRoom').addEventListener('click', () => {
  const pw = $('#hostPassword').value, code = $('#oldRoom').value.trim();
  if (!pw || !/^\d{6}$/.test(code)) return setAuthError('Nhập mật khẩu và mã phòng gồm 6 chữ số.');
  attach(code, pw);
});

socket.on('connect', () => {
  setNet(true);
  const sess = hostSession();
  if (sess) attach(sess.code, sess.password);
});
socket.on('disconnect', () => setNet(false));

socket.on('host:replaced', () => {
  sessionStorage.removeItem('evfta:host');
  $('#hostAuth').hidden = false;
  $('#hostWorkspace').hidden = true;
  setAuthError('Một host khác đã tiếp quản phòng.');
});

socket.on('room:state', s => {
  if (s.role !== 'host') return;
  state = s;
  window.serverOffset = Date.now() - s.serverNow;
  onAuth(s.code, hostPw || hostSession()?.password);

  if (s.selectedGroupNumbers && Array.isArray(s.selectedGroupNumbers)) {
    selectedGroups = new Set(s.selectedGroupNumbers);
  } else if (s.teams) {
    selectedGroups = new Set(s.teams.map(t => t.groupNumber).filter(Boolean));
  }

  if (!working || !dirty) {
    working = JSON.parse(JSON.stringify(s.config));
    dirty = false;
  }

  renderMonitor();
  renderTeamsConfig();
  renderStageNav();
  if (activeTab === 'editor' && !document.activeElement?.closest('#editorBody')) renderEditor();
});

function action(name) {
  socket.emit(name, {}, r => {
    if (!r.ok) setNotice(`⚠️ ${r.error}`);
    else setNotice('');
  });
}

$('#nextBtn').addEventListener('click', () => action('host:next'));
$('#closeBtn').addEventListener('click', () => action('host:close'));
$('#resetBtn').addEventListener('click', () => {
  if (confirm('Chơi lại sẽ xóa toàn bộ kết quả, phiếu bầu và vốn trong trận. Bạn có chắc?')) {
    dirty = false;
    action('host:reset');
  }
});

function toggleRegistrationLock() {
  socket.emit('host:toggle-lock', {}, r => {
    if (!r.ok) setNotice(`⚠️ ${r.error}`);
    else setNotice(r.locked ? '🔒 Đã khóa đăng ký thành viên mới.' : '🔓 Đã mở cho người chơi tham gia.');
  });
}
$('#toggleLockBtn').addEventListener('click', toggleRegistrationLock);
$('#lockToggleBtn2').addEventListener('click', toggleRegistrationLock);

$('#screenBtn').addEventListener('click', () => {
  if (!roomCode) return;
  window.open(`/screen?room=${roomCode}`, '_blank', 'noopener');
});

$('#playerLinkBtn').addEventListener('click', async () => {
  const url = `${location.origin}/play?room=${roomCode}`;
  try {
    await navigator.clipboard.writeText(url);
    setNotice('✅ Đã sao chép link tham gia: ' + url);
  } catch {
    prompt('Sao chép link tham gia:', url);
  }
});

$('#copyCode').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    setNotice('✅ Đã sao chép mã phòng.');
  } catch {
    prompt('Mã phòng:', roomCode);
  }
});

$$('[data-tab]').forEach(b => b.addEventListener('click', () => {
  activeTab = b.dataset.tab;
  $$('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
  $('#teamsConfigTab').hidden = activeTab !== 'teamsConfig';
  $('#editTab').hidden = activeTab !== 'editor';
  $('#controlTab').hidden = activeTab !== 'control';
  if (activeTab === 'teamsConfig') renderTeamsConfig();
  else if (activeTab === 'editor') renderEditor();
  else renderMonitor();
}));

function renderTeamsConfig() {
  if (!state) return;
  const isLobby = state.status === 'lobby';
  const totalMem = state.teams.reduce((n, t) => n + t.memberCount, 0);
  const maxCap = state.totalCapacity || 36;
  const locked = !!state.registrationLocked;

  $('#cfgTotalMembers').textContent = `${totalMem} / ${maxCap} sinh viên`;
  $('#cfgSelectedCount').textContent = `${selectedGroups.size} / 6 nhóm`;
  $('#cfgLockStatus').textContent = locked ? 'Đã khóa đăng ký' : 'Đang mở đăng ký';
  $('#lockChip').textContent = locked ? 'Đã khóa đăng ký' : 'Đang mở đăng ký';
  $('#lockChip').className = `status-chip ${locked ? 'chip-locked' : 'chip-open'}`;
  $('#toggleLockBtn').textContent = locked ? '🔓 Mở đăng ký' : '🔒 Khóa đăng ký';
  $('#lockToggleBtn2').textContent = locked ? '🔓 Mở đăng ký' : '🔒 Khóa đăng ký';

  $('#teamSelectionCount').textContent = `Đã chọn ${selectedGroups.size}/6 nhóm`;
  $('#applyTeamsBtn').disabled = selectedGroups.size !== 6 || !isLobby;

  const grid = $('#groupSelectorGrid');
  grid.innerHTML = [4, 5, 6, 7, 8, 9, 10].map(num => {
    const def = GROUP_DEFS[num];
    const isSelected = selectedGroups.has(num);
    const existingTeam = state.teams.find(t => t.groupNumber === num);
    const memCount = existingTeam ? existingTeam.memberCount : 0;
    const isFull = memCount >= 6;

    return `
      <div class="group-select-card ${isSelected ? 'selected' : ''} ${isFull ? 'group-card-full' : ''}" style="--team:${esc(def.color)}">
        <label class="group-select-header">
          <input type="checkbox" class="group-checkbox" data-num="${num}" ${isSelected ? 'checked' : ''} ${!isLobby ? 'disabled' : ''}>
          <span class="group-icon">${esc(def.icon)}</span>
          <span class="group-name"><strong>${esc(def.name)}</strong></span>
        </label>
        <div class="group-select-body">
          <div class="group-mem-chip ${memCount > 0 ? 'has-members' : ''}">${memCount}/6 thành viên</div>
          <div class="group-status-sub">${isSelected ? (isFull ? '🔴 Đã đủ 6 người' : '🟢 Đang tham gia') : '⚪ Chưa chọn'}</div>
        </div>
      </div>
    `;
  }).join('');

  $$('.group-checkbox', grid).forEach(cb => cb.addEventListener('change', e => {
    const num = Number(e.target.dataset.num);
    if (e.target.checked) {
      if (selectedGroups.size >= 6) {
        e.target.checked = false;
        alert('Đã chọn đủ 6 nhóm! Vui lòng bỏ chọn 1 nhóm trước khi chọn nhóm khác.');
        return;
      }
      selectedGroups.add(num);
    } else {
      const existingTeam = state.teams.find(t => t.groupNumber === num);
      if (existingTeam && existingTeam.memberCount > 0) {
        e.target.checked = true;
        alert(`Không thể bỏ ${existingTeam.name} vì đang có ${existingTeam.memberCount} thành viên đang tham gia! Yêu cầu thành viên đổi nhóm trước.`);
        return;
      }
      selectedGroups.delete(num);
    }
    renderTeamsConfig();
  }));

  $('#groupSelectMsg').textContent = isLobby
    ? (selectedGroups.size === 6 ? '✅ Đã chọn đủ 6 nhóm. Bấm "Áp dụng danh sách 6 nhóm" để cập nhật phòng.' : `⚠️ Cần chọn chính xác đúng 6 nhóm (hiện có ${selectedGroups.size}/6).`)
    : '🔒 Không thể đổi nhóm khi trận đấu đang diễn ra.';
}

$('#applyTeamsBtn').addEventListener('click', () => {
  if (selectedGroups.size !== 6) return alert('Cần chọn chính xác đúng 6 nhóm!');
  if (!state || state.status !== 'lobby') return alert('Chỉ thay đổi nhóm khi ở phòng chờ.');

  const list = [...selectedGroups].sort((a, b) => a - b);
  socket.emit('host:set-teams', { groupNumbers: list }, r => {
    if (!r.ok) {
      setNotice(`⚠️ ${r.error}`);
      alert(r.error);
    } else {
      setNotice('✅ Đã cập nhật 6 nhóm tham gia thành công!');
      renderTeamsConfig();
    }
  });
});

function renderMonitor() {
  if (!state) return;
  const totalMem = state.teams.reduce((n, t) => n + t.memberCount, 0);
  const maxCap = state.totalCapacity || 36;
  const locked = !!state.registrationLocked;

  $('#hostCode').textContent = state.code;
  $('#statusChip').textContent = statusText(state.status);
  $('#lockChip').textContent = locked ? 'Đã khóa đăng ký' : 'Đang mở đăng ký';
  $('#lockChip').className = `status-chip ${locked ? 'chip-locked' : 'chip-open'}`;
  $('#toggleLockBtn').textContent = locked ? '🔓 Mở đăng ký' : '🔒 Khóa đăng ký';
  $('#lockToggleBtn2').textContent = locked ? '🔓 Mở đăng ký' : '🔒 Khóa đăng ký';

  $('#membersInfo').textContent = `${totalMem}/${maxCap} sinh viên • 6 đội`;
  $('#nextBtn').hidden = !['lobby', 'review'].includes(state.status);
  $('#nextBtn').textContent = state.status === 'lobby' ? '▶ Bắt đầu trận' : state.stepIndex === state.stepsTotal - 1 ? '🏁 Kết toán & kết thúc' : '▶ Ải / câu tiếp theo';
  $('#closeBtn').hidden = state.status !== 'running';
  $('#saveConfig').disabled = state.status !== 'lobby';

  $('#previewStat').innerHTML = `
    <div class="summary-stat"><span>Trạng thái</span><b>${esc(statusText(state.status))}</b></div>
    <div class="summary-stat"><span>Đăng ký</span><b>${locked ? 'Đã khóa' : 'Đang mở'}</b></div>
    <div class="summary-stat"><span>Số người chơi</span><b>${totalMem}/${maxCap}</b></div>
    <div class="summary-stat"><span>Lượt đã qua</span><b>${Math.max(0, state.stepIndex + Number(state.status !== 'running' && state.stepIndex >= 0))}/${state.stepsTotal}</b></div>
    <div class="summary-stat"><span>Vốn khởi đầu</span><b>${state.startingCash} xu</b></div>
  `;

  $('#hostTeams').innerHTML = state.teams.map(teamLine).join('');
  $('#hostMap').innerHTML = shipMap(state, true);
  $('#hostTask').innerHTML = `<div class="mission-card">${stepCard(state)}</div>`;
  $('#hostScores').innerHTML = teamRows(state);
  $('#hostVoters').innerHTML = progressVotes(state);
  $('#hostHistory').innerHTML = `<div class="history-mini"><h3>📋 Nhật ký trận đấu</h3>${state.history.slice().reverse().map(h => `<div>${esc(h.stageTitle)} — ${h.summaries.length} đội đã hoàn thành</div>`).join('') || '<div>Chưa có lượt nào được chốt.</div>'}</div>`;
}

function renderStageNav() {
  if (!working) return;
  $('#stageNav').innerHTML = `<button class="stage-nav-button ${activeStage === -1 ? 'active' : ''}" data-stage="-1"><span>⚙️</span><span>Cài đặt chung<small>Tên game, 6 đội, số xu</small></span></button>` + working.stages.map((s, i) => `<button class="stage-nav-button ${activeStage === i ? 'active' : ''}" data-stage="${i}"><span>${esc(s.icon)}</span><span>Ải ${i + 1}: ${esc(s.title)}<small>${s.questions?.length ? `${s.questions.length} câu hỏi • ` : ''}${s.duration} giây/lượt</small></span></button>`).join('');
  $$('[data-stage]', $('#stageNav')).forEach(b => b.addEventListener('click', () => {
    activeStage = Number(b.dataset.stage);
    activeQuestion = 0;
    renderStageNav();
    renderEditor();
  }));
}

const field = (title, path, val, opts = {}) => {
  let input = '';
  const common = `data-path="${esc(path)}" ${opts.num ? 'data-num="1"' : ''} ${opts.bool ? 'data-bool="1"' : ''}`;
  if (opts.bool) {
    input = `<input type="checkbox" ${common} ${val ? 'checked' : ''} style="width:auto">`;
  } else if (opts.textarea) {
    input = `<textarea ${common} rows="3">${esc(val)}</textarea>`;
  } else if (opts.select) {
    input = `<select ${common}>${opts.select.map(o => `<option value="${esc(o.value)}" ${String(val) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  } else {
    input = `<input ${common} type="${opts.num ? 'number' : 'text'}" value="${esc(val)}" ${opts.num ? 'min="0" max="120"' : ''}>`;
  }
  return `<label>${esc(title)}${input}</label>`;
};

function optionFields(stageIndex, fields) {
  const s = working.stages[stageIndex];
  return s.options.map((o, j) => `<div class="line-option"><h4>Phương án ${j + 1}</h4>${field('Tên phương án', `stages.${stageIndex}.options.${j}.label`, o.label)}${field('Mô tả', `stages.${stageIndex}.options.${j}.detail`, o.detail)}<div class="field-group ${fields.length === 3 ? 'three' : ''}">${fields.map(x => field(x.title, `stages.${stageIndex}.options.${j}.${x.key}`, o[x.key], { num: x.key !== 'needsQuiz', bool: x.key === 'needsQuiz' })).join('')}</div></div>`).join('');
}

function questionEditor(i) {
  const s = working.stages[i], q = s.questions[Math.min(activeQuestion, s.questions.length - 1)] || s.questions[0];
  activeQuestion = Math.min(activeQuestion, s.questions.length - 1);
  return `<h3>📘 Bộ câu hỏi trong ải (${s.questions.length})</h3><div class="question-tabs">${s.questions.map((_, j) => `<button type="button" class="question-tab ${j === activeQuestion ? 'active' : ''}" data-q="${j}">Câu ${j + 1}</button>`).join('')}<button class="question-tab" id="addQuestion">＋ Thêm câu</button><button class="question-tab" id="removeQuestion">🗑️ Xóa câu</button></div>` +
    field('Nội dung câu hỏi', `stages.${i}.questions.${activeQuestion}.prompt`, q.prompt, { textarea: true }) +
    q.options.map((x, j) => field(`Đáp án ${'ABCD'[j]}`, `stages.${i}.questions.${activeQuestion}.options.${j}`, x)).join('') +
    field('Đáp án đúng', `stages.${i}.questions.${activeQuestion}.correct`, q.correct, { select: [0, 1, 2, 3].map(x => ({ label: `${'ABCD'[x]}`, value: x })), num: true }) +
    field('Giải thích đáp án (hiện sau khi chốt)', `stages.${i}.questions.${activeQuestion}.explanation`, q.explanation, { textarea: true });
}

function renderEditor() {
  if (!working) return;
  $('#dirtyBadge').hidden = !dirty;
  const disabled = state && state.status !== 'lobby';
  if (activeStage === -1) {
    $('#editHeading').textContent = '⚙️ Cài đặt chung';
    $('#editorBody').innerHTML = field('Tên game', 'title', working.title) +
      field('Phụ đề', 'subtitle', working.subtitle) +
      field('Vốn khởi đầu cho mỗi đội (xu)', 'startingCash', working.startingCash, { num: true }) +
      `<h3>👥 Tên và biểu tượng 6 đội đang chọn</h3>` +
      working.teams.map((t, i) => `<div class="field-group">${field(`Đội ${i + 1} (${t.id})`, `teams.${i}.name`, t.name)}${field('Emoji', `teams.${i}.icon`, t.icon)}</div>`).join('') +
      `<div class="tip">Quy mô cố định 6 đội (Nhóm 4–10). Để đổi nhóm tham gia, sang tab "Cấu hình 6 nhóm".</div>`;
  } else {
    const i = activeStage, s = working.stages[i];
    $('#editHeading').textContent = `${s.icon} Ải ${i + 1}: ${s.title}`;
    let html = field('Tên ải', `stages.${i}.title`, s.title) +
      field('Mô tả / luật chơi', `stages.${i}.description`, s.description, { textarea: true }) +
      `<div class="field-group">${field('Biểu tượng', `stages.${i}.icon`, s.icon)}${field('Thời gian mỗi lượt (giây)', `stages.${i}.duration`, s.duration, { num: true })}</div>`;
    if (s.type === 'lot') html += `<h3>🌾 Các lô hàng</h3>` + optionFields(i, [{ key: 'cost', title: 'Vốn đầu tư (xu)' }, { key: 'revenue', title: 'Doanh thu cuối game (xu)' }]);
    if (s.type === 'quiz') html += field('Phí khi đội trả lời sai / hòa phiếu (xu)', `stages.${i}.wrongPenalty`, s.wrongPenalty, { num: true }) + questionEditor(i);
    if (s.type === 'auction') html += `<h3>🔨 Luật đấu giá giả lập</h3><div class="field-group three">${field('Giá cao nhất (xu)', `stages.${i}.maxBid`, s.maxBid, { num: true })}${field('Số thẻ', `stages.${i}.slots`, s.slots, { num: true })}${field('Giá trị thưởng / thẻ (xu)', `stages.${i}.discount`, s.discount, { num: true })}</div><div class="tip">Các đội đấu giá kín, đội thắng trả số xu đã đấu và được cộng giá trị thẻ khi kết toán. Đây KHÔNG phải cơ chế hạn ngạch EVFTA thực tế.</div>`;
    if (s.type === 'event') html += `<h3>🌪️ Biến cố vận tải</h3>` + field('Xác suất gặp sự kiện bất lợi (%)', `stages.${i}.badChance`, s.badChance, { num: true }) + field('Nội dung khi có biến cố', `stages.${i}.badText`, s.badText) + field('Nội dung khi thuận lợi', `stages.${i}.goodText`, s.goodText) + optionFields(i, [{ key: 'cost', title: 'Chi phí ban đầu' }, { key: 'badLoss', title: 'Thiệt hại nếu xấu' }, { key: 'goodGain', title: 'Thưởng nếu tốt' }]);
    if (s.type === 'brand') html += `<h3>🏷️ Lựa chọn kênh phân phối</h3>` + optionFields(i, [{ key: 'cost', title: 'Vốn đầu tư' }, { key: 'bonus', title: 'Thưởng nếu đủ điều kiện' }, { key: 'needsQuiz', title: 'Cần qua quiz' }]) + questionEditor(i);
    $('#editorBody').innerHTML = html;
  }

  $$('[data-path]', $('#editorBody')).forEach(el => el.addEventListener('change', () => {
    const path = el.dataset.path.split('.');
    let obj = working;
    for (let k = 0; k < path.length - 1; k++) obj = obj[path[k]];
    let val = el.type === 'checkbox' ? el.checked : (el.dataset.num ? Number(el.value) : el.value);
    obj[path[path.length - 1]] = val;
    updateDirty();
  }));

  $$('[data-q]', $('#editorBody')).forEach(b => b.addEventListener('click', () => {
    activeQuestion = Number(b.dataset.q);
    renderEditor();
  }));

  $('#addQuestion')?.addEventListener('click', () => {
    const qs = working.stages[activeStage].questions;
    if (qs.length >= 12) return alert('Giới hạn 12 câu hỏi/ải.');
    qs.push({ prompt: 'Nhập câu hỏi mới của bạn...', options: ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'], correct: 0, explanation: 'Giải thích đáp án đúng.' });
    activeQuestion = qs.length - 1;
    updateDirty();
    renderEditor();
  });

  $('#removeQuestion')?.addEventListener('click', () => {
    const qs = working.stages[activeStage].questions;
    if (qs.length <= 1) return alert('Một ải trắc nghiệm cần ít nhất 1 câu hỏi.');
    if (confirm(`Xóa câu ${activeQuestion + 1}?`)) {
      qs.splice(activeQuestion, 1);
      activeQuestion = Math.max(0, activeQuestion - 1);
      updateDirty();
      renderEditor();
    }
  });

  if (disabled) $$('input,select,textarea,button', $('#editorBody')).forEach(e => e.disabled = true);
}

$('#saveConfig').addEventListener('click', () => {
  if (!state || state.status !== 'lobby') return setNotice('Chỉ lưu trước khi bắt đầu.');
  if (working) working.maxMembersPerTeam = 6;
  socket.emit('host:config', { config: working }, r => {
    if (!r.ok) return setNotice('⚠️ ' + r.error);
    dirty = false;
    $('#dirtyBadge').hidden = true;
    setNotice('✅ Đã lưu cấu hình trong phòng. Hãy xuất JSON để giữ bản sao lâu dài.');
    renderStageNav();
    renderEditor();
  });
});

$('#exportConfig').addEventListener('click', () => {
  if (!working) return;
  const blob = new Blob([JSON.stringify(working, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'evfta-bo-cau-hoi.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setNotice('✅ Đã xuất bộ câu hỏi + luật chơi về máy.');
});

$('#importConfig').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const cfg = JSON.parse(await file.text());
    if (!Array.isArray(cfg.stages) || cfg.stages.length !== 5) throw Error('JSON cần có đúng 5 ải.');
    if (cfg.maxMembersPerTeam !== undefined && cfg.maxMembersPerTeam !== 6) {
      throw Error('Số thành viên tối đa mỗi đội phải bằng 6.');
    }

    if (Array.isArray(cfg.teams) && cfg.teams.length === 4) {
      if (confirm('Phát hiện tệp JSON phiên bản cũ gồm 4 đội. Hệ thống EVFTA Challenge V2 yêu cầu 6 đội (chọn từ Nhóm 4 đến Nhóm 10). Bạn có muốn tự động nâng cấp sang 6 đội (Nhóm 4–9) để giữ nguyên toàn bộ bộ câu hỏi và cài đặt 5 ải không?')) {
        cfg.teamCount = 6;
        cfg.maxMembersPerTeam = 6;
        cfg.allowedGroupNumbers = [4, 5, 6, 7, 8, 9, 10];
        cfg.selectedGroupNumbers = [4, 5, 6, 7, 8, 9];
        cfg.teams = [4, 5, 6, 7, 8, 9].map((num, idx) => ({
          id: `team_${idx + 1}`,
          name: GROUP_DEFS[num].name,
          groupNumber: num,
          icon: GROUP_DEFS[num].icon,
          color: GROUP_DEFS[num].color
        }));
      } else {
        setNotice('⚠️ Đã hủy nhập JSON cũ.');
        e.target.value = '';
        return;
      }
    }

    working = cfg;
    activeStage = -1;
    activeQuestion = 0;
    updateDirty();
    renderStageNav();
    renderEditor();
    setNotice('📥 Đã nhập JSON thành công. Bấm "Lưu cấu hình vào phòng" để áp dụng.');
  } catch (err) {
    setNotice('⚠️ Không đọc được JSON: ' + err.message);
  }
  e.target.value = '';
});

setInterval(() => {
  if (!state || state.status !== 'running') return;
  $$('[data-timer]').forEach(x => x.textContent = `⏱ ${voteElapsed(state)} giây`);
}, 250);
