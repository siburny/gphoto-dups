const path = require('path');
const fs = require('fs');
const storage = require('./storage');
const Photos = require('googlephotos');
const GDate = require('googlephotos/lib/common/gdate');
const http = require('http');
const url = require('url');
const destroyer = require('server-destroy');
const exec = require('child_process').execSync;
const IM = '"c:\\Program Files\\ImageMagick-7.1.0-Q16-HDRI\\convert.exe"';

const { google } = require('googleapis');

const YEAR = 2019;

let keys = {
  client_id: '',
  client_secret: '',
  redirect_uris: [''],
};

var crypto = require('crypto');
const CURRENT_TAG = crypto.randomBytes(20).toString('hex');

const keyPath = path.join(__dirname, 'db', 'oauth2.keys.json');
if (fs.existsSync(keyPath)) {
  keys = require(keyPath).web;
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const oauth2Client = new google.auth.OAuth2(keys.client_id, keys.client_secret, keys.redirect_uris[0]);

google.options({
  auth: oauth2Client,
});

var people = google.people({
  version: 'v1',
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
            const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
            res.end('Authentication successful! Please return to the console.');
            server.destroy();
            const { tokens } = await oauth2Client.getToken(qs.get('code'));

            fs.writeFileSync(tokenPath, JSON.stringify(tokens));

            oauth2Client.setCredentials(tokens);
            resolve(oauth2Client);
          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(3000, () => {
        console.log('Login URL: ', authorizeUrl);
      });
    destroyer(server);
  });
}

var photos;
async function start() {
  photos = new Photos(oauth2Client.credentials.access_token);

  const filters = new photos.Filters(true);

  const mediaTypeFilter = new photos.MediaTypeFilter(photos.MediaType.PHOTO);
  filters.setMediaTypeFilter(mediaTypeFilter);

  const dateFilter = new photos.DateFilter();
  // YEAR
  dateFilter.addDate(new GDate(YEAR, 0, 0));
  filters.setDateFilter(dateFilter);

  let count = 0;

  let nextPageToken = '';
  do {
    let res;
    try {
      res = await photos.mediaItems.search(filters, 100, nextPageToken);
    } catch (err) {
      if (err && err.message == 'Unauthorized') {
        await people.people.get({
          resourceName: 'people/me',
          personFields: 'emailAddresses,names,photos',
        });

        if (oauth2Client.credentials.access_token != photos.transport.authToken) {
          photos.transport.authToken = oauth2Client.credentials.access_token;

          console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
          console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
          console.log('!!!!!!!!!!!!!!!!!!!!!!!! TOKEN REFRESHED !!!!!!!!!!!!!!!!!!!!!!!!');
          console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
          console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        }

        continue;
      }

      console.log(err);
    }

    if ('mediaItems' in res) {
      //console.log('Recieved: ' + res.mediaItems.length);

      count += res.mediaItems.length;

      /*** DEBUG ***/
      // if (count > 500) {
      //   console.log('Limit is reached.');
      //   break;
      // }

      await store_results(res);
    } else {
      console.log('None recieved');
    }

    if ('nextPageToken' in res) {
      nextPageToken = res.nextPageToken;
    } else {
      console.log('No NextPage token');
      break;
    }

    await timeout(100);
    console.log('Iteration count: ' + count);
  } while (true);
}

async function store_results(res) {
  for (var i = 0; i < res.mediaItems.length; i++) {
    let record = null;
    try {
      record = await storage.data.get('mediaitem-' + res.mediaItems[i].id);
    } catch (e) {
      if (!e.notFound) {
        throw e;
      }
    }

    if (!record) {
      let out = exec(
        IM + ' ' + res.mediaItems[i].baseUrl + ' -gravity center -scale 6x6^! -compress none -depth 16 ppm:-'
      );

      let score = [];
      let a = out.toString().split('\n');
      for (let k = 3; k < a.length; k++) {
        score.push.apply(
          score,
          a[k]
            .split(' ')
            .filter(Boolean)
            .map((element) => {
              return Number(element);
            })
        );
      }

      let value = {
        score: score,
        path: res.mediaItems[i].baseUrl + '=w512-h512',
        mediaMetadata: res.mediaItems[i].mediaMetadata,
        productUrl: res.mediaItems[i].productUrl,
        tag: CURRENT_TAG,
      };

      await storage.data.put('mediaitem-' + res.mediaItems[i].id, JSON.stringify(value));
      console.log('New file downloaded: ' + res.mediaItems[i].id + '[' + score.length + '] - ');
    } else {
      let value = JSON.parse(record);

      value.path = res.mediaItems[i].baseUrl + '=w512-h512';
      value.mediaMetadata = res.mediaItems[i].mediaMetadata;
      value.productUrl = res.mediaItems[i].productUrl;
      value.tag = CURRENT_TAG;

      await storage.data.put('mediaitem-' + res.mediaItems[i].id, JSON.stringify(value));
    }
  }
}

async function clearOld() {
  var count = 0;
  try {
    for await (const [data_key, data_value] of storage.data.iterator()) {
      if (data_key.substring(0, 9) != 'mediaitem') continue;

      const value = JSON.parse(data_value);

      if (value.tag != CURRENT_TAG) {
        console.log('delete old record: ' + data_key);
        await storage.data.del(data_key);
        continue;
      }

      count++;
    }
  } catch (err) {
    console.log('Opps!', err);
  }
}

async function login() {
  const res = await people.people.get({
    resourceName: 'people/me',
    personFields: 'emailAddresses,names,photos',
  });

  const displayName = res.data.names[0].displayName;
  console.log('Welcome, %s!', displayName);
  console.log('='.repeat(60));
  console.log('');
}

console.log('Google Photos Photo Downloader v0.1');

const scopes = ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/photoslibrary'];
authenticate(scopes)
  .then(() => login())
  .then(() => start())
  .then(() => clearOld())
  .catch(console.error);
