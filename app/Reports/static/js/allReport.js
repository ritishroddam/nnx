function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

const allowedFields = [
  "main_power",
  "i_btn",
  "mcc",
  "ignition",
  "Tenure",
  "gps",
  "gsm_sig",
  "arm",
  "sos",
  "harsh_speed",
  "odometer",
  "cellid",
  "internal_bat",
  "Package",
  "DateOfPurchase",
  "mnc",
  "DriverName",
  "InsuranceNumber",
  "sleep",
  "SIM",
  "ac",
  "longitude",
  "latitude",
  "speed",
  "door",
  "temp",
  "address",
  "Status",
  "MobileNumber",
  "VechicleType",
];

document.addEventListener("DOMContentLoaded", function () {
  // Initialize elements
  const reportModal = document.getElementById("reportModal");
  const customReportModal = document.getElementById("customReportModal");
  const fieldSelection = document.getElementById("fieldSelection");
  const selectedFields = document.getElementById("selectedFields");
  const customReportForm = document.getElementById("customReportForm");

  // Initialize Selectize for dropdowns
  $("select").selectize({
    create: false,
    sortField: "text",
  });

  // Modal open/close handlers
  document
    .querySelector('[data-report="custom"]')
    .addEventListener("click", function () {
      customReportModal.style.display = "block";
      loadFields();
    });

  document.querySelectorAll(".close").forEach((closeBtn) => {
    closeBtn.addEventListener("click", function () {
      customReportModal.style.display = "none";
      reportModal.style.display = "none";
    });
  });

  document.querySelectorAll(".cancel-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      customReportModal.style.display = "none";
      reportModal.style.display = "none";
    });
  });

  // Window click handler to close modals
  window.addEventListener("click", function (event) {
    if (event.target == reportModal) {
      reportModal.style.display = "none";
    }
    if (event.target == customReportModal) {
      customReportModal.style.display = "none";
    }
  });

  // Report card click handlers
  document.querySelectorAll(".report-card").forEach((card) => {
    card.addEventListener("click", function (e) {
      e.preventDefault();
      const reportType = this.dataset.report;
      const reportName = this.querySelector("h3").textContent;

      if (reportType === "custom") {
        fetch(
          `/reports/get_custom_report?name=${encodeURIComponent(reportName)}`
        )
          .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
          })
          .then((data) => {
            if (data.success) {
              openReportModal(reportName);
              document.getElementById("generateReport").dataset.reportType =
                reportType;
              document.getElementById("generateReport").dataset.reportName =
                reportName;
            } else {
              throw new Error(data.message || "Failed to load custom report");
            }
          })
          .catch((error) => {
            console.error("Error:", error);
            alert("Failed to load custom report configuration");
          });
      } else if (reportType === "panic") {
        console.log("reportType", reportType);
        openReportModal(reportName);
        document.getElementById("generateReport").dataset.reportType =
          reportType;
      } else {
        openReportModal(reportName);
        document.getElementById("generateReport").dataset.reportType =
          reportType;
      }
    });
  });

  // Generate report button handler
  document
    .getElementById("generateReport")
    .addEventListener("click", async function () {
      const reportType = this.dataset.reportType;
      const reportName = this.dataset.reportName;
      const vehicleNumber = document.getElementById("vehicleNumber").value;
      const dateRange = document.getElementById("dateRange").value;

      if (!vehicleNumber) {
        alert("Please select a vehicle number");
        return;
      }

      const generateBtn = this;
      const originalText = generateBtn.textContent;
      generateBtn.disabled = true;
      generateBtn.textContent = "Generating...";

      if (reportType === "panic") {
        await generatePanicReport();
        generateBtn.disabled = false; // Re-enable the button after completion
        generateBtn.textContent = originalText;
      } else {
        try {
          let endpoint = "/reports/download_custom_report";
          let body = {
            reportType: reportType,
            vehicleNumber: vehicleNumber,
            reportName: reportName,
            dateRange: dateRange,
          };

          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-TOKEN": getCookie("csrf_access_token"),
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to generate report");
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${
            reportType === "custom" ? reportName : reportType
          }_report_${vehicleNumber}.xlsx`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } catch (error) {
          console.error("Error:", error);
          alert(error.message || "Failed to generate report");
        } finally {
          generateBtn.disabled = false;
          generateBtn.textContent = originalText;
        }
      }
    });

  // Custom report form submission
  customReportForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const reportName = document.getElementById("reportName").value.trim();
    if (!reportName) {
      alert("Please provide a report name");
      return;
    }

    const fields = Array.from(selectedFields.children).map(
      (li) => li.dataset.field
    );
    if (fields.length === 0) {
      alert("Please select at least one field");
      return;
    }

    const saveBtn = document.getElementById("saveCustomReport");
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    fetch("/reports/save_custom_report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({
        reportName: reportName,
        fields: fields,
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          alert(data.message);
          createReportCard({ report_name: reportName, fields: fields });
          customReportModal.style.display = "none";
          customReportForm.reset();
          selectedFields.innerHTML = "";
        } else {
          throw new Error(data.message || "Failed to save report");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        alert(error.message);
      })
      .finally(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      });
  });

  // Field selection handling
  fieldSelection.addEventListener("change", function (e) {
    const field = e.target.value;

    if (e.target.checked) {
      const existingField = selectedFields.querySelector(
        `[data-field="${field}"]`
      );
      if (existingField) {
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
      removeButton.className = "btn btn-sm btn-danger";
      removeButton.style.marginLeft = "10px";

      removeButton.addEventListener("click", function () {
        selectedFields.removeChild(listItem);
        const checkbox = fieldSelection.querySelector(
          `input[value="${field}"]`
        );
        if (checkbox) {
          checkbox.checked = false;
          checkbox.parentElement.style.display = "block";
        }
      });

      listItem.appendChild(removeButton);

      // Drag and drop functionality
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
        if (draggedItem) {
          selectedFields.insertBefore(draggedItem, e.target);
        }
      });

      selectedFields.appendChild(listItem);
      e.target.parentElement.style.display = "none";
    } else {
      const listItem = selectedFields.querySelector(`[data-field="${field}"]`);
      if (listItem) selectedFields.removeChild(listItem);
      e.target.parentElement.style.display = "block";
    }
  });

  // Load custom reports on page load
  // fetch("/reports/get_custom_reports")
  //   .then(response => {
  //     if (!response.ok) throw new Error("Network response was not ok");
  //     return response.json();
  //   })
  //   .then(reports => {
  //     reports.forEach(report => {
  //       createReportCard(report);
  //     });
  //   })
  //   .catch(error => {
  //     console.error("Error loading custom reports:", error);
  //   });
});

// Helper functions
function createReportCard(report) {
  const existingCard = document.querySelector(
    `.report-card[data-report="${report.report_name}"]`
  );
  if (existingCard) return;

  const reportCard = document.createElement("a");
  reportCard.href = "#";
  reportCard.className = "report-card";
  reportCard.dataset.report = "custom";
  reportCard.innerHTML = `
    <h3>${report.report_name}</h3>
    <i class="fa-solid fa-file-alt"></i>
  `;

  const container = document.querySelector(".report-cards");
  container.insertBefore(reportCard, container.lastElementChild);
}

function openReportModal(reportName) {
  const modal = document.getElementById("reportModal");
  if (modal) {
    modal.querySelector("h2").textContent = reportName;
    modal.style.display = "block";
  }
}

async function generatePanicReport() {
  const vehicleNumber = document.getElementById("vehicleNumber").value;
  const dateRange = document.getElementById("dateRange").value;

  if (!vehicleNumber) {
    alert("Please select a vehicle first");
    return;
  }

  try {
    const response = await fetch("/reports/download_panic_report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({
        vehicleNumber: vehicleNumber,
        dateRange: dateRange || "all",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to generate panic report");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `panic_report_${vehicleNumber}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Error:", error);
    alert(error.message || "Failed to generate panic report");
  }
}

function loadFields() {
  fetch("/reports/get_fields")
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    })
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
    })
    .catch((error) => {
      console.error("Error loading fields:", error);
      alert("Failed to load available fields. Please try again.");
    });
}
