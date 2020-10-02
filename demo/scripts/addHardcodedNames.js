import beaconNames from '../src/assets/beaconNames.json'
import beaconNamesHardcoded from '../src/assets/beaconNamesHardcoded.json'

const fs = require('fs')

const out = beaconNames

export function makeList () {
  Object.keys(out).forEach(key => {
    if (key in beaconNamesHardcoded) {
      out[key] = beaconNamesHardcoded[key]
    }
  })
}

makeList()

write()

export function write () {
  fs.writeFile(
    './src/assets/beaconNames.json',
    JSON.stringify(out, null, 2),
    err => {
      if (err) throw err
    }
  )
}
