const toggleButton = document.getElementById('toggleButton');
const canvas = document.getElementById('frequencyGraph');
const ctx = canvas.getContext('2d');
const displayCountInput = document.getElementById('displayCount');
const noiseFilterInput = document.getElementById('noiseFilter');

canvas.width = canvas.clientWidth;
canvas.height = 400;

let audioContext, analyser, dataArray, amplitudeArray;
let frequencyHistory = [];
let amplitudeHistory = [];
let animationFrameId = null;
let stream = null;

function startDetection() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(userStream => {
        stream = userStream;
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
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function toggleDetection() {
    if (audioContext) {
        toggleButton.textContent = '开始检测';
        stopDetection();
    } else {
        toggleButton.textContent = '停止检测';
        startDetection();
    }
}

function animateGraph() {
    if (!audioContext) return;

    analyser.getByteFrequencyData(dataArray);
    analyser.getFloatFrequencyData(amplitudeArray);

    const noiseFilter = parseInt(noiseFilterInput.value, 10);
    const displayCount = parseInt(displayCountInput.value, 10);

    const filteredFrequencies = [];
    const filteredAmplitudes = [];
    for (let i = 0; i < dataArray.length; i++) {
        const freq = (i / dataArray.length) * (audioContext.sampleRate / 2);
        if (freq >= noiseFilter && freq <= 250) {
            filteredFrequencies.push(freq);
            filteredAmplitudes.push(amplitudeArray[i]);
        }
    }

    frequencyHistory.push([...filteredFrequencies]);
    amplitudeHistory.push([...filteredAmplitudes]);

    if (frequencyHistory.length > displayCount * 60) {
        frequencyHistory.shift();
        amplitudeHistory.shift();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const freqHeight = canvas.height - 50;
    const ampHeight = canvas.height - 50;

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

    animationFrameId = requestAnimationFrame(animateGraph);
}

toggleButton.addEventListener('click', toggleDetection);
