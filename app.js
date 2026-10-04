import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const QUESTIONS = [
 {sender:"Microsoft Security <security@microsoft-accountverify.com>",subject:"Action required: unusual sign-in detected",body:"We detected an unusual sign-in. Your account will be suspended in 24 hours unless you verify your identity.",link:"https://microsoft-accountverify.com/secure",attachment:null,answer:"phishing",clues:["The sender domain is not microsoft.com.","The message uses urgency and a threat.","The link points to a lookalike domain."]},
 {sender:"GitHub <noreply@github.com>",subject:"Your weekly GitHub digest",body:"Here is your weekly activity summary. You can review notifications from your GitHub dashboard.",link:"https://github.com/notifications",attachment:null,answer:"legitimate",clues:["The sender uses github.com.","The destination is the official GitHub domain.","There is no request for credentials or payment."]},
 {sender:"Payroll Team <payroll@company-payroll-support.net>",subject:"FINAL NOTICE: salary account verification",body:"Your salary transfer is on hold. Confirm your bank details immediately to avoid a failed payment.",link:"https://company-payroll-support.net/verify",attachment:"salary_verification.html",answer:"phishing",clues:["The sender domain is unrelated to the employer.","It asks for sensitive financial information.","Urgency is used to pressure the recipient."]},
 {sender:"AWS <no-reply@amazon.com>",subject:"AWS billing alert",body:"Your AWS account has a billing notification. Sign in to the AWS console to review your account.",link:"https://console.aws.amazon.com/billing/",attachment:null,answer:"legitimate",clues:["The displayed destination is an official AWS console domain.","The message does not ask you to send credentials by email.","The action is to review billing in the console."]},
 {sender:"Netflix Support <help@netflix-billing-alert.com>",subject:"Payment failed — update now",body:"We could not process your latest payment. Update your card details within 12 hours to keep watching.",link:"https://netflix-billing-alert.com/update",attachment:null,answer:"phishing",clues:["The domain is not netflix.com.","The message creates a short deadline.","It requests payment details through a suspicious site."]},
 {sender:"LinkedIn <messages-noreply@linkedin.com>",subject:"You have a new message",body:"A recruiter sent you a new message. Open LinkedIn to view and respond.",link:"https://www.linkedin.com/messaging/",attachment:null,answer:"legitimate",clues:["The sender uses linkedin.com.","The link is on linkedin.com.","It does not request passwords or payment information."]}
];

const $=id=>document.getElementById(id);
const state={room:null,playerId:crypto.randomUUID(),name:"",host:false,unsub:null,timer:null,answered:false};

function show(id){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));$(id).classList.add("active")}
function roomRef(){return ref(db,`rooms/${state.room}`)}
function code(){return Math.random().toString(36).slice(2,7).toUpperCase()}
function setStatus(ok){$("status").textContent=ok?"● online":"● offline";$("status").classList.toggle("ok",ok)}
function err(x){$("homeError").textContent=x}

async function createRoom(){
 const name=$("name").value.trim(); if(!name)return err("Choose a codename first.");
 let c=code(), snap=await get(ref(db,`rooms/${c}`));
 while(snap.exists()){c=code();snap=await get(ref(db,`rooms/${c}`))}
 state.room=c;state.name=name;state.host=true;
 await set(roomRef(),{host:state.playerId,status:"lobby",round:0,totalRounds:8,players:{[state.playerId]:{name,score:0}}});
 watchRoom(); show("lobby");
}
async function joinRoom(){
 const name=$("name").value.trim(), c=$("roomInput").value.trim().toUpperCase();
 if(!name)return err("Choose a codename first."); if(c.length!==5)return err("Enter the 5-character room code.");
 const snap=await get(ref(db,`rooms/${c}`)); if(!snap.exists())return err("Room not found.");
 const r=snap.val(); if(r.status!=="lobby")return err("That game has already started.");
 if(Object.keys(r.players||{}).length>=8)return err("Room is full.");
 state.room=c;state.name=name;state.host=false;
 await update(ref(db,`rooms/${c}/players/${state.playerId}`),{name,score:0});
 watchRoom(); show("lobby");
}
function watchRoom(){
 if(state.unsub)state.unsub();
 state.unsub=onValue(roomRef(),snap=>{
  if(!snap.exists())return;
  const r=snap.val(); state.host=r.host===state.playerId;
  $("code").textContent=state.room;$("count").textContent=`${Object.keys(r.players||{}).length}/8`;
  $("players").innerHTML=Object.entries(r.players||{}).map(([id,p])=>`<div class="player"><span>${esc(p.name)}${id===r.host?'<small class="host">HOST</small>':''}</span><b>${p.score||0}</b></div>`).join("");
  $("start").style.display=state.host&&r.status==="lobby"?"block":"none";
  $("hint").textContent=state.host?"You're the host. Start when everyone is ready.":"Waiting for the host.";
  if(r.status==="playing"&&r.question)renderQuestion(r);
  if(r.status==="reveal"&&r.reveal)renderReveal(r);
  if(r.status==="finished")renderFinished(r);
 });
 setStatus(true);
}
async function startGame(){
 const snap=await get(roomRef());const r=snap.val(); if(r.host!==state.playerId)return;
 await set(ref(db,`rooms/${state.room}/round`),0);
 await startRound();
}
async function startRound(){
 const snap=await get(roomRef());const r=snap.val();const q=QUESTIONS[r.round%QUESTIONS.length];
 const updates={status:"playing",question:{...q},reveal:null,answers:{}};
 await update(roomRef(),updates);
}
async function answer(answer){
 if(state.answered)return;state.answered=true;
 document.querySelectorAll(".answer").forEach(b=>b.disabled=true);
 const playerRef=ref(db,`rooms/${state.room}/answers/${state.playerId}`);
 await set(playerRef,{answer,at:Date.now()});
 $("answerStatus").textContent="Answer locked. Waiting for the other operators…";
 checkRound();
}
async function checkRound(){
 const snap=await get(roomRef());const r=snap.val();const players=Object.keys(r.players||{}),answers=Object.keys(r.answers||{});
 if(r.status!=="playing"||answers.length<players.length)return;
 const q=r.question; const elapsed=Math.min(15,(Date.now()-(Object.values(r.answers)[0]?.roundStartedAt||Date.now()))/1000);
 const playersUpdates={};
 for(const id of players){
  const p=r.players[id],a=r.answers[id]?.answer;
  let score=p.score||0;if(a===q.answer)score+=Math.max(100,Math.round(1000-elapsed*50));else score=Math.max(0,score-150);
  playersUpdates[`players/${id}/score`]=score;
 }
 await update(roomRef(),{...playersUpdates,status:"reveal",reveal:{answer:q.answer,clues:q.clues}});
 setTimeout(async()=>{
  const s=await get(roomRef());if(!s.exists()||s.val().status!=="reveal")return;
  const rr=s.val(),next=(rr.round||0)+1;
  if(next>=rr.totalRounds)await update(roomRef(),{status:"finished",round:next});
  else{await update(roomRef(),{round:next,answers:{}});await startRound();}
 },3500);
}
function renderQuestion(r){
 if($("game").classList.contains("active")&&$("round").textContent===(r.round+1).toString())return;
 state.answered=false;document.querySelectorAll(".answer").forEach(b=>{b.disabled=false;b.classList.remove("selected")});
 const q=r.question;$("round").textContent=r.round+1;$("total").textContent=r.totalRounds;$("sender").textContent=q.sender;$("subject").textContent=q.subject;$("body").textContent=q.body;$("link").textContent=q.link;
 $("attachment").textContent=q.attachment?`📎 ${q.attachment}`:"";$("attachment").style.display=q.attachment?"inline-block":"none";$("answerStatus").textContent="";
 show("game");startTimer(15);
}
function startTimer(n){clearInterval(state.timer);let t=n;$("timer").textContent=t;$("bar").style.width="100%";state.timer=setInterval(()=>{t--;$("timer").textContent=Math.max(0,t);$("bar").style.width=`${Math.max(0,t/n*100)}%`;if(t<=0){clearInterval(state.timer);document.querySelectorAll(".answer").forEach(b=>b.disabled=true);$("answerStatus").textContent="Time's up.";state.answered=true}},1000)}
function renderReveal(r){
 clearInterval(state.timer);$("resultTitle").textContent=r.reveal.answer==="phishing"?"PHISHING":"LEGITIMATE";$("resultText").textContent=r.reveal.answer==="phishing"?"This message contained phishing indicators.":"This was designed as a legitimate example.";
 $("clues").innerHTML=r.reveal.clues.map(x=>`<li>${esc(x)}</li>`).join("");$("scoreboard").innerHTML=Object.values(r.players||{}).sort((a,b)=>(b.score||0)-(a.score||0)).map(p=>`<div class="score-row ${p.name===state.name?"me":""}"><span>${esc(p.name)}</span><b>${p.score||0}</b></div>`).join("");show("reveal");
}
function renderFinished(r){
 $("finalBoard").innerHTML=Object.values(r.players||{}).sort((a,b)=>(b.score||0)-(a.score||0)).map((p,i)=>`<div class="rank"><span>#${i+1}</span><strong>${esc(p.name)}</strong><b>${p.score||0}</b></div>`).join("");show("finished");
}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

$("create").onclick=createRoom;$("join").onclick=joinRoom;$("start").onclick=startGame;
document.querySelectorAll(".answer").forEach(b=>b.onclick=()=>answer(b.dataset.answer));
setStatus(false);
