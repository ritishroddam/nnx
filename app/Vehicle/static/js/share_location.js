window.onload =  initMap;

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const lat = window.vehicleLat;
  const lng = window.vehicleLng;

  const latLng = new google.maps.LatLng(lat, lng);

  console.log("Initializing map at:", latLng, lat, lng, latLng.lat(), latLng.lng());

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
}
