const fs = require("fs");

const src = __dirname.replace("demo/scripts", "dist");
const dest = __dirname.replace("scripts", "public");
const destJson = __dirname.replace("scripts", "src/assets");

const files = ["css", "ttf", "woff", "woff2"];

files.forEach((file) => {
  fs.copyFile(`${src}/beacons.${file}`, `${dest}/beacons.${file}`, (err) => {
    if (err) throw err;
  });
});

fs.copyFile(`${src}/beacons.json`, `${destJson}/beacons.json`, (err) => {
  if (err) throw err;
});
