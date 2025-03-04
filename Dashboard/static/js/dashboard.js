document.addEventListener("DOMContentLoaded", function () {
  // Button click handlers for navigation
  document
    .getElementById("dashboard-btn")
    .addEventListener("click", function () {
      console.log("Dashboard clicked");
      // Redirect logic goes here
    });

  document
    .getElementById("inventory-btn")
    .addEventListener("click", function () {
      console.log("Device Inventory clicked");
      // Redirect logic goes here
    });

  document
    .getElementById("typography-btn")
    .addEventListener("click", function () {
      console.log("Typography clicked");
      // Redirect logic goes here
    });

  document.getElementById("base-btn").addEventListener("click", function () {
    console.log("Base clicked");
    // Redirect logic goes here
  });

  document.getElementById("buttons-btn").addEventListener("click", function () {
    console.log("Buttons clicked");
    // Redirect logic goes here
  });

  document.getElementById("charts-btn").addEventListener("click", function () {
    console.log("Charts clicked");
    // Redirect logic goes here
  });

  document.getElementById("forms-btn").addEventListener("click", function () {
    console.log("Forms clicked");
    // Redirect logic goes here
  });

  document.getElementById("icons-btn").addEventListener("click", function () {
    console.log("Icons clicked");
    // Redirect logic goes here
  });

  // Timeframe buttons click handlers
  document.getElementById("day-btn").addEventListener("click", function () {
    console.log("Day selected");
    // Logic for day view
  });

  document.getElementById("month-btn").addEventListener("click", function () {
    console.log("Month selected");
    // Logic for month view
  });

  document.getElementById("year-btn").addEventListener("click", function () {
    console.log("Year selected");
    // Logic for year view
  });

  // Initialize auto mode on page load
  autoMode();
});

// Assuming you're making an AJAX call to fetch the company image
fetch("/get-company-image", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest", // Indicate it's an AJAX request
  },
  body: JSON.stringify({}), // If you need to send any data, include it here
})
  .then((response) => response.json())
  .then((data) => {
    if (data.company_image) {
      document.getElementById("company-image").src = data.company_image; // Update the image source
    }
  })
  .catch((error) => console.error("Error fetching company image:", error));

//logout
document.addEventListener("DOMContentLoaded", function () {
  const companyImage = document.getElementById("company-image");
  const logoutMenu = document.getElementById("logout-menu"); // Check for existence

  // Toggle menu function
  if (companyImage) {
    companyImage.addEventListener("click", toggleMenu);
  }

  function toggleMenu() {
    if (logoutMenu) {
      // Check if the logout menu is currently visible
      if (logoutMenu.style.display === "block") {
        logoutMenu.style.display = "none"; // Hide the menu
      } else {
        logoutMenu.style.display = "block"; // Show the menu
      }
    } else {
      console.error("Logout menu not found!"); // This should not happen now
    }
  }
});
