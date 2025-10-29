let map;
let drawnShape = null;
let geofences = [];
let rectangle = null;
let editingGeofence = null;
let editingOverlay = null;
let originalOverlayData = null;
let currentShapeType = null;

let isDrawing = false;
let circleCenter = null;

let circleDrawing = false;
let circleStart = null;
let polygonDrawing = false;
let polygonPath = [];
let polyPreview = null;
let rectDrawing = false;
let rectStart = null;

async function geofenceMap() {
  const mapElement = document.getElementById("geofenceMap");
  if (!mapElement) {
    console.error("Map element not found!");
    return;
  }

  try {
    const { Map } = await google.maps.importLibrary("maps");
    await google.maps.importLibrary("geometry");

    map = new Map(mapElement, {
      center: { lat: 20.5937, lng: 78.9629 },
      zoom: 5,
      disableDoubleClickZoom: true,
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

  setupMapListeners();
}

function setupMapListeners() {
  // Clear any existing listeners first
  google.maps.event.clearListeners(map, 'mousedown');
  google.maps.event.clearListeners(map, 'mousemove');
  google.maps.event.clearListeners(map, 'mouseup');
  google.maps.event.clearListeners(map, 'click');
  google.maps.event.clearListeners(map, 'dblclick');

  // Mouse down for circle and rectangle
  google.maps.event.addListener(map, 'mousedown', (event) => {
    if (currentShapeType === "circle") {
      startCircleDrawing(event);
    } else if (currentShapeType === "rectangle") {
      startRectangleDrawing(event);
    }
  });

  // Mouse move for all shapes
  google.maps.event.addListener(map, 'mousemove', (event) => {
    if (currentShapeType === "circle" && circleDrawing) {
      updateCircleDrawing(event);
    } else if (currentShapeType === "rectangle" && rectDrawing) {
      updateRectangleDrawing(event);
    } else if (currentShapeType === "polygon" && polygonDrawing && polyPreview) {
      updatePolygonPreview(event);
    }
  });

  // Mouse up for circle and rectangle
  google.maps.event.addListener(map, 'mouseup', (event) => {
    if (currentShapeType === "circle" && circleDrawing) {
      finishCircleDrawing();
    } else if (currentShapeType === "rectangle" && rectDrawing) {
      finishRectangleDrawing();
    }
  });

  // Click for polygon
  google.maps.event.addListener(map, 'click', (event) => {
    if (currentShapeType === "polygon") {
      handlePolygonClick(event);
    }
  });

  // Double click for polygon finish
  google.maps.event.addListener(map, 'dblclick', (event) => {
    if (currentShapeType === "polygon" && polygonDrawing) {
      finishPolygonDrawing();
    }
  });
}

function startCircleDrawing(event) {
  circleStart = event.latLng;
  circleDrawing = true;

  clearShape();
  
  drawnShape = new google.maps.Circle({
    map,
    center: circleStart,
    radius: 10,
    fillColor: "#FF0000",
    fillOpacity: 0.35,
    strokeWeight: 2,
    editable: false,
    draggable: false,
  });
}

function updateCircleDrawing(event) {
  if (!circleDrawing || !drawnShape) return;
  
  const radius = google.maps.geometry.spherical.computeDistanceBetween(
    circleStart, 
    event.latLng
  );
  drawnShape.setRadius(radius);
}

function finishCircleDrawing() {
  circleDrawing = false;
  
  if (drawnShape instanceof google.maps.Circle) {
    drawnShape.setEditable(true);
    drawnShape.setDraggable(true);
    drawnShape.addListener("radius_changed", updateShapeData);
    drawnShape.addListener("center_changed", updateShapeData);
    updateShapeData();
  }
}

function startRectangleDrawing(event) {
  rectStart = event.latLng;
  rectDrawing = true;

  clearShape();

  drawnShape = new google.maps.Rectangle({
    map: map,
    bounds: new google.maps.LatLngBounds(rectStart, rectStart),
    fillColor: "#FF0000",
    fillOpacity: 0.35,
    strokeWeight: 2,
    editable: false,
    draggable: false,
  });
}

function updateRectangleDrawing(event) {
  if (!rectDrawing || !rectStart || !drawnShape) return;
  
  const bounds = new google.maps.LatLngBounds(rectStart, event.latLng);
  drawnShape.setBounds(bounds);
}

function finishRectangleDrawing() {
  rectDrawing = false;
  drawnShape.setEditable(true);
  drawnShape.setDraggable(true);
  drawnShape.addListener("bounds_changed", updateShapeData);
  updateShapeData();
}

function handlePolygonClick(event) {
  if (!polygonDrawing) {
    // Start new polygon
    polygonDrawing = true;
    polygonPath = [event.latLng];
    
    clearShape();
    
    drawnShape = new google.maps.Polygon({
      map,
      paths: [polygonPath],
      fillColor: "#FF0000",
      fillOpacity: 0.35,
      strokeWeight: 2,
      editable: false,
      draggable: false,
    });
    
    polyPreview = new google.maps.Polyline({
      map,
      path: polygonPath,
      strokeColor: "#FF0000",
      strokeOpacity: 0.6,
      strokeWeight: 2,
    });
  } else {
    // Add point to existing polygon
    polygonPath.push(event.latLng);
    drawnShape.setPath(polygonPath);
    updateShapeData();
  }
}

function updatePolygonPreview(event) {
  if (!polygonDrawing || !polyPreview) return;
  
  const previewPath = polygonPath.concat([event.latLng]);
  polyPreview.setPath(previewPath);
}

function finishPolygonDrawing() {
  polygonDrawing = false;
  if (polyPreview) {
    polyPreview.setMap(null);
    polyPreview = null;
  }
  
  if (drawnShape instanceof google.maps.Polygon && polygonPath.length >= 3) {
    drawnShape.setEditable(true);
    drawnShape.setDraggable(true);
    
    const path = drawnShape.getPath();
    path.addListener("set_at", updateShapeData);
    path.addListener("insert_at", updateShapeData);
    path.addListener("remove_at", updateShapeData);
    
    updateShapeData();
  } else {
    drawnShape.setMap(null);
    drawnShape = null;
    displayFlashMessage("Polygon needs at least 3 points", "warning");
  }
}

function setupCircleDrawing() {
  let circleStart = null;
  let circleDrawing = false;

  google.maps.event.addListener(map, 'mousedown', (event) => {
    if (currentShapeType !== "circle") return;
    circleStart = event.latLng;
    circleDrawing = true;

    if (drawnShape) drawnShape.setMap(null);
    
    drawnShape = new google.maps.Circle({
      map,
      center: circleStart,
      radius: 10, 
      fillColor: "#FF0000",
      fillOpacity: 0.35,
      strokeWeight: 2,
      editable: false,
      draggable: false,
    });
  });

  google.maps.event.addListener(map, 'mousemove', (event) => {
    if (currentShapeType !== "circle" || !circleDrawing || !drawnShape) return;
    
    const radius = google.maps.geometry.spherical.computeDistanceBetween(
      circleStart, 
      event.latLng
    );
    drawnShape.setRadius(radius);
  });

  google.maps.event.addListener(map, 'mouseup', () => {
    if (currentShapeType !== "circle" || !circleDrawing) return;
    circleDrawing = false;
    
    if (drawnShape instanceof google.maps.Circle) {
      drawnShape.setEditable(true);
      drawnShape.setDraggable(true);
      drawnShape.addListener("radius_changed", updateShapeData);
      drawnShape.addListener("center_changed", updateShapeData);
      updateShapeData();
    }
  });
}

function setupPolygonDrawing() {
  let polygonDrawing = false;
  let tempPolygon = null;

  google.maps.event.addListener(map, 'click', (event) => {
    if (currentShapeType !== "polygon") return;

    if (!polygonDrawing) {
      polygonDrawing = true;
      polygonPath = [];
      if (drawnShape) drawnShape.setMap(null);
      if (polyPreview) polyPreview.setMap(null);
      
      drawnShape = new google.maps.Polygon({
        map,
        paths: [],
        fillColor: "#FF0000",
        fillOpacity: 0.35,
        strokeWeight: 2,
        editable: false,
        draggable: false,
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
    updateShapeData();
  });

  google.maps.event.addListener(map, 'mousemove', (event) => {
    if (currentShapeType !== "polygon" || !polygonDrawing || !polyPreview) return;
    
    const previewPath = polygonPath.concat([event.latLng]);
    polyPreview.setPath(previewPath);
  });

  google.maps.event.addListener(map, 'dblclick', (event) => {
    if (currentShapeType !== "polygon" || !polygonDrawing) return;
    
    polygonDrawing = false;
    if (polyPreview) {
      polyPreview.setMap(null);
      polyPreview = null;
    }
    
    if (drawnShape instanceof google.maps.Polygon && polygonPath.length >= 3) {
      drawnShape.setEditable(true);
      drawnShape.setDraggable(true);
      
      const path = drawnShape.getPath();
      path.addListener("set_at", updateShapeData);
      path.addListener("insert_at", updateShapeData);
      path.addListener("remove_at", updateShapeData);
      
      updateShapeData();
    } else {
      drawnShape.setMap(null);
      drawnShape = null;
      displayFlashMessage("Polygon needs at least 3 points", "warning");
    }
  });
}

function setupRectangleDrawing() {
  let rectStart = null;
  let rectDrawing = false;

  google.maps.event.addListener(map, 'mousedown', (event) => {
    if (currentShapeType !== "rectangle") return;
    
    rectStart = event.latLng;
    rectDrawing = true;

    if (drawnShape) drawnShape.setMap(null);

    drawnShape = new google.maps.Rectangle({
      map: map,
      bounds: new google.maps.LatLngBounds(rectStart, rectStart),
      fillColor: "#FF0000",
      fillOpacity: 0.35,
      strokeWeight: 2,
      editable: false,
      draggable: false,
    });
  });

  google.maps.event.addListener(map, 'mousemove', (event) => {
    if (!rectDrawing || !rectStart || currentShapeType !== "rectangle") return;
    
    const bounds = new google.maps.LatLngBounds(rectStart, event.latLng);
    drawnShape.setBounds(bounds);
  });

  google.maps.event.addListener(map, 'mouseup', () => {
    if (!rectDrawing || currentShapeType !== "rectangle") return;
    
    rectDrawing = false;
    drawnShape.setEditable(true);
    drawnShape.setDraggable(true);
    drawnShape.addListener("bounds_changed", updateShapeData);
    updateShapeData();
  });
}

// function setShapeType(type) {
//   currentShapeType = type;
//   clearShape();

//   document.getElementById("circleBtn").classList.remove("active");
//   document.getElementById("polygonBtn").classList.remove("active");
//   document.getElementById("rectangleBtn").classList.remove("active");
//   document.getElementById(`${type}Btn`).classList.add("active");

//   document.getElementById("circleControls").style.display = type === "circle" ? "block" : "none";
//   document.getElementById("polygonControls").style.display = type === "polygon" ? "block" : "none";
//   document.getElementById("rectangleControls").style.display = type === "rectangle" ? "block" : "none";
// }

function setShapeType(type) {
  currentShapeType = type;
  clearShape();
  resetDrawingState();

  document.getElementById("circleBtn").classList.remove("active");
  document.getElementById("polygonBtn").classList.remove("active");
  document.getElementById("rectangleBtn").classList.remove("active");
  document.getElementById(`${type}Btn`).classList.add("active");

  document.getElementById("circleControls").style.display = type === "circle" ? "block" : "none";
  document.getElementById("polygonControls").style.display = type === "polygon" ? "block" : "none";
  document.getElementById("rectangleControls").style.display = type === "rectangle" ? "block" : "none";
}

function resetDrawingState() {
  circleDrawing = false;
  circleStart = null;
  polygonDrawing = false;
  polygonPath = [];
  rectDrawing = false;
  rectStart = null;
  
  if (polyPreview) {
    polyPreview.setMap(null);
    polyPreview = null;
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
            })
        });

        if (response.ok) {
            const result = await response.json();
            displayFlashMessage('Geofence saved successfully!', 'success');
            clearShape();
            resetDrawingState();
            document.getElementById("geofenceForm").reset();
            document.getElementById("shapeData").value = "";
            loadSavedGeofences();
        } else {
            const error = await response.json();
            console.error((error.error || JSON.stringify(error)));
            displayFlashMessage('Error saving geofence: ' + (error.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error saving geofence:', error);
        displayFlashMessage('Error saving geofence: ' + error.message, 'danger');
    }
}

function clearShape() {
  if (drawnShape) {
    drawnShape.setMap(null);
    drawnShape = null;
  }
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
            <div>Created on:<br> ${new Date(gf.created_at).toLocaleString()}</div>
            <div class="geofence-status-container">
                <span class="geofence-status-label">Status:</span>
                <label class="geofence-status-switch">
                    <input type="checkbox" ${gf.is_active ? 'checked' : ''} 
                           onchange="toggleGeofenceStatus('${gf._id}', this.checked)">
                    <span class="geofence-status-slider"></span>
                </label>
                <span class="geofence-status-text">${gf.is_active ? 'Active' : 'Inactive'}</span>
            </div>
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
  // Clear existing overlays
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

    // Set colors based on active status
    const fillColor = gf.is_active ? "#FF0000" : "#888888";
    const fillOpacity = gf.is_active ? 0.2 : 0.1;
    const strokeColor = gf.is_active ? "#FF0000" : "#666666";

    if (gf.shape_type === "circle") {
      const center = new google.maps.LatLng(coords.center.lat, coords.center.lng);
      overlay = new google.maps.Circle({
        center: center,
        radius: coords.radius,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        strokeColor: strokeColor,
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
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        strokeColor: strokeColor,
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
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        strokeColor: strokeColor,
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

async function toggleGeofenceStatus(geofenceId, newStatus) {
    try {
        const response = await fetch(`/geofence/api/geofences/${geofenceId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCookie("csrf_access_token"),
            },
            body: JSON.stringify({
                is_active: newStatus
            })
        });

        if (response.ok) {
            displayFlashMessage(`Geofence ${newStatus ? 'activated' : 'deactivated'} successfully!`, 'success');
            loadSavedGeofences();
        } else {
            const error = await response.json();
            displayFlashMessage('Error updating geofence status', 'danger');
        }
    } catch (error) {
        console.error('Error updating geofence status:', error);
        displayFlashMessage('Error updating geofence status', 'danger');
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