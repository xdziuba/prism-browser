#ifndef PRISM_UI_NATIVE_PRISM_SIDE_PANEL_HEADER_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_SIDE_PANEL_HEADER_BUTTON_H_

#include "ui/views/controls/button/image_button.h"

// Prism-owned surfaces for the AI panel header; the controller owns behavior.
class PrismSidePanelHeaderButton : public views::ImageButton {
  METADATA_HEADER(PrismSidePanelHeaderButton, views::ImageButton)

 public:
  explicit PrismSidePanelHeaderButton(PressedCallback callback);
  PrismSidePanelHeaderButton(const PrismSidePanelHeaderButton&) = delete;
  PrismSidePanelHeaderButton& operator=(const PrismSidePanelHeaderButton&) =
      delete;
  ~PrismSidePanelHeaderButton() override;

 protected:
  void OnPaintBackground(gfx::Canvas* canvas) override;
};

class PrismSidePanelHeaderPinButton : public views::ToggleImageButton {
  METADATA_HEADER(PrismSidePanelHeaderPinButton, views::ToggleImageButton)

 public:
  explicit PrismSidePanelHeaderPinButton(PressedCallback callback);
  PrismSidePanelHeaderPinButton(const PrismSidePanelHeaderPinButton&) = delete;
  PrismSidePanelHeaderPinButton& operator=(
      const PrismSidePanelHeaderPinButton&) = delete;
  ~PrismSidePanelHeaderPinButton() override;

 protected:
  void OnPaintBackground(gfx::Canvas* canvas) override;
};

#endif  // PRISM_UI_NATIVE_PRISM_SIDE_PANEL_HEADER_BUTTON_H_
