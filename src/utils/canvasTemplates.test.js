import { createPageFromTemplate, createPagesFromTemplate } from './canvasTemplates';

describe('canvas template presets', () => {
  it('creates three editable pages for preset templates', () => {
    const pages = createPagesFromTemplate('project-showcase', 3);

    expect(pages).toHaveLength(3);
    expect(pages[0].components.some((component) => component.type === 'image')).toBe(true);
    expect(pages[0].components.some((component) => component.type === 'text')).toBe(true);
  });

  it('uses a video widget for the video presentation preset', () => {
    const page = createPageFromTemplate('video-presentation', 1);

    expect(page.components.some((component) => component.type === 'video')).toBe(true);
  });
});
