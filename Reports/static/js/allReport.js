 var modal = document.getElementById("reportModal");

 var reportCards = document.querySelectorAll(".report-card");

 var span = document.getElementsByClassName("close")[0];

 reportCards.forEach(function(card) {
     card.onclick = function() {
         modal.style.display = "block";
     }
 });

 span.onclick = function() {
     modal.style.display = "none";
 }

 window.onclick = function(event) {
     if (event.target == modal) {
         modal.style.display = "none";
     }
 }