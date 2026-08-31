# Stripe Payment Integration - Setup Instructions

## Backend Setup (PHP)

### 1. Install Stripe PHP SDK
```bash
cd C:\xampp\htdocs\questao-pro-backend
composer require stripe/stripe-php
```

### 2. Run Database Migrations
Execute the SQL migration in phpMyAdmin or MySQL:
```bash
mysql -u root questao_pro < migrations/add_stripe_columns.sql
```

Or manually run in phpMyAdmin:
- Open `migrations/add_stripe_columns.sql`
- Copy and execute the SQL

### 3. Configure Environment Variables
Create `.env` file in `C:\xampp\htdocs\questao-pro-backend\`:
```env
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_TEST_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
PLATFORM_FEE_PERCENT=15
```

**Get your keys from**: https://dashboard.stripe.com/test/apikeys

### 4. Test Backend Endpoints
Test if endpoints are working:
```bash
# Test payment intent creation
curl -X POST http://localhost/questao-pro-backend/api/payments/create-payment-intent.php \
  -H "Content-Type: application/json" \
  -d '{"materialId": 1, "userId": 1}'
```

---

## Frontend Setup (React)

### 1. Install Stripe React Libraries
```bash
cd c:\dev\concursomestre
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 2. Add Stripe Provider to App.tsx
See implementation in next steps...

---

## Webhook Configuration

### 1. Install Stripe CLI (for local testing)
Download from: https://stripe.com/docs/stripe-cli

### 2. Forward webhooks to local server
```bash
stripe listen --forward-to http://localhost/questao-pro-backend/api/subscriptions/stripe_webhook.php
```

This will give you a webhook secret like `whsec_...` - add it to your `.env` file.

### 3. Test webhook
```bash
stripe trigger payment_intent.succeeded
```

---

## Testing Payment Methods

### Test Cards
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0027 6000 3184

### Test Pix
- Use test mode in Stripe dashboard
- QR code will be generated automatically

### Test Boleto
- Boleto PDF will be generated
- In test mode, you can mark as paid manually

---

## Production Deployment

### 1. Get Production Keys
- Go to https://dashboard.stripe.com/apikeys
- Switch to "Live mode"
- Copy production keys

### 2. Update Environment
Replace test keys with production keys in `.env`

### 3. Configure Webhook URL
In Stripe Dashboard:
- Go to Developers > Webhooks
- Add endpoint: `https://yourdomain.com/api/subscriptions/stripe_webhook.php`
- Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

### 4. Enable Stripe Connect
- Complete business verification
- Enable Connect in dashboard
- Test seller onboarding flow

---

## Files Created

### Backend
- ✅ `migrations/add_stripe_columns.sql` - Database schema
- ✅ `config/stripe.php` - Stripe configuration
- ✅ `api/payments/create-payment-intent.php` - Create payments
- ✅ `api/subscriptions/stripe_webhook.php` - Handle events
- ✅ `api/payments/create-connect-account.php` - Seller onboarding

### Frontend (To be created)
- ⏳ `components/StripeCheckout.tsx` - Checkout component
- ⏳ Updated `App.tsx` - Stripe provider
- ⏳ Updated `Marketplace.tsx` - Buy buttons

---

## Next Steps

1. ✅ Backend complete
2. ⏳ Install Stripe React libraries
3. ⏳ Create checkout component
4. ⏳ Add buy buttons to marketplace
5. ⏳ Test payment flow

---

## Support

- Stripe Docs: https://stripe.com/docs
- Stripe Dashboard: https://dashboard.stripe.com
- Test Mode: Always test in test mode first!
