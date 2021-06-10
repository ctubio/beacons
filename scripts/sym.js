// used to create internal symbols.js content

const fs = require("fs");

import beacons from "../dist/beacons.json";

const sym = {};

for (const [key, value] of Object.entries(beacons)) {
  Object.assign(sym, { [key]: "\\" + value });
}

fs.writeFile("map/sym.json", JSON.stringify(sym, null, 2), (err) => {
  if (err) throw err;
});
