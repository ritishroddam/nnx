document.addEventListener("DOMContentLoaded", () => {
  const recentData = recent_data | tojson;
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
let carMarker;
let pathPolyline;
let startMarker;
let endMarker;
let currentIndex = 0;
let animationInterval = null;
let speedMultiplier = 1;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 10,
    center: { lat: 0, lng: 0 }, // Default center, updated dynamically
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

function plotPathOnMap(pathCoordinates) {
  if (pathPolyline) pathPolyline.setMap(null);
  if (startMarker) startMarker.setMap(null);
  if (endMarker) endMarker.setMap(null);
  if (carMarker) carMarker.setMap(null); // Clear the previous car marker

  if (pathCoordinates.length > 0) {
    const arrowSymbol = {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 2, // Adjusted scale for smaller arrows
      strokeColor: "#0000FF", // Arrow color
      strokeWeight: 2, // Arrow stroke thickness
    };

    // Gradient stroke for polyline
    const gradientColors = [
      "#ff0000", // Red
      "#ff7300", // Orange
      "#ffd700", // Yellow
      "#00b300", // Green
      "#0000ff", // Blue
    ];
    const gradientIconSet = gradientColors.map((color, index) => ({
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 3,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: color,
        strokeWeight: 1,
      },
      offset: `${index * 20}%`, // Spread evenly across the line
    }));

    pathPolyline = new google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: "#FF4500", // Polyline color (orange-red for more contrast)
      strokeOpacity: 0.9, // Slightly transparent
      strokeWeight: 3, // Line thickness
      icons: [
        {
          icon: arrowSymbol,
          offset: "0%", // Start position of the first arrow
          repeat: "75px", // Distance between arrows
        },
      ],
    });

    pathPolyline.setMap(map);

    const bounds = new google.maps.LatLngBounds();
    pathCoordinates.forEach((coord) => bounds.extend(coord));
    map.fitBounds(bounds);

    // Markers for start and end points
    startMarker = new google.maps.Marker({
      position: pathCoordinates[0],
      map: map,
      icon: {
        url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
        scaledSize: new google.maps.Size(30, 30),
      },
      title: "Start",
    });

    endMarker = new google.maps.Marker({
      position: pathCoordinates[pathCoordinates.length - 1],
      map: map,
      icon: {
        url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
        scaledSize: new google.maps.Size(30, 30),
      },
      title: "End",
    });

    carMarker = new google.maps.Marker({
      position: pathCoordinates[0],
      map: map,
      icon: {
        url: "http://64.227.135.38/icon1.png",
        scaledSize: new google.maps.Size(50, 50), // Adjust to fit your map scale
        anchor: new google.maps.Point(25, 25), // Centered anchor for better placement
      },
    });

    document.getElementById("controls-container").style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const imei =
    "{{ vehicle_data[0]['IMEI Number'] if vehicle_data else 'No Data Available'}}";

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

  fetch(`/routeHistory/api/alerts?imei=${encodeURIComponent(imei)}`)
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

        carMarker.setIcon({
          url: "http://64.227.135.38/icon1.png",
          scaledSize: new google.maps.Size(50, 50),
          anchor: new google.maps.Point(20, 20),
          rotation: bearing,
        });

        carMarker.setPosition({ lat, lng });
        map.panTo({ lat, lng });

        stepIndex++;
      } else {
        currentIndex++;
        clearInterval(animationInterval);
        moveCar();
      }
    }, stepDuration);
  }
}

window.onload = initMap;

// Speed Chart using Chart.js
const ctx = document.getElementById("speedChart").getContext("2d");
const speedChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [
      "10:16:30",
      "10:17:00",
      "10:17:30",
      "10:18:00",
      "10:18:30",
      "10:19:00",
      "10:19:30",
    ],
    datasets: [
      {
        label: "Speed MPH",
        data: [47, 42, 40, 47, 50, 40, 60],
        borderColor: "rgba(0, 122, 255, 1)",
        backgroundColor: "rgba(0, 122, 255, 0.2)",
        borderWidth: 2,
        fill: true,
      },
    ],
  },
  options: {
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  },
});

// Add a click event listener to the back button
document.querySelector(".back-arrow").addEventListener("click", () => {
  // Navigate to the previous page in the browser's history
  window.history.back();
});
