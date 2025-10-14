let map;
let drawingManager;
let drawnShape = null;
let geofences = [];
let currentShapeType = 'circle';
let rectangle = null;
let editingGeofence = null;
let editingOverlay = null;
let originalOverlayData = null;

function initMap() {
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
    
    document.getElementById("circleBtn").classList.remove("active");
    document.getElementById("polygonBtn").classList.remove("active");
    document.getElementById("rectangleBtn").classList.remove("active");
    document.getElementById(`${type}Btn`).classList.add("active");
    
    document.getElementById("circleControls").style.display = type === 'circle' ? 'block' : 'none';
    document.getElementById("polygonControls").style.display = type === 'polygon' ? 'block' : 'none';
    document.getElementById("rectangleControls").style.display = type === 'rectangle' ? 'block' : 'none';
    
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
        const response = await fetch('/geofence/api/geofences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('input[name="csrf_token"]').value
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
            alert('Error saving geofence: ' + (error.error || JSON.stringify(error)));
        }
    } catch (error) {
        console.error('Error saving geofence:', error);
        alert('Error saving geofence: ' + error.message);
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
        const response = await fetch('/geofence/api/geofences');
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
        li.dataset.geofenceId = gf._id;

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

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "edit-btn";
        editBtn.onclick = () => startEditGeofence(gf, li);

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.className = "delete-btn";
        delBtn.onclick = () => deleteGeofence(gf._id);

        actions.appendChild(viewBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        content.appendChild(nameSpan);
        content.appendChild(metaDiv);
        li.appendChild(content);
        li.appendChild(actions);

        // Add edit action bar if this is the editing geofence
        if (editingGeofence && editingGeofence._id === gf._id) {
            const editBar = document.createElement("div");
            editBar.className = "edit-action-bar-inline";
            editBar.style.display = "flex";
            editBar.style.gap = "10px";
            editBar.style.marginTop = "10px";

            const saveBtn = document.createElement("button");
            saveBtn.textContent = "Save";
            saveBtn.className = "confirm-btn small";
            saveBtn.onclick = saveEditGeofence;

            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "Cancel";
            cancelBtn.className = "cancel-btn small";
            cancelBtn.onclick = cancelEditGeofence;

            editBar.appendChild(saveBtn);
            editBar.appendChild(cancelBtn);
            li.appendChild(editBar);
        }

        list.appendChild(li);
    });
}

// --- Edit Geofence Logic ---
function startEditGeofence(gf, li) {
    if (editingGeofence) {
        alert("Finish editing the current geofence first.");
        return;
    }
    editingGeofence = gf;

    // Remove previous overlays
    if (editingOverlay) {
        editingOverlay.setMap(null);
        editingOverlay = null;
    }

    // Zoom to geofence and draw editable overlay
    zoomToGeofence(gf);

    // Draw editable overlay
    const coords = gf.coordinates;
    let overlay = null;
    if (gf.shape_type === 'circle') {
        overlay = new google.maps.Circle({
            center: coords.center,
            radius: coords.radius,
            fillColor: "#FF0000",
            fillOpacity: 0.35,
            strokeColor: "#FF0000",
            strokeWeight: 2,
            map: map,
            editable: true,
            draggable: true
        });
        originalOverlayData = {
            center: { ...coords.center },
            radius: coords.radius
        };
    } else if (gf.shape_type === 'polygon') {
        const path = coords.points.map(p => new google.maps.LatLng(p.lat, p.lng));
        overlay = new google.maps.Polygon({
            paths: path,
            fillColor: "#FF0000",
            fillOpacity: 0.35,
            strokeColor: "#FF0000",
            strokeWeight: 2,
            map: map,
            editable: true,
            draggable: true
        });
        originalOverlayData = coords.points.map(p => ({ ...p }));
    } else if (gf.shape_type === 'rectangle') {
        const rectBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(coords.bounds.south, coords.bounds.west),
            new google.maps.LatLng(coords.bounds.north, coords.bounds.east)
        );
        overlay = new google.maps.Rectangle({
            bounds: rectBounds,
            fillColor: "#FF0000",
            fillOpacity: 0.35,
            strokeColor: "#FF0000",
            strokeWeight: 2,
            map: map,
            editable: true,
            draggable: true
        });
        originalOverlayData = { ...coords.bounds };
    }
    editingOverlay = overlay;

    // Re-render list to show Save/Cancel for this item
    renderGeofenceList();
}

function saveEditGeofence() {
    if (!editingGeofence || !editingOverlay) return;

    let newCoordinates = null;
    if (editingGeofence.shape_type === 'circle') {
        newCoordinates = {
            center: editingOverlay.getCenter().toJSON(),
            radius: editingOverlay.getRadius()
        };
    } else if (editingGeofence.shape_type === 'polygon') {
        newCoordinates = {
            points: editingOverlay.getPath().getArray().map(ll => ll.toJSON())
        };
    } else if (editingGeofence.shape_type === 'rectangle') {
        const bounds = editingOverlay.getBounds();
        newCoordinates = {
            bounds: {
                north: bounds.getNorthEast().lat(),
                south: bounds.getSouthWest().lat(),
                east: bounds.getNorthEast().lng(),
                west: bounds.getSouthWest().lng()
            }
        };
    }

    try {
        const response = await fetch(`/geofence/api/geofences/${editingGeofence._id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": document.querySelector('input[name="csrf_token"]').value
            },
            body: JSON.stringify({
                coordinates: newCoordinates
            })
        });
        if (response.ok) {
            alert("Geofence updated successfully!");
            endEditGeofence();
            loadSavedGeofences();
        } else {
            const error = await response.json();
            alert("Error updating geofence: " + (error.error || JSON.stringify(error)));
        }
    } catch (error) {
        alert("Error updating geofence: " + error.message);
    }
}

function cancelEditGeofence() {
    if (editingOverlay) {
        editingOverlay.setMap(null);
        editingOverlay = null;
    }
    editingGeofence = null;
    originalOverlayData = null;
    renderGeofenceList();
    loadSavedGeofences();
}

function endEditGeofence() {
    if (editingOverlay) {
        editingOverlay.setMap(null);
        editingOverlay = null;
    }
    editingGeofence = null;
    originalOverlayData = null;
    let bar = document.getElementById("edit-action-bar");
    if (bar) bar.remove();
}

function renderGeofencesOnMap() {
    // Clear previous overlays
    geofences.forEach(gf => {
        if (gf.mapOverlay) {
            gf.mapOverlay.setMap(null);
        }
    });

    // Create a LatLngBounds object to include all geofences
    const bounds = new google.maps.LatLngBounds();
    let hasGeofence = false;

    geofences.forEach(gf => {
        const coords = gf.coordinates;
        let overlay = null;

        if (gf.shape_type === 'circle') {
            const center = new google.maps.LatLng(coords.center.lat, coords.center.lng);
            overlay = new google.maps.Circle({
                center: center,
                radius: coords.radius,
                fillColor: "#FF0000",
                fillOpacity: 0.2,
                strokeColor: "#FF0000",
                strokeWeight: 2,
                map: map,
                editable: false,
                draggable: false
            });
            // Extend bounds by circle's bounding box
            const circleBounds = overlay.getBounds();
            if (circleBounds) bounds.union(circleBounds);
            hasGeofence = true;
        } else if (gf.shape_type === 'polygon') {
            const path = coords.points.map(p => new google.maps.LatLng(p.lat, p.lng));
            overlay = new google.maps.Polygon({
                paths: path,
                fillColor: "#FF0000",
                fillOpacity: 0.2,
                strokeColor: "#FF0000",
                strokeWeight: 2,
                map: map,
                editable: false,
                draggable: false
            });
            path.forEach(latlng => bounds.extend(latlng));
            hasGeofence = true;
        } else if (gf.shape_type === 'rectangle') {
            const rectBounds = new google.maps.LatLngBounds(
                new google.maps.LatLng(coords.bounds.south, coords.bounds.west),
                new google.maps.LatLng(coords.bounds.north, coords.bounds.east)
            );
            overlay = new google.maps.Rectangle({
                bounds: rectBounds,
                fillColor: "#FF0000",
                fillOpacity: 0.2,
                strokeColor: "#FF0000",
                strokeWeight: 2,
                map: map,
                editable: false,
                draggable: false
            });
            bounds.union(rectBounds);
            hasGeofence = true;
        }

        if (overlay) {
            gf.mapOverlay = overlay;
            google.maps.event.addListener(overlay, 'click', () => {
                zoomToGeofence(gf);
            });
        }
    });

    // Fit map to all geofences if any exist
    if (hasGeofence && !bounds.isEmpty()) {
        map.fitBounds(bounds);
    }
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
        const response = await fetch(`/geofence/api/geofences/${geofenceId}`, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('input[name="csrf_token"]').value // <-- fix here
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