// document.addEventListener("DOMContentLoaded", function () {
//   let dropdowns = document.querySelectorAll(".dropdown");

//   dropdowns.forEach((dropdown) => {
//     dropdown.addEventListener("click", function (event) {
//       event.stopPropagation(); // Prevents hover conflict

//       let submenu = this.querySelector(".submenu");
//       let arrow = this.querySelector(".arrow");

//       // Close all other submenus before opening the clicked one
//       document.querySelectorAll(".submenu").forEach((item) => {
//         if (item !== submenu) {
//           item.style.display = "none";
//         }
//       });

//       // Close all other arrows
//       document.querySelectorAll(".arrow").forEach((item) => {
//         if (item !== arrow) {
//           item.classList.remove("rotate");
//         }
//       });

//       // Toggle current submenu
//       if (submenu.style.display === "block") {
//         submenu.style.display = "none";
//       } else {
//         submenu.style.display = "block";
//       }

//       // Rotate arrow
//       arrow.classList.toggle("rotate");
//     });
//   });

//   // Close dropdowns if clicked outside
//   document.addEventListener("click", function () {
//     document.querySelectorAll(".submenu").forEach((submenu) => {
//       submenu.style.display = "none";
//     });

//     document.querySelectorAll(".arrow").forEach((arrow) => {
//       arrow.classList.remove("rotate");
//     });
//   });
// });

document.addEventListener("DOMContentLoaded", function () {
  const themeToggle = document.getElementById("theme-toggle");
  const body = document.body;

  themeToggle.addEventListener("click", function () {
    body.classList.toggle("dark-mode");
    themeToggle.classList.toggle("dark");

    if (body.classList.contains("dark-mode")) {
      themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
      themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
  });
});
