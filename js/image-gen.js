/* 카드뉴스 이미지 생성기 — 1080×1920 (9:16) 4장 */
const ImageGen = (() => {
  const W = 1080, H = 1920, PAD = 96;
  const FONT = '"Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  let theme = THEMES[0], bgImage = null, rendered = false;

  function data() {
    return {
      brand: $('#img-brand').value.trim() || 'Brand',
      title: $('#img-title').value.trim(),
      desc: $('#img-desc').value.trim(),
      event: $('#img-event').value.trim(),
      cta: $('#img-cta').value.trim(),
      tags: $('#img-tags').value.trim(),
      badge: $('#img-badge').value.trim() || 'EVENT',
      titleSize: +$('#img-title-size').value,
      align: $('#img-align').value,
      dim: +$('#img-dim').value
    };
  }

  function combinedText(d) { return [d.title, d.desc, d.event, d.cta, d.tags].filter(Boolean).join('\n'); }

  /* ---------- 배경 ---------- */
  function drawBackground(ctx, d, idx) {
    if (bgImage) {
      const r = Math.max(W / bgImage.width, H / bgImage.height);
      const w = bgImage.width * r, h = bgImage.height * r;
      ctx.drawImage(bgImage, (W - w) / 2, (H - h) / 2, w, h);
      ctx.fillStyle = `rgba(0,0,0,${d.dim})`; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,.1)'); g.addColorStop(1, Util.rgba(theme.bg[0], .85));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, theme.bg[0]); g.addColorStop(1, theme.bg[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      /* 장식 도형 */
      ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = theme.accent;
      const seeds = [[880, 260, 300], [160, 1650, 240], [980, 1500, 150]];
      seeds.forEach(([x, y, r], i) => { ctx.beginPath(); ctx.arc(x + (idx * 37 % 90), y - (idx * 53 % 120), r, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
      ctx.save(); ctx.globalAlpha = .07; ctx.strokeStyle = theme.text; ctx.lineWidth = 2;
      for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();
    }
  }

  function drawChrome(ctx, d, idx) {
    /* 상단 브랜드 · 페이지 */
    ctx.fillStyle = theme.text; ctx.textBaseline = 'middle';
    ctx.font = `700 34px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText(d.brand, PAD, 150);
    ctx.textAlign = 'right'; ctx.font = `600 30px ${FONT}`; ctx.globalAlpha = .7;
    ctx.fillText(`0${idx + 1} / 04`, W - PAD, 150); ctx.globalAlpha = 1;
    /* 하단 도트 */
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.fillStyle = i === idx ? theme.accent : Util.rgba(theme.text, .35);
      Util.roundRect(ctx, W / 2 - 110 + i * 60, H - 150, i === idx ? 48 : 20, 12, 6); ctx.fill();
    }
    ctx.textAlign = 'center'; ctx.font = `500 26px ${FONT}`; ctx.fillStyle = Util.rgba(theme.text, .6);
    ctx.fillText(idx < 3 ? '밀어서 다음 장 보기  →' : '저장하고 친구에게 공유하세요', W / 2, H - 100);
  }

  function badge(ctx, text, x, y, align = 'left') {
    ctx.font = `800 30px ${FONT}`; const w = ctx.measureText(text).width + 56;
    const bx = align === 'center' ? x - w / 2 : x;
    ctx.fillStyle = theme.accent; Util.roundRect(ctx, bx, y, w, 60, 30); ctx.fill();
    ctx.fillStyle = theme.id === 'cream' ? '#fff' : theme.bg[0]; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + 28, y + 31);
  }

  function paragraph(ctx, text, x, y, maxW, size, lh, align = 'left', weight = 500, color = theme.text, maxLines = 99) {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
    let lines = Util.wrapText(ctx, text, maxW);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.{2}$/, '…'); }
    const ax = align === 'center' ? x + maxW / 2 : x;
    lines.forEach((l, i) => ctx.fillText(l, ax, y + i * size * lh));
    return y + lines.length * size * lh;
  }

  /* ---------- 카드별 ---------- */
  const cards = [
    /* 1. 표지 */
    (ctx, d) => {
      const align = d.align;
      badge(ctx, d.badge, align === 'center' ? W / 2 : PAD, 640, align);
      ctx.font = `800 ${d.titleSize}px ${FONT}`;
      const lines = Util.wrapText(ctx, d.title || '제목을 입력하세요', W - PAD * 2).slice(0, 5);
      const lh = d.titleSize * 1.22, totalH = lines.length * lh, y0 = 760;
      ctx.textBaseline = 'top'; ctx.textAlign = align;
      const x = align === 'center' ? W / 2 : PAD;
      lines.forEach((l, i) => {
        /* 글자 뒤 하이라이트 바 */
        const tw = ctx.measureText(l).width;
        ctx.fillStyle = Util.rgba(theme.accent, .22);
        ctx.fillRect(align === 'center' ? x - tw / 2 - 10 : x - 10, y0 + i * lh + d.titleSize * .55, tw + 20, d.titleSize * .5);
        ctx.fillStyle = theme.text; ctx.fillText(l, x, y0 + i * lh);
      });
      if (d.desc) paragraph(ctx, d.desc.split(/\n/)[0], PAD, y0 + totalH + 50, W - PAD * 2, 40, 1.5, align, 500, Util.rgba(theme.text, .85), 2);
      ctx.fillStyle = theme.accent; ctx.fillRect(align === 'center' ? W / 2 - 60 : PAD, 560, 120, 8);
    },
    /* 2. 설명 */
    (ctx, d) => {
      badge(ctx, 'ABOUT', PAD, 400);
      paragraph(ctx, d.title || '', PAD, 500, W - PAD * 2, 56, 1.3, 'left', 800, theme.text, 3);
      ctx.fillStyle = Util.rgba(theme.text, .25); ctx.fillRect(PAD, 760, W - PAD * 2, 2);
      paragraph(ctx, d.desc || '설명을 입력하세요', PAD, 810, W - PAD * 2, 50, 1.6, 'left', 500, Util.rgba(theme.text, .95), 14);
    },
    /* 3. 이벤트 내용 */
    (ctx, d) => {
      badge(ctx, d.badge + ' DETAILS', PAD, 380);
      ctx.font = `800 64px ${FONT}`; ctx.fillStyle = theme.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('이벤트 내용', PAD, 470);
      const items = (d.event || '이벤트 내용을 입력하세요').split(/\n/).map(s => s.trim()).filter(Boolean).slice(0, 7);
      let y = 600;
      items.forEach(it => {
        const isPeriod = /^(기간|일정|날짜|period)/i.test(it);
        const boxH = (ctx.font = `600 44px ${FONT}`, Util.wrapText(ctx, it, W - PAD * 2 - 140).length * 60 + 50);
        ctx.fillStyle = isPeriod ? Util.rgba(theme.accent, .25) : Util.rgba(theme.text, .1);
        Util.roundRect(ctx, PAD, y, W - PAD * 2, boxH, 24); ctx.fill();
        /* 체크 아이콘 */
        ctx.beginPath(); ctx.fillStyle = theme.accent; ctx.arc(PAD + 56, y + boxH / 2, 26, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = theme.id === 'cream' ? '#fff' : theme.bg[0]; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(PAD + 42, y + boxH / 2); ctx.lineTo(PAD + 52, y + boxH / 2 + 10); ctx.lineTo(PAD + 70, y + boxH / 2 - 10); ctx.stroke();
        paragraph(ctx, it, PAD + 110, y + 25, W - PAD * 2 - 140, 44, 1.36, 'left', 600);
        y += boxH + 22;
      });
    },
    /* 4. CTA */
    (ctx, d) => {
      ctx.save(); ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.fillStyle = theme.accent; ctx.arc(W / 2, 560, 110, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.font = `800 110px ${FONT}`; ctx.fillStyle = theme.id === 'cream' ? '#fff' : theme.bg[0]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('→', W / 2, 562);
      paragraph(ctx, d.cta || '지금 참여하세요', PAD, 740, W - PAD * 2, 84, 1.25, 'center', 800, theme.text, 4);
      const y = 1180;
      ctx.fillStyle = Util.rgba(theme.text, .12); Util.roundRect(ctx, PAD, y, W - PAD * 2, 300, 28); ctx.fill();
      paragraph(ctx, d.brand, PAD + 40, y + 40, W - PAD * 2 - 80, 48, 1.3, 'center', 800);
      paragraph(ctx, d.tags || '#' + d.brand.replace(/\s|@/g, ''), PAD + 40, y + 130, W - PAD * 2 - 80, 36, 1.5, 'center', 500, theme.accent, 3);
      paragraph(ctx, '👍 좋아요   💬 댓글   🔖 저장   ↗ 공유', PAD, 1560, W - PAD * 2, 38, 1.4, 'center', 600, Util.rgba(theme.text, .8));
    }
  ];

  async function render() {
    const d = data();
    if (!d.title && !d.desc && !d.event) { Util.toast('제목·설명·이벤트 내용 중 하나 이상 입력하세요.', 'err'); return false; }
    try { await document.fonts.load(`800 100px ${FONT}`); await document.fonts.ready; } catch { }
    $$('#img-preview canvas').forEach((c, i) => {
      const ctx = c.getContext('2d'); ctx.clearRect(0, 0, W, H);
      drawBackground(ctx, d, i); cards[i](ctx, d); drawChrome(ctx, d, i);
    });
    rendered = true;
    $('#img-download-btn').disabled = false; $('#img-save-btn').disabled = false;
    return true;
  }

  function review() {
    const d = data();
    const r = Review.checkMulti(combinedText(d), ['instagram'], { kind: 'caption' });
    r.sourceText = combinedText(d); r.context = '인스타그램 릴스 카드뉴스 4장 (제목/설명/이벤트/CTA)';
    Review.render($('#img-review'), r, { title: '카드뉴스 카피 검수 (Instagram 기준)' });
    return r;
  }

  async function blobs() {
    const out = [];
    for (const c of $$('#img-preview canvas')) out.push(await Util.canvasToBlob(c, 'image/png'));
    return out;
  }

  async function download() {
    if (!rendered) await render();
    const d = data(); const bs = await blobs();
    bs.forEach((b, i) => setTimeout(() => Util.download(b, `${d.title || 'card'}_${i + 1}_1080x1920.png`), i * 400));
    Util.toast('PNG 4장 다운로드를 시작합니다.', 'ok');
  }

  async function save() {
    if (!rendered) { if (!(await render())) return; }
    const d = data(); const bs = await blobs();
    const thumb = $('#img-preview canvas'); const tc = document.createElement('canvas'); tc.width = 270; tc.height = 480;
    tc.getContext('2d').drawImage(thumb, 0, 0, 270, 480);
    const r = Review.checkMulti(combinedText(d), ['instagram']);
    const asset = await DB.saveAsset({
      type: 'image', title: d.title || '카드뉴스', orientation: 'portrait', width: W, height: H,
      files: bs.map((b, i) => ({ name: `card_${i + 1}.png`, blob: b, mime: 'image/png' })),
      thumb: tc.toDataURL('image/jpeg', .8), caption: `${d.title}\n\n${d.desc}\n\n${d.event}\n\n${d.cta}\n${d.tags}`.trim(),
      meta: { brand: d.brand, theme: theme.id, review: { score: r.score, grade: r.grade } }, size: bs.reduce((s, b) => s + b.size, 0)
    });
    Util.toast(`라이브러리에 저장되었습니다 (${asset.title}).`, 'ok');
  }

  function init() {
    renderThemeSwatches($('#img-themes'), t => { theme = t; if (rendered) render(); });
    $('#img-bg').addEventListener('change', async e => {
      const f = e.target.files[0]; bgImage = f ? await Util.loadImage(await Util.fileToDataURL(f)) : null; if (rendered) render();
    });
    $('#img-render-btn').onclick = render;
    $('#img-review-btn').onclick = review;
    $('#img-download-btn').onclick = download;
    $('#img-save-btn').onclick = save;
    ['#img-title', '#img-desc', '#img-event', '#img-cta', '#img-tags', '#img-brand', '#img-badge', '#img-title-size', '#img-align', '#img-dim']
      .forEach(s => $(s).addEventListener('input', () => { if (rendered) render(); }));
  }
  return { init, render, data };
})();
