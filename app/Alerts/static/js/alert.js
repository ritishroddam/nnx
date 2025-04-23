document.addEventListener("DOMContentLoaded", function() {
    // Initialize elements
    const ackModal = document.getElementById("ackModal");
    const ackForm = document.getElementById("ackForm");
    const searchBtn = document.getElementById("searchAlerts");
    const alertCards = document.querySelectorAll(".alert-card");
    const tableContainer = document.querySelector(".alerts-table-container");
    const downloadBtn = document.getElementById("downloadAlerts");
    
    const paginationContainer = document.createElement("div");
    paginationContainer.className = "pagination-container";
    tableContainer.appendChild(paginationContainer);
    
    // Create total alerts display
    const totalAlertsSpan = document.createElement("span");
    totalAlertsSpan.className = "total-alerts";
    paginationContainer.appendChild(totalAlertsSpan);
    
    let currentEndpoint = sessionStorage.getItem('currentAlertEndpoint') || "panic";
    let currentAlertId = null;
    let currentPage = 1;
    const perPage = 100; // 100 rows per page
    
    // Initialize WebSocket connection
    const socket = io({
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    // WebSocket event handlers
    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        socket.emit('join_alerts');
    });
    
    socket.on('new_alert', (data) => {
        console.log('New alert received:', data);
        if (shouldDisplayAlert(data.alert)) {
            showToast('New alert received', 'info');
            // Update the specific card count
            const endpoint = data.alert.alert_type.toLowerCase().replace(/\s+/g, '_');
            fetchCountForEndpoint(endpoint);
            
            // If this alert is of the current type being viewed, reload the table
            if (endpoint === currentEndpoint) {
                loadAlerts();
            }
        }
    });
    
    socket.on('alert_updated', (data) => {
        console.log('Alert updated:', data);
        // If this alert is in our current view, update it
        const row = document.querySelector(`tr[data-alert-id="${data.alert_id}"]`);
        if (row) {
            loadAlerts(); // Reload the current view
        }
    });

    //////////////////Excel download
    downloadBtn.addEventListener("click", function() {
        downloadAlertsAsExcel();
    });

    function downloadAlertsAsExcel() {
        const headers = ["Vehicle Number", "Driver", "Alert Type", "Time", "Location", "Status"];
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Get all visible rows from the table
        const rows = [];
        document.querySelectorAll("#alertsTable tbody tr").forEach(row => {
            if (row.classList.contains("loading-row")) return;
            
            const cells = row.querySelectorAll("td");
            rows.push([
                cells[0].textContent.trim(),
                cells[1].textContent.trim(),
                cells[2].textContent.trim(),
                cells[3].textContent.trim(),
                cells[4].textContent.trim(), // Location as single column
                cells[5].textContent.trim()
            ]);
        });
        
        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, "Alerts");
        
        // Generate filename
        const alertType = document.querySelector(".alert-card.active h3").textContent.replace(" Alert", "").replace(/\s+/g, "_");
        const vehicleNumber = document.getElementById("alertVehicleNumber").value;
        let filename = `Alerts_${alertType}`;
        if (vehicleNumber) filename += `_${vehicleNumber}`;
        filename += `_${new Date().toISOString().slice(0,10)}.xlsx`;
        
        // Export to Excel
        XLSX.writeFile(wb, filename);
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
                vehicleNumber: vehicleNumber
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const card = document.querySelector(`.alert-card[data-endpoint="${endpoint}"]`);
                if (card) {
                    const countElement = card.querySelector('.alert-count');
                    if (countElement) {
                        countElement.textContent = data.count;
                    }
                }
            }
        });
    }

    // Helper functions
    function shouldDisplayAlert(alert) {
        const currentStartDate = new Date(document.getElementById("startDate").value);
        const currentEndDate = new Date(document.getElementById("endDate").value);
        const alertDate = new Date(alert.date_time);
        const vehicleFilter = document.getElementById("alertVehicleNumber").value;
        
        if (alertDate < currentStartDate || alertDate > currentEndDate) return false;
        if (vehicleFilter && alert.vehicle_number !== vehicleFilter) return false;
        if (alert.alert_type.toLowerCase().replace(/\s+/g, '_') !== currentEndpoint) return false;
        
        return true;
    }

    function isAlertVisible(alertId) {
        return !!document.querySelector(`tr[data-alert-id="${alertId}"]`);
    }

    // Initialize with today's data
    setDefaultDateRange();
    
    const activeCard = document.querySelector(`.alert-card[data-endpoint="${currentEndpoint}"]`);
    if (activeCard) {
        alertCards.forEach(c => c.classList.remove("active"));
        activeCard.classList.add("active");
    } else {
        // Fallback to panic if stored endpoint doesn't exist
        currentEndpoint = "panic";
        document.querySelector('.alert-card[data-endpoint="panic"]').classList.add('active');
    }
    
    loadAlerts();
    
    alertCards.forEach(card => {
        card.addEventListener("click", function() {
            alertCards.forEach(c => c.classList.remove("active"));
            this.classList.add("active");
            currentEndpoint = this.dataset.endpoint;
            // Store the selected endpoint
            sessionStorage.setItem('currentAlertEndpoint', currentEndpoint);
            currentPage = 1;
            loadAlerts();
        });
    });
    
    searchBtn.addEventListener("click", function() {
        currentPage = 1;
        loadAllCounts();
        loadAlerts();
    });
    
    // Acknowledgment button handlers (delegated)
    document.addEventListener("click", function(e) {
        if (e.target.classList.contains("ack-btn")) {
            e.preventDefault();
            currentAlertId = e.target.dataset.alertId;
            ackModal.style.display = "block";
        }
    });
    
    // Modal close handlers
    document.querySelectorAll(".close, .cancel-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            ackModal.style.display = "none";
        });
    });
    
    // Window click handler to close modal
    window.addEventListener("click", function(event) {
        if (event.target == ackModal) {
            ackModal.style.display = "none";
        }
    });
    
    // Acknowledgment form submission
    ackForm.addEventListener("submit", function(e) {
        e.preventDefault();
        acknowledgeAlert();
    });

    async function loadAllCounts() {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const vehicleNumber = document.getElementById("alertVehicleNumber").value;
        
        try {
            // First load panic count immediately
            const panicResponse = await fetch(`/alerts/panic_count`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": getCookie("csrf_access_token"),
                },
                body: JSON.stringify({
                    startDate: startDate,
                    endDate: endDate,
                    vehicleNumber: vehicleNumber
                }),
            });
            
            const panicData = await panicResponse.json();
            if (panicData.success) {
                const card = document.querySelector('.alert-card[data-endpoint="panic"]');
                if (card) {
                    const countElement = card.querySelector('.alert-count');
                    if (countElement) {
                        countElement.textContent = panicData.count;
                        countElement.classList.remove('loading-count');
                    }
                }
            }
            
            // Then load other counts in parallel
            const endpoints = ['speeding', 'harsh_break', 'harsh_acceleration', 
                             'gsm_low', 'internal_battery_low', 'main_power_off', 
                             'idle', 'ignition_off', 'ignition_on'];
            
            await Promise.all(endpoints.map(async endpoint => {
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
                            vehicleNumber: vehicleNumber
                        }),
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        const card = document.querySelector(`.alert-card[data-endpoint="${endpoint}"]`);
                        if (card) {
                            const countElement = card.querySelector('.alert-count');
                            if (countElement) {
                                countElement.textContent = data.count;
                                countElement.classList.remove('loading-count');
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error loading count for ${endpoint}:`, error);
                }
            }));
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
                page: currentPage,
                per_page: perPage
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayAlerts(data.alerts);
                updateTotalAlerts(data.count);
                updatePagination(data.count, data.page, data.per_page, data.total_pages);
            } else {
                throw new Error(data.message || "Failed to fetch alerts");
            }
        })
        .catch(error => {
            console.error("Error:", error);
            showToast(error.message || "Failed to fetch alerts", "error");
            tableBody.innerHTML = `<tr><td colspan="7" class="error-message">Error loading alerts</td></tr>`;
        });
    }
    
    function updateTotalAlerts(count) {
        totalAlertsSpan.textContent = `Total Alerts: ${count}`;
    }
    
    function updatePagination(totalItems, currentPage, perPage, totalPages) {
        // Clear existing pagination
        while (paginationContainer.children.length > 1) {
            paginationContainer.removeChild(paginationContainer.lastChild);
        }
        
        if (totalItems <= perPage) return;
        
        // Create pagination controls
        const paginationControls = document.createElement("div");
        paginationControls.className = "pagination-controls";
        
        // Previous button
        const prevButton = document.createElement("button");
        prevButton.innerHTML = `<i class="fas fa-chevron-left"></i>`;
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                loadAlerts();
            }
        });
        paginationControls.appendChild(prevButton);
        
        // Page info
        const pageInfo = document.createElement("span");
        pageInfo.className = "page-info";
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        paginationControls.appendChild(pageInfo);
        
        // Next button
        const nextButton = document.createElement("button");
        nextButton.innerHTML = `<i class="fas fa-chevron-right"></i>`;
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener("click", () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadAlerts();
            }
        });
        paginationControls.appendChild(nextButton);
        
        // Add to container
        paginationContainer.appendChild(paginationControls);
    }
    
    function displayAlerts(alerts) {
        const tableBody = document.querySelector("#alertsTable tbody");
        tableBody.innerHTML = "";
        
        if (alerts.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No alerts found</td></tr>`;
            return;
        }
        
        alerts.forEach(alert => {
            const row = document.createElement("tr");
            row.dataset.alertId = alert._id;
            
            if (alert.alert_type) {
                const alertTypeClass = alert.alert_type.toLowerCase().replace(/\s+/g, '-');
                row.classList.add(`alert-type-${alertTypeClass}`);
            }
            
            const statusBadge = alert.acknowledged ? 
                `<span class="status-badge acknowledged">Acknowledged</span>` : 
                `<span class="status-badge pending">Pending</span>`;
            
            const actionBtn = alert.acknowledged ?
                `<button class="action-btn" disabled>Acknowledged</button>` :
                `<button class="action-btn ack-btn" data-alert-id="${alert._id}">Acknowledge</button>`;
            
            row.innerHTML = `
                <td>${alert.vehicle_number || "N/A"}</td>
                <td>${alert.driver || "N/A"}</td>
                <td>${alert.alert_type || "N/A"}</td>
                <td>${formatDateTime(alert.date_time)}</td>
                <td>${alert.location || "N/A"}</td>
                <td>${statusBadge}</td>
                <td>${actionBtn}</td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    // Function to acknowledge an alert
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
                "X-CSRF-TOKEN": getCookie("csrf_access_token")
            },
            body: JSON.stringify({
                alertId: currentAlertId,
                pressedFor: pressedFor,
                reason: reason
            }),
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || `Server responded with status ${response.status}`);
            }
            return data;
        })
        .then(data => {
            if (data.success) {
                showToast(data.message || "Alert acknowledged successfully", "success");
                ackModal.style.display = "none";
                ackForm.reset();
                
                // Update the specific row if we have the alert_id
                if (data.alert_id) {
                    const row = document.querySelector(`tr[data-alert-id="${data.alert_id}"]`);
                    if (row) {
                        // Update the status and action buttons
                        row.querySelector('.status-badge').textContent = 'Acknowledged';
                        row.querySelector('.status-badge').className = 'status-badge acknowledged';
                        row.querySelector('.action-btn').textContent = 'Acknowledged';
                        row.querySelector('.action-btn').disabled = true;
                    }
                } else {
                    // Fallback to reload if we don't have specific alert_id
                    loadAlerts();
                }
            } else {
                throw new Error(data.message || "Failed to acknowledge alert");
            }
        })
        .catch(error => {
            console.error("Acknowledgment error:", error);
            showToast(error.message || "Failed to acknowledge alert", "error");
        })
        .finally(() => {
            ackBtn.disabled = false;
            ackBtn.innerHTML = originalText;
        });
    }

    function showToast(message, type = "success") {
        // Remove any existing toasts first
        document.querySelectorAll('.toast-notification').forEach(el => el.remove());
        
        const toast = document.createElement("div");
        toast.className = `toast-notification ${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);
        
        // Show the toast
        setTimeout(() => {
            toast.classList.add("show");
        }, 10);
        
        // Auto-remove after delay
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
    }
    
    // Helper function to format date for display
    function formatDateTime(dateTimeString) {
        if (!dateTimeString) return "N/A";
        const date = new Date(dateTimeString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }
    
    // Set default date range (today)
    function setDefaultDateRange() {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        
        document.getElementById("startDate").value = formatDateForInput(todayStart);
        document.getElementById("endDate").value = formatDateForInput(now);
    }
    
    // Helper to format date for input fields
    function formatDateForInput(date) {
        const offset = date.getTimezoneOffset() * 60000;
        const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 16);
        return localISOTime;
    }
    
    // Helper to get cookie value
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }
    
    // Initialize default dates
    setDefaultDateRange();
});