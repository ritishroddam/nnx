function setCookie(name, value) {
  document.cookie = `${name}=${value};path=/`;
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

let map;
const cameraOptions = {
  tilt: 0,
  heading: 0,
  zoom: 2.5,
  center: { lat: 0, lng: 0 }, // Equator
};

const mapOptions = {
  ...cameraOptions,
  mapId: "f32dd48f00948a566626b232",
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: "none",
  draggable: false,
  keyboardShortcuts: false,
  scrollwheel: false,
  disableDoubleClickZoom: true,
};

let panAnimationId = null;
let currentLng = 0;

(async () => {
  const [{ Map }] = await Promise.all([
    google.maps.importLibrary("maps"),
    google.maps.importLibrary("core"),
  ]);

  map = new Map(document.getElementById("map"), mapOptions);

  function animatePan() {
    currentLng += 0.2; // Adjust speed here
    if (currentLng > 180) currentLng = -180;
    map.setCenter({ lat: 0, lng: currentLng });
    panAnimationId = requestAnimationFrame(animatePan);
  }

  animatePan();
})();