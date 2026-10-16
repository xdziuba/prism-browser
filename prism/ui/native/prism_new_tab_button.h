#ifndef PRISM_UI_NATIVE_PRISM_NEW_TAB_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_NEW_TAB_BUTTON_H_

#include "chrome/browser/ui/views/tabs/new_tab_button.h"

// Prism's visible tab-strip control; Chromium retains new-tab semantics.
class PrismNewTabButton : public NewTabButton {
public:
  PrismNewTabButton(PressedCallback callback, BrowserWindowInterface *browser);
  PrismNewTabButton(const PrismNewTabButton &) = delete;
  PrismNewTabButton &operator=(const PrismNewTabButton &) = delete;
  ~PrismNewTabButton() override;

protected:
  void UpdateBackground() override;
  void OnPaintBackground(gfx::Canvas *canvas) override;

private:
  bool HasPrismFrame() const;
  bool PaintPrismSurface() const;

  raw_ptr<BrowserWindowInterface> browser_;
};

#endif // PRISM_UI_NATIVE_PRISM_NEW_TAB_BUTTON_H_
