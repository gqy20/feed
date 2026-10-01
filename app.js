"use strict";
(async () => {
  const $ = (id) => document.getElementById(id);

  const PLATFORM = { twitter: "X", xhs: "小红书" };
  const validUrl = (value) => { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; } };
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  function platformLogo(platform) {
    if (!PLATFORM[platform]) return el("span", "", platform || "未知平台");
    const image = el("img", "platform-logo platform-logo-" + platform);
    image.src = platform === "xhs" ? "assets/platform-xhs.svg" : "assets/platform-x.svg";
    image.alt = PLATFORM[platform]; image.title = PLATFORM[platform];
    return image;
  }
  const stamp = (p) => { const n = Date.parse(p.created_at); return Number.isFinite(n) ? n : 0; };
  const startOfDay = (value) => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const today = startOfDay(Date.now());
  const formatDate = (n) => n ? new Date(n).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "时间未知";
  const dayLabel = (n) => { if (!n) return "未知日期"; const day = startOfDay(n); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1); if (day === today) return "今天"; if (day === yesterday.getTime()) return "昨天"; return new Date(n).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" }); };
  const timeLabel = (n) => n ? new Date(n).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
  const identity = (p) => `${p.platform}:${p.handle || p.author || "unknown"}`;
  const accountUrl = (a) => a.handle ? a.platform === "twitter" ? `https://x.com/${encodeURIComponent(a.handle)}` : a.platform === "xhs" ? `https://www.xiaohongshu.com/user/profile/${encodeURIComponent(a.handle)}` : null : null;
  const images = (p) => Array.isArray(p.media) ? p.media.map(validUrl).filter(Boolean) : [];
  const bodyText = (p) => { const text = String(p.text || ""); return p.title && text.startsWith(p.title) ? text.slice(p.title.length).replace(/^[\s:：,，-]+/, "") : text; };
  const externalLink = (url, label, className) => { const a = el("a", className, label); a.href = url; a.target = "_blank"; a.rel = "noreferrer noopener"; return a; };
  const state = { accounts: new Set(), q: "", platform: "all", period: "all", media: "all", sort: "latest", selected: null };
  let posts = [], accounts = [], filtered = [], imageSet = [], imageIndex = 0, hasFollows = false, searchOpen = false;
  const params = new URLSearchParams(location.search);
  state.q = params.get("q") || "";
  for (const [key, choices] of Object.entries({ platform: ["all", "twitter", "xhs"], period: ["all", "1", "7", "30"], media: ["all", "images", "text"], sort: ["latest", "oldest", "likes"] })) if (choices.includes(params.get(key))) state[key] = params.get(key);
  state.accounts = new Set(params.getAll("account")); state.selected = params.get("post");
  $("content-search").value = state.q;
  $("platform").value = state.platform; $("period").value = state.period; $("media-filter").value = state.media; $("post-sort").value = state.sort;
  function writeUrl() {
    const url = new URL(location.href);
    for (const key of ["q", "platform", "period", "media", "sort", "account", "post"]) url.searchParams.delete(key);
    if (state.q) url.searchParams.set("q", state.q);
    for (const key of ["platform", "period", "media", "sort"]) if (state[key] !== (key === "sort" ? "latest" : "all")) url.searchParams.set(key, state[key]);
    state.accounts.forEach((a) => url.searchParams.append("account", a)); if (state.selected) url.searchParams.set("post", state.selected);
    history.replaceState(null, "", url); const overviewUrl = new URL("overview.html", url); overviewUrl.search = url.search; $("overview-open").href = overviewUrl.href;
  }
  function withinPeriod(p) { if (state.period === "all") return true; const lower = new Date(today); lower.setDate(lower.getDate() - Number(state.period) + 1); return stamp(p) >= lower.getTime() && stamp(p) <= Date.now(); }
  const countFor = (a) => a.posts.filter(withinPeriod).length;
  function sortAccounts(items, mode) { return [...items].sort((a, b) => mode === "name" ? a.name.localeCompare(b.name, "zh-CN") : (mode === "count" ? countFor(b) - countFor(a) : b.latest - a.latest) || a.name.localeCompare(b.name, "zh-CN")); }
  function chooseAccount(key, multi = false) {
    clearTimeout(searchTimer);
    if (multi) state.accounts.add(key); else state.accounts = new Set([key]);
    state.q = ""; $("content-search").value = "";
    const account = accounts.find(a => a.key === key);
    if (account && state.platform !== "all" && state.platform !== account.platform) { state.platform = "all"; $("platform").value = "all"; }
    closeSearch(); refresh();
  }
  function closeSearch() { searchOpen = false; $("search-results").hidden = true; $("content-search").setAttribute("aria-expanded", "false"); }
  function renderSelectedAccounts() {
    const fragment = document.createDocumentFragment();
    for (const a of accounts.filter(a => state.accounts.has(a.key))) {
      const chip = el("button", "account-chip");
      chip.setAttribute("aria-label", `移除账号 ${a.name}`);
      const remove = el("span", "chip-remove", "×"); remove.setAttribute("aria-hidden", "true");
      chip.append(platformLogo(a.platform), el("span", "", a.name), remove);
      chip.addEventListener("click", () => { state.accounts.delete(a.key); refresh(); $("content-search").focus(); closeSearch(); });
      fragment.append(chip);
    }
    $("selected-accounts").replaceChildren(fragment); $("selected-accounts").hidden = !state.accounts.size;
  }
  function renderSearch() {
    if (!searchOpen) return closeSearch();
    const q = $("content-search").value.trim().toLowerCase(), fragment = document.createDocumentFragment();
    const matches = sortAccounts(accounts.filter(a => !state.accounts.has(a.key) && (state.platform === "all" || a.platform === state.platform) && `${a.name} ${a.handle}`.toLowerCase().includes(q)), "recent");
    if (matches.length) {
      fragment.append(el("p", "suggestion-heading", q ? "匹配账号" : "选择账号"));
      const list = el("div", "account-suggestions");
      for (const a of matches) {
        const button = el("button", "search-account"); button.dataset.account = a.key;
        button.setAttribute("aria-label", `筛选账号 ${a.name}`);
        const info = el("span", "suggestion-copy"); info.append(el("span", "suggestion-name", a.name));
        if (a.handle && a.handle !== a.name) info.append(el("span", "suggestion-handle", a.platform === "twitter" ? `@${a.handle}` : a.handle));
        button.append(platformLogo(a.platform), info, el("span", "suggestion-count", `${countFor(a)} 条`));
        button.addEventListener("click", () => chooseAccount(a.key, true)); list.append(button);
      }
      fragment.append(list);
    }
    if (q) {
      fragment.append(el("p", "suggestion-heading", "匹配内容"));
      for (const p of filtered.slice(0, 4)) {
        const button = el("button", "search-post"); button.dataset.post = p.id;
        button.append(el("span", "suggestion-preview", p.title || p.text || "图片内容"), el("span", "suggestion-handle", `${p.author || p.handle || "未知账号"} · ${dayLabel(stamp(p))}`));
        button.addEventListener("click", () => { closeSearch(); selectPost(p.id, true); }); fragment.append(button);
      }
      if (filtered.length > limit) {
      const more = el("button", "load-more", `继续显示 · 还有 ${filtered.length - limit} 条`);
      more.addEventListener("click", () => { renderTimeline(limit + 80); $("post-list").querySelectorAll(".post-button")[limit]?.focus({ preventScroll: true }); });
      fragment.append(more);
    }
    if (!filtered.length) fragment.append(el("p", "suggestion-empty", "没有匹配内容"));
      const searchAll = el("button", "search-all", `查看全部 ${filtered.length} 条匹配内容 →`);
      searchAll.addEventListener("click", () => { closeSearch(); $("content-search").blur(); }); fragment.append(searchAll);
    }
    if (!fragment.childNodes.length) fragment.append(el("p", "suggestion-empty", "没有可选账号"));
    $("search-results").replaceChildren(fragment); $("search-results").hidden = false; $("content-search").setAttribute("aria-expanded", "true");
  }
  function refresh() {
    const q = state.q.trim().toLowerCase();
    filtered = posts.filter((p) => (!state.accounts.size || state.accounts.has(identity(p))) && (state.platform === "all" || p.platform === state.platform) && withinPeriod(p) && (state.media === "all" || (state.media === "images" ? images(p).length > 0 : images(p).length === 0)) && `${p.title || ""} ${p.text || ""} ${p.author || ""} ${p.handle || ""}`.toLowerCase().includes(q));
    filtered.sort((a, b) => state.sort === "likes" ? (Number(b.metrics?.likes) || 0) - (Number(a.metrics?.likes) || 0) || stamp(b) - stamp(a) : state.sort === "oldest" ? stamp(a) - stamp(b) : stamp(b) - stamp(a));
    const oldSelection = state.selected; if (!filtered.some((p) => p.id === state.selected)) state.selected = filtered[0]?.id || null;
    const names = accounts.filter((a) => state.accounts.has(a.key)).map((a) => a.name);
    $("timeline-title").textContent = names.length === 1 ? names[0] : names.length ? `${names.length} 个账号` : "全部内容"; $("result-count").textContent = `${filtered.length} 条`;
    $("filter-summary").textContent = [names.length > 1 ? `已选 ${names.length} 个账号` : "", state.period !== "all" ? $("period").selectedOptions[0].textContent : "", state.platform !== "all" ? PLATFORM[state.platform] : "", state.media !== "all" ? $("media-filter").selectedOptions[0].textContent : "", q ? `搜索：${state.q}` : ""].filter(Boolean).join(" · ");
    $("clear-filters").hidden = !state.accounts.size && !q && state.platform === "all" && state.period === "all" && state.media === "all" && state.sort === "latest"; $("filter-summary").parentElement.hidden = $("clear-filters").hidden; renderSelectedAccounts(); renderSearch(); renderTimeline(); renderReader(oldSelection !== state.selected); writeUrl();
  }
  function renderTimeline(limit = 80) {
    limit = Math.max(limit, filtered.findIndex(p => p.id === state.selected) + 1);
    const fragment = document.createDocumentFragment(); let lastDay = null;
    for (const p of filtered.slice(0, limit)) {
      const day = dayLabel(stamp(p)); if (day !== lastDay) { fragment.append(el("h2", "day-heading", day)); lastDay = day; }
      const button = el("button", "post-button" + (p.id === state.selected ? " selected" : "")); button.dataset.id = p.id; button.setAttribute("aria-current", String(p.id === state.selected));
      const meta = el("span", "post-meta"); meta.append(el("span", "post-author", p.author || p.handle || "未知账号"), platformLogo(p.platform), el("time", "", timeLabel(stamp(p))));
      const preview = el("span", "post-preview"), copy = el("span", "post-copy"); if (p.title) copy.append(el("span", "preview-title", p.title));
      const body = bodyText(p); if (body) copy.append(el("span", "preview-text", body)); if (!p.title && !body) copy.append(el("span", "preview-text", images(p).length ? "图片内容" : "暂无正文 · 查看原文")); preview.append(copy);
      if (images(p).length) { const image = el("img", "thumbnail"); image.src = images(p)[0]; image.alt = ""; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; image.addEventListener("error", () => image.remove(), { once: true }); preview.append(image); }
      button.append(meta, preview); button.addEventListener("click", () => selectPost(p.id, true)); fragment.append(button);
    }
    if (filtered.length > limit) {
      const more = el("button", "load-more", `继续显示 · 还有 ${filtered.length - limit} 条`);
      more.addEventListener("click", () => { renderTimeline(limit + 80); $("post-list").querySelectorAll(".post-button")[limit]?.focus({ preventScroll: true }); });
      fragment.append(more);
    }
    if (!filtered.length) fragment.append(el("p", "state", "没有符合条件的内容。试试切换账号、扩大时间范围或重置筛选。")); $("post-list").replaceChildren(fragment);
  }
  function appendText(container, text) {
    for (const paragraph of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
      if (!paragraph.trim()) continue; const p = el("p"); let cursor = 0;
      for (const match of paragraph.matchAll(/https?:\/\/[^\s<>]+/g)) { p.append(document.createTextNode(paragraph.slice(cursor, match.index))); const url = validUrl(match[0]); p.append(url ? externalLink(url, match[0]) : document.createTextNode(match[0])); cursor = match.index + match[0].length; }
      p.append(document.createTextNode(paragraph.slice(cursor))); container.append(p);
    }
  }
  function renderReader(resetScroll = true) {
    const p = filtered.find((p) => p.id === state.selected), index = filtered.indexOf(p);
    $("previous").disabled = index <= 0; $("next").disabled = index < 0 || index >= filtered.length - 1; $("position").textContent = p ? `${index + 1} / ${filtered.length}` : "";
    if (!p) { const empty = el("div", "reader-empty"); empty.append(el("span", "empty-mark", "T."), el("h2", "", "这里暂时没有内容"), el("p", "", "调整左侧筛选，继续阅读。")); $("article").replaceChildren(empty); return; }
    const fragment = document.createDocumentFragment(), author = el("div", "article-author"), info = el("div"), name = p.author || p.handle || "未知账号";
    author.append(el("span", "avatar", name.slice(0, 2).replace(/^@/, ""))); const profile = accountUrl(p); info.append(profile ? externalLink(profile, name, "author-name") : el("span", "author-name", name));
    const meta = el("p", "article-meta"), original = validUrl(p.url); meta.append(platformLogo(p.platform), document.createTextNode(`${formatDate(stamp(p))}${p.is_repost ? " · 转发" : ""}`)); if (original) meta.append(externalLink(original, "查看原文 ↗")); info.append(meta); author.append(info); fragment.append(author);
    if (p.title) fragment.append(el("h1", "article-title", p.title)); const body = el("div", "article-body"), text = bodyText(p); if (text) appendText(body, text); else if (!images(p).length) body.append(el("p", "no-body", "此条内容未采集正文，可通过原文入口继续阅读。")); fragment.append(body);
    const media = images(p);
    if (media.length) {
      const grid = el("div", "media-grid" + (media.length === 1 ? " single" : ""));
      media.forEach((url, i) => { const button = el("button", "media-button"), image = el("img"); button.setAttribute("aria-label", `查看第 ${i + 1} 张图片`); image.src = url; image.alt = `${name} 发布的第 ${i + 1} 张图片`; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; image.addEventListener("error", () => button.replaceChildren(el("span", "media-failure", "图片加载失败 · 点击查看原图")), { once: true }); button.append(image); button.addEventListener("click", () => { imageSet = media; imageIndex = i; showImage(); $("lightbox").showModal(); }); grid.append(button); }); fragment.append(grid);
    }
    const footer = el("footer", "article-footer"); for (const [key, label] of [["likes", "赞"], ["replies", "回复"], ["retweets", "转发"], ["collects", "收藏"]]) if (typeof p.metrics?.[key] === "number" && p.metrics[key] > 0) footer.append(el("span", "", `${label} ${p.metrics[key].toLocaleString("zh-CN")}`)); if (footer.childElementCount) fragment.append(footer); $("article").replaceChildren(fragment); if (resetScroll) $("reading-scroll").scrollTop = 0;
  }
  function selectPost(id, openMobile = false) { state.selected = id; if (![...$("post-list").querySelectorAll(".post-button")].some(button => button.dataset.id === id)) renderTimeline(); for (const button of $("post-list").querySelectorAll(".post-button")) { const selected = button.dataset.id === id; button.classList.toggle("selected", selected); button.setAttribute("aria-current", String(selected)); } renderReader(); writeUrl(); if (openMobile && matchMedia("(max-width:699px)").matches) { document.querySelector(".workspace").classList.add("reading"); $("reader").focus(); } }
  function movePost(delta) { const index = filtered.findIndex((p) => p.id === state.selected), p = filtered[index + delta]; if (p) { selectPost(p.id); [...$("post-list").querySelectorAll(".post-button")].find((b) => b.dataset.id === p.id)?.scrollIntoView({ block: "nearest" }); } }
  function showImage() { $("image-error").hidden = true; $("large-image").hidden = false; $("large-image").referrerPolicy = "no-referrer"; $("large-image").src = imageSet[imageIndex]; $("large-image").alt = `第 ${imageIndex + 1} 张图片`; $("original-image").href = imageSet[imageIndex]; $("image-position").textContent = `${imageIndex + 1} / ${imageSet.length}`; $("image-previous").disabled = imageIndex === 0; $("image-next").disabled = imageIndex === imageSet.length - 1; }
  $("large-image").addEventListener("error", () => { $("large-image").hidden = true; $("image-error").hidden = false; }); $("image-previous").addEventListener("click", () => { if (imageIndex > 0) { imageIndex--; showImage(); } }); $("image-next").addEventListener("click", () => { if (imageIndex < imageSet.length - 1) { imageIndex++; showImage(); } }); $("image-close").addEventListener("click", () => $("lightbox").close());
  $("back-list").addEventListener("click", () => { document.querySelector(".workspace").classList.remove("reading"); [...$("post-list").querySelectorAll(".post-button")].find((b) => b.dataset.id === state.selected)?.focus(); });
  let searchTimer;
  $("content-search").addEventListener("focus", () => { searchOpen = true; renderSearch(); });
  $("content-search").addEventListener("click", () => { searchOpen = true; renderSearch(); });
  $("content-search").addEventListener("input", () => { searchOpen = true; clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.q = $("content-search").value; refresh(); }, 160); });
  $("search-area").addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closeSearch(); $("content-search").focus(); closeSearch(); }
    if (event.key === "Enter" && event.target === $("content-search")) { event.preventDefault(); clearTimeout(searchTimer); state.q = $("content-search").value; closeSearch(); refresh(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); if (!searchOpen) { searchOpen = true; renderSearch(); }
      const buttons = [...$("search-results").querySelectorAll("button")];
      if (buttons.length) { const index = buttons.indexOf(document.activeElement); const next = event.key === "ArrowDown" ? Math.min(index + 1, buttons.length - 1) : Math.max(index - 1, 0); buttons[next].focus(); }
    }
  });
  $("search-area").addEventListener("focusout", event => { if (!$("search-area").contains(event.relatedTarget)) closeSearch(); });
  document.addEventListener("click", event => { if (!$("search-area").contains(event.target)) closeSearch(); });
  for (const [id, key] of [["platform", "platform"], ["period", "period"], ["media-filter", "media"], ["post-sort", "sort"]]) $(id).addEventListener("change", () => { state[key] = $(id).value; refresh(); });
  $("clear-filters").addEventListener("click", () => { clearTimeout(searchTimer); state.accounts.clear(); state.q = ""; state.platform = state.period = state.media = "all"; state.sort = "latest"; $("content-search").value = ""; closeSearch(); for (const id of ["platform", "period", "media-filter"]) $(id).value = "all"; $("post-sort").value = "latest"; refresh(); });
  $("previous").addEventListener("click", () => movePost(-1)); $("next").addEventListener("click", () => movePost(1));
  document.addEventListener("keydown", (event) => {
    if ($("lightbox").open) { if (event.key === "ArrowLeft") $("image-previous").click(); if (event.key === "ArrowRight") $("image-next").click(); return; }
    if (event.target.closest("input,select,textarea,#search-area") || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); movePost(event.key === "ArrowDown" ? 1 : -1); }
  });
  try {
    const { data, follows } = await window.loadTrailFeed();
    posts = (Array.isArray(data.posts) ? data.posts : []).filter((p) => p && typeof p === "object").map((p, i) => ({ ...p, id: String(p.id || `post-${i}`) })); const map = new Map();
    if (Array.isArray(follows?.accounts)) { hasFollows = true; for (const a of follows.accounts.filter(a => a && a.handle)) map.set(identity(a), { ...a, key: identity(a), name: a.name || a.handle, followed: true, posts: [], latest: 0, days: new Map() }); }
    for (const p of posts) { const key = identity(p); if (!map.has(key)) map.set(key, { platform: p.platform, handle: p.handle, key, name: p.author || p.handle || "未知账号", followed: false, posts: [], latest: 0, days: new Map() }); const a = map.get(key); if (!hasFollows && p.author) a.name = p.author; a.posts.push(p); a.latest = Math.max(a.latest, stamp(p)); if (stamp(p)) { const day = startOfDay(stamp(p)); a.days.set(day, (a.days.get(day) || 0) + 1); } }
    accounts = [...map.values()]; state.accounts = new Set([...state.accounts].filter((key) => map.has(key)));
    const updated = Date.parse(data.updated_at); $("update").textContent = `${posts.length} 条已收录${Number.isFinite(updated) ? ` · 更新于 ${formatDate(updated)}` : ""}`; refresh();
  } catch (error) { $("update").textContent = "数据暂不可用"; $("post-list").replaceChildren(el("p", "state", `数据读取失败：${error.message}。请刷新后重试。`)); }
})();
