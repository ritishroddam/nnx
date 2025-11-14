window.onload =  initMap;

const socket = io("https://cordonnx.com", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

document.addEventListener("DOMContentLoaded", async function () {
  console.log("Connected to the socket server");
  const licensePlateNumber = window.licensePlateNumber || null;
  console.log(licensePlateNumber);
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
  if (!data || !data.latitude || !data.longitude) {
    console.warn("Invalid vehicle data received:", data);
    return;
  }

  console.log("Received vehicle live update:", data);

  const vehicleData = {
    latitude: data.latitude,
    longitude: data.longitude,
    location: data.address || "",
    speed: (data.speed !== null && data.speed !== undefined) ? data.speed : null,
    date_time: data.date_time || "",
    course: data.course ? parseFloat(data.course) : vehicleMarker.currentCourse || 0
  }

  updateMarkerPosition(parseFloat(vehicleData.latitude), parseFloat(vehicleData.longitude), vehicleData.course);
  updateVehicleData(vehicleData);
  console.log("Vehicle live update:", data);
});

// Create a properly rotatable marker element
function createRotatableMarker(course = 0) {
  const container = document.createElement("div");
  container.style.position = "relative";
  container.style.width = "32px";
  container.style.height = "32px";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  
  const carImg = document.createElement("img");
  carImg.src = "/static/images/car_green.png";
  carImg.style.width = "24px";
  carImg.style.height = "24px";
  carImg.style.transform = `rotate(${course}deg)`;
  carImg.style.transition = "transform 0.3s ease";
  carImg.style.transformOrigin = "center center";
  carImg.alt = "Vehicle";
  
  container.appendChild(carImg);
  return container;
}

// Update marker rotation with proper course handling
function updateMarkerRotation(marker, newCourse) {
  const container = marker.content;
  const img = container.querySelector('img');
  if (img) {
    const course = parseFloat(newCourse) || 0;
    img.style.transform = `rotate(${course}deg)`;
    console.log(`Rotated marker to ${course}°`);
  }
  marker.currentCourse = newCourse;
}

// Smooth animation for marker movement with rotation
function animateMarker(marker, newPosition, newCourse, duration = 2000) {
  const startPosition = marker.currentPosition;
  const startCourse = marker.currentCourse || 0;
  const startTime = performance.now();
  
  // Calculate distance for animation speed adjustment
  const distance = google.maps.geometry.spherical.computeDistanceBetween(
    startPosition, newPosition
  );
  
  // Adjust duration based on distance
  const adjustedDuration = Math.min(duration, Math.max(1000, distance / 5));
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / adjustedDuration, 1);
    
    // Easing function for smooth movement
    const easeProgress = easeInOutCubic(progress);
    
    // Interpolate position
    const lat = startPosition.lat() + (newPosition.lat() - startPosition.lat()) * easeProgress;
    const lng = startPosition.lng() + (newPosition.lng() - startPosition.lng()) * easeProgress;
    
    const currentLatLng = new google.maps.LatLng(lat, lng);
    marker.position = currentLatLng;
    marker.currentPosition = currentLatLng;
    
    // Interpolate rotation if course changed
    if (newCourse !== undefined && newCourse !== startCourse) {
      const currentCourse = startCourse + (newCourse - startCourse) * easeProgress;
      updateMarkerRotation(marker, currentCourse);
    }
    
    // Keep map centered on marker
    map.setCenter(currentLatLng);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Final position and rotation
      marker.position = newPosition;
      marker.currentPosition = newPosition;
      if (newCourse !== undefined) {
        updateMarkerRotation(marker, newCourse);
      }
    }
  }
  
  requestAnimationFrame(animate);
}

// Easing function for smooth animation
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function updateMarkerPosition(latitude, longitude, course) {
  if (!vehicleMarker) {
    console.warn("Marker is not initialized yet.");
    return;
  }

  url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  openMap();
  
  const latLng = new google.maps.LatLng(latitude, longitude);
  
  // Use animation instead of direct position update
  animateMarker(vehicleMarker, latLng, course, 2000);
}

function updateVehicleData(vehicleData) {
  document.getElementById("location").textContent =
    vehicleData.location || "Unknown Location";

  const speedText =
    (vehicleData.speed !== null && vehicleData.speed !== undefined)
      ? `${vehicleData.speed} km/h`
      : "Unknown Speed";
  document.getElementById("speed").textContent = speedText;

  document.getElementById("lastUpdate").textContent =
    vehicleData.date_time || "Unknown Date/Time";
}

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const lat = parseFloat(window.vehicleLat);
  const lng = parseFloat(window.vehicleLng);

  const latLng = new google.maps.LatLng(lat, lng);

  map = new Map(document.getElementById("map"), {
    mapId: "dc4a8996aab2cac9",
    center: latLng,
    zoom: 16,
  });

  // Create rotatable marker with initial course
  const initialCourse = 0;
  const markerContent = createRotatableMarker(initialCourse);

  vehicleMarker = new AdvancedMarkerElement({
    position: latLng,
    map: map,
    title: "Vehicle Location",
    content: markerContent,
  });

  // Store marker data
  vehicleMarker.currentPosition = latLng;
  vehicleMarker.currentCourse = initialCourse;

  url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  openMap();
}


function openMap() {
  if (!url) {
    console.warn("URL is not set yet.");
    return;
  }
  document.getElementById("route-btn").onclick = function () {
    window.open(url, "_blank");
  }
}
