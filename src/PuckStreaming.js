// Combine the 3 bit ID and 12 bit ADC into one uint16 value 

var uid = 0;

function incrementId() {
  uid = ((uid + 1) % 8) & 0x7;
  LED1.write(uid & 0b001);
  LED2.write(uid & 0b010);
  LED3.write(uid & 0b100);
}

function getIdAndADC() {
  var uid_bits = (uid & 0b1111) << 12;
  var adc_bits = (Math.floor(analogRead(D2) * 4096) & 0xFFF);
  return (uid_bits | adc_bits);
}

function hundredToRaw(raw) {
  return raw / 100 * 0x7FFF;
}

function onImu(d) {
  NRF.updateServices({
    'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
      'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
        notify: true,
        readable: true,
        value: new Int16Array([
            getIdAndADC(),
            d.acc.x,
            d.acc.y,
            d.acc.z,
            d.gyro.x,
            d.gyro.y,
            d.gyro.z,
          ]).buffer
      }
    }
  });
}

function onMag(d) {
  NRF.updateServices({
    'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
      'f8b23a4d-89ad-4220-8c9f-d81756009f0d': {
        notify: true,
        readable: true,
        value: new Int16Array([
          getIdAndADC(),
          d.x,
          d.y,
          d.z,
          hundredToRaw(E.getBattery()),
          hundredToRaw(E.getTemperature())
        ]).buffer
      }
    }
  });
}

function imuInit(imuRate) {
  if (imuRate === 0) {
    Puck.accelOff();
  } else {
    Puck.accelOn(imuRate);
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

function onInit() {

  NRF.on('connect', function() {
    // digitalPulse(LED1, 1, 100);
    // digitalPulse(LED2, 1, 100);
    // digitalPulse(LED3, 1, 100);
    imuInit(104);
    magInit(5);
  });

  NRF.on('disconnect', function() {
    // digitalPulse(LED1, 1, 100);
    // digitalPulse(LED2, 1, 100);
    // digitalPulse(LED3, 1, 100);
    // Turn off streaming on disconnect to save battery
    imuInit(0);
    magInit(0);
  });

  // declare the services
  NRF.setServices({
    // Puck service
    'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
      // Fast service
      'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
        description: 'Puck fast',
        notify: true,
        readable: true,
        value: new Int16Array([0, 0, 0, 0, 0, 0, 0]).buffer,
        maxlength: 14,
        writable: true,
        onWrite: function(evt) {
          //digitalPulse(LED1, 1, 100);
          //digitalPulse(LED2, 1, 100);
          //digitalPulse(LED3, 1, 100);
          if (evt.data) {
            var unpacked = new Float32Array(evt.data);
            var imuRate = unpacked[0];
            imuInit(imuRate);
          }
        }
      },
      // Slow service
      'f8b23a4d-89ad-4220-8c9f-d81756009f0d': {
        description: 'Puck slow',
        notify: true,
        readable: true,
        value: new Int16Array([0, 0, 0, 0, 0, 0]).buffer,
        maxlength: 12,
        writable: true,
        onWrite: function(evt) {
          //digitalPulse(LED1, 1, 100);
          //digitalPulse(LED2, 1, 100);
          //digitalPulse(LED3, 1, 100);
          if (evt.data) {
            var unpacked = new Float32Array(evt.data);
            var magRate = unpacked[0];
            magInit(magRate);
          }
        }
      }
    }
  });

  // Toggle LED when button is pressed
  setWatch(function() {
    incrementId();
  }, BTN, {repeat: true});

  // Set callbacks for magnetometer and accelerometer
  Puck.on('mag', onMag);
  Puck.on('accel', onImu);
  
  // Max out TX power
  NRF.setTxPower(4);

  // Default: OFF
  imuInit(0);
  magInit(0);
}
