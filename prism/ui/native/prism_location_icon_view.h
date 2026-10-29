#ifndef PRISM_UI_NATIVE_PRISM_LOCATION_ICON_VIEW_H_
#define PRISM_UI_NATIVE_PRISM_LOCATION_ICON_VIEW_H_

#include "chrome/browser/ui/views/location_bar/location_icon_view.h"

// Prism's visible page-state chip; Chromium retains page-info behavior.
class PrismLocationIconView : public LocationIconView {
  METADATA_HEADER(PrismLocationIconView, LocationIconView)

 public:
  PrismLocationIconView(const gfx::FontList& font_list,
                        IconLabelBubbleView::Delegate* parent_delegate,
                        LocationIconView::Delegate* delegate);
  PrismLocationIconView(const PrismLocationIconView&) = delete;
  PrismLocationIconView& operator=(const PrismLocationIconView&) = delete;
  ~PrismLocationIconView() override;

 protected:
  gfx::RoundedCornersF GetCornerRadii() const override;
  void OnPaintBackground(gfx::Canvas* canvas) override;

 private:
  bool UsePrismMaterial() const;
};

#endif  // PRISM_UI_NATIVE_PRISM_LOCATION_ICON_VIEW_H_
