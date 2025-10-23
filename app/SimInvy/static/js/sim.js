let allSimsData = [];
let originalTableRows = [];
let currentStatus = 'All';        // new: track selected status
let currentSearch = '';          // new: track current search

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
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.trim();
      if (!searchTerm) {
        clearSearch();
      } else {
        searchSims(searchTerm);
      }
  });

  // wire up status select (template already has onchange="filterSimsByStatus()")
  // ensure function exists globally (declared below)
  document.getElementById('statusFilter').addEventListener('change', filterSimsByStatus);

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

let currentRowsPerPage = 100; 

function fetchAndRenderSims(page = 1, rowsPerPage = currentRowsPerPage, status = currentStatus, query = currentSearch) {
  try {
    currentRowsPerPage = rowsPerPage;
    currentStatus = status || 'All';
    currentSearch = query || '';

    let url = `/simInvy/get_sims_paginated?page=${page}&per_page=${rowsPerPage}`;
    if (currentStatus && currentStatus !== 'All') {
      url += `&status=${encodeURIComponent(currentStatus)}`;
    }
    if (currentSearch && currentSearch.trim() !== '') {
      url += `&query=${encodeURIComponent(currentSearch)}`;
    }

    fetch(url, {
      headers: {
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      }
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        totalRows = data.total || 0;
        currentPage = data.page || page;

        // update total counter from paginated response (authoritative)
        const totalEl = document.getElementById('totalSimsCount');
        if (totalEl) totalEl.textContent = totalRows;

        renderSimTable(data.sims || []);
        renderPaginationControls(totalRows, currentPage, rowsPerPage);
        // IMPORTANT: do not update status counters here when filtered/searching.
      })
      .catch(err => {
        console.error(err);
        document.getElementById('simTable').innerHTML = `<tr><td colspan="10">Failed to load data</td></tr>`;
      });
  } catch (err) {
    console.error(err);
    document.getElementById('simTable').innerHTML = `<tr><td colspan="10">Failed to load data</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", function() {
  fetchAndRenderSims(1, 100);
  updateCountersFromServer();
});

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
          <button class="pagination-nav-btn" id="simPrevPage" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="pagination-nav-icon">‹</span>
            Previous
          </button>
          <button class="pagination-nav-btn" id="simNextPage" ${currentPage === totalPages ? 'disabled' : ''}>
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

  // Preserve currentStatus/currentSearch when changing rows or pages
  document.getElementById('rowsPerPageSelect').addEventListener('change', function() {
    const newRowsPerPage = parseInt(this.value);
    fetchAndRenderSims(1, newRowsPerPage, currentStatus, currentSearch);
  });

  document.getElementById('simPrevPage').onclick = function() {
    if (currentPage > 1) fetchAndRenderSims(currentPage - 1, rowsPerPage, currentStatus, currentSearch);
  };

  document.getElementById('simNextPage').onclick = function() {
    if (currentPage < totalPages) fetchAndRenderSims(currentPage + 1, rowsPerPage, currentStatus, currentSearch);
  };

  document.getElementById('goToPageBtn').onclick = function() {
    const pageInput = document.getElementById('goToPageInput');
    const targetPage = parseInt(pageInput.value);
    
    if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
      fetchAndRenderSims(targetPage, rowsPerPage, currentStatus, currentSearch);
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

    // Set total as sum of status counts (fallback if paginated total not available)
    const total = Object.values(counts).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
    const totalEl = document.getElementById('totalSimsCount');
    if (totalEl) totalEl.textContent = total;
  } catch (err) {
    // keep silent on failure, leave counters unchanged
  }
}

document.addEventListener("DOMContentLoaded", function() {
  fetchAndRenderSims(1, ROWS_PER_PAGE);
  updateCountersFromServer();
});

function editSim(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);
  if (!row) return;

  if (row.classList.contains('editing')) return;
  row.classList.add('editing');

  const mobile = row.cells[0].innerText;
  const simNumber = row.cells[1].innerText;
  const imei = row.cells[2].innerText;
  const dateIn = row.cells[3].innerText;
  const dateOut = row.cells[4].innerText;
  const vendor = row.cells[5].innerText;
  const status = row.cells[6].innerText;

  const statusOptions = [
    "New Stock", "In Use", "Available", "Scrap", "Safe Custody", "Suspended"
  ];

  const vendorOptions = ["Airtel", "Vodafone", "BSNL", "Jio"];

  row.cells[0].innerHTML = `<input type="text" value="${mobile}" />`;
  row.cells[1].innerHTML = `<input type="text" value="${simNumber}" />`;
  row.cells[2].innerHTML = `<input type="text" value="${imei}" />`;
  row.cells[3].innerHTML = `<input type="date" value="${dateIn}" />`;
  row.cells[4].innerHTML = `<input type="date" value="${dateOut}" />`;
  row.cells[5].innerHTML = `
    <select>
      ${vendorOptions.map(opt => `<option value="${opt}" ${opt === vendor ? "selected" : ""}>${opt}</option>`).join("")}
    </select>
  `;
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

function saveSim(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);
  if (!row) return;

  const mobile = row.cells[0].querySelector("input").value.trim();
  const simNumber = row.cells[1].querySelector("input").value.trim();
  const imei = row.cells[2].querySelector("input").value.trim();
  const dateIn = row.cells[3].querySelector("input").value;
  const dateOut = row.cells[4].querySelector("input").value;
  const vendor = row.cells[5].querySelector("select").value;
  const status = row.cells[6].querySelector("select").value;

  const mobileRegex = /^\d{10,17}$/; 
  if (!mobileRegex.test(mobile)) {
    displayFlashMessage("Mobile Number must be 10 to 17 digits.", "danger");
    return;
  }

  if (![19, 20, 21, 22].includes(simNumber.length) || isNaN(simNumber)) {
    displayFlashMessage("SIM Number must be numeric and 19–22 digits long.", "danger");
    return;
  }

  const validVendors = ["Airtel", "Vodafone", "BSNL", "Jio"];
  if (!validVendors.includes(vendor)) {
    displayFlashMessage("Vendor must be Airtel, Vodafone, BSNL, or Jio.", "danger");
    return;
  }

  if (!dateIn) {
    displayFlashMessage("Date In is required.", "danger");
    return;
  }

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
        location.reload();
      } else {
        displayFlashMessage(data.message || "Failed to save changes.", "danger");
        console.error("Error updating SIM:", data.message);
      }
    })
    .catch((error) => {
      displayFlashMessage("An error occurred. Please try again.", "danger");
      console.error("Error updating SIM:", error);
    });
}

function cancelEditSim(simId) {
  location.reload();
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

            // ✅ Directly hit backend to get full Excel (no huge JSON post)
            const response = await fetch("/simInvy/download_excel", {
                method: "GET",
                headers: {
                    "X-CSRF-TOKEN": getCookie("csrf_access_token"),
                }
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
            a.download = 'SIM_Inventory_' + new Date().toISOString().split('T')[0] + '.xlsx';
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


async function filterSimsByStatus() {
  const status = document.getElementById('statusFilter').value || 'All';
  currentStatus = status;
  currentSearch = '';

  if (!status || status === 'All') {
    document.getElementById('simSearch').value = '';
    // restore normal paginated view and refresh counters (only when clearing)
    fetchAndRenderSims(1, ROWS_PER_PAGE, 'All', '');
    updateCountersFromServer(); // restore counters
    return;
  }

  // show paginated results for the selected status
  fetchAndRenderSims(1, ROWS_PER_PAGE, currentStatus, '');
  // DO NOT change status counters here (user requested)
}

async function searchSims(query) {
  currentSearch = query;
  currentStatus = 'All';

  if (!query || query.trim() === '') {
    clearSearch();
    return;
  }

  // use server-side paginated search and preserve pagination UI
  fetchAndRenderSims(1, ROWS_PER_PAGE, 'All', currentSearch);
  // DO NOT change status counters here
}

function clearSearch() {
  // Reset filters and restore paginated listing
  currentSearch = '';
  currentStatus = 'All';
  const searchEl = document.getElementById('simSearch');
  const statusEl = document.getElementById('statusFilter');
  if (searchEl) searchEl.value = '';
  if (statusEl) statusEl.value = 'All';
  fetchAndRenderSims(1, ROWS_PER_PAGE);
  updateCountersFromServer();
}

// Replace the old client-side filterTable - keep it as a fallback if needed
function filterTable(searchTerm) {
  // Deprecated: server-side search now used. Keep fallback for small datasets.
  if (!searchTerm) {
    originalTableRows.forEach(row => row.style.display = '');
    return;
  }
  originalTableRows.forEach(row => {
    if (row.cells.length < 3) return;
    const mobile = row.cells[0].textContent.trim().toLowerCase();
    const sim = row.cells[1].textContent.trim().toLowerCase();
    const imei = row.cells[2].textContent.trim().toLowerCase();
    const matches = mobile.includes(searchTerm.toLowerCase()) ||
                    sim.includes(searchTerm.toLowerCase()) ||
                    imei.includes(searchTerm.toLowerCase());
    row.style.display = matches ? '' : 'none';
  });
}