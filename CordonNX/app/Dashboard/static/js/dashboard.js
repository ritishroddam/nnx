let currentSort = { column: "distance", direction: "desc" };
let currentStatusFilter = null;
let statusPopupTableData = [];

async function fetchFilteredVehicleData(status) {
    try {
        const response = await fetch(`/dashboard/get_vehicle_range_data?range=${currentRange}`);
        const data = await response.json();
        
        const filteredData = data.filter(vehicle => {
            switch(status) {
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

function formatStatusTime(seconds) {
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

async function showStatusPopup(status, title) {
    currentStatusFilter = status;
    document.getElementById('statusPopupTitle').textContent = title;

    document.getElementById('statusPopupTableBody').innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 20px;">
                Loading data...
            </td>
        </tr>
    `;

    document.getElementById('statusPopupOverlay').classList.add('active');
    document.getElementById('statusPopup').classList.add('active');

    try {
        const response = await fetch(`/dashboard/get_vehicle_range_data?status=${status}`);
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        const filteredData = Array.isArray(data) ? data : [];
        statusPopupTableData = filteredData;
        
        if (window.statusCounts) {
            const expectedCount = window.statusCounts[`${status}Vehicles`];
            if (filteredData.length !== expectedCount) {
                console.warn(`Count mismatch: ${status} shows ${expectedCount} in cards but ${filteredData.length} in table`);
            }
        }
        
        renderStatusPopupTable(filteredData);
        
    } catch (error) {
        console.error("Error fetching vehicle data:", error);
        document.getElementById('statusPopupTableBody').innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 20px; color: red;">
                    ${error.message || 'Error loading data'}
                </td>
            </tr>
        `;
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

function renderStatusPopupTable(data) {
    const tableBody = document.getElementById('statusPopupTableBody');
    tableBody.innerHTML = '';

    if (!Array.isArray(data)) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 20px; color: red;">
                    Invalid data format received
                </td>
            </tr>
        `;
        return;
    }
    
    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 20px;">
                    No vehicles found for this status.
                </td>
            </tr>
        `;
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
            
        const ASUgsmValue = parseInt(vehicle.gsm || 0);
        let gsmIcon, gsmColor;
        if (ASUgsmValue == 0) {
            gsmIcon = "signal_cellular_null";
            gsmColor = "#d32f2f";
        } else if (ASUgsmValue > 0 && ASUgsmValue <= 8) {
            gsmIcon = "signal_cellular_1_bar";
            gsmColor = "#ff9800";
        } else if (ASUgsmValue > 8 && ASUgsmValue <= 16) {
            gsmIcon = "signal_cellular_2_bar";
            gsmColor = "#ffc107";
        } else if (ASUgsmValue > 16 && ASUgsmValue <= 24) {
            gsmIcon = "signal_cellular_3_bar";
            gsmColor = "#cddc39";
        } else if (ASUgsmValue > 24 && ASUgsmValue <= 32) {
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
          </td>
      `;
        
        tableBody.appendChild(row);
    });
    
    setupTableSorting('#statusPopupTable');
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

function sortTable(column, direction, selector = '.vehicleLiveTable table') {
    const table = document.querySelector(selector);
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const columnIndex = Array.from(table.querySelectorAll("th")).findIndex(
        (th) => th.dataset.column === column
    );

    rows.sort((a, b) => {
        let cellA = a.children[columnIndex].innerText.trim();
        let cellB = b.children[columnIndex].innerText.trim();

        if (column === "max_avg_speed") {
            cellA = parseFloat(cellA.split("/")[0]) || 0;
            cellB = parseFloat(cellB.split("/")[0]) || 0;
        } else if (!isNaN(cellA) && !isNaN(cellB)) {
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

function afterTableRender() {
  setupTableSorting();
  sortTable("distance", "desc");
  currentSort = { column: "distance", direction: "desc" };
}

let currentRange = "1day"; 

async function fetchVehicleDistances(range = "1day") {
  try {
    const response = await fetch(`/dashboard/get_vehicle_range_data?range=${range}`);
    const data = await response.json();

    let tableBody = document.getElementById("vehicleTable");
    tableBody.innerHTML = "";

    data.forEach((vehicle) => {
      let row = `<tr>
                  <td>${vehicle.registration}</td>
                  <td>${vehicle.distance.toFixed(2)}</td>
                  <td>${vehicle.driving_time}</td>
                  <td>${vehicle.idle_time}</td>
                  <td>${vehicle.number_of_stops}</td>
                  <td>${vehicle.max_speed}/${vehicle.avg_speed}</td>
              </tr>`;
      tableBody.innerHTML += row;
    });

    afterTableRender();
  } catch (error) {
    console.error("Error fetching vehicle distances:", error);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await initMap();

  const apiKey = "365ddab9f6e0165c415605dd9f1178f8";
  let centerColor = "#2f2f2f";
  Chart.defaults.color = "#2f2f2f";
  const isDarkMode = document.body.classList.contains("dark-mode");
  if (isDarkMode) {
    Chart.defaults.color = "#ccc";
    centerColor = "#ccc";
  }
  const themeToggle = document.getElementById("theme-toggle");
  themeToggle.addEventListener("click", function () {
    const isDarkMode = document.body.classList.contains("dark-mode");

    if (isDarkMode) {
      Chart.defaults.color = "#ccc";
      centerColor = "#ccc";
    } else {
      Chart.defaults.color = "#2f2f2f";
      centerColor = "#2f2f2f";
    }

    if (devicesChart) {
      devicesChart.options.plugins.legend.labels.color = isDarkMode
        ? "#ccc"
        : "#2f2f2f";
      devicesChart.options.scales.x.ticks.color = isDarkMode
        ? "#ccc"
        : "#2f2f2f";
      devicesChart.options.scales.y.ticks.color = isDarkMode
        ? "#ccc"
        : "#2f2f2f";
      devicesChart.options.scales.x.grid.color = isDarkMode
        ? "#787878"
        : "#d8d8d8";
      devicesChart.options.scales.y.grid.color = isDarkMode
        ? "#787878"
        : "#d8d8d8";
      devicesChart.data.datasets[0].backgroundColor = isDarkMode
        ? "rgba(204, 204, 204, 0.2)"
        : "rgba(47, 47, 47, 0.2)";
      devicesChart.data.datasets[0].borderColor = isDarkMode
        ? "#ccc"
        : "#2f2f2f";
      devicesChart.data.datasets[0].pointBackgroundColor = isDarkMode
        ? "#ccc"
        : "#2f2f2f";
      devicesChart.data.datasets[0].pointBorderColor = isDarkMode
        ? "black"
        : "white";

      devicesChart.update();
    }

    if (window.pieChart) {
      window.pieChart.destroy();
      renderPieChart();
    }
  });

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

  function getLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          getWeather(lat, lon);
        },
        () => {
          getWeather(null, null);
        }
      );
    } else {
      document.getElementById("weather").innerHTML =
        "<p>Geolocation is not supported by your browser.</p>";
    }
  }

  function updateClockAndDate() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const clockStr = `${hours}:${minutes}:${seconds}`;

    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const dateStr = now.toLocaleDateString(undefined, options);

    document.getElementById("clock").textContent = clockStr;
    document.getElementById("date").textContent = dateStr;
  }

  async function fetchDashboardData() {
    try {
      const response = await fetch("/dashboard/dashboard_data");
      const data = await response.json();

      if (response.ok) {
        document.querySelector(".card:nth-child(1) h3").textContent =
          data.devices || 0;
        document.querySelector(".card:nth-child(2) h3").textContent =
          data.sims || 0;
        document.querySelector(".card:nth-child(3) h3").textContent =
          data.customers || 0;
      } else {
        console.error("Error fetching dashboard data:", data.error);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  }

  async function renderPieChart() {
    try {
      const response = await fetch("/dashboard/atlanta_pie_data");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unknown error fetching pie chart data");
      }

      console.log("🚀 API Response:", data);

      if (data.total_devices === undefined) {
        throw new Error("Invalid data format received");
      }

      if (window.pieChart) {
        window.pieChart.destroy();
      }

      const ctx = document.getElementById("vehiclesChart").getContext("2d");

      const gradient1 = ctx.createLinearGradient(0, 0, 0, 400);
      gradient1.addColorStop(0, "#7bb83d");
      gradient1.addColorStop(1, "#a1d072");

      const gradient2 = ctx.createLinearGradient(0, 0, 0, 400);
      gradient2.addColorStop(0, "#33669a");
      gradient2.addColorStop(1, "#538cc6");

      const gradient3 = ctx.createLinearGradient(0, 0, 0, 400);
      gradient3.addColorStop(0, "#bfbfbf");
      gradient3.addColorStop(1, "#f2f2f2");

      const chartConfig = {
        type: "doughnut",
        data: {
          labels: ["Moving Vehicles", "Idle Vehicles", "Offline Vehicles"],
          datasets: [
            {
              data: [
                data.moving_vehicles,
                data.idle_vehicles,
                data.offline_vehicles,
              ],
              backgroundColor: [gradient1, gradient2, gradient3],
              hoverBackgroundColor: ["#7bb83d", "#33669a", "#bfbfbf"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "top",
              labels: {
                font: {
                  size: 14,
                  weight: "bold",
                  color: isDarkMode ? "#e0e0e0" : "#2f2f2f",
                },
                generateLabels: (chart) => {
                  const original =
                    Chart.overrides.doughnut.plugins.legend.labels
                      .generateLabels;
                  const labels = original.call(this, chart);
                  labels.forEach((label) => {
                    label.text = label.text;
                    label.className = "chart-label";
                  });
                  return labels;
                },
              },
            },
            tooltip: {
              callbacks: {
                label: function (tooltipItem) {
                  const value = tooltipItem.raw;
                  const percentage = (
                    (value / data.total_devices) *
                    100
                  ).toFixed(2);
                  return `${tooltipItem.label}: ${value} (${percentage}%)`;
                },
              },
            },
            centerText: {
              display: true,
              text: "Total Vehicles: " + data.total_devices,
            },
          },
          animation: {
            animateRotate: true,
            animateScale: true,
            duration: 2000,
            easing: "easeOutBounce",
          },
          cutout: "70%",
          layout: {
            padding: 30,
          },
          hover: {
            onHover: function (event, chartElement) {
              const canvas = document.getElementById("vehiclesChart");
              if (chartElement.length) {
                canvas.style.cursor = "pointer";
              } else {
                canvas.style.cursor = "default";
              }
            },
          },
          rotation: -90,       
          circumference: 180,   
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
            },
          },
        ],
      };

      window.pieChart = new Chart(ctx, chartConfig);
    } catch (error) {
      console.error("❌ Error fetching pie chart data:", error);
    }
  }

  var ctx = document.getElementById("devicesChart").getContext("2d");
  var devicesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Distance Travelled (km)",
          data: [],
          backgroundColor: isDarkMode
            ? "rgba(204, 204, 204, 0.2)"
            : "rgba(47, 47, 47, 0.2)",
          borderColor: isDarkMode ? "#ccc" : "#2f2f2f",
          pointBackgroundColor: isDarkMode ? "#ccc" : "#2f2f2f",
          pointBorderColor: isDarkMode ? "black" : "#fff",
          pointRadius: 0,      
          pointHoverRadius: 7,   
          borderWidth: 2,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#2f2f2f",
            pointStyle: "rectRounded",
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
        },
        y: {
          grid: {
            display: false,
            drawBorder: false
          },
        },
      },
      elements: {
        point: {
          radius: 0,         
          hoverRadius: 7     
        }
      },
      interaction: {
        mode: 'nearest',
        intersect: false
      },
      plugins: {
        tooltip: {
          enabled: true
        }
      },
    },
  });

  async function fetchDistanceTravelledData() {
    try {
      const response = await fetch("/dashboard/atlanta_distance_data");
      const data = await response.json();

      console.log("Fetched Data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Unknown error fetching distance data");
      }

      console.log("Fetched Distance Data:", data);

      devicesChart.data.labels = data.labels;
      devicesChart.data.datasets[0].data = data.distances;
      devicesChart.update();
    } catch (error) {
      console.error("Error fetching distance data:", error);
    }
  }

  await fetchDistanceTravelledData();

  document.querySelectorAll("#range-selector .range-btn").forEach((btn) => {
    btn.addEventListener("click", async function () {
      document
        .querySelectorAll("#range-selector .range-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentRange = this.getAttribute("data-range");
      await fetchVehicleDistances(currentRange);
    });
  });  

  await fetchVehicleDistances();

  document.getElementById("downloadExcelBtn").addEventListener("click", function () {
    const table = document.querySelector(".vehicleLiveTable table");
    if (!table) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "Vehicle Data");

    XLSX.writeFile(wb, "vehicle_data.xlsx");
  });

  getLocation();
  setInterval(updateClockAndDate, 1000);
  updateClockAndDate();

  await fetchDashboardData();
  await renderPieChart();
});

let map, trafficLayer, marker;

const themeToggle = document.getElementById("theme-toggle");
themeToggle.addEventListener("click", async function () {
  setTimeout(async () => {
    await initMap();
  }, 100);
});

async function initMap() {
  const { Map, TrafficLayer } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

  const mapOptions = {
    zoom: 13,
    disableDefaultUI: true,
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        const darkMode = document.body.classList.contains("dark-mode");

        const mapId = darkMode ? "e426c1ad17485d79" : "dc4a8996aab2cac9";

        map = new Map(document.getElementById("map"), {
          ...mapOptions,
          center: userLocation,
          zoomControl: true,
          mapId: mapId,
        });

        trafficLayer = new TrafficLayer();
        trafficLayer.setMap(map);


        marker = new AdvancedMarkerElement({
          position: userLocation,
          map: map,
          title: "Your Location",
        });

      },
      () => {
        fallbackToDefaultLocation();
      }
    );
  } else {
    fallbackToDefaultLocation();
  }
}

async function fallbackToDefaultLocation() {
  try {
    const { Map, TrafficLayer } = await google.maps.importLibrary("maps");
    console.log("Using fallback location: Bangalore");
    const defaultLocation = { lat: 12.9716, lng: 77.5946 }; // Bangalore
    const darkMode = document.body.classList.contains("dark-mode");

    const mapId = darkMode ? "e426c1ad17485d79" : "dc4a8996aab2cac9";
    map = new Map(document.getElementById("map"), {
      center: defaultLocation,
      zoom: 15,
      disableDefaultUI: true,
      mapId: mapId,
    });

    trafficLayer = new TrafficLayer();
    trafficLayer.setMap(map);

    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    marker = new AdvancedMarkerElement({
      position: defaultLocation,
      map: map,
      title: "Your Location",
    });


  } catch (error) {
    console.error("Error initializing fallback location:", error);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  fetchStatusData();
});

async function fetchStatusData() {
    try {
        const statusCards = document.querySelectorAll('.status-card');
        statusCards.forEach(card => {
            card.classList.add('loading');
        });

        const response = await fetch("/dashboard/get_status_data");
        const data = await response.json();

        document.getElementById("running-vehicles-count").textContent = 
            `${data.runningVehicles} / ${data.totalVehicles}`;
        document.getElementById("idle-vehicles-count").textContent = 
            `${data.idleVehicles} / ${data.totalVehicles}`;
        document.getElementById("parked-vehicles-count").textContent = 
            `${data.parkedVehicles} / ${data.totalVehicles}`;
        document.getElementById("speed-vehicles-count").textContent = 
            `${data.speedVehicles} / ${data.totalVehicles}`;
        document.getElementById("overspeed-vehicles-count").textContent = 
            `${data.overspeedVehicles} / ${data.totalVehicles}`;
        document.getElementById("offline-vehicles-count").textContent = 
            `${data.offlineVehicles} / ${data.totalVehicles}`;
        document.getElementById("disconnected-vehicles-count").textContent = 
            `${data.disconnectedVehicles} / ${data.totalVehicles}`;
        
        statusCards.forEach(card => {
            card.classList.remove('loading');
        });
        
        window.statusCounts = data;
    } catch (error) {
        console.error("Error fetching status data:", error);
        const statusCards = document.querySelectorAll('.status-card');
        statusCards.forEach(card => {
            card.classList.remove('loading');
        });
    }
}

function fetchStatusData() {
    fetch("/dashboard/get_status_data")
        .then((response) => response.json())
        .then((data) => {
            document.getElementById("running-vehicles-count").textContent = 
                `${data.runningVehicles} / ${data.totalVehicles}`;
            document.getElementById("idle-vehicles-count").textContent = 
                `${data.idleVehicles} / ${data.totalVehicles}`;
            document.getElementById("parked-vehicles-count").textContent = 
                `${data.parkedVehicles} / ${data.totalVehicles}`;
            document.getElementById("speed-vehicles-count").textContent = 
                `${data.speedVehicles} / ${data.totalVehicles}`;
            document.getElementById("overspeed-vehicles-count").textContent = 
                `${data.overspeedVehicles} / ${data.totalVehicles}`;
            document.getElementById("offline-vehicles-count").textContent = 
                `${data.offlineVehicles} / ${data.totalVehicles}`;
            document.getElementById("disconnected-vehicles-count").textContent = 
                `${data.disconnectedVehicles} / ${data.totalVehicles}`;
            
            window.statusCounts = data;
        })
        .catch((error) => console.error("Error fetching status data:", error));
}

document.getElementById('statusPopupClose').addEventListener('click', () => {
    document.getElementById('statusPopupOverlay').classList.remove('active');
    document.getElementById('statusPopup').classList.remove('active');
    fetchStatusData();
});

document.getElementById('statusPopupOverlay').addEventListener('click', () => {
    document.getElementById('statusPopupOverlay').classList.remove('active');
    document.getElementById('statusPopup').classList.remove('active');
    fetchStatusData();
});

document.getElementById('running-vehicles').addEventListener('click', () => {
    showStatusPopup('running', 'Running Vehicles');
});

document.getElementById('idle-vehicles').addEventListener('click', () => {
    showStatusPopup('idle', 'Idle Vehicles');
});

document.getElementById('parked-vehicles').addEventListener('click', () => {
    showStatusPopup('parked', 'Parked Vehicles');
});

document.getElementById('speed-vehicles').addEventListener('click', () => {
    showStatusPopup('speed', 'Speed Vehicles (40-60 km/h)');
});

document.getElementById('overspeed-vehicles').addEventListener('click', () => {
    showStatusPopup('overspeed', 'Over Speed Vehicles (60+ km/h)');
});

document.getElementById('offline-vehicles').addEventListener('click', () => {
    showStatusPopup('offline', 'Offline Vehicles');
});

document.getElementById('disconnected-vehicles').addEventListener('click', () => {
    showStatusPopup('disconnected', 'Disconnected Vehicles');
});

document.getElementById('statusPopupExcelBtn').addEventListener('click', function() {
    const table = document.querySelector("#statusPopup table");
    if (!table) return;
    
    const tableClone = table.cloneNode(true);
    
    const rows = tableClone.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const cells = row.cells;
        
        const statusCell = cells[cells.length - 1];
        if (statusCell.classList.contains('status-icons')) {
            const sos = statusCell.getAttribute('data-sos') === 'true' ? 'SOS: Active' : '';
            const gps = statusCell.getAttribute('data-gps') === 'true' ? 'GPS: Good' : 'GPS: Bad';
            const ignition = statusCell.getAttribute('data-ignition') === 'true' ? 'Ignition: On' : 'Ignition: Off';
            
            const gsmValue = parseInt(statusCell.getAttribute('data-gsm'));
            let gsmStatus = 'Signal: ';
            if (gsmValue == 0) {
                gsmStatus += 'None';
            } else if (gsmValue > 0 && gsmValue <= 8) {
                gsmStatus += 'Weak';
            } else if (gsmValue > 8 && gsmValue <= 16) {
                gsmStatus += 'Fair';
            } else if (gsmValue > 16 && gsmValue <= 24) {
                gsmStatus += 'Good';
            } else if (gsmValue > 24 && gsmValue <= 32) {
                gsmStatus += 'Excellent';
            } else {
                gsmStatus += 'Unknown';
            }
            
            statusCell.textContent = [sos, gps, ignition, gsmStatus].filter(Boolean).join(', ');
        }
        
        const lastUpdatedCell = cells[2]; 
        if (!lastUpdatedCell.textContent.includes('N/A')) {
            const dateTimeStr = lastUpdatedCell.textContent;
            lastUpdatedCell.textContent = dateTimeStr;
        }
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(tableClone);
    
    if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellAddress = {c: 2, r: R}; 
            const cellRef = XLSX.utils.encode_cell(cellAddress);
            if (ws[cellRef] && ws[cellRef].t === 's') {
                // Try to parse the date string
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
    const title = document.getElementById('statusPopupTitle').textContent;
    XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
});