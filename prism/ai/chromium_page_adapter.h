#ifndef PRISM_AI_CHROMIUM_PAGE_ADAPTER_H_
#define PRISM_AI_CHROMIUM_PAGE_ADAPTER_H_

#include "base/functional/callback.h"
#include "base/memory/weak_ptr.h"
#include "prism/ai/browser_tools.h"
#include "prism/ai/page_context.h"

class BrowserWindowInterface;

namespace content {
class WebContents;
}

namespace ui {
struct AXTreeUpdate;
}

namespace prism::ai {

// Read-only, one-shot AX path for browser.page.snapshot and browser.page.find.
class ChromiumPageAdapter {
 public:
  using Completion = base::OnceCallback<void(ExecutionResult)>;

  explicit ChromiumPageAdapter(base::WeakPtr<BrowserWindowInterface> browser);
  ~ChromiumPageAdapter();

  Inspection Inspect(const ToolCall& call);
  void RequestPageRead(ExecutionTicket ticket, Completion completion);
  void Invalidate(int tab_id);

 private:
  content::WebContents* FindTab(int tab_id) const;
  void OnSnapshot(ExecutionTicket ticket,
                  base::WeakPtr<content::WebContents> contents,
                  int navigation_entry_id,
                  Completion completion,
                  ::ui::AXTreeUpdate& update);

  base::WeakPtr<BrowserWindowInterface> browser_;
  PageContextExtractor extractor_;
  base::WeakPtrFactory<ChromiumPageAdapter> weak_factory_{this};
};

}  // namespace prism::ai

#endif  // PRISM_AI_CHROMIUM_PAGE_ADAPTER_H_
