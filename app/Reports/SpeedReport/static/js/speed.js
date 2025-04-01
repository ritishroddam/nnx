document.addEventListener("DOMContentLoaded", function () {
  const searchBtn = document.getElementById("searchBtn");
  const downloadBtn = document.getElementById("downloadBtn");

  searchBtn.addEventListener("click", function () {
    const licensePlateNumber = document.getElementById("vehicleSelect").value;
    const fromDate = document.getElementById("fromDate").value;
    const toDate = document.getElementById("toDate").value;

    if (!licensePlateNumber || !fromDate || !toDate) {
      alert("Please fill all fields");
      return;
    }

    fetch("/allReport/speedReport/fetch_speed_report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        license_plate_number: licensePlateNumber,
        from_date: fromDate,
        to_date: toDate,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
          return;
        }

        const dataTable = document.getElementById("data-table");
        dataTable.innerHTML = "";

        data.forEach((entry) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${entry.LicensePlateNumber}</td>
            <td>${entry.Date}</td>
            <td>${entry.Time}</td>
            <td>${entry.Latitude}</td>
            <td>${entry.Longitude}</td>
            <td>${entry.Speed}</td>
          `;
          dataTable.appendChild(row);
        });
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("Failed to fetch data");
      });
  });

  downloadBtn.addEventListener("click", function () {
    const rows = Array.from(document.querySelectorAll("#data-table tr"));
    if (rows.length === 0) {
      alert("No data to download");
      return;
    }

    const records = rows.map((row) => {
      const cells = row.querySelectorAll("td");
      return {
        LicensePlateNumber: cells[0].innerText,
        Date: cells[1].innerText,
        Time: cells[2].innerText,
        Latitude: cells[3].innerText,
        Longitude: cells[4].innerText,
        Speed: cells[5].innerText,
      };
    });

    fetch("/allReport/speedReport/download_speed_report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records }),
    })
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Speed_Report.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("Failed to download data");
      });
  });

  $("#vehicleSelect").selectize({
    create: false,
    sortField: "text",
  });
});
