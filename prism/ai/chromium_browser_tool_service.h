#ifndef PRISM_AI_CHROMIUM_BROWSER_TOOL_SERVICE_H_
#define PRISM_AI_CHROMIUM_BROWSER_TOOL_SERVICE_H_

#include <cstdint>
#include <vector>

#include "base/functional/callback.h"
#include "base/memory/weak_ptr.h"
#include "prism/ai/browser_tools.h"
#include "prism/ai/chromium_page_adapter.h"
#include "prism/ai/chromium_tab_adapter.h"

class BrowserWindowInterface;

namespace prism::ai {

// Browser-process service for one window. Only trusted browser UI may call its
// grant and approval methods; renderer/page content must never receive it.
class ChromiumBrowserToolService : public BrowserToolHost {
 public:
  using CompletionObserver = base::RepeatingCallback<void(Submission)>;

  explicit ChromiumBrowserToolService(
      base::WeakPtr<BrowserWindowInterface> browser);
  ~ChromiumBrowserToolService() override;

  Inspection Inspect(const ToolCall& call) override;
  void SetCompletionObserver(CompletionObserver completion_observer);
  bool BeginTask();
  void Grant(Capability capability);
  void Revoke(Capability capability);
  Submission Submit(ToolCall call);
  Submission Approve(std::uint64_t action_id);
  bool Reject(std::uint64_t action_id);
  void Stop();
  std::vector<AuditEntry> AuditSnapshot() const;

 private:
  Submission Dispatch(Submission submission);
  void OnSnapshotComplete(std::uint64_t action_id, ExecutionResult result);
  void DeliverCompletion(Submission submission);

  AiActionAuditLog audit_;
  ChromiumTabAdapter tab_adapter_;
  ChromiumPageAdapter page_adapter_;
  BrowserToolBroker broker_;
  CompletionObserver completion_observer_;
  base::WeakPtrFactory<ChromiumBrowserToolService> weak_factory_{this};
};

}  // namespace prism::ai

#endif  // PRISM_AI_CHROMIUM_BROWSER_TOOL_SERVICE_H_
