import { fireEvent, render, screen } from "@testing-library/react";
import VideoUploadModal from "./VideoUploadModal";

describe("VideoUploadModal playback controls", () => {
  it("saves autoplay, loop, mute, fit, and volume choices", () => {
    const onDone = jest.fn();
    render(
      <VideoUploadModal
        initialComponent={{
          filePath: "/uploads/video.mp4",
          style: {
            autoPlay: true,
            loop: true,
            muted: true,
            objectFit: "contain",
            volume: 1,
          },
        }}
        onClose={jest.fn()}
        onDone={onDone}
      />
    );

    fireEvent.click(screen.getByLabelText("Play automatically"));
    fireEvent.click(screen.getByLabelText("Loop video"));
    fireEvent.click(screen.getByLabelText("Mute video"));
    fireEvent.change(screen.getByLabelText("Video fitting"), {
      target: { value: "cover" },
    });
    fireEvent.change(screen.getByRole("slider", { name: "Video volume" }), {
      target: { value: "0.4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        autoPlay: false,
        loop: false,
        muted: false,
        objectFit: "cover",
        volume: 0.4,
      })
    );
  });

  it("can remove an existing video from its widget", () => {
    const onDone = jest.fn();
    render(
      <VideoUploadModal
        initialComponent={{ filePath: "/uploads/video.mp4", style: {} }}
        onClose={jest.fn()}
        onDone={onDone}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove video" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ path: null })
    );
  });
});
