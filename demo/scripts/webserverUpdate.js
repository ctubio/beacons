// beacons that are not yet in symbols.js

import beacons from '../src/assets/beacons.json'
// add path:
import symbols from ''

const sym = Object.keys(symbols)

const out = {}

Object.keys(beacons).forEach(beacon => {
  if (!sym.includes(beacon)) {
    Object.assign(out, { [beacon]: '\\' + beacons[beacon] })
  }
})

console.log(out)
