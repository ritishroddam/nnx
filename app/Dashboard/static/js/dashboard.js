/* -------------------------
   Top-level state & config
   -------------------------*/
const apiKey = "365ddab9f6e0165c415605dd9f1178f8";
let currentSort = { column: "distance", direction: "desc" };
let currentStatusFilter = null;
let statusPopupTableData = [];
let currentRange = "1day";

let isDarkMode = false;          // mutable, updated on init & toggle
let centerColor = "#2f2f2f";     // used by pie center plugin
let devicesChart = null;
let pieChart = null;
let map = null;
let trafficLayer = null;
let marker = null;

const API = {
  dashboardData: "/dashboard/dashboard_data",
  statusData: "/dashboard/get_status_data",
  vehicleRangeData: "/dashboard/get_vehicle_range_data",
  pieData: "/dashboard/atlanta_pie_data",
  distanceData: "/dashboard/atlanta_distance_data"
};

/* -------------------------
   Utility functions
   -------------------------*/
function safeEl(id) {
  return document.getElementById(id);
}

function formatStatusTime(seconds) {
  if (!Number.isFinite(seconds)) return "0s";
  if (seconds >= 86400) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  } else if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  } else if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  } else {
    return `${Math.floor(seconds)}s`;
  }
}

function formatLastUpdatedText(date, time) {
  if (!date || !time) return "N/A";
  try {
    let formattedDate = date;
    if (date.length === 6) {
      formattedDate = `20${date.slice(4)}-${date.slice(2, 4)}-${date.slice(0, 2)}`;
    }
    const formattedTime = time.length === 6
      ? `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`
      : time;
    const dateObj = new Date(`${formattedDate}T${formattedTime}`);
    return isNaN(dateObj.getTime()) ? "N/A" : dateObj.toLocaleString();
  } catch (e) {
    console.error("Error formatting date/time:", e);
    return "N/A";
  }
}

/* -------------------------
   Fetch & data helpers
   -------------------------*/
async function fetchJSON(url, opts = {}, config = { showUserError: false, userMessage: null }) {
  try {
    const res = await fetch(url, opts);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = body.error || `Request failed (${res.status})`;
      console.error(`fetchJSON error for ${url}:`, errMsg);
      if (config.showUserError) {
        displayFlashMessage(config.userMessage || `Failed to load data. (${res.status})`, "danger");
      }
      throw new Error(errMsg);
    }
    return body;
  } catch (err) {
    // network / JSON parse errors
    console.error(`fetchJSON network/error for ${url}:`, err);
    if (config.showUserError) {
      displayFlashMessage(
        config.userMessage || "Network error. Please check your connection and try again.",
        "danger"
      );
    }
    throw err;
  }
}

async function fetchFilteredVehicleData(status) {
  try {
    const data = await fetchJSON(`${API.vehicleRangeData}?range=${currentRange}`);
    if (!Array.isArray(data)) return [];

    const filteredData = data.filter((vehicle) => {
      switch (status) {
        case 'running':
          return parseFloat(vehicle.max_speed) > 0;
        case 'idle':
          return parseFloat(vehicle.max_speed) === 0 &&
                 parseFloat(vehicle.avg_speed) === 0 &&
                 vehicle.driving_time === "0 seconds";
        case 'parked':
          return vehicle.driving_time === "0 seconds" &&
                 vehicle.idle_time !== "0 seconds";
        case 'speed':
          return parseFloat(vehicle.max_speed) >= 40 &&
                 parseFloat(vehicle.max_speed) < 60;
        case 'overspeed':
          return parseFloat(vehicle.max_speed) >= 60;
        case 'offline':
          return false;
        default:
          return true;
      }
    });

    return filteredData;
  } catch (error) {
    console.error("Error fetching filtered vehicle data:", error);
    return [];
  }
}

/* -------------------------
   UI / Table rendering
   -------------------------*/
function applySortIcons(column, direction, selector = '.vehicleLiveTable table') {
  document.querySelectorAll(`${selector} th`).forEach((th) => {
    const icon = th.querySelector(".sort-icon");
    if (!icon) return;
    if (th.dataset.column === column) {
      icon.textContent = direction === "asc" ? "↑" : "↓";
      th.classList.add("sorted");
    } else {
      icon.textContent = "";
      th.classList.remove("sorted");
    }
  });
}

function sortTable(column, direction, selector = '.vehicleLiveTable table') {
  const table = document.querySelector(selector);
  if (!table) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const columnIndex = Array.from(table.querySelectorAll("th")).findIndex(
    (th) => th.dataset.column === column
  );

  rows.sort((a, b) => {
    let cellA = a.children[columnIndex]?.innerText.trim() ?? "";
    let cellB = b.children[columnIndex]?.innerText.trim() ?? "";

    if (column === "max_avg_speed") {
      cellA = parseFloat(cellA.split("/")[0]) || 0;
      cellB = parseFloat(cellB.split("/")[0]) || 0;
    } else if (!isNaN(parseFloat(cellA)) && !isNaN(parseFloat(cellB))) {
      cellA = parseFloat(cellA);
      cellB = parseFloat(cellB);
    } else {
      cellA = cellA.toLowerCase();
      cellB = cellB.toLowerCase();
    }

    if (cellA < cellB) return direction === "asc" ? -1 : 1;
    if (cellA > cellB) return direction === "asc" ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = "";
  rows.forEach((row) => tbody.appendChild(row));
  applySortIcons(column, direction, selector);
}

function setupTableSorting(selector = '.vehicleLiveTable table') {
  const table = document.querySelector(selector);
  if (!table) return;
  table.querySelectorAll("th").forEach((header) => {
    header.addEventListener("click", () => {
      const column = header.dataset.column;
      if (!column) return;
      const direction =
        currentSort.column === column && currentSort.direction === "asc"
          ? "desc"
          : "asc";
      sortTable(column, direction, selector);
      currentSort = { column, direction };
    });
  });
}

function afterTableRender() {
  setupTableSorting();
  sortTable("distance", "desc");
  currentSort = { column: "distance", direction: "desc" };
}

/* Renders the status popup table */
function renderStatusPopupTable(data) {
  const tableBody = safeEl('statusPopupTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (!Array.isArray(data)) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 20px; color: red;">
          Invalid data format received
        </td>
      </tr>`;
    return;
  }

  if (data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 20px;">
          No vehicles found for this status.
        </td>
      </tr>`;
    return;
  }

  data.forEach((vehicle) => {
    const row = document.createElement('tr');

    const speed = vehicle.speed ? parseFloat(vehicle.speed).toFixed(2) : 0;
    const speedCellClass = speed >= 60 ? 'speed-warning' : '';
    const lastUpdated = vehicle.last_updated || formatLastUpdatedText(vehicle.date, vehicle.time);

    const iconStyle = "font-size:22px;vertical-align:middle;margin-right:2px;";
    const iconRed = "color:#d32f2f;";

    const gpsIcon = vehicle.status === "offline" ? "location_disabled" : "my_location";

    let ignitionIcon, ignitionColor;
    if (vehicle.ignition === "0") {
      ignitionIcon = "key_off";
      ignitionColor = "#d32f2f";
    } else {
      ignitionIcon = "key";
      ignitionColor = "#4caf50";
    }

    const sosIcon = vehicle.sos === "1"
      ? `<span class="material-symbols-outlined" style="${iconStyle + iconRed}">sos</span>`
      : "";

    const ASUgsmValue = parseInt(vehicle.gsm || 0, 10);
    let gsmIcon, gsmColor;
    if (ASUgsmValue === 0) {
      gsmIcon = "signal_cellular_null";
      gsmColor = "#d32f2f";
    } else if (ASUgsmValue <= 8) {
      gsmIcon = "signal_cellular_1_bar";
      gsmColor = "#ff9800";
    } else if (ASUgsmValue <= 16) {
      gsmIcon = "signal_cellular_2_bar";
      gsmColor = "#ffc107";
    } else if (ASUgsmValue <= 24) {
      gsmIcon = "signal_cellular_3_bar";
      gsmColor = "#cddc39";
    } else if (ASUgsmValue <= 32) {
      gsmIcon = "signal_cellular_4_bar";
      gsmColor = "#4caf50";
    } else {
      gsmIcon = "signal_cellular_off";
      gsmColor = "#d32f2f";
    }

    row.innerHTML = `
      <td>${vehicle.registration || vehicle.imei || 'N/A'}</td>
      <td>${vehicle.VehicleType || 'N/A'}</td>
      <td>${lastUpdated}</td>
      <td>${vehicle.location || 'Location unknown'}</td>
      <td class="${speedCellClass}">${speed} km/h</td>
      <td>${vehicle.distance ? parseFloat(vehicle.distance).toFixed(2) : '0.00'} km</td>
      <td>${vehicle.odometer || 'N/A'}</td>
      <td class="status-icons" 
          data-sos="${vehicle.sos === '1'}" 
          data-gps="${vehicle.gps === '1' || vehicle.gps === true}" 
          data-ignition="${vehicle.ignition === '1'}" 
          data-gsm="${vehicle.gsm || '0'}">
        ${sosIcon}
        <span class="material-symbols-outlined" style="${iconStyle}">${gpsIcon}</span>
        <span class="material-symbols-outlined" style="${iconStyle};color:${ignitionColor}">${ignitionIcon}</span>
        <span class="material-symbols-outlined" style="${iconStyle};color:${gsmColor};">${gsmIcon}</span>
      </td>`;

    tableBody.appendChild(row);
  });

  setupTableSorting('#statusPopupTable');
}

/* -------------------------
   Status popup behavior
   -------------------------*/
async function showStatusPopup(status, title) {
  currentStatusFilter = status;
  const titleEl = safeEl('statusPopupTitle');
  const tableBody = safeEl('statusPopupTableBody');
  const overlay = safeEl('statusPopupOverlay');
  const popup = safeEl('statusPopup');

  if (titleEl) titleEl.textContent = title;
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 20px;">
          Loading data...
        </td>
      </tr>`;
  }
  if (overlay) overlay.classList.add('active');
  if (popup) popup.classList.add('active');

  try {
    const data = await fetchJSON(`/dashboard/get_vehicle_range_data?status=${status}`, {}, { showUserError: true, userMessage: "Failed to load vehicles list." });
    const filteredData = Array.isArray(data) ? data : [];
    statusPopupTableData = filteredData;

    if (window.statusCounts) {
      const expectedCount = window.statusCounts[`${status}Vehicles`];
      if (typeof expectedCount !== 'undefined' && filteredData.length !== expectedCount) {
        console.warn(`Count mismatch: ${status} shows ${expectedCount} in cards but ${filteredData.length} in table`);
      }
    }

    renderStatusPopupTable(filteredData);
  } catch (error) {
    console.error("Error fetching vehicle data:", error);
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 20px; color: red;">
            ${error.message || 'Error loading data'}
          </td>
        </tr>`;
    }
  }
}

/* -------------------------
   Charts: pie & devices (line)
   -------------------------*/

/* Helper used by pie chart to create linear gradients */
function makeGradient(ctx, y0color, y1color) {
  const g = ctx.createLinearGradient(0, 0, 0, 400);
  g.addColorStop(0, y0color);
  g.addColorStop(1, y1color);
  return g;
}

async function renderPieChart() {
  try {
    const vehiclesEl = safeEl('vehiclesChart');
    const skeletonEl = safeEl('pieChartSkeleton');

    if (vehiclesEl) vehiclesEl.classList.remove('loaded');
    if (skeletonEl) skeletonEl.classList.remove('loaded');

    const data = await fetchJSON(API.pieData, {}, { showUserError: true, userMessage: "Failed to load vehicle summary chart." });

    if (data.total_devices === undefined) {
      displayFlashMessage("Received invalid data for vehicle summary.", "danger");
      throw new Error("Invalid data format received");
    }

    const disconnected = typeof data.disconnected_vehicles !== "undefined" ? data.disconnected_vehicles : 0;
    if (pieChart) {
      pieChart.destroy();
      pieChart = null;
    }

    const ctx = (vehiclesEl && vehiclesEl.getContext) ? vehiclesEl.getContext("2d") : null;
    if (!ctx) throw new Error("Canvas context not available");

    let gradient1, gradient2, gradient3, gradient4;
    let hover1, hover2, hover3, hover4;

    if (isDarkMode) {
      gradient4 = makeGradient(ctx, "#4A5D7A", "#3C77A8");
      gradient3 = makeGradient(ctx, "#3C77A8", "#2C87D1");
      gradient2 = makeGradient(ctx, "#2C87D1", "#1F6DC2");
      gradient1 = makeGradient(ctx, "#1F6DC2", "#153A74");

      hover4 = "#3C77A8"; hover3 = "#4A90E2"; hover2 = "#1F6DC2"; hover1 = "#153A74";
    } else {
      gradient4 = makeGradient(ctx, "#E3F2FF", "#C7E4FF");
      gradient3 = makeGradient(ctx, "#C7E4FF", "#99C9FF");
      gradient2 = makeGradient(ctx, "#99C9FF", "#4A90E2");
      gradient1 = makeGradient(ctx, "#4A90E2", "#1B5BBE");

      hover4 = "#C7E4FF"; hover3 = "#99C9FF"; hover2 = "#4A90E2"; hover1 = "#1B5BBE";
    }

    const chartConfig = {
      type: "doughnut",
      data: {
        labels: ["Moving Vehicles", "Idle Vehicles", "Parked Vehicles", "Offline Vehicles"],
        datasets: [{
          data: [data.moving_vehicles, data.idle_vehicles, data.parked_vehicles, data.offline_vehicles],
          backgroundColor: [gradient1, gradient2, gradient3, gradient4],
          hoverBackgroundColor: [hover1, hover2, hover3, hover4],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: isDarkMode ? "#ccc" : "black",
              font: { size: 14, weight: "bold" },
              generateLabels: (chart) => {
                const original = Chart.overrides.doughnut.plugins.legend.labels.generateLabels;
                const labels = original.call(this, chart);
                labels.forEach((label) => label.className = "chart-label");
                return labels;
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function (tooltipItem) {
                const value = tooltipItem.raw;
                const percentage = ((value / data.total_devices) * 100).toFixed(2);
                return `${tooltipItem.label}: ${value} (${percentage}%)`;
              }
            }
          },
          centerText: {
            display: true,
            text: "Total Vehicles: " + data.total_devices
          }
        },
        animation: { animateRotate: true, animateScale: true, duration: 800, easing: "easeOutCubic" },
        cutout: "70%",
        layout: { padding: 30 },
        hover: {
          onHover: function (event, chartElement) {
            const canvas = safeEl("vehiclesChart");
            if (!canvas) return;
            canvas.style.cursor = chartElement.length ? "pointer" : "default";
          }
        },
        rotation: -90,
        circumference: 180
      },
      plugins: [
        {
          id: "centerText",
          beforeDraw(chart) {
            const { width } = chart;
            const { top, bottom } = chart.chartArea;
            const ctx = chart.ctx;
            const centerY = bottom - (bottom - top) / 3;
            const text = chart.config.options.plugins.centerText.text;
            ctx.save();
            ctx.font = "bold 18px Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = centerColor;
            ctx.fillText(text, width / 2, centerY);
            ctx.restore();
          }
        }
      ]
    };

    pieChart = new Chart(ctx, chartConfig);

    if (vehiclesEl) vehiclesEl.classList.add('loaded');
    if (skeletonEl) skeletonEl.classList.add('loaded');
  } catch (error) {
    console.error("❌ Error rendering pie chart:", error);

    if (!error.message || error.message.indexOf("Request failed") === -1) {
      displayFlashMessage("Could not render vehicle summary chart.", "danger");
    }

    const vehiclesEl = safeEl('vehiclesChart');
    const skeletonEl = safeEl('pieChartSkeleton');
    if (vehiclesEl) vehiclesEl.classList.add('loaded');
    if (skeletonEl) skeletonEl.classList.add('loaded');
  }
}

/* Initialize the devices (line) chart */
function initDevicesChart() {
  const devicesCanvas = safeEl("devicesChart");
  if (!devicesCanvas) return null;
  const ctx = devicesCanvas.getContext("2d");

  // If already created, return it
  if (devicesChart) return devicesChart;

  devicesChart = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [{ label: "Distance Travelled (km)", data: [], backgroundColor: isDarkMode ? "rgba(204,204,204,0.2)" : "rgba(47,47,47,0.2)", borderColor: isDarkMode ? "#ccc" : "#2f2f2f", pointBackgroundColor: isDarkMode ? "#ccc" : "#2f2f2f", pointBorderColor: isDarkMode ? "black" : "#fff", pointRadius:0, pointHoverRadius:7, borderWidth:2, fill:true, tension:0.3 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: isDarkMode ? "#ccc" : "#2f2f2f", pointStyle: "rectRounded" } } },
      scales: { x: { grid: { display: false, drawBorder: false } }, y: { grid: { display: false, drawBorder: false } } },
      elements: { point: { radius: 0, hoverRadius: 7 } },
      interaction: { mode: 'nearest', intersect: false },
      plugins: { tooltip: { enabled: true } }
    }
  });

  return devicesChart;
}

async function fetchDistanceTravelledData() {
  try {
    const data = await fetchJSON(API.distanceData, {}, { showUserError: true, userMessage: "Failed to load distance travelled data." });
    if (!devicesChart) initDevicesChart();
    devicesChart.data.labels = data.labels || [];
    devicesChart.data.datasets[0].data = data.distances || [];
    devicesChart.update();
  } catch (error) {
    console.error("Error fetching distance data:", error);
  }
}

/* -------------------------
   Helper to rebuild devicesChart cleanly
   -------------------------*/
function rebuildDevicesChart() {
  try {
    const preserved = devicesChart
      ? {
          labels: Array.isArray(devicesChart.data.labels) ? devicesChart.data.labels.slice() : [],
          dataset0: devicesChart.data.datasets && devicesChart.data.datasets[0]
            ? { data: (devicesChart.data.datasets[0].data || []).slice() }
            : { data: [] }
        }
      : null;

    if (devicesChart) {
      try { devicesChart.destroy(); } catch (e) { console.warn("destroy devicesChart failed:", e); }
      devicesChart = null;
    }

    initDevicesChart();

    if (preserved && devicesChart) {
      devicesChart.data.labels = preserved.labels || [];
      if (devicesChart.data.datasets && devicesChart.data.datasets[0]) {
        devicesChart.data.datasets[0].data = preserved.dataset0.data || [];
      }
      devicesChart.update();
    }
  } catch (err) {
    console.error("rebuildDevicesChart error:", err);
  }
}

/* -------------------------
   Theme handling
   -------------------------*/
async function updateTheme() {
  try {
    // read latest DOM class
    isDarkMode = document.body.classList.contains("dark-mode");
    centerColor = isDarkMode ? "#ccc" : "#2f2f2f";
    Chart.defaults.color = isDarkMode ? "#ccc" : "#2f2f2f";

    // Rebuild devicesChart (safe) rather than mutating Chart internals
    rebuildDevicesChart();

    // re-render pie (pie uses isDarkMode when built)
    try {
      if (pieChart) {
        try { pieChart.destroy(); } catch (e) { /* ignore */ }
        pieChart = null;
      }
      await renderPieChart();
    } catch (pieErr) {
      console.error("updateTheme: failed to re-render pie:", pieErr);
    }

    // re-init map after a short delay (map init can be heavy)
    setTimeout(() => {
      initMap().catch((e) => {
        console.error("Error re-initializing map after theme change:", e);
        displayFlashMessage("Map failed to reload after theme change.", "warning");
      });
    }, 150);
  } catch (e) {
    console.error("updateTheme error:", e);
    displayFlashMessage("Failed to apply theme changes to charts.", "warning");
  }
}

/* -------------------------
    Theme observer (watchBodyTheme)
   -------------------------*/
function watchBodyTheme({ debounceMs = 80 } = {}) {
  const body = document.body;
  if (!body) return { disconnect: () => {} };

  let timer = null;
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === "class") {
        clearTimeout(timer);
        timer = setTimeout(() => {
          updateTheme().catch((e) => console.error("theme observer updateTheme failed:", e));
        }, debounceMs);
        break;
      }
    }
  });

  mo.observe(body, { attributes: true, attributeFilter: ["class"] });

  return {
    disconnect() {
      clearTimeout(timer);
      try { mo.disconnect(); } catch (e) { /* ignore */ }
    }
  };
}

/* -------------------------
   Map helpers (initMap/fallbackToDefaultLocation)
   -------------------------*/
async function initMap() {
  try {
    const { Map, TrafficLayer } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    const mapOptions = { zoom: 13, disableDefaultUI: true };

    const handleCreateMap = (location) => {
      const dark = document.body.classList.contains("dark-mode");
      const mapId = dark ? "e426c1ad17485d79" : "dc4a8996aab2cac9";
      map = new Map(safeEl("map"), { ...mapOptions, center: location, zoomControl: true, mapId });
      trafficLayer = new TrafficLayer();
      trafficLayer.setMap(map);
      marker = new AdvancedMarkerElement({ position: location, map, title: "Your Location" });

      getWeather(location.lat, location.lng);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => handleCreateMap({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => fallbackToDefaultLocation()
      );
    } else {
      fallbackToDefaultLocation();
    }
  } catch (err) {
    console.error("Error initializing map:", err);
    displayFlashMessage("Map failed to load. Traffic and location features may be unavailable.", "warning");
  }
}

async function fallbackToDefaultLocation() {
  try {
    const { Map, TrafficLayer } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    const defaultLocation = { lat: 12.9716, lng: 77.5946 };
    const dark = document.body.classList.contains("dark-mode");
    const mapId = dark ? "e426c1ad17485d79" : "dc4a8996aab2cac9";

    map = new Map(safeEl("map"), { center: defaultLocation, zoom: 13, disableDefaultUI: true, mapId });
    trafficLayer = new TrafficLayer();
    trafficLayer.setMap(map);

    marker = new AdvancedMarkerElement({ position: defaultLocation, map, title: "Your Location" });

    getWeather(defaultLocation.lat, defaultLocation.lng);
  } catch (error) {
    console.error("Error initializing fallback location:", error);
  }
}

function displayWeather(data) {
  const weatherDiv = document.getElementById("weather");
  const iconCode = data.weather[0].icon;
  const weatherHTML = `
                      <img class="weather-icon" src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="Weather icon"/>
                      <div class="weather-info">
                        <div class="city"><strong>${data.name}</strong></div>
                        <div class="desc">${data.weather[0].description}</div>
                        <div class="temp">Temperature: ${data.main.temp} °C</div>
                        <div class="humidity">Humidity: ${data.main.humidity}%</div>
                        <div class="wind">Wind Speed: ${data.wind.speed} m/s</div>
                      </div>
              `;
  weatherDiv.innerHTML = weatherHTML;
}

function getWeather(lat, lon) {
  let url;
  if (!lat || !lon) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=12.9716&lon=77.5946&appid=${apiKey}&units=metric`;
  } else {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  }
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      displayWeather(data);
    })
    .catch((error) => {
      console.error("Error fetching weather data:", error);
      document.getElementById("weather").innerHTML =
        "<p>Failed to fetch weather data.</p>";
    });
}

/* -------------------------
   Other small features
   -------------------------*/
async function fetchDashboardData() {
  try {
    if (typeof userRole !== "undefined" && userRole !== "admin") return;
    const data = await fetchJSON(API.dashboardData, {}, { showUserError: true, userMessage: "Unable to load dashboard summary." });
    const cards = document.querySelectorAll(".card");
    if (cards && cards.length >= 3) {
      cards[0].querySelector("h3").textContent = data.devices || 0;
      cards[1].querySelector("h3").textContent = data.sims || 0;
      cards[2].querySelector("h3").textContent = data.customers || 0;
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    displayFlashMessage("Map fallback failed. Map is unavailable.", "warning");
  }
}

async function fetchStatusData() {
  try {
    const data = await fetchJSON(API.statusData, {}, { showUserError: true, userMessage: "Unable to load status counts." });
    const setText = (id, text) => { const el = safeEl(id); if (el) el.textContent = text; };

    setText("running-vehicles-count", `${data.runningVehicles} / ${data.totalVehicles}`);
    setText("idle-vehicles-count", `${data.idleVehicles} / ${data.totalVehicles}`);
    setText("parked-vehicles-count", `${data.parkedVehicles} / ${data.totalVehicles}`);
    setText("speed-vehicles-count", `${data.speedVehicles} / ${data.totalVehicles}`);
    setText("overspeed-vehicles-count", `${data.overspeedVehicles} / ${data.totalVehicles}`);
    setText("offline-vehicles-count", `${data.offlineVehicles} / ${data.totalVehicles}`);
    setText("disconnected-vehicles-count", `${data.disconnectedVehicles} / ${data.totalVehicles}`);

    window.statusCounts = data;
  } catch (error) {
    console.error("Error fetching status data:", error);
  }
}

/* -------------------------
   Event wiring
   -------------------------*/
async function attachEventListeners() {
  const runningBtn = safeEl("running-vehicles");
  if (runningBtn) runningBtn.addEventListener("click", () => showStatusPopup('running', 'Running Vehicles'));

  const idleBtn = safeEl("idle-vehicles");
  if (idleBtn) idleBtn.addEventListener("click", () => showStatusPopup('idle', 'Idle Vehicles'));

  const parkedBtn = safeEl("parked-vehicles");
  if (parkedBtn) parkedBtn.addEventListener("click", () => showStatusPopup('parked', 'Parked Vehicles'));

  const speedBtn = safeEl("speed-vehicles");
  if (speedBtn) speedBtn.addEventListener("click", () => showStatusPopup('speed', 'Speed Vehicles (40-60 km/h)'));

  const overspeedBtn = safeEl("overspeed-vehicles");
  if (overspeedBtn) overspeedBtn.addEventListener("click", () => showStatusPopup('overspeed', 'Over Speed Vehicles (60+ km/h)'));

  const offlineBtn = safeEl("offline-vehicles");
  if (offlineBtn) offlineBtn.addEventListener("click", () => showStatusPopup('offline', 'Offline Vehicles'));

  const disconnectedBtn = safeEl("disconnected-vehicles");
  if (disconnectedBtn) disconnectedBtn.addEventListener("click", () => showStatusPopup('disconnected', 'Disconnected Vehicles'));

  const statusPopupClose = safeEl("statusPopupClose");
  if (statusPopupClose) {
    statusPopupClose.addEventListener("click", () => {
      const overlay = safeEl('statusPopupOverlay');
      const popup = safeEl('statusPopup');
      if (overlay) overlay.classList.remove('active');
      if (popup) popup.classList.remove('active');
      fetchStatusData();
    });
  }

  const statusExcelBtn = safeEl("statusPopupExcelBtn");
  if (statusExcelBtn) {
    statusExcelBtn.addEventListener("click", () => {
      const table = document.querySelector("#statusPopup table");
      if (!table) return;
      const tableClone = table.cloneNode(true);
      // transform status icons into readable text for excel
      const rows = tableClone.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.cells;
        const statusCell = cells[cells.length - 1];
        if (statusCell && statusCell.classList.contains('status-icons')) {
          const sos = statusCell.getAttribute('data-sos') === 'true' ? 'SOS: Active' : '';
          const gps = statusCell.getAttribute('data-gps') === 'true' ? 'GPS: Good' : 'GPS: Bad';
          const ignition = statusCell.getAttribute('data-ignition') === 'true' ? 'Ignition: On' : 'Ignition: Off';
          const gsmValue = parseInt(statusCell.getAttribute('data-gsm'));
          let gsmStatus = 'Signal: ';
          if (gsmValue == 0) gsmStatus += 'None';
          else if (gsmValue <= 8) gsmStatus += 'Weak';
          else if (gsmValue <= 16) gsmStatus += 'Fair';
          else if (gsmValue <= 24) gsmStatus += 'Good';
          else if (gsmValue <= 32) gsmStatus += 'Excellent';
          else gsmStatus += 'Unknown';
          statusCell.textContent = [sos, gps, ignition, gsmStatus].filter(Boolean).join(', ');
        }
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.table_to_sheet(tableClone);
      // try converting date strings in column 2 to excel dates
      if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cellAddress = { c: 2, r: R };
          const cellRef = XLSX.utils.encode_cell(cellAddress);
          if (ws[cellRef] && ws[cellRef].t === 's') {
            const dateValue = new Date(ws[cellRef].v);
            if (!isNaN(dateValue.getTime())) {
              ws[cellRef].t = 'n';
              ws[cellRef].v = dateValue;
              ws[cellRef].z = 'yyyy-mm-dd hh:mm:ss';
            }
          }
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, "Vehicle Status Data");
      const titleEl = safeEl('statusPopupTitle');
      const title = titleEl ? titleEl.textContent : 'Vehicle_Status_Data';
      XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
    });
  }

  // range selector
  document.querySelectorAll("#range-selector .range-btn").forEach((btn) => {
    btn.addEventListener("click", async function () {
      document.querySelectorAll("#range-selector .range-btn").forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentRange = this.getAttribute("data-range");
      await fetchVehicleDistances(currentRange);
    });
  });

  // Download entire vehicle table Excel
  const downloadExcelBtn = safeEl("downloadExcelBtn");
  if (downloadExcelBtn) {
    downloadExcelBtn.addEventListener("click", function () {
      const table = document.querySelector(".vehicleLiveTable table");
      if (!table) return;
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.table_to_sheet(table);
      XLSX.utils.book_append_sheet(wb, ws, "Vehicle Data");
      XLSX.writeFile(wb, "vehicle_data.xlsx");
    });
  }
}

/* -------------------------
   Misc fetchers & UI updates
   -------------------------*/
async function fetchVehicleDistances(range = "1day") {
  try {
    const data = await fetchJSON(
        `${API.vehicleRangeData}?range=${range}`, {}, 
        {showUserError: true, userMessage: "Failed to load vehicle data" });
    const tableBody = safeEl("vehicleTable");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    (data || []).forEach((vehicle) => {
      let row = `<tr>
                  <td>${vehicle.registration || ''}</td>
                  <td>${(vehicle.distance || 0).toFixed(2)}</td>
                  <td>${vehicle.driving_time || ''}</td>
                  <td>${vehicle.idle_time || ''}</td>
                  <td>${vehicle.number_of_stops || 0}</td>
                  <td>${vehicle.max_speed || 0}/${vehicle.avg_speed || 0}</td>
                 </tr>`;
      tableBody.innerHTML += row;
    });

    afterTableRender();
  } catch (error) {
    console.error("Error fetching vehicle distances:", error);
  }
}

/* -------------------------
   Initialization
   -------------------------*/
async function initDashboard() {
  // initial theme state
  isDarkMode = document.body.classList.contains("dark-mode");
  centerColor = isDarkMode ? "#ccc" : "#2f2f2f";
  Chart.defaults.color = isDarkMode ? "#ccc" : "#2f2f2f";

  // window.__themeWatcher = watchBodyTheme({ debounceMs: 80 });

  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      // wait for class toggle done in base script, then refresh charts/map
      setTimeout(() => {
        updateTheme().catch((e) => console.error("theme toggle updateTheme failed:", e));
      }, 0);
    });
  }
  
  // start clock
  setInterval(() => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const clockStr = `${hours}:${minutes}:${seconds}`;
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    const dateStr = now.toLocaleDateString(undefined, options);
    const clockEl = safeEl("clock");
    const dateEl = safeEl("date");
    if (clockEl) clockEl.textContent = clockStr;
    if (dateEl) dateEl.textContent = dateStr;
  }, 1000);

  await attachEventListeners();

  // initialize map & charts
  await initMap();
  initDevicesChart();

  // fetch data once at load
  fetchStatusData();
  fetchDashboardData();
  await renderPieChart();
  await fetchDistanceTravelledData();
  await fetchVehicleDistances(currentRange);
}

/* wire DOMContentLoaded to the init */
document.addEventListener("DOMContentLoaded", () => {
  initDashboard().catch((e) => console.error("Init error:", e));
});
