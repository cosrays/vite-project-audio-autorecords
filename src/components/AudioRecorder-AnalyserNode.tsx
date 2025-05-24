// @ts-nocheck

import React, { useState, useRef, useEffect, useCallback } from 'react';

const AutoAudioRecorder = () => {
  const [isListening, setIsListening] = useState(false); // 是否处于监听VAD的状态
  const [isRecordingSegment, setIsRecordingSegment] = useState(false); // 是否正在录制一个语音片段
  const [isMicrophoneBlocked, setIsMicrophoneBlocked] = useState(false);
  const [recordings, setRecordings] = useState([]);

  // Refs for Web Audio API and MediaRecorder
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null); // Stores frequency data
  const sourceRef = useRef(null); // MediaStreamAudioSourceNode
  const silenceTimerRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  // VAD Parameters (these might need tuning)
  const SPEECH_THRESHOLD = 15; // Lower = more sensitive to sound. Range 0-255 for Uint8Array.
  const SILENCE_DURATION_MS = 2000; // How long silence should last to stop recording a segment.
  const MIN_RECORDING_DURATION_MS = 300; // Minimum duration for a segment to be saved.
  const MIN_BLOB_SIZE_TO_SAVE = 1000; // bytes, smaller blobs are likely noise.

  // --- Permission and Setup ---
  const getMicrophonePermission = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('您的浏览器不支持录音功能。');
      setIsMicrophoneBlocked(true);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsMicrophoneBlocked(false);
      audioStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error("获取麦克风权限失败:", err);
      // ... (error messages as before) ...
      setIsMicrophoneBlocked(true);
      return null;
    }
  }, []);

  const setupAudioContext = useCallback(async (stream) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (!sourceRef.current) {
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    }
    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512; // Smaller FFT size for faster response
      analyserRef.current.smoothingTimeConstant = 0.3; // Adjust smoothing
    }

    sourceRef.current.connect(analyserRef.current);
    dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
    console.log("AudioContext 和 AnalyserNode 设置完毕。");
  }, []);


  // --- Recording Logic ---
  const startActualSegmentRecording = useCallback(() => {
    if (!audioStreamRef.current || isRecordingSegment) {
      console.warn("无法开始录制片段：无音频流或已在录制中。");
      return;
    }
    if (!audioStreamRef.current.active) {
      console.error("音频流无效，无法开始录制。");
      // Potentially try to re-acquire stream or stop listening
      stopListeningProcess();
      alert("麦克风音频流似乎已断开，请尝试重新开始监听。");
      return;
    }

    console.log("检测到语音，开始录制片段...");
    setIsRecordingSegment(true);
    audioChunksRef.current = [];

    try {
      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/webm' };
         if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = {}; // Browser default
         }
      }
      console.log("MediaRecorder 使用 mimeType:", options.mimeType || "浏览器默认");
      mediaRecorderRef.current = new MediaRecorder(audioStreamRef.current, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log("片段录制停止 (onstop event)。");
        const segmentBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
        const duration = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0); // Simplistic size check, not actual duration

        // console.log("Blob size:", segmentBlob.size, "min size:", MIN_BLOB_SIZE_TO_SAVE);
        // A proper duration check would require decoding or more complex MediaRecorder time tracking.
        // For now, rely on blob size and the silence timer to infer meaningful recording.
        if (segmentBlob.size > MIN_BLOB_SIZE_TO_SAVE) {
          const audioUrl = URL.createObjectURL(segmentBlob);
          setRecordings(prev => [
            ...prev,
            { url: audioUrl, id: Date.now(), blob: segmentBlob, name: `片段 ${prev.length + 1}` }
          ]);
          console.log("片段已保存。");
        } else {
          console.log("录制片段过小，已丢弃。");
        }
        audioChunksRef.current = [];
        setIsRecordingSegment(false); // Ready for next segment
        // VAD loop (checkForSpeech) will continue if isListening is true
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder 错误:", event.error);
        setIsRecordingSegment(false);
      };

      mediaRecorderRef.current.start(); // Start recording the segment
    } catch (err) {
      console.error("创建 MediaRecorder 失败:", err);
      setIsRecordingSegment(false);
    }
  }, [isRecordingSegment]); // Add dependencies

  const stopActualSegmentRecording = useCallback(() => {
    console.log("尝试停止当前录音片段...");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); // This will trigger onstop
    } else {
      // If not recording (e.g. very short sound burst not meeting min duration or error)
      setIsRecordingSegment(false);
    }
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  }, []);


  // --- VAD (Voice Activity Detection) ---
  const checkForSpeech = useCallback(() => {
    if (!isListening || !analyserRef.current || !dataArrayRef.current) {
      return;
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const average = dataArrayRef.current.length > 0 ? sum / dataArrayRef.current.length : 0;
    // console.log("Average volume:", average.toFixed(2)); // DEBUG: very noisy log

    const isSpeaking = average > SPEECH_THRESHOLD;

    if (isSpeaking && !isRecordingSegment) {
      clearTimeout(silenceTimerRef.current); // Clear any pending silence timer from previous noise
      silenceTimerRef.current = null;
      startActualSegmentRecording();
    } else if (!isSpeaking && isRecordingSegment) {
      if (!silenceTimerRef.current) { // Start silence timer only if not already running
        // console.log("检测到静默，启动静默计时器...");
        silenceTimerRef.current = setTimeout(() => {
          console.log("静默时间达到，停止当前片段。");
          stopActualSegmentRecording();
        }, SILENCE_DURATION_MS);
      }
    } else if (isSpeaking && isRecordingSegment) {
      // console.log("仍在说话，重置静默计时器。");
      clearTimeout(silenceTimerRef.current); // Keep recording, reset silence timer
      silenceTimerRef.current = null;
    }

    if (isListening) { // Ensure loop continues only if still in listening mode
        animationFrameIdRef.current = requestAnimationFrame(checkForSpeech);
    }
  }, [isListening, isRecordingSegment, startActualSegmentRecording, stopActualSegmentRecording, SPEECH_THRESHOLD, SILENCE_DURATION_MS]);


  // --- Control Buttons ---
  const handleStartListening = async () => {
    if (isListening) return;
    console.log("开始监听...");
    const stream = await getMicrophonePermission();
    if (!stream) return;

    await setupAudioContext(stream);
    setIsListening(true);
    animationFrameIdRef.current = requestAnimationFrame(checkForSpeech);
  };

  const stopListeningProcess = useCallback(() => { // Renamed to avoid conflict
    console.log("停止监听过程...");
    setIsListening(false);
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (isRecordingSegment) { // If a segment is being recorded, stop it.
      stopActualSegmentRecording();
    }

    clearTimeout(silenceTimerRef.current); // Clear any pending silence timer
    silenceTimerRef.current = null;

    // Stop MediaStream tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
      console.log("麦克风轨道已停止。");
    }

    // Disconnect and potentially close AudioContext (optional here, could be on unmount)
    if (sourceRef.current && analyserRef.current && sourceRef.current.numberOfOutputs > 0) { // Check if connected
        try {
            sourceRef.current.disconnect(analyserRef.current);
            console.log("AnalyserNode 已断开。");
        } catch(e) {
            console.warn("从 AnalyserNode 断开连接时出错 (可能已断开):", e);
        }
    }
    // sourceRef.current = null; // Keep analyser for potential reuse if context is kept
    // analyserRef.current = null; // Or nullify them if context is closed frequently

    // Consider closing AudioContext if not planning to restart listening soon.
    // For continuous use, keeping it open might be better until component unmounts.
    // if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
    //   audioContextRef.current.close().then(() => console.log("AudioContext closed."));
    //   audioContextRef.current = null;
    // }
    setIsRecordingSegment(false); // Ensure this is reset
  }, [isRecordingSegment, stopActualSegmentRecording]);

  // --- Cleanup on Unmount ---
  useEffect(() => {
    return () => {
      console.log("组件卸载，执行清理...");
      stopListeningProcess(); // Call the main stop logic
      recordings.forEach(record => URL.revokeObjectURL(record.url));

      // Ensure AudioContext is closed on final unmount
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().then(() => console.log("AudioContext 在卸载时关闭。")).catch(e=>console.warn(e));
        audioContextRef.current = null;
      }
    };
  }, [recordings, stopListeningProcess]); // Add stopListeningProcess to dependencies


  const handleDeleteRecording = (idToDelete) => {
    setRecordings(prev =>
      prev.filter(record => {
        if (record.id === idToDelete) {
          URL.revokeObjectURL(record.url);
          return false;
        }
        return true;
      })
    );
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '700px', margin: 'auto' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>语音自动分段录音机</h2>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '10px' }}>
        {!isListening ? (
          <button onClick={handleStartListening} disabled={isMicrophoneBlocked} style={{}}>
            开始监听语音
          </button>
        ) : (
          <button onClick={stopListeningProcess} style={{}}>
            停止监听
          </button>
        )}
      </div>

      {isListening && !isRecordingSegment && (
        <p style={{ textAlign: 'center', color: 'blue' }}>👂 正在聆听中... 请说话...</p>
      )}
      {isRecordingSegment && (
        <p style={{ textAlign: 'center', color: 'red', fontWeight: 'bold' }}>
          🔴 侦测到语音，正在录制片段...
        </p>
      )}
      {isMicrophoneBlocked && (
          <p style={{ textAlign: 'center', color: 'orange', fontWeight: 'bold' }}>
            麦克风权限被阻止或设备不可用。
          </p>
      )}

      <h3 style={{ marginTop: '30px', borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#555' }}>
        录音片段 ({recordings.length})
      </h3>
      {recordings.length === 0 && !isListening && !isRecordingSegment && (
        <p style={{ textAlign: 'center', color: '#777' }}>暂无录音。点击“开始监听语音”并说话。</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {recordings.slice().reverse().map((record) => (
          <li key={record.id} style={{}}>
            <span style={{marginRight: '10px'}}>{record.name} - {new Date(record.id).toLocaleTimeString()}</span>
            <audio src={record.url} controls style={{ flexGrow: 1, marginRight: '10px' }} />
            <button onClick={() => handleDeleteRecording(record.id)} style={{}}>
                删除
            </button>
          </li>
        ))}
      </ul>
      {/* (Button styles are omitted for brevity, use styles from previous example or your own) */}
      <style jsx>{`
        button {
          padding: 10px 15px;
          font-size: 16px;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        button:nth-of-type(1) { /* Start Listening / Stop Listening buttons */
          background-color: ${isListening ? '#f44336' : '#4CAF50'};
        }
        button:hover:not(:disabled) {
          filter: brightness(1.1);
        }
        li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 10px;
          background-color: #f9f9f9;
        }
        li button { /* Delete button */
            background-color: #e74c3c;
            padding: 5px 10px;
            font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default AutoAudioRecorder;