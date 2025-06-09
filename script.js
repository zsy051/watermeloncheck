const toggleButton = document.getElementById('toggleButton');
const canvas = document.getElementById('frequencyGraph');
const ctx = canvas.getContext('2d');
const displayCountInput = document.getElementById('displayCount');
const amplitudeFilterInput = document.getElementById('noiseFilter'); // 这里是振幅过滤阈值，单位dB

canvas.width = canvas.clientWidth;
canvas.height = 400;

let audioContext, analyser, dataArray, amplitudeArray;
let history = [];
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
    history = [];
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

    const amplitudeFilter = parseFloat(amplitudeFilterInput.value); // 例如 -40 dB
    const displayCount = parseInt(displayCountInput.value);

    const sampleRate = audioContext.sampleRate;
    const binCount = analyser.frequencyBinCount;

    // 采样频率范围 100Hz ~ 250Hz
    const minFreq = 100;
    const maxFreq = 250;

    const frequencies = [];
    const amplitudes = [];

    for (let i = 0; i < binCount; i++) {
        const freq = i * (sampleRate / 2) / binCount;  // 当前频率
        if (freq < minFreq || freq > maxFreq) continue;

        const amp = amplitudeArray[i]; // 频率对应的振幅（单位dB）

        if (amp < amplitudeFilter) continue; // 低于阈值过滤

        frequencies.push(freq);
        amplitudes.push(amp);
    }

    // 记录历史（模拟3秒内，假设60fps）
    history.push({ frequencies, amplitudes });

    if (history.length > displayCount * 60) { // 这里的displayCount是秒数
        history.shift();
    }

    // 开始绘制

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const marginLeft = 50;
    const marginRight = 50;
    const marginTop = 30;
    const marginBottom = 50;

    const width = canvas.width - marginLeft - marginRight;
    const height = canvas.height - marginTop - marginBottom;

    // 画坐标轴
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;

    // y轴左（频率100~250Hz）
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop);
    ctx.lineTo(marginLeft, marginTop + height);
    ctx.stroke();

    // y轴右（振幅0 ~ -60 dB）
    ctx.beginPath();
    ctx.moveTo(canvas.width - marginRight, marginTop);
    ctx.lineTo(canvas.width - marginRight, marginTop + height);
    ctx.stroke();

    // x轴（时间）
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop + height);
    ctx.lineTo(canvas.width - marginRight, marginTop + height);
    ctx.stroke();

    // 左侧y轴标签（频率）
    ctx.fillStyle = '#4CAF50';
    ctx.font = '12px Arial';
    for (let f = 100; f <= 250; f += 30) {
        const y = marginTop + height - ((f - 100) / 150) * height;
        ctx.fillText(`${f}Hz`, 5, y + 4);
        ctx.beginPath();
        ctx.moveTo(marginLeft - 5, y);
        ctx.lineTo(marginLeft, y);
        ctx.stroke();
    }

    // 右侧y轴标签（振幅）
    ctx.fillStyle = '#FF0000';
    for (let db = 0; db >= -60; db -= 15) {
        const y = marginTop + height - ((db - 0) / (-60 - 0)) * height;
        ctx.fillText(`${db}dB`, canvas.width - marginRight + 5, y + 4);
        ctx.beginPath();
        ctx.moveTo(canvas.width - marginRight, y);
        ctx.lineTo(canvas.width - marginRight + 5, y);
        ctx.stroke();
    }

    // x轴标签，时间秒数，从历史长度倒数绘制
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.font = '12px Arial';
    for (let i = 0; i <= displayCount; i++) {
        const x = marginLeft + (width * i) / displayCount;
        ctx.fillText(`${displayCount - i}s`, x, marginTop + height + 20);
        ctx.beginPath();
        ctx.moveTo(x, marginTop + height);
        ctx.lineTo(x, marginTop + height + 5);
        ctx.stroke();
    }

    // 画频率曲线（绿色）
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < history.length; i++) {
        const freqPoints = history[i].frequencies;
        if (freqPoints.length === 0) continue;
        const x = marginLeft + (width * i) / (displayCount * 60);
        // 取频率平均值作为该帧频率点
        const avgFreq = freqPoints.reduce((a, b) => a + b, 0) / freqPoints.length;
        const y = marginTop + height - ((avgFreq - 100) / 150) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 画振幅曲线（红色）
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < history.length; i++) {
        const ampPoints = history[i].amplitudes;
        if (ampPoints.length === 0) continue;
        const x = marginLeft + (width * i) / (displayCount * 60);
        // 取振幅平均值作为该帧振幅点
        const avgAmp = ampPoints.reduce((a, b) => a + b, 0) / ampPoints.length;
        // 振幅范围0到-60dB，坐标需要转成正向像素 y
        const y = marginTop + height - ((avgAmp - 0) / (-60 - 0)) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    animationFrameId = requestAnimationFrame(animateGraph);
}

toggleButton.addEventListener('click', () => {
    if (audioContext) {
        toggleButton.textContent = '开始检测';
        stopDetection();
    } else {
        toggleButton.textContent = '停止检测';
        startDetection();
    }
});
