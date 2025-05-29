const companyName = document
  .getElementById("company-data")
  .getAttribute("data-company");

const companyID = document
  .getElementById("companyID-data")
  .getAttribute("data-companyID");

const userRole = document.getElementById("role-data").getAttribute("data-role");

const userName = document
  .getElementById("username-data")
  .getAttribute("data-username");

const userID = document
  .getElementById("userID-data")
  .getAttribute("data-userID");

const socket = io(CONFIG.SOCKET_SERVER_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.on("connect", () => {
  console.log("Connected to socket server");

  let companyNames = null;

  if (companyName != "None") {
    companyNames = companyName;
  }

  socket.emit("authenticate", {
    user_id: userID,
    company: companyNames,
  });
});

socket.on("authentication_success", (data) => {
  console.log("Authentication successful");
  socket.emit("get_rooms");
});

socket.on("authentication_error", (data) => {
  console.error("Authentication failed:", data.message);
});

socket.on("connect_error", (error) => {
  console.error("WebSocket connection error:", error);
});

socket.on("disconnect", () => {
  console.warn("WebSocket disconnected");
});

socket.on("vehicle_update", async function (data) {
  try {
    if(data.sos === "0") {
      displayFlashMessage(`SOS Alert for ${data.LicensePlateNumber}`);
      data = null;
    }
  } catch (error) {
    console.error("Error in vehicle_update handler:", error);
  }
});

async function refreshToken() {
  try {
    const response = await fetch("/refresh", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        "X-CSRF-REFRESH-TOKEN": getCookie("csrf_refresh_token"),
      },
    });

    if (response.status === 200) {
      console.log("Token refreshed successfully");
      console.log("Response:", response);
    } else if (response.status === 304) {
      console.log("No changes yet");
    } else {
      console.error("Failed to refresh token");
    }
  } catch (error) {
    console.error("Error refreshing token:", error);
  }
}

setInterval(refreshToken, 2 * 60 * 60 * 1000);

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

function setCookie(name, value) {
  if (name === "darkMode") {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 10);
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
  } else document.cookie = `${name}=${value};path=/`;
}

document.addEventListener("DOMContentLoaded", function () {
  const themeToggle = document.getElementById("theme-toggle");
  const body = document.body;
  // Notification Bell Logic
  const bell = document.getElementById("notification-bell");
  const dropdown = document.getElementById("notification-dropdown");
  const countSpan = document.getElementById("notification-count");
  const list = document.getElementById("notification-list");

  const darkModePreference = getCookie("darkMode");
  if (darkModePreference === "true") {
    body.classList.add("dark-mode");
    themeToggle.classList.add("dark");
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  } else {
    body.classList.remove("dark-mode");
    themeToggle.classList.remove("dark");
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }

  themeToggle.addEventListener("click", function () {
    const isDarkMode = body.classList.toggle("dark-mode");
    themeToggle.classList.toggle("dark");

    setCookie("darkMode", isDarkMode);

    if (isDarkMode) {
      themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
      themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
  });

  const profile = document.getElementById("profile");
  const profileHover = document.getElementById("profile-hover");

  profile.addEventListener("click", (event) => {
    event.stopPropagation(); 
    const isVisible = window.getComputedStyle(profileHover).display === "block";
    profileHover.style.display = isVisible ? "none" : "block";
  });

  document.addEventListener("click", () => {
    profileHover.style.display = "none";
  });

  async function loadNotifications() {
    try {
      const res = await fetch("/alerts/notification_alerts", {
        headers: {
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        },
      });
      const data = await res.json();
      if (data.success) {
        // Only show Panic Alert and Main Power Discontinue Alert
        const filteredAlerts = data.alerts.filter(
          (alert) =>
            alert.type === "Panic Alert" ||
            alert.type === "Main Power Discontinue Alert"
        );
        countSpan.textContent = filteredAlerts.length; // <-- Fix here
        list.innerHTML = "";
        if (filteredAlerts.length === 0) {
          list.innerHTML = "<li>No new alerts</li>";
        } else {
          filteredAlerts.forEach((alert) => {
            const li = document.createElement("li");
            li.innerHTML = `<strong>${alert.type}</strong> - ${alert.vehicle} <br><small>${new Date(
              alert.date_time
            ).toLocaleString()}</small>`;
            li.dataset.alertId = alert.id;
            li.dataset.alertType = alert.type;
            li.addEventListener("click", function () {
              window.location.href = `/alerts/?alert_id=${alert.id}&alert_type=${encodeURIComponent(
                alert.type
              )}`;
            });
            list.appendChild(li);
          });
        }
      }
    } catch (e) {
      countSpan.textContent = "!";
      list.innerHTML = "<li>Error loading alerts</li>";
    }
  }

  bell.addEventListener("click", function (e) {
    e.stopPropagation();
    dropdown.style.display =
      dropdown.style.display === "block" ? "none" : "block";
    if (dropdown.style.display === "block") {
      loadNotifications();
    }
  });

  document.addEventListener("click", function () {
    dropdown.style.display = "none";
  });

  setInterval(loadNotifications, 60000);
  loadNotifications();
});

function displayFlashMessage(message, category = "danger") {
  const flashMessagesContainer = document.getElementById(
    "flash-messages-container"
  );
  if (flashMessagesContainer) {
    const flashMessage = document.createElement("div");
    flashMessage.className = `flash-message flash-${category}`;
    flashMessage.innerHTML = `
      <span>${message}</span>
      <button class="close-btn" onclick="this.parentElement.remove()">×</button>
    `;
    flashMessagesContainer.appendChild(flashMessage);

    setTimeout(() => flashMessage.remove(), 5000);
  } else {
    console.error("Flash messages container not found");
  }
}
