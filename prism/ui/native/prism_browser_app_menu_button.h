#ifndef PRISM_UI_NATIVE_PRISM_BROWSER_APP_MENU_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_BROWSER_APP_MENU_BUTTON_H_

#include "chrome/browser/ui/views/toolbar/browser_app_menu_button.h"

// Prism's compact app menu control. Chromium retains the menu and status chip.
class PrismBrowserAppMenuButton : public BrowserAppMenuButton {
  METADATA_HEADER(PrismBrowserAppMenuButton, BrowserAppMenuButton)

 public:
  explicit PrismBrowserAppMenuButton(ToolbarView* toolbar_view);
  PrismBrowserAppMenuButton(const PrismBrowserAppMenuButton&) = delete;
  PrismBrowserAppMenuButton& operator=(const PrismBrowserAppMenuButton&) =
      delete;
  ~PrismBrowserAppMenuButton() override;

 private:
  void UpdateIcon() override;
  void PaintButtonContents(gfx::Canvas* canvas) override;
};

#endif  // PRISM_UI_NATIVE_PRISM_BROWSER_APP_MENU_BUTTON_H_
