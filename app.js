const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = 5000;
const DOWNLOAD_FOLDER = 'downloads';

app.use(express.static('.'));
app.use(express.json());

if (!fs.existsSync(DOWNLOAD_FOLDER)) fs.mkdirSync(DOWNLOAD_FOLDER);

// Open SQLite database (creates the file automatically)
const db = new Database('history.db');

// Create tables if they don't exist yet
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    is_admin INTEGER DEFAULT 0
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    url TEXT,
    title TEXT,
    type TEXT,
    quality TEXT,
    useCover INTEGER,
    time TEXT,
    file TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// For now we use a single demo user (id = 1) so everything works exactly like before
const DEMO_USER_ID = 1;

const downloadProgress = new Map();

// This function returns the current progress for a download
app.get('/api/progress/:id', (req, res) => {
    const id = req.params.id;
    const prog = downloadProgress.get(id) || { percent: 0 };
    res.json({ percent: prog.percent });
});

// This function gets basic info about a video from yt-dlp
app.post('/api/info', (req, res) => {
    const url = req.body.url.trim();
    const yt = spawn('yt-dlp', ['--dump-json', url], { shell: false });
    let stdout = '';
    yt.stdout.on('data', data => stdout += data);
    yt.on('close', () => {
        try {
            const info = JSON.parse(stdout);
            res.json({
                title: info.title || 'Unknown Title',
                duration: `${Math.floor(info.duration/60)}:${(info.duration%60).toString().padStart(2,'0')}`,
                thumbnail: info.thumbnail || 'https://via.placeholder.com/340x190/111/eee?text=No+Thumbnail',
                site: info.extractor_key || 'Video'
            });
        } catch (e) {
            res.status(400).json({ error: 'Could not read video info' });
        }
    });
});

// This function starts the actual download with yt-dlp
app.post('/api/download', (req, res) => {
    const { url, type, quality, title = 'Unknown', useCover = false, isPlaylist = false, downloadId } = req.body;
    const id = downloadId || `dl-${Date.now()}`;

    downloadProgress.set(id, { percent: 0 });
    res.json({ success: true, downloadId: id });

    let args = ['--output', `${DOWNLOAD_FOLDER}/%(title)s.%(ext)s`];

    if (type === 'MP3') {
        let aq = '0';
        if (quality.includes('320')) aq = '0';
        else if (quality.includes('256')) aq = '1';
        else if (quality.includes('192')) aq = '2';
        else if (quality.includes('128')) aq = '4';

        args.push('-x', '--audio-format', 'mp3', '--audio-quality', aq);
        if (useCover) args.push('--embed-thumbnail', '--convert-thumbnails', 'jpg');
    } 
    else {
        let format = 'bestvideo+bestaudio/best';
        if (quality.includes('1080')) format = 'bestvideo[height<=1080]+bestaudio/best';
        else if (quality.includes('720')) format = 'bestvideo[height<=720]+bestaudio/best';
        else if (quality.includes('480')) format = 'bestvideo[height<=480]+bestaudio/best';
        else if (quality.includes('360')) format = 'bestvideo[height<=360]+bestaudio/best';
        else if (quality.includes('240')) format = 'bestvideo[height<=240]+bestaudio/best';

        args.push('-f', format, '--merge-output-format', 'mp4');
    }

    if (!isPlaylist) args.push('--no-playlist');

    args.push(url);

    const ytDlp = spawn('yt-dlp', args, { shell: false });

    ytDlp.stdout.on('data', (chunk) => {
        const line = chunk.toString();
        const match = line.match(/\[download\]\s+(\d+\.\d+)%/);
        if (match) {
            const percent = Math.round(parseFloat(match[1]));
            const prog = downloadProgress.get(id);
            if (prog) prog.percent = percent;
        }
    });

    ytDlp.on('close', (code) => {
        const prog = downloadProgress.get(id);
        if (prog) prog.percent = (code === 0) ? 100 : 0;

        if (code === 0) {
            // Save to real SQLite database
            const stmt = db.prepare(`
                INSERT INTO history (user_id, url, title, type, quality, useCover, time, file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(
                DEMO_USER_ID,
                url,
                title,
                type,
                quality,
                useCover ? 1 : 0,
                new Date().toLocaleString('fr-TN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
                `${title}.${type === 'MP3' ? 'mp3' : 'mp4'}`
            );
        }
    });
});

// This function returns the history for the current user (demo user for now)
app.get('/api/history', (req, res) => {
    const stmt = db.prepare('SELECT * FROM history WHERE user_id = ? ORDER BY id DESC LIMIT 10');
    const history = stmt.all(DEMO_USER_ID);
    res.json(history);
});

// This function clears the entire history (for the demo user)
app.post('/api/history/clear', (req, res) => {
    const stmt = db.prepare('DELETE FROM history WHERE user_id = ?');
    stmt.run(DEMO_USER_ID);
    res.json({ success: true });
});

// This function deletes one item
app.post('/api/history/delete', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'missing id' });

    const stmt = db.prepare('DELETE FROM history WHERE id = ? AND user_id = ?');
    stmt.run(id, DEMO_USER_ID);
    res.json({ success: true });
});

// This function renames one history item (keeps the feature you wanted for grading)
app.post('/api/history/rename', (req, res) => {
    const { id, newTitle } = req.body;
    if (!id || !newTitle) return res.status(400).json({ error: 'missing data' });

    const stmt = db.prepare('UPDATE history SET title = ? WHERE id = ? AND user_id = ?');
    stmt.run(newTitle.trim(), id, DEMO_USER_ID);
    res.json({ success: true });
});

// This function gets the list of videos inside a playlist
app.post('/api/playlist-videos', (req, res) => {
    const url = req.body.url;
    const yt = spawn('yt-dlp', ['--flat-playlist', '--dump-json', url], { shell: false });
    let stdout = '';
    yt.stdout.on('data', data => stdout += data);
    yt.on('close', () => {
        try {
            const lines = stdout.trim().split('\n').filter(l => l);
            const videos = lines.map(line => {
                const data = JSON.parse(line);
                return { url: data.url, title: data.title || 'Video' };
            });
            res.json(videos);
        } catch (e) {
            res.status(400).json([]);
        }
    });
});

app.listen(PORT, () => {
    console.log(`✅ dlwip running at http://localhost:${PORT}`);
    console.log(`   Using real SQLite database (history.db)`);
    console.log(`   Everything still works exactly like before - login disabled for debug`);
});