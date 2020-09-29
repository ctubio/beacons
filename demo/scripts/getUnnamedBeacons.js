import beaconNames from '../src/assets/beaconNames.json'
import beaconNamesHardcoded from '../src/assets/beaconNamesHardcoded.json'

const fs = require('fs')

const out = {}

Object.keys(beaconNames).forEach(beacon => {
  if (
    !beaconNames[beacon] ||
    Object.keys(beaconNamesHardcoded).includes(beacon)
  ) {
    let str = ''
    if (beaconNamesHardcoded[beacon]) str = beaconNamesHardcoded[beacon]
    Object.assign(out, { [beacon]: str })
  }
})

write()

export function write () {
  fs.writeFile(
    './src/assets/beaconNamesHardcoded.json',
    JSON.stringify(out, null, 2),
    err => {
      if (err) throw err
    }
  )
}
