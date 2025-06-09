const toggleButton = document.getElementById('toggleButton');
const canvas = document.getElementById('frequencyGraph');
const ctx = canvas.getContext('2d');
const displayCountInput = document.getElementById('displayCount');
const noiseFilterInput = document.getElementById('noiseFilter');

canvas.width = window.innerWidth * 0.8;
canvas.height = 400;

let audioContext, analyser, dataArray, amplitudeArray;
let frequencyHistory = [];
let amplitudeHistory = [];
let detecting = false;

function startDetection() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        amplitudeArray = new Float32Array(analyser.frequencyBinCount);

        source.connect(analyser);
        animateGraph();
    }).catch(err => {
        console.error('无法访问麦克风:', err);
    });
}

function stopDetection() {
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    detecting = false;
}

function toggleDetection() {
    if (detecting) {
        toggleButton.textContent = '开始检测';
        stopDetection();
    } else {
        toggleButton.textContent = '停止检测';
        detecting = true;
        startDetection();
    }
}

function animateGraph() {
    if (!detecting) return;

    analyser.getByteFrequencyData(dataArray);
    analyser.getFloatFrequencyData(amplitudeArray);

    const noiseFilter = parseInt(noiseFilterInput.value, 10);
    const displayCount = parseInt(displayCountInput.value, 10);

    const filteredFrequencies = [];
    const filteredAmplitudes = [];
    for (let i = 0; i < dataArray.length; i++) {
        const freq = (i / dataArray.length) * (audioContext.sampleRate / 2);
        if (freq >= noiseFilter) {
            filteredFrequencies.push(freq);
            filteredAmplitudes.push(amplitudeArray[i]);
        }
    }

    frequencyHistory.push([...filteredFrequencies]);
    amplitudeHistory.push([...filteredAmplitudes]);

    // Maintain history size
    if (frequencyHistory.length > displayCount) {
        frequencyHistory.shift();
    }
    if (amplitudeHistory.length > displayCount) {
        amplitudeHistory.shift();
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw axes
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 10);
    ctx.lineTo(50, canvas.height - 50);
    ctx.lineTo(canvas.width - 10, canvas.height - 50);
    ctx.stroke();

    // Frequency labels (left Y-axis)
    const freqRange = [100, 250];
    const freqHeight = canvas.height - 60;
    freqRange.forEach(freq => {
        const y = canvas.height - 50 - ((freq - 100) / 150) * freqHeight;
        ctx.fillStyle = '#000';
        ctx.fillText(`${freq} Hz`, 10, y);
        ctx.beginPath();
        ctx.moveTo(45, y);
        ctx.lineTo(55, y);
        ctx.stroke();
    });

    // Amplitude labels (right Y-axis)
    const ampRange = [0, -60];
    const ampHeight = canvas.height - 60;
    ampRange.forEach(amp => {
        const y = canvas.height - 50 - ((amp - (-60)) / 60) * ampHeight;
        ctx.fillStyle = '#f00';
        ctx.fillText(`${amp} dB`, canvas.width - 40, y);
        ctx.beginPath();
        ctx.moveTo(canvas.width - 45, y);
        ctx.lineTo(canvas.width - 55, y);
        ctx.stroke();
    });

    // Draw frequency curve
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    frequencyHistory.forEach((frequencies, i) => {
        frequencies.forEach((freq, j) => {
            const x = 50 + ((j / frequencies.length) * (canvas.width - 60));
            const y = canvas.height - 50 - ((freq - 100) / 150) * freqHeight;
            if (i === 0 && j === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
    });
    ctx.stroke();

    // Draw amplitude curve
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    amplitudeHistory.forEach((amplitudes, i) => {
        amplitudes.forEach((amp, j) => {
            const x = 50 + ((j / amplitudes.length) * (canvas.width - 60));
            const y = canvas.height - 50 - ((amp - (-60)) / 60) * ampHeight;
            if (i === 0 && j === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
    });
    ctx.stroke();

    requestAnimationFrame(animateGraph);
}

toggleButton.addEventListener('click', toggleDetection);
