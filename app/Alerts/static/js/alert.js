document.addEventListener("DOMContentLoaded", function () {
  $("#alertVehicleNumber").selectize({
    placeholder: "Search Vehicles",
    searchField: "text",
    create: false,
  });

  const ackModal = document.getElementById("ackModal");
  const ackForm = document.getElementById("ackForm");
  const searchBtn = document.getElementById("searchAlerts");
  const alertCards = document.querySelectorAll(".alert-card");
  const tableContainer = document.querySelector(".alerts-table-container");
  const downloadBtn = document.getElementById("downloadAlerts");
  const downloadPDFBtn = document.getElementById("downloadPDF");

  let currentEndpoint =
    sessionStorage.getItem("currentAlertEndpoint") || "panic";
  let currentAlertId = null;
  let ITEMS_PER_PAGE = 100;         // keep default page size
  let allAlerts = [];               // holds current page rows only
  let currentPage = 1;
  let totalAlertsCount = 0;         // total from backend
  let totalPages = 1;


  socket.emit("join_alerts");

  socket.on("new_alert", (data) => {
    console.log("New alert received:", data);
    if (shouldDisplayAlert(data.alert)) {
      displayFlashMessage("New alert received", "info");

      const endpoint = data.alert.alert_type.toLowerCase().replace(/\s+/g, "_");
      fetchCountForEndpoint(endpoint);

      if (endpoint === currentEndpoint) {
        loadAlerts();
      }
    }
  });

  socket.on("alert_updated", (data) => {
    console.log("Alert updated:", data);
    const row = document.querySelector(`tr[data-alert-id="${data.alert_id}"]`);
    if (row) {
      loadAlerts();
    }
  });

  //////////////////  Excel download  /////////////////////
  downloadBtn.addEventListener("click", function () {
    downloadAlertsAsExcel();
  });

  function downloadAlertsAsExcel() {
    const headerCells = document.querySelectorAll("#alertsTable thead th");
    const headers = Array.from(headerCells)
      .map(th => th.textContent.trim())
      .filter(h => h.toLowerCase() !== "action");

    const timeIdx = headers.findIndex(h => h.toLowerCase() === "time");
    const insertAt = timeIdx >= 0 ? timeIdx + 1 : headers.length;
    headers.splice(insertAt, 0, "Latitude & Longitude");

    const rows = [];
    document.querySelectorAll("#alertsTable tbody tr").forEach((row) => {
      if (row.classList.contains("loading-row")) return;

      const cells = row.querySelectorAll("td");
      const alertId = row.dataset.alertId;
      const alertRow = document.querySelector(`tr[data-alert-id="${alertId}"]`);
      const latLng = alertRow ? alertRow.dataset.latlng : "N/A";

      const cellValues = Array.from(cells)
        .filter((cell, idx) => headerCells[idx].textContent.trim().toLowerCase() !== "action")
        .map(cell => cell.textContent.trim());

      cellValues.splice(insertAt, 0, latLng);

      rows.push(cellValues);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Alerts");

    const alertType = document
      .querySelector(".alert-card.active h3")
      .textContent.replace(" Alert", "")
      .replace(/\s+/g, "_");
    const vehicleNumber = document.getElementById("alertVehicleNumber").value;
    let filename = `Alerts_${alertType}`;
    if (vehicleNumber) filename += `_${vehicleNumber}`;
    filename += `_${new Date().toISOString().slice(0, 10)}.xlsx`;

    XLSX.writeFile(wb, filename);
  }

  ////////////////// Download PDF  /////////////////////
  downloadPDFBtn.addEventListener("click", function () {
    downloadAlertsAsPDF();
  });

  function downloadAlertsAsPDF() {
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDF) {
      displayFlashMessage("PDF export not available.", "danger");
      return;
    }
    const doc = new jsPDF();

    const headerCells = document.querySelectorAll("#alertsTable thead th");
    const headers = Array.from(headerCells)
      .map(th => th.textContent.trim())
      .filter(h => h.toLowerCase() !== "action");

    const timeIdx = headers.findIndex(h => h.toLowerCase() === "time");
    const insertAt = timeIdx >= 0 ? timeIdx + 1 : headers.length;
    headers.splice(insertAt, 0, "Latitude & Longitude");

    const rows = [];
    document.querySelectorAll("#alertsTable tbody tr").forEach((row) => {
      if (row.classList.contains("loading-row")) return;

      const cells = row.querySelectorAll("td");
      const alertId = row.dataset.alertId;
      const alertRow = document.querySelector(`tr[data-alert-id="${alertId}"]`);
      const latLng = alertRow ? alertRow.dataset.latlng : "N/A";

      const cellValues = Array.from(cells)
        .filter((cell, idx) => headerCells[idx].textContent.trim().toLowerCase() !== "action")
        .map(cell => cell.textContent.trim());

      cellValues.splice(insertAt, 0, latLng);

      rows.push(cellValues);
    });

    const alertType = document.querySelector(
      ".alert-card.active h3"
    ).textContent;
    const vehicleNumber = document.getElementById("alertVehicleNumber").value;
    let title = `${alertType} Alerts`;
    if (vehicleNumber) title += ` - ${vehicleNumber}`;

    doc.setFontSize(16);
    doc.text(title, 14, 15);

    const date = new Date().toLocaleString();
    doc.setFontSize(10);
    doc.text(`Generated on: ${date}`, 14, 22);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 30,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });

    let filename = `Alerts_${alertType
      .replace(" Alert", "")
      .replace(/\s+/g, "_")}`;
    if (vehicleNumber) filename += `_${vehicleNumber}`;
    filename += `_${new Date().toISOString().slice(0, 10)}.pdf`;

    doc.save(filename);
  }

  function fetchCountForEndpoint(endpoint) {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const vehicleNumber = document.getElementById("alertVehicleNumber").value;

    fetch(`/alerts/${endpoint}_count`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({
        startDate: startDate,
        endDate: endDate,
        vehicleNumber: vehicleNumber,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const card = document.querySelector(
            `.alert-card[data-endpoint="${endpoint}"]`
          );
          if (card) {
            const countElement = card.querySelector(".alert-count");
            if (countElement) {
              countElement.textContent = data.count;
            }
          }
        }
      });
  }

  function shouldDisplayAlert(alert) {
    const currentStartDate = new Date(
      document.getElementById("startDate").value
    );
    const currentEndDate = new Date(document.getElementById("endDate").value);
    const alertDate = new Date(alert.date_time);
    const vehicleFilter = document.getElementById("alertVehicleNumber").value;

    if (alertDate < currentStartDate || alertDate > currentEndDate)
      return false;
    if (vehicleFilter && alert.vehicle_number !== vehicleFilter) return false;
    if (alert.alert_type.toLowerCase().replace(/\s+/g, "_") !== currentEndpoint)
      return false;

    return true;
  }

  function isAlertVisible(alertId) {
    return !!document.querySelector(`tr[data-alert-id="${alertId}"]`);
  }

  setDefaultDateRange();

  const activeCard = document.querySelector(
    `.alert-card[data-endpoint="${currentEndpoint}"]`
  );
  if (activeCard) {
    alertCards.forEach((c) => c.classList.remove("active"));
    activeCard.classList.add("active");
  } else {
    currentEndpoint = "panic";
    document
      .querySelector('.alert-card[data-endpoint="panic"]')
      .classList.add("active");
  }

  const urlParams = new URLSearchParams(window.location.search);
  const urlAlertType = urlParams.get("alert_type");
  if (urlAlertType) {
    const endpoint = urlAlertType.toLowerCase().replace(/\s+/g, "_").replace(/_alert$/, "");
    const card = document.querySelector(`.alert-card[data-endpoint="${endpoint}"]`);
    if (card) {
      alertCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      currentEndpoint = endpoint;
      sessionStorage.setItem("currentAlertEndpoint", currentEndpoint);
    }
  }

  loadAlerts();

  alertCards.forEach((card) => {
    card.addEventListener("click", function () {
      alertCards.forEach((c) => c.classList.remove("active"));
      this.classList.add("active");
      currentEndpoint = this.dataset.endpoint;
      sessionStorage.setItem("currentAlertEndpoint", currentEndpoint);
      currentPage = 1;
      loadAlerts();
    });
  });

  searchBtn.addEventListener("click", function () {
    currentPage = 1;
    loadAlerts();
  });

  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("ack-btn")) {
      e.preventDefault();
      currentAlertId = e.target.dataset.alertId;
      ackModal.style.display = "block";
    }
  });

  document.querySelectorAll(".close, .cancel-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      ackModal.style.display = "none";
    });
  });

  window.addEventListener("click", function (event) {
    if (event.target == ackModal) {
      ackModal.style.display = "none";
    }
  });

  ackForm.addEventListener("submit", function (e) {
    e.preventDefault();
    acknowledgeAlert();
  });

async function loadAlerts(page = 1) {
    currentPage = page || 1;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const vehicleNumber = document.getElementById("alertVehicleNumber").value;

    const tableBody = document.querySelector("#alertsTable tbody");
    tableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="7">
                    <div class="loading-animation">
                        <div class="loading-spinner"></div>
                    </div>
                </td>
            </tr>
        `;

    try {
      const res = await fetch(`/alerts/get_alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        },
        body: JSON.stringify({
          startDate: startDate,
          endDate: endDate,
          vehicleNumber: vehicleNumber,
          alertType: currentEndpoint,
          page: currentPage,
          per_page: ITEMS_PER_PAGE
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || `Server error ${res.status}`);
      }

      // backend returns only the requested page rows
      allAlerts = data.alerts || [];
      currentPage = data.page || currentPage;
      ITEMS_PER_PAGE = data.per_page || ITEMS_PER_PAGE;
      totalAlertsCount = data.count || 0;
      totalPages = data.total_pages || Math.ceil((totalAlertsCount || 0) / ITEMS_PER_PAGE);

      updateTableAndPagination();
    } catch (error) {
      console.error("Error:", error);
      displayFlashMessage(error.message || "Failed to fetch alerts", "danger");
      tableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error loading alerts</td></tr>`;
    }
  }

  function updateTableAndPagination() {
    // display the current page rows returned by backend
    displayAlerts(allAlerts);
    updatePagination();
  }

  function updatePagination() {
    const paginationContainer = document.querySelector(".pagination-container");
    if (!paginationContainer) {
      console.error("No pagination container found in the DOM.");
      return;
    }

    paginationContainer.innerHTML = "";

    const totalAlertsSpan = document.createElement("span");
    totalAlertsSpan.className = "total-alerts";
    totalAlertsSpan.textContent = `Total Alerts: ${totalAlertsCount}`;
    paginationContainer.appendChild(totalAlertsSpan);

    if (totalPages <= 1) return;

    const paginationDiv = createPaginationControls(totalPages, currentPage);
    paginationContainer.appendChild(paginationDiv);
  }

function createPaginationControls(totalPagesArg, currentPageArg) {
    const paginationDiv = document.createElement("div");
    paginationDiv.className = "pagination";

    const prevButton = document.createElement("button");
    prevButton.innerHTML = "&laquo; Previous";
    prevButton.disabled = currentPageArg === 1;
    prevButton.addEventListener("click", () => {
      if (currentPageArg > 1) loadAlerts(currentPageArg - 1);
    });
    paginationDiv.appendChild(prevButton);

    const maxVisiblePages = 7;
    let startPage = Math.max(1, currentPageArg - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPagesArg, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      const firstPageButton = document.createElement("button");
      firstPageButton.textContent = "1";
      firstPageButton.addEventListener("click", () => loadAlerts(1));
      paginationDiv.appendChild(firstPageButton);

      if (startPage > 2) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        paginationDiv.appendChild(ellipsis);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const pageButton = document.createElement("button");
      pageButton.textContent = i;
      if (i === currentPageArg) {
        pageButton.classList.add("active");
        pageButton.disabled = true;
      }
      pageButton.addEventListener("click", () => loadAlerts(i));
      paginationDiv.appendChild(pageButton);
    }

    if (endPage < totalPagesArg) {
      if (endPage < totalPagesArg - 1) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        paginationDiv.appendChild(ellipsis);
      }

      const lastPageButton = document.createElement("button");
      lastPageButton.textContent = totalPagesArg;
      lastPageButton.addEventListener("click", () => loadAlerts(totalPagesArg));
      paginationDiv.appendChild(lastPageButton);
    }

    const nextButton = document.createElement("button");
    nextButton.innerHTML = "Next &raquo;";
    nextButton.disabled = currentPageArg === totalPagesArg;
    nextButton.addEventListener("click", () => {
      if (currentPageArg < totalPagesArg) loadAlerts(currentPageArg + 1);
    });
    paginationDiv.appendChild(nextButton);

    return paginationDiv;
  }

  function displayAlerts(alerts) {
    const tableBody = document.querySelector("#alertsTable tbody");
    tableBody.innerHTML = "";

    const showStatusAndAction = (
        currentEndpoint === "panic" ||
        currentEndpoint === "main_power_off"
    );

    const showSpeedValue = (
        currentEndpoint === "speeding"
    );

    const showGeofenceName = (
        currentEndpoint === "geofence_in" ||
        currentEndpoint === "geofence_out"
    );

    const isIdle = (
        currentEndpoint === "idle"
    )

    const tableHead = document.querySelector("#alertsTable thead tr");
    if (tableHead) {
        tableHead.innerHTML = `
            <th>Vehicle Number</th>
            ${isIdle ? '<th>Idle Message</th>' : ''}
            ${showSpeedValue ? '<th>Speed</th>' : ''}
            ${showGeofenceName ? '<th>Geofence Name</th>' : ''}
            <th>Time</th>
            <th>Location</th>
            ${showStatusAndAction ? '<th>Status</th><th>Action</th>' : ''}
        `;
    }

    if (alerts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${showStatusAndAction ? 7 : 5}" style="text-align: center;">No alerts found</td></tr>`;
        return;
    }

    alerts.forEach((alert) => {
        const row = document.createElement("tr");
        row.dataset.alertId = alert._id;
        row.dataset.latlng = `${alert.latitude || "N/A"}, ${alert.longitude || "N/A"}`;

        let rowHtml = `
            <td>${alert.LicensePlateNumber || "N/A"}</td>
            ${isIdle ? `<td>Idle ${alert.alertMessage ?? "N/A"}</td>` : ""}
            ${showSpeedValue ? `<td>${alert.speed ?? "N/A"}</td>` : ""}
            ${showGeofenceName ? `<td>${alert.geofenceName ?? "N/A"}</td>` : ""}
            <td>${alert.date_time}</td>
            <td>${alert.location || "N/A"}</td>
        `;

        if (showStatusAndAction) {
            const statusBadge = alert.acknowledged
                ? `<span class="status-badge acknowledged">Acknowledged</span>`
                : `<span class="status-badge pending">Pending</span>`;

            const showAcknowledgeBtn = (
                currentEndpoint === "panic" ||
                currentEndpoint === "main_power_off"
            );

            const actionBtn = (alert.acknowledged || !showAcknowledgeBtn)
                ? `<button class="action-btn" disabled>${alert.acknowledged ? "Acknowledged" : ""}</button>`
                : `<button class="action-btn ack-btn" data-alert-id="${alert._id}">Acknowledge</button>`;

            rowHtml += `
                <td>${statusBadge}</td>
                <td>${actionBtn}</td>
            `;
        }

        row.innerHTML = rowHtml;
        tableBody.appendChild(row);
    });

    highlightAlertFromURL();
  }

  function acknowledgeAlert() {
    const pressedFor = document.getElementById("pressedFor").value;
    const reason = document.getElementById("ackReason").value;

    if (!pressedFor) {
      displayFlashMessage("Please select a reason", "danger");
      return;
    }

    const ackBtn = ackForm.querySelector(".ack-submit-btn");
    const originalText = ackBtn.innerHTML;
    ackBtn.disabled = true;
    ackBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;

    fetch("/alerts/acknowledge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({
        alertId: currentAlertId,
        pressedFor: pressedFor,
        reason: reason,
      }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.message || `Server responded with status ${response.status}`
          );
        }
        return data;
      })
      .then((data) => {
        if (data.success) {
          displayFlashMessage(
            data.message || "Alert acknowledged successfully",
            "success"
          );
          ackModal.style.display = "none";
          ackForm.reset();

          if (data.alert_id) {
            const row = document.querySelector(
              `tr[data-alert-id="${data.alert_id}"]`
            );
            if (row) {
              row.querySelector(".status-badge").textContent = "Acknowledged";
              row.querySelector(".status-badge").className =
                "status-badge acknowledged";
              row.querySelector(".action-btn").textContent = "Acknowledged";
              row.querySelector(".action-btn").disabled = true;
            }
          } else {
            loadAlerts();
          }
        } else {
          throw new Error(data.message || "Failed to acknowledge alert");
        }
      })
      .catch((error) => {
        console.error("Acknowledgment error:", error);
        displayFlashMessage(error.message || "Failed to acknowledge alert", "danger");
      })
      .finally(() => {
        ackBtn.disabled = false;
        ackBtn.innerHTML = originalText;
      });
  }

  function formatDateTime(dateTimeString) {
    if (!dateTimeString) return "N/A";
    const date = new Date(dateTimeString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  function setDefaultDateRange() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    document.getElementById("startDate").value = formatDateForInput(todayStart);
    document.getElementById("endDate").value = formatDateForInput(now);
  }

  function formatDateForInput(date) {
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - offset)
      .toISOString()
      .slice(0, 16);
    return localISOTime;
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
  }

  setDefaultDateRange();
  
//   function highlightAlertFromURL() {
//     const params = new URLSearchParams(window.location.search);
//     const alertId = params.get("alert_id");
//     if (alertId) {
//         setTimeout(() => {
//             const row = document.querySelector(`tr[data-alert-id="${alertId}"]`);
//             if (row) {
//                 row.style.background = "#ffe082";
//                 row.scrollIntoView({ behavior: "smooth", block: "center" });
//             }
//         }, 200); 
//     }
// }

function highlightAlertFromURL() {
  const params = new URLSearchParams(window.location.search);
  const alertId = params.get("alert_id");
  const alertType = params.get("alert_type");
  const fromNotification = params.get("from_notification");

  if (alertId) {
    // Switch to correct tab first if needed
    if (alertType) {
      const endpoint = alertType.toLowerCase().replace(/\s+/g, '_').replace('_alert', '');
      const card = document.querySelector(`.alert-card[data-endpoint="${endpoint}"]`);
      
      if (card && !card.classList.contains('active')) {
        document.querySelectorAll('.alert-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentEndpoint = endpoint;
        sessionStorage.setItem("currentAlertEndpoint", currentEndpoint);
        
        // Load alerts and then highlight
        loadAlerts().then(() => {
          setTimeout(() => highlightSpecificAlert(alertId, fromNotification), 300);
        });
        return;
      }
    }
    
    // If already on correct tab, just highlight
    setTimeout(() => highlightSpecificAlert(alertId, fromNotification), 300);
  }
}

function highlightSpecificAlert(alertId, fromNotification) {
  const row = document.querySelector(`tr[data-alert-id="${alertId}"]`);
  if (row) {
    // Add highlight style
    row.style.transition = "background-color 0.5s ease";
    row.style.backgroundColor = fromNotification ? "#fff9c4" : "#ffe082";
    
    // Scroll to the alert
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    
    // Remove highlight after 5 seconds
    setTimeout(() => {
      row.style.backgroundColor = "";
    }, 5000);
  }
}

// Add this CSS to your styles (or in a style tag)
const style = document.createElement('style');
style.textContent = `
  @keyframes highlight {
    0% { background-color: #ffe082; }
    100% { background-color: transparent; }
  }
`;
document.head.appendChild(style);

  const originalDisplayAlerts = displayAlerts;
  displayAlerts = function (alerts) {
    originalDisplayAlerts(alerts);
    highlightAlertFromURL();
  };
});
