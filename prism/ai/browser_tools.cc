#include "prism/ai/browser_tools.h"

#include "prism/ai/page_context.h"

#include <utility>

namespace prism::ai {
namespace {

template <class... T>
struct Overloaded : T... {
  using T::operator()...;
};

bool Valid(const ElementRef& element) {
  return element.tab_id > 0 && element.snapshot_id != 0 && element.node_id != 0;
}

bool OutputMatchesTool(std::size_t tool_index,
                       int expected_tab_id,
                       const ToolOutput& output) {
  if (tool_index == ToolCall{TabsList{}}.index()) {
    return std::holds_alternative<TabsListOutput>(output);
  }
  if (tool_index == ToolCall{PageSnapshot{}}.index()) {
    const auto* snapshot =
        std::get_if<std::shared_ptr<const PageContextSnapshot>>(&output);
    return snapshot && *snapshot && (*snapshot)->tab_id == expected_tab_id &&
           (*snapshot)->snapshot_id != 0;
  }
  if (tool_index == ToolCall{PageFind{}}.index()) {
    const auto* found = std::get_if<PageFindOutput>(&output);
    return found && found->tab_id == expected_tab_id && found->snapshot_id != 0;
  }
  const auto* acknowledgement = std::get_if<ActionAcknowledgement>(&output);
  if (!acknowledgement) {
    return false;
  }
  if (tool_index == ToolCall{TabsOpen{}}.index()) {
    return acknowledgement->kind == AcknowledgementKind::kOpenRequested;
  }
  if (tool_index == ToolCall{TabsClose{}}.index()) {
    return acknowledgement->kind == AcknowledgementKind::kCloseRequested;
  }
  if (tool_index == ToolCall{TabsActivate{}}.index()) {
    return acknowledgement->kind == AcknowledgementKind::kActivated;
  }
  return false;
}

}  // namespace

AiActionAuditLog::AiActionAuditLog() = default;
AiActionAuditLog::~AiActionAuditLog() = default;

BrowserPermissionBroker::BrowserPermissionBroker() = default;
BrowserPermissionBroker::~BrowserPermissionBroker() = default;

Submission::Submission() = default;
Submission::Submission(std::uint64_t id,
                       ActionState action_state,
                       Reason action_reason,
                       ToolOutput tool_output)
    : action_id(id),
      state(action_state),
      reason(action_reason),
      output(std::move(tool_output)) {}
Submission::Submission(const Submission&) = default;
Submission& Submission::operator=(const Submission&) = default;
Submission::Submission(Submission&&) = default;
Submission& Submission::operator=(Submission&&) = default;
Submission::~Submission() = default;

ToolDescriptor Describe(const ToolCall& call) {
  return std::visit(
      Overloaded{
          [](const TabsList&) -> ToolDescriptor {
            return {"browser.tabs.list", Capability::kRead, false};
          },
          [](const TabsOpen&) -> ToolDescriptor {
            return {"browser.tabs.open", Capability::kNavigate, false};
          },
          [](const TabsClose&) -> ToolDescriptor {
            return {"browser.tabs.close", Capability::kInteract, true};
          },
          [](const TabsActivate&) -> ToolDescriptor {
            return {"browser.tabs.activate", Capability::kNavigate, false};
          },
          [](const PageSnapshot&) -> ToolDescriptor {
            return {"browser.page.snapshot", Capability::kRead, false};
          },
          [](const PageFind&) -> ToolDescriptor {
            return {"browser.page.find", Capability::kRead, false};
          },
          [](const PageClick&) -> ToolDescriptor {
            return {"browser.page.click", Capability::kInteract, true};
          },
          [](const PageType&) -> ToolDescriptor {
            return {"browser.page.type", Capability::kInteract, true};
          },
          [](const PageScroll&) -> ToolDescriptor {
            return {"browser.page.scroll", Capability::kInteract, false};
          },
          [](const PageScreenshot&) -> ToolDescriptor {
            return {"browser.page.screenshot", Capability::kSensitive, false};
          },
          [](const DevConsoleList&) -> ToolDescriptor {
            return {"browser.dev.console.list", Capability::kDeveloperPower,
                    false};
          },
          [](const DevNetworkList&) -> ToolDescriptor {
            return {"browser.dev.network.list", Capability::kDeveloperPower,
                    false};
          },
          [](const DevNetworkRequest&) -> ToolDescriptor {
            return {"browser.dev.network.request", Capability::kDeveloperPower,
                    false};
          },
          [](const DevDomInspect&) -> ToolDescriptor {
            return {"browser.dev.dom.inspect", Capability::kDeveloperPower,
                    false};
          },
          [](const DevPerformanceSnapshot&) -> ToolDescriptor {
            return {"browser.dev.performance.snapshot",
                    Capability::kDeveloperPower, false};
          },
      },
      call);
}

bool HasValidArguments(const ToolCall& call) {
  return std::visit(
      Overloaded{
          [](const TabsList&) { return true; },
          [](const TabsOpen& value) {
            return !value.url.empty() && value.url.size() <= 8192;
          },
          [](const TabsClose& value) { return value.tab_id > 0; },
          [](const TabsActivate& value) { return value.tab_id > 0; },
          [](const PageSnapshot& value) { return value.tab_id > 0; },
          [](const PageFind& value) {
            return value.tab_id > 0 && !value.query.empty() &&
                   value.query.size() <= 4096;
          },
          [](const PageClick& value) { return Valid(value.element); },
          [](const PageType& value) {
            return Valid(value.element) && value.text.size() <= 65536;
          },
          [](const PageScroll& value) {
            return value.tab_id > 0 && value.delta_y != 0;
          },
          [](const PageScreenshot& value) { return value.tab_id > 0; },
          [](const DevConsoleList& value) { return value.tab_id > 0; },
          [](const DevNetworkList& value) { return value.tab_id > 0; },
          [](const DevNetworkRequest& value) {
            return value.tab_id > 0 && !value.request_id.empty() &&
                   value.request_id.size() <= 1024;
          },
          [](const DevDomInspect& value) { return Valid(value.element); },
          [](const DevPerformanceSnapshot& value) { return value.tab_id > 0; },
      },
      call);
}

void AiActionAuditLog::Record(std::uint64_t action_id,
                              ToolDescriptor tool,
                              ActionState state,
                              Reason reason) {
  std::lock_guard lock(mutex_);
  entries_.push_back({action_id, tool.name, tool.capability, state, reason,
                      std::chrono::system_clock::now()});
}

std::vector<AuditEntry> AiActionAuditLog::Snapshot() const {
  std::lock_guard lock(mutex_);
  return entries_;
}

void BrowserPermissionBroker::BeginTask() {
  std::lock_guard lock(mutex_);
  grants_.clear();
  task_active_ = true;
}

void BrowserPermissionBroker::StopTask() {
  std::lock_guard lock(mutex_);
  task_active_ = false;
  grants_.clear();
}

void BrowserPermissionBroker::Grant(Capability capability) {
  std::lock_guard lock(mutex_);
  if (task_active_) {
    grants_.insert(capability);
  }
}

void BrowserPermissionBroker::Revoke(Capability capability) {
  std::lock_guard lock(mutex_);
  grants_.erase(capability);
}

bool BrowserPermissionBroker::HasGrant(Capability capability) const {
  std::lock_guard lock(mutex_);
  return task_active_ && grants_.contains(capability);
}

PermissionDecision BrowserPermissionBroker::Evaluate(
    ToolDescriptor tool,
    const Inspection& inspection,
    bool user_approved) const {
  std::lock_guard lock(mutex_);
  if (!task_active_) {
    return {false, false, Reason::kAiDisabled};
  }
  if (inspection.incognito) {
    return {false, false, Reason::kIncognito};
  }
  if (!grants_.contains(tool.capability)) {
    return {false, false, Reason::kCapabilityNotGranted};
  }
  if (!inspection.valid) {
    return {false, false, Reason::kInvalidTarget};
  }
  if (!inspection.redaction_ready) {
    return {false, false, Reason::kRedactionUnavailable};
  }
  if (inspection.sensitive_target) {
    return {false, false, Reason::kSensitiveTarget};
  }
  if ((tool.always_requires_approval || inspection.consequential) &&
      !user_approved) {
    return {false, true, Reason::kApprovalRequired};
  }
  return {true, false, Reason::kNone};
}

BrowserToolBroker::BrowserToolBroker(BrowserToolHost& host,
                                     AiActionAuditLog& audit)
    : host_(host), audit_(audit) {}
BrowserToolBroker::~BrowserToolBroker() = default;

bool BrowserToolBroker::BeginTask() {
  std::lock_guard lock(mutex_);
  if (task_active_ || !running_.empty()) {
    return false;
  }
  pending_.clear();
  permissions_.BeginTask();
  task_active_ = true;
  ++task_generation_;
  return true;
}

void BrowserToolBroker::Grant(Capability capability) {
  std::lock_guard lock(mutex_);
  if (task_active_) {
    permissions_.Grant(capability);
  }
}

void BrowserToolBroker::Revoke(Capability capability) {
  std::lock_guard lock(mutex_);
  permissions_.Revoke(capability);
  for (auto it = pending_.begin(); it != pending_.end();) {
    const ToolDescriptor tool = Describe(it->second);
    if (tool.capability != capability) {
      ++it;
      continue;
    }
    audit_.get().Record(it->first, tool, ActionState::kDenied,
                        Reason::kCapabilityNotGranted);
    it = pending_.erase(it);
  }
  for (const auto& [action_id, action] : running_) {
    if (action.tool.capability == capability &&
        !action.cancelled->exchange(true)) {
      audit_.get().Record(action_id, action.tool,
                          ActionState::kCancellationRequested,
                          Reason::kCapabilityNotGranted);
    }
  }
}

Submission BrowserToolBroker::Submit(ToolCall call) {
  const ToolDescriptor tool = Describe(call);
  std::uint64_t action_id;
  std::uint64_t generation;
  {
    std::lock_guard lock(mutex_);
    action_id = next_action_id_++;
    generation = task_generation_;
    audit_.get().Record(action_id, tool, ActionState::kSubmitted,
                        Reason::kNone);
    if (!task_active_) {
      audit_.get().Record(action_id, tool, ActionState::kDenied,
                          Reason::kAiDisabled);
      return {action_id, ActionState::kDenied, Reason::kAiDisabled, {}};
    }
    if (!permissions_.HasGrant(tool.capability)) {
      audit_.get().Record(action_id, tool, ActionState::kDenied,
                          Reason::kCapabilityNotGranted);
      return {
          action_id, ActionState::kDenied, Reason::kCapabilityNotGranted, {}};
    }
  }
  if (!HasValidArguments(call)) {
    audit_.get().Record(action_id, tool, ActionState::kDenied,
                        Reason::kInvalidTarget);
    return {action_id, ActionState::kDenied, Reason::kInvalidTarget, {}};
  }
  const Inspection inspection = host_.get().Inspect(call);
  {
    std::lock_guard lock(mutex_);
    if (!task_active_ || generation != task_generation_) {
      audit_.get().Record(action_id, tool, ActionState::kCancelled,
                          Reason::kStopped);
      return {action_id, ActionState::kCancelled, Reason::kStopped, {}};
    }
    const PermissionDecision decision =
        permissions_.Evaluate(tool, inspection, false);
    if (decision.approval_required) {
      pending_.emplace(action_id, std::move(call));
      audit_.get().Record(action_id, tool, ActionState::kAwaitingApproval,
                          decision.reason);
      return {action_id, ActionState::kAwaitingApproval, decision.reason, {}};
    }
    if (!decision.allowed) {
      audit_.get().Record(action_id, tool, ActionState::kDenied,
                          decision.reason);
      return {action_id, ActionState::kDenied, decision.reason, {}};
    }
    return Start(action_id, std::move(call), tool, generation);
  }
}

Submission BrowserToolBroker::Approve(std::uint64_t action_id) {
  ToolCall call;
  std::uint64_t generation;
  {
    std::lock_guard lock(mutex_);
    auto it = pending_.find(action_id);
    if (it == pending_.end()) {
      return {action_id, ActionState::kDenied, Reason::kUnknownAction, {}};
    }
    generation = task_generation_;
    call = std::move(it->second);
    pending_.erase(it);
  }
  const ToolDescriptor tool = Describe(call);
  const Inspection inspection = host_.get().Inspect(call);
  {
    std::lock_guard lock(mutex_);
    if (!task_active_ || generation != task_generation_) {
      audit_.get().Record(action_id, tool, ActionState::kCancelled,
                          Reason::kStopped);
      return {action_id, ActionState::kCancelled, Reason::kStopped, {}};
    }
    const PermissionDecision decision =
        permissions_.Evaluate(tool, inspection, true);
    if (!decision.allowed) {
      audit_.get().Record(action_id, tool, ActionState::kDenied,
                          decision.reason);
      return {action_id, ActionState::kDenied, decision.reason, {}};
    }
    return Start(action_id, std::move(call), tool, generation);
  }
}

bool BrowserToolBroker::Reject(std::uint64_t action_id) {
  std::lock_guard lock(mutex_);
  auto it = pending_.find(action_id);
  if (it == pending_.end()) {
    return false;
  }
  const ToolDescriptor tool = Describe(it->second);
  pending_.erase(it);
  audit_.get().Record(action_id, tool, ActionState::kDenied,
                      Reason::kUserRejected);
  return true;
}

void BrowserToolBroker::Stop() {
  std::lock_guard lock(mutex_);
  task_active_ = false;
  ++task_generation_;
  permissions_.StopTask();
  for (const auto& [action_id, call] : pending_) {
    audit_.get().Record(action_id, Describe(call), ActionState::kCancelled,
                        Reason::kStopped);
  }
  pending_.clear();
  for (const auto& [action_id, action] : running_) {
    if (!action.cancelled->exchange(true)) {
      audit_.get().Record(action_id, action.tool,
                          ActionState::kCancellationRequested,
                          Reason::kStopped);
    }
  }
}

Submission BrowserToolBroker::Start(std::uint64_t action_id,
                                    ToolCall call,
                                    ToolDescriptor tool,
                                    std::uint64_t generation) {
  auto cancelled = std::make_shared<std::atomic_bool>(false);
  int expected_tab_id = 0;
  if (const auto* page_snapshot = std::get_if<PageSnapshot>(&call)) {
    expected_tab_id = page_snapshot->tab_id;
  } else if (const auto* page_find = std::get_if<PageFind>(&call)) {
    expected_tab_id = page_find->tab_id;
  }
  running_.emplace(action_id, RunningAction{cancelled, tool, generation,
                                            call.index(), expected_tab_id});
  audit_.get().Record(action_id, tool, ActionState::kStarted, Reason::kNone);
  Submission submission{action_id, ActionState::kStarted, Reason::kNone, {}};
  submission.ticket = ExecutionTicket{action_id, std::move(call), cancelled};
  return submission;
}

Submission BrowserToolBroker::Complete(std::uint64_t action_id,
                                       ExecutionResult result) {
  std::lock_guard lock(mutex_);
  auto it = running_.find(action_id);
  if (it == running_.end()) {
    return {action_id, ActionState::kDenied, Reason::kUnknownAction, {}};
  }
  const RunningAction action = it->second;
  const bool stopped = action.cancelled->load() || !task_active_ ||
                       action.generation != task_generation_;
  running_.erase(it);
  ActionState state = ActionState::kFailed;
  Reason reason = Reason::kHostFailure;
  if (result.status == ExecutionStatus::kCompleted &&
      OutputMatchesTool(action.tool_index, action.expected_tab_id,
                        result.output)) {
    state = ActionState::kCompleted;
    reason = stopped ? Reason::kStopped : Reason::kNone;
  } else if (result.status == ExecutionStatus::kCancelled || stopped) {
    state = ActionState::kCancelled;
    reason = Reason::kStopped;
  }
  audit_.get().Record(action_id, action.tool, state, reason);
  if (state != ActionState::kCompleted || stopped) {
    result.output = std::monostate{};
  }
  return {action_id, state, reason, std::move(result.output)};
}

}  // namespace prism::ai
