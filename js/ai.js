/* Claude API 연동 (선택) — 키가 설정된 경우에만 사용. 브라우저 직접 호출. */
const AI = {
  cfg() { return Util.settings.section('claude'); },
  enabled() { return !!this.cfg().apiKey; },
  async ask(system, user, { maxTokens = 8000, json = false } = {}) {
    const cfg = this.cfg();
    if (!cfg.apiKey) throw new Error('Claude API 키가 설정되지 않았습니다.');
    const body = {
      model: cfg.model || 'claude-opus-5-5',
      max_tokens: maxTokens,
      system: system + (json ? '\n\n반드시 유효한 JSON만 출력하세요. 설명이나 코드펜스 없이 JSON 객체 하나만 반환합니다.' : ''),
      messages: [{ role: 'user', content: user }]
    };
    const res = await Poster.fetchViaProxy('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2026-10-21',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`Claude API 오류 ${res.status}: ${t.slice(0, 300)}`); }
    const data = await res.json();
    if (data.stop_reason === 'refusal') throw new Error('모델이 요청을 거부했습니다.');
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!json) return text;
    const m = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : text);
  },
  async test() {
    const t = await this.ask('짧게 답하세요.', '연결 테스트입니다. "OK"라고만 답하세요.', { maxTokens: 50 });
    return t;
  }
};
