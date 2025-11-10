let map;
let markers = {};
const vehiclesData = JSON.parse('{{ share_info.vehicles | tojson | safe }}');
const shareToken = "{{ token }}";

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
            });
        }
    })
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
        
        const listener = google.maps.event.addListener(map, "idle", function () {
            if (map.getZoom() > 15) map.setZoom(15);
            google.maps.event.removeListener(listener);
        });
    
    setupSocketConnection();
}
}

function setupSocketConnection() {
    const socket = io("https://cordonnx.com", {
        transports: ["websocket"],
        reconnection: true,
    })
    socket.on("connect", () => {
        console.log("Connected to socket for live updates");
        vehiclesData.forEach(vehicle => {
            socket.emit("subscribe_vehicle_updates", {
                LicensePlateNumber: vehicle.licensePlateNumber
            });
        });
    })
    socket.on("vehicle_live_update", (data) => {
        if (data && data.latitude && data.longitude && markers[data.LicensePlateNumber]) {
            const marker = markers[data.LicensePlateNumber];
            const newPosition = new google.maps.LatLng(
                parseFloat(data.latitude),
                parseFloat(data.longitude)
            );
            
            marker.position = newPosition;
            
            updateVehicleInfo(data);
        }
    })
    socket.on("subscription_success", (data) => {
        console.log("Subscription successful:", data);
    })
    socket.on("subscription_error", (error) => {
        console.error("Subscription error:", error);
    });
}

function updateVehicleInfo(vehicleData) {
    const vehicleElement = document.querySelector(`[data-license-plate="${vehicleData.LicensePlateNumber}"]`);
    if (vehicleElement) {
        const locationEl = vehicleElement.querySelector('p:nth-child(2)');
        const speedEl = vehicleElement.querySelector('p:nth-child(3)');
        const updateEl = vehicleElement.querySelector('p:nth-child(4)');
        
        if (locationEl) locationEl.textContent = `Location: ${vehicleData.address || 'Unknown Location'}`;
        if (speedEl) speedEl.textContent = `Speed: ${vehicleData.speed || 'Unknown'} km/h`;
        if (updateEl) updateEl.textContent = `Last Update: ${new Date().toLocaleString()}`;
    }

initMap();
}