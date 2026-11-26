-- ============================================================================
-- 大學微電網標案盡職調查暨決策簡報平台
-- (University Microgrid Tender Due Diligence & Briefing Hub)
-- Supabase PostgreSQL Schema & Row Level Security (RLS)
-- 安全原則：前端僅使用公開 anon key，嚴禁洩露 service_role key
-- 請於 Supabase Dashboard -> SQL Editor 貼上並執行本腳本
-- ============================================================================

-- 1. Go / No-Go 閘門查核決議表 (mg_gate_decisions)
CREATE TABLE IF NOT EXISTS public.mg_gate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tender_slug TEXT NOT NULL DEFAULT 'ncyu-lantan-pcm',
  gate_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'go', 'conditional', 'nogo')),
  owner_name TEXT NOT NULL DEFAULT '',
  evidence_note TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (tender_slug, gate_key)
);

CREATE INDEX IF NOT EXISTS idx_mg_gate_decisions_tender
  ON public.mg_gate_decisions (tender_slug);

ALTER TABLE public.mg_gate_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mg_gates_select_auth" ON public.mg_gate_decisions;
CREATE POLICY "mg_gates_select_auth"
  ON public.mg_gate_decisions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mg_gates_insert_auth" ON public.mg_gate_decisions;
CREATE POLICY "mg_gates_insert_auth"
  ON public.mg_gate_decisions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "mg_gates_update_auth" ON public.mg_gate_decisions;
CREATE POLICY "mg_gates_update_auth"
  ON public.mg_gate_decisions
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);


-- 2. 搶標行動清單進度表 (mg_action_items)
CREATE TABLE IF NOT EXISTS public.mg_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tender_slug TEXT NOT NULL DEFAULT 'ncyu-lantan-pcm',
  action_key TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  assignee TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (tender_slug, action_key)
);

CREATE INDEX IF NOT EXISTS idx_mg_action_items_tender
  ON public.mg_action_items (tender_slug);

ALTER TABLE public.mg_action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mg_actions_select_auth" ON public.mg_action_items;
CREATE POLICY "mg_actions_select_auth"
  ON public.mg_action_items
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mg_actions_insert_auth" ON public.mg_action_items;
CREATE POLICY "mg_actions_insert_auth"
  ON public.mg_action_items
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "mg_actions_update_auth" ON public.mg_action_items;
CREATE POLICY "mg_actions_update_auth"
  ON public.mg_action_items
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);


-- 3. 團隊盡調筆記、釋疑與現勘紀錄表 (mg_team_notes)
CREATE TABLE IF NOT EXISTS public.mg_team_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT '團隊成員',
  tender_slug TEXT NOT NULL DEFAULT 'ncyu-lantan-pcm',
  slide_no INTEGER,
  category TEXT NOT NULL DEFAULT '盡調筆記'
    CHECK (category IN ('盡調筆記', '標案釋疑', '現勘紀錄', '競爭情報', '會議決議')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_mg_team_notes_tender_created
  ON public.mg_team_notes (tender_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mg_team_notes_user_id
  ON public.mg_team_notes (user_id);

ALTER TABLE public.mg_team_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mg_notes_select_shared_or_own" ON public.mg_team_notes;
CREATE POLICY "mg_notes_select_shared_or_own"
  ON public.mg_team_notes
  FOR SELECT
  TO authenticated
  USING (is_shared = true OR (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "mg_notes_insert_own" ON public.mg_team_notes;
CREATE POLICY "mg_notes_insert_own"
  ON public.mg_team_notes
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "mg_notes_update_own" ON public.mg_team_notes;
CREATE POLICY "mg_notes_update_own"
  ON public.mg_team_notes
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "mg_notes_delete_own" ON public.mg_team_notes;
CREATE POLICY "mg_notes_delete_own"
  ON public.mg_team_notes
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);


-- 4. 自動更新 updated_at 觸發器
CREATE OR REPLACE FUNCTION public.mg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mg_gate_decisions_updated_at ON public.mg_gate_decisions;
CREATE TRIGGER trg_mg_gate_decisions_updated_at
  BEFORE UPDATE ON public.mg_gate_decisions
  FOR EACH ROW EXECUTE FUNCTION public.mg_set_updated_at();

DROP TRIGGER IF EXISTS trg_mg_action_items_updated_at ON public.mg_action_items;
CREATE TRIGGER trg_mg_action_items_updated_at
  BEFORE UPDATE ON public.mg_action_items
  FOR EACH ROW EXECUTE FUNCTION public.mg_set_updated_at();

DROP TRIGGER IF EXISTS trg_mg_team_notes_updated_at ON public.mg_team_notes;
CREATE TRIGGER trg_mg_team_notes_updated_at
  BEFORE UPDATE ON public.mg_team_notes
  FOR EACH ROW EXECUTE FUNCTION public.mg_set_updated_at();
