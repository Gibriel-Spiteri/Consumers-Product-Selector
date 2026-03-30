# NetSuite M2M Certificate

Place your RSA private key here as `private_key.pem`.

This file is used to sign JWT client assertions for NetSuite OAuth2 Machine-to-Machine (M2M) authentication.

## Requirements

- Algorithm: RS256 / PS256 (RSA with PSS padding)
- The corresponding public key certificate must be uploaded to the NetSuite OAuth 2.0 Client Credentials setup
- The certificate ID shown in NetSuite must be set as the `NETSUITE_CERTIFICATE_ID` environment variable

## Environment Variables Required

| Variable | Description |
|---|---|
| `NETSUITE_ACCOUNT_ID` | Your NetSuite account ID (e.g. `12345678`) |
| `NETSUITE_CLIENT_ID` | OAuth 2.0 Client ID from NetSuite |
| `NETSUITE_OIDC_CLIENT_ID` | (Optional) OIDC Client ID — used in preference to `NETSUITE_CLIENT_ID` if set |
| `NETSUITE_CERTIFICATE_ID` | Certificate ID shown in the NetSuite OAuth 2.0 setup |

## Generating a Key Pair

```bash
# Generate RSA private key
openssl genrsa -out private_key.pem 2048

# Extract the public key (upload to NetSuite)
openssl rsa -in private_key.pem -pubout -out public_key.pem
```
