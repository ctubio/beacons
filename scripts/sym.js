// used to create internal symbols.js content

const fs = require("fs");

import map from "../map/map.json";
import beacons from "../dist/beacons.json";

const sym = {};

Object.keys(beacons).forEach((key) => {
  const hex = beacons[key].toString(16);
  Object.assign(sym, { [key]: "\\" + hex });
});

Object.keys(map).forEach((key) => {
  const value = map[key];
  const hex = sym[value];
  Object.assign(sym, { [key]: hex });
});

fs.writeFile("map/sym.json", JSON.stringify(sym, null, 2), (err) => {
  if (err) throw err;
});
