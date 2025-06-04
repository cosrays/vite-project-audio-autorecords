/**
 * 音频播放器相关类型定义
 */

export interface AudioPlayerProps {
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

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  progress: number;
}

export interface AudioChunk {
  id: string;
  data: string; // base64编码的PCM数据
  timestamp: number;
  processed: boolean;
}
