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
  const existingCard = document.querySelector(`.report-card[data-report="${report.report_name}"]`);
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

document.getElementById("generateReport").onclick = function () {
  const fields = Array.from(selectedFields.children).map((li) => li.dataset.field);
  const vehicleNumber = document.getElementById("vehicleNumber").value;
  const dateRange = document.getElementById("dateRange").value;
  const reportName = document.querySelector("#reportModal h2").textContent.replace("Generate ", "").trim();

  if (!vehicleNumber) {
    alert("Please select a vehicle number");
    return;
  }

  fetch("/reports/download_custom_report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      reportName, 
      vehicleNumber,
      dateRange,
      fields  
    }),
  })

    .then((response) => { 
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    })
    .catch(error => {
      console.error("Error:", error);
      alert("Failed to generate report");
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

  document.getElementById("reportForm").addEventListener("submit", function(e) {
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
      const existingField = selectedFields.querySelector(`[data-field="${field}"]`);
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
        const draggedItem = selectedFields.querySelector(`[data-field="${draggedField}"]`);
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

    fetch("/reports/save_custom_report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportName, fields }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to save the report.");
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          alert(data.message);
          // Create a new card for the saved report
          createReportCard({ report_name: reportName });
          customReportModal.style.display = "none";
        } else {
          console.error("Failed to save the report:", data);
          alert(data.message || "Failed to save the report. Please try again.");
        }
      })
      .catch((error) => {
        console.error("Error saving the report:", error);
        alert("An error occurred while saving the report.");
      });
  };

  // Load existing custom reports when page loads
  fetch("/reports/get_custom_reports")
    .then(response => response.json())
    .then(reports => {
      reports.forEach(report => {
        createReportCard(report);
      });
    });

  $("select").selectize({
    create: false,
    sortField: "text",
  });

});
