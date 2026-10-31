#!/bin/bash

# Helper script to push code to GitHub with Personal Access Token

echo "🚀 Pushing HirePath to GitHub..."
echo ""
echo "When prompted, enter:"
echo "  Username: BrianOdero"
echo "  Password: [Paste your Personal Access Token]"
echo ""

cd ~/Desktop/HirePath

# Configure Git to store credentials
git config --global credential.helper store

# Push to GitHub
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo "🔥 Check your GitHub Actions at:"
    echo "   https://github.com/BrianOdero/HirePath/actions"
    echo ""
    echo "📱 Check Firebase App Distribution at:"
    echo "   https://console.firebase.google.com/project/YOUR_PROJECT/appdistribution"
else
    echo ""
    echo "❌ Push failed. Try pushing with token in URL:"
    echo "   git push https://YOUR_TOKEN@github.com/BrianOdero/HirePath.git main"
fi
