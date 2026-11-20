import { fireEvent, render, screen } from "@testing-library/react";
import BackgroundModal from "./BackgroundModal";

describe("BackgroundModal colour presets", () => {
  it("applies a preset colour at full opacity", async () => {
    const onDone = jest.fn();
    render(
      <BackgroundModal
        page={{ backgroundColor: "#FFFFFF", backgroundSettings: {} }}
        onClose={jest.fn()}
        onDone={onDone}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Use RP green background" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Background" }));

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        backgroundColor: "#21634D",
        backgroundSettings: expect.objectContaining({
          backgroundColorOpacity: 1,
        }),
      })
    );
  });

  it("asks before removing an existing background image", () => {
    const onDone = jest.fn();
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <BackgroundModal
        page={{
          backgroundColor: "#FFFFFF",
          backgroundImagePath: "/uploads/background.jpg",
          backgroundSettings: {},
        }}
        onClose={jest.fn()}
        onDone={onDone}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Background" }));

    expect(confirm).toHaveBeenCalledWith("Remove the background image from this page?");
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundImagePath: "/uploads/background.jpg" })
    );
    confirm.mockRestore();
  });
});
