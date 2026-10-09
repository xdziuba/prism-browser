#ifndef PRISM_AI_BROWSER_TOOLS_H_
#define PRISM_AI_BROWSER_TOOLS_H_

#include <atomic>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <set>
#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace prism::ai {

enum class Capability {
  kRead,
  kNavigate,
  kInteract,
  kSensitive,
  kDeveloperPower
};

struct ElementRef {
  int tab_id;
  std::uint64_t snapshot_id;
  std::uint64_t node_id;
};

struct TabsList {};
struct TabsOpen {
  std::string url;
};
struct TabsClose {
  int tab_id;
};
struct TabsActivate {
  int tab_id;
};
struct PageSnapshot {
  int tab_id;
};
struct PageFind {
  int tab_id;
  std::string query;
};
struct PageClick {
  ElementRef element;
};
struct PageType {
  ElementRef element;
  std::string text;
};
struct PageScroll {
  int tab_id;
  int delta_y;
};
struct PageScreenshot {
  int tab_id;
};
struct DevConsoleList {
  int tab_id;
};
struct DevNetworkList {
  int tab_id;
};
struct DevNetworkRequest {
  int tab_id;
  std::string request_id;
};
struct DevDomInspect {
  ElementRef element;
};
struct DevPerformanceSnapshot {
  int tab_id;
};

using ToolCall = std::variant<TabsList,
                              TabsOpen,
                              TabsClose,
                              TabsActivate,
                              PageSnapshot,
                              PageFind,
                              PageClick,
                              PageType,
                              PageScroll,
                              PageScreenshot,
                              DevConsoleList,
                              DevNetworkList,
                              DevNetworkRequest,
                              DevDomInspect,
                              DevPerformanceSnapshot>;

struct ToolDescriptor {
  const char* name;
  Capability capability;
  bool always_requires_approval;
};

ToolDescriptor Describe(const ToolCall& call);
bool HasValidArguments(const ToolCall& call);

enum class ActionState {
  kSubmitted,
  kDenied,
  kAwaitingApproval,
  kStarted,
  kCompleted,
  kFailed,
  kCancellationRequested,
  kCancelled,
};

enum class Reason {
  kNone,
  kAiDisabled,
  kIncognito,
  kCapabilityNotGranted,
  kInvalidTarget,
  kRedactionUnavailable,
  kSensitiveTarget,
  kApprovalRequired,
  kUserRejected,
  kStopped,
  kHostFailure,
  kUnknownAction,
};

struct AuditEntry {
  std::uint64_t action_id;
  std::string tool_name;
  Capability capability;
  ActionState state;
  Reason reason;
  std::chrono::system_clock::time_point timestamp;
};

class AiActionAuditLog {
 public:
  void Record(std::uint64_t action_id,
              ToolDescriptor tool,
              ActionState state,
              Reason reason);
  std::vector<AuditEntry> Snapshot() const;

 private:
  mutable std::mutex mutex_;
  std::vector<AuditEntry> entries_;
};

// Supplied by browser code, never by tool arguments or page content.
struct Inspection {
  bool valid = false;
  bool incognito = false;
  bool sensitive_target = false;
  bool consequential = false;
  bool redaction_ready = false;
};

struct PermissionDecision {
  bool allowed = false;
  bool approval_required = false;
  Reason reason = Reason::kNone;
};

class BrowserPermissionBroker {
 public:
  void BeginTask();
  void StopTask();
  void Grant(Capability capability);
  void Revoke(Capability capability);
  bool HasGrant(Capability capability) const;
  PermissionDecision Evaluate(ToolDescriptor tool,
                              const Inspection& inspection,
                              bool user_approved) const;

 private:
  mutable std::mutex mutex_;
  bool task_active_ = false;
  std::set<Capability> grants_;
};

enum class ExecutionStatus { kCompleted, kFailed, kCancelled };

struct TabSummary {
  int id = 0;
  bool active = false;
  std::string origin;
};

struct TabsListOutput {
  std::vector<TabSummary> tabs;
  bool truncated = false;
};

struct PageFindMatch {
  std::size_t byte_offset = 0;
  std::string snippet;
};

struct PageFindOutput {
  int tab_id = 0;
  std::uint64_t snapshot_id = 0;
  std::vector<PageFindMatch> matches;
  bool truncated = false;
};

enum class AcknowledgementKind {
  kOpenRequested,
  kCloseRequested,
  kActivated,
};

struct ActionAcknowledgement {
  AcknowledgementKind kind;
};

struct PageContextSnapshot;

// Add new typed result variants before implementing additional tools. Model
// transport must serialize each variant by an explicit field allowlist.
using ToolOutput = std::variant<std::monostate,
                                TabsListOutput,
                                ActionAcknowledgement,
                                PageFindOutput,
                                std::shared_ptr<const PageContextSnapshot>>;

struct ExecutionResult {
  ExecutionStatus status = ExecutionStatus::kFailed;
  ToolOutput output;
};

class BrowserToolHost {
 public:
  virtual ~BrowserToolHost() = default;
  // Inspect must use live browser state. The trusted caller that receives an
  // execution ticket must revalidate immediately before mutating browser state.
  virtual Inspection Inspect(const ToolCall& call) = 0;
};

// Internal dispatch data for a trusted browser adapter. Never serialize this
// object to the model or a page; only the final Submission metadata is public.
struct ExecutionTicket {
  std::uint64_t action_id;
  ToolCall call;
  std::shared_ptr<std::atomic_bool> cancelled;
};

struct Submission {
  Submission() = default;
  Submission(std::uint64_t id,
             ActionState action_state,
             Reason action_reason,
             ToolOutput tool_output)
      : action_id(id),
        state(action_state),
        reason(action_reason),
        output(std::move(tool_output)) {}

  std::uint64_t action_id = 0;
  ActionState state = ActionState::kDenied;
  Reason reason = Reason::kNone;
  ToolOutput output;
  std::optional<ExecutionTicket> ticket;
};

class BrowserToolBroker {
 public:
  BrowserToolBroker(BrowserToolHost& host, AiActionAuditLog& audit);

  // Trusted browser UI entry points. None are exposed as AI tool calls.
  bool BeginTask();
  void Grant(Capability capability);
  void Revoke(Capability capability);
  Submission Approve(std::uint64_t action_id);
  bool Reject(std::uint64_t action_id);
  void Stop();

  Submission Submit(ToolCall call);
  // Called exactly once by the trusted adapter when a ticket finishes.
  Submission Complete(std::uint64_t action_id, ExecutionResult result);

 private:
  struct RunningAction {
    std::shared_ptr<std::atomic_bool> cancelled;
    ToolDescriptor tool;
    std::uint64_t generation;
    std::size_t tool_index;
    int expected_tab_id;
  };

  // Caller holds mutex_ and has already evaluated the current inspection.
  Submission Start(std::uint64_t action_id,
                   ToolCall call,
                   ToolDescriptor tool,
                   std::uint64_t generation);

  BrowserToolHost& host_;
  AiActionAuditLog& audit_;
  BrowserPermissionBroker permissions_;
  std::mutex mutex_;
  bool task_active_ = false;
  std::uint64_t task_generation_ = 0;
  std::uint64_t next_action_id_ = 1;
  std::map<std::uint64_t, ToolCall> pending_;
  std::map<std::uint64_t, RunningAction> running_;
};

}  // namespace prism::ai

#endif  // PRISM_AI_BROWSER_TOOLS_H_
