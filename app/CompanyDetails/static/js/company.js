document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("searchBtn").addEventListener("click", searchCompanies);
  document.getElementById("clearSearchBtn").addEventListener("click", clearSearch);
  document.getElementById("companySearch").addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
      searchCompanies();
    }
  });

});

document.getElementById("uploadBtn").addEventListener("click", function () {
  document.getElementById("uploadFormContainer").classList.toggle("hidden");
});

// Show modal
document.getElementById("manualEntryBtn").addEventListener("click", function() {
  document.getElementById("manualEntryModal").classList.remove("hidden");
});

// Close modal with X button
document.getElementById("closeCompanyModal").addEventListener("click", function() {
  document.getElementById("manualEntryModal").classList.add("hidden");
  document.getElementById("manualForm").reset();
});

// Close modal with Cancel button
document.getElementById("cancelBtn").addEventListener("click", function () {
  document.getElementById("manualEntryModal").classList.add("hidden");
  document.getElementById("manualForm").reset();
});

// Close modal when clicking outside the modal content
window.addEventListener("click", function(event) {
  const modal = document.getElementById("manualEntryModal");
  if (event.target === modal) {
    modal.classList.add("hidden");
    document.getElementById("manualForm").reset();
  }
});

function searchCompanies() {
  const searchValue = document.getElementById("companySearch").value.trim();
  if (!searchValue) {
    clearSearch();
    return;
  }

  fetch(`/companyDetails/search_companies?query=${searchValue}`)
    .then(response => response.json())
    .then(data => {
      const tableBody = document.getElementById("customerTable");
      tableBody.innerHTML = ''; // Clear current table

      if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="12" class="no-results">No companies found</td>`;
        tableBody.appendChild(row);
        return;
      }

      // Render the search results
      data.forEach(customer => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', customer._id);
        row.innerHTML = `
          <td>${customer['Company Name']}</td>
          <td>${customer['Contact Person']}</td>
          <td>${customer['Email Address']}</td>
          <td>${customer['Phone Number']}</td>
          <td>${customer['Company Address']}</td>
          <td>${customer['Number of GPS Devices']}</td>
          <td>${customer['Number of Vehicles']}</td>
          <td>${customer['Number of Drivers']}</td>
          <td>${customer['Payment Status']}</td>
          <td>${customer['Support Contact']}</td>
          <td>${customer['Remarks']}</td>
          <td>
            <button class="icon-btn edit-icon" onclick="editCustomer('${customer._id}')">✏️</button>
            <button class="icon-btn delete-icon" onclick="deleteCustomer('${customer._id}')">🗑️</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
    })
    .catch(error => {
      console.error('Error searching companies:', error);
      alert('Error searching companies. Please try again.');
    });
}

function clearSearch() {
  document.getElementById("companySearch").value = '';
  location.reload(); // Reload the page to show all companies
}

// Add form validation logic if necessary

function editCustomer(customerId) {
  const row = document.querySelector(`tr[data-id='${customerId}']`);

  const companyName = row.cells[0].innerText;
  const contactPerson = row.cells[1].innerText;
  const emailAddress = row.cells[2].innerText;
  const phoneNumber = row.cells[3].innerText;
  const companyAddress = row.cells[4].innerText;
  const gpsDevices = row.cells[5].innerText;
  const vehicles = row.cells[6].innerText;
  const drivers = row.cells[7].innerText;
  const paymentStatus = row.cells[8].innerText;
  const supportContact = row.cells[9].innerText;
  const remarks = row.cells[10].innerText;

  // row.cells[0].innerHTML = `<input type="text" value="${companyID}" />`;
  row.cells[0].innerHTML = `<input type="text" value="${companyName}" />`;
  row.cells[1].innerHTML = `<input type="text" value="${contactPerson}" />`;
  row.cells[2].innerHTML = `<input type="email" value="${emailAddress}" />`;
  row.cells[3].innerHTML = `<input type="text" value="${phoneNumber}" />`;
  row.cells[4].innerHTML = `<input type="text" value="${companyAddress}" />`;
  row.cells[5].innerHTML = `<input type="number" value="${gpsDevices}" />`;
  row.cells[6].innerHTML = `<input type="number" value="${vehicles}" />`;
  row.cells[7].innerHTML = `<input type="number" value="${drivers}" />`;
  row.cells[8].innerHTML = `<input type="text" value="${paymentStatus}" />`;
  row.cells[9].innerHTML = `<input type="text" value="${supportContact}" />`;
  row.cells[10].innerHTML = `<input type="text" value="${remarks}" />`;

  // Keep Company ID as non-editable text

  row.cells[11].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveCustomer('${customerId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit()">❌</button>
  `;
}

function saveCustomer(customerId) {
  const row = document.querySelector(`tr[data-id='${customerId}']`);

  const updatedData = {
    // CompanyID: row.cells[0].querySelector("input").value.trim(),
    CompanyName: row.cells[0].querySelector("input").value.trim(),
    ContactPerson: row.cells[1].querySelector("input").value.trim(),
    EmailAddress: row.cells[2].querySelector("input").value.trim(),
    PhoneNumber: row.cells[3].querySelector("input").value.trim(),
    CompanyAddress: row.cells[4].querySelector("input").value.trim(),
    NumberOfGPSDevices: row.cells[5].querySelector("input").value.trim(),
    NumberOfVehicles: row.cells[6].querySelector("input").value.trim(),
    NumberOfDrivers: row.cells[7].querySelector("input").value.trim(),
    PaymentStatus: row.cells[8].querySelector("input").value.trim(),
    SupportContact: row.cells[9].querySelector("input").value.trim(),
    Remarks: row.cells[10].querySelector("input").value.trim(),
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
        location.reload();
      } else {
        alert("Failed to save the changes.");
      }
    })
    .catch((error) => {
      console.error("Error updating customer:", error);
      alert("An error occurred. Please try again.");
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
  location.reload(); // Reload page to reset changes
}

// Show upload modal
document.getElementById("uploadBtn").addEventListener("click", function() {
  document.getElementById("uploadModal").classList.remove("hidden");
});
// Close modal with X
document.getElementById("closeUploadModal").addEventListener("click", function() {
  document.getElementById("uploadModal").classList.add("hidden");
});
// Close modal with Cancel
document.getElementById("cancelUploadBtn").addEventListener("click", function() {
  document.getElementById("uploadModal").classList.add("hidden");
});
// Close modal when clicking outside the content
window.addEventListener("click", function(event) {
  const modal = document.getElementById("uploadModal");
  if (event.target === modal) {
    modal.classList.add("hidden");
  }
});
