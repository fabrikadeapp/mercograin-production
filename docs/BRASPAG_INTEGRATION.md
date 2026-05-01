# Braspag Integration Guide

## Overview

MercoGrain integrates with Braspag API to create and manage boletos (Brazilian bank payment slips). This guide covers:
- Account setup and credentialing
- API configuration
- Production deployment
- Webhook handling
- Testing and troubleshooting

## Prerequisites

- Braspag account (https://www.braspag.com.br)
- Merchant registration on Braspag Portal
- Banking information (bank, account, agency)
- Public IP or DNS for webhook callbacks

## Step 1: Create Braspag Account

1. Visit https://www.braspag.com.br
2. Click "Criar Conta" (Create Account)
3. Fill in company information:
   - Legal Name (Razão Social)
   - CNPJ
   - Contact details
4. Complete email verification
5. Set up 2FA (recommended)
6. Access Braspag Dashboard

## Step 2: Get Merchant Credentials

1. Login to Braspag Dashboard
2. Navigate to: **Settings → API Credentials**
3. Copy the following values:

   ```
   Merchant ID:   [COPY THIS]
   Merchant Key:  [COPY THIS]
   Webhook Secret: [CREATE AND COPY THIS]
   ```

4. **Important:** Keep these secret! Never commit to Git.

## Step 3: Configure Banking Information

In Braspag Dashboard:

1. **Settings → Bank Account**
2. Add your bank account:
   - Bank: `Caixa` / `Itaú` / `Bradesco` / `Santander` / `BB`
   - Agency (Agência): e.g., `0001`
   - Account (Conta): e.g., `1234567`
   - Account Type (Tipo): Checking Account
   - Account Name (Nome do Titular)

3. Note these values for `.env` configuration

## Step 4: Set Environment Variables

Add to `.env.local` or `.env.production`:

```env
# Braspag Credentials
BRASPAG_MERCHANT_ID=your-merchant-id-here
BRASPAG_MERCHANT_KEY=your-merchant-key-here
BRASPAG_WEBHOOK_SECRET=your-webhook-secret-here

# Braspag Bank Account (Your receiving account)
BRASPAG_BENEFICIARY_AGENCY=0001
BRASPAG_BENEFICIARY_ACCOUNT=1234567
BRASPAG_BENEFICIARY_NAME=MercoGrain LTDA

# API Base URL
BRASPAG_API_URL=https://api.braspag.com.br

# Webhook URL (must be publicly accessible)
BRASPAG_WEBHOOK_URL=https://seu-dominio.com/api/webhooks/braspag
```

## Step 5: Configure Webhook in Braspag

1. Braspag Dashboard → **Settings → Webhooks**
2. Click "Add Webhook"
3. Enter webhook URL:
   ```
   https://seu-dominio.com/api/webhooks/braspag
   ```
4. Select events:
   - ✅ Payment Status Changed
   - ✅ Boleto Status Changed
   - ✅ Boleto Paid
   - ✅ Boleto Expired

5. Set Authentication Header:
   ```
   Header Name: x-braspag-secret
   Header Value: [your-webhook-secret]
   ```

6. Save and test webhook (should receive 200 OK response)

## API Endpoints

### Create Boleto

**POST** `/api/boletos`

```json
{
  "clienteId": "client-uuid",
  "numero": "000000001",
  "banco": "caixa",
  "valor": 1500.50,
  "vencimento": "2026-06-15"
}
```

**Response (201):**
```json
{
  "id": "boleto-uuid",
  "numero": "000000001",
  "valor": 1500.50,
  "vencimento": "2026-06-15",
  "status": "aberto",
  "linkBoleto": "https://boleto.braspag.com.br/...",
  "braspagId": "payment-id-from-braspag",
  "criadoEm": "2026-05-01T10:00:00Z"
}
```

### Get Boleto Status

**GET** `/api/boletos/:id`

```json
{
  "id": "boleto-uuid",
  "numero": "000000001",
  "status": "pago",
  "paidDate": "2026-06-10T14:30:00Z",
  "paidAmount": 1500.50
}
```

### Refresh Boleto Status

**POST** `/api/boletos/:id/refresh-status`

Manually query Braspag API for latest status.

### Webhook Handler

**POST** `/api/webhooks/braspag`

Receives payment notifications from Braspag and updates boleto status automatically.

## Status Mapping

| Braspag Status | MercoGrain Status | Meaning |
|---|---|---|
| 0 | aberto | Open/Pending |
| 1 | pago | Paid |
| 2 | cancelado | Cancelled |
| 3 | rejeitado | Rejected |
| 10 | aberto | Open (alternative) |
| 12 | vencido | Expired/Overdue |

## Bank Codes

| Bank | Code |
|---|---|
| Banco do Brasil | 001 |
| Caixa Econômica | 104 |
| Bradesco | 237 |
| Itaú | 341 |
| Santander | 033 |

## Implementation Details

### Retry Logic

API requests include automatic retry with exponential backoff:
- Max retries: 3
- Delays: 1s, 2s, 4s
- Used for network glitches and temporary failures

### Error Handling

```
Braspag API Error → Log error → Return fallback response
→ User can try again or admin can refresh status manually
```

### Security

✅ **Implemented:**
- Webhook secret validation (Header: `x-braspag-secret`)
- HTTPS enforcement
- Input validation (Zod schemas)
- Payment ID verification before updates
- Sensitive data logging excluded

## Testing

### Test Sandbox

Braspag provides a sandbox environment:

1. Dashboard → **Settings → Environments**
2. Switch to "Sandbox"
3. Use sandbox credentials for testing
4. Test data (will always succeed):
   - Any valid CNPJ/CPF
   - Any future date
   - Any amount

### Manual Testing

```bash
# Create test boleto
curl -X POST http://localhost:3000/api/boletos \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "test-client-id",
    "numero": "000000001",
    "banco": "caixa",
    "valor": 100.00,
    "vencimento": "2026-06-30"
  }'

# Check status
curl http://localhost:3000/api/boletos/{boleto-id}

# Refresh status from Braspag
curl -X POST http://localhost:3000/api/boletos/{boleto-id}/refresh-status
```

### Test Webhook

```bash
# Send test webhook
curl -X POST http://localhost:3000/api/webhooks/braspag \
  -H "Content-Type: application/json" \
  -H "x-braspag-secret: your-webhook-secret" \
  -d '{
    "Id": "123456789",
    "MerchantOrderId": "000000001",
    "Payment": {
      "PaymentId": "payment-uuid",
      "Status": 1,
      "BoletoNumber": "123.456 00000 00000 00000 00000 00000 0 00000000000000",
      "BarCodeNumber": "12345600000000000000000000000000000000000000",
      "PaidDate": "2026-05-01T14:30:00Z"
    }
  }'
```

## Deployment Checklist

- [ ] Braspag account created
- [ ] Merchant credentials obtained
- [ ] Bank account registered
- [ ] Environment variables configured in production
- [ ] Webhook secret set and stored securely
- [ ] Webhook URL registered in Braspag
- [ ] HTTPS certificate valid
- [ ] Firewall allows Braspag IPs (Braspag will provide)
- [ ] Email notifications configured
- [ ] Logging and monitoring enabled
- [ ] Test boleto creation end-to-end
- [ ] Test webhook delivery and processing
- [ ] Load testing with peak volume
- [ ] Disaster recovery plan documented

## Production Best Practices

### PCI Compliance
- ✅ Use Braspag hosted forms (don't capture card data directly)
- ✅ Store only Braspag payment IDs (never card numbers)
- ✅ Use HTTPS only
- ✅ Implement IP whitelisting

### Monitoring
```bash
# Monitor webhook logs
tail -f /var/log/mercograin/webhooks.log

# Check Braspag health
curl https://api.braspag.com.br/v2/sales -H "Authorization: Bearer $MERCHANT_KEY"
```

### Alerts
Set up monitoring for:
- Webhook failures (response != 200)
- API errors (status != 2xx)
- Unusually high failed transaction rate
- Boleto payment delays

### Backup Strategy
- Daily database backups (includes boleto records)
- Archive completed transactions monthly
- Keep 2 years of payment history

## Troubleshooting

### Webhook Not Triggering

1. Check webhook URL is publicly accessible:
   ```bash
   curl -I https://seu-dominio.com/api/webhooks/braspag
   ```

2. Verify secret header:
   ```bash
   curl -X POST https://seu-dominio.com/api/webhooks/braspag \
     -H "x-braspag-secret: your-secret"
   ```

3. Check Braspag Dashboard → Webhook Logs for delivery status

4. Verify firewall allows Braspag IPs (check Braspag docs)

### Boleto Not Created

1. Verify credentials in `.env`:
   ```bash
   echo "Merchant ID: $BRASPAG_MERCHANT_ID"
   echo "API URL: $BRASPAG_API_URL"
   ```

2. Check API logs for error message

3. Ensure beneficiary bank account is configured

4. Try with sandbox credentials first

### Payment Status Not Updated

1. Check webhook secret matches
2. Review webhook logs in Braspag Dashboard
3. Check database `webhookLog` table for errors
4. Manually refresh status:
   ```bash
   curl -X POST /api/boletos/{id}/refresh-status
   ```

### API Rate Limit Exceeded

- Braspag limits: 100 requests/minute
- Implement request queuing for bulk operations
- Contact Braspag support for higher limits

## Support

**Braspag Support:**
- Email: suporte@braspag.com.br
- Phone: +55 11 4000-8000
- Portal: https://central.braspag.com.br

**MercoGrain Support:**
- Check logs: `npm run dev 2>&1 | grep -i braspag`
- Review integration tests
- Contact development team

## References

- [Braspag API Documentation](https://braspag.com.br/docs)
- [Boleto API Reference](https://braspag.com.br/docs/pagador/webhooks)
- [Payment Status Codes](https://braspag.com.br/docs/pagador/status-codes)
- [Webhook Signatures](https://braspag.com.br/docs/pagador/webhooks/validacao)

---

**Last Updated:** 2026-05-01
**Status:** Production Ready ✅
**Tested with:** Braspag API v2
