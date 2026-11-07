/* 매체 API 연동 · 자동 포스팅 엔진 (Meta/Instagram, YouTube, TikTok, X) */
const Poster = (() => {
  const PLATFORMS = {
    meta: { label: 'Instagram (Meta)', icon: '📷', accepts: ['image', 'video'] },
    youtube: { label: 'YouTube Shorts', icon: '▶', accepts: ['video'] },
    tiktok: { label: 'TikTok', icon: '🎵', accepts: ['video'] },
    x: { label: 'X', icon: '𝕏', accepts: ['image', 'video'] }
  };
  const cfg = name => Util.settings.section(name);
  const proxyUrl = () => (cfg('proxy').url || '').replace(/\/$/, '');

  function connected(p) {
    const c = cfg(p);
    if (p === 'meta') return !!(c.igid && c.token);
    if (p === 'youtube') return !!c.token;
    if (p === 'tiktok') return !!c.token;
    if (p === 'x') return !!c.token;
    if (p === 'hf') return !!(c.key && c.secret);
    return false;
  }

  /** 프록시가 설정되어 있고 본문이 문자열/없음이면 프록시 경유, 아니면 직접 호출 */
  async function fetchViaProxy(url, opts = {}) {
    const px = proxyUrl();
    const bodyIsText = opts.body == null || typeof opts.body === 'string';
    if (px && bodyIsText) {
      return fetch(px + '/forward', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body ?? null })
      });
    }
    return fetch(url, opts);
  }
  const netErr = e => (e instanceof TypeError) ? '브라우저에서 직접 호출이 차단되었습니다(CORS). 관리 > 포스팅 프록시를 설정하거나 백엔드에서 전송하세요.' : e.message;

  /* ---------- 연결 테스트 ---------- */
  async function test(p) {
    const c = cfg(p);
    try {
      if (p === 'meta') {
        const r = await fetchViaProxy(`https://graph.facebook.com/v21.0/${c.igid}?fields=username,followers_count,media_count&access_token=${encodeURIComponent(c.token)}`);
        const j = await r.json(); if (j.error) throw new Error(j.error.message);
        return `✅ @${j.username} · 팔로워 ${j.followers_count?.toLocaleString()} · 게시물 ${j.media_count}`;
      }
      if (p === 'youtube') {
        const r = await fetchViaProxy('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', { headers: { Authorization: 'Bearer ' + c.token } });
        const j = await r.json(); if (j.error) throw new Error(j.error.message);
        const ch = j.items?.[0]; if (!ch) throw new Error('채널을 찾을 수 없습니다.');
        return `✅ ${ch.snippet.title} · 구독자 ${(+ch.statistics.subscriberCount).toLocaleString()}`;
      }
      if (p === 'tiktok') {
        const r = await fetchViaProxy('https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count', { headers: { Authorization: 'Bearer ' + c.token } });
        const j = await r.json(); if (j.error?.code && j.error.code !== 'ok') throw new Error(j.error.message);
        return `✅ ${j.data.user.display_name} · 팔로워 ${j.data.user.follower_count}`;
      }
      if (p === 'x') {
        const r = await fetchViaProxy('https://api.x.com/2/users/me', { headers: { Authorization: 'Bearer ' + c.token } });
        const j = await r.json(); if (j.errors || j.title) throw new Error(j.detail || j.errors?.[0]?.message || '인증 실패');
        return `✅ @${j.data.username}`;
      }
      if (p === 'hf') {
        const r = await fetchViaProxy(`${(c.base || 'https://api.higgsfield.ai').replace(/\/$/, '')}/requests/00000000-0000-0000-0000-000000000000/status`, { headers: { Authorization: `Key ${c.key}:${c.secret}` } });
        if (r.status === 401 || r.status === 403) throw new Error('인증 실패 (Key ID / Secret 확인)');
        return `✅ 인증 OK (HTTP ${r.status})`;
      }
    } catch (e) { throw new Error(netErr(e)); }
  }

  /* ---------- 게시 ---------- */
  async function publish(post, asset) {
    const results = {};
    for (const p of post.platforms) {
      try {
        if (!connected(p)) throw new Error('계정이 연동되지 않았습니다.');
        if (!PLATFORMS[p].accepts.includes(asset.type)) throw new Error(`${PLATFORMS[p].label}은(는) ${asset.type === 'image' ? '이미지' : '영상'} 게시를 지원하지 않습니다.`);
        results[p] = await publishers[p](post, asset);
      } catch (e) { results[p] = { ok: false, msg: netErr(e) }; }
    }
    return results;
  }

  const publishers = {
    async youtube(post, asset) {
      const c = cfg('youtube'); const file = asset.files[0];
      const meta = { snippet: { title: (post.title || asset.title).slice(0, 100), description: post.caption, tags: (post.caption.match(/#[^\s#]+/g) || []).map(t => t.slice(1)).slice(0, 20), categoryId: '22' }, status: { privacyStatus: post.privacy || 'public', selfDeclaredMadeForKids: false } };
      const boundary = 'wp_boundary_' + Util.uid();
      const body = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
        `--${boundary}\r\nContent-Type: ${file.mime || 'video/webm'}\r\n\r\n`, file.blob, `\r\n--${boundary}--`
      ]);
      const r = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
        method: 'POST', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': `multipart/related; boundary=${boundary}` }, body
      });
      const j = await r.json(); if (j.error) throw new Error(j.error.message);
      return { ok: true, msg: '업로드 완료', url: `https://youtu.be/${j.id}` };
    },

    async meta(post, asset) {
      const c = cfg('meta'); const base = 'https://graph.facebook.com/v21.0';
      const urls = (asset.publicUrl || '').split(/[\s,]+/).filter(Boolean);
      if (!urls.length) throw new Error('Instagram Graph API는 공개 URL의 미디어만 게시할 수 있습니다. 라이브러리에서 소재의 "공개 URL"을 먼저 등록하세요.');
      const call = async (path, params) => {
        const r = await fetchViaProxy(`${base}/${path}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, access_token: c.token }).toString() });
        const j = await r.json(); if (j.error) throw new Error(j.error.message); return j;
      };
      const waitReady = async id => {
        for (let i = 0; i < 30; i++) {
          const r = await fetchViaProxy(`${base}/${id}?fields=status_code&access_token=${encodeURIComponent(c.token)}`); const j = await r.json();
          if (j.status_code === 'FINISHED') return; if (j.status_code === 'ERROR') throw new Error('미디어 처리 실패');
          await new Promise(res => setTimeout(res, 4000));
        }
        throw new Error('미디어 처리 대기 시간 초과');
      };
      let container;
      if (asset.type === 'video') container = (await call(`${c.igid}/media`, { media_type: 'REELS', video_url: urls[0], caption: post.caption, share_to_feed: 'true' })).id;
      else if (urls.length === 1) container = (await call(`${c.igid}/media`, { image_url: urls[0], caption: post.caption })).id;
      else {
        const children = [];
        for (const u of urls.slice(0, 10)) children.push((await call(`${c.igid}/media`, { image_url: u, is_carousel_item: 'true' })).id);
        container = (await call(`${c.igid}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption: post.caption })).id;
      }
      await waitReady(container);
      const pub = await call(`${c.igid}/media_publish`, { creation_id: container });
      return { ok: true, msg: `게시 완료 (media id ${pub.id})` };
    },

    async tiktok(post, asset) {
      const c = cfg('tiktok'); const file = asset.files[0];
      const H = { Authorization: 'Bearer ' + c.token, 'content-type': 'application/json; charset=UTF-8' };
      const post_info = { title: post.caption.slice(0, 2200), privacy_level: post.privacy === 'private' ? 'SELF_ONLY' : 'PUBLIC_TO_EVERYONE', disable_comment: false, disable_duet: false, disable_stitch: false };
      let init;
      if (asset.publicUrl) {
        init = await (await fetchViaProxy('https://open.tiktokapis.com/v2/post/publish/video/init/', { method: 'POST', headers: H, body: JSON.stringify({ post_info, source_info: { source: 'PULL_FROM_URL', video_url: asset.publicUrl.split(/[\s,]+/)[0] } }) })).json();
        if (init.error?.code !== 'ok') throw new Error(init.error?.message || 'init 실패');
      } else {
        init = await (await fetchViaProxy('https://open.tiktokapis.com/v2/post/publish/video/init/', { method: 'POST', headers: H, body: JSON.stringify({ post_info, source_info: { source: 'FILE_UPLOAD', video_size: file.blob.size, chunk_size: file.blob.size, total_chunk_count: 1 } }) })).json();
        if (init.error?.code !== 'ok') throw new Error(init.error?.message || 'init 실패');
        const up = await fetch(init.data.upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes 0-${file.blob.size - 1}/${file.blob.size}` }, body: file.blob });
        if (!up.ok) throw new Error('파일 업로드 실패 ' + up.status);
      }
      return { ok: true, msg: `게시 요청 접수 (publish_id ${init.data.publish_id}) — TikTok 처리 후 노출` };
    },

    async x(post, asset) {
      const c = cfg('x'); const H = { Authorization: 'Bearer ' + c.token };
      const mediaIds = [];
      for (const f of asset.files.slice(0, 4)) {
        const isVideo = asset.type === 'video';
        const fd = new FormData(); fd.append('command', 'INIT'); fd.append('total_bytes', f.blob.size); fd.append('media_type', f.mime); fd.append('media_category', isVideo ? 'tweet_video' : 'tweet_image');
        const init = await (await fetch('https://api.x.com/2/media/upload', { method: 'POST', headers: H, body: fd })).json();
        const id = init.data?.id || init.media_id_string; if (!id) throw new Error(init.detail || init.errors?.[0]?.message || '미디어 INIT 실패');
        const ap = new FormData(); ap.append('command', 'APPEND'); ap.append('media_id', id); ap.append('segment_index', 0); ap.append('media', f.blob);
        await fetch('https://api.x.com/2/media/upload', { method: 'POST', headers: H, body: ap });
        const fin = new FormData(); fin.append('command', 'FINALIZE'); fin.append('media_id', id);
        await fetch('https://api.x.com/2/media/upload', { method: 'POST', headers: H, body: fin });
        mediaIds.push(id);
      }
      const r = await fetchViaProxy('https://api.x.com/2/tweets', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ text: post.caption.slice(0, 280), media: { media_ids: mediaIds } }) });
      const j = await r.json(); if (!j.data) throw new Error(j.detail || j.errors?.[0]?.message || '트윗 실패');
      return { ok: true, msg: '게시 완료', url: `https://x.com/i/status/${j.data.id}` };
    }
  };

  /* ---------- 힉스필드 ---------- */
  const Higgsfield = {
    async submit(modelPath, body) {
      const c = cfg('hf'); const base = (c.base || 'https://api.higgsfield.ai').replace(/\/$/, '');
      const r = await fetchViaProxy(`${base}/${modelPath.replace(/^\//, '')}`, { method: 'POST', headers: { Authorization: `Key ${c.key}:${c.secret}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
      return j; // { request_id, status_url, cancel_url }
    },
    async status(requestId) {
      const c = cfg('hf'); const base = (c.base || 'https://api.higgsfield.ai').replace(/\/$/, '');
      const r = await fetchViaProxy(`${base}/requests/${requestId}/status`, { headers: { Authorization: `Key ${c.key}:${c.secret}` } });
      return r.json();
    },
    async waitFor(requestId, onTick) {
      for (let i = 0; i < 120; i++) {
        const s = await this.status(requestId); onTick && onTick(s, i);
        const st = String(s.status || '').toLowerCase();
        if (['completed', 'succeeded', 'success', 'done'].includes(st)) return s;
        if (['failed', 'error', 'cancelled', 'canceled', 'nsfw'].includes(st)) throw new Error('생성 실패: ' + JSON.stringify(s).slice(0, 300));
        await new Promise(res => setTimeout(res, 5000));
      }
      throw new Error('대기 시간 초과');
    }
  };

  return { PLATFORMS, connected, test, publish, fetchViaProxy, Higgsfield, cfg };
})();
