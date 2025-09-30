let map;
let drawingManager;
let drawnShape = null;
let geofences = [];
let editIndex = null;

function initMap() {
    console.log("Initializing map...");
    
    const mapElement = document.getElementById("map");
    if (!mapElement) {
        console.error("Map element not found!");
        return;
    }

    try {
        map = new google.maps.Map(mapElement, {
            center: { lat: 20.5937, lng: 78.9629 },
            zoom: 5,
        });

        console.log("Map created successfully");

        // Initialize drawing manager
        drawingManager = new google.maps.drawing.DrawingManager({
            drawingMode: null,
            drawingControl: false,
            circleOptions: {
                fillColor: "#FF0000",
                fillOpacity: 0.35,
                strokeWeight: 2,
                editable: true
            },
            polygonOptions: {
                fillColor: "#FF0000",
                fillOpacity: 0.35,
                strokeWeight: 2,
                editable: true
            },
        });

        drawingManager.setMap(map);

        // Set up event listeners
        setupEventListeners();

    } catch (error) {
        console.error("Error creating map:", error);
        alert("Error loading Google Maps. Please check your API key and console for details.");
    }
}

function setupEventListeners() {
    // Circle button
    document.getElementById("circleBtn").addEventListener("click", () => {
        clearShape();
        drawingManager.setDrawingMode(google.maps.drawing.OverlayType.CIRCLE);
        setActiveButton("circleBtn");
    });

    // Polygon button
    document.getElementById("polygonBtn").addEventListener("click", () => {
        clearShape();
        drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
        setActiveButton("polygonBtn");
    });

    // Listen for completed drawings
    google.maps.event.addListener(drawingManager, "overlaycomplete", (event) => {
        if (drawnShape) drawnShape.setMap(null);
        drawnShape = event.overlay;
        drawingManager.setDrawingMode(null);
        updateShapeData();
        
        // Make shape editable
        if (drawnShape instanceof google.maps.Circle || drawnShape instanceof google.maps.Polygon) {
            drawnShape.setEditable(true);
            google.maps.event.addListener(drawnShape, 'radius_changed', updateShapeData);
            google.maps.event.addListener(drawnShape, 'center_changed', updateShapeData);
            google.maps.event.addListener(drawnShape, 'bounds_changed', updateShapeData);
        }
    });

    // Form submission
    document.getElementById("geofenceForm").addEventListener("submit", handleFormSubmit);
}

function setActiveButton(activeId) {
    document.getElementById("circleBtn").classList.remove("active");
    document.getElementById("polygonBtn").classList.remove("active");
    document.getElementById(activeId).classList.add("active");
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!document.getElementById("shapeData").value) {
        alert("Please draw a geofence first");
        return;
    }

    const name = document.getElementById("GeofenceName").value;
    const location = document.getElementById("Location").value;
    const data = JSON.parse(document.getElementById("shapeData").value);

    const gf = { name, location, data };

    if (editIndex !== null) {
        geofences[editIndex] = gf;
        editIndex = null;
    } else {
        geofences.push(gf);
    }

    renderGeofenceList();
    clearShape();
    document.getElementById("geofenceForm").reset();
    document.getElementById("shapeData").value = "";
}

// Convert shape into JSON
function updateShapeData() {
    if (!drawnShape) return;
    
    let shapeData = {};
    try {
        if (drawnShape instanceof google.maps.Circle) {
            shapeData = {
                type: "circle",
                center: drawnShape.getCenter().toJSON(),
                radius: drawnShape.getRadius(),
            };
        } else if (drawnShape instanceof google.maps.Polygon) {
            const path = drawnShape.getPath().getArray().map((latLng) => latLng.toJSON());
            shapeData = { type: "polygon", points: path };
        }
        document.getElementById("shapeData").value = JSON.stringify(shapeData);
    } catch (error) {
        console.error("Error updating shape data:", error);
    }
}

// Clear current drawn shape
function clearShape() {
    if (drawnShape) {
        drawnShape.setMap(null);
        drawnShape = null;
    }
    document.getElementById("shapeData").value = "";
    drawingManager.setDrawingMode(null);
}

// Render saved geofences list
function renderGeofenceList() {
    const list = document.getElementById("geofenceList");
    list.innerHTML = "";

    geofences.forEach((gf, i) => {
        const li = document.createElement("li");
        li.className = "geofence-list-item";
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "geofence-item-name";
        nameSpan.textContent = gf.name;

        const actions = document.createElement("div");
        actions.className = "geofence-actions";

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "edit-btn";
        editBtn.onclick = () => loadGeofence(i);

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.className = "delete-btn";
        delBtn.onclick = () => {
            geofences.splice(i, 1);
            renderGeofenceList();
            clearShape();
        };

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        li.appendChild(nameSpan);
        li.appendChild(actions);
        list.appendChild(li);
    });
}

// Load geofence back into map
function loadGeofence(i) {
    const gf = geofences[i];
    clearShape();

    document.getElementById("GeofenceName").value = gf.name;
    document.getElementById("Location").value = gf.location;

    try {
        if (gf.data.type === "circle") {
            drawnShape = new google.maps.Circle({
                center: gf.data.center,
                radius: gf.data.radius,
                fillColor: "#FF0000",
                fillOpacity: 0.35,
                strokeWeight: 2,
                map: map,
                editable: true
            });
        } else if (gf.data.type === "polygon") {
            drawnShape = new google.maps.Polygon({
                paths: gf.data.points,
                fillColor: "#FF0000",
                fillOpacity: 0.35,
                strokeWeight: 2,
                map: map,
                editable: true
            });
        }

        // Center map on the shape
        if (gf.data.type === "circle") {
            map.setCenter(gf.data.center);
            map.setZoom(13);
        } else if (gf.data.type === "polygon" && gf.data.points.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            gf.data.points.forEach(point => bounds.extend(point));
            map.fitBounds(bounds);
        }

        updateShapeData();
        editIndex = i;
    } catch (error) {
        console.error("Error loading geofence:", error);
        alert("Error loading geofence data");
    }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
    // Check if Google Maps API is loaded
    if (typeof google === 'undefined' || !google.maps) {
        console.error("Google Maps API not loaded");
        alert("Google Maps failed to load. Please check your API key and internet connection.");
        return;
    }
    
    initMap();
});