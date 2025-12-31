/**
 * Wishlist Savings Tracker (Vanilla JS)
 * - LocalStorage persistence
 * - Add goal (name/desc/target)
 * - Add savings with validation (cannot exceed target)
 * - Progress % + progress bar
 * - Delete goal
 * - Edit target
 * - Currency toggle (₹ / $)
 * - Dark mode toggle
 */

(() => {
  "use strict";

  const STORAGE_KEY = "wst_goals_v1";
  const PREFS_KEY = "wst_prefs_v1";

  /** @type {{ id:string, name:string, desc:string, target:number, saved:number, createdAt:number }[]} */
  let goals = [];

  /** @type {{ currency: "INR"|"USD", theme:"dark"|"light" }} */
  let prefs = { currency: "INR", theme: "dark" };

  // DOM
  const goalsGrid = document.getElementById("goalsGrid");
  const emptyState = document.getElementById("emptyState");

  const addGoalForm = document.getElementById("addGoalForm");
  const goalNameEl = document.getElementById("goalName");
  const goalDescEl = document.getElementById("goalDesc");
  const goalTargetEl = document.getElementById("goalTarget");
  const formErrorEl = document.getElementById("formError");
  const resetAllBtn = document.getElementById("resetAllBtn");

  const sumGoalsEl = document.getElementById("sumGoals");
  const sumRequiredEl = document.getElementById("sumRequired");
  const sumSavedEl = document.getElementById("sumSaved");
  const sumRemainingEl = document.getElementById("sumRemaining");

  const currencyToggleBtn = document.getElementById("currencyToggle");
  const themeToggleBtn = document.getElementById("themeToggle");

  // ---------- Utilities ----------
  function uid() {
    // Simple unique ID (enough for local app)
    return "g_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function currencySymbol() {
    return prefs.currency === "INR" ? "₹" : "$";
  }

  function formatMoney(amount) {
    // Keep it simple: symbol + locale formatting
    const symbol = currencySymbol();

    // Use locale based on currency preference
    const locale = prefs.currency === "INR" ? "en-IN" : "en-US";
    const formatted = Number(amount).toLocaleString(locale, { maximumFractionDigits: 2 });
    return `${symbol}${formatted}`;
  }

  function computeRemaining(target, saved) {
    return round2(Math.max(0, target - saved));
  }

  function computeProgressPct(target, saved) {
    if (target <= 0) return 0;
    return clamp((saved / target) * 100, 0, 100);
  }

  function setFormError(msg) {
    formErrorEl.textContent = msg || "";
  }

  // ---------- Storage ----------
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) goals = parsed;

      const pr = localStorage.getItem(PREFS_KEY);
      const parsedPrefs = pr ? JSON.parse(pr) : null;
      if (parsedPrefs && typeof parsedPrefs === "object") {
        prefs = {
          currency: parsedPrefs.currency === "USD" ? "USD" : "INR",
          theme: parsedPrefs.theme === "light" ? "light" : "dark",
        };
      }
    } catch (e) {
      // If storage is corrupted, start fresh
      goals = [];
      prefs = { currency: "INR", theme: "dark" };
    }
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  // ---------- Rendering ----------
  function render() {
    applyPrefsToUI();
    renderSummary();
    renderGrid();
    saveToStorage();
  }

  function applyPrefsToUI() {
    document.body.setAttribute("data-theme", prefs.theme);

    // Currency button label
    currencyToggleBtn.innerHTML = `${currencySymbol()} <span class="chip-muted">/ ${prefs.currency === "INR" ? "$" : "₹"}</span>`;

    // Theme button label
    themeToggleBtn.innerHTML =
      prefs.theme === "dark"
        ? `🌙 <span class="chip-muted">Dark</span>`
        : `☀️ <span class="chip-muted">Light</span>`;
  }

  function renderSummary() {
    const totalGoals = goals.length;
    const totalRequired = goals.reduce((acc, g) => acc + g.target, 0);
    const totalSaved = goals.reduce((acc, g) => acc + g.saved, 0);
    const totalRemaining = Math.max(0, totalRequired - totalSaved);

    sumGoalsEl.textContent = String(totalGoals);
    sumRequiredEl.textContent = formatMoney(round2(totalRequired));
    sumSavedEl.textContent = formatMoney(round2(totalSaved));
    sumRemainingEl.textContent = formatMoney(round2(totalRemaining));
  }

  function renderGrid() {
    goalsGrid.innerHTML = "";

    if (goals.length === 0) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    // Newest first
    const sorted = [...goals].sort((a, b) => b.createdAt - a.createdAt);

    for (const g of sorted) {
      const remaining = computeRemaining(g.target, g.saved);
      const pct = computeProgressPct(g.target, g.saved);
      const achieved = remaining <= 0 && g.target > 0;

      const card = document.createElement("article");
      card.className = "card";
      card.dataset.id = g.id;

      card.innerHTML = `
        <div class="card-top">
          <div class="card-title">
            <h3 class="goal-name">${escapeHtml(g.name)}</h3>
            ${g.desc ? `<p class="goal-desc">${escapeHtml(g.desc)}</p>` : `<p class="goal-desc">—</p>`}
          </div>

          <div class="card-actions">
            <button class="icon-btn" data-action="edit" title="Edit target" aria-label="Edit target">✏️</button>
            <button class="icon-btn" data-action="delete" title="Delete goal" aria-label="Delete goal">🗑️</button>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi">
            <div class="kpi-label">Target</div>
            <div class="kpi-value">${formatMoney(g.target)}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Saved</div>
            <div class="kpi-value">${formatMoney(g.saved)}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Remaining</div>
            <div class="kpi-value">${formatMoney(remaining)}</div>
          </div>
        </div>

        <div class="progress-wrap">
          <div class="progress-meta">
            <span>${achieved ? `<span class="goal-achieved">Goal Achieved 🎉</span>` : `Progress`}</span>
            <span class="progress-pill">${Math.round(pct)}%</span>
          </div>

          <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(
            pct
          )}">
            <div class="progress-fill" style="width: ${pct.toFixed(2)}%"></div>
          </div>

          <form class="inline-form" data-action="addSavingsForm">
            <input
              type="number"
              inputmode="decimal"
              min="0"
              step="0.01"
              placeholder="Add savings (e.g., 5000)"
              ${achieved ? "disabled" : ""}
              aria-label="Add savings amount"
            />
            <button class="btn" type="submit" ${achieved ? "disabled" : ""}>
              + Add
            </button>
            <span class="small-note">${achieved ? "This goal is complete." : `Max add: ${formatMoney(remaining)}`}</span>
          </form>
        </div>
      `;

      goalsGrid.appendChild(card);

      // Ensure animation triggers after insertion
      requestAnimationFrame(() => {
        const fill = card.querySelector(".progress-fill");
        if (fill) fill.style.width = `${pct.toFixed(2)}%`;
      });
    }
  }

  // Escape HTML to prevent injection (basic XSS safety)
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- Actions ----------
  function addGoal({ name, desc, target }) {
    const newGoal = {
      id: uid(),
      name: name.trim(),
      desc: desc.trim(),
      target: round2(target),
      saved: 0,
      createdAt: Date.now(),
    };
    goals.push(newGoal);
    render();
  }

  function deleteGoal(id) {
    goals = goals.filter((g) => g.id !== id);
    render();
  }

  function addSavings(id, amountToAdd) {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;

    const remaining = computeRemaining(goal.target, goal.saved);
    const amt = round2(amountToAdd);

    if (!(amt > 0)) return;

    // Validation: cannot exceed target
    if (amt > remaining) {
      alert(`You can only add up to ${formatMoney(remaining)} for this goal.`);
      return;
    }

    goal.saved = round2(goal.saved + amt);
    render();
  }

  function editTarget(id) {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;

    const current = goal.target;
    const input = prompt("Enter new target amount:", String(current));
    if (input === null) return;

    const newTarget = safeNumber(input);
    if (!Number.isFinite(newTarget) || newTarget <= 0) {
      alert("Please enter a valid target amount greater than 0.");
      return;
    }

    // If saved > new target, we clamp saved to new target (so progress stays consistent)
    goal.target = round2(newTarget);
    if (goal.saved > goal.target) goal.saved = goal.target;

    render();
  }

  function resetAll() {
    const ok = confirm("This will delete ALL goals and preferences saved in this browser. Continue?");
    if (!ok) return;
    goals = [];
    prefs = { currency: "INR", theme: "dark" };
    saveToStorage();
    render();
  }

  // ---------- Event Listeners ----------
  addGoalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setFormError("");

    const name = goalNameEl.value || "";
    const desc = goalDescEl.value || "";
    const target = safeNumber(goalTargetEl.value);

    if (!name.trim()) {
      setFormError("Please enter a goal name.");
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      setFormError("Please enter a valid target amount greater than 0.");
      return;
    }

    addGoal({ name, desc, target });

    // Clear inputs
    goalNameEl.value = "";
    goalDescEl.value = "";
    goalTargetEl.value = "";
    goalNameEl.focus();
  });

  resetAllBtn.addEventListener("click", resetAll);

  currencyToggleBtn.addEventListener("click", () => {
    prefs.currency = prefs.currency === "INR" ? "USD" : "INR";
    render();
  });

  themeToggleBtn.addEventListener("click", () => {
    prefs.theme = prefs.theme === "dark" ? "light" : "dark";
    render();
  });

  // Event delegation for dynamic cards
  goalsGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const card = e.target.closest(".card");
    if (!card) return;

    const id = card.dataset.id;
    const action = btn.dataset.action;

    if (action === "delete") {
      const ok = confirm("Delete this goal?");
      if (ok) deleteGoal(id);
    }

    if (action === "edit") {
      editTarget(id);
    }
  });

  goalsGrid.addEventListener("submit", (e) => {
    const form = e.target.closest('form[data-action="addSavingsForm"]');
    if (!form) return;

    e.preventDefault();
    const card = e.target.closest(".card");
    if (!card) return;

    const id = card.dataset.id;
    const input = form.querySelector("input");
    const amt = safeNumber(input.value);

    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Enter a valid savings amount greater than 0.");
      return;
    }

    addSavings(id, amt);
    input.value = "";
  });

  // ---------- Init ----------
  function init() {
    loadFromStorage();
    render();
  }

  init();
})();
