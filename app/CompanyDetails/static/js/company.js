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

document.getElementById("uploadBtn").addEventListener("click", function () {
  document.getElementById("uploadFormContainer").classList.toggle("hidden");
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
  row.cells[5].innerHTML = `<input type="number" step="any" value="${lat}" placeholder="Latitude" />`;
  row.cells[6].innerHTML = `<input type="number" step="any" value="${lng}" placeholder="Longitude" />`;
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

  const updatedData = {
    "Company Name": row.cells[0].querySelector("input").value.trim(),
    "Contact Person": row.cells[1].querySelector("input").value.trim(),
    "Email Address": row.cells[2].querySelector("input").value.trim(),
    "Phone Number": row.cells[3].querySelector("input").value.trim(),
    "Company Address": row.cells[4].querySelector("input").value.trim(),
    "lat": String(row.cells[5].querySelector("input").value.trim()),
    "lng": String(row.cells[6].querySelector("input").value.trim()),
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

function deleteCustomer(customerId) {
  if (confirm("Are you sure you want to delete this customer?")) {
    fetch(`/companyDetails/delete_customer/${customerId}`, {
      method: "DELETE",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          document.querySelector(`tr[data-id='${customerId}']`).remove();
        } else {
          alert("Failed to delete the customer.");
        }
      })
      .catch((error) => {
        console.error("Error deleting customer:", error);
        alert("An error occurred. Please try again.");
      });
  }
}

function cancelEdit() {
  location.reload(); 
}

document.getElementById("uploadBtn").addEventListener("click", function() {
  document.getElementById("uploadModal").classList.remove("hidden");
});

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
