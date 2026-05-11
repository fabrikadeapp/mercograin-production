-- Workspace.dashboardSymbols — lista de IDs de commodities visíveis no widget
-- "Real Time Commodity Futures Prices" do dashboard. null = usa default global.

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "dashboardSymbols" JSONB;
