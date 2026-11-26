import { fireEvent, render, screen } from "@testing-library/react";
import ImageSettingsModal from "./ImageSettingsModal";

describe("ImageSettingsModal", () => {
  const component = {
    type: "image",
    filePath: "/uploads/photo.jpg",
    style: {
      widgetKind: "image",
      displayMode: "individual",
      imagePaths: ["/uploads/photo.jpg"],
      imageSettings: [{ objectFit: "cover", focusX: 50, focusY: 50 }],
    },
  };

  it("offers a replacement action for the selected image", () => {
    const onReplace = jest.fn();
    render(
      <ImageSettingsModal
        component={component}
        onClose={jest.fn()}
        onDone={jest.fn()}
        onReplace={onReplace}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Replace selected image" }));

    expect(onReplace).toHaveBeenCalledWith(0);
  });

  it("saves crop and fitting changes", () => {
    const onDone = jest.fn();
    render(
      <ImageSettingsModal
        component={component}
        onClose={jest.fn()}
        onDone={onDone}
      />
    );

    fireEvent.change(screen.getByLabelText("Image fitting"), {
      target: { value: "contain" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        objectFit: "contain",
        imageSettings: [
          expect.objectContaining({ objectFit: "contain" }),
        ],
      })
    );
  });

  it("announces which slideshow image is selected for crop editing", () => {
    render(
      <ImageSettingsModal
        component={{
          ...component,
          style: {
            ...component.style,
            displayMode: "slideshow",
            imagePaths: ["/uploads/first.jpg", "/uploads/second.jpg"],
            imageSettings: [{}, {}],
          },
        }}
        onClose={jest.fn()}
        onDone={jest.fn()}
      />
    );

    const firstImage = screen.getByRole("button", { name: "Edit crop for image 1" });
    const secondImage = screen.getByRole("button", { name: "Edit crop for image 2" });
    expect(firstImage.getAttribute("aria-pressed")).toBe("true");
    expect(secondImage.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(secondImage);

    expect(firstImage.getAttribute("aria-pressed")).toBe("false");
    expect(secondImage.getAttribute("aria-pressed")).toBe("true");
  });
});
