window.onload = function () {
  const lat = window.vehicleLat;
  const lng = window.vehicleLng;
  const map = new google.maps.Map(document.getElementById("map"), {
    center: { lat, lng },
    zoom: 16,
  });
  const marker = new google.maps.Marker({
    position: { lat, lng },
    map: map,
    title: "Vehicle Location",
  });

  document.getElementById("route-btn").onclick = function () {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
  };
};
