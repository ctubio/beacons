# DEPRECATED 
This repository is no longer maintained

# Cryptowatch Beacons

Cryptowatch Beacons is a crypto icon font that contains over 2000 icons of cryptocurrencies, crypto exchanges, fiat currencies and equities.

<img src="https://raw.githubusercontent.com/cryptowatch/beacons/master/img/beaconTop.png">

## Live Demo

https://cryptowatch.github.io/beacons

## Usage

Import the files in the `/dist` folder into your project and link to `beacons.css`:

`<link rel="stylesheet" href="beacons.css">`

You may need to adapt the href value to your project's folder structure. Now you can start to use the font:

`<i class="beacon sym-btc" />`

All icons have 2 versions: By default they are surrounded by a circle. Simply add the `-s` postfix to get the icon without the surrounding circle:

`<i class="beacon sym-btc-s" />`

<img src="https://raw.githubusercontent.com/cryptowatch/beacons/master/img/iconExample.png">

### Groups

The font consists of 2 icon groups:

- Exchanges (`exc-` prefix)
- Symbols (`sym-` prefix)

For example, if you want to display the icon for the Kraken exchange, you would do:

`<i class="beacon exc-kraken" />`

or

`<i class="beacon exc-kraken-s" />`

### Fallback

`beacon sym-_default` and `beacon exc-_default` can be used as a fallback for non-existing icons. You could do:

`<i class="beacon sym-_default sym-NONEXISTANT" />`

if `sym-NONEXISTANT` does not exist, `sym-_default` will be used instead.

# Build your own custom font

## Install dependencies

```
npm i
```

Only include the icons you want included in your custom font in the `/src` folder. Run

```
npm run build
```

to build your custom font (output in `/dist`).

Beacons uses `Fantasticon` to build the font. You can customize the build by modifying the `build.js` file in the `/scripts` folder.

## Contribution

We welcome contributions from the community to our SVG icon font.

You can add new icons as SVGs to the `/src` folder, run `npm run build` and create a pull request.

### SVG format rules

The SVG markup should look like this:

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="M840.584 550.432H621.415c0-24.905-2.49-42.339-6.226-69.735-23.66-156.905-114.566-265.245-236.603-348.678C278.963 66.019 239.114 57.302 153.19 5h405.961c17.434 0 26.151 2.49 38.604 13.698 145.698 132 242.83 296.377 249.056 498.112v26.15s0 7.472-6.227 7.472zm-537.96 444.565v-625.13c93.396 155.66 184.3 308.83 273.961 459.508-89.66 54.792-180.565 105.849-273.961 165.622z"/></svg>
```

- The SVG should only contain one path

- Width and height of the SVG should be set to 1000

- The icon should be vertically and horizontally centered

- The icon should take up the maximum amount of space of the view box (0 padding)

- The path's decimal precision should be set to 3

### Mapping existing icons to css class names

To prevent the existence and maintenance of multiple identical SVG source files with different file names, multiple css classes can map to one source SVG icon, e.g. `exc-ftx` does not exist as an SVG file, but maps to `sym-ftt` (which does exist as `sym-ftt.svg`). These mappings are defined in `/map/map.json`:

```
"exc-ftx": "sym-ftt",
"exc-ftx-s": "sym-ftt-s"
```

After adding new mappings to `map.json` and running `npm run build`, the icon can be accessed in the same way as icons that exist as SVG source files:

`<i class="beacon exc-ftx" />`
