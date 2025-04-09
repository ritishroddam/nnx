// function getCookie(name) {
//   const value = `; ${document.cookie}`;
//   const parts = value.split(`; ${name}=`);
//   if (parts.length === 2) return parts.pop().split(";").shift();
// }

// var modal = document.getElementById("reportModal");

// var reportCards = document.querySelectorAll(".report-card");

// var span = document.getElementsByClassName("close")[0];

// reportCards.forEach(function (card) {
//   card.onclick = function () {
//     modal.style.display = "block";
//   };
// });

// span.onclick = function () {
//   modal.style.display = "none";
// };

// window.onclick = function (event) {
//   if (event.target == modal) {
//     modal.style.display = "none";
//   }
// };

// document.querySelector(".cancel-btn").onclick = function () {
//   const modal = document.getElementById("customReportModal"); // Make sure to select the modal
//   if (modal) {
//     modal.style.display = "none";
//   } else {
//     console.error("Modal not found!");
//   }
// };

// function createReportCard(report) {
//   const existingCard = document.querySelector(
//     `.report-card[data-report="${report.report_name}"]`
//   );
//   if (existingCard) return;
  
//   const reportCard = document.createElement("a");
//   reportCard.href = "#";
//   reportCard.className = "report-card";
//   reportCard.dataset.report = report.report_name;
//   reportCard.dataset.reportType = "custom";
  
//   reportCard.innerHTML = `
//     <h3>${report.report_name}</h3>
//     <i class="fa-solid fa-file-alt"></i>
//   `;
  
//   document.querySelector(".report-cards").appendChild(reportCard);
// }

// function openReportModal(reportName) {
//   const reportModal = document.getElementById("reportModal");
//   if (reportModal) {
//     reportModal.querySelector("h2").textContent = `${reportName}`;
//     reportModal.style.display = "block";
//   }
// }

// // Modify the report card click handlers
// document.querySelectorAll('.report-card').forEach(card => {
//   card.onclick = function() {
//     const reportType = this.dataset.report;
//     const reportName = this.querySelector('h3').textContent;
    
//     if (reportType === 'custom') {
//       openReportModal(reportName);
//       document.getElementById("generateReport").dataset.reportType = 'custom';
//       document.getElementById("generateReport").dataset.reportName = reportName;
//     } else if (reportType === 'sos') {
//       generatePanicReport();
//     } else {
//       openReportModal(reportName);
//       document.getElementById("generateReport").dataset.reportType = reportType;
//     }
//   };
// });

// function openGenericReportModal(reportType) {
//   const modal = document.getElementById("reportModal");
//   const titleMap = {
//     'travel-path': 'Travel Path Report',
//     'distance': 'Distance Report',
//     'speed': 'Speed Report',
//     'stoppage': 'Stoppage Report',
//     'idle': 'Idle Report',
//     'ignition': 'Ignition Report',
//     'daily': 'Daily Report',
//     'panic': 'Panic Report'
//   };
  
//   modal.querySelector("h2").textContent = titleMap[reportType] || 'Generate Report';
//   modal.style.display = "block";
// }
//   // Modal close handlers
//   span.onclick = function() {
//     modal.style.display = "none";
//     customReportModal.style.display = "none";
//   };

//   window.onclick = function(event) {
//     if (event.target == modal) {
//       modal.style.display = "none";
//     }
//     if (event.target == customReportModal) {
//       customReportModal.style.display = "none";
//     }
//   };

//   document.getElementById("generateReport").onclick = async function() {
//     const reportType = this.dataset.reportType;
//     const reportName = this.dataset.reportName;
//     const vehicleNumber = document.getElementById("vehicleNumber").value;
//     const dateRange = document.getElementById("dateRange").value;

//     if (!vehicleNumber) {
//       alert("Please select a vehicle number");
//       return;
//     }

//     // Show loading state
//     const generateBtn = this;
//     const originalText = generateBtn.textContent;
//     generateBtn.disabled = true;
//     generateBtn.textContent = "Generating...";

//     try {
//       const response = await fetch('/reports/download_custom_report', {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           "X-CSRF-TOKEN": getCookie("csrf_access_token"),
//         },
//         body: JSON.stringify({
//           reportName: reportType,
//           vehicleNumber,
//           dateRange
//         }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(errorText || "Failed to generate report");
//       }

//       const blob = await response.blob();
//         const url = window.URL.createObjectURL(blob);
//         const a = document.createElement("a");
//         a.href = url;
//         a.download = `${reportType}_report_${vehicleNumber}.xlsx`;
//         document.body.appendChild(a);
//         a.click();
//         window.URL.revokeObjectURL(url);
//         document.body.removeChild(a);

//     } catch (error) {
//         console.error("Error details:", error);
//         // Extract JSON error message if present
//         try {
//             const errorData = JSON.parse(error.message);
//             alert(`Error: ${errorData.message || "Unknown error"}`);
//         } catch {
//             alert(`Error: ${error.message || "Failed to generate report"}`);
//         }
//     } finally {
//         generateBtn.disabled = false;
//         generateBtn.textContent = originalText;
//     }
// };

//   // Panic report function
//   async function generatePanicReport() {
//     const vehicleNumber = document.getElementById("vehicleNumber").value;
//     const dateRange = document.getElementById("dateRange").value;
    
//     if (!vehicleNumber) {
//         alert("Please select a vehicle");
//         return;
//     }

//     try {
//         const response = await fetch('/reports/download_panic_report', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'X-CSRF-TOKEN': getCookie('csrf_access_token')
//             },
//             body: JSON.stringify({
//                 vehicleNumber: vehicleNumber,
//                 dateRange: dateRange || 'all'
//             })
//         });

//         if (!response.ok) {
//             const errorText = await response.text();
//             throw new Error(errorText);
//         }

//         const blob = await response.blob();
//         const url = window.URL.createObjectURL(blob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = `panic_report_${vehicleNumber}.xlsx`;
//         document.body.appendChild(a);
//         a.click();
//         window.URL.revokeObjectURL(url);
//         document.body.removeChild(a);
        
//     } catch (error) {
//         console.error("Panic report error:", error);
//         try {
//             const errorData = JSON.parse(error.message);
//             alert(errorData.message || "Failed to generate panic report");
//         } catch {
//             alert(error.message || "Failed to generate panic report");
//         }
//     }
// }

//   fetch("/reports/get_custom_reports")
//     .then((response) => response.json())
//     .then((reports) => {
//       reports.forEach((report) => {
//         const reportCard = document.createElement("a");
//         reportCard.href = "#";
//         reportCard.className = "report-card";
//         reportCard.dataset.report = "custom";
//         reportCard.innerHTML = `
//           <h3>${report.report_name}</h3>
//           <i class="fa-solid fa-file-alt"></i>
//         `;
//         document.querySelector(".report-cards").appendChild(reportCard);
//       });
//     });


// document.addEventListener("DOMContentLoaded", function () {
//   const reportModal = document.getElementById("reportModal");
//   const customReportModal = document.getElementById("customReportModal");
//   const customReportForm = document.getElementById("customReportForm");
//   const fieldSelection = document.getElementById("fieldSelection");
//   const selectedFields = document.getElementById("selectedFields");

//   const allowedFields = [
//     "main_power",
//     "i_btn",
//     "mcc",
//     "ignition",
//     "Tenure",
//     "gps",
//     "gsm_sig",
//     "arm",
//     "date",
//     "time",
//     "sos",
//     "harsh_speed",
//     "odometer",
//     "cellid",
//     "internal_bat",
//     "Package",
//     "DateOfPurchase",
//     "mnc",
//     "r1",
//     "r2",
//     "r3",
//     "YearOfManufacture",
//     "DriverName",
//     "InsuranceNumber",
//     "sleep",
//     "dir1",
//     "SIM",
//     "LicensePlateNumber",
//     "ac",
//     "longitude",
//     "latitude",
//     "speed",
//     "door",
//     "temp",
//     "address",
//     "Status",
//     "MobileNumber",
//   ];

//   document.querySelector('[data-report="custom"]').onclick = function () {
//     customReportModal.style.display = "block";
//     loadFields();
//   };

//   document.querySelector(".close").onclick = function () {
//     customReportModal.style.display = "none";
//   };

//   document
//     .getElementById("reportForm")
//     .addEventListener("submit", function (e) {
//       e.preventDefault();
//     });

//     document.getElementById("generatePanicReportBtn").addEventListener("click", function(e) {
//       e.preventDefault();
//       generatePanicReport();
//   });

//   function loadFields() {
//     fetch("/reports/get_fields")
//       .then((response) => response.json())
//       .then((fields) => {
//         fieldSelection.innerHTML = "";
//         const filteredFields = fields.filter((field) =>
//           allowedFields.includes(field)
//         );
//         filteredFields.forEach((field) => {
//           const fieldItem = document.createElement("div");
//           fieldItem.className = "field-item";
//           fieldItem.style.cssText = `
//           padding: 10px;
//           margin: 5px;
//           border: 1px solid #ccc;
//           border-radius: 5px;
//           background-color: #f9f9f9;
//           cursor: pointer;
//         `;
//           fieldItem.innerHTML = `
//           <input type="checkbox" id="${field}" value="${field}" />
//           <label for="${field}" style="margin-left: 5px;">${field}</label>
//         `;
//           fieldSelection.appendChild(fieldItem);
//         });
//       });
//   }

//   fieldSelection.addEventListener("change", function (e) {
//     const field = e.target.value;

//     // console.log("Field changed:", field, "Checked:", e.target.checked);

//     if (e.target.checked) {
//       const existingField = selectedFields.querySelector(
//         `[data-field="${field}"]`
//       );
//       if (existingField) {
//         console.log("Duplicate field detected:", field);
//         alert("This field is already selected.");
//         e.target.checked = false;
//         return;
//       }

//       const listItem = document.createElement("li");
//       listItem.textContent = field;
//       listItem.dataset.field = field;
//       listItem.draggable = true;

//       const removeButton = document.createElement("button");
//       removeButton.textContent = "Remove";

//       removeButton.onclick = function () {
//         selectedFields.removeChild(listItem);
//         const checkbox = fieldSelection.querySelector(
//           `input[value="${field}"]`
//         );
//         if (checkbox) {
//           checkbox.checked = false;
//           checkbox.parentElement.style.display = "block";
//         }
//       };

//       listItem.appendChild(removeButton);

//       listItem.addEventListener("dragstart", (e) => {
//         e.dataTransfer.setData("text/plain", e.target.dataset.field);
//       });

//       listItem.addEventListener("dragover", (e) => e.preventDefault());
//       listItem.addEventListener("drop", (e) => {
//         e.preventDefault();
//         const draggedField = e.dataTransfer.getData("text/plain");
//         const draggedItem = selectedFields.querySelector(
//           `[data-field="${draggedField}"]`
//         );
//         selectedFields.insertBefore(draggedItem, e.target);
//       });

//       selectedFields.appendChild(listItem);
//       e.target.parentElement.style.display = "none";
//     } else {
//       const listItem = selectedFields.querySelector(`[data-field="${field}"]`);
//       if (listItem) selectedFields.removeChild(listItem);
//       e.target.parentElement.style.display = "block";
//     }
//   });

//   customReportForm.onsubmit = function (e) {
//     e.preventDefault();

//     const reportNameInput = document.getElementById("reportName");
//     if (!reportNameInput) {
//       alert("Report Name input is missing!");
//       return;
//     }

//     const reportName = reportNameInput.value.trim();
//     if (!reportName) {
//       alert("Please provide a valid report name.");
//       return;
//     }

//     const fields = Array.from(
//       new Set(Array.from(selectedFields.children).map((li) => li.dataset.field))
//     );

//     if (fields.length === 0) {
//       alert("Please select at least one field.");
//       return;
//     }

//     // Show loading state
//     const saveBtn = document.getElementById("saveCustomReport");
//     const originalText = saveBtn.textContent;
//     saveBtn.disabled = true;
//     saveBtn.textContent = "Saving...";

//     fetch("/reports/save_custom_report", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "X-CSRF-TOKEN": getCookie("csrf_access_token"),
//         Accept: "application/json",
//       },
//       credentials: "include", // Include cookies in the request
//       body: JSON.stringify({ reportName, fields }),
//     })
//       .then(async (response) => {
//         const data = await response.json();

//         if (!response.ok) {
//           // Use server-provided message if available
//           throw new Error(data.message || "Failed to save report");
//         }
//         return data;
//       })
//       .then((data) => {
//         alert(data.message);
//         createReportCard({ report_name: reportName });
//         customReportModal.style.display = "none";
//       })
//       .catch((error) => {
//         console.error("Error saving the report:", error);
//         alert("An error occurred while saving the report.");
//       })
//       .finally(() => {
//         saveBtn.disabled = false;
//         saveBtn.textContent = originalText;
//       });
//   };
  
//   document.addEventListener('DOMContentLoaded', function() {
//     const panicBtn = document.getElementById('generatePanicReportBtn');
    
//     // Only add listener if button exists
//     if (panicBtn) {
//         panicBtn.addEventListener('click', function(e) {
//             e.preventDefault();
//             generatePanicReport();
//         });
//     }
    
//     // Initialize other elements here
//     $("select").selectize({
//         create: false,
//         sortField: "text",
//     });
// });

// fetch('/reports/download_panic_report', {
//   method: "POST",
//   headers: {
//       "Content-Type": "application/json",
//       "X-CSRF-TOKEN": getCookie("csrf_access_token"),
//   },
//   body: JSON.stringify({
//       vehicleNumber: vehicle_number,
//       dateRange: date_range
//   }),
// })
// .then(async (response) => {
//   if (!response.ok) {
//       const error = await response.json().catch(() => ({}));
//       throw new Error(error.message || "Failed to generate report");
//   }
//   return response.blob();
// })
// .catch(error => {
//   console.error("Error:", error);
//   alert(error.message || "Failed to generate report. Please check console for details.");
//   throw error; // Re-throw to prevent further processing
// });

//   $("select").selectize({
//     create: false,
//     sortField: "text",
//   });
// });





function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

// Main initialization
document.addEventListener("DOMContentLoaded", function() {
  // Initialize modals
  const reportModal = document.getElementById("reportModal");
  const customReportModal = document.getElementById("customReportModal");
  
  // Initialize selectize
  $("select").selectize({
    create: false,
    sortField: "text"
  });

  // Report cards click handlers
  document.querySelectorAll('.report-card').forEach(card => {
    card.onclick = function() {
      const reportType = this.dataset.report;
      const reportName = this.querySelector('h3').textContent;
      
      if (reportType === 'custom') {
        openReportModal(reportName);
        document.getElementById("generateReport").dataset.reportType = 'custom';
        document.getElementById("generateReport").dataset.reportName = reportName;
      } else if (reportType === 'sos') {
        generatePanicReport();
      } else {
        openReportModal(reportName);
        document.getElementById("generateReport").dataset.reportType = reportType;
      }
    };
  });

  // Generate report button
  document.getElementById("generateReport").onclick = async function() {
    const reportType = this.dataset.reportType;
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

    try {
      const response = await fetch('/reports/download_custom_report', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        },
        body: JSON.stringify({
          reportName: reportType,
          vehicleNumber,
          dateRange
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_report_${vehicleNumber}.xlsx`;
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
  };

  // Load custom reports
  fetch("/reports/get_custom_reports")
    .then((response) => response.json())
    .then((reports) => {
      reports.forEach((report) => {
        createReportCard(report);
      });
    });
});

// Helper functions
function createReportCard(report) {
  const existingCard = document.querySelector(`.report-card[data-report="${report.report_name}"]`);
  if (existingCard) return;
  
  const reportCard = document.createElement("a");
  reportCard.href = "#";
  reportCard.className = "report-card";
  reportCard.dataset.report = report.report_name;
  reportCard.dataset.reportType = "custom";
  reportCard.innerHTML = `
    <h3>${report.report_name}</h3>
    <i class="fa-solid fa-file-alt"></i>
  `;
  
  document.querySelector(".report-cards").appendChild(reportCard);
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
    alert("Please select a vehicle");
    return;
  }

  try {
    const response = await fetch('/reports/download_panic_report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': getCookie('csrf_access_token')
      },
      body: JSON.stringify({
        vehicleNumber: vehicleNumber,
        dateRange: dateRange || 'all'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to generate panic report");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
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