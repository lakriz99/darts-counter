const $ = s => document.querySelector(s);

const state = {
  started:false,
  score:501,
  players:[],
  current:0,
  turn:[],
  mobileStep:"numbers",
  mobileNumber:null
};

const isMobile = () => window.innerWidth <= 980;

function startGame(){
  state.started=true;
  state.score=Number($("#mode").value);
  state.players=[...Array(Number($("#playersCount").value))].map((_,i)=>({
    name:`Joueur ${i+1}`,
    score:state.score
  }));
  state.current=0;
  state.turn=[];
  render();
  if(isMobile()) openMobile(true);
}

function addDart(base,m){
  if(state.turn.length>=3)return;
  if(base===25 && m===3)return;
  state.turn.push(base*m);
  renderMobile();
}

function validateTurn(){
  const total=state.turn.reduce((a,b)=>a+b,0);
  const p=state.players[state.current];
  const newScore=p.score-total;
  if(newScore<0||newScore===1){ state.turn=[]; next(); return; }
  if(newScore===0 && $("#doubleOut").checked){
    const last=state.turn.at(-1);
    if(last%2!==0){ state.turn=[]; next(); return; }
  }
  p.score=newScore;
  state.turn=[];
  if(p.score===0){ state.started=false; openMobile(false); }
  next();
}

function next(){
  state.current=(state.current+1)%state.players.length;
  render();
}

function render(){
  $("#scoreboard").innerHTML=state.players.map((p,i)=>
    `<div>${i===state.current?"▶":""} ${p.name} : ${p.score}</div>`
  ).join("");
  renderMobile();
}

function openMobile(on){
  $("#mobileOverlay").classList.toggle("hidden",!on);
  document.body.classList.toggle("no-scroll",on);
  state.mobileStep="numbers";
  renderMobile();
}

function renderMobile(){
  $("#mobileTotal").textContent=state.turn.reduce((a,b)=>a+b,0);
  $("#mobileTitle").textContent=
    state.players[state.current]?.name+" • "+(state.mobileStep==="numbers"?"Chiffre":"Simple / Double / Triple");

  $("#mobileNumbers").innerHTML="";
  if(state.mobileStep==="numbers"){
    for(let i=1;i<=20;i++)
      $("#mobileNumbers").innerHTML+=`<button onclick="pick(${i})">${i}</button>`;
    $("#mobileNumbers").innerHTML+=`<button onclick="pick(25)">25</button>`;
    $("#mobileMultis").classList.add("hidden");
  }else{
    $("#mobileMultis").classList.remove("hidden");
  }
}

window.pick = n => {
  state.mobileNumber=n;
  state.mobileStep="multis";
  renderMobile();
};

document.querySelectorAll(".mobile-multi").forEach(b=>{
  b.onclick=()=>{ addDart(state.mobileNumber, b.dataset.m==="S"?1:b.dataset.m==="D"?2:3);
    state.mobileStep="numbers";
    renderMobile();
  };
});

$("#btnMobileMiss").onclick=()=>{
  state.turn.push(0);
  renderMobile();
};

$("#btnMobileValidate").onclick=validateTurn;
$("#btnNewGame").onclick=startGame;
$("#btnReset").onclick=()=>location.reload();