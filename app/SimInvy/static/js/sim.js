document.getElementById("manualEntryBtn").addEventListener("click", function() {
  document.getElementById("manualEntryModal").classList.remove("hidden");
  document.getElementById("MobileNumber").focus();
});

document.getElementById("cancelBtn").addEventListener("click", function() {
  document.getElementById("manualEntryModal").classList.add("hidden");
});

document.getElementById("uploadBtn").addEventListener("click", function() {
  document.getElementById("uploadModal").classList.remove("hidden");
});

document.getElementById("uploadForm").addEventListener("submit", function () {
  document.querySelector(".preloader").style.display = "block";
});

document.querySelectorAll(".close-modal").forEach(closeBtn => {
  closeBtn.addEventListener("click", function() {
    this.closest(".modal").classList.add("hidden");
  });
});

window.addEventListener("click", function(event) {
  if (event.target.classList.contains("modal")) {
    event.target.classList.add("hidden");
  }
});

document
  .getElementById("downloadExcelBtn")
  .addEventListener("click", function () {
    window.location.href = "/simInvy/download_excel";
  });

document.addEventListener("DOMContentLoaded", function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const formattedToday = today.toISOString().split("T")[0];
  const dateInInput = document.getElementById("DateIn");
  const dateOutInput = document.getElementById("DateOut");

  const manualEntryBtn = document.getElementById("manualEntryBtn");
  const manualEntryModal = document.getElementById("manualEntryModal");
  const uploadBtn = document.getElementById("uploadBtn");
  const uploadModal = document.getElementById("uploadModal");
  const closeModalButtons = document.querySelectorAll(".close-modal");
  const cancelBtn = document.getElementById("cancelBtn");

  // Open Manual Entry Modal
  manualEntryBtn.addEventListener("click", function() {
    manualEntryModal.style.display = "block";
    document.getElementById("MobileNumber").focus();
  });

  // Open Upload Modal
  uploadBtn.addEventListener("click", function() {
    uploadModal.style.display = "block";
  });

  // Close modals when clicking X
  closeModalButtons.forEach(button => {
    button.addEventListener("click", function() {
      this.closest(".modal").style.display = "none";
    });
  });

  // Close modals when clicking outside
  window.addEventListener("click", function(event) {
    if (event.target.classList.contains("modal")) {
      event.target.style.display = "none";
    }
  });

  // Close Manual Entry Modal with Cancel button
  cancelBtn.addEventListener("click", function() {
    manualEntryModal.style.display = "none";
  });

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
        tableBody.innerHTML = '<tr><td colspan="12" class="no-results">No SIMs found with this status</td></tr>';
        return;
      }
      
      data.forEach(sim => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', sim._id);
        row.className = sim.status.toLowerCase();
        
        row.innerHTML = `
          <td>${sim.MobileNumber}</td>          <!-- Column 0 -->
          <td>${sim.SimNumber}</td>            <!-- Column 1 -->
          <td>${sim.IMEI || 'N/A'}</td>        <!-- Column 2 -->
          <td>${sim.status}</td>               <!-- Column 3 -->
          <td>${sim.isActive ? 'Active' : 'Inactive'}</td> <!-- Column 4 -->
          <td>${sim.statusDate || ''}</td>     <!-- Column 5 -->
          <td>${sim.reactivationDate || ''}</td> <!-- Column 6 -->
          <td>${sim.DateIn || ''}</td>         <!-- Column 7 -->
          <td>${sim.DateOut || ''}</td>        <!-- Column 8 -->
          <td>${sim.Vendor || ''}</td>         <!-- Column 9 -->
          <td>${sim.lastEditedBy || 'N/A'}</td> <!-- Column 10 -->
          <td>                                  <!-- Column 11 (Actions) -->
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

  const currentlyEditing = document.querySelector('tr.editing');
  if (currentlyEditing) {
    const editingId = currentlyEditing.getAttribute('data-id');
    cancelEdit(editingId);
  }

  const row = document.querySelector(`tr[data-id='${simId}']`);

  for (let i = 0; i < 11; i++) {
    row.setAttribute(`data-original-col-${i}`, row.cells[i].innerText);
  }

  // Store original values (columns 0-10)
  row.setAttribute("data-original-mobile", row.cells[0].innerText);
  row.setAttribute("data-original-sim", row.cells[1].innerText);
  row.setAttribute("data-original-imei", row.cells[2].innerText);
  row.setAttribute("data-original-status", row.cells[3].innerText);
  row.setAttribute("data-original-active", row.cells[4].innerText === 'Active');
  row.setAttribute("data-original-status-date", row.cells[5].innerText);
  row.setAttribute("data-original-reactivation-date", row.cells[6].innerText);
  row.setAttribute("data-original-date-in", row.cells[7].innerText);
  row.setAttribute("data-original-date-out", row.cells[8].innerText);
  row.setAttribute("data-original-vendor", row.cells[9].innerText);
  row.setAttribute("data-original-editor", row.cells[10].innerText);

  row.classList.add('editing');

  row.setAttribute("data-original-mobile", row.cells[0].innerText);

  // Status dropdown options
  const statusOptions = ['Available', 'Allocated', 'SafeCustody', 'Suspended']
    .map(opt => `<option value="${opt}" ${row.cells[3].innerText === opt ? 'selected' : ''}>${opt}</option>`)
    .join('');

  // Replace row data with input fields (columns 0-9)
  row.cells[0].innerHTML = `<input type="text" value="${row.getAttribute("data-original-mobile")}" style="min-width: 120px"/>`;
  row.cells[1].innerHTML = `<input type="text" value="${row.getAttribute("data-original-sim")}" style="min-width: 120px"/>`;
  row.cells[2].innerHTML = `<span>${row.getAttribute("data-original-imei") || 'N/A'}</span>`;
  row.cells[3].innerHTML = `
    <select id="editStatus">
      ${statusOptions}
    </select>
  `;
  row.cells[4].innerHTML = `
    <select id="editActive">
      <option value="true" ${row.getAttribute("data-original-active") === 'true' ? 'selected' : ''}>Active</option>
      <option value="false" ${row.getAttribute("data-original-active") === 'false' ? 'selected' : ''}>Inactive</option>
    </select>
  `;
  row.cells[5].innerHTML = `<input type="date" value="${formatDateForInput(row.getAttribute("data-original-status-date"))}" id="editStatusDate" />`;
  row.cells[6].innerHTML = `<input type="date" value="${formatDateForInput(row.getAttribute("data-original-reactivation-date"))}" id="editReactivationDate" />`;
  row.cells[7].innerHTML = `<input type="date" value="${formatDateForInput(row.getAttribute("data-original-date-in"))}" />`;
  row.cells[8].innerHTML = `<input type="date" value="${formatDateForInput(row.getAttribute("data-original-date-out"))}" />`;
  row.cells[9].innerHTML = `<input type="text" value="${row.getAttribute("data-original-vendor")}" />`;

  // Last Edited By column (column 10)
  row.cells[10].innerHTML = `
    <input type="text" 
           value="${row.getAttribute("data-original-editor") || ''}" 
           required 
           placeholder="Your name"
           style="width: 100%"
    />
`;

  // Actions column (column 11) - ONLY place buttons here
  row.cells[11].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveSim('${simId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit('${simId}')">❌</button>
  `;

  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Add event listener for status change to handle SafeCustody/Suspended fields
  const statusSelect = row.cells[3].querySelector('#editStatus');
  const statusDateInput = row.cells[5].querySelector('#editStatusDate');
  const reactivationDateInput = row.cells[6].querySelector('#editReactivationDate');
  
  // Set initial visibility
  updateStatusFieldsVisibility(statusSelect.value, statusDateInput, reactivationDateInput);
  
  statusSelect.addEventListener('change', function() {
    updateStatusFieldsVisibility(this.value, statusDateInput, reactivationDateInput);
  });
}

function updateStatusFieldsVisibility(status, statusDateInput, reactivationDateInput) {
  if (status === 'SafeCustody' || status === 'Suspended') {
    statusDateInput.style.display = 'block';
    if (status === 'SafeCustody') {
      reactivationDateInput.style.display = 'block';
      // Calculate 90 days from now for reactivation date
      const today = new Date();
      const reactivationDate = new Date();
      reactivationDate.setDate(today.getDate() + 90);
      reactivationDateInput.value = reactivationDate.toISOString().split('T')[0];
    } else {
      reactivationDateInput.style.display = 'none';
    }
  } else {
    statusDateInput.style.display = 'none';
    reactivationDateInput.style.display = 'none';
  }
}

function cancelEdit(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);

  if (row) {
    row.classList.remove('editing');

  // Restore original values from stored attributes
  row.cells[0].innerText = row.getAttribute("data-original-mobile");
  row.cells[1].innerText = row.getAttribute("data-original-sim");
  row.cells[2].innerText = row.getAttribute("data-original-imei") || 'N/A';
  row.cells[3].innerText = row.getAttribute("data-original-status");
  row.cells[4].innerText = row.getAttribute("data-original-active") === 'true' ? 'Active' : 'Inactive';
  row.cells[5].innerText = row.getAttribute("data-original-status-date");
  row.cells[6].innerText = row.getAttribute("data-original-reactivation-date");
  row.cells[7].innerText = row.getAttribute("data-original-date-in");
  row.cells[8].innerText = row.getAttribute("data-original-date-out");
  row.cells[9].innerText = row.getAttribute("data-original-vendor");
  row.cells[10].innerText = row.getAttribute("data-original-editor") || 'N/A';

  row.cells[11].innerHTML = `
    <button class="icon-btn edit-icon" onclick="editSim('${simId}')">✏️</button>
  `;
  }
}

function saveSim(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);

  if (row) {
    row.classList.remove('editing');

  // Get updated data from input fields
  const updatedData = {
    MobileNumber: row.cells[0].querySelector("input").value.trim(),
    SimNumber: row.cells[1].querySelector("input").value.trim(),
    status: row.cells[3].querySelector("select").value,
    isActive: row.cells[4].querySelector("select").value,
    statusDate: row.cells[5].querySelector("input")?.value.trim() || null,
    reactivationDate: row.cells[6].querySelector("input")?.value.trim() || null,
    DateIn: row.cells[7].querySelector("input").value.trim(),
    DateOut: row.cells[8].querySelector("input").value.trim(),
    Vendor: row.cells[9].querySelector("input").value.trim(),
    lastEditedBy: row.cells[10].querySelector("input").value.trim()
  };

  // Validation logic
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
  if (!updatedData.lastEditedBy) {
    errors.push("Editor name is required.");
  }

  if (errors.length > 0) {
    alert(errors.join("\n"));
    return;
  }

  // Send the updated data to the server
  fetch(`/simInvy/edit_sim/${simId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCookie("csrf_access_token"),
    },
    body: JSON.stringify(updatedData),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then(err => { throw err; });
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        // Update the table row with the new values
        row.cells[0].innerText = updatedData.MobileNumber;
        row.cells[1].innerText = updatedData.SimNumber;
        row.cells[2].innerText = row.getAttribute("data-original-imei") || 'N/A';
        row.cells[3].innerText = updatedData.status;
        row.cells[4].innerText = updatedData.isActive === 'true' ? 'Active' : 'Inactive';
        row.cells[5].innerText = updatedData.statusDate || '';
        row.cells[6].innerText = updatedData.reactivationDate || '';
        row.cells[7].innerText = updatedData.DateIn;
        row.cells[8].innerText = updatedData.DateOut || '';
        row.cells[9].innerText = updatedData.Vendor;
        row.cells[10].innerText = updatedData.lastEditedBy;

        row.cells[11].innerHTML = `
          <button class="icon-btn edit-icon" onclick="editSim('${simId}')">✏️</button>
        `;
        
        row.className = updatedData.status.toLowerCase();
      } else {
        alert(data.message || "Failed to save the changes. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error updating SIM:", error);
      alert(error.message || "An error occurred. Please try again.");
    });
}
}
