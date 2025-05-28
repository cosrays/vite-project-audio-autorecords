import { useState, useRef, useEffect } from 'react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isMicrophoneBlocked, setIsMicrophoneBlocked] = useState(false);
  const [recordings, setRecordings] = useState<any[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoundTimeRef = useRef(Date.now());
  const recordingStartTimeRef = useRef<number | null>(null);
  const audioHistoryRef = useRef<{ timestamp: number; maxDb: number }[]>([]);

  // 配置参数
  const SILENCE_THRESHOLD = 0.1; // 静音阈值
  const CHECK_INTERVAL = 200; // 检查间隔 (ms)
  const SILENCE_DURATION = 2000; // 静音持续时间 (ms)

  const isValidVoiceRef = useRef(false);

  // 请求麦克风权限
  const getMicrophonePermission = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('您的浏览器不支持录音功能 (getUserMedia API not found).');
      setIsMicrophoneBlocked(true);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsMicrophoneBlocked(false);
      return stream;
    } catch (err: any) {
      console.error("获取麦克风权限失败:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('您已阻止麦克风权限。请在浏览器设置中允许访问麦克风。');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        alert('未找到麦克风设备。');
      } else {
        alert(`获取麦克风权限时发生错误: ${err.message}`);
      }
      setIsMicrophoneBlocked(true);
      return null;
    }
  };

  // 初始化音频分析
  const initAudioAnalysis = (stream: MediaStream) => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    audioContextRef.current = new AudioContext();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048;
    source.connect(analyserRef.current);
  };

  // 检查音频级别
  const checkAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    // 获取当前时刻的最大音量

    const currentMaxDb = dataArray.reduce(function(h, k) {
      return Math.max(h, Math.abs(k - 127))
    }, 0) / 128;
    const now = Date.now();

    // 将当前数据添加到历史记录
    audioHistoryRef.current.push({ timestamp: now, maxDb: currentMaxDb });

    // 移除超过1秒的历史数据
    audioHistoryRef.current = audioHistoryRef.current.filter(
      entry => now - entry.timestamp <= SILENCE_DURATION
    );

    // 计算最近1秒内的最大分贝
    const maxDbInLastSecond = audioHistoryRef.current.length > 0
      ? Math.max(...audioHistoryRef.current.map(entry => entry.maxDb))
      : currentMaxDb;

    console.log('当前最大音量 db:', currentMaxDb, '最近1秒内最大 db:', maxDbInLastSecond);

    if (maxDbInLastSecond > SILENCE_THRESHOLD) {
      isValidVoiceRef.current = true;
      lastSoundTimeRef.current = Date.now();
      // 最近1秒内音量超过阈值，继续录音并延迟检查
      lastSoundTimeRef.current = Date.now();

      silenceTimerRef.current = setTimeout(() => {
        checkAudioLevel();
      }, CHECK_INTERVAL);
    } else {
      if (Date.now() - lastSoundTimeRef.current >= SILENCE_DURATION) {
        // 最近1秒内音量都低于阈值，结束当前录音并开始新的录音
        console.log('检测到静音，自动分段录音');
        // 清空历史数据
        audioHistoryRef.current = [];
        // handleCurrentRecording()
        stopRecording();
        startRecording(isValidVoiceRef.current);
      } else {
        silenceTimerRef.current = setTimeout(() => {
          checkAudioLevel();
        }, CHECK_INTERVAL);
      }
    }
  };

  // 将Blob转换为base64的辅助函数
  const blobToBase64 = (blob: Blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // 开始录音
  const startRecording = async (isValidVoice: boolean = false) => {
    const stream = await getMicrophonePermission();
    if (!stream) return;

    isValidVoiceRef.current = false;

    audioStreamRef.current = stream;
    audioChunksRef.current = [];
    lastSoundTimeRef.current = Date.now();
    recordingStartTimeRef.current = Date.now();
    // 清空音频历史数据
    audioHistoryRef.current = [];

    try {
      mediaRecorderRef.current = new MediaRecorder(stream);
      initAudioAnalysis(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        console.log('isValidVoice', isValidVoice);
        // if (!isValidVoice) {
        //   return;
        // }
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/wav' });
        const audioBase64 = await blobToBase64(audioBlob);
        const duration = (Date.now() - (recordingStartTimeRef.current || 0)) / 1000;
        setRecordings((prevRecordings: any) => [
          ...prevRecordings,
          {
            url: audioBase64,
            id: Date.now(),
            blob: audioBlob,
            name: `录音 ${prevRecordings.length + 1}`,
            duration: duration.toFixed(1)
          }
        ]);
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder 错误:", event.error);
        alert(`录音过程中发生错误: ${event.error.name}`);
        setIsRecording(false);
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log("录音开始");

      lastSoundTimeRef.current = Date.now();
      silenceTimerRef.current = setTimeout(() => {
        checkAudioLevel()
      }, CHECK_INTERVAL);
    } catch (err: any) {
      console.error("创建 MediaRecorder 失败:", err);
      alert(`启动录音失败: ${err.message}`);
      audioStreamRef.current?.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
  };

  const handleCurrentRecording = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/wav' });
    const audioBase64 = await blobToBase64(audioBlob);
    const duration = (Date.now() - (recordingStartTimeRef.current || 0)) / 1000;

    audioChunksRef.current = [];
    lastSoundTimeRef.current = Date.now();
    recordingStartTimeRef.current = Date.now();
    // 清空音频历史数据
    audioHistoryRef.current = [];
    setRecordings((prevRecordings: any) => [
      ...prevRecordings,
      {
        url: audioBase64,
        id: Date.now(),
        blob: audioBlob,
        name: `录音 ${prevRecordings.length + 1}`,
        duration: duration.toFixed(1)
      }
    ]);
  }

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log("录音停止");

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
        console.log("麦克风轨道已停止");
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  };

  // 清理: 组件卸载时释放资源
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const handleDeleteRecording = (idToDelete: number) => {
    setRecordings(prevRecordings =>
      prevRecordings.filter((record: any) => {
        if (record.id === idToDelete) {
          return false;
        }
        return true;
      })
    );
  };

  return (
    <div className="h-full flex flex-column" style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>React 自动录音机</h2>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '10px' }}>
        {!isRecording ? (
          <button
            onClick={() => startRecording()}
            disabled={isMicrophoneBlocked}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              opacity: isMicrophoneBlocked ? 0.5 : 1,
            }}
          >
            开始录音
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            停止录音
          </button>
        )}
      </div>

      {isRecording && (
        <p style={{ textAlign: 'center', color: 'red', fontWeight: 'bold' }}>
          🔴 正在录音中... (检测到静音将自动分段)
        </p>
      )}
      {isMicrophoneBlocked && (
        <p style={{ textAlign: 'center', color: 'orange', fontWeight: 'bold' }}>
          麦克风权限被阻止或设备不可用。请检查浏览器设置。
        </p>
      )}

      <h3 style={{ marginTop: '30px', borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#555' }}>
        我的录音 ({recordings.length})
      </h3>
      {recordings.length === 0 && !isRecording && (
        <p style={{ textAlign: 'center', color: '#777' }}>暂无录音。点击"开始录音"来创建您的第一个录音！</p>
      )}
      <div className="flex-1 overflow-y-auto">
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {recordings.slice().reverse().map((record: any) => (
            <li
              key={record.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '10px',
                backgroundColor: parseFloat(record.duration) > 2.3 ? '#e6f3ff' : '#f9f9f9'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#333' }}>{record.name}</span>
                <span style={{ color: '#666', fontSize: '0.9em' }}>
                  {new Date(record.id).toLocaleTimeString()} - {record.duration}秒
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <audio src={record.url} controls style={{ flexGrow: 1 }} />
                <button
                  onClick={() => handleDeleteRecording(record.id)}
                  style={{
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '5px 10px',
                    cursor: 'pointer'
                  }}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AudioRecorder;