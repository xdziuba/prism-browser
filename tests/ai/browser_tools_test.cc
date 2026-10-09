#include "prism/ai/browser_tools.h"
#include "prism/ai/page_context.h"

#include <atomic>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <string>
#include <thread>

namespace {

using namespace prism::ai;

void Require(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(1);
  }
}

class TestHost : public BrowserToolHost {
 public:
  Inspection inspection{true, false, false, false, true};
  int inspections = 0;

  Inspection Inspect(const ToolCall&) override {
    ++inspections;
    return inspection;
  }
};

class InspectBarrierHost : public TestHost {
 public:
  std::atomic_bool inspecting = false;
  std::atomic_bool release = false;

  Inspection Inspect(const ToolCall&) override {
    inspecting.store(true);
    while (!release.load()) {
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    return inspection;
  }
};

void TestGrantsAndDenials() {
  TestHost host;
  AiActionAuditLog audit;
  BrowserToolBroker broker(host, audit);
  Require(broker.Submit(TabsList{}).reason == Reason::kAiDisabled,
          "AI must be disabled before a task begins");
  Require(broker.BeginTask(), "task should begin");
  Require(broker.Submit(TabsList{}).reason == Reason::kCapabilityNotGranted,
          "read requires a grant");
  Require(host.inspections == 0,
          "denied capability must not inspect browser content");
  broker.Grant(Capability::kRead);
  const Submission ready = broker.Submit(TabsList{});
  Require(ready.state == ActionState::kStarted && ready.ticket.has_value(),
          "granted read should yield a dispatch ticket");
  TabsListOutput tabs_output;
  tabs_output.tabs.push_back({7, true, "https://example.test"});
  const Submission completed = broker.Complete(
      ready.action_id, {ExecutionStatus::kCompleted, tabs_output});
  Require(completed.state == ActionState::kCompleted &&
              std::holds_alternative<TabsListOutput>(completed.output),
          "trusted adapter completion should preserve a typed result");

  host.inspection.incognito = true;
  Require(broker.Submit(TabsList{}).reason == Reason::kIncognito,
          "Incognito must be denied");
  host.inspection.incognito = false;
  host.inspection.redaction_ready = false;
  Require(broker.Submit(TabsList{}).reason == Reason::kRedactionUnavailable,
          "read without redaction must be denied");
  host.inspection.redaction_ready = true;
  Require(broker.Submit(PageFind{1, ""}).reason == Reason::kInvalidTarget,
          "invalid arguments must be denied before inspection");
  Require(
      broker.Submit(PageScreenshot{1}).reason == Reason::kCapabilityNotGranted,
      "screenshot needs a separate sensitive grant");
  Require(broker.Submit(DevNetworkRequest{1, "request-1"}).reason ==
              Reason::kCapabilityNotGranted,
          "developer tools need a separate grant");
}

void TestApprovalAndReinspection() {
  TestHost host;
  AiActionAuditLog audit;
  BrowserToolBroker broker(host, audit);
  broker.BeginTask();
  broker.Grant(Capability::kInteract);
  const Submission close = broker.Submit(TabsClose{7});
  Require(close.state == ActionState::kAwaitingApproval,
          "closing a tab requires approval");
  Require(!close.ticket.has_value(), "pending close must not dispatch");
  const Submission approved = broker.Approve(close.action_id);
  Require(
      approved.state == ActionState::kStarted && approved.ticket.has_value(),
      "approved close should dispatch");
  Require(
      broker.Complete(
                approved.action_id,
                {ExecutionStatus::kCompleted,
                 ActionAcknowledgement{AcknowledgementKind::kCloseRequested}})
              .state == ActionState::kCompleted,
      "approved close should finish");
  Require(broker.Approve(close.action_id).reason == Reason::kUnknownAction,
          "approval must be one-use");

  const Submission click = broker.Submit(PageClick{{7, 10, 3}});
  Require(click.state == ActionState::kAwaitingApproval,
          "semantic click requires approval");
  host.inspection.sensitive_target = true;
  Require(broker.Approve(click.action_id).reason == Reason::kSensitiveTarget,
          "approval must re-inspect a changed target");
  Require(broker.Complete(click.action_id, {ExecutionStatus::kCompleted, {}})
                  .reason == Reason::kUnknownAction,
          "sensitive target must not dispatch");

  const std::string secret = "SENTINEL_PASSWORD_VALUE";
  const Submission typed = broker.Submit(PageType{{7, 10, 3}, secret});
  Require(typed.reason == Reason::kSensitiveTarget,
          "typing into a sensitive target must be denied");
  for (const AuditEntry& entry : audit.Snapshot()) {
    Require(entry.tool_name.find(secret) == std::string::npos,
            "audit must not contain typed text");
  }

  host.inspection.sensitive_target = false;
  host.inspection.consequential = true;
  broker.Grant(Capability::kNavigate);
  const Submission navigation = broker.Submit(TabsOpen{"https://example.test"});
  Require(navigation.state == ActionState::kAwaitingApproval,
          "host-classified consequential navigation requires approval");
  Require(broker.Reject(navigation.action_id),
          "user rejection should clear pending navigation");
}

void TestStop() {
  TestHost host;
  AiActionAuditLog audit;
  BrowserToolBroker broker(host, audit);
  broker.BeginTask();
  broker.Grant(Capability::kInteract);
  const Submission pending = broker.Submit(TabsClose{1});
  broker.Stop();
  Require(broker.Approve(pending.action_id).reason == Reason::kUnknownAction,
          "Stop must clear pending approval");
  Require(broker.BeginTask(), "new task should begin after pending stop");
  Require(
      broker.Submit(PageScroll{1, 50}).reason == Reason::kCapabilityNotGranted,
      "new task must not inherit grants");

  TestHost active_host;
  AiActionAuditLog active_audit;
  BrowserToolBroker active_broker(active_host, active_audit);
  active_broker.BeginTask();
  active_broker.Grant(Capability::kInteract);
  const Submission running = active_broker.Submit(PageScroll{1, 50});
  Require(running.ticket.has_value(), "active tool should have a ticket");
  active_broker.Stop();
  Require(running.ticket->cancelled->load(),
          "Stop should signal an in-flight adapter call");
  Require(!active_broker.BeginTask(),
          "new task must wait for in-flight completion");
  Require(
      active_broker
              .Complete(running.action_id, {ExecutionStatus::kCancelled, {}})
              .state == ActionState::kCancelled,
      "adapter cancellation should finish the call");
  Require(active_broker.BeginTask(),
          "new task should begin after cancellation completion");
  bool saw_request = false;
  for (const AuditEntry& entry : active_audit.Snapshot()) {
    saw_request |= entry.state == ActionState::kCancellationRequested;
  }
  Require(saw_request, "audit should record immediate cancellation request");
}

void TestOldInspectionCannotEnterNewTask() {
  InspectBarrierHost host;
  AiActionAuditLog audit;
  BrowserToolBroker broker(host, audit);
  broker.BeginTask();
  broker.Grant(Capability::kRead);
  Submission old_call;
  std::thread worker([&] { old_call = broker.Submit(TabsList{}); });
  const auto deadline =
      std::chrono::steady_clock::now() + std::chrono::seconds(2);
  while (!host.inspecting.load() &&
         std::chrono::steady_clock::now() < deadline) {
    std::this_thread::sleep_for(std::chrono::milliseconds(1));
  }
  Require(host.inspecting.load(), "old task should be inspecting");
  broker.Stop();
  Require(broker.BeginTask(), "new task should begin");
  broker.Grant(Capability::kRead);
  host.release.store(true);
  worker.join();
  Require(old_call.state == ActionState::kCancelled,
          "old call must not use a new task's grant");
  Require(!old_call.ticket.has_value(),
          "old call must not receive a dispatch ticket");
}

void TestRevocationClearsApproval() {
  TestHost host;
  AiActionAuditLog audit;
  BrowserToolBroker broker(host, audit);
  broker.BeginTask();
  broker.Grant(Capability::kInteract);
  const Submission pending = broker.Submit(TabsClose{1});
  broker.Revoke(Capability::kInteract);
  Require(broker.Approve(pending.action_id).reason == Reason::kUnknownAction,
          "revocation must clear pending approval");
  Require(broker.Complete(pending.action_id, {ExecutionStatus::kCompleted, {}})
                  .reason == Reason::kUnknownAction,
          "revoked call must not dispatch");
}

void TestLateCompletionAndOneUseTicket() {
  TestHost host;
  AiActionAuditLog audit;
  BrowserToolBroker broker(host, audit);
  broker.BeginTask();
  broker.Grant(Capability::kRead);
  const Submission running = broker.Submit(TabsList{});
  Require(running.ticket.has_value(), "read should dispatch");
  broker.Stop();
  TabsListOutput late_output;
  late_output.tabs.push_back({9, false, "https://sensitive.example"});
  const Submission completed = broker.Complete(
      running.action_id, {ExecutionStatus::kCompleted, late_output});
  Require(completed.state == ActionState::kCompleted &&
              completed.reason == Reason::kStopped &&
              std::holds_alternative<std::monostate>(completed.output),
          "completed action after Stop must not deliver output to AI");
  Require(broker.Complete(running.action_id, {ExecutionStatus::kCompleted, {}})
                  .reason == Reason::kUnknownAction,
          "ticket completion must be one-use");
}

void TestMismatchedOutputFailsClosed() {
  TestHost host;
  AiActionAuditLog audit;
  BrowserToolBroker broker(host, audit);
  broker.BeginTask();
  broker.Grant(Capability::kRead);
  const Submission running = broker.Submit(TabsList{});
  const Submission mismatched =
      broker.Complete(running.action_id,
                      {ExecutionStatus::kCompleted,
                       ActionAcknowledgement{AcknowledgementKind::kActivated}});
  Require(mismatched.state == ActionState::kFailed &&
              std::holds_alternative<std::monostate>(mismatched.output),
          "wrong result type must fail closed");
}

void TestPageSnapshotOutputIsBoundToTab() {
  TestHost host;
  AiActionAuditLog audit;
  BrowserToolBroker broker(host, audit);
  broker.BeginTask();
  broker.Grant(Capability::kRead);
  const Submission running = broker.Submit(PageSnapshot{7});
  auto snapshot = std::make_shared<PageContextSnapshot>();
  snapshot->tab_id = 8;
  snapshot->snapshot_id = 1;
  const Submission wrong_tab = broker.Complete(
      running.action_id, {ExecutionStatus::kCompleted, snapshot});
  Require(wrong_tab.state == ActionState::kFailed,
          "snapshot from a different tab must fail closed");

  const Submission matching = broker.Submit(PageSnapshot{7});
  snapshot->tab_id = 7;
  const Submission completed = broker.Complete(
      matching.action_id, {ExecutionStatus::kCompleted, snapshot});
  Require(completed.state == ActionState::kCompleted,
          "matching typed snapshot should complete");
}

void TestPageFindOutputIsBoundToTab() {
  TestHost host;
  AiActionAuditLog audit;
  BrowserToolBroker broker(host, audit);
  broker.BeginTask();
  broker.Grant(Capability::kRead);
  const Submission running = broker.Submit(PageFind{7, "needle"});
  PageFindOutput output;
  output.tab_id = 8;
  output.snapshot_id = 1;
  Require(
      broker.Complete(running.action_id, {ExecutionStatus::kCompleted, output})
              .state == ActionState::kFailed,
      "find output from another tab must fail closed");
}

}  // namespace

int main() {
  TestGrantsAndDenials();
  TestApprovalAndReinspection();
  TestStop();
  TestOldInspectionCannotEnterNewTask();
  TestRevocationClearsApproval();
  TestLateCompletionAndOneUseTicket();
  TestMismatchedOutputFailsClosed();
  TestPageSnapshotOutputIsBoundToTab();
  TestPageFindOutputIsBoundToTab();
  std::cout << "browser_tools policy tests passed\n";
}
