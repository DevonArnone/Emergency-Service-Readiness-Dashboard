# Adding Project to GitHub

Follow these steps to push your Emergency Services Crew Readiness Dashboard to GitHub.

## Step 1: Create a GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `emergency-services-readiness-dashboard` (or your preferred name)
3. **Description**: "Real-time crew readiness monitoring platform for Fire, EMS, and SAR with WebSocket updates and Snowflake analytics"
4. **Visibility**: Choose Public (for portfolio) or Private
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click **Create repository**

## Step 2: Initialize Git (if not already done)

Open terminal in your project directory:

```bash
cd "/Users/devonarnone/Documents/Shift Dashboard"
```

## Step 3: Initialize Git Repository

```bash
# Initialize git repository
git init

# Add all files (respects .gitignore)
git add .

# Create initial commit
git commit -m "Initial commit: Emergency Services Crew Readiness Dashboard

- FastAPI backend with WebSocket support
- Next.js frontend with real-time updates
- Snowflake data pipeline integration
- Kafka event streaming support
- Full CRUD for personnel, units, and assignments
- Certification expiration tracking
- Real-time readiness monitoring"
```

## Step 4: Connect to GitHub

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name:

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Rename default branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

**Example:**
```bash
git remote add origin https://github.com/devonarnone/emergency-services-readiness-dashboard.git
git branch -M main
git push -u origin main
```

## Step 5: Verify on GitHub

1. Go to your repository on GitHub
2. Verify all files are present
3. Check that `.env` files and `node_modules/` are NOT visible (they're in .gitignore)

## Important: Environment Variables

**Never commit `.env` files!** They're already in `.gitignore`, but verify:

- ✅ `backend/.env` - Should NOT be in repository
- ✅ `dashboard/.env.local` - Should NOT be in repository
- ✅ `backend/.env.example` - Should be in repository (template)
- ✅ `dashboard/.env.example` - Should be in repository (template)

## Optional: Add GitHub Topics

On your GitHub repository page:
1. Click the gear icon next to "About"
2. Add topics: `fastapi`, `nextjs`, `typescript`, `python`, `snowflake`, `kafka`, `websocket`, `real-time`, `emergency-services`, `dashboard`

## Optional: Add Repository Description

Update the repository description on GitHub:
```
Real-time crew readiness monitoring platform for Fire, EMS, and SAR units. Built with FastAPI, Next.js, Snowflake, and Kafka. Features WebSocket updates, certification tracking, and automated analytics.
```

## Future Updates

When you make changes:

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Description of your changes"

# Push to GitHub
git push
```

## Troubleshooting

### "Repository not found"
- Check your GitHub username and repository name
- Verify you have access to the repository
- Make sure you're using HTTPS (or set up SSH keys)

### "Permission denied"
- You may need to authenticate with GitHub
- Use GitHub CLI: `gh auth login`
- Or use a Personal Access Token

### "Large files" warning
- `node_modules/` should be in `.gitignore` (already is)
- If you see warnings about large files, they're likely already ignored

### Want to use SSH instead?

```bash
# Change remote URL to SSH
git remote set-url origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
```

## Next Steps

1. ✅ Repository is on GitHub
2. 📝 Update README if needed
3. 🚀 Consider adding GitHub Actions for CI/CD
4. 📊 Add a license file (MIT recommended)
5. 🏷️ Add topics and description for discoverability

