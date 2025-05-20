let vehicleData = new Map();
var map;
var markers = {};
var geocoder;
var addressCache = {};
var refreshInterval = 5000;
var infoWindow;
var countdownTimer = refreshInterval / 1000;
var firstFit = true;
var manualClose = false;
var dataAvailable = true;
var sosActiveMarkers = {};
var lastDataReceivedTime = {};

const socket = io(CONFIG.SOCKET_SERVER_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.on("connect", () => {
  console.log("Connected to socket server");

  let companyNames = null;

  if (companyName != "None") {
    companyNames = companyName;
  }

  socket.emit("authenticate", {
    user_id: userID,
    company: companyNames,
  });
});

socket.on("authentication_success", (data) => {
  console.log("Authentication successful");
  socket.emit("get_rooms");
});

socket.on("authentication_error", (data) => {
  console.error("Authentication failed:", data.message);
});

socket.on("connect_error", (error) => {
  console.error("WebSocket connection error:", error);
});

socket.on("disconnect", () => {
  console.warn("WebSocket disconnected");
});

socket.on("authentication_success", (data) => {
  console.log("Authentication successful");
  socket.emit("get_rooms");
});

socket.on("vehicle_live_update", (data) => {
  console.log("Live update received for vehicle KA73BB6459:", data);
});

socket.on("vehicle_update", async function (data) {
  try {
    // Wait for fetchdistance to resolve and return the updated data
    const updatedData = await updateData(data);

    updateVehicleData(updatedData);
    updateVehicleCard(updatedData);
  } catch (error) {
    console.error("Error in vehicle_update handler:", error);
  }
});

socket.on("sos_alert", function (data) {
  console.log("SOS alert received:", data);
  imei = data.imei;
  if (markers[imei]) {
    triggerSOS(imei, markers[imei]);
  }
});

async function updateData(data) {
  const oldData = vehicleData.get(data.imei);

  if (oldData) {
    let distance = parseFloat(data.odometer) - parseFloat(oldData.odometer);
    distance = (parseFloat(distance) + parseFloat(oldData.distance)).toFixed(2);

    data["distance"] = String(distance);
    data["gsm"] = String(data.gsm_sig);
    vehicleData.set(data.imei, data);
  } else {
    data["distance"] = "0.00";
    data["gsm"] = String(data.gsm_sig);
    vehicleData.set(data.imei, data);
  }

  return data;
}

async function fetchVehicleData() {
  try {
    const response = await fetch("/vehicle/api/vehicles");
    if (!response.ok) throw new Error("Failed to fetch vehicle data");

    const data = await response.json();

    data.forEach((vehicle) => {
      vehicleData.set(vehicle.imei, {
        LicensePlateNumber: vehicle.LicensePlateNumber,
        VehicleType: vehicle.VehicleType,
        speed: vehicle.speed,
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        date: vehicle.date,
        time: vehicle.time,
        course: vehicle.course,
        address: vehicle.location || "Location unknown",
        status: vehicle.status,
        imei: vehicle.imei,
        ignition: vehicle.ignition,
        gsm: vehicle.gsm_sig,
        sos: vehicle.sos,
        distance: vehicle.distance || 0,
        odometer: vehicle.odometer,
      });
    });
  } catch (error) {
    console.error("Error fetching vehicle data:", error);
    return [];
  }
}

function updateVehicleCard(data) {
  const imei = data.imei;
  const vehicleCard = document.querySelector(
    `.vehicle-card[data-imei="${imei}"]`
  );

  const latitude = data.latitude ? parseFloat(data.latitude) : null;
  const longitude = data.longitude ? parseFloat(data.longitude) : null;
  const url = `/routeHistory/vehicle/${data.LicensePlateNumber}`;

  if (vehicleCard) {
    // Update existing vehicle card
    vehicleCard.querySelector(".vehicle-info").innerHTML = `
      <strong>Speed:</strong> ${data.speed ? convertSpeedToKmh(data.speed).toFixed(2) + " km/h" : "Unknown"} <br>
  <strong>Lat&Lon:</strong> ${latitude && longitude ? `${latitude.toFixed(4)},${longitude.toFixed(4)}` : "N/A"} <br>
  <strong>Distance Travelled:</strong> ${data.distance ? parseFloat(data.distance).toFixed(2) : "NA"} km <br>
      <strong>Last Update:</strong> ${formatLastUpdatedText(
        data.date,
        data.time
      )} <br>
      <strong>Location:</strong> ${data.address || "Location unknown"} <br>
      <strong>Data:</strong> <a href="${url}" target="_blank">View Data</a>
    `;
  } else {
    // Create a new vehicle card
    const listContainer = document.getElementById("vehicle-list");
    const vehicleElement = document.createElement("div");
    vehicleElement.classList.add("vehicle-card");
    vehicleElement.setAttribute("data-imei", data.imei);
    vehicleElement.innerHTML = `
      <div class="vehicle-header">${data.LicensePlateNumber || "Unknown"} - ${
      data.status || "Unknown"
    }</div>
      <div class="vehicle-info">
        <strong>Speed:</strong> ${
          data.speed
            ? convertSpeedToKmh(data.speed).toFixed(2) + " km/h"
            : "Unknown"
        } <br>
        <strong>Lat:</strong> ${latitude} <br>
        <strong>Lon:</strong> ${longitude} <br>
        <strong>Distance Travelled:</strong> ${data.distance || "NA"} km <br>
        <strong>Last Update:</strong> ${formatLastUpdatedText(
          data.date,
          data.time
        )} <br>
        <strong>Location:</strong> ${data.address || "Location unknown"} <br>
        <strong>Data:</strong> <a href="${url}" target="_blank">View Data</a>
      </div>
    `;
    listContainer.appendChild(vehicleElement);
  }
  filterVehicles();
  addHoverListenersToCardsAndMarkers();
  showHidecar();
}

function triggerSOS(imei, marker) {
  if (!sosActiveMarkers[imei]) {
    const sosDiv = document.createElement("div");
    sosDiv.className = "sos-blink";
    marker.div.appendChild(sosDiv);
    sosActiveMarkers[imei] = sosDiv;

    marker.div.classList.add("vehicle-blink");

    setTimeout(() => {
      removeSOS(imei);
    }, 60000);
  }
}

async function renderVehicles() {
  showHidecar();
  const listContainer = document.getElementById("vehicle-list");
  const countContainer = document.getElementById("vehicle-count");
  listContainer.innerHTML = "";
  countContainer.innerText = vehicleData.length;
  vehicleData.forEach((vehicle, imei) => {
    const vehicleElement = document.createElement("div");
    vehicleElement.classList.add("vehicle-card");
    vehicleElement.setAttribute("data-imei", vehicle.imei);

    const latitude = vehicle.latitude ? parseFloat(vehicle.latitude) : null;
    const longitude = vehicle.longitude ? parseFloat(vehicle.longitude) : null;
    const url = `/routeHistory/vehicle/${vehicle.LicensePlateNumber}`;

    vehicleElement.innerHTML = `
      <div class="vehicle-header">${vehicle.LicensePlateNumber} - ${
      vehicle.status || "Unknown"
    }</div>
      <div class="vehicle-info">
        <strong>Speed:</strong> ${
          vehicle.speed
            ? convertSpeedToKmh(vehicle.speed).toFixed(2) + " km/h"
            : "Unknown"
        } <br>
        <strong>Lat&Lon:</strong> ${latitude && longitude ? `${latitude.toFixed(4)},${longitude.toFixed(4)}` : "N/A"} <br>
        <strong>Distance Travelled:</strong> ${vehicle.distance ? parseFloat(vehicle.distance).toFixed(2) : "NA"} km <br>
        <strong>Last Update:</strong> ${formatLastUpdatedText(
          vehicle.date,
          vehicle.time
        )} <br>
        <strong>Location:</strong> ${vehicle.address || "Location unknown"} <br>
        <strong>Data:</strong> <a href="${url}" target="_blank">View Data</a>
      </div>
    `;
    listContainer.appendChild(vehicleElement);
  });

  filterVehicles();
  addHoverListenersToCardsAndMarkers();
  showHidecar();
}

function setInfoWindowContent(infoWindow, marker, latLng, device, address) {
  const imei = device.imei || '<span class="missing-data">N/A</span>';
  const LicensePlateNumber =
    device.LicensePlateNumber || '<span class="missing-data">N/A</span>';
  const speed =
    device.speed !== null && device.speed !== undefined
      ? `${convertSpeedToKmh(device.speed).toFixed(2)} km/h`
      : '<span class="missing-data">Unknown</span>';
  const lat = latLng.lat() || '<span class="missing-data">Unknown</span>';
  const lon = latLng.lng() || '<span class="missing-data">Unknown</span>';
  const date = device.date || "N/A";
  const time = device.time || "N/A";
  const addressText =
    address || '<span class="missing-data">Location unknown</span>';
  const url = `/routeHistory/vehicle/${device.LicensePlateNumber}`;

  const content = `<div class="info-window show">
                    <strong><span style="color: #336699;">${LicensePlateNumber}:</span></strong> <br>
                    <hr>
                    <p><strong>Speed:</strong> ${speed}</p>
                    <p><strong>Lat:</strong> ${lat}</p>
                    <p><strong>Lon:</strong> ${lon}</p>
                    <strong>Distance Travelled:</strong> ${
                      device.distance || "NA"
                    } km <br>
                    <p><strong>Last Update:</strong> ${formatLastUpdatedText(
                      device.date,
                      device.time
                    )}</p>
                    <p class="address"><strong>Location:</strong> ${addressText}</p>
                    <p><a href="${url}" target="_blank">VIEW IN DETAIL</a>
                    </p>
                </div>`;

  infoWindow.setContent(content);
  infoWindow.setPosition(latLng);
}

function addMarkerClickListener(marker, latLng, device, coords) {
  if (!(latLng instanceof google.maps.LatLng)) {
    latLng = new google.maps.LatLng(coords.lat, coords.lon);
  }

  const address = device.address || "Location unknown";
  marker.addListener("gmp-click", function () {
    setInfoWindowContent(infoWindow, marker, latLng, device, address);
    infoWindow.open(map, marker);
  });
}

function updateMap() {
  const bounds = new google.maps.LatLngBounds();
  dataAvailable = true;
  countdownTimer = refreshInterval / 1000;

  vehicleData.forEach((device, imei) => {
    if (
      device.latitude &&
      device.longitude &&
      device.speed != null &&
      device.course != null
    ) {
      const latLng = parseCoordinates(device.latitude, device.longitude); // Already returns google.maps.LatLng
      const iconUrl = getCarIconBySpeed(
        device.speed,
        imei,
        device.date,
        device.time
      );
      const rotation = device.course;

      if (markers[imei]) {
        updateAdvancedMarker(markers[imei], latLng, iconUrl, rotation);
        markers[imei].device = device;
      } else {
        markers[imei] = createAdvancedMarker(latLng, iconUrl, rotation, device);
      }

      if (device.sos === "1") {
        triggerSOS(imei, markers[imei]);
      } else {
        removeSOS(imei);
      }

      lastDataReceivedTime[imei] = new Date(`${device.date}T${device.time}`);
      bounds.extend(latLng);
    }

    checkForDataTimeout(imei);
  });

  if (!bounds.isEmpty() && firstFit) {
    map.fitBounds(bounds);
    firstFit = false;

    const boundsCenter = bounds.getCenter();
    const offset = -2;
    const newCenter = {
      lat: boundsCenter.lat(),
      lng: boundsCenter.lng() + offset,
    };

    map.setCenter(newCenter);

    const listener = google.maps.event.addListener(map, "idle", function () {
      if (map.getZoom() < 7) {
        // Adjust the zoom level as needed
        map.setZoom(7);
      }
      google.maps.event.removeListener(listener);
    });
  }

  renderVehicles();
  filterVehicles();
}

function animateMarker(marker, newPosition, duration = 6000) {
  let startPosition = new google.maps.LatLng(
    marker.position.lat,
    marker.position.lng
  );
  if (!startPosition) {
    console.error("Marker's start position is not defined.");
    return;
  }
  const startTime = performance.now();

  function moveMarker(currentTime) {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    const lat =
      startPosition.lat() +
      (newPosition.lat() - startPosition.lat()) * progress;
    const lng =
      startPosition.lng() +
      (newPosition.lng() - startPosition.lng()) * progress;

    marker.position = new google.maps.LatLng(lat, lng);

    if (progress < 1) {
      requestAnimationFrame(moveMarker);
    }
  }

  requestAnimationFrame(moveMarker);
}

function filterVehicles() {
  const filterValue = document.getElementById("speed-filter").value;
  let filteredVehicles = [];
  const now = new Date();

  Object.keys(markers).forEach((imei) => {
    const marker = markers[imei];
    const speedKmh = marker.device.speed
      ? convertSpeedToKmh(marker.device.speed)
      : 0; // Speed in km/h
    const hasSOS = marker.device.sos === "1"; // Check if SOS is active
    const lastUpdate = convertToDate(marker.device.date, marker.device.time);
    const hoursSinceLastUpdate = (now - lastUpdate) / (1000 * 60 * 60);

    let isVisible = false;

    switch (filterValue) {
      case "0":
        isVisible = speedKmh === 0 && hoursSinceLastUpdate < 24;
        break;
      case "0-40":
        isVisible = speedKmh > 0 && speedKmh <= 40 && hoursSinceLastUpdate < 24;
        break;
      case "40-60":
        isVisible =
          speedKmh > 40 && speedKmh <= 60 && hoursSinceLastUpdate < 24;
        break;
      case "60+":
        isVisible = speedKmh > 60 && hoursSinceLastUpdate < 24;
        break;
      case "sos":
        isVisible = hasSOS && hoursSinceLastUpdate < 24;
        break;
      case "offline":
        isVisible = hoursSinceLastUpdate > 24;
        break;
      default: // "all"
        isVisible = true;
        break;
    }

    // Set marker visibility
    marker.map = isVisible ? map : null;

    if (isVisible) {
      filteredVehicles.push(marker.device);
    }
  });
  updateFloatingCard(filteredVehicles, filterValue);
}

function parseCoordinates(lat, lng) {
  if (isNaN(lat) || isNaN(lng)) {
    console.error("Invalid coordinates:", lat, lng);
    return new google.maps.LatLng(0, 0); // Return a default LatLng object
  }

  return new google.maps.LatLng(lat, lng);
}

function convertSpeedToKmh(speedkmh) {
  return parseFloat(speedkmh);
}

function getCarIconUrlBySpeed(speedInKmh) {
  if (speedInKmh === 0) {
    return "/static/images/car_yellow.png";
  } else if (speedInKmh > 0 && speedInKmh <= 40) {
    return "/static/images/car_green.png";
  } else if (speedInKmh > 40 && speedInKmh <= 60) {
    return "/static/images/car_blue.png";
  } else {
    return "/static/images/car_red.png";
  }
}

function convertToDate(ddmmyyyy, hhmmss) {
  // Extract day, month, and year
  let day = ddmmyyyy.substring(0, 2);
  let month = ddmmyyyy.substring(2, 4);
  let year = ddmmyyyy.substring(4, 6);

  year = parseInt(year) + 2000;

  // Extract hours, minutes, and seconds
  let hours = hhmmss.substring(0, 2);
  let minutes = hhmmss.substring(2, 4);
  let seconds = hhmmss.substring(4, 6);

  // JavaScript Date uses month index starting from 0 (January is 0)
  let dateObj = new Date(year, month - 1, day, hours, minutes, seconds);

  return dateObj;
}

function getCarIconBySpeed(speed, imei, date, time) {
  const speedInKmh = convertSpeedToKmh(speed);
  let iconUrl = getCarIconUrlBySpeed(speedInKmh);

  const now = new Date();
  const lastUpdateTime = convertToDate(date, time);

  const timeDiff = now - lastUpdateTime;
  const dayDiff = timeDiff / (1000 * 60 * 60 * 24);

  if (dayDiff >= 1) {
    iconUrl = "/static/images/car_black.png";
  }

  return iconUrl;
}

// Function to check if data is missing for more than 1 hour
function checkForDataTimeout(imei) {
  const now = new Date();
  const marker = markers[imei];

  if (lastDataReceivedTime[imei]) {
    const timeDiff = now - lastDataReceivedTime[imei];
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff >= 1) {
      // Highlight marker by adding a red border and show tooltip on hover
      marker.div.style.border = "2px solid red"; // Highlight vehicle

      // Add a hover event to show "Old data!" tooltip
      marker.div.addEventListener("mouseover", function () {
        const tooltip = document.createElement("div");
        tooltip.className = "old-data-tooltip";
        tooltip.innerText = "Old data! New data not yet received";
        tooltip.style.position = "absolute";
        tooltip.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        tooltip.style.color = "white";
        tooltip.style.padding = "5px";
        tooltip.style.borderRadius = "5px";
        tooltip.style.top = "-30px"; // Position tooltip above the marker
        tooltip.style.left = "50%";
        tooltip.style.transform = "translateX(-50%)";
        tooltip.style.zIndex = "1000";
        marker.div.appendChild(tooltip);

        // Remove tooltip on mouseout
        marker.div.addEventListener("mouseout", function () {
          tooltip.remove();
        });
      });
    }
  }
}

function updateVehicleData(vehicle) {
  const imei = vehicle.imei;
  const latLng = parseCoordinates(vehicle.latitude, vehicle.longitude); // Already returns google.maps.LatLng
  const iconUrl = getCarIconBySpeed(
    vehicle.speed,
    imei,
    vehicle.date,
    vehicle.time
  );
  const rotation = vehicle.course;

  if (markers[imei]) {
    markers[imei].device = vehicle;
    animateMarker(markers[imei], latLng);
    updateAdvancedMarker(markers[imei], latLng, iconUrl, rotation);

    const markerContent = markers[imei].content;
    const markerImage = markerContent.querySelector("img");
    if (markerImage) {
      markerImage.src = iconUrl; // Update the icon URL
      markerContent.style.transform = `rotate(${rotation}deg)`; // Update rotation
    }
  } else {
    markers[imei] = createAdvancedMarker(latLng, iconUrl, rotation, vehicle);
  }

  if (vehicle.sos === "1") {
    triggerSOS(imei, markers[imei]);
  } else {
    removeSOS(imei);
  }

  lastDataReceivedTime[imei] = new Date();
  filterVehicles();
  addHoverListenersToCardsAndMarkers();
  showHidecar();
}

function removeSOS(imei) {
  if (sosActiveMarkers[imei]) {
    sosActiveMarkers[imei].remove();
    delete sosActiveMarkers[imei];
  }

  const marker = markers[imei];
  if (marker && marker.content) {
    marker.content.classList.remove("vehicle-blink");
  }
}

function formatDateTime(dateString, timeString) {
  const day = dateString.slice(0, 2);
  const month = dateString.slice(2, 4);
  const year = "20" + dateString.slice(4);
  let hour = parseInt(timeString.slice(0, 2), 10);
  const minute = timeString.slice(2, 4);
  const second = timeString.slice(4, 6);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  const formattedDate = `${day}/${month}/${year}`;
  const formattedTime = `${hour}:${minute}:${second} ${ampm}`;
  return { formattedDate, formattedTime };
}

function updateFloatingCard(vehicles, filterValue) {
  if (document.getElementById("toggle-card-switch").checked === false) {
    hideCard();

    const vehicleCounter = document.getElementById("vehicle-counter");

    const vehicleCount = document.getElementById("vehicle-count");
    vehicleCount.innerText = vehicles.length;

    vehicleCounter.innerHTML = `${headingText}: <span id="vehicle-count">${vehicles.length}</span>`;
  } else {
    const vehicleList = document.getElementById("vehicle-list");
    const vehicleCounter = document.getElementById("vehicle-counter");
    const vehicleCount = document.getElementById("vehicle-count");

    vehicleList.innerHTML = "";
    vehicleCount.innerText = vehicles.length;

    let headingText = "All Vehicles";
    switch (filterValue) {
      case "0":
        headingText = "Stationary Vehicles";
        break;
      case "0-40":
        headingText = "Slow Speed Vehicles";
        break;
      case "40-60":
        headingText = "Moderate Speed Vehicles";
        break;
      case "60+":
        headingText = "High Speed Vehicles";
        break;
      case "sos":
        headingText = "SOS Alert Vehicles";
        break;
      case "offline":
        headingText = "Offline Vehicles";
        break;
      default:
        headingText = "All Vehicles";
        break;
    }
    vehicleCounter.innerHTML = `${headingText}: <span id="vehicle-count">${vehicles.length}</span>`;

    vehicles.forEach((vehicle) => {
      const vehicleElement = document.createElement("div");
      vehicleElement.classList.add("vehicle-card");
      vehicleElement.setAttribute("data-imei", vehicle.imei);

      const latitude = vehicle.latitude ? parseFloat(vehicle.latitude) : null;
      const longitude = vehicle.longitude
        ? parseFloat(vehicle.longitude)
        : null;

      const url = `/routeHistory/vehicle/${vehicle.LicensePlateNumber}`;

      vehicleElement.innerHTML = `
        <div class="vehicle-header">${vehicle.LicensePlateNumber} - ${
        vehicle.status || "Unknown"
      }</div>
        <div class="vehicle-info">
          Last Update: ${formatLastUpdatedText(
            vehicle.date,
            vehicle.time
          )} <br>
          Speed: ${
            vehicle.speed
              ? convertSpeedToKmh(vehicle.speed).toFixed(2) + " km/h"
              : "Unknown"
          } <br>
          Lat & Lon:${latitude && longitude ? `${parseFloat(latitude).toFixed(4)},${parseFloat(longitude).toFixed(4)}` : "N/A"} <br>
          <span class="location-text">
          Location: ${
            vehicle.address || "Location unknown"
          } 
          </span> <br>
          <span class="last-updated-text">
          <strong>Distance Travelled:</strong> <br> <span class="last-updated-sub"> ${
            vehicle.distance || "NA"
          } km
           </span>
           </span> <br>
          <a href="${url}" target="_blank">VIEW IN DETAIL</a>
        </div>`;

      vehicleList.appendChild(vehicleElement);
    });
  }
}

document.querySelector(".toggle-slider").addEventListener("click", function () {
  this.classList.toggle("active");

  if (this.classList.contains("active")) {
    showListView();
  } else {
    showMapView();
  }
});

function showMapView() {
  document.getElementById("map").style.display = "block";
  document.getElementById("vehicle-table-container").style.display = "none";
  document.querySelector(".floating-card").style.display = "block";
  document.querySelector(".icon-legend").style.display = "block";
  updateMap();
}

function showListView() {
  document.getElementById("map").style.display = "none";
  document.getElementById("vehicle-table-container").style.display = "block";
  document.querySelector(".floating-card").style.display = "none";
  document.querySelector(".icon-legend").style.display = "none";
  populateVehicleTable();
}

function formatLastUpdatedText(date, time) {
  const lastUpdated = convertToDate(date, time);
  const now = new Date();
  const timeDiff = Math.abs(now - lastUpdated);
  let lastUpdatedText = "";

  if (timeDiff < 60 * 1000) {
    const seconds = Math.floor(timeDiff / 1000);
    lastUpdatedText = ` ${seconds} seconds ago`;
  } else if (timeDiff < 60 * 60 * 1000) {
    const minutes = Math.floor(timeDiff / (1000 * 60));
    lastUpdatedText = ` ${minutes} minutes ago`;
  } else if (timeDiff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    lastUpdatedText = ` ${hours} hours ${minutes} minutes ago`;
  } else if (timeDiff < 48 * 60 * 60 * 1000) {
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    lastUpdatedText = ` ${days} day ${hours} hours ago`;
  } else {
    const { formattedDate, formattedTime } = formatDateTime(date, time);
    lastUpdatedText = formattedTime + " " + formattedDate;
  }

  return lastUpdatedText;
}

async function populateVehicleTable() {
  const tableBody = document
    .getElementById("vehicle-table")
    .getElementsByTagName("tbody")[0];
  tableBody.innerHTML = ""; // Clear existing rows

  showHidecar();
  const listContainer = document.getElementById("vehicle-list");
  const countContainer = document.getElementById("vehicle-count");
  listContainer.innerHTML = "";
  countContainer.innerText = vehicleData.length;

  vehicleData.forEach((vehicle, imei) => {
    const vehicleElement = document.createElement("div");
    vehicleElement.classList.add("vehicle-card");
    vehicleElement.setAttribute("data-imei", vehicle.imei);

    const latitude = vehicle.latitude ? parseFloat(vehicle.latitude) : null;
    const longitude = vehicle.longitude ? parseFloat(vehicle.longitude) : null;

    const speedValue =
      vehicle.speed !== null && vehicle.speed !== undefined
        ? convertSpeedToKmh(vehicle.speed).toFixed(2)
        : null;

    const speed = speedValue !== null ? `${speedValue} km/h` : "Unknown";
    const address = vehicle.address || "Location unknown";
    const url = `/routeHistory/vehicle/${vehicle.LicensePlateNumber}`;

    console.log(vehicle.imei);

    const row = tableBody.insertRow();
    row.insertCell(0).innerText = vehicle.LicensePlateNumber
      ? vehicle.LicensePlateNumber
      : vehicle.imei;
    row.insertCell(1).innerText = vehicle.VehicleType;
    row.insertCell(2).innerText = formatLastUpdatedText(
      vehicle.date,
      vehicle.time
    );

    row.insertCell(3).innerText = `${vehicle.address || "Location unknown"}`;
    row.insertCell(4).innerText = latitude ? latitude.toFixed(4) : "N/A";
    row.insertCell(5).innerText = longitude ? longitude.toFixed(4) : "N/A";

    const speedCell = row.insertCell(6);
    speedCell.innerText = speed;
    if (speedValue !== null && parseFloat(speedValue) > 60) {
      speedCell.style.border = "2px solid red";
    }

    row.insertCell(7).innerText = vehicle.distance ? parseFloat(vehicle.distance).toFixed(2) : "N/A";
    row.insertCell(8).innerText = vehicle.odometer; // Assuming odometer reading
    row.insertCell(9).innerText = vehicle.ignition;
    row.insertCell(10).innerText = vehicle.gsm;
    row.insertCell(11).innerText = vehicle.sos;
    row.insertCell(
      12
    ).innerHTML = `<a href="${url}" target="_blank">View Data</a>`;
  });
  showHidecar();
}

document
  .getElementById("toggle-card-switch")
  .addEventListener("change", function () {
    if (this.checked) {
      showCard();
    } else {
      hideCard();
    }
  });

function showHidecar() {
  if (document.getElementById("toggle-card-switch").checked) {
    showCard();
  } else {
    hideCard();
  }
}

function showCard() {
  const vehicleCard = document.querySelectorAll(".vehicle-card");
  vehicleCard.forEach((tag) => {
    tag.style.display = "block";
  });

  const sliderButton = document.querySelector(".slider-card-button");
  if (sliderButton) {
    sliderButton.classList.remove("active");
  }
}

function hideCard() {
  const vehicleCard = document.querySelectorAll(".vehicle-card");
  vehicleCard.forEach((tag) => {
    tag.style.display = "none";
  });

  const sliderButton = document.querySelector(".slider-card-button");
  if (sliderButton) {
    sliderButton.classList.add("active");
  }
}

async function initMap() {
  const defaultCenter = { lat: 20.5937, lng: 78.9629 };
  const offset = -5;

  const newCenter = {
    lat: defaultCenter.lat,
    lng: defaultCenter.lng + offset,
  };

  const darkMode = document.body.classList.contains("dark-mode");

  const mapId = darkMode ? "e426c1ad17485d79" : "dc4a8996aab2cac9";

  const { Map, LatLngBounds } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

  // Initialize Map
  map = new Map(document.getElementById("map"), {
    center: newCenter,
    mapId: mapId,
    zoom: 5,
    gestureHandling: "greedy",
    zoomControl: true,
    mapTypeControl: false, // Disable default map type buttons
    clickableIcons: false, // Disable POI icons
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM,
    },
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM,
    },
  });

  geocoder = new google.maps.Geocoder();
  infoWindow = new google.maps.InfoWindow();
}

// Theme toggle functionality
const themeToggle = document.getElementById("theme-toggle");
themeToggle.addEventListener("click", function () {
  setTimeout(() => {
    initMap();
  }, 100);
});

function adjustFloatingCardHeight() {
  const floatingCard = document.querySelector('.floating-card');
  const mapHeight = document.getElementById('map').offsetHeight;
  floatingCard.style.height = `${mapHeight * 0.6}px`; // 60% of map height
}

function createAdvancedMarker(latLng, iconUrl, rotation, device) {
  // Ensure latLng is a google.maps.LatLng instance
  if (!(latLng instanceof google.maps.LatLng)) {
    latLng = new google.maps.LatLng(latLng.lat, latLng.lng);
  }

  const markerContent = document.createElement("div");
  markerContent.className = "custom-marker";
  markerContent.style.transform = `rotate(${rotation}deg)`;

  const markerImage = document.createElement("img");
  markerImage.src = iconUrl;
  markerImage.alt = "Vehicle Icon";
  markerImage.style.width = "18px";
  markerImage.style.height = "32px";

  markerContent.appendChild(markerImage);

  const marker = new google.maps.marker.AdvancedMarkerElement({
    position: latLng, // Save as google.maps.LatLng
    map: map,
    title: `IMEI: ${device.imei}`,
    content: markerContent,
  });

  marker.device = device;

  const coords = {
    lat: latLng.lat(),
    lon: latLng.lng(),
  };

  addMarkerClickListener(marker, latLng, device, coords);

  return marker;
}

function updateAdvancedMarker(marker, latLng, iconUrl, rotation) {
  // Ensure latLng is a google.maps.LatLng instance
  if (!(latLng instanceof google.maps.LatLng)) {
    latLng = new google.maps.LatLng(latLng.lat, latLng.lng);
  }

  const markerContent = document.createElement("div");
  markerContent.className = "custom-marker";
  markerContent.style.transform = `rotate(${rotation}deg)`;

  const markerImage = document.createElement("img");
  markerImage.src = iconUrl;
  markerImage.alt = "Vehicle Icon";
  markerImage.style.width = "18px";
  markerImage.style.height = "32px";

  markerContent.appendChild(markerImage);

  marker.position = latLng; // Save as google.maps.LatLng
  marker.content = markerContent;

  const coords = {
    lat: latLng.lat(),
    lon: latLng.lng(),
  };
  addMarkerClickListener(marker, latLng, marker.device, coords);
}

function searchTable() {
  const searchTerm = document.getElementById('table-vehicle-search').value.trim().toLowerCase();
  const tableRows = document.querySelectorAll('#vehicle-table tbody tr');
  
  tableRows.forEach(row => {
    const plateNumber = row.cells[0].textContent.toLowerCase();
    if (plateNumber.includes(searchTerm)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Add this function to handle vehicle search
function searchVehicle() {
  const searchTerm = document.getElementById('vehicle-search').value.trim().toLowerCase();
  if (!searchTerm) return;

  let foundVehicle = null;
  
  // Search through vehicleData
  vehicleData.forEach((vehicle, imei) => {
    const plateNumber = vehicle.LicensePlateNumber ? vehicle.LicensePlateNumber.toLowerCase() : '';
    // Check full number or last 4 digits
    if (plateNumber.includes(searchTerm)) {
      foundVehicle = vehicle;
    }
  });

  if (foundVehicle) {
    // Zoom to the vehicle
    const latLng = new google.maps.LatLng(
      parseFloat(foundVehicle.latitude),
      parseFloat(foundVehicle.longitude)
    );
    map.setZoom(18);
    map.panTo(latLng);
    
    // Highlight the vehicle
    const marker = markers[foundVehicle.imei];
    if (marker) {
      setInfoWindowContent(infoWindow, marker, latLng, foundVehicle, foundVehicle.address || "Location unknown");
      infoWindow.open(map, marker);
    }
    
    // Scroll to the vehicle card
    const vehicleCard = document.querySelector(`.vehicle-card[data-imei="${foundVehicle.imei}"]`);
    if (vehicleCard) {
      vehicleCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      vehicleCard.classList.add('highlight');
      setTimeout(() => vehicleCard.classList.remove('highlight'), 2000);
    }
  } else {
    alert('Vehicle not found');
  }
}

// Add event listeners for search
document.getElementById('search-button').addEventListener('click', searchVehicle);
document.getElementById('vehicle-search').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchVehicle();
  }
});

function panToWithOffset(latLng, offsetX = -50, offsetY = 0) {
  // Get the current map projection
  const scale = Math.pow(2, map.getZoom()); // Scale based on zoom level
  const worldCoordinateCenter = map.getProjection().fromLatLngToPoint(latLng);

  // Apply the offset in pixels
  const pixelOffset = new google.maps.Point(offsetX / scale, offsetY / scale);
  const worldCoordinateNewCenter = new google.maps.Point(
    worldCoordinateCenter.x + pixelOffset.x,
    worldCoordinateCenter.y + pixelOffset.y
  );

  // Convert back to LatLng and pan the map
  const newLatLng = map
    .getProjection()
    .fromPointToLatLng(worldCoordinateNewCenter);
  map.panTo(newLatLng);
}

function addHoverListenersToCardsAndMarkers() {
  // Add hover event to vehicle cards
  const vehicleCards = document.querySelectorAll(".vehicle-card");
  vehicleCards.forEach((card) => {
    card.addEventListener("mouseover", () => {
      const imei = card.getAttribute("data-imei");
      const marker = markers[imei];
      if (marker) {
        // Pan and zoom the map to the marker

        let latLng = new google.maps.LatLng(
          marker.position.lat,
          marker.position.lng
        );

        map.setZoom(20);
        panToWithOffset(latLng, -200, 0);

        // Open the info window for the marker
        const coords = {
          lat: marker.position.lat,
          lon: marker.position.lng,
        };

        const address = marker.device.address || "Location unknown";
        setInfoWindowContent(
          infoWindow,
          marker,
          latLng,
          marker.device,
          address
        );
        infoWindow.open(map, marker);
      }
    });

    card.addEventListener("mouseout", () => {
      infoWindow.close();
    });
  });

  // Add hover event to map markers
  Object.keys(markers).forEach((imei) => {
    const marker = markers[imei];
    if (marker) {
      marker.addEventListener("mouseover", () => {
        const vehicleCard = document.querySelector(
          `.vehicle-card[data-imei="${imei}"]`
        );
        if (vehicleCard) {
          // Scroll the floating card to the corresponding vehicle card
          vehicleCard.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });

          // Highlight the vehicle card
          vehicleCard.classList.add("highlight");

          // Check if dark mode is active
          const isDarkMode = document.body.classList.contains("dark-mode");

          if (isDarkMode) {
            vehicleCard.style.backgroundColor = "#ccc"; // Light background for dark mode
            const vehicleHeader = vehicleCard.querySelector(".vehicle-header");
            if (vehicleHeader) {
              vehicleHeader.style.color = "#000000d0"; // Dark font color for dark mode
            }
            const vehicleInfo = vehicleCard.querySelector(".vehicle-info");
            if (vehicleInfo) {
              vehicleInfo.style.color = "#000000d0"; // Dark font color for dark mode

              const vehicleInfoStrong = vehicleCard.querySelectorAll("strong");
              vehicleInfoStrong.forEach((tag) => {
                tag.style.color = "#000000d0"; // Dark font color for dark mode
              });
              const vehicleInfoA = vehicleCard.querySelector("a");
              if (vehicleInfoA) {
                vehicleInfoA.style.color = "#000000d0"; // Dark font color for dark mode
              }
            }
          } else {
            vehicleCard.style.backgroundColor = "#000000d0"; // Dark background for light mode
            const vehicleHeader = vehicleCard.querySelector(".vehicle-header");
            if (vehicleHeader) {
              vehicleHeader.style.color = "#ccc"; // Light font color for light mode
            }
            const vehicleInfo = vehicleCard.querySelector(".vehicle-info");
            if (vehicleInfo) {
              vehicleInfo.style.color = "#ccc"; // Light font color for light mode

              const vehicleInfoStrong = vehicleCard.querySelectorAll("strong");
              vehicleInfoStrong.forEach((tag) => {
                tag.style.color = "#ccc"; // Light font color for light mode
              });
              const vehicleInfoA = vehicleCard.querySelector("a");
              if (vehicleInfoA) {
                vehicleInfoA.style.color = "#ccc"; // Light font color for light mode
              }
            }
          }
        }
      });

      marker.addEventListener("mouseout", () => {
        const vehicleCard = document.querySelector(
          `.vehicle-card[data-imei="${imei}"]`
        );
        if (vehicleCard) {
          // Remove the highlight from the vehicle card
          vehicleCard.classList.remove("highlight");

          vehicleCard.style.transition =
            "background-color 0.3s ease-in-out, color 0.3s ease-in-out";
          vehicleCard.style.backgroundColor = ""; // Reset background color
          const vehicleHeader = vehicleCard.querySelector(".vehicle-header");
          if (vehicleHeader) {
            vehicleHeader.style.color = ""; // Reset font color
          }
          const vehicleInfo = vehicleCard.querySelector(".vehicle-info");
          if (vehicleInfo) {
            vehicleInfo.style.color = ""; // Reset font color

            const vehicleInfoStrong = vehicleCard.querySelectorAll("strong");
            vehicleInfoStrong.forEach((tag) => {
              tag.style.color = ""; // Reset font color
            });
            const vehicleInfoA = vehicleCard.querySelector("a");
            if (vehicleInfoA) {
              vehicleInfoA.style.color = ""; // Reset font color
            }
          }
        }
      });
    }
  });
}

window.filterVehicles = filterVehicles;

window.onload = async function () {
  document.querySelector(".block-container").style.display = "none";
  await initMap();
  await fetchVehicleData();
  updateMap();

  document.getElementById('table-search-button').addEventListener('click', searchTable);
  document.getElementById('table-vehicle-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchTable();
    }
  });
};
