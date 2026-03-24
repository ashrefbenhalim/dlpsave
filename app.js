const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 5000;
const DOWNLOAD_FOLDER = 'downloads';
const HISTORY_FILE = 'history.json';

app.use(express.static('.'));
app.use(express.json());

if (!fs.existsSync(DOWNLOAD_FOLDER)) fs.mkdirSync(DOWNLOAD_FOLDER);
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');

app.post('/api/info', (req, res) => {
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
    const { url, type, quality, title, useCover } = req.body;
    let cmd = `yt-dlp --output "${DOWNLOAD_FOLDER}/%(title)s.%(ext)s"`;

    if (type === 'MP3') {
        let aq = '0'; // best
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

    cmd += ` "${url}"`;

    exec(cmd, { shell: true, timeout: 300000 }, (error) => {
        if (error) return res.status(400).json({ error: error.message });

        let history = [];
        if (fs.existsSync(HISTORY_FILE)) history = JSON.parse(fs.readFileSync(HISTORY_FILE));
        history.unshift({
            title: title || 'Unknown',
            type: type,
            time: new Date().toLocaleString('fr-TN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
            file: `${title || 'file'}.${type === 'MP3' ? 'mp3' : 'mp4'}`
        });
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 10)));

        res.json({ success: true, message: `Saved to ${DOWNLOAD_FOLDER} folder!` });
    });
});

app.get('/api/history', (req, res) => {
    if (fs.existsSync(HISTORY_FILE)) {
        res.json(JSON.parse(fs.readFileSync(HISTORY_FILE)));
    } else res.json([]);
});

app.listen(PORT, () => {
    console.log(`✅ dlwip running at http://localhost:${PORT}`);
});