document.addEventListener("DOMContentLoaded", function () {
  const userSelect = $("#users").selectize({
    plugins: ["restore_on_backspace"],
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
              vehicleDropdown.clearOptions();
              data.vehicles.forEach((vehicle) => {
                vehicleDropdown.addOption({
                  value: vehicle._id,
                  text: vehicle.LicensePlateNumber,
                });
              });
              vehicleDropdown.refreshOptions(false); 
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

  const editModal = document.getElementById("editAssignmentModal");
  const closeEditModal = document.getElementById("closeEditModal");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const editAssignmentForm = document.getElementById("editAssignmentForm");
  const editVehiclesSelect = $("#editVehicles").selectize({
    plugins: ["remove_button"],
    placeholder: "Select vehicles...",
    searchField: "text",
    create: false,
    dropdownParent: "body"
  })[0].selectize;

  // Open modal and preselect assigned vehicles
  document.querySelectorAll(".edit-assignment-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const userId = this.getAttribute("data-user-id");
      document.getElementById("editUserId").value = userId;

      // Get assigned vehicles for this user from the table row
      const row = document.querySelector(`tr[data-user-id='${userId}']`);
      const assignedText = row.querySelector(".assigned-vehicles").textContent;
      const assignedPlates = assignedText.split(",").map(s => s.trim()).filter(Boolean);

      // Map license plates to vehicle IDs using a JS object
      const vehicleOptions = window.vehicleOptions || {};

      // Set selected options in the dropdown
      const selectedIds = assignedPlates.map(plate => vehicleOptions[plate]).filter(Boolean);
      editVehiclesSelect.setValue(selectedIds);

      editModal.style.display = "block";
    });
  });

  // Close modal
  closeEditModal.onclick = cancelEditBtn.onclick = function () {
    editModal.style.display = "none";
  };

  // Save edited assignment
  editAssignmentForm.onsubmit = function (e) {
    e.preventDefault();
    const userId = document.getElementById("editUserId").value;
    const vehicleIds = editVehiclesSelect.getValue();

    fetch("/vehicleAssign/assign_vehicles", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRF-TOKEN": document.querySelector("input[name='csrf_token']").value
      },
      body: `user_ids=${encodeURIComponent(userId)}&vehicle_ids=${vehicleIds.map(id => encodeURIComponent(id)).join("&vehicle_ids=")}`
    })
      .then(res => res.ok ? location.reload() : res.text().then(alert))
      .catch(err => alert("Failed to update assignments"));
  };

});
