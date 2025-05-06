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
});
