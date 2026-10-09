#include "prism/ai/ai_session_service.h"

#include <utility>

#include "base/functional/bind.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "content/public/browser/browser_thread.h"
#include "prism/ai/chromium_tool_codec.h"

namespace prism::ai {
namespace {

constexpr std::size_t kMaxTaskCalls = 32;

bool IsTerminal(ActionState state) {
  return state == ActionState::kCompleted || state == ActionState::kDenied ||
         state == ActionState::kCancelled || state == ActionState::kFailed;
}

}  // namespace

AiSessionService::AiSessionService(
    base::WeakPtr<BrowserWindowInterface> browser,
    scoped_refptr<network::SharedURLLoaderFactory> loader_factory)
    : browser_(std::move(browser)),
      tools_(browser_),
      client_(std::move(loader_factory)) {
  tools_.SetCompletionObserver(base::BindRepeating(
      &AiSessionService::OnToolComplete, weak_factory_.GetWeakPtr()));
}

AiSessionService::~AiSessionService() {
  event_observer_.Reset();
  weak_factory_.InvalidateWeakPtrs();
  Stop();
}

void AiSessionService::SetEventObserver(EventObserver observer) {
  event_observer_ = std::move(observer);
}

bool AiSessionService::BeginTask(std::string model,
                                 std::string transient_api_key) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  if (state_ != State::kStopped || !browser_ || browser_->IsDeleteScheduled() ||
      browser_->GetProfile()->IsOffTheRecord() ||
      !client_.BeginTask(std::move(model), std::move(transient_api_key))) {
    return false;
  }
  if (!tools_.BeginTask()) {
    client_.Stop();
    return false;
  }
  state_ = State::kReady;
  total_calls_ = 0;
  Emit({AiSessionEventKind::kReady, ""});
  return true;
}

void AiSessionService::Grant(Capability capability) {
  if (state_ != State::kStopped) {
    tools_.Grant(capability);
  }
}

void AiSessionService::Revoke(Capability capability) {
  tools_.Revoke(capability);
  if (state_ == State::kAwaitingApproval && current_call_ &&
      Describe(*current_call_).capability == capability) {
    FinishCall({waiting_action_id_,
                ActionState::kDenied,
                Reason::kCapabilityNotGranted,
                {}});
  }
}

bool AiSessionService::SendUserMessage(std::string text) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  if (state_ != State::kReady) {
    return false;
  }
  if (!browser_ || browser_->IsDeleteScheduled() ||
      browser_->GetProfile()->IsOffTheRecord()) {
    Stop();
    return false;
  }
  if (!client_.SendUserMessage(std::move(text),
                               base::BindOnce(&AiSessionService::OnModelResult,
                                              weak_factory_.GetWeakPtr()))) {
    return false;
  }
  state_ = State::kRequesting;
  return true;
}

bool AiSessionService::Approve(std::uint64_t action_id) {
  if (state_ != State::kAwaitingApproval || action_id != waiting_action_id_) {
    return false;
  }
  HandleSubmission(tools_.Approve(action_id));
  return true;
}

bool AiSessionService::Reject(std::uint64_t action_id) {
  if (state_ != State::kAwaitingApproval || action_id != waiting_action_id_ ||
      !tools_.Reject(action_id)) {
    return false;
  }
  FinishCall({action_id, ActionState::kDenied, Reason::kUserRejected, {}});
  return true;
}

void AiSessionService::Stop() {
  if (state_ == State::kStopped) {
    return;
  }
  state_ = State::kStopped;
  tools_.Stop();
  client_.Stop();
  calls_.clear();
  outputs_.clear();
  current_call_.reset();
  waiting_action_id_ = 0;
  next_call_index_ = 0;
  Emit({AiSessionEventKind::kStopped, ""});
}

std::vector<AuditEntry> AiSessionService::AuditSnapshot() const {
  return tools_.AuditSnapshot();
}

void AiSessionService::OnModelResult(ModelResult result) {
  if (state_ == State::kStopped) {
    return;
  }
  if (state_ != State::kRequesting ||
      result.status != ModelResultStatus::kCompleted) {
    Fail("OpenAI request failed or returned an invalid response.");
    return;
  }
  if (!result.turn.text.empty()) {
    base::WeakPtr<AiSessionService> alive = weak_factory_.GetWeakPtr();
    Emit({AiSessionEventKind::kAssistantText, std::move(result.turn.text)});
    if (!alive) {
      return;
    }
  }
  if (state_ == State::kStopped) {
    return;
  }
  calls_ = std::move(result.turn.calls);
  outputs_.clear();
  next_call_index_ = 0;
  if (calls_.empty()) {
    state_ = State::kReady;
    Emit({AiSessionEventKind::kReady, ""});
    return;
  }
  ProcessNextCall();
}

void AiSessionService::ProcessNextCall() {
  if (state_ == State::kStopped) {
    return;
  }
  if (next_call_index_ == calls_.size()) {
    calls_.clear();
    current_call_.reset();
    if (!client_.SendFunctionOutputs(
            std::move(outputs_),
            base::BindOnce(&AiSessionService::OnModelResult,
                           weak_factory_.GetWeakPtr()))) {
      Fail("Could not continue the OpenAI tool response.");
      return;
    }
    state_ = State::kRequesting;
    return;
  }
  if (++total_calls_ > kMaxTaskCalls) {
    Fail("AI task reached its tool-call limit.");
    return;
  }
  const ModelFunctionCall& model_call = calls_[next_call_index_];
  current_call_ =
      ChromiumToolCodec::Decode(model_call.name, model_call.arguments_json);
  if (!current_call_) {
    Fail("AI requested an unknown or invalid browser tool.");
    return;
  }
  HandleSubmission(tools_.Submit(*current_call_));
}

void AiSessionService::HandleSubmission(Submission submission) {
  if (IsTerminal(submission.state)) {
    FinishCall(std::move(submission));
    return;
  }
  waiting_action_id_ = submission.action_id;
  if (submission.state == ActionState::kAwaitingApproval) {
    state_ = State::kAwaitingApproval;
    AiSessionEvent event{AiSessionEventKind::kApprovalRequired, "",
                         waiting_action_id_, current_call_};
    Emit(std::move(event));
  } else if (submission.state == ActionState::kStarted) {
    state_ = State::kRunningTool;
  } else {
    Fail("Browser tool entered an invalid state.");
  }
}

void AiSessionService::OnToolComplete(Submission submission) {
  if (state_ != State::kRunningTool ||
      submission.action_id != waiting_action_id_) {
    return;
  }
  if (!IsTerminal(submission.state)) {
    Fail("Browser tool did not finish correctly.");
    return;
  }
  FinishCall(std::move(submission));
}

void AiSessionService::FinishCall(Submission submission) {
  std::optional<std::string> output = ChromiumToolCodec::Serialize(submission);
  if (!output || next_call_index_ >= calls_.size()) {
    Fail("Browser tool result could not be encoded safely.");
    return;
  }
  outputs_.push_back({calls_[next_call_index_].call_id, std::move(*output)});
  base::WeakPtr<AiSessionService> alive = weak_factory_.GetWeakPtr();
  Emit({AiSessionEventKind::kToolAction, "", submission.action_id});
  if (!alive || state_ == State::kStopped) {
    return;
  }
  ++next_call_index_;
  waiting_action_id_ = 0;
  current_call_.reset();
  ProcessNextCall();
}

void AiSessionService::Emit(AiSessionEvent event) {
  if (event_observer_) {
    event_observer_.Run(event);
  }
}

void AiSessionService::Fail(std::string message) {
  base::WeakPtr<AiSessionService> alive = weak_factory_.GetWeakPtr();
  Emit({AiSessionEventKind::kError, std::move(message)});
  if (alive) {
    Stop();
  }
}

}  // namespace prism::ai
