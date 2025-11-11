window.onload = initMap();

const socket = io("https://cordonnx.com", {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
})

let map;
let markers = {};
let activeInfoWindow = null;

async function initMap() {
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker")
    const bounds = new google.maps.LatLngBounds();
    
    map = new Map(document.getElementById("map"), {
        mapId: "dc4a8996aab2cac9",
        zoom: 10,
    })

    vehiclesData.forEach(vehicle => {
        if (vehicle.latitude && vehicle.longitude) {
            const latLng = new google.maps.LatLng(
                parseFloat(vehicle.latitude),
                parseFloat(vehicle.longitude)
            );
            
            bounds.extend(latLng)

            const carContent = document.createElement("img");
            carContent.src = "/static/images/car_green.png";
            carContent.style.width = "18px";
            carContent.style.height = "32px";
            carContent.alt = "Vehicle"

            const marker = new AdvancedMarkerElement({
                position: latLng,
                map: map,
                title: vehicle.licensePlateNumber,
                content: carContent,
            })

            markers[vehicle.licensePlateNumber] = marker

            marker.addListener('click', () => {
                if (activeInfoWindow) {
                    activeInfoWindow.close();
                }

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div>
                            <h3>${vehicle.licensePlateNumber}</h3>
                            <p>Location: ${vehicle.location || 'Unknown'}</p>
                            <p>Speed: ${vehicle.speed || 'Unknown'} km/h</p>
                            <p>Last Update: ${vehicle.date_time || 'Unknown'}</p>
                        </div>
                    `
                });
                infoWindow.open(map, marker);
                activeInfoWindow = infoWindow;
                highlightVehicleCard(vehicle.licensePlateNumber);
            });
        }
    })

    if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
        
        const listener = google.maps.event.addListener(map, "idle", function () {
            if (map.getZoom() > 15) map.setZoom(15);
            google.maps.event.removeListener(listener);
        });
}
setupCardHoverEvents();
}

function setupCardHoverEvents() {
    const vehicleCards = document.querySelectorAll('.vehicle-card');
    
    vehicleCards.forEach(card => {
        const licensePlate = card.getAttribute('data-license-plate');
        const latitude = card.getAttribute('data-latitude');
        const longitude = card.getAttribute('data-longitude');
        
        if (latitude && longitude) {
            card.addEventListener('mouseenter', () => {
                card.classList.add('active');
                
                zoomToVehicle(licensePlate, parseFloat(latitude), parseFloat(longitude));
            });
            
            card.addEventListener('mouseleave', () => {
                card.classList.remove('active');
            });
        }
    });
}

function zoomToVehicle(licensePlate, lat, lng) {
    if (!map) return;
    
    const marker = markers[licensePlate];
    if (marker) {
        map.setCenter({ lat, lng });
        
        if (map.getZoom() < 14) {
            map.setZoom(14);
        }
    }
}

function highlightVehicleCard(licensePlate) {
    const allCards = document.querySelectorAll('.vehicle-card');
    allCards.forEach(card => card.classList.remove('active'));
    
    const targetCard = document.querySelector(`[data-license-plate="${licensePlate}"]`);
    if (targetCard) {
        targetCard.classList.add('active');
        
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

socket.on("connect", () => {
    console.log("Connected to socket for live updates");
    vehiclesData.forEach(vehicle => {
        socket.emit("subscribe_vehicle_updates", {
            LicensePlateNumber: vehicle.licensePlateNumber
        });
    });
})

socket.on("subscription_success", (data) => {
  console.log("Subscription successful:", data);
});

socket.on("subscription_error", (error) => {
  console.error("Subscription error:", error);
});

socket.on("vehicle_live_update", (data) => {
    if (data && data.latitude && data.longitude && markers[data.LicensePlateNumber]) {
        const marker = markers[data.LicensePlateNumber];
        const newPosition = new google.maps.LatLng(
            parseFloat(data.latitude),
            parseFloat(data.longitude)
        );
            
        marker.position = newPosition;   
        updateVehicleInfo(data);

        const card = document.querySelector(`[data-license-plate="${data.LicensePlateNumber}"]`);
                if (card) {
                    card.setAttribute('data-latitude', data.latitude);
                    card.setAttribute('data-longitude', data.longitude);
                }
    }
});

 function updateVehicleInfo(vehicleData) {
            const vehicleElement = document.querySelector(`[data-license-plate="${vehicleData.LicensePlateNumber}"]`);
            if (vehicleElement) {
                const locationEl = vehicleElement.querySelector('.detail-row:nth-child(3) .detail-value');
                const speedEl = vehicleElement.querySelector('.detail-row:nth-child(2) .detail-value');
                const updateEl = vehicleElement.querySelector('.detail-row:nth-child(1) .detail-value');
                
                if (locationEl) locationEl.textContent = vehicleData.address || 'Unknown Location';
                if (speedEl) {
                    if (vehicleData.speed && vehicleData.speed !== '' && parseInt(vehicleData.speed) === 0) {
                        speedEl.textContent = `Stopped: ${vehicleData.speed} kmph, since 0 seconds`;
                    } else if (vehicleData.speed && vehicleData.speed !== '') {
                        speedEl.textContent = `Moving: ${vehicleData.speed} kmph`;
                    } else {
                        speedEl.textContent = 'Unknown Speed';
                    }
                }
                if (updateEl) updateEl.textContent = new Date().toLocaleString();
            }
        }