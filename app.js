const $ = (s) => document.querySelector(s);

/** App flow (wizard) */
const flow = {
  view: "mode",         // mode | doubleout | players | game
  history: [],          // stack for back
  mode: null,           // 301 | 501 | free
  doubleOut: true,
  playersCount: 2,
};

const state = {
  started: false,
  players: [],
  currentPlayer: 0,
  currentTurn: [],      // [{base,mult,points}]
  step: "numbers",      // numbers | multis (in-game input)
  chosenNumber: null,   // for multis step
};

function showView(name){
  ["viewMode","viewDoubleOut","viewPlayers","viewGame"].forEach(id => {
    const el = $("#"+id);
    if (el) el.classList.toggle("hidden", true);
  });
  const map = {
    mode: "viewMode",
    doubleout: "viewDoubleOut",
    players: "viewPlayers",
    game: "viewGame",
  };
  $("#"+map[name])?.classList.toggle("hidden", false);
  flow.view = name;

  // top title
  const title = $("#topTitle");
  if (title){
    if (name === "mode") title.textContent = "Choix de la partie";
    if (name === "doubleout") title.textContent = "Double-out ?";
    if (name === "players") title.textContent = "Nombre de joueurs";
    if (name === "game") title.textContent = "Partie en cours";
  }

  // back enabled?
  $("#btnBack").disabled = (flow.history.length === 0);
}

function goTo(name){
  flow.history.push(flow.view);
  showView(name);
}

function back(){
  if (flow.history.length === 0) return;
  const prev = flow.history.pop();
  showView(prev);
}

function home(){
  // stop game + reset flow
  stopGame();
  flow.history = [];
  flow.mode = null;
  flow.doubleOut = true;
  showView("mode");
}

/** Status styling */
function setStatus(text, kind="neutral"){
  const el = $("#status");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("status-error", "status-ok");
  if (kind === "error") el.classList.add("status-error");
  if (kind === "ok") el.classList.add("status-ok");
}

function points(mult, base){
  const m = mult === "S" ? 1 : mult === "D" ? 2 : 3;
  return base * m;
}

function dartLabel(d){
  if (!d) return "—";
  if (d.base === 0) return "Miss (0)";
  if (d.base === 25 && d.mult === "D") return "Bull (50)";
  if (d.base === 25 && d.mult === "S") return "25";
  return `${d.mult}${d.base} (${d.points})`;
}

function turnTotal(){
  return state.currentTurn.reduce((a,d)=>a+d.points,0);
}

function playerObj(){
  return state.players[state.currentPlayer];
}

function remainingNow(){
  const p = playerObj();
  if (!p) return null;
  return p.score;
}

function remainingAfterTurn(){
  const p = playerObj();
  if (!p) return null;
  if (flow.mode === "free") return p.score + turnTotal();
  return p.score - turnTotal();
}

/** Checkout suggestion (only x01, <=170) */
function dartPool(){
  const pool = [];
  for (let n=1; n<=20; n++){
    pool.push({ label:`S${n}`, value:n, isDouble:false });
    pool.push({ label:`D${n}`, value:2*n, isDouble:true });
    pool.push({ label:`T${n}`, value:3*n, isDouble:false });
  }
  pool.push({ label:"S25", value:25, isDouble:false });
  pool.push({ label:"Bull", value:50, isDouble:true }); // D25
  return pool;
}
const POOL = dartPool();

function formatCheckout(seq){
  return seq.map(d => d.label === "Bull" ? "Bull (50)" : d.label).join(" + ");
}

function bestCheckout(remaining, doubleOut=true){
  if (remaining == null) return null;
  if (remaining <= 1) return null;
  if (remaining > 170) return null;

  const accept = (seq) => {
    if (doubleOut && !seq[seq.length-1].isDouble) return false;
    const sum = seq.reduce((a,d)=>a+d.value,0);
    return sum === remaining;
  };

  // 1 dart
  for (const a of POOL){
    const seq = [a];
    if (accept(seq)) return seq;
  }
  // 2 darts
  for (const a of POOL){
    for (const b of POOL){
      const seq = [a,b];
      if (accept(seq)) return seq;
    }
  }
  // 3 darts
  for (const a of POOL){
    for (const b of POOL){
      for (const c of POOL){
        const seq = [a,b,c];
        if (accept(seq)) return seq;
      }
    }
  }
  return null;
}

/** Build in-game keypad */
function buildNumbers(){
  const host = $("#numbers");
  if (!host) return;
  host.innerHTML = "";

  const add = (label, onClick) => {
    const b = document.createElement("button");
    b.className = "btn btn-secondary";
    b.textContent = label;
    b.addEventListener("click", onClick);
    host.appendChild(b);
  };

  for (let i=1;i<=20;i++){
    add(String(i), () => chooseNumber(i));
  }

  // 25 direct
  add("25", () => addDart(25, "S"));

  // bull direct (50 = D25)
  add("Bull (50)", () => addDart(25, "D"));
}

function chooseNumber(n){
  if (!state.started) return;
  if (state.currentTurn.length >= 3) return;
  state.chosenNumber = n;
  state.step = "multis";
  renderInputStep();
}

function renderInputStep(){
  $("#multis")?.classList.toggle("hidden", state.step !== "multis");
  $("#numbers")?.classList.toggle("hidden", state.step !== "numbers");
}

function addDart(base, mult){
  if (!state.started) return;
  if (state.currentTurn.length >= 3) return;
  if (base === 25 && mult === "T") return;

  state.currentTurn.push({ base, mult, points: points(mult, base) });

  // auto go back to numbers after each dart
  state.step = "numbers";
  state.chosenNumber = null;

  renderGame();
}

function miss(){
  addDart(0, "S");
}

function undoLastDart(){
  if (!state.started) return;
  if (state.currentTurn.length === 0) return;
  state.currentTurn.pop();
  renderGame();
}

function validateTurn(){
  if (!state.started) return;
  if (state.currentTurn.length === 0) return;

  const p = playerObj();
  const total = turnTotal();

  if (flow.mode === "free"){
    // free mode = accumulate
    p.score += total;
    setStatus("Tour ajouté.", "ok");
  } else {
    // x01 = subtract with bust rules
    const startScore = p.score;
    const newScore = startScore - total;

    let bust = false;
    let win = false;
    let reason = "";

    if (newScore < 0){
      bust = true; reason = "Bust : score < 0";
    } else if (flow.doubleOut){
      if (newScore === 1){
        bust = true; reason = "Bust : reste 1 (double-out)";
      } else if (newScore === 0){
        const last = state.currentTurn[state.currentTurn.length - 1];
        if (!last || last.mult !== "D"){
          bust = true; reason = "Bust : finir sur une DOUBLE";
        } else {
          win = true;
        }
      }
    } else {
      if (newScore === 0) win = true;
    }

    if (bust){
      setStatus(reason, "error");
      // score unchanged
    } else if (win){
      p.score = 0;
      setStatus(`${p.name} a gagné !`, "ok");
      // stop game, stay on game screen
      state.started = false;
      renderGame();
      return;
    } else {
      p.score = newScore;
      setStatus("Tour validé.", "ok");
    }
  }

  // next player
  state.currentTurn = [];
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  renderGame();
}

function startGame(){
  const count = Number($("#playersCount")?.value ?? 2);
  flow.playersCount = count;

  state.players = Array.from({length: count}).map((_,i)=>({
    name: `Joueur ${i+1}`,
    score: (flow.mode === "free") ? 0 : Number(flow.mode)
  }));

  state.currentPlayer = 0;
  state.currentTurn = [];
  state.step = "numbers";
  state.chosenNumber = null;
  state.started = true;

  setStatus("Partie lancée.", "ok");
  $("#modePill").textContent = (flow.mode === "free") ? "Mode: Libre" : `Mode: ${flow.mode} (${flow.doubleOut ? "Double-out" : "No double-out"})`;

  buildNumbers();
  renderInputStep();
  renderGame();
}

function stopGame(){
  state.started = false;
  state.players = [];
  state.currentPlayer = 0;
  state.currentTurn = [];
  state.step = "numbers";
  state.chosenNumber = null;
  setStatus("—", "neutral");
}

/** Render game UI */
function renderGame(){
  renderInputStep();

  // scoreboard
  const sb = $("#scoreboard");
  if (sb){
    sb.innerHTML = "";
    state.players.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "player" + ((idx === state.currentPlayer && state.started) ? " active" : "");
      row.innerHTML = `<div class="name">${p.name}</div><div class="score">${p.score}</div>`;
      sb.appendChild(row);
    });
  }

  // darts 1/2/3
  document.querySelectorAll(".mobile-dart-slot").forEach(slot => {
    const idx = Number(slot.getAttribute("data-slot"));
    slot.querySelector(".v").textContent = dartLabel(state.currentTurn[idx]);
  });

  // totals
  $("#turnTotal").textContent = String(turnTotal());

  const rem = remainingNow();
  const proj = remainingAfterTurn();
  $("#liveRemaining").textContent = `Reste: ${rem ?? "—"}`;
  $("#liveProjected").textContent = `Après: ${proj ?? "—"}`;

  // suggestion
  const st = $("#suggestTitle");
  const sv = $("#suggestValue");
  if (flow.mode === "free"){
    st.textContent = "Suggestion";
    sv.textContent = "—";
  } else {
    st.textContent = "Suggestion checkout (≤ 170)";
    const seq = bestCheckout(proj, flow.doubleOut);
    sv.textContent = seq ? `Suggestion: ${formatCheckout(seq)}` : (proj != null && proj <= 170 ? "Pas de checkout simple." : "—");
  }

  // buttons
  $("#btnUndoDart").disabled = !(state.started && state.currentTurn.length > 0);
  $("#btnValidateTurn").disabled = !(state.started && state.currentTurn.length > 0);
}

/** Wiring wizard buttons */
function wire(){
  // persistent nav
  $("#btnBack").addEventListener("click", back);
  $("#btnHome").addEventListener("click", home);

  // mode choices
  document.querySelectorAll("[data-mode]").forEach(b => {
    b.addEventListener("click", () => {
      flow.mode = b.dataset.mode; // "301" | "501" | "free"
      if (flow.mode === "free"){
        // skip double-out step
        goTo("players");
      } else {
        goTo("doubleout");
      }
    });
  });

  // double-out choices
  document.querySelectorAll("[data-doubleout]").forEach(b => {
    b.addEventListener("click", () => {
      flow.doubleOut = (b.dataset.doubleout === "true");
      goTo("players");
    });
  });

  // start
  $("#btnStart").addEventListener("click", () => {
    showView("game");
    startGame();
  });

  // in-game multipliers
  document.querySelectorAll(".multi").forEach(b => {
    b.addEventListener("click", () => {
      if (state.step !== "multis" || state.chosenNumber == null) return;
      const m = b.dataset.m;
      if (state.chosenNumber === 25 && m === "T") return;
      addDart(state.chosenNumber, m);
    });
  });

  $("#btnMultisBack").addEventListener("click", () => {
    state.step = "numbers";
    state.chosenNumber = null;
    renderInputStep();
  });

  $("#btnMiss").addEventListener("click", miss);
  $("#btnUndoDart").addEventListener("click", undoLastDart);
  $("#btnValidateTurn").addEventListener("click", validateTurn);
}

/** Init */
showView("mode");
wire();
