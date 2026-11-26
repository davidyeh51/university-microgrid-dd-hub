# 大學微電網標案盡職調查暨決策簡報平台

> 對象：**自己、團隊成員（進能服／進金生能源）** ｜ 架構：**麥肯錫 10 分鐘結構化簡報 ✕ 原創重繪 SVG 圖解 ✕ 地理設備衛星圖台 ✕ 全域關鍵字檢索 ✕ 可擴充會議架構 ✕ Supabase BaaS**

🌐 **線上網址 (GitHub Pages)**：https://davidyeh51.github.io/university-microgrid-dd-hub/

---

## 核心特色

1. **可持續擴充之多標案／多會議門戶 (`index.html`)**：
   - 完全由 `data/hub.json` 與 `data/search-index.json` 驅動，首期上線 **M01｜國立嘉義大學蘭潭校區微電網 PCM 標案盡職調查報告（案號 115Q0803-1）**，並預留 M02（現勘與台電會勘）、M03（12 分鐘評選簡報與答詢）、M04（跨校微電網比較）等擴充插槽（詳見 [docs/EXPANSION.md](docs/EXPANSION.md)）。
2. **全域關鍵字即時檢索 (`Ctrl+K`)**：
   - 支援跨會議簡報頁碼與地圖設備點位多關鍵字即時過濾、熱門概念快選與關鍵字高亮，點擊直接跳轉至對應簡報指定頁碼（`#slide-N`）或飛往地圖指定設備彈窗。
3. **麥肯錫 10 分鐘完整簡報 ✕ 12 張原創重繪 SVG (`decks/ncyu-lantan-pcm-dd.html`)**：
   - 嚴格依循森秀明「無雜訊簡報 8 大論法版型」與麥肯錫深度藍金視覺規範，共 16 頁 16:9 互動簡報。
   - 全面重繪招標文件與盡調報告關鍵圖表（校區空間配置與 10 座變電站、可切換三態之 AC Hybrid 系統單線圖、總變電站 240 m² 儲能柴油消防退縮圖、48h 能量平衡與柴油 25% 低負載盲點圖、全黑啟動 vs. ≦100 ms 準無縫雙軌時序圖、IEC 62443 SL2 四層資安架構、8 階段雙軌甘特圖、BCG 2×2 風險矩陣與 4 階段搶標路線圖）。
   - 內建三段式講者備忘稿抽屜（按 `N` 展開）、10 分鐘演練計時器（按 `T`）、投影片總覽（按 `G`）與簡報內檢索（按 `/`）。
4. **標案與設備互動地理圖台 (Leaflet ✕ Esri 衛星圖 / OSM)**：
   - 精準定位嘉義大學蘭潭校區 **13 處核心設備／變電站／風險查證點** 並繪製 **5 類高壓與孤島供電路徑**，一鍵切換「全台大學微電網標案 Pipeline 雷達（含中正、中興、中山、中央、彰化師大、南台科大）」。
5. **團隊盡調協作中心 ✕ Supabase BaaS (RLS)**：
   - 支援「三道 Go/No-Go 閘門決議」、「12 項搶標行動清單進度」與「團隊筆記／釋疑／情報共編」。
   - 嚴格遵循純前端安全規範：僅使用公開 `anon key`，後端採用 PostgreSQL **Row Level Security (RLS)** 控管（建表腳本見 [supabase/schema.sql](supabase/schema.sql)），未登入時亦自動提供本機暫存，零障礙使用。

---

## 專案目錄結構

```text
university-microgrid-dd-hub/
├── index.html                           # 平台首頁門戶（檢索＋會議庫＋衛星地圖＋Supabase 協作）
├── decks/
│   └── ncyu-lantan-pcm-dd.html          # M01 嘉義大學蘭潭校區微電網 PCM 盡職調查 16 頁麥肯錫簡報
├── data/
│   ├── hub.json                         # 平台設定、會議目錄、閘門、行動清單與地理圖資
│   └── search-index.json                # 全域關鍵字全文檢索索引
├── assets/
│   ├── css/deck.css                     # 麥肯錫簡報樣式系統
│   └── js/
│       ├── deck.js                      # 簡報引擎（翻頁、備忘稿、計時器、三態單線切換）
│       └── portal.js                    # 首頁門戶引擎（搜尋、Leaflet 地圖、Supabase 同步）
├── supabase/
│   └── schema.sql                       # PostgreSQL 建表、索引、觸發器與 RLS 政策腳本
└── docs/
    └── EXPANSION.md                     # 新增會議簡報與新大學標案標準擴充 SOP
```
