import { useRef, useEffect } from 'react';
import { playPcmAudio } from '@/utils/audio';
import Voice from '../Voice';

export default function Bubble({ item }) {
  const voiceQueue = useRef<string>([]);
  const isRunning = useRef(false);

  async function runTask(data) {
    voiceQueue.current.push(data);
    if (isRunning.current) {
      return;
    }

    isRunning.current = true;
    while (voiceQueue.current.length > 0) {
      const nextVoice = voiceQueue.current.shift();
      await playPcmAudio(nextVoice);
    }
    isRunning.current = false;
  }

  useEffect(() => {
    if (item.pcmList?.length) {
      runTask(item.pcmList.at(-1).data);
    }
  }, [item.pcmList]);

  return (
    <div>
      <Voice pcmList={item.pcmList} />
    </div>
  );
}
