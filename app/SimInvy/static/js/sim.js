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

      var indianMobileRegex = /^\d{10}$|^\d{13}$/;

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
          "Please enter a valid 10-digit or 13-digit mobile number.";
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
    setTimeout(() => {
    updateCounters();
  }, 100);

  // Build allSimsData from the table rows rendered by Jinja
  allSimsData = Array.from(document.querySelectorAll('#simTable tr[data-id]')).map(row => {
    return {
      _id: row.getAttribute('data-id'),
      MobileNumber: row.cells[0].textContent.trim(),
      SimNumber: row.cells[1].textContent.trim(),
      IMEI: row.cells[2].textContent.trim(),
      DateIn: row.cells[3].textContent.trim(),
      DateOut: row.cells[4].textContent.trim(),
      Vendor: row.cells[5].textContent.trim(),
      status: row.cells[6].textContent.trim(),
      lastEditedBy: row.cells[7].textContent.trim(),
      lastEditedAt: row.cells[8].textContent.trim()
    };
  });

  // Render the table with pagination on initial load
  renderSimTable(allSimsData, 1);
});

const ROWS_PER_PAGE = 100;
let currentPage = 1;
let paginatedSims = [];

function paginateSims(sims, page = 1, rowsPerPage = ROWS_PER_PAGE) {
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  return sims.slice(start, end);
}

function renderPaginationControls(totalRows, currentPage, rowsPerPage) {
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginationDiv = document.getElementById('simPagination');
  if (!paginationDiv) return;

  if (totalPages <= 1) {
    paginationDiv.innerHTML = '';
    return;
  }

  let html = `<div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:10px 0;">`;

  html += `<button class="btn" id="simPrevPage" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>`;
  html += `<span>Page ${currentPage} of ${totalPages}</span>`;
  html += `<button class="btn" id="simNextPage" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;

  html += `</div>`;
  paginationDiv.innerHTML = html;

  document.getElementById('simPrevPage').onclick = function() {
    if (currentPage > 1) {
      currentPage--;
      renderSimTable(paginatedSims, currentPage);
    }
  };
  document.getElementById('simNextPage').onclick = function() {
    if (currentPage < totalPages) {
      currentPage++;
      renderSimTable(paginatedSims, currentPage);
    }
  };
}

// Override renderSimTable to support pagination
function renderSimTable(sims, page = 1) {
  paginatedSims = sims;
  currentPage = page;
  const tableBody = document.getElementById('simTable');
  tableBody.innerHTML = '';

  if (!sims || sims.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="10">No SIMs found with this status</td></tr>';
    renderPaginationControls(0, 1, ROWS_PER_PAGE);
    return;
  }

  const pageSims = paginateSims(sims, page, ROWS_PER_PAGE);
  pageSims.forEach(sim => {
    const row = document.createElement('tr');
    row.setAttribute('data-id', sim._id);

    const status = sim.status || 'New Stock';
    row.className = status.toLowerCase().replace(/\s/g, '-');

    row.innerHTML = `
      <td>${sim.MobileNumber}</td>
      <td>${sim.SimNumber}</td>
      <td>${sim.IMEI || 'N/A'}</td>
      <td>${sim.DateIn || ''}</td>
      <td>${sim.DateOut || ''}</td>
      <td>${sim.Vendor || ''}</td>
      <td>${status}</td>
      <td>${sim.lastEditedBy || 'N/A'}</td>
      <td>${sim.lastEditedAt || 'N/A'}</td>
      <td>
        <button class="icon-btn edit-icon" onclick="editSim('${sim._id}')">✏️</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
  renderPaginationControls(sims.length, page, ROWS_PER_PAGE);
  updateCounters();
}

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

function renderSimTable(sims, page = 1) {
  paginatedSims = sims;
  currentPage = page;
  const tableBody = document.getElementById('simTable');
  tableBody.innerHTML = '';

  if (!sims || sims.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="10">No SIMs found with this status</td></tr>';
    renderPaginationControls(0, 1, ROWS_PER_PAGE);
    return;
  }

  const pageSims = paginateSims(sims, page, ROWS_PER_PAGE);
  pageSims.forEach(sim => {
    const row = document.createElement('tr');
    row.setAttribute('data-id', sim._id);

    const status = sim.status || 'New Stock';
    row.className = status.toLowerCase().replace(/\s/g, '-');

    row.innerHTML = `
      <td>${sim.MobileNumber}</td>
      <td>${sim.SimNumber}</td>
      <td>${sim.IMEI || 'N/A'}</td>
      <td>${sim.DateIn || ''}</td>
      <td>${sim.DateOut || ''}</td>
      <td>${sim.Vendor || ''}</td>
      <td>${status}</td>
      <td>${sim.lastEditedBy || 'N/A'}</td>
      <td>${sim.lastEditedAt || 'N/A'}</td>
      <td>
        <button class="icon-btn edit-icon" onclick="editSim('${sim._id}')">✏️</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
  renderPaginationControls(sims.length, page, ROWS_PER_PAGE);
  updateCounters();
}

function updateCounters() {
  try {
    // Use allSimsData for total counts, not just visible rows
    let newStockCount = 0;
    let inUseCount = 0;
    let availableCount = 0;
    let scrapCount = 0;
    let safeCustodyCount = 0;
    let suspendedCount = 0;

    allSimsData.forEach(sim => {
      const status = (sim.status || '').trim();
      if (status === "New Stock") newStockCount++;
      if (status === "In Use") inUseCount++;
      if (status === "Available") availableCount++;
      if (status === "Scrap") scrapCount++;
      if (status === "Safe Custody") safeCustodyCount++;
      if (status === "Suspended") suspendedCount++;
    });

    const updateCounter = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    updateCounter('newStockCount', newStockCount);
    updateCounter('inUseCount', inUseCount);
    updateCounter('availableCount', availableCount);
    updateCounter('scrapCount', scrapCount);
    updateCounter('safeCustodyCount', safeCustodyCount);
    updateCounter('suspendedCount', suspendedCount);
  } catch (error) {
    console.error('Error updating counters:', error);
  }
}

function filterSimsByStatus() {
  const status = document.getElementById('statusFilter').value;
  const tableBody = document.getElementById('simTable');
  const allRows = Array.from(tableBody.querySelectorAll('tr[data-id]'));

  if (status === "All") {
    allRows.forEach(row => row.style.display = '');
  } else {
    allRows.forEach(row => {
      const statusCell = row.cells[6];
      if (statusCell && statusCell.textContent.trim() === status) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }
  updateCounters();
}

function editSim(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);
  if (!row) return;

  // Prevent multiple edits at once
  if (row.classList.contains('editing')) return;
  row.classList.add('editing');

  // Get current values
  const mobile = row.cells[0].innerText;
  const simNumber = row.cells[1].innerText;
  const imei = row.cells[2].innerText;
  const dateIn = row.cells[3].innerText;
  const dateOut = row.cells[4].innerText;
  const vendor = row.cells[5].innerText;
  const status = row.cells[6].innerText;

  // Status options
  const statusOptions = [
    "New Stock", "In Use", "Available", "Scrap", "Safe Custody", "Suspended"
  ];

  // Render editable fields
  row.cells[0].innerHTML = `<input type="text" value="${mobile}" />`;
  row.cells[1].innerHTML = `<input type="text" value="${simNumber}" />`;
  row.cells[2].innerHTML = `<input type="text" value="${imei}" />`;
  row.cells[3].innerHTML = `<input type="date" value="${dateIn}" />`;
  row.cells[4].innerHTML = `<input type="date" value="${dateOut}" />`;
  row.cells[5].innerHTML = `<input type="text" value="${vendor}" />`;
  row.cells[6].innerHTML = `
    <select>
      ${statusOptions.map(opt => `<option value="${opt}" ${opt === status ? "selected" : ""}>${opt}</option>`).join("")}
    </select>
  `;

  // Actions: Save and Cancel
  row.cells[9].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveSim('${simId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEditSim('${simId}')">❌</button>
  `;
}

// Save and Cancel handlers (basic stubs)
function saveSim(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);
  if (!row) return;

  const mobile = row.cells[0].querySelector("input").value.trim();
  const simNumber = row.cells[1].querySelector("input").value.trim();
  const imei = row.cells[2].querySelector("input").value.trim();
  const dateIn = row.cells[3].querySelector("input").value;
  const dateOut = row.cells[4].querySelector("input").value;
  const vendor = row.cells[5].querySelector("input").value.trim();
  const status = row.cells[6].querySelector("select").value;

  // Optionally, add validation here

  const updatedData = {
    MobileNumber: mobile,
    SimNumber: simNumber,
    IMEI: imei,
    DateIn: dateIn,
    DateOut: dateOut,
    Vendor: vendor,
    status: status
  };

  fetch(`/simInvy/edit_sim/${simId}`, {
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
        // Optionally update the row inline, or just reload:
        location.reload();
      } else {
        alert(data.message || "Failed to save changes.");
      }
    })
    .catch((error) => {
      alert("An error occurred. Please try again.");
      console.error("Error updating SIM:", error);
    });
}

function cancelEditSim(simId) {
  location.reload(); // For now, just reload to reset
}
