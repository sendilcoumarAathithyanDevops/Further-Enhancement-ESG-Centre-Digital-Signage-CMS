const assert = require("node:assert/strict");
const test = require("node:test");
const { validateProjectLayout } = require("./layoutValidation");

const page = (components) => ({
  name: "Main page",
  width: 1920,
  height: 1080,
  components,
});

test("blocks publishing a project with no pages", () => {
  const result = validateProjectLayout([]);

  assert.equal(result.canPublish, false);
  assert.equal(result.blockingCount, 1);
  assert.equal(result.issues[0].code, "no-pages");
});

test("blocks missing media, empty text, and widgets outside the canvas", () => {
  const result = validateProjectLayout([
    page([
      { type: "image", positionX: 20, positionY: 100, width: 400, height: 250 },
      { type: "video", positionX: 500, positionY: 100, width: 400, height: 250 },
      {
        type: "text",
        contentText: "  ",
        positionX: 100,
        positionY: 200,
        width: 300,
        height: 100,
        style: {},
      },
      {
        type: "text",
        contentText: "Outside",
        positionX: 1800,
        positionY: 100,
        width: 300,
        height: 100,
        style: {},
      },
    ]),
  ]);

  assert.equal(result.canPublish, false);
  assert.deepEqual(
    result.issues.filter((issue) => issue.severity === "error").map((issue) => issue.code),
    ["missing-image", "missing-video", "empty-text", "widget-out-of-bounds"]
  );
});

test("allows intentional overlap and small text as reviewable warnings", () => {
  const result = validateProjectLayout([
    page([
      {
        type: "text",
        contentText: "Heading",
        positionX: 100,
        positionY: 100,
        width: 500,
        height: 150,
        style: { fontSize: 16 },
      },
      {
        type: "text",
        contentText: "Caption",
        positionX: 200,
        positionY: 120,
        width: 300,
        height: 100,
        style: { fontSize: 18 },
      },
    ]),
  ]);

  assert.equal(result.canPublish, true);
  assert.equal(result.blockingCount, 0);
  assert.ok(result.warningCount >= 3);
  assert.ok(result.issues.some((issue) => issue.code === "small-text"));
  assert.ok(result.issues.some((issue) => issue.code === "widget-overlap"));
});
