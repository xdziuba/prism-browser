#ifndef PRISM_UI_NATIVE_PRISM_TAB_SEARCH_BUTTON_H_
#define PRISM_UI_NATIVE_PRISM_TAB_SEARCH_BUTTON_H_

#include "base/memory/raw_ptr.h"
#include "chrome/browser/ui/views/tabs/shared/tab_strip_flat_edge_button.h"

class BrowserWindowInterface;

// Prism's horizontal tab-search control. The upstream action and hit target
// still own all browser behavior.
class PrismTabSearchButton : public TabStripFlatEdgeButton {
 public:
  explicit PrismTabSearchButton(BrowserWindowInterface* browser);
  PrismTabSearchButton(const PrismTabSearchButton&) = delete;
  PrismTabSearchButton& operator=(const PrismTabSearchButton&) = delete;
  ~PrismTabSearchButton() override;

  void UpdateIcon(const ui::ImageModel& icon_image) override;
  void OnPaintBackground(gfx::Canvas* canvas) override;

 private:
  bool PaintPrismSurface() const;

  const raw_ptr<BrowserWindowInterface> browser_;
};

#endif  // PRISM_UI_NATIVE_PRISM_TAB_SEARCH_BUTTON_H_
