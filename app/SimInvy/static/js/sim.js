let allSimsData = [];
let originalTableRows = [];

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

document.addEventListener("DOMContentLoaded", function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const formattedToday = today.toISOString().split("T")[0];
  const dateInInput = document.getElementById("DateIn");
  const dateOutInput = document.getElementById("DateOut");

  const tableRows = document.querySelectorAll('#simTable tr');
    originalTableData = Array.from(tableRows).map(row => {
        return {
            element: row,
            mobile: row.cells[0].textContent.trim(),
            sim: row.cells[1].textContent.trim(),
            imei: row.cells[2].textContent.trim(),
            status: row.cells[3].textContent.trim()
        };
    });

  const tableBody = document.getElementById('simTable');
    originalTableRows = Array.from(tableBody.querySelectorAll('tr'));
    
    const searchInput = document.getElementById('simSearch');
    const clearBtn = document.getElementById('clearSearchBtn');
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        filterTable(searchTerm);
    });

  document.getElementById("manualEntryModal").classList.add("hidden");
  document.getElementById("uploadModal").classList.add("hidden");

  document.getElementById("manualEntryBtn").addEventListener("click", function() {
    document.getElementById("manualEntryModal").classList.remove("hidden");
    document.getElementById("MobileNumber").focus();
  });

  document.getElementById("uploadBtn").addEventListener("click", function() {
    document.getElementById("uploadModal").classList.remove("hidden");
  });

  setupDownloadButton();

    document.getElementById('simSearch').addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        filterTable(searchTerm);
    });

  document.querySelectorAll(".close-modal").forEach(btn => {
    btn.addEventListener("click", function() {
      this.closest(".modal").classList.add("hidden");
    });
  });

  document.getElementById("cancelBtn").addEventListener("click", function() {
    document.getElementById("manualEntryModal").classList.add("hidden");
  });

  window.addEventListener("click", function(event) {
    if (event.target.classList.contains("modal")) {
      event.target.classList.add("hidden");
    }
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
      // var dateOutValue = dateOutInput.value.trim();

      var indianMobileRegex = /^(?:[6-9]\d{9}|\d{13})$/;

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

      const dateInObj = isValidDate(dateInValue) ? new Date(dateInValue) : null;

      if (dateInObj && dateInObj > today) {
        alert("Future dates are not allowed for 'Date In'.");
        isValid = false;
      }

      if (!indianMobileRegex.test(mobileNumber)) {
        mobileError.textContent =
          "Please enter a valid 10-digit or 13-digit Indian mobile number.";
        mobileError.classList.remove("hidden");
        isValid = false;
      } else {
        mobileError.classList.add("hidden");
      }

      if (simNumber.length !== 20 || isNaN(simNumber)) {
        simError.textContent = "SIM Number must be exactly 20 digits.";
        simError.classList.remove("hidden");
        isValid = false;
      } else {
        simError.classList.add("hidden");
      }

      if (!isValid) {
        event.preventDefault();
      }
    });

  function preventManualFutureDates(event) {
    const input = event.target;
    if (input.value) {
      const enteredDate = new Date(input.value);
      if (enteredDate > today) {
        alert("Future dates are not allowed.");
        input.value = formattedToday; 
      }
    }
  }

  dateInInput.addEventListener("change", preventManualFutureDates);
  dateOutInput.addEventListener("change", preventManualFutureDates);
});

function searchSims() {
    const searchValue = document.getElementById("simSearch").value.trim().toLowerCase();
    if (!searchValue) {
        clearSearch();
        return;
    }

    const filteredSims = allSimsData.filter(sim => {
        return (
            sim.MobileNumber.toLowerCase().includes(searchValue) ||
            sim.SimNumber.toLowerCase().includes(searchValue) ||
            sim.IMEI.toLowerCase().includes(searchValue)
        );
    });

    renderSimTable(filteredSims);
}

function clearSearch() {
    document.getElementById("simSearch").value = "";
    renderSimTable(allSimsData);
}

function setupDownloadButton() {
    const downloadBtn = document.getElementById("downloadExcelBtn");
    if (!downloadBtn) return;

    downloadBtn.addEventListener("click", async function (e) {
        e.preventDefault();

        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = "Generating...";
        downloadBtn.disabled = true;

        try {
            const spinner = document.createElement('div');
            spinner.innerHTML = `
                <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px;
                    background: #333;
                    color: white;
                    border-radius: 5px;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                ">
                    <span style="margin-right: 10px;">Generating Excel file...</span>
                    <div class="spinner"></div>
                </div>
            `;
            document.body.appendChild(spinner);

            const visibleRows = Array.from(document.querySelectorAll("#simTable tr"))
                .filter(row => row.cells.length > 1 && row.style.display !== 'none');

            const simsToExport = visibleRows.map(row => ({
                MobileNumber: row.cells[0].textContent.trim(),
                SimNumber: row.cells[1].textContent.trim(),
                IMEI: row.cells[2].textContent.trim(),
                status: row.cells[3].textContent.trim(),
                isActive: row.cells[4].textContent.trim(),
                statusDate: row.cells[5].textContent.trim(),
                reactivationDate: row.cells[6].textContent.trim(),
                DateIn: row.cells[7].textContent.trim(),
                DateOut: row.cells[8].textContent.trim(),
                Vendor: row.cells[9].textContent.trim(),
                lastEditedBy: row.cells[10].textContent.trim()
            }));

            const response = await fetch("/simInvy/download_excel_filtered", {
                method: "POST",
                headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
                },
                body: JSON.stringify({ sims: simsToExport })
            });

            document.body.removeChild(spinner);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || `Server error (${response.status})`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Filtered_SIM_Inventory_' + new Date().toISOString().split('T')[0] + '.xlsx';
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);

        } catch (error) {
            console.error('Download failed:', error);

            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = `
                <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px;
                    background: #d32f2f;
                    color: white;
                    border-radius: 5px;
                    z-index: 1000;
                    max-width: 400px;
                ">
                    <strong>Download Failed</strong>
                    <div style="margin-top: 5px;">${error.message}</div>
                </div>
            `;
            document.body.appendChild(errorDiv);

            setTimeout(() => {
                document.body.removeChild(errorDiv);
            }, 5000);

        } finally {
            downloadBtn.textContent = originalText;
            downloadBtn.disabled = false;
        }
    });
}

function filterTable(searchTerm) {
    const tableBody = document.getElementById('simTable');
    
    if (!searchTerm) {
        originalTableRows.forEach(row => {
            row.style.display = '';
        });
        return;
    }

    originalTableRows.forEach(row => {
        if (row.cells.length < 3) {
            return;
        }
        
        const mobile = row.cells[0].textContent.trim().toLowerCase();
        const sim = row.cells[1].textContent.trim().toLowerCase();
        const imei = row.cells[2].textContent.trim().toLowerCase();
        
        const matches = (
            mobile.includes(searchTerm) ||
            sim.includes(searchTerm) ||
            imei.includes(searchTerm)
        );
        
        row.style.display = matches ? '' : 'none';
    });
}

function filterSimsByStatus() {
  const status = document.getElementById('statusFilter').value;
  console.log(`Fetching SIMs with status: ${status}`);
  
  const tableBody = document.getElementById('simTable');
  tableBody.innerHTML = '<tr><td colspan="12">Loading SIM data...</td></tr>';
  
  fetch(`/simInvy/get_sims_by_status/${status}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Received data:', data);
      if (data.error) {
        throw new Error(data.error);
      }
      renderSimTable(data);
    })
    .catch(error => {
      console.error('Error:', error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="12" class="error">
            Error loading data: ${error.message}
            <button onclick="filterSimsByStatus()">Retry</button>
          </td>
        </tr>
      `;
    });
}

function renderSimTable(sims) {
  const tableBody = document.getElementById('simTable');
  tableBody.innerHTML = '';
  
  if (!sims || sims.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="12">No SIMs found with this status</td></tr>';
    return;
  }

  sims.forEach(sim => {
    const row = document.createElement('tr');
    row.setAttribute('data-id', sim._id);
    
    const status = sim.status || 'Available';
    row.className = status.toLowerCase();
    
    row.innerHTML = `
      <td>${sim.MobileNumber}</td>
      <td>${sim.SimNumber}</td>
      <td>${sim.IMEI || 'N/A'}</td>
      <td>${status}</td>
      <td>${sim.isActive ? 'Active' : 'Inactive'}</td>
      <td>${sim.statusDate || ''}</td>
      <td>${sim.reactivationDate || ''}</td>
      <td>${sim.DateIn || ''}</td>
      <td>${sim.DateOut || ''}</td>
      <td>${sim.Vendor || ''}</td>
      <td>${sim.lastEditedBy || 'N/A'}</td>
      <td>
        <button class="icon-btn edit-icon" onclick="editSim('${sim._id}')">✏️</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
}

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

  const statusOptions = ['Available', 'Allocated', 'SafeCustody', 'Suspended']
    .map(opt => `<option value="${opt}" ${row.cells[3].innerText === opt ? 'selected' : ''}>${opt}</option>`)
    .join('');

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

  row.cells[10].innerHTML = `
    <input type="text" 
           value="${row.getAttribute("data-original-editor") || ''}" 
           required 
           placeholder="Your name"
           style="width: 100%"
    />
`;

  row.cells[11].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveSim('${simId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit('${simId}')">❌</button>
  `;

  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const statusSelect = row.cells[3].querySelector('#editStatus');
  const statusDateInput = row.cells[5].querySelector('#editStatusDate');
  const reactivationDateInput = row.cells[6].querySelector('#editReactivationDate');

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

  const errors = [];
  var indianMobileRegex = /^(?:[6-9]\d{9}|\d{13})$/;

  if (!indianMobileRegex.test(updatedData.MobileNumber)) {
    errors.push("Please enter a valid 10-digit or 13-digit Indian mobile number.");
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
