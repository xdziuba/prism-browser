#include "prism/ai/chromium_browser_tool_service.h"

#include <utility>

#include "base/functional/bind.h"
#include "base/location.h"
#include "base/task/sequenced_task_runner.h"

namespace prism::ai {

ChromiumBrowserToolService::ChromiumBrowserToolService(
    base::WeakPtr<BrowserWindowInterface> browser)
    : tab_adapter_(browser),
      page_adapter_(std::move(browser)),
      broker_(*this, audit_) {}

ChromiumBrowserToolService::~ChromiumBrowserToolService() = default;

Inspection ChromiumBrowserToolService::Inspect(const ToolCall& call) {
  if (std::holds_alternative<PageSnapshot>(call) ||
      std::holds_alternative<PageFind>(call)) {
    return page_adapter_.Inspect(call);
  }
  return tab_adapter_.Inspect(call);
}

void ChromiumBrowserToolService::SetCompletionObserver(
    CompletionObserver completion_observer) {
  completion_observer_ = std::move(completion_observer);
}

bool ChromiumBrowserToolService::BeginTask() {
  return broker_.BeginTask();
}

void ChromiumBrowserToolService::Grant(Capability capability) {
  broker_.Grant(capability);
}

void ChromiumBrowserToolService::Revoke(Capability capability) {
  broker_.Revoke(capability);
}

Submission ChromiumBrowserToolService::Submit(ToolCall call) {
  return Dispatch(broker_.Submit(std::move(call)));
}

Submission ChromiumBrowserToolService::Approve(std::uint64_t action_id) {
  return Dispatch(broker_.Approve(action_id));
}

bool ChromiumBrowserToolService::Reject(std::uint64_t action_id) {
  return broker_.Reject(action_id);
}

void ChromiumBrowserToolService::Stop() {
  broker_.Stop();
}

std::vector<AuditEntry> ChromiumBrowserToolService::AuditSnapshot() const {
  return audit_.Snapshot();
}

Submission ChromiumBrowserToolService::Dispatch(Submission submission) {
  if (!submission.ticket) {
    return submission;
  }
  ExecutionTicket ticket = std::move(*submission.ticket);
  submission.ticket.reset();
  if (std::holds_alternative<PageSnapshot>(ticket.call) ||
      std::holds_alternative<PageFind>(ticket.call)) {
    const std::uint64_t action_id = ticket.action_id;
    page_adapter_.RequestPageRead(
        std::move(ticket),
        base::BindOnce(&ChromiumBrowserToolService::OnSnapshotComplete,
                       weak_factory_.GetWeakPtr(), action_id));
    return submission;
  }
  ExecutionResult result = tab_adapter_.ExecuteTicket(ticket);
  if (result.status == ExecutionStatus::kCompleted) {
    if (const auto* close = std::get_if<TabsClose>(&ticket.call)) {
      page_adapter_.Invalidate(close->tab_id);
    }
  }
  return broker_.Complete(ticket.action_id, std::move(result));
}

void ChromiumBrowserToolService::OnSnapshotComplete(std::uint64_t action_id,
                                                    ExecutionResult result) {
  Submission completed = broker_.Complete(action_id, std::move(result));
  base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE,
      base::BindOnce(&ChromiumBrowserToolService::DeliverCompletion,
                     weak_factory_.GetWeakPtr(), std::move(completed)));
}

void ChromiumBrowserToolService::DeliverCompletion(Submission completed) {
  if (completion_observer_) {
    completion_observer_.Run(std::move(completed));
  }
}

}  // namespace prism::ai
