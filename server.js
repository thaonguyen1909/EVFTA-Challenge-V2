'use strict';
require('dotenv').config();
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const express=require('express');
const {Server}=require('socket.io');
const {validateConfig,createSteps,makeTeamState,projectedProfit,settle,finalize}=require('./game-core');

const PORT=Number(process.env.PORT)||3000;
const HOST_PASSWORD=process.env.HOST_PASSWORD||'';
const PASSWORD_READY=HOST_PASSWORD.length>=12&&HOST_PASSWORD!=='thay-mat-khau-manh-tai-day';
const MAX_ROOMS=12,MAX_PLAYERS=160,TTL_MS=4*60*60*1000;
const defaultConfig=validateConfig(JSON.parse(fs.readFileSync(path.join(__dirname,'config','default-game.json'),'utf8')));
const rooms=new Map();
const app=express();
app.disable('x-powered-by');
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');next();});
app.get('/health',(_req,res)=>res.json({ok:true,app:'EVFTA Challenge v2'}));
const page=(name)=>(_req,res)=>res.sendFile(path.join(__dirname,'public',name));
app.get('/',page('index.html'));
app.get('/play',page('index.html'));
app.get('/host',page('host.html'));
app.get('/screen',page('screen.html'));
app.use(express.static(path.join(__dirname,'public'),{index:false}));
const server=http.createServer(app);
const io=new Server(server,{maxHttpBufferSize:350000,pingTimeout:25000});
function send(ack,data){if(typeof ack==='function')ack(data);}
function fail(ack,msg){send(ack,{ok:false,error:msg});}
function clone(x){return JSON.parse(JSON.stringify(x));}
function clean(v,max=40){return typeof v==='string'?v.trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,max):'';}
function pwCorrect(s){if(!PASSWORD_READY||typeof s!=='string')return false;const a=Buffer.from(s),b=Buffer.from(HOST_PASSWORD);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function newCode(){for(let i=0;i<100;i++){const c=String(crypto.randomInt(100000,999999));if(!rooms.has(c))return c;}throw Error('Không tạo được mã phòng.');}
function getRoom(socket){return socket.data.code?rooms.get(socket.data.code):null;}
function playersIn(room,team){return [...room.players.values()].filter(p=>p.team===team);}
function counts(room){return Object.fromEntries(room.config.teams.map(t=>[t.id,playersIn(room,t.id).length]));}
function votesCount(room){return Object.fromEntries(room.config.teams.map(t=>[t.id,[...room.votes.keys()].filter(pid=>room.players.get(pid)?.team===t.id).length]));}
function makeRoom(){
  const code=newCode(),config=clone(defaultConfig);
  const room={code,config,steps:createSteps(config),players:new Map(),teams:Object.fromEntries(config.teams.map(t=>[t.id,makeTeamState(config.startingCash)])),votes:new Map(),hostId:null,status:'lobby',stepIndex:-1,deadline:null,timer:null,result:null,history:[],created:Date.now(),lastAccess:Date.now()};
  rooms.set(code,room);return room;
}
function currentStep(room){return room.steps[room.stepIndex]||null;}
function stepPayload(room,showAnswer=false){
  const step=currentStep(room);if(!step)return null;
  const s=room.config.stages[step.stage];
  const p={key:step.key,stageIndex:step.stage,kind:step.kind,title:s.title,icon:s.icon,description:s.description,duration:s.duration,questionNo:step.qi===undefined?null:step.qi+1,questionTotal:(step.kind==='quiz'||step.kind==='brandquiz')?s.questions.length:null};
  if(step.kind==='quiz'||step.kind==='brandquiz'){
    const q=s.questions[step.qi];p.prompt=q.prompt;p.options=q.options.map(label=>({label}));
    if(showAnswer){p.correct=q.correct;p.explanation=q.explanation;}
  }else if(step.kind==='auction'){
    p.options=Array.from({length:s.maxBid+1},(_,i)=>({label:`Đặt giá ${i} xu`,detail:i===0?'Không tham gia đấu giá':'Tiền chỉ bị trừ nếu thắng'}));
    p.slots=s.slots;p.discount=s.discount;
  }else {
    p.options=s.options.map(o=>({label:o.label,detail:o.detail}));
    if(step.kind==='event')p.badChance=s.badChance;
  }
  return p;
}
function snapshot(room,socket){
  const host=socket.data.role==='host'&&socket.data.code===room.code&&room.hostId===socket.id;
  const player=socket.data.role==='player'&&socket.data.code===room.code?room.players.get(socket.data.pid):null;
  const activeIds=new Set([...room.players.values()].map(p=>p.team));
  const data={
    code:room.code,title:room.config.title,subtitle:room.config.subtitle,startingCash:room.config.startingCash,
    status:room.status,hostConnected:!!room.hostId,stepsTotal:room.steps.length,stepIndex:room.stepIndex,
    serverNow:Date.now(),deadline:room.deadline,step:stepPayload(room,room.status==='review'||room.status==='finished'),
    stages:room.config.stages.map(s=>({id:s.id,title:s.title,icon:s.icon,kind:s.type})),
    teams:room.config.teams.map(t=>({id:t.id,name:t.name,icon:t.icon,color:t.color,memberCount:playersIn(room,t.id).length,online:playersIn(room,t.id).filter(p=>p.connected).length,active:activeIds.has(t.id),
      ...clone(room.teams[t.id]),projectedProfit:projectedProfit(room.teams[t.id],room.config.startingCash,room.status==='finished')})),
    voters:votesCount(room),result:room.result,history:room.history.map(h=>({step:h.step,stageTitle:h.stageTitle,event:h.event,summaries:h.summaries.map(r=>({team:r.team,delta:r.delta,note:r.note,correct:r.correct,won:r.won}))})),
    role:host?'host':player?'player':'spectator',me:player?{id:player.id,name:player.name,team:player.team,vote:room.votes.has(player.id)?room.votes.get(player.id):null}:null
  };
  if(host)data.config=clone(room.config);
  return data;
}
function publish(room){room.lastAccess=Date.now();const ids=io.sockets.adapter.rooms.get(`room:${room.code}`);if(!ids)return;for(const id of ids){const sock=io.sockets.sockets.get(id);if(sock)sock.emit('room:state',snapshot(room,sock));}}
function detach(socket){
  const room=getRoom(socket);if(!room)return;
  if(socket.data.role==='host'&&room.hostId===socket.id)room.hostId=null;
  if(socket.data.role==='player'){const p=room.players.get(socket.data.pid);if(p&&p.sid===socket.id){p.connected=false;p.sid=null;}}
  socket.leave(`room:${room.code}`);socket.data.code=null;socket.data.role=null;socket.data.pid=null;publish(room);
}
function requireHost(socket,ack){const room=getRoom(socket);if(!room||socket.data.role!=='host'||room.hostId!==socket.id){fail(ack,'Bạn không có quyền điều khiển phòng này.');return null;}return room;}
function clearClock(room){if(room.timer)clearTimeout(room.timer);room.timer=null;room.deadline=null;}
function closeStep(room){
  if(room.status!=='running')return;
  clearClock(room);
  room.result=settle(room);room.history.push(clone(room.result));room.status='review';publish(room);
}
function advance(room){
  clearClock(room);room.stepIndex++;
  room.votes.clear();room.result=null;
  if(room.stepIndex>=room.steps.length){finalize(room);room.status='finished';room.deadline=null;publish(room);return;}
  room.status='running';const step=currentStep(room),stage=room.config.stages[step.stage];room.deadline=Date.now()+stage.duration*1000;
  room.timer=setTimeout(()=>closeStep(room),stage.duration*1000);publish(room);
}
function resetRoom(room){
  clearClock(room);room.status='lobby';room.stepIndex=-1;room.deadline=null;room.result=null;room.history=[];room.votes.clear();room.teams=Object.fromEntries(room.config.teams.map(t=>[t.id,makeTeamState(room.config.startingCash)]));publish(room);
}
function switchHost(socket,room){
  if(room.hostId&&room.hostId!==socket.id){const previous=io.sockets.sockets.get(room.hostId);if(previous){previous.emit('host:replaced');detach(previous);}}
  detach(socket);room.hostId=socket.id;socket.data.role='host';socket.data.code=room.code;socket.join(`room:${room.code}`);
}
io.on('connection',socket=>{
  socket.on('room:peek',(args,ack)=>{
    const room=rooms.get(clean(args?.code,6));
    if(!room)return fail(ack,'Phòng chưa tồn tại.');
    send(ack,{ok:true,status:room.status,teams:room.config.teams.map(t=>({...t,memberCount:playersIn(room,t.id).length}))});
  });
  socket.on('host:create',(args,ack)=>{
    if(!pwCorrect(args?.password))return fail(ack,PASSWORD_READY?'Mật khẩu host không đúng.':'Vui lòng đặt HOST_PASSWORD tối thiểu 12 ký tự, khác giá trị mẫu.');
    if(rooms.size>=MAX_ROOMS)return fail(ack,'Máy chủ đã có quá nhiều phòng.');
    const room=makeRoom();switchHost(socket,room);send(ack,{ok:true,code:room.code});publish(room);
  });
  socket.on('host:attach',(args,ack)=>{
    if(!pwCorrect(args?.password))return fail(ack,'Mật khẩu host không đúng.');
    const room=rooms.get(clean(args?.code,6));if(!room)return fail(ack,'Không tìm thấy phòng (có thể server đã khởi động lại).');
    switchHost(socket,room);send(ack,{ok:true,code:room.code});publish(room);
  });
  socket.on('host:config',(args,ack)=>{
    const room=requireHost(socket,ack);if(!room)return;
    if(room.status!=='lobby')return fail(ack,'Chỉ sửa cấu hình trước khi bắt đầu trận.');
    try{const config=validateConfig(args?.config);room.config=config;room.steps=createSteps(config);room.teams=Object.fromEntries(config.teams.map(t=>[t.id,makeTeamState(config.startingCash)]));send(ack,{ok:true});publish(room);}catch(e){fail(ack,e.message);}
  });
  socket.on('host:next',(_args,ack)=>{
    const room=requireHost(socket,ack);if(!room)return;
    if(!['lobby','review'].includes(room.status))return fail(ack,'Chờ hết thời gian hoặc đóng lượt hiện tại trước.');
    if(room.status==='lobby'&&room.config.teams.filter(t=>playersIn(room,t.id).length>0).length<2)return fail(ack,'Cần ít nhất 2 đội có người chơi.');
    advance(room);send(ack,{ok:true});
  });
  socket.on('host:close',(_args,ack)=>{
    const room=requireHost(socket,ack);if(!room)return;if(room.status!=='running')return fail(ack,'Hiện không có lượt đang chạy.');closeStep(room);send(ack,{ok:true});
  });
  socket.on('host:reset',(_args,ack)=>{const room=requireHost(socket,ack);if(!room)return;resetRoom(room);send(ack,{ok:true});});
  socket.on('player:join',(args,ack)=>{
    const room=rooms.get(clean(args?.code,6));if(!room)return fail(ack,'Mã phòng không tồn tại.');
    const credential=args?.credential;
    let p=null;
    if(credential&&typeof credential==='object'){
      const old=room.players.get(String(credential.id||''));
      if(old&&typeof credential.token==='string'&&credential.token===old.token)p=old;
    }
    if(!p){
      if(room.status==='finished')return fail(ack,'Ván chơi đã kết thúc.');
      if(room.players.size>=MAX_PLAYERS)return fail(ack,'Phòng đã đạt giới hạn 160 người.');
      const name=clean(args?.name,28),team=clean(args?.team,24);
      if(name.length<2)return fail(ack,'Tên hiển thị cần tối thiểu 2 ký tự.');
      if(!room.config.teams.some(t=>t.id===team))return fail(ack,'Hãy chọn đội hợp lệ.');
      p={id:crypto.randomUUID(),token:crypto.randomBytes(24).toString('hex'),name,team,connected:false,sid:null};room.players.set(p.id,p);
    }
    detach(socket);
    if(p.sid&&p.sid!==socket.id){const old=io.sockets.sockets.get(p.sid);if(old)detach(old);}
    p.connected=true;p.sid=socket.id;socket.data.code=room.code;socket.data.role='player';socket.data.pid=p.id;socket.join(`room:${room.code}`);
    send(ack,{ok:true,code:room.code,credential:{id:p.id,token:p.token},name:p.name,team:p.team});publish(room);
  });
  socket.on('player:leave',(_args,ack)=>{
    const room=getRoom(socket);
    if(!room||socket.data.role!=='player')return fail(ack,'Bạn chưa tham gia phòng.');
    if(room.status!=='lobby')return fail(ack,'Chỉ có thể đổi đội trước khi bắt đầu trận.');
    room.players.delete(socket.data.pid);room.votes.delete(socket.data.pid);
    detach(socket);send(ack,{ok:true});
  });
  socket.on('player:vote',(args,ack)=>{
    const room=getRoom(socket);
    if(!room||socket.data.role!=='player'||room.status!=='running'||Date.now()>room.deadline)return fail(ack,'Lượt bỏ phiếu đã đóng.');
    const p=room.players.get(socket.data.pid);if(!p||p.sid!==socket.id)return fail(ack,'Phiên người chơi không hợp lệ.');
    const optCount=stepPayload(room).options.length;
    if(!Number.isInteger(args?.choice)||args.choice<0||args.choice>=optCount)return fail(ack,'Lựa chọn không hợp lệ.');
    room.votes.set(p.id,args.choice);send(ack,{ok:true});publish(room);
  });
  socket.on('room:watch',(args,ack)=>{
    const room=rooms.get(clean(args?.code,6));if(!room)return fail(ack,'Không tìm thấy phòng.');
    detach(socket);socket.data.code=room.code;socket.data.role='spectator';socket.join(`room:${room.code}`);
    send(ack,{ok:true});publish(room);
  });
  socket.on('disconnect',()=>detach(socket));
});
const gc=setInterval(()=>{
  const now=Date.now();for(const [code,room] of rooms){if(now-room.lastAccess>TTL_MS){clearClock(room);rooms.delete(code);}}
},10*60*1000);gc.unref();
if(require.main===module){server.listen(PORT,'0.0.0.0',()=>{console.log(`EVFTA Challenge on port ${PORT}`);if(!PASSWORD_READY)console.warn('WARNING: HOST_PASSWORD chưa hợp lệ (>=12 ký tự, khác mẫu), không thể tạo phòng.');});}
module.exports={server,io,rooms,app};
