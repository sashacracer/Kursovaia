const API_URL = 'http://localhost:5261';
const UPDATE_INTERVAL = 5000;

let matches = [];
let selectedOdds = [];
let updateTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    await loadMatches();
    startAutoUpdate();
    setupEventListeners();
}

async function loadMatches() {
    try {
        updateConnectionStatus('🟡 Загрузка...');

        const response = await fetch(`${API_URL}/api/matches`);
        if (!response.ok) throw new Error('Failed to load');

        const newMatches = await response.json();
        matches = newMatches;
        renderMatches();
        updateLastUpdateTime();
        updateConnectionStatus('🟢 Онлайн');

    } catch (error) {
        console.error('Error:', error);
        updateConnectionStatus('🔴 Оффлайн');
    }
}

function renderMatches() {
    const container = document.getElementById('matchesContainer');
    if (!container) return;

    container.innerHTML = matches.map(match => {
        const isSelected = (type) => selectedOdds.some(o =>
            o.matchId === match.id && o.type === type
        );

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
                    <div class="odd-box ${isSelected('P1') ? 'selected' : ''}" 
                         data-match-id="${match.id}" data-type="P1" data-value="${match.odds.p1.toFixed(2)}">
                        <div class="odd-label">П1</div>
                        <div class="odd-value">${match.odds.p1.toFixed(2)}</div>
                    </div>
                    <div class="odd-box ${isSelected('X') ? 'selected' : ''}" 
                         data-match-id="${match.id}" data-type="X" data-value="${match.odds.x.toFixed(2)}">
                        <div class="odd-label">X</div>
                        <div class="odd-value">${match.odds.x.toFixed(2)}</div>
                    </div>
                    <div class="odd-box ${isSelected('P2') ? 'selected' : ''}" 
                         data-match-id="${match.id}" data-type="P2" data-value="${match.odds.p2.toFixed(2)}">
                        <div class="odd-label">П2</div>
                        <div class="odd-value">${match.odds.p2.toFixed(2)}</div>
                    </div>
                    <div class="odd-box more">
                        <div class="odd-label">Ещё</div>
                        <div class="odd-value">+${Math.floor(Math.random() * 1000 + 2000)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    attachOddClickHandlers();
}

function startAutoUpdate() {
    updateTimer = setInterval(loadMatches, UPDATE_INTERVAL);
}

function setupEventListeners() {
    const calcBtn = document.getElementById('calculateBtn');
    if (calcBtn) calcBtn.addEventListener('click', calculateValue);

    const clearBtn = document.getElementById('clearCoupon');
    if (clearBtn) clearBtn.addEventListener('click', clearCoupon);
}

function attachOddClickHandlers() {
    document.querySelectorAll('.odd-box:not(.more)').forEach(box => {
        box.addEventListener('click', () => {
            const matchId = box.dataset.matchId;
            const type = box.dataset.type;
            const value = parseFloat(box.dataset.value);
            const match = matches.find(m => m.id === matchId);

            if (!match) return;

            const existingIndex = selectedOdds.findIndex(o =>
                o.matchId === matchId && o.type === type
            );

            if (existingIndex > -1) {
                selectedOdds.splice(existingIndex, 1);
                box.classList.remove('selected');
            } else {
                selectedOdds.push({
                    matchId, type, value,
                    homeTeam: match.homeTeam.name,
                    awayTeam: match.awayTeam.name,
                    time: match.time
                });
                box.classList.add('selected');
            }

            renderCoupon();
        });
    });
}

function renderCoupon() {
    const emptyEl = document.getElementById('couponEmpty');
    const itemsEl = document.getElementById('couponItems');
    const actionsEl = document.getElementById('couponActions');

    if (!emptyEl || !itemsEl || !actionsEl) return;

    if (selectedOdds.length === 0) {
        emptyEl.style.display = 'block';
        itemsEl.innerHTML = '';
        actionsEl.style.display = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    actionsEl.style.display = 'flex';

    itemsEl.innerHTML = selectedOdds.map((odd, index) => `
        <div class="coupon-item">
            <div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${odd.time}</div>
                <div style="font-weight: 600;">${odd.homeTeam} - ${odd.awayTeam}</div>
                <div style="color: var(--accent-yellow);">${odd.type} @ ${odd.value.toFixed(2)}</div>
            </div>
            <button onclick="removeFromCoupon(${index})" class="btn-remove">×</button>
        </div>
    `).join('');
}

window.removeFromCoupon = (index) => {
    const odd = selectedOdds[index];
    selectedOdds.splice(index, 1);

    document.querySelectorAll(`.odd-box[data-match-id="${odd.matchId}"][data-type="${odd.type}"]`)
        .forEach(box => box.classList.remove('selected'));

    renderCoupon();
};

function clearCoupon() {
    selectedOdds = [];
    document.querySelectorAll('.odd-box.selected').forEach(box => {
        box.classList.remove('selected');
    });
    renderCoupon();
}

async function calculateValue() {
    const oddInput = document.getElementById('bookmakerOdd');
    const probInput = document.getElementById('yourProbability');

    const odd = parseFloat(oddInput?.value);
    const prob = parseFloat(probInput?.value);

    if (!odd || !prob || prob <= 0 || prob > 100) {
        alert('Введите корректные данные');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookmakerOdd: odd, yourProbability: prob })
        });

        const result = await response.json();
        displayCalcResult(result);

    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка расчета');
    }
}

function displayCalcResult(result) {
    const container = document.getElementById('calcResults');
    if (!container) return;

    container.style.display = 'block';

    const valueClass = result.value > 0 ? 'positive' : result.value < 0 ? 'negative' : '';
    const recColor = result.isValue ? 'var(--accent-green)' : result.value > -0.05 ? 'var(--text-secondary)' : 'var(--accent-red)';

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
            <span class="value-highlight ${valueClass}">${result.value > 0 ? '+' : ''}${result.value}</span>
        </div>
        <div class="result-item">
            <span>Рекомендация:</span>
            <span style="color: ${recColor}; font-weight: 600;">${result.recommendation}</span>
        </div>
    `;
}

function updateConnectionStatus(status) {
    const el = document.getElementById('connectionStatus');
    if (el) el.textContent = status;
}

function updateLastUpdateTime() {
    const el = document.getElementById('lastUpdate');
    if (el) el.textContent = `Обновлено: ${new Date().toLocaleTimeString()}`;
}