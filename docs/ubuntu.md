# Ubuntu hosting — Jobs API (and optional full stack)

Use a VPS (Ubuntu 22.04 / 24.04) when you want a long-running Node process: Socket.IO, Redis, uploads on disk, and optional Elasticsearch.

The free production path is Vercel plus Neon. See [vercel-deployment.md](vercel-deployment.md). Use this chapter when you outgrow Hobby limits. Point DNS back from the Vercel CNAME to this server only after nginx and TLS work. While Vercel owns `jobs.devminds.net`, do not also publish an A record to the VPS for the same name.

Customer Next.js can run on the **same** machine (PM2 + nginx) or stay on Vercel with `NEXT_PUBLIC_API_BASE` pointing at this API.

## 1. Bootstrap

```bash
sudo bash scripts/ubuntu-bootstrap.sh
```

Installs Node.js 20, build tools, nginx, and (optional prompts in the script comments) Redis. Run as a sudo-capable user.

## 2. App user and code

```bash
sudo useradd -m -s /bin/bash jobs || true
sudo mkdir -p /var/www/jobs-api
sudo chown -R "$USER":"$USER" /var/www/jobs-api
git clone <this-repo-url> /var/www/jobs-api
cd /var/www/jobs-api
cp .env.example .env
# edit .env: HOSTING_PLATFORM=local, DB_PROVIDER, DATABASE_URL, JWT_SECRET, CORS_ORIGIN, REDIS_URL
npm ci
export DB_PROVIDER=mysql   # or postgresql
npx prisma generate
npx prisma migrate deploy
npm run seed   # optional
```

## 3. Process manager (PM2)

```bash
sudo npm i -g pm2
bash scripts/ubuntu-run.sh
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME"
```

`ubuntu-run.sh` starts `node src/index.js` on `PORT` from `.env` (default 4000). For the image worker: `pm2 start npm --name jobs-worker -- run worker`.

## 4. nginx + TLS for `jobs.devminds.net`

If **both** apps run on this VPS:

- Next.js on `127.0.0.1:3000`
- API on `127.0.0.1:4000`

Example site file: [`nginx-jobs.devminds.net.conf`](./nginx-jobs.devminds.net.conf)

```bash
sudo cp docs/nginx-jobs.devminds.net.conf /etc/nginx/sites-available/jobs.devminds.net
sudo ln -s /etc/nginx/sites-available/jobs.devminds.net /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d jobs.devminds.net
```

Set frontend `NEXT_PUBLIC_API_BASE=https://jobs.devminds.net/backend` and rebuild Next.js so the browser calls the same host. nginx proxies `/backend/` to the Express port.

If only the **API** is on Ubuntu and the customer app is on Vercel:

- API subdomain or path must be HTTPS
- Set Vercel `NEXT_PUBLIC_API_BASE` and `BACKEND_VERCEL_URL` / rewrites accordingly
- API `.env`: `CORS_ORIGIN=https://jobs.devminds.net`

## 5. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Do not expose MySQL/Redis/ES to the public internet.

## 6. Updates

```bash
cd /var/www/jobs-api
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
pm2 restart jobs-api
```
