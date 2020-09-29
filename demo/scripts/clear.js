const fs = require('fs')

fs.writeFile(
  './src/assets/beaconNames.json',
  JSON.stringify({}, null, 2),
  (err) => {
    if (err) throw err
  }
)

fs.writeFile(
  './src/assets/beaconNamesHardcoded.json',
  JSON.stringify({}, null, 2),
  (err) => {
    if (err) throw err
  }
)
