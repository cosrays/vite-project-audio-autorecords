import { playPcmAudio } from '@/utils/audio';
import { Select, Button } from 'antd';
import { useState, useEffect } from 'react';
import Voice from '../Voice';

import listData from './pcmData';

export default function AutoPlayerList({ pcmList }: { pcmList: string[] }) {
  const [currentPcm, setCurrentPcm] = useState<string>();
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    setOptions(
      listData.map((item, index) => ({
        key: index,
        label: `第${index + 1}段`,
        value: item.content,
      })),
    );
  }, []);

  useEffect(() => {
    // setOptions(pcmList.map((item, index) => ({ label: `第${index + 1}段`, value: item })));
  }, [pcmList]);

  if (!options?.length) {
    return null;
  }

  async function handlePlay() {
    if (!currentPcm) {
      return;
    }
    await playPcmAudio(currentPcm);
    console.log('播放完成');
  }

  async function handleChange(value: string) {
    setCurrentPcm(value);
    await playPcmAudio(value);
    console.log('播放完成');
  }

  return (
    <div className="align-center flex items-center justify-center gap-2">
      <div>共{options.length}段</div>
      <Select
        style={{ width: 100 }}
        value={currentPcm}
        placeholder="请选择要播放的音频"
        options={options}
        onChange={handleChange}
      />
      <Button type="primary" onClick={handlePlay}>
        播放
      </Button>
      <Voice pcmList={[currentPcm || '']} />
    </div>
  );
}
