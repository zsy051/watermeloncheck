const startButton = document.getElementById('start');
const resultDiv = document.getElementById('result');
const canvas = document.getElementById('frequencyGraph');
const ctx = canvas.getContext('2d');

let audioContext, analyser, stream;
let dataArray, bufferLength;
let detecting = false;
let animationId;
let startTime;

function determineRipeness(freq) {
    if (freq > 189) return "生瓜";
    if (freq >= 160 && freq <= 189) return "适熟";
    if (freq >= 133 && freq < 160) return "熟瓜";
    return "过熟";
}

function drawGraph(frequency, timeElapsed) {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制坐标轴
    ctx.strokeStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(50, 10); // Y轴起点
    ctx.lineTo(50, canvas.height - 50); // Y轴底点
    ctx.lineTo(canvas.width - 10, canvas.height - 50); // X轴右端点
    ctx.stroke();

    // 绘制刻度和标签
    ctx.font = "12px Arial";
    const yLabels = [
        { value: 200, label: "生瓜" },
        { value: 160, label: "适熟" },
        { value: 133, label: "熟瓜" },
        { value: 100, label: "过熟" },
    ];

    yLabels.forEach((label, index) => {
        const y = canvas.height - 50 - (label.value / 200) * (canvas.height - 60);
        ctx.fillText(label.label, 5, y + 3);
        ctx.beginPath();
        ctx.moveTo(45, y);
        ctx.lineTo(55, y);
        ctx.stroke();
    });

    const x = 50 + (timeElapsed / 10000) * (canvas.width - 60);
    const y = canvas.height - 50 - (frequency / 200) * (canvas.height - 60);

    // 绘制频率点
    ctx.fillStyle = "#4CAF50";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
}

async function startDetection() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        resultDiv.textContent = "你的设备不支持音频输入功能。";
        return;
    }

    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 2048;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);

        resultDiv.textContent = "检测中... 请敲击西瓜。";
        startTime = performance.now();
        detectFrequency();
    } catch (err) {
        resultDiv.textContent = "无法访问麦克风：" + err.message;
    }
}

function stopDetection() {
    cancelAnimationFrame(animationId);
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }
    resultDiv.textContent = "检测已停止。";
}

function detectFrequency() {
    analyser.getByteFrequencyData(dataArray);
    const maxAmplitudeIndex = dataArray.indexOf(Math.max(...dataArray));
    const nyquist = audioContext.sampleRate / 2;
    const frequency = (maxAmplitudeIndex / bufferLength) * nyquist;

    const ripeness = determineRipeness(frequency);
    resultDiv.textContent = `当前频率: ${frequency.toFixed(2)} Hz，成熟度: ${ripeness}`;

    const timeElapsed = performance.now() - startTime;
    drawGraph(frequency, timeElapsed);

    animationId = requestAnimationFrame(detectFrequency);
}

startButton.addEventListener("click", () => {
    if (!detecting) {
        detecting = true;
        startButton.textContent = "停止检测";
        startDetection();
    } else {
        detecting = false;
        startButton.textContent = "开始检测";
        stopDetection();
    }
});
