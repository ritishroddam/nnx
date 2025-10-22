let imeiData = []; 

async function fetchIMEIData() {
  try {
    const response = await fetch("/vehicleDetails/get_device_inventory");
    if (!response.ok) throw new Error("Failed to fetch IMEI data");

    imeiData = await response.json();
    populateDropdown(); 
  } catch (error) {
    console.error("Error fetching IMEI data:", error);
    alert("Unable to load IMEI data. Please try again later.");
  }
}

function populateDropdown() {
  let select = document.getElementById("imeiDropdown");

  let defaultOption = document.createElement("option");
  defaultOption.textContent = "Select IMEI";
  defaultOption.value = "";
  defaultOption.disabled = true;
  defaultOption.selected = true;
  select.appendChild(defaultOption);

  imeiData.forEach((device) => {
    let option = document.createElement("option");
    option.value = device.imei;
    option.textContent = device.imei;
    select.appendChild(option);
  });

  $("#imeiDropdown").selectize();
}

function filterTableByCompany(selectedCompany) {
    const table = document.querySelector('.vehicle-table');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const companyCell = row.querySelector('td:nth-child(2)'); 
        if (!companyCell) return;
        
        const companyName = companyCell.textContent.trim();
        row.style.display = (!selectedCompany || companyName === selectedCompany) 
            ? '' 
            : 'none';
    });
}

function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const table = document.querySelector('.vehicle-table');
    
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const licensePlate = row.cells[0].textContent.toLowerCase();
        const imei = row.cells[2].textContent.toLowerCase();
        const sim = row.cells[3].textContent.toLowerCase();
        
        const matchesSearch = 
            licensePlate.includes(searchTerm) || 
            imei.includes(searchTerm) || 
            sim.includes(searchTerm);
            
        row.style.display = matchesSearch ? '' : 'none';
    });
}

let currentPage = 1;
const ROWS_PER_PAGE = 100;
let totalRows = 0;
let currentRowsPerPage = 100;
let currentCompanyFilter = '';       // NEW: current company filter
let currentSearchQuery = '';         // NEW: current search query

// Add this function to handle pagination controls
function renderPaginationControls(totalRows, currentPage, rowsPerPage) {
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginationDiv = document.getElementById('vehiclePagination');
  if (!paginationDiv) return;
  
  if (totalPages <= 1) {
    paginationDiv.innerHTML = '';
    return;
  }

  // Calculate range for current page
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
          <button class="pagination-nav-btn" id="vehiclePrevPage" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="pagination-nav-icon">‹</span>
            Previous
          </button>
          <button class="pagination-nav-btn" id="vehicleNextPage" ${currentPage === totalPages ? 'disabled' : ''}>
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

  // Add event listeners
  document.getElementById('rowsPerPageSelect').addEventListener('change', function() {
    const newRowsPerPage = parseInt(this.value);
    fetchAndRenderVehicles(1, newRowsPerPage, currentCompanyFilter, currentSearchQuery);
  });

  // Previous button
  document.getElementById('vehiclePrevPage').onclick = function() {
    if (currentPage > 1) fetchAndRenderVehicles(currentPage - 1, rowsPerPage, currentCompanyFilter, currentSearchQuery);
  };

  // Next button
  document.getElementById('vehicleNextPage').onclick = function() {
    if (currentPage < totalPages) fetchAndRenderVehicles(currentPage + 1, rowsPerPage, currentCompanyFilter, currentSearchQuery);
  };

  // Add go to page functionality
  document.getElementById('goToPageBtn').onclick = function() {
    const pageInput = document.getElementById('goToPageInput');
    const targetPage = parseInt(pageInput.value);
    
    if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
      fetchAndRenderVehicles(targetPage, rowsPerPage, currentCompanyFilter, currentSearchQuery);
    } else {
      alert(`Please enter a valid page number between 1 and ${totalPages}`);
      pageInput.value = currentPage;
    }
  };

  // Allow Enter key in go to page input
  document.getElementById('goToPageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('goToPageBtn').click();
    }
  });

  // Validate input on blur
  document.getElementById('goToPageInput').addEventListener('blur', function() {
    const value = parseInt(this.value);
    if (!value || value < 1) {
      this.value = 1;
    } else if (value > totalPages) {
      this.value = totalPages;
    }
  });
}

// Replace fetchAndRenderVehicles with this updated version
async function fetchAndRenderVehicles(page = 1, rowsPerPage = currentRowsPerPage, company = currentCompanyFilter, query = currentSearchQuery) {
  try {
    currentRowsPerPage = rowsPerPage;
    // treat explicit 'All' as no filter
    currentCompanyFilter = (company === 'All' ? '' : (company || ''));
    currentSearchQuery = query || '';

    let url = `/vehicleDetails/get_vehicles_paginated?page=${page}&per_page=${rowsPerPage}`;
    if (currentCompanyFilter && currentCompanyFilter.trim() !== '') {
      url += `&company=${encodeURIComponent(currentCompanyFilter)}`;
    }
    if (currentSearchQuery && currentSearchQuery.trim() !== '') {
      url += `&query=${encodeURIComponent(currentSearchQuery)}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-CSRF-TOKEN": getCookie ? getCookie("csrf_access_token") : "",
        "Accept": "application/json"
      },
      credentials: "include"
    });

    if (!response.ok) {
      // improved error parsing: try JSON then text
      const text = await response.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch(e) { parsed = null; }
      const serverMessage = (parsed && parsed.error) ? parsed.error : text || `HTTP ${response.status}`;
      console.error("Server error from get_vehicles_paginated:", serverMessage);
      throw new Error(serverMessage);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    totalRows = data.total || 0;
    currentPage = data.page || page;

    document.getElementById('totalVehiclesCount').textContent = totalRows;

    renderVehicleTable(data.vehicles || []);
    renderPaginationControls(totalRows, currentPage, rowsPerPage);
  } catch (err) {
    console.error("Error loading vehicles:", err);
    const tableBody = document.querySelector('.vehicle-table tbody');
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="20">Failed to load data</td></tr>`;
    }
  }
}

// Add this function to render the vehicle table
function renderVehicleTable(vehicles) {
  const tableBody = document.querySelector('.vehicle-table tbody');
  if (!tableBody) {
    console.error('Vehicle table body not found');
    return;
  }
  
  tableBody.innerHTML = '';
  
  if (!vehicles || vehicles.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="20">No vehicles found</td></tr>';
    return;
  }
  
  vehicles.forEach(vehicle => {
    const row = document.createElement('tr');
    row.setAttribute('data-id', vehicle._id);
    row.innerHTML = `
      <td>${vehicle.LicensePlateNumber || ''}</td>
      <td>${vehicle.CompanyName || ''}</td>
      <td>${vehicle.IMEI || ''}</td>
      <td>${vehicle.SIM || ''}</td>
      <td>${vehicle.VehicleType ? vehicle.VehicleType.charAt(0).toUpperCase() + vehicle.VehicleType.slice(1) : ''}</td>
      <td>${vehicle.NumberOfSeatsContainer || ''}</td>
      <td>${vehicle.VehicleModel || ''}</td>
      <td>${vehicle.VehicleMake || ''}</td>
      <td>${vehicle.YearOfManufacture || ''}</td>
      <td>${vehicle.DateOfPurchase || ''}</td>
      <td>${vehicle.InsuranceNumber || ''}</td>
      <td>${vehicle.InsuranceExpiry || ''}</td>
      <td>${vehicle.DriverName || ''}</td>
      <td>${vehicle.CurrentStatus ? vehicle.CurrentStatus.charAt(0).toUpperCase() + vehicle.CurrentStatus.slice(1) : ''}</td>
      <td>${vehicle.Location || ''}</td>
      <td>${vehicle.OdometerReading || ''}</td>
      <td>${vehicle.ServiceDueDate || ''}</td>
      <td>${vehicle.slowSpeed || ''}</td>
      <td>${vehicle.normalSpeed || ''}</td>
      <td>
        <button class="icon-btn edit-icon" onclick="editVehicle('${vehicle._id}')">✏️</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", function() {
    $("#companyFilter").selectize({
    placeholder: "Search Companies",
    searchField: "text",
    create: false,
  });

  fetchIMEIData();
  fetchSIMData();
  fetchCompanies();
  fetchCities();
  fetchAndRenderVehicles(1, 100);

  const manualEntryBtn = document.getElementById("manualEntryBtn");
  if (manualEntryBtn) {
    manualEntryBtn.addEventListener("click", function(e) {
      e.preventDefault();
      document.getElementById("manualEntryModal").classList.remove("hidden");
      document.getElementById("LicensePlateNumber")?.focus();
    });
  }

  const uploadBtn = document.getElementById("uploadBtn");
  if (uploadBtn) {
    uploadBtn.addEventListener("click", function(e) {
      e.preventDefault();
      document.getElementById("uploadModal").classList.remove("hidden");
    });
  }
  
const companyFilter = document.getElementById('companyFilter');
    
    if (companyFilter) {
        companyFilter.addEventListener('change', function() {
            const selectedCompany = this.value.toLowerCase();
            console.log("Filtering by company:", selectedCompany || "All Companies");
            
            const tableRows = document.querySelectorAll('.vehicle-table tbody tr');
            tableRows.forEach(row => {
                const companyNameCell = row.cells[1];
                const rowCompanyName = companyNameCell.textContent.trim().toLowerCase();
                
                console.log("Checking row with company:", rowCompanyName);
                
                if (!selectedCompany || rowCompanyName === selectedCompany) {
                    row.style.display = '';
                    console.log("Showing row");
                } else {
                    row.style.display = 'none';
                    console.log("Hiding row");
                }
            });
        });
        
        companyFilter.dispatchEvent(new Event('change'));
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

let allSimsData = [];
let currentPage = 1;
const ROWS_PER_PAGE = 100;
let totalRows = 0;
let currentFilter = 'All';
let currentSearchQuery = '';

document.getElementById("manualEntryBtn").addEventListener("click", function() {
  document.body.classList.add("modal-open");
  document.getElementById("manualEntryModal").classList.remove("hidden");
});

document.getElementById("uploadBtn").addEventListener("click", function() {
  document.body.classList.add("modal-open");
  document.getElementById("uploadModal").classList.remove("hidden");
});

document.querySelectorAll(".close-modal").forEach(closeBtn => {
  closeBtn.addEventListener("click", function() {
    document.body.classList.remove("modal-open");
    this.closest(".modal").classList.add("hidden");
  });
});

window.addEventListener("click", function(event) {
  if (event.target.classList.contains("modal")) {
    document.body.classList.remove("modal-open");
    event.target.classList.add("hidden");
  }
});

  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function() {
      document.getElementById("manualEntryModal").classList.add("hidden");
    });
  }

  document.getElementById("downloadExcelBtn").addEventListener("click", function(e) {
    e.preventDefault();
    fetch("/vehicleDetails/download_excel")
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Vehicle_Inventory.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      });
  });
});

function refreshVehicleCount() {
  fetchAndRenderVehicles(currentPage, currentRowsPerPage);
}

function editVehicle(vehicleId) {
  const row = document.querySelector(`tr[data-id="${vehicleId}"]`);

  const licensePlateNumber = row.cells[0].innerText;
  const companyName = row.cells[1].innerText;
  const imei = row.cells[2].innerText;
  const sim = row.cells[3].innerText;
  const vehicleType = row.cells[4].innerText;
  const numberOfSeatsContainer = row.cells[5].innerText;
  const vehicleModel = row.cells[6].innerText;
  const vehicleMake = row.cells[7].innerText;
  const yearOfManufacture = row.cells[8].innerText;
  const dateOfPurchase = row.cells[9].innerText;
  const insuranceNumber = row.cells[10].innerText;
  const insuranceExpiryDate = row.cells[11].innerText;
  const driverName = row.cells[12].innerText;
  const currentStatus = row.cells[13].innerText;
  const location = row.cells[14].innerText;
  const odometerReading = row.cells[15].innerText;
  const serviceDueDate = row.cells[16].innerText;
  const slowSpeed = row.cells[17].innerText;
  const normalSpeed = row.cells[18].innerText;

  row.cells[0].innerHTML = `<input type="text" value="${licensePlateNumber}" data-key="license_plate_number" data-editable />`;
  row.cells[1].innerHTML = `<input type="text" value="${companyName}" data-key="company_name" data-editable />`;
  row.cells[2].innerHTML = `<input type="text" value="${imei}" data-key="imei" data-editable />`;
  row.cells[3].innerHTML = `<input type="text" value="${sim}" data-key="MobileNumber" data-editable />`;

  row.cells[4].innerHTML = `<select id="VehicleType" data-key="vehicle_type" data-editable>
    <option value="sedan" ${vehicleType === "sedan" ? "selected" : ""}>Sedan</option>
    <option value="suv" ${vehicleType === "suv" ? "selected" : ""}>SUV</option>
    <option value="van" ${vehicleType === "van" ? "selected" : ""}>Van</option>
    <option value="hatchback" ${vehicleType === "hatchback" ? "selected" : ""}>Hatchback</option>
    <option value="bus" ${vehicleType === "bus" ? "selected" : ""}>Bus</option>
    <option value="truck" ${vehicleType === "truck" ? "selected" : ""}>Truck</option>
    <option value="bike" ${vehicleType === "bike" ? "selected" : ""}>Bike</option>
  </select>`;
  const vehicleTypeSelectize = row.cells[4].querySelector("#VehicleType");
  $(vehicleTypeSelectize).selectize({
    create: false,
    sortField: "text",
    searchField: ["text"],
    dropdownParent: "body"
  });

  row.cells[5].innerHTML = `<input type="number" value="${numberOfSeatsContainer}" data-key="number_of_seats" data-editable />`;
  row.cells[6].innerHTML = `<input type="text" value="${vehicleModel}" data-key="vehicle_model" data-editable />`;
  row.cells[7].innerHTML = `<input type="text" value="${vehicleMake}" data-key="vehicle_make" data-editable />`;
  row.cells[8].innerHTML = `<input type="number" value="${yearOfManufacture}" data-key="year_of_manufacture" data-editable />`;
  row.cells[9].innerHTML = `<input type="date" value="${dateOfPurchase}" data-key="date_of_purchase" data-editable />`;
  row.cells[10].innerHTML = `<input type="text" value="${insuranceNumber}" data-key="insurance_name" data-editable />`;
  row.cells[11].innerHTML = `<input type="date" value="${insuranceExpiryDate}" data-key="insurance_expiry_date" data-editable />`;
  row.cells[12].innerHTML = `<input type="text" value="${driverName}" data-key="driver_name" data-editable />`;

  row.cells[13].innerHTML = `<select id = "currentStatus" data-key="current_status" data-editable>
    <option value="active" ${currentStatus === "active" ? "selected" : ""}>Active</option>
    <option value="inactive" ${currentStatus === "inactive" ? "selected" : ""}>Inactive</option>
  </select>`;
  const currentStatusSelectize = row.cells[13].querySelector("#currentStatus");
  $(currentStatusSelectize).selectize({
    create: false,
    sortField: "text",
    searchField: ["text"],
    dropdownParent: "body"
  });

  row.cells[14].innerHTML = `        <select id="Location" name="Location" data-editable data-key="location">
          <option value="">Select Location</option>
        </select>`;
  fetchCitiesEdit(row, location);

  row.cells[15].innerHTML = `<input type="number" value="${odometerReading}" data-key="odometer_reading" data-editable />`;
  row.cells[16].innerHTML = `<input type="date" value="${serviceDueDate}" data-key="service_due_date" data-editable />`;
  row.cells[17].innerHTML = `<input type="number" value="${slowSpeed}" data-key="slow_speed" data-editable />`;
  row.cells[18].innerHTML = `<input type="number" value="${normalSpeed}" data-key="normal_speed" data-editable />`;

  row.cells[19].innerHTML = `
    <button class="icon-btn edit-icon" onclick="saveVehicle('${vehicleId}')">💾</button>
    <button class="icon-btn delete-icon" onclick="cancelEdit('${vehicleId}')">❌</button>
  `;
}

function saveVehicle(vehicleID) {
  const row = document.querySelector(`tr[data-id="${vehicleID}"]`);

  const licensePlateNumber = row.cells[0].querySelector("input").value.trim();
  const companyName = row.cells[1].querySelector("input").value.trim();
  const imei = row.cells[2].querySelector("input").value.trim();
  const sim = row.cells[3].querySelector("input").value.trim();
  const vehicleType = row.cells[4].querySelector("select").value.trim();
  const numberOfSeatsContainer = row.cells[5].querySelector("input").value.trim();
  const vehicleModel = row.cells[6].querySelector("input").value.trim();
  const vehicleMake = row.cells[7].querySelector("input").value.trim();
  const yearOfManufacture = row.cells[8].querySelector("input").value.trim();
  const dateOfPurchase = row.cells[9].querySelector("input").value.trim();
  const insuranceNumber = row.cells[10].querySelector("input").value.trim();
  const insuranceExpiryDate = row.cells[11].querySelector("input").value.trim();
  const driverName = row.cells[12].querySelector("input").value.trim();
  const currentStatus = row.cells[13].querySelector("select").value.trim();
  const location = row.cells[14].querySelector("select").value.trim();
  const odometerReading = row.cells[15].querySelector("input").value.trim();
  const serviceDueDate = row.cells[16].querySelector("input").value.trim();
  const slowSpeed = row.cells[17].querySelector("input").value.trim();
  const normalSpeed = row.cells[18].querySelector("input").value.trim();

  const updatedData = {
    LicensePlateNumber: String(licensePlateNumber),
    CompanyName: String(companyName),
    IMEI: String(imei),
    SIM: String(sim),
    VehicleType: String(vehicleType),
    NumberOfSeatsContainer: String(numberOfSeatsContainer),
    VehicleModel: String(vehicleModel),
    VehicleMake: String(vehicleMake),
    YearOfManufacture: String(yearOfManufacture),
    DateOfPurchase: String(dateOfPurchase),
    InsuranceNumber: String(insuranceNumber),
    InsuranceExpiry: String(insuranceExpiryDate),
    DriverName: String(driverName),
    CurrentStatus: String(currentStatus),
    Location: String(location),
    OdometerReading: String(odometerReading),
    ServiceDueDate: String(serviceDueDate),
    slowSpeed: String(slowSpeed),
    normalSpeed: String(normalSpeed),
  };

  fetch(`/vehicleDetails/edit_vehicle/${vehicleID}`, {
    method: "PATCH",
    headers: { 
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCookie("csrf_access_token"),
     },
    body: JSON.stringify(updatedData),
  })
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        row.cells[0].innerHTML = licensePlateNumber;
        row.cells[1].innerHTML = companyName;
        row.cells[2].innerHTML = imei;
        row.cells[3].innerHTML = sim;
        row.cells[4].innerHTML = vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1);
        row.cells[5].innerHTML = numberOfSeatsContainer;
        row.cells[6].innerHTML = vehicleModel;
        row.cells[7].innerHTML = vehicleMake;
        row.cells[8].innerHTML = yearOfManufacture;
        row.cells[9].innerHTML = dateOfPurchase;
        row.cells[10].innerHTML = insuranceNumber;
        row.cells[11].innerHTML = insuranceExpiryDate;
        row.cells[12].innerHTML = driverName;
        row.cells[13].innerHTML = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
        row.cells[14].innerHTML = location;
        row.cells[15].innerHTML = odometerReading;
        row.cells[16].innerHTML = serviceDueDate;
        row.cells[17].innerHTML = slowSpeed;
        row.cells[18].innerHTML = normalSpeed;

        row.cells[19].innerHTML = `
          <button class="icon-btn edit-icon" onclick="editVehicle('${vehicleID}')">✏️</button>
        `;

        displayFlashMessage("Vehicle details updated successfully.", "success");
      } else {
        displayFlashMessage(`Error: ${result.message}`);
      }
    })
    .catch((error) => {
      console.error("Error saving vehicle:", error);
      displayFlashMessage("An error occurred while saving. Please try again.");
    });
}

function cancelEdit(vehicleID) {
  location.reload();
}

let simData = []; 

async function fetchSIMData() {
  try {
    const response = await fetch("/vehicleDetails/get_sim_inventory");
    if (!response.ok) throw new Error("Failed to fetch SIM data");

    simData = await response.json();
    console.log("SIM data fetched:", simData);
    populateSIMDropdown();
  } catch (error) {
    console.error("Error fetching SIM data:", error);
    alert("Unable to load SIM data. Please try again later.");
  }
}

function populateSIMDropdown() {
  let select = document.getElementById("sim-Dropdown");

  let defaultOption = document.createElement("option");
  defaultOption.textContent = "Select SIM";
  defaultOption.value = "";
  defaultOption.disabled = true;
  defaultOption.selected = true;
  select.appendChild(defaultOption);

  simData.forEach((sim) => {
    let option = document.createElement("option");
    option.value = sim.MobileNumber;
    option.textContent = sim.MobileNumber;
    select.appendChild(option);
  });

  $("#sim-Dropdown").selectize();
}

async function fetchCompanies() {
  try {
    const response = await fetch("/vehicleDetails/get_companies");
    if (!response.ok) throw new Error("Failed to fetch companies");

    const companies = await response.json();
    const companySelect = document.getElementById("CompanyName");
    companies.forEach(company => {
      const option = document.createElement("option");
      option.value = company.name;
      option.textContent = company.name;
      companySelect.appendChild(option);
    });

    $("#CompanyName").selectize({
      create: false,
      sortField: "text",
      searchField: ["text"]
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    alert("Unable to load companies. Please try again later.");
  }
}

function fetchCitiesEdit(row, location){
  fetch("/vehicleDetails/get_cities")
  .then(response => response.json())
  .then(cities => {
    const citySelect = row.cells[14].querySelector("#Location");
    cities.forEach(city => {
      const cityValue = `${city.city}, ${city.state}`;
      const option = document.createElement("option");
      option.value = cityValue;
      option.textContent = cityValue;
      citySelect.appendChild(option);
    });
    $(citySelect).selectize({
      create: false,
      sortField: "text",
      searchField: ["text"],
      dropdownParent: "body"
    });
    const selectizeInstance = $(citySelect)[0].selectize;
    selectizeInstance.setValue(location);
  });
}

async function fetchCities() {
  try {
    const response = await fetch("/vehicleDetails/get_cities");
    if (!response.ok) throw new Error("Failed to fetch cities");

    const cities = await response.json();
    const citySelect = document.getElementById("Location");
    cities.forEach(city => {
      const option = document.createElement("option");
      option.value = `${city.city}, ${city.state}`;
      option.textContent = `${city.city}, ${city.state}`;
      citySelect.appendChild(option);
    });

    $("#Location").selectize({
      create: false,
      sortField: "text",
      searchField: ["text"]
    });
  } catch (error) {
    console.error("Error fetching cities:", error);
    alert("Unable to load cities. Please try again later.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("Document loaded, fetching SIM data...");
  fetchSIMData();

  fetchCompanies();
  fetchCities();

  $("#VehicleType").selectize({
    create: false,
    sortField: "text",
    searchField: ["text"],
    onChange: function(value) {
      const numberOfSeatsContainer = document.getElementById("NumberOfSeatsContainer");
      if (value === "bus" || value === "sedan" || value === "hatchback" || value === "suv" || value === "van") {
        numberOfSeatsContainer.classList.remove("hidden");
      } else {
        numberOfSeatsContainer.classList.add("hidden");
      }
    }
  });

  document.getElementById("VehicleType").addEventListener("change", function () {
    const numberOfSeatsContainer = document.getElementById("NumberOfSeatsContainer");
    if (this.value === "bus" || this.value === "sedan" || this.value === "hatchback" || this.value === "suv" || this.value === "van") {
      numberOfSeatsContainer.classList.remove("hidden");
    } else {
      numberOfSeatsContainer.classList.add("hidden");
    }
  });
});

document.getElementById("manualForm").addEventListener("submit", async function (event) {
  event.preventDefault();
  document.querySelector(".preloader").style.display = "block";
  this.submit();
});

document.getElementById("uploadForm").addEventListener("submit", function () {
  document.querySelector(".preloader").style.display = "block";
});

// Wire company filter and search to server-side pagination
document.addEventListener("DOMContentLoaded", function() {
  const companyFilter = document.getElementById('companyFilter');
  if (companyFilter) {
    // set explicit All default
    companyFilter.value = 'All';
    companyFilter.addEventListener('change', function() {
      const selected = this.value || 'All';
      currentCompanyFilter = (selected === 'All') ? '' : selected;
      currentSearchQuery = document.getElementById('searchInput')?.value.trim() || '';
      fetchAndRenderVehicles(1, currentRowsPerPage, selected, currentSearchQuery);
    });
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    // debounce to avoid many requests
    let debounceTimer = null;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentSearchQuery = this.value.trim();
        // preserve company filter while searching
        fetchAndRenderVehicles(1, currentRowsPerPage, currentCompanyFilter, currentSearchQuery);
      }, 350);
    });
  }
});