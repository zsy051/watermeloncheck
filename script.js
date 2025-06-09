const startButton = document.getElementById('start');
const resultDiv = document.getElementById('result');

startButton.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        resultDiv.textContent = "你的设备不支持音频输入功能。";
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        resultDiv.textContent = "请敲击西瓜，等待检测结果...";
        setTimeout(() => {
            analyser.getByteFrequencyData(dataArray);

            const frequencies = dataArray.filter(value => value > 0);
            const averageFrequency = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;

            let maturity = "未知";
            if (averageFrequency > 189) {
                maturity = "生瓜";
            } else if (averageFrequency > 160) {
                maturity = "适熟";
            } else if (averageFrequency > 133) {
                maturity = "熟瓜";
            } else {
                maturity = "过熟";
            }

            resultDiv.textContent = `检测结果：${maturity}（频率：${Math.round(averageFrequency)} Hz）`;
            stream.getTracks().forEach(track => track.stop());
        }, 3000);
    } catch (err) {
        resultDiv.textContent = "无法访问麦克风：" + err.message;
    }
});
