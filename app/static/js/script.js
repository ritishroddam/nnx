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

async function refreshToken() {
  try {
    const response = await fetch("/refresh", {
      method: "POST",
      credentials: "include", // Include cookies in the request
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

// Refresh the token every 4 minutes (adjust based on your token expiration time)
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
    event.stopPropagation(); // Prevent click from propagating to the document
    const isVisible = window.getComputedStyle(profileHover).display === "block";
    profileHover.style.display = isVisible ? "none" : "block";
  });

  document.addEventListener("click", () => {
    profileHover.style.display = "none";
  });
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

    // Optionally, remove the message after a few seconds
    setTimeout(() => flashMessage.remove(), 5000);
  } else {
    console.error("Flash messages container not found");
  }
}
