# Decision record: `disableCSRFCheck` in Better Auth

**Status:** investigated, not yet flipped. Behavior unchanged; now env-gated.
**Date:** 2026-08-16
**Applies to:** `src/infrastructure/auth/auth.ts`, better-auth **1.6.23**

---

## 1. What was there, and where it came from

```ts
advanced: {
  disableCSRFCheck: true,
}
```

`git log -L` traces this to commit **afa4efc**, *"Add integration tests for Bearer
token authentication and task management workflow"* — i.e. it arrived with the
**mobile Bearer-token API**, not as a considered decision about browser security.
It carried no comment explaining why.

## 2. What the flag actually does (verified against installed code)

Read from `node_modules/better-auth/dist`, version 1.6.23 — not from the docs,
because the flag's name understates it.

`context/create-context.mjs:209`

```js
skipCSRFCheck: !!options.advanced?.disableCSRFCheck,
skipOriginCheck: options.advanced?.disableOriginCheck !== undefined ? ... : isTest(),
```

`api/middleware/origin-check.mjs:100`

```js
async function validateOrigin(ctx, forceValidate = false) {
  ...
  if (ctx.context.skipCSRFCheck) return;      // <— our flag short-circuits here
  ...
  if (!(forceValidate || useCookies)) return; // cookieless requests exit anyway
  if (!originHeader || originHeader === "null") throw FORBIDDEN;
  if (!trustedOrigins.some(...)) throw INVALID_ORIGIN;
}
```

So, concretely:

- `disableCSRFCheck` is **not** limited to the Fetch-Metadata form-CSRF check. It
  also disables the **Origin/Referer vs `trustedOrigins`** validation on
  `/api/auth/*`. This is broader than the name implies.
- It is a **separate** option from `disableOriginCheck`. We do not set that one.
- With the flag on, `trustedOrigins` is effectively unused for these routes —
  which is why `BETTER_AUTH_TRUSTED_ORIGINS` being empty by default has never
  broken anything.

## 3. Why it is very likely unnecessary

The mobile app authenticates with `Authorization: Bearer <token>` and sends **no
cookie**. `validateOrigin` contains:

```js
const useCookies = headers.has("cookie");
...
if (!(forceValidate || useCookies)) return;
```

A cookieless request therefore **skips origin validation regardless** of this
flag. The mobile client does not appear to need the flag at all in 1.6.x.

That said, this has not been proven against the running mobile app, and the flag
may have been added against an older better-auth whose behavior differed. This
is why it has not been flipped as part of the bug-fix pass.

## 4. Current residual protection (what stands if the flag stays on)

| Layer | Status |
| --- | --- |
| Session cookie `SameSite=Lax` | **Active** (better-auth default) — a cross-site `POST` does not carry the session cookie, which blocks the classic CSRF shape |
| Cookie `HttpOnly` | Active |
| Cookie `Secure` | Active once `BETTER_AUTH_URL` is `https://` |
| Origin/Referer vs `trustedOrigins` | **Disabled by this flag** |
| Fetch-Metadata cross-site navigation block | **Disabled by this flag** |

The practical exposure is the loss of defense-in-depth, not an open CSRF hole:
SameSite=Lax is doing the real work. The gap matters most for any future
`SameSite=None` cookie, a same-site-but-untrusted subdomain, or a browser where
Lax enforcement is weakened.

## 5. Decision

**Do not flip blind.** The flag is now env-gated with the *existing* behavior as
the default, so no runtime behavior changed in this pass:

```ts
disableCSRFCheck: process.env.BETTER_AUTH_DISABLE_CSRF !== "0",
```

- unset / any value → `true` → current behavior preserved
- `BETTER_AUTH_DISABLE_CSRF=0` → CSRF + origin validation **enabled**

Making it config rather than code means the check can be turned on — and rolled
back — without rebuilding or redeploying the image.

`scripts/startup-validate.js` now prints a warning when the check is disabled
while `BETTER_AUTH_URL` is HTTPS, so the state is visible on every boot instead
of being buried in source.

## 6. How to turn it on (operator verification plan)

Prerequisite: `BETTER_AUTH_TRUSTED_ORIGINS` **must** list every origin the
browser uses, or sign-in will start returning `403 INVALID_ORIGIN`. With the
check enabled the empty default is no longer harmless.

```dotenv
BETTER_AUTH_URL="https://<your-domain>"
BETTER_AUTH_TRUSTED_ORIGINS="https://<your-domain>"
BETTER_AUTH_DISABLE_CSRF="0"
```

Then verify, in this order — roll back by removing `BETTER_AUTH_DISABLE_CSRF` if
any step fails:

1. Web sign-in over HTTPS succeeds.
2. Web sign-up / onboarding succeeds.
3. Sign-out succeeds; session is revoked.
4. **Mobile** sign-in succeeds (Bearer flow, the reason the flag exists).
5. Mobile task/picking/delivery actions still succeed after re-auth.
6. Invoice PDF download (token-based, cookieless) still works.
7. Server logs contain no `Invalid origin:` errors.

Step 4 is the decisive one. If mobile breaks, capture the exact
`Invalid origin:` log line — it names the origin to add to `trustedOrigins`
rather than a reason to disable the check again.

## 7. Recommendation

Enable the check (`BETTER_AUTH_DISABLE_CSRF=0`) as part of the HTTPS/reverse-proxy
milestone, once a real domain exists and `trustedOrigins` can be set correctly —
the two changes are naturally verified together, and neither is meaningful
without the other.
