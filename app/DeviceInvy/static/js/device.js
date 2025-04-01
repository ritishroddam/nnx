// Automatically set warranty to 1 year from Date In
document.getElementById("DateIn").addEventListener("change", function () {
  var dateIn = new Date(this.value);
  var warrantyDate = new Date(dateIn);
  warrantyDate.setFullYear(warrantyDate.getFullYear() + 1);
  document.getElementById("Warranty").value = warrantyDate
    .toISOString()
    .split("T")[0];
});

document
  .getElementById("manualEntryBtn")
  .addEventListener("click", function () {
    document.getElementById("manualEntryForm").classList.toggle("hidden");
    document.getElementById("IMEI").focus();
  });

document.getElementById("uploadBtn").addEventListener("click", function () {
  document.getElementById("uploadBox").classList.toggle("hidden");
});

document.getElementById("cancelBtn").addEventListener("click", function () {
  document.getElementById("manualEntryForm").classList.add("hidden");
});

document
  .getElementById("cancelUploadBtn")
  .addEventListener("click", function () {
    document.getElementById("uploadBox").classList.add("hidden");
  });

document.getElementById("uploadForm").addEventListener("submit", function () {
  document.querySelector(".preloader").style.display = "block";
});

document
  .getElementById("manualForm")
  .addEventListener("submit", function (event) {
    var imei = document.getElementById("IMEI").value;
    var imeiError = document.getElementById("imeiError");

    // IMEI validation
    if (imei.length !== 15 || isNaN(imei)) {
      imeiError.classList.remove("hidden");
      event.preventDefault();
    } else {
      imeiError.classList.add("hidden");
    }
  });

document.addEventListener("DOMContentLoaded", function () {
  const dateInInput = document.getElementById("DateIn");

  // Set the max date to today
  const today = new Date().toISOString().split("T")[0];
  dateInInput.setAttribute("max", today);

  // Prevent selecting future dates
  dateInInput.addEventListener("input", function () {
    if (this.value > today) {
      alert("Future dates are not allowed.");
      this.value = today; // Reset to today's date
    }
  });
});

document.getElementById("Package").addEventListener("change", function () {
  var tenureContainer = document.getElementById("TenureContainer");
  var tenureInput = document.getElementById("Tenure");
  if (this.value === "Package") {
    tenureContainer.classList.remove("hidden");
    tenureInput.setAttribute("required", "true");
  } else {
    tenureContainer.classList.add("hidden");
    tenureInput.removeAttribute("required");
  }
});

////////////////// Download ////////////////////////
document.getElementById("downloadExcel").addEventListener("click", function () {
  window.location.href = "/deviceInvy/download_excel";
});

function editDevice(deviceId) {
  console.log("Edit button clicked for device ID:", deviceId);

  const row = document.querySelector(`tr[data-id='${deviceId}']`);

  // Extract existing values from the row
  const imei = row.cells[0].innerText;
  // const glNumber = row.cells[1].innerText;
  const glNumber =
    row.cells[1].innerText.trim() === "None"
      ? ""
      : row.cells[1].innerText.trim();
  const deviceModel = row.cells[2].innerText;
  const deviceMake = row.cells[3].innerText;
  const dateIn = row.cells[4].innerText;
  const warranty = row.cells[5].innerText;
  const sentBy = row.cells[6].innerText;
  const outwardTo = row.cells[7].innerText;
  const packageValue = row.cells[8].innerText;
  const tenureValue = row.cells[9].innerText;
  const status = row.cells[10].innerText.trim();

  // Replace row cells with editable inputs
  row.cells[0].innerHTML = `<input type="text" value="${imei}" id="editIMEI" maxlength="15" oninput="validateIMEI(this)" />`;
  row.cells[1].innerHTML = `<input type="text" value="${glNumber}" id="editGLNumber" maxlength="13" oninput="validateGLNumber(this)" />`;
  row.cells[2].innerHTML = `<input type="text" value="${deviceModel}" />`;
  row.cells[3].innerHTML = `<input type="text" value="${deviceMake}" />`;

  row.cells[4].innerHTML = `<input type="date" value="${dateIn}" />`;
  row.cells[5].innerHTML = `<input type="date" value="${warranty}" />`;
  row.cells[6].innerHTML = `<input type="text" value="${sentBy}" />`;
  row.cells[7].innerHTML = `<input type="text" value="${outwardTo}" />`;
  row.cells[8].innerHTML = `
    <select id="editPackage">
      <option value="Rental" ${
        packageValue === "Rental" ? "selected" : ""
      }>Rental</option>
      <option value="Package" ${
        packageValue === "Package" ? "selected" : ""
      }>Package</option>
      <option value="Outrate" ${
        packageValue === "Outrate" ? "selected" : ""
      }>Outrate</option>
    </select>
  `;

  row.cells[9].innerHTML = `<input type="text" id="editTenure" value="${tenureValue}" ${
    packageValue === "Package" ? "" : "disabled"
  } />`;

  row.cells[10].innerHTML = `
    <input type="radio" name="status-${deviceId}" value="Active" ${
    status === "Active" ? "checked" : ""
  } /> Active
    <input type="radio" name="status-${deviceId}" value="Inactive" ${
    status === "Inactive" ? "checked" : ""
  } /> Inactive
  `;

  row.cells[11].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveDevice('${deviceId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit('${deviceId}')">❌</button>
  `;

  // Enable/disable "Tenure" based on "Package" selection
  document
    .getElementById("editPackage")
    .addEventListener("change", function () {
      document.getElementById("editTenure").disabled = this.value !== "Package";
    });
}

function validateIMEI(input) {
  let imei = input.value;
  if (!/^\d{0,15}$/.test(imei)) {
    input.value = imei.slice(0, 15); // Restrict to 15 digits
  }
}

function validateGLNumber(input) {
  let glNumber = input.value;
  if (!/^\d{0,13}$/.test(glNumber)) {
    input.value = glNumber.slice(0, 13); // Restrict to 13 digits
  }
}

function saveDevice(deviceId) {
  const row = document.querySelector(`tr[data-id='${deviceId}']`);

  const imeiValue = row.cells[0].querySelector("input").value.trim();
  const glNumberValue = row.cells[1].querySelector("input").value.trim();
  const deviceModel = row.cells[2].querySelector("input").value.trim();
  const deviceMake = row.cells[3].querySelector("input").value.trim();
  const dateIn = row.cells[4].querySelector("input").value.trim();
  const today = new Date().toISOString().split("T")[0];
  const warranty = row.cells[5].querySelector("input").value.trim();
  const sentBy = row.cells[6].querySelector("input").value.trim();
  const outwardTo = row.cells[7].querySelector("input").value.trim();
  const packageValue = row.cells[8].querySelector("select").value;
  const tenureValue = row.cells[9].querySelector("input").value.trim();
  const status = row.cells[10]
    .querySelector(`input[name="status-${deviceId}"]:checked`)
    .value.trim();

  console.log("Updated Data:", {
    IMEI: imeiValue,
    GLNumber: glNumberValue || null,
    DeviceModel: deviceModel,
    DeviceMake: deviceMake,
    DateIn: dateIn,
    Warranty: warranty,
    SentBy: sentBy,
    OutwardTo: outwardTo,
    Package: packageValue,
    Tenure: tenureValue || null,
    Status: status,
  });

  // Validate inputs
  if (imeiValue.length !== 15 || isNaN(imeiValue)) {
    alert("IMEI must be exactly 15 digits and numeric.");
    return;
  }

  if (glNumberValue && (glNumberValue.length !== 13 || isNaN(glNumberValue))) {
    alert("GL Number must be exactly 13 digits if entered.");
    return;
  }

  if (dateIn > today) {
    alert("Future dates are not allowed.");
    return;
  }

  if (packageValue === "Package" && tenureValue.trim() === "") {
    alert("Tenure is required when Package is selected.");
    return;
  }

  const updatedData = {
    IMEI: imeiValue,
    GLNumber: glNumberValue || null,
    DeviceModel: deviceModel,
    DeviceMake: deviceMake,
    DateIn: dateIn,
    Warranty: warranty,
    SentBy: sentBy,
    OutwardTo: outwardTo,
    Package: packageValue,
    Tenure: tenureValue || null,
    Status: status,
  };

  fetch(`/deviceInvy/edit_device/${deviceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatedData),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        row.cells[0].innerText = updatedData.IMEI;
        row.cells[1].innerText = updatedData.GLNumber || "";
        row.cells[2].innerText = updatedData.DeviceModel;
        row.cells[3].innerText = updatedData.DeviceMake;
        row.cells[4].innerText = updatedData.DateIn;
        row.cells[5].innerText = updatedData.Warranty;
        row.cells[6].innerText = updatedData.SentBy;
        row.cells[7].innerText = updatedData.OutwardTo;
        row.cells[8].innerText = updatedData.Package;
        row.cells[9].innerText = updatedData.Tenure || "";
        row.cells[10].innerHTML = `<button class="status-btn ${
          updatedData.Status === "Active" ? "status-active" : "status-inactive"
        }" disabled>${updatedData.Status}</button>`;
        row.cells[11].innerHTML = `
          <button class="icon-btn edit-icon" onclick="editDevice('${deviceId}')">✏️</button>
          <button class="icon-btn delete-icon" onclick="deleteDevice('${deviceId}')">🗑️</button>
        `;
      } else {
        alert("Failed to save changes. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error updating device:", error);
      alert("An error occurred. Please try again.");
    });
}

function cancelEdit(deviceId) {
  // Reload the page to reset the changes (or implement inline reset)
  location.reload();
}

function deleteDevice(deviceId) {
  if (confirm("Are you sure you want to delete this device?")) {
    fetch(`/deviceInvy/delete_device/${deviceId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Remove the row from the table
          document.querySelector(`tr[data-id='${deviceId}']`).remove();
          alert("Device deleted successfully!");
        } else {
          alert("Error: " + data.message);
        }
      })
      .catch((error) => {
        console.error("Error deleting device:", error);
        alert("An error occurred. Please try again.");
      });
  }
}
