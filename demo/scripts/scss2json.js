// turn scss into json

const fs = require("fs");

const file = fs.readFileSync("../dist/_variables.scss").toString();

const out = {};

file
  .split("$beacons: (")[1]
  .replace(",\n);", "")
  .replace(/(\r\n|\n|\r)/gm, "") // rm line breaks
  .replace(/\s+/g, "") // rm spaces
  .split(",")
  .forEach((beacon) => {
    const split = beacon.split(":");
    const key = split[0];
    const val = split[1];
    Object.assign(out, { [key]: val });
  });

fs.writeFile("./src/assets/beacons.json", JSON.stringify(out, null, 2), (err) => {
  if (err) throw err;
});
