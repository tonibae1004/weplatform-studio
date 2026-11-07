/* 앱 진입 — 로그인, 네비게이션, 모듈 초기화 */
(() => {
  const ACCOUNTS = { weplatform01: '63262653' }; // 사내 직원용 계정
  let booted = false;

  function showApp() {
    $('#login-screen').classList.add('hidden'); $('#app').classList.remove('hidden');
    if (booted) return; booted = true;
    ImageGen.init(); VideoGen.init(); Library.init(); Blog.init(); Admin.init();
  }
  function nav(page) {
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    document.dispatchEvent(new CustomEvent('page:changed', { detail: page }));
    location.hash = page;
  }

  $('#login-form').addEventListener('submit', e => {
    e.preventDefault();
    const id = $('#login-id').value.trim(), pw = $('#login-pw').value;
    if (ACCOUNTS[id] && ACCOUNTS[id] === pw) {
      sessionStorage.setItem('wp.session', id); sessionStorage.setItem('wp.loginAt', Date.now());
      $('#user-label').textContent = id; $('#login-error').textContent = ''; showApp(); nav(location.hash.replace('#', '') || 'image');
    } else { $('#login-error').textContent = '아이디 또는 비밀번호가 올바르지 않습니다.'; $('#login-pw').value = ''; $('#login-pw').focus(); }
  });
  $('#logout-btn').onclick = () => { sessionStorage.removeItem('wp.session'); VideoGen.stop(); location.hash = ''; location.reload(); };
  $$('.nav-item').forEach(b => b.onclick = () => nav(b.dataset.page));

  const s = sessionStorage.getItem('wp.session');
  if (s && ACCOUNTS[s]) { $('#user-label').textContent = s; showApp(); nav(location.hash.replace('#', '') || 'image'); }
  else $('#login-id').focus();
})();
