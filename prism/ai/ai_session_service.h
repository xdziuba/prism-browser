#ifndef PRISM_AI_AI_SESSION_SERVICE_H_
#define PRISM_AI_AI_SESSION_SERVICE_H_

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "base/functional/callback.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "prism/ai/chromium_browser_tool_service.h"
#include "prism/ai/openai_responses_client.h"

class BrowserWindowInterface;
namespace network {
class SharedURLLoaderFactory;
}

namespace prism::ai {

enum class AiSessionEventKind {
  kAssistantText,
  kApprovalRequired,
  kReady,
  kError,
  kStopped,
};

struct AiSessionEvent {
  AiSessionEventKind kind;
  std::string text;
  std::uint64_t action_id = 0;
  std::optional<ToolCall> approval_call;
};

// One trusted browser-window session. Renderer content cannot access this API.
class AiSessionService {
 public:
  using EventObserver = base::RepeatingCallback<void(const AiSessionEvent&)>;

  AiSessionService(
      base::WeakPtr<BrowserWindowInterface> browser,
      scoped_refptr<network::SharedURLLoaderFactory> loader_factory);
  ~AiSessionService();

  void SetEventObserver(EventObserver observer);
  bool BeginTask(std::string model, std::string transient_api_key);
  void Grant(Capability capability);
  void Revoke(Capability capability);
  bool SendUserMessage(std::string text);
  bool Approve(std::uint64_t action_id);
  bool Reject(std::uint64_t action_id);
  void Stop();
  std::vector<AuditEntry> AuditSnapshot() const;

 private:
  enum class State {
    kStopped,
    kReady,
    kRequesting,
    kRunningTool,
    kAwaitingApproval,
  };

  void OnModelResult(ModelResult result);
  void ProcessNextCall();
  void HandleSubmission(Submission submission);
  void OnToolComplete(Submission submission);
  void FinishCall(Submission submission);
  void Emit(AiSessionEvent event);
  void Fail(std::string message);

  base::WeakPtr<BrowserWindowInterface> browser_;
  ChromiumBrowserToolService tools_;
  OpenAIResponsesClient client_;
  EventObserver event_observer_;
  State state_ = State::kStopped;
  std::vector<ModelFunctionCall> calls_;
  std::vector<FunctionOutput> outputs_;
  std::optional<ToolCall> current_call_;
  std::uint64_t waiting_action_id_ = 0;
  std::size_t next_call_index_ = 0;
  std::size_t total_calls_ = 0;
  base::WeakPtrFactory<AiSessionService> weak_factory_{this};
};

}  // namespace prism::ai

#endif  // PRISM_AI_AI_SESSION_SERVICE_H_
