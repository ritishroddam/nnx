// Get the modal
var modal = document.getElementById("reportModal");

// Get the button that opens the modal
var reportCards = document.querySelectorAll(".report-card");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks on the button, open the modal
reportCards.forEach(function (card) {
  card.onclick = function () {
    modal.style.display = "block";
  };
});

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modal.style.display = "none";
};

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

// Handle cancel button click
document.querySelector(".cancel-btn").onclick = function () {
  modal.style.display = "none";
};

document.getElementById("generateReport").onclick = function () {
  const fields = Array.from(selectedFields.children).map(
    (li) => li.dataset.field
  );

  fetch("/reports/download_custom_report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  })
    .then((response) => response.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Custom_Report.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
};

document.addEventListener("DOMContentLoaded", function () {
  const customReportModal = document.getElementById("customReportModal");
  const customReportForm = document.getElementById("customReportForm");
  const fieldSelection = document.getElementById("fieldSelection");
  const selectedFields = document.getElementById("selectedFields");
  const reportCardsContainer = document.querySelector(".report-cards");

  // Open modal for custom report
  document.querySelector('[data-report="custom"]').onclick = function () {
    customReportModal.style.display = "block";
    loadFields(); // Load fields dynamically
  };

  // Close modal
  document.querySelector(".close").onclick = function () {
    customReportModal.style.display = "none";
  };

  // // Load fields dynamically from backend
  // function loadFields() {
  //   fetch("/reports/get_fields")
  //     .then((response) => response.json())
  //     .then((fields) => {
  //       fieldSelection.innerHTML = "";
  //       fields.forEach((field) => {
  //         const fieldItem = document.createElement("div");
  //         fieldItem.className = "field-item";
  //         fieldItem.innerHTML = `
  //                       <input type="checkbox" id="${field}" value="${field}" />
  //                       <label for="${field}">${field}</label>
  //                   `;
  //         fieldSelection.appendChild(fieldItem);
  //       });
  //     });
  // }

  // // Handle field selection
  // fieldSelection.addEventListener("change", function (e) {
  //   const field = e.target.value;
  //   if (e.target.checked) {
  //     const listItem = document.createElement("li");
  //     listItem.textContent = field;
  //     listItem.dataset.field = field;
  //     listItem.draggable = true;

  //     // Add drag-and-drop functionality
  //     listItem.addEventListener("dragstart", (e) => {
  //       e.dataTransfer.setData("text/plain", e.target.dataset.field);
  //     });
  //     listItem.addEventListener("dragover", (e) => e.preventDefault());
  //     listItem.addEventListener("drop", (e) => {
  //       e.preventDefault();
  //       const draggedField = e.dataTransfer.getData("text/plain");
  //       const draggedItem = selectedFields.querySelector(
  //         `[data-field="${draggedField}"]`
  //       );
  //       selectedFields.insertBefore(draggedItem, e.target);
  //     });

  //     selectedFields.appendChild(listItem);
  //   } else {
  //     const listItem = selectedFields.querySelector(`[data-field="${field}"]`);
  //     if (listItem) selectedFields.removeChild(listItem);
  //   }
  // });

  // Define the allowed fields
const allowedFields = [
  "main_power", "i_btn", "mcc", "ignition", "Tenure", "gps", "gsm_sig", "arm", "date", "time", "sos", 
  "harsh_speed", "odometer", "cellid", "internal_bat", "Package", "DateOfPurchase", "mnc", "r1", "r2", 
  "r3", "YearOfManufacture", "DriverName", "InsuranceNumber", "sleep", "dir1", "SIM", "LicensePlateNumber", 
  "ac", "longitude", "latitude", "speed", "door", "temp", "address", "Status", "MobileNumber"
];

// Load fields dynamically from backend
function loadFields() {
  fetch("/reports/get_fields")
    .then((response) => response.json())
    .then((fields) => {
      fieldSelection.innerHTML = "";
      const filteredFields = fields.filter((field) => allowedFields.includes(field));
      filteredFields.forEach((field) => {
        const fieldItem = document.createElement("div");
        fieldItem.className = "field-item";
        fieldItem.style.cssText = `
          padding: 10px;
          margin: 5px;
          border: 1px solid #ccc;
          border-radius: 5px;
          background-color: #f9f9f9;
          cursor: pointer;
        `;
        fieldItem.innerHTML = `
          <input type="checkbox" id="${field}" value="${field}" />
          <label for="${field}" style="margin-left: 5px;">${field}</label>
        `;
        fieldSelection.appendChild(fieldItem);
      });
    });
}

// Handle field selection
// Handle field selection
fieldSelection.addEventListener("change", function (e) {
  const field = e.target.value;

  // Debugging: Log the field and its state
  console.log("Field changed:", field, "Checked:", e.target.checked);

  // Check if the field is already in the selected list
  if (e.target.checked) {
    const existingField = selectedFields.querySelector(`[data-field="${field}"]`);
    if (existingField) {
      console.log("Duplicate field detected:", field); // Debugging
      alert("This field is already selected.");
      e.target.checked = false; // Uncheck the checkbox
      return; // Stop further execution
    }

    // Create a new list item for the selected field
    const listItem = document.createElement("li");
    listItem.textContent = field;
    listItem.dataset.field = field;
    listItem.draggable = true;
    listItem.style.cssText = `
      padding: 10px;
      margin: 5px;
      border: 1px solid #007bff;
      border-radius: 5px;
      background-color: #e7f3ff;
      cursor: grab;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    // Add a "Remove" button
    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.style.cssText = `
      margin-left: 10px;
      padding: 5px 10px;
      background-color: #dc3545;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    `;
    removeButton.onclick = function () {
      selectedFields.removeChild(listItem);
      const checkbox = fieldSelection.querySelector(`input[value="${field}"]`);
      if (checkbox) {
        checkbox.checked = false;
        checkbox.parentElement.style.display = "block"; // Show the field back in the selection list
      }
    };

    listItem.appendChild(removeButton);

    // Add drag-and-drop functionality
    listItem.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", e.target.dataset.field);
    });
    listItem.addEventListener("dragover", (e) => e.preventDefault());
    listItem.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedField = e.dataTransfer.getData("text/plain");
      const draggedItem = selectedFields.querySelector(
        `[data-field="${draggedField}"]`
      );
      selectedFields.insertBefore(draggedItem, e.target);
    });

    selectedFields.appendChild(listItem);
    e.target.parentElement.style.display = "none"; // Hide the field from the selection list
  } else {
    // Remove the field from the selected list
    const listItem = selectedFields.querySelector(`[data-field="${field}"]`);
    if (listItem) selectedFields.removeChild(listItem);
    e.target.parentElement.style.display = "block"; // Show the field back in the selection list
  }
});

  // Save custom report
  customReportForm.onsubmit = function (e) {
    e.preventDefault();
  
    // Retrieve the report name input
    const reportNameInput = document.getElementById("reportName");
    if (!reportNameInput) {
      alert("Report Name input is missing!");
      return;
    }
  
    const reportName = reportNameInput.value.trim();
    if (!reportName) {
      alert("Please provide a valid report name.");
      return;
    }
  
    // Retrieve the selected fields and remove duplicates
    const fields = Array.from(new Set(Array.from(selectedFields.children).map(
      (li) => li.dataset.field
    )));
  
    if (fields.length === 0) {
      alert("Please select at least one field.");
      return;
    }
  
    console.log("Saving report with the following data:", { reportName, fields });
  
    fetch("/reports/save_custom_report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportName, fields }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert(data.message);
          customReportModal.style.display = "none";
          createReportCard(reportName);
        } else {
          alert("Failed to save the report. Please try again.");
        }
      })
      .catch((error) => {
        console.error("Error saving the report:", error);
        alert("An error occurred while saving the report.");
      });
  };

  // Handle field selection
  fieldSelection.addEventListener("change", function (e) {
    const field = e.target.value;
  
    // Check if the field is already in the selected list
    if (e.target.checked) {
      // Prevent duplicate entries
      if (selectedFields.querySelector(`[data-field="${field}"]`)) {
        alert("This field is already selected.");
        e.target.checked = false; // Uncheck the checkbox
        return; // Stop further execution
      }
  
      // Create a new list item for the selected field
      const listItem = document.createElement("li");
      listItem.textContent = field;
      listItem.dataset.field = field;
      listItem.draggable = true;
      listItem.style.cssText = `
        padding: 10px;
        margin: 5px;
        border: 1px solid #007bff;
        border-radius: 5px;
        background-color: #e7f3ff;
        cursor: grab;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
  
      // Add a "Remove" button
      const removeButton = document.createElement("button");
      removeButton.textContent = "Remove";
      removeButton.style.cssText = `
        margin-left: 10px;
        padding: 5px 10px;
        background-color: #dc3545;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
      `;
      removeButton.onclick = function () {
        selectedFields.removeChild(listItem);
        const checkbox = fieldSelection.querySelector(`input[value="${field}"]`);
        if (checkbox) {
          checkbox.checked = false;
          checkbox.parentElement.style.display = "block"; // Show the field back in the selection list
        }
      };
  
      listItem.appendChild(removeButton);
  
      // Add drag-and-drop functionality
      listItem.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", e.target.dataset.field);
      });
      listItem.addEventListener("dragover", (e) => e.preventDefault());
      listItem.addEventListener("drop", (e) => {
        e.preventDefault();
        const draggedField = e.dataTransfer.getData("text/plain");
        const draggedItem = selectedFields.querySelector(
          `[data-field="${draggedField}"]`
        );
        selectedFields.insertBefore(draggedItem, e.target);
      });
  
      selectedFields.appendChild(listItem);
      e.target.parentElement.style.display = "none"; // Hide the field from the selection list
    } else {
      // Remove the field from the selected list
      const listItem = selectedFields.querySelector(`[data-field="${field}"]`);
      if (listItem) selectedFields.removeChild(listItem);
      e.target.parentElement.style.display = "block"; // Show the field back in the selection list
    }
  });

  // Create a new report card dynamically
  function createReportCard(reportName) {
    const reportCard = document.createElement("a");
    reportCard.href = "#";
    reportCard.className = "report-card";
    reportCard.dataset.report = reportName;
    reportCard.innerHTML = `
            <h3>${reportName}</h3>
            <i class="fa-solid ${iconValue}"></i>
        `;
    reportCard.onclick = function () {
      openReportModal(reportName);
    };
    reportCardsContainer.appendChild(reportCard);
  }

  // Open report modal for custom report
  function openReportModal(reportName) {
    const reportModal = document.getElementById("reportModal");
    reportModal.querySelector("h2").textContent = `Generate ${reportName}`;
    reportModal.style.display = "block";

    document.getElementById("generateReport").onclick = function () {
      const vehicleNumber = document.getElementById("vehicleNumber").value;
      fetch("/reports/download_custom_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportName, vehicleNumber }),
      })
        .then((response) => response.blob())
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${reportName}.xlsx`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        });
    };
  }

  $("select").selectize({
    create: false,
    sortField: "text",
  });
});
