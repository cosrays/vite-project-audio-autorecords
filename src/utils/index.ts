
// get 请求特殊字符[、]接口查询异常
export const encodeReplace = (data: any) => {
  for (const key in data) {
    if (typeof data[key] === 'string') {
      data[key] = data[key].replace(/\[|]/g, '');
    }
  }

  return data;
};