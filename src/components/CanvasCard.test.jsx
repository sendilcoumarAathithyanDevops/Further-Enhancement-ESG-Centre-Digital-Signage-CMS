import { fireEvent, render, screen } from "@testing-library/react";
import CanvasCard from "./CanvasCard";

jest.mock("./CanvasPreview", () => () => <div data-testid="canvas-preview" />);

describe("CanvasCard viewing", () => {
  it("opens project sharing from its card", () => {
    const onShare = jest.fn();
    const project = {
      projectId: 12,
      name: "Environmental Template",
      category: "environmental",
      status: "draft",
      pageCount: 1,
      updatedAt: "2026-11-12T00:00:00.000Z",
    };

    render(
      <CanvasCard
        project={project}
        onView={jest.fn()}
        onEdit={jest.fn()}
        onShare={onShare}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(onShare).toHaveBeenCalledWith(12);
  });

  it("opens a project from its title or View button", () => {
    const onView = jest.fn();
    const project = {
      projectId: 12,
      name: "Environmental Template",
      category: "environmental",
      status: "draft",
      pageCount: 1,
      updatedAt: "2026-11-12T00:00:00.000Z",
    };

    render(
      <CanvasCard
        project={project}
        onView={onView}
        onEdit={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View Environmental Template" }));
    fireEvent.click(screen.getByRole("button", { name: "View", exact: true }));

    expect(onView).toHaveBeenNthCalledWith(1, 12);
    expect(onView).toHaveBeenNthCalledWith(2, 12);
  });

  it("confirms project deletion once before calling the delete handler", () => {
    const onDelete = jest.fn();
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    const project = {
      projectId: 12,
      name: "Environmental Template",
      category: "environmental",
      status: "draft",
      pageCount: 1,
      updatedAt: "2026-11-12T00:00:00.000Z",
    };

    render(
      <CanvasCard
        project={project}
        onView={jest.fn()}
        onEdit={jest.fn()}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(12);
    confirm.mockRestore();
  });
});
