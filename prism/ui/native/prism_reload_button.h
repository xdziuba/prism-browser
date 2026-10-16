#ifndef PRISM_UI_NATIVE_PRISM_RELOAD_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_RELOAD_BUTTON_H_

#include "base/callback_list.h"
#include "chrome/browser/ui/views/toolbar/reload_button.h"

// Prism's custom reload/stop control with Chromium's loading behavior intact.
class PrismReloadButton : public ReloadButton {
  METADATA_HEADER(PrismReloadButton, ReloadButton)

 public:
  PrismReloadButton(Profile* profile,
                    CommandUpdater* command_updater,
                    InitialWebUIWindowMetricsManager* window_metrics_manager);
  PrismReloadButton(const PrismReloadButton&) = delete;
  PrismReloadButton& operator=(const PrismReloadButton&) = delete;
  ~PrismReloadButton() override;

 private:
  void PaintButtonContents(gfx::Canvas* canvas) override;
  void UpdatePrismIcon();

  base::CallbackListSubscription mode_change_subscription_;
};

#endif  // PRISM_UI_NATIVE_PRISM_RELOAD_BUTTON_H_
