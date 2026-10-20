#include "prism/ui/native/prism_navigation_rail_background.h"

#include "chrome/browser/ui/views/toolbar/toolbar_button.h"
#include "chrome/browser/ui/views/toolbar/toolbar_view.h"
#include "prism/ui/native/prism_navigation_rail.h"

PrismNavigationRailBackground::PrismNavigationRailBackground(
    ToolbarView& toolbar, BrowserView& browser_view)
    : CustomCornersBackground(toolbar, browser_view,
                              CustomCornersBackground::ToolbarTheme(),
                              CustomCornersBackground::FrameTheme()) {}

PrismNavigationRailBackground::~PrismNavigationRailBackground() = default;

void PrismNavigationRailBackground::SetButtons(ToolbarButton* back,
                                               ToolbarButton* forward,
                                               ToolbarButton* reload) {
  back_ = back;
  forward_ = forward;
  reload_ = reload;
}

void PrismNavigationRailBackground::Paint(gfx::Canvas* canvas,
                                          views::View* view) const {
  CustomCornersBackground::Paint(canvas, view);
  PaintPrismNavigationRail(*view, back_, forward_, reload_, canvas);
}
