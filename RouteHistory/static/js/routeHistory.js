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
    zoom: 5,
    center: { lat: 20.5937, lng: 78.9629 }, // Default center, updated dynamically
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
    const start_date = formatDateToDB(
      document.getElementById("start_date").value
    );
    const end_date = formatDateToDB(document.getElementById("end_date").value);

    // Ensure only numeric input
    if (!/^\d+$/.test(userEnteredImei)) {
      alert("Please enter a valid numeric IMEI number.");
      return;
    }

    const fetchUrl = `/get_vehicle_path?imei=${userEnteredImei}&start_date=${start_date}&end_date=${end_date}`;
    // console.log("Fetch URL:", fetchUrl);

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
  if (!pathCoordinates || pathCoordinates.length === 0) {
    console.error("No valid path data found.");
    alert("No valid path data found.");
    return;
  }

  // Clear any previous markers and polyline
  if (pathPolyline) pathPolyline.setMap(null);
  if (startMarker) startMarker.setMap(null);
  if (endMarker) endMarker.setMap(null);
  if (carMarker) carMarker.setMap(null);

  console.log("Coordinates received:", pathCoordinates);

  // Filter valid coordinates
  const validCoordinates = pathCoordinates.filter(
    (coord) => coord && isFinite(coord.lat) && isFinite(coord.lng)
  );

  if (validCoordinates.length === 0) {
    alert("No valid coordinates to render.");
    return;
  }

  // Create and display polyline on the map
  const arrowSymbol = {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 2, // Adjusted scale for smaller arrows
    strokeColor: "#ff0000", // Arrow color
    strokeWeight: 2, // Arrow stroke thickness
  };

  pathPolyline = new google.maps.Polyline({
    path: validCoordinates,
    geodesic: true,
    strokeColor: "#0000ff",
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

  // Adjust the map view to fit the path
  const bounds = new google.maps.LatLngBounds();
  validCoordinates.forEach((coord) => bounds.extend(coord));
  map.fitBounds(bounds);

  // Add start and end markers
  startMarker = new google.maps.Marker({
    position: validCoordinates[0],
    map: map,
    icon: {
      url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
      scaledSize: new google.maps.Size(30, 30),
    },
    title: "Start",
  });

  endMarker = new google.maps.Marker({
    position: validCoordinates[validCoordinates.length - 1],
    map: map,
    icon: {
      url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
      scaledSize: new google.maps.Size(30, 30),
    },
    title: "End",
  });

  // Add car marker at the start point
  carMarker = new google.maps.Marker({
    position: validCoordinates[0],
    map: map,
    icon: {
      url: "http://64.227.135.38/icon1.png",
      scaledSize: new google.maps.Size(50, 50),
      anchor: new google.maps.Point(25, 25),
    },
  });

  // Show control buttons
  const controlsContainer = document.getElementById("controls-container");
  if (controlsContainer.style.display !== "flex") {
    controlsContainer.style.display = "flex";
  }
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
