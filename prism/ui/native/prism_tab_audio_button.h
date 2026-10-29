#ifndef PRISM_UI_NATIVE_PRISM_TAB_AUDIO_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_TAB_AUDIO_BUTTON_H_

#include "chrome/browser/ui/views/tabs/tab/alert_indicator_button.h"

// Prism's visible audio indicator; Chromium keeps alert and mute semantics.
class PrismTabAudioButton : public AlertIndicatorButton {
  METADATA_HEADER(PrismTabAudioButton, AlertIndicatorButton)

 public:
  explicit PrismTabAudioButton(Delegate* delegate);
  PrismTabAudioButton(const PrismTabAudioButton&) = delete;
  PrismTabAudioButton& operator=(const PrismTabAudioButton&) = delete;
  ~PrismTabAudioButton() override;

 protected:
  void OnPaintBackground(gfx::Canvas* canvas) override;
};

#endif  // PRISM_UI_NATIVE_PRISM_TAB_AUDIO_BUTTON_H_
