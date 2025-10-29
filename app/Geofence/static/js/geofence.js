let geofenceMap;
let drawnShape = null;
let geofences = [];
let rectangle = null;
let editingGeofence = null;
let editingOverlay = null;
let originalOverlayData = null;
let currentShapeType = null;

let drawingManager = null;
let selectedOverlay = null;

let isDrawing = false;
let circleCenter = null;
let polyPreview = null;

async function geofenceMap() {
  const mapElement = document.getElementById("geofenceMap");
  if (!mapElement) {
    console.error("Map element not found!");
    return;
  }

  try {
    const { Map } = await google.maps.importLibrary("maps");
    await google.maps.importLibrary("geometry");

    await google.maps.importLibrary("drawing");

    geofenceMap = new Map(mapElement, {
      center: { lat: 20.5937, lng: 78.9629 },
      zoom: 5,
      disableDoubleClickZoom: true,
    });

    initDrawingManager();

    setupEventListeners();

    setShapeType("circle");

    loadSavedGeofences();
  } catch (error) {
    console.error("Error creating map:", error);
    displayFlashMessage("Error loading Google Maps");
  }
}

function setShapeType(type) {
  currentShapeType = type;
  if (!drawingManager) initDrawingManager();

  const modeMap = {
    circle: google.maps.drawing.OverlayType.CIRCLE,
    polygon: google.maps.drawing.OverlayType.POLYGON,
    rectangle: google.maps.drawing.OverlayType.RECTANGLE,
    none: null
  };

  if (type === 'circle') {
    drawingManager.setDrawingMode(null);
  } else {
    drawingManager.setDrawingMode(mode);
  }

  clearSelection();
  if (polyPreview) {
    polyPreview.setMap(null);
    polyPreview = null;
  }

  const circleControls = document.getElementById("circleControls");
  const polygonControls = document.getElementById("polygonControls");
  const rectangleControls = document.getElementById("rectangleControls");
  if (circleControls) circleControls.style.display = (type === "circle") ? "block" : "none";
  if (polygonControls) polygonControls.style.display = (type === "polygon") ? "block" : "none";
  if (rectangleControls) rectangleControls.style.display = (type === "rectangle") ? "block" : "none";
  // ensure drawing state is clean
  resetDrawingState();

  setupMapListeners();
}

function setupMapListeners() {
  // remove any map listeners first
  google.maps.event.clearListeners(geofenceMap, 'mousedown');
  google.maps.event.clearListeners(geofenceMap, 'mousemove');
  google.maps.event.clearListeners(geofenceMap, 'mouseup');
  google.maps.event.clearListeners(geofenceMap, 'click');
  google.maps.event.clearListeners(geofenceMap, 'dblclick');

  console.log(`Setting up map listeners for shape type: ${currentShapeType}`);

  if (currentShapeType === "circle") {
    setupCircleDrawing();
  } else if (currentShapeType === "polygon" || currentShapeType === "rectangle") {
    const modeMap = {
      polygon: google.maps.drawing.OverlayType.POLYGON,
      rectangle: google.maps.drawing.OverlayType.RECTANGLE
    };
    if (drawingManager) {
      drawingManager.setDrawingMode(modeMap[currentShapeType]);
    }
  }
}

function setupEventListeners() {
  const circleBtn = document.getElementById("circleBtn");
  const polygonBtn = document.getElementById("polygonBtn");
  const rectangleBtn = document.getElementById("rectangleBtn");
  const radiusSlider = document.getElementById("radiusSlider");

  if (circleBtn) circleBtn.addEventListener("click", () => setShapeType("circle"));
  if (polygonBtn) polygonBtn.addEventListener("click", () => setShapeType("polygon"));
  if (rectangleBtn) rectangleBtn.addEventListener("click", () => setShapeType("rectangle"));

  if (radiusSlider) {
    radiusSlider.addEventListener("input", (e) => {
      const rv = document.getElementById("radiusValue");
      if (rv) rv.textContent = e.target.value;
      if (drawnShape && drawnShape instanceof google.maps.Circle) {
        drawnShape.setRadius(parseFloat(e.target.value));
        updateShapeData();
      }
    });
  }

  const form = document.getElementById("geofenceForm");
  form.addEventListener("submit", handleFormSubmit);

  const saveBtn = document.getElementById("save");
  const deleteBtn = document.getElementById("delete");
  if (saveBtn) saveBtn.addEventListener("click", saveSelectedShape);
  if (deleteBtn) deleteBtn.addEventListener("click", deleteSelectedShape);
}

function setupMapListeners() {
  google.maps.event.clearListeners(geofenceMap, 'mousedown');
  google.maps.event.clearListeners(geofenceMap, 'mousemove');
  google.maps.event.clearListeners(geofenceMap, 'mouseup');
  google.maps.event.clearListeners(geofenceMap, 'click');
  google.maps.event.clearListeners(geofenceMap, 'dblclick');

  console.log(`Setting up map listeners for shape type: ${currentShapeType}`);

  if (currentShapeType === "circle") {
    setupCircleDrawing();
  } else if (currentShapeType === "polygon") {
    setupPolygonDrawing();
  } else if (currentShapeType === "rectangle") {
    setupRectangleDrawing();
  }
}

function initDrawingManager() {
  // If drawingManager already initialized, keep it
  if (drawingManager) return;

  try {
    drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null, // default no autoset
      drawingControl: false, // we use custom buttons
      polygonOptions: { editable: true, draggable: true },
      rectangleOptions: { editable: true, draggable: true },
      circleOptions: { editable: true, draggable: true },
    });

    drawingManager.setMap(geofenceMap);

    // overlaycomplete -> capture the overlay created by drawing manager
    google.maps.event.addListener(drawingManager, "overlaycomplete", function (event) {
      // clear previous selection/overlay
      clearSelection();

      // keep overlay as our selected overlay
      selectedOverlay = event.overlay;
      selectedOverlay.type = event.type;
      drawnShape = selectedOverlay; // reuse existing variable used by updateShapeData()

      // make sure overlay editable + draggable
      if (selectedOverlay.setEditable) selectedOverlay.setEditable(true);
      if (selectedOverlay.setDraggable) selectedOverlay.setDraggable(true);

      // wire click to select
      google.maps.event.addListener(selectedOverlay, "click", function () {
        setSelection(selectedOverlay);
      });

      // show delete (if present) and update form shapeData
      const deleteBtn = document.getElementById("delete");
      if (deleteBtn) deleteBtn.style.display = "inline";
      updateShapeData();
    });

    // When user switches custom toolbar buttons, set drawingManager.drawingMode accordingly
    // Keep in sync with setShapeType
  } catch (err) {
    console.warn("DrawingManager init failed:", err);
  }
}

function setSelection(shape) {
  clearSelection();
  selectedOverlay = shape;
  drawnShape = shape;
  if (selectedOverlay.setEditable) selectedOverlay.setEditable(true);
  updateShapeData();
}

function clearSelection() {
  if (selectedOverlay) {
    if (selectedOverlay.setEditable) selectedOverlay.setEditable(false);
    selectedOverlay = null;
  }
  drawnShape = null;
  // hide delete button
  const deleteBtn = document.getElementById("delete");
  if (deleteBtn) deleteBtn.style.display = "none";
}

function deleteSelectedShape() {
  if (selectedOverlay) {
    selectedOverlay.setMap(null);
    selectedOverlay = null;
    drawnShape = null;
    document.getElementById("shapeData").value = "";
    const deleteBtn = document.getElementById("delete");
    if (deleteBtn) deleteBtn.style.display = "none";
  } else if (drawnShape) {
    // fallback
    drawnShape.setMap(null);
    drawnShape = null;
    document.getElementById("shapeData").value = "";
  }
}

function rectangleBoundsToPolygonPoints(bounds) {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return [
    { lat: ne.lat(), lng: ne.lng() },                  // NE
    { lat: ne.lat(), lng: sw.lng() },                  // NW
    { lat: sw.lat(), lng: sw.lng() },                  // SW
    { lat: sw.lat(), lng: ne.lng() }                   // SE
  ];
}

async function saveSelectedShape(ev) {
  ev && ev.preventDefault && ev.preventDefault();

  // prefer selectedOverlay, fallback to drawnShape
  const overlay = selectedOverlay || drawnShape;
  if (!overlay) {
    displayFlashMessage("Please draw a geofence first", "warning");
    return;
  }

  // gather name/location from form if present
  const nameEl = document.getElementById("GeofenceName");
  const locEl = document.getElementById("Location");
  const name = nameEl ? nameEl.value : (overlay.title || "Unnamed Geofence");
  const location = locEl ? locEl.value : "";

  let shape_type = null;
  let coordinates = null;

  if (overlay.type === google.maps.drawing.OverlayType.CIRCLE || overlay instanceof google.maps.Circle) {
    shape_type = "circle";
    const center = overlay.getCenter ? overlay.getCenter().toJSON() : { lat: overlay.center.lat(), lng: overlay.center.lng() };
    coordinates = { center: center, radius: overlay.getRadius() };
  } else if (overlay.type === google.maps.drawing.OverlayType.RECTANGLE || overlay instanceof google.maps.Rectangle) {
    // convert rectangle to polygon points and save as polygon
    shape_type = "polygon";
    const bounds = overlay.getBounds();
    const pts = rectangleBoundsToPolygonPoints(bounds).map(p => ({ lat: p.lat, lng: p.lng }));
    coordinates = { points: pts };
  } else {
    // polygon (overlay.type MAY be 'polygon' or overlay instanceof google.maps.Polygon)
    shape_type = "polygon";
    let pathArr = [];
    if (overlay.getPath) {
      pathArr = overlay.getPath().getArray().map((coord) => ({ lat: coord.lat(), lng: coord.lng() }));
    } else if (overlay.path) {
      pathArr = overlay.path.map(p => ({ lat: p.lat(), lng: p.lng() }));
    }
    coordinates = { points: pathArr };
  }

  try {
    const payload = {
      name: name,
      location: location,
      shape_type: shape_type,
      coordinates: coordinates,
    };

    const response = await fetch("/geofence/api/geofences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      displayFlashMessage("Geofence saved successfully!", "success");
      // reload list and map overlays
      clearSelection();
      loadSavedGeofences();
      // reset form fields if needed
      if (nameEl) nameEl.value = "";
      if (document.getElementById("shapeData")) document.getElementById("shapeData").value = "";
    } else {
      const err = await response.json().catch(() => ({ error: "Unknown" }));
      displayFlashMessage("Error saving geofence: " + (err.error || "Unknown error"), "danger");
      console.error("Save geofence error:", err);
    }
  } catch (err) {
    console.error("Error saving geofence:", err);
    displayFlashMessage("Error saving geofence: " + err.message, "danger");
  }
}

function setupCircleDrawing() {
  let circleStart = null;
  let circleDrawing = false;
  let tempCircle = null;

  // Clear any existing listeners first
  google.maps.event.clearListeners(geofenceMap, 'mousedown');
  google.maps.event.clearListeners(geofenceMap, 'mousemove');
  google.maps.event.clearListeners(geofenceMap, 'mouseup');

  // Mouse down to start drawing
  google.maps.event.addListener(geofenceMap, 'mousedown', (event) => {
    if (currentShapeType !== "circle") return;
    
    circleStart = event.latLng;
    circleDrawing = true;

    // Clear any existing shape
    if (drawnShape) {
      drawnShape.setMap(null);
      drawnShape = null;
    }

    // Create temporary circle
    tempCircle = new google.maps.Circle({
      map: geofenceMap,
      center: circleStart,
      radius: 1, // Start with small radius
      fillColor: "#FF0000",
      fillOpacity: 0.35,
      strokeWeight: 2,
      strokeColor: "#FF0000",
      editable: false,
      draggable: false,
    });
  });

  // Mouse move to update circle size
  google.maps.event.addListener(geofenceMap, 'mousemove', (event) => {
    if (!circleDrawing || !tempCircle || currentShapeType !== "circle") return;
    
    const radius = google.maps.geometry.spherical.computeDistanceBetween(
      circleStart, 
      event.latLng
    );
    tempCircle.setRadius(radius);
  });

  // Mouse up to finish drawing
  google.maps.event.addListener(geofenceMap, 'mouseup', (event) => {
    if (!circleDrawing || !tempCircle || currentShapeType !== "circle") return;
    
    circleDrawing = false;
    
    // Set the final circle as drawnShape
    drawnShape = tempCircle;
    tempCircle = null;
    
    // Make it editable
    drawnShape.setEditable(true);
    drawnShape.setDraggable(true);
    
    // Add listeners for changes
    drawnShape.addListener("radius_changed", updateShapeData);
    drawnShape.addListener("center_changed", updateShapeData);
    
    updateShapeData();
  });
}

function updateShapeData() {
  try {
    const el = document.getElementById("shapeData");
    if (!el) return;

    const overlay = selectedOverlay || drawnShape;
    if (!overlay) {
      el.value = "";
      updatePointCount(0);
      return;
    }

    if (overlay instanceof google.maps.Circle || overlay.type === google.maps.drawing.OverlayType.CIRCLE) {
      const center = overlay.getCenter().toJSON();
      const radius = overlay.getRadius();
      el.value = JSON.stringify({ center: center, radius: radius });
      updatePointCount(1);
      return;
    }

    if (overlay instanceof google.maps.Rectangle || overlay.type === google.maps.drawing.OverlayType.RECTANGLE) {
      // convert rectangle bounds to polygon points and save as polygon payload
      const bounds = overlay.getBounds();
      const pts = rectangleBoundsToPolygonPoints(bounds);
      el.value = JSON.stringify({ points: pts });
      updatePointCount(pts.length);
      return;
    }

    // polygon
    if (overlay.getPath) {
      const pts = overlay.getPath().getArray().map(ll => ({ lat: ll.lat(), lng: ll.lng() }));
      el.value = JSON.stringify({ points: pts });
      updatePointCount(pts.length);
      return;
    }

    // fallback
    el.value = "";
    updatePointCount(0);
  } catch (err) {
    console.error("updateShapeData error:", err);
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

    let coordinatesObj = null;

    try {
        coordinatesObj = JSON.parse(shapeData);
    } catch (err) {
        displayFlashMessage("Invalid shape data", "danger");
        return;
    }
    let shapeTypeToSend = currentShapeType;
    if (currentShapeType === "rectangle" && coordinatesObj && Array.isArray(coordinatesObj.points)) {
        shapeTypeToSend = "polygon";
    }

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
                shape_type: shapeTypeToSend,
                coordinates: coordinatesObj,
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

            setShapeType(currentShapeType);
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
  if (polyPreview) {
    polyPreview.setMap(null);
    polyPreview = null;
  }
  document.getElementById("shapeData").value = "";
  resetDrawingState();
}

function resetDrawingState() {
  try {
    if (drawingManager) drawingManager.setDrawingMode(null);
  } catch (e) {}
  isDrawing = false;
  circleCenter = null;
  if (polyPreview) { polyPreview.setMap(null); polyPreview = null; }
  // reset UI controls visibility
  const circleControls = document.getElementById("circleControls");
  const polygonControls = document.getElementById("polygonControls");
  const rectangleControls = document.getElementById("rectangleControls");
  if (circleControls) circleControls.style.display = "none";
  if (polygonControls) polygonControls.style.display = "none";
  if (rectangleControls) rectangleControls.style.display = "none";
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
        map: geofenceMap,
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
        map: geofenceMap,
        editable: false,
        draggable: false,
      });
      path.forEach((latlng) => bounds.extend(latlng));
      hasGeofence = true;
    } else if (gf.shape_type === "rectangle") {
      // Make sure this part is correct
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
        map: geofenceMap,
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
    geofenceMap.fitBounds(bounds);
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
            map: geofenceMap,
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
            map: geofenceMap,
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
            map: geofenceMap,
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
            displayFlashMessage("Error updating geofence: " + (error.error || 'Unknown error'), 'danger');
            console.error((error.error || JSON.stringify(error)));
        }
    } catch (error) {
        displayFlashMessage("Error updating geofence: " + error.message, 'danger');
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
        geofenceMap.setCenter(new google.maps.LatLng(coords.center.lat, coords.center.lng));
        geofenceMap.setZoom(15);
    } else if (geofence.shape_type === 'polygon') {
        const bounds = new google.maps.LatLngBounds();
        coords.points.forEach(point => {
            bounds.extend(new google.maps.LatLng(point.lat, point.lng));
        });
        geofenceMap.fitBounds(bounds);
    } else if (geofence.shape_type === 'rectangle') {
        const bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(coords.bounds.south, coords.bounds.west),
            new google.maps.LatLng(coords.bounds.north, coords.bounds.east)
        );
        geofenceMap.fitBounds(bounds);
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
            displayFlashMessage('Error deleting geofence: ' + (error.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error deleting geofence:', error);
        displayFlashMessage('Error deleting geofence: ' + error.message);
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

function updatePointCount(count) {
    const pointCountElement = document.getElementById("pointCount");
    if (pointCountElement) {
        pointCountElement.textContent = count;
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