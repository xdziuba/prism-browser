#ifndef PRISM_UI_NATIVE_PRISM_NAVIGATION_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_NAVIGATION_BUTTON_H_

#include "chrome/browser/ui/views/toolbar/back_forward_button.h"

// Prism's own navigation control. Chromium still supplies browser semantics.
class PrismNavigationButton : public BackForwardButton {
  METADATA_HEADER(PrismNavigationButton, BackForwardButton)

 public:
  PrismNavigationButton(Direction direction,
                        PressedCallback callback,
                        BrowserWindowInterface* browser);
  PrismNavigationButton(const PrismNavigationButton&) = delete;
  PrismNavigationButton& operator=(const PrismNavigationButton&) = delete;
  ~PrismNavigationButton() override;

 private:
  void PaintButtonContents(gfx::Canvas* canvas) override;
};

#endif  // PRISM_UI_NATIVE_PRISM_NAVIGATION_BUTTON_H_
