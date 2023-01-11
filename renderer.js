const storage = require('./storage');
const { distance } = require('mathjs');
const fs = require('fs');
const { EOL } = require('os');

const LEVELS = [1000, 1500, 2500, 3500, 5000, 7500, 10000];

// *********
// Functions
// *********

var db = [];

async function start() {
  fs.writeFileSync(
    'output.html',
    '<html><body><h1>Dups</h1><table border="1"><th style="width:50px;">d</th><th>First</th><th>Dup</th>'
  );

  try {
    var full_file = fs.readFileSync('output.json').toString().split('\n');
    for (let line of full_file) {
      try {
        let json = JSON.parse(line);
        db.push(json.id);
      } catch (err) { }
    }
  } catch (err) { }

  const ret = [];

  try {
    for await (const [data_key, data_value] of storage.data.iterator()) {
      if (data_key.substring(0, 9) != 'mediaitem') continue;

      const value = JSON.parse(data_value);

      if (value.score.length != 108) {
        continue;
      }

      ret.push({
        key: data_key,
        score: value.score,
        path: value.path,
        productUrl: value.productUrl,
        mediaMetadata: value.mediaMetadata,
      });
    }

    console.log('Loaded: ' + ret.length + ' photos');

    for (let level = 0; level < LEVELS.length; level++) {
      let searchStatus = await search(ret, LEVELS[level]);
      if (searchStatus) break;
    }
  } catch (err) {
    console.log('Opps!', err);
  }
}

async function search(ret, limit) {
  var total_found = 0;

  console.log('Searching ... [LEVEL: ' + limit + ' points]');
  for (let q1 = 0; q1 < ret.length - 1; q1++) {
    for (let q2 = q1 + 1; q2 < ret.length - 1; q2++) {
      try {
        let d = distance(ret[q1].score, ret[q2].score);
        if (d < limit) {
          let found1 = db.indexOf(ret[q1].key.substring(10)) != -1;
          let found2 = db.indexOf(ret[q2].key.substring(10)) != -1;

          console.log('Found - index:' + q1);
          fs.appendFileSync(
            'output.html',
            '<tr><td>' +
            d +
            '</td><td><a target="_blank" href="' +
            ret[q1].productUrl +
            '"><img ' +
            (found1 ? 'style="border: 20px solid green"' : '') +
            ' src="' +
            ret[q1].path +
            '" width="250" /></a></td><td><a target="_blank" href="' +
            ret[q2].productUrl +
            '"><img ' +
            (found2 ? 'style="border: 20px solid green"' : '') +
            ' src="' +
            ret[q2].path +
            '" width="250" /></a></td><td>' +
            q1 +
            '</td></tr>' +
            EOL
          );

          try {
            await storage.data.del(ret[q1].key);
            await storage.data.del(ret[q2].key);
          } catch (e) { }

          total_found++;
          if (total_found > 15) {
            return 1;
          }

          break;
        }
      } catch (e) {
        console.log('error', e);
      }
    }
  }

  console.log('Done searching.');
  return 0;
}

start();
