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
let currentRowsPerPage = 100;
let currentStatus = '';

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
  
  fetchAndRenderDevices(1, 100);
  initializeStatusFilter();

  document.getElementById("downloadExcel").onclick = function() {
    window.location.href = '/deviceInvy/download_excel';
  };
});

async function fetchAndRenderDevices(page = 1, rowsPerPage = currentRowsPerPage, status = '') {
  try {
    currentRowsPerPage = rowsPerPage;
    currentStatus = status || ''; 
    
    let url = `/deviceInvy/get_devices_paginated?page=${page}&per_page=${rowsPerPage}`;
    if (currentStatus && currentStatus.trim() !== '') {
      url += `&status=${encodeURIComponent(currentStatus)}`;
    }

    const response = await fetch(url, {
      headers: {
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      }
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    totalRows = data.total;
    currentPage = data.page || page;

    renderDeviceTable(data.devices);
    renderPaginationControls(totalRows, currentPage, rowsPerPage);
    await updateAllCountersFromServer();
  } catch (err) {
    document.getElementById('deviceTable').innerHTML = `<tr><td colspan="16">Failed to load data</td></tr>`;
  }
}

async function updateAllCountersFromServer() {
  try {
    const response = await fetch('/deviceInvy/device_all_counts', {
      headers: {
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }
    
    const totalDevices = (data.status["New Stock"] || 0) + 
                        (data.status["In Use"] || 0) + 
                        (data.status["Available"] || 0) + 
                        (data.status["Discarded"] || 0);
    
    document.getElementById("totalCount").textContent = totalDevices;
    
    document.getElementById("newStockCount").textContent = data.status["New Stock"] || 0;
    document.getElementById("inUseCount").textContent = data.status["In Use"] || 0;
    document.getElementById("availableCount").textContent = data.status["Available"] || 0;
    document.getElementById("discardedCount").textContent = data.status["Discarded"] || 0;
    
    document.getElementById("rentalCount").textContent = data.package["Rental"] || 0;
    document.getElementById("packageCount").textContent = data.package["Package"] || 0;
    document.getElementById("outrateCount").textContent = data.package["Outrate"] || 0;
    
  } catch (err) {
    console.error('Error fetching all counts:', err);
    console.log('Falling back to DOM counting');
    updateStatusCounts();
  }
}

async function updatePackageCountsFromServer() {
  try {
    const response = await fetch('/deviceInvy/device_package_counts', {
      headers: {
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      }
    });
    const counts = await response.json();
    
    document.getElementById("rentalCount").textContent = counts["Rental"] || 0;
    document.getElementById("packageCount").textContent = counts["Package"] || 0;
    document.getElementById("outrateCount").textContent = counts["Outrate"] || 0;
    
  } catch (err) {
    console.error('Error fetching package counts:', err);
    updatePackageCountsFromCurrentData();
  }
}

function updatePackageCountsFromCurrentData() {
  let rentalCount = 0;
  let packageCount = 0;
  let outrateCount = 0;

  allDevices.forEach(device => {
    const packageCell = device.cells[9];
    const packageType = packageCell.textContent.trim();
    if (packageType === "Rental") rentalCount++;
    if (packageType === "Package") packageCount++;
    if (packageType === "Outrate") outrateCount++;
  });

  document.getElementById("rentalCount").textContent = rentalCount;
  document.getElementById("packageCount").textContent = packageCount;
  document.getElementById("outrateCount").textContent = outrateCount;
}

function renderDeviceTable(devices) {
  const tableBody = document.getElementById("deviceTable");
  tableBody.innerHTML = '';
  
  if (!devices || devices.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="16" class="no-results">No devices found</td>`;
    tableBody.appendChild(row);
    return;
  }
  
  devices.forEach(device => {
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
      </td>
      <td></td>
    `;
    tableBody.appendChild(row);
  });
  
  allDevices = Array.from(document.querySelectorAll("#deviceTable tr[data-id]"));
}

function renderPaginationControls(totalRows, currentPage, rowsPerPage) {
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginationDiv = document.getElementById('devicePagination');
  if (!paginationDiv) return;
  
  if (totalPages <= 1) {
    paginationDiv.innerHTML = '';
    return;
  }

  const startItem = ((currentPage - 1) * rowsPerPage) + 1;
  const endItem = Math.min(currentPage * rowsPerPage, totalRows);

  let html = `
    <div class="pagination-container">
      <div class="pagination-left">
        <div class="rows-per-page">
          <span class="pagination-label">Rows per page:</span>
          <select id="rowsPerPageSelect" class="pagination-select">
            <option value="10" ${rowsPerPage === 10 ? 'selected' : ''}>10</option>
            <option value="25" ${rowsPerPage === 25 ? 'selected' : ''}>25</option>
            <option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50</option>
            <option value="100" ${rowsPerPage === 100 ? 'selected' : ''}>100</option>
          </select>
        </div>
        <div class="page-info">
          <span>${startItem}-${endItem} of ${totalRows}</span>
        </div>
      </div>
      
      <div class="pagination-right">
        <div class="pagination-nav">
          <button class="pagination-nav-btn" id="devicePrevPage" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="pagination-nav-icon">‹</span>
            Previous
          </button>
          <button class="pagination-nav-btn" id="deviceNextPage" ${currentPage === totalPages ? 'disabled' : ''}>
            Next
            <span class="pagination-nav-icon">›</span>
          </button>
        </div>
        <div class="go-to-page">
          <span class="pagination-label">Go to Page:</span>
          <input type="number" id="goToPageInput" class="page-input" 
                 min="1" max="${totalPages}" value="${currentPage}">
          <button class="pagination-go-btn" id="goToPageBtn">Go</button>
        </div>
      </div>
    </div>
  `;
  
  paginationDiv.innerHTML = html;

  document.getElementById('rowsPerPageSelect').addEventListener('change', function() {
    const newRowsPerPage = parseInt(this.value);
    fetchAndRenderDevices(1, newRowsPerPage, currentStatus); 
  });

  document.getElementById('devicePrevPage').onclick = function() {
    if (currentPage > 1) fetchAndRenderDevices(currentPage - 1, rowsPerPage, currentStatus); // pass status
  };

  document.getElementById('deviceNextPage').onclick = function() {
    if (currentPage < totalPages) fetchAndRenderDevices(currentPage + 1, rowsPerPage, currentStatus); // pass status
  };

  document.getElementById('goToPageBtn').onclick = function() {
    const pageInput = document.getElementById('goToPageInput');
    const targetPage = parseInt(pageInput.value);
    
    if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
      fetchAndRenderDevices(targetPage, rowsPerPage, currentStatus); 
    } else {
      alert(`Please enter a valid page number between 1 and ${totalPages}`);
      pageInput.value = currentPage;
    }
  };

  document.getElementById('goToPageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('goToPageBtn').click();
    }
  });

  document.getElementById('goToPageInput').addEventListener('blur', function() {
    const value = parseInt(this.value);
    if (!value || value < 1) {
      this.value = 1;
    } else if (value > totalPages) {
      this.value = totalPages;
    }
  });
}

function initializeStatusFilter() {
    updateAllCountersFromServer();

    const statusEl = document.getElementById("statusFilter");
    if (statusEl) {
      statusEl.addEventListener("change", filterDevicesByStatus);
    }
}

async function filterDevicesByStatus() {
  const selectedStatus = document.getElementById("statusFilter").value;

  if (!selectedStatus) {
    currentStatus = '';
    fetchAndRenderDevices(1, currentRowsPerPage);
    updateAllCountersFromServer();
    return;
  }

  currentStatus = selectedStatus;
  fetchAndRenderDevices(1, currentRowsPerPage, currentStatus);
}


function updateStatusCounts(devicesData = null) {
  let newStockCount = 0;
  let inUseCount = 0;
  let availableCount = 0;
  let discardedCount = 0;
  let rentalCount = 0;
  let packageCount = 0;
  let outrateCount = 0;

  allDevices.forEach(device => {
    if (device.style.display !== 'none') {
      const packageCell = device.cells[9];
      const packageType = packageCell.textContent.trim();
      if (packageType === "Rental") rentalCount++;
      if (packageType === "Package") packageCount++;
      if (packageType === "Outrate") outrateCount++;

      const statusCell = device.cells[11];
      let status = statusCell.textContent.trim();
      if (status === "New Stock") newStockCount++;
      if (status === "In Use") inUseCount++;
      if (status === "Available") availableCount++;
      if (status === "Discarded") discardedCount++;
    }
  });

  const totalDevices = newStockCount + inUseCount + availableCount + discardedCount;
  document.getElementById("totalCount").textContent = totalDevices;

  document.getElementById("newStockCount").textContent = newStockCount;
  document.getElementById("inUseCount").textContent = inUseCount;
  document.getElementById("availableCount").textContent = availableCount;
  document.getElementById("discardedCount").textContent = discardedCount;
  document.getElementById("rentalCount").textContent = rentalCount;
  document.getElementById("packageCount").textContent = packageCount;
  document.getElementById("outrateCount").textContent = outrateCount;
}

document.getElementById("Status").addEventListener("change", function() {
  const status = this.value;
  const packageSelect = document.getElementById("Package");
  const tenureContainer = document.getElementById("TenureContainer");
  const tenureInput = document.getElementById("Tenure");
  
  if (status === 'New Stock' || status === 'Available') {
    packageSelect.value = 'None';
    tenureContainer.classList.add("hidden");
    tenureInput.removeAttribute("required");
    tenureInput.value = '';
  }
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
    tenureInput.value = '';
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
        
        document.getElementById('devicePagination').innerHTML = '';
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
          </td>
          <td></td>
        `;
        tableBody.appendChild(row);
      });
      allDevices = Array.from(document.querySelectorAll("#deviceTable tr[data-id]"));

      document.getElementById('devicePagination').innerHTML = '';
      updateStatusCountsFromData(data);
    })
    .catch(error => {
      console.error('Error searching devices:', error);
      displayFlashMessage("Error searching devices. Please try again.");
    });
}

function resetCounts() {
  document.getElementById("totalCount").textContent = "0";
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
  fetchAndRenderDevices(1, currentRowsPerPage);
  updateAllCountersFromServer();
}

function updateStatusCountsFromData(devices) {
  let newStockCount = 0;
  let inUseCount = 0;
  let availableCount = 0;
  let discardedCount = 0;
  let rentalCount = 0;
  let packageCount = 0;
  let outrateCount = 0;

  devices.forEach(device => {
    const packageType = device.Package || '';
    if (packageType === "Rental") rentalCount++;
    if (packageType === "Package") packageCount++;
    if (packageType === "Outrate") outrateCount++;

    const status = device.Status || '';
    if (status === "New Stock") newStockCount++;
    if (status === "In Use") inUseCount++;
    if (status === "Available") availableCount++;
    if (status === "Discarded") discardedCount++;
  });

  const totalDevices = newStockCount + inUseCount + availableCount + discardedCount;
  document.getElementById("totalCount").textContent = totalDevices;

  document.getElementById("newStockCount").textContent = newStockCount;
  document.getElementById("inUseCount").textContent = inUseCount;
  document.getElementById("availableCount").textContent = availableCount;
  document.getElementById("discardedCount").textContent = discardedCount;
  document.getElementById("rentalCount").textContent = rentalCount;
  document.getElementById("packageCount").textContent = packageCount;
  document.getElementById("outrateCount").textContent = outrateCount;
}

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
  row.cells[12].style.display = 'none';
  row.cells[13].style.display = 'none';

  const table = row.closest('table');
  const thead = table.querySelector('thead tr');
  if (thead && thead.children[12] && thead.children[13]) {
    thead.children[12].style.display = 'none';
    thead.children[13].style.display = 'none';
  }

  row.cells[0].innerHTML = `<input type="text" value="${imei}" id="editIMEI" maxlength="15" oninput="validateIMEI(this)" />`;
  row.cells[1].innerHTML = `<input type="text" value="${glNumber}" id="editGLNumber" oninput="validateGLNumber(this)" />`;
  row.cells[4].innerHTML = `<input type="text" value="${deviceModel}" />`;
  row.cells[5].innerHTML = `<input type="text" value="${deviceMake}" />`;
  row.cells[6].innerHTML = `<input type="date" value="${dateIn}" id="editDateIn" />`;
  row.cells[7].innerHTML = `<input type="date" value="${warranty}" />`;
  row.cells[8].innerHTML = `<input type="date" value="${outwardTo}" />`;
  row.cells[9].innerHTML = `
    <select id="editPackage">
      <option value="None" ${packageValue === "None" ? "selected" : ""}>None</option>
      <option value="Rental" ${packageValue === "Rental" ? "selected" : ""}>Rental</option>
      <option value="Package" ${packageValue === "Package" ? "selected" : ""}>Package</option>
      <option value="Outrate" ${packageValue === "Outrate" ? "selected" : ""}>Outrate</option>
    </select>
  `;
  row.cells[10].innerHTML = `<input type="text" id="editTenure" value="${tenureValue}" ${packageValue === "Package" ? "" : "disabled"} />`;
  row.cells[11].innerHTML = `
    <select id="editStatus">
      <option value="New Stock" ${status === "New Stock" ? "selected" : ""}>New Stock</option>
      <option value="In Use" ${status === "In Use" ? "selected" : ""}>In Use</option>
      <option value="Available" ${status === "Available" ? "selected" : ""}>Available</option>
      <option value="Scrap" ${status === "Scrap" || status === "Discarded" ? "selected" : ""}>Scrap</option>
    </select>
  `;
  row.cells[14].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveDevice('${deviceId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit('${deviceId}')">❌</button>
  `;
  document.getElementById("editPackage").addEventListener("change", function () {
    document.getElementById("editTenure").disabled = this.value !== "Package";
    if (this.value !== "Package") {
      document.getElementById("editTenure").value = '';
    }
  });

    document.getElementById("editStatus").addEventListener("change", function() {
    const status = this.value;
    const packageSelect = document.getElementById("editPackage");
    const tenureInput = document.getElementById("editTenure");
    
    if (status === 'New Stock' || status === 'Available') {
      packageSelect.value = 'None';
      tenureInput.disabled = true;
      tenureInput.value = '';
    }
  });

  const today = new Date().toISOString().split("T")[0];
  const editDateInInput = row.cells[6].querySelector("#editDateIn");
  if (editDateInInput) {
    editDateInInput.setAttribute("max", today);
    editDateInInput.addEventListener("input", function () {
      if (this.value > today) {
        this.value = today;
        displayFlashMessage("Future dates are not allowed for Purchase Date.", "warning");
      }
    });
  }
}

function validateIMEI(input) {
  let imei = input.value;
  if (!/^\d{0,15}$/.test(imei)) {
    input.value = imei.slice(0, 15); 
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

  if (imeiValue.length !== 15 || isNaN(imeiValue)) {
    displayFlashMessage("IMEI must be exactly 15 digits and numeric.", "warning");
    return;
  }
  if (dateIn > today) {
    displayFlashMessage("Future dates are not allowed for Purchase Date.", "warning");
    return;
  }
  if (packageValue === "Package" && tenureValue.trim() === "") {
    displayFlashMessage("Tenure is required when Package is selected.", "warning");
    return;
  }

  let username = localStorage.getItem('username') || getCookie('username') || 'Unknown';
  let now = new Date();
  let lastEditedDate = now.toLocaleString();

  const updatedData = {
    IMEI: imeiValue,
    GLNumber: glNumberValue || null,
    DeviceModel: deviceModel,
    DeviceMake: deviceMake,
    DateIn: dateIn,
    Warranty: warranty,
    OutwardTo: outwardTo,
    Package: packageValue,
    Tenure: tenureValue || null,
    Status: status,
    LastEditedBy: username,
    LastEditedDate: lastEditedDate
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
        location.reload();
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
