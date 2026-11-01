# Daraja API Setup Location in HirePath

## Overview

The Daraja API (Safaricom M-Pesa STK Push) integration is implemented in the **Supabase Edge Functions** (backend) and connected to the frontend payment components.

---

## Backend Implementation (Supabase Edge Functions)

### Core Daraja Configuration

**Location:** `/supabase/functions/_shared/daraja.ts`

This is the main Daraja helper module containing:

1. **Base URL Configuration**
   ```typescript
   export const DARAJA = 'https://sandbox.safaricom.co.ke';
   ```
   - Currently set to **sandbox mode**
   - For production, change to: `https://api.safaricom.co.ke`

2. **OAuth Token Management**
   - `accessToken()` - Gets and caches OAuth token (~1 hour validity)
   - Uses `MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET` from Supabase secrets

3. **Timestamp Generation**
   - `timestampEat()` - Generates Africa/Nairobi (EAT = UTC+3) timestamp
   - Format: `YYYYMMDDHHmmss`
   - No daylight saving time (fixed +3 offset)

4. **STK Password Generation**
   - `stkPassword()` - Creates base64 password
   - Formula: `base64(BusinessShortCode + Passkey + Timestamp)`

---

## Edge Functions Using Daraja

### 1. STK Push (Initiate Payment)
**Location:** `/supabase/functions/stk-push/index.ts`

**What it does:**
- Initiates M-Pesa payment prompt on customer's phone
- Validates phone number format (`2547XXXXXXXX`)
- Creates pending payment record in database

**Required Supabase Secrets:**
- `MPESA_CONSUMER_KEY` - Daraja API consumer key
- `MPESA_CONSUMER_SECRET` - Daraja API consumer secret
- `MPESA_SHORTCODE` - Your Paybill/Till number (sandbox: `174379`)
- `MPESA_PASSKEY` - Your STK Push passkey
- `MPESA_PRICE` - Payment amount (default: 1 KES)

**Process:**
1. User submits phone number
2. Function generates timestamp and password
3. Calls Daraja STK Push API
4. Stores payment record with `checkout_request_id`
5. Returns payment status to frontend

---

### 2. M-Pesa Callback
**Location:** `/supabase/functions/mpesa-callback/index.ts`

**What it does:**
- Receives payment result from Safaricom
- Updates payment status in database
- Activates Pro subscription on successful payment

**Key features:**
- **Public endpoint** (no JWT required - Safaricom calls it)
- Idempotent (handles duplicate callbacks)
- Parses `CallbackMetadata` for success cases
- Handles failure codes (user cancel, timeout, insufficient funds)

**Payment status flow:**
- `pending` → `completed` (on success)
- `pending` → `failed` (on failure)
- `pending` → `cancelled` (user cancelled)

---

### 3. STK Query (Status Check)
**Location:** `/supabase/functions/stk-query/index.ts`

**What it does:**
- Fallback status check when callback doesn't arrive
- Queries Daraja API directly with `CheckoutRequestID`
- Updates payment status based on query result

**When used:**
- Client-side watchdog timer (~90 seconds)
- If callback fails to arrive
- Manual status reconciliation

---

### 4. M-Pesa Renewals (Subscription Expiry)
**Location:** `/supabase/functions/mpesa-renewals/index.ts`

**What it does:**
- Scheduled nightly (2 AM via pg_cron)
- Reverts expired Pro subscriptions to Free tier
- Checks `billing_period_end < now()`

**Note:** This doesn't involve Daraja API directly - it's database cleanup

---

## Frontend Implementation

### 1. M-Pesa Payment Modal
**Location:** `/src/features/payments/components/MpesaModal.vue`

**What it does:**
- Phone number input form
- Validates format (254...)
- Calls `stk-push` edge function
- Shows payment status (pending/success/failed)

---

### 2. Paywall View
**Location:** `/src/features/subscription/views/PaywallView.vue`

**What it does:**
- Displays Pro plan benefits
- Opens M-Pesa modal for payment
- Triggers subscription upgrade flow

---

### 3. Payments View
**Location:** `/src/features/payments/views/PaymentsView.vue`

**What it does:**
- Lists payment history
- Shows M-Pesa receipt numbers
- Generates PDF payment reports

---

## Environment Configuration

### Supabase Edge Function Secrets

Set these via Supabase CLI or dashboard:

```bash
# Daraja API Credentials (from developer.safaricom.co.ke)
supabase secrets set MPESA_CONSUMER_KEY=your_consumer_key
supabase secrets set MPESA_CONSUMER_SECRET=your_consumer_secret

# Business Configuration
supabase secrets set MPESA_SHORTCODE=174379  # Sandbox shortcode
supabase secrets set MPESA_PASSKEY=your_passkey

# Payment Amount (in KES)
supabase secrets set MPESA_PRICE=1  # 1 KES for testing, change for production
```

**Where to get credentials:**
1. Go to: https://developer.safaricom.co.ke
2. Create an app
3. Get Consumer Key and Consumer Secret
4. Get Passkey from the app credentials

---

## Database Tables

### `payments` table
Stores all M-Pesa transactions:
- `checkout_request_id` - Daraja's checkout ID (unique)
- `merchant_request_id` - Daraja's merchant request ID
- `mpesa_receipt_number` - M-Pesa confirmation code (on success)
- `phone` - Customer phone number
- `amount` - Payment amount
- `status` - `pending`, `completed`, `failed`, `cancelled`
- `result_code` - Daraja result code (0 = success)
- `result_desc` - Human-readable result

### `subscriptions` table
Manages user subscription tiers:
- `tier` - `free` or `pro`
- `billing_period_end` - When Pro expires
- Updated by `mpesa-callback` on successful payment

---

## Payment Flow Diagram

```
1. User clicks "Upgrade to Pro"
   ↓
2. Opens MpesaModal (enters phone number)
   ↓
3. Frontend calls stk-push Edge Function
   ↓
4. Edge Function:
   - Gets OAuth token (cached)
   - Generates timestamp + password
   - Calls Daraja STK Push API
   - Creates payment record (status: pending)
   ↓
5. Safaricom sends STK prompt to user's phone
   ↓
6. User enters M-Pesa PIN (or cancels/timeout)
   ↓
7. Safaricom calls mpesa-callback Edge Function
   ↓
8. Callback Function:
   - Updates payment status
   - On success: Activates Pro subscription
   - Responds HTTP 200 to Safaricom
   ↓
9. Frontend (via Realtime subscription):
   - Detects payment status change
   - Shows success/failure message
   - Refreshes subscription tier
   ↓
10. Fallback: If no callback after 90s
    - Frontend calls stk-query Edge Function
    - Manually checks status with Daraja
```

---

## Switching from Sandbox to Production

### 1. Change Base URL
**File:** `/supabase/functions/_shared/daraja.ts`
```typescript
// Change from:
export const DARAJA = 'https://sandbox.safaricom.co.ke';

// To:
export const DARAJA = 'https://api.safaricom.co.ke';
```

### 2. Update Secrets
```bash
# Production credentials from your Safaricom business account
supabase secrets set MPESA_CONSUMER_KEY=prod_consumer_key
supabase secrets set MPESA_CONSUMER_SECRET=prod_consumer_secret
supabase secrets set MPESA_SHORTCODE=your_actual_paybill
supabase secrets set MPESA_PASSKEY=prod_passkey
supabase secrets set MPESA_PRICE=100  # Real price (e.g., 100 KES)
```

### 3. Whitelist Callback URL with Safaricom
- Your callback URL: `https://vdrdistisykdigqilnpc.supabase.co/functions/v1/mpesa-callback`
- Must be HTTPS
- Must be publicly reachable
- Register with Safaricom support if required

### 4. Test Thoroughly
- Successful payment
- User cancellation
- Timeout scenario
- Insufficient funds
- Callback retries

---

## Common Issues & Troubleshooting

### Issue: "daraja_token_failed"
**Cause:** Invalid consumer key/secret
**Fix:** Verify credentials in Supabase secrets

### Issue: "daraja_push_failed"
**Cause:** Invalid shortcode, passkey, or phone format
**Fix:** Check MPESA_SHORTCODE, MPESA_PASSKEY, and phone format (2547XXXXXXXX)

### Issue: Callback never arrives
**Cause:** Network issues or Safaricom delays
**Solution:** The app has a 90-second watchdog that calls `stk-query` as fallback

### Issue: Payment marked complete but subscription not activated
**Cause:** `mpesa-callback` function error
**Fix:** Check Supabase function logs for errors in subscription activation

---

## Testing in Sandbox

**Sandbox Shortcode:** `174379`
**Test Phone Numbers:** Available in Daraja portal after app creation

**Test Scenarios:**
1. Successful payment (enter PIN when prompted)
2. User cancellation (cancel the STK prompt)
3. Timeout (ignore the prompt for 60+ seconds)
4. Invalid phone number (test validation)

---

## Documentation Files

- **Complete API Reference:** `/docs/daraja-api-stk-push-documentation.md`
- **Backend Setup Guide:** `/docs/backend-setup.md`

---

## Quick Commands

```bash
# View Supabase secrets
supabase secrets list

# Set a secret
supabase secrets set SECRET_NAME=value

# View function logs
supabase functions logs stk-push
supabase functions logs mpesa-callback

# Deploy functions
supabase functions deploy stk-push
supabase functions deploy mpesa-callback
supabase functions deploy stk-query
supabase functions deploy mpesa-renewals
```

---

## Current Status

✅ **Sandbox mode active**
✅ STK Push implemented
✅ Callback handler working
✅ Fallback query implemented
✅ Subscription activation on payment
✅ Payment history tracking
✅ Automatic expiry handling

⚠️ **Before going live:**
- [ ] Switch to production Daraja URL
- [ ] Update to production credentials
- [ ] Set real pricing (MPESA_PRICE)
- [ ] Whitelist callback URL with Safaricom
- [ ] Test all payment scenarios in production
- [ ] Set up payment reconciliation monitoring
