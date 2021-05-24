const fs = require("fs");

import map from "../map/map.json";
import beacons from "../dist/beacons.json";

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

const hexObj = {};

keysOrdered.forEach((key) => {
  let hex;
  if (key in beacons) {
    hex = beacons[key].toString(16);
  } else {
    hex = beacons[map[key]].toString(16);
  }
  Object.assign(hexObj, { [key]: hex });
});

fs.writeFile(
  "demo/src/assets/beacons.json",
  JSON.stringify(hexObj, null, 2),
  (err) => {
    if (err) throw err;
  }
);
