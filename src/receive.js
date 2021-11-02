// Select and render boxes
const magSampleRateSelect = document.getElementById('magSampleRateSelect')
const magSampleRateSpan = document.getElementById('magSampleRateSpan')
const accelSampleRateSelect = document.getElementById('accelSampleRateSelect')
const accelSampleRateSpan = document.getElementById('accelSampleRateSpan')
const battSampleRateSelect = document.getElementById('battSampleRateSelect')
const battSampleRateSpan = document.getElementById('battSampleRateSpan')

// Graph divs
const magDiv = document.getElementById('magDiv')
const accelDiv = document.getElementById('accelDiv')
const gyroDiv = document.getElementById('gyroDiv')
const battDiv = document.getElementById('battDiv')

// Extra info
const battLevelSpan = document.getElementById('battLevelSpan')
const frameRateSpan = document.getElementById('frameRateSpan')

/// BLE things, mainly for debug
var device, server, service, magCharacteristic, accelCharacteristic, battCharacteristic

/// to display the actual sample rate
var magSampleCnt = 0, accelSampleCnt = 0, battSampleCnt = 0, frameCnt = 0

/// x, y, z coordinates sent to Plotly for mag, accel, gyro
var mxq = [], myq = [], mzq = []
var axq = [], ayq = [], azq = []
var gxq = [], gyq = [], gzq = []
var bq = []

function gotMagData(evt) {
    var raw = evt.target.value
    var magData = new Int16Array(raw.buffer)
    magSampleCnt++
    mxq.push(magData[0])
    myq.push(magData[1])
    mzq.push(magData[2])
}

function gotAccelData(evt) {
    var raw = evt.target.value
    var accelData = new Int16Array(raw.buffer)
    accelSampleCnt++
    axq.push(accelData[0])
    ayq.push(accelData[1])
    azq.push(accelData[2])
    gxq.push(accelData[3])
    gyq.push(accelData[4])
    gzq.push(accelData[5])
}

function gotBattData(evt) {
    var raw = evt.target.value
    var batData = new Uint8Array(raw.buffer)
    battSampleCnt++
    bq.push(batData[0])
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
            accelDiv,
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
            gyroDiv,
            {
                y: [gxq, gyq, gzq],
            },
            [0, 1, 2]
        );
        gxq.length = 0;
        gyq.length = 0;
        gzq.length = 0;
    }
    if (bq.length) {
        Plotly.extendTraces(
            battDiv,
            {
                y: [bq],
            },
            [0, ]
        );
        bq.length = 0;
    }
    window.requestAnimationFrame(step)
}

function setMagSampleRate(rateInHz) {
    magCharacteristic && magCharacteristic.writeValue && magCharacteristic.writeValue(new Int8Array([rateInHz]))
}

function setAccelSampleRate(rateInHz) {
    accelCharacteristic && accelCharacteristic.writeValue && accelCharacteristic.writeValue(new Int8Array([rateInHz]))
}

function setBattSampleRate(rateInHz) {
    battCharacteristic && battCharacteristic.writeValue && battCharacteristic.writeValue(new Int8Array([rateInHz]))
}

function disconnect() {
    server = server && server.disconnect()
    device = undefined
    server = undefined
    service = undefined
    magCharacteristic = undefined
    accelCharacteristic = undefined
    battCharacteristic = undefined
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
                        if (ch.uuid == 'f8b23a4d-89ad-4220-8c9f-d81756009f0c') {
                            // Magnetometer
                            magCharacteristic = ch
                            ch.addEventListener('characteristicvaluechanged', gotMagData)
                            ch.startNotifications()
                            setMagSampleRate(magSampleRateSelect.value)
                        }
                        if (ch.uuid == 'f8b23a4d-89ad-4220-8c9f-d81756009f0d') {
                            // Accelerometer
                            accelCharacteristic = ch
                            ch.addEventListener('characteristicvaluechanged', gotAccelData)
                            ch.startNotifications()
                            setAccelSampleRate(accelSampleRateSelect.value)
                        }
                        if (ch.uuid == 'f8b23a4d-89ad-4220-8c9f-d81756009f0e') {
                            // battery
                            battCharacteristic = ch
                            ch.addEventListener('characteristicvaluechanged', gotBattData)
                            ch.startNotifications()
                            setBattSampleRate(battSampleRateSelect.value)
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

    Plotly.newPlot(accelDiv, [{
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

    Plotly.newPlot(gyroDiv, [{
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

    Plotly.newPlot(battDiv, [{
        y: [],
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#000' },
    }], { title: 'Battery level' });
}

// the actual initialization
magSampleRateSelect.onchange = evt => {setMagSampleRate(evt.target.value) }
accelSampleRateSelect.onchange = evt => {setAccelSampleRate(evt.target.value) }
battSampleRateSelect.onchange = evt => {setBattSampleRate(evt.target.value) }
setInterval(() => {
    magSampleRateSpan.innerText = magSampleCnt; magSampleCnt = 0
    accelSampleRateSpan.innerText = accelSampleCnt; accelSampleCnt = 0
    battSampleRateSpan.innerText = battSampleCnt; battSampleCnt = 0
    frameRateSpan.innerText = frameCnt; frameCnt = 0
}, 1000)
window.requestAnimationFrame(step)

// first: initialize the main plot
clearIt()