'use strict';
const socket=io();let state=null,selectedTeam='rice';
const baseTeams=[{id:'rice',name:'Đội Hạt Ngọc',icon:'🌾',color:'#e6ad29'},{id:'trade',name:'Đội Hội Nhập',icon:'🤝',color:'#3986e8'},{id:'rise',name:'Đội Vươn Xa',icon:'🚀',color:'#f16575'},{id:'delta',name:'Đội Đồng Bằng',icon:'🌿',color:'#39ad77'}];
const saved=()=>{try{return JSON.parse(localStorage.getItem('evfta:player')||'null');}catch{return null;}};
const save=(data)=>localStorage.setItem('evfta:player',JSON.stringify(data));
const qsCode=new URLSearchParams(location.search).get('room');
if(qsCode)$('#roomCode').value=qsCode;
function showMessage(msg){$('#joinError').textContent=msg||'';}
function renderPicker(teams=baseTeams){$('#teamPicker').innerHTML=teams.map(t=>`<button type="button" class="pick-card ${selectedTeam===t.id?'selected':''}" data-team="${esc(t.id)}" style="--team:${esc(t.color)}"><span class="pick-icon">${esc(t.icon)}</span><span><strong>${esc(t.name)}</strong><small>${fmt(t.memberCount||0)} thành viên</small></span><span class="radio-circle"></span></button>`).join('');$$('[data-team]',$('#teamPicker')).forEach(btn=>btn.addEventListener('click',()=>{selectedTeam=btn.dataset.team;renderPicker(teams);}));}
function peekRoom(){const code=$('#roomCode').value.trim();if(!/^\d{6}$/.test(code))return;socket.emit('room:peek',{code},r=>{if(r.ok)renderPicker(r.teams);else showMessage(r.error);});}
$('#roomCode').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,6);if(e.target.value.length===6)peekRoom();});
function join(credential=null){const code=$('#roomCode').value.trim(),name=$('#nickname').value.trim();if(!/^\d{6}$/.test(code))return showMessage('Mã phòng phải gồm 6 chữ số.');if(!credential&&name.length<2)return showMessage('Vui lòng nhập tên ít nhất 2 ký tự.');
  $('#joinBtn').disabled=true;socket.emit('player:join',{code,name,team:selectedTeam,credential},r=>{
    $('#joinBtn').disabled=false;
    if(!r.ok){showMessage(r.error);if(credential)localStorage.removeItem('evfta:player');return;}
    showMessage('');save({code:r.code,credential:r.credential,name:r.name,team:r.team});$('#joinSection').hidden=true;$('#gameSection').hidden=false;
  });
}
$('#joinBtn').addEventListener('click',()=>join());
$('#leaveBtn').addEventListener('click',()=>{if(!confirm('Rời đội hiện tại để chọn đội khác?'))return;socket.emit('player:leave',{},r=>{if(!r.ok)return alert(r.error);localStorage.removeItem('evfta:player');location.href='/play';});});
socket.on('connect',()=>{setNet(true);const old=saved();if(old){$('#roomCode').value=old.code;$('#nickname').value=old.name;selectedTeam=old.team;join(old.credential);}else if($('#roomCode').value.length===6)peekRoom();});
socket.on('disconnect',()=>setNet(false));
socket.on('room:state',s=>{state=s;window.serverOffset=Date.now()-s.serverNow;if(!s.me)return;render();});
function render(){if(!state)return;
  $('#joinSection').hidden=true;$('#gameSection').hidden=false;$('.player-intro').hidden=true;$('#leaveBtn').hidden=state.status!=='lobby';
  const myTeam=state.teams.find(t=>t.id===state.me.team)||state.teams[0];
  $('#playerRoom').textContent=`PHÒNG ${state.code} · ${statusText(state.status)}`;
  $('#playerTeamTitle').textContent=`${myTeam.icon} ${myTeam.name}`;$('#playerName').textContent=`Người chơi: ${state.me.name}`;
  $('#playerCash').textContent=`${fmt(myTeam.cash)} xu`;
  $('#playerScores').innerHTML=teamRows(state);$('#playerStages').innerHTML=stageList(state,true);
  const box=$('#playerChallenge');if(state.status==='lobby'){box.innerHTML=`<div class="empty-state"><div class="emoji">⌛</div><h2>Đã vào ${esc(myTeam.name)}!</h2><p>Phòng có ${state.teams.reduce((a,t)=>a+t.memberCount,0)} người chơi. Host sẽ bắt đầu khi mọi người đã sẵn sàng.</p><p><b>Chiến thắng = tổng vốn cuối game trừ vốn ban đầu.</b> Số người đông không làm đội có thêm xu.</p></div>`;return;}
  if(state.status==='finished'){
    const rank=[...state.teams].filter(t=>t.active).sort((a,b)=>b.projectedProfit-a.projectedProfit);
    box.innerHTML=`<div class="empty-state"><div class="emoji">🏆</div><h2>Đã cập cảng châu Âu!</h2><p>Đội thắng: <b>${esc(rank[0]?.icon||'')} ${esc(rank[0]?.name||'Chưa có đội')}</b> với lợi nhuận <b>${fmt(rank[0]?.projectedProfit||0)} xu</b>.</p><p>Host có thể chọn "Chơi lại" để mở ván mới.</p></div>`;return;
  }
  const step=state.step,currentVote=state.me.vote;
  const review=state.status==='review';
  const currentTeamResult=state.result?.summaries.find(r=>r.team===state.me.team);
  box.innerHTML=`<div class="step-head"><span class="step-badge">${esc(step.icon)} Ải ${step.stageIndex+1}/5 · ${esc(stepLabel(step))}</span><span class="timer-inline" data-timer>${review?'Đã chốt':'-- giây'}</span></div><h2>${esc(step.title)}${step.questionNo?` <small>Câu ${step.questionNo}/${step.questionTotal}</small>`:''}</h2>${step.prompt?`<div class="question-prompt">${esc(step.prompt)}</div>`:`<p class="step-description">${esc(step.description)}</p>`}${step.kind==='auction'?`<p class="question-help">🔒 Đấu giá kín: giá đặt của đội chỉ được công bố sau khi tất cả đã bỏ phiếu xong.</p>`:''}<div class="options-vote">${step.options.map((o,i)=>`<button type="button" class="vote-option ${currentVote===i?'active':''}" data-choice="${i}" ${review?'disabled':''}><span class="option-letter">${step.kind==='quiz'||step.kind==='brandquiz'?'ABCD'[i]:i}</span><span><strong>${esc(o.label)}</strong>${o.detail?`<small>${esc(o.detail)}</small>`:''}</span>${currentVote===i?'✅':''}</button>`).join('')}</div>${review?`<div class="vote-confirm">🔒 Lượt đã đóng. ${currentTeamResult?`Đội bạn: ${esc(currentTeamResult.note)}`:'Chưa có kết quả cho đội.'}</div>${step.correct!==undefined?`<div class="explain">✅ Đáp án đúng: ${'ABCD'[step.correct]} — ${esc(step.explanation)}</div>`:''}${resultInfo(state)}<p class="question-help">Chờ host bắt đầu thử thách tiếp theo.</p>`:currentVote!==null?`<div class="vote-confirm">✅ Bạn đã bình chọn. Có thể đổi lựa chọn trước khi hết giờ.</div>`:`<p class="question-help">🗳️ Chọn một đáp án/chiến lược. Kết quả cuối cùng được tính theo đa số của đội.</p>`}`;
  if(!review)$$('[data-choice]',box).forEach(btn=>btn.addEventListener('click',()=>{
    socket.emit('player:vote',{choice:Number(btn.dataset.choice)},r=>{if(!r.ok)alert(r.error);});
  }));
}
setInterval(()=>{if(!state||state.status!=='running')return;const t=voteElapsed(state);$$('[data-timer]').forEach(el=>el.textContent=`⏱ ${t} giây`);},250);
renderPicker();
