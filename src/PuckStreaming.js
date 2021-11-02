// upload this to the Puck

var magRate = 5;
var accelRate = 26;
var battRate = 1;
var batteryInterval;

// Called whenever a new magnetometer reading arrives
function onMag(d) {
  // Each below map to a int16
  // 8:  Puck.light() 0 : 1
  // 8:  Puck.getBatteryPercentage() : 0 - 100
  // 16: E.getTemperature() : degrees celcius
  // 16: analogRead(A0) : between 0 and 1
  NRF.updateServices({
    'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
      'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
        notify: true,
        readable: true,
        value: new Int16Array(
          [d.x, d.y, d.z]).buffer
      }
    }
  })
}

// Called whenever a new accelerometer reading arrives
function onAccel(d) {
  NRF.updateServices({
    'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
      'f8b23a4d-89ad-4220-8c9f-d81756009f0d': {
        notify: true,
        readable: true,
        value: new Int16Array(
          [d.acc.x, d.acc.y, d.acc.z, d.gyro.x, d.gyro.y, d.gyro.z]).buffer
      }
    }
  })
}

// Called whenever a new battery reading arrives. 
function onBattery() {
  NRF.updateServices({
    'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
      'f8b23a4d-89ad-4220-8c9f-d81756009f0e': {
        notify: true,
        readable: true,
        value: new Uint8Array(
          [E.getBattery()]).buffer
      }
    }
  })
}

function accelInit(accelRate) {
  if (accelRate === 0) {
    Puck.accelOff();
  } else {
    Puck.accelOn(accelRate);
    Puck.accelWr(0x10, Puck.accelRd(0x10) | 0b00001100); // scale to 2000dps
    Puck.accelWr(0x11, Puck.accelRd(0x11) | 0b00001000); // scale to +- 4g
  }
}

function magInit(magRate) {
  if (magRate === 0) {
    Puck.magOff();
  } else {
    Puck.magOn(magRate);
  }
}

function battInit(battRate) {
  if (batteryInterval) {
    clearInterval(batteryInterval);
    batteryInterval = undefined;
  }
  if (battRate != 0) {
    batteryInterval = setInterval(onBattery, 1000 / battRate);
  }
}

function onInit() {

  // on connect / disconnect blink the green / red LED turn on / off the magnetometer
  NRF.on('connect', function() {
    magInit(magRate);
    accelInit(accelRate);
    battInit(battRate);
    digitalPulse(LED2, 1, 100);
  })
  NRF.on('disconnect', function() {
    battInit(0);
    accelInit(0);
    magInit(0);
    digitalPulse(LED1, 1, 100);
  })

  // declare the services
  NRF.setServices({
    // Puck service
    'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
      // Magnetometer service
      'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
        description: 'Puck magnetometer',
        notify: true,
        readable: true,
        value: new Int16Array([0, 0, 0]).buffer,
        writable: true,
        onWrite: function(evt) {
          digitalPulse(LED3, 1, 100);
          var magRate = evt.data && evt.data[0];
          magInit(magRate);
        }
      },
      // Accelerometer
      'f8b23a4d-89ad-4220-8c9f-d81756009f0d': {
        description: 'Puck accelerometer',
        notify: true,
        readable: true,
        value: new Int16Array([0, 0, 0, 0, 0, 0]).buffer,
        writable: true,
        onWrite: function(evt) {
          digitalPulse(LED3, 1, 100);
          var accelRate = evt.data && evt.data[0];
          accelInit(accelRate);
        }
      },
      // Battery
      'f8b23a4d-89ad-4220-8c9f-d81756009f0e': {
        description: 'Puck battery',
        notify: true,
        readable: true,
        value: new Uint8Array([0]).buffer,
        writable: true,
        onWrite: function(evt) {
          digitalPulse(LED3, 1, 100);
          var battRate = evt.data && evt.data[0];
          battInit(battRate);
        }
      }
    }
  })

  // Toggle LED when button is pressed
  setWatch(function() {
    LED1.toggle();
  }, BTN, {repeat: true})

  // Set callbacks for magnetometer and accelerometer
  Puck.on('mag', onMag);
  Puck.on('accel', onAccel);

  // Make it nice and easy to go to the right website.
  NRF.nfcURL("https://rowlikeapro.com");
}
