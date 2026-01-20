#!/bin/bash
set -e

echo "=== Deployment started at $(date) ==="

# Deploy Portal (root)
echo "Deploying Portal..."
mkdir -p /var/www/html/portal
cp -r /tmp/deploy/portal/* /var/www/html/portal/
# Update root index.html to redirect to portal
cp /tmp/deploy/portal/index.html /var/www/html/index.html

# Deploy Clasificare
echo "Deploying Clasificare..."
mkdir -p /var/www/html/clasificare
# The build files should be in the clasificare/dist folder
# But we need to build on server or copy pre-built files
# For now, let's check if dist exists
if [ -d "/tmp/deploy/apps/clasificare/dist" ]; then
    cp -r /tmp/deploy/apps/clasificare/dist/* /var/www/html/clasificare/
    echo "Clasificare deployed from dist/"
else
    echo "Warning: Clasificare dist not found, skipping..."
fi

# Reload nginx
echo "Reloading nginx..."
nginx -t && systemctl reload nginx

echo "=== Deployment completed at $(date) ==="
