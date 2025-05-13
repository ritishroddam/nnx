window.onload = initMap;

const dataElement = document.getElementById("vehicle-data");
const vehicleData = JSON.parse(dataElement.textContent);

const socket = io(CONFIG.SOCKET_SERVER_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.on("connect", () => {
  console.log("Connected to the socket server");
  const licensePlateNumber = vehicleData["License Plate Number"] || none;
  console.log(vehicleData);
  socket.emit("subscribe_vehicle_updates", {
    LicensePlateNumber: licensePlateNumber,
  });
});

socket.on("subscription_success", (data) => {
  console.log("Subscription successful:", data);
});

socket.on("subscription_error", (error) => {
  console.error("Subscription error:", error);
});

socket.on("vehicle_live_update", (data) => {
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
  setTimeout(() => {
    initMap();
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

document.addEventListener("DOMContentLoaded", () => {
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
let pathCoordinates = [];
let coords = []; // Coordinates for the path
let carMarker;
let pathPolyline;
let startMarker;
let endMarker;
let currentIndex = 0;
let animationInterval = null;
let speedMultiplier = 1;
let timelineSlider;
let sliderTimeDisplay;

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
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
    console.log("Fetch URL:", fetchUrl);

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

async function plotPathOnMap(pathCoordinates) {
  timelineSlider.addEventListener("input", handleSliderInput);
  if (pathPolyline) pathPolyline.setMap(null);
  if (startMarker) startMarker.map = null;
  if (endMarker) endMarker.map = null;
  if (carMarker) carMarker.map = null; // Clear the previous car marker
  const enhanceAccuracy = document.getElementById("enhance-accuracy").checked;

  if (enhanceAccuracy) {
    try {
      const encodedPoints = pathCoordinates
        .map((p) => `${p.lat},${p.lng}`)
        .join("|");

      const response = await fetch("/routeHistory/snap-to-roads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        },
        body: JSON.stringify({ points: encodedPoints }),
      });

      const snappedData = await response.json();

      if (snappedData.length > 0) {
        pathCoordinates = snappedData.map((point) => ({
          ...point.location,
          time: interpolateTime(point.originalIndex, pathCoordinates),
          speed: interpolateSpeed(point.originalIndex, pathCoordinates),
        }));
      }
    } catch (error) {
      console.error("Snap to Roads failed:", error);
    }
  }

  coords = pathCoordinates.map((item) => ({
    lat: item.lat,
    lng: item.lng,
  }));

  if (coords.length > 0) {
    timelineSlider.min = 0;
    timelineSlider.max = coords.length - 1;
    timelineSlider.value = 0;
    sliderTimeDisplay.textContent = pathCoordinates[0].time;

    const bounds = new google.maps.LatLngBounds();
    coords.forEach((coord) => bounds.extend(coord));
    map.fitBounds(bounds);

    pathPolyline = new google.maps.Polyline({
      path: coords,
      geodesic: true,
      strokeColor: "#505050",
      strokeOpacity: 0.9,
      strokeWeight: 3,
      map: map,
    });

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
      position: coords[0],
      map: map,
      title: "Start",
      content: startContent, // Pass the DOM element
    });

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
      content: endContent, // Pass the DOM element
    });

    const endIgnition =
      pathCoordinates[pathCoordinates.length - 1].ignition === "1"
        ? "On"
        : "Off";
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

    const carContent = document.createElement("img");
    carContent.src = "/static/images/car_green.png";
    carContent.style.width = "18px";
    carContent.style.height = "32px";
    carContent.style.position = "absolute";
    carContent.alt = "Car";

    carMarker = new google.maps.marker.AdvancedMarkerElement({
      position: coords[0],
      map: map,
      title: "Car",
      content: carContent, // Pass the DOM element
    });

    for (let index = 0; index < coords.length - 1; index++) {
      const coord = coords[index];
      const nextCoord = coords[index + 1];
      const pathCoord = pathCoordinates[index];
      const nextPathCoord = pathCoordinates[index + 1];

      const arrowContent = document.createElement("div");
      arrowContent.style.width = "10px";
      arrowContent.style.height = "10px";
      arrowContent.style.backgroundColor = "rgba(204, 204, 204, 0.2)";
      arrowContent.style.borderTop = "10px solid #2a2a2a";
      arrowContent.style.borderLeft = "5px solid transparent";
      arrowContent.style.borderRight = "5px solid transparent";
      arrowContent.style.position = "absolute";
      arrowContent.style.transform = `rotate(${calculateBearing(
        nextCoord,
        coord
      )}deg)`;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: coord,
        map: map,
        title: "Arrow",
        content: arrowContent, // Pass the DOM element
      });

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
}

function updateCarPosition(index) {
  const point = pathCoordinates[index];
  const bearing = calculateBearing(
    pathCoordinates[Math.max(0, index - 1)],
    point
  );

  const carContent = document.createElement("img");
  carContent.src = "/static/images/car_green.png";
  carContent.style.transform = `rotate(${bearing}deg)`;
  carContent.style.width = "18px";
  carContent.style.height = "32px";

  carMarker.content = carContent;
  carMarker.position = { lat: point.lat, lng: point.lng };
  map.panTo(carMarker.position);

  // Update time display
  sliderTimeDisplay.textContent = point.time;
}

function moveCar() {
  if (currentIndex < pathCoordinates.length - 1) {
    timelineSlider.value = currentIndex;
    sliderTimeDisplay.textContent = pathCoordinates[currentIndex].time;

    const start = pathCoordinates[currentIndex];
    const end = pathCoordinates[currentIndex + 1];
    const stepDuration = 20 / speedMultiplier;
    const steps = Math.floor(
      google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(start.lat, start.lng),
        new google.maps.LatLng(end.lat, end.lng)
      ) / 10
    ); // Number of steps based on distance
    let stepIndex = 0;
    const latDiff = (end.lat - start.lat) / steps;
    const lngDiff = (end.lng - start.lng) / steps;

    const bearing = calculateBearing(start, end);

    animationInterval = setInterval(() => {
      if (stepIndex < steps) {
        const lat = start.lat + latDiff * stepIndex;
        const lng = start.lng + lngDiff * stepIndex;

        const carContent = document.createElement("img");
        carContent.src = "/static/images/car_green.png";
        carContent.style.position = "absolute";
        carContent.style.width = "18px";
        carContent.style.height = "32px";
        carContent.style.transform = `rotate(${bearing}deg)`;
        carContent.alt = "Car";

        carMarker.content = carContent; // Set the DOM element as content
        carMarker.position = { lat, lng };

        if (!map.getBounds().contains(carMarker.position)) map.panTo(end);

        stepIndex++;
      } else {
        currentIndex++;
        clearInterval(animationInterval);
        moveCar();
      }
    }, stepDuration);
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

function stopCarAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval); // Pause the animation
    animationInterval = null; // Mark the animation as paused
  }
}

function resumeCarAnimation() {
  if (!animationInterval && currentIndex < pathCoordinates.length - 1) {
    moveCar(); // Resume the animation from the current state
  }
}

function setSpeed(multiplier) {
  speedMultiplier = multiplier;

  if (animationInterval) {
    clearInterval(animationInterval);
    moveCar();
  }
}

// Add a click event listener to the back button
document.querySelector(".back-arrow").addEventListener("click", () => {
  // Navigate to the previous page in the browser's history
  window.history.back();
});
