'use strict';
const socket=io();let state=null,working=null,dirty=false,activeStage=-1,activeQuestion=0,activeTab='editor',roomCode=null,hostPw='';
const setNotice=(s)=>{$('#hostNotice').textContent=s||'';};
const setAuthError=(s)=>{$('#authError').textContent=s||'';};
const updateDirty=()=>{dirty=true;$('#dirtyBadge').hidden=false;};
const hostSession=()=>{try{return JSON.parse(sessionStorage.getItem('evfta:host')||'null');}catch{return null;}};
function attach(code,pw){socket.emit('host:attach',{code,password:pw},r=>{if(!r.ok){setAuthError(r.error);sessionStorage.removeItem('evfta:host');$('#hostAuth').hidden=false;$('#hostWorkspace').hidden=true;}else onAuth(r.code,pw);});}
function onAuth(code,pw){roomCode=code;hostPw=pw;sessionStorage.setItem('evfta:host',JSON.stringify({code,password:pw}));$('#hostAuth').hidden=true;$('#hostWorkspace').hidden=false;$('#hostCode').textContent=code;setAuthError('');}
$('#newRoom').addEventListener('click',()=>{const pw=$('#hostPassword').value;if(!pw)return setAuthError('Vui lòng nhập mật khẩu host.');socket.emit('host:create',{password:pw},r=>{if(!r.ok)return setAuthError(r.error);working=null;dirty=false;onAuth(r.code,pw);});});
$('#attachRoom').addEventListener('click',()=>{const pw=$('#hostPassword').value,code=$('#oldRoom').value.trim();if(!pw||!/^\d{6}$/.test(code))return setAuthError('Nhập mật khẩu và mã phòng gồm 6 chữ số.');attach(code,pw);});
socket.on('connect',()=>{setNet(true);const sess=hostSession();if(sess)attach(sess.code,sess.password);});socket.on('disconnect',()=>setNet(false));
socket.on('host:replaced',()=>{sessionStorage.removeItem('evfta:host');$('#hostAuth').hidden=false;$('#hostWorkspace').hidden=true;setAuthError('Một host khác đã tiếp quản phòng.');});
socket.on('room:state',s=>{if(s.role!=='host')return;state=s;window.serverOffset=Date.now()-s.serverNow;onAuth(s.code,hostPw||hostSession()?.password);if(!working||!dirty){working=JSON.parse(JSON.stringify(s.config));dirty=false;}
  renderMonitor();renderStageNav();if(activeTab==='editor'&&!document.activeElement?.closest('#editorBody'))renderEditor();
});
function action(name){socket.emit(name,{},r=>{if(!r.ok)setNotice(`⚠️ ${r.error}`);else setNotice('');});}
$('#nextBtn').addEventListener('click',()=>action('host:next'));
$('#closeBtn').addEventListener('click',()=>action('host:close'));
$('#resetBtn').addEventListener('click',()=>{if(confirm('Chơi lại sẽ xóa toàn bộ kết quả, phiếu bầu và vốn trong trận. Bạn có chắc?')){dirty=false;action('host:reset');}});
$('#screenBtn').addEventListener('click',()=>{if(!roomCode)return;window.open(`/screen?room=${roomCode}`,'_blank','noopener');});
$('#playerLinkBtn').addEventListener('click',async()=>{const url=`${location.origin}/play?room=${roomCode}`;try{await navigator.clipboard.writeText(url);setNotice('✅ Đã sao chép link tham gia: '+url);}catch{prompt('Sao chép link tham gia:',url);}});
$('#copyCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(roomCode);setNotice('✅ Đã sao chép mã phòng.');}catch{prompt('Mã phòng:',roomCode);}});
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.tab;$$('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));$('#editTab').hidden=activeTab!=='editor';$('#controlTab').hidden=activeTab!=='control';if(activeTab==='editor')renderEditor();else renderMonitor();}));
function renderMonitor(){if(!state)return;
  $('#hostCode').textContent=state.code;
  $('#statusChip').textContent=statusText(state.status);
  $('#membersInfo').textContent=`${state.teams.reduce((n,t)=>n+t.memberCount,0)} thành viên • ${state.stepsTotal} lượt`;
  $('#nextBtn').hidden=!['lobby','review'].includes(state.status);
  $('#nextBtn').textContent=state.status==='lobby'?'▶ Bắt đầu trận':state.stepIndex===state.stepsTotal-1?'🏁 Kết toán & kết thúc':'▶ Ải / câu tiếp theo';
  $('#closeBtn').hidden=state.status!=='running';
  $('#saveConfig').disabled=state.status!=='lobby';
  $('#previewStat').innerHTML=`<div class="summary-stat"><span>Trạng thái</span><b>${esc(statusText(state.status))}</b></div><div class="summary-stat"><span>Lượt đã qua</span><b>${Math.max(0,state.stepIndex+Number(state.status!=='running'&&state.stepIndex>=0))}/${state.stepsTotal}</b></div><div class="summary-stat"><span>Vốn khởi đầu</span><b>${state.startingCash} xu</b></div><div class="summary-stat"><span>Số người chơi</span><b>${state.teams.reduce((n,t)=>n+t.memberCount,0)}</b></div>`;
  $('#hostTeams').innerHTML=state.teams.map(teamLine).join('');
  $('#hostMap').innerHTML=shipMap(state,true);
  $('#hostTask').innerHTML=`<div class="mission-card">${stepCard(state)}</div>`;
  $('#hostScores').innerHTML=teamRows(state);
  $('#hostVoters').innerHTML=progressVotes(state);
  $('#hostHistory').innerHTML=`<div class="history-mini"><h3>📋 Nhật ký trận đấu</h3>${state.history.slice().reverse().map(h=>`<div>${esc(h.stageTitle)} — ${h.summaries.length} đội đã hoàn thành</div>`).join('')||'<div>Chưa có lượt nào được chốt.</div>'}</div>`;
}
function renderStageNav(){if(!working)return;
  $('#stageNav').innerHTML=`<button class="stage-nav-button ${activeStage===-1?'active':''}" data-stage="-1"><span>⚙️</span><span>Cài đặt chung<small>Tên game, đội, số xu</small></span></button>`+working.stages.map((s,i)=>`<button class="stage-nav-button ${activeStage===i?'active':''}" data-stage="${i}"><span>${esc(s.icon)}</span><span>Ải ${i+1}: ${esc(s.title)}<small>${s.questions?.length?`${s.questions.length} câu hỏi • `:''}${s.duration} giây/lượt</small></span></button>`).join('');
  $$('[data-stage]',$('#stageNav')).forEach(b=>b.addEventListener('click',()=>{activeStage=Number(b.dataset.stage);activeQuestion=0;renderStageNav();renderEditor();}));
}
const field=(title,path,val,opts={})=>{let input='';const common=`data-path="${esc(path)}" ${opts.num?'data-num="1"':''} ${opts.bool?'data-bool="1"':''}`;if(opts.bool){input=`<input type="checkbox" ${common} ${val?'checked':''} style="width:auto">`;}else if(opts.textarea){input=`<textarea ${common} rows="3">${esc(val)}</textarea>`;}else if(opts.select){input=`<select ${common}>${opts.select.map(o=>`<option value="${esc(o.value)}" ${String(val)===String(o.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;}else{input=`<input ${common} type="${opts.num?'number':'text'}" value="${esc(val)}" ${opts.num?'min="0" max="120"':''}>`;}return `<label>${esc(title)}${input}</label>`;};
function optionFields(stageIndex,fields){const s=working.stages[stageIndex];return s.options.map((o,j)=>`<div class="line-option"><h4>Phương án ${j+1}</h4>${field('Tên phương án',`stages.${stageIndex}.options.${j}.label`,o.label)}${field('Mô tả',`stages.${stageIndex}.options.${j}.detail`,o.detail)}<div class="field-group ${fields.length===3?'three':''}">${fields.map(x=>field(x.title,`stages.${stageIndex}.options.${j}.${x.key}`,o[x.key],{num:x.key!=='needsQuiz',bool:x.key==='needsQuiz'})).join('')}</div></div>`).join('');}
function questionEditor(i){const s=working.stages[i],q=s.questions[Math.min(activeQuestion,s.questions.length-1)]||s.questions[0];activeQuestion=Math.min(activeQuestion,s.questions.length-1);
  return `<h3>📘 Bộ câu hỏi trong ải (${s.questions.length})</h3><div class="question-tabs">${s.questions.map((_,j)=>`<button type="button" class="question-tab ${j===activeQuestion?'active':''}" data-q="${j}">Câu ${j+1}</button>`).join('')}<button class="question-tab" id="addQuestion">＋ Thêm câu</button><button class="question-tab" id="removeQuestion">🗑️ Xóa câu</button></div>`+
  field('Nội dung câu hỏi',`stages.${i}.questions.${activeQuestion}.prompt`,q.prompt,{textarea:true})+
  q.options.map((x,j)=>field(`Đáp án ${'ABCD'[j]}`,`stages.${i}.questions.${activeQuestion}.options.${j}`,x)).join('')+
  field('Đáp án đúng',`stages.${i}.questions.${activeQuestion}.correct`,q.correct,{select:[0,1,2,3].map(x=>({label:`${'ABCD'[x]}`,value:x})),num:true})+
  field('Giải thích đáp án (hiện sau khi chốt)',`stages.${i}.questions.${activeQuestion}.explanation`,q.explanation,{textarea:true});
}
function renderEditor(){if(!working)return;$('#dirtyBadge').hidden=!dirty;
  const disabled=state&&state.status!=='lobby';
  if(activeStage===-1){$('#editHeading').textContent='⚙️ Cài đặt chung';
    $('#editorBody').innerHTML=field('Tên game','title',working.title)+field('Phụ đề','subtitle',working.subtitle)+field('Vốn khởi đầu cho mỗi đội (xu)','startingCash',working.startingCash,{num:true})+`<h3>👥 Đổi tên và biểu tượng 4 đội</h3>`+working.teams.map((t,i)=>`<div class="field-group">${field(`Đội ${i+1}`,`teams.${i}.name`,t.name)}${field('Emoji',`teams.${i}.icon`,t.icon)}</div>`).join('')+`<div class="tip">Không thể đổi số đội trong bản MVP. Mỗi sinh viên chọn một đội và có một phiếu riêng.</div>`;
  }else{
    const i=activeStage,s=working.stages[i];$('#editHeading').textContent=`${s.icon} Ải ${i+1}: ${s.title}`;
    let html=field('Tên ải',`stages.${i}.title`,s.title)+field('Mô tả / luật chơi',`stages.${i}.description`,s.description,{textarea:true})+`<div class="field-group">${field('Biểu tượng',`stages.${i}.icon`,s.icon)}${field('Thời gian mỗi lượt (giây)',`stages.${i}.duration`,s.duration,{num:true})}</div>`;
    if(s.type==='lot')html+=`<h3>🌾 Các lô hàng</h3>`+optionFields(i,[{key:'cost',title:'Vốn đầu tư (xu)'},{key:'revenue',title:'Doanh thu cuối game (xu)'}]);
    if(s.type==='quiz')html+=field('Phí khi đội trả lời sai / hòa phiếu (xu)',`stages.${i}.wrongPenalty`,s.wrongPenalty,{num:true})+questionEditor(i);
    if(s.type==='auction')html+=`<h3>🔨 Luật đấu giá giả lập</h3><div class="field-group three">${field('Giá cao nhất (xu)',`stages.${i}.maxBid`,s.maxBid,{num:true})}${field('Số thẻ',`stages.${i}.slots`,s.slots,{num:true})}${field('Giá trị thưởng / thẻ (xu)',`stages.${i}.discount`,s.discount,{num:true})}</div><div class="tip">Các đội đấu giá kín, đội thắng trả số xu đã đấu và được cộng giá trị thẻ khi kết toán. Đây KHÔNG phải cơ chế hạn ngạch EVFTA thực tế.</div>`;
    if(s.type==='event')html+=`<h3>🌪️ Biến cố vận tải</h3>`+field('Xác suất gặp sự kiện bất lợi (%)',`stages.${i}.badChance`,s.badChance,{num:true})+field('Nội dung khi có biến cố',`stages.${i}.badText`,s.badText)+field('Nội dung khi thuận lợi',`stages.${i}.goodText`,s.goodText)+optionFields(i,[{key:'cost',title:'Chi phí ban đầu'},{key:'badLoss',title:'Thiệt hại nếu xấu'},{key:'goodGain',title:'Thưởng nếu tốt'}]);
    if(s.type==='brand')html+=`<h3>🏷️ Lựa chọn kênh phân phối</h3>`+optionFields(i,[{key:'cost',title:'Vốn đầu tư'},{key:'bonus',title:'Thưởng nếu đủ điều kiện'},{key:'needsQuiz',title:'Cần qua quiz'}])+questionEditor(i);
    $('#editorBody').innerHTML=html;
  }
  $$('[data-path]',$('#editorBody')).forEach(el=>el.addEventListener('change',()=>{
    const path=el.dataset.path.split('.');let obj=working;for(let k=0;k<path.length-1;k++)obj=obj[path[k]];
    let val=el.type==='checkbox'?el.checked:(el.dataset.num?Number(el.value):el.value);
    obj[path[path.length-1]]=val;updateDirty();
  }));
  $$('[data-q]',$('#editorBody')).forEach(b=>b.addEventListener('click',()=>{activeQuestion=Number(b.dataset.q);renderEditor();}));
  $('#addQuestion')?.addEventListener('click',()=>{const qs=working.stages[activeStage].questions;if(qs.length>=12)return alert('Giới hạn 12 câu hỏi/ải.');qs.push({prompt:'Nhập câu hỏi mới của bạn...',options:['Đáp án A','Đáp án B','Đáp án C','Đáp án D'],correct:0,explanation:'Giải thích đáp án đúng.'});activeQuestion=qs.length-1;updateDirty();renderEditor();});
  $('#removeQuestion')?.addEventListener('click',()=>{const qs=working.stages[activeStage].questions;if(qs.length<=1)return alert('Một ải trắc nghiệm cần ít nhất 1 câu hỏi.');if(confirm(`Xóa câu ${activeQuestion+1}?`)){qs.splice(activeQuestion,1);activeQuestion=Math.max(0,activeQuestion-1);updateDirty();renderEditor();}});
  if(disabled)$$('input,select,textarea,button',$('#editorBody')).forEach(e=>e.disabled=true);
}
$('#saveConfig').addEventListener('click',()=>{if(!state||state.status!=='lobby')return setNotice('Chỉ lưu trước khi bắt đầu.');socket.emit('host:config',{config:working},r=>{if(!r.ok)return setNotice('⚠️ '+r.error);dirty=false;$('#dirtyBadge').hidden=true;setNotice('✅ Đã lưu cấu hình trong phòng. Hãy xuất JSON để giữ bản sao lâu dài.');renderStageNav();renderEditor();});});
$('#exportConfig').addEventListener('click',()=>{if(!working)return;const blob=new Blob([JSON.stringify(working,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='evfta-bo-cau-hoi.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('✅ Đã xuất bộ câu hỏi + luật chơi về máy.');});
$('#importConfig').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const cfg=JSON.parse(await file.text());if(!Array.isArray(cfg.stages)||cfg.stages.length!==5)throw Error('JSON cần có đúng 5 ải.');working=cfg;activeStage=-1;activeQuestion=0;updateDirty();renderStageNav();renderEditor();setNotice('📥 Đã nhập JSON. Bấm Lưu cấu hình vào phòng để kiểm tra và áp dụng.');}catch(e){setNotice('⚠️ Không đọc được JSON: '+e.message);}e.target.value='';});
setInterval(()=>{if(!state||state.status!=='running')return;$$('[data-timer]').forEach(x=>x.textContent=`⏱ ${voteElapsed(state)} giây`);},250);
