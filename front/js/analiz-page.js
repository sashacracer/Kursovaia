(function () {
  const ANALYSIS_SELECTION_STORAGE_KEY = "selectedMatchesForAnalysis";
  const ANALYSIS_HISTORY_STORAGE_KEY = "analysisHistory";
  const CURRENT_USER_STORAGE_KEY = "currentUser";

  let selectedMatches = [];
  let activeMatch = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function loadSelectedMatches() {
    const raw = localStorage.getItem(ANALYSIS_SELECTION_STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to parse selected matches for analysis", error);
      return [];
    }
  }

  function getCurrentUserId() {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      return parsed?.id ?? null;
    } catch (error) {
      console.error("Failed to parse current user from storage", error);
      return null;
    }
  }

  function loadAnalysisHistory() {
    const raw = localStorage.getItem(ANALYSIS_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to parse analysis history", error);
      return [];
    }
  }

  function saveAnalysisEntry(entry) {
    const history = loadAnalysisHistory();
    history.unshift(entry);

    if (history.length > 100) {
      history.length = 100;
    }

    localStorage.setItem(ANALYSIS_HISTORY_STORAGE_KEY, JSON.stringify(history));
  }

  function clearAnalysisMatches() {
    localStorage.removeItem(ANALYSIS_SELECTION_STORAGE_KEY);
    selectedMatches = [];
    activeMatch = null;

    renderMatchList();
    updateSidebar("-");

    const sourceEl = byId("xgSourceText");
    if (sourceEl) sourceEl.textContent = "Источник xG: ожидается запрос к backend.";

    const results = byId("chancesResults");
    if (results) {
      results.style.display = "none";
      results.innerHTML = "";
    }
  }

  function factorial(n) {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i += 1) result *= i;
    return result;
  }

  function poisson(k, lambda) {
    return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
  }

  function buildUnderstatSearchLink(match) {
    const query = encodeURIComponent(`understat ${match.homeTeam} ${match.awayTeam}`);
    return `https://www.google.com/search?q=${query}`;
  }

  function formatOdd(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : "-";
  }

  function renderMatchList() {
    const container = byId("analysisMatchesContainer");
    if (!container) return;

    if (selectedMatches.length === 0) {
      container.innerHTML = '<div class="tip-item">Нет выбранных матчей. Выбери исходы на странице Линия и нажми "В анализ".</div>';
      return;
    }

    container.innerHTML = selectedMatches
      .map((match, index) => {
        const isActive = activeMatch && activeMatch.matchId === match.matchId && activeMatch.type === match.type;

        return `
          <button class="analysis-match-card ${isActive ? "active" : ""}" type="button" data-analysis-index="${index}">
            <div class="analysis-match-time">${match.time} • ${match.league || "Лига"}</div>
            <div class="analysis-match-title">${match.homeTeam} - ${match.awayTeam}</div>
            <div class="analysis-match-time">П1 ${formatOdd(match.odds?.p1)} | X ${formatOdd(match.odds?.x)} | П2 ${formatOdd(match.odds?.p2)}</div>
            <div class="analysis-match-pick">Выбор: ${match.type} @ ${Number(match.value).toFixed(2)}</div>
          </button>
        `;
      })
      .join("");
  }

  function updateSidebar(valueText) {
    const activeMatchTitle = byId("activeMatchTitle");
    if (activeMatchTitle) {
      activeMatchTitle.textContent = activeMatch ? `${activeMatch.homeTeam} - ${activeMatch.awayTeam}` : "Не выбран";
    }

    const activePick = byId("activePick");
    if (activePick) {
      activePick.textContent = activeMatch ? `${activeMatch.type} @ ${Number(activeMatch.value).toFixed(2)}` : "-";
    }

    const activeOdds = byId("activeOdds");
    if (activeOdds) {
      if (activeMatch) {
        activeOdds.textContent = `П1 ${formatOdd(activeMatch.odds?.p1)} | X ${formatOdd(activeMatch.odds?.x)} | П2 ${formatOdd(activeMatch.odds?.p2)}`;
      } else {
        activeOdds.textContent = "П1 - | X - | П2 -";
      }
    }

    const activeValue = byId("activeValue");
    if (activeValue) {
      activeValue.textContent = valueText || "-";
      activeValue.classList.toggle("success", Boolean(valueText && valueText.startsWith("+")));
    }
  }

  async function loadXgForActiveMatch() {
    if (!activeMatch) return;

    const apiUrl = window.AppConfig?.API_URL;
    if (!apiUrl) return;

    const sourceEl = byId("xgSourceText");
    if (sourceEl) sourceEl.textContent = "Источник xG: запрашиваем backend...";

    const params = new URLSearchParams({
      homeTeam: activeMatch.homeTeam,
      awayTeam: activeMatch.awayTeam
    });

    await ensureActiveMatchOdds();

    if (activeMatch.odds?.p1) params.set("p1", String(activeMatch.odds.p1));
    if (activeMatch.odds?.x) params.set("x", String(activeMatch.odds.x));
    if (activeMatch.odds?.p2) params.set("p2", String(activeMatch.odds.p2));

    try {
      const response = await fetch(`${apiUrl}/api/analysis/understat-xg?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load xG");

      const data = await response.json();

      const xgHome = byId("xgHome");
      if (xgHome) xgHome.value = Number(data.homeXg).toFixed(2);

      const xgAway = byId("xgAway");
      if (xgAway) xgAway.value = Number(data.awayXg).toFixed(2);

      if (sourceEl) {
        sourceEl.textContent = `Источник xG: ${data.source}. ${data.note}`;
      }
    } catch (error) {
      console.error("Failed to fetch xG from backend", error);
      if (sourceEl) {
        sourceEl.textContent = "Источник xG: ошибка backend, используй ручной ввод.";
      }
    }
  }

  async function ensureActiveMatchOdds() {
    if (!activeMatch) return;

    const hasOdds =
      Number.isFinite(Number(activeMatch.odds?.p1)) &&
      Number.isFinite(Number(activeMatch.odds?.x)) &&
      Number.isFinite(Number(activeMatch.odds?.p2));

    if (hasOdds) return;

    const apiUrl = window.AppConfig?.API_URL;
    if (!apiUrl) return;

    try {
      const response = await fetch(`${apiUrl}/api/matches`);
      if (!response.ok) return;

      const matches = await response.json();
      const found = matches.find((m) => Number(m.id) === Number(activeMatch.matchId));
      if (!found || !found.odds) return;

      activeMatch.odds = {
        p1: Number(found.odds.p1),
        x: Number(found.odds.x),
        p2: Number(found.odds.p2)
      };

      localStorage.setItem(ANALYSIS_SELECTION_STORAGE_KEY, JSON.stringify(selectedMatches));
      renderMatchList();
      updateSidebar("-");
    } catch (error) {
      console.error("Failed to restore odds for active match", error);
    }
  }

  function setActiveMatch(match) {
    activeMatch = match;
    renderMatchList();
    updateSidebar("-");

    const understatSearchLink = byId("understatSearchLink");
    if (understatSearchLink && activeMatch) {
      understatSearchLink.href = buildUnderstatSearchLink(activeMatch);
    }

    void loadXgForActiveMatch();
  }

  function calculateChances() {
    if (!activeMatch) {
      alert("Сначала выбери матч для анализа");
      return;
    }

    const xgHome = parseFloat(byId("xgHome")?.value || "0");
    const xgAway = parseFloat(byId("xgAway")?.value || "0");

    if (xgHome < 0 || xgAway < 0 || Number.isNaN(xgHome) || Number.isNaN(xgAway)) {
      alert("Введите корректные xG значения");
      return;
    }

    let pHome = 0;
    let pDraw = 0;
    let pAway = 0;

    for (let homeGoals = 0; homeGoals <= 10; homeGoals += 1) {
      for (let awayGoals = 0; awayGoals <= 10; awayGoals += 1) {
        const p = poisson(homeGoals, xgHome) * poisson(awayGoals, xgAway);

        if (homeGoals > awayGoals) pHome += p;
        else if (homeGoals === awayGoals) pDraw += p;
        else pAway += p;
      }
    }

    const pickedProbability = activeMatch.type === "P1" ? pHome : activeMatch.type === "X" ? pDraw : pAway;
    const fairOdd = pickedProbability > 0 ? 1 / pickedProbability : 0;
    const value = pickedProbability * Number(activeMatch.value) - 1;
    const valuePercent = value * 100;

    const results = byId("chancesResults");
    if (results) {
      results.style.display = "block";
      results.innerHTML = `
        <div class="result-item">
          <span>Вероятность П1:</span>
          <span>${(pHome * 100).toFixed(1)}%</span>
        </div>
        <div class="result-item">
          <span>Вероятность X:</span>
          <span>${(pDraw * 100).toFixed(1)}%</span>
        </div>
        <div class="result-item">
          <span>Вероятность П2:</span>
          <span>${(pAway * 100).toFixed(1)}%</span>
        </div>
        <div class="result-item">
          <span>Fair odd для ${activeMatch.type}:</span>
          <span>${fairOdd.toFixed(2)}</span>
        </div>
        <div class="result-item">
          <span>Value (${activeMatch.type} @ ${Number(activeMatch.value).toFixed(2)}):</span>
          <span class="value-highlight ${value >= 0 ? "positive" : "negative"}">${value >= 0 ? "+" : ""}${valuePercent.toFixed(2)}%</span>
        </div>
      `;
    }

    updateSidebar(`${value >= 0 ? "+" : ""}${valuePercent.toFixed(2)}%`);

    saveAnalysisEntry({
      userId: getCurrentUserId(),
      analyzedAt: new Date().toISOString(),
      matchId: activeMatch.matchId,
      homeTeam: activeMatch.homeTeam,
      awayTeam: activeMatch.awayTeam,
      league: activeMatch.league || "",
      time: activeMatch.time || "",
      pickType: activeMatch.type,
      pickOdd: Number(activeMatch.value),
      odds: {
        p1: Number(activeMatch.odds?.p1),
        x: Number(activeMatch.odds?.x),
        p2: Number(activeMatch.odds?.p2)
      },
      xgHome,
      xgAway,
      probabilities: {
        p1: pHome,
        x: pDraw,
        p2: pAway
      },
      fairOdd,
      valuePercent
    });
  }

  function onMatchSelect(event) {
    const card = event.target.closest("[data-analysis-index]");
    if (!card) return;

    const index = Number(card.dataset.analysisIndex);
    if (Number.isNaN(index) || !selectedMatches[index]) return;

    setActiveMatch(selectedMatches[index]);
  }

  function setupEvents() {
    const container = byId("analysisMatchesContainer");
    if (container) container.addEventListener("click", onMatchSelect);

    const calculateBtn = byId("calculateChancesBtn");
    if (calculateBtn) calculateBtn.addEventListener("click", calculateChances);

    const clearAnalysisMatchesBtn = byId("clearAnalysisMatchesBtn");
    if (clearAnalysisMatchesBtn) clearAnalysisMatchesBtn.addEventListener("click", clearAnalysisMatches);
  }

  function init() {
    selectedMatches = loadSelectedMatches();
    activeMatch = selectedMatches.length > 0 ? selectedMatches[0] : null;

    renderMatchList();
    setupEvents();
    updateSidebar("-");

    if (activeMatch) {
      const understatSearchLink = byId("understatSearchLink");
      if (understatSearchLink) {
        understatSearchLink.href = buildUnderstatSearchLink(activeMatch);
      }

      void loadXgForActiveMatch();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
