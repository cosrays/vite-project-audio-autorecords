import React, { useState, useCallback } from 'react';
import { Button, Space, Card, Input, message } from 'antd';
import { PlusOutlined, DeleteOutlined, ClearOutlined } from '@ant-design/icons';
import AudioPlayer from './index';

import { playPcmAudio } from '@/utils/audio';
import voiceJson from '@/mock/voice.json';

const { TextArea } = Input;

const pcmList = voiceJson.filter(item => item.type === 'audio');
let pcmListIndex = 0;

export default function AudioPlayerDemo() {
  const [audioDataList, setAudioDataList] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');

  // 模拟生成一些测试用的PCM数据（实际使用时应该是真实的音频数据）
  const generateTestPCMData = useCallback(() => {
    // 生成1秒的440Hz正弦波（A音符）
    const sampleRate = 16000;
    const duration = 1; // 秒
    const frequency = 440; // Hz
    const amplitude = 0.3;

    const samples = new Float32Array(sampleRate * duration);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }

    // 转换为16位PCM
    const pcmData = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      pcmData[i] = Math.max(-32768, Math.min(32767, samples[i] * 32767));
    }

    // 转换为base64
    const uint8Array = new Uint8Array(pcmData.buffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }

    return btoa(binaryString);
  }, []);

  // 添加测试音频数据
  const addTestAudio = useCallback(() => {
    // const testData = generateTestPCMData();
    const testData = pcmList[pcmListIndex].data;
    pcmListIndex++;
    setAudioDataList(prev => [...prev, testData]);
    message.success('已添加1秒测试音频');
  }, []);

  // 添加自定义音频数据
  const addCustomAudio = useCallback(() => {
    if (!currentInput.trim()) {
      message.warning('请输入base64编码的PCM音频数据');
      return;
    }

    try {
      // 简单验证base64格式
      atob(currentInput.trim());
      setAudioDataList(prev => [...prev, currentInput.trim()]);
      setCurrentInput('');
      message.success('已添加自定义音频数据');
    } catch (error) {
      message.error('无效的base64数据格式');
    }
  }, [currentInput]);

  // 移除最后一个音频数据
  const removeLastAudio = useCallback(() => {
    setAudioDataList(prev => {
      if (prev.length === 0) {
        message.warning('没有音频数据可移除');
        return prev;
      }
      message.success('已移除最后一个音频数据');
      return prev.slice(0, -1);
    });
  }, []);

  // 清空所有音频数据
  const clearAllAudio = useCallback(() => {
    setAudioDataList([]);
    message.success('已清空所有音频数据');
  }, []);

  // 播放状态变化回调
  const handlePlayStateChange = useCallback((isPlaying: boolean) => {
    console.log('播放状态变化:', isPlaying ? '播放中' : '暂停');
  }, []);

  // 播放进度回调
  const handleProgressChange = useCallback((progress: number) => {
    console.log('播放进度:', `${(progress * 100).toFixed(1)}%`);
  }, []);

  function testPlayVoice() {
    const testData = pcmList[pcmListIndex++].data;
    playPcmAudio(testData);
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>动态音频播放器演示</h1>

      {/* 音频播放器 */}
      <Card title="音频播放器" style={{ marginBottom: '24px' }}>
        <AudioPlayer
          audioDataList={audioDataList}
          sampleRate={16000}
          channels={1}
          bitsPerSample={16}
          onPlayStateChange={handlePlayStateChange}
          onProgressChange={handleProgressChange}
        />
      </Card>

      {/* 控制面板 */}
      <Card title="控制面板">
        <Button onClick={testPlayVoice}>测试play方法</Button>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 快速添加测试数据 */}
          <div>
            <h3>快速测试</h3>
            <Space wrap>
              <Button type="primary" icon={<PlusOutlined />} onClick={addTestAudio}>
                添加测试音频（1秒 440Hz）
              </Button>
              <Button icon={<DeleteOutlined />} onClick={removeLastAudio} disabled={audioDataList.length === 0}>
                移除最后一个
              </Button>
              <Button danger icon={<ClearOutlined />} onClick={clearAllAudio} disabled={audioDataList.length === 0}>
                清空所有
              </Button>
            </Space>
          </div>

          {/* 自定义音频数据输入 */}
          <div>
            <h3>添加自定义PCM音频数据</h3>
            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                placeholder="请输入base64编码的PCM音频数据..."
                value={currentInput}
                onChange={e => setCurrentInput(e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </Space.Compact>
            <Button style={{ marginTop: '8px' }} onClick={addCustomAudio} disabled={!currentInput.trim()}>
              添加自定义音频
            </Button>
          </div>

          {/* 状态信息 */}
          <div>
            <h3>状态信息</h3>
            <div
              style={{
                padding: '12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            >
              <div>音频数据片段数量: {audioDataList.length}</div>
              <div>
                每个片段预览长度:{' '}
                {audioDataList.map((data, index) => `#${index + 1}: ${data.length} chars`).join(', ') || '无'}
              </div>
            </div>
          </div>
        </Space>
      </Card>

      {/* 使用说明 */}
      <Card title="使用说明" style={{ marginTop: '24px' }}>
        <div style={{ lineHeight: '1.6' }}>
          <h4>功能特点:</h4>
          <ul>
            <li>支持动态添加PCM格式的base64编码音频数据</li>
            <li>自动将新增的音频数据追加到播放队列</li>
            <li>支持播放/暂停控制</li>
            <li>支持音量调节</li>
            <li>显示播放进度和时长</li>
            <li>实时状态监控</li>
          </ul>

          <h4>使用方法:</h4>
          <ol>
            <li>点击"添加测试音频"按钮快速添加测试数据</li>
            <li>或在文本框中输入自定义的base64编码PCM数据</li>
            <li>音频数据会自动添加到播放列表中</li>
            <li>点击播放按钮开始播放</li>
            <li>可以在播放过程中继续添加新的音频数据</li>
          </ol>

          <h4>技术参数:</h4>
          <ul>
            <li>采样率: 16000 Hz</li>
            <li>声道: 1（单声道）</li>
            <li>位深度: 16位</li>
            <li>数据格式: PCM（小端序）</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
