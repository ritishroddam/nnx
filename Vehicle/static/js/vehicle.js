const socket = io(CONFIG.SOCKET_SERVER_URL);

socket.on("connect", function () {
  console.log("Connected to WebSocket server");
  socket.emit("request_vehicle_data");
});

socket.on("vehicle_update", function (data) {
  console.log("Vehicle update received:", data);
  updateVehicleData(data);
});

socket.on("sos_alert", function (data) {
  console.log("SOS alert received:", data);
  const imei = sanitizeIMEI(data.imei);
  if (markers[imei]) {
    triggerSOS(imei, markers[imei]);
  }
});

function updateVehicleData(vehicle) {
  const imei = sanitizeIMEI(vehicle.imei);
  const coords = parseCoordinates(vehicle.latitude, vehicle.longitude);
  const latLng = new google.maps.LatLng(
    coords.lat.toFixed(6),
    coords.lon.toFixed(6)
  );
  const iconUrl = getCarIconBySpeed(
    vehicle.speed,
    imei,
    vehicle.date,
    vehicle.time
  );
  const rotation = vehicle.course;

  if (markers[imei]) {
    animateMarker(markers[imei], latLng);
    updateCustomMarker(markers[imei], latLng, iconUrl, rotation);
    markers[imei].device = vehicle;
    updateInfoWindow(markers[imei], latLng, vehicle, coords);
  } else {
    markers[imei] = createCustomMarker(latLng, iconUrl, rotation, vehicle);
    addMarkerClickListener(markers[imei], latLng, vehicle, coords);
  }

  if (vehicle.sos === "1") {
    triggerSOS(imei, markers[imei]);
  } else {
    removeSOS(imei);
  }

  lastDataReceivedTime[imei] = new Date();
  renderVehicles(Object.values(markers).map((marker) => marker.device));
}

function fetchVehicleData() {
  fetch("/vehicle/api/vehicles")
    .then((response) => response.json())
    .then((data) => {
      renderVehicles(data);
      showHidecar();
    })
    .catch((error) => {
      console.error("Error fetching vehicle data:", error);
    });
}

function renderVehicles(vehicles) {
  const listContainer = document.getElementById("vehicle-list");
  const countContainer = document.getElementById("vehicle-count");
  listContainer.innerHTML = "";
  countContainer.innerText = vehicles.length;

  vehicles.forEach((vehicle) => {
    const imei = sanitizeIMEI(vehicle.imei);

    const vehicleElement = document.createElement("div");
    vehicleElement.classList.add("vehicle-card");
    vehicleElement.setAttribute("data-imei", vehicle.imei);

    const latitude = vehicle.latitude ? parseFloat(vehicle.latitude) : null;
    const longitude = vehicle.longitude ? parseFloat(vehicle.longitude) : null;

    const { formattedDate, formattedTime } = formatDateTime(
      vehicle.date,
      vehicle.time
    );

    vehicleElement.innerHTML = `
      <div class="vehicle-header">${vehicle.imei} - ${
      vehicle.status || "Unknown"
    }</div>
      <div class="vehicle-info">
        <strong>Speed:</strong> ${
          vehicle.speed
            ? convertSpeedToKmh(vehicle.speed).toFixed(2) + " km/h"
            : "Unknown"
        } <br>
        <strong>Lat:</strong> ${latitude} <br>
        <strong>Lon:</strong> ${longitude} <br>
        <strong>Last Update:</strong> ${formattedTime || "N/A"} ${
      formattedDate || "N/A"
    } <br>
        <strong>Location:</strong> ${vehicle.address || "Location unknown"} <br>
        <strong>Data:</strong> <a href="device-details.html?imei=${
          vehicle.imei
        }" target="_blank">View Data</a>
      </div>
    `;

    // Add hover event listener to zoom in on the map and show the info window
    vehicleElement.addEventListener("mouseover", () => {
      const marker = markers[imei];
      if (marker) {
        map.setZoom(20);
        map.panTo(marker.latLng);
        updateInfoWindow(marker, marker.latLng, marker.device, {
          lat: marker.latLng.lat(),
          lon: marker.latLng.lng(),
        });
      }
    });

    listContainer.appendChild(vehicleElement);
  });

  filterVehicles();
  showHidecar();
}

function updateInfoWindow(marker, latLng, device, coords) {
  geocodeLatLng(latLng, function (address) {
    if (openMarker === marker && !manualClose) {
      const { formattedDate, formattedTime } = formatDateTime(
        device.date,
        device.time
      );
      const content = `<div class="info-window show">
                    <strong>IMEI:</strong> ${device.imei}<br>
                    <hr>
                    <p><strong>Speed:</strong> ${convertSpeedToKmh(
                      device.speed
                    ).toFixed(2)} km/h</p>
                    <p><strong>Lat:</strong> ${coords.lat.toFixed(6)}</p>
                    <p><strong>Lon:</strong> ${coords.lon.toFixed(6)}</p>
                    <p><strong>Last Update:</strong> ${formattedDate} ${formattedTime}</p> 
                    <p class="address"><strong>Location:</strong> ${address}</p>
                    <p><strong>Data:</strong> <a href="device-details.html?imei=${
                      device.imei
                    }" target="_blank">View Data</a></p>
                </div>`;
      infoWindow.setContent(content);
      infoWindow.setPosition(latLng);
      infoWindow.open(map, marker);
      openMarker = marker;
      manualClose = false;
    }
  });
}

// document.querySelector(".toggle-slider").addEventListener("click", function () {
//   this.classList.toggle("active");
// });

// Car appears on the map

var map;
var markers = {};
var geocoder;
var addressCache = {};
var lastZeroSpeedTime = {};
var refreshInterval = 5000; // 1min for page reload
var infoWindow;
var countdownTimer = refreshInterval / 1000;
var openMarker = null;
var firstFit = true;
var manualClose = false;
var dataAvailable = true;
var sosActiveMarkers = {};
var lastDataReceivedTime = {};

// Restore markers from session storage if available
function restoreMarkers() {
  const storedMarkers = sessionStorage.getItem("vehicleMarkers");
  if (storedMarkers) {
    const markerData = JSON.parse(storedMarkers);
    markerData.forEach((device) => {
      const latLng = new google.maps.LatLng(device.lat, device.lon);
      const imei = device.imei;
      const iconUrl = device.iconUrl;
      const rotation = device.rotation;
      markers[imei] = createCustomMarker(latLng, iconUrl, rotation);
      addMarkerClickListener(markers[imei], latLng, device);
    });
  }
}

function initMap() {
  const defaultCenter = { lat: 20.5937, lng: 78.9629 };
  const offset = -5;

  const newCenter = {
    lat: defaultCenter.lat,
    lng: defaultCenter.lng + offset,
  };

  // Dark Mode Styles
  const darkModeStyle = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#373737" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#0e1626" }],
    },
    {
      featureType: "landscape",
      elementType: "geometry",
      stylers: [{ color: "#2c2c2c" }],
    },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  ];

  const lightModeStyle = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    {
      featureType: "administrative.land_parcel",
      elementType: "labels.text.fill",
      stylers: [{ color: "#bdbdbd" }],
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#eeeeee" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#757575" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#defff0" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9e9e9e" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#ffffff" }],
    },
    {
      featureType: "road.arterial",
      elementType: "labels.text.fill",
      stylers: [{ color: "#757575" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#dadada" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#616161" }],
    },
    {
      featureType: "road.local",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9e9e9e" }],
    },
    {
      featureType: "transit.line",
      elementType: "geometry",
      stylers: [{ color: "#e5e5e5" }],
    },
    {
      featureType: "transit.station",
      elementType: "geometry",
      stylers: [{ color: "#eeeeee" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#def2ff" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9e9e9e" }],
    },
  ];

  // Initialize Map
  map = new google.maps.Map(document.getElementById("map"), {
    center: newCenter,
    zoom: 5,
    gestureHandling: "greedy",
    zoomControl: true,
    mapTypeControl: false, // Disable default map type buttons
    clickableIcons: false, // Disable POI icons
    styles: lightModeStyle, // Default to dark mode
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM,
    },
  });

  geocoder = new google.maps.Geocoder();
  infoWindow = new google.maps.InfoWindow();

  google.maps.event.addListener(infoWindow, "closeclick", function () {
    const infoWindowDiv = document.querySelector(".info-window");

    if (infoWindowDiv) {
      infoWindowDiv.classList.remove("show");
      infoWindowDiv.classList.add("hide");

      setTimeout(function () {
        infoWindow.close();
      }, 300);
    }

    manualClose = true;
    openMarker = null;
  });

  restoreMarkers();
  fetchVehicleData();

  // setupWebSocket();

  // Add Toggle Button
  const toggleButton = document.createElement("button");
  toggleButton.textContent = "Switch to Dark Map";
  toggleButton.style.position = "absolute";
  toggleButton.style.bottom = "20px";
  toggleButton.style.right = "20px";
  toggleButton.style.zIndex = "1000";
  toggleButton.style.padding = "10px 15px";
  toggleButton.style.background = "#fff";
  toggleButton.style.border = "1px solid #ccc";
  toggleButton.style.borderRadius = "5px";
  toggleButton.style.cursor = "pointer";
  toggleButton.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.3)";
  toggleButton.style.fontSize = "14px";
  toggleButton.style.fontWeight = "bold";
  toggleButton.style.color = "#333";

  document.getElementById("map").appendChild(toggleButton);

  // Set initial mode to dark mode
  let darkMode = true;

  toggleButton.addEventListener("click", function () {
    if (darkMode) {
      map.setOptions({ styles: darkModeStyle });
      toggleButton.textContent = "Switch to Standard Map";
      document.body.classList.add("dark-mode");
    } else {
      map.setOptions({ styles: lightModeStyle });
      toggleButton.textContent = "Switch to Dark Map";
      document.body.classList.remove("dark-mode");
    }
    darkMode = !darkMode; // Toggle the state
  });

  setInterval(function () {
    if (countdownTimer > 0) {
      countdownTimer--;
      // document.getElementById("countdown").innerText = "Refresh in: " + countdownTimer + "s";
    } else {
      updateMap();
      if (document.getElementById("toggle-card-switch").checked === true) {
        fetchVehicleData();
      }
      countdownTimer = refreshInterval / 1000; // Reset countdown
    }
  }, 1000);
}

function parseCoordinates(lat, lon) {
  const parsedLat = parseFloat(lat.slice(0, 2)) + parseFloat(lat.slice(2)) / 60;
  const parsedLon = parseFloat(lon.slice(0, 3)) + parseFloat(lon.slice(3)) / 60;

  if (isNaN(parsedLat) || isNaN(parsedLon)) {
    console.error("Invalid coordinates:", lat, lon);
    return { lat: 0, lon: 0 };
  }

  return { lat: parsedLat, lon: parsedLon };
}

function convertSpeedToKmh(speedMph) {
  return speedMph * 1.60934; // Convert mph to km/h
}

function getCarIconUrlBySpeed(speedInKmh) {
  if (speedInKmh === 0) {
    return "/vehicle/static/images/car_yellow.png";
  } else if (speedInKmh > 0 && speedInKmh <= 40) {
    return "/vehicle/static/images/car_green.png";
  } else if (speedInKmh > 40 && speedInKmh <= 60) {
    return "/vehicle/static/images/car_blue.png";
  } else {
    return "/vehicle/static/images/car_red.png";
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
    iconUrl = "/vehicle/static/images/car_black.png";
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

function animateMarker(marker, newPosition, duration = 6000) {
  const startPosition = marker.latLng;
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

    marker.latLng = new google.maps.LatLng(lat, lng);
    marker.draw();

    if (progress < 1) {
      requestAnimationFrame(moveMarker);
    }
  }

  requestAnimationFrame(moveMarker);
}

function sanitizeIMEI(imei) {
  return imei.replace(/[^\w]/g, "").trim(); // Removes all non-alphanumeric characters
}

function updateMap() {
  fetch("/vehicle/api/vehicles")
    .then((response) => response.json())
    .then((data) => {
      var bounds = new google.maps.LatLngBounds();
      dataAvailable = true;
      countdownTimer = refreshInterval / 1000;

      const countContainer = document.getElementById("countee");
      countContainer.innerText = data.length;

      data.forEach((device) => {
        const imei = sanitizeIMEI(device.imei);

        if (
          device.latitude &&
          device.longitude &&
          device.speed != null &&
          device.course != null
        ) {
          const coords = parseCoordinates(device.latitude, device.longitude);
          const latLng = new google.maps.LatLng(coords.lat, coords.lon);
          const iconUrl = getCarIconBySpeed(
            device.speed,
            imei,
            device.date,
            device.time
          );
          const rotation = device.course;

          if (markers[imei]) {
            animateMarker(markers[imei], latLng);
            updateCustomMarker(markers[imei], latLng, iconUrl, rotation);
            markers[imei].device = device;
            updateInfoWindow(markers[imei], latLng, device, coords);
          } else {
            markers[imei] = createCustomMarker(
              latLng,
              iconUrl,
              rotation,
              device
            );
            addMarkerClickListener(markers[imei], latLng, device, coords);
          }

          if (device.sos === "1") {
            triggerSOS(imei, markers[imei]);
          } else {
            removeSOS(imei);
          }

          lastDataReceivedTime[imei] = new Date(
            `${device.date}T${device.time}`
          );
          bounds.extend(latLng);
        }

        checkForDataTimeout(imei);
      });

      if (!bounds.isEmpty() && firstFit) {
        map.fitBounds(bounds);
        firstFit = false;
      }

      filterVehicles();
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
      dataAvailable = false;
    });
}

function removeSOS(imei) {
  if (sosActiveMarkers[imei]) {
    sosActiveMarkers[imei].remove();
    delete sosActiveMarkers[imei];
  }
  // Remove the blinking effect from the vehicle icon
  if (markers[imei]) {
    markers[imei].div.classList.remove("vehicle-blink");
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

function addMarkerClickListener(marker, latLng, device, coords) {
  geocodeLatLng(latLng, function (address) {
    marker.div.addEventListener("click", function () {
      if (openMarker !== marker) {
        const imei = device.imei
          ? device.imei
          : '<span class="missing-data">N/A</span>';
        const speed =
          device.speed !== null && device.speed !== undefined
            ? `${convertSpeedToKmh(device.speed).toFixed(2)} km/h`
            : '<span class="missing-data">Unknown</span>';
        const lat =
          coords.lat !== null && coords.lat !== undefined
            ? coords.lat.toFixed(6)
            : '<span class="missing-data">Unknown</span>';
        const lon =
          coords.lon !== null && coords.lon !== undefined
            ? coords.lon.toFixed(6)
            : '<span class="missing-data">Unknown</span>';
        const date = device.date || "N/A";
        const time = device.time || "N/A";
        const addressText = address
          ? address
          : '<span class="missing-data">Location unknown</span>';

        const { formattedDate, formattedTime } = formatDateTime(date, time);
        const content = `<div class="info-window show">
                      <strong>IMEI:</strong> ${imei}<br>
                      <hr>
                      <p><strong>Speed:</strong> ${speed}</p>
                      <p><strong>Lat:</strong> ${lat}</p>
                      <p><strong>Lon:</strong> ${lon}</p>
                      <p><strong>Last Update:</strong> ${formattedDate} ${formattedTime}</p> 
                      <p class="address"><strong>Location:</strong> ${addressText}</p>
                      <p><strong>Data:</strong> <a href="device-details.html?imei=${
                        device.imei || "N/A"
                      }" target="_blank">View Data</a></p>
                  </div>`;

        if (openMarker !== marker) {
          infoWindow.setContent(content);
          infoWindow.setPosition(latLng);

          const infoWindowDiv = document.querySelector(".info-window");

          if (infoWindowDiv) {
            infoWindowDiv.classList.remove("hide");
            infoWindowDiv.classList.add("show");
          }

          infoWindow.open(map, marker);
          openMarker = marker;
          manualClose = false;
        }
      }
    });
  });
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
    marker.setVisible(isVisible);

    if (isVisible) {
      filteredVehicles.push(marker.device);
    }
  });
  updateFloatingCard(filteredVehicles, filterValue);
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

      const { formattedDate, formattedTime } = formatDateTime(
        vehicle.date,
        vehicle.time
      );

      vehicleElement.innerHTML = `
        <div class="vehicle-header">${vehicle.imei} - ${
        vehicle.status || "Unknown"
      }</div>
        <div class="vehicle-info">
          <strong>Speed:</strong> ${
            vehicle.speed
              ? convertSpeedToKmh(vehicle.speed).toFixed(2) + " km/h"
              : "Unknown"
          } <br>
          <strong>Lat:</strong> ${latitude} <br>
          <strong>Lon:</strong> ${longitude} <br>
          <strong>Last Update:</strong> ${formattedTime || "N/A"} ${
        formattedDate || "N/A"
      } <br>
          <strong>Location:</strong> ${
            vehicle.address || "Location unknown"
          } <br>
          <strong>Data:</strong> <a href="device-details.html?imei=${
            vehicle.imei
          }" target="_blank">View Data</a>
        </div>`;

      vehicleElement.addEventListener("mouseover", () => {
        const marker = markers[vehicle.imei];
        if (marker) {
          map.setZoom(20);
          map.panTo(marker.latLng);
          updateInfoWindow(marker, marker.latLng, marker.device, {
            lat: marker.latLng.lat(),
            lon: marker.latLng.lng(),
          });
        }
      });

      vehicleList.appendChild(vehicleElement);
    });
  }
}

function createCustomMarker(latLng, iconUrl, rotation, device) {
  const div = document.createElement("div");
  div.className = "custom-marker";
  div.style.backgroundImage = `url(${iconUrl})`;
  div.style.transform = `rotate(${rotation}deg)`;

  const marker = new google.maps.OverlayView();
  marker.div = div;
  marker.latLng = latLng;
  marker.device = device;

  marker.onAdd = function () {
    const panes = this.getPanes();
    panes.overlayMouseTarget.appendChild(div);
  };

  marker.draw = function () {
    const point = this.getProjection().fromLatLngToDivPixel(this.latLng);
    if (point) {
      div.style.left = point.x - div.offsetWidth / 2 + "px";
      div.style.top = point.y - div.offsetHeight / 2 + "px";
    }
  };

  marker.onRemove = function () {
    div.parentNode.removeChild(div);
  };

  marker.setVisible = function (visible) {
    div.style.display = visible ? "block" : "none";
  };

  marker.setMap(map);

  div.addEventListener("mouseover", () => {
    const vehicleElement = document.querySelector(
      `.vehicle-card[data-imei="${device.imei}"]`
    );
    if (vehicleElement) {
      vehicleElement.scrollIntoView({ behavior: "smooth", block: "center" });

      // Check if dark mode is active
      const isDarkMode = document.body.classList.contains("dark-mode");

      if (isDarkMode) {
        vehicleElement.style.backgroundColor = "#ccc"; // Dark background for dark mode
        const vehicleHeader = vehicleElement.querySelector(".vehicle-header");
        if (vehicleHeader) {
          vehicleHeader.style.color = "#000000d0"; // Light font color for dark mode
        }
        const vehicleInfo = vehicleElement.querySelector(".vehicle-info");
        if (vehicleInfo) {
          vehicleInfo.style.color = "#000000d0"; // Light font color for dark mode

          const vehicleInfoStrong = vehicleElement.querySelectorAll("strong");
          vehicleInfoStrong.forEach((tag) => {
            tag.style.color = "#000000d0"; // Light font color for dark mode
          });
          const vehicleInfoA = vehicleElement.querySelector("a");
          if (vehicleInfoA) {
            vehicleInfoA.style.color = "#000000d0"; // Light font color for dark mode
          }
        }
      } else {
        vehicleElement.style.backgroundColor = "#000000d0"; // Dark background for light mode
        const vehicleHeader = vehicleElement.querySelector(".vehicle-header");
        if (vehicleHeader) {
          vehicleHeader.style.color = "#ccc"; // Light font color for light mode
        }
        const vehicleInfo = vehicleElement.querySelector(".vehicle-info");
        if (vehicleInfo) {
          vehicleInfo.style.color = "#ccc"; // Light font color for light mode

          const vehicleInfoStrong = vehicleElement.querySelectorAll("strong");
          vehicleInfoStrong.forEach((tag) => {
            tag.style.color = "#ccc"; // Light font color for dark mode
          });
          const vehicleInfoA = vehicleElement.querySelector("a");
          if (vehicleInfoA) {
            vehicleInfoA.style.color = "#ccc"; // Light font color for dark mode
          }
        }
      }
    }
  });

  div.addEventListener("mouseout", () => {
    const vehicleElement = document.querySelector(
      `.vehicle-card[data-imei="${device.imei}"]`
    );
    if (vehicleElement) {
      vehicleElement.style.transition =
        "background-color 0.3s ease-in-out, color 0.3s ease-in-out";
      vehicleElement.style.backgroundColor = ""; // Reset background color
      const vehicleHeader = vehicleElement.querySelector(".vehicle-header");
      if (vehicleHeader) {
        vehicleHeader.style.color = ""; // Reset font color
      }
      const vehicleInfo = vehicleElement.querySelector(".vehicle-info");
      if (vehicleInfo) {
        vehicleInfo.style.color = ""; // Reset font color

        const vehicleInfoStrong = vehicleElement.querySelectorAll("strong");
        vehicleInfoStrong.forEach((tag) => {
          tag.style.color = ""; // Light font color for dark mode
        });
        const vehicleInfoA = vehicleElement.querySelector("a");
        if (vehicleInfoA) {
          vehicleInfoA.style.color = ""; // Light font color for dark mode
        }
      }
    }
  });

  addMarkerClickListener(marker, latLng, device, {});
  return marker;
}

//////////////////////
function updateCustomMarker(marker, latLng, iconUrl, rotation) {
  marker.latLng = latLng;
  marker.div.style.backgroundImage = `url(${iconUrl})`;
  marker.div.style.transform = `rotate(${rotation}deg)`;
  marker.draw();

  addMarkerClickListener(marker, latLng, {}, {});
}

//////////////////////
function geocodeLatLng(latLng, callback) {
  const lat = latLng.lat().toFixed(6);
  const lon = latLng.lng().toFixed(6);
  const key = `${lat},${lon}`;

  if (addressCache[key]) {
    callback(addressCache[key]);
  } else {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=AIzaSyCPEMAElTxMzur0DK-Mh3fPUVmdQVBJu8A`;

    fetch(geocodeUrl)
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "OK" && data.results[0]) {
          const address = data.results[0].formatted_address;
          addressCache[key] = address;
          callback(address);
        } else {
          callback("No address found");
        }
      })
      .catch((error) => {
        console.error("Error fetching geocode data:", error);
        callback("Error fetching address");
      });
  }
}

// let toggleVIew = false;
// function toggleView() {
//   if (toggleVIew) {
//     showMapView();
//     toggleVIew = !toggleVIew;
//   } else {
//     showListView();
//     toggleVIew = !toggleVIew;
//   }
// }

document.querySelector(".toggle-slider").addEventListener("click", function () {
  this.classList.toggle("active");

  if (this.classList.contains("active")) {
    // Call function when the element is active
    showMapView();
  } else {
    // Call function when the element is not active
    showListView();
  }
});

function showMapView() {
  document.getElementById("map").style.display = "block";
  document.getElementById("vehicle-table-container").style.display = "none";
}

function showListView() {
  document.getElementById("map").style.display = "none";
  document.getElementById("vehicle-table-container").style.display = "block";
  populateVehicleTable();
}

function populateVehicleTable() {
  const tableBody = document
    .getElementById("vehicle-table")
    .getElementsByTagName("tbody")[0];
  tableBody.innerHTML = ""; // Clear existing rows

  Object.keys(markers).forEach((imei) => {
    const marker = markers[imei];
    const device = marker.device;
    const coords = marker.latLng;

    const speed =
      device.speed !== null && device.speed !== undefined
        ? `${convertSpeedToKmh(device.speed).toFixed(2)} km/h`
        : "Unknown";
    const latitude =
      coords.lat !== null && coords.lat !== undefined
        ? coords.lat.toFixed(6)
        : "Unknown";
    const longitude =
      coords.lon !== null && coords.lon !== undefined
        ? coords.lon.toFixed(6)
        : "Unknown";
    const date = device.date || "N/A";
    const time = device.time || "N/A";
    const address = device.address || "Location unknown";
    const { formattedDate, formattedTime } = formatDateTime(date, time);

    const row = tableBody.insertRow();
    row.insertCell(0).innerText = device.imei;
    row.insertCell(1).innerText = speed;
    row.insertCell(2).innerText = latitude.toFixed(6);
    row.insertCell(3).innerText = longitude.toFixed(6);
    row.insertCell(4).innerText = `${formattedDate} ${formattedTime}`;
    row.insertCell(5).innerText = address;
    row.insertCell(
      6
    ).innerHTML = `<a href="device-details.html?imei=${device.imei}" target="_blank">View Data</a>`;
  });
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
    console.log(document.getElementById("toggle-card-switch").checked);
  } else {
    hideCard();
    console.log(document.getElementById("toggle-card-switch").checked);
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

window.onload = function () {
  initMap();
  fetchVehicleData();
};
