document.addEventListener("DOMContentLoaded", function() {
  // Selectize for alerts
  var alertsSelect = document.getElementById('alerts');
  if (alertsSelect) {
    Selectize(alertsSelect, {
      plugins: ['remove_button'],
      create: false,
      sortField: 'text',
      placeholder: 'Select alert types...'
    });
  }
  // Selectize for darkMode
  var darkModeSelect = document.getElementById('darkMode');
  if (darkModeSelect) {
    Selectize(darkModeSelect, {
      create: false,
      sortField: 'text'
    });
  }

  var form = document.getElementById('userConfigForm');
  var saveBtn = document.getElementById('saveConfigBtn');
  var successMsg = document.getElementById('successMsg');
  var errorMsg = document.getElementById('errorMsg');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    successMsg.style.display = "none";
    errorMsg.style.display = "none";
    saveBtn.disabled = true;

    var darkMode = darkModeSelect.value;
    var alerts = Array.from(alertsSelect.selectedOptions).map(opt => opt.value);

    fetch("/userConfig/editConfig", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({ darkMode: darkMode, alerts: alerts })
    })
    .then(response => response.json().then(data => ({status: response.status, body: data})))
    .then(({status, body}) => {
      saveBtn.disabled = false;
      if (status === 200) {
        successMsg.textContent = body.message || "Configuration updated!";
        successMsg.style.display = "block";
      } else {
        errorMsg.textContent = body.error || "Failed to update configuration";
        errorMsg.style.display = "block";
      }
    })
    .catch(() => {
      saveBtn.disabled = false;
      errorMsg.textContent = "Failed to update configuration";
      errorMsg.style.display = "block";
    });
  });
});
