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

// 新增函数：拼接多个PCM数据
function concatenatePcmData(pcmDataArray: Uint8Array[]): Uint8Array {
  // 计算总长度
  const totalLength = pcmDataArray.reduce((sum, data) => sum + data.length, 0);

  // 创建新的数组存储拼接后的数据
  const concatenated = new Uint8Array(totalLength);

  // 拼接数据
  let offset = 0;
  for (const pcmData of pcmDataArray) {
    concatenated.set(pcmData, offset);
    offset += pcmData.length;
  }

  return concatenated;
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

// 新增函数：将多个PCM base64拼接后转换为WAV base64
async function concatenatePcmBase64ToWav(
  pcmBase64Array: string[],
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Promise<string> {
  // 将所有PCM base64转换为PCM数据
  const pcmDataArray = pcmBase64Array.map(base64 => pcmBase64ToPcmData(base64));

  // 拼接PCM数据
  const concatenatedPcm = concatenatePcmData(pcmDataArray);

  // 转换为WAV格式
  return await pcmToWavBase64(concatenatedPcm, sampleRate, numChannels, bitsPerSample);
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
    // 过滤出所有audio类型的数据
    const pcmList = voiceJson.filter(item => item.type === "audio");

    if (pcmList.length > 0) {
      // 提取所有PCM base64数据
      const pcmBase64Array = pcmList.map(item => item.data);

      // 将多个PCM格式的base64拼接后转换为WAV格式的base64
      concatenatePcmBase64ToWav(pcmBase64Array).then((wavBase64) => {
        console.log('多个PCM拼接转WAV成功', wavBase64);
        console.log(`拼接了 ${pcmList.length} 个PCM音频片段`);
        setUrl(wavBase64);
      }).catch((error) => {
        console.error('PCM拼接转WAV失败:', error);
      });
    } else {
      console.log('没有找到audio类型的数据');
    }
  }, []);

  console.log('data-url', url);

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        {voiceJson.filter(item => item.type === "audio").length > 0 && (
          <p>已拼接 {voiceJson.filter(item => item.type === "audio").length} 个PCM音频片段</p>
        )}
      </div>
      {url && <audio controls src={url} />}
    </div>
  )
}