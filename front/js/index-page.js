(function () {
  const UPDATE_INTERVAL = 5000;
  const SELECTED_ODDS_STORAGE_KEY = "selectedOddsForStats";
  const ANALYSIS_SELECTION_STORAGE_KEY = "selectedMatchesForAnalysis";

  let matches = [];
  let selectedOdds = [];
  let updateTimer = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function loadSelectedOddsFromStorage() {
    const raw = localStorage.getItem(SELECTED_ODDS_STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to parse selected odds from storage", error);
      return [];
    }
  }

  function saveSelectedOddsToStorage() {
    localStorage.setItem(SELECTED_ODDS_STORAGE_KEY, JSON.stringify(selectedOdds));
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

  function openAddMatchModal() {
    const currentUser = window.AuthState?.getCurrentUser?.();
    if (!currentUser) {
      alert("Сначала войдите в аккаунт");
      if (typeof window.openLoginModal === "function") {
        window.openLoginModal();
      }
      return;
    }

    const modal = byId("addMatchModal");
    if (modal) modal.style.display = "flex";
  }

  function closeAddMatchModal() {
    const modal = byId("addMatchModal");
    if (modal) modal.style.display = "none";
  }

  async function handleAddMatchSubmit(event) {
    event.preventDefault();

    const currentUser = window.AuthState?.getCurrentUser?.();
    if (!currentUser) {
      alert("Сначала войдите в аккаунт");
      return;
    }

    const league = byId("addLeague")?.value?.trim();
    const time = byId("addTime")?.value?.trim();
    const homeTeam = byId("addHomeTeam")?.value?.trim();
    const awayTeam = byId("addAwayTeam")?.value?.trim();
    const p1 = parseFloat(byId("addP1")?.value || "0");
    const x = parseFloat(byId("addX")?.value || "0");
    const p2 = parseFloat(byId("addP2")?.value || "0");

    if (!league || !time || !homeTeam || !awayTeam) {
      alert("Заполните все поля матча");
      return;
    }

    if (!p1 || !x || !p2 || p1 <= 0 || x <= 0 || p2 <= 0) {
      alert("Введите корректные коэффициенты");
      return;
    }

    const apiUrl = window.AppConfig?.API_URL;
    if (!apiUrl) return;

    try {
      const response = await fetch(`${apiUrl}/api/users/${currentUser.id}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ league, time, homeTeam, awayTeam, p1, x, p2 })
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(errorMessage || "Could not create user match");
      }

      const form = byId("addMatchForm");
      if (form) form.reset();

      closeAddMatchModal();
      await loadMatches();
      alert("Матч добавлен");
    } catch (error) {
      console.error("Error creating user match", error);
      alert("Не удалось добавить матч");
    }
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

    console.log(`toggleOdd called: matchId=${matchId}, type=${type}, existingIndex=${existingIndex}, currentLength=${selectedOdds.length}`);

    if (existingIndex > -1) {
      selectedOdds.splice(existingIndex, 1);
      console.log(`Removed odd. New selectedOdds:`, selectedOdds);
    } else {
      selectedOdds.push({
        matchId: Number(matchId),
        type,
        value: Number(value),
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        time: match.time,
        league: match.league,
        score: match.score || "",
        isLive: Boolean(match.isLive),
        odds: {
          p1: Number(match.odds.p1),
          x: Number(match.odds.x),
          p2: Number(match.odds.p2)
        }
      });
      console.log(`Added odd. New selectedOdds:`, selectedOdds);
    }

    saveSelectedOddsToStorage();
    renderMatches();
    renderCoupon();
  }

  function clearCoupon() {
    selectedOdds = [];
    saveSelectedOddsToStorage();
    renderMatches();
    renderCoupon();
  }

  function goToAnalysis() {
    if (selectedOdds.length === 0) {
      alert("Сначала выбери хотя бы один исход");
      return;
    }

    localStorage.setItem(ANALYSIS_SELECTION_STORAGE_KEY, JSON.stringify(selectedOdds));
    window.location.href = "Analiz.html";
  }

  async function addSelectedMatchesToFavorites() {
    if (selectedOdds.length === 0) {
      alert("Сначала выбери хотя бы один исход");
      return;
    }

    const currentUser = window.AuthState?.getCurrentUser?.();
    if (!currentUser) {
      alert("Сначала войдите в аккаунт");
      if (typeof window.openLoginModal === "function") {
        window.openLoginModal();
      }
      return;
    }

    const apiUrl = window.AppConfig?.API_URL;
    if (!apiUrl) return;

    try {
      const userCheck = await fetch(`${apiUrl}/api/users/${currentUser.id}`);
      if (!userCheck.ok) {
        alert("Сессия устарела. Войдите в аккаунт заново.");
        window.AuthState?.setCurrentUser?.(null);
        if (typeof window.openLoginModal === "function") {
          window.openLoginModal();
        }
        return;
      }
    } catch (error) {
      console.error("Error checking user session", error);
      alert("Не удалось проверить сессию пользователя");
      return;
    }

    const uniqueSelections = Object.values(
      selectedOdds.reduce((acc, odd) => {
        if (!acc[odd.matchId]) {
          acc[odd.matchId] = odd;
        }
        return acc;
      }, {})
    );

    let addedCount = 0;
    let skippedCount = 0;

    for (const selectedOdd of uniqueSelections) {
      let targetMatchId = selectedOdd.matchId;

      try {
        let response = await fetch(`${apiUrl}/api/users/${currentUser.id}/favorites/${targetMatchId}`, {
          method: "POST"
        });

        if (response.ok) {
          addedCount += 1;
          continue;
        }

        if (response.status === 400) {
          const badRequestText = await response.text();
          if (badRequestText.includes("Already in favorites")) {
            skippedCount += 1;
            continue;
          }
        }

        if (response.status === 404) {
          const notFoundText = await response.text();
          if (notFoundText.includes("User not found")) {
            alert("Пользователь не найден. Войдите заново.");
            window.AuthState?.setCurrentUser?.(null);
            if (typeof window.openLoginModal === "function") {
              window.openLoginModal();
            }
            return;
          }
        }

        // If match is not present in local DB, create a local copy and retry adding to favorites.
        const createResponse = await fetch(`${apiUrl}/api/users/${currentUser.id}/matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            league: selectedOdd.league || "Football",
            time: selectedOdd.time || "TBD",
            homeTeam: selectedOdd.homeTeam,
            awayTeam: selectedOdd.awayTeam,
            p1: selectedOdd.odds?.p1 || selectedOdd.value,
            x: selectedOdd.odds?.x || selectedOdd.value,
            p2: selectedOdd.odds?.p2 || selectedOdd.value
          })
        });

        if (!createResponse.ok) {
          const createErrorText = await createResponse.text();
          throw new Error(createErrorText || "Failed to create local match copy");
        }

        const createdMatch = await createResponse.json();
        targetMatchId = Number(createdMatch.id);

        if (!targetMatchId || Number.isNaN(targetMatchId)) {
          throw new Error("Invalid created match id");
        }

        response = await fetch(`${apiUrl}/api/users/${currentUser.id}/favorites/${targetMatchId}`, {
          method: "POST"
        });

        if (response.ok) {
          addedCount += 1;
          continue;
        }

        const retryErrorText = await response.text();
        if (response.status === 400 && retryErrorText.includes("Already in favorites")) {
          skippedCount += 1;
          continue;
        }

        throw new Error(retryErrorText || `Failed to add created match ${targetMatchId} to favorites`);
      } catch (error) {
        console.error("Error adding match to favorites", error);
        alert("Не удалось добавить матч(и) в избранное");
        return;
      }
    }

    if (addedCount > 0 && skippedCount > 0) {
      alert(`Добавлено в избранное: ${addedCount}. Уже были в избранном: ${skippedCount}.`);
      return;
    }

    if (addedCount > 0) {
      alert(`Добавлено в избранное: ${addedCount}`);
      return;
    }

    alert("Все выбранные матчи уже в избранном");
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
        saveSelectedOddsToStorage();
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

    const goToAnalysisBtn = byId("goToAnalysisBtn");
    if (goToAnalysisBtn) goToAnalysisBtn.addEventListener("click", goToAnalysis);

    const addToFavoritesBtn = byId("addToFavoritesBtn");
    if (addToFavoritesBtn) {
      addToFavoritesBtn.addEventListener("click", addSelectedMatchesToFavorites);
    }

    const openAddMatchModalBtn = byId("openAddMatchModalBtn");
    if (openAddMatchModalBtn) {
      openAddMatchModalBtn.addEventListener("click", openAddMatchModal);
    }

    const addMatchForm = byId("addMatchForm");
    if (addMatchForm) {
      addMatchForm.addEventListener("submit", handleAddMatchSubmit);
    }
  }

  async function init() {
    if (!byId("matchesContainer")) return;

    selectedOdds = loadSelectedOddsFromStorage();
    setupEvents();
    calculateProbability();
    renderCoupon();
    await loadMatches();

    updateTimer = setInterval(loadMatches, UPDATE_INTERVAL);

    window.addEventListener("beforeunload", function () {
      if (updateTimer) clearInterval(updateTimer);
    });
  }

  window.calculateProbability = calculateProbability;
  window.applyCalculatedProb = applyCalculatedProb;
  window.closeModal = closeModal;
  window.closeAddMatchModal = closeAddMatchModal;

  document.addEventListener("DOMContentLoaded", init);
})();
