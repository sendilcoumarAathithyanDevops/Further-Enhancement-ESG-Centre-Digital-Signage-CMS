const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

const VALID_TEMPLATE_CATEGORIES = new Set([
  "general",
  "environmental",
  "social",
  "governance",
]);
const VALID_WIDGET_TYPES = new Set(["text", "image", "video"]);

function requireTemplateCreator(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in to continue.",
    });
  }

  if (!["producer", "admin"].includes(req.session.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Producer or administrator access is required.",
    });
  }

  return next();
}

function normaliseGeneratedTemplate(template) {
  if (!template || typeof template !== "object") {
    throw new Error("The generated template is invalid.");
  }

  const name = typeof template.name === "string" ? template.name.trim() : "";
  const description =
    typeof template.description === "string" ? template.description.trim() : "";
  const category =
    typeof template.category === "string"
      ? template.category.trim().toLowerCase()
      : "";
  const sourcePages = Array.isArray(template.pages) ? template.pages : [];

  if (!name || name.length > 150) {
    throw new Error("The generated template must have a name of 150 characters or fewer.");
  }
  if (description.length > 255) {
    throw new Error("The generated description must be 255 characters or fewer.");
  }
  if (!VALID_TEMPLATE_CATEGORIES.has(category)) {
    throw new Error("The generated template has an invalid category.");
  }
  if (sourcePages.length === 0 || sourcePages.length > 5) {
    throw new Error("The generated template must contain between one and five pages.");
  }

  const pages = sourcePages.map((sourcePage, pageIndex) => {
    if (!sourcePage || typeof sourcePage !== "object") {
      throw new Error(`Generated page ${pageIndex + 1} is invalid.`);
    }

    const sourceComponents = Array.isArray(sourcePage.components)
      ? sourcePage.components
      : [];
    if (sourceComponents.length === 0) {
      throw new Error(`Generated page ${pageIndex + 1} has no widgets.`);
    }
    if (sourceComponents.length > 20) {
      throw new Error(`Generated page ${pageIndex + 1} has too many widgets.`);
    }

    const backgroundColor =
      typeof sourcePage.backgroundColor === "string" &&
      /^#[0-9a-f]{6}$/i.test(sourcePage.backgroundColor)
        ? sourcePage.backgroundColor
        : "#ffffff";

    const components = sourceComponents.map((component, componentIndex) => {
      if (!component || !VALID_WIDGET_TYPES.has(component.type)) {
        throw new Error(
          `Generated widget ${componentIndex + 1} on page ${pageIndex + 1} has an invalid type.`
        );
      }

      const positionX = Number(component.positionX);
      const positionY = Number(component.positionY);
      const width = Number(component.width);
      const height = Number(component.height);
      if (
        ![positionX, positionY, width, height].every(Number.isFinite) ||
        positionX < 0 ||
        positionY < 0 ||
        width <= 0 ||
        height <= 0 ||
        positionX + width > 1920 ||
        positionY + height > 1080
      ) {
        throw new Error(
          `Generated widget ${componentIndex + 1} on page ${pageIndex + 1} is outside the canvas.`
        );
      }

      const sourceStyle =
        component.style && typeof component.style === "object"
          ? component.style
          : {};
      const color =
        typeof sourceStyle.color === "string" &&
        /^#[0-9a-f]{6}$/i.test(sourceStyle.color)
          ? sourceStyle.color
          : "#16352a";
      const fontSize = Number(sourceStyle.fontSize);

      return {
        type: component.type,
        contentText:
          typeof component.contentText === "string"
            ? component.contentText.slice(0, 1000)
            : "",
        filePath: null,
        externalUrl: null,
        positionX,
        positionY,
        width,
        height,
        rotation: 0,
        layerOrder: componentIndex + 1,
        style: {
          fontSize:
            Number.isFinite(fontSize) && fontSize >= 12 && fontSize <= 120
              ? fontSize
              : 28,
          fontWeight: ["400", "500", "600", "700"].includes(
            String(sourceStyle.fontWeight)
          )
            ? String(sourceStyle.fontWeight)
            : "600",
          color,
          textAlign: ["left", "center", "right"].includes(sourceStyle.textAlign)
            ? sourceStyle.textAlign
            : "left",
          padding: 18,
          ...(component.type === "text" &&
          typeof sourceStyle.backgroundColor === "string" &&
          /^#[0-9a-f]{6}$/i.test(sourceStyle.backgroundColor)
            ? { backgroundColor: sourceStyle.backgroundColor }
            : {}),
          ...(component.type === "image"
            ? { widgetKind: "image", displayMode: "individual", objectFit: "cover" }
            : {}),
          ...(component.type === "video"
            ? { widgetKind: "video", autoPlay: true, muted: true, loop: true }
            : {}),
        },
      };
    });

    return {
      name:
        typeof sourcePage.name === "string" && sourcePage.name.trim()
          ? sourcePage.name.trim().slice(0, 100)
          : `Page ${pageIndex + 1}`,
      order: pageIndex + 1,
      width: 1920,
      height: 1080,
      backgroundColor,
      backgroundImagePath: null,
      backgroundSettings: {
        widgetKind: "backgroundSettings",
        backgroundFit: "fill",
        backgroundImageOpacity: 1,
        backgroundColorOpacity: 1,
        backgroundPositionX: 50,
        backgroundPositionY: 50,
        backgroundScale: 1,
        preserveAspectRatio: true,
      },
      transitionSettings: { type: "none" },
      components,
    };
  });

  return { name, description, category, pages };
}

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

router.post("/ai-generated", requireTemplateCreator, async (req, res) => {
  const kind =
    typeof req.body.kind === "string" ? req.body.kind.trim().slice(0, 120) : "";
  const details =
    typeof req.body.details === "string"
      ? req.body.details.trim().slice(0, 2000)
      : "";

  if (!kind || !details) {
    return res.status(400).json({
      success: false,
      message: "Choose a template type and describe what it should include.",
    });
  }

  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_SUPPORT_MODEL || "bonsai-2";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        think: false,
        options: { num_gpu: 0 },
        messages: [
          {
            role: "system",
            content:
              'Create a polished, editable digital-signage canvas template. Return only JSON with this shape: {"name":"...","description":"...","category":"general|environmental|social|governance","pages":[{"name":"...","backgroundColor":"#RRGGBB","components":[{"type":"text|image|video","contentText":"...","positionX":0,"positionY":0,"width":500,"height":200,"style":{"fontSize":28,"fontWeight":"600","color":"#RRGGBB","textAlign":"left","backgroundColor":"#RRGGBB"}}]}]}. Use 1-3 pages, 1920x1080 coordinates, up to 8 widgets per page, and keep every widget inside the canvas. Use only text, image, and video widget types. Include meaningful placeholder copy and image/video upload labels where useful. Do not include file paths, URLs, markdown, or extra keys. Choose the most appropriate ESG category.',
          },
          {
            role: "user",
            content: `Template type: ${kind}\nUser requirements: ${details}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Ollama template generation error:", data?.error || response.status);
      return res.status(502).json({
        success: false,
        message:
          "Ollama could not generate the template. Check that the configured model is installed and try again.",
      });
    }

    let generated;
    try {
      generated = JSON.parse(data?.message?.content || "");
    } catch {
      throw new Error("Ollama returned invalid template JSON.");
    }

    const template = normaliseGeneratedTemplate(generated);
    const templateKey = `${template.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "ai-template"}-${Date.now()}-${crypto
      .randomBytes(3)
      .toString("hex")}`;
    const [result] = await db.query(
      `INSERT INTO canvas_templates (
        template_key,
        template_name,
        description,
        category,
        template_data,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        templateKey,
        template.name,
        template.description || null,
        template.category,
        JSON.stringify({ pages: template.pages }),
        req.session.user.user_id,
      ]
    );

    return res.status(201).json({
      success: true,
      message: `Created the reusable "${template.name}" template. It is now available in the template selector.`,
      template: {
        templateId: Number(result.insertId),
        key: templateKey,
        name: template.name,
        description: template.description,
        category: template.category,
        isActive: true,
        pages: template.pages,
      },
    });
  } catch (error) {
    console.error("AI template generation error:", error);
    const timedOut = error.name === "AbortError";
    return res.status(timedOut ? 504 : 502).json({
      success: false,
      message: timedOut
        ? "Template generation timed out. Please try again."
        : "Unable to generate and save the template. Please try again.",
    });
  } finally {
    clearTimeout(timeout);
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

// Administrators may update existing templates; no admin create or delete route is exposed.
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