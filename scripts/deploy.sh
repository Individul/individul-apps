#!/bin/bash
set -e

echo "=== Deployment started at $(date) ==="

# Deploy Portal (root)
echo "Deploying Portal..."
mkdir -p /var/www/html/portal
cp -r /tmp/deploy/portal/* /var/www/html/portal/
# Update root index.html to redirect to portal
cp /tmp/deploy/portal/index.html /var/www/html/index.html

# Reload nginx
echo "Reloading nginx..."
nginx -t && systemctl reload nginx

echo "=== Deployment completed at $(date) ==="
