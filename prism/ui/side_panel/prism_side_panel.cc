#include "prism/ui/side_panel/prism_side_panel.h"

#include <memory>

#include "base/functional/bind.h"
#include "base/functional/callback_helpers.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/side_panel/side_panel_entry.h"
#include "chrome/browser/ui/side_panel/side_panel_entry_scope.h"
#include "chrome/browser/ui/side_panel/side_panel_registry.h"
#include "chrome/browser/ui/views/side_panel/side_panel_web_ui_view.h"
#include "prism/ui/webui/prism_ai_ui.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/views/view.h"
#include "url/gurl.h"

using SidePanelWebUIViewT_PrismAiPanelUI =
    SidePanelWebUIViewT<prism::ui::PrismAiPanelUI>;
BEGIN_TEMPLATE_METADATA(SidePanelWebUIViewT_PrismAiPanelUI, SidePanelWebUIViewT)
END_METADATA

namespace prism::ui {
namespace {

std::unique_ptr<views::View> CreatePrismAiView(SidePanelEntryScope& scope) {
  return std::make_unique<SidePanelWebUIViewT<PrismAiPanelUI>>(
      scope, base::RepeatingClosure(), base::RepeatingClosure(),
      std::make_unique<WebUIContentsWrapperT<PrismAiPanelUI>>(
          GURL("chrome://prism-ai-panel/"),
          scope.GetBrowserWindowInterface().GetProfile(),
          /*task_manager_string_id=*/0,
          /*esc_closes_ui=*/false));
}

}  // namespace

void RegisterPrismAiSidePanel(BrowserWindowInterface* browser,
                              SidePanelRegistry* registry) {
  if (!browser || !registry || !browser->GetProfile() ||
      browser->GetProfile()->IsOffTheRecord()) {
    return;
  }
  registry->Register(std::make_unique<SidePanelEntry>(
      SidePanelEntry::Key(SidePanelEntry::Id::kPrismAi),
      base::BindRepeating(&CreatePrismAiView), base::NullCallback()));
}

}  // namespace prism::ui
