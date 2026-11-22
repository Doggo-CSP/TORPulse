#!/usr/bin/env bash
# Creates the production secrets for docker-compose.prod.yml (ASVS V13.3.1, V11.1.1, V12.3.1).
#
#   ./deploy/init-secrets.sh            # create anything missing, never overwrite
#
# Needs openssl and docker (docker only to bcrypt-hash the Loki passwords with Caddy).
# Writes deploy/secrets/ (gitignored, directory mode 700):
#   mongo_root_password, mongo_app_password   random
#   session_secret, grafana_admin_password    random
#   loki_writer_password, loki_reader_password  random, plus bcrypt *_hash for the gateway
#   mongodb_uri                               app user + TLS connection string
#   internal_ca.pem (+ internal_ca.key)       internal CA for every TLS hop inside the stack
#   mongo_server.pem                          MongoDB certificate + key (one file)
#   api.crt/.key, frontend.crt/.key, loki_gateway.crt/.key   service certificates
#   google_client_secret, google_api_key, smtp_pass   empty: paste the real values in
set -euo pipefail

cd "$(dirname "$0")"
SECRETS=secrets
DB_NAME="${MONGODB_DATABASE:-torpulse}"
CADDY_IMAGE=caddy:2.10-alpine
mkdir -p "$SECRETS"
chmod 700 "$SECRETS"

random() { openssl rand -base64 "$1" | tr -d '\n/+=' | cut -c1-"$2"; }

write_if_missing() {
  local file="$SECRETS/$1"
  if [[ -s "$file" ]]; then
    echo "keep    $file"
  else
    printf '%s' "$2" > "$file"
    echo "created $file"
  fi
}

write_if_missing mongo_root_password "$(random 32 40)"
write_if_missing mongo_app_password "$(random 32 40)"
write_if_missing session_secret "$(random 48 64)"
write_if_missing grafana_admin_password "$(random 24 32)"
write_if_missing loki_writer_password "$(random 32 40)"
write_if_missing loki_reader_password "$(random 32 40)"
write_if_missing mongodb_uri "mongodb://torpulse_app:$(cat "$SECRETS/mongo_app_password")@mongo:27017/${DB_NAME}?authSource=${DB_NAME}&tls=true&tlsCAFile=/run/secrets/internal_ca"
for name in google_client_secret google_api_key smtp_pass; do
  [[ -e "$SECRETS/$name" ]] || { : > "$SECRETS/$name"; echo "created $SECRETS/$name (EMPTY: fill it in)"; }
done

# bcrypt hashes for the Loki gateway's basic auth (the gateway never sees the plain passwords)
for who in writer reader; do
  if [[ ! -s "$SECRETS/loki_${who}_hash" ]]; then
    docker run --rm "$CADDY_IMAGE" caddy hash-password --plaintext "$(cat "$SECRETS/loki_${who}_password")" \
      | tr -d '\n' > "$SECRETS/loki_${who}_hash"
    echo "created $SECRETS/loki_${who}_hash"
  fi
done

# ---- Internal CA: TLS for Caddy -> api/frontend, app -> MongoDB, Alloy/Grafana -> Loki ----
# The CA key stays in this directory and is never mounted into a container. Service
# certificates are valid for their compose service name and expire after 825 days.
if [[ ! -s "$SECRETS/internal_ca.pem" ]]; then
  openssl req -x509 -newkey rsa:3072 -sha256 -days 1825 -nodes \
    -keyout "$SECRETS/internal_ca.key" -out "$SECRETS/internal_ca.pem" \
    -subj "/CN=TORPulse internal CA" 2>/dev/null
  chmod 600 "$SECRETS/internal_ca.key"
  echo "created $SECRETS/internal_ca.pem"
fi

issue() {
  local name="$1" host="$2"
  [[ -s "$SECRETS/$name.crt" ]] && { echo "keep    $SECRETS/$name.crt"; return; }
  local tmp
  tmp="$(mktemp -d)"
  openssl req -newkey rsa:3072 -sha256 -nodes -keyout "$SECRETS/$name.key" -out "$tmp/req.csr" \
    -subj "/CN=$host" 2>/dev/null
  printf 'subjectAltName=DNS:%s,DNS:localhost\nextendedKeyUsage=serverAuth\n' "$host" > "$tmp/ext.cnf"
  openssl x509 -req -in "$tmp/req.csr" -CA "$SECRETS/internal_ca.pem" -CAkey "$SECRETS/internal_ca.key" \
    -CAcreateserial -days 825 -sha256 -extfile "$tmp/ext.cnf" -out "$SECRETS/$name.crt" 2>/dev/null
  rm -rf "$tmp" "$SECRETS/internal_ca.srl"
  echo "created $SECRETS/$name.crt"
}

issue mongo mongo
issue api api
issue frontend frontend
issue loki_gateway loki-gateway
[[ -s "$SECRETS/mongo_server.pem" ]] || cat "$SECRETS/mongo.crt" "$SECRETS/mongo.key" > "$SECRETS/mongo_server.pem"

# Files are world-readable *inside* the 700 directory: containers run as their own users
# (mongodb, node, caddy, grafana) and each container only gets the secrets listed for it.
# The CA key stays owner-only and is never given to a container.
find "$SECRETS" -type f ! -name 'internal_ca.key' -exec chmod 644 {} +
echo "done. Fill in the empty files, then: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
