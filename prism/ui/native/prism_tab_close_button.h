#ifndef PRISM_UI_NATIVE_PRISM_TAB_CLOSE_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_TAB_CLOSE_BUTTON_H_

#include "chrome/browser/ui/views/tabs/tab/tab_close_button.h"

// Prism's tab close affordance; Chromium retains tab event semantics.
class PrismTabCloseButton : public TabCloseButton {
  METADATA_HEADER(PrismTabCloseButton, TabCloseButton)

 public:
  PrismTabCloseButton(PressedCallback pressed_callback,
                      MouseEventCallback mouse_event_callback);
  PrismTabCloseButton(const PrismTabCloseButton&) = delete;
  PrismTabCloseButton& operator=(const PrismTabCloseButton&) = delete;
  ~PrismTabCloseButton() override;

 protected:
  void UpdateIcon() override;
  void OnPaintBackground(gfx::Canvas* canvas) override;
};

#endif  // PRISM_UI_NATIVE_PRISM_TAB_CLOSE_BUTTON_H_
