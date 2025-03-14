$(document).ready(function () {
  function formatTimeTo12Hour(time24) {
    const [hour, minute] = time24.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
  }

  function convertDateToISO(date) {
    // Convert DD-MM-YYYY to YYYY-MM-DD
    const [day, month, year] = date.split("-").map(Number);
    return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  }

  function fetchData(query = "") {
    $("#data-table").html('<tr><td colspan="6">Loading...</td></tr>'); // Show a loading message

    $.ajax({
      url: "/search",
      method: "GET",
      data: { search_query: query },
      success: function (response) {
        $("#data-table").html(""); // Clear the table content

        if (response.data.length > 0) {
          // Sort data by date and time (latest first)
          response.data.sort((a, b) => {
            const dateTimeA = new Date(`${convertDateToISO(a.date)} ${a.time}`);
            const dateTimeB = new Date(`${convertDateToISO(b.date)} ${b.time}`);
            return dateTimeB - dateTimeA; // Latest first
          });

          // Render sorted data
          response.data.forEach((entry) => {
            $("#data-table").append(`
                            <tr>
                                <td>${entry.vehicle_number}</td>
                                <td>${entry.date}</td>
                                <td>${formatTimeTo12Hour(entry.time)}</td>
                                <td>${entry.latitude}</td>
                                <td>${entry.longitude}</td>
                                <td>${entry.speed}</td>
                            </tr>
                        `);
          });
        } else {
          $("#data-table").html('<tr><td colspan="6">No data found</td></tr>'); // No data message
        }
      },
      error: function () {
        $("#data-table").html(
          '<tr><td colspan="6">Error fetching data</td></tr>'
        ); // Error message
        console.error("Error fetching data");
      },
    });
  }

  // Fetch all data initially
  fetchData();

  // Fetch data on input change
  $("#search").on("input", function () {
    const query = $(this).val().trim();
    fetchData(query);
  });

  // Handle download button click
  $("#download").on("click", function () {
    const searchQuery = $("#search").val().trim();
    const url = `/download?search_query=${encodeURIComponent(searchQuery)}`;
    window.location.href = url; // Trigger file download
  });
});
