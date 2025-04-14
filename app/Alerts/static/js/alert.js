function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
}

document.addEventListener("DOMContentLoaded", function () {
    // Initialize elements
    const alertFilterModal = document.getElementById("alertFilterModal");
    const alertResultsModal = document.getElementById("alertResultsModal");
    const alertCards = document.querySelectorAll(".alert-card");
    const closeButtons = document.querySelectorAll(".close, .cancel-btn");
    const alertFilterForm = document.getElementById("alertFilterForm");
    const searchAlertsBtn = document.getElementById("searchAlerts");
    const downloadAlertResultsBtn = document.getElementById("downloadAlertResults");
    const notificationBell = document.querySelector(".notification-bell");
    const notificationPanel = document.querySelector(".notification-panel");
    const closeNotificationsBtn = document.querySelector(".close-notifications");
    const notificationList = document.querySelector(".notification-list");
    const notificationCount = document.querySelector(".notification-count");
    
    let currentAlertType = "";
    let currentAlertData = [];
    let unreadNotifications = 0;

    // Initialize Selectize for dropdowns
    if (typeof $ !== 'undefined') {
        $("select").selectize({
            create: false,
            sortField: "text",
        });
    } else {
        console.error("jQuery not loaded - Selectize won't work");
    }

    function setupAlertCards() {
        alertCards.forEach(card => {
            card.addEventListener("click", function (e) {
                e.preventDefault();
                console.log("Alert card clicked");
                currentAlertType = this.dataset.alert;
                const alertName = this.querySelector("h3").textContent;
                
                document.getElementById("alertModalTitle").textContent = alertName;
                document.getElementById("alertResultsTitle").textContent = `${alertName} Results`;
                
                alertFilterModal.style.display = "block";
            });
        });
    }
    
    setupAlertCards();

    // Alert card click handlers
    alertCards.forEach(card => {
        card.addEventListener("click", function (e) {
            e.preventDefault();
            currentAlertType = this.dataset.alert;
            const alertName = this.querySelector("h3").textContent;
            
            document.getElementById("alertModalTitle").textContent = alertName;
            document.getElementById("alertResultsTitle").textContent = `${alertName} Results`;
            
            alertFilterModal.style.display = "block";
        });
    });

    // Close modal handlers
    closeButtons.forEach(btn => {
        btn.addEventListener("click", function () {
            alertFilterModal.style.display = "none";
            alertResultsModal.style.display = "none";
        });
    });

    // Window click handler to close modals
    window.addEventListener("click", function (event) {
        if (event.target == alertFilterModal) {
            alertFilterModal.style.display = "none";
        }
        if (event.target == alertResultsModal) {
            alertResultsModal.style.display = "none";
        }
    });

    // Alert filter form submission
    alertFilterForm.addEventListener("submit", function (e) {
        e.preventDefault();
        searchAlerts();
    });

    // Search alerts button handler
    searchAlertsBtn.addEventListener("click", searchAlerts);

    // Download alert results button handler
    downloadAlertResultsBtn.addEventListener("click", downloadAlertResults);

    // Notification bell click handler
    notificationBell.addEventListener("click", function () {
        notificationPanel.style.display = notificationPanel.style.display === "block" ? "none" : "block";
        if (notificationPanel.style.display === "block") {
            markNotificationsAsRead();
        }
    });

    // Close notifications panel
    closeNotificationsBtn.addEventListener("click", function () {
        notificationPanel.style.display = "none";
    });

    // Function to search alerts
    function searchAlerts() {
        const dateRange = document.getElementById("alertDateRange").value;
        const vehicleNumber = document.getElementById("alertVehicleNumber").value;
        
        const searchBtn = document.getElementById("searchAlerts");
        const originalText = searchBtn.textContent;
        searchBtn.disabled = true;
        searchBtn.textContent = "Searching...";
        
        fetch("/alerts/get_alerts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": getCookie("csrf_access_token"),
            },
            body: JSON.stringify({
                alertType: currentAlertType,
                dateRange: dateRange,
                vehicleNumber: vehicleNumber
            }),
        })
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
        })
        .then(data => {
            if (data.success) {
                currentAlertData = data.alerts;
                displayAlertResults(data.alerts);
                alertFilterModal.style.display = "none";
                alertResultsModal.style.display = "block";
            } else {
                throw new Error(data.message || "Failed to fetch alerts");
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert(error.message || "Failed to fetch alerts");
        })
        .finally(() => {
            searchBtn.disabled = false;
            searchBtn.textContent = originalText;
        });
    }

    // Function to display alert results
    function displayAlertResults(alerts) {
        const tableBody = document.querySelector("#alertResultsTable tbody");
        tableBody.innerHTML = "";
        
        if (alerts.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="6" style="text-align: center;">No alerts found for the selected criteria</td>`;
            tableBody.appendChild(row);
            return;
        }
        
        alerts.forEach(alert => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${alert.vehicle_number || "N/A"}</td>
                <td>${formatDateTime(alert.date_time)}</td>
                <td>${alert.alert_type || "N/A"}</td>
                <td>${alert.location || "N/A"}</td>
                <td>${alert.latitude || "N/A"}</td>
                <td>${alert.longitude || "N/A"}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Function to download alert results
    function downloadAlertResults() {
        if (currentAlertData.length === 0) {
            alert("No data to download");
            return;
        }
        
        const downloadBtn = document.getElementById("downloadAlertResults");
        const originalText = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Downloading...`;
        
        fetch("/alerts/download_alerts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": getCookie("csrf_access_token"),
            },
            body: JSON.stringify({
                alerts: currentAlertData,
                alertType: currentAlertType
            }),
        })
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${currentAlertType}_alerts_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(error => {
            console.error("Error:", error);
            alert(error.message || "Failed to download alerts");
        })
        .finally(() => {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
        });
    }

    // Function to show toast notification
    function showToastNotification(alert) {
        const toast = document.createElement("div");
        toast.className = "toast-notification";
        toast.innerHTML = `
            <i class="fa-solid fa-bell"></i>
            <div class="toast-content">
                <strong>${alert.alert_type}</strong> for vehicle ${alert.vehicle_number}
                <div class="time">${formatDateTime(alert.date_time)}</div>
            </div>
            <span class="close-toast">&times;</span>
        `;
        
        document.body.appendChild(toast);
        
        // Show the toast
        setTimeout(() => {
            toast.classList.add("show");
        }, 100);
        
        // Close button handler
        toast.querySelector(".close-toast").addEventListener("click", () => {
            toast.remove();
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    // Function to add notification to panel
    function addNotificationToPanel(alert) {
        const notificationItem = document.createElement("div");
        notificationItem.className = "notification-item";
        notificationItem.innerHTML = `
            <div class="alert-type">${alert.alert_type}</div>
            <div class="vehicle-number">Vehicle: ${alert.vehicle_number}</div>
            <div class="location">${alert.location || "Location not available"}</div>
            <div class="time">${formatDateTime(alert.date_time)}</div>
        `;
        
        notificationItem.addEventListener("click", () => {
            currentAlertType = alert.alert_type.toLowerCase().replace(/ /g, "_");
            currentAlertData = [alert];
            displayAlertResults([alert]);
            alertResultsModal.style.display = "block";
            notificationPanel.style.display = "none";
        });
        
        notificationList.insertBefore(notificationItem, notificationList.firstChild);
    }

    // Function to mark notifications as read
    function markNotificationsAsRead() {
        unreadNotifications = 0;
        updateNotificationCount();
    }

    // Function to update notification count
    function updateNotificationCount() {
        notificationCount.textContent = unreadNotifications;
        notificationCount.style.display = unreadNotifications > 0 ? "flex" : "none";
    }

    // Function to format date time
    function formatDateTime(dateTimeString) {
        if (!dateTimeString) return "N/A";
        const date = new Date(dateTimeString);
        return date.toLocaleString();
    }

    // Function to get cookie
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(";").shift();
    }

    // WebSocket connection for real-time alerts
    function connectWebSocket() {
        const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
        const wsUrl = protocol + window.location.host + "/alerts/ws";
        const socket = new WebSocket(wsUrl);
        
        socket.onopen = function() {
            console.log("WebSocket connection established");
        };
        
        socket.onmessage = function(event) {
            const alert = JSON.parse(event.data);
            handleNewAlert(alert);
        };
        
        socket.onclose = function() {
            console.log("WebSocket connection closed. Reconnecting...");
            setTimeout(connectWebSocket, 5000);
        };
        
        socket.onerror = function(error) {
            console.error("WebSocket error:", error);
        };
    }

    // Function to handle new alert
    function handleNewAlert(alert) {
        // Show toast notification
        showToastNotification(alert);
        
        // Add to notification panel
        addNotificationToPanel(alert);
        
        // Update unread count
        unreadNotifications++;
        updateNotificationCount();
    }

    // Initialize WebSocket connection
    connectWebSocket();
});