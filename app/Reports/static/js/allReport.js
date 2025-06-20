const allowedFields = [
  "main_power",
  "ignition",
  "Tenure",
  "gsm_sig",
  "arm",
  "sos",
  "harsh_speed",
  "odometer",
  "internal_bat",
  "Package",
  "longitude",
  "latitude",
  "speed",
  "door",
  "temp",
  "MobileNumber",
  "VechicleType",
  "Average Speed",
  "Maximum Speed"
];

document.addEventListener("DOMContentLoaded", function() {
  // Initialize elements
  const reportModal = document.getElementById("reportModal");
  const customReportModal = document.getElementById("customReportModal");
  const fieldSelection = document.getElementById("fieldSelection");
  const selectedFields = document.getElementById("selectedFields");
  const customReportForm = document.getElementById("customReportForm");
  const dateRangeSelect = document.getElementById("dateRange");
  const customDateRange = document.getElementById("customDateRange");

   function handleDateRangeChange() {
        if (dateRangeSelect.value === "custom") {
            // Show the custom date range fields
            customDateRange.style.display = "block";
            
            // Set default values (optional)
            const now = new Date();
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            
            // Format as YYYY-MM-DDTHH:MM for datetime-local inputs
            function formatDate(date) {
                const pad = num => num.toString().padStart(2, '0');
                return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
            }
            
            // Set values
            document.getElementById("fromDate").value = formatDate(threeMonthsAgo);
            document.getElementById("toDate").value = formatDate(now);
        } else {
            // Hide the custom date range fields
            customDateRange.style.display = "none";
        }
    }
    
    // Add event listener for changes
    dateRangeSelect.addEventListener("change", handleDateRangeChange);
    
    // Initialize on page load (in case custom is already selected)
    handleDateRangeChange();

  // Initialize Selectize for dropdowns
  $("select").selectize({
    create: false,
    sortField: "text",
  });

  // Get Selectize instance for vehicleNumber
  const vehicleSelect = document.getElementById("vehicleNumber");
  const vehicleSelectize = vehicleSelect.selectize;

  // Hide "All Vehicle" for Travel Path Report
  document.querySelectorAll(".report-card").forEach((card) => {
    card.addEventListener("click", function () {
      const reportType = card.dataset.report;
      if (reportType === "daily-distance") {
        // Remove "All Vehicle" option
        vehicleSelectize.removeOption("all");
        // If "All Vehicle" was selected, reset to empty
        if (vehicleSelectize.getValue() === "all") {
          vehicleSelectize.clear();
        }
      } else {
        // Add "All Vehicle" option if not present
        if (!vehicleSelectize.options["all"]) {
          vehicleSelectize.addOption({ value: "all", text: "All Vehicle" });
        }
      }
    });
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

      if (reportName === "Custom Report") {
        document.getElementById("generateReport").dataset.reportType =
          reportType;
        document.getElementById("generateReport").dataset.reportName =
          reportName;
        return;
      }

      if (reportType === "custom") {
        fetch(
          `/reports/get_custom_report?name=${encodeURIComponent(reportName)}`
        )
          .then((response) => {
            if (!response.ok) {
              displayFlashMessage("Network response was not ok", "danger");
              throw new Error("Network response was not ok");
            }
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

  document.getElementById("dateRange").addEventListener("change", function() {
    const customDateRange = document.getElementById("customDateRange");
    if (this.value === "custom") {
        customDateRange.style.display = "block";
        
        // Set date limits
        const now = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        // Format for datetime-local input
        const formatDate = (date) => {
            return date.toISOString().slice(0, 16);
        };
        
        // Set min/max dates
        document.getElementById("fromDate").max = formatDate(now);
        document.getElementById("fromDate").min = formatDate(threeMonthsAgo);
        document.getElementById("toDate").max = formatDate(now);
        document.getElementById("toDate").min = formatDate(threeMonthsAgo);
        
        // Set default values
        document.getElementById("fromDate").value = formatDate(threeMonthsAgo);
        document.getElementById("toDate").value = formatDate(now);
    } else {
        customDateRange.style.display = "none";
    }
});

  // // Generate report button handler
  // document.getElementById("generateReport").addEventListener("click", async function () {
  //     const reportType = this.dataset.reportType;
  //     const reportName = this.dataset.reportName;
  //     const vehicleNumber = document.getElementById("vehicleNumber").value;
  //     const dateRange = document.getElementById("dateRange").value;

  //     if (!vehicleNumber) {
  //       alert("Please select a vehicle number");
  //       return;
  //     }

  //     const generateBtn = this;
  //     const originalText = generateBtn.textContent;
  //     generateBtn.disabled = true;
  //     generateBtn.textContent = "Generating...";

  //     if (reportType === "panic") {
  //       await generatePanicReport();
  //       generateBtn.disabled = false; // Re-enable the button after completion
  //       generateBtn.textContent = originalText;
  //     } else {
  //       try {
  //         let endpoint = "/reports/download_custom_report";
  //         let body = {
  //           reportType: reportType,
  //           vehicleNumber: vehicleNumber,
  //           reportName: reportName,
  //           dateRange: dateRange,
  //         };

  //         if (dateRange === "custom") {
  //           body.fromDate = document.getElementById("fromDate").value;
  //           body.toDate = document.getElementById("toDate").value;
  //         }

  //         const response = await fetch(endpoint, {
  //           method: "POST",
  //           headers: {
  //             "Content-Type": "application/json",
  //             "X-CSRF-TOKEN": getCookie("csrf_access_token"),
  //           },
  //           body: JSON.stringify(body),
  //         });

  //         if (!response.ok) {
  //           // Only read as JSON if not ok
  //           const errorData = await response.json().catch(() => ({}));
  //           displayFlashMessage(
  //             errorData.message || "Failed to generate report",
  //             errorData.category || "danger"
  //           );
  //           return; // Don't continue to blob
  //         }

  //         // Only read as blob if response is ok
  //         const blob = await response.blob();
  //         const url = window.URL.createObjectURL(blob);
  //         const a = document.createElement("a");
  //         a.href = url;
  //         a.download = vehicleNumber === "all"
  //           ? `${reportType === "custom" ? reportName : reportType}_report_ALL_VEHICLES.xlsx`
  //           : `${reportType === "custom" ? reportName : reportType}_report_${vehicleNumber}.xlsx`;
  //         document.body.appendChild(a);
  //         a.click();
  //         window.URL.revokeObjectURL(url);
  //         document.body.removeChild(a);
  //       } catch (error) {
  //         console.error("Error:", error);
  //         alert(error.message || "Failed to generate report");
  //       } finally {
  //         generateBtn.disabled = false;
  //         generateBtn.textContent = originalText;
  //       }
  //     }
  //   });

  document.getElementById("generateReport").addEventListener("click", async function (e) {
  e.preventDefault();

  // Prefer dataset.reportType if present, else fallback to currentReportType
  const reportType = this.dataset.reportType || (typeof currentReportType !== "undefined" ? currentReportType : null);
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
    generateBtn.disabled = false;
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
      if (dateRange === "custom") {
        body.fromDate = document.getElementById("fromDate").value;
        body.toDate = document.getElementById("toDate").value;
      }
      // If speedValue is defined and reportType is distance-speed-range, add it
      if (reportType === "distance-speed-range" && typeof speedValue !== "undefined") {
        body.speedValue = speedValue;
      }

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
        displayFlashMessage(
          errorData.message || "Failed to generate report",
          errorData.category || "danger"
        );
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = vehicleNumber === "all"
        ? `${reportType === "custom" ? reportName : reportType}_report_ALL_VEHICLES.xlsx`
        : `${reportType === "custom" ? reportName : reportType}_report_${vehicleNumber}.xlsx`;
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

// Add validation for custom date range
document.getElementById("reportForm").addEventListener("submit", function(e) {
    const dateRange = document.getElementById("dateRange").value;
    if (dateRange === "custom") {
        const fromDate = new Date(document.getElementById("fromDate").value);
        const toDate = new Date(document.getElementById("toDate").value);
        
        if (!fromDate || !toDate) {
            e.preventDefault();
            alert("Please select both from and to dates");
            return;
        }
        
        if (fromDate > toDate) {
            e.preventDefault();
            alert("From date cannot be after To date");
            return;
        }
        
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        if (fromDate < threeMonthsAgo || toDate < threeMonthsAgo) {
            e.preventDefault();
            alert("Date range cannot be older than 3 months");
            return;
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
        if (!response.ok) {
          displayFlashMessage("Network response was not ok", "danger");
          throw new Error("Network response was not ok");
        }
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

  // Hide "All Vehicle" for Travel Path Report
  document.querySelectorAll(".report-card").forEach((card) => {
    card.addEventListener("click", function (e) {
      const reportType = card.dataset.report;
      const allVehicleOption = document.getElementById("allVehicleOption");
      if (allVehicleOption) {
        allVehicleOption.style.display = "none";
      }
      // Hide for Travel Path Report
      if (reportType === "daily-distance" && allVehicleOption) {
        allVehicleOption.style.display = "none";
        // Optionally, reset selection if "All Vehicle" was selected
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.value === "all") vehicleSelect.selectedIndex = 1;
        // If using Selectize, update it too:
        if (vehicleSelect.selectize) {
          vehicleSelect.selectize.removeOption("all");
        }
      } else if (allVehicleOption) {
        allVehicleOption.style.display = "";
        // If using Selectize, ensure option is present
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.selectize && !vehicleSelect.selectize.options["all"]) {
          vehicleSelect.selectize.addOption({value: "all", text: "All Vehicle"});
        }
      }
    });
  });

  // Show speed dropdown only for Speed Report
  const speedSelectGroup = document.getElementById("speedSelectGroup");
  const speedSelect = document.getElementById("speedSelect");
  let currentReportType = null;

  document.querySelectorAll(".report-card").forEach((card) => {
    card.addEventListener("click", function () {
      currentReportType = card.dataset.report;
      if (currentReportType === "distance-speed-range") {
        speedSelectGroup.style.display = "";
      } else {
        speedSelectGroup.style.display = "none";
        speedSelect.value = "";
      }
      // Hide "All Vehicle" for Travel Path Report
      const reportType = card.dataset.report;
      const allVehicleOption = document.getElementById("allVehicleOption");
      if (allVehicleOption) {
        allVehicleOption.style.display = "none";
      }
      // Hide for Travel Path Report
      if (reportType === "daily-distance" && allVehicleOption) {
        allVehicleOption.style.display = "none";
        // Optionally, reset selection if "All Vehicle" was selected
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.value === "all") vehicleSelect.selectedIndex = 1;
        // If using Selectize, update it too:
        if (vehicleSelect.selectize) {
          vehicleSelect.selectize.removeOption("all");
        }
      } else if (allVehicleOption) {
        allVehicleOption.style.display = "";
        // If using Selectize, ensure option is present
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.selectize && !vehicleSelect.selectize.options["all"]) {
          vehicleSelect.selectize.addOption({value: "all", text: "All Vehicle"});
        }
      }
    });
  });

  // Make speed selection mandatory for Speed Report
  document.getElementById("reportForm").addEventListener("submit", function(e) {
    if (currentReportType === "distance-speed-range") {
      if (!speedSelect.value) {
        alert("Please select a speed for the Speed Report.");
        speedSelect.focus();
        e.preventDefault();
        return false;
      }
    }
    // Custom date range validation
    const dateRange = document.getElementById("dateRange").value;
    if (dateRange === "custom") {
        const fromDate = new Date(document.getElementById("fromDate").value);
        const toDate = new Date(document.getElementById("toDate").value);
        
        if (!fromDate || !toDate) {
            e.preventDefault();
            alert("Please select both from and to dates");
            return;
        }
        
        if (fromDate > toDate) {
            e.preventDefault();
            alert("From date cannot be after To date");
            return;
        }
        
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        if (fromDate < threeMonthsAgo || toDate < threeMonthsAgo) {
            e.preventDefault();
            alert("Date range cannot be older than 3 months");
            return;
        }
    }
  });

  // Generate report button handler
  // document.getElementById("generateReport").addEventListener("click", async function () {
  //     const reportType = currentReportType;
  //     const reportName = this.dataset.reportName;
  //     const vehicleNumber = document.getElementById("vehicleNumber").value;
  //     const dateRange = document.getElementById("dateRange").value;

  //     if (!vehicleNumber) {
  //       alert("Please select a vehicle number");
  //       return;
  //     }

  //     const generateBtn = this;
  //     const originalText = generateBtn.textContent;
  //     generateBtn.disabled = true;
  //     generateBtn.textContent = "Generating...";

  //     if (reportType === "panic") {
  //       await generatePanicReport();
  //       generateBtn.disabled = false; // Re-enable the button after completion
  //       generateBtn.textContent = originalText;
  //     } else {
  //       try {
  //         let endpoint = "/reports/download_custom_report";
  //         let body = {
  //           reportType: reportType,
  //           vehicleNumber: vehicleNumber,
  //           reportName: reportName,
  //           dateRange: dateRange,
  //         };
  //         if (dateRange === "custom") {
  //           body.fromDate = document.getElementById("fromDate").value;
  //           body.toDate = document.getElementById("toDate").value;
  //         }
  //         if (reportType === "distance-speed-range") {
  //           body.speedValue = speedValue;
  //         }

  //         const response = await fetch(endpoint, {
  //           method: "POST",
  //           headers: {
  //             "Content-Type": "application/json",
  //             "X-CSRF-TOKEN": getCookie("csrf_access_token"),
  //           },
  //           body: JSON.stringify(body),
  //         });

  //         if (!response.ok) {
  //           // Only read as JSON if not ok
  //           const errorData = await response.json().catch(() => ({}));
  //           displayFlashMessage(
  //             errorData.message || "Failed to generate report",
  //             errorData.category || "danger"
  //           );
  //           return; // Don't continue to blob
  //         }

  //         // Only read as blob if response is ok
  //         const blob = await response.blob();
  //         const url = window.URL.createObjectURL(blob);
  //         const a = document.createElement("a");
  //         a.href = url;
  //         a.download = vehicleNumber === "all"
  //           ? `${reportType === "custom" ? reportName : reportType}_report_ALL_VEHICLES.xlsx`
  //           : `${reportType === "custom" ? reportName : reportType}_report_${vehicleNumber}.xlsx`;
  //         document.body.appendChild(a);
  //         a.click();
  //         window.URL.revokeObjectURL(url);
  //         document.body.removeChild(a);
  //       } catch (error) {
  //         console.error("Error:", error);
  //         alert(error.message || "Failed to generate report");
  //       } finally {
  //         generateBtn.disabled = false;
  //         generateBtn.textContent = originalText;
  //       }
  //     }
  //   });

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
        if (!response.ok) {
          displayFlashMessage("Network response was not ok", "danger");
          throw new Error("Network response was not ok");
        }
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

  // Hide "All Vehicle" for Travel Path Report
  document.querySelectorAll(".report-card").forEach((card) => {
    card.addEventListener("click", function (e) {
      const reportType = card.dataset.report;
      const allVehicleOption = document.getElementById("allVehicleOption");
      if (allVehicleOption) {
        allVehicleOption.style.display = "none";
      }
      // Hide for Travel Path Report
      if (reportType === "daily-distance" && allVehicleOption) {
        allVehicleOption.style.display = "none";
        // Optionally, reset selection if "All Vehicle" was selected
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.value === "all") vehicleSelect.selectedIndex = 1;
        // If using Selectize, update it too:
        if (vehicleSelect.selectize) {
          vehicleSelect.selectize.removeOption("all");
        }
      } else if (allVehicleOption) {
        allVehicleOption.style.display = "";
        // If using Selectize, ensure option is present
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.selectize && !vehicleSelect.selectize.options["all"]) {
          vehicleSelect.selectize.addOption({value: "all", text: "All Vehicle"});
        }
      }
    });
  });
});

// Helper functions
function createReportCard(report) {
  const existingCard = document.querySelector(
    `.report-card[data-report-name="${report.report_name}"]`
  );
  if (existingCard) return;

  const reportCard = document.createElement("a");
  reportCard.href = "#";
  reportCard.className = "report-card";
  reportCard.dataset.report = "custom";
  reportCard.dataset.reportName = report.report_name;
  reportCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <h3>${report.report_name}</h3>
      <i class="fa-solid fa-trash delete-report" title="Delete Report" style="color: #d9534f; cursor: pointer; font-size: 1.2em; margin-left: 8px;"></i>
    </div>
    <i class="fa-solid fa-file-alt" style="font-size: 2.5em; margin-top: 10px;"></i>
  `;

  // Delete icon handler
  reportCard.querySelector('.delete-report').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    if (confirm(`Are you sure you want to delete the report "${report.report_name}"?`)) {
      fetch(`/reports/delete_custom_report?name=${encodeURIComponent(report.report_name)}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          reportCard.remove();
          alert("Report deleted successfully.");
        } else {
          alert(data.message || "Failed to delete report.");
        }
      })
      .catch(() => alert("Failed to delete report."));
    }
  });

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
      displayFlashMessage(
        errorData.message || "Failed to generate panic report",
        errorData.category || "danger"
      );
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = vehicleNumber === "all"
      ? `panic_report_ALL_VEHICLES.xlsx`
      : `panic_report_${vehicleNumber}.xlsx`;
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
      if (!response.ok) {
        displayFlashMessage("Network response was not ok", "danger");
        throw new Error("Network response was not ok");
      }
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
