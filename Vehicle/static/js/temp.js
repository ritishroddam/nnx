// const socket = io(CONFIG.SOCKET_SERVER_URL);

// socket.on('connect', function() {
//     console.log('Connected to WebSocket server');
//     socket.emit('request_vehicle_data');
// });

// socket.on('vehicle_update', function(data) {
//     console.log('Vehicle update received:', data);
//     updateVehicleData(data);
// });

// socket.on('sos_alert', function(data) {
//     console.log('SOS alert received:', data);
//     const imei = sanitizeIMEI(data.imei);
//     if (markers[imei]) {
//         triggerSOS(imei, markers[imei]);
//     }
// });

// function updateVehicleData(vehicle) {
//     const imei = sanitizeIMEI(vehicle.imei);
//     const coords = parseCoordinates(vehicle.latitude, vehicle.longitude);
//     const latLng = new google.maps.LatLng(coords.lat, coords.lon);
//     const iconUrl = getCarIconBySpeed(vehicle.speed, imei);
//     const rotation = vehicle.course;

//     if (markers[imei]) {
//         animateMarker(markers[imei], latLng);
//         updateCustomMarker(markers[imei], latLng, iconUrl, rotation);
//         markers[imei].device = vehicle;
//         updateInfoWindow(markers[imei], latLng, vehicle, coords);
//     } else {
//         markers[imei] = createCustomMarker(latLng, iconUrl, rotation, vehicle);
//         addMarkerClickListener(markers[imei], latLng, vehicle, coords);
//     }

//     if (vehicle.sos === "1") {
//         triggerSOS(imei, markers[imei]);
//     } else {
//         removeSOS(imei);
//     }

//     lastDataReceivedTime[imei] = new Date();
//     renderVehicles(Object.values(markers).map(marker => marker.device));
// }

// function fetchVehicleData() {
//     socket.emit('request_vehicle_data');
// }

// function renderVehicles(vehicles) {
//     const listContainer = document.getElementById("vehicle-list");
//     const countContainer = document.getElementById("vehicle-count");
//     listContainer.innerHTML = "";
//     countContainer.innerText = vehicles.length;

//     vehicles.forEach(vehicle => {
//         const imei = sanitizeIMEI(vehicle.imei);

//         const vehicleElement = document.createElement("div");
//         vehicleElement.classList.add("vehicle-card");
//         vehicleElement.setAttribute("data-imei", vehicle.imei);

//         const latitude = vehicle.latitude ? parseFloat(vehicle.latitude) : null;
//         const longitude = vehicle.longitude ? parseFloat(vehicle.longitude) : null;

//         vehicleElement.innerHTML = `
//             <div class="vehicle-header">${vehicle.imei} - ${vehicle.status || 'Unknown'}</div>
//             <div class="vehicle-info">
//                 <strong>Speed:</strong> ${vehicle.speed ? convertSpeedToKmh(vehicle.speed).toFixed(2) + ' km/h' : 'Unknown'} <br>
//                 <strong>Lat:</strong> ${latitude !== null ? latitude.toFixed(6) : 'Unknown'} <br>
//                 <strong>Lon:</strong> ${longitude !== null ? longitude.toFixed(6) : 'Unknown'} <br>
//                 <strong>Last Update:</strong> ${vehicle.date || 'N/A'} ${vehicle.time || 'N/A'} <br>
//                 <strong>Location:</strong> ${vehicle.address || 'Location unknown'} <br>
//                 <strong>Data:</strong> <a href="device-details.html?imei=${vehicle.imei}" target="_blank">View Data</a>
//             </div>
//         `;

//         // Add hover event listener to zoom in on the map and show the info window
//         vehicleElement.addEventListener("mouseover", () => {
//             const marker = markers[imei];
//             if (marker) {
//                 map.setZoom(15);
//                 map.panTo(marker.latLng);
//                 updateInfoWindow(marker, marker.latLng, marker.device, { lat: marker.latLng.lat(), lon: marker.latLng.lng() });
//             }
//         });

//         listContainer.appendChild(vehicleElement);
//     });
// }

// function initMap() {
//   const defaultCenter = { lat: 20.5937, lng: 78.9629 };
//   const offset = -5;

//   const newCenter = {
//       lat: defaultCenter.lat,
//       lng: defaultCenter.lng + offset
//   };

//   // Dark Mode Styles
//   const darkModeStyle = [
//       { elementType: "geometry", stylers: [{ color: "#212121" }] },
//       { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
//       { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
//       { featureType: "road", elementType: "geometry", stylers: [{ color: "#373737" }] },
//       { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
//       { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
//       { elementType: "labels.icon", stylers: [{ "visibility": "off" }]},
//   ];

//   // Default/Light Mode Styles
//   const lightModeStyle = [
//     { "elementType": "geometry",  "stylers": [{"color": "#f5f5f5"}]},
//     {"elementType": "labels.icon","stylers": [{"visibility": "off"}]},
//     {"elementType": "labels.text.fill","stylers": [{"color": "#616161"}]},
//     {"elementType": "labels.text.stroke","stylers": [{"color": "#f5f5f5"}]},
//     {"featureType": "administrative.land_parcel","elementType": "labels.text.fill","stylers": [{"color": "#bdbdbd"}]},
//     {"featureType": "poi","elementType": "geometry","stylers": [{"color": "#eeeeee"}]},
//     {"featureType": "poi","elementType": "labels.text.fill","stylers": [{"color": "#757575"}]},
//     {"featureType": "poi.park","elementType": "geometry","stylers": [{"color": "#defff0"}]},
//     {"featureType": "poi.park","elementType": "labels.text.fill","stylers": [{"color": "#9e9e9e"}]},
//     {"featureType": "road","elementType": "geometry","stylers": [{"color": "#ffffff"}]},
//     {"featureType": "road.arterial","elementType": "labels.text.fill","stylers": [{"color": "#757575"}]},
//     {"featureType": "road.highway","elementType": "geometry","stylers": [{"color": "#dadada"}]},
//     {"featureType": "road.highway","elementType": "labels.text.fill","stylers": [{"color": "#616161"}]},
//     {"featureType": "road.local","elementType": "labels.text.fill","stylers": [ {"color": "#9e9e9e"}]},
//     {"featureType": "transit.line","elementType": "geometry", "stylers": [{"color": "#e5e5e5"}]},
//     {"featureType": "transit.station","elementType": "geometry","stylers": [{"color": "#eeeeee"}]},
//     {"featureType": "water","elementType": "geometry","stylers": [{"color": "#def2ff"}]},
//     {"featureType": "water","elementType": "labels.text.fill","stylers": [{"color": "#9e9e9e"}]}
//   ];

//   // Initialize Map
//   map = new google.maps.Map(document.getElementById("map"), {
//       center: newCenter,
//       zoom: 5,
//       gestureHandling: "greedy",
//       zoomControl: true,
//       mapTypeControl: false, // Disable default map type buttons
//       clickableIcons: false, // Disable POI icons
//       styles: lightModeStyle, // Default to dark mode
//       zoomControlOptions: {
//           position: google.maps.ControlPosition.RIGHT_BOTTOM,
//       },
//   });

//   geocoder = new google.maps.Geocoder();
//   infoWindow = new google.maps.InfoWindow();

//   google.maps.event.addListener(infoWindow, "closeclick", function () {
//       const infoWindowDiv = document.querySelector(".info-window");

//       if (infoWindowDiv) {
//           infoWindowDiv.classList.remove("show");
//           infoWindowDiv.classList.add("hide");

//           setTimeout(function () {
//               infoWindow.close();
//           }, 300);
//       }

//       manualClose = true;
//       openMarker = null;
//   });

//   restoreMarkers();
//   fetchVehicleData();

//   // Add Toggle Button
//   const toggleButton = document.createElement("button");
//   toggleButton.textContent = "Switch to Dark Map";
//   toggleButton.style.position = "absolute";
//   toggleButton.style.bottom = "20px";
//   toggleButton.style.right = "20px";
//   toggleButton.style.zIndex = "1000";
//   toggleButton.style.padding = "10px 15px";
//   toggleButton.style.background = "#fff";
//   toggleButton.style.border = "1px solid #ccc";
//   toggleButton.style.borderRadius = "5px";
//   toggleButton.style.cursor = "pointer";
//   toggleButton.style.boxShadow = "2px 2px 5px rgba(0, 0, 0, 0.3)";
//   toggleButton.style.fontSize = "14px";
//   toggleButton.style.fontWeight = "bold";
//   toggleButton.style.color = "#333";

//   document.getElementById("map").appendChild(toggleButton);

//   // Set initial mode to dark mode
//   let darkMode = true;

//   toggleButton.addEventListener("click", function () {
//       if (darkMode) {
//           map.setOptions({ styles: darkModeStyle });
//           toggleButton.textContent = "Switch to Standard Map";
//       } else {
//           map.setOptions({ styles: lightModeStyle });
//           toggleButton.textContent = "Switch to Dark Map";
//       }
//       darkMode = !darkMode; // Toggle the state
//   });
  
// }