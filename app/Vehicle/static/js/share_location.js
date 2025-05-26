window.onload =  initMap;

const token = window.shareToken; 

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const lat = window.vehicleLat;
  const lng = window.vehicleLng;

  const latLng = new google.maps.LatLng(lat, lng);

  const map = new Map(document.getElementById("map"), {
    mapId: "e426c1ad17485d79",
    center: latLng,
    zoom: 16,
  });

  let marker = new AdvancedMarkerElement({
    position: latLng,
    map: map,
    title: "Vehicle Location",
  });

  document.getElementById("route-btn").onclick = function () {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
  };

  // Connect to WebSocket
  const socket = io(); // Assumes Socket.IO JS is loaded

  socket.emit('join', { token });

  socket.on('location_update', function (data) {
    if (data.latitude && data.longitude) {
      const newLatLng = { lat: data.latitude, lng: data.longitude };
      marker.setPosition(newLatLng);
      map.setCenter(newLatLng);
    }
  });
};
