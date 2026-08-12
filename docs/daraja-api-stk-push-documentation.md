# Daraja API STK Push Documentation (Lipa Na M-Pesa Online / M-Pesa Express)

**Safaricom M-Pesa Daraja API** – STK Push (also known as Lipa Na M-Pesa Online or M-Pesa Express) allows your application to initiate a payment prompt directly on a customer’s phone. The customer only needs to enter their M-Pesa PIN.

Official portal: [https://developer.safaricom.co.ke](https://developer.safaricom.co.ke)

---

## Environments

| Environment | Base URL |
|-------------|----------|
| Sandbox     | `https://sandbox.safaricom.co.ke` |
| Production  | `https://api.safaricom.co.ke` |

---

## 1. Authentication – Get Access Token

**Endpoint**

```
GET /oauth/v1/generate?grant_type=client_credentials
```

**Headers**

```
Authorization: Basic base64(ConsumerKey:ConsumerSecret)
```

**Response**

```json
{
  "access_token": "your-access-token",
  "expires_in": "3599"
}
```

- Token is valid for approximately 1 hour.
- Cache the token and refresh it before expiry. Do **not** request a new token on every API call.

---

## 2. STK Push Request

**Endpoint**

```
POST /mpesa/stkpush/v1/processrequest
```

**Headers**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Request Body Example

```json
{
  "BusinessShortCode": "174379",
  "Password": "<base64(BusinessShortCode + Passkey + Timestamp)>",
  "Timestamp": "20260216165627",
  "TransactionType": "CustomerPayBillOnline",
  "Amount": 1,
  "PartyA": "254708920430",
  "PartyB": "174379",
  "PhoneNumber": "254708920430",
  "CallBackURL": "https://yourdomain.com/api/mpesa/callback",
  "AccountReference": "Test",
  "TransactionDesc": "Test"
}
```

### Request Parameters

| Parameter            | Description                                      | Type / Notes                                      | Example                  |
|----------------------|--------------------------------------------------|---------------------------------------------------|--------------------------|
| BusinessShortCode    | Organization shortcode (Paybill or Till)         | Numeric                                           | 174379                   |
| Password             | Base64 of Shortcode + Passkey + Timestamp        | String                                            | base64(...)              |
| Timestamp            | Transaction time in `YYYYMMDDHHmmss` (EAT)       | Timestamp – **must match** the one used in Password | 20260216165627         |
| TransactionType      | Type of transaction                              | `CustomerPayBillOnline` or `CustomerBuyGoodsOnline` | CustomerPayBillOnline  |
| Amount               | Amount in KES (whole numbers only)               | Numeric – no decimals                             | 1                        |
| PartyA               | Customer phone number sending funds              | `2547XXXXXXXX` format                             | 254708920430             |
| PartyB               | Receiving shortcode (same as BusinessShortCode)  | Numeric                                           | 174379                   |
| PhoneNumber          | Phone that receives the STK prompt (same as PartyA) | `2547XXXXXXXX`                                  | 254708920430             |
| **CallBackURL**      | HTTPS URL where the result will be sent          | Must be publicly reachable over HTTPS             | https://yourdomain.com/api/mpesa/callback |
| AccountReference     | Reference shown to customer / for reconciliation | Max 12 characters                                 | ORDER-123                |
| TransactionDesc      | Transaction description                          | Max 13 characters                                 | Payment for order        |

### Password Generation

```
Password = Base64(BusinessShortCode + Passkey + Timestamp)
```

- Use the **exact same** Timestamp value in both the Password and the request body.
- Timestamp must be in Africa/Nairobi (EAT) timezone.

### Synchronous Response (Acknowledgement Only)

This response only confirms that the request was accepted. It is **not** the final payment result.

```json
{
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_191220191020363925",
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "CustomerMessage": "Success. Request accepted for processing"
}
```

| Field                 | Description                                      |
|-----------------------|--------------------------------------------------|
| MerchantRequestID     | Unique ID for the payment request                |
| CheckoutRequestID     | Unique ID for the checkout – **store this**      |
| ResponseCode          | `0` = accepted                                   |
| ResponseDescription   | Human-readable status                            |
| CustomerMessage       | Message returned to the customer                 |

> **Important**: Persist `CheckoutRequestID` against your order/transaction immediately. This is the key used to match the later callback.

---

## 3. Callback (Result Notification)

After the customer enters their PIN (or cancels / times out), Safaricom sends a **POST** request to the `CallBackURL` you provided.

### Successful Callback

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_011120241020363925",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 1.00 },
          { "Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV" },
          { "Name": "TransactionDate", "Value": 20241101102115 },
          { "Name": "PhoneNumber", "Value": 254708920430 }
        ]
      }
    }
  }
}
```

### Failed / Cancelled Callback

Failure responses **do not** contain `CallbackMetadata`.

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_191220191020363925",
      "ResultCode": 1032,
      "ResultDesc": "Request canceled by user."
    }
  }
}
```

### Callback Fields

| Field                | Description                                      |
|----------------------|--------------------------------------------------|
| MerchantRequestID    | Matches the original request                     |
| CheckoutRequestID    | Matches the original request – use for lookup    |
| ResultCode           | `0` = success; any other value = failure         |
| ResultDesc           | Human-readable result description                |
| CallbackMetadata     | Present only on success                          |
| → Amount             | Transacted amount                                |
| → MpesaReceiptNumber | M-Pesa confirmation / receipt number             |
| → TransactionDate    | Completion time (`YYYYMMDDHHmmss`)               |
| → PhoneNumber        | Customer phone (may be masked in production)     |

### Critical Callback Handling Rules

1. **Always respond with HTTP 200 quickly**  
   Example response body many developers return:
   ```json
   { "ResultCode": 0, "ResultDesc": "Accepted" }
   ```
   Non-200 responses can trigger retries or delivery problems.

2. **Make the handler idempotent**  
   Safaricom may deliver the same callback more than once. Use `CheckoutRequestID` or `MpesaReceiptNumber` to avoid double-processing.

3. **Never mark an order as paid from the initial STK Push response**  
   Wait for the callback (or a successful status query).

4. **Callback URL requirements**
   - Must be publicly reachable
   - Must use **HTTPS** (HTTP is rejected)
   - No localhost in production
   - Use a tunnel (ngrok, Cloudflare Tunnel, etc.) only for local development

5. **Parse defensively**  
   Failure payloads lack the `CallbackMetadata` key. Always check for its existence.

---

## 4. Common Result Codes

| ResultCode | Meaning                                      |
|------------|----------------------------------------------|
| 0          | Success                                      |
| 1          | Insufficient balance                         |
| 1001       | Unable to lock subscriber (concurrent session) |
| 1019       | Transaction expired                          |
| 1032       | Request cancelled by user                    |
| 1037       | DS timeout / user unreachable                |
| 2001       | Wrong PIN / invalid initiator                |

---

## 5. Query Transaction Status (Fallback)

If no callback arrives within ~90 seconds, poll the status:

**Endpoint**

```
POST /mpesa/stkpushquery/v1/query
```

**Body** (same Shortcode / Password / Timestamp logic + CheckoutRequestID)

```json
{
  "BusinessShortCode": "174379",
  "Password": "<base64...>",
  "Timestamp": "20260216165627",
  "CheckoutRequestID": "ws_CO_191220191020363925"
}
```

Treat the query result as authoritative when a callback is missing.

---

## 6. Sandbox Testing Notes

- Shared shortcode: **174379**
- Passkey is provided in the Daraja portal for your sandbox app
- Use test phone numbers listed in the portal
- Thoroughly test:
  - Successful payment
  - User cancellation
  - Timeout / no response
  - Insufficient funds

---

## 7. Production Checklist

- [ ] Switch base URL from sandbox to production
- [ ] Use real Paybill / Till shortcode and production passkey
- [ ] Ensure callback URL is HTTPS and publicly reachable
- [ ] Whitelist callback URL if required by Safaricom
- [ ] Implement idempotent callback handling
- [ ] Build a reconciler that queries pending transactions
- [ ] Never store or log customer PINs (Daraja never sends them)
- [ ] Use whole numbers only for Amount
- [ ] Phone numbers must be in `2547XXXXXXXX` format

---

## Quick Reference – Full Flow

1. Obtain OAuth access token
2. Generate Timestamp + Password
3. Send STK Push request → receive `CheckoutRequestID`
4. Store `CheckoutRequestID` against your order
5. Customer receives prompt and enters PIN
6. Safaricom POSTs result to your `CallBackURL`
7. Parse callback, update order status, respond with HTTP 200
8. If no callback → query status with `CheckoutRequestID`

---

*Documentation compiled from Safaricom Daraja API references and widely used developer sources (as of 2026). Always verify the latest details in the official [Daraja Developer Portal](https://developer.safaricom.co.ke).*
