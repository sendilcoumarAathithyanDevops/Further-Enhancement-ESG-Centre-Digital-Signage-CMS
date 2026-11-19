import { fireEvent, render, screen } from "@testing-library/react";
import LayoutValidationModal from "./LayoutValidationModal";

describe("LayoutValidationModal", () => {
  it("keeps publishing blocked when a blocking issue is present", () => {
    const onPublish = jest.fn();
    const onEdit = jest.fn();
    const onPreview = jest.fn();
    render(
      <LayoutValidationModal
        projectName="Community Impact"
        report={{
          canPublish: false,
          blockingCount: 1,
          warningCount: 0,
          issues: [{
            severity: "error",
            code: "missing-video",
            pageName: "Main page",
            pageNumber: 1,
            message: "Video widget 1 has no video selected.",
            recommendation: "Upload a video or remove the empty video widget.",
          }],
        }}
        onClose={jest.fn()}
        onEdit={onEdit}
        onPreview={onPreview}
        onPublish={onPublish}
      />
    );

    expect(screen.queryByRole("button", { name: "Publish project" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview content" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit project" }));

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("allows proceeding after reviewing warnings", () => {
    const onPublish = jest.fn();
    render(
      <LayoutValidationModal
        projectName="Community Impact"
        report={{
          canPublish: true,
          blockingCount: 0,
          warningCount: 1,
          issues: [{
            severity: "warning",
            code: "widget-overlap",
            pageName: "Main page",
            pageNumber: 1,
            message: "Two widgets overlap.",
            recommendation: "Review whether the overlap is intentional.",
          }],
        }}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onPublish={onPublish}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish anyway" }));

    expect(onPublish).toHaveBeenCalledTimes(1);
  });
});
