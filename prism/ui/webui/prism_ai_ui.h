#ifndef PRISM_UI_WEBUI_PRISM_AI_UI_H_
#define PRISM_UI_WEBUI_PRISM_AI_UI_H_

#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"
#include "content/public/common/url_constants.h"

namespace prism::ui {

inline constexpr char kPrismAiHost[] = "prism-ai";

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
};

}  // namespace prism::ui

#endif  // PRISM_UI_WEBUI_PRISM_AI_UI_H_
