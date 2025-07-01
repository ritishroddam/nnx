document.addEventListener("DOMContentLoaded", function () {
  const rawLogsView = document.getElementById("rawLogsView");
  const subscribeView = document.getElementById("subscribeView");
  const toggleSlider = document.querySelector(".toggle-slider");
  const sliderButton = document.querySelector(".slider-button");
  const logsOption = document.querySelector(".logs-option");
  const subscribeOption = document.querySelector(".subscribe-option");

  // Toggle between views
  toggleSlider.addEventListener("click", function () {
    if (rawLogsView.classList.contains("active")) {
      rawLogsView.classList.remove("active");
      subscribeView.classList.add("active");
      sliderButton.style.left = "50%";
      logsOption.classList.remove("active");
      subscribeOption.classList.add("active");
    } else {
      subscribeView.classList.remove("active");
      rawLogsView.classList.add("active");
      sliderButton.style.left = "0";
      subscribeOption.classList.remove("active");
      logsOption.classList.add("active");
    }
  });

  // Fetch raw logs based on form input
  document.getElementById("rawLogsForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const licensePlateNumber = document.getElementById("licensePlateNumber").value.trim();
    const fromDatetime = document.getElementById("fromDatetime").value;
    const toDatetime = document.getElementById("toDatetime").value;

    try {
      const response = await fetch("/rawLogs/getRawLogs", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        },
        body: JSON.stringify({
          licensePlateNumber: licensePlateNumber,
          startDate: fromDatetime,
          endDate: toDatetime,
        }),
      });

      if (response.status === 200) {
        const logs = await response.json();
        const logsContainer = document.getElementById("logsContainer");
        logsContainer.innerHTML = "";

        logs.forEach((log) => {
          const logElement = document.createElement("div");
          logElement.className = "log-item";
          logElement.innerHTML = `
            <h3>${log.LicensePlateNumber}</h3>
            <p>${log.imei}</p>
            <p>${log.timestamp}</p>
            <p>${log.raw_data}</p>
            <button class="btn downloadLogBtn" data-vehicle="${log.vehicle}">Download PDF</button>
          `;
          logsContainer.appendChild(logElement);
        });

        document.querySelectorAll(".downloadLogBtn").forEach((btn) => {
          btn.addEventListener("click", function () {
            const vehicle = this.getAttribute("data-vehicle");
            downloadPDF(vehicle);
          });
        });
      } else if (response.status === 400) {
        const errorData = await response.json();
        displayFlashMessage(errorData.error || "Missing or invalid data.", "danger");
      } else if (response.status === 404) {
        const errorData = await response.json();
        displayFlashMessage(errorData.error || "License plate number not found.", "danger");
      } else {
        displayFlashMessage(`Unexpected error: ${response.statusText}`, "danger");
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      displayFlashMessage("An unexpected error occurred while fetching logs.", "danger");
    }
  });

  // Download logs as PDF
  function downloadPDF(vehicle) {
    window.open(`/rawLogs/downloadPDF?vehicle=${vehicle}`, "_blank");
  }

  // Fetch and populate vehicle dropdown
  async function fetchVehicles() {
    try {
      const response = await fetch("/rawLogs/getVehicles");
      if (response.status === 200) {
        const vehicles = await response.json();
        const vehicleDropdown = document.getElementById("vehicleDropdown");
        vehicleDropdown.innerHTML = ""; // Clear existing options
        vehicles.forEach((vehicle) => {
          const option = document.createElement("option");
          option.value = vehicle.LicensePlateNumber; // Ensure correct field name
          option.textContent = vehicle.LicensePlateNumber;
          vehicleDropdown.appendChild(option);
        });

        $("#vehicleDropdown").selectize({
          plugins: ["remove_button"],
          placeholder: "Select vehicles...",
          searchField: "text",
          create: false,
        });
      } else {
        displayFlashMessage("Failed to fetch vehicles.", "danger");
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      displayFlashMessage("An unexpected error occurred while fetching vehicles.", "danger");
    }
  }

  // Subscribe to vehicles
  document.getElementById("subscribeForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const selectedVehicles = Array.from(document.getElementById("vehicleDropdown").selectedOptions).map(
      (option) => option.value
    );

    try {
      const response = await fetch("/rawLogs/subscribeToRawLog", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        },
        body: JSON.stringify({ vehicles: selectedVehicles }),
      });

      if (response.status === 201) {
        const result = await response.json();
        displayFlashMessage(result.message || "Subscribed successfully!", "success");
      } else if (response.status === 400) {
        const errorData = await response.json();
        displayFlashMessage(errorData.error || "Bad Request: Missing or invalid data.", "danger");
      } else {
        displayFlashMessage(`Unexpected error: ${response.statusText}`, "danger");
      }
    } catch (error) {
      console.error("Error subscribing to vehicles:", error);
      displayFlashMessage("An unexpected error occurred while subscribing to vehicles.", "danger");
    }
  });

  // Initialize
  fetchVehicles();
});