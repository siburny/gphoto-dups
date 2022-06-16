const storage = require('./storage');
const { distance } = require('mathjs');
const { EOL } = require('os');

// *********
// Functions
// *********

var it;
async function start() {
  const ret = [];
  var count = 0;

  try {
    it = storage.data.createReadStream();
    it.on('data', async function (data) {
      // if (data.key.substring(0, 9) != 'mediaitem') return;

      // const value = JSON.parse(data.value);

      // if (value.score.length != 108) {
      //   console.log('delete broken record: ' + data.key);
      //   await storage.data.del(data.key);
      //   return;
      // }

      count++;
    });
    it.on('error', function (err) {
      console.error('Oh my!', err);
    });
    it.on('end', function () {
      console.log('Done: ' + count);
    });
  } catch (err) {
    console.log('Opps!', err);
  }
}

start();
