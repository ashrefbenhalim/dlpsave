const express = require('express');
const { spawn } = require('child_process');
const sqlite3 = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 5000;
const DOWNLOAD_FOLDER = 'downloads';
const DB_FILE = 'history.db';

app.use(express.static('.'));
app.use(express.json());

if (!fs.existsSync(DOWNLOAD_FOLDER)) fs.mkdirSync(DOWNLOAD_FOLDER);

const db = sqlite3(DB_FILE);

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
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

// Seed example accounts if database is empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    // Admin
    db.prepare('INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, 1)').run('admin@dlwip.com', bcrypt.hashSync('admin', salt));
    // Normal test user
    db.prepare('INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, 0)').run('test@example.com', bcrypt.hashSync('123', salt));

    const testUserId = db.prepare('SELECT id FROM users WHERE email = ?').get('test@example.com').id;

    // Add a few example downloads for the test user
    const stmt = db.prepare('INSERT INTO history (user_id, url, title, type, quality, useCover, time, file) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(testUserId, 'https://www.youtube.com/watch?v=dQw4w9wgxcQ', 'Never Gonna Give You Up', 'MP3', 'MP3 320kbps (high quality)', 1, '12/04/26 09:00', 'Never Gonna Give You Up.mp3');
    stmt.run(testUserId, 'https://www.youtube.com/watch?v=3JZ4pnN7gmM', 'Sample Video', 'Video', '720', 0, '12/04/26 09:05', 'Sample Video.mp4');
    stmt.run(testUserId, 'https://soundcloud.com/example/track', 'Example Song', 'MP3', 'MP3 256kbps', 1, '12/04/26 09:10', 'Example Song.mp3');
}

const downloadProgress = new Map();

// Progress
app.get('/api/progress/:id', (req, res) => {
    const id = req.params.id;
    const prog = downloadProgress.get(id) || { percent: 0 };
    res.json({ percent: prog.percent });
});

// Info
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

// Register
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    try {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
        stmt.run(email, hash);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: 'Email already exists' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Wrong email or password' });
    }

    res.json({
        id: user.id,
        email: user.email,
        isAdmin: user.is_admin === 1
    });
});

// Download
app.post('/api/download', (req, res) => {
    const { url, type, quality, title = 'Unknown', useCover = false, isPlaylist = false, downloadId, userId } = req.body;
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

        if (code === 0 && userId) {
            const time = new Date().toLocaleString('fr-TN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
            const file = `${title}.${type === 'MP3' ? 'mp3' : 'mp4'}`;
            db.prepare('INSERT INTO history (user_id, url, title, type, quality, useCover, time, file) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(userId, url, title, type, quality, useCover ? 1 : 0, time, file);
        }
    });
});

// History for normal user
app.get('/api/history', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.json([]);

    const rows = db.prepare('SELECT * FROM history WHERE user_id = ? ORDER BY id DESC').all(userId);
    res.json(rows);
});

// History for admin (all users)
app.get('/api/history/all', (req, res) => {
    const rows = db.prepare(`
        SELECT h.*, u.email 
        FROM history h 
        JOIN users u ON h.user_id = u.id 
        ORDER BY h.id DESC
    `).all();
    res.json(rows);
});

// Clear history
app.post('/api/history/clear', (req, res) => {
    db.prepare('DELETE FROM history').run();
    res.json({ success: true });
});

// Delete one item
app.post('/api/history/delete', (req, res) => {
    const { id } = req.body;
    db.prepare('DELETE FROM history WHERE id = ?').run(id);
    res.json({ success: true });
});

// Rename
app.post('/api/history/rename', (req, res) => {
    const { id, newTitle } = req.body;
    db.prepare('UPDATE history SET title = ? WHERE id = ?').run(newTitle, id);
    res.json({ success: true });
});

// Playlist videos
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
    console.log(`   SQLite database ready - test accounts created`);
});