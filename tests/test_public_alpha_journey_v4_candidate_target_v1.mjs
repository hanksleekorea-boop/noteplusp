import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./test_public_alpha_journey_v4.mjs", import.meta.url), "utf8");

function verifyCandidateTarget(testSource) {
  assert.match(testSource,/function candidateUrl\(\)/);
  assert.match(testSource,/new URL\(appFile, publicUrl\)/);
  assert.match(testSource,/page\.goto\(candidateUrl\(\)/);
  assert.doesNotMatch(testSource,/page\.goto\(publicUrl \+ \"\?qa=/);
  assert.match(testSource,/NOTEPLUS_EXPECTED_CLOUD_VERSION/);
}

verifyCandidateTarget(source);

let negativeControlCaught = false;
try {
  verifyCandidateTarget(source.replace("page.goto(candidateUrl()", "page.goto(publicUrl + \"?qa=broken\""));
} catch {
  negativeControlCaught = true;
}
assert.equal(negativeControlCaught,true,"negative control must reject a harness that navigates the default root");

console.log("PASS public alpha harness targets the declared candidate with negative control");
