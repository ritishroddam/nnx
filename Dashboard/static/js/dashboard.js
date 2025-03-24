document.addEventListener("DOMContentLoaded", async () => {
  initMap();

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
    // const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=12.9716&lon=77.5946&appid=${apiKey}&units=metric`;

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
                    <div class="weather-info">
                        <img class="weather-icon" src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="Weather icon">
                        <p><strong>${data.name}</strong></p>
                        <p>${data.weather[0].description}</p>
                        <p>Temperature: ${data.main.temp} °C</p>
                        <p>Humidity: ${data.main.humidity}%</p>
                        <p>Wind Speed: ${data.wind.speed} m/s</p>
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
          document.getElementById("weather").innerHTML =
            "<p>Unable to retrieve your location.</p>";
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
        document.querySelector(".card:nth-child(4) h3").textContent =
          data.employees || 0;
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
      gradient1.addColorStop(0, "#3cba9f");
      gradient1.addColorStop(1, "#36d1dc");

      const gradient2 = ctx.createLinearGradient(0, 0, 0, 400);
      gradient2.addColorStop(0, "#f39c12");
      gradient2.addColorStop(1, "#f7b733");

      const gradient3 = ctx.createLinearGradient(0, 0, 0, 400);
      gradient3.addColorStop(0, "#3498db");
      gradient3.addColorStop(1, "#3d84e6");

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
              hoverBackgroundColor: ["#2ecc71", "#e67e22", "#2980b9"],
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
        },
        plugins: [
          {
            id: "centerText",
            beforeDraw(chart) {
              const { width } = chart;
              const { top, bottom } = chart.chartArea;
              const ctx = chart.ctx;
              const centerY = (top + bottom) / 2;
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

      if (!response.ok) {
        throw new Error(data.error || "Unknown error fetching distance data");
      }

      // Debugging logs
      console.log("Fetched Distance Data:", data);

      // Update chart data
      devicesChart.data.labels = data.labels;
      devicesChart.data.datasets[0].data = data.distances;
      devicesChart.update();
    } catch (error) {
      console.error("Error fetching distance data:", error);
    }
  }

  // Fetch and update the chart data initially
  await fetchDistanceTravelledData();

  async function fetchVehicleDistances() {
    try {
      const response = await fetch("/dashboard/get_vehicle_distances");
      const data = await response.json();

      let tableBody = document.getElementById("vehicleTable");
      tableBody.innerHTML = ""; // Clear existing table data

      data.forEach((vehicle) => {
        let row = `<tr>
                  <td>${vehicle.registration}</td>
                  <td>${vehicle.distance.toFixed(2)}</td>
              </tr>`;
        tableBody.innerHTML += row;
      });
    } catch (error) {
      console.error("Error fetching vehicle distances:", error);
    }
  }

  document.getElementById("sortBtn").addEventListener("click", function () {
    const table = document.querySelector("#vehicleTable");
    const rows = Array.from(table.rows);
    const headerRow = rows.shift();

    rows.sort((a, b) => {
      const x = parseFloat(a.cells[1].innerText);
      const y = parseFloat(b.cells[1].innerText);
      return y - x;
    });

    table.innerHTML = "";
    table.appendChild(headerRow);
    rows.forEach((row) => table.appendChild(row));
  });

  await fetchVehicleDistances();

  getLocation();
  setInterval(updateClockAndDate, 1000);
  updateClockAndDate();

  await fetchDashboardData();
  await renderPieChart();
});

let map, trafficLayer;

const themeToggle = document.getElementById("theme-toggle");
let darkMode = true;
themeToggle.addEventListener("click", function () {
  darkMode = !darkMode;
  initMap(darkMode);
});

async function initMap(darkMode = true) {
  const mapOptions = {
    zoom: 12,
    disableDefaultUI: true,
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        const mapId = darkMode ? "44775ccfe2c0bd88" : "8faa2d4ac644c8a2";

        map = new google.maps.Map(document.getElementById("map"), {
          ...mapOptions,
          center: userLocation,
          zoomControl: true,
          mapId: mapId,
        });

        infoWindow = new google.maps.InfoWindow();

        trafficLayer = new google.maps.TrafficLayer();
        trafficLayer.setMap(map);
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
    console.log("Using fallback location: Bangalore");
    const defaultLocation = { lat: 12.9716, lng: 77.5946 }; // Bangalore
    const mapId = darkMode ? "44775ccfe2c0bd88" : "8faa2d4ac644c8a2";
    map = new google.maps.Map(document.getElementById("map"), {
      center: defaultLocation,
      zoom: 12,
      disableDefaultUI: true,
      mapId: mapId,
    });

    trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);
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
      document.getElementById(
        "no-gps-vehicles-count"
      ).textContent = `${data.noGpsVehicles} / ${data.totalVehicles}`;
    })
    .catch((error) => console.error("Error fetching status data:", error));
}
