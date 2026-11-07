/* 카피 품질 · 정책 검수 엔진 (규칙 기반 + 선택적 AI 심층 검수) */
const Review = (() => {
  const LIMITS = {
    instagram: { caption: 2200, hashtags: 30, label: 'Instagram' },
    youtube: { title: 100, description: 5000, label: 'YouTube' },
    tiktok: { caption: 2200, label: 'TikTok' },
    x: { caption: 280, label: 'X' }
  };

  /* 규칙: level error(게시 불가) / warn(수정 권장) / info(참고) */
  const RULES = [
    { id: 'abs', level: 'warn', cat: '표시광고법', re: /(최고|최초|유일|1\s*위|No\.?\s*1|넘버원|100\s*%|완벽|완전무결|무조건|절대|보장|확실(히|한)|최상|최저가|업계\s*최고|국내\s*유일|세계\s*최초)/g,
      msg: '객관적 근거가 없는 절대적·최상급 표현은 과장광고로 제재될 수 있습니다. 근거 자료(조사기관·시점)를 병기하거나 완화하세요.' },
    { id: 'medical', level: 'error', cat: '의료법·건강기능식품법', re: /(치료|완치|질병\s*예방|효능|부작용\s*없|면역력\s*(강화|증진)|살이\s*빠|체중\s*감량\s*효과|탈모\s*치료|피부\s*재생|항암|혈압\s*(개선|조절)|당뇨\s*(개선|치료))/g,
      msg: '질병의 치료·예방 효능을 암시하는 표현은 의료법/건강기능식품법 위반 소지가 있습니다. 삭제하거나 인증 범위 내 표현으로 바꾸세요.' },
    { id: 'finance', level: 'error', cat: '금융소비자보호법', re: /(원금\s*보장|수익\s*보장|고수익\s*보장|무위험|확정\s*수익|월\s*\d+\s*%\s*수익)/g,
      msg: '수익·원금 보장 표현은 금융 광고 규정 위반입니다. 반드시 삭제하세요.' },
    { id: 'beforeafter', level: 'warn', cat: 'Meta 광고정책', re: /(비포\s*[&/]?\s*애프터|before\s*[&/]?\s*after|사용\s*전후|전\s*\/\s*후\s*비교)/gi,
      msg: 'Meta는 신체 변화를 강조하는 비포/애프터 이미지·문구를 제한합니다. 결과를 암시하지 않도록 수정하세요.' },
    { id: 'personal', level: 'warn', cat: 'Meta 개인 특성 지칭', re: /(뚱뚱한\s*당신|우울한\s*당신|빚\s*있는\s*당신|당신의\s*(체중|질병|빚|나이)|살\s*찐\s*분들)/g,
      msg: '개인의 신체·건강·재정 상태를 직접 지칭하는 문구는 Meta 정책 위반입니다. 일반적 표현으로 바꾸세요.' },
    { id: 'restricted', level: 'warn', cat: '연령제한 품목', re: /(소주|맥주|와인|위스키|주류|술\s*한\s*잔|담배|전자담배|액상|카지노|도박|베팅|토토|성인용)/g,
      msg: '주류·담배·사행성 관련 콘텐츠는 플랫폼별 연령제한·광고 제한 대상입니다. 노출 설정과 정책을 확인하세요.' },
    { id: 'urgency', level: 'info', cat: '기만적 긴급성', re: /(지금\s*당장|오늘만|마감\s*임박|단\s*\d+\s*(명|개)|선착순|곧\s*종료|마지막\s*기회)/g,
      msg: '긴급성 표현은 실제 사실이어야 합니다. 실제 기한·수량을 명시하세요.' },
    { id: 'free', level: 'info', cat: '표시광고법 "무료"', re: /(무료|공짜|0\s*원)/g,
      msg: '"무료" 표현은 부대조건(배송비, 가입조건 등)을 함께 표시해야 합니다.' },
    { id: 'discount', level: 'info', cat: '가격·할인 표시', re: /(\d+\s*%\s*(할인|세일|OFF)|정가|특가)/gi,
      msg: '할인율은 실제 종전 거래가격 기준이어야 하며, 할인 전 가격·기간을 명시하세요.' },
    { id: 'prize', level: 'info', cat: '경품 이벤트 고지', re: /(경품|추첨|당첨|기프티콘\s*증정)/g,
      msg: '경품 이벤트는 추첨 방식·당첨자 발표일·제세공과금 부담 주체를 고지해야 합니다.' },
    { id: 'ip', level: 'warn', cat: '제3자 IP·초상권', re: /(BTS|방탄|뉴진스|블랙핑크|아이유|디즈니|마블|포켓몬|짱구|헬로키티|산리오|지브리|손흥민|오타니)/g,
      msg: '유명인·캐릭터 등 제3자 IP/초상권 사용은 라이선스 확인이 필요합니다.' },
    { id: 'profanity', level: 'error', cat: '커뮤니티 가이드라인', re: /(씨발|시발|ㅅㅂ|병신|지랄|개새끼|미친놈|존나)/g,
      msg: '욕설·비속어는 모든 플랫폼의 커뮤니티 가이드라인 위반입니다.' },
    { id: 'pii', level: 'error', cat: '개인정보 수집', re: /(주민등록번호|계좌번호\s*(를|을)?\s*(알려|입력|댓글)|비밀번호\s*(를|을)?\s*(입력|알려)|카드번호)/g,
      msg: '민감한 개인정보를 요구하는 문구는 게시할 수 없습니다.' },
    { id: 'platform_official', level: 'warn', cat: '플랫폼 상표', re: /(인스타그램\s*공식|메타\s*공식|유튜브\s*공식|틱톡\s*공식|Instagram\s*Official)/gi,
      msg: '플랫폼 공식 제휴를 암시하는 표현은 상표 정책 위반 소지가 있습니다.' },
    { id: 'clickbait', level: 'info', cat: 'YouTube 클릭베이트', re: /(충격|경악|실화냐|이걸\s*모르면|절대\s*보지\s*마|소름)/g,
      msg: '과도한 낚시성 표현은 YouTube 오해 소지 메타데이터 정책에 걸릴 수 있습니다.' },
    { id: 'repost', level: 'info', cat: '저작권', re: /(무단\s*전재|출처\s*없|퍼옴|펌)/g,
      msg: '타인 콘텐츠 재사용 시 출처와 이용 허락을 확인하세요.' }
  ];

  const CTA_RE = /(신청|구매|확인|클릭|참여|방문|문의|예약|다운로드|팔로우|댓글|좋아요|저장|공유|링크|프로필|구독|알림|DM)/;
  const EMOJI_RE = /\p{Extended_Pictographic}/gu;

  function check(text, { platform = 'instagram', kind = 'caption', title = '' } = {}) {
    const issues = [];
    const t = String(text || '');
    const add = (level, cat, msg, match) => issues.push({ level, cat, msg, match });

    if (!t.trim()) { add('error', '입력', '검수할 텍스트가 없습니다.'); return summarize(issues); }

    RULES.forEach(r => {
      const m = t.match(r.re);
      if (m) add(r.level, r.cat, r.msg, [...new Set(m)].slice(0, 5).join(', '));
    });

    /* 길이 */
    const lim = LIMITS[platform] || LIMITS.instagram;
    const len = [...t].length;
    if (kind === 'caption' && lim.caption && len > lim.caption) add('error', `${lim.label} 글자수`, `캡션이 ${len}자로 최대 ${lim.caption}자를 초과합니다.`);
    if (platform === 'youtube' && title && [...title].length > lim.title) add('error', 'YouTube 제목', `제목이 ${[...title].length}자로 최대 ${lim.title}자를 초과합니다.`);
    if (platform === 'youtube' && len > lim.description) add('error', 'YouTube 설명', `설명이 최대 ${lim.description}자를 초과합니다.`);
    if (platform === 'x' && len > 280) add('error', 'X 글자수', `게시물이 ${len}자로 280자를 초과합니다.`);

    /* 해시태그 */
    const tags = t.match(/#[^\s#]+/g) || [];
    if (tags.length > 30) add('error', '해시태그', `해시태그 ${tags.length}개 — Instagram 최대 30개.`);
    else if (tags.length > 10) add('info', '해시태그', `해시태그 ${tags.length}개 — 3~8개가 도달·참여율에 유리합니다.`);
    if (platform === 'x' && tags.length > 3) add('info', '해시태그', 'X에서는 해시태그 1~2개가 권장됩니다.');

    /* 형식 품질 */
    const excl = (t.match(/!/g) || []).length;
    if (excl > 5) add('warn', '카피 품질', `느낌표 ${excl}개 — 과도한 강조는 스팸으로 분류될 수 있습니다.`);
    const emo = (t.match(EMOJI_RE) || []).length;
    if (emo > 10) add('info', '카피 품질', `이모지 ${emo}개 — 가독성을 위해 줄이세요.`);
    if (/[A-Z]{6,}/.test(t)) add('info', '카피 품질', '전부 대문자인 영단어는 공격적으로 읽힙니다.');
    if (/(.)\1{4,}/.test(t)) add('info', '카피 품질', '같은 문자 반복(ㅋㅋㅋㅋㅋ, !!!!! 등)은 줄이세요.');
    const words = t.replace(/#[^\s#]+/g, '').split(/\s+/).filter(w => w.length >= 2);
    const freq = {}; words.forEach(w => freq[w] = (freq[w] || 0) + 1);
    const rep = Object.entries(freq).filter(([, n]) => n >= 4).map(([w]) => w);
    if (rep.length) add('info', '카피 품질', `반복되는 단어: ${rep.slice(0, 3).join(', ')}`);
    if (kind === 'caption' && !CTA_RE.test(t)) add('info', '카피 품질', '행동 유도 문구(CTA)가 없습니다. "프로필 링크 확인", "댓글로 참여" 등을 추가하세요.');
    if (platform === 'instagram' && /https?:\/\//.test(t)) add('info', 'Instagram', '캡션 내 링크는 클릭되지 않습니다. 프로필 링크 안내로 바꾸세요.');
    if (len < 15 && kind === 'caption') add('info', '카피 품질', '캡션이 너무 짧습니다. 맥락과 혜택을 한 문장 더 추가하세요.');

    return summarize(issues);
  }

  function summarize(issues) {
    const n = l => issues.filter(i => i.level === l).length;
    const score = Math.max(0, 100 - n('error') * 25 - n('warn') * 10 - n('info') * 3);
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
    const order = { error: 0, warn: 1, info: 2 };
    issues.sort((a, b) => order[a.level] - order[b.level]);
    return { score, grade, issues, passed: n('error') === 0, counts: { error: n('error'), warn: n('warn'), info: n('info') } };
  }

  /** 여러 플랫폼 합산 */
  function checkMulti(text, platforms, extra = {}) {
    const all = platforms.map(p => ({ platform: p, ...check(text, { platform: p, ...extra }) }));
    const merged = {}; all.forEach(r => r.issues.forEach(i => { merged[i.cat + i.msg] = merged[i.cat + i.msg] || { ...i, platforms: [] }; merged[i.cat + i.msg].platforms.push(r.platform); }));
    const res = summarize(Object.values(merged)); res.per = all; return res;
  }

  /** AI 심층 검수 (Claude 키 설정 시) */
  async function aiCheck(text, context = '') {
    const sys = `당신은 한국 디지털 광고 심의 전문가입니다. 표시광고법, 의료법, 식품표시광고법, 금융소비자보호법과 Meta/YouTube/TikTok/X의 광고 및 커뮤니티 정책을 기준으로 SNS 카피를 검수합니다.
JSON 형식: {"score":0-100,"risks":[{"level":"error|warn|info","category":"...","text":"문제 문구","why":"이유","fix":"수정 제안"}],"improved":"정책을 준수하면서 더 매력적으로 다듬은 전체 카피","summary":"한 줄 총평"}`;
    return AI.ask(sys, `컨텍스트: ${context}\n\n검수할 카피:\n${text}`, { json: true });
  }

  function render(container, result, { title = '검수 결과' } = {}) {
    const c = result;
    const color = c.grade === 'A' ? 'var(--ok)' : c.grade === 'B' ? 'var(--info)' : c.grade === 'C' ? 'var(--warn)' : 'var(--err)';
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="row between">
        <div><div class="muted small">${title}</div><div class="score" style="color:${color}">${c.score}<span class="small muted"> / 100 · 등급 ${c.grade}</span></div></div>
        <div class="stack" style="align-items:flex-end">
          <span class="chip ${c.passed ? 'ok' : 'err'}">${c.passed ? '✔ 게시 가능' : '✖ 수정 필요'}</span>
          <span class="small muted">오류 ${c.counts.error} · 경고 ${c.counts.warn} · 참고 ${c.counts.info}</span>
        </div>
      </div>
      ${c.issues.length ? `<ul>${c.issues.map(i => `<li class="${i.level}"><span class="rule">[${i.level === 'error' ? '오류' : i.level === 'warn' ? '경고' : '참고'}] ${Util.esc(i.cat)}${i.match ? ' — "' + Util.esc(i.match) + '"' : ''}${i.platforms ? ' · ' + i.platforms.join('/') : ''}</span>${Util.esc(i.msg)}</li>`).join('')}</ul>` : '<p class="muted small mt">발견된 문제가 없습니다.</p>'}
      ${c.ai ? renderAI(c.ai) : ''}
      <div class="row mt" id="review-ai-row"></div>`;
    const row = $('#review-ai-row', container);
    if (!c.ai && AI.enabled() && c.sourceText) {
      const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = '🤖 AI 심층 검수';
      b.onclick = async () => {
        b.disabled = true; b.textContent = '분석 중...';
        try { c.ai = await aiCheck(c.sourceText, c.context || ''); render(container, c, { title }); }
        catch (e) { Util.toast(e.message, 'err'); b.disabled = false; b.textContent = '🤖 AI 심층 검수'; }
      };
      row.appendChild(b);
    }
  }
  function renderAI(ai) {
    return `<div class="mt" style="border-top:1px dashed var(--line);padding-top:10px">
      <div class="row between"><b>🤖 AI 심층 검수</b><span class="chip info">AI 점수 ${ai.score}</span></div>
      <p class="small">${Util.esc(ai.summary || '')}</p>
      ${(ai.risks || []).length ? `<ul>${ai.risks.map(r => `<li class="${r.level}"><span class="rule">[${Util.esc(r.category)}] "${Util.esc(r.text)}"</span>${Util.esc(r.why)}<br><b>수정:</b> ${Util.esc(r.fix)}</li>`).join('')}</ul>` : ''}
      ${ai.improved ? `<div class="field mt"><label>AI 개선 카피</label><textarea readonly>${Util.esc(ai.improved)}</textarea></div>` : ''}
    </div>`;
  }

  return { check, checkMulti, aiCheck, render, RULES, LIMITS };
})();
