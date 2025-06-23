window.onload = async () => {
  await backgroundMap();
  await initMap();
  await initialLiveMap();
};

const dataElement = document.getElementById("vehicle-data");
const vehicleData = JSON.parse(dataElement.textContent);


document.addEventListener("DOMContentLoaded", async function () {
  console.log("Connected to the socket server");
  const licensePlateNumber = vehicleData["License Plate Number"] || null;
  console.log(vehicleData);
  if (licensePlateNumber) {
    socket.emit("subscribe_vehicle_updates", {
      LicensePlateNumber: licensePlateNumber,
    });
  }
});

socket.on("subscription_success", (data) => {
  console.log("Subscription successful:", data);
});

socket.on("subscription_error", (error) => {
  console.error("Subscription error:", error);
});

socket.on("vehicle_live_update", (data) => {
  updateLiveMapVehicleData(data);
  updateLiveMapPolyline(data);
  console.log("Vehicle live update:", data);
});

function liveTracking() {
  document.getElementById("live-map-container").style.display = "block";
  document.getElementById("route-history-container").style.display = "none";
}

function routeHistory() {
  document.getElementById("live-map-container").style.display = "none";
  document.getElementById("route-history-container").style.display = "block";
}

function animateMarker(newPosition, duration = 60000, marker = markerLive) {
  let startPosition = liveCoords[liveCoords.length - 1];

  if (!startPosition) {
    console.error("Marker's start position is not defined.");
    return;
  }
  const startTime = performance.now();

  function moveMarker(currentTime) {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    const lat =
      startPosition.lat + (newPosition.lat - startPosition.lat) * progress;
    const lng =
      startPosition.lng + (newPosition.lng - startPosition.lng) * progress;

    marker.position = new google.maps.LatLng(lat, lng);

    if (progress < 1) {
      requestAnimationFrame(moveMarker);
    }
  }

  requestAnimationFrame(moveMarker);
}

function getStatus(ignition, speed) {
  if (ignition === "1") {
    if (speed > 0) {
      return "Moving";
    } else {
      return "Idle";
    }
  } else {
    return "Stopped";
  }
}

function getStatusTime(timeDelta) {
  let totalSeconds = Math.floor(timeDelta / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  totalSeconds %= 24 * 3600;
  const hours = Math.floor(totalSeconds / 3600);
  const remainder = totalSeconds % 3600;
  const minutes = Math.floor(remainder / 60);
  const seconds = remainder % 60;

  if (days > 0) {
    return `${days} days, ${hours} hours`;
  } else if (hours > 0) {
    return `${hours} hours, ${minutes} minutes`;
  } else if (minutes > 0) {
    return `${minutes} minutes, ${seconds} seconds`;
  } else {
    return `${seconds} seconds`;
  }
}

function updateLiveMapVehicleData(updatedData) {
  const updateCoords = {
    lat: parseFloat(updatedData.latitude),
    lng: parseFloat(updatedData.longitude),
  };

  const status = getStatus(updatedData.ignition, updatedData.speed);
  const oldData = liveData[liveCoords.length - 1];
  const rotation = updatedData.course;
  updatedData["status"] = status;

  let statusTime;
  console.log("Old Data:", oldData);
  console.log(oldData.status === status, status, oldData.status);
  if (oldData.status === status) {
    console.log(oldData.status_time_delta);
    const timeDelta =
      oldData.status_time_delta +
      (new Date(updatedData.date_time) - new Date(oldData.date_time));
    console.log(timeDelta);
    statusTime = getStatusTime(timeDelta);
    updatedData.status_time = statusTime;
    updatedData.status_time_delta = timeDelta;
  } else {
    statusTime = `0 seconds`;
    updatedData.status_time = statusTime;
    updatedData.status_time_delta = "0";
  }
  const address = updatedData.address;
  let speed = null;

  if (status === "Moving") {
    speed = `<p><strong>Speed:</strong> ${updatedData.speed}</p>`;
  }

  const carContent = document.createElement("img");
  carContent.src = "/static/images/car_green.png";
  carContent.style.width = "18px";
  carContent.style.height = "32px";
  carContent.style.position = "absolute";
  carContent.alt = "Car";
  carContent.style.transform = `rotate(${rotation}deg)`;

  markerLive.content = carContent;

  startMarkerInfo = new google.maps.InfoWindow({
    content: `<div>
            <h3>${vehicleData["License Plate Number"] || null}</h3>
            ${speed || ""}
            <p><strong>Location:</strong> ${address}</p>
            <p>${status} since ${statusTime}</p>
          </div>`,
  });

  markerLive.addListener("gmp-click", () => {
    startMarkerInfo.open({
      anchor: markerLive,
      map: liveMaps,
    });
  });

  liveData.push(updatedData);

  animateMarker(updateCoords);
}

let liveMarkersArray = [];

function updateLiveMapPolyline(updatedData) {
  const updateCoords = {
    lat: parseFloat(updatedData.latitude),
    lng: parseFloat(updatedData.longitude),
  };

  liveCoords.push(updateCoords);

  const bounds = new google.maps.LatLngBounds();
  liveCoords.forEach((coord) => bounds.extend(coord));
  liveMaps.fitBounds(bounds);
  liveMaps.setCenter(updateCoords);

  const darkMode = document.body.classList.contains("dark-mode");
  const arrowColor = darkMode ? "#fff" : "#2a2a2a";

  liveMarkersArray.forEach((marker) => marker.map = null);
  liveMarkersArray = [];

  for (let i = 0; i < liveCoords.length; i++) {
    const coord = liveCoords[i];
    let direction = rotation || 0;
    if (i < liveCoords.length - 1) {
      const nextCoord = liveCoords[i + 1];
      direction = getRotation(nextCoord, coord);
    }
    // For the last coord, rotation stays as 0 or you can use previous rotation

    const arrowContent = document.createElement("div");
    arrowContent.style.width = "10px";
    arrowContent.style.height = "10px";
    arrowContent.style.backgroundColor = "rgba(204, 204, 204, 0.2)";
    arrowContent.style.borderTop = `10px solid ${arrowColor}`;
    arrowContent.style.borderLeft = "5px solid transparent";
    arrowContent.style.borderRight = "5px solid transparent";
    arrowContent.style.position = "absolute";
    arrowContent.style.transform = `rotate(${direction}deg)`;

    const liveMarkers = new google.maps.marker.AdvancedMarkerElement({
      position: coord,
      map: liveMaps,
      title: "Arrow",
      content: arrowContent,
    });

    liveMarkersArray.push(liveMarkers);

  }

  livePathPolyline.setPath(liveCoords);
}

function getRotation(coord, nextCoord) {
  // Convert degrees to radians
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;

  const lat1 = toRad(coord.lat);
  const lon1 = toRad(coord.lng);
  const lat2 = toRad(nextCoord.lat);
  const lon2 = toRad(nextCoord.lng);

  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let brng = Math.atan2(y, x);
  brng = toDeg(brng);
  return (brng + 360) % 360; // Normalize to 0-360
}

async function plotPolyLineLiveMap(liveData) {
  if (liveData.length > 0) {
    liveCoords = liveData.map((item) => ({
      lat: parseFloat(item.latitude),
      lng: parseFloat(item.longitude),
    }));

    const bounds = new google.maps.LatLngBounds();
    liveCoords.forEach((coord) => bounds.extend(coord));
    liveMaps.fitBounds(bounds);

    const recentData = liveData[liveData.length - 1];

    const status = recentData.status;
    const statusTime = recentData.status_time;
    const address = recentData.address;
    const rotation = recentData.course;
    let speed = null;

    if (status === "Moving") {
      speed = `<p><strong>Speed:</strong> ${recentData.speed}</p>`;
    }

    // Detect dark mode
    const darkMode = document.body.classList.contains("dark-mode");
    const arrowColor = darkMode ? "#fff" : "#2a2a2a";
    const polylineColor = darkMode ? "#00bfff" : "#505050";

    livePathPolyline = new google.maps.Polyline({
      path: liveCoords,
      geodesic: true,
      strokeColor: polylineColor,
      strokeOpacity: 0.9,
      strokeWeight: 3,
      map: liveMaps,
    });

    const carContent = document.createElement("img");
    carContent.src = "/static/images/car_green.png";
    carContent.style.width = "18px";
    carContent.style.height = "32px";
    carContent.style.position = "absolute";
    carContent.alt = "Car";
    carContent.style.filter = darkMode ? "brightness(1.5)" : ""; // brighten in dark mode
    carContent.style.transform = `rotate(${rotation}deg)`;

    markerLive = new google.maps.marker.AdvancedMarkerElement({
      position: liveCoords[liveCoords.length - 1],
      map: liveMaps,
      title: "Start",
      content: carContent,
    });

    for (let i = 0; i < liveCoords.length; i++) {
      const coord = liveCoords[i];
      let direction = rotation || 0;
      if (i < liveCoords.length - 1) {
        const nextCoord = liveCoords[i + 1];
        direction = getRotation(nextCoord, coord);
      }
      // For the last coord, rotation stays as 0 or you can use previous rotation

      const arrowContent = document.createElement("div");
      arrowContent.style.width = "10px";
      arrowContent.style.height = "10px";
      arrowContent.style.backgroundColor = "rgba(204, 204, 204, 0.2)";
      arrowContent.style.borderTop = `10px solid ${arrowColor}`;
      arrowContent.style.borderLeft = "5px solid transparent";
      arrowContent.style.borderRight = "5px solid transparent";
      arrowContent.style.position = "absolute";
      arrowContent.style.transform = `rotate(${direction}deg)`;

      const liveMarkers = new google.maps.marker.AdvancedMarkerElement({
        position: coord,
        map: liveMaps,
        title: "Arrow",
        content: arrowContent,
      });

      liveMarkersArray.push(liveMarkers);
    }

    startMarkerInfo = new google.maps.InfoWindow({
      content: `<div>
              <h3>${vehicleData["License Plate Number"] || ""}</h3>
              ${speed || ""}
              <p><strong>Location:</strong> ${address}</p>
              <p>${status} since ${statusTime}</p>
            </div>`,
    });

    markerLive.addListener("gmp-click", () => {
      startMarkerInfo.open({
        anchor: markerLive,
        map: liveMaps,
      });
    });
  } else {
    console.log("No live data available");
  }
}

async function initialLiveMap() {
  await google.maps.importLibrary("maps");
  await google.maps.importLibrary("marker");

  const liveDataURl = `/routeHistory/vehicle/${vehicleData.IMEI}/liveData`;

  fetch(liveDataURl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(async (data) => {
      liveData = data;
      await plotPolyLineLiveMap(liveData);
    })
    .catch((error) => {
      console.error("Error fetching live data:", error);
    });
}

async function getAddressFromCoordinates(lat, lng) {
  try {
    const response = await fetch("/geocode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({ lat, lng }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data.address; 
  } catch (error) {
    console.error("Error fetching address:", error);
    return null;
  }
}

const themeToggle = document.getElementById("theme-toggle");
themeToggle.addEventListener("click", function () {
  setTimeout(async () => {
    await initMap();
    await initialLiveMap();
    if (coords.length > 0) {
      const form = document.getElementById("vehicle-form");
      const submitEvent = new Event("submit", {
        bubbles: true,
        cancelable: true,
      });
      form.dispatchEvent(submitEvent);
    }
  }, 100);
});

document.addEventListener("DOMContentLoaded", async () => {
  liveTracking();
  const recentdataElement = document.getElementById("recent-data");
  const recentData = JSON.parse(recentdataElement.textContent);
  const labels = recentData.map((data) => data.time);
  const speeds = recentData.map((data) => data.speed); 

  const ctx = document.getElementById("speedChart").getContext("2d");
  const speedChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Speed (km/h)",
          data: speeds, 
          borderColor: "rgba(0, 122, 255, 1)",
          backgroundColor: "rgba(0, 122, 255, 0.2)",
          borderWidth: 2,
          fill: true,
        },
      ],
    },
    options: {
      scales: {
        x: {
          title: {
            display: true,
            text: "Time",
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Speed (km/h)",
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "white", 
          },
        },
      },
    },
  });
});

let map;
let liveMaps;
let pathCoordinates = [];
let coords = [];
let liveCoords = [];
let liveData = [];
let startMarkerInfo = null;
let carMarker;
let markerLive;
let pathPolyline;
let livePathPolyline;
let startMarker;
let endMarker;
let currentIndex = 0;
let animationInterval = null;
let speedMultiplier = 1;
let timelineSlider;
let sliderTimeDisplay;

async function initMap() {
  const { Map, LatLng } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  await google.maps.importLibrary("geometry");

  timelineSlider = document.getElementById("timeline-slider");
  sliderTimeDisplay = document.getElementById("slider-time");

  const darkMode = document.body.classList.contains("dark-mode");

  const mapId = darkMode ? "e426c1ad17485d79" : "dc4a8996aab2cac9";

  liveMaps = new Map(document.getElementById("live-map"), {
    zoom: 8,
    center: { lat: 12.9716, lng: 77.5946 },
    mapId: mapId,
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

  map = new Map(document.getElementById("map"), {
    zoom: 8,
    center: { lat: 12.9716, lng: 77.5946 },
    mapId: mapId,
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

  document
    .getElementById("play-button")
    .addEventListener("click", startCarAnimation);
  document
    .getElementById("resume-button")
    .addEventListener("click", resumeCarAnimation);
  document
    .getElementById("stop-button")
    .addEventListener("click", stopCarAnimation);
  document
    .getElementById("speed-2x-button")
    .addEventListener("click", () => setSpeed(2));
  document
    .getElementById("speed-4x-button")
    .addEventListener("click", () => setSpeed(4));
  document
    .getElementById("speed-8x-button")
    .addEventListener("click", () => setSpeed(8));
}

function handleSliderInput() {
  const index = parseInt(this.value);
  currentIndex = index;
  stopCarAnimation();
  updateCarPosition(index);
}

document
  .getElementById("vehicle-form")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    const userEnteredImei = document.getElementById("imei").value.trim();

    if (!/^\d+$/.test(userEnteredImei)) {
      alert("Please enter a valid numeric IMEI number.");
      return;
    }

    const start_date = formatDateToDB(
      document.getElementById("start_date").value
    );
    const end_date = formatDateToDB(document.getElementById("end_date").value);

    const fetchUrl = `/routeHistory/get_vehicle_path?imei=${userEnteredImei}&start_date=${start_date}&end_date=${end_date}`;

    fetch(fetchUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.length > 0) {
          pathCoordinates = data.map((item) => ({
            LicensePlateNumber: item.LicensePlateNumber,
            lat: item.latitude,
            lng: item.longitude,
            time: item.time,
            speed: item.speed,
            ignition: item.ignition,
            course: item.course,
          }));
          plotPathOnMap(pathCoordinates);
        } else {
          alert("No path data found for the given IMEI and date range.");
        }
      })
      .catch((error) => {
        console.error("Error fetching path data:", error);
        alert(
          "Error fetching path data. Please check the console for details."
        );
      });
  });

function formatDateToDB(dateString) {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString().slice(2);
  return `${day}${month}${year}`;
}

function interpolateTime(index, originalData) {
  if (index < originalData.length) return originalData[index].time;
  const lastPoint = originalData[originalData.length - 1];
  return new Date(
    lastPoint.time.getTime() + (index - originalData.length + 1) * 60000
  ).toISOString();
}

function interpolateSpeed(index, originalData) {
  if (index < originalData.length) return originalData[index].speed;
  return originalData[originalData.length - 1].speed;
}

let deckOverlay;
let deckLayers = [];
let deckInitialized = false;
let carIconUrl = "/static/images/car_green.png";

async function plotPathOnMap(pathCoordinates) {
  if (window.__allMapMarkers && Array.isArray(window.__allMapMarkers)) {
    window.__allMapMarkers.forEach((marker) => {
      if (marker && marker.map) marker.map = null;
    });
    window.__allMapMarkers = [];
  } else {
    window.__allMapMarkers = [];
  }

  if (deckOverlay) {
    deckOverlay.setProps({ layers: [] });
    deckOverlay.setMap(null);
    deckOverlay = null;
  }

  timelineSlider.addEventListener("input", handleSliderInput);
  if (pathPolyline) pathPolyline.setMap(null);
  if (startMarker) startMarker.map = null;
  if (endMarker) endMarker.map = null;
  if (carMarker) carMarker.map = null; 

  coords = pathCoordinates.map((item) => ({ lat: item.lat, lng: item.lng }));
  if (coords.length === 0) return;

  const bounds = new google.maps.LatLngBounds();
  coords.forEach(({ lat, lng }) =>
    bounds.extend(new google.maps.LatLng(lat, lng))
  );
  map.fitBounds(bounds);

  timelineSlider.min = 0;
  timelineSlider.max = coords.length - 1;
  timelineSlider.value = 0;
  sliderTimeDisplay.textContent = pathCoordinates[0].time;

  const deckCoords = coords.map(({ lat, lng }) => [lng, lat]);

  const pathLayer = new deck.PathLayer({
    id: "route-path",
    data: [{ path: deckCoords }],
    getPath: (d) => d.path,
    getWidth: 6,
    getColor: [80, 80, 80, 230],
    widthMinPixels: 3,
    widthMaxPixels: 8,
    jointRounded: true,
    capRounded: true,
    pickable: false,
  });

  deckOverlay = new deck.GoogleMapsOverlay({
    layers: [pathLayer],
  });
  deckOverlay.setMap(map);

  deckLayers = [pathLayer];
  deckInitialized = true;

  const carContent = document.createElement("img");
  carContent.src = "/static/images/car_green.png";
  carContent.style.width = "18px";
  carContent.style.height = "32px";
  carContent.style.position = "absolute";
  carContent.alt = "Car";
  carContent.style.transform = `rotate(${pathCoordinates[0].course || 0}deg)`;

  carMarker = new google.maps.marker.AdvancedMarkerElement({
    position: coords[0],
    map: map,
    title: "Vehicle",
    content: carContent,
  });
  window.__allMapMarkers.push(carMarker);

  const startContent = document.createElement("div");
  startContent.style.backgroundColor = "green";
  startContent.style.color = "white";
  startContent.style.padding = "5px";
  startContent.style.borderRadius = "5px";
  startContent.textContent = "Start";

  const endContent = document.createElement("div");
  endContent.style.backgroundColor = "red";
  endContent.style.color = "white";
  endContent.style.padding = "5px";
  endContent.style.borderRadius = "5px";
  endContent.textContent = "End";

  startMarker = new google.maps.marker.AdvancedMarkerElement({
    position: coords[0], 
    map: map,
    title: "Start",
    content: startContent,
  });
  window.__allMapMarkers.push(startMarker);

  const startIgnition = pathCoordinates[0].ignition === "1" ? "On" : "Off";
  const startLocation = await getAddressFromCoordinates(
    pathCoordinates[0].lat,
    pathCoordinates[0].lng
  );

  const startMarkerInfo = new google.maps.InfoWindow({
    content: `<div>
                <h3>${pathCoordinates[0].LicensePlateNumber}</h3>
                <p><strong>Location:</strong> ${startLocation}</p>
                <p><strong>Timestamp:</strong> ${pathCoordinates[0].time}</p>
                <p><strong>Speed:</strong> ${pathCoordinates[0].speed}</p>
                <p><strong>Ignition:</strong> ${startIgnition}</p>
              </div>`,
  });

  startMarker.addListener("gmp-click", () => {
    startMarkerInfo.open({
      anchor: startMarker,
      map: map,
    });
  });

  endMarker = new google.maps.marker.AdvancedMarkerElement({
    position: coords[coords.length - 1], 
    map: map,
    title: "End",
    content: endContent,
  });
  window.__allMapMarkers.push(endMarker);

  const endIgnition =
    pathCoordinates[pathCoordinates.length - 1].ignition === "1" ? "On" : "Off";
  const endLocation = await getAddressFromCoordinates(
    pathCoordinates[pathCoordinates.length - 1].lat,
    pathCoordinates[pathCoordinates.length - 1].lng
  );

  const endMarkerInfo = new google.maps.InfoWindow({
    content: `<div>
                <h3>${
                  pathCoordinates[pathCoordinates.length - 1].LicensePlateNumber
                }</h3>
                <p><strong>Location:</strong> ${endLocation}</p>
                <p><strong>Timestamp:</strong> ${
                  pathCoordinates[pathCoordinates.length - 1].time
                }</p>
                <p><strong>Speed:</strong> ${
                  pathCoordinates[pathCoordinates.length - 1].speed
                }</p>
                <p><strong>Ignition:</strong> ${endIgnition}</p>
              </div>`,
  });

  endMarker.addListener("gmp-click", () => {
    endMarkerInfo.open({
      anchor: endMarker,
      map: map,
    });
  });

  for (let index = 0; index < coords.length - 1; index++) {
    const coord = coords[index];
    const nextCoord = coords[index + 1];
    const pathCoord = pathCoordinates[index];

    const arrowContent = document.createElement("div");
    arrowContent.style.width = "10px";
    arrowContent.style.height = "10px";
    arrowContent.style.backgroundColor = "rgba(204, 204, 204, 0.2)";
    arrowContent.style.borderTop = "10px solid #2a2a2a";
    arrowContent.style.borderLeft = "5px solid transparent";
    arrowContent.style.borderRight = "5px solid transparent";
    arrowContent.style.position = "absolute";
    arrowContent.style.transform = `rotate(${calculateBearingGoogle(
      nextCoord,coord
    )}deg)`;

    const marker = new google.maps.marker.AdvancedMarkerElement({
      position: coord, 
      map: map,
      title: "Arrow",
      content: arrowContent,
    });
    window.__allMapMarkers.push(marker);

    const ignition = pathCoord.ignition === "1" ? "On" : "Off";

    const infoWindow = new google.maps.InfoWindow({
      content: `<div>
                <h3>${pathCoord.LicensePlateNumber}</h3>
                <p><strong>Timestamp:</strong> ${pathCoord.time}</p>
                <p><strong>Speed:</strong> ${pathCoord.speed}</p>
                <p><strong>Ignition:</strong> ${ignition}</p>
              </div>`,
    });

    marker.addListener("gmp-click", () => {
      infoWindow.open({
        anchor: marker,
        map: map,
      });
    });
  }
}

function updateCarPosition(index) {
  if (!coords.length || !carMarker) return;
  const point = coords[index];

  const prev = coords[Math.max(0, index - 1)];
  const bearing = calculateBearing(
    prev,
    point
  );

  carMarker.position = point;
  if (carMarker.content) {
    carMarker.content.style.transform = `rotate(${bearing}deg)`;
  }

  const carLatLng = new google.maps.LatLng(point.lat, point.lng);
  const bounds = map.getBounds();
  if (bounds && !bounds.contains(carLatLng)) {
    map.panTo(carLatLng);
  }
  sliderTimeDisplay.textContent = pathCoordinates[index].time;
}

function moveCar() {
  if (currentIndex < pathCoordinates.length - 1) {
    timelineSlider.value = currentIndex;
    sliderTimeDisplay.textContent = pathCoordinates[currentIndex].time;

    const start = coords[currentIndex];
    const end = coords[currentIndex + 1];
    const stepDuration = 20 / speedMultiplier;
    const steps = Math.floor(
      google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(start.lat, start.lng),
        new google.maps.LatLng(end.lat, end.lng)
      ) / 10
    );
    let stepIndex = 0;
    const latDiff = (end.lat - start.lat) / steps;
    const lngDiff = (end.lng - start.lng) / steps;

    function animateStep() {
      if (stepIndex < steps) {
        const lat = start.lat + latDiff * stepIndex;
        const lng = start.lng + lngDiff * stepIndex;
        const nextLat = start.lat + latDiff * (stepIndex + 1);
        const nextLng = start.lng + lngDiff * (stepIndex + 1);

        const isLastStep = stepIndex >= steps - 1;
        const stepBearing = isLastStep
          ? calculateBearing({ lat, lng }, { lat: end.lat, lng: end.lng })
          : calculateBearing({ lat, lng }, { lat: nextLat, lng: nextLng });

        if (carMarker) {
          carMarker.position = { lat, lng };
          if (carMarker.content) {
            carMarker.content.style.transform = `rotate(${stepBearing}deg)`;
          }
        }

        const bounds = map.getBounds();
        if (bounds && !bounds.contains(new google.maps.LatLng(lat, lng))) {
          map.panTo({ lat, lng });
        }
        stepIndex++;
        animationInterval = setTimeout(animateStep, stepDuration);
      } else {
        currentIndex++;
        clearTimeout(animationInterval);
        moveCar();
      }
    }
    animateStep();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const imei = vehicleData.IMEI;

  if (imei) {
    fetch(`/routeHistory/vehicle/${imei}/alerts`)
      .then((response) => response.json())
      .then((alerts) => {
        const tbody = document.querySelector(".alarm-section tbody");
        tbody.innerHTML = ""; 

        if (alerts.length === 0) {
          tbody.innerHTML =
            "<tr><td colspan='4'>No alerts found for the selected vehicle.</td></tr>";
        } else {
          alerts.forEach((alert) => {
            const row = `
                    <tr>
                        <td>${alert.timestamp}</td>
                        <td>${alert.location}</td>
                        <td>${alert.severity}</td>
                        <td>${alert.status}</td>
                    </tr>
                `;
            tbody.innerHTML += row;
          });
        }
      })
      .catch((error) => {
        console.error("Error fetching alerts:", error);
        document.querySelector(".alarm-section tbody").innerHTML =
          "<tr><td colspan='4'>Error fetching alerts</td></tr>";
      });
  }
});

function fetchAndDisplayAlerts(imei) {
  const alertsTableBody = document.querySelector(".alarm-section tbody");
  alertsTableBody.innerHTML = ""; 

  fetch(`/routeHistory/alerts?imei=${encodeURIComponent(imei)}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((alerts) => {
      if (alerts.length === 0) {
        alertsTableBody.innerHTML =
          "<tr><td colspan='4'>No alerts found</td></tr>";
        return;
      }

      alerts.forEach((alert) => {
        const row = document.createElement("tr");

        const timestampCell = document.createElement("td");
        timestampCell.textContent = new Date(alert.timestamp).toLocaleString();
        row.appendChild(timestampCell);

        const locationCell = document.createElement("td");
        locationCell.textContent = alert.location || "Unknown";
        row.appendChild(locationCell);

        const severityCell = document.createElement("td");
        severityCell.textContent = alert.latitude ? "Critical" : "Warning";
        row.appendChild(severityCell);

        const statusCell = document.createElement("td");
        statusCell.textContent = "Active";
        row.appendChild(statusCell);

        alertsTableBody.appendChild(row);
      });
    })
    .catch((error) => {
      console.error("Error fetching alerts:", error);
      alertsTableBody.innerHTML =
        "<tr><td colspan='4'>Error fetching alerts</td></tr>";
    });
}

function calculateBearingGoogle(start, end) {
  const startLatLng = new google.maps.LatLng(start.lat, start.lng);
  const endLatLng = new google.maps.LatLng(end.lat, end.lng);

  return google.maps.geometry.spherical.computeHeading(startLatLng, endLatLng);
}

function calculateBearing(start, end) {
  const startLatLng = new google.maps.LatLng(start.lat, start.lng);
  const endLatLng = new google.maps.LatLng(end.lat, end.lng);

  let bearing = google.maps.geometry.spherical.computeHeading(startLatLng, endLatLng);

  return (bearing + 360) % 360;
}

function startCarAnimation() {
  currentIndex = 0;
  moveCar();
}

function resumeCarAnimation() {
  if (!animationInterval && currentIndex < pathCoordinates.length - 1) {
    moveCar(); 
  }
}

function stopCarAnimation() {
  if (animationInterval) {
    clearTimeout(animationInterval); 
    animationInterval = null;
  }
}

function setSpeed(multiplier) {
  speedMultiplier = multiplier;

  if (animationInterval) {
    clearTimeout(animationInterval); 
    moveCar();
  }
}
