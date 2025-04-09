window.onload = initMap;

const dataElement = document.getElementById("vehicle-data");
const vehicleData = JSON.parse(dataElement.textContent);

const themeToggle = document.getElementById("theme-toggle");
let darkMode = true;
themeToggle.addEventListener("click", function () {
  darkMode = !darkMode; // Toggle the state
  initMap(darkMode); // Reinitialize the map with the new mapId
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

  if (!google || !google.maps || !google.maps.ControlPosition) {
    console.error("Google Maps API is not loaded properly.");
    return;
  }

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
            lat: item.latitude,
            lng: item.longitude,
            time: item.time,
          }));
          coords = data.map((item) => ({
            lat: item.latitude,
            lng: item.longitude,
          }));
          coords.length = 0;
          coords = [
            { lat: 12.954145000000002, lng: 77.70018666666667 },
            { lat: 12.954145000000002, lng: 77.70018666666667 },
            { lat: 12.954145000000002, lng: 77.70018666666667 },
            { lat: 12.954145000000002, lng: 77.70018666666667 },
            { lat: 12.954996666666666, lng: 77.70048 },
            { lat: 12.955638333333331, lng: 77.70063499999999 },
            { lat: 12.955713333333332, lng: 77.70066666666666 },
            { lat: 12.955708333333332, lng: 77.70066666666666 },
            { lat: 12.955698333333332, lng: 77.700675 },
            { lat: 12.955698333333332, lng: 77.700675 },
            { lat: 12.956738333333332, lng: 77.70091166666666 },
            { lat: 12.956731666666666, lng: 77.700895 },
            { lat: 12.956963333333332, lng: 77.70103333333333 },
            { lat: 12.956581666666667, lng: 77.70673000000001 },
            { lat: 12.955818333333331, lng: 77.71704166666667 },
            { lat: 12.955816666666665, lng: 77.71774833333333 },
            { lat: 12.955791666666668, lng: 77.71839166666668 },
            { lat: 12.955043333333332, lng: 77.71743166666667 },
            { lat: 12.953899999999999, lng: 77.71765166666667 },
            { lat: 12.953755000000001, lng: 77.71890499999999 },
            { lat: 12.953766666666668, lng: 77.71893666666666 },
            { lat: 12.953861666666667, lng: 77.717545 },
            { lat: 12.953823333333332, lng: 77.717545 },
            { lat: 12.953865, lng: 77.717505 },
            { lat: 12.953890000000001, lng: 77.71751333333333 },
            { lat: 12.953890000000001, lng: 77.71746499999999 },
            { lat: 12.953926666666666, lng: 77.717545 },
            { lat: 12.953748333333332, lng: 77.71769166666667 },
            { lat: 12.953778333333332, lng: 77.71760333333333 },
            { lat: 12.953831666666668, lng: 77.71756166666667 },
            { lat: 12.953988333333333, lng: 77.717545 },
            { lat: 12.953948333333335, lng: 77.71758666666666 },
            { lat: 12.953898333333333, lng: 77.71760333333333 },
            { lat: 12.953993333333335, lng: 77.717545 },
            { lat: 12.953976666666666, lng: 77.71762666666667 },
            { lat: 12.950186666666665, lng: 77.71627666666667 },
            { lat: 12.950803333333333, lng: 77.71555166666667 },
            { lat: 12.951336666666668, lng: 77.71547000000001 },
            { lat: 12.951385, lng: 77.715535 },
            { lat: 12.951385, lng: 77.71550333333333 },
            { lat: 12.951385, lng: 77.71550333333333 },
            { lat: 12.951385, lng: 77.71550333333333 },
            { lat: 12.951385, lng: 77.71550333333333 },
            { lat: 12.951385, lng: 77.71550333333333 },
            { lat: 12.951353333333335, lng: 77.71545333333333 },
            { lat: 12.951880000000001, lng: 77.71542166666667 },
            { lat: 12.95439, lng: 77.71502333333333 },
            { lat: 12.955313333333333, lng: 77.71477833333333 },
            { lat: 12.955454999999999, lng: 77.714755 },
            { lat: 12.955711666666666, lng: 77.71473833333333 },
            { lat: 12.956306666666668, lng: 77.70927666666667 },
            { lat: 12.956776666666666, lng: 77.70232 },
            { lat: 12.953133333333335, lng: 77.70039833333334 },
            { lat: 12.94765, lng: 77.69917833333334 },
            { lat: 12.943350000000002, lng: 77.697705 },
            { lat: 12.941078333333333, lng: 77.69646833333333 },
            { lat: 12.939998333333332, lng: 77.69303333333333 },
            { lat: 12.939573333333332, lng: 77.69017000000001 },
            { lat: 12.937593333333332, lng: 77.69021 },
            { lat: 12.936945, lng: 77.69025 },
            { lat: 12.937815, lng: 77.68999833333334 },
            { lat: 12.936935000000002, lng: 77.69025 },
          ];
          plotPathOnMap(coords);
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

function plotPathOnMap(pathCoordinates) {
  if (pathPolyline) pathPolyline.setMap(null);
  if (startMarker) startMarker.map = null;
  if (endMarker) endMarker.map = null;
  if (carMarker) carMarker.map = null; // Clear the previous car marker

  if (pathCoordinates.length > 0) {
    const arrowSymbol = {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 2,
      strokeColor: "#0000FF",
      strokeWeight: 2,
    };

    pathPolyline = new google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: "#FF4500",
      strokeOpacity: 0.9,
      strokeWeight: 3,
      icons: [
        {
          icon: arrowSymbol,
          offset: "0%",
          repeat: "75px",
        },
      ],
    });

    pathPolyline.setMap(map);

    const bounds = new google.maps.LatLngBounds();
    pathCoordinates.forEach((coord) => bounds.extend(coord));
    map.fitBounds(bounds);

    // Create DOM elements for start and end markers
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
      position: pathCoordinates[0],
      map: map,
      title: "Start",
      content: startContent, // Pass the DOM element
    });

    endMarker = new google.maps.marker.AdvancedMarkerElement({
      position: pathCoordinates[pathCoordinates.length - 1],
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
      position: pathCoordinates[0],
      map: map,
      title: "Car",
      content: carContent, // Pass the DOM element
    });
  }
}

function moveCar() {
  if (currentIndex < pathCoordinates.length - 1) {
    const start = pathCoordinates[currentIndex];
    const end = pathCoordinates[currentIndex + 1];
    const steps = 100;
    const stepDuration = 10 / speedMultiplier;

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
  clearInterval(animationInterval);
}

function setSpeed(multiplier) {
  speedMultiplier = multiplier;
}

// Add a click event listener to the back button
document.querySelector(".back-arrow").addEventListener("click", () => {
  // Navigate to the previous page in the browser's history
  window.history.back();
});
