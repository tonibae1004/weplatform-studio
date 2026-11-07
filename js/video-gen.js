/* 쇼츠/릴스/틱톡 영상 생성기 — 4단계 자막, 9:16 또는 16:9 FHD, 캔버스 렌더 + MediaRecorder */
const VideoGen = (() => {
  const FONT = '"Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  const SECTIONS = [
    { key: 'intro', name: '도입', hint: '시선을 잡는 한 줄 (문제 제기 · 궁금증)' },
    { key: 'middle', name: '중반', hint: '핵심 내용 · 혜택 설명' },
    { key: 'climax', name: '절정', hint: '가장 강한 메시지 · 반전 · 혜택 강조' },
    { key: 'ending', name: '결말', hint: '행동 유도 (팔로우 · 링크 · 댓글)' }
  ];
  let theme = THEMES[0], orient = 'portrait', canvas, ctx, raf = null, sectionImages = [null, null, null, null];
  let result = null; // { blob, mime, ext }
  let bgmFile = null;

  const dims = () => orient === 'portrait' ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };

  function data() {
    return {
      brand: $('#vid-brand').value.trim() || 'Brand',
      sections: SECTIONS.map((s, i) => ({ ...s, text: $(`#vid-sec-${i}`).value.trim(), image: sectionImages[i] })),
      duration: +$('#vid-duration').value, pos: $('#vid-pos').value, anim: $('#vid-anim').value,
      targets: { yt: $('#vid-t-yt').checked, ig: $('#vid-t-ig').checked, tt: $('#vid-t-tt').checked }
    };
  }
  const allText = d => d.sections.map(s => s.text).filter(Boolean).join('\n');

  /* ---------- 프레임 렌더 ---------- */
  const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

  function drawFrame(t, d, guides = false) {
    const { w, h } = dims(); const per = d.duration / 4;
    const idx = Math.min(3, Math.floor(t / per)); const local = (t - idx * per) / per; const sec = d.sections[idx];
    const minSide = Math.min(w, h);

    /* 배경 */
    if (sec.image) {
      const im = sec.image; const z = 1.05 + local * .08;
      const r = Math.max(w / im.width, h / im.height) * z; const iw = im.width * r, ih = im.height * r;
      ctx.drawImage(im, (w - iw) / 2 + Math.sin(t) * 10, (h - ih) / 2, iw, ih);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, w, h);
    } else {
      const ang = t * .25; const g = ctx.createLinearGradient(w / 2 + Math.cos(ang) * w, h / 2 + Math.sin(ang) * h, w / 2 - Math.cos(ang) * w, h / 2 - Math.sin(ang) * h);
      g.addColorStop(0, theme.bg[0]); g.addColorStop(1, theme.bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.globalAlpha = .16; ctx.fillStyle = theme.accent;
      for (let i = 0; i < 5; i++) {
        const bx = w * (0.15 + 0.7 * ((Math.sin(t * .4 + i * 1.7) + 1) / 2)); const by = h * (0.1 + 0.8 * ((Math.cos(t * .3 + i * 2.1) + 1) / 2));
        ctx.beginPath(); ctx.arc(bx, by, minSide * (0.08 + i * 0.05), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    /* 어두운 비네트 */
    const vg = ctx.createRadialGradient(w / 2, h / 2, minSide * .3, w / 2, h / 2, Math.max(w, h) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

    /* 상단 진행 바 + 단계 라벨 */
    const barY = orient === 'portrait' ? 250 : 70, barX = w * .08, barW = w * .84;
    for (let i = 0; i < 4; i++) {
      const segW = barW / 4 - 10; const fill = i < idx ? 1 : i === idx ? local : 0;
      ctx.fillStyle = 'rgba(255,255,255,.3)'; Util.roundRect(ctx, barX + i * (barW / 4), barY, segW, 8, 4); ctx.fill();
      ctx.fillStyle = theme.accent; Util.roundRect(ctx, barX + i * (barW / 4), barY, segW * fill, 8, 4); ctx.fill();
    }
    ctx.font = `700 ${minSide * .028}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(d.brand, barX, barY + 24);
    ctx.textAlign = 'right'; ctx.fillStyle = theme.accent; ctx.fillText(`${idx + 1}/4 ${sec.name}`, barX + barW, barY + 24);

    /* 자막 애니메이션 */
    const inT = .18, outT = .12;
    let alpha = 1, dy = 0, scale = 1;
    if (local < inT) { const p = ease(local / inT); alpha = p; dy = d.anim === 'slide' ? (1 - p) * 80 : 0; scale = d.anim === 'zoom' ? .85 + .15 * p : 1; }
    else if (local > 1 - outT) { const p = ease((1 - local) / outT); alpha = p; dy = d.anim === 'slide' ? -(1 - p) * 40 : 0; }
    if (d.anim === 'zoom') scale *= 1 + local * .03;

    const text = sec.text || `${sec.name} 자막을 입력하세요`;
    const size = Math.round(minSide * (orient === 'portrait' ? .078 : .07));
    ctx.font = `800 ${size}px ${FONT}`;
    const maxW = w * .84; const lines = Util.wrapText(ctx, text, maxW).slice(0, 6); const lh = size * 1.3;
    const blockH = lines.length * lh;
    const cy = d.pos === 'center' ? h / 2 : h - (orient === 'portrait' ? h * .28 : h * .2) - blockH / 2;

    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(w / 2, cy + dy); ctx.scale(scale, scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      const y = -blockH / 2 + lh / 2 + i * lh; const tw = ctx.measureText(l).width;
      /* 강조 배경 */
      ctx.fillStyle = idx === 2 ? Util.rgba(theme.accent, .9) : 'rgba(0,0,0,.45)';
      Util.roundRect(ctx, -tw / 2 - 28, y - lh / 2 + 6, tw + 56, lh - 12, 18); ctx.fill();
      ctx.lineWidth = size * .08; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineJoin = 'round';
      ctx.fillStyle = idx === 2 ? (theme.id === 'cream' ? '#fff' : theme.bg[0]) : '#fff';
      if (idx !== 2) ctx.strokeText(l, 0, y);
      ctx.fillText(l, 0, y);
    });
    ctx.restore();

    /* 결말 CTA 배지 */
    if (idx === 3) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.font = `700 ${minSide * .036}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = '👍 좋아요  ·  💬 댓글  ·  ➕ 팔로우'; const tw = ctx.measureText(label).width;
      const by = cy + blockH / 2 + minSide * .08;
      ctx.fillStyle = theme.accent; Util.roundRect(ctx, w / 2 - tw / 2 - 40, by - minSide * .035, tw + 80, minSide * .07, minSide * .035); ctx.fill();
      ctx.fillStyle = theme.id === 'cream' ? '#fff' : theme.bg[0]; ctx.fillText(label, w / 2, by); ctx.restore();
    }

    /* 플랫폼 안전영역 가이드 (미리보기 전용) */
    if (guides && orient === 'portrait') {
      ctx.save(); ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,80,80,.7)';
      ctx.strokeRect(0, 0, w, 270); ctx.strokeRect(0, h - 420, w, 420); ctx.strokeRect(w - 220, h * .4, 220, h * .35);
      ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,80,80,.8)'; ctx.font = `600 28px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('상단 UI 영역', 20, 230); ctx.fillText('하단 캡션/음악 영역', 20, h - 410); ctx.fillText('우측 버튼', w - 200, h * .4 + 10); ctx.restore();
    }
  }

  /* ---------- 미리보기 ---------- */
  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }
  function preview() {
    stop(); const d = data(); const start = performance.now();
    const loop = now => { const t = ((now - start) / 1000) % d.duration; drawFrame(t, d, true); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }

  /* ---------- 녹화 ---------- */
  function pickMime() {
    const cands = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return cands.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  }

  async function record() {
    const d = data();
    if (!d.sections.some(s => s.text)) { Util.toast('자막을 한 단계 이상 입력하세요.', 'err'); return; }
    if (!window.MediaRecorder || !canvas.captureStream) { Util.toast('이 브라우저는 영상 녹화(MediaRecorder)를 지원하지 않습니다. Chrome/Edge를 사용하세요.', 'err'); return; }
    stop();
    try { await document.fonts.load(`800 80px ${FONT}`); } catch { }
    const mime = pickMime(); const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const stream = canvas.captureStream(30);
    let audioCtx = null, audioEl = null;
    if (bgmFile) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioEl = new Audio(URL.createObjectURL(bgmFile)); audioEl.loop = true; audioEl.volume = 1;
        const src = audioCtx.createMediaElementSource(audioEl); const dest = audioCtx.createMediaStreamDestination();
        const gain = audioCtx.createGain(); gain.gain.value = .9; src.connect(gain).connect(dest);
        dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
        await audioEl.play();
      } catch (e) { console.warn('BGM 실패', e); }
    }
    const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8_000_000 });
    const chunks = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const prog = $('#vid-progress'); prog.classList.remove('hidden'); const bar = $('div', prog);
    $('#vid-render-btn').disabled = true; $('#vid-preview-btn').disabled = true;
    $('#vid-result-info').textContent = `렌더링 중... (${d.duration}초 실시간 녹화)`;

    const done = new Promise(res => rec.onstop = res);
    rec.start(200);
    const start = performance.now();
    await new Promise(res => {
      const loop = now => {
        const t = (now - start) / 1000;
        if (t >= d.duration) { drawFrame(d.duration - .001, d); res(); return; }
        drawFrame(t, d); bar.style.width = (t / d.duration * 100).toFixed(1) + '%'; raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
    rec.stop(); await done;
    if (audioEl) { audioEl.pause(); } if (audioCtx) audioCtx.close();
    stream.getTracks().forEach(t => t.stop());
    bar.style.width = '100%';
    const blob = new Blob(chunks, { type: mime || 'video/webm' });
    result = { blob, mime: blob.type, ext, duration: d.duration, data: d };
    const v = $('#vid-result'); v.src = URL.createObjectURL(blob); v.classList.remove('hidden');
    const { w, h } = dims();
    $('#vid-result-info').innerHTML = `✅ 생성 완료 — ${w}×${h} · ${d.duration}초 · ${Util.fmtSize(blob.size)} · ${ext.toUpperCase()}${ext === 'webm' ? ' <span class="muted">(이 브라우저는 MP4 녹화를 지원하지 않아 WebM으로 저장됩니다. YouTube/Meta 업로드 가능, TikTok은 MP4 변환 필요)</span>' : ''}`;
    $('#vid-download-btn').disabled = false; $('#vid-save-btn').disabled = false;
    $('#vid-render-btn').disabled = false; $('#vid-preview-btn').disabled = false;
    setTimeout(() => prog.classList.add('hidden'), 1500);
    Util.toast('영상 생성이 완료되었습니다.', 'ok');
  }

  function review() {
    const d = data(); const plats = []; if (d.targets.yt) plats.push('youtube'); if (d.targets.ig) plats.push('instagram'); if (d.targets.tt) plats.push('tiktok');
    const r = Review.checkMulti(allText(d), plats.length ? plats : ['instagram'], { kind: 'caption' });
    r.sourceText = allText(d); r.context = '15초 쇼츠/릴스 영상 자막 (도입/중반/절정/결말)';
    Review.render($('#vid-review'), r, { title: '영상 자막 검수' });
    return r;
  }

  async function save() {
    if (!result) return;
    const d = result.data; const { w, h } = dims();
    const tc = document.createElement('canvas'); tc.width = orient === 'portrait' ? 270 : 480; tc.height = orient === 'portrait' ? 480 : 270;
    drawFrame(d.duration * .3, d); tc.getContext('2d').drawImage(canvas, 0, 0, tc.width, tc.height);
    const r = Review.checkMulti(allText(d), ['instagram', 'youtube', 'tiktok']);
    const asset = await DB.saveAsset({
      type: 'video', title: d.sections[0].text.slice(0, 40) || '쇼츠 영상', orientation: orient, width: w, height: h, duration: d.duration,
      files: [{ name: `shorts_${w}x${h}.${result.ext}`, blob: result.blob, mime: result.mime }],
      thumb: tc.toDataURL('image/jpeg', .8), caption: allText(d),
      meta: { brand: d.brand, theme: theme.id, review: { score: r.score, grade: r.grade } }, size: result.blob.size
    });
    Util.toast(`라이브러리에 저장되었습니다 (${asset.title}).`, 'ok');
  }

  function setOrient(o) {
    orient = o; const { w, h } = dims(); canvas.width = w; canvas.height = h;
    $('#vid-stage').classList.toggle('portrait', o === 'portrait');
    $$('#vid-orient button').forEach(b => b.classList.toggle('active', b.dataset.v === o));
    updateLabel(); drawFrame(0.5, data(), true);
  }
  function updateLabel() { const { w, h } = dims(); $('#vid-res-label').textContent = `${w} × ${h} · ${$('#vid-duration').value}초 · 30fps`; }

  function init() {
    canvas = $('#vid-canvas'); ctx = canvas.getContext('2d');
    const wrap = $('#vid-sections');
    wrap.innerHTML = SECTIONS.map((s, i) => `
      <div class="field">
        <label><span><b>${i + 1}. ${s.name}</b> · ${s.hint}</span><span class="muted" id="vid-sec-${i}-time"></span></label>
        <textarea id="vid-sec-${i}" rows="2" placeholder="${s.hint}"></textarea>
        <div class="row"><input type="file" accept="image/*" data-sec="${i}" class="vid-sec-img"> <span class="muted small">배경 이미지(선택)</span></div>
      </div>`).join('');
    const updTimes = () => { const per = +$('#vid-duration').value / 4; SECTIONS.forEach((s, i) => $(`#vid-sec-${i}-time`).textContent = `${(i * per).toFixed(1)}s ~ ${((i + 1) * per).toFixed(1)}s`); };
    updTimes();
    $$('.vid-sec-img').forEach(inp => inp.addEventListener('change', async e => {
      const f = e.target.files[0]; sectionImages[+inp.dataset.sec] = f ? await Util.loadImage(await Util.fileToDataURL(f)) : null; drawFrame(0.5, data(), true);
    }));
    $('#vid-bgm').addEventListener('change', e => { bgmFile = e.target.files[0] || null; });
    renderThemeSwatches($('#vid-themes'), t => { theme = t; drawFrame(0.5, data(), true); });
    $$('#vid-orient button').forEach(b => b.onclick = () => setOrient(b.dataset.v));
    $('#vid-duration').addEventListener('change', () => { updTimes(); updateLabel(); });
    $('#vid-preview-btn').onclick = preview;
    $('#vid-render-btn').onclick = record;
    $('#vid-review-btn').onclick = review;
    $('#vid-download-btn').onclick = () => { if (result) Util.download(result.blob, `shorts_${dims().w}x${dims().h}.${result.ext}`); };
    $('#vid-save-btn').onclick = save;
    SECTIONS.forEach((s, i) => $(`#vid-sec-${i}`).addEventListener('input', () => { if (!raf) drawFrame(i * (+$('#vid-duration').value / 4) + .5, data(), true); }));
    document.addEventListener('page:changed', e => { if (e.detail !== 'video') stop(); });
    setOrient('portrait');
  }
  return { init, stop };
})();
