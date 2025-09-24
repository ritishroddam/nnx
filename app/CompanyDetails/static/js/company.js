document.getElementById('companyFilter').addEventListener('change', function() {
  const filterValue = this.value.toLowerCase();
  const rows = document.querySelectorAll('#customerTable tr');
  
  rows.forEach(row => {
    const companyName = row.cells[0].textContent.toLowerCase();
    if (filterValue === '' || companyName.includes(filterValue)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
});

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

  // Phone number validation
  if (!/^\d{10}$/.test(phone)) {
    displayFlashMessage("Phone Number must be exactly 10 digits.", "danger");
    return;
  }
  // Latitude validation
  if (!/^\d{2}\.\d{4,}$/.test(lat)) {
    displayFlashMessage("Latitude must be in format 12.1234 (two digits, dot, at least four digits).", "danger");
    return;
  }
  // Longitude validation
  if (!/^\d{2}\.\d{4,}$/.test(lng)) {
    displayFlashMessage("Longitude must be in format 12.1234 (two digits, dot, at least four digits).", "danger");
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

  // Latitude validation
  const latInput = document.getElementById("lat");
  const latValue = latInput.value.trim();
  let latError = document.getElementById("latError");
  if (!latError) {
    latError = document.createElement("div");
    latError.id = "latError";
    latError.className = "error hidden";
    latInput.parentNode.appendChild(latError);
  }
  if (!/^\d{2}\.\d{4,}$/.test(latValue)) {
    latError.textContent = "Latitude must be in format 12.1234 (two digits, dot, at least four digits).";
    latError.classList.remove("hidden");
    valid = false;
  } else {
    latError.classList.add("hidden");
  }

  // Longitude validation
  const lngInput = document.getElementById("lng");
  const lngValue = lngInput.value.trim();
  let lngError = document.getElementById("lngError");
  if (!lngError) {
    lngError = document.createElement("div");
    lngError.id = "lngError";
    lngError.className = "error hidden";
    lngInput.parentNode.appendChild(lngError);
  }
  if (!/^\d{2}\.\d{4,}$/.test(lngValue)) {
    lngError.textContent = "Longitude must be in format 12.1234 (two digits, dot, at least four digits).";
    lngError.classList.remove("hidden");
    valid = false;
  } else {
    lngError.classList.add("hidden");
  }

  if (!valid) {
    event.preventDefault();
    return false;
  }
});

async function renderPaginationControls(totalRows, currentPage, rowsPerPage) {
  const container = document.getElementById("companyPagination");
  if (!container) return;

  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  container.innerHTML = "";

  const makeBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className = "btn";
    if (active) btn.classList.add("active");
    btn.disabled = disabled;
    btn.addEventListener("click", async () => await fetchAndRenderCustomers(page));
    return btn;
  };

  container.appendChild(makeBtn("« Prev", Math.max(1, currentPage - 1), currentPage === 1));

  // windowed page numbers
  const windowSize = 5;
  const start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  for (let p = start; p <= end; p++) {
    container.appendChild(makeBtn(String(p), p, false, p === currentPage));
  }

  container.appendChild(makeBtn("Next »", Math.min(totalPages, currentPage + 1), currentPage === totalPages));
}

document.addEventListener("DOMContentLoaded", async () => {
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
    renderCustomerTable(data.customers);
    renderPaginationControls(totalRows, page, ROWS_PER_PAGE);
  } catch (err) {
    console.error("Error loading customers:", err);
    document.getElementById('customerTable').innerHTML = `<tr><td colspan="14">Failed to load data</td></tr>`;
  }
}
