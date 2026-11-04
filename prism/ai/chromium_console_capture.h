#ifndef PRISM_AI_CHROMIUM_CONSOLE_CAPTURE_H_
#define PRISM_AI_CHROMIUM_CONSOLE_CAPTURE_H_

#include <cstdint>
#include <optional>
#include <string>

#include "content/public/browser/web_contents_observer.h"
#include "prism/ai/console_digest.h"

namespace content {
class WebContents;
}

namespace prism::ai {

// A one-tab, one-navigation capture. It retains no raw console content.
class ChromiumConsoleCapture final : public content::WebContentsObserver {
 public:
  ChromiumConsoleCapture(content::WebContents* contents,
                         int tab_id,
                         int navigation_id);
  ~ChromiumConsoleCapture() override;

  bool valid() const { return valid_; }
  int tab_id() const { return tab_id_; }
  int navigation_id() const { return navigation_id_; }
  const ConsoleDigest& digest() const { return digest_; }

  void DidFinishNavigation(content::NavigationHandle* navigation) override;
  void WebContentsDestroyed() override;
  void OnDidAddMessageToConsole(
      content::RenderFrameHost* source_frame,
      blink::mojom::ConsoleMessageLevel log_level,
      const std::u16string& message,
      int32_t line_no,
      const std::u16string& source_id,
      const std::optional<std::u16string>& untrusted_stack_trace) override;

 private:
  void Invalidate();

  const int tab_id_;
  const int navigation_id_;
  bool valid_ = true;
  ConsoleDigest digest_;
};

}  // namespace prism::ai

#endif  // PRISM_AI_CHROMIUM_CONSOLE_CAPTURE_H_
