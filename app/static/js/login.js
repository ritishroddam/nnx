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
  zoom: 3,
  center: { lat: 12.9716, lng: 77.5946 },
};

const mapOptions = {
  ...cameraOptions,
  mapId: "f32dd48f00948a56c802fc00",
  disableDefaultUI: true,      // disables ALL controls
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: "none",     // disables user interaction
  draggable: false,
  keyboardShortcuts: false,
  scrollwheel: false,
  disableDoubleClickZoom: true,
};

let rotationTween = null;
let zoomTween = null;

(async () => {
  // Wait for the Maps library to be loaded
  const [{ Map }] = await Promise.all([
    google.maps.importLibrary("maps"),
    google.maps.importLibrary("core"),
  ]);

  map = new Map(document.getElementById("map"), mapOptions);

  function startInfiniteRotation() {
    function rotate() {
      cameraOptions.heading = 0;
      rotationTween = new TWEEN.Tween(cameraOptions)
        .to({ heading: 360 }, 30000) // Slower: 30 seconds per rotation
        .easing(TWEEN.Easing.Linear.None)
        .onUpdate(() => {
          map.moveCamera(cameraOptions);
        })
        .onComplete(() => {
          rotate(); // Loop
        })
        .start();
    }
    rotate();
  }

  function stopRotation() {
    if (rotationTween) {
      rotationTween.stop();
      rotationTween = null;
    }
  }

  document.getElementById("start-animation").addEventListener("click", () => {
    stopRotation();
    // Reset camera options for repeatable animation
    cameraOptions.tilt = 0;
    cameraOptions.heading = 0;
    cameraOptions.zoom = 3;
    cameraOptions.center = { lat: 12.9716, lng: 77.5946 };
    map.moveCamera(cameraOptions);

    zoomTween = new TWEEN.Tween(cameraOptions)
      .to({ tilt: 65, heading: 90, zoom: 18 }, 15000) // Slower: 15 seconds for zoom
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate(() => {
        map.moveCamera(cameraOptions);
      })
      .start();
  });

  function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
  }

  requestAnimationFrame(animate);
  startInfiniteRotation();
})();