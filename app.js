const express = require('express');
const session = require('express-session');
const OAuth = require('oauth').OAuth;

const app = express();
const port = 3000;

// Replace these values with your Garmin API credentials
const consumerKey = '9059f2b0-3692-4a79-9609-11e752332084';
const consumerSecret = 'G72n9LWV0gcsxmvQqW5JUHkLs7OTQhgm6tW';

// OAuth1 client setup
const oauth = new OAuth(
  'https://connectapi.garmin.com/oauth-service/oauth/request_token',
  'https://connectapi.garmin.com/oauth-service/oauth/access_token',
  consumerKey,
  consumerSecret,
  '1.0',
  'http://localhost:3000/callback',
  'HMAC-SHA1'
);

app.use(session({
  secret: 'AEA1548',
  resave: false,
  saveUninitialized: true,
}));

// Root route
app.get('/', (req, res) => {
  res.send('<h1>Welcome to Garmin OAuth1 Authentication</h1><p><a href="/auth">Authenticate with Garmin</a></p>');
});

app.get('/auth', (req, res) => {
  oauth.getOAuthRequestToken((error, oauthToken, oauthTokenSecret, results) => {
    if (error) {
      console.error('Error getting OAuth request token:', error);
      res.status(500).send('Error getting OAuth request token');
    } else {
      req.session.oauthToken = oauthToken;
      req.session.oauthTokenSecret = oauthTokenSecret;
      const authUrl = `https://connect.garmin.com/oauthConfirm?oauth_token=${oauthToken}`;
      res.redirect(authUrl);
    }
  });
});

app.get('/callback', (req, res) => {
  console.log('Query parameters:', req.query); // Log the entire query object

  const { oauth_token: oauthToken, oauth_verifier: oauthVerifier } = req.query;
  const oauthTokenSecret = req.session.oauthTokenSecret;

  console.log('OAuth Token:', oauthToken);
  console.log('OAuth Verifier:', oauthVerifier);
  console.log('OAuth Token Secret:', oauthTokenSecret);

  oauth.getOAuthAccessToken(oauthToken, oauthTokenSecret, oauthVerifier, (error, oauthAccessToken, oauthAccessTokenSecret, results) => {
    if (error) {
      console.error('Error getting OAuth access token:', JSON.stringify(error, null, 2));
      res.status(500).send(`Error getting OAuth access token: ${JSON.stringify(error, null, 2)}`);
    } else {
      console.log('OAuth Access Token:', oauthAccessToken);
      console.log('OAuth Access Token Secret:', oauthAccessTokenSecret);

      req.session.oauthAccessToken = oauthAccessToken;
      req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;

      // Use the access token to fetch the user ID
      oauth.get('https://apis.garmin.com/wellness-api/rest/user/id', oauthAccessToken, oauthAccessTokenSecret, (error, data, response) => {
        if (error) {
          console.error('Error fetching user ID:', error);
          res.status(500).send('Error fetching user ID');
        } else {
          console.log('Response data:', data);
          try {
            const userId = JSON.parse(data).userId;
            res.send(`User ID: ${userId}`);
          } catch (parseError) {
            console.error('Error parsing response data:', parseError);
            res.status(500).send('Error parsing response data');
          }
        }
      });
    }
  });
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});