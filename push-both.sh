#!/bin/bash

# Script to push changes to both GitHub repositories
echo "🚀 Pushing to both repositories..."

echo "📤 Pushing to secondary account (kkjv415_azu/nVitroGHrepo)..."
git push origin main

echo "📤 Pushing to primary account (thomasciucci/tce-graphs)..."  
git push primary main

echo "✅ Successfully pushed to both repositories!"
echo "🔗 Secondary: https://github.com/kkjv415_azu/nVitroGHrepo"
echo "🔗 Primary: https://github.com/thomasciucci/tce-graphs"