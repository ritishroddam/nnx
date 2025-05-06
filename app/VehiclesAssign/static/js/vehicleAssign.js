document.getElementById("assignForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  const vehicleId = document.getElementById("vehicle").value;
  const userIds = Array.from(document.getElementById("users").selectedOptions).map(option => option.value);

  try {
    const response = await fetch("/vehicleAssign/assign_vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicle_id: vehicleId, user_ids: userIds }),
    });

    const result = await response.json();
    const messageDiv = document.getElementById("responseMessage");
    if (result.success) {
      messageDiv.textContent = "Vehicle assigned successfully!";
      messageDiv.style.color = "green";
    } else {
      messageDiv.textContent = `Error: ${result.message}`;
      messageDiv.style.color = "red";
    }
  } catch (error) {
    console.error("Error assigning vehicle:", error);
  }
});