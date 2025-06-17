import { useMemo } from 'react';
// import { playPcmAudio } from '@/utils/audio';

import { EMessageRole, type IMessage } from '@/interface/chat';
import cls from 'classnames';

import Voice from '../Voice';
import Loading from './Loading';

import styles from './index.module.less';

export default function Bubble({ item }: { item: IMessage }) {
  const isEnd = useMemo(() => {
    return item.role === EMessageRole.USER;
  }, [item.role]);

  return (
    <div className={cls('flex', { 'justify-end': isEnd })}>
      <div>
        {item.role === EMessageRole.ASSISTANT && !item.isStream && <Voice pcmList={item.pcmList || []} />}
        {item.isLoading && <Loading />}
        <div className={cls({ [styles.userChat]: isEnd })}>{item.content}</div>
      </div>
    </div>
  );
}
