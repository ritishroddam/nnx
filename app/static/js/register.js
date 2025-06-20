document.addEventListener("DOMContentLoaded", function () {
  $("select").selectize({
    create: false,
    sortField: "text",
  });
});

document.addEventListener("DOMContentLoaded", function () {
  $("select").selectize({ create: false, sortField: "text" });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const row = this.closest("tr");
      row.querySelectorAll(".editable").forEach((cell) => {
        const input = document.createElement("input");
        input.value = cell.textContent;
        input.setAttribute("data-field", cell.dataset.field);
        cell.innerHTML = "";
        cell.appendChild(input);
      });
      row.querySelector(".edit-btn").style.display = "none";
      row.querySelector(".save-btn").style.display = "inline-block";
    });
  });

  document.querySelectorAll(".save-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const row = this.closest("tr");
      const id = row.getAttribute("data-id");
      const data = {};
      row.querySelectorAll("input").forEach((input) => {
        data[input.dataset.field] = input.value;
      });

      fetch(`/update-client/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.success) {
            row.querySelectorAll(".editable").forEach((cell) => {
              const input = cell.querySelector("input");
              cell.textContent = input.value;
            });
            row.querySelector(".edit-btn").style.display = "inline-block";
            row.querySelector(".save-btn").style.display = "none";
          } else {
            alert("Update failed.");
          }
        });
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const row = this.closest("tr");
      const id = row.getAttribute("data-id");

      if (confirm("Are you sure you want to delete this client?")) {
        fetch(`/delete-client/${id}`, {
          method: "DELETE",
        })
          .then((res) => res.json())
          .then((res) => {
            if (res.success) row.remove();
            else alert("Delete failed.");
          });
      }
    });
  });
});
