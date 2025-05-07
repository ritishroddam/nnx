document.addEventListener("DOMContentLoaded", function () {
  const userSelect = $("#users").selectize({
    plugins: ["remove_button"],
    placeholder: "Select users...",
    searchField: "text",
    create: false,
    onChange: function (userId) {
      if (userId) {
        fetch(`/VehicleAssign/get_unassigned_vehicles/${userId}`)
          .then((response) => response.json())
          .then((data) => {
            if (data.vehicles) {
              const vehicleDropdown = vehicleSelect[0].selectize;
              vehicleDropdown.clearOptions(); // Clear existing options
              data.vehicles.forEach((vehicle) => {
                vehicleDropdown.addOption({
                  value: vehicle._id,
                  text: vehicle.LicensePlateNumber,
                });
              });
              vehicleDropdown.refreshOptions(false); // Refresh the dropdown
            }
          })
          .catch((error) => {
            console.error("Error fetching unassigned vehicles:", error);
          });
      }
    },
  });

  const vehicleSelect = $("#vehicles").selectize({
    plugins: ["remove_button"],
    placeholder: "Select vehicles...",
    searchField: "text",
    create: false,
  });
});
