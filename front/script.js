const API_URL = 'http://localhost:5261';
const UPDATE_INTERVAL = 5000;

let matches = [];
let selectedOdds = [];
let updateTimer = null;

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateAuthUI();
    }
    initializeApp();
});

function openLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

function openRegisterModal() {
    document.getElementById('registerModal').style.display = 'flex';
}

function closeRegisterModal() {
    document.getElementById('registerModal').style.display = 'none';
}

async function handleLogin(event) {
    event.preventDefault();
    
    const usernameOrEmail = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernameOrEmail, password })
        });
        
        if (!response.ok) {
            alert('Неверное имя пользователя или пароль');
            return;
        }
        
        const user = await response.json();
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        updateAuthUI();
        closeLoginModal();
        alert(`Добро пожаловать, ${user.username}!`);
        
    } catch (error) {
        console.error('Login error:', error);
        alert('Ошибка входа. Попробуйте позже.');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        if (!response.ok) {
            const error = await response.text();
            alert(error || 'Пользователь с таким именем или email уже существует');
            return;
        }
        
        const user = await response.json();
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        updateAuthUI();
        closeRegisterModal();
        alert(`Регистрация успешна! Добро пожаловать, ${user.username}!`);
        
    } catch (error) {
        console.error('Register error:', error);
        alert('Ошибка регистрации. Попробуйте позже.');
    }
}

function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const userProfile = document.getElementById('userProfile');
    const usernameDisplay = document.getElementById('usernameDisplay');
    
    if (currentUser) {
        authButtons.style.display = 'none';
        userProfile.style.display = 'flex';
        usernameDisplay.textContent = currentUser.username;
    } else {
        authButtons.style.display = 'flex';
        userProfile.style.display = 'none';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateAuthUI();
    alert('Вы вышли из аккаунта');
}

window.onclick = function(event) {
    const moreModal = document.getElementById('moreModal');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (event.target === moreModal) {
        closeModal();
    }
    if (event.target === loginModal) {
        closeLoginModal();
    }
    if (event.target === registerModal) {
        closeRegisterModal();
    }
    const analysisModal = document.getElementById('analysisModal');
    if (event.target === analysisModal) {
        closeAnalysisModal();
    }
}


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
            o.matchId == match.id && o.type === type
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
                         data-match-id="${match.id}" 
                         data-type="P1" 
                         data-value="${match.odds.p1.toFixed(2)}">
                        <div class="odd-label">П1</div>
                        <div class="odd-value">${match.odds.p1.toFixed(2)}</div>
                    </div>
                    <div class="odd-box ${isSelected('X') ? 'selected' : ''}" 
                         data-match-id="${match.id}" 
                         data-type="X" 
                         data-value="${match.odds.x.toFixed(2)}">
                        <div class="odd-label">X</div>
                        <div class="odd-value">${match.odds.x.toFixed(2)}</div>
                    </div>
                    <div class="odd-box ${isSelected('P2') ? 'selected' : ''}" 
                         data-match-id="${match.id}" 
                         data-type="P2" 
                         data-value="${match.odds.p2.toFixed(2)}">
                        <div class="odd-label">П2</div>
                        <div class="odd-value">${match.odds.p2.toFixed(2)}</div>
                    </div>
                    <div class="odd-box more" onclick="openMoreModal('${match.homeTeam.name}', '${match.awayTeam.name}', ${match.odds.p1}, ${match.odds.x}, ${match.odds.p2})">
                        <div class="odd-label">Ещё</div>
                        <div class="odd-value">+${6}</div>
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
            const match = matches.find(m => m.id == matchId);
            
            if (!match) {
                console.error('Match not found:', matchId);
                return;
            }
            
            const existingIndex = selectedOdds.findIndex(o => 
                o.matchId == matchId && o.type === type
            );
            
            if (existingIndex > -1) {
                selectedOdds.splice(existingIndex, 1);
                box.classList.remove('selected');
            } else {
                selectedOdds.push({
                    matchId,
                    type,
                    value,
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
                <div style="font-weight: 600; font-size: 0.9rem;">${odd.homeTeam} - ${odd.awayTeam}</div>
                <div style="color: var(--accent-yellow); font-weight: 700;">${odd.type} @ ${odd.value.toFixed(2)}</div>
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

function openMoreModal(homeTeam, awayTeam, p1, x, p2) {
    document.getElementById('modalTitle').textContent = `${homeTeam} vs ${awayTeam}`;
    
    document.getElementById('totalOver').textContent = (1.5 + Math.random() * 0.8).toFixed(2);
    document.getElementById('totalUnder').textContent = (1.6 + Math.random() * 0.9).toFixed(2);
    document.getElementById('bothYes').textContent = (1.4 + Math.random() * 0.6).toFixed(2);
    document.getElementById('bothNo').textContent = (1.8 + Math.random() * 0.7).toFixed(2);
    document.getElementById('fora1').textContent = (p1 * 1.2).toFixed(2);
    document.getElementById('fora2').textContent = (p2 * 0.9).toFixed(2);
    
    document.getElementById('moreModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('moreModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('moreModal');
    if (event.target === modal) {
        closeModal();
    }
    
    const analysisModal = document.getElementById('analysisModal');
    if (event.target === analysisModal) {
        closeAnalysisModal();
    }
}

window.analyzeSelected = function() {
    if (selectedOdds.length === 0) return;
    
    let analysisHTML = '';
    let totalValue = 0;
    
    selectedOdds.forEach((odd) => {
        const impliedProb = (1 / odd.value) * 100;
        const estimatedRealProb = impliedProb + (Math.random() * 10 - 5);
        const value = (estimatedRealProb * odd.value) / 100 - 1;
        totalValue += value;
        
        const status = value > 0.05 ? '✅ Value найден' : value > -0.05 ? '⚠️ Нейтрально' : '❌ Нет value';
        const statusColor = value > 0.05 ? 'var(--accent-green)' : value > -0.05 ? 'var(--text-secondary)' : 'var(--accent-red)';
        
        analysisHTML += `
            <div style="background: var(--bg-odd); padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                <div style="font-weight: 600; margin-bottom: 8px;">${odd.homeTeam} - ${odd.awayTeam}</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Выбор: ${odd.type} @ ${odd.value.toFixed(2)}</span>
                    <span style="color: ${statusColor};">${status}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                    Маржа букмекера: ${impliedProb.toFixed(1)}% | 
                    Реальная вероятность: ${estimatedRealProb.toFixed(1)}% |
                    Value: ${value > 0 ? '+' : ''}${value.toFixed(3)}
                </div>
            </div>
        `;
    });
    
    const avgValue = totalValue / selectedOdds.length;
    const finalRec = avgValue > 0.05 
        ? { text: 'РЕКОМЕНДУЕТСЯ делать ставки', color: 'var(--accent-green)' }
        : avgValue > -0.05 
            ? { text: 'НЕЙТРАЛЬНО - можно пропустить', color: 'var(--text-secondary)' }
            : { text: 'НЕ РЕКОМЕНДУЕТСЯ делать ставки', color: 'var(--accent-red)' };
    
    analysisHTML += `
        <div style="border-top: 1px solid var(--border-color); padding-top: 16px; margin-top: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.1rem; font-weight: 600;">Итоговая оценка:</span>
                <span style="font-size: 1.2rem; font-weight: 700; color: ${finalRec.color};">
                    ${finalRec.text}
                </span>
            </div>
            <div style="color: var(--text-muted); margin-top: 8px; font-size: 0.9rem;">
                Средний Value: ${avgValue > 0 ? '+' : ''}${avgValue.toFixed(3)} | 
                Матчей в анализе: ${selectedOdds.length}
            </div>
        </div>
    `;
    
    document.getElementById('analysisContent').innerHTML = analysisHTML;
    document.getElementById('analysisModal').style.display = 'flex';
    // Расчет вероятности на основе факторов
function calculateProbability() {
    // Форма команд (вес 40%)
    const homeWins = parseInt(document.getElementById('homeWins')?.value || 0);
    const awayWins = parseInt(document.getElementById('awayWins')?.value || 0);
    const totalGames = homeWins + awayWins || 1;
    const formProb = (homeWins / totalGames) * 40;
    
    // H2H (вес 30%)
    const h2hHome = parseInt(document.getElementById('h2hHome')?.value || 0);
    const h2hDraw = parseInt(document.getElementById('h2hDraw')?.value || 0);
    const h2hAway = parseInt(document.getElementById('h2hAway')?.value || 0);
    const totalH2h = h2hHome + h2hDraw + h2hAway || 1;
    const h2hProb = (h2hHome / totalH2h) * 30;
    
    // Базовая вероятность
    let baseProb = formProb + h2hProb + 15; // 15% базовая ничья
    
    // Корректировки
    if (document.getElementById('homeAdvantage')?.checked) baseProb += 5;
    if (document.getElementById('keyInjuries')?.checked) baseProb -= 10;
    if (document.getElementById('highMotivation')?.checked) baseProb += 5;
    if (document.getElementById('fatigue')?.checked) baseProb -= 5;
    
    // Ограничиваем 10-90%
    baseProb = Math.max(10, Math.min(90, baseProb));
    
    const probEl = document.getElementById('calculatedProb');
    if (probEl) {
        probEl.textContent = baseProb.toFixed(1) + '%';
    }
    
    return baseProb;
}

// Применить расчетную вероятность в калькулятор
function applyCalculatedProb() {
    const prob = calculateProbability();
    const input = document.getElementById('yourProbability');
    if (input) {
        input.value = prob.toFixed(1);
        // Автоматически прокручиваем к калькулятору
        document.querySelector('.calculator-section').scrollIntoView({ behavior: 'smooth' });
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    calculateProbability();
});
}

function closeAnalysisModal() {
    document.getElementById('analysisModal').style.display = 'none';
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

