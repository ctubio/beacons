const fs = require("fs");

import map from "../map/map.json";
import beacons from "../dist/beacons.json";

console.log("Generating beacons.css, _variables.scss, and beacons.json...");

// Keep defaults at the top so we can apply
// that class to everything in cases
// where no slugs match.
const first = [
  "exc-_default-s",
  "exc-_default",
  "sym-_default-s",
  "sym-_default",
  // map
  "sym-d",
  "sym-default",
  "sym-d-s",
  "exc-d",
  "exc-d-s",
  "exc-default",
  "exc-default-s",
  "cur-default",
  "cur-default-s",
];

const keys = [...Object.keys(beacons), ...Object.keys(map)];

const keysOrdered = [
  ...keys.filter((b) => first.includes(b)),
  ...keys.filter((b) => !first.includes(b)),
];

// MAKE CSS

const defCss = `@font-face {
  font-family: "beacons";
  src: url("./beacons.ttf") format("truetype"),
url("./beacons.woff") format("woff"),
url("./beacons.woff2") format("woff2"),
url("./beacons.eot#iefix") format("embedded-opentype");
}

i[class^="beacon-"]:before, i[class*=" beacon-"]:before {
  font-family: beacons !important;
  font-style: normal;
  font-weight: normal !important;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.beacon {
  font-family: "beacons";
  font-weight: 400;
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  display: inline-block;
  font-style: normal;
  font-variant: normal;
  text-rendering: auto;
  line-height: 1;
}

`;

function getHex(key) {
  if (key in beacons) {
    return beacons[key].toString(16);
  } else if (key in map) {
    return beacons[map[key]].toString(16);
  } else {
    return null;
  }
}

const css = defCss + makeCss(keysOrdered);

function makeCss(keys) {
  return keys
    .map((key) => {
      const hex = getHex(key);
      return `.${key}:before {\n    content: "\\${hex}"\n}\n.beacon-${key}:before {\n    content: "\\${hex}"\n}`;
    })
    .join("\n");
}

fs.writeFile("dist/beacons.css", css, (err) => {
  if (err) {
    throw err;
  } else {
    console.log("beacons.css generated!");
  }
});

// MAKE SCSS

const defScss = `$cw-font-path: "." !default;
$cw-font-size: 16px !default;
$cw-prefix: sym !default;

// Convenience function used to set content property
@function esc($cw-sym) {
  @return unquote('"#{ $cw-sym }"');
}

`;

const scss =
  defScss +
  `$beacons: (
${makeScss(keysOrdered)}
);
`;

function makeScss(keys) {
  return keys
    .map((key) => {
      const hex = getHex(key);
      // stringify keys that contain ".", like "sym-eth2.s"
      const k = key.includes(".") ? `'${key}'` : key;
      return `  ${k}: ${hex},`;
    })
    .join("\n");
}

fs.writeFile("dist/_variables.scss", scss, (err) => {
  if (err) {
    throw err;
  } else {
    console.log("_variables.scss generated!");
  }
});

// MAKE JSON

const json = {};

keysOrdered.forEach((key) => {
  const hex = getHex(key);
  Object.assign(json, { [key]: hex });
});

fs.writeFile("dist/beacons.json", JSON.stringify(json, null, 2), (err) => {
  if (err) {
    throw err;
  } else {
    console.log("beacons.json generated!");
  }
});
