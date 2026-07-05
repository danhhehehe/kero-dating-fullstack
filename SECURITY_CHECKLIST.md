# Security Checklist

- [ ] `.env` is not committed.
- [ ] README does not contain public login credentials.
- [ ] JWT secret is long, random, and environment-specific.
- [ ] Admin routes require authentication and admin role.
- [ ] Auth routes have rate limiting.
- [ ] Forgot flow does not reveal whether an email exists.
- [ ] Credential hashes use bcrypt.
- [ ] Public APIs do not return email, credentials, raw birthday, or exact location.
- [ ] Photo input is limited by MIME type, count, and size.
- [ ] CORS does not use wildcard origins.
- [ ] Production seed cannot run without explicit confirmation.
- [ ] Logs do not include secrets, tokens, cookies, or credentials.
- [ ] Git history does not contain secrets.

If a secret was exposed or committed:

1. Revoke the exposed secret.
2. Generate a replacement secret.
3. Remove the secret from current files.
4. Clean git history with an appropriate tool if needed.
5. Rotate JWT, SMTP, database, and any other affected credentials.
6. Invalidate sessions if needed.
