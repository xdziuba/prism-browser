#include "prism/ui/native/prism_side_panel_header.h"

#include <utility>

#include "cc/paint/paint_flags.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/native_theme/native_theme.h"

PrismSidePanelHeader::PrismSidePanelHeader(std::unique_ptr<Delegate> delegate)
    : SidePanelHeader(std::move(delegate)) {}

PrismSidePanelHeader::~PrismSidePanelHeader() = default;

void PrismSidePanelHeader::OnPaintBackground(gfx::Canvas *canvas) {
  SidePanelHeader::OnPaintBackground(canvas);

  const ui::ColorProvider *colors = GetColorProvider();
  if (!colors || width() < 80 || height() < 24 ||
      GetNativeTheme()->preferred_contrast() ==
          ui::NativeTheme::PreferredContrast::kMore) {
    return;
  }

  const SkColor toolbar = colors->GetColor(kColorToolbar);
  const bool dark = toolbar == SkColorSetRGB(0x2C, 0x39, 0x42);
  const bool light = toolbar == SkColorSetRGB(0xF5, 0xF9, 0xFB);
  if (!dark && !light) {
    return;
  }

  cc::PaintFlags paint;
  paint.setColor(dark ? SkColorSetRGB(0x31, 0x42, 0x4C)
                      : SkColorSetRGB(0xEF, 0xF6, 0xF9));
  canvas->DrawRect(gfx::RectF(0, 0, width(), height()), paint);

  paint.setColor(dark ? SkColorSetARGB(0xA0, 0x84, 0xA0, 0xAE)
                      : SkColorSetARGB(0xB0, 0xFF, 0xFF, 0xFF));
  canvas->DrawRect(gfx::RectF(1, 0, width() - 2, 1), paint);

  paint.setColor(dark ? SkColorSetRGB(0x21, 0x34, 0x3D)
                      : SkColorSetRGB(0xCB, 0xDD, 0xE5));
  canvas->DrawRect(gfx::RectF(0, height() - 1, width(), 1), paint);
}

BEGIN_METADATA(PrismSidePanelHeader)
END_METADATA
