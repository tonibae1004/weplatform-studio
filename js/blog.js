/* 블로그 자동화 — 마케팅 인사이트/전략 리포트 생성, 라이브러리 소재 첨부, PDF 출력 */
const Blog = (() => {
  let attached = []; let current = null;
  const CH = { instagram: 'Instagram 릴스', youtube: 'YouTube 쇼츠', tiktok: 'TikTok', x: 'X' };
  const GOALS = { awareness: '인지도 확대', conversion: '구매/가입 전환', follower: '팔로워·구독자 증가', retention: '재구매·리텐션' };

  function form() {
    return {
      brand: $('#blog-brand').value.trim() || '브랜드', industry: $('#blog-industry').value.trim() || '일반 소비재', target: $('#blog-target').value.trim() || '20~30대 모바일 중심 소비자',
      goal: $('#blog-goal').value, period: $('#blog-period').value.trim() || '4주', budget: +$('#blog-budget').value || 0,
      channels: $$('.blog-ch:checked').map(c => c.value), message: $('#blog-message').value.trim(), notes: $('#blog-notes').value.trim()
    };
  }

  /* ---------- 템플릿 기반 생성 (AI 미설정 시) ---------- */
  function template(f) {
    const chs = f.channels.length ? f.channels : ['instagram'];
    const budget = f.budget ? `월 ${f.budget.toLocaleString()}만원` : '미정';
    const split = chs.length === 1 ? { [chs[0]]: 100 } : Object.fromEntries(chs.map((c, i) => [c, Math.round(100 / chs.length) + (i === 0 ? 100 - Math.round(100 / chs.length) * chs.length : 0)]));
    const kpi = {
      awareness: [['도달(Reach)', '월 50만+'], ['조회수', '영상당 1만+'], ['평균 시청 지속률', '55%+'], ['브랜드 검색량', '+30%']],
      conversion: [['프로필 링크 클릭', '월 3,000+'], ['전환율(CVR)', '2.5%+'], ['CPA', '1만원 이하'], ['ROAS', '300%+']],
      follower: [['신규 팔로워', '월 +2,000'], ['저장·공유율', '3%+'], ['팔로워 전환율', '조회수 대비 1%'], ['댓글 참여율', '1.5%+']],
      retention: [['재구매율', '35%+'], ['DM/댓글 응답률', '90%+'], ['커뮤니티 참여', '주 300+'], ['멤버십 유지율', '85%+']]
    }[f.goal];
    const hooks = {
      awareness: ['"아직도 이거 모르세요?" 식 궁금증 유발 훅', '업계 통념 깨기 (반전 오프닝)', '트렌드 사운드 + 브랜드 상황극'],
      conversion: ['혜택 숫자 먼저 노출 (첫 1초)', '사용 전후 "문제 → 해결" 구조(정책 준수)', '한정 수량/기간은 실제 기한 명시'],
      follower: ['시리즈물 ("1편/5") 구성으로 팔로우 유도', '댓글 질문 답변 콘텐츠', '저장 유도형 정보 카드뉴스'],
      retention: ['구매 고객 후기 리그램(동의 후)', '사용 팁·숨은 기능 소개', '멤버 전용 혜택 예고']
    }[f.goal];
    const weeks = [
      ['1주차 · 런칭/인지', '브랜드·이벤트 소개 카드뉴스 2종, 티저 쇼츠 1편', '핵심 메시지 노출, 해시태그 세팅'],
      ['2주차 · 확산', '정보성 쇼츠 2편(도입-중반-절정-결말 구조), 카드뉴스 1종', '저장·공유 유도, 댓글 이벤트'],
      ['3주차 · 전환', '혜택 강조 쇼츠 1편, 고객 후기형 카드뉴스 1종, 라이브/Q&A 1회', 'CTA 강화, 프로필 링크 최적화'],
      ['4주차 · 마감/리텐션', '마감 임박 안내(실제 기한), 결과 공유·감사 콘텐츠', '다음 캠페인 예고, 팔로워 유지']
    ];
    const channelPlans = {
      instagram: { why: '카드뉴스(저장률↑)와 릴스(도달↑)를 병행하기 가장 좋은 채널. 알고리즘은 저장·공유·시청 지속 시간을 가중합니다.', format: '릴스 9:16 1080×1920, 카드뉴스 4장 캐러셀', cadence: '릴스 주 3회, 카드뉴스 주 2회, 스토리 매일', time: '평일 12:00~13:00, 19:00~21:00', tips: ['첫 1초에 자막 훅 노출', '캡션 첫 줄 125자 내 핵심 혜택', '해시태그 5~8개(브랜드+카테고리+틈새)', '릴스 커버 이미지를 카드뉴스 1장과 통일'] },
      youtube: { why: '쇼츠 → 롱폼/채널 구독으로 이어지는 검색 기반 유입. 제목·설명 키워드가 노출에 직접 영향.', format: '쇼츠 9:16 1080×1920 60초 이내, 가로형 16:9 보조', cadence: '쇼츠 주 3~4회', time: '평일 18:00~20:00, 주말 11:00', tips: ['제목 40자 내 키워드 전진 배치', '설명 첫 2줄에 CTA·링크', '엔드 3초에 구독 유도 자막', '클릭베이트성 표현 금지(정책)'] },
      tiktok: { why: '팔로워 수와 무관하게 콘텐츠 품질로 확산. 트렌드 사운드·챌린지 참여가 도달을 키움.', format: '9:16 1080×1920 15~30초', cadence: '매일 1회 이상', time: '19:00~23:00', tips: ['트렌드 사운드 활용(상업용 라이선스 확인)', '자막은 화면 중앙(하단 UI 가림 주의)', '첫 0.5초 강한 비주얼', '댓글 고정으로 CTA 안내'] },
      x: { why: '실시간 이슈·공지·고객 응대에 강점. 이미지 4장 첨부로 카드뉴스 재활용 가능.', format: '이미지 1080×1350 또는 1080×1920, 영상 16:9/9:16', cadence: '매일 2~3회', time: '08:00~09:00, 12:00, 18:00', tips: ['280자 내 1메시지', '해시태그 1~2개', '스레드로 상세 설명', '고객 멘션 1시간 내 응답'] }
    };
    const risks = [
      '"최고/1위/100%" 등 절대적 표현은 근거 자료 없이는 사용 금지 (표시광고법)',
      '효능·치료 암시 표현 금지 (의료법/식품표시광고법)',
      '할인율은 종전 거래가격 기준으로 표시, 기간 명시',
      '경품 이벤트는 추첨 방식·발표일·제세공과금 고지',
      '유명인·캐릭터 IP, 트렌드 음원은 상업적 사용 라이선스 확인',
      '모든 소재는 게시 전 플랫폼 내장 검수(카피 품질·정책) 통과 필수'
    ];
    return { chs, budget, split, kpi, hooks, weeks, channelPlans, risks };
  }

  function htmlFromTemplate(f, t, aiText) {
    const today = Util.fmtDate(Date.now()).slice(0, 10);
    const libraryIdeas = (Library.getAssets() || []).slice(0, 5);
    return `
      <h1>${Util.esc(f.brand)} 소셜 마케팅 인사이트 & 전략 리포트</h1>
      <div class="meta">작성일 ${today} · 작성 WePlatform Studio · 업종 ${Util.esc(f.industry)} · 캠페인 기간 ${Util.esc(f.period)} · 예산 ${t.budget}</div>
      ${aiText ? `<div class="callout">🤖 이 리포트는 Claude AI 분석을 포함합니다.</div>` : ''}
      <h2>1. 요약 (Executive Summary)</h2>
      <p><b>${Util.esc(f.brand)}</b>의 이번 캠페인 목표는 <b>${GOALS[f.goal]}</b>이며, 핵심 타깃은 <b>${Util.esc(f.target)}</b>입니다.
      ${f.message ? `핵심 메시지 "<b>${Util.esc(f.message)}</b>"를 ` : ''}${t.chs.map(c => CH[c]).join(' · ')} 채널에서 숏폼 영상과 카드뉴스를 결합해 운영하고,
      ${f.period} 동안 4단계(런칭 → 확산 → 전환 → 리텐션) 콘텐츠 캘린더로 전개합니다.</p>
      <div class="kpi">${t.kpi.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      ${aiText?.summary ? `<p>${Util.esc(aiText.summary)}</p>` : ''}

      <h2>2. 시장 · 타깃 인사이트</h2>
      <h3>타깃 페르소나</h3>
      <ul>
        <li><b>누구:</b> ${Util.esc(f.target)} — 모바일에서 하루 평균 60분 이상 숏폼 소비, 저장·공유로 정보를 수집하는 성향</li>
        <li><b>동기:</b> ${f.goal === 'conversion' ? '명확한 혜택과 신뢰 신호(후기·실적)가 있을 때 즉시 행동' : f.goal === 'awareness' ? '새로운 것·트렌드를 가장 먼저 아는 데서 만족' : f.goal === 'follower' ? '지속적으로 유용한 정보를 주는 계정을 팔로우' : '구매 후에도 브랜드와의 관계(혜택·커뮤니티)를 기대'}</li>
        <li><b>장벽:</b> 광고 피로도가 높아 첫 1초에 가치가 보이지 않으면 이탈. 과장 광고에 민감하고 댓글 반응을 확인함</li>
      </ul>
      <h3>${Util.esc(f.industry)} 업종 숏폼 트렌드</h3>
      <ul>
        <li>정보형("~하는 법", "~비교") 콘텐츠가 저장률 기준 상위 — 카드뉴스로 2차 가공 시 효율 극대화</li>
        <li>도입 → 중반 → 절정 → 결말 4단계 스토리 구조가 평균 시청 지속률을 높임 (본 플랫폼 영상 생성기 구조와 동일)</li>
        <li>사람 얼굴·자막·텍스트 훅이 있는 영상이 없는 영상 대비 완주율 우위</li>
        ${f.notes ? `<li><b>비고/경쟁사:</b> ${Util.esc(f.notes)} → 차별화 포인트를 모든 소재의 "절정" 단계에 배치</li>` : ''}
      </ul>
      ${aiText?.insights ? `<h3>AI 인사이트</h3><ul>${aiText.insights.map(i => `<li>${Util.esc(i)}</li>`).join('')}</ul>` : ''}

      <h2>3. 채널별 전략</h2>
      <table><thead><tr><th>채널</th><th>예산 비중</th><th>역할 · 근거</th><th>포맷 · 주기 · 시간</th><th>실행 팁</th></tr></thead><tbody>
      ${t.chs.map(c => { const p = t.channelPlans[c]; return `<tr><td><b>${CH[c]}</b></td><td>${t.split[c]}%</td><td>${p.why}</td><td>${p.format}<br>${p.cadence}<br>${p.time}</td><td><ul style="margin:0;padding-left:16px">${p.tips.map(x => `<li>${x}</li>`).join('')}</ul></td></tr>`; }).join('')}
      </tbody></table>
      <h3>크리에이티브 훅 (목표: ${GOALS[f.goal]})</h3>
      <ul>${t.hooks.map(h => `<li>${h}</li>`).join('')}</ul>
      ${aiText?.strategies ? `<h3>AI 제안 전략</h3><ul>${aiText.strategies.map(i => `<li>${Util.esc(i)}</li>`).join('')}</ul>` : ''}

      <h2>4. 4주 콘텐츠 캘린더</h2>
      <table><thead><tr><th>주차</th><th>제작 소재 (플랫폼 생성기 활용)</th><th>운영 포인트</th></tr></thead><tbody>
      ${t.weeks.map(w => `<tr><td><b>${w[0]}</b></td><td>${w[1]}</td><td>${w[2]}</td></tr>`).join('')}
      </tbody></table>
      ${aiText?.calendar ? `<ul>${aiText.calendar.map(i => `<li>${Util.esc(i)}</li>`).join('')}</ul>` : ''}

      <h2>5. KPI 및 측정 체계</h2>
      <table><thead><tr><th>지표</th><th>목표</th><th>측정 방법</th></tr></thead><tbody>
      ${t.kpi.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td><td>각 플랫폼 인사이트 + 프로필 링크 UTM, 주간 리뷰</td></tr>`).join('')}
      </tbody></table>
      <p>주간 리뷰에서 상위 20% 소재의 훅·구조를 분석해 다음 주 소재에 반영하고, 하위 소재는 자막/커버만 교체해 재게시(A/B)합니다.</p>

      <h2>6. 실행 로드맵</h2>
      <ul>
        <li><b>D-7:</b> 계정 연동(관리 메뉴), 해시태그·캡션 템플릿 확정, 소재 1주차분 제작 및 검수</li>
        <li><b>D-day ~ 1주:</b> 런칭 소재 게시, 댓글·DM 응대 체계 가동</li>
        <li><b>2~3주:</b> 라이브러리 자동 포스팅으로 예약 게시, 반응 상위 소재 증액</li>
        <li><b>4주:</b> 결과 리포트, 다음 캠페인 소재 백로그 정리</li>
      </ul>

      <h2>7. 정책 · 리스크 체크리스트</h2>
      <ul>${t.risks.map(r => `<li>${r}</li>`).join('')}</ul>
      ${aiText?.risks ? `<ul>${aiText.risks.map(i => `<li>${Util.esc(i)}</li>`).join('')}</ul>` : ''}

      ${attached.length ? `<h2>8. 첨부 소재 (라이브러리)</h2><div class="assets">${attached.map(a => `<div><img src="${a.thumb}"><div class="meta">${Util.esc(a.title)} · ${a.type === 'video' ? '영상 ' + a.duration + 's' : '이미지'}</div></div>`).join('')}</div>` : ''}
      ${!attached.length && libraryIdeas.length ? `<h2>8. 활용 가능한 라이브러리 소재</h2><ul>${libraryIdeas.map(a => `<li>${Util.esc(a.title)} (${a.type === 'video' ? '영상' : '이미지'}, ${Util.fmtDate(a.createdAt).slice(0, 10)})</li>`).join('')}</ul>` : ''}
    `;
  }

  async function generate() {
    const f = form(); const t = template(f); let ai = null;
    const btn = $('#blog-gen-btn'); btn.disabled = true; btn.textContent = '생성 중...';
    try {
      if (AI.enabled()) {
        $('#blog-ai-note').textContent = 'Claude가 인사이트를 분석 중입니다...';
        ai = await AI.ask(`당신은 한국 시장의 소셜미디어 마케팅 전략가입니다. 입력된 캠페인 정보를 바탕으로 실행 가능한 인사이트를 JSON으로 제공합니다.
형식: {"summary":"3문장 요약","insights":["타깃/시장 인사이트 5개"],"strategies":["채널별 구체 전략 5개"],"calendar":["주차별 추천 콘텐츠 아이디어 4~8개(구체적 제목 포함)"],"risks":["이 업종에서 주의할 정책/법규 리스크 3개"]}`,
          JSON.stringify(f), { json: true });
        $('#blog-ai-note').textContent = '';
      }
    } catch (e) { Util.toast('AI 분석 실패, 템플릿으로 생성합니다: ' + e.message, 'err'); $('#blog-ai-note').textContent = ''; }
    const html = htmlFromTemplate(f, t, ai);
    current = { id: Util.uid(), createdAt: Date.now(), title: `${f.brand} 전략 리포트`, form: f, html, attached: attached.map(a => a.id) };
    $('#blog-report').innerHTML = html; $('#blog-pdf-btn').disabled = false;
    await DB.put('reports', current); await renderList();
    btn.disabled = false; btn.textContent = '🧠 리포트 생성';
    Util.toast('리포트가 생성·저장되었습니다.', 'ok');
    $('#blog-report-wrap').scrollIntoView({ behavior: 'smooth' });
  }

  async function renderList() {
    const list = (await DB.all('reports')).sort((a, b) => b.createdAt - a.createdAt);
    const el = $('#blog-list');
    if (!list.length) { el.innerHTML = '<p class="muted small">저장된 리포트가 없습니다.</p>'; return; }
    el.innerHTML = list.map(r => `<div class="row between" style="border:1px solid var(--line);border-radius:10px;padding:8px 12px"><div><b>${Util.esc(r.title)}</b><div class="muted small">${Util.fmtDate(r.createdAt)} · ${GOALS[r.form.goal]}</div></div><div class="row"><button class="btn sm" data-open="${r.id}">열기</button><button class="btn sm danger" data-del="${r.id}">삭제</button></div></div>`).join('');
    $$('[data-open]', el).forEach(b => b.onclick = async () => { current = await DB.get('reports', b.dataset.open); $('#blog-report').innerHTML = current.html; $('#blog-pdf-btn').disabled = false; });
    $$('[data-del]', el).forEach(b => b.onclick = async () => { await DB.del('reports', b.dataset.del); renderList(); });
  }

  function attach() {
    const assets = Library.getAssets();
    if (!assets.length) return Util.toast('라이브러리에 소재가 없습니다.', 'err');
    const m = Util.modal(`<h2>라이브러리 소재 첨부</h2><div class="lib-grid">${assets.map(a => `<label class="lib-item" style="cursor:pointer"><div class="thumb" style="background-image:url('${a.thumb}')"><span class="tag"><input type="checkbox" value="${a.id}" ${attached.find(x => x.id === a.id) ? 'checked' : ''}></span></div><div class="body"><div class="title">${Util.esc(a.title)}</div></div></label>`).join('')}</div><div class="row mt" style="justify-content:flex-end"><button class="btn primary" id="attach-ok">첨부</button></div>`);
    $('#attach-ok', m.el).onclick = () => { const ids = $$('input:checked', m.el).map(c => c.value); attached = assets.filter(a => ids.includes(a.id)); m.close(); Util.toast(`${attached.length}개 소재가 첨부됩니다. 리포트를 생성하세요.`, 'ok'); $('#blog-attach-btn').textContent = `🖼️ 소재 첨부 (${attached.length})`; };
  }

  function init() {
    $('#blog-gen-btn').onclick = generate;
    $('#blog-attach-btn').onclick = attach;
    $('#blog-pdf-btn').onclick = () => { document.title = (current?.title || '리포트') + ' - WePlatform'; window.print(); };
    renderList();
  }
  return { init };
})();
