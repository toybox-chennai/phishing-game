const $=x=>document.getElementById(x);
const Q=[
["Microsoft Security <security@microsoft-accountverify.com>","Action required: unusual sign-in detected","We detected an unusual sign-in. Your account will be suspended in 24 hours unless you verify your identity.","https://microsoft-accountverify.com/secure",null,"phishing",["The sender domain is not microsoft.com.","It creates urgency and threatens suspension.","The link uses a lookalike domain."]],
["GitHub <noreply@github.com>","Your weekly GitHub digest","Here is your weekly activity summary. You can review notifications from your GitHub dashboard.","https://github.com/notifications",null,"legitimate",["The sender uses github.com.","The destination is the official GitHub domain.","It does not request credentials or payment."]],
["Payroll Team <payroll@company-payroll-support.net>","FINAL NOTICE: salary account verification","Your salary transfer is on hold. Confirm your bank details immediately to avoid a failed payment.","https://company-payroll-support.net/verify","salary_verification.html","phishing",["The domain is unrelated to the employer.","It asks for sensitive financial information.","Urgency is used to pressure the recipient."]],
["AWS <no-reply@amazon.com>","AWS billing alert","Your AWS account has a billing notification. Sign in to the AWS console to review your account.","https://console.aws.amazon.com/billing/",null,"legitimate",["The destination is an official AWS console domain.","It does not request credentials by email.","The action is to review billing."]],
["Netflix Support <help@netflix-billing-alert.com>","Payment failed — update now","We could not process your latest payment. Update your card details within 12 hours to keep watching.","https://netflix-billing-alert.com/update",null,"phishing",["The domain is not netflix.com.","It creates a short deadline.","It requests payment details on a suspicious site."]],
["LinkedIn <messages-noreply@linkedin.com>","You have a new message","A recruiter sent you a new message. Open LinkedIn to view and respond.","https://www.linkedin.com/messaging/",null,"legitimate",["The sender uses linkedin.com.","The link is on linkedin.com.","It does not request passwords or payment."]]
];
const state={id:crypto.randomUUID(),name:"",room:"",host:false,peers:new Map(),conns:new Map(),answers:{},round:0,playing:false,timer:null};
const servers={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};
function show(x){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));$(x).classList.add("active")}
function msg(x){$("error").textContent=x}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function roomKey(){return `phish_${state.room}`}
function broadcast(m){for(const c of state.conns.values())if(c.readyState==="open")c.send(JSON.stringify(m))}
async function signal(data){await fetch(`/api/signal?x=${Date.now()}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...data,code:state.room,id:state.id})})}
async function pollSignal(){
 const r=await fetch(`/api/signal?code=${state.room}&id=${state.id}&t=${Date.now()}`);const all=await r.json();
 for(const [id,d] of Object.entries(all)){if(state.conns.has(id))continue;await connectPeer(id,d)}
 setTimeout(pollSignal,1000);
}
async function connectPeer(id,signalData={}){
 const pc=new RTCPeerConnection(servers);state.conns.set(id,pc);
 pc.onicecandidate=e=>{if(e.candidate)signal({candidate:e.candidate.toJSON(),target:id})};
 pc.ondatachannel=e=>setupChannel(id,e.channel);
 if(!state.host){const ch=pc.createDataChannel("game");setupChannel(id,ch);await pc.setRemoteDescription(signalData.offer);const a=await pc.createAnswer();await pc.setLocalDescription(a);await signal({answer:a.toJSON(),target:id})}
 pc.onconnectionstatechange=()=>{if(pc.connectionState==="connected"){$("net").textContent="● P2P online";$("net").classList.add("ok")}};
 return pc
}
function setupChannel(id,ch){
 state.peers.set(id,ch);ch.onmessage=e=>receive(JSON.parse(e.data));
 ch.onopen=()=>{ch.send(JSON.stringify({type:"hello",name:state.name,id:state.id,host:state.host}))};
}
async function hostConnections(){
 // Other peers poll the signaling endpoint. Host creates offers for discovered peers.
 const r=await fetch(`/api/signal?code=${state.room}&id=${state.id}&t=${Date.now()}`);const all=await r.json();
 for(const id of Object.keys(all))if(!state.conns.has(id)){const pc=await connectPeer(id);const offer=await pc.createOffer();await pc.setLocalDescription(offer);await signal({offer:offer.toJSON(),target:id})}
}
function send(m){broadcast(m)}
function receive(m){
 if(m.type==="hello"){state.peers.set(m.id,state.peers.get(m.id)||null);renderPlayers()}
 if(m.type==="room"){renderRoom(m.players,m.host)}
 if(m.type==="start")showQuestion(m.round)
 if(m.type==="answer"&&state.host){state.answers[m.id]=m.answer;finishIfReady()}
 if(m.type==="reveal")renderReveal(m)
 if(m.type==="finish")renderFinished(m.players)
}
function players(){
 const arr=[{id:state.id,name:state.name,score:state.score||0}];
 for(const [id,p] of state.peerInfo||[])arr.push(p);
 return arr
}
state.peerInfo=new Map();
function renderPlayers(list=[...state.peerInfo.values()]){
 const a=[{id:state.id,name:state.name,score:state.score||0},...list.filter(p=>p.id!==state.id)];
 $("players").innerHTML=a.map(p=>`<div class="player"><span>${esc(p.name)}${p.id===state.hostId?'<small class="host">HOST</small>':''}</span><b>${p.score||0}</b></div>`).join("");
}
function renderRoom(list,host){state.hostId=host;state.host=host===state.id;state.peerInfo=new Map(list.filter(p=>p.id!==state.id).map(p=>[p.id,p]));renderPlayers(list);$("start").style.display=state.host?"block":"none";show("lobby")}
function syncRoom(){send({type:"room",host:state.hostId,players:[{id:state.id,name:state.name,score:state.score||0},...state.peerInfo.values()]})}
async function create(){
 state.name=$("name").value.trim();if(!state.name)return msg("Choose a codename.");
 state.room=Math.random().toString(36).slice(2,7).toUpperCase();state.host=true;state.hostId=state.id;state.score=0;$("room").textContent=state.room;show("lobby");renderPlayers();pollSignal();setTimeout(hostConnections,700)
}
async function join(){
 state.name=$("name").value.trim();state.room=$("code").value.trim().toUpperCase();if(!state.name||state.room.length!==5)return msg("Enter a name and 5-character room code.");
 state.host=false;$("room").textContent=state.room;pollSignal();show("lobby")
}
async function start(){
 if(!state.host)return;state.round=0;state.answers={};send({type:"start",round:0});showQuestion(0)
}
function showQuestion(round){
 state.round=round;state.answers={};const q=Q[round%Q.length];$("rnd").textContent=round+1;$("sender").textContent=q[0];$("subject").textContent=q[1];$("body").textContent=q[2];$("link").textContent=q[3];$("attachment").textContent=q[4]?`📎 ${q[4]}`:"";$("attachment").style.display=q[4]?"inline-block":"none";$("wait").textContent="";document.querySelectorAll(".answer").forEach(b=>b.disabled=false);show("game");timer(15)}
function timer(n){clearInterval(state.timer);let t=n;$("timer").textContent=t;$("bar").style.width="100%";state.timer=setInterval(()=>{t--;$("timer").textContent=Math.max(0,t);$("bar").style.width=`${Math.max(0,t/n*100)}%`;if(t<=0){clearInterval(state.timer);document.querySelectorAll(".answer").forEach(b=>b.disabled=true)}},1000)}
function answer(a){document.querySelectorAll(".answer").forEach(b=>b.disabled=true);if(state.host){state.answers[state.id]=a;finishIfReady()}else{send({type:"answer",id:state.id,answer:a});$("wait").textContent="Answer locked. Waiting for host…"}}
function finishIfReady(){
 const total=1+state.peerInfo.size;if(Object.keys(state.answers).length<total)return;
 const q=Q[state.round%Q.length];const result={answer:q[5],clues:q[6],scores:{}};
 const ids=Object.keys(state.answers);ids.forEach(id=>{const p=id===state.id?{name:state.name,score:state.score||0}:state.peerInfo.get(id);if(!p)return;let s=p.score||0;s+=state.answers[id]===q[5]?700:0;result.scores[id]={name:p.name,score:s};if(id===state.id)state.score=s});
 send({type:"reveal",...result});renderReveal({type:"reveal",...result});setTimeout(()=>{if(state.round>=7){send({type:"finish",players:result.scores});renderFinished({players:result.scores})}else{state.round++;send({type:"start",round:state.round});showQuestion(state.round)}},3500)
}
function renderReveal(r){clearInterval(state.timer);$("result").textContent=r.answer==="phishing"?"PHISHING":"LEGITIMATE";$("why").textContent=r.answer==="phishing"?"Phishing indicators detected.":"This was a legitimate example.";$("clues").innerHTML=r.clues.map(x=>`<li>${esc(x)}</li>`).join("");$("scores").innerHTML=Object.values(r.scores).sort((a,b)=>b.score-a.score).map(p=>`<div class="score ${p.name===state.name?"me":""}"><span>${esc(p.name)}</span><b>${p.score}</b></div>`).join("");show("reveal")}
function renderFinished(r){$("final").innerHTML=Object.values(r.players).sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="rank"><span>#${i+1}</span><strong>${esc(p.name)}</strong><b>${p.score}</b></div>`).join("");show("finished")}
$("create").onclick=create;$("join").onclick=join;$("start").onclick=start;document.querySelectorAll(".answer").forEach(b=>b.onclick=()=>answer(b.dataset.a));
$("net").textContent="● ready";$("net").classList.add("ok");
