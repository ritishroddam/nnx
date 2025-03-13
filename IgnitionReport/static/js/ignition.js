$(document).ready(function () {
  $("#searchBtn").on("click", function () {
    const licensePlateNumber = $("#vehicleSelect").val();
    const fromDate = $("#fromDate").val();
    const toDate = $("#toDate").val();

    if (!licensePlateNumber || !fromDate || !toDate) {
      alert("Please fill all fields");
      return;
    }

    $.ajax({
      url: "/ignitionReport/fetch_ignition_report",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        license_plate_number: licensePlateNumber,
        from_date: fromDate,
        to_date: toDate,
      }),
      success: function (response) {
        $("#data-table").html("");
        response.forEach((entry) => {
          $("#data-table").append(`
                        <tr>
                            <td>${licensePlateNumber}</td>
                            <td>${entry.date}</td>
                            <td>${entry.time}</td>
                            <td>${entry.latitude}</td>
                            <td>${entry.longitude}</td>
                            <td>${entry.ignition}</td>
                        </tr>
                    `);
        });
      },
      error: function (xhr) {
        alert(xhr.responseJSON.error);
      },
    });
  });

  $("#downloadBtn").on("click", function () {
    const licensePlateNumber = $("#vehicleSelect").val();
    const fromDate = $("#fromDate").val();
    const toDate = $("#toDate").val();

    if (!licensePlateNumber || !fromDate || !toDate) {
      alert("Please fill all fields");
      return;
    }

    $.ajax({
      url: "/ignitionReport/download_ignition_report",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        license_plate_number: licensePlateNumber,
        from_date: fromDate,
        to_date: toDate,
      }),
      xhrFields: {
        responseType: "blob",
      },
      success: function (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Ignition_Report.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
      error: function (xhr) {
        alert(xhr.responseJSON.error);
      },
    });
  });
});
