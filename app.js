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

function turnTotal(){
  return state.currentTurn.reduce((a,d) => a + d.points, 0);
}

function currentPlayerObj(){
  return state.players[state.currentPlayer];
}

function projectedRemaining(){
  const p = currentPlayerObj();
  if (!p) return null;
  return p.score - turnTotal();
}

/* -------------------- Checkout engine -------------------- */
/* We compute a best checkout (≤ 3 darts) up to 160 by brute force.
   Bull (50) = D25.
   If double-out: last dart must be double.
*/

function dartPool(){
  const pool = [];

  // Singles/Doubles/Triples 1..20
  for (let n=1; n<=20; n++){
    pool.push({ label:`S${n}`, value:n, isDouble:false });
    pool.push({ label:`D${n}`, value:2*n, isDouble:true });
    pool.push({ label:`T${n}`, value:3*n, isDouble:false });
  }

  // Outer bull 25 and bull 50 (D25)
  pool.push({ label:"S25", value:25, isDouble:false });
  pool.push({ label:"Bull", value:50, isDouble:true }); // D25

  return pool;
}

const POOL = dartPool();

function formatCheckout(seq){
  // Make it pretty like: T20 + T20 + D20 (or Bull)
  return seq.map(d => d.label === "Bull" ? "Bull (50)" : d.label).join(" + ");
}

function bestCheckout(remaining, doubleOut=true){
  if (remaining == null) return null;
  if (remaining <= 1) return null;

  // requirement asked: start suggesting from 160 down
  if (remaining > 160) return null;

  // If double-out and remaining is 2..50, there are simple endings etc.
  // brute force 1,2,3 darts.
  let best = null;

  const accept = (seq) => {
    // double-out: last must be double
    if (doubleOut && !seq[seq.length-1].isDouble) return false;
    const sum = seq.reduce((a,d)=>a+d.value,0);
    return sum === remaining;
  };

  // Prefer fewer darts, then prefer higher first dart (more "standard")
  const scoreSeq = (seq) => {
    const values = seq.map(d=>d.value);
    const len = seq.length;
    // primary: len; secondary: higher earlier
    let tie = 0;
    if (len >= 1) tie += values[0] * 1000;
    if (len >= 2) tie += values[1] * 10;
    if (len >= 3) tie += values[2];
    return { len, tie };
  };

  // 1 dart
  for (const a of POOL){
    const seq = [a];
    if (accept(seq)){
      best = seq;
      return best; // 1 dart is always best
    }
  }

  // 2 darts
  for (const a of POOL){
    for (const b of POOL){
      const seq = [a,b];
      if (!accept(seq)) continue;
      if (!best) best = seq;
      else{
        const s1 = scoreSeq(seq), s2 = scoreSeq(best);
        if (s1.len < s2.len || (s1.len === s2.len && s1.tie > s2.tie)) best = seq;
      }
    }
  }

  // 3 darts
  for (const a of POOL){
    for (const b of POOL){
      for (const c of POOL){
        const seq = [a,b,c];
        if (!accept(seq)) continue;
        if (!best) best = seq;
        else{
          const s1 = scoreSeq(seq), s2 = scoreSeq(best);
          if (s1.len < s2.len || (s1.len === s2.len && s1.tie > s2.tie)) best = seq;
        }
      }
    }
  }

  return best;
}

/* -------------------- Labels -------------------- */

function dartLabel(d){
  if (!d) return "—";
  if (d.base === 0) return "Miss (0)";
  if (d.base === 25 && d.mult === "D") return "Bull (50)";
  if (d.base === 25 && d.mult === "S") return "25";
  return `${d.mult}${d.base} (${d.points})`;
}

/* -------------------- UI helpers -------------------- */

function setMobileOverlay(open){
  const overlay = $("#mobileOverlay");
  if (!overlay) return;

  overlay.classList.toggle("hidden", !open);
  overlay.setAttribute("aria-hidden", String(!open));

  document.body.classList.toggle("no-scroll", open);

  if (open){
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
  const p = currentPlayerObj();
  const title = $("#mobileTitle");
  const sub = $("#mobileSub");

  if (!title || !sub) return;

  if (!state.started || !p){
    title.textContent = "—";
    sub.textContent = "—";
    return;
  }

  const remNow = p.score;
  const remAfter = projectedRemaining();

  title.textContent = `${p.name} • Score: ${remNow}`;
  if (state.mobileStep === "numbers"){
    sub.textContent = `Choisis un chiffre (fléchettes: ${state.currentTurn.length}/3)`;
  } else {
    sub.textContent = `Chiffre ${state.mobileNumber} → Simple / Double / Triple`;
  }

  // update live pills too
  const r = $("#mobileRemaining");
  const p2 = $("#mobileProjected");
  if (r) r.textContent = `Reste: ${remNow}`;
  if (p2) p2.textContent = `Après tour: ${remAfter ?? "—"}`;
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

  const p = currentPlayerObj();

  if (ti){
    ti.textContent = (state.started && p) ? `${p.name} • fléchettes: ${state.currentTurn.length}/3` : "—";
  }

  // live remaining on desktop
  const liveR = $("#liveRemaining");
  const liveP = $("#liveProjected");
  if (liveR) liveR.textContent = `Reste: ${p?.score ?? "—"}`;
  if (liveP) liveP.textContent = `Après tour: ${projectedRemaining() ?? "—"}`;

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

  const v = $("#btnValidateTurn");
  const back = $("#btnBackDart");
  const missBtn = $("#btnMiss");
  if (v) v.disabled = !(state.started && state.currentTurn.length > 0);
  if (back) back.disabled = !(state.started && state.currentTurn.length > 0);
  if (missBtn) missBtn.disabled = !state.started || state.currentTurn.length >= 3;
}

function renderMobileTurn(){
  const total = $("#mobileTotal");
  if (total) total.textContent = String(turnTotal());

  const slots = document.querySelectorAll(".mobile-dart-slot");
  slots.forEach((slot) => {
    const idx = Number(slot.getAttribute("data-slot"));
    const v = slot.querySelector(".v");
    if (!v) return;
    v.textContent = dartLabel(state.currentTurn[idx]);
  });

  const validate = $("#btnMobileValidate");
  const undoDart = $("#btnMobileUndoDart");
  const missBtn = $("#btnMobileMiss");

  if (validate) validate.disabled = !(state.started && state.currentTurn.length > 0);
  if (undoDart) undoDart.disabled = !(state.started && state.currentTurn.length > 0);
  if (missBtn) missBtn.disabled = !state.started || state.currentTurn.length >= 3;

  renderMobileHeader();
}

function updateSuggestions(){
  const p = currentPlayerObj();
  const desktopEl = $("#desktopSuggest");
  const mobileEl = $("#mobileSuggest");
  const remaining = projectedRemaining(); // IMPORTANT: updates after each dart

  let text = "—";
  if (state.started && p && remaining != null){
    const seq = bestCheckout(remaining, state.doubleOut);
    if (seq) text = `Suggestion: ${formatCheckout(seq)}`;
    else if (remaining <= 160 && remaining > 0) text = "Pas de checkout simple en 3 fléchettes.";
    else text = "—";
  }

  if (desktopEl) desktopEl.textContent = text;
  if (mobileEl) mobileEl.textContent = text;
}

/* -------------------- Number pads (Bull logic fixed) -------------------- */

function buildDesktopNumbers(){
  const host = $("#numbers");
  if (!host) return;

  host.innerHTML = "";
  const mk = (label, val, kind="number") => {
    const b = document.createElement("button");
    b.className = "btn num";
    b.textContent = label;
    b.dataset.kind = kind;
    b.dataset.val = String(val);
    b.addEventListener("click", () => desktopSelect(b));
    return b;
  };

  for (let i=1;i<=20;i++) host.appendChild(mk(String(i), i));
  host.appendChild(mk("25", 25, "outerbull"));
  host.appendChild(mk("Bull (50)", 50, "bull50"));
}

function desktopSelect(btn){
  if (!state.started) return;

  const kind = btn.dataset.kind;
  const val = Number(btn.dataset.val);

  // Bull (50) = D25 direct
  if (kind === "bull50"){
    addDart(25, "D");
    clearDesktopSelection();
    return;
  }

  // 25 direct
  if (kind === "outerbull"){
    addDart(25, "S");
    clearDesktopSelection();
    return;
  }

  state.selectedNumber = val;

  document.querySelectorAll(".num").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");

  enableDesktopMultis(true);
}

function enableDesktopMultis(on){
  const s = $("#btnS"), d = $("#btnD"), t = $("#btnT");
  if (!s || !d || !t) return;

  s.disabled = !on;
  d.disabled = !on;
  t.disabled = !on;
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

  const mk = (label, action) => {
    const b = document.createElement("button");
    b.className = "btn btn-secondary";
    b.textContent = label;
    b.addEventListener("click", action);
    host.appendChild(b);
  };

  for (let i=1;i<=20;i++){
    mk(String(i), () => mobilePickNumber(i));
  }

  mk("25", () => {
    if (!state.started || state.currentTurn.length >= 3) return;
    addDart(25, "S");
    state.mobileNumber = null;
    mobileSetStep("numbers");
  });

  mk("Bull (50)", () => {
    if (!state.started || state.currentTurn.length >= 3) return;
    addDart(25, "D");
    state.mobileNumber = null;
    mobileSetStep("numbers");
  });
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

  setStatus("Partie lancée.", "ok");

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

  // update live UI after each dart
  renderAll();

  // mobile UX: back to numbers after each dart
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

  const p = currentPlayerObj();
  const startScore = p.score;
  const total = turnTotal();
  const newScore = startScore - total;

  let bust = false;
  let win = false;
  let reason = "";

  // Bust conditions
  if (newScore < 0){
    bust = true; reason = "Bust : score trop bas ( < 0 )";
  } else if (state.doubleOut){
    if (newScore === 1){
      bust = true; reason = "Bust : reste 1 (double-out)";
    } else if (newScore === 0){
      const last = state.currentTurn[state.currentTurn.length - 1];
      if (!last || last.mult !== "D"){
        bust = true; reason = "Bust : il faut finir sur une DOUBLE";
      } else {
        win = true;
      }
    }
  } else {
    if (newScore === 0) win = true;
  }

  if (bust){
    setStatus(reason, "error");
    // score inchangé
  } else if (win){
    p.score = 0;
    setStatus(`${p.name} a gagné !`, "ok");
    state.started = false;
    state.currentTurn = [];
    clearDesktopSelection();
    if (isMobile()) setMobileOverlay(false);
    renderAll();
    return;
  } else {
    p.score = newScore;
    setStatus("Tour validé.", "ok");
  }

  // Next player
  state.currentTurn = [];
  clearDesktopSelection();
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;

  renderAll();
}

function resetAll(){
  state.started = false;
  state.players = [];
  state.currentPlayer = 0;
  state.currentTurn = [];
  clearDesktopSelection();
  setStatus("—", "neutral");
  setMobileOverlay(false);
  renderAll();
}

/* -------------------- Render all -------------------- */

function renderAll(){
  renderScoreboard();
  renderMobileScores();
  renderDesktopTurn();
  renderMobileTurn();
  updateSuggestions();

  // keep mobile numbers built
  if (isMobile() && state.started){
    buildMobileNumbers();
  }
}

/* -------------------- Wiring -------------------- */

function wire(){
  $("#btnNewGame")?.addEventListener("click", newGame);
  $("#btnReset")?.addEventListener("click", resetAll);

  // desktop multis
  document.querySelectorAll(".multi").forEach(b => {
    b.addEventListener("click", () => {
      if (state.selectedNumber == null) return;
      addDart(state.selectedNumber, b.dataset.m);
      clearDesktopSelection();
    });
  });

  $("#btnMiss")?.addEventListener("click", miss);
  $("#btnBackDart")?.addEventListener("click", undoLastDart);
  $("#btnValidateTurn")?.addEventListener("click", validateTurn);

  // mobile multis (1..20 only)
  document.querySelectorAll(".mobile-multi").forEach(b => {
    b.addEventListener("click", () => {
      if (state.mobileNumber == null) return;
      addDart(state.mobileNumber, b.dataset.m);
    });
  });

  $("#btnMobileMiss")?.addEventListener("click", miss);
  $("#btnMobileUndoDart")?.addEventListener("click", undoLastDart);
  $("#btnMobileValidate")?.addEventListener("click", validateTurn);

  $("#btnMobileBack")?.addEventListener("click", () => {
    if (state.mobileStep === "multis"){
      state.mobileNumber = null;
      mobileSetStep("numbers");
    }
  });

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
setStatus("—", "neutral");
enableDesktopMultis(false);
