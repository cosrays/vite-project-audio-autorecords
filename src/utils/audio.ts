/**
 * 播放base64编码的PCM音频数据
 * @param base64PcmData base64编码的PCM音频字符串
 * @param sampleRate 采样率，默认16000Hz
 * @param channels 声道数，默认1（单声道）
 * @param bitDepth 位深度，默认16位
 * @returns Promise，播放完成后resolve
 */
export async function playPcmAudio(
  base64PcmData: string,
  sampleRate: number = 24000,
  channels: number = 1,
  bitDepth: number = 16,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      // 创建AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // 解码base64数据为ArrayBuffer
      const binaryString = atob(base64PcmData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 根据位深度处理PCM数据
      let audioData: Float32Array;
      if (bitDepth === 16) {
        // 16位PCM数据处理
        const pcmData = new Int16Array(bytes.buffer);
        audioData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          audioData[i] = pcmData[i] / 32768.0; // 转换为-1到1的范围
        }
      } else if (bitDepth === 8) {
        // 8位PCM数据处理
        audioData = new Float32Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          audioData[i] = (bytes[i] - 128) / 128.0; // 转换为-1到1的范围
        }
      } else {
        throw new Error(`不支持的位深度: ${bitDepth}`);
      }

      // 创建AudioBuffer
      const audioBuffer = audioContext.createBuffer(channels, audioData.length / channels, sampleRate);

      // 填充音频数据到buffer
      for (let channel = 0; channel < channels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] = audioData[i * channels + channel];
        }
      }

      // 创建音频源节点
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      // 播放结束时的回调
      source.onended = () => {
        audioContext.close();
        resolve();
      };

      // 开始播放
      source.start(0);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 简化版本的播放方法，使用默认参数
 * @param base64PcmData base64编码的PCM音频字符串
 * @returns Promise，播放完成后resolve
 */
export function playPcmAudioSimple(base64PcmData: string): Promise<void> {
  return playPcmAudio(base64PcmData);
}
