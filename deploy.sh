#!/bin/bash

# ==============================================================================
# IWMS Production Deployment Script (Ubuntu VPS)
# ==============================================================================
# Installs Node.js, PostgreSQL, PM2, and Nginx, configures the reverse proxy,
# sets up environment variables, and launches the frontend/backend services.
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== IWMS PRODUCTION DEPLOYMENT STARTING ==="
echo "Make sure you run this script as root or with sudo privilege."
echo ""

# 1. Configuration Prompts
read -p "Enter your production domain name (e.g. iwms.company.com): " DOMAIN_NAME
read -p "Enter a SECURE password for PostgreSQL user 'iwms_user': " DB_PASS
read -p "Enter email for System Owner admin: " ADMIN_EMAIL
read -sp "Enter password for System Owner admin: " ADMIN_PASS
echo ""

# Generate random JWT secrets
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

echo ""
echo "=== Step 1: Installing system dependencies... ==="
sudo apt update
sudo apt install -y curl gnupg postgresql postgresql-contrib nginx ufw git

# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -y pm2 -g

echo "=== Step 2: Configuring PostgreSQL... ==="
# Start Postgres service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create Database and User
sudo -i -u postgres psql -c "CREATE DATABASE iwms;" || true
sudo -i -u postgres psql -c "CREATE USER iwms_user WITH PASSWORD '$DB_PASS';" || true
sudo -i -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE iwms TO iwms_user;" || true

echo "=== Step 3: Setting up Backend API env variables... ==="
cd iwms-api
cat <<EOT > .env
PORT=3001
NODE_ENV=production
DATABASE_URL="postgresql://iwms_user:$DB_PASS@localhost:5432/iwms?schema=public"
JWT_SECRET="$JWT_SECRET"
JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
FIRST_ADMIN_EMAIL="$ADMIN_EMAIL"
FIRST_ADMIN_PASSWORD="$ADMIN_PASS"
FIRST_ADMIN_NAME="System Owner"
EOT

echo "=== Step 4: Installing Backend dependencies & running migrations... ==="
npm install --omit=dev
npx prisma migrate deploy
npx prisma db seed

# Start Backend using PM2
pm2 delete iwms-api 2>/dev/null || true
pm2 start server.js --name "iwms-api"

echo "=== Step 5: Setting up Frontend config... ==="
cd ../iwms
cat <<EOT > .env.production
NEXT_PUBLIC_API_URL="https://$DOMAIN_NAME/api"
NEXT_PUBLIC_WS_URL="wss://$DOMAIN_NAME"
EOT

echo "=== Step 6: Installing Frontend dependencies & building... ==="
npm install
npm run build

# Start Frontend using PM2
pm2 delete iwms-web 2>/dev/null || true
pm2 start npm --name "iwms-web" -- start -- -p 3000

# Save PM2 process list to restore on reboot
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

echo "=== Step 7: Configuring Nginx Reverse Proxy... ==="
NGINX_CONF="/etc/nginx/sites-available/iwms"
sudo cat <<EOT > $NGINX_CONF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOT

# Link configurations and restart Nginx
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "=== Step 8: Configuring Firewall... ==="
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
# Enable firewall (non-interactive)
echo "y" | sudo ufw enable

echo ""
echo "=============================================================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "Your app is now live at: http://$DOMAIN_NAME"
echo ""
echo "Next step (Recommended): Enable SSL/HTTPS using Certbot (Let's Encrypt):"
echo "  sudo apt install certbot python3-certbot-nginx -y"
echo "  sudo certbot --nginx -d $DOMAIN_NAME"
echo "=============================================================================="
