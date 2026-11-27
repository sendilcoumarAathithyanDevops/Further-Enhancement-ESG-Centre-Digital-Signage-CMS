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

    expect(
      await screen.findByText(/Confirm to continue; nothing is saved if you cancel\./i)
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and create" }));

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
            confirmed: true,
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
    expect(
      screen.getByText(/Open a new canvas using "Sustainability Showcase"\?/i)
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and open" }));
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

  it("does not create a template when the confirmation is cancelled", async () => {
    global.fetch = jest.fn();
    localStorage.setItem("user", JSON.stringify({ role: "producer" }));
    render(<AISupportBubble />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI support chat" }));

    const input = screen.getByRole("textbox", { name: "Support message" });
    fireEvent.change(input, { target: { value: "Please create a template" } });
    fireEvent.submit(input.closest("form"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Environmental project" })
    );
    fireEvent.change(input, {
      target: { value: "A sustainability project with a title and caption." },
    });
    fireEvent.submit(input.closest("form"));

    expect(
      await screen.findByRole("button", { name: "Confirm and create" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByText("Template creation cancelled. Nothing was saved.")
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows display status as an admin-only tool", () => {
    localStorage.setItem("user", JSON.stringify({ role: "admin" }));
    const { unmount } = render(<AISupportBubble />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI support chat" }));
    expect(screen.getByRole("button", { name: "Display status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dashboard summary" })).toBeInTheDocument();
    unmount();

    localStorage.setItem("user", JSON.stringify({ role: "producer" }));
    render(<AISupportBubble />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI support chat" }));
    expect(screen.queryByRole("button", { name: "Display status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dashboard summary" })).not.toBeInTheDocument();
  });

  it("offers upcoming schedules to producers and sends the request to AI Support", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: "Upcoming and active content schedules:\n- Water Conservation",
        tool: {
          name: "upcoming_content_schedules",
          label: "Upcoming schedules",
        },
      }),
    });
    localStorage.setItem("user", JSON.stringify({ role: "producer" }));
    render(<AISupportBubble />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI support chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Upcoming schedules" }));
    fireEvent.submit(screen.getByRole("textbox", { name: "Support message" }).closest("form"));

    expect(await screen.findByText(/Water Conservation/)).toBeInTheDocument();
    expect(
      screen.getByText("Upcoming schedules", { selector: ".ai-support-tool-badge" })
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5000/ai-support/chat",
      expect.objectContaining({
        body: expect.stringContaining("Show me all upcoming content schedules."),
      })
    );
    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.timeZone).toEqual(expect.any(String));
  });

  it("sends admin display questions and identifies the read-only tool result", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: "1 of 2 registered screens need attention:\n- Lobby (ID 2): offline",
        tool: { name: "display_status", label: "Display status (read-only)" },
      }),
    });
    localStorage.setItem("user", JSON.stringify({ role: "admin" }));
    render(<AISupportBubble />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI support chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Display status" }));
    fireEvent.submit(screen.getByRole("textbox", { name: "Support message" }).closest("form"));

    expect(await screen.findByText(/Lobby \(ID 2\): offline/)).toBeInTheDocument();
    expect(screen.getByText("Display status (read-only)")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5000/ai-support/chat",
      expect.objectContaining({
        body: expect.stringContaining("Which screens need attention?"),
      })
    );
  });

  it("sends admin dashboard questions and displays snapshot metadata", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: "There are 12 projects, and this snapshot is current.",
        tool: {
          name: "dashboard_summary",
          label: "Admin dashboard summary",
          syncedAt: "2026-11-16T07:00:00.000Z",
        },
      }),
    });
    localStorage.setItem("user", JSON.stringify({ role: "admin" }));
    render(<AISupportBubble />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI support chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Dashboard summary" }));
    fireEvent.submit(screen.getByRole("textbox", { name: "Support message" }).closest("form"));

    expect(
      await screen.findByText("There are 12 projects, and this snapshot is current.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Admin dashboard summary · synced/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5000/ai-support/chat",
      expect.objectContaining({
        body: expect.stringContaining("Summarise the admin dashboard"),
      })
    );
  });
});
