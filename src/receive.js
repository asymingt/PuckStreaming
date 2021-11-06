// Select and render boxes
const magSampleRateSelect = document.getElementById('magSampleRateSelect')
const magSampleRateSpan = document.getElementById('magSampleRateSpan')
const imuSampleRateSelect = document.getElementById('imuSampleRateSelect')
const imuSampleRateSpan = document.getElementById('imuSampleRateSpan')

// Graph divs
const magDiv = document.getElementById('magDiv')
const accDiv = document.getElementById('accDiv')
const gyrDiv = document.getElementById('gyrDiv')
const batDiv = document.getElementById('batDiv')
const adcDiv = document.getElementById('adcDiv')
const temDiv = document.getElementById('temDiv')

// Extra info
const idSpan = document.getElementById('idSpan')
const frameRateSpan = document.getElementById('frameRateSpan')

/// BLE things, mainly for debug
var device, server, service, fastCharacteristic, slowCharacteristic;

/// to display the actual sample rate
var magSampleRate, imuSampleRate;
var imuSampleCnt = 0, magSampleCnt = 0, frameCnt = 0

/// x, y, z coordinates sent to Plotly for mag, accel, gyro
var mxq = [], myq = [], mzq = [];
var axq = [], ayq = [], azq = [];
var gxq = [], gyq = [], gzq = [];
var bq = [], aq = [], tq = [];

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

function showId(id) {
    idSpan.innerText = id
}

function rawToHundred(raw) {
    return raw / 0x7FFF * 100;
}

// Unpack fast rate data
function gotFastData(evt) {
    imuSampleCnt++;
    // Unpack data
    var raw = evt.target.value;
    var data = new Int16Array(raw.buffer);
    // decode metadata
    var meta = data[0];
    var id = ((meta >> 12) & 0xF);
    var adc = (meta & 0xFFF);
    // save id
    showId(getStringId(id));
    // save ADC
    aq.push(adc);
    // Save IMU
    axq.push(data[1]);
    ayq.push(data[2]);
    azq.push(data[3]);
    gxq.push(data[4]);
    gyq.push(data[5]);
    gzq.push(data[6]);
}

// Unpack slow rate data
function gotSlowData(evt) {
    magSampleCnt++;
    // Unpack data
    var raw = evt.target.value;
    var data = new Int16Array(raw.buffer);
    // decode metadata
    var meta = data[0];
    var id = ((meta >> 12) & 0xF);
    var adc = (meta & 0xFFF);
    // save id
    showId(getStringId(id));
    // save ADC
    aq.push(adc);
    // Save MAG
    mxq.push(data[1]);
    myq.push(data[2]);
    mzq.push(data[3]);
    // Battery
    bq.push(rawToHundred(data[4]));
    // Temperature level (board)
    tq.push(rawToHundred(data[5]));
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
    if (tq.length) {
        Plotly.extendTraces(
            temDiv,
            {
                y: [tq],
            },
            [0, ]
        );
        tq.length = 0;
    }
    window.requestAnimationFrame(step);
}

function setSampleRateImu(imuSampleRateIn) {
    if (typeof imuSampleRateIn === 'undefined') {
        return;
    }
    fastCharacteristic && fastCharacteristic.writeValue && fastCharacteristic.writeValue(
        new Float32Array([imuSampleRateIn]))
}

function setSampleRateMag(magSampleRateIn) {
    if (typeof magSampleRateIn === 'undefined') {
        return;
    }
    slowCharacteristic && slowCharacteristic.writeValue && slowCharacteristic.writeValue(
        new Float32Array([magSampleRateIn]))
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
                            setSampleRateImu(imuSampleRate);
                        }
                        // Slow characteristic
                        if (ch.uuid == 'f8b23a4d-89ad-4220-8c9f-d81756009f0d') {
                            slowCharacteristic = ch
                            ch.addEventListener('characteristicvaluechanged', gotSlowData)
                            ch.startNotifications()
                            magSampleRate = magSampleRateSelect.value;
                            setSampleRateMag(magSampleRate);
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
    }], { title: 'Battery percentage' });

    Plotly.newPlot(temDiv, [{
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#000' },
    }], { title: 'Temperature (celcius)' });

}

// the actual initialization
magSampleRateSelect.onchange = evt => {
    magSampleRate = evt.target.value;
    setSampleRateMag(magSampleRate);
}
imuSampleRateSelect.onchange = evt => {
    imuSampleRate = evt.target.value;
    setSampleRateImu(imuSampleRate);
}
setInterval(() => {
    magSampleRateSpan.innerText = magSampleCnt; magSampleCnt = 0;
    imuSampleRateSpan.innerText = imuSampleCnt; imuSampleCnt = 0;
    frameRateSpan.innerText = frameCnt; frameCnt = 0;
}, 1000)
window.requestAnimationFrame(step)

// first: initialize the main plot
clearIt()