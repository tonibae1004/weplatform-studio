/* 라이브러리 · 포스팅 큐 */
const Library = (() => {
  let filter = 'all'; let assets = []; let posts = [];
  const urlCache = new Map();
  const objUrl = (blob, key) => { if (!urlCache.has(key)) urlCache.set(key, URL.createObjectURL(blob)); return urlCache.get(key); };

  async function load() {
    assets = (await DB.all('assets')).sort((a, b) => b.createdAt - a.createdAt);
    posts = (await DB.all('posts')).sort((a, b) => b.createdAt - a.createdAt);
    renderGrid(); renderPosts();
  }

  function renderGrid() {
    const grid = $('#lib-grid'); const list = assets.filter(a => filter === 'all' || a.type === filter);
    if (!list.length) { grid.innerHTML = `<div class="card muted" style="grid-column:1/-1">저장된 소재가 없습니다. 이미지/영상 생성 후 <b>라이브러리 저장</b>을 누르거나 파일을 가져오세요.</div>`; return; }
    grid.innerHTML = list.map(a => `
      <div class="lib-item" data-id="${a.id}">
        <div class="thumb ${a.orientation === 'landscape' ? 'landscape' : ''}" style="background-image:url('${a.thumb || ''}')">
          <span class="tag chip ${a.type === 'video' ? 'info' : 'ok'}">${a.type === 'video' ? '🎬 영상 ' + (a.duration || '') + 's' : '🖼️ 이미지 ×' + a.files.length}</span>
        </div>
        <div class="body">
          <div class="title" title="${Util.esc(a.title)}">${Util.esc(a.title)}</div>
          <div class="muted small">${Util.fmtDate(a.createdAt)} · ${a.width}×${a.height} · ${Util.fmtSize(a.size)}${a.meta?.review ? ' · 검수 ' + a.meta.review.grade : ''}${a.source ? ' · ' + a.source : ''}</div>
          <div class="small">${a.publicUrl ? '<span class="chip ok">🔗 공개 URL</span>' : '<span class="chip">공개 URL 없음</span>'}</div>
          <div class="actions">
            <button class="btn sm" data-act="view">보기</button>
            <button class="btn sm" data-act="dl">다운로드</button>
            <button class="btn sm" data-act="url">URL</button>
            <button class="btn sm primary" data-act="post">포스팅</button>
            <button class="btn sm danger" data-act="del">삭제</button>
          </div>
        </div>
      </div>`).join('');
    $$('.lib-item', grid).forEach(el => el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const a = assets.find(x => x.id === el.dataset.id); actions[b.dataset.act](a);
    }));
  }

  const actions = {
    view(a) {
      const body = a.type === 'video'
        ? `<video controls autoplay src="${objUrl(a.files[0].blob, a.id + '0')}" style="max-height:70vh"></video>`
        : `<div class="row" style="align-items:flex-start">${a.files.map((f, i) => `<img src="${objUrl(f.blob, a.id + i)}" style="width:160px;border-radius:8px;border:1px solid var(--line)">`).join('')}</div>`;
      Util.modal(`<h2>${Util.esc(a.title)}</h2><p class="muted small">${a.width}×${a.height} · ${Util.fmtSize(a.size)}</p>${body}<div class="field mt"><label>캡션/자막</label><textarea readonly>${Util.esc(a.caption || '')}</textarea></div>`);
    },
    dl(a) { a.files.forEach((f, i) => setTimeout(() => Util.download(f.blob, `${a.title.replace(/[\\/:*?"<>|]/g, '_')}_${f.name}`), i * 400)); },
    url(a) {
      const m = Util.modal(`<h2>공개 URL 등록</h2><p class="muted small">Instagram·TikTok(PULL_FROM_URL)은 공개적으로 접근 가능한 미디어 URL이 필요합니다. 사내 CDN/스토리지에 올린 뒤 URL을 입력하세요. 이미지 여러 장은 줄바꿈으로 구분합니다.</p>
        <div class="field"><textarea id="url-input" rows="4">${Util.esc(a.publicUrl || '')}</textarea></div><div class="row"><button class="btn primary" id="url-save">저장</button></div>`);
      $('#url-save', m.el).onclick = async () => { a.publicUrl = $('#url-input', m.el).value.trim(); await DB.put('assets', a); m.close(); renderGrid(); Util.toast('공개 URL을 저장했습니다.', 'ok'); };
    },
    async del(a) { if (!confirm(`"${a.title}" 소재를 삭제할까요?`)) return; await DB.del('assets', a.id); await load(); },
    post(a) { openPostModal(a); }
  };

  /* ---------- 포스팅 모달 ---------- */
  function openPostModal(a) {
    const plats = Object.entries(Poster.PLATFORMS);
    const m = Util.modal(`
      <h2>자동 포스팅 — ${Util.esc(a.title)}</h2>
      <div class="field"><label>게시 매체</label><div class="row">
        ${plats.map(([k, p]) => { const ok = Poster.connected(k); const acc = p.accepts.includes(a.type);
          return `<label class="chip ${ok && acc ? 'ok' : ''}" title="${!acc ? '이 소재 유형 미지원' : ok ? '연동됨' : '미연동'}"><input type="checkbox" class="post-plat" value="${k}" ${ok && acc ? 'checked' : ''} ${!acc ? 'disabled' : ''}> ${p.icon} ${p.label} ${!acc ? '(미지원)' : ok ? '' : '(미연동)'}</label>`; }).join('')}
      </div></div>
      <div class="grid-2">
        <div class="field"><label>제목 (YouTube)</label><input type="text" id="post-title" value="${Util.esc(a.title)}"></div>
        <div class="field"><label>공개 범위</label><select id="post-privacy"><option value="public">공개</option><option value="unlisted">일부공개</option><option value="private">비공개</option></select></div>
      </div>
      <div class="field"><label>캡션 / 설명 <span id="post-len" class="muted"></span></label><textarea id="post-caption" rows="6">${Util.esc(a.caption || '')}</textarea></div>
      <div class="grid-2">
        <div class="field"><label>예약 시각 (비우면 즉시)</label><input type="datetime-local" id="post-when"></div>
        <div class="field"><label>&nbsp;</label><button class="btn" id="post-review-btn">🔍 매체별 검수</button></div>
      </div>
      <div id="post-review" class="review hidden"></div>
      <div class="row mt" style="justify-content:flex-end"><button class="btn" id="post-cancel">취소</button><button class="btn primary" id="post-go">게시 / 예약 등록</button></div>`);
    const cap = $('#post-caption', m.el); const len = () => $('#post-len', m.el).textContent = `${[...cap.value].length}자 · 해시태그 ${(cap.value.match(/#[^\s#]+/g) || []).length}개`;
    cap.addEventListener('input', len); len();
    const chosen = () => $$('.post-plat:checked', m.el).map(c => c.value);
    const runReview = () => {
      const pl = chosen().map(k => k === 'meta' ? 'instagram' : k); if (!pl.length) pl.push('instagram');
      const r = Review.checkMulti(cap.value, pl, { kind: 'caption', title: $('#post-title', m.el).value });
      r.sourceText = cap.value; r.context = '게시 매체: ' + pl.join(', ');
      Review.render($('#post-review', m.el), r, { title: '매체별 카피 검수' }); return r;
    };
    $('#post-review-btn', m.el).onclick = runReview;
    $('#post-cancel', m.el).onclick = m.close;
    $('#post-go', m.el).onclick = async () => {
      const pl = chosen(); if (!pl.length) return Util.toast('매체를 선택하세요.', 'err');
      const r = runReview();
      if (!r.passed && !confirm(`검수에서 오류 ${r.counts.error}건이 발견되었습니다. 정책 위반 소지가 있는 상태로 게시하시겠습니까?`)) return;
      const when = $('#post-when', m.el).value ? new Date($('#post-when', m.el).value).getTime() : Date.now();
      const post = { id: Util.uid(), assetId: a.id, assetTitle: a.title, platforms: pl, title: $('#post-title', m.el).value, caption: cap.value, privacy: $('#post-privacy', m.el).value,
        scheduledAt: when, createdAt: Date.now(), status: when > Date.now() + 30000 ? 'scheduled' : 'queued', results: {}, review: { score: r.score, grade: r.grade } };
      await DB.put('posts', post); m.close(); await load();
      Util.toast(post.status === 'scheduled' ? `${Util.fmtDate(when)}에 예약되었습니다.` : '게시를 시작합니다.', 'ok');
      tick();
    };
  }

  /* ---------- 큐 ---------- */
  const STATUS = { scheduled: ['예약됨', 'info'], queued: ['대기', 'warn'], posting: ['전송 중', 'warn'], posted: ['게시 완료', 'ok'], partial: ['일부 실패', 'warn'], failed: ['실패', 'err'] };
  function renderPosts() {
    const tb = $('#post-table tbody');
    if (!posts.length) { tb.innerHTML = '<tr><td colspan="6" class="muted">포스팅 내역이 없습니다.</td></tr>'; return; }
    tb.innerHTML = posts.map(p => `<tr>
      <td><b>${Util.esc(p.assetTitle)}</b><div class="muted small">검수 ${p.review?.grade || '-'} · ${Util.esc(p.caption.slice(0, 40))}…</div></td>
      <td>${p.platforms.map(k => Poster.PLATFORMS[k].icon + ' ' + Poster.PLATFORMS[k].label).join('<br>')}</td>
      <td>${Util.fmtDate(p.scheduledAt)}</td>
      <td><span class="chip ${STATUS[p.status][1]}">${STATUS[p.status][0]}</span></td>
      <td class="small">${Object.entries(p.results || {}).map(([k, r]) => `<div>${Poster.PLATFORMS[k].icon} ${r.ok ? '✅' : '❌'} ${Util.esc(r.msg)}${r.url ? ` <a href="${r.url}" target="_blank">열기</a>` : ''}</div>`).join('') || '<span class="muted">-</span>'}</td>
      <td class="row">${['failed', 'partial'].includes(p.status) ? `<button class="btn sm" data-retry="${p.id}">재시도</button>` : ''}<button class="btn sm danger" data-del="${p.id}">삭제</button></td>
    </tr>`).join('');
    $$('[data-retry]', tb).forEach(b => b.onclick = async () => { const p = posts.find(x => x.id === b.dataset.retry); p.status = 'queued'; p.scheduledAt = Date.now(); await DB.put('posts', p); tick(); });
    $$('[data-del]', tb).forEach(b => b.onclick = async () => { await DB.del('posts', b.dataset.del); await load(); });
  }

  let ticking = false;
  async function tick() {
    if (ticking) return; ticking = true;
    try {
      const due = (await DB.all('posts')).filter(p => ['scheduled', 'queued'].includes(p.status) && p.scheduledAt <= Date.now());
      for (const p of due) {
        p.status = 'posting'; await DB.put('posts', p); await load();
        const asset = await DB.get('assets', p.assetId);
        if (!asset) { p.status = 'failed'; p.results = { [p.platforms[0]]: { ok: false, msg: '소재가 삭제되었습니다.' } }; }
        else {
          p.results = await Poster.publish(p, asset);
          const oks = Object.values(p.results).filter(r => r.ok).length;
          p.status = oks === p.platforms.length ? 'posted' : oks ? 'partial' : 'failed';
          if (oks) { asset.platforms = [...new Set([...(asset.platforms || []), ...Object.keys(p.results).filter(k => p.results[k].ok)])]; await DB.put('assets', asset); }
        }
        p.postedAt = Date.now(); await DB.put('posts', p);
        Util.toast(`${p.assetTitle}: ${STATUS[p.status][0]}`, p.status === 'posted' ? 'ok' : 'err');
      }
    } finally { ticking = false; await load(); }
  }

  async function importFiles(files) {
    for (const f of files) {
      const isVideo = f.type.startsWith('video'); let thumb = '', w = 0, h = 0, duration = 0;
      if (isVideo) {
        await new Promise(res => { const v = document.createElement('video'); v.src = URL.createObjectURL(f); v.muted = true; v.onloadeddata = () => { v.currentTime = Math.min(1, v.duration / 3); }; v.onseeked = () => { const c = document.createElement('canvas'); c.width = 320; c.height = 320 * v.videoHeight / v.videoWidth; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); thumb = c.toDataURL('image/jpeg', .7); w = v.videoWidth; h = v.videoHeight; duration = Math.round(v.duration); res(); }; v.onerror = res; });
      } else { const im = await Util.loadImage(await Util.fileToDataURL(f)); w = im.width; h = im.height; const c = document.createElement('canvas'); c.width = 320; c.height = 320 * h / w; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); thumb = c.toDataURL('image/jpeg', .7); }
      await DB.saveAsset({ type: isVideo ? 'video' : 'image', title: f.name.replace(/\.[^.]+$/, ''), orientation: w >= h ? 'landscape' : 'portrait', width: w, height: h, duration, files: [{ name: f.name, blob: f, mime: f.type }], thumb, caption: '', size: f.size, source: '가져옴' });
    }
    Util.toast(`${files.length}개 파일을 가져왔습니다.`, 'ok');
  }

  function init() {
    $$('#lib-filter button').forEach(b => b.onclick = () => { filter = b.dataset.v; $$('#lib-filter button').forEach(x => x.classList.toggle('active', x === b)); renderGrid(); });
    $('#lib-import').addEventListener('change', e => importFiles([...e.target.files]));
    document.addEventListener('assets:changed', load);
    load(); setInterval(tick, 20000); setTimeout(tick, 2000);
  }
  return { init, load, getAssets: () => assets };
})();
