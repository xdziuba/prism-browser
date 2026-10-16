#ifndef PRISM_UI_NATIVE_PRISM_AVATAR_TOOLBAR_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_AVATAR_TOOLBAR_BUTTON_H_

#include "chrome/browser/ui/views/profiles/avatar_toolbar_button.h"

// Prism's compact profile control retains Chromium's identity semantics.
class PrismAvatarToolbarButton : public AvatarToolbarButton {
  METADATA_HEADER(PrismAvatarToolbarButton, AvatarToolbarButton)

 public:
  explicit PrismAvatarToolbarButton(BrowserWindowInterface* browser);
  PrismAvatarToolbarButton(const PrismAvatarToolbarButton&) = delete;
  PrismAvatarToolbarButton& operator=(const PrismAvatarToolbarButton&) = delete;
  ~PrismAvatarToolbarButton() override;

 private:
  void PaintButtonContents(gfx::Canvas* canvas) override;
};

#endif  // PRISM_UI_NATIVE_PRISM_AVATAR_TOOLBAR_BUTTON_H_
