(function () {
  const UPDATE_INTERVAL = 5000;

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
    const el = byId("liveLastUpdate");
    if (el) el.textContent = `Обновлено: ${new Date().toLocaleTimeString()}`;
  }

  function formatScore(match) {
    if (match.score && match.score.trim()) return match.score;
    return "нет счета";
  }

  function createLiveCard(match) {
    const liveLabel = match.isLive ? "LIVE" : "SOON";

    return `
      <article class="info-card">
        <div class="tag-live">${liveLabel} ${match.time}</div>
        <h3>${match.homeTeam.name} - ${match.awayTeam.name}</h3>
        <p class="muted">${match.league} • Счет: ${formatScore(match)}</p>
        <div class="quick-odds">
          <span>П1 ${match.odds.p1.toFixed(2)}</span>
          <span>X ${match.odds.x.toFixed(2)}</span>
          <span>П2 ${match.odds.p2.toFixed(2)}</span>
        </div>
      </article>
    `;
  }

  function renderLive(matches) {
    const container = byId("liveMatchesContainer");
    if (!container) return;

    if (matches.length === 0) {
      container.innerHTML = `
        <article class="info-card">
          <h3>Сейчас нет live-матчей</h3>
          <p class="muted">Данные получаем из API (сайт или БД). Проверь снова через минуту.</p>
        </article>
      `;
      return;
    }

    container.innerHTML = matches.map(createLiveCard).join("");
  }

  function updateSidebarStats(matches) {
    const liveCount = matches.length;
    const withScore = matches.filter((m) => m.score && m.score.trim()).length;
    const avgP1 =
      liveCount > 0 ? matches.reduce((acc, m) => acc + Number(m.odds.p1 || 0), 0) / liveCount : 0;

    const liveOnAirCount = byId("liveOnAirCount");
    if (liveOnAirCount) liveOnAirCount.textContent = String(liveCount);

    const liveAvgP1 = byId("liveAvgP1");
    if (liveAvgP1) liveAvgP1.textContent = avgP1.toFixed(2);

    const liveWithScore = byId("liveWithScore");
    if (liveWithScore) liveWithScore.textContent = String(withScore);
  }

  async function loadLiveMatches() {
    const apiUrl = window.AppConfig?.API_URL;
    if (!apiUrl) return;

    try {
      setStatus("🟡 Загрузка...");
      const response = await fetch(`${apiUrl}/api/matches`);
      if (!response.ok) throw new Error("Failed to load matches");

      const allMatches = await response.json();
      const liveMatches = allMatches.filter((m) => Boolean(m.isLive));
      const fallbackMatches = liveMatches.length > 0 ? liveMatches : allMatches.slice(0, 8);

      renderLive(fallbackMatches);
      updateSidebarStats(fallbackMatches);
      updateLastUpdateTime();
      setStatus("🟢 Онлайн");
    } catch (error) {
      console.error("Error loading live matches", error);
      setStatus("🔴 Оффлайн");
    }
  }

  async function init() {
    if (!byId("liveMatchesContainer")) return;

    await loadLiveMatches();
    updateTimer = setInterval(loadLiveMatches, UPDATE_INTERVAL);

    window.addEventListener("beforeunload", function () {
      if (updateTimer) clearInterval(updateTimer);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
