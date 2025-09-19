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

  let allDevices = [];

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
  initializeStatusFilter();
});

function initializeStatusFilter() {
    // Store all devices when page loads
    allDevices = Array.from(document.querySelectorAll("#deviceTable tr[data-id]"));
    
    // Update counts
    updateStatusCounts();
    
    // Add event listener for filter
    document.getElementById("statusFilter").addEventListener("change", filterDevicesByStatus);
}

function filterDevicesByStatus() {
  const selectedStatus = document.getElementById("statusFilter").value;
  if (!selectedStatus) {
    allDevices.forEach(device => {
      device.style.display = "";
    });
    return;
  }
  allDevices.forEach(device => {
    // Status is now in cell 11 (0-based)
    if (["New Stock", "In use", "Available", "Discarded"].includes(selectedStatus)) {
      const statusCell = device.cells[11];
      let status = statusCell.textContent.trim();
      device.style.display = status === selectedStatus ? "" : "none";
    } else {
      // For package type filter
      const packageCell = device.cells[9];
      const packageType = packageCell.textContent.trim();
      device.style.display = packageType === selectedStatus ? "" : "none";
    }
  });
}

function updateStatusCounts() {
  let newStockCount = 0;
  let inUseCount = 0;
  let availableCount = 0;
  let discardedCount = 0;
  let rentalCount = 0;
  let packageCount = 0;
  let outrateCount = 0;

  allDevices.forEach(device => {
    // Count package types (from column 9)
    const packageCell = device.cells[9];
    const packageType = packageCell.textContent.trim();
    if (packageType === "Rental") rentalCount++;
    if (packageType === "Package") packageCount++;
    if (packageType === "Outrate") outrateCount++;

    // Count statuses (from column 11)
    const statusCell = device.cells[11];
    let status = statusCell.textContent.trim();
    if (status === "New Stock") newStockCount++;
    if (status === "In use") inUseCount++;
    if (status === "Available") availableCount++;
    if (status === "Discarded") discardedCount++;
  });

  document.getElementById("newStockCount").textContent = newStockCount;
  document.getElementById("inUseCount").textContent = inUseCount;
  document.getElementById("availableCount").textContent = availableCount;
  document.getElementById("discardedCount").textContent = discardedCount;
  document.getElementById("rentalCount").textContent = rentalCount;
  document.getElementById("packageCount").textContent = packageCount;
  document.getElementById("outrateCount").textContent = outrateCount;
}

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
        row.innerHTML = `<td colspan="16" class="no-results">No devices found</td>`;
        tableBody.appendChild(row);
        resetCounts();
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
          <td>${device.OutwardTo || ''}</td>
          <td>${device.Package}</td>
          <td>${device.Package === 'Package' ? device.Tenure || '' : ''}</td>
          <td><span class="status-label">${device.Status || 'New Stock'}</span></td>
          <td>${device.LastEditedBy || ''}</td>
          <td>${device.LastEditedDate || ''}</td>
          <td>
            <button class="icon-btn edit-icon" onclick="editDevice('${device._id}')">✏️</button>
            <button class="icon-btn delete-icon" onclick="deleteDevice('${device._id}')">🗑️</button>
          </td>
          <td></td>
        `;
        tableBody.appendChild(row);
      });
      allDevices = Array.from(document.querySelectorAll("#deviceTable tr[data-id]"));
      updateStatusCounts();
    })
    .catch(error => {
      console.error('Error searching devices:', error);
      displayFlashMessage("Error searching devices. Please try again.");
    });
}

function resetCounts() {
  document.getElementById("newStockCount").textContent = "0";
  document.getElementById("inUseCount").textContent = "0";
  document.getElementById("availableCount").textContent = "0";
  document.getElementById("discardedCount").textContent = "0";
  document.getElementById("rentalCount").textContent = "0";
  document.getElementById("packageCount").textContent = "0";
  document.getElementById("outrateCount").textContent = "0";
}

function clearSearch() {
  document.getElementById("imeiSearch").value = '';
  document.getElementById("statusFilter").value = '';
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
  const row = document.querySelector(`tr[data-id='${deviceId}']`);
  const imei = row.cells[0].innerText;
  const glNumber = row.cells[1].innerText.trim() === "None" ? "" : row.cells[1].innerText.trim();
  const deviceModel = row.cells[4].innerText;
  const deviceMake = row.cells[5].innerText;
  const dateIn = row.cells[6].innerText;
  const warranty = row.cells[7].innerText;
  const outwardTo = row.cells[8].innerText;
  const packageValue = row.cells[9].innerText;
  const tenureValue = row.cells[10].innerText;
  const status = row.cells[11].innerText.trim();
    // Do not hide Last Edited By/Date columns
    row.cells[12].style.display = '';
    row.cells[13].style.display = '';

  row.cells[0].innerHTML = `<input type="text" value="${imei}" id="editIMEI" maxlength="15" oninput="validateIMEI(this)" />`;
  row.cells[1].innerHTML = `<input type="text" value="${glNumber}" id="editGLNumber" maxlength="13" oninput="validateGLNumber(this)" />`;
  row.cells[4].innerHTML = `<input type="text" value="${deviceModel}" />`;
  row.cells[5].innerHTML = `<input type="text" value="${deviceMake}" />`;
  row.cells[6].innerHTML = `<input type="date" value="${dateIn}" />`;
  row.cells[7].innerHTML = `<input type="date" value="${warranty}" />`;
  row.cells[8].innerHTML = `<input type="date" value="${outwardTo}" />`;
  row.cells[9].innerHTML = `
    <select id="editPackage">
      <option value="Rental" ${packageValue === "Rental" ? "selected" : ""}>Rental</option>
      <option value="Package" ${packageValue === "Package" ? "selected" : ""}>Package</option>
      <option value="Outrate" ${packageValue === "Outrate" ? "selected" : ""}>Outrate</option>
    </select>
  `;
  row.cells[10].innerHTML = `<input type="text" id="editTenure" value="${tenureValue}" ${packageValue === "Package" ? "" : "disabled"} />`;
  row.cells[11].innerHTML = `
    <select id="editStatus">
      <option value="New Stock" ${status === "New Stock" ? "selected" : ""}>New Stock</option>
      <option value="In use" ${status === "In use" ? "selected" : ""}>In use</option>
      <option value="Available" ${status === "Available" ? "selected" : ""}>Available</option>
      <option value="Discarded" ${status === "Discarded" ? "selected" : ""}>Discarded</option>
    </select>
  `;
  row.cells[14].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveDevice('${deviceId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit('${deviceId}')">❌</button>
  `;
  document.getElementById("editPackage").addEventListener("change", function () {
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
  const outwardTo = row.cells[8].querySelector("input").value.trim();
  const packageValue = row.cells[9].querySelector("select").value;
  const tenureValue = row.cells[10].querySelector("input").value.trim();
  const status = row.cells[11].querySelector("select").value;

  if (imeiValue.length !== 15 || isNaN(imeiValue)) {/* ...existing code... */}
  if (glNumberValue && (glNumberValue.length !== 13 || isNaN(glNumberValue))) {/* ...existing code... */}
  if (dateIn > today) {/* ...existing code... */}
  if (packageValue === "Package" && tenureValue.trim() === "") {/* ...existing code... */}

  // Username and date will be set by backend using JWT
  let now = new Date();
  let lastEditedDate = now.toISOString();

  fetch(`/deviceInvy/edit_device/${deviceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem('access_token') || getCookie('access_token')}`
    },
    body: JSON.stringify({
      IMEI: imeiValue,
      GLNumber: glNumberValue,
      DeviceModel: deviceModel,
      DeviceMake: deviceMake,
      DateIn: dateIn,
      Warranty: warranty,
      OutwardTo: outwardTo,
      Package: packageValue,
      Tenure: tenureValue,
      Status: status,
      LastEditedDate: lastEditedDate
      // LastEditedBy will be set by backend
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        location.reload();
      } else {
        alert(data.message || "Failed to update device.");
      }
    })
    .catch(error => {
      alert("Error updating device.");
    });
}