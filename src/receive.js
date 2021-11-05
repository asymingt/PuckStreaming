// Select and render boxes
const magSampleRateSelect = document.getElementById('magSampleRateSelect')
const magSampleRateSpan = document.getElementById('magSampleRateSpan')
const imuSampleRateSelect = document.getElementById('imuSampleRateSelect')
const imuSampleRateSpan = document.getElementById('imuSampleRateSpan')
const metSampleRateSelect = document.getElementById('metSampleRateSelect')
const metSampleRateSpan = document.getElementById('metSampleRateSpan')

// Graph divs
const magDiv = document.getElementById('magDiv')
const accDiv = document.getElementById('accDiv')
const gyrDiv = document.getElementById('gyrDiv')
const batDiv = document.getElementById('batDiv')
const adcDiv = document.getElementById('adcDiv')

// Extra info
const idSpan = document.getElementById('idSpan')
const batLevelSpan = document.getElementById('batLevelSpan')
const frameRateSpan = document.getElementById('frameRateSpan')

/// BLE things, mainly for debug
var device, server, service, fastCharacteristic, slowCharacteristic;

/// to display the actual sample rate
var magSampleRate, imuSampleRate, metSampleRate;
var imuSampleCnt = 0, magSampleCnt = 0, metSampleCnt = 0, frameCnt = 0

/// x, y, z coordinates sent to Plotly for mag, accel, gyro
var mxq = [], myq = [], mzq = [];
var axq = [], ayq = [], azq = [];
var gxq = [], gyq = [], gzq = [];
var bq = [], aq = [];

// Get the ID -> color mapping
function getStringId(newId) {
    var id = "unknown";
    switch (newId) {
    case 0b000:
        id = "black";
        break;
    case 0b001:
        id = "red";
        break;
    case 0b010:
        id = "green";
        break;
    case 0b011:
        id = "yellow";
        break;
    case 0b100:
        id = "blue";
        break;
    case 0b101:
        id = "purple";
        break;
    case 0b110:
        id = "cyan";
        break;
    case 0b111:
        id = "white";
        break;
    }
    return id;
}

function showBatLevel(battLevel) {
    batLevelSpan.innerText = battLevel + "%"
}

function showId(id) {
    idSpan.innerText = id
}

// Unpack fast rate data
function gotFastData(evt) {
    // Unpack data
    var raw = evt.target.value;
    var fastData = new Int16Array(raw.buffer);
    // decode metadata
    var meta = fastData[0];
    var mag = ((meta >> 15) & 0x1);
    var id = ((meta >> 12) & 0x7);
    var adc = (meta & 0xFFF);
    // save id
    showId(getStringId(id));
    // save ADC
    aq.push(adc);
    // Save IMU
    imuSampleCnt++;
    axq.push(fastData[1]);
    ayq.push(fastData[2]);
    azq.push(fastData[3]);
    gxq.push(fastData[4]);
    gyq.push(fastData[5]);
    gzq.push(fastData[6]);
    // Save mag
    if (mag == 1) {
        magSampleCnt++;
        mxq.push(fastData[7]);
        myq.push(fastData[8]);
        mzq.push(fastData[9]);
    }
}

// Unpack slow rate data
function gotSlowData(evt) {
    var raw = evt.target.value
    var slowData = new Int16Array(raw.buffer)
    metSampleCnt++;
    // Save battery
    var batLevl = slowData[1];
    bq.push(batLevl);
    showBatLevel(batLevl);
}

/// the function executing at requestAnimationFrame.
/// otherwise 80Hz update rate would lock up my browser (I guess depends on screen refresh rate)
function step() {
    frameCnt++
    if (mxq.length) {
        Plotly.extendTraces(
            magDiv,
            {
                y: [mxq, myq, mzq],
            },
            [0, 1, 2]
        );
        mxq.length = 0;
        myq.length = 0;
        mzq.length = 0;
    }
    if (axq.length) {
        Plotly.extendTraces(
            accDiv,
            {
                y: [axq, ayq, azq],
            },
            [0, 1, 2]
        );
        axq.length = 0;
        ayq.length = 0;
        azq.length = 0;
    }
    if (gxq.length) {
        Plotly.extendTraces(
            gyrDiv,
            {
                y: [gxq, gyq, gzq],
            },
            [0, 1, 2]
        );
        gxq.length = 0;
        gyq.length = 0;
        gzq.length = 0;
    }
    if (aq.length) {
        Plotly.extendTraces(
            adcDiv,
            {
                y: [aq],
            },
            [0, ]
        );
        aq.length = 0;
    }
    if (bq.length) {
        Plotly.extendTraces(
            batDiv,
            {
                y: [bq],
            },
            [0, ]
        );
        bq.length = 0;
    }
    window.requestAnimationFrame(step);
}

function setSampleRates(imuSampleRateIn, magSampleRateIn, metSampleRateIn) {
    // Don't update with unefined values.
    if ((typeof imuSampleRateIn === 'undefined') ||
        (typeof magSampleRateIn === 'undefined') ||
        (typeof metSampleRateIn === 'undefined')) return;
    // If we get here, then all rates are valid.
    fastCharacteristic && fastCharacteristic.writeValue && fastCharacteristic.writeValue(
        new Uint8Array([imuSampleRateIn, magSampleRateIn, metSampleRateIn]))
}

function disconnect() {
    server = server && server.disconnect()
    device = undefined
    server = undefined
    service = undefined
    fastCharacteristic = undefined
    slowCharacteristic = undefined
}

/// Connect to the Puck
function doIt() {
    disconnect();
    navigator.bluetooth.requestDevice({ optionalServices: ['f8b23a4d-89ad-4220-8c9f-d81756009f0c'], acceptAllDevices: true })
        .then(d => {
            device = d;
            console.debug('device:', device)
            return device.gatt.connect()
        })
        .then(s => {
            server = s
            console.debug('server:', server)

            // Get puck characteristics
            s.getPrimaryService('f8b23a4d-89ad-4220-8c9f-d81756009f0c')
                .then(srv => {
                    service = srv
                    console.debug('service:', service)
                    return service.getCharacteristics()
                })
                .then(chs => {
                    console.log('characteristics:', chs)
                    for (let ix = 0; ix < chs.length; ix++) {
                        const ch = chs[ix];
                        // Fast characteristic
                        if (ch.uuid == 'f8b23a4d-89ad-4220-8c9f-d81756009f0c') {
                            fastCharacteristic = ch
                            ch.addEventListener('characteristicvaluechanged', gotFastData)
                            ch.startNotifications()
                            imuSampleRate = imuSampleRateSelect.value;
                            magSampleRate = magSampleRateSelect.value;
                            metSampleRate = metSampleRateSelect.value;
                            setSampleRates(imuSampleRate, magSampleRate, metSampleRate);
                        }
                        // Slow characteristic
                        if (ch.uuid == 'f8b23a4d-89ad-4220-8c9f-d81756009f0d') {
                            slowCharacteristic = ch
                            ch.addEventListener('characteristicvaluechanged', gotSlowData)
                            ch.startNotifications()
                        }
                    }
                })
        })
}

/// Create the initial graph & clear it
function clearIt() {

    Plotly.newPlot(magDiv, [{
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#f00' },
        name: 'x'
    }, {
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#0f0' },
        name: 'y'
    }, {
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#00f' },
        name: 'z'
    }], { title: 'Magnetometer' });

    Plotly.newPlot(accDiv, [{
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#f00' },
        name: 'x'
    }, {
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#0f0' },
        name: 'y'
    }, {
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#00f' },
        name: 'z'
    }], { title: 'Accelerometer' });

    Plotly.newPlot(gyrDiv, [{
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#f00' },
        name: 'x'
    }, {
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#0f0' },
        name: 'y'
    }, {
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#00f' },
        name: 'z'
    }], { title: 'Gyroscope' });

    Plotly.newPlot(adcDiv, [{
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#000' },
    }], { title: 'ADC reading' });

    Plotly.newPlot(batDiv, [{
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#000' },
    }], { title: 'Battery level' });
}

// the actual initialization
magSampleRateSelect.onchange = evt => {
    magSampleRate = evt.target.value;
    setSampleRates(imuSampleRate, magSampleRate, metSampleRate);
}
imuSampleRateSelect.onchange = evt => {
    imuSampleRate = evt.target.value;
    setSampleRates(imuSampleRate, magSampleRate, metSampleRate);
}
metSampleRateSelect.onchange = evt => {
    metSampleRate = evt.target.value;
    setSampleRates(imuSampleRate, magSampleRate, metSampleRate);
}
setInterval(() => {
    magSampleRateSpan.innerText = magSampleCnt; magSampleCnt = 0;
    imuSampleRateSpan.innerText = imuSampleCnt; imuSampleCnt = 0;
    metSampleRateSpan.innerText = metSampleCnt; metSampleCnt = 0;
    frameRateSpan.innerText = frameCnt; frameCnt = 0;
}, 1000)
window.requestAnimationFrame(step)

// first: initialize the main plot
clearIt()