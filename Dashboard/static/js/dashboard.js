document.addEventListener("DOMContentLoaded", async () => {
  const apiKey = "365ddab9f6e0165c415605dd9f1178f8";

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

      // Configure the chart
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

  getLocation();
  setInterval(updateClockAndDate, 1000);
  updateClockAndDate();

  await fetchDashboardData(); // Cards
  await renderPieChart(); // Pie Chart
});

let map, trafficLayer;

function initMap() {
  const mapOptions = {
    zoom: 12,
    disableDefaultUI: true,
  };

  // Try to fetch user's current location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        // Initialize the map with user's location
        map = new google.maps.Map(document.getElementById("map"), {
          ...mapOptions,
          center: userLocation,
        });

        // Add traffic layer
        trafficLayer = new google.maps.TrafficLayer();
        trafficLayer.setMap(map);

        // Update traffic status
        updateTrafficStatus();
        setInterval(updateTrafficStatus, 60000);
      },
      () => {
        // If geolocation fails, fallback to default location (Bangalore)
        fallbackToDefaultLocation();
      }
    );
  } else {
    // If browser doesn't support geolocation, fallback to default location (Bangalore)
    fallbackToDefaultLocation();
  }
}

function fallbackToDefaultLocation() {
  const defaultLocation = { lat: 12.9716, lng: 77.5946 }; // Bangalore
  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultLocation,
    zoom: 12,
    disableDefaultUI: true,
  });

  trafficLayer = new google.maps.TrafficLayer();
  trafficLayer.setMap(map);

  updateTrafficStatus();
  setInterval(updateTrafficStatus, 60000);
}

function updateTrafficStatus() {
  // Simulate traffic status updates
  const trafficConditions = [
    "Heavy Traffic",
    "Moderate Traffic",
    "Light Traffic",
    "No Traffic",
  ];
  const randomStatus =
    trafficConditions[Math.floor(Math.random() * trafficConditions.length)];
  document.getElementById(
    "traffic-status"
  ).textContent = `Current Traffic Status: ${randomStatus}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const festivalDates = {
    "01-14": {
      name: "Makar Sankranti",
      image: "http://64.227.135.38/sankranti.jpg",
    },
    "01-26": {
      name: "Republic Day",
      image: "http://64.227.135.38/republicDay.jpg",
    },
    "02-26": {
      name: "Maha Shivaratri",
      image: "http://64.227.135.38/shivaRatri.jpg",
    },
    "03-14": { name: "Holi", image: "http://64.227.135.38/holi.jpg" },
    "03-30": { name: "Ugadi", image: "http://64.227.135.38/ugadi.jpg" },
    "04-06": { name: "Rama Navami", image: "http://64.227.135.38/rama.jpg" },
    "04-18": {
      name: "Good Friday",
      image: "http://64.227.135.38/goodFriday.jpg",
    },
    "05-01": {
      name: "International Worker's Day",
      image: "http://64.227.135.38/labour.jpg",
    },
    "07-10": { name: "Guru Purnima", image: "http://64.227.135.38/guru.jpg" },
    "08-15": {
      name: "Independence Day",
      image: "http://64.227.135.38/independenceDay.jpg",
    },
    "08-27": {
      name: "Ganesh Chaturthi",
      image: "http://64.227.135.38/ganesha.jpg",
    },
    "09-05": { name: "Onam", image: "http://64.227.135.38/onam.png" },
    "10-02": {
      name: "Mahatma Gandhi Jayanti",
      image: "http://64.227.135.38/gandhi.jpg",
    },
    "10-20": { name: "Diwali", image: "http://64.227.135.38/diwali.jpg" },
    "12-25": { name: "Christmas", image: "http://64.227.135.38/christmas.jpg" },
  };

  const today = new Date();
  const formattedDate = `${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(today.getDate()).padStart(2, "0")}`;
  const banner = document.getElementById("festival-banner");
  const minimizedBanner = document.getElementById("minimized-banner");
  const closeBannerBtn = document.getElementById("close-banner-btn");

  // Check if today is a festival
  if (festivalDates[formattedDate]) {
    const { name: festivalName, image: festivalImage } =
      festivalDates[formattedDate];
    document.querySelector(
      ".banner-title"
    ).textContent = `Happy ${festivalName}!`;
    document.querySelector(
      ".banner-message"
    ).textContent = `Celebrate the joy of ${festivalName}!`;
    document.querySelector(".banner-image").src = festivalImage;
    banner.classList.remove("hidden");

    // Event Listener for Close Button
    closeBannerBtn.addEventListener("click", () => {
      banner.classList.add("hidden");
      minimizedBanner.classList.remove("hidden");
    });

    // Event Listener for Minimized Banner
    minimizedBanner.addEventListener("click", () => {
      banner.classList.remove("hidden");
      minimizedBanner.classList.add("hidden");
    });
  }
});

////////////////////////////////////////////////////////////////////////

document.addEventListener("DOMContentLoaded", async function () {
  var ctx = document.getElementById("devicesChart").getContext("2d");
  var devicesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [], // Empty initially, will be updated dynamically
      datasets: [
        {
          label: "Distance Travelled (km)",
          data: [], // Empty initially, will be updated dynamically
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
          fill: true,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
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
});
