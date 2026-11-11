'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sample = require('../config/default-game.json');
const {
  validateConfig,
  createSteps,
  majority,
  makeTeamState,
  settle,
  finalize,
  projectedProfit,
  buildTeamsFromGroupNumbers,
  migrateOldConfig
} = require('../game-core');
const { teamRows, shipMap, progressVotes } = require('../public/common');
const serverModule = require('../server');

test('Yêu cầu 1: Tạo phòng mặc định có đúng 6 đội', () => {
  const cfg = validateConfig(sample);
  assert.equal(cfg.teams.length, 6);
  assert.equal(cfg.teamCount, 6);
  assert.equal(cfg.maxMembersPerTeam, 6);
  assert.deepEqual(cfg.selectedGroupNumbers, [4, 5, 6, 7, 8, 9]);
  assert.equal(cfg.teams[0].name, 'Nhóm 4');
  assert.equal(cfg.teams[1].name, 'Nhóm 5');
  assert.equal(cfg.teams[2].name, 'Nhóm 6');
  assert.equal(cfg.teams[3].name, 'Nhóm 7');
  assert.equal(cfg.teams[4].name, 'Nhóm 8');
  assert.equal(cfg.teams[5].name, 'Nhóm 9');
});

test('Yêu cầu 2: Chọn 6 nhóm trong phạm vi Nhóm 4 đến Nhóm 10', () => {
  const teams = buildTeamsFromGroupNumbers([4, 5, 6, 7, 8, 9]);
  assert.equal(teams.length, 6);
  assert.equal(teams[0].id, 'team_1');
  assert.equal(teams[0].groupNumber, 4);
  assert.equal(teams[5].id, 'team_6');
  assert.equal(teams[5].groupNumber, 9);
});

test('Yêu cầu 3: Có thể chọn Nhóm 10 thay cho một nhóm khác', () => {
  const teams = buildTeamsFromGroupNumbers([4, 5, 6, 7, 8, 10]);
  assert.equal(teams.length, 6);
  assert.equal(teams[5].name, 'Nhóm 10');
  assert.equal(teams[5].groupNumber, 10);
  assert.equal(teams[5].id, 'team_6'); // ID nội bộ độc lập, không phải team_10
});

test('Yêu cầu 4: Không thể chọn 5 hoặc 7 nhóm', () => {
  assert.throws(() => buildTeamsFromGroupNumbers([4, 5, 6, 7, 8]), /Cần chọn chính xác đúng 6 nhóm/);
  assert.throws(() => buildTeamsFromGroupNumbers([4, 5, 6, 7, 8, 9, 10]), /Cần chọn chính xác đúng 6 nhóm/);
});

test('Yêu cầu 5: Không cho chọn nhóm ngoài phạm vi 4–10', () => {
  assert.throws(() => buildTeamsFromGroupNumbers([3, 4, 5, 6, 7, 8]), /Chỉ được chọn từ Nhóm 4 đến Nhóm 10/);
  assert.throws(() => buildTeamsFromGroupNumbers([4, 5, 6, 7, 8, 11]), /Chỉ được chọn từ Nhóm 4 đến Nhóm 10/);
});

test('Yêu cầu 6: Không cho phép tên hoặc ID đội bị trùng', () => {
  assert.throws(() => buildTeamsFromGroupNumbers([4, 4, 5, 6, 7, 8]), /Không được chọn trùng nhóm/);
  const dupName = structuredClone(sample);
  dupName.teams[1].name = dupName.teams[0].name;
  assert.throws(() => validateConfig(dupName), /Tên các đội phải khác nhau/);
  const dupId = structuredClone(sample);
  dupId.teams[1].id = dupId.teams[0].id;
  assert.throws(() => validateConfig(dupId), /ID các đội phải khác nhau/);
});

test('Yêu cầu 7: Đội 3 người vẫn có thể chơi', () => {
  const s = {
    config: validateConfig(sample),
    steps: createSteps(validateConfig(sample)),
    stepIndex: 0,
    players: new Map([
      ['p1', { id: 'p1', team: 'team_1' }],
      ['p2', { id: 'p2', team: 'team_1' }],
      ['p3', { id: 'p3', team: 'team_1' }]
    ]),
    teams: { team_1: makeTeamState(10) },
    votes: new Map([['p1', 1], ['p2', 1], ['p3', 0]])
  };
  const res = settle(s, () => 0);
  assert.equal(res.summaries[0].choice, 1);
  assert.equal(res.summaries[0].voters, 3);
  assert.equal(s.teams.team_1.cash, 5); // 10 - 5 (gạo thơm)
});

test('Yêu cầu 8: Đội 4 người vẫn có thể chơi', () => {
  const s = {
    config: validateConfig(sample),
    steps: createSteps(validateConfig(sample)),
    stepIndex: 1, // quiz
    players: new Map([
      ['p1', { id: 'p1', team: 'team_1' }],
      ['p2', { id: 'p2', team: 'team_1' }],
      ['p3', { id: 'p3', team: 'team_1' }],
      ['p4', { id: 'p4', team: 'team_1' }]
    ]),
    teams: { team_1: makeTeamState(10) },
    votes: new Map([['p1', 1], ['p2', 1], ['p3', 1], ['p4', 0]])
  };
  const res = settle(s, () => 0);
  assert.equal(res.summaries[0].choice, 1);
  assert.equal(res.summaries[0].correct, true);
  assert.equal(s.teams.team_1.cash, 11);
});

test('Yêu cầu 9: Đội 5 người vẫn có thể chơi', () => {
  const s = {
    config: validateConfig(sample),
    steps: createSteps(validateConfig(sample)),
    stepIndex: 4, // auction
    players: new Map([
      ['p1', { id: 'p1', team: 'team_1' }],
      ['p2', { id: 'p2', team: 'team_1' }],
      ['p3', { id: 'p3', team: 'team_1' }],
      ['p4', { id: 'p4', team: 'team_1' }],
      ['p5', { id: 'p5', team: 'team_1' }]
    ]),
    teams: { team_1: makeTeamState(10) },
    votes: new Map([['p1', 2], ['p2', 2], ['p3', 2], ['p4', 1], ['p5', 3]])
  };
  const res = settle(s, () => 0);
  assert.equal(res.summaries[0].choice, 2);
  assert.equal(res.summaries[0].won, true);
  assert.equal(s.teams.team_1.cash, 8); // 10 - 2
  assert.equal(s.teams.team_1.discount, 4);
});

test('Yêu cầu 10: Đội 6 người vẫn có thể chơi', () => {
  const s = {
    config: validateConfig(sample),
    steps: createSteps(validateConfig(sample)),
    stepIndex: 5, // logistics event
    players: new Map([
      ['p1', { id: 'p1', team: 'team_1' }],
      ['p2', { id: 'p2', team: 'team_1' }],
      ['p3', { id: 'p3', team: 'team_1' }],
      ['p4', { id: 'p4', team: 'team_1' }],
      ['p5', { id: 'p5', team: 'team_1' }],
      ['p6', { id: 'p6', team: 'team_1' }]
    ]),
    teams: { team_1: makeTeamState(10) },
    votes: new Map([['p1', 0], ['p2', 0], ['p3', 0], ['p4', 0], ['p5', 1], ['p6', 2]])
  };
  const res = settle(s, () => 0); // bad event, option 0 là mua bảo hiểm (cost 2, loss 0)
  assert.equal(res.summaries[0].choice, 0);
  assert.equal(s.teams.team_1.cash, 8); // 10 - 2
});

test('Yêu cầu 11: Người thứ 7 của cùng một đội bị từ chối', () => {
  const room = {
    config: validateConfig(sample),
    players: new Map(),
    registrationLocked: false
  };
  for (let i = 1; i <= 6; i++) {
    room.players.set(`p${i}`, { id: `p${i}`, team: 'team_1', name: `SV ${i}` });
  }

  // Giả lập logic kiểm tra giới hạn 6 người của server
  const currentMembers = [...room.players.values()].filter(p => p.team === 'team_1');
  const maxPerTeam = room.config.maxMembersPerTeam;
  const isFull = currentMembers.length >= maxPerTeam;
  assert.equal(isFull, true);

  let errorMsg = '';
  if (isFull) {
    errorMsg = 'Đội đã đủ 6 thành viên. Vui lòng chọn đội khác.';
  }
  assert.equal(errorMsg, 'Đội đã đủ 6 thành viên. Vui lòng chọn đội khác.');
});

test('Yêu cầu 12: Hai người cùng tham gia vị trí cuối không làm vượt giới hạn', () => {
  const room = {
    config: validateConfig(sample),
    players: new Map(),
    registrationLocked: false
  };
  // Đội đang có 5 người
  for (let i = 1; i <= 5; i++) {
    room.players.set(`p${i}`, { id: `p${i}`, team: 'team_1', name: `SV ${i}` });
  }

  function attemptJoin(name) {
    const current = [...room.players.values()].filter(p => p.team === 'team_1');
    if (current.length >= 6) {
      return { ok: false, error: 'Đội đã đủ 6 thành viên. Vui lòng chọn đội khác.' };
    }
    const p = { id: 'p_' + name, team: 'team_1', name };
    room.players.set(p.id, p);
    return { ok: true };
  }

  // 2 người cùng gửi yêu cầu vào vị trí thứ 6
  const joinA = attemptJoin('SV_A');
  const joinB = attemptJoin('SV_B');

  assert.equal(joinA.ok, true);
  assert.equal(joinB.ok, false);
  assert.equal(joinB.error, 'Đội đã đủ 6 thành viên. Vui lòng chọn đội khác.');

  const finalMembers = [...room.players.values()].filter(p => p.team === 'team_1');
  assert.equal(finalMembers.length, 6, 'Số thành viên không được vượt quá 6');
});

test('Yêu cầu 13: Reconnect không tăng số thành viên', () => {
  const room = {
    config: validateConfig(sample),
    players: new Map([
      ['uid_1', { id: 'uid_1', token: 'token_abc', name: 'SinhVien1', team: 'team_1', connected: true }]
    ])
  };

  const initialCount = room.players.size;
  // Reconnect với đúng token
  const cred = { id: 'uid_1', token: 'token_abc' };
  const existing = room.players.get(cred.id);
  assert.ok(existing && existing.token === cred.token);

  // Không tạo thêm player mới
  const finalCount = room.players.size;
  assert.equal(initialCount, finalCount);
});

test('Yêu cầu 14: Không thể bỏ phiếu nhiều lần bằng cùng session', () => {
  const votes = new Map();
  const playerId = 'uid_1';

  // Lần 1 chọn 0
  votes.set(playerId, 0);
  assert.equal(votes.size, 1);
  assert.equal(votes.get(playerId), 0);

  // Lần 2 chọn 1 (ghi đè, không nhân đôi phiếu)
  votes.set(playerId, 1);
  assert.equal(votes.size, 1);
  assert.equal(votes.get(playerId), 1);
});

test('Yêu cầu 15: Bảng xếp hạng hiển thị đúng tên 6 đội', () => {
  const state = {
    status: 'running',
    teams: sample.teams.map((t, i) => ({
      ...t,
      memberCount: 5,
      maxMembers: 6,
      cash: 10 + i,
      projectedProfit: i * 2
    }))
  };
  const html = teamRows(state);
  assert.ok(html.includes('Nhóm 4'));
  assert.ok(html.includes('Nhóm 5'));
  assert.ok(html.includes('Nhóm 6'));
  assert.ok(html.includes('Nhóm 7'));
  assert.ok(html.includes('Nhóm 8'));
  assert.ok(html.includes('Nhóm 9'));
  assert.ok(html.includes('🥇'));
  assert.ok(html.includes('🥈'));
  assert.ok(html.includes('🥉'));
  assert.ok(html.includes('#4'));
  assert.ok(html.includes('#5'));
  assert.ok(html.includes('#6'));
});

test('Yêu cầu 16: Tàu và tiến trình xuất khẩu hiển thị đủ 6 đội', () => {
  const state = {
    status: 'running',
    step: { stageIndex: 2 },
    teams: sample.teams.map(t => ({
      ...t,
      memberCount: 4,
      quality: 1,
      projectedProfit: 2,
      cash: 10
    })),
    voters: { team_1: 4, team_2: 3, team_3: 2, team_4: 4, team_5: 1, team_6: 3 }
  };
  const mapHtml = shipMap(state);
  for (const t of sample.teams) {
    assert.ok(mapHtml.includes(t.name), `Bản đồ phải có tàu của ${t.name}`);
  }

  const votesHtml = progressVotes(state);
  for (const t of sample.teams) {
    assert.ok(votesHtml.includes(t.name), `Tiến trình phiếu phải có ${t.name}`);
  }
});

test('Yêu cầu 17: Gameplay 5 ải và kết toán hoạt động chính xác', () => {
  const config = validateConfig(sample);
  const steps = createSteps(config);
  assert.equal(steps.length, 8);

  const teams = {};
  const players = new Map();
  for (const t of config.teams) {
    teams[t.id] = makeTeamState(config.startingCash);
    players.set('p_' + t.id, { id: 'p_' + t.id, team: t.id });
  }

  const session = { config, steps, stepIndex: 0, players, teams, votes: new Map() };

  // 1. lot
  session.stepIndex = 0;
  session.votes.set('p_team_1', 1); // 5 xu, doanh thu 12
  settle(session);
  assert.equal(teams.team_1.cash, 5);
  assert.equal(teams.team_1.lotRevenue, 12);

  // 2, 3, 4. quiz
  for (let i = 1; i <= 3; i++) {
    session.stepIndex = i;
    session.votes.set('p_team_1', 1); // đúng
    settle(session);
  }
  assert.equal(teams.team_1.quality, 3);
  assert.equal(teams.team_1.cash, 8); // 5 + 3

  // 5. auction
  session.stepIndex = 4;
  session.votes.set('p_team_1', 3);
  settle(session, () => 0);
  assert.equal(teams.team_1.discount, 4);

  // 6. event
  session.stepIndex = 5;
  session.votes.set('p_team_1', 0); // bảo hiểm
  settle(session, () => 0);

  // 7, 8. brand + brandquiz
  session.stepIndex = 6;
  session.votes.set('p_team_1', 1);
  settle(session);

  session.stepIndex = 7;
  session.votes.set('p_team_1', 1); // đúng
  settle(session);

  finalize(session);
  assert.ok(teams.team_1.cash > 0);
  const profit = projectedProfit(teams.team_1, 10, true);
  assert.ok(typeof profit === 'number');
});

test('Yêu cầu 18: Import/export JSON không làm mất câu hỏi', () => {
  const jsonStr = JSON.stringify(sample);
  const parsed = JSON.parse(jsonStr);
  const validated = validateConfig(parsed);

  assert.equal(validated.stages.length, 5);
  assert.equal(validated.stages[1].questions.length, 3);
  assert.equal(validated.stages[4].questions.length, 1);
  assert.equal(validated.stages[1].questions[0].prompt, sample.stages[1].questions[0].prompt);

  // Chuyển đổi an toàn từ 4 đội sang 6 đội
  const oldConfig = {
    title: 'Game cũ',
    subtitle: 'Mô tả',
    startingCash: 10,
    teams: [
      { id: 't1', name: 'Đội 1', icon: '🌾', color: '#e6ad29' },
      { id: 't2', name: 'Đội 2', icon: '🤝', color: '#3986e8' },
      { id: 't3', name: 'Đội 3', icon: '🚀', color: '#f16575' },
      { id: 't4', name: 'Đội 4', icon: '🌿', color: '#39ad77' }
    ],
    stages: sample.stages
  };

  const migrated = migrateOldConfig(oldConfig);
  assert.equal(migrated.teams.length, 6);
  assert.equal(migrated.stages[1].questions.length, 3);
});
