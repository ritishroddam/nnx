const tableBody = document.querySelector("#sos-table tbody");
const searchInput = document.querySelector("#search-input");
let map, marker;
const infoWindow = new google.maps.InfoWindow(); // InfoWindow to display info on marker click

// Initialize Google Map
function initMap(lat = 0, lng = 0) {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat, lng },
    zoom: 10,
    styles: [
      {
        elementType: "geometry",
        stylers: [
          {
            color: "#212121",
          },
        ],
      },
      {
        elementType: "labels.icon",
        stylers: [
          {
            visibility: "off",
          },
        ],
      },
      {
        elementType: "labels.text.fill",
        stylers: [
          {
            color: "#757575",
          },
        ],
      },
      {
        elementType: "labels.text.stroke",
        stylers: [
          {
            color: "#212121",
          },
        ],
      },
    ],
  });
}

// Fetch and display SOS logs
async function loadSosLogs() {
  try {
    const response = await fetch("/sosReport/sos-logs");
    const logs = await response.json();

    // Filter out logs with empty fields
    const filteredLogs = logs.filter(
      (log) => log.imei && log.latitude && log.longitude && log.timestamp
    );

    // Sort logs by timestamp (latest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    filteredLogs.forEach((log) => {
      const row = document.createElement("tr");

      // Remove non-numeric characters from IMEI number
      const imeiNumber = log.imei.replace(/\D/g, "");

      // Format the timestamp
      const dateObject = new Date(log.timestamp);
      const formattedDate = dateObject.toLocaleDateString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }); // e.g., 16/12/2024
      const formattedTime = dateObject.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }); // e.g., 01:22:39 PM

      row.innerHTML = `
                <td>${imeiNumber}</td>
                <td>${log.latitude.toFixed(6)}</td>
                <td>${log.longitude.toFixed(6)}</td>
                <td>${formattedDate} ${formattedTime}</td>
                <td><button onclick="showOnMap(${log.latitude}, ${
        log.longitude
      }, '${imeiNumber}', '${formattedDate} ${formattedTime}')">Locate</button></td>
            `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching SOS logs:", error);
  }
}

// Filter logs based on partial IMEI search input
function filterLogs() {
  const searchTerm = searchInput.value.trim().toLowerCase();

  const rows = tableBody.getElementsByTagName("tr");
  Array.from(rows).forEach((row) => {
    const imeiCell = row.cells[0]; // Get the IMEI cell
    const imeiValue = imeiCell.textContent.trim().toLowerCase();

    // Check if the IMEI number contains the search term
    if (imeiValue.includes(searchTerm)) {
      row.style.display = ""; // Show the row if it matches
    } else {
      row.style.display = "none"; // Hide the row if it doesn't match
    }
  });
}

// Convert latitude and longitude to address using Geocoding API
function getAddress(lat, lng) {
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results[0]) {
        resolve(results[0].formatted_address);
      } else {
        reject("Address not found");
      }
    });
  });
}

// Show location on map and display information on marker click
async function showOnMap(lat, lng, imei, timestamp) {
  const position = { lat, lng };

  if (!marker) {
    marker = new google.maps.Marker({ position, map });
  } else {
    marker.setPosition(position);
  }

  map.setCenter(position); // Set the center of the map to the device's location

  // Set the zoom level to a higher value for a closer view (e.g., 15)
  map.setZoom(15); // Adjust the zoom level as needed

  // Get address from latitude and longitude
  try {
    const address = await getAddress(lat, lng);
    const contentString = `
            <div class="info-window">
                <h3>Device Info</h3>
                <p><strong>IMEI:</strong> ${imei}</p>
                <p><strong>Timestamp:</strong> ${timestamp}</p>
                <p><strong>Location:</strong> ${address}</p>
            </div>
        `;
    infoWindow.setContent(contentString);
    infoWindow.open(map, marker);
  } catch (error) {
    console.error(error);
    const contentString = `
            <div class="info-window">
                <h3>Device Info</h3>
                <p><strong>IMEI:</strong> ${imei}</p>
                <p><strong>Timestamp:</strong> ${timestamp}</p>
                <p><strong>Location:</strong> Not available</p>
            </div>
        `;
    infoWindow.setContent(contentString);
    infoWindow.open(map, marker);
  }
}

// Initialize and load logs when the page is ready
window.onload = function () {
  initMap();
  loadSosLogs();
};

function downloadExcel() {
  const table = document.getElementById("sos-table");
  const rows = Array.from(table.querySelectorAll("tr"));
  const data = rows.map((row) =>
    Array.from(row.cells).map((cell) => cell.textContent)
  );

  // Convert data to worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SOS Alerts");

  // Trigger download
  XLSX.writeFile(wb, "SOS_Alerts_Report.xlsx");
}
