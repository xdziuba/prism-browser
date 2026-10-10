#ifndef PRISM_UI_WEBUI_PRISM_AI_UI_H_
#define PRISM_UI_WEBUI_PRISM_AI_UI_H_

#include "base/memory/weak_ptr.h"
#include "chrome/browser/ui/webui/top_chrome/top_chrome_web_ui_controller.h"
#include "chrome/browser/ui/webui/top_chrome/top_chrome_webui_config.h"
#include "content/public/browser/visibility.h"
#include "content/public/browser/web_contents_observer.h"
#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"
#include "content/public/common/url_constants.h"

namespace prism::ui {

inline constexpr char kPrismAiHost[] = "prism-ai";
inline constexpr char kPrismAiPanelHost[] = "prism-ai-panel";

class PrismAiUI;

class PrismAiUIConfig : public content::DefaultWebUIConfig<PrismAiUI> {
 public:
  PrismAiUIConfig()
      : DefaultWebUIConfig(content::kChromeUIScheme, kPrismAiHost) {}
};

class PrismAiUI : public content::WebUIController {
 public:
  explicit PrismAiUI(content::WebUI* web_ui);
  ~PrismAiUI() override;

  WEB_UI_CONTROLLER_TYPE_DECL();
};

class PrismAiPanelUI;
class PrismAiMessageHandler;

class PrismAiPanelUIConfig
    : public DefaultTopChromeWebUIConfig<PrismAiPanelUI> {
 public:
  PrismAiPanelUIConfig()
      : DefaultTopChromeWebUIConfig(content::kChromeUIScheme,
                                    kPrismAiPanelHost) {}
};

class PrismAiPanelUI : public TopChromeWebUIController,
                       public content::WebContentsObserver {
 public:
  explicit PrismAiPanelUI(content::WebUI* web_ui);
  ~PrismAiPanelUI() override;

  static constexpr std::string_view GetWebUIName() { return "PrismAiPanel"; }

  void OnVisibilityChanged(content::Visibility visibility) override;

  WEB_UI_CONTROLLER_TYPE_DECL();

 private:
  base::WeakPtr<PrismAiMessageHandler> handler_;
};

}  // namespace prism::ui

#endif  // PRISM_UI_WEBUI_PRISM_AI_UI_H_
