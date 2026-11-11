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
  migrateOldConfig,
  ALLOWED_GROUP_NUMBERS,
  DEFAULT_TEAM_COUNT,
  DEFAULT_MAX_MEMBERS_PER_TEAM
} = require('../game-core');

function fake() {
  const config = validateConfig(sample);
  const steps = createSteps(config);
  const players = new Map();
  const teams = {};
  for (const team of config.teams) {
    teams[team.id] = makeTeamState(config.startingCash);
    players.set(team.id + 'a', { id: team.id + 'a', team: team.id });
    players.set(team.id + 'b', { id: team.id + 'b', team: team.id });
  }
  return { config, steps, players, teams, stepIndex: 0, votes: new Map() };
}

function voteAll(session, byTeam) {
  session.votes.clear();
  for (const [team, arr] of Object.entries(byTeam)) {
    arr.forEach((n, i) => session.votes.set(team + (i ? 'b' : 'a'), n));
  }
}

function move(session, idx, answers, random = () => 0) {
  session.stepIndex = idx;
  voteAll(session, answers);
  return settle(session, random);
}

test('1. Tạo phòng mặc định có đúng 6 đội', () => {
  const cfg = validateConfig(sample);
  assert.equal(cfg.teams.length, 6);
  assert.equal(cfg.teamCount, 6);
  assert.equal(cfg.maxMembersPerTeam, 6);
  assert.equal(cfg.stages.length, 5);
  assert.equal(createSteps(cfg).length, 8);
  assert.deepEqual(cfg.selectedGroupNumbers, [4, 5, 6, 7, 8, 9]);
  assert.equal(cfg.teams[0].name, 'Nhóm 4');
  assert.equal(cfg.teams[5].name, 'Nhóm 9');
});

test('2. Chọn 6 nhóm trong phạm vi Nhóm 4 đến Nhóm 10', () => {
  const teams = buildTeamsFromGroupNumbers([4, 5, 6, 7, 8, 9]);
  assert.equal(teams.length, 6);
  assert.equal(teams[0].name, 'Nhóm 4');
  assert.equal(teams[5].name, 'Nhóm 9');
  assert.equal(teams[0].id, 'team_1');
  assert.equal(teams[5].id, 'team_6');
});

test('3. Có thể chọn Nhóm 10 thay cho một nhóm khác', () => {
  const teams = buildTeamsFromGroupNumbers([4, 5, 6, 7, 8, 10]);
  assert.equal(teams.length, 6);
  assert.equal(teams[5].name, 'Nhóm 10');
  assert.equal(teams[5].groupNumber, 10);
  assert.equal(teams[5].id, 'team_6'); // ID ổn định, không tự biến thành team_10

  const cfg = structuredClone(sample);
  cfg.teams = teams;
  const validated = validateConfig(cfg);
  assert.equal(validated.teams.length, 6);
  assert.deepEqual(validated.selectedGroupNumbers, [4, 5, 6, 7, 8, 10]);
});

test('4. Không thể chọn 5 hoặc 7 nhóm', () => {
  assert.throws(() => buildTeamsFromGroupNumbers([4, 5, 6, 7, 8]), /Cần chọn chính xác đúng 6 nhóm/);
  assert.throws(() => buildTeamsFromGroupNumbers([4, 5, 6, 7, 8, 9, 10]), /Cần chọn chính xác đúng 6 nhóm/);

  const cfg5 = structuredClone(sample);
  cfg5.teams = cfg5.teams.slice(0, 5);
  assert.throws(() => validateConfig(cfg5), /Cần đúng 6 đội/);

  const cfg7 = structuredClone(sample);
  cfg7.teams.push({ id: 'team_7', name: 'Nhóm 10', icon: '🚢', color: '#0ea5e9', groupNumber: 10 });
  assert.throws(() => validateConfig(cfg7), /Cần đúng 6 đội/);
});

test('5. Không cho chọn nhóm ngoài phạm vi 4–10', () => {
  assert.throws(() => buildTeamsFromGroupNumbers([3, 4, 5, 6, 7, 8]), /Chỉ được chọn từ Nhóm 4 đến Nhóm 10/);
  assert.throws(() => buildTeamsFromGroupNumbers([4, 5, 6, 7, 8, 11]), /Chỉ được chọn từ Nhóm 4 đến Nhóm 10/);

  const cfgInvalid = structuredClone(sample);
  cfgInvalid.teams[0].groupNumber = 3;
  cfgInvalid.teams[0].name = 'Nhóm 3';
  assert.throws(() => validateConfig(cfgInvalid), /4–10/);
});

test('6. Không cho phép tên hoặc ID đội bị trùng', () => {
  // Trùng số nhóm
  assert.throws(() => buildTeamsFromGroupNumbers([4, 4, 5, 6, 7, 8]), /Không được chọn trùng nhóm/);

  // Trùng tên
  const dupName = structuredClone(sample);
  dupName.teams[1].name = dupName.teams[0].name;
  dupName.teams[1].groupNumber = 5;
  assert.throws(() => validateConfig(dupName), /Tên các đội phải khác nhau/);

  // Trùng ID
  const dupId = structuredClone(sample);
  dupId.teams[1].id = dupId.teams[0].id;
  assert.throws(() => validateConfig(dupId), /ID các đội phải khác nhau/);
});

test('7, 8, 9, 10. Đội 3, 4, 5 hoặc 6 người đều tham gia bỏ phiếu và tính điểm công bằng', () => {
  // Kiểm tra majority vote với 3 người
  assert.deepEqual(majority([1, 1, 0], 4).choice, 1);
  assert.equal(majority([0, 1, 2], 4).choice, null); // hòa 3 người

  // Kiểm tra majority vote với 4 người
  assert.deepEqual(majority([1, 1, 1, 0], 4).choice, 1);
  assert.equal(majority([0, 0, 1, 1], 4).choice, null); // hòa 2-2

  // Kiểm tra majority vote với 5 người
  assert.deepEqual(majority([1, 1, 1, 0, 2], 4).choice, 1);

  // Kiểm tra majority vote với 6 người
  assert.deepEqual(majority([2, 2, 2, 2, 0, 1], 4).choice, 2);
  assert.equal(majority([0, 0, 0, 1, 1, 1], 4).choice, null); // hòa 3-3
});

test('17. Gameplay 5 ải và kết toán hoạt động chính xác với 6 đội', () => {
  const s = fake();
  // Ải 1: Chọn lô gạo (team_1 chọn gạo thơm 5 xu, team_2 chọn gạo phổ thông 3 xu)
  const r1 = move(s, 0, { team_1: [1, 1], team_2: [0, 0] });
  assert.equal(s.teams.team_1.cash, 5);
  assert.equal(s.teams.team_1.lotRevenue, 12);
  assert.equal(s.teams.team_2.cash, 7);
  assert.equal(s.teams.team_2.lotRevenue, 8);
  assert.equal(r1.summaries[0].choice, 1);

  // Ải 2: SPS/MRLs Quiz (team_1 đúng, team_2 sai)
  move(s, 1, { team_1: [1, 1], team_2: [0, 0] });
  assert.equal(s.teams.team_1.cash, 6); // 5 + 1
  assert.equal(s.teams.team_1.quality, 1);
  assert.equal(s.teams.team_2.cash, 6); // 7 - 1

  // Quiz câu 2 và 3
  move(s, 2, { team_1: [1, 1] });
  move(s, 3, { team_1: [1, 1] });

  // Ải 3: Đấu giá kín với 6 đội tham gia
  const rAuction = move(s, 4, {
    team_1: [3, 3],
    team_2: [2, 2],
    team_3: [1, 1],
    team_4: [0, 0],
    team_5: [0, 0],
    team_6: [0, 0]
  });
  // Chỉ 2 đội thắng đấu giá (slots = 2)
  const winners = rAuction.summaries.filter(x => x.won);
  assert.equal(winners.length, 2);
  assert.equal(s.teams.team_1.discount, 4);
  assert.equal(s.teams.team_2.discount, 4);

  // Ải 4: Biến cố logistics
  const rEvent = move(s, 5, { team_1: [0, 0], team_2: [1, 1] }, () => 0); // rng 0 < 65 => bad event
  assert.equal(rEvent.event.bad, true);
  // team_1 mua bảo hiểm (tốn 2, không mất thêm): 8 - 2 = 6 (hoặc trừ tương ứng)

  // Ải 5: Xây dựng thương hiệu và quiz thương hiệu
  move(s, 6, { team_1: [1, 1] }); // đầu tư thương hiệu Việt (cost 2, bonus 6 if quiz correct)
  move(s, 7, { team_1: [1, 1] }); // trả lời đúng
  assert.equal(s.teams.team_1.brandBonus, 6);

  // Kết toán chung cuộc
  finalize(s);
  assert.ok(s.teams.team_1.cash > 0);
  assert.ok(typeof projectedProfit(s.teams.team_1, 10, true) === 'number');
});

test('18. Import/export JSON không làm mất câu hỏi và hỗ trợ chuyển đổi an toàn từ 4 đội', () => {
  // Xuất rồi nhập JSON chuẩn 6 đội
  const exported = JSON.stringify(sample);
  const reimported = JSON.parse(exported);
  const validated = validateConfig(reimported);
  assert.equal(validated.stages[1].questions.length, 3);
  assert.equal(validated.stages[4].questions.length, 1);
  assert.equal(validated.teams.length, 6);

  // Nhập dữ liệu cũ có 4 đội: bị chặn an toàn và yêu cầu chuyển đổi
  const old4TeamsConfig = structuredClone(sample);
  old4TeamsConfig.teams = [
    { id: 'rice', name: 'Đội Hạt Ngọc', icon: '🌾', color: '#e6ad29' },
    { id: 'trade', name: 'Đội Hội Nhập', icon: '🤝', color: '#3986e8' },
    { id: 'rise', name: 'Đội Vươn Xa', icon: '🚀', color: '#f16575' },
    { id: 'delta', name: 'Đội Đồng Bằng', icon: '🌿', color: '#39ad77' }
  ];
  assert.throws(() => validateConfig(old4TeamsConfig), /Cấu hình cũ gồm 4 đội/);

  // Chuyển đổi an toàn qua migrateOldConfig giữ nguyên câu hỏi và 5 ải
  const upgraded = migrateOldConfig(old4TeamsConfig);
  assert.equal(upgraded.teams.length, 6);
  assert.equal(upgraded.teams[0].name, 'Nhóm 4');
  assert.equal(upgraded.stages[1].questions[0].prompt, sample.stages[1].questions[0].prompt);
  assert.equal(upgraded.stages[4].questions[0].prompt, sample.stages[4].questions[0].prompt);
});

test('Regression Bug 1: Boolean needsQuiz được giữ nguyên giá trị, cơ chế thưởng ải thương hiệu hoạt động đúng', () => {
  const cfg = validateConfig(sample);
  const brandOptions = cfg.stages.find(s => s.type === 'brand').options;
  assert.equal(brandOptions[0].needsQuiz, false, 'Lựa chọn bán qua nhà phân phối không cần quiz');
  assert.equal(brandOptions[1].needsQuiz, true, 'Lựa chọn đầu tư thương hiệu Việt cần quiz');

  // Case A: Đội chọn option 0 (needsQuiz: false) -> nhận thưởng ngay 2 xu, không phụ thuộc quiz
  const sA = fake();
  move(sA, 6, { team_1: [0, 0] }); // chọn option 0 (cost 0, bonus 2, needsQuiz false)
  assert.equal(sA.teams.team_1.brandBonus, 2, 'Nhận thưởng 2 xu ngay khi chọn không cần quiz');
  move(sA, 7, { team_1: [0, 0] }); // trả lời sai câu hỏi ở step 7
  assert.equal(sA.teams.team_1.brandBonus, 2, 'Vẫn giữ 2 xu thưởng vì không yêu cầu quiz');

  // Case B: Đội chọn option 1 (needsQuiz: true) -> ban đầu bonus = 0, chỉ nhận 6 xu nếu giải đúng quiz
  const sB = fake();
  move(sB, 6, { team_1: [1, 1] }); // chọn option 1 (cost 2, bonus 6, needsQuiz true)
  assert.equal(sB.teams.team_1.brandBonus, 0, 'Chưa nhận thưởng khi chưa giải quiz');
  move(sB, 7, { team_1: [0, 0] }); // trả lời sai
  assert.equal(sB.teams.team_1.brandBonus, 0, 'Không nhận thưởng do trả lời sai');

  const sC = fake();
  move(sC, 6, { team_1: [1, 1] }); // chọn option 1
  move(sC, 7, { team_1: [1, 1] }); // trả lời đúng
  assert.equal(sC.teams.team_1.brandBonus, 6, 'Nhận thưởng 6 xu khi giải đúng câu hỏi');
});

test('Regression Bug 2: Bắt buộc maxMembersPerTeam = 6 ở backend, từ chối JSON có giới hạn khác 6', () => {
  // Chấp nhận cấu hình chuẩn có maxMembersPerTeam = 6
  const validCfg = structuredClone(sample);
  validCfg.maxMembersPerTeam = 6;
  const res1 = validateConfig(validCfg);
  assert.equal(res1.maxMembersPerTeam, 6);

  // Cấu hình không khai báo maxMembersPerTeam tự gán mặc định = 6
  const omittedCfg = structuredClone(sample);
  delete omittedCfg.maxMembersPerTeam;
  const res2 = validateConfig(omittedCfg);
  assert.equal(res2.maxMembersPerTeam, 6);

  // Từ chối các giá trị khác 6
  for (const badVal of [1, 5, 7, 30, 0, -1, '6', null]) {
    const invalidCfg = structuredClone(sample);
    invalidCfg.maxMembersPerTeam = badVal;
    assert.throws(
      () => validateConfig(invalidCfg),
      /Số thành viên tối đa mỗi đội phải bằng 6/,
      `Phải từ chối maxMembersPerTeam = ${badVal}`
    );
  }
});
