"use strict";
(async () => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const readingParams = new URLSearchParams(params);
  for (const key of ["ovq", "ovsort"]) readingParams.delete(key);
  const readingUrl = new URL("./", location.href); readingUrl.search = readingParams.toString();
  $("back-reading").href = $("brand-reading").href = readingUrl.href;
  $("overview-search").value = params.get("ovq") || "";
  if (["all", "1", "7", "30"].includes(params.get("period"))) $("overview-period").value = params.get("period");
  if (["recent", "count", "name"].includes(params.get("ovsort"))) $("overview-sort").value = params.get("ovsort");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let accounts = [], ready = false;
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const keyFor = a => `${a.platform}:${a.handle || a.author || "unknown"}`;
  const formatDate = n => n ? new Date(n).toLocaleString("zh-CN", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit", hour12:false }) : "暂无已采集内容";
  function periodCount(a) { const period = $("overview-period").value; if (period === "all") return a.times.length; const lower = new Date(today); lower.setDate(lower.getDate() - Number(period) + 1); return a.times.filter(n => n >= lower.getTime() && n <= Date.now()).length; }
  function render() {
    if (!ready) return;
    const query = $("overview-search").value.trim().toLowerCase(), sort = $("overview-sort").value;
    const matched = accounts.filter(a => `${a.name} ${a.handle}`.toLowerCase().includes(query));
    matched.sort((a,b) => sort === "name" ? a.name.localeCompare(b.name,"zh-CN") : (sort === "count" ? periodCount(b)-periodCount(a) : b.latest-a.latest) || a.name.localeCompare(b.name,"zh-CN"));
    const fragment = document.createDocumentFragment();
    for (const a of matched) {
      const row = el("tr"), name = el("td"), link = el("a","overview-account");
      const url = new URL("./",location.href); url.searchParams.set("account",a.key); if ($("overview-period").value !== "all") url.searchParams.set("period",$("overview-period").value); link.href = url.href;
      if (["twitter","xhs"].includes(a.platform)) { const logo = el("img",`platform-logo platform-logo-${a.platform}`); logo.src = a.platform === "xhs" ? "assets/platform-xhs.svg" : "assets/platform-x.svg"; logo.alt = a.platform === "xhs" ? "小红书" : "X"; link.append(logo); }
      else link.append(el("span","",a.platform));
      link.append(el("span","",a.name)); name.append(link);
      if (!a.followed) name.append(el("span","history-label","历史"));
      row.append(name,el("td","",formatDate(a.latest)),el("td","",periodCount(a)));
      const activity = el("td"), map = el("span","heatmap");
      for (let offset=29;offset>=0;offset--) { const day = new Date(today); day.setDate(day.getDate()-offset); const count = a.days.get(day.getTime()) || 0, cell=el("i"); cell.dataset.level = count >= 5 ? "3" : count >= 2 ? "2" : count ? "1" : "0"; cell.title = `${day.toLocaleDateString("zh-CN")} · ${count} 条`; map.append(cell); }
      activity.append(map); row.append(activity); fragment.append(row);
    }
    if (!matched.length) { const row=el("tr"),cell=el("td","state","没有符合条件的账号"); cell.colSpan=4; row.append(cell); fragment.append(row); }
    $("overview-body").replaceChildren(fragment); $("overview-count").textContent = `${matched.length} 个账号`;
    $("count-heading").textContent = $("overview-period").value === "all" ? "已采集条数" : `${$("overview-period").selectedOptions[0].textContent}条数`;
    const url=new URL(location.href); for (const key of ["ovq","ovsort"]) url.searchParams.delete(key);
    if(query)url.searchParams.set("ovq",$("overview-search").value); if(sort!=="recent")url.searchParams.set("ovsort",sort);
    if($("overview-period").value==="all")url.searchParams.delete("period");else url.searchParams.set("period",$("overview-period").value);
    history.replaceState(null,"",url);
  }
  $("overview-search").addEventListener("input",render); $("overview-sort").addEventListener("change",render); $("overview-period").addEventListener("change",render);
  try {
    const { data, follows } = await window.loadTrailFeed(); const posts=Array.isArray(data.posts)?data.posts:[],map=new Map();
    let hasFollows=false;
    if(Array.isArray(follows?.accounts)){hasFollows=true;for(const a of follows.accounts.filter(a=>a&&a.handle))map.set(keyFor(a),{...a,key:keyFor(a),name:a.name||a.handle,followed:true,latest:0,times:[],days:new Map()});}
    for(const p of posts.filter(p=>p&&typeof p==="object")){const key=keyFor(p);if(!map.has(key))map.set(key,{...p,key,name:p.author||p.handle||"未知账号",followed:false,latest:0,times:[],days:new Map()});const a=map.get(key);if(!hasFollows&&p.author)a.name=p.author;const parsed=Date.parse(p.created_at),n=Number.isFinite(parsed)?parsed:0;a.times.push(n);a.latest=Math.max(a.latest,n);if(n){const d=new Date(n);d.setHours(0,0,0,0);a.days.set(d.getTime(),(a.days.get(d.getTime())||0)+1);}}
    accounts=[...map.values()];ready=true;
    $("overview-note").textContent=hasFollows?`${accounts.filter(a=>a.followed).length} 个关注 · ${accounts.filter(a=>!a.followed).length} 个历史账号 · 统计仅覆盖已采集内容`:"账号由已采集帖子推导，统计仅覆盖已采集内容";
    const updated=Date.parse(data.updated_at);$("update").textContent=`${posts.length} 条已收录${Number.isFinite(updated)?` · 更新于 ${formatDate(updated)}`:""}`;render();
  }catch(error){$("update").textContent="数据暂不可用";const row=el("tr"),cell=el("td","state",`数据读取失败：${error.message}。请刷新后重试。`);cell.colSpan=4;row.append(cell);$("overview-body").replaceChildren(row);}
})();
