/* IndexedDB 래퍼 — assets(소재), posts(포스팅 큐), reports(블로그 리포트) */
const DB = (() => {
  const NAME = 'weplatform-studio', VER = 1;
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = e => {
        const d = e.target.result;
        ['assets', 'posts', 'reports'].forEach(n => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' }); });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function run(store, mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const s = t.objectStore(store); const req = fn(s);
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
  return {
    put: (store, obj) => run(store, 'readwrite', s => s.put(obj)),
    get: (store, id) => run(store, 'readonly', s => s.get(id)),
    del: (store, id) => run(store, 'readwrite', s => s.delete(id)),
    all: async (store) => (await run(store, 'readonly', s => s.getAll())) || [],
    clear: (store) => run(store, 'readwrite', s => s.clear()),
    /** 소재 저장 헬퍼 */
    async saveAsset(a) {
      const asset = Object.assign({ id: Util.uid(), createdAt: Date.now(), tags: [], platforms: [] }, a);
      await this.put('assets', asset);
      document.dispatchEvent(new CustomEvent('assets:changed'));
      return asset;
    }
  };
})();
