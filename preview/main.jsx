// Preview entry: install the chrome.* mock, pretend we're on a LinkedIn
// profile, then load the real content script and open the panel.
import './chromeMock';

if (!window.location.pathname.startsWith('/in/')) {
    window.history.replaceState(null, '', '/in/alexrivera/');
}

import('../src/main.jsx').then(() => {
    document.getElementById('scrollin-app-toggle')?.click();
});
