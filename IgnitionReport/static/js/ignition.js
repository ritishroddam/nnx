document.addEventListener("DOMContentLoaded", function () {
  const searchBtn = document.getElementById("searchBtn");
  const downloadBtn = document.getElementById("downloadBtn");

  // searchBtn.addEventListener("click", function () {
  //   const licensePlateNumber = document.getElementById("vehicleSelect").value;
  //   const fromDate = document.getElementById("fromDate").value;
  //   const toDate = document.getElementById("toDate").value;

  //   if (!licensePlateNumber || !fromDate || !toDate) {
  //     alert("Please fill all fields");
  //     return;
  //   }

  //   fetch("/ignitionReport/fetch_ignition_report", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       license_plate_number: licensePlateNumber,
  //       from_date: fromDate,
  //       to_date: toDate,
  //     }),
  //   })
  //     .then((response) => {
  //       if (!response.ok) {
  //         return response.json().then((err) => {
  //           throw new Error(err.error);
  //         });
  //       }
  //       return response.json();
  //     })
  //     .then((data) => {
  //       console.log("API Response:", data);
  //       const dataTable = document.getElementById("data-table");
  //       dataTable.innerHTML = "";
  //       data.forEach((entry) => {
  //         console.log(entry);
  //         const row = document.createElement("tr");
  //         row.innerHTML = `
  //           <td>${licensePlateNumber}</td>
  //           <td>${entry.Date}</td>
  //           <td>${entry.Time}</td>
  //           <td>${entry.Latitude}</td>
  //           <td>${entry.Longitude}</td>
  //           <td>${entry.Ignition}</td>
  //         `;
  //         dataTable.appendChild(row);
  //       });
  //     })
  //     .catch((error) => {
  //       console.error("Error:", error);
  //       alert(error.message);
  //     });
  // });

  searchBtn.addEventListener("click", function () {
    const licensePlateNumber = document.getElementById("vehicleSelect").value;
    const fromDate = document.getElementById("fromDate").value;
    const toDate = document.getElementById("toDate").value;

    if (!licensePlateNumber || !fromDate || !toDate) {
      displayFlashMessage("Please fill all fields", "danger");
      return;
    }

    fetch("/fetch_ignition_report", {
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
        if (data.flashed_messages) {
          data.flashed_messages.forEach(([category, message]) => {
            displayFlashMessage(message, category);
          });
        } else {
          console.log("API Response:", data);
          // Handle successful data rendering here
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  });

  function displayFlashMessage(message, category) {
    const flashContainer = document.getElementById("flash-container");
    const flashMessage = document.createElement("div");
    flashMessage.className = `alert alert-${category}`;
    flashMessage.textContent = message;
    flashContainer.appendChild(flashMessage);

    // Automatically remove the flash message after 5 seconds
    setTimeout(() => {
      flashMessage.remove();
    }, 5000);
  }

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
});
