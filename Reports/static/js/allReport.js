// Get the modal
var modal = document.getElementById("reportModal");

// Get the button that opens the modal
var reportCards = document.querySelectorAll(".report-card");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks on the button, open the modal
reportCards.forEach(function (card) {
  card.onclick = function () {
    modal.style.display = "block";
  };
});

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modal.style.display = "none";
};

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

// Handle cancel button click
document.querySelector(".cancel-btn").onclick = function () {
  modal.style.display = "none";
};

document.addEventListener("DOMContentLoaded", function () {
  $("select").selectize({
    create: false,
    sortField: "text",
  });
});
