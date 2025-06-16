let currentSort = { column: "distance", direction: "desc" };

function applySortIcons(column, direction) {
  document.querySelectorAll(".vehicleLiveTable th").forEach((th) => {
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

function sortTable(column, direction) {
  const table = document.querySelector(".vehicleLiveTable table");
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const columnIndex = Array.from(table.querySelectorAll("th")).findIndex(
    (th) => th.dataset.column === column
  );

  rows.sort((a, b) => {
    let cellA = a.children[columnIndex].innerText.trim();
    let cellB = b.children[columnIndex].innerText.trim();

    // Special handling for Max/Avg Speed column
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
  applySortIcons(column, direction);
}

function setupTableSorting() {
  const table = document.querySelector(".vehicleLiveTable table");
  table.querySelectorAll("th").forEach((header) => {
    header.addEventListener("click", () => {
      const column = header.dataset.column;
      if (!column) return;
      const direction =
        currentSort.column === column && currentSort.direction === "asc"
          ? "desc"
          : "asc";
      sortTable(column, direction);
      currentSort = { column, direction };
    });
  });
}

function afterTableRender() {
  setupTableSorting();
  sortTable("distance", "desc");
  currentSort = { column: "distance", direction: "desc" };
}

let currentRange = "1day"; // Default

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

      // Update the chart to reflect the changes
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

      // Destroy existing chart if it exists
      if (window.pieChart) {
        window.pieChart.destroy();
      }

      const ctx = document.getElementById("vehiclesChart").getContext("2d");

      // Create gradient colors
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
                    label.className = "chart-label"; // Add the chart-label class
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
              value: data.total_devices,
              label: "Total Vehicles"
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
          rotation: -90,         // <-- Add this line (degrees)
          circumference: 180,    // <-- Add this line (degrees)
        },
        plugins: [
          {
            id: "centerText",
            beforeDraw(chart) {
              const { width } = chart;
              const { top, bottom } = chart.chartArea;
              const ctx = chart.ctx;
              // For half donut, center text lower
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

      // Render the chart
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
          pointRadius: 5,
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
          ticks: {
            color: isDarkMode ? "#ccc" : "#2f2f2f",
          },
          grid: {
            color: isDarkMode ? "#787878" : "#d8d8d8",
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: isDarkMode ? "#ccc" : "#2f2f2f",
          },
          grid: {
            color: isDarkMode ? "#787878" : "#d8d8d8",
          },
        },
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
    zoom: 15,
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

function fetchStatusData() {
  fetch("/dashboard/get_status_data")
    .then((response) => response.json())
    .then((data) => {
      document.getElementById(
        "running-vehicles-count"
      ).textContent = `${data.runningVehicles} / ${data.totalVehicles}`;
      document.getElementById(
        "idle-vehicles-count"
      ).textContent = `${data.idleVehicles} / ${data.totalVehicles}`;
      document.getElementById(
        "parked-vehicles-count"
      ).textContent = `${data.parkedVehicles} / ${data.totalVehicles}`;
      document.getElementById(
        "speed-vehicles-count"
      ).textContent = `${data.speedVehicles} / ${data.totalVehicles}`;
      document.getElementById(
        "overspeed-vehicles-count"
      ).textContent = `${data.overspeedVehicles} / ${data.totalVehicles}`;
      document.getElementById(
        "disconnected-vehicles-count"
      ).textContent = `${data.disconnectedVehicles} / ${data.totalVehicles}`;
    })
    .catch((error) => console.error("Error fetching status data:", error));
}
