// 流式消息返回类型
export enum EChatType {
  TEXT = 'text',
  AUDIO = 'audio',
  STREAM_END = 'stream_end',
}

export enum EMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface IChatMessage {
  content: string;
  finish_reason: string | null;
  role: EMessageRole;
  type: EChatType;
}
export interface IMessage {
  id: string;
  role: EMessageRole;
  content?: string;
  pcmList?: string[];
  isLoading?: boolean;
  isStream?: boolean;
  isFinish?: boolean;
}
