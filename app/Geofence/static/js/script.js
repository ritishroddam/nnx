let map;
let drawingManager;
let drawnShape = null;
let geofences = [];
let editIndex = null;

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5,
    });

    drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        circleOptions: { fillColor: "#FF0000", fillOpacity: 0.35, strokeWeight: 2 },
        polygonOptions: { fillColor: "#FF0000", fillOpacity: 0.35, strokeWeight: 2 },
    });

    drawingManager.setMap(map);

    // Circle button
    document.getElementById("circleBtn").addEventListener("click", () => {
        drawingManager.setDrawingMode(google.maps.drawing.OverlayType.CIRCLE);
    });

    // Polygon button
    document.getElementById("polygonBtn").addEventListener("click", () => {
        drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    });

    // Listen for completed drawings
    google.maps.event.addListener(drawingManager, "overlaycomplete", (event) => {
        if (drawnShape) drawnShape.setMap(null); // remove old shape
        drawnShape = event.overlay;
        drawingManager.setDrawingMode(null);
        updateShapeData();
    });

    // Save form
    document.getElementById("geofenceForm").addEventListener("submit", (e) => {
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
    });
}

// Convert shape into JSON
function updateShapeData() {
    let shapeData = {};
    if (drawnShape.type === google.maps.drawing.OverlayType.CIRCLE || drawnShape instanceof google.maps.Circle) {
        shapeData = {
            type: "circle",
            center: drawnShape.getCenter().toJSON(),
            radius: drawnShape.getRadius(),
        };
    } else if (drawnShape.type === google.maps.drawing.OverlayType.POLYGON || drawnShape instanceof google.maps.Polygon) {
        const path = drawnShape.getPath().getArray().map((latLng) => latLng.toJSON());
        shapeData = { type: "polygon", points: path };
    }
    document.getElementById("shapeData").value = JSON.stringify(shapeData);
}

// Clear current drawn shape
function clearShape() {
    if (drawnShape) {
        drawnShape.setMap(null);
        drawnShape = null;
    }
    document.getElementById("shapeData").value = "";
}

// Render saved geofences list
function renderGeofenceList() {
    const list = document.getElementById("geofenceList");
    list.innerHTML = "";

    geofences.forEach((gf, i) => {
        const li = document.createElement("li");
        const nameSpan = document.createElement("span");
        nameSpan.className = "geofence-item-name";
        nameSpan.textContent = gf.name;

        const actions = document.createElement("div");
        actions.className = "geofence-actions";

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.onclick = () => loadGeofence(i);

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
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

    if (gf.data.type === "circle") {
        drawnShape = new google.maps.Circle({
            center: gf.data.center,
            radius: gf.data.radius,
            fillColor: "#FF0000",
            fillOpacity: 0.35,
            strokeWeight: 2,
            map,
        });
    } else if (gf.data.type === "polygon") {
        drawnShape = new google.maps.Polygon({
            paths: gf.data.points,
            fillColor: "#FF0000",
            fillOpacity: 0.35,
            strokeWeight: 2,
            map,
        });
    }

    updateShapeData();
    editIndex = i;
}

document.addEventListener("DOMContentLoaded", initMap);
