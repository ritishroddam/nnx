function setCookie(name, value) {
  document.cookie = `${name}=${value};path=/`;
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

document.addEventListener("DOMContentLoaded", async function () {
  let isDarkModeMap = true;
  const darkModePreference = getCookie("darkMode");
  const body = document.body;
  if (darkModePreference === "true") {
    body.classList.add("dark-mode");
    isDarkModeMap = true;
  } else {
    body.classList.remove("dark-mode");
    isDarkModeMap = false;
  }

  const mapId = isDarkModeMap
    ? "f32dd48f00948a56c802fc00"
    : "f32dd48f00948a566626b232";

  const cameraOptions = {
    tilt: 0,
    heading: 0,
    zoom: 3,
    center: { lat: 12.9716, lng: 77.5946 },
  };

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

  let fullMap;
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

  async function startZoomAnimation() {

    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    const marker = new AdvancedMarkerElement({
      map: fullMap,
      position: { lat: parseFloat(window.lat) || 12.9716, lng: parseFloat(window.lng) || 77.5946 },
    });
    const labelDiv = document.createElement("div");
    labelDiv.textContent = window.companyName || "Cordon Telematics Pvt Ltd";
    labelDiv.style.position = "absolute";
    labelDiv.style.top = "-28px";
    labelDiv.style.left = "50%";
    labelDiv.style.transform = "translateX(-50%)";
    labelDiv.style.background = isDarkModeMap ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)";
    labelDiv.style.color = isDarkModeMap ? "black" : "#fff";
    labelDiv.style.padding = "2px 8px";
    labelDiv.style.borderRadius = "4px";
    labelDiv.style.fontSize = "14px";
    labelDiv.style.whiteSpace = "nowrap";
    labelDiv.style.pointerEvents = "none";

    marker.content = document.createElement("div");
    marker.content.style.position = "relative";
    marker.content.appendChild(labelDiv);

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
        }, 3000);
      })
      .start();
  }

  function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
  }

  const [{ Map }] = await Promise.all([
    google.maps.importLibrary("maps"),
    google.maps.importLibrary("core"),
  ]);
  fullMap = new Map(document.getElementById("fullMap"), mapOptions);
  requestAnimationFrame(animate);
  startInfiniteRotation();
  setTimeout(await startZoomAnimation, 1000);
});