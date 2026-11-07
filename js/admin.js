/* 관리 — 계정 연동, 힉스필드 API, Claude API, 데이터 */
const Admin = (() => {
  const FIELDS = {
    meta: { igid: '#meta-igid', token: '#meta-token' },
    youtube: { clientId: '#yt-clientid', token: '#yt-token' },
    tiktok: { clientKey: '#tt-clientkey', token: '#tt-token' },
    x: { handle: '#x-handle', token: '#x-token' },
    hf: { key: '#hf-key', secret: '#hf-secret', base: '#hf-base' },
    claude: { apiKey: '#claude-key', model: '#claude-model' },
    proxy: { url: '#proxy-url' }
  };
  const CHIP = { meta: '#st-meta', youtube: '#st-youtube', tiktok: '#st-tiktok', x: '#st-x', hf: '#st-hf', claude: '#st-claude' };

  function loadFields() {
    Object.entries(FIELDS).forEach(([sec, map]) => { const s = Util.settings.section(sec); Object.entries(map).forEach(([k, sel]) => { if (s[k] != null) $(sel).value = s[k]; }); });
    refreshChips();
  }
  function save(sec) {
    const val = {}; Object.entries(FIELDS[sec]).forEach(([k, sel]) => val[k] = $(sel).value.trim());
    Util.settings.setSection(sec, val); refreshChips(); Util.toast('저장되었습니다.', 'ok');
  }
  function refreshChips() {
    Object.entries(CHIP).forEach(([sec, sel]) => {
      const on = sec === 'claude' ? AI.enabled() : Poster.connected(sec); const el = $(sel);
      el.textContent = on ? '연동됨' : (sec === 'claude' ? '미설정' : '미연동'); el.className = 'chip ' + (on ? 'ok' : '');
    });
  }
  async function test(sec) {
    save(sec); const log = $('#log-' + sec); log.textContent = '테스트 중...';
    try { log.textContent = sec === 'claude' ? '✅ 응답: ' + await AI.test() : await Poster.test(sec); }
    catch (e) { log.textContent = '❌ ' + e.message; }
  }

  /* YouTube OAuth (Google Identity Services) */
  function ytOAuth() {
    const clientId = $('#yt-clientid').value.trim(); if (!clientId) return Util.toast('OAuth 클라이언트 ID를 먼저 입력하세요.', 'err');
    if (location.protocol === 'file:') return Util.toast('Google 로그인은 http(s) 주소에서만 동작합니다. 로컬 서버로 실행하거나 토큰을 직접 입력하세요.', 'err');
    const run = () => {
      const tc = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly', callback: r => { if (r.access_token) { $('#yt-token').value = r.access_token; save('youtube'); test('youtube'); } } });
      tc.requestAccessToken();
    };
    if (window.google?.accounts) run(); else { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = run; s.onerror = () => Util.toast('Google 스크립트를 불러오지 못했습니다.', 'err'); document.head.appendChild(s); }
  }

  /* 힉스필드 생성 */
  async function hfRun() {
    if (!Poster.connected('hf')) return Util.toast('힉스필드 Key ID/Secret을 먼저 저장하세요.', 'err');
    const sel = $('#hf-model').value; const path = sel === 'custom' ? $('#hf-model-custom').value.trim() : sel;
    if (!path) return Util.toast('모델 경로를 입력하세요.', 'err');
    let extra = {}; try { extra = JSON.parse($('#hf-extra').value || '{}'); } catch { return Util.toast('추가 파라미터 JSON 형식이 잘못되었습니다.', 'err'); }
    const body = { prompt: $('#hf-prompt').value.trim(), ...extra }; if ($('#hf-image-url').value.trim()) body.image_url = $('#hf-image-url').value.trim();
    const st = $('#hf-status'); const out = $('#hf-result'); const btn = $('#hf-run-btn'); btn.disabled = true; out.innerHTML = '';
    try {
      st.textContent = '요청 전송 중...';
      const sub = await Poster.Higgsfield.submit(path, body);
      st.textContent = `접수됨 (request_id ${sub.request_id}) — 상태 확인 중...`;
      const done = await Poster.Higgsfield.waitFor(sub.request_id, (s, i) => st.textContent = `상태: ${s.status || '?'} (${i * 5}s)`);
      st.textContent = '✅ 완료';
      const urls = findUrls(done);
      out.innerHTML = `<pre class="mono" style="white-space:pre-wrap;background:var(--bg);padding:10px;border-radius:8px;max-height:200px;overflow:auto">${Util.esc(JSON.stringify(done, null, 2))}</pre>` +
        urls.map(u => `<div class="row mt">${/\.(mp4|webm|mov)(\?|$)/i.test(u) ? `<video src="${u}" controls style="max-height:260px"></video>` : `<img src="${u}" style="max-height:260px;border-radius:8px">`}<button class="btn sm primary" data-save="${u}">💾 라이브러리 저장</button><a class="btn sm" href="${u}" target="_blank">열기</a></div>`).join('');
      $$('[data-save]', out).forEach(b => b.onclick = () => saveFromUrl(b.dataset.save, body.prompt));
    } catch (e) { st.textContent = '❌ ' + e.message; }
    btn.disabled = false;
  }
  function findUrls(obj, acc = []) {
    if (typeof obj === 'string') { if (/^https?:\/\/\S+\.(png|jpe?g|webp|mp4|webm|mov)(\?|$)/i.test(obj)) acc.push(obj); }
    else if (obj && typeof obj === 'object') Object.values(obj).forEach(v => findUrls(v, acc));
    return acc;
  }
  async function saveFromUrl(url, prompt) {
    try {
      const r = await fetch(url); const blob = await r.blob(); const isVideo = blob.type.startsWith('video');
      const dt = new DataTransfer(); dt.items.add(new File([blob], (isVideo ? 'higgsfield.mp4' : 'higgsfield.png'), { type: blob.type }));
      const f = dt.files[0]; let thumb = '', w = 0, h = 0;
      if (!isVideo) { const im = await Util.loadImage(URL.createObjectURL(blob)); w = im.width; h = im.height; const c = document.createElement('canvas'); c.width = 320; c.height = 320 * h / w; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); thumb = c.toDataURL('image/jpeg', .7); }
      await DB.saveAsset({ type: isVideo ? 'video' : 'image', title: (prompt || 'Higgsfield 생성').slice(0, 40), orientation: w >= h && w ? 'landscape' : 'portrait', width: w, height: h, files: [{ name: f.name, blob, mime: blob.type }], thumb, caption: prompt || '', size: blob.size, source: 'Higgsfield', publicUrl: url });
      Util.toast('라이브러리에 저장했습니다.', 'ok');
    } catch (e) { Util.toast('결과 파일을 가져오지 못했습니다(CORS). "열기"로 다운로드 후 라이브러리에 가져오기 하세요.', 'err'); }
  }

  /* 데이터 */
  async function exportData() {
    const data = { settings: Util.settings.get(), reports: await DB.all('reports'), posts: await DB.all('posts'), exportedAt: Date.now() };
    Util.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `weplatform-backup-${Util.fmtDate(Date.now()).slice(0, 10)}.json`);
  }
  async function importData(file) {
    const data = JSON.parse(await file.text());
    if (data.settings) localStorage.setItem(Util.settings.key, JSON.stringify(data.settings));
    for (const r of data.reports || []) await DB.put('reports', r);
    for (const p of data.posts || []) await DB.put('posts', p);
    loadFields(); Util.toast('복원되었습니다.', 'ok'); stats();
  }
  async function stats() {
    const a = await DB.all('assets'), p = await DB.all('posts'), r = await DB.all('reports');
    $('#data-stats').textContent = `소재 ${a.length}개 (${Util.fmtSize(a.reduce((s, x) => s + (x.size || 0), 0))}) · 포스팅 ${p.length}건 · 리포트 ${r.length}건`;
  }

  function init() {
    loadFields(); stats();
    $$('#admin-tabs .tab').forEach(t => t.onclick = () => { $$('#admin-tabs .tab').forEach(x => x.classList.toggle('active', x === t)); $$('.admin-tab').forEach(x => x.classList.toggle('hidden', x.id !== 'admin-' + t.dataset.tab)); });
    $$('[data-save]').forEach(b => b.onclick = () => save(b.dataset.save));
    $$('[data-test]').forEach(b => b.onclick = () => test(b.dataset.test));
    $('#yt-oauth-btn').onclick = ytOAuth;
    $('#hf-run-btn').onclick = hfRun;
    $('#hf-model').addEventListener('change', e => { $('#hf-model-custom').disabled = e.target.value !== 'custom'; }); $('#hf-model-custom').disabled = true;
    $('#data-export').onclick = exportData;
    $('#data-import').addEventListener('change', e => e.target.files[0] && importData(e.target.files[0]));
    $('#data-reset').onclick = async () => { if (!confirm('모든 소재·포스팅·리포트·설정을 삭제합니다. 계속할까요?')) return; await DB.clear('assets'); await DB.clear('posts'); await DB.clear('reports'); localStorage.removeItem(Util.settings.key); location.reload(); };
    $('#rule-list').innerHTML = `<table><thead><tr><th>구분</th><th>수준</th><th>설명</th></tr></thead><tbody>${Review.RULES.map(r => `<tr><td>${r.cat}</td><td><span class="chip ${r.level === 'error' ? 'err' : r.level === 'warn' ? 'warn' : 'info'}">${r.level}</span></td><td>${r.msg}</td></tr>`).join('')}<tr><td>글자수·해시태그</td><td><span class="chip err">error</span></td><td>Instagram 2,200자/해시태그 30개, YouTube 제목 100자, X 280자</td></tr><tr><td>카피 품질</td><td><span class="chip info">info</span></td><td>CTA 유무, 느낌표·이모지 과다, 반복 단어, 링크 클릭 불가 안내</td></tr></tbody></table>`;
    $('#login-time').textContent = Util.fmtDate(+sessionStorage.getItem('wp.loginAt') || Date.now());
    document.addEventListener('assets:changed', stats);
    document.addEventListener('page:changed', e => { if (e.detail === 'admin') { refreshChips(); stats(); } });
  }
  return { init };
})();
