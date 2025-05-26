import AudioRecorder from "@/components/AudioRecorder";
import Send from "@/components/Send";
import './chat.css';

export default function Chat() {
  return (
    <div className="chat-container">
      <div className="flex-1">
        <div className="h-full overflow-y-auto">
          <AudioRecorder />
        </div>
      </div>
      <div>
        <Send />
      </div>
    </div>
  )
}