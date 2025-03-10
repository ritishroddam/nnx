document
  .getElementById("manualEntryBtn")
  .addEventListener("click", function () {
    document.getElementById("manualEntryForm").classList.toggle("hidden");
    document.getElementById("MobileNumber").focus();
  });

document.getElementById("cancelBtn").addEventListener("click", function () {
  document.getElementById("manualEntryForm").classList.add("hidden");
});

document.getElementById("uploadBtn").addEventListener("click", function () {
  document.getElementById("uploadFormContainer").classList.toggle("hidden");
});

document.getElementById("uploadForm").addEventListener("submit", function () {
  document.querySelector(".preloader").style.display = "block";
});

document
  .getElementById("downloadExcelBtn")
  .addEventListener("click", function () {
    window.location.href = "/simInvy/download_excel";
  });

document.addEventListener("DOMContentLoaded", function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const formattedToday = today.toISOString().split("T")[0];
  const dateInInput = document.getElementById("DateIn");
  const dateOutInput = document.getElementById("DateOut");

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
      var dateOutValue = dateOutInput.value.trim();

      var indianMobileRegex = /^[6-9]\d{9}$/;

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
      dateOutValue = formatDate(dateOutValue);

      const dateInObj = isValidDate(dateInValue) ? new Date(dateInValue) : null;
      const dateOutObj = isValidDate(dateOutValue)
        ? new Date(dateOutValue)
        : null;

      // Validate DateIn (should not be in the future)
      if (dateInObj && dateInObj > today) {
        alert("Future dates are not allowed for 'Date In'.");
        isValid = false;
      }

      // Validate DateOut (should not be in the future)
      if (dateOutObj && dateOutObj > today) {
        alert("Future dates are not allowed for 'Date Out'.");
        isValid = false;
      }

      // Ensure DateIn is earlier than DateOut
      if (dateInObj && dateOutObj && dateInObj >= dateOutObj) {
        alert("'Date In' must be earlier than 'Date Out'.");
        isValid = false;
      }

      // Validate Mobile Number
      if (!indianMobileRegex.test(mobileNumber)) {
        mobileError.textContent =
          "Please enter a valid 10-digit Indian mobile number.";
        mobileError.classList.remove("hidden");
        isValid = false;
      } else {
        mobileError.classList.add("hidden");
      }

      // Validate SIM Number (must be 20 digits)
      if (simNumber.length !== 20 || isNaN(simNumber)) {
        simError.textContent = "SIM Number must be exactly 20 digits.";
        simError.classList.remove("hidden");
        isValid = false;
      } else {
        simError.classList.add("hidden");
      }

      // Prevent form submission if any validation fails
      if (!isValid) {
        event.preventDefault();
      }
    });

  // Prevent manual future date entry
  function preventManualFutureDates(event) {
    const input = event.target;
    if (input.value) {
      const enteredDate = new Date(input.value);
      if (enteredDate > today) {
        alert("Future dates are not allowed.");
        input.value = formattedToday; // Reset to today
      }
    }
  }

  dateInInput.addEventListener("change", preventManualFutureDates);
  dateOutInput.addEventListener("change", preventManualFutureDates);
});

function editSim(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);

  // Store original values in custom attributes before editing
  row.setAttribute("data-original-mobile", row.cells[0].innerText);
  row.setAttribute("data-original-sim", row.cells[1].innerText);
  row.setAttribute("data-original-date-in", row.cells[2].innerText);
  row.setAttribute("data-original-date-out", row.cells[3].innerText);
  row.setAttribute("data-original-vendor", row.cells[4].innerText);

  // Replace row data with input fields
  row.cells[0].innerHTML = `<input type="text" value="${row.getAttribute(
    "data-original-mobile"
  )}" />`;
  row.cells[1].innerHTML = `<input type="text" value="${row.getAttribute(
    "data-original-sim"
  )}" />`;
  row.cells[2].innerHTML = `<input type="date" value="${row.getAttribute(
    "data-original-date-in"
  )}" id="editDateIn" />`;
  row.cells[3].innerHTML = `<input type="date" value="${row.getAttribute(
    "data-original-date-out"
  )}" />`;
  row.cells[4].innerHTML = `<input type="text" value="${row.getAttribute(
    "data-original-vendor"
  )}" />`;

  row.cells[5].innerHTML = `
    <button class="icon-btn save-icon" onclick="saveSim('${simId}')">💾</button>
    <button class="icon-btn cancel-icon" onclick="cancelEdit('${simId}')">❌</button>
  `;
}

function cancelEdit(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);

  // Restore original values from stored attributes
  row.cells[0].innerText = row.getAttribute("data-original-mobile");
  row.cells[1].innerText = row.getAttribute("data-original-sim");
  row.cells[2].innerText = row.getAttribute("data-original-date-in");
  row.cells[3].innerText = row.getAttribute("data-original-date-out");
  row.cells[4].innerText = row.getAttribute("data-original-vendor");

  // Restore action buttons
  row.cells[5].innerHTML = `
    <button class="icon-btn edit-icon" onclick="editSim('${simId}')">✏️</button>
    <button class="icon-btn delete-icon" onclick="deleteSim('${simId}')">🗑️</button>
  `;
}

function saveSim(simId) {
  const row = document.querySelector(`tr[data-id='${simId}']`);

  // Get updated data from input fields
  const mobileNumber = row.cells[0].querySelector("input").value.trim();
  const simNumber = row.cells[1].querySelector("input").value.trim();
  const dateIn = row.cells[2].querySelector("input").value.trim();
  const dateOut = row.cells[3].querySelector("input").value.trim();
  const vendor = row.cells[4].querySelector("input").value.trim();

  // Validation logic
  const errors = [];
  const indianMobileRegex = /^[6-9]\d{9}$/; // Validates 10-digit Indian mobile numbers

  if (!indianMobileRegex.test(mobileNumber)) {
    errors.push(
      "Invalid Mobile Number: Must be a valid 10-digit Indian number."
    );
  }
  if (simNumber.length !== 20 || isNaN(simNumber)) {
    errors.push("Invalid SIM Number: Must be exactly 20 digits.");
  }
  if (!dateIn) {
    errors.push("Date In is required.");
  }
  if (!vendor) {
    errors.push("Vendor is required.");
  }

  // Show errors and stop if validation fails
  if (errors.length > 0) {
    alert(errors.join("\n"));
    return;
  }

  // Create updated data object
  const updatedData = {
    MobileNumber: mobileNumber,
    SimNumber: simNumber,
    DateIn: dateIn,
    DateOut: dateOut,
    Vendor: vendor,
  };

  // Send the updated data to the server
  fetch(`/simInvy/edit_sim/${simId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatedData),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Update the table row with the new values
        row.cells[0].innerText = updatedData.MobileNumber;
        row.cells[1].innerText = updatedData.SimNumber;
        row.cells[2].innerText = updatedData.DateIn;
        row.cells[3].innerText = updatedData.DateOut;
        row.cells[4].innerText = updatedData.Vendor;

        // Restore the action buttons
        row.cells[5].innerHTML = `
          <button class="icon-btn edit-icon" onclick="editSim('${simId}')">✏️</button>
          <button class="icon-btn delete-icon" onclick="deleteSim('${simId}')">🗑️</button>
        `;
      } else {
        alert("Failed to save the changes. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error updating SIM:", error);
      alert("An error occurred. Please try again.");
    });
}

function deleteSim(simId) {
  if (confirm("Are you sure you want to delete this SIM?")) {
    fetch(`/simInvy/delete_sim/${simId}`, {
      method: "DELETE",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          document.querySelector(`tr[data-id='${simId}']`).remove();
        } else {
          alert("Failed to delete the SIM. Please try again.");
        }
      })
      .catch((error) => {
        console.error("Error deleting SIM:", error);
        alert("An error occurred. Please try again.");
      });
  }
}
