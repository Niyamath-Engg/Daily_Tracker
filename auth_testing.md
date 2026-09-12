# Auth Testing Playbook (Daily OS)

Daily OS supports TWO auth methods that both issue a `session_token` (cookie `session_token`, path=/, httpOnly, secure, samesite=none) and also return it in the JSON body for Bearer use:

1. Email + password (JWT-like session):
   - POST /api/auth/register {email, password, name}
   - POST /api/auth/login {email, password}
2. Emergent Google OAuth:
   - Frontend redirects to https://auth.emergentagent.com/?redirect=<origin>/dashboard
   - Returns to /dashboard#session_id=... -> frontend posts session_id to POST /api/auth/session

Common endpoints:
- GET /api/auth/me  (returns current user; accepts cookie OR Authorization: Bearer <session_token>)
- POST /api/auth/logout

## Test with email/password (simplest for automated testing)
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -s -X POST "$API/api/auth/register" -H "Content-Type: application/json" \
  -d '{"email":"tester@dailyos.app","password":"Test1234!","name":"Tester"}'
# -> {"user":{...},"session_token":"sess_..."}
TOKEN=<session_token>
curl -s "$API/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -s -X PUT "$API/api/daily/2026-06-12" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reading":{"book":"X","pages_read":10}}'
```

## Browser testing
Register/login via UI OR set cookie:
```
await page.context.add_cookies([{ "name":"session_token","value":TOKEN,"domain":"<host>","path":"/","httpOnly":true,"secure":true,"sameSite":"None"}])
```

## Checklist
- users has user_id (custom), password_hash for password users, auth_provider
- user_sessions.user_id matches users.user_id
- all queries use {"_id":0}
- /api/auth/me returns user (not 401) with valid token
