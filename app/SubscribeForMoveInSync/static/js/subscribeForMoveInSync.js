document.addEventListener("DOMContentLoaded", () => {
  initToggle();
  initSelectize();
  wireForms();
});

function initToggle() {
  const buttons = document.querySelectorAll(".toggle-btn");
  const panels = document.querySelectorAll(".panel");
  const toggleBar = document.querySelector(".toggle-bar");
  if (!buttons.length || !toggleBar) return;

  const setActivePanel = (targetId) => {
    buttons.forEach((b) => b.classList.toggle("active", b.dataset.target === targetId));
    panels.forEach((panel) => panel.classList.toggle("active", panel.id === targetId));
  };

  const flipPanels = () => {
    const activeBtn = document.querySelector(".toggle-btn.active");
    const nextBtn = Array.from(buttons).find((btn) => btn !== activeBtn);
    if (nextBtn) setActivePanel(nextBtn.dataset.target);
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      if (btn.classList.contains("active")) {
        flipPanels();
      } else {
        setActivePanel(btn.dataset.target);
      }
    });
  });

  toggleBar.addEventListener("click", (event) => {
    if (!event.target.closest(".toggle-btn")) {
      flipPanels();
    }
  });
}

function initSelectize() {
  if (!window.$ || !$.fn.selectize) return;

  $("#subscribeVehiclesSelect, #unsubscribeVehiclesSelect").selectize({
    plugins: ["remove_button"],
    placeholder: "Select vehicles...",
    searchField: "text",
    create: false,
  });

  $("#subscribeCompanySelect, #unsubscribeCompanySelect").selectize({
    placeholder: "Select company...",
    searchField: "text",
    create: false,
  });
}

function wireForms() {
  const cfg = window.moveInSyncConfig || {};
  const formConfigs = [
    {
      id: "subscribeVehiclesForm",
      url: cfg.subscribeUrl,
      requiresVehicle: true,
    },
    {
      id: "subscribeCompanyForm",
      url: cfg.subscribeUrl,
      requiresCompany: true,
    },
    {
      id: "unsubscribeVehiclesForm",
      url: cfg.unsubscribeUrl,
      requiresVehicle: true,
    },
    {
      id: "unsubscribeCompanyForm",
      url: cfg.unsubscribeUrl,
      requiresCompany: true,
    },
  ];

  formConfigs.forEach((entry) => {
    const form = document.getElementById(entry.id);
    if (!form || !entry.url) return;

    form.addEventListener("submit", (event) => {
      handleMoveInSyncSubmit(event, entry);
    });
  });
}

async function handleMoveInSyncSubmit(event, options) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  if (options.requiresVehicle) {
    const vehicles = formData.getAll("vehicleNumbers").filter(Boolean);
    if (!vehicles.length) {
      displayFlashMessage("Select at least one vehicle.", "warning");
      return;
    }
  }

  if (options.requiresCompany) {
    const company = (formData.get("companyName") || "").trim();
    if (!company) {
      displayFlashMessage("Select a company first.", "warning");
      return;
    }
  }

  const submitBtn = form.querySelector("button[type='submit']");
  setButtonState(submitBtn, true);

  try {
    const response = await fetch(options.url, {
      method: "POST",
      headers: {
        "X-CSRF-TOKEN": getCookie("csrf_access_token") || "",
      },
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
      displayFlashMessage(payload.message || "Request completed.", "success");
      setTimeout(() => window.location.reload(), 1200);
    } else {
      displayFlashMessage(
        payload.message || payload.error || `Request failed (${response.status})`,
        "danger"
      );
    }
  } catch (error) {
    console.error("MoveInSync action failed:", error);
    displayFlashMessage("Unexpected error while processing request.", "danger");
  } finally {
    setButtonState(submitBtn, false);
  }
}

function setButtonState(button, loading) {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = "Processing...";
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || "Submit";
    button.disabled = false;
  }
}