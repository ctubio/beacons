# Cryptowatch Beacons

Cryptowatch Beacons is a crypto icon font that contains over 1700 icons of cryptocurrencies, crypto exchanges and fiat currencies.

<img src="https://raw.githubusercontent.com/cryptowatch/beacons/master/img/beacons.png">

## Live Demo

https://cryptowatch.github.io/beacons

## Usage

Import the files in the `/dist` folder into your project and link to `beacons.css`:

`<link rel="stylesheet" href="beacons.css">`

You may need to adapt the href value to your project's folder structure. Now you can start to use the font by using the class `.beacon` followed by the class for the specific icon:

`<i class="beacon sym-btc" />`

All icons have 2 versions: By default they are surrounded by a circle. Simply add the `-s` postfix to get the icon without the surrounding circle:

`<i class="beacon sym-btc-s" />`

### Groups

The font consists of 3 icon groups:

- Exchanges (`exc-` prefix)
- Symbols (`sym-` prefix)
- Currencies (`cur-` prefix)

For example, if you want to display the icon for the Kraken exchange, you would do:

`<i class="beacon exc-kraken" />`

or

`<i class="beacon exc-kraken-s" />`

### Fallback

`sym-d`, `sym-default`, `sym-o`, and `sym-c` can be used as fallbacks for non-existing icons. You could do:

`<i class="beacon sym-default sym-NONEXISTANT" />`

if `sym-NONEXISTANT` does not exist, `sym-default` will be used instead.
