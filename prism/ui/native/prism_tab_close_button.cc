#include "prism/ui/native/prism_tab_close_button.h"

#include <algorithm>
#include <utility>

#include "cc/paint/paint_flags.h"
#include "chrome/browser/ui/layout_constants.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/base/models/image_model.h"
#include "ui/color/color_id.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/gfx/vector_icon_types.h"

namespace {

constexpr gfx::PathElement kClosePath[] = {gfx::CANVAS_DIMENSIONS,
                                           16,
                                           gfx::STROKE,
                                           1.65f,
                                           gfx::MOVE_TO,
                                           4,
                                           4,
                                           gfx::LINE_TO,
                                           12,
                                           12,
                                           gfx::MOVE_TO,
                                           12,
                                           4,
                                           gfx::LINE_TO,
                                           4,
                                           12};
const gfx::VectorIconRep kCloseReps[] = {{kClosePath}};
constexpr gfx::VectorIcon kCloseIcon = {kCloseReps, 1, "prism-tab-close"};

}  // namespace

PrismTabCloseButton::PrismTabCloseButton(
    PressedCallback pressed_callback,
    MouseEventCallback mouse_event_callback)
    : TabCloseButton(std::move(pressed_callback),
                     std::move(mouse_event_callback)) {
  UpdateIcon();
}

PrismTabCloseButton::~PrismTabCloseButton() = default;

void PrismTabCloseButton::UpdateIcon() {
  const auto image = ui::ImageModel::FromVectorIcon(
      kCloseIcon, GetColors().foreground_color,
      GetLayoutConstant(LayoutConstant::kTabCloseButtonSize));
  SetImageModel(views::Button::STATE_NORMAL, image);
  SetImageModel(views::Button::STATE_HOVERED, image);
  SetImageModel(views::Button::STATE_PRESSED, image);
}

void PrismTabCloseButton::OnPaintBackground(gfx::Canvas* canvas) {
  const ui::ColorProvider* colors = GetColorProvider();
  if (!colors) {
    TabCloseButton::OnPaintBackground(canvas);
    return;
  }
  const SkColor frame = colors->GetColor(ui::kColorFrameActive);
  const bool dark = frame == SkColorSetRGB(0x1C, 0x29, 0x32);
  const bool light = frame == SkColorSetRGB(0xE2, 0xEB, 0xF0);
  if ((!dark && !light) || (GetState() != views::Button::STATE_HOVERED &&
                            GetState() != views::Button::STATE_PRESSED)) {
    TabCloseButton::OnPaintBackground(canvas);
    return;
  }

  const float side = std::min(width(), height()) - 8.0f;
  const gfx::RectF surface((width() - side) / 2.0f, (height() - side) / 2.0f,
                           side, side);
  cc::PaintFlags fill;
  fill.setAntiAlias(true);
  const bool pressed = GetState() == views::Button::STATE_PRESSED;
  SkColor fill_color;
  if (dark) {
    fill_color = pressed ? SkColorSetRGB(0x5D, 0x78, 0x86)
                         : SkColorSetRGB(0x45, 0x5D, 0x6A);
  } else {
    fill_color = pressed ? SkColorSetRGB(0xC8, 0xDD, 0xE7)
                         : SkColorSetRGB(0xDF, 0xEC, 0xF2);
  }
  fill.setColor(fill_color);
  canvas->DrawRoundRect(surface, 7.0f, fill);

  cc::PaintFlags rim;
  rim.setAntiAlias(true);
  rim.setStyle(cc::PaintFlags::kStroke_Style);
  rim.setStrokeWidth(1.0f);
  rim.setColor(dark ? SkColorSetARGB(0xA8, 0x88, 0xA3, 0xB1)
                    : SkColorSetARGB(0xA8, 0xB1, 0xC9, 0xD5));
  canvas->DrawRoundRect(surface, 7.0f, rim);
}

BEGIN_METADATA(PrismTabCloseButton)
END_METADATA
