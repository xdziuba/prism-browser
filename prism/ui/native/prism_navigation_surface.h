#ifndef PRISM_UI_NATIVE_PRISM_NAVIGATION_SURFACE_H_
#define PRISM_UI_NATIVE_PRISM_NAVIGATION_SURFACE_H_

class ToolbarButton;

namespace gfx {
class Canvas;
}

// Paints the inset Prism control surface behind a toolbar icon. Other themes
// and forced colors retain their native background and focus treatment.
void PaintPrismNavigationSurface(const ToolbarButton& button,
                                 gfx::Canvas* canvas);

#endif  // PRISM_UI_NATIVE_PRISM_NAVIGATION_SURFACE_H_
