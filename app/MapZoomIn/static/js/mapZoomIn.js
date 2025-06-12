let fullMap;
const cameraOptions = {
  tilt: 0,
  heading: 0,
  zoom: 3,
  center: { lat: 12.9716, lng:  77.5946 },
};

const mapOptions = {
  ...cameraOptions,
  mapId: "f32dd48f00948a56c802fc00",
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

let rotationTween = null;
let zoomTween = null;

function startInfiniteRotation() {
  function rotate() {
    cameraOptions.heading = 0;
    rotationTween = new TWEEN.Tween(cameraOptions)
      .to({ heading: 360 }, 30000)
      .easing(TWEEN.Easing.Linear.None)
      .onUpdate(() => {
        fullMap.moveCamera(cameraOptions);
      })
      .onComplete(() => {
        rotate();
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

function startZoomAnimation() {
  stopRotation();
  cameraOptions.tilt = 0;
  cameraOptions.heading = 0;
  cameraOptions.zoom = 3;
  cameraOptions.center = { lat: parseFloat(window.lat) || 12.9716, lng: parseFloat(window.lng) || 77.5946 };
  fullMap.moveCamera(cameraOptions);

  zoomTween = new TWEEN.Tween(cameraOptions)
    .to({ tilt: 65, heading: 90, zoom: 18 }, 15000)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(() => {
      fullMap.moveCamera(cameraOptions);
    })
    .onComplete(() => {
      setTimeout(() => {
        window.location.href = "/vehicle/map";
      }, 3000); // Wait 3 seconds before redirect
    })
    .start();
}

function animate(time) {
  requestAnimationFrame(animate);
  TWEEN.update(time);
}

(async () => {
  const [{ Map }] = await Promise.all([
    google.maps.importLibrary("maps"),
    google.maps.importLibrary("core"),
  ]);
  fullMap = new Map(document.getElementById("fullMap"), mapOptions);
  requestAnimationFrame(animate);
  startInfiniteRotation();
  setTimeout(startZoomAnimation, 1000); // 3s rotation, then zoom
})();