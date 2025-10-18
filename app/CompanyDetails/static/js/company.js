// NOTE: Filtering is handled by the Selectize/native binding inside DOMContentLoaded
// to ensure the Selectize instance triggers the same handler. See filterByCompanyValue().

document.getElementById("uploadBtn").addEventListener("click", function() {
  const modal = document.getElementById("uploadModal");
  if (modal) modal.classList.remove("hidden");
});

document.getElementById("manualEntryBtn").addEventListener("click", function() {
  document.getElementById("manualEntryModal").classList.remove("hidden");
});

document.getElementById("closeCompanyModal").addEventListener("click", function() {
  document.getElementById("manualEntryModal").classList.add("hidden");
  document.getElementById("manualForm").reset();
});

document.getElementById("cancelBtn").addEventListener("click", function () {
  document.getElementById("manualEntryModal").classList.add("hidden");
  document.getElementById("manualForm").reset();
});

window.addEventListener("click", function(event) {
  const modal = document.getElementById("manualEntryModal");
  if (event.target === modal) {
    modal.classList.add("hidden");
    document.getElementById("manualForm").reset();
  }
});

function editCustomer(customerId) {
  const row = document.querySelector(`tr[data-id='${customerId}']`);

  const companyName = row.cells[0].innerText;
  const contactPerson = row.cells[1].innerText;
  const emailAddress = row.cells[2].innerText;
  const phoneNumber = row.cells[3].innerText;
  const companyAddress = row.cells[4].innerText;
  const lat = row.cells[5].innerText;
  const lng = row.cells[6].innerText;
  const gpsDevices = row.cells[7].innerText;
  const vehicles = row.cells[8].innerText;
  const drivers = row.cells[9].innerText;
  const paymentStatus = row.cells[10].innerText;
  const supportContact = row.cells[11].innerText;
  const remarks = row.cells[12].innerText;

  row.cells[0].innerHTML = `<input type="text" value="${companyName}" />`;
  row.cells[1].innerHTML = `<input type="text" value="${contactPerson}" />`;
  row.cells[2].innerHTML = `<input type="email" value="${emailAddress}" />`;
  row.cells[3].innerHTML = `<input type="text" value="${phoneNumber}" />`;
  row.cells[4].innerHTML = `<input type="text" value="${companyAddress}" />`;
  row.cells[5].innerHTML = `<input type="text" value="${lat}" placeholder="Latitude" />`;
  row.cells[6].innerHTML = `<input type="text" value="${lng}" placeholder="Longitude" />`;
  row.cells[7].innerHTML = `<input type="number" value="${gpsDevices}" />`;
  row.cells[8].innerHTML = `<input type="number" value="${vehicles}" />`;
  row.cells[9].innerHTML = `<input type="number" value="${drivers}" />`;
  row.cells[10].innerHTML = `<input type="text" value="${paymentStatus}" />`;
  row.cells[11].innerHTML = `<input type="text" value="${supportContact}" />`;
  row.cells[12].innerHTML = `<input type="text" value="${remarks}" />`;

  row.cells[13].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveCustomer('${customerId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit()">❌</button>
  `;
}

function saveCustomer(customerId) {
  const row = document.querySelector(`tr[data-id='${customerId}']`);

  const phone = row.cells[3].querySelector("input").value.trim();
  const lat = row.cells[5].querySelector("input").value.trim();
  const lng = row.cells[6].querySelector("input").value.trim();

  if (!/^\d{10}$/.test(phone)) {
    displayFlashMessage("Phone Number must be exactly 10 digits.", "danger");
    return;
  }

  const updatedData = {
    "Company Name": row.cells[0].querySelector("input").value.trim(),
    "Contact Person": row.cells[1].querySelector("input").value.trim(),
    "Email Address": row.cells[2].querySelector("input").value.trim(),
    "Phone Number": phone,
    "Company Address": row.cells[4].querySelector("input").value.trim(),
    "lat": lat,
    "lng": lng,
    "Number of GPS Devices": row.cells[7].querySelector("input").value.trim(),
    "Number of Vehicles": row.cells[8].querySelector("input").value.trim(),
    "Number of Drivers": row.cells[9].querySelector("input").value.trim(),
    "Payment Status": row.cells[10].querySelector("input").value.trim(),
    "Support Contact": row.cells[11].querySelector("input").value.trim(),
    "Remarks": row.cells[12].querySelector("input").value.trim(),
  };

  fetch(`/companyDetails/edit_customer/${customerId}`, {
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
        displayFlashMessage(data.message || "Customer details updated successfully.","success");
        setTimeout(() => {location.reload();}, 5000);
      } else {
        displayFlashMessage(data.message || "Failed to save changes.");
      }
    })
    .catch((error) => {
      displayFlashMessage("An error occurred while saving the changes.");
      console.error("Error updating customer:", error);
    });
}

function cancelEdit() {
  location.reload(); 
}

document.getElementById("closeUploadModal").addEventListener("click", function() {
  document.getElementById("uploadModal").classList.add("hidden");
});

document.getElementById("cancelUploadBtn").addEventListener("click", function() {
  document.getElementById("uploadModal").classList.add("hidden");
});

window.addEventListener("click", function(event) {
  const modal = document.getElementById("uploadModal");
  if (event.target === modal) {
    modal.classList.add("hidden");
  }
});

document.getElementById("manualForm").addEventListener("submit", function(event) {
  const phoneInput = document.getElementById("PhoneNumber");
  const phoneError = document.getElementById("phoneNumberError");
  const phoneValue = phoneInput.value.trim();

  let valid = true;

  // Phone number validation
  if (!/^\d{10}$/.test(phoneValue)) {
    phoneError.textContent = "Phone Number must be exactly 10 digits.";
    phoneError.classList.remove("hidden");
    valid = false;
  } else {
    phoneError.classList.add("hidden");
  }

  if (!valid) {
    event.preventDefault();
    return false;
  }
});

function renderCustomerTable(customers) {
  const tableBody = document.getElementById('customerTable');
  if (!tableBody) {
    console.error('customerTable element not found');
    return;
  }
  
  tableBody.innerHTML = '';
  
  if (!customers || customers.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="14">No customers found</td></tr>';
    return;
  }
  
  customers.forEach(customer => {
    const row = document.createElement('tr');
    row.setAttribute('data-id', customer._id);
    row.innerHTML = `
      <td>${customer['Company Name'] || ''}</td>
      <td>${customer['Contact Person'] || ''}</td>
      <td>${customer['Email Address'] || ''}</td>
      <td>${customer['Phone Number'] || ''}</td>
      <td>${customer['Company Address'] || ''}</td>
      <td>${customer['lat'] || ''}</td>
      <td>${customer['lng'] || ''}</td>
      <td>${customer['Number of GPS Devices'] || ''}</td>
      <td>${customer['Number of Vehicles'] || ''}</td>
      <td>${customer['Number of Drivers'] || ''}</td>
      <td>${customer['Payment Status'] || ''}</td>
      <td>${customer['Support Contact'] || ''}</td>
      <td>${customer['Remarks'] || ''}</td>
      <td>
        <button class="icon-btn edit-icon" onclick="editCustomer('${customer._id}')">✏️</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function renderPaginationControls(totalRows, currentPage, rowsPerPage) {
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginationDiv = document.getElementById('companyPagination');
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
          <button class="pagination-nav-btn" id="companyPrevPage" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="pagination-nav-icon">‹</span>
            Previous
          </button>
          <button class="pagination-nav-btn" id="companyNextPage" ${currentPage === totalPages ? 'disabled' : ''}>
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
    fetchAndRenderCustomers(1, newRowsPerPage);
  });

  document.getElementById('companyPrevPage').onclick = function() {
    if (currentPage > 1) fetchAndRenderCustomers(currentPage - 1, rowsPerPage);
  };

  document.getElementById('companyNextPage').onclick = function() {
    if (currentPage < totalPages) fetchAndRenderCustomers(currentPage + 1, rowsPerPage);
  };

  document.getElementById('goToPageBtn').onclick = function() {
    const pageInput = document.getElementById('goToPageInput');
    const targetPage = parseInt(pageInput.value);
    
    if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
      fetchAndRenderCustomers(targetPage, rowsPerPage);
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

function filterByCompanyValue(filterValue) {
  return (async function() {
    try {
      if (filterValue == null) filterValue = '';
      const fv = filterValue.toString().trim().toLowerCase();

      // If user selected the explicit All Companies token -> fetch full dataset and render it
      if (fv === '__all__') {
        // first request to get total count (fast)
        const metaResp = await fetch(`/companyDetails/get_customers_paginated?page=1&per_page=1`, {
          method: "GET",
          headers: {
            "X-CSRF-TOKEN": getCookie("csrf_access_token"),
            "Accept": "application/json"
          },
          credentials: "include"
        });

        if (!metaResp.ok) throw new Error(`HTTP ${metaResp.status}`);
        const meta = await metaResp.json();
        const total = meta.total || 0;
        const perPage = total > 0 ? total : 10000;

        // fetch all customers in one go
        const resp = await fetch(`/companyDetails/get_customers_paginated?page=1&per_page=${perPage}`, {
          method: "GET",
          headers: {
            "X-CSRF-TOKEN": getCookie("csrf_access_token"),
            "Accept": "application/json"
          },
          credentials: "include"
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const customers = data.customers || [];

        document.getElementById('totalCompaniesCount').textContent = customers.length;
        renderCustomerTable(customers);
        const paginationDiv = document.getElementById('companyPagination');
        if (paginationDiv) paginationDiv.innerHTML = ''; // hide pagination while showing all
        return;
      }

      // empty selection -> restore paginated view (first page)
      if (fv === '') {
        await fetchAndRenderCustomers(1);
        return;
      }

      // default: fetch all customers (use known totalRows if available) and filter client-side
      const perPage = (typeof totalRows === 'number' && totalRows > 0) ? totalRows : 10000;
      const response = await fetch(`/companyDetails/get_customers_paginated?page=1&per_page=${perPage}`, {
        method: "GET",
        headers: {
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
          "Accept": "application/json"
        },
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const customers = data.customers || [];

      // filter across complete dataset
      const filtered = customers.filter(c => {
        const name = (c['Company Name'] || '').toString().toLowerCase();
        return name.includes(fv);
      });

      // render filtered results and hide pagination while filtered
      document.getElementById('totalCompaniesCount').textContent = filtered.length;
      renderCustomerTable(filtered);
      const paginationDiv = document.getElementById('companyPagination');
      if (paginationDiv) paginationDiv.innerHTML = '';
    } catch (err) {
      console.error("Error filtering customers:", err);
    }
  })();
}

document.addEventListener("DOMContentLoaded", async () => {
  $("#companyFilter").selectize({
    placeholder: "Search Companies",
    searchField: "text",
    create: false,
  });

  const jqEl = window.jQuery && $('#companyFilter')[0];
  const selectizeInst = jqEl ? jqEl.selectize : null;
  if (selectizeInst && typeof selectizeInst.on === 'function') {
    selectizeInst.on('change', function(val) {
      filterByCompanyValue(val);
    });
  } else {
    const nativeSelect = document.getElementById('companyFilter');
    if (nativeSelect) {
      nativeSelect.addEventListener('change', function(e) {
        filterByCompanyValue(e.target.value);
      });
    }
  }

  await fetchAndRenderCustomers(1);
});

let currentPage = 1;
const ROWS_PER_PAGE = 100;
let totalRows = 0;

async function fetchAndRenderCustomers(page = 1) {
  try {
    const response = await fetch(`/companyDetails/get_customers_paginated?page=${page}&per_page=${ROWS_PER_PAGE}`, {
      method: "GET",
      headers: {
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        "Accept": "application/json"
      },
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    totalRows = data.total;
    currentPage = data.page || page;

    document.getElementById('totalCompaniesCount').textContent = totalRows;

    renderCustomerTable(data.customers);
    renderPaginationControls(totalRows, page, ROWS_PER_PAGE);
  } catch (err) {
    console.error("Error loading customers:", err);
    document.getElementById('customerTable').innerHTML = `<tr><td colspan="14">Failed to load data</td></tr>`;
  }
}
