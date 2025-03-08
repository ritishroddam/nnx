$(document).ready(function () {
  $("select").selectize({
    sortField: "text",
  });
});

let imeiData = []; // To store IMEI numbers from the database
let dropdownVisible = false; // Track dropdown visibility

// Fetch IMEI data from the backend
async function fetchIMEIData() {
  try {
    const response = await fetch("/vehicleDetails/get_device_inventory");
    if (!response.ok) throw new Error("Failed to fetch IMEI data");

    imeiData = await response.json();
    populateDropdown(); // Populate dropdown on page load
  } catch (error) {
    console.error("Error fetching IMEI data:", error);
    alert("Unable to load IMEI data. Please try again later.");
  }
}

// Populate the dropdown with all IMEI numbers
function populateDropdown() {
  const imeiDropdown = document.getElementById("imeiDropdown");
  imeiDropdown.innerHTML = ""; // Clear previous options

  imeiData.forEach((device) => {
    const option = document.createElement("div");
    option.textContent = device.imei;
    option.className = "dropdown-option"; // Style for dropdown items
    // option.onclick = () => selectIMEIFromDropdown(device.imei); // Handle selection
    imeiDropdown.appendChild(option);
  });
}

// Filter the dropdown based on search input
// function filterIMEIDropdown() {
//   const searchInput = document
//     .getElementById("imeiSearch")
//     .value.trim()
//     .toLowerCase();
//   const imeiDropdown = document.getElementById("imeiDropdown");

//   imeiDropdown.style.display = "block"; // Show dropdown while filtering
//   dropdownVisible = true; // Track visibility

//   const options = imeiDropdown.querySelectorAll(".dropdown-option");
//   options.forEach((option) => {
//     if (option.textContent.toLowerCase().includes(searchInput)) {
//       option.style.display = "block";
//     } else {
//       option.style.display = "none";
//     }
//   });
// }

// Initialize IMEI fetching
document.addEventListener("DOMContentLoaded", fetchIMEIData);

function editVehicle(vehicleId) {
  const row = document.querySelector(`tr[data-id="${vehicleId}"]`);
  const cells = row.querySelectorAll("td[data-editable]");

  // Make fields editable
  cells.forEach((cell) => {
    const currentValue = cell.textContent.trim();
    cell.setAttribute("data-original-value", currentValue); // Save the original value
    cell.innerHTML = `<input type="text" value="${currentValue}" class="table-input" />`;
  });

  // Replace Edit/Delete buttons with Save/Cancel
  const actionCell = row.querySelector("td[data-actions]");
  actionCell.innerHTML = `
    <button class="icon-btn edit-icon" onclick="saveVehicle('${vehicleId}')">💾</button>
    <button class="icon-btn delete-icon" onclick="cancelEdit('${vehicleId}')">❌</button>
  `;
}

function saveVehicle(vehicleID) {
  const row = document.querySelector(`tr[data-id="${vehicleID}"]`);
  const cells = row.querySelectorAll("td[data-editable]");

  // Collect updated data
  const updatedData = {};
  cells.forEach((cell) => {
    const key = cell.getAttribute("data-key");
    const input = cell.querySelector("input");
    updatedData[key] = input ? input.value.trim() : "";
  });

  // Send updated data to backend
  fetch(`/vehicleDetails/edit_vehicle/${vehicleID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedData),
  })
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        // Update table with new values
        cells.forEach((cell) => {
          const input = cell.querySelector("input");
          cell.textContent = input ? input.value.trim() : "";
        });

        // Restore original action buttons
        const actionCell = row.querySelector("td[data-actions]");
        actionCell.innerHTML = `
                <button class="icon-btn edit-icon" onclick="editVehicle('${vehicleID}')">✏️</button>
                <button class="icon-btn delete-icon" onclick="deleteVehicle('${vehicleID}')">🗑️</button>
            `;

        alert("Vehicle updated successfully!");
      } else {
        alert(`Error: ${result.message}`);
      }
    })
    .catch((error) => {
      console.error("Error saving vehicle:", error);
      alert("An error occurred while saving. Please try again.");
    });
}

function cancelEdit(vehicleID) {
  const row = document.querySelector(`tr[data-id="${vehicleID}"]`);
  const cells = row.querySelectorAll("td[data-editable]");

  // Revert to original values
  cells.forEach((cell) => {
    const originalValue = cell.getAttribute("data-original-value");
    cell.textContent = originalValue;
  });

  // Restore action buttons
  const actionCell = row.querySelector("td[data-actions]");
  actionCell.innerHTML = `
        <button class="icon-btn edit-icon" onclick="editVehicle('${vehicleID}')">✏️</button>
        <button class="icon-btn delete-icon" onclick="deleteVehicle('${vehicleID}')">🗑️</button>
    `;
}

function deleteVehicle(vehicleID) {
  if (confirm("Are you sure you want to delete this vehicle?")) {
    fetch(`/vehicleDetails/delete_vehicle/${vehicleID}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (response.ok) {
          // Remove the row from the table
          const row = document.querySelector(`tr[data-id="${vehicleID}"]`);
          row.remove();
          alert("Vehicle deleted successfully.");
        } else {
          alert("Failed to delete vehicle.");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("An error occurred.");
      });
  }
}

let simData = []; // To store SIM data from the database
let simDropdownVisible = false; // Track SIM dropdown visibility

// Fetch SIM data from the database
async function fetchSIMData() {
  try {
    const response = await fetch("/vehicleDetails/get_sim_inventory");
    if (!response.ok) throw new Error("Failed to fetch SIM data");

    simData = await response.json();
    populateSIMDropdown(); // Populate dropdown on page load
  } catch (error) {
    console.error("Error fetching SIM data:", error);
    alert("Unable to load SIM data. Please try again later.");
  }
}

// Populate the SIM dropdown
function populateSIMDropdown() {
  const simDropdown = document.getElementById("sim-Dropdown");
  simDropdown.innerHTML =
    '<option value="Select SIM" disabled>Select SIM</option>';

  simData.forEach((sim) => {
    const option = document.createElement("option");
    option.value = sim.sim_number;
    option.textContent = sim.sim_number;
    simDropdown.appendChild(option);
  });
}

// Initialize SIM data fetching
document.addEventListener("DOMContentLoaded", fetchSIMData);

function editVehicle(vehicleID) {
  const row = document.querySelector(`tr[data-id="${vehicleID}"]`);
  const cells = row.querySelectorAll("td[data-editable]");

  // Convert cells to input fields
  cells.forEach((cell) => {
    const currentValue = cell.textContent.trim();
    cell.setAttribute("data-original-value", currentValue); // Save original value
    cell.innerHTML = `<input type="text" value="${currentValue}" class="table-input" />`;
  });

  // Change action buttons to "Save" and "Cancel"
  const actionCell = row.querySelector("td[data-actions]");
  actionCell.innerHTML = `
        <button class="icon-btn edit-icon" onclick="saveVehicle('${vehicleID}')">💾</button>
        <button class="icon-btn delete-icon" onclick="cancelEdit('${vehicleID}')">❌</button>
    `;
}

function deleteVehicle(vehicleID) {
  if (confirm("Are you sure you want to delete this vehicle?")) {
    fetch(`/vehicleDetails/delete_vehicle/${vehicleID}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (response.ok) {
          // Remove the row from the table
          const row = document.querySelector(`tr[data-id="${vehicleID}"]`);
          row.remove();
          alert("Vehicle deleted successfully.");
        } else {
          alert("Failed to delete vehicle.");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("An error occurred.");
      });
  }
}

async function deleteVehicle(vehicleId) {
  if (!confirm("Are you sure you want to delete this vehicle?")) {
    return;
  }

  try {
    const response = await fetch(
      `/vehicleDetails/delete_vehicle/${vehicleId}`,
      {
        method: "DELETE",
      }
    );

    const result = await response.json();
    if (result.success) {
      alert("Vehicle deleted successfully!");
      location.reload();
    } else {
      alert(`Failed to delete vehicle: ${result.message}`);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred. Please try again.");
  }
}

document
  .getElementById("manualForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault(); // Prevent form from submitting immediately

    const licensePlateNumber = document
      .getElementById("LicensePlateNumber")
      .value.trim();
    const imeiNumber = document.getElementById("imeiSearch").value.trim();
    const simNumber = document.getElementById("simSearch").value.trim();

    this.submit();
  });

document
  .getElementById("manualEntryBtn")
  .addEventListener("click", function () {
    document.getElementById("manualEntryForm").classList.toggle("hidden");
    document.getElementById("LicensePlateNumber").focus();
  });

document.getElementById("cancelBtn").addEventListener("click", function () {
  document.getElementById("manualEntryForm").classList.add("hidden");
});

document.getElementById("uploadBtn").addEventListener("click", function () {
  document.getElementById("uploadFormContainer").classList.toggle("hidden");
});

document.getElementById("uploadForm").addEventListener("submit", function () {
  document.querySelector(".preloader").style.display = "block";
});

document
  .getElementById("downloadExcelBtn")
  .addEventListener("click", function () {
    window.location.href = "/vehicleDetails/download_excel";
  });
