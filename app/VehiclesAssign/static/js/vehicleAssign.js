document.addEventListener("DOMContentLoaded", function () {
  const userSelect = $("#users").selectize({
    plugins: ["auto_select_on_type", "clear_button", "restore_on_backspace"],
    placeholder: "Select users...",
    searchField: "text",
    create: false,
    onChange: function (userId) {
      if (userId) {
        fetch(`/vehicleAssign/get_unassigned_vehicles/${userId}`)
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
