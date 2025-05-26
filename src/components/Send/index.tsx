import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { PhoneOutlined, SendOutlined } from '@ant-design/icons';

const { TextArea } = Input;

import styles from './index.module.less';

interface SendProps {
  onSend?: (content: string) => void;
  placeholder?: string;
  loading?: boolean;
}

export default function Send({ onSend, placeholder = "请输入内容...", loading = false }: SendProps) {
  const [content, setContent] = useState('');

  const handleSend = () => {
    if (content.trim()) {
      onSend?.(content.trim());
      setContent(''); // 发送后清空输入框
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.container}>
      <div>
        <TextArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
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
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          disabled={!content.trim() || loading}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
