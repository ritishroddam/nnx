let geofenceMap;
let drawingManager = null;
let selectedOverlay = null; // overlay returned by DrawingManager
let drawnShape = null; // alias for currently selected overlay
let geofences = [];

let editingGeofence = null;
let editingOverlay = null;
let originalOverlayData = null;

async function geofenceMapFunction() {
  const mapElement = document.getElementById("geofenceMap");
  if (!mapElement) {
    console.error("Map element not found!");
    return;
  }

  try {
    const { Map } = await google.maps.importLibrary("maps");
    await google.maps.importLibrary("geometry");
    // drawing library may be deprecated but import if available
    try {
      await google.maps.importLibrary("drawing");
    } catch (err) {
      console.warn("drawing import failed - ensure maps script includes drawing library", err);
    }

    geofenceMap = new Map(mapElement, {
      center: { lat: 20.5937, lng: 78.9629 },
      zoom: 5,
      disableDoubleClickZoom: true,
    });

    initDrawingManager();
    wireUiButtons();
    loadSavedGeofences();
  } catch (error) {
    console.error("Error creating map:", error);
    displayFlashMessage("Error loading Google Maps");
  }
}

/* ---------- DrawingManager + overlay handling ---------- */
function initDrawingManager() {
  if (drawingManager) return;

  try {
    // initialize DrawingManager; drawingControl disabled because we use custom buttons
    drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polygonOptions: { editable: true, draggable: true },
      rectangleOptions: { editable: true, draggable: true },
      circleOptions: { editable: true, draggable: true },
    });
    drawingManager.setMap(geofenceMap);

    google.maps.event.addListener(drawingManager, "overlaycomplete", function (event) {
      // Stop drawing after overlay created
      try { drawingManager.setDrawingMode(null); } catch (e) {}

      // remove previous temporary overlay
      if (selectedOverlay) {
        selectedOverlay.setMap(null);
        selectedOverlay = null;
        drawnShape = null;
      }

      selectedOverlay = event.overlay;
      selectedOverlay.type = event.type;
      drawnShape = selectedOverlay;

      // ensure editable/draggable
      if (selectedOverlay.setEditable) selectedOverlay.setEditable(true);
      if (selectedOverlay.setDraggable) selectedOverlay.setDraggable(true);

      // attach edit listeners so updateShapeData keeps the hidden input in-sync
      wireOverlayChangeListeners(selectedOverlay);

      // present delete/save controls (template should have #delete and #save)
      const deleteBtn = document.getElementById("delete");
      if (deleteBtn) deleteBtn.style.display = "inline";

      updateShapeData();

      // optional: open vehicle popup if present
      const vehiclePopup = document.getElementById("vehiclePopup");
      if (vehiclePopup) vehiclePopup.classList.add("active");
      if (typeof loadVehicles === "function") loadVehicles();
    });
  } catch (err) {
    console.warn("DrawingManager init failed:", err);
  }
}

function wireOverlayChangeListeners(overlay) {
  try {
    if (!overlay) return;
    // Circle listeners
    if (overlay instanceof google.maps.Circle || overlay.type === google.maps.drawing.OverlayType.CIRCLE) {
      google.maps.event.addListener(overlay, "radius_changed", updateShapeData);
      google.maps.event.addListener(overlay, "center_changed", updateShapeData);
    }
    // Rectangle listeners
    if (overlay instanceof google.maps.Rectangle || overlay.type === google.maps.drawing.OverlayType.RECTANGLE) {
      google.maps.event.addListener(overlay, "bounds_changed", updateShapeData);
    }
    // Polygon listeners
    if (overlay instanceof google.maps.Polygon || overlay.type === google.maps.drawing.OverlayType.POLYGON) {
      const path = overlay.getPath();
      google.maps.event.addListener(path, "set_at", updateShapeData);
      google.maps.event.addListener(path, "insert_at", updateShapeData);
      google.maps.event.addListener(path, "remove_at", updateShapeData);
    }
    // click selects overlay
    google.maps.event.addListener(overlay, "click", () => {
      setSelection(overlay);
    });
  } catch (e) {
    console.warn("wireOverlayChangeListeners failed:", e);
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
    try { if (selectedOverlay.setEditable) selectedOverlay.setEditable(false); } catch (e) {}
    selectedOverlay = null;
  }
  drawnShape = null;
  const deleteBtn = document.getElementById("delete");
  if (deleteBtn) deleteBtn.style.display = "none";
}

/* ---------- UI wiring (custom buttons) ---------- */
function wireUiButtons() {
  const circleBtn = document.getElementById("circleBtn");
  const polygonBtn = document.getElementById("polygonBtn");
  const rectangleBtn = document.getElementById("rectangleBtn");
  const saveBtn = document.getElementById("save");
  const deleteBtn = document.getElementById("delete");

  if (circleBtn) circleBtn.addEventListener("click", () => startDrawingMode("circle", circleBtn));
  if (polygonBtn) polygonBtn.addEventListener("click", () => startDrawingMode("polygon", polygonBtn));
  if (rectangleBtn) rectangleBtn.addEventListener("click", () => startDrawingMode("rectangle", rectangleBtn));
  if (saveBtn) saveBtn.addEventListener("click", saveSelectedShape);
  if (deleteBtn) deleteBtn.addEventListener("click", deleteSelectedShape);
}

function startDrawingMode(type, btnEl) {
  // UI active state
  document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");

  // clear any existing selection
  clearSelection();
  updateShapeData(); // clear hidden input

  // set drawing mode on DrawingManager
  if (!drawingManager) initDrawingManager();
  const mapType = google.maps.drawing ? google.maps.drawing.OverlayType : null;
  if (!mapType || !drawingManager) {
    // DrawingManager not available -> fallback: set currentShapeType to handle manual drawing (not implemented here)
    console.warn("DrawingManager unavailable - drawing won't start.");
    return;
  }

  if (type === "circle") {
    drawingManager.setDrawingMode(mapType.CIRCLE);
  } else if (type === "polygon") {
    drawingManager.setDrawingMode(mapType.POLYGON);
  } else if (type === "rectangle") {
    drawingManager.setDrawingMode(mapType.RECTANGLE);
  } else {
    drawingManager.setDrawingMode(null);
  }
}

/* ---------- Shape serialization helpers ---------- */
function rectangleBoundsToPolygonPoints(bounds) {
  // Return clockwise polygon points from rectangle bounds
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  // compute corners
  const nw = new google.maps.LatLng(ne.lat(), sw.lng());
  const se = new google.maps.LatLng(sw.lat(), ne.lng());
  // Clockwise: NE, SE, SW, NW
  return [
    { lat: ne.lat(), lng: ne.lng() },
    { lat: se.lat(), lng: se.lng() },
    { lat: sw.lat(), lng: sw.lng() },
    { lat: nw.lat(), lng: nw.lng() },
  ];
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

    // Circle
    if (overlay instanceof google.maps.Circle || overlay.type === google.maps.drawing.OverlayType.CIRCLE) {
      const center = overlay.getCenter().toJSON();
      const radius = overlay.getRadius();
      el.value = JSON.stringify({ center: center, radius: radius });
      updatePointCount(1);
      return;
    }

    // Rectangle -> convert to polygon points
    if (overlay instanceof google.maps.Rectangle || overlay.type === google.maps.drawing.OverlayType.RECTANGLE) {
      const bounds = overlay.getBounds();
      const pts = rectangleBoundsToPolygonPoints(bounds);
      el.value = JSON.stringify({ points: pts });
      updatePointCount(pts.length);
      return;
    }

    // Polygon
    if (overlay.getPath) {
      const pts = overlay.getPath().getArray().map(ll => ({ lat: ll.lat(), lng: ll.lng() }));
      el.value = JSON.stringify({ points: pts });
      updatePointCount(pts.length);
      return;
    }

    el.value = "";
    updatePointCount(0);
  } catch (err) {
    console.error("updateShapeData error:", err);
  }
}

function updatePointCount(count) {
  const el = document.getElementById("pointCount");
  if (el) el.textContent = count;
}

/* ---------- Save / delete ---------- */
async function saveSelectedShape(ev) {
  ev && ev.preventDefault && ev.preventDefault();

  const overlay = selectedOverlay || drawnShape;
  if (!overlay) {
    displayFlashMessage("Please draw a geofence first", "warning");
    return;
  }

  const nameEl = document.getElementById("GeofenceName");
  const locEl = document.getElementById("Location");
  const name = nameEl ? nameEl.value : (overlay.title || "Unnamed Geofence");
  const location = locEl ? locEl.value : "";

  let shape_type = null;
  let coordinates = null;

  // Circle
  if (overlay instanceof google.maps.Circle || overlay.type === google.maps.drawing.OverlayType.CIRCLE) {
    shape_type = "circle";
    const center = overlay.getCenter().toJSON();
    coordinates = { center: center, radius: overlay.getRadius() };
  }
  // Rectangle -> convert to polygon points (store as polygon)
  else if (overlay instanceof google.maps.Rectangle || overlay.type === google.maps.drawing.OverlayType.RECTANGLE) {
    shape_type = "polygon";
    const bounds = overlay.getBounds();
    const pts = rectangleBoundsToPolygonPoints(bounds);
    coordinates = { points: pts };
  }
  // Polygon
  else {
    shape_type = "polygon";
    let pathArr = [];
    if (overlay.getPath) {
      pathArr = overlay.getPath().getArray().map((coord) => ({ lat: coord.lat(), lng: coord.lng() }));
    } else if (overlay.path) {
      pathArr = overlay.path.map(p => ({ lat: p.lat, lng: p.lng }));
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
      clearOverlay();
      loadSavedGeofences();
      // reset form
      if (document.getElementById("geofenceForm")) document.getElementById("geofenceForm").reset();
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

function deleteSelectedShape() {
  if (selectedOverlay) {
    selectedOverlay.setMap(null);
    selectedOverlay = null;
    drawnShape = null;
  } else if (drawnShape) {
    drawnShape.setMap(null);
    drawnShape = null;
  }
  const el = document.getElementById("shapeData");
  if (el) el.value = "";
  const deleteBtn = document.getElementById("delete");
  if (deleteBtn) deleteBtn.style.display = "none";
  updatePointCount(0);
}

function clearOverlay() {
  if (selectedOverlay) {
    selectedOverlay.setMap(null);
    selectedOverlay = null;
  }
  if (drawnShape) {
    drawnShape.setMap(null);
    drawnShape = null;
  }
  try { drawingManager && drawingManager.setDrawingMode(null); } catch(e) {}
  const del = document.getElementById("delete");
  if (del) del.style.display = "none";
  updatePointCount(0);
}

/* ---------- Load/render existing geofences ---------- */
async function loadSavedGeofences() {
  try {
    const response = await fetch("/geofence/api/geofences");
    if (response.ok) {
      geofences = await response.json();
      renderGeofenceList();
      renderGeofencesOnMap();
    } else {
      console.error("Failed to load geofences");
    }
  } catch (err) {
    console.error("Error loading geofences:", err);
  }
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

/* ---------- Init on window load ---------- */
window.onload = async function () {
  try {
    await backgroundMap(); // existing helper that sets up base map visuals
  } catch (e) {
    console.warn("backgroundMap failed or missing:", e);
  }
  await geofenceMapFunction();
};