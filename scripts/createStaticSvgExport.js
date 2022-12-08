const fs = require('fs')
const path = require('path')
const https = require('https')
const map = require('../map/map.json')

const ASSETS_URL_ENDPOINT =
  'https://api.master.cryptowat.ch/assets?showaltsids=1'

const srcFolder = path.normalize(__dirname + '/../src/')
const staticFolder = path.normalize(__dirname + '/../static/')
const currencyFolder = path.normalize(__dirname + '/../static/currency/')
const exchangesFolder = path.normalize(__dirname + '/../static/exchanges/')
const srcFiles = fs.readdirSync(srcFolder)

const download = async url =>
  new Promise((resolve, reject) => {
    let body = ''

    https
      .get(url, res => {
        if (res.statusCode !== 200) reject(res.statusMessage)

        res
          .on('data', chunk => (body += chunk))
          .on('end', () => resolve(JSON.parse(body).result))
          .on('error', reject)
      })
      .on('error', reject)
  })

;(async () => {
  const assets = await download(ASSETS_URL_ENDPOINT)

  const deepReadDir = dirPath =>
    fs.readdirSync(dirPath).map(entity => {
      const p = path.join(dirPath, entity)
      return fs.lstatSync(p).isDirectory() ? deepReadDir(p) : p
    })

  fs.rmSync(staticFolder, { recursive: true })
  fs.mkdirSync(staticFolder, { recursive: true })
  fs.mkdirSync(currencyFolder, { recursive: true })
  fs.mkdirSync(exchangesFolder, { recursive: true })

  console.log('Copy files...')
  for (const { symbol, sid, altSids = [] } of assets) {
    const filename = `${srcFolder}sym-${symbol}-s.svg`
    const fileExists = fs.existsSync(`${filename}`)

    if (fileExists) {
      const destFilename = `${staticFolder}${sid}.svg`

      fs.copyFileSync(filename, destFilename)

      for (const altSid of altSids) {
        const destFilename = `${staticFolder}${altSid}.svg`
        fs.copyFileSync(filename, destFilename)
      }
    }
  }

  console.log('Transform currencies/exchanges...')
  for (const key in map) {
    const item = map[key]
    const isCurrency = key.startsWith('cur-') && key.endsWith('-s')
    const isExchange = key.startsWith('exc-') && key.endsWith('-s')
    const isSym = key.startsWith('sym-') && key.endsWith('-s')

    if (isCurrency) {
      const currency = key.substring(4, key.length - 2)

      fs.copyFileSync(
        `${srcFolder}${item}.svg`,
        `${currencyFolder}${currency}.svg`
      )
    }

    if (isExchange) {
      const exchange = key.substring(4, key.length - 2)

      fs.copyFileSync(
        `${srcFolder}${item}.svg`,
        `${exchangesFolder}${exchange}.svg`
      )
    }

    if (isSym) {
      const asset = key.substring(4)
      const correspondingAsset = assets.find(item => item.symbol === asset)

      if (correspondingAsset) {
        const { sid, altSids = [] } = correspondingAsset

        fs.copyFileSync(`${srcFolder}${item}.svg`, `${staticFolder}${sid}.svg`)

        for (const altSid of altSids) {
          fs.copyFileSync(
            `${srcFolder}${item}.svg`,
            `${staticFolder}${altSid}.svg`
          )
        }
      }
    }
  }

  for (const file of srcFiles) {
    if (!file.startsWith('exc-') || !file.endsWith('-s.svg')) continue

    const exchange = file.substring(4).replace('-s', '')

    fs.copyFileSync(`${srcFolder}${file}`, `${exchangesFolder}${exchange}`)
  }

  console.log('Processing svg...')
  const files = deepReadDir(staticFolder).flat(Number.POSITIVE_INFINITY)
  for (const file of files) {
    if (!file.endsWith('.svg')) continue

    const content = fs.readFileSync(file).toString()
    const newContent = `<svg id="icon" ${content.substring(5)}`

    fs.writeFileSync(file, newContent)
  }
})()
