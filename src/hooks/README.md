# useObsUpload Hook

基于 `esdk-obs-browserjs` 封装的 React Hook，提供华为云 OBS 对象存储文件上传功能。

## 功能特性

- ✅ 单文件上传
- ✅ 批量文件上传
- ✅ 实时上传进度跟踪
- ✅ 上传状态管理
- ✅ 暂停/恢复上传（部分支持）
- ✅ 取消上传
- ✅ 错误处理
- ✅ 完整的 TypeScript 类型支持

## 安装依赖

确保项目已安装必要的依赖：

```bash
npm install esdk-obs-browserjs
# 或
pnpm add esdk-obs-browserjs
```

## 基本用法

### 1. 配置 OBS 客户端

```typescript
import useObsUpload, { type ObsConfig } from './hooks/useObsUpload';

const obsConfig: ObsConfig = {
  access_key_id: 'YOUR_ACCESS_KEY_ID',
  secret_access_key: 'YOUR_SECRET_ACCESS_KEY',
  server: 'https://obs.cn-east-3.myhuaweicloud.com',
  security_token: 'OPTIONAL_SECURITY_TOKEN', // 可选，用于临时访问凭证
};
```

### 2. 使用 Hook

```typescript
const {
  upload,
  uploadMultiple,
  cancel,
  pause,
  resume,
  status,
  progress,
  error,
  result,
  isUploading,
  isSuccess,
  isError,
} = useObsUpload(obsConfig);
```

### 3. 单文件上传

```typescript
const handleUpload = async (file: File) => {
  const uploadParams = {
    Bucket: 'your-bucket-name',
    Key: `uploads/${Date.now()}-${file.name}`,
    ContentType: file.type,
    ACL: 'public-read',
  };

  try {
    const result = await upload(file, uploadParams);
    console.log('上传成功:', result);
  } catch (error) {
    console.error('上传失败:', error);
  }
};
```

### 4. 批量上传

```typescript
const handleMultipleUpload = async (files: File[]) => {
  try {
    const results = await uploadMultiple(files, (file, index) => ({
      Bucket: 'your-bucket-name',
      Key: `batch/${Date.now()}-${index}-${file.name}`,
      ContentType: file.type,
      ACL: 'public-read',
    }));
    console.log('批量上传成功:', results);
  } catch (error) {
    console.error('批量上传失败:', error);
  }
};
```

## API 参考

### ObsConfig

OBS 客户端配置接口：

```typescript
interface ObsConfig {
  access_key_id: string; // 访问密钥 ID
  secret_access_key: string; // 秘密访问密钥
  server: string; // OBS 服务端点
  security_token?: string; // 安全令牌（可选）
}
```

### UploadParams

上传参数接口：

```typescript
interface UploadParams {
  Bucket: string; // 存储桶名称
  Key: string; // 对象键名
  ContentType?: string; // 内容类型
  Metadata?: Record<string, string>; // 元数据
  ACL?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
}
```

### UploadProgress

上传进度接口：

```typescript
interface UploadProgress {
  loaded: number; // 已上传字节数
  total: number; // 总字节数
  percentage: number; // 上传百分比
}
```

### UploadStatus

上传状态枚举：

```typescript
enum UploadStatus {
  IDLE = 'idle', // 空闲状态
  UPLOADING = 'uploading', // 上传中
  SUCCESS = 'success', // 上传成功
  ERROR = 'error', // 上传失败
  PAUSED = 'paused', // 已暂停
  CANCELLED = 'cancelled', // 已取消
}
```

### Hook 返回值

```typescript
interface UseObsUploadReturn {
  // 方法
  upload: (file: File, params: UploadParams) => Promise<UploadResult>;
  uploadMultiple: (
    files: File[],
    getParams: (file: File, index: number) => UploadParams
  ) => Promise<UploadResult[]>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;

  // 状态
  status: UploadStatus;
  progress: UploadProgress | null;
  error: Error | null;
  result: UploadResult | null;

  // 计算属性
  isUploading: boolean;
  isSuccess: boolean;
  isError: boolean;
}
```

## 完整示例

查看 `src/examples/ObsUploadExample.tsx` 获取完整的使用示例，包括：

- UI 组件集成
- 进度显示
- 错误处理
- 状态管理
- 批量上传

## 注意事项

1. **安全性**: 不要在前端代码中硬编码访问密钥，建议使用环境变量或后端接口获取临时凭证
2. **跨域配置**: 确保 OBS 存储桶已配置正确的 CORS 规则
3. **文件大小限制**: 注意浏览器和 OBS 的文件大小限制
4. **暂停功能**: 由于 OBS SDK 限制，暂停功能可能不是真正的暂停，只是停止进度更新
5. **错误处理**: 建议在生产环境中添加适当的错误处理和用户提示

## 许可证

MIT License
