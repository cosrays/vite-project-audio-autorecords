// @ts-nocheck

import React, { useState, useRef, useEffect } from 'react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isMicrophoneBlocked, setIsMicrophoneBlocked] = useState(false);
  const [recordings, setRecordings] = useState([]); // 用于存储所有录音
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);

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
    } catch (err) {
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

  // 开始录音
  const startRecording = async () => {
    // 检查并请求权限
    const stream = await getMicrophonePermission();
    if (!stream) {
      return; // 如果没有获取到流 (权限被拒绝或无设备)
    }
    audioStreamRef.current = stream; // 保存流，以便后续停止

    // 清空上一段录音的缓存数据
    audioChunksRef.current = [];

    try {
      // 尝试使用常见的 MIME 类型
      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn(`${options.mimeType} 不支持，尝试 audio/webm (默认)`);
        options = { mimeType: 'audio/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          console.warn(`${options.mimeType} 不支持，尝试 audio/ogg;codecs=opus`);
          options = { mimeType: 'audio/ogg;codecs=opus' };
           if (!MediaRecorder.isTypeSupported(options.mimeType)) {
              console.warn(`${options.mimeType} 不支持，尝试 audio/mp4`); // Safari 可能支持 mp4
              options = { mimeType: 'audio/mp4' };
               if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.error("没有合适的 audio/webm, audio/ogg 或 audio/mp4 mimeType 支持 MediaRecorder.");
                options = {}; // 使用浏览器默认
               }
           }
        }
      }
      console.log("使用 MediaRecorder MIME 类型:", options.mimeType || "浏览器默认");

      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log('mediaRecorderRef.current.ondataavailable:');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('mediaRecorderRef.current.onstop:');
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordings(prevRecordings => [
          ...prevRecordings,
          { url: audioUrl, id: Date.now(), blob: audioBlob, name: `录音 ${prevRecordings.length + 1}` }
        ]);
        // 清理 stream tracks (可选，如果每次都重新获取 stream)
        // audioStreamRef.current?.getTracks().forEach(track => track.stop());
        // audioStreamRef.current = null;
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder 错误:", event.error);
        alert(`录音过程中发生错误: ${event.error.name}`);
        setIsRecording(false);
        // 发生错误时也清理 stream
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log("录音开始");

    } catch (err) {
      console.error("创建 MediaRecorder 失败:", err);
      alert(`启动录音失败: ${err.message}`);
      // 发生错误时清理 stream
      audioStreamRef.current?.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log("录音停止");
      // 在 onstop 事件中处理 blob 创建和 URL 生成
      // 停止麦克风轨道
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
        console.log("麦克风轨道已停止");
      }
    }
  };

  // 清理: 组件卸载时释放 Object URL
  useEffect(() => {
    return () => {
      recordings.forEach(record => URL.revokeObjectURL(record.url));
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [recordings]);

  const handleDeleteRecording = (idToDelete) => {
    setRecordings(prevRecordings =>
      prevRecordings.filter(record => {
        if (record.id === idToDelete) {
          URL.revokeObjectURL(record.url); // 释放内存
          return false;
        }
        return true;
      })
    );
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>React 录音机</h2>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '10px' }}>
        {!isRecording ? (
          <button
            onClick={startRecording}
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
          🔴 正在录音中...
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
        <p style={{ textAlign: 'center', color: '#777' }}>暂无录音。点击“开始录音”来创建您的第一个录音！</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {recordings.slice().reverse().map((record) => ( // 使用 slice().reverse() 来显示最新的在前面
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
              backgroundColor: '#f9f9f9'
            }}
          >
            <span style={{marginRight: '10px', color: '#333'}}>{record.name} - {new Date(record.id).toLocaleTimeString()}</span>
            <audio src={record.url} controls style={{ flexGrow: 1, marginRight: '10px' }} />
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
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AudioRecorder;