// upload this to the Puck

var metInterval;

// Called whenever a new magnetometer reading arrives - we cache the
// latest value so it is collected and used by the high rate data.

var mag_x, mag_y, mag_z, mag_rdy = 0;

function onMag(d) {
  mag_x = d.x;
  mag_y = d.y;
  mag_z = d.z;
  mag_rdy = 1;
}

// Combine the 3 bit ID and 12 bit ADC into one uint16 value 

var uid = 0;

function incrementId() {
  uid = ((uid + 1) % 8) & 0x7;
  LED1.write(uid & 0b001);
  LED2.write(uid & 0b010);
  LED3.write(uid & 0b100);
}

function getIdAndADC(clearMag) {
  var mag_bits = (mag_rdy & 0x1) << 15;
  var uid_bits = (uid & 0x7) << 12;
  var adc_bits = (Math.floor(analogRead(D2) * 4096) & 0xFFF);
  if (clearMag) {
    mag_rdy = 0;
  }
  return (mag_bits | uid_bits | adc_bits);
}

// HIGH RATE DATA /////////////////////////////////////////////////////
// Called whenever a new accelerometer reading arrives. Triggers
// Service directly in order to keep latency as low as possible
// 0: 4 bit ID | 12 bit ADC0     [16x1]
// 1: acc_x, 2: acc_y, 3: acc_z  [16x3]
// 4: gyr_x, 5: gyr_y, 6: gyr_z  [16x3]
// 7: mag_x, 7: mag_y, 8: mag_z  [16x3] = 16x10 = 160 bits / 20 bytes
function onImu(d) {
  NRF.updateServices({
    'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
      'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
        notify: true,
        readable: true,
        value: new Int16Array([
            getIdAndADC(true),
            d.acc.x,
            d.acc.y,
            d.acc.z,
            d.gyro.x,
            d.gyro.y,
            d.gyro.z,
            mag_x,
            mag_y,
            mag_z,
          ]).buffer
      }
    }
  });
}

// LOW RATE DATA ////////////////////////////////////////////////////////
// Triggers on a customizable candence (maybe one day from GPS)
// 0:  Sequence number
// 1:  Timest
// 2:  Puck.light()
// 3:  Puck.getBatteryPercentage() : 0 - 100
// 4:  E.getTemperature() : degrees celcius
function onMet() {
  NRF.updateServices({
    'f8b23a4d-89ad-4220-8c9f-d81756009f0c': {
      'f8b23a4d-89ad-4220-8c9f-d81756009f0d': {
        notify: true,
        readable: true,
        value: new Int16Array([
          getIdAndADC(false),           // Meta
          Puck.getBatteryPercentage(),  // battery
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
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

function metInit(metRate) {
  if (metInterval) {
    clearInterval(metInterval);
    metInterval = undefined;
  }
  if (metRate != 0) {
    metInterval = setInterval(onMet, 1000 / metRate);
  }
}

function onInit() {
  // on connect / disconnect blink the green / red LED turn on / off the magnetometer
  NRF.on('connect', function() {
    digitalPulse(LED1, 1, 100);
    digitalPulse(LED2, 1, 100);
    digitalPulse(LED3, 1, 100);
    magInit(magRate);
    imuInit(imuRate);
    metInit(metRate);
  });
  NRF.on('disconnect', function() {
    digitalPulse(LED1, 1, 100);
    digitalPulse(LED2, 1, 100);
    digitalPulse(LED3, 1, 100);
    metInit(0);
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
        value: new Int16Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer,
        writable: true,
        onWrite: function(evt) {
          //digitalPulse(LED1, 1, 100);
          //digitalPulse(LED2, 1, 100);
          //digitalPulse(LED3, 1, 100);
          if (evt.data) {
            var unpacked = new Uint8Array(evt.data);
            var imuRate = unpacked[0];
            var magRate = unpacked[1];
            var metRate = unpacked[2];
            imuInit(imuRate);
            magInit(magRate);
            metInit(metRate);
          }
        }
      },
      // Slow service
      'f8b23a4d-89ad-4220-8c9f-d81756009f0d': {
        description: 'Puck slow',
        notify: true,
        readable: true,
        value: new Int16Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer,
        writable: false
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
  
  // Default: OFF
  magInit(5);
  imuInit(26);
  metInit(1);

  // Make it nice and easy to go to the right website.
  NRF.nfcURL("https://rowlikeapro.com");
}
