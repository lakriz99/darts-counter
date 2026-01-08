const $ = (sel) => document.querySelector(sel);

const state = {
  started: false,
  mode: 501,
  doubleOut: true,
  players: [],
  currentPlayer: 0,

  // tour en cours: [{base, mult, points}]
  currentTurn: [],

  // desktop
  selectedNumber: null,

  // mobile
  mobileStep: "numbers", // "numbers" | "multis"
  mobileNumber: null
};

const isMobile = () => window.matchMedia("(max-width: 980px)").matches;

function setStatus(text, ok=false){
  const el = $("#status");
  if (!el) return;
  el.textContent = text;
  el.style.color = ok ? "var(--ok)" : "";
}

function dartLabel(d){
  if (!d) return "—";
  if (d.base === 0) return "Miss (0)";
  if (d.base === 25 && d.mult === "D") return "Bull (50)";
  if (d.base === 25 && d.mult === "S") return "25";
  return `${d.mult}${d.base} (${d.points})`;
}

function points(mult, base){
  const m = mult === "S" ? 1 : mult === "D" ? 2 : 3;
  return base * m;
}

function canTriple(base){ return base !== 25; }

function turnTotal(){
  return state.currentTurn.reduce((a,d) => a + d.points, 0);
}

function currentPlayer(){
  return state.players[state.currentPlayer];
}

/* -------------------- UI helpers -------------------- */

function setMobileOverlay(open){
  const overlay = $("#mobileOverlay");
  if (!overlay) return;

  overlay.classList.toggle("hidden", !open);
  overlay.setAttribute("aria-hidden", String(!open));

  // bloque scroll background quand overlay ouvert
  document.body.classList.toggle("no-scroll", open);

  if (open){
    // reset step
    state.mobileStep = "numbers";
    state.mobileNumber = null;
  }
  renderAll();
}

function mobileSetStep(step){
  state.mobileStep = step;

  const numbers = $("#mobileNumbers");
  const multis = $("#mobileMultis");
  const back = $("#btnMobileBack");

  if (numbers) numbers.style.display = (step === "numbers") ? "grid" : "none";
  if (multis) multis.classList.toggle("hidden", step !== "multis");
  if (back) back.disabled = (step === "numbers");

  renderMobileHeader();
}

function renderMobileHeader(){
  const p = currentPlayer();
  const title = $("#mobileTitle");
  const sub = $("#mobileSub");

  if (!title || !sub) return;

  if (!state.started || !p){
    title.textContent = "—";
    sub.textContent = "—";
    return;
  }

  title.textContent = `${p.name} • Score: ${p.score}`;
  if (state.mobileStep === "numbers"){
    sub.textContent = `Choisis un chiffre (fléchettes: ${state.currentTurn.length}/3)`;
  } else {
    sub.textContent = `Chiffre ${state.mobileNumber} → Simple / Double / Triple`;
  }
}

function renderScoreboard(){
  const sb = $("#scoreboard");
  if (!sb) return;

  sb.innerHTML = "";
  if (state.players.length === 0){
    sb.innerHTML = `<div class="pill">Crée une partie.</div>`;
    return;
  }

  state.players.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "player" + (state.started && idx === state.currentPlayer ? " active" : "");
    row.innerHTML = `<div><b>${p.name}</b></div><div class="score">${p.score}</div>`;
    sb.appendChild(row);
  });
}

function renderMobileScores(){
  const host = $("#mobileScores");
  if (!host) return;

  host.innerHTML = "";
  if (state.players.length === 0) return;

  // 2 colonnes: compact
  state.players.forEach((p, idx) => {
    const pill = document.createElement("div");
    pill.className = "mobile-score-pill" + (state.started && idx === state.currentPlayer ? " active" : "");
    pill.innerHTML = `<div class="n">${p.name}</div><div class="s">${p.score}</div>`;
    host.appendChild(pill);
  });
}

function renderDesktopTurn(){
  const td = $("#turnDarts");
  const ti = $("#turnInfo");
  const hint = $("#hint");

  if (ti){
    const p = currentPlayer();
    ti.textContent = (state.started && p) ? `${p.name} • fléchettes: ${state.currentTurn.length}/3` : "—";
  }

  if (td){
    td.innerHTML = "";
    state.currentTurn.forEach((d, i) => {
      const chip = document.createElement("div");
      chip.className = "dart-chip";
      chip.textContent = `${i+1}. ${dartLabel(d)}`;
      td.appendChild(chip);
    });
  }

  if (hint){
    if (!state.started) hint.textContent = "Clique “Nouvelle partie” pour commencer.";
    else if (state.currentTurn.length >= 3) hint.textContent = "Tour complet. Valide le tour.";
    else if (state.selectedNumber == null) hint.textContent = "Clique un chiffre, puis Simple/Double/Triple.";
    else hint.textContent = `Base ${state.selectedNumber} sélectionnée → choisis Simple/Double/Triple.`;
  }

  // boutons desktop
  const v = $("#btnValidateTurn");
  const back = $("#btnBackDart");
  const miss = $("#btnMiss");
  if (v) v.disabled = !(state.started && state.currentTurn.length > 0);
  if (back) back.disabled = !(state.started && state.currentTurn.length > 0);
  if (miss) miss.disabled = !state.started || state.currentTurn.length >= 3;
}

function renderMobileTurn(){
  const total = $("#mobileTotal");
  if (total) total.textContent = String(turnTotal());

  // slots 1/2/3
  const slots = document.querySelectorAll(".mobile-dart-slot");
  slots.forEach((slot) => {
    const idx = Number(slot.getAttribute("data-slot"));
    const v = slot.querySelector(".v");
    if (!v) return;
    v.textContent = dartLabel(state.currentTurn[idx]);
  });

  const validate = $("#btnMobileValidate");
  const undoDart = $("#btnMobileUndoDart");
  const miss = $("#btnMobileMiss");

  if (validate) validate.disabled = !(state.started && state.currentTurn.length > 0);
  if (undoDart) undoDart.disabled = !(state.started && state.currentTurn.length > 0);
  if (miss) miss.disabled = !state.started || state.currentTurn.length >= 3;

  renderMobileHeader();
}

function buildDesktopNumbers(){
  const host = $("#numbers");
  if (!host) return;

  host.innerHTML = "";
  const mk = (label, val) => {
    const b = document.createElement("button");
    b.className = "btn num";
    b.textContent = label;
    b.dataset.val = String(val);
    b.addEventListener("click", () => desktopSelectNumber(val));
    return b;
  };

  for (let i=1;i<=20;i++) host.appendChild(mk(String(i), i));
  host.appendChild(mk("25", 25));
  host.appendChild(mk("Bull", 25));
}

function desktopSelectNumber(val){
  if (!state.started) return;
  state.selectedNumber = val;

  document.querySelectorAll(".num").forEach(b => {
    const is25Bull = (val === 25) && (b.textContent === "25" || b.textContent === "Bull");
    const isMatch = Number(b.dataset.val) === val;
    b.classList.toggle("selected", isMatch || is25Bull);
  });

  enableDesktopMultis(true);
}

function enableDesktopMultis(on){
  const s = $("#btnS"), d = $("#btnD"), t = $("#btnT");
  if (!s || !d || !t) return;

  s.disabled = !on;
  d.disabled = !on;
  t.disabled = !on;

  if (on && state.selectedNumber === 25) t.disabled = true;
}

function clearDesktopSelection(){
  state.selectedNumber = null;
  enableDesktopMultis(false);
  document.querySelectorAll(".num").forEach(b => b.classList.remove("selected"));
}

function buildMobileNumbers(){
  const host = $("#mobileNumbers");
  if (!host) return;

  host.innerHTML = "";
  const mk = (label, val) => {
    const b = document.createElement("button");
    b.className = "btn btn-secondary";
    b.textContent = label;
    b.addEventListener("click", () => mobilePickNumber(val));
    host.appendChild(b);
  };

  for (let i=1;i<=20;i++) mk(String(i), i);
  mk("25", 25);
  mk("Bull", 25);
}

/* -------------------- Game actions -------------------- */

function newGame(){
  state.mode = Number($("#mode").value);
  state.doubleOut = $("#doubleOut").checked;

  const count = Number($("#playersCount").value);
  state.players = Array.from({length: count}).map((_,i)=>({
    name: `Joueur ${i+1}`,
    score: state.mode
  }));

  state.currentPlayer = 0;
  state.currentTurn = [];
  clearDesktopSelection();
  state.started = true;

  setStatus("Partie lancée.", true);

  // mobile overlay auto
  if (isMobile()) setMobileOverlay(true);
  renderAll();
}

function mobilePickNumber(val){
  if (!state.started) return;
  if (state.currentTurn.length >= 3) return;

  state.mobileNumber = val;
  mobileSetStep("multis");
}

function addDart(base, mult){
  if (!state.started) return;
  if (state.currentTurn.length >= 3) return;
  if (base === 25 && mult === "T") return;

  const d = { base, mult, points: points(mult, base) };
  state.currentTurn.push(d);

  renderAll();

  // mobile UX: revenir aux chiffres après chaque fléchette
  if (isMobile()){
    state.mobileNumber = null;
    mobileSetStep("numbers");
  }
}

function miss(){
  addDart(0, "S");
}

function undoLastDart(){
  if (!state.started) return;
  if (state.currentTurn.length === 0) return;
  state.currentTurn.pop();
  renderAll();
}

function validateTurn(){
  if (!state.started) return;
  if (state.currentTurn.length === 0) return;

  const p = currentPlayer();
  const startScore = p.score;
  const total = turnTotal();
  const newScore = startScore - total;

  let bust = false;
  let win = false;
  let reason = "";

  if (newScore < 0){
    bust = true; reason = "Bust (score < 0)";
  } else if (state.doubleOut){
    if (newScore === 1){
      bust = true; reason = "Bust (reste 1 en double-out)";
    } else if (newScore === 0){
      const last = state.currentTurn[state.currentTurn.length - 1];
      if (!last || last.mult !== "D"){
        bust = true; reason = "Bust (finir sur une double)";
      } else {
        win = true;
      }
    }
  } else {
    if (newScore === 0) win = true;
  }

  if (bust){
    setStatus(reason, false);
    // score inchangé
  } else if (win){
    p.score = 0;
    setStatus(`${p.name} a gagné !`, true);
    state.started = false;
    state.currentTurn = [];
    clearDesktopSelection();
    if (isMobile()) setMobileOverlay(false);
    renderAll();
    return;
  } else {
    p.score = newScore;
    setStatus("Tour validé.", true);
  }

  // joueur suivant
  state.currentTurn = [];
  clearDesktopSelection();
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;

  renderAll();
}

function resetAll(){
  // reset “dur”
  state.started = false;
  state.players = [];
  state.currentPlayer = 0;
  state.currentTurn = [];
  clearDesktopSelection();
  setStatus("—", false);
  setMobileOverlay(false);
  renderAll();
}

/* -------------------- Render all -------------------- */

function renderAll(){
  renderScoreboard();
  renderMobileScores();
  renderDesktopTurn();
  renderMobileTurn();

  // mobile overlay content
  if (isMobile() && state.started){
    // rebuild numbers if missing (safe)
    buildMobileNumbers();
  }
}

/* -------------------- Wiring -------------------- */

function wire(){
  // top buttons
  $("#btnNewGame")?.addEventListener("click", newGame);
  $("#btnReset")?.addEventListener("click", resetAll);

  // desktop multis
  document.querySelectorAll(".multi").forEach(b => {
    b.addEventListener("click", () => {
      if (state.selectedNumber == null) return;
      addDart(state.selectedNumber, b.dataset.m);
      // desktop: après une fléchette, on garde la logique “re-sélection”
      // donc on clear pour obliger à choisir à nouveau
      clearDesktopSelection();
    });
  });

  // desktop extras
  $("#btnMiss")?.addEventListener("click", miss);
  $("#btnBackDart")?.addEventListener("click", undoLastDart);
  $("#btnValidateTurn")?.addEventListener("click", validateTurn);

  // mobile multis
  document.querySelectorAll(".mobile-multi").forEach(b => {
    b.addEventListener("click", () => {
      if (state.mobileNumber == null) return;
      addDart(state.mobileNumber, b.dataset.m);
    });
  });

  // mobile actions
  $("#btnMobileMiss")?.addEventListener("click", miss);
  $("#btnMobileUndoDart")?.addEventListener("click", undoLastDart);
  $("#btnMobileValidate")?.addEventListener("click", validateTurn);

  // ✅ bouton Retour (fix)
  $("#btnMobileBack")?.addEventListener("click", () => {
    // si on est dans l'étape multis, retour à l'étape chiffres
    if (state.mobileStep === "multis"){
      state.mobileNumber = null;
      mobileSetStep("numbers");
    }
  });

  // overlay resize/orientation
  window.addEventListener("resize", () => {
    if (state.started && isMobile()) setMobileOverlay(true);
    if (!isMobile()) setMobileOverlay(false);
  });
}

/* -------------------- Init -------------------- */

buildDesktopNumbers();
buildMobileNumbers();
wire();
renderAll();
setStatus("—");
enableDesktopMultis(false);
