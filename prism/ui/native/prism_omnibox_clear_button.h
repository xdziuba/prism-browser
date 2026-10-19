#ifndef PRISM_UI_NATIVE_PRISM_OMNIBOX_CLEAR_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_OMNIBOX_CLEAR_BUTTON_H_

#include "ui/views/controls/button/image_button.h"

// Prism's compact omnibox action surface; Chromium retains clearing semantics.
class PrismOmniboxClearButton : public views::ImageButton {
  METADATA_HEADER(PrismOmniboxClearButton, views::ImageButton)

 public:
  explicit PrismOmniboxClearButton(PressedCallback callback);
  PrismOmniboxClearButton(const PrismOmniboxClearButton&) = delete;
  PrismOmniboxClearButton& operator=(const PrismOmniboxClearButton&) = delete;
  ~PrismOmniboxClearButton() override;

 protected:
  void OnPaintBackground(gfx::Canvas* canvas) override;
};

#endif  // PRISM_UI_NATIVE_PRISM_OMNIBOX_CLEAR_BUTTON_H_
