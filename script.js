const toggleButton = document.getElementById('toggleButton');
const canvas = document.getElementById('frequencyGraph');
const ctx = canvas.getContext('2d');
const displayCountInput = document.getElementById('displayCount');
const amplitudeFilterInput = document.getElementById('noiseFilter');

let audioContext = null;
let analyser = null;
let dataArray = null;
let stream = null;
let animationId = null;

const marginLeft = 50;
const marginRight = 50;
const marginTop = 20;
const marginBottom = 40;

const minFreq = 100;
const maxFreq = 400;
const freqRange = maxFreq - minFreq;

const minAmp = -60;
const maxAmp = 0;
const ampRange = maxAmp - minAmp;

let history = []; // 每帧存储 { peakFreq: Number, peakAmp: Number }

function resizeCanvas() {
    // 适配高清屏幕
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = 400 * dpr;
    ctx.scale(dpr, dpr);
}
resizeCanvas();
window.addEventListener('resize', () => {
    // 重置scale前清除canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    resizeCanvas();
});

function mapFreqToY(freq) {
    freq = Math.min(Math.max(freq, minFreq), maxFreq);
    const h = canvas.height / (window.devicePixelRatio || 1) - marginTop - marginBottom;
    return h + marginTop - ((freq - minFreq) / freqRange) * h;
}

function mapAmpToY(amp) {
    amp = Math.min(Math.max(amp, minAmp), maxAmp);
    const h = canvas.height / (window.devicePixelRatio || 1) - marginTop - marginBottom;
    return h + marginTop - ((amp - minAmp) / ampRange) * h;
}

function drawAxes() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.font = '12px Arial';
    ctx.fillStyle = '#000';

    // 频率 Y轴 左边 100~400Hz
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop);
    ctx.lineTo(marginLeft, h - marginBottom);
    ctx.stroke();
    for (let f = 100; f <= 400; f += 50) {
        const y = mapFreqToY(f);
        ctx.fillText(f + ' Hz', 5, y + 4);
        ctx.beginPath();
        ctx.moveTo(marginLeft - 5, y);
        ctx.lineTo(marginLeft, y);
        ctx.stroke();
    }
    ctx.fillText('频率 (Hz)', marginLeft - 40, marginTop - 5);

    // 振幅 Y轴 右边 0 ~ -60 dB
    ctx.beginPath();
    ctx.moveTo(w - marginRight, marginTop);
    ctx.lineTo(w - marginRight, h - marginBottom);
    ctx.stroke();
    for (let a = 0; a >= -60; a -= 15) {
        const y = mapAmpToY(a);
        ctx.fillText(a + ' dB', w - marginRight + 10, y + 4);
        ctx.beginPath();
        ctx.moveTo(w - marginRight, y);
        ctx.lineTo(w - marginRight + 5, y);
        ctx.stroke();
    }
    ctx.fillText('振幅 (dB)', w - marginRight + 10, marginTop - 5);

    // 时间 X轴
    ctx.beginPath();
    ctx.moveTo(marginLeft, h - marginBottom);
    ctx.lineTo(w - marginRight, h - marginBottom);
    ctx.stroke();
    ctx.fillText('时间 (最近帧)', w / 2 - 30, h - 10);
}

// 绘制频率和振幅峰值随时间变化曲线
function drawCurves() {
    if (history.length === 0) return;

    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const displayCount = parseInt(displayCountInput.value) || 3; // 秒数
    const fps = 60;
    const maxFrames = displayCount * fps;
    const frames = history.slice(-maxFrames);

    // 频率峰值曲线 - 绿色
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    ctx.beginPath();

    frames.forEach((frame, idx) => {
        const x = marginLeft + (idx / maxFrames) * (w - marginLeft - marginRight);
        const y = mapFreqToY(frame.peakFreq);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 振幅峰值曲线 - 红色
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();

    frames.forEach((frame, idx) => {
        const x = marginLeft + (idx / maxFrames) * (w - marginLeft - marginRight);
        const y = mapAmpToY(frame.peakAmp);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function animate() {
    if (!audioContext) return;

    analyser.getByteFrequencyData(dataArray);

    const amplitudeFilter = parseFloat(amplitudeFilterInput.value) || -40;

    const sampleRate = audioContext.sampleRate;
    const binCount = analyser.frequencyBinCount;

    let peakFreq = minFreq;
    let peakAmp = minAmp;

    for (let i = 0; i < binCount; i++) {
        const freq = i * sampleRate / 2 / binCount;
        if (freq < minFreq || freq > maxFreq) continue;

        // 计算分贝（-∞到0dB近似）
        const amp = 20 * Math.log10(dataArray[i] / 255);
        if (amp < amplitudeFilter) continue;

        if (amp > peakAmp) {
            peakAmp = amp;
            peakFreq = freq;
        }
    }

    // 如果没找到符合条件的峰，设置为默认值
    if (peakAmp === minAmp) {
        peakFreq = minFreq;
    }

    history.push({ peakFreq, peakAmp });

    // 限制history长度
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
            await audioContext.close();
            audioContext = null;
        }
        analyser = null;
        dataArray = null;
        history = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        toggleButton.textContent = '开始检测';
    } else {
        // 开始检测
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            dataArray = new Uint8Array(analyser.frequencyBinCount);

            history = [];

            toggleButton.textContent = '停止检测';
            animate();
        } catch (err) {
            alert('无法访问麦克风：' + err.message);
        }
    }
});
