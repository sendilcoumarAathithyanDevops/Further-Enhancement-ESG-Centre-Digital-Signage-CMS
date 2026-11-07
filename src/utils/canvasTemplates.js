const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

const createClientId = (prefix = "local") =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function normaliseComponent(component = {}) {
  return {
    ...component,
    componentId: undefined,
    clientId: createClientId("widget"),
    type: component.type || "text",
    contentText: component.contentText ?? "",
    filePath: component.filePath || null,
    externalUrl: component.externalUrl || null,
    positionX: Number(component.positionX) || 0,
    positionY: Number(component.positionY) || 0,
    width: Number(component.width) || 300,
    height: Number(component.height) || 200,
    rotation: Number(component.rotation) || 0,
    layerOrder: Number(component.layerOrder) || 1,
    style:
      component.style && typeof component.style === "object"
        ? cloneValue(component.style)
        : {},
  };
}

function normalisePage(page = {}, index = 0) {
  return {
    ...page,
    canvasId: undefined,
    clientId: createClientId("canvas"),
    name: page.name || `Page ${index + 1}`,
    order: index + 1,
    width: Number(page.width) || CANVAS_WIDTH,
    height: Number(page.height) || CANVAS_HEIGHT,
    backgroundColor: page.backgroundColor || "#ffffff",
    backgroundImagePath: page.backgroundImagePath || null,
    backgroundSettings:
      page.backgroundSettings &&
      typeof page.backgroundSettings === "object"
        ? cloneValue(page.backgroundSettings)
        : {
            widgetKind: "backgroundSettings",
            backgroundFit: "fill",
            backgroundImageOpacity: 1,
            backgroundColorOpacity: 1,
            backgroundPositionX: 50,
            backgroundPositionY: 50,
            backgroundScale: 1,
            preserveAspectRatio: true,
          },
    transitionSettings:
      page.transitionSettings &&
      typeof page.transitionSettings === "object"
        ? cloneValue(page.transitionSettings)
        : {
            type: "none",
          },
    components: Array.isArray(page.components)
      ? page.components.map(normaliseComponent)
      : [],
  };
}

function getPresetTemplatePages(templateName) {
    if (templateName === "project-showcase") {
      return Array.from({ length: 3 }, (_, index) => ({
        name: `Project Showcase ${index + 1}`,
        backgroundColor: "#f2f8f4",
        components: [
          {
            type: index === 0 ? "image" : "text",
            contentText: index === 0 ? "" : `Project showcase page ${index + 1}`,
            positionX: index === 0 ? 240 : 160,
            positionY: 180,
            width: index === 0 ? 1440 : 1600,
            height: index === 0 ? 720 : 320,
          },
          {
            type: "text",
            contentText: index === 0 ? "Project Showcase" : "",
            positionX: 160,
            positionY: index === 0 ? 80 : 520,
            width: 1600,
            height: 120,
          },
        ],
      }));
    }

    if (templateName === "video-presentation") {
      return [
        {
          name: "Video Presentation",
          backgroundColor: "#000000",
          components: [
            {
              type: "video",
              contentText: "",
              positionX: 120,
              positionY: 80,
              width: 1680,
              height: 920,
            },
          ],
        },
      ];
    }

    return [];
}

function getTemplatePages(template) {
  if (!template || typeof template !== "object") {
    return [];
  }

  if (Array.isArray(template.pages)) {
    return template.pages;
  }

  if (Array.isArray(template.templateData?.pages)) {
    return template.templateData.pages;
  }

  if (Array.isArray(template.template_data?.pages)) {
    return template.template_data.pages;
  }

  return [];
}

export function createBlankPage(pageNumber = 1) {
  return normalisePage(
    {
      name: `Page ${pageNumber}`,
      order: pageNumber,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: "#ffffff",
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
    },
    pageNumber - 1
  );
}

export function createPageFromTemplate(template = null, pageNumber = 1) {
  if (template === "blank" || !template) {
    return createBlankPage(pageNumber);
  }

  if (typeof template === "object") {
    const pages = getTemplatePages(template);
    const selectedPage = pages[pageNumber - 1] || pages[0];

    if (selectedPage) {
      return normalisePage(selectedPage, pageNumber - 1);
    }
  }

  const presetPages = getPresetTemplatePages(template);
  if (presetPages.length > 0) {
    const selectedPage = presetPages[pageNumber - 1] || presetPages[0];
    return normalisePage(selectedPage, pageNumber - 1);
  }

  return createBlankPage(pageNumber);
}

export function createPagesFromTemplate(template, pageCount) {
  const presetPages = getPresetTemplatePages(template);
  if (presetPages.length > 0) {
    const count =
      Number.isInteger(pageCount) && pageCount > 0
        ? Math.min(pageCount, presetPages.length)
        : presetPages.length;

    return Array.from({ length: count }, (_, index) => {
      const preset = presetPages[index] || presetPages[0];
      return normalisePage(preset, index);
    });
  }

  let templateData = template?.template_data || template;

  if (typeof templateData === "string") {
    try {
      templateData = JSON.parse(templateData);
    } catch {
      templateData = null;
    }
  }

  const templatePages = Array.isArray(templateData?.pages)
    ? templateData.pages
    : [];

  if (templatePages.length === 0) {
    return [createBlankPage(1)];
  }

  return templatePages.map((page, index) => {
    const copiedPage = cloneValue(page);

    return {
      ...copiedPage,
      canvasId: undefined,
      clientId: createClientId("canvas"),
      name: copiedPage.name || `Page ${index + 1}`,
      order: index + 1,
      width: copiedPage.width || 1920,
      height: copiedPage.height || 1080,
      backgroundColor: copiedPage.backgroundColor || "#ffffff",
      backgroundImagePath: copiedPage.backgroundImagePath || null,
      backgroundSettings: copiedPage.backgroundSettings || {},
      transitionSettings: copiedPage.transitionSettings || { type: "none" },
      components: Array.isArray(copiedPage.components)
        ? copiedPage.components.map((component) => ({
            ...cloneValue(component),
            componentId: undefined,
            clientId: createClientId("widget"),
          }))
        : [],
    };
  });
}