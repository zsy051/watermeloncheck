const toggleButton = document.getElementById("toggleButton");
const resultDiv = document.getElementById("result");
const canvas = document.getElementById("frequencyGraph");
const ctx = canvas.getContext("2d");

const updateIntervalInput = document.getElementById("updateIntervalInput");
const updateIntervalValue = document.getElementById("updateIntervalValue");
const decibelThresholdInput = document.getElementById("decibelThresholdInput");
const decibelThresholdValue = document.getElementById("decibelThresholdValue");

// 配置变量（初始值）
let updateInterval = parseFloat(updateIntervalInput.value); // 秒
let decibelThreshold = parseInt(decibelThresholdInput.value); // dB

let audioContext, analyser, stream;
let dataArray, bufferLength;
let detecting = false;
let animationId;
let startTime;
let frequencyHistory = [];
let decibelHistory = [];

// 监听滑块变化，实时更新变量和显示
updateIntervalInput.addEventListener("input", () => {
    updateInterval = parseFloat(updateIntervalInput.value);
    updateIntervalValue.textContent = updateInterval.toFixed(3);
});

decibelThresholdInput.addEventListener("input", () => {
    decibelThreshold = parseInt(decibelThresholdInput.value);
    decibelThresholdValue.textContent = decibelThreshold;
});

// 画布大小适配
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
        decibelHistory = [];
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
    let totalAmplitude = 0;
    for (let i = 0; i < dataArray.length; i++) {
        totalAmplitude += dataArray[i];
        if (dataArray[i] > dataArray[maxIndex]) {
            maxIndex = i;
        }
    }

    const nyquist = audioContext.sampleRate / 2;
    const frequency = (maxIndex / bufferLength) * nyquist;

    // 计算分贝
    const rms = Math.sqrt(totalAmplitude / dataArray.length);
    const decibel = 20 * Math.log10(rms);

    if (frequency >= 20 && frequency <= 250 && decibel >= decibelThreshold) {
        const timeElapsed = (Date.now() - startTime) / 1000;

        if (
            frequencyHistory.length === 0 ||
            timeElapsed - frequencyHistory[frequencyHistory.length - 1].time > updateInterval
        ) {
            frequencyHistory.push({ time: timeElapsed, frequency });
            decibelHistory.push({ time: timeElapsed, decibel });
        }

        frequencyHistory = frequencyHistory.filter((point) => point.time >= timeElapsed - 3);
        decibelHistory = decibelHistory.filter((point) => point.time >= timeElapsed - 3);

        const ripeness = determineRipeness(frequency);
        resultDiv.textContent = `频率: ${frequency.toFixed(2)} Hz, 分贝: ${decibel.toFixed(2)} dB, 成熟度: ${ripeness}`;
    }

    requestAnimationFrame(detectFrequency);
}

function animateGraph() {
    if (!detecting) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 坐标轴
    ctx.strokeStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(50, 10);
    ctx.lineTo(50, canvas.height - 50);
    ctx.lineTo(canvas.width - 50, canvas.height - 50);
    ctx.stroke();

    // 频率Y轴刻度 (左侧)
    const yLabels = [
        { value: 250, label: "250 Hz" },
        { value: 189, label: "生瓜" },
        { value: 160, label: "适熟" },
        { value: 133, label: "熟瓜" },
        { value: 20, label: "20 Hz" },
    ];
    yLabels.forEach(label => {
        const y = canvas.height - 50 - (label.value / 250) * (canvas.height - 60);
        ctx.fillText(label.label, 5, y + 3);
        ctx.beginPath();
        ctx.moveTo(45, y);
        ctx.lineTo(55, y);
        ctx.stroke();
    });

    // 分贝Y轴刻度 (右侧)
    for (let dB = decibelThreshold; dB <= 120; dB += 20) {
        const y = canvas.height - 50 - ((dB - decibelThreshold) / (120 - decibelThreshold)) * (canvas.height - 60);
        ctx.fillText(`${dB} dB`, canvas.width - 40, y + 3);
    }

    // 时间X轴刻度
    const latestTime = frequencyHistory.length > 0 ? frequencyHistory[frequencyHistory.length - 1].time : 0;
    for (let t = Math.floor(latestTime - 3); t <= latestTime; t++) {
        const x = 50 + ((t - (latestTime - 3)) / 3) * (canvas.width - 100);
        ctx.fillText(`${t}s`, x, canvas.height - 30);
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - 55);
        ctx.lineTo(x, canvas.height - 45);
        ctx.stroke();
    }

    // 频率曲线
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    frequencyHistory.forEach((point, i) => {
        const x = 50 + ((point.time - (latestTime - 3)) / 3) * (canvas.width - 100);
        const y = canvas.height - 50 - (point.frequency / 250) * (canvas.height - 60);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 分贝曲线
    ctx.strokeStyle = "#FF5722";
    ctx.lineWidth = 2;
    ctx.beginPath();
    decibelHistory.forEach((point, i) => {
        const x = 50 + ((point.time - (latestTime - 3)) / 3) * (canvas.width - 100);
        const y = canvas.height - 50 - ((point.decibel - decibelThreshold) / (120 - decibelThreshold)) * (canvas.height - 60);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
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