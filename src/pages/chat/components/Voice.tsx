import { useEffect, useState } from 'react';
import voiceJson from '@/mock/voice.json';

function binaryStringToUint8Array(str: string): Uint8Array {
  const len = str.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

// 新增函数：将PCM base64转换为PCM数据
function pcmBase64ToPcmData(base64: string): Uint8Array {
  // 处理data URI格式或纯base64格式
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(base64Data);
  return binaryStringToUint8Array(binaryString);
}

// 新增函数：将PCM base64直接转换为WAV base64
async function pcmBase64ToWavBase64(
  pcmBase64: string,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Promise<string> {
  const pcmData = pcmBase64ToPcmData(pcmBase64);
  return await pcmToWavBase64(pcmData, sampleRate, numChannels, bitsPerSample);
}

function pcmToWavBase64(
  pcmData: Uint8Array | Int16Array,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Promise<string> {
  const dataLength = pcmData.byteLength;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  let offset = 0;
  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset++, str.charCodeAt(i));
    }
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataLength, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size (PCM)
  view.setUint16(offset, 1, true); offset += 2;  // AudioFormat = 1 (PCM)
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitsPerSample, true); offset += 2;
  writeString('data');
  view.setUint32(offset, dataLength, true); offset += 4;

  // 合并头部和音频数据
  const wavBuffer = new Uint8Array(44 + dataLength);
  wavBuffer.set(new Uint8Array(header), 0);
  wavBuffer.set(new Uint8Array(pcmData.buffer), 44);

  const blob = new Blob([wavBuffer], { type: 'audio/wav' });

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string); // 返回 base64 字符串
    };
    reader.readAsDataURL(blob);
  });
}

export default function Voice() {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const data = voiceJson.filter(item => item.type === "audio").find(item => item.type === "audio");

    if (data?.data) {
      // 将PCM格式的base64转换为WAV格式的base64
      pcmBase64ToWavBase64(data.data).then((wavBase64) => {
        console.log('PCM转WAV成功', wavBase64);
        setUrl(wavBase64);
      }).catch((error) => {
        console.error('PCM转WAV失败:', error);
      });
    }
  }, []);

  console.log('data-url', url);

  return (
    <div>
      {/* <audio controls src={url} /> */}
      {url && <audio controls src={url} />}
    </div>
  )
}