let map;
let drawnShape = null;
let geofences = [];
let currentShapeType = 'circle';
let rectangle = null;
let editingGeofence = null;
let editingOverlay = null;
let originalOverlayData = null;
let isDrawing = false;
let circleCenter = null;
let polygonPath = [];
let polyPreview = null;

async function geofenceMap() {
  const mapElement = document.getElementById("geofenceMap");
  if (!mapElement) {
    console.error("Map element not found!");
    return;
  }

  try {
    const { Map } = await google.maps.importLibrary("maps");
    await google.maps.importLibrary("geometry"); // for distance calc

    map = new Map(mapElement, {
      center: { lat: 20.5937, lng: 78.9629 },
      zoom: 5,
      disableDoubleClickZoom: true, // needed for polygon finish on dblclick
    });

    setupEventListeners();
    loadSavedGeofences();
  } catch (error) {
    console.error("Error creating map:", error);
    displayFlashMessage("Error loading Google Maps");
  }
}

function setupEventListeners() {
  const circleBtn = document.getElementById("circleBtn");
  const polygonBtn = document.getElementById("polygonBtn");
  const rectangleBtn = document.getElementById("rectangleBtn");
  const radiusSlider = document.getElementById("radiusSlider");

  circleBtn.addEventListener("click", () => setShapeType("circle"));
  polygonBtn.addEventListener("click", () => setShapeType("polygon"));
  rectangleBtn.addEventListener("click", () => setShapeType("rectangle"));

  radiusSlider.addEventListener("input", (e) => {
    document.getElementById("radiusValue").textContent = e.target.value;
    if (drawnShape && drawnShape instanceof google.maps.Circle) {
      drawnShape.setRadius(parseFloat(e.target.value));
      updateShapeData();
    }
  });

  const form = document.getElementById("geofenceForm");
  form.addEventListener("submit", handleFormSubmit);

  // Manual drawing handlers

  // Circle draw: press-drag-release
  map.addListener("mousedown", (event) => {
    if (currentShapeType !== "circle") return;
    isDrawing = true;
    circleCenter = event.latLng;

    if (drawnShape) drawnShape.setMap(null);
    drawnShape = new google.maps.Circle({
      map,
      center: circleCenter,
      radius: 10,
      fillColor: "#FF0000",
      fillOpacity: 0.35,
      strokeWeight: 2,
      editable: false,
      draggable: false,
    });
  });

  map.addListener("mousemove", (event) => {
    if (currentShapeType === "circle" && isDrawing && drawnShape instanceof google.maps.Circle) {
      const dist = google.maps.geometry.spherical.computeDistanceBetween(circleCenter, event.latLng);
      drawnShape.setRadius(dist);
    }
  });

  map.addListener("mouseup", () => {
    if (currentShapeType === "circle" && isDrawing && drawnShape instanceof google.maps.Circle) {
      isDrawing = false;
      drawnShape.setEditable(true);
      drawnShape.setDraggable(true);
      drawnShape.addListener("radius_changed", updateShapeData);
      drawnShape.addListener("center_changed", updateShapeData);
      updateShapeData();
    }
  });

  // Polygon draw: click to add vertices, move shows preview, double-click to finish
  map.addListener("click", (event) => {
    if (currentShapeType !== "polygon") return;

    if (!isDrawing) {
      isDrawing = true;
      polygonPath = [];
      if (drawnShape) drawnShape.setMap(null);
      drawnShape = new google.maps.Polygon({
        map,
        paths: [],
        fillColor: "#FF0000",
        fillOpacity: 0.35,
        strokeWeight: 2,
        editable: true,
        draggable: true,
      });
      polyPreview = new google.maps.Polyline({
        map,
        path: [],
        strokeColor: "#FF0000",
        strokeOpacity: 0.6,
        strokeWeight: 2,
      });
    }
    polygonPath.push(event.latLng);
    drawnShape.setPath(polygonPath);
    polyPreview.setPath(polygonPath);
    updateShapeData();
  });

  map.addListener("mousemove", (event) => {
    if (currentShapeType !== "polygon" || !isDrawing || !polyPreview) return;
    const preview = polygonPath.concat([event.latLng]);
    polyPreview.setPath(preview);
  });

  map.addListener("dblclick", () => {
    if (currentShapeType !== "polygon" || !isDrawing) return;
    isDrawing = false;
    if (polyPreview) {
      polyPreview.setMap(null);
      polyPreview = null;
    }
    if (drawnShape instanceof google.maps.Polygon) {
      const path = drawnShape.getPath();
      path.addListener("set_at", updateShapeData);
      path.addListener("insert_at", updateShapeData);
      path.addListener("remove_at", updateShapeData);
      drawnShape.setEditable(true);
      drawnShape.setDraggable(true);
      updateShapeData();
    }
  });

  // Rectangle draw: press-drag-release (already manual)
  let rectangleStart = null;
  let rectangleDrawing = false;

  map.addListener("mousedown", (event) => {
    if (currentShapeType !== "rectangle") return;
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
      draggable: false,
    });
  });

  map.addListener("mousemove", (event) => {
    if (!rectangleDrawing || !rectangleStart || currentShapeType !== "rectangle") return;
    const bounds = new google.maps.LatLngBounds(rectangleStart, event.latLng);
    rectangle.setBounds(bounds);
  });

  map.addListener("mouseup", () => {
    if (!rectangleDrawing || currentShapeType !== "rectangle") return;
    rectangleDrawing = false;
    if (drawnShape) drawnShape.setMap(null);
    drawnShape = rectangle;
    rectangle.setEditable(true);
    rectangle.setDraggable(true);
    rectangle.addListener("bounds_changed", updateShapeData);
    updateShapeData();
  });
}

function setShapeType(type) {
  currentShapeType = type;
  clearShape();

  document.getElementById("circleBtn").classList.remove("active");
  document.getElementById("polygonBtn").classList.remove("active");
  document.getElementById("rectangleBtn").classList.remove("active");
  document.getElementById(`${type}Btn`).classList.add("active");

  document.getElementById("circleControls").style.display = type === "circle" ? "block" : "none";
  document.getElementById("polygonControls").style.display = type === "polygon" ? "block" : "none";
  document.getElementById("rectangleControls").style.display = type === "rectangle" ? "block" : "none";
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
    } else if (drawnShape instanceof google.maps.Rectangle) {
      const bounds = drawnShape.getBounds();
      shapeData = {
        type: "rectangle",
        bounds: {
          north: bounds.getNorthEast().lat(),
          south: bounds.getSouthWest().lat(),
          east: bounds.getNorthEast().lng(),
          west: bounds.getSouthWest().lng(),
        },
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
        displayFlashMessage("Please draw a geofence first", 'warning');
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
                'X-CSRF-TOKEN': getCookie("csrf_access_token"),
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
            displayFlashMessage('Geofence saved successfully!', 'success');
            clearShape();
            document.getElementById("geofenceForm").reset();
            document.getElementById("shapeData").value = "";
            loadSavedGeofences();
        } else {
            const error = await response.json();
            console.error((error.error || JSON.stringify(error)));
            displayFlashMessage('Error saving geofence: ', 'danger');
        }
    } catch (error) {
        console.error('Error saving geofence:', error);
        displayFlashMessage('Error saving geofence: ', 'danger');
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
  if (polyPreview) {
    polyPreview.setMap(null);
    polyPreview = null;
  }
  isDrawing = false;
  circleCenter = null;
  polygonPath = [];
  document.getElementById("shapeData").value = "";
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

        list.appendChild(li);

        // Add Save/Cancel as a new row below the edited item
        if (editingGeofence && editingGeofence._id === gf._id) {
            const actionLi = document.createElement("li");
            actionLi.className = "edit-action-bar-below";
            actionLi.style.listStyle = "none";
            actionLi.style.background = "transparent";
            actionLi.style.display = "flex";
            actionLi.style.justifyContent = "center";
            actionLi.style.alignItems = "center";
            actionLi.style.border = "none";
            actionLi.style.boxShadow = "none";
            actionLi.style.marginTop = "-10px";
            actionLi.style.marginBottom = "10px";

            const saveBtn = document.createElement("button");
            saveBtn.textContent = "Save";
            saveBtn.className = "confirm-btn below";
            saveBtn.onclick = saveEditGeofence;

            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "Cancel";
            cancelBtn.className = "cancel-btn below";
            cancelBtn.onclick = cancelEditGeofence;

            actionLi.appendChild(saveBtn);
            actionLi.appendChild(cancelBtn);

            list.appendChild(actionLi);
        }
    });
}

function renderGeofencesOnMap() {
  geofences.forEach((gf) => {
    if (gf.mapOverlay) {
      gf.mapOverlay.setMap(null);
    }
  });

  const bounds = new google.maps.LatLngBounds();
  let hasGeofence = false;

  geofences.forEach((gf) => {
    const coords = gf.coordinates;
    let overlay = null;

    if (gf.shape_type === "circle") {
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
        draggable: false,
      });
      const circleBounds = overlay.getBounds();
      if (circleBounds) bounds.union(circleBounds);
      hasGeofence = true;
    } else if (gf.shape_type === "polygon") {
      const path = coords.points.map((p) => new google.maps.LatLng(p.lat, p.lng));
      overlay = new google.maps.Polygon({
        paths: path,
        fillColor: "#FF0000",
        fillOpacity: 0.2,
        strokeColor: "#FF0000",
        strokeWeight: 2,
        map: map,
        editable: false,
        draggable: false,
      });
      path.forEach((latlng) => bounds.extend(latlng));
      hasGeofence = true;
    } else if (gf.shape_type === "rectangle") {
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
        draggable: false,
      });
      bounds.union(rectBounds);
      hasGeofence = true;
    }

    if (overlay) {
      gf.mapOverlay = overlay;
      overlay.addListener("click", () => {
        zoomToGeofence(gf);
      });
    }
  });

  if (hasGeofence && !bounds.isEmpty()) {
    map.fitBounds(bounds);
  }
}

function startEditGeofence(gf, li) {
    if (editingGeofence) {
        displayFlashMessage("Finish editing the current geofence first");
        return;
    }
    editingGeofence = gf;

    if (editingOverlay) {
        editingOverlay.setMap(null);
        editingOverlay = null;
    }

    zoomToGeofence(gf);

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

    renderGeofenceList();
}

async function saveEditGeofence() {
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
                "X-CSRF-TOKEN": getCookie("csrf_access_token"),
            },
            body: JSON.stringify({
                coordinates: newCoordinates
            })
        });
        if (response.ok) {
            displayFlashMessage("Geofence updated successfully!", "success");
            endEditGeofence();
            loadSavedGeofences();
        } else {
            const error = await response.json();
            displayFlashMessage("Error updating geofence: ", 'danger');
            console.error((error.error || JSON.stringify(error)));
        }
    } catch (error) {
        displayFlashMessage("Error updating geofence: ", 'danger');
        console.error(error.message);
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
                'X-CSRF-TOKEN': getCookie("csrf_access_token"),
            }
        });

        if (response.ok) {
            displayFlashMessage('Geofence deleted successfully!', 'success');
            loadSavedGeofences();
        } else {
            const error = await response.json();
            console.error(error.error);
            displayFlashMessage('Error deleting geofence: ', 'danger');
        }
    } catch (error) {
        console.error('Error deleting geofence:', error);
        displayFlashMessage('Error deleting geofence');
    }
}

window.onload = async function() {
    try{
        await backgroundMap();
        await geofenceMap();
    } catch (e){
        console.error("Failed to load map", e);
        displayFlashMessage("Failed to load map for Geofence")
    }
};