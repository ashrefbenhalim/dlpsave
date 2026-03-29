const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 5000;
const DOWNLOAD_FOLDER = 'downloads';
const HISTORY_FILE = 'history.json';   // still used but now per-user
const USERS_FILE = 'users.json';

app.use(express.static('.'));
app.use(express.json());

if (!fs.existsSync(DOWNLOAD_FOLDER)) fs.mkdirSync(DOWNLOAD_FOLDER);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');

// Simple in-memory session (resets when you close the server — fine for local project)
let currentUser = null;

// ====================== AUTH ======================
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Fill both fields' });

    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }

    users.push({ username, password, history: [] });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users));
    res.json({ success: true, message: 'Account created! You can now login.' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) return res.status(400).json({ error: 'Wrong username or password' });

    currentUser = username;
    res.json({ success: true, username });
});

app.get('/api/logout', (req, res) => {
    currentUser = null;
    res.json({ success: true });
});

app.get('/api/current-user', (req, res) => {
    res.json({ user: currentUser });
});

// ====================== DOWNLOAD & INFO (same as before) ======================
app.post('/api/info', (req, res) => { /* unchanged from last version */ 
    const url = req.body.url.trim();
    exec(`yt-dlp --dump-json "${url}"`, { shell: true, timeout: 15000 }, (error, stdout) => {
        if (error) return res.status(400).json({ error: error.message });
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

app.post('/api/download', (req, res) => {
    if (!currentUser) return res.status(401).json({ error: 'Please login first' });

    const { url, type, quality, title, useCover, isPlaylist } = req.body;
    let cmd = `yt-dlp --output "${DOWNLOAD_FOLDER}/%(title)s.%(ext)s"`;

    if (type === 'MP3') {
        let aq = '0';
        if (quality.includes('320')) aq = '0';
        else if (quality.includes('256')) aq = '1';
        else if (quality.includes('192')) aq = '2';
        else if (quality.includes('128')) aq = '4';

        cmd += ` -x --audio-format mp3 --audio-quality ${aq}`;
        if (useCover) cmd += ` --embed-thumbnail --convert-thumbnails jpg`;
    } else {
        let format = 'bestvideo+bestaudio/best';
        if (quality.includes('1080')) format = 'bestvideo[height<=1080]+bestaudio/best';
        else if (quality.includes('720')) format = 'bestvideo[height<=720]+bestaudio/best';
        else if (quality.includes('480')) format = 'bestvideo[height<=480]+bestaudio/best';
        else if (quality.includes('360')) format = 'bestvideo[height<=360]+bestaudio/best';
        else if (quality.includes('240')) format = 'bestvideo[height<=240]+bestaudio/best';

        cmd += ` -f "${format}" --merge-output-format mp4`;
    }

    if (isPlaylist) cmd += ` --yes-playlist`;

    cmd += ` "${url}"`;

    exec(cmd, { shell: true, timeout: 300000 }, (error) => {
        if (error) return res.status(400).json({ error: error.message });

        // Save to user history
        let users = JSON.parse(fs.readFileSync(USERS_FILE));
        const user = users.find(u => u.username === currentUser);
        if (user) {
            user.history.unshift({
                title: title || 'Unknown',
                type: type,
                time: new Date().toLocaleString('fr-TN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
                file: `${title || 'file'}.${type === 'MP3' ? 'mp3' : 'mp4'}`
            });
            fs.writeFileSync(USERS_FILE, JSON.stringify(users));
        }

        res.json({ success: true, message: `Saved to downloads folder!` });
    });
});

app.get('/api/history', (req, res) => {
    if (!currentUser) return res.json([]);
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    const user = users.find(u => u.username === currentUser);
    res.json(user ? user.history : []);
});

// ====================== EXTRA ROUTES FOR YOUR FRONTEND ======================

// Playlist video list (for progress bar)
app.post('/api/playlist-videos', (req, res) => {
    const url = req.body.url;
    exec(`yt-dlp --flat-playlist --dump-json "${url}"`, { shell: true, timeout: 20000 }, (error, stdout) => {
        if (error) return res.status(400).json({ error: error.message });
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

// Clear history (per user)
app.post('/api/history/clear', (req, res) => {
    if (!currentUser) return res.status(401).json({ error: 'Not logged in' });
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    const user = users.find(u => u.username === currentUser);
    if (user) user.history = [];
    fs.writeFileSync(USERS_FILE, JSON.stringify(users));
    res.json({ success: true });
});

// Delete single history item
app.post('/api/history/delete', (req, res) => {
    if (!currentUser) return res.status(401).json({ error: 'Not logged in' });
    const { index } = req.body;
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    const user = users.find(u => u.username === currentUser);
    if (user && user.history) {
        user.history.splice(index, 1);
        fs.writeFileSync(USERS_FILE, JSON.stringify(users));
    }
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`✅ dlwip running at http://localhost:${PORT}`);
});