#ifndef PRISM_AI_OPENAI_RESPONSES_CLIENT_H_
#define PRISM_AI_OPENAI_RESPONSES_CLIENT_H_

#include <memory>
#include <string>
#include <vector>

#include "base/functional/callback.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "base/values.h"

namespace network {
class SharedURLLoaderFactory;
class SimpleURLLoader;
}  // namespace network

namespace prism::ai {

struct ModelFunctionCall {
  std::string call_id;
  std::string name;
  std::string arguments_json;
};

struct FunctionOutput {
  std::string call_id;
  std::string output_json;
};

struct ModelTurn {
  std::string text;
  std::vector<ModelFunctionCall> calls;
};

enum class ModelResultStatus { kCompleted, kFailed, kCancelled };

struct ModelResult {
  ModelResultStatus status = ModelResultStatus::kFailed;
  ModelTurn turn;
};

// One browser-process task, with stateless Responses API history held in RAM.
class OpenAIResponsesClient {
 public:
  using Completion = base::OnceCallback<void(ModelResult)>;

  explicit OpenAIResponsesClient(
      scoped_refptr<network::SharedURLLoaderFactory> loader_factory);
  ~OpenAIResponsesClient();

  bool BeginTask(std::string model, std::string transient_api_key);
  bool SendUserMessage(std::string text, Completion completion);
  bool SendFunctionOutput(std::string call_id,
                          std::string output_json,
                          Completion completion);
  bool SendFunctionOutputs(std::vector<FunctionOutput> outputs,
                           Completion completion);
  void Stop();

 private:
  bool StartRequest(base::ListValue pending_items, Completion completion);
  void OnLoaded(std::optional<std::string> body);

  scoped_refptr<network::SharedURLLoaderFactory> loader_factory_;
  std::unique_ptr<network::SimpleURLLoader> loader_;
  std::string model_;
  std::string api_key_;
  base::ListValue history_;
  base::ListValue pending_items_;
  Completion completion_;
  base::WeakPtrFactory<OpenAIResponsesClient> weak_factory_{this};
};

}  // namespace prism::ai

#endif  // PRISM_AI_OPENAI_RESPONSES_CLIENT_H_
