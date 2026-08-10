# LOCAL ONLY — Jobs standalone compose

`docker-compose.yml` in this repo uses network `app_net` and publishes app ports for local development.

## Production

Use **DevMinds platform**:

- Containers join `devminds-net`
- Public routing: edge gateway → `devminds-internal-nginx` → jobs FE/BE
- Ops: `./scripts/dm.sh production platform deploy`

Do not publish host `:80`/`:443` from this stack when the edge gateway is running.
