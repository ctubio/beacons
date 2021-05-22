import { generateFonts } from "fantasticon";

console.log("Generating Beacon font files...");

generateFonts({
  name: "beacons",
  prefix: "beacon",
  inputDir: "./src",
  outputDir: "./dist",
  fontTypes: ["ttf", "woff", "woff2", "eot"],
  assetTypes: ["css", "json"],
  fontHeight: 0,
  descent: 0,
}).then(() => {
  console.log("Beacons font generated!");
});
