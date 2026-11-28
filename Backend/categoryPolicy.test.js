const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isProjectCategoryAllowed,
  isProjectCategoryAssignable,
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

test("default projects can be displayed on any display", () => {
  assert.equal(isProjectCategoryCompatible("default", "environmental"), true);
  assert.equal(isProjectCategoryCompatible("default", "social"), true);
  assert.equal(isProjectCategoryCompatible("default", "default"), true);
});

test("default displays can show any project category", () => {
  assert.equal(isProjectCategoryCompatible("environmental", "default"), true);
  assert.equal(isProjectCategoryCompatible("social", "default"), true);
  assert.equal(isProjectCategoryCompatible("governance", "default"), true);
  assert.equal(isProjectCategoryCompatible("governance", "social"), false);
  assert.equal(isProjectCategoryCompatible("social", "social"), true);
});

test("manual assignments require the same non-default category", () => {
  assert.equal(isProjectCategoryAssignable("environmental", "environmental"), true);
  assert.equal(isProjectCategoryAssignable("environmental", "social"), false);
  assert.equal(isProjectCategoryAssignable("default", "environmental"), false);
  assert.equal(isProjectCategoryAssignable("environmental", "default"), false);
  assert.equal(isProjectCategoryAssignable("default", "default"), false);
});
