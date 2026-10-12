# Product-flow inventory for owner review

Source reviewed 13 October 2026. This records implemented features, not legal conclusions about the business. External dashboards, tags and business practices have not been inspected.

| Area | Observed source | Owner follow-up |
| --- | --- | --- |
| Signup | Google OAuth; no age-attestation endpoint or signed age cookie exists. | Confirm the intended customer audience and applicable policy before adding an age restriction. |
| Fonts | Existing system-font stacks; no remote Google Fonts stylesheet in the shared layout. | Preserve the current design; check any externally embedded content separately. |
| Replay | No initialized replay SDK or replay script found. | Check external tag-manager/analytics settings before launch. |
| Email | Transactional order and booking notifications only. | Confirm actual sender, recipients and privacy/contact information. Marketing campaigns are outside this implementation. |
| Payments | One-time Stripe Checkout; no recurring subscription flow. | Publish the business's actual return, cancellation and fulfillment terms before accepting live orders. |
| Uploads | No backend image-upload storage or public user-content hosting. | Browser previews must not claim files are stored or submitted. |
| Customer data | Profiles, shipping addresses, orders and bookings in the server database; required booking contact fields mirrored to private Sheets/Calendar. | Confirm access, retention, deletion and privacy disclosures for actual operations. |

An earlier document claimed an implemented 18+ cookie gate and remote Google Fonts. Those claims did not match current source and have been corrected. No legal policy, filing or arbitrary age restriction was introduced by this review.
