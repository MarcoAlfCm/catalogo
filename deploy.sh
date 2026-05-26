#!/bin/bash
set -e

cd /opt/catalogo

echo "Actualizando catalogo desde GitHub..."

git fetch origin main
git reset --hard origin/main

echo "Instalando dependencias de produccion..."
npm install --omit=dev

if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)" 2>/dev/null; then
  echo "Ejecutando build..."
  npm run build
else
  echo "No hay script build, se omite."
fi

echo "Reiniciando PM2..."
pm2 restart catalogo --update-env
pm2 save

echo "Deploy terminado."
