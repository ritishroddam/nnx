window.onload = async () => {
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
  // status_time_delta should be in milliseconds
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

  livePathPolyline.setPath(liveCoords);
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

    livePathPolyline = new google.maps.Polyline({
      path: liveCoords,
      geodesic: true,
      strokeColor: "#505050",
      strokeOpacity: 0.9,
      strokeWeight: 3,
      map: liveMaps,
    });

    // Create the car marker content
    const carContent = document.createElement("img");
    carContent.src = "/static/images/car_green.png";
    carContent.style.width = "18px";
    carContent.style.height = "32px";
    carContent.style.position = "absolute";
    carContent.alt = "Car";
    carContent.style.transform = `rotate(${rotation}deg)`;

    // Create the marker using google.maps.marker.AdvancedMarkerElement
    markerLive = new google.maps.marker.AdvancedMarkerElement({
      position: liveCoords[liveCoords.length - 1],
      map: liveMaps,
      title: "Start",
      content: carContent,
    });

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
    return data.address; // Assuming the route returns an object with an 'address' field
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
  const labels = recentData.map((data) => data.time); // Extract times for X-axis
  const speeds = recentData.map((data) => data.speed); // Extract speeds for Y-axis

  const ctx = document.getElementById("speedChart").getContext("2d");
  const speedChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels, // Time labels
      datasets: [
        {
          label: "Speed (km/h)",
          data: speeds, // Speed data
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
            color: "white", // Label text color
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

  map = new Map(document.getElementById("map"), {
    zoom: 8,
    center: { lat: 12.9716, lng: 77.5946 },
    mapId: mapId,
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

    // Ensure only numeric input
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
  // Clear all markers from the map before plotting new ones
  if (window.__allMapMarkers && Array.isArray(window.__allMapMarkers)) {
    window.__allMapMarkers.forEach((marker) => {
      if (marker && marker.map) marker.map = null;
    });
    window.__allMapMarkers = [];
  } else {
    window.__allMapMarkers = [];
  }

  // Remove old deck.gl overlay if present
  if (deckOverlay) {
    deckOverlay.setProps({ layers: [] });
    deckOverlay.setMap(null);
    deckOverlay = null;
  }

  timelineSlider.addEventListener("input", handleSliderInput);
  if (pathPolyline) pathPolyline.setMap(null);
  if (startMarker) startMarker.map = null;
  if (endMarker) endMarker.map = null;
  if (carMarker) carMarker.map = null; // Clear the previous car marker

  coords = pathCoordinates.map((item) => [item.lng, item.lat]);
  if (coords.length === 0) return;

  // Fit map to bounds
  const bounds = new google.maps.LatLngBounds();
  coords.forEach(([lng, lat]) =>
    bounds.extend(new google.maps.LatLng(lat, lng))
  );
  map.fitBounds(bounds);

  // Set up timeline slider as before
  timelineSlider.min = 0;
  timelineSlider.max = coords.length - 1;
  timelineSlider.value = 0;
  sliderTimeDisplay.textContent = pathCoordinates[0].time;

  // --- deck.gl PathLayer and IconLayer ---
  const pathLayer = new deck.PathLayer({
    id: "route-path",
    data: [{ path: coords }],
    getPath: (d) => d.path,
    getWidth: 6,
    getColor: [80, 80, 80, 230],
    widthMinPixels: 3,
    widthMaxPixels: 8,
    rounded: true,
    pickable: false,
  });

  // Car icon at the first point
  const iconLayer = new deck.IconLayer({
    id: "car-icon",
    data: [
      {
        position: coords[0],
        size: 32,
        icon: "car",
        angle: pathCoordinates[0].course,
      },
    ],
    getIcon: (d) => "car",
    getPosition: (d) => d.position,
    getSize: (d) => d.size,
    getAngle: (d) => d.angle,
    iconAtlas: carIconUrl,
    iconMapping: {
      car: { x: 0, y: 0, width: 87, height: 155, anchorY: 155, mask: false },
    },
    sizeScale: 1,
    pickable: false,
  });

  deckOverlay = new deck.GoogleMapsOverlay({
    layers: [pathLayer, iconLayer],
  });
  deckOverlay.setMap(map);

  deckLayers = [pathLayer, iconLayer];
  deckInitialized = true;

  // --- InfoWindows and Markers for Start/End/Intermediate Points ---
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

  // Markers for start and end points using AdvancedMarkerElement
  startMarker = new google.maps.marker.AdvancedMarkerElement({
    position: { lat: coords[0][1], lng: coords[0][0] },
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
    position: {
      lat: coords[coords.length - 1][1],
      lng: coords[coords.length - 1][0],
    },
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

  // Optionally, add intermediate arrow markers with info windows (optional, can be commented out)
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
    arrowContent.style.transform = `rotate(${calculateBearing(
      { lat: nextCoord[1], lng: nextCoord[0] },
      { lat: coord[1], lng: coord[0] }
    )}deg)`;

    const marker = new google.maps.marker.AdvancedMarkerElement({
      position: { lat: coord[1], lng: coord[0] },
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
  if (!deckInitialized || !coords.length) return;
  const point = coords[index];
  const bearing =
    index > 0
      ? calculateBearing(
          { lat: coords[index - 1][1], lng: coords[index - 1][0] },
          { lat: point[1], lng: point[0] }
        )
      : 0;

  // Update IconLayer data for the car
  const iconLayer = new deck.IconLayer({
    id: "car-icon",
    data: [
      {
        position: point,
        icon: "car",
        size: 48,
        angle: bearing,
      },
    ],
    getIcon: (d) => "car",
    getPosition: (d) => d.position,
    getSize: (d) => d.size,
    getAngle: (d) => d.angle,
    iconAtlas: "/static/images/car_green.png",
    iconMapping: {
      car: { x: 0, y: 0, width: 48, height: 48, mask: false },
    },
    sizeScale: 1,
    pickable: false,
  });

  deckOverlay.setProps({
    layers: [deckLayers[0], iconLayer],
  });

  map.panTo({ lat: point[1], lng: point[0] });
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
        new google.maps.LatLng(start[1], start[0]),
        new google.maps.LatLng(end[1], end[0])
      ) / 10
    );
    let stepIndex = 0;
    const latDiff = (end[1] - start[1]) / steps;
    const lngDiff = (end[0] - start[0]) / steps;
    const bearing = calculateBearing(
      { lat: start[1], lng: start[0] },
      { lat: end[1], lng: end[0] }
    );

    function animateStep() {
      if (stepIndex < steps) {
        const lat = start[1] + latDiff * stepIndex;
        const lng = start[0] + lngDiff * stepIndex;

        // Update IconLayer for the car
        const iconLayer = new deck.IconLayer({
          id: "car-icon",
          data: [
            {
              position: [lng, lat],
              icon: "car",
              size: 32,
              angle: bearing,
            },
          ],
          getIcon: (d) => "car",
          getPosition: (d) => d.position,
          getSize: (d) => d.size,
          getAngle: (d) => d.angle,
          iconAtlas: "/static/images/car_green.png",
          iconMapping: {
            car: {
              x: 0,
              y: 0,
              width: 87,
              height: 155,
              anchorY: 155,
              mask: false,
            },
          },
          sizeScale: 1,
          pickable: false,
        });

        deckOverlay.setProps({
          layers: [deckLayers[0], iconLayer],
        });

        map.panTo({ lat, lng });
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
        tbody.innerHTML = ""; // Clear existing rows

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
  alertsTableBody.innerHTML = ""; // Clear existing rows

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

function calculateBearing(start, end) {
  const startLatLng = new google.maps.LatLng(start.lat, start.lng);
  const endLatLng = new google.maps.LatLng(end.lat, end.lng);

  return google.maps.geometry.spherical.computeHeading(startLatLng, endLatLng);
}

function startCarAnimation() {
  currentIndex = 0;
  moveCar();
}

function resumeCarAnimation() {
  if (!animationInterval && currentIndex < pathCoordinates.length - 1) {
    moveCar(); // Resume the animation from the current state
  }
}

function stopCarAnimation() {
  if (animationInterval) {
    clearTimeout(animationInterval); // Use clearTimeout for setTimeout-based animation
    animationInterval = null;
  }
}

function setSpeed(multiplier) {
  speedMultiplier = multiplier;

  if (animationInterval) {
    clearTimeout(animationInterval); // Use clearTimeout for setTimeout-based animation
    moveCar();
  }
}
