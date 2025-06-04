import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Slider, Typography } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, SoundOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface AudioPlayerProps {
  /** PCM格式base64编码的音频数据列表 */
  audioDataList: string[];
  /** 采样率，默认16000 */
  sampleRate?: number;
  /** 声道数，默认1（单声道） */
  channels?: number;
  /** 位深度，默认16位 */
  bitsPerSample?: number;
  /** 播放状态变化回调 */
  onPlayStateChange?: (isPlaying: boolean) => void;
  /** 播放进度回调 */
  onProgressChange?: (progress: number) => void;
}

export default function AudioPlayer({
  audioDataList = [],
  sampleRate = 16000,
  channels = 1,
  bitsPerSample = 16,
  onPlayStateChange,
  onProgressChange,
}: AudioPlayerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferQueueRef = useRef<AudioBuffer[]>([]);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const currentTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const processedDataCountRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 初始化 AudioContext
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = volume / 100;
    }
    return audioContextRef.current;
  }, [volume]);

  // 将base64 PCM数据转换为AudioBuffer
  const base64ToAudioBuffer = useCallback(
    async (base64Data: string): Promise<AudioBuffer | null> => {
      try {
        const audioContext = initAudioContext();

        // 解码base64
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // 将PCM数据转换为Float32Array
        const samples = new Float32Array(bytes.length / (bitsPerSample / 8));
        const dataView = new DataView(bytes.buffer);

        for (let i = 0; i < samples.length; i++) {
          if (bitsPerSample === 16) {
            // 16位PCM，小端序
            const sample = dataView.getInt16(i * 2, true);
            samples[i] = sample / 32768; // 归一化到[-1, 1]
          } else if (bitsPerSample === 8) {
            // 8位PCM
            const sample = dataView.getUint8(i) - 128;
            samples[i] = sample / 128;
          }
        }

        // 创建AudioBuffer
        const audioBuffer = audioContext.createBuffer(channels, samples.length / channels, sampleRate);

        for (let channel = 0; channel < channels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          for (let i = 0; i < channelData.length; i++) {
            channelData[i] = samples[i * channels + channel] || 0;
          }
        }

        return audioBuffer;
      } catch (error) {
        console.error('Failed to convert base64 to AudioBuffer:', error);
        return null;
      }
    },
    [sampleRate, channels, bitsPerSample, initAudioContext],
  );

  // 合并多个AudioBuffer
  const mergeAudioBuffers = useCallback(
    (buffers: AudioBuffer[]): AudioBuffer | null => {
      if (buffers.length === 0) return null;

      const audioContext = initAudioContext();
      const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
      const mergedBuffer = audioContext.createBuffer(channels, totalLength, sampleRate);

      let offset = 0;
      for (const buffer of buffers) {
        for (let channel = 0; channel < channels; channel++) {
          const channelData = mergedBuffer.getChannelData(channel);
          const sourceData = buffer.getChannelData(channel);
          channelData.set(sourceData, offset);
        }
        offset += buffer.length;
      }

      return mergedBuffer;
    },
    [channels, sampleRate, initAudioContext],
  );

  // 播放音频
  const playAudio = useCallback(() => {
    if (audioBufferQueueRef.current.length === 0) return;

    const audioContext = initAudioContext();

    // 如果AudioContext被挂起，恢复它
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // 停止当前播放
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
    }

    // 合并所有音频缓冲区
    const mergedBuffer = mergeAudioBuffers(audioBufferQueueRef.current);
    if (!mergedBuffer) return;

    // 创建新的源节点
    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = mergedBuffer;
    sourceNode.connect(gainNodeRef.current!);

    sourceNode.onended = () => {
      setIsPlaying(false);
      setCurrentTime(duration);
      sourceNodeRef.current = null;
      onPlayStateChange?.(false);
    };

    // 从暂停位置开始播放
    const startOffset = pausedTimeRef.current;
    sourceNode.start(0, startOffset);

    sourceNodeRef.current = sourceNode;
    startTimeRef.current = audioContext.currentTime - startOffset;

    setIsPlaying(true);
    onPlayStateChange?.(true);
  }, [initAudioContext, mergeAudioBuffers, duration, onPlayStateChange]);

  // 处理新的音频数据
  useEffect(() => {
    const processNewAudioData = async () => {
      if (audioDataList.length <= processedDataCountRef.current) return;

      const newDataList = audioDataList.slice(processedDataCountRef.current);

      for (const base64Data of newDataList) {
        if (base64Data) {
          const audioBuffer = await base64ToAudioBuffer(base64Data);
          if (audioBuffer) {
            audioBufferQueueRef.current.push(audioBuffer);
          }
        }
      }

      processedDataCountRef.current = audioDataList.length;

      // 更新总时长
      const totalDuration = audioBufferQueueRef.current.reduce((sum, buffer) => sum + buffer.duration, 0);
      setDuration(totalDuration);

      // 自动播放：当有新音频数据且当前没有在播放时，自动开始播放
      if (audioBufferQueueRef.current.length > 0 && !isPlaying) {
        playAudio();
      }
      // 如果已经在播放但源节点被停止了，重新开始播放
      else if (isPlaying && !sourceNodeRef.current && audioBufferQueueRef.current.length > 0) {
        playAudio();
      }
    };

    processNewAudioData();
  }, [audioDataList, base64ToAudioBuffer, isPlaying, playAudio]);

  // 暂停播放
  const pauseAudio = useCallback(() => {
    if (sourceNodeRef.current && audioContextRef.current) {
      pausedTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
      setIsPlaying(false);
      onPlayStateChange?.(false);
    }
  }, [onPlayStateChange]);

  // 停止播放
  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    pausedTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    onPlayStateChange?.(false);
  }, [onPlayStateChange]);

  // 更新播放时间
  useEffect(() => {
    let animationFrame: number;

    const updateTime = () => {
      if (isPlaying && audioContextRef.current && sourceNodeRef.current) {
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        const newCurrentTime = Math.min(elapsed, duration);
        setCurrentTime(newCurrentTime);
        onProgressChange?.(duration > 0 ? newCurrentTime / duration : 0);

        if (newCurrentTime < duration) {
          animationFrame = requestAnimationFrame(updateTime);
        }
      }
    };

    if (isPlaying) {
      animationFrame = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying, duration, onProgressChange]);

  // 设置音量
  const handleVolumeChange = useCallback((value: number) => {
    setVolume(value);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = value / 100;
    }
  }, []);

  // 切换播放状态
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }, [isPlaying, pauseAudio, playAudio]);

  // 格式化时间显示
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 清理资源
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div
      style={{
        padding: '16px',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        backgroundColor: '#fafafa',
      }}
    >
      {/* 播放控制 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        <Button
          type="text"
          size="large"
          icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={togglePlayPause}
          disabled={audioDataList.length === 0}
          style={{ fontSize: '24px', border: 'none' }}
        />
        <div style={{ marginLeft: '16px', flex: 1 }}>
          <Text>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </div>
      </div>

      {/* 音量控制 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <SoundOutlined />
        <Slider
          style={{ flex: 1 }}
          min={0}
          max={100}
          value={volume}
          onChange={handleVolumeChange}
          tooltip={{ formatter: value => `${value}%` }}
        />
        <Text style={{ minWidth: '35px' }}>{volume}%</Text>
      </div>

      {/* 状态信息 */}
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
        <Text type="secondary">
          音频片段: {audioDataList.length} | 已处理: {processedDataCountRef.current} | 状态:{' '}
          {isPlaying ? '播放中' : '暂停'}
        </Text>
      </div>
    </div>
  );
}
