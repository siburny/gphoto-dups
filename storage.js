
class Storage {
  constructor() {
    const level = require('level');

    this.data = level('./db/data/');
  }
}

module.exports = new Storage();

// 893111645692-43i0e2qsfsjotdn2me0qbh4v5em7g5io.apps.googleusercontent.com
// MCrKYXusU6DmkTrPGw_xb0JR