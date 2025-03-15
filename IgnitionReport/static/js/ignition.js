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

    fetch("/ignitionReport/fetch_ignition_report", {
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
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(err.error);
          });
        }
        return response.json();
      })
      .then((data) => {
        if (data.length === 0) {
          const dataTable = document.getElementById("data-table");
          const emptyRow = document.createElement("tr");
          emptyRow.innerHTML = `<td colspan="6" style="text-align: center;">No data available for the selected date range.</td>`;
          dataTable.appendChild(emptyRow);
          return;
        }
        const dataTable = document.getElementById("data-table");
        dataTable.innerHTML = "";
        data.forEach((entry) => {
          console.log(entry);
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${licensePlateNumber}</td>
            <td>${entry.Date}</td>
            <td>${entry.Time}</td>
            <td>${entry.Latitude}</td>
            <td>${entry.Longitude}</td>
            <td>${entry.Ignition}</td>
          `;
          dataTable.appendChild(row);
        });
      })
      .catch((error) => {
        console.error("Error:", error);
        alert(error.message);
      });
  });

  downloadBtn.addEventListener("click", function () {
    const licensePlateNumber = document.getElementById("vehicleSelect").value;
    const fromDate = document.getElementById("fromDate").value;
    const toDate = document.getElementById("toDate").value;

    if (!licensePlateNumber || !fromDate || !toDate) {
      alert("Please fill all fields");
      return;
    }

    fetch("/ignitionReport/download_ignition_report", {
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
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(err.error);
          });
        }
        return response.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Ignition_Report.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((error) => {
        alert(error.message);
      });
  });

  $("#vehicleSelect").selectize({
    create: false,
    sortField: "text",
  });
});
