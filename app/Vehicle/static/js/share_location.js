window.onload = function () {
  const lat = window.vehicleLat;
  const lng = window.vehicleLng;
  const token = window.shareToken; // Set this variable in your template
  const map = new google.maps.Map(document.getElementById("map"), {
    center: { lat, lng },
    zoom: 16,
  });
  let marker = new google.maps.Marker({
    position: { lat, lng },
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
