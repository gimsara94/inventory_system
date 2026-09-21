# PostgreSQL TLS certificate

`supabase-root-2021.crt` is the public Supabase Root 2021 CA certificate, downloaded from:

`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`

SHA-256 fingerprint:

`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

It expires on 26 April 2031. The Session pooler's TLS chain and hostname were verified with this certificate before applying the migration. If Supabase rotates its CA, download the current certificate from the project's **Database Settings → SSL Configuration** and set `DATABASE_CA_CERT` to its path.
