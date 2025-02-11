document.getElementById('authButton').addEventListener('click', function() {
    // Replace <REQUEST_TOKEN> with your actual request token
    window.location.href = `https://connect.garmin.com/oauthConfirm?oauth_token=1a6c0e23-8a06-4288-aa4f-36ef52611c24`
});

window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('oauth_token');
    const oauthTokenSecret = urlParams.get('oauth_token_secret');

    if (oauthToken && oauthTokenSecret) {
        document.getElementById('confirmation').classList.remove('hidden');
        document.getElementById('oauthToken').innerText = oauthToken;
        document.getElementById('oauthTokenSecret').innerText = oauthTokenSecret;
    }
};