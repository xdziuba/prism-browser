#ifndef PRISM_UI_NATIVE_PRISM_HOME_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_HOME_BUTTON_H_

#include "chrome/browser/ui/views/toolbar/home_button.h"

// Prism's Home control retains Chromium's home-page and drop behavior.
class PrismHomeButton : public HomeButton {
  METADATA_HEADER(PrismHomeButton, HomeButton)

 public:
  PrismHomeButton(BrowserWindowInterface* browser, PressedCallback callback);
  PrismHomeButton(const PrismHomeButton&) = delete;
  PrismHomeButton& operator=(const PrismHomeButton&) = delete;
  ~PrismHomeButton() override;

 private:
  void PaintButtonContents(gfx::Canvas* canvas) override;
};

#endif  // PRISM_UI_NATIVE_PRISM_HOME_BUTTON_H_
