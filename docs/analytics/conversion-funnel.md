# Canonical conversion funnel

Date: 2026-08-31

The funnel describes product questions, not historical performance. There is
no real public traffic or real production dataset to support rates, CAC, LTV,
or retention claims.

| Step | Event/signal | Success condition | Drop-off condition | Authority |
| --- | --- | --- | --- | --- |
| Visitor | page request / `identifiable_visit` | public surface rendered | no render | application request and client signal |
| Registration started | `signup_started` | valid registration flow entered | leave before submit | client form state |
| Registration completed | `signup_completed` | backend returns canonical account/session | auth response fails or is abandoned | successful auth response |
| First value | product interaction | first question/simulation/study action is actually persisted | no successful first-value action | product persistence, not a click |
| Pricing | `plan_viewed` | plan offer rendered | no pricing exposure | rendered plan data |
| Checkout | `checkout_started` | checkout starts with a valid plan | leave before payment step | rendered checkout state |
| Payment step | `payment_method_started` | payment method step rendered | leave before payment attempt | rendered checkout state |
| Paid conversion | billing state | published provider-backed subscription/transaction is valid | payment fails, cancels, or is not reconciled | server billing state |
| Retention proxy | billing/activity state | later authorized activity or renewal | no later state | server product/billing state |

The client never asserts a paid conversion. `purchase_completed` is rejected by
the public analytics validator, and the checkout success path no longer emits
payment or subscription identifiers to analytics.

## Attribution

The initial model is intentionally simple: bounded UTM source, medium, and
campaign are attached to consented event records when present in the current
landing URL. Referrer URLs and raw query strings are not persisted. First-touch
and last-touch retention, cross-device attribution, and campaign expiry remain
post-review work and are not inferred from current data.

## Post-GO measurements

Real conversion rate, retention, CAC, LTV, Search Console performance, and
field CWV are `POST_GO_REAL_DATA_VALIDATION`. PRELAUNCH tests are synthetic and
must not be presented as public-user metrics.
