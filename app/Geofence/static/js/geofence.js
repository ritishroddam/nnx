let map;
let drawingManager;
let drawnShape = null;
let geofences = [];
let currentShapeType = 'circle';
let rectangle = null;

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

        drawingManager = new google.maps.drawing.DrawingManager({
            drawingMode: null,
            drawingControl: false,
            circleOptions: {
                fillColor: "#FF0000",
                fillOpacity: 0.35,
                strokeWeight: 2,
                editable: true,
                draggable: true
            },
            polygonOptions: {
                fillColor: "#FF0000",
                fillOpacity: 0.35,
                strokeWeight: 2,
                editable: true,
                draggable: true
            },
            rectangleOptions: {
                fillColor: "#FF0000",
                fillOpacity: 0.35,
                strokeWeight: 2,
                editable: true,
                draggable: true
            }
        });

        drawingManager.setMap(map);
        setupEventListeners();
        loadSavedGeofences();

    } catch (error) {
        console.error("Error creating map:", error);
        alert("Error loading Google Maps. Please check your API key and console for details.");
    }
}

function setupEventListeners() {
    const circleBtn = document.getElementById("circleBtn");
    const polygonBtn = document.getElementById("polygonBtn");
    const rectangleBtn = document.getElementById("rectangleBtn");
    const radiusSlider = document.getElementById("radiusSlider");
    
    circleBtn.addEventListener("click", () => setShapeType('circle'));
    polygonBtn.addEventListener("click", () => setShapeType('polygon'));
    rectangleBtn.addEventListener("click", () => setShapeType('rectangle'));
    
    radiusSlider.addEventListener("input", (e) => {
        document.getElementById("radiusValue").textContent = e.target.value;
        if (drawnShape && drawnShape instanceof google.maps.Circle) {
            drawnShape.setRadius(parseFloat(e.target.value));
            updateShapeData();
        }
    });

    const form = document.getElementById("geofenceForm");
    form.addEventListener("submit", handleFormSubmit);

    // Drawing manager events
    google.maps.event.addListener(drawingManager, "overlaycomplete", (event) => {
        if (drawnShape) drawnShape.setMap(null);
        drawnShape = event.overlay;
        drawingManager.setDrawingMode(null);
        updateShapeData();
        
        if (drawnShape instanceof google.maps.Circle || 
            drawnShape instanceof google.maps.Polygon || 
            drawnShape instanceof google.maps.Rectangle) {
            drawnShape.setEditable(true);
            drawnShape.setDraggable(true);
            
            // Add event listeners for changes
            if (drawnShape instanceof google.maps.Circle) {
                google.maps.event.addListener(drawnShape, 'radius_changed', updateShapeData);
                google.maps.event.addListener(drawnShape, 'center_changed', updateShapeData);
            } else if (drawnShape instanceof google.maps.Polygon) {
                google.maps.event.addListener(drawnShape.getPath(), 'set_at', updateShapeData);
                google.maps.event.addListener(drawnShape.getPath(), 'insert_at', updateShapeData);
                google.maps.event.addListener(drawnShape.getPath(), 'remove_at', updateShapeData);
            } else if (drawnShape instanceof google.maps.Rectangle) {
                google.maps.event.addListener(drawnShape, 'bounds_changed', updateShapeData);
            }
        }
    });

    // Rectangle drawing using mouse events
    let rectangleStart = null;
    let rectangleDrawing = false;

    google.maps.event.addListener(map, 'mousedown', (event) => {
        if (currentShapeType === 'rectangle' && !rectangleDrawing) {
            rectangleStart = event.latLng;
            rectangleDrawing = true;
            
            if (rectangle) rectangle.setMap(null);
            
            rectangle = new google.maps.Rectangle({
                map: map,
                bounds: new google.maps.LatLngBounds(rectangleStart, rectangleStart),
                fillColor: "#FF0000",
                fillOpacity: 0.35,
                strokeWeight: 2,
                editable: false,
                draggable: false
            });
        }
    });

    google.maps.event.addListener(map, 'mousemove', (event) => {
        if (rectangleDrawing && rectangleStart) {
            const bounds = new google.maps.LatLngBounds(rectangleStart, event.latLng);
            rectangle.setBounds(bounds);
        }
    });

    google.maps.event.addListener(map, 'mouseup', (event) => {
        if (rectangleDrawing && rectangleStart) {
            rectangleDrawing = false;
            if (drawnShape) drawnShape.setMap(null);
            drawnShape = rectangle;
            rectangle.setEditable(true);
            rectangle.setDraggable(true);
            
            google.maps.event.addListener(rectangle, 'bounds_changed', updateShapeData);
            updateShapeData();
        }
    });
}

function setShapeType(type) {
    currentShapeType = type;
    clearShape();
    
    // Update UI
    document.getElementById("circleBtn").classList.remove("active");
    document.getElementById("polygonBtn").classList.remove("active");
    document.getElementById("rectangleBtn").classList.remove("active");
    document.getElementById(`${type}Btn`).classList.add("active");
    
    // Show/hide controls
    document.getElementById("circleControls").style.display = type === 'circle' ? 'block' : 'none';
    document.getElementById("polygonControls").style.display = type === 'polygon' ? 'block' : 'none';
    document.getElementById("rectangleControls").style.display = type === 'rectangle' ? 'block' : 'none';
    
    // Set drawing mode
    if (type === 'rectangle') {
        drawingManager.setDrawingMode(null);
    } else {
        const overlayType = type === 'circle' ? google.maps.drawing.OverlayType.CIRCLE : google.maps.drawing.OverlayType.POLYGON;
        drawingManager.setDrawingMode(overlayType);
    }
}

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
            shapeData = { 
                type: "polygon", 
                points: path 
            };
        } else if (drawnShape instanceof google.maps.Rectangle) {
            const bounds = drawnShape.getBounds();
            shapeData = {
                type: "rectangle",
                bounds: {
                    north: bounds.getNorthEast().lat(),
                    south: bounds.getSouthWest().lat(),
                    east: bounds.getNorthEast().lng(),
                    west: bounds.getSouthWest().lng()
                }
            };
        }
        document.getElementById("shapeData").value = JSON.stringify(shapeData);
    } catch (error) {
        console.error("Error updating shape data:", error);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const shapeData = document.getElementById("shapeData").value;
    if (!shapeData) {
        alert("Please draw a geofence first");
        return;
    }

    const name = document.getElementById("GeofenceName").value;
    const location = document.getElementById("Location").value;
    const enterAlert = document.getElementById("enterAlert").checked;
    const leaveAlert = document.getElementById("leaveAlert").checked;

    try {
        const response = await fetch('/Geofence/api/geofences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('input[name="csrf_token"]').value
            },
            body: JSON.stringify({
                name: name,
                location: location,
                shape_type: currentShapeType,
                coordinates: JSON.parse(shapeData),
                alert_enter: enterAlert,
                alert_leave: leaveAlert
            })
        });

        if (response.ok) {
            const result = await response.json();
            alert('Geofence saved successfully!');
            clearShape();
            document.getElementById("geofenceForm").reset();
            document.getElementById("shapeData").value = "";
            loadSavedGeofences();
        } else {
            const error = await response.json();
            alert('Error saving geofence: ' + error.error);
        }
    } catch (error) {
        console.error('Error saving geofence:', error);
        alert('Error saving geofence');
    }
}

function clearShape() {
    if (drawnShape) {
        drawnShape.setMap(null);
        drawnShape = null;
    }
    if (rectangle) {
        rectangle.setMap(null);
        rectangle = null;
    }
    document.getElementById("shapeData").value = "";
    drawingManager.setDrawingMode(null);
}

async function loadSavedGeofences() {
    try {
        const response = await fetch('/Geofence/api/geofences');
        if (response.ok) {
            geofences = await response.json();
            renderGeofenceList();
            renderGeofencesOnMap();
        } else {
            console.error('Failed to load geofences');
        }
    } catch (error) {
        console.error('Error loading geofences:', error);
    }
}

function renderGeofenceList() {
    const list = document.getElementById("geofenceList");
    if (!list) return;
    
    list.innerHTML = "";

    geofences.forEach((gf, i) => {
        const li = document.createElement("li");
        li.className = "geofence-list-item";
        
        const content = document.createElement("div");
        content.className = "geofence-item-content";
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "geofence-item-name";
        nameSpan.textContent = gf.name;
        
        const metaDiv = document.createElement("div");
        metaDiv.className = "geofence-item-meta";
        metaDiv.innerHTML = `
            <div>Location: ${gf.location || 'N/A'}</div>
            <div>Type: ${gf.shape_type}</div>
            <div>Created by: ${gf.created_by}</div>
            <div>Created: ${new Date(gf.created_at).toLocaleString()}</div>
        `;

        const actions = document.createElement("div");
        actions.className = "geofence-actions";

        const viewBtn = document.createElement("button");
        viewBtn.textContent = "View";
        viewBtn.className = "view-btn";
        viewBtn.onclick = () => zoomToGeofence(gf);

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.className = "delete-btn";
        delBtn.onclick = () => deleteGeofence(gf._id);

        actions.appendChild(viewBtn);
        actions.appendChild(delBtn);
        
        content.appendChild(nameSpan);
        content.appendChild(metaDiv);
        li.appendChild(content);
        li.appendChild(actions);
        list.appendChild(li);
    });
}

function renderGeofencesOnMap() {
    // Clear existing geofences from map
    geofences.forEach(gf => {
        if (gf.mapOverlay) {
            gf.mapOverlay.setMap(null);
        }
    });

    // Render all geofences on map
    geofences.forEach(gf => {
        const coords = gf.coordinates;
        let overlay = null;

        if (gf.shape_type === 'circle') {
            overlay = new google.maps.Circle({
                center: new google.maps.LatLng(coords.center.lat, coords.center.lng),
                radius: coords.radius,
                fillColor: "#FF0000",
                fillOpacity: 0.2,
                strokeColor: "#FF0000",
                strokeWeight: 2,
                map: map,
                editable: false,
                draggable: false
            });
        } else if (gf.shape_type === 'polygon') {
            overlay = new google.maps.Polygon({
                paths: coords.points.map(p => new google.maps.LatLng(p.lat, p.lng)),
                fillColor: "#FF0000",
                fillOpacity: 0.2,
                strokeColor: "#FF0000",
                strokeWeight: 2,
                map: map,
                editable: false,
                draggable: false
            });
        } else if (gf.shape_type === 'rectangle') {
            overlay = new google.maps.Rectangle({
                bounds: new google.maps.LatLngBounds(
                    new google.maps.LatLng(coords.bounds.south, coords.bounds.west),
                    new google.maps.LatLng(coords.bounds.north, coords.bounds.east)
                ),
                fillColor: "#FF0000",
                fillOpacity: 0.2,
                strokeColor: "#FF0000",
                strokeWeight: 2,
                map: map,
                editable: false,
                draggable: false
            });
        }

        // Store reference and add click event
        if (overlay) {
            gf.mapOverlay = overlay;
            
            google.maps.event.addListener(overlay, 'click', () => {
                zoomToGeofence(gf);
            });
        }
    });
}

function zoomToGeofence(geofence) {
    const coords = geofence.coordinates;
    
    if (geofence.shape_type === 'circle') {
        map.setCenter(new google.maps.LatLng(coords.center.lat, coords.center.lng));
        map.setZoom(15);
    } else if (geofence.shape_type === 'polygon') {
        const bounds = new google.maps.LatLngBounds();
        coords.points.forEach(point => {
            bounds.extend(new google.maps.LatLng(point.lat, point.lng));
        });
        map.fitBounds(bounds);
    } else if (geofence.shape_type === 'rectangle') {
        const bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(coords.bounds.south, coords.bounds.west),
            new google.maps.LatLng(coords.bounds.north, coords.bounds.east)
        );
        map.fitBounds(bounds);
    }
}

async function deleteGeofence(geofenceId) {
    if (!confirm('Are you sure you want to delete this geofence?')) {
        return;
    }

    try {
        const response = await fetch(`/Geofence/api/geofences/${geofenceId}`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': document.querySelector('input[name="csrf_token"]').value
            }
        });

        if (response.ok) {
            alert('Geofence deleted successfully!');
            loadSavedGeofences();
        } else {
            const error = await response.json();
            alert('Error deleting geofence: ' + error.error);
        }
    } catch (error) {
        console.error('Error deleting geofence:', error);
        alert('Error deleting geofence');
    }
}

window.onload = function() {
    if (typeof google === 'undefined' || !google.maps) {
        console.error("Google Maps API not loaded");
        alert("Google Maps failed to load. Please check your API key and internet connection.");
        return;
    }
    
    setTimeout(initMap, 100);
};