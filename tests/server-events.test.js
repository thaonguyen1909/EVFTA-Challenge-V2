'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');
function fakeExpress(){const fn=(_req,_res)=>{};fn.disable=()=>{};fn.use=()=>{};fn.get=()=>{};return fn;}
fakeExpress.static=()=>()=>{};
let liveIo;
class FakeSocket {
  constructor(io,id){this.id=id;this.io=io;this.data={};this.handlers={};this.outbound=[];io.sockets.sockets.set(id,this);}
  on(name,fn){this.handlers[name]=fn;}
  emit(name,data){this.outbound.push({name,data});}
  join(room){if(!this.io.sockets.adapter.rooms.has(room))this.io.sockets.adapter.rooms.set(room,new Set());this.io.sockets.adapter.rooms.get(room).add(this.id);}
  leave(room){this.io.sockets.adapter.rooms.get(room)?.delete(this.id);}
  send(name,args){let output;this.handlers[name](args,(v)=>{output=v;});return output;}
  latest(name){return [...this.outbound].reverse().find(x=>x.name===name)?.data;}
}
class FakeIo {
  constructor(){this.sockets={sockets:new Map(),adapter:{rooms:new Map()}};this.next=0;liveIo=this;}
  on(name,fn){if(name==='connection')this.onConnection=fn;}
  connect(){const s=new FakeSocket(this,'sock'+(++this.next));this.onConnection(s);return s;}
}
const oldLoad=Module._load;
process.env.HOST_PASSWORD='test-pass-must-never-be-public';
Module._load=function(name,parent,isMain){if(name==='dotenv')return {config(){}};if(name==='express')return fakeExpress;if(name==='socket.io')return {Server:FakeIo};return oldLoad.call(this,name,parent,isMain);};
const serverModule=require('../server');Module._load=oldLoad;
test('socket workflow: host auth, team join, private votes, review, reset',()=>{
  const host=liveIo.connect(),a=liveIo.connect(),b=liveIo.connect(),spectator=liveIo.connect();
  const wrong=host.send('host:create',{password:'wrong'});assert.equal(wrong.ok,false);
  const made=host.send('host:create',{password:process.env.HOST_PASSWORD});assert.equal(made.ok,true);
  const code=made.code;assert.match(code,/^\d{6}$/);
  assert.equal(host.latest('room:state').role,'host');
  assert.ok(host.latest('room:state').config.stages.length===5);
  const aJoin=a.send('player:join',{code,name:'An',team:'rice'}),bJoin=b.send('player:join',{code,name:'Binh',team:'trade'});
  assert.equal(aJoin.ok,true);assert.equal(bJoin.ok,true);
  assert.equal(spectator.send('room:watch',{code}).ok,true);
  assert.equal(spectator.latest('room:state').config,undefined);
  assert.equal(host.send('host:next',{}).ok,true);
  assert.equal(a.latest('room:state').status,'running');
  assert.equal(a.send('player:vote',{choice:1}).ok,true);assert.equal(b.send('player:vote',{choice:0}).ok,true);
  assert.equal(spectator.latest('room:state').step.correct,undefined);
  assert.equal(spectator.latest('room:state').me,null);
  assert.equal(a.latest('room:state').me.vote,1);
  assert.equal(host.send('host:close',{}).ok,true);
  const result=a.latest('room:state');assert.equal(result.status,'review');assert.equal(result.result.summaries.length,2);
  assert.equal(a.send('player:vote',{choice:0}).ok,false);
  assert.equal(host.send('host:next',{}).ok,true);
  assert.equal(a.latest('room:state').step.stageIndex,1);
  assert.equal(host.send('host:reset',{}).ok,true);
  assert.equal(host.latest('room:state').status,'lobby');
  assert.equal(serverModule.rooms.get(code).teams.rice.cash,10);
});
