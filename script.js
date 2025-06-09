const toggleButton = document.getElementById('toggleButton');
const resultDiv = document.getElementById('result');
const canvas = document.getElementById('frequencyGraph');
const ctx = canvas.getContext('2d');

const updateIntervalInput = document.getElementById('updateIntervalInput');
const decibelThresholdInput = document.getElementById('decibelThresholdInput');

let audioContext, analyser, stream;
let dataArray, bufferLength;
let detecting = false;
let animationId;
let startTime;
let frequencyHistory = [];

// 适配 canvas 大小
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

// 初始变量
let updateInterval = parseFloat(updateIntervalInput.value);
let decibelThreshold = parseFloat(decibelThresholdInput.value);

updateIntervalInput.addEventListener('change', () => {
  const val = parseFloat(updateIntervalInput.value);
  if (val >= 0.005 && val <= 0.1) {
    updateInterval = val;
  }
});
decibelThresholdInput.addEventListener('change', () => {
  const val = parseFloat(decibelThresholdInput.value);
  if (val >= -80 && val <= 0) {
    decibelThreshold = val;
  }
});

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
    lastUpdateTime = 0;

    animateGraph();
    detectFrequency();
  } catch (err) {
    resultDiv.textContent = "无法访问麦克风：" + err.message;
    toggleButton.textContent = "开始检测";
    detecting = false;
  }
}

function stopDetection() {
  detecting = false;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  cancelAnimationFrame(animationId);
  resultDiv.textContent = "检测已停止";
}

let lastUpdateTime = 0;

function detectFrequency() {
  if (!detecting) return;

  const now = Date.now();

  analyser.getByteFrequencyData(dataArray);

  // 计算音量dB
  const amplitude = Math.max(...dataArray);
  const amplitudeRatio = amplitude / 255;
  const decibel = amplitudeRatio > 0 ? 20 * Math.log10(amplitudeRatio) : -Infinity;

  if (now - lastUpdateTime > updateInterval * 1000) {
    lastUpdateTime = now;

    if (decibel >= decibelThreshold) {
      let maxIndex = 0;
      for (let i = 1; i < dataArray.length; i++) {
        if (dataArray[i] > dataArray[maxIndex]) {
          maxIndex = i;
        }
      }
      const nyquist = audioContext.sampleRate / 2;
      const frequency = (maxIndex / bufferLength) * nyquist;

      if (frequency >= 20 && frequency <= 250) {
        const timeElapsed = (now - startTime) / 1000;
        frequencyHistory.push({ time: timeElapsed, frequency, decibel });

        // 保留最近3秒数据
        frequencyHistory = frequencyHistory.filter(p => p.time >= timeElapsed - 3);

        const ripeness = determineRipeness(frequency);
        resultDiv.textContent = `当前频率: ${frequency.toFixed(2)} Hz，成熟度: ${ripeness}，分贝: ${decibel.toFixed(1)} dB`;
      }
    }
  }

  requestAnimationFrame(detectFrequency);
}

function animateGraph() {
  if (!detecting) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 左侧y轴（频率）和刻度
  ctx.strokeStyle = "#888";
  ctx.fillStyle = "#000";
  ctx.lineWidth = 1;
  ctx.font = "12px Arial";

  ctx.beginPath();
  ctx.moveTo(50, 10);
  ctx.lineTo(50, canvas.height - 50);
  ctx.lineTo(canvas.width - 50, canvas.height - 50);
  ctx.stroke();

  // 频率y轴刻度和标签
  const yLabels = [
    { value: 250, label: "250 Hz" },
    { value: 189, label: "生瓜" },
    { value: 160, label: "适熟" },
    { value: 133, label: "熟瓜" },
    { value: 20, label: "20 Hz" },
  ];
  yLabels.forEach(label => {
    const y = canvas.height - 50 - (label.value / 250) * (canvas.height - 60);
    ctx.fillText(label.label, 5, y + 4);
    ctx.beginPath();
    ctx.moveTo(45, y);
    ctx.lineTo(55, y);
    ctx.stroke();
  });

  // 右侧y轴（分贝）和刻度
  ctx.beginPath();
  ctx.moveTo(canvas.width - 50, 10);
  ctx.lineTo(canvas.width - 50, canvas.height - 50);
  ctx.stroke();

  // 分贝范围 -80 dB 到 0 dB
  const dBMin = -80;
  const dBMax = 0;
  const dBStep = 20;
  ctx.textAlign = "right";

  for(let db = dBMin; db <= dBMax; db += dBStep) {
    const y = canvas.height - 50 - ((db - dBMin) / (dBMax - dBMin)) * (canvas.height - 60);
    ctx.fillText(`${db} dB`, canvas.width - 55, y + 4);
    ctx.beginPath();
    ctx.moveTo(canvas.width - 55, y);
    ctx.lineTo(canvas.width - 45, y);
    ctx.stroke();
  }

  // 时间刻度（x轴）
  ctx.textAlign = "center";
  const nowTime = frequencyHistory.length > 0 ? frequencyHistory[frequencyHistory.length - 1].time : 0;
  for (let i = Math.floor(nowTime - 3); i <= nowTime; i++) {
    const x = 50 + ((i - (nowTime - 3)) / 3) * (canvas.width - 100);
    ctx.fillText(`${i}s`, x, canvas.height - 30);
    ctx.beginPath();
    ctx.moveTo(x, canvas.height - 55);
    ctx.lineTo(x, canvas.height - 45);
    ctx.stroke();
  }

  // 绘制频率曲线（绿色，左y轴）
  ctx.strokeStyle = "#4CAF50";
  ctx.lineWidth = 2;
  ctx.beginPath();
  frequencyHistory.forEach((point, i) => {
    const x = 50 + ((point.time - (nowTime - 3)) / 3) * (canvas.width - 100);
    const y = canvas.height - 50 - (point.frequency / 250) * (canvas.height - 60);
    if (i === 0) ctx.moveTo(x, y);