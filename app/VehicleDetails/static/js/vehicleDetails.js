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

document.addEventListener("DOMContentLoaded", function() {
  fetchIMEIData();

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
  row.cells[3].innerHTML = `<input type="text" value="${sim}" data-key="sim_number" data-editable />`;

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
          <button class="icon-btn delete-icon" onclick="deleteVehicle('${vehicleID}')">🗑️</button>
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

function deleteVehicle(vehicleID) {
  if (confirm("Are you sure you want to delete this vehicle?")) {
    fetch(`/vehicleDetails/delete_vehicle/${vehicleID}`, {
      method: "DELETE", 
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
    })
      .then((response) => {
        if (response.ok) {
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
    option.value = sim.sim_number;
    option.textContent = sim.sim_number;
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