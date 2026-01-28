# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Chatspace - Private AI seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do Not Disclose Publicly

Please do not open a public GitHub issue for security vulnerabilities. This helps protect users who haven't yet upgraded.

### 2. Report Privately

Send an email to: **security@chatspace.ai** (or open a private security advisory on GitHub)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity (critical issues prioritized)

## Security Best Practices

### For Deployment

1. **Change Default Credentials**
   ```bash
   ADMIN_EMAIL=your-secure-email@domain.com
   ADMIN_PASSWORD=use-a-strong-password
   ```

2. **Generate Secure JWT Secret**
   ```bash
   SECRET_KEY=$(openssl rand -hex 32)
   ```

3. **Use Environment Variables**
   - Never hardcode API keys or secrets
   - Use `.env` files (excluded from git)
   - Rotate API keys regularly

4. **Network Security**
   - Use HTTPS in production (reverse proxy with SSL)
   - Restrict access to internal services (LLM, Qdrant, etc.)
   - Use firewall rules to limit exposure

5. **Data Protection**
   - Mount `/data` volume with appropriate permissions
   - Regular backups of database and documents
   - Consider encryption at rest for sensitive data

### For Development

1. **Dependencies**
   - Keep dependencies updated
   - Review `requirements.txt` and `package.json` regularly
   - Use `pip audit` and `npm audit`

2. **Code Review**
   - Review PRs for security issues
   - Check for SQL injection, XSS, CSRF vulnerabilities
   - Validate all user inputs

3. **Secrets Management**
   - Never commit `.env` files
   - Use `.env.example` for templates
   - Rotate development credentials regularly

## Known Security Considerations

### Authentication
- JWT tokens expire after configured duration
- Passwords hashed with bcrypt
- API keys stored securely (only shown once on creation)

### Data Privacy
- All data stays within your infrastructure
- No external data transmission (except configured LLM/embedding services)
- Documents stored locally in `/data` volume

### API Security
- CORS configured for frontend origin
- Rate limiting recommended (implement via reverse proxy)
- API key authentication for programmatic access

### Vector Database
- Qdrant/LanceDB access should be restricted to application only
- No direct public access to vector stores
- Workspace isolation enforced at application level

## Security Features

- ✅ JWT-based authentication
- ✅ Bcrypt password hashing
- ✅ API key authentication
- ✅ Role-based access control (admin/user)
- ✅ Workspace isolation
- ✅ Input validation via Pydantic
- ✅ SQL injection protection (SQLAlchemy ORM)
- ✅ CORS configuration

## Compliance

This application is designed to support:
- **GDPR**: Data stays on-premises, no external transmission
- **HIPAA**: Suitable for healthcare with proper deployment
- **EU AI Act**: Local AI inference, transparent operations

**Note**: Compliance depends on your deployment configuration and operational procedures.

## Updates

Security updates will be announced via:
- GitHub Security Advisories
- Release notes in CHANGELOG.md
- GitHub Releases

## Questions?

For security-related questions (non-vulnerabilities), open a GitHub issue or discussion.

---

**Last Updated**: January 2026
