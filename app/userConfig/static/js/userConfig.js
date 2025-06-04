document.addEventListener("DOMContentLoaded", function() {
  // Selectize for alerts

  $("#alerts").selectize({
      plugins: ['remove_button'],
      create: false,
      sortField: 'text',
      placeholder: 'Select alert types...'
  });

  $("#darkMode").selectize({
    create: false,
    sortField: 'text'
  });

  $("#alertsSound").selectize({
    create: false,
    sortField: 'text'
  });

  var form = document.getElementById('userConfigForm');
  var saveBtn = document.getElementById('saveConfigBtn');
  var darkModeSelect = document.getElementById('darkMode');
  var alertsSoundSelect = document.getElementById('alertsSound');
  var alertsSelect = document.getElementById('alerts');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    saveBtn.disabled = true;

    var darkMode = darkModeSelect.value;
    var alertsSound = alertsSoundSelect.value;
    var alerts = Array.from(alertsSelect.selectedOptions).map(opt => opt.value);


    fetch("/userConfig/editConfig", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({ darkMode: darkMode, alerts: alerts, alertsSound: alertsSound })
    })
    .then(response => response.json().then(data => ({status: response.status, body: data})))
    .then(({status, body}) => {
      saveBtn.disabled = false;
      if (status === 200) {
        displayFlashMessage("Configuration updated successfully!", "success");
      } else {
        displayFlashMessage("Failed to update configuration", "danger");
      }
    })
    .catch(() => {
      saveBtn.disabled = false;
      displayFlashMessage("Failed to update configuration", "danger");
    });
  });

  const noneOption = alertsSelect.querySelector('option[value=""]');

  alertsSelect.addEventListener('change', function(e) {
    // If "None" is selected, unselect all others
    if (noneOption.selected) {
      for (let opt of alertsSelect.options) {
        if (opt.value !== "") opt.selected = false;
      }
    } else {
      // If any other is selected, unselect "None"
      noneOption.selected = false;
    }
  });

});
