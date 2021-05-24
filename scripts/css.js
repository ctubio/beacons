const fs = require("fs");

import map from "../map/map.json";
import beacons from "../dist/beacons.json";

console.log("Generating beacons.css...");

const def = `@font-face {
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

const css = def + makeCss(keysOrdered);

function makeCss(keys) {
  return keys
    .map((key) => {
      let hex;
      if (key in beacons) {
        hex = beacons[key].toString(16);
      } else {
        hex = beacons[map[key]].toString(16);
      }
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
