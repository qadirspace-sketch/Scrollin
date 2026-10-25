document.addEventListener('DOMContentLoaded', () => {



    // Clear All Data
    document.getElementById('clearLogs').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete ALL stored data? This cannot be undone.')) {
            chrome.runtime.sendMessage({ action: 'clear_database' }, (response) => {
                if (response && response.success) {
                    // Also clear watchlist meta
                    chrome.storage.local.remove(['profileWatchlistMeta'], () => {
                        alert('All data cleared successfully.');
                    });
                } else {
                    alert('Failed to clear data.');
                }
            });
        }
    });
});
