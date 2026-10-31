const SCRIPT_VERSION = 'v20261031.7'; // 脚本版本号
/* 华住会新版签到 · Loon / Quantumult X 通用
 * 版本号见第一行。凭据仅保存在各软件本机，不互通，请勿分享。
 * 首次启用请求规则后，进入华住会 APP 签到页获取凭据。
 * 需开启 MITM，并安装、信任当前软件的证书。
 * 以下为配置示例，写在注释中不会自动安装；请合并到对应配置区段。
 *
 * ================= Quantumult X =================
[rewrite_local]
^https:\/\/appgw\.huazhu\.com\/game\/sign_(?:in|header)(?:\?|$) url script-request-header https://raw.githubusercontent.com/Patrick-Xiu/Scripts/main/hzhqd.js

[task_local]
5 8 * * * https://raw.githubusercontent.com/Patrick-Xiu/Scripts/main/hzhqd.js, tag=华住会每日签到, enabled=true

[mitm]
hostname = appgw.huazhu.com

 * ===================== Loon =====================
 * 可使用配套的“华住会签到.plugin”插件，或合并以下配置：
[Script]
http-request ^https:\/\/appgw\.huazhu\.com\/game\/sign_(?:in|header)(?:\?|$) script-path=https://raw.githubusercontent.com/Patrick-Xiu/Scripts/main/hzhqd.js, requires-body=false, timeout=10, tag=华住会获取签到凭据, enable=true
cron "5 8 * * *" script-path=https://raw.githubusercontent.com/Patrick-Xiu/Scripts/main/hzhqd.js, timeout=30, tag=华住会每日签到, enable=true

[Mitm]
hostname = appgw.huazhu.com
 */
const IS_QX = typeof $task !== 'undefined' && typeof $prefs !== 'undefined';
const KEY = 'HZH_NEW_SIGN_HEADERS';
const readData = key => IS_QX ? $prefs.valueForKey(key) : $persistentStore.read(key);
const writeData = (value, key) => IS_QX ? $prefs.setValueForKey(value, key) : $persistentStore.write(value, key);
function requestGet(url, headers) {
  if (IS_QX) {
    return $task.fetch({url, method: 'GET', headers}).then(result => ({
      status: result.statusCode, body: result.body
    }), error => { throw new Error('网络请求失败：' + String(error.error || error.message || error)); });
  }
  return new Promise((resolve, reject) => {
    // Loon 的 timeout 单位为毫秒。
    $httpClient.get({url, headers, timeout: 20000}, (error, response, body) => {
      if (error) {
        const reason = typeof error === 'string' ? error : (error.message || error.error || error.code || '未知网络错误');
        return reject(new Error('网络请求失败：' + String(reason)));
      }
      resolve({status: response ? (response.status || response.statusCode) : '无响应', body});
    });
  });
}
const notify = text => {
  console.log('[华住会签到] ' + text);
  if (IS_QX) $notify('华住会签到', '', text);
  else $notification.post('华住会签到', '', text);
};
console.log('[华住会签到 ' + SCRIPT_VERSION + '] 模式：' + (typeof $request !== 'undefined' ? '获取凭据' : '定时签到'));
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
    if (String($request.method).toUpperCase() === 'OPTIONS') return;
    const headers = headersForSign($request.headers);
    if (!['cookie', 'user-token', 'usertoken', 'token', 'authorization'].some(k => headers[k])) {
      notify('未发现登录凭据，请登录 APP 后重新打开签到页。');
      return;
    }
    if (!writeData(JSON.stringify(headers), KEY)) throw new Error('保存凭据失败');
    notify('签到凭据已保存，可以运行定时任务。');
    return;
  }
  const saved = readData(KEY);
  if (!saved) throw new Error('尚未获取凭据，请启用请求脚本后进入 APP 签到页。');
  const headers = JSON.parse(saved);
  const url = 'https://appgw.huazhu.com/game/sign_in?date=' + Math.floor(Date.now() / 1000);
  const response = await requestGet(url, headers);
  console.log('[华住会签到] HTTP 状态：' + response.status);
  let data;
  try { data = JSON.parse(response.body); } catch (_) { throw new Error('返回内容不是 JSON，请检查网络或重新获取凭据'); }
  const content = data.content || {};
  if (String(data.businessCode) === '1000' && content.signResult === true) {
    notify('签到成功\n积分：' + (content.point ?? '未知') + '\n活跃值：' + (content.activityPoints ?? '未知'));
  } else if (String(data.businessCode) === '5004' &&
             [data.message, data.responseDes].some(value => typeof value === 'string' && value.trim() === '今日已签到')) {
    notify('今日已签到，无需重复签到');
  } else {
    notify('未确认签到成功\n' + (data.message || data.responseDes || '请在 APP 查看签到状态，必要时重新获取凭据') + '\n业务码：' + String(data.businessCode ?? data.code ?? '未知'));
  }
})().catch(error => notify(error.message || '执行失败')).finally(() => $done({}));
