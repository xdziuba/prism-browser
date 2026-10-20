#ifndef PRISM_UI_NATIVE_PRISM_NAVIGATION_RAIL_BACKGROUND_H_
#define PRISM_UI_NATIVE_PRISM_NAVIGATION_RAIL_BACKGROUND_H_

#include "base/memory/raw_ptr.h"
#include "chrome/browser/ui/views/frame/custom_corners_background.h"

class BrowserView;
class ToolbarView;
class ToolbarButton;

// Keeps Chromium's toolbar corners while painting a Prism navigation rail.
class PrismNavigationRailBackground : public CustomCornersBackground {
 public:
  PrismNavigationRailBackground(ToolbarView& toolbar,
                                BrowserView& browser_view);
  ~PrismNavigationRailBackground() override;

  void SetButtons(ToolbarButton* back, ToolbarButton* forward,
                  ToolbarButton* reload);
  void Paint(gfx::Canvas* canvas, views::View* view) const override;

 private:
  raw_ptr<ToolbarButton> back_ = nullptr;
  raw_ptr<ToolbarButton> forward_ = nullptr;
  raw_ptr<ToolbarButton> reload_ = nullptr;
};

#endif  // PRISM_UI_NATIVE_PRISM_NAVIGATION_RAIL_BACKGROUND_H_
