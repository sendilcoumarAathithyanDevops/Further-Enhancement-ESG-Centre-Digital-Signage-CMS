import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CanvasEditor from "./CanvasEditor";

let mockSelectedTemplate;

jest.mock(
  "react-router-dom",
  () => ({
    useLocation: () => ({ pathname: "/canvas/new", state: { template: mockSelectedTemplate } }),
    useNavigate: () => jest.fn(),
    useParams: () => ({}),
  }),
  { virtual: true }
);

jest.mock("../components/CanvasPageTabs", () => () => null);
jest.mock("../components/editor/WidgetSidebar", () => () => null);
jest.mock("../components/editor/InteractiveCanvas", () => () => null);
jest.mock("../components/editor/TextWidgetModal", () => () => null);
jest.mock("../components/editor/ImageUploadModal", () => () => null);
jest.mock("../components/editor/ImageSettingsModal", () => () => null);
jest.mock("../components/editor/VideoUploadModal", () => () => null);
jest.mock("../components/editor/BackgroundModal", () => () => null);
jest.mock("../components/editor/TransitionModal", () => () => null);
jest.mock("../components/CanvasPreview", () => () => null);
jest.mock("../components/editor/CollaboratorsModal", () => () => null);

function renderNewCanvas(category = "environmental") {
  localStorage.setItem("user", JSON.stringify({ role: "producer" }));
  mockSelectedTemplate = {
    name: "Starter template",
    category,
    pages: [],
  };
  return render(<CanvasEditor />);
}

describe("CanvasEditor producer workflow", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("uses the selected template's valid ESG category for the new project", () => {
    renderNewCanvas();

    expect(screen.getByLabelText("Category").value).toBe("environmental");
  });

  it("leaves unsupported template categories unselected", () => {
    renderNewCanvas("general");

    expect(screen.getByLabelText("Category").value).toBe("");
  });

  it("focuses the first required field when saving an incomplete project", () => {
    renderNewCanvas();

    fireEvent.click(document.querySelector(".canvas-editor-header .canvas-editor-save"));

    expect(document.activeElement).toBe(document.getElementById("project-name"));
    expect(Boolean(screen.getByText("Project name is required."))).toBe(true);
    expect(document.getElementById("project-name").getAttribute("aria-describedby")).toBe(
      "project-name-error"
    );
  });
});
