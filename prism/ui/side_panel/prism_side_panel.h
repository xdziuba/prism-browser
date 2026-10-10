#ifndef PRISM_UI_SIDE_PANEL_PRISM_SIDE_PANEL_H_
#define PRISM_UI_SIDE_PANEL_PRISM_SIDE_PANEL_H_

class BrowserWindowInterface;
class SidePanelRegistry;

namespace prism::ui {

void RegisterPrismAiSidePanel(BrowserWindowInterface* browser,
                              SidePanelRegistry* registry);

}  // namespace prism::ui

#endif  // PRISM_UI_SIDE_PANEL_PRISM_SIDE_PANEL_H_
