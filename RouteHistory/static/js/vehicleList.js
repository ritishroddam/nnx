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
    document.getElementById("manualEntryForm").classList.remove("hidden");
    // Focus on the IMEI input field
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
    var glNumber = document.getElementById("GLNumber").value;
    var imeiError = document.getElementById("imeiError");
    var glError = document.getElementById("glError");

    // IMEI validation
    if (imei.length !== 15 || isNaN(imei)) {
      imeiError.classList.remove("hidden");
      event.preventDefault();
    } else {
      imeiError.classList.add("hidden");
    }

    // GL Number validation
    if (glNumber.length !== 13 || isNaN(glNumber)) {
      glError.classList.remove("hidden");
      event.preventDefault();
    } else {
      glError.classList.add("hidden");
    }
  });

function editDevice(deviceId) {
  const row = document.querySelector(`tr[data-id='${deviceId}']`);

  const imei = row.cells[0].innerText;
  const glNumber = row.cells[1].innerText;
  const deviceModel = row.cells[2].innerText;
  const deviceMake = row.cells[3].innerText;
  const dateIn = row.cells[4].innerText;
  const warranty = row.cells[5].innerText;
  const sentBy = row.cells[6].innerText;
  const outwardTo = row.cells[7].innerText;
  const status = row.cells[8].innerText;

  row.cells[0].innerHTML = `<input type="text" value="${imei}" />`;
  row.cells[1].innerHTML = `<input type="text" value="${glNumber}" />`;
  row.cells[2].innerHTML = `<input type="text" value="${deviceModel}" />`;
  row.cells[3].innerHTML = `<input type="text" value="${deviceMake}" />`;
  row.cells[4].innerHTML = `<input type="date" value="${dateIn}" />`;
  row.cells[5].innerHTML = `<input type="date" value="${warranty}" />`;
  row.cells[6].innerHTML = `<input type="text" value="${sentBy}" />`;
  row.cells[7].innerHTML = `<input type="text" value="${outwardTo}" />`;
  row.cells[8].innerHTML = `
<input type="radio" name="status-${deviceId}" value="Active" ${
    status === "Active" ? "checked" : ""
  } /> Active
<input type="radio" name="status-${deviceId}" value="Inactive" ${
    status === "Inactive" ? "checked" : ""
  } /> Inactive
`;

  row.cells[9].innerHTML = `
<button class="icon-btn save-icon" onclick="saveDevice('${deviceId}')">💾</button>
<button class="icon-btn delete-icon" onclick="deleteDevice('${deviceId}')">🗑️</button>
`;
}

function saveDevice(deviceId) {
  const row = document.querySelector(`tr[data-id='${deviceId}']`);

  const updatedData = {
    IMEI: row.cells[0].querySelector("input").value,
    GLNumber: row.cells[1].querySelector("input").value,
    DeviceModel: row.cells[2].querySelector("input").value,
    DeviceMake: row.cells[3].querySelector("input").value,
    DateIn: row.cells[4].querySelector("input").value,
    Warranty: row.cells[5].querySelector("input").value,
    SentBy: row.cells[6].querySelector("input").value,
    OutwardTo: row.cells[7].querySelector("input").value,
    Status: row.cells[8].querySelector(
      'input[name="status-' + deviceId + '"]:checked'
    ).value,
  };

  fetch(`/routeHistory/edit_device/${deviceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatedData),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        row.cells[0].innerText = updatedData.IMEI;
        row.cells[1].innerText = updatedData.GLNumber;
        row.cells[2].innerText = updatedData.DeviceModel;
        row.cells[3].innerText = updatedData.DeviceMake;
        row.cells[4].innerText = updatedData.DateIn;
        row.cells[5].innerText = updatedData.Warranty;
        row.cells[6].innerText = updatedData.SentBy;
        row.cells[7].innerText = updatedData.OutwardTo;
        row.cells[8].innerHTML = `
  <button class="status-btn ${
    updatedData.Status === "Active" ? "status-active" : "status-inactive"
  }" disabled>${updatedData.Status}</button>
`;
        row.cells[9].innerHTML = `
  <button class="icon-btn edit-icon" onclick="editDevice('${deviceId}')">✏️</button>
  <button class="icon-btn delete-icon" onclick="deleteDevice('${deviceId}')">🗑️</button>
`;
      } else {
        alert("Failed to save the device.");
      }
    });
}

function deleteDevice(deviceId) {
  if (confirm("Are you sure you want to delete this device?")) {
    fetch(`/routeHistory/delete_device/${deviceId}`, {
      method: "DELETE",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          document.querySelector(`tr[data-id='${deviceId}']`).remove();
        } else {
          alert("Failed to delete the device.");
        }
      });
  }
}
