#ifndef PRISM_UI_NATIVE_PRISM_NAVIGATION_RAIL_H_
#define PRISM_UI_NATIVE_PRISM_NAVIGATION_RAIL_H_

class ToolbarButton;

namespace views {
class View;
}

namespace gfx {
class Canvas;
}

// Paints a shared surface behind the existing Back, Forward and Reload views.
// It never takes part in layout or hit testing.
void PaintPrismNavigationRail(const views::View& toolbar,
                              const ToolbarButton* back,
                              const ToolbarButton* forward,
                              const ToolbarButton* reload, gfx::Canvas* canvas);

#endif  // PRISM_UI_NATIVE_PRISM_NAVIGATION_RAIL_H_
