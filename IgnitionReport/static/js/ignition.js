$(document).ready(function () {
    function fetchData(query = '') {
        $.ajax({
            url: "/ignitionReport/search",
            method: "GET",
            data: { search_query: query },
            success: function (response) {
                $('#data-table').html('');
                response.data.forEach(entry => {
                    $('#data-table').append(`
                        <tr>
                            <td>${entry.vehicle_number}</td>
                            <td>${entry.date}</td>
                            <td>${entry.time}</td>
                            <td>${entry.latitude}</td>
                            <td>${entry.longitude}</td>
                            <td>${entry.ignition}</td>
                        </tr>
                    `);
                });
            },
            error: function () {
                console.error('Error fetching data');
            }
        });
    }

    // Fetch all data initially
    fetchData();

    // Fetch data on input change
    $('#search').on('input', function () {
        const query = $(this).val().trim();
        fetchData(query);
    });

    // Handle download button click
    $('#download').on('click', function () {
        const searchQuery = $('#search').val().trim();
        const url = `/ignitionReport/download?search_query=${encodeURIComponent(searchQuery)}`;
        window.location.href = url; // Trigger file download
    });
});