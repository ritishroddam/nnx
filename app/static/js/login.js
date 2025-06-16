function setCookie(name, value) {
  document.cookie = `${name}=${value};path=/`;
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

let isDarkModeMap = true;

document.addEventListener("DOMContentLoaded", async function () {
  const darkModePreference = getCookie("darkMode");
  if (darkModePreference === "true") {
    body.classList.add("dark-mode");
  } else {
    body.classList.remove("dark-mode");
    isDarkModeMap = false;
  }
});

let map;
const cameraOptions = {
  tilt: 0,
  heading: 0,
  zoom: 2.5,
  center: { lat: 0, lng: 0 }, // Equator
};

const mapId = isDarkModeMap ? "f32dd48f00948a56c802fc00" : "f32dd48f00948a566626b232";

const mapOptions = {
  ...cameraOptions,
  mapId: mapId,
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