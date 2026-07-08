---
name: Clerk v6 React Signals API
description: Breaking API changes in @clerk/react v6 vs classic — hooks and OAuth flow
---

## useSignIn() — new signals API

`useSignIn()` from `@clerk/react` v6 returns `SignInSignalValue`:
```ts
{ errors: SignInErrors, fetchStatus: 'idle' | 'fetching', signIn: SignInFutureResource }
```
- No `isLoaded` property (use `fetchStatus === 'idle'` or just call directly)
- No `authenticateWithRedirect()` — replaced by `signIn.sso()`

## OAuth/SSO redirect — new API

Classic (v5):
```ts
signIn.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl: '/callback', redirectUrlComplete: '/' })
```

New (v6):
```ts
signIn.sso({ strategy: 'oauth_google', redirectUrl: '/', redirectCallbackUrl: '/sign-in/sso-callback' })
```
- `redirectUrl` = final destination (was `redirectUrlComplete`)
- `redirectCallbackUrl` = OAuth callback route (was `redirectUrl`)

## useUser() / useClerk() — unchanged

Still imported from `@clerk/shared/react` and re-exported from `@clerk/react`. `{ isSignedIn, isLoaded }` still work on `useUser()`.

## AuthenticateWithRedirectCallback

Still works in v6, used in the sign-in callback page as `<AuthenticateWithRedirectCallback />`.

**Why:** @clerk/react v6 introduced a "signals" (reactive state) API for sign-in flows. Old imperative methods moved to `SignInFutureResource`.

**How to apply:** Always use `signIn.sso()` for OAuth redirect, not `authenticateWithRedirect`.
