/* Darts Counter – PWA
   - 501/301
   - Saisie dart-by-dart: choisir chiffre puis S/D/T
   - Double-out optionnel (Bull = D25)
   - Multi joueurs (1..8), 3 fléchettes par tour
   - Undo (pile d'états)
   - UI mobile "focus mode" (plein écran) : chiffres -> S/D/T
*/

const $ = (sel) => document.querySelector(sel);

const state = {
  started: false,
  mode: 501,
  doubleOut: true,
  playersCount: 2,
  players: [],
  currentPlayer: 0,
  currentTurn: [], // [{base, mult, points}]
  selectedNumber: null, // base number chosen (desktop UI)
  history: [], // snapshots for undo
  log: [] // readable history entries
};

function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

function snapshot() {
  // keep minimal snapshot for undo
  return deepClone({
    started: state.started,
    mode: state.mode,
    doubleOut: state.doubleOut,
    playersCount: state.playersCount,
    players: state.players,
    currentPlayer: state.currentPlayer,
    currentTurn: state.currentTurn,
    selectedNumber: state.selectedNumber,
    log: state.log
  });
}

function restore(snap) {
  Object.assign(state, deepClone(snap));
  renderAll();
  // keep mobile overlay in sync
  if (!state.started) setMobileOverlay(false);
  else if (isMobile()) setMobileOverlay(true);
}

function pushUndo() {
  state.history.push(snapshot());
  $("#btnUndo").disabled = state.history.length === 0;
}

function setStatus(msg, ok=false) {
  const el = $("#status");
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? "var(--ok)" : "";
}

/* ------------------ Desktop number pad ------------------ */

function buildNumberPad() {
  const numbers = $("#numbers");
  if (!numbers) return;
  numbers.innerHTML = "";

  const btn = (label, val) => {
    const b = document.createElement("button");
    b.className = "btn num";
    b.textContent = label;
    b.dataset.val = String(val);
    b.addEventListener("click", () => selectNumber(val));
    return b;
  };

  // 1..20
  for (let i=1;i<=20;i++) numbers.appendChild(btn(String(i), i));
  numbers.appendChild(btn("25", 25));
  numbers.appendChild(btn("Bull", 25)); // Bull is D25 via multiplier
}

function selectNumber(val) {
  if (!state.started) return;
  state.selectedNumber = val;

  // visually mark selected
  [...document.querySelectorAll(".num")].forEach(b => {
    const is25Bull = (val === 25) && (b.textContent === "25" || b.textContent === "Bull");
    const isMatch = Number(b.dataset.val) === val;
    b.classList.toggle("selected", isMatch || is25Bull);
  });

  // enable multipliers
  enableMultipliers(true);
  updateHint();
}

function enableMultipliers(on) {
  const btnS = $("#btnS"), btnD = $("#btnD"), btnT = $("#btnT");
  if (!btnS || !btnD || !btnT) return;

  btnS.disabled = !on;
  btnD.disabled = !on;
  btnT.disabled = !on;

  // If 25 selected, triple is not valid in standard darts.
  if (on && state.selectedNumber === 25) {
    btnT.disabled = true;
  }
}

/* ------------------ Core dart logic ------------------ */

function addDart(mult) {
  if (!state.started) return;
  if (state.currentTurn.length >= 3) return;

  const base = state.selectedNumber;
  if (base == null) return;

  // Validate triple on 25
  if (base === 25 && mult === "T") return;

  const m = (mult === "S") ? 1 : (mult === "D" ? 2 : 3);
  const points = base * m;

  state.currentTurn.push({ base, mult, points });

  // reset selection (desktop)
  state.selectedNumber = null;
  enableMultipliers(false);
  clearSelectedNumbersUI();

  renderTurn();
  $("#btnValidateTurn").disabled = state.currentTurn.length === 0;
  $("#btnBackDart").disabled = state.currentTurn.length === 0;

  // keep mobile bottom in sync
  mobileUpdateBottom();
}

function clearSelectedNumbersUI(){
  [...document.querySelectorAll(".num")].forEach(b => b.classList.remove("selected"));
}

function removeLastDart() {
  if (!state.started) return;
  if (state.currentTurn.length === 0) return;
  state.currentTurn.pop();
  renderTurn();

  $("#btnValidateTurn").disabled = state.currentTurn.length === 0;
  $("#btnBackDart").disabled = state.currentTurn.length === 0;

  enableMultipliers(false);
  clearSelectedNumbersUI();
  state.selectedNumber = null;

  updateHint();
  mobileUpdateBottom();
}

function miss() {
  if (!state.started) return;
  if (state.currentTurn.length >= 3) return;
  state.currentTurn.push({ base: 0, mult: "S", points: 0 });

  renderTurn();
  $("#btnValidateTurn").disabled = state.currentTurn.length === 0;
  $("#btnBackDart").disabled = state.currentTurn.length === 0;

  mobileUpdateBottom();
}

function getTurnTotal() {
  return state.currentTurn.reduce((a,d) => a + d.points, 0);
}

function dartLabel(d) {
  if (d.base === 0) return "Miss";
  if (d.base === 25 && d.mult === "D") return "Bull (50)";
  if (d.base === 25 && d.mult === "S") return "25";
  return `${d.mult}${d.base} (${d.points})`;
}

function isDoubleDart(d) {
  // Bull counts as double (D25)
  return d.mult === "D";
}

function validateTurn() {
  if (!state.started) return;
  if (state.currentTurn.length === 0) return;

  pushUndo();

  const p = state.players[state.currentPlayer];
  const startScore = p.score;
  const total = getTurnTotal();
  const newScore = startScore - total;

  // Bust rules (standard x01):
  // - if newScore < 0 => bust
  // - if doubleOut enabled: newScore === 1 => bust, newScore === 0 must end on double
  // - if doubleOut disabled: newScore === 0 ok
  let bust = false;
  let win = false;
  let reason = "";

  if (newScore < 0) {
    bust = true; reason = "Bust (score < 0)";
  } else if (state.doubleOut) {
    if (newScore === 1) { bust = true; reason = "Bust (reste 1 en double-out)"; }
    else if (newScore === 0) {
      const last = state.currentTurn[state.currentTurn.length - 1];
      if (!isDoubleDart(last)) {
        bust = true; reason = "Bust (finir sur une double)";
      } else {
        win = true;
      }
    }
  } else {
    if (newScore === 0) win = true;
  }

  // Apply
  let entry;
  if (bust) {
    // score unchanged, next player
    entry = `${p.name}: ${state.currentTurn.map(dartLabel).join(" • ")} = ${total} → Bust (score reste ${startScore})`;
    setStatus(reason, false);
  } else if (win) {
    p.score = 0;
    entry = `${p.name}: ${state.currentTurn.map(dartLabel).join(" • ")} = ${total} → ✅ WIN`;
    setStatus(`${p.name} a gagné !`, true);
    state.started = false;
  } else {
    p.score = newScore;
    entry = `${p.name}: ${state.currentTurn.map(dartLabel).join(" • ")} = ${total} → ${p.score}`;
    setStatus("Tour validé.", true);
  }

  state.log.unshift(entry);
  state.currentTurn = [];
  state.selectedNumber = null;
  enableMultipliers(false);
  clearSelectedNumbersUI();

  if (state.started) {
    state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  }

  renderAll();

  // mobile overlay sync
  if (!state.started) setMobileOverlay(false);
  else if (isMobile()) setMobileOverlay(true);
  mobileUpdateBottom();
}

function newGame() {
  pushUndo();

  state.mode = Number($("#mode").value);
  state.playersCount = Number($("#playersCount").value);
  state.doubleOut = $("#doubleOut").checked;

  state.players = Array.from({length: state.playersCount}).map((_,i) => ({
    name: `Joueur ${i+1}`,
    score: state.mode
  }));

  state.currentPlayer = 0;
  state.currentTurn = [];
  state.selectedNumber = null;
  state.started = true;
  state.log = [];

  setStatus("Partie lancée.", true);
  renderAll();

  // mobile overlay on start (mobile only)
  if (isMobile()) setMobileOverlay(true);
}

function resetAll() {
  // hard reset without undo
  state.started = false;
  state.players = [];
  state.currentPlayer = 0;
  state.currentTurn = [];
  state.selectedNumber = null;
  state.history = [];
  state.log = [];
  setStatus("—", false);

  setMobileOverlay(false);
  renderAll();
}

function undo() {
  if (state.history.length === 0) return;
  const snap = state.history.pop();
  $("#btnUndo").disabled = state.history.length === 0;
  restore(snap);
  setStatus("Undo.", true);
}

/* ------------------ Rendering ------------------ */

function renderScoreboard() {
  const sb = $("#scoreboard");
  if (!sb) return;

  sb.innerHTML = "";
  if (state.players.length === 0) {
    sb.innerHTML = `<div class="pill">Crée une partie.</div>`;
    return;
  }

  state.players.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "player" + (state.started && idx === state.currentPlayer ? " active" : "");
    const left = document.createElement("div");
    left.className = "name";
    left.innerHTML = `<b>${p.name}</b><span>${idx === state.currentPlayer && state.started ? "Au tour de jouer" : "—"}</span>`;

    const right = document.createElement("div");
    right.className = "score";
    right.textContent = p.score;

    row.appendChild(left);
    row.appendChild(right);
    sb.appendChild(row);
  });
}

function renderTurn() {
  const td = $("#turnDarts");
  if (!td) return;

  td.innerHTML = "";
  state.currentTurn.forEach((d, i) => {
    const chip = document.createElement("div");
    chip.className = "dart-chip";
    chip.textContent = `${i+1}. ${dartLabel(d)}`;
    td.appendChild(chip);
  });

  const tt = $("#turnTotal");
  if (tt) tt.textContent = String(getTurnTotal());

  const who = state.players[state.currentPlayer]?.name ?? "—";
  const ti = $("#turnInfo");
  if (ti) ti.textContent = state.started ? `${who} • fléchettes: ${state.currentTurn.length}/3` : "—";
}

function renderHistory() {
  const h = $("#historyList");
  if (!h) return;

  h.innerHTML = "";
  if (state.log.length === 0) {
    h.innerHTML = `<div class="hist-item">Aucun tour pour l’instant.</div>`;
    return;
  }
  state.log.slice(0, 50).forEach(line => {
    const div = document.createElement("div");
    div.className = "hist-item";
    div.innerHTML = line.replace(/^([^:]+):/, "<b>$1</b>:");
    h.appendChild(div);
  });
}

function updateHint() {
  const hint = $("#hint");
  if (!hint) return;

  if (!state.started) {
    hint.innerHTML = `Clique <b>Nouvelle partie</b> pour commencer.`;
    return;
  }
  if (state.currentTurn.length >= 3) {
    hint.innerHTML = `Tour complet. Clique <b>Valider tour</b>.`;
    return;
  }
  if (state.selectedNumber == null) {
    hint.innerHTML = `Choisis un <b>chiffre</b>, puis <b>Simple/Double/Triple</b>.`;
  } else {
    const base = state.selectedNumber;
    hint.innerHTML = `Base <b>${base}</b> sélectionnée. Choisis <b>Simple/Double/Triple</b>.`;
  }
}

function renderAll() {
  if ($("#mode")) $("#mode").value = String(state.mode);
  if ($("#playersCount")) $("#playersCount").value = String(state.playersCount);
  if ($("#doubleOut")) $("#doubleOut").checked = state.doubleOut;

  renderScoreboard();
  renderTurn();
  renderHistory();
  updateHint();

  const v = $("#btnValidateTurn");
  const b = $("#btnBackDart");
  const u = $("#btnUndo");

  if (v) v.disabled = !(state.started && state.currentTurn.length > 0);
  if (b) b.disabled = !(state.started && state.currentTurn.length > 0);
  if (u) u.disabled = state.history.length === 0;

  mobileUpdateBottom();
}

/* ------------------ Mobile Focus Mode Overlay ------------------ */

const isMobile = () => window.matchMedia("(max-width: 980px)").matches;

const mobileUI = {
  step: "numbers", // "numbers" | "multis"
  selectedNumber: null
};

function setMobileOverlay(open) {
  const overlay = $("#mobileOverlay");
  if (!overlay) return;

  if (open) {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    renderMobileNumbers();
    mobileSetStep("numbers");
    mobileUpdateTop();
    mobileUpdateBottom();
  } else {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    mobileUI.step = "numbers";
    mobileUI.selectedNumber = null;
  }
}

function mobileSetStep(step) {
  mobileUI.step = step;

  const stepNumbers = $("#mobileStepNumbers");
  const stepMultis = $("#mobileStepMultis");
  if (stepNumbers) stepNumbers.classList.toggle("hidden", step !== "numbers");
  if (stepMultis) stepMultis.classList.toggle("hidden", step !== "multis");

  const back = $("#btnMobileBack");
  if (back) back.disabled = (step === "numbers");

  mobileUpdateTop();
}

function mobileUpdateTop() {
  const who = state.players[state.currentPlayer]?.name ?? "—";
  const title = $("#mobileOverlayTitle");
  if (!title) return;

  if (!state.started) title.textContent = "—";
  else if (mobileUI.step === "numbers") title.textContent = `${who} • Choisis un chiffre`;
  else title.textContent = `${who} • ${mobileUI.selectedNumber} → Simple/Double/Triple`;
}

function mobileUpdateBottom() {
  const t = $("#mobileTurnTotal");
  if (t) t.textContent = String(getTurnTotal());

  const v = $("#btnMobileValidate");
  if (v) v.disabled = !(state.started && state.currentTurn.length > 0);
}

function renderMobileNumbers() {
  const host = $("#mobileNumbers");
  if (!host) return;

  host.innerHTML = "";
  const add = (label, val) => {
    const b = document.createElement("button");
    b.className = "btn btn-secondary";
    b.textContent = label;
    b.addEventListener("click", () => {
      if (!state.started) return;
      if (state.currentTurn.length >= 3) return;
      mobileUI.selectedNumber = val;
      mobileSetStep("multis");
    });
    host.appendChild(b);
  };

  for (let i = 1; i <= 20; i++) add(String(i), i);
  add("25", 25);
  add("Bull", 25);
}

function mobileAddDart(mult) {
  if (!state.started) return;
  if (state.currentTurn.length >= 3) return;

  // no triple on 25
  if (mobileUI.selectedNumber === 25 && mult === "T") return;

  state.selectedNumber = mobileUI.selectedNumber;
  addDart(mult);

  mobileUI.selectedNumber = null;
  mobileSetStep("numbers");
  mobileUpdateBottom();
}

/* ------------------ Events wiring ------------------ */

function wireEvents() {
  $("#btnNewGame")?.addEventListener("click", newGame);
  $("#btnValidateTurn")?.addEventListener("click", validateTurn);
  $("#btnBackDart")?.addEventListener("click", removeLastDart);
  $("#btnMiss")?.addEventListener("click", miss);
  $("#btnUndo")?.addEventListener("click", undo);
  $("#btnReset")?.addEventListener("click", resetAll);

  // Multipliers (desktop)
  document.querySelectorAll(".multi").forEach(b => {
    b.addEventListener("click", () => addDart(b.dataset.m));
  });

  // Debug helper (optional)
  $("#btnEndLeg")?.addEventListener("click", () => {
    if (!state.started || !state.players[state.currentPlayer]) return;
    pushUndo();
    state.players[state.currentPlayer].score = 0;
    state.started = false;
    state.log.unshift(`${state.players[state.currentPlayer].name}: 🔧 fin forcée`);
    setStatus("Fin forcée.", true);
    renderAll();
    setMobileOverlay(false);
  });

  // Update options without forcing new game
  $("#mode")?.addEventListener("change", () => { state.mode = Number($("#mode").value); renderAll(); });
  $("#playersCount")?.addEventListener("change", () => { state.playersCount = Number($("#playersCount").value); renderAll(); });
  $("#doubleOut")?.addEventListener("change", () => { state.doubleOut = $("#doubleOut").checked; renderAll(); });

  // Mobile overlay controls
  $("#btnMobileBack")?.addEventListener("click", () => {
    if (mobileUI.step === "multis") {
      mobileUI.selectedNumber = null;
      mobileSetStep("numbers");
    }
  });

  document.querySelectorAll(".mobile-multi").forEach(b => {
    b.addEventListener("click", () => mobileAddDart(b.dataset.m));
  });

  $("#btnMobileMiss")?.addEventListener("click", () => {
    miss();
    mobileUpdateBottom();
  });

  $("#btnMobileValidate")?.addEventListener("click", () => {
    validateTurn();
    mobileUpdateBottom();
  });

  // Keyboard shortcuts (desktop)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter") validateTurn();
    if (e.key === "Backspace") removeLastDart();
  });

  // Keep overlay in sync when resizing/orientation change
  window.addEventListener("resize", () => {
    if (state.started && isMobile()) setMobileOverlay(true);
    if (!isMobile()) setMobileOverlay(false);
  });
}

/* ------------------ Init ------------------ */

buildNumberPad();
wireEvents();
renderAll();
setStatus("—");

// Default UI state (desktop multipliers disabled)
enableMultipliers(false);
