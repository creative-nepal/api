# Platform User Administration — Better Auth admin plugin, in full

Brings every capability of Better Auth's `admin` plugin into `apps/admin`'s
Users screen. Before this, four of sixteen were wired: `listUsers`, `setRole`,
`banUser`, `unbanUser`.

## Context

The plugin was already configured server-side with a real access-control model
(`platformAc` / `superAdminRole` in `apps/api/src/auth/access-control.ts`), and
`superAdminRole` already granted `user: [create, list, set-role, ban,
impersonate, delete, set-password, set-email, get, update]` and `session: [list,
revoke, delete]`. The dashboard exercised a quarter of that. The permissions
were fiction until something called the endpoints they guard.

## 1. The full surface, and where each lands

| Capability | Where it shows up |
| --- | --- |
| `listUsers` | table, with server-side search / filter / sort / pagination |
| `getUser` | **View details** — read fresh from the server, not the cached row |
| `createUser` | **New user** sheet (name, email, password, role) |
| `updateUser` | **Edit details** sheet (name, email) |
| `removeUser` | **Delete user**, behind a confirm that says it is irreversible |
| `setRole` | Make / remove admin |
| `setUserPassword` | **Set password** dialog |
| `banUser` | **Ban** dialog — reason plus duration |
| `unbanUser` | Unban |
| `listUserSessions` | **Active sessions** sheet |
| `revokeUserSession` | per-session Revoke |
| `revokeUserSessions` | Revoke all sessions |
| `impersonateUser` | Impersonate |
| `stopImpersonating` | banner, mounted in the dashboard layout |
| `hasPermission` | server-authoritative page gate |
| `checkRolePermission` | synchronous menu-item gating |

## 2. Two permission checks, deliberately

`checkRolePermission` is client-side and synchronous — right for deciding
whether to render a menu item, wrong as a gate, since it only knows the role
string in the session.

`hasPermission` asks the server. It gates the page. The difference is not
academic: **while impersonating, the session's role really is the impersonated
user's**, so admin calls 403. A page gated only on the client would render a
table whose every request fails. Gated on the server, it renders an explanation
and a way out.

## 3. Ban is a decision, not a switch

The previous implementation sent `banReason: "Banned by admin"` — a constant,
which is the same as no reason. Better Auth surfaces the reason to the user at
sign-in, so it should say something.

Ban now takes a written reason and a duration (permanent / 1 / 7 / 30 days,
sent as `banExpiresIn` seconds). A ban with an expiry is a suspension and the
table labels it as one, showing the reason and the date it lifts.

## 4. Impersonation crosses apps

Impersonating swaps the session cookie for the target user's. Since the cookie
belongs to the API's domain, `apps/web` picks it up — which is the point: you
impersonate to see a tenant's own workspace, and that workspace is `web`, not
`admin`. The banner therefore offers **Open workspace** alongside **Stop
impersonating**, and it lives in the dashboard layout rather than the Users
view, because by then admin pages no longer load.

## 5. Search, filter, sort

`listUsers` takes one search field and one filter field, so the toolbar offers
exactly that: a search box, a field selector (email / name), and a single
filter (all / admins / regular users / banned). Sorting is by column, and the
column ids are `name`, `email`, `createdAt` because the column id *is* the
`sortBy` value sent to the server — an id that is not in that allow-list would
silently fail. The email column ships hidden, available from the view options,
so email is sortable without duplicating what the user column already shows.

**Name search is case-sensitive.** `listUsers` builds its where-clause without
the adapter's `insensitive` mode, so it compiles to `LIKE`, not `ILIKE` —
searching `car` does not find `Carol`. This is Better Auth's behaviour and not
configurable from our side short of patching the library, so rather than ship a
search box that looks broken, the placeholder says so when the field is `name`.
Email search is unaffected in practice because emails are stored lower-cased.

## 6. Status

> **Built and verified against a live Postgres**, exercising all sixteen
> capabilities through the API the client calls.
>
> Confirmed: `createUser` then `getUser`; `updateUser` changing name and email;
> `setRole` both directions, checked in the database; `setUserPassword`
> followed by a successful sign-in with the new password; ban with reason and a
> 7-day expiry, the banned user's sign-in refused with the ban message, then
> unban restoring sign-in; three concurrent sessions listed, one revoked, then
> all revoked (3 → 2 → 0); `removeUser` deleting the user with no orphaned
> `account` or `session` rows.
>
> Impersonation round trip: admin → `impersonate-user` → session reports
> `bob@t.test` with `impersonatedBy` set and `list-users` returns **403** →
> `stop-impersonating` → session is the admin again and `list-users` returns
> 200. That 403 is what the page gate and the banner exist for.
>
> `hasPermission` returns `success: true` for the admin across `user:[ban]`,
> `user:[delete]`, `business:[suspend]`, and `false` for an ordinary user,
> whose `list-users` call is refused with 403.
>
> Filtering by `role` and by `banned` was verified against seeded data,
> including combined search + filter.

## 7. Not in this phase

- **`setUserPassword` does not revoke sessions.** Better Auth leaves them
  valid; the dialog says so, and Revoke all sessions is one menu item away.
  Coupling them would remove a choice an admin sometimes needs.
- **Bulk actions.** Every action is per-user; the plugin has no bulk endpoint,
  and looping client-side would give partial failures no clear reporting.
- **Custom `data` on create.** `createUser` accepts extra fields; we send none,
  since the platform user record has no custom columns yet.
