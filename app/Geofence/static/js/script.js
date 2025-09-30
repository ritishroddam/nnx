let map;
let drawnCircle = null;
let drawnPolygon = null;
let drawMode = "circle";
let polygonDrawer = null;
let geofences = []; // store saved geofences in memory
let editIndex = null;

// Initialize Map
function initMap() {
    map = L.map('map').setView([20.5937, 78.9629], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    setupControls();
}

// Setup Controls
function setupControls() {
    const circleBtn = document.getElementById("circleBtn");
    const polygonBtn = document.getElementById("polygonBtn");
    const slider = document.getElementById("radiusSlider");

    circleBtn.addEventListener("click", () => {
        drawMode = "circle";
        circleBtn.classList.add("active");
        polygonBtn.classList.remove("active");
        clearShapes();
        enableCircleDraw();
    });

    polygonBtn.addEventListener("click", () => {
        drawMode = "polygon";
        polygonBtn.classList.add("active");
        circleBtn.classList.remove("active");
        clearShapes();
        enablePolygonDraw();
    });

    slider.addEventListener("input", () => {
        if (drawMode === "circle" && drawnCircle) {
            drawnCircle.setRadius(parseInt(slider.value));
            updateShapeData();
        }
    });

    document.getElementById("geofenceForm").addEventListener("submit", (e) => {
        e.preventDefault();
        if (!document.getElementById("shapeData").value) {
            alert("Please draw a geofence on the map first.");
            return;
        }

        const name = document.getElementById("GeofenceName").value;
        const location = document.getElementById("Location").value;
        const data = JSON.parse(document.getElementById("shapeData").value);

        const geofenceObj = { name, location, data };

        if (editIndex !== null) {
            geofences[editIndex] = geofenceObj;
            editIndex = null;
        } else {
            geofences.push(geofenceObj);
        }

        renderGeofenceList();
        clearShapes();
        document.getElementById("geofenceForm").reset();
        document.getElementById("shapeData").value = "";
    });
}

// Enable Circle Drawing
function enableCircleDraw() {
    map.once("click", (e) => {
        const radius = parseInt(document.getElementById("radiusSlider").value);
        drawnCircle = L.circle(e.latlng, { radius, color: "red" }).addTo(map);
        updateShapeData();
    });
}

// Enable Polygon Drawing
function enablePolygonDraw() {
    if (polygonDrawer) map.removeControl(polygonDrawer);

    polygonDrawer = new L.Draw.Polygon(map);
    polygonDrawer.enable();

    map.on(L.Draw.Event.CREATED, function (event) {
        clearShapes();
        drawnPolygon = event.layer;
        map.addLayer(drawnPolygon);
        updateShapeData();
    });
}

// Clear Shapes
function clearShapes() {
    if (drawnCircle) {
        map.removeLayer(drawnCircle);
        drawnCircle = null;
    }
    if (drawnPolygon) {
        map.removeLayer(drawnPolygon);
        drawnPolygon = null;
    }
    if (polygonDrawer) polygonDrawer.disable();
    document.getElementById("shapeData").value = "";
}

// Update Shape Data
function updateShapeData() {
    let shapeData = {};
    if (drawnCircle) {
        shapeData = {
            type: "circle",
            center: drawnCircle.getLatLng(),
            radius: drawnCircle.getRadius()
        };
    } else if (drawnPolygon) {
        shapeData = {
            type: "polygon",
            points: drawnPolygon.getLatLngs()[0]
        };
    }
    document.getElementById("shapeData").value = JSON.stringify(shapeData);
}

// Render Geofence List
function renderGeofenceList() {
    const list = document.getElementById("geofenceList");
    list.innerHTML = "";

    geofences.forEach((gf, index) => {
        const li = document.createElement("li");

        const nameSpan = document.createElement("span");
        nameSpan.className = "geofence-item-name";
        nameSpan.textContent = gf.name;

        const actions = document.createElement("div");
        actions.className = "geofence-actions";

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.onclick = () => loadGeofence(index);

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.onclick = () => {
            geofences.splice(index, 1);
            renderGeofenceList();
        };

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        li.appendChild(nameSpan);
        li.appendChild(actions);
        list.appendChild(li);
    });
}

// Load geofence into form & map
function loadGeofence(index) {
    const gf = geofences[index];
    clearShapes();

    document.getElementById("GeofenceName").value = gf.name;
    document.getElementById("Location").value = gf.location;

    if (gf.data.type === "circle") {
        drawnCircle = L.circle(gf.data.center, {
            radius: gf.data.radius,
            color: "red"
        }).addTo(map);
        document.getElementById("radiusSlider").value = gf.data.radius;
    } else if (gf.data.type === "polygon") {
        drawnPolygon = L.polygon(gf.data.points, { color: "red" }).addTo(map);
    }

    updateShapeData();
    editIndex = index;
}

document.addEventListener("DOMContentLoaded", initMap);
