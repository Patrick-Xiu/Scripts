/* 华住会新版签到 · Loon
 * 请求捕获：^https:\/\/appgw\.huazhu\.com\/game\/sign_in\?
 * 定时执行同一文件。凭据仅保存在 Loon 本机，请勿分享。
 */
const KEY = 'HZH_NEW_SIGN_HEADERS';
const notify = text => {
  console.log('[华住会签到] ' + text);
  $notification.post('华住会签到', '', text);
};
console.log('[华住会签到 v20261031.4] 模式：' + (typeof $request !== 'undefined' ? '获取凭据' : '定时签到'));
function headersForSign(source) {
  const result = {};
  for (const key of Object.keys(source || {})) {
    const name = key.toLowerCase();
    if (['cookie', 'user-token', 'usertoken', 'token', 'authorization', 'client-platform', 'user-agent', 'origin', 'referer', 'accept'].includes(name)) {
      result[name] = source[key];
    }
  }
  return result;
}
(async () => {
  if (typeof $request !== 'undefined') {
    const headers = headersForSign($request.headers);
    if (!['cookie', 'user-token', 'usertoken', 'token', 'authorization'].some(k => headers[k])) {
      notify('未发现登录凭据，请登录 APP 后重新打开签到页。');
      return;
    }
    if (!$persistentStore.write(JSON.stringify(headers), KEY)) throw new Error('保存凭据失败');
    notify('签到凭据已保存，可以运行定时任务。');
    return;
  }
  const saved = $persistentStore.read(KEY);
  if (!saved) throw new Error('尚未获取凭据，请启用请求脚本后进入 APP 签到页。');
  const headers = JSON.parse(saved);
  const url = 'https://appgw.huazhu.com/game/sign_in?date=' + Math.floor(Date.now() / 1000);
  const response = await new Promise((resolve, reject) => {
    $httpClient.get({url, headers, timeout: 20000}, (error, response, body) => {
      if (error) {
        const reason = typeof error === 'string' ? error : (error.message || error.error || error.code || '未知网络错误');
        return reject(new Error('网络请求失败：' + String(reason)));
      }
      console.log('[华住会签到] HTTP 状态：' + (response ? (response.status || response.statusCode || '未知') : '无响应'));
      resolve({response, body});
    });
  });
  let data;
  try { data = JSON.parse(response.body); } catch (_) { throw new Error('返回内容不是 JSON，请检查网络或重新获取凭据'); }
  const content = data.content || {};
  if (String(data.businessCode) === '1000' && content.signResult === true) {
    notify('签到成功\n积分：' + (content.point ?? '未知') + '\n活跃值：' + (content.activityPoints ?? '未知'));
  } else {
    notify('未确认签到成功\n' + (data.message || data.responseDes || '可能已签到或凭据失效，请在 APP 查看') + '\n业务码：' + String(data.businessCode ?? data.code ?? '未知'));
  }
})().catch(error => notify(error.message || '执行失败')).finally(() => $done({}));
