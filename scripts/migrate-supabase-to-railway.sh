#!/usr/bin/env bash
# Migração Supabase Postgres → Railway Postgres.
#
# Requer:
#   SUPABASE_DIRECT_URL   — URL atual (porta 5432 do Supabase)
#   RAILWAY_DIRECT_URL    — URL nova (porta 5432 do Railway)
#
# Uso:
#   export SUPABASE_DIRECT_URL='postgresql://...'  # da env atual DIRECT_URL
#   export RAILWAY_DIRECT_URL='postgresql://...'   # do painel Railway
#   ./scripts/migrate-supabase-to-railway.sh
#
# O script:
#  1) Faz pg_dump do schema 'public' do Supabase
#  2) Restaura no Railway (DROP + CREATE objetos)
#  3) Compara contagem de rows nas tabelas principais
#
# IMPORTANTE: não exclui o Supabase. Mantenha por 1 semana como fallback.

set -euo pipefail

: "${SUPABASE_DIRECT_URL:?Defina SUPABASE_DIRECT_URL}"
: "${RAILWAY_DIRECT_URL:?Defina RAILWAY_DIRECT_URL}"

DUMP_FILE="/tmp/mercograin-$(date +%Y%m%d-%H%M%S).sql"

echo "==> 1. Dumping Supabase schema 'public' to $DUMP_FILE"
pg_dump "$SUPABASE_DIRECT_URL" \
  --schema=public \
  --no-owner --no-acl \
  --clean --if-exists \
  --format=plain \
  --file="$DUMP_FILE"

du -h "$DUMP_FILE"

echo ""
echo "==> 2. Restoring into Railway"
psql "$RAILWAY_DIRECT_URL" -v ON_ERROR_STOP=1 -f "$DUMP_FILE" 2>&1 | tail -20

echo ""
echo "==> 3. Validating row counts (top 10 tables)"
TABLES=$(psql "$SUPABASE_DIRECT_URL" -At -c "
  SELECT relname FROM pg_stat_user_tables
  WHERE schemaname='public'
  ORDER BY n_live_tup DESC
  LIMIT 10;
")

printf "  %-30s %10s %10s\n" "Table" "Supabase" "Railway"
printf "  %-30s %10s %10s\n" "------------------------------" "---------" "---------"
for t in $TABLES; do
  src=$(psql "$SUPABASE_DIRECT_URL" -At -c "SELECT COUNT(*) FROM \"$t\";" 2>/dev/null || echo "?")
  dst=$(psql "$RAILWAY_DIRECT_URL" -At -c "SELECT COUNT(*) FROM \"$t\";" 2>/dev/null || echo "?")
  marker=""
  [ "$src" != "$dst" ] && marker=" ⚠️"
  printf "  %-30s %10s %10s%s\n" "$t" "$src" "$dst" "$marker"
done

echo ""
echo "==> Migração completa!"
echo "    Dump preservado em $DUMP_FILE (apague depois de validar)"
echo ""
echo "Próximos passos:"
echo "  1. Atualizar DATABASE_URL e DIRECT_URL no Railway (web service)"
echo "  2. Redeploy do web (Railway pega automaticamente)"
echo "  3. Validar app por algumas horas"
echo "  4. Após 1 semana: deletar Supabase do projeto"
