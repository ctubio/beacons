import axios from 'axios'
import beacons from '../src/assets/beacons.json'
import beaconNamesHardcoded from '../src/assets/beaconNamesHardcoded.json'

const fs = require('fs')

const out = populate()

const endpoints = ['assets', 'exchanges', 'pairs']

let n = 0

export function populate () {
  const out = {}
  Object.keys(beacons).forEach(key => {
    let id = key.slice(4)
    const len = key.length
    const end = key.slice(len - 2, len)
    if (end === '-s') {
      id = id.slice(0, -2)
    }
    Object.assign(out, { [id]: '' })
  })
  return out
}

endpoints.forEach(ep => getData(ep))

export function getData (endpoint) {
  const url = 'https://api.cryptowat.ch/' + endpoint
  axios
    .get(url)
    .then(res => {
      n++
      if (endpoint === 'pairs') {
        makeListPairs(res.data.result)
      } else {
        makeList(res.data.result)
      }
      if (n === 3) write()
    })
    .catch(err => {
      console.log(err)
    })
}

export function makeList (data) {
  Object.keys(out).forEach(key => {
    const match = data.find(el => el.symbol === key)
    if (match) {
      out[key] = match.name
    } else if (beaconNamesHardcoded[key]) {
      out[key] = beaconNamesHardcoded[key]
    }
  })
}

export function makeListPairs (data) {
  Object.keys(out).forEach(key => {
    const match = data.find(el => el.quote.symbol === key)
    if (match) {
      out[key] = match.quote.name
    } else if (beaconNamesHardcoded[key]) {
      out[key] = beaconNamesHardcoded[key]
    }
  })
}

export function write () {
  fs.writeFile(
    './src/assets/beaconNames.json',
    JSON.stringify(out, null, 2),
    err => {
      if (err) throw err
    }
  )
}
