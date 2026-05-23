# GitHub Infrastructure Backup

This document serves as a backup reference for how the Beyblade Battle Bot source code is managed and deployed through GitHub.

## 1. Repository Details
* **Repository URL:** `https://github.com/Dr-sOuL7/beyblade-battle`
* **Primary Branch:** `main`
* **Account:** `Dr-sOuL7`

## 2. CI/CD Pipeline (Vercel Integration)
Vercel is directly connected to this GitHub repository. The deployment pipeline works as follows:
1. Whenever a commit is pushed to the `main` branch (e.g., using `git push`), GitHub sends a webhook to Vercel.
2. Vercel automatically pulls the latest code from the `main` branch.
3. Vercel builds the Next.js application and deploys the new version instantly.

**To trigger a new deployment manually:**
You do not need to log into Vercel. Simply commit your code locally and push it:
```bash
git add .
git commit -m "Your update message"
git push
```

## 3. Local Git Configuration
If you ever need to clone this repository to a new computer, use the following command:
```bash
git clone https://github.com/Dr-sOuL7/beyblade-battle.git
```

If GitHub prompts for a password during command-line operations, remember that you must use your **GitHub Personal Access Token (PAT)** instead of your account password, as GitHub no longer supports password authentication for Git commands.
