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

  const newSpeed = data.speed ? parseFloat(data.speed) : vehicleMarker.currentSpeed;
  const newLastUpdate = data.date_time || new Date().toISOString();

  updateMarkerPosition(parseFloat(vehicleData.latitude), parseFloat(vehicleData.longitude), vehicleData.course, newSpeed, newLastUpdate);
  updateVehicleData(vehicleData);
  console.log("Vehicle live update:", data);
});

// Create a properly rotatable marker element
// Create a properly rotatable marker element
function createRotatableMarker(course = 0, speed = 0, lastUpdate = null, vehicleType = 'car') {
  function _getVehicleIconSize(type) {
    switch ((type || 'car').toLowerCase()) {
      case 'truck': return { width: 24, height: 80 };
      case 'bus':   return { width: 35, height: 80 };
      case 'bike':  return { width: 21, height: 56 };
      default:      return { width: 29, height: 56 }; // car
    }
  }

  const size = _getVehicleIconSize(vehicleType);

  const container = document.createElement("div");
  container.style.position = "relative";
  container.style.width = `${size.width}px`;
  container.style.height = `${size.height}px`;
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  
  const carImg = document.createElement("img");
  
  // Determine color based on speed and last update time
  const color = getMarkerColor(speed, lastUpdate);
  carImg.src = `/static/images/car_${color}.png`;
  carImg.style.width = `${size.width}px`;
  carImg.style.height = `${size.height}px`;
  carImg.style.transform = `rotate(${course}deg)`;
  carImg.style.transition = "transform 0.3s ease";
  carImg.style.transformOrigin = "center center";
  carImg.alt = "Vehicle";
  
  container.appendChild(carImg);
  container.currentColor = color;
  container.vehicleType = vehicleType;
  return container;
}

// Get marker color based on speed and last update time
function getMarkerColor(speed, lastUpdate) {
  // Check if no update in last 24 hours
  if (lastUpdate) {
    const lastUpdateTime = new Date(lastUpdate).getTime();
    const currentTime = new Date().getTime();
    const hoursDiff = (currentTime - lastUpdateTime) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      return 'black';
    }
  }
  
  // Convert speed to number
  const speedNum = parseFloat(speed) || 0;
  
  if (speedNum === 0) {
    return 'yellow';  // Stopped
  } else if (speedNum > 60) {
    return 'red';      // Speed > 60
  } else if (speedNum > 40) {
    return 'blue';     // Speed > 40
  } else {
    return 'green';    // Moving but speed <= 40
  }
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

// Update marker color based on speed and last update
function updateMarkerColor(marker, speed, lastUpdate) {
  const container = marker.content;
  const img = container.querySelector('img');
  if (img) {
    const newColor = getMarkerColor(speed, lastUpdate);
    const oldColor = container.currentColor;
    
    if (newColor !== oldColor) {
      img.src = `/static/images/car_${newColor}.png`;
      container.currentColor = newColor;
      console.log(`Updated marker color from ${oldColor} to ${newColor}`);
    }
  }
  marker.currentSpeed = speed;
  marker.lastUpdate = lastUpdate;
}

// Smooth animation for marker movement with rotation
function animateMarker(marker, newPosition, newCourse, newSpeed, newLastUpdate, duration = 2000) {
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
      // Update color at the end of animation
      if (newSpeed !== undefined || newLastUpdate !== undefined) {
        updateMarkerColor(marker, newSpeed, newLastUpdate);
      }
    }
  }
  
  requestAnimationFrame(animate);
}

// Easing function for smooth animation
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function updateMarkerPosition(latitude, longitude, course, speed, lastUpdate) {
  if (!vehicleMarker) {
    console.warn("Marker is not initialized yet.");
    return;
  }

  url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  openMap();
  
  const latLng = new google.maps.LatLng(latitude, longitude);
  
  // Use animation instead of direct position update
  animateMarker(vehicleMarker, latLng, course, speed, lastUpdate, 2000);
}

function updateVehicleData(vehicleData) {
  document.getElementById("location").textContent =
    vehicleData.location || "Unknown Location";

  if (vehicleData.speed && vehicleData.speed !== '' && vehicleData.speed !== null) {
    const speedNum = parseInt(vehicleData.speed);
    if (speedNum === 0) {
      document.getElementById("speed").textContent = `Stopped: ${vehicleData.speed} km/h`;
    } else {
      document.getElementById("speed").textContent = `Moving: ${vehicleData.speed} km/h`;
    }
  } else {
    document.getElementById("speed").textContent = 'No Speed';
  }

  // Format date as dd/mm/yyyy and time in 12-hour format
  if (vehicleData.date_time) {
    const dateObj = new Date(vehicleData.date_time);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const timeStr = dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
    document.getElementById("lastUpdate").textContent = `${day}/${month}/${year} ${timeStr}`;
  } else {
    document.getElementById("lastUpdate").textContent = "Unknown Date/Time";
  }
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

  // Get initial values from window variables if available
  const initialCourse = window.vehicleCourse ? parseFloat(window.vehicleCourse) : 0;
  const initialSpeed = window.vehicleSpeed ? parseFloat(window.vehicleSpeed) : 0;
  const initialLastUpdate = window.vehicleLastUpdate || null;
  const initialVehicleType = window.vehicleType || 'car';

  // Create rotatable marker with proper color and size based on vehicle type
  const markerContent = createRotatableMarker(initialCourse, initialSpeed, initialLastUpdate, initialVehicleType);

  vehicleMarker = new AdvancedMarkerElement({
    position: latLng,
    map: map,
    title: "Vehicle Location",
    content: markerContent,
  });

  // Store marker data
  vehicleMarker.currentPosition = latLng;
  vehicleMarker.currentCourse = initialCourse;
  vehicleMarker.currentSpeed = initialSpeed;
  vehicleMarker.lastUpdate = initialLastUpdate;

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
