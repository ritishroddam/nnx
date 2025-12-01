function hideSkeletonLoader() {
  const loader = document.getElementById("skeleton-loader");
  if (loader) loader.style.display = "none";
}

function showSkeletonLoader() {
  const vehicleList = document.getElementById("vehicle-list");
  if (!vehicleList) return;

  let skeletonHTML = "";
  for (let i = 0; i < 5; i++) {
    skeletonHTML += `
      <div class="vehicle-card skeleton-card">
        <div class="vehicle-card-row" style="display:flex;align-items:center;gap:8px;">
          <div class="skeleton skeleton-circle"></div>
          <div class="skeleton skeleton-text" style="width:120px;"></div>
          <div style="flex:1;"></div>
          <div class="skeleton skeleton-icon"></div>
          <div class="skeleton skeleton-icon"></div>
          <div class="skeleton skeleton-icon"></div>
          <div class="skeleton-vertical-divider"></div> 
        </div>
        <div class="divider" style="height:1px;background:#eee;margin:8px 0;"></div>
        <div class="vehicle-card-row" style="display:flex;align-items:center;gap:6px;">
          <div class="skeleton skeleton-bold" style="width:70px;height:14px;"></div>
          <div class="skeleton skeleton-line" style="width:80px;height:14px;"></div>
        </div>
        <div class="vehicle-card-row">
          <div class="skeleton skeleton-status" style="width:220px;height:18px;margin-bottom:4px;"></div>
        </div>
        <div class="vehicle-card-row">
          <div class="skeleton skeleton-location" style="width:90%;height:12px;margin-bottom:8px;"></div>
        </div>
        <div class="vehicle-card-row" style="margin-top:10px;display:flex;justify-content:space-between;">
          <div>
            <div class="skeleton skeleton-box" style="width:60px;height:13px;margin-bottom:4px;"></div>
            <div class="skeleton skeleton-box" style="width:40px;height:18px;"></div>
          </div>
          <div>
            <div class="skeleton skeleton-box" style="width:60px;height:13px;margin-bottom:4px;"></div>
            <div class="skeleton skeleton-box" style="width:40px;height:18px;"></div>
          </div>
        </div>
      </div>
    `;
  }

  vehicleList.innerHTML = `<div id="skeleton-loader">${skeletonHTML}</div>`;
}


const sidebar = document.querySelector('.sidebar');
const floatingCard = document.querySelector('.floating-card');
const vehicleList = document.getElementById('vehicle-table-container');

sidebar.addEventListener('mouseenter', () => {
  floatingCard.classList.add('sidebar-hovered');
    vehicleList.classList.add('sidebar-hovered');
});
sidebar.addEventListener('mouseleave', () => {
  floatingCard.classList.remove('sidebar-hovered');
  vehicleList.classList.remove('sidebar-hovered');
});

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
var geofenceToggle = false;
var geofencePolygons = {};
var geofenceButton = null;
var selectToggleButton = null;
var selectMode = false;
let currentPage = 1;
const perPage = 100;
let totalPages = 1;
let totalVehicles = 0;
let selectedVehicles = new Set();
let currentFilterValue = "all";
let lastSecondRender = 0;
let lastMinuteRender = 0;
let lastHourRender = 0;
let totalVehicleCardCount = 0;

document.addEventListener("DOMContentLoaded", async function () {
  let companyNames = null;

  if (companyName != "None") {
    companyNames = companyName;
  }

  socket.emit("authenticate", {
    user_id: userID,
    company: companyNames,
    userRole: userRole,
    userName: userName,
  });
  
  geofenceButton = document.getElementById('geofence-toggle');
  if (geofenceButton) {
    geofenceButton.addEventListener('click', toggleGeofences);
  }
  
  // Select toggle (enable selecting rows for multi-share)
  selectToggleButton = document.getElementById('select-toggle');
  if (selectToggleButton) {
    selectToggleButton.addEventListener('click', function () {
      selectMode = !selectMode;
      selectToggleButton.classList.toggle('active', selectMode);
      if (selectMode) {
        selectToggleButton.title = 'Selection mode enabled: click rows to select vehicles';
      } else {
        selectToggleButton.title = 'Enable selection mode for multi-share';
        // clear current selection when disabling selection mode
        selectedVehicles.clear();
        document.querySelectorAll('#vehicle-table tbody tr.selected').forEach(row => row.classList.remove('selected'));
        updateMultiShareButton();
      }
    });
  }

  const speedFilter = document.getElementById("speed-filter");
  if (speedFilter) {
    speedFilter.addEventListener("change", (event) => {
      currentFilterValue = event.target.value || "all";
      applyFilterToAllVehicles();
    });
  }
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

// socket.on("vehicle_update", async function (data) {
//   try {
//     const updatedData = await updateData(data);
//     updateVehicleData(updatedData);

//     const lastUpdated = convertToDate(data.date, data.time);
//     const now = new Date();
//     const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);

//     if((data.sos === "1" || data.sos === 1) && (data.sos != oldDataMain[imei])) {
//       triggerSOS(data.imei, markers[data.imei]);
//     } else if (data.sos === "1") {
//       console.log(`Old SOS alert ignored for ${data.imei}`);
//     }

//     updateVehicleCard(updatedData);
//   } catch (error) {
//     console.error("Error in vehicle_update handler:", error);
//   }
// });

socket.on("vehicle_update", async function (data) {
  try {
    const oldData = vehicleData.get(data.imei);
    const updatedData = await updateData(data);
    updateVehicleData(updatedData);

    const lastUpdated = convertToDate(data.date, data.time);
    const now = new Date();
    const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);

    // Fix SOS detection - check if SOS state changed to active
    if ((data.sos === "1" || data.sos === 1) && 
        (!oldData || oldData.sos !== "1")) {
      console.log(`SOS triggered for ${data.imei}`);
      triggerSOS(data.imei, markers[data.imei]);
    } 
    // If SOS was active but now is not, remove it
    else if (oldData && oldData.sos === "1" && 
             (data.sos === "0" || data.sos === 0)) {
      removeSOS(data.imei);
    }

    updateVehicleCard(updatedData);
  } catch (error) {
    console.error("Error in vehicle_update handler:", error);
  }
});

function formatTimeDelta(timeDelta){
  const seconds = parseInt(timeDelta / 1000);

  if(seconds >= 86400){
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days} days ${hours} hours`;
  } else if(seconds >= 3600){
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} hours ${minutes} minutes`;
  } else if(seconds >= 60){
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} minutes ${remainingSeconds} seconds`;
  }
  return `${seconds} seconds`;
}

function shouldDisplayVehicle(device, now = new Date()) {
  const speedKmh = device.speed ? convertSpeedToKmh(device.speed) : 0;
  const hasSOS = device.sos === "1";
  const lastUpdate = convertToDate(device.date, device.time);
  const hoursSinceLastUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  const slowSpeedThreshold = device.slowSpeed;
  const normalSpeedThreshold = device.normalSpeed;

  switch (currentFilterValue) {
    case "0":
      return speedKmh === 0 && hoursSinceLastUpdate < 24;
    case "0-40":
      return (
        speedKmh > 0 &&
        speedKmh <= slowSpeedThreshold &&
        hoursSinceLastUpdate < 24
      );
    case "40-60":
      return (
        speedKmh > slowSpeedThreshold &&
        speedKmh <= normalSpeedThreshold &&
        hoursSinceLastUpdate < 24
      );
    case "60+":
      return speedKmh > normalSpeedThreshold && hoursSinceLastUpdate < 24;
    case "sos":
      return hasSOS && hoursSinceLastUpdate < 24;
    case "offline":
      return hoursSinceLastUpdate > 24;
    default:
      return true;
  }
}

function updateVehicleVisibility(imei, now = new Date()) {
  const marker = markers[imei];
  if (!marker) return;

  const visible = shouldDisplayVehicle(marker.device, now);
  marker.map = visible ? map : null;

  const card = document.querySelector(`.vehicle-card[data-imei="${imei}"]`);
  if (card) {
    card.style.display = visible ? "" : "none";
  }
}

function setVehicleCardCount(count) {
  totalVehicleCardCount = count;
  updateVehicleCounterDisplay();
}

function incrementVehicleCardCount() {
  setVehicleCardCount(totalVehicleCardCount + 1);
}

function resetVehicleCardCount() {
  setVehicleCardCount(0);
}

function updateVehicleCounterDisplay() {
  const vehicleCounter = document.getElementById("vehicle-counter");
  if (!vehicleCounter) return;
  const headingText = getHeadingText(currentFilterValue);
  vehicleCounter.innerHTML = `${headingText}: <span id="vehicle-count">${totalVehicleCardCount}</span>`;
}

function applyFilterToAllVehicles() {
  const now = new Date();
  vehicleData.forEach((_, imei) => updateVehicleVisibility(imei, now));
  updateVehicleCounterDisplay();
}

async function updateData(data) {
  const oldData = vehicleData.get(data.imei);
  data["ignition"] = String(data.ignition);
  if (oldData) {
    if (oldData.VehicleType) {
      data["VehicleType"] = oldData.VehicleType;
    }

    let distance = parseFloat(data.odometer) - parseFloat(oldData.odometer);
    distance = (parseFloat(distance) + parseFloat(oldData.distance)).toFixed(2);
    data["stoppage_time"] = oldData.stoppage_time;
    data["stoppage_time_delta"] = oldData.stoppage_time_delta;

    data["distance"] = String(distance);
    data["gsm"] = String(data.gsm_sig);

    const lastUpdated = convertToDate(data.date, data.time);
    const now = new Date();
    const timeDiff = Math.abs(now - lastUpdated);
    let statusText;
    let speed = parseFloat(data.speed) || 0;
    data.lastUpdatedDate = lastUpdated;

    if (timeDiff > 24 * 60 * 60 * 1000) {
      statusText = "offline";
    }
    else{
      if (data.ignition === "0") {
        statusText = "stopped";
      } else if (data.ignition === "1" && speed === 0) {
        statusText = "idle";
      }
      else if(data.ignition === "1" && speed > 0){
        statusText = "moving";
      }else{
        statusText = "unknown";
      }
    }

    if (statusText === oldData.status){
      const newTime = convertToDate(data.date, data.time) - convertToDate(oldData.date, oldData.time);
      data["status_time_delta"] = oldData.status_time_delta + newTime;
      data["status_time_str"] =  formatTimeDelta(data["status_time_delta"]);
      data["status"] = statusText;
    } else {
      data["status_time_delta"] = 0;
      data["status_time_str"] = "0 seconds";
      data["status"] = statusText;
    }

    vehicleData.set(data.imei, data);
  } else {
    if (!data.VehicleType) {
      data["VehicleType"] = 'car';
    }

    const lastUpdated = convertToDate(data.date, data.time);
    data["stoppage_time"] = "0 seconds";
    data["stoppage_time_delta"] = 0;
    const now = new Date();
    const timeDiff = Math.abs(now - lastUpdated);
    data.lastUpdatedDate = lastUpdated;

    let statusText = data.status;
    let speed = parseFloat(data.speed) || 0;

    if (timeDiff > 24 * 60 * 60 * 1000) {
      statusText = "offline";
    }
    else{
      if (data.ignition === "0") {
        statusText = "stopped";
      } else if (data.ignition === "1" && speed === 0) {
        statusText = "idle";
      }
      else if(data.ignition === "1" && speed > 0){
        statusText = "moving";
      }else{
        statusText = "unknown";
      }
    }

    data["distance"] = "0.00";
    data["gsm"] = String(data.gsm_sig);
    data["status"] = statusText;
    data["status_time_delta"] = 0;
    data["status_time_str"] = "0 seconds";

    if(data.imei === "863221044380259")
    {
      console.log("New vehicle data received:", data);
      console.log("Last updated:", lastUpdated);
      console.log();
    }
    vehicleData.set(data.imei, data);
  }
  
  return data;
}

async function fetchVehicleData(page = 1) {
  try {
    showSkeletonLoader(); 
    
    const response = await fetch(`/vehicle/api/vehicles`);
    if (!response.ok) throw new Error("Failed to fetch vehicle data");

    const data = await response.json();
    
    const vehicles = data.vehicles || [];
    
    currentPage = 1;
    totalPages = 1;
    totalVehicles = vehicles.length;
    
    const now = new Date();

    vehicleData.clear();

    vehicles.forEach((vehicle) => {
      const lastUpdated = convertToDate(vehicle.date, vehicle.time);
      const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);

      if (vehicle.sos === "1" && hoursSinceUpdate > 1) {
        vehicle.sos = "0"; 
      }

      if (!vehicle.VehicleType) {
        vehicle.VehicleType = 'car';
      }

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
        stoppage_time: vehicle.stoppage_time,
        stoppage_time_delta: vehicle.stoppage_time_delta,
        status_time_delta: vehicle.status_time_delta,
        status_time_str: vehicle.status_time_str,
        normalSpeed: vehicle.normalSpeed,
        slowSpeed: vehicle.slowSpeed,
        lastUpdatedDate: lastUpdated,
      });
    });

    return vehicles;
  } catch (error) {
    console.error("Error fetching vehicle data:", error);
    return [];
  }
}

function addPaginationControls() {
  const existingPagination = document.getElementById("table-pagination");
  if (existingPagination) existingPagination.remove();
}

function updatePaginationControls() {
  const existingPagination = document.getElementById("table-pagination");
  if (existingPagination) existingPagination.remove();
}

function buildVehicleCardTemplate(vehicle, isDarkMode) {
  const lastUpdated = convertToDate(vehicle.date, vehicle.time);
  const now = new Date();
  const isToday = lastUpdated.toDateString() === now.toDateString();
  const timeDiff = Math.abs(now - lastUpdated);
  const secondsDiff = Math.floor(timeDiff / 1000);
  const minutesDiff = Math.floor(timeDiff / (1000 * 60));
  const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
  const speed = vehicle.speed ? convertSpeedToKmh(vehicle.speed) : 0;

  let statusText = vehicle.status;
  let statusColor;
  if (statusText === "offline") {
    statusText = "Offline";
    statusColor = isDarkMode ? "#616161" : "#9e9e9e";
  } else if (statusText === "stopped") {
    statusText = "Stopped";
    statusColor = isDarkMode ? "#d32f2f" : "#f44336";
  } else if (statusText === "idle") {
    statusText = "Idle";
    statusColor = isDarkMode ? "#ff9800" : "#f57c00";
  } else if (statusText === "moving") {
    statusText = "Moving";
    statusColor = isDarkMode ? "#4caf50" : "#2e7d32";
  } else {
    statusText = "Unknown";
    statusColor = isDarkMode ? "#9e9e9e" : "#616161";
  }

  let sinceText = "";
  if (vehicle.status_time_str) {
    sinceText = `since ${vehicle.status_time_str}`;
  } else if (hoursDiff > 0) {
    sinceText = `since ${hoursDiff} hour${hoursDiff > 1 ? "s" : ""}`;
  } else if (minutesDiff > 0) {
    sinceText = `since ${minutesDiff} min`;
  } else {
    sinceText = `since ${secondsDiff} sec`;
  }

  const iconStyle = "font-size:22px;vertical-align:middle;margin-right:2px;";
  const iconRed = "color:#d32f2f;";
  const gpsIcon = statusText === "Offline" ? "location_disabled" : "my_location";

  let ignitionIcon, ignitionColor;
  if (vehicle.ignition === "0" || vehicle.ignition === 0) {
    ignitionIcon = "key_off";
    ignitionColor = isDarkMode ? "#ff5252" : "#d32f2f";
  } else {
    ignitionIcon = "key";
    ignitionColor = isDarkMode ? "#4caf50" : "#2e7d32";
  }

  const ASUgsmValue = parseInt(vehicle.gsm ?? "0", 10);
  let gsmIcon = "signal_cellular_off";
  let gsmColor = isDarkMode ? "#ff5252" : "#d32f2f";
  if (ASUgsmValue === 0) {
    gsmIcon = "signal_cellular_null";
    gsmColor = isDarkMode ? "#ff5252" : "#d32f2f";
  } else if (ASUgsmValue > 0 && ASUgsmValue <= 8) {
    gsmIcon = "signal_cellular_1_bar";
    gsmColor = isDarkMode ? "#ffb74d" : "#ff9800";
  } else if (ASUgsmValue > 8 && ASUgsmValue <= 16) {
    gsmIcon = "signal_cellular_2_bar";
    gsmColor = isDarkMode ? "#ffe082" : "#ffc107";
  } else if (ASUgsmValue > 16 && ASUgsmValue <= 24) {
    gsmIcon = "signal_cellular_3_bar";
    gsmColor = isDarkMode ? "#d4e157" : "#cddc39";
  } else if (ASUgsmValue > 24 && ASUgsmValue <= 32) {
    gsmIcon = "signal_cellular_4_bar";
    gsmColor = isDarkMode ? "#81c784" : "#4caf50";
  }

  const sosIcon =
    vehicle.sos === "1"
      ? `<span class="material-symbols-outlined" style="${iconStyle + iconRed}">sos</span>`
      : "";

  const iconRow = `
      <span
        class="material-symbols-outlined"
        style="${iconStyle}cursor:pointer;"
        title="View Vehicle Info"
        onclick="vehicleInfoPage('${vehicle.LicensePlateNumber}')">arrow_forward</span>
      <span class="material-symbols-outlined" style="${iconStyle} color: ${ignitionColor}" title="${(vehicle.ignition === "1" || vehicle.ignition === 1) ? "Ignition On" : "Ignition Off"}">${ignitionIcon}</span>
      <span class="material-symbols-outlined" style="${iconStyle} color: ${gsmColor}" title="GSM Signal Strength">${gsmIcon}</span>
      ${sosIcon}
    `;

  const listener =
    vehicle.LicensePlateNumber === "Unknown" || !vehicle.LicensePlateNumber
      ? vehicle.imei
      : vehicle.LicensePlateNumber;

  const template = `
    <div style="display:flex;align-items:stretch;justify-content:space-between;">
      <div style="flex:1;">
        <div class="vehicle-card-row" style="display:flex;align-items:center;gap:8px;">
          <span class="material-symbols-outlined" style="font-size:22px;" title="${gpsIcon === "location_disabled" ? "GPS Offline" : "GPS Active"}">${gpsIcon}</span>
          <span class="vehicle-number"
                style="font-family:'Roboto Mono',monospace;font-weight:700;font-size:22px;cursor:pointer;"
                onclick="vehicleInfoPage('${vehicle.LicensePlateNumber || vehicle.imei}')">
            ${listener}
          </span>
          <span style="margin-left:4px;">
            ${iconRow}
          </span>
        </div>
        <div class="divider" style="height:1px;background:#eee;margin:8px 0;"></div>
        <div class="vehicle-card-row" style="margin-top:2px;font-size:14px;color:#222;">
          <strong> Last Update : </strong> <span class="last-updated-text">${formatLastUpdatedText(
            vehicle.date,
            vehicle.time
          )}</span>
        </div>
        <div class="vehicle-card-row" style="margin-top:2px;font-size:16px;font-weight:500;color:${statusColor};">
          ${statusText} : ${speed} kmph, <span style="color:${statusColor};font-weight:400;">${sinceText}</span>
        </div>
        <div class="vehicle-card-row location-text" style="margin-top:2px;font-size:12px;line-height:1.2;">
         <strong> Location : </strong> ${vehicle.address || "Location unknown"}
        </div>
        <div class="vehicle-card-row" style="margin-top:10px;display:flex;justify-content:space-between;font-size:16px;">
          <div>
            <div style="font-size:13px;color:#777; font-weight:600;">Distance Today</div>
            <div style="font-weight:300;">${
              vehicle.distance ? parseFloat(vehicle.distance).toFixed(1) : "0"
            } km</div>
          </div>
          <div>
            <div style="font-size:13px;color:#777; font-weight:600;">Stoppage Today</div>
            <div style="font-weight:300;">${vehicle.stoppage_time || "--"}</div>
          </div>
        </div>
      </div>
      <div class="vertical-divider" style="width:1px; background:#eee; margin:0 16px;"></div>
      <div class="vehicle-card-actions" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">
       <span class="material-symbols-outlined info-bottom-action vertical-bar" title="Share Location" style="cursor:pointer;">moved_location</span>
      </div>
    </div>
  `;

  return {
    template,
    isSosBlink: vehicle.sos === "1" && isToday,
    isSosHistoric: vehicle.sos === "1" && !isToday,
  };
}

function updateVehicleCard(data) {
  const imei = data.imei;
  const vehicleCard = document.querySelector(
    `.vehicle-card[data-imei="${imei}"]`
  );
  const listContainer = document.getElementById("vehicle-list");
  if (!vehicleCard && !listContainer) return;

  const isDarkMode = document.body.classList.contains("dark-mode");
  const { template, isSosBlink, isSosHistoric } = buildVehicleCardTemplate(
    data,
    isDarkMode
  );

  if (vehicleCard) {
    vehicleCard.innerHTML = template;
    vehicleCard.classList.remove("sos-blink-card", "sos-historic-card");
    vehicleCard.classList.toggle("sos-blink-card", isSosBlink);
    vehicleCard.classList.toggle(
      "sos-historic-card",
      !isSosBlink && isSosHistoric
    );
    vehicleCard.style.zIndex = isSosBlink ? "10" : "";
  } else if (listContainer) {
    const vehicleElement = document.createElement("div");
    vehicleElement.classList.add("vehicle-card");
    vehicleElement.setAttribute("data-imei", data.imei);
    vehicleElement.innerHTML = template;
    vehicleElement.classList.toggle("sos-blink-card", isSosBlink);
    vehicleElement.classList.toggle(
      "sos-historic-card",
      !isSosBlink && isSosHistoric
    );
    vehicleElement.style.zIndex = isSosBlink ? "10" : "";
    listContainer.appendChild(vehicleElement);
    incrementVehicleCardCount();
    addHoverListenersForVehicle(data.imei);
  }
}

function renderVehicleCards(vehicles, filterValue = "all") {
  if (document.getElementById("toggle-card-switch").checked === false) {
    hideCard();
    updateVehicleCounterDisplay();
    return;
  }

  let vehiclesArray = vehicles;
  if (vehicles instanceof Map) {
    vehiclesArray = Array.from(vehicles.values());
  } else if (!Array.isArray(vehicles)) {
    vehiclesArray = [];
  }

  const listContainer = document.getElementById("vehicle-list");
  listContainer.innerHTML = "";
  resetVehicleCardCount();

  vehiclesArray.forEach((vehicle) => {
    const vehicleElement = document.createElement("div");
    vehicleElement.classList.add("vehicle-card");
    vehicleElement.setAttribute("data-imei", vehicle.imei);
    const isDarkMode = document.body.classList.contains("dark-mode");
    const { template, isSosBlink, isSosHistoric } = buildVehicleCardTemplate(
      vehicle,
      isDarkMode
    );

    vehicleElement.innerHTML = template;
    vehicleElement.classList.toggle("sos-blink-card", isSosBlink);
    vehicleElement.classList.toggle(
      "sos-historic-card",
      !isSosBlink && isSosHistoric
    );
    vehicleElement.style.zIndex = isSosBlink ? "10" : "";

    listContainer.appendChild(vehicleElement);
    incrementVehicleCardCount();
    addHoverListenersForVehicle(vehicle.imei);
  });

  showHidecar();
}

async function toggleGeofences() {
    try {
        if (!geofenceToggle) {
            const response = await fetch('/geofence/api/geofences');
            if (!response.ok) throw new Error('Failed to fetch geofences');
            
            const geofences = await response.json();
            
            const activeGeofences = geofences.filter(geofence => geofence.is_active === true);
            
            activeGeofences.forEach(geofence => {
                let polygon;
                
                if (geofence.shape_type === 'polygon') {
                    const coordinates = geofence.coordinates.points.map(point => ({
                        lat: point.lat,
                        lng: point.lng
                    }));
                    
                    polygon = new google.maps.Polygon({
                        paths: coordinates,
                        strokeColor: '#FF0000',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: '#FF0000',
                        fillOpacity: 0.15,
                        map: map,
                        title: geofence.name
                    });
                } else if (geofence.shape_type === 'circle') {
                    const center = geofence.coordinates.center;
                    const radius = geofence.coordinates.radius;
                    
                    polygon = new google.maps.Circle({
                        center: new google.maps.LatLng(center.lat, center.lng),
                        radius: radius,
                        strokeColor: '#FF0000',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: '#FF0000',
                        fillOpacity: 0.15,
                        map: map,
                        title: geofence.name
                    });
                }
                
                if (polygon) {
                    geofencePolygons[geofence._id] = polygon;
                    
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="geofence-info">
                                <h4>${geofence.name}</h4>
                                <p><strong>Type:</strong> ${geofence.shape_type}</p>
                                <p><strong>Location:</strong> ${geofence.location || 'N/A'}</p>
                                <p><strong>Created by:</strong> ${geofence.created_by}</p>
                            </div>
                        `
                    });
                    
                    if (geofence.shape_type === 'polygon') {
                        polygon.addListener('click', (event) => {
                            infoWindow.setPosition(event.latLng);
                            infoWindow.open(map);
                        });
                    } else if (geofence.shape_type === 'circle') {
                        polygon.addListener('click', (event) => {
                            infoWindow.setPosition(event.latLng);
                            infoWindow.open(map);
                        });
                    }
                }
            });
            
            geofenceToggle = true;
            geofenceButton.classList.add('active');
        } else {
            Object.values(geofencePolygons).forEach(polygon => {
                polygon.setMap(null);
            });
            geofencePolygons = {};
            geofenceToggle = false;
            geofenceButton.classList.remove('active');
        }
    } catch (error) {
        console.error('Error toggling geofences:', error);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// function triggerSOS(imei, marker) {
//   const vehicle = vehicleData.get(imei);
//   if (!vehicle) return;

//   if(vehicle.sosActive){
//     console.log(`Ignoring old SOS alert for ${imei} (last update ${hoursSinceUpdate.toFixed(1)} hours ago)`);
//     return;
//   }

//   if (!sosActiveMarkers[imei]) {
//     const sosDiv = document.createElement("div");
//     sosDiv.className = "sos-blink";
//     sosDiv.style.position = "absolute";
//     sosDiv.style.top = "50%";
//     sosDiv.style.left = "50%";
//     sosDiv.style.pointerEvents = "none";
//     marker.content.appendChild(sosDiv);
//     sosActiveMarkers[imei] = sosDiv;
//     marker.content.classList.add("vehicle-blink");

//     const nearbyVehicles = findNearbyVehicles(vehicle, 5);
//     showNearbyVehiclesPopup(vehicle, nearbyVehicles);

//   vehicle.sosActive = true;
//   vehicleData.set(imei, vehicle);
//   }
// }

function triggerSOS(imei, marker) {
  const vehicle = vehicleData.get(imei);
  if (!vehicle || !marker) {
    console.error(`No vehicle or marker found for ${imei}`);
    return;
  }

  // Check if SOS is already active for this vehicle
  if (vehicle.sosActive) {
    console.log(`SOS already active for ${imei}`);
    return;
  }

  // Update vehicle data with SOS active flag
  vehicle.sosActive = true;
  vehicle.sos = "1";
  vehicleData.set(imei, vehicle);

  console.log(`Triggering SOS for ${imei}`);

  // Add flashing effect to marker
  if (!sosActiveMarkers[imei]) {
    // Create and add SOS siren/alert element
    const sosDiv = document.createElement("div");
    sosDiv.className = "sos-blink";
    sosDiv.innerHTML = "🚨"; // Emergency siren emoji
    sosDiv.style.position = "absolute";
    sosDiv.style.top = "-25px";
    sosDiv.style.left = "50%";
    sosDiv.style.transform = "translateX(-50%)";
    sosDiv.style.fontSize = "20px";
    sosDiv.style.fontWeight = "bold";
    sosDiv.style.color = "#ff0000";
    sosDiv.style.textShadow = "0 0 5px #fff, 0 0 10px #ff0000";
    sosDiv.style.pointerEvents = "none";
    sosDiv.style.zIndex = "1000";
    sosDiv.style.animation = "sosBlink 1s infinite alternate";
    
    // Add CSS animation if not already present
    if (!document.querySelector('#sos-animation-style')) {
      const style = document.createElement('style');
      style.id = 'sos-animation-style';
      style.textContent = `
        @keyframes sosBlink {
          0% { opacity: 1; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.5; transform: translateX(-50%) scale(1.2); }
          100% { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        
        .vehicle-blink {
          animation: vehicleBlink 0.8s infinite alternate;
        }
        
        @keyframes vehicleBlink {
          0% { filter: brightness(1) drop-shadow(0 0 5px red); }
          100% { filter: brightness(1.5) drop-shadow(0 0 15px red); }
        }
        
        .sos-blink-card {
          animation: sosCardBlink 1s infinite alternate;
          border: 2px solid red;
          background-color: rgba(255, 0, 0, 0.1) !important;
        }
        
        @keyframes sosCardBlink {
          0% { box-shadow: 0 0 5px rgba(255, 0, 0, 0.5); }
          100% { box-shadow: 0 0 15px rgba(255, 0, 0, 0.8); }
        }
      `;
      document.head.appendChild(style);
    }

    // Append to marker
    if (marker.content) {
      marker.content.style.position = "relative";
      marker.content.appendChild(sosDiv);
    } else {
      console.error("Marker content not found");
    }
    
    sosActiveMarkers[imei] = sosDiv;
    
    // Add blink effect to vehicle icon
    if (marker.content) {
      marker.content.classList.add("vehicle-blink");
      
      // Change marker icon to red alert version
      const markerImage = marker.content.querySelector("img");
      if (markerImage) {
        // Store original icon to restore later
        markerImage.dataset.originalSrc = markerImage.src;
        markerImage.src = "/static/images/car_red_alert.png"; // Create this icon or use existing red car
      }
    }

    // Find and show nearby vehicles
    const nearbyVehicles = findNearbyVehicles(vehicle, 5);
    console.log(`Found ${nearbyVehicles.length} nearby vehicles`);
    showNearbyVehiclesPopup(vehicle, nearbyVehicles);
    
    // Also trigger audio alert (optional)
    playSOSAlertSound();
  }
}

function acknowledgeSOS(imei) {
  const vehicle = vehicleData.get(imei);
  if (!vehicle) return;

  removeSOS(imei);
  
  vehicle.sos = "0";
  vehicle.sosActive = false;
  vehicleData.set(imei, vehicle);
  
  fetch('/alerts/acknowledge_sos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': getCookie('csrf_access_token')
    },
    body: JSON.stringify({
      imei: imei,
      licensePlate: vehicle.LicensePlateNumber
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log(`SOS acknowledged for ${imei}`);
      const vehicleCard = document.querySelector(`.vehicle-card[data-imei="${imei}"]`);
      if (vehicleCard) {
        vehicleCard.classList.remove('sos-blink-card');
      }
    } else {
      console.error('Failed to acknowledge SOS:', data.message);
    }
  })
  .catch(error => {
    console.error('Error acknowledging SOS:', error);
  });
}

// function findNearbyVehicles(sosVehicle, radiusKm) {
//   const nearby = [];
//   const sosLat = parseFloat(sosVehicle.latitude);
//   const sosLon = parseFloat(sosVehicle.longitude);

//   vehicleData.forEach((vehicle, imei) => {
//     if (imei === sosVehicle.imei) return; 
    
//     const vehicleLat = parseFloat(vehicle.latitude);
//     const vehicleLon = parseFloat(vehicle.longitude);
    
//     if (!isNaN(vehicleLat) && !isNaN(vehicleLon)) {
//       const distance = calculateDistance(sosLat, sosLon, vehicleLat, vehicleLon);
//       if (distance <= radiusKm) {
//         const estimatedTime = (distance / 40) * 60; 
//         nearby.push({
//           vehicle,
//           distance: distance.toFixed(2),
//           estimatedTime: estimatedTime.toFixed(0)
//         });
//       }
//     }
//   });

//   nearby.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
//   return nearby;
// }

function findNearbyVehicles(sosVehicle, radiusKm) {
  const nearby = [];
  const sosLat = parseFloat(sosVehicle.latitude);
  const sosLon = parseFloat(sosVehicle.longitude);
  
  console.log(`Finding vehicles near ${sosVehicle.LicensePlateNumber} at ${sosLat}, ${sosLon}`);

  if (isNaN(sosLat) || isNaN(sosLon)) {
    console.error("Invalid SOS vehicle coordinates");
    return nearby;
  }

  vehicleData.forEach((vehicle, imei) => {
    if (imei === sosVehicle.imei) return; 
    
    const vehicleLat = parseFloat(vehicle.latitude);
    const vehicleLon = parseFloat(vehicle.longitude);
    
    if (!isNaN(vehicleLat) && !isNaN(vehicleLon)) {
      const distance = calculateDistance(sosLat, sosLon, vehicleLat, vehicleLon);
      console.log(`Distance to ${vehicle.LicensePlateNumber}: ${distance.toFixed(2)} km`);
      
      if (distance <= radiusKm) {
        const estimatedTime = (distance / 40) * 60; // Assuming 40 km/h average speed
        
        // Get vehicle status for ETA calculation
        let statusText = vehicle.status || "unknown";
        let estimatedTimeAdjusted = estimatedTime;
        
        // Adjust ETA based on vehicle status
        if (statusText === "moving" && vehicle.speed > 20) {
          estimatedTimeAdjusted = (distance / 60) * 60; // If moving fast, assume 60 km/h
        } else if (statusText === "stopped" || statusText === "idle") {
          estimatedTimeAdjusted = estimatedTime * 1.5; // Add buffer for stopped/idle vehicles
        }
        
        nearby.push({
          vehicle: vehicle,
          distance: distance.toFixed(2),
          estimatedTime: Math.max(1, Math.ceil(estimatedTimeAdjusted)), // At least 1 minute
          status: statusText,
          speed: vehicle.speed ? convertSpeedToKmh(vehicle.speed) : 0
        });
      }
    }
  });

  nearby.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
  console.log(`Total nearby vehicles found: ${nearby.length}`);
  return nearby;
}

// function showNearbyVehiclesPopup(sosVehicle, nearbyVehicles) {
//   const oldPopup = document.getElementById("sos-nearby-popup");
//   if (oldPopup) oldPopup.remove();

//   const popup = document.createElement("div");
//   popup.id = "sos-nearby-popup";
  
//   let content = `
//     <div class="sos-popup-content">
//       <h3>SOS Alert - ${sosVehicle.LicensePlateNumber || sosVehicle.imei}</h3>
//       <div class="sos-location">Location: ${sosVehicle.address || "Unknown"}</div>
//       <div class="sos-coords">Coordinates: ${parseFloat(sosVehicle.latitude).toFixed(4)}, ${parseFloat(sosVehicle.longitude).toFixed(4)}</div>
//       <div class="sos-time">Time: ${new Date().toLocaleTimeString()}</div>
      
//       <h4>Nearby Vehicles (within 5km):</h4>
//   `;

//   if (nearbyVehicles.length > 0) {
//     content += `<ul class="nearby-vehicles-list">`;
//     nearbyVehicles.forEach(vehicle => {
//       content += `
//         <li>
//           <strong>${vehicle.vehicle.LicensePlateNumber || vehicle.vehicle.imei}</strong>
//           - Distance: ${vehicle.distance} km
//           - Estimated Time: ~${vehicle.estimatedTime} min
//         </li>
//       `;
//     });
//     content += `</ul>`;
//   } else {
//     content += `<p>No other vehicles found within 5km radius.</p>`;
//   }

//  content += `
//     <button id="acknowledge-sos-btn" class="sos-ack-btn">Acknowledge SOS</button>
//     <button id="minimize-sos-popup">Minimize</button>
//     <button id="close-sos-popup">Close</button>
//   `;

//   popup.innerHTML = content;
//   document.body.appendChild(popup);

//   popup.style.position = "fixed";
//   popup.style.left = "50%";
//   popup.style.top = "50%";
//   popup.style.transform = "translate(-50%, -50%)";
//   popup.style.zIndex = "10000";
//   popup.style.backgroundColor = "white";
//   popup.style.padding = "20px";
//   popup.style.borderRadius = "8px";
//   popup.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
//   popup.style.maxWidth = "500px";
//   popup.style.width = "90%";

//   document.getElementById("acknowledge-sos-btn").onclick = () => {
//     acknowledgeSOS(sosVehicle.imei);
//     popup.remove();
//   };

//   document.getElementById("minimize-sos-popup").onclick = () => {
//     popup.style.display = "none";
//   };

//   document.getElementById("close-sos-popup").onclick = () => {
//     popup.remove();
//   };
// }

function showNearbyVehiclesPopup(sosVehicle, nearbyVehicles) {
  const oldPopup = document.getElementById("sos-nearby-popup");
  if (oldPopup) oldPopup.remove();

  const popup = document.createElement("div");
  popup.id = "sos-nearby-popup";
  
  const formattedTime = new Date().toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit' 
  });
  
  const formattedDate = new Date().toLocaleDateString();
  
  let content = `
    <div class="sos-popup-content" style="font-family: Arial, sans-serif;">
      <div style="background-color: #ff0000; color: white; padding: 15px; border-radius: 8px 8px 0 0;">
        <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">🚨</span> 
          SOS ALERT - ${sosVehicle.LicensePlateNumber || sosVehicle.imei}
        </h3>
      </div>
      
      <div style="padding: 20px;">
        <div style="margin-bottom: 15px;">
          <div><strong>Vehicle:</strong> ${sosVehicle.LicensePlateNumber || sosVehicle.imei}</div>
          <div><strong>Location:</strong> ${sosVehicle.address || "Unknown location"}</div>
          <div><strong>Coordinates:</strong> ${parseFloat(sosVehicle.latitude).toFixed(6)}, ${parseFloat(sosVehicle.longitude).toFixed(6)}</div>
          <div><strong>Time:</strong> ${formattedTime} on ${formattedDate}</div>
        </div>
        
        <h4 style="color: #d32f2f; border-bottom: 2px solid #eee; padding-bottom: 5px;">
          Nearby Vehicles (within 5km radius):
        </h4>
  `;

  if (nearbyVehicles.length > 0) {
    content += `
      <div style="max-height: 300px; overflow-y: auto; margin: 10px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Vehicle</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Distance</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">ETA</th>
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Status</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    nearbyVehicles.forEach((item, index) => {
      const statusColor = item.status === "moving" ? "#4caf50" : 
                         item.status === "stopped" ? "#f44336" : 
                         item.status === "idle" ? "#ff9800" : "#9e9e9e";
      
      content += `
        <tr style="${index % 2 === 0 ? 'background-color: #f9f9f9;' : ''}">
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            <strong>${item.vehicle.LicensePlateNumber || item.vehicle.imei}</strong>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${item.distance} km
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ~${item.estimatedTime} min
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${statusColor};">
            ${item.status} ${item.speed > 0 ? `(${item.speed.toFixed(0)} km/h)` : ''}
          </td>
        </tr>
      `;
    });
    
    content += `
          </tbody>
        </table>
      </div>
    `;
  } else {
    content += `
      <div style="padding: 20px; text-align: center; color: #666;">
        <p style="font-size: 18px;">⚠️</p>
        <p><strong>No other vehicles found within 5km radius.</strong></p>
        <p>Consider checking wider area or alternative resources.</p>
      </div>
    `;
  }

 content += `
        <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
          <button id="acknowledge-sos-btn" 
                  style="padding: 10px 20px; background-color: #4caf50; color: white; 
                         border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            ✅ Acknowledge SOS
          </button>
          <button id="view-on-map-btn" 
                  style="padding: 10px 20px; background-color: #2196f3; color: white; 
                         border: none; border-radius: 4px; cursor: pointer;">
            🗺️ View on Map
          </button>
          <button id="close-sos-popup" 
                  style="padding: 10px 20px; background-color: #757575; color: white; 
                         border: none; border-radius: 4px; cursor: pointer;">
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  `;

  popup.innerHTML = content;
  document.body.appendChild(popup);

  // Style the popup
  popup.style.position = "fixed";
  popup.style.left = "50%";
  popup.style.top = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.zIndex = "10000";
  popup.style.backgroundColor = "white";
  popup.style.borderRadius = "8px";
  popup.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";
  popup.style.width = "600px";
  popup.style.maxWidth = "90vw";
  popup.style.maxHeight = "80vh";
  popup.style.overflow = "hidden";

  // Add event listeners
  document.getElementById("acknowledge-sos-btn").onclick = () => {
    acknowledgeSOS(sosVehicle.imei);
    popup.remove();
  };

  document.getElementById("view-on-map-btn").onclick = () => {
    // Center map on SOS vehicle
    const latLng = new google.maps.LatLng(
      parseFloat(sosVehicle.latitude),
      parseFloat(sosVehicle.longitude)
    );
    map.setZoom(16);
    map.panTo(latLng);
    
    // Highlight the SOS vehicle
    const marker = markers[sosVehicle.imei];
    if (marker) {
      const address = sosVehicle.address || "Location unknown";
      setInfoWindowContent(infoWindow, marker, latLng, sosVehicle, address);
      infoWindow.open(map, marker);
    }
  };

  document.getElementById("close-sos-popup").onclick = () => {
    popup.remove();
  };
}

function playSOSAlertSound() {
  try {
    // Create audio context for alert sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure SOS sound pattern (short beeps)
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
    
    // Repeat pattern
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime);
      oscillator2.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
      
      gainNode2.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.2);
    }, 200);
    
  } catch (error) {
    console.log("Audio not supported or user interaction required");
  }
}

function vehicleInfoPage(licensePlateNumber) {
  const url = `/routeHistory/vehicle/${licensePlateNumber}`;
  window.open(url, "_blank");
}

window.vehicleInfoPage = vehicleInfoPage;

function getHeadingText(filterValue) {
  switch (filterValue) {
    case "0":
      return "Stationary Vehicles";
    case "0-40":
      return "Slow Speed Vehicles";
    case "40-60":
      return "Moderate Speed Vehicles";
    case "60+":
      return "High Speed Vehicles";
    case "sos":
      return "SOS Alert Vehicles";
    case "offline":
      return "Offline Vehicles";
    default:
      return "Total Vehicles";
  }
}

function setInfoWindowContent(infoWindow, marker, latLng, device, address) {
  const isDarkMode = document.body.classList.contains("dark-mode");
  const imei = device.imei || '<span class="missing-data">N/A</span>';
  const LicensePlateNumber =
    device.LicensePlateNumber || imei;
  const speed =
    device.speed !== null && device.speed !== undefined
      ? `${convertSpeedToKmh(device.speed).toFixed(0)} kmph`
      : '<span class="missing-data">Unknown</span>';
  const distance =
    device.distance !== undefined && device.distance !== null
      ? parseFloat(device.distance).toFixed(1)
      : "0";
  const stoppage = device.stoppage_time || "--";
  const lat = latLng.lat() || '<span class="missing-data">Unknown</span>';
  const lon = latLng.lng() || '<span class="missing-data">Unknown</span>';
  const date = device.date || "N/A";
  const time = device.time || "N/A";
  const addressText =
    address || '<span class="missing-data">Location unknown</span>';
  const url = `/routeHistory/vehicle/${device.LicensePlateNumber}`;

  const now = new Date();
  const lastUpdated = convertToDate(device.date, device.time);
  const timeDiff = Math.abs(now - lastUpdated);
  const secondsAgo = Math.floor(timeDiff / 1000);
  const minutesAgo = Math.floor(timeDiff / (1000 * 60));
  const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
  let sinceText = "";
  if (device.status_time_str) {
    sinceText = `since ${device.status_time_str}`;
  } else if (hoursAgo > 0) {
    sinceText = `since ${hoursAgo} min`;
  } else if (minutesAgo > 0) {
    sinceText = `since ${minutesAgo} min`;
  } else {
    sinceText = `since ${secondsAgo} sec`;
  }

  let statusText = device.status;
  let statusColor;
  if (statusText === "offline") {
    statusText = "Offline";
    statusColor = "#616161";
  } else if (statusText === "stopped") {
    statusText = "Stopped";
    statusColor = "#d32f2f";
  } else if (statusText === "idle") {
    statusText = "Idle";
    statusColor = "#ff9800";
  } else if (statusText === "moving") {
    statusText = "Moving";
    statusColor = "#4caf50";
  } else {
    statusText = "Unknown";
    statusColor = "#9e9e9e";
  }

  const iconStyle = "font-size:22px;vertical-align:middle;margin-right:2px;";
  const iconRed = "color:#d32f2f;";
  const gpsIcon =
    statusText === "Offline" ? "location_disabled" : "my_location";

  let ignitionIcon, ignitionColor;
  
  if (device.ignition === "0" || device.ignition === 0) {
    ignitionIcon = "key_off";
    ignitionColor = isDarkMode ? "#ff5252" : "#d32f2f";
  } else {
    ignitionIcon = "key";
    ignitionColor = isDarkMode ? "#4caf50" : "#2e7d32";
  }

  const sosIcon =
    device.sos === "1"
      ? `<span class="material-symbols-outlined" style="${
          iconStyle + iconRed
        }">sos</span>`
      : "";
  const arrowIcon = "arrow_forward";

  const ASUgsmValue = parseInt(device.gsm);
  let gsmIcon = "signal_cellular_null";
  let gsmColor = "#d32f2f";
  if (ASUgsmValue > 0 && ASUgsmValue <= 8) {
    gsmIcon = "signal_cellular_1_bar";
    gsmColor = "#ff9800";
  } else if (ASUgsmValue > 8 && ASUgsmValue <= 16) {
    gsmIcon = "signal_cellular_2_bar";
    gsmColor = "#ffc107";
  } else if (ASUgsmValue > 16 && ASUgsmValue <= 24) {
    gsmIcon = "signal_cellular_3_bar";
    gsmColor = "#cddc39";
  } else if (ASUgsmValue > 24 && ASUgsmValue <= 32) {
    gsmIcon = "signal_cellular_4_bar";
    gsmColor = "#4caf50";
  } else if (ASUgsmValue === 0) {
    gsmIcon = "signal_cellular_null";
    gsmColor = "#d32f2f";
  }

  const headerContent = document.createElement("div");
  headerContent.innerHTML = `
      <div class="info-header">
    <span class="material-symbols-outlined info-icon" style="font-size:22px;" title="GPS Status">${gpsIcon}</span>
    <span class="info-plate" style="cursor:pointer;" onclick="vehicleInfoPage('${device.LicensePlateNumber}')">${LicensePlateNumber}</span>
    <span class="material-symbols-outlined info-icon" style="font-size:22px;cursor:pointer;" title="View Vehicle Info"
      onclick="vehicleInfoPage('${device.LicensePlateNumber}')">${arrowIcon}</span>
    <span class="material-symbols-outlined info-icon" style="font-size:22px; color:${ignitionColor}" title="Ignition Status">
      ${ignitionIcon}</span>
    <span class="material-symbols-outlined info-icon" style="font-size:22px;color:${gsmColor};" title="GSM Signal">${gsmIcon}</span>
      </div>
  `;

  const content = `
      <div class="info-content">
        <div class="info-update-row">
          <span class="info-update-label">Last Update :</span>
          <span class="info-update-value">${formatLastUpdatedText(
            device.date,
            device.time
          )}</span>
        </div>
        <div class="info-status-row" style="color:${statusColor};">
          ${statusText} : ${speed}, <span class="info-since">${sinceText}</span>
        </div>
        <div class="info-location-row">${addressText}</div>
          <div class="info-bottom-row">
            <div class="info-bottom-item">
              <span class="info-bottom-value">${distance}km</span>
              <span class="info-bottom-label">
                <span class="material-symbols-outlined info-bottom-icon" title="Distance Today">
                  route
                </span>
              </span>
            </div>
            <div class="info-bottom-item">
              <span class="info-bottom-value">${stoppage}</span>
              <span class="info-bottom-label">
                <span class="material-symbols-outlined info-bottom-icon"title="Stoppage Today">
                  local_parking
                </span>
              </span>
            </div>
            <div class="info-bottom-actions">
              <span class="material-symbols-outlined info-bottom-action" style="cursor:pointer;" title="Share Location">moved_location</span>
            </div>
          </div>
        </div>
      </div>
  `;

  infoWindow.setHeaderContent(headerContent);
  infoWindow.setContent(content);
}

document.body.addEventListener("click", function (e) {
  if (
    e.target.classList.contains("info-bottom-action") &&
    e.target.textContent.trim() === "moved_location"
  ) {
    const plate = document.querySelector(".info-plate");

    if (!plate) {
      console.error("License plate element not found in info window.");
      return;
    }
    const plateText = plate.textContent.trim();
    if (!plateText) {
      console.error("License plate text is empty.");
      return;
    }

    showShareLocationPopup(plateText);
  }
});

function showShareLocationPopup(plate) {
  const oldPopup = document.getElementById("share-location-popup");
  if (oldPopup) oldPopup.remove();

  const popup = document.createElement("div");
  popup.id = "share-location-popup";
  popup.innerHTML = `
    <div class="share-popup-content">
      <h3>Share Live Location</h3>
      <div>
        <label for="from-datetime">From:</label>
        <input type="datetime-local" id="from-datetime" style="margin-bottom:8px;">
      </div>
      <div>
        <label for="to-datetime">To:</label>
        <input type="datetime-local" id="to-datetime" style="margin-bottom:8px;">
      </div>
      <button id="generate-share-link" style="background:#388e3c;color:#fff;">Generate Link</button>
      <div style="margin-top:10px;">
        <input id="share-link-input" type="text" value="" readonly style="width:90%;">
      </div>
      <button id="close-share-popup" style="margin-top:10px;background:#aaa;color:#fff;">Close</button>
    </div>
  `;
  document.body.appendChild(popup);

  popup.style.position = "fixed";
  popup.style.left = "50%";
  popup.style.top = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.zIndex = 9999;

  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  const toISOStringLocal = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  document.getElementById("from-datetime").value = toISOStringLocal(now);
  const toDate = new Date(now.getTime() + 15 * 60000);
  document.getElementById("to-datetime").value = toISOStringLocal(toDate);

  document.getElementById("close-share-popup").onclick = () => popup.remove();

  document.getElementById("generate-share-link").onclick = async function () {
    const from_datetime = document.getElementById("from-datetime").value;
    const to_datetime = document.getElementById("to-datetime").value;
    const input = document.getElementById("share-link-input");
    input.value = "Generating link...";

    if (!from_datetime || !to_datetime) {
      input.value = "Please select both date and time.";
      return;
    }

    try {
      const res = await fetch(`/shareLocation/share-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json",
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
         },
        body: JSON.stringify({
          LicensePlateNumber: plate,
          from_datetime,
          to_datetime,
        }),
      });
      const data = await res.json();
      if (data.link) {
        input.value = data.link;
      } else {
        input.value = data.error || "Failed to generate link.";
      }
    } catch (e) {
      input.value = "Failed to generate link.";
    }
  };
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
      const latLng = parseCoordinates(device.latitude, device.longitude);
      const iconUrl = getVehicleIconBySpeed(
        device.speed,
        imei,
        device.date,
        device.time,
        device.VehicleType || 'car'
      );
      const rotation = device.course;

      if (markers[imei]) {
        updateAdvancedMarker(markers[imei], latLng, iconUrl, rotation);
        markers[imei].device = device;
      } else {
        markers[imei] = createAdvancedMarker(latLng, iconUrl, rotation, device);
        addHoverListenersForVehicle(imei);
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

    map.setCenter(boundsCenter);

    const listener = google.maps.event.addListener(map, "idle", function () {
      if (map.getZoom() < 7) {
        map.setZoom(7);
      }
      google.maps.event.removeListener(listener);
    });
  }

  const vehiclesArray = Array.from(vehicleData.values());
  renderVehicleCards(vehiclesArray);
  hideSkeletonLoader();
  applyFilterToAllVehicles();
}

function animateMarker(marker, newPosition, duration = 14000) {
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

function parseCoordinates(lat, lng) {
  if (isNaN(lat) || isNaN(lng)) {
    console.error("Invalid coordinates:", lat, lng);
    return new google.maps.LatLng(0, 0); 
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

function formatLastUpdatedFromDate(lastUpdated, now = new Date()) {
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
    // fallback to absolute when very old
    const { formattedDate, formattedTime } = formatDateTime(
      // reconstruct the "date" and "time" style output
      lastUpdatedToDDMMYY(lastUpdated),
      lastUpdatedToHHMMSS(lastUpdated)
    );
    lastUpdatedText = formattedTime + " " + formattedDate;
  }

  return lastUpdatedText;
}

function lastUpdatedToDDMMYY(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return dd + mm + yy;
}

function lastUpdatedToHHMMSS(d) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return hh + mm + ss;
}

function updateLastUpdatedForRange(now, minAgeMs, maxAgeMs) {
  vehicleData.forEach((vehicle, imei) => {
    const last = vehicle.lastUpdatedDate
      ? vehicle.lastUpdatedDate
      : convertToDate(vehicle.date, vehicle.time);

    const ageMs = now - last;
    if (ageMs < minAgeMs || ageMs >= maxAgeMs) {
      return;
    }

    const text = formatLastUpdatedFromDate(last, now);

    // Update card view
    const card = document.querySelector(`.vehicle-card[data-imei="${imei}"]`);
    if (card) {
      const span = card.querySelector(".last-updated-text");
      if (span) span.textContent = text;
    }

    // Update table view
    const row = document.querySelector(
      `#vehicle-table tbody tr[data-imei="${imei}"]`
    );
    if (row) {
      const cell = row.querySelector(".last-updated-cell");
      if (cell) cell.textContent = text;
    }
  });
}

function startHybridLastUpdatedLoop() {
  function tick(timestamp) {
    if (!lastSecondRender) {
      lastSecondRender = timestamp;
      lastMinuteRender = timestamp;
      lastHourRender = timestamp;
    }

    const now = new Date();

    // < 1 minute old → update every second
    if (timestamp - lastSecondRender >= 1000) {
      updateLastUpdatedForRange(now, 0, 60 * 1000);
      lastSecondRender = timestamp;
    }

    // 1 minute – 1 day old → update every minute
    if (timestamp - lastMinuteRender >= 60 * 1000) {
      updateLastUpdatedForRange(
        now,
        60 * 1000,
        24 * 60 * 60 * 1000
      );
      lastMinuteRender = timestamp;
    }

    // > 1 day old → update every hour
    if (timestamp - lastHourRender >= 60 * 60 * 1000) {
      updateLastUpdatedForRange(
        now,
        24 * 60 * 60 * 1000,
        Infinity
      );
      lastHourRender = timestamp;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}


function convertToDate(ddmmyyyy, hhmmss) {
  let day = ddmmyyyy.substring(0, 2);
  let month = ddmmyyyy.substring(2, 4);
  let year = ddmmyyyy.substring(4, 6);

  year = parseInt(year) + 2000;

  let hours = hhmmss.substring(0, 2);
  let minutes = hhmmss.substring(2, 4);
  let seconds = hhmmss.substring(4, 6);

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

function getVehicleIconUrlBySpeedAndType(speedInKmh, vehicleType, dayDiff) {
  const basePath = "/static/images/";
  let vehiclePrefix;
  
  switch(vehicleType.toLowerCase()) {
    case 'truck':
      vehiclePrefix = 'truck';
      break;
    case 'bus':
      vehiclePrefix = 'bus';
      break;
    case 'bike':
      vehiclePrefix = 'bike';
      break;
    default: 
      vehiclePrefix = 'car';
  }

  if (dayDiff >= 1) {
    return `${basePath}${vehiclePrefix}_black.png`;
  } else if (speedInKmh === 0) {
    return `${basePath}${vehiclePrefix}_yellow.png`;
  } else if (speedInKmh > 0 && speedInKmh <= 40) {
    return `${basePath}${vehiclePrefix}_green.png`;
  } else if (speedInKmh > 40 && speedInKmh <= 60) {
    return `${basePath}${vehiclePrefix}_blue.png`;
  } else {
    return `${basePath}${vehiclePrefix}_red.png`;
  }
}

function getVehicleIconBySpeed(speed, imei, date, time, vehicleType) {
  const speedInKmh = convertSpeedToKmh(speed);
  const type = vehicleType || 'car'; 
  
  const now = new Date();
  const lastUpdateTime = convertToDate(date, time);
  
  const timeDiff = now - lastUpdateTime;
  const dayDiff = timeDiff / (1000 * 60 * 60 * 24);
  
  let iconUrl = getVehicleIconUrlBySpeedAndType(speedInKmh, type, dayDiff);
  
  return iconUrl;
}

function checkForDataTimeout(imei) {
  const now = new Date();
  const marker = markers[imei];

  if (lastDataReceivedTime[imei]) {
    const timeDiff = now - lastDataReceivedTime[imei];
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff >= 1) {
      marker.div.style.border = "2px solid red"; 

      marker.div.addEventListener("mouseover", function () {
        const tooltip = document.createElement("div");
        tooltip.className = "old-data-tooltip";
        tooltip.innerText = "Old data! New data not yet received";
        tooltip.style.position = "absolute";
        tooltip.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        tooltip.style.color = "white";
        tooltip.style.padding = "5px";
        tooltip.style.borderRadius = "5px";
        tooltip.style.top = "-30px";
        tooltip.style.left = "50%";
        tooltip.style.transform = "translateX(-50%)";
        tooltip.style.zIndex = "1000";
        marker.div.appendChild(tooltip);

        marker.div.addEventListener("mouseout", function () {
          tooltip.remove();
        });
      });
    }
  }
}

function updateVehicleData(vehicle) {
  const imei = vehicle.imei;
  const latLng = parseCoordinates(vehicle.latitude, vehicle.longitude); 
  const iconUrl = getVehicleIconBySpeed(
    vehicle.speed,
    imei,
    vehicle.date,
    vehicle.time,
    vehicle.VehicleType || 'car'
  );
  const rotation = vehicle.course;

  if (markers[imei]) {
    markers[imei].device = vehicle;
    animateMarker(markers[imei], latLng);
    updateAdvancedMarker(markers[imei], latLng, iconUrl, rotation);

    const markerContent = markers[imei].content;
    const markerImage = markerContent.querySelector("img");
    if (markerImage) {
    markerImage.src = iconUrl;
    const size = getVehicleIconSize(vehicle.VehicleType || 'car');
    const markerContent = markers[imei].content;
    markerContent.style.width = `${size.width}px`;
    markerContent.style.height = `${size.height}px`;
    markerContent.style.transform = `rotate(${rotation}deg)`;
    }
  } else {
    markers[imei] = createAdvancedMarker(latLng, iconUrl, rotation, vehicle);
    addHoverListenersForVehicle(imei);
  }

  lastDataReceivedTime[imei] = new Date();
  updateVehicleVisibility(imei);
  showHidecar();
}

// function removeSOS(imei) {
//   const popup = document.getElementById("sos-nearby-popup");
//   if (popup) popup.remove();

//   if (sosActiveMarkers[imei]) {
//     sosActiveMarkers[imei].remove();
//     delete sosActiveMarkers[imei];
//   }

//   const marker = markers[imei];
//   if (marker && marker.content) {
//     marker.content.classList.remove("vehicle-blink");
//   }

//   const vehicle = vehicleData.get(imei);
//   if (vehicle) {
//     vehicle.sos = "0";
//     vehicleData.set(imei, vehicle);
//   }

//   const vehiclesArray = Array.from(vehicleData.values());
//   renderVehicleCards(vehiclesArray);
// }

function removeSOS(imei) {
  const popup = document.getElementById("sos-nearby-popup");
  if (popup) popup.remove();

  if (sosActiveMarkers[imei]) {
    sosActiveMarkers[imei].remove();
    delete sosActiveMarkers[imei];
  }

  const marker = markers[imei];
  if (marker && marker.content) {
    marker.content.classList.remove("vehicle-blink");
    
    // Restore original icon
    const markerImage = marker.content.querySelector("img");
    if (markerImage && markerImage.dataset.originalSrc) {
      markerImage.src = markerImage.dataset.originalSrc;
    }
  }

  const vehicle = vehicleData.get(imei);
  if (vehicle) {
    vehicle.sos = "0";
    vehicle.sosActive = false;
    vehicleData.set(imei, vehicle);
  }

  // Update vehicle card
  updateVehicleCard(vehicle);
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

document.querySelector(".toggle-slider").addEventListener("click", function () {
  this.classList.toggle("active");

  if (this.classList.contains("active")) {
    document.querySelector(".toggle-option.map-option").classList.remove("active");
    document.querySelector(".toggle-option.list-option").classList.add("active");
    showListView();
  } else {
    document.querySelector(".toggle-option.map-option").classList.add("active");
    document.querySelector(".toggle-option.list-option").classList.remove("active");
    showMapView();
  }
});

function showMapView() {
  document.getElementById("map").style.display = "block";
  document.getElementById("vehicle-table-container").style.display = "none";
  document.querySelector(".floating-card").style.display = "block";
  document.querySelector(".icon-legend-container").style.display = "block";
  updateMap();
}

function showListView() {
  document.getElementById("map").style.display = "none";
  document.getElementById("vehicle-table-container").style.display = "block";
  document.querySelector(".floating-card").style.display = "none";
  document.querySelector(".icon-legend-container").style.display = "none";

  if (!document.getElementById("table-pagination")) {
    addPaginationControls();
  }

  populateVehicleTable();
}

function refreshLastUpdatedDisplay() {
  const now = new Date();
  document.querySelectorAll(".vehicle-card").forEach((card) => {
    const imei = card.getAttribute("data-imei");
    if (!imei) return;
    const vehicle = vehicleData.get(imei);
    if (!vehicle) return;

    const span = card.querySelector(".last-updated-text");
    if (span) {
      span.textContent = formatLastUpdatedText(
        vehicle.date,
        vehicle.time,
        now
      );
    }
  });

  document
    .querySelectorAll("#vehicle-table tbody tr")
    .forEach((row) => {
      const imei = row.getAttribute("data-imei");
      if (!imei) return;
      const vehicle = vehicleData.get(imei);
      if (!vehicle) return;

      const cell = row.querySelector(".last-updated-cell");
      if (cell) {
        cell.textContent = formatLastUpdatedText(
          vehicle.date,
          vehicle.time,
          now
        );
      }
    });
}

function formatLastUpdatedText(date, time, now = new Date()) {
  const lastUpdated = convertToDate(date, time);
  return formatLastUpdatedFromDate(lastUpdated, now);
}

function toggleRowSelection(row, imei) {
    if (selectedVehicles.has(imei)) {
        selectedVehicles.delete(imei);
        row.classList.remove('selected');
    } else {
        selectedVehicles.add(imei);
        row.classList.add('selected');
    }
    
    updateMultiShareButton();
}

function updateMultiShareButton() {
    let multiShareBtn = document.getElementById('multi-share-btn');
    
    if (!multiShareBtn && selectedVehicles.size > 0) {
        multiShareBtn = document.createElement('button');
        multiShareBtn.id = 'multi-share-btn';
        multiShareBtn.innerHTML = 'Share Selected Vehicles';
        multiShareBtn.style.position = 'fixed';
        multiShareBtn.style.bottom = '20px';
        multiShareBtn.style.right = '20px';
        multiShareBtn.style.zIndex = '1000';
        multiShareBtn.style.padding = '10px 15px';
        multiShareBtn.style.backgroundColor = '#388e3c';
        multiShareBtn.style.color = 'white';
        multiShareBtn.style.border = 'none';
        multiShareBtn.style.borderRadius = '5px';
        multiShareBtn.style.cursor = 'pointer';
        
        multiShareBtn.addEventListener('click', showMultiShareLocationPopup);
        document.body.appendChild(multiShareBtn);
    } else if (multiShareBtn && selectedVehicles.size === 0) {
        multiShareBtn.remove();
    }
}

function populateVehicleTable() {
  const tableBody = document
    .getElementById("vehicle-table")
    .getElementsByTagName("tbody")[0];
  tableBody.innerHTML = ""; 
  const isDarkMode = document.body.classList.contains("dark-mode");

  showHidecar();
  const listContainer = document.getElementById("vehicle-list");
  const countContainer = document.getElementById("vehicle-count");
  listContainer.innerHTML = "";
  resetVehicleCardCount();
  countContainer.innerText = vehicleData.size;

  vehicleData.forEach((vehicle, imei) => {
    const latitude = vehicle.latitude ? parseFloat(vehicle.latitude) : null;
    const longitude = vehicle.longitude ? parseFloat(vehicle.longitude) : null;

    const speedValue =
      vehicle.speed !== null && vehicle.speed !== undefined
        ? convertSpeedToKmh(vehicle.speed).toFixed(2)
        : null;

    const speed = speedValue !== null ? `${speedValue} km/h` : "Unknown";
    const address = vehicle.address || "Location unknown";
    const url = `/routeHistory/vehicle/${vehicle.LicensePlateNumber}`;

    const now = new Date();
    const lastUpdated = convertToDate(vehicle.date, vehicle.time);
    const timeDiff = Math.abs(now - lastUpdated);
    let statusText =  vehicle.status;

    const iconStyle = "font-size:22px;vertical-align:middle;margin-right:2px;";
    const iconRed = "color:#d32f2f;";
    const sosIcon =
      vehicle.sos === "1"
        ? `<span class="material-symbols-outlined" style="${
            iconStyle + iconRed
          }">sos</span>`
        : "";
    const gpsIcon =
      statusText === "Offline" ? "location_disabled" : "my_location";
    
    let ignitionIcon, ignitionColor;
    if (vehicle.ignition === "0" || vehicle.ignition === 0) {
      ignitionIcon = "key_off";
      ignitionColor = isDarkMode ? "#ff5252" : "#d32f2f";
    } else {
      ignitionIcon = "key";
      ignitionColor = isDarkMode ? "#4caf50" : "#2e7d32";
    }

    const ASUgsmValue = parseInt(vehicle.gsm);

    let gsmIcon, gsmColor;

    if (ASUgsmValue == 0) {
      gsmIcon = "signal_cellular_null";
      gsmColor = isDarkMode ? "#ff5252" : "#d32f2f"; 
    } else if (ASUgsmValue > 0 && ASUgsmValue <= 8) {
      gsmIcon = "signal_cellular_1_bar";
      gsmColor = isDarkMode ? "#ffb74d" : "#ff9800"; 
    } else if (ASUgsmValue > 8 && ASUgsmValue <= 16) {
      gsmIcon = "signal_cellular_2_bar";
      gsmColor = isDarkMode ? "#ffe082" : "#ffc107";
    } else if (ASUgsmValue > 16 && ASUgsmValue <= 24) {
      gsmIcon = "signal_cellular_3_bar";
      gsmColor = isDarkMode ? "#d4e157" : "#cddc39"; 
    } else if (ASUgsmValue > 24 && ASUgsmValue <= 32) {
      gsmIcon = "signal_cellular_4_bar";
      gsmColor = isDarkMode ? "#81c784" : "#4caf50"; 
    } else {
      gsmIcon = "signal_cellular_off";
      gsmColor = isDarkMode ? "#ff5252" : "#d32f2f"; 
    }    

    const row = tableBody.insertRow();
    row.setAttribute('data-imei', imei);
    row.style.cursor = "pointer";
    
    row.addEventListener('click', function(e) {
      // Ignore clicks on links or icon controls
      if (e.target.tagName && e.target.tagName.toLowerCase() === 'a') return;
      if (e.target.closest && e.target.closest('a')) return;
      if (e.target.closest && e.target.closest('.vehicle-table-icons')) return;
      if (e.target.classList && e.target.classList.contains('material-symbols-outlined')) return;

      if (selectMode) {
        // In selection mode, toggle selection of the row
        toggleRowSelection(this, imei);
      } else {
        // Not in selection mode: open vehicle details on single click
        try {
          window.open(url, '_blank');
        } catch (err) {
          console.error('Failed to open vehicle details:', err);
        }
      }
    });

    row.insertCell(0).innerText = vehicle.LicensePlateNumber
      ? vehicle.LicensePlateNumber
      : vehicle.imei;
    row.insertCell(1).innerText = vehicle.VehicleType;

    const lastUpdatedCell = row.insertCell(2);
    lastUpdatedCell.classList.add("last-updated-cell");
    lastUpdatedCell.innerText = formatLastUpdatedText(
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

    row.insertCell(7).innerText = vehicle.distance
      ? parseFloat(vehicle.distance).toFixed(2)
      : "N/A";
    row.insertCell(8).innerText = vehicle.odometer; 

    const icons = `
      <div class="vehicle-table-icons">
        ${sosIcon}
        <span class="material-symbols-outlined" style="${iconStyle}">${gpsIcon}</span>
        <span class="material-symbols-outlined" style="${iconStyle} color:${ignitionColor}">${ignitionIcon}</span>
        <span class="material-symbols-outlined" style="${iconStyle};color:${gsmColor};">${gsmIcon}</span>
      </div>
    `;
    row.insertCell(9).innerHTML = icons;

    row.addEventListener("dblclick", function (e) {
      if (e.target.tagName.toLowerCase() === "a") return;
      window.open(url, "_blank");
    });
  });
  
  selectedVehicles.clear();
  updateMultiShareButton();
  showHidecar();
}

function showMultiShareLocationPopup() {
    if (selectedVehicles.size === 0) {
        alert('Please select at least one vehicle');
        return;
    }

    const oldPopup = document.getElementById("multi-share-location-popup");
    if (oldPopup) oldPopup.remove();

    const popup = document.createElement("div");
    popup.id = "multi-share-location-popup";
    
    const selectedPlates = Array.from(selectedVehicles).map(imei => {
        const vehicle = vehicleData.get(imei);
        return vehicle.LicensePlateNumber;
    }).filter(plate => plate); 
    
    popup.innerHTML = `
    <div class="share-popup-content" style="min-width: 500px;">
      <h3>Share Live Location - Multiple Vehicles</h3>
      <div style="margin-bottom: 10px;">
        <strong>Selected Vehicles (${selectedPlates.length}):</strong> ${selectedPlates.join(', ')}
      </div>
      <div>
        <label for="multi-from-datetime">From:</label>
        <input type="datetime-local" id="multi-from-datetime" style="margin-bottom:8px; width: 100%;">
      </div>
      <div>
        <label for="multi-to-datetime">To:</label>
        <input type="datetime-local" id="multi-to-datetime" style="margin-bottom:8px; width: 100%;">
      </div>
      <button id="generate-multi-share-link" style="background:#388e3c;color:#fff; padding: 8px 16px;">Generate Share Link</button>
      <div style="margin-top:10px;">
        <input id="multi-share-link-input" type="text" readonly style="width:100%; padding: 8px;" placeholder="Single share link will appear here...">
        <button id="copy-multi-link" style="margin-top:5px; padding: 5px 10px; background:#1976d2; color:white; border:none; border-radius:3px; cursor:pointer;">Copy Link</button>
      </div>
      <button id="close-multi-share-popup" style="margin-top:10px;background:#aaa;color:#fff;">Close</button>
    </div>
  `;
  
  document.body.appendChild(popup);

  popup.style.position = "fixed";
  popup.style.left = "50%";
  popup.style.top = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.zIndex = "9999";
  popup.style.backgroundColor = "white";
  popup.style.padding = "20px";
  popup.style.borderRadius = "8px";
  popup.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  popup.style.maxWidth = "90%";
  popup.style.maxHeight = "90%";
  popup.style.overflow = "auto";

  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  const toISOStringLocal = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  document.getElementById("multi-from-datetime").value = toISOStringLocal(now);
  const toDate = new Date(now.getTime() + 15 * 60000);
  document.getElementById("multi-to-datetime").value = toISOStringLocal(toDate);

  document.getElementById("close-multi-share-popup").onclick = () => {
    popup.remove();
    selectedVehicles.clear();
    document.querySelectorAll('#vehicle-table tbody tr.selected').forEach(row => {
        row.classList.remove('selected');
    });
    updateMultiShareButton();
  };

  document.getElementById("copy-multi-link").onclick = function() {
    const input = document.getElementById("multi-share-link-input");
    input.select();
    document.execCommand("copy");
    displayFlashMessage("Link copied to clipboard!", "success");
  };

  document.getElementById("generate-multi-share-link").onclick = async function () {
    const from_datetime = document.getElementById("multi-from-datetime").value;
    const to_datetime = document.getElementById("multi-to-datetime").value;
    const input = document.getElementById("multi-share-link-input");
    input.value = "Generating share link...";

    if (!from_datetime || !to_datetime) {
      input.value = "Please select both date and time.";
      return;
    }

    try {
      const selectedPlates = Array.from(selectedVehicles).map(imei => {
        const vehicle = vehicleData.get(imei);
        return vehicle.LicensePlateNumber;
      }).filter(plate => plate);

      const res = await fetch(`/shareLocation/share-multiple-locations`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        },
        body: JSON.stringify({
          LicensePlateNumbers: selectedPlates,
          from_datetime,
          to_datetime,
        }),
      });
      
      const data = await res.json();
      if (data.link) {
        input.value = data.link;
      } else {
        input.value = data.error || 'Failed to generate share link';
      }
    } catch (e) {
      input.value = "Failed to generate share link: " + e.message;
    }
  };
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

  map = new Map(document.getElementById("map"), {
    center: newCenter,
    mapId: mapId,
    zoom: 5,
    gestureHandling: "greedy",
    zoomControl: true,
    mapTypeControl: false, 
    clickableIcons: false, 
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

const themeToggle = document.getElementById("theme-toggle");
themeToggle.addEventListener("click", function () {
  setTimeout(async () => {
    await initMap();
    updateMap();
  }, 100);
});

function adjustFloatingCardHeight() {
  const floatingCard = document.querySelector(".floating-card");
  const mapHeight = document.getElementById("map").offsetHeight;
  floatingCard.style.height = `${mapHeight * 0.6}px`; 
}

function getVehicleIconSize(vehicleType) {
  switch(vehicleType.toLowerCase()) {
    case 'truck':
      return { width: 24, height: 80 }; 
    case 'bus':
      return { width: 35, height: 80 }; 
    case 'bike':
      return { width: 21, height: 56 }; 
    default: 
      return { width: 29, height: 56 }; 
  }
}

function createAdvancedMarker(latLng, iconUrl, rotation, device) {
  if (!(latLng instanceof google.maps.LatLng)) {
    latLng = new google.maps.LatLng(latLng.lat, latLng.lng);
  }

  const vehicleType = device.VehicleType || 'car';
  const size = getVehicleIconSize(vehicleType);
  
  const markerContent = document.createElement("div");
  markerContent.className = "custom-marker";
  markerContent.style.width = `${size.width}px`;
  markerContent.style.height = `${size.height}px`;
  markerContent.style.transform = `rotate(${rotation}deg)`;

  const markerImage = document.createElement("img");
  markerImage.src = iconUrl;
  markerImage.alt = "Vehicle Icon";
  markerImage.style.width = "100%";
  markerImage.style.height = "100%";
  markerImage.style.display = "block";

  markerContent.appendChild(markerImage);

  const marker = new google.maps.marker.AdvancedMarkerElement({
    position: latLng, 
    map: map,
    title: `License Plate Number: ${device.LicensePlateNumber}`,
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
  if (!(latLng instanceof google.maps.LatLng)) {
    latLng = new google.maps.LatLng(latLng.lat, latLng.lng);
  }

  const vehicleType = marker.device.VehicleType || 'car';
  const size = getVehicleIconSize(vehicleType);

  const markerContent = document.createElement("div");
  markerContent.className = "custom-marker";
  markerContent.style.width = `${size.width}px`;
  markerContent.style.height = `${size.height}px`;
  markerContent.style.transform = `rotate(${rotation}deg)`;

  const markerImage = document.createElement("img");
  markerImage.src = iconUrl;
  markerImage.alt = "Vehicle Icon";
  markerImage.style.width = "100%";
  markerImage.style.height = "100%";
  markerImage.style.display = "block";

  markerContent.appendChild(markerImage);

  marker.position = latLng; 
  marker.content = markerContent;

  const coords = {
    lat: latLng.lat(),
    lon: latLng.lng(),
  };
  addMarkerClickListener(marker, latLng, marker.device, coords);
}

function searchTable() {
  const searchTerm = document
    .getElementById("table-vehicle-search")
    .value.trim()
    .toLowerCase();
  const tableRows = document.querySelectorAll("#vehicle-table tbody tr");

  tableRows.forEach((row) => {
    const plateNumber = row.cells[0].textContent.toLowerCase();
    if (plateNumber.includes(searchTerm)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

function searchVehicle() {
  const searchTerm = document
    .getElementById("vehicle-search")
    .value.trim()
    .toLowerCase();
  if (!searchTerm) return;

  let foundVehicle = null;

  vehicleData.forEach((vehicle, imei) => {
    const plateNumber = vehicle.LicensePlateNumber
      ? vehicle.LicensePlateNumber.toLowerCase()
      : "";
    if (plateNumber.includes(searchTerm)) {
      foundVehicle = vehicle;
    }
  });

  if (foundVehicle) {
    const latLng = new google.maps.LatLng(
      parseFloat(foundVehicle.latitude),
      parseFloat(foundVehicle.longitude)
    );
    map.setZoom(18);
    map.panTo(latLng);

    const marker = markers[foundVehicle.imei];
    if (marker) {
      setInfoWindowContent(
        infoWindow,
        marker,
        latLng,
        foundVehicle,
        foundVehicle.address || "Location unknown"
      );
      infoWindow.open(map, marker);
    }

    const vehicleCard = document.querySelector(
      `.vehicle-card[data-imei="${foundVehicle.imei}"]`
    );
    if (vehicleCard) {
      vehicleCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      vehicleCard.classList.add("highlight");
      setTimeout(() => vehicleCard.classList.remove("highlight"), 2000);
    }
  } else {
    alert("Vehicle not found");
  }
}

document
  .getElementById("search-button")
  .addEventListener("click", searchVehicle);
document.getElementById("vehicle-search").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    searchVehicle();
  }
});

function panToWithOffset(latLng, offsetX = -50, offsetY = 0) {
  const scale = Math.pow(2, map.getZoom()); 
  const worldCoordinateCenter = map.getProjection().fromLatLngToPoint(latLng);

  const pixelOffset = new google.maps.Point(offsetX / scale, offsetY / scale);
  const worldCoordinateNewCenter = new google.maps.Point(
    worldCoordinateCenter.x + pixelOffset.x,
    worldCoordinateCenter.y + pixelOffset.y
  );

  const newLatLng = map
    .getProjection()
    .fromPointToLatLng(worldCoordinateNewCenter);
  map.panTo(newLatLng);
}

function highlightVehicleCardStyles(vehicleCard) {
  if (!vehicleCard) return;

  vehicleCard.classList.add("highlight");
  const isDarkMode = document.body.classList.contains("dark-mode");

  const vehicleNumber = vehicleCard.querySelector(".vehicle-number");
  const locationText = vehicleCard.querySelector(".location-text");
  const lastUpdatedText = vehicleCard.querySelector(".last-updated-text");
  const strongElements = vehicleCard.querySelectorAll("strong");

  if (isDarkMode) {
    vehicleCard.style.backgroundColor = "#555";
    vehicleCard.style.color = "#fff";
    if (vehicleNumber) vehicleNumber.style.color = "#fff";
    if (locationText) locationText.style.color = "#ccc";
    if (lastUpdatedText) lastUpdatedText.style.color = "#aaa";
    strongElements.forEach((tag) => (tag.style.color = "#fff"));
  } else {
    vehicleCard.style.backgroundColor = "#ccc";
    vehicleCard.style.color = "#333";
    if (vehicleNumber) vehicleNumber.style.color = "#000";
    if (locationText) locationText.style.color = "#666";
    if (lastUpdatedText) lastUpdatedText.style.color = "#222";
    strongElements.forEach((tag) => (tag.style.color = "#000"));
  }
}

function resetVehicleCardStyles(vehicleCard) {
  if (!vehicleCard) return;

  vehicleCard.classList.remove("highlight");
  vehicleCard.style.transition =
    "background-color 0.3s ease-in-out, color 0.3s ease-in-out";
  vehicleCard.style.backgroundColor = "";
  vehicleCard.style.color = "";

  const vehicleNumber = vehicleCard.querySelector(".vehicle-number");
  const locationText = vehicleCard.querySelector(".location-text");
  const lastUpdatedText = vehicleCard.querySelector(".last-updated-text");
  const strongElements = vehicleCard.querySelectorAll("strong");

  if (vehicleNumber) vehicleNumber.style.color = "";
  if (locationText) locationText.style.color = "";
  if (lastUpdatedText) lastUpdatedText.style.color = "";
  strongElements.forEach((tag) => (tag.style.color = ""));
}

function addHoverListenersForVehicle(imei) {
  const card = document.querySelector(`.vehicle-card[data-imei="${imei}"]`);
  const marker = markers[imei];

  if (card && card.dataset.hoverBound !== "true") {
    card.dataset.hoverBound = "true";
    card.addEventListener("mouseover", () => {
      const currentMarker = markers[imei];
      if (!currentMarker) return;

      const latLng = new google.maps.LatLng(
        currentMarker.position.lat,
        currentMarker.position.lng
      );
      map.setZoom(19);
      panToWithOffset(latLng, -200, 0);

      const address = currentMarker.device.address || "Location unknown";
      setInfoWindowContent(
        infoWindow,
        currentMarker,
        latLng,
        currentMarker.device,
        address
      );
      infoWindow.open(map, currentMarker);
    });

    card.addEventListener("mouseout", () => {
      infoWindow.close();
    });
  }

  if (marker && !marker.__hoverListenersBound) {
    marker.__hoverListenersBound = true;

    marker.addEventListener("mouseover", () => {
      const vehicleCard = document.querySelector(
        `.vehicle-card[data-imei="${imei}"]`
      );
      if (!vehicleCard) return;

      vehicleCard.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      highlightVehicleCardStyles(vehicleCard);
    });

    marker.addEventListener("mouseout", () => {
      const vehicleCard = document.querySelector(
        `.vehicle-card[data-imei="${imei}"]`
      );
      resetVehicleCardStyles(vehicleCard);
    });
  }
}

window.applyFilterToAllVehicles = applyFilterToAllVehicles;

window.onload = async function () {
  document.querySelector(".block-container").style.display = "none";
  await initMap();
  await fetchVehicleData(1);
  updateMap();

  hideSkeletonLoader();

  document
    .getElementById("table-search-button")
    .addEventListener("click", searchTable);
  document
    .getElementById("table-vehicle-search")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        searchTable();
      }
    });

  startHybridLastUpdatedLoop();
};