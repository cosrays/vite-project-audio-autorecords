import { Button } from 'antd';
import { useState } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import Send from '@/components/Send';
import ChatBubble from '@/components/ChatBubble';
import './chat.css';

import voiceJson from '@/mock/voice.json';
const pcmList = voiceJson.filter(item => item.type === 'audio');
let pcmIndex = 0;

export default function Chat() {
  const [message, setMessage] = useState<any>({
    pcmList: [],
  });

  function testPlayVoice() {
    setMessage(pre => ({
      pcmList: [...pre.pcmList, pcmList[pcmIndex++]],
    }));
  }

  return (
    <div className="chat-container">
      <Button type="primary" onClick={testPlayVoice}>
        test play voice
      </Button>
      <br />
      <ChatBubble item={message} />
      <div className="flex-1 overflow-hidden">
        <div className="h-full">
          <AudioRecorder />
        </div>
      </div>
      <div>
        <Send />
      </div>
    </div>
  );
}
