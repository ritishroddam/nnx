document.addEventListener("DOMContentLoaded", function () {
  // Initialize Selectize for multi-select with search
  $("#vehicles").selectize({
    plugins: ["remove_button"],
    placeholder: "Select vehicles...",
    searchField: "text",
    create: false,
  });

  $("#users").selectize({
    plugins: ["remove_button"],
    placeholder: "Select users...",
    searchField: "text",
    create: false,
  });

  // Handle form submission
  document
    .getElementById("assignForm")
    .addEventListener("submit", async function (event) {
      event.preventDefault();

      const vehicleIds = Array.from(
        document.getElementById("vehicles").selectedOptions
      ).map((option) => option.value);
      const userIds = Array.from(
        document.getElementById("users").selectedOptions
      ).map((option) => option.value);

      try {
        const response = await fetch("/vehicleAssign/assign_vehicles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": getCookie("csrf_access_token"),
          },
          body: JSON.stringify({ vehicle_ids: vehicleIds, user_ids: userIds }),
        });

        const result = await response.json();
        const messageDiv = document.getElementById("responseMessage");
        if (result.success) {
          messageDiv.textContent = "Vehicles assigned successfully!";
          messageDiv.style.color = "green";
        } else {
          messageDiv.textContent = `Error: ${result.message}`;
          messageDiv.style.color = "red";
        }
      } catch (error) {
        console.error("Error assigning vehicles:", error);
      }
    });
});
