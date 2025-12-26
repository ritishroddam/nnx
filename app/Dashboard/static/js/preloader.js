document.addEventListener("DOMContentLoaded", function () {
  const preloaderContainer = document.createElement("div");
  preloaderContainer.classList.add("preloader-overlay");
  preloaderContainer.innerHTML = `
    <div class="ccontainer">
      <div class="text">
        CORDON <span style="color: aqua"> nX </span>
      </div>
    </div>
  `;

  document.body.appendChild(preloaderContainer);

  document.body.style.filter = "blur(5px)";

  function checkConnection() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 2000);
    });
  }

  checkConnection().then((isConnected) => {
    if (isConnected) {
      document.body.style.filter = "blur(0)";
      preloaderContainer.classList.add("clear-blur");

      setTimeout(() => {
        preloaderContainer.classList.add("preloader-hidden");
        preloaderContainer.classList.add("preloader-move-out");
      }, 3000); 
    }
  });

  const styleElement = document.createElement("style");
  styleElement.innerHTML = `
    .preloader-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: rgba(0, 0, 0, 0.8); /* Dark transparent background */
      z-index: 9999; /* Ensure it is on top of everything */
      transition: left 1s ease-in-out; /* Smooth transition for movement */
    }

    .ccontainer {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .preloader {
      width: 100px;
      height: 100px;
      background-color: #fff; /* Dummy background */
      z-index: 2;
    }

  @font-face {
        font-family: "Ethnocentric";
        src: url("/static/font/ethnocentric-cdnfonts/ethnocentricrg.ttf")
          format("truetype");
      }
          
    .text {
      font-size: 36px;
      font-family: ethnocentric;
      color: #fff;
      letter-spacing: 8px;
      position: relative;
      z-index: 1;
      clip-path: inset(0 100% 0 0);
      animation: revealText 1s ease-in-out 2.5s forwards;
      margin-right: 10px;
    }

    @keyframes revealText {
      0% {
        clip-path: inset(0 100% 0 0);
      }
      100% {
        clip-path: inset(0 0 0 0);
      }
    }

    /* Hide preloader after animation */
    .preloader-hidden {
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.5s ease-in-out;
    }

    /* Move the preloader out of view after the delay */
    .preloader-move-out {
      left: -200vw; /* Push the preloader far to the left */
    }

    /* Remove blur effect */
    .clear-blur {
      filter: blur(0);
    }
  `;

  document.head.appendChild(styleElement);
});
