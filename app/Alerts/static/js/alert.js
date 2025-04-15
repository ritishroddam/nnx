// document.addEventListener("DOMContentLoaded", function() {
//     // Initialize elements
//     const ackModal = document.getElementById("ackModal");
//     const ackForm = document.getElementById("ackForm");
//     const searchBtn = document.getElementById("searchAlerts");
//     const alertCards = document.querySelectorAll(".alert-card");
//     let currentAlertType = "all";
//     let currentAlertId = null;
    
//     // Set default dates (today)
//     const now = new Date();
//     const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//     const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
//     document.getElementById("startDate").value = formatDateTimeLocal(todayStart);
//     document.getElementById("endDate").value = formatDateTimeLocal(todayEnd);
    
//     // Initialize Selectize for dropdowns
//     if (typeof $ !== 'undefined') {
//         $("#alertVehicleNumber").selectize({
//             create: false,
//             sortField: "text",
//         });
//     }
    
//     // Load today's alerts by default
//     loadAlerts();
    
//     // Alert card click handlers
//     alertCards.forEach(card => {
//         card.addEventListener("click", function() {
//             // Remove active class from all cards
//             alertCards.forEach(c => c.classList.remove("active"));
            
//             // Add active class to clicked card
//             this.classList.add("active");
            
//             // Update current alert type
//             currentAlertType = this.dataset.alert;
            
//             // Reload alerts
//             loadAlerts();
//         });
//     });
    
//     // Search button handler
//     searchBtn.addEventListener("click", loadAlerts);
    
//     // Acknowledgment button handlers (delegated)
//     document.addEventListener("click", function(e) {
//         if (e.target.classList.contains("ack-btn")) {
//             e.preventDefault();
//             const alertId = e.target.dataset.alertId;
//             currentAlertId = alertId;
//             ackModal.style.display = "block";
//         }
//     });
    
//     // Modal close handlers
//     document.querySelectorAll(".close, .cancel-btn").forEach(btn => {
//         btn.addEventListener("click", function() {
//             ackModal.style.display = "none";
//         });
//     });
    
//     // Window click handler to close modal
//     window.addEventListener("click", function(event) {
//         if (event.target == ackModal) {
//             ackModal.style.display = "none";
//         }
//     });
    
//     // Acknowledgment form submission
//     ackForm.addEventListener("submit", function(e) {
//         e.preventDefault();
//         acknowledgeAlert();
//     });

// function loadAlerts() {
//     const startDate = document.getElementById("startDate").value;
//     const endDate = document.getElementById("endDate").value;
//     const vehicleNumber = document.getElementById("alertVehicleNumber").value;
    
//     searchBtn.disabled = true;
//     searchBtn.textContent = "Loading...";
    
//     // Determine the query based on selected alert type
//     let query = {
//         startDate: startDate,
//         endDate: endDate,
//         vehicleNumber: vehicleNumber
//     };
    
//     if (currentAlertType === "critical") {
//         query.onlyCritical = true;
//     } else if (currentAlertType === "non_critical") {
//         query.onlyNonCritical = true;
//     } else if (currentAlertType !== "all") {
//         query.alertType = currentAlertType;
//     }
    
//     fetch("/alerts/get_alerts", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//             "X-CSRF-TOKEN": getCookie("csrf_access_token"),
//         },
//         body: JSON.stringify(query),
//     })
//     .then(response => {
//         if (!response.ok) throw new Error("Network response was not ok");
//         return response.json();
//     })
//     .then(data => {
//         if (data.success) {
//             displayAlerts(data.alerts);
//             // Update counts if provided
//             if (data.counts) {
//                 updateAlertCounts(data.counts);
//             }
//         } else {
//             throw new Error(data.message || "Failed to fetch alerts");
//         }
//     })
//     .catch(error => {
//         console.error("Error:", error);
//         alert(error.message || "Failed to fetch alerts");
//     })
//     .finally(() => {
//         searchBtn.disabled = false;
//         searchBtn.textContent = "Search";
//     });
// }

// // Function to update alert counts on the cards
// function updateAlertCounts(counts) {
//     document.querySelector('[data-alert="all"] .alert-count').textContent = counts.all;
//     document.querySelector('[data-alert="critical"] .alert-count').textContent = counts.critical;
//     document.querySelector('[data-alert="non_critical"] .alert-count').textContent = counts.non_critical;
    
//     // Update individual alert type counts
//     for (const [alertType, count] of Object.entries(counts.type_counts)) {
//         const element = document.querySelector(`[data-alert="${alertType}"] .alert-count`);
//         if (element) {
//             element.textContent = count;
//         }
//     }
// }
    
//     // Function to display alerts in table
//     function displayAlerts(alerts) {
//         const tableBody = document.querySelector("#alertsTable tbody");
//         tableBody.innerHTML = "";
        
//         if (alerts.length === 0) {
//             const row = document.createElement("tr");
//             row.innerHTML = `<td colspan="7" style="text-align: center;">No alerts found for the selected criteria</td>`;
//             tableBody.appendChild(row);
//             return;
//         }
        
//         alerts.forEach(alert => {
//             const row = document.createElement("tr");
            
//             // Format status badge
//             const statusBadge = alert.acknowledged ? 
//                 `<span class="status-badge acknowledged">Acknowledged</span>` : 
//                 `<span class="status-badge pending">Pending</span>`;
            
//             // Format action button
//             const actionBtn = alert.acknowledged ?
//                 `<button class="action-btn" disabled>Acknowledged</button>` :
//                 `<button class="action-btn ack-btn" data-alert-id="${alert._id}">Acknowledge</button>`;
            
//             row.innerHTML = `
//                 <td>${alert.vehicle_number || "N/A"}</td>
//                 <td>${alert.driver || "N/A"}</td>
//                 <td>${alert.alert_type || "N/A"}</td>
//                 <td>${formatDateTime(alert.date_time)}</td>
//                 <td>${alert.location || "N/A"}</td>
//                 <td>${statusBadge}</td>
//                 <td>${actionBtn}</td>
//             `;
//             tableBody.appendChild(row);
//         });
//     }
    
//     // Function to acknowledge an alert
//     function acknowledgeAlert() {
//         const pressedFor = document.getElementById("pressedFor").value;
//         const reason = document.getElementById("ackReason").value;
        
//         if (!pressedFor) {
//             alert("Please select a reason");
//             return;
//         }
        
//         const ackBtn = ackForm.querySelector(".ack-btn");
//         ackBtn.disabled = true;
//         ackBtn.textContent = "Processing...";
        
//         fetch("/alerts/acknowledge", {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//                 "X-CSRF-TOKEN": getCookie("csrf_access_token"),
//             },
//             body: JSON.stringify({
//                 alertId: currentAlertId,
//                 pressedFor: pressedFor,
//                 reason: reason
//             }),
//         })
//         .then(response => {
//             if (!response.ok) throw new Error("Network response was not ok");
//             return response.json();
//         })
//         .then(data => {
//             if (data.success) {
//                 alert("Alert acknowledged successfully");
//                 ackModal.style.display = "none";
//                 ackForm.reset();
//                 loadAlerts(); // Refresh the alerts list
//             } else {
//                 throw new Error(data.message || "Failed to acknowledge alert");
//             }
//         })
//         .catch(error => {
//             console.error("Error:", error);
//             alert(error.message || "Failed to acknowledge alert");
//         })
//         .finally(() => {
//             ackBtn.disabled = false;
//             ackBtn.textContent = "Acknowledge";
//         });
//     }
    
//     // Helper function to format date for datetime-local input
//     function formatDateTimeLocal(date) {
//         const d = new Date(date);
//         const pad = num => num.toString().padStart(2, '0');
//         return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
//     }
    
//     // Helper function to format date for display
//     function formatDateTime(dateTimeString) {
//         if (!dateTimeString) return "N/A";
//         const date = new Date(dateTimeString);
//         return date.toLocaleString();
//     }
    
//     // Helper function to get cookie
//     function getCookie(name) {
//         const value = `; ${document.cookie}`;
//         const parts = value.split(`; ${name}=`);
//         if (parts.length === 2) return parts.pop().split(";").shift();
//     }
// });





document.addEventListener("DOMContentLoaded", function() {
    // Initialize elements
    const ackModal = document.getElementById("ackModal");
    const ackForm = document.getElementById("ackForm");
    const searchBtn = document.getElementById("searchAlerts");
    const alertCards = document.querySelectorAll(".alert-card");
    const loadingIndicator = document.getElementById("loadingIndicator");
    const tableLoading = document.querySelector(".table-loading");
    let currentEndpoint = "all";
    let currentAlertId = null;
    
    // Initialize counts
    loadAllCounts();
    loadAlerts(); // Load initial alerts
    
    // Alert card click handlers
    alertCards.forEach(card => {
        card.addEventListener("click", function() {
            // Remove active class from all cards
            alertCards.forEach(c => c.classList.remove("active"));
            
            // Add active class to clicked card
            this.classList.add("active");
            
            // Update current endpoint
            currentEndpoint = this.dataset.endpoint;
            
            // Load alerts
            loadAlerts();
        });
    });
    
    // Search button handler
    searchBtn.addEventListener("click", loadAlerts);
    
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

    // Load all counts initially
    function loadAllCounts() {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const vehicleNumber = document.getElementById("alertVehicleNumber").value;
        
        const countElements = document.querySelectorAll('.alert-count');
        countElements.forEach(el => {
            el.classList.add('loading-count');
        });
        
        const promises = [];
        
        document.querySelectorAll('.alert-card').forEach(card => {
            const endpoint = card.dataset.endpoint;
            promises.push(
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
                        const countElement = card.querySelector('.alert-count');
                        countElement.textContent = data.count;
                        countElement.classList.remove('loading-count');
                    }
                })
                .catch(error => {
                    console.error(`Error loading count for ${endpoint}:`, error);
                    const countElement = card.querySelector('.alert-count');
                    countElement.textContent = "0";
                    countElement.classList.remove('loading-count');
                })
            );
        });
        
        return Promise.all(promises);
    }
    
    // Load alerts for the current endpoint
    function loadAlerts() {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const vehicleNumber = document.getElementById("alertVehicleNumber").value;
        
        // Show loading indicators
        loadingIndicator.style.display = "flex";
        tableLoading.style.display = "flex";
        
        fetch(`/alerts/${currentEndpoint}_alerts`, {
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
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
        })
        .then(data => {
            if (data.success) {
                displayAlerts(data.alerts);
                // Update count for the current card
                const currentCard = document.querySelector(`.alert-card[data-endpoint="${currentEndpoint}"]`);
                if (currentCard) {
                    const countElement = currentCard.querySelector('.alert-count');
                    if (countElement) {
                        countElement.textContent = data.count;
                    }
                }
            } else {
                throw new Error(data.message || "Failed to fetch alerts");
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert(error.message || "Failed to fetch alerts");
        })
        .finally(() => {
            loadingIndicator.style.display = "none";
            tableLoading.style.display = "none";
        });
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
            alert("Please select a reason");
            return;
        }
        
        const ackBtn = ackForm.querySelector(".ack-btn");
        ackBtn.disabled = true;
        ackBtn.textContent = "Processing...";
        
        fetch("/alerts/acknowledge", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": getCookie("csrf_access_token"),
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
                alert("Alert acknowledged successfully");
                ackModal.style.display = "none";
                ackForm.reset();
                loadAlerts(); // Refresh the alerts list
            } else {
                throw new Error(data.message || "Failed to acknowledge alert");
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert(error.message || "Failed to acknowledge alert");
        })
        .finally(() => {
            ackBtn.disabled = false;
            ackBtn.textContent = "Acknowledge";
        });
    }
    
    // Helper function to format date for display
    function formatDateTime(dateTimeString) {
        if (!dateTimeString) return "N/A";
        const date = new Date(dateTimeString);
        return date.toLocaleString();
    }
    
    // Helper function to get cookie
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(";").shift();
    }
}); 