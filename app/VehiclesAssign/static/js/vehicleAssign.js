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
      const row = document.querySelector(`tr[data-user-id='${userId}']`);
      const assignedSpan = row.querySelector(".assigned-vehicles");
      const select = row.querySelector(".edit-vehicles-select");
      const saveBtn = row.querySelector(".save-assignment-btn");
      const cancelBtn = row.querySelector(".cancel-assignment-btn");

      // Hide span, show select
      assignedSpan.style.display = "none";
      select.style.display = "inline-block";
      this.style.display = "none";
      saveBtn.style.display = "inline-block";
      cancelBtn.style.display = "inline-block";

      // Preselect assigned vehicles
      const assignedPlates = assignedSpan.textContent.split(",").map(s => s.trim()).filter(Boolean);
      const vehicleOptions = window.vehicleOptions || {};
      const selectedIds = assignedPlates.map(plate => vehicleOptions[plate]).filter(Boolean);
      Array.from(select.options).forEach(opt => {
        opt.selected = selectedIds.includes(opt.value);
      });
    });
  });

  document.querySelectorAll(".cancel-assignment-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const userId = this.getAttribute("data-user-id");
      const row = document.querySelector(`tr[data-user-id='${userId}']`);
      row.querySelector(".assigned-vehicles").style.display = "inline";
      row.querySelector(".edit-vehicles-select").style.display = "none";
      row.querySelector(".edit-assignment-btn").style.display = "inline-block";
      row.querySelector(".save-assignment-btn").style.display = "none";
      row.querySelector(".cancel-assignment-btn").style.display = "none";
    });
  });

  document.querySelectorAll(".save-assignment-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const userId = this.getAttribute("data-user-id");
      const row = document.querySelector(`tr[data-user-id='${userId}']`);
      const select = row.querySelector(".edit-vehicles-select");
      const vehicleIds = Array.from(select.selectedOptions).map(opt => opt.value);

      fetch("/vehicleAssign/assign_vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRF-TOKEN": document.querySelector("input[name='csrf_token']").value
        },
        body: `user_id=${encodeURIComponent(userId)}&vehicle_ids=${vehicleIds.map(id => encodeURIComponent(id)).join("&vehicle_ids=")}`
      })
        .then(res => res.ok ? location.reload() : res.text().then(alert))
        .catch(err => alert("Failed to update assignments"));
    });
  });

});
