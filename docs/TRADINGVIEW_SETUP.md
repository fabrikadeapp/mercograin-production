# TradingView Webhook Setup Guide

## Overview

MercoGrain integrates with TradingView alerts to receive real-time commodity price updates:
- Automatic webhook notifications on price changes
- Support for three commodities (Soja/ZS, Milho/ZC, Trigo/ZW)
- Rate limiting (100 requests/min per symbol)
- Idempotency (5-minute window to prevent duplicates)
- Full audit logging

## Prerequisites

- TradingView account (free or premium)
- Access to TradingView Alerts feature
- Public URL for webhook endpoint (HTTPS)
- Domain/IP whitelisting (if required)

## Step 1: Create TradingView Alerts

### 1.1 Access TradingView Platform

1. Login to https://www.tradingview.com
2. Search for symbol: **CBOT:ZS** (Soja/Soybeans)
3. On the chart, click **Alerts** (bell icon)

### 1.2 Create First Alert (Soja - ZS)

**Settings:**
- Symbol: `CBOT:ZS`
- Condition: `Price crosses above/below [value]`
- Example: `Price crosses above 560`

**Notification:**
- Click "Webhook URL" checkbox
- Enter URL: `https://seu-dominio.com/api/webhooks/tradingview`
- Headers: Add custom header
  ```
  x-tradingview-secret: your-webhook-secret
  ```
- Payload (JSON):
  ```json
  {
    "ticker": "{{ticker}}",
    "price": {{close}},
    "timestamp": {{timenow}},
    "signal": "buy",
    "volume": {{volume}},
    "strength": 75,
    "description": "Sinal de compra detectado em {{ticker}}"
  }
  ```

**Save Alert**

### 1.3 Create Second Alert (Milho - ZC)

Repeat above with:
- Symbol: `CBOT:ZC`
- Same webhook URL and secret
- Change ticker in payload to: `{{ticker}}`

### 1.4 Create Third Alert (Trigo - ZW)

Repeat above with:
- Symbol: `CBOT:ZW`
- Same webhook URL and secret
- Change ticker in payload to: `{{ticker}}`

## Step 2: Configure Environment Variables

Add to `.env.local` or `.env.production`:

```env
# TradingView Webhook Secret
# Use the same secret you configured in TradingView
TRADINGVIEW_WEBHOOK_SECRET=your-webhook-secret-here

# Webhook URL (for reference, must be publicly accessible)
TRADINGVIEW_WEBHOOK_URL=https://seu-dominio.com/api/webhooks/tradingview
```

## Step 3: Validate Webhook Configuration

### 3.1 Test Webhook Delivery

**From TradingView Dashboard:**

1. Go to Alerts → Your Created Alert
2. Click "Test" button
3. Check server logs for incoming webhook:
   ```bash
   npm run dev 2>&1 | grep -i tradingview
   ```

**Expected Output:**
```
[TradingView] ✅ Cotação salva: soja - 565.50 (USD/BRL: 5.10)
```

### 3.2 Manual Webhook Test

```bash
# Test webhook with curl
curl -X POST https://seu-dominio.com/api/webhooks/tradingview \
  -H "Content-Type: application/json" \
  -H "x-tradingview-secret: your-webhook-secret" \
  -d '{
    "ticker": "CBOT:ZS",
    "price": 565.50,
    "timestamp": '$(date +%s)',
    "signal": "buy",
    "volume": 150000,
    "strength": 75,
    "description": "Test alert"
  }'
```

**Expected Response (201):**
```json
{
  "ok": true,
  "cotacao": {
    "id": "...",
    "grao": "soja",
    "preco": "565.50",
    "dolarReal": "5.10",
    "timestamp": "2026-05-01T10:00:00Z"
  },
  "metadata": {
    "signal": "buy",
    "rateLimitRemaining": 99,
    "rateLimitReset": 60000
  }
}
```

### 3.3 Verify Data in Database

```bash
# Check recent prices in database
sqlite3 mercograin.db "SELECT grao, preco, fonte, data FROM Cotacao ORDER BY data DESC LIMIT 10;"

# Or via API
curl https://seu-dominio.com/api/cotacoes?grao=soja&limit=5
```

## Step 4: Monitor Webhooks

### 4.1 Check Webhook Logs

**Via Dashboard:**
- Navigate to: Relatórios → Auditoria → Logs de Webhooks
- Filter: Type = "tradingview"
- View: Status, Timestamp, Payload, Response

**Via Database:**
```sql
SELECT tipo, status, mensagem, criado_em
FROM WebhookLog
WHERE tipo = 'tradingview'
ORDER BY criado_em DESC
LIMIT 20;
```

### 4.2 Error Scenarios

| Error | Cause | Solution |
|---|---|---|
| **401 Unauthorized** | Invalid webhook secret | Verify `TRADINGVIEW_WEBHOOK_SECRET` matches |
| **400 Invalid JSON** | Malformed payload | Check payload structure in alert |
| **400 Unknown Symbol** | Unrecognized ticker | Use: ZS (Soja), ZC (Milho), ZW (Trigo) |
| **429 Rate Limit** | >100 req/min per symbol | TradingView limits alert frequency |
| **409 Duplicate** | Same ticker+timestamp | Normal behavior, webhook deduped |

## Symbols Supported

| Code | Commodity | Payload |
|---|---|---|
| **ZS** or **CBOT:ZS** | Soja (Soybeans) | `"ticker": "CBOT:ZS"` |
| **ZC** or **CBOT:ZC** | Milho (Corn) | `"ticker": "CBOT:ZC"` |
| **ZW** or **CBOT:ZW** | Trigo (Wheat) | `"ticker": "CBOT:ZW"` |

## Payload Structure

```json
{
  "ticker": "CBOT:ZS",           // Symbol (required)
  "price": 565.50,                // Price in USD (required)
  "timestamp": 1704067200,         // Unix timestamp (required)
  "signal": "buy",                 // buy/sell/neutral (optional)
  "volume": 150000,                // Trading volume (optional)
  "strength": 75,                  // 0-100 (optional)
  "description": "Alert message"   // Free text (optional)
}
```

## API Endpoints

### Receive Webhook (POST)

**`POST /api/webhooks/tradingview`**

- **Headers:** `x-tradingview-secret: your-secret`
- **Body:** JSON payload (see structure above)
- **Response:** 201 Created on success

### View Prices

**`GET /api/cotacoes?grao=soja&limit=20`**

Returns recent prices filtered by commodity.

### View Webhook Logs

**`GET /api/webhooks/logs?type=tradingview&limit=50`**

Returns webhook delivery history and errors.

## Security Considerations

✅ **Implemented:**
- Webhook secret validation (Header: `x-tradingview-secret`)
- Rate limiting (100 req/min per symbol)
- Idempotency (5-minute deduplication)
- Input validation (Zod schemas)
- Full audit logging
- IP logging for all webhooks

⚠️ **Recommendations:**
- Use strong webhook secret (>20 random characters)
- Change secret regularly (quarterly)
- Monitor webhook logs for suspicious patterns
- Alert on rate limit exceeded (potential attack)
- Whitelist TradingView IPs if possible

## Troubleshooting

### Webhooks Not Arriving

1. **Verify webhook secret matches:**
   ```bash
   echo $TRADINGVIEW_WEBHOOK_SECRET
   ```

2. **Check TradingView alert is active:**
   - Dashboard → Alerts → Find alert
   - Status should be "Active" (green)

3. **Test alert manually:**
   - TradingView: Alerts → Click "Test" button
   - Check server logs: `npm run dev 2>&1 | grep tradingview`

4. **Verify webhook URL is public:**
   ```bash
   curl -I https://seu-dominio.com/api/webhooks/tradingview
   ```
   Should return 200 OK (or 401 with no secret header)

5. **Check firewall rules:**
   - Ensure HTTPS port 443 is open
   - Allow TradingView IP ranges (if using firewall)

### Wrong Prices Being Received

1. **Verify symbol mapping:**
   ```
   CBOT:ZS → soja ✓
   CBOT:ZC → milho ✓
   CBOT:ZW → trigo ✓
   ```

2. **Check payload ticker format:**
   - Should be: `"ticker": "CBOT:ZS"` (with CBOT: prefix)
   - Not: `"ticker": "ZS"` (will still work but less clear)

3. **Verify timestamp is correct:**
   - Use `{{timenow}}` in TradingView alert
   - Should be Unix timestamp in milliseconds

### Rate Limiting Issues

- TradingView alerts limited to ~1/minute minimum frequency
- System allows 100 alerts/minute per symbol (generous buffer)
- If alerts arrive too fast, some will be dedupped (409)

## Testing Checklist

- [ ] Three alerts created (ZS, ZC, ZW)
- [ ] Webhook URL added to all alerts
- [ ] Secret header configured
- [ ] Test alert delivery works (green checkmark in TradingView)
- [ ] Webhook secret matches `.env` configuration
- [ ] Server logs show successful webhook receipt
- [ ] Prices appear in database
- [ ] Prices visible in `/api/cotacoes` endpoint
- [ ] Dashboard shows latest prices
- [ ] Webhook logs page has entries
- [ ] No errors in webhook log

## Production Deployment

### Pre-Deployment Checklist

- [ ] TRADINGVIEW_WEBHOOK_SECRET set in `.env.production`
- [ ] HTTPS certificate valid and trusted
- [ ] Webhook URL publicly accessible
- [ ] Server logs monitoring enabled
- [ ] Database backups configured
- [ ] Webhook logs retention policy set (30+ days)
- [ ] Alert on webhook failures configured
- [ ] Team notified of webhook setup

### Monitoring & Alerts

**Set up monitoring for:**
- Webhook failures (HTTP != 2xx)
- Missing prices (no ZS/ZC/ZW for >5 minutes)
- Rate limit exceeded (potential attack)
- Database errors

**Example monitoring query:**
```sql
SELECT
  grao,
  MAX(data) as last_update,
  DATETIME('now') - MAX(data) as minutes_ago
FROM Cotacao
GROUP BY grao;
```

## Support & References

**TradingView:**
- Docs: https://www.tradingview.com/pine-script-docs/
- Alerts: https://www.tradingview.com/alerts/
- Support: https://www.tradingview.com/support/

**MercoGrain:**
- Webhook Handler: `app/api/webhooks/tradingview/route.ts`
- Tests: `__tests__/tradingview-integration.test.ts`
- Logs: Dashboard → Relatórios → Auditoria

## FAQ

**Q: Can I change alert frequency?**
A: Yes, in TradingView alert settings. Minimum is ~1 per minute.

**Q: What if webhook fails to deliver?**
A: TradingView retries for 24 hours. Check server logs and webhook logs page.

**Q: Do I need Premium TradingView?**
A: No, webhooks work with free accounts.

**Q: Can I receive multiple symbols in one alert?**
A: No, create separate alerts for each symbol.

**Q: Is there a delay between alert trigger and webhook?**
A: <1 second typically. TradingView claims <2 seconds in docs.

---

**Last Updated:** 2026-05-01
**Status:** Ready for Setup ✅
**Test Environment:** https://tradingview.com/alerts
