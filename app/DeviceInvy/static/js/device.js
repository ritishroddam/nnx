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

document.getElementById("manualEntryBtn").addEventListener("click", function() {
  hideAllModals();
  document.getElementById("manualEntryModal").classList.remove("hidden");
});

document.querySelector("#manualEntryModal .close-btn").addEventListener("click", function() {
  hideAllModals();
});

document.getElementById("cancelBtn").addEventListener("click", function () {
  hideAllModals();
  document.getElementById("manualForm").reset();
});

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

document.getElementById("closeUploadBtn").addEventListener("click", function () {
  hideAllModals();
});

document.getElementById("cancelUploadBtn").addEventListener("click", function () {
  hideAllModals();
});

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

    if (imei.length !== 15 || isNaN(imei)) {
      imeiError.classList.remove("hidden");
      event.preventDefault();
    } else {
      imeiError.classList.add("hidden");
    }
  });

document.addEventListener("DOMContentLoaded", function () {
  const dateInInput = document.getElementById("DateIn");

  const today = new Date().toISOString().split("T")[0];
  dateInInput.setAttribute("max", today);

  dateInInput.addEventListener("input", function () {
    if (this.value > today) {
      displayFlashMessage("Future dates are not allowed.", "warning");
      this.value = today; 
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
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.error || 'Search failed'); });
      }
      return response.json();
    })
    .then(data => {
      const tableBody = document.getElementById("deviceTable");
      tableBody.innerHTML = '';
      
      if (!data || data.length === 0) {
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
          <td>${device.LicensePlateNumber || ''}</td>
          <td>${device.CompanyName || ''}</td>
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
      displayFlashMessage("Error searching devices. Please try again.");
    });
}

function clearSearch() {
  document.getElementById("imeiSearch").value = '';
  location.reload(); 
}

////////////////// Download ////////////////////////

document.getElementById("downloadExcel").addEventListener("click", function() {
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = '/deviceInvy/download_excel';
    
    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'access_token';
    tokenInput.value = localStorage.getItem('access_token') || getCookie('access_token');
    form.appendChild(tokenInput);
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
});

function editDevice(deviceId) {
  console.log("Edit button clicked for device ID:", deviceId);

  const row = document.querySelector(`tr[data-id='${deviceId}']`);

  const imei = row.cells[0].innerText;
  const glNumber =
    row.cells[1].innerText.trim() === "None"
      ? ""
      : row.cells[1].innerText.trim();
  const deviceModel = row.cells[4].innerText;
  const deviceMake = row.cells[5].innerText;
  const dateIn = row.cells[6].innerText;
  const warranty = row.cells[7].innerText;
  const sentBy = row.cells[8].innerText;
  const outwardTo = row.cells[9].innerText;
  const packageValue = row.cells[10].innerText;
  const tenureValue = row.cells[11].innerText;
  const status = row.cells[12].innerText.trim();
  
  row.cells[0].innerHTML = `<input type="text" value="${imei}" id="editIMEI" maxlength="15" oninput="validateIMEI(this)" />`;
  row.cells[1].innerHTML = `<input type="text" value="${glNumber}" id="editGLNumber" maxlength="13" oninput="validateGLNumber(this)" />`;
  row.cells[4].innerHTML = `<input type="text" value="${deviceModel}" />`;
  row.cells[5].innerHTML = `<input type="text" value="${deviceMake}" />`;

  row.cells[6].innerHTML = `<input type="date" value="${dateIn}" />`;
  row.cells[7].innerHTML = `<input type="date" value="${warranty}" />`;
  row.cells[8].innerHTML = `<input type="text" value="${sentBy}" />`;
  row.cells[9].innerHTML = `<input type="date" value="${outwardTo}" />`;
  row.cells[10].innerHTML = `
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

  row.cells[11].innerHTML = `<input type="text" id="editTenure" value="${tenureValue}" ${
    packageValue === "Package" ? "" : "disabled"
  } />`;

  row.cells[12].innerHTML = `
    <input type="radio" name="status-${deviceId}" value="Active" ${
    status === "Active" ? "checked" : ""
  } /> Active
    <input type="radio" name="status-${deviceId}" value="Inactive" ${
    status === "Inactive" ? "checked" : ""
  } /> Inactive
  `;

  row.cells[13].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveDevice('${deviceId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit('${deviceId}')">❌</button>
  `;

  document
    .getElementById("editPackage")
    .addEventListener("change", function () {
      document.getElementById("editTenure").disabled = this.value !== "Package";
    });
}

function validateIMEI(input) {
  let imei = input.value;
  if (!/^\d{0,15}$/.test(imei)) {
    input.value = imei.slice(0, 15); 
  }
}

function validateGLNumber(input) {
  let glNumber = input.value;
  if (!/^\d{0,13}$/.test(glNumber)) {
    input.value = glNumber.slice(0, 13); 
  }
}

function saveDevice(deviceId) {
  const row = document.querySelector(`tr[data-id='${deviceId}']`);

  const imeiValue = row.cells[0].querySelector("input").value.trim();
  const glNumberValue = row.cells[1].querySelector("input").value.trim();
  const deviceModel = row.cells[4].querySelector("input").value.trim();
  const deviceMake = row.cells[5].querySelector("input").value.trim();
  const dateIn = row.cells[6].querySelector("input").value.trim();
  const today = new Date().toISOString().split("T")[0];
  const warranty = row.cells[7].querySelector("input").value.trim();
  const sentBy = row.cells[8].querySelector("input").value.trim();
  const outwardTo = row.cells[9].querySelector("input").value.trim();
  const packageValue = row.cells[10].querySelector("select").value;
  const tenureValue = row.cells[11].querySelector("input").value.trim();
  const status = row.cells[12]
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

  if (imeiValue.length !== 15 || isNaN(imeiValue)) {
    displayFlashMessage("IMEI must be exactly 15 digits and numeric.", "warning");
    return;
  }

  if (glNumberValue && (glNumberValue.length !== 13 || isNaN(glNumberValue))) {
    displayFlashMessage("GL Number must be exactly 13 digits if entered.", "warning");
    return;
  }

  if (dateIn > today) {
    displayFlashMessage("Future dates are not allowed for Date In.", "warning");
    return;
  }

  if (packageValue === "Package" && tenureValue.trim() === "") {
    displayFlashMessage("Tenure is required when Package is selected.", "warning");
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
        row.cells[4].innerText = updatedData.DeviceModel;
        row.cells[5].innerText = updatedData.DeviceMake;
        row.cells[6].innerText = updatedData.DateIn;
        row.cells[7].innerText = updatedData.Warranty;
        row.cells[8].innerText = updatedData.SentBy;
        row.cells[9].innerText = updatedData.OutwardTo;
        row.cells[10].innerText = updatedData.Package;
        row.cells[11].innerText = updatedData.Tenure || "";
        row.cells[12].innerHTML = `<button class="status-btn ${
          updatedData.Status === "Active" ? "status-active" : "status-inactive"
        }" disabled>${updatedData.Status}</button>`;
        row.cells[13].innerHTML = `
          <button class="icon-btn edit-icon" onclick="editDevice('${deviceId}')">✏️</button>
          <button class="icon-btn delete-icon" onclick="deleteDevice('${deviceId}')">🗑️</button>
        `;
        displayFlashMessage("Changes saved successfully!", "success");
      } else {
        displayFlashMessage("Failed to save changes. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error updating device:", error);
      displayFlashMessage("An error occurred. Please try again.");
    });
}

function cancelEdit(deviceId) {
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
          document.querySelector(`tr[data-id='${deviceId}']`).remove();
          displayFlashMessage("Device deleted successfully!", "success");
        } else {
          displayFlashMessage("Failed to delete device. Please try again.");
          console.error("Error deleting device:", data.message);
        }
      })
      .catch((error) => {
        displayFlashMessage("An error occurred while deleting the device.");
        console.error("Error deleting device:", error);
      });
  }
}
