import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import { message, Modal } from 'antd';
import axios from 'axios';

import { encodeReplace } from '@/utils';

type RequestConfig = {
  silence?: boolean;
} & AxiosRequestConfig;

const axiosInstance = axios.create({
  timeout: 140000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(config => {
  if (config.method === 'get') {
    if (!config.params) config.params = {};

    config.params = encodeReplace(config.params);
  }

  // config.headers.token = Cookie.getCookie();
  // config.headers['accept-language'] = localStorage.getItem('locale') || 'en_US';

  return config;
}, console.error);

const formatResponse = (response: AxiosResponse & { config: RequestConfig }) => {
  const { data = {}, config } = response;

  if (data instanceof Blob) {
    return data;
  }

  if (data.code === 200) {
    return data;
  } else if (data.code === -1) {
    Modal.error({
      title: '温馨提示',
      content: '该账号已在别处登录，您被迫下线',
      okText: '确认',
      okButtonProps: {
        className: 'w-56',
      },
      afterClose: () => {
        // Cookie.removeCookie();
        location.replace('/login');
        location.reload();
      },
    });
  } else {
    if (data.msg && !config.silence) {
      message.error(data.msg);
    }

    return Promise.reject(data);
  }
};

const formatAjaxError = (fetchInfo: any) => {
  const { response = {} } = fetchInfo;
  const { status, data, config } = response;

  const error = {
    message: data || '服务器内部错误，请稍后重试！',
    status: status,
  };

  if (typeof data === 'object' && typeof data?.error === 'string') {
    error.message = data.error;
  }

  // if (status === ERROR_CODE.NETWORK_ERROR) {
  //   error.message = '网络问题，请稍后重试！';
  // } else if (status === ERROR_CODE.AUTHORIZE_ERROR) {
  //   Cookie.removeCookie();
  //   error.message = '登录已过期，请重新登录！';

  //   window.setTimeout(() => {
  //     location.replace('/login');
  //   }, 100);
  // }

  if (error.message && !config.silence) {
    if (error.message.indexOf('!DOCTYPE html') > -1) {
      //
    } else message.error(error.message);
  }

  return Promise.reject(error);
};

axiosInstance.interceptors.response.use(formatResponse, formatAjaxError);

export type Response<T = any> = {
  code: number;
  msg: string;
  success: boolean;
  traceId: string;
  body: T;
};

export type MyResponse<T = any> = Promise<Response<T> | Blob>;

/**
 *
 * @param url - request url
 * @param data - request data or params
 * @param config - request config
 */
export const request = <T = any>(url: string, data?: any, config?: RequestConfig): MyResponse<T> => {
  url = import.meta.env.VITE_PREFIX_URL + url;

  if (!config) {
    config = {};
  }

  if (!config?.headers) {
    config = config || {};
    config.headers = {
      // Authorization: `Bearer ${accountInfo?.access_token || ''}`,
    };
  }

  if (config && config.method === 'get') {
    return axiosInstance.get(url, {
      params: data,
      ...config,
    });
  } else {
    return axiosInstance.post(url, data, config);
  }
};
