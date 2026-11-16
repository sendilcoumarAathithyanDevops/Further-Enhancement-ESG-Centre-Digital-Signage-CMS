import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AISupportBubble from "./AISupportBubble";

const originalFetch = global.fetch;
const originalScrollIntoView = Element.prototype.scrollIntoView;
const originalUser = localStorage.getItem("user");
const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({ useNavigate: () => mockNavigate }),
  { virtual: true }
);

describe("AI support template creation", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
    if (originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete Element.prototype.scrollIntoView;
    }
    if (originalUser === null) {
      localStorage.removeItem("user");
    } else {
      localStorage.setItem("user", originalUser);
    }
  });

  it.each([
    "How do I create templates?",
    "I'm creating a new layout, can you help?",
    "Can you make me an environmental template?",
  ])("offers template choices for varied request: %s", async (request) => {
    global.fetch = jest.fn();
    render(<AISupportBubble />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI support chat" }));

    const input = screen.getByRole("textbox", { name: "Support message" });
    fireEvent.change(input, { target: { value: request } });
    fireEvent.submit(input.closest("form"));

    expect(
      await screen.findByText("What kind of template would you like to use?")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Environmental project" })
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("offers template choices and saves the selected design", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Created the reusable "Sustainability Showcase" template.',
        template: {
          templateId: 7,
          name: "Sustainability Showcase",
          category: "environmental",
          pages: [{ name: "Overview", components: [] }],
        },
      }),
    });

    localStorage.setItem("user", JSON.stringify({ role: "producer" }));
    render(<AISupportBubble />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI support chat" }));

    const input = screen.getByRole("textbox", { name: "Support message" });
    fireEvent.change(input, { target: { value: "Please create a template" } });
    fireEvent.submit(input.closest("form"));

    expect(
      await screen.findByText("What kind of template would you like to use?")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Environmental project" })
    );
    expect(
      screen.getByText(/What should the template include\?/i)
    ).toBeInTheDocument();

    fireEvent.change(input, {
      target: {
        value: "A sustainability showcase with a title, metrics, and image placeholders.",
      },
    });
    fireEvent.submit(input.closest("form"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/templates/ai-generated",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            kind: "Environmental project (environmental)",
            details:
              "A sustainability showcase with a title, metrics, and image placeholders.",
          }),
        })
      );
    });
    expect(
      await screen.findByText(
        'Created the reusable "Sustainability Showcase" template.'
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));
    expect(mockNavigate).toHaveBeenCalledWith("/canvas/new", {
      state: {
        template: {
          templateId: 7,
          name: "Sustainability Showcase",
          category: "environmental",
          pages: [{ name: "Overview", components: [] }],
        },
      },
    });
  });
});
