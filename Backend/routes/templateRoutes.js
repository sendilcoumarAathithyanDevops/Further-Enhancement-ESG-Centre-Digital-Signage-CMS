const express = require("express");
const db = require("../db");

const router = express.Router();

const VALID_TEMPLATE_CATEGORIES = new Set([
  "general",
  "environmental",
  "social",
  "governance",
]);

function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in to continue.",
    });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Administrator access is required.",
    });
  }

  return next();
}

function parseTemplateData(value) {
  if (!value) {
    return { pages: [] };
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return { pages: [] };
  }
}

function mapTemplate(row) {
  const templateData = parseTemplateData(row.template_data);

  return {
    templateId: Number(row.template_id),
    key: row.template_key,
    name: row.template_name,
    description: row.description || "",
    category: row.category || "general",
    isActive: Boolean(row.is_active),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pages: Array.isArray(templateData.pages)
      ? templateData.pages
      : [],
  };
}

// Used by producers when selecting a template.
// Only active templates are returned.
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        template_id,
        template_key,
        template_name,
        description,
        category,
        template_data,
        is_active,
        created_by,
        created_at,
        updated_at
      FROM canvas_templates
      WHERE is_active = 1
      ORDER BY template_id ASC
    `);

    return res.json({
      success: true,
      templates: rows.map(mapTemplate),
    });
  } catch (error) {
    console.error("Load templates error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load templates.",
    });
  }
});

// Admin template list.
// This includes inactive templates as well.
router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        template_id,
        template_key,
        template_name,
        description,
        category,
        template_data,
        is_active,
        created_by,
        created_at,
        updated_at
      FROM canvas_templates
      ORDER BY template_id ASC
    `);

    return res.json({
      success: true,
      templates: rows.map(mapTemplate),
    });
  } catch (error) {
    console.error("Admin load templates error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load templates.",
    });
  }
});

// Load one existing template for editing.
router.get("/admin/:templateId", requireAdmin, async (req, res) => {
  try {
    const templateId = Number.parseInt(req.params.templateId, 10);

    if (!Number.isInteger(templateId) || templateId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid template ID.",
      });
    }

    const [rows] = await db.query(
      `
        SELECT
          template_id,
          template_key,
          template_name,
          description,
          category,
          template_data,
          is_active,
          created_by,
          created_at,
          updated_at
        FROM canvas_templates
        WHERE template_id = ?
        LIMIT 1
      `,
      [templateId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Template not found.",
      });
    }

    return res.json({
      success: true,
      template: mapTemplate(rows[0]),
    });
  } catch (error) {
    console.error("Load template error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load the template.",
    });
  }
});

// Update an existing template only.
// There is intentionally no POST and no DELETE route.
router.put("/admin/:templateId", requireAdmin, async (req, res) => {
  try {
    const templateId = Number.parseInt(req.params.templateId, 10);

    if (!Number.isInteger(templateId) || templateId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid template ID.",
      });
    }

    const name =
      typeof req.body.name === "string"
        ? req.body.name.trim()
        : "";

    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : "";

    const category =
      typeof req.body.category === "string"
        ? req.body.category.trim().toLowerCase()
        : "";

    const pages = Array.isArray(req.body.pages)
      ? req.body.pages
      : [];

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Template name is required.",
      });
    }

    if (name.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Template name must be 150 characters or fewer.",
      });
    }

    if (description.length > 255) {
      return res.status(400).json({
        success: false,
        message: "Description must be 255 characters or fewer.",
      });
    }

    if (!VALID_TEMPLATE_CATEGORIES.has(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid template category.",
      });
    }

    if (pages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "The template must contain at least one page.",
      });
    }

    if (pages.length > 50) {
      return res.status(400).json({
        success: false,
        message: "A template cannot contain more than 50 pages.",
      });
    }

    for (const [index, page] of pages.entries()) {
      const pageName =
        typeof page?.name === "string"
          ? page.name.trim()
          : "";

      if (!pageName) {
        return res.status(400).json({
          success: false,
          message: `Page ${index + 1} must have a name.`,
        });
      }

      if (
        page.components !== undefined &&
        !Array.isArray(page.components)
      ) {
        return res.status(400).json({
          success: false,
          message: `Page ${index + 1} has invalid components.`,
        });
      }
    }

    const [existingRows] = await db.query(
      `
        SELECT template_id
        FROM canvas_templates
        WHERE template_id = ?
        LIMIT 1
      `,
      [templateId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Template not found.",
      });
    }

    const templateData = {
      pages,
    };

    await db.query(
      `
        UPDATE canvas_templates
        SET
          template_name = ?,
          description = ?,
          category = ?,
          template_data = ?,
          created_by = ?
        WHERE template_id = ?
      `,
      [
        name,
        description || null,
        category,
        JSON.stringify(templateData),
        req.session.user.user_id,
        templateId,
      ]
    );

    const [updatedRows] = await db.query(
      `
        SELECT
          template_id,
          template_key,
          template_name,
          description,
          category,
          template_data,
          is_active,
          created_by,
          created_at,
          updated_at
        FROM canvas_templates
        WHERE template_id = ?
        LIMIT 1
      `,
      [templateId]
    );

    return res.json({
      success: true,
      message: "Template updated successfully.",
      template: mapTemplate(updatedRows[0]),
    });
  } catch (error) {
    console.error("Update template error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update the template.",
    });
  }
});

module.exports = router;