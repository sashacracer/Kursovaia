(function () {
  const API_URL = "http://localhost:5262";
  const CURRENT_USER_KEY = "currentUser";

  let currentUser = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function getStoredUser() {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error("Invalid currentUser in storage", error);
      localStorage.removeItem(CURRENT_USER_KEY);
      return null;
    }
  }

  function setStoredUser(user) {
    if (!user) {
      localStorage.removeItem(CURRENT_USER_KEY);
      return;
    }

    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  function updateAuthUI() {
    const authButtons = byId("authButtons");
    const userProfile = byId("userProfile");
    const usernameDisplay = byId("usernameDisplay");

    if (authButtons && userProfile) {
      if (currentUser) {
        authButtons.style.display = "none";
        userProfile.style.display = "flex";
      } else {
        authButtons.style.display = "flex";
        userProfile.style.display = "none";
      }
    }

    if (usernameDisplay && currentUser) {
      usernameDisplay.textContent = currentUser.username;
    }
  }

  function openLoginModal() {
    const modal = byId("loginModal");
    if (modal) modal.style.display = "flex";
  }

  function closeLoginModal() {
    const modal = byId("loginModal");
    if (modal) modal.style.display = "none";
  }

  function openRegisterModal() {
    const modal = byId("registerModal");
    if (modal) modal.style.display = "flex";
  }

  function closeRegisterModal() {
    const modal = byId("registerModal");
    if (modal) modal.style.display = "none";
  }

  async function handleLogin(event) {
    event.preventDefault();

    const usernameOrEmail = byId("loginUsername")?.value?.trim();
    const password = byId("loginPassword")?.value;

    if (!usernameOrEmail || !password) {
      alert("Введите логин/email и пароль");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail, password })
      });

      if (!response.ok) {
        alert("Неверное имя пользователя или пароль");
        return;
      }

      const user = await response.json();
      currentUser = user;
      setStoredUser(user);
      updateAuthUI();
      closeLoginModal();
    } catch (error) {
      console.error("Login error", error);
      alert("Ошибка входа. Попробуйте позже.");
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    const username = byId("regUsername")?.value?.trim();
    const email = byId("regEmail")?.value?.trim();
    const password = byId("regPassword")?.value;

    if (!username || !email || !password) {
      alert("Заполните все поля регистрации");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        alert(errorMessage || "Ошибка регистрации");
        return;
      }

      const user = await response.json();
      currentUser = user;
      setStoredUser(user);
      updateAuthUI();
      closeRegisterModal();
    } catch (error) {
      console.error("Register error", error);
      alert("Ошибка регистрации. Попробуйте позже.");
    }
  }

  function logout() {
    currentUser = null;
    setStoredUser(null);
    updateAuthUI();

    if (window.location.pathname.endsWith("profile.html")) {
      window.location.href = "index.html";
    }
  }

  function setConnectionStatus(text) {
    const connection = byId("connectionStatus");
    if (connection) connection.textContent = text;
  }

  function closeModalOnBackdropClick(event) {
    if (event.target?.id === "loginModal") closeLoginModal();
    if (event.target?.id === "registerModal") closeRegisterModal();
    if (event.target?.id === "addMatchModal" && typeof window.closeAddMatchModal === "function") {
      window.closeAddMatchModal();
    }
    if (event.target?.id === "moreModal" && typeof window.closeModal === "function") {
      window.closeModal();
    }
  }

  function init() {
    currentUser = getStoredUser();
    updateAuthUI();
    document.addEventListener("click", closeModalOnBackdropClick);
  }

  window.AppConfig = { API_URL };
  window.AuthState = {
    getCurrentUser: function () {
      return currentUser;
    },
    setCurrentUser: function (user) {
      currentUser = user;
      setStoredUser(user);
      updateAuthUI();
    }
  };

  window.openLoginModal = openLoginModal;
  window.closeLoginModal = closeLoginModal;
  window.openRegisterModal = openRegisterModal;
  window.closeRegisterModal = closeRegisterModal;
  window.handleLogin = handleLogin;
  window.handleRegister = handleRegister;
  window.logout = logout;
  window.setConnectionStatus = setConnectionStatus;

  document.addEventListener("DOMContentLoaded", init);
})();
