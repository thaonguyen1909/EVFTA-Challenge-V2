'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function fakeExpress() {
  const fn = (_req, _res) => {};
  fn.disable = () => {};
  fn.use = () => {};
  fn.get = () => {};
  return fn;
}
fakeExpress.static = () => () => {};

let liveIo;
class FakeSocket {
  constructor(io, id) {
    this.id = id;
    this.io = io;
    this.data = {};
    this.handlers = {};
    this.outbound = [];
    io.sockets.sockets.set(id, this);
  }
  on(name, fn) { this.handlers[name] = fn; }
  emit(name, data) { this.outbound.push({ name, data }); }
  join(room) {
    if (!this.io.sockets.adapter.rooms.has(room)) this.io.sockets.adapter.rooms.set(room, new Set());
    this.io.sockets.adapter.rooms.get(room).add(this.id);
  }
  leave(room) { this.io.sockets.adapter.rooms.get(room)?.delete(this.id); }
  send(name, args) {
    let output;
    this.handlers[name](args, (v) => { output = v; });
    return output;
  }
  latest(name) {
    return [...this.outbound].reverse().find(x => x.name === name)?.data;
  }
}

class FakeIo {
  constructor() {
    this.sockets = { sockets: new Map(), adapter: { rooms: new Map() } };
    this.next = 0;
    liveIo = this;
  }
  on(name, fn) { if (name === 'connection') this.onConnection = fn; }
  connect() {
    const s = new FakeSocket(this, 'sock' + (++this.next));
    this.onConnection(s);
    return s;
  }
}

const oldLoad = Module._load;
process.env.HOST_PASSWORD = 'test-pass-must-never-be-public';
Module._load = function (name, parent, isMain) {
  if (name === 'dotenv') return { config() {} };
  if (name === 'express') return fakeExpress;
  if (name === 'socket.io') return { Server: FakeIo };
  return oldLoad.call(this, name, parent, isMain);
};

const serverModule = require('../server');
Module._load = oldLoad;

const { teamRows, shipMap, progressVotes } = require('../public/common');

test('Socket workflow: 6 teams, max 6 members, reconnect, voting, lock, and UI verification', () => {
  const host = liveIo.connect();

  // 1. Host auth & phòng mặc định 6 đội
  const wrong = host.send('host:create', { password: 'wrong' });
  assert.equal(wrong.ok, false);

  const made = host.send('host:create', { password: process.env.HOST_PASSWORD });
  assert.equal(made.ok, true);
  const code = made.code;
  assert.match(code, /^\d{6}$/);

  const hostInitState = host.latest('room:state');
  assert.equal(hostInitState.role, 'host');
  assert.equal(hostInitState.teams.length, 6);
  assert.equal(hostInitState.maxMembersPerTeam, 6);
  assert.equal(hostInitState.totalCapacity, 36);
  assert.deepEqual(hostInitState.selectedGroupNumbers, [4, 5, 6, 7, 8, 9]);

  // 2. Host đổi nhóm sang Nhóm 10 (FR01, FR04)
  const setTeamsFail = host.send('host:set-teams', { groupNumbers: [4, 5, 6, 7, 8] }); // 5 nhóm => lỗi
  assert.equal(setTeamsFail.ok, false);

  const setTeamsOk = host.send('host:set-teams', { groupNumbers: [4, 5, 6, 7, 8, 10] });
  assert.equal(setTeamsOk.ok, true);
  const hostUpdatedState = host.latest('room:state');
  assert.deepEqual(hostUpdatedState.selectedGroupNumbers, [4, 5, 6, 7, 8, 10]);
  assert.equal(hostUpdatedState.teams[5].name, 'Nhóm 10');
  assert.equal(hostUpdatedState.teams[5].id, 'team_6'); // ID ổn định

  // 3. Khóa/mở đăng ký tham gia (FR04)
  const lockRes = host.send('host:toggle-lock', { locked: true });
  assert.equal(lockRes.ok, true);
  assert.equal(lockRes.locked, true);

  const testBlocked = liveIo.connect();
  const blockedJoin = testBlocked.send('player:join', { code, name: 'BiKhoa', team: 'team_1' });
  assert.equal(blockedJoin.ok, false);
  assert.match(blockedJoin.error, /khóa/);

  // Mở lại đăng ký
  const unlockRes = host.send('host:toggle-lock', { locked: false });
  assert.equal(unlockRes.ok, true);
  assert.equal(unlockRes.locked, false);

  // 4. FR02: Tối đa 6 thành viên mỗi đội & Người thứ 7 bị từ chối
  const team1Sockets = [];
  for (let i = 1; i <= 6; i++) {
    const s = liveIo.connect();
    const res = s.send('player:join', { code, name: `SinhVien_${i}`, team: 'team_1' });
    assert.equal(res.ok, true, `Sinh viên ${i} phải vào được`);
    team1Sockets.push({ sock: s, cred: res.credential });
  }

  // Người thứ 7 vào team_1 phải bị từ chối với thông báo chính xác
  const s7 = liveIo.connect();
  const res7 = s7.send('player:join', { code, name: 'SinhVien_7', team: 'team_1' });
  assert.equal(res7.ok, false);
  assert.equal(res7.error, 'Đội đã đủ 6 thành viên. Vui lòng chọn đội khác.');

  // Nhưng người thứ 7 chọn team_2 thì vào được bình thường (sức chứa team_2 còn trống)
  const res7Team2 = s7.send('player:join', { code, name: 'SinhVien_7', team: 'team_2' });
  assert.equal(res7Team2.ok, true);

  // 5. FR04: Không được xóa nhóm đang có thành viên
  const tryRemoveTeam1 = host.send('host:set-teams', { groupNumbers: [5, 6, 7, 8, 9, 10] }); // Bỏ nhóm 4 (team_1 đang có 6 người)
  assert.equal(tryRemoveTeam1.ok, false);
  assert.match(tryRemoveTeam1.error, /Không thể bỏ/);

  // 6. FR03: Reconnection & Duplicate Prevention
  // Thử kết nối lại bằng credential của SinhVien_1:
  const reconnectSocket = liveIo.connect();
  const memCountBefore = serverModule.rooms.get(code).players.size;
  const reconRes = reconnectSocket.send('player:join', {
    code,
    credential: team1Sockets[0].cred
  });
  assert.equal(reconRes.ok, true);
  assert.equal(reconRes.name, 'SinhVien_1');
  assert.equal(reconRes.team, 'team_1');
  const memCountAfter = serverModule.rooms.get(code).players.size;
  assert.equal(memCountBefore, memCountAfter, 'Reconnect không được làm tăng số thành viên');

  // 7. Spectator watch
  const spectator = liveIo.connect();
  assert.equal(spectator.send('room:watch', { code }).ok, true);

  // 8. Bắt đầu trận đấu & Bỏ phiếu
  assert.equal(host.send('host:next', {}).ok, true);
  const runningState = reconnectSocket.latest('room:state');
  assert.equal(runningState.status, 'running');

  // Khi trận đấu đang chạy, Host không thể thay đổi danh sách đội
  const changeWhileRunning = host.send('host:set-teams', { groupNumbers: [4, 5, 6, 7, 8, 9] });
  assert.equal(changeWhileRunning.ok, false);

  // Bỏ phiếu: Một session chỉ có 1 phiếu (phiếu sau ghi đè)
  const vote1 = reconnectSocket.send('player:vote', { choice: 0 });
  assert.equal(vote1.ok, true);
  const vote1Again = reconnectSocket.send('player:vote', { choice: 1 });
  assert.equal(vote1Again.ok, true);
  assert.equal(reconnectSocket.latest('room:state').me.vote, 1);
  assert.equal(serverModule.rooms.get(code).votes.size, 1); // Vẫn chỉ là 1 phiếu của người đó

  // Sinh viên team 2 bỏ phiếu
  s7.send('player:vote', { choice: 0 });

  // 9. Chốt lượt & Review
  assert.equal(host.send('host:close', {}).ok, true);
  const reviewState = reconnectSocket.latest('room:state');
  assert.equal(reviewState.status, 'review');
  assert.equal(reviewState.result.summaries.length, 2); // 2 đội có thành viên

  // 10. Kiểm tra hiển thị giao diện UI (teamRows, shipMap, progressVotes cho 6 đội)
  const rowsHtml = teamRows(reviewState);
  assert.ok(rowsHtml.includes('Nhóm 4'));
  assert.ok(rowsHtml.includes('Nhóm 10'));
  assert.ok(rowsHtml.includes('#4'));
  assert.ok(rowsHtml.includes('#5'));
  assert.ok(rowsHtml.includes('#6'));

  const boatsHtml = shipMap(reviewState);
  assert.ok(boatsHtml.includes('sea-map'));
  assert.ok(boatsHtml.includes('Nhóm 4'));

  const progressHtml = progressVotes(reviewState);
  assert.ok(progressHtml.includes('Nhóm 4'));
  assert.ok(progressHtml.includes('Nhóm 10'));

  // 11. Reset phòng
  assert.equal(host.send('host:reset', {}).ok, true);
  assert.equal(host.latest('room:state').status, 'lobby');
  assert.equal(serverModule.rooms.get(code).teams.team_1.cash, 10);
});

test('Regression Bug 3: Đổi danh sách nhóm giữ nguyên thành viên Nhóm 5 khi đổi từ 5–10 sang 4–9', () => {
  // 1. Host tạo phòng và ban đầu chọn Nhóm 5–10
  const host = liveIo.connect();
  const createRes = host.send('host:create', { password: 'test-pass-must-never-be-public' });
  assert.equal(createRes.ok, true);
  const code = createRes.code;

  const set5to10 = host.send('host:set-teams', { groupNumbers: [5, 6, 7, 8, 9, 10] });
  assert.equal(set5to10.ok, true);
  const state1 = host.latest('room:state');
  assert.deepEqual(state1.selectedGroupNumbers, [5, 6, 7, 8, 9, 10]);

  // Nhóm 5 ở vị trí đầu tiên trong danh sách 5–10
  const team5Before = state1.teams.find(t => t.groupNumber === 5);
  assert.ok(team5Before);
  assert.equal(team5Before.name, 'Nhóm 5');
  const teamIdBefore = team5Before.id; // team_1

  // 2. Sinh viên A tham gia Nhóm 5
  const studentSock = liveIo.connect();
  const joinRes = studentSock.send('player:join', { code, name: 'SinhVienA', team: teamIdBefore });
  assert.equal(joinRes.ok, true);
  assert.equal(joinRes.team, teamIdBefore);

  // 3. Host đổi sang Nhóm 4–9 (Nhóm 5 vẫn được giữ lại)
  const set4to9 = host.send('host:set-teams', { groupNumbers: [4, 5, 6, 7, 8, 9] });
  assert.equal(set4to9.ok, true);

  // 4. Sinh viên A vẫn phải thuộc Nhóm 5
  const room = serverModule.rooms.get(code);
  const playerA = [...room.players.values()].find(p => p.name === 'SinhVienA');
  assert.ok(playerA, 'Sinh viên A phải tồn tại trong phòng');

  const teamAfter = room.config.teams.find(t => t.id === playerA.team);
  assert.ok(teamAfter, 'Đội của Sinh viên A phải tồn tại trong cấu hình');
  assert.equal(teamAfter.groupNumber, 5, 'Sinh viên A vẫn phải thuộc Nhóm 5');
  assert.equal(teamAfter.name, 'Nhóm 5', 'Tên nhóm của Sinh viên A vẫn phải là Nhóm 5');

  // Kiểm tra qua snapshot client của Sinh viên A
  const studentState = studentSock.latest('room:state');
  assert.equal(studentState.me.name, 'SinhVienA');
  const studentMyTeam = studentState.teams.find(t => t.id === studentState.me.team);
  assert.ok(studentMyTeam);
  assert.equal(studentMyTeam.groupNumber, 5, 'Snapshot client: Sinh viên A phải thuộc Nhóm 5');
  assert.equal(studentMyTeam.name, 'Nhóm 5');
  assert.equal(studentMyTeam.memberCount, 1);
});

test('host:config khong doi nhom nguoi choi', () => {
  const host = liveIo.connect();

  const created = host.send('host:create', {
    password: process.env.HOST_PASSWORD
  });

  assert.equal(created.ok, true);

  const code = created.code;
  const student = liveIo.connect();

  assert.equal(student.send('player:join', {
    code,
    name: 'SV Nhom 4',
    team: 'team_1'
  }).ok, true);

  const room = serverModule.rooms.get(code);
  const changed = JSON.parse(JSON.stringify(room.config));

  // Thử hoán đổi Nhóm 4 và Nhóm 5.
  changed.teams[0].groupNumber = 5;
  changed.teams[0].name = 'Nhóm 5';

  changed.teams[1].groupNumber = 4;
  changed.teams[1].name = 'Nhóm 4';

  const rejected = host.send('host:config', {
    config: changed
  });

  assert.equal(rejected.ok, false);

  // Thành viên phải vẫn thuộc Nhóm 4.
  const player = [...room.players.values()].find(
    p => p.name === 'SV Nhom 4'
  );

  const team = room.config.teams.find(
    t => t.id === player.team
  );

  assert.equal(team.groupNumber, 4);

  // Chỉnh câu hỏi/thông tin chung vẫn phải được phép.
  const config2 = JSON.parse(JSON.stringify(room.config));
  config2.title = 'Bo cau hoi moi';

  const accepted = host.send('host:config', {
    config: config2
  });

  assert.equal(accepted.ok, true);
});

test('Doi trong khong dung dau bang xep hang', () => {
  const html = teamRows({
    status: 'running',
    teams: [
      {
        id: 'empty',
        name: 'Doi Trong',
        icon: '🌾',
        color: '#000000',
        memberCount: 0,
        cash: 10,
        projectedProfit: 0
      },
      {
        id: 'active',
        name: 'Doi Co Nguoi',
        icon: '🚢',
        color: '#111111',
        memberCount: 3,
        cash: 5,
        projectedProfit: -5
      }
    ]
  });

  assert.ok(
    html.indexOf('Doi Co Nguoi') <
    html.indexOf('Doi Trong')
  );
});
