const express = require('express');
const session = require('express-session');
const OAuth = require('oauth').OAuth;
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const port = process.env.PORT || 3000;

// MySQL database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'mysql.ugent.be',
  user: process.env.DB_USER || 's306101',
  password: process.env.DB_PASSWORD || '25aftfm6w9s64za',
  database: process.env.DB_NAME || 'disconnect_garmin_signups',
  connectTimeout: 30000 // Increase connection timeout to 30 seconds
};

// Replace these values with your Garmin API dev credentials
const consumerKey = process.env.CONSUMER_KEY || '9059f2b0-3692-4a79-9609-11e752332084';
const consumerSecret = process.env.CONSUMER_SECRET || 'G72n9LWV0gcsxmvQqW5JUHkLs7OTQhgm6tW';

// OAuth1 client setup
const callbackURL = process.env.CALLBACK_URL || 'http://localhost:3000/callback';
const oauth = new OAuth(
  'https://connectapi.garmin.com/oauth-service/oauth/request_token',
  'https://connectapi.garmin.com/oauth-service/oauth/access_token',
  consumerKey,
  consumerSecret,
  '1.0',
  callbackURL,
  'HMAC-SHA1'
);

app.use(session({
  secret: 'AEA1548',
  resave: false,
  saveUninitialized: true,
}));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'welcome_page.html'));
});

app.get('/auth', (req, res) => {
  oauth.getOAuthRequestToken((error, oauthToken, oauthTokenSecret, results) => {
    if (error) {
      console.error('Error getting OAuth request token:', error);
      res.status(500).send('Error getting OAuth request token');
    } else {
      console.log('OAuth Request Token:', oauthToken);
      console.log('OAuth Token Secret:', oauthTokenSecret);
      req.session.oauthToken = oauthToken;
      req.session.oauthTokenSecret = oauthTokenSecret;
      const authUrl = `https://connect.garmin.com/oauthConfirm?oauth_token=${oauthToken}`;
      res.redirect(authUrl);
    }
  });
});

app.get('/callback', async (req, res) => {
  const { oauth_token: oauthToken, oauth_verifier: oauthVerifier } = req.query;
  const oauthTokenSecret = req.session.oauthTokenSecret;

  console.log('OAuth Token:', oauthToken);
  console.log('OAuth Verifier:', oauthVerifier);
  console.log('OAuth Token Secret:', oauthTokenSecret);

  oauth.getOAuthAccessToken(oauthToken, oauthTokenSecret, oauthVerifier, async (error, oauthAccessToken, oauthAccessTokenSecret, results) => {
    if (error) {
      console.error('Error getting OAuth access token:', error);
      return res.status(500).send('Error getting OAuth access token');
    }

    console.log('OAuth Access Token:', oauthAccessToken);
    console.log('OAuth Access Token Secret:', oauthAccessTokenSecret);
    console.log('OAuth verifier:', oauthVerifier);

    // Fetch userId from Garmin API
    oauth.get('https://apis.garmin.com/wellness-api/rest/user/id', oauthAccessToken, oauthAccessTokenSecret, async (error, data, response) => {
      if (error) {
        console.error('Error fetching user ID:', error);
        return res.status(500).send('Error fetching user ID');
      }

      try {
        const userId = JSON.parse(data).userId;
        console.log('User ID:', userId);

        // Store in MySQL database
        try {
          console.log('Connecting to MySQL database...');
          const connection = await mysql.createConnection(dbConfig);
          console.log('Connected to MySQL database.');

          // if same userID uploads again, then update oauth_verifier (other tokens remain the same)
          const [rows] = await connection.execute(
            'INSERT INTO garmin_tokens (userId, oauthAccessToken, oauthTokenSecret, oauth_verifier) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE oauth_verifier = VALUES(oauth_verifier)',
            [userId, oauthAccessToken, oauthAccessTokenSecret, oauthVerifier]
          );
          await connection.end();

          console.log('Stored user in MySQL db on ${dbConfig.host}:', userId);
          res.redirect('/landing_page.html');
        } catch (dbError) {
          console.error(`Error storing user in MySQL db on ${dbConfig.host}:`, dbError);
          res.status(500).send(`Error storing user in MySQL: ${dbError.message}`);
        }
      } catch (parseError) {
        console.error('Error parsing response data:', parseError);
        res.status(500).send('Error parsing response data');
      }
    });
  });
});

app.listen(port, () => {
  if (process.env.VERCEL_URL) {
    console.log(`Server is running on https://${process.env.VERCEL_URL}`);
  } else {
    console.log(`Server is running on http://localhost:${port}`);
  }
});