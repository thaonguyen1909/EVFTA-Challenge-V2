'use strict';
const crypto = require('node:crypto');
const STAGE_IDS = ['lot', 'standards', 'auction', 'logistics', 'brand'];
const STAGE_TYPES = ['lot', 'quiz', 'auction', 'event', 'brand'];
const ALLOWED_GROUP_NUMBERS = [4, 5, 6, 7, 8, 9, 10];
const DEFAULT_TEAM_COUNT = 6;
const DEFAULT_MAX_MEMBERS_PER_TEAM = 6;

const GROUP_DEFINITIONS = {
  4: { name: 'Nhóm 4', icon: '🌾', color: '#e6ad29' },
  5: { name: 'Nhóm 5', icon: '🤝', color: '#3986e8' },
  6: { name: 'Nhóm 6', icon: '🚀', color: '#f16575' },
  7: { name: 'Nhóm 7', icon: '🌿', color: '#39ad77' },
  8: { name: 'Nhóm 8', icon: '⚡', color: '#9c5de8' },
  9: { name: 'Nhóm 9', icon: '🎯', color: '#f97316' },
  10: { name: 'Nhóm 10', icon: '🚢', color: '#0ea5e9' }
};

function nonempty(v, name, max = 500) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error(`${name} cần 1–${max} ký tự.`);
  return v.trim();
}
function integer(v, name, min, max) {
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${name} phải trong khoảng ${min}–${max}.`);
  return v;
}
function validateOptions(arr, name, count, extraFields = []) {
  if (!Array.isArray(arr) || arr.length !== count) throw new Error(`${name} cần đúng ${count} lựa chọn.`);
  return arr.map((o, i) => {
    const out = { label: nonempty(o?.label, `${name} #${i + 1}`, 90), detail: nonempty(o?.detail || '—', `${name} mô tả #${i + 1}`, 180) };
    for (const field of extraFields) {
      if (field === 'needsQuiz') out[field] = Boolean(o?.[field]);
      else out[field] = integer(o?.[field], `${name} ${field}`, 0, 99);
    }
    return out;
  });
}
function validateQuestions(value, name) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) throw new Error(`${name}: cần 1–12 câu hỏi.`);
  return value.map((q, i) => {
    if (!Array.isArray(q?.options) || q.options.length !== 4) throw new Error(`${name}, câu ${i + 1}: cần 4 đáp án.`);
    return {
      prompt: nonempty(q.prompt, `${name}, câu ${i + 1}`, 600),
      options: q.options.map((a, j) => nonempty(a, `Đáp án ${j + 1}`, 220)),
      correct: integer(q.correct, `Đáp án đúng câu ${i + 1}`, 0, 3),
      explanation: nonempty(q.explanation || 'Giải thích ngắn về đáp án đúng.', `Giải thích câu ${i + 1}`, 500)
    };
  });
}

function buildTeamsFromGroupNumbers(groupNumbers) {
  if (!Array.isArray(groupNumbers) || groupNumbers.length !== DEFAULT_TEAM_COUNT) {
    throw new Error(`Cần chọn chính xác đúng ${DEFAULT_TEAM_COUNT} nhóm.`);
  }
  const numSet = new Set(groupNumbers);
  if (numSet.size !== DEFAULT_TEAM_COUNT) {
    throw new Error('Không được chọn trùng nhóm.');
  }
  for (const n of groupNumbers) {
    if (!ALLOWED_GROUP_NUMBERS.includes(n)) {
      throw new Error(`Nhóm ${n} không hợp lệ. Chỉ được chọn từ Nhóm 4 đến Nhóm 10.`);
    }
  }
  return groupNumbers.map((num, i) => {
    const def = GROUP_DEFINITIONS[num] || { name: `Nhóm ${num}`, icon: '🌾', color: '#e6ad29' };
    return {
      id: `team_${i + 1}`,
      name: def.name,
      groupNumber: num,
      icon: def.icon,
      color: def.color
    };
  });
}

function migrateOldConfig(oldConfig) {
  if (!oldConfig || typeof oldConfig !== 'object') throw new Error('Dữ liệu cấu hình không hợp lệ.');
  const upgraded = JSON.parse(JSON.stringify(oldConfig));
  upgraded.teamCount = DEFAULT_TEAM_COUNT;
  upgraded.maxMembersPerTeam = DEFAULT_MAX_MEMBERS_PER_TEAM;
  upgraded.allowedGroupNumbers = [...ALLOWED_GROUP_NUMBERS];
  upgraded.selectedGroupNumbers = [4, 5, 6, 7, 8, 9];
  upgraded.teams = buildTeamsFromGroupNumbers(upgraded.selectedGroupNumbers);
  return validateConfig(upgraded);
}

function validateConfig(value) {
  if (!value || typeof value !== 'object') throw new Error('Dữ liệu cấu hình không hợp lệ.');
  if (value.maxMembersPerTeam !== undefined && value.maxMembersPerTeam !== DEFAULT_MAX_MEMBERS_PER_TEAM) {
    throw new Error(`Số thành viên tối đa mỗi đội phải bằng ${DEFAULT_MAX_MEMBERS_PER_TEAM}.`);
  }
  const out = {
    title: nonempty(value.title, 'Tên game', 100),
    subtitle: nonempty(value.subtitle, 'Phụ đề', 160),
    startingCash: integer(value.startingCash, 'Vốn khởi đầu', 5, 100),
    teamCount: DEFAULT_TEAM_COUNT,
    maxMembersPerTeam: DEFAULT_MAX_MEMBERS_PER_TEAM,
    allowedGroupNumbers: [...ALLOWED_GROUP_NUMBERS]
  };

  if (!Array.isArray(value.teams)) {
    throw new Error('Danh sách đội không hợp lệ.');
  }
  if (value.teams.length === 4) {
    throw new Error('Cấu hình cũ gồm 4 đội. Hệ thống phiên bản V2 yêu cầu đúng 6 đội (chọn 6 nhóm từ Nhóm 4 đến Nhóm 10).');
  }
  if (value.teams.length !== DEFAULT_TEAM_COUNT) {
    throw new Error(`Cần đúng ${DEFAULT_TEAM_COUNT} đội.`);
  }

  out.teams = value.teams.map((t, i) => {
    const name = nonempty(t?.name, `Tên đội ${i + 1}`, 36);
    let groupNumber = t?.groupNumber;
    if (groupNumber === undefined || groupNumber === null) {
      const match = name.match(/(\d+)/);
      if (match) groupNumber = parseInt(match[1], 10);
      else groupNumber = i + 4;
    }
    integer(groupNumber, `Số thứ tự của đội ${name}`, 4, 10);

    const id = nonempty(t?.id || `team_${i + 1}`, `ID đội ${i + 1}`, 36);
    const icon = nonempty(t?.icon || GROUP_DEFINITIONS[groupNumber]?.icon || '🌾', `Biểu tượng đội ${i + 1}`, 8);
    const color = nonempty(t?.color || GROUP_DEFINITIONS[groupNumber]?.color || '#e6ad29', `Màu đội ${i + 1}`, 24);

    return { id, name, groupNumber, icon, color };
  });

  const ids = new Set(out.teams.map(t => t.id));
  if (ids.size !== DEFAULT_TEAM_COUNT) throw new Error('ID các đội phải khác nhau.');

  const names = new Set(out.teams.map(t => t.name.toLocaleLowerCase('vi-VN')));
  if (names.size !== DEFAULT_TEAM_COUNT) throw new Error('Tên các đội phải khác nhau.');

  const groupNums = new Set(out.teams.map(t => t.groupNumber));
  if (groupNums.size !== DEFAULT_TEAM_COUNT) throw new Error('Số thứ tự các nhóm không được trùng nhau.');

  for (const t of out.teams) {
    if (!ALLOWED_GROUP_NUMBERS.includes(t.groupNumber)) {
      throw new Error(`Nhóm ${t.groupNumber} không hợp lệ. Số thứ tự nhóm phải trong khoảng 4 đến 10.`);
    }
  }

  out.selectedGroupNumbers = out.teams.map(t => t.groupNumber);

  if (!Array.isArray(value.stages) || value.stages.length !== 5) throw new Error('Game cần đúng 5 ải.');
  out.stages = value.stages.map((s, i) => {
    if (s?.id !== STAGE_IDS[i] || s?.type !== STAGE_TYPES[i]) throw new Error(`Ải ${i + 1} sai loại hoặc thứ tự.`);
    const stage = {
      id: STAGE_IDS[i],
      type: STAGE_TYPES[i],
      title: nonempty(s.title, `Tên ải ${i + 1}`, 75),
      icon: nonempty(s.icon, `Biểu tượng ải ${i + 1}`, 8),
      duration: integer(s.duration, `Thời gian ải ${i + 1}`, 10, 120),
      description: nonempty(s.description, `Mô tả ải ${i + 1}`, 600)
    };
    if (s.type === 'lot') stage.options = validateOptions(s.options, 'Lô gạo', 2, ['cost', 'revenue']);
    if (s.type === 'quiz') {
      stage.questions = validateQuestions(s.questions, 'Kiểm định');
      stage.wrongPenalty = integer(s.wrongPenalty, 'Chi phí trả lời sai', 0, 10);
    }
    if (s.type === 'auction') {
      stage.maxBid = integer(s.maxBid, 'Giá đấu cao nhất', 1, 20);
      stage.slots = integer(s.slots, 'Số thẻ', 1, 5);
      stage.discount = integer(s.discount, 'Giá trị thẻ', 1, 30);
    }
    if (s.type === 'event') {
      stage.badChance = integer(s.badChance, 'Xác suất sự kiện xấu (%)', 0, 100);
      stage.badText = nonempty(s.badText, 'Mô tả sự kiện bất lợi', 220);
      stage.goodText = nonempty(s.goodText, 'Mô tả sự kiện thuận lợi', 220);
      stage.options = validateOptions(s.options, 'Kế hoạch logistics', 3, ['cost', 'badLoss', 'goodGain']);
    }
    if (s.type === 'brand') {
      stage.options = validateOptions(s.options, 'Kênh phân phối', 2, ['cost', 'bonus', 'needsQuiz']);
      stage.questions = validateQuestions(s.questions, 'Thương hiệu');
    }
    return stage;
  });
  return out;
}

function createSteps(config) {
  const steps = [{ key: 'lot', stage: 0, kind: 'lot' }];
  for (let i = 0; i < config.stages[1].questions.length; i++) steps.push({ key: `standards:${i}`, stage: 1, kind: 'quiz', qi: i });
  steps.push({ key: 'auction', stage: 2, kind: 'auction' }, { key: 'logistics', stage: 3, kind: 'event' }, { key: 'brand', stage: 4, kind: 'brand' });
  for (let i = 0; i < config.stages[4].questions.length; i++) steps.push({ key: `brandquiz:${i}`, stage: 4, kind: 'brandquiz', qi: i });
  return steps;
}

function majority(votes, optionCount, tieMode = 'none') {
  const counts = Array(optionCount).fill(0);
  for (const v of votes) if (Number.isInteger(v) && v >= 0 && v < optionCount) counts[v]++;
  const top = Math.max(...counts);
  if (top === 0) return { choice: null, counts, tie: false, total: 0 };
  const tops = counts.flatMap((count, index) => count === top ? [index] : []);
  return { choice: tops.length === 1 ? tops[0] : (tieMode === 'lowest' ? tops[0] : null), counts, tie: tops.length > 1, total: counts.reduce((a, b) => a + b, 0) };
}

function makeTeamState(startingCash) {
  return { cash: startingCash, lotRevenue: 0, discount: 0, brandChoice: null, brandBonus: 0, brandCorrect: 0, quality: 0, expenses: 0, ledger: [] };
}

function apply(team, delta, label) {
  team.cash += delta;
  if (delta < 0) team.expenses -= delta;
  team.ledger.push({ label, delta });
}

function projectedProfit(team, start, finished = false) {
  return team.cash + (finished ? 0 : team.lotRevenue + team.discount + team.brandBonus) - start;
}

function settle(session, rng = (n) => crypto.randomInt(n)) {
  const { config, steps, stepIndex, players, teams, votes } = session;
  const step = steps[stepIndex], stage = config.stages[step.stage];
  const active = config.teams.filter(t => [...players.values()].some(p => p.team === t.id));
  const summaries = active.map(t => {
    const ballots = [...votes.entries()].filter(([pid]) => players.get(pid)?.team === t.id).map(([, vote]) => vote);
    const optionsCount = step.kind === 'auction' ? stage.maxBid + 1 : step.kind === 'quiz' || step.kind === 'brandquiz' ? 4 : stage.options.length;
    const mv = majority(ballots, optionsCount, step.kind === 'auction' ? 'lowest' : 'none');
    const result = { team: t.id, choice: mv.choice, counts: mv.counts, voters: mv.total, tie: mv.tie, delta: 0, note: '' };
    return result;
  });
  const prior = new Map(active.map(t => [t.id, teams[t.id].cash]));
  let event = null;
  if (step.kind === 'event') event = { bad: rng(100) < stage.badChance, text: '' };
  if (step.kind === 'auction') {
    const offers = summaries.map(r => ({ ...r, bid: r.choice ?? 0 })).filter(r => r.bid > 0);
    for (let i = offers.length - 1; i > 0; i--) { const j = rng(i + 1); [offers[i], offers[j]] = [offers[j], offers[i]]; }
    offers.sort((a, b) => b.bid - a.bid);
    const winners = new Set(offers.slice(0, stage.slots).map(r => r.team));
    for (const r of summaries) {
      const t = teams[r.team], bid = r.choice ?? 0;
      if (winners.has(r.team)) {
        apply(t, -bid, 'Trả giá đấu thẻ ưu đãi');
        t.discount += stage.discount;
        r.note = `Thắng đấu giá: trả ${bid} xu, nhận thẻ +${stage.discount} xu khi kết toán.`;
      } else {
        r.note = bid ? `Đấu giá ${bid} xu không thắng, không bị trừ tiền.` : 'Không đặt giá đấu.';
      }
      r.won = winners.has(r.team);
    }
  }
  for (const r of summaries) {
    const t = teams[r.team];
    if (step.kind === 'lot') {
      const choice = r.choice ?? 0, option = stage.options[choice];
      apply(t, -option.cost, `Đầu tư ${option.label}`);
      t.lotRevenue = option.revenue;
      r.choice = choice;
      r.note = `Chọn ${option.label}: chi ${option.cost} xu, doanh thu dự kiến ${option.revenue} xu.`;
    }
    if (step.kind === 'quiz') {
      const q = stage.questions[step.qi];
      r.correct = r.choice === q.correct;
      if (r.correct) {
        apply(t, 1, 'Vượt kiểm định kiến thức');
        t.quality++;
        r.note = 'Đáp án đa số đúng: +1 xu, đạt chứng nhận kiến thức.';
      } else {
        apply(t, -stage.wrongPenalty, 'Chi phí khắc phục kiểm định');
        r.note = `Chưa vượt câu hỏi: -${stage.wrongPenalty} xu.`;
      }
      r.correctAnswer = q.correct;
      r.explanation = q.explanation;
    }
    if (step.kind === 'event') {
      const choice = r.choice ?? 1, option = stage.options[choice];
      r.choice = choice;
      const loss = event.bad ? option.badLoss : 0, gain = event.bad ? 0 : option.goodGain;
      apply(t, -option.cost - loss + gain, `Phương án logistics: ${option.label}`);
      r.note = `${option.label}: chi ${option.cost} xu${event.bad ? `, thiệt hại ${loss} xu` : `; thưởng ${gain} xu`}.`;
    }
    if (step.kind === 'brand') {
      const choice = r.choice ?? 0, option = stage.options[choice];
      r.choice = choice;
      t.brandChoice = choice;
      t.brandBonus = option.needsQuiz ? 0 : option.bonus;
      t.brandCorrect = 0;
      apply(t, -option.cost, `Chiến lược thương hiệu: ${option.label}`);
      r.note = `Chọn ${option.label}: chi ${option.cost} xu. ${option.needsQuiz ? 'Cần đạt ít nhất một nửa câu hỏi thương hiệu để nhận thưởng.' : `Được cộng ${option.bonus} xu khi kết toán.`}`;
    }
    if (step.kind === 'brandquiz') {
      const q = stage.questions[step.qi];
      r.correct = r.choice === q.correct;
      if (r.correct) t.brandCorrect++;
      if (step.qi === stage.questions.length - 1 && t.brandChoice !== null) {
        const option = stage.options[t.brandChoice];
        if (option.needsQuiz && t.brandCorrect >= Math.ceil(stage.questions.length / 2)) t.brandBonus = option.bonus;
      }
      r.correctAnswer = q.correct;
      r.explanation = q.explanation;
      r.note = r.correct ? 'Đáp án đa số đúng.' : 'Đáp án đa số chưa đúng hoặc hòa phiếu.';
    }
    r.delta = t.cash - prior.get(r.team);
  }
  if (event) { event.text = event.bad ? stage.badText : stage.goodText; }
  return { step, stageTitle: stage.title, summaries, event };
}

function finalize(session) {
  for (const team of session.config.teams) {
    if (![...session.players.values()].some(p => p.team === team.id)) continue;
    const t = session.teams[team.id];
    apply(t, t.lotRevenue, 'Doanh thu lô gạo xuất khẩu');
    if (t.discount) apply(t, t.discount, 'Thẻ ưu đãi giả lập');
    if (t.brandBonus) apply(t, t.brandBonus, 'Giá trị thương hiệu/phân phối');
  }
}

module.exports = {
  ALLOWED_GROUP_NUMBERS,
  DEFAULT_TEAM_COUNT,
  DEFAULT_MAX_MEMBERS_PER_TEAM,
  GROUP_DEFINITIONS,
  buildTeamsFromGroupNumbers,
  migrateOldConfig,
  validateConfig,
  createSteps,
  majority,
  makeTeamState,
  apply,
  projectedProfit,
  settle,
  finalize
};
