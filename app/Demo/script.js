// Import three.js and three-globe
import Globe from 'three-globe';
import * as THREE from 'three';

// Initialize and configure the globe
const globeContainer = document.getElementById('globeContainer');
const preloader = document.getElementById('preloader');

const globe = new Globe()
  .globeImageUrl("/static/uploads/earth-blue-marble.jpg")
  .backgroundImageUrl(null)
  .bumpImageUrl("/static/uploads/earth-topology.png")
  .pointOfView({
    lat: 12.96012189242263,
    lng: 77.57498142420876,
    altitude: 1.5,
  })
  .showAtmosphere(false)
  .atmosphereAltitude(0.25)
  .width(window.innerWidth)
  .height(window.innerHeight);

// Auto-rotation
globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.5;

setTimeout(() => {
  preloader.style.display = "none";
  globeContainer.style.opacity = "1";
}, 3000);

// Resize globe on window resize
window.addEventListener('resize', () => {
  globe.width(window.innerWidth);
  globe.height(window.innerHeight);
});
