import beaconNames from '../src/assets/beaconNames.json'

const fs = require('fs')

const out = {}

Object.keys(beaconNames).forEach(beacon => {
  if (!beaconNames[beacon]) {
    Object.assign(out, { [beacon]: '' })
  }
})

write()

export function write () {
  fs.writeFile(
    './src/assets/unnamedBeacons.json',
    JSON.stringify(out, null, 2),
    err => {
      if (err) throw err
    }
  )
}
