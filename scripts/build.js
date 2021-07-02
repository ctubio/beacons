import { generateFonts } from "fantasticon";

console.log("Generating Beacon font files...");

generateFonts({
  name: "beacons",
  prefix: "beacon",
  inputDir: "./src",
  outputDir: "./dist",
  fontTypes: ["ttf", "woff", "woff2", "eot"],
  assetTypes: ["json"],
  fontHeight: 0,
  descent: 0,
  normalize: true,
}).then(() => {
  console.log("Beacons font generated!");
});
