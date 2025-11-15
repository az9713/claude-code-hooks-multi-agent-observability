# Installation Guide - Multi-Agent Observability System

**Complete step-by-step installation instructions for absolute beginners**

This guide assumes you have ZERO prior experience with command-line tools, programming, or development environments. Every step is explained in detail.

---

## Table of Contents

- [What is This?](#what-is-this)
- [Before You Start](#before-you-start)
- [Step 1: Install Prerequisites](#step-1-install-prerequisites)
- [Step 2: Get Your API Key](#step-2-get-your-api-key)
- [Step 3: Download the Project](#step-3-download-the-project)
- [Step 4: Install Dependencies](#step-4-install-dependencies)
- [Step 5: Configure the System](#step-5-configure-the-system)
- [Step 6: Start the System](#step-6-start-the-system)
- [Step 7: Verify Installation](#step-7-verify-installation)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

---

## What is This?

The Multi-Agent Observability System lets you see what AI agents (like Claude Code) are doing in real-time. It's like a dashboard that shows:
- What files the AI is reading
- What commands it's running
- How much it costs to use
- If tools are working or failing

Think of it like a security camera for your AI assistant!

---

## Before You Start

### What You'll Need

- **Computer**: Windows, macOS, or Linux
- **Internet connection**: For downloading software
- **Time**: About 30-45 minutes
- **Space**: About 500MB of disk space

### What You'll Learn

By the end of this guide, you'll know how to:
1. Use a terminal/command line
2. Install development tools
3. Configure API keys
4. Start and stop servers
5. Access web-based dashboards

---

## Step 1: Install Prerequisites

You need to install 4 tools before you can use the observability system. Don't worry - we'll walk through each one!

### 1.1: Install Claude Code

**What it is:** Claude Code is Anthropic's AI coding assistant that runs in your terminal.

**macOS / Linux:**

1. Open "Terminal" (search for it in Spotlight or Applications)
2. Copy this command:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/anthropics/claude-code/main/install.sh | sh
   ```
3. Press Enter
4. Wait for it to finish (you'll see "Installation complete!")
5. Close and reopen Terminal
6. Type `claude --version` and press Enter
7. You should see a version number (like "v1.5.0")

**Windows:**

1. Download from: https://docs.anthropic.com/en/docs/claude-code
2. Follow the Windows installer instructions
3. Open "Command Prompt" or "PowerShell"
4. Type `claude --version` and press Enter
5. You should see a version number

**What if it doesn't work?**
- Make sure you have administrator/sudo permissions
- Check the Claude Code documentation: https://docs.anthropic.com/en/docs/claude-code
- Come back here once it's installed

---

### 1.2: Install Astral uv (Python Package Manager)

**What it is:** A tool that manages Python packages. It's much faster than pip and handles dependencies automatically.

**macOS / Linux:**

1. Open Terminal
2. Copy this command:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```
3. Press Enter
4. Wait for installation to complete
5. Close and reopen Terminal
6. Type `uv --version` and press Enter
7. You should see something like "uv 0.1.0"

**Windows (PowerShell):**

1. Right-click Start Menu → "Windows PowerShell (Admin)"
2. Copy this command:
   ```powershell
   irm https://astral.sh/uv/install.ps1 | iex
   ```
3. Press Enter
4. Wait for installation
5. Close and reopen PowerShell
6. Type `uv --version` and press Enter

**Verification:**
```bash
uv --version
# Should output: uv 0.x.x or similar
```

---

### 1.3: Install Bun (JavaScript Runtime)

**What it is:** A fast JavaScript runtime that will run our server and client applications.

**macOS / Linux:**

1. Open Terminal
2. Copy this command:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
3. Press Enter
4. Wait for installation
5. Close and reopen Terminal
6. Type `bun --version` and press Enter
7. You should see something like "1.0.0"

**Windows:**

1. Visit: https://bun.sh
2. Download the Windows installer
3. Run the installer
4. Follow the setup wizard
5. Open PowerShell
6. Type `bun --version` and press Enter

**Verification:**
```bash
bun --version
# Should output: 1.x.x or similar
```

---

### 1.4: Install Git

**What it is:** A version control system used to download and manage code.

**Check if you already have it:**
```bash
git --version
```

If you see a version number, skip this section!

**macOS:**
```bash
# Install Xcode Command Line Tools
xcode-select --install
```
Click "Install" when the popup appears.

**Windows:**
1. Go to: https://git-scm.com/download/win
2. Download the installer
3. Run the installer (use all default options)
4. Open Command Prompt
5. Type `git --version`

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install git
```

**Linux (Fedora/RHEL):**
```bash
sudo yum install git
```

**Verification:**
```bash
git --version
# Should output: git version 2.x.x
```

---

## Step 2: Get Your API Key

To use Claude, you need an API key from Anthropic.

### 2.1: Create Anthropic Account

1. Go to: https://console.anthropic.com
2. Click "Sign Up" (top right)
3. Enter your email and create a password
4. Check your email for verification
5. Click the verification link

### 2.2: Get Your API Key

1. Log into https://console.anthropic.com
2. Click "API Keys" in the left sidebar
3. Click "Create Key"
4. Give it a name like "observability-system"
5. Click "Create"
6. **IMPORTANT:** Copy the key NOW - you can't see it again!
7. It looks like: `sk-ant-api03-...` (very long)

### 2.3: Save Your API Key

**macOS / Linux (using .bashrc):**

1. Open Terminal
2. Type this command (replace YOUR-KEY with your actual key):
   ```bash
   echo 'export ANTHROPIC_API_KEY="sk-ant-YOUR-KEY-HERE"' >> ~/.bashrc
   ```
3. Press Enter
4. Then type:
   ```bash
   source ~/.bashrc
   ```
5. Verify it worked:
   ```bash
   echo $ANTHROPIC_API_KEY
   ```
   You should see your key!

**macOS (using .zshrc) - if you use zsh:**

1. Open Terminal
2. Type this command:
   ```bash
   echo 'export ANTHROPIC_API_KEY="sk-ant-YOUR-KEY-HERE"' >> ~/.zshrc
   ```
3. Press Enter
4. Then type:
   ```bash
   source ~/.zshrc
   ```
5. Verify:
   ```bash
   echo $ANTHROPIC_API_KEY
   ```

**Windows (PowerShell):**

1. Open PowerShell as Administrator
2. Type this command:
   ```powershell
   [System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'sk-ant-YOUR-KEY-HERE', 'User')
   ```
3. Close and reopen PowerShell
4. Verify:
   ```powershell
   echo $env:ANTHROPIC_API_KEY
   ```

---

## Step 3: Download the Project

### 3.1: Choose a Location

First, decide where to put the project. We recommend your home directory:

**macOS / Linux:**
```bash
cd ~
```

**Windows:**
```powershell
cd $HOME
```

### 3.2: Clone the Repository

Now download the project using Git:

```bash
git clone https://github.com/YOUR-USERNAME/claude-code-hooks-multi-agent-observability.git
```

**What this does:** Downloads all the project files to your computer.

### 3.3: Enter the Project Directory

```bash
cd claude-code-hooks-multi-agent-observability
```

**Verify you're in the right place:**
```bash
ls
```

You should see folders like: `apps/`, `.claude/`, `docs/`, `scripts/`, etc.

---

## Step 4: Install Dependencies

Now we need to install all the code libraries (dependencies) that the project needs.

### 4.1: Install Server Dependencies

The server handles data storage and API requests.

```bash
# Go to the server directory
cd apps/server

# Install dependencies using Bun
bun install
```

**What you'll see:**
- A progress bar
- List of packages being installed
- "✨ Done in X.Xs" when finished

**If you get errors:**
- Make sure you're in the `apps/server` directory
- Make sure Bun is installed (`bun --version`)
- Try running `bun install` again

### 4.2: Install Client Dependencies

The client is the web interface you'll see in your browser.

```bash
# Go to the client directory
cd ../client

# Install dependencies
bun install
```

**What you'll see:**
- Similar to server installation
- Many packages being downloaded
- "✨ Done" when complete

### 4.3: Return to Project Root

```bash
# Go back to the main project folder
cd ../..

# Verify you're in the root
pwd
```

You should see a path ending in `claude-code-hooks-multi-agent-observability`

---

## Step 5: Configure the System

### 5.1: Create Environment File

We need to create a file that stores your API key and other settings.

```bash
# Copy the example file
cp .env.sample .env
```

### 5.2: Edit the Environment File

Now we need to add your actual API key to this file.

**Using nano (easiest for beginners):**

```bash
nano .env
```

**What you'll see:** A text editor in your terminal.

**What to do:**
1. You'll see: `ANTHROPIC_API_KEY=your-api-key-here`
2. Use arrow keys to move to `your-api-key-here`
3. Delete it (use backspace)
4. Type your actual API key (the one starting with `sk-ant-`)
5. Add your name on the next line:
   ```
   ENGINEER_NAME=Your Name
   ```
6. Press `Ctrl+X` to exit
7. Press `Y` to confirm saving
8. Press `Enter` to keep the filename

**Using Visual Studio Code (if installed):**

```bash
code .env
```

Then edit the file in VS Code and save.

**The file should look like:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-ACTUAL-KEY-HERE
ENGINEER_NAME=Your Name
```

### 5.3: Verify Configuration

```bash
cat .env
```

You should see your API key and name displayed.

**IMPORTANT:** Never share this .env file - it contains your private API key!

---

## Step 6: Start the System

Now for the exciting part - starting everything up!

### 6.1: Make the Start Script Executable

```bash
# Make the script runnable
chmod +x scripts/start-system.sh
```

**What this does:** Gives permission to run the startup script.

### 6.2: Start the System

```bash
# Run the start script
./scripts/start-system.sh
```

**What you'll see:**

```
🚀 Starting Multi-Agent Observability System
===========================================

Configuration:
  Server Port: 4000
  Client Port: 5173

Checking for existing server on port 4000...
✅ Port 4000 is available

Checking for existing client on port 5173...
✅ Port 5173 is available

Starting server on port 4000...
Waiting for server to start...
✅ Server is ready!

Starting client on port 5173...
Waiting for client to start...
✅ Client is ready!

============================================
✅ Multi-Agent Observability System Started
============================================

🖥️  Client URL: http://localhost:5173
🔌 Server API: http://localhost:4000
📡 WebSocket: ws://localhost:4000/stream

📝 Process IDs:
   Server PID: 12345
   Client PID: 12346

To stop the system, run: ./scripts/reset-system.sh
Press Ctrl+C to stop both processes
```

**Leave this terminal window open!** The system is running here.

---

## Step 7: Verify Installation

### 7.1: Open the Web Interface

1. Open your web browser (Chrome, Firefox, Safari, Edge)
2. Go to: **http://localhost:5173**
3. You should see the "Multi-Agent Observability" dashboard
4. Look for "Connected" status in green (top right)

**What you should see:**
- A dark/light theme toggle
- Filter panel on the left
- Empty event timeline (no events yet - that's normal!)
- Live pulse chart at the bottom

### 7.2: Test the Server API

Open a new terminal window (keep the first one running!) and test:

```bash
curl http://localhost:4000/events/filter-options
```

**Expected response:**
```json
{
  "source_apps": [],
  "session_ids": [],
  "hook_event_types": []
}
```

This is empty because we haven't sent any events yet. That's perfect!

### 7.3: Test with a Simple Command

Now let's create some events!

1. Open another new terminal window
2. Create a test directory:
   ```bash
   mkdir ~/test-observability
   cd ~/test-observability
   git init
   ```

3. Copy the hooks to this directory:
   ```bash
   cp -R ~/claude-code-hooks-multi-agent-observability/.claude .
   ```

4. Start Claude:
   ```bash
   claude
   ```

5. In Claude, type:
   ```
   List all files in this directory using git ls-files
   ```

6. Go back to your web browser (http://localhost:5173)

7. **You should now see events appearing!**
   - UserPromptSubmit event (your question)
   - PreToolUse event (Claude preparing to use a tool)
   - PostToolUse event (Claude finished using the tool)
   - Stop event (Claude finished responding)

**Congratulations! Your system is working!** 🎉

---

## Troubleshooting

### Problem: "Command not found" errors

**Solution:**
- Make sure you've installed all prerequisites (Step 1)
- Try closing and reopening your terminal
- Verify each tool is installed:
  ```bash
  claude --version
  uv --version
  bun --version
  git --version
  ```

### Problem: "Permission denied" when running scripts

**Solution:**
```bash
chmod +x scripts/start-system.sh
chmod +x scripts/reset-system.sh
```

### Problem: "Port already in use"

**Solution:** Something else is using ports 4000 or 5173.

**Find what's using the port (macOS/Linux):**
```bash
lsof -i :4000
lsof -i :5173
```

**Find what's using the port (Windows):**
```powershell
netstat -ano | findstr :4000
netstat -ano | findstr :5173
```

**Kill the process or change ports:**
Edit `apps/server/src/index.ts` and `apps/client/vite.config.ts` to use different ports.

### Problem: Client shows "Disconnected"

**Solutions:**
1. Make sure the server is running (check terminal where you ran start-system.sh)
2. Refresh the browser page
3. Check server logs for errors
4. Restart the system:
   ```bash
   ./scripts/reset-system.sh
   ./scripts/start-system.sh
   ```

### Problem: Events not appearing

**Check:**
1. Are hooks configured in `.claude/settings.json`?
2. Is the observability server running?
3. Test the server:
   ```bash
   curl http://localhost:4000/events/filter-options
   ```
4. Check browser console for errors (F12 → Console tab)

### Problem: API key not working

**Solutions:**
1. Verify the key is correct in `.env` file
2. Make sure there are no extra spaces
3. Key should start with `sk-ant-api`
4. Try regenerating the key at https://console.anthropic.com

---

## Next Steps

### Learn More

Now that it's installed, learn how to use it:

1. **Read the Getting Started Guide:**
   ```bash
   cat docs/GETTING_STARTED.md
   ```
   Or open in browser: `docs/GETTING_STARTED.md`

2. **Explore the Dashboard:**
   - Try different filters
   - Click on events to see details
   - View chat transcripts
   - Check out the token metrics
   - Explore tool analytics

3. **Set Up Multiple Projects:**
   - Copy `.claude` folder to other projects
   - Change the `source-app` name in settings.json
   - Monitor multiple agents simultaneously

### Watch Videos

- [Full System Breakdown](https://youtu.be/9ijnN985O_c)
- [Model Comparison Tutorial](https://youtu.be/aA9KP7QIQvM)

### Join the Community

- Ask questions in GitHub Issues
- Share your setup on YouTube
- Contribute improvements

---

## Stopping the System

When you're done:

```bash
# In the terminal where it's running
Ctrl+C

# Or run the reset script
./scripts/reset-system.sh
```

---

## Uninstalling

If you want to remove everything:

```bash
# Stop the system
./scripts/reset-system.sh

# Remove the project folder
cd ~
rm -rf claude-code-hooks-multi-agent-observability

# Remove environment variable (optional)
# Edit ~/.bashrc or ~/.zshrc and remove the ANTHROPIC_API_KEY line
```

---

## Getting Help

**Documentation:**
- README.md - Overview
- GETTING_STARTED.md - Beginner tutorial
- API_REFERENCE.md - Technical API docs
- TROUBLESHOOTING.md - Common issues

**Online:**
- GitHub Issues: Report bugs and ask questions
- YouTube: Watch tutorials
- Discord: Chat with other users (if available)

**Emergency Contact:**
If nothing works, create a GitHub issue with:
1. Your operating system (Windows/macOS/Linux)
2. What step failed
3. The exact error message
4. What you've already tried

---

## Summary Checklist

Before using the system, verify:

- ✅ Claude Code installed (`claude --version`)
- ✅ Astral uv installed (`uv --version`)
- ✅ Bun installed (`bun --version`)
- ✅ Git installed (`git --version`)
- ✅ API key saved (`echo $ANTHROPIC_API_KEY`)
- ✅ Project downloaded
- ✅ Dependencies installed (server & client)
- ✅ .env file configured
- ✅ System starts without errors
- ✅ Web interface accessible (http://localhost:5173)
- ✅ Events appear when using Claude

**All checked? You're ready to go!** 🚀

---

*Last updated: 2025-01-15*
*For the latest version, visit: https://github.com/YOUR-ORG/claude-code-hooks-multi-agent-observability*
