const storage = require('./storage');

// *********
// Functions
// *********

var it;
async function start() {
  const ret = [];
  var count = 0;

  try {

    for await (const record of storage.data.iterator()) {
      // if (data.key.substring(0, 9) != 'mediaitem') return;

      // const value = JSON.parse(data.value);

      // if (value.score.length != 108) {
      //   console.log('delete broken record: ' + data.key);
      //   await storage.data.del(data.key);
      //   return;
      // }

      count++;
    }

    console.log('Done: ' + count);
  } catch (err) {
    console.log('Opps!', err);
  }
}

start();
