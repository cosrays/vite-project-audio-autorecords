import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { PauseCircleOutlined, PhoneOutlined, SendOutlined } from '@ant-design/icons';

const { TextArea } = Input;
import SpinExpand from '../SpinExpand';

import styles from './index.module.less';

interface SendProps {
  onSend?: (content: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  loading?: boolean;
}

export default function Send({ onSend, onCancel, placeholder = '请输入内容...', loading = false }: SendProps) {
  const [content, setContent] = useState('');

  const handleSend = () => {
    if (content.trim()) {
      onSend?.(content.trim());
      setContent(''); // 发送后清空输入框
    }
  };

  const handleCancel = () => {
    setContent('');
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <SpinExpand className={styles.container}>
      <div>
        <TextArea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoSize={{ minRows: 2 }}
          style={{ flex: 1 }}
        />
      </div>

      <div className={styles.btnContainer}>
        <div>
          <PhoneOutlined />
        </div>
        {loading ? (
          <Button icon={<PauseCircleOutlined />} onClick={handleCancel}>
            取消
          </Button>
        ) : (
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!content.trim() || loading}>
            发送
          </Button>
        )}
      </div>
    </SpinExpand>
  );
}
