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
    updateCounters(data.sims, data.total);
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

// Update counters using all data (optional: you may want a separate endpoint for total counts)
function updateCounters(currentPageSims, total) {
  // You may want to fetch all counts from a separate endpoint for accuracy
  // For now, just count from current page
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
    // Optionally handle error
  }
}

// Call this after page load and after any action that changes SIM data
document.addEventListener("DOMContentLoaded", function() {
  fetchAndRenderSims(1);
  updateCountersFromServer();
});
