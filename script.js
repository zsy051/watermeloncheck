const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');

let audioContext = null;
let analyser = null;
let dataArray = null;
let stream = null;
let rafId = null;

const sampleRateTarget = 44100;
const fftSize = 2048;
const binCount = fftSize / 2;

const minFreq = 20;
const maxFreq = 400;

let recording = false;
let recordStartTime = 0;
const recordDuration = 1000; // 采样1秒
let recordedFrames = [];

function resizeCanvas() {
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function freqFromIndex(i, sampleRate, fftSize) {
  return i * sampleRate / fftSize;
}

function drawGraph(frequencies, amplitudes) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'green';
  ctx.lineWidth = 2;
  ctx.beginPath();

  const width = canvas.width / window.devicePixelRatio;
  const height = canvas.height / window.devicePixelRatio;

  // 绘制频率和振幅曲线
  frequencies.forEach((freq, i) => {
    const x = (i / frequencies.length) * width;
    const y = height - ((amplitudes[i] + 100) / 100) * height; // 归一到0~height
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  // 显示文字说明
  ctx.fillStyle = '#000';
  ctx.font = '14px Arial';
  ctx.fillText(`频率峰值: ${frequencies[0].toFixed(1)} Hz`, 10, 20);
  ctx.fillText(`振幅峰值: ${amplitudes[0].toFixed(1)} dB`, 10, 40);
}

function getPeakFrequencyAndAmplitude(spectrum, sampleRate, fftSize, amplitudeThreshold = -80) {
  let peakFreq = 0;
  let peakAmp = -Infinity;
  let peakIndex = 0;
  for (let i = 0; i < spectrum.length; i++) {
    const freq = freqFromIndex(i, sampleRate, fftSize);
    if (freq < minFreq || freq > maxFreq) continue;
    const amp = 20 * Math.log10(spectrum[i] / 255);
    if (amp > peakAmp && amp > amplitudeThreshold) {
      peakAmp = amp;
      peakFreq = freq;
      peakIndex = i;
    }
  }
  return { peakFreq, peakAmp, peakIndex };
}

function classifyMaturity(freq) {
  if (freq < 133) return '过熟瓜';
  if (freq <= 160) return '熟瓜';
  if (freq <= 189) return '适熟瓜';
  return '生瓜';
}

async function startDetection() {
  if (audioContext) {
    stopDetection();
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();

    analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    dataArray = new Uint8Array(analyser.frequencyBinCount);

    statusEl.textContent = '等待拍击声...';
    recordedFrames = [];
    recording = false;

    startBtn.textContent = '停止检测';

    rafId = requestAnimationFrame(processAudio);
  } catch (err) {
    alert('无法访问麦克风：' + err.message);
    cleanup();
  }
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
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  statusEl.textContent = '检测已停止';
  startBtn.textContent = '开始检测';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  recordedFrames = [];
  recording = false;
}

function cleanup() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function processAudio(timestamp) {
  if (!analyser) return;

  analyser.getByteFrequencyData(dataArray);

  // 计算瞬时音量（简单峰值）
  const instantVolume = Math.max(...dataArray);

  if (!recording && instantVolume > 100) {
    // 拍击声触发，开始记录1秒数据
    recording = true;
    recordStartTime = performance.now();
    recordedFrames = [];
    statusEl.textContent = '检测中，请稍候...';
  }

  if (recording) {
    recordedFrames.push(Uint8Array.from(dataArray)); // 保存快照

    if (performance.now() - recordStartTime >= recordDuration) {
      // 录制结束，分析数据
      recording = false;
      analyzeRecordedFrames();
      statusEl.textContent = '等待下一次拍击声...';
    }
  }

  rafId = requestAnimationFrame(processAudio);
}

function analyzeRecordedFrames() {
  if (recordedFrames.length === 0) {
    statusEl.textContent = '未检测到有效信号';
    return;
  }

  const sampleRate = audioContext.sampleRate;

  // 对每帧计算峰值频率和振幅，找最大振幅帧
  let maxAmp = -Infinity;
  let maxFreq = 0;
  let maxFrame = null;

  recordedFrames.forEach(frame => {
    const { peakFreq, peakAmp } = getPeakFrequencyAndAmplitude(frame, sampleRate, fftSize);
    if (peakAmp > maxAmp) {
      maxAmp = peakAmp;
      maxFreq = peakFreq;
      maxFrame = frame;
    }
  });

  const maturity = classifyMaturity(maxFreq);

  statusEl.textContent = `检测结果：${maturity} （峰值频率 ${maxFreq.toFixed(1)} Hz，峰值振幅 ${maxAmp.toFixed(1)} dB）`;

  // 绘图，显示峰值帧的频谱
  if (maxFrame) {
    // 频率数组只用峰值频率一个点，绘制时显示峰值曲线方便，画整个频谱
    const frequencies = [];
    const amplitudes = [];
    for (let i = 0; i < maxFrame.length; i++) {
      const freq = freqFromIndex(i, sampleRate, fftSize);
      frequencies.push(freq);
      amplitudes.push(20 * Math.log10(maxFrame[i] / 255));
    }
    drawGraph(frequencies, amplitudes);
  }
}

startBtn.addEventListener('click', () => {
  if (audioContext) {
    stopDetection();
  } else {
    startDetection();
  }
});
