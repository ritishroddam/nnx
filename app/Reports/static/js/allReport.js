function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

var modal = document.getElementById("reportModal");

var reportCards = document.querySelectorAll(".report-card");

var span = document.getElementsByClassName("close")[0];

reportCards.forEach(function (card) {
  card.onclick = function () {
    modal.style.display = "block";
  };
});

span.onclick = function () {
  modal.style.display = "none";
};

window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

document.querySelector(".cancel-btn").onclick = function () {
  const modal = document.getElementById("customReportModal"); // Make sure to select the modal
  if (modal) {
    modal.style.display = "none";
  } else {
    console.error("Modal not found!");
  }
};

function createReportCard(report) {
  const existingCard = document.querySelector(
    `.report-card[data-report="${report.report_name}"]`
  );
  if (existingCard) return; // Avoid duplicates
  const reportCard = document.createElement("a");
  reportCard.href = "#";
  reportCard.className = "report-card";
  reportCard.dataset.report = report.report_name;
  console.log("Creating report card for:", report.report_name); // Debug print statement
  reportCard.innerHTML = `
  <h3>${report.report_name}</h3>
  <i class="fa-solid fa-file-alt"></i>
  `;
  reportCard.onclick = function () {
    console.log("Creating report card for:", report.report_name); // Debug print statement
    openReportModal(report.report_name);
  };
  document.querySelector(".report-cards").appendChild(reportCard);
}

function openReportModal(reportName) {
  console.log("Opening report modal with report name:", reportName); // Debug print statement
  const reportModal = document.getElementById("reportModal");

  if (reportModal) {
    reportModal.querySelector("h2").textContent = `${reportName}`;
  } else {
    console.error("Report modal not found!");
  }

  reportModal.style.display = "block";
}

// document.getElementById("generateReport").onclick = function () {
//   const reportName = document
//     .querySelector("#reportModal h2")
//     .textContent.replace("Generate ", "")
//     .trim();
//   const vehicleNumber = document.getElementById("vehicleNumber").value;
//   const dateRange = document.getElementById("dateRange").value;

//   if (!vehicleNumber) {
//     alert("Please select a vehicle number");
//     return;
//   }

//   // Show loading indicator
//   const generateBtn = document.getElementById("generateReport");
//   const originalText = generateBtn.textContent;
//   generateBtn.disabled = true;
//   generateBtn.textContent = "Generating...";

//   fetch("/reports/download_custom_report", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       "X-CSRF-TOKEN": getCookie("csrf_access_token"),
//     },
//     body: JSON.stringify({
//       reportName,
//       vehicleNumber,
//       dateRange,
//     }),
//   })
//     .then((response) => {
//       if (!response.ok) {
//         return response.json().then((err) => {
//           throw err;
//         });
//       }
//       return response.blob();
//     })
//     .then((blob) => {
//       if (blob.size === 0) {
//         throw new Error("Empty file received");
//       }
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       a.href = url;
//       a.download = `${reportName}.xlsx`;
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(url);
//       document.body.removeChild(a);
//     })
//     .catch((error) => {
//       console.error("Error:", error);
//       const message = error.message || "Failed to generate report";
//       alert(message);
//     })
//     .finally(() => {
//       generateBtn.disabled = false;
//       generateBtn.textContent = originalText;
//     });
// };

// Modify the report card click handlers
document.querySelectorAll('.report-card').forEach(card => {
  card.onclick = function() {
      const reportType = this.dataset.report;
      
      if (reportType === 'custom') {
          // Existing custom report logic
          const reportName = this.querySelector('h3').textContent;
          openReportModal(reportName);
      } else {
          // For other report types
          openGenericReportModal(reportType);
      }
  };
});

function openGenericReportModal(reportType) {
  const modal = document.getElementById("reportModal");
  const titleMap = {
      'daily-distance': 'Travel Path Report',
      'odometer-daily-distance': 'Distance Report',
      'distance-speed-range': 'Speed Report',
      'stoppage': 'Stoppage Report',
      'idle': 'Idle Report',
      'ignition': 'Ignition Report',
      'daily': 'Daily Report',
      'sos': 'Panic Report'
  };
  
  modal.querySelector("h2").textContent = titleMap[reportType] || 'Generate Report';
  modal.style.display = "block";
  
  // Store the report type in the generate button
  document.getElementById("generateReport").dataset.reportType = reportType;
}

// Update the generate report function
document.getElementById("generateReport").onclick = function() {
  const reportType = this.dataset.reportType;
  const vehicleNumber = document.getElementById("vehicleNumber").value;
  const dateRange = document.getElementById("dateRange").value;
  
  if (!vehicleNumber) {
      alert("Please select a vehicle number");
      return;
  }
  
  // Determine endpoint
  const endpointMap = {
      'daily-distance': '/reports/download_travel_path_report',
      'odometer-daily-distance': '/reports/download_distance_report',
      'distance-speed-range': '/reports/download_speed_report',
      'stoppage': '/reports/download_stoppage_report',
      'idle': '/reports/download_idle_report',
      'ignition': '/reports/download_ignition_report',
      'daily': '/reports/download_daily_report',
      'sos': '/reports/download_panic_report'
  };
  
  const endpoint = endpointMap[reportType] || '/reports/download_custom_report';
  
  // Show loading state
  const generateBtn = this;
  const originalText = generateBtn.textContent;
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  
  fetch(endpoint, {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({
          vehicleNumber,
          dateRange
      }),
  })
  .then(response => {
      if (!response.ok) {
          return response.json().then(err => {
              throw new Error(err.message || "Failed to generate report");
          });
      }
      return response.blob();
  })
  .then(blob => {
      if (blob.size === 0) {
          throw new Error("Empty file received");
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_report_${vehicleNumber}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
  })
  .catch(error => {
      console.error("Error:", error);
      alert(error.message || "Failed to generate report");
  })
  .finally(() => {
      generateBtn.disabled = false;
      generateBtn.textContent = originalText;
  });
};


document.addEventListener("DOMContentLoaded", function () {
  const customReportModal = document.getElementById("customReportModal");
  const customReportForm = document.getElementById("customReportForm");
  const fieldSelection = document.getElementById("fieldSelection");
  const selectedFields = document.getElementById("selectedFields");
  const reportCardsContainer = document.querySelector(".report-cards");
  const customReportsContainer = document.getElementById(
    "custom-reports-container"
  );

  const allowedFields = [
    "main_power",
    "i_btn",
    "mcc",
    "ignition",
    "Tenure",
    "gps",
    "gsm_sig",
    "arm",
    "date",
    "time",
    "sos",
    "harsh_speed",
    "odometer",
    "cellid",
    "internal_bat",
    "Package",
    "DateOfPurchase",
    "mnc",
    "r1",
    "r2",
    "r3",
    "YearOfManufacture",
    "DriverName",
    "InsuranceNumber",
    "sleep",
    "dir1",
    "SIM",
    "LicensePlateNumber",
    "ac",
    "longitude",
    "latitude",
    "speed",
    "door",
    "temp",
    "address",
    "Status",
    "MobileNumber",
  ];

  document.querySelector('[data-report="custom"]').onclick = function () {
    customReportModal.style.display = "block";
    loadFields();
  };

  document.querySelector(".close").onclick = function () {
    customReportModal.style.display = "none";
  };

  document
    .getElementById("reportForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();
    });

  function loadFields() {
    fetch("/reports/get_fields")
      .then((response) => response.json())
      .then((fields) => {
        fieldSelection.innerHTML = "";
        const filteredFields = fields.filter((field) =>
          allowedFields.includes(field)
        );
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

  fieldSelection.addEventListener("change", function (e) {
    const field = e.target.value;

    // console.log("Field changed:", field, "Checked:", e.target.checked);

    if (e.target.checked) {
      const existingField = selectedFields.querySelector(
        `[data-field="${field}"]`
      );
      if (existingField) {
        console.log("Duplicate field detected:", field);
        alert("This field is already selected.");
        e.target.checked = false;
        return;
      }

      const listItem = document.createElement("li");
      listItem.textContent = field;
      listItem.dataset.field = field;
      listItem.draggable = true;

      const removeButton = document.createElement("button");
      removeButton.textContent = "Remove";

      removeButton.onclick = function () {
        selectedFields.removeChild(listItem);
        const checkbox = fieldSelection.querySelector(
          `input[value="${field}"]`
        );
        if (checkbox) {
          checkbox.checked = false;
          checkbox.parentElement.style.display = "block";
        }
      };

      listItem.appendChild(removeButton);

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
      e.target.parentElement.style.display = "none";
    } else {
      const listItem = selectedFields.querySelector(`[data-field="${field}"]`);
      if (listItem) selectedFields.removeChild(listItem);
      e.target.parentElement.style.display = "block";
    }
  });

  customReportForm.onsubmit = function (e) {
    e.preventDefault();

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

    const fields = Array.from(
      new Set(Array.from(selectedFields.children).map((li) => li.dataset.field))
    );

    if (fields.length === 0) {
      alert("Please select at least one field.");
      return;
    }

    // Show loading state
    const saveBtn = document.getElementById("saveCustomReport");
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    fetch("/reports/save_custom_report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        Accept: "application/json",
      },
      credentials: "include", // Include cookies in the request
      body: JSON.stringify({ reportName, fields }),
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          // Use server-provided message if available
          throw new Error(data.message || "Failed to save report");
        }
        return data;
      })
      .then((data) => {
        alert(data.message);
        createReportCard({ report_name: reportName });
        customReportModal.style.display = "none";
      })
      .catch((error) => {
        console.error("Error saving the report:", error);
        alert("An error occurred while saving the report.");
      })
      .finally(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      });
  };

  fetch("/reports/get_custom_reports")
    .then((response) => response.json())
    .then((reports) => {
      reports.forEach((report) => {
        createReportCard(report);
      });
    });

  $("select").selectize({
    create: false,
    sortField: "text",
  });
});
