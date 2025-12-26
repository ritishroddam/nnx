document.addEventListener("DOMContentLoaded", function() {

  $("#alerts").selectize({
      plugins: ['remove_button'],
      create: false,
      placeholder: 'Select alert types...',
      allowEmptyOption: true
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

  var emailModal = document.getElementById('emailModal');
  var emailConfigBtn = document.getElementById('emailConfigBtn');
  var closeModalBtn = document.getElementById('closeModal');
  var cancelModalBtn = document.getElementById('cancelModal');
  var emailConfigForm = document.getElementById('emailConfigForm');
  var saveEmailsBtn = document.getElementById('saveEmailsBtn');
  var existingEmailsContainer = document.getElementById('existingEmails');

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
    if (noneOption.selected) {
      for (let opt of alertsSelect.options) {
        if (opt.value !== "") opt.selected = false;
      }
    } else {
      noneOption.selected = false;
    }
  });

  emailConfigBtn.addEventListener('click', function() {
    emailModal.style.display = 'flex';
  });

  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  emailModal.addEventListener('click', function(e) {
    if (e.target === emailModal) {
      closeModal();
    }
  });

  emailConfigForm.addEventListener('submit', function(e) {
    e.preventDefault();
    saveEmailsBtn.disabled = true;

    var emailsInput = document.getElementById('emailInput').value;

    fetch("/userConfig/updateAlertEmails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({ emails: emailsInput })
    })
    .then(response => response.json().then(data => ({status: response.status, body: data})))
    .then(({status, body}) => {
      saveEmailsBtn.disabled = false;
      if (status === 200) {
        displayFlashMessage("Email configuration updated successfully!", "success");
        updateExistingEmails(body.emails);
        closeModal();
      } else {
        displayFlashMessage("Failed to update email configuration", "danger");
      }
    })
    .catch(() => {
      saveEmailsBtn.disabled = false;
      displayFlashMessage("Failed to update email configuration", "danger");
    });
  });

  existingEmailsContainer.addEventListener('click', function(e) {
    if (e.target.classList.contains('email-remove')) {
      var emailTag = e.target.parentElement;
      var email = e.target.getAttribute('data-email');
      
      removeEmail(email, emailTag);
    }
  });

  function closeModal() {
    emailModal.style.display = 'none';
    document.getElementById('emailInput').value = '';
  }

  function updateExistingEmails(emails) {
    existingEmailsContainer.innerHTML = '';
    emails.forEach(function(email) {
      var emailTag = document.createElement('span');
      emailTag.className = 'email-tag';
      emailTag.innerHTML = `
        ${email}
        <span class="email-remove" data-email="${email}">×</span>
      `;
      existingEmailsContainer.appendChild(emailTag);
    });
  }

  function removeEmail(email, emailTag) {
    fetch("/userConfig/removeAlertEmail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({ email: email })
    })
    .then(response => response.json().then(data => ({status: response.status, body: data})))
    .then(({status, body}) => {
      if (status === 200) {
        emailTag.remove();
        displayFlashMessage("Email removed successfully!", "success");
      } else {
        displayFlashMessage("Failed to remove email", "danger");
      }
    })
    .catch(() => {
      displayFlashMessage("Failed to remove email", "danger");
    });
  }
});