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
let trackedVehicle = null;

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

            // Get course from vehicle data (convert to number)
            const course = vehicle.course ? parseFloat(vehicle.course) : 0;
            
            // Create marker with proper rotation
            const markerElement = createRotatableMarker(course);
            
            const marker = new AdvancedMarkerElement({
                position: latLng,
                map: map,
                title: vehicle.licensePlateNumber,
                content: markerElement,
            })

            // Store marker data
            marker.licensePlate = vehicle.licensePlateNumber;
            marker.currentPosition = latLng;
            marker.currentCourse = course;

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
                            <p>Course: ${course}°</p>
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

// Create a properly rotatable marker element
function createRotatableMarker(course = 0) {
    const container = document.createElement("div");
    container.style.position = "relative";
    container.style.width = "32px";
    container.style.height = "32px";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    
    const carImg = document.createElement("img");
    carImg.src = "/static/images/car_green.png";
    carImg.style.width = "24px"; // Slightly smaller to fit in container
    carImg.style.height = "24px";
    carImg.style.transform = `rotate(${course}deg)`;
    carImg.style.transition = "transform 0.3s ease";
    carImg.style.transformOrigin = "center center"; // Ensure rotation around center
    carImg.alt = "Vehicle";
    
    container.appendChild(carImg);
    return container;
}

// Update marker rotation with proper course handling
function updateMarkerRotation(marker, newCourse) {
    const container = marker.content;
    const img = container.querySelector('img');
    if (img) {
        // Convert course to number and ensure it's a valid degree value
        const course = parseFloat(newCourse) || 0;
        img.style.transform = `rotate(${course}deg)`;
        console.log(`Rotated marker ${marker.licensePlate} to ${course}°`);
    }
    marker.currentCourse = newCourse;
}

// Smooth animation for marker movement with rotation
function animateMarker(marker, newPosition, newCourse, duration = 2000) {
    const startPosition = marker.currentPosition;
    const startCourse = marker.currentCourse || 0;
    const startTime = performance.now();
    
    // Calculate distance for animation speed adjustment
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
        startPosition, newPosition
    );
    
    // Adjust duration based on distance
    const adjustedDuration = Math.min(duration, Math.max(1000, distance / 5));
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / adjustedDuration, 1);
        
        // Easing function for smooth movement
        const easeProgress = easeInOutCubic(progress);
        
        // Interpolate position
        const lat = startPosition.lat() + (newPosition.lat() - startPosition.lat()) * easeProgress;
        const lng = startPosition.lng() + (newPosition.lng() - startPosition.lng()) * easeProgress;
        
        const currentLatLng = new google.maps.LatLng(lat, lng);
        marker.position = currentLatLng;
        marker.currentPosition = currentLatLng;
        
        // Interpolate rotation if course changed
        if (newCourse !== undefined && newCourse !== startCourse) {
            const currentCourse = startCourse + (newCourse - startCourse) * easeProgress;
            updateMarkerRotation(marker, currentCourse);
        }
        
        // If this is the tracked vehicle, keep the map centered on it
        if (trackedVehicle === marker.licensePlate) {
            map.setCenter(currentLatLng);
        }
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Final position and rotation
            marker.position = newPosition;
            marker.currentPosition = newPosition;
            if (newCourse !== undefined) {
                updateMarkerRotation(marker, newCourse);
            }
        }
    }
    
    requestAnimationFrame(animate);
}

// Easing function for smooth animation
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
                trackedVehicle = licensePlate;
                
                const marker = markers[licensePlate];
                if (marker) {
                    map.setCenter(marker.currentPosition);
                    if (map.getZoom() < 14) {
                        map.setZoom(14);
                    }
                }
            });
            
            card.addEventListener('mouseleave', () => {
                card.classList.remove('active');
                trackedVehicle = null;
            });
        }
    });
}

function zoomToVehicle(licensePlate, lat, lng) {
    if (!map) return;
    
    const marker = markers[licensePlate];
    if (marker) {
        map.setCenter({ lat, lng });
        
        if (map.getZoom() < 12) {
            map.setZoom(12);
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
        
        // Get course from update data (ensure it's a number)
        const newCourse = data.course ? parseFloat(data.course) : marker.currentCourse;
        
        console.log(`Vehicle ${data.LicensePlateNumber} update - Course: ${newCourse}°`);
        
        animateMarker(marker, newPosition, newCourse, 2000);
        
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

function debugMarkerRotations() {
    console.log('Current marker rotations:');
    Object.keys(markers).forEach(licensePlate => {
        const marker = markers[licensePlate];
        console.log(`${licensePlate}: ${marker.currentCourse}°`);
    });
}

setTimeout(debugMarkerRotations, 3000);