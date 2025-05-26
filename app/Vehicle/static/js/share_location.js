window.onload =  initMap;

let marker;

const socket = io("https://cordonnx.com:5000", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.on("connect", () => {
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
  if (!data || !data.Latitude || !data.Longitude) {
    console.warn("Invalid vehicle data received:", data);
    return;
  }

  console.log("Received vehicle live update:", data);

  const vehicleData = {
    latitude: data.Latitude,
    longitude: data.Longitude,
    location: data.address || "",
    speed: data.Speed || 0,
  }

  updateMarkerPostion(parseFloat(vehicleData.latitude), parseFloat(vehicleData.longitude));
  updateVehicleData(vehicleData);
  console.log("Vehicle live update:", data);
});

function updateMarkerPostion(latitude, longitude) {
  if (!marker) {
    console.warn("Marker is not initialized yet.");
    return;
  }

  const latLng = new google.maps.LatLng(latitude, longitude);
  marker.setPosition(latLng);
}

function updateVehicleData(vehicleData) {
  document.getElementById("location").textContent = vehicleData.location || "Unknown Location";
  document.getElementById("speed").textContent = vehicleData.speed || "Unknown Speed";
}

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const lat = parseFloat(window.vehicleLat);
  const lng = parseFloat(window.vehicleLng);

  const latLng = new google.maps.LatLng(lat, lng);

  const map = new Map(document.getElementById("map"), {
    mapId: "dc4a8996aab2cac9",
    center: latLng,
    zoom: 16,
  });

  marker = new AdvancedMarkerElement({
    position: latLng,
    map: map,
    title: "Vehicle Location",
  });

  document.getElementById("route-btn").onclick = function () {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
  };
}
