document.addEventListener("DOMContentLoaded", function () {
  const rawLogsView = document.getElementById("rawLogsView");
  const subscribeView = document.getElementById("subscribeView");
  const toggleSlider = document.querySelector(".toggle-slider");
  const sliderButton = document.querySelector(".slider-button");
  const logsOption = document.querySelector(".logs-option");
  const subscribeOption = document.querySelector(".subscribe-option");

  // Initialize Selectize for dropdowns
  $('#vehicleDropdown').selectize({
    placeholder: 'Select vehicles...',
    allowEmptyOption: true,
    closeAfterSelect: true,
  });

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

  // Fetch and populate vehicle dropdown
  async function fetchVehicles() {
    const response = await fetch("/rawLogs/getVehicles");
    const vehicles = await response.json();
    const vehicleDropdown = document.getElementById("vehicleDropdown");
    vehicles.forEach((vehicle) => {
      const option = document.createElement("option");
      option.value = vehicle.licensePlateNumber;
      option.textContent = vehicle.licensePlateNumber;
      vehicleDropdown.appendChild(option);
    });

    // Reinitialize Selectize after adding options
    $('#vehicleDropdown')[0].selectize.addOption(vehicles.map(vehicle => ({
      value: vehicle.licensePlateNumber,
      text: vehicle.licensePlateNumber,
    })));
  }

  // Initialize
  fetchVehicles();
});