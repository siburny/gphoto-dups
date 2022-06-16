const storage = require('./storage');
const { distance } = require('mathjs');
const fs = require('fs');
const { EOL } = require('os');

// *********
// Functions
// *********

var it;
async function start() {
  fs.writeFileSync(
    'output.html',
    '<html><body><h1>Dups</h1><table border="1"><th style="width:50px;">d</th><th>First</th><th>Dup</th>'
  );

  const ret = [];

  try {
    it = storage.data.createReadStream();
    it.on('data', async function (data) {
      if (data.key.substring(0, 9) != 'mediaitem') return;

      const value = JSON.parse(data.value);

      if (value.score.length != 108) {
        //console.log('skipping record: ' + data.key);
        return;
      }

      ret.push({
        key: data.key,
        score: value.score,
        path: value.path,
        productUrl: value.productUrl,
        mediaMetadata: value.mediaMetadata,
      });
    });
    it.on('error', function (err) {
      console.error('Oh my!', err);
    });
    it.on('end', function () {
      console.log('Loaded: ' + ret.length + ' photos');

      search(ret);
    });
  } catch (err) {
    console.log('Opps!', err);
  }
}

async function search(ret) {
  //fs.writeFileSync('dups.txt', '');

  console.log('Searching ...');
  for (let q1 = 0; q1 < ret.length - 1; q1++) {
    for (let q2 = q1 + 1; q2 < ret.length - 1; q2++) {
      try {
        let d = distance(ret[q1].score, ret[q2].score);
        if (d < 1000) {
          //fs.appendFileSync('dups.txt', ret[q2].productUrl + EOL);

          console.log('Found - index:' + q1);
          fs.appendFileSync(
            'output.html',
            '<tr><td>' +
              d +
              '</td><td><a target="_blank" href="' +
              ret[q1].productUrl +
              '"><img src="' +
              ret[q1].path +
              '" width="250" /></a></td><td><a target="_blank" href="' +
              ret[q2].productUrl +
              '"><img src="' +
              ret[q2].path +
              '" width="250" /></a></td><td>' +
              q1 +
              '</td></tr>' +
              EOL
          );

          try {
            await storage.data.del(ret[q1].key);
            await storage.data.del(ret[q2].key);
          } catch (e) {}
       
        
          break;
        }
      } catch (e) {
        console.log('error', e);
      }
    }
  }
}

start();
