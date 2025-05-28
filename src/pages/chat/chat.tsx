import AudioRecorder from "@/components/AudioRecorder";
import Send from "@/components/Send";
import './chat.css';

export default function Chat() {
  return (
    <div className="chat-container">
      <div className="flex-1 overflow-hidden">
        <div className="h-full">
          <AudioRecorder />
        </div>
      </div>
      <div>
        <Send />
      </div>
    </div>
  )
}