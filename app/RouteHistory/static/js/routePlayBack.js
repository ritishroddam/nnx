window.onload = initMap;

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

const dataElement = document.getElementById("vehicle-data");
const vehicleData = JSON.parse(dataElement.textContent);

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
let darkMode = true;
themeToggle.addEventListener("click", function () {
  darkMode = !darkMode; // Toggle the state
  initMap(darkMode);
  if (coords.length > 0) {
    const form = document.getElementById("vehicle-form");
    const submitEvent = new Event("submit", {
      bubbles: true,
      cancelable: true,
    });
    form.dispatchEvent(submitEvent);
  }
});

document.addEventListener("DOMContentLoaded", () => {
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

async function initMap(darkMode = true) {
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  await google.maps.importLibrary("geometry");

  const mapId = darkMode ? "44775ccfe2c0bd88" : "8faa2d4ac644c8a2";
  map = new Map(document.getElementById("map"), {
    zoom: 10,
    center: { lat: 0, lng: 0 },
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

async function plotPathOnMap(pathCoordinates) {
  if (pathPolyline) pathPolyline.setMap(null);
  if (startMarker) startMarker.map = null;
  if (endMarker) endMarker.map = null;
  if (carMarker) carMarker.map = null; // Clear the previous car marker

  coords = pathCoordinates.map((item) => ({
    lat: item.lat,
    lng: item.lng,
  }));

  if (coords.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    coords.forEach((coord) => bounds.extend(coord));
    map.fitBounds(bounds);

    pathPolyline = new google.maps.Polyline({
      path: coords,
      geodesic: true,
      strokeColor: "black",
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

    const ignition = pathCoordinates[0].ignition === "1" ? "On" : "Off";
    const location = await getAddressFromCoordinates(
      pathCoordinates[0].lat,
      pathCoordinates[0].lng
    );

    const startMarkerInfo = new google.maps.InfoWindow({
      content: `<div>
                <h3>${pathCoordinates[0].LicensePlateNumber}</h3>
                <p><strong>Location:</strong> ${location}</p>
                <p><strong>Timestamp:</strong> ${pathCoordinates[0].time}</p>
                <p><strong>Speed:</strong> ${pathCoordinates[0].speed}</p>
                <p><strong>Ignition:</strong> ${ignition}</p>
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

    const carContent = document.createElement("img");
    carContent.src = "/static/images/car_green.png";
    carContent.style.width = "18px";
    carContent.style.height = "32px";
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
      arrowContent.style.borderTop = "1px solid black";
      arrowContent.style.borderLeft = "1px solid black";
      arrowContent.style.borderRight = "1px solid black";
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

function moveCar() {
  if (currentIndex < pathCoordinates.length - 1) {
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
