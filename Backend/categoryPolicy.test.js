const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isProjectCategoryAllowed,
  isProjectCategoryCompatible,
  isTemplateCategoryAllowed,
} = require("./categoryPolicy");

test("only administrators can assign the default category", () => {
  assert.equal(isProjectCategoryAllowed("default", "admin"), true);
  assert.equal(isProjectCategoryAllowed("default", "producer"), false);
  assert.equal(isTemplateCategoryAllowed("default", "admin"), true);
  assert.equal(isTemplateCategoryAllowed("default", "producer"), false);
});

test("existing category permissions remain unchanged", () => {
  assert.equal(isProjectCategoryAllowed("environmental", "producer"), true);
  assert.equal(isTemplateCategoryAllowed("general", "producer"), true);
  assert.equal(isProjectCategoryAllowed("general", "admin"), false);
});

test("default projects can be displayed on any ESG display", () => {
  assert.equal(isProjectCategoryCompatible("default", "environmental"), true);
  assert.equal(isProjectCategoryCompatible("default", "social"), true);
  assert.equal(isProjectCategoryCompatible("governance", "social"), false);
  assert.equal(isProjectCategoryCompatible("social", "social"), true);
});
