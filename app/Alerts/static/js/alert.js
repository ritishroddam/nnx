document.addEventListener("DOMContentLoaded", function() {
    // Initialize elements
    const ackModal = document.getElementById("ackModal");
    const ackForm = document.getElementById("ackForm");
    const searchBtn = document.getElementById("searchAlerts");
    const alertCards = document.querySelectorAll(".alert-card");
    const tableLoading = document.querySelector(".table-loading");
    const tableContainer = document.querySelector(".alerts-table-container");
    const paginationContainer = document.createElement("div");
    paginationContainer.className = "pagination";
    tableContainer.appendChild(paginationContainer);
    
    let currentEndpoint = "panic"; // Default to panic alerts
    let currentAlertId = null;
    let currentPage = 1;
    const perPage = 10;
    
    // Initialize counts and load panic alerts by default
    loadAllCounts();
    loadAlerts();
    
    // Highlight panic card as active by default
    document.querySelector('.alert-card[data-endpoint="panic"]').classList.add('active');
    
    // Alert card click handlers
    alertCards.forEach(card => {
        card.addEventListener("click", function() {
            // Remove active class from all cards
            alertCards.forEach(c => c.classList.remove("active"));
            
            // Add active class to clicked card
            this.classList.add("active");
            
            // Update current endpoint
            currentEndpoint = this.dataset.endpoint;
            
            // Reset to first page
            currentPage = 1;
            
            // Load alerts
            loadAlerts();
        });
    });
    
    // Search button handler
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

    // Load all counts
    function loadAllCounts() {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const vehicleNumber = document.getElementById("alertVehicleNumber").value;
        
        // Show loading state for counts
        document.querySelectorAll('.alert-count').forEach(el => {
            el.classList.add('loading-count');
        });
        
        const endpoints = ['panic', 'speeding', 
                          'harsh_break', 'harsh_acceleration', 'gsm_low', 
                          'internal_battery_low','main_power_off', 'idle', 
                          'ignition_off', 'ignition_on'];
        
        const promises = endpoints.map(endpoint => {
            return fetch(`/alerts/${endpoint}_count`, {
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
            .then(response => {
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new TypeError("Server didn't return JSON");
                }
                if (!response.ok) throw new Error("Network response was not ok");
                return response.json();
            })
            .then(data => {
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
            })
            .catch(error => {
                console.error(`Error loading count for ${endpoint}:`, error);
                if (error.message.includes('Unexpected token') && error.message.includes('<!DOCTYPE')) {
                    handleSessionExpired();
                } else {
                    const card = document.querySelector(`.alert-card[data-endpoint="${endpoint}"]`);
                    if (card) {
                        const countElement = card.querySelector('.alert-count');
                        if (countElement) {
                            countElement.textContent = "0";
                            countElement.classList.remove('loading-count');
                        }
                    }
                }
            });
        });
        
        return Promise.all(promises);
    }
    
    // Load alerts for the current endpoint
    function loadAlerts() {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const vehicleNumber = document.getElementById("alertVehicleNumber").value;
        
        // Show table loading
        const tableBody = document.querySelector("#alertsTable tbody");
        tableBody.innerHTML = "";
        const loadingRow = document.createElement("tr");
        loadingRow.innerHTML = `<td colspan="7" style="text-align: center;">Loading alerts...</td>`;
        tableBody.appendChild(loadingRow);
        
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
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
        })
        .then(data => {
            if (data.success) {
                displayAlerts(data.alerts);
                updatePagination(data.count, data.page, data.per_page, data.total_pages);
                // Update count for the current card
                updateCardCount(currentEndpoint, data.count);
            } else {
                throw new Error(data.message || "Failed to fetch alerts");
            }
        })
        .catch(error => {
            console.error("Error:", error);
            showToast(error.message || "Failed to fetch alerts", "error");
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Error loading alerts</td></tr>`;
        });
    }
    
    function updatePagination(totalItems, currentPage, perPage, totalPages) {
        paginationContainer.innerHTML = "";
        
        if (totalItems <= perPage) return;
        
        // Previous button
        const prevButton = document.createElement("button");
        prevButton.textContent = "Previous";
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                loadAlerts();
            }
        });
        paginationContainer.appendChild(prevButton);
        
        // Page numbers
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
                loadAlerts();
            });
            paginationContainer.appendChild(firstPageButton);
            
            if (startPage > 2) {
                const ellipsis = document.createElement("span");
                ellipsis.textContent = "...";
                paginationContainer.appendChild(ellipsis);
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement("button");
            pageButton.textContent = i;
            if (i === currentPage) {
                pageButton.classList.add("active");
            }
            pageButton.addEventListener("click", () => {
                currentPage = i;
                loadAlerts();
            });
            paginationContainer.appendChild(pageButton);
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement("span");
                ellipsis.textContent = "...";
                paginationContainer.appendChild(ellipsis);
            }
            
            const lastPageButton = document.createElement("button");
            lastPageButton.textContent = totalPages;
            lastPageButton.addEventListener("click", () => {
                currentPage = totalPages;
                loadAlerts();
            });
            paginationContainer.appendChild(lastPageButton);
        }
        
        // Next button
        const nextButton = document.createElement("button");
        nextButton.textContent = "Next";
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener("click", () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadAlerts();
            }
        });
        paginationContainer.appendChild(nextButton);
    }
    
    function updateCardCount(endpoint, count) {
        const card = document.querySelector(`.alert-card[data-endpoint="${endpoint}"]`);
        if (card) {
            const countElement = card.querySelector('.alert-count');
            if (countElement) {
                countElement.textContent = count;
            }
        }
    }
    
    // Function to display alerts in table
    function displayAlerts(alerts) {
        const tableBody = document.querySelector("#alertsTable tbody");
        tableBody.innerHTML = "";
        
        if (alerts.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="7" style="text-align: center;">No alerts found for the selected criteria</td>`;
            tableBody.appendChild(row);
            return;
        }
        
        alerts.forEach(alert => {
            const row = document.createElement("tr");
            
            // Add class based on alert type for styling
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
                "Authorization": `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                alertId: currentAlertId,
                pressedFor: pressedFor,
                reason: reason
            }),
        })
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showToast("Alert acknowledged successfully", "success");
                ackModal.style.display = "none";
                ackForm.reset();
                
                if (data.redirect) {
                    window.location.href = data.redirect;
                } else {
                    // Refresh counts and alerts
                    loadAllCounts().then(() => {
                        loadAlerts();
                    });
                }
            } else {
                throw new Error(data.message || "Failed to acknowledge alert");
            }
        })
        .catch(error => {
            console.error("Error:", error);
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
    
    // Initialize default dates
    setDefaultDateRange();
});