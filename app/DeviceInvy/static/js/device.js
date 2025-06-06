document.getElementById("DateIn").addEventListener("change", function () {
  var dateIn = new Date(this.value);
  var warrantyDate = new Date(dateIn);
  warrantyDate.setFullYear(warrantyDate.getFullYear() + 1);
  document.getElementById("Warranty").value = warrantyDate
    .toISOString()
    .split("T")[0];
});

function hideAllModals() {
  document.getElementById("manualEntryModal").classList.add("hidden");
  document.getElementById("uploadBox").classList.add("hidden");
}

// Show manual entry modal
document.getElementById("manualEntryBtn").addEventListener("click", function() {
  hideAllModals();
  document.getElementById("manualEntryModal").classList.remove("hidden");
});

// Close manual modal with X button
document.querySelector("#manualEntryModal .close-btn").addEventListener("click", function() {
  hideAllModals();
});

// Close manual modal with Cancel button
document.getElementById("cancelBtn").addEventListener("click", function () {
  hideAllModals();
  document.getElementById("manualForm").reset();
});

// Close manual modal when clicking outside
window.addEventListener("click", function(event) {
  if (event.target === document.getElementById("manualEntryModal")) {
    hideAllModals();
  }
  if (event.target === document.getElementById("uploadBox")) {
    hideAllModals();
  }
});

document.getElementById("uploadBtn").addEventListener("click", function () {
  hideAllModals();
  document.getElementById("uploadBox").classList.remove("hidden");
});

// Close modal with X button
document.getElementById("closeUploadBtn").addEventListener("click", function () {
  hideAllModals();
});

// Close modal with Cancel button
document.getElementById("cancelUploadBtn").addEventListener("click", function () {
  hideAllModals();
});

// Close modal when clicking outside the modal content
window.addEventListener("click", function(event) {
  const uploadBox = document.getElementById("uploadBox");
  if (event.target === uploadBox) {
    uploadBox.classList.add("hidden");
  }
});

document.getElementById("uploadForm").addEventListener("submit", function () {
  document.querySelector(".preloader").style.display = "block";
});

document
  .getElementById("manualForm")
  .addEventListener("submit", function (event) {
    var imei = document.getElementById("IMEI").value;
    var imeiError = document.getElementById("imeiError");

    // IMEI validation
    if (imei.length !== 15 || isNaN(imei)) {
      imeiError.classList.remove("hidden");
      event.preventDefault();
    } else {
      imeiError.classList.add("hidden");
    }
  });

document.addEventListener("DOMContentLoaded", function () {
  const dateInInput = document.getElementById("DateIn");

  // Set the max date to today
  const today = new Date().toISOString().split("T")[0];
  dateInInput.setAttribute("max", today);

  // Prevent selecting future dates
  dateInInput.addEventListener("input", function () {
    if (this.value > today) {
      alert("Future dates are not allowed.");
      this.value = today; // Reset to today's date
    }
  });
});

document.getElementById("Package").addEventListener("change", function () {
  var tenureContainer = document.getElementById("TenureContainer");
  var tenureInput = document.getElementById("Tenure");
  if (this.value === "Package") {
    tenureContainer.classList.remove("hidden");
    tenureInput.setAttribute("required", "true");
  } else {
    tenureContainer.classList.add("hidden");
    tenureInput.removeAttribute("required");
  }
});

document.getElementById("searchBtn").addEventListener("click", searchDevices);
document.getElementById("clearSearchBtn").addEventListener("click", clearSearch);
document.getElementById("imeiSearch").addEventListener("keyup", function(event) {
  if (event.key === "Enter") {
    searchDevices();
  }
});

function searchDevices() {
  const searchValue = document.getElementById("imeiSearch").value.trim();
  if (!searchValue) {
    clearSearch();
    return;
  }

  fetch(`/deviceInvy/search_devices?imei=${searchValue}`)
    .then(response => response.json())
    .then(data => {
      const tableBody = document.getElementById("deviceTable");
      tableBody.innerHTML = ''; // Clear current table

      if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="13" class="no-results">No devices found</td>`;
        tableBody.appendChild(row);
        return;
      }

      data.forEach(device => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', device._id);
        row.innerHTML = `
          <td>${device.IMEI}</td>
          <td>${device.GLNumber || ''}</td>
          <td>${device.DeviceModel}</td>
          <td>${device.DeviceMake}</td>
          <td>${device.DateIn}</td>
          <td>${device.Warranty}</td>
          <td>${device.SentBy}</td>
          <td>${device.OutwardTo}</td>
          <td>${device.Package}</td>
          <td>${device.Package === 'Package' ? device.Tenure || '' : ''}</td>
          <td>
            ${device.Status === 'Active' ? 
              '<button class="status-btn status-active" disabled>Active</button>' : 
              device.Status === 'Inactive' ? 
              '<button class="status-btn status-inactive" disabled>Inactive</button>' : 
              ''}
          </td>
          <td>
            <button class="icon-btn edit-icon" onclick="editDevice('${device._id}')">✏️</button>
            <button class="icon-btn delete-icon" onclick="deleteDevice('${device._id}')">🗑️</button>
          </td>
          <td></td>
        `;
        tableBody.appendChild(row);
      });
    })
    .catch(error => {
      console.error('Error searching devices:', error);
      alert('Error searching devices. Please try again.');
    });
}

function clearSearch() {
  document.getElementById("imeiSearch").value = '';
  location.reload(); 
}

////////////////// Download ////////////////////////

// document.getElementById("downloadExcel").addEventListener("click", function () {
//   window.location.href = "/deviceInvy/download_excel";
// });

document.getElementById("downloadExcel").addEventListener("click", async function() {
    try {
        // Show loading state
        this.disabled = true;
        const originalText = this.textContent;
        this.textContent = "Preparing download...";
        
        // Get JWT token from where you store it (localStorage/cookies)
        const token = localStorage.getItem('access_token') || getCookie('access_token');
        
        const response = await fetch('/deviceInvy/download_excel', {
            headers: {
                'Authorization': `Bearer ${token}`,
                // Include CSRF token if needed
                'X-CSRF-TOKEN': getCookie('csrf_access_token') 
            }
        });
        
        if (!response.ok) {
            throw new Error(`Download failed: ${response.statusText}`);
        }
        
        // Get the blob and create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Device_Inventory.xlsx';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
    } catch (error) {
        console.error('Download error:', error);
        alert(`Download failed: ${error.message}`);
    } finally {
        // Reset button state
        this.disabled = false;
        this.textContent = originalText;
    }
});

function editDevice(deviceId) {
  console.log("Edit button clicked for device ID:", deviceId);

  const row = document.querySelector(`tr[data-id='${deviceId}']`);

  // Extract existing values from the row
  const imei = row.cells[0].innerText;
  // const glNumber = row.cells[1].innerText;
  const glNumber =
    row.cells[1].innerText.trim() === "None"
      ? ""
      : row.cells[1].innerText.trim();
  const deviceModel = row.cells[2].innerText;
  const deviceMake = row.cells[3].innerText;
  const dateIn = row.cells[4].innerText;
  const warranty = row.cells[5].innerText;
  const sentBy = row.cells[6].innerText;
  const outwardTo = row.cells[7].innerText;
  const packageValue = row.cells[8].innerText;
  const tenureValue = row.cells[9].innerText;
  const status = row.cells[10].innerText.trim();

  // Replace row cells with editable inputs
  row.cells[0].innerHTML = `<input type="text" value="${imei}" id="editIMEI" maxlength="15" oninput="validateIMEI(this)" />`;
  row.cells[1].innerHTML = `<input type="text" value="${glNumber}" id="editGLNumber" maxlength="13" oninput="validateGLNumber(this)" />`;
  row.cells[2].innerHTML = `<input type="text" value="${deviceModel}" />`;
  row.cells[3].innerHTML = `<input type="text" value="${deviceMake}" />`;

  row.cells[4].innerHTML = `<input type="date" value="${dateIn}" />`;
  row.cells[5].innerHTML = `<input type="date" value="${warranty}" />`;
  row.cells[6].innerHTML = `<input type="text" value="${sentBy}" />`;
  row.cells[7].innerHTML = `<input type="text" value="${outwardTo}" />`;
  row.cells[8].innerHTML = `
    <select id="editPackage">
      <option value="Rental" ${
        packageValue === "Rental" ? "selected" : ""
      }>Rental</option>
      <option value="Package" ${
        packageValue === "Package" ? "selected" : ""
      }>Package</option>
      <option value="Outrate" ${
        packageValue === "Outrate" ? "selected" : ""
      }>Outrate</option>
    </select>
  `;

  row.cells[9].innerHTML = `<input type="text" id="editTenure" value="${tenureValue}" ${
    packageValue === "Package" ? "" : "disabled"
  } />`;

  row.cells[10].innerHTML = `
    <input type="radio" name="status-${deviceId}" value="Active" ${
    status === "Active" ? "checked" : ""
  } /> Active
    <input type="radio" name="status-${deviceId}" value="Inactive" ${
    status === "Inactive" ? "checked" : ""
  } /> Inactive
  `;

  row.cells[11].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveDevice('${deviceId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit('${deviceId}')">❌</button>
  `;

  // Enable/disable "Tenure" based on "Package" selection
  document
    .getElementById("editPackage")
    .addEventListener("change", function () {
      document.getElementById("editTenure").disabled = this.value !== "Package";
    });
}

function validateIMEI(input) {
  let imei = input.value;
  if (!/^\d{0,15}$/.test(imei)) {
    input.value = imei.slice(0, 15); // Restrict to 15 digits
  }
}

function validateGLNumber(input) {
  let glNumber = input.value;
  if (!/^\d{0,13}$/.test(glNumber)) {
    input.value = glNumber.slice(0, 13); // Restrict to 13 digits
  }
}

function saveDevice(deviceId) {
  const row = document.querySelector(`tr[data-id='${deviceId}']`);

  const imeiValue = row.cells[0].querySelector("input").value.trim();
  const glNumberValue = row.cells[1].querySelector("input").value.trim();
  const deviceModel = row.cells[2].querySelector("input").value.trim();
  const deviceMake = row.cells[3].querySelector("input").value.trim();
  const dateIn = row.cells[4].querySelector("input").value.trim();
  const today = new Date().toISOString().split("T")[0];
  const warranty = row.cells[5].querySelector("input").value.trim();
  const sentBy = row.cells[6].querySelector("input").value.trim();
  const outwardTo = row.cells[7].querySelector("input").value.trim();
  const packageValue = row.cells[8].querySelector("select").value;
  const tenureValue = row.cells[9].querySelector("input").value.trim();
  const status = row.cells[10]
    .querySelector(`input[name="status-${deviceId}"]:checked`)
    .value.trim();

  console.log("Updated Data:", {
    IMEI: imeiValue,
    GLNumber: glNumberValue || null,
    DeviceModel: deviceModel,
    DeviceMake: deviceMake,
    DateIn: dateIn,
    Warranty: warranty,
    SentBy: sentBy,
    OutwardTo: outwardTo,
    Package: packageValue,
    Tenure: tenureValue || null,
    Status: status,
  });

  // Validate inputs
  if (imeiValue.length !== 15 || isNaN(imeiValue)) {
    alert("IMEI must be exactly 15 digits and numeric.");
    return;
  }

  if (glNumberValue && (glNumberValue.length !== 13 || isNaN(glNumberValue))) {
    alert("GL Number must be exactly 13 digits if entered.");
    return;
  }

  if (dateIn > today) {
    alert("Future dates are not allowed.");
    return;
  }

  if (packageValue === "Package" && tenureValue.trim() === "") {
    alert("Tenure is required when Package is selected.");
    return;
  }

  const updatedData = {
    IMEI: imeiValue,
    GLNumber: glNumberValue || null,
    DeviceModel: deviceModel,
    DeviceMake: deviceMake,
    DateIn: dateIn,
    Warranty: warranty,
    SentBy: sentBy,
    OutwardTo: outwardTo,
    Package: packageValue,
    Tenure: tenureValue || null,
    Status: status,
  };

  fetch(`/deviceInvy/edit_device/${deviceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCookie("csrf_access_token"),
    },
    body: JSON.stringify(updatedData),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        row.cells[0].innerText = updatedData.IMEI;
        row.cells[1].innerText = updatedData.GLNumber || "";
        row.cells[2].innerText = updatedData.DeviceModel;
        row.cells[3].innerText = updatedData.DeviceMake;
        row.cells[4].innerText = updatedData.DateIn;
        row.cells[5].innerText = updatedData.Warranty;
        row.cells[6].innerText = updatedData.SentBy;
        row.cells[7].innerText = updatedData.OutwardTo;
        row.cells[8].innerText = updatedData.Package;
        row.cells[9].innerText = updatedData.Tenure || "";
        row.cells[10].innerHTML = `<button class="status-btn ${
          updatedData.Status === "Active" ? "status-active" : "status-inactive"
        }" disabled>${updatedData.Status}</button>`;
        row.cells[11].innerHTML = `
          <button class="icon-btn edit-icon" onclick="editDevice('${deviceId}')">✏️</button>
          <button class="icon-btn delete-icon" onclick="deleteDevice('${deviceId}')">🗑️</button>
        `;
      } else {
        alert("Failed to save changes. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error updating device:", error);
      alert("An error occurred. Please try again.");
    });
}

function cancelEdit(deviceId) {
  // Reload the page to reset the changes (or implement inline reset)
  location.reload();
}

function deleteDevice(deviceId) {
  if (confirm("Are you sure you want to delete this device?")) {
    fetch(`/deviceInvy/delete_device/${deviceId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Remove the row from the table
          document.querySelector(`tr[data-id='${deviceId}']`).remove();
          alert("Device deleted successfully!");
        } else {
          alert("Error: " + data.message);
        }
      })
      .catch((error) => {
        console.error("Error deleting device:", error);
        alert("An error occurred. Please try again.");
      });
  }
}
