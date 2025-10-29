let geofenceMap;
let draw;
let geofences = [];
let selectedFeatureId = null; 

async function geofenceMapFunction() {
  const mapElement = document.getElementById("geofenceMap");
  if (!mapElement) {
    console.error("Map element not found!");
    return;
  }

  const { Map } = await google.maps.importLibrary("maps");
  await google.maps.importLibrary("geometry");

  geofenceMap = new Map(mapElement, {
    center: { lat: 20.5937, lng: 78.9629 },
    zoom: 5,
    disableDoubleClickZoom: true,
  });

  const TerraNS = window.TerraDraw || {};
  const {
    TerraDraw: TerraDrawCtor,
    TerraDrawSelectMode,
    TerraDrawPolygonMode,
    TerraDrawRectangleMode,
    TerraDrawCircleMode,
  } = TerraNS;
  const AdapterCtor =
    window.TerraDrawGoogleMapsAdapter ||
    window.terraDrawGoogleMapsAdapter?.TerraDrawGoogleMapsAdapter;

  if (!TerraDrawCtor || !AdapterCtor) {
    console.error("TerraDraw or Google Maps adapter not found. Check script includes and versions.");
    throw new Error("TerraDraw/Adapter UMD not available");
  }

  draw = new TerraDrawCtor({
    adapter: new AdapterCtor({
      map: geofenceMap,
      lib: google.maps,
      coordinatePrecision: 9,
    }),
    modes: [
      new TerraDrawSelectMode({
        flags: {
          polygon: { feature: { draggable: true, rotateable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
          rectangle: { feature: { draggable: true, rotateable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
          circle: { feature: { draggable: true, rotateable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
        },
      }),
      new TerraDrawPolygonMode({
        editable: true,
        styles: { fillColor: "#FF5722", outlineColor: "#FF5722" },
      }),
      new TerraDrawRectangleMode({
        styles: { fillColor: "#3F51B5", outlineColor: "#3F51B5" },
      }),
      new TerraDrawCircleMode({
        styles: { fillColor: "#27AE60", outlineColor: "#27AE60" },
      }),
    ],
  });

  draw.start();

  draw.on("ready", () => {
    setMode("polygon");
    wireUiButtons();
  });

  draw.on("select", (id) => {
    selectedFeatureId = id;
    updateShapeData();
    showDelete();
  });
  draw.on("deselect", () => {
    selectedFeatureId = null;
    updateShapeData();
  });

  draw.on("change", () => updateShapeData());

  await loadSavedGeofences();
}

function wireUiButtons() {
  const circleBtn = document.getElementById("circleBtn");
  const polygonBtn = document.getElementById("polygonBtn");
  const rectangleBtn = document.getElementById("rectangleBtn");
  const saveBtn = document.querySelector('#geofenceForm .confirm-btn');

  if (circleBtn) circleBtn.addEventListener("click", () => setMode("circle", circleBtn));
  if (polygonBtn) polygonBtn.addEventListener("click", () => setMode("polygon", polygonBtn));
  if (rectangleBtn) rectangleBtn.addEventListener("click", () => setMode("rectangle", rectangleBtn));

  const form = document.getElementById("geofenceForm");
  if (form) form.addEventListener("submit", saveSelectedShape);

  const del = document.getElementById("delete");
  if (del) del.addEventListener("click", deleteSelectedShape);
  if (saveBtn) saveBtn.type = "submit";
}

function setMode(mode, btn) {
  document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  draw.setMode(mode);
}

function updateShapeData() {
  const el = document.getElementById("shapeData");
  if (!el) return;

  const features = draw.getSnapshot();
  if (!features || features.length === 0) {
    el.value = "";
    updatePointCount(0);
    hideDelete();
    return;
  }

  const f = selectedFeatureId
    ? features.find((x) => x.id === selectedFeatureId) || features[features.length - 1]
    : features[features.length - 1];

  if (!f) {
    el.value = "";
    updatePointCount(0);
    hideDelete();
    return;
  }

  const payload = featureToCoordinatesPayload(f);
  if (!payload) {
    el.value = "";
    updatePointCount(0);
    return;
  }

  if (payload.shape_type === "polygon" && payload.coordinates.points) {
    updatePointCount(payload.coordinates.points.length);
  } else {
    updatePointCount(1);
  }

  el.value = JSON.stringify(payload.coordinates);
  showDelete();
}

function featureToCoordinatesPayload(feature) {
  const mode = (feature.properties && feature.properties.mode) || "";

  if (mode === "rectangle" || (feature.geometry && feature.geometry.type === "Polygon" && mode !== "polygon" && mode !== "circle")) {
    const ring = feature.geometry.coordinates[0] || [];
    const points = ring.map(([lng, lat]) => ({ lat, lng }));
    return { shape_type: "polygon", coordinates: { points } };
  }

  if (mode === "polygon" || feature.geometry?.type === "Polygon") {
    const ring = feature.geometry.coordinates[0] || [];
    const points = ring.map(([lng, lat]) => ({ lat, lng }));
    return { shape_type: "polygon", coordinates: { points } };
  }

  if (mode === "circle") {
    const center = feature.properties?.center;
    const radius = feature.properties?.radius ?? feature.properties?._radius;

    if (center && typeof radius === "number") {
      return { shape_type: "circle", coordinates: { center, radius } };
    }

    const ring = feature.geometry?.coordinates?.[0] || [];
    if (ring.length >= 3) {
      const pts = ring.map(([lng, lat]) => ({ lat, lng }));
      const centerLL = averageLatLng(pts);
      const r = averageRadius(centerLL, pts);
      return { shape_type: "circle", coordinates: { center: centerLL, radius: r } };
    }
  }

  return null;
}

function averageLatLng(points) {
  const n = points.length;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / n, lng: sum.lng / n };
}

function averageRadius(center, points) {
  const centerLL = new google.maps.LatLng(center.lat, center.lng);
  const dists = points.map(p => {
    const ll = new google.maps.LatLng(p.lat, p.lng);
    return google.maps.geometry.spherical.computeDistanceBetween(centerLL, ll);
  });
  return dists.reduce((a, b) => a + b, 0) / dists.length;
}

function updatePointCount(count) {
  const el = document.getElementById("pointCount");
  if (el) el.textContent = count;
}

function showDelete() {
  const del = document.getElementById("delete");
  if (del) del.style.display = "inline";
}

function hideDelete() {
  const del = document.getElementById("delete");
  if (del) del.style.display = "none";
}

async function saveSelectedShape(e) {
  e.preventDefault();

  const features = draw.getSnapshot();
  if (!features || features.length === 0) {
    displayFlashMessage("Please draw a geofence first", "warning");
    return;
  }

  const f = selectedFeatureId
    ? features.find((x) => x.id === selectedFeatureId) || features[features.length - 1]
    : features[features.length - 1];

  const payloadPart = featureToCoordinatesPayload(f);
  if (!payloadPart) {
    displayFlashMessage("Invalid shape data", "danger");
    return;
  }

  const name = document.getElementById("GeofenceName")?.value || "Unnamed Geofence";
  const location = document.getElementById("Location")?.value || "";

  const payload = {
    name,
    location,
    shape_type: payloadPart.shape_type === "rectangle" ? "polygon" : payloadPart.shape_type,
    coordinates: payloadPart.coordinates,
  };

  const res = await fetch("/geofence/api/geofences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": (typeof getCookie === "function" ? getCookie("csrf_access_token") : "") || "",
    },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    displayFlashMessage("Geofence saved successfully!", "success");
    draw.clear();
    selectedFeatureId = null;
    document.getElementById("geofenceForm")?.reset();
    document.getElementById("shapeData").value = "";
    updatePointCount(0);
    await loadSavedGeofences();
  } else {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    console.error("Save geofence error:", err);
    displayFlashMessage("Error saving geofence: " + (err.error || "Unknown"), "danger");
  }
}

function deleteSelectedShape() {
  const features = draw.getSnapshot();
  if (!features || features.length === 0) return;

  const id = selectedFeatureId || features[features.length - 1].id;
  if (id) {
    draw.removeFeatures([id]);
    selectedFeatureId = null;
    updateShapeData();
  }
}

/* ---------- Load/render existing (unchanged) ---------- */
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
  geofences.forEach(gf => { if (gf.mapOverlay) gf.mapOverlay.setMap(null); });

  const bounds = new google.maps.LatLngBounds();
  let hasGeofence = false;

  geofences.forEach((gf) => {
    const coords = gf.coordinates;
    let overlay = null;

    const fillColor = gf.is_active ? "#FF0000" : "#888888";
    const fillOpacity = gf.is_active ? 0.2 : 0.1;
    const strokeColor = gf.is_active ? "#FF0000" : "#666666";

    if (gf.shape_type === "circle") {
      const center = new google.maps.LatLng(coords.center.lat, coords.center.lng);
      overlay = new google.maps.Circle({
        center,
        radius: coords.radius,
        fillColor,
        fillOpacity,
        strokeColor,
        strokeWeight: 2,
        map: geofenceMap,
      });
      const cb = overlay.getBounds();
      if (cb) bounds.union(cb);
      hasGeofence = true;
    } else {
      const path = coords.points.map((p) => new google.maps.LatLng(p.lat, p.lng));
      overlay = new google.maps.Polygon({
        paths: path,
        fillColor,
        fillOpacity,
        strokeColor,
        strokeWeight: 2,
        map: geofenceMap,
      });
      path.forEach(ll => bounds.extend(ll));
      hasGeofence = true;
    }

    if (overlay) {
      gf.mapOverlay = overlay;
      overlay.addListener("click", () => zoomToGeofence(gf));
    }
  });

  if (hasGeofence && !bounds.isEmpty()) geofenceMap.fitBounds(bounds);
}

function renderGeofenceList() {
  const list = document.getElementById("geofenceList");
  if (!list) return;
  list.innerHTML = "";

  geofences.forEach((gf) => {
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
      <div>Location: ${gf.location || "N/A"}</div>
      <div>Type: ${gf.shape_type}</div>
      <div>Created by: ${gf.created_by}</div>
      <div>Created on:<br>${new Date(gf.created_at).toLocaleString()}</div>
      <div class="geofence-status-container">
        <span class="geofence-status-label">Status:</span>
        <label class="geofence-status-switch">
          <input type="checkbox" ${gf.is_active ? "checked" : ""} onchange="toggleGeofenceStatus('${gf._id}', this.checked)">
          <span class="geofence-status-slider"></span>
        </label>
        <span class="geofence-status-text">${gf.is_active ? "Active" : "Inactive"}</span>
      </div>
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

function zoomToGeofence(geofence) {
  const coords = geofence.coordinates;
  if (geofence.shape_type === "circle") {
    geofenceMap.setCenter(new google.maps.LatLng(coords.center.lat, coords.center.lng));
    geofenceMap.setZoom(15);
  } else {
    const b = new google.maps.LatLngBounds();
    coords.points.forEach(pt => b.extend(new google.maps.LatLng(pt.lat, pt.lng)));
    geofenceMap.fitBounds(b);
  }
}

async function deleteGeofence(id) {
  const res = await fetch(`/geofence/api/geofences/${id}`, { method: "DELETE" });
  if (res.ok) {
    displayFlashMessage("Geofence deleted", "success");
    await loadSavedGeofences();
  } else {
    const err = await res.json().catch(() => ({ error: "Unknown" }));
    displayFlashMessage("Delete failed: " + (err.error || "Unknown"), "danger");
  }
}

async function toggleGeofenceStatus(id, newStatus) {
  const res = await fetch(`/geofence/api/geofences/${id}/active`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: newStatus }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown" }));
    displayFlashMessage("Update status failed: " + (err.error || "Unknown"), "danger");
  } else {
    await loadSavedGeofences();
  }
}

/* ---------- Init ---------- */
window.onload = async function () {
  try { await backgroundMap(); } catch (e) {}
  await geofenceMapFunction();
};