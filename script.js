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
let animationId = null;

const marginLeft = 200;
const marginRight = 50;
const marginTop = 20;
const marginBottom = 40;

const minFreq = 100;
const maxFreq = 400;
const freqRange = maxFreq - minFreq;

const minAmp = -60;
const maxAmp = 0;
const ampRange = maxAmp - minAmp;

let history = []; // 存储历史数据，每帧：{frequencies: [], amplitudes: []}

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

    // 添加频率区间标注
    const ranges = [
        { label: '过熟瓜', range: [100, 133], color: '#d35400' },
        { label: '熟瓜', range: [133, 160], color: '#27ae60' },
        { label: '适熟瓜', range: [160, 189], color: '#f1c40f' },
        { label: '生瓜', range: [189, 400], color: '#c0392b' }
    ];

    ranges.forEach(({ label, range, color }) => {
        const startY = mapFreqToY(range[1]);
        const endY = mapFreqToY(range[0]);

        // 绘制区间文字
        ctx.fillStyle = color;
        ctx.fillRect(marginLeft - 70, startY, 60, endY - startY); // 调整宽度
        ctx.fillStyle = '#fff';
        const textY = (startY + endY) / 2; // 中心位置
        ctx.textAlign = 'center';
        ctx.fillText(label, marginLeft - 40, textY + 4); // 文字水平位置
    });

    // 绘制频率 Y轴 左边
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop);
    ctx.lineTo(marginLeft, canvas.height - marginBottom);
    ctx.stroke();
    for (let f = 100; f <= 400; f += 50) {
        const y = mapFreqToY(f);
        ctx.fillText(f + ' Hz', marginLeft - 70, y + 4); // 调整文字偏移
        ctx.beginPath();
        ctx.moveTo(marginLeft - 5, y);
        ctx.lineTo(marginLeft, y);
        ctx.stroke();
    }
    ctx.fillText('频率 (Hz)', marginLeft - 40, marginTop - 5);
}

function drawCurves() {
    if (history.length === 0) return;

    const displayCount = parseInt(displayCountInput.value) || 3;
    const fps = 60;
    const maxFrames = displayCount * fps;
    const frames = history.slice(-maxFrames);

    // 绘制曲线
    frames.forEach((frame, idx) => {
        frame.frequencies.forEach((freq, i) => {
            let color = 'gray';
            if (freq < 133) color = '#d35400'; // 过熟瓜
            else if (freq < 160) color = '#27ae60'; // 熟瓜
            else if (freq < 189) color = '#f1c40f'; // 适熟瓜
            else color = '#c0392b'; // 生瓜

            const x = marginLeft + (idx / maxFrames) * (canvas.width - marginLeft - marginRight);
            const y = mapFreqToY(freq);

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            if (i === 0) ctx.beginPath();
            ctx.lineTo(x, y);
        });
        ctx.stroke();
    });
}

function drawCurves() {
    if (history.length === 0) return;

    const displayCount = parseInt(displayCountInput.value) || 3; // 秒数
    const fps = 60;
    const maxFrames = displayCount * fps;
    const frames = history.slice(-maxFrames);

    // 频率曲线 - 绿色
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    ctx.beginPath();

    frames.forEach((frame, idx) => {
        frame.frequencies.forEach((freq, i) => {
            const x = marginLeft + (idx / maxFrames) * (canvas.width - marginLeft - marginRight);
            const y = mapFreqToY(freq);
            if (idx === 0 && i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
    });
    ctx.stroke();

    // 振幅曲线 - 红色
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
        if (amp < amplitudeFilter) continue;

        freqs.push(freq);
        amps.push(amp);
    }

    history.push({ frequencies: freqs, amplitudes: amps });

    const displayCount = parseInt(displayCountInput.value) || 3;
    const maxFrames = displayCount * 60;
    if (history.length > maxFrames) {
        history.shift();
    }

    drawAxes();
    drawCurves();

    animationId = requestAnimationFrame(animate);
}

toggleButton.addEventListener('click', async () => {
    if (audioContext) {
        // 停止检测
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        analyser = null;
        dataArray = null;
        amplitudeArray = null;
        history = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        toggleButton.textContent = '开始检测';
    } else {
        // 开始检测
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 4096;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            dataArray = new Uint8Array(analyser.frequencyBinCount);
            amplitudeArray = new Float32Array(analyser.frequencyBinCount);

            history = [];

            toggleButton.textContent = '停止检测';
            animate();
        } catch (err) {
            alert('无法访问麦克风：' + err.message);
        }
    }
});
