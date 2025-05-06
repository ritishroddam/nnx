document
  .getElementById("manualEntryBtn")
  .addEventListener("click", function () {
    document.getElementById("manualEntryForm").classList.toggle("hidden");
    document.getElementById("MobileNumber").focus();
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
    window.location.href = "/simInvy/download_excel";
  });

document.addEventListener("DOMContentLoaded", function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const formattedToday = today.toISOString().split("T")[0];
  const dateInInput = document.getElementById("DateIn");
  const dateOutInput = document.getElementById("DateOut");

  dateInInput.setAttribute("max", formattedToday);
  dateOutInput.setAttribute("max", formattedToday);

  document
    .getElementById("manualForm")
    .addEventListener("submit", function (event) {
      let isValid = true;

      var mobileNumber = document.getElementById("MobileNumber").value.trim();
      var simNumber = document.getElementById("SimNumber").value.trim();
      var mobileError = document.getElementById("mobileError");
      var simError = document.getElementById("simError");

      var dateInValue = dateInInput.value.trim();
      var dateOutValue = dateOutInput.value.trim();

      var indianMobileRegex = /^[6-9]\d{9}$/;

      function isValidDate(dateStr) {
        const dateObj = new Date(dateStr);
        return !isNaN(dateObj.getTime());
      }

      function formatDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split("-");
        if (parts.length === 3 && parts[2].length === 4) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
      }

      dateInValue = formatDate(dateInValue);
      dateOutValue = formatDate(dateOutValue);

      const dateInObj = isValidDate(dateInValue) ? new Date(dateInValue) : null;
      const dateOutObj = isValidDate(dateOutValue)
        ? new Date(dateOutValue)
        : null;

      // Validate DateIn (should not be in the future)
      if (dateInObj && dateInObj > today) {
        alert("Future dates are not allowed for 'Date In'.");
        isValid = false;
      }

      // Validate DateOut (should not be in the future)
      if (dateOutObj && dateOutObj > today) {
        alert("Future dates are not allowed for 'Date Out'.");
        isValid = false;
      }

      // Ensure DateIn is earlier than DateOut
      if (dateInObj && dateOutObj && dateInObj >= dateOutObj) {
        alert("'Date In' must be earlier than 'Date Out'.");
        isValid = false;
      }

      // Validate Mobile Number
      if (!indianMobileRegex.test(mobileNumber)) {
        mobileError.textContent =
          "Please enter a valid 10-digit Indian mobile number.";
        mobileError.classList.remove("hidden");
        isValid = false;
      } else {
        mobileError.classList.add("hidden");
      }

      // Validate SIM Number (must be 20 digits)
      if (simNumber.length !== 20 || isNaN(simNumber)) {
        simError.textContent = "SIM Number must be exactly 20 digits.";
        simError.classList.remove("hidden");
        isValid = false;
      } else {
        simError.classList.add("hidden");
      }

      // Prevent form submission if any validation fails
      if (!isValid) {
        event.preventDefault();
      }
    });

  // Prevent manual future date entry
  function preventManualFutureDates(event) {
    const input = event.target;
    if (input.value) {
      const enteredDate = new Date(input.value);
      if (enteredDate > today) {
        alert("Future dates are not allowed.");
        input.value = formattedToday; // Reset to today
      }
    }
  }

  dateInInput.addEventListener("change", preventManualFutureDates);
  dateOutInput.addEventListener("change", preventManualFutureDates);
});

function filterSimsByStatus() {
  const status = document.getElementById('statusFilter').value;
  
  fetch(`/simInvy/get_sims_by_status/${status}`)
    .then(response => response.json())
    .then(data => {
      const tableBody = document.getElementById('simTable');
      tableBody.innerHTML = '';
      
      if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="12">No SIMs found</td></tr>';
        return;
      }
      
      data.forEach(sim => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', sim._id);
        row.className = sim.status.toLowerCase();
        
        row.innerHTML = `
          <td>${sim.MobileNumber || ''}</td>
          <td>${sim.SimNumber || ''}</td>
          <td>${sim.IMEI || 'N/A'}</td>
          <td>${sim.status || ''}</td>
          <td>${sim.isActive ? 'Active' : 'Inactive'}</td>
          <td>${sim.statusDate || ''}</td>
          <td>${sim.reactivationDate || ''}</td>
          <td>${sim.DateIn || ''}</td>
          <td>${sim.DateOut || ''}</td>
          <td>${sim.Vendor || ''}</td>
          <td>${sim.editedBy || ''}</td>
          <td>
            <button class="icon-btn edit-icon" onclick="editSim('${sim._id}')">✏️</button>
          </td>
        `;
        
        tableBody.appendChild(row);
      });
    })
    .catch(error => {
      console.error('Error:', error);
      const errorBox = document.getElementById('errorBox');
      errorBox.textContent = `Error: ${error.message}`;
      errorBox.classList.remove('hidden');
      setTimeout(() => errorBox.classList.add('hidden'), 5000);
    });
}

// Add this helper function
function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  return dateStr;
}

function editSim(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);
  
  if (!row || !row.cells || row.cells.length < 12) {
    console.error("Row or cells not found, or incorrect number of columns");
    return;
  }

  // Store original values with proper null checks
  const getCellText = (index) => row.cells[index] ? row.cells[index].innerText : '';
  
  row.setAttribute("data-original-mobile", getCellText(0));
  row.setAttribute("data-original-sim", getCellText(1));
  row.setAttribute("data-original-imei", getCellText(2));
  row.setAttribute("data-original-status", getCellText(3));
  row.setAttribute("data-original-active", getCellText(4) === 'Active');
  row.setAttribute("data-original-status-date", getCellText(5));
  row.setAttribute("data-original-reactivation-date", getCellText(6));
  row.setAttribute("data-original-date-in", getCellText(7));
  row.setAttribute("data-original-date-out", getCellText(8));
  row.setAttribute("data-original-vendor", getCellText(9));
  row.setAttribute("data-original-edited-by", getCellText(10));

  // Status dropdown options
  const currentStatus = getCellText(3);
  const statusOptions = ['Available', 'Allocated', 'SafeCustody', 'Suspended']
    .map(opt => `<option value="${opt}" ${currentStatus === opt ? 'selected' : ''}>${opt}</option>`)
    .join('');

  // Replace row data with input fields
  const createInput = (value, type = 'text', cls = 'form-input') => 
    `<input type="${type}" value="${value}" class="${cls}" />`;

  row.cells[0].innerHTML = createInput(getCellText(0));
  row.cells[1].innerHTML = createInput(getCellText(1));
  row.cells[2].innerHTML = `<span>${getCellText(2)}</span>`;
  row.cells[3].innerHTML = `<select class="form-select">${statusOptions}</select>`;
  row.cells[4].innerHTML = `
    <select class="form-select">
      <option value="true" ${getCellText(4) === 'Active' ? 'selected' : ''}>Active</option>
      <option value="false" ${getCellText(4) === 'Inactive' ? 'selected' : ''}>Inactive</option>
    </select>
  `;
  row.cells[5].innerHTML = createInput(getCellText(5), 'date');
  row.cells[6].innerHTML = createInput(getCellText(6), 'date');
  row.cells[7].innerHTML = createInput(getCellText(7), 'date');
  row.cells[8].innerHTML = createInput(getCellText(8), 'date');
  row.cells[9].innerHTML = createInput(getCellText(9));
  row.cells[10].innerHTML = createInput(getCellText(10));

  row.cells[11].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveSim('${simId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit('${simId}')">❌</button>
  `;

  // Set up status change handler
  const statusSelect = row.cells[3].querySelector('select');
  const statusDateInput = row.cells[5].querySelector('input');
  const reactivationDateInput = row.cells[6].querySelector('input');

  const updateDateVisibility = () => {
    if (statusSelect.value === 'SafeCustody' || statusSelect.value === 'Suspended') {
      statusDateInput.style.display = 'block';
      if (statusSelect.value === 'SafeCustody') {
        reactivationDateInput.style.display = 'block';
        // Set reactivation date to 90 days from now
        const today = new Date();
        const reactivationDate = new Date(today);
        reactivationDate.setDate(today.getDate() + 90);
        reactivationDateInput.value = reactivationDate.toISOString().split('T')[0];
      } else {
        reactivationDateInput.style.display = 'none';
      }
    } else {
      statusDateInput.style.display = 'none';
      reactivationDateInput.style.display = 'none';
    }
  };

  // Initialize visibility
  updateDateVisibility();
  
  // Add change listener
  statusSelect.addEventListener('change', updateDateVisibility);
}

function cancelEdit(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);

  // Restore original values
  row.cells[0].innerText = row.getAttribute("data-original-mobile");
  row.cells[1].innerText = row.getAttribute("data-original-sim");
  row.cells[2].innerText = row.getAttribute("data-original-imei");
  row.cells[3].innerText = row.getAttribute("data-original-status");
  row.cells[4].innerText = row.getAttribute("data-original-active") === 'true' ? 'Active' : 'Inactive';
  row.cells[5].innerText = row.getAttribute("data-original-status-date");
  row.cells[6].innerText = row.getAttribute("data-original-reactivation-date");
  row.cells[7].innerText = row.getAttribute("data-original-date-in");
  row.cells[8].innerText = row.getAttribute("data-original-date-out");
  row.cells[9].innerText = row.getAttribute("data-original-vendor");
  row.cells[10].innerText = row.getAttribute("data-original-edited-by") || '';

  // Restore action button
  row.cells[11].innerHTML = `
    <button class="icon-btn edit-icon" onclick="editSim('${simId}')">✏️</button>
  `;
}

function saveSim(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);

  // Get updated data from input fields
  const updatedData = {
    MobileNumber: row.cells[0].querySelector("input").value.trim(),
    SimNumber: row.cells[1].querySelector("input").value.trim(),
    status: row.cells[3].querySelector("select").value,
    isActive: row.cells[4].querySelector("select").value === 'true',
    statusDate: row.cells[5].querySelector("input")?.value.trim() || null,
    reactivationDate: row.cells[6].querySelector("input")?.value.trim() || null,
    DateIn: row.cells[7].querySelector("input").value.trim(),
    DateOut: row.cells[8].querySelector("input").value.trim(),
    Vendor: row.cells[9].querySelector("input").value.trim(),
    editedBy: row.cells[10].querySelector("input").value.trim()
  };

  // Validation logic (add validation for editedBy if needed)
  const errors = [];
  const indianMobileRegex = /^[6-9]\d{9}$/;

  if (!indianMobileRegex.test(updatedData.MobileNumber)) {
    errors.push("Invalid Mobile Number: Must be a valid 10-digit Indian number.");
  }
  if (updatedData.SimNumber.length !== 20 || isNaN(updatedData.SimNumber)) {
    errors.push("Invalid SIM Number: Must be exactly 20 digits.");
  }
  if (!updatedData.DateIn) {
    errors.push("Date In is required.");
  }
  if (!updatedData.Vendor) {
    errors.push("Vendor is required.");
  }
  if (updatedData.status === 'SafeCustody' && !updatedData.statusDate) {
    errors.push("Status Date is required for Safe Custody.");
  }
  if (updatedData.status === 'Suspended' && !updatedData.statusDate) {
    errors.push("Status Date is required for Suspended.");
  }

  if (errors.length > 0) {
    alert(errors.join("\n"));
    return;
  }

  // Send the updated data to the server
  fetch(`/simInvy/update_sim_status/${simId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCookie("csrf_access_token"),
    },
    body: JSON.stringify(updatedData),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Update the table row with the new values
        row.cells[0].innerText = updatedData.MobileNumber;
        row.cells[1].innerText = updatedData.SimNumber;
        row.cells[2].innerText = row.getAttribute("data-original-imei"); // Keep original IMEI
        row.cells[3].innerText = updatedData.status;
        row.cells[4].innerText = updatedData.isActive ? 'Active' : 'Inactive';
        row.cells[5].innerText = updatedData.statusDate || '';
        row.cells[6].innerText = updatedData.reactivationDate || '';
        row.cells[7].innerText = updatedData.DateIn;
        row.cells[8].innerText = updatedData.DateOut || '';
        row.cells[9].innerText = updatedData.Vendor;
        row.cells[10].innerText = updatedData.editedBy || '';

        // Restore the action button
        row.cells[11].innerHTML = `
          <button class="icon-btn edit-icon" onclick="editSim('${simId}')">✏️</button>
        `;
        
        // Apply status class to row
        row.className = updatedData.status.toLowerCase();
      } else {
        alert("Failed to save the changes. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error updating SIM:", error);
      alert("An error occurred. Please try again.");
    });
}

