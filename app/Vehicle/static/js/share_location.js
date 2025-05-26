window.onload =  initMap;

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

  let marker = new AdvancedMarkerElement({
    position: latLng,
    map: map,
    title: "Vehicle Location",
  });

  document.getElementById("route-btn").onclick = function () {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
  };
}
