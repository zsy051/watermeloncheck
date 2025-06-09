let lastUpdateTime = 0; // 上次更新的时间戳
const updateInterval = 16; // 每次更新的最小间隔（约 60fps）

function detectFrequency() {
    if (!detecting) return;

    const currentTime = Date.now();
    const timeElapsed = (currentTime - startTime) / 1000; // 秒

    analyser.getByteFrequencyData(dataArray);

    let maxIndex = 0;
    for (let i = 1; i < dataArray.length; i++) {
        if (dataArray[i] > dataArray[maxIndex]) {
            maxIndex = i;
        }
    }

    const nyquist = audioContext.sampleRate / 2;
    const frequency = (maxIndex / bufferLength) * nyquist;

    if (frequency >= 20 && frequency <= 250 && currentTime - lastUpdateTime > updateInterval) {
        frequencyHistory.push({ time: timeElapsed, frequency });
        lastUpdateTime = currentTime;

        // 保持最近 3 秒数据
        frequencyHistory = frequencyHistory.filter((point) => point.time >= timeElapsed - 3);

        const ripeness = determineRipeness(frequency);
        resultDiv.textContent = `当前频率: ${frequency.toFixed(2)} Hz, 成熟度: ${ripeness}`;
    }

    requestAnimationFrame(detectFrequency);
}

function animateGraph() {
    if (!detecting) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制坐标轴
    ctx.strokeStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(50, 10);
    ctx.lineTo(50, canvas.height - 50);
    ctx.lineTo(canvas.width - 10, canvas.height - 50);
    ctx.stroke();

    // 绘制频率刻度
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

    // 绘制时间刻度
    const xEndTime = frequencyHistory.length > 0 ? frequencyHistory[frequencyHistory.length - 1].time : 0;
    for (let i = Math.floor(xEndTime - 3); i <= xEndTime; i++) {
        const x = 50 + ((i - (xEndTime - 3)) / 3) * (canvas.width - 60);
        ctx.fillText(`${i}s`, x, canvas.height - 30);
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - 55);
        ctx.lineTo(x, canvas.height - 45);
        ctx.stroke();
    }

    // 绘制频率曲线
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    frequencyHistory.forEach((point, index) => {
        const x = 50 + ((point.time - (xEndTime - 3)) / 3) * (canvas.width - 60);
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
