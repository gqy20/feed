/* Share a short-lived snapshot between the reading and overview pages. */
(() => {
  const key = "trail-feed:snapshot:v1", ttl = 60_000;
  let pending;
  window.loadTrailFeed = () => {
    if (pending) return pending;
    pending = (async () => {
      try {
        const snapshot = JSON.parse(sessionStorage.getItem(key));
        if (snapshot && Date.now() - snapshot.savedAt >= 0 && Date.now() - snapshot.savedAt < ttl && Array.isArray(snapshot.data?.posts)) {
          return { data: snapshot.data, follows: snapshot.follows };
        }
      } catch { /* Storage can be unavailable or contain an old snapshot. */ }
      const read = async (path) => {
        const response = await fetch(path, { cache: "no-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      };
      const [data, follows] = await Promise.all([
        read("data/posts.json"),
        read("data/follows.json").catch(() => null),
      ]);
      try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data, follows })); } catch { /* Reading still works without storage. */ }
      return { data, follows };
    })();
    return pending;
  };
})();
