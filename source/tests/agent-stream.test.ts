import test from "node:test";
import assert from "node:assert/strict";
import { progressiveAgentMessage } from "../src/console/agent-stream.ts";

test("structured streaming shows natural message while keeping proposal JSON hidden", () => {
  const result = JSON.stringify({ message: 'Preparando "tres" propuestas.\nRevisa los hechos.', proposals: [{ body: "private structured draft" }] });
  let previous = "";
  for (let end = 1; end <= result.length; end++) {
    const visible = progressiveAgentMessage(result.slice(0, end));
    assert.ok('Preparando "tres" propuestas.\nRevisa los hechos.'.startsWith(visible));
    assert.ok(visible.startsWith(previous));
    assert.ok(!visible.includes("private structured draft"));
    previous = visible;
  }
  assert.equal(previous, 'Preparando "tres" propuestas.\nRevisa los hechos.');
});

test("partial escaped characters and reordered final JSON never expose schema", () => {
  assert.equal(progressiveAgentMessage('{"message":"Propuesta \\u00'), "Propuesta ");
  assert.equal(progressiveAgentMessage('{"message":"Propuesta \\u00e9'), "Propuesta é");
  assert.equal(progressiveAgentMessage('{"proposals":[{"message":"internal"}],"message":"Listo"}'), "Listo");
  assert.equal(progressiveAgentMessage('{"proposals":[{"message":"internal'), "");
});
