function setCookie(name, value) {
  document.cookie = `${name}=${value};path=/`;
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

document.addEventListener("DOMContentLoaded", function () {
  // Add any client-side JavaScript functionality here
  console.log("Application loaded");
});
