(async function () {
  let hubData = null;
  let searchIndex = [];
  let sbClient = null;
  let currentUser = null;
  let supabaseReady = false;

  // Local storage fallback keys
  const LS_GATES = 'mg_dd_gates_v1';
  const LS_ACTIONS = 'mg_dd_actions_v1';
  const LS_NOTES = 'mg_dd_notes_v1';

  let gateState = {};
  let actionState = {};
  let notesState = [];

  // Map variables
  let map = null;
  let satLayer = null;
  let osmLayer = null;
  let usingSat = true;
  let campusMarkerGroup = null;
  let routeGroup = null;
  let taiwanGroup = null;
  let equipmentMarkers = {};
  let activeMapMode = 'campus';
  let activeCatFilter = 'all';

  // Load JSON data
  try {
    const [hubRes, idxRes] = await Promise.all([
      fetch('data/hub.json'),
      fetch('data/search-index.json')
    ]);
    hubData = await hubRes.json();
    searchIndex = await idxRes.json();
  } catch (err) {
    console.error('載入平台資料失敗:', err);
    return;
  }

  // ==================== 1. KPI & MEETINGS RENDER ====================
  function renderKPIs() {
    const el = document.getElementById('kpiStrip');
    if (!el) return;
    el.innerHTML = hubData.kpis.map(k => `
      <div class="bg-white/5 border border-white/15 rounded-xl p-3.5 backdrop-blur-sm">
        <div class="text-[11px] font-semibold text-slate-300">${k.label}</div>
        <div class="text-xl sm:text-2xl font-black text-white mt-0.5">${k.value}</div>
        <div class="text-[11px] text-sky-300/90 mt-0.5 leading-snug">${k.sub}</div>
      </div>
    `).join('');
  }

  function renderMeetings(stage = 'all') {
    const grid = document.getElementById('meetingsGrid');
    if (!grid) return;
    const list = stage === 'all' ? hubData.meetings : hubData.meetings.filter(m => m.stage === stage);
    grid.innerHTML = list.map(m => {
      const isReady = m.status === 'ready';
      return `
        <article class="bg-white rounded-2xl border ${isReady ? 'border-royal/40 shadow-md ring-1 ring-electric/20' : 'border-slate-200 border-dashed'} p-5 flex flex-col justify-between gap-4 transition hover:shadow-lg">
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-md text-xs font-black ${isReady ? 'bg-navy text-sky-300' : 'bg-slate-200 text-slate-600'}">${m.id}</span>
                <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">${m.stage}</span>
                <span class="text-xs text-slate-400">${m.date}</span>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isReady ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}">${m.verdict}</span>
            </div>
            <div>
              <h3 class="text-lg font-extrabold text-navy leading-snug">${m.title}</h3>
              <p class="text-xs text-slate-500 mt-1 leading-relaxed">${m.subtitle}</p>
            </div>
            <ul class="space-y-1.5 text-xs text-slate-700">
              ${m.highlights.map(h => `<li class="flex gap-2"><span class="text-electric font-bold">▸</span><span>${h}</span></li>`).join('')}
            </ul>
            <div class="flex flex-wrap gap-1.5 pt-1">
              ${m.tags.map(t => `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">#${t}</span>`).join('')}
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <div class="text-xs text-slate-500 font-semibold">
              ${isReady ? `⏱ ${m.duration} · ${m.slideCount} 頁 · ${m.svgCount} 張 SVG` : `📌 ${m.duration}（依 docs/EXPANSION.md 掛載）`}
            </div>
            ${isReady
              ? `<a href="${m.url}" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-navy hover:bg-royal text-white text-xs font-extrabold transition shadow-sm">開啟簡報 →</a>`
              : `<a href="docs/EXPANSION.md" target="_blank" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition">擴充規範</a>`
            }
          </div>
        </article>
      `;
    }).join('');
  }

  function renderQuickSlides() {
    const el = document.getElementById('m01QuickSlides');
    if (!el) return;
    const slides = searchIndex.filter(item => item.type === 'slide' && item.meetingId === 'M01');
    el.innerHTML = slides.map(s => `
      <a href="${s.url}" class="group p-2.5 rounded-lg border border-slate-200 hover:border-electric hover:bg-sky-50/70 transition flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black text-royal">SLIDE ${String(s.slideNo).padStart(2, '0')}</span>
          <span class="text-[10px] text-slate-400">${s.section}</span>
        </div>
        <div class="text-xs font-bold text-navy group-hover:text-royal line-clamp-2 leading-snug">${s.title}</div>
      </a>
    `).join('');
  }

  // Stage filter clicks
  document.querySelectorAll('.stage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stage-btn').forEach(b => {
        b.className = 'stage-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100';
      });
      btn.className = 'stage-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-navy text-white';
      renderMeetings(btn.dataset.stage);
    });
  });

  // ==================== 2. GLOBAL KEYWORD SEARCH ====================
  function highlightText(text, tokens) {
    let out = text;
    tokens.forEach(t => {
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
    });
    return out;
  }

  function queryIndex(raw) {
    const q = raw.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return searchIndex.filter(item => {
      const hay = [item.title, item.section, item.archetype, item.snippet, ...(item.keywords || [])].join(' ').toLowerCase();
      return tokens.every(t => hay.includes(t));
    });
  }

  function renderSearchHits(container, rawQuery, onSelect) {
    const tokens = rawQuery.trim().split(/\s+/).filter(Boolean);
    const hits = queryIndex(rawQuery);
    if (!tokens.length) {
      container.innerHTML = '';
      return 0;
    }
    if (!hits.length) {
      container.innerHTML = '<div class="col-span-2 text-center py-6 text-xs text-slate-500">查無相符結果，請嘗試不同關鍵字（例如：利益迴避、100 ms、低負載、跨電號）。</div>';
      return 0;
    }
    container.innerHTML = hits.map(h => {
      const badge = h.type === 'map'
        ? '<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">🛰 地圖點位</span>'
        : `<span class="px-2 py-0.5 rounded bg-sky-100 text-royal text-[10px] font-extrabold">${h.meetingId} · 第 ${h.slideNo} 頁</span>`;
      return `
        <div class="search-result-card p-3 rounded-xl border border-slate-200 hover:border-electric hover:bg-sky-50/50 cursor-pointer transition bg-white" data-url="${h.url}">
          <div class="flex items-center justify-between gap-2 mb-1">
            ${badge}
            <span class="text-[10px] text-slate-400 font-semibold">${h.archetype}</span>
          </div>
          <div class="text-xs sm:text-sm font-extrabold text-navy leading-snug">${highlightText(h.title, tokens)}</div>
          <p class="text-xs text-slate-600 mt-1 leading-relaxed">${highlightText(h.snippet, tokens)}</p>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.search-result-card').forEach(card => {
      card.addEventListener('click', () => {
        const url = card.dataset.url;
        if (onSelect) onSelect();
        if (url.startsWith('#map-section|')) {
          const eqId = url.split('|')[1];
          document.getElementById('map-section').scrollIntoView({ behavior: 'smooth' });
          switchMapMode('campus');
          setTimeout(() => focusEquipment(eqId), 350);
        } else {
          window.location.href = url;
        }
      });
    });
    return hits.length;
  }

  const inlineInput = document.getElementById('inlineSearchInput');
  const inlineResults = document.getElementById('inlineSearchResults');
  const clearBtn = document.getElementById('clearSearchBtn');
  const countBadge = document.getElementById('searchCountBadge');

  function handleInlineSearch(val) {
    const trimmed = val.trim();
    clearBtn.classList.toggle('hidden', !trimmed);
    if (!trimmed) {
      inlineResults.classList.add('hidden');
      countBadge.textContent = '';
      return;
    }
    inlineResults.classList.remove('hidden');
    const n = renderSearchHits(inlineResults, trimmed);
    countBadge.textContent = `找到 ${n} 筆精準結果`;
  }

  inlineInput?.addEventListener('input', e => handleInlineSearch(e.target.value));
  clearBtn?.addEventListener('click', () => { inlineInput.value = ''; handleInlineSearch(''); inlineInput.focus(); });
  document.querySelectorAll('.hot-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      inlineInput.value = chip.textContent;
      handleInlineSearch(chip.textContent);
    });
  });

  // Ctrl+K Modal
  const searchModal = document.getElementById('searchModal');
  const modalInput = document.getElementById('modalSearchInput');
  const modalResults = document.getElementById('modalSearchResults');

  function openSearchModal() {
    searchModal.classList.remove('hidden');
    modalInput.focus();
    if (!modalInput.value) {
      modalResults.innerHTML = '<div class="p-4 text-xs text-slate-500">提示：輸入關鍵字即可跨簡報頁碼與地圖點位即時檢索（例：<code>利益迴避</code>、<code>低負載</code>、<code>100 ms</code>、<code>跨電號</code>、<code>25分</code>）。</div>';
    }
  }
  function closeSearchModal() { searchModal.classList.add('hidden'); }

  document.getElementById('openSearchModalBtn')?.addEventListener('click', openSearchModal);
  document.getElementById('closeSearchModalBtn')?.addEventListener('click', closeSearchModal);
  searchModal?.addEventListener('click', e => { if (e.target === searchModal) closeSearchModal(); });
  modalInput?.addEventListener('input', e => renderSearchHits(modalResults, e.target.value, closeSearchModal));

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearchModal();
    } else if (e.key === 'Escape') {
      closeSearchModal();
      document.getElementById('authModal')?.classList.add('hidden');
    }
  });

  // ==================== 3. LEAFLET INTERACTIVE GIS MAP ====================
  const catColors = {
    core: '#F97316',
    shelter: '#1E3A8A',
    pv: '#D97706',
    grid: '#334155',
    risk: '#DC2626'
  };

  function initMap() {
    map = L.map('microgridMap', { zoomControl: true }).setView([23.4665, 120.4844], 16);

    satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; National Chiayi University Lantan Campus'
    });
    osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    satLayer.addTo(map);
    campusMarkerGroup = L.layerGroup().addTo(map);
    routeGroup = L.layerGroup().addTo(map);
    taiwanGroup = L.layerGroup();

    drawCampusLayer('all');
    drawTaiwanLayer();
  }

  function drawCampusLayer(category) {
    campusMarkerGroup.clearLayers();
    routeGroup.clearLayers();
    equipmentMarkers = {};

    // Draw high-voltage & island routes
    hubData.mapData.ncyuRoutes.forEach(r => {
      const poly = L.polyline(r.coords, {
        color: r.color,
        weight: r.weight,
        opacity: 0.9,
        dashArray: r.dashArray || undefined
      }).bindTooltip(r.name, { sticky: true });
      poly.addTo(routeGroup);
    });

    const list = category === 'all'
      ? hubData.mapData.ncyuEquipment
      : hubData.mapData.ncyuEquipment.filter(e => e.category === category);

    list.forEach(eq => {
      const bg = catColors[eq.category] || '#051C2C';
      const icon = L.divIcon({
        className: '',
        html: `<div class="custom-pin" style="background:${bg};width:34px;height:34px;">${eq.code}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });

      const popupHtml = `
        <div style="font-family:'Noto Sans TC',sans-serif;">
          <div style="background:${bg};color:#fff;padding:10px 12px;">
            <div style="font-size:10px;font-weight:700;opacity:0.9;">${eq.categoryLabel} · ${eq.meter}</div>
            <div style="font-size:13px;font-weight:800;margin-top:2px;line-height:1.35;">${eq.name}</div>
          </div>
          <div style="padding:10px 12px;font-size:11.5px;color:#1E293B;line-height:1.5;">
            <div style="margin-bottom:6px;"><strong>核心規格：</strong>${eq.specs}</div>
            <div style="margin-bottom:6px;color:#475569;">${eq.details}</div>
            <div style="background:#FEF2F2;border-left:3px solid #DC2626;padding:6px 8px;border-radius:0 4px 4px 0;color:#991B1B;font-size:11px;margin-bottom:8px;">
              <strong>盡調提醒：</strong>${eq.risk}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:10px;color:#64748B;">座標：${eq.lat.toFixed(5)}, ${eq.lng.toFixed(5)}</span>
              <a href="decks/ncyu-lantan-pcm-dd.html#slide-${eq.slide}" style="background:#051C2C;color:#38BDF8;padding:4px 9px;border-radius:5px;text-decoration:none;font-weight:700;font-size:11px;">詳見簡報第 ${eq.slide} 頁 →</a>
            </div>
          </div>
        </div>
      `;

      const marker = L.marker([eq.lat, eq.lng], { icon }).bindPopup(popupHtml);
      marker.addTo(campusMarkerGroup);
      equipmentMarkers[eq.id] = marker;
    });

    renderMapSidebar(list, 'campus');
  }

  function drawTaiwanLayer() {
    taiwanGroup.clearLayers();
    hubData.mapData.campuses.forEach(c => {
      const isAct = c.status === 'active';
      const bg = isAct ? '#DC2626' : '#475569';
      const icon = L.divIcon({
        className: '',
        html: `<div class="custom-pin" style="background:${bg};width:${isAct ? 38 : 28}px;height:${isAct ? 38 : 28}px;font-size:${isAct ? 12 : 10}px;">${isAct ? '嘉大' : '校'}</div>`,
        iconSize: [isAct ? 38 : 28, isAct ? 38 : 28],
        iconAnchor: [isAct ? 19 : 14, isAct ? 19 : 14]
      });

      const popup = `
        <div style="font-family:'Noto Sans TC',sans-serif;">
          <div style="background:${isAct ? '#051C2C' : '#334155'};color:#fff;padding:10px 12px;">
            <div style="font-size:10px;color:#38BDF8;font-weight:700;">${c.badge}</div>
            <div style="font-size:14px;font-weight:800;margin-top:2px;">${c.name}</div>
          </div>
          <div style="padding:10px 12px;font-size:11.5px;color:#1E293B;line-height:1.5;">
            <div><strong>計畫：</strong>${c.program}</div>
            <div style="margin:4px 0;"><strong>預算規模：</strong>${c.budget}</div>
            <div style="color:#475569;margin-bottom:8px;">${c.detail}</div>
            ${isAct ? `<button onclick="window.__focusNcyuCampus()" style="width:100%;background:#00A9F4;color:#051C2C;border:none;padding:6px;border-radius:6px;font-weight:800;font-size:11.5px;cursor:pointer;">🛰 縮放檢視蘭潭校區 13 處設備詳圖</button>` : ''}
          </div>
        </div>
      `;
      L.marker([c.lat, c.lng], { icon }).bindPopup(popup).addTo(taiwanGroup);
    });
  }

  function renderMapSidebar(items, mode) {
    const listEl = document.getElementById('mapSidebarList');
    const titleEl = document.getElementById('mapListTitle');
    if (!listEl) return;

    if (mode === 'campus') {
      titleEl.textContent = `蘭潭校區設備與風險點清單（${items.length} 處）`;
      listEl.innerHTML = items.map(eq => {
        const bg = catColors[eq.category] || '#051C2C';
        return `
          <button class="w-full text-left p-3 hover:bg-sky-50/70 transition flex items-start gap-2.5" data-eq-id="${eq.id}">
            <span class="shrink-0 w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center mt-0.5 shadow-sm" style="background:${bg}">${eq.code}</span>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-extrabold text-navy leading-snug">${eq.name}</div>
              <div class="text-[11px] text-slate-500 mt-0.5 line-clamp-2">${eq.specs}</div>
            </div>
          </button>
        `;
      }).join('');
      listEl.querySelectorAll('[data-eq-id]').forEach(btn => {
        btn.addEventListener('click', () => focusEquipment(btn.dataset.eqId));
      });
    } else {
      titleEl.textContent = `全台大學微電網標案雷達（${items.length} 校）`;
      listEl.innerHTML = items.map(c => `
        <button class="w-full text-left p-3 hover:bg-sky-50/70 transition flex items-start gap-2.5" data-campus-lat="${c.lat}" data-campus-lng="${c.lng}" data-campus-id="${c.id}">
          <span class="shrink-0 px-2 py-0.5 rounded text-[10px] font-black text-white mt-0.5 ${c.status === 'active' ? 'bg-red-600' : 'bg-slate-500'}">${c.status === 'active' ? '已盡調' : '追蹤中'}</span>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-extrabold text-navy">${c.name}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">${c.budget}</div>
          </div>
        </button>
      `).join('');
      listEl.querySelectorAll('[data-campus-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          map.flyTo([parseFloat(btn.dataset.campusLat), parseFloat(btn.dataset.campusLng)], 12, { duration: 0.7 });
        });
      });
    }
  }

  function focusEquipment(eqId) {
    const eq = hubData.mapData.ncyuEquipment.find(e => e.id === eqId);
    if (!eq || !map) return;
    if (activeCatFilter !== 'all' && activeCatFilter !== eq.category) {
      activeCatFilter = 'all';
      drawCampusLayer('all');
    }
    map.flyTo([eq.lat, eq.lng], 18, { duration: 0.65 });
    setTimeout(() => { equipmentMarkers[eqId]?.openPopup(); }, 500);
  }

  function switchMapMode(mode) {
    activeMapMode = mode;
    const btnC = document.getElementById('btnViewCampus');
    const btnT = document.getElementById('btnViewTaiwan');
    const catBar = document.getElementById('mapCategoryFilters');
    if (mode === 'campus') {
      btnC.className = 'px-3.5 py-2 rounded-lg text-xs font-extrabold bg-navy text-white shadow-sm';
      btnT.className = 'px-3.5 py-2 rounded-lg text-xs font-extrabold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100';
      catBar.classList.remove('hidden');
      map.removeLayer(taiwanGroup);
      campusMarkerGroup.addTo(map);
      routeGroup.addTo(map);
      map.flyTo([23.4665, 120.4844], 16, { duration: 0.65 });
      drawCampusLayer(activeCatFilter);
    } else {
      btnT.className = 'px-3.5 py-2 rounded-lg text-xs font-extrabold bg-navy text-white shadow-sm';
      btnC.className = 'px-3.5 py-2 rounded-lg text-xs font-extrabold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100';
      catBar.classList.add('hidden');
      map.removeLayer(campusMarkerGroup);
      map.removeLayer(routeGroup);
      taiwanGroup.addTo(map);
      map.flyTo([23.75, 120.75], 8, { duration: 0.65 });
      renderMapSidebar(hubData.mapData.campuses, 'taiwan');
    }
  }
  window.__focusNcyuCampus = () => switchMapMode('campus');

  document.getElementById('btnViewCampus')?.addEventListener('click', () => switchMapMode('campus'));
  document.getElementById('btnViewTaiwan')?.addEventListener('click', () => switchMapMode('taiwan'));
  document.getElementById('btnToggleBasemap')?.addEventListener('click', () => {
    usingSat = !usingSat;
    if (usingSat) { map.removeLayer(osmLayer); satLayer.addTo(map); }
    else { map.removeLayer(satLayer); osmLayer.addTo(map); }
  });
  document.querySelectorAll('.map-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCatFilter = btn.dataset.cat;
      document.querySelectorAll('.map-cat-btn').forEach(b => {
        b.className = 'map-cat-btn px-3 py-1 rounded-full text-xs font-bold bg-white border border-slate-300 text-slate-700';
      });
      btn.className = 'map-cat-btn px-3 py-1 rounded-full text-xs font-bold bg-navy text-white';
      drawCampusLayer(activeCatFilter);
    });
  });

  // ==================== 4. SUPABASE + TEAM COLLABORATION ====================
  function loadLocalState() {
    try { gateState = JSON.parse(localStorage.getItem(LS_GATES) || '{}'); } catch { gateState = {}; }
    try { actionState = JSON.parse(localStorage.getItem(LS_ACTIONS) || '{}'); } catch { actionState = {}; }
    try { notesState = JSON.parse(localStorage.getItem(LS_NOTES) || '[]'); } catch { notesState = []; }
  }

  function saveLocalState() {
    localStorage.setItem(LS_GATES, JSON.stringify(gateState));
    localStorage.setItem(LS_ACTIONS, JSON.stringify(actionState));
    localStorage.setItem(LS_NOTES, JSON.stringify(notesState));
  }

  async function initSupabase() {
    loadLocalState();
    if (!window.supabase || !hubData.platform.supabaseUrl || !hubData.platform.supabaseAnonKey) return;
    sbClient = window.supabase.createClient(hubData.platform.supabaseUrl, hubData.platform.supabaseAnonKey);

    const { data: { session } } = await sbClient.auth.getSession();
    await handleAuthChange(session?.user || null);

    sbClient.auth.onAuthStateChange(async (_event, session) => {
      await handleAuthChange(session?.user || null);
    });
  }

  async function handleAuthChange(user) {
    currentUser = user;
    const dot = document.getElementById('authDot');
    const lbl = document.getElementById('authBtnLabel');
    const pill = document.getElementById('syncStatusPill');
    const signedBox = document.getElementById('authSignedInBox');
    const form = document.getElementById('authForm');

    if (user) {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
      lbl.textContent = user.email.split('@')[0] + ' · 雲端同步';
      signedBox.classList.remove('hidden');
      form.classList.add('hidden');
      document.getElementById('signedInEmail').textContent = user.email;
      await pullFromSupabase();
    } else {
      supabaseReady = false;
      dot.className = 'w-2 h-2 rounded-full bg-amber-400';
      lbl.textContent = '本機模式・登入同步';
      pill.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span><span>目前為本機暫存模式（登入後同步至 Supabase）</span>';
      signedBox.classList.add('hidden');
      form.classList.remove('hidden');
      loadLocalState();
      renderCollabAll();
    }
  }

  async function pullFromSupabase() {
    const pill = document.getElementById('syncStatusPill');
    if (!sbClient || !currentUser) return;
    try {
      const [gRes, aRes, nRes] = await Promise.all([
        sbClient.from('mg_gate_decisions').select('*').eq('tender_slug', 'ncyu-lantan-pcm'),
        sbClient.from('mg_action_items').select('*').eq('tender_slug', 'ncyu-lantan-pcm'),
        sbClient.from('mg_team_notes').select('*').eq('tender_slug', 'ncyu-lantan-pcm').order('created_at', { ascending: false })
      ]);

      if (gRes.error || aRes.error || nRes.error) {
        supabaseReady = false;
        pill.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span><span>已登入，但資料表尚未建立（請執行 supabase/schema.sql，目前降級本機暫存）</span>';
        renderCollabAll();
        return;
      }

      supabaseReady = true;
      pill.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span><span class="text-emerald-700">Supabase PostgreSQL + RLS 雲端同步連線中</span>';

      gateState = {};
      (gRes.data || []).forEach(r => { gateState[r.gate_key] = r; });
      actionState = {};
      (aRes.data || []).forEach(r => { actionState[r.action_key] = r; });
      notesState = nRes.data || [];
      renderCollabAll();
    } catch (e) {
      supabaseReady = false;
      renderCollabAll();
    }
  }

  function renderGates() {
    const el = document.getElementById('gatesGrid');
    if (!el) return;
    const statusStyles = {
      pending: 'border-slate-300 bg-slate-50',
      go: 'border-emerald-400 bg-emerald-50/40',
      conditional: 'border-amber-400 bg-amber-50/40',
      nogo: 'border-red-400 bg-red-50/40'
    };

    el.innerHTML = hubData.gates.map(g => {
      const st = gateState[g.key] || { status: g.defaultStatus, owner_name: '', evidence_note: '' };
      return `
        <div class="rounded-xl border-2 p-4 flex flex-col justify-between gap-3 ${statusStyles[st.status] || statusStyles.pending}">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-navy">${g.number} · ${g.title}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">${g.citation}</span>
            </div>
            <p class="text-xs text-slate-700 leading-relaxed">${g.requirement}</p>
            <div class="text-[11px] text-red-700 bg-red-50 border-l-2 border-red-500 p-2 rounded-r">
              <strong>未過後果：</strong>${g.consequence}
            </div>
          </div>

          <div class="space-y-2 pt-2 border-t border-slate-200/80">
            <div class="grid grid-cols-2 gap-2">
              <select data-gate-status="${g.key}" class="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white">
                <option value="pending" ${st.status === 'pending' ? 'selected' : ''}>⏳ 待查核</option>
                <option value="go" ${st.status === 'go' ? 'selected' : ''}>✅ 通過 (Go)</option>
                <option value="conditional" ${st.status === 'conditional' ? 'selected' : ''}>⚠️ 有條件通過</option>
                <option value="nogo" ${st.status === 'nogo' ? 'selected' : ''}>🛑 未過 (No-Go)</option>
              </select>
              <input data-gate-owner="${g.key}" type="text" value="${(st.owner_name || '').replace(/"/g, '&quot;')}" placeholder="查核負責人" class="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white">
            </div>
            <textarea data-gate-note="${g.key}" rows="2" placeholder="填寫查核佐證或高層裁示..." class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white">${st.evidence_note || ''}</textarea>
            <button data-save-gate="${g.key}" class="w-full py-1.5 rounded-lg bg-navy hover:bg-royal text-white text-xs font-extrabold transition">儲存閘門決議</button>
          </div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('[data-save-gate]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.saveGate;
        const payload = {
          tender_slug: 'ncyu-lantan-pcm',
          gate_key: key,
          status: el.querySelector(`[data-gate-status="${key}"]`).value,
          owner_name: el.querySelector(`[data-gate-owner="${key}"]`).value.trim(),
          evidence_note: el.querySelector(`[data-gate-note="${key}"]`).value.trim(),
          updated_by: currentUser?.id || null
        };
        gateState[key] = payload;
        saveLocalState();
        if (supabaseReady && sbClient && currentUser) {
          await sbClient.from('mg_gate_decisions').upsert(payload, { onConflict: 'tender_slug,gate_key' });
        }
        renderGates();
      });
    });
  }

  function renderActions() {
    const el = document.getElementById('actionsList');
    if (!el) return;
    let doneCount = 0;
    hubData.actions.forEach(a => { if (actionState[a.key]?.completed) doneCount++; });
    const pct = Math.round((doneCount / hubData.actions.length) * 100);
    document.getElementById('actionProgressChip').textContent = `${doneCount}/${hubData.actions.length}`;
    document.getElementById('actionProgressPct').textContent = `${pct}% (${doneCount}/${hubData.actions.length})`;
    document.getElementById('actionProgressBar').style.width = `${pct}%`;

    el.innerHTML = hubData.actions.map(a => {
      const st = actionState[a.key] || { completed: false, assignee: '' };
      const pColor = a.priority === 'P0' ? 'bg-red-100 text-red-700' : a.priority === 'P1' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-royal';
      return `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border ${st.completed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200'}">
          <label class="flex items-start gap-3 cursor-pointer flex-1">
            <input type="checkbox" data-act-check="${a.key}" ${st.completed ? 'checked' : ''} class="mt-1 w-4 h-4 rounded accent-navy">
            <div class="space-y-0.5">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-black ${pColor}">${a.priority}</span>
                <span class="text-[11px] font-bold text-slate-500">${a.phase}</span>
              </div>
              <div class="text-xs sm:text-sm font-medium ${st.completed ? 'line-through text-slate-400' : 'text-slate-800'}">${a.text}</div>
            </div>
          </label>
          <div class="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
            <input type="text" data-act-owner="${a.key}" value="${(st.assignee || '').replace(/"/g, '&quot;')}" placeholder="負責人" class="w-24 px-2 py-1 rounded border border-slate-300 text-xs bg-white">
            <a href="decks/ncyu-lantan-pcm-dd.html#slide-${a.slide}" class="px-2.5 py-1 rounded bg-slate-100 hover:bg-navy hover:text-white text-slate-700 text-[11px] font-bold transition">第 ${a.slide} 頁</a>
          </div>
        </div>
      `;
    }).join('');

    async function persistAction(key) {
      const completed = el.querySelector(`[data-act-check="${key}"]`).checked;
      const assignee = el.querySelector(`[data-act-owner="${key}"]`).value.trim();
      const payload = { tender_slug: 'ncyu-lantan-pcm', action_key: key, completed, assignee, updated_by: currentUser?.id || null };
      actionState[key] = payload;
      saveLocalState();
      if (supabaseReady && sbClient && currentUser) {
        await sbClient.from('mg_action_items').upsert(payload, { onConflict: 'tender_slug,action_key' });
      }
      renderActions();
    }

    el.querySelectorAll('[data-act-check]').forEach(cb => cb.addEventListener('change', () => persistAction(cb.dataset.actCheck)));
    el.querySelectorAll('[data-act-owner]').forEach(inp => inp.addEventListener('change', () => persistAction(inp.dataset.actOwner)));
  }

  function renderNotes() {
    const el = document.getElementById('notesList');
    const cnt = document.getElementById('notesCount');
    if (!el) return;
    cnt.textContent = `${notesState.length} 筆紀錄`;
    if (!notesState.length) {
      el.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">尚無團隊紀錄。可在左側新增釋疑草稿、現勘照片備忘或競爭對手追蹤情報。</div>';
      return;
    }
    el.innerHTML = notesState.map((n, idx) => `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-navy text-sky-300 text-[10px] font-bold">${n.category}</span>
            ${n.slide_no ? `<a href="decks/ncyu-lantan-pcm-dd.html#slide-${n.slide_no}" class="text-[11px] font-bold text-royal hover:underline">關聯第 ${n.slide_no} 頁</a>` : ''}
            <span class="text-[11px] text-slate-400">${n.author_name || '團隊成員'} · ${(n.created_at || '').slice(0, 10)}</span>
          </div>
          <button data-del-note="${n.id || idx}" class="text-[11px] text-slate-400 hover:text-red-600 font-bold">刪除</button>
        </div>
        <div class="text-sm font-extrabold text-navy">${n.title}</div>
        <p class="text-xs text-slate-600 leading-relaxed whitespace-pre-line">${n.content}</p>
      </div>
    `).join('');

    el.querySelectorAll('[data-del-note]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const target = btn.dataset.delNote;
        if (supabaseReady && sbClient && currentUser && target.length > 8) {
          await sbClient.from('mg_team_notes').delete().eq('id', target);
          await pullFromSupabase();
        } else {
          notesState = notesState.filter((n, i) => String(n.id || i) !== String(target));
          saveLocalState();
          renderNotes();
        }
      });
    });
  }

  function renderCollabAll() {
    renderGates();
    renderActions();
    renderNotes();
  }

  // Note Form submit
  document.getElementById('noteForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const category = document.getElementById('noteCategory').value;
    const slideRaw = document.getElementById('noteSlideNo').value;
    const slide_no = slideRaw ? parseInt(slideRaw, 10) : null;
    const is_shared = document.getElementById('noteShared').checked;
    if (!title || !content) return;

    if (supabaseReady && sbClient && currentUser) {
      await sbClient.from('mg_team_notes').insert([{
        user_id: currentUser.id,
        author_name: currentUser.email.split('@')[0],
        tender_slug: 'ncyu-lantan-pcm',
        category, slide_no, title, content, is_shared
      }]);
      await pullFromSupabase();
    } else {
      notesState.unshift({
        id: 'local_' + Date.now(),
        created_at: new Date().toISOString(),
        author_name: currentUser ? currentUser.email.split('@')[0] : '本機使用者',
        category, slide_no, title, content, is_shared
      });
      saveLocalState();
      renderNotes();
    }
    e.target.reset();
  });

  // Collab Tabs
  document.querySelectorAll('.collab-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.collab-tab').forEach(t => {
        t.className = 'collab-tab px-4 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-navy whitespace-nowrap';
      });
      tab.className = 'collab-tab px-4 py-2.5 text-sm font-extrabold border-b-2 border-navy text-navy whitespace-nowrap';
      document.querySelectorAll('.collab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById('tab-' + tab.dataset.tab)?.classList.remove('hidden');
    });
  });

  // Auth Modal Logic
  const authModal = document.getElementById('authModal');
  const authMsg = document.getElementById('authMsg');
  document.getElementById('authStatusBtn')?.addEventListener('click', () => authModal.classList.remove('hidden'));
  document.getElementById('closeAuthModalBtn')?.addEventListener('click', () => authModal.classList.add('hidden'));
  authModal?.addEventListener('click', e => { if (e.target === authModal) authModal.classList.add('hidden'); });

  document.getElementById('authForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!sbClient) return;
    authMsg.classList.add('hidden');
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const { error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) {
      authMsg.textContent = '登入失敗：' + error.message;
      authMsg.classList.remove('hidden');
    } else {
      authModal.classList.add('hidden');
    }
  });

  document.getElementById('btnSignUp')?.addEventListener('click', async () => {
    if (!sbClient) return;
    authMsg.classList.add('hidden');
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    if (!email || password.length < 6) {
      authMsg.textContent = '請輸入有效 Email 與至少 6 碼密碼。';
      authMsg.classList.remove('hidden');
      return;
    }
    const { error } = await sbClient.auth.signUp({ email, password });
    if (error) {
      authMsg.textContent = '註冊失敗：' + error.message;
      authMsg.classList.remove('hidden');
    } else {
      authMsg.className = 'text-xs text-emerald-700';
      authMsg.textContent = '註冊請求已送出！請至信箱確認驗證信後登入。';
      authMsg.classList.remove('hidden');
    }
  });

  document.getElementById('btnSignOut')?.addEventListener('click', async () => {
    await sbClient?.auth.signOut();
    authModal.classList.add('hidden');
  });

  // Boot all modules
  renderKPIs();
  renderMeetings('all');
  renderQuickSlides();
  initMap();
  await initSupabase();
  renderCollabAll();
})();
