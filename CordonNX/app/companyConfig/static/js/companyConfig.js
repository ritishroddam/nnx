document.addEventListener('DOMContentLoaded', function() {

    var form = document.getElementById('companyConfigForm');
    var saveBtn = document.getElementById('saveConfigBtn');
    ['bus', "sedan", "hatchback", "suv", "van", "truck", "bike"]
    var busSlowSpeed = document.getElementById('busSlowSpeed');
    var busNormalSpeed = document.getElementById('busNormalSpeed');
    var sedanSlowSpeed = document.getElementById('sedanSlowSpeed');
    var sedanNormalSpeed = document.getElementById('sedanNormalSpeed');
    var hatchbackSlowSpeed = document.getElementById('hatchbackSlowSpeed');
    var hatchbackNormalSpeed = document.getElementById('hatchbackNormalSpeed');
    var suvSlowSpeed = document.getElementById('suvSlowSpeed');
    var suvNormalSpeed = document.getElementById('suvNormalSpeed');
    var vanSlowSpeed = document.getElementById('vanSlowSpeed');
    var vanNormalSpeed = document.getElementById('vanNormalSpeed');
    var truckSlowSpeed = document.getElementById('truckSlowSpeed');
    var truckNormalSpeed = document.getElementById('truckNormalSpeed');
    var bikeSlowSpeed = document.getElementById('bikeSlowSpeed');
    var bikeNormalSpeed = document.getElementById('bikeNormalSpeed');

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        saveBtn.disabled = true;

        var busSlowSpeedValue = busSlowSpeed.value;
        var busNormalSpeedValue = busNormalSpeed.value;
        var sedanSlowSpeedValue = sedanSlowSpeed.value;
        var sedanNormalSpeedValue = sedanNormalSpeed.value;
        var hatchbackSlowSpeedValue = hatchbackSlowSpeed.value;
        var hatchbackNormalSpeedValue = hatchbackNormalSpeed.value;
        var suvSlowSpeedValue = suvSlowSpeed.value;
        var suvNormalSpeedValue = suvNormalSpeed.value;
        var vanSlowSpeedValue = vanSlowSpeed.value;
        var vanNormalSpeedValue = vanNormalSpeed.value;
        var truckSlowSpeedValue = truckSlowSpeed.value;
        var truckNormalSpeedValue = truckNormalSpeed.value;
        var bikeSlowSpeedValue = bikeSlowSpeed.value;
        var bikeNormalSpeedValue = bikeNormalSpeed.value;

        fetch("/companyConfig/editConfig", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": getCookie("csrf_access_token"),
            },
            body: JSON.stringify({
                busSlowSpeed: busSlowSpeedValue,
                busNormalSpeed: busNormalSpeedValue,
                sedanSlowSpeed: sedanSlowSpeedValue,
                sedanNormalSpeed: sedanNormalSpeedValue,
                hatchbackSlowSpeed: hatchbackSlowSpeedValue,
                hatchbackNormalSpeed: hatchbackNormalSpeedValue,
                suvSlowSpeed: suvSlowSpeedValue,
                suvNormalSpeed: suvNormalSpeedValue,
                vanSlowSpeed: vanSlowSpeedValue,
                vanNormalSpeed: vanNormalSpeedValue,
                truckSlowSpeed: truckSlowSpeedValue,
                truckNormalSpeed: truckNormalSpeedValue,
                bikeSlowSpeed: bikeSlowSpeedValue,
                bikeNormalSpeed: bikeNormalSpeedValue
            })
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
});