const db = require("../db");

const createClientId = () =>
  `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const textComponent = (
  contentText,
  positionX,
  positionY,
  width,
  height,
  style = {}
) => ({
  clientId: createClientId(),
  type: "text",
  contentText,
  filePath: null,
  externalUrl: null,
  positionX,
  positionY,
  width,
  height,
  rotation: 0,
  layerOrder: 1,
  style: {
    fontSize: 26,
    color: "#16352a",
    fontWeight: "600",
    textAlign: "left",
    ...style,
  },
});

const imagePlaceholder = (
  label,
  positionX,
  positionY,
  width,
  height,
  style = {}
) => ({
  clientId: createClientId(),
  type: "image",
  contentText: label,
  filePath: null,
  externalUrl: null,
  positionX,
  positionY,
  width,
  height,
  rotation: 0,
  layerOrder: 1,
  style: {
    widgetKind: "image",
    displayMode: "individual",
    objectFit: "cover",
    lockAspectRatio: true,
    aspectRatio: 16 / 9,
    ...style,
  },
});

const videoPlaceholder = (
  label,
  positionX,
  positionY,
  width,
  height,
  style = {}
) => ({
  clientId: createClientId(),
  type: "video",
  contentText: label,
  filePath: null,
  externalUrl: null,
  positionX,
  positionY,
  width,
  height,
  rotation: 0,
  layerOrder: 1,
  style: {
    widgetKind: "video",
    autoPlay: true,
    muted: true,
    loop: true,
    playsInline: true,
    lockAspectRatio: true,
    aspectRatio: 16 / 9,
    ...style,
  },
});

function createBasePage(pageNumber, backgroundColor) {
  return {
    clientId: createClientId(),
    name: `Page ${pageNumber}`,
    order: pageNumber,
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
    transitionSettings: {
      type: "none",
    },
    components: [],
  };
}

function createCoverPage(pageNumber, backgroundColor) {
  const page = createBasePage(pageNumber, backgroundColor);

  page.components = [
    textComponent("Project Title", 120, 140, 1680, 70, {
      fontSize: 36,
      fontWeight: "700",
    }),

    textComponent("Project Subtitle", 120, 230, 1680, 60, {
      fontSize: 22,
      color: "#666666",
      fontWeight: "400",
    }),

    imagePlaceholder("Upload Cover Image", 120, 330, 760, 450),

    textComponent("Project Overview", 940, 330, 840, 180, {
      fontSize: 22,
      backgroundColor: "#f3f5f6",
    }),

    textComponent("Objectives / Key Information", 940, 560, 840, 220, {
      fontSize: 22,
      backgroundColor: "#f3f5f6",
    }),
  ];

  return page;
}

function createContentPage(pageNumber, backgroundColor) {
  const page = createBasePage(pageNumber, backgroundColor);

  page.components = [
    textComponent("Project Gallery", 120, 130, 1680, 70, {
      fontSize: 34,
      fontWeight: "700",
    }),

    imagePlaceholder("Upload Image 1", 120, 240, 620, 300),

    imagePlaceholder("Upload Image 2", 120, 590, 620, 300),

    textComponent("Description", 820, 240, 760, 260, {
      fontSize: 22,
      backgroundColor: "#f3f5f6",
    }),

    textComponent("Results / Impact", 820, 540, 760, 260, {
      fontSize: 22,
      backgroundColor: "#f3f5f6",
    }),
  ];

  return page;
}

function createVideoPage(pageNumber, backgroundColor) {
  const page = createBasePage(pageNumber, backgroundColor);

  page.components = [
    textComponent("Project Video", 120, 130, 1680, 70, {
      fontSize: 34,
      fontWeight: "700",
    }),

    videoPlaceholder(
      "Upload Project Video",
      260,
      230,
      1400,
      620,
      {
        borderRadius: 16,
      }
    ),
  ];

  return page;
}

function createTemplatePages(templateKey) {
  if (templateKey === "blank") {
    return [createBasePage(1, "#ffffff")];
  }

  let backgroundColor = "#ffffff";

  switch (templateKey) {
    case "environmental-project":
      backgroundColor = "#EAF7EC";
      break;

    case "social-project":
      backgroundColor = "#E8E8FF";
      break;

    case "governance-project":
      backgroundColor = "#F4EEFF";
      break;

    default:
      break;
  }

  return [
    createCoverPage(1, backgroundColor),
    createContentPage(2, backgroundColor),
    createVideoPage(3, backgroundColor),
  ];
}

const templates = [
  {
    key: "blank",
    name: "Blank Canvas",
    description: "Start with an empty canvas",
    category: "general",
  },
  {
    key: "environmental-project",
    name: "Environmental Project",
    description:
      "Showcase sustainability efforts and environmental impact",
    category: "environmental",
  },
  {
    key: "social-project",
    name: "Social Project",
    description:
      "Highlight community initiatives and social impact",
    category: "social",
  },
  {
    key: "governance-project",
    name: "Governance Project",
    description:
      "Present governance practices and organisational values",
    category: "governance",
  },
];

async function seedTemplates() {
  try {
    for (const template of templates) {
      const templateData = {
        pages: createTemplatePages(template.key),
      };

      await db.query(
        `
          INSERT INTO canvas_templates (
            template_key,
            template_name,
            description,
            category,
            template_data
          )
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            template_name = VALUES(template_name),
            description = VALUES(description),
            category = VALUES(category),
            template_data = VALUES(template_data)
        `,
        [
          template.key,
          template.name,
          template.description,
          template.category,
          JSON.stringify(templateData),
        ]
      );
    }

    console.log("Canvas templates inserted successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to insert templates:", error);
    process.exit(1);
  }
}

seedTemplates();