const toggleButton = document.getElementById('toggleButton');
const canvas = document.getElementById('frequencyGraph');
const ctx = canvas.getContext('2d');
const displayCountInput = document.getElementById('displayCount');
const amplitudeFilterInput = document.getElementById('noiseFilter');

let audioContext = null;
let analyser = null;
let dataArray = null;
let amplitudeArray = null;
let stream = null;

const marginLeft = 50;
const marginRight = 50;
const marginTop = 20;
const marginBottom = 40;

const minFreq = 100;
const maxFreq = 350;
const freqRange = maxFreq - minFreq;

const minAmp = -60;
const maxAmp = 0;
const ampRange = maxAmp - minAmp;

let history = []; // 存储历史帧数据，格式：[{ frequencies: [], amplitudes: [] }, ...]

function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = 400;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function mapFreqToY(freq) {
    freq = Math.min(Math.max(freq, minFreq), maxFreq);
    const h = canvas.height - marginTop - marginBottom;
    return canvas.height - marginBottom - ((freq - minFreq) / freqRange) * h;
}

function mapAmpToY(amp) {
    amp = Math.min(Math.max(amp, minAmp), maxAmp);
    const h = canvas.height - marginTop - marginBottom;
    return canvas.height - marginBottom - ((amp - minAmp) / ampRange) * h;
}

function drawAxes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.font = '12px Arial';
    ctx.fillStyle = '#000';

    // Y轴左 - 频率轴 100~250Hz
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop);
    ctx.lineTo(marginLeft, canvas.height - marginBottom);
    ctx.stroke();
    // 频率刻度
    for (let f = 100; f <= 250; f += 30) {
        const y = mapFreqToY(f);
        ctx.fillText(f + ' Hz', 5, y + 4);
        ctx.beginPath();
        ctx.moveTo(marginLeft - 5, y);
        ctx.lineTo(marginLeft, y);
        ctx.stroke();
    }
    ctx.fillText('频率 (Hz)', marginLeft - 40, marginTop - 5);

    // Y轴右 - 振幅轴 0 ~ -60dB
    ctx.beginPath();
    ctx.moveTo(canvas.width - marginRight, marginTop);
    ctx.lineTo(canvas.width - marginRight, canvas.height - marginBottom);
    ctx.stroke();
    // 振幅刻度
    for (let a = 0; a >= -60; a -= 15) {
        const y = mapAmpToY(a);
        ctx.fillText(a + ' dB', canvas.width - marginRight + 10, y + 4);
        ctx.beginPath();
        ctx.moveTo(canvas.width - marginRight, y);
        ctx.lineTo(canvas.width - marginRight + 5, y);
        ctx.stroke();
    }
    ctx.fillText('振幅 (dB)', canvas.width - marginRight + 10, marginTop - 5);

    // X轴时间轴
    ctx.beginPath();
    ctx.moveTo(marginLeft, canvas.height - marginBottom);
    ctx.lineTo(canvas.width - marginRight, canvas.height - marginBottom);
    ctx.stroke();
    ctx.fillText('时间 (最近帧)', canvas.width / 2 - 30, canvas.height - 10);
}

function drawCurves() {
    if (history.length === 0) return;

    const displayCount = parseInt(displayCountInput.value) || 3; // 秒数
    const fps = 60;
    const maxFrames = displayCount * fps;
    const frames = history.slice(-maxFrames);

    // 绘制频率曲线 - 绿色
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    ctx.beginPath();

    frames.forEach((frame, idx) => {
        frame.frequencies.forEach((freq, i) => {
            // X坐标：时间轴，帧序号
            // Y坐标：频率映射
            const x = marginLeft + (idx / maxFrames) * (canvas.width - marginLeft - marginRight);
            const y = mapFreqToY(freq);

            if (idx === 0 && i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
    });
    ctx.stroke();

    // 绘制振幅曲线 - 红色
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();

    frames.forEach((frame, idx) => {
        frame.amplitudes.forEach((amp, i) => {
            const x = marginLeft + (idx / maxFrames) * (canvas.width - marginLeft - marginRight);
            const y = mapAmpToY(amp);

            if (idx === 0 && i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
    });
    ctx.stroke();
}

function animate() {
    if (!audioContext) return;

    analyser.getByteFrequencyData(dataArray);
    analyser.getFloatFrequencyData(amplitudeArray);

    const amplitudeFilter = parseFloat(amplitudeFilterInput.value) || -40;

    const sampleRate = audioContext.sampleRate;
    const binCount = analyser.frequencyBinCount;

    const freqs = [];
    const amps = [];

    for (let i = 0; i < binCount; i++) {
        const freq = i * sampleRate / 2 / binCount;
        if (freq < minFreq || freq > maxFreq) continue;

        const amp = amplitudeArray[i];
        if (amp < amplitudeFilte
