# How to Build Your AI Assistant — VPS Setup Guide
*Everything done from the command line. No GUI required. Read each step fully before running it.*

---

## What You're Building

A personal AI assistant that:
- Runs 24/7 on a cloud server (VPS)
- You talk to it via **WhatsApp**
- It can write and deploy live web apps via GitHub + Render
- It remembers context between sessions

---

## Before You Start — Accounts to Create First

Do this on your laptop or phone **before** touching the terminal.

| Account | URL | What you'll need |
|---|---|---|
| VPS Host | Hetzner, Hostinger, or DigitalOcean | Server IP address |
| Anthropic | https://console.anthropic.com | API key (starts with `sk-ant-...`) |
| GitHub | https://github.com | A personal access token (you'll create this in Part 12) |
| Render | https://render.com | An API key (you'll create this in Part 13) |
| WhatsApp | On your phone | A spare phone number not already linked to WhatsApp |

> ⚠️ **Anthropic billing — do this now:** New accounts are on Tier 1 (30,000 tokens/minute). You **must** add at least **$100 in credit** at [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) before your first message. This automatically upgrades you to Tier 2 (100,000 tokens/minute) and is the single most important thing you can do to avoid slowdowns. Without it you'll hit rate limit errors constantly.

---

## PART 1: Create Your VPS

Choose any VPS provider. Recommended specs:

- **OS:** Ubuntu 22.04 or 24.04
- **RAM:** 2 GB minimum (4 GB recommended)
- **Cost:** ~$4–6/month (e.g. Hetzner CX22, Hostinger KVM 2, DigitalOcean Basic)

Once your server is created, copy the **Public IP address** from your provider's dashboard. You'll need it in the next step.

---

## PART 2: Connect to Your VPS

**Everything from here runs on your VPS — not your local computer.**
Your local terminal is just the doorway.

**On Mac or Linux** — open Terminal:
```bash
ssh root@YOUR_SERVER_IP
```

**On Windows** — open **PowerShell** (press Win+X → click Terminal or PowerShell):
```
ssh root@YOUR_SERVER_IP
```

> Type `yes` when asked about the fingerprint. You're now inside your server. Every command below runs here.

---

## PART 3: Update the Server

```bash
apt update && apt upgrade -y
```

Wait 1–2 minutes. This keeps your server secure and up to date.

---

## PART 4: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version
```

You should see `v22.x.x`. That's correct.

---

## PART 5: Install OpenClaw

```bash
npm install -g openclaw
openclaw --version
```

---

## PART 6: Run the Setup Wizard

```bash
openclaw onboard
```

The wizard walks you through setup step by step:

1. **"Where will the Gateway run?"** → select **Local (this machine)**
2. **Anthropic API key** → paste your `sk-ant-...` key directly into the terminal (never via WhatsApp)
3. **Default model** → press Enter to accept the default
4. **Workspace directory** → press Enter to accept the default
5. A gateway token is generated automatically — you don't need to do anything

When asked **"How do you want to hatch your bot?"** → select **Hatch in TUI (recommended)** → press Enter.

The terminal interface opens. Your assistant is now online.

---

## PART 7: Authorize Your Phone Number

In the terminal (or open a new SSH session), run:

```bash
openclaw configure --section auth
```

Enter your WhatsApp phone number in international format: `+16202108235`

---

## PART 8: Connect WhatsApp

```bash
openclaw configure --section whatsapp
```

A QR code appears in your terminal.

On your phone:
1. Open **WhatsApp**
2. Tap the **three dots** (top right) → **Linked Devices**
3. Tap **Link a Device**
4. Point your camera at the QR code

> If the QR code looks garbled or cut off, make your terminal font smaller (Ctrl+- on most terminals) so the full code fits on screen.

---

## PART 9: Start the Gateway

```bash
openclaw gateway start
openclaw gateway status
```

You should see `running`. Send yourself a WhatsApp message to test — your assistant should respond.

---

## PART 10: Make It Survive Reboots

**Do not skip this.** Without it, your assistant stops every time the server restarts.

```bash
# Step 1 — Install the service file
openclaw gateway install

# Step 2 — Enable and start it
systemctl --user enable openclaw-gateway
systemctl --user start openclaw-gateway

# Step 3 — Allow it to run even when you're logged out
loginctl enable-linger root

# Step 4 — Confirm it's running
systemctl --user status openclaw-gateway
```

You should see **`Active: active (running)`** in green. ✅

> **Note:** Always use `openclaw-gateway` (with the dash) in systemctl commands — not just `openclaw`.

---

## PART 11: Introduce Yourself

Switch to WhatsApp and say:

```
Your name is [PICK A NAME]
My name is [YOUR NAME]
```

Your assistant will remember this going forward.

---

## PART 12: Add Your GitHub Token

**In your browser:**
1. Go to **https://github.com/settings/tokens/new** — this takes you directly to the right page
2. Give it any name (e.g. `AI Assistant`)
3. Set expiration to **No expiration**
4. Check the **repo** box — that's all you need
5. Scroll down → click **Generate token**
6. Copy the token — it starts with `ghp_`

> ⚠️ This is the only time GitHub shows you this token. Copy it now.

**In your terminal** (on the VPS):
```bash
nano ~/.openclaw/workspace/.env
```

Add this line (replace with your actual token):
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxx
```

Press **Ctrl+X → Y → Enter** to save.

**Then tell your assistant** (in WhatsApp):
```
My GitHub token is saved in ~/.openclaw/workspace/.env
My GitHub username is [YOUR_GITHUB_USERNAME]
```

> ⚠️ Never paste tokens into WhatsApp or any chat. Terminal only.

---

## PART 13: Add Your Render API Key

**In your browser:**
1. Go to **https://dashboard.render.com/u/settings/api-keys**
2. Click **Create API Key**
3. Name it `AI Assistant`
4. Copy the key — it starts with `rnd_`

**In your terminal:**
```bash
nano ~/.openclaw/workspace/.env
```

Add this line below the GitHub token:
```
RENDER_TOKEN=rnd_xxxxxxxxxxxxxxxxx
```

Press **Ctrl+X → Y → Enter** to save.

**Then tell your assistant** (in WhatsApp):
```
My Render token is also saved in ~/.openclaw/workspace/.env
```

---

## PART 14: Test Everything

In WhatsApp, ask:
```
Can you create a test GitHub repo called "hello-world" for me?
```

If it creates the repo — everything is working. 🎉

---

## PART 15: Deploy Apps to Render

When your assistant builds a web app and you're ready to deploy it:

1. Go to **render.com** → **New → Web Service**
2. Connect your GitHub repo
3. Set **Build Command** and **Start Command** as your assistant specifies
4. Choose **Starter ($7/month)** — NOT Free (Free tier doesn't support persistent storage, so your data gets wiped on restart)
5. Under **Disks**, add a disk:
   - Mount path: `/var/data`
   - Size: 1 GB
6. Under **Environment**, add:
   - Key: `DB_PATH` / Value: `/var/data/your-app.db`
7. Click **Deploy**

---

## Useful Commands (for later reference)

```bash
# Check if your assistant is running
systemctl --user status openclaw-gateway

# Restart it
systemctl --user restart openclaw-gateway

# View live logs
openclaw gateway logs
# (press Ctrl+C to stop)

# Stop it
systemctl --user stop openclaw-gateway

# Update OpenClaw
npm update -g openclaw
```

---

## Troubleshooting

**WhatsApp disconnected or not responding:**
```bash
systemctl --user restart openclaw-gateway
# Then re-scan the QR code:
openclaw configure --section whatsapp
```

**"API rate limit reached" error:**
You're on Tier 1. Add credit at [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) — $100 gets you to Tier 2. In the meantime, wait 60 seconds and try again.

**"Command not found":**
```bash
node --version    # Should show v22.x.x
npm install -g openclaw
```

**Render deploy fails with "No such file or directory":**
Make sure the Root Directory on Render is blank (not set), and your Build/Start Commands use `cd your-folder-name &&` before the npm commands.

**Server out of memory:**
```bash
free -h
```
Upgrade your VPS if RAM is consistently above 80%. The next tier is usually ~$8–10/month.

---

## Cost Summary

| Item | Monthly Cost |
|---|---|
| VPS (Hetzner CX22 / Hostinger KVM 2) | ~$4–6 |
| Anthropic API (Claude) | ~$5–20 |
| Render Starter (per app) | $7 |
| GitHub | Free |
| Extra phone number (optional) | ~$1–3 |
| **Total** | **~$17–36/month** |

---

## How It All Connects

```
You → WhatsApp → OpenClaw Gateway (on VPS) → Claude AI (Anthropic)
                        ↓
              GitHub (code storage) + Render (live web apps)
```

---

*Guide revised: February 2026*
*Corrections: fixed gateway install command, systemctl unit name, token storage method, added Render disk setup, Tier 2 billing guidance*
