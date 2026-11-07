import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CanvasPageTabs from "../components/CanvasPageTabs";
import WidgetSidebar from "../components/editor/WidgetSidebar";
import InteractiveCanvas from "../components/editor/InteractiveCanvas";
import TextWidgetModal from "../components/editor/TextWidgetModal";
import ImageUploadModal from "../components/editor/ImageUploadModal";
import ImageSettingsModal from "../components/editor/ImageSettingsModal";
import VideoUploadModal from "../components/editor/VideoUploadModal";
import BackgroundModal from "../components/editor/BackgroundModal";
import TransitionModal from "../components/editor/TransitionModal";
import CanvasPreview from "../components/CanvasPreview";
import { createPageFromTemplate } from "../utils/canvasTemplates";
import { API_BASE_URL, createClientId } from "../utils/media";
import { normaliseBackgroundSettings } from "../utils/backgroundSettings";
import "./CanvasEditor.css";

const CATEGORY_OPTIONS = [
    { value: "general", label: "General" },
    { value: "environmental", label: "Environmental" },
    { value: "social", label: "Social" },
    { value: "governance", label: "Governance" },
];

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

const VALID_TRANSITION_TYPES = new Set([
    "none",
    "fade",
    "slide-left",
    "slide-right",
    "slide-up",
    "slide-down",
    "zoom",
]);

const HEADER_HEIGHT = 70;
const FOOTER_HEIGHT = 40;

const MIN_Y = HEADER_HEIGHT;
const MAX_Y = CANVAS_HEIGHT - FOOTER_HEIGHT;

function widgetKey(component) {
    return component.componentId || component.clientId;
}

function normaliseLoadedComponent(component) {
    return {
        ...component,
        clientId: component.clientId || createClientId("loaded-widget"),
        style:
            component.style && typeof component.style === "object" ? component.style : {},
    };
}

function normaliseLoadedPage(page, index) {
    return {
        ...page,
        clientId: `canvas-${page.canvasId || index}-${Date.now()}-${index}`,
        order: index + 1,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: page.backgroundColor || "#ffffff",
        backgroundImagePath: page.backgroundImagePath || null,
        backgroundSettings: normaliseBackgroundSettings(page.backgroundSettings || {}),
        transitionSettings: {
            type: VALID_TRANSITION_TYPES.has(page.transitionSettings?.type)
                ? page.transitionSettings.type
                : "none",
        },
        components: Array.isArray(page.components)
            ? page.components.map(normaliseLoadedComponent)
            : [],
    };
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}

function fitSizeForRatio(maxWidth, maxHeight, ratioValue) {
    const ratio = Number(ratioValue) > 0 ? Number(ratioValue) : 16 / 9;
    let width = maxWidth;
    let height = width / ratio;

    if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
    }

    return { width: Math.round(width), height: Math.round(height) };
}

function getComponentMediaPaths(component) {
    const paths = new Set();
    if (component?.filePath?.startsWith("/uploads/")) paths.add(component.filePath);
    if (Array.isArray(component?.style?.imagePaths)) {
        component.style.imagePaths.forEach((path) => {
            if (path?.startsWith("/uploads/")) paths.add(path);
        });
    }
    return paths;
}

function getPageMediaPaths(page) {
    const paths = new Set();
    if (page?.backgroundImagePath?.startsWith("/uploads/")) {
        paths.add(page.backgroundImagePath);
    }
    (page?.components || []).forEach((component) => {
        getComponentMediaPaths(component).forEach((path) => paths.add(path));
    });
    return paths;
}

function getAllMediaPaths(pages) {
    const paths = new Set();
    pages.forEach((page) => getPageMediaPaths(page).forEach((path) => paths.add(path)));
    return paths;
}

function makeTextArea(position, layerOrder) {
    return {
        clientId: createClientId("text-area"),
        type: "text",
        contentText: "Double-click to edit this text area.",
        filePath: null,
        externalUrl: null,
        positionX: position.positionX,
        positionY: position.positionY,
        width: 760,
        height: 310,
        rotation: 0,
        layerOrder,
        style: {
            widgetKind: "textArea",
            fontSize: 18,
            fontWeight: 400,
            color: "#000000",
            backgroundColor: "#ffffff",
            backgroundOpacity: 0.8,
            padding: 24,
            textAlign: "left",
        },
    };
}

function TemplateEditor() {
    const { templateId } = useParams();
    const navigate = useNavigate();
    const isEditing = Boolean(templateId);
    const backPath = "/manage-templates";
    const backLabel = "← Back to Manage Templates";

    const [templateName, setTemplateName] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [pages, setPages] = useState([]);
    const [selectedPageId, setSelectedPageId] = useState("");
    const [selectedWidgetId, setSelectedWidgetId] = useState(null);
    const [modal, setModal] = useState(null);
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [saveError, setSaveError] = useState("");
    const [showPreview, setShowPreview] = useState(false);
    const [originalPages, setOriginalPages] = useState([]);
    const [validationErrors, setValidationErrors] = useState({});
    const [isDirty, setIsDirty] = useState(false);
    const temporaryUploadsRef = useRef(new Set());

    const selectedPage = useMemo(
        () => pages.find((page) => page.clientId === selectedPageId) || pages[0],
        [pages, selectedPageId]
    );

    useEffect(() => {
        if (!isEditing && originalPages.length === 0 && pages.length > 0) {
            setOriginalPages(structuredClone(pages));
        }
    }, [isEditing, pages, originalPages]);

    useEffect(() => {
        if (!isEditing) return undefined;

        const controller = new AbortController();

        const loadTemplate = async () => {
            try {
                setLoading(true);
                setLoadError("");


                const response = await fetch(`${API_BASE_URL}/api/templates/admin/${templateId}`, {
                    credentials: "include",
                    signal: controller.signal,
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Unable to load this template.");
                }

                const loadedPages =(data.template.pages || []).map(normaliseLoadedPage);
                const fallbackPage = createPageFromTemplate("blank", 1);
                const nextPages = loadedPages.length > 0 ? loadedPages : [fallbackPage];

                setTemplateName(data.template.name || "");
                setDescription(data.template.description || "");
                setCategory(data.template.category || "");

                setPages(nextPages);
                setOriginalPages(structuredClone(nextPages));
                setSelectedPageId(nextPages[0].clientId);
                setSelectedWidgetId(null);
                temporaryUploadsRef.current.clear();
                setIsDirty(false);
            } catch (requestError) {
                if (requestError.name !== "AbortError") {
                    setLoadError(requestError.message || "Unable to load this template.");
                }
            } finally {
                setLoading(false);
            }
        };

        loadTemplate();
        return () => controller.abort();
 }, [templateId, isEditing]);

    useEffect(() => {
        if (!isDirty) return undefined;

        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };

        const handleDocumentClick = (event) => {
            const anchor = event.target.closest("a[href]");
            if (!anchor || anchor.target === "_blank") return;

            const targetUrl = new URL(anchor.href, window.location.href);
            if (targetUrl.origin !== window.location.origin) return;

            const confirmed = window.confirm(
                "You have unsaved changes. Are you sure you want to leave?"
            );

            if (!confirmed) {
                event.preventDefault();
                event.stopPropagation();
            } else {
                setIsDirty(false);
            }
        };

        const handlePopState = () => {
            const confirmed = window.confirm(
                "You have unsaved changes. Are you sure you want to leave?"
            );

            if (confirmed) {
                setIsDirty(false);
            } else {
                window.history.forward();
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        window.addEventListener("popstate", handlePopState);
        document.addEventListener("click", handleDocumentClick, true);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.removeEventListener("popstate", handlePopState);
            document.removeEventListener("click", handleDocumentClick, true);
        };
    }, [isDirty]);

    const markDirty = () => setIsDirty(true);

    const handleFieldChange = (setter) => (event) => {
        setter(event.target.value);
        markDirty();
    };

    const handleReplaceImage = ({ paths }) => {
        if (!modal?.componentId) return;

        const newPath = paths[0];
        if (!newPath) return;

        temporaryUploadsRef.current.add(newPath);

        updateWidget(modal.componentId, {
            filePath: newPath,
            style: {
                ...modal.initialComponent.style,
                imagePaths: [newPath],
            },
        });

        setModal(null);
    };

    const updateSelectedPage = (updater) => {
        setPages((currentPages) =>
            currentPages.map((page) =>
                page.clientId === selectedPageId
                    ? typeof updater === "function"
                        ? updater(page)
                        : { ...page, ...updater }
                    : page
            )
        );
        markDirty();
    };

    const deleteUpload = async (path) => {
        try {
            await fetch(`${API_BASE_URL}/api/uploads`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ path }),
            });
        } catch {
            // A later backend cleanup can remove an unreferenced file if this request fails.
        }
    };

    const cleanupUnusedTemporaryPaths = async (nextPages) => {
        const usedPaths = getAllMediaPaths(nextPages);
        const unused = [...temporaryUploadsRef.current].filter((path) => !usedPaths.has(path));
        await Promise.all(unused.map(deleteUpload));
        unused.forEach((path) => temporaryUploadsRef.current.delete(path));
    };

    const cleanupAllTemporaryPaths = async () => {
        const paths = [...temporaryUploadsRef.current];
        await Promise.all(paths.map(deleteUpload));
        temporaryUploadsRef.current.clear();
    };

    const handleAddPage = () => {
        const newPage = createPageFromTemplate("blank", pages.length + 1);
        setPages((currentPages) => [
            ...currentPages,
            { ...newPage, order: currentPages.length + 1 },
        ]);
        setSelectedPageId(newPage.clientId);
        setSelectedWidgetId(null);
        markDirty();
    };

    const handleRenamePage = (pageId, name) => {
        setPages((currentPages) =>
            currentPages.map((page) =>
                page.clientId === pageId ? { ...page, name } : page
            )
        );
        markDirty();
    };

    const handleDeletePage = async (pageId) => {
        if (pages.length === 1) return;

        const pageToDelete = pages.find((page) => page.clientId === pageId);
        const confirmed = window.confirm(`Delete ${pageToDelete?.name || "this page"}?`);
        if (!confirmed) return;

        const remainingPages = pages
            .filter((page) => page.clientId !== pageId)
            .map((page, index) => ({ ...page, order: index + 1 }));

        setPages(remainingPages);
        if (selectedPageId === pageId) {
            setSelectedPageId(remainingPages[0].clientId);
            setSelectedWidgetId(null);
        }
        await cleanupUnusedTemporaryPaths(remainingPages);
        markDirty();
    };

    const handleMovePage = (pageId, direction) => {
        const currentIndex = pages.findIndex((page) => page.clientId === pageId);
        const targetIndex = currentIndex + direction;

        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= pages.length) return;

        const reordered = [...pages];
        [reordered[currentIndex], reordered[targetIndex]] = [
            reordered[targetIndex],
            reordered[currentIndex],
        ];

        setPages(reordered.map((page, index) => ({ ...page, order: index + 1 })));
        markDirty();
    };

    const handleReorderPages = (draggedPageId, targetPageId) => {
        if (draggedPageId === targetPageId) return;

        setPages((currentPages) => {
            const fromIndex = currentPages.findIndex((page) => page.clientId === draggedPageId);
            const toIndex = currentPages.findIndex((page) => page.clientId === targetPageId);
            if (fromIndex < 0 || toIndex < 0) return currentPages;

            const reordered = [...currentPages];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, moved);

            return reordered.map((page, index) => ({ ...page, order: index + 1 }));
        });
        markDirty();
    };

    const getDropPosition = (rawPosition, width, height) => ({
        positionX: Math.round(
            clamp(rawPosition.positionX - width / 2, 0, CANVAS_WIDTH - width)
        ),
        positionY: Math.round(
            clamp(rawPosition.positionY - height / 2, MIN_Y, MAX_Y - height)
        ),
    });

    const getNextLayer = () =>
        Math.max(1, ...(selectedPage?.components || []).map((item) => Number(item.layerOrder) || 1)) + 1;

    const handleDropWidget = (type, rawPosition) => {
        if (!selectedPage) return;

        if (type === "background") {
            setModal({ type: "background" });
            return;
        }

        if (type === "text") {
            setModal({ type: "text", position: getDropPosition(rawPosition, 900, 130) });
            return;
        }

        if (type === "textArea") {
            const position = getDropPosition(rawPosition, 760, 310);
            const component = makeTextArea(position, getNextLayer());
            updateSelectedPage((page) => ({
                ...page,
                components: [...page.components, component],
            }));
            setSelectedWidgetId(component.clientId);
            return;
        }

        if (type === "image") {
            setModal({ type: "image", position: getDropPosition(rawPosition, 700, 394) });
            return;
        }

        if (type === "video") {
            setModal({ type: "video", position: getDropPosition(rawPosition, 800, 450) });
        }
    };

    const handleAddAtCenter = (type) => {
        handleDropWidget(type, { positionX: CANVAS_WIDTH / 2, positionY: CANVAS_HEIGHT / 2 });
    };

    const findSelectedComponent = (id) =>
        selectedPage?.components.find((component) => widgetKey(component) === id);

    const updateWidget = (id, patch) => {
        updateSelectedPage((page) => ({
            ...page,
            components: page.components.map((component) =>
                widgetKey(component) === id ? { ...component, ...patch } : component
            ),
        }));
    };

    const handleEditWidget = (id) => {
        const component = findSelectedComponent(id);
        if (!component) return;
        const kind = component.style?.widgetKind || component.type;

        if (kind === "text" || kind === "textArea") {
            setModal({ type: kind, componentId: id, initialComponent: component });
        } else if (component.type === "image") {
            setModal({ type: "replaceImage", componentId: id, initialComponent: component, });
        } else if (component.type === "video") {
            setModal({ type: "video", componentId: id, initialComponent: component });
        }
    };

    const handleDuplicateWidget = (id) => {
        const component = findSelectedComponent(id);
        if (!component) return;
        const duplicated = {
            ...component,
            componentId: undefined,
            clientId: createClientId("duplicate"),
            positionX: clamp(Number(component.positionX) + 40, 0, CANVAS_WIDTH - Number(component.width)),
            positionY: clamp(Number(component.positionY) + 40, MIN_Y, MAX_Y - Number(component.height)),
            layerOrder: getNextLayer(),
            style: { ...(component.style || {}) },
        };
        updateSelectedPage((page) => ({ ...page, components: [...page.components, duplicated] }));
        setSelectedWidgetId(duplicated.clientId);
    };

    const handleLayerChange = (id, direction) => {
        const components = selectedPage?.components || [];
        const current = components.find((component) => widgetKey(component) === id);
        if (!current) return;
        const layers = components.map((component) => Number(component.layerOrder) || 1);
        const nextLayer = direction > 0
            ? Math.max(...layers, 1) + 1
            : Math.max(1, Math.min(...layers, 1) - 1);
        updateWidget(id, { layerOrder: nextLayer });
    };

    const handleDeleteWidget = async (id) => {
        const component = findSelectedComponent(id);
        if (!component) return;
        if (!window.confirm("Delete this widget?")) return;

        const nextPages = pages.map((page) =>
            page.clientId === selectedPageId
                ? { ...page, components: page.components.filter((item) => widgetKey(item) !== id) }
                : page
        );
        setPages(nextPages);
        setSelectedWidgetId(null);
        await cleanupUnusedTemporaryPaths(nextPages);
        markDirty();
    };

    const handleTextDone = ({ contentText, style }) => {
        if (modal.componentId) {
            updateWidget(modal.componentId, { contentText, style });
            setSelectedWidgetId(modal.componentId);
        } else {
            const isArea = modal.type === "textArea";
            const component = {
                clientId: createClientId(isArea ? "text-area" : "text"),
                type: "text",
                contentText,
                filePath: null,
                externalUrl: null,
                positionX: modal.position?.positionX ?? 510,
                positionY: modal.position?.positionY ?? 475,
                width: isArea ? 760 : 900,
                height: isArea ? 310 : style.textType === "title" ? 140 : 110,
                rotation: 0,
                layerOrder: getNextLayer(),
                style,
            };
            updateSelectedPage((page) => ({ ...page, components: [...page.components, component] }));
            setSelectedWidgetId(component.clientId);
        }
        setModal(null);
    };

    const handleImagesDone = ({ paths, displayMode, slideshowInterval, settings }) => {
        paths.forEach((path) => temporaryUploadsRef.current.add(path));
        const basePosition = modal.position || { positionX: 610, positionY: 343 };
        const nextLayer = getNextLayer();

        if (displayMode === "slideshow") {
            const firstSettings = settings[0] || { aspectRatio: 16 / 9 };
            const { width, height } = fitSizeForRatio(700, 600, firstSettings.aspectRatio);
            const component = {
                clientId: createClientId("slideshow"),
                type: "image",
                contentText: "Image slideshow",
                filePath: paths[0],
                externalUrl: null,
                positionX: clamp(basePosition.positionX, 0, CANVAS_WIDTH - width),
                positionY: clamp(basePosition.positionY, MIN_Y, MAX_Y - height),
                width,
                height,
                rotation: 0,
                layerOrder: nextLayer,
                style: {
                    widgetKind: "image",
                    displayMode: "slideshow",
                    imagePaths: paths,
                    imageSettings: settings,
                    slideshowInterval,
                    aspectRatioChoice: firstSettings.aspectRatioChoice,
                    aspectRatio: firstSettings.aspectRatio,
                    objectFit: firstSettings.objectFit,
                    focusX: firstSettings.focusX,
                    focusY: firstSettings.focusY,
                    lockAspectRatio: true,
                },
            };
            updateSelectedPage((page) => ({ ...page, components: [...page.components, component] }));
            setSelectedWidgetId(component.clientId);
        } else {
            const components = paths.map((path, index) => {
                const itemSettings = settings[index] || { aspectRatio: 16 / 9 };
                const { width, height } = fitSizeForRatio(610, 520, itemSettings.aspectRatio);
                return {
                    clientId: createClientId("image"),
                    type: "image",
                    contentText: `Image ${index + 1}`,
                    filePath: path,
                    externalUrl: null,
                    positionX: clamp(basePosition.positionX + index * 45, 0, CANVAS_WIDTH - width),
                    positionY: clamp(basePosition.positionY + index * 45, 0, CANVAS_HEIGHT - height),
                    width,
                    height,
                    rotation: 0,
                    layerOrder: nextLayer + index,
                    style: {
                        widgetKind: "image",
                        displayMode: "individual",
                        imagePaths: [path],
                        imageSettings: [itemSettings],
                        aspectRatioChoice: itemSettings.aspectRatioChoice,
                        aspectRatio: itemSettings.aspectRatio,
                        objectFit: itemSettings.objectFit,
                        focusX: itemSettings.focusX,
                        focusY: itemSettings.focusY,
                        lockAspectRatio: true,
                    },
                };
            });
            updateSelectedPage((page) => ({ ...page, components: [...page.components, ...components] }));
            setSelectedWidgetId(components[components.length - 1]?.clientId || null);
        }
        setModal(null);
    };

    const handleImageSettingsDone = (style) => {
        const component = findSelectedComponent(modal.componentId);
        const currentWidth = Number(component?.width) || 610;
        const { width, height } = fitSizeForRatio(
            Math.min(currentWidth, CANVAS_WIDTH),
            CANVAS_HEIGHT,
            style.aspectRatio
        );
        const positionX = clamp(
            Number(component?.positionX) || 0,
            0,
            CANVAS_WIDTH - width
        );
        const positionY = clamp(
            Number(component?.positionY) || MIN_Y,
            MIN_Y,
            MAX_Y - height
        );
        updateWidget(modal.componentId, {
            style,
            width,
            height,
            positionX,
            positionY,
        });
        setModal(null);
    };

    const handleVideoDone = ({ path, volume, delaySeconds }) => {
        if (path && path !== modal.initialComponent?.filePath) {
            temporaryUploadsRef.current.add(path);
        }

        if (modal.componentId) {
            updateWidget(modal.componentId, {
                filePath: path,
                style: {
                    ...(modal.initialComponent?.style || {}),
                    widgetKind: "video",
                    autoPlay: true,
                    loop: true,
                    muted: true,
                    volume: volume ?? modal.initialComponent?.style?.volume ?? 1,
                    delaySeconds: Math.max(0, Math.min(300, Number(delaySeconds) || 0)),
                    playsInline: true,
                    lockAspectRatio: true,
                    aspectRatio: 16 / 9,
                },
            });
            setSelectedWidgetId(modal.componentId);
        } else {
            const position = modal.position || { positionX: 560, positionY: 315 };
            const component = {
                clientId: createClientId("video"),
                type: "video",
                contentText: "Video",
                filePath: path,
                externalUrl: null,
                positionX: position.positionX,
                positionY: position.positionY,
                width: 800,
                height: 450,
                rotation: 0,
                layerOrder: getNextLayer(),
                style: {
                    widgetKind: "video",
                    autoPlay: true,
                    loop: true,
                    muted: true,
                    volume: volume ?? 1,
                    delaySeconds: Math.max(0, Math.min(300, Number(delaySeconds) || 0)),
                    playsInline: true,
                    lockAspectRatio: true,
                    aspectRatio: 16 / 9,
                },
            };
            updateSelectedPage((page) => ({ ...page, components: [...page.components, component] }));
            setSelectedWidgetId(component.clientId);
        }
        setModal(null);
    };

    const handleBackgroundDone = async (background) => {
        if (background.newlyUploadedPath) {
            temporaryUploadsRef.current.add(background.newlyUploadedPath);
        }
        const nextPages = pages.map((page) =>
            page.clientId === selectedPageId
                ? {
                    ...page,
                    backgroundColor: background.backgroundColor,
                    backgroundImagePath: background.backgroundImagePath,
                    backgroundSettings: background.backgroundSettings,
                }
                : page
        );
        setPages(nextPages);
        setModal(null);
        await cleanupUnusedTemporaryPaths(nextPages);
        markDirty();
    };

    const handleTransitionDone = (transition) => {
        const nextPages = pages.map((page) =>
            page.clientId === selectedPageId
                ? { ...page, transitionSettings: transition.transitionSettings }
                : page
        );
        setPages(nextPages);
        setModal(null);
        markDirty();
    };

    const handleResetLayout = () => {
        const currentPage = pages.find(
            (page) => page.clientId === selectedPageId
        );

        if (!currentPage) return;

        const originalPage = originalPages.find(
            (page) => page.order === currentPage.order
        );

        if (!originalPage) return;

        setPages((currentPages) =>
            currentPages.map((page) => {
                if (page.clientId !== selectedPageId) {
                    return page;
                }

                const resetComponents = page.components.map((component, index) => {
                    const originalComponent =
                        originalPage.components[index];

                    if (!originalComponent) {
                        return component;
                    }

                    return {
                        ...component,
                        positionX: originalComponent.positionX,
                        positionY: originalComponent.positionY,
                        width: originalComponent.width,
                        height: originalComponent.height,
                        rotation: originalComponent.rotation,
                        layerOrder: originalComponent.layerOrder,
                    };
                });

                return {
                    ...page,
                    components: resetComponents,
                };
            })
        );

        setSelectedWidgetId(null);
        markDirty();
    };

    const handleDuplicatePage = (pageId) => {
        const pageToCopy = pages.find(
            (page) => page.clientId === pageId
        );

        if (!pageToCopy) return;

        const duplicatedPage = structuredClone(pageToCopy);

        duplicatedPage.clientId = createClientId("canvas");
        duplicatedPage.name = `${pageToCopy.name} Copy`;
        duplicatedPage.order = pages.length + 1;

        duplicatedPage.components =
            duplicatedPage.components.map((component) => ({
                ...component,
                componentId: undefined,
                clientId: createClientId("widget"),
            }));

        const nextPages = [
            ...pages,
            duplicatedPage,
        ];

        setPages(nextPages);
        setSelectedPageId(duplicatedPage.clientId);
        setSelectedWidgetId(null);
        markDirty();
    };

    const validate = () => {
        const errors = {};

        if (!templateName.trim()) {
            errors.templateName = "Template name is required.";
        }

        if (description.length > 255) {
            errors.description = "Template description must be 255 characters or fewer.";
        }

        if (!CATEGORY_OPTIONS.some((option) => option.value === category)) {
            errors.category = "Please select a category.";
        }

        if (pages.length === 0) {
            errors.pages = "The template must have at least one page.";
        }

        if (pages.some((page) => !page.name.trim())) {
            errors.pages = "Every page must have a name.";
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        try {
            setSaving(true);
            setSaveError("");
            await cleanupUnusedTemporaryPaths(pages);

            const payload = {
                name: templateName.trim(),
                description: description.trim(),
                category,
                pages: pages.map((page, index) => ({
                    name: page.name.trim(),
                    order: index + 1,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    backgroundColor: page.backgroundColor || "#ffffff",
                    backgroundImagePath: page.backgroundImagePath || null,
                    backgroundSettings: page.backgroundSettings || {},
                    transitionSettings: page.transitionSettings || {},
                    components: (page.components || []).map((component) => ({
                        type: component.type,
                        contentText: component.contentText,
                        filePath: component.filePath || null,
                        externalUrl: component.externalUrl || null,
                        positionX: Math.round(Number(component.positionX) || 0),
                        positionY: Math.round(Number(component.positionY) || 0),
                        width: Math.round(Number(component.width) || 300),
                        height: Math.round(Number(component.height) || 200),
                        rotation: Number(component.rotation) || 0,
                        layerOrder: Number(component.layerOrder) || 1,
                        style: component.style || {},
                    })),
                })),
            };

            const response = await fetch(
                `${API_BASE_URL}/api/templates/admin/${templateId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Unable to update the template.");
            }

            temporaryUploadsRef.current.clear();
            setIsDirty(false);
            navigate(backPath, {
                replace: true,
                state: {
                    successMessage: "Template updated successfully.",
                },
            });
        } catch (requestError) {
            setSaveError(requestError.message || "Unable to update the template.");
        } finally {
            setSaving(false);
        }
    };

    const handleBack = async () => {
        if (
            isDirty &&
            !window.confirm("You have unsaved changes. Are you sure you want to leave?")
        ) {
            return;
        }

        await cleanupAllTemporaryPaths();
        setIsDirty(false);
        navigate(backPath);
    };

    if (loading) {
        return (
            <div className="canvas-editor-loading" role="status">
                Loading template editor…
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="canvas-editor-error" role="alert">
                <h1>Unable to open template</h1>
                <p>{loadError}</p>
                <button type="button" onClick={() => navigate("/manage-templates")}>
                    Return to Manage Templates
                </button>
            </div>
        );
    }

    return (
        <div className="canvas-editor-page">
            <header className="canvas-editor-header">
                <div>
                    <button type="button" className="button-back" onClick={handleBack}>
                        {backLabel}
                    </button>
                    <h1>Edit Template</h1>
                    <p>Update the template details, pages, and TV-ready widgets.</p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        type="button"
                        className="canvas-editor-save"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving…" : "Save Template"}
                    </button>
                </div>
            </header>

            {saveError && (
                <div className="editor-message editor-message--error" role="alert">
                    {saveError}
                </div>
            )}

            <section className="project-details-card" aria-labelledby="project-details-title">
                <div className="project-details-card__heading">
                    <h2 id="project-details-title">Template details</h2>
                    <span>Name and category are required</span>
                </div>

                <div className="project-details-grid">
                    <label className="editor-field">
                        <span>Template Name</span>
                        <input
                            type="text"
                            value={templateName}
                            maxLength={150}
                            placeholder="Enter the template name"
                            onChange={handleFieldChange(setTemplateName)}
                            aria-invalid={Boolean(validationErrors.templateName)}
                        />
                        {validationErrors.templateName && <small>{validationErrors.templateName}</small>}
                    </label>

                    <label className="editor-field">
                        <span>Category</span>
                        <select
                            value={category}
                            onChange={handleFieldChange(setCategory)}
                            aria-invalid={Boolean(validationErrors.category)}
                        >
                            <option value="">Select a category</option>
                            {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        {validationErrors.category && <small>{validationErrors.category}</small>}
                    </label>

                    <label className="editor-field editor-field--full">
                        <span>Template Description</span>
                        <textarea
                            value={description}
                            rows={4}
                            maxLength={255}
                            placeholder="Describe how this template should be used"
                            onChange={handleFieldChange(setDescription)}
                            aria-invalid={Boolean(validationErrors.description)}
                        />
                        <div className="editor-field__footer">
                            {validationErrors.description ? <small>{validationErrors.description}</small> : <span />}
                            <span>{description.length}/255</span>
                        </div>
                    </label>
                </div>
            </section>

            {validationErrors.pages && (
                <div className="editor-message editor-message--error" role="alert">
                    {validationErrors.pages}
                </div>
            )}

            <CanvasPageTabs
                pages={pages}
                selectedPageId={selectedPageId}
                onSelect={(pageId) => {
                    setSelectedPageId(pageId);
                    setSelectedWidgetId(null);
                }}
                onRename={handleRenamePage}
                onDelete={handleDeletePage}
                onMove={handleMovePage}
                onReorder={handleReorderPages}
                onAdd={handleAddPage}
                onDuplicate={handleDuplicatePage}
            />

            <section className="canvas-editor-workspace">
                <div className="canvas-stage-card">
                    <div className="canvas-stage-card__header">
                        <div>
                            <h2>{selectedPage?.name || "Canvas page"}</h2>
                            <p>Drag, resize, duplicate, layer, and edit widgets on a 1920 × 1080 logical canvas.</p>
                        </div>
                        <div className="canvas-stage-card__actions">
                            <span className="canvas-stage-card__badge">
                                📺 55-inch TV Ready
                            </span>

                            <div className="canvas-stage-card__button-row">
                                <button
                                    type="button"
                                    className="canvas-stage-card__action-btn"
                                    onClick={() => setShowPreview(true)}
                                    title="Preview"
                                >
                                    👁
                                </button>

                                <button
                                    type="button"
                                    className="canvas-stage-card__action-btn"
                                    onClick={() => setModal({ type: "transition" })}
                                    title="Page Transition"
                                >
                                    🎬
                                </button>

                                <button
                                    type="button"
                                    className="canvas-stage-card__action-btn"
                                    onClick={handleResetLayout}
                                    title="Reset Layout"
                                >
                                    🔄
                                </button>
                            </div>
                        </div>
                    </div>

                    <WidgetSidebar onAddAtCenter={handleAddAtCenter} />

                    <div className="canvas-stage-card__frame">
                        <InteractiveCanvas
                            page={selectedPage}
                            projectName={templateName}
                            category={category}
                            selectedWidgetId={selectedWidgetId}
                            onSelectWidget={setSelectedWidgetId}
                            onDropWidget={handleDropWidget}
                            onChangeWidget={updateWidget}
                            onEditWidget={handleEditWidget}
                            onDuplicateWidget={handleDuplicateWidget}
                            onForwardWidget={(id) => handleLayerChange(id, 1)}
                            onBackwardWidget={(id) => handleLayerChange(id, -1)}
                            onDeleteWidget={handleDeleteWidget}
                            onEditBackground={() => setModal({ type: "background" })}
                        />
                    </div>

                    <p className="canvas-stage-card__note">
                        The canvas scales to fit the browser, but widget positions and sizes are stored using the full 1920 × 1080 TV coordinate system.
                    </p>
                </div>
            </section>

            <div className="canvas-editor-mobile-actions">
                <button type="button" className="button-back" onClick={handleBack}>Back</button>
                <button type="button" className="canvas-editor-save" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : "Save Template"}
                </button>
            </div>

            {showPreview && (
                <div
                    className="preview-overlay"
                    onClick={() => setShowPreview(false)}
                >
                    <div
                        className="preview-modal preview-modal--single"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="preview-close"
                            onClick={() => setShowPreview(false)}
                        >
                            ✕
                        </button>

                        <div className="preview-grid preview-grid--single">
                            <div className="preview-grid-item">
                                <CanvasPreview
                                    page={pages.find((page) => page.clientId === selectedPageId) || selectedPage || pages[0]}
                                    pageNumber={pages.findIndex(p => p.clientId === selectedPageId) + 1}
                                    projectName={templateName}
                                    description={description}
                                    category={category}
                                    compact
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {(modal?.type === "text" || modal?.type === "textArea") && (
                <TextWidgetModal
                    mode={modal.type}
                    initialComponent={modal.initialComponent}
                    onClose={() => setModal(null)}
                    onDone={handleTextDone}
                />
            )}

            {modal?.type === "image" && (
                <ImageUploadModal
                    onClose={() => setModal(null)}
                    onDone={handleImagesDone}
                />
            )}

            {modal?.type === "imageSettings" && (
                <ImageSettingsModal
                    component={modal.initialComponent}
                    onClose={() => setModal(null)}
                    onDone={handleImageSettingsDone}
                />
            )}

            {modal?.type === "replaceImage" && (
                <ImageUploadModal
                    onClose={() => setModal(null)}
                    onDone={handleReplaceImage}
                />
            )}

            {modal?.type === "video" && (
                <VideoUploadModal
                    initialComponent={modal.initialComponent}
                    onClose={() => setModal(null)}
                    onDone={handleVideoDone}
                />
            )}

            {modal?.type === "background" && (
                <BackgroundModal
                    page={selectedPage}
                    projectName={templateName}
                    category={category}
                    canvasWidth={CANVAS_WIDTH}
                    canvasHeight={CANVAS_HEIGHT}
                    onClose={() => setModal(null)}
                    onDone={handleBackgroundDone}
                />
            )}

            {modal?.type === "transition" && (
                <TransitionModal
                    pages={pages}
                    selectedPageId={selectedPageId}
                    projectName={templateName}
                    category={category}
                    onClose={() => setModal(null)}
                    onDone={handleTransitionDone}
                />
            )}

        </div>
    );
}

export default TemplateEditor;