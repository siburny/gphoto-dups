const path = require('path');
const fs = require('fs');
const storage = require('./storage');
const Photos = require('googlephotos');
const http = require('http');
const url = require('url');
const destroyer = require('server-destroy');
const shell = require('electron').shell;

const {
  google
} = require('googleapis');
const {
  start
} = require('repl');

let keys = {
  client_id: '',
  client_secret: '',
  redirect_uris: ['']
};

const keyPath = path.join(__dirname, 'db', 'oauth2.keys.json');
if (fs.existsSync(keyPath)) {
  keys = require(keyPath).web;
}

const oauth2Client = new google.auth.OAuth2(
  keys.client_id,
  keys.client_secret,
  keys.redirect_uris[0]
);

google.options({
  auth: oauth2Client
});

var people = google.people({
  version: 'v1'
});

// *********
// Functions 
// *********

/**
 * Open an http server to accept the oauth callback. In this simple example, the only request to our webserver is to /callback?code=<code>
 */
async function authenticate(scopes) {
  return new Promise((resolve, reject) => {
    const tokenPath = path.join(__dirname, 'db', 'access_token.json');
    if (fs.existsSync(tokenPath)) {
      const tokens = JSON.parse(fs.readFileSync(tokenPath));
      oauth2Client.setCredentials(tokens);

      return resolve(oauth2Client);
    }

    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes.join(' '),
    });

    const server = http
      .createServer(async (req, res) => {
        try {
          if (req.url.indexOf('/oauth2callback') > -1) {
            const qs = new url.URL(req.url, 'http://localhost:3000')
              .searchParams;
            res.end('Authentication successful! Please return to the console.');
            server.destroy();
            const {
              tokens
            } = await oauth2Client.getToken(qs.get('code'));

            fs.writeFileSync(tokenPath, JSON.stringify(tokens));

            oauth2Client.setCredentials(tokens);
            resolve(oauth2Client);
          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(3000, () => {
        $('#login').css('display', 'block');
        $('#link').data('link', authorizeUrl);
      });
    destroyer(server);
  });
}

async function app() {
  await login();
  await show()
}

async function show() {
  $('#app').css('display', 'block');
  $('#start').on('click', start);
}

var photos
function start() {
  photos = new Photos(oauth2Client.credentials.access_token);
}

async function login() {
  const res = await people.people.get({
    resourceName: 'people/me',
    personFields: 'emailAddresses,names,photos',
  });

  const displayName = res.data.names[0].displayName;
  $('#name').text('Welcome, ' + displayName + '!');
}

const scopes = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/photoslibrary'
];
authenticate(scopes)
  .then(() => app())
  .catch(console.error);