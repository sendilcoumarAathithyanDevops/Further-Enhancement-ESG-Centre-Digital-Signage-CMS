import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CanvasPageTabs from "./CanvasPageTabs";

describe("CanvasPageTabs reordering controls", () => {
  afterEach(cleanup);

  it("labels page move controls and disables moves beyond the ends", () => {
    const onMove = jest.fn();
    const pages = [
      { clientId: "page-1", name: "Cover" },
      { clientId: "page-2", name: "Details" },
    ];

    render(
      <CanvasPageTabs
        pages={pages}
        selectedPageId="page-1"
        onSelect={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
        onMove={onMove}
        onReorder={jest.fn()}
        onAdd={jest.fn()}
        onDuplicate={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Move Cover earlier" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Move Cover later" }).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Move Cover later" }));
    expect(onMove).toHaveBeenCalledWith("page-1", 1);
  });
});
