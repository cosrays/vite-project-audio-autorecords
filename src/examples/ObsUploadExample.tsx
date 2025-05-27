import React, { useState } from 'react';
import { Button, Upload, Progress, message, Card, Space, Typography } from 'antd';
import { UploadOutlined, PauseOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import useObsUpload, { UploadStatus, type ObsConfig, type UploadParams } from '../hooks/useObsUpload';

const { Title, Text } = Typography;

// OBS 配置 - 请替换为你的实际配置
const obsConfig: ObsConfig = {
  access_key_id: 'YOUR_ACCESS_KEY_ID',
  secret_access_key: 'YOUR_SECRET_ACCESS_KEY',
  server: 'https://obs.cn-east-3.myhuaweicloud.com', // 请替换为你的 OBS 端点
};

const ObsUploadExample: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bucketName, setBucketName] = useState('your-bucket-name'); // 请替换为你的存储桶名称

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
    isError
  } = useObsUpload(obsConfig);

  // 处理文件选择
  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    return false; // 阻止默认上传行为
  };

  // 开始上传
  const handleUpload = async () => {
    if (!selectedFile) {
      message.error('请先选择文件');
      return;
    }

    const uploadParams: UploadParams = {
      Bucket: bucketName,
      Key: `uploads/${Date.now()}-${selectedFile.name}`, // 生成唯一的文件名
      ContentType: selectedFile.type,
      ACL: 'public-read', // 设置为公开可读
    };

    try {
      const uploadResult = await upload(selectedFile, uploadParams);
      message.success('文件上传成功！');
      console.log('上传结果:', uploadResult);
    } catch (err) {
      message.error('文件上传失败');
      console.error('上传错误:', err);
    }
  };

  // 批量上传示例
  const handleMultipleUpload = async (files: File[]) => {
    try {
      const results = await uploadMultiple(files, (file, index) => ({
        Bucket: bucketName,
        Key: `batch-uploads/${Date.now()}-${index}-${file.name}`,
        ContentType: file.type,
        ACL: 'public-read',
      }));
      message.success(`成功上传 ${results.length} 个文件！`);
      console.log('批量上传结果:', results);
    } catch (err) {
      message.error('批量上传失败');
      console.error('批量上传错误:', err);
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    switch (status) {
      case UploadStatus.IDLE:
        return '待上传';
      case UploadStatus.UPLOADING:
        return '上传中';
      case UploadStatus.SUCCESS:
        return '上传成功';
      case UploadStatus.ERROR:
        return '上传失败';
      case UploadStatus.PAUSED:
        return '已暂停';
      case UploadStatus.CANCELLED:
        return '已取消';
      default:
        return '未知状态';
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>OBS 文件上传示例</Title>

      <Card title="单文件上传" style={{ marginBottom: '24px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>存储桶名称：</Text>
            <input
              type="text"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              style={{ marginLeft: '8px', padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
              placeholder="请输入存储桶名称"
            />
          </div>

          <Upload.Dragger
            beforeUpload={handleFileChange}
            showUploadList={false}
            disabled={isUploading}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到这里上传</p>
            <p className="ant-upload-hint">支持单个文件上传</p>
          </Upload.Dragger>

          {selectedFile && (
            <div>
              <Text>已选择文件：{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</Text>
            </div>
          )}

          <div>
            <Text strong>状态：</Text>
            <Text style={{ color: isError ? 'red' : isSuccess ? 'green' : 'inherit' }}>
              {getStatusText()}
            </Text>
          </div>

          {progress && (
            <Progress
              percent={progress.percentage}
              status={isError ? 'exception' : isSuccess ? 'success' : 'active'}
              format={() => `${progress.percentage}% (${(progress.loaded / 1024 / 1024).toFixed(2)}MB / ${(progress.total / 1024 / 1024).toFixed(2)}MB)`}
            />
          )}

          {error && (
            <Text type="danger">错误信息：{error.message}</Text>
          )}

          {result && isSuccess && (
            <div>
              <Text type="success">上传成功！</Text>
              <div style={{ marginTop: '8px' }}>
                <Text code>ETag: {result.ETag}</Text><br />
                <Text code>Location: {result.Location}</Text>
              </div>
            </div>
          )}

          <Space>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              loading={isUploading}
            >
              开始上传
            </Button>

            {isUploading && (
              <>
                <Button
                  icon={<PauseOutlined />}
                  onClick={pause}
                  disabled={status === UploadStatus.PAUSED}
                >
                  暂停
                </Button>
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={resume}
                  disabled={status !== UploadStatus.PAUSED}
                >
                  恢复
                </Button>
                <Button
                  icon={<StopOutlined />}
                  onClick={cancel}
                  danger
                >
                  取消
                </Button>
              </>
            )}
          </Space>
        </Space>
      </Card>

      <Card title="批量上传">
        <Upload.Dragger
          multiple
          beforeUpload={(file, fileList) => {
            handleMultipleUpload(fileList);
            return false;
          }}
          disabled={isUploading}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽多个文件到这里批量上传</p>
          <p className="ant-upload-hint">支持多文件批量上传</p>
        </Upload.Dragger>
      </Card>

      <Card title="使用说明" style={{ marginTop: '24px' }}>
        <div>
          <Title level={4}>配置说明</Title>
          <ul>
            <li>请在代码中替换 <Text code>YOUR_ACCESS_KEY_ID</Text> 为你的实际 Access Key ID</li>
            <li>请在代码中替换 <Text code>YOUR_SECRET_ACCESS_KEY</Text> 为你的实际 Secret Access Key</li>
            <li>请在代码中替换 OBS 服务端点为你实际的 OBS 区域端点</li>
            <li>请替换存储桶名称为你实际的存储桶名称</li>
          </ul>

          <Title level={4}>功能特性</Title>
          <ul>
            <li>✅ 单文件上传</li>
            <li>✅ 批量文件上传</li>
            <li>✅ 上传进度显示</li>
            <li>✅ 暂停/恢复上传（部分支持）</li>
            <li>✅ 取消上传</li>
            <li>✅ 错误处理</li>
            <li>✅ TypeScript 类型支持</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default ObsUploadExample;