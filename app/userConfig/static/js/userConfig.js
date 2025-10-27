// document.addEventListener("DOMContentLoaded", function() {

//   $("#alerts").selectize({
//       plugins: ['remove_button'],
//       create: false,
//       placeholder: 'Select alert types...',
//       allowEmptyOption: true
//   });

//   $("#darkMode").selectize({
//     create: false,
//     sortField: 'text'
//   });

//   $("#alertsSound").selectize({
//     create: false,
//     sortField: 'text'
//   });

//   var form = document.getElementById('userConfigForm');
//   var saveBtn = document.getElementById('saveConfigBtn');
//   var darkModeSelect = document.getElementById('darkMode');
//   var alertsSoundSelect = document.getElementById('alertsSound');
//   var alertsSelect = document.getElementById('alerts');

//   form.addEventListener('submit', function(e) {
//     e.preventDefault();
//     saveBtn.disabled = true;

//     var darkMode = darkModeSelect.value;
//     var alertsSound = alertsSoundSelect.value;
//     var alerts = Array.from(alertsSelect.selectedOptions).map(opt => opt.value);


//     fetch("/userConfig/editConfig", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "X-CSRF-TOKEN": getCookie("csrf_access_token"),
//       },
//       body: JSON.stringify({ darkMode: darkMode, alerts: alerts, alertsSound: alertsSound })
//     })
//     .then(response => response.json().then(data => ({status: response.status, body: data})))
//     .then(({status, body}) => {
//       saveBtn.disabled = false;
//       if (status === 200) {
//         displayFlashMessage("Configuration updated successfully!", "success");
//       } else {
//         displayFlashMessage("Failed to update configuration", "danger");
//       }
//     })
//     .catch(() => {
//       saveBtn.disabled = false;
//       displayFlashMessage("Failed to update configuration", "danger");
//     });
//   });

//   const noneOption = alertsSelect.querySelector('option[value=""]');

//   alertsSelect.addEventListener('change', function(e) {
//     if (noneOption.selected) {
//       for (let opt of alertsSelect.options) {
//         if (opt.value !== "") opt.selected = false;
//       }
//     } else {
//       noneOption.selected = false;
//     }
//   });

// });

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

  // Email Configuration Elements
  var emailConfigBtn = document.getElementById('emailConfigBtn');
  var emailConfigModal = document.getElementById('emailConfigModal');
  var closeModal = document.querySelector('.close');
  var cancelEmailsBtn = document.getElementById('cancelEmailsBtn');
  var saveEmailsBtn = document.getElementById('saveEmailsBtn');
  var emailInput = document.getElementById('emailInput');
  var emailTagsContainer = document.getElementById('emailTagsContainer');
  var emailAlertTypesContainer = document.getElementById('emailAlertTypes');

  // Store current alert configuration
  var currentAlertTypes = [];
  var currentEmailAlertTypes = [];

  // Load alert configuration when page loads
  loadAlertConfig();

  function loadAlertConfig() {
    fetch("/userConfig/getAlertConfig", {
      method: "GET",
      headers: {
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      }
    })
    .then(response => response.json())
    .then(data => {
      currentAlertTypes = data.alerts || [];
      currentEmailAlertTypes = data.emailAlertTypes || [];
    })
    .catch(error => {
      console.error("Failed to load alert configuration:", error);
    });
  }

  // Open Email Config Modal
  emailConfigBtn.addEventListener('click', function() {
    // Populate textarea with existing emails
    const existingEmails = Array.from(emailTagsContainer.querySelectorAll('.email-tag'))
      .map(tag => tag.textContent.replace('×', '').trim());
    emailInput.value = existingEmails.join(', ');
    
    // Populate alert type checkboxes
    populateAlertTypeCheckboxes();
    
    emailConfigModal.style.display = 'block';
  });

  // Populate alert type checkboxes
  function populateAlertTypeCheckboxes() {
    emailAlertTypesContainer.innerHTML = '';
    
    if (currentAlertTypes.length === 0) {
      emailAlertTypesContainer.innerHTML = '<p class="no-alerts-warning">No alert types configured. Please configure alerts first.</p>';
      return;
    }
    
    currentAlertTypes.forEach(alertType => {
      const checkboxDiv = document.createElement('div');
      checkboxDiv.className = 'alert-type-checkbox';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `email_${alertType}`;
      checkbox.value = alertType;
      checkbox.checked = currentEmailAlertTypes.includes(alertType);
      
      const label = document.createElement('label');
      label.htmlFor = `email_${alertType}`;
      label.textContent = alertType.replace('_', ' ').title();
      
      checkboxDiv.appendChild(checkbox);
      checkboxDiv.appendChild(label);
      emailAlertTypesContainer.appendChild(checkboxDiv);
    });
  }

  // Get selected alert types for emails
  function getSelectedEmailAlertTypes() {
    const checkboxes = emailAlertTypesContainer.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  // Close Modal
  function closeEmailModal() {
    emailConfigModal.style.display = 'none';
  }

  closeModal.addEventListener('click', closeEmailModal);
  cancelEmailsBtn.addEventListener('click', closeEmailModal);

  // Save Emails
  saveEmailsBtn.addEventListener('click', function() {
    const emailText = emailInput.value;
    const emails = emailText.split(',')
      .map(email => email.trim())
      .filter(email => email !== '');

    const selectedAlertTypes = getSelectedEmailAlertTypes();

    // Save emails and alert types to server
    fetch("/userConfig/editEmailConfig", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({ 
        emails: emails,
        alert_types: selectedAlertTypes 
      })
    })
    .then(response => response.json().then(data => ({status: response.status, body: data})))
    .then(({status, body}) => {
      if (status === 200) {
        // Update email tags display
        updateEmailTags(body.emails || []);
        currentEmailAlertTypes = body.alert_types || [];
        displayFlashMessage("Email configuration updated successfully!", "success");
        closeEmailModal();
        // Reload page to show updated alert types
        setTimeout(() => location.reload(), 1000);
      } else {
        displayFlashMessage("Failed to update email configuration", "danger");
      }
    })
    .catch(() => {
      displayFlashMessage("Failed to update email configuration", "danger");
    });
  });

  // Update email tags display
  function updateEmailTags(emails) {
    emailTagsContainer.innerHTML = '';
    emails.forEach(email => {
      const emailTag = document.createElement('span');
      emailTag.className = 'email-tag';
      emailTag.innerHTML = `
        ${email}
        <span class="email-tag-remove" data-email="${email}">×</span>
      `;
      emailTagsContainer.appendChild(emailTag);
    });

    // Add event listeners to remove buttons
    emailTagsContainer.querySelectorAll('.email-tag-remove').forEach(btn => {
      btn.addEventListener('click', function() {
        const emailToRemove = this.getAttribute('data-email');
        removeEmail(emailToRemove);
      });
    });
  }

  // Remove individual email
  function removeEmail(emailToRemove) {
    const currentEmails = Array.from(emailTagsContainer.querySelectorAll('.email-tag'))
      .map(tag => tag.textContent.replace('×', '').trim())
      .filter(email => email !== emailToRemove);

    // Update on server
    fetch("/userConfig/editEmailConfig", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({ 
        emails: currentEmails,
        alert_types: currentEmailAlertTypes 
      })
    })
    .then(response => response.json().then(data => ({status: response.status, body: data})))
    .then(({status, body}) => {
      if (status === 200) {
        updateEmailTags(body.emails || []);
        displayFlashMessage("Email removed successfully!", "success");
      } else {
        displayFlashMessage("Failed to remove email", "danger");
      }
    })
    .catch(() => {
      displayFlashMessage("Failed to remove email", "danger");
    });
  }

  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === emailConfigModal) {
      closeEmailModal();
    }
  });

  // Update currentAlertTypes when alerts are changed
  alertsSelect.addEventListener('change', function() {
    currentAlertTypes = Array.from(alertsSelect.selectedOptions)
      .map(opt => opt.value)
      .filter(value => value !== ""); // Exclude the "None" option
  });

  // Existing form submission code
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
        // Reload alert config
        loadAlertConfig();
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

});