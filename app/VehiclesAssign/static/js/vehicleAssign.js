document.addEventListener("DOMContentLoaded", function () {
  // Main user and vehicle selectize for the assignment form
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

  // Initialize Selectize for all inline edit dropdowns
  document.querySelectorAll('.edit-vehicles-select').forEach(function(select) {
    $(select).selectize({
      plugins: ["remove_button"],
      placeholder: "Select vehicles...",
      searchField: "text",
      create: false,
      dropdownParent: "body"
    });
    const selectizeControl = select.parentElement.querySelector('.selectize-control');
    if (selectizeControl) selectizeControl.style.display = "none";
  });

  // Inline editing logic
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
      select.parentElement.querySelector('.selectize-control').style.display = "inline-block";
      select.style.display = "none"; // hide the original select
      this.style.display = "none";
      saveBtn.style.display = "inline-block";
      cancelBtn.style.display = "inline-block";

      // Preselect assigned vehicles
      const assignedPlates = assignedSpan.textContent.split(",").map(s => s.trim()).filter(Boolean);
      const vehicleOptions = window.vehicleOptions || {};
      const selectedIds = assignedPlates.map(plate => vehicleOptions[plate]).filter(Boolean);

      // Set selectize value
      const selectize = $(select)[0].selectize;
      selectize.setValue(selectedIds, true);
    });
  });

  document.querySelectorAll(".cancel-assignment-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const userId = this.getAttribute("data-user-id");
      const row = document.querySelector(`tr[data-user-id='${userId}']`);
      row.querySelector(".assigned-vehicles").style.display = "inline";
      row.querySelector(".edit-assignment-btn").style.display = "inline-block";
      row.querySelector(".save-assignment-btn").style.display = "none";
      row.querySelector(".cancel-assignment-btn").style.display = "none";
      // Hide selectize control
      const select = row.querySelector(".edit-vehicles-select");
      select.parentElement.querySelector('.selectize-control').style.display = "none";
    });
  });

  document.querySelectorAll(".save-assignment-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const userId = this.getAttribute("data-user-id");
      const row = document.querySelector(`tr[data-user-id='${userId}']`);
      const select = row.querySelector(".edit-vehicles-select");
      const selectize = $(select)[0].selectize;
      const vehicleIds = selectize.getValue();

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