document.addEventListener("DOMContentLoaded", function () {
  let dropdowns = document.querySelectorAll(".dropdown");

  dropdowns.forEach((dropdown) => {
    dropdown.addEventListener("click", function (event) {
      event.stopPropagation(); // Prevents hover conflict
      let submenu = this.querySelector(".submenu");
      let arrow = this.querySelector(".arrow");

      if (submenu.style.display === "block") {
        submenu.style.display = "none";
      } else {
        submenu.style.display = "block";
      }

      arrow.classList.toggle("rotate");
    });
  });
});

document.addEventListener("DOMContentLoaded", function () {
  let dropdowns = document.querySelectorAll(".dropdown");

  dropdowns.forEach((dropdown) => {
    dropdown.addEventListener("click", function (event) {
      event.stopPropagation(); // Prevents hover conflict
      let submenu = this.querySelector(".submenu");
      let arrow = this.querySelector(".arrow");

      if (submenu.style.display === "block") {
        submenu.style.display = "none";
      } else {
        submenu.style.display = "block";
      }

      arrow.classList.toggle("rotate");
    });
  });
});

const toggleButton = document.createElement("button");
toggleButton.textContent = "Switch to Dark Mode";
toggleButton.style.position = "absolute";
toggleButton.style.bottom = "20px";
toggleButton.style.right = "20px";
toggleButton.style.zIndex = "1000";
toggleButton.style.padding = "10px 15px";
toggleButton.style.background = "#fff";
toggleButton.style.border = "1px solid #ccc";
toggleButton.style.borderRadius = "5px";
toggleButton.style.cursor = "pointer";
toggleButton.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.3)";
toggleButton.style.fontSize = "14px";
toggleButton.style.fontWeight = "bold";
toggleButton.style.color = "#333";

document.body.appendChild(toggleButton);

let darkMode = false;

toggleButton.addEventListener("click", function () {
  if (darkMode) {
    document.body.classList.remove("dark-mode");
    toggleButton.textContent = "Switch to Dark Mode";
  } else {
    document.body.classList.add("dark-mode");
    toggleButton.textContent = "Switch to Light Mode";
  }
  darkMode = !darkMode;
});
