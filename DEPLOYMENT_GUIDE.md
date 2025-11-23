# Deployment Guide - MailFlow AI on Render

## 🚀 Step-by-Step Deployment

### Prerequisites:
- GitHub account (free)
- Render account (free) - Sign up at [render.com](https://render.com)

---

## Step 1: Push Code to GitHub

### 1.1 Create a GitHub Repository
1. Go to [github.com](https://github.com)
2. Click **"New Repository"**
3. Name it: `mailflow-ai`
4. Make it **Private** (recommended for email app)
5. Click **"Create Repository"**

### 1.2 Push Your Code
Open terminal in your project folder and run:

```bash
git init
git add .
git commit -m "Initial commit - MailFlow AI"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mailflow-ai.git
git push -u origin main
```

*(Replace `YOUR_USERNAME` with your GitHub username)*

---

## Step 2: Deploy on Render

### 2.1 Create New Web Service
1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect GitHub"** and authorize Render
4. Select your `mailflow-ai` repository

### 2.2 Configure Service
Fill in these settings:

- **Name**: `mailflow-ai` (or any name you want)
- **Region**: Choose closest to you
- **Branch**: `main`
- **Root Directory**: Leave blank
- **Runtime**: `Python 3`
- **Build Command**: `./build.sh`
- **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### 2.3 Environment Variables (Important!)
Click **"Advanced"** → **"Add Environment Variable"**

Add these:
```
PYTHON_VERSION = 3.11
NODE_VERSION = 18
```

### 2.4 Select Plan
- Choose **"Free"** plan
- Click **"Create Web Service"**

---

## Step 3: Wait for Deployment

- Render will build your app (takes 5-10 minutes first time)
- Watch the logs for progress
- When you see: **"Your service is live 🎉"** → You're done!

---

## Step 4: Access Your App

Your app will be available at:
```
https://mailflow-ai.onrender.com
```
*(Or whatever name you chose)*

### 4.1 Configure Tracking URL
1. Open your deployed app
2. Go to **Settings** tab
3. Set **Public Tracking Domain** to your Render URL
4. Click **Save Changes**

---

## 🎉 You're Live!

Your app is now accessible from anywhere in the world!

### Next Steps:
1. Upload your recipient CSV
2. Create your email template
3. Configure SMTP settings
4. Start sending campaigns!

---

## 🔧 Updating Your App

Whenever you make changes locally:

```bash
git add .
git commit -m "Updated features"
git push
```

Render will automatically redeploy! (takes 2-3 minutes)

---

## ⚠️ Important Notes:

1. **Free tier sleeps after 15 min** - First visit takes 30 seconds
2. **Data persistence**: Files (CSV, logs, schedules) are stored temporarily
   - They reset when app redeploys
   - For permanent storage, upgrade to paid plan or use external database

3. **SMTP Credentials**: 
   - Stored in code (not ideal for production)
   - Consider using environment variables for sensitive data

---

## 🆘 Troubleshooting:

**Build fails?**
- Check build logs in Render dashboard
- Make sure `build.sh` has execute permissions

**App won't start?**
- Check runtime logs
- Verify all dependencies in `requirements.txt`

**Can't access app?**
- Wait 30 seconds (might be sleeping)
- Check Render dashboard for errors

---

## 📞 Need Help?

Check the logs in Render dashboard for detailed error messages.

---

**Enjoy your deployed MailFlow AI! 🚀**
