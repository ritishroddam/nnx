function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: 12.9716, lng: 77.5946 },
      zoom: 12,
  });

  google.maps.event.addListenerOnce(map, 'idle', function() {
      const bounds = map.getBounds();
      const center = bounds.getCenter();
      const span = bounds.toSpan();
      const newCenter = {
          lat: center.lat(),
          lng: center.lng() + span.lng() / -5
      };
      map.setCenter(newCenter);
  });
}
window.onload = initMap;

const vehicles = [
    { id: "KA51AH8074", status: "Idling", duration: "2h 33m", speed: "0 km/h", voltage: "10.36V", location: "Horamavu Agara" },
    { id: "KA03AG3033", status: "Stopped", duration: "1d 13h", speed: "0 km/h", voltage: "12.23V", location: "Thirumala Layout" },
    { id: "KA03AK0471", status: "Stopped", duration: "12h 21m", speed: "0 km/h", voltage: "X.XXV", location: "Bangalore Urban" }
];

function renderVehicles() {
  const listContainer = document.getElementById("vehicle-list");
  const countContainer = document.getElementById("vehicle-count");
  listContainer.innerHTML = "";
  countContainer.innerText = vehicles.length;

  vehicles.forEach(vehicle => {
    const vehicleElement = document.createElement("div");
    vehicleElement.classList.add("vehicle-card");
    vehicleElement.innerHTML = `
      <div class="vehicle-header">${vehicle.id} - ${vehicle.status}</div>
      <div class="vehicle-info">
        <strong>Duration:</strong> ${vehicle.duration} <br>
        <strong>Speed:</strong> ${vehicle.speed} <br>
        <strong>Battery:</strong> ${vehicle.voltage} <br>
        <strong>Location:</strong> ${vehicle.location}
      </div>
    `;
    listContainer.appendChild(vehicleElement);
  });
}

renderVehicles();

document.querySelector(".toggle-slider").addEventListener("click", function() {
  this.classList.toggle("active");
});
