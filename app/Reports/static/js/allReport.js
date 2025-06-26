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
  const reportModal = document.getElementById("reportModal");
  const customReportModal = document.getElementById("customReportModal");
  const fieldSelection = document.getElementById("fieldSelection");
  const selectedFields = document.getElementById("selectedFields");
  const customReportForm = document.getElementById("customReportForm");
  const dateRangeSelect = document.getElementById("dateRange");
  const customDateRange = document.getElementById("customDateRange");

  let generatedReports = [];

  loadRecentReports('today');

  const reportDateRangeSelect = document.getElementById('reportDateRange');
  if (reportDateRangeSelect) {
      reportDateRangeSelect.addEventListener('change', function() {
          loadRecentReports(this.value);
      });
  }

   function handleDateRangeChange() {
        if (dateRangeSelect.value === "custom") {
            customDateRange.style.display = "block";
            
            const now = new Date();
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            
            function formatDate(date) {
                const pad = num => num.toString().padStart(2, '0');
                return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
            }
            
            document.getElementById("fromDate").value = formatDate(threeMonthsAgo);
            document.getElementById("toDate").value = formatDate(now);
        } else {
            customDateRange.style.display = "none";
        }
    }
    
    dateRangeSelect.addEventListener("change", handleDateRangeChange);
    
    handleDateRangeChange();

  $("select").selectize({
    create: false,
    sortField: "text",
  });

  function loadRecentReports(range) {
    fetch(`/reports/get_recent_reports?range=${range}`)
        .then(response => response.json())
        .then(data => {
            generatedReports = data.reports;
            renderRecentReports();
        })
        .catch(error => {
            console.error('Error loading recent reports:', error);
        });
}

function renderRecentReports() {
    const container = document.getElementById('recentReportsList');
    
    if (generatedReports.length === 0) {
        container.innerHTML = '<p class="no-reports">Your generated reports will be visible here.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    generatedReports.forEach(report => {
        const reportItem = document.createElement('div');
        reportItem.className = 'report-item';
        
        const reportDate = new Date(report.generated_at);
        const formattedDate = reportDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        const formattedTime = reportDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        reportItem.innerHTML = `
            <div class="report-info">
                <div class="report-name">${report.report_name}</div>
                <div class="report-meta">
                    <span class="report-date">${formattedDate}</span>
                    <span class="report-time">${formattedTime}</span>
                </div>
            </div>
            <div class="report-actions">
                <button class="view-report" data-id="${report._id}" title="View Report">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="download-report" data-id="${report._id}" title="Download Report">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;
        
        container.appendChild(reportItem);
    });
    
    // Add event listeners to the buttons
    document.querySelectorAll('.view-report').forEach(btn => {
        btn.addEventListener('click', function() {
            const reportId = this.dataset.id;
            viewReport(reportId);
        });
    });
    
    document.querySelectorAll('.download-report').forEach(btn => {
        btn.addEventListener('click', function() {
            const reportId = this.dataset.id;
            downloadReport(reportId);
        });
    });
}

function viewReport(reportId) {
    const report = generatedReports.find(r => r._id === reportId);
    if (!report) return;
    
    // You can reuse your existing preview modal here
    // Populate it with the report data
    alert(`Viewing report: ${report.report_name}`);
}

function downloadReport(reportId) {
    const report = generatedReports.find(r => r._id === reportId);
    if (!report) return;
    
    window.location.href = `/reports/download_report/${reportId}`;
}

  const vehicleSelect = document.getElementById("vehicleNumber");
  const vehicleSelectize = vehicleSelect.selectize;

  document.querySelectorAll(".report-card").forEach((card) => {
    card.addEventListener("click", function () {
      const reportType = card.dataset.report;
      if (reportType === "daily-distance") {
        vehicleSelectize.removeOption("all");
        if (vehicleSelectize.getValue() === "all") {
          vehicleSelectize.clear();
        }
      } else {
        if (!vehicleSelectize.options["all"]) {
          vehicleSelectize.addOption({ value: "all", text: "All Vehicle" });
        }
      }
    });
  });

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

  window.addEventListener("click", function (event) {
    if (event.target == reportModal) {
      reportModal.style.display = "none";
    }
    if (event.target == customReportModal) {
      customReportModal.style.display = "none";
    }
  });

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
        
        const now = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const formatDate = (date) => {
            return date.toISOString().slice(0, 16);
        };
        
        document.getElementById("fromDate").max = formatDate(now);
        document.getElementById("fromDate").min = formatDate(threeMonthsAgo);
        document.getElementById("toDate").max = formatDate(now);
        document.getElementById("toDate").min = formatDate(threeMonthsAgo);
        
        document.getElementById("fromDate").value = formatDate(threeMonthsAgo);
        document.getElementById("toDate").value = formatDate(now);
    } else {
        customDateRange.style.display = "none";
    }
});

document.getElementById("viewReport").addEventListener("click", async function (e) {
  e.preventDefault();

  const reportType = document.getElementById("generateReport").dataset.reportType;
  const reportName = document.getElementById("generateReport").dataset.reportName;
  const vehicleNumber = document.getElementById("vehicleNumber").value;
  const dateRange = document.getElementById("dateRange").value;

  if (!vehicleNumber) {
    alert("Please select a vehicle number");
    return;
  }

  const body = {
    reportType,
    reportName,
    vehicleNumber,
    dateRange,
  };

  if (dateRange === "custom") {
    body.fromDate = document.getElementById("fromDate").value;
    body.toDate = document.getElementById("toDate").value;
  }

  try {
    const response = await fetch("/reports/view_report_preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (!result.success) {
      alert(result.message || "Failed to load preview");
      return;
    }

    const container = document.getElementById("reportPreviewTableContainer");
    container.innerHTML = "";

    if (result.data.length === 0) {
      container.innerHTML = "<p>No data found.</p>";
    } else {
      const table = document.createElement("table");
      table.className = "table table-bordered table-striped";
      
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      
      const headers = Object.keys(result.data[0]);
      
      const formattedHeaders = headers.map(header => {
        return header
          .replace(/_/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      });
      
      formattedHeaders.forEach(header => {
        const th = document.createElement("th");
        th.textContent = header;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      result.data.forEach(row => {
        const tr = document.createElement("tr");
        headers.forEach(h => {
          const td = document.createElement("td");
          if (h === 'date_time') {
            td.textContent = row[h] || "";
          } else if (h === 'ignition') {
            td.textContent = row[h] === 'ON' ? 'ON' : 'OFF';
          } else if (h.endsWith('(km)') || h.endsWith('(min)')) {
            const numValue = parseFloat(row[h]);
            td.textContent = !isNaN(numValue) ? numValue.toFixed(2) : (row[h] === 0 ? '0.00' : row[h] || '');
          } else {
            td.textContent = (row[h] !== undefined && row[h] !== null) ? row[h] : '';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    }

    const modalTitle = document.getElementById("reportPreviewModalTitle");
    if (modalTitle) {
      const reportTitles = {
        'daily-distance': 'Travel Path Report Preview',
        'odometer-daily-distance': 'Distance Report Preview',
        'distance-speed-range': 'Speed Report Preview',
        'stoppage': 'Stoppage Report Preview',
        'idle': 'Idle Report Preview',
        'ignition': 'Ignition Report Preview',
        'daily': 'Daily Report Preview',
        'panic': 'Panic Report Preview',
        'custom': `${reportName} Preview`
      };
      modalTitle.textContent = reportTitles[reportType] || 'Report Preview';
    }

    document.getElementById("reportPreviewModal").style.display = "block";

  } catch (error) {
    console.error("Error fetching report preview:", error);
    alert("An error occurred while loading the preview.");
  }
});

  document.getElementById("generateReport").addEventListener("click", async function (e) {
  e.preventDefault();

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
    .then((response) => response.json().then(data => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        displayFlashMessage(data.message || "Failed to save report", "danger");
        throw new Error(data.message || "Failed to save report");
      }
      alert(data.message || "Report saved successfully!");
      customReportModal.style.display = "none";
      customReportForm.reset();
      selectedFields.innerHTML = "";
      window.location.reload();
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

  document.querySelectorAll(".report-card").forEach((card) => {
    card.addEventListener("click", function (e) {
      const reportType = card.dataset.report;
      const allVehicleOption = document.getElementById("allVehicleOption");
      if (allVehicleOption) {
        allVehicleOption.style.display = "none";
      }

      if (reportType === "daily-distance" && allVehicleOption) {
        allVehicleOption.style.display = "none";

        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.value === "all") vehicleSelect.selectedIndex = 1;

        if (vehicleSelect.selectize) {
          vehicleSelect.selectize.removeOption("all");
        }
      } else if (allVehicleOption) {
        allVehicleOption.style.display = "";
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.selectize && !vehicleSelect.selectize.options["all"]) {
          vehicleSelect.selectize.addOption({value: "all", text: "All Vehicle"});
        }
      }
    });
  });

  const speedSelectGroup = document.getElementById("speedSelectGroup");
  const speedSelect = document.getElementById("speedSelect");
  let currentReportType = null;

  document.querySelectorAll(".report-card").forEach((card) => {
    card.addEventListener("click", function () {
      currentReportType = card.dataset.report;

      const reportType = card.dataset.report;
      const allVehicleOption = document.getElementById("allVehicleOption");
      if (allVehicleOption) {
        allVehicleOption.style.display = "none";
      }

      if (reportType === "daily-distance" && allVehicleOption) {
        allVehicleOption.style.display = "none";
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.value === "all") vehicleSelect.selectedIndex = 1;
        if (vehicleSelect.selectize) {
          vehicleSelect.selectize.removeOption("all");
        }
      } else if (allVehicleOption) {
        allVehicleOption.style.display = "";
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.selectize && !vehicleSelect.selectize.options["all"]) {
          vehicleSelect.selectize.addOption({value: "all", text: "All Vehicle"});
        }
      }
    });
  });

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

  document.querySelectorAll(".report-card").forEach((card) => {
    card.addEventListener("click", function (e) {
      const reportType = card.dataset.report;
      const allVehicleOption = document.getElementById("allVehicleOption");
      if (allVehicleOption) {
        allVehicleOption.style.display = "none";
      }
      if (reportType === "daily-distance" && allVehicleOption) {
        allVehicleOption.style.display = "none";
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.value === "all") vehicleSelect.selectedIndex = 1;
        if (vehicleSelect.selectize) {
          vehicleSelect.selectize.removeOption("all");
        }
      } else if (allVehicleOption) {
        allVehicleOption.style.display = "";
        const vehicleSelect = document.getElementById("vehicleNumber");
        if (vehicleSelect.selectize && !vehicleSelect.selectize.options["all"]) {
          vehicleSelect.selectize.addOption({value: "all", text: "All Vehicle"});
        }
      }
    });
  });
});

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

  reportCard.querySelector('.delete-report').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    const reportName = reportCard.dataset.reportName || reportCard.querySelector('h3').textContent;
    showDeleteConfirm(reportName, function() {
      fetch(`/reports/delete_custom_report?name=${encodeURIComponent(reportName)}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          reportCard.remove();
        } else {
          alert(data.message || "Failed to delete report.");
        }
      })
      .catch(() => alert("Failed to delete report."));
    });
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

document.querySelectorAll('.report-card[data-report="custom"] .delete-report').forEach(function(icon) {
  icon.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    const reportCard = this.closest('.report-card');
    const reportName = reportCard.dataset.reportName || reportCard.querySelector('h3').textContent;
    showDeleteConfirm(reportName, function() {
      fetch(`/reports/delete_custom_report?name=${encodeURIComponent(reportName)}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          reportCard.remove();
        } else {
          alert(data.message || "Failed to delete report.");
        }
      })
      .catch(() => alert("Failed to delete report."));
    });
  });
});

function showDeleteConfirm(reportName, onConfirm) {
  const modal = document.getElementById("deleteConfirmModal");
  const text = document.getElementById("deleteConfirmText");
  const okBtn = document.getElementById("deleteOkBtn");
  const cancelBtn = document.getElementById("deleteCancelBtn");
  const closeBtn = document.getElementById("deleteConfirmClose");

  text.textContent = `Are you sure you want to delete the report "${reportName}"?`;
  modal.style.display = "block";

  function cleanup() {
    modal.style.display = "none";
    okBtn.removeEventListener("click", onOk);
    cancelBtn.removeEventListener("click", onCancel);
    closeBtn.removeEventListener("click", onCancel);
  }
  function onOk() {
    cleanup();
    onConfirm();
  }
  function onCancel() {
    cleanup();
  }

  okBtn.addEventListener("click", onOk);
  cancelBtn.addEventListener("click", onCancel);
  closeBtn.addEventListener("click", onCancel);
}

document.getElementById("closePreviewModal").addEventListener("click", function () {
  document.getElementById("reportPreviewModal").style.display = "none";
});