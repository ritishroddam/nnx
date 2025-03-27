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

  // Load fields dynamically from backend
  function loadFields() {
    fetch("/reports/get_fields")
      .then((response) => response.json())
      .then((fields) => {
        const allowedFields = [
          "TravelPath",
          "Distance",
          "Speed",
          "Stoppage",
          "Idle",
          "Ignition",
          "Panic",
          "Daily",
        ];
        const filteredFields = fields.filter((field) =>
          allowedFields.includes(field)
        );

        fieldSelection.innerHTML = "";
        filteredFields.forEach((field) => {
          const fieldItem = document.createElement("div");
          fieldItem.className = "field-item";
          fieldItem.innerHTML = `
                        <input type="checkbox" id="${field}" value="${field}" />
                        <label for="${field}">${field}</label>
                    `;
          fieldSelection.appendChild(fieldItem);
        });
      });
  }

  // Handle field selection
  fieldSelection.addEventListener("change", function (e) {
    const field = e.target.value;
    if (e.target.checked) {
      const listItem = document.createElement("li");
      listItem.textContent = field;
      listItem.dataset.field = field;
      listItem.draggable = true;

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
    } else {
      const listItem = selectedFields.querySelector(`[data-field="${field}"]`);
      if (listItem) selectedFields.removeChild(listItem);
    }
  });

  // Save custom report
  customReportForm.onsubmit = function (e) {
    e.preventDefault();
    const reportName = document.getElementById("reportName").value;
    const iconValue = document.getElementById("iconValue").value;
    const fields = Array.from(selectedFields.children).map(
      (li) => li.dataset.field
    );

    fetch("/reports/save_custom_report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportName, iconValue, fields }),
    })
      .then((response) => response.json())
      .then((data) => {
        alert(data.message);
        customReportModal.style.display = "none";
        createReportCard(reportName, iconValue);
      });
  };

  // Create a new report card dynamically
  function createReportCard(reportName, iconValue) {
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
