#ifndef PRISM_AI_CHROMIUM_TAB_ADAPTER_H_
#define PRISM_AI_CHROMIUM_TAB_ADAPTER_H_

#include "base/memory/weak_ptr.h"
#include "prism/ai/browser_tools.h"

class BrowserWindowInterface;
class TabStripModel;

namespace prism::ai {

// Browser-window-scoped adapter. Construct and invoke only on the UI thread.
// The owner passes the result to BrowserToolBroker::Complete exactly once.
class ChromiumTabAdapter final : public BrowserToolHost {
 public:
  explicit ChromiumTabAdapter(base::WeakPtr<BrowserWindowInterface> browser);
  ~ChromiumTabAdapter() override;

  Inspection Inspect(const ToolCall& call) override;
  ExecutionResult ExecuteTicket(const ExecutionTicket& ticket);

 private:
  int FindTabIndex(const TabStripModel& tabs, int tab_id) const;

  base::WeakPtr<BrowserWindowInterface> browser_;
};

}  // namespace prism::ai

#endif  // PRISM_AI_CHROMIUM_TAB_ADAPTER_H_
