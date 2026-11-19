import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CanvasViewer from "./CanvasViewer";

const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: {
        from: "/canvas",
        returnToPublishReview: true,
        projectName: "Community Impact",
      },
    }),
    useParams: () => ({ canvasId: "10" }),
  }),
  { virtual: true }
);

describe("CanvasViewer pre-publish preview", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    mockNavigate.mockClear();
  });

  it("returns to the publish review after inspecting a page", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        project: {
          name: "Community Impact",
          pages: [{
            canvasId: 10,
            name: "Overview",
            width: 1920,
            height: 1080,
            backgroundColor: "#ffffff",
            components: [],
          }],
        },
      }),
    });

    render(<CanvasViewer />);

    expect(await screen.findByText("Page 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "← Back to publish review" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/canvas",
        {
          state: {
          reopenPublishReview: "10",
          projectName: "Community Impact",
          },
        }
      );
    });
  });
});
