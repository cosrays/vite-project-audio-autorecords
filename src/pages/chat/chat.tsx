import './chat.css';

import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Button } from 'antd';
import { useState } from 'react';

import AudioRecorder from '@/components/AudioRecorder';
import ChatBubble from '@/components/ChatBubble';
import Send from '@/components/Send';
import voiceJson from '@/mock/voice.json';
const pcmList = voiceJson.filter(item => item.type === 'audio');
let pcmIndex = 0;

export default function Chat() {
  const [message, setMessage] = useState<any>({
    pcmList: [],
  });

  function testPlayVoice() {
    setMessage((pre: any) => ({
      pcmList: [...pre.pcmList, pcmList[pcmIndex++]],
    }));
  }

  function onSend(text: string) {
    console.log(text);
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
        <Send onSend={onSend} />
      </div>
    </div>
  );
}
