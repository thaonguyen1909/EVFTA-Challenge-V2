'use strict';
const $ = (sel, root = typeof document !== 'undefined' ? document : null) => root ? root.querySelector(sel) : null;
const $$ = (sel, root = typeof document !== 'undefined' ? document : null) => root ? [...root.querySelectorAll(sel)] : [];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const iconStage = (id) => ({ lot: '🌾', standards: '🧪', auction: '🔨', logistics: '🚢', brand: '🏷️' }[id] || '🚩');
const statusText = (s) => ({ lobby: 'Đang chờ người chơi', running: 'Đang thi đấu', review: 'Đã chốt lượt', finished: 'Đã kết thúc' }[s] || 'Đang tải');
const stepLabel = (s) => s ? ({ quiz: 'Trắc nghiệm', brandquiz: 'Câu hỏi thương hiệu', lot: 'Chọn lô gạo', auction: 'Đấu giá kín', event: 'Xử lý biến cố', brand: 'Chiến lược thương hiệu' }[s.kind] || s.kind) : '';

function voteElapsed(state) {
  const offset = (typeof window !== 'undefined' && window.serverOffset) ? window.serverOffset : 0;
  return state.deadline ? Math.max(0, Math.ceil((state.deadline - Date.now() + offset) / 1000)) : null;
}

function setNet(connected) {
  if (typeof document === 'undefined') return;
  const label = $('#netState');
  if (label) label.textContent = connected ? 'Đã kết nối' : 'Mất kết nối...';
}


function teamRows(state, { large = false } = {}) {
  // Ưu tiên đội có người chơi trước.
  // Sau đó xếp theo lợi nhuận và vốn.
  const list = [...state.teams].sort((a, b) =>
    Number(b.memberCount > 0) - Number(a.memberCount > 0) ||
    b.projectedProfit - a.projectedProfit ||
    b.cash - a.cash
  );

  return list.map((t, i) => {
    const position = t.memberCount === 0 && i < 3
      ? '—'
      : i === 0 ? '🥇'
      : i === 1 ? '🥈'
      : i === 2 ? '🥉'
      : `#${i + 1}`;

    return `
      <div class="rank-row ${large ? 'rank-large' : ''}"
           style="--team:${esc(t.color)}">
        <div class="rank-position">${position}</div>
        <div class="rank-ico">${esc(t.icon)}</div>
        <div class="rank-main">
          <b>${esc(t.name)}</b>
          <small>
            ${fmt(t.memberCount)}/${t.maxMembers || 6}
            thành viên • ${fmt(t.cash)} xu vốn
          </small>
        </div>
        <div class="rank-profit ${t.projectedProfit >= 0 ? 'plus' : 'minus'}">
          ${t.projectedProfit >= 0 ? '+' : ''}${fmt(t.projectedProfit)}
          <small>
            ${state.status === 'finished' ? 'lãi cuối' : 'lãi dự kiến'}
          </small>
        </div>
      </div>
    `;
  }).join('');
}


function teamLine(t) {
  return `<div class="teamline" style="--team:${esc(t.color)}"><span class="team-icon">${esc(t.icon)}</span><div><strong>${esc(t.name)}</strong><small>${t.memberCount}/${t.maxMembers || 6} thành viên • ${t.online} online</small></div><b>${fmt(t.cash)} xu</b></div>`;
}

function stageList(state, small = false) {
  const idx = state.step ? state.step.stageIndex : -1;
  return state.stages.map((s, i) => `<div class="${small ? 'small-stage' : 'stage-chip'} ${i === idx && state.status !== 'finished' ? 'current' : ''} ${i < idx || state.status === 'finished' ? 'done' : ''}"><span>${esc(s.icon)}</span><div>${small ? `<b>Ải ${i + 1}</b>` : ''}<b>${esc(s.title)}</b></div>${i < idx || state.status === 'finished' ? '✓' : ''}</div>`).join('');
}

function shipMap(state, compact = false) {
  const completed = state.status === 'finished' ? 5 : (state.step?.stageIndex ?? 0);
  const pctBase = state.status === 'finished' ? 86 : 10 + completed * 15;
  const activeTeams = state.teams.filter(t => t.memberCount > 0);
  const totalBoats = activeTeams.length;
  const boats = activeTeams.map((t, i) => {
    const pct = Math.max(9, Math.min(91, pctBase + Math.min(8, t.quality * 2) + ((t.projectedProfit > 0) ? 2 : 0)));
    const top = totalBoats <= 1 ? 40 : 12 + (i / (totalBoats - 1)) * 68;
    return `<div class="boat-marker" style="left:${pct}%;top:${top}%;--team:${esc(t.color)}"><span class="boat-bubble">${esc(t.icon)} ${esc(t.name)}<small>${fmt(t.cash)} xu</small></span><span class="boat-emoji">🚢</span></div>`;
  }).join('');
  return `<div class="sea-map ${compact ? 'compact-map' : ''}"><div class="sea-sun"></div><div class="shore shore-vn"><span>🇻🇳</span><strong>VIỆT NAM</strong><span>🌾</span></div><div class="shore shore-eu"><span>🇪🇺</span><strong>EU</strong><span>🏗️</span></div><div class="sea-lines"></div><div class="sea-waves">～～～～～～～～～～～～～～～～～～</div>${boats}<div class="map-note">${state.status === 'finished' ? '🏁 Đã cập cảng châu Âu' : '🚢 Các con tàu tiến dần qua 5 ải'}</div></div>`;
}

function progressVotes(state) {
  return state.teams.map(t => {
    const n = state.voters[t.id] || 0, all = t.memberCount, pct = all ? Math.round(n / all * 100) : 0;
    return `<div class="vote-team" style="--team:${esc(t.color)}"><div class="vote-title"><span>${esc(t.icon)} ${esc(t.name)}</span><strong>${n}/${all}</strong></div><div class="bar"><div style="width:${pct}%"></div></div></div>`;
  }).join('');
}

function resultInfo(state) {
  if (!state.result) return '';
  const event = state.result.event;
  return `<div class="result-summary"><div class="result-title">✅ Đã kết thúc lượt${event ? ' • ' + esc(event.text) : ''}</div>${state.result.summaries.map(r => {
    const t = state.teams.find(x => x.id === r.team);
    return `<div class="result-line"><span>${esc(t?.icon || '')} <b>${esc(t?.name || r.team)}</b></span><span>${esc(r.note)} <strong class="${r.delta >= 0 ? 'positive' : 'negative'}">${r.delta > 0 ? '+' : ''}${r.delta} xu</strong></span></div>`;
  }).join('')}</div>`;
}

function stepCard(state) {
  if (state.status === 'lobby') return `<div class="empty-state"><div class="emoji">🎮</div><h2>Chờ các đội vào phòng</h2><p>Host sẽ khởi động cuộc đua sau khi có ít nhất hai đội tham gia.</p></div>`;
  if (state.status === 'finished') return `<div class="empty-state"><div class="emoji">🏆</div><h2>Tàu gạo đã cập cảng EU!</h2><p>Chúc mừng đội có lợi nhuận cao nhất. Xem bảng xếp hạng bên cạnh.</p></div>`;
  const s = state.step;
  return `<div class="step-head"><span class="step-badge">${esc(s.icon)} Ải ${s.stageIndex + 1}/5 • ${esc(stepLabel(s))}</span><span class="timer-inline" data-timer>-- giây</span></div><h2>${esc(s.title)}${s.questionNo ? ` <small>(${s.questionNo}/${s.questionTotal})</small>` : ''}</h2>${s.prompt ? `<div class="question-prompt">${esc(s.prompt)}</div>` : `<p class="step-description">${esc(s.description)}</p>`}<div class="option-preview">${s.options.map((o, i) => `<div><span class="option-letter">${s.kind === 'quiz' || s.kind === 'brandquiz' ? 'ABCD'[i] : i + 1}</span><span>${esc(o.label)}</span>${o.detail ? `<small>${esc(o.detail)}</small>` : ''}${(state.status === 'review' && s.correct === i) ? '<b class="correct-indicator">✓ Đúng</b>' : ''}</div>`).join('')}</div>${state.status === 'review' ? `${s.explanation ? `<div class="explain">📘 ${esc(s.explanation)}</div>` : ''}${resultInfo(state)}` : ''}`;
}

if (typeof module !== 'undefined') {
  module.exports = {
    teamRows,
    teamLine,
    stageList,
    shipMap,
    progressVotes,
    resultInfo,
    stepCard,
    voteElapsed,
    statusText,
    stepLabel
  };
}
