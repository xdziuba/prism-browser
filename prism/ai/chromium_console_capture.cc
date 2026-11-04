#include "prism/ai/chromium_console_capture.h"

#include "content/public/browser/navigation_handle.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"
#include "third_party/blink/public/mojom/devtools/console_message.mojom.h"

namespace prism::ai {

ChromiumConsoleCapture::ChromiumConsoleCapture(content::WebContents* contents,
                                               int tab_id,
                                               int navigation_id)
    : content::WebContentsObserver(contents),
      tab_id_(tab_id),
      navigation_id_(navigation_id) {}

ChromiumConsoleCapture::~ChromiumConsoleCapture() = default;

void ChromiumConsoleCapture::DidFinishNavigation(
    content::NavigationHandle* navigation) {
  if (navigation->IsInPrimaryMainFrame() && navigation->HasCommitted() &&
      !navigation->IsSameDocument()) {
    Invalidate();
  }
}

void ChromiumConsoleCapture::WebContentsDestroyed() {
  Invalidate();
  Observe(nullptr);
}

void ChromiumConsoleCapture::OnDidAddMessageToConsole(
    content::RenderFrameHost* source_frame,
    blink::mojom::ConsoleMessageLevel log_level,
    const std::u16string& message,
    int32_t line_no,
    const std::u16string&,
    const std::optional<std::u16string>&) {
  if (!valid_ || !web_contents() || !source_frame ||
      source_frame->GetLastCommittedOrigin() !=
          web_contents()->GetPrimaryMainFrame()->GetLastCommittedOrigin()) {
    return;
  }
  if (log_level == blink::mojom::ConsoleMessageLevel::kWarning) {
    digest_.Add(ConsoleSeverity::kWarning, message, line_no);
  } else if (log_level == blink::mojom::ConsoleMessageLevel::kError) {
    digest_.Add(ConsoleSeverity::kError, message, line_no);
  }
}

void ChromiumConsoleCapture::Invalidate() {
  valid_ = false;
  digest_ = ConsoleDigest();
}

}  // namespace prism::ai
