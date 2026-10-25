# Product email

`marker@aekr.io` is marKER’s contact for help, security and privacy requests, its policy contact, and the From/Reply-To address for access codes and access-help instructions. Both EN and ES notices use this product alias. Inbound delivery uses the owner-confirmed Google Workspace alias; it is not a separate paid mailbox or a sign-in identity.

The deployed application sends transactional authentication mail through the existing Cloudflare Email Service `EMAIL` binding. `MARKER_SENDER_EMAIL` and the binding’s sender restriction are set to `marker@aekr.io`. The recipient restriction and sole authorized marKER login are independent and stay unchanged. No SMTP username or Google Workspace password is used by this transport.

If an explicitly approved future transport uses Google Workspace SMTP, authenticate using the existing primary mailbox (`aekr@aekr.io`) and its separately managed supported credentials, while retaining `marker@aekr.io` as the product From/Reply-To address with provider authorization. The alias is not a mailbox login. Do not reuse another product’s authentication SMTP credentials or make marKER depend on a paid `timeker@aekr.io` user.

Changing repository settings does not prove provider acceptance or real inbox delivery. Verify the existing sending domain and allowed sender in provider metadata, without sending a message. A real delivery check requires separate authorization and is not part of automated tests. This increment does not change Workspace users, billing, MX/DNS, OAuth identities, sessions or data.