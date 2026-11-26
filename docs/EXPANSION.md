# 平台擴充作業指南 (Expansion SOP)

本平台採用 **資料驅動、零構建（Zero-Build）純前端架構**，所有首頁卡片、會議簡報連結、地理點位與全域關鍵字搜尋索引皆由 `data/` 目錄下的 JSON 檔案驅動，便於團隊每次新增會議或新大學微電網標案時快速擴充。

---

## 一、新增一次會議簡報（例如 M02 現勘會議、M03 評選簡報）

1. **建立簡報網頁檔**：
   - 複製 `decks/ncyu-lantan-pcm-dd.html` 作為模板，另存為 `decks/<slug>.html`（例如 `decks/ncyu-site-survey-m02.html`）。
   - 套用 16:9 麥肯錫無雜訊版型（Action Title 結論句 ＋ 證據區原創 SVG ＋ 三段式備忘稿 `data-notes`）。
2. **更新首頁會議目錄 (`data/hub.json`)**：
   - 在 `meetings` 陣列中將對應卡片的 `"status"` 由 `"planned"` 改為 `"ready"`，填入 `"url": "decks/<slug>.html"`、`"date"`、`"slideCount"`、`"svgCount"`，或直接新增一筆新會議物件。
3. **更新全域檢索索引 (`data/search-index.json`)**：
   - 為新簡報的每一頁新增一筆索引物件（包含 `id`, `type: "slide"`, `meetingId`, `slideNo`, `title`, `url: "decks/<slug>.html#slide-N"`, `keywords[]`, `snippet`）。
   - 完成後，首頁頂部搜尋欄與 `Ctrl+K` 即自動納入全文檢索並支援精準跳頁。

---

## 二、新增一所大學標案與設備地圖點位

1. **於 `data/hub.json` 的 `tenders` 陣列新增標案基本資料**（含 `slug`, `code`, `university`, `campus`, `verdict`, `pcmBudget`, `epcBudget`）。
2. **於 `data/hub.json` 的 `mapData.campuses` 更新或新增學校經緯度座標**，將 `"status"` 改為 `"active"`。
3. **如需標註該校詳細設備點位**：比照 `ncyuEquipment` 與 `ncyuRoutes` 格式擴充該校區設備經緯度與高壓路徑陣列，於 `assets/js/portal.js` 註冊校區切換器即可。

---

## 三、Supabase 雲端資料庫安全與維運規範

- **嚴格遵循純前端安全守則**：前端僅允許使用公開 `anon key`（存於 `data/hub.json`），**絕對禁止**將 `service_role key` 提交至 Git 倉庫。
- **啟用雲端同步**：於 Supabase Dashboard → SQL Editor 執行 `supabase/schema.sql`，即可建立 `mg_gate_decisions`、`mg_action_items`、`mg_team_notes` 三張資料表與完整 Row Level Security (RLS) 策略。
- **零門檻使用**：未登入或尚未執行建表 SQL 前，平台會自動優雅降級為瀏覽器本機暫存（`localStorage`）；登入團隊帳號後自動啟用雲端同步。
