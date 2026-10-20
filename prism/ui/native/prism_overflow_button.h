#ifndef PRISM_UI_NATIVE_PRISM_OVERFLOW_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_OVERFLOW_BUTTON_H_

#include "chrome/browser/ui/views/toolbar/overflow_button.h"
#include "ui/base/metadata/metadata_header_macros.h"

// Prism presentation of Chromium's responsive toolbar menu control.
class PrismOverflowButton : public OverflowButton {
  METADATA_HEADER(PrismOverflowButton, OverflowButton)

 public:
  PrismOverflowButton();
  ~PrismOverflowButton() override;

  void PaintButtonContents(gfx::Canvas* canvas) override;
};

#endif  // PRISM_UI_NATIVE_PRISM_OVERFLOW_BUTTON_H_
