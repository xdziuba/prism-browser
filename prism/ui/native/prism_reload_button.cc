#include "prism/ui/native/prism_reload_button.h"

#include "base/functional/bind.h"
#include "prism/ui/native/prism_navigation_surface.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/gfx/vector_icon_types.h"

namespace {

constexpr gfx::PathElement kReloadPath[] = {gfx::CANVAS_DIMENSIONS,
                                            20,
                                            gfx::STROKE,
                                            1.8f,
                                            gfx::MOVE_TO,
                                            15.3f,
                                            8.7f,
                                            gfx::CUBIC_TO,
                                            14.7f,
                                            6.0f,
                                            12.6f,
                                            4.5f,
                                            10,
                                            4.5f,
                                            gfx::CUBIC_TO,
                                            6.9f,
                                            4.5f,
                                            4.5f,
                                            7.0f,
                                            4.5f,
                                            10,
                                            gfx::CUBIC_TO,
                                            4.5f,
                                            13.1f,
                                            6.9f,
                                            15.5f,
                                            10,
                                            15.5f,
                                            gfx::CUBIC_TO,
                                            12.6f,
                                            15.5f,
                                            14.8f,
                                            13.8f,
                                            15.3f,
                                            11.2f,
                                            gfx::MOVE_TO,
                                            15.3f,
                                            4.8f,
                                            gfx::LINE_TO,
                                            15.3f,
                                            8.7f,
                                            gfx::LINE_TO,
                                            11.4f,
                                            8.7f};
const gfx::VectorIconRep kReloadReps[] = {{kReloadPath}};
constexpr gfx::VectorIcon kReloadIcon = {kReloadReps, 1, "prism-reload"};

constexpr gfx::PathElement kStopPath[] = {gfx::CANVAS_DIMENSIONS,
                                          20,
                                          gfx::MOVE_TO,
                                          6.5f,
                                          6.5f,
                                          gfx::LINE_TO,
                                          13.5f,
                                          6.5f,
                                          gfx::LINE_TO,
                                          13.5f,
                                          13.5f,
                                          gfx::LINE_TO,
                                          6.5f,
                                          13.5f,
                                          gfx::CLOSE};
const gfx::VectorIconRep kStopReps[] = {{kStopPath}};
constexpr gfx::VectorIcon kStopIcon = {kStopReps, 1, "prism-stop"};

}  // namespace

PrismReloadButton::PrismReloadButton(
    Profile* profile,
    CommandUpdater* command_updater,
    InitialWebUIWindowMetricsManager* window_metrics_manager)
    : ReloadButton(profile, command_updater, window_metrics_manager),
      mode_change_subscription_(AddVisibleModeChangedCallback(
          base::BindRepeating(&PrismReloadButton::UpdatePrismIcon,
                              base::Unretained(this)))) {
  UpdatePrismIcon();
}

PrismReloadButton::~PrismReloadButton() = default;

void PrismReloadButton::PaintButtonContents(gfx::Canvas* canvas) {
  ReloadButton::PaintButtonContents(canvas);
  PaintPrismNavigationSurface(*this, canvas, /*in_navigation_rail=*/true);
}

void PrismReloadButton::UpdatePrismIcon() {
  const gfx::VectorIcon& icon =
      GetVisibleMode() == Mode::kStop ? kStopIcon : kReloadIcon;
  SetVectorIcons(icon, icon);
}

BEGIN_METADATA(PrismReloadButton)
END_METADATA
