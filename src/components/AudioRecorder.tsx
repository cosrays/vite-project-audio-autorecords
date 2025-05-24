import React, { useState, useEffect, useRef } from 'react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [audioRecordings, setAudioRecordings] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);

  const SILENCE_THRESHOLD = -50; // dB, adjust as needed
  const SILENCE_DURATION = 2000; // ms, how long silence should last to stop recording
  const MIN_RECORDING_DURATION = 500; // ms, minimum recording time to avoid tiny clips

  useEffect(() => {
    return () => {
      // Cleanup on component unmount
      stopListening();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startListening = async () => {
    if (isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      setIsListening(true);
      console.log("Started listening...");

      // Initialize AudioContext and Analyser for VAD
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048; // Standard FFT size
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      // Start VAD loop
      checkForSpeech();

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    // Do not close audioContextRef here if you want to restart listening without re-prompting
    // Or, handle re-initialization if closed. For continuous listening, better to keep it open.

    setIsListening(false);
    setIsRecording(false);
    clearTimeout(silenceTimerRef.current);
    console.log("Stopped listening.");
  };

  const startActualRecording = () => {
    if (!audioStreamRef.current || isRecording) return;

    setIsRecording(true);
    setRecordedChunks([]); // Clear chunks for new recording
    mediaRecorderRef.current = new MediaRecorder(audioStreamRef.current);

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setRecordedChunks((prev) => [...prev, event.data]);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(recordedChunks, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      if (recordedChunks.length > 0 && audioBlob.size > MIN_RECORDING_DURATION / 1000 * 16000 / 8 * 0.1) { // Heuristic for min size
          setAudioRecordings((prev) => [...prev, { url: audioUrl, id: Date.now() }]);
      }
      setRecordedChunks([]); // Clear for next potential recording
      setIsRecording(false);
      // If still listening, continue checking for speech
      if (isListening) {
        checkForSpeech();
      }
    };

    mediaRecorderRef.current.start();
    console.log("Actual recording started...");
    clearTimeout(silenceTimerRef.current); // Clear any pending silence timer
  };

  const stopActualRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); // onstop will handle saving and restarting VAD
      console.log("Actual recording stopped by silence detection.");
    }
    setIsRecording(false); // Ensure isRecording is false if stop is called externally or VAD fails
  };

  const checkForSpeech = () => {
    if (!analyserRef.current || !isListening) {
      if (isRecording) stopActualRecording(); // Stop recording if listening stops
      return;
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const average = sum / dataArrayRef.current.length;

    // Simple VAD: if average volume is above a threshold, consider it speech
    // This is a very basic VAD. Real VAD is more complex.
    const isSpeaking = average > 3; // Adjust this threshold based on mic sensitivity and environment

    if (isSpeaking && !isRecording) {
      console.log("Speech detected, starting recording.");
      startActualRecording();
      clearTimeout(silenceTimerRef.current); // Clear silence timer if speech resumes
    } else if (!isSpeaking && isRecording) {
      console.log("Silence detected, setting timer.");
      clearTimeout(silenceTimerRef.current); // Clear previous timer
      silenceTimerRef.current = setTimeout(() => {
        if (isRecording) { // Check again in case speech resumed quickly
            let currentSum = 0;
            analyserRef.current.getByteFrequencyData(dataArrayRef.current);
            for (let i = 0; i < dataArrayRef.current.length; i++) {
                currentSum += dataArrayRef.current[i];
            }
            const currentAverage = currentSum / dataArrayRef.current.length;
            if (currentAverage <= 3) { // Still silent
                console.log("Silence duration met, stopping recording.");
                stopActualRecording();
            } else {
                console.log("Speech resumed during silence timer, continuing recording.");
                clearTimeout(silenceTimerRef.current);
                checkForSpeech(); // Re-evaluate immediately
            }
        }
      }, SILENCE_DURATION);
    } else if (!isRecording && isListening) {
        // If not recording and still listening, keep checking
        requestAnimationFrame(checkForSpeech);
    } else if (isRecording && isListening) {
        // If recording and still listening, keep checking (e.g. to restart silence timer if speech continues)
        requestAnimationFrame(checkForSpeech);
    }
  };


  return (
    <div>
      <h2>Audio Recorder</h2>
      {!isListening ? (
        <button onClick={startListening}>Start Listening</button>
      ) : (
        <button onClick={stopListening}>Stop Listening</button>
      )}

      {isListening && <p>👂 Listening...</p>}
      {isRecording && <p style={{color: 'red'}}>🔴 Recording speech...</p>}

      <h3>Recorded Audio Clips:</h3>
      {audioRecordings.length === 0 && !isListening && <p>No recordings yet. Click "Start Listening".</p>}
      {audioRecordings.length === 0 && isListening && <p>Listening for speech to record...</p>}
      <ul>
        {audioRecordings.map((record) => (
          <li key={record.id}>
            <audio src={record.url} controls />
            <p>Recorded at: {new Date(record.id).toLocaleTimeString()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AudioRecorder;