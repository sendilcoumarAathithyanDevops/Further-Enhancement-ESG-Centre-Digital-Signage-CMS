const PROJECT_CATEGORIES = new Set(["environmental", "governance", "social"]);
const TEMPLATE_CATEGORIES = new Set([
  "general",
  "environmental",
  "governance",
  "social",
]);

function isProjectCategoryAllowed(category, role) {
  return (
    PROJECT_CATEGORIES.has(category) ||
    (category === "default" && role === "admin")
  );
}

function isTemplateCategoryAllowed(category, role) {
  return (
    TEMPLATE_CATEGORIES.has(category) ||
    (category === "default" && role === "admin")
  );
}

function isProjectCategoryCompatible(category, displayCategory) {
  return (
    category === "default" ||
    displayCategory === "default" ||
    category === displayCategory
  );
}

module.exports = {
  isProjectCategoryAllowed,
  isProjectCategoryCompatible,
  isTemplateCategoryAllowed,
};
