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

      if (simNumber.length < 19  || simNumber.length > 22 || isNaN(simNumber)) {
        simError.textContent = "SIM Number must be from 19 to 22 digits.";
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

  renderSimTable(allSimsData, 1);
});

let currentPage = 1;
const ROWS_PER_PAGE = 100;
let totalRows = 0;

async function fetchAndRenderSims(page = 1) {
  try {
    const response = await fetch(`/simInvy/get_sims_paginated?page=${page}&per_page=${ROWS_PER_PAGE}`, {
      headers: {
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      }
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    totalRows = data.total;
    renderSimTable(data.sims);
    renderPaginationControls(totalRows, page, ROWS_PER_PAGE);
    // updateCounters(data.sims, data.total); // REMOVE or COMMENT OUT this line
  } catch (err) {
    document.getElementById('simTable').innerHTML = `<tr><td colspan="10">Failed to load data</td></tr>`;
  }
}

function renderSimTable(sims) {
  const tableBody = document.getElementById('simTable');
  tableBody.innerHTML = '';
  if (!sims || sims.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="10">No SIMs found</td></tr>';
    return;
  }
  sims.forEach(sim => {
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
    if (currentPage > 1) fetchAndRenderSims(currentPage - 1);
  };
  document.getElementById('simNextPage').onclick = function() {
    if (currentPage < totalPages) fetchAndRenderSims(currentPage + 1);
  };
}

function updateCounters(currentPageSims, total) {
  let newStockCount = 0, inUseCount = 0, availableCount = 0, scrapCount = 0, safeCustodyCount = 0, suspendedCount = 0;
  currentPageSims.forEach(sim => {
    const status = (sim.status || '').trim();
    if (status === "New Stock") newStockCount++;
    if (status === "In Use") inUseCount++;
    if (status === "Available") availableCount++;
    if (status === "Scrap") scrapCount++;
    if (status === "Safe Custody") safeCustodyCount++;
    if (status === "Suspended") suspendedCount++;
  });
  document.getElementById('newStockCount').textContent = newStockCount;
  document.getElementById('inUseCount').textContent = inUseCount;
  document.getElementById('availableCount').textContent = availableCount;
  document.getElementById('scrapCount').textContent = scrapCount;
  document.getElementById('safeCustodyCount').textContent = safeCustodyCount;
  document.getElementById('suspendedCount').textContent = suspendedCount;
}

async function updateCountersFromServer() {
  try {
    const response = await fetch('/simInvy/sim_status_counts', {
      headers: {
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      }
    });
    const counts = await response.json();
    document.getElementById('newStockCount').textContent = counts["New Stock"] || 0;
    document.getElementById('inUseCount').textContent = counts["In Use"] || 0;
    document.getElementById('availableCount').textContent = counts["Available"] || 0;
    document.getElementById('scrapCount').textContent = counts["Scrap"] || 0;
    document.getElementById('safeCustodyCount').textContent = counts["Safe Custody"] || 0;
    document.getElementById('suspendedCount').textContent = counts["Suspended"] || 0;
  } catch (err) {
  }
}

document.addEventListener("DOMContentLoaded", function() {
  fetchAndRenderSims(1);
  updateCountersFromServer();
});

function editSim(simId) {
  const row = originalTableRows.find(r => r.getAttribute('data-id') === simId);
  if (!row) return;

  document.getElementById("editMobileNumber").value = row.cells[0].innerText.trim();
  document.getElementById("editSimNumber").value = row.cells[1].innerText.trim();
  document.getElementById("editImei").value = row.cells[2].innerText.trim();
  document.getElementById("editDateIn").value = row.cells[3].innerText.trim();
  document.getElementById("editDateOut").value = row.cells[4].innerText.trim();
  document.getElementById("editVendor").value = row.cells[5].innerText.trim();
  document.getElementById("editStatus").value = row.cells[6].innerText.trim();
  document.getElementById("editLastEditedBy").value = row.cells[7].innerText.trim();
  document.getElementById("editLastEditedAt").value = row.cells[8].innerText.trim();

  document.getElementById("editSimModal").classList.remove("hidden");

  document.getElementById("saveEditBtn").onclick = async function() {
    const updatedData = {
      _id: simId,
      MobileNumber: document.getElementById("editMobileNumber").value.trim(),
      SimNumber: document.getElementById("editSimNumber").value.trim(),
      IMEI: document.getElementById("editImei").value.trim(),
      DateIn: document.getElementById("editDateIn").value.trim(),
      DateOut: document.getElementById("editDateOut").value.trim(),
      Vendor: document.getElementById("editVendor").value.trim(),
      status: document.getElementById("editStatus").value.trim(),
      lastEditedBy: document.getElementById("editLastEditedBy").value.trim(),
      lastEditedAt: document.getElementById("editLastEditedAt").value.trim()
    };

    try {
      const response = await fetch('/simInvy/update_sim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        },
        body: JSON.stringify(updatedData)
      });
      const result = await response.json();
      if (result.success) {
        const index = originalTableRows.findIndex(r => r.getAttribute('data-id') === simId);
        if (index !== -1) {
          originalTableRows[index].cells[0].innerText = updatedData.MobileNumber;
          originalTableRows[index].cells[1].innerText = updatedData.SimNumber;
          originalTableRows[index].cells[2].innerText = updatedData.IMEI;
          originalTableRows[index].cells[3].innerText = updatedData.DateIn;
          originalTableRows[index].cells[4].innerText = updatedData.DateOut;
          originalTableRows[index].cells[5].innerHTML = `
            <select id="editVendor">
              <option value="Airtel" ${updatedData.Vendor === "Airtel" ? "selected" : ""}>Airtel</option>
              <option value="Vodafone" ${updatedData.Vendor === "Vodafone" ? "selected" : ""}>Vodafone</option>
            </select>
          `;
          originalTableRows[index].cells[6].innerText = updatedData.status;
          originalTableRows[index].cells[7].innerText = updatedData.lastEditedBy;
          originalTableRows[index].cells[8].innerText = updatedData.lastEditedAt;
        }

        document.getElementById("editSimModal").classList.add("hidden");
      } else {
        alert("Failed to update SIM data: " + (result.message || "Unknown error"));
      }
    } catch (err) {
      alert("Error updating SIM data: " + err.message);
    }
  };
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

            // Collect only visible rows
            const visibleRows = Array.from(document.querySelectorAll("#simTable tr"))
                .filter(row => row.cells.length > 1 && row.style.display !== 'none');

            // Map to correct fields based on your table structure
            const simsToExport = visibleRows.map(row => ({
                MobileNumber: row.cells[0].textContent.trim(),
                SimNumber: row.cells[1].textContent.trim(),
                IMEI: row.cells[2].textContent.trim(),
                DateIn: row.cells[3].textContent.trim(),
                DateOut: row.cells[4].textContent.trim(),
                Vendor: row.cells[5].textContent.trim(),
                status: row.cells[6].textContent.trim(),
                lastEditedBy: row.cells[7].textContent.trim(),
                lastEditedAt: row.cells[8].textContent.trim()
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
