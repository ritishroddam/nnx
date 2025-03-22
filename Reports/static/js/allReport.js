// Get the modal
var modal = document.getElementById("reportModal");

// Get the button that opens the modal
var reportCards = document.querySelectorAll(".report-card");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks on the button, open the modal
reportCards.forEach(function (card) {
  card.onclick = function () {
    modal.style.display = "block";
  };
});

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modal.style.display = "none";
};

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

// Handle cancel button click
document.querySelector(".cancel-btn").onclick = function () {
  modal.style.display = "none";
};

document.addEventListener("DOMContentLoaded", function () {
  const downloadBtn = document.getElementById("generateReport");

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
});
