import { useCallback, useEffect, useRef } from 'react';

type SSECallback = (message: string) => void;
type ErrorCallback = (error: any) => void;

interface UseSSEOptions {
  url: string;
  onMessage: SSECallback;
  onError?: ErrorCallback;
  enabled?: boolean;
}

export function useSSE({ url, onMessage, onError }: UseSSEOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const startSSE = useCallback(
    (body: any, callback?: SSECallback) => {
      abortControllerRef.current = new AbortController();

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      })
        .then(async response => {
          // Check if response is JSON (error response)
          const contentType = response.headers.get('content-type');

          if (contentType && contentType.includes('application/json')) {
            // const data = await response.json();
            // if (data.code === 40001) {
            //   message.error('登录已过期，请重新登录！');
            //   navigate('/login');
            //   return;
            // } else if (data.code !== 200) {
            //   (callback || onMessage)(
            //     JSON.stringify({
            //       content: '网络异常，请稍后再试！',
            //       finishReason: FinishReason.ERROR,
            //     }),
            //   );
            //   return;
            // }
          }

          const reader = response.body?.getReader();

          if (!reader) {
            throw new Error('ReadableStream not supported');
          }

          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          // console.log('decoder: ', decoder);

          const readStream = (): Promise<void> =>
            reader.read().then(res => {
              // console.log('res: ', res);
              const { done, value } = res;

              if (done) {
                console.log('sse done', body);

                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const chunk = buffer.split('\n');

              // console.log('chunk: ', buffer);

              buffer = chunk.pop() || '';

              chunk.forEach(line => {
                if (line.trim().length === 0) return;

                // console.log('line: ', line);

                (callback || onMessage)?.(line.startsWith('data:') ? line.slice(5) : line);
              });

              return readStream();
            });

          return readStream();
        })
        .catch(error => {
          console.error('sse error: ', error);

          if (error.name === 'AbortError') {
            // Ignore abort errors
            return;
          }

          onError?.(error);
        });
    },
    [url, onMessage, onError],
  );

  const stopSSE = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      // stopSSE();
    };
  }, []);

  return {
    stop: stopSSE,
    start: startSSE,
    isActive: abortControllerRef.current !== null,
  };
}
