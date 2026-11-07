# WePlatform Studio — 인스타·릴스·쇼츠 자동화 플랫폼 (사내용)

제목·설명·이벤트 내용만 입력하면 릴스용 카드뉴스 4장과 15초 쇼츠 영상을 브라우저에서 바로 만들고, 검수 → 라이브러리 → 자동 포스팅 → 인사이트 리포트까지 한 곳에서 처리하는 정적 웹 앱입니다. 서버·DB 없이 동작하며 모든 데이터는 브라우저(IndexedDB/localStorage)에 저장됩니다.

## 실행

```bash
node server.js
```

브라우저에서 http://localhost:8787 접속 → 사내 계정으로 로그인 (`weplatform01` / `63262653`, 계정은 `js/app.js`의 `ACCOUNTS`에서 관리).

`index.html`을 더블클릭해 열어도 대부분 동작하지만, Google 로그인(YouTube OAuth)은 http 주소에서만 됩니다.

## 기능

| 메뉴 | 내용 |
|---|---|
| 이미지 (카드뉴스) | 제목/설명/이벤트/CTA 입력 → 1080×1920(9:16) 카드 4장 렌더링, 6가지 컬러 테마, 배경 이미지, PNG 다운로드, 라이브러리 저장, 카피 검수 |
| 영상 (쇼츠/릴스) | 도입·중반·절정·결말 4단계 자막 → 15/30/60초, 세로 1080×1920 또는 가로 1920×1080 FHD, 페이드/슬라이드/줌 전환, 단계별 배경 이미지, BGM, 플랫폼 안전영역 가이드, MP4(미지원 브라우저는 WebM) 녹화 |
| 라이브러리 · 포스팅 | 소재 관리(보기/다운로드/삭제/파일 가져오기), 공개 URL 등록, 매체별 검수 후 즉시/예약 포스팅, 포스팅 큐·로그·재시도 |
| 블로그 자동화 | 캠페인 정보 → 인사이트·채널 전략·4주 캘린더·KPI·로드맵·정책 체크 리포트 생성, 라이브러리 소재 첨부, PDF 출력(브라우저 인쇄) |
| 관리 | Meta/YouTube/TikTok/X 계정 연동·연결 테스트, 힉스필드 API(Key ID/Secret, 생성 요청·상태 폴링·결과 저장), Claude API(AI 심층 검수·AI 인사이트), 포스팅 프록시, 백업/복원/초기화 |

## 카피 품질·정책 검수

`js/review.js`의 규칙 엔진이 표시광고법(절대적 표현, 할인 표시, 무료), 의료법/건강기능식품법, 금융소비자보호법, Meta 광고정책(비포/애프터, 개인 특성), 연령제한 품목, 경품 고지, 제3자 IP, 욕설, 개인정보, 플랫폼 상표, 클릭베이트와 플랫폼별 글자수(IG 2,200자·해시태그 30개, YT 제목 100자, X 280자), CTA 유무, 느낌표·이모지 과다, 반복 단어를 검사해 100점 만점 점수와 등급(A~D)을 냅니다. 관리 > AI 검수에 Claude API 키를 넣으면 AI 심층 검수와 개선 카피가 추가됩니다.

## 매체 연동 시 알아둘 점

- **Instagram(Meta Graph API)**: 미디어가 공개 URL에 있어야 합니다. 라이브러리에서 소재의 "URL" 버튼으로 CDN 주소를 등록한 뒤 포스팅하세요. 이미지 4장은 캐러셀, 영상은 릴스로 게시됩니다.
- **YouTube**: Google Cloud에서 OAuth 클라이언트 ID(승인된 JavaScript 원본에 앱 주소 추가)를 만들어 "Google 로그인" 하거나 `youtube.upload` 토큰을 직접 입력합니다. 브라우저에서 바로 업로드됩니다.
- **TikTok / X**: 두 API는 브라우저 직접 호출(CORS)을 막습니다. 관리 > 포스팅 프록시에 사내 프록시 URL을 넣으면 `POST {프록시}/forward` 로 `{url, method, headers, body}`를 보내 전달하도록 구현되어 있습니다. 프록시 서버는 별도 구축이 필요합니다.
- **힉스필드**: 공식 문서 기준 `Authorization: Key ID:SECRET` 헤더, `https://api.higgsfield.ai/{model-path}` 제출 후 `/requests/{id}/status` 폴링. 공식 문서는 브라우저 직접 호출을 권장하지 않으므로 프록시 사용을 권장합니다.

## 파일 구조

```
index.html          화면 전체
css/style.css       스타일
js/util.js          공통 유틸·테마
js/db.js            IndexedDB
js/review.js        카피 품질·정책 검수 엔진
js/image-gen.js     카드뉴스 렌더러
js/video-gen.js     영상 렌더러·녹화
js/poster.js        매체 API·힉스필드·프록시
js/library.js       라이브러리·포스팅 큐
js/blog.js          인사이트 리포트·PDF
js/admin.js         관리
js/ai.js            Claude API
js/app.js           로그인·네비게이션
server.js           로컬 정적 서버
```
