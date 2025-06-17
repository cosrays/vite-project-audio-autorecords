import './chat.css';

// import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Button } from 'antd';
import { useState } from 'react';

import AudioRecorder from '@/components/AudioRecorder';
import ChatBubble from '@/components/ChatBubble';
import Send from '@/components/Send';
import voiceJson from '@/mock/voice.json';
import { useSSE } from '@/hooks/useSSE';
import { IMessageRole, IMessage } from '@/interface/chat';
import { v4 as uuidv4 } from 'uuid';

const pcmList = voiceJson.filter(item => item.type === 'audio');
let pcmIndex = 0;

export default function Chat() {
  const [messageList, setMessageList] = useState<IMessage[]>({
    pcmList: [],
  });

  const sse = useSSE({
    url: 'http://1.94.96.230:32001/ttsllm/chat/completions',
    onMessage: (message: string) => {
      try {
        const chatItem = JSON.parse(message);
        handleMessage(chatItem);
      } catch (error) {
        //
      }
    },
  });

  function testPlayVoice() {
    setMessageList((pre: any) => ({
      pcmList: [...pre.pcmList, pcmList[pcmIndex++]],
    }));
  }

  function onSend(text: string) {
    console.log(text);
    setMessageList(pre => [
      ...pre,
      {
        id: uuidv4(),
        role: IMessageRole.USER,
        content: text,
      },
      {
        id: uuidv4(),
        role: IMessageRole.ASSISTANT,
        content: '',
        pcmList: [],
      },
    ]);
    sse.start({
      messages: [{ role: IMessageRole.USER, content: text }],
    });
    // fetchEventSource('http://1.94.96.230:32001/ttsllm/chat/completions', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     messages: [{ role: 'user', content: text }],
    //   }),
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   onmessage(event) {
    //     console.log(event);
    //   },
    // });
  }

  function handleMessage(item) {}

  return (
    <div className="chat-container">
      <Button type="primary" onClick={testPlayVoice}>
        test play voice
      </Button>
      <br />
      <ChatBubble item={messageList} />
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
