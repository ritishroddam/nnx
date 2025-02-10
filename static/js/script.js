

document.addEventListener("DOMContentLoaded", function () {
    let dropdowns = document.querySelectorAll(".dropdown");

    dropdowns.forEach((dropdown) => {
        dropdown.addEventListener("click", function (event) {
            event.stopPropagation(); // Prevents hover conflict
            let submenu = this.querySelector(".submenu");
            let arrow = this.querySelector(".arrow");

            if (submenu.style.display === "block") {
                submenu.style.display = "none";
            } else {
                submenu.style.display = "block";
            }

            arrow.classList.toggle("rotate");
        });
    });
});

document.addEventListener("DOMContentLoaded", function () {
    let dropdowns = document.querySelectorAll(".dropdown");

    dropdowns.forEach((dropdown) => {
        dropdown.addEventListener("click", function (event) {
            event.stopPropagation(); // Prevents hover conflict
            let submenu = this.querySelector(".submenu");
            let arrow = this.querySelector(".arrow");

            if (submenu.style.display === "block") {
                submenu.style.display = "none";
            } else {
                submenu.style.display = "block";
            }

            arrow.classList.toggle("rotate");
        });
    });
});

