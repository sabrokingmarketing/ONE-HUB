# Security & POPIA

## Technical controls (implemented)

- **Individual accounts only**, invite-only sign-up bound to the invited email. There is no open sign-up path at all: the first Super Admin's invitation comes from the internal `system:bootstrapAdmin` command, which needs the deployment's credentials; passwords ≥10 chars with letters + digits; reset via 8-digit emailed code (15-minute expiry); reset never reveals whether an account exists.
- **Server-side authorisation** on every query/mutation (`requireUser`, `requirePermission`). Suspended users are rejected on every call and their sessions are deleted.
- **At least one active Super Admin** is enforced.
- **Least privilege**: directors cannot manage users, settings, integrations or the audit log, and cannot permanently erase personal data (Super Admin only).
- **Public surface** limited to `leadForms.publicGet` (form definition only) and `leadForms.submit` (validation, honeypot, minimum fill time, per-form rate limit, payload size caps, option whitelisting, length caps). Lead-alert emails are capped at 15 per form per hour, so a spam flood can't use up the daily email quota needed for invitations and password resets. **Known limit:** the rate limit is per form, not per visitor, and the fill-time check runs in the browser, so a determined bot can still fill a form's limit. Adding Cloudflare Turnstile (free) to public forms closes this; it needs a Turnstile site key, so it is left for approval.
- **No public file URLs**: Convex storage URLs are unguessable and only returned to authorised users. **Known limit:** a storage URL does not expire, so anyone who already copied one (including a since-suspended user) can still open that file. Serving files through a permission-checked endpoint would close this; until then, re-upload a file as a new version to retire an exposed link.
- **Credential emails stay private**: invitation links and password-reset codes are never redirected to the shared test inbox in `test` email mode, and `log` mode refuses to send them rather than swallow them. Switch to `live` before inviting real users.
- **SVG** is refused for documents and staff photos (it can carry script); the Marketing Studio accepts it for logos and shows it only through `<img>`, which never runs scripts.
- **Tokens never leave the server**; list queries strip them.
- **Audit log** of creates, updates, imports, exports, invitations, role changes, suspensions, deletions.
- **Controlled exports**: CSV export requires write permission, is audited and neutralises spreadsheet formula injection.
- **Transport & browser**: HTTPS everywhere, HSTS, CSP, `X-Frame-Options: DENY` (except embeddable lead forms), `nosniff`, strict referrer policy. React escapes all output; email HTML escapes all user text.
- **Service worker** caches the app shell only, never business data.

## POPIA (Protection of Personal Information Act)

Implemented support:
- **Consent capture**: the default lead form includes a POPIA consent checkbox, stored per lead.
- **Data minimisation**: the public form API exposes no internal data; broker "share" omits internal notes.
- **Correction**: all records are editable with history.
- **Deletion**: archive (soft) for normal use; permanent erasure of a lead by Super Admin with typed confirmation. Erasure also deletes the lead's in-app notifications, blanks its alert-email bodies and redacts earlier audit summaries, so no personal details remain.
- **Email retention**: a daily job drops the body of every finished email after 30 days (status and metadata stay for delivery history).
- **Retention**: configurable lead retention period (Admin → Settings) as the policy anchor.

Obligations code cannot meet (owner: ONE Property Holdings):
1. Register/appoint an **Information Officer** with the Information Regulator.
2. Publish a **privacy notice** and link it from public lead forms.
3. Define **retention schedules** and run periodic reviews (an automated retention job is planned).
4. Handle **data-subject requests** (access, correction, deletion) within statutory timelines.
5. **Operator agreements** with processors (Convex, Cloudflare, Resend, and later Google/Microsoft if calendars are connected), including cross-border transfer assessment (section 72), since data is hosted outside South Africa.
6. **Breach notification** procedure (Information Regulator and data subjects).
7. Staff training on handling employee and lead data.
