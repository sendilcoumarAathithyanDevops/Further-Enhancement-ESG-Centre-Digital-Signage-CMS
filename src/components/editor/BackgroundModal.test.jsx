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
});
