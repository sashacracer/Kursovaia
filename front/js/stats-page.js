(function () {
  const SELECTED_ODDS_STORAGE_KEY = "selectedOddsForStats";

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(text) {
    if (typeof window.setConnectionStatus === "function") {
      window.setConnectionStatus(text);
    }
  }

  function parseScore(score) {
    if (!score || typeof score !== "string") return null;

    const match = score.match(/(\d+)\s*[:\-]\s*(\d+)/);
    if (!match) return null;

    const home = Number(match[1]);
    const away = Number(match[2]);
    if (Number.isNaN(home) || Number.isNaN(away)) return null;

    return { home: home, away: away, total: home + away };
  }

  function loadSelectedOdds() {
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

  function clearSelectedOdds() {
    localStorage.removeItem(SELECTED_ODDS_STORAGE_KEY);
    renderSelectedMatches();
  }

  function renderSelectedMatches() {
    const selected = loadSelectedOdds();
    const container = byId("selectedMatchesStats");
    if (!container) return;

    if (selected.length === 0) {
      container.innerHTML = "<div class=\"tip-item\">Пока нет выбранных матчей. Выбери коэффициенты на странице Линия.</div>";
    } else {
      container.innerHTML = selected
        .map(
          (item) => `
            <div class="coupon-item selected-match-item">
              <div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${item.time} • ${item.league || "Лига"}</div>
                <div style="font-weight: 600; font-size: 0.9rem;">${item.homeTeam} - ${item.awayTeam}</div>
                <div style="color: var(--accent-yellow); font-weight: 700;">${item.type} @ ${Number(item.value).toFixed(2)}</div>
              </div>
              <div class="tag-live">${item.isLive ? "LIVE" : "LINE"}</div>
            </div>
          `
        )
        .join("");
    }

    const selectedCount = byId("selectedCount");
    if (selectedCount) selectedCount.textContent = String(selected.length);

    const selectedAvgOdd = byId("selectedAvgOdd");
    const avgOdd =
      selected.length > 0 ? selected.reduce((acc, item) => acc + Number(item.value || 0), 0) / selected.length : 0;
    if (selectedAvgOdd) selectedAvgOdd.textContent = avgOdd.toFixed(2);

    const selectedLiveCount = byId("selectedLiveCount");
    const liveCount = selected.filter((item) => Boolean(item.isLive)).length;
    if (selectedLiveCount) selectedLiveCount.textContent = String(liveCount);
  }

  function renderKpi(matches) {
    const withScore = matches.filter((m) => parseScore(m.score));
    const liveCount = matches.filter((m) => Boolean(m.isLive)).length;
    const avgP1 =
      matches.length > 0 ? matches.reduce((acc, m) => acc + Number(m.odds.p1 || 0), 0) / matches.length : 0;

    const totalMatchesEl = byId("kpiTotalMatches");
    if (totalMatchesEl) totalMatchesEl.textContent = String(matches.length);

    const liveMatchesEl = byId("kpiLiveMatches");
    if (liveMatchesEl) liveMatchesEl.textContent = String(liveCount);

    const avgP1El = byId("kpiAvgP1");
    if (avgP1El) avgP1El.textContent = avgP1.toFixed(2);

    const withScoreEl = byId("kpiWithScore");
    if (withScoreEl) withScoreEl.textContent = String(withScore.length);
  }

  function renderLeagueStats(matches) {
    const body = byId("leagueStatsBody");
    if (!body) return;

    const grouped = new Map();

    matches.forEach((match) => {
      const league = match.league || "Без лиги";
      if (!grouped.has(league)) {
        grouped.set(league, { totalMatches: 0, scoreMatches: 0, totalGoals: 0, bothScored: 0, over25: 0 });
      }

      const item = grouped.get(league);
      item.totalMatches += 1;

      const parsed = parseScore(match.score);
      if (parsed) {
        item.scoreMatches += 1;
        item.totalGoals += parsed.total;
        if (parsed.home > 0 && parsed.away > 0) item.bothScored += 1;
        if (parsed.total > 2) item.over25 += 1;
      }
    });

    const rows = Array.from(grouped.entries())
      .sort((a, b) => b[1].totalMatches - a[1].totalMatches)
      .slice(0, 8)
      .map(([league, item]) => {
        const goalsPerMatch = item.scoreMatches > 0 ? (item.totalGoals / item.scoreMatches).toFixed(2) : "0.00";
        const bothScored = item.scoreMatches > 0 ? ((item.bothScored / item.scoreMatches) * 100).toFixed(0) : "0";
        const over25 = item.scoreMatches > 0 ? ((item.over25 / item.scoreMatches) * 100).toFixed(0) : "0";

        return `
          <div class="table-row">
            <span>${league}</span><span>${goalsPerMatch}</span><span>${bothScored}%</span><span>${over25}%</span>
          </div>
        `;
      });

    body.innerHTML = rows.length > 0 ? rows.join("") : '<div class="table-row"><span>Нет данных</span><span>0.00</span><span>0%</span><span>0%</span></div>';
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

  async function loadStats() {
    const apiUrl = window.AppConfig?.API_URL;
    if (!apiUrl) return;

    try {
      setStatus("🟡 Загрузка...");
      const response = await fetch(`${apiUrl}/api/matches`);
      if (!response.ok) throw new Error("Failed to load stats");

      const matches = await response.json();
      renderKpi(matches);
      renderLeagueStats(matches);
      setStatus("🟢 Онлайн");
    } catch (error) {
      console.error("Error loading stats", error);
      setStatus("🔴 Оффлайн");
    }
  }

  async function exportExcel() {
    const apiUrl = window.AppConfig?.API_URL;
    if (!apiUrl) {
      alert("Не найден адрес API");
      return;
    }

    // Скачивание запускается напрямую через backend endpoint.
    window.location.href = `${apiUrl}/api/excel`;
  }

  function setupEvents() {
    const calculateBtn = byId("calculateBtn");
    if (calculateBtn) calculateBtn.addEventListener("click", calculateValue);

    const exportExcelBtn = byId("exportExcelBtn");
    if (exportExcelBtn) exportExcelBtn.addEventListener("click", exportExcel);

    const clearSelectedStatsBtn = byId("clearSelectedStatsBtn");
    if (clearSelectedStatsBtn) clearSelectedStatsBtn.addEventListener("click", clearSelectedOdds);
  }

  async function init() {
    if (!byId("selectedMatchesStats")) return;

    setupEvents();
    renderSelectedMatches();
    calculateProbability();
    await loadStats();
  }

  window.calculateProbability = calculateProbability;
  window.applyCalculatedProb = applyCalculatedProb;

  document.addEventListener("DOMContentLoaded", init);
})();
