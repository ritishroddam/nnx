document.getElementById("uploadBtn").addEventListener("click", function () {
  document.getElementById("uploadFormContainer").classList.toggle("hidden");
});

document.getElementById("cancelBtn").addEventListener("click", function () {
  document.getElementById("manualEntryForm").classList.add("hidden");
});

document
  .getElementById("manualEntryBtn")
  .addEventListener("click", function () {
    fetchNextCompanyID();
    document.getElementById("manualEntryForm").classList.toggle("hidden");
  });

// Add form validation logic if necessary

function editCustomer(customerId) {
  const row = document.querySelector(`tr[data-id='${customerId}']`);

  const companyName = row.cells[1].innerText;
  const contactPerson = row.cells[2].innerText;
  const emailAddress = row.cells[3].innerText;
  const phoneNumber = row.cells[4].innerText;
  const companyAddress = row.cells[5].innerText;
  const gpsDevices = row.cells[6].innerText;
  const vehicles = row.cells[7].innerText;
  const drivers = row.cells[8].innerText;
  const paymentStatus = row.cells[9].innerText;
  const supportContact = row.cells[10].innerText;
  const remarks = row.cells[11].innerText;

  // row.cells[0].innerHTML = `<input type="text" value="${companyID}" />`;
  row.cells[1].innerHTML = `<input type="text" value="${companyName}" />`;
  row.cells[2].innerHTML = `<input type="text" value="${contactPerson}" />`;
  row.cells[3].innerHTML = `<input type="email" value="${emailAddress}" />`;
  row.cells[4].innerHTML = `<input type="text" value="${phoneNumber}" />`;
  row.cells[5].innerHTML = `<input type="text" value="${companyAddress}" />`;
  row.cells[6].innerHTML = `<input type="number" value="${gpsDevices}" />`;
  row.cells[7].innerHTML = `<input type="number" value="${vehicles}" />`;
  row.cells[8].innerHTML = `<input type="number" value="${drivers}" />`;
  row.cells[9].innerHTML = `<input type="text" value="${paymentStatus}" />`;
  row.cells[10].innerHTML = `<input type="text" value="${supportContact}" />`;
  row.cells[11].innerHTML = `<input type="text" value="${remarks}" />`;

  // Keep Company ID as non-editable text

  row.cells[12].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveCustomer('${customerId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit()">❌</button>
  `;
}

function saveCustomer(customerId) {
  const row = document.querySelector(`tr[data-id='${customerId}']`);

  const updatedData = {
    // CompanyID: row.cells[0].querySelector("input").value.trim(),
    CompanyName: row.cells[1].querySelector("input").value.trim(),
    ContactPerson: row.cells[2].querySelector("input").value.trim(),
    EmailAddress: row.cells[3].querySelector("input").value.trim(),
    PhoneNumber: row.cells[4].querySelector("input").value.trim(),
    CompanyAddress: row.cells[5].querySelector("input").value.trim(),
    NumberOfGPSDevices: row.cells[6].querySelector("input").value.trim(),
    NumberOfVehicles: row.cells[7].querySelector("input").value.trim(),
    NumberOfDrivers: row.cells[8].querySelector("input").value.trim(),
    PaymentStatus: row.cells[9].querySelector("input").value.trim(),
    SupportContact: row.cells[10].querySelector("input").value.trim(),
    Remarks: row.cells[11].querySelector("input").value.trim(),
  };

  fetch(`/companyDetails/edit_customer/${customerId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
