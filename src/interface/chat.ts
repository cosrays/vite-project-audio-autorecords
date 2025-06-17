// 流式消息返回类型
export enum IChatType {
  TEXT = 'text',
  AUDIO = 'audio',
  STREAM_END = 'stream_end',
}

export enum IMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface IMessage {
  id: string;
  role: MessageRole;
  content?: string;
  pcmList?: string[];
  isStream?: boolean;
  isFinish?: boolean;
}
