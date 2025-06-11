window.onload =  initMap;

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
    speed: data.speed || 0,
    date_time: data.date_time || ""
  }

  updateMarkerPostion(parseFloat(vehicleData.latitude), parseFloat(vehicleData.longitude));
  updateVehicleData(vehicleData);
  console.log("Vehicle live update:", data);
});

function updateMarkerPostion(latitude, longitude) {
  if (!vehicleMarker) {
    console.warn("Marker is not initialized yet.");
    return;
  }

  url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  openMap();
  
  const latLng = new google.maps.LatLng(latitude, longitude);
  vehicleMarker.position = latLng;
  map.setCenter(latLng);
}

function updateVehicleData(vehicleData) {
  document.getElementById("location").textContent = vehicleData.location || "Unknown Location";
  document.getElementById("speed").textContent = vehicleData.speed || "Unknown Speed";
  document.getElementById("lastUpdate").textContent = vehicleData.date_time || "Unknown Date/Time";
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

  const carContent = document.createElement("img");
  carContent.src = "/static/images/car_green.png";
  carContent.style.width = "18px";
  carContent.style.height = "32px";
  carContent.style.position = "absolute";
  carContent.alt = "Car";

  vehicleMarker = new AdvancedMarkerElement({
    position: latLng,
    map: map,
    title: "Vehicle Location",
    content: carContent,
  });

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

function closePopup() {
  const popup = document.getElementById('popup');
  if (popup) popup.style.display = 'none';
}