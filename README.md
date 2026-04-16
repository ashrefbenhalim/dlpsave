# dlpsave - Local Video & Audio Downloader

A simple, private, 100% local video and audio downloader. No cloud, no tracking, no limits.

## Setup Instructions

### 1. Install Requirements

- Download and install **Node.js** (LTS version): [nodejs.org](https://nodejs.org)

### 2. Install yt-dlp and ffmpeg

Open **Command Prompt** and run:

```cmd
winget install yt-dlp
winget install ffmpeg
```

### 3. Clone and Run the Project (First Time)

1. Create an empty folder.  
2. Open the folder → click the path bar → type `cmd` and press Enter.  
3. Run:

```cmd
git clone https://github.com/ashrefbenhalim/dlpsave.git
cd dlpsave
npm install
node app
```

### 4. Launch the App (Every Time)

1. Open the `dlpsave` folder.  
2. Click the path bar → type `cmd` and press Enter.  
3. Run:

```cmd
node app
```

Then open your browser and go to:

```
http://localhost:5000
```

### Test Accounts

| Role   | Email                | Password |
|--------|----------------------|----------|
| Normal | test@example.com     | 123      |
| Admin  | admin@dlwip.com      | admin    |

**Note:** Everything (SQLite database + downloads folder) is created automatically on first run. No extra configuration needed.

---

**Features**
- Download YouTube videos and audio.
- Audio (MP3) or Video (MP4) with quality selection
- Playlist support (requires login)
- Album cover embedding for MP3 files (requires login)
- Personal download history per user
- Admin can view all users' history

---

**Tech used**
- Frontend: HTML, Bootstrap 5, JavaScript
- Backend: Node.js + Express
- Database: SQLite
- Downloader: yt-dlp + ffmpeg

---

Made as an end-of-year project - completely local and private.
