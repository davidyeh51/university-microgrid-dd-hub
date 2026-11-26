(function () {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const total = slides.length;
  let current = 0;

  const viewport = document.getElementById('slideViewport');
  const stageWrap = document.getElementById('stageWrap');
  const counterEl = document.getElementById('slideCounter');
  const progressEl = document.getElementById('progressFill');
  const notesDrawer = document.getElementById('notesDrawer');
  const notesBtn = document.getElementById('btnNotes');
  const nConclusion = document.getElementById('noteConclusion');
  const nDetail = document.getElementById('noteDetail');
  const nTransition = document.getElementById('noteTransition');
  const nPace = document.getElementById('notePace');

  const ovModal = document.getElementById('overviewModal');
  const ovGrid = document.getElementById('overviewGrid');
  const searchModal = document.getElementById('deckSearchModal');
  const searchInput = document.getElementById('deckSearchInput');
  const searchResults = document.getElementById('deckSearchResults');

  function fitViewport() {
    if (!viewport || !stageWrap) return;
    const rect = stageWrap.getBoundingClientRect();
    const pad = 28;
    const scaleX = (rect.width - pad) / 1280;
    const scaleY = (rect.height - pad) / 720;
    const scale = Math.max(0.25, Math.min(scaleX, scaleY, 1.35));
    viewport.style.transform = `scale(${scale})`;
  }

  function showSlide(idx, updateHash = true) {
    current = Math.max(0, Math.min(total - 1, idx));
    slides.forEach((s, i) => s.classList.toggle('active', i === current));
    if (counterEl) counterEl.textContent = `${String(current + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    if (progressEl) progressEl.style.width = `${((current + 1) / total) * 100}%`;

    const activeSlide = slides[current];
    if (activeSlide && nConclusion) {
      nConclusion.textContent = activeSlide.dataset.conclusion || '';
      nDetail.textContent = activeSlide.dataset.detail || '';
      nTransition.textContent = activeSlide.dataset.transition || '';
      nPace.textContent = activeSlide.dataset.pace || '建議講解：35–40 秒';
    }

    if (updateHash) {
      history.replaceState(null, '', `#slide-${current + 1}`);
    }
    buildOverview();
  }

  function parseHash() {
    const m = window.location.hash.match(/slide-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10) - 1;
      if (!isNaN(n) && n >= 0 && n < total) return n;
    }
    return 0;
  }

  function buildOverview() {
    if (!ovGrid) return;
    ovGrid.innerHTML = '';
    slides.forEach((s, i) => {
      const title = s.dataset.title || s.querySelector('.action-title')?.textContent?.trim() || `第 ${i + 1} 頁`;
      const section = s.dataset.section || '';
      const arch = s.dataset.archetype || '';
      const card = document.createElement('div');
      card.className = 'ov-card' + (i === current ? ' current' : '');
      card.innerHTML = `<div class="ov-num">SLIDE ${String(i + 1).padStart(2, '0')} · ${section}</div>
        <div class="ov-title">${title}</div>
        <div class="ov-meta">${arch}</div>`;
      card.addEventListener('click', () => {
        showSlide(i);
        ovModal.classList.remove('open');
      });
      ovGrid.appendChild(card);
    });
  }

  function runDeckSearch(query) {
    if (!searchResults) return;
    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const hits = [];
    slides.forEach((s, i) => {
      const text = (s.textContent + ' ' + (s.dataset.conclusion || '') + ' ' + (s.dataset.detail || '')).replace(/\s+/g, ' ');
      const lower = text.toLowerCase();
      if (!tokens.length || tokens.every(t => lower.includes(t))) {
        hits.push({ idx: i, title: s.dataset.title || `第 ${i + 1} 頁`, section: s.dataset.section || '', text });
      }
    });

    if (!hits.length) {
      searchResults.innerHTML = '<p style="color:#64748B;font-size:13px;">查無相符投影片內容，請嘗試其他關鍵字。</p>';
      return;
    }

    searchResults.innerHTML = hits.map(h => {
      let snippet = h.text.slice(0, 150);
      if (tokens.length) {
        const pos = h.text.toLowerCase().indexOf(tokens[0]);
        if (pos > 30) snippet = '…' + h.text.slice(pos - 30, pos + 120) + '…';
        tokens.forEach(t => {
          const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          snippet = snippet.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
        });
      }
      return `<div class="search-hit" data-slide="${h.idx}">
        <div style="font-size:11px;font-weight:700;color:#1E3A8A;">SLIDE ${String(h.idx + 1).padStart(2, '0')} · ${h.section}</div>
        <div style="font-size:13.5px;font-weight:700;color:#051C2C;margin:2px 0;">${h.title}</div>
        <div style="font-size:12px;color:#475569;line-height:1.45;">${snippet}</div>
      </div>`;
    }).join('');

    searchResults.querySelectorAll('.search-hit').forEach(el => {
      el.addEventListener('click', () => {
        showSlide(parseInt(el.dataset.slide, 10));
        searchModal.classList.remove('open');
      });
    });
  }

  // 10-Minute Countdown Timer
  let secondsLeft = 600;
  let timerHandle = null;
  const timerEl = document.getElementById('timerPill');
  function renderTimer() {
    if (!timerEl) return;
    const neg = secondsLeft < 0;
    const abs = Math.abs(secondsLeft);
    const m = String(Math.floor(abs / 60)).padStart(2, '0');
    const s = String(abs % 60).padStart(2, '0');
    timerEl.textContent = (timerHandle ? '⏱ ' : '▶ ') + (neg ? '-' : '') + `${m}:${s}`;
    timerEl.classList.toggle('warning', secondsLeft <= 120 && secondsLeft >= 0);
    timerEl.classList.toggle('overtime', secondsLeft < 0);
  }
  function toggleTimer() {
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    } else {
      timerHandle = setInterval(() => { secondsLeft--; renderTimer(); }, 1000);
    }
    renderTimer();
  }
  if (timerEl) {
    timerEl.addEventListener('click', toggleTimer);
    timerEl.addEventListener('dblclick', () => {
      clearInterval(timerHandle);
      timerHandle = null;
      secondsLeft = 600;
      renderTimer();
    });
    renderTimer();
  }

  // Buttons
  document.getElementById('btnPrev')?.addEventListener('click', () => showSlide(current - 1));
  document.getElementById('btnNext')?.addEventListener('click', () => showSlide(current + 1));
  notesBtn?.addEventListener('click', () => {
    notesDrawer.classList.toggle('open');
    notesBtn.classList.toggle('active');
    setTimeout(fitViewport, 50);
  });
  document.getElementById('btnOverview')?.addEventListener('click', () => {
    buildOverview();
    ovModal.classList.add('open');
  });
  document.getElementById('btnSearch')?.addEventListener('click', () => {
    searchModal.classList.add('open');
    searchInput.focus();
    runDeckSearch(searchInput.value);
  });
  document.getElementById('btnFullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-backdrop').classList.remove('open'));
  });
  [ovModal, searchModal].forEach(m => {
    m?.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });
  searchInput?.addEventListener('input', e => runDeckSearch(e.target.value));

  // Interactive Mode Switcher on Slide 7 (Single-Line Diagram)
  const modeBtns = document.querySelectorAll('[data-sld-mode]');
  const modeCaption = document.getElementById('sldModeCaption');
  const sldCaptions = {
    grid: '【平時併網模式】電號一與電號二各自受電（PCC 常閉）；跨電號聯絡開關恆開路；BESS 執行削峰填谷（≧347 kW）與光電平滑，年省超約附加費 ≧51.2 萬元。',
    island: '【48h 孤島運轉模式】台電停電 → 電號一 PCC 開路解聯（≦200 ms）→ BESS 500 kW 構網黑啟動建立 11.4 kV V/F（≦500 ms）→ 優先保供行政中心、嘉禾館、瑞穗館 4,691 人；SOC ≦30% 時啟動柴油機。',
    s6: '【擴大維生 S6 模式（選用）】確認兩電號 PCC 皆開路且孤島電力有餘裕後，由現場人員持雙鑰匙就地人工閉合「跨電號聯絡開關」，反向經推廣中心變電站加供畜牧場 24 小時動物維生負載（EMS 不得遠端閉合）。'
  };
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.sldMode;
      modeBtns.forEach(b => b.classList.toggle('active', b === btn));
      const svg = document.getElementById('sldSvg');
      if (svg) svg.setAttribute('data-mode', m);
      if (modeCaption) modeCaption.textContent = sldCaptions[m] || '';
    });
  });

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (document.activeElement === searchInput) {
      if (e.key === 'Escape') searchModal.classList.remove('open');
      return;
    }
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); showSlide(current + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); showSlide(current - 1); }
    else if (e.key === 'n' || e.key === 'N') { notesBtn?.click(); }
    else if (e.key === 'g' || e.key === 'G') { ovModal.classList.toggle('open'); }
    else if (e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) { e.preventDefault(); searchModal.classList.add('open'); searchInput.focus(); runDeckSearch(searchInput.value); }
    else if (e.key === 'Escape') { ovModal.classList.remove('open'); searchModal.classList.remove('open'); }
    else if (e.key === 't' || e.key === 'T') { toggleTimer(); }
    else if (e.key === 'Home') { showSlide(0); }
    else if (e.key === 'End') { showSlide(total - 1); }
  });

  window.addEventListener('resize', fitViewport);
  window.addEventListener('hashchange', () => showSlide(parseHash(), false));

  showSlide(parseHash(), false);
  fitViewport();
})();
