# YOLO Investing.com API Integration - Decision Log

**Date:** 2026-05-01
**Task:** Investing.com API Integration for Live Commodity Prices
**Mode:** YOLO (Autonomous, 0-1 prompts, max decisions logged)

## Decisions Made

### 1. **Integration Strategy**
- Extend existing `lib/investing-client.ts` with grain price functions
- Use web scraping via Cheerio (already in dependencies)
- Cache prices in Redis (1-hour TTL)
- Store in database for historical tracking

Decision: Leverage existing infrastructure instead of building new API client

### 2. **Data Sources**
- Investing.com URLs for commodity prices:
  - Soja: `/commodities/us-soybeans`
  - Milho: `/commodities/us-corn`
  - Trigo: `/commodities/us-wheat`
- Already has: USD/BRL exchange rate, gold, oil prices

### 3. **Caching Strategy**
- Redis cache: 1 hour (conflicts with TradingView webhooks)
- Database storage: All prices + timestamps for analytics
- Prevents excessive scraping and API rate limits

### 4. **Synchronization**
- Manual sync via POST `/api/cotacoes/sync`
- Optional bearer token authentication
- Lock mechanism to prevent parallel syncs
- Atomic operations per grain type

### 5. **API Endpoints**
- **GET /api/cotacoes/live** - Get live prices (cached or fetch)
  - Optional `?grain=soja|milho|trigo|taxa-cambio`
- **POST /api/cotacoes/sync** - Trigger manual price sync
  - Bearer token auth (optional, via env)
  - Returns success/failure per grain

## Implementation Details

### Files Created

1. **lib/investing-client.ts** (Extended)
   - `getSoybeanPrice()` - Get soja price from Investing.com
   - `getCornPrice()` - Get milho price
   - `getWheatPrice()` - Get trigo price
   - `getGrainPrices()` - Get all prices in parallel

2. **lib/price-sync-service.ts** (250 lines)
   - `syncPrices()` - Main sync function with lock + error handling
   - `getLatestPrices()` - Query latest from database
   - Result structure with per-grain tracking

3. **app/api/cotacoes/live/route.ts** (50 lines)
   - GET endpoint for live prices
   - Optional grain filter parameter
   - Timestamp and source metadata

4. **app/api/cotacoes/sync/route.ts** (80 lines)
   - POST for manual sync trigger
   - GET for documentation
   - Optional Bearer token auth
   - Usage examples included

## Architecture

```
Investing.com (web scraping)
         ↓
lib/investing-client.ts (cheerio parsing + Redis caching)
         ↓
lib/price-sync-service.ts (database storage)
         ↓
Database (Cotacao + TaxaCambio tables)
         ↓
API Endpoints (GET /live, POST /sync)
         ↓
Frontend (Dashboard, Propostas)
```

## Testing Checklist
- [x] `npm run type-check` passes ✅ (no TS errors)
- [x] `npm run build` passes ✅ (0 errors)
- [ ] Manual test: GET /api/cotacoes/live (should return cached values)
- [ ] Manual test: POST /api/cotacoes/sync (should store in DB)
- [ ] Manual test: Verify prices in database (Cotacao table)
- [ ] Manual test: Check Redis cache TTL

## Security Considerations
✅ Optional bearer token for sync endpoint
✅ Rate limit scraping via Redis cache + lock
✅ No API keys exposed in logs
✅ Timeout on axios requests (10 seconds)

## Integration with Existing Systems

### Dashboard
- Can display live prices from `/api/cotacoes/live`
- Show latest prices from database
- Historical price charts

### Propostas
- Use latest prices for grain calculations
- Show "updated at" timestamp for transparency
- Allow manual refresh via sync endpoint

### TradingView Webhooks
- No conflict: different symbols (ZS/ZC/ZW vs websocket prices)
- Can coexist for price validation

## Future Enhancements
- [ ] Automated hourly sync via cron job
- [ ] Comparison with TradingView prices
- [ ] Price alerts when thresholds reached
- [ ] Historical price trends API
- [ ] Alternative data sources fallback
- [ ] Better error handling + alerting

## Environment Variables
```env
# Optional: Protect sync endpoint
PRICE_SYNC_TOKEN=seu-token-secreto

# Used by email service (already configured)
NEXTAUTH_URL=http://localhost:3000
EMAIL_FROM=seu-email@gmail.com
EMAIL_PASSWORD=sua-senha
```

## Database Usage
- Inserts into `Cotacao` table on each sync
- Inserts into `TaxaCambio` table for exchange rates
- Historical data preserved (can query by date)
- No deletions (append-only pattern)

---
