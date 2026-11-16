import { fireEvent, render, screen } from "@testing-library/react";
import TextWidgetModal from "./TextWidgetModal";

describe("TextWidgetModal font sizing", () => {
  it("saves a custom size for text widgets", () => {
    const onDone = jest.fn();
    render(
      <TextWidgetModal
        initialComponent={{ contentText: "A title" }}
        onClose={jest.fn()}
        onDone={onDone}
      />
    );

    fireEvent.change(screen.getByRole("slider", { name: "Font size" }), {
      target: { value: "48" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({ fontSize: 48 }),
      })
    );
  });

  it("saves a custom size for text areas", () => {
    const onDone = jest.fn();
    render(
      <TextWidgetModal
        mode="textArea"
        initialComponent={{
          contentText: "Existing text",
          style: { fontSize: 18 },
        }}
        onClose={jest.fn()}
        onDone={onDone}
      />
    );

    fireEvent.change(screen.getByRole("slider", { name: "Font size" }), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          widgetKind: "textArea",
          fontSize: 30,
        }),
      })
    );
  });
});
