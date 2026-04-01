(function () {
  const UPDATE_INTERVAL = 5000;

  let matches = [];
  let selectedOdds = [];
  let updateTimer = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(text) {
    if (typeof window.setConnectionStatus === "function") {
      window.setConnectionStatus(text);
    }
  }

  function updateLastUpdateTime() {
    const el = byId("lastUpdate");
    if (el) el.textContent = `Обновлено: ${new Date().toLocaleTimeString()}`;
  }

  async function loadMatches() {
    const apiUrl = window.AppConfig?.API_URL;
    if (!apiUrl) return;

    try {
      setStatus("🟡 Загрузка...");
      const response = await fetch(`${apiUrl}/api/matches`);
      if (!response.ok) throw new Error("Failed to load matches");

      matches = await response.json();
      renderMatches();
      updateLastUpdateTime();
      setStatus("🟢 Онлайн");
    } catch (error) {
      console.error("Error loading matches", error);
      setStatus("🔴 Оффлайн");
    }
  }

  function createMatchCard(match) {
    const isSelected = (type) => selectedOdds.some((o) => o.matchId === match.id && o.type === type);

    return `
      <div class="match-card" data-id="${match.id}">
        <div class="match-info">
          <div class="match-time">${match.time}</div>
          <div class="teams">
            <div class="team">
              <span class="team-logo">${match.homeTeam.logo}</span>
              <span class="team-name">${match.homeTeam.name}</span>
              <span class="team-form">${match.homeTeam.form}</span>
            </div>
            <div class="team">
              <span class="team-logo">${match.awayTeam.logo}</span>
              <span class="team-name">${match.awayTeam.name}</span>
              <span class="team-form">${match.awayTeam.form}</span>
            </div>
          </div>
        </div>
        <div class="odds">
          <div class="odd-box ${isSelected("P1") ? "selected" : ""}" data-match-id="${match.id}" data-type="P1" data-value="${match.odds.p1.toFixed(2)}">
            <div class="odd-label">П1</div>
            <div class="odd-value">${match.odds.p1.toFixed(2)}</div>
          </div>
          <div class="odd-box ${isSelected("X") ? "selected" : ""}" data-match-id="${match.id}" data-type="X" data-value="${match.odds.x.toFixed(2)}">
            <div class="odd-label">X</div>
            <div class="odd-value">${match.odds.x.toFixed(2)}</div>
          </div>
          <div class="odd-box ${isSelected("P2") ? "selected" : ""}" data-match-id="${match.id}" data-type="P2" data-value="${match.odds.p2.toFixed(2)}">
            <div class="odd-label">П2</div>
            <div class="odd-value">${match.odds.p2.toFixed(2)}</div>
          </div>
          <button class="odd-box more" type="button" data-more="1" data-home="${match.homeTeam.name}" data-away="${match.awayTeam.name}" data-p1="${match.odds.p1}" data-x="${match.odds.x}" data-p2="${match.odds.p2}">
            <div class="odd-label">Ещё</div>
            <div class="odd-value">+6</div>
          </button>
        </div>
      </div>
    `;
  }

  function renderMatches() {
    const container = byId("matchesContainer");
    if (!container) return;

    container.innerHTML = matches.map(createMatchCard).join("");
  }

  function renderCoupon() {
    const emptyEl = byId("couponEmpty");
    const itemsEl = byId("couponItems");
    const actionsEl = byId("couponActions");

    if (!emptyEl || !itemsEl || !actionsEl) return;

    if (selectedOdds.length === 0) {
      emptyEl.style.display = "block";
      itemsEl.innerHTML = "";
      actionsEl.style.display = "none";
      return;
    }

    emptyEl.style.display = "none";
    actionsEl.style.display = "flex";

    itemsEl.innerHTML = selectedOdds
      .map(
        (odd, index) => `
          <div class="coupon-item">
            <div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${odd.time}</div>
              <div style="font-weight: 600; font-size: 0.9rem;">${odd.homeTeam} - ${odd.awayTeam}</div>
              <div style="color: var(--accent-yellow); font-weight: 700;">${odd.type} @ ${odd.value.toFixed(2)}</div>
            </div>
            <button class="btn-remove" type="button" data-remove-index="${index}">x</button>
          </div>
        `
      )
      .join("");
  }

  function toggleOdd(matchId, type, value) {
    const match = matches.find((m) => m.id === Number(matchId));
    if (!match) return;

    const existingIndex = selectedOdds.findIndex((o) => o.matchId === Number(matchId) && o.type === type);

    if (existingIndex > -1) {
      selectedOdds.splice(existingIndex, 1);
    } else {
      selectedOdds.push({
        matchId: Number(matchId),
        type,
        value: Number(value),
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        time: match.time
      });
    }

    renderMatches();
    renderCoupon();
  }

  function clearCoupon() {
    selectedOdds = [];
    renderMatches();
    renderCoupon();
  }

  function openMoreModal(homeTeam, awayTeam, p1, x, p2) {
    const modal = byId("moreModal");
    if (!modal) return;

    const title = byId("modalTitle");
    if (title) title.textContent = `${homeTeam} vs ${awayTeam}`;

    const setText = (id, value) => {
      const el = byId(id);
      if (el) el.textContent = value;
    };

    setText("totalOver", (1.5 + Math.random() * 0.8).toFixed(2));
    setText("totalUnder", (1.6 + Math.random() * 0.9).toFixed(2));
    setText("bothYes", (1.4 + Math.random() * 0.6).toFixed(2));
    setText("bothNo", (1.8 + Math.random() * 0.7).toFixed(2));
    setText("fora1", (Number(p1) * 1.2).toFixed(2));
    setText("fora2", (Number(p2) * 0.9).toFixed(2));

    modal.style.display = "flex";
  }

  function closeModal() {
    const modal = byId("moreModal");
    if (modal) modal.style.display = "none";
  }

  function calculateProbability() {
    const homeWins = parseInt(byId("homeWins")?.value || "0", 10);
    const awayWins = parseInt(byId("awayWins")?.value || "0", 10);
    const totalGames = homeWins + awayWins || 1;
    const formProb = (homeWins / totalGames) * 40;

    const h2hHome = parseInt(byId("h2hHome")?.value || "0", 10);
    const h2hDraw = parseInt(byId("h2hDraw")?.value || "0", 10);
    const h2hAway = parseInt(byId("h2hAway")?.value || "0", 10);
    const totalH2h = h2hHome + h2hDraw + h2hAway || 1;
    const h2hProb = (h2hHome / totalH2h) * 30;

    let baseProb = formProb + h2hProb + 15;

    if (byId("homeAdvantage")?.checked) baseProb += 5;
    if (byId("keyInjuries")?.checked) baseProb -= 10;
    if (byId("highMotivation")?.checked) baseProb += 5;
    if (byId("fatigue")?.checked) baseProb -= 5;

    baseProb = Math.max(10, Math.min(90, baseProb));

    const probEl = byId("calculatedProb");
    if (probEl) probEl.textContent = `${baseProb.toFixed(1)}%`;

    return baseProb;
  }

  function applyCalculatedProb() {
    const probability = calculateProbability();
    const input = byId("yourProbability");
    if (input) input.value = probability.toFixed(1);
  }

  function displayCalcResult(result) {
    const container = byId("calcResults");
    if (!container) return;

    const valueClass = result.value > 0 ? "positive" : result.value < 0 ? "negative" : "";
    const recColor = result.isValue ? "var(--accent-green)" : result.value > -0.05 ? "var(--text-secondary)" : "var(--accent-red)";

    container.style.display = "block";
    container.innerHTML = `
      <div class="result-item">
        <span>Маржа букмекера:</span>
        <span>${result.impliedProbability}%</span>
      </div>
      <div class="result-item">
        <span>Настоящий коэффициент:</span>
        <span>${result.trueOdd}</span>
      </div>
      <div class="result-item">
        <span>Value:</span>
        <span class="value-highlight ${valueClass}">${result.value > 0 ? "+" : ""}${result.value}</span>
      </div>
      <div class="result-item">
        <span>Рекомендация:</span>
        <span style="color: ${recColor}; font-weight: 600;">${result.recommendation}</span>
      </div>
    `;
  }

  async function calculateValue() {
    const odd = parseFloat(byId("bookmakerOdd")?.value || "0");
    const probability = parseFloat(byId("yourProbability")?.value || "0");

    if (!odd || !probability || probability <= 0 || probability > 100) {
      alert("Введите корректные данные");
      return;
    }

    const apiUrl = window.AppConfig?.API_URL;
    if (!apiUrl) return;

    try {
      const response = await fetch(`${apiUrl}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmakerOdd: odd, yourProbability: probability })
      });

      if (!response.ok) throw new Error("Failed to calculate value");
      const result = await response.json();
      displayCalcResult(result);
    } catch (error) {
      console.error("Error calculating value", error);
      alert("Ошибка расчета");
    }
  }

  function onMatchesContainerClick(event) {
    const removeButton = event.target.closest("[data-remove-index]");
    if (removeButton) {
      const index = Number(removeButton.dataset.removeIndex);
      if (!Number.isNaN(index)) {
        selectedOdds.splice(index, 1);
        renderMatches();
        renderCoupon();
      }
      return;
    }

    const oddBox = event.target.closest(".odd-box");
    if (!oddBox) return;

    if (oddBox.dataset.more === "1") {
      openMoreModal(
        oddBox.dataset.home,
        oddBox.dataset.away,
        oddBox.dataset.p1,
        oddBox.dataset.x,
        oddBox.dataset.p2
      );
      return;
    }

    toggleOdd(oddBox.dataset.matchId, oddBox.dataset.type, oddBox.dataset.value);
  }

  function setupEvents() {
    const matchesContainer = byId("matchesContainer");
    if (matchesContainer) {
      matchesContainer.addEventListener("click", onMatchesContainerClick);
    }

    const couponItems = byId("couponItems");
    if (couponItems) {
      couponItems.addEventListener("click", onMatchesContainerClick);
    }

    const calculateBtn = byId("calculateBtn");
    if (calculateBtn) calculateBtn.addEventListener("click", calculateValue);

    const clearBtn = byId("clearCoupon");
    if (clearBtn) clearBtn.addEventListener("click", clearCoupon);
  }

  async function init() {
    if (!byId("matchesContainer")) return;

    setupEvents();
    calculateProbability();
    await loadMatches();

    updateTimer = setInterval(loadMatches, UPDATE_INTERVAL);

    window.addEventListener("beforeunload", function () {
      if (updateTimer) clearInterval(updateTimer);
    });
  }

  window.calculateProbability = calculateProbability;
  window.applyCalculatedProb = applyCalculatedProb;
  window.closeModal = closeModal;

  document.addEventListener("DOMContentLoaded", init);
})();
