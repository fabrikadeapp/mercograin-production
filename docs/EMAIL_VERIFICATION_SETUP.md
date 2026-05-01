# Email Verification Setup Guide

## Overview

MercoGrain includes a complete email verification system that:
- Sends verification emails on signup
- Supports resend of verification emails with rate limiting
- Validates email tokens with expiry (24 hours)
- Provides user-friendly feedback pages

## Prerequisites

- Node.js 18+
- SMTP server (Gmail, SendGrid, custom)
- Email credentials configured in `.env`

## Configuration

### Step 1: Set Environment Variables

Add to your `.env.local` or `.env`:

```env
# Email Configuration
EMAIL_FROM=your-email@example.com
EMAIL_PASSWORD=your-app-password

# Email Provider (optional, defaults to Gmail)
EMAIL_PROVIDER=gmail

# Optional: Custom SMTP
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-password

# NextAuth URL (required for email verification links)
NEXTAUTH_URL=http://localhost:3000
```

### Step 2: Choose Email Provider

#### Option A: Gmail (Recommended for Development)

1. Enable 2-Step Verification on your Google Account
2. Generate an [App Password](https://myaccount.google.com/apppasswords)
3. Use the App Password as `EMAIL_PASSWORD`

```env
EMAIL_FROM=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

#### Option B: SendGrid

1. Create account at [SendGrid](https://sendgrid.com)
2. Create an API Key
3. Install SendGrid: `npm install @sendgrid/mail`
4. Update `/lib/email-service.ts`:

```typescript
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export async function sendEmail(options: EmailOptions) {
  await sgMail.send({
    to: options.to,
    from: process.env.EMAIL_FROM!,
    subject: options.subject,
    html: options.html,
    text: options.text,
  })
}
```

#### Option C: Custom SMTP

```env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=user@example.com
EMAIL_PASS=password
```

Update `/lib/email-service.ts`:

```typescript
transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})
```

## Email Verification Flow

### 1. User Signup

1. User fills signup form with valid password (min 8 chars, mixed case, numbers, special chars)
2. Frontend validates password strength
3. API creates user with `emailVerificado: false`
4. Verification email is sent automatically
5. User redirected to `/auth/verify-email-pending?email=...`

### 2. Email Verification

1. User receives email with verification link
2. Link contains single-use token (expires in 24 hours)
3. User clicks link → verification page validates token
4. Token is marked as used (deleted from DB)
5. User account marked as verified
6. User can now login

### 3. Resend Verification

**Rate Limiting:** 3 attempts per hour per email

1. User navigates to `/auth/resend-verification`
2. Enters email address
3. API validates email exists and unverified
4. Generates new token and sends email
5. Success message shown with option to check spam

## API Endpoints

### POST /api/auth/signup

Create new user account and send verification email.

**Request:**
```json
{
  "nome": "João Silva",
  "email": "joao@example.com",
  "senha": "SecurePass123!"
}
```

**Response (201):**
```json
{
  "message": "Conta criada! Verifique seu email para ativar.",
  "user": {
    "id": "...",
    "email": "joao@example.com",
    "nome": "João Silva"
  }
}
```

**Response (400):**
```json
{
  "error": "Senha não atende aos critérios de segurança",
  "feedback": [
    "Deve conter letras maiúsculas",
    "Deve conter caracteres especiais"
  ]
}
```

### GET /api/auth/verify-email?token=xxx

Verify email token and activate account.

**Response (200):**
```json
{
  "message": "Email verificado com sucesso! Você pode fazer login.",
  "redirect": "/auth/login"
}
```

**Response (400):**
```json
{
  "error": "Token de verificação inválido ou expirado"
}
```

### POST /api/auth/verify-email

Resend verification email (rate limited: 3/hour).

**Request:**
```json
{
  "email": "joao@example.com"
}
```

**Response (200):**
```json
{
  "message": "Email de verificação enviado com sucesso."
}
```

**Response (429):**
```json
{
  "error": "Muitas tentativas. Tente novamente em 1234 segundo(s).",
  "remainingAttempts": 0,
  "resetIn": 1234
}
```

## Password Strength Requirements

Passwords must meet these criteria:

- ✅ Minimum 8 characters
- ✅ At least one uppercase letter (A-Z)
- ✅ At least one lowercase letter (a-z)
- ✅ At least one number (0-9)
- ✅ At least one special character (!@#$%^&*)

**Score:**
- 0-1: Weak ❌
- 2: Fair ⚠️
- 3: Good ✅
- 4: Strong ✅
- 5: Very Strong ✅✅

Valid passwords:
- `SecurePass123!`
- `MyP@ssw0rd`
- `Tr0pic@lFruit!`

Invalid passwords:
- `password123` (no uppercase, no special char)
- `PASSWORD123!` (no lowercase)
- `SecurePass!` (no number)
- `Pass1!` (too short)

## Testing

### Unit Tests

```bash
npm test __tests__/email-verification.test.ts
```

Tests cover:
- Password strength validation
- Token generation and verification
- Rate limiting
- Signup validation
- Email templates

### Integration Tests (Manual)

1. **Test Signup:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"nome":"Test","email":"test@example.com","senha":"SecurePass123!"}'
   ```

2. **Check Email:**
   - Look for verification email (may be in spam)
   - Copy the verification URL from email

3. **Test Verification:**
   ```bash
   curl -X GET "http://localhost:3000/api/auth/verify-email?token=xxx"
   ```

4. **Test Resend:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/verify-email \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

## Troubleshooting

### Emails Not Sending

1. Check `.env` variables:
   ```bash
   echo $EMAIL_FROM
   echo $EMAIL_PASSWORD
   ```

2. Enable "Less secure app access" (Gmail only):
   - Visit https://myaccount.google.com/lesssecureapps

3. Check logs for SMTP errors:
   ```bash
   npm run dev 2>&1 | grep -i email
   ```

### Emails Going to Spam

1. Add your email to SPF/DKIM/DMARC records
2. Use authenticated SMTP server
3. Test with professional email (not free providers)

### Token Expiry Issues

- Tokens expire after 24 hours
- Stored as hashed values (one-way encryption)
- Automatically cleaned up after expiry

### Rate Limiting Not Working

Rate limiting is in-memory (not persistent across server restarts).

For production, use Redis:

```bash
npm install redis
```

## Security Considerations

✅ **Implemented:**
- Tokens are hashed (bcrypt) before storage
- Email addresses are not revealed when resending
- Rate limiting on resend (3 attempts/hour)
- Tokens expire after 24 hours
- CSRF protection via NextAuth
- Password strength validation
- Input sanitization

⚠️ **Notes:**
- Emails are sent in plain text via SMTP
- Consider TLS/SSL for production
- Monitor email logs for abuse patterns
- Implement honeypot fields to catch bots

## Production Checklist

- [ ] Configure SMTP with TLS/SSL
- [ ] Set strong `EMAIL_PASSWORD` (use app-specific password)
- [ ] Enable DKIM/SPF records for domain
- [ ] Monitor email delivery logs
- [ ] Set up bounce/complaint handling
- [ ] Use Redis for distributed rate limiting
- [ ] Enable 2FA for email account
- [ ] Regular backups of user database
- [ ] GDPR compliance (right to be forgotten)
- [ ] Unsubscribe handling

## Next Steps

1. Configure email provider credentials
2. Test signup flow with real email
3. Verify emails are received (check spam folder)
4. Deploy to staging and test end-to-end
5. Enable DKIM/SPF for production domain

## Support

For issues or questions:
1. Check logs: `npm run dev`
2. Review `.env` configuration
3. Test SMTP manually: `npm run test:email`
4. Contact support team

---

**Last Updated:** 2024
**Status:** Production Ready ✅
