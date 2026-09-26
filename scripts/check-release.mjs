import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tag = process.argv[2];
assert.match(
  tag ?? "",
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta|rc)\.[1-9]\d*)?$/,
);
const version = tag.slice(1);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
assert.equal(pkg.version, version, "Tag and package.json version differ");
assert.equal(lock.version, version, "Tag and package-lock.json version differ");
assert.equal(
  lock.packages[""].version,
  version,
  "Lockfile root version differs",
);
console.log(`Release version ${tag} matches package metadata.`);
