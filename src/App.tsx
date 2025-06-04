import './App.css';
import { Tabs } from 'antd';
import Chat from './pages/chat/chat';
import AudioPlayerDemo from './components/AudioPlayer/demo';

function App() {
  const items = [
    {
      key: '1',
      label: '聊天',
      children: <Chat />,
    },
    {
      key: '2',
      label: '音频播放器',
      children: <AudioPlayerDemo />,
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Tabs defaultActiveKey="2" items={items} />
    </div>
  );
}

export default App;
