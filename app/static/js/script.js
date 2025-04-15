document.addEventListener("DOMContentLoaded", function () {
  const themeToggle = document.getElementById("theme-toggle");
  const body = document.body;

  themeToggle.addEventListener("click", function () {
    body.classList.toggle("dark-mode");
    themeToggle.classList.toggle("dark");

    if (body.classList.contains("dark-mode")) {
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

    try {
      const iconLegend = document.querySelector(".icon-legend");

      if (!isVisible) {
        iconLegend.classList.add("slide");
      } else {
        iconLegend.classList.remove("slide");
      }
    } catch (error) {}
  });

  document.addEventListener("click", () => {
    profileHover.style.display = "none"; // Hide when clicking outside
    try {
      const iconLegend = document.querySelector(".icon-legend");
      iconLegend.classList.remove("slide");
    } catch (error) {}
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
