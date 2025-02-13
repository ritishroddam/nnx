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



// Car appears on the map

var map;
  var markers = {};
  var geocoder;
  var addressCache = {};
  var lastZeroSpeedTime = {};
  var refreshInterval = 5000; // 1min for page reload
  var infoWindow;
  var countdownTimer = refreshInterval / 1000;
  var openMarker = null;
  var firstFit = true;
  var manualClose = false;
  var dataAvailable = true;
  var sosActiveMarkers = {};
var lastDataReceivedTime = {};

  // Restore markers from session storage if available
function restoreMarkers() {
const storedMarkers = sessionStorage.getItem('vehicleMarkers');
if (storedMarkers) {
    const markerData = JSON.parse(storedMarkers);
    markerData.forEach(device => {
        const latLng = new google.maps.LatLng(device.lat, device.lon);
        const imei = device.imei;
        const iconUrl = device.iconUrl;
        const rotation = device.rotation;
        markers[imei] = createCustomMarker(latLng, iconUrl, rotation);
        addMarkerClickListener(markers[imei], latLng, device);
    });
}
}

  function initMap() {
    const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // Default center
    const offset = -2; // Adjust this value to shift the map to the right
  
    // Calculate the new center based on the offset
    const newCenter = {
      lat: defaultCenter.lat,
      lng: defaultCenter.lng + offset
    };

    map = new google.maps.Map(document.getElementById("map"), {
      
      center: newCenter,
      zoom: 5,
      gestureHandling: "greedy",
      zoomControl: true,

      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
      },
        styles: [
            {
                featureType: "poi", // Hide all Points of Interest (Landmarks)
                elementType: "all",
                stylers: [{ visibility: "off" }]
            },
            {
                featureType: "transit", // Hide transit stations
                elementType: "all",
                stylers: [{ visibility: "off" }]
            },
            {
                featureType: "administrative", // Hide government buildings
                elementType: "all",
                stylers: [{ visibility: "off" }]
            },
            {
                featureType: "road", // Hide road labels (optional)
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });

    geocoder = new google.maps.Geocoder();
    infoWindow = new google.maps.InfoWindow();

    google.maps.event.addListener(infoWindow, "closeclick", function () {
      const infoWindowDiv = document.querySelector(".info-window");

      if (infoWindowDiv) {
        infoWindowDiv.classList.remove("show");
        infoWindowDiv.classList.add("hide");

        setTimeout(function () {
          infoWindow.close();
        }, 300);
      }

      manualClose = true;
      openMarker = null;
    });

    // Restore markers from the previous session
restoreMarkers();

    setInterval(function () {
      if (countdownTimer > 0) {
        countdownTimer--;
        // document.getElementById("countdown").innerText = "Refresh in: " + countdownTimer + "s";
      } else {
    updateMap();
    countdownTimer = refreshInterval / 1000;  // Reset countdown
  }
}, 1000)};

  // Save the current state of markers into session storage
function saveMarkers() {
const markerData = [];
Object.keys(markers).forEach(imei => {
    const marker = markers[imei];
    markerData.push({
        imei: imei,
        lat: marker.latLng.lat(),
        lon: marker.latLng.lng(),
        iconUrl: marker.div.style.backgroundImage.replace('url(', '').replace(')', ''),
        rotation: parseFloat(marker.div.style.transform.replace('rotate(', '').replace('deg)', ''))
    });
});
sessionStorage.setItem('vehicleMarkers', JSON.stringify(markerData));
}


  function parseCoordinates(lat, lon) {
    const parsedLat =
      parseFloat(lat.slice(0, 2)) + parseFloat(lat.slice(2)) / 60;
    const parsedLon =
      parseFloat(lon.slice(0, 3)) + parseFloat(lon.slice(3)) / 60;

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      console.error("Invalid coordinates:", lat, lon);
      return { lat: 0, lon: 0 };
    }

    return { lat: parsedLat, lon: parsedLon };
  }

  function convertSpeedToKmh(speedMph) {
    return speedMph * 1.60934; // Convert mph to km/h
  }

  function getCarIconUrlBySpeed(speedInKmh) {
    if (speedInKmh === 0) {
      return "/vehicle/static/images/car_yellow.png";
    } else if (speedInKmh > 0 && speedInKmh <= 40) {
      return "/vehicle/static/images/car_green.png";
    } else if (speedInKmh > 40 && speedInKmh <= 60) {
      return "/vehicle/static/images/car_blue.png";
    } else {
      return "/vehicle/static/images/car_red.png";
    }
  }

// Function to check if speed is zero for more than 3 hours
function getCarIconBySpeed(speed, imei) {
    const speedInKmh = convertSpeedToKmh(speed);
    let iconUrl = getCarIconUrlBySpeed(speedInKmh);
    
    const now = new Date();

    if (speedInKmh === 0) {
        // Check for last zero speed time
        if (lastZeroSpeedTime[imei]) {
            const timeDiff = now - new Date(lastZeroSpeedTime[imei]);
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            if (hoursDiff >= 3) {
                iconUrl = "/vehicle/static/images/car_black.png";
            }
        } else {
            lastZeroSpeedTime[imei] = now; // Store the time when speed became 0
        }
    } else if (speedInKmh > 0) {
        // Reset if speed increases from 0
        if (lastZeroSpeedTime[imei]) {
            delete lastZeroSpeedTime[imei];
        }
    }

    return iconUrl;
}


// Function to check if data is missing for more than 1 hour
function checkForDataTimeout(imei) {
    const now = new Date();
  const marker = markers[imei];

    if (lastDataReceivedTime[imei]) {
        const timeDiff = now - lastDataReceivedTime[imei];
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (hoursDiff >= 1) {
      // Highlight marker by adding a red border and show tooltip on hover
      marker.div.style.border = "2px solid red";  // Highlight vehicle

      // Add a hover event to show "Old data!" tooltip
      marker.div.addEventListener("mouseover", function () {
        const tooltip = document.createElement("div");
        tooltip.className = "old-data-tooltip";
        tooltip.innerText = "Old data! New data not yet received";
        tooltip.style.position = "absolute";
        tooltip.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        tooltip.style.color = "white";
        tooltip.style.padding = "5px";
        tooltip.style.borderRadius = "5px";
        tooltip.style.top = "-30px";  // Position tooltip above the marker
        tooltip.style.left = "50%";
        tooltip.style.transform = "translateX(-50%)";
        tooltip.style.zIndex = "1000";
        marker.div.appendChild(tooltip);

        // Remove tooltip on mouseout
        marker.div.addEventListener("mouseout", function () {
          tooltip.remove();
        });
      });
    }
  }
}


  function animateMarker(marker, newPosition, duration = 6000) {
    const startPosition = marker.latLng;
    const startTime = performance.now();

    function moveMarker(currentTime) {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const lat =
        startPosition.lat() +
        (newPosition.lat() - startPosition.lat()) * progress;
      const lng =
        startPosition.lng() +
        (newPosition.lng() - startPosition.lng()) * progress;

      marker.latLng = new google.maps.LatLng(lat, lng);
      marker.draw();

      if (progress < 1) {
        requestAnimationFrame(moveMarker);
      }
    }

    requestAnimationFrame(moveMarker);
  }


  function sanitizeIMEI(imei) {
return imei.replace(/[^\w]/g, '').trim();  // Removes all non-alphanumeric characters
}




      function updateMap() {
    fetch('/api/data')
        .then(response => response.json())
        .then(data => {
            var imeiSet = new Set(); // Track unique IMEI numbers
            var bounds = new google.maps.LatLngBounds();
            dataAvailable = true;
            countdownTimer = refreshInterval / 1000;

            data.forEach(device => {
                const imei = sanitizeIMEI(device.imei);

                if (!imeiSet.has(imei)) {
                    imeiSet.add(imei); // Mark IMEI as processed

                    if (device.latitude && device.longitude && device.speed != null && device.course != null) {
                        const coords = parseCoordinates(device.latitude, device.longitude);
                        const latLng = new google.maps.LatLng(coords.lat, coords.lon);
                        const iconUrl = getCarIconBySpeed(device.speed, imei);
                        const rotation = device.course;

                        if (markers[imei]) {
                            // Update existing marker
                            animateMarker(markers[imei], latLng);
                            updateCustomMarker(markers[imei], latLng, iconUrl, rotation);
                            markers[imei].device = device; // Update device data
                            updateInfoWindow(markers[imei], latLng, device, coords);
                        } else {
                            // Create a new marker
                            markers[imei] = createCustomMarker(latLng, iconUrl, rotation, device);
                            addMarkerClickListener(markers[imei], latLng, device, coords);
                        }

                        if (device.sos === "1") {
                            triggerSOS(imei, markers[imei]);
                        } else {
                            removeSOS(imei);
                        }

                        // Update last data received time
                        lastDataReceivedTime[imei] = new Date();

                        bounds.extend(latLng);
                    }

                    // Check if data is missing for more than 1 hour
                    checkForDataTimeout(imei);
                }
            });

            saveMarkers();

            if (!bounds.isEmpty() && firstFit) {
                map.fitBounds(bounds);
                firstFit = false;
            }

            // Apply current speed filter after updating markers
            // filterVehiclesBySpeed();
          filterVehicles();
        })
        .catch(error => {
            console.error("Error fetching data:", error);
            dataAvailable = false;
        });
}

  



      function triggerSOS(imei, marker) {
  if (!sosActiveMarkers[imei]) {
    // Add the SOS icon
    const sosDiv = document.createElement("div");
    sosDiv.className = "sos-blink";
    marker.div.appendChild(sosDiv);
    sosActiveMarkers[imei] = sosDiv;

    // Add blinking effect to the vehicle icon
    marker.div.classList.add("vehicle-blink");

    // Automatically remove the SOS after 60 seconds
    setTimeout(() => {
      removeSOS(imei);
    }, 60000);
  }
}

function removeSOS(imei) {
  if (sosActiveMarkers[imei]) {
    sosActiveMarkers[imei].remove();
    delete sosActiveMarkers[imei];
  }
  // Remove the blinking effect from the vehicle icon
  if (markers[imei]) {
    markers[imei].div.classList.remove("vehicle-blink");
  }
}


  function formatDateTime(dateString, timeString) {
    const day = dateString.slice(0, 2);
    const month = dateString.slice(2, 4);
    const year = "20" + dateString.slice(4);
    let hour = parseInt(timeString.slice(0, 2), 10);
    const minute = timeString.slice(2, 4);
    const second = timeString.slice(4, 6);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;

    const formattedDate = `${day}/${month}/${year}`;
    const formattedTime = `${hour}:${minute}:${second} ${ampm}`;
    return { formattedDate, formattedTime };
  }


      function addMarkerClickListener(marker, latLng, device, coords) {
    geocodeLatLng(latLng, function (address) {
        marker.div.addEventListener("click", function () {
            if (openMarker !== marker) {
                const imei = device.imei
                    ? device.imei
                    : '<span class="missing-data">N/A</span>';
                const speed =
                    device.speed !== null && device.speed !== undefined
                        ? `${convertSpeedToKmh(device.speed).toFixed(2)} km/h`
                        : '<span class="missing-data">Unknown</span>';
                const lat =
                    coords.lat !== null && coords.lat !== undefined
                        ? coords.lat.toFixed(6)
                        : '<span class="missing-data">Unknown</span>';
                const lon =
                    coords.lon !== null && coords.lon !== undefined
                        ? coords.lon.toFixed(6)
                        : '<span class="missing-data">Unknown</span>';
                const date = device.date || "N/A";
                const time = device.time || "N/A";
                const addressText = address
                    ? address
                    : '<span class="missing-data">Location unknown</span>';

                const { formattedDate, formattedTime } = formatDateTime(date, time);
                const content = `<div class="info-window show">
                        <strong>IMEI:</strong> ${imei}<br>
                        <hr>
                        <p><strong>Speed:</strong> ${speed}</p>
                        <p><strong>Lat:</strong> ${lat}</p>
                        <p><strong>Lon:</strong> ${lon}</p>
                        <p><strong>Last Update:</strong> ${formattedDate} ${formattedTime}</p> 
                        <p class="address"><strong>Location:</strong> ${addressText}</p>
                        <p><strong>Data:</strong> <a href="device-details.html?imei=${device.imei || "N/A"}" target="_blank">View Data</a></p>
                    </div>`;

                // Send the location to the backend
                if (addressText !== "Location unknown") {
                    // Send the IMEI and address to the backend for storage
                    fetch("/api/store-location", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            imei: imei,
                            location: addressText,
                        }),
                    })
                        .then(response => response.json())
                        .then(data => {
                            console.log("Location stored in database:", data);
                        })
                        .catch(error => {
                            console.error("Error storing location:", error);
                        });
                }

                if (openMarker !== marker) {
                    infoWindow.setContent(content);
                    infoWindow.setPosition(latLng);

                    const infoWindowDiv = document.querySelector(".info-window");

                    if (infoWindowDiv) {
                        infoWindowDiv.classList.remove("hide");
                        infoWindowDiv.classList.add("show");
                    }

                    infoWindow.open(map, marker);
                    openMarker = marker;
                    manualClose = false;
                }
            }
        });
    });
}







// dfhsgf
  function updateInfoWindow(marker, latLng, device, coords) {
    geocodeLatLng(latLng, function (address) {
      if (openMarker === marker && !manualClose) {
        const { formattedDate, formattedTime } = formatDateTime(
          device.date,
          device.time
        );
        const content = `<div class="info-window show">
                <strong>IMEI:</strong> ${device.imei}<br>
                <hr>
                <p><strong>Speed:</strong> ${convertSpeedToKmh(
                  device.speed
                ).toFixed(2)} km/h</p>
                <p><strong>Lat:</strong> ${coords.lat.toFixed(6)}</p>
                <p><strong>Lon:</strong> ${coords.lon.toFixed(6)}</p>
                <p><strong>Last Update:</strong> ${formattedDate} ${formattedTime}</p> 
                <p class="address"><strong>Location:</strong> ${address}</p>
                <p><strong>Data:</strong> <a href="device-details.html?imei=${
                  device.imei
                }" target="_blank">View Data</a></p>
            </div>`;
        infoWindow.setContent(content);
        infoWindow.setPosition(latLng);
        infoWindow.open(map, marker);
      }
    });
  }



  function filterVehicles() {
    const filterValue = document.getElementById("speed-filter").value;

  Object.keys(markers).forEach((imei) => {
    const marker = markers[imei];
    const speedKmh = marker.device.speed ? convertSpeedToKmh(marker.device.speed) : 0; // Speed in km/h
    const hasSOS = marker.device.sos === "1"; // Check if SOS is active
    let isVisible = false;

    switch (filterValue) {
      case "0":
        isVisible = speedKmh === 0;
        break;
      case "0-40":
        isVisible = speedKmh > 0 && speedKmh <= 40;
        break;
      case "40-60":
        isVisible = speedKmh > 40 && speedKmh <= 60;
        break;
      case "60+":
        isVisible = speedKmh > 60;
        break;
      case "sos":
        isVisible = hasSOS;
        break;
      default: // "all"
        isVisible = true;
        break;
    }

    // Set marker visibility
    marker.setVisible(isVisible);
  });
}


      
  function createCustomMarker(latLng, iconUrl, rotation, device) {
    const div = document.createElement("div");
    div.className = "custom-marker";
    div.style.backgroundImage = `url(${iconUrl})`;
    div.style.transform = `rotate(${rotation}deg)`;

    const marker = new google.maps.OverlayView();
    marker.div = div;
    marker.latLng = latLng;
    marker.device = device;

    marker.onAdd = function () {
      const panes = this.getPanes();
      panes.overlayMouseTarget.appendChild(div);
    };

    marker.draw = function () {
      const point = this.getProjection().fromLatLngToDivPixel(this.latLng);
      if (point) {
        div.style.left = point.x - div.offsetWidth / 2 + "px";
        div.style.top = point.y - div.offsetHeight / 2 + "px";
      }
    };

    marker.onRemove = function () {
      div.parentNode.removeChild(div);
    };

    marker.setVisible = function (visible) {
        div.style.display = visible ? "block" : "none";
    };

    marker.setMap(map);
    addMarkerClickListener(marker, latLng, {}, {});
    return marker;
  }

//////////////////////
  function updateCustomMarker(marker, latLng, iconUrl, rotation) {
    marker.latLng = latLng;
    marker.div.style.backgroundImage = `url(${iconUrl})`;
    marker.div.style.transform = `rotate(${rotation}deg)`;
    marker.draw();

    addMarkerClickListener(marker, latLng, {}, {});
  }

//////////////////////
  function geocodeLatLng(latLng, callback) {
    const lat = latLng.lat().toFixed(6);
    const lon = latLng.lng().toFixed(6);
    const key = `${lat},${lon}`;

    if (addressCache[key]) {
      callback(addressCache[key]);
    } else {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=AIzaSyCPEMAElTxMzur0DK-Mh3fPUVmdQVBJu8A`;

      fetch(geocodeUrl)
        .then((response) => response.json())
        .then((data) => {
          if (data.status === "OK" && data.results[0]) {
            const address = data.results[0].formatted_address;
            addressCache[key] = address;
            callback(address);
          } else {
            callback("No address found");
          }
        })
        .catch((error) => {
          console.error("Error fetching geocode data:", error);
          callback("Error fetching address");
        });
    }
  }

  window.onload = initMap;
