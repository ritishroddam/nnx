document.addEventListener("DOMContentLoaded", function () {
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
  const ITEMS_PER_PAGE = 100;
  let allAlerts = [];
  let currentPage = 1;

  const socket = io({
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("Connected to WebSocket server");
    socket.emit("join_alerts");
  });

  socket.on("new_alert", (data) => {
    console.log("New alert received:", data);
    if (shouldDisplayAlert(data.alert)) {
      showToast("New alert received", "info");

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
    const headers = [
      "Vehicle Number",
      "Driver",
      "Alert Type",
      "Time",
      "Latitude & Longitude",
      "Location",
      "Status",
    ];

    const wb = XLSX.utils.book_new();

    const rows = [];
    document.querySelectorAll("#alertsTable tbody tr").forEach((row) => {
      if (row.classList.contains("loading-row")) return;

      const cells = row.querySelectorAll("td");
      const alertId = row.dataset.alertId;
      const alertRow = document.querySelector(`tr[data-alert-id="${alertId}"]`);
      const latLng = alertRow ? alertRow.dataset.latlng : "N/A";

      rows.push([
        cells[0].textContent.trim(),
        cells[1].textContent.trim(),
        cells[2].textContent.trim(),
        cells[3].textContent.trim(),
        latLng,
        cells[4].textContent.trim(),
        cells[5].textContent.trim(),
      ]);
    });

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
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const headers = [
      "Vehicle Number",
      "Driver",
      "Alert Type",
      "Time",
      "Latitude & Longitude",
      "Location",
      "Status",
    ];

    const rows = [];
    document.querySelectorAll("#alertsTable tbody tr").forEach((row) => {
      if (row.classList.contains("loading-row")) return;

      const cells = row.querySelectorAll("td");
      const alertId = row.dataset.alertId;
      const alertRow = document.querySelector(`tr[data-alert-id="${alertId}"]`);
      const latLng = alertRow ? alertRow.dataset.latlng : "N/A";

      rows.push([
        cells[0].textContent.trim(),
        cells[1].textContent.trim(),
        cells[2].textContent.trim(),
        cells[3].textContent.trim(),
        latLng,
        cells[4].textContent.trim(),
        cells[5].textContent.trim(),
      ]);
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

  // --- Add this block before loadAlerts() ---
  // Check for alert_type in URL and activate the correct tab
  const urlParams = new URLSearchParams(window.location.search);
  const urlAlertType = urlParams.get("alert_type");
  if (urlAlertType) {
    // Convert alert_type to endpoint format (e.g., "Speeding Alert" -> "speeding")
    const endpoint = urlAlertType.toLowerCase().replace(/\s+/g, "_").replace(/_alert$/, "");
    const card = document.querySelector(`.alert-card[data-endpoint="${endpoint}"]`);
    if (card) {
      alertCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      currentEndpoint = endpoint;
      sessionStorage.setItem("currentAlertEndpoint", currentEndpoint);
    }
  }
  // --- End block ---

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
    loadAllCounts();
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

  async function loadAllCounts() {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const vehicleNumber = document.getElementById("alertVehicleNumber").value;

    try {
      const panicResponse = await fetch(`/alerts/panic_count`, {
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
      });

      const panicData = await panicResponse.json();
      if (panicData.success) {
        const card = document.querySelector(
          '.alert-card[data-endpoint="panic"]'
        );
        if (card) {
          const countElement = card.querySelector(".alert-count");
          if (countElement) {
            countElement.textContent = panicData.count;
            countElement.classList.remove("loading-count");
          }
        }
      }

      const endpoints = [
        "speeding",
        "harsh_break",
        "harsh_acceleration",
        "gsm_low",
        "internal_battery_low",
        "main_power_off",
        "idle",
        "ignition_off",
        "ignition_on",
      ];

      await Promise.all(
        endpoints.map(async (endpoint) => {
          try {
            const response = await fetch(`/alerts/${endpoint}_count`, {
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
            });

            const data = await response.json();
            if (data.success) {
              const card = document.querySelector(
                `.alert-card[data-endpoint="${endpoint}"]`
              );
              if (card) {
                const countElement = card.querySelector(".alert-count");
                if (countElement) {
                  countElement.textContent = data.count;
                  countElement.classList.remove("loading-count");
                }
              }
            }
          } catch (error) {
            console.error(`Error loading count for ${endpoint}:`, error);
          }
        })
      );
    } catch (error) {
      console.error("Error loading counts:", error);
    }
  }

  function loadAlerts() {
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

    fetch(`/alerts/${currentEndpoint}_alerts`, {
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
          allAlerts = data.alerts;
          currentPage = 1;
          updateTableAndPagination();
        } else {
          throw new Error(data.message || "Failed to fetch alerts");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        showToast(error.message || "Failed to fetch alerts", "error");
        tableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error loading alerts</td></tr>`;
      });
  }

  function updateTableAndPagination() {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedAlerts = allAlerts.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );

    displayAlerts(paginatedAlerts);
    updatePagination();
  }

  function updatePagination() {
    const paginationContainer = document.querySelector(".pagination-container"); // Select only one container
    if (!paginationContainer) {
      console.error("No pagination container found in the DOM.");
      return;
    }

    const totalPages = Math.ceil(allAlerts.length / ITEMS_PER_PAGE);

    // Clear existing content in the pagination container
    paginationContainer.innerHTML = "";

    const totalAlertsSpan = document.createElement("span");
    totalAlertsSpan.className = "total-alerts";
    totalAlertsSpan.textContent = `Total Alerts: ${allAlerts.length}`;
    paginationContainer.appendChild(totalAlertsSpan);

    if (allAlerts.length <= ITEMS_PER_PAGE) return;

    const paginationDiv = createPaginationControls(totalPages);

    // Append pagination controls to the container
    paginationContainer.appendChild(paginationDiv);
  }

  function createPaginationControls(totalPages) {
    const paginationDiv = document.createElement("div");
    paginationDiv.className = "pagination";

    const prevButton = document.createElement("button");
    prevButton.innerHTML = "&laquo; Previous";
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        updateTableAndPagination();
      }
    });
    paginationDiv.appendChild(prevButton);

    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      const firstPageButton = document.createElement("button");
      firstPageButton.textContent = "1";
      firstPageButton.addEventListener("click", () => {
        currentPage = 1;
        updateTableAndPagination();
      });
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
      if (i === currentPage) {
        pageButton.classList.add("active");
        pageButton.disabled = true;
      }
      pageButton.addEventListener("click", () => {
        currentPage = i;
        updateTableAndPagination();
      });
      paginationDiv.appendChild(pageButton);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        paginationDiv.appendChild(ellipsis);
      }

      const lastPageButton = document.createElement("button");
      lastPageButton.textContent = totalPages;
      lastPageButton.addEventListener("click", () => {
        currentPage = totalPages;
        updateTableAndPagination();
      });
      paginationDiv.appendChild(lastPageButton);
    }

    const nextButton = document.createElement("button");
    nextButton.innerHTML = "Next &raquo;";
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        updateTableAndPagination();
      }
    });
    paginationDiv.appendChild(nextButton);

    return paginationDiv;
  }

  function displayAlerts(alerts) {
    const tableBody = document.querySelector("#alertsTable tbody");
    tableBody.innerHTML = "";

    if (alerts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No alerts found</td></tr>`;
        return;
    }

    alerts.forEach((alert) => {
        const row = document.createElement("tr");
        row.dataset.alertId = alert._id;
        row.dataset.latlng = `${alert.latitude || "N/A"}, ${alert.longitude || "N/A"}`;

        if (alert.alert_type) {
            const alertTypeClass = alert.alert_type.toLowerCase().replace(/\s+/g, "-");
            row.classList.add(`alert-type-${alertTypeClass}`);
        }

        const statusBadge = alert.acknowledged
            ? `<span class="status-badge acknowledged">Acknowledged</span>`
            : `<span class="status-badge pending">Pending</span>`;

        // Only show acknowledge button for these alert types
        const alertType = alert.alert_type || alert.type || "Unknown Alert";
        let alertTypeDisplay = alertType;
        if (alertType.startsWith("Speeding Alert") && alert.speed) {
            alertTypeDisplay += ` (${alert.speed} km/h)`;
        }

        // Only show acknowledge button for these alert types
        const showAcknowledgeBtn = (
            alertType === "Panic Alert" ||
            alertType.startsWith("Speeding Alert") ||
            alertType === "Main Power Discontinue Alert" ||
            alertType === "Main Supply Remove Alert"
        );

        const actionBtn = (alert.acknowledged || !showAcknowledgeBtn)
            ? `<button class="action-btn" disabled>${alert.acknowledged ? "Acknowledged" : ""}</button>`
            : `<button class="action-btn ack-btn" data-alert-id="${alert._id}">Acknowledge</button>`;

        row.innerHTML = `
            <td>${alert.vehicle_number || "N/A"}</td>
            <td>${alert.driver || "N/A"}</td>
            <td>${alertTypeDisplay}</td>
            <td>${formatDateTime(alert.date_time)}</td>
            <td>${alert.location || "N/A"}</td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
        `;
        tableBody.appendChild(row);
    });

    // Call this after table is rendered
    highlightAlertFromURL();
  }

  function acknowledgeAlert() {
    const pressedFor = document.getElementById("pressedFor").value;
    const reason = document.getElementById("ackReason").value;

    if (!pressedFor) {
      showToast("Please select a reason", "error");
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
          showToast(
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
        showToast(error.message || "Failed to acknowledge alert", "error");
      })
      .finally(() => {
        ackBtn.disabled = false;
        ackBtn.innerHTML = originalText;
      });
  }

  function showToast(message, type = "success") {
    document
      .querySelectorAll(".toast-notification")
      .forEach((el) => el.remove());

    const toast = document.createElement("div");
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
            <i class="fas ${
              type === "success" ? "fa-check-circle" : "fa-exclamation-circle"
            }"></i>
            <span>${message}</span>
        `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 5000);
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

  // After alerts are loaded, check for alert_id in URL
  function highlightAlertFromURL() {
    const params = new URLSearchParams(window.location.search);
    const alertId = params.get("alert_id");
    if (alertId) {
        setTimeout(() => {
            const row = document.querySelector(`tr[data-alert-id="${alertId}"]`);
            if (row) {
                row.style.background = "#ffe082";
                row.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 200); // Adjust timeout if needed
    }
}

  // Call after table is updated
  const originalDisplayAlerts = displayAlerts;
  displayAlerts = function (alerts) {
    originalDisplayAlerts(alerts);
    highlightAlertFromURL();
  };
});
