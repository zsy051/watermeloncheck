const toggleButton = document.getElementById('toggleButton');
const resultDiv = document.getElementById('result');
const canvas = document.getElementById('frequencyGraph');
const ctx = canvas.getContext('2d');

let audioContext, analyser, stream;
let dataArray, bufferLength;
let detecting = false;
let animationId;
let startTime;
let frequencyHistory = [];

// 动态适配 canvas 尺寸
function resizeCanvas() {
    canvas.width = window.innerWidth - 40;
    canvas.height = window.innerHeight / 3;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function determineRipeness(freq) {
    if (freq > 189) return "生瓜";
    if (freq >= 160 && freq <= 189) return "适熟";
    if (freq >= 133 && freq < 160) return "熟瓜";
    return "过熟";
}

async function startDetection() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyser.fftSize = 2048;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        detecting = true;
        frequencyHistory = [];
        startTime = Date.now();
        resultDiv.textContent = "正在检测...";
        animateGraph();
        detectFrequency();
    } catch (err) {
        resultDiv.textContent = "无法访问麦克风：" + err.message;
    }
}

function stopDetection() {
    detecting = false;
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
    }
    cancelAnimationFrame(animationId);
    resultDiv.textContent = "检测已停止";
}

function detectFrequency() {
    if (!detecting) return;

    analyser.getByteFrequencyData(dataArray);

    let maxIndex = 0;
    for (let i = 1; i < dataArray.length; i++) {
        if (dataArray[i] > dataArray[maxIndex]) {
            maxIndex = i;
        }
    }

    const nyquist = audioContext.sampleRate / 2;
    const frequency = (maxIndex / bufferLength) * nyquist;

    if (frequency >= 20 && frequency <= 250) {
        const timeElapsed = Date.now() - startTime;
        frequencyHistory.push({ time: timeElapsed, frequency });

        const ripeness = determineRipeness(frequency);
        resultDiv.textContent = `当前频率: ${frequency.toFixed(2)} Hz, 成熟度: ${ripeness}`;
    }

    requestAnimationFrame(detectFrequency);
}

function animateGraph() {
    if (!detecting) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(50, 10);
    ctx.lineTo(50, canvas.height - 50);
    ctx.lineTo(canvas.width - 10, canvas.height - 50);
    ctx.stroke();

    const yLabels = [
        { value: 250, label: "250 Hz" },
        { value: 189, label: "生瓜" },
        { value: 160, label: "适熟" },
        { value: 133, label: "熟瓜" },
        { value: 20, label: "20 Hz" },
    ];

    yLabels.forEach((label) => {
        const y = canvas.height - 50 - (label.value / 250) * (canvas.height - 60);
        ctx.fillText(label.label, 5, y + 3);
        ctx.beginPath();
        ctx.moveTo(45, y);
        ctx.lineTo(55, y);
        ctx.stroke();
    });

    ctx.strokeStyle = "#4CAF50";
    ctx.beginPath();
    frequencyHistory.forEach((point, index) => {
        const x = 50 + (point.time / 10000) * (canvas.width - 60);
        const y = canvas.height - 50 - (point.frequency / 250) * (canvas.height - 60);
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    animationId = requestAnimationFrame(animateGraph);
}

toggleButton.addEventListener("click", () => {
    if (detecting) {
        stopDetection();
        toggleButton.textContent = "开始检测";
    } else {
        startDetection();
        toggleButton.textContent = "停止检测";
    }
});
