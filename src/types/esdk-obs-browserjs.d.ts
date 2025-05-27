declare module 'esdk-obs-browserjs' {
  export interface ObsConfig {
    access_key_id: string;
    secret_access_key: string;
    server: string;
    security_token?: string;
  }

  export interface UploadFileParams {
    Bucket: string;
    Key: string;
    SourceFile: File | Blob;
    PartSize?: number;
    TaskNum?: number;
    ProgressCallback?: (transferredAmount: number, totalAmount: number, totalSeconds: number) => void;
    EventCallback?: (eventType: string, eventParam: any, eventResult: any) => void;
    ResumeCallback?: (resumeHook: any, uploadCheckpoint: any) => void;
    ContentType?: string;
    Metadata?: Record<string, string>;
    ACL?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
    StorageClass?: string;
    Expires?: number;
    WebsiteRedirectLocation?: string;
    SseKms?: string;
    SseKmsKey?: string;
    SseC?: string;
    SseCKey?: string;
  }

  export interface UploadResult {
    ETag?: string;
    Location?: string;
    Bucket?: string;
    Key?: string;
    VersionId?: string;
  }

  export interface CommonMsg {
    Status: number;
    Code?: string;
    Message?: string;
  }

  export interface UploadFileResult {
    CommonMsg: CommonMsg;
    InterfaceResult: UploadResult;
  }

  export default class ObsClient {
    constructor(config: ObsConfig);

    uploadFile(
      params: UploadFileParams,
      callback: (error: any, result: UploadFileResult) => void
    ): any;
  }
}