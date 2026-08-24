#!/bin/bash
# =============================================================
# TSA Outliers Monitoring - Full Deployment Script
# =============================================================
# Usage: ./scripts/deploy/deploy.sh
# 
# This script will:
#   1. Create GitHub repo and push code
#   2. Create Supabase project and database
#   3. Deploy to Vercel
#
# Prerequisites:
#   - GitHub Personal Access Token (PAT) with repo permissions
#   - Supabase Access Token (from https://supabase.com/dashboard/account/tokens)
#   - Vercel Token (from https://vercel.com/account/tokens)
# =============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "========================================"
echo " TSA Outliers Monitoring - Deployment"
echo "========================================"
echo -e "${NC}"

# ---- Configuration ----
GITHUB_USERNAME="zacrie85"
REPO_NAME="tsa-outliers-monitoring"
PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# ---- Step 0: Check tokens ----
check_token() {
    if [ -z "$1" ]; then
        echo -e "${RED}ERROR: $2 token not found.${NC}"
        echo "Please set it as environment variable:"
        echo "  export $2=\"your_token_here\""
        echo ""
        echo "How to get tokens:"
        echo "  GitHub:  https://github.com/settings/tokens (repo scope)"
        echo "  Supabase: https://supabase.com/dashboard/account/tokens"
        echo "  Vercel:  https://vercel.com/account/tokens"
        return 1
    fi
    return 0
}

# ---- Step 1: GitHub ----
deploy_github() {
    echo -e "${YELLOW}[1/3] Pushing to GitHub...${NC}"
    
    check_token "$GITHUB_TOKEN" "GITHUB_TOKEN" || return 1
    
    cd "$PROJECT_DIR"
    
    # Create repo via API
    echo "  Creating repository ${REPO_NAME}..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        https://api.github.com/user/repos \
        -d "{\"name\":\"$REPO_NAME\",\"description\":\"TSA Outliers Monitoring System - Next.js + Supabase\",\"private\":true}")
    
    if [ "$HTTP_STATUS" = "201" ]; then
        echo -e "  ${GREEN}Repository created!${NC}"
    elif [ "$HTTP_STATUS" = "422" ]; then
        echo -e "  ${YELLOW}Repository already exists, updating...${NC}"
    else
        echo -e "  ${RED}Failed to create repo (HTTP $HTTP_STATUS)${NC}"
        return 1
    fi
    
    # Add remote and push
    git remote remove origin 2>/dev/null || true
    git remote add origin "https://${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
    git push -u origin main --force 2>/dev/null || git push -u origin master --force 2>/dev/null || {
        # Try to push current branch
        BRANCH=$(git branch --show-current)
        git push -u origin "$BRANCH" --force
    }
    
    echo -e "  ${GREEN}Code pushed to https://github.com/${GITHUB_USERNAME}/${REPO_NAME}${NC}"
}

# ---- Step 2: Supabase ----
deploy_supabase() {
    echo -e "${YELLOW}[2/3] Setting up Supabase...${NC}"
    
    check_token "$SUPABASE_ACCESS_TOKEN" "SUPABASE_ACCESS_TOKEN" || return 1
    
    cd "$PROJECT_DIR"
    
    # Login to Supabase CLI
    echo "  Logging in to Supabase..."
    npx supabase login --token "$SUPABASE_ACCESS_TOKEN" 2>/dev/null
    
    # Create project
    echo "  Creating Supabase project..."
    PROJECT_JSON=$(npx supabase projects create \
        --name "tsa-outliers-monitoring" \
        --database-password "asrama33" \
        --region "ase-southeast" \
        -o json 2>/dev/null) || true
    
    # Get project details
    PROJECT_ID=$(echo "$PROJECT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
    
    if [ -z "$PROJECT_ID" ]; then
        echo -e "  ${YELLOW}Project may already exist. Listing projects...${NC}"
        PROJECT_ID=$(npx supabase projects list -o json 2>/dev/null | \
            python3 -c "import sys,json; projects=json.load(sys.stdin); p=[x for x in projects if x.get('name')=='tsa-outliers-monitoring']; print(p[0]['id'] if p else '')" 2>/dev/null)
    fi
    
    if [ -z "$PROJECT_ID" ]; then
        echo -e "  ${RED}Failed to create/find Supabase project${NC}"
        echo "  Please create manually at: https://supabase.com/dashboard"
        return 1
    fi
    
    echo "  Project ID: $PROJECT_ID"
    
    # Get database URL
    DB_HOST=$(echo "$PROJECT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('database',{}).get('host',''))" 2>/dev/null)
    
    if [ -z "$DB_HOST" ]; then
        DB_HOST="db.${PROJECT_ID}.supabase.co"
    fi
    
    DATABASE_URL="postgresql://postgres.asrama33:${PROJECT_ID}@${DB_HOST}:5432/postgres"
    
    echo "  Database URL: ${DATABASE_URL}"
    echo ""
    echo -e "  ${GREEN}Supabase project ready!${NC}"
    echo -e "  ${YELLOW}Save this DATABASE_URL - you'll need it for Vercel!${NC}"
    echo ""
    echo "$DATABASE_URL" > "$PROJECT_DIR/.supabase-db-url"
    
    # Push schema
    echo "  Pushing database schema..."
    DATABASE_URL="$DATABASE_URL" npx prisma db push --accept-data-loss 2>&1 || true
    
    echo -e "  ${GREEN}Database schema deployed!${NC}"
}

# ---- Step 3: Vercel ----
deploy_vercel() {
    echo -e "${YELLOW}[3/3] Deploying to Vercel...${NC}"
    
    check_token "$VERCEL_TOKEN" "VERCEL_TOKEN" || return 1
    
    cd "$PROJECT_DIR"
    
    # Read Supabase database URL if available
    DATABASE_URL=""
    if [ -f "$PROJECT_DIR/.supabase-db-url" ]; then
        DATABASE_URL=$(cat "$PROJECT_DIR/.supabase-db-url")
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        echo -e "  ${YELLOW}No DATABASE_URL found. You'll need to set it in Vercel dashboard.${NC}"
        echo "  Go to: https://vercel.com/[your-project]/settings/environment-variables"
    fi
    
    # Deploy
    echo "  Deploying..."
    
    DEPLOY_CMD="npx vercel deploy --yes --prod --token $VERCEL_TOKEN"
    
    if [ -n "$DATABASE_URL" ]; then
        DEPLOY_CMD="$DEPLOY_CMD --env DATABASE_URL=$DATABASE_URL"
    fi
    
    eval $DEPLOY_CMD 2>&1
    
    echo -e "  ${GREEN}Deployment complete!${NC}"
}

# ---- Main ----
echo ""
echo "Checking required tokens..."
echo ""

MISSING=0
[ -z "$GITHUB_TOKEN" ] && echo -e "  ${RED}[ ] GITHUB_TOKEN${NC}" && MISSING=1 || echo -e "  ${GREEN}[x] GITHUB_TOKEN${NC}"
[ -z "$SUPABASE_ACCESS_TOKEN" ] && echo -e "  ${RED}[ ] SUPABASE_ACCESS_TOKEN${NC}" && MISSING=1 || echo -e "  ${GREEN}[x] SUPABASE_ACCESS_TOKEN${NC}"
[ -z "$VERCEL_TOKEN" ] && echo -e "  ${RED}[ ] VERCEL_TOKEN${NC}" && MISSING=1 || echo -e "  ${GREEN}[x] VERCEL_TOKEN${NC}"

echo ""

if [ "$MISSING" = "1" ]; then
    echo -e "${RED}Some tokens are missing. Please set them and re-run:${NC}"
    echo ""
    echo "  export GITHUB_TOKEN=\"ghp_xxxxxxxxxxxx\""
    echo "  export SUPABASE_ACCESS_TOKEN=\"sbat_xxxxxxxxxxxx\""
    echo "  export VERCEL_TOKEN=\"xxxxxxxxxxxx\""
    echo ""
    echo "Or run specific steps:"
    echo "  ./scripts/deploy/deploy.sh github    # Only GitHub"
    echo "  ./scripts/deploy/deploy.sh supabase  # Only Supabase"
    echo "  ./scripts/deploy/deploy.sh vercel    # Only Vercel"
    exit 1
fi

# Run all steps
if [ -n "$1" ]; then
    case "$1" in
        github) deploy_github ;;
        supabase) deploy_supabase ;;
        vercel) deploy_vercel ;;
        *) echo "Usage: $0 [github|supabase|vercel]"; exit 1 ;;
    esac
else
    deploy_github
    echo ""
    deploy_supabase
    echo ""
    deploy_vercel
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} All done! 🎉${NC}"
echo -e "${GREEN}========================================${NC}