import { useState, useCallback, useRef } from 'react';
import ObsClient, { type UploadFileParams, type UploadFileResult } from 'esdk-obs-browserjs';

// OBS 配置接口
export interface ObsConfig {
  access_key_id: string;
  secret_access_key: string;
  server: string;
  security_token?: string;
}

// 上传参数接口
export interface UploadParams {
  Bucket: string;
  Key: string;
  ContentType?: string;
  Metadata?: Record<string, string>;
  ACL?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
  PartSize?: number;
  TaskNum?: number;
}

// 上传进度接口
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number; // 上传速度 bytes/s
}

// 上传状态枚举
export enum UploadStatus {
  IDLE = 'idle',
  UPLOADING = 'uploading',
  SUCCESS = 'success',
  ERROR = 'error',
  PAUSED = 'paused',
  CANCELLED = 'cancelled'
}

// 上传结果接口
export interface UploadResult {
  ETag?: string;
  Location?: string;
  Bucket?: string;
  Key?: string;
  VersionId?: string;
}

// Hook 返回值接口
export interface UseObsUploadReturn {
  upload: (file: File, params: UploadParams) => Promise<UploadResult>;
  uploadMultiple: (files: File[], getParams: (file: File, index: number) => UploadParams) => Promise<UploadResult[]>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  status: UploadStatus;
  progress: UploadProgress | null;
  error: Error | null;
  result: UploadResult | null;
  isUploading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

// this.obsConfig = {
//   access: 'NMV9F3KAA0C1FCTLR59Y',
//   secret: 'frwku4oNil0WMvQhDLxk71G0iYhTLnwyjUSZqMHX',
//   endPoint: 'obs.cn-east-3.myhuaweicloud.com',
//   cdnEndPoint: 'front-end-static-cdn.dcraysai.com',
//   bucketName: 'front-end-static',
// };

const obsConfig: ObsConfig = {
  access_key_id: 'NMV9F3KAA0C1FCTLR59Y',
  secret_access_key: 'frwku4oNil0WMvQhDLxk71G0iYhTLnwyjUSZqMHX',
  server: 'https://obs.cn-east-3.myhuaweicloud.com',
};

export function useObsUpload(config: ObsConfig = obsConfig): UseObsUploadReturn {
  const [status, setStatus] = useState<UploadStatus>(UploadStatus.IDLE);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const obsClientRef = useRef<ObsClient | null>(null);
  const resumeHookRef = useRef<any>(null);
  const isPausedRef = useRef(false);

  // 初始化 OBS 客户端
  const getObsClient = useCallback(() => {
    if (!obsClientRef.current) {
      obsClientRef.current = new ObsClient(config);
    }
    return obsClientRef.current;
  }, [config]);

  // 重置状态
  const resetState = useCallback(() => {
    setStatus(UploadStatus.IDLE);
    setProgress(null);
    setError(null);
    setResult(null);
    isPausedRef.current = false;
    resumeHookRef.current = null;
  }, []);

  // 更新进度
  const updateProgress = useCallback((transferredAmount: number, totalAmount: number, totalSeconds: number) => {
    const percentage = Math.round((transferredAmount / totalAmount) * 100);
    const speed = totalSeconds > 0 ? transferredAmount / totalSeconds : 0;

    setProgress({
      loaded: transferredAmount,
      total: totalAmount,
      percentage,
      speed
    });
  }, []);

  // 上传单个文件
  const upload = useCallback(async (file: File, params: UploadParams): Promise<UploadResult> => {
    resetState();
    setStatus(UploadStatus.UPLOADING);

    try {
      const obsClient = getObsClient();

      // 准备上传参数
      const uploadParams: UploadFileParams = {
        Bucket: params.Bucket,
        Key: params.Key,
        SourceFile: file,
        ContentType: params.ContentType || file.type || 'application/octet-stream',
        Metadata: params.Metadata,
        ACL: params.ACL,
        PartSize: params.PartSize || 9 * 1024 * 1024, // 默认 9MB
        TaskNum: params.TaskNum || 3, // 默认并发数为 3
        ProgressCallback: (transferredAmount: number, totalAmount: number, totalSeconds: number) => {
          if (!isPausedRef.current) {
            updateProgress(transferredAmount, totalAmount, totalSeconds);
          }
        },
        EventCallback: (eventType: string, eventParam: any, eventResult: any) => {
          console.log('Upload event:', eventType, eventParam, eventResult);

          // 处理各种事件
          switch (eventType) {
            case 'uploadPartFailed':
            case 'initiateMultipartUploadFailed':
            case 'completeMultipartUploadFailed':
              console.error('Upload event error:', eventType, eventParam);
              break;
          }
        },
        ResumeCallback: (resumeHook: any, uploadCheckpoint: any) => {
          resumeHookRef.current = resumeHook;
          console.log('Resume callback:', uploadCheckpoint);
        }
      };

      return new Promise((resolve, reject) => {
        obsClient.uploadFile(uploadParams, (err: any, result: UploadFileResult) => {
          if (err) {
            console.error('Upload error:', err);
            setError(new Error(err.message || '上传失败'));
            setStatus(UploadStatus.ERROR);
            reject(err);
          } else if (result.CommonMsg.Status < 300) {
            console.log('Upload success:', result);
            const uploadResult = result.InterfaceResult;
            setResult(uploadResult);
            setStatus(UploadStatus.SUCCESS);
            resolve(uploadResult);
          } else {
            const errorMsg = result.CommonMsg.Message || '上传失败';
            console.error('Upload failed:', result.CommonMsg);
            setError(new Error(errorMsg));
            setStatus(UploadStatus.ERROR);
            reject(new Error(errorMsg));
          }
        });
      });
    } catch (err) {
      const error = err as Error;
      console.error('Upload initialization error:', error);
      setError(error);
      setStatus(UploadStatus.ERROR);
      throw error;
    }
  }, [resetState, getObsClient, updateProgress]);

  // 批量上传文件
  const uploadMultiple = useCallback(async (
    files: File[],
    getParams: (file: File, index: number) => UploadParams
  ): Promise<UploadResult[]> => {
    resetState();
    setStatus(UploadStatus.UPLOADING);

    try {
      const results: UploadResult[] = [];
      let completedFiles = 0;
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const params = getParams(file, i);

        // 为每个文件更新整体进度
        const fileResult = await new Promise<UploadResult>((resolve, reject) => {
          const obsClient = getObsClient();

          const uploadParams: UploadFileParams = {
            Bucket: params.Bucket,
            Key: params.Key,
            SourceFile: file,
            ContentType: params.ContentType || file.type || 'application/octet-stream',
            Metadata: params.Metadata,
            ACL: params.ACL,
            PartSize: params.PartSize || 9 * 1024 * 1024,
            TaskNum: params.TaskNum || 3,
            ProgressCallback: (transferredAmount: number, totalAmount: number, totalSeconds: number) => {
              if (!isPausedRef.current) {
                // 计算批量上传的总进度
                const fileProgress = transferredAmount / totalAmount;
                const overallProgress = (completedFiles + fileProgress) / totalFiles;
                const speed = totalSeconds > 0 ? transferredAmount / totalSeconds : 0;

                setProgress({
                  loaded: Math.round(overallProgress * 100), // 这里用百分比表示整体进度
                  total: 100,
                  percentage: Math.round(overallProgress * 100),
                  speed
                });
              }
            },
            EventCallback: (eventType: string, eventParam: any, eventResult: any) => {
              console.log(`File ${i + 1} upload event:`, eventType, eventParam, eventResult);
            }
          };

          obsClient.uploadFile(uploadParams, (err: any, result: UploadFileResult) => {
            if (err) {
              reject(err);
            } else if (result.CommonMsg.Status < 300) {
              completedFiles++;
              resolve(result.InterfaceResult);
            } else {
              reject(new Error(result.CommonMsg.Message || '上传失败'));
            }
          });
        });

        results.push(fileResult);
      }

      setResult(results[results.length - 1]); // 设置最后一个结果
      setStatus(UploadStatus.SUCCESS);
      return results;
    } catch (err) {
      const error = err as Error;
      setError(error);
      setStatus(UploadStatus.ERROR);
      throw error;
    }
  }, [resetState, getObsClient]);

  // 取消上传
  const cancel = useCallback(() => {
    if (resumeHookRef.current && resumeHookRef.current.cancel) {
      resumeHookRef.current.cancel();
    }
    setStatus(UploadStatus.CANCELLED);
    resumeHookRef.current = null;
  }, []);

  // 暂停上传（通过停止进度更新模拟暂停）
  const pause = useCallback(() => {
    isPausedRef.current = true;
    setStatus(UploadStatus.PAUSED);
  }, []);

  // 恢复上传
  const resume = useCallback(() => {
    isPausedRef.current = false;
    setStatus(UploadStatus.UPLOADING);
  }, []);

  // 计算状态
  const isUploading = status === UploadStatus.UPLOADING;
  const isSuccess = status === UploadStatus.SUCCESS;
  const isError = status === UploadStatus.ERROR;

  return {
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
    isError
  };
}

export default useObsUpload;
