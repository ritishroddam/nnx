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

console.log("User Name:", userName);

const userID = document
  .getElementById("userID-data")
  .getAttribute("data-userID");

const darkModeData = document
  .getElementById("dark-mode-data")
  .getAttribute("data-dark-mode");

const alertSound = document
  .getElementById("alert-sound-data")
  .getAttribute("data-alert-sound");

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
    userRole: userRole,
    userName: userName,
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

let oldDataMain = {};

socket.on("vehicle_update", async function (data) {
  try {
    imei = data.imei;
    const isNewSOS = 
      (data.sos === "1" || data.sos === 1) &&
      (oldDataMain[imei] === "0" || oldDataMain[imei] === 0 || oldDataMain[imei] === undefined);
    if(isNewSOS) {
      displayFlashMessage(`SOS Alert for ${data.LicensePlateNumber}`, "danger", "sos");
    }
    oldDataMain[imei] = data.sos;
    data = null;
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

document.addEventListener("DOMContentLoaded", async function () {
  const themeToggle = document.getElementById("theme-toggle");
  const body = document.body;
  const bell = document.getElementById("notification-bell");
  const dropdown = document.getElementById("notification-dropdown");
  const countSpan = document.getElementById("notification-count");
  const list = document.getElementById("notification-list");

  const darkModePreference = getCookie("darkMode");
  if (darkModePreference === "true") {
    body.classList.add("dark-mode");
    themeToggle.classList.add("dark");
    themeToggle.innerHTML = '<i class="material-symbols-outlined">dark_mode</i>';
  } else {
    body.classList.remove("dark-mode");
    themeToggle.classList.remove("dark");
    themeToggle.innerHTML = '<i class="material-symbols-outlined">light_mode</i>';
    isDarkModeMap = false;
  }

  themeToggle.addEventListener("click", async function () {
    const isDarkMode = body.classList.toggle("dark-mode");
    themeToggle.classList.toggle("dark");

    setCookie("darkMode", isDarkMode);

    if (isDarkMode) {
      themeToggle.innerHTML = '<i class="material-symbols-outlined">dark_mode</i>';
    } else {
      themeToggle.innerHTML = '<i class="material-symbols-outlined">light_mode</i>';
    }

    await backgroundMap();

    fetch("/userConfig/editDarkMode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({ darkMode: isDarkMode ? "true" : "false"}),
    })
    .then((response) => {
      if (response.status === 200) {
        displayFlashMessage("Theme updated successfully!", "success");
      } else {
        displayFlashMessage("Failed to update theme", "danger");
      }
      return response.json(); 
    })
    .catch(() => {
      displayFlashMessage("Failed to update theme", "danger");
    });
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
      countSpan.textContent = data.alerts.filter(a => !a.acknowledged).length;
      list.innerHTML = "";
      if (data.alerts.length === 0) {
        list.innerHTML = "<li>No new alerts</li>";
      } else {
        data.alerts.forEach((alert) => {
          const li = document.createElement("li");
          li.className = alert.acknowledged ? "notification-read" : "notification-unread";
          const showMarkRead = !alert.acknowledged && (
            alert.type === "Panic Alert" || alert.type === "Main Power Discontinue Alert"
          );

          li.innerHTML = `
            <div class="notification-content">
              <strong>${alert.type}</strong> - ${alert.vehicle} 
              <br><small>${new Date(alert.date_time).toLocaleString()}</small>
              ${alert.acknowledged ? '' : '<span class="unread-badge"></span>'}
            </div>
            ${showMarkRead ? `
            <div class="notification-actions">
              <button class="mark-read-btn" data-alert-id="${alert.id}">
                <i class="fas fa-check"></i>
              </button>
            </div>` : ''}
          `;
          
          li.addEventListener("click", function(e) {
            if (!e.target.closest('.mark-read-btn')) {
              let endpoint = alert.type
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/_alert$/, "");

              if (endpoint.includes("main_power_discontinue") || endpoint.includes("main_power")) {
                endpoint = "main_power_off";
              }

              try {
                const alertDate = alert.date_time ? new Date(alert.date_time) : null;
                if (alertDate && !isNaN(alertDate.getTime())) {
                  const start = new Date(alertDate);
                  start.setMinutes(start.getMinutes() - 1);
                  const end = new Date(alertDate);
                  end.setMinutes(end.getMinutes() + 1);

                  const formatForInput = (d) => {
                    const offset = d.getTimezoneOffset() * 60000;
                    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
                  };

                  const startStr = encodeURIComponent(formatForInput(start));
                  const endStr = encodeURIComponent(formatForInput(end));

                  window.location.href = `/alerts/?alert_id=${encodeURIComponent(alert.id)}&alert_type=${encodeURIComponent(endpoint)}&from_notification=true&startDate=${startStr}&endDate=${endStr}`;
                  return;
                }
              } catch (err) {
                console.warn('Failed to parse alert date for redirect', err);
              }

              window.location.href = `/alerts/?alert_id=${encodeURIComponent(alert.id)}&alert_type=${encodeURIComponent(endpoint)}&from_notification=true`;
            }
          });

          const markReadBtn = li.querySelector('.mark-read-btn');
          if (markReadBtn) {
            markReadBtn.addEventListener("click", async function(e) {
              e.stopPropagation();
              await acknowledgeNotificationAlert(alert.id);
              li.classList.remove("notification-unread");
              li.classList.add("notification-read");
              li.querySelector('.unread-badge')?.remove();
              markReadBtn.remove();
              countSpan.textContent = parseInt(countSpan.textContent) - 1;
            });
          }
          
          list.appendChild(li);
        });
      }
    }
  } catch (e) {
    countSpan.textContent = "!";
    list.innerHTML = "<li>Error loading alerts</li>";
  }
}

async function acknowledgeNotificationAlert(alertId) {
  try {
    const response = await fetch("/alerts/acknowledge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({
        alertId: alertId,
        pressedFor: "manually_marked",
        reason: "Marked as read in notifications"
      }),
    });
    
    return await response.json();
  } catch (error) {
    console.error("Error acknowledging notification:", error);
    return { success: false };
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

function displayFlashMessage(message, category = "danger", dismissAfter = 5000) {
  const flashMessagesContainer = document.getElementById("flash-messages-container");
  if (!flashMessagesContainer) {
    console.error("Flash messages container not found");
    return;
  }

  flashMessagesContainer.setAttribute("aria-live", "polite");

  const flashMessage = document.createElement("div");
  flashMessage.className = `flash-message flash-${category}`;
  flashMessage.innerHTML = `
    <span>${message}</span>
    <button class="close-btn" type="button">×</button>
  `;
  flashMessagesContainer.appendChild(flashMessage);

  let audio;
  let stopAudio = () => {};
  if (dismissAfter === "sos") {
    audio = new Audio("/static/sounds/sosNotification.wav");
    audio.loop = true;
    audio.play().catch((e) => console.warn("Audio play failed:", e));
    stopAudio = () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }

  const removeFlash = () => {
    flashMessage.remove();
    stopAudio();
  };

  flashMessage.querySelector(".close-btn").onclick = removeFlash;

  if (dismissAfter !== "sos") {
    setTimeout(removeFlash, dismissAfter);
  }
}

async function backgroundMap() {
  const [{ Map }] = await Promise.all([
    google.maps.importLibrary("maps"),
    google.maps.importLibrary("core"),
  ]);

  const isDarkModeMap = document.body.classList.contains("dark-mode");

  const mapId = isDarkModeMap ? "f32dd48f00948a5685a13355" : "f32dd48f00948a56d8551c2d";

  const cameraOptions = {
    tilt: 0,
    heading: 0,
    zoom: 10,
    center: { lat: 15.350238, lng:  75.137595 },
  };

  const mapOptions = {
    ...cameraOptions,
    mapId: mapId,
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: "none",
    draggable: false,
    keyboardShortcuts: false,
    scrollwheel: false,
    disableDoubleClickZoom: true,
  };

  const bgMap = new Map(document.getElementById("displayMap"), mapOptions);
}

(function () {
  const toggle = document.getElementById("mobile-menu-toggle");
  const backdrop = document.getElementById("mobile-backdrop");

  if (!toggle) return;

  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    document.body.classList.toggle("sidebar-open");
  });

  if (backdrop) {
    backdrop.addEventListener("click", function () {
      document.body.classList.remove("sidebar-open");
    });
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".sidebar") && !e.target.closest("#mobile-menu-toggle")) {
      document.body.classList.remove("sidebar-open");
    }
  });

  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    sidebar.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }
})();

window.onload = async function () {
  await backgroundMap();
};