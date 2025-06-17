import './chat.css';

// import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useRef, useState } from 'react';

// import AudioRecorder from '@/components/AudioRecorder';
import ChatBubble from '@/components/ChatBubble';
import Send from '@/components/Sender';
import { useSSE } from '@/hooks/useSSE';
import { EChatType, EMessageRole, type IChatMessage, type IMessage } from '@/interface/chat';
import { playPcmAudio } from '@/utils/audio';
import { v4 as uuidv4 } from 'uuid';

import AutoPlayerList from '@/components/Test/AutoPlayerList';

export default function Chat() {
  const [messageList, setMessageList] = useState<IMessage[]>();
  const [msgLoading, setMsgLoading] = useState(false);

  const voiceQueue = useRef<string[]>([]);
  const isAutoSpeaking = useRef(false);

  async function runTask(data: string) {
    voiceQueue.current.push(data);
    if (isAutoSpeaking.current) {
      return;
    }

    isAutoSpeaking.current = true;
    // while (voiceQueue.current.length > 0) {
    //   const nextVoice = voiceQueue.current.shift();
    //   // console.log('nextVoice', nextVoice);
    //   if (nextVoice) {
    //     await playPcmAudio(nextVoice);
    //   }
    // }
    isAutoSpeaking.current = false;
  }

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
    onError: () => {
      setMsgLoading(false);
    },
  });

  function onSend(text: string) {
    setMsgLoading(true);
    setMessageList(pre => [
      ...(pre || []),
      {
        id: uuidv4(),
        role: EMessageRole.USER,
        content: text,
      },
      {
        id: uuidv4(),
        role: EMessageRole.ASSISTANT,
        content: '',
        pcmList: [],
        isStream: true,
        isLoading: true,
      },
    ]);
    sse.start({
      messages: [{ role: EMessageRole.USER, content: text }],
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

  function onCancel() {
    setMsgLoading(false);
    handleCancel();
  }

  function handleMessage(item: IChatMessage) {
    // console.log('handleMessage', item);
    setMessageList((pre: IMessage[] | undefined) => {
      const nextList = [...(pre || [])];

      const lastItem = nextList[nextList.length - 1];

      lastItem.isLoading = false;
      switch (item.type) {
        case EChatType.STREAM_END:
          lastItem.isStream = false;
          setMsgLoading(false);
          break;
        case EChatType.TEXT:
          lastItem.content += item.content || '';
          console.log('handleMessage text:', item);
          break;
        case EChatType.AUDIO:
          runTask(item.content);
          lastItem.pcmList!.push(item.content);
          break;
      }

      return nextList;
    });
  }

  function handleCancel() {
    setMessageList(pre => {
      const nextList = [...(pre || [])];
      const lastItem = nextList[nextList.length - 1];
      lastItem.isLoading = false;
      lastItem.isStream = false;
      return nextList;
    });
  }

  return (
    <div className="chat-container">
      <AutoPlayerList pcmList={messageList?.find(item => item.pcmList?.length)?.pcmList || []} />
      <div className="flex-1 overflow-y-auto">
        {messageList && messageList.map(item => <ChatBubble key={item.id} item={item} />)}
      </div>

      {/* <div className="flex-1 overflow-hidden">
        <div className="h-full">
          // <AudioRecorder />
        </div>
      </div> */}
      <div>
        <Send onSend={onSend} onCancel={onCancel} loading={msgLoading} />
      </div>
    </div>
  );
}
