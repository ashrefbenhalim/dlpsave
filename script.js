function searchVideo() {
    const input = document.getElementById('urlInput').value.trim();
    const result = document.getElementById('result');
    
    if (!input) {
        alert("Please enter a URL or song title first.");
        return;
    }

    result.style.display = 'block';
    
    // fake data for demo
    document.getElementById('title').textContent = "Your Video Title";
    document.getElementById('duration').textContent = "3:45 • YouTube";
    document.getElementById('thumb').src = "https://via.placeholder.com/340x190/111/eee?text=Thumbnail";

    // Auto-scroll to result
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function fakeDownload(type) {
    alert(`🎉 ${type} clicked!\n\nStill demo mode for now.\n\nReal yt-dlp downloads coming next step.`);
}

// Active nav highlight
window.addEventListener('scroll', () => {
    let current = '';
    document.querySelectorAll('section[id]').forEach(section => {
        const sectionTop = section.offsetTop;
        if (scrollY >= sectionTop - 100) {
            current = section.getAttribute('id');
        }
    });
    document.querySelectorAll('.top-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });

    // Navbar scroll effect
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// FAQ toggle not needed anymore because Bootstrap accordion handles it